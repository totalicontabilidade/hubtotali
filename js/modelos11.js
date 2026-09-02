/* ============================================================
   Rodada 11 — descartável.
   Cinco ideias de tela, mesma paleta, mesmo conteúdo.
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
    { d:"28", m:"ago", o:"Enviar balancete da Gigantte",     q:"Fiscal pediu para o Contábil",   e:"atrasada", setor:"Contábil" },
    { d:"02", m:"set", o:"Conferir rescisão do J C de Lira", q:"Pessoal pediu para você",        e:"hoje",     setor:"Pessoal" },
    { d:"02", m:"set", o:"Retificar SPED da Braz",           q:"Você pediu para o Fiscal",       e:"hoje",     setor:"Fiscal" },
    { d:"04", m:"set", o:"Documentos da abertura da Domum",  q:"Legalização pediu para você",    e:"",         setor:"Legalização" },
    { d:"09", m:"set", o:"Fechar cartões da Varejista",      q:"Você pediu para o Financeiro",   e:"",         setor:"Financeiro" },
    { d:"11", m:"set", o:"Conferir DAS da Central Net",      q:"Diretoria pediu para o Fiscal",  e:"",         setor:"Fiscal" },
    { d:"12", m:"set", o:"Admissão do novo vendedor",        q:"Gerência pediu para o Pessoal",  e:"",         setor:"Pessoal" },
    { d:"16", m:"set", o:"Baixa da empresa do Sr. Antônio",  q:"Contábil pediu para Legalização", e:"",        setor:"Legalização" },
  ];

  var SETORES_CASA = ["Fiscal", "Contábil", "Pessoal", "Legalização", "Financeiro"];

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

  var PORNOME = {}, TODOS = [], TOTAL = 0;
  SETORES.forEach(function (s) {
    (s.itens || []).forEach(function (i) { PORNOME[i.nome] = i; TODOS.push(i); TOTAL++; });
  });
  function itens(nomes) { return nomes.map(function (n) { return PORNOME[n]; }).filter(Boolean); }

  function appIcone(i) {
    var a = ancora(i, "app");
    a.appendChild(icone(i));
    a.appendChild(el("span", "app__n", i.nome));
    return a;
  }
  function appFila(i) {
    var a = ancora(i, "fila");
    a.appendChild(icone(i));
    a.appendChild(el("span", "fila__n", i.nome));
    return a;
  }
  function penCartao(p, grande) {
    var c = el("div", "pen" + (p.e ? " pen--" + p.e : "") + (grande ? " pen--grande" : ""));
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
  function prazoCartao(p) {
    var c = el("div", "prazo" + (p.e ? " prazo--" + p.e : ""));
    c.appendChild(el("div", "prazo__d", p.d));
    c.appendChild(el("div", "prazo__n", p.n));
    c.appendChild(el("div", "prazo__q", p.q));
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
  function cabecalho() {
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
    return cab;
  }
  var NAV = {
    casa:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    grade: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    calen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  };
  function trilhoNav() {
    var nav = el("div", "nav");
    var lg = document.createElement("img");
    lg.className = "nav__logo"; lg.src = "assets/simbolo.png"; lg.alt = "";
    nav.appendChild(lg);
    [["casa", true], ["grade", false], ["lista", false], ["calen", false]].forEach(function (par) {
      var b = el("button", "nav__b" + (par[1] ? " on" : ""));
      b.type = "button"; b.innerHTML = NAV[par[0]];
      nav.appendChild(b);
    });
    return nav;
  }

  /* ---------- X1 · trilho (o escolhido) ---------- */
  function x1() {
    var r = el("div", "modelo"); r.id = "X1";
    var t = el("div", "tela");
    t.appendChild(trilhoNav());
    t.appendChild(cabecalho());

    var centro = el("div", "centro");
    [["Todo dia", TODO_DIA], ["Nossos sistemas", NOSSOS]].forEach(function (g) {
      var b = bloco(g[0], g[1].length + " sistemas");
      var apps = el("div", "apps");
      itens(g[1]).forEach(function (i) { apps.appendChild(appIcone(i)); });
      b.appendChild(apps);
      centro.appendChild(b);
    });
    var g = el("div", "bloco");
    g.style.flexDirection = "row";
    g.style.alignItems = "center";
    g.style.gap = "13px";
    var c = el("span", "ico ico--sigla", String(TOTAL - TODO_DIA.length - NOSSOS.length));
    c.style.width = "40px"; c.style.height = "40px"; c.style.fontSize = "14px";
    g.appendChild(c);
    var gt = el("div");
    gt.appendChild(el("div", "bloco__t", "Órgãos, impostos e consultas"));
    gt.appendChild(el("div", "pen__q", "Receita, SEFAZ, eSocial, juntas, prefeituras"));
    g.appendChild(gt);
    centro.appendChild(g);

    var ba = bloco("Agenda do mês", "setembro");
    ba.style.flex = "1";
    var ag = el("div", "agenda");
    PRAZOS.forEach(function (p) { ag.appendChild(prazoCartao(p)); });
    ba.appendChild(ag);
    centro.appendChild(ba);
    t.appendChild(centro);

    var lado = el("div", "lado");
    var lc = el("div", "bloco__cab");
    lc.appendChild(el("span", "bloco__t", "Minhas pendências"));
    lc.appendChild(el("span", "bloco__n", "5 abertas"));
    lado.appendChild(lc);
    PENDENCIAS.slice(0, 5).forEach(function (p) { lado.appendChild(penCartao(p)); });
    var la = el("div", "bloco__cab");
    la.style.marginTop = "22px";
    la.appendChild(el("span", "bloco__t", "Avisos"));
    lado.appendChild(la);
    (typeof AVISOS !== "undefined" ? AVISOS : []).forEach(function (a) { lado.appendChild(avisoCartao(a)); });
    t.appendChild(lado);

    r.appendChild(t);
    return r;
  }

  /* ---------- X2 · trabalho primeiro ---------- */
  function x2() {
    var r = el("div", "modelo"); r.id = "X2";
    var t = el("div", "tela");
    t.appendChild(cabecalho());

    var barra = el("div", "barra");
    itens(TODO_DIA.concat(NOSSOS)).forEach(function (i) {
      var a = ancora(i, "atalho");
      a.title = i.nome;
      a.appendChild(icone(i));
      barra.appendChild(a);
    });
    barra.appendChild(el("span", "barra__mais", "+ " + (TOTAL - TODO_DIA.length - NOSSOS.length) + " sistemas"));
    t.appendChild(barra);

    var miolo = el("div", "miolo");
    var esq = el("div", "col");
    var b = bloco("O que você tem para fazer", PENDENCIAS.length + " abertas");
    var rolo = el("div", "rolo");
    PENDENCIAS.forEach(function (p) { rolo.appendChild(penCartao(p, true)); });
    b.appendChild(rolo);
    esq.appendChild(b);
    miolo.appendChild(esq);

    var dir = el("div", "col");
    var ba = bloco("Agenda do mês", "setembro");
    var ra = el("div", "rolo");
    var ag = el("div");
    ag.style.display = "grid";
    ag.style.gap = "7px";
    PRAZOS.forEach(function (p) { ag.appendChild(prazoCartao(p)); });
    ra.appendChild(ag);
    ba.appendChild(ra);
    dir.appendChild(ba);

    var bv = bloco("Avisos");
    (typeof AVISOS !== "undefined" ? AVISOS : []).forEach(function (a) { bv.appendChild(avisoCartao(a)); });
    dir.appendChild(bv);
    miolo.appendChild(dir);

    t.appendChild(miolo);
    r.appendChild(t);
    return r;
  }

  /* ---------- X3 · quadro de setores ---------- */
  function x3() {
    var r = el("div", "modelo"); r.id = "X3";
    var t = el("div", "tela");
    t.appendChild(cabecalho());

    var q = el("div", "quadro");
    SETORES_CASA.forEach(function (nome) {
      var doSetor = PENDENCIAS.filter(function (p) { return p.setor === nome; });
      var atrasadas = doSetor.filter(function (p) { return p.e === "atrasada"; }).length;

      var col = el("div", "coluna");
      var cc = el("div", "coluna__cab");
      cc.appendChild(el("span", "coluna__t", nome));
      cc.appendChild(el("span", "coluna__n" + (atrasadas ? " coluna__n--quente" : ""), String(doSetor.length)));
      col.appendChild(cc);

      var rolo = el("div", "coluna__rolo");
      if (!doSetor.length) {
        var vazio = el("div", "pen__q", "Nada pendente");
        vazio.style.padding = "10px 3px";
        rolo.appendChild(vazio);
      }
      doSetor.forEach(function (p) { rolo.appendChild(penCartao(p)); });
      col.appendChild(rolo);
      q.appendChild(col);
    });
    t.appendChild(q);
    r.appendChild(t);
    return r;
  }

  /* ---------- X4 · quatro quadrantes ---------- */
  function x4() {
    var r = el("div", "modelo"); r.id = "X4";
    var t = el("div", "tela");
    t.appendChild(cabecalho());

    var q = el("div", "quatro");

    var b1 = bloco("Sistemas", TOTAL + " no Hub");
    var r1 = el("div", "rolo");
    var apps = el("div", "apps");
    itens(TODO_DIA.concat(NOSSOS)).forEach(function (i) { apps.appendChild(appIcone(i)); });
    r1.appendChild(apps);
    b1.appendChild(r1);
    q.appendChild(b1);

    var b2 = bloco("Minhas pendências", PENDENCIAS.length + " abertas");
    var r2 = el("div", "rolo");
    PENDENCIAS.forEach(function (p) { r2.appendChild(penCartao(p)); });
    b2.appendChild(r2);
    q.appendChild(b2);

    var b3 = bloco("Agenda do mês", "setembro");
    var r3 = el("div", "rolo");
    var ag = el("div", "agenda");
    PRAZOS.forEach(function (p) { ag.appendChild(prazoCartao(p)); });
    r3.appendChild(ag);
    b3.appendChild(r3);
    q.appendChild(b3);

    var b4 = bloco("Avisos");
    var r4 = el("div", "rolo");
    (typeof AVISOS !== "undefined" ? AVISOS : []).forEach(function (a) { r4.appendChild(avisoCartao(a)); });
    b4.appendChild(r4);
    q.appendChild(b4);

    t.appendChild(q);
    r.appendChild(t);
    return r;
  }

  /* ---------- X5 · começa com uma pergunta ---------- */
  function x5() {
    var r = el("div", "modelo"); r.id = "X5";
    var t = el("div", "tela");

    var fp = el("div", "faixa-pen");
    fp.appendChild(el("span", "fp__t", "Suas pendências"));
    PENDENCIAS.slice(0, 4).forEach(function (p, i) {
      if (i) fp.appendChild(el("span", "fp__sep"));
      var x = el("span", "fp__i");
      x.appendChild(el("span", "fp__d" + (p.e === "atrasada" ? " fp__d--atraso" : ""), p.d + "/" + p.m));
      x.appendChild(document.createTextNode(p.o));
      fp.appendChild(x);
    });
    t.appendChild(fp);
    t.appendChild(cabecalho());

    var centro = el("div", "centro");
    var caixa = el("div", "caixa");
    var dt = new Date();
    var h = dt.getHours();
    caixa.appendChild(el("div", "ola", (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite") + ", Hesley"));
    caixa.appendChild(el("div", "sub", "O que você quer abrir?"));

    var busca = el("div", "busca");
    var lupa = document.createElement("div");
    lupa.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
                     'stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
    busca.appendChild(lupa.firstChild);
    var campo = document.createElement("input");
    campo.type = "text";
    campo.placeholder = "Digite o nome do sistema…";
    busca.appendChild(campo);
    caixa.appendChild(busca);

    var favoritos = el("div", "favoritos");
    itens(TODO_DIA.slice(0, 7)).forEach(function (i) { favoritos.appendChild(appIcone(i)); });
    caixa.appendChild(favoritos);

    var res = el("div", "resultados");
    res.style.display = "none";
    caixa.appendChild(res);

    campo.addEventListener("input", function () {
      var termo = campo.value.trim().toLowerCase();
      res.textContent = "";
      if (termo.length < 2) { res.style.display = "none"; favoritos.style.display = ""; return; }
      favoritos.style.display = "none";
      res.style.display = "grid";
      TODOS.filter(function (i) { return i.nome.toLowerCase().indexOf(termo) !== -1; })
           .forEach(function (i) {
             var a = ancora(i, "res");
             a.appendChild(icone(i));
             a.appendChild(el("span", "res__n", i.nome));
             res.appendChild(a);
           });
    });

    centro.appendChild(caixa);
    t.appendChild(centro);
    r.appendChild(t);
    return r;
  }

  var X = [
    { id:"X1", nome:"Trilho (o atual)" },
    { id:"X2", nome:"Trabalho primeiro" },
    { id:"X3", nome:"Quadro de setores" },
    { id:"X4", nome:"Quatro quadrantes" },
    { id:"X5", nome:"Começa com busca" },
  ];

  var palco = document.getElementById("palco");
  [x1(), x2(), x3(), x4(), x5()].forEach(function (m) { palco.appendChild(m); });

  var botoes = document.getElementById("botoes");
  X.forEach(function (x, i) {
    var b = el("button", "opcao", (i + 1) + " · " + x.nome);
    b.type = "button";
    b.dataset.x = x.id;
    b.addEventListener("click", function () { mostrar(x.id); });
    botoes.appendChild(b);
  });

  function mostrar(id) {
    Array.prototype.forEach.call(document.querySelectorAll(".modelo"), function (m) {
      m.classList.toggle("ativo", m.id === id);
    });
    Array.prototype.forEach.call(botoes.children, function (b) {
      b.setAttribute("aria-pressed", b.dataset.x === id ? "true" : "false");
    });
    location.hash = id;
  }

  var pedido = (location.hash || "").slice(1).toUpperCase();
  mostrar(X.some(function (x) { return x.id === pedido; }) ? pedido : "X1");

})();
