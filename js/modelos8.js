/* ============================================================
   Rodada 8 — descartável.

   Quatro doses de "esconder", da mais leve para a mais radical.
   O agrupamento por tarefa e o Trilho largo continuam iguais.
   ============================================================ */

(function () {
  "use strict";

  var LOGOS_IDX = (typeof LOGOS !== "undefined") ? LOGOS : {};

  /* ---------- o que fica à vista, e o que espera ----------
     Dentro de cada grupo, "vistos" é o que aparece de cara e
     "guardados" é o que espera atrás de um clique. O corte não
     é por importância do sistema — é por FREQUÊNCIA de uso.
     O Bombeiros SE é importantíssimo no dia em que precisa; só
     que esse dia não é hoje. */
  var GRUPOS = [
    { rot:"Todo dia", sub:"O que fica aberto",
      vistos:["Confi Tarefas","Confi Chat","Gmail","Google Drive","Google Agenda","WhatsApp Web","Econet","Claude"],
      guardados:[] },

    { rot:"Nossos sistemas", sub:"Feitos aqui dentro",
      vistos:["Portal do Cliente","Painel da Equipe","Atos Societários","GeRescisão"],
      guardados:[] },

    { rot:"Impostos e notas", sub:"Guias, declarações e NF",
      vistos:["e-CAC","Simples Nacional","SEFAZ Sergipe","SPED"],
      guardados:["Portal da NF-e","NFS-e Nacional","Consulta CNPJ"] },

    { rot:"Pessoas e folha", sub:"Admissão, FGTS e rescisão",
      vistos:["eSocial","FGTS Digital","Conectividade Social"],
      guardados:["Novo CAGED","Meu INSS","Mediador · CCT"] },

    { rot:"Abrir e regularizar", sub:"Empresa, alvará e certificado",
      vistos:["JUCESE","Redesim"],
      guardados:["REGIN","Pref. Aracaju","Pref. Itabaiana","Bombeiros SE","Gov.br","MEI","Soluti","CFC","Banese","Busca CEP"] },
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
      img.src = "assets/logos/" + arq; img.alt = "";
      img.addEventListener("error", function () {
        ico.classList.add("ico--sigla"); ico.textContent = sigla(item);
      });
      ico.appendChild(img);
    } else { ico.classList.add("ico--sigla"); ico.textContent = sigla(item); }
    return ico;
  }
  function ancora(item, classe) {
    var a = document.createElement("a");
    a.className = classe;
    a.href = item.url || "#";
    if (item.url) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    return a;
  }

  var PORNOME = {};
  SETORES.forEach(function (s) { (s.itens || []).forEach(function (i) { PORNOME[i.nome] = i; }); });
  function resolver(nomes) { return nomes.map(function (n) { return PORNOME[n]; }).filter(Boolean); }

  var G = GRUPOS.map(function (g) {
    return { rot: g.rot, sub: g.sub, vistos: resolver(g.vistos), guardados: resolver(g.guardados) };
  });

  function appIcone(i) {
    var a = ancora(i, "app");
    a.appendChild(icone(i));
    a.appendChild(el("span", "app__n", i.nome));
    return a;
  }
  function pastilha(i) {
    var a = ancora(i, "past");
    a.appendChild(icone(i));
    a.appendChild(el("span", "past__n", i.nome));
    return a;
  }

  /* ============================================================
     L1 · "+N" que abre ali mesmo
     O grupo mostra os frequentes e um botão com a conta do que
     falta. Clicou, os outros aparecem no mesmo lugar — sem
     mudar de tela, sem rolar, sem perder o contexto.
     ============================================================ */
  function l1() {
    var c = el("div", "quadros");
    G.forEach(function (g) {
      var q = el("div", "quadro");
      q.appendChild(el("div", "rot quadro__rot", g.rot));
      q.appendChild(el("div", "quadro__sub", g.sub));
      var grade = el("div", "grade");
      g.vistos.forEach(function (i) { grade.appendChild(appIcone(i)); });

      if (g.guardados.length) {
        var mais = el("button", "mais");
        mais.type = "button";
        var conta = el("span", "mais__c", "+" + g.guardados.length);
        mais.appendChild(conta);
        mais.appendChild(el("span", "mais__n", "mostrar"));
        mais.addEventListener("click", function () {
          grade.removeChild(mais);
          g.guardados.forEach(function (i) { grade.appendChild(appIcone(i)); });
        });
        grade.appendChild(mais);
      }
      q.appendChild(grade);
      c.appendChild(q);
    });
    return c;
  }

  /* ============================================================
     L2 · frequentes em ícone, raros em pastilha
     Tudo continua na tela, mas o que é raro perde o tamanho.
     Nada esconde e mesmo assim a tela alivia, porque o peso
     visual passa a acompanhar a frequência de uso.
     ============================================================ */
  function l2() {
    var c = el("div", "quadros");
    G.forEach(function (g) {
      var q = el("div", "quadro");
      q.appendChild(el("div", "rot quadro__rot", g.rot));
      q.appendChild(el("div", "quadro__sub", g.sub));
      var grade = el("div", "grade");
      g.vistos.forEach(function (i) { grade.appendChild(appIcone(i)); });
      q.appendChild(grade);
      if (g.guardados.length) {
        var tira = el("div", "tira");
        tira.style.marginTop = "14px";
        g.guardados.forEach(function (i) { tira.appendChild(pastilha(i)); });
        q.appendChild(tira);
      }
      c.appendChild(q);
    });
    return c;
  }

  /* ============================================================
     L3 · três quadros e uma gaveta
     Os dois grupos de todo dia ficam em quadro. Todo o resto —
     19 endereços de órgão e consulta — vira UMA linha que abre
     um painel por cima. É a tela mais vazia que dá para ter sem
     perder link nenhum.
     ============================================================ */
  function l3() {
    var c = el("div");
    var quadros = el("div", "quadros");
    G.slice(0, 2).forEach(function (g) {
      var q = el("div", "quadro");
      q.appendChild(el("div", "rot quadro__rot", g.rot));
      q.appendChild(el("div", "quadro__sub", g.sub));
      var grade = el("div", "grade");
      g.vistos.forEach(function (i) { grade.appendChild(appIcone(i)); });
      q.appendChild(grade);
      quadros.appendChild(q);
    });
    c.appendChild(quadros);

    var resto = G.slice(2);
    var quantos = resto.reduce(function (n, g) { return n + g.vistos.length + g.guardados.length; }, 0);

    var botao = el("button", "abre");
    botao.type = "button";
    botao.style.marginTop = "12px";
    botao.appendChild(el("span", "abre__c", String(quantos)));
    var t = el("div");
    t.appendChild(el("div", "abre__t", "Órgãos, impostos e consultas"));
    t.appendChild(el("div", "abre__s", "Receita, SEFAZ, eSocial, juntas, prefeituras e certificados"));
    botao.appendChild(t);
    botao.appendChild(el("span", "abre__seta", "›"));
    botao.addEventListener("click", function () { abrirPainel("Órgãos, impostos e consultas", resto); });
    c.appendChild(botao);
    return c;
  }

  /* ============================================================
     L4 · só o essencial, e uma busca
     Doze ícones. O resto existe, mas só aparece quando alguém
     digita. É a aposta mais forte: quem procura o Meu INSS sabe
     que ele se chama Meu INSS.
     ============================================================ */
  function l4() {
    var c = el("div");

    var busca = el("div", "busca");
    var lupa = document.createElement("div");
    lupa.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
                     'stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
    busca.appendChild(lupa.firstChild);
    var campo = document.createElement("input");
    campo.type = "text";
    campo.placeholder = "Buscar qualquer um dos 37 sistemas…";
    busca.appendChild(campo);
    c.appendChild(busca);

    var achados = el("div", "achados");
    c.appendChild(achados);

    var quadros = el("div", "quadros");
    G.slice(0, 2).forEach(function (g) {
      var q = el("div", "quadro");
      q.appendChild(el("div", "rot quadro__rot", g.rot));
      q.appendChild(el("div", "quadro__sub", g.sub));
      var grade = el("div", "grade");
      g.vistos.forEach(function (i) { grade.appendChild(appIcone(i)); });
      q.appendChild(grade);
      quadros.appendChild(q);
    });
    c.appendChild(quadros);

    var todos = [];
    G.forEach(function (g) { todos = todos.concat(g.vistos, g.guardados); });

    campo.addEventListener("input", function () {
      var termo = campo.value.trim().toLowerCase();
      achados.textContent = "";
      if (termo.length < 2) { quadros.style.display = ""; return; }
      quadros.style.display = "none";
      todos.filter(function (i) { return i.nome.toLowerCase().indexOf(termo) !== -1; })
           .forEach(function (i) {
             var a = ancora(i, "achado");
             a.appendChild(icone(i));
             a.appendChild(el("span", "achado__n", i.nome));
             achados.appendChild(a);
           });
      if (!achados.children.length) {
        achados.appendChild(el("div", "dica", "Nenhum sistema com esse nome."));
      }
    });

    return c;
  }

  /* ---------- painel que abre por cima ---------- */
  function abrirPainel(titulo, grupos) {
    var f = document.getElementById("flutuante");
    document.getElementById("flutuante-t").textContent = titulo;
    var corpo = document.getElementById("flutuante-corpo");
    corpo.textContent = "";
    grupos.forEach(function (g) {
      var bloco = el("div", "grupo");
      bloco.appendChild(el("span", "rot", g.rot));
      var grade = el("div", "grade");
      g.vistos.concat(g.guardados).forEach(function (i) { grade.appendChild(appIcone(i)); });
      bloco.appendChild(grade);
      corpo.appendChild(bloco);
    });
    f.classList.add("on");
  }

  (function ligarPainel() {
    var f = document.getElementById("flutuante");
    document.getElementById("flutuante-x").addEventListener("click", function () { f.classList.remove("on"); });
    f.addEventListener("click", function (ev) { if (ev.target === f) f.classList.remove("on"); });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") f.classList.remove("on");
    });
  })();

  /* ---------- o quadro fixo ---------- */
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

  var L = [
    { id: "L1", nome: "“+N” abre ali mesmo",     montar: l1 },
    { id: "L2", nome: "Raro vira pastilha",      montar: l2 },
    { id: "L3", nome: "Uma gaveta só",           montar: l3 },
    { id: "L4", nome: "Essencial + busca",       montar: l4 },
  ];

  var palco = document.getElementById("palco");
  L.forEach(function (x) { palco.appendChild(tela(x.id, x.montar())); });

  var botoes = document.getElementById("botoes");
  L.forEach(function (x, i) {
    var b = el("button", "opcao", (i + 1) + " · " + x.nome);
    b.type = "button";
    b.dataset.l = x.id;
    b.addEventListener("click", function () { mostrar(x.id); });
    botoes.appendChild(b);
  });

  function mostrar(id) {
    Array.prototype.forEach.call(document.querySelectorAll(".modelo"), function (m) {
      m.classList.toggle("ativo", m.id === id);
    });
    Array.prototype.forEach.call(botoes.children, function (b) {
      b.setAttribute("aria-pressed", b.dataset.l === id ? "true" : "false");
    });
    location.hash = id;
  }

  var pedido = (location.hash || "").slice(1).toUpperCase();
  mostrar(L.some(function (x) { return x.id === pedido; }) ? pedido : "L1");

})();
