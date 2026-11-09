/* ============================================================
   Hub Totali · o cartão "Minhas pendências" da tela inicial
   ------------------------------------------------------------
   O quadro de pendências inteiro mora na vista "Pendências". A
   tela inicial não repete o quadro: mostra o que a pessoa precisa
   ver ao abrir o Hub de manhã — o que está atrasado, o que é para
   hoje, o que vence ainda esta semana, quanto já riscou — e uma
   caixa para anotar uma pendência nova sem sair daqui. Clicar numa
   pendência abre o quadro com ela em destaque.

   Os dados vêm do próprio quadro (window.PendenciasHub e o evento
   "pendencias:mudou"); este arquivo só desenha. A caixa de criar
   rápido entende prazo e setor na frase, como a do quadro:
   "DAE da Alfa até sexta no fiscal".
   ============================================================ */

const Inicio = (function () {
  "use strict";

  var RESUMO = null;
  var ULTIMO_DESENHO = "";

  function el(t, c, x) {
    var e = document.createElement(t);
    if (c) e.className = c;
    if (x !== undefined && x !== null) e.textContent = x;
    return e;
  }

  function P() { return (typeof PendenciasHub !== "undefined") ? PendenciasHub : null; }

  /* Um item do cartão: bolinha de riscar, texto, setor e prazo. */
  function linha(t, tipo) {
    var p = P();
    var li = el("div", "hj__i hj__i--" + tipo);
    li.setAttribute("data-id", t.id);

    var chk = el("button", "hj__chk");
    chk.type = "button";
    chk.title = "Riscar como feita";
    chk.setAttribute("aria-label", "Riscar como feita");
    chk.addEventListener("click", function (ev) {
      ev.stopPropagation();
      li.classList.add("hj__i--riscando");
      p.riscar(t.id);
    });
    li.appendChild(chk);

    var txt = el("div", "hj__txt");
    txt.appendChild(el("div", "hj__o", p.textoDe(t)));
    var meta = el("div", "hj__m");
    if (t.setor) {
      var s = el("span", "hj__setor", p.nomeSetor(t.setor));
      s.style.setProperty("--sc", p.corSetor(t.setor));
      meta.appendChild(s);
    }
    var prazo = p.rotuloPrazo(t);
    if (prazo) meta.appendChild(el("span", "hj__prazo", prazo));
    if (t.notas && t.notas.length) meta.appendChild(el("span", "hj__nota", "“" + String(t.notas[t.notas.length - 1].t).slice(0, 60) + "”"));
    txt.appendChild(meta);
    li.appendChild(txt);

    var abrir = el("button", "hj__abrir");
    abrir.type = "button";
    abrir.title = "Abrir no quadro";
    abrir.setAttribute("aria-label", "Abrir no quadro");
    abrir.textContent = "›";
    li.appendChild(abrir);

    function ir() { if (typeof Hub !== "undefined") Hub.irParaPendencia(t.id); }
    abrir.addEventListener("click", ir);
    txt.addEventListener("click", ir);
    return li;
  }

  function faixa(titulo, n, tipo) {
    var f = el("div", "hj__faixa hj__faixa--" + tipo);
    f.appendChild(el("span", "hj__faixa-t", titulo));
    f.appendChild(el("span", "hj__faixa-n", String(n)));
    return f;
  }

  function desenhar() {
    var alvo = document.getElementById("pend-hoje-lista");
    var prog = document.getElementById("pend-hoje-prog");
    var txt = document.getElementById("pend-hoje-txt");
    if (!alvo) return;
    var r = RESUMO;

    if (!r || !r.carregado) {
      alvo.textContent = "";
      alvo.appendChild(el("div", "cartao__vazio", "Carregando o seu quadro…"));
      if (txt) txt.textContent = "";
      return;
    }

    /* Só redesenha se mudou: a lista é redesenhada a cada minuto
       pelo quadro, e piscar por nada incomoda. */
    function marca(t) { return [t.id, t.texto, t.prazo, t.setor, (t.notas || []).length]; }
    var assinatura = JSON.stringify([r.feitasHoje, r.abertas, r.listaAtrasadas.map(marca), r.listaHoje.map(marca),
                                     (r.listaSemana || []).map(marca)]);
    if (assinatura === ULTIMO_DESENHO) return;
    ULTIMO_DESENHO = assinatura;

    var total = r.feitasHoje + r.atrasadas + r.hoje;
    var pct = total ? Math.round(r.feitasHoje / total * 100) : 0;
    if (prog) { prog.style.width = pct + "%"; prog.parentNode.setAttribute("aria-valuenow", String(pct)); }
    if (txt) {
      txt.textContent = "";
      txt.appendChild(el("b", null, String(r.feitasHoje)));
      txt.appendChild(document.createTextNode(r.feitasHoje === 1 ? " riscada hoje · " : " riscadas hoje · "));
      txt.appendChild(el("b", null, String(r.atrasadas + r.hoje)));
      txt.appendChild(document.createTextNode((r.atrasadas + r.hoje) === 1 ? " falta" : " faltam"));
    }

    alvo.textContent = "";
    var LIMITE = 14;
    var mostradas = 0;
    var semana = r.listaSemana || [];

    if (r.listaAtrasadas.length) {
      alvo.appendChild(faixa("Atrasadas", r.listaAtrasadas.length, "atraso"));
      r.listaAtrasadas.slice(0, LIMITE).forEach(function (t) { alvo.appendChild(linha(t, "atrasada")); mostradas++; });
    }
    if (r.listaHoje.length && mostradas < LIMITE) {
      alvo.appendChild(faixa("Para hoje", r.listaHoje.length, "hoje"));
      r.listaHoje.slice(0, LIMITE - mostradas).forEach(function (t) { alvo.appendChild(linha(t, "hoje")); mostradas++; });
    }
    if (!r.listaAtrasadas.length && !r.listaHoje.length) {
      var v = el("div", "cartao__vazio");
      v.appendChild(el("div", "cartao__vazio-t", r.feitasHoje ? "Tudo riscado por hoje." : "Nada para hoje."));
      v.appendChild(el("div", "cartao__vazio-x", semana.length
        ? "O que vence ainda esta semana está logo abaixo."
        : "Anote a primeira na caixa acima: o prazo e o setor saem da própria frase."));
      alvo.appendChild(v);
    }
    /* O resto da semana entra depois do dia: é o que a pessoa
       precisa ver para decidir o que puxar para hoje. */
    if (semana.length && mostradas < LIMITE) {
      alvo.appendChild(faixa("Esta semana", semana.length, "semana"));
      semana.slice(0, LIMITE - mostradas).forEach(function (t) { alvo.appendChild(linha(t, "semana")); mostradas++; });
    }
    var sobrando = (r.listaAtrasadas.length + r.listaHoje.length + semana.length) - mostradas;
    if (sobrando > 0) {
      var mais = el("button", "hj__mais", "+ " + sobrando + " no quadro");
      mais.type = "button";
      mais.addEventListener("click", function () { if (typeof Hub !== "undefined") Hub.mostrarVista("pendencias"); });
      alvo.appendChild(mais);
    }

    /* O pé: o que existe no quadro além do que está à vista. */
    var pe = document.getElementById("pend-hoje-pe");
    if (pe) {
      pe.textContent = "";
      var outras = Math.max(0, r.abertas - r.atrasadas - r.hoje - semana.length);
      var s1 = el("span"); s1.appendChild(el("b", null, String(r.abertas)));
      s1.appendChild(document.createTextNode(r.abertas === 1 ? " pendência aberta no quadro" : " pendências abertas no quadro"));
      pe.appendChild(s1);
      if (outras) {
        var s2 = el("span"); s2.appendChild(el("b", null, String(outras)));
        s2.appendChild(document.createTextNode(outras === 1 ? " em acompanhar ou com data depois desta semana" : " em acompanhar ou com data depois desta semana"));
        pe.appendChild(s2);
      }
      if (r.feitasHoje) {
        var s3 = el("span"); s3.appendChild(el("b", null, String(r.feitasHoje)));
        s3.appendChild(document.createTextNode(r.feitasHoje === 1 ? " riscada hoje" : " riscadas hoje"));
        pe.appendChild(s3);
      }
    }
  }

  /* ---------- criar rápido ---------- */
  function ligarCaixa() {
    var cx = document.getElementById("pend-hoje-nova");
    var dica = document.getElementById("pend-hoje-dica");
    if (!cx) return;
    cx.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter" || ev.shiftKey) return;
      ev.preventDefault();
      var p = P();
      var frase = cx.value.trim();
      if (!p || !frase) return;
      cx.disabled = true;
      p.adicionarRapido(frase).then(function (r) {
        cx.value = "";
        if (dica) {
          dica.textContent = "Anotada" + (r.rotulo ? " · " + r.rotulo : "") + (r.setor ? " · " + p.nomeSetor(r.setor) : "") + ".";
          dica.hidden = false;
          window.setTimeout(function () { dica.hidden = true; }, 3500);
        }
      }).catch(function () {
        if (dica) { dica.textContent = "Não consegui anotar agora. Tente de novo."; dica.hidden = false; }
      }).then(function () { cx.disabled = false; cx.focus(); });
    });
  }

  function iniciar() {
    ligarCaixa();
    window.addEventListener("pendencias:mudou", function (ev) {
      RESUMO = ev.detail;
      desenhar();
    });
    var p = P();
    if (p) { RESUMO = p.resumo(); desenhar(); }
    /* O "venceu há 2 dias" muda à meia-noite sem ninguém mexer. */
    window.setInterval(function () { var q = P(); if (q) { RESUMO = q.resumo(); ULTIMO_DESENHO = ""; desenhar(); } }, 10 * 60 * 1000);
  }

  return { iniciar: iniciar, resumo: function () { return RESUMO; } };
})();
