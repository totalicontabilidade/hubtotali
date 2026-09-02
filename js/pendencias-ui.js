/* ============================================================
   Hub Totali · a tela das pendências
   ------------------------------------------------------------
   Vive no trilho da direita e em dois painéis: a ficha de uma
   pendência e o formulário de abrir outra.

   POR QUE O LOGIN É OPCIONAL

   O Hub é a página inicial do navegador da equipe: ele tem que
   abrir na hora, sem pedir nada. Então os sistemas aparecem para
   todo mundo, sempre. As pendências, não — são de cada um, e para
   saber de quem é preciso saber quem é.

   Quem não entrou vê o convite; quem entrou vê a lista dele. A
   sessão dura enquanto a aba estiver aberta, e o Hub não guarda
   senha em lugar nenhum.
   ============================================================ */

const PendenciasUI = (function () {
  "use strict";

  var alvo, todas = [], equipe = [], porUid = {};

  function el(t, c, x) {
    var e = document.createElement(t);
    if (c) e.className = c;
    if (x !== undefined && x !== null) e.textContent = x;
    return e;
  }

  function nomeDe(uid) {
    var p = porUid[uid];
    return (p && p.nome) || (p && p.email) || "alguém";
  }

  function meuUid() {
    var s = Dados.sessao();
    return s ? s.uid : null;
  }

  function meuNome() {
    var eu = porUid[meuUid()];
    return (eu && eu.nome) || "";
  }

  /* ---------- data e prazo ---------- */

  function pedacosDaData(iso) {
    var p = String(iso || "").split("-");
    if (p.length !== 3) return { d: "--", m: "" };
    var meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    return { d: p[2], m: meses[(+p[1] - 1)] || "" };
  }

  function quandoEscrito(iso) {
    var t = Date.parse(iso);
    if (!isFinite(t)) return "";
    var d = new Date(t);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) +
           " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  /* ---------- o trilho ---------- */

  function desenhar() {
    alvo.textContent = "";

    if (!Pendencias.temBanco()) {
      return vazio("Banco não ligado",
        "Preencha js/config-hub.js para as pendências funcionarem.");
    }

    if (!Dados.sessao()) return convite();

    var eu = meuUid();
    /* O que é meu: o que eu preciso fazer e o que eu cobrei de
       alguém. Pendência de terceiros existe e é visível na lista
       completa, mas não no meu trilho — senão ele vira mural. */
    var minhas = todas.filter(function (p) {
      return p.responsavel === eu || p.criadoPor === eu;
    });

    var abertas = minhas.filter(function (p) { return p.situacao !== "resolvida"; });

    var novo = el("button", "btn-nova", "Abrir pendência");
    novo.type = "button";
    novo.addEventListener("click", abrirFormulario);
    alvo.appendChild(novo);

    if (!abertas.length) {
      alvo.appendChild(vazioElemento("Tudo em dia",
        "Você não tem pendência aberta. Quando alguém abrir uma para você, ela aparece aqui."));
      return;
    }

    [
      { c:"atraso", t:"Atrasadas",     f:function (p) { return Pendencias.estado(p) === "atrasada"; } },
      { c:"hoje",   t:"Para hoje",     f:function (p) { return Pendencias.estado(p) === "hoje"; } },
      { c:"depois", t:"Próximos dias", f:function (p) { return !Pendencias.estado(p); } },
    ].forEach(function (g) {
      var lista = abertas.filter(g.f);
      if (!lista.length) return;
      var f = el("div", "faixa faixa--" + g.c);
      f.appendChild(el("span", "faixa__t", g.t));
      f.appendChild(el("span", "faixa__n", String(lista.length)));
      alvo.appendChild(f);
      lista.forEach(function (p) { alvo.appendChild(cartao(p)); });
    });
  }

  function cartao(p) {
    var e = Pendencias.estado(p);
    var b = el("button", "pen" + (e ? " pen--" + e : ""));
    b.type = "button";
    b.appendChild(el("span", "pen__f"));

    var data = pedacosDaData(p.prazo);
    var pr = el("div", "pen__p");
    pr.appendChild(el("div", "pen__d", data.d));
    pr.appendChild(el("div", "pen__m", data.m));
    b.appendChild(pr);

    var t = el("div", "pen__txt");
    t.appendChild(el("div", "pen__o", p.oque));
    var eu = meuUid();
    var quem = (p.responsavel === eu)
      ? (p.setorOrigem || nomeDe(p.criadoPor)) + " pediu para você"
      : "você pediu para " + (p.setorDestino || nomeDe(p.responsavel));
    t.appendChild(el("div", "pen__q", quem));
    b.appendChild(t);

    if (p.situacao === "fazendo") b.appendChild(el("span", "pen__sel", "fazendo"));

    b.addEventListener("click", function () { abrirFicha(p); });
    return b;
  }

  function vazioElemento(titulo, texto) {
    var v = el("div", "vazio");
    v.appendChild(el("div", "vazio__t", titulo));
    v.appendChild(el("div", "vazio__x", texto));
    return v;
  }
  function vazio(titulo, texto) { alvo.appendChild(vazioElemento(titulo, texto)); }

  /* ---------- convite para entrar ---------- */

  function convite() {
    var v = el("div", "vazio");
    v.appendChild(el("div", "vazio__t", "Suas pendências"));
    v.appendChild(el("div", "vazio__x",
      "Entre com o seu e-mail da Totali para ver o que a equipe abriu para você — e para abrir pendência para os outros."));
    var b = el("button", "btn-nova", "Entrar");
    b.type = "button";
    b.style.marginTop = "12px";
    b.addEventListener("click", abrirEntrada);
    v.appendChild(b);
    alvo.appendChild(v);
  }

  /* ============================================================
     PAINEL — um só, reaproveitado pelos três usos
     ============================================================ */

  var painel, caixa, corpo, titulo;

  function montarPainel() {
    painel = el("div", "pd-painel");
    caixa = el("div", "pd-caixa");
    var cab = el("div", "pd-cab");
    titulo = el("span", "pd-t");
    var x = el("button", "pd-x", "×");
    x.type = "button";
    x.setAttribute("aria-label", "Fechar");
    x.addEventListener("click", fechar);
    cab.appendChild(titulo);
    cab.appendChild(x);
    corpo = el("div", "pd-corpo");
    caixa.appendChild(cab);
    caixa.appendChild(corpo);
    painel.appendChild(caixa);
    painel.addEventListener("click", function (ev) { if (ev.target === painel) fechar(); });
    document.body.appendChild(painel);
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && painel.classList.contains("on")) fechar();
    });
  }

  function abrir(t) {
    titulo.textContent = t;
    corpo.textContent = "";
    painel.classList.add("on");
    return corpo;
  }
  function fechar() { painel.classList.remove("on"); }

  function campo(rotulo, dica) {
    var l = el("label", "pd-campo");
    l.appendChild(el("span", "pd-rot", rotulo));
    var i = document.createElement("input");
    i.type = "text";
    i.className = "pd-caixa-txt";
    if (dica) i.placeholder = dica;
    l.appendChild(i);
    l._entrada = i;
    return l;
  }

  function area(rotulo, dica) {
    var l = el("label", "pd-campo");
    l.appendChild(el("span", "pd-rot", rotulo));
    var i = document.createElement("textarea");
    i.className = "pd-caixa-txt pd-area";
    i.rows = 2;
    if (dica) i.placeholder = dica;
    l.appendChild(i);
    l._entrada = i;
    return l;
  }

  function seletor(rotulo, opcoes, valor) {
    var l = el("label", "pd-campo");
    l.appendChild(el("span", "pd-rot", rotulo));
    var s = document.createElement("select");
    s.className = "pd-caixa-txt";
    opcoes.forEach(function (o) {
      var op = document.createElement("option");
      op.value = o.valor; op.textContent = o.texto;
      if (o.valor === valor) op.selected = true;
      s.appendChild(op);
    });
    l.appendChild(s);
    l._entrada = s;
    return l;
  }

  function erro(texto) {
    var e = el("div", "pd-erro", texto);
    return e;
  }

  /* ---------- entrar ---------- */

  function abrirEntrada() {
    var c = abrir("Entrar no Hub");
    var email = campo("E-mail", "nome@totalicontabilidade.com.br");
    email._entrada.type = "email";
    email._entrada.autocomplete = "username";
    var senha = campo("Senha");
    senha._entrada.type = "password";
    senha._entrada.autocomplete = "current-password";
    c.appendChild(email);
    c.appendChild(senha);
    var msg = erro("");
    msg.hidden = true;
    c.appendChild(msg);

    var b = el("button", "pd-botao pd-botao--principal", "Entrar");
    b.type = "button";
    b.addEventListener("click", function () {
      msg.hidden = true;
      b.disabled = true; b.textContent = "Entrando…";
      Dados.entrar(email._entrada.value.trim(), senha._entrada.value)
        .then(function () { fechar(); carregar(); })
        .catch(function (e) {
          msg.textContent = e.message; msg.hidden = false;
          b.disabled = false; b.textContent = "Entrar";
        });
    });
    c.appendChild(b);
    email._entrada.focus();
  }

  /* ---------- abrir pendência ---------- */

  function abrirFormulario() {
    var c = abrir("Abrir pendência");
    var eu = porUid[meuUid()] || {};
    var setores = (Dados.SETORES_DA_CASA || []).map(function (s) {
      return { valor: s, texto: s };
    });

    var oque = campo("O quê", "Ex.: Enviar o balancete da Gigantte");
    var porque = area("Por quê", "O que depende disso — ajuda quem vai fazer a entender a urgência");
    var quem = seletor("Quem faz", equipe.filter(function (p) { return p.ativo; })
      .map(function (p) { return { valor: p.uid, texto: p.nome + (p.setor ? " · " + p.setor : "") }; }));
    var quando = campo("Para quando");
    quando._entrada.type = "date";
    var destino = seletor("Setor de destino", [{ valor:"", texto:"—" }].concat(setores));
    var como = area("Como fazer", "O caminho, se você já souber");
    var sugestao = area("Sugestão de solução",
      "O que você faria no lugar dele. É este campo que transforma cobrança em ajuda.");

    [oque, porque, quem, quando, destino, como, sugestao].forEach(function (x) { c.appendChild(x); });

    var msg = erro(""); msg.hidden = true;
    c.appendChild(msg);

    var b = el("button", "pd-botao pd-botao--principal", "Abrir pendência");
    b.type = "button";
    b.addEventListener("click", function () {
      msg.hidden = true;
      b.disabled = true; b.textContent = "Abrindo…";
      Pendencias.criar({
        oque: oque._entrada.value,
        porque: porque._entrada.value,
        comoFazer: como._entrada.value,
        sugestao: sugestao._entrada.value,
        responsavel: quem._entrada.value,
        prazo: quando._entrada.value,
        setorOrigem: eu.setor || "",
        setorDestino: destino._entrada.value,
      }).then(function () { fechar(); carregar(); })
        .catch(function (e) {
          msg.textContent = e.message; msg.hidden = false;
          b.disabled = false; b.textContent = "Abrir pendência";
        });
    });
    c.appendChild(b);
    oque._entrada.focus();
  }

  /* ---------- a ficha ---------- */

  function linhaFicha(rotulo, texto) {
    if (!texto) return null;
    var d = el("div", "pd-linha");
    d.appendChild(el("span", "pd-rot", rotulo));
    d.appendChild(el("div", "pd-valor", texto));
    return d;
  }

  function abrirFicha(p) {
    var c = abrir(p.oque);
    var eu = meuUid();

    var meta = el("div", "pd-meta");
    meta.appendChild(el("span", "pd-tag", (p.setorOrigem || nomeDe(p.criadoPor)) +
                                          " → " + (p.setorDestino || nomeDe(p.responsavel))));
    var e = Pendencias.estado(p);
    if (e) meta.appendChild(el("span", "pd-tag pd-tag--" + e, e === "atrasada" ? "Atrasada" : "Vence hoje"));
    meta.appendChild(el("span", "pd-tag", "Aberta por " + nomeDe(p.criadoPor)));
    c.appendChild(meta);

    [
      ["Por quê", p.porque],
      ["Como fazer", p.comoFazer],
      ["Sugestão de solução", p.sugestao],
      ["Para quando", p.prazo ? p.prazo.split("-").reverse().join("/") : ""],
    ].forEach(function (par) {
      var l = linhaFicha(par[0], par[1]);
      if (l) c.appendChild(l);
    });

    /* Situação: só quem faz e quem pediu mexem. */
    if (p.responsavel === eu || p.criadoPor === eu) {
      var sit = el("div", "pd-situacao");
      [["aberta","Aberta"],["fazendo","Fazendo"],["resolvida","Resolvida"]].forEach(function (o) {
        var b = el("button", "pd-sit" + (p.situacao === o[0] ? " on" : ""), o[1]);
        b.type = "button";
        b.addEventListener("click", function () {
          Pendencias.mudarSituacao(p, o[0]).then(function () {
            p.situacao = o[0];
            Array.prototype.forEach.call(sit.children, function (x) { x.classList.remove("on"); });
            b.classList.add("on");
            desenhar();
          }).catch(function (err) { window.alert(err.message); });
        });
        sit.appendChild(b);
      });
      c.appendChild(sit);
    }

    /* Linha do tempo */
    c.appendChild(el("div", "pd-rot pd-rot--secao", "Linha do tempo"));
    var linha = el("div", "pd-linha-tempo", "Carregando…");
    c.appendChild(linha);

    var novo = document.createElement("textarea");
    novo.className = "pd-caixa-txt pd-area";
    novo.rows = 2;
    novo.placeholder = "Acrescentar uma atualização…";
    c.appendChild(novo);

    var b = el("button", "pd-botao", "Acrescentar");
    b.type = "button";
    b.addEventListener("click", function () {
      b.disabled = true;
      Pendencias.acrescentar(p.id, novo.value, meuNome())
        .then(function () { novo.value = ""; b.disabled = false; pintarLinha(p, linha); })
        .catch(function (err) { b.disabled = false; window.alert(err.message); });
    });
    c.appendChild(b);

    if (p.criadoPor === eu) {
      var apagar = el("button", "pd-botao pd-botao--perigo", "Apagar pendência");
      apagar.type = "button";
      apagar.addEventListener("click", function () {
        if (!window.confirm("Apagar esta pendência? A linha do tempo vai junto.")) return;
        Pendencias.apagar(p).then(function () { fechar(); carregar(); })
          .catch(function (err) { window.alert(err.message); });
      });
      c.appendChild(apagar);
    }

    pintarLinha(p, linha);
  }

  function pintarLinha(p, onde) {
    Pendencias.andamento(p.id).then(function (itens) {
      onde.textContent = "";
      if (!itens.length) {
        onde.appendChild(el("div", "pd-vazio", "Nada ainda. A primeira atualização começa a história."));
        return;
      }
      itens.forEach(function (x) {
        var d = el("div", "pd-item");
        var cab = el("div", "pd-item__cab");
        cab.appendChild(el("span", "pd-item__quem", x.autorNome || nomeDe(x.autor)));
        cab.appendChild(el("span", "pd-item__quando", quandoEscrito(x.criadoEm)));
        if (x.editadoEm) cab.appendChild(el("span", "pd-item__editado", "editado"));
        d.appendChild(cab);
        var texto = el("div", "pd-item__txt", x.texto);
        d.appendChild(texto);

        if (Pendencias.podeEditar(x)) {
          var ed = el("button", "pd-corrigir", "corrigir");
          ed.type = "button";
          ed.title = "Você tem 15 minutos para corrigir o que escreveu";
          ed.addEventListener("click", function () {
            var novo = window.prompt("Corrigir o que você escreveu:", x.texto);
            if (novo === null || !novo.trim()) return;
            Pendencias.corrigir(p.id, x, novo)
              .then(function () { pintarLinha(p, onde); })
              .catch(function (err) { window.alert(err.message); });
          });
          d.appendChild(ed);
        }
        onde.appendChild(d);
      });
    }).catch(function (e) {
      onde.textContent = "";
      onde.appendChild(el("div", "pd-vazio", e.message));
    });
  }

  /* ---------- carregar ---------- */

  function carregar() {
    if (!Dados.sessao() || !Pendencias.temBanco()) { desenhar(); return; }
    Promise.all([Pendencias.listar(), Dados.listarEquipe()])
      .then(function (r) {
        todas = r[0];
        equipe = r[1];
        porUid = {};
        equipe.forEach(function (p) { porUid[p.uid] = p; });
        desenhar();
        if (typeof aoMudar === "function") aoMudar(resumo());
      })
      .catch(function (e) {
        alvo.textContent = "";
        vazio("Não consegui carregar", e.message);
      });
  }

  /* Quantas atrasadas e quantas para hoje — o cabeçalho usa. */
  function resumo() {
    var eu = meuUid();
    var minhas = todas.filter(function (p) {
      return (p.responsavel === eu || p.criadoPor === eu) && p.situacao !== "resolvida";
    });
    return {
      atrasadas: minhas.filter(function (p) { return Pendencias.estado(p) === "atrasada"; }).length,
      hoje:      minhas.filter(function (p) { return Pendencias.estado(p) === "hoje"; }).length,
      abertas:   minhas.length,
    };
  }

  var aoMudar = null;

  function iniciar(elemento, aviso) {
    alvo = elemento;
    aoMudar = aviso;
    montarPainel();
    carregar();
  }

  return { iniciar: iniciar, recarregar: carregar, resumo: resumo, entrar: abrirEntrada };

})();
