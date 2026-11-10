/* ============================================================
   Hub Totali · o quadro de pendências no banco do Hub
   ------------------------------------------------------------
   Cumpre o contrato de js/pendencias/escolher.js falando com o
   Firestore pela API REST, como todo o resto do Hub — sem
   biblioteca, com a sessão de quem está logado (js/dados.js).

   ONDE AS COISAS MORAM

     quadros/{uid}/tarefas/{id}     uma pendência por documento,
                                    campo a campo (é o que permite
                                    gravar só o que mudou)
     quadros/{uid}/config/setores   { json: "{ lista: [...] }" }
     quadros/{uid}/config/clientes  idem
     Storage: quadros/{uid}/{id}    os PDFs anexados

   UM QUADRO POR PESSOA. É o desenho do Pendências Totali: cada um
   vê e mexe só no seu. As regras do banco (firestore.rules e
   storage.rules) garantem isso do lado de lá — a tela só evita
   mostrar botão que daria 403. A única porta além do dono é a de
   um colega ou de uma integração CRIAR uma pendência no quadro de
   alguém, assinando quem criou; é por ela que a solicitação do
   Atos Societários chega ao quadro da Legalização.

   ATUALIZAÇÃO SEM BIBLIOTECA é consulta de tempo em tempo: a cada
   minuto com a aba visível, e na hora em que ela volta a ficar
   visível. O que a própria pessoa muda aparece na hora, antes de o
   banco responder (atualização otimista); se o banco recusar, a
   lista é relida e a tela volta ao que vale.
   ============================================================ */
(function () {
  "use strict";

  var cfg = (typeof CONFIG_HUB !== "undefined") ? CONFIG_HUB : {};

  function criar(op) {
    var cache = new Map();
    var cfgs = {};
    var ouvTarefas = new Set();
    var ouvConfig = {};
    var ouvErro = [];
    var ultimaListagem = 0;

    function base() {
      return "https://firestore.googleapis.com/v1/projects/" + cfg.projectId + "/databases/(default)/documents";
    }
    function nomeDoc(rel) { return "projects/" + cfg.projectId + "/databases/(default)/documents/" + rel; }
    function sessao() {
      var s = Dados.sessao();
      if (!s) { var e = new Error("Sessão expirada. Entre de novo."); e.code = "sem_permissao"; throw e; }
      return s;
    }
    function meuUid() { return sessao().uid; }
    function colecao() { return base() + "/quadros/" + encodeURIComponent(meuUid()) + "/tarefas"; }
    function colecaoDe(uid) { return base() + "/quadros/" + encodeURIComponent(uid) + "/tarefas"; }
    function cabecalhos(extra) {
      var h = { "Authorization": "Bearer " + sessao().idToken };
      Object.keys(extra || {}).forEach(function (k) { h[k] = extra[k]; });
      return h;
    }

    /* ---------- erros, no vocabulário da tela ----------
       A tela conhece três códigos: sem_permissao, cheio e falha. */
    function erroHttp(r, texto) {
      var e = new Error("HTTP " + r.status + (texto ? " " + texto.slice(0, 200) : ""));
      e.status = r.status;
      e.code = (r.status === 401 || r.status === 403) ? "sem_permissao"
             : (r.status === 413 || r.status === 507 || r.status === 429) ? "cheio"
             : r.status === 404 ? "nao_existe" : "falha";
      return e;
    }
    function conferir(r) {
      if (r.ok) return r.status === 204 ? null : r.json();
      return r.text().catch(function () { return ""; }).then(function (t) { throw erroHttp(r, t); });
    }

    /* ---------- tradução de e para o formato do Firestore ----------
       Diferente da de js/dados.js, esta precisa de listas de mapas
       (os comentários e os anexos) e de números de verdade (as
       horas em milissegundos). */
    function paraValor(v) {
      if (v === null || v === undefined) return { nullValue: null };
      if (typeof v === "string") return { stringValue: v };
      if (typeof v === "boolean") return { booleanValue: v };
      if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
      if (Array.isArray(v)) return { arrayValue: { values: v.map(paraValor) } };
      if (typeof v === "object") return { mapValue: { fields: paraCampos(v) } };
      return { stringValue: String(v) };
    }
    function paraCampos(obj) {
      var f = {};
      Object.keys(obj).forEach(function (k) { if (obj[k] !== undefined) f[k] = paraValor(obj[k]); });
      return f;
    }
    function deValor(v) {
      if (!v) return null;
      if ("stringValue" in v) return v.stringValue;
      if ("booleanValue" in v) return v.booleanValue;
      if ("integerValue" in v) return parseInt(v.integerValue, 10);
      if ("doubleValue" in v) return v.doubleValue;
      if ("nullValue" in v) return null;
      if ("timestampValue" in v) return Date.parse(v.timestampValue);
      if ("arrayValue" in v) return ((v.arrayValue && v.arrayValue.values) || []).map(deValor);
      if ("mapValue" in v) return deCampos((v.mapValue && v.mapValue.fields) || {});
      return null;
    }
    function deCampos(fields) {
      var o = {};
      Object.keys(fields || {}).forEach(function (k) { o[k] = deValor(fields[k]); });
      return o;
    }
    function deDocumento(d) {
      var t = deCampos(d.fields);
      t.id = d.name.split("/").pop();
      return t;
    }

    /* ---------- id curto e imprevisível, gerado aqui ---------- */
    var LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    function novoId() {
      var bytes = new Uint8Array(20);
      window.crypto.getRandomValues(bytes);
      var id = "";
      for (var i = 0; i < bytes.length; i++) id += LETRAS.charAt(bytes[i] % LETRAS.length);
      return id;
    }

    function emitirTarefas() {
      var l = Array.from(cache.values()).map(function (t) { return Object.assign({}, t); });
      ouvTarefas.forEach(function (f) { f(l); });
    }
    function emitirConfig(nome) {
      (ouvConfig[nome] || new Set()).forEach(function (f) { f(cfgs[nome] === undefined ? null : cfgs[nome]); });
    }
    function avisarErro(e) { ouvErro.forEach(function (f) { try { f(e); } catch (x) {} }); }

    /* ---------- listar: todas as páginas ---------- */
    function buscarTarefas() {
      var tudo = [];
      function pagina(token) {
        var url = colecao() + "?pageSize=300" + (token ? "&pageToken=" + encodeURIComponent(token) : "");
        return fetch(url, { headers: cabecalhos(), cache: "no-store" })
          .then(function (r) {
            if (r.status === 404) return {};      /* quadro ainda vazio */
            return conferir(r);
          })
          .then(function (j) {
            (j && j.documents || []).forEach(function (d) { tudo.push(deDocumento(d)); });
            if (j && j.nextPageToken) return pagina(j.nextPageToken);
          });
      }
      return pagina(null).then(function () {
        cache = new Map(tudo.map(function (t) { return [t.id, t]; }));
        ultimaListagem = Date.now();
        emitirTarefas();
      });
    }

    function docConfig(nome) { return base() + "/quadros/" + encodeURIComponent(meuUid()) + "/config/" + encodeURIComponent(nome); }
    function buscarConfig(nome) {
      return fetch(docConfig(nome), { headers: cabecalhos(), cache: "no-store" })
        .then(function (r) {
          if (r.status === 404) return null;
          return conferir(r);
        })
        .then(function (d) {
          var v = null;
          if (d && d.fields && d.fields.json && d.fields.json.stringValue) {
            try { v = JSON.parse(d.fields.json.stringValue); } catch (e) { v = null; }
          }
          cfgs[nome] = v;
          emitirConfig(nome);
          return v;
        });
    }

    function consultarVarios(uids, where) {
      return Promise.all(uids.map(function (uid) {
        return fetch(base() + "/quadros/" + encodeURIComponent(uid) + ":runQuery", {
          method: "POST", headers: cabecalhos({ "Content-Type": "application/json" }),
          body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "tarefas" }], where: where, limit: 300 } }),
        })
          .then(function (r) { return r.ok ? r.json() : []; })
          .then(function (j) {
            return (j || []).filter(function (l) { return l.document; }).map(function (l) {
              var t = deDocumento(l.document);
              t.donoUid = uid;
              return t;
            });
          })
          .catch(function () { return []; });
      })).then(function (listas) { return [].concat.apply([], listas); });
    }

    var atualizando = null;
    function atualizarTudo() {
      if (document.hidden || atualizando) return atualizando || Promise.resolve();
      if (!Dados.sessao()) return Promise.resolve();
      atualizando = buscarTarefas()
        .then(function () { return Promise.all(Object.keys(ouvConfig).map(buscarConfig)); })
        .catch(function (e) { console.warn("Pendências: falha ao atualizar", e); })
        .then(function () { atualizando = null; });
      return atualizando;
    }

    var relogio = null;
    function ligarAtualizacao() {
      if (relogio) return;
      relogio = window.setInterval(atualizarTudo, op.intervalo || 60000);
      document.addEventListener("visibilitychange", function () {
        /* Volta à aba: se faz mais de meio minuto da última lista, relê. */
        if (!document.hidden && Date.now() - ultimaListagem > 30000) atualizarTudo();
      });
      window.addEventListener("online", atualizarTudo);
      window.addEventListener("focus", function () { if (Date.now() - ultimaListagem > 30000) atualizarTudo(); });
    }

    /* ---------- a conta: espera o login do Hub ----------
       A tela do quadro é montada junto com o Hub, antes de a pessoa
       passar pelo portão. iniciar() só segue quando há sessão: ou já
       havia, ou o Hub avisa (evento hub:sessao) assim que ela entra. */
    function esperarSessao() {
      return Dados.pronto().then(function (s) {
        if (s) return s;
        return new Promise(function (ok) {
          window.addEventListener("hub:sessao", function f() {
            window.removeEventListener("hub:sessao", f);
            ok(Dados.sessao());
          });
        });
      });
    }

    var api = {
      tipo: "hub",
      usuario: null,

      iniciar: function () {
        return esperarSessao().then(function (s) {
          api.usuario = { email: s.email, uid: s.uid, nome: "" };
          /* O nome cadastrado chega depois e só serve para a tela. */
          Dados.meuCadastro().then(function (p) { if (p && p.nome) api.usuario.nome = p.nome; }).catch(function () {});
          return buscarTarefas();
        }).then(function () { ligarAtualizacao(); });
      },

      ouvirTarefas: function (cb, erro) {
        ouvTarefas.add(cb);
        if (erro) ouvErro.push(erro);
        window.setTimeout(function () { cb(Array.from(cache.values())); }, 0);
        return function () { ouvTarefas.delete(cb); };
      },
      listarTarefas: function () { return buscarTarefas().then(function () { return Array.from(cache.values()); }); },

      criarTarefa: function (dados) {
        var id = novoId();
        var doc = Object.assign({}, dados);
        delete doc.id;
        /* Quem é dono do quadro assina: a regra do banco exige. */
        doc.criadoPorUid = meuUid();
        cache.set(id, Object.assign({}, doc, { id: id }));
        emitirTarefas();
        return fetch(colecao() + "?documentId=" + encodeURIComponent(id), {
          method: "POST", headers: cabecalhos({ "Content-Type": "application/json" }),
          body: JSON.stringify({ fields: paraCampos(doc) }),
        })
          .then(conferir)
          .then(function () { return id; })
          .catch(function (e) { cache.delete(id); emitirTarefas(); throw e; });
      },

      alterarTarefa: function (id, campos) {
        var antes = cache.get(id);
        if (antes) { cache.set(id, Object.assign({}, antes, campos)); emitirTarefas(); }
        var chaves = Object.keys(campos).filter(function (k) { return k !== "id"; });
        if (!chaves.length) return Promise.resolve();
        var mask = chaves.map(function (k) { return "updateMask.fieldPaths=" + encodeURIComponent(k); }).join("&");
        var limpos = {};
        chaves.forEach(function (k) { limpos[k] = campos[k]; });
        return fetch(colecao() + "/" + encodeURIComponent(id) + "?" + mask + "&currentDocument.exists=true", {
          method: "PATCH", headers: cabecalhos({ "Content-Type": "application/json" }),
          body: JSON.stringify({ fields: paraCampos(limpos) }),
        })
          .then(conferir)
          .then(function () {})
          .catch(function (e) { return buscarTarefas().catch(function () {}).then(function () { throw e; }); });
      },

      /* ---------- pendências entre pessoas ----------
         Criar no quadro de um colega (assinando), mexer no que eu
         mandei e listar o que mandei ou acompanho. As listas são uma
         consulta por quadro, filtrada pelo que a regra exige — o
         time é pequeno, e isso dispensa índice de grupo. */
      criarTarefaEm: function (uid, dados) {
        var id = novoId();
        var doc = Object.assign({}, dados);
        delete doc.id;
        doc.criadoPorUid = meuUid();
        return fetch(colecaoDe(uid) + "?documentId=" + encodeURIComponent(id), {
          method: "POST", headers: cabecalhos({ "Content-Type": "application/json" }),
          body: JSON.stringify({ fields: paraCampos(doc) }),
        }).then(conferir).then(function () { return id; });
      },
      alterarTarefaEm: function (uid, id, campos) {
        var chaves = Object.keys(campos).filter(function (k) { return k !== "id" && k !== "donoUid"; });
        if (!chaves.length) return Promise.resolve();
        var mask = chaves.map(function (k) { return "updateMask.fieldPaths=" + encodeURIComponent(k); }).join("&");
        var limpos = {};
        chaves.forEach(function (k) { limpos[k] = campos[k]; });
        return fetch(colecaoDe(uid) + "/" + encodeURIComponent(id) + "?" + mask + "&currentDocument.exists=true", {
          method: "PATCH", headers: cabecalhos({ "Content-Type": "application/json" }),
          body: JSON.stringify({ fields: paraCampos(limpos) }),
        }).then(conferir).then(function () {});
      },
      apagarTarefaEm: function (uid, id) {
        return fetch(colecaoDe(uid) + "/" + encodeURIComponent(id), { method: "DELETE", headers: cabecalhos() })
          .then(function (r) { if (r.status === 404) return null; return conferir(r); })
          .then(function () {});
      },
      listarEnviadas: function (uids) {
        var eu = meuUid();
        return consultarVarios(uids.filter(function (u) { return u !== eu; }),
          { fieldFilter: { field: { fieldPath: "criadoPorUid" }, op: "EQUAL", value: { stringValue: eu } } });
      },
      listarAcompanho: function (uids) {
        var eu = meuUid();
        return consultarVarios(uids.filter(function (u) { return u !== eu; }),
          { fieldFilter: { field: { fieldPath: "envolvidos" }, op: "ARRAY_CONTAINS", value: { stringValue: eu } } });
      },

      apagarTarefa: function (id) {
        cache.delete(id); emitirTarefas();
        return fetch(colecao() + "/" + encodeURIComponent(id), { method: "DELETE", headers: cabecalhos() })
          .then(function (r) { if (r.status === 404) return null; return conferir(r); })
          .then(function () {})
          .catch(function (e) { return buscarTarefas().catch(function () {}).then(function () { throw e; }); });
      },

      ouvirConfig: function (nome, cb, erro) {
        var novo = !ouvConfig[nome];
        (ouvConfig[nome] = ouvConfig[nome] || new Set()).add(cb);
        if (novo || cfgs[nome] === undefined) buscarConfig(nome).catch(function (e) { console.warn(e); if (erro) erro(e); });
        else window.setTimeout(function () { cb(cfgs[nome]); }, 0);
        return function () { ouvConfig[nome].delete(cb); };
      },
      lerConfig: function (nome) { return buscarConfig(nome); },
      salvarConfig: function (nome, valor) {
        cfgs[nome] = valor; emitirConfig(nome);
        return fetch(docConfig(nome), {
          method: "PATCH", headers: cabecalhos({ "Content-Type": "application/json" }),
          body: JSON.stringify({ fields: { json: { stringValue: JSON.stringify(valor) }, atualizadoEm: { timestampValue: new Date().toISOString() } } }),
        }).then(conferir).then(function () {});
      },

      /* ---------- os PDFs, no Storage ----------
         Caminho quadros/{uid}/{id}: a regra do Storage lê o uid do
         caminho e só deixa o dono ler, enviar e apagar. Nada de
         token de download — o arquivo abre com a sessão de quem
         clicou, e quem está fora da equipe não abre. */
      arquivos: cfg.STORAGE_BUCKET ? {
        enviar: function (f) {
          var id = novoId();
          var destino = "quadros/" + meuUid() + "/" + id;
          var url = "https://firebasestorage.googleapis.com/v0/b/" + encodeURIComponent(cfg.STORAGE_BUCKET) +
                    "/o?uploadType=media&name=" + encodeURIComponent(destino);
          return fetch(url, { method: "POST", headers: cabecalhos({ "Content-Type": f.type || "application/pdf" }), body: f })
            .then(function (r) {
              if (r.status === 403) { var e = new Error("sem permissão"); e.code = "not_granted"; throw e; }
              if (r.status === 413) { var e2 = new Error("grande"); e2.code = "too_large"; throw e2; }
              return conferir(r);
            })
            .then(function () { return { id: id, tam: f.size }; });
        },
        apagar: function (id) {
          var url = "https://firebasestorage.googleapis.com/v0/b/" + encodeURIComponent(cfg.STORAGE_BUCKET) +
                    "/o/" + encodeURIComponent("quadros/" + meuUid() + "/" + id);
          return fetch(url, { method: "DELETE", headers: cabecalhos() }).then(function (r) {
            if (r.status === 404 || r.ok) return null;
            throw erroHttp(r);
          });
        },
        ler: function (id) {
          var url = "https://firebasestorage.googleapis.com/v0/b/" + encodeURIComponent(cfg.STORAGE_BUCKET) +
                    "/o/" + encodeURIComponent("quadros/" + meuUid() + "/" + id) + "?alt=media";
          return fetch(url, { headers: cabecalhos() })
            .catch(function () {
              throw new Error("Não consegui falar com o Storage. Se acontece com todos os anexos, falta a política de CORS no balde (STORAGE-CORS.md).");
            })
            .then(function (r) { if (!r.ok) throw erroHttp(r); return r.blob(); });
        },
        /* Sem endereço direto: o arquivo só abre com a sessão. */
        url: function () { return null; },
      } : null,

      atualizar: atualizarTudo,
    };
    return api;
  }

  window.ArmazenamentoFirestore = { criar: criar };
})();
