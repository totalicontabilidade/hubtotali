/* ============================================================
   Rodada 12 — descartável.
   Cinco refinamentos do Trilho. Cada tela acrescenta UMA ideia e
   deixa o resto igual, para dar para julgar a ideia sozinha.
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
  function ancora(i, classe) {
    var a = document.createElement("a");
    a.className = classe;
    a.href = i.url || "#";
    if (i.url) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    return a;
  }

  var PORNOME = {}, TODOS = [], GRUPODE = {}, TOTAL = 0;
  SETORES.forEach(function (s) {
    (s.itens || []).forEach(function (i) {
      PORNOME[i.nome] = i; TODOS.push(i); GRUPODE[i.nome] = s.titulo; TOTAL++;
    });
  });
  function itens(nomes) { return nomes.map(function (n) { return PORNOME[n]; }).filter(Boolean); }

  function appIcone(i, comPino) {
    var a = ancora(i, "app");
    a.appendChild(icone(i));
    a.appendChild(el("span", "app__n", i.nome));
    if (comPino) {
      var p = el("button", "pino");
      p.type = "button";
      p.title = "Fixar nos meus atalhos";
      p.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"/></svg>';
      p.addEventListener("click", function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        p.classList.toggle("on");
        if (comPino.aoMudar) comPino.aoMudar(i, p.classList.contains("on"));
      });
      a.appendChild(p);
    }
    return a;
  }
  function penCartao(p) {
    var c = el("div", "pen" + (p.e ? " pen--" + p.e : ""));
    c.appendChild(el("span", "pen__f"));
    var pr = el("div", "pen__p");
    pr.appendChild(el("div", "pen__d", p.d));
    pr.appendChild(el("div", "pen__m", p.m));
    c.appendChild(pr);
    var t = el("div");
    t.appendChild(el("div", "pen__o", p.o));
    t.appendChild(el("div", "pen__q", p.q));
    c.appendChild(t);
    return c;
  }
  function avisoCartao(a) {
    var c = el("div", "aviso");
    c.appendChild(el("span", "aviso__p"));
    var t = el("div");
    t.appendChild(el("div", "aviso__t", a.titulo));
    if (a.texto) t.appendChild(el("div", "aviso__x", a.texto));
    c.appendChild(t);
    return c;
  }
  function bloco(titulo, conta) {
    var b = el("div", "bloco");
    var c = el("div", "bloco__cab");
    c.appendChild(el("span", "bloco__t", titulo));
    if (conta) c.appendChild(el("span", "bloco__n", conta));
    b.appendChild(c);
    return b;
  }
  var NAV = {
    casa:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    grade: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    calen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  };

  function esqueleto(id) {
    var r = el("div", "modelo"); r.id = id;
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
    sub.appendChild(el("b", null, "1 atrasada"));
    sub.appendChild(document.createTextNode(" · 2 para hoje"));
    lado.appendChild(sub);
    rel.appendChild(lado);
    cab.appendChild(rel);
    t.appendChild(cab);

    var centro = el("div", "centro");
    var lat = el("div", "lado");
    t.appendChild(centro);
    t.appendChild(lat);
    r.appendChild(t);
    return { raiz: r, centro: centro, lado: lat };
  }

  function blocosDeSistemas(centro, comPino) {
    [["Todo dia", TODO_DIA], ["Nossos sistemas", NOSSOS]].forEach(function (g) {
      var b = bloco(g[0], g[1].length + " sistemas");
      var apps = el("div", "apps");
      itens(g[1]).forEach(function (i) { apps.appendChild(appIcone(i, comPino)); });
      b.appendChild(apps);
      centro.appendChild(b);
    });
    var gav = el("button", "gaveta");
    gav.type = "button";
    gav.appendChild(el("span", "gaveta__c", String(TOTAL - TODO_DIA.length - NOSSOS.length)));
    var gt = el("div");
    gt.appendChild(el("div", "gaveta__t", "Órgãos, impostos e consultas"));
    gt.appendChild(el("div", "gaveta__s", "Receita, SEFAZ, eSocial, juntas, prefeituras e certificados"));
    gav.appendChild(gt);
    gav.appendChild(el("span", "gaveta__seta", "›"));
    centro.appendChild(gav);
  }

  function blocoAgenda() {
    var b = bloco("Agenda do mês", "setembro");
    b.style.flex = "1";
    var ag = el("div", "agenda");
    PRAZOS.forEach(function (p) {
      var c = el("div", "prazo" + (p.e ? " prazo--" + p.e : ""));
      c.appendChild(el("div", "prazo__d", p.d));
      c.appendChild(el("div", "prazo__n", p.n));
      c.appendChild(el("div", "prazo__q", p.q));
      ag.appendChild(c);
    });
    b.appendChild(ag);
    return b;
  }

  function ladoPadrao(lado) {
    var c = el("div", "bloco__cab");
    c.appendChild(el("span", "bloco__t", "Minhas pendências"));
    c.appendChild(el("span", "bloco__n", PENDENCIAS.length + " abertas"));
    lado.appendChild(c);
    PENDENCIAS.forEach(function (p) { lado.appendChild(penCartao(p)); });
    var a = el("div", "bloco__cab");
    a.style.marginTop = "22px";
    a.appendChild(el("span", "bloco__t", "Avisos"));
    lado.appendChild(a);
    (typeof AVISOS !== "undefined" ? AVISOS : []).forEach(function (x) { lado.appendChild(avisoCartao(x)); });
  }

  /* ---------- R1 · pendências por urgência ---------- */
  function r1() {
    var e = esqueleto("R1");
    blocosDeSistemas(e.centro);
    e.centro.appendChild(blocoAgenda());

    var grupos = [
      { classe:"atraso", t:"Atrasadas", filtro:function (p) { return p.e === "atrasada"; } },
      { classe:"hoje",   t:"Para hoje", filtro:function (p) { return p.e === "hoje"; } },
      { classe:"depois", t:"Próximos dias", filtro:function (p) { return !p.e; } },
    ];
    var c = el("div", "bloco__cab");
    c.appendChild(el("span", "bloco__t", "Minhas pendências"));
    e.lado.appendChild(c);
    grupos.forEach(function (g) {
      var lista = PENDENCIAS.filter(g.filtro);
      if (!lista.length) return;
      var f = el("div", "faixa-pen faixa-pen--" + g.classe);
      f.appendChild(el("span", "faixa-pen__t", g.t));
      f.appendChild(el("span", "faixa-pen__n", String(lista.length)));
      e.lado.appendChild(f);
      lista.forEach(function (p) { e.lado.appendChild(penCartao(p)); });
    });
    var a = el("div", "bloco__cab");
    a.style.marginTop = "22px";
    a.appendChild(el("span", "bloco__t", "Avisos"));
    e.lado.appendChild(a);
    (typeof AVISOS !== "undefined" ? AVISOS : []).forEach(function (x) { e.lado.appendChild(avisoCartao(x)); });
    return e.raiz;
  }

  /* ---------- R2 · atalhos que cada um monta ---------- */
  function r2() {
    var e = esqueleto("R2");

    var b = bloco("Meus atalhos", "monte o seu");
    var grade = el("div", "apps");
    var vazio = el("div", "vazio-atalhos",
      "Passe o mouse em qualquer sistema abaixo e clique na estrela para fixar aqui.");
    b.appendChild(vazio);
    b.appendChild(grade);
    e.centro.appendChild(b);

    var fixados = [];
    function repintar() {
      grade.textContent = "";
      fixados.forEach(function (i) { grade.appendChild(appIcone(i)); });
      vazio.style.display = fixados.length ? "none" : "";
    }
    repintar();

    blocosDeSistemas(e.centro, {
      aoMudar: function (item, ligado) {
        var i = fixados.indexOf(item);
        if (ligado && i === -1) fixados.push(item);
        if (!ligado && i !== -1) fixados.splice(i, 1);
        repintar();
      }
    });
    e.centro.appendChild(blocoAgenda());
    ladoPadrao(e.lado);
    return e.raiz;
  }

  /* ---------- R3 · o quanto do dia já foi ---------- */
  function r3() {
    var e = esqueleto("R3");

    var feitas = 2, total = 7;
    var p = el("div", "progresso");
    p.appendChild(el("span", "progresso__n", feitas + "/" + total));
    var t = el("div");
    t.appendChild(el("div", "progresso__t", "Resolvidas hoje"));
    t.appendChild(el("div", "progresso__s", "A equipe fechou 14 esta semana"));
    p.appendChild(t);
    var barra = el("div", "barra");
    var i = el("div", "barra__i");
    i.style.width = Math.round(feitas / total * 100) + "%";
    barra.appendChild(i);
    p.appendChild(barra);
    p.appendChild(el("span", "progresso__p", Math.round(feitas / total * 100) + "%"));
    e.centro.appendChild(p);

    blocosDeSistemas(e.centro);
    e.centro.appendChild(blocoAgenda());
    ladoPadrao(e.lado);
    return e.raiz;
  }

  /* ---------- R4 · agenda em faixa ---------- */
  function r4() {
    var e = esqueleto("R4");
    blocosDeSistemas(e.centro);

    var b = bloco("Próximos dias", "setembro");
    b.style.flex = "1";
    var tira = el("div", "tira-agenda");
    var hoje = 2;
    var porDia = {};
    PRAZOS.forEach(function (p) { (porDia[parseInt(p.d, 10)] = porDia[parseInt(p.d, 10)] || []).push(p); });

    var semana = ["dom","seg","ter","qua","qui","sex","sáb"];
    for (var d = hoje; d < hoje + 14; d++) {
      var dia = el("div", "dia" + (d === hoje ? " dia--hoje" : (porDia[d] ? " dia--marcado" : "")));
      var data = new Date(2026, 8, d);
      dia.appendChild(el("div", "dia__s", semana[data.getDay()]));
      dia.appendChild(el("div", "dia__d", ("0" + d).slice(-2)));
      dia.appendChild(el("div", "dia__m", porDia[d] ? porDia[d].map(function (x) { return x.n; }).join(" · ") : ""));
      if (porDia[d]) dia.appendChild(el("div", "dia__ponto"));
      tira.appendChild(dia);
    }
    b.appendChild(tira);
    e.centro.appendChild(b);
    ladoPadrao(e.lado);
    return e.raiz;
  }

  /* ---------- R5 · barra de comando ---------- */
  function r5() {
    var e = esqueleto("R5");

    var dica = el("div", "dica-teclado");
    dica.appendChild(document.createTextNode("Aperte "));
    dica.appendChild(el("span", "tecla", "/"));
    dica.appendChild(document.createTextNode(" de qualquer lugar para achar um sistema sem tirar a mão do teclado"));
    dica.addEventListener("click", abrirComando);
    e.centro.appendChild(dica);

    blocosDeSistemas(e.centro);
    e.centro.appendChild(blocoAgenda());
    ladoPadrao(e.lado);
    return e.raiz;
  }

  /* ---------- a barra de comando em si ---------- */
  var comando = document.getElementById("comando");
  var campo = document.getElementById("comando-campo");
  var lista = document.getElementById("comando-lista");
  var selecionado = 0;

  function pintarComando() {
    var termo = campo.value.trim().toLowerCase();
    lista.textContent = "";
    var achados = TODOS.filter(function (i) {
      return !termo || i.nome.toLowerCase().indexOf(termo) !== -1;
    }).slice(0, 40);
    achados.forEach(function (i, n) {
      var a = ancora(i, "comando__i" + (n === selecionado ? " sel" : ""));
      a.appendChild(icone(i));
      a.appendChild(el("span", "comando__n", i.nome));
      a.appendChild(el("span", "comando__g", GRUPODE[i.nome] || ""));
      lista.appendChild(a);
    });
    return achados;
  }
  function abrirComando() {
    comando.classList.add("on");
    campo.value = ""; selecionado = 0;
    pintarComando();
    campo.focus();
  }
  function fecharComando() { comando.classList.remove("on"); }

  campo.addEventListener("input", function () { selecionado = 0; pintarComando(); });
  campo.addEventListener("keydown", function (ev) {
    var itens = lista.children;
    if (ev.key === "ArrowDown") { ev.preventDefault(); selecionado = Math.min(selecionado + 1, itens.length - 1); pintarComando(); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); selecionado = Math.max(selecionado - 1, 0); pintarComando(); }
    else if (ev.key === "Enter") { if (itens[selecionado]) itens[selecionado].click(); }
  });
  comando.addEventListener("click", function (ev) { if (ev.target === comando) fecharComando(); });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") fecharComando();
    /* A barra abre com "/" — mas não enquanto se digita num campo,
       senão seria impossível escrever uma barra em qualquer lugar. */
    if (ev.key === "/" && !comando.classList.contains("on")) {
      var alvo = ev.target;
      if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA")) return;
      ev.preventDefault();
      abrirComando();
    }
  });

  var R = [
    { id:"R1", nome:"Pendências por urgência" },
    { id:"R2", nome:"Atalhos que cada um monta" },
    { id:"R3", nome:"O quanto do dia já foi" },
    { id:"R4", nome:"Agenda em faixa" },
    { id:"R5", nome:"Barra de comando" },
  ];

  var palco = document.getElementById("palco");
  [r1(), r2(), r3(), r4(), r5()].forEach(function (m) { palco.appendChild(m); });

  var botoes = document.getElementById("botoes");
  R.forEach(function (x, i) {
    var b = el("button", "opcao", (i + 1) + " · " + x.nome);
    b.type = "button";
    b.dataset.r = x.id;
    b.addEventListener("click", function () { mostrar(x.id); });
    botoes.appendChild(b);
  });

  function mostrar(id) {
    Array.prototype.forEach.call(document.querySelectorAll(".modelo"), function (m) {
      m.classList.toggle("ativo", m.id === id);
    });
    Array.prototype.forEach.call(botoes.children, function (b) {
      b.setAttribute("aria-pressed", b.dataset.r === id ? "true" : "false");
    });
    location.hash = id;
  }

  var pedido = (location.hash || "").slice(1).toUpperCase();
  mostrar(R.some(function (x) { return x.id === pedido; }) ? pedido : "R1");

})();
