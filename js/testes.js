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
        minha._fichaDoAnexo = ficha;
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
        /* Enviar e abrir usam caminhos diferentes do Storage, e só o
           de abrir passa pela política de CORS do balde. A bateria
           testava só o envio, e por isso deu tudo certo no dia em que
           a abertura estava quebrada no endereço novo. Não de novo. */
        if (!minha._fichaDoAnexo) return null;
        return Pendencias.abrirAnexo(minha._fichaDoAnexo)
          .then(function (endereco) {
            afirmar(g, "anexo abre de volta", endereco.indexOf("blob:") === 0, endereco.slice(0, 40));
            URL.revokeObjectURL(endereco);
          })
          .catch(function (e) {
            afirmar(g, "anexo abre de volta", false, e.message);
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

  /* ---------- o histórico e a paginação ----------

     Escrito depois de dois defeitos que passariam por qualquer
     leitura, os dois no caminho das concluídas:

       · a consulta das resolvidas voltou 400 por semanas, porque
         faltava o índice composto, e um .catch devolvia lista
         vazia — "nada concluído" e "não consegui buscar" ficavam
         iguais na tela;

       · maisResolvidas() chamava deDocumento(), que morava dentro
         de listar(). "Carregar mais" estourava ReferenceError em
         toda tentativa, e só o console sabia.

     Nenhum dos dois quebrava nada visível. Então o que se afirma
     aqui é o que o BANCO responde, e não o que o código parece
     fazer. */
  function conferirHistorico() {
    var g = "Histórico e paginação";
    return Pendencias.listar()
      .then(function (r) {
        var erro = Pendencias.erroDasResolvidas();
        /* Esta é a afirmação central: se faltar o índice composto
           de novo, ou se a regra mudar, ela fica vermelha COM o
           motivo em vez de o histórico ficar vazio em silêncio. */
        afirmar(g, "a consulta das concluídas responde sem erro", !erro,
          erro || "sem erro");

        var quantas = r.filter(function (p) { return p.situacao === "resolvida"; }).length;
        return Pendencias.maisResolvidas(quantas)
          .then(function (pag) {
            /* Não se afirma QUANTAS vieram: num escritório com
               menos de 60 concluídas o certo é zero. O que se
               afirma é que a função RODA — era exatamente isso
               que estava quebrado. */
            afirmar(g, "pedir a página seguinte não estoura",
              Array.isArray(pag), pag.length + " na página seguinte");
          })
          .catch(function (e) {
            afirmar(g, "pedir a página seguinte não estoura", false, e.message);
          });
      })
      .catch(function (e) { afirmar(g, "a listagem respondeu", false, e.message); });
  }

  /* ---------- corrigir, apagar e a hora do servidor ----------

     Três garantias que só o banco pode dar, e que a tela não tem
     como provar sozinha:

       · comentário apagado deixa a marca — autor e hora ficam, o
         texto some — e depois disso não muda mais;

       · registro do sistema não se corrige nem se apaga, mesmo
         levando o uid de quem causou o registro;

       · a hora de criação é a do servidor, e o banco recusa uma
         inventada. Antes ele aceitava 2100, e com isso a janela de
         trinta minutos ficava aberta até 2100. */
  function conferirComentarios() {
    var g = "Comentários: corrigir, apagar e hora";
    var s = Dados.sessao();
    var c = (typeof CONFIG_HUB !== "undefined") ? CONFIG_HUB : {};
    var BASE = "https://firestore.googleapis.com/v1/projects/" + c.projectId + "/databases/(default)/documents";
    var H = { "Content-Type": "application/json", "Authorization": "Bearer " + s.idToken };
    var p = null, com = null, sis = null;

    function recusou(promessa) {
      return promessa.then(function () { return false; }, function () { return true; });
    }

    return Pendencias.criar({ oque: MARCA + " comentarios", responsavel: s.uid, prazo: "2030-12-31" })
      .then(function (nova) {
        p = nova;
        criadas.push(p);
        afirmar(g, "a pendência nasce com a hora do servidor",
          Math.abs(Date.parse(p.criadoEm) - Date.now()) < 5 * 60 * 1000, p.criadoEm);
        return Pendencias.acrescentar(p, "comentário que vai ser apagado", "Conferência");
      })
      .then(function (x) {
        com = x;
        afirmar(g, "comentário novo pode ser corrigido e apagado",
          Pendencias.podeEditar(com) && Pendencias.podeApagarComentario(com));
        return Pendencias.apagarComentario(p, com);
      })
      .then(function () { return Pendencias.andamento(p); })
      .then(function (conversa) {
        var m = conversa.filter(function (x) { return x.id === com.id; })[0];
        afirmar(g, "apagado deixa a marca no lugar, sem o texto",
          !!m && m.apagado === true && m.texto === "" && m.autor === s.uid && !!m.criadoEm && !!m.apagadoEm,
          m ? "texto: “" + m.texto + "”" : "o item sumiu");
        return recusou(Pendencias.corrigir(p, m || com, "de volta"));
      })
      .then(function (r) {
        afirmar(g, "o banco recusa mexer no que foi apagado", r);
        return Pendencias.acrescentar(p, "comentário para desconsiderar", "Conferência");
      })
      .then(function (x) {
        /* Desconsiderar não tem janela: vai e volta quantas vezes
           quiser, e o texto nunca se perde. */
        afirmar(g, "quem escreveu pode desconsiderar", Pendencias.podeDesconsiderar(x));
        return Pendencias.desconsiderar(p, x, true).then(function () { return x; });
      })
      .then(function (x) {
        return Pendencias.andamento(p).then(function (conversa) {
          var m = conversa.filter(function (y) { return y.id === x.id; })[0];
          afirmar(g, "desconsiderada fica marcada, com o texto inteiro",
            !!m && m.desconsiderado === true && m.texto === "comentário para desconsiderar");
          return Pendencias.desconsiderar(p, m, false).then(function () { return m; });
        });
      })
      .then(function (m) {
        return Pendencias.andamento(p).then(function (conversa) {
          var v = conversa.filter(function (y) { return y.id === m.id; })[0];
          afirmar(g, "dá para voltar a considerar", !!v && v.desconsiderado === false);
        });
      })
      .then(function () {
        return Pendencias.acrescentar(p, "Conferência marcou algo", "Conferência", true);
      })
      .then(function (x) {
        sis = x;
        return recusou(Pendencias.corrigir(p, sis, "reescrito"));
      })
      .then(function (r) {
        afirmar(g, "o banco recusa corrigir registro do sistema", r);
        return recusou(Pendencias.apagarComentario(p, sis));
      })
      .then(function (r) {
        afirmar(g, "o banco recusa apagar registro do sistema", r);
        return fetch(BASE + "/pendencias/" + p.id + "/andamento", {
          method: "POST", headers: H,
          body: JSON.stringify({ fields: {
            autor: { stringValue: s.uid }, autorNome: { stringValue: "Conferência" },
            texto: { stringValue: "data inventada" },
            criadoEm: { timestampValue: "2100-01-01T00:00:00Z" },
          } }),
        });
      })
      .then(function (r) {
        afirmar(g, "o banco recusa comentário com hora de criação inventada", r.status === 403,
          "HTTP " + r.status + (r.status === 200 ? " — as regras publicadas ainda não conferem a hora" : ""));
      })
      .catch(function (e) { afirmar(g, "a sequência rodou até o fim", false, e.message); });
  }

  /* ---------- anexo: apagar deixando a marca ----------

     O que se afirma aqui é o que o BANCO e o BALDE respondem. Duas
     garantias que só eles podem dar:

       · substituir arquivo continua impossível — anexo vale como
         prova, e quem troca a prova troca o combinado;

       · apagar deixa a ficha com o nome, quem mandou e a hora, e o
         arquivo sai do balde de verdade. */
  function conferirAnexoApagado() {
    var g = "Anexo: apagar deixando a marca";
    if (!Pendencias.temAnexos()) {
      afirmar(g, "anexos ligados", false, "STORAGE_BUCKET em branco");
      return Promise.resolve();
    }
    var s = Dados.sessao();
    var c = (typeof CONFIG_HUB !== "undefined") ? CONFIG_HUB : {};
    var BALDE = "https://firebasestorage.googleapis.com/v0/b/" + encodeURIComponent(c.STORAGE_BUCKET) + "/o";
    var p = null, ficha = null, caminho = "";

    return Pendencias.criar({ oque: MARCA + " anexo apagado", responsavel: s.uid, prazo: "2030-12-31" })
      .then(function (nova) {
        p = nova;
        criadas.push(p);
        return Pendencias.enviarAnexo(p, new File(["conferência\n"], MARCA + "-anexo.txt", { type: "text/plain" }));
      })
      .then(function (f) {
        ficha = f;
        caminho = f.caminho;
        afirmar(g, "o caminho do arquivo diz quem mandou",
          caminho.indexOf("pendencias/" + p.id + "/" + s.uid + "/") === 0, caminho);
        afirmar(g, "quem mandou pode apagar agora", Pendencias.podeApagarAnexo(f));
        return fetch(BALDE + "?uploadType=media&name=" + encodeURIComponent(caminho), {
          method: "POST",
          headers: { "Authorization": "Bearer " + s.idToken, "Content-Type": "text/plain" },
          body: "TROCADO",
        });
      })
      .then(function (r) {
        afirmar(g, "trocar o arquivo continua recusado", r.status === 403, "HTTP " + r.status);
        /* Desconsiderar vem ANTES de apagar no teste, porque
           depois de apagado não há arquivo para riscar — e é isso
           que a última afirmação deste trecho confere. */
        afirmar(g, "quem mandou pode desconsiderar", Pendencias.podeDesconsiderarAnexo(ficha));
        return Pendencias.desconsiderarAnexo(p, ficha, true);
      })
      .then(function () { return Pendencias.lerAnexos(p); })
      .then(function (lista) {
        var m = lista[0];
        afirmar(g, "desconsiderado fica marcado, com o arquivo no lugar",
          !!m && m.desconsiderado === true && m.caminho === caminho && m.apagado !== true);
        return Pendencias.desconsiderarAnexo(p, m, false);
      })
      .then(function () { return Pendencias.lerAnexos(p); })
      .then(function (lista) {
        afirmar(g, "dá para voltar a considerar", lista[0] && lista[0].desconsiderado === false);
        return Pendencias.apagarAnexo(p, ficha);
      })
      .then(function () { return Pendencias.lerAnexos(p); })
      .then(function (lista) {
        var m = lista[0];
        afirmar(g, "a ficha fica, com nome, autor e hora",
          !!m && m.apagado === true && m.caminho === "" && m.por === s.uid && !!m.apagadoEm,
          m ? "nome: " + m.nome : "a ficha sumiu");
        afirmar(g, "a tela não oferece mais apagar", !Pendencias.podeApagarAnexo(m));
        /* O caminho guardado À PARTE, porque apagarAnexo esvazia o
           da ficha — conferir pelo campo zerado procuraria um
           endereço vazio e daria falso negativo. Já aconteceu. */
        return fetch(BALDE + "/" + encodeURIComponent(caminho), {
          headers: { "Authorization": "Bearer " + s.idToken },
        });
      })
      .then(function (r) {
        afirmar(g, "o arquivo saiu do balde", r.status === 404, "HTTP " + r.status);
        return Pendencias.lerAnexos(p);
      })
      .then(function (lista) {
        var m = lista[0];
        return Pendencias.desconsiderarAnexo(p, m, true)
          .then(function () { return false; }, function () { return true; })
          .then(function (recusou) {
            afirmar(g, "o banco recusa desconsiderar anexo já apagado", recusou);
          });
      })
      .catch(function (e) { afirmar(g, "a sequência rodou até o fim", false, e.message); });
  }

  /* ---------- menção ----------

     A menção é o que traz a pendência para a coluna de quem foi
     chamado. O que se afirma é o efeito: entrou na lista, a
     pendência passa a ser dela e volta a contar como não lida. */
  function conferirMencao() {
    var g = "Menção";
    var s = Dados.sessao();
    var p = null, outro = null;

    return Dados.listarEquipe()
      .then(function (eq) {
        var gente = eq.filter(function (x) { return x.ativo && x.uid !== s.uid; });
        outro = gente[0];
        return Pendencias.criar({ oque: MARCA + " mencao", responsavel: s.uid, prazo: "2030-12-31" });
      })
      .then(function (nova) {
        p = nova;
        criadas.push(p);
        if (!outro) { afirmar(g, "há alguém para chamar", false, "equipe só com uma pessoa"); return null; }
        afirmar(g, "antes da chamada, a pendência não é da pessoa",
          !Pendencias.ehMinha(p, outro.uid, []));
        return Pendencias.acrescentar(p, "@" + (outro.nome || "colega") + " confere?", "Conferência", false, [outro.uid]);
      })
      .then(function (x) {
        if (!x) return null;
        afirmar(g, "o aviso saiu junto com o comentário", !x.avisoNaoSaiu);
        afirmar(g, "o comentário guarda quem foi chamado",
          Array.isArray(x.mencionados) && x.mencionados.indexOf(outro.uid) !== -1);
        return Pendencias.listar();
      })
      .then(function (todas) {
        if (!todas) return;
        var nova = todas.filter(function (x) { return x.id === p.id; })[0];
        afirmar(g, "a chamada ficou gravada na pendência",
          !!nova && Array.isArray(nova.mencoes) && nova.mencoes.indexOf(outro.uid) !== -1);
        afirmar(g, "depois da chamada, a pendência é da pessoa",
          !!nova && Pendencias.ehMinha(nova, outro.uid, []));
      })
      .catch(function (e) { afirmar(g, "a sequência rodou até o fim", false, e.message); });
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
      .then(conferirHistorico)
      .then(conferirComentarios)
      .then(conferirAnexoApagado)
      .then(conferirMencao)
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
