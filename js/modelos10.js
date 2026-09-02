/* ============================================================
   Rodada 10 — descartável.
   Uma tela só, repetida seis vezes com paletas diferentes. O
   desenho é idêntico: se mudasse junto, não daria para saber se
   o que agradou foi a cor ou o layout.
   ============================================================ */

(function () {
  "use strict";

  var LOGOS_IDX = (typeof LOGOS !== "undefined") ? LOGOS : {};

  var PALETAS = [
    { id:"P1", nome:"Marca",     cor:"#c2a250", nota:"azul-noite e dourado da Totali" },
    { id:"P2", nome:"Grafite",   cor:"#12a37d", nota:"cinza neutro e verde-menta" },
    { id:"P3", nome:"Índigo",    cor:"#5b4ce0", nota:"roxo-azulado de software" },
    { id:"P4", nome:"Petróleo",  cor:"#d08a2c", nota:"azul-esverdeado profundo, âmbar" },
    { id:"P5", nome:"Tinta",     cor:"#1668e3", nota:"preto e branco, um azul só" },
    { id:"P6", nome:"Aço",       cor:"#0d8ea8", nota:"azul frio e ciano" },
  ];

  var GRUPOS = [
    { rot:"Todo dia", nomes:["Confi Tarefas","Confi Chat","Gmail","Google Drive","Google Agenda","WhatsApp Web","Econet","Claude"] },
    { rot:"Nossos sistemas", nomes:["Portal do Cliente","Painel da Equipe","Atos Societários","GeRescisão"] },
  ];

  var PRAZOS = [
    { d:"02", n:"DCTFWeb",                q:"competência ago",     e:"hoje" },
    { d:"07", n:"FGTS · Conectividade",   q:"todos os clientes",   e:"perto" },
    { d:"15", n:"eSocial e FGTS Digital", q:"fechamento da folha", e:"perto" },
    { d:"20", n:"DAS do Simples",         q:"todos os optantes",   e:"" },
    { d:"20", n:"INSS e IRRF",            q:"retenções",           e:"" },
    { d:"25", n:"PIS e COFINS",           q:"lucro presumido",     e:"" },
    { d:"30", n:"ICMS Sergipe",           q:"apuração mensal",     e:"" },
  ];

  var PENDENCIAS = [
    { d:"28", m:"ago", o:"Enviar balancete da Gigantte",     q:"Fiscal pediu para o Contábil", e:"atrasada" },
    { d:"02", m:"set", o:"Conferir rescisão do J C de Lira", q:"Pessoal pediu para você",      e:"hoje" },
    { d:"02", m:"set", o:"Retificar SPED da Braz",           q:"Você pediu para o Fiscal",     e:"hoje" },
    { d:"04", m:"set", o:"Documentos da abertura da Domum",  q:"Legalização pediu para você",  e:"" },
    { d:"09", m:"set", o:"Fechar cartões da Varejista",      q:"Você pediu para o Financeiro", e:"" },
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

  var PORNOME = {}, TOTAL = 0;
  SETORES.forEach(function (s) {
    (s.itens || []).forEach(function (i) { PORNOME[i.nome] = i; TOTAL++; });
  });

  var NAV = {
    casa:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    grade: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    calen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  };

  function tela(p) {
    var raiz = el("div", "modelo"); raiz.id = p.id;
    var t = el("div", "tela");

    var nav = el("div", "nav");
    var lg = document.createElement("img");
    lg.className = "nav__logo"; lg.src = "assets/simbolo.png"; lg.alt = "";
    nav.appendChild(lg);
    [["casa", true], ["grade", false], ["lista", false], ["calen", false]].forEach(function (par) {
      var b = el("button", "nav__b" + (par[1] ? " on" : ""));
      b.type = "button";
      b.innerHTML = NAV[par[0]];
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
    sub.appendChild(el("b", null, "1 atrasada"));
    sub.appendChild(document.createTextNode(" · 2 para hoje"));
    lado.appendChild(sub);
    rel.appendChild(lado);
    cab.appendChild(rel);
    t.appendChild(cab);

    var centro = el("div", "centro");
    GRUPOS.forEach(function (g) {
      var z = el("div", "zona");
      var zc = el("div", "zona__cab");
      zc.appendChild(el("span", "rot", g.rot));
      zc.appendChild(el("span", "zona__n", g.nomes.length + " sistemas"));
      z.appendChild(zc);
      var apps = el("div", "apps");
      g.nomes.forEach(function (n) {
        var i = PORNOME[n];
        if (!i) return;
        var a = document.createElement("a");
        a.className = "app";
        a.href = i.url || "#";
        if (i.url) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
        a.appendChild(icone(i));
        a.appendChild(el("span", "app__n", i.nome));
        apps.appendChild(a);
      });
      z.appendChild(apps);
      centro.appendChild(z);
    });

    var usados = GRUPOS.reduce(function (n, g) { return n + g.nomes.length; }, 0);
    var gav = el("button", "gaveta");
    gav.type = "button";
    gav.appendChild(el("span", "gaveta__c", String(TOTAL - usados)));
    var gt = el("div");
    gt.appendChild(el("div", "gaveta__t", "Órgãos, impostos e consultas"));
    gt.appendChild(el("div", "gaveta__s", "Receita, SEFAZ, eSocial, juntas, prefeituras e certificados"));
    gav.appendChild(gt);
    gav.appendChild(el("span", "gaveta__seta", "›"));
    centro.appendChild(gav);

    var za = el("div", "zona zona--cresce");
    var zac = el("div", "zona__cab");
    zac.appendChild(el("span", "rot", "Agenda do mês"));
    zac.appendChild(el("span", "zona__n", "setembro"));
    za.appendChild(zac);
    var ag = el("div", "agenda");
    PRAZOS.forEach(function (x) {
      var c = el("div", "prazo" + (x.e ? " prazo--" + x.e : ""));
      c.appendChild(el("div", "prazo__d", x.d));
      c.appendChild(el("div", "prazo__n", x.n));
      c.appendChild(el("div", "prazo__q", x.q));
      ag.appendChild(c);
    });
    za.appendChild(ag);
    centro.appendChild(za);
    t.appendChild(centro);

    var tr = el("div", "trilho");
    var tc = el("div", "trilho__cab");
    tc.appendChild(el("span", "trilho__t", "Minhas pendências"));
    tc.appendChild(el("span", "trilho__n", PENDENCIAS.length + " abertas"));
    tr.appendChild(tc);
    PENDENCIAS.forEach(function (x) {
      var c = el("div", "pen" + (x.e ? " pen--" + x.e : ""));
      c.appendChild(el("span", "pen__f"));
      var pr = el("div", "pen__p");
      pr.appendChild(el("div", "pen__d", x.d));
      pr.appendChild(el("div", "pen__m", x.m));
      c.appendChild(pr);
      var tx = el("div");
      tx.appendChild(el("div", "pen__o", x.o));
      tx.appendChild(el("div", "pen__q", x.q));
      c.appendChild(tx);
      tr.appendChild(c);
    });
    var ac = el("div", "trilho__cab");
    ac.style.marginTop = "22px";
    ac.appendChild(el("span", "trilho__t", "Avisos"));
    tr.appendChild(ac);
    (typeof AVISOS !== "undefined" ? AVISOS : []).forEach(function (av) {
      var c = el("div", "aviso");
      c.appendChild(el("span", "aviso__p"));
      var tx = el("div");
      tx.appendChild(el("div", "aviso__t", av.titulo));
      if (av.texto) tx.appendChild(el("div", "aviso__x", av.texto));
      c.appendChild(tx);
      tr.appendChild(c);
    });
    t.appendChild(tr);

    raiz.appendChild(t);
    return raiz;
  }

  var palco = document.getElementById("palco");
  PALETAS.forEach(function (p) { palco.appendChild(tela(p)); });

  var botoes = document.getElementById("botoes");
  PALETAS.forEach(function (p, i) {
    var b = el("button", "opcao");
    b.type = "button";
    b.title = p.nota;
    b.dataset.p = p.id;
    var am = el("span", "amostra");
    am.style.background = p.cor;
    b.appendChild(am);
    b.appendChild(document.createTextNode((i + 1) + " · " + p.nome));
    b.addEventListener("click", function () { mostrar(p.id); });
    botoes.appendChild(b);
  });

  function mostrar(id) {
    Array.prototype.forEach.call(document.querySelectorAll(".modelo"), function (m) {
      m.classList.toggle("ativo", m.id === id);
    });
    Array.prototype.forEach.call(botoes.children, function (b) {
      b.setAttribute("aria-pressed", b.dataset.p === id ? "true" : "false");
    });
    location.hash = id;
  }

  var pedido = (location.hash || "").slice(1).toUpperCase();
  mostrar(PALETAS.some(function (p) { return p.id === pedido; }) ? pedido : "P1");

})();
