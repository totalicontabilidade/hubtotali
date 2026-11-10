/* ============================================================
   Recados — a aba Recados e o cartão que aparece ao abrir o Hub
   ------------------------------------------------------------
   Os recados da casa saíram da faixa de baixo (o letreiro) e
   ganharam uma vista própria, com quem escreveu, quando, e a
   marca de lido de cada pessoa.

   O CARTÃO AO ABRIR. Quando há recado que a pessoa ainda não
   leu, ele aparece na frente da tela assim que o Hub abre — uma
   vez por recado, não toda vez. "Entendi" marca como lido e o
   recado não volta; "Ler depois" guarda só para esta aba do
   navegador. É o modelo de recibo de leitura: quem escreveu vê,
   na aba, quem já leu. A pesquisa é dura com janela que aparece
   sozinha — e tem razão quando ela aparece todo dia pelo mesmo
   motivo. Aqui ela aparece só com novidade, e some de vez com um
   clique, que é o que faz a diferença.

   Os dados: a lista fica em hub/avisos (Dados.salvarAvisos), com
   id, tipo, título, texto, quem e quando. O que cada pessoa leu
   fica em quadros/{uid}/config/recados (Dados.marcarRecadosLidos).
   ============================================================ */

const Recados = (function () {
  "use strict";

  var LISTA = [];            /* mais novo primeiro */
  var LIDOS = {};            /* { id: quando } — os meus */
  var LIDOS_PRONTO = false;
  var PODE = false;          /* posso escrever e apagar */
  var EQUIPE = [];
  var LIDOS_EQUIPE = null;   /* { uid: { id: quando } } */
  var LIDOS_EQUIPE_EM = 0;
  var JA_NO_CARTAO = {};     /* ids que o cartão já mostrou nesta aba */
  var CHAVE_ADIADOS = "hub-totali:recados-adiados";
  var ARMADO = null;         /* id com o "Apagar?" aceso */

  var TIPOS = { prazo: "Prazo", aviso: "Aviso", ok: "Tudo certo" };

  function el(t, c, x) {
    var e = document.createElement(t);
    if (c) e.className = c;
    if (x !== undefined && x !== null) e.textContent = x;
    return e;
  }

  function haQuanto(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return "";
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 2) return "agora";
    if (m < 60) return "há " + m + " min";
    var h = Math.round(m / 60);
    if (h < 24) return "há " + h + " h";
    var d = Math.round(h / 24);
    if (d === 1) return "ontem";
    if (d < 7) return "há " + d + " dias";
    return "em " + new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  function sessao() { return (typeof Dados !== "undefined" && Dados.sessao && Dados.sessao()) || null; }
  function meuUid() { var s = sessao(); return (s && s.uid) || "local"; }
  function pessoa(uid) { return EQUIPE.filter(function (p) { return p.uid === uid; })[0] || null; }
  function meuNome() {
    var p = pessoa(meuUid()); if (p && p.nome) return p.nome;
    var s = sessao(); return (s && s.email) ? s.email.split("@")[0] : "eu";
  }
  function primeiroNome(nome) { return String(nome || "").trim().split(/\s+/)[0] || ""; }

  function adiados() {
    try { return JSON.parse(window.sessionStorage.getItem(CHAVE_ADIADOS) || "{}") || {}; } catch (e) { return {}; }
  }
  function adiar(ids) {
    var a = adiados(); ids.forEach(function (id) { a[id] = 1; });
    try { window.sessionStorage.setItem(CHAVE_ADIADOS, JSON.stringify(a)); } catch (e) {}
  }

  /* ---------- a lista ---------- */
  function normalizar(lista) {
    return (lista || []).map(function (a) {
      return Object.assign({}, a, { id: Dados.idDoRecado(a), tipo: TIPOS[a.tipo] ? a.tipo : "aviso" });
    }).sort(function (a, b) {
      /* Com data, mais novo primeiro; sem data (recado antigo), a ordem em que estavam. */
      return (Date.parse(b.em || 0) || 0) - (Date.parse(a.em || 0) || 0);
    });
  }

  function naoLidos() { return LISTA.filter(function (a) { return !LIDOS[a.id]; }); }

  function receber(lista) {
    var antes = JSON.stringify(LISTA);
    LISTA = normalizar(lista);
    if (JSON.stringify(LISTA) === antes && LIDOS_PRONTO) { desenharSelo(); return; }
    desenharSelo();
    if (vistaAberta()) desenharVista();
    talvezCartao();
  }

  function vistaAberta() {
    var sec = document.getElementById("vista-recados");
    return !!sec && !sec.hidden;
  }

  /* ---------- o selo na barra ---------- */
  function desenharSelo() {
    var botao = document.getElementById("nav-recados");
    if (!botao) return;
    var n = LIDOS_PRONTO ? naoLidos().length : 0;
    var selo = botao.querySelector(".nav__selo");
    if (!n) { if (selo) selo.remove(); botao.title = "Recados"; return; }
    if (!selo) { selo = el("span", "nav__selo"); botao.appendChild(selo); }
    selo.textContent = n > 99 ? "99+" : String(n);
    botao.title = "Recados — " + n + " ainda não lido" + (n > 1 ? "s" : "");
  }

  /* ---------- o cartão ao abrir ---------- */
  function talvezCartao() {
    if (!LIDOS_PRONTO) return;
    if (vistaAberta()) return;
    var ad = adiados();
    var novos = naoLidos().filter(function (a) { return !JA_NO_CARTAO[a.id] && !ad[a.id]; });
    if (!novos.length) return;
    var dlg = document.getElementById("recados-janela");
    if (!dlg || typeof dlg.showModal !== "function" || dlg.open) return;
    /* Alguém no meio de um campo não ganha janela na cara. */
    var a = document.activeElement;
    if (a && a !== document.body && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    abrirCartao(dlg, novos);
  }

  function abrirCartao(dlg, novos) {
    var lista = document.getElementById("rj-lista");
    lista.textContent = "";
    novos.forEach(function (a) {
      JA_NO_CARTAO[a.id] = true;
      lista.appendChild(itemDoCartao(a));
    });
    var t = document.getElementById("rj-titulo");
    if (t) t.textContent = novos.length === 1 ? "Recado novo" : novos.length + " recados novos";
    var ids = novos.map(function (a) { return a.id; });

    var ok = document.getElementById("rj-ok"), depois = document.getElementById("rj-depois");
    ok.onclick = function () { marcarLidos(ids); dlg.close(); };
    depois.onclick = function () { adiar(ids); dlg.close(); };
    dlg.oncancel = function (e) { e.preventDefault(); adiar(ids); dlg.close(); };
    dlg.showModal();
    ok.focus();
  }

  function itemDoCartao(a) {
    var x = el("article", "rj__item rj__item--" + a.tipo);
    var cab = el("div", "rj__meta");
    cab.appendChild(el("span", "rc__tipo rc__tipo--" + a.tipo, TIPOS[a.tipo]));
    if (a.por) cab.appendChild(el("span", null, "de " + primeiroNome(a.por)));
    if (a.em) cab.appendChild(el("span", null, "· " + haQuanto(a.em)));
    x.appendChild(cab);
    if (a.titulo) x.appendChild(el("h3", "rj__t", a.titulo));
    if (a.texto) x.appendChild(el("p", "rj__x", a.texto));
    return x;
  }

  /* ---------- lido ---------- */
  function marcarLidos(ids) {
    ids = ids.filter(function (id) { return !LIDOS[id]; });
    if (!ids.length) return Promise.resolve();
    /* Marca na tela antes do banco responder: ninguém espera para ver o número cair. */
    var agora = new Date().toISOString();
    ids.forEach(function (id) { LIDOS[id] = agora; });
    desenharSelo(); if (vistaAberta()) desenharVista();
    return Dados.marcarRecadosLidos(ids, LIDOS).then(function (l) { LIDOS = l; desenharSelo(); })
      .catch(function (e) { aviso(e.message || "Não consegui marcar como lido."); });
  }

  function aviso(texto) {
    var t = document.getElementById("toast");
    if (!t) { window.alert(texto); return; }
    t.textContent = texto; t.hidden = false;
    window.clearTimeout(aviso.tm);
    aviso.tm = window.setTimeout(function () { t.hidden = true; }, 3500);
  }

  /* ---------- a vista ---------- */
  function desenharVista() {
    var box = document.getElementById("recados-vista");
    if (!box) return;
    box.textContent = "";

    var cab = el("header", "rc__cab");
    var esq = el("div");
    esq.appendChild(el("h2", "rc__t", "Recados"));
    var n = naoLidos().length;
    esq.appendChild(el("p", "rc__sub", LISTA.length
      ? (LISTA.length + " recado" + (LISTA.length > 1 ? "s" : "") + (n ? " · " + n + " ainda não lido" + (n > 1 ? "s" : "") : " · tudo lido"))
      : "Nenhum recado por enquanto."));
    cab.appendChild(esq);
    if (n) {
      var todos = el("button", "rc__btn rc__btn--sec", "Marcar todos como lidos");
      todos.type = "button";
      todos.addEventListener("click", function () { marcarLidos(naoLidos().map(function (a) { return a.id; })); });
      cab.appendChild(todos);
    }
    box.appendChild(cab);

    if (PODE) box.appendChild(formulario());

    if (!LISTA.length) {
      box.appendChild(el("div", "rc__vazio", PODE
        ? "Escreva o primeiro recado acima. Ele aparece para a equipe inteira ao abrir o Hub."
        : "Quando a administração ou a gerência escrever um recado, ele aparece aqui e na frente da tela ao abrir o Hub."));
      return;
    }

    var lista = el("div", "rc__lista");
    LISTA.forEach(function (a) { lista.appendChild(item(a)); });
    box.appendChild(lista);

    box.appendChild(el("p", "rc__nota",
      "Recado é para a equipe inteira. Pendência para uma pessoa vai pelo quadro, em “Para quem”."));
  }

  function formulario() {
    var f = el("form", "rc__form");
    f.setAttribute("aria-label", "Novo recado");
    var linha = el("div", "rc__form-linha");
    var tipo = document.createElement("select");
    tipo.className = "rc__sel"; tipo.setAttribute("aria-label", "Tipo");
    Object.keys(TIPOS).forEach(function (k) { var o = document.createElement("option"); o.value = k; o.textContent = TIPOS[k]; tipo.appendChild(o); });
    var titulo = document.createElement("input");
    titulo.className = "rc__in"; titulo.type = "text"; titulo.maxLength = 120; titulo.placeholder = "Título do recado"; titulo.setAttribute("aria-label", "Título");
    linha.appendChild(tipo); linha.appendChild(titulo);
    f.appendChild(linha);
    var texto = document.createElement("textarea");
    texto.className = "rc__ta"; texto.rows = 2; texto.maxLength = 600; texto.placeholder = "O recado (opcional). Ctrl+Enter publica."; texto.setAttribute("aria-label", "Texto");
    f.appendChild(texto);
    var pe = el("div", "rc__form-pe");
    pe.appendChild(el("span", "rc__dica", "Aparece para todos ao abrir o Hub, até cada um marcar como lido."));
    var btn = el("button", "rc__btn", "Publicar para a equipe");
    btn.type = "submit";
    pe.appendChild(btn);
    f.appendChild(pe);

    function publicar() {
      var t = titulo.value.trim(), x = texto.value.trim();
      if (!t && !x) { titulo.focus(); return; }
      if (!t) { t = x.length > 60 ? x.slice(0, 57) + "…" : x; if (t === x) x = ""; }
      btn.disabled = true; btn.textContent = "Publicando…";
      var novo = {
        id: "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        tipo: tipo.value, titulo: t, texto: x,
        em: new Date().toISOString(), por: meuNome(), porUid: meuUid(),
      };
      var s = sessao();
      Dados.salvarAvisos([novo].concat(LISTA), s && s.email).then(function (l) {
        /* Quem escreveu já leu. */
        LIDOS[novo.id] = novo.em; JA_NO_CARTAO[novo.id] = true;
        Dados.marcarRecadosLidos([novo.id], LIDOS).then(function (x) { LIDOS = x; }).catch(function () {});
        receber(Array.isArray(l) ? l : [novo].concat(LISTA));
        desenharVista();
        aviso("Recado publicado para a equipe.");
      }).catch(function (e) {
        btn.disabled = false; btn.textContent = "Publicar para a equipe";
        aviso(e.message || "Não consegui publicar.");
      });
    }
    f.addEventListener("submit", function (e) { e.preventDefault(); publicar(); });
    texto.addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); publicar(); } });
    return f;
  }

  function item(a) {
    var lido = !!LIDOS[a.id];
    var x = el("article", "rc__item rc__item--" + a.tipo + (lido ? "" : " rc__item--novo"));
    x.setAttribute("data-id", a.id);

    var meta = el("div", "rc__meta");
    meta.appendChild(el("span", "rc__tipo rc__tipo--" + a.tipo, TIPOS[a.tipo]));
    if (!lido) meta.appendChild(el("span", "rc__novo", "novo"));
    meta.appendChild(el("span", "rc__quem", (a.por ? "de " + a.por : "da administração") + (a.em ? " · " + haQuanto(a.em) : "")));
    var esp = el("span", "rc__esp"); meta.appendChild(esp);

    var leram = quemLeu(a.id);
    if (leram) meta.appendChild(leram);

    if (PODE) {
      var ap = el("button", "rc__ic", null);
      ap.type = "button"; ap.title = "Apagar o recado"; ap.setAttribute("aria-label", "Apagar o recado");
      ap.textContent = ARMADO === a.id ? "Apagar?" : "×";
      if (ARMADO === a.id) ap.classList.add("rc__ic--conf");
      ap.addEventListener("click", function () {
        if (ARMADO !== a.id) {
          ARMADO = a.id; desenharVista();
          window.clearTimeout(item.tm);
          item.tm = window.setTimeout(function () { if (ARMADO === a.id) { ARMADO = null; desenharVista(); } }, 3500);
          return;
        }
        ARMADO = null;
        var s = sessao();
        Dados.salvarAvisos(LISTA.filter(function (b) { return b.id !== a.id; }), s && s.email)
          .then(function (l) { receber(Array.isArray(l) ? l : LISTA.filter(function (b) { return b.id !== a.id; })); desenharVista(); })
          .catch(function (e) { aviso(e.message || "Não consegui apagar."); desenharVista(); });
      });
      meta.appendChild(ap);
    }
    x.appendChild(meta);
    if (a.titulo) x.appendChild(el("h3", "rc__it", a.titulo));
    if (a.texto) x.appendChild(el("p", "rc__ix", a.texto));

    if (!lido) {
      var b = el("button", "rc__btn rc__btn--sec rc__btn--mini", "Marcar como lido");
      b.type = "button";
      b.addEventListener("click", function () { marcarLidos([a.id]); });
      x.appendChild(b);
    }
    return x;
  }

  /* "Lido por 4 de 8", com os nomes na dica. Conta quem está ativo
     e não é robô; quem escreveu entra como lido. */
  function quemLeu(id) {
    if (!LIDOS_EQUIPE || !EQUIPE.length) return null;
    var gente = EQUIPE.filter(function (p) { return p.ativo !== false && !p.robo && p.uid !== "local"; });
    if (!gente.length) {
      /* modo de teste: só eu */
      var meuL = LIDOS_EQUIPE.local || LIDOS;
      return el("span", "rc__leu", meuL[id] ? "lido por você" : "ninguém leu");
    }
    var leram = gente.filter(function (p) { var l = LIDOS_EQUIPE[p.uid]; return l && l[id]; });
    var s = el("span", "rc__leu", "lido por " + leram.length + " de " + gente.length);
    s.title = leram.length ? leram.map(function (p) { return primeiroNome(p.nome); }).join(", ")
                           : "Ninguém marcou como lido ainda";
    return s;
  }

  function carregarLidosDaEquipe() {
    if (Date.now() - LIDOS_EQUIPE_EM < 60000) return;
    LIDOS_EQUIPE_EM = Date.now();
    var uids = EQUIPE.filter(function (p) { return p.ativo !== false; }).map(function (p) { return p.uid; });
    Dados.lerLidosDaEquipe(uids).then(function (m) {
      LIDOS_EQUIPE = m || {};
      if (vistaAberta()) desenharVista();
    }).catch(function () {});
  }

  /* ---------- entrada ---------- */
  function iniciar() {
    if (typeof Dados === "undefined") return;
    Dados.possoAvisar().then(function (p) { PODE = !!p; if (vistaAberta()) desenharVista(); });
    Dados.listarEquipe().then(function (e) { EQUIPE = e || []; if (vistaAberta()) desenharVista(); }).catch(function () {});
    Dados.lerRecadosLidos().then(function (l) {
      LIDOS = l || {}; LIDOS_PRONTO = true;
      desenharSelo();
      if (vistaAberta()) desenharVista();
      /* Um instante depois da primeira pintura: a tela aparece, e então o cartão. */
      window.setTimeout(talvezCartao, 600);
    });
    /* Relógio das horas ("há 5 min") e dos recados novos de colegas. */
    window.setInterval(function () {
      if (document.hidden) return;
      if (vistaAberta()) { desenharVista(); carregarLidosDaEquipe(); }
    }, 60000);
  }

  function aoAbrirTela() {
    desenharVista();
    if (EQUIPE.length) carregarLidosDaEquipe();
    else Dados.listarEquipe().then(function (e) { EQUIPE = e || []; carregarLidosDaEquipe(); }).catch(function () {});
  }

  return {
    receber: receber,
    iniciar: iniciar,
    aoAbrirTela: aoAbrirTela,
    naoLidos: function () { return naoLidos().length; },
  };
})();
