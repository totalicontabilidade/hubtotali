/* ============================================================
   Rodada 5 — descartável.
   Cinco arrumações para a área dos aplicativos. Pele e estrutura
   idênticas nas cinco, para a comparação isolar a única coisa em
   questão: como os sistemas se organizam.
   ============================================================ */

(function () {
  "use strict";

  var LOGOS_IDX = (typeof LOGOS !== "undefined") ? LOGOS : {};

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

  function icone(item) {
    var arq = item.logo || LOGOS_IDX[apelido(item.nome)];
    var ico = el("span", "ico");
    if (arq) {
      var img = document.createElement("img");
      img.src = "assets/logos/" + arq;
      img.alt = "";
      img.addEventListener("error", function () {
        ico.classList.add("ico--sigla");
        ico.textContent = sigla(item);
      });
      ico.appendChild(img);
    } else {
      ico.classList.add("ico--sigla");
      ico.textContent = sigla(item);
    }
    return ico;
  }

  function ancora(item, classe) {
    var a = document.createElement("a");
    a.className = classe;
    a.href = item.url || "#";
    if (item.url) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    return a;
  }

  /* linha: ícone pequeno ao lado do nome */
  function emLinha(item) {
    var a = ancora(item, "item");
    a.appendChild(icone(item));
    a.appendChild(el("span", "item__n", item.nome));
    return a;
  }

  /* empilhado: ícone em cima, nome embaixo */
  function empilhado(item) {
    var a = ancora(item, "item");
    a.appendChild(icone(item));
    a.appendChild(el("span", "item__n", item.nome));
    return a;
  }

  var diarios = SETORES.filter(function (s) { return s.estilo !== "gaveta"; });
  var orgaos  = SETORES.filter(function (s) { return s.estilo === "gaveta"; });
  var todos   = SETORES.reduce(function (acc, s) {
    (s.itens || []).forEach(function (i) { acc.push({ item: i, setor: s.titulo }); });
    return acc;
  }, []);

  /* ---------- O1 · Colunas ---------- */
  function o1() {
    var a = el("div", "colunas");
    SETORES.forEach(function (s) {
      var c = el("div", "col");
      c.appendChild(el("div", "rot col__rot", s.titulo));
      s.itens.forEach(function (i) { c.appendChild(emLinha(i)); });
      a.appendChild(c);
    });
    return a;
  }

  /* ---------- O2 · Grade ancorada ---------- */
  function o2() {
    var a = el("div");
    SETORES.forEach(function (s) {
      var l = el("div", "linha");
      l.appendChild(el("div", "rot", s.titulo));
      var g = el("div", "grade");
      s.itens.forEach(function (i) { g.appendChild(empilhado(i)); });
      l.appendChild(g);
      a.appendChild(l);
    });
    return a;
  }

  /* ---------- O3 · Primeira fila ---------- */
  function o3() {
    var a = el("div");

    /* Os oito da primeira fila: tudo de "Principais" e "Nossos
       sistemas", completado com o começo do "Do dia a dia". */
    var destaque = [];
    diarios.forEach(function (s) { s.itens.forEach(function (i) { destaque.push(i); }); });
    destaque = destaque.slice(0, 8);

    var fila = el("div", "fila");
    destaque.forEach(function (i) {
      var g = ancora(i, "grande");
      g.appendChild(icone(i));
      var t = el("div");
      t.appendChild(el("div", "grande__n", i.nome));
      if (i.nota) t.appendChild(el("div", "grande__x", i.nota));
      g.appendChild(t);
      fila.appendChild(g);
    });
    a.appendChild(fila);

    var resto = el("div", "resto");
    var jaEntrou = destaque.slice();
    SETORES.forEach(function (s) {
      var faltantes = s.itens.filter(function (i) { return jaEntrou.indexOf(i) === -1; });
      if (!faltantes.length) return;
      var c = el("div", "col");
      c.appendChild(el("div", "rot col__rot", s.titulo));
      faltantes.forEach(function (i) { c.appendChild(emLinha(i)); });
      resto.appendChild(c);
    });
    a.appendChild(resto);
    return a;
  }

  /* ---------- O4 · Busca ---------- */
  function o4() {
    var a = el("div");

    var busca = el("div", "busca");
    var lupa = document.createElement("span");
    lupa.className = "busca__i";
    lupa.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
                     'stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
    busca.appendChild(lupa);
    var campo = document.createElement("input");
    campo.type = "text";
    campo.placeholder = "Buscar sistema…";
    busca.appendChild(campo);
    a.appendChild(busca);
    a.appendChild(el("div", "busca__d", "Digite duas letras e aperte Enter para abrir o primeiro"));

    var filtros = el("div", "filtros");
    var atual = "Tudo";
    var nomes = ["Tudo"].concat(SETORES.map(function (s) { return s.titulo; }));
    var grade = el("div", "grade");

    function pintar() {
      grade.textContent = "";
      var termo = campo.value.trim().toLowerCase();
      todos.forEach(function (x) {
        if (atual !== "Tudo" && x.setor !== atual) return;
        if (termo && x.item.nome.toLowerCase().indexOf(termo) === -1) return;
        grade.appendChild(emLinha(x.item));
      });
    }

    nomes.forEach(function (n) {
      var b = el("button", "filtro" + (n === "Tudo" ? " on" : ""), n);
      b.type = "button";
      b.addEventListener("click", function () {
        atual = n;
        Array.prototype.forEach.call(filtros.children, function (o) { o.classList.remove("on"); });
        b.classList.add("on");
        pintar();
      });
      filtros.appendChild(b);
    });
    campo.addEventListener("input", pintar);

    a.appendChild(filtros);
    a.appendChild(grade);
    pintar();
    return a;
  }

  /* ---------- O5 · Tabuleiro ---------- */
  function o5() {
    var a = el("div", "tabuleiro");
    diarios.forEach(function (s) {
      var q = el("div", "quadro");
      q.appendChild(el("div", "rot col__rot", s.titulo));
      var g = el("div", "grade");
      s.itens.forEach(function (i) { g.appendChild(empilhado(i)); });
      q.appendChild(g);
      a.appendChild(q);
    });

    if (orgaos.length) {
      var q = el("div", "quadro quadro--largo");
      q.appendChild(el("div", "rot col__rot", "Órgãos e consultas"));
      var tira = el("div", "tira");
      orgaos.forEach(function (s) {
        s.itens.forEach(function (i) {
          var p = ancora(i, "past");
          p.appendChild(icone(i));
          p.appendChild(el("span", "past__n", i.nome));
          tira.appendChild(p);
        });
      });
      q.appendChild(tira);
      a.appendChild(q);
    }
    return a;
  }

  /* ---------- esqueleto ---------- */
  function tela(id, conteudo) {
    var r = el("div", "modelo"); r.id = id;

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
    area.appendChild(conteudo);
    corpo.appendChild(area);

    var trilho = el("div", "trilho");
    trilho.appendChild(el("div", "trilho__t", "Minhas pendências"));
    trilho.appendChild(el("div", "trilho__n", "1 atrasada · 2 para hoje"));
    PENDENCIAS.forEach(function (p) {
      var x = el("div", "pen" + (p.estado ? " pen--" + p.estado : ""));
      var prazo = el("div", "pen__prazo");
      prazo.appendChild(el("div", "pen__dia", p.dia));
      prazo.appendChild(el("div", "pen__mes", p.mes));
      x.appendChild(prazo);
      var t = el("div");
      t.appendChild(el("div", "pen__oque", p.oque));
      t.appendChild(el("div", "pen__quem", p.quem));
      x.appendChild(t);
      trilho.appendChild(x);
    });
    corpo.appendChild(trilho);
    r.appendChild(corpo);

    var rod = el("div", "rodape");
    (typeof AVISOS !== "undefined" ? AVISOS : []).forEach(function (av) {
      var rc = el("div", "rec");
      rc.appendChild(el("span", "rec__p"));
      var t = el("div");
      t.appendChild(el("span", "rec__t", av.titulo + " "));
      t.appendChild(el("span", "rec__x", av.texto || ""));
      rc.appendChild(t);
      rod.appendChild(rc);
    });
    r.appendChild(rod);

    return r;
  }

  var ARRUMACOES = [
    { id: "O1", nome: "Colunas",         montar: o1 },
    { id: "O2", nome: "Grade ancorada",  montar: o2 },
    { id: "O3", nome: "Primeira fila",   montar: o3 },
    { id: "O4", nome: "Busca",           montar: o4 },
    { id: "O5", nome: "Tabuleiro",       montar: o5 },
  ];

  var palco = document.getElementById("palco");
  ARRUMACOES.forEach(function (a) { palco.appendChild(tela(a.id, a.montar())); });

  var botoes = document.getElementById("botoes");
  ARRUMACOES.forEach(function (a, i) {
    var b = el("button", "opcao", (i + 1) + " · " + a.nome);
    b.type = "button";
    b.dataset.arr = a.id;
    b.addEventListener("click", function () { mostrar(a.id); });
    botoes.appendChild(b);
  });

  function mostrar(id) {
    Array.prototype.forEach.call(document.querySelectorAll(".modelo"), function (m) {
      m.classList.toggle("ativo", m.id === id);
    });
    Array.prototype.forEach.call(botoes.children, function (b) {
      b.setAttribute("aria-pressed", b.dataset.arr === id ? "true" : "false");
    });
    location.hash = id;
  }

  var pedido = (location.hash || "").slice(1).toUpperCase();
  mostrar(ARRUMACOES.some(function (a) { return a.id === pedido; }) ? pedido : "O1");

})();
