/* ============================================================
   Hub Totali · pendências entre setores
   ------------------------------------------------------------
   Fala com o Firestore pela API REST, como o resto do Hub —
   sem biblioteca, sem dependência nova.

   A FORMA DE UMA PENDÊNCIA, no 5W2H

     oque        O QUE precisa ser feito
     porque      POR QUE precisa ser feito
     comoFazer   COMO fazer
     sugestao    a sugestão de solução de quem pediu
     responsavel QUEM faz (uid da pessoa) — o dono da tarefa
     envolvidos  QUEM MAIS precisa saber (lista de uids). A
                 pendência aparece na página deles também, mas a
                 responsabilidade continua sendo de uma pessoa
                 só: tarefa de dois é tarefa de ninguém.
     prazo       QUANDO (data, aaaa-mm-dd)
     setorOrigem de onde veio
     setorDestino para onde vai
     situacao    aberta · fazendo · resolvida

   O "onde" do 5W2H virou setorOrigem e setorDestino, que é o que
   significa numa contabilidade: de que setor saiu e para qual
   foi. E o "quanto custa" ficou de fora de propósito — pendência
   entre colegas não tem preço, e um campo vazio em toda ficha só
   ensina a ignorar campo.

   A SUGESTÃO DE SOLUÇÃO É CAMPO PRÓPRIO, separada do "como".
   Não é preciosismo: é ela que transforma cobrança em ajuda, e é
   o detalhe que faz um painel destes não virar mural de
   reclamação entre setores.

   A LINHA DO TEMPO é uma subcoleção onde só se acrescenta.
   Ninguém edita o que o outro escreveu; quem errou tem quinze
   minutos para corrigir o próprio texto e, passado isso,
   acrescenta a correção embaixo — do jeito que se faz em livro
   contábil. Quem garante isso são as regras do banco, não este
   arquivo.
   ============================================================ */

const Pendencias = (function () {
  "use strict";

  var cfg = (typeof CONFIG_HUB !== "undefined") ? CONFIG_HUB : {};

  function temBanco() { return !!(cfg.apiKey && cfg.projectId); }

  function base() {
    return "https://firestore.googleapis.com/v1/projects/" + cfg.projectId +
           "/databases/(default)/documents";
  }

  function autorizacao() {
    var s = Dados.sessao();
    if (!s) throw new Error("Você precisa entrar para ver as pendências.");
    return { "Authorization": "Bearer " + s.idToken, "Content-Type": "application/json" };
  }

  /* ---------- tradução de e para o formato do Firestore ---------- */

  function paraFirestore(obj) {
    var f = {};
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      if (v === null || v === undefined) f[k] = { nullValue: null };
      else if (typeof v === "string")  f[k] = { stringValue: v };
      else if (typeof v === "boolean") f[k] = { booleanValue: v };
      else if (typeof v === "number")  f[k] = { integerValue: String(v) };
      else if (v instanceof Date)      f[k] = { timestampValue: v.toISOString() };
      else if (Array.isArray(v)) {
        f[k] = { arrayValue: { values: v.map(function (x) { return { stringValue: String(x) }; }) } };
      }
      else f[k] = { stringValue: JSON.stringify(v) };
    });
    return f;
  }

  function deFirestore(fields) {
    var o = {};
    Object.keys(fields || {}).forEach(function (k) {
      var v = fields[k];
      if ("stringValue" in v) o[k] = v.stringValue;
      else if ("booleanValue" in v) o[k] = v.booleanValue;
      else if ("integerValue" in v) o[k] = parseInt(v.integerValue, 10);
      else if ("timestampValue" in v) o[k] = v.timestampValue;
      else if ("nullValue" in v) o[k] = null;
      else if ("arrayValue" in v) {
        o[k] = ((v.arrayValue && v.arrayValue.values) || []).map(function (x) { return x.stringValue; });
      }
    });
    return o;
  }

  function conferir(r) {
    if (r.status === 401) throw new Error("Sessão expirada. Entre de novo.");
    if (r.status === 403) throw new Error("Sem permissão. Confirme que você está na lista da equipe.");
    if (!r.ok) throw new Error("O banco respondeu " + r.status + ".");
    return r.json();
  }

  /* ---------- listar ---------- */

  /* Traz todas e filtra aqui. É de propósito: a equipe inteira lê
     todas as pendências, porque pendência entre setores só
     funciona se der para ver o que o setor vizinho está devendo —
     quem vê só a sua parte não coopera, cobra. O filtro por
     pessoa é de exibição, não de permissão. */
  function listar() {
    if (!temBanco()) return Promise.resolve([]);
    return fetch(base() + "/pendencias?pageSize=300", {
      headers: autorizacao(), cache: "no-store"
    })
      .then(conferir)
      .then(function (j) {
        return (j.documents || []).map(function (d) {
          var p = deFirestore(d.fields);
          p.id = d.name.split("/").pop();
          return p;
        });
      });
  }

  /* ---------- criar ---------- */

  function criar(dados) {
    if (!temBanco()) return Promise.reject(new Error("O banco não está ligado."));
    var s = Dados.sessao();
    if (!s) return Promise.reject(new Error("Você precisa entrar."));

    if (!dados.oque || dados.oque.trim().length < 3) {
      return Promise.reject(new Error("Escreva o que precisa ser feito."));
    }
    if (!dados.responsavel) {
      return Promise.reject(new Error("Escolha quem vai fazer."));
    }

    var doc = {
      oque:         dados.oque.trim(),
      porque:       (dados.porque || "").trim(),
      comoFazer:    (dados.comoFazer || "").trim(),
      sugestao:     (dados.sugestao || "").trim(),
      responsavel:  dados.responsavel,
      envolvidos:   Array.isArray(dados.envolvidos) ? dados.envolvidos : [],
      prazo:        dados.prazo || "",
      setorOrigem:  dados.setorOrigem || "",
      setorDestino: dados.setorDestino || "",
      situacao:     "aberta",
      criadoPor:    s.uid,
      criadoEm:     new Date(),
    };

    return fetch(base() + "/pendencias", {
      method: "POST",
      headers: autorizacao(),
      body: JSON.stringify({ fields: paraFirestore(doc) }),
    })
      .then(conferir)
      .then(function (d) {
        var p = deFirestore(d.fields);
        p.id = d.name.split("/").pop();
        return p;
      });
  }

  /* ---------- mudar a situação ----------
     Uso PATCH com updateMask para tocar só o campo da situação.
     Sem a máscara, o Firestore substituiria o documento inteiro
     pelo que eu mandasse — e apagaria tudo o que eu não tivesse
     incluído no corpo. */
  function mudarSituacao(p, nova) {
    if (["aberta", "fazendo", "resolvida"].indexOf(nova) === -1) {
      return Promise.reject(new Error("Situação desconhecida."));
    }
    var url = base() + "/pendencias/" + encodeURIComponent(p.id) +
              "?updateMask.fieldPaths=situacao";
    return fetch(url, {
      method: "PATCH",
      headers: autorizacao(),
      body: JSON.stringify({ fields: { situacao: { stringValue: nova } } }),
    }).then(conferir);
  }

  /* ---------- corrigir o pedido ----------
     Quinze minutos para consertar o que você mesmo escreveu: erro
     de digitação, palavra trocada, prazo posto errado. Depois
     disso fecha, e ajuste vira comentário na linha do tempo —
     porque a essa altura o colega já leu, e reescrever o pedido
     por baixo faria a conversa deixar de bater com o combinado.

     Quem abriu e quando não entram na lista: eles sustentam a
     trilha. As regras do banco recusam mudar os dois, dentro ou
     fora da janela. */

  var CAMPOS_DO_PEDIDO = ["oque", "porque", "comoFazer", "sugestao",
                          "responsavel", "prazo", "setorDestino"];

  function podeCorrigirPedido(p) {
    var s = Dados.sessao();
    if (!s || !p || p.criadoPor !== s.uid) return false;
    var quando = Date.parse(p.criadoEm);
    return isFinite(quando) && (Date.now() - quando) < 15 * 60 * 1000;
  }

  function corrigirPedido(p, mudancas) {
    if (!podeCorrigirPedido(p)) {
      return Promise.reject(new Error("A janela de quinze minutos passou. Escreva na linha do tempo."));
    }
    var campos = {};
    var mascara = [];
    CAMPOS_DO_PEDIDO.forEach(function (c) {
      if (!(c in mudancas)) return;
      campos[c] = { stringValue: String(mudancas[c] || "") };
      mascara.push("updateMask.fieldPaths=" + c);
    });
    if (!mascara.length) return Promise.resolve();

    /* Sem a máscara, o Firestore SUBSTITUI o documento inteiro e a
       pendência perderia quem abriu, quando, e os envolvidos. */
    var url = base() + "/pendencias/" + encodeURIComponent(p.id) + "?" + mascara.join("&");
    return fetch(url, {
      method: "PATCH",
      headers: autorizacao(),
      body: JSON.stringify({ fields: campos }),
    }).then(conferir);
  }

  /* ---------- linha do tempo ---------- */

  function andamento(id) {
    return fetch(base() + "/pendencias/" + encodeURIComponent(id) + "/andamento?pageSize=200", {
      headers: autorizacao(), cache: "no-store"
    })
      .then(conferir)
      .then(function (j) {
        return (j.documents || []).map(function (d) {
          var x = deFirestore(d.fields);
          x.id = d.name.split("/").pop();
          return x;
        }).sort(function (a, b) {
          return String(a.criadoEm).localeCompare(String(b.criadoEm));
        });
      });
  }

  function acrescentar(id, texto, nomeDeQuem) {
    var s = Dados.sessao();
    if (!s) return Promise.reject(new Error("Você precisa entrar."));
    if (!texto || !texto.trim()) return Promise.reject(new Error("Escreva alguma coisa."));

    var doc = {
      autor:     s.uid,
      autorNome: nomeDeQuem || s.email || "",
      texto:     texto.trim(),
      criadoEm:  new Date(),
    };
    return fetch(base() + "/pendencias/" + encodeURIComponent(id) + "/andamento", {
      method: "POST",
      headers: autorizacao(),
      body: JSON.stringify({ fields: paraFirestore(doc) }),
    })
      .then(conferir)
      .then(function (d) {
        var x = deFirestore(d.fields);
        x.id = d.name.split("/").pop();
        return x;
      });
  }

  /* Corrigir o próprio texto, dentro dos quinze minutos. Quem
     decide se ainda dá tempo é a REGRA DO BANCO — aqui só evito
     mostrar um botão que vai falhar. */
  function podeEditar(item) {
    var s = Dados.sessao();
    if (!s || item.autor !== s.uid) return false;
    var quando = Date.parse(item.criadoEm);
    return isFinite(quando) && (Date.now() - quando) < 15 * 60 * 1000;
  }

  function corrigir(idPendencia, item, texto) {
    var url = base() + "/pendencias/" + encodeURIComponent(idPendencia) +
              "/andamento/" + encodeURIComponent(item.id) +
              "?updateMask.fieldPaths=texto&updateMask.fieldPaths=editadoEm";
    return fetch(url, {
      method: "PATCH",
      headers: autorizacao(),
      body: JSON.stringify({ fields: {
        texto:     { stringValue: texto.trim() },
        editadoEm: { timestampValue: new Date().toISOString() },
      } }),
    }).then(function (r) {
      if (r.status === 403) {
        throw new Error("Passaram os 15 minutos de correção. Acrescente um comentário embaixo.");
      }
      return conferir(r);
    });
  }

  /* ---------- apagar (só quem abriu) ---------- */
  function apagar(p) {
    return fetch(base() + "/pendencias/" + encodeURIComponent(p.id), {
      method: "DELETE", headers: autorizacao(),
    }).then(function (r) {
      if (r.status === 403) throw new Error("Só quem abriu a pendência pode apagá-la.");
      if (!r.ok && r.status !== 200) throw new Error("Não consegui apagar (HTTP " + r.status + ").");
      return true;
    });
  }

  /* A pendência é minha se eu faço, se eu pedi, ou se me
     marcaram nela. É esta função que decide o que entra no
     trilho de cada pessoa. */
  function ehMinha(p, uid) {
    if (!uid) return false;
    if (p.responsavel === uid) return true;
    if (p.criadoPor === uid) return true;
    return Array.isArray(p.envolvidos) && p.envolvidos.indexOf(uid) !== -1;
  }

  /* ---------- estado de prazo ----------
     Devolve "atrasada", "hoje" ou "" — é o que pinta a tarja e
     agrupa a lista. Resolvida nunca é atrasada: o que está feito
     não cobra mais ninguém. */
  function estado(p) {
    if (p.situacao === "resolvida") return "";
    if (!p.prazo) return "";
    var hoje = new Date();
    var h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    var partes = String(p.prazo).split("-");
    if (partes.length !== 3) return "";
    var d = new Date(+partes[0], +partes[1] - 1, +partes[2]);
    if (d < h) return "atrasada";
    if (d.getTime() === h.getTime()) return "hoje";
    return "";
  }

  return {
    temBanco: temBanco,
    listar: listar,
    criar: criar,
    mudarSituacao: mudarSituacao,
    andamento: andamento,
    acrescentar: acrescentar,
    podeEditar: podeEditar,
    podeCorrigirPedido: podeCorrigirPedido,
    corrigirPedido: corrigirPedido,
    corrigir: corrigir,
    apagar: apagar,
    estado: estado,
    ehMinha: ehMinha,
  };

})();
