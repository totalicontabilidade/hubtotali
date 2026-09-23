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

  /* ---------- O HISTÓRICO BUSCADO SOBREVIVE À ATUALIZAÇÃO ----------

     listar() devolve as abertas mais as concluídas recentes, e o
     trilho se redesenha de minuto em minuto trocando "todas" pelo
     que veio. Sem guardar as páginas antigas à parte, cada
     atualização jogaria fora o histórico que a pessoa acabou de
     mandar buscar: a gaveta encolheria sozinha na cara dela, um
     minuto depois de ela abrir. */
  var extraHistorico = [];

  function juntarComExtra(base) {
    if (!extraHistorico.length) return base;
    var tem = {};
    base.forEach(function (p) { tem[p.id] = true; });
    return base.concat(extraHistorico.filter(function (p) { return !tem[p.id]; }));
  }

  function guardarExtra(lote) {
    var tem = {};
    extraHistorico.forEach(function (p) { tem[p.id] = true; });
    todas.forEach(function (p) { tem[p.id] = true; });
    (lote || []).forEach(function (p) {
      if (p && p.id && !tem[p.id]) { tem[p.id] = true; extraHistorico.push(p); }
    });
  }

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
  function quemPodeVer(responsavel, envolvidos, comChefia) {
    var lista = [meuUid()];
    if (responsavel) lista.push(responsavel);
    (envolvidos || []).forEach(function (u) { lista.push(u); });
    /* SEM CHEFIA é a terceira plateia: eu e quem eu marcar, e mais
       ninguém. Existe porque "as partes mais gerência e diretoria"
       e "só eu" não cobriam o caso do meio — combinar algo com uma
       pessoa só, sem a casa acompanhando. */
    if (comChefia === false) {
      var vistos0 = {}, saida0 = [];
      lista.forEach(function (u) { if (u && !vistos0[u]) { vistos0[u] = true; saida0.push(u); } });
      return saida0;
    }
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
    /* DUAS PILHAS: o que ainda pede algo de mim, e o que já
       terminou do meu lado. Nada desaparece — o que terminou desce
       para "Concluídas", fechado.

       ANTES ISSO SUMIA, e o Hesley reparou. Recado que eu confirmei
       saía da lista e só era achável no quadro do escritório; e
       pendência resolvida nunca aparecia no trilho pessoal. As
       duas coisas continuavam no banco, mas "está no banco" não é
       resposta para quem quer consultar depois. */
    function terminouParaMim(p) {
      if (p.situacao === "resolvida") return true;
      /* Recado não tem "resolvida" para quem recebe: tem a minha
         ciência. Dada, acabou para mim — mesmo que falte gente. */
      if (Pendencias.pedeCiencia(p) && p.criadoPor !== eu && Pendencias.jaDeiCiencia(p)) return true;
      return false;
    }
    var abertas = minhas.filter(function (p) { return !terminouParaMim(p); });
    var concluidas = minhas.filter(terminouParaMim).sort(function (a, b) {
      return String(b.criadoEm || "").localeCompare(String(a.criadoEm || ""));
    });

    var novo = el("button", "btn-nova", "Abrir pendência");
    novo.type = "button";
    novo.addEventListener("click", abrirFormulario);
    alvo.appendChild(novo);

    /* A porta para o quadro da casa, logo abaixo do botão de abrir.

       O NÚMERO É SÓ DO QUE ESTÁ ATIVO. Antes ele contava tudo o
       que estava carregado, concluídas inclusive — e com o
       histórico agora guardado, esse número só cresceria, sem
       dizer nada sobre o trabalho de hoje. Concluída tem contagem
       própria, na gaveta; aqui o número responde "quanto tem em
       aberto no escritório". Sem nada ativo, o número some: zero
       não é aviso. */
    var ativasDaCasa = todas.filter(function (p) { return p.situacao !== "resolvida"; }).length;
    var todasBtn = el("button", "btn-todas",
      "Ver todas do escritório" + (ativasDaCasa ? " (" + ativasDaCasa + ")" : ""));
    todasBtn.title = ativasDaCasa === 1
      ? "1 pendência em aberto no escritório"
      : ativasDaCasa + " pendências em aberto no escritório";
    todasBtn.type = "button";
    todasBtn.addEventListener("click", abrirTodas);
    alvo.appendChild(todasBtn);

    /* "Tudo em dia" NÃO INTERROMPE o resto do trilho.

       Aqui havia um return, e ele tirava da tela exatamente o que
       mais importa depois: as concluídas. Quem está com tudo em dia
       é quem mais tem histórico para consultar — e era justo essa
       pessoa que via a gaveta desaparecer. Sem o return os grupos
       de abertas não desenham nada, porque as listas vêm vazias, e
       o histórico continua logo abaixo. */
    if (!abertas.length) {
      alvo.appendChild(vazioElemento("Tudo em dia",
        "Você não tem pendência aberta. Quando alguém abrir uma para você, ela aparece aqui."));
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

    /* CONCLUÍDAS FICAM, MAS FECHADAS.

       Guardar e mostrar são coisas diferentes. Se as concluídas
       aparecessem abertas, o trilho deixaria de responder à
       pergunta que ele existe para responder — "o que preciso
       fazer?" — e viraria histórico com pendência no meio. Fechado,
       o número fica à vista e o conteúdo a um clique.

       Lembra do estado entre um desenho e o outro: sem isso, a
       atualização de minuto em minuto fecharia a gaveta na cara de
       quem acabou de abri-la. */
    /* Histórico vazio POR ERRO não pode parecer histórico vazio. */
    var erroHist = Pendencias.erroDasResolvidas && Pendencias.erroDasResolvidas();
    if (!concluidas.length && erroHist) {
      var fe = el("div", "faixa faixa--atraso");
      fe.appendChild(el("span", "faixa__t", "Concluídas"));
      alvo.appendChild(fe);
      alvo.appendChild(el("div", "pd-vazio",
        "Não consegui carregar o histórico. Nada foi perdido — as concluídas estão no " +
        "banco, e é a consulta que está falhando: " + erroHist));
    }

    if (concluidas.length) {
      var fh = el("button", "faixa faixa--feito faixa--dobra");
      fh.type = "button";
      fh.appendChild(el("span", "faixa__t", "Concluídas"));
      fh.appendChild(el("span", "faixa__n", String(concluidas.length)));
      var seta = el("span", "faixa__seta", HISTORICO_ABERTO ? "⌄" : "›");
      fh.appendChild(seta);
      alvo.appendChild(fh);

      var caixaH = el("div", "historico");
      caixaH.hidden = !HISTORICO_ABERTO;
      concluidas.forEach(function (p) { caixaH.appendChild(cartao(p)); });

      /* DE ONDE VEM ESTA LISTA, dito na cara.

         As concluídas carregadas são as mais recentes DO
         ESCRITÓRIO, e o filtro de "minhas" acontece depois, aqui no
         navegador. Consequência que ninguém adivinharia sozinho:
         num mês movimentado, as concluídas dos colegas ocupam a
         cota e as minhas antigas ficam de fora desta gaveta — sem
         terem saído do banco. Quem pagina de verdade é o quadro do
         escritório, que tem botão e busca; então o caminho fica
         escrito aqui em vez de a pessoa concluir que se perdeu. */
      /* A GAVETA PESSOAL PAGINA SOZINHA.

         Antes ela mostrava apenas o que a lista geral tinha
         trazido, e um bilhete mandava a pessoa até o quadro do
         escritório para ver o resto do que é dela. Mandar alguém
         trocar de tela para alcançar os próprios registros é
         empurrar para ela um trabalho que é nosso. */
      if (Pendencias.historicoCompleto()) {
        caixaH.appendChild(el("div", "pd-dica",
          "Está tudo aqui — estas são todas as suas concluídas."));
      } else {
        /* TRUNCADO NÃO É COMPLETO, e a mensagem do teto estava
           dentro do ramo de "completo" — onde nunca podia aparecer.
           Aqui é o lugar dela: o histórico não acabou, e o mesmo
           botão continua de onde a varredura parou. */
        var parou = Pendencias.historicoTruncado();
        var rodapeH = el("div", "pd-mais");
        var bH = el("button", "btn-fav",
          parou ? "Continuar buscando as mais antigas" : "Carregar todas as antigas");
        bH.type = "button";
        bH.addEventListener("click", function () {
          bH.disabled = true;
          bH.textContent = "Buscando…";
          var naMao = todas.filter(function (p) { return p.situacao === "resolvida"; }).length;
          Pendencias.todoOHistorico(naMao, function (n) {
            bH.textContent = "Buscando… " + n;
          }).then(function (lote) {
            guardarExtra(lote);
            todas = juntarComExtra(todas);
            desenhar();
          }).catch(function (e) {
            bH.disabled = false;
            bH.textContent = parou ? "Continuar buscando as mais antigas"
                                   : "Carregar todas as antigas";
            rodapeH.appendChild(el("span", "pd-mais__erro", e.message));
          });
        });
        rodapeH.appendChild(bH);
        rodapeH.appendChild(el("span", "pd-dica", parou
          ? "Parei nas mais recentes para não travar a tela. Há concluídas ainda mais "
            + "antigas no banco, e isto retoma a busca de onde ela parou — pode clicar "
            + "quantas vezes precisar."
          : "Até aqui vieram só as concluídas recentes do escritório, e as suas "
            + "antigas podem ter ficado fora da cota. Isto busca o histórico inteiro."));
        caixaH.appendChild(rodapeH);
      }

      alvo.appendChild(caixaH);

      fh.addEventListener("click", function () {
        HISTORICO_ABERTO = !HISTORICO_ABERTO;
        caixaH.hidden = !HISTORICO_ABERTO;
        seta.textContent = HISTORICO_ABERTO ? "⌄" : "›";
      });
    }
  }

  /* Fora da função de propósito: precisa sobreviver ao redesenho. */
  var HISTORICO_ABERTO = false;

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

  /* Busca sem acento e sem expressão regular. Sem acento porque
     ninguém digita "ITABAIANA" com acento na pressa; sem regex
     porque a barra invertida de \s desaparece em edição automática
     e, quando desaparece, o separador vira a letra "s" — já
     aconteceu neste arquivo, e o bug era invisível. */
  var ACENTOS = "áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ";
  var SEM_ACENTO = "aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC";
  function semAcento(s) {
    var saida = "";
    var texto = String(s || "").toLowerCase();
    for (var i = 0; i < texto.length; i++) {
      var pos = ACENTOS.indexOf(texto.charAt(i));
      saida += pos === -1 ? texto.charAt(i) : SEM_ACENTO.charAt(pos).toLowerCase();
    }
    return saida;
  }

  /* Períodos em texto, comparando o começo do ISO. Data é string
     "2026-09-15T…", então "começa com 2026-09" é o mês, e
     "começa com 2026" é o ano — sem montar um Date para nada. */
  function dentroDoPeriodo(p, periodo) {
    if (!periodo) return true;
    var quando = String(p.criadoEm || "");
    var hoje = new Date();
    var ano = String(hoje.getFullYear());
    var mes = ano + "-" + ("0" + (hoje.getMonth() + 1)).slice(-2);
    if (periodo === "mes") return quando.indexOf(mes) === 0;
    if (periodo === "ano") return quando.indexOf(ano) === 0;
    if (periodo === "90") {
      var limite = new Date(hoje.getTime() - 90 * 24 * 3600 * 1000).toISOString();
      return quando >= limite;
    }
    return true;
  }

  var FILTRO_BUSCA = "";
  var FILTRO_PERIODO = "";

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

    /* BUSCA PRIMEIRO, porque é o filtro que resolve sozinho a
       maioria das procuras: quem quer achar "GIGANTTE" digita
       GIGANTTE, não sai combinando pessoa com setor. */
    var busca = document.createElement("input");
    busca.className = "pd-filtro pd-filtro--busca";
    busca.type = "search";
    busca.placeholder = "Procurar no título ou no texto";
    busca.value = FILTRO_BUSCA;
    busca.setAttribute("autocapitalize", "off");

    var periodo = el("select", "pd-filtro");
    [["", "Qualquer data"], ["mes", "Este mês"], ["90", "Últimos 90 dias"], ["ano", "Este ano"]]
      .forEach(function (o) { periodo.appendChild(new Option(o[1], o[0])); });
    periodo.value = FILTRO_PERIODO;

    barra.appendChild(busca);
    barra.appendChild(pessoas);
    barra.appendChild(setores);
    barra.appendChild(periodo);
    barra.appendChild(resolvidas);
    c.appendChild(barra);

    var lista = el("div", "pd-todas");
    c.appendChild(lista);

    /* ---------- Carregar mais concluídas ----------
       Antes havia aqui um bilhete dizendo que as antigas ficavam
       "fora desta tela". Dizer a verdade era melhor que esconder,
       mas continuava sendo um beco: a pessoa sabia que o dado
       existia e não tinha como alcançá-lo. Agora tem botão. */
    var rodape = el("div", "pd-mais");
    c.appendChild(rodape);

    function quantasResolvidasTenho() {
      return todas.filter(function (p) { return p.situacao === "resolvida"; }).length;
    }

    var varrendoAgora = false;
    /* A VARREDURA SOZINHA ACONTECE UMA VEZ.

       pintar() roda a cada tecla digitada na busca, e chama a
       varredura. Enquanto ela corre, as guardas de dentro seguram
       as repetições. Depois que ela PARA NO TETO, porém, o
       histórico não está completo — e sem esta marca a tela
       recomeçaria sozinha, de quarenta em quarenta páginas, até
       varrer um banco inteiro sem ninguém ter pedido. Passado o
       teto, continuar é decisão de quem está na frente da tela. */
    var jaVarreuSozinho = false;

    /* ---------- FILTRAR PASSA A ALCANÇAR TUDO ----------

       O filtro peneirava o que já estava na mão. Quem procurasse
       algo concluído em março recebia "Nada" e concluiria que o
       registro se perdeu — o mesmo tipo de mentira que o .catch das
       resolvidas contava.

       Agora, no instante em que alguém filtra com o histórico à
       vista, o sistema vai buscar o histórico INTEIRO e só depois
       peneira. Custa algumas consultas de uma vez, e a troca é
       clara: prefiro gastar leitura a responder "não existe" sobre
       algo que existe.

       Uma varredura por vez, e só uma por sessão — a guarda está
       dentro de todoOHistorico(), porque isto é chamado a cada
       tecla digitada na busca. */
    function garantirHistoricoInteiro() {
      if (varrendoAgora || Pendencias.historicoCompleto()) return;
      varrendoAgora = true;
      rodape._erro = "";
      pintarRodape();
      Pendencias.todoOHistorico(quantasResolvidasTenho(), function (n) {
        rodape._parcial = n;
        pintarRodape();
      })
        .then(function (lote) {
          guardarExtra(lote);
          todas = juntarComExtra(todas);
          varrendoAgora = false;
          rodape._parcial = 0;
          pintar();
          /* O TRILHO ATRÁS TAMBÉM MUDOU. Sem isto, a gaveta pessoal
             seguia oferecendo "carregar todas as antigas" depois de
             o histórico inteiro já estar na mão — botão que não faz
             nada é pior que botão que não existe. */
          desenhar();
        })
        .catch(function (e) {
          varrendoAgora = false;
          /* Falha de rede não pode gastar a única tentativa
             automática: mexer no filtro de novo tenta de novo. */
          jaVarreuSozinho = false;
          rodape._erro = e.message;
          pintarRodape();
        });
    }

    function pintarRodape() {
      rodape.textContent = "";
      if (!MOSTRAR_RESOLVIDAS) return;

      if (varrendoAgora) {
        var quantasJa = rodape._parcial || 0;
        rodape.appendChild(el("span", "pd-mais__n", "Procurando também nas mais antigas… "
          + (quantasJa === 1 ? "1 trazida" : quantasJa + " trazidas")));
        return;
      }

      var tenho = quantasResolvidasTenho();
      rodape.appendChild(el("span", "pd-mais__n", tenho === 1
        ? "1 concluída carregada"
        : tenho + " concluídas carregadas"));
      if (rodape._erro) rodape.appendChild(el("span", "pd-mais__erro", rodape._erro));

      if (Pendencias.historicoCompleto()) {
        rodape.appendChild(el("span", "pd-mais__n", "— isto é tudo o que existe"));
        return;
      }

      /* O TETO VIRA BOTÃO, e não muro. Parar depois de doze mil é
         para a tela não travar; exigir que alguém mexa no código
         para passar disso seria transformar cuidado em bloqueio. */
      if (Pendencias.historicoTruncado()) {
        rodape.appendChild(el("span", "pd-mais__n",
          "Parei nas " + tenho + " mais recentes para não travar a tela — há mais no banco."));
        var seguir = el("button", "btn-fav", "Continuar buscando as mais antigas");
        seguir.type = "button";
        seguir.addEventListener("click", function () { garantirHistoricoInteiro(); });
        rodape.appendChild(seguir);
        return;
      }

      var b = el("button", "btn-fav", "Carregar mais");
      b.type = "button";
      b.addEventListener("click", function () {
        b.disabled = true; b.textContent = "Buscando…";
        Pendencias.maisResolvidas(tenho, 60).then(function (novas) {
          /* Sem repetidas: offset pode devolver algo que já está
             aqui se alguém resolveu uma pendência entre as duas
             consultas. */
          guardarExtra(novas);
          todas = juntarComExtra(todas);
          pintar();
          desenhar();
        }).catch(function (e) {
          b.disabled = false; b.textContent = "Carregar mais";
          rodape.appendChild(el("span", "pd-mais__erro", e.message));
        });
      });
      rodape.appendChild(b);

      /* De uma vez, para quem sabe que vai procurar fundo e não
         quer clicar de sessenta em sessenta. Pequeno: o comum é
         filtrar, e filtrar já faz isto sozinho. */
      var tudo = el("button", "pd-todos__b", "carregar todas");
      tudo.type = "button";
      tudo.addEventListener("click", garantirHistoricoInteiro);
      rodape.appendChild(tudo);
    }

    function pintar() {
      lista.textContent = "";

      /* A varredura começa ANTES de peneirar, para que a mensagem
         de vazio já saia dizendo que a busca está indo mais fundo
         em vez de afirmar que não há nada. */
      var filtrando = !!(FILTRO_BUSCA || FILTRO_PERIODO || FILTRO_PESSOA || FILTRO_SETOR);
      if (filtrando && MOSTRAR_RESOLVIDAS && !jaVarreuSozinho) {
        jaVarreuSozinho = true;
        garantirHistoricoInteiro();
      }

      pintarRodape();

      var vistas = todas.filter(function (p) {
        if (!MOSTRAR_RESOLVIDAS && p.situacao === "resolvida") return false;
        if (FILTRO_PESSOA && !Pendencias.ehMinha(p, FILTRO_PESSOA, setoresDe(porUid[FILTRO_PESSOA] || {}))) return false;
        if (FILTRO_SETOR && (p.setorDestino || p.setorOrigem) !== FILTRO_SETOR) return false;
        if (!dentroDoPeriodo(p, FILTRO_PERIODO)) return false;
        if (FILTRO_BUSCA) {
          /* Procura no título E no texto: quem lembra "aquela do
             balancete" acha pelo título, e quem lembra o teor acha
             pelo porquê. */
          var alvoBusca = semAcento(p.oque) + " " + semAcento(p.porque) + " " + semAcento(p.sugestao);
          var termos = semAcento(FILTRO_BUSCA).split(" ").filter(Boolean);
          for (var i = 0; i < termos.length; i++) {
            if (alvoBusca.indexOf(termos[i]) === -1) return false;
          }
        }
        return true;
      });

      if (!vistas.length) {
        /* "NADA" SÓ PODE SIGNIFICAR NADA.

           Os filtros trabalham sobre o que já está carregado no
           navegador: eles peneiram, não vão buscar mais fundo no
           banco. Então procurar por algo concluído em março, com
           só as concluídas recentes na mão, dava "Nada com esses
           filtros" — e a pessoa desistia achando que o registro
           não existia. É o mesmo defeito que o .catch das
           resolvidas tinha: um vazio de alcance parecendo um vazio
           de existência. Agora ele diz o que falta e o que fazer. */
        var texto;
        if (varrendoAgora) {
          texto = "Procurando no histórico inteiro…";
        } else if (filtrando && !MOSTRAR_RESOLVIDAS) {
          /* O engano mais fácil de cometer nesta tela: procurar algo
             que já foi concluído, com as concluídas fora da lista, e
             ler "Nada" como "nunca existiu". */
          texto = "Nada com esses filtros entre as pendências em aberto. "
                + "As concluídas estão fora desta lista — marque “mostrar resolvidas” "
                + "para procurar no histórico também.";
        } else if (filtrando && Pendencias.historicoTruncado()) {
          texto = "Nada entre as concluídas que examinei. Parei nas mais recentes para "
                + "não travar a tela, e há mais antigas no banco — use “Continuar "
                + "buscando as mais antigas” aqui embaixo e procure de novo.";
        } else if (filtrando && Pendencias.historicoCompleto()) {
          texto = "Nada com esses filtros — e o histórico inteiro foi examinado.";
        } else {
          texto = "Nada com esses filtros.";
        }
        lista.appendChild(el("div", "pd-vazio", texto));
        return;
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
    periodo.addEventListener("change", function () { FILTRO_PERIODO = periodo.value; pintar(); });
    /* input, e não change: filtrar enquanto se digita é o que faz a
       busca valer a pena numa lista longa. */
    busca.addEventListener("input", function () { FILTRO_BUSCA = busca.value; pintar(); });
    setores.addEventListener("change", function () { FILTRO_SETOR = setores.value; pintar(); });
    cx.addEventListener("change", function () { MOSTRAR_RESOLVIDAS = cx.checked; pintar(); });

    pintar();
  }

  function cartao(p, comDono) {
    var e = Pendencias.estado(p);
    var naoVi = !Pendencias.jaVi(p);
    var chamaram = Pendencias.fuiChamado(p);
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

    /* CHAMARAM VOCÊ. A etiqueta explica por que esta pendência
       está na sua coluna — sem ela, uma pendência de outro setor
       aparece do nada e parece engano do sistema. */
    if (chamaram) t.appendChild(el("span", "pen__u pen__u--chamado", "Mencionaram você"));

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

    /* FECHAR SEM QUERER NÃO PODE LEVAR O QUE FOI ESCRITO.

       Clicar na área escura em volta e apertar Esc fechavam o
       painel na hora, sem perguntar. Quem volta de outro programa
       costuma clicar na janela para ativá-la — e se o clique caía
       na área escura, o cadastro que estava pela metade sumia.

       Agora, com algo digitado, esses dois atalhos não fecham: a
       tela avisa que o × é o caminho. O × continua fechando na
       hora, porque ele é um gesto de propósito. Com nada digitado,
       os atalhos funcionam como antes. */
    painel.addEventListener("input", marcarDigitado, true);
    painel.addEventListener("change", marcarDigitado, true);
    painel.addEventListener("click", function (ev) {
      if (ev.target !== painel) return;
      if (painel._digitado) { avisarQueTemTexto(); return; }
      fechar();
    });
    document.body.appendChild(painel);
    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Escape" || !painel.classList.contains("on")) return;
      if (painel._digitado) { avisarQueTemTexto(); return; }
      fechar();
    });
  }

  function marcarDigitado(ev) {
    var alvo = ev.target;
    if (!alvo || !/^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;
    /* Os filtros do quadro do escritório não são trabalho a perder. */
    if (alvo.closest && alvo.closest(".pd-filtros")) return;
    painel._digitado = true;
  }

  function avisarQueTemTexto() {
    var cab = caixa.querySelector(".pd-cab");
    var aviso = cab.querySelector(".pd-aviso-fechar");
    if (!aviso) {
      aviso = el("span", "pd-aviso-fechar",
        "Você tem algo escrito aqui. Para fechar sem salvar, use o ×.");
      cab.insertBefore(aviso, cab.lastChild);
    }
    aviso.classList.remove("pd-aviso-fechar--pisca");
    void aviso.offsetWidth;
    aviso.classList.add("pd-aviso-fechar--pisca");
  }

  function abrir(t) {
    titulo.textContent = t;
    corpo.textContent = "";
    painel._digitado = false;
    var aviso = caixa.querySelector(".pd-aviso-fechar");
    if (aviso) aviso.remove();
    painel.classList.add("on");
    return corpo;
  }
  function fechar() {
    /* O cursor não pode ficar preso num campo do painel fechado:
       para o resto do Hub isso parece "alguém digitando", e a
       atualização sozinha ficaria esperando para sempre. */
    var a = document.activeElement;
    if (a && painel.contains(a) && a.blur) a.blur();
    painel.classList.remove("on");
  }

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

    /* MARCAR E DESMARCAR TODOS, em dois botões pequenos ao lado do
       rótulo. A lista de ciência vem toda marcada porque o caso
       comum é o escritório inteiro — mas quando a pessoa quer só um
       nome, desmarcar sete a sete é trabalho que a tela devia fazer
       por ela. Pequenos de propósito: são atalho, não a ação
       principal. */
    var atalhos = el("span", "pd-todos");
    function botaozinho(texto, marcar) {
      var b = el("button", "pd-todos__b", texto);
      b.type = "button";
      b.addEventListener("click", function () {
        escolhidos.length = 0;
        Array.prototype.slice.call(caixa.querySelectorAll("input[type=checkbox]"))
          .forEach(function (c) {
            c.checked = marcar;
            if (marcar) escolhidos.push(c.value);
          });
      });
      atalhos.appendChild(b);
      return b;
    }
    if (caixa.children.length > 1) {
      botaozinho("todos", true);
      botaozinho("nenhum", false);
      l.querySelector(".pd-rot").appendChild(atalhos);
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
    var rComigo = escolha("comigo", "Eu e quem eu marcar",
      "As pessoas que você escolher em Quem faz e Marcar mais alguém, e mais nenhuma. " +
      "Nem gerência, nem diretoria, nem administrador.", false);
    var rSoEu = escolha("so-eu", "Só eu",
      "Mais ninguém do escritório vê, nem administrador. Vira uma anotação sua, " +
      "com prazo e linha do tempo, e sem responsável para designar.", false);

    reservada.appendChild(plateia);

    var ativos = equipe.filter(function (p) { return p.ativo; });
    /* EU TAMBÉM ENTRO NAS LISTAS, e antes não entrava.

       As duas listas excluíam quem estava criando, com a ideia de
       que "você já está aqui, não precisa se marcar". Isso é
       verdade para VER a pendência — quem cria sempre vê — mas
       falso para duas coisas que importam:

       · Numa reservada, a plateia é a lista de quem pode ler. Sem
         poder me marcar, eu não conseguia fazer "só eu e o Rone":
         ou eu escolhia "só eu", que exclui todo mundo, ou aceitava
         gerência e diretoria junto.

       · Num recado, ciência é ato. Se o aviso vale para mim também
         — e às vezes vale, é o combinado que eu também sigo — eu
         preciso poder confirmar que li.

       Passa a excluir apenas quem está desligado, que já é o filtro
       de "ativos" logo acima. */
    var marcar = marcador("Marcar mais alguém", ativos, null);
    var chamados = marcador("Quem precisa dar ciência", ativos, null, true);
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
                  : quemPodeVer(destinoPessoa(quem._entrada.value), marcar._valores(),
                                rComigo.checked ? false : true),
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

  /* ---------- quem pode ser chamado ----------

     SÓ QUEM JÁ PODE VER A PENDÊNCIA. Chamar alguém não dá acesso a
     nada: numa reservada, quem lê continua sendo só quem está em
     podemVer, congelado na criação. Oferecer um nome de fora
     colocaria na coluna da pessoa uma pendência que ela não
     consegue abrir — aviso que só serve para irritar. */
  function chamaveis(p) {
    var eu = meuUid();
    return equipe.filter(function (x) {
      if (!x.ativo || x.uid === eu) return false;
      if (Array.isArray(p.podemVer) && p.podemVer.length) {
        return p.podemVer.indexOf(x.uid) !== -1;
      }
      return true;
    });
  }

  function abrirFicha(p) {
    var c = abrir(p.oque);

    /* Abriu, leu. A marca vai para o banco sem segurar a tela: se
       falhar, o pior que acontece é continuar aparecendo como não
       lida — e ninguém perde nada por isso. */
    if (!Pendencias.jaVi(p)) {
      Pendencias.marcarComoVista(p).then(function (mudou) { if (mudou) desenhar(); });
    }
    /* CHAMARAM VOCÊ E VOCÊ VEIO: o aviso já fez o que tinha a
       fazer. Sai daqui, e não quando a pessoa responde — nem toda
       chamada pede resposta, e um aviso que só some respondendo
       vira cobrança. */
    if (Pendencias.fuiChamado(p)) {
      Pendencias.dispensarMinhaMencao(p).then(function (mudou) { if (mudou) desenhar(); });
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

    /* ---------- Linha do tempo, com rolagem própria ----------

       A ROLAGEM FICA NUM INVÓLUCRO, e não na própria linha. O fio
       vertical é a borda esquerda dela, e as bolinhas de cada
       atualização ficam montadas em cima desse fio — metade para
       fora. Uma área com rolagem corta o que passa das bordas, nos
       dois sentidos, e as bolinhas seriam decepadas ao meio. Com o
       invólucro, quem corta é ele, e sobra a folga que elas pedem.

       Sem teto, a conversa empurrava a caixa de escrever para bem
       longe: numa pendência com história, era rolar a ficha inteira
       até embaixo para responder uma linha. Agora a conversa rola
       dentro de si mesma e o resto da ficha fica parado. */
    c.appendChild(el("div", "pd-rot pd-rot--secao", "Linha do tempo"));
    var rolagem = el("div", "pd-linha-rolagem");
    var linha = el("div", "pd-linha-tempo", "Carregando…");
    rolagem.appendChild(linha);
    c.appendChild(rolagem);

    var novo = document.createElement("textarea");
    novo.className = "pd-caixa-txt pd-area";
    novo.rows = 2;
    novo.placeholder = "Acrescentar uma atualização…";
    c.appendChild(novo);

    /* ---------- chamar alguém pelo nome ----------

       O "@" abre a lista de quem pode ser chamado; escolher um nome
       escreve "@Fulano" no texto e guarda o uid.

       AS ESCOLHAS FICAM GUARDADAS À PARTE, e não são lidas de volta
       do texto. Ler o texto significaria procurar nomes dentro dele
       na hora de enviar — e dois "Ana" na equipe, ou um nome
       escrito com acento diferente, chamariam a pessoa errada ou
       ninguém. Na hora de enviar, só valem as escolhas cujo
       "@Fulano" ainda está escrito: quem apagou o nome do texto
       desistiu da chamada. */
    var escolhidas = [];

    var lista = el("div", "pd-chamar");
    lista.hidden = true;

    function fecharLista() { lista.hidden = true; lista.textContent = ""; }

    /* O QUE ESTÁ SENDO DIGITADO DEPOIS DO ÚLTIMO "@".

       Antes a lista aparecia só quando o texto TERMINAVA em "@", e
       a primeira letra digitada a fazia sumir — que é justamente
       quando ela começaria a ser útil, porque é aí que dá para
       peneirar os nomes.

       O ESPAÇO NÃO ENCERRA a procura: há nome com espaço no meio, e
       "@Ana P" precisa continuar achando "Ana Paula". Quem encerra
       é escolher um nome, o Esc, mudar de linha, ou passar de
       quarenta letras — aí já não é procura de nome, é texto com
       um arroba no meio.

       Olha só até o cursor, e não até o fim: quem volta para
       corrigir uma chamada no meio do parágrafo também tem a
       lista. */
    function trechoDaChamada() {
      var ate = novo.selectionStart;
      if (typeof ate !== "number") ate = novo.value.length;
      var antes = novo.value.slice(0, ate);
      var arroba = antes.lastIndexOf("@");
      if (arroba === -1) return null;
      var termo = antes.slice(arroba + 1);
      if (termo.indexOf("\n") !== -1 || termo.length > 40) return null;
      /* CHAMADA JÁ FEITA NÃO REABRE A LISTA.

         Depois de escolher "@Eduarda", a próxima tecla — uma
         vírgula, um espaço, a palavra seguinte — fazia a lista
         voltar dizendo "Ninguém com esse nome", porque o termo
         passava a ser "Eduarda," e nome nenhum bate com isso.
         Escolhido o nome, a procura acabou. */
      var jaEscolhido = false;
      escolhidas.forEach(function (uid) {
        var quem = porUid[uid] || {};
        var nome = quem.nome || quem.email || "";
        if (nome && termo.length >= nome.length && termo.slice(0, nome.length) === nome) {
          jaEscolhido = true;
        }
      });
      if (jaEscolhido) return null;

      return { arroba: arroba, termo: termo, ate: ate };
    }

    function abrirLista(trecho) {
      var procurado = semAcento(trecho ? trecho.termo : "");
      var gente = chamaveis(p).filter(function (x) {
        if (!procurado) return true;
        return semAcento(x.nome || x.email).indexOf(procurado) !== -1;
      });

      lista.textContent = "";
      if (!gente.length) {
        /* Dizer que não achou é melhor que fechar sozinho: fechar
           parece defeito, e foi assim que este bug apareceu. */
        lista.appendChild(el("div", "pd-dica", procurado
          ? "Ninguém com esse nome para chamar aqui."
          : "Não há mais ninguém para chamar aqui."));
      }
      gente.forEach(function (x) {
        var op = el("button", "pd-chamar__op", x.nome || x.email);
        op.type = "button";
        op.appendChild(el("span", "pd-chamar__s", setoresDe(x).join(" · ")));
        op.addEventListener("click", function () {
          /* Troca o "@" e o que foi digitado depois dele pelo nome
             inteiro, e devolve o cursor para depois do nome. */
          var t2 = trecho || trechoDaChamada() || { arroba: novo.value.length, ate: novo.value.length };
          /* SEM ESPAÇO DEPOIS DO NOME. Com ele, quem escrevia uma
             vírgula em seguida ficava com "@Eduarda , confere" — um
             espaço solto antes da pontuação. Quem vai continuar com
             uma palavra digita o espaço, que é o gesto normal de
             quem escreve. */
          var marca = "@" + (x.nome || x.email);
          novo.value = novo.value.slice(0, t2.arroba) + marca + novo.value.slice(t2.ate);
          if (escolhidas.indexOf(x.uid) === -1) escolhidas.push(x.uid);
          fecharLista();
          novo.focus();
          var cursor = t2.arroba + marca.length;
          if (novo.setSelectionRange) novo.setSelectionRange(cursor, cursor);
        });
        lista.appendChild(op);
      });
      lista.hidden = false;
    }

    function conferirChamada() {
      var trecho = trechoDaChamada();
      if (trecho) abrirLista(trecho);
      else if (!lista.hidden) fecharLista();
    }

    novo.addEventListener("input", conferirChamada);
    /* Mover o cursor com as setas ou com o mouse também muda se há
       uma chamada sendo escrita ali. */
    novo.addEventListener("click", conferirChamada);
    novo.addEventListener("keyup", function (ev) {
      if (ev.key === "ArrowLeft" || ev.key === "ArrowRight" ||
          ev.key === "ArrowUp" || ev.key === "ArrowDown" || ev.key === "Home" || ev.key === "End") {
        conferirChamada();
      }
    });
    novo.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && !lista.hidden) { ev.stopPropagation(); fecharLista(); }
    });
    c.appendChild(lista);

    var b = el("button", "pd-botao", "Acrescentar");
    b.type = "button";
    b.addEventListener("click", function () {
      b.disabled = true;
      var chamados = escolhidas.filter(function (uid) {
        var quem = porUid[uid] || {};
        return novo.value.indexOf("@" + (quem.nome || quem.email || "")) !== -1;
      });
      Pendencias.acrescentar(p, novo.value, meuNome(), false, chamados)
        .then(function (x) {
          novo.value = "";
          escolhidas = [];
          b.disabled = false;
          fecharLista();
          pintarLinha(p, linha);
          if (x && x.avisoNaoSaiu) {
            var falhou = el("div", "pd-corrigir__erro",
              "Comentário enviado, mas não consegui avisar quem você chamou. " +
              "Escreva de novo o nome num comentário novo para tentar outra vez.");
            c.insertBefore(falhou, b);
          }
          /* A chamada muda a coluna de quem foi chamado, e a minha
             também quando eu mesmo estou numa lista de antes. */
          if (chamados.length) desenhar();
        })
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

  /* ---------- os três pontinhos, em qualquer lugar ----------

     Nasceu no comentário e agora serve o anexo também. Uma
     função só, porque são o mesmo gesto: a ação sem prazo fica
     escondida para não ser clicada por engano na conversa
     inteira, e a um clique de quem a procura. */
  function menuDePontinhos(dentro, rotulo, dica, aoEscolher) {
    var pontos = el("button", "pd-pontos", "\u22ef");
    pontos.type = "button";
    pontos.title = "Mais opções";
    pontos.setAttribute("aria-label", "Mais opções");

    var menu = el("div", "pd-menu");
    menu.hidden = true;

    function fechar2() {
      menu.hidden = true;
      document.removeEventListener("click", fora, true);
      document.removeEventListener("keydown", tecla, true);
      document.removeEventListener("scroll", fechar2, true);
      window.removeEventListener("resize", fechar2);
    }
    function fora(ev) {
      if (menu.contains(ev.target) || ev.target === pontos) return;
      fechar2();
    }
    function tecla(ev) {
      if (ev.key !== "Escape") return;
      /* Não deixa o Esc fechar a ficha inteira junto. */
      ev.stopPropagation();
      fechar2();
    }

    var opcao = el("button", "pd-menu__op", rotulo);
    opcao.type = "button";
    opcao.addEventListener("click", function () {
      opcao.disabled = true;
      aoEscolher(function erro(mensagem) {
        opcao.disabled = false;
        menu.appendChild(el("div", "pd-corrigir__erro", mensagem));
      }, fechar2);
    });
    menu.appendChild(opcao);
    menu.appendChild(el("div", "pd-dica", dica));

    /* O MENU FLUTUA PRESO À JANELA, e não ao comentário.

       Dentro da área com rolagem, um menu preso ao comentário seria
       cortado pela borda dela — e o último comentário, que é
       justamente o mais mexido, teria o menu decepado. Preso à
       janela ele aparece inteiro, em qualquer posição.

       Em troca, ele não acompanha a rolagem: por isso fecha quando
       a pessoa rola ou redimensiona a janela. Fechar é melhor que
       ficar flutuando longe de onde foi aberto. */
    function posicionar() {
      var r = pontos.getBoundingClientRect();
      menu.style.top = (r.bottom + 4) + "px";
      menu.style.left = Math.max(8, Math.min(r.right - 210, window.innerWidth - 226)) + "px";
    }

    pontos.addEventListener("click", function () {
      if (!menu.hidden) { fechar2(); return; }
      menu.hidden = false;
      posicionar();
      document.addEventListener("click", fora, true);
      document.addEventListener("keydown", tecla, true);
      document.addEventListener("scroll", fechar2, true);
      window.addEventListener("resize", fechar2);
    });

    dentro.appendChild(pontos);
    dentro.appendChild(menu);
  }

  function desenharAnexos(p, onde, lista) {
    onde.textContent = "";

    lista.forEach(function (a) {
      var linha = el("div", "pd-anexo");

      /* ANEXO APAGADO: fica a marca, como no comentário. O arquivo
         se perde de verdade; o nome, quem mandou e as duas horas
         ficam, para quem leu a conversa antes não achar que
         imaginou o anexo. */
      if (a.apagado) {
        linha.className = "pd-anexo pd-anexo--apagado";
        linha.appendChild(el("span", "pd-anexo__n", a.nome));
        linha.appendChild(el("span", "pd-anexo__q",
          "anexo apagado por " + nomeDe(a.por) +
          (a.apagadoEm ? " \u2014 " + quandoEscrito(a.apagadoEm) : "")));
        onde.appendChild(linha);
        return;
      }

      /* Botão, não link com endereço dentro. O arquivo não tem
         endereço público: ele é buscado na hora, com a sessão de
         quem clicou, e o endereço temporário que sai daí só vale
         neste navegador.

         A aba é aberta ANTES da busca, ainda dentro do clique. Se
         fosse aberta depois, o navegador a barraria como janela
         não pedida — do ponto de vista dele, o clique já passou. */
      if (a.desconsiderado) linha.className = "pd-anexo pd-anexo--desc";
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
      if (a.desconsiderado) linha.appendChild(el("span", "pd-anexo__desc", "desconsiderado"));

      /* O ARQUIVO CONTINUA ABRINDO, riscado. Não é apagar com outro
         nome: quem se baseou nele semana passada precisa poder ver
         do que se tratava, e ver que quem mandou voltou atrás. */
      if (Pendencias.podeDesconsiderarAnexo(a)) {
        menuDePontinhos(linha,
          a.desconsiderado ? "Voltar a considerar" : "Desconsiderar",
          a.desconsiderado
            ? "O risco sai e o anexo volta a valer."
            : "O arquivo continua aqui e continua abrindo, riscado, com o aviso de "
              + "desconsiderado. Dá para voltar atrás quando quiser.",
          function (erro, fechar2) {
            Pendencias.desconsiderarAnexo(p, a, !a.desconsiderado)
              .then(function () {
                fechar2();
                return Pendencias.lerAnexos(p);
              })
              .then(function (nova) { if (nova) desenharAnexos(p, onde, nova); })
              .catch(function (e) { erro(e.message); });
          });
      }

      /* APAGAR, na mesma janela e com a mesma confirmação do
         comentário — inclusive o aviso de que não dá para
         recuperar, porque aqui é ainda mais verdade. */
      if (Pendencias.podeApagarAnexo(a)) {
        var ap = el("button", "pd-corrigir pd-apagar-com", "apagar");
        ap.type = "button";
        ap.title = "Você tem 30 minutos para apagar o que enviou";
        ap.addEventListener("click", function () {
          ap.hidden = true;
          var conf = el("div", "pd-corrigir__acoes");
          conf.appendChild(el("span", "pd-apagar-com__aviso",
            "Apagar “" + a.nome + "”? O arquivo será apagado permanentemente e não pode " +
            "ser recuperado. Fica registrado que você o enviou e apagou."));
          var sim = el("button", "pd-corrigir__ok pd-corrigir__ok--perigo", "Apagar");
          sim.type = "button";
          var nao = el("button", "pd-corrigir__nao", "Manter");
          nao.type = "button";
          conf.appendChild(sim);
          conf.appendChild(nao);
          linha.appendChild(conf);
          nao.addEventListener("click", function () { conf.remove(); ap.hidden = false; });
          sim.addEventListener("click", function () {
            sim.disabled = true;
            sim.textContent = "Apagando\u2026";
            Pendencias.apagarAnexo(p, a)
              .then(function () { return Pendencias.lerAnexos(p); })
              .then(function (nova) { desenharAnexos(p, onde, nova); })
              .catch(function (err) {
                sim.disabled = false;
                sim.textContent = "Apagar";
                conf.appendChild(el("div", "pd-corrigir__erro", err.message));
              });
          });
        });
        linha.appendChild(ap);
      }
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

  /* Depois de pintar, mostra o FIM da conversa. A ordem no fio é a
     de quem falou primeiro, mas quem abre a ficha quer o último
     recado, não o primeiro — e começar em cima obrigaria a rolar
     até embaixo toda vez. */
  function mostrarOFim(onde) {
    var caixa = onde.parentNode;
    if (caixa && caixa.classList && caixa.classList.contains("pd-linha-rolagem")) {
      caixa.scrollTop = caixa.scrollHeight;
    }
  }

  /* ---------- o nome chamado, em relevo ----------

     Um fundo claro e a cor de estado, sem negrito forte: o bastante
     para a pessoa reconhecer que foi chamada ao correr o olho, e de
     menos para competir com o que está escrito.

     SÓ OS NOMES QUE FORAM MESMO CHAMADOS ganham o relevo — a lista
     vem do comentário, não do texto. Quem escreve "@" e um nome à
     mão, sem escolher da lista, não chamou ninguém: ninguém foi
     avisado, e pintar aquilo de chamada seria mentir na cara de
     quem lê.

     Sem expressão regular: letra por letra, procurando a ocorrência
     mais próxima entre os nomes chamados. */
  function textoComChamadas(x, classe) {
    var d = el("div", classe);
    var texto = String(x.texto || "");
    var nomes = (x.mencionados || [])
      .map(function (u) { return "@" + nomeDe(u); })
      .filter(function (n) { return n.length > 1; });

    if (!nomes.length) { d.textContent = texto; return d; }

    var i = 0;
    while (i < texto.length) {
      var achou = -1, qual = "";
      nomes.forEach(function (n) {
        var onde = texto.indexOf(n, i);
        if (onde !== -1 && (achou === -1 || onde < achou)) { achou = onde; qual = n; }
      });
      if (achou === -1) {
        d.appendChild(document.createTextNode(texto.slice(i)));
        return d;
      }
      if (achou > i) d.appendChild(document.createTextNode(texto.slice(i, achou)));
      d.appendChild(el("span", "pd-arroba", qual));
      i = achou + qual.length;
    }
    return d;
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
        if (x.desconsiderado) cab.appendChild(el("span", "pd-item__desc", "desconsiderada"));
        d.appendChild(cab);
        /* A MARCA DO APAGADO fica no lugar do texto, na mesma
           posição da conversa. Quem apaga é sempre quem escreveu —
           a regra só deixa o autor —, então o nome é o do cabeçalho. */
        if (x.apagado) {
          d.className += " pd-item--apagado";
          d.appendChild(el("div", "pd-item__txt",
            "Comentário apagado por " + (x.autorNome || nomeDe(x.autor)) +
            (x.apagadoEm ? " — " + quandoEscrito(x.apagadoEm) : "")));
          onde.appendChild(d);
          return;
        }

        var texto = textoComChamadas(x, "pd-item__txt" + (x.desconsiderado ? " pd-item__txt--desc" : ""));
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

        /* ---------- os três pontinhos ----------

           DESCONSIDERAR MORA AQUI, e não ao lado de "corrigir".

           É uma ação sem prazo, disponível para sempre em todo
           comentário que a pessoa escreveu — se ficasse à vista,
           estaria à vista em toda a conversa, todos os dias, e
           acabaria clicada por engano. Atrás dos pontinhos ela
           continua a um clique de distância para quem a procura, e
           some para quem não está procurando.

           O menu fecha ao escolher, ao clicar fora e no Esc. */
        if (Pendencias.podeDesconsiderar(x)) {
          menuDePontinhos(d,
            x.desconsiderado ? "Voltar a considerar" : "Desconsiderar",
            x.desconsiderado
              ? "O risco sai e o comentário volta a valer."
              : "O texto continua legível, riscado, com o aviso de desconsiderada. "
                + "Dá para voltar atrás quando quiser.",
            function (erro, fechar2) {
              Pendencias.desconsiderar(p, x, !x.desconsiderado)
                .then(function () { fechar2(); pintarLinha(p, onde); })
                .catch(function (e) { erro(e.message); });
            });
        }

        /* APAGAR, na mesma janela do corrigir e com a mesma
           confirmação na própria ficha — caixa nativa do navegador
           tem os defeitos descritos logo acima. */
        if (Pendencias.podeApagarComentario(x)) {
          var ap = el("button", "pd-corrigir pd-apagar-com", "apagar");
          ap.type = "button";
          ap.title = "Você tem 30 minutos para apagar o que escreveu";
          ap.addEventListener("click", function () {
            ap.hidden = true;
            if (d.querySelector(".pd-corrigir:not(.pd-apagar-com)")) {
              d.querySelector(".pd-corrigir:not(.pd-apagar-com)").hidden = true;
            }
            var conf = el("div", "pd-corrigir__acoes");
            conf.appendChild(el("span", "pd-apagar-com__aviso",
              "Apagar este comentário? O texto será apagado permanentemente e não pode ser recuperado."));
            var sim = el("button", "pd-corrigir__ok pd-corrigir__ok--perigo", "Apagar");
            sim.type = "button";
            var nao2 = el("button", "pd-corrigir__nao", "Manter");
            nao2.type = "button";
            conf.appendChild(sim);
            conf.appendChild(nao2);
            d.appendChild(conf);

            nao2.addEventListener("click", function () {
              conf.remove();
              ap.hidden = false;
              var c2 = d.querySelector(".pd-corrigir:not(.pd-apagar-com)");
              if (c2) c2.hidden = false;
            });
            sim.addEventListener("click", function () {
              sim.disabled = true;
              sim.textContent = "Apagando…";
              Pendencias.apagarComentario(p, x)
                .then(function () { pintarLinha(p, onde); })
                .catch(function (err) {
                  sim.disabled = false;
                  sim.textContent = "Apagar";
                  conf.appendChild(el("div", "pd-corrigir__erro", err.message));
                });
            });
          });
          d.appendChild(ap);
        }
        onde.appendChild(d);
      });
      mostrarOFim(onde);
    }).catch(function (e) {
      onde.textContent = "";
      onde.appendChild(el("div", "pd-vazio", e.message));
    });
  }

  /* ---------- carregar ---------- */

  /* ============================================================
     A CAIXA GRANDE
     ------------------------------------------------------------
     Duas coisas não podem esperar que a pessoa repare num cartão
     no meio de uma lista:

       · uma tarefa dela VENCEU;
       · um recado que ela escreveu foi lido por TODOS.

     A primeira porque atraso já aconteceu — não é aviso de algo
     que vai acontecer, é notícia de algo que falhou. A segunda
     porque é o fim de uma espera: ela mandou o aviso e estava
     aguardando, e agora pode fechar o assunto.

     APARECE UMA VEZ POR FATO, E NÃO A CADA ABERTURA. Cada fato tem
     uma chave — "atraso:id" ou "lido:id" — guardada no navegador
     quando a pessoa fecha a caixa. Guardar ao FECHAR, e não ao
     mostrar: se a aba morrer antes de ela ler, o aviso volta.

     A memória é do navegador, e isso tem um custo honesto: quem
     usa dois computadores vê o mesmo aviso nos dois. A alternativa
     seria guardar no banco, o que faria cada abertura do Hub
     escrever um documento por pessoa — caro para o problema que
     resolve. Ver o mesmo aviso duas vezes incomoda menos que isso.
     ============================================================ */

  function chaveDosAvisos() { return "hub-totali:avisado:" + (meuUid() || "anon"); }

  function avisosJaDados() {
    try {
      var b = window.localStorage.getItem(chaveDosAvisos());
      var d = b ? JSON.parse(b) : null;
      return Array.isArray(d) ? d : [];
    } catch (e) { return []; }
  }

  function guardarAvisos(lista) {
    try {
      /* Teto de duzentas chaves: sem ele a lista cresce para sempre
         num navegador que fica anos na mesma máquina. As mais
         antigas saem primeiro, e o pior que acontece é um aviso
         muito velho aparecer de novo. */
      window.localStorage.setItem(chaveDosAvisos(), JSON.stringify(lista.slice(-200)));
    } catch (e) { /* navegador sem espaço: pior caso, avisa de novo */ }
  }

  function conferirCaixaGrande() {
    var eu = meuUid();
    if (!eu || painelAberto()) return;
    if (document.querySelector(".pd-caixona")) return;

    var jaDados = avisosJaDados();
    var meusSetores = setoresDe(porUid[eu] || {});
    var venceram = [], lidos = [], chaves = [];

    todas.forEach(function (p) {
      if (p.situacao === "resolvida") return;

      if (!Pendencias.pedeCiencia(p)
          && Pendencias.estado(p) === "atrasada"
          && Pendencias.ehMinha(p, eu, meusSetores)) {
        var k = "atraso:" + p.id;
        if (jaDados.indexOf(k) === -1) { venceram.push(p); chaves.push(k); }
      }

      if (Pendencias.pedeCiencia(p) && p.criadoPor === eu) {
        var c = Pendencias.contaDaCiencia(p);
        if (c.total > 0 && c.deram >= c.total) {
          var k2 = "lido:" + p.id;
          if (jaDados.indexOf(k2) === -1) { lidos.push(p); chaves.push(k2); }
        }
      }
    });

    if (!venceram.length && !lidos.length) return;
    mostrarCaixaGrande(venceram, lidos, chaves);
  }

  function mostrarCaixaGrande(venceram, lidos, chaves) {
    var fundo = el("div", "pd-caixona");
    var caixa = el("div", "pd-caixona__c");
    caixa.setAttribute("role", "dialog");
    caixa.setAttribute("aria-modal", "true");

    /* O QUE VENCEU VEM PRIMEIRO. Entre "algo falhou" e "algo se
       completou", o que falhou manda. */
    if (venceram.length) {
      var s1 = el("div", "pd-caixona__s pd-caixona__s--atraso");
      s1.appendChild(el("div", "pd-caixona__t",
        venceram.length === 1 ? "Uma tarefa sua venceu" : venceram.length + " tarefas suas venceram"));
      var l1 = el("ul", "pd-caixona__l");
      venceram.forEach(function (p) {
        var li = document.createElement("li");
        li.appendChild(el("span", "pd-caixona__o", p.oque));
        li.appendChild(el("span", "pd-caixona__q",
          "vencia " + (pedacosDaData(p.prazo).d + " " + pedacosDaData(p.prazo).m)));
        li.addEventListener("click", function () { fechar2(); abrirFicha(p); });
        l1.appendChild(li);
      });
      s1.appendChild(l1);
      caixa.appendChild(s1);
    }

    if (lidos.length) {
      var s2 = el("div", "pd-caixona__s pd-caixona__s--lido");
      s2.appendChild(el("div", "pd-caixona__t",
        lidos.length === 1 ? "Todos leram o seu recado" : "Todos leram " + lidos.length + " recados seus"));
      var l2 = el("ul", "pd-caixona__l");
      lidos.forEach(function (p) {
        var c = Pendencias.contaDaCiencia(p);
        var li = document.createElement("li");
        li.appendChild(el("span", "pd-caixona__o", p.oque));
        li.appendChild(el("span", "pd-caixona__q", c.deram + " de " + c.total + " confirmaram"));
        li.addEventListener("click", function () { fechar2(); abrirFicha(p); });
        l2.appendChild(li);
      });
      s2.appendChild(l2);
      caixa.appendChild(s2);
    }

    var b = el("button", "pd-botao pd-botao--principal", "Entendi");
    b.type = "button";
    b.addEventListener("click", fechar2);
    caixa.appendChild(b);

    caixa.appendChild(el("div", "pd-dica",
      "Clique num item para abrir. Este aviso não volta para os mesmos itens."));

    fundo.appendChild(caixa);
    /* Clicar fora e Escape fecham, como qualquer caixa. Mas o
       "Entendi" é que existe para ser óbvio: o resto é atalho. */
    fundo.addEventListener("click", function (ev) { if (ev.target === fundo) fechar2(); });
    document.addEventListener("keydown", pelaTecla);
    document.body.appendChild(fundo);
    b.focus();

    function pelaTecla(ev) { if (ev.key === "Escape") fechar2(); }

    function fechar2() {
      document.removeEventListener("keydown", pelaTecla);
      if (fundo.parentNode) fundo.parentNode.removeChild(fundo);
      /* SÓ AGORA a chave é guardada. Se a aba morresse antes, o
         aviso voltaria — que é o certo para quem não leu. */
      guardarAvisos(avisosJaDados().concat(chaves));
    }
  }

  function carregar() {
    if (!Dados.sessao() || !Pendencias.temBanco()) { desenhar(); return; }
    Promise.all([Pendencias.listar(), Dados.listarEquipe()])
      .then(function (r) {
        todas = juntarComExtra(r[0]);
        equipe = r[1];
        porUid = {};
        equipe.forEach(function (p) { porUid[p.uid] = p; });
        ultimaAssinatura = assinatura();
        desenhar();
        if (typeof aoMudar === "function") aoMudar(resumo());
        conferirCaixaGrande();
      })
      .catch(function (e) {
        alvo.textContent = "";
        vazio("Não consegui carregar", e.message);
      });
  }

  /* Quantas atrasadas e quantas para hoje — o cabeçalho usa. */
  function resumo() { return resumoDe(todas); }

  function resumoDe(lista) {
    var eu = meuUid();
    var minhas = lista.filter(function (p) {
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
        todas = juntarComExtra(r[0]);
        equipe = r[1];
        porUid = {};
        equipe.forEach(function (x) { porUid[x.uid] = x; });
        var agora = assinatura();
        if (agora === antes) return;
        ultimaAssinatura = agora;
        desenhar();
        if (typeof aoMudar === "function") aoMudar(resumo());
        /* Vale também na atualização sozinha: uma tarefa vence à
           meia-noite com o Hub aberto, e um recado se completa
           quando o último colega confirma. */
        conferirCaixaGrande();
      })
      .catch(function () { /* sem rede: a próxima volta tenta */ });
  }

  /* ---------- Só os números, com a tela em uso ----------

     Enquanto algo está aberto, a coluna não é redesenhada. Mas o
     número no título da aba, o selo do menu e a linha do cabeçalho
     continuam valendo: são o aviso de quem deixou o Hub com um
     cadastro aberto e foi para outro programa.

     A LISTA DA TELA NÃO É TOCADA. O que vem do banco serve só para
     a conta e é jogado fora. Trocar "todas" aqui mudaria o que o
     quadro aberto mostra ao mexer num filtro, e ainda faria a
     atualização completa, quando a tela ficar livre, achar que
     não há novidade — e a coluna ficaria desatualizada. */
  function conferirSoOsNumeros() {
    if (!Dados.sessao() || !Pendencias.temBanco()) return;
    Pendencias.listar()
      .then(function (lista) {
        if (typeof aoMudar === "function") aoMudar(resumoDe(juntarComExtra(lista)));
      })
      .catch(function () { /* sem rede: a próxima volta tenta */ });
  }

  return { iniciar: iniciar, recarregar: carregar, resumo: resumo, entrar: abrirEntrada,
           conferirSozinho: conferirSozinho, painelAberto: painelAberto,
           conferirSoOsNumeros: conferirSoOsNumeros,
           /* A barra lateral abre o quadro por aqui. */
           abrirTodas: function () { if (Dados.sessao()) abrirTodas(); } };

})();
