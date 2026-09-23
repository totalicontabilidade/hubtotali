/* ============================================================
   Hub Totali · recebedor do Atos Societários
   ------------------------------------------------------------
   Este arquivo NÃO roda no Hub. Ele é colado no Apps Script da
   conta Google da Totali e publicado como aplicativo da web — é
   ele que dá ao Hub um endereço capaz de receber aviso de fora,
   coisa que um site sem servidor não tem.

   O CAMINHO INTEIRO, em uma frase: o Atos avisa este endereço
   quando uma solicitação é criada ou finalizada, e aqui esse
   aviso vira (ou fecha) uma pendência no Hub.

   POR QUE O ATOS NÃO ESCREVE DIRETO NO HUB

   Porque o Atos vai ser vendido. Um produto que conhece o formato
   de pendência do Hub só serve para quem tem o Hub, e obrigaria
   cada comprador a guardar a senha de um sistema alheio dentro do
   navegador. Então o Atos manda um aviso genérico — "solicitação
   criada", com os campos dela — e quem traduz isso para o
   vocabulário do Hub é este arquivo, que é da Totali.

   O QUE PRECISA ESTAR CONFIGURADO (Arquivo → Propriedades do
   projeto → Propriedades do script), e por quê:

     SEGREDO     a senha combinada com o Atos. Sem ela, qualquer
                 um que descobrisse o endereço abriria pendência
                 no Hub.
     EMAIL       conta do robô no Hub (ex.: atos@...)
     SENHA       senha desse robô
     PROJETO     hubtotali
     CHAVE       a apiKey do Hub (é pública, como no site)
     SETOR       para onde vão as pendências (Legalização)

   A SENHA DO ROBÔ FICA AQUI, e não no Atos, de propósito: aqui
   ela está no servidor do Google, dentro da conta da Totali, e
   não no navegador de quem usa o Atos.

   PARA PUBLICAR: Implantar → Nova implantação → tipo "app da
   web" → executar como EU → quem pode acessar QUALQUER PESSOA.
   "Qualquer pessoa" é obrigatório para o Atos conseguir chamar;
   quem barra estranho é o segredo, conferido logo na entrada.
   ============================================================ */

var P = PropertiesService.getScriptProperties();

function prop(nome, padrao) {
  var v = P.getProperty(nome);
  return (v === null || v === "") ? padrao : v;
}

/* ---------- entrada ---------- */

function doPost(e) {
  try {
    var corpo = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    if (String(corpo.segredo || "") !== String(prop("SEGREDO", ""))) {
      /* Sem dizer o que está errado: para quem está tentando
         adivinhar, "segredo errado" já é informação. */
      return responder({ ok: false, erro: "recusado" });
    }

    var evento = String(corpo.evento || "");
    var s = corpo.solicitacao || {};
    if (!s.id) return responder({ ok: false, erro: "solicitação sem identificador" });

    if (evento === "solicitacao.criada")     return responder(criarPendencia(s));
    if (evento === "solicitacao.finalizada") return responder(resolverPendencia(s));

    /* Evento desconhecido não é erro: o Atos pode passar a mandar
       tipos novos, e um recebedor antigo deve ignorá-los em paz. */
    return responder({ ok: true, ignorado: evento });
  } catch (erro) {
    return responder({ ok: false, erro: String(erro) });
  }
}

/* O Atos pode chamar isto para conferir a configuração sem criar
   nada — vale muito no dia de ligar as duas pontas. */
function doGet() {
  return responder({ ok: true, servico: "recebedor do Atos no Hub" });
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- conversa com o Hub ---------- */

function entrar() {
  var r = UrlFetchApp.fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" +
      encodeURIComponent(prop("CHAVE", "")),
    {
      method: "post",
      contentType: "application/json",
      muteHttpExceptions: true,
      payload: JSON.stringify({
        email: prop("EMAIL", ""),
        password: prop("SENHA", ""),
        returnSecureToken: true,
      }),
    });
  var j = JSON.parse(r.getContentText() || "{}");
  if (!j.idToken) throw new Error("não consegui entrar no Hub como robô: " + r.getContentText());
  return { token: j.idToken, uid: j.localId };
}

function base() {
  return "https://firestore.googleapis.com/v1/projects/" + prop("PROJETO", "hubtotali") +
         "/databases/(default)/documents";
}

function chamar(caminho, metodo, corpo, token) {
  var r = UrlFetchApp.fetch(base() + caminho, {
    method: metodo,
    contentType: "application/json",
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + token },
    payload: corpo ? JSON.stringify(corpo) : null,
  });
  return { codigo: r.getResponseCode(), texto: r.getContentText() };
}

/* ---------- achar o que já veio ----------
   O Atos pode repetir o aviso: rede que cai no meio, pessoa que
   salva duas vezes, reenvio automático. Sem esta consulta, cada
   repetição viraria uma pendência nova — e a lista do escritório
   encheria de cópias da mesma coisa. */
function acharPorOrigem(id, token) {
  var r = UrlFetchApp.fetch(base() + ":runQuery", {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "pendencias" }],
        where: { fieldFilter: {
          field: { fieldPath: "origemId" },
          op: "EQUAL",
          value: { stringValue: String(id) },
        } },
        limit: 1,
      },
    }),
  });
  var j = JSON.parse(r.getContentText() || "[]");
  for (var i = 0; i < j.length; i++) {
    if (j[i].document) {
      return {
        nome: j[i].document.name,
        id: String(j[i].document.name).split("/").pop(),
        campos: j[i].document.fields || {},
      };
    }
  }
  return null;
}

/* ---------- criar ---------- */

function criarPendencia(s) {
  var sessao = entrar();

  var jaTem = acharPorOrigem(s.id, sessao.token);
  if (jaTem) return { ok: true, repetido: true, pendencia: jaTem.id };

  var titulo = tituloDe(s);
  var doc = {
    oque:          { stringValue: titulo },
    porque:        { stringValue: descricaoDe(s) },
    sugestao:      { stringValue: "" },
    responsavel:   { stringValue: "" },
    envolvidos:    { arrayValue: { values: [] } },
    prazo:         { stringValue: dataDe(s.prazo) },
    setorOrigem:   { stringValue: "" },
    setorDestino:  { stringValue: prop("SETOR", "Legalização") },
    podemVer:      { arrayValue: { values: [] } },
    situacao:      { stringValue: "aberta" },
    criadoPor:     { stringValue: sessao.uid },
    vistas:        { arrayValue: { values: [{ stringValue: sessao.uid }] } },
    deveDarCiencia:{ arrayValue: { values: [] } },
    ciencia:       { arrayValue: { values: [] } },
    ehRecado:      { booleanValue: false },
    urgencia:      { stringValue: "normal" },

    /* De onde veio, em dois campos simples em vez de um mapa: é o
       que a consulta acima usa para não duplicar, e o que permite
       fechar a pendência certa quando a solicitação terminar. */
    origemSistema: { stringValue: "atos" },
    origemId:      { stringValue: String(s.id) },
  };

  var id = novoId();
  var r = chamar(":commit", "post", {
    writes: [{
      update: {
        name: "projects/" + prop("PROJETO", "hubtotali") +
              "/databases/(default)/documents/pendencias/" + id,
        fields: doc,
      },
      /* A hora é a do servidor, como em toda escrita do Hub: a
         regra de lá confere isso, e janela medida por relógio de
         quem escreve é janela que estica. */
      updateTransforms: [{ fieldPath: "criadoEm", setToServerValue: "REQUEST_TIME" }],
      currentDocument: { exists: false },
    }],
  }, sessao.token);

  if (r.codigo >= 300) return { ok: false, erro: "o Hub recusou (HTTP " + r.codigo + "): " + r.texto };

  anotar(id, "Aberta pelo Atos Societários a partir da solicitação de " +
             (s.empresa || "cliente") + ".", sessao);
  return { ok: true, pendencia: id };
}

/* ---------- resolver ---------- */

function resolverPendencia(s) {
  var sessao = entrar();
  var achada = acharPorOrigem(s.id, sessao.token);
  if (!achada) return { ok: true, semPendencia: true };

  var situacao = (achada.campos.situacao || {}).stringValue || "";
  if (situacao === "resolvida") return { ok: true, jaEstavaResolvida: true };

  var r = chamar("/pendencias/" + achada.id + "?updateMask.fieldPaths=situacao", "patch",
    { fields: { situacao: { stringValue: "resolvida" } } }, sessao.token);

  if (r.codigo >= 300) return { ok: false, erro: "o Hub recusou (HTTP " + r.codigo + "): " + r.texto };

  anotar(achada.id, "Finalizada no Atos Societários.", sessao);
  return { ok: true, pendencia: achada.id };
}

/* ---------- a linha do tempo ----------
   Entra como anotação do sistema: quem lê a pendência precisa
   saber que quem mexeu foi a integração, e não uma pessoa. */
function anotar(idPendencia, texto, sessao) {
  chamar(":commit", "post", {
    writes: [{
      update: {
        name: "projects/" + prop("PROJETO", "hubtotali") +
              "/databases/(default)/documents/pendencias/" + idPendencia + "/andamento/" + novoId(),
        fields: {
          autor:       { stringValue: sessao.uid },
          autorNome:   { stringValue: "Atos Societários" },
          texto:       { stringValue: texto },
          doSistema:   { booleanValue: true },
          mencionados: { arrayValue: { values: [] } },
        },
      },
      updateTransforms: [{ fieldPath: "criadoEm", setToServerValue: "REQUEST_TIME" }],
      currentDocument: { exists: false },
    }],
  }, sessao.token);
}

/* ---------- traduções ---------- */

var TIPOS = {
  alt: "Alteração contratual",
  abe: "Abertura",
  bai: "Baixa",
  tra: "Transformação",
  out: "Outro",
};

function tituloDe(s) {
  /* O Atos manda o nome do tipo pronto (tipoNome). A tabela abaixo
     é a rede de segurança para quem mandar só o código — e para
     códigos que o Atos passe a usar depois deste script existir. */
  var tipo = String(s.tipoNome || "").trim() ||
             TIPOS[String(s.tipo || "")] || String(s.tipo || "Solicitação");
  var empresa = String(s.empresa || "").trim() || "sem empresa";
  var t = tipo + " — " + empresa;
  /* O Hub recusa título acima de 300; cortar aqui é melhor que
     tomar recusa e perder o aviso. */
  return t.length > 300 ? t.slice(0, 297) + "..." : t;
}

function descricaoDe(s) {
  var linhas = [];
  if (s.cnpj)    linhas.push("CNPJ: " + s.cnpj);
  if (s.contato) linhas.push("Contato: " + s.contato + (s.fone ? " (" + s.fone + ")" : ""));
  if (s.responsavel) linhas.push("Responsável no Atos: " + s.responsavel);
  if (s.obs)     linhas.push("");
  if (s.obs)     linhas.push(String(s.obs));
  var t = linhas.join("\n");
  return t.length > 2000 ? t.slice(0, 1997) + "..." : t;
}

/* O Hub guarda prazo como aaaa-mm-dd e recusa mais de 10 letras. */
function dataDe(v) {
  var t = String(v || "").slice(0, 10);
  return t.length === 10 ? t : "";
}

var LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function novoId() {
  var id = "";
  for (var i = 0; i < 20; i++) id += LETRAS.charAt(Math.floor(Math.random() * LETRAS.length));
  return id;
}

/* ---------- conferência ----------
   Roda à mão no editor do Apps Script, antes de ligar o Atos: diz
   se o robô entra e se o Hub responde, sem criar nada. */
function conferir() {
  var sessao = entrar();
  var r = chamar("/pendencias?pageSize=1", "get", null, sessao.token);
  Logger.log("entrou como " + sessao.uid + " · Hub respondeu " + r.codigo);
}
