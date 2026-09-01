/* ============================================================
   Hub Totali · desenho da tela
   ------------------------------------------------------------
   Lê js/sistemas.js (a lista) e js/logos.js (o índice de logos)
   e monta a página. Quem for acrescentar um sistema NÃO precisa
   abrir este arquivo — só o sistemas.js.

   Três decisões que explicam o código abaixo:

   1. Nada é escrito com innerHTML a partir da lista. Todo texto
      entra por textContent e todo endereço passa por uma peneira
      que só aceita http e https. Assim, mesmo que um dia alguém
      cole um valor estranho no sistemas.js, ele não vira código
      rodando na máquina de quem abriu o navegador.

   2. Os favoritos moram no localStorage do próprio navegador.
      São de cada pessoa, não da empresa: o que o fiscal marca
      não mexe no que o pessoal vê. Sem servidor, sem login.

   3. Todo logo é arquivo nosso, em assets/logos/. Se faltar, o
      cartão cai para as iniciais num quadradinho — nunca fica
      buraco, e nunca há pedido para fora na hora de abrir.
   ============================================================ */

(function () {
  "use strict";

  var CHAVE_FAVORITOS = "hub-totali:favoritos";
  var PASTA_LOGOS = "assets/logos/";
  var INDICE_LOGOS = (typeof LOGOS !== "undefined") ? LOGOS : {};

  /* A lista vem da camada de dados (js/dados.js), não mais de
     dentro do código. Quem manda nela é a página de
     administrador. O js/sistemas.js virou só o conteúdo
     inicial, para o Hub nunca nascer vazio. */
  var SETORES = [];
  var AVISOS = [];

  /* ---------- Utilidades ---------- */

  /* Só http(s) passa. Endereço vazio devolve "". */
  function enderecoSeguro(url) {
    if (typeof url !== "string" || url.trim() === "") return "";
    try {
      var u = new URL(url, window.location.href);
      return (u.protocol === "http:" || u.protocol === "https:") ? u.href : "";
    } catch (e) {
      return "";
    }
  }

  /* Mesma regra da ferramenta que baixa os logos: é ela que faz
     "e-CAC" e "e-cac.ico" se encontrarem. Se mudar aqui, mude lá. */
  function apelido(nome) {
    return String(nome).toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  /* A sigla do quadradinho, para quem não tem logo.

       Portal do Cliente  → PC   (iniciais, ignorando o "do")
       e-CAC              → CAC  (sigla curta cabe inteira)
       eSocial            → ES   (maiúscula no meio da palavra)  */
  function sigla(item) {
    if (item.sigla) return String(item.sigla);
    var nome = String(item.nome);

    var ligacao = ["de", "do", "da", "dos", "das", "e"];
    var palavras = nome.split(/[\s·/·-]+/).filter(function (p) {
      return p && ligacao.indexOf(p.toLowerCase()) === -1;
    });
    if (palavras.length === 0) palavras = nome.split(/\s+/);

    if (palavras.length > 1) return palavras[0].charAt(0) + palavras[1].charAt(0);

    var unica = palavras[0];
    var interna = unica.slice(1).match(/[A-ZÁÉÍÓÚÃÕÂÊÔÇ]/);
    if (/[a-z]/.test(unica) && interna) return unica.charAt(0) + interna[0];
    if (unica.length <= 4 && unica === unica.toUpperCase()) return unica;
    return unica.substring(0, 2);
  }

  function elemento(tag, classe, texto) {
    var el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
  }

  /* ---------- A marca do sistema: logo, ou iniciais ---------- */

  function montarMarcaDoSistema(item, classeBase) {
    /* Quatro origens possíveis, e a ordem importa:

         1. logoDados  — imagem enviada à mão pela administração.
                         Escolha explícita de gente vence tudo.
         2. logo       — nome de arquivo apontado à mão.
         3. assets/logos/ pelo nome do sistema — o arquivo nosso.
         4. logoRemoto — o ícone no site do próprio sistema,
                         apontado sozinho quando o link é colado.

       O passo 4 é o último de propósito: assim que alguém rodar
       ferramentas/baixar-logos.js, o arquivo local passa a
       existir, o passo 3 assume e a busca externa deixa de
       acontecer — sem ninguém precisar mexer em nada.

       Não achou nenhuma das quatro? Iniciais. */
    var arquivo = item.logo || INDICE_LOGOS[apelido(item.nome)];
    var endereco = item.logoDados
                || (arquivo ? PASTA_LOGOS + arquivo : "")
                || item.logoRemoto
                || "";

    if (endereco) {
      var caixa = elemento("span", classeBase);
      var img = document.createElement("img");
      img.className = classeBase + "__img";
      img.src = endereco;
      img.alt = "";
      /* Sem loading="lazy" de propósito: são trinta e poucos
         ícones miúdos, servidos da nossa própria pasta e quase
         todos visíveis de cara. Adiar o carregamento deles só
         faria a tela montar aos pedaços. */
      img.decoding = "async";
      /* Se o arquivo sumir da pasta, o cartão não fica com a
         imagem quebrada: troca pelas iniciais na hora. */
      img.addEventListener("error", function () {
        var reserva = montarSigla(item, classeBase);
        if (caixa.parentNode) caixa.parentNode.replaceChild(reserva, caixa);
      });
      caixa.appendChild(img);
      return caixa;
    }

    return montarSigla(item, classeBase);
  }

  function montarSigla(item, classeBase) {
    var texto = sigla(item);
    var caixa = elemento("span", classeBase + " " + classeBase + "--sigla", texto);
    if (texto.length > 2) caixa.classList.add(classeBase + "--sigla-longa");
    return caixa;
  }

  /* ---------- Favoritos ---------- */

  function lerFavoritos() {
    try {
      var bruto = window.localStorage.getItem(CHAVE_FAVORITOS);
      var lista = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(lista) ? lista : [];
    } catch (e) {
      return [];   /* navegador com armazenamento bloqueado: segue sem favoritos */
    }
  }

  function gravarFavoritos(lista) {
    try {
      window.localStorage.setItem(CHAVE_FAVORITOS, JSON.stringify(lista));
    } catch (e) { /* modo privado ou sem espaço: o Hub continua funcionando */ }
  }

  var favoritos = lerFavoritos();

  function chave(setorId, item) { return setorId + "|" + item.nome; }
  function eFavorito(id) { return favoritos.indexOf(id) !== -1; }

  function alternarFavorito(id) {
    var i = favoritos.indexOf(id);
    if (i === -1) favoritos.push(id); else favoritos.splice(i, 1);
    gravarFavoritos(favoritos);
    desenharAtalhos();
    sincronizarEstrelas(id);
  }

  /* A mesma estrela existe em dois lugares (no setor e em "Meus
     atalhos"). Marcou em um, o outro tem de acompanhar. */
  function sincronizarEstrelas(id) {
    var marcado = eFavorito(id);
    var botoes = document.querySelectorAll('[data-chave="' + CSS.escape(id) + '"]');
    Array.prototype.forEach.call(botoes, function (b) {
      b.setAttribute("aria-pressed", marcado ? "true" : "false");
      b.setAttribute("aria-label", (marcado ? "Tirar " : "Pôr ") + b.dataset.nome + " nos meus atalhos");
    });
  }

  function montarEstrela(id, nome) {
    var estrela = elemento("button", "estrela");
    estrela.type = "button";
    estrela.dataset.chave = id;
    estrela.dataset.nome = nome;
    estrela.setAttribute("aria-pressed", eFavorito(id) ? "true" : "false");
    estrela.setAttribute("aria-label", (eFavorito(id) ? "Tirar " : "Pôr ") + nome + " nos meus atalhos");
    estrela.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"/></svg>';
    estrela.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      alternarFavorito(id);
    });
    return estrela;
  }

  /* ---------- Cartão (uso diário) ---------- */

  function montarCartao(setorId, item) {
    var url = enderecoSeguro(item.url);
    var id = chave(setorId, item);

    var cartao = elemento("div", "cartao");
    if (item.verificar) cartao.classList.add("cartao--verificar");
    if (!url) cartao.classList.add("cartao--sem-link");

    if (url) {
      var link = elemento("a", "cartao__link");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", item.nome);
      cartao.appendChild(link);
    }

    cartao.appendChild(montarMarcaDoSistema(item, "selo"));

    var texto = elemento("div", "cartao__texto");
    texto.appendChild(elemento("span", "cartao__nome", item.nome));
    if (item.nota) texto.appendChild(elemento("span", "cartao__nota", item.nota));
    cartao.appendChild(texto);

    cartao.appendChild(montarEstrela(id, item.nome));
    return cartao;
  }

  /* ---------- Chip (uso pontual) ---------- */

  function montarChip(setorId, item) {
    var url = enderecoSeguro(item.url);
    var id = chave(setorId, item);

    var chip = elemento("div", "chip");
    if (item.verificar) chip.classList.add("chip--verificar");
    if (!url) chip.classList.add("chip--sem-link");

    if (url) {
      var link = elemento("a", "chip__link");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", item.nome);
      chip.appendChild(link);
    }

    chip.appendChild(montarMarcaDoSistema(item, "selo-mini"));
    chip.appendChild(elemento("span", "chip__nome", item.nome));
    chip.appendChild(montarEstrela(id, item.nome));
    return chip;
  }

  /* ---------- Gavetas: quais ficaram abertas ---------- */

  /* Nasce fechada. Se a pessoa abriu, fica aberta para ela — no
     navegador dela, como os favoritos. Ninguém abre a gaveta de
     ninguém. */
  var CHAVE_GAVETAS = "hub-totali:gavetas-abertas";

  function gavetasAbertas() {
    try {
      var lista = JSON.parse(window.localStorage.getItem(CHAVE_GAVETAS) || "[]");
      return Array.isArray(lista) ? lista : [];
    } catch (e) { return []; }
  }

  function guardarGaveta(id, aberta) {
    try {
      var lista = gavetasAbertas();
      var i = lista.indexOf(id);
      if (aberta && i === -1) lista.push(id);
      if (!aberta && i !== -1) lista.splice(i, 1);
      window.localStorage.setItem(CHAVE_GAVETAS, JSON.stringify(lista));
    } catch (e) { /* armazenamento bloqueado: abre e fecha sem lembrar */ }
  }

  /* ---------- Setores ---------- */

  function montarSetorEmCartoes(setor) {
    var secao = elemento("section", "setor setor--cartao");
    if (setor.destaque) secao.classList.add("setor--destaque");

    var cabeca = elemento("div", "setor__cabeca");
    cabeca.appendChild(elemento("h2", "setor__titulo", setor.titulo));
    if (setor.nota) cabeca.appendChild(elemento("span", "setor__nota", setor.nota));
    secao.appendChild(cabeca);

    var grade = elemento("div", "grade");
    setor.itens.forEach(function (item) {
      grade.appendChild(montarCartao(setor.id, item));
    });
    secao.appendChild(grade);
    return secao;
  }

  /* A gaveta é um <details> de verdade, não um truque de altura
     com JavaScript. Sai de graça: abre e fecha sozinho, funciona
     pelo teclado, o Ctrl+F do navegador acha o que está lá dentro
     e imprime aberto. */
  function montarGaveta(setor) {
    var gaveta = elemento("details", "gaveta");
    gaveta.open = setor.aberto === true || gavetasAbertas().indexOf(setor.id) !== -1;

    var puxador = elemento("summary", "gaveta__puxador");
    puxador.appendChild(elemento("span", "gaveta__titulo", setor.titulo));
    if (setor.nota) puxador.appendChild(elemento("span", "gaveta__nota", setor.nota));
    puxador.appendChild(elemento("span", "gaveta__conta", String(setor.itens.length)));

    var seta = document.createElement("span");
    seta.className = "gaveta__seta";
    seta.setAttribute("aria-hidden", "true");
    seta.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" fill="none" ' +
                     'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    puxador.appendChild(seta);

    gaveta.appendChild(puxador);

    var chips = elemento("div", "chips");
    setor.itens.forEach(function (item) {
      chips.appendChild(montarChip(setor.id, item));
    });
    gaveta.appendChild(chips);

    gaveta.addEventListener("toggle", function () {
      guardarGaveta(setor.id, gaveta.open);
    });

    return gaveta;
  }

  function desenharSetores() {
    var alvo = document.getElementById("setores");
    alvo.textContent = "";
    var fragmento = document.createDocumentFragment();
    var gavetas = null;

    SETORES.forEach(function (setor) {
      if (!setor.itens || setor.itens.length === 0) return;

      if (setor.estilo === "gaveta") {
        /* Todas as gavetas moram num bloco só, com um título
           discreto. Assim a metade de baixo da tela é uma coisa
           calma, e não quatro seções brigando por atenção. */
        if (!gavetas) {
          gavetas = elemento("section", "setor setor--gavetas");
          var cabeca = elemento("div", "setor__cabeca");
          cabeca.appendChild(elemento("h2", "setor__titulo", "Órgãos e consultas"));
          cabeca.appendChild(elemento("span", "setor__nota", "Clique para abrir"));
          gavetas.appendChild(cabeca);
          gavetas.appendChild(elemento("div", "gavetas"));
          fragmento.appendChild(gavetas);
        }
        gavetas.querySelector(".gavetas").appendChild(montarGaveta(setor));
        return;
      }

      fragmento.appendChild(montarSetorEmCartoes(setor));
    });

    alvo.appendChild(fragmento);

    /* A entrada escalonada dá a sensação de a tela se montar, em
       vez de piscar pronta. Só vale para o que já está à vista —
       chip dentro de gaveta fechada não entra na conta, senão a
       gaveta abriria com os itens ainda "chegando". */
    var visiveis = alvo.querySelectorAll(".cartao, .gaveta");
    Array.prototype.forEach.call(visiveis, function (no, i) {
      no.style.setProperty("--atraso", Math.min(i, 24) * 22 + "ms");
    });
  }

  /* ---------- Meus atalhos ---------- */

  function desenharAtalhos() {
    var secao = document.getElementById("secao-atalhos");
    var grade = document.getElementById("grade-atalhos");
    grade.textContent = "";

    /* Percorro os setores na ordem original em vez da ordem em que
       a pessoa marcou: assim a fila de atalhos não muda de lugar
       toda vez que alguém marca mais um. Chip marcado vira cartão
       aqui em cima — é o que a pessoa disse usar todo dia. */
    var achados = 0;
    SETORES.forEach(function (setor) {
      (setor.itens || []).forEach(function (item) {
        if (eFavorito(chave(setor.id, item))) {
          grade.appendChild(montarCartao(setor.id, item));
          achados++;
        }
      });
    });

    secao.hidden = achados === 0;
  }

  /* ---------- Recados ---------- */

  function desenharAvisos() {
    var lista = document.getElementById("lista-avisos");
    lista.textContent = "";
    document.getElementById("bloco-avisos").hidden = true;
    if (!AVISOS || !AVISOS.length) return;

    AVISOS.forEach(function (aviso) {
      var li = elemento("li", "aviso aviso--" + (aviso.tipo || "aviso"));
      li.appendChild(elemento("span", "aviso__ponto"));
      var texto = elemento("div");
      texto.appendChild(elemento("span", "aviso__titulo", aviso.titulo));
      if (aviso.texto) texto.appendChild(elemento("span", "aviso__texto", aviso.texto));
      li.appendChild(texto);
      lista.appendChild(li);
    });

    document.getElementById("bloco-avisos").hidden = false;
  }

  /* ---------- Relógio ---------- */

  function desenharRelogio() {
    var hm = document.getElementById("relogio-hm");
    var data = document.getElementById("relogio-data");
    var diaDesenhado = null;

    function doisDigitos(n) { return n < 10 ? "0" + n : String(n); }

    function bater() {
      var agora = new Date();
      hm.textContent = doisDigitos(agora.getHours()) + ":" + doisDigitos(agora.getMinutes());

      /* A data só é reescrita quando o dia vira — não faz sentido
         refazer esse texto a cada batida. */
      var hoje = agora.toDateString();
      if (hoje !== diaDesenhado) {
        diaDesenhado = hoje;
        var escrito = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
        data.textContent = escrito.charAt(0).toUpperCase() + escrito.slice(1);
      }
    }

    bater();

    /* O mostrador é de minutos, então acerto o passo com o virar
       do minuto do computador e daí bato de minuto em minuto. Um
       despertar por minuto em vez de sessenta: numa página que
       fica aberta o dia inteiro, isso é bateria de notebook. */
    var agora = new Date();
    var ateVirarOMinuto = (60 - agora.getSeconds()) * 1000 - agora.getMilliseconds();
    window.setTimeout(function () {
      bater();
      window.setInterval(bater, 60000);
    }, ateVirarOMinuto);
  }

  /* ---------- Logo do cabeçalho ---------- */

  /* Enquanto não existir assets/logo-hub.png, entra o monograma.
     Fica assim de propósito: melhor um "T" neutro do que a logo
     de outro sistema fingindo ser a deste. */
  function ajustarLogoDaMarca() {
    var img = document.getElementById("marca-logo");
    var monograma = document.getElementById("marca-monograma");
    img.addEventListener("error", function () {
      img.hidden = true;
      monograma.hidden = false;
    });
    if (img.complete && img.naturalWidth === 0) {
      img.hidden = true;
      monograma.hidden = false;
    }
  }

  /* ---------- Início ---------- */

  function desenharTudo(dados) {
    SETORES = dados.setores || [];
    AVISOS  = dados.avisos  || [];
    desenharSetores();
    desenharAtalhos();
    desenharAvisos();
  }

  ajustarLogoDaMarca();
  desenharRelogio();

  /* Desenha já com o que estiver em mãos e redesenha sozinho se
     o servidor tiver algo mais novo. Quem abre o navegador não
     espera rede para ver a tela. */
  desenharTudo(Dados.carregar(function (maisNovo) {
    desenharTudo(maisNovo);
  }));

})();
