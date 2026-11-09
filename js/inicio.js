/* ============================================================
   Hub Totali · o cartão "Minhas pendências" da tela inicial
   ------------------------------------------------------------
   O quadro de pendências inteiro mora na vista "Pendências". A
   tela inicial não repete o quadro: mostra o que a pessoa precisa
   ver ao abrir o Hub de manhã — o que chegou de colegas e ainda
   não foi visto, o que está atrasado, o que é para hoje, o que
   vence ainda esta semana — e uma caixa COMPLETA para anotar uma
   pendência: quando, data, setor, para quem, quem acompanha,
   importante. Clicar numa pendência abre o quadro com ela em
   destaque.

   Os dados vêm do próprio quadro (window.PendenciasHub e o evento
   "pendencias:mudou"); este arquivo só desenha. A caixa entende
   prazo e setor na frase, como a do quadro ("DAE da Alfa até sexta
   no fiscal"), e o que a frase diz preenche as opções sozinho; o
   que a pessoa escolher na mão vale mais.
   ============================================================ */

const Inicio = (function () {
  "use strict";

  var RESUMO = null;
  var ULTIMO_DESENHO = "";
  var LIMITE = 6;

  /* o estado da caixa de nova pendência */
  var manual = { bloco: false, setor: false };
  var recebem = [];        /* uids, quando "várias pessoas" */
  var acompanham = [];     /* uids */
  var importante = false;
  var mostrandoPessoas = false;

  function el(t, c, x) {
    var e = document.createElement(t);
    if (c) e.className = c;
    if (x !== undefined && x !== null) e.textContent = x;
    return e;
  }
  function $(id) { return document.getElementById(id); }
  function P() { return (typeof PendenciasHub !== "undefined") ? PendenciasHub : null; }
  function primeiroNome(n) { return String(n || "").split(/\s+/)[0]; }

  /* ---------- um item do cartão ---------- */
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
    if (tipo === "nova" || (t.criadoPorUid && t.criadoPorUid !== p.meuUid())) {
      meta.appendChild(el("span", "hj__de", t.origemSistema === "hub-antigo" ? "do quadro antigo" :
        t.origemSistema === "atos" ? "do Atos Societários" : "de " + (t.criadoPorNome || p.nomeDe(t.criadoPorUid) || "colega")));
    }
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

    function ir() {
      if (p.marcarVisto) p.marcarVisto(t.id);
      if (typeof Hub !== "undefined") Hub.irParaPendencia(t.id);
    }
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

  function irParaAba(aba) {
    if (typeof Hub !== "undefined") Hub.mostrarVista("pendencias");
    var p = P();
    if (p && p.mostrarAba) window.setTimeout(function () { p.mostrarAba(aba); }, 30);
  }

  function desenhar() {
    var alvo = $("pend-hoje-lista");
    var prog = $("pend-hoje-prog");
    var txt = $("pend-hoje-txt");
    if (!alvo) return;
    var r = RESUMO;

    if (!r || !r.carregado) {
      alvo.textContent = "";
      alvo.appendChild(el("div", "cartao__vazio", "Carregando o seu quadro…"));
      if (txt) txt.textContent = "";
      return;
    }

    function marca(t) { return [t.id, t.texto, t.prazo, t.setor, (t.notas || []).length, t.vistoEm || 0]; }
    var novas = r.listaNovas || [];
    var semana = r.listaSemana || [];
    var env = r.enviadas || { total: 0, abertas: 0, semVisto: 0 };
    var assinatura = JSON.stringify([r.feitasHoje, r.abertas, r.listaAtrasadas.map(marca), r.listaHoje.map(marca),
                                     semana.map(marca), novas.map(marca), env.abertas, env.semVisto, r.acompanho, (r.setores || []).length, (r.equipe || []).length]);
    if (assinatura === ULTIMO_DESENHO) return;
    ULTIMO_DESENHO = assinatura;

    preencherOpcoes(r);

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
    var mostradas = 0;

    /* O que chegou de colegas e ainda não foi visto vem antes de
       tudo: é a única coisa aqui que outra pessoa está esperando. */
    if (novas.length) {
      alvo.appendChild(faixa("Novas de colegas", novas.length, "novas"));
      novas.slice(0, 3).forEach(function (t) { alvo.appendChild(linha(t, "nova")); });
    }
    var jaNaNova = {};
    novas.slice(0, 3).forEach(function (t) { jaNaNova[t.id] = true; });
    var atrasadas = r.listaAtrasadas.filter(function (t) { return !jaNaNova[t.id]; });
    var hoje = r.listaHoje.filter(function (t) { return !jaNaNova[t.id]; });
    semana = semana.filter(function (t) { return !jaNaNova[t.id]; });

    if (atrasadas.length) {
      alvo.appendChild(faixa("Atrasadas", atrasadas.length, "atraso"));
      atrasadas.slice(0, LIMITE).forEach(function (t) { alvo.appendChild(linha(t, "atrasada")); mostradas++; });
    }
    if (hoje.length && mostradas < LIMITE) {
      alvo.appendChild(faixa("Para hoje", hoje.length, "hoje"));
      hoje.slice(0, LIMITE - mostradas).forEach(function (t) { alvo.appendChild(linha(t, "hoje")); mostradas++; });
    }
    if (!atrasadas.length && !hoje.length && !novas.length) {
      var v = el("div", "cartao__vazio");
      v.appendChild(el("div", "cartao__vazio-t", r.feitasHoje ? "Tudo riscado por hoje." : "Nada para hoje."));
      v.appendChild(el("div", "cartao__vazio-x", semana.length
        ? "O que vence ainda esta semana está logo abaixo."
        : "Anote a primeira na caixa acima: o prazo e o setor saem da própria frase."));
      alvo.appendChild(v);
    }
    if (semana.length && mostradas < LIMITE) {
      alvo.appendChild(faixa("Esta semana", semana.length, "semana"));
      semana.slice(0, LIMITE - mostradas).forEach(function (t) { alvo.appendChild(linha(t, "semana")); mostradas++; });
    }
    var sobrando = (atrasadas.length + hoje.length + semana.length) - mostradas;
    if (sobrando > 0) {
      var mais = el("button", "hj__mais", "+ " + sobrando + " no quadro");
      mais.type = "button";
      mais.addEventListener("click", function () { if (typeof Hub !== "undefined") Hub.mostrarVista("pendencias"); });
      alvo.appendChild(mais);
    }

    /* O que eu mandei para colegas: se já viram e quanto falta. */
    if (env.total || r.acompanho) {
      var e = el("div", "hj__env");
      if (env.total) {
        var s1 = el("span");
        s1.appendChild(el("b", null, "Enviadas: "));
        s1.appendChild(document.createTextNode(env.abertas + (env.abertas === 1 ? " aberta" : " abertas") +
          (env.semVisto ? " · " + env.semVisto + (env.semVisto === 1 ? " ainda não vista" : " ainda não vistas") : "")));
        e.appendChild(s1);
      }
      if (r.acompanho) {
        var s2 = el("span");
        s2.appendChild(el("b", null, "Acompanho: "));
        s2.appendChild(document.createTextNode(r.acompanho + (r.acompanho === 1 ? " pendência" : " pendências")));
        e.appendChild(s2);
      }
      var ver = el("button", "hj__env-ver", "Ver ›");
      ver.type = "button";
      ver.addEventListener("click", function () { irParaAba(env.total ? "enviadas" : "acompanho"); });
      e.appendChild(ver);
      alvo.appendChild(e);
    }

    /* O pé: o que existe no quadro além do que está à vista. */
    var pe = $("pend-hoje-pe");
    if (pe) {
      pe.textContent = "";
      var outras = Math.max(0, r.abertas - r.atrasadas - r.hoje - (r.listaSemana || []).length);
      var p1 = el("span"); p1.appendChild(el("b", null, String(r.abertas)));
      p1.appendChild(document.createTextNode(r.abertas === 1 ? " pendência aberta no quadro" : " pendências abertas no quadro"));
      pe.appendChild(p1);
      if (outras) {
        var p2 = el("span"); p2.appendChild(el("b", null, String(outras)));
        p2.appendChild(document.createTextNode(" em acompanhar ou com data depois desta semana"));
        pe.appendChild(p2);
      }
    }
  }

  /* ---------- a caixa completa de nova pendência ---------- */
  function preencherOpcoes(r) {
    var p = P();
    var setor = $("pf-setor");
    if (setor) {
      var atual = setor.value;
      setor.textContent = "";
      setor.appendChild(new Option("Sem setor", ""));
      (r.setores || []).forEach(function (s) { setor.appendChild(new Option(s.nome, s.id)); });
      if (atual && Array.prototype.some.call(setor.options, function (o) { return o.value === atual; })) setor.value = atual;
    }
    var para = $("pf-para");
    if (para && p) {
      var atualPara = para.value;
      para.textContent = "";
      para.appendChild(new Option("Para mim", ""));
      var colegas = p.colegas ? p.colegas() : [];
      colegas.forEach(function (c) { para.appendChild(new Option("Para " + (c.nome || c.email), c.uid)); });
      if (colegas.length > 1) para.appendChild(new Option("Para várias pessoas…", "*"));
      para.hidden = !colegas.length;
      if (atualPara && Array.prototype.some.call(para.options, function (o) { return o.value === atualPara; })) para.value = atualPara;
      var btnAc = $("pf-acomp");
      if (btnAc) btnAc.hidden = !colegas.length;
    }
  }

  function chip(pessoa, lista, aoMudar) {
    var b = el("button", "pchip");
    b.type = "button";
    b.setAttribute("aria-pressed", String(lista.indexOf(pessoa.uid) !== -1));
    b.appendChild(el("span", "pchip__ini", (pessoa.nome || pessoa.email || "?").charAt(0).toUpperCase()));
    b.appendChild(document.createTextNode(primeiroNome(pessoa.nome || pessoa.email)));
    b.title = (pessoa.nome || pessoa.email) + ((pessoa.setores && pessoa.setores.length) ? " · " + pessoa.setores.join(", ") : "");
    b.addEventListener("click", function () {
      var i = lista.indexOf(pessoa.uid);
      if (i === -1) lista.push(pessoa.uid); else lista.splice(i, 1);
      b.setAttribute("aria-pressed", String(i === -1));
      if (aoMudar) aoMudar();
    });
    return b;
  }

  function desenharPessoas() {
    var box = $("pf-pessoas");
    var p = P();
    if (!box || !p) return;
    var para = $("pf-para");
    var varios = para && para.value === "*";
    box.hidden = !(mostrandoPessoas || varios);
    if (box.hidden) return;
    box.textContent = "";
    var colegas = p.colegas ? p.colegas() : [];
    if (varios) {
      box.appendChild(el("div", "hj__pessoas-t", "Quem recebe (uma cópia no quadro de cada um)"));
      var c1 = el("div", "hj__chips");
      colegas.forEach(function (c) { c1.appendChild(chip(c, recebem)); });
      box.appendChild(c1);
    }
    box.appendChild(el("div", "hj__pessoas-t", "Quem acompanha (vê e comenta, sem receber)"));
    var c2 = el("div", "hj__chips");
    colegas.forEach(function (c) { c2.appendChild(chip(c, acompanham, pintarAcomp)); });
    box.appendChild(c2);
  }

  function pintarAcomp() {
    var b = $("pf-acomp");
    if (!b) return;
    b.textContent = acompanham.length ? "👁 " + acompanham.length : "👁";
    b.setAttribute("aria-pressed", String(acompanham.length > 0 || mostrandoPessoas));
  }

  function abrirForm() {
    var op = $("pend-opcoes");
    if (op) op.hidden = false;
    var f = $("pend-form");
    if (f) f.classList.add("hj__form--aberto");
  }
  function fecharForm() {
    var op = $("pend-opcoes");
    if (op) op.hidden = true;
    var box = $("pf-pessoas");
    if (box) box.hidden = true;
    mostrandoPessoas = false;
    var f = $("pend-form");
    if (f) f.classList.remove("hj__form--aberto");
  }

  function aplicarEntendimento(frase) {
    var p = P();
    if (!p || !p.entender) return;
    var r = p.entender(frase);
    var bloco = $("pf-bloco"), data = $("pf-data"), setor = $("pf-setor"), dica = $("pend-hoje-dica");
    if (!manual.bloco) {
      if (r.status) { bloco.value = r.status; if (r.prazo) data.value = r.prazo; }
      else { bloco.value = "hoje"; }
      data.hidden = bloco.value !== "data";
    }
    if (!manual.setor && r.setor) setor.value = r.setor;
    var partes = [];
    if (r.status && !manual.bloco) partes.push(r.prazo ? "até " + r.prazo.slice(8, 10) + "/" + r.prazo.slice(5, 7) : bloco.options[bloco.selectedIndex].text);
    if (r.setor && !manual.setor) partes.push(p.nomeSetor(r.setor));
    if (dica) {
      if (partes.length && frase.trim()) { dica.textContent = "Entendi: " + partes.join(" · ") + " (o prazo e o setor saem do texto)"; dica.hidden = false; }
      else if (dica.textContent.indexOf("Entendi") === 0) dica.hidden = true;
    }
  }

  function limparForm() {
    var cx = $("pend-hoje-nova");
    if (cx) cx.value = "";
    manual = { bloco: false, setor: false };
    recebem = []; acompanham = []; importante = false; mostrandoPessoas = false;
    var b = $("pf-bloco"); if (b) b.value = "hoje";
    var d = $("pf-data"); if (d) { d.value = ""; d.hidden = true; }
    var s = $("pf-setor"); if (s) s.value = "";
    var pa = $("pf-para"); if (pa) pa.value = "";
    var imp = $("pf-imp"); if (imp) imp.setAttribute("aria-pressed", "false");
    pintarAcomp();
    var box = $("pf-pessoas"); if (box) box.hidden = true;
  }

  function ligarCaixa() {
    var cx = $("pend-hoje-nova");
    var form = $("pend-form");
    var dica = $("pend-hoje-dica");
    if (!cx || !form) return;

    /* o botão de "quem acompanha" nasce aqui, antes da estrela */
    var imp = $("pf-imp");
    if (imp && !$("pf-acomp")) {
      var ac = el("button", "hj__imp hj__acomp", "👁");
      ac.type = "button";
      ac.id = "pf-acomp";
      ac.title = "Quem acompanha esta pendência";
      ac.setAttribute("aria-pressed", "false");
      ac.hidden = true;
      ac.addEventListener("click", function () { mostrandoPessoas = !mostrandoPessoas; desenharPessoas(); pintarAcomp(); });
      imp.parentNode.insertBefore(ac, imp);
    }

    cx.addEventListener("focus", abrirForm);
    cx.addEventListener("input", function () { abrirForm(); aplicarEntendimento(cx.value); });
    $("pf-bloco").addEventListener("change", function () {
      manual.bloco = true;
      var d = $("pf-data");
      d.hidden = this.value !== "data";
      if (this.value === "data" && !d.value) { d.focus(); try { d.showPicker && d.showPicker(); } catch (e) {} }
    });
    $("pf-data").addEventListener("change", function () { manual.bloco = true; if (this.value) $("pf-bloco").value = "data"; });
    $("pf-setor").addEventListener("change", function () { manual.setor = true; });
    $("pf-para").addEventListener("change", function () { desenharPessoas(); });
    if (imp) imp.addEventListener("click", function () { importante = !importante; imp.setAttribute("aria-pressed", String(importante)); });

    /* Esc fecha as opções quando a caixa está vazia. */
    form.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && !cx.value.trim()) { fecharForm(); cx.blur(); }
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var p = P();
      var frase = cx.value.trim();
      if (!p || !frase) { cx.focus(); return; }
      var bloco = $("pf-bloco").value, data = $("pf-data").value;
      if (bloco === "data" && !data) { if (dica) { dica.textContent = "Escolha até que dia resolver."; dica.hidden = false; } $("pf-data").focus(); return; }
      var paraSel = $("pf-para").value;
      var para = paraSel === "*" ? recebem.slice() : (paraSel ? [paraSel] : []);
      if (paraSel === "*" && !para.length) { if (dica) { dica.textContent = "Marque quem recebe, ou escolha “Para mim”."; dica.hidden = false; } return; }
      cx.disabled = true;
      $("pf-ok").disabled = true;
      p.criar({
        frase: frase,
        status: manual.bloco ? bloco : undefined,
        prazo: (manual.bloco && bloco === "data") ? data : undefined,
        setor: manual.setor ? $("pf-setor").value : undefined,
        importante: importante,
        para: para,
        envolvidos: acompanham.slice(),
      }).then(function (r) {
        var nomes = para.map(function (u) { return primeiroNome(p.nomeDe(u)); });
        if (dica) {
          dica.textContent = (nomes.length ? "Enviada para " + nomes.join(", ") : "Anotada") +
            (r.rotulo ? " · " + r.rotulo : "") + (r.setor ? " · " + p.nomeSetor(r.setor) : "") +
            (acompanham.length ? " · " + acompanham.length + (acompanham.length === 1 ? " acompanha" : " acompanham") : "") + ".";
          dica.hidden = false;
          window.setTimeout(function () { if (dica.textContent.indexOf("Entendi") !== 0) dica.hidden = true; }, 4000);
        }
        limparForm();
        fecharForm();
      }).catch(function () {
        if (dica) { dica.textContent = "Não consegui anotar agora. Tente de novo."; dica.hidden = false; }
      }).then(function () { cx.disabled = false; $("pf-ok").disabled = false; cx.focus(); });
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
