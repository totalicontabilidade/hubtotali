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

  /* O primeiro setor de uma pessoa. Ela pode ter vários — gente de
     escritório pequeno cobre mais de uma frente — e para etiquetar
     uma pendência um basta. */
  /* O seletor devolve "p:uid" ou "s:Setor". Prefixo em vez de duas
     listas: um valor, uma leitura, sem estado a sincronizar. */
  function destinoPessoa(v) { return String(v || "").indexOf("p:") === 0 ? v.slice(2) : ""; }
  function destinoSetor(v) {
    if (String(v || "").indexOf("s:") === 0) return v.slice(2);
    return setorDe(porUid[destinoPessoa(v)]);
  }

  /* QUEM PODE VER uma reservada, gravado na criação e não
     calculado depois: se alguém virar gerente amanhã, não passa a
     enxergar o que se falou ontem — e se deixar de ser, continua
     enxergando o que já viu. Congelar a lista é o que faz o sigilo
     ser previsível. */
  function quemPodeVer(responsavel, envolvidos) {
    var lista = [meuUid()];
    if (responsavel) lista.push(responsavel);
    (envolvidos || []).forEach(function (u) { lista.push(u); });
    equipe.forEach(function (p) {
      if (!p.ativo) return;
      var seus = Array.isArray(p.setores) ? p.setores : (p.setor ? [p.setor] : []);
      var manda = p.papel === "admin" ||
                  seus.indexOf("Gerência") !== -1 || seus.indexOf("Diretoria") !== -1;
      if (manda) lista.push(p.uid);
    });
    var vistos = {}, saida = [];
    lista.forEach(function (u) { if (u && !vistos[u]) { vistos[u] = true; saida.push(u); } });
    return saida;
  }

  function setoresDe(p) {
    if (!p) return [];
    if (Array.isArray(p.setores)) return p.setores;
    return p.setor ? [p.setor] : [];
  }

  function setorDe(p) {
    if (!p) return "";
    if (Array.isArray(p.setores)) return p.setores[0] || "";
    return p.setor || "";
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

  /* A HORA NO CARTÃO É MAIS CURTA QUE NA FICHA, de propósito. Na
     ficha cabe "15 set às 12:24"; no cartão isso competiria com o
     título. O que a pessoa quer saber ali é "isto é de agora ou de
     antes?" — e para o que é de hoje basta a hora. */
  function horaCurta(iso) {
    var ms = Date.parse(iso);
    if (!isFinite(ms)) return "";
    var d = new Date(ms), hoje = new Date();
    var hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    var mesmoDia = d.getDate() === hoje.getDate()
                && d.getMonth() === hoje.getMonth()
                && d.getFullYear() === hoje.getFullYear();
    if (mesmoDia) return hora;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + hora;
  }

  /* Linha de baixo do cartão: o texto à esquerda, a hora empurrada
     para a direita. Em duas partes e não com posição absoluta —
     absoluta passaria por cima do texto numa tela estreita. */
  function linhaDeBaixo(texto, criadoEm) {
    var d = el("div", "pen__q");
    d.appendChild(el("span", "pen__qt", texto));
    var h = horaCurta(criadoEm);
    if (h) {
      var s = el("span", "pen__quando", h);
      s.title = "Escrita em " + quandoEscrito(criadoEm);
      d.appendChild(s);
    }
    return d;
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
    var meusSetores = setoresDe(porUid[eu] || {});
    var minhas = todas.filter(function (p) { return Pendencias.ehMinha(p, eu, meusSetores); });

    /* QUANDO UM RECADO SAI DA SUA LISTA: quando VOCÊ confirmou.

       Um recado não tem "feito" — tem ciência, uma por pessoa. Então
       não existe um momento em que ele fica pronto para todos ao
       mesmo tempo: ele fica pronto para cada um, no instante em que
       aquela pessoa confirma. Depois disso, deixar o aviso no
       trilho dela seria cobrar duas vezes a mesma coisa.

       Para QUEM ESCREVEU, ele continua à vista enquanto faltar
       alguém: é o painel de quem está esperando. Quando o último
       confirma, o cartão diz que todos confirmaram, e daí quem
       escreveu fecha — porque só ela sabe se o assunto morreu ali
       ou se ainda vai render conversa. Fechar sozinho seria decidir
       isso no lugar dela. */
    var abertas = minhas.filter(function (p) {
      if (p.situacao === "resolvida") return false;
      if (Pendencias.pedeCiencia(p) && p.criadoPor !== eu && Pendencias.jaDeiCiencia(p)) return false;
      return true;
    });

    var novo = el("button", "btn-nova", "Abrir pendência");
    novo.type = "button";
    novo.addEventListener("click", abrirFormulario);
    alvo.appendChild(novo);

    /* A porta para o quadro da casa. Fica embaixo do botão de
       abrir, discreta: o trilho é da pessoa, e o quadro é de vez
       em quando. */
    var todasBtn = el("button", "btn-todas",
      "Ver todas do escritório (" + todas.length + ")");
    todasBtn.type = "button";
    todasBtn.addEventListener("click", abrirTodas);
    alvo.appendChild(todasBtn);

    if (!abertas.length) {
      alvo.appendChild(vazioElemento("Tudo em dia",
        "Você não tem pendência aberta. Quando alguém abrir uma para você, ela aparece aqui."));
      return;
    }

    /* RECADO TEM GRUPO PRÓPRIO, E VEM PRIMEIRO.

       Sem isto ele cairia em "Próximos dias", porque não tem prazo
       e é assim que esse grupo é definido — e aí um aviso ficaria
       misturado com tarefas que têm dono e data, que é exatamente a
       confusão que estamos desfazendo. Primeiro porque aviso serve
       para ser lido antes de o dia começar. */
    [
      { c:"recado", t:"Recados",       f:function (p) { return Pendencias.pedeCiencia(p); } },
      { c:"atraso", t:"Atrasadas",     f:function (p) { return !Pendencias.pedeCiencia(p) && Pendencias.estado(p) === "atrasada"; } },
      { c:"hoje",   t:"Para hoje",     f:function (p) { return !Pendencias.pedeCiencia(p) && Pendencias.estado(p) === "hoje"; } },
      { c:"depois", t:"Próximos dias", f:function (p) { return !Pendencias.pedeCiencia(p) && !Pendencias.estado(p); } },
    ].forEach(function (g) {
      /* DENTRO DO GRUPO, A URGÊNCIA MANDA; depois, o prazo.

         Os grupos continuam sendo por prazo — atrasada, hoje,
         depois — porque é a pergunta que se faz de manhã. A
         urgência ordena DENTRO deles: entre duas que vencem hoje,
         a urgente aparece primeiro. Ordenar tudo por urgência
         esconderia uma atrasada "normal" atrás de uma urgente que
         vence semana que vem, o que seria pior. */
      var lista = abertas.filter(g.f).sort(function (a, b) {
        var d = Pendencias.pesoDaUrgencia(a) - Pendencias.pesoDaUrgencia(b);
        if (d !== 0) return d;
        return String(a.prazo || "9999").localeCompare(String(b.prazo || "9999"));
      });
      if (!lista.length) return;
      var f = el("div", "faixa faixa--" + g.c);
      f.appendChild(el("span", "faixa__t", g.t));
      f.appendChild(el("span", "faixa__n", String(lista.length)));
      alvo.appendChild(f);
      lista.forEach(function (p) { alvo.appendChild(cartao(p)); });
    });
  }

  /* ============================================================
     TODAS AS PENDÊNCIAS DO ESCRITÓRIO
     ------------------------------------------------------------
     O trilho mostra o que é seu, e isso é proposital: se mostrasse
     tudo, viraria mural e ninguém acharia a própria tarefa. Mas
     quem coordena precisa do outro olhar — quantas estão atrasadas,
     em que setor, com quem.

     Não há segredo novo aqui: a regra do banco já deixava toda a
     equipe ler todas as pendências. O que faltava era a tela.
     ============================================================ */
  var FILTRO_PESSOA = "";
  var FILTRO_SETOR = "";
  var MOSTRAR_RESOLVIDAS = false;

  function abrirTodas() {
    var c = abrir("Todas as pendências");

    var barra = el("div", "pd-filtros");

    var pessoas = el("select", "pd-filtro");
    pessoas.appendChild(new Option("Todo mundo", ""));
    equipe.slice().sort(function (a, b) {
      return (a.nome || "").localeCompare(b.nome || "", "pt-BR");
    }).forEach(function (p) {
      pessoas.appendChild(new Option(p.nome || p.email, p.uid));
    });
    pessoas.value = FILTRO_PESSOA;

    var setores = el("select", "pd-filtro");
    setores.appendChild(new Option("Todos os setores", ""));
    var vistos = {};
    todas.forEach(function (p) {
      var s = p.setorDestino || p.setorOrigem || "";
      if (s && !vistos[s]) { vistos[s] = true; setores.appendChild(new Option(s, s)); }
    });
    setores.value = FILTRO_SETOR;

    var resolvidas = document.createElement("label");
    resolvidas.className = "pd-filtro-marca";
    var cx = document.createElement("input");
    cx.type = "checkbox";
    cx.checked = MOSTRAR_RESOLVIDAS;
    resolvidas.appendChild(cx);
    resolvidas.appendChild(el("span", null, "mostrar resolvidas"));

    barra.appendChild(pessoas);
    barra.appendChild(setores);
    barra.appendChild(resolvidas);
    c.appendChild(barra);

    var lista = el("div", "pd-todas");
    c.appendChild(lista);

    function pintar() {
      lista.textContent = "";

      var vistas = todas.filter(function (p) {
        if (!MOSTRAR_RESOLVIDAS && p.situacao === "resolvida") return false;
        if (FILTRO_PESSOA && !Pendencias.ehMinha(p, FILTRO_PESSOA, setoresDe(porUid[FILTRO_PESSOA] || {}))) return false;
        if (FILTRO_SETOR && (p.setorDestino || p.setorOrigem) !== FILTRO_SETOR) return false;
        return true;
      });

      if (!vistas.length) {
        lista.appendChild(el("div", "pd-vazio", "Nada com esses filtros."));
        return;
      }

      /* Diz o que NÃO está aqui. O quadro carrega as sessenta
         resolvidas mais recentes; sem esta linha, quem procurasse
         uma antiga concluiria que ela foi apagada. */
      if (MOSTRAR_RESOLVIDAS) {
        lista.appendChild(el("div", "pd-vazio",
          "As resolvidas mais recentes aparecem aqui. As mais antigas continuam guardadas no banco, " +
          "fora desta tela — elas saem na cópia de segurança."));
      }

      [
        { c: "recado", t: "Recados",       f: function (p) { return p.situacao !== "resolvida" && Pendencias.pedeCiencia(p); } },
        { c: "atraso", t: "Atrasadas",     f: function (p) { return p.situacao !== "resolvida" && !Pendencias.pedeCiencia(p) && Pendencias.estado(p) === "atrasada"; } },
        { c: "hoje",   t: "Para hoje",     f: function (p) { return p.situacao !== "resolvida" && !Pendencias.pedeCiencia(p) && Pendencias.estado(p) === "hoje"; } },
        { c: "depois", t: "Próximos dias", f: function (p) { return p.situacao !== "resolvida" && !Pendencias.pedeCiencia(p) && !Pendencias.estado(p); } },
        { c: "feito",  t: "Resolvidas",    f: function (p) { return p.situacao === "resolvida"; } },
      ].forEach(function (g) {
        var doGrupo = vistas.filter(g.f);
        if (!doGrupo.length) return;
        var f = el("div", "faixa faixa--" + g.c);
        f.appendChild(el("span", "faixa__t", g.t));
        f.appendChild(el("span", "faixa__n", String(doGrupo.length)));
        lista.appendChild(f);
        doGrupo.forEach(function (p) {
          var cart = cartao(p, true);
          lista.appendChild(cart);
        });
      });
    }

    pessoas.addEventListener("change", function () { FILTRO_PESSOA = pessoas.value; pintar(); });
    setores.addEventListener("change", function () { FILTRO_SETOR = setores.value; pintar(); });
    cx.addEventListener("change", function () { MOSTRAR_RESOLVIDAS = cx.checked; pintar(); });

    pintar();
  }

  function cartao(p, comDono) {
    var e = Pendencias.estado(p);
    var naoVi = !Pendencias.jaVi(p);
    var b = el("button", "pen" + (e ? " pen--" + e : "") + (naoVi ? " pen--nova" : ""));
    b.type = "button";
    b.appendChild(el("span", "pen__f"));

    /* O QUADRADINHO DA ESQUERDA É O PRAZO, e recado não tem prazo.
       Mostrava "--", que se lê como dado faltando e não como "não
       se aplica". Num recado ele diz o que a coisa é. */
    var pr = el("div", "pen__p");
    if (Pendencias.pedeCiencia(p)) {
      pr.className = "pen__p pen__p--recado";
      pr.appendChild(el("div", "pen__m", "aviso"));
    } else {
      var data = pedacosDaData(p.prazo);
      pr.appendChild(el("div", "pen__d", data.d));
      pr.appendChild(el("div", "pen__m", data.m));
    }
    b.appendChild(pr);

    var t = el("div", "pen__txt");

    var titulo = el("div", "pen__o");
    if (naoVi) titulo.appendChild(el("span", "pen__ponto", ""));
    titulo.appendChild(document.createTextNode(p.oque));
    t.appendChild(titulo);

    /* A etiqueta só aparece quando NÃO é o normal: etiquetar tudo
       faz a etiqueta deixar de significar alguma coisa. */
    if (p.urgencia === "urgente" || p.urgencia === "quando_der") {
      t.appendChild(el("span", "pen__u pen__u--" + p.urgencia,
        p.urgencia === "urgente" ? "Urgente" : "Quando der"));
    }
    var eu = meuUid();
    var quem;
    var ehRecado = Pendencias.pedeCiencia(p);

    /* RECADO NÃO TEM DONO NEM "PEDIU PARA VOCÊ". Tem uma coisa a
       confirmar, ou já confirmada. Quem mandou vê a conta; quem foi
       chamado vê o que falta fazer. */
    if (ehRecado) {
      var cc = Pendencias.contaDaCiencia(p);
      var placar = cc.deram + " de " + cc.total;
      if (!cc.total) {
        /* Aviso que ninguém precisa confirmar: "0 de 0" não diz
           nada a ninguém. */
        quem = "recado — só seu";
      } else if (Pendencias.devoCiencia(p) && !Pendencias.jaDeiCiencia(p)) {
        quem = "recado — confirme que leu";
      } else if (cc.deram >= cc.total) {
        /* Completo. Para quem escreveu, é o sinal de que pode
           fechar; para quem lê, de que não falta ninguém. */
        quem = "recado — todos confirmaram · " + placar;
      } else if (Pendencias.jaDeiCiencia(p)) {
        quem = "recado — você confirmou · " + placar;
      } else {
        quem = "recado · " + placar + " confirmaram";
      }
    }
    /* DE MIM PARA MIM NÃO TEM QUEM PEDIU. O cartão dizia "Legalização
       pediu para você" numa pendência que a própria pessoa abriu para
       si — porque o setor de origem é o dela, e a frase saía pronta
       sem ninguém conferir se fazia sentido. O caso sempre existiu
       (dava para se designar), mas só apareceu quando o "só eu"
       tornou isso comum. */
    else if (p.criadoPor === eu && p.responsavel === eu) {
      quem = "anotação sua";
    } else if (p.responsavel === eu) {
      quem = (p.setorOrigem || nomeDe(p.criadoPor)) + " pediu para você";
    } else if (p.criadoPor === eu) {
      quem = "você pediu para " + nomeDe(p.responsavel);
    } else {
      /* Marcado, não responsável: o cartão diz isso, para a
         pessoa não achar que a tarefa é dela. */
      quem = "marcaram você · faz: " + nomeDe(p.responsavel);
    }
    /* No quadro do escritório o dono importa: sem ele, quarenta
       cartões parecem todos da mesma pessoa. No trilho pessoal
       seria repetição — lá tudo já é seu. */
    /* No quadro do escritório, recado também não tem dono: dizer
       "Setor —" ali seria pior que não dizer nada. O placar é a
       informação útil, e ele já está em "quem". */
    if (comDono && !ehRecado) {
      var dono = p.responsavel ? nomeDe(p.responsavel) : "Setor " + (p.setorDestino || "—");
      var setor = p.setorDestino || p.setorOrigem || "";
      t.appendChild(linhaDeBaixo(dono + (setor ? " · " + setor : ""), p.criadoEm));
    } else {
      t.appendChild(linhaDeBaixo(quem, p.criadoEm));
    }
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

  /* Marcar gente: uma caixa de nomes com quadradinho. Preferi
     isso ao seletor múltiplo do navegador porque naquele é
     preciso segurar Ctrl para escolher dois — e ninguém
     descobre isso sozinho. */
  function marcador(rotulo, pessoas, excluir, jaMarcados) {
    var l = el("div", "pd-campo");
    l.appendChild(el("span", "pd-rot", rotulo));
    var caixa = el("div", "pd-marcar");
    var escolhidos = [];
    pessoas.forEach(function (p) {
      if (p.uid === excluir) return;
      var linha = el("label", "pd-marcar__i");
      var c = document.createElement("input");
      c.type = "checkbox";
      c.value = p.uid;
      /* Já marcado quando quem chamou disse "todos": no recado com
         ciência o normal é o escritório inteiro, e obrigar a marcar
         sete caixinhas para chegar ao caso comum é cobrar trabalho
         pelo padrão. Desmarcar quem não entra é mais rápido. */
      if (jaMarcados) { c.checked = true; escolhidos.push(p.uid); }
      c.addEventListener("change", function () {
        var i = escolhidos.indexOf(p.uid);
        if (c.checked && i === -1) escolhidos.push(p.uid);
        if (!c.checked && i !== -1) escolhidos.splice(i, 1);
      });
      linha.appendChild(c);
      linha.appendChild(el("span", "pd-marcar__n", p.nome || p.email));
      var st = Array.isArray(p.setores) ? p.setores.join(", ") : (p.setor || "");
      if (st) linha.appendChild(el("span", "pd-marcar__s", st));
      caixa.appendChild(linha);
    });
    if (!caixa.children.length) {
      caixa.appendChild(el("div", "pd-vazio", "Ninguém mais cadastrado ainda."));
    }
    l.appendChild(caixa);
    l._valores = function () { return escolhidos.slice(); };
    return l;
  }

  function seletor(rotulo, opcoes, valor) {
    var l = el("label", "pd-campo");
    l.appendChild(el("span", "pd-rot", rotulo));
    var s = document.createElement("select");
    s.className = "pd-caixa-txt";
    opcoes.forEach(function (o) {
      var op = document.createElement("option");
      op.value = o.valor;
      op.textContent = o.texto;
      /* A PARTE SECUNDÁRIA VAI NUM <span> DENTRO DA OPÇÃO.
         Navegador que entende appearance:base-select desenha a
         opção com CSS, e aí o span pode ficar menor e mais claro.
         Navegador que não entende ignora o span e mostra o texto
         corrido, "Anne (Pessoal)" — que continua legível. Por isso
         os parênteses ficam no texto e não no estilo: eles são o
         que sobra quando o estilo não chega. */
      if (o.secundario) {
        op.appendChild(document.createTextNode(" "));
        var sec = document.createElement("span");
        sec.className = "pd-op-sec";
        sec.textContent = "(" + o.secundario + ")";
        op.appendChild(sec);
      }
      if (o.desabilitado) op.disabled = true;
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

    var oque = campo("O quê", "Ex.: Enviar o balancete da Gigantte");
    var porque = area("Por quê", "O que depende disso — ajuda quem vai fazer a entender a urgência");
    /* Pessoa OU setor. A lista mistura os dois de propósito, com
       os setores no fim: quem sabe o nome escolhe o nome, quem não
       sabe escolhe a área, e ninguém precisa entender a diferença
       entre dois campos parecidos. */
    var quem = seletor("Quem faz", equipe.filter(function (p) { return p.ativo; })
      .map(function (p) {
        /* Todos os setores da pessoa, não só o primeiro: em
           escritório pequeno quase todo mundo cobre mais de uma
           frente, e ver "Rone · Contábil" quando ele também é do
           Fiscal esconde metade de quem ele é.

           O SETOR É LEMBRETE, NÃO CRACHÁ. Com o mesmo peso do nome
           ele parecia definir a pessoa. Vai como parte secundária
           da opção: menor e mais claro onde o navegador deixa
           estilizar a lista, entre parênteses onde não deixa. */
        var s = setoresDe(p).join(", ");
        return { valor: "p:" + p.uid, texto: p.nome, secundario: s };
      })
      .concat([{ valor: "", texto: "— ou mande para um setor —", desabilitado: true }])
      .concat((Dados.SETORES_DA_CASA || []).map(function (s) {
        return { valor: "s:" + s, texto: "Setor " + s };
      })));
    var quando = campo("Para quando");
    quando._entrada.type = "date";

    /* URGÊNCIA. Não é o prazo: prazo é quando vence, urgência é o
       que fazer primeiro quando duas coisas vencem no mesmo dia.
       Três níveis — com cinco, tudo vira "alta". */
    var urgencia = seletor("Urgência", [
      { valor: "urgente",    texto: "Urgente — na frente das outras" },
      { valor: "normal",     texto: "Normal" },
      { valor: "quando_der", texto: "Quando der — sem pressa" },
    ], "normal");

    /* AQUI HAVIA "Setor de destino" e "Como fazer".

       O SETOR saiu porque era perguntar duas vezes a mesma coisa:
       quem faz já foi escolhido logo acima, e a pessoa tem setor
       no cadastro. Duas perguntas para o mesmo dado é convite para
       as duas se contradizerem. O setor passou a vir de quem vai
       fazer, e continua sendo gravado — para a pendência de hoje
       continuar dizendo o setor de hoje se a pessoa mudar de área
       amanhã.

       O "COMO FAZER" saiu porque quem abre pendência quase nunca
       sabe o como melhor do que quem vai fazer — e quando sabe, o
       lugar disso é a Sugestão, que já existe e é opcional do mesmo
       jeito. Campo que quase sempre fica vazio não é neutro: ele
       alonga o formulário e faz a pessoa desistir de abrir a
       pendência, que é o contrário do que queremos. */
    var sugestao = area("Sugestão de solução",
      "O que você faria no lugar dele. É este campo que transforma cobrança em ajuda.");

    /* RESERVADA. Fica no fim, depois de tudo, porque é decisão
       sobre o que já foi escrito — e desmarcada por padrão: sigilo
       que vem ligado de fábrica deixa de ser escolha. */
    /* ESCOLHA DE NATUREZA, E NÃO UMA CAIXA PARA MARCAR.

       ISTO JÁ FOI UMA CAIXA "É um recado — cada pessoa confirma que
       leu", e a caixa custou caro. Uma pessoa da equipe abriu OITO
       pendências seguidas marcando-a: o rótulo descreve o que uma
       pendência É — um recado, um pedido —, então marcar parecia o
       certo. E ao marcar, o campo "Quem faz" desaparecia; ela então
       usou a lista de ciência como se fosse "quem faz", deixando só
       o nome do colega. Resultado: oito tarefas sem responsável,
       que não apareciam na lista de quem devia fazê-las.

       A culpa não é de quem usou. Caixa solta pergunta "isto é
       verdade?" e aceita qualquer leitura do rótulo. Duas opções
       lado a lado perguntam "qual das duas?", e aí a pessoa compara
       — e a que ela não quer fica visível, explicando o que perdeu
       ao não escolher. */
    var recado = el("div", "pd-campo");
    recado.appendChild(el("span", "pd-rot", "O que é isto"));
    var natureza = el("div", "pd-plateia");

    function opcaoNatureza(valor, titulo, dica, marcada) {
      var l = document.createElement("label");
      l.className = "pd-plateia__op";
      var r = document.createElement("input");
      r.type = "radio";
      r.name = "pd-natureza";
      r.value = valor;
      r.checked = !!marcada;
      var txt = el("div", "pd-plateia__txt");
      txt.appendChild(el("div", "pd-plateia__t", titulo));
      txt.appendChild(el("div", "pd-dica", dica));
      l.appendChild(r);
      l.appendChild(txt);
      r.addEventListener("change", aplicarRecado);
      natureza.appendChild(l);
      return r;
    }

    var rTarefa = opcaoNatureza("tarefa", "Tarefa — alguém faz",
      "Uma pessoa, ou um setor, é responsável e marca quando fica pronto.", true);
    var crec = opcaoNatureza("recado", "Recado — várias pessoas confirmam que leram",
      "Aviso para o escritório. Não tem responsável nem botão de feito: cada pessoa " +
      "chamada confirma que leu, e você acompanha quantas já confirmaram.", false);
    recado.appendChild(natureza);

    var reservada = el("div", "pd-campo");
    var lr = document.createElement("label");
    lr.className = "pd-filtro-marca";
    var cr = document.createElement("input");
    cr.type = "checkbox";
    lr.appendChild(cr);
    lr.appendChild(el("span", null, "Reservada — some da lista de todo mundo"));
    reservada.appendChild(lr);

    /* DUAS RESERVAS DIFERENTES, E A DIFERENÇA IMPORTA.
       A primeira é para assunto de pessoal: as partes precisam
       resolver, e gerência e diretoria respondem pela casa, então
       enxergam. A segunda é para o que é só da pessoa — e aí
       incluir a chefia por padrão seria justamente o contrário do
       que ela pediu.

       Quem pode ver é gravado na criação e não recalculado depois:
       quem virar gerente amanhã não passa a enxergar o que se
       falou ontem. */
    var plateia = el("div", "pd-plateia");
    plateia.hidden = true;

    function escolha(valor, titulo, dica, marcada) {
      var l = document.createElement("label");
      l.className = "pd-plateia__op";
      var r = document.createElement("input");
      r.type = "radio";
      r.name = "pd-plateia";
      r.value = valor;
      r.checked = !!marcada;
      var txt = el("div", "pd-plateia__txt");
      txt.appendChild(el("div", "pd-plateia__t", titulo));
      txt.appendChild(el("div", "pd-dica", dica));
      l.appendChild(r);
      l.appendChild(txt);
      r.addEventListener("change", aplicarPlateia);
      plateia.appendChild(l);
      return r;
    }

    var rPartes = escolha("partes", "As partes, mais gerência e diretoria",
      "Para assunto de pessoal, salário, advertência. Quem responde pela casa acompanha.", true);
    var rSoEu = escolha("so-eu", "Só eu",
      "Mais ninguém do escritório vê, nem administrador. Vira uma anotação sua, " +
      "com prazo e linha do tempo, e sem responsável para designar.", false);

    reservada.appendChild(plateia);

    var ativos = equipe.filter(function (p) { return p.ativo; });
    var marcar = marcador("Marcar mais alguém", ativos, meuUid());
    var chamados = marcador("Quem precisa dar ciência", ativos, meuUid(), true);
    chamados.hidden = true;
    chamados.appendChild(el("div", "pd-dica",
      "Cada pessoa marcada vê o recado na lista dela e aparece um botão para confirmar " +
      "que leu. Você acompanha quantos já confirmaram."));
    marcar.appendChild(el("div", "pd-dica",
      "Quem for marcado também vê esta pendência na página dele. A responsabilidade continua sendo de uma pessoa só."));

    function soEu() { return cr.checked && rSoEu.checked; }

    /* "Só eu" ESCONDE quem faz e quem mais vê, em vez de deixar os
       campos ali sem efeito. Designar alguém que não pode abrir a
       pendência criaria tarefa invisível: a pessoa seria a
       responsável e nunca saberia. Melhor a tela dizer que naquele
       modo isso não existe. */
    function aplicarPlateia() {
      plateia.hidden = !cr.checked;
      var so = soEu();
      quem.hidden = so;
      marcar.hidden = so;
    }
    cr.addEventListener("change", aplicarPlateia);

    [oque, porque, recado, quem, chamados, quando, urgencia, sugestao, marcar, reservada]
      .forEach(function (x) { c.appendChild(x); });

    /* RECADO E RESERVADA SÃO EXCLUDENTES, e não por gosto: a
       plateia de uma reservada é congelada na criação e não
       incluiria os chamados — eles não conseguiriam nem LER o
       recado, muito menos dar ciência. Um recado para o escritório
       também não é, por definição, assunto reservado. */
    function aplicarRecado() {
      var r = crec.checked;
      quem.hidden = r;
      marcar.hidden = r;
      chamados.hidden = !r;
      reservada.hidden = r;
      /* A DIFERENÇA QUE O HESLEY APONTOU: tarefa tem prazo, recado
         não. Some o campo em vez de deixá-lo ali pedindo uma data
         que não vai a lugar nenhum. */
      quando.hidden = r;
      if (r && cr.checked) { cr.checked = false; aplicarPlateia(); }
    }
    /* Os dois rádios já chamam aplicarRecado no change; esta chamada
       é para o estado inicial ficar coerente com "Tarefa" marcada. */
    aplicarRecado();

    var msg = erro(""); msg.hidden = true;
    c.appendChild(msg);

    var b = el("button", "pd-botao pd-botao--principal", "Abrir pendência");
    b.type = "button";
    b.addEventListener("click", function () {
      msg.hidden = true;

      /* RECADO DE UMA PESSOA, OU DE NENHUMA, É LEGÍTIMO.

         Eu havia recusado recado com menos de duas pessoas, para
         impedir o engano que produziu as oito pendências órfãs. Era
         a trava errada no lugar errado: existe recado para uma
         pessoa só, e existe aviso que a própria pessoa escreve para
         si, sem ninguém a confirmar. O que confundia não era o
         número de nomes — era a caixa de marcar, e ela já virou
         escolha entre duas naturezas. */

      b.disabled = true; b.textContent = "Abrindo…";
      Pendencias.criar({
        oque: oque._entrada.value,
        porque: porque._entrada.value,
        sugestao: sugestao._entrada.value,
        /* Três naturezas, três leituras do formulário. Ler campo
           escondido daria documento que contradiz a escolha.

           RECADO: sem responsável e sem setor — não é tarefa de
           ninguém. Quem responde por ele é a lista de ciência.
           SÓ EU: de mim para mim, plateia de um.
           NORMAL: pessoa ou setor, como sempre foi. */
        responsavel: crec.checked ? ""
                     : soEu() ? meuUid()
                     : destinoPessoa(quem._entrada.value),
        /* Recado não tem prazo, e o campo nem aparece. Ler o valor
           de um campo escondido gravaria uma data que ninguém
           escolheu — a que estivesse ali antes de a pessoa trocar
           de natureza. */
        prazo: crec.checked ? "" : quando._entrada.value,
        ehRecado: crec.checked,
        urgencia: urgencia._entrada.value,
        setorOrigem: (Array.isArray(eu.setores) ? eu.setores[0] : eu.setor) || "",
        setorDestino: (crec.checked || soEu()) ? "" : destinoSetor(quem._entrada.value),
        confidencial: crec.checked ? false : cr.checked,
        podemVer: crec.checked ? []
                  : !cr.checked ? []
                  : soEu() ? [meuUid()]
                  : quemPodeVer(destinoPessoa(quem._entrada.value), marcar._valores()),
        envolvidos: (crec.checked || soEu()) ? [] : marcar._valores(),
        deveDarCiencia: crec.checked ? chamados._valores() : [],
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

    /* Abriu, leu. A marca vai para o banco sem segurar a tela: se
       falhar, o pior que acontece é continuar aparecendo como não
       lida — e ninguém perde nada por isso. */
    if (!Pendencias.jaVi(p)) {
      Pendencias.marcarComoVista(p).then(function (mudou) { if (mudou) desenhar(); });
    }
    var eu = meuUid();

    var meta = el("div", "pd-meta");
    /* A seta "origem → destino" só diz algo quando há dois lados.
       Numa anotação que a pessoa abriu para si mesma ela virava
       "Legalização → Hesley", inventando um pedido que não houve. E
       num recado virava "TI → alguém", que é pior: "alguém" era o
       nome que nomeDe() dá a um responsável vazio. Recado não tem
       destinatário único — tem uma lista, e ela já aparece no bloco
       de ciência logo abaixo. */
    if (Pendencias.pedeCiencia(p)) {
      var cr = Pendencias.contaDaCiencia(p);
      meta.appendChild(el("span", "pd-tag", "Recado de " + nomeDe(p.criadoPor)));
      meta.appendChild(el("span", "pd-tag",
        cr.total === 1 ? "ciência de 1 pessoa" : "ciência de " + cr.total + " pessoas"));
    } else if (p.criadoPor && p.criadoPor === p.responsavel) {
      meta.appendChild(el("span", "pd-tag", "Anotação de " + nomeDe(p.criadoPor)));
    } else {
      meta.appendChild(el("span", "pd-tag", (p.setorOrigem || nomeDe(p.criadoPor)) +
                                            " → " + (p.setorDestino || nomeDe(p.responsavel))));
    }
    var e = Pendencias.estado(p);
    if (e) meta.appendChild(el("span", "pd-tag pd-tag--" + e, e === "atrasada" ? "Atrasada" : "Vence hoje"));
    /* Numa anotação de si para si, "Aberta por X" e "Faz: X" são a
       mesma informação da etiqueta acima, repetida duas vezes. Três
       etiquetas com o mesmo nome fazem o olho parar de ler todas. */
    if (!Pendencias.pedeCiencia(p) && (!p.criadoPor || p.criadoPor !== p.responsavel)) {
      meta.appendChild(el("span", "pd-tag", "Aberta por " + nomeDe(p.criadoPor)));
      meta.appendChild(el("span", "pd-tag", p.responsavel
        ? "Faz: " + nomeDe(p.responsavel)
        : "Para o setor " + (p.setorDestino || "—")));
    }
    /* Reservada agora se reconhece pela COLEÇÃO de onde veio, não
       por um campo dentro do documento. */
    if (Pendencias.ehReservada(p)) {
      /* "Reservada" e "Só eu" precisam se distinguir na lista. Sem
         isso a pessoa não sabe, olhando, se a chefia enxerga
         aquela linha — e é justamente essa a dúvida que a levou a
         marcar a caixa. A plateia de um é a prova: o documento só
         tem o uid dela. */
      var so = Array.isArray(p.podemVer) && p.podemVer.length === 1;
      var etiqueta = el("span", "pd-tag pd-tag--reservada", so ? "Só eu" : "Reservada");
      etiqueta.title = so
        ? "Ninguém mais do escritório vê esta pendência."
        : "As partes, mais gerência e diretoria.";
      meta.appendChild(etiqueta);
    }
    (p.envolvidos || []).forEach(function (uid) {
      meta.appendChild(el("span", "pd-tag pd-tag--marcado", "@" + nomeDe(uid)));
    });
    c.appendChild(meta);

    var corpo = el("div", "pd-corpo");
    c.appendChild(corpo);

    function pintarCorpo() {
      corpo.textContent = "";
      [
        ["Por quê", p.porque],
        /* "Como fazer" saiu junto com o campo. Pendência antiga
           que tenha o texto continua guardando — só não é
           mostrada, porque o campo deixou de existir. */
        ["Sugestão de solução", p.sugestao],
        ["Para quando", p.prazo ? p.prazo.split("-").reverse().join("/") : ""],
        ["Urgência", p.urgencia === "urgente" ? "Urgente" :
                     p.urgencia === "quando_der" ? "Quando der" : ""],
      ].forEach(function (par) {
        var l = linhaFicha(par[0], par[1]);
        if (l) corpo.appendChild(l);
      });

      /* Trinta minutos para consertar o próprio pedido. Passou
         disso o botão some sozinho — não fica ali prometendo o que
         o banco já não deixa fazer. */
      if (!Pendencias.podeCorrigirPedido(p)) return;

      var corrigir = el("button", "pd-corrigir", "corrigir o pedido");
      corrigir.type = "button";
      corrigir.title = "Você tem 30 minutos para corrigir o que escreveu";
      corrigir.addEventListener("click", function () { editarCorpo(); });
      corpo.appendChild(corrigir);
    }

    function editarCorpo() {
      corpo.textContent = "";
      var campos = {};

      function campo(chave, rotulo, valor, tipo) {
        var l = el("div", "pd-campo");
        l.appendChild(el("span", "pd-rot", rotulo));
        var caixa = document.createElement(tipo === "data" ? "input" : "textarea");
        if (tipo === "data") caixa.type = "date"; else caixa.rows = 2;
        caixa.className = "pd-corrigir__caixa";
        caixa.value = valor || "";
        l.appendChild(caixa);
        campos[chave] = caixa;
        corpo.appendChild(l);
      }

      campo("oque", "O quê", p.oque);
      campo("porque", "Por quê", p.porque);
      campo("sugestao", "Sugestão de solução", p.sugestao);
      campo("prazo", "Para quando", p.prazo, "data");

      var ok  = el("button", "pd-corrigir__ok", "Salvar correção");
      var nao = el("button", "pd-corrigir__nao", "Deixar como está");
      ok.type = "button"; nao.type = "button";
      var acoes = el("div", "pd-corrigir__acoes");
      acoes.appendChild(ok); acoes.appendChild(nao);
      corpo.appendChild(acoes);

      nao.addEventListener("click", pintarCorpo);

      ok.addEventListener("click", function () {
        var novo = {};
        Object.keys(campos).forEach(function (k) { novo[k] = campos[k].value.trim(); });
        if (!novo.oque) { campos.oque.focus(); return; }
        ok.disabled = true;
        ok.textContent = "Salvando…";
        Pendencias.corrigirPedido(p, novo)
          .then(function () {
            Object.keys(novo).forEach(function (k) { p[k] = novo[k]; });
            pintarCorpo();
            desenhar();
          })
          .catch(function (err) {
            ok.disabled = false;
            ok.textContent = "Salvar correção";
            corpo.appendChild(el("div", "pd-corrigir__erro", err.message));
          });
      });
    }

    pintarCorpo();

    /* ---------- Ciência ----------
       Vem ANTES da situação, e antes do resto das ações: num recado
       é a única coisa que se espera de quem abriu a ficha. */
    if (Pendencias.pedeCiencia(p)) {
      var cx = el("div", "pd-ciencia");
      var cont = Pendencias.contaDaCiencia(p);
      var cab = el("div", "pd-ciencia__cab");
      cab.appendChild(el("span", "pd-rot", "Quem confirmou que leu"));
      var placarEl = el("span", "pd-ciencia__n", cont.deram + " de " + cont.total);
      cab.appendChild(placarEl);
      cx.appendChild(cab);

      var nomes = el("div", "pd-ciencia__lista");
      function pintarCiencia() {
        var atual = Pendencias.contaDaCiencia(p);
        placarEl.textContent = atual.deram + " de " + atual.total;
        nomes.textContent = "";
        (p.deveDarCiencia || []).forEach(function (u) {
          var deu = Array.isArray(p.ciencia) && p.ciencia.indexOf(u) !== -1;
          var n = el("span", "pd-ciencia__p" + (deu ? " pd-ciencia__p--ok" : ""),
                     (deu ? "✓ " : "") + nomeDe(u));
          nomes.appendChild(n);
        });
      }
      pintarCiencia();
      cx.appendChild(nomes);

      /* O botão aparece só para quem foi chamado e ainda não
         confirmou. Quem não foi chamado vê a lista e nada mais —
         dar ciência por curiosidade sujaria a prova. */
      if (Pendencias.devoCiencia(p) && !Pendencias.jaDeiCiencia(p)) {
        var bc = el("button", "pd-botao pd-botao--principal", "Confirmo que li");
        bc.type = "button";
        bc.addEventListener("click", function () {
          bc.disabled = true; bc.textContent = "Registrando…";
          Pendencias.darCiencia(p).then(function () {
            bc.remove();
            pintarCiencia();
            cx.appendChild(el("div", "pd-dica", "Ciência registrada. Obrigado."));
            desenhar();
          }).catch(function (err) {
            bc.disabled = false; bc.textContent = "Confirmo que li";
            window.alert(err.message);
          });
        });
        cx.appendChild(bc);
      } else if (Pendencias.jaDeiCiencia(p)) {
        cx.appendChild(el("div", "pd-dica", "Você já confirmou que leu este recado."));
      }
      c.appendChild(cx);
    }

    /* Situação: só quem faz e quem pediu mexem. */
    if (p.responsavel === eu || p.criadoPor === eu) {
      var sit = el("div", "pd-situacao");
      [["aberta","Aberta"],["fazendo","Fazendo"],["resolvida","Resolvida"]].forEach(function (o) {
        var b = el("button", "pd-sit" + (p.situacao === o[0] ? " on" : ""), o[1]);
        b.type = "button";
        b.addEventListener("click", function () {
          Pendencias.mudarSituacao(p, o[0], meuNome()).then(function () {
            p.situacao = o[0];
            Array.prototype.forEach.call(sit.children, function (x) { x.classList.remove("on"); });
            b.classList.add("on");
            /* A anotação automática acabou de entrar: repinta a
               conversa para ela aparecer sem recarregar. */
            pintarLinha(p, linha);
            desenhar();
          }).catch(function (err) { window.alert(err.message); });
        });
        sit.appendChild(b);
      });
      c.appendChild(sit);
    }

    /* ---------- anexos ---------- */
    if (Pendencias.temAnexos()) {
      c.appendChild(el("div", "pd-rot pd-rot--secao", "Anexos"));
      var caixaAnexos = el("div", "pd-anexos");
      c.appendChild(caixaAnexos);
      pintarAnexos(p, caixaAnexos);
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
      Pendencias.acrescentar(p, novo.value, meuNome())
        .then(function () { novo.value = ""; b.disabled = false; pintarLinha(p, linha); })
        .catch(function (err) { b.disabled = false; window.alert(err.message); });
    });
    c.appendChild(b);

    if (p.criadoPor === eu) {
      var apagar = el("button", "pd-botao pd-botao--perigo", "Apagar pendência");
      apagar.type = "button";
      apagar.addEventListener("click", function () { avisarAntesDeApagar(p, apagar, c, fechar); });
      c.appendChild(apagar);
    }

    pintarLinha(p, linha);
  }

  /* ---------- o aviso antes de apagar ----------
     NÃO É window.confirm, e a razão vale escrever: a caixa nativa
     não cabe uma lista, não dá para ler com calma, e alguns
     navegadores deixam o usuário desligá-la — e uma confirmação
     desligada devolve "não", que aqui até seria seguro, mas
     esconderia do usuário por que o botão parou de funcionar.

     O aviso abre DENTRO da ficha, nomeia cada arquivo que vai
     junto, e exige um segundo clique num botão que diz exatamente
     o que vai acontecer. Apagar é irreversível: o mínimo é a
     pessoa ver o tamanho do estrago antes. */
  function avisarAntesDeApagar(p, botao, onde, fechar) {
    if (onde.querySelector(".pd-perigo")) return;
    botao.hidden = true;

    var caixa = el("div", "pd-perigo");
    caixa.appendChild(el("div", "pd-perigo__t", "Apagar esta pendência?"));

    /* O texto começa genérico e é reescrito com os números reais
       assim que eles chegam. Prometer "a linha do tempo vai junto"
       sem dizer quantos comentários são deixa a pessoa imaginar —
       e o que ela imagina costuma ser menos do que é. */
    var texto = el("div", "pd-perigo__x",
      "A linha do tempo vai junto, com tudo o que foi escrito nela. Não há como desfazer.");
    caixa.appendChild(texto);

    var acoes = el("div", "pd-perigo__acoes");
    var sim = el("button", "pd-botao pd-botao--perigo", "Apagar tudo");
    var nao = el("button", "pd-botao", "Deixar como está");
    sim.type = "button"; nao.type = "button";
    sim.disabled = true;
    sim.textContent = "Conferindo os anexos…";
    acoes.appendChild(sim); acoes.appendChild(nao);
    caixa.appendChild(acoes);
    onde.appendChild(caixa);

    nao.addEventListener("click", function () { caixa.remove(); botao.hidden = false; });

    /* Os arquivos são listados PELO NOME antes de qualquer coisa
       ser apagada: "3 anexos" não diz nada, "o contrato assinado"
       diz tudo. */
    Promise.all([Pendencias.lerAnexos(p), Pendencias.andamento(p).catch(function () { return []; })])
    .then(function (r) {
      var anexos = r[0], conversa = r[1];

      texto.textContent = conversa.length
        ? "A conversa vai junto: " + conversa.length +
          (conversa.length === 1 ? " comentário será apagado" : " comentários serão apagados") +
          " e não poderão ser recuperados."
        : "Não há como desfazer.";

      if (anexos.length) {
        var lista = el("div", "pd-perigo__arquivos");
        /* Sem "Storage": ninguém que usa o Hub sabe o que é isso, e
           o que a pessoa precisa entender não é ONDE o arquivo
           mora — é que ele não volta. */
        lista.appendChild(el("div", "pd-perigo__rot",
          anexos.length === 1 ? "Este arquivo será apagado para sempre e não poderá ser recuperado:"
                              : "Estes " + anexos.length + " arquivos serão apagados para sempre e não poderão ser recuperados:"));
        anexos.forEach(function (a) {
          lista.appendChild(el("div", "pd-perigo__arq",
            a.nome + " · " + tamanhoLegivel(a.tamanho) + " · " + nomeDe(a.por)));
        });
        caixa.insertBefore(lista, acoes);
        sim.textContent = "Apagar a pendência e " +
          (anexos.length === 1 ? "o anexo" : "os " + anexos.length + " anexos");
      } else {
        sim.textContent = "Apagar tudo";
      }
      sim.disabled = false;
    });

    sim.addEventListener("click", function () {
      sim.disabled = true;
      sim.textContent = "Apagando…";
      Pendencias.apagar(p)
        .then(function () { fechar(); carregar(); })
        .catch(function (err) {
          sim.disabled = false;
          sim.textContent = "Tentar de novo";
          var velho = caixa.querySelector(".pd-perigo__erro");
          if (velho) velho.remove();
          caixa.appendChild(el("div", "pd-perigo__erro", err.message));
        });
    });
  }

  /* ---------- ver antes de enviar ----------
     Anexo não se apaga sozinho: uma vez enviado, ele só sai junto
     com a pendência inteira. Isso torna o erro caro — mandar o
     arquivo errado é mandar para sempre — e é por isso que vale um
     passo a mais antes.

     Imagem aparece de verdade, e o resto se abre numa aba se a
     pessoa quiser conferir. O endereço temporário é do próprio
     navegador; nada saiu do computador ainda. */
  function conferirAntesDeEnviar(p, onde, botao, arquivo) {
    var velho = onde.querySelector(".pd-previa");
    if (velho) velho.remove();
    botao.hidden = true;

    var caixa = el("div", "pd-previa");
    var endereco = URL.createObjectURL(arquivo);

    var cab = el("div", "pd-previa__cab");
    cab.appendChild(el("span", "pd-previa__n", arquivo.name));
    cab.appendChild(el("span", "pd-previa__t", tamanhoLegivel(arquivo.size)));
    caixa.appendChild(cab);

    /* Sem regex: a barra invertida de / some na edição e o teste
       passa a significar outra coisa. Quinta vez nesta base. */
    var ehImagem = String(arquivo.type || "").indexOf("image/") === 0;
    if (ehImagem) {
      var img = document.createElement("img");
      img.className = "pd-previa__img";
      img.src = endereco;
      img.alt = "";
      caixa.appendChild(img);
    } else {
      var ver = el("button", "pd-previa__ver", "Abrir para conferir");
      ver.type = "button";
      ver.addEventListener("click", function () {
        /* A aba abre dentro do clique, senão o navegador a barra. */
        var aba = window.open("", "_blank");
        if (aba) { try { aba.opener = null; } catch (e) {} aba.location = endereco; }
      });
      caixa.appendChild(ver);
      caixa.appendChild(el("div", "pd-previa__x",
        (arquivo.type || "tipo desconhecido") + " — ainda no seu computador, nada foi enviado."));
    }

    var acoes = el("div", "pd-previa__acoes");
    var enviar = el("button", "pd-botao pd-botao--principal", "Enviar este arquivo");
    var trocar = el("button", "pd-botao", "Escolher outro");
    var cancelar = el("button", "pd-botao", "Cancelar");
    [enviar, trocar, cancelar].forEach(function (x) { x.type = "button"; acoes.appendChild(x); });
    caixa.appendChild(acoes);
    onde.appendChild(caixa);

    function encerrar() {
      URL.revokeObjectURL(endereco);
      caixa.remove();
      botao.hidden = false;
    }

    cancelar.addEventListener("click", encerrar);
    trocar.addEventListener("click", function () { encerrar(); botao.click(); });

    enviar.addEventListener("click", function () {
      enviar.disabled = true; trocar.disabled = true; cancelar.disabled = true;
      enviar.textContent = "Enviando…";
      Pendencias.enviarAnexo(p, arquivo)
        .then(function () { URL.revokeObjectURL(endereco); pintarAnexos(p, onde); })
        .catch(function (err) {
          enviar.disabled = false; trocar.disabled = false; cancelar.disabled = false;
          enviar.textContent = "Tentar de novo";
          var e = caixa.querySelector(".pd-anexo__erro");
          if (e) e.remove();
          caixa.appendChild(el("div", "pd-anexo__erro", err.message));
        });
    });
  }

  function tamanhoLegivel(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " kB";
    return (Math.round(bytes / 1024 / 1024 * 10) / 10) + " MB";
  }

  function pintarAnexos(p, onde) {
    onde.textContent = "";
    onde.appendChild(el("div", "pd-vazio", "Carregando…"));
    Pendencias.lerAnexos(p).then(function (lista) { desenharAnexos(p, onde, lista); });
  }

  function desenharAnexos(p, onde, lista) {
    onde.textContent = "";

    lista.forEach(function (a) {
      var linha = el("div", "pd-anexo");

      /* Botão, não link com endereço dentro. O arquivo não tem
         endereço público: ele é buscado na hora, com a sessão de
         quem clicou, e o endereço temporário que sai daí só vale
         neste navegador.

         A aba é aberta ANTES da busca, ainda dentro do clique. Se
         fosse aberta depois, o navegador a barraria como janela
         não pedida — do ponto de vista dele, o clique já passou. */
      var link = el("button", "pd-anexo__n", a.nome);
      link.type = "button";
      link.title = "Abrir " + a.nome;
      link.addEventListener("click", function () {
        /* SEM "noopener" AQUI, de propósito. Com ele o navegador
           devolve null em vez da aba, e o caminho alternativo
           levaria a aba ATUAL para o arquivo — tirando o Hub da
           frente de quem só queria ver um anexo. A aba é nossa e
           recebe um endereço temporário nosso; o vínculo com ela é
           cortado logo abaixo, que dá no mesmo sem o efeito
           colateral. */
        var aba = window.open("", "_blank");
        if (aba) { try { aba.opener = null; } catch (e) {} }
        link.disabled = true;
        Pendencias.abrirAnexo(a)
          .then(function (endereco) {
            if (aba) aba.location = endereco;
            else window.location = endereco;
            /* Solta a memória do arquivo depois de a aba pegá-lo. */
            window.setTimeout(function () { URL.revokeObjectURL(endereco); }, 60000);
          })
          .catch(function (err) {
            if (aba) aba.close();
            var velho = onde.querySelector(".pd-anexo__erro");
            if (velho) velho.remove();
            onde.appendChild(el("div", "pd-anexo__erro", err.message));
          })
          .then(function () { link.disabled = false; });
      });
      linha.appendChild(link);
      linha.appendChild(el("span", "pd-anexo__t", tamanhoLegivel(a.tamanho)));
      /* Quem mandou e quando. O "quando" estava sendo gravado
         desde o começo e nunca aparecia na tela — e é metade da
         utilidade: "o Fulano mandou" sem "às 14h de terça" não
         ajuda a reconstruir o que aconteceu. */
      linha.appendChild(el("span", "pd-anexo__q",
        nomeDe(a.por) + (a.em ? " · " + quandoEscrito(a.em) : "")));
      onde.appendChild(linha);
    });

    if (!lista.length) {
      onde.appendChild(el("div", "pd-vazio", "Nenhum arquivo ainda."));
    }

    var b = el("button", "pd-anexo__btn", "Anexar arquivo");
    b.type = "button";
    b.title = "Até 10 MB por arquivo. Anexo não se apaga sozinho: é prova do que foi combinado.";
    b.addEventListener("click", function () {
      var entrada = document.createElement("input");
      entrada.type = "file";
      entrada.addEventListener("change", function () {
        var arquivo = entrada.files && entrada.files[0];
        if (!arquivo) return;
        conferirAntesDeEnviar(p, onde, b, arquivo);
      });
      entrada.click();
    });
    onde.appendChild(b);
  }

  function pintarLinha(p, onde) {
    Pendencias.andamento(p).then(function (itens) {
      onde.textContent = "";
      if (!itens.length) {
        onde.appendChild(el("div", "pd-vazio", "Nada ainda. A primeira atualização começa a história."));
        return;
      }
      itens.forEach(function (x) {
        var d = el("div", "pd-item" + (x.doSistema ? " pd-item--sistema" : ""));
        var cab = el("div", "pd-item__cab");
        cab.appendChild(el("span", "pd-item__quem", x.autorNome || nomeDe(x.autor)));
        cab.appendChild(el("span", "pd-item__quando", quandoEscrito(x.criadoEm)));
        if (x.editadoEm) cab.appendChild(el("span", "pd-item__editado", "editado"));
        d.appendChild(cab);
        var texto = el("div", "pd-item__txt", x.texto);
        d.appendChild(texto);

        /* A correção acontece na própria ficha, não numa caixa do
           navegador. A caixa nativa parecia mais barata de fazer e
           custava caro: não dá para estilizar, vira um pop-up do
           sistema operacional no celular, some o resto da tela de
           vista, e o navegador deixa o usuário desligar esse tipo
           de caixa — desligada, a correção deixaria de existir sem
           nenhum aviso. */
        if (Pendencias.podeEditar(x) && !x.doSistema) {
          var ed = el("button", "pd-corrigir", "corrigir");
          ed.type = "button";
          ed.title = "Você tem 30 minutos para corrigir o que escreveu";
          ed.addEventListener("click", function () {
            var caixa = document.createElement("textarea");
            caixa.className = "pd-corrigir__caixa";
            caixa.value = x.texto;
            caixa.rows = 3;

            var ok = el("button", "pd-corrigir__ok", "Salvar correção");
            ok.type = "button";
            var nao = el("button", "pd-corrigir__nao", "Deixar como está");
            nao.type = "button";

            var acoes = el("div", "pd-corrigir__acoes");
            acoes.appendChild(ok);
            acoes.appendChild(nao);

            texto.hidden = true;
            ed.hidden = true;
            d.appendChild(caixa);
            d.appendChild(acoes);
            caixa.focus();

            function desistir() {
              caixa.remove();
              acoes.remove();
              texto.hidden = false;
              ed.hidden = false;
            }

            nao.addEventListener("click", desistir);
            caixa.addEventListener("keydown", function (ev) {
              if (ev.key === "Escape") desistir();
            });

            ok.addEventListener("click", function () {
              var novo = caixa.value.trim();
              if (!novo) return;
              ok.disabled = true;
              ok.textContent = "Salvando…";
              Pendencias.corrigir(p, x, novo)
                .then(function () { pintarLinha(p, onde); })
                .catch(function (err) {
                  ok.disabled = false;
                  ok.textContent = "Salvar correção";
                  var aviso = el("div", "pd-corrigir__erro", err.message);
                  d.appendChild(aviso);
                });
            });
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
        ultimaAssinatura = assinatura();
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
      return Pendencias.ehMinha(p, eu, setoresDe(porUid[eu] || {})) && p.situacao !== "resolvida";
    });
    return {
      atrasadas: minhas.filter(function (p) { return Pendencias.estado(p) === "atrasada"; }).length,
      hoje:      minhas.filter(function (p) { return Pendencias.estado(p) === "hoje"; }).length,
      abertas:   minhas.length,
      /* Chegou e ninguém abriu. É este número que vira o destaque
         no ícone da barra. */
      naoLidas:  minhas.filter(function (p) { return !Pendencias.jaVi(p); }).length,
    };
  }

  var aoMudar = null;

  function iniciar(elemento, aviso) {
    alvo = elemento;
    aoMudar = aviso;
    montarPainel();
    carregar();
  }

  /* ---------- Atualizar sozinho, sem atropelar ninguém ----------

     O Hub fica aberto dias numa aba que ninguém recarrega. Sem isto,
     uma pendência aberta pela manhã só aparecia para o colega no dia
     em que ele fechasse e abrisse o navegador.

     DUAS CAUTELAS, e as duas vêm de pensar em quem está usando:

     1. NÃO REDESENHA COM PAINEL ABERTO. Se a pessoa está lendo uma
        ficha, ou pior, escrevendo um comentário ou preenchendo o
        formulário, refazer a tela embaixo dela apagaria o que ela
        digitou. A atualização espera o painel fechar.

     2. NÃO REDESENHA SE NADA MUDOU. Uma assinatura do que importa é
        comparada antes de tocar no DOM: sem isto, a cada minuto os
        cartões piscariam na cara de quem está olhando. */

  function painelAberto() { return painel.classList.contains("on"); }

  function assinatura() {
    return todas.map(function (p) {
      return [p.id, p.situacao, p.oque, p.prazo, p.urgencia,
              (p.vistas || []).length, (p.ciencia || []).length].join("|");
    }).sort().join("\n");
  }

  var ultimaAssinatura = null;

  function conferirSozinho() {
    if (!Dados.sessao() || !Pendencias.temBanco()) return;
    if (painelAberto()) return;
    Promise.all([Pendencias.listar(), Dados.listarEquipe()])
      .then(function (r) {
        /* Conferido de novo: o painel pode ter aberto enquanto o
           banco respondia. */
        if (painelAberto()) return;
        var antes = ultimaAssinatura;
        todas = r[0];
        equipe = r[1];
        porUid = {};
        equipe.forEach(function (x) { porUid[x.uid] = x; });
        var agora = assinatura();
        if (agora === antes) return;
        ultimaAssinatura = agora;
        desenhar();
        if (typeof aoMudar === "function") aoMudar(resumo());
      })
      .catch(function () { /* sem rede: a próxima volta tenta */ });
  }

  return { iniciar: iniciar, recarregar: carregar, resumo: resumo, entrar: abrirEntrada,
           conferirSozinho: conferirSozinho, painelAberto: painelAberto,
           /* A barra lateral abre o quadro por aqui. */
           abrirTodas: function () { if (Dados.sessao()) abrirTodas(); } };

})();
