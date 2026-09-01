/* ============================================================
   Rodada 4 — descartável.
   Cinco peles sobre o mesmo esqueleto (o Trilho). O código
   desenha a tela UMA vez e a repete com uma classe de tema
   diferente: se o desenho fosse diferente em cada uma, a
   comparação não seria justa.
   ============================================================ */

(function () {
  "use strict";

  var LOGOS_IDX = (typeof LOGOS !== "undefined") ? LOGOS : {};

  var TEMAS = [
    { classe: "t-noite",     nome: "Noite",     nota: "a que você aprovou, afinada", fundo: "#0a0e16" },
    { classe: "t-claro",     nome: "Claro",     nota: "branco no chão, cinza no trilho", fundo: "#ffffff" },
    { classe: "t-contraste", nome: "Contraste", nota: "chão branco, trilho azul-noite", fundo: "#ffffff" },
    { classe: "t-papel",     nome: "Papel",     nota: "marfim em vez de branco puro", fundo: "#faf8f3" },
    { classe: "t-ardosia",   nome: "Ardósia",   nota: "chão cinza, trilho branco", fundo: "#eef1f6" },
  ];

  var PENDENCIAS = [
    { dia:"28", mes:"ago", oque:"Enviar balancete da Gigantte",     quem:"Fiscal pediu para o Contábil", estado:"atrasada" },
    { dia:"01", mes:"set", oque:"Conferir rescisão do J C de Lira", quem:"Pessoal pediu para você",      estado:"hoje" },
    { dia:"01", mes:"set", oque:"Retificar SPED da Braz",           quem:"Você pediu para o Fiscal",     estado:"hoje" },
    { dia:"04", mes:"set", oque:"Documentos da abertura da Domum",  quem:"Legalização pediu para você",  estado:"" },
    { dia:"09", mes:"set", oque:"Fechar cartões da Varejista",      quem:"Você pediu para o Financeiro", estado:"" },
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

  function comIcone(item, base) {
    var arq = item.logo || LOGOS_IDX[apelido(item.nome)];
    var ico = el("span", base + "__ico");
    if (arq) {
      var img = document.createElement("img");
      img.src = "assets/logos/" + arq;
      img.alt = "";
      img.addEventListener("error", function () {
        ico.classList.add(base + "__ico--sigla");
        ico.textContent = sigla(item);
      });
      ico.appendChild(img);
    } else {
      ico.classList.add(base + "__ico--sigla");
      ico.textContent = sigla(item);
    }
    return ico;
  }

  function link(item, classe) {
    var a = document.createElement("a");
    a.className = classe;
    a.href = item.url || "#";
    if (item.url) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    return a;
  }

  function sistema(item) {
    var a = link(item, "sis");
    a.appendChild(comIcone(item, "sis"));
    a.appendChild(el("span", "sis__nome", item.nome));
    return a;
  }

  function pastilha(item) {
    var a = link(item, "past");
    a.appendChild(comIcone(item, "past"));
    a.appendChild(el("span", "past__nome", item.nome));
    return a;
  }

  function gruposDeSistemas() {
    var frag = document.createDocumentFragment();

    SETORES.filter(function (s) { return s.estilo !== "gaveta"; }).forEach(function (setor) {
      var g = el("div", "grupo");
      g.appendChild(el("div", "grupo__rot", setor.titulo));
      var grade = el("div", "sistemas");
      setor.itens.forEach(function (i) { grade.appendChild(sistema(i)); });
      g.appendChild(grade);
      frag.appendChild(g);
    });

    var orgaos = SETORES.filter(function (s) { return s.estilo === "gaveta"; });
    if (orgaos.length) {
      var g = el("div", "grupo");
      g.appendChild(el("div", "grupo__rot", "Órgãos e consultas"));
      var tira = el("div", "tira");
      orgaos.forEach(function (s) { s.itens.forEach(function (i) { tira.appendChild(pastilha(i)); }); });
      g.appendChild(tira);
      frag.appendChild(g);
    }
    return frag;
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

  function tela(tema) {
    var r = el("div", "modelo " + tema.classe);
    r.id = tema.classe;

    var cab = el("div", "cab");
    var logo = el("div", "cab__logo");
    logo.setAttribute("role", "img");
    logo.setAttribute("aria-label", "Hub Totali");
    cab.appendChild(logo);
    var ola = el("div", "cab__ola");
    ola.appendChild(document.createTextNode("Boa tarde, "));
    ola.appendChild(el("b", null, "Hesley"));
    cab.appendChild(ola);
    var rel = el("div", "cab__rel");
    var d = new Date();
    rel.appendChild(el("div", "cab__hora",
      ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2)));
    var data = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    rel.appendChild(el("div", "cab__data", data.charAt(0).toUpperCase() + data.slice(1)));
    cab.appendChild(rel);
    r.appendChild(cab);

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

  var palco = document.getElementById("palco");
  TEMAS.forEach(function (t) { palco.appendChild(tela(t)); });

  var botoes = document.getElementById("botoes");
  TEMAS.forEach(function (t, i) {
    var b = el("button", "opcao", (i + 1) + " · " + t.nome);
    b.type = "button";
    b.title = t.nota;
    b.dataset.tema = t.classe;
    b.addEventListener("click", function () { mostrar(t.classe); });
    botoes.appendChild(b);
  });

  function mostrar(classe) {
    Array.prototype.forEach.call(document.querySelectorAll(".modelo"), function (m) {
      m.classList.toggle("ativo", m.id === classe);
    });
    Array.prototype.forEach.call(botoes.children, function (b) {
      b.setAttribute("aria-pressed", b.dataset.tema === classe ? "true" : "false");
    });
    /* O corpo da página acompanha o tema: sem isso, abaixo do
       conteúdo aparece uma faixa escura que não é de tema nenhum. */
    var t = TEMAS.filter(function (x) { return x.classe === classe; })[0];
    if (t) document.body.style.background = t.fundo;
    location.hash = classe;
  }

  var pedido = (location.hash || "").slice(1);
  mostrar(TEMAS.some(function (t) { return t.classe === pedido; }) ? pedido : "t-noite");

})();
