/*
 * Exportar e importar — é por aqui que os dados mudam de lugar (migração).
 *
 * "Baixar cópia" gera um PACOTE (.json) com tudo da conta aberta:
 *   { formato:'pendencias-totali', versao:1, exportadoEm, conta:{email},
 *     tarefas:[...], config:{ setores:{lista}, clientes:{lista} },
 *     arquivos:[{ id, nome, tipo, base64 }] }        ← os PDFs vão junto
 *
 * "Importar cópia" lê um pacote e grava na conta aberta:
 *   - pendências iguais (mesmo texto e mesma data de criação) não entram de novo;
 *   - setores: os que faltam são criados e as palavras-chave são somadas;
 *   - clientes: os que faltam (pelo CNPJ) são criados e os apelidos são somados;
 *   - PDFs: só os das pendências novas são reenviados, e os anexos passam a apontar para o arquivo novo.
 * O formato está descrito em INTEGRACAO_HUB.md.
 */
(function () {
  'use strict';
  const store = window.Armazenamento;
  const $ = id => document.getElementById(id);
  let toastT;
  function aviso(msg) { const t = $('toast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4000); }
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const soDoc = s => String(s || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();

  // mostra a conta aberta na barra lateral
  window.addEventListener('pendencias:pronto', e => {
    const u = e.detail && e.detail.usuario;
    const el = $('contaAtual');
    if (el) el.textContent = u && u.email ? 'Conta: ' + u.email : (store && store.modo === 'local' ? 'Dados neste navegador' : '');
  });

  function blobParaBase64(b) {
    return new Promise((ok, erro) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(',')[1] || '');
      r.onerror = () => erro(r.error);
      r.readAsDataURL(b);
    });
  }
  function base64ParaArquivo(b64, nome, tipo) {
    const bin = atob(b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new File([u8], nome || 'arquivo.pdf', { type: tipo || 'application/pdf' });
  }
  const hojeISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  async function montarPacote(progresso) {
    const tarefas = await store.listarTarefas();
    const setores = await store.lerConfig('setores');
    const clientes = await store.lerConfig('clientes');
    const arquivos = [];
    if (store.arquivos) {
      const anexos = [];
      /* Anexo do quadro antigo (com caminho) não vai na cópia: o arquivo é da pendência antiga e continua no Storage. */
      tarefas.forEach(t => (t.anexos || []).forEach(a => { if (a && a.id && !a.caminho && !anexos.some(x => x.id === a.id)) anexos.push(a); }));
      for (let i = 0; i < anexos.length; i++) {
        progresso('Juntando PDFs ' + (i + 1) + ' de ' + anexos.length + '…');
        try {
          const b = await store.arquivos.ler(anexos[i].id);
          arquivos.push({ id: anexos[i].id, nome: anexos[i].nome, tipo: b.type || 'application/pdf', base64: await blobParaBase64(b) });
        } catch (e) { console.warn('PDF não encontrado', anexos[i]); }
      }
    }
    return {
      formato: 'pendencias-totali', versao: 1, exportadoEm: new Date().toISOString(),
      conta: { email: (store.usuario && store.usuario.email) || null },
      tarefas, config: { setores: setores || null, clientes: clientes || null }, arquivos
    };
  }

  async function exportar() {
    const st = $('bkStatus');
    try {
      st.textContent = 'Montando a cópia…';
      const p = await montarPacote(m => { st.textContent = m; });
      const blob = new Blob([JSON.stringify(p, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      const quem = (p.conta.email || 'local').replace(/[^a-z0-9@._-]/gi, '_');
      a.href = URL.createObjectURL(blob);
      a.download = 'pendencias-' + quem + '-' + hojeISO() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      st.textContent = 'Cópia baixada: ' + p.tarefas.length + ' pendências, ' + p.arquivos.length + ' PDFs.';
    } catch (e) { console.error(e); st.textContent = 'Não consegui montar a cópia. Confira a conexão e tente de novo.'; }
  }

  async function importar(p, opcoes, progresso) {
    if (!p || p.formato !== 'pendencias-totali') throw new Error('Este arquivo não é uma cópia do Pendências Totali.');
    const r = { novas: 0, repetidas: 0, pdfs: 0, anexosPerdidos: 0, setores: 0, clientes: 0 };

    // 1) quais pendências entram (as iguais às que já existem ficam de fora)
    const chave = t => norm(t.texto) + '|' + (t.criadoEm || '');
    const ja = new Set((await store.listarTarefas()).map(chave));
    const lista = [];
    (p.tarefas || []).forEach(t => {
      if (ja.has(chave(t))) { r.repetidas++; return; }
      ja.add(chave(t)); lista.push(t);
    });

    // 2) PDFs — só os das pendências que entram
    const usados = new Set();
    lista.forEach(t => (t.anexos || []).forEach(a => a && a.id && usados.add(a.id)));
    const arqs = (p.arquivos || []).filter(a => usados.has(a.id));
    if (arqs.length && !store.arquivos) throw new Error('Este servidor não aceita anexos, e a cópia tem PDFs.');
    const mapaArq = {};
    for (let i = 0; i < arqs.length; i++) {
      progresso('Enviando PDFs ' + (i + 1) + ' de ' + arqs.length + '…');
      const a = arqs[i];
      const res = await store.arquivos.enviar(base64ParaArquivo(a.base64, a.nome, a.tipo));
      mapaArq[a.id] = res.id; r.pdfs++;
    }

    // 3) pendências
    for (let i = 0; i < lista.length; i++) {
      if (i % 10 === 0) progresso('Gravando pendências ' + (i + 1) + ' de ' + lista.length + '…');
      const t = lista[i];
      const d = Object.assign({}, t); delete d.id;
      const anexos = d.anexos || [];
      d.anexos = anexos.filter(x => x.caminho || mapaArq[x.id]).map(x => x.caminho ? Object.assign({}, x) : Object.assign({}, x, { id: mapaArq[x.id] }));
      r.anexosPerdidos += anexos.length - d.anexos.length;
      await store.criarTarefa(d); r.novas++;
    }

    // 4) setores
    const sp = p.config && p.config.setores && p.config.setores.lista;
    if (opcoes.setores && Array.isArray(sp)) {
      const cur = ((await store.lerConfig('setores')) || {}).lista || [];
      const lista2 = cur.map(s => Object.assign({}, s, { palavras: (s.palavras || []).slice() }));
      sp.forEach(s => {
        const ex = lista2.find(x => x.id === s.id) || lista2.find(x => norm(x.nome) === norm(s.nome));
        if (ex) (s.palavras || []).forEach(w => { if (!ex.palavras.some(q => norm(q) === norm(w))) ex.palavras.push(w); });
        else { lista2.push(Object.assign({}, s)); r.setores++; }
      });
      await store.salvarConfig('setores', { lista: lista2 });
    }

    // 5) clientes
    const cp = p.config && p.config.clientes && p.config.clientes.lista;
    if (opcoes.clientes && Array.isArray(cp)) {
      const cur = ((await store.lerConfig('clientes')) || {}).lista || [];
      const lista3 = cur.map(c => Object.assign({}, c, { apelidos: (c.apelidos || []).slice() }));
      cp.forEach(c => {
        const ex = lista3.find(x => soDoc(x.cnpj) === soDoc(c.cnpj));
        if (ex) (c.apelidos || []).forEach(a => { if (!ex.apelidos.some(q => norm(q) === norm(a))) ex.apelidos.push(a); });
        else { lista3.push(Object.assign({}, c)); r.clientes++; }
      });
      await store.salvarConfig('clientes', { lista: lista3 });
    }
    return r;
  }

  function abrir() { $('bkStatus').textContent = ''; $('veuBackup').hidden = false; }
  function fechar() { $('veuBackup').hidden = true; }

  document.addEventListener('DOMContentLoaded', ligar);
  if (document.readyState !== 'loading') ligar();
  let ligado = false;
  function ligar() {
    if (ligado || !$('btnBackup')) return; ligado = true;
    $('btnBackup').addEventListener('click', abrir);
    $('bkFechar').addEventListener('click', fechar);
    $('veuBackup').addEventListener('click', e => { if (e.target.id === 'veuBackup') fechar(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('veuBackup').hidden) fechar(); });
    $('bkExportar').addEventListener('click', exportar);
    $('bkImportar').addEventListener('click', () => $('bkArquivo').click());
    $('bkArquivo').addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0]; e.target.value = '';
      if (!f) return;
      const st = $('bkStatus');
      try {
        const p = JSON.parse(await f.text());
        const r = await importar(p, { setores: $('bkSetores').checked, clientes: $('bkClientes').checked }, m => { st.textContent = m; });
        st.textContent = 'Pronto: ' + r.novas + ' pendências novas' + (r.repetidas ? ', ' + r.repetidas + ' já existiam' : '') +
          (r.pdfs ? ', ' + r.pdfs + ' PDFs' : '') + (r.setores ? ', ' + r.setores + ' setores novos' : '') +
          (r.clientes ? ', ' + r.clientes + ' clientes novos' : '') +
          (r.anexosPerdidos ? '. Atenção: ' + r.anexosPerdidos + ' anexos vieram sem o PDF e ficaram de fora' : '') + '.';
        aviso('Importação concluída.');
      } catch (err) { console.error(err); st.textContent = err.message || 'Não consegui importar este arquivo.'; }
    });
  }

  // disponível para o Hub chamar por código, se preferir migrar sem a tela
  window.PendenciasBackup = { montarPacote: () => montarPacote(() => {}), importar: (p, o) => importar(p, o || { setores: true, clientes: true }, () => {}) };
})();
