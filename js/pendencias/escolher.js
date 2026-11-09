/* ============================================================
   Hub Totali · escolhe onde o quadro guarda os dados
   ------------------------------------------------------------
   Publica em window.Armazenamento o único ponto que a tela
   (app.js) usa para ler e gravar. O contrato que qualquer
   armazenamento cumpre:

     iniciar()                         → Promise
     usuario                           → { email, nome, uid }
     ouvirTarefas(cb, erro)            → cb(lista) agora e a cada mudança; devolve função para parar
     listarTarefas()                   → Promise<lista>
     criarTarefa(dados)                → Promise<id>
     alterarTarefa(id, campos)         → Promise   (mescla só os campos enviados)
     apagarTarefa(id)                  → Promise
     ouvirConfig(nome, cb, erro)       → nome = 'setores' | 'clientes'; cb(valor | null)
     lerConfig(nome) / salvarConfig(nome, valor) → Promise
     arquivos: { enviar(file)→{id,tam}, apagar(id), ler(id)→Blob, url(id)→string|null } ou null

   COM BANCO (CONFIG_HUB preenchido) → js/pendencias/armazenamento/firestore.js
   SEM BANCO (modo de teste)          → js/pendencias/armazenamento/local.js
   ============================================================ */
(function () {
  "use strict";
  var c = window.PENDENCIAS_CONFIG || {};
  var temBanco = typeof Dados !== "undefined" && Dados.temBanco();
  var modo = c.armazenamento || "auto";
  if (modo === "auto") modo = temBanco ? "hub" : "local";

  var op = { intervalo: c.intervaloAtualizacao || 60000 };
  var a;
  if (modo === "hub") {
    a = window.ArmazenamentoFirestore.criar(op);
  } else {
    /* No modo de teste cada pessoa que "entra" tem o seu quadro
       separado pelo e-mail que digitou, como no banco de verdade. */
    var s = (typeof Dados !== "undefined") ? Dados.sessao() : null;
    op.usuario = { email: (s && s.email) || "teste@local", nome: "", uid: (s && s.uid) || "local" };
    a = window.ArmazenamentoLocal.criar(op);
  }

  /* ---------- os setores da primeira vez ----------
     Saem dos setores da casa, que a administração mantém, e não de
     uma lista fixa: assim o quadro de quem entra hoje já fala a
     língua do escritório. As palavras-chave vêm da configuração. */
  function setoresIniciais() {
    var nomes = (typeof Dados !== "undefined" && Dados.SETORES_DA_CASA && Dados.SETORES_DA_CASA.length)
      ? Dados.SETORES_DA_CASA.slice() : ["Fiscal", "Contábil", "Pessoal", "Legalização", "Financeiro"];
    var cores = c.coresPorOrdem || ["violeta", "teal", "verde", "ocre", "rosa", "cinza"];
    var palavras = c.palavrasPorSetor || {};
    return nomes
      /* Gerência e Diretoria são alçadas, não frentes de trabalho:
         não viram coluna de pendência de ninguém por padrão. */
      .filter(function (n) { return n !== "Gerência" && n !== "Diretoria"; })
      .map(function (n, i) {
        return {
          id: n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || ("s" + i),
          nome: n,
          cor: cores[i % cores.length],
          palavras: (palavras[n] || []).slice(),
        };
      });
  }

  /* ---------- os clientes da casa, dentro do quadro ----------
     A lista da administração (Dados.clientesDaCasa) entra em todo
     quadro como se fosse dele, marcada com daCasa. O que a pessoa
     grava na própria configuração são só os clientes DELA e os
     apelidos que ela deu aos da casa — nome e CNPJ da casa não se
     gravam por pessoa, para a lista continuar uma só. */
  var ouvirConfigOriginal = a.ouvirConfig.bind(a);
  var lerConfigOriginal = a.lerConfig.bind(a);
  var salvarConfigOriginal = a.salvarConfig.bind(a);

  function daCasa() {
    return (typeof Dados !== "undefined" && Dados.clientesDaCasa) ? Dados.clientesDaCasa() : [];
  }

  /* O apelido que a casa já usa sem perceber: o nome sem o tipo
     societário e sem o CNPJ na frente. "BRAGAS BURGER LTDA" é
     "Bragas Burger" na boca de todo mundo, e é assim que a
     pendência vai ser escrita. Só entra quando sobra algo que
     ainda identifica a empresa. */
  var SUFIXOS = /\b(LTDA\.?|LIMITADA|S\/?A\.?|SOCIEDADE ANONIMA|EIRELI|ME|EPP|MEI|SS|SOCIEDADE SIMPLES|EMPRESA INDIVIDUAL( DE RESPONSABILIDADE LIMITADA)?|CIA\.?|COMPANHIA)\b/gi;
  function apelidoNatural(nome) {
    var n = String(nome || "").replace(/^[\d.\/-]+\s+/, "");   /* "52.814.703 MATEUS..." → "MATEUS..." */
    n = n.replace(SUFIXOS, " ").replace(/[-–—]+\s*$/, "").replace(/\s+/g, " ").trim();
    if (n.length < 5 || n.toUpperCase() === String(nome).toUpperCase()) return "";
    return n;
  }

  function mesclar(pessoal) {
    var minha = (pessoal && Array.isArray(pessoal.lista)) ? pessoal.lista : [];
    var porId = {}, porDoc = {};
    minha.forEach(function (c) { if (c && c.id) { porId[c.id] = c; if (c.cnpj) porDoc[String(c.cnpj).replace(/\D/g, "")] = c; } });
    var casa = daCasa();
    var idsDaCasa = {};
    var saida = casa.map(function (c) {
      idsDaCasa[c.id] = true;
      var meu = porId[c.id] || porDoc[c.cnpj];
      var x = { id: c.id, nome: c.nome, cnpj: c.cnpj, daCasa: true, apelidos: [] };
      if (c.regime) x.regime = c.regime;
      if (c.cidade) x.cidade = c.cidade;
      var natural = apelidoNatural(c.nome);
      if (natural) { x.apelidos.push(natural); x.apelidoNatural = natural; }
      if (meu) {
        if (Array.isArray(meu.apelidos)) {
          meu.apelidos.forEach(function (a) {
            if (a && !x.apelidos.some(function (b) { return b.toLowerCase() === String(a).toLowerCase(); })) x.apelidos.push(a);
          });
        }
        if (meu.cod) x.cod = meu.cod;
        idsDaCasa[meu.id] = true;   /* o meu com o mesmo CNPJ some: virou o da casa */
      }
      return x;
    });
    minha.forEach(function (c) {
      if (!c || !c.id || idsDaCasa[c.id]) return;
      var x = {};
      Object.keys(c).forEach(function (k) { if (k !== "daCasa") x[k] = c[k]; });
      saida.push(x);
    });
    return { lista: saida };
  }

  function desmesclar(valor) {
    var lista = (valor && Array.isArray(valor.lista)) ? valor.lista : [];
    return { lista: lista.filter(function (c) {
      if (!c) return false;
      if (!c.daCasa) return true;
      var proprios = (c.apelidos || []).filter(function (a) { return !c.apelidoNatural || String(a).toLowerCase() !== c.apelidoNatural.toLowerCase(); });
      return proprios.length > 0 || !!c.cod;
    }).map(function (c) {
      if (!c.daCasa) return c;
      var x = { id: c.id, nome: c.nome, cnpj: c.cnpj, daCasa: true,
                apelidos: (c.apelidos || []).filter(function (a) { return !c.apelidoNatural || String(a).toLowerCase() !== c.apelidoNatural.toLowerCase(); }) };
      if (c.cod) x.cod = c.cod;
      return x;
    }) };
  }

  a.ouvirConfig = function (nome, cb, erro) {
    if (nome !== "clientes") return ouvirConfigOriginal(nome, cb, erro);
    var ultimo = null;
    var parar = ouvirConfigOriginal(nome, function (v) { ultimo = v; cb(mesclar(v)); }, erro);
    function deNovo() { cb(mesclar(ultimo)); }
    window.addEventListener("hub:clientes", deNovo);
    return function () { window.removeEventListener("hub:clientes", deNovo); if (typeof parar === "function") parar(); };
  };
  a.lerConfig = function (nome) {
    var r = lerConfigOriginal(nome);
    return nome === "clientes" ? r.then(mesclar) : r;
  };
  a.salvarConfig = function (nome, valor) {
    return salvarConfigOriginal(nome, nome === "clientes" ? desmesclar(valor) : valor);
  };

  var iniciarOriginal = a.iniciar.bind(a);
  a.iniciar = function () {
    var casa = (typeof Dados !== "undefined" && Dados.carregarClientesDaCasa)
      ? Dados.carregarClientesDaCasa().catch(function () {}) : Promise.resolve();
    return Promise.all([iniciarOriginal(), casa]).then(function () {
      return a.lerConfig("setores");
    }).then(function (s) {
      if (!s || !Array.isArray(s.lista)) return a.salvarConfig("setores", { lista: setoresIniciais() });
    }).then(function () {
      window.dispatchEvent(new CustomEvent("pendencias:pronto", { detail: { modo: modo, usuario: a.usuario } }));
    });
  };
  a.modo = modo;
  window.Armazenamento = a;
})();
