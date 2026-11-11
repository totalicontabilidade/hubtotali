/* ============================================================
   Recados — o cartão de recado da administração
   ------------------------------------------------------------
   Os recados que viviam no quadro antigo junto com as pendências
   voltaram como coleção própria (`recados`), escritos só pela
   administração. Cada pessoa vê cada recado UMA vez: assim que o
   Hub abre, os que ela ainda não viu aparecem num cartão por cima
   da tela; "Entendi" (ou Esc) marca como lido, e ele não volta.
   O que cada um leu fica em quadros/{uid}/config/recados, e é por
   isso que a administração sabe quem já viu.

   Não confundir com os AVISOS da faixa de baixo (hub/avisos), que
   ficam lá o tempo todo e não têm leitura marcada.
   ============================================================ */

const Recados = (function () {
  "use strict";

  var DIAS_DE_VALIDADE = 30;   /* recado mais velho que isso não pula na frente de ninguém */
  var LIDOS = {};
  var LIDOS_PRONTO = false;
  var MOSTRADOS = {};

  function el(t, c, x) {
    var e = document.createElement(t);
    if (c) e.className = c;
    if (x !== undefined && x !== null) e.textContent = x;
    return e;
  }

  function quando(ts) {
    var d = new Date(Number(ts) || 0);
    if (!ts || isNaN(d.getTime())) return "";
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var dia = new Date(d); dia.setHours(0, 0, 0, 0);
    var dif = Math.round((hoje - dia) / 864e5);
    var hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (dif === 0) return "hoje às " + hora;
    if (dif === 1) return "ontem às " + hora;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " às " + hora;
  }

  function tamanho(n) {
    n = Number(n) || 0;
    if (n >= 1048576) return (n / 1048576).toFixed(1).replace(".", ",") + " MB";
    return Math.max(1, Math.round(n / 1024)) + " KB";
  }

  /* Os arquivos que a administração mandou junto. Abrir não fecha o
     cartão: a pessoa vê o arquivo e depois marca "Entendi". */
  function anexos(lista) {
    var box = el("div", "rj__anexos");
    lista.forEach(function (a) {
      if (!a || !a.caminho) return;
      var b = el("button", "rj__anexo");
      b.type = "button";
      b.title = "Abrir " + (a.nome || "o anexo");
      b.appendChild(el("span", "rj__anexo-n", a.nome || "anexo"));
      if (a.tamanho) b.appendChild(el("span", "rj__anexo-t", tamanho(a.tamanho)));
      b.addEventListener("click", function () {
        var aviso = b.parentNode.querySelector(".rj__anexo-erro");
        if (aviso) aviso.remove();
        Dados.abrirArquivo(a).catch(function (e) {
          box.appendChild(el("p", "rj__anexo-erro", e.message || "Não consegui abrir o arquivo."));
        });
      });
      box.appendChild(b);
    });
    return box;
  }

  function pendentes(lista) {
    var limite = Date.now() - DIAS_DE_VALIDADE * 864e5;
    return (lista || []).filter(function (r) {
      return r && r.id && !LIDOS[r.id] && !MOSTRADOS[r.id] && (Number(r.criadoEm) || 0) >= limite;
    });
  }

  function mostrar(novos) {
    var dlg = document.getElementById("recados-janela");
    if (!dlg || typeof dlg.showModal !== "function" || dlg.open || !novos.length) return;
    /* Alguém no meio de um campo não ganha janela na cara: fica para a próxima verificação. */
    var a = document.activeElement;
    if (a && a !== document.body && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.getClientRects().length) return;

    var lista = document.getElementById("rj-lista");
    lista.textContent = "";
    novos.forEach(function (r) {
      MOSTRADOS[r.id] = true;
      var x = el("article", "rj__item");
      x.appendChild(el("p", "rj__x", r.texto));
      if (r.anexos && r.anexos.length) x.appendChild(anexos(r.anexos));
      x.appendChild(el("div", "rj__de", (r.criadoPorNome ? "de " + r.criadoPorNome : "da administração") + (r.criadoEm ? " · " + quando(r.criadoEm) : "")));
      lista.appendChild(x);
    });
    var t = document.getElementById("rj-titulo");
    if (t) t.textContent = novos.length === 1 ? "Recado" : novos.length + " recados";

    var ids = novos.map(function (r) { return r.id; });
    function fechar() {
      if (dlg.open) dlg.close();
      marcar(ids);
    }
    document.getElementById("rj-ok").onclick = fechar;
    dlg.oncancel = function (e) { e.preventDefault(); fechar(); };
    dlg.showModal();
    document.getElementById("rj-ok").focus();
  }

  function marcar(ids) {
    var agora = new Date().toISOString();
    ids.forEach(function (id) { LIDOS[id] = agora; });
    Dados.marcarRecadosLidos(ids, LIDOS).then(function (l) { LIDOS = l || LIDOS; }).catch(function () {});
  }

  function conferir() {
    if (!LIDOS_PRONTO) return;
    Dados.listarRecados().then(function (lista) { mostrar(pendentes(lista)); }).catch(function () {});
  }

  function iniciar() {
    if (typeof Dados === "undefined") return;
    Dados.lerRecadosLidos().then(function (l) {
      LIDOS = l || {};
      LIDOS_PRONTO = true;
      /* Um instante depois da primeira pintura: a tela aparece, e então o cartão. */
      window.setTimeout(conferir, 700);
    });
    /* Recado mandado com o Hub aberto chega em até cinco minutos. */
    window.setInterval(function () { if (!document.hidden) conferir(); }, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) conferir(); });
  }

  return { iniciar: iniciar, conferir: conferir };
})();
