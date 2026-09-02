/* ============================================================
   Hub Totali · desenho da tela
   ------------------------------------------------------------
   Lê a lista do banco (js/dados.js) e monta a página. Quem for
   acrescentar um sistema NÃO abre este arquivo — abre a
   admin.html.

   Decisões que explicam o código abaixo:

   1. NADA É ESCRITO COM innerHTML a partir dos dados. Todo texto
      entra por textContent e todo endereço passa por uma peneira
      que só aceita http e https. Assim, mesmo que alguém grave
      um valor estranho pela administração, ele não vira código
      rodando na máquina de quem abriu o navegador.

   2. O QUE APARECE E O QUE ESPERA vem do próprio dado: setor com
      estilo "cartao" aparece na tela; setor com estilo "gaveta"
      vai para o painel dos órgãos. Isso é escolha da
      administração, não regra escondida aqui.

   3. A TELA DESENHA NA HORA com a última cópia guardada no
      navegador e se atualiza sozinha se o servidor tiver algo
      mais novo. Ninguém espera rede para ver o Hub.
   ============================================================ */

(function () {
  "use strict";

  var LOGOS_IDX = (typeof LOGOS !== "undefined") ? LOGOS : {};
  var PASTA_LOGOS = "assets/logos/";

  var SETORES_ATUAIS = [];
  var AVISOS_ATUAIS = [];
  var AGENDA_ATUAL = [];

  /* ---------- utilidades ---------- */

  function el(t, c, x) {
    var e = document.createElement(t);
    if (c) e.className = c;
    if (x !== undefined && x !== null) e.textContent = x;
    return e;
  }

  /* Mesma regra da ferramenta que baixa os logos: é ela que faz
     "e-CAC" e "e-cac.ico" se encontrarem. Mudou aqui, mude lá. */
  function apelido(n) {
    return String(n).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  /* A sigla de quem não tem logo. O campo "sigla" do cadastro
     sempre vence — a regra abaixo é só o palpite automático.

       Portal do Cliente → PC   (iniciais, ignorando o "do")
       e-CAC             → CAC  (sigla curta cabe inteira)
       eSocial           → eS   (maiúscula no meio da palavra) */
  function sigla(item) {
    if (item.sigla) return String(item.sigla);
    var nome = String(item.nome || "?");
    var ligacao = ["de", "do", "da", "dos", "das", "e"];
    var p = nome.split(/[\s·/·-]+/).filter(function (x) {
      return x && ligacao.indexOf(x.toLowerCase()) === -1;
    });
    if (!p.length) p = nome.split(/\s+/);
    if (p.length > 1) return p[0].charAt(0) + p[1].charAt(0);
    var u = p[0] || "?";
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

  /* Quatro origens para o ícone, nesta ordem: imagem enviada pela
     administração, arquivo apontado à mão, arquivo da nossa pasta
     e — só para sistema recém-cadastrado — o ícone do próprio
     site. Rodar baixar-logos.js traz esse último para dentro, e
     a partir daí o arquivo local assume sozinho. */
  function icone(item) {
    var arquivo = item.logo || LOGOS_IDX[apelido(item.nome || "")];
    var endereco = item.logoDados
                || (arquivo ? PASTA_LOGOS + arquivo : "")
                || item.logoRemoto
                || "";
    var caixa = el("span", "ico");
    if (endereco) {
      var img = document.createElement("img");
      img.src = endereco;
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
    a.className = "item" + (url ? "" : " item--sem-link");
    if (url) {
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.setAttribute("aria-label", i.nome);
    }
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

  /* ---------- centro: sistemas, gaveta e agenda ---------- */

  function guardados() {
    return SETORES_ATUAIS.filter(function (s) { return s.estilo === "gaveta"; });
  }
  function aVista() {
    return SETORES_ATUAIS.filter(function (s) { return s.estilo !== "gaveta"; });
  }

  function desenharCentro() {
    var centro = document.getElementById("centro");
    centro.textContent = "";

    aVista().forEach(function (s) {
      if (!s.itens || !s.itens.length) return;
      var b = bloco(s.titulo, s.itens.length);
      var grade = el("div", "grade");
      s.itens.forEach(function (i) { grade.appendChild(item(i)); });
      b.appendChild(grade);
      centro.appendChild(b);
    });

    var resto = guardados();
    var quantos = resto.reduce(function (n, s) { return n + (s.itens || []).length; }, 0);
    if (quantos) {
      var gav = el("button", "gaveta");
      gav.type = "button";
      gav.appendChild(el("span", "gaveta__c", String(quantos)));
      var t = el("div");
      t.appendChild(el("div", "gaveta__t", "Órgãos, impostos e consultas"));
      t.appendChild(el("div", "gaveta__s",
        resto.map(function (s) { return s.titulo; }).join(" · ")));
      gav.appendChild(t);
      gav.appendChild(el("span", "gaveta__seta", "›"));
      gav.addEventListener("click", abrirPainel);
      centro.appendChild(gav);
    }

    if (AGENDA_ATUAL.length) {
      var ba = bloco("Agenda do mês", null, true);
      ba.querySelector(".bloco__cab").appendChild(el("span", "bloco__n",
        new Date().toLocaleDateString("pt-BR", { month: "long" })));
      var ag = el("div", "agenda");
      AGENDA_ATUAL.forEach(function (p) {
        var x = el("div", "prazo" + (p.estado ? " prazo--" + p.estado : ""));
        x.appendChild(el("div", "prazo__d", p.dia));
        x.appendChild(el("div", "prazo__n", p.nome));
        if (p.quem) x.appendChild(el("div", "prazo__q", p.quem));
        ag.appendChild(x);
      });
      ba.appendChild(ag);
      centro.appendChild(ba);
    }
  }

  /* ---------- pendências ----------
     A lista de verdade depende de a pessoa estar identificada, e
     esse pedaço ainda está sendo construído. Enquanto isso, o
     trilho mostra o estado honesto: o que vai aparecer ali, e o
     que falta para aparecer. Melhor uma zona que se explica do
     que uma zona com dado inventado. */
  function desenharPendencias() {
    var alvo = document.getElementById("pendencias");
    alvo.textContent = "";
    var aviso = el("div", "vazio");
    aviso.appendChild(el("div", "vazio__t", "Em construção"));
    aviso.appendChild(el("div", "vazio__x",
      "Aqui vão aparecer as pendências que a equipe abrir entre os setores, " +
      "agrupadas por urgência: atrasadas, para hoje e próximos dias."));
    alvo.appendChild(aviso);
  }

  /* ---------- avisos ---------- */
  function desenharAvisos() {
    var alvo = document.getElementById("avisos");
    alvo.textContent = "";
    if (!AVISOS_ATUAIS.length) { alvo.hidden = true; return; }
    alvo.hidden = false;

    alvo.appendChild(el("span", "avisos__rot", "Avisos"));
    AVISOS_ATUAIS.slice(0, 3).forEach(function (a, i) {
      if (i) alvo.appendChild(el("span", "av__sep"));
      var x = el("span", "av");
      x.appendChild(el("span", "av__p"));
      x.appendChild(el("span", "av__t", a.titulo));
      if (a.texto) x.appendChild(el("span", "av__x", a.texto));
      alvo.appendChild(x);
    });
    if (AVISOS_ATUAIS.length > 3) {
      alvo.appendChild(el("span", "avisos__mais", "+ " + (AVISOS_ATUAIS.length - 3)));
    }
  }

  /* ---------- painel dos órgãos ---------- */
  var painel = document.getElementById("painel");

  function abrirPainel() {
    var corpo = document.getElementById("painel-corpo");
    corpo.textContent = "";
    guardados().forEach(function (s) {
      if (!s.itens || !s.itens.length) return;
      var b = el("div", "painel__g");
      b.appendChild(el("span", "painel__rot", s.titulo));
      var grade = el("div", "grade");
      s.itens.forEach(function (i) { grade.appendChild(item(i)); });
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
  var botaoTodos = document.getElementById("nav-todos");
  if (botaoTodos) botaoTodos.addEventListener("click", abrirPainel);

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
        var s = Dados.sessao();
        var nome = (s && s.email) ? s.email.split("@")[0] : "";
        ola.textContent = (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite") +
                          (nome ? ", " + nome : "");
      }
    }

    bater();
    /* O mostrador é de minutos: acerto o passo com o virar do
       minuto e daí bato de minuto em minuto. Um despertar por
       minuto em vez de sessenta — numa página aberta o dia
       inteiro, isso é bateria de notebook. */
    var agora = new Date();
    window.setTimeout(function () {
      bater();
      window.setInterval(bater, 60000);
    }, (60 - agora.getSeconds()) * 1000 - agora.getMilliseconds());

    res.textContent = "";
    var total = SETORES_ATUAIS.reduce(function (n, s) { return n + (s.itens || []).length; }, 0);
    res.appendChild(document.createTextNode(total + " sistemas no Hub"));
  }

  /* ---------- logo do cabeçalho ---------- */
  /* Se o arquivo sumir da pasta, mostra o nome escrito em vez do
     ícone de imagem quebrada. */
  (function () {
    var img = document.querySelector(".cab__logo");
    var nome = document.getElementById("marca-nome");
    if (!img || !nome) return;
    function trocar() { img.hidden = true; nome.hidden = false; }
    img.addEventListener("error", trocar);
    if (img.complete && img.naturalWidth === 0) trocar();
  })();

  /* ---------- início ---------- */

  function desenharTudo(dados) {
    SETORES_ATUAIS = dados.setores || [];
    AVISOS_ATUAIS  = dados.avisos  || [];
    AGENDA_ATUAL   = dados.agenda  || [];
    desenharCentro();
    desenharAvisos();
  }

  desenharTudo(Dados.carregar(function (maisNovo) {
    desenharTudo(maisNovo);
  }));

  desenharTopo();
  desenharPendencias();

})();
