/* ============================================================
   Hub Totali · página de administração
   ------------------------------------------------------------
   Edita a lista que o Hub mostra. Depois desta página, ninguém
   precisa abrir arquivo de código para mexer no Hub.

   Três decisões que explicam o que vem abaixo:

   1. NADA É GRAVADO ATÉ CLICAR EM SALVAR. Toda edição mexe numa
      cópia em memória. É o que permite errar sem medo: fechou a
      aba sem salvar, nada aconteceu. Em compensação, o botão
      Salvar muda de cor quando há coisa pendente, e a página
      avisa antes de fechar.

   2. EDIÇÃO NO LUGAR, sem janela que abre por cima. O campo do
      nome é o nome. Menos cliques, e a pessoa vê a lista
      inteira enquanto mexe numa linha.

   3. O LOGO ENVIADO É REDUZIDO A 64x64 aqui mesmo, antes de
      guardar. Uma foto de 2 MB colada num logo de 20 pixels na
      tela encheria o documento do banco à toa — e o documento
      tem teto de 1 MB para tudo.
   ============================================================ */

(function () {
  "use strict";

  var INDICE_LOGOS = (typeof LOGOS !== "undefined") ? LOGOS : {};
  var PASTA_LOGOS = "assets/logos/";

  var dados = null;        /* a cópia em edição */
  var pendente = false;    /* há mudança não salva? */

  /* ---------- Utilidades ---------- */

  function $(id) { return document.getElementById(id); }

  function elemento(tag, classe, texto) {
    var el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
  }

  function apelido(nome) {
    return String(nome).toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function sigla(item) {
    if (item.sigla) return String(item.sigla);
    var nome = String(item.nome || "?");
    var ligacao = ["de", "do", "da", "dos", "das", "e"];
    var palavras = nome.split(/[\s·/·-]+/).filter(function (p) {
      return p && ligacao.indexOf(p.toLowerCase()) === -1;
    });
    if (!palavras.length) palavras = nome.split(/\s+/);
    if (palavras.length > 1) return palavras[0].charAt(0) + palavras[1].charAt(0);
    var u = palavras[0] || "?";
    var interna = u.slice(1).match(/[A-ZÁÉÍÓÚÃÕÂÊÔÇ]/);
    if (/[a-z]/.test(u) && interna) return u.charAt(0) + interna[0];
    if (u.length <= 4 && u === u.toUpperCase()) return u;
    return u.substring(0, 2);
  }

  function marcarPendente() {
    pendente = true;
    var b = $("btn-salvar");
    b.disabled = false;
    b.classList.add("btn--pendente");
    b.textContent = "Salvar mudanças";
  }

  function limparPendente() {
    pendente = false;
    var b = $("btn-salvar");
    b.disabled = true;
    b.classList.remove("btn--pendente");
    b.textContent = "Salvar";
  }

  function recado(texto, erro) {
    var caixa = $("aviso-salvo");
    caixa.textContent = texto;
    caixa.classList.toggle("aviso-salvo--erro", !!erro);
    caixa.hidden = false;
    window.clearTimeout(caixa._t);
    caixa._t = window.setTimeout(function () { caixa.hidden = true; }, erro ? 6000 : 2600);
  }

  /* Fechar a aba com mudança pendente é a forma mais fácil de
     perder trabalho, e a única defesa é o navegador perguntar. */
  window.addEventListener("beforeunload", function (ev) {
    if (!pendente) return;
    ev.preventDefault();
    ev.returnValue = "";
  });

  /* ---------- Ícones ---------- */

  var ICONES = {
    pegador: '<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/>' +
             '<circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>' +
             '<circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
    lixo:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
             'stroke-linecap="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>',
    cima:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" ' +
             'stroke-linecap="round" stroke-linejoin="round"><path d="M6 14l6-6 6 6"/></svg>',
    baixo:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" ' +
             'stroke-linecap="round" stroke-linejoin="round"><path d="M6 10l6 6 6-6"/></svg>',
  };

  function botaoIcone(icone, titulo, perigo) {
    var b = elemento("button", "icone-btn" + (perigo ? " icone-btn--perigo" : ""));
    b.type = "button";
    b.title = titulo;
    b.setAttribute("aria-label", titulo);
    b.innerHTML = ICONES[icone];
    return b;
  }

  function caixaTexto(classe, valor, dica, aoMudar) {
    var i = document.createElement("input");
    i.type = "text";
    i.className = "campo__caixa " + classe;
    i.value = valor || "";
    if (dica) i.placeholder = dica;
    i.addEventListener("input", function () { aoMudar(i.value); marcarPendente(); });
    return i;
  }

  /* ---------- Logo ---------- */

  /* Colou o link, o ícone aparece. Sem clicar em nada.

     Por que apontar em vez de baixar: o navegador proíbe uma
     página de LER os bytes de uma imagem de outro domínio que
     não autorize isso explicitamente (nem o serviço do Google
     nem o do DuckDuckGo autorizam). Dá para EXIBIR, não dá para
     guardar. Então guardamos o endereço.

     Isso deixa um pedidinho para fora quando o Hub abre — só
     para os sistemas que ainda não têm arquivo na nossa pasta.
     Rodar `node ferramentas/baixar-logos.js` traz esses ícones
     para dentro, e a partir daí o arquivo local assume sozinho:
     o endereço externo continua guardado, mas nunca mais é
     usado. É o melhor dos dois: automático agora, nosso depois. */
  function apontarLogoDoSite(item) {
    /* Quem tem imagem enviada à mão, ou arquivo nosso, não
       precisa: essas duas vencem o remoto na hora de desenhar,
       e sujar o dado com um endereço inútil só confunde. */
    if (item.logoDados) return;
    if (INDICE_LOGOS[apelido(item.nome || "")]) { delete item.logoRemoto; return; }

    var dominio = "";
    try {
      var u = new URL(item.url);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("outro esquema");
      dominio = u.hostname.replace(/^www\./, "");
    } catch (e) {
      delete item.logoRemoto;
      return;
    }

    if (!dominio) { delete item.logoRemoto; return; }
    item.logoRemoto = "https://icons.duckduckgo.com/ip3/" + dominio + ".ico";
  }

  function previaDoLogo(item) {
    var caixa = elemento("button", "linha__logo");
    caixa.type = "button";
    caixa.title = "Trocar o logo";

    function pintar() {
      caixa.textContent = "";
      /* Mesma ordem do Hub, para a prévia aqui mostrar
         exatamente o que a equipe vai ver lá. */
      var arquivo = item.logo || INDICE_LOGOS[apelido(item.nome || "")];
      var endereco = item.logoDados
                  || (arquivo ? PASTA_LOGOS + arquivo : "")
                  || item.logoRemoto
                  || "";
      if (endereco) {
        var img = document.createElement("img");
        img.src = endereco;
        img.alt = "";
        img.addEventListener("error", function () { caixa.textContent = sigla(item); });
        caixa.appendChild(img);
      } else {
        caixa.textContent = sigla(item);
      }
    }
    pintar();
    caixa._pintar = pintar;

    caixa.addEventListener("click", function () { escolherLogo(item, pintar); });
    return caixa;
  }

  function escolherLogo(item, pintar) {
    /* Quem já enviou um logo tem duas vontades possíveis ao
       clicar de novo: trocar ou tirar. Pergunto qual. */
    if (item.logoDados) {
      var trocar = window.confirm(
        "Este sistema já tem um logo que você enviou.\n\n" +
        "OK — escolher outra imagem\n" +
        "Cancelar — remover e voltar ao logo automático"
      );
      if (!trocar) {
        delete item.logoDados;
        pintar();
        marcarPendente();
        return;
      }
    }

    var entrada = document.createElement("input");
    entrada.type = "file";
    entrada.accept = "image/*";
    entrada.addEventListener("change", function () {
      var arquivo = entrada.files && entrada.files[0];
      if (!arquivo) return;
      reduzirImagem(arquivo, 64).then(function (dataUri) {
        item.logoDados = dataUri;
        pintar();
        marcarPendente();
      }).catch(function () {
        recado("Não consegui ler essa imagem.", true);
      });
    });
    entrada.click();
  }

  /* Reduz para um quadrado de lado `lado`, mantendo a proporção
     e o fundo transparente. Sai em PNG, que é o formato que
     preserva transparência — logo de órgão público quase sempre
     vem com fundo vazado. */
  function reduzirImagem(arquivo, lado) {
    return new Promise(function (ok, erro) {
      var leitor = new FileReader();
      leitor.onerror = erro;
      leitor.onload = function () {
        var img = new Image();
        img.onerror = erro;
        img.onload = function () {
          var tela = document.createElement("canvas");
          tela.width = lado; tela.height = lado;
          var ctx = tela.getContext("2d");
          var escala = Math.min(lado / img.width, lado / img.height);
          var l = Math.round(img.width * escala), a = Math.round(img.height * escala);
          ctx.drawImage(img, Math.round((lado - l) / 2), Math.round((lado - a) / 2), l, a);
          ok(tela.toDataURL("image/png"));
        };
        img.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  /* ---------- Arrastar para reordenar ---------- */

  var arrastando = null;   /* {setorId, indice} */

  function ligarArrasto(linha, setor, indice) {
    linha.draggable = true;

    linha.addEventListener("dragstart", function (ev) {
      arrastando = { setorId: setor.id, indice: indice };
      linha.classList.add("linha--arrastando");
      ev.dataTransfer.effectAllowed = "move";
      /* Alguns navegadores não iniciam o arrasto sem carga. */
      try { ev.dataTransfer.setData("text/plain", setor.id + ":" + indice); } catch (e) {}
    });

    linha.addEventListener("dragend", function () {
      linha.classList.remove("linha--arrastando");
      limparAlvos();
      arrastando = null;
    });

    linha.addEventListener("dragover", function (ev) {
      if (!arrastando) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      var r = linha.getBoundingClientRect();
      var embaixo = (ev.clientY - r.top) > r.height / 2;
      limparAlvos();
      linha.classList.add(embaixo ? "linha--alvo-fim" : "linha--alvo");
    });

    linha.addEventListener("drop", function (ev) {
      if (!arrastando) return;
      ev.preventDefault();
      ev.stopPropagation();
      var r = linha.getBoundingClientRect();
      var embaixo = (ev.clientY - r.top) > r.height / 2;
      mover(arrastando, setor.id, indice + (embaixo ? 1 : 0));
    });
  }

  function limparAlvos() {
    Array.prototype.forEach.call(document.querySelectorAll(".linha--alvo,.linha--alvo-fim"), function (l) {
      l.classList.remove("linha--alvo", "linha--alvo-fim");
    });
  }

  function acharSetor(id) {
    for (var i = 0; i < dados.setores.length; i++) if (dados.setores[i].id === id) return dados.setores[i];
    return null;
  }

  function mover(origem, setorDestinoId, posicao) {
    var de = acharSetor(origem.setorId);
    var para = acharSetor(setorDestinoId);
    if (!de || !para) return;

    var item = de.itens[origem.indice];
    if (!item) return;

    de.itens.splice(origem.indice, 1);

    /* Tirar um item de cima empurra os de baixo: se o destino é
       o mesmo setor e ficava depois, a posição andou uma casa. */
    if (de === para && origem.indice < posicao) posicao--;

    para.itens.splice(Math.max(0, Math.min(posicao, para.itens.length)), 0, item);
    marcarPendente();
    desenhar();
  }

  /* ---------- Desenho: uma linha de sistema ---------- */

  function montarLinha(setor, item, indice) {
    var linha = elemento("div", "linha");

    var pegador = elemento("span", "pegador");
    pegador.innerHTML = ICONES.pegador;
    pegador.title = "Arraste para reordenar";
    linha.appendChild(pegador);

    var logo = previaDoLogo(item);
    linha.appendChild(logo);

    linha.appendChild(caixaTexto("cx-nome", item.nome, "Nome do sistema", function (v) {
      item.nome = v;
      if (logo._pintar) logo._pintar();
    }));

    linha.appendChild(caixaTexto("cx-url", item.url, "https://…", function (v) {
      item.url = v;
      apontarLogoDoSite(item);
      if (logo._pintar) logo._pintar();
    }));
    linha.appendChild(caixaTexto("cx-legenda", item.nota, "Legenda (opcional)", function (v) { item.nota = v; }));

    var fim = elemento("div", "linha__fim");

    var conferir = elemento("label", "marca-conferir");
    var caixa = document.createElement("input");
    caixa.type = "checkbox";
    caixa.checked = item.verificar === true;
    caixa.addEventListener("change", function () {
      if (caixa.checked) item.verificar = true; else delete item.verificar;
      marcarPendente();
    });
    conferir.appendChild(caixa);
    conferir.appendChild(document.createTextNode("a conferir"));
    conferir.title = "Marca o cartão com um ponto âmbar, para lembrar que o endereço ainda não foi conferido";
    fim.appendChild(conferir);

    var apagar = botaoIcone("lixo", "Apagar " + (item.nome || "este sistema"), true);
    apagar.addEventListener("click", function () {
      if (!window.confirm("Apagar “" + (item.nome || "sem nome") + "” do Hub?")) return;
      setor.itens.splice(indice, 1);
      marcarPendente();
      desenhar();
    });
    fim.appendChild(apagar);

    linha.appendChild(fim);

    ligarArrasto(linha, setor, indice);
    return linha;
  }

  /* ---------- Desenho: um setor ---------- */

  function montarSetor(setor, posicao) {
    var painel = elemento("section", "painel");

    var cabeca = elemento("div", "painel__cabeca");

    cabeca.appendChild(caixaTexto("cx-titulo", setor.titulo, "Nome do setor", function (v) { setor.titulo = v; }));
    cabeca.appendChild(caixaTexto("cx-nota", setor.nota, "Legenda do setor", function (v) { setor.nota = v; }));

    var estilo = document.createElement("select");
    estilo.className = "cx-estilo";
    [["cartao", "Cartões à vista"], ["gaveta", "Gaveta fechada"]].forEach(function (o) {
      var op = document.createElement("option");
      op.value = o[0]; op.textContent = o[1];
      estilo.appendChild(op);
    });
    estilo.value = setor.estilo === "gaveta" ? "gaveta" : "cartao";
    estilo.title = "Cartões ficam sempre à vista; gaveta nasce fechada e abre no clique";
    estilo.addEventListener("change", function () { setor.estilo = estilo.value; marcarPendente(); });
    cabeca.appendChild(estilo);

    var destaque = elemento("label", "marca-destaque");
    var cxDestaque = document.createElement("input");
    cxDestaque.type = "checkbox";
    cxDestaque.checked = setor.destaque === true;
    cxDestaque.addEventListener("change", function () {
      if (cxDestaque.checked) setor.destaque = true; else delete setor.destaque;
      marcarPendente();
    });
    destaque.appendChild(cxDestaque);
    destaque.appendChild(document.createTextNode("da casa"));
    destaque.title = "Marca este setor como “nosso”: o quadradinho de iniciais fica azul-noite";
    cabeca.appendChild(destaque);

    var direita = elemento("div", "painel__direita");

    var cima = botaoIcone("cima", "Subir o setor");
    cima.disabled = posicao === 0;
    cima.addEventListener("click", function () { moverSetor(posicao, -1); });
    direita.appendChild(cima);

    var baixo = botaoIcone("baixo", "Descer o setor");
    baixo.disabled = posicao === dados.setores.length - 1;
    baixo.addEventListener("click", function () { moverSetor(posicao, 1); });
    direita.appendChild(baixo);

    var apagarSetor = botaoIcone("lixo", "Apagar o setor", true);
    apagarSetor.addEventListener("click", function () {
      var quantos = (setor.itens || []).length;
      var pergunta = quantos
        ? "Apagar o setor “" + setor.titulo + "” e os " + quantos + " sistemas dentro dele?"
        : "Apagar o setor “" + setor.titulo + "”?";
      if (!window.confirm(pergunta)) return;
      dados.setores.splice(posicao, 1);
      marcarPendente();
      desenhar();
    });
    direita.appendChild(apagarSetor);

    cabeca.appendChild(direita);
    painel.appendChild(cabeca);

    var linhas = elemento("div", "linhas");
    if (!setor.itens || !setor.itens.length) {
      var vazio = elemento("div", "vazio", "Nenhum sistema aqui ainda. Arraste um para cá, ou acrescente abaixo.");
      /* Setor vazio também recebe item arrastado — senão não
         haveria como encher um setor recém-criado sem digitar. */
      vazio.addEventListener("dragover", function (ev) { if (arrastando) ev.preventDefault(); });
      vazio.addEventListener("drop", function (ev) {
        if (!arrastando) return;
        ev.preventDefault();
        mover(arrastando, setor.id, 0);
      });
      linhas.appendChild(vazio);
    } else {
      setor.itens.forEach(function (item, i) {
        linhas.appendChild(montarLinha(setor, item, i));
      });
    }
    painel.appendChild(linhas);

    var acoes = elemento("div", "painel__acoes");
    var novo = elemento("button", "btn btn--pequeno", "Acrescentar sistema");
    novo.type = "button";
    novo.addEventListener("click", function () {
      setor.itens = setor.itens || [];
      setor.itens.push({ nome: "", url: "", nota: "" });
      marcarPendente();
      desenhar();
      /* Leva o cursor direto para o campo do nome do novo. */
      var todos = painel.querySelectorAll(".cx-nome");
      if (todos.length) todos[todos.length - 1].focus();
    });
    acoes.appendChild(novo);
    painel.appendChild(acoes);

    return painel;
  }

  function moverSetor(posicao, direcao) {
    var destino = posicao + direcao;
    if (destino < 0 || destino >= dados.setores.length) return;
    var s = dados.setores.splice(posicao, 1)[0];
    dados.setores.splice(destino, 0, s);
    marcarPendente();
    desenhar();
  }

  /* ---------- Desenho: recados ---------- */

  function montarAviso(aviso, indice) {
    var linha = elemento("div", "aviso-linha");

    var tipo = document.createElement("select");
    tipo.className = "cx-estilo";
    [["prazo", "Prazo"], ["aviso", "Aviso"], ["ok", "Tudo certo"]].forEach(function (o) {
      var op = document.createElement("option");
      op.value = o[0]; op.textContent = o[1];
      tipo.appendChild(op);
    });
    tipo.value = aviso.tipo || "aviso";
    tipo.addEventListener("change", function () { aviso.tipo = tipo.value; marcarPendente(); });
    linha.appendChild(tipo);

    linha.appendChild(caixaTexto("cx-aviso-titulo", aviso.titulo, "Título", function (v) { aviso.titulo = v; }));
    linha.appendChild(caixaTexto("cx-aviso-texto", aviso.texto, "Texto do recado", function (v) { aviso.texto = v; }));

    var apagar = botaoIcone("lixo", "Apagar o recado", true);
    apagar.addEventListener("click", function () {
      dados.avisos.splice(indice, 1);
      marcarPendente();
      desenhar();
    });
    linha.appendChild(apagar);

    return linha;
  }

  /* ---------- Desenho geral ---------- */

  function desenhar() {
    var alvo = $("setores-edicao");
    alvo.textContent = "";
    dados.setores.forEach(function (setor, i) {
      alvo.appendChild(montarSetor(setor, i));
    });

    var caixaAvisos = $("avisos-edicao");
    caixaAvisos.textContent = "";
    (dados.avisos || []).forEach(function (aviso, i) {
      caixaAvisos.appendChild(montarAviso(aviso, i));
    });
    if (!dados.avisos || !dados.avisos.length) {
      caixaAvisos.appendChild(elemento("div", "vazio", "Sem recados. O bloco não aparece no Hub."));
    }
  }

  /* ---------- Identificador de setor ---------- */

  /* O id do setor é a chave dos favoritos de cada pessoa
     ("fiscal|e-CAC"). Por isso ele NUNCA muda depois de criado:
     renomear "Fiscal" para "Tributário" não pode apagar o
     atalho que alguém marcou. Só setor novo ganha id novo. */
  function idNovo() {
    var base = "setor";
    var n = 1;
    while (acharSetor(base + n)) n++;
    return base + n;
  }

  /* ---------- Ações do topo ---------- */

  /* Os botões do topo são ligados UMA vez. Sem esta trava, uma
     segunda chamada a abrirEdicao() (entrar de novo sem recarregar,
     por exemplo) ligaria tudo em dobro: um clique em "acrescentar
     setor" criaria dois setores. */
  var acoesLigadas = false;

  function ligarAcoes() {
    if (acoesLigadas) return;
    acoesLigadas = true;

    $("btn-novo-setor").addEventListener("click", function () {
      dados.setores.push({ id: idNovo(), titulo: "Setor novo", nota: "", estilo: "cartao", itens: [] });
      marcarPendente();
      desenhar();
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });

    $("btn-novo-aviso").addEventListener("click", function () {
      dados.avisos = dados.avisos || [];
      dados.avisos.push({ tipo: "aviso", titulo: "", texto: "" });
      marcarPendente();
      desenhar();
    });

    $("btn-padrao").addEventListener("click", function () {
      if (!window.confirm("Isto joga fora tudo o que está na tela e volta ao conteúdo original do arquivo js/sistemas.js.\n\nO que já foi salvo continua salvo até você clicar em Salvar de novo.\n\nContinuar?")) return;
      dados = Dados.semente();
      marcarPendente();
      desenhar();
    });

    $("btn-salvar").addEventListener("click", function () {
      var b = $("btn-salvar");
      b.disabled = true;
      b.textContent = "Salvando…";

      var sessao = Dados.sessao();
      Dados.salvar(dados, sessao && sessao.email).then(function (r) {
        limparPendente();
        recado(r.local ? "Salvo neste navegador (modo de teste)." : "Salvo. A equipe já vê a mudança.");
      }).catch(function (e) {
        b.disabled = false;
        b.textContent = "Salvar mudanças";
        recado(e.message || "Não consegui salvar.", true);
      });
    });

    $("btn-sair").addEventListener("click", function () {
      if (pendente && !window.confirm("Há mudanças não salvas. Sair mesmo assim?")) return;
      pendente = false;
      Dados.sair();
      window.location.reload();
    });
  }

  /* ---------- Entrada ---------- */

  function mostrarEntrada() {
    $("tela-entrada").hidden = false;
    $("tela-edicao").hidden = true;
    $("topo-acoes").hidden = true;

    if (!Dados.temBanco()) {
      $("entrada-nota").textContent =
        "O banco ainda não foi ligado (js/config-hub.js está em branco). " +
        "Entre com qualquer coisa para editar em modo de teste, só neste navegador.";
      $("entrada-senha").required = false;
      $("entrada-email").required = false;
    }

    if (mostrarEntrada.ligado) return;
    mostrarEntrada.ligado = true;

    $("form-entrada").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var erro = $("entrada-erro");
      erro.hidden = true;
      var b = $("btn-entrar");
      b.disabled = true;
      b.textContent = "Entrando…";

      Dados.entrar($("entrada-email").value.trim(), $("entrada-senha").value)
        .then(function () { abrirEdicao(); })
        .catch(function (e) {
          erro.textContent = e.message || "Não consegui entrar.";
          erro.hidden = false;
          b.disabled = false;
          b.textContent = "Entrar";
        });
    });
  }

  function abrirEdicao() {
    $("tela-entrada").hidden = true;
    $("tela-edicao").hidden = false;
    $("topo-acoes").hidden = false;
    $("faixa-local").hidden = Dados.temBanco();

    var sessao = Dados.sessao();
    $("quem").textContent = sessao && sessao.email ? sessao.email : "modo de teste";

    dados = Dados.carregar(function (maisNovo) {
      /* Chegou versão nova do servidor enquanto eu editava. Se
         não mexi em nada, adoto sem perguntar. Se mexi, não jogo
         fora o trabalho de ninguém: aviso e deixo a decisão. */
      if (!pendente) { dados = maisNovo; desenhar(); }
      else recado("Alguém salvou o Hub agora há pouco. Ao salvar, a sua versão prevalece.", true);
    });

    limparPendente();
    ligarAcoes();
    desenhar();
  }

  /* ---------- Início ---------- */

  /* Se o arquivo da logo sumir da pasta, mostra o nome escrito em
     vez do ícone de imagem quebrada. Mesma lógica do Hub. */
  (function ajustarLogoDaMarca() {
    var img = $("marca-logo");
    var monograma = $("marca-monograma");
    if (!img || !monograma) return;
    function trocar() { img.hidden = true; monograma.hidden = false; }
    img.addEventListener("error", trocar);
    if (img.complete && img.naturalWidth === 0) trocar();
  })();

  /* Quem já entrou nesta aba não precisa entrar de novo a cada
     recarga. O token vale uma hora; depois disso, senha de novo. */
  if (Dados.sessao()) abrirEdicao();
  else mostrarEntrada();

})();
