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

  var iniciarOriginal = a.iniciar.bind(a);
  a.iniciar = function () {
    return iniciarOriginal().then(function () {
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
