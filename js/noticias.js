/* ============================================================
   Hub Totali · notícias oficiais
   ------------------------------------------------------------
   Lê dados/noticias.json — que o robô do GitHub atualiza de hora
   em hora a partir das fontes oficiais (ferramentas/
   buscar-noticias.js) — e desenha duas coisas:

     · o cartão da tela inicial, com as últimas que importam;
     · a tela "Notícias", com tudo: filtro por assunto e por
       fonte, busca, agrupado por dia.

   O HUB NÃO FALA COM SITE NENHUM. O arquivo é servido pela própria
   pasta, como o resto. Abrir a notícia abre o site oficial numa
   aba nova.

   "Nova" é o que apareceu desde a última vez em que ESTA pessoa
   abriu o Hub, guardado no navegador dela. Quem abre de manhã vê
   um ponto nas que chegaram desde ontem; quem deixa aberto o dia
   inteiro vê o ponto chegar.
   ============================================================ */

const Noticias = (function () {
  "use strict";

  var ARQUIVO = "dados/noticias.json";
  var CHAVE_VISTA = "hub-totali:noticias-vista-em";
  var CHAVE_FILTRO = "hub-totali:noticias-filtro";
  var NO_CARTAO = 7;

  var DADOS = null;
  var ERRO = "";
  var VISTA_EM = 0;          /* quando a pessoa abriu as notícias pela última vez */
  var ABERTO_EM = 0;         /* quando abriu esta aba do Hub: o ponto vale desde VISTA_EM */
  var FILTRO = { categoria: "", fonte: "", busca: "" };

  try { VISTA_EM = parseInt(window.localStorage.getItem(CHAVE_VISTA) || "0", 10) || 0; } catch (e) {}
  try { var f = JSON.parse(window.localStorage.getItem(CHAVE_FILTRO) || "null"); if (f && typeof f === "object") FILTRO.categoria = String(f.categoria || ""); } catch (e) {}

  function el(t, c, x) {
    var e = document.createElement(t);
    if (c) e.className = c;
    if (x !== undefined && x !== null) e.textContent = x;
    return e;
  }

  function semAcento(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  /* ---------- tempo, em palavras ---------- */
  function haQuanto(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return "";
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 2) return "agora";
    if (m < 60) return "há " + m + " min";
    var h = Math.round(m / 60);
    if (h < 24) return "há " + h + " h";
    var d = Math.round(h / 24);
    if (d === 1) return "ontem";
    if (d < 7) return "há " + d + " dias";
    return new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  }

  function diaDe(iso) {
    var d = new Date(iso);
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var dia = new Date(d); dia.setHours(0, 0, 0, 0);
    var dif = Math.round((hoje - dia) / 864e5);
    if (dif === 0) return "Hoje";
    if (dif === 1) return "Ontem";
    var txt = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  }

  function ehNova(n) {
    var t = Date.parse(n.vistaEm || n.publicadoEm);
    return VISTA_EM > 0 && t > VISTA_EM;
  }

  function nomeCategoria(id) {
    var c = ((DADOS && DADOS.categorias) || []).filter(function (x) { return x.id === id; })[0];
    return c ? c.nome : id;
  }

  /* O endereço que entra no href: só http e https, como no resto
     do Hub. O que vier diferente não vira link. */
  function enderecoSeguro(url) {
    try {
      var u = new URL(url);
      return (u.protocol === "https:" || u.protocol === "http:") ? u.href : "";
    } catch (e) { return ""; }
  }

  /* ---------- um item ---------- */
  function item(n, compacto) {
    var url = enderecoSeguro(n.link);
    var a = document.createElement(url ? "a" : "div");
    a.className = "not" + (compacto ? " not--c" : "") + (ehNova(n) ? " not--nova" : "");
    if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; }

    var cab = el("div", "not__cab");
    cab.appendChild(el("span", "not__fonte not__fonte--" + n.fonte, n.sigla));
    cab.appendChild(el("span", "not__quando", haQuanto(n.publicadoEm)));
    if (ehNova(n)) cab.appendChild(el("span", "not__ponto"));
    a.appendChild(cab);

    a.appendChild(el("div", "not__t", n.titulo));
    if (!compacto && n.resumo) a.appendChild(el("div", "not__r", n.resumo));
    if (!compacto && n.categorias && n.categorias.length) {
      var tags = el("div", "not__tags");
      n.categorias.slice(0, 3).forEach(function (c) { tags.appendChild(el("span", "not__tag not__tag--" + c, nomeCategoria(c))); });
      a.appendChild(tags);
    }
    a.title = n.fonteNome + (url ? " — abre em nova aba" : "");
    return a;
  }

  /* ---------- o cartão da tela inicial ----------
     As de relevância alta primeiro, e dentro delas as mais novas.
     Uma notícia velha de relevância alta não deve passar na frente
     de uma de hoje: o corte é de 7 dias para o cartão. */
  function desenharCartao() {
    var alvo = document.getElementById("noticias-rail-lista");
    var rodape = document.getElementById("noticias-rail-pe");
    if (!alvo) return;
    alvo.textContent = "";
    if (!DADOS) {
      alvo.appendChild(el("div", "cartao__vazio", ERRO || "Carregando…"));
      return;
    }
    var semana = Date.now() - 7 * 864e5;
    var lista = DADOS.noticias.filter(function (n) { return n.relevancia >= 2 && Date.parse(n.publicadoEm) >= semana; });
    if (lista.length < 4) lista = DADOS.noticias.filter(function (n) { return n.relevancia >= 1; });
    lista = lista.slice().sort(function (a, b) {
      return (b.relevancia - a.relevancia) || (Date.parse(b.publicadoEm) - Date.parse(a.publicadoEm));
    }).slice(0, NO_CARTAO);
    if (!lista.length) {
      alvo.appendChild(el("div", "cartao__vazio", "Nenhuma notícia por enquanto."));
    }
    lista.forEach(function (n) { alvo.appendChild(item(n, true)); });
    if (rodape) {
      rodape.textContent = "";
      var quando = DADOS.atualizadoEm ? "atualizado " + haQuanto(DADOS.atualizadoEm) : "";
      var foraDoAr = (DADOS.fontes || []).filter(function (f) { return !f.ok; });
      rodape.appendChild(el("span", "cartao__nota", quando));
      if (foraDoAr.length) {
        rodape.appendChild(el("span", "cartao__nota cartao__nota--aviso",
          foraDoAr.length === 1 ? foraDoAr[0].sigla + " sem resposta" : foraDoAr.length + " fontes sem resposta"));
      }
    }
    pintarSelo();
  }

  /* Só o que é do balcão conta como novidade no selo: aduana e
     cerimônia ficam na lista, mas não acendem a barra. */
  function quantasNovas() {
    if (!DADOS) return 0;
    return DADOS.noticias.filter(function (n) { return n.relevancia >= 2 && ehNova(n); }).length;
  }

  /* O pontinho no ícone da barra: há notícia que a pessoa não viu. */
  function pintarSelo() {
    var b = document.getElementById("nav-noticias");
    if (!b) return;
    var n = quantasNovas();
    var selo = b.querySelector(".nav__selo");
    if (!n) { if (selo) selo.remove(); b.title = "Notícias oficiais"; return; }
    if (!selo) { selo = el("span", "nav__selo nav__selo--neutro"); b.appendChild(selo); }
    selo.textContent = n > 99 ? "99+" : String(n);
    b.title = "Notícias oficiais — " + n + (n === 1 ? " nova" : " novas");
  }

  /* ---------- a tela inteira ---------- */
  function desenharFiltros() {
    var caixa = document.getElementById("noticias-filtros");
    if (!caixa || !DADOS) return;
    caixa.textContent = "";

    function chip(id, nome, quantas) {
      var b = el("button", "chip" + (FILTRO.categoria === id ? " chip--on" : ""));
      b.type = "button";
      b.appendChild(document.createTextNode(nome));
      if (quantas) b.appendChild(el("span", "chip__n", String(quantas)));
      b.addEventListener("click", function () {
        FILTRO.categoria = id;
        try { window.localStorage.setItem(CHAVE_FILTRO, JSON.stringify({ categoria: id })); } catch (e) {}
        desenharTela();
      });
      return b;
    }
    var contagem = {};
    DADOS.noticias.forEach(function (n) { (n.categorias || []).forEach(function (c) { contagem[c] = (contagem[c] || 0) + 1; }); });
    caixa.appendChild(chip("", "Todas", DADOS.noticias.length));
    DADOS.categorias.forEach(function (c) { if (contagem[c.id]) caixa.appendChild(chip(c.id, c.nome, contagem[c.id])); });

    var sel = document.getElementById("noticias-fonte");
    if (sel) {
      var atual = FILTRO.fonte;
      sel.textContent = "";
      var op0 = el("option", null, "Todas as fontes"); op0.value = "";
      sel.appendChild(op0);
      DADOS.fontes.forEach(function (f) {
        var o = el("option", null, f.nome + (f.ok ? "" : " (sem resposta)"));
        o.value = f.id;
        sel.appendChild(o);
      });
      sel.value = atual;
    }
  }

  function filtradas() {
    var termos = semAcento(FILTRO.busca).split(" ").filter(Boolean);
    return DADOS.noticias.filter(function (n) {
      if (FILTRO.categoria && (n.categorias || []).indexOf(FILTRO.categoria) === -1) return false;
      if (FILTRO.fonte && n.fonte !== FILTRO.fonte) return false;
      if (termos.length) {
        var palheiro = semAcento(n.titulo + " " + n.resumo + " " + n.fonteNome);
        if (!termos.every(function (t) { return palheiro.indexOf(t) !== -1; })) return false;
      }
      return true;
    });
  }

  function desenharTela() {
    var lista = document.getElementById("noticias-lista");
    if (!lista) return;
    lista.textContent = "";
    desenharFiltros();

    var quando = document.getElementById("noticias-atualizado");
    if (quando) {
      quando.textContent = DADOS && DADOS.atualizadoEm
        ? "Atualizado " + haQuanto(DADOS.atualizadoEm) + " · " + (DADOS.fontes || []).filter(function (f) { return f.ok; }).length + " fontes oficiais"
        : (ERRO || "Carregando…");
    }
    if (!DADOS) return;

    var itens = filtradas();
    if (!itens.length) {
      lista.appendChild(el("div", "vn__vazio", "Nenhuma notícia com esse filtro."));
    }
    var grupo = null, ultimoDia = null;
    itens.forEach(function (n) {
      var d = diaDe(n.publicadoEm);
      if (d !== ultimoDia) {
        ultimoDia = d;
        lista.appendChild(el("h3", "vn__dia", d));
        grupo = el("div", "vn__grupo");
        lista.appendChild(grupo);
      }
      grupo.appendChild(item(n, false));
    });

    var fontes = document.getElementById("noticias-fontes");
    if (fontes) {
      fontes.textContent = "";
      fontes.appendChild(el("span", "vn__fontes-rot", "Fontes:"));
      (DADOS.fontes || []).forEach(function (f) {
        var url = enderecoSeguro(f.site);
        var a = document.createElement(url ? "a" : "span");
        a.className = "vn__fonte" + (f.ok ? "" : " vn__fonte--fora");
        if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; }
        a.textContent = f.nome;
        a.title = f.ok ? (f.quantas + " na última leitura") : ("Sem resposta: " + (f.erro || "") + (f.ultimaVez ? " · última vez " + haQuanto(f.ultimaVez) : ""));
        fontes.appendChild(a);
      });
    }
  }

  /* Abrir a tela marca tudo como visto — mas só o que é anterior a
     este instante: o que chegar depois ganha ponto. */
  function marcarVisto() {
    var agora = Date.now();
    VISTA_EM = agora;
    try { window.localStorage.setItem(CHAVE_VISTA, String(agora)); } catch (e) {}
    pintarSelo();
  }

  function aoAbrirTela() {
    desenharTela();
    /* Os pontos ficam enquanto a pessoa olha a lista; somem na
       próxima abertura, que é quando ela já leu. */
    window.setTimeout(function () {
      marcarVisto();
      desenharCartao();
    }, 1500);
  }

  /* ---------- carregar ---------- */
  function carregar() {
    return fetch(ARQUIVO, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        if (!j || !Array.isArray(j.noticias)) throw new Error("arquivo em formato inesperado");
        DADOS = j;
        ERRO = "";
        if (!VISTA_EM) {
          /* Primeira vez: nada é "novo", senão a tela abre com
             cinquenta pontos. A partir de agora, sim. */
          marcarVisto();
        }
        desenharCartao();
        if (!document.getElementById("vista-noticias").hidden) desenharTela();
      })
      .catch(function (e) {
        ERRO = "As notícias não carregaram agora (" + (e.message || e) + ").";
        desenharCartao();
      });
  }

  function ligar() {
    var busca = document.getElementById("noticias-busca");
    if (busca) {
      var espera = null;
      busca.addEventListener("input", function () {
        window.clearTimeout(espera);
        espera = window.setTimeout(function () { FILTRO.busca = busca.value; desenharTela(); }, 140);
      });
    }
    var sel = document.getElementById("noticias-fonte");
    if (sel) sel.addEventListener("change", function () { FILTRO.fonte = sel.value; desenharTela(); });
    ABERTO_EM = Date.now();
  }

  function iniciar() {
    ligar();
    carregar();
    /* De meia em meia hora, com a aba visível; e ao voltar a ela. */
    window.setInterval(function () { if (!document.hidden) carregar(); }, 30 * 60 * 1000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) carregar(); });
  }

  return { iniciar: iniciar, aoAbrirTela: aoAbrirTela, recarregar: carregar, quantasNovas: quantasNovas };
})();
