/* ============================================================
   Rodada 2 dos modelos — descartável, sai depois da escolha.

   As pendências abaixo são inventadas, só para o desenho ter
   conteúdo realista: prazo vencido, prazo de hoje e prazo
   folgado, que são os três estados que a tela precisa saber
   mostrar. Nada disso vira dado do sistema.
   ============================================================ */

(function () {
  "use strict";

  var LOGOS_IDX = (typeof LOGOS !== "undefined") ? LOGOS : {};

  var MODELOS = [
    { id: "M1", nome: "Bento vidro" },
    { id: "M2", nome: "Centro de comando" },
    { id: "M3", nome: "Lançador bento" },
    { id: "M4", nome: "Sóbrio" },
  ];

  var PENDENCIAS = [
    { dia: "28", mes: "ago", oque: "Enviar balancete da Gigantte",       quem: "Fiscal → Contábil",  estado: "atrasada" },
    { dia: "01", mes: "set", oque: "Conferir rescisão do J C de Lira",   quem: "Pessoal → Você",     estado: "hoje" },
    { dia: "01", mes: "set", oque: "Retificar SPED da Braz",             quem: "Você → Fiscal",      estado: "hoje" },
    { dia: "04", mes: "set", oque: "Documentos da abertura da Domum",    quem: "Legalização → Você", estado: "tranquila" },
    { dia: "09", mes: "set", oque: "Fechar cartões da Varejista",        quem: "Você → Contábil",    estado: "tranquila" },
  ];

  function apelido(n) {
    return String(n).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function sigla(item) {
    if (item.sigla) return item.sigla;
    var p = String(item.nome).split(/[\s·/-]+/).filter(function (x) {
      return x && ["de","do","da","dos","das","e"].indexOf(x.toLowerCase()) === -1;
    });
    if (p.length > 1) return (p[0][0] + p[1][0]).toUpperCase();
    var u = p[0] || "?";
    var i = u.slice(1).match(/[A-Z]/);
    if (/[a-z]/.test(u) && i) return (u[0] + i[0]).toUpperCase();
    return u.slice(0, 2).toUpperCase();
  }

  function el(t, c, x) {
    var e = document.createElement(t);
    if (c) e.className = c;
    if (x != null) e.textContent = x;
    return e;
  }

  function icone(item) {
    var arq = item.logo || LOGOS_IDX[apelido(item.nome)];
    var caixa = el("span", "icone");
    if (arq) {
      var img = document.createElement("img");
      img.src = "assets/logos/" + arq;
      img.alt = "";
      img.addEventListener("error", function () {
        caixa.classList.add("icone--sigla");
        caixa.textContent = sigla(item);
      });
      caixa.appendChild(img);
    } else {
      caixa.classList.add("icone--sigla");
      caixa.textContent = sigla(item);
    }
    return caixa;
  }

  var cartoes = SETORES.filter(function (s) { return s.estilo !== "gaveta"; });
  var gavetas = SETORES.filter(function (s) { return s.estilo === "gaveta"; });

  function apps(itens, comNota) {
    var c = el("div", "apps");
    itens.forEach(function (item) {
      var a = document.createElement("a");
      a.className = "app";
      a.href = item.url || "#";
      if (item.url) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      a.appendChild(icone(item));
      if (comNota === "so-nome") {
        a.appendChild(el("span", "app__nome", item.nome));
      } else {
        var t = el("div", "app__texto");
        t.appendChild(el("div", "app__nome", item.nome));
        if (item.nota && comNota !== false) t.appendChild(el("div", "app__nota", item.nota));
        a.appendChild(t);
      }
      c.appendChild(a);
    });
    return c;
  }

  function titulo(texto, conta) {
    var t = el("div", "titulo", texto);
    if (conta != null) t.appendChild(el("span", "titulo__conta", String(conta)));
    return t;
  }

  function listaPendencias(quantas) {
    var c = document.createDocumentFragment();
    PENDENCIAS.slice(0, quantas || PENDENCIAS.length).forEach(function (p) {
      var d = el("div", "pend pend--" + p.estado);
      d.appendChild(el("span", "pend__marca"));
      var prazo = el("div", "pend__prazo");
      prazo.appendChild(el("div", "pend__dia", p.dia));
      prazo.appendChild(el("div", "pend__mes", p.mes));
      d.appendChild(prazo);
      var txt = el("div");
      txt.appendChild(el("div", "pend__oque", p.oque));
      txt.appendChild(el("div", "pend__quem", p.quem));
      d.appendChild(txt);
      c.appendChild(d);
    });
    return c;
  }

  function listaGavetas() {
    var c = document.createDocumentFragment();
    gavetas.forEach(function (s) {
      var g = el("div", "gav");
      g.appendChild(document.createTextNode(s.titulo));
      g.appendChild(el("span", "gav__conta", String(s.itens.length)));
      c.appendChild(g);
    });
    return c;
  }

  function topo() {
    var t = el("div", "topo");
    var logo = document.createElement("img");
    logo.className = "topo__logo";
    logo.src = "assets/logo-hub-escuro.png";
    logo.alt = "Hub Totali";
    t.appendChild(logo);

    var ola = el("div", "ola");
    ola.appendChild(document.createTextNode("Boa tarde, "));
    ola.appendChild(el("b", null, "Hesley"));
    ola.appendChild(document.createTextNode(" — 2 pendências para hoje"));
    t.appendChild(ola);

    var dir = el("div", "topo__dir");
    var d = new Date();
    dir.appendChild(el("div", "topo__hora",
      ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2)));
    var data = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    dir.appendChild(el("div", "topo__data", data.charAt(0).toUpperCase() + data.slice(1)));
    t.appendChild(dir);
    return t;
  }

  function recados() {
    var c = document.createDocumentFragment();
    (typeof AVISOS !== "undefined" ? AVISOS : []).forEach(function (a) {
      var p = el("div", "pend pend--tranquila");
      p.appendChild(el("span", "pend__marca"));
      var t = el("div");
      t.appendChild(el("div", "pend__oque", a.titulo));
      t.appendChild(el("div", "pend__quem", a.texto || ""));
      p.appendChild(t);
      c.appendChild(p);
    });
    return c;
  }

  /* ---------- M1 · Bento vidro ---------- */
  function m1() {
    var r = el("div", "modelo"); r.id = "M1";
    r.appendChild(topo());
    var b = el("div", "bento");

    var bp = el("div", "bloco b-pend");
    bp.appendChild(titulo("Minhas pendências", PENDENCIAS.length));
    bp.appendChild(listaPendencias());
    b.appendChild(bp);

    var classes = ["b-princ", "b-nossos", "b-dia"];
    cartoes.forEach(function (s, i) {
      var bl = el("div", "bloco " + (classes[i] || "b-dia"));
      bl.appendChild(titulo(s.titulo));
      bl.appendChild(apps(s.itens, i === 2 ? true : false));
      b.appendChild(bl);
    });

    var bo = el("div", "bloco b-org");
    bo.appendChild(titulo("Órgãos e consultas"));
    bo.appendChild(listaGavetas());
    b.appendChild(bo);

    var br = el("div", "bloco b-rec");
    br.appendChild(titulo("Recados e prazos"));
    br.appendChild(recados());
    b.appendChild(br);

    r.appendChild(b);
    return r;
  }

  /* ---------- M2 · Centro de comando ---------- */
  function m2() {
    var r = el("div", "modelo"); r.id = "M2";
    r.appendChild(topo());

    var placar = el("div", "placar");
    [["1", "pendência atrasada", "card--alerta"],
     ["2", "para hoje", ""],
     ["5", "abertas com você", ""],
     ["37", "sistemas no Hub", "card--ok"]].forEach(function (c) {
      var k = el("div", "card " + c[2]);
      k.appendChild(el("div", "card__n", c[0]));
      k.appendChild(el("div", "card__r", c[1]));
      placar.appendChild(k);
    });
    r.appendChild(placar);

    var col = el("div", "colunas");
    var esq = el("div");
    cartoes.forEach(function (s) {
      var p = el("div", "painel");
      p.appendChild(titulo(s.titulo));
      p.appendChild(apps(s.itens, false));
      esq.appendChild(p);
    });
    var po = el("div", "painel");
    po.appendChild(titulo("Órgãos e consultas"));
    po.appendChild(listaGavetas());
    esq.appendChild(po);
    col.appendChild(esq);

    var dir = el("div");
    var pp = el("div", "painel");
    pp.appendChild(titulo("Minhas pendências", PENDENCIAS.length));
    pp.appendChild(listaPendencias());
    dir.appendChild(pp);
    var pr = el("div", "painel");
    pr.appendChild(titulo("Recados"));
    pr.appendChild(recados());
    dir.appendChild(pr);
    col.appendChild(dir);

    r.appendChild(col);
    return r;
  }

  /* ---------- M3 · Lançador bento ---------- */
  function m3() {
    var r = el("div", "modelo"); r.id = "M3";
    r.appendChild(topo());

    var col = el("div", "colunas");
    var esq = el("div");
    cartoes.forEach(function (s) {
      var b = el("div", "bloco");
      b.appendChild(titulo(s.titulo));
      b.appendChild(apps(s.itens, "so-nome"));
      esq.appendChild(b);
    });
    var bo = el("div", "bloco");
    bo.appendChild(titulo("Órgãos e consultas"));
    bo.appendChild(listaGavetas());
    esq.appendChild(bo);
    col.appendChild(esq);

    var dir = el("div");
    var bp = el("div", "bloco");
    bp.appendChild(titulo("Minhas pendências", PENDENCIAS.length));
    bp.appendChild(listaPendencias());
    dir.appendChild(bp);
    var br = el("div", "bloco");
    br.appendChild(titulo("Recados"));
    br.appendChild(recados());
    dir.appendChild(br);
    col.appendChild(dir);

    r.appendChild(col);
    return r;
  }

  /* ---------- M4 · Sóbrio ---------- */
  function m4() {
    var r = el("div", "modelo"); r.id = "M4";
    r.appendChild(topo());

    var faixa = el("div", "faixa");
    faixa.appendChild(titulo(cartoes[0].titulo));
    faixa.appendChild(apps(cartoes[0].itens, true));
    r.appendChild(faixa);

    var col = el("div", "colunas");
    var esq = el("div");
    cartoes.slice(1).forEach(function (s) {
      var b = el("div", "bloco");
      b.appendChild(titulo(s.titulo));
      b.appendChild(apps(s.itens, true));
      esq.appendChild(b);
    });
    var bo = el("div", "bloco");
    bo.appendChild(titulo("Órgãos e consultas"));
    bo.appendChild(listaGavetas());
    esq.appendChild(bo);
    col.appendChild(esq);

    var dir = el("div");
    var bp = el("div", "bloco");
    bp.appendChild(titulo("Minhas pendências", PENDENCIAS.length));
    bp.appendChild(listaPendencias());
    dir.appendChild(bp);
    var br = el("div", "bloco");
    br.appendChild(titulo("Recados"));
    br.appendChild(recados());
    dir.appendChild(br);
    col.appendChild(dir);

    r.appendChild(col);
    return r;
  }

  var palco = document.getElementById("palco");
  [m1(), m2(), m3(), m4()].forEach(function (m) { palco.appendChild(m); });

  var botoes = document.getElementById("botoes");
  MODELOS.forEach(function (m) {
    var b = el("button", "opcao", m.id.replace("M", "") + " · " + m.nome);
    b.type = "button";
    b.dataset.modelo = m.id;
    b.addEventListener("click", function () { mostrar(m.id); });
    botoes.appendChild(b);
  });

  function mostrar(id) {
    Array.prototype.forEach.call(document.querySelectorAll(".modelo"), function (m) {
      m.classList.toggle("ativo", m.id === id);
    });
    Array.prototype.forEach.call(botoes.children, function (b) {
      b.setAttribute("aria-pressed", b.dataset.modelo === id ? "true" : "false");
    });
    location.hash = id;
  }

  mostrar((location.hash || "#M1").slice(1).toUpperCase() || "M1");

})();
