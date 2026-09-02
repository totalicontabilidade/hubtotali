/* ============================================================
   Rodada 6 — descartável.
   Quatro caminhos com as três correções pedidas. Os aplicativos
   ficam em colunas (a arrumação 1, que agradou) nos quatro, para
   a comparação isolar o que mudou: o peso das pendências.
   ============================================================ */

(function () {
  "use strict";

  var LOGOS_IDX = (typeof LOGOS !== "undefined") ? LOGOS : {};

  var PENDENCIAS = [
    { dia:"28", mes:"ago", oque:"Enviar balancete da Gigantte",     quem:"Fiscal pediu para o Contábil", sel:"Atrasada", estado:"atrasada" },
    { dia:"02", mes:"set", oque:"Conferir rescisão do J C de Lira", quem:"Pessoal pediu para você",      sel:"Hoje",     estado:"hoje" },
    { dia:"02", mes:"set", oque:"Retificar SPED da Braz",           quem:"Você pediu para o Fiscal",     sel:"Hoje",     estado:"hoje" },
    { dia:"04", mes:"set", oque:"Documentos da abertura da Domum",  quem:"Legalização pediu para você",  sel:"",         estado:"" },
    { dia:"09", mes:"set", oque:"Fechar cartões da Varejista",      quem:"Você pediu para o Financeiro", sel:"",         estado:"" },
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
        ico.classList.add("ico--sigla"); ico.textContent = sigla(item);
      });
      ico.appendChild(img);
    } else {
      ico.classList.add("ico--sigla"); ico.textContent = sigla(item);
    }
    return ico;
  }

  function item(i) {
    var a = document.createElement("a");
    a.className = "item";
    a.href = i.url || "#";
    if (i.url) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    a.appendChild(icone(i));
    a.appendChild(el("span", "item__n", i.nome));
    return a;
  }

  function colunasDeApps() {
    var c = el("div", "colunas-apps");
    SETORES.forEach(function (s) {
      var col = el("div");
      col.appendChild(el("div", "rot col__rot", s.titulo));
      s.itens.forEach(function (i) { col.appendChild(item(i)); });
      c.appendChild(col);
    });
    return c;
  }

  function pendencia(p) {
    var d = el("div", "pen" + (p.estado ? " pen--" + p.estado : ""));
    d.appendChild(el("span", "pen__faixa"));
    var prazo = el("div", "pen__prazo");
    prazo.appendChild(el("div", "pen__dia", p.dia));
    prazo.appendChild(el("div", "pen__mes", p.mes));
    d.appendChild(prazo);
    var t = el("div");
    t.appendChild(el("div", "pen__oque", p.oque));
    t.appendChild(el("div", "pen__quem", p.quem));
    d.appendChild(t);
    if (p.sel) d.appendChild(el("span", "pen__sel", p.sel));
    return d;
  }

  function listaPendencias() {
    var f = document.createDocumentFragment();
    PENDENCIAS.forEach(function (p) { f.appendChild(pendencia(p)); });
    return f;
  }

  function listaAvisos() {
    var f = document.createDocumentFragment();
    (typeof AVISOS !== "undefined" ? AVISOS : []).forEach(function (a) {
      var d = el("div", "aviso");
      d.appendChild(el("span", "aviso__p"));
      var t = el("div");
      t.appendChild(el("div", "aviso__t", a.titulo));
      if (a.texto) t.appendChild(el("div", "aviso__x", a.texto));
      d.appendChild(t);
      f.appendChild(d);
    });
    return f;
  }

  function cabecaDeZona(titulo, nota, destaque) {
    var c = el("div", "zona__cab");
    c.appendChild(el("div", "zona__t", titulo));
    var n = el("div", "zona__n");
    if (destaque) { n.appendChild(el("b", null, destaque)); n.appendChild(document.createTextNode(" " + nota)); }
    else n.textContent = nota;
    c.appendChild(n);
    return c;
  }

  /* ---------- cabeçalho: marca à mostra + saudação no relógio ---------- */
  function cabecalho() {
    var c = el("div", "cab");

    var marca = el("div", "marca");
    var img = document.createElement("img");
    img.className = "marca__img";
    img.src = "assets/logo-hub.png";
    img.alt = "Hub Totali";
    marca.appendChild(img);
    c.appendChild(marca);

    var agora = el("div", "agora");
    var d = new Date();
    var bloco = el("div");
    bloco.appendChild(el("div", "agora__hora",
      ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2)));
    var data = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    bloco.appendChild(el("div", "agora__data", data.charAt(0).toUpperCase() + data.slice(1)));
    agora.appendChild(bloco);

    agora.appendChild(el("span", "agora__risco"));

    var lado = el("div");
    var hora = d.getHours();
    lado.appendChild(el("div", "agora__ola",
      (hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite") + ", Hesley"));
    var nota = el("div", "agora__nota");
    nota.appendChild(el("b", null, "1 atrasada"));
    nota.appendChild(document.createTextNode(" · 2 para hoje"));
    lado.appendChild(nota);
    agora.appendChild(lado);

    c.appendChild(agora);
    return c;
  }

  /* ---------- M1 · Trilho largo ---------- */
  function m1() {
    var r = el("div", "modelo"); r.id = "M1";
    r.appendChild(cabecalho());
    var corpo = el("div", "corpo");
    var area = el("div", "area");
    area.appendChild(colunasDeApps());
    corpo.appendChild(area);

    var trilho = el("div", "trilho");
    trilho.appendChild(cabecaDeZona("Minhas pendências", "atrasada · 2 para hoje", "1"));
    trilho.appendChild(listaPendencias());
    var ca = el("div", "zona__cab");
    ca.style.marginTop = "26px";
    ca.appendChild(el("div", "zona__t", "Avisos"));
    trilho.appendChild(ca);
    trilho.appendChild(listaAvisos());
    corpo.appendChild(trilho);

    r.appendChild(corpo);
    return r;
  }

  /* ---------- M2 · Faixa de comando ---------- */
  function m2() {
    var r = el("div", "modelo"); r.id = "M2";
    r.appendChild(cabecalho());

    var faixa = el("div", "faixa");
    var duas = el("div", "duas");
    var esq = el("div");
    esq.appendChild(cabecaDeZona("Minhas pendências", "atrasada · 2 para hoje", "1"));
    esq.appendChild(listaPendencias());
    duas.appendChild(esq);
    var dir = el("div");
    dir.appendChild(cabecaDeZona("Avisos", "da diretoria e prazos do mês"));
    dir.appendChild(listaAvisos());
    duas.appendChild(dir);
    faixa.appendChild(duas);
    r.appendChild(faixa);

    var area = el("div", "area");
    area.appendChild(colunasDeApps());
    r.appendChild(area);
    return r;
  }

  /* ---------- M3 · Dois terços ---------- */
  function m3() {
    var r = el("div", "modelo"); r.id = "M3";
    r.appendChild(cabecalho());
    var corpo = el("div", "corpo");
    var area = el("div", "area");
    area.appendChild(colunasDeApps());
    corpo.appendChild(area);

    var lado = el("div", "lado");
    lado.appendChild(cabecaDeZona("Minhas pendências", "atrasada · 2 para hoje", "1"));
    lado.appendChild(listaPendencias());
    var ca = el("div", "zona__cab");
    ca.style.marginTop = "28px";
    ca.appendChild(el("div", "zona__t", "Avisos"));
    lado.appendChild(ca);
    lado.appendChild(listaAvisos());
    corpo.appendChild(lado);

    r.appendChild(corpo);
    return r;
  }

  /* ---------- M4 · Pendências primeiro ---------- */
  function m4() {
    var r = el("div", "modelo"); r.id = "M4";
    r.appendChild(cabecalho());

    var topo = el("div", "topo-pen");
    topo.appendChild(cabecaDeZona("Minhas pendências", "atrasada · 2 para hoje", "1"));
    var grade = el("div", "grade-pen");
    grade.appendChild(listaPendencias());
    topo.appendChild(grade);
    var linha = el("div", "avisos-linha");
    linha.appendChild(listaAvisos());
    topo.appendChild(linha);
    r.appendChild(topo);

    var apps = el("div", "apps");
    apps.appendChild(colunasDeApps());
    r.appendChild(apps);
    return r;
  }

  var MODELOS = [
    { id: "M1", nome: "Trilho largo",        montar: m1 },
    { id: "M2", nome: "Faixa de comando",    montar: m2 },
    { id: "M3", nome: "Dois terços",         montar: m3 },
    { id: "M4", nome: "Pendências primeiro", montar: m4 },
  ];

  var palco = document.getElementById("palco");
  MODELOS.forEach(function (m) { palco.appendChild(m.montar()); });

  var botoes = document.getElementById("botoes");
  MODELOS.forEach(function (m, i) {
    var b = el("button", "opcao", (i + 1) + " · " + m.nome);
    b.type = "button";
    b.dataset.m = m.id;
    b.addEventListener("click", function () { mostrar(m.id); });
    botoes.appendChild(b);
  });

  function mostrar(id) {
    Array.prototype.forEach.call(document.querySelectorAll(".modelo"), function (m) {
      m.classList.toggle("ativo", m.id === id);
    });
    Array.prototype.forEach.call(botoes.children, function (b) {
      b.setAttribute("aria-pressed", b.dataset.m === id ? "true" : "false");
    });
    location.hash = id;
  }

  var pedido = (location.hash || "").slice(1).toUpperCase();
  mostrar(MODELOS.some(function (m) { return m.id === pedido; }) ? pedido : "M1");

})();
