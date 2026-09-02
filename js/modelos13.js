/* ============================================================
   Rodada 13 — descartável.
   Avisos no rodapé, pendências sozinhas no trilho, e seis
   arrumações para os ícones dos sistemas.
   ============================================================ */

(function () {
  "use strict";

  var LOGOS_IDX = (typeof LOGOS !== "undefined") ? LOGOS : {};

  var TODO_DIA = ["Confi Tarefas","Confi Chat","Gmail","Google Drive","Google Agenda","WhatsApp Web","Econet","Claude"];
  var NOSSOS   = ["Portal do Cliente","Painel da Equipe","Atos Societários","GeRescisão"];

  var PRAZOS = [
    { d:"02", n:"DCTFWeb",                q:"competência ago",     e:"hoje" },
    { d:"07", n:"FGTS · Conectividade",   q:"todos os clientes",   e:"perto" },
    { d:"15", n:"eSocial e FGTS Digital", q:"fechamento da folha", e:"perto" },
    { d:"20", n:"DAS do Simples",         q:"todos os optantes",   e:"" },
    { d:"20", n:"INSS e IRRF",            q:"retenções",           e:"" },
    { d:"25", n:"PIS e COFINS",           q:"lucro presumido",     e:"" },
  ];

  var PENDENCIAS = [
    { d:"28", m:"ago", o:"Enviar balancete da Gigantte",       q:"Fiscal pediu para o Contábil",   e:"atrasada" },
    { d:"29", m:"ago", o:"Retificar a GFIP da ITWEB",          q:"Diretoria pediu para o Pessoal", e:"atrasada" },
    { d:"02", m:"set", o:"Conferir rescisão do J C de Lira",   q:"Pessoal pediu para você",        e:"hoje" },
    { d:"02", m:"set", o:"Retificar SPED da Braz",             q:"Você pediu para o Fiscal",       e:"hoje" },
    { d:"04", m:"set", o:"Documentos da abertura da Domum",    q:"Legalização pediu para você",    e:"" },
    { d:"09", m:"set", o:"Fechar cartões da Varejista",        q:"Você pediu para o Financeiro",   e:"" },
    { d:"11", m:"set", o:"Conferir o DAS da Central Net",      q:"Gerência pediu para o Fiscal",   e:"" },
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
    var ico = el("span", "ico");
    if (arq) {
      var img = document.createElement("img");
      img.src = "assets/logos/" + arq; img.alt = "";
      img.addEventListener("error", function () {
        ico.classList.add("ico--sigla"); ico.textContent = sigla(item);
      });
      ico.appendChild(img);
    } else { ico.classList.add("ico--sigla"); ico.textContent = sigla(item); }
    return ico;
  }
  function ancora(i, classe) {
    var a = document.createElement("a");
    a.className = classe;
    a.href = i.url || "#";
    if (i.url) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    return a;
  }

  var PORNOME = {}, TOTAL = 0;
  SETORES.forEach(function (s) {
    (s.itens || []).forEach(function (i) { PORNOME[i.nome] = i; TOTAL++; });
  });
  function itens(nomes) { return nomes.map(function (n) { return PORNOME[n]; }).filter(Boolean); }

  /* ---------- formas de desenhar um sistema ---------- */
  function comoIcone(i, classe) {
    var a = ancora(i, classe || "app");
    a.appendChild(icone(i));
    a.appendChild(el("span", "app__n", i.nome));
    return a;
  }
  function comoLinha(i) {
    var a = ancora(i, "linha");
    a.appendChild(icone(i));
    a.appendChild(el("span", "linha__n", i.nome));
    return a;
  }
  function comoCartao(i, classeBase) {
    var a = ancora(i, classeBase);
    a.appendChild(icone(i));
    var t = el("div");
    t.appendChild(el("div", classeBase + "__n", i.nome));
    if (i.nota) t.appendChild(el("div", classeBase + "__x", i.nota));
    a.appendChild(t);
    return a;
  }

  function gavetaDoResto() {
    var g = el("button", "gaveta");
    g.type = "button";
    g.appendChild(el("span", "gaveta__c", String(TOTAL - TODO_DIA.length - NOSSOS.length)));
    var t = el("div");
    t.appendChild(el("div", "gaveta__t", "Órgãos, impostos e consultas"));
    t.appendChild(el("div", "gaveta__s", "Receita, SEFAZ, eSocial, juntas, prefeituras e certificados"));
    g.appendChild(t);
    g.appendChild(el("span", "gaveta__seta", "›"));
    return g;
  }

  function blocoAgenda() {
    var b = el("div", "bloco");
    b.style.flex = "1";
    var c = el("div", "bloco__cab");
    c.appendChild(el("span", "bloco__t", "Agenda do mês"));
    c.appendChild(el("span", "bloco__n", "setembro"));
    b.appendChild(c);
    var ag = el("div", "agenda");
    PRAZOS.forEach(function (p) {
      var x = el("div", "prazo" + (p.e ? " prazo--" + p.e : ""));
      x.appendChild(el("div", "prazo__d", p.d));
      x.appendChild(el("div", "prazo__n", p.n));
      x.appendChild(el("div", "prazo__q", p.q));
      ag.appendChild(x);
    });
    b.appendChild(ag);
    return b;
  }

  function bloco(titulo, conta) {
    var b = el("div", "bloco");
    var c = el("div", "bloco__cab");
    c.appendChild(el("span", "bloco__t", titulo));
    if (conta) c.appendChild(el("span", "bloco__n", conta));
    b.appendChild(c);
    return b;
  }

  /* ---------- as seis arrumações ---------- */

  function n1(centro) {                    /* duas colunas */
    var duas = el("div", "duas");
    [["Todo dia", TODO_DIA], ["Nossos sistemas", NOSSOS]].forEach(function (g) {
      var b = bloco(g[0], g[1].length);
      var apps = el("div", "apps");
      itens(g[1]).forEach(function (i) { apps.appendChild(comoIcone(i)); });
      b.appendChild(apps);
      duas.appendChild(b);
    });
    centro.appendChild(duas);
    centro.appendChild(gavetaDoResto());
    centro.appendChild(blocoAgenda());
  }

  function n2(centro) {                    /* fileira única */
    var b = bloco("Sistemas do dia", TODO_DIA.length + NOSSOS.length);
    var f = el("div", "fileira");
    itens(TODO_DIA).forEach(function (i) { f.appendChild(comoIcone(i)); });
    f.appendChild(el("span", "divisor"));
    itens(NOSSOS).forEach(function (i) { f.appendChild(comoIcone(i)); });
    b.appendChild(f);
    centro.appendChild(b);
    centro.appendChild(gavetaDoResto());
    centro.appendChild(blocoAgenda());
  }

  function n3(centro) {                    /* nome ao lado */
    [["Todo dia", TODO_DIA], ["Nossos sistemas", NOSSOS]].forEach(function (g) {
      var b = bloco(g[0], g[1].length);
      var cols = el("div", "colunas");
      itens(g[1]).forEach(function (i) { cols.appendChild(comoLinha(i)); });
      b.appendChild(cols);
      centro.appendChild(b);
    });
    centro.appendChild(gavetaDoResto());
    centro.appendChild(blocoAgenda());
  }

  function n4(centro) {                    /* mosaico */
    var b = bloco("Sistemas do dia", TODO_DIA.length + NOSSOS.length);
    var d = el("div", "destaques");
    itens(NOSSOS).forEach(function (i) { d.appendChild(comoCartao(i, "grande")); });
    b.appendChild(d);
    var apps = el("div", "apps");
    itens(TODO_DIA).forEach(function (i) { apps.appendChild(comoIcone(i)); });
    b.appendChild(apps);
    centro.appendChild(b);
    centro.appendChild(gavetaDoResto());
    centro.appendChild(blocoAgenda());
  }

  function n5(centro) {                    /* sem caixa */
    [["Todo dia", TODO_DIA], ["Nossos sistemas", NOSSOS]].forEach(function (g) {
      var gr = el("div", "grupo");
      var rot = el("div", "grupo__rot");
      rot.appendChild(el("span", "rot", g[0]));
      gr.appendChild(rot);
      var apps = el("div", "apps");
      itens(g[1]).forEach(function (i) { apps.appendChild(comoIcone(i)); });
      gr.appendChild(apps);
      centro.appendChild(gr);
    });
    centro.appendChild(gavetaDoResto());
    centro.appendChild(blocoAgenda());
  }

  function n6(centro) {                    /* cartões largos */
    [["Todo dia", TODO_DIA], ["Nossos sistemas", NOSSOS]].forEach(function (g) {
      var b = bloco(g[0], g[1].length);
      var cs = el("div", "cartoes");
      itens(g[1]).forEach(function (i) { cs.appendChild(comoCartao(i, "cartao")); });
      b.appendChild(cs);
      centro.appendChild(b);
    });
    centro.appendChild(gavetaDoResto());
    centro.appendChild(blocoAgenda());
  }

  function n7(centro) {                    /* acesso rápido */
    [["Acesso rápido", TODO_DIA], ["Nossos sistemas", NOSSOS]].forEach(function (g) {
      var b = bloco(g[0], g[1].length);
      var grade = el("div", "rapido");
      itens(g[1]).forEach(function (i) {
        var a = ancora(i, "qa");
        a.appendChild(icone(i));
        var t = el("div");
        t.appendChild(el("div", "qa__n", i.nome));
        if (i.nota) t.appendChild(el("div", "qa__x", i.nota));
        a.appendChild(t);
        grade.appendChild(a);
      });
      b.appendChild(grade);
      centro.appendChild(b);
    });
    centro.appendChild(gavetaDoResto());
    centro.appendChild(blocoAgenda());
  }

  var CORES_GRUPO = { "Todo dia": "#0b5cf6", "Nossos sistemas": "#12a37d" };

  function n8(centro) {                    /* prateleira */
    [["Todo dia", TODO_DIA], ["Nossos sistemas", NOSSOS]].forEach(function (g) {
      var b = bloco(g[0], g[1].length);
      var p = el("div", "prateleira");
      itens(g[1]).forEach(function (i) {
        var a = ancora(i, "pt");
        a.appendChild(icone(i));
        a.appendChild(el("span", "pt__n", i.nome));
        p.appendChild(a);
      });
      b.appendChild(p);
      centro.appendChild(b);
    });
    centro.appendChild(gavetaDoResto());
    centro.appendChild(blocoAgenda());
  }

  function n9(centro) {                    /* dois por linha */
    [["Todo dia", TODO_DIA], ["Nossos sistemas", NOSSOS]].forEach(function (g) {
      var b = bloco(g[0], g[1].length);
      var d = el("div", "duplas");
      itens(g[1]).forEach(function (i) {
        var a = ancora(i, "dupla");
        a.appendChild(icone(i));
        var t = el("div");
        t.appendChild(el("div", "dupla__n", i.nome));
        if (i.nota) t.appendChild(el("div", "dupla__x", i.nota));
        a.appendChild(t);
        d.appendChild(a);
      });
      b.appendChild(d);
      centro.appendChild(b);
    });
    centro.appendChild(gavetaDoResto());
    centro.appendChild(blocoAgenda());
  }

  function n10(centro) {                   /* faixa colorida, tudo junto */
    var b = bloco("Sistemas", TODO_DIA.length + NOSSOS.length);
    var lg = el("div", "legenda");
    Object.keys(CORES_GRUPO).forEach(function (nome) {
      var x = el("div", "lg");
      var c = el("span", "lg__c");
      c.style.background = CORES_GRUPO[nome];
      x.appendChild(c);
      x.appendChild(document.createTextNode(nome));
      lg.appendChild(x);
    });
    b.appendChild(lg);
    var m = el("div", "misturado");
    [["Todo dia", TODO_DIA], ["Nossos sistemas", NOSSOS]].forEach(function (g) {
      itens(g[1]).forEach(function (i) {
        var a = ancora(i, "fx");
        a.style.setProperty("--cor", CORES_GRUPO[g[0]]);
        a.appendChild(icone(i));
        a.appendChild(el("span", "fx__n", i.nome));
        m.appendChild(a);
      });
    });
    b.appendChild(m);
    centro.appendChild(b);
    centro.appendChild(gavetaDoResto());
    centro.appendChild(blocoAgenda());
  }

  /* ---------- esqueleto ---------- */
  var NAV = {
    casa:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    grade: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    calen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  };

  function tela(id, montar) {
    var raiz = el("div", "modelo"); raiz.id = id;
    var t = el("div", "tela");

    var nav = el("div", "nav");
    var lg = document.createElement("img");
    lg.className = "nav__logo"; lg.src = "assets/simbolo.png"; lg.alt = "";
    nav.appendChild(lg);
    [["casa", true], ["grade", false], ["lista", false], ["calen", false]].forEach(function (par) {
      var b = el("button", "nav__b" + (par[1] ? " on" : ""));
      b.type = "button"; b.innerHTML = NAV[par[0]];
      nav.appendChild(b);
    });
    t.appendChild(nav);

    var cab = el("div", "cab");
    var img = document.createElement("img");
    img.className = "marca"; img.src = "assets/logo-hub.png"; img.alt = "Hub Totali";
    cab.appendChild(img);
    var rel = el("div", "rel");
    var dt = new Date();
    var bl = el("div");
    bl.appendChild(el("div", "rel__h",
      ("0" + dt.getHours()).slice(-2) + ":" + ("0" + dt.getMinutes()).slice(-2)));
    bl.appendChild(el("div", "rel__d",
      dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })));
    rel.appendChild(bl);
    rel.appendChild(el("span", "rel__risco"));
    var lado = el("div");
    var h = dt.getHours();
    lado.appendChild(el("div", "rel__ola",
      (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite") + ", Hesley"));
    var sub = el("div", "rel__sub");
    sub.appendChild(el("b", null, "2 atrasadas"));
    sub.appendChild(document.createTextNode(" · 2 para hoje"));
    lado.appendChild(sub);
    rel.appendChild(lado);
    cab.appendChild(rel);
    t.appendChild(cab);

    var centro = el("div", "centro");
    montar(centro);
    t.appendChild(centro);

    /* trilho: só pendências, agrupadas por urgência */
    var lat = el("div", "lado");
    lat.appendChild(el("div", "lado__t", "Minhas pendências"));
    [
      { c:"atraso", t:"Atrasadas",     f:function (p) { return p.e === "atrasada"; } },
      { c:"hoje",   t:"Para hoje",     f:function (p) { return p.e === "hoje"; } },
      { c:"depois", t:"Próximos dias", f:function (p) { return !p.e; } },
    ].forEach(function (g) {
      var lista = PENDENCIAS.filter(g.f);
      if (!lista.length) return;
      var f = el("div", "faixa faixa--" + g.c);
      f.appendChild(el("span", "faixa__t", g.t));
      f.appendChild(el("span", "faixa__n", String(lista.length)));
      lat.appendChild(f);
      lista.forEach(function (p) {
        var x = el("div", "pen" + (p.e ? " pen--" + p.e : ""));
        x.appendChild(el("span", "pen__f"));
        var pr = el("div", "pen__p");
        pr.appendChild(el("div", "pen__d", p.d));
        pr.appendChild(el("div", "pen__m", p.m));
        x.appendChild(pr);
        var tx = el("div");
        tx.appendChild(el("div", "pen__o", p.o));
        tx.appendChild(el("div", "pen__q", p.q));
        x.appendChild(tx);
        lat.appendChild(x);
      });
    });
    t.appendChild(lat);

    /* avisos: barra fina no pé da área central */
    var av = el("div", "avisos");
    av.appendChild(el("span", "avisos__rot", "Avisos"));
    var lista = (typeof AVISOS !== "undefined" ? AVISOS : []);
    lista.slice(0, 3).forEach(function (a, i) {
      if (i) av.appendChild(el("span", "av__sep"));
      var x = el("span", "av");
      x.appendChild(el("span", "av__p"));
      x.appendChild(el("span", "av__t", a.titulo));
      if (a.texto) x.appendChild(el("span", "av__x", a.texto));
      av.appendChild(x);
    });
    if (lista.length > 3) av.appendChild(el("span", "avisos__mais", "+ " + (lista.length - 3)));
    t.appendChild(av);

    raiz.appendChild(t);
    return raiz;
  }

  var N = [
    { id:"N1", nome:"Duas colunas",   montar:n1 },
    { id:"N2", nome:"Fileira única",  montar:n2 },
    { id:"N3", nome:"Nome ao lado",   montar:n3 },
    { id:"N4", nome:"Mosaico",        montar:n4 },
    { id:"N5", nome:"Sem caixa",      montar:n5 },
    { id:"N6", nome:"Cartões largos", montar:n6 },
    { id:"N7", nome:"Acesso rápido",  montar:n7 },
    { id:"N8", nome:"Prateleira",     montar:n8 },
    { id:"N9", nome:"Dois por linha", montar:n9 },
    { id:"N10", nome:"Faixa colorida", montar:n10 },
  ];

  var palco = document.getElementById("palco");
  N.forEach(function (x) { palco.appendChild(tela(x.id, x.montar)); });

  var botoes = document.getElementById("botoes");
  N.forEach(function (x, i) {
    var b = el("button", "opcao", (i + 1) + " · " + x.nome);
    b.type = "button";
    b.dataset.n = x.id;
    b.addEventListener("click", function () { mostrar(x.id); });
    botoes.appendChild(b);
  });

  function mostrar(id) {
    Array.prototype.forEach.call(document.querySelectorAll(".modelo"), function (m) {
      m.classList.toggle("ativo", m.id === id);
    });
    Array.prototype.forEach.call(botoes.children, function (b) {
      b.setAttribute("aria-pressed", b.dataset.n === id ? "true" : "false");
    });
    location.hash = id;
  }

  var pedido = (location.hash || "").slice(1).toUpperCase();
  mostrar(N.some(function (x) { return x.id === pedido; }) ? pedido : "N7");

})();
