/*
 * Armazenamento LOCAL — guarda tudo no próprio navegador.
 *   Pendências, setores e clientes → localStorage
 *   PDFs anexados                 → IndexedDB
 * Cada conta (e-mail) tem seus dados separados pelo prefixo das chaves.
 * Serve para testar e para usar sem servidor; não sincroniza entre aparelhos.
 */
(function () {
  'use strict';

  function criar(opcoes) {
    const email = (opcoes.usuario && opcoes.usuario.email) || 'local';
    const prefixo = 'pendencias:' + email + ':';
    const ouvTarefas = new Set();
    const ouvConfig = {};

    const ler = k => { try { return JSON.parse(localStorage.getItem(prefixo + k) || 'null'); } catch (e) { return null; } };
    const gravar = (k, v) => {
      try { localStorage.setItem(prefixo + k, JSON.stringify(v)); }
      catch (e) { const err = new Error('Armazenamento do navegador cheio'); err.code = 'cheio'; throw err; }
    };
    const tentar = fn => { try { return Promise.resolve(fn()); } catch (e) { return Promise.reject(e); } };
    const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

    const mapa = () => ler('tarefas') || {};
    const lista = () => Object.entries(mapa()).map(([id, t]) => Object.assign({}, t, { id }));
    const avisarTarefas = () => { const l = lista(); ouvTarefas.forEach(f => f(l)); };
    const avisarConfig = nome => { const v = ler('config:' + nome); (ouvConfig[nome] || new Set()).forEach(f => f(v)); };

    // outra aba do mesmo navegador mudou algo
    window.addEventListener('storage', e => {
      if (!e.key || !e.key.startsWith(prefixo)) return;
      const k = e.key.slice(prefixo.length);
      if (k === 'tarefas') avisarTarefas();
      else if (k.startsWith('config:')) avisarConfig(k.slice(7));
    });

    // PDFs no IndexedDB
    let bancoP = null;
    function banco() {
      if (!bancoP) bancoP = new Promise((ok, erro) => {
        const r = indexedDB.open('pendencias-arquivos', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('arquivos');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => erro(r.error);
      });
      return bancoP;
    }
    function tx(modo, fn) {
      return banco().then(db => new Promise((ok, erro) => {
        const t = db.transaction('arquivos', modo);
        const req = fn(t.objectStore('arquivos'));
        t.oncomplete = () => ok(req && req.result);
        t.onerror = () => erro(t.error);
      }));
    }

    return {
      tipo: 'local',
      usuario: opcoes.usuario || { email },

      iniciar: () => Promise.resolve(),

      ouvirTarefas(cb) { ouvTarefas.add(cb); setTimeout(() => cb(lista()), 0); return () => ouvTarefas.delete(cb); },
      listarTarefas: () => Promise.resolve(lista()),
      criarTarefa(dados) {
        return tentar(() => {
          const m = mapa(), id = novoId();
          m[id] = Object.assign({}, dados); delete m[id].id;
          gravar('tarefas', m); avisarTarefas(); return id;
        });
      },
      alterarTarefa(id, campos) {
        return tentar(() => {
          const m = mapa();
          if (!m[id]) { const e = new Error('Pendência não encontrada'); e.code = 'nao_existe'; throw e; }
          Object.assign(m[id], campos); delete m[id].id;
          gravar('tarefas', m); avisarTarefas();
        });
      },
      apagarTarefa(id) {
        return tentar(() => { const m = mapa(); delete m[id]; gravar('tarefas', m); avisarTarefas(); });
      },

      ouvirConfig(nome, cb) {
        (ouvConfig[nome] = ouvConfig[nome] || new Set()).add(cb);
        setTimeout(() => cb(ler('config:' + nome)), 0);
        return () => ouvConfig[nome].delete(cb);
      },
      lerConfig: nome => Promise.resolve(ler('config:' + nome)),
      salvarConfig(nome, valor) { return tentar(() => { gravar('config:' + nome, valor); avisarConfig(nome); }); },

      arquivos: {
        enviar(f) {
          const id = novoId();
          const blob = f.slice(0, f.size, f.type || 'application/pdf');
          return tx('readwrite', st => st.put(blob, prefixo + id)).then(() => ({ id, tam: f.size }));
        },
        apagar: id => tx('readwrite', st => st.delete(prefixo + id)),
        ler: id => tx('readonly', st => st.get(prefixo + id)).then(b => { if (!b) throw new Error('PDF não encontrado'); return b; }),
        url: () => null // sem endereço direto: o sistema abre pelo ler()
      }
    };
  }

  window.ArmazenamentoLocal = { criar };
})();
