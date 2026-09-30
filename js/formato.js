/* ============================================================
   Hub Totali · negrito, itálico, tachado e listas
   ------------------------------------------------------------
   O TEXTO CONTINUA SENDO TEXTO. O que se grava no banco é a
   mesma string de sempre, com marcas do jeito que a equipe já
   usa no WhatsApp:

     *negrito*     _itálico_     ~tachado~
     - item de lista
     1. item numerado

   Por que marcas, e não HTML ou um campo novo: o banco não muda,
   as regras não mudam, a busca continua achando, a integração que
   cria pendência de fora continua valendo, e uma aba velha — que
   ainda não conhece isto — mostra os sinais em vez de quebrar.

   NADA AQUI USA innerHTML. O texto vem de gente, e cada pedaço
   entra na tela como nó de texto dentro de um elemento criado à
   mão: não há o que escapar porque nada é interpretado.

   Sem expressão regular, como no resto da casa: letra por letra.
   ============================================================ */

const Formato = (function () {
  "use strict";

  var MARCAS = { "*": "strong", "_": "em", "~": "s" };

  function ehEspaco(c) { return c === " " || c === "\t" || c === "\n"; }
  function ehDigito(c) { return c >= "0" && c <= "9" && c.length === 1; }
  /* Letra é o que tem maiúscula diferente da minúscula — pega os
     acentos sem precisar de uma lista deles. */
  function ehLetraOuDigito(c) {
    if (!c) return false;
    return ehDigito(c) || c.toLowerCase() !== c.toUpperCase();
  }

  /* ---------- começo de linha de lista ----------
     Só no começo da linha, e com o espaço depois: "-10%" e "2025."
     não são lista. Número de até três dígitos, pelo mesmo motivo. */
  function prefixo(linha) {
    if (linha.indexOf("- ") === 0 || linha.indexOf("• ") === 0) {
      return { tam: 2, tipo: "m", marca: linha.slice(0, 2) };
    }
    var i = 0;
    while (i < 3 && ehDigito(linha.charAt(i))) i++;
    if (i > 0 && linha.charAt(i) === "." && linha.charAt(i + 1) === " ") {
      return { tam: i + 2, tipo: "n", n: parseInt(linha.slice(0, i), 10) };
    }
    return null;
  }

  /* ============================================================
     MOSTRAR
     ============================================================ */

  /* A MARCA SÓ VALE COLADA NA PALAVRA, como no WhatsApp: abre
     depois de espaço ou pontuação e fecha antes de espaço ou
     pontuação. É o que deixa "contas_pagas_2025.xlsx", "5 * 3" e
     "~10 dias" em paz — texto antigo não muda de cara sozinho.
     E não atravessa linha: quem chama isto já entrega uma só. */
  function fechamento(texto, abre, marca) {
    for (var j = abre + 2; j < texto.length; j++) {
      if (texto.charAt(j) !== marca) continue;
      if (ehEspaco(texto.charAt(j - 1))) continue;
      if (ehLetraOuDigito(texto.charAt(j + 1))) continue;
      return j;
    }
    return -1;
  }

  function emLinha(texto, destino, folha) {
    var solto = "";
    var i = 0;
    while (i < texto.length) {
      var c = texto.charAt(i);
      var prox = texto.charAt(i + 1);
      if (MARCAS[c] && !ehLetraOuDigito(texto.charAt(i - 1)) &&
          prox && !ehEspaco(prox) && prox !== c) {
        var fim = fechamento(texto, i, c);
        if (fim !== -1) {
          if (solto) { folha(solto, destino); solto = ""; }
          var e = document.createElement(MARCAS[c]);
          emLinha(texto.slice(i + 1, fim), e, folha);
          destino.appendChild(e);
          i = fim + 1;
          continue;
        }
      }
      solto += c;
      i++;
    }
    if (solto) folha(solto, destino);
  }

  function textoPuro(t, onde) { onde.appendChild(document.createTextNode(t)); }

  /* "folha" recebe cada pedaço de texto simples e o lugar onde
     pôr. Existe para o comentário, que ainda precisa pintar os
     nomes chamados dentro desses pedaços. */
  function desenhar(destino, texto, folha) {
    folha = folha || textoPuro;
    var linhas = String(texto || "").split("\r\n").join("\n").split("\n");
    var i = 0;
    while (i < linhas.length) {
      var pf = prefixo(linhas[i]);
      if (pf) {
        var tipo = pf.tipo;
        var lista = document.createElement(tipo === "n" ? "ol" : "ul");
        lista.className = "fmt-lista";
        while (i < linhas.length && (pf = prefixo(linhas[i])) && pf.tipo === tipo) {
          var li = document.createElement("li");
          /* O número é o que a pessoa escreveu, e não a contagem do
             navegador: quem começou em 3 quer ver 3. */
          if (tipo === "n") li.value = pf.n;
          emLinha(linhas[i].slice(pf.tam), li, folha);
          lista.appendChild(li);
          i++;
        }
        destino.appendChild(lista);
        continue;
      }
      var bloco = document.createElement("div");
      bloco.className = "fmt-p";
      var primeira = true, ultima = "";
      while (i < linhas.length && !prefixo(linhas[i])) {
        if (!primeira) bloco.appendChild(document.createTextNode("\n"));
        emLinha(linhas[i], bloco, folha);
        ultima = linhas[i];
        primeira = false;
        i++;
      }
      /* Uma quebra no fim não ocupa linha nenhuma na tela; sem esta
         a mais, a linha em branco antes de uma lista desapareceria. */
      if (ultima === "") bloco.appendChild(document.createTextNode("\n"));
      destino.appendChild(bloco);
    }
  }

  /* ============================================================
     ESCREVER
     ------------------------------------------------------------
     As três funções abaixo não tocam na tela: recebem o texto e a
     seleção e devolvem a troca a fazer —

       { de, ate, texto, ini, fim }

     "troque o trecho de..ate por texto, e deixe selecionado
     ini..fim". Separadas da caixa para poderem ser conferidas na
     página de testes sem clicar em nada.
     ============================================================ */

  function comecoDaLinha(valor, pos) {
    return pos <= 0 ? 0 : valor.lastIndexOf("\n", pos - 1) + 1;
  }

  function envolver(valor, ini, fim, marca) {
    /* As marcas estão logo em volta da seleção: tira. Vale também
       para o par vazio que o botão acabou de pôr — clicar de novo
       desfaz. */
    if (ini > 0 && valor.charAt(ini - 1) === marca && valor.charAt(fim) === marca) {
      return { de: ini - 1, ate: fim + 1, texto: valor.slice(ini, fim), ini: ini - 1, fim: fim - 1 };
    }
    if (ini === fim) {
      return { de: ini, ate: fim, texto: marca + marca, ini: ini + 1, fim: ini + 1 };
    }

    var naBorda = comecoDaLinha(valor, ini) === ini;
    var novo = valor.slice(ini, fim).split("\n").map(function (linha, k) {
      /* O começo de lista fica DE FORA das marcas: "*- item*" deixa
         de ser item de lista, e a pessoa só queria o item em
         negrito. */
      var pf = (k > 0 || naBorda) ? prefixo(linha) : null;
      var cabeca = pf ? linha.slice(0, pf.tam) : "";
      var resto = pf ? linha.slice(pf.tam) : linha;
      /* E os espaços das pontas também: marca encostada em espaço
         não vale, e selecionar com duplo clique costuma levar o
         espaço de depois da palavra. */
      var a = 0, b = resto.length;
      while (a < b && ehEspaco(resto.charAt(a))) a++;
      while (b > a && ehEspaco(resto.charAt(b - 1))) b--;
      var miolo = resto.slice(a, b);
      if (!miolo) return linha;
      var jaTem = miolo.length > 2 && miolo.charAt(0) === marca &&
                  miolo.charAt(miolo.length - 1) === marca;
      miolo = jaTem ? miolo.slice(1, -1) : marca + miolo + marca;
      return cabeca + resto.slice(0, a) + miolo + resto.slice(b);
    }).join("\n");

    return { de: ini, ate: fim, texto: novo, ini: ini, fim: ini + novo.length };
  }

  function listar(valor, ini, fim, tipo) {
    /* Seleção que termina no começo da linha seguinte não inclui
       essa linha: é só onde o mouse parou. */
    if (fim > ini && valor.charAt(fim - 1) === "\n") fim--;
    var de = comecoDaLinha(valor, ini);
    var ate = valor.indexOf("\n", fim);
    if (ate === -1) ate = valor.length;

    var linhas = valor.slice(de, ate).split("\n");
    var cheias = linhas.filter(function (l) { return l.trim() !== ""; });
    var jaEh = cheias.length > 0 && cheias.every(function (l) {
      var pf = prefixo(l);
      return !!pf && pf.tipo === tipo;
    });

    var n = 0;
    var texto = linhas.map(function (l) {
      var pf = prefixo(l);
      var miolo = pf ? l.slice(pf.tam) : l;
      if (jaEh) return miolo;                       /* segundo clique desfaz */
      if (l.trim() === "" && linhas.length > 1) return l;
      n++;
      return (tipo === "n" ? n + ". " : "- ") + miolo;
    }).join("\n");

    var fimNovo = de + texto.length;
    return { de: de, ate: ate, texto: texto,
             ini: linhas.length > 1 ? de : fimNovo, fim: fimNovo };
  }

  /* Enter dentro de uma lista continua a lista; Enter num item
     vazio sai dela. Devolve null quando não é caso de mexer — aí o
     Enter é o do navegador. */
  function aoEnter(valor, ini, fim) {
    if (ini !== fim) return null;
    var de = comecoDaLinha(valor, ini);
    var antes = valor.slice(de, ini);
    var pf = prefixo(antes);
    if (!pf) return null;
    var depois = valor.charAt(ini);
    if (antes.length === pf.tam && (depois === "" || depois === "\n")) {
      return { de: de, ate: ini, texto: "", ini: de, fim: de };
    }
    var novo = "\n" + (pf.tipo === "n" ? (pf.n + 1) + ". " : pf.marca);
    return { de: ini, ate: ini, texto: novo, ini: ini + novo.length, fim: ini + novo.length };
  }

  /* ---------- a troca, na caixa ----------
     Pelo comando de inserir do navegador quando ele existe, porque
     é o que mantém o Ctrl+Z funcionando: escrever direto no value
     joga fora o histórico de desfazer da caixa. Se o comando não
     fizer o esperado, o value é escrito na mão e o "input" é
     avisado — é por ele que o resto da ficha sabe que há texto. */
  function trocar(caixa, m) {
    var antes = caixa.value;
    var esperado = antes.slice(0, m.de) + m.texto + antes.slice(m.ate);
    caixa.focus();
    caixa.setSelectionRange(m.de, m.ate);
    try {
      if (m.texto) document.execCommand("insertText", false, m.texto);
      else if (m.ate > m.de) document.execCommand("delete", false, null);
    } catch (e) { /* cai no caminho de baixo */ }
    if (caixa.value !== esperado) {
      caixa.value = esperado;
      caixa.dispatchEvent(new Event("input", { bubbles: true }));
    }
    caixa.setSelectionRange(m.ini, m.fim);
  }

  var BOTOES = [
    { c: "n", t: "N",        dica: "Negrito (Ctrl+B)", marca: "*" },
    { c: "i", t: "I",        dica: "Itálico (Ctrl+I)", marca: "_" },
    { c: "t", t: "T",        dica: "Tachado",          marca: "~" },
    { c: "l", t: "• Lista",  dica: "Lista de marcadores", lista: "m" },
    { c: "l", t: "1. Lista", dica: "Lista numerada",      lista: "n" },
  ];

  function aplicar(caixa, b) {
    var v = caixa.value, ini = caixa.selectionStart, fim = caixa.selectionEnd;
    trocar(caixa, b.lista ? listar(v, ini, fim, b.lista) : envolver(v, ini, fim, b.marca));
  }

  /* Devolve a fileira de botões de uma caixa de texto, e liga nela
     os atalhos. Quem chama decide onde pôr a fileira. */
  function barra(caixa) {
    var d = document.createElement("div");
    d.className = "pd-fmt";
    BOTOES.forEach(function (b) {
      var bt = document.createElement("button");
      bt.type = "button";
      bt.className = "pd-fmt__b pd-fmt__b--" + b.c;
      bt.textContent = b.t;
      bt.title = b.dica;
      bt.setAttribute("aria-label", b.dica);
      /* O clique não pode tirar o cursor da caixa: sem isto a
         seleção se perde antes de o botão saber qual era. */
      bt.addEventListener("mousedown", function (ev) { ev.preventDefault(); });
      bt.addEventListener("click", function () { aplicar(caixa, b); });
      d.appendChild(bt);
    });

    caixa.addEventListener("keydown", function (ev) {
      if (ev.isComposing) return;
      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey) {
        var tecla = String(ev.key || "").toLowerCase();
        var b = tecla === "b" ? BOTOES[0] : tecla === "i" ? BOTOES[1] : null;
        if (!b) return;
        ev.preventDefault();
        aplicar(caixa, b);
        return;
      }
      if (ev.key !== "Enter" || ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      var m = aoEnter(caixa.value, caixa.selectionStart, caixa.selectionEnd);
      if (!m) return;
      ev.preventDefault();
      trocar(caixa, m);
    });
    return d;
  }

  return { desenhar: desenhar, barra: barra,
           envolver: envolver, listar: listar, aoEnter: aoEnter };

})();
