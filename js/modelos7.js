/* ============================================================
   Rodada 7 — descartável.

   Cinco arrumações dentro do Trilho largo. Três delas (A, B, E)
   usam um REAGRUPAMENTO POR TAREFA em vez de por departamento —
   é a proposta que a pesquisa sugeriu, e está escrita abaixo
   para você discordar item a item se quiser.
   ============================================================ */

(function () {
  "use strict";

  var LOGOS_IDX = (typeof LOGOS !== "undefined") ? LOGOS : {};

  /* ---------- reagrupamento por tarefa ----------
     A pergunta que cada rótulo responde não é "de que setor é
     este sistema", e sim "o que eu vim fazer aqui". Os nomes
     saíram assim de propósito: verbo ou objeto do trabalho, não
     nome de departamento. Mude à vontade — é uma proposta. */
  var POR_TAREFA = [
    { rot: "Todo dia",           sub: "O que fica aberto",
      nomes: ["Confi Tarefas","Confi Chat","Gmail","Google Drive","Google Agenda","WhatsApp Web","Econet","Claude"] },
    { rot: "Nossos sistemas",    sub: "Feitos aqui dentro",
      nomes: ["Portal do Cliente","Painel da Equipe","Atos Societários","GeRescisão"] },
    { rot: "Impostos e notas",   sub: "Guias, declarações e NF",
      nomes: ["e-CAC","Simples Nacional","SEFAZ Sergipe","Portal da NF-e","NFS-e Nacional","SPED","Consulta CNPJ"] },
    { rot: "Pessoas e folha",    sub: "Admissão, FGTS e rescisão",
      nomes: ["eSocial","FGTS Digital","Conectividade Social","Novo CAGED","Meu INSS","Mediador · CCT"] },
    { rot: "Abrir e regularizar", sub: "Empresa, alvará e certificado",
      nomes: ["JUCESE","REGIN","Redesim","Pref. Aracaju","Pref. Itabaiana","Bombeiros SE","Gov.br","MEI","Soluti","CFC","Banese","Busca CEP"] },
  ];

  var PENDENCIAS = [
    { dia:"28", mes:"ago", oque:"Enviar balancete da Gigantte",     quem:"Fiscal pediu para o Contábil", sel:"Atrasada", estado:"atrasada" },
    { dia:"02", mes:"set", oque:"Conferir rescisão do J C de Lira", quem:"Pessoal pediu para você",      sel:"Hoje",     estado:"hoje" },
    { dia:"02", mes:"set", oque:"Retificar SPED da Braz",           quem:"Você pediu para o Fiscal",     sel:"Hoje",     estado:"hoje" },
    { dia:"04", mes:"set", oque:"Documentos da abertura da Domum",  quem:"Legalização pediu para você",  sel:"",         estado:"" },
    { dia:"09", mes:"set", oque:"Fechar cartões da Varejista",      quem:"Você pediu para o Financeiro", sel:"",         estado:"" },
  ];

  /* ---------- utilidades ---------- */

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

  function ancora(item, classe) {
    var a = document.createElement("a");
    a.className = classe;
    a.href = item.url || "#";
    if (item.url) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    return a;
  }

  /* Índice nome → item, para o reagrupamento achar cada sistema
     sem depender da ordem em que ele aparece nos setores. */
  var PORNOME = {};
  var TODOS = [];
  SETORES.forEach(function (s) {
    (s.itens || []).forEach(function (i) {
      PORNOME[i.nome] = i;
      TODOS.push({ item: i, setor: s.titulo });
    });
  });

  /* Grupos por tarefa, já resolvidos em itens de verdade. Um
     nome que não bate com nenhum sistema é ignorado em silêncio
     — assim a lista acima pode ser editada sem quebrar a tela. */
  var TAREFAS = POR_TAREFA.map(function (g) {
    return {
      rot: g.rot, sub: g.sub,
      itens: g.nomes.map(function (n) { return PORNOME[n]; }).filter(Boolean),
    };
  });

  /* O que sobrou de fora do reagrupamento entra num grupo final,
     para nenhum sistema sumir da tela por descuido meu. */
  (function () {
    var dentro = {};
    TAREFAS.forEach(function (g) { g.itens.forEach(function (i) { dentro[i.nome] = true; }); });
    var fora = TODOS.filter(function (x) { return !dentro[x.item.nome]; }).map(function (x) { return x.item; });
    if (fora.length) TAREFAS.push({ rot: "Outros", sub: "Ainda sem grupo", itens: fora });
  })();

  /* ---------- A · coleções por tarefa ---------- */
  function a() {
    var c = el("div", "quadros");
    TAREFAS.forEach(function (g) {
      var q = el("div", "quadro");
      q.appendChild(el("div", "rot quadro__rot", g.rot));
      q.appendChild(el("div", "quadro__sub", g.sub));
      var grade = el("div", "grade");
      g.itens.forEach(function (i) {
        var x = ancora(i, "app");
        x.appendChild(icone(i));
        x.appendChild(el("span", "app__n", i.nome));
        grade.appendChild(x);
      });
      q.appendChild(grade);
      c.appendChild(q);
    });
    return c;
  }

  /* ---------- B · fila de hoje + armário ---------- */
  function b() {
    var c = el("div");
    var doDia = TAREFAS[0].itens.concat(TAREFAS[1].itens).slice(0, 10);

    var fila = el("div", "fila");
    doDia.forEach(function (i) {
      var x = ancora(i, "destaque");
      x.appendChild(icone(i));
      x.appendChild(el("span", "destaque__n", i.nome));
      fila.appendChild(x);
    });
    c.appendChild(fila);

    var arm = el("div", "armario");
    arm.appendChild(el("div", "rot", "Armário — o resto, por assunto"));
    var cols = el("div", "colunas");
    TAREFAS.slice(2).forEach(function (g) {
      var col = el("div");
      col.appendChild(el("div", "rot col__rot", g.rot));
      g.itens.forEach(function (i) {
        var l = ancora(i, "linha");
        l.textContent = i.nome;
        col.appendChild(l);
      });
      cols.appendChild(col);
    });
    arm.appendChild(cols);
    c.appendChild(arm);
    return c;
  }

  /* ---------- C · menu de restaurante ---------- */
  function c_() {
    var c = el("div", "cardapio");
    SETORES.forEach(function (s) {
      var sec = el("div", "secao");
      var rot = el("div", "secao__rot");
      rot.appendChild(el("span", "rot", s.titulo));
      sec.appendChild(rot);
      s.itens.forEach(function (i) {
        var l = ancora(i, "linha");
        l.appendChild(icone(i));
        l.appendChild(el("span", "linha__n", i.nome));
        sec.appendChild(l);
      });
      c.appendChild(sec);
    });
    return c;
  }

  /* ---------- D · uma grade só, com filtro ---------- */
  function d() {
    var c = el("div");

    var barra = el("div", "barra");
    var busca = el("div", "busca");
    var lupa = document.createElement("span");
    lupa.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
                     'stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
    busca.appendChild(lupa.firstChild);
    var campo = document.createElement("input");
    campo.type = "text";
    campo.placeholder = "Buscar sistema…";
    busca.appendChild(campo);
    barra.appendChild(busca);

    var atual = "Tudo";
    var grade = el("div", "grade");

    function pintar() {
      grade.textContent = "";
      var termo = campo.value.trim().toLowerCase();
      var achou = 0;
      TODOS.forEach(function (x) {
        if (atual !== "Tudo" && x.setor !== atual) return;
        if (termo && x.item.nome.toLowerCase().indexOf(termo) === -1) return;
        var a2 = ancora(x.item, "app");
        a2.appendChild(icone(x.item));
        a2.appendChild(el("span", "app__n", x.item.nome));
        grade.appendChild(a2);
        achou++;
      });
      if (!achou) grade.appendChild(el("div", "nada", "Nenhum sistema com esse nome."));
    }

    ["Tudo"].concat(SETORES.map(function (s) { return s.titulo; })).forEach(function (n) {
      var f = el("button", "filtro" + (n === "Tudo" ? " on" : ""), n);
      f.type = "button";
      f.addEventListener("click", function () {
        atual = n;
        Array.prototype.forEach.call(barra.querySelectorAll(".filtro"), function (o) { o.classList.remove("on"); });
        f.classList.add("on");
        pintar();
      });
      barra.appendChild(f);
    });
    campo.addEventListener("input", pintar);

    c.appendChild(barra);
    c.appendChild(grade);
    pintar();
    return c;
  }

  /* ---------- E · por tarefa, em linhas largas ---------- */
  function e() {
    var c = el("div");
    TAREFAS.forEach(function (g) {
      var f = el("div", "faixa");
      var esq = el("div", "faixa__esq");
      esq.appendChild(el("div", "rot", g.rot));
      esq.appendChild(el("div", "faixa__sub", g.sub));
      f.appendChild(esq);
      var fila = el("div", "fila");
      g.itens.forEach(function (i) {
        var x = ancora(i, "app");
        x.appendChild(icone(i));
        x.appendChild(el("span", "app__n", i.nome));
        fila.appendChild(x);
      });
      f.appendChild(fila);
      c.appendChild(f);
    });
    return c;
  }

  /* ---------- o quadro ---------- */
  function tela(id, conteudo) {
    var r = el("div", "modelo"); r.id = id;

    var cab = el("div", "cab");
    var img = document.createElement("img");
    img.className = "marca__img";
    img.src = "assets/logo-hub.png";
    img.alt = "Hub Totali";
    cab.appendChild(img);

    var agora = el("div", "agora");
    var dt = new Date();
    var bloco = el("div");
    bloco.appendChild(el("div", "agora__hora",
      ("0" + dt.getHours()).slice(-2) + ":" + ("0" + dt.getMinutes()).slice(-2)));
    var data = dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    bloco.appendChild(el("div", "agora__data", data.charAt(0).toUpperCase() + data.slice(1)));
    agora.appendChild(bloco);
    agora.appendChild(el("span", "agora__risco"));
    var lado = el("div");
    var h = dt.getHours();
    lado.appendChild(el("div", "agora__ola",
      (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite") + ", Hesley"));
    var nota = el("div", "agora__nota");
    nota.appendChild(el("b", null, "1 atrasada"));
    nota.appendChild(document.createTextNode(" · 2 para hoje"));
    lado.appendChild(nota);
    agora.appendChild(lado);
    cab.appendChild(agora);
    r.appendChild(cab);

    var corpo = el("div", "corpo");
    var area = el("div", "area");
    area.appendChild(conteudo);
    corpo.appendChild(area);

    var trilho = el("div", "trilho");
    var zc = el("div", "zona__cab");
    zc.appendChild(el("div", "zona__t", "Minhas pendências"));
    var zn = el("div", "zona__n");
    zn.appendChild(el("b", null, "1 atrasada"));
    zn.appendChild(document.createTextNode(" · 2 para hoje"));
    zc.appendChild(zn);
    trilho.appendChild(zc);

    PENDENCIAS.forEach(function (p) {
      var x = el("div", "pen" + (p.estado ? " pen--" + p.estado : ""));
      x.appendChild(el("span", "pen__faixa"));
      var prazo = el("div", "pen__prazo");
      prazo.appendChild(el("div", "pen__dia", p.dia));
      prazo.appendChild(el("div", "pen__mes", p.mes));
      x.appendChild(prazo);
      var t = el("div");
      t.appendChild(el("div", "pen__oque", p.oque));
      t.appendChild(el("div", "pen__quem", p.quem));
      x.appendChild(t);
      if (p.sel) x.appendChild(el("span", "pen__sel", p.sel));
      trilho.appendChild(x);
    });

    var ca = el("div", "zona__cab");
    ca.style.marginTop = "26px";
    ca.appendChild(el("div", "zona__t", "Avisos"));
    trilho.appendChild(ca);
    (typeof AVISOS !== "undefined" ? AVISOS : []).forEach(function (av) {
      var x = el("div", "aviso");
      x.appendChild(el("span", "aviso__p"));
      var t = el("div");
      t.appendChild(el("div", "aviso__t", av.titulo));
      if (av.texto) t.appendChild(el("div", "aviso__x", av.texto));
      x.appendChild(t);
      trilho.appendChild(x);
    });

    corpo.appendChild(trilho);
    r.appendChild(corpo);
    return r;
  }

  var ARR = [
    { id: "A", nome: "Coleções por tarefa", montar: a },
    { id: "B", nome: "Fila de hoje + armário", montar: b },
    { id: "C", nome: "Menu de restaurante", montar: c_ },
    { id: "D", nome: "Uma grade só, com filtro", montar: d },
    { id: "E", nome: "Tarefa em linhas largas", montar: e },
  ];

  var palco = document.getElementById("palco");
  ARR.forEach(function (x) { palco.appendChild(tela(x.id, x.montar())); });

  var botoes = document.getElementById("botoes");
  ARR.forEach(function (x, i) {
    var b2 = el("button", "opcao", (i + 1) + " · " + x.nome);
    b2.type = "button";
    b2.dataset.a = x.id;
    b2.addEventListener("click", function () { mostrar(x.id); });
    botoes.appendChild(b2);
  });

  function mostrar(id) {
    Array.prototype.forEach.call(document.querySelectorAll(".modelo"), function (m) {
      m.classList.toggle("ativo", m.id === id);
    });
    Array.prototype.forEach.call(botoes.children, function (b2) {
      b2.setAttribute("aria-pressed", b2.dataset.a === id ? "true" : "false");
    });
    location.hash = id;
  }

  var pedido = (location.hash || "").slice(1).toUpperCase();
  mostrar(ARR.some(function (x) { return x.id === pedido; }) ? pedido : "A");

})();
