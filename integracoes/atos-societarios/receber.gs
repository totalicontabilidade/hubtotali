/* ============================================================
   Hub Totali · recebedor do Atos Societários
   ------------------------------------------------------------
   Este arquivo NÃO roda no Hub. Ele é colado no Apps Script da
   conta Google da Totali e publicado como aplicativo da web — é
   ele que dá ao Hub um endereço capaz de receber aviso de fora,
   coisa que um site sem servidor não tem.

   O CAMINHO INTEIRO, em uma frase: o Atos avisa este endereço
   quando uma solicitação é criada, finalizada, excluída ou
   reaberta, e aqui esse aviso vira (ou risca) uma pendência no
   QUADRO de quem cuida da Legalização no Hub.

   O QUE MUDOU EM 09/11/2026: o Hub trocou o quadro do escritório
   por um quadro POR PESSOA (coleção quadros/{uid}/tarefas). A
   pendência da integração passou a nascer no quadro de uma pessoa
   escolhida — a propriedade DESTINO_UID abaixo —, assinada pelo
   robô. Quem recebe vê a pendência no bloco "Acompanhar" (ou "Com
   data", quando a solicitação tem prazo), com o pedido do cliente
   dentro, e cuida dela como de qualquer outra. Quando a
   solicitação termina no Atos, a pendência é riscada com um
   comentário dizendo isso.

   POR QUE O ATOS NÃO ESCREVE DIRETO NO HUB

   Porque o Atos vai ser vendido. Um produto que conhece o formato
   de pendência do Hub só serve para quem tem o Hub, e obrigaria
   cada comprador a guardar a senha de um sistema alheio dentro do
   navegador. Então o Atos manda um aviso genérico — "solicitação
   criada", com os campos dela — e quem traduz isso para o
   vocabulário do Hub é este arquivo, que é da Totali.

   O QUE PRECISA ESTAR CONFIGURADO (Arquivo → Propriedades do
   projeto → Propriedades do script), e por quê:

     SEGREDO      a senha combinada com o Atos. Sem ela, qualquer
                  um que descobrisse o endereço abriria pendência
                  no Hub.
     EMAIL        conta do robô no Hub (ex.: atos@...)
     SENHA        senha desse robô
     PROJETO      hubtotali
     CHAVE        a apiKey do Hub (é pública, como no site)
     DESTINO_UID  o uid da pessoa em cujo quadro a pendência nasce
                  (console do Firebase → Authentication → Users →
                  "UID do usuário" da pessoa da Legalização)
     SETOR_ID     opcional: o id do setor no quadro dela, para a
                  pendência já nascer colorida (ex.: "legalizacao").
                  Sem ele, nasce "Sem setor".

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
    if (!prop("DESTINO_UID", "")) return responder({ ok: false, erro: "falta a propriedade DESTINO_UID (o quadro de destino)" });

    if (evento === "solicitacao.criada")     return responder(criarPendencia(s));
    if (evento === "solicitacao.finalizada") return responder(riscarPendencia(s, "Finalizada no Atos Societários."));
    /* Solicitação apagada no Atos: a pendência não pode ficar aberta
       para sempre. Risca com a anotação do motivo — apagar de verdade
       é decisão do dono do quadro. */
    if (evento === "solicitacao.excluida")   return responder(riscarPendencia(s, "A solicitação foi excluída no Atos Societários."));
    if (evento === "solicitacao.reaberta")   return responder(reabrirPendencia(s));

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
  return responder({ ok: true, servico: "recebedor do Atos no Hub (quadros)" });
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

function colecao() {
  return "/quadros/" + encodeURIComponent(prop("DESTINO_UID", "")) + "/tarefas";
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

/* ---------- de e para o formato do Firestore ----------
   O quadro grava campo a campo, com listas de mapas (os
   comentários) e números (as horas). */
function paraValor(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return (v % 1 === 0) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(paraValor) } };
  if (typeof v === "object") return { mapValue: { fields: paraCampos(v) } };
  return { stringValue: String(v) };
}
function paraCampos(obj) {
  var f = {};
  Object.keys(obj).forEach(function (k) { if (obj[k] !== undefined) f[k] = paraValor(obj[k]); });
  return f;
}
function deValor(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return parseInt(v.integerValue, 10);
  if ("doubleValue" in v) return v.doubleValue;
  if ("arrayValue" in v) return ((v.arrayValue && v.arrayValue.values) || []).map(deValor);
  if ("mapValue" in v) return deCampos((v.mapValue && v.mapValue.fields) || {});
  return null;
}
function deCampos(fields) {
  var o = {};
  Object.keys(fields || {}).forEach(function (k) { o[k] = deValor(fields[k]); });
  return o;
}

/* ---------- achar o que já veio ----------
   O Atos pode repetir o aviso: rede que cai no meio, pessoa que
   salva duas vezes, reenvio automático. Sem esta consulta, cada
   repetição viraria uma pendência nova. */
function acharPorOrigem(id, token, uidRobo) {
  /* O filtro por criadoPorUid não é enfeite: a regra do banco só
     deixa o robô ler o que ELE criou no quadro alheio, e uma
     consulta sem esse filtro é recusada inteira. */
  var r = UrlFetchApp.fetch(base() + "/quadros/" + encodeURIComponent(prop("DESTINO_UID", "")) + ":runQuery", {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "tarefas" }],
        where: { compositeFilter: { op: "AND", filters: [
          { fieldFilter: { field: { fieldPath: "criadoPorUid" }, op: "EQUAL", value: { stringValue: String(uidRobo) } } },
          { fieldFilter: { field: { fieldPath: "origemId" }, op: "EQUAL", value: { stringValue: String(id) } } },
        ] } },
        limit: 1,
      },
    }),
  });
  if (r.getResponseCode() >= 300) throw new Error("não consegui consultar o quadro (HTTP " + r.getResponseCode() + "): " + r.getContentText());
  var j = JSON.parse(r.getContentText() || "[]");
  for (var i = 0; i < j.length; i++) {
    if (j[i].document) {
      return {
        id: String(j[i].document.name).split("/").pop(),
        dados: deCampos(j[i].document.fields || {}),
      };
    }
  }
  return null;
}

/* ---------- criar ---------- */

function criarPendencia(s) {
  var sessao = entrar();

  var jaTem = acharPorOrigem(s.id, sessao.token, sessao.uid);
  if (jaTem) return { ok: true, repetido: true, pendencia: jaTem.id };

  var agora = Date.now();
  var prazo = dataDe(s.prazo);
  var texto = textoDe(s);
  var doc = {
    html: htmlDe(texto),
    texto: texto,
    setor: prop("SETOR_ID", ""),
    /* Com prazo vai para "Com data"; sem prazo, para "Acompanhar" —
       é uma solicitação que anda por dias, não tarefa de hoje. */
    status: prazo ? "data" : "acompanhar",
    prazo: prazo || null,
    importante: false,
    feito: false, feitoEm: null,
    criadoEm: agora, statusEm: agora,
    grifadoEm: null, revisadoEm: null,
    notas: [{ t: "Aberta pelo Atos Societários a partir da solicitação de " + (s.empresa || "cliente") + ".", em: agora }],
    anexos: [],
    criadoPor: prop("EMAIL", ""),
    /* Quem criou, para a regra do banco: um colega (o robô é um)
       pode criar no quadro de alguém, assinando. */
    criadoPorUid: sessao.uid,
    origemSistema: "atos",
    origemId: String(s.id),
  };

  var id = novoId();
  var r = chamar(colecao() + "?documentId=" + id, "post", { fields: paraCampos(doc) }, sessao.token);
  if (r.codigo >= 300) return { ok: false, erro: "o Hub recusou (HTTP " + r.codigo + "): " + r.texto };
  return { ok: true, pendencia: id };
}

/* ---------- riscar e reabrir ----------
   Quem criou no quadro alheio só pode mexer em feito, feitoEm,
   revisadoEm e notas — é exatamente o que estas duas fazem. */
function riscarPendencia(s, nota) {
  var sessao = entrar();
  var achada = acharPorOrigem(s.id, sessao.token, sessao.uid);
  if (!achada) return { ok: true, semPendencia: true };
  if (achada.dados.feito === true) return { ok: true, jaEstavaRiscada: true };

  var agora = Date.now();
  var notas = (achada.dados.notas || []).concat([{ t: nota || "Finalizada no Atos Societários.", em: agora }]);
  var r = chamar(colecao() + "/" + achada.id +
                 "?updateMask.fieldPaths=feito&updateMask.fieldPaths=feitoEm&updateMask.fieldPaths=revisadoEm&updateMask.fieldPaths=notas",
                 "patch", { fields: paraCampos({ feito: true, feitoEm: agora, revisadoEm: null, notas: notas }) }, sessao.token);
  if (r.codigo >= 300) return { ok: false, erro: "o Hub recusou (HTTP " + r.codigo + "): " + r.texto };
  return { ok: true, pendencia: achada.id };
}

function reabrirPendencia(s) {
  var sessao = entrar();
  var achada = acharPorOrigem(s.id, sessao.token, sessao.uid);
  if (!achada) return { ok: true, semPendencia: true };
  if (achada.dados.feito !== true) return { ok: true, jaEstavaAberta: true };

  var agora = Date.now();
  var notas = (achada.dados.notas || []).concat([{ t: "Reaberta no Atos Societários.", em: agora }]);
  var r = chamar(colecao() + "/" + achada.id +
                 "?updateMask.fieldPaths=feito&updateMask.fieldPaths=feitoEm&updateMask.fieldPaths=notas",
                 "patch", { fields: paraCampos({ feito: false, feitoEm: null, notas: notas }) }, sessao.token);
  if (r.codigo >= 300) return { ok: false, erro: "o Hub recusou (HTTP " + r.codigo + "): " + r.texto };
  return { ok: true, pendencia: achada.id };
}

/* ---------- traduções ---------- */

var TIPOS = {
  alt: "Alteração contratual",
  abe: "Abertura",
  bai: "Baixa",
  tra: "Transformação",
  out: "Outro",
};

function textoDe(s) {
  var tipo = String(s.tipoNome || "").trim() ||
             TIPOS[String(s.tipo || "")] || String(s.tipo || "Solicitação");
  var empresa = String(s.empresa || "").trim() || "sem empresa";
  var linhas = [tipo + " — " + empresa];
  if (s.pedido)      linhas.push("Pedido: " + s.pedido);
  if (s.cnpj)        linhas.push("CNPJ: " + s.cnpj);
  if (s.contato)     linhas.push("Contato: " + s.contato + (s.fone ? " (" + s.fone + ")" : ""));
  if (s.responsavel) linhas.push("Responsável no Atos: " + s.responsavel);
  if (s.obs)         linhas.push(String(s.obs));
  var t = linhas.join("\n");
  /* O quadro aceita até 6000; cortar aqui é melhor que tomar recusa. */
  return t.length > 2500 ? t.slice(0, 2497) + "..." : t;
}

/* O quadro guarda o texto também em HTML simples: a primeira linha
   em negrito, as demais com quebra de linha. Nada além de b e br. */
function htmlDe(texto) {
  var esc = function (x) { return String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  var linhas = texto.split("\n");
  return "<b>" + esc(linhas[0]) + "</b>" + linhas.slice(1).map(function (l) { return "<br>" + esc(l); }).join("");
}

/* O quadro guarda prazo como aaaa-mm-dd. */
function dataDe(v) {
  var t = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : "";
}

var LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function novoId() {
  var id = "";
  for (var i = 0; i < 20; i++) id += LETRAS.charAt(Math.floor(Math.random() * LETRAS.length));
  return id;
}

/* ---------- conferência ----------
   Roda à mão no editor do Apps Script, antes de ligar o Atos: diz
   se o robô entra e se o quadro de destino responde, sem criar nada. */
function conferir() {
  var sessao = entrar();
  var r = chamar(colecao() + "?pageSize=1", "get", null, sessao.token);
  Logger.log("entrou como " + sessao.uid + " · quadro " + prop("DESTINO_UID", "(sem DESTINO_UID)") + " respondeu " + r.codigo +
             (r.codigo === 403 ? " — o robô só CRIA no quadro alheio; 403 ao LISTAR é o esperado. Teste criando pelo Atos." : ""));
}
