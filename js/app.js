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

  /* UMA ORIGEM SÓ: a imagem guardada no banco, embutida no próprio
     documento. Antes eram quatro, e as outras três vazavam.

     A pasta assets/logos/ era servida pela web e o repositório é
     público: os nomes dos arquivos diziam quais sistemas a casa
     usa, mesmo depois de a lista ficar privada. E o ícone do
     DuckDuckGo, usado para sistema recém-cadastrado, contava a um
     terceiro o endereço de cada site nosso, uma vez por abertura
     do Hub, para todo mundo da equipe.

     Sistema sem imagem agora mostra as iniciais — e a imagem se
     envia pela tela de administração, como tudo o mais. */
  function origemPermitida(endereco) {
    return endereco.indexOf("data:image/") === 0;
  }

  function icone(item) {
    var endereco = item.logoDados || "";
    var caixa = el("span", "ico");
    if (endereco && !origemPermitida(endereco)) endereco = "";
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

  /* ---------- a busca ----------
     Quarenta e dois sistemas, vinte e cinco deles fechados na
     gaveta. Digitar três letras é mais rápido que abrir a gaveta e
     varrer com o olho — e numa página que a equipe abre dezenas de
     vezes por dia, isso se paga.

     Procura no nome, na legenda, na sigla E no endereço: quem
     lembra "aquele do gov.br" acha pelo endereço, e quem lembra
     "o de rescisão" acha pela legenda. */
  var FILTRO = "";

  function semAcento(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  /* O NOME DO SETOR ENTRA NA BUSCA. Sem ele, "legalização" não
     achava nada — e é assim que a pessoa pensa: ela não procura
     "REGIN", procura o assunto, e espera ver o que mora naquela
     gaveta. */
  function combina(item, setor, termos) {
    var palheiro = semAcento([item.nome, item.nota, item.sigla, item.url, setor].join(" "));
    return termos.every(function (t) { return palheiro.indexOf(t) !== -1; });
  }

  function desenharBusca(centro) {
    /* Separa por espaço sem regex de propósito: a barra invertida
       de \s some com facilidade em edição automática, e quando some
       o separador vira a LETRA s — foi o que aconteceu aqui, e
       "rescis" passou a ser procurado como "re" mais "ci". */
    var termos = semAcento(FILTRO).split(" ").filter(Boolean);
    var achados = [];
    SETORES_ATUAIS.forEach(function (s) {
      (s.itens || []).forEach(function (i) {
        if (combina(i, s.titulo, termos)) achados.push({ setor: s.titulo, item: i });
      });
    });

    var b = bloco("Resultados", achados.length || null);
    if (!achados.length) {
      b.appendChild(el("div", "busca-vazia",
        "Nenhum sistema com “" + FILTRO + "”. O nome, a legenda e o endereço entram na busca."));
      centro.appendChild(b);
      return;
    }

    var grade = el("div", "grade");
    achados.forEach(function (a, n) {
      var no = item(a.item);
      /* A legenda passa a dizer de que setor veio: fora do bloco
         dele, "Requerimento universal" não diz onde mora. */
      var leg = no.querySelector(".item__x");
      if (leg) leg.textContent = a.setor + (a.item.nota ? " · " + a.item.nota : "");
      else {
        var t2 = no.querySelector(".item__txt");
        if (t2) t2.appendChild(el("div", "item__x", a.setor));
      }
      if (n === 0) no.classList.add("item--primeiro");
      grade.appendChild(no);
    });
    b.appendChild(grade);
    centro.appendChild(b);
  }

  function desenharCentro() {
    var centro = document.getElementById("centro");
    centro.textContent = "";

    if (FILTRO.trim()) { desenharBusca(centro); return; }

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

    /* A agenda vem do motor de regras (js/agenda.js), que calcula
       os vencimentos do mês corrente e se refaz sozinho na virada
       do mês. Se alguém quiser mandar uma lista fixa pelo banco,
       ela vence — mas o normal é a calculada. */
    if (AGENDA_ATUAL.length) {
      var ba = bloco("Agenda do mês", null, true);
      ba.id = "bloco-agenda";
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
     Quem desenha o trilho é o js/pendencias-ui.js. Aqui só
     entrego o elemento e um jeito de avisar o cabeçalho quando a
     contagem muda. */
  function desenharPendencias() {
    var alvo = document.getElementById("pendencias");
    if (typeof PendenciasUI === "undefined") return;
    PendenciasUI.iniciar(alvo, function (r) { pintarResumo(r); });
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

  /* ---------- os outros botões da barra ----------
     Eles existiam desenhados e não faziam nada: o cursor virava
     mãozinha, a pessoa clicava e a tela ficava parada. Botão que
     não responde é pior do que botão que não existe, porque ensina
     a equipe a desconfiar da tela inteira.

     O Hub cabe em uma tela só, então nenhum deles troca de página:
     eles levam o olho até o pedaço certo e acendem para dizer onde
     você está. No celular, onde tudo vira uma coluna comprida, é
     justamente aí que rolar sozinho ajuda. */
  function acender(botao) {
    var todos = document.querySelectorAll(".nav__b");
    var i;
    for (i = 0; i < todos.length; i++) todos[i].classList.remove("on");
    if (botao) botao.classList.add("on");
  }

  function levarA(alvo, botao) {
    if (!alvo) return;
    acender(botao);
    alvo.scrollIntoView({ behavior: "smooth", block: "start" });

    /* No computador o Hub inteiro cabe na tela, então rolar não
       move nada e o clique pareceria perdido. O alvo pisca uma vez
       para dizer "é este aqui". No celular a rolagem já responde
       sozinha, e o pisca só confirma onde parou. */
    alvo.classList.remove("achei");
    void alvo.offsetWidth;
    alvo.classList.add("achei");
    window.setTimeout(function () { alvo.classList.remove("achei"); }, 1100);
  }

  function ligarBotao(id, achar) {
    var b = document.getElementById(id);
    if (!b) return;
    b.addEventListener("click", function () { levarA(achar(), b); });
  }

  ligarBotao("nav-inicio", function () { return document.querySelector(".cab"); });
  /* Mira no trilho inteiro, não na lista de dentro dele: mirando
     na lista, o título "Minhas pendências" ficava 45px acima da
     borda da tela e a pessoa chegava numa lista sem cabeça. */
  ligarBotao("nav-pendencias", function () {
    return document.querySelector(".trilho") || document.getElementById("pendencias");
  });
  ligarBotao("nav-agenda", function () {
    /* A agenda é redesenhada quando o banco chega, então o
       elemento é procurado na hora do clique, não guardado antes. */
    return document.getElementById("bloco-agenda");
  });

  /* ---------- quem está usando ----------
     Enquanto o login da equipe não existe, o Hub pergunta o nome
     uma vez e guarda no navegador da pessoa. Quando o login
     entrar (junto com as pendências), o nome passa a vir da
     sessão e este atalho vira só o modo de trocar. */
  var CHAVE_NOME = "hub-totali:meu-nome";

  /* O NOME CADASTRADO VENCE. Antes a saudação usava o pedaço do
     e-mail antes do arroba, e dizia "Bom dia, hesley" — em
     minúscula, e sem o sobrenome que a pessoa escolheu ao ser
     cadastrada. É o mesmo nome que aparece nas pendências, e ver
     dois nomes diferentes para si mesmo na mesma tela é estranho.

     O e-mail continua como reserva para o instante entre a página
     abrir e o cadastro chegar do banco. */
  var NOME_CADASTRADO = "";

  function meuNome() {
    if (NOME_CADASTRADO) return NOME_CADASTRADO;
    var s = Dados.sessao();
    if (s && s.email) return s.email.split("@")[0];
    try { return window.localStorage.getItem(CHAVE_NOME) || ""; } catch (e) { return ""; }
  }

  function guardarNome(n) {
    try { window.localStorage.setItem(CHAVE_NOME, n); } catch (e) {}
  }

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
        pintarSaudacao();
      }
    }

    function pintarSaudacao() {
      var h = new Date().getHours();
      var n = meuNome();
      ola.textContent = (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite") +
                        (n ? ", " + n : "");
      ola.title = n ? "Clique para trocar o nome" : "Clique para dizer o seu nome";
    }

    /* Fica guardada para quem só quer repintar a saudação.
       Chamar desenharTopo() de novo ligaria um segundo relógio e
       um segundo clique no mesmo botão, e ainda apagaria o resumo
       das pendências — três estragos para trocar uma palavra. */
    desenharTopo.repintarSaudacao = pintarSaudacao;

    ola.addEventListener("click", function () {
      var n = window.prompt("Como o Hub deve chamar você?", meuNome());
      if (n === null) return;
      guardarNome(n.trim());
      pintarSaudacao();
    });

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

    pintarResumo(null);
  }

  /* O resumo ao lado da saudação: enquanto não há pendência
     carregada, mostra o tamanho do Hub; com pendência, mostra o
     que importa — quantas atrasadas e quantas para hoje. */
  /* ---------- o número que aparece sem ninguém procurar ----------
     Antes, a pessoa só descobria uma pendência nova ao abrir o
     Hub e olhar a coluna da direita. Quem deixa o Hub aberto numa
     aba de fundo — que é a maioria, já que ele é a página inicial
     — não descobria nunca.

     Sem servidor não dá para mandar e-mail, mas dá para pôr o
     número onde o olho passa de qualquer jeito: no ícone da barra
     e no TÍTULO DA ABA. "(2) Hub Totali" aparece na barra de
     abas mesmo com a página escondida atrás de outras dez.

     Atrasada pinta de vermelho; o resto, de azul. */
  var TITULO_BASE = document.title;

  function pintarAviso(r) {
    var botao = document.getElementById("nav-pendencias");
    var quantas = r ? (r.abertas || 0) : 0;
    var urgentes = r ? (r.atrasadas || 0) : 0;

    if (botao) {
      var selo = botao.querySelector(".nav__selo");
      if (!quantas) {
        if (selo) selo.remove();
      } else {
        if (!selo) {
          selo = el("span", "nav__selo");
          botao.appendChild(selo);
        }
        selo.textContent = quantas > 99 ? "99+" : String(quantas);
        selo.classList.toggle("nav__selo--alerta", urgentes > 0);
        botao.title = "Pendências — " + quantas +
          (quantas > 1 ? " abertas" : " aberta") +
          (urgentes ? ", " + urgentes + " atrasada" + (urgentes > 1 ? "s" : "") : "");
      }
    }

    document.title = quantas ? "(" + quantas + ") " + TITULO_BASE : TITULO_BASE;
  }

  function pintarResumo(r) {
    pintarAviso(r);
    var res = document.getElementById("resumo");
    if (!res) return;
    res.textContent = "";
    if (r && (r.atrasadas || r.hoje)) {
      if (r.atrasadas) {
        res.appendChild(el("b", null, r.atrasadas + (r.atrasadas > 1 ? " atrasadas" : " atrasada")));
        res.appendChild(document.createTextNode(" · " + r.hoje + " para hoje"));
      } else {
        res.appendChild(document.createTextNode(r.hoje + " para hoje"));
      }
      return;
    }
    if (r && r.abertas === 0) {
      res.appendChild(document.createTextNode("nenhuma pendência aberta"));
      return;
    }
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
    /* Calculada, não guardada: assim ela se corrige sozinha
       todo mês sem ninguém precisar editar nada. A lista do
       banco só entra se alguém tiver gravado uma à mão. */
    AGENDA_ATUAL = (typeof Agenda !== "undefined") ? Agenda.doMes() : (dados.agenda || []);
    desenharCentro();
    desenharAvisos();
  }

  function abrirHub() {
    document.getElementById("portao").hidden = true;
    document.getElementById("tela").hidden = false;

    desenharTudo(Dados.carregar(function (maisNovo) {
      desenharTudo(maisNovo);
    }));

    desenharTopo();
    desenharPendencias();

    /* Chega depois da primeira pintura, de propósito: a saudação
       não espera o banco para aparecer. Quando o nome chega, o
       cabeçalho se redesenha. */
    Dados.meuCadastro().then(function (p) {
      if (!p || !p.nome || p.nome === NOME_CADASTRADO) return;
      NOME_CADASTRADO = p.nome;
      if (desenharTopo.repintarSaudacao) desenharTopo.repintarSaudacao();
    });
  }

  /* ---------- o portão ----------
     A lista de sistemas deixou de ser pública, então o Hub não
     tem o que desenhar antes de saber quem está do outro lado.
     Na prática ninguém vê esta tela mais de uma vez por
     aparelho: a sessão fica guardada e se renova sozinha. */
  function abrirPortao() {
    var portao = document.getElementById("portao");
    var form   = document.getElementById("portao-form");
    var erro   = document.getElementById("portao-erro");
    var botao  = document.getElementById("portao-btn");

    portao.hidden = false;
    document.getElementById("portao-email").focus();

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      erro.hidden = true;
      botao.disabled = true;
      botao.textContent = "Entrando…";

      Dados.entrar(document.getElementById("portao-email").value.trim(),
                   document.getElementById("portao-senha").value)
        .then(function () { abrirHub(); })
        .catch(function (e) {
          erro.textContent = e.message || "Não consegui entrar.";
          erro.hidden = false;
          botao.disabled = false;
          botao.textContent = "Entrar";
        });
    });
  }

  (function ligarBusca() {
    var cx = document.getElementById("busca");
    if (!cx) return;

    var espera = null;
    cx.addEventListener("input", function () {
      /* Espera a digitação parar um instante: redesenhar a cada
         tecla faz a lista tremer debaixo do olho. */
      if (espera) window.clearTimeout(espera);
      espera = window.setTimeout(function () {
        FILTRO = cx.value;
        desenharCentro();
      }, 140);
    });

    cx.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        cx.value = ""; FILTRO = ""; desenharCentro(); cx.blur();
        return;
      }
      if (ev.key !== "Enter") return;
      /* Abre o primeiro resultado — o que está contornado na tela,
         para a tecla não virar surpresa. */
      var primeiro = document.querySelector(".item--primeiro");
      if (primeiro && primeiro.href) {
        ev.preventDefault();
        window.open(primeiro.href, "_blank", "noopener,noreferrer");
      }
    });

    /* A barra põe o cursor na busca de qualquer lugar da página —
       menos de dentro de um campo, senão não se digitaria "e/ou". */
    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "/" || ev.ctrlKey || ev.altKey || ev.metaKey) return;
      var a = document.activeElement;
      if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
      if (a && a.isContentEditable) return;
      ev.preventDefault();
      cx.focus();
      cx.select();
    });
  })();

  (function ligarSair() {
    var b = document.getElementById("btn-sair");
    if (!b) return;
    b.addEventListener("click", function () {
      if (!window.confirm("Sair da sua conta neste navegador?")) return;
      Dados.sair();
      window.location.reload();
    });
  })();

  Dados.pronto().then(function (sessao) {
    if (sessao || !Dados.temBanco()) abrirHub();
    else abrirPortao();
  });

})();
