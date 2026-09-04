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
      agenda:  (typeof AGENDA  !== "undefined") ? JSON.parse(JSON.stringify(AGENDA))  : [],
    };
  }

  function valido(d) {
    return d && typeof d === "object" && Array.isArray(d.setores);
  }

  /* Documento salvo antes de um campo existir não tem esse campo.
     Em vez de a tela perder um pedaço, o que falta vem da
     semente. É o que permite acrescentar coisa nova ao Hub sem
     obrigar ninguém a salvar de novo pela administração. */
  function completar(d) {
    var padrao = semente();
    Object.keys(padrao).forEach(function (k) {
      if (!Array.isArray(d[k])) d[k] = padrao[k];
    });
    return d;
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
      return completar(lerCache(CHAVE_LOCAL) || semente());
    }

    var imediato = completar(lerCache(CHAVE_CACHE) || semente());

    buscarDoServidor().then(function (doServidor) {
      if (!doServidor) return;
      doServidor = completar(doServidor);
      gravarCache(CHAVE_CACHE, doServidor);
      /* Só reavisa se realmente mudou — redesenhar a tela por
         nada faria os cartões piscarem na cara de quem abriu. */
      if (JSON.stringify(doServidor) !== JSON.stringify(imediato) && typeof aoAtualizar === "function") {
        aoAtualizar(doServidor);
      }
    }).catch(function () { /* sem rede: fica com o cache, e está tudo bem */ });

    return imediato;
  }

  /* A lista de sistemas é privada: o banco só a entrega a quem
     está na equipe. Sem sessão não há o que pedir — a tela de
     entrada do Hub cuida disso antes de chegar aqui. */
  function buscarDoServidor() {
    var s = lerSessao();
    if (!s) return Promise.resolve(null);

    return fetch(BASE_FIRESTORE() + "?key=" + encodeURIComponent(cfg.apiKey), {
      cache: "no-store",
      headers: { "Authorization": "Bearer " + s.idToken },
    })
      .then(function (r) {
        if (r.status === 404) return null;          /* ainda não foi salvo nada */
        if (r.status === 401 || r.status === 403) return null;  /* sessão morreu */
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

  /* ---------- Manter a sessão viva ----------
     O token do Firebase vale uma hora. Sozinho, ele obrigaria a
     equipe a digitar a senha uma vez por turno — e o Hub é a
     página inicial de todo mundo. Junto do token vem um SEGUNDO
     token, o de renovação, que não vence: com ele se pede um
     token novo sem incomodar ninguém.

     O que isso custa em segurança, dito sem rodeio: quem sentar
     no computador de alguém da equipe, com o navegador aberto,
     entra no Hub como aquela pessoa — e, no caso do
     administrador, na administração. É o mesmo que já vale para o
     Gmail e para qualquer sistema que fica logado. O botão Sair
     apaga tudo, e trocar a senha no Firebase derruba os tokens de
     renovação de todos os aparelhos.

     Contra roubo do token pelo navegador, o que protege é não
     haver por onde: a política da página não deixa entrar script
     de fora, e nada vindo do banco é escrito como HTML. */

  var relogioDaRenovacao = null;
  var renovacaoEmCurso = null;

  function renovar() {
    var s = lerSessao();
    if (!s || !s.refreshToken || !temBanco()) return Promise.resolve(null);
    if (renovacaoEmCurso) return renovacaoEmCurso;

    renovacaoEmCurso = fetch("https://securetoken.googleapis.com/v1/token?key=" +
                             encodeURIComponent(cfg.apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(s.refreshToken),
    })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (res) {
      if (!res.ok) {
        /* Senha trocada, conta desligada ou token revogado. Aí é
           para pedir a senha mesmo. */
        sair();
        return null;
      }
      var nova = {
        idToken:      res.j.id_token,
        refreshToken: res.j.refresh_token || s.refreshToken,
        email:        s.email,
        uid:          res.j.user_id || s.uid,
        expiraEm:     Date.now() + (parseInt(res.j.expires_in, 10) - 60) * 1000,
      };
      guardarSessao(nova);
      agendarRenovacao();
      return nova;
    })
    .catch(function () { return null; })
    .then(function (r) { renovacaoEmCurso = null; return r; });

    return renovacaoEmCurso;
  }

  /* Renova cinco minutos antes de vencer. Cinco porque um pedido
     que sai no minuto do vencimento pode chegar depois dele. */
  function agendarRenovacao() {
    if (relogioDaRenovacao) window.clearTimeout(relogioDaRenovacao);
    var s = lerSessao();
    if (!s || !s.refreshToken) return;
    var falta = (s.expiraEm || 0) - Date.now() - 5 * 60 * 1000;
    relogioDaRenovacao = window.setTimeout(renovar, Math.max(falta, 1000));
  }

  /* O que as telas esperam antes do primeiro pedido ao banco:
     resolve com a sessão boa, ou com null se não há sessão. */
  function pronto() {
    var s = lerSessao();
    if (!s) return Promise.resolve(null);
    if (s.expiraEm && Date.now() > s.expiraEm - 60 * 1000) return renovar();
    agendarRenovacao();
    return Promise.resolve(s);
  }

  /* ---------- Entrar e sair ---------- */

  /* ONDE A SESSÃO FICA, E POR QUÊ SÃO DOIS LUGARES
     ------------------------------------------------------------
     A administração guarda na ABA: fechou a aba, acabou. É a
     conta que pode reescrever o Hub inteiro, e o atrito de digitar
     de novo é barato perto disso.

     O Hub guarda no NAVEGADOR. Ele é a página inicial da equipe:
     abre dezenas de vezes por dia, cada vez numa aba nova. Preso à
     aba, o login teria de ser redigitado em todas elas — e senha
     que se digita vinte vezes por dia vira senha curta, anotada no
     monitor, ou o recurso simplesmente para de ser usado.

     Em nenhum dos dois casos fica guardada credencial de longa
     vida: o que se guarda é o token de uma hora do Firebase, e não
     o token de renovação. Passada a hora, pede a senha de novo. */
  function lerSessao() {
    try {
      var bruto = window.localStorage.getItem(CHAVE_SESSAO)
               || window.sessionStorage.getItem(CHAVE_SESSAO);
      var s = JSON.parse(bruto || "null");
      if (!s || !s.idToken) return null;

      /* Vencido E sem como renovar: acabou mesmo. Vencido COM
         token de renovação não é problema — quem cuida é
         renovar(), e derrubar aqui faria a tela piscar de logada
         para deslogada enquanto a renovação está no ar. */
      if (s.expiraEm && Date.now() > s.expiraEm && !s.refreshToken) {
        sair();
        return null;
      }
      return s;
    } catch (e) { return null; }
  }

  function guardarSessao(s) {
    try { window.localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s)); } catch (e) {}
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
        idToken:      res.j.idToken,
        refreshToken: res.j.refreshToken,
        email:        res.j.email,
        uid:          res.j.localId,
        expiraEm:     Date.now() + (parseInt(res.j.expiresIn, 10) - 60) * 1000,
      };

      /* Aqui NÃO se pergunta quem é. Esta função atende as duas
         telas: a administração e o login das pendências, que é de
         toda a equipe. A recusa de quem não é administrador mora
         em js/admin.js, que é a tela que tem esse direito a
         defender. Quem manda de verdade são as regras do banco:
         nem o Hub nem a administração conseguem gravar nada que
         elas não deixem, venha o pedido de onde vier. */

      guardarSessao(sessao);
      agendarRenovacao();
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
    if (relogioDaRenovacao) { window.clearTimeout(relogioDaRenovacao); relogioDaRenovacao = null; }
    /* Sai dos dois lugares, sempre: quem clica em Sair quer ter
       saído, não ter saído de metade. */
    try { window.sessionStorage.removeItem(CHAVE_SESSAO); } catch (e) {}
    try { window.localStorage.removeItem(CHAVE_SESSAO); } catch (e) {}
  }

  /* ============================================================
     A EQUIPE
     ------------------------------------------------------------
     Cada pessoa é um documento em /equipe, com o uid do
     Authentication como identificador. O documento guarda nome,
     e-mail, setor e se está ativa. NUNCA a senha: a senha vive
     no Authentication, que é outro sistema, e nem o
     administrador consegue lê-la de lá.

     Aqui os documentos são gravados campo a campo, e não como um
     texto só (como é o hub/config). A diferença tem motivo: as
     REGRAS do banco precisam enxergar o campo "ativo" para
     decidir quem entra. Regra não lê dentro de um texto.
     ============================================================ */

  var BASE_DOCS = function () {
    return "https://firestore.googleapis.com/v1/projects/" + cfg.projectId + "/databases/(default)/documents";
  };

  /* Firestore guarda o tipo junto com o valor. Estas duas
     funções traduzem entre o formato dele e um objeto comum. */
  function paraFirestore(obj) {
    var f = {};
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      if (typeof v === "string") f[k] = { stringValue: v };
      else if (typeof v === "boolean") f[k] = { booleanValue: v };
      else if (typeof v === "number") f[k] = { integerValue: String(v) };
      else if (v instanceof Date) f[k] = { timestampValue: v.toISOString() };
      else if (v === null || v === undefined) f[k] = { nullValue: null };
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
    });
    return o;
  }

  function comAutorizacao(extra) {
    var s = lerSessao();
    if (!s) throw new Error("Sessão expirada. Entre de novo.");
    var h = { "Authorization": "Bearer " + s.idToken };
    Object.keys(extra || {}).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }

  function listarEquipe() {
    if (!temBanco()) return Promise.resolve([]);
    return fetch(BASE_DOCS() + "/equipe?pageSize=200", { headers: comAutorizacao(), cache: "no-store" })
      .then(function (r) {
        if (r.status === 403) throw new Error("Sem permissão para ler a equipe.");
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (j) {
        return (j.documents || []).map(function (d) {
          var p = deFirestore(d.fields);
          p.uid = d.name.split("/").pop();
          return p;
        }).sort(function (a, b) { return (a.nome || "").localeCompare(b.nome || "", "pt-BR"); });
      });
  }

  /* Cria a conta e põe a pessoa na lista, nessa ordem.

     Detalhe que evita um susto: criar conta no Firebase devolve
     um token da conta NOVA. Se ele fosse guardado, o
     administrador seria deslogado e passaria a ser a pessoa que
     acabou de cadastrar. Por isso o token que volta daqui é
     descartado — a sessão de quem está cadastrando não é
     tocada. */
  function criarPessoa(dados) {
    if (!temBanco()) return Promise.reject(new Error("O banco não está ligado."));
    /* O nome entra na lista porque é ele que aparece nas
       pendências. Sem nome, a pessoa vira um e-mail solto numa
       cobrança — e ninguém sabe de quem se está falando. */
    if (!dados.nome) return Promise.reject(new Error("O nome é obrigatório: é ele que aparece nas pendências."));
    if (!dados.email || !dados.senha) return Promise.reject(new Error("E-mail e senha são obrigatórios."));
    if (String(dados.senha).length < 6) return Promise.reject(new Error("A senha precisa de pelo menos 6 caracteres."));

    return fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" +
                 encodeURIComponent(cfg.apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: dados.email, password: dados.senha, returnSecureToken: false }),
    })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (res) {
      if (!res.ok) {
        var c = (res.j.error && res.j.error.message) || "";
        if (/EMAIL_EXISTS/.test(c)) throw new Error("Já existe uma conta com esse e-mail.");
        if (/WEAK_PASSWORD/.test(c)) throw new Error("Senha fraca demais — use pelo menos 6 caracteres.");
        if (/INVALID_EMAIL/.test(c)) throw new Error("Esse e-mail não parece válido.");
        throw new Error(recado(c));
      }
      return gravarPessoa(res.j.localId, {
        nome:  dados.nome || "",
        email: dados.email,
        setor: dados.setor || "",
        ativo: true,
      });
    });
  }

  function gravarPessoa(uid, campos) {
    return fetch(BASE_DOCS() + "/equipe/" + encodeURIComponent(uid), {
      method: "PATCH",
      headers: comAutorizacao({ "Content-Type": "application/json" }),
      body: JSON.stringify({ fields: paraFirestore(campos) }),
    }).then(function (r) {
      if (r.status === 403) throw new Error("Sem permissão para escrever na equipe.");
      if (!r.ok) throw new Error("Não consegui salvar a pessoa (HTTP " + r.status + ").");
      return r.json().then(function (d) {
        var p = deFirestore(d.fields);
        p.uid = uid;
        return p;
      });
    });
  }

  /* Não existe "apagar pessoa". Desligar marca ativo:false, e a
     pessoa perde o acesso na hora — mas o nome dela continua nas
     pendências que ela abriu e nos comentários que escreveu.
     Apagar de verdade deixaria buraco no histórico. */
  function desligarPessoa(uid, pessoa) {
    return gravarPessoa(uid, {
      nome: pessoa.nome || "", email: pessoa.email || "",
      setor: pessoa.setor || "", ativo: false,
    });
  }

  /* Trocar a senha de alguém não é possível daqui: a API pública
     só deixa a própria pessoa trocar a dela. O que dá para fazer
     é mandar o e-mail de redefinição, que é o caminho normal. */
  function mandarRedefinicaoDeSenha(email) {
    if (!temBanco()) return Promise.reject(new Error("O banco não está ligado."));
    return fetch("https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=" +
                 encodeURIComponent(cfg.apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestType: "PASSWORD_RESET", email: email }),
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (j) {
        throw new Error(recado((j.error && j.error.message) || ""));
      });
      return true;
    });
  }

  return {
    temBanco: temBanco,
    semente: semente,
    carregar: carregar,
    salvar: salvar,
    entrar: entrar,
    sair: sair,
    sessao: lerSessao,
    pronto: pronto,
    renovar: renovar,

    listarEquipe: listarEquipe,
    criarPessoa: criarPessoa,
    gravarPessoa: gravarPessoa,
    desligarPessoa: desligarPessoa,
    mandarRedefinicaoDeSenha: mandarRedefinicaoDeSenha,

    /* Os setores da casa. Mexer aqui muda o seletor do cadastro e
       o destino possível de uma pendência. */
    SETORES_DA_CASA: ["Fiscal", "Contábil", "Pessoal", "Legalização",
                      "Financeiro", "TI", "Gerência", "Diretoria"],
  };

})();
