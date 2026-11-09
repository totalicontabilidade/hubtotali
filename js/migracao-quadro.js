/* ============================================================
   Hub Totali · do quadro antigo para os quadros por pessoa
   ------------------------------------------------------------
   Até 09/11/2026 o Hub tinha UM quadro do escritório (coleções
   pendencias e pendencias_reservadas, com a linha do tempo em
   /andamento). Depois, cada pessoa passou a ter o seu
   (quadros/{uid}/tarefas). Este arquivo decide o que uma pendência
   antiga vira no modelo novo — e de quem é.

   É só decisão: não fala com o banco. Quem lê e grava é
   js/dados.js (lerQuadroAntigo, criarTarefaEm), chamado pela
   administração. Assim o que importa aqui roda em Node, no teste.

   DE QUEM É A PENDÊNCIA, nesta ordem:
     1. do responsável (campo "responsavel"), que era quem fazia;
     2. sem responsável, da única pessoa ativa do setor de destino —
        se o setor tem duas pessoas, não dá para adivinhar;
     3. sem isso, de quem pediu (criadoPor): ela some do quadro de
        ninguém e quem pediu decide o que fazer.
   Recado (ehRecado) não vira pendência: era aviso, e aviso hoje é
   a faixa de recados do Hub.

   O QUE VIRA O QUÊ:
     oque                 → a primeira linha, em negrito
     porque/como/sugestao → linhas abaixo, nomeadas
     prazo                → "Com data"; sem prazo, "urgente" vai
                            para Hoje e o resto para Acompanhar
     urgencia "urgente"   → marcada como importante
     situacao resolvida   → riscada, com a hora do último comentário
     linha do tempo       → comentários, com o nome de quem escreveu
     anexos               → só uma nota: continuam na cópia de segurança
   ============================================================ */
(function (raiz) {
  "use strict";

  function slug(n) {
    return String(n || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function esc(x) {
    return String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* Hora em milissegundos a partir do que o banco devolveu: texto
     ISO (timestampValue), número, ou nada. */
  function ms(v) {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return v;
    var t = Date.parse(v);
    return isNaN(t) ? null : t;
  }

  function dataBr(t) {
    var d = new Date(t);
    function dois(n) { return n < 10 ? "0" + n : String(n); }
    return dois(d.getDate()) + "/" + dois(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  function pessoa(ctx, uid) {
    return (ctx.equipe || []).filter(function (x) { return x.uid === uid; })[0] || null;
  }

  function nomeDe(ctx, uid) {
    var p = pessoa(ctx, uid);
    return p ? (p.nome || p.email || uid) : (uid ? "alguém que saiu da equipe" : "alguém");
  }

  function setoresDe(p) {
    if (!p) return [];
    if (Array.isArray(p.setores)) return p.setores.map(String);
    var cru = p.setores || p.setor || "";
    if (typeof cru !== "string" || !cru.trim()) return [];
    return cru.split(/[;,]/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function donoDe(p, ctx) {
    if (p.responsavel) return { uid: p.responsavel, como: "responsável" };
    if (p.setorDestino) {
      var gente = (ctx.equipe || []).filter(function (x) {
        return x.ativo !== false && setoresDe(x).indexOf(p.setorDestino) !== -1;
      });
      if (gente.length === 1) return { uid: gente[0].uid, como: "única pessoa do setor " + p.setorDestino };
    }
    if (p.criadoPor) return { uid: p.criadoPor, como: "quem pediu, por não ter responsável" };
    return null;
  }

  function converter(p, ctx) {
    ctx = ctx || {};
    if (p.ehRecado) return { pulada: true, motivo: "recado" };
    var dono = donoDe(p, ctx);
    if (!dono) return { pulada: true, motivo: "sem dono" };

    var agora = ctx.agora || Date.now();
    var criadoEm = ms(p.criadoEm) || agora;
    var oque = String(p.oque || "").replace(/\s+/g, " ").trim() || "(sem texto)";
    var linhas = [oque];
    if (p.porque && String(p.porque).trim())       linhas.push("Por quê: " + String(p.porque).trim());
    if (p.comoFazer && String(p.comoFazer).trim()) linhas.push("Como: " + String(p.comoFazer).trim());
    if (p.sugestao && String(p.sugestao).trim())   linhas.push("Sugestão: " + String(p.sugestao).trim());
    var quemPediu = nomeDe(ctx, p.criadoPor);
    if (p.criadoPor && p.criadoPor !== dono.uid) {
      linhas.push("Pedido por " + quemPediu + (p.setorOrigem ? " (" + p.setorOrigem + ")" : ""));
    }
    var texto = linhas.join("\n");
    if (texto.length > 5900) texto = texto.slice(0, 5897) + "...";
    var html = "<b>" + esc(linhas[0]) + "</b>" +
               linhas.slice(1).map(function (l) { return "<br>" + esc(l); }).join("");
    if (html.length > 23000) html = html.slice(0, 23000);

    var prazoTxt = String(p.prazo || "").slice(0, 10);
    var prazo = /^\d{4}-\d{2}-\d{2}$/.test(prazoTxt) ? prazoTxt : null;
    var feito = p.situacao === "resolvida";
    var urgente = p.urgencia === "urgente";

    var andamento = (p._andamento || []).filter(function (a) {
      return a && a.texto && String(a.texto).trim() && !a.apagado;
    }).sort(function (a, b) { return (ms(a.criadoEm) || 0) - (ms(b.criadoEm) || 0); });

    var primeira = "Trazida do quadro antigo do Hub em " + dataBr(agora) +
                   ". Pedida por " + quemPediu + " em " + dataBr(criadoEm);
    if (dono.como !== "responsável") primeira += " · entrou neste quadro como " + dono.como;
    if (p._reservada) primeira += " · era reservada";
    primeira += ".";
    var notas = [{ t: primeira, em: agora }];
    andamento.forEach(function (a) {
      var quem = a.autorNome ? String(a.autorNome).trim() : (a.autor ? nomeDe(ctx, a.autor) : "");
      var t = (quem ? quem + ": " : "") + String(a.texto).trim();
      notas.push({ t: t.length > 2000 ? t.slice(0, 1997) + "..." : t, em: ms(a.criadoEm) || criadoEm });
    });
    var quantosAnexos = (p._anexos || []).length;
    if (quantosAnexos) {
      notas.push({ t: "Tinha " + quantosAnexos + (quantosAnexos === 1 ? " anexo" : " anexos") +
                      " no quadro antigo; o arquivo continua na cópia de segurança do Hub.", em: agora });
    }
    notas = notas.slice(0, 200);

    /* A hora da riscada é a do último movimento na linha do tempo,
       apagado ou não: o "resolvida" era anotado lá pelo sistema. */
    var feitoEm = null;
    if (feito) {
      var horas = (p._andamento || []).map(function (a) { return ms(a && a.criadoEm) || 0; }).filter(Boolean);
      feitoEm = horas.length ? Math.max.apply(null, horas) : criadoEm;
    }

    var setores = (ctx.setoresDoDono && ctx.setoresDoDono[dono.uid]) || [];
    var alvo = slug(p.setorDestino || "");
    var setor = (alvo && setores.some(function (s) { return s && s.id === alvo; })) ? alvo : "";

    var status = prazo ? "data" : (urgente ? "hoje" : "acompanhar");

    return {
      uid: dono.uid,
      como: dono.como,
      doc: {
        html: html,
        texto: texto,
        setor: setor,
        status: status,
        prazo: prazo,
        importante: urgente,
        feito: feito,
        feitoEm: feitoEm,
        criadoEm: criadoEm,
        statusEm: criadoEm,
        grifadoEm: null,
        revisadoEm: null,
        notas: notas,
        anexos: [],
        criadoPor: ctx.euEmail || null,
        criadoPorUid: ctx.euUid || "",
        origemSistema: "hub-antigo",
        origemId: String(p._id || p.id || ""),
      },
    };
  }

  /* O plano inteiro: o que vai para quem, o que fica de fora, e
     o que já foi trazido antes (ctx.existentes[uid] é a lista de
     origemId já presentes naquele quadro). */
  function planejar(antigo, ctx) {
    var reservadas = (antigo.reservadas || []).map(function (p) {
      var x = {};
      Object.keys(p).forEach(function (k) { x[k] = p[k]; });
      x._reservada = true;
      return x;
    });
    var lista = (antigo.pendencias || []).concat(reservadas);
    var plano = { itens: [], porDono: {}, recados: 0, semDono: 0, jaTrazidas: 0, abertas: 0, riscadas: 0 };
    lista.forEach(function (p) {
      var r = converter(p, ctx);
      if (r.pulada) {
        if (r.motivo === "recado") plano.recados++; else plano.semDono++;
        return;
      }
      var ja = (ctx.existentes && ctx.existentes[r.uid]) || [];
      if (ja.indexOf(r.doc.origemId) !== -1) { plano.jaTrazidas++; return; }
      plano.itens.push({ antiga: p, uid: r.uid, como: r.como, doc: r.doc });
      plano.porDono[r.uid] = (plano.porDono[r.uid] || 0) + 1;
      if (r.doc.feito) plano.riscadas++; else plano.abertas++;
    });
    return plano;
  }

  var LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  function novoId() {
    var id = "";
    for (var i = 0; i < 20; i++) id += LETRAS.charAt(Math.floor(Math.random() * LETRAS.length));
    return id;
  }

  raiz.MigracaoQuadro = { converter: converter, donoDe: donoDe, planejar: planejar, slug: slug, novoId: novoId };
})(typeof window !== "undefined" ? window : (typeof module !== "undefined" ? module.exports : this));
