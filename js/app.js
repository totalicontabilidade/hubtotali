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

   4. CINCO VISTAS, UMA POR VEZ (desde 09/11/2026). Início é o
      resumo do dia; Pendências é o quadro; Sistemas é a lista da
      casa inteira; Notícias e Agenda têm as suas. Nada abre por
      cima de nada: a antiga janela dos órgãos e a da agenda do
      mês viraram vistas, com lugar e nome na barra.
   ============================================================ */

(function () {
  "use strict";

  var SETORES_ATUAIS = [];
  /* O nome do cartão que junta os grupos "gaveta". Vem da
     administração; sem nada gravado, fica o de sempre. */
  var TITULO_GAVETA_PADRAO = "Órgãos, impostos e consultas";
  var TITULO_GAVETA = TITULO_GAVETA_PADRAO;
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
      a.addEventListener("click", function () { contarUso(i.nome); });
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

  /* Gravações ainda no caminho. Enquanto houver alguma, a lista que
     volta do banco não substitui a da tela: ela ainda não tem o
     clique seguinte, e a estrela piscaria apagada e acesa. */
  var FAV_PENDENTES = 0;

  /* mudanca(f) descreve a INTENÇÃO do clique. Ela é aplicada aqui,
     para a tela responder na hora, e de novo no banco, sobre a
     lista de verdade — que pode ter mudado noutra aba ou noutra
     máquina. Ver salvarFavoritos em dados.js. */
  function guardarFavoritos(mudanca) {
    FAVORITOS_ERRO = "";
    mudanca(FAVORITOS);
    desenharCentro();
    FAV_PENDENTES++;
    Dados.salvarFavoritos(mudanca).then(function (f) {
      FAV_PENDENTES--;
      if (!FAV_PENDENTES) aplicarFavoritos(f);
    }, function (e) {
      FAV_PENDENTES--;
      /* NÃO ENGOLIR, E NÃO FINGIR. A mudança não chegou à conta, e
         a tela volta ao que a conta tem — deixar a estrela acesa
         seria deixar a pessoa acreditar numa coisa que não
         aconteceu. */
      FAVORITOS_ERRO = "Não consegui salvar essa mudança na sua conta, e ela foi desfeita. " +
                       "Tente de novo daqui a pouco. " + (e && e.message ? e.message : "");
      if (FAV_PENDENTES) { desenharCentro(); return; }
      Dados.carregarFavoritos().then(function (r) {
        FAVORITOS = r.favoritos;
        desenharCentro();
      });
    });
  }

  /* Troca a lista da tela pela do banco, e só repinta se mudou. */
  function aplicarFavoritos(f) {
    if (JSON.stringify(f) === JSON.stringify(FAVORITOS)) return;
    FAVORITOS = f;
    if (!telaEmUso()) desenharCentro();
  }

  /* RELIDOS QUANDO A PESSOA VOLTA À ABA. O Hub fica aberto o dia
     todo, e uma aba que só lê os favoritos ao abrir mostra à tarde
     a lista da manhã. A gravação já não depende disto para ser
     certa — mas a tela, sim. */
  function recarregarFavoritos() {
    if (FAV_PENDENTES || telaEmUso()) return;
    Dados.carregarFavoritos().then(function (r) {
      if (!r.lido || FAV_PENDENTES || telaEmUso()) return;
      var tirouAviso = FAVORITOS_ERRO === AVISO_SEM_LEITURA;
      if (tirouAviso) FAVORITOS_ERRO = "";
      if (JSON.stringify(r.favoritos) !== JSON.stringify(FAVORITOS)) aplicarFavoritos(r.favoritos);
      else if (tirouAviso) desenharCentro();
    });
  }

  var AVISO_SEM_LEITURA = "Não consegui buscar seus favoritos na sua conta agora. " +
                          "Esta é a cópia guardada neste navegador.";

  function virarFavorito(nome) {
    /* A intenção sai do que a pessoa VIU: estrela apagada é
       "marcar". Um "inverter" aplicado no banco desfaria o que
       outra aba já tivesse marcado. */
    var marcar = !ehFavorito(nome);
    guardarFavoritos(function (f) {
      var onde = f.marcados.indexOf(nome);
      if (marcar && onde === -1) f.marcados.push(nome);
      if (!marcar && onde !== -1) f.marcados.splice(onde, 1);
    });
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

  function itemMeu(meu) {
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
      /* Pelo endereço, e não pela posição: na lista do banco o
         link pode estar noutro lugar. */
      guardarFavoritos(function (f) {
        f.meus = f.meus.filter(function (m) { return m.url !== meu.url; });
      });
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

    /* A recusa que ENSINA o caminho certo em vez de só barrar.
       Quando existe uma ação óbvia — marcar a estrela do sistema
       que a pessoa tentou guardar à mão —, o botão fica ali, e ela
       não precisa fechar isto e ir procurar o cartão na tela. */
    function dizer(texto, rotuloDoBotao, aoClicar) {
      erro.textContent = "";
      erro.appendChild(document.createTextNode(texto));
      if (rotuloDoBotao) {
        var b = el("button", "btn-fav btn-fav--erro", rotuloDoBotao);
        b.type = "button";
        b.addEventListener("click", aoClicar);
        erro.appendChild(b);
      }
      erro.hidden = false;
    }

    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      erro.hidden = true;
      erro.textContent = "";
      var n = nome.value.trim();
      var e = normalizarEndereco(url.value);
      if (!n) { dizer("Falta o nome."); return; }
      if (!e) {
        dizer("Não entendi esse endereço. Escreva algo como gov.br " +
              "ou https://gov.br/receitafederal.");
        return;
      }
      /* Mostra no campo o endereço COMO FICOU. A pessoa escreveu
         "gov.br" e vai ser guardado "https://gov.br/" — ela tem o
         direito de ver isso antes de a tela fechar, para não
         descobrir no primeiro clique que virou outra coisa. */
      url.value = e;

      /* JÁ EXISTE NA CASA? Então a estrela é o caminho certo, e não
         um link próprio. Não é preciosismo: o favorito marcado
         guarda só o NOME, e o endereço continua saindo da
         administração — se ele mudar, o favorito acompanha. Um link
         próprio congela o endereço de hoje e um dia quebra calado. */
      var daCasa = appDaCasaCom(e);
      if (daCasa) {
        if (ehFavorito(daCasa.nome)) {
          dizer("“" + daCasa.nome + "” é um sistema da casa e já está nos seus favoritos.");
        } else {
          dizer("“" + daCasa.nome + "” já é um sistema da casa. Marque a estrela dele em vez " +
                "de guardar o endereço à mão — assim, se a administração trocar o link, " +
                "o seu favorito acompanha sozinho.",
                "Pôr “" + daCasa.nome + "” nos favoritos", function () {
                  virarFavorito(daCasa.nome);   /* já redesenha tudo */
                });
        }
        return;
      }

      /* E já é um link meu? Dois cartões idênticos não ajudam
         ninguém, e o segundo some no meio da lista. */
      var meuIgual = null;
      FAVORITOS.meus.forEach(function (m) {
        if (!meuIgual && mesmoLugar(m.url, e)) meuIgual = m;
      });
      if (meuIgual) {
        dizer("Você já tem esse endereço aqui, com o nome “" + meuIgual.nome + "”.");
        return;
      }

      if (FAVORITOS.meus.length >= 30) {
        dizer("Trinta é o limite de links próprios.");
        return;
      }
      /* Entra na hora, sem esperar o ícone: quem clicou já viu o
         link aparecer. A imagem chega depois e a tela se repinta —
         e se não chegar, ficam as iniciais, que é o normal de
         qualquer sistema sem logo aqui. */
      guardarFavoritos(function (f) {
        var jaTem = f.meus.some(function (m) { return mesmoLugar(m.url, e); });
        if (!jaTem) f.meus.push({ nome: n, url: e });
      });
      buscarIcone(e).then(function (dados) {
        if (!dados) return;
        var aindaEsta = FAVORITOS.meus.some(function (m) { return m.url === e; });
        if (!aindaEsta) return;   /* tirado enquanto buscava */
        guardarFavoritos(function (f) {
          f.meus.forEach(function (m) { if (m.url === e) m.logoDados = dados; });
        });
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

  /* ---------- O mesmo lugar, escrito de outro jeito ----------

     Serve para não deixar alguém guardar como "link meu" um sistema
     que a casa já tem. Quem faz isso perde o que a estrela dá: o
     endereço do favorito marcado continua saindo da administração,
     então se ele mudar amanhã o favorito acompanha sozinho. Um link
     próprio apontando para o mesmo lugar congela o endereço de hoje
     e um dia quebra calado.

     POR QUE HOST **MAIS CAMINHO**, E NÃO SÓ O DOMÍNIO. Medi a lista
     da casa antes de escolher: gov.br sozinho hospeda seis sistemas
     diferentes — SPED, eSocial, Trabalho, REDESIM —, e
     totalicontabilidade.github.io outros seis. Comparar domínio
     recusaria um link legítimo dizendo que já existe, e a pessoa não
     teria como discordar. Com o caminho na conta, cada um desses
     seis continua sendo um sistema distinto.

     A busca e o fragmento (?x=1, #aba) ficam FORA da conta: são a
     mesma página aberta em outro estado, e quem digitou o endereço
     com um parâmetro a mais não quis um sistema novo. */

  function mesmoLugar(a, b) {
    var x = pedacoQueIdentifica(a);
    return !!x && x === pedacoQueIdentifica(b);
  }

  function pedacoQueIdentifica(url) {
    try {
      var u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      var h = u.hostname.toLowerCase();
      if (h.indexOf("www.") === 0) h = h.slice(4);
      /* Barra no fim não muda a página. Tirada num laço, e não com
         expressão regular: barra invertida some em edição
         automática, e aqui somem junto as garantias. */
      var c = u.pathname;
      while (c.length > 0 && c.charAt(c.length - 1) === "/") c = c.slice(0, -1);
      return h + c.toLowerCase();
    } catch (e) { return ""; }
  }

  function appDaCasaCom(endereco) {
    var achado = null;
    SETORES_ATUAIS.forEach(function (s) {
      (s.itens || []).forEach(function (i) {
        if (!achado && i.url && mesmoLugar(i.url, endereco)) achado = i;
      });
    });
    return achado;
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
      FAVORITOS.meus.forEach(function (m) { grade.appendChild(itemMeu(m)); });
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

  /* ---------- Mais usados ----------
     Contado neste navegador, sem banco: é só uma pista de onde a
     pessoa clica mais, e a pista vale para a máquina em que ela
     clicou. Entra como bloco quando há o que mostrar e fica no
     lugar de sempre — o resto da lista não se mexe, então a memória
     do olho não se perde. */
  var CHAVE_USO = "hub-totali:uso";

  function lerUso() {
    try { var u = JSON.parse(window.localStorage.getItem(CHAVE_USO) || "{}"); return (u && typeof u === "object") ? u : {}; }
    catch (e) { return {}; }
  }

  function contarUso(nome) {
    try {
      var u = lerUso();
      u[nome] = (u[nome] || 0) + 1;
      window.localStorage.setItem(CHAVE_USO, JSON.stringify(u));
    } catch (e) {}
  }

  function maisUsados(quantos) {
    var u = lerUso();
    return Object.keys(u)
      .filter(function (n) { return u[n] >= 2 && appDaCasa(n); })
      .sort(function (a, b) { return u[b] - u[a]; })
      .slice(0, quantos)
      .map(appDaCasa);
  }

  function desenharMaisUsados(centro) {
    var lista = maisUsados(8);
    if (lista.length < 3) return;
    var b = bloco("Mais usados", lista.length);
    var grade = el("div", "grade");
    lista.forEach(function (i) { grade.appendChild(item(i)); });
    b.appendChild(grade);
    centro.appendChild(b);
  }

  /* O cartão de sistemas do Início: os favoritos, compactos. Quem
     não marcou nenhum vê os mais usados; quem nunca clicou em nada
     vê um convite. */
  function desenharFavoritosInicio() {
    var alvo = document.getElementById("ini-favoritos-lista");
    var titulo = document.getElementById("ini-favoritos-t");
    if (!alvo) return;
    alvo.textContent = "";
    var daCasa = FAVORITOS.marcados.map(appDaCasa).filter(Boolean);
    var lista = daCasa.concat(FAVORITOS.meus.map(function (m) {
      return { nome: m.nome, url: m.url, logoDados: m.logoDados };
    }));
    var rotulo = "Meus favoritos";
    if (!lista.length) { lista = maisUsados(6); if (lista.length) rotulo = "Mais usados"; }
    if (titulo) titulo.textContent = rotulo;
    if (!lista.length) {
      var v = el("div", "cartao__vazio");
      v.appendChild(el("div", "cartao__vazio-t", "Nenhum favorito ainda."));
      v.appendChild(el("div", "cartao__vazio-x", "Em Sistemas, clique na estrela dos que você mais usa e eles aparecem aqui."));
      alvo.appendChild(v);
      return;
    }
    var grade = el("div", "fv");
    lista.slice(0, 10).forEach(function (i) { grade.appendChild(item(i, true)); });
    alvo.appendChild(grade);
  }

  function desenharCentro() {
    var centro = document.getElementById("centro");
    centro.textContent = "";
    desenharFavoritosInicio();

    if (FILTRO.trim()) { desenharBusca(centro); return; }

    /* ANTES DE TUDO. É a lista que a pessoa montou: se não vier
       primeiro, ela tem de passar os olhos pelos blocos da casa
       para achar o que já tinha escolhido — e aí não adiantou
       escolher. */
    desenharFavoritos(centro);
    desenharMaisUsados(centro);

    /* A ORDEM É A DA ADMINISTRAÇÃO. Os grupos de estilo "gaveta"
       formam UM bloco ("Órgãos, impostos e consultas"), ABERTO aqui
       mesmo, com um rótulo por grupo, no lugar do primeiro
       grupo-gaveta da lista. Antes era um botão que abria uma
       janela por cima; numa vista só de sistemas, a janela não faz
       falta — rolar é mais rápido que abrir e fechar. */
    var resto = guardados();
    var gavetaFeita = false;

    function desenharGaveta() {
      var quantos = resto.reduce(function (n, s) { return n + (s.itens || []).length; }, 0);
      if (!quantos) return;
      var b = bloco(TITULO_GAVETA, quantos);
      b.classList.add("bloco--gaveta");
      resto.forEach(function (s) {
        if (!s.itens || !s.itens.length) return;
        var g = el("div", "sis__g");
        g.appendChild(el("span", "sis__rot", s.titulo));
        var grade = el("div", "grade");
        s.itens.forEach(function (i) { grade.appendChild(item(i)); });
        g.appendChild(grade);
        b.appendChild(g);
      });
      centro.appendChild(b);
    }

    SETORES_ATUAIS.forEach(function (s) {
      if (s.estilo === "gaveta") {
        if (!gavetaFeita) { gavetaFeita = true; desenharGaveta(); }
        return;
      }
      if (!s.itens || !s.itens.length) return;
      var b = bloco(s.titulo, s.itens.length);
      var grade = el("div", "grade");
      s.itens.forEach(function (i) { grade.appendChild(item(i)); });
      b.appendChild(grade);
      centro.appendChild(b);
    });
  }

  /* Um item da agenda: nome, regime, explicação — e o que a Receita
     disse. Dia conferido ganha um visto discreto; dia diferente do
     calculado ganha o aviso, com o dia calculado riscado. */
  function itemDaAgenda(i) {
    var li = el("li", "prazo__i");
    li.appendChild(el("span", "prazo__n", i.nome));
    if (i.regime && i.regime !== "todos") {
      li.appendChild(el("span", "prazo__r prazo__r--" + i.regime,
        i.regime === "simples" ? "Simples" : "Normal"));
    }
    if (i.oficialDia && i.confere) {
      var ok = el("span", "prazo__ok", "✓");
      ok.title = "Confere com a agenda da Receita Federal";
      li.appendChild(ok);
    }
    if (i.conferir) {
      var c = el("span", "prazo__conferir", "conferir");
      c.title = "Data escrita a partir do uso comum: confira antes de confiar.";
      li.appendChild(c);
    }
    if (i.quem) li.appendChild(el("span", "prazo__q", i.quem));
    if (i.diaCalculado) {
      var av = el("span", "prazo__q prazo__q--receita");
      av.appendChild(document.createTextNode("A Receita publicou dia " + i.dia + " (a regra dava " + i.diaCalculado + ")."));
      li.appendChild(av);
    }
    return li;
  }

  /* ---------- pendências ----------
     O quadro inteiro é a vista "Pendências" (js/pendencias/app.js);
     o cartão Hoje do trilho é o js/inicio.js. Os dois falam com o
     Hub pelo evento pendencias:mudou, que traz o resumo do dia — é
     ele que pinta o cabeçalho, o selo da barra e o título da aba. */
  function desenharPendencias() {
    window.addEventListener("pendencias:mudou", function (ev) { pintarResumo(ev.detail); });
    if (typeof Inicio !== "undefined") Inicio.iniciar();
    if (typeof PendenciasHub !== "undefined") pintarResumo(PendenciasHub.resumo());
  }

  /* ---------- avisos ----------

     A FAIXA VIRA LETREIRO QUANDO NÃO CABE.

     Antes ela mostrava os três primeiros e um "+ 2" no canto — e
     mesmo os três eram cortados quando o texto era longo. O "+ 2"
     dizia que havia mais sem dar jeito nenhum de ler: aviso que
     ninguém consegue ler não avisa.

     Agora entram todos. Se cabem, a faixa fica parada, como sempre
     foi. Se não cabem, ela passa devagar da direita para a
     esquerda, sem fim — a lista vai duas vezes seguidas, e depois
     do último aviso já vem o primeiro, separado por um traço com
     um pouco mais de espaço que os outros. Ninguém espera a faixa
     esvaziar para ela recomeçar. Quando a primeira cópia termina de
     sair, a segunda está exatamente onde a primeira começou, então
     o salto de volta não se vê.

     PARA QUANDO O MOUSE ESTÁ EM CIMA: quem quer ler até o fim não
     pode ficar correndo atrás do texto. E quem pediu ao sistema
     menos movimento não ganha animação: a faixa fica parada e rola
     com o mouse ou o dedo. */
  var ASSINATURA_DOS_AVISOS = null;
  var PIXELS_POR_SEGUNDO = 24;

  function desenharAvisos() {
    var alvo = document.getElementById("avisos");
    if (!AVISOS_ATUAIS.length) {
      alvo.textContent = "";
      alvo.hidden = true;
      ASSINATURA_DOS_AVISOS = null;
      return;
    }
    /* A mesma lista de novo não recomeça o letreiro do zero no meio
       da leitura de alguém — isto roda a cada atualização da casa. */
    var assinatura = JSON.stringify(AVISOS_ATUAIS.map(function (a) { return [a.titulo, a.texto]; }));
    if (assinatura === ASSINATURA_DOS_AVISOS && !alvo.hidden) return;
    ASSINATURA_DOS_AVISOS = assinatura;

    alvo.textContent = "";
    alvo.hidden = false;
    alvo.appendChild(el("span", "avisos__rot", "Avisos"));

    var janela = el("div", "avisos__janela");
    var trilho = el("div", "avisos__trilho");
    janela.appendChild(trilho);
    alvo.appendChild(janela);

    trilho.appendChild(copiaDosAvisos());
    medirAvisos();
  }

  function copiaDosAvisos() {
    var copia = el("span", "avisos__copia");
    AVISOS_ATUAIS.forEach(function (a, i) {
      if (i) copia.appendChild(el("span", "av__sep"));
      var x = el("span", "av");
      x.appendChild(el("span", "av__p"));
      x.appendChild(el("span", "av__t", a.titulo));
      if (a.texto) x.appendChild(el("span", "av__x", a.texto));
      copia.appendChild(x);
    });
    /* O traço entre o último aviso e o primeiro da volta seguinte.
       Só aparece com a faixa correndo, e com um respiro um pouco
       maior que o dos outros: a lista não para, mas o olho percebe
       que ali ela recomeçou. */
    copia.appendChild(el("span", "av__sep av__sep--volta"));
    return copia;
  }

  /* Decide se a faixa corre, e a que distância. Chamada depois de
     desenhar e a cada mudança de largura da janela: o que cabe numa
     tela grande não cabe na do notebook. */
  function medirAvisos() {
    var alvo = document.getElementById("avisos");
    var janela = alvo.querySelector(".avisos__janela");
    var trilho = alvo.querySelector(".avisos__trilho");
    if (!janela || !trilho) return;

    /* Volta ao estado parado, com uma cópia só, para medir o que a
       lista ocupa de verdade. */
    alvo.classList.remove("avisos--corre");
    while (trilho.children.length > 1) trilho.removeChild(trilho.lastChild);
    var copia = trilho.firstChild;
    if (copia.scrollWidth <= janela.clientWidth) return;

    var segunda = copiaDosAvisos();
    /* Para quem lê com leitor de tela, a lista é uma só. */
    segunda.setAttribute("aria-hidden", "true");
    trilho.appendChild(segunda);
    alvo.classList.add("avisos--corre");

    /* A distância de uma volta é de onde a primeira cópia começa até
       onde a segunda começa: a lista mais o respiro entre o fim e o
       recomeço. Medida DEPOIS da classe, que é quem põe o respiro. */
    var distancia = segunda.offsetLeft - copia.offsetLeft;
    trilho.style.setProperty("--avisos-dist", distancia + "px");
    trilho.style.setProperty("--avisos-dur", Math.max(8, distancia / PIXELS_POR_SEGUNDO) + "s");
  }

  var esperaDaLargura = null;
  window.addEventListener("resize", function () {
    window.clearTimeout(esperaDaLargura);
    esperaDaLargura = window.setTimeout(medirAvisos, 200);
  });
  /* A fonte da página chega depois da primeira pintura e muda a
     largura do texto; medida antes dela, a volta sairia curta e o
     letreiro daria um tranco a cada recomeço. */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(medirAvisos);

  /* ---------- a agenda: a vista e o cartão do Início ----------
     A agenda calculada (js/agenda.js) é cruzada com a oficial da
     Receita (agendaDoMes, mais abaixo). Daqui saem duas coisas: a
     vista Agenda, com o mês inteiro em lista por dia — hoje,
     amanhã, próximos dias, depois, e o que já venceu apagado —, e
     o cartão "Próximos vencimentos" do Início, com os dez dias
     seguintes. Lista, e não grade de calendário: para achar uma
     data, lista é mais rápida (Hund, Dowell & Müller, 2014), e a
     grade só ganharia para achar dia da semana, que já está escrito
     em cada cartão. */
  var AGENDA_DESLOC = 0;   /* meses depois (ou antes) do atual, na vista */

  function mesRef(desloc) {
    var h = new Date();
    return new Date(h.getFullYear(), h.getMonth() + desloc, 1);
  }

  function rotuloQuando(faltam) {
    if (faltam < 0) return faltam === -1 ? "venceu ontem" : "venceu há " + (-faltam) + " dias";
    if (faltam === 0) return "hoje";
    if (faltam === 1) return "amanhã";
    return "em " + faltam + " dias";
  }

  /* Os itens de um mês com a data inteira e quantos dias faltam,
     contados do dia de hoje de verdade (agendaDoMes conta do dia de
     referência, que aqui é o 1º para trazer o mês fechado). */
  function itensDoMes(ref) {
    var ag = agendaDoMes(new Date(ref.getFullYear(), ref.getMonth(), 1));
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var lista = ag.itens.map(function (i) {
      var d = new Date(ref.getFullYear(), ref.getMonth(), parseInt(i.dia, 10));
      var faltam = Math.round((d - hoje) / 86400000);
      var n = {};
      Object.keys(i).forEach(function (k) { n[k] = i[k]; });
      n.data = d;
      n.faltam = faltam;
      n.estado = faltam === 0 ? "hoje" : (faltam > 0 && faltam <= 5 ? "perto" : "");
      return n;
    }).sort(function (a, b) { return (a.data - b.data) || String(a.nome).localeCompare(String(b.nome), "pt-BR"); });
    return { itens: lista, extras: ag.extras || [], ade: ag.ade || "" };
  }

  /* Cartões por DIA, com as obrigações daquele dia dentro. */
  function gradeDeDias(itens) {
    var grupos = [];
    itens.forEach(function (p) {
      var g = grupos[grupos.length - 1];
      if (!g || g.dia !== p.dia) { g = { dia: p.dia, semana: p.semana, estado: p.estado, itens: [] }; grupos.push(g); }
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
      g.itens.forEach(function (i) { lista.appendChild(itemDaAgenda(i)); });
      x.appendChild(lista);
      ag.appendChild(x);
    });
    return ag;
  }

  function desenharAgendaVista() {
    var alvo = document.getElementById("agenda-vista");
    if (!alvo || typeof Agenda === "undefined") return;
    alvo.textContent = "";

    var ref = mesRef(AGENDA_DESLOC);
    var m = itensDoMes(ref);
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var mesAtual = AGENDA_DESLOC === 0;

    var cab = el("div", "ag__cab");
    cab.appendChild(el("h2", "ag__t", ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })));
    if (m.ade) {
      var selo = el("span", "agenda__selo", "conferida com a Receita");
      selo.title = "As obrigações federais foram cruzadas com a agenda oficial (" + m.ade + ").";
      cab.appendChild(selo);
    }
    var nav = el("div", "ag__nav");
    function botao(rotulo, desloc, titulo) {
      var b = el("button", "ag__b", rotulo);
      b.type = "button";
      b.title = titulo;
      b.addEventListener("click", function () { AGENDA_DESLOC = desloc; desenharAgendaVista(); });
      return b;
    }
    var ant = botao("‹ mês anterior", AGENDA_DESLOC - 1, "Mês anterior");
    ant.disabled = AGENDA_DESLOC <= -6;
    nav.appendChild(ant);
    var hj = botao("Hoje", 0, "Voltar ao mês atual");
    hj.disabled = mesAtual;
    nav.appendChild(hj);
    var prox = botao("mês seguinte ›", AGENDA_DESLOC + 1, "Mês seguinte");
    prox.disabled = AGENDA_DESLOC >= 12;
    nav.appendChild(prox);
    cab.appendChild(nav);
    alvo.appendChild(cab);

    if (!m.itens.length) {
      alvo.appendChild(el("div", "ag__vazio", "Nenhuma obrigação calculada para este mês."));
      return;
    }

    /* As seções, na ordem em que a pessoa pergunta: o que é hoje,
       o que é amanhã, o que vem nos próximos dias, o resto do mês
       — e, no fim, o que já venceu, para a pergunta "eu paguei?". */
    var secoes = [
      { id: "hoje",   titulo: "Hoje",              teste: function (i) { return i.faltam === 0; } },
      { id: "amanha", titulo: "Amanhã",            teste: function (i) { return i.faltam === 1; } },
      { id: "semana", titulo: "Próximos 7 dias",   teste: function (i) { return i.faltam > 1 && i.faltam <= 7; } },
      { id: "depois", titulo: "Depois",            teste: function (i) { return i.faltam > 7; } },
      { id: "venceu", titulo: "Já venceu",         teste: function (i) { return i.faltam < 0; } },
    ];
    secoes.forEach(function (s) {
      var itens = m.itens.filter(s.teste);
      if (!itens.length) return;
      var sec = el("section", "ag__sec ag__sec--" + s.id);
      var tit = el("div", "ag__sec-t", s.titulo);
      tit.appendChild(el("small", null, itens.length + (itens.length === 1 ? " obrigação" : " obrigações")));
      sec.appendChild(tit);
      sec.appendChild(gradeDeDias(itens));
      alvo.appendChild(sec);
    });

    var rodape = el("div", "agenda__rodape");
    if (m.ade) {
      var extras = m.extras.filter(function (x) { return !mesAtual || parseInt(x.dia, 10) >= hoje.getDate(); });
      rodape.appendChild(el("p", "agenda__nota",
        "Obrigações federais conferidas com a agenda oficial da Receita Federal (" + m.ade + "). " +
        "Estado e município saem só da regra."));
      if (extras.length) {
        var det = document.createElement("details");
        det.className = "agenda__extras";
        var sum = document.createElement("summary");
        sum.textContent = "Outras obrigações na agenda da Receita neste mês (" + extras.length + ")";
        det.appendChild(sum);
        var ul = el("ul", "agenda__extras-lista");
        extras.forEach(function (x) {
          var li = el("li");
          li.appendChild(el("b", null, "dia " + x.dia + " · "));
          li.appendChild(document.createTextNode(x.completo + (x.periodo ? " (" + x.periodo + ")" : "")));
          ul.appendChild(li);
        });
        det.appendChild(ul);
        rodape.appendChild(det);
      }
    } else {
      rodape.appendChild(el("p", "agenda__nota",
        "Datas calculadas por regra. A agenda oficial da Receita ainda não foi lida para este mês."));
    }
    alvo.appendChild(rodape);
  }

  /* O cartão do Início: os dez dias seguintes, de hoje em diante,
     emendando o mês que vem quando o atual está acabando. */
  function desenharProximos() {
    var alvo = document.getElementById("prox-prazos-lista");
    var sub = document.getElementById("prox-prazos-sub");
    if (!alvo || typeof Agenda === "undefined") return;
    var DIAS = 10, LIMITE = 7;
    var itens = itensDoMes(mesRef(0)).itens.concat(itensDoMes(mesRef(1)).itens)
      .filter(function (i) { return i.faltam >= 0 && i.faltam <= DIAS; });
    alvo.textContent = "";
    if (sub) sub.textContent = "próximos " + DIAS + " dias";
    if (!itens.length) {
      var v = el("div", "cartao__vazio");
      v.appendChild(el("div", "cartao__vazio-t", "Nada vence nos próximos dez dias."));
      v.appendChild(el("div", "cartao__vazio-x", "A agenda do mês inteiro está na barra, em Agenda."));
      alvo.appendChild(v);
      return;
    }
    var lista = el("div", "px");
    itens.slice(0, LIMITE).forEach(function (i) {
      var x = el("div", "px__i" + (i.estado ? " px__i--" + i.estado : ""));
      var d = el("div", "px__d", i.dia);
      d.appendChild(el("small", null, i.semana || ""));
      x.appendChild(d);
      var txt = el("div", "px__txt");
      txt.appendChild(el("div", "px__n", i.nome));
      var meta = el("div", "px__m");
      meta.appendChild(el("span", "px__quando", rotuloQuando(i.faltam)));
      if (i.regime && i.regime !== "todos") {
        meta.appendChild(el("span", "prazo__r prazo__r--" + i.regime, i.regime === "simples" ? "Simples" : "Normal"));
      }
      if (i.oficialDia && i.confere) {
        var ok = el("span", "prazo__ok", "✓");
        ok.title = "Confere com a agenda da Receita Federal";
        meta.appendChild(ok);
      }
      if (i.conferir) meta.appendChild(el("span", "prazo__conferir", "conferir"));
      if (i.diaCalculado) meta.appendChild(el("span", "prazo__q--receita", "a Receita publicou dia " + i.dia));
      txt.appendChild(meta);
      x.appendChild(txt);
      lista.appendChild(x);
    });
    alvo.appendChild(lista);
    if (itens.length > LIMITE) {
      var mais = el("button", "px__mais", "+ " + (itens.length - LIMITE) + " na agenda");
      mais.type = "button";
      mais.addEventListener("click", function () { mostrarVista("agenda"); });
      alvo.appendChild(mais);
    }
  }

  /* ---------- as vistas ----------
     Cinco, e a barra troca entre elas. Cada <section class="vista">
     tem o id vista-<nome>; o botão da barra, nav-<nome>. */
  function acender(botao) {
    var todos = document.querySelectorAll(".nav__b");
    var i;
    for (i = 0; i < todos.length; i++) todos[i].classList.remove("on");
    if (botao) botao.classList.add("on");
  }

  var VISTA = "inicio";
  var NOMES_DAS_VISTAS = {
    inicio: "Início", pendencias: "Pendências", sistemas: "Sistemas",
    noticias: "Notícias oficiais", agenda: "Agenda tributária",
  };
  var SUBS_DAS_VISTAS = {
    inicio: "o seu dia num olhar",
    pendencias: "o seu quadro, por prazo e setor",
    sistemas: "todos os links da casa",
    noticias: "só fontes oficiais, lidas de hora em hora",
    agenda: "vencimentos do mês, conferidos com a Receita",
  };

  function mostrarVista(nome) {
    if (!NOMES_DAS_VISTAS.hasOwnProperty(nome)) nome = "inicio";
    VISTA = nome;
    var tela = document.getElementById("tela");
    tela.setAttribute("data-vista", nome);
    Object.keys(NOMES_DAS_VISTAS).forEach(function (v) {
      var sec = document.getElementById("vista-" + v);
      if (sec) sec.hidden = v !== nome;
    });
    var rotulo = document.getElementById("cab-vista");
    if (rotulo) rotulo.textContent = NOMES_DAS_VISTAS[nome];
    var sub = document.getElementById("cab-sub");
    if (sub) sub.textContent = SUBS_DAS_VISTAS[nome] || "";
    acender(document.getElementById("nav-" + nome));
    if (nome === "noticias" && typeof Noticias !== "undefined") Noticias.aoAbrirTela();
    if (nome === "agenda") desenharAgendaVista();
    /* Voltar ao Início aplica o que ficou esperando a tela livre. */
    if (nome === "inicio") window.setTimeout(aplicarSeLivre, 50);
    try { window.sessionStorage.setItem("hub-totali:vista", nome); } catch (e) {}
  }

  function irParaPendencia(id) {
    mostrarVista("pendencias");
    if (typeof PendenciasHub !== "undefined") window.setTimeout(function () { PendenciasHub.irPara(id); }, 30);
  }

  window.Hub = { mostrarVista: mostrarVista, irParaPendencia: irParaPendencia, vista: function () { return VISTA; } };

  (function ligarVistas() {
    function liga(id, vista) {
      var b = document.getElementById(id);
      if (b) b.addEventListener("click", function () { mostrarVista(vista); });
    }
    liga("nav-inicio", "inicio");
    liga("nav-pendencias", "pendencias");
    liga("nav-sistemas", "sistemas");
    liga("nav-noticias", "noticias");
    liga("nav-agenda", "agenda");
    /* As duas marcas — a da barra e a do cabeçalho — voltam ao
       Início, como em qualquer site. */
    liga("nav-logo", "inicio");
    liga("cab-logo", "inicio");
    /* Os "ver tudo" dos cartões do Início. */
    liga("pend-hoje-abrir", "pendencias");
    liga("noticias-ver-todas", "noticias");
    liga("prox-prazos-abrir", "agenda");
    liga("ini-favoritos-abrir", "sistemas");
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
    /* O número é o que precisa de atenção hoje — atrasadas e para
       hoje —, não o quadro inteiro: quarenta pendências em
       "acompanhar" não são quarenta avisos. */
    var quantas = r ? ((r.atrasadas || 0) + (r.hoje || 0)) : 0;
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
          (quantas > 1 ? " para hoje" : " para hoje") +
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
    if (r && !r.carregado) return;
    if (r && r.abertas === 0) {
      res.appendChild(document.createTextNode("nenhuma pendência aberta"));
      return;
    }
    /* Nada de "N sistemas no Hub" aqui: o tamanho da lista é assunto
       da administração, onde agora mora. Para a equipe o resumo é
       sempre sobre pendência — as atrasadas e as de hoje acima; e,
       quando não há nenhuma dessas, quantas estão abertas. */
    if (r && r.abertas > 0) {
      res.appendChild(document.createTextNode(
        "nada para hoje · " + r.abertas + (r.abertas > 1 ? " abertas no quadro" : " aberta no quadro")));
    }
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

  /* ---------- a agenda oficial da Receita ----------
     dados/agenda-oficial.json é gravado pelo robô (ferramentas/
     buscar-agenda.js). Com ele em mãos, a lista calculada é cruzada
     com a publicada: dia igual ganha o selo; dia diferente mostra o
     da Receita e avisa. Sem o arquivo, fica a regra, como sempre. */
  var AGENDA_OFICIAL = null;
  var AGENDA_EXTRAS = [];
  var AGENDA_ADE = "";

  function carregarAgendaOficial() {
    return fetch("dados/agenda-oficial.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { AGENDA_OFICIAL = (j && Array.isArray(j.meses)) ? j : null; })
      .catch(function () { AGENDA_OFICIAL = null; });
  }

  function mesOficial(ref) {
    if (!AGENDA_OFICIAL) return null;
    var ano = ref.getFullYear(), mes = ref.getMonth() + 1;
    return AGENDA_OFICIAL.meses.filter(function (m) { return m.ano === ano && m.mes === mes; })[0] || null;
  }

  /* A lista do mês, já conferida. Onde a Receita diz outro dia, o
     dia da Receita manda — é ela quem multa. */
  function agendaDoMes(ref) {
    var hoje = ref || new Date();
    var lista = (typeof Agenda !== "undefined") ? Agenda.doMes(hoje) : [];
    var oficial = mesOficial(hoje);
    if (!oficial || typeof Agenda === "undefined") return { itens: lista, extras: [], ade: "" };
    var r = Agenda.cruzar(lista, oficial);
    var diaHoje = hoje.getDate();
    r.itens = r.itens.map(function (i) {
      if (!i.oficialDia || i.confere) return i;
      var d = new Date(hoje.getFullYear(), hoje.getMonth(), parseInt(i.oficialDia, 10));
      var faltam = Math.round((d - new Date(hoje.getFullYear(), hoje.getMonth(), diaHoje)) / 86400000);
      var novo = {};
      Object.keys(i).forEach(function (k) { novo[k] = i[k]; });
      novo.diaCalculado = i.dia;
      novo.dia = i.oficialDia;
      novo.semana = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3);
      novo.estado = faltam === 0 ? "hoje" : (faltam > 0 && faltam <= 5 ? "perto" : "");
      novo._ordem = d.getTime();
      novo._passou = faltam < 0;
      return novo;
    }).filter(function (x) { return !x._passou; })
      .sort(function (a, b) { return a._ordem - b._ordem; });
    return r;
  }

  function desenharTudo(dados) {
    SETORES_ATUAIS = dados.setores || [];
    AVISOS_ATUAIS  = dados.avisos  || [];
    TITULO_GAVETA  = (dados.gaveta && String(dados.gaveta.titulo || "").trim()) || TITULO_GAVETA_PADRAO;
    /* Calculada, não guardada: assim ela se corrige sozinha
       todo mês sem ninguém precisar editar nada — e conferida
       com a agenda oficial quando o arquivo dela está aqui. */
    var ag = agendaDoMes();
    AGENDA_ATUAL = ag.itens.length ? ag.itens : (dados.agenda || []);
    AGENDA_EXTRAS = ag.extras;
    AGENDA_ADE = ag.ade;
    desenharCentro();
    desenharProximos();
    if (VISTA === "agenda") desenharAgendaVista();
    desenharAvisos();
  }

  function abrirHub() {
    document.getElementById("portao").hidden = true;
    document.getElementById("tela").hidden = false;

    /* A versão do servidor chega um instante depois da primeira
       pintura, e a pessoa pode ter aberto algo nesse meio-tempo. */
    desenharTudo(Dados.carregar(desenharSistemasQuandoLivre));

    desenharTopo();
    desenharPendencias();
    if (typeof Noticias !== "undefined") Noticias.iniciar();
    /* O quadro espera por este aviso quando a pessoa acabou de
       passar pelo portão; com a sessão já guardada ele nem precisa. */
    window.dispatchEvent(new CustomEvent("hub:sessao"));
    mostrarVista("inicio");

    /* Chega depois da primeira pintura, de propósito: a saudação
       não espera o banco para aparecer. Quando o nome chega, o
       cabeçalho se redesenha. */
    Dados.meuCadastro().then(function (p) {
      if (!p || !p.nome || p.nome === NOME_CADASTRADO) return;
      NOME_CADASTRADO = p.nome;
      if (desenharTopo.repintarSaudacao) desenharTopo.repintarSaudacao();
    });

    ligarAtualizacaoSozinha();
  }

  /* ---------- O Hub se atualiza sozinho ----------

     ESTA PÁGINA NÃO É RECARREGADA. Ela é a inicial do navegador:
     abre de manhã e fica. Dias, num computador que não se desliga.
     Sem isto, uma pendência aberta às nove só aparecia para o
     colega no dia em que ele fechasse o navegador — e um recado
     urgente não chegava nunca.

     Não há aviso instantâneo do banco sem carregar a biblioteca do
     Firebase, e carregar biblioteca de terceiro nesta página é
     justamente o que este projeto não faz. Então é consulta de
     tempo em tempo, com três economias que importam numa tela que
     passa o dia aberta:

     · ABA ESCONDIDA CONSULTA MENOS — E NÃO "NÃO CONSULTA". Escrevi
       assim na primeira vez e estava errado: aba escondida é
       exatamente o caso para o qual o NÚMERO NO TÍTULO DA ABA
       existe. É o que faz "(2) Hub Totali" aparecer na barra do
       navegador para quem deixou o Hub numa aba de fundo — que é a
       maioria, já que ele é a página inicial. Parar de consultar
       enquanto escondida congelava esse número e matava o único
       aviso que o sistema tem sem servidor de e-mail.

       Então: visível, de minuto em minuto; escondida, de cinco em
       cinco. E ao voltar a ficar visível, na hora.

     · PENDÊNCIA DE MINUTO EM MINUTO, SISTEMA DE MEIA EM MEIA HORA.
       A lista de sistemas e os recados mudam quando alguém edita a
       administração, o que é raro; pendência muda o dia inteiro.
       Consultar as duas coisas no mesmo passo seria pagar caro pelo
       que não muda.

     · SÓ REDESENHA SE MUDOU, e só com a tela livre (telaEmUso, mais
       abaixo) — quem está
       escrevendo um comentário não pode ver o texto desaparecer. */

  var RELOGIO_PENDENCIAS = null;
  var RELOGIO_SISTEMAS = null;

  /* ---------- A TELA ESTÁ EM USO? ----------

     A atualização sozinha só redesenha quando a tela está "limpa":
     nada aberto por cima, nada sendo digitado, nenhuma busca na
     caixa, nenhum formulário de favorito aberto. Se estiver em
     uso, a novidade fica guardada e entra no primeiro instante em
     que a tela ficar livre — a pessoa não perde o que estava
     fazendo, e a novidade não se perde também.

     Antes a regra era "nunca com o painel de pendências aberto", e
     só valia para as pendências: a lista de sistemas redesenhava o
     centro sem perguntar nada a ninguém. */
  function telaEmUso() {
    if (typeof PendenciasHub !== "undefined" && PendenciasHub.emUso()) return true;
    if (FORM_FAVORITO_ABERTO) return true;
    if (FILTRO && FILTRO.trim()) return true;
    var a = document.activeElement;
    if (a && a !== document.body &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable) &&
        /* Campo escondido não é alguém digitando: o foco pode
           sobrar num campo de um painel que já fechou. */
        a.getClientRects().length > 0) return true;
    return false;
  }

  var SISTEMAS_ESPERANDO = null;
  var PENDENCIAS_ESPERANDO = false;

  function desenharSistemasQuandoLivre(maisNovo) {
    if (telaEmUso()) { SISTEMAS_ESPERANDO = maisNovo; return; }
    SISTEMAS_ESPERANDO = null;
    desenharTudo(maisNovo);
  }

  /* Chamado depois de cliques, teclas e saídas de campo: é quando a
     tela pode ter acabado de ficar livre. Só faz algo se houver
     novidade esperando, então não custa nada no uso normal. */
  function aplicarSeLivre() {
    if (!SISTEMAS_ESPERANDO && !PENDENCIAS_ESPERANDO) return;
    if (telaEmUso()) return;
    if (SISTEMAS_ESPERANDO) {
      var d = SISTEMAS_ESPERANDO;
      SISTEMAS_ESPERANDO = null;
      desenharTudo(d);
    }
    PENDENCIAS_ESPERANDO = false;
  }

  (function ligarAplicarSeLivre() {
    var espera = null;
    function logo() {
      if (!SISTEMAS_ESPERANDO && !PENDENCIAS_ESPERANDO) return;
      if (espera) window.clearTimeout(espera);
      /* Um instante depois: o clique que fecha o painel precisa
         terminar de fechá-lo antes de a pergunta ser feita. */
      espera = window.setTimeout(aplicarSeLivre, 400);
    }
    document.addEventListener("click", logo, true);
    document.addEventListener("keyup", logo, true);
    document.addEventListener("focusout", logo, true);
  })();

  function ligarAtualizacaoSozinha() {
    if (ligarAtualizacaoSozinha.ligado) return;
    ligarAtualizacaoSozinha.ligado = true;

    /* O quadro de pendências se atualiza por conta própria
       (js/pendencias/armazenamento/firestore.js), de minuto em
       minuto, e avisa o cabeçalho pelo evento. Aqui só se garante
       que a volta à aba força uma leitura. */
    function pendencias() {
      if (typeof PendenciasHub !== "undefined" && !document.hidden) PendenciasHub.atualizar();
    }

    /* Um relógio só, batendo de minuto em minuto, e a aba escondida
       só aproveita uma batida em cada cinco. Dois relógios
       independentes dariam o mesmo resultado com o dobro de partes
       para errar. */
    function passo() {
      aplicarSeLivre();
    }

    function sistemas() {
      if (document.hidden) return;
      /* O próprio Dados.carregar avisa quando o que veio do servidor
         é diferente do que está na tela — e só nesse caso. */
      Dados.carregar(desenharSistemasQuandoLivre);
      recarregarFavoritos();
    }

    RELOGIO_PENDENCIAS = window.setInterval(passo, 60 * 1000);
    RELOGIO_SISTEMAS   = window.setInterval(sistemas, 30 * 60 * 1000);

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      pendencias();
      sistemas();
    });
    window.addEventListener("online", function () { pendencias(); sistemas(); });
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
      if (VISTA !== "sistemas") mostrarVista("sistemas");
      cx.focus();
      cx.select();
    });
    /* A busca procura sistemas, então clicar nela leva à vista
       Sistemas, onde os resultados aparecem. */
    cx.addEventListener("focus", function () { if (VISTA !== "sistemas") mostrarVista("sistemas"); });
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

  /* A agenda oficial chega por baixo; quando chegar, o cartão da
     agenda se refaz, e só ele. */
  carregarAgendaOficial().then(function () {
    if (!document.getElementById("tela").hidden && !telaEmUso()) desenharTudo(Dados.carregar(desenharSistemasQuandoLivre));
  });

  Dados.pronto().then(function (sessao) {
    /* Os setores vivem no banco. Busca sem esperar: a tela nunca
       depende deles para desenhar, e quem vai usá-los é o
       formulário de pendência, montado só quando alguém clica. */
    if (sessao) Dados.carregarSetores();
    if (sessao) {
      Dados.carregarFavoritos().then(function (r) {
        var f = r.favoritos;
        /* Uma estrela clicada antes de a lista chegar já saiu pela
           fila, sobre a lista do banco: a resposta dela manda. */
        if (FAV_PENDENTES) return;
        FAVORITOS = f;
        if (!r.lido) FAVORITOS_ERRO = AVISO_SEM_LEITURA;
        /* Só redesenha se houver o que mostrar: o centro já foi
           desenhado com a lista vazia, e repintar por nada faria
           os cartões piscarem na cara de quem abriu. */
        if (f.marcados.length || f.meus.length || !r.lido) desenharCentro();
      });
    }
    if (sessao || !Dados.temBanco()) abrirHub();
    else abrirPortao();
  });

})();
