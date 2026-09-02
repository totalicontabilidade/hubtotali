/* ============================================================
   Hub Totali · prévia do desenho aprovado
   ------------------------------------------------------------
   Se passar na conferência, este arquivo vira o js/app.js do Hub
   de verdade — com a lista vindo do banco em vez da semente, e
   as pendências vindo do Firestore em vez da lista de exemplo
   aqui embaixo.

   As pendências e os prazos abaixo são inventados, de propósito
   cobrindo os três estados que a tela precisa saber mostrar:
   atrasada, para hoje, e com folga.
   ============================================================ */

(function () {
  "use strict";

  var LOGOS_IDX = (typeof LOGOS !== "undefined") ? LOGOS : {};
  var PASTA_LOGOS = "assets/logos/";

  /* ---------- o que fica à vista ----------
     O corte entre "visto" e "guardado" não é por importância do
     sistema, é por FREQUÊNCIA. O Bombeiros SE é importantíssimo
     no dia em que precisa; esse dia não é hoje. */
  var GRUPOS = [
    { rot:"Todo dia", nomes:["Confi Tarefas","Confi Chat","Gmail","Google Drive",
                             "Google Agenda","WhatsApp Web","Econet","Claude"] },
    { rot:"Nossos sistemas", nomes:["Portal do Cliente","Painel da Equipe",
                                    "Atos Societários","GeRescisão"] },
  ];

  var PRAZOS = [
    { d:"02", n:"DCTFWeb",                q:"competência ago",     e:"hoje" },
    { d:"07", n:"FGTS · Conectividade",   q:"todos os clientes",   e:"perto" },
    { d:"15", n:"eSocial e FGTS Digital", q:"fechamento da folha", e:"perto" },
    { d:"20", n:"DAS do Simples",         q:"todos os optantes",   e:"" },
    { d:"20", n:"INSS e IRRF",            q:"retenções",           e:"" },
    { d:"25", n:"PIS e COFINS",           q:"lucro presumido",     e:"" },
  ];

  var PENDENCIAS = [
    { d:"28", m:"ago", o:"Enviar balancete da Gigantte",     q:"Fiscal pediu para o Contábil",   e:"atrasada" },
    { d:"29", m:"ago", o:"Retificar a GFIP da ITWEB",        q:"Diretoria pediu para o Pessoal", e:"atrasada" },
    { d:"02", m:"set", o:"Conferir rescisão do J C de Lira", q:"Pessoal pediu para você",        e:"hoje" },
    { d:"02", m:"set", o:"Retificar SPED da Braz",           q:"Você pediu para o Fiscal",       e:"hoje" },
    { d:"04", m:"set", o:"Documentos da abertura da Domum",  q:"Legalização pediu para você",    e:"" },
    { d:"09", m:"set", o:"Fechar cartões da Varejista",      q:"Você pediu para o Financeiro",   e:"" },
    { d:"11", m:"set", o:"Conferir o DAS da Central Net",    q:"Gerência pediu para o Fiscal",   e:"" },
  ];

  var QUEM = "Hesley";

  /* ---------- utilidades ---------- */

  function el(t, c, x) {
    var e = document.createElement(t);
    if (c) e.className = c;
    if (x !== undefined && x !== null) e.textContent = x;
    return e;
  }

  function apelido(n) {
    return String(n).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function sigla(item) {
    if (item.sigla) return String(item.sigla);
    var nome = String(item.nome);
    var ligacao = ["de","do","da","dos","das","e"];
    var p = nome.split(/[\s·/·-]+/).filter(function (x) {
      return x && ligacao.indexOf(x.toLowerCase()) === -1;
    });
    if (!p.length) p = nome.split(/\s+/);
    if (p.length > 1) return p[0].charAt(0) + p[1].charAt(0);
    var u = p[0];
    var interna = u.slice(1).match(/[A-ZÁÉÍÓÚÃÕÂÊÔÇ]/);
    if (/[a-z]/.test(u) && interna) return u.charAt(0) + interna[0];
    if (u.length <= 4 && u === u.toUpperCase()) return u;
    return u.substring(0, 2);
  }

  function enderecoSeguro(url) {
    if (typeof url !== "string" || !url.trim()) return "";
    try {
      var u = new URL(url, window.location.href);
      return (u.protocol === "http:" || u.protocol === "https:") ? u.href : "";
    } catch (e) { return ""; }
  }

  function icone(item) {
    var arq = item.logo || LOGOS_IDX[apelido(item.nome)];
    var caixa = el("span", "ico");
    if (item.logoDados || arq) {
      var img = document.createElement("img");
      img.src = item.logoDados || (PASTA_LOGOS + arq);
      img.alt = "";
      img.decoding = "async";
      img.addEventListener("error", function () {
        caixa.classList.add("ico--sigla");
        caixa.textContent = sigla(item);
      });
      caixa.appendChild(img);
    } else {
      caixa.classList.add("ico--sigla");
      caixa.textContent = sigla(item);
    }
    return caixa;
  }

  function item(i) {
    var url = enderecoSeguro(i.url);
    var a = document.createElement(url ? "a" : "div");
    a.className = "item";
    if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; }
    a.appendChild(icone(i));
    var t = el("div", "item__txt");
    t.appendChild(el("div", "item__n", i.nome));
    if (i.nota) t.appendChild(el("div", "item__x", i.nota));
    a.appendChild(t);
    return a;
  }

  function bloco(titulo, conta, cresce) {
    var b = el("div", "bloco" + (cresce ? " bloco--cresce" : ""));
    var c = el("div", "bloco__cab");
    c.appendChild(el("span", "bloco__t", titulo));
    if (conta !== undefined && conta !== null) c.appendChild(el("span", "bloco__n", String(conta)));
    b.appendChild(c);
    return b;
  }

  /* ---------- índice dos sistemas ---------- */
  var PORNOME = {}, TOTAL = 0, RESTO = [];
  SETORES.forEach(function (s) {
    (s.itens || []).forEach(function (i) { PORNOME[i.nome] = i; TOTAL++; });
  });
  function itens(nomes) { return nomes.map(function (n) { return PORNOME[n]; }).filter(Boolean); }

  (function () {
    var visto = {};
    GRUPOS.forEach(function (g) { g.nomes.forEach(function (n) { visto[n] = true; }); });
    SETORES.forEach(function (s) {
      var faltantes = (s.itens || []).filter(function (i) { return !visto[i.nome]; });
      if (faltantes.length) RESTO.push({ rot: s.titulo, itens: faltantes });
    });
  })();

  /* ---------- centro ---------- */
  function desenharCentro() {
    var centro = document.getElementById("centro");
    centro.textContent = "";

    GRUPOS.forEach(function (g) {
      var b = bloco(g.rot, g.nomes.length);
      var grade = el("div", "grade");
      itens(g.nomes).forEach(function (i) { grade.appendChild(item(i)); });
      b.appendChild(grade);
      centro.appendChild(b);
    });

    var quantos = RESTO.reduce(function (n, g) { return n + g.itens.length; }, 0);
    var gav = el("button", "gaveta");
    gav.type = "button";
    gav.appendChild(el("span", "gaveta__c", String(quantos)));
    var t = el("div");
    t.appendChild(el("div", "gaveta__t", "Órgãos, impostos e consultas"));
    t.appendChild(el("div", "gaveta__s", "Receita, SEFAZ, eSocial, juntas, prefeituras e certificados"));
    gav.appendChild(t);
    gav.appendChild(el("span", "gaveta__seta", "›"));
    gav.addEventListener("click", abrirPainel);
    centro.appendChild(gav);

    var ba = bloco("Agenda do mês", null, true);
    ba.querySelector(".bloco__cab").appendChild(el("span", "bloco__n",
      new Date().toLocaleDateString("pt-BR", { month: "long" })));
    var ag = el("div", "agenda");
    PRAZOS.forEach(function (p) {
      var x = el("div", "prazo" + (p.e ? " prazo--" + p.e : ""));
      x.appendChild(el("div", "prazo__d", p.d));
      x.appendChild(el("div", "prazo__n", p.n));
      x.appendChild(el("div", "prazo__q", p.q));
      ag.appendChild(x);
    });
    ba.appendChild(ag);
    centro.appendChild(ba);
  }

  /* ---------- pendências ---------- */
  function desenharPendencias() {
    var alvo = document.getElementById("pendencias");
    alvo.textContent = "";

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
      alvo.appendChild(f);
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
        alvo.appendChild(x);
      });
    });
  }

  /* ---------- avisos ---------- */
  function desenharAvisos() {
    var alvo = document.getElementById("avisos");
    alvo.textContent = "";
    var lista = (typeof AVISOS !== "undefined") ? AVISOS : [];
    if (!lista.length) { alvo.hidden = true; return; }

    alvo.appendChild(el("span", "avisos__rot", "Avisos"));
    lista.slice(0, 3).forEach(function (a, i) {
      if (i) alvo.appendChild(el("span", "av__sep"));
      var x = el("span", "av");
      x.appendChild(el("span", "av__p"));
      x.appendChild(el("span", "av__t", a.titulo));
      if (a.texto) x.appendChild(el("span", "av__x", a.texto));
      alvo.appendChild(x);
    });
    if (lista.length > 3) alvo.appendChild(el("span", "avisos__mais", "+ " + (lista.length - 3)));
  }

  /* ---------- painel dos órgãos ---------- */
  var painel = document.getElementById("painel");

  function abrirPainel() {
    var corpo = document.getElementById("painel-corpo");
    corpo.textContent = "";
    RESTO.forEach(function (g) {
      var b = el("div", "painel__g");
      b.appendChild(el("span", "painel__rot", g.rot));
      var grade = el("div", "grade");
      g.itens.forEach(function (i) { grade.appendChild(item(i)); });
      b.appendChild(grade);
      corpo.appendChild(b);
    });
    painel.classList.add("on");
    document.getElementById("painel-x").focus();
  }
  function fecharPainel() { painel.classList.remove("on"); }

  document.getElementById("painel-x").addEventListener("click", fecharPainel);
  painel.addEventListener("click", function (ev) { if (ev.target === painel) fecharPainel(); });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") fecharPainel();
  });

  /* ---------- relógio e saudação ---------- */
  function desenharTopo() {
    var hora = document.getElementById("hora");
    var data = document.getElementById("data");
    var ola  = document.getElementById("ola");
    var res  = document.getElementById("resumo");
    var diaDesenhado = null;

    function dois(n) { return n < 10 ? "0" + n : String(n); }

    function bater() {
      var agora = new Date();
      hora.textContent = dois(agora.getHours()) + ":" + dois(agora.getMinutes());

      var hoje = agora.toDateString();
      if (hoje !== diaDesenhado) {
        diaDesenhado = hoje;
        data.textContent = agora.toLocaleDateString("pt-BR",
          { weekday: "short", day: "2-digit", month: "short" });
        var h = agora.getHours();
        ola.textContent = (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite") + ", " + QUEM;
      }
    }

    bater();
    /* O mostrador é de minutos: acerto o passo com o virar do
       minuto e daí bato de minuto em minuto. Um despertar por
       minuto em vez de sessenta — numa página que fica aberta o
       dia inteiro, isso é bateria de notebook. */
    var agora = new Date();
    window.setTimeout(function () {
      bater();
      window.setInterval(bater, 60000);
    }, (60 - agora.getSeconds()) * 1000 - agora.getMilliseconds());

    var atrasadas = PENDENCIAS.filter(function (p) { return p.e === "atrasada"; }).length;
    var deHoje    = PENDENCIAS.filter(function (p) { return p.e === "hoje"; }).length;
    res.textContent = "";
    if (atrasadas) {
      res.appendChild(el("b", null, atrasadas + (atrasadas > 1 ? " atrasadas" : " atrasada")));
      res.appendChild(document.createTextNode(" · " + deHoje + " para hoje"));
    } else {
      res.appendChild(document.createTextNode(deHoje + " para hoje"));
    }
  }

  /* ---------- início ---------- */
  desenharTopo();
  desenharCentro();
  desenharPendencias();
  desenharAvisos();

})();
