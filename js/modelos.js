/* ============================================================
   Página de escolha do visual — descartável.
   Desenha os MESMOS sistemas em quatro linguagens visuais, para
   a comparação ser justa: mesma quantidade de coisa na tela,
   mesmos nomes, mesmos logos. Só muda a forma.
   ============================================================ */

(function () {
  "use strict";

  var LOGOS_IDX = (typeof LOGOS !== "undefined") ? LOGOS : {};

  var MODELOS = [
    { id: "A", nome: "Bento escuro",   nota: "blocos de tamanhos diferentes, o importante ocupa mais" },
    { id: "B", nome: "Vidro",          nota: "vidro fosco sobre luz colorida — a linguagem “liquid glass”" },
    { id: "C", nome: "Lançador",       nota: "só ícone grande e nome, como a tela inicial do celular" },
    { id: "D", nome: "Claro tecnológico", nota: "tela clara, sem moldura nenhuma, faixa escura no topo" },
  ];

  function apelido(nome) {
    return String(nome).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function sigla(item) {
    if (item.sigla) return item.sigla;
    var p = String(item.nome).split(/[\s·/-]+/).filter(function (x) {
      return x && ["de","do","da","dos","das","e"].indexOf(x.toLowerCase()) === -1;
    });
    if (p.length > 1) return (p[0][0] + p[1][0]).toUpperCase();
    var u = p[0] || "?";
    var interna = u.slice(1).match(/[A-Z]/);
    if (/[a-z]/.test(u) && interna) return (u[0] + interna[0]).toUpperCase();
    return u.slice(0, 2).toUpperCase();
  }

  function el(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto != null) e.textContent = texto;
    return e;
  }

  function icone(item, classeBase) {
    var arquivo = item.logo || LOGOS_IDX[apelido(item.nome)];
    var caixa = el("span", classeBase + "__icone");
    if (arquivo) {
      var img = document.createElement("img");
      img.src = "assets/logos/" + arquivo;
      img.alt = "";
      img.addEventListener("error", function () {
        caixa.classList.add(classeBase + "__icone--sigla");
        caixa.textContent = sigla(item);
      });
      caixa.appendChild(img);
    } else {
      caixa.classList.add(classeBase + "__icone--sigla");
      caixa.textContent = sigla(item);
    }
    return caixa;
  }

  function agora() {
    var d = new Date();
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }

  function dataEscrita() {
    var d = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    return d.charAt(0).toUpperCase() + d.slice(1);
  }

  function topo(comHoraForte, claro) {
    var t = el("div", "topo");
    var logo = document.createElement("img");
    logo.className = "logo";
    logo.src = claro ? "assets/logo-hub.png" : "assets/logo-hub-escuro.png";
    logo.alt = "Hub Totali";
    t.appendChild(logo);
    var h = el("div", "hora");
    if (comHoraForte) {
      h.appendChild(el("b", null, agora()));
      h.appendChild(document.createTextNode("  ·  " + dataEscrita()));
    } else {
      h.textContent = agora() + "  ·  " + dataEscrita();
    }
    t.appendChild(h);
    return t;
  }

  /* Separo as duas camadas uma vez só: cartão e gaveta. */
  var cartoes = SETORES.filter(function (s) { return s.estilo !== "gaveta"; });
  var gavetas = SETORES.filter(function (s) { return s.estilo === "gaveta"; });

  function listaDeApps(itens, classeBase) {
    var caixa = el("div", "apps");
    itens.forEach(function (item) {
      var a = document.createElement("a");
      a.className = "app";
      a.href = item.url || "#";
      if (item.url) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      a.appendChild(icone(item, "app"));
      if (classeBase === "C") {
        a.appendChild(el("span", "app__nome", item.nome));
      } else {
        var txt = el("div", "app__texto");
        txt.appendChild(el("div", "app__nome", item.nome));
        if (item.nota) txt.appendChild(el("div", "app__nota", item.nota));
        a.appendChild(txt);
      }
      caixa.appendChild(a);
    });
    return caixa;
  }

  /* ---------- A · Bento ---------- */
  function modeloA() {
    var raiz = el("div", "modelo"); raiz.id = "A";
    raiz.appendChild(topo(true));

    var bento = el("div", "bento");

    var mapa = ["bloco--principal", "bloco--nossos", "bloco--dia"];
    cartoes.forEach(function (setor, i) {
      var b = el("div", "bloco " + (mapa[i] || "bloco--dia"));
      b.appendChild(el("div", "bloco__titulo", setor.titulo));
      b.appendChild(listaDeApps(setor.itens, "A"));
      bento.appendChild(b);
    });

    var bg = el("div", "bloco bloco--gavetas");
    bg.appendChild(el("div", "bloco__titulo", "Órgãos e consultas"));
    gavetas.forEach(function (setor) {
      var g = el("div", "gaveta");
      g.appendChild(el("span", "gaveta__nome", setor.titulo));
      g.appendChild(el("span", "gaveta__conta", String(setor.itens.length)));
      bg.appendChild(g);
    });
    bento.appendChild(bg);

    var br = el("div", "bloco bloco--recados");
    br.appendChild(el("div", "bloco__titulo", "Recados e prazos"));
    (typeof AVISOS !== "undefined" ? AVISOS : []).forEach(function (av) {
      var r = el("div", "recado");
      r.appendChild(el("span", "recado__ponto"));
      var d = el("div");
      d.appendChild(el("div", "recado__t", av.titulo));
      d.appendChild(el("div", "recado__x", av.texto || ""));
      r.appendChild(d);
      br.appendChild(r);
    });
    bento.appendChild(br);

    raiz.appendChild(bento);
    return raiz;
  }

  /* ---------- B, C, D · empilhados por setor ---------- */
  function modeloEmpilhado(id) {
    var raiz = el("div", "modelo"); raiz.id = id;
    raiz.appendChild(topo(false, id === "D"));

    /* No D, a primeira faixa é escura: é o que dá o contraste de
       "produto" numa tela clara, sem precisar de moldura. */
    cartoes.forEach(function (setor, i) {
      var s = el("div", "secao" + (id === "D" && i === 0 ? " primeiro" : ""));
      s.appendChild(el("div", "secao__titulo", setor.titulo));
      s.appendChild(listaDeApps(setor.itens, id));
      raiz.appendChild(s);
    });

    var sg = el("div", "secao");
    sg.appendChild(el("div", "secao__titulo", "Órgãos e consultas"));
    var caixa = el("div", "gavetas");
    gavetas.forEach(function (setor) {
      var g = el("div", "gaveta");
      g.appendChild(document.createTextNode(setor.titulo));
      g.appendChild(el("span", "gaveta__conta", String(setor.itens.length)));
      caixa.appendChild(g);
    });
    sg.appendChild(caixa);
    raiz.appendChild(sg);

    return raiz;
  }

  /* ---------- Montagem ---------- */
  var palco = document.getElementById("palco");
  palco.appendChild(modeloA());
  palco.appendChild(modeloEmpilhado("B"));
  palco.appendChild(modeloEmpilhado("C"));
  palco.appendChild(modeloEmpilhado("D"));

  var botoes = document.getElementById("botoes");
  MODELOS.forEach(function (m) {
    var b = el("button", "opcao", m.id + " · " + m.nome);
    b.type = "button";
    b.title = m.nota;
    b.addEventListener("click", function () { mostrar(m.id); });
    b.dataset.modelo = m.id;
    botoes.appendChild(b);
  });

  function mostrar(id) {
    Array.prototype.forEach.call(document.querySelectorAll(".modelo"), function (m) {
      m.classList.toggle("ativo", m.id === id);
    });
    Array.prototype.forEach.call(botoes.children, function (b) {
      b.setAttribute("aria-pressed", b.dataset.modelo === id ? "true" : "false");
    });
    /* O fundo da página acompanha o modelo, senão sobra uma
       faixa escura embaixo do modelo claro. */
    document.body.style.background = id === "D" ? "#f2f5fa" : "#0a0f1a";
    location.hash = id;
  }

  mostrar((location.hash || "#A").slice(1).toUpperCase());

})();
