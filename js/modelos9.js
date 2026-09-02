/* ============================================================
   Rodada 9 — descartável.
   Mesmo conteúdo nas cinco. Muda a linguagem visual e, nos que
   têm trilho de navegação, a estrutura de colunas.
   ============================================================ */

(function () {
  "use strict";

  var LOGOS_IDX = (typeof LOGOS !== "undefined") ? LOGOS : {};

  var GRUPOS = [
    { rot:"Todo dia", nomes:["Confi Tarefas","Confi Chat","Gmail","Google Drive","Google Agenda","WhatsApp Web","Econet","Claude"] },
    { rot:"Nossos sistemas", nomes:["Portal do Cliente","Painel da Equipe","Atos Societários","GeRescisão"] },
  ];

  /* A agenda é conteúdo de verdade: são os vencimentos que a
     equipe procura em algum lugar todo mês. Aqui estão como
     exemplo — no Hub de verdade viriam do banco, editáveis pela
     administração junto com os avisos. */
  var PRAZOS = [
    { d:"02", n:"DCTFWeb",            q:"competência ago", estado:"hoje" },
    { d:"07", n:"FGTS · Conectividade", q:"todos os clientes", estado:"perto" },
    { d:"15", n:"eSocial e FGTS Digital", q:"fechamento da folha", estado:"perto" },
    { d:"20", n:"DAS do Simples",     q:"todos os optantes", estado:"" },
    { d:"20", n:"INSS e IRRF",        q:"retenções", estado:"" },
    { d:"25", n:"PIS e COFINS",       q:"lucro presumido", estado:"" },
    { d:"30", n:"ICMS Sergipe",       q:"apuração mensal", estado:"" },
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

  function app(i) {
    var a = document.createElement("a");
    a.className = "app";
    a.href = i.url || "#";
    if (i.url) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    a.appendChild(icone(i));
    a.appendChild(el("span", "app__n", i.nome));
    return a;
  }

  var ICONES_NAV = {
    casa:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    grade: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    calen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  };

  function tela(id) {
    var raiz = el("div", "modelo"); raiz.id = id;
    var t = el("div", "tela");

    /* trilho de navegação — só o T4 tem */
    if (id === "T4") {
      var nav = el("div", "nav");
      var lg = document.createElement("img");
      lg.className = "nav__logo";
      lg.src = "assets/simbolo.png";
      lg.alt = "";
      nav.appendChild(lg);
      [["casa", true], ["grade", false], ["lista", false], ["calen", false]].forEach(function (par) {
        var b = el("button", "nav__b" + (par[1] ? " on" : ""));
        b.type = "button";
        b.innerHTML = ICONES_NAV[par[0]];
        nav.appendChild(b);
      });
      t.appendChild(nav);
    }

    /* cabeçalho */
    var cab = el("div", "cab");
    var img = document.createElement("img");
    img.className = "marca";
    img.src = (id === "T2" || id === "T3") ? "assets/logo-hub-escuro.png" : "assets/logo-hub.png";
    img.alt = "Hub Totali";
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

    /* centro: aplicativos + gaveta + agenda */
    var centro = el("div", "centro");

    GRUPOS.forEach(function (g) {
      var z = el("div", "zona");
      var zc = el("div", "zona__cab");
      zc.appendChild(el("span", "rot", g.rot));
      zc.appendChild(el("span", "zona__n", g.nomes.length + " sistemas"));
      z.appendChild(zc);
      var apps = el("div", "apps");
      g.nomes.forEach(function (n) { if (PORNOME[n]) apps.appendChild(app(PORNOME[n])); });
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

    /* a zona que ocupa a sobra: agenda do mês */
    var za = el("div", "zona zona--cresce");
    var zac = el("div", "zona__cab");
    zac.appendChild(el("span", "rot", "Agenda do mês"));
    zac.appendChild(el("span", "zona__n", "setembro"));
    za.appendChild(zac);
    var ag = el("div", "agenda");
    PRAZOS.forEach(function (p) {
      var x = el("div", "prazo" + (p.estado ? " prazo--" + p.estado : ""));
      x.appendChild(el("div", "prazo__d", p.d));
      x.appendChild(el("div", "prazo__n", p.n));
      x.appendChild(el("div", "prazo__q", p.q));
      ag.appendChild(x);
    });
    za.appendChild(ag);
    centro.appendChild(za);

    t.appendChild(centro);

    /* trilho */
    var tr = el("div", "trilho");
    var tc = el("div", "trilho__cab");
    tc.appendChild(el("span", "trilho__t", "Minhas pendências"));
    tc.appendChild(el("span", "trilho__n", PENDENCIAS.length + " abertas"));
    tr.appendChild(tc);

    PENDENCIAS.forEach(function (p) {
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
      tr.appendChild(x);
    });

    var ac = el("div", "trilho__cab");
    ac.style.marginTop = "24px";
    ac.appendChild(el("span", "trilho__t", "Avisos"));
    tr.appendChild(ac);
    (typeof AVISOS !== "undefined" ? AVISOS : []).forEach(function (av) {
      var x = el("div", "aviso");
      x.appendChild(el("span", "aviso__p"));
      var tx = el("div");
      tx.appendChild(el("div", "aviso__t", av.titulo));
      if (av.texto) tx.appendChild(el("div", "aviso__x", av.texto));
      x.appendChild(tx);
      tr.appendChild(x);
    });

    t.appendChild(tr);
    raiz.appendChild(t);
    return raiz;
  }

  var T = [
    { id: "T1", nome: "Projeto",        nota: "claro, grade de desenho técnico, acento azul" },
    { id: "T2", nome: "Console",        nota: "quase preto, ciano de terminal, tudo monoespaçado" },
    { id: "T3", nome: "Índigo",         nota: "escuro azul-violeta com brilho no acento" },
    { id: "T4", nome: "Trilho escuro",  nota: "claro com barra lateral escura, padrão de SaaS" },
    { id: "T5", nome: "Alto contraste", nota: "branco no meio, trilho quase preto com âmbar" },
  ];

  var palco = document.getElementById("palco");
  T.forEach(function (x) { palco.appendChild(tela(x.id)); });

  var botoes = document.getElementById("botoes");
  T.forEach(function (x, i) {
    var b = el("button", "opcao", (i + 1) + " · " + x.nome);
    b.type = "button";
    b.title = x.nota;
    b.dataset.t = x.id;
    b.addEventListener("click", function () { mostrar(x.id); });
    botoes.appendChild(b);
  });

  function mostrar(id) {
    Array.prototype.forEach.call(document.querySelectorAll(".modelo"), function (m) {
      m.classList.toggle("ativo", m.id === id);
    });
    Array.prototype.forEach.call(botoes.children, function (b) {
      b.setAttribute("aria-pressed", b.dataset.t === id ? "true" : "false");
    });
    location.hash = id;
  }

  var pedido = (location.hash || "").slice(1).toUpperCase();
  mostrar(T.some(function (x) { return x.id === pedido; }) ? pedido : "T1");

})();
