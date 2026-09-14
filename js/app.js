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

  function item(i, semEstrela) {
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

    if (semEstrela) return a;

    /* A ESTRELA FICA FORA DO <a>, NUM INVÓLUCRO.
       Botão dentro de link é HTML inválido e, pior, é armadilha de
       leitor de tela: o aparelho anuncia um link e encontra um
       botão no meio do caminho. Com o invólucro são dois irmãos —
       o link abre o sistema, o botão marca o favorito, e cada um
       responde por si no teclado. */
    var caixa = el("div", "item-caixa");
    caixa.appendChild(a);
    caixa.appendChild(estrelaDe(i.nome));
    caixa._link = a;
    return caixa;
  }

  /* ---------- Meus Favoritos ----------

     Guardados no banco, num documento por pessoa, e não no
     navegador: o Hub abre no computador da mesa e no de casa, e
     favorito que vale num lugar só é favorito montado duas vezes.

     São duas listas com naturezas diferentes. MARCADOS são apps da
     casa, e guardam só o nome — o endereço continua saindo da
     administração, conferido, e se ele mudar amanhã o favorito
     acompanha sozinho. MEUS são links que a pessoa escreveu, com
     endereço próprio, e por isso não aparecem para mais ninguém. */

  var FAVORITOS = { marcados: [], meus: [] };

  function ehFavorito(nome) {
    return FAVORITOS.marcados.indexOf(nome) !== -1;
  }

  var FAVORITOS_ERRO = "";

  function guardarFavoritos() {
    FAVORITOS_ERRO = "";
    Dados.salvarFavoritos(FAVORITOS).catch(function (e) {
      /* NÃO ENGOLIR. A escolha ficou guardada neste navegador, e
         por isso a tela continua certa — mas ela não subiu, e
         então não vai acompanhar a pessoa para outra máquina.
         Ficar calado aqui seria deixá-la acreditar numa coisa que
         não aconteceu. */
      FAVORITOS_ERRO = "Guardado só neste navegador — não consegui salvar na sua conta. " +
                       (e && e.message ? e.message : "");
      desenharCentro();
    });
  }

  function virarFavorito(nome) {
    var onde = FAVORITOS.marcados.indexOf(nome);
    if (onde === -1) FAVORITOS.marcados.push(nome);
    else FAVORITOS.marcados.splice(onde, 1);
    guardarFavoritos();
    desenharCentro();
  }

  function estrelaDe(nome) {
    var marcada = ehFavorito(nome);
    var b = el("button", "estrela" + (marcada ? " estrela--on" : ""));
    b.type = "button";
    b.textContent = marcada ? "★" : "☆";
    b.title = marcada ? "Tirar dos meus favoritos" : "Pôr nos meus favoritos";
    b.setAttribute("aria-label", b.title);
    b.setAttribute("aria-pressed", marcada ? "true" : "false");
    b.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      virarFavorito(nome);
    });
    return b;
  }

  /* Acha o app da casa pelo nome. Se a administração tiver
     removido o sistema, o favorito simplesmente não desenha — e
     fica guardado, porque o app pode voltar. */
  function appDaCasa(nome) {
    var achado = null;
    SETORES_ATUAIS.forEach(function (s) {
      (s.itens || []).forEach(function (i) { if (i.nome === nome) achado = i; });
    });
    return achado;
  }

  function itemMeu(meu, indice) {
    var caixa = item({ nome: meu.nome, url: meu.url, nota: "meu link",
                       logoDados: meu.logoDados }, true);
    var fora = el("div", "item-caixa");
    fora.appendChild(caixa);
    var x = el("button", "estrela estrela--tirar");
    x.type = "button";
    x.textContent = "×";
    x.title = "Tirar “" + meu.nome + "” dos meus favoritos";
    x.setAttribute("aria-label", x.title);
    x.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (!window.confirm("Tirar “" + meu.nome + "” dos seus favoritos?")) return;
      FAVORITOS.meus.splice(indice, 1);
      guardarFavoritos();
      desenharCentro();
    });
    fora.appendChild(x);
    return fora;
  }

  function formularioDeFavorito(bloco) {
    var f = el("form", "fav-novo");
    var nome = document.createElement("input");
    nome.className = "fav-novo__c"; nome.type = "text";
    nome.placeholder = "Nome"; nome.maxLength = 60; nome.required = true;
    var url = document.createElement("input");
    url.className = "fav-novo__c fav-novo__c--larga";
    /* TEXTO, E NÃO "url". O type=url faz o navegador recusar
       "gov.br" antes de o código rodar: o formulário nem dispara o
       envio, e a pessoa fica olhando um campo que não reage. Quem
       confere agora é normalizarEndereco, que completa o que falta
       e recusa o que não dá. O inputmode ainda pede o teclado de
       endereço no celular. */
    url.type = "text";
    url.setAttribute("inputmode", "url");
    url.setAttribute("autocapitalize", "off");
    url.setAttribute("spellcheck", "false");
    url.placeholder = "gov.br  (o https:// entra sozinho)";
    url.maxLength = 500; url.required = true;
    var ok = el("button", "btn-fav", "Guardar");
    ok.type = "submit";
    var erro = el("div", "fav-novo__erro");
    erro.hidden = true;

    f.appendChild(nome); f.appendChild(url); f.appendChild(ok);
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      erro.hidden = true;
      var n = nome.value.trim();
      var e = normalizarEndereco(url.value);
      if (!n) { erro.textContent = "Falta o nome."; erro.hidden = false; return; }
      if (!e) {
        erro.textContent = "Não entendi esse endereço. Escreva algo como gov.br " +
                           "ou https://gov.br/receitafederal.";
        erro.hidden = false; return;
      }
      /* Mostra no campo o endereço COMO FICOU. A pessoa escreveu
         "gov.br" e vai ser guardado "https://gov.br/" — ela tem o
         direito de ver isso antes de a tela fechar, para não
         descobrir no primeiro clique que virou outra coisa. */
      url.value = e;
      if (FAVORITOS.meus.length >= 30) {
        erro.textContent = "Trinta é o limite de links próprios.";
        erro.hidden = false; return;
      }
      /* Entra na hora, sem esperar o ícone: quem clicou já viu o
         link aparecer. A imagem chega depois e a tela se repinta —
         e se não chegar, ficam as iniciais, que é o normal de
         qualquer sistema sem logo aqui. */
      var novo = { nome: n, url: e };
      FAVORITOS.meus.push(novo);
      guardarFavoritos();
      desenharCentro();
      buscarIcone(e).then(function (dados) {
        if (!dados) return;
        if (FAVORITOS.meus.indexOf(novo) === -1) return;   /* tirado enquanto buscava */
        novo.logoDados = dados;
        guardarFavoritos();
        desenharCentro();
      });
    });

    bloco.appendChild(f);
    bloco.appendChild(erro);
    nome.focus();
  }

  /* ---------- O ícone do link próprio ----------

     O HUB NÃO FALA COM NINGUÉM — essa foi a escolha, e ela continua
     valendo para tudo o que é da casa. Aqui abre-se uma exceção
     estreita, igual à que a administração já abre para os sistemas:
     UMA pergunta ao unavatar.io, no instante em que a pessoa
     acrescenta o link, e a imagem que voltar fica guardada dentro
     do documento dela. Depois disso nenhuma abertura do Hub pede
     nada a ninguém.

     A conta honesta do que custa: o serviço fica sabendo daquele
     domínio, uma vez, quando a pessoa o acrescenta. É um link que
     ela mesma escolheu pôr ali, e não a lista de sistemas da casa.

     Por que unavatar e não outro: para virar imagem guardável, o
     navegador exige que o servidor autorize a leitura por outra
     origem, e é o único desses que autoriza E responde 404 quando
     não acha — em vez de devolver uma letra genérica pior do que as
     iniciais que o próprio Hub desenha. */

  /* ---------- O endereço que a pessoa digitou ----------

     "gov.br" é o que gente escreve. "https://gov.br" é o que um
     endereço precisa ser. Pedir o https:// à mão é pedir que a
     pessoa fale a língua da máquina.

     POR QUE NÃO BASTA COLAR "https://" NA FRENTE. O enderecoSeguro
     desta página resolve o texto CONTRA a página atual, e nessa
     conta "gov.br" não dá erro: vira
     https://hub.totalicontabilidade.com.br/gov.br — um endereço
     válido, que aponta para o próprio Hub. O favorito entraria e só
     se descobriria o engano no primeiro clique. Medi isso antes de
     escrever: por isso aqui a conta é feita SEM base, onde texto
     solto é erro em vez de caminho.

     E o esquema não se acrescenta cegamente: "javascript:alert(1)"
     já tem esquema, e é o que não pode passar. Quem já trouxe um,
     ou trouxe http/https e vale, ou não entra. */

  function temEsquema(texto) {
    /* Sem expressão regular de propósito: as barras invertidas
       desaparecem em edição automática, e quando desaparecem a
       regra passa a dizer outra coisa sem avisar. Aqui é só a
       pergunta "os dois-pontos vêm antes da primeira barra?", que
       é o que distingue um esquema de uma porta ou de um caminho. */
    var doisPontos = texto.indexOf(":");
    if (doisPontos === -1) return false;
    var barra = texto.indexOf("/");
    if (barra !== -1 && barra < doisPontos) return false;
    /* PONTO ANTES DOS DOIS-PONTOS QUER DIZER DOMÍNIO, NÃO ESQUEMA.
       "hub.sieg.com:8443/painel" é endereço com porta, e sem esta
       linha o código leria "hub.sieg.com" como esquema e recusaria
       um endereço legítimo — sistema interno com porta é comum.
       Esquema de verdade não tem ponto: http, https, javascript. */
    return texto.slice(0, doisPontos).indexOf(".") === -1;
  }

  function normalizarEndereco(texto) {
    var t = String(texto === undefined || texto === null ? "" : texto).trim();
    if (!t) return "";

    if (temEsquema(t)) {
      var baixo = t.toLowerCase();
      if (baixo.indexOf("http://") !== 0 && baixo.indexOf("https://") !== 0) return "";
    } else {
      t = "https://" + t;
    }

    try {
      /* SEM SEGUNDO ARGUMENTO. É esta ausência que faz texto solto
         virar erro em vez de caminho no domínio do Hub. */
      var u = new URL(t);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      if (!u.hostname) return "";
      /* Precisa parecer um domínio. Sem isto, "receita federal"
         viraria https://receita%20federal/ e entraria como
         favorito que nunca abre. */
      if (u.hostname.indexOf(".") === -1 && u.hostname !== "localhost") return "";
      return u.href;
    } catch (e) { return ""; }
  }

  function dominioDe(url) {
    try {
      var u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      var h = u.hostname;
      return h.indexOf("www.") === 0 ? h.slice(4) : h;
    } catch (e) { return ""; }
  }

  function buscarIcone(url) {
    return new Promise(function (pronto) {
      var dominio = dominioDe(url);
      if (!dominio) { pronto(""); return; }

      var img = new Image();
      /* Antes do src, sempre: é esta linha que faz o navegador
         pedir a autorização de leitura. Depois, não vale. */
      img.crossOrigin = "anonymous";
      var acabou = false;
      function desistir() { if (!acabou) { acabou = true; pronto(""); } }

      img.onload = function () {
        if (acabou) return;
        acabou = true;
        try {
          var lado = Math.min(64, Math.max(img.width, img.height)) || 64;
          var tela = document.createElement("canvas");
          tela.width = lado; tela.height = lado;
          var ctx = tela.getContext("2d");
          var e = Math.min(lado / img.width, lado / img.height);
          var l = Math.round(img.width * e), a = Math.round(img.height * e);
          ctx.drawImage(img, Math.round((lado - l) / 2), Math.round((lado - a) / 2), l, a);
          var dados = tela.toDataURL("image/png");
          /* Grande demais não entra: trinta links com imagem gorda
             estouram o documento, e aí a pessoa perderia a lista
             inteira por causa de um ícone. Iniciais servem. */
          pronto(dados.length <= 9000 ? dados : "");
        } catch (erro) { pronto(""); }
      };
      /* 404 cai aqui, e é o caso bom: o serviço não inventou nada. */
      img.onerror = desistir;
      /* Se o serviço não responder, a pessoa não fica esperando. */
      window.setTimeout(desistir, 6000);
      img.src = "https://unavatar.io/" + encodeURIComponent(dominio) + "?fallback=false";
    });
  }

  var FORM_FAVORITO_ABERTO = false;

  function desenharFavoritos(centro) {
    var daCasa = FAVORITOS.marcados.map(appDaCasa).filter(Boolean);
    var quantos = daCasa.length + FAVORITOS.meus.length;

    var b = bloco("Meus Favoritos", quantos || null);

    var acrescentar = el("button", "btn-fav btn-fav--cab",
      FORM_FAVORITO_ABERTO ? "Fechar" : "+ Acrescentar");
    acrescentar.type = "button";
    acrescentar.addEventListener("click", function () {
      FORM_FAVORITO_ABERTO = !FORM_FAVORITO_ABERTO;
      desenharCentro();
    });
    b.querySelector(".bloco__cab").appendChild(acrescentar);

    if (FORM_FAVORITO_ABERTO) formularioDeFavorito(b);

    if (FAVORITOS_ERRO) {
      var aviso = el("div", "fav-novo__erro", FAVORITOS_ERRO);
      aviso.hidden = false;
      b.appendChild(aviso);
    }

    if (!quantos) {
      b.appendChild(el("div", "busca-vazia",
        "Nada aqui ainda. Clique na estrela de um sistema para trazê-lo para cima, " +
        "ou acrescente um link seu."));
    } else {
      var grade = el("div", "grade");
      daCasa.forEach(function (i) { grade.appendChild(item(i)); });
      FAVORITOS.meus.forEach(function (m, n) { grade.appendChild(itemMeu(m, n)); });
      b.appendChild(grade);
    }
    centro.appendChild(b);
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
      /* A borda (e o Enter que abre o primeiro) pertencem ao
         link, não ao invólucro da estrela: quem lê .item--primeiro
         espera um href. */
      if (n === 0) (no._link || no).classList.add("item--primeiro");
      grade.appendChild(no);
    });
    b.appendChild(grade);
    centro.appendChild(b);
  }

  function desenharCentro() {
    var centro = document.getElementById("centro");
    centro.textContent = "";

    if (FILTRO.trim()) { desenharBusca(centro); return; }

    /* ANTES DE TUDO. É a lista que a pessoa montou: se não vier
       primeiro, ela tem de passar os olhos pelos blocos da casa
       para achar o que já tinha escolhido — e aí não adiantou
       escolher. */
    desenharFavoritos(centro);

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
      /* SEM "cresce". A classe existia para o último bloco ocupar
         a sobra da tela quando a agenda era baixinha. Agora ela
         tem sete cartões e é mais alta que a sobra — e "cresce"
         também deixa ENCOLHER, o que fazia o bloco ficar 175px
         menor que o próprio conteúdo, com as últimas linhas caindo
         para fora do fundo branco. */
      var ba = bloco("Agenda do mês", null, false);
      ba.id = "bloco-agenda";
      ba.querySelector(".bloco__cab").appendChild(el("span", "bloco__n",
        new Date().toLocaleDateString("pt-BR", { month: "long" })));
      /* UM CARTÃO POR DATA, não por obrigação. Dezoito cartões
         soltos viravam um paredão em que nada se destacava — e
         cinco deles vencem no mesmo dia 15, o que a tela não
         dizia. Agrupados, são oito, e a pergunta que a pessoa faz
         de manhã ("o que vence hoje?") tem resposta numa olhada.

         O agrupamento usa LISTA, não objeto: chaves como "08" e
         "09" têm zero à esquerda, e o JavaScript as ordena como
         texto, jogando-as para depois do dia 30. */
      var grupos = [];
      AGENDA_ATUAL.forEach(function (p) {
        var g = grupos[grupos.length - 1];
        if (!g || g.dia !== p.dia) { g = { dia: p.dia, semana: p.semana, estado: p.estado, itens: [] }; grupos.push(g); }
        /* O estado mais urgente do dia manda na cor do grupo. */
        if (p.estado === "hoje") g.estado = "hoje";
        else if (p.estado === "perto" && g.estado !== "hoje") g.estado = "perto";
        g.itens.push(p);
      });

      var ag = el("div", "agenda");
      grupos.forEach(function (g) {
        var x = el("div", "prazo" + (g.estado ? " prazo--" + g.estado : ""));

        var cab = el("div", "prazo__cab");
        cab.appendChild(el("span", "prazo__d", g.dia));
        if (g.semana) cab.appendChild(el("span", "prazo__s", g.semana));
        x.appendChild(cab);

        var lista = el("ul", "prazo__lista");
        g.itens.forEach(function (i) {
          var li = el("li", "prazo__i");
          li.appendChild(el("span", "prazo__n", i.nome));
          if (i.regime && i.regime !== "todos") {
            li.appendChild(el("span", "prazo__r prazo__r--" + i.regime,
              i.regime === "simples" ? "Simples" : "Normal"));
          }
          if (i.quem) li.appendChild(el("span", "prazo__q", i.quem));
          lista.appendChild(li);
        });
        x.appendChild(lista);
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
  /* ---------- a agenda do mês inteiro ----------
     A agenda do centro esconde o que já venceu, e faz bem: prazo
     vencido no meio dos próximos atrapalha quem está procurando o
     de amanhã. Só que "o que eu já paguei este mês?" também é
     pergunta legítima, e para ela não havia resposta em lugar
     nenhum.

     Este painel mostra o mês fechado, do dia 1 ao 31, com o que
     passou em cinza. Reaproveita a mesma gaveta dos sistemas: é
     mais uma coisa que se abre por cima e se fecha no Esc, e não
     havia motivo para inventar outra. */
  function abrirAgendaCheia() {
    if (typeof Agenda === "undefined") return;

    var corpo = document.getElementById("painel-corpo");
    corpo.textContent = "";
    document.getElementById("painel-t").textContent =
      "Agenda de " + new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    /* doMes() já esconde o que passou. Para ver o mês fechado,
       pergunto a ele com data de referência no dia 1. */
    var hoje = new Date();
    var tudo = Agenda.doMes(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    var diaHoje = hoje.getDate();

    var grupos = [];
    tudo.forEach(function (p) {
      var g = grupos[grupos.length - 1];
      if (!g || g.dia !== p.dia) { g = { dia: p.dia, semana: p.semana, itens: [] }; grupos.push(g); }
      g.itens.push(p);
    });

    var caixa = el("div", "agenda agenda--cheia");
    grupos.forEach(function (g) {
      var passou = parseInt(g.dia, 10) < diaHoje;
      var ehHoje = parseInt(g.dia, 10) === diaHoje;
      var x = el("div", "prazo" + (passou ? " prazo--passou" : "") + (ehHoje ? " prazo--hoje" : ""));

      var cab = el("div", "prazo__cab");
      cab.appendChild(el("span", "prazo__d", g.dia));
      if (g.semana) cab.appendChild(el("span", "prazo__s", g.semana));
      if (passou) cab.appendChild(el("span", "prazo__s", "· venceu"));
      x.appendChild(cab);

      var lista = el("ul", "prazo__lista");
      g.itens.forEach(function (i) {
        var li = el("li", "prazo__i");
        li.appendChild(el("span", "prazo__n", i.nome));
        if (i.regime && i.regime !== "todos") {
          li.appendChild(el("span", "prazo__r prazo__r--" + i.regime,
            i.regime === "simples" ? "Simples" : "Normal"));
        }
        if (i.quem) li.appendChild(el("span", "prazo__q", i.quem));
        lista.appendChild(li);
      });
      x.appendChild(lista);
      caixa.appendChild(x);
    });

    corpo.appendChild(caixa);
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

  /* ---------- os dois que só piscavam ----------
     Pendências e Agenda apontavam para pedaços que JÁ ESTÃO na
     tela. O clique acendia o ícone, o alvo dava uma piscada, e
     nada acontecia de fato — porque não havia para onde ir.

     Agora eles abrem o que NÃO cabe na tela: o quadro de todas as
     pendências do escritório, e o mês inteiro da agenda, com o que
     já venceu junto. Botão que mostra o que a tela não mostra tem
     motivo para existir; botão que rola até o que está à vista,
     não. */
  (function ligarQuadro() {
    var b = document.getElementById("nav-pendencias");
    if (!b) return;
    b.title = "Todas as pendências do escritório";
    b.addEventListener("click", function () {
      acender(b);
      if (typeof PendenciasUI !== "undefined" && PendenciasUI.abrirTodas) PendenciasUI.abrirTodas();
    });
  })();

  (function ligarAgendaCheia() {
    var b = document.getElementById("nav-agenda");
    if (!b) return;
    b.title = "O mês inteiro, com o que já venceu";
    b.addEventListener("click", function () { acender(b); abrirAgendaCheia(); });
  })();

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
    /* NÃO LIDA PULSA. O número já dizia quantas existem; o que
       faltava era distinguir "tenho três pendências, todas
       conhecidas" de "chegou uma agora e eu não vi". A primeira é
       rotina, a segunda é notícia. */
    var novas = r ? (r.naoLidas || 0) : 0;
    if (botao) botao.classList.toggle("nav__b--novo", novas > 0);

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
    /* Os setores vivem no banco. Busca sem esperar: a tela nunca
       depende deles para desenhar, e quem vai usá-los é o
       formulário de pendência, montado só quando alguém clica. */
    if (sessao) Dados.carregarSetores();
    if (sessao) {
      Dados.carregarFavoritos().then(function (f) {
        FAVORITOS = f;
        /* Só redesenha se houver o que mostrar: o centro já foi
           desenhado com a lista vazia, e repintar por nada faria
           os cartões piscarem na cara de quem abriu. */
        if (f.marcados.length || f.meus.length) desenharCentro();
      });
    }
    if (sessao || !Dados.temBanco()) abrirHub();
    else abrirPortao();
  });

})();
