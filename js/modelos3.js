/* ============================================================
   Rodada 3 — descartável, sai depois da escolha.

   Os três modelos usam EXATAMENTE as mesmas peças (sistema sem
   cartão, pendência em linha, recado em ponto). O que muda entre
   eles é só onde cada zona fica e como ela se separa das outras.
   Assim a escolha é sobre organização, não sobre enfeite.
   ============================================================ */

(function () {
  "use strict";

  var LOGOS_IDX = (typeof LOGOS !== "undefined") ? LOGOS : {};

  var PENDENCIAS = [
    { dia:"28", mes:"ago", oque:"Enviar balancete da Gigantte",      quem:"Fiscal pediu para o Contábil", estado:"atrasada" },
    { dia:"01", mes:"set", oque:"Conferir rescisão do J C de Lira",  quem:"Pessoal pediu para você",      estado:"hoje" },
    { dia:"01", mes:"set", oque:"Retificar SPED da Braz",            quem:"Você pediu para o Fiscal",     estado:"hoje" },
    { dia:"04", mes:"set", oque:"Documentos da abertura da Domum",   quem:"Legalização pediu para você",  estado:"" },
    { dia:"09", mes:"set", oque:"Fechar cartões da Varejista",       quem:"Você pediu para o Contábil",   estado:"" },
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

  /* ---------- peças ---------- */

  function sistema(item) {
    var a = document.createElement("a");
    a.className = "sis";
    a.href = item.url || "#";
    if (item.url) { a.target = "_blank"; a.rel = "noopener noreferrer"; }

    var arq = item.logo || LOGOS_IDX[apelido(item.nome)];
    var ico = el("span", "sis__ico");
    if (arq) {
      var img = document.createElement("img");
      img.src = "assets/logos/" + arq;
      img.alt = "";
      img.addEventListener("error", function () {
        ico.classList.add("sis__ico--sigla");
        ico.textContent = sigla(item);
      });
      ico.appendChild(img);
    } else {
      ico.classList.add("sis__ico--sigla");
      ico.textContent = sigla(item);
    }
    a.appendChild(ico);
    a.appendChild(el("span", "sis__nome", item.nome));
    return a;
  }

  /* O que se usa todo dia vira grade de ícone. Os órgãos, não:
     eles são 25 endereços que ninguém abre de manhã, e dar a
     eles o mesmo ícone de 46px dos principais empurrava as
     pendências para baixo da dobra — o secundário ocupando o
     lugar do principal. Viram uma tira de pastilhas miúdas, tudo
     na mesma linha, sob um rótulo só. */
  function gruposDeSistemas() {
    var frag = document.createDocumentFragment();

    SETORES.filter(function (s) { return s.estilo !== "gaveta"; }).forEach(function (setor) {
      var g = el("div", "grupo");
      g.appendChild(el("div", "grupo__rot", setor.titulo));
      var grade = el("div", "sistemas");
      setor.itens.forEach(function (item) { grade.appendChild(sistema(item)); });
      g.appendChild(grade);
      frag.appendChild(g);
    });

    var orgaos = SETORES.filter(function (s) { return s.estilo === "gaveta"; });
    if (orgaos.length) {
      var g = el("div", "grupo");
      g.appendChild(el("div", "grupo__rot", "Órgãos e consultas"));
      var tira = el("div", "tira");
      orgaos.forEach(function (setor) {
        setor.itens.forEach(function (item) { tira.appendChild(pastilha(item)); });
      });
      g.appendChild(tira);
      frag.appendChild(g);
    }

    return frag;
  }

  function pastilha(item) {
    var a = document.createElement("a");
    a.className = "past";
    a.href = item.url || "#";
    if (item.url) { a.target = "_blank"; a.rel = "noopener noreferrer"; }

    var arq = item.logo || LOGOS_IDX[apelido(item.nome)];
    var ico = el("span", "past__ico");
    if (arq) {
      var img = document.createElement("img");
      img.src = "assets/logos/" + arq;
      img.alt = "";
      img.addEventListener("error", function () {
        ico.classList.add("past__ico--sigla");
        ico.textContent = sigla(item);
      });
      ico.appendChild(img);
    } else {
      ico.classList.add("past__ico--sigla");
      ico.textContent = sigla(item);
    }
    a.appendChild(ico);
    a.appendChild(el("span", "past__nome", item.nome));
    return a;
  }

  function pendencias() {
    var frag = document.createDocumentFragment();
    PENDENCIAS.forEach(function (p) {
      var d = el("div", "pen" + (p.estado ? " pen--" + p.estado : ""));
      var prazo = el("div", "pen__prazo");
      prazo.appendChild(el("div", "pen__dia", p.dia));
      prazo.appendChild(el("div", "pen__mes", p.mes));
      d.appendChild(prazo);
      var t = el("div");
      t.appendChild(el("div", "pen__oque", p.oque));
      t.appendChild(el("div", "pen__quem", p.quem));
      d.appendChild(t);
      frag.appendChild(d);
    });
    return frag;
  }

  function recados() {
    var frag = document.createDocumentFragment();
    (typeof AVISOS !== "undefined" ? AVISOS : []).forEach(function (a) {
      var r = el("div", "rec");
      r.appendChild(el("span", "rec__p"));
      var t = el("div");
      t.appendChild(el("span", "rec__t", a.titulo + " "));
      t.appendChild(el("span", "rec__x", a.texto || ""));
      r.appendChild(t);
      frag.appendChild(r);
    });
    return frag;
  }

  function cabecalho() {
    var c = el("div", "cab");
    var logo = document.createElement("img");
    logo.className = "cab__logo";
    logo.src = "assets/logo-hub-escuro.png";
    logo.alt = "Hub Totali";
    c.appendChild(logo);

    var ola = el("div", "cab__ola");
    ola.appendChild(document.createTextNode("Boa tarde, "));
    ola.appendChild(el("b", null, "Hesley"));
    c.appendChild(ola);

    var rel = el("div", "cab__rel");
    var d = new Date();
    rel.appendChild(el("div", "cab__hora",
      ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2)));
    var data = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    rel.appendChild(el("div", "cab__data", data.charAt(0).toUpperCase() + data.slice(1)));
    c.appendChild(rel);
    return c;
  }

  /* ---------- R1 · Trilho ---------- */
  function r1() {
    var r = el("div", "modelo"); r.id = "R1";
    r.appendChild(cabecalho());

    var corpo = el("div", "corpo");
    var area = el("div", "area");
    area.appendChild(gruposDeSistemas());
    corpo.appendChild(area);

    var trilho = el("div", "trilho");
    trilho.appendChild(el("div", "trilho__t", "Minhas pendências"));
    trilho.appendChild(el("div", "trilho__n", "1 atrasada · 2 para hoje"));
    trilho.appendChild(pendencias());
    corpo.appendChild(trilho);

    r.appendChild(corpo);

    var rod = el("div", "rodape");
    rod.appendChild(recados());
    r.appendChild(rod);
    return r;
  }

  /* ---------- R2 · Faixas ---------- */
  function r2() {
    var r = el("div", "modelo"); r.id = "R2";
    r.appendChild(cabecalho());

    var fs = el("div", "faixa faixa--sis");
    fs.appendChild(gruposDeSistemas());
    r.appendChild(fs);

    var fp = el("div", "faixa faixa--pen");
    fp.appendChild(el("div", "faixa__t", "Minhas pendências"));
    fp.appendChild(el("div", "faixa__n", "1 atrasada · 2 para hoje"));
    var caixa = el("div", "pendencias");
    caixa.appendChild(pendencias());
    fp.appendChild(caixa);
    r.appendChild(fp);

    var fr = el("div", "faixa faixa--rec");
    var lista = el("div", "recados");
    lista.appendChild(recados());
    fr.appendChild(lista);
    r.appendChild(fr);
    return r;
  }

  /* ---------- R3 · Duas telas ---------- */
  function r3() {
    var r = el("div", "modelo"); r.id = "R3";
    r.appendChild(cabecalho());

    var faixaRec = el("div", "faixa-rec");
    faixaRec.appendChild(recados());
    r.appendChild(faixaRec);

    var abas = el("div", "abas");
    var aSis = el("button", "aba on", "Sistemas");
    var aPen = el("button", "aba");
    aPen.appendChild(document.createTextNode("Pendências"));
    aPen.appendChild(el("span", "aba__n", String(PENDENCIAS.length)));
    abas.appendChild(aSis); abas.appendChild(aPen);
    r.appendChild(abas);

    var tSis = el("div", "tela on");
    tSis.appendChild(gruposDeSistemas());
    r.appendChild(tSis);

    var tPen = el("div", "tela");
    var caixa = el("div", "pendencias");
    caixa.appendChild(pendencias());
    tPen.appendChild(caixa);
    r.appendChild(tPen);

    function trocar(paraSistemas) {
      aSis.classList.toggle("on", paraSistemas);
      aPen.classList.toggle("on", !paraSistemas);
      tSis.classList.toggle("on", paraSistemas);
      tPen.classList.toggle("on", !paraSistemas);
    }
    aSis.addEventListener("click", function () { trocar(true); });
    aPen.addEventListener("click", function () { trocar(false); });

    return r;
  }

  /* ---------- montagem ---------- */
  var palco = document.getElementById("palco");
  [r1(), r2(), r3()].forEach(function (m) { palco.appendChild(m); });

  var MODELOS = [
    { id: "R1", nome: "Trilho" },
    { id: "R2", nome: "Faixas" },
    { id: "R3", nome: "Duas telas" },
  ];

  var botoes = document.getElementById("botoes");
  MODELOS.forEach(function (m, i) {
    var b = el("button", "opcao", (i + 1) + " · " + m.nome);
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

  mostrar((location.hash || "#R1").slice(1).toUpperCase() || "R1");

})();
