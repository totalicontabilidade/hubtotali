/* ============================================================
   Hub Totali · camada de dados
   ------------------------------------------------------------
   Um lugar só que sabe ler e gravar a lista de sistemas. O Hub
   (index.html) só lê; a página de administrador (admin.html)
   lê e grava. Nenhum dos dois precisa saber de Firebase.

   POR QUE NÃO A BIBLIOTECA DO FIREBASE

   O Hub é a página inicial do navegador de todo mundo: ela abre
   dezenas de vezes por dia, por pessoa. Carregar a biblioteca do
   Firestore custaria uns 300 kB e meio segundo em cada uma
   dessas aberturas — para ler um documento só.

   Então o Hub fala com o Firestore pela API REST: uma requisição
   HTTP comum, uns poucos kB, sem biblioteca nenhuma. E o login
   do administrador usa a API REST do Firebase Authentication,
   pelo mesmo motivo. O resultado é que a pasta inteira do Hub
   não tem uma única dependência externa.

   E A ESPERA?

   Não há. O Hub desenha na hora com a última cópia que guardou
   no navegador e sai buscando a versão nova por baixo. Se algo
   mudou, a tela se atualiza sozinha um instante depois. Quem
   abre nunca vê tela branca esperando rede — nem quando a
   internet está ruim, nem quando está fora do ar.
   ============================================================ */

const Dados = (function () {
  "use strict";

  var CHAVE_CACHE  = "hub-totali:dados";
  var CHAVE_LOCAL  = "hub-totali:dados-locais";   /* usado enquanto não há Firebase */
  var CHAVE_SESSAO = "hub-totali:sessao";

  var cfg = (typeof CONFIG_HUB !== "undefined") ? CONFIG_HUB : {};

  /* Sem apiKey e projectId preenchidos, tudo funciona local. */
  function temBanco() {
    return !!(cfg.apiKey && cfg.projectId);
  }

  var BASE_FIRESTORE = function () {
    return "https://firestore.googleapis.com/v1/projects/" + cfg.projectId +
           "/databases/(default)/documents/hub/config";
  };

  /* ---------- A forma dos dados ----------
     Um objeto só: { setores:[...], avisos:[...] }. É exatamente
     o formato de js/sistemas.js, de propósito — aquele arquivo
     continua servindo como o conteúdo inicial e como o "voltar
     ao padrão" da página de administrador. */

  function semente() {
    return {
      setores: (typeof SETORES !== "undefined") ? JSON.parse(JSON.stringify(SETORES)) : [],
      avisos:  (typeof AVISOS  !== "undefined") ? JSON.parse(JSON.stringify(AVISOS))  : [],
    };
  }

  function valido(d) {
    return d && typeof d === "object" && Array.isArray(d.setores);
  }

  /* ---------- Cópia guardada no navegador ---------- */

  function lerCache(chave) {
    try {
      var bruto = window.localStorage.getItem(chave);
      if (!bruto) return null;
      var d = JSON.parse(bruto);
      return valido(d) ? d : null;
    } catch (e) { return null; }
  }

  function gravarCache(chave, dados) {
    try { window.localStorage.setItem(chave, JSON.stringify(dados)); }
    catch (e) { /* modo privado ou sem espaço: segue sem cache */ }
  }

  /* ---------- Leitura ---------- */

  /* Devolve na hora o que tiver em mãos (cache, dados locais ou
     a semente) e, se houver banco, chama de novo o "aoAtualizar"
     quando a versão do servidor chegar. */
  function carregar(aoAtualizar) {
    if (!temBanco()) {
      return lerCache(CHAVE_LOCAL) || semente();
    }

    var imediato = lerCache(CHAVE_CACHE) || semente();

    buscarDoServidor().then(function (doServidor) {
      if (!doServidor) return;
      gravarCache(CHAVE_CACHE, doServidor);
      /* Só reavisa se realmente mudou — redesenhar a tela por
         nada faria os cartões piscarem na cara de quem abriu. */
      if (JSON.stringify(doServidor) !== JSON.stringify(imediato) && typeof aoAtualizar === "function") {
        aoAtualizar(doServidor);
      }
    }).catch(function () { /* sem rede: fica com o cache, e está tudo bem */ });

    return imediato;
  }

  function buscarDoServidor() {
    return fetch(BASE_FIRESTORE() + "?key=" + encodeURIComponent(cfg.apiKey), { cache: "no-store" })
      .then(function (r) {
        if (r.status === 404) return null;          /* ainda não foi salvo nada */
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (doc) {
        if (!doc || !doc.fields || !doc.fields.json) return null;
        /* Tudo vai num campo de texto só, com o JSON dentro. O
           Firestore tem um formato próprio, cheio de "tipo" em
           cada valor, que daria um trabalho de tradução dos dois
           lados sem ganho nenhum: aqui só precisamos guardar e
           devolver o mesmo objeto. */
        var d = JSON.parse(doc.fields.json.stringValue);
        return valido(d) ? d : null;
      });
  }

  /* ---------- Escrita (só a página de administrador) ---------- */

  function salvar(dados, quem) {
    if (!valido(dados)) return Promise.reject(new Error("Dados em formato inesperado."));

    if (!temBanco()) {
      gravarCache(CHAVE_LOCAL, dados);
      return Promise.resolve({ local: true });
    }

    var sessao = lerSessao();
    if (!sessao) return Promise.reject(new Error("Sessão expirada. Entre de novo."));

    var corpo = {
      fields: {
        json:          { stringValue: JSON.stringify(dados) },
        atualizadoEm:  { timestampValue: new Date().toISOString() },
        atualizadoPor: { stringValue: String(quem || sessao.email || "") },
      }
    };

    return fetch(BASE_FIRESTORE(), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + sessao.idToken,
      },
      body: JSON.stringify(corpo),
    }).then(function (r) {
      if (r.status === 401 || r.status === 403) {
        throw new Error("Sem permissão para salvar. Confira o UID nas regras do Firestore.");
      }
      if (!r.ok) throw new Error("Não consegui salvar (HTTP " + r.status + ").");
      gravarCache(CHAVE_CACHE, dados);
      return { local: false };
    });
  }

  /* ---------- Entrar e sair ---------- */

  function lerSessao() {
    try {
      var s = JSON.parse(window.sessionStorage.getItem(CHAVE_SESSAO) || "null");
      if (!s || !s.idToken) return null;
      /* O token do Firebase vale uma hora. Passou disso, peço a
         senha de novo — é uma vez por sessão de trabalho. */
      if (s.expiraEm && Date.now() > s.expiraEm) { sair(); return null; }
      return s;
    } catch (e) { return null; }
  }

  function entrar(email, senha) {
    if (!temBanco()) {
      /* Sem banco não há a quem perguntar; a edição é local. */
      return Promise.resolve({ email: email || "local", local: true });
    }

    return fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" +
                 encodeURIComponent(cfg.apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: senha, returnSecureToken: true }),
    })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (res) {
      if (!res.ok) {
        var codigo = (res.j.error && res.j.error.message) || "";
        throw new Error(recado(codigo));
      }
      var sessao = {
        idToken: res.j.idToken,
        email:   res.j.email,
        uid:     res.j.localId,
        expiraEm: Date.now() + (parseInt(res.j.expiresIn, 10) - 60) * 1000,
      };

      if (cfg.ADMIN_UID && sessao.uid !== cfg.ADMIN_UID) {
        throw new Error("Esta conta não é a de administrador do Hub.");
      }

      try { window.sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao)); } catch (e) {}
      return sessao;
    });
  }

  /* O Firebase responde em inglês e em código. Traduzo para o
     que a pessoa precisa fazer a respeito. */
  function recado(codigo) {
    if (/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(codigo)) {
      return "E-mail ou senha não conferem.";
    }
    if (/TOO_MANY_ATTEMPTS/.test(codigo)) {
      return "Muitas tentativas seguidas. Espere alguns minutos.";
    }
    if (/OPERATION_NOT_ALLOWED/.test(codigo)) {
      return "O login por e-mail e senha não está ligado no Firebase (Authentication → Sign-in method).";
    }
    if (/API key not valid|API_KEY/i.test(codigo)) {
      return "A apiKey em js/config-hub.js não confere com o projeto.";
    }
    return codigo || "Não consegui entrar.";
  }

  function sair() {
    try { window.sessionStorage.removeItem(CHAVE_SESSAO); } catch (e) {}
  }

  return {
    temBanco: temBanco,
    semente: semente,
    carregar: carregar,
    salvar: salvar,
    entrar: entrar,
    sair: sair,
    sessao: lerSessao,
  };

})();
