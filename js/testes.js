/* ============================================================
   Hub Totali · conferência automática
   ------------------------------------------------------------
   POR QUE ESTA PÁGINA EXISTE

   Todo defeito sério deste sistema foi encontrado testando no
   banco de verdade, nunca lendo o código. A busca que separava
   pela letra "s", o anexo que dava para substituir, a consulta que
   sumia com pendência antiga — nenhum deles quebrava nada visível,
   e todos passariam por qualquer revisão de leitura.

   Então a conferência também roda no banco de verdade. Ela cria as
   próprias pendências, mexe nelas, confere o que o banco RESPONDE
   — inclusive as recusas que devem acontecer — e apaga tudo no
   fim.

   Nada de trabalho é tocado. O que ela escreve começa com
   ZZ-TESTE, e a limpeza é conferida e relatada: se sobrar alguma
   coisa, a página diz o quê.
   ============================================================ */

(function () {
  "use strict";

  var MARCA = "ZZ-TESTE";
  var resultados = [];
  var criadas = [];

  function $(id) { return document.getElementById(id); }
  function el(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  /* ---------- as afirmações ----------
     "detalhe" carrega o que se viu de fato. Numa falha, ele é o
     que diz o que aconteceu em vez do que se esperava — sem isso,
     um teste vermelho manda a pessoa investigar do zero. */
  function afirmar(grupo, oQue, condicao, detalhe) {
    resultados.push({ grupo: grupo, oQue: oQue, ok: !!condicao, detalhe: detalhe || "" });
    return !!condicao;
  }

  function espera(ms) { return new Promise(function (r) { window.setTimeout(r, ms); }); }

  function base() {
    var c = (typeof CONFIG_HUB !== "undefined") ? CONFIG_HUB : {};
    return "https://firestore.googleapis.com/v1/projects/" + c.projectId +
           "/databases/(default)/documents";
  }
  function comToken() {
    return { "Authorization": "Bearer " + Dados.sessao().idToken, "Content-Type": "application/json" };
  }

  /* ============================================================
     AS CONFERÊNCIAS
     ============================================================ */

  function conferirAgenda() {
    var g = "Agenda";
    if (typeof Agenda === "undefined") {
      afirmar(g, "o motor da agenda carregou", false, "Agenda não está definida");
      return Promise.resolve();
    }

    /* Datas que a Receita publicou para agosto de 2026. Se o motor
       deixar de reproduzi-las, alguma regra foi mexida sem querer. */
    var agosto = Agenda.doMes(new Date(2026, 7, 1));
    function diaDe(nome) {
      var x = agosto.filter(function (i) { return i.nome === nome; })[0];
      return x ? x.dia : "(não apareceu)";
    }
    afirmar(g, "EFD-Contribuições em 14/ago (10º dia útil)", diaDe("EFD-Contribuições") === "14", diaDe("EFD-Contribuições"));
    afirmar(g, "EFD-Reinf em 17/ago (dia 15 caiu no sábado)", diaDe("EFD-Reinf") === "17", diaDe("EFD-Reinf"));
    afirmar(g, "DCTFWeb em 31/ago (último dia útil)", diaDe("DCTFWeb") === "31", diaDe("DCTFWeb"));

    /* Setembro separa as duas regras que mais causam multa: mesmo
       dia 20 na lei, tributo federal antecipa e Simples adia. */
    var setembro = Agenda.doMes(new Date(2026, 8, 1));
    function diaSet(nome) {
      var x = setembro.filter(function (i) { return i.nome === nome; })[0];
      return x ? x.dia : "(não apareceu)";
    }
    afirmar(g, "FGTS antecipa para 18/set", diaSet("FGTS") === "18", diaSet("FGTS"));
    afirmar(g, "DAS do Simples adia para 21/set", diaSet("DAS do Simples") === "21", diaSet("DAS do Simples"));
    afirmar(g, "ICMS ST interna adia para 08/set (sábado + feriado)", diaSet("ICMS ST interna") === "08", diaSet("ICMS ST interna"));
    afirmar(g, "nenhum item marcado para conferência", setembro.every(function (i) { return !i.conferir; }));
    afirmar(g, "IRPJ não aparece em setembro (é trimestral)", diaSet("IRPJ e CSLL") === "(não apareceu)");

    return Promise.resolve();
  }

  function conferirPortas() {
    var g = "Portas fechadas";
    var c = (typeof CONFIG_HUB !== "undefined") ? CONFIG_HUB : {};
    var b = "https://firestore.googleapis.com/v1/projects/" + c.projectId + "/databases/(default)/documents";
    var chave = "?key=" + encodeURIComponent(c.apiKey);

    /* Sem token nenhum: é o que um estranho com a chave da página
       consegue. Tem de ser nada. */
    var alvos = [
      ["lista de sistemas", b + "/hub/config" + chave],
      ["ícones", b + "/hub/logos" + chave],
      ["equipe", b + "/equipe" + chave],
      ["pendências", b + "/pendencias" + chave],
      ["reservadas", b + "/pendencias_reservadas" + chave],
    ];
    return alvos.reduce(function (fila, a) {
      return fila.then(function () {
        return fetch(a[1], { cache: "no-store" }).then(function (r) {
          afirmar(g, "sem login, ler " + a[0] + " é recusado", r.status === 403, "HTTP " + r.status);
        });
      });
    }, Promise.resolve());
  }

  function conferirReservadas() {
    var g = "Sigilo";
    var eu = Dados.sessao().uid;
    var ninguem = "ZZ-uid-que-nao-existe";

    return fetch(base() + "/pendencias_reservadas", {
      method: "POST", headers: comToken(),
      body: JSON.stringify({ fields: {
        oque: { stringValue: MARCA + " reservada sem mim" },
        criadoPor: { stringValue: eu },
        criadoEm: { timestampValue: new Date().toISOString() },
        situacao: { stringValue: "aberta" },
        podemVer: { arrayValue: { values: [{ stringValue: ninguem }] } },
      } }),
    })
      .then(function (r) {
        afirmar(g, "criar reservada sem me incluir é recusado", r.status === 403, "HTTP " + r.status);
      })
      .then(function () {
        return fetch(base() + ":runQuery", {
          method: "POST", headers: comToken(),
          body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "pendencias_reservadas" }], limit: 5 } }),
        });
      })
      .then(function (r) {
        afirmar(g, "listar reservadas sem filtro é recusado", r.status === 403, "HTTP " + r.status);
      })
      .then(function () {
        return fetch(base() + ":runQuery", {
          method: "POST", headers: comToken(),
          body: JSON.stringify({ structuredQuery: {
            from: [{ collectionId: "pendencias_reservadas" }],
            where: { fieldFilter: { field: { fieldPath: "podemVer" },
                     op: "ARRAY_CONTAINS", value: { stringValue: ninguem } } }, limit: 5 } }),
        });
      })
      .then(function (r) {
        afirmar(g, "ver as reservadas de outra pessoa é recusado", r.status === 403, "HTTP " + r.status);
      });
  }

  function conferirCiclo() {
    var g = "Ciclo da pendência";
    var eu = Dados.sessao().uid;
    var minha = null;

    return Pendencias.criar({
      oque: MARCA + " ciclo completo",
      porque: "criada pela conferência automática",
      responsavel: eu, prazo: "2030-12-31", urgencia: "urgente", envolvidos: [],
    })
      .then(function () { return espera(900); })
      .then(function () { return Pendencias.listar(); })
      .then(function (todas) {
        minha = todas.filter(function (p) { return p.oque === MARCA + " ciclo completo"; })[0];
        if (minha) criadas.push(minha);
        afirmar(g, "criar e reencontrar na listagem", !!minha);
        afirmar(g, "a urgência foi gravada", minha && minha.urgencia === "urgente", minha && minha.urgencia);
        afirmar(g, "quem criou já consta como tendo visto", minha && Pendencias.jaVi(minha));
        if (!minha) throw new Error("sem pendência, o resto não roda");
      })
      .then(function () {
        return Pendencias.mudarSituacao(minha, "fazendo", "Conferência");
      })
      .then(function () { return espera(700); })
      .then(function () { return Pendencias.andamento(minha); })
      .then(function (conversa) {
        var auto = conversa.filter(function (x) { return x.doSistema; });
        afirmar(g, "mudar a situação anota na linha do tempo", auto.length === 1, auto.length + " anotação(ões)");
        afirmar(g, "a anotação diz de onde para onde",
          auto[0] && auto[0].texto.indexOf("Aberta") !== -1 && auto[0].texto.indexOf("Fazendo") !== -1,
          auto[0] && auto[0].texto);
      })
      .then(function () {
        return Pendencias.acrescentar(minha, "comentário da conferência", "Conferência");
      })
      .then(function () { return Pendencias.andamento(minha); })
      .then(function (conversa) {
        afirmar(g, "comentário à mão entra na conversa", conversa.length === 2, conversa.length + " item(ns)");
      })
      .then(function () {
        if (!Pendencias.temAnexos()) {
          afirmar(g, "anexos ligados", false, "STORAGE_BUCKET em branco");
          return null;
        }
        return Pendencias.enviarAnexo(minha, new File(["conferencia\n"], MARCA + "-anexo.txt", { type: "text/plain" }));
      })
      .then(function (ficha) {
        if (!ficha) return null;
        afirmar(g, "anexo enviado e fichado", !!ficha.caminho);
        afirmar(g, "a ficha não guarda endereço público", !ficha.url);
        minha._caminhoDoAnexo = ficha.caminho;
        /* Trocar o arquivo por outro tem de ser recusado: é a
           garantia de que anexo vale como prova. */
        var c = (typeof CONFIG_HUB !== "undefined") ? CONFIG_HUB : {};
        return fetch("https://firebasestorage.googleapis.com/v0/b/" + encodeURIComponent(c.STORAGE_BUCKET) +
                     "/o?uploadType=media&name=" + encodeURIComponent(ficha.caminho), {
          method: "POST",
          headers: { "Authorization": "Bearer " + Dados.sessao().idToken, "Content-Type": "text/plain" },
          body: "trocado",
        }).then(function (r) {
          afirmar(g, "substituir o arquivo é recusado", r.status === 403, "HTTP " + r.status);
        });
      })
      .then(function () {
        return Pendencias.apagar(minha).then(function () {
          criadas = criadas.filter(function (p) { return p.id !== minha.id; });
          afirmar(g, "apagar a pendência foi aceito", true);
        });
      })
      .then(function () { return espera(900); })
      .then(function () {
        if (!minha._caminhoDoAnexo) return null;
        var c = (typeof CONFIG_HUB !== "undefined") ? CONFIG_HUB : {};
        return fetch("https://firebasestorage.googleapis.com/v0/b/" + encodeURIComponent(c.STORAGE_BUCKET) +
                     "/o/" + encodeURIComponent(minha._caminhoDoAnexo),
                     { headers: { "Authorization": "Bearer " + Dados.sessao().idToken } })
          .then(function (r) {
            afirmar(g, "o arquivo do anexo sumiu junto", r.status === 404, "HTTP " + r.status);
          });
      })
      .then(function () {
        return fetch(base() + "/pendencias/" + encodeURIComponent(minha.id) + "/andamento",
                     { headers: comToken(), cache: "no-store" })
          .then(function (r) { return r.ok ? r.json() : { documents: [] }; })
          .then(function (j) {
            var sobrou = (j.documents || []).length;
            afirmar(g, "a linha do tempo sumiu junto", sobrou === 0, sobrou + " comentário(s) sobrando");
          });
      });
  }

  function conferirCopia() {
    var g = "Cópia de segurança";
    return Dados.copiaDeSeguranca()
      .then(function (tudo) {
        afirmar(g, "traz a lista de sistemas", !!(tudo.sistemas && tudo.sistemas.setores));
        afirmar(g, "traz a equipe", Array.isArray(tudo.equipe) && tudo.equipe.length > 0,
          (tudo.equipe || []).length + " pessoa(s)");
        afirmar(g, "traz os ícones", !!tudo.logos);
        afirmar(g, "cada pendência traz a conversa junto",
          (tudo.pendencias || []).every(function (p) { return Array.isArray(p._andamento); }));
        afirmar(g, "avisa que as reservadas são só as de quem baixou", !!tudo.reservadasObservacao);
        afirmar(g, "diz quando e quem", !!tudo.feitaEm && !!tudo.feitaPor);
      })
      .catch(function (e) { afirmar(g, "a cópia foi montada", false, e.message); });
  }

  /* ============================================================
     RODAR E MOSTRAR
     ============================================================ */

  function pintar() {
    var saida = $("saida");
    saida.textContent = "";

    var porGrupo = {};
    var ordem = [];
    resultados.forEach(function (r) {
      if (!porGrupo[r.grupo]) { porGrupo[r.grupo] = []; ordem.push(r.grupo); }
      porGrupo[r.grupo].push(r);
    });

    ordem.forEach(function (nome) {
      var bloco = el("div", "grupo");
      bloco.appendChild(el("div", "grupo__t", nome));
      porGrupo[nome].forEach(function (r) {
        var l = el("div", "linha-tst" + (r.ok ? "" : " linha-tst--falha"));
        /* "sinal", não "marca": a folha da administração já usa
       .marca para o bloco da logo, com display:flex, e ela
       empurrava o ✓ para a linha de cima. */
    l.appendChild(el("span", "sinal " + (r.ok ? "sinal--ok" : "sinal--falha"), r.ok ? "✓" : "✗"));
        l.appendChild(el("span", "linha-tst__t", r.oQue));
        if (r.detalhe) l.appendChild(el("span", "linha-tst__d", String(r.detalhe)));
        bloco.appendChild(l);
      });
      saida.appendChild(bloco);
    });

    var ok = resultados.filter(function (r) { return r.ok; }).length;
    var falhas = resultados.length - ok;
    var placar = $("placar");
    placar.textContent = "";
    placar.hidden = false;
    placar.appendChild(el("span", "placar__n placar__n--ok", ok + " passaram"));
    placar.appendChild(el("span", "placar__n " + (falhas ? "placar__n--falha" : "placar__n--nada"),
      falhas + (falhas === 1 ? " falhou" : " falharam")));
  }

  /* A limpeza é conferida, não presumida: o que sobrar é dito com
     nome, para a pessoa apagar. */
  function limpar() {
    var caixa = $("limpeza");
    caixa.hidden = false;
    caixa.textContent = "Conferindo se sobrou alguma coisa…";

    return Pendencias.listar()
      .then(function (todas) {
        var restos = todas.filter(function (p) { return String(p.oque || "").indexOf(MARCA) === 0; });
        return restos.reduce(function (fila, p) {
          return fila.then(function () { return Pendencias.apagar(p).catch(function () {}); });
        }, Promise.resolve()).then(function () { return Pendencias.listar(); });
      })
      .then(function (depois) {
        var sobrou = depois.filter(function (p) { return String(p.oque || "").indexOf(MARCA) === 0; });
        caixa.textContent = "";
        if (!sobrou.length) {
          caixa.appendChild(document.createTextNode("Limpeza conferida: nenhuma pendência de teste ficou no banco."));
        } else {
          caixa.appendChild(el("strong", null, "Sobrou para você apagar à mão: "));
          caixa.appendChild(document.createTextNode(
            sobrou.map(function (p) { return "“" + p.oque + "”"; }).join(", ")));
        }
      });
  }

  function rodar() {
    var b = $("btn-rodar");
    b.disabled = true;
    b.textContent = "Rodando…";
    resultados = [];
    criadas = [];
    $("saida").textContent = "";
    $("limpeza").hidden = true;

    conferirAgenda()
      .then(conferirPortas)
      .then(conferirReservadas)
      .then(conferirCiclo)
      .then(conferirCopia)
      .catch(function (e) {
        afirmar("Interrompido", "a bateria terminou sem erro fatal", false, e.message);
      })
      .then(pintar)
      .then(limpar)
      .then(function () {
        b.disabled = false;
        b.textContent = "Rodar de novo";
      });
  }

  /* ---------- partida ---------- */
  Dados.pronto().then(function (sessao) {
    if (!sessao) {
      $("quem").textContent = "entre pelo Hub antes de rodar";
      $("btn-rodar").disabled = true;
      return;
    }
    $("quem").textContent = "como " + sessao.email;
    $("btn-rodar").addEventListener("click", rodar);
  });

})();
