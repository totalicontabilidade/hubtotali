/* ============================================================
   Hub Totali · o quadro de pendências (lógica da tela)
   ------------------------------------------------------------
   Veio do sistema "Pendências Totali" quase inteiro. Toda
   gravação e leitura passa por window.Armazenamento (pasta
   js/pendencias/armazenamento), e é só isso que o liga ao banco
   do Hub. O que mudou aqui dentro, e por quê:

   · classes renomeadas onde colidiam com as do Hub (.pnav,
     .pbusca, .pvazio, .pagenda, .pprazo) e o id da busca
     (#pendBusca), porque o Hub já tem uma busca de sistemas;
   · o PDF abre no visualizador do próprio navegador, num quadro
     ao lado, em vez de carregar o pdf.js de uma CDN: a política
     de segurança do Hub não deixa entrar script de fora;
   · uma ponte com o resto do Hub (window.PendenciasHub, no fim):
     o resumo do dia no cabeçalho, o cartão "Hoje" da tela
     inicial e a criação rápida de pendência saem daqui;
   · PENDÊNCIA ENTRE PESSOAS (desde 09/11/2026), que o quadro
     original não tinha e o Hub antigo tinha: "Para quem" manda a
     pendência para o quadro de um ou mais colegas (assinada por
     quem mandou); "Quem acompanha" põe colegas em envolvidos, e
     eles a veem e comentam; o dono marca VISTO; quem mandou vê
     em "Enviadas" se foi vista, riscada, comentada. Tudo isso
     mora em quadros/{uid}/tarefas, nos campos criadoPorUid,
     criadoPorNome, envolvidos, vistoEm e loteId, e a regra do
     banco decide quem lê e quem mexe.

   O mapa dos blocos está no README, em "O quadro de pendências".
   ============================================================ */
(function(){
const STATUS=[
  {id:'hoje',titulo:'Resolver hoje',curto:'Hoje',cab:'Hoje'},
  {id:'semana',titulo:'Resolver esta semana',curto:'Semana',cab:'Esta semana'},
  {id:'data',titulo:'Resolver até a data',curto:'Com data',cab:'Com data'},
  {id:'acompanhar',titulo:'Resolver e acompanhar',curto:'Acompanhar',cab:'Acompanhar'}
];
const CORES=[{c:'a',nome:'Grifar amarelo',v:'var(--mk-a)'},{c:'v',nome:'Grifar verde',v:'var(--mk-v)'},{c:'r',nome:'Grifar rosa',v:'var(--mk-r)'}];
const PALETA=['violeta','teal','verde','ocre','rosa','cinza'];
const SEM='_sem', SEMANA_MS=7*864e5;
const $=id=>document.getElementById(id);
let db=null, assets=null; const store=window.Armazenamento; let tarefas=[], setores=[], clientes=[], carregado=false;
let novosAnexos=[], edAnexos=null;
let comentando=null; const notasAbertas=new Set();
let setorAtivo='todos', busca='', editando=null, novaStatus='hoje', colMobile='hoje';
// pessoas: a equipe do Hub, para quem a nova pendência vai, quem acompanha, e as listas de fora do meu quadro
let equipe=[], novaPara=[], novaAcomp=[], enviadas=[], acompanho=[], abaQ='quadro', comentandoFora=null;
const meuUid=()=>(store&&store.usuario&&store.usuario.uid)||'';
const meuNome=()=>(store&&store.usuario&&(store.usuario.nome||store.usuario.email))||'';
const pessoa=uid=>equipe.find(p=>p.uid===uid)||null;
const nomeDe=uid=>{ const p=pessoa(uid); return p?(p.nome||p.email):(uid?'alguém que saiu da equipe':''); };
const primeiroNome=uid=>String(nomeDe(uid)||'').split(/\s+/)[0];
const deOutro=t=>!!(t.criadoPorUid&&t.criadoPorUid!==meuUid());
// o robô do Atos está na equipe (precisa estar, para gravar), mas não é colega para quem se manda pendência
const ehRobo=p=>/^atos@/i.test(p.email||'')||/^rob[oô]/i.test(p.nome||'');
const colegas=()=>equipe.filter(p=>p.uid!==meuUid()&&p.ativo!==false&&!ehRobo(p));
let calRef=new Date(), calModo=window.innerWidth<900?'semana':'mes', diaFiltro=null, calSel=null, navMin=false, blocoFoco=null;
try{ blocoFoco=localStorage.getItem('pend.foco')||null; setorAtivo=localStorage.getItem('pend.setor')||'todos'; colMobile=localStorage.getItem('pend.col')||'hoje'; calModo=localStorage.getItem('pend.calModo')||calModo; navMin=localStorage.getItem('pend.navMin')==='1'; }catch(e){}

const ICON={
  check:'<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  star:on=>'<svg width="17" height="17" viewBox="0 0 24 24" fill="'+(on?'currentColor':'none')+'" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
  edit:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  del:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  undo:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/></svg>',
  up:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 15l6-6 6 6"/></svg>',
  down:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
  nota:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 01-11.6 7.1L4 20l1.1-4.6A8 8 0 1121 12z"/></svg>',
  alerta:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/></svg>',
  pdf:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 2h8l5 5v15H6z"/><path d="M14 2v5h5"/><path d="M9 14h6M9 17.5h4" stroke-linecap="round"/></svg>',
  clip:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5l-8.2 8.2a5 5 0 01-7.1-7.1l8.5-8.5a3.4 3.4 0 014.8 4.8l-8.4 8.4a1.7 1.7 0 01-2.4-2.4l7.7-7.7"/></svg>',
  grade:'<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>'
};

/* ---------- utilidades ---------- */
function el(tag,attrs,kids){
  const e=document.createElement(tag);
  if(attrs) for(const k in attrs){
    const v=attrs[k];
    if(k==='class') e.className=v;
    else if(k==='html') e.innerHTML=v;
    else if(k==='text') e.textContent=v;
    else if(k.startsWith('on')) e.addEventListener(k.slice(2),v);
    // pelo CSSOM, e não por setAttribute: a política de segurança do Hub não aceita atributo style
    else if(k==='style'){ if(v) e.style.cssText=v; }
    else if(v!==undefined && v!==null && v!==false) e.setAttribute(k,v===true?'':v);
  }
  (kids||[]).forEach(k=>{ if(k!=null) e.appendChild(typeof k==='string'?document.createTextNode(k):k); });
  return e;
}
let toastT;
function aviso(msg){ const t=$('toast'); t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,3500); }
function msgErro(e){
  const c=e&&e.code;
  if(c==='cheio') return 'Armazenamento cheio. Apague riscadas antigas e tente de novo.';
  if(c==='sem_permissao') return 'Você não tem permissão para alterar estas pendências.';
  return 'Não salvou agora. Confira a conexão e tente de novo.';
}
const filas={};
function gravar(chave,fn){
  filas[chave]=(filas[chave]||Promise.resolve()).then(fn).catch(e=>aviso(msgErro(e)));
  return filas[chave];
}
// cada pendência: alterar (mescla os campos) ou apagar, sempre pela camada de armazenamento
const ref=id=>({update:campos=>store.alterarTarefa(id,campos),delete:()=>store.apagarTarefa(id)});
const mudar=(id,dados)=>gravar(id,()=>ref(id).update(dados));
const apagar=id=>{
  const t=tarefas.find(x=>x.id===id);
  const ids=((t&&t.anexos)||[]).map(a=>a.id).filter(Boolean);
  return gravar(id,async()=>{ await ref(id).delete(); if(assets) for(const a of ids){ try{ await assets.apagar(a); }catch(e){} } });
};
function diaISO(d){ const x=new Date(d); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); }
function ddmm(ts){ const d=new Date(ts); return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'); }
function segunda(d){ const x=new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x.getTime(); }
const ehHoje=ts=>!!ts && diaISO(ts)===diaISO(Date.now());
const ddmmISO=iso=>iso.slice(8,10)+'/'+iso.slice(5,7);
const noSetor=t=>setorAtivo==='todos'||setorDe(t)===setorAtivo;
function rotuloDia(iso){ const [y,m,d]=iso.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}); }

/* ---------- anexos em PDF ---------- */
function tamanho(b){ if(!b) return ''; return b<1048576?Math.max(1,Math.round(b/1024))+' KB':(b/1048576).toFixed(1).replace('.',',')+' MB'; }
function msgAnexo(e,nome){
  const c=e&&e.code;
  if(c==='too_large') return nome+' passa de 20 MB.';
  if(c==='unsupported_type') return nome+' não parece um PDF válido.';
  if(c==='quota_or_state') return 'O espaço de anexos está cheio. Apague pendências antigas com PDF.';
  if(c==='not_granted'||c==='capability_disabled') return 'Só quem pode editar o quadro consegue anexar PDF.';
  return 'Não consegui enviar '+nome+'. Tente de novo.';
}
function chipsAnexos(lista,remover){
  if(!lista||!lista.length) return null;
  return el('div',{class:'anexos'},lista.map(a=>{
    const kids=[el('span',{html:ICON.pdf}),el('span',{class:'nm',text:a.nome||'arquivo.pdf'}),el('span',{class:'tm',text:a.enviando?'enviando…':tamanho(a.tam)})];
    if(remover) kids.push(el('button',{class:'x',type:'button',title:'Tirar este PDF','aria-label':'Tirar '+(a.nome||'PDF'),onclick:e=>{e.preventDefault();remover(a);}},['×']));
    if(a.id&&!a.enviando&&!remover) return el('a',{class:'anexo','data-arq':a.id,href:urlArquivo(a.id),target:'_blank',rel:'noopener',title:'Abrir '+(a.nome||'PDF'),onclick:e=>{ if(e.ctrlKey||e.metaKey||e.shiftKey) return; e.preventDefault(); e.stopPropagation(); abrirPdf(a); }},kids);
    return el('span',{class:'anexo'+(a.enviando?' env':'')},kids);
  }));
}
async function enviarPdfs(files,destino,redesenhar){
  if(!assets){ aviso('Este servidor não aceita anexos.'); return; }
  for(const f of Array.from(files||[])){
    const ehPdf=f.type==='application/pdf'||/\.pdf$/i.test(f.name);
    if(!ehPdf){ aviso('Só PDF por aqui: '+f.name); continue; }
    if(f.size>20*1048576){ aviso(f.name+' passa de 20 MB.'); continue; }
    const tmp={nome:f.name,tam:f.size,enviando:true};
    destino.push(tmp); redesenhar();
    try{ const r=await assets.enviar(f); tmp.id=r.id; tmp.tam=r.tam||f.size; delete tmp.enviando; }
    catch(e){ const i=destino.indexOf(tmp); if(i>=0) destino.splice(i,1); aviso(msgAnexo(e,f.name)); }
    redesenhar();
  }
}
const limparAnexo=a=>({id:a.id,nome:a.nome,tam:a.tam||0});
function soltarAsset(id){ if(assets&&id) assets.apagar(id).catch(()=>{}); }
// endereço do PDF para abrir em nova aba ('#' quando só dá para ler pelo armazenamento, como no modo local)
function urlArquivo(id){ return (assets&&assets.url&&assets.url(id))||'#'; }
async function abrirEmAba(id){
  const u=assets&&assets.url&&assets.url(id);
  if(u){ window.open(u,'_blank','noopener'); return; }
  const janela=window.open('','_blank');
  try{ const b=await assets.ler(id); const o=URL.createObjectURL(b); if(janela) janela.location.href=o; else window.open(o,'_blank'); }
  catch(e){ if(janela) janela.close(); aviso('Não consegui abrir o PDF.'); }
}
document.addEventListener('click',e=>{
  const a=e.target.closest&&e.target.closest('a[data-arq]');
  if(a&&a.getAttribute('href')==='#'){ e.preventDefault(); abrirEmAba(a.dataset.arq); }
});

/* ---------- texto formatado: negrito, riscado, grifo e quebra de linha ---------- */
function limpar(html){
  const t=document.createElement('template'); t.innerHTML=html||'';
  const out=document.createElement('div');
  (function walk(src,dst){
    for(const n of Array.from(src.childNodes)){
      if(n.nodeType===3){ dst.appendChild(document.createTextNode(n.nodeValue)); continue; }
      if(n.nodeType!==1) continue;
      const tag=n.tagName;
      if(tag==='BR'){ dst.appendChild(document.createElement('br')); continue; }
      if(tag==='SCRIPT'||tag==='STYLE') continue;
      const embrulhar=nome=>{ const e=document.createElement(nome); walk(n,e); if(e.childNodes.length) dst.appendChild(e); };
      if(tag==='B'||tag==='STRONG'){ embrulhar('b'); continue; }
      if(tag==='S'||tag==='STRIKE'||tag==='DEL'){ embrulhar('s'); continue; }
      if(tag==='MARK'){ const e=document.createElement('mark'); const c=n.getAttribute('data-c'); if(c==='v'||c==='r') e.setAttribute('data-c',c); walk(n,e); if(e.childNodes.length) dst.appendChild(e); continue; }
      if(tag==='DIV'||tag==='P'||tag==='LI'){
        if(dst.childNodes.length && dst.lastChild.nodeName!=='BR') dst.appendChild(document.createElement('br'));
        walk(n,dst); continue;
      }
      const st=n.style||{};
      if(st.fontWeight==='bold'||Number(st.fontWeight)>=600){ embrulhar('b'); continue; }
      if((st.textDecoration||st.textDecorationLine||'').indexOf('line-through')>=0){ embrulhar('s'); continue; }
      walk(n,dst);
    }
  })(t.content,out);
  while(out.lastChild && out.lastChild.nodeName==='BR') out.removeChild(out.lastChild);
  while(out.firstChild && out.firstChild.nodeName==='BR') out.removeChild(out.firstChild);
  return out.innerHTML;
}
function textoPuro(html){ const d=document.createElement('div'); d.innerHTML=html.replace(/<br\s*\/?>/gi,'\n'); return (d.textContent||'').trim(); }
const temGrifo=html=>/<mark[\s>]/i.test(html||'');

function desembrulhar(n){ const p=n.parentNode; if(!p) return; while(n.firstChild) p.insertBefore(n.firstChild,n); p.removeChild(n); }
function grifar(cor,area){
  const sel=getSelection(); if(!sel.rangeCount) return;
  const r=sel.getRangeAt(0);
  if(!area.contains(r.commonAncestorContainer)) return;
  const base=r.commonAncestorContainer.nodeType===1?r.commonAncestorContainer:r.commonAncestorContainer.parentElement;
  const pai=base&&base.closest('mark');
  if(pai && area.contains(pai)){
    if((pai.getAttribute('data-c')||'a')===cor) desembrulhar(pai);
    else if(cor==='a') pai.removeAttribute('data-c'); else pai.setAttribute('data-c',cor);
    return;
  }
  if(r.collapsed){ aviso('Selecione o trecho que quer grifar.'); return; }
  const m=document.createElement('mark'); if(cor!=='a') m.setAttribute('data-c',cor);
  m.appendChild(r.extractContents());
  m.querySelectorAll('mark').forEach(desembrulhar);
  r.insertNode(m);
  sel.removeAllRanges(); const nr=document.createRange(); nr.selectNodeContents(m); sel.addRange(nr);
}
function limparFormato(area){
  const sel=getSelection();
  const dentro=sel.rangeCount && !sel.isCollapsed && area.contains(sel.getRangeAt(0).commonAncestorContainer);
  area.querySelectorAll('mark,b,strong,s,strike,del').forEach(n=>{ if(!dentro||sel.containsNode(n,true)) desembrulhar(n); });
}
function barraFormatacao(area){
  const prev=e=>e.preventDefault();
  const cmd=c=>()=>{ area.focus(); document.execCommand(c); };
  const kids=[
    el('button',{class:'fb neg',type:'button',title:'Negrito (Ctrl+B)','aria-label':'Negrito',onmousedown:prev,onclick:cmd('bold')},['N']),
    el('button',{class:'fb risca',type:'button',title:'Riscar trecho feito','aria-label':'Riscar trecho',onmousedown:prev,onclick:cmd('strikeThrough')},['S']),
    el('button',{class:'fb',type:'button',title:'Marcador • (ou digite - e espaço no começo da linha)','aria-label':'Marcador',onmousedown:prev,onclick:()=>marcador(area),style:'font-size:20px;line-height:1'},['•']),
    el('span',{class:'sep'})
  ];
  CORES.forEach(c=>kids.push(el('button',{class:'fb',type:'button',title:c.nome,'aria-label':c.nome,onmousedown:prev,onclick:()=>grifar(c.c,area)},[el('span',{class:'sw',style:'background:'+c.v})])));
  kids.push(el('span',{class:'sep'}));
  kids.push(el('button',{class:'fb',type:'button',title:'Cadastrar o nome selecionado como cliente (CNPJ)','aria-label':'Cadastrar cliente',onmousedown:prev,style:'font-size:12.5px;font-weight:700',onclick:()=>{
    const s=getSelection(); const txt=s.rangeCount&&area.contains(s.getRangeAt(0).commonAncestorContainer)?s.toString().trim():'';
    abrirClientes(null,txt);
  }},['CNPJ']));
  kids.push(el('button',{class:'fb',type:'button',title:'Tirar negrito, riscado e grifo','aria-label':'Tirar formatação',onmousedown:prev,onclick:()=>limparFormato(area),style:'font-size:12px'},['Limpar']));
  return el('div',{class:'barra'},kids);
}
/* ---------- Enter pula linha; marcadores • ---------- */
const BULLET='• ';
function linhaAtual(area){
  const s=getSelection(); if(!s.rangeCount) return '';
  const r=s.getRangeAt(0).cloneRange();
  if(!area.contains(r.startContainer)) return '';
  r.setStart(area,0);
  const d=document.createElement('div'); d.appendChild(r.cloneContents());
  d.querySelectorAll('br').forEach(b=>b.replaceWith('\n'));
  d.querySelectorAll('div,p').forEach(x=>x.prepend('\n'));
  const t=d.textContent||'';
  return t.slice(t.lastIndexOf('\n')+1);
}
function quebrarLinha(){ if(!document.execCommand('insertLineBreak')) document.execCommand('insertHTML',false,'<br>'); }
function marcador(area){
  area.focus();
  const l=linhaAtual(area);
  if(l.startsWith(BULLET)) return;
  if(l.trim()) quebrarLinha();
  document.execCommand('insertText',false,BULLET);
}
function teclasEditor(area,enviar,cancelar){
  area.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){ e.preventDefault(); enviar(); return; }
    if(e.key==='Escape'&&cancelar){ e.preventDefault(); cancelar(); return; }
    if(e.key==='Enter'&&!e.isComposing){
      e.preventDefault();
      const l=linhaAtual(area);
      if(/^\s*•\s*$/.test(l)){ for(let i=0;i<l.length;i++) document.execCommand('delete'); return; } // marcador vazio encerra a lista
      quebrarLinha();
      if(l.startsWith(BULLET)) document.execCommand('insertText',false,BULLET);
      return;
    }
    if(e.key===' '&&!e.ctrlKey&&!e.metaKey){
      const l=linhaAtual(area);
      if(l==='-'||l==='*'){ e.preventDefault(); document.execCommand('delete'); document.execCommand('insertText',false,BULLET); }
    }
  });
}
function colarSoTexto(e){ e.preventDefault(); document.execCommand('insertText',false,(e.clipboardData||window.clipboardData).getData('text/plain')); }

/* ---------- setores ---------- */
const achaSetor=id=>setores.find(x=>x.id===id);
function nomeSetor(id){ const s=achaSetor(id); return s?s.nome:'Sem setor'; }
function corSetor(id){ const s=achaSetor(id); return 'var(--sc-'+((s&&PALETA.includes(s.cor))?s.cor:'cinza')+')'; }
function setorDe(t){ return (t.setor && achaSetor(t.setor))?t.setor:SEM; }
function salvarSetores(lista){ return gravar('config',()=>store.salvarConfig('setores',{lista})); }
function opcoesSetor(sel,valor){
  sel.textContent='';
  setores.forEach(s=>sel.appendChild(el('option',{value:s.id},[s.nome])));
  sel.appendChild(el('option',{value:''},['Sem setor']));
  sel.value=valor||'';
  if(sel.value!==(valor||'')) sel.value='';
}

/* ---------- render ---------- */
function agendar(){ if(!editando&&!comentando) render(); }
// em qual bloco a pendência aparece: com data vencida ou de hoje vai para Hoje; desta semana, para Esta semana
function colunaDe(t,agora){
  const fimSemana=diaISO(segunda(agora)+6*864e5+36e5), hojeCol=diaISO(agora);
  if(t.status==='data'&&t.prazo){ if(t.prazo<=hojeCol) return 'hoje'; if(t.prazo<=fimSemana) return 'semana'; }
  return t.status||'hoje';
}

function render(){
  const agora=Date.now();
  const abertas=tarefas.filter(t=>!t.feito);

  // navegação de setores
  const nav=$('nav'); nav.textContent='';
  const ids=['todos'].concat(setores.map(s=>s.id));
  if(abertas.some(t=>setorDe(t)===SEM)) ids.push(SEM);
  if(!ids.includes(setorAtivo)) setorAtivo='todos';
  const tog=$('navTog'); tog.textContent='';
  tog.append(navMin?'Mostrar todos ('+ids.length+')':'Minimizar');
  tog.insertAdjacentHTML('beforeend',navMin?ICON.down:ICON.up);
  tog.setAttribute('aria-expanded',String(!navMin));
  tog.onclick=()=>{ navMin=!navMin; try{localStorage.setItem('pend.navMin',navMin?'1':'0')}catch(e){}; render(); };
  ids.filter(id=>!navMin||id===setorAtivo).forEach(id=>{
    const nome=id==='todos'?'Todos os setores':id===SEM?'Sem setor':nomeSetor(id);
    const mono=id==='todos'?el('span',{class:'mono todos',html:ICON.grade}):el('span',{class:'mono',style:'--sc:'+corSetor(id),text:nome.charAt(0).toUpperCase()});
    const n=abertas.filter(t=>id==='todos'||setorDe(t)===id).length;
    nav.appendChild(el('button',{class:'nav-it','aria-pressed':String(setorAtivo===id),onclick:()=>{
      setorAtivo=id; try{localStorage.setItem('pend.setor',id)}catch(e){}
      if(id!=='todos'&&id!==SEM){ $('novaSetor').dataset.escolhido=''; }
      render();
    }},[mono,el('span',{text:nome}),el('span',{class:'q',text:String(n)})]));
  });
  if(!navMin) nav.appendChild(el('button',{class:'nav-it gerir',onclick:abrirSetores},[el('span',{class:'mono',text:'+'}),'Gerenciar setores']));

  const ns=$('novaSetor'); const atual=ns.dataset.escolhido?ns.value:'';
  opcoesSetor(ns, atual || (setorAtivo!=='todos'&&setorAtivo!==SEM?setorAtivo:(setores[0]&&setores[0].id)));

  const q=busca.trim().toLowerCase();
  const naVista=t=>noSetor(t)&&(!diaFiltro||t.prazo===diaFiltro)&&(!q||(t.texto||'').toLowerCase().includes(q)||nomeSetor(t.setor).toLowerCase().includes(q)||(t.notas||[]).some(n=>(n.t||'').toLowerCase().includes(q)));

  const fd=$('filtroDia'); fd.textContent='';
  if(diaFiltro) fd.appendChild(el('span',{class:'filtro'},['Só '+rotuloDia(diaFiltro),el('button',{type:'button',onclick:()=>{diaFiltro=null;render();}},['Ver tudo'])]));
  renderCal();
  if(!$('calg').hidden) renderGrande();

  // progresso do dia
  const feitasHoje=tarefas.filter(t=>t.feito&&ehHoje(t.feitoEm)&&noSetor(t)).length;
  const hojeISO=diaISO(Date.now());
  const paraHoje=abertas.filter(t=>noSetor(t)&&(t.status==='hoje'||(t.status==='data'&&t.prazo&&t.prazo<=hojeISO))).length;
  const tot=feitasHoje+paraHoje, pct=tot?Math.round(feitasHoje/tot*100):0;
  $('progI').style.width=pct+'%';
  $('progBar').setAttribute('aria-valuenow',String(pct));
  $('progTx').innerHTML='';
  $('progTx').append(el('b',{text:String(feitasHoje)}),feitasHoje===1?' riscada hoje · ':' riscadas hoje · ',el('b',{text:String(paraHoje)}),paraHoje===1?' falta para hoje':' faltam para hoje');


  // pendência com data dentro desta semana (ou atrasada) aparece na coluna "Esta semana", em ordem de data
  const colDe=t=>colunaDe(t,agora);

  // troca de prazo (celular)
  const tr=$('trocar'); tr.textContent='';
  STATUS.forEach(s=>{
    const n=abertas.filter(t=>colDe(t)===s.id&&naVista(t)).length;
    tr.appendChild(el('button',{type:'button',class:'st-'+s.id,'aria-pressed':String(colMobile===s.id),onclick:()=>{colMobile=s.id;try{localStorage.setItem('pend.col',s.id)}catch(e){};render();}},[el('span',{class:'dot'}),s.curto,el('span',{class:'n',text:' '+n})]));
  });

  // abas (meu quadro / enviadas / acompanho)
  renderAbas();
  const foraDoQuadro=abaQ!=='quadro';
  $('quadro').hidden=foraDoQuadro; $('feitas').hidden=foraDoQuadro; $('trocar').hidden=foraDoQuadro||!!blocoFoco;
  const lp=$('listaPessoas'); if(lp){ lp.hidden=!foraDoQuadro; if(foraDoQuadro) renderFora(); }
  pintarPara();

  // quadro
  const quadro=$('quadro'); quadro.textContent=''; quadro.dataset.col=blocoFoco||colMobile;
  quadro.classList.toggle('foco',!!blocoFoco);
  const focar=id=>{ blocoFoco=id; if(id) colMobile=id; try{ localStorage.setItem('pend.foco',id||''); if(id) localStorage.setItem('pend.col',id); }catch(e){}; render(); if(id) quadro.scrollIntoView({block:'start',behavior:'smooth'}); };
  STATUS.filter(s=>!blocoFoco||s.id===blocoFoco).forEach(s=>{
    const pz=t=>t.status==='data'&&t.prazo?t.prazo:'9';
    const abertasCol=tarefas.filter(t=>!t.feito&&colDe(t)===s.id&&naVista(t))
      .sort(s.id==='data'||s.id==='semana'||s.id==='hoje'
        ?(a,b)=>pz(a).localeCompare(pz(b))||(b.importante?1:0)-(a.importante?1:0)||(a.criadoEm||0)-(b.criadoEm||0)
        :(a,b)=>(b.importante?1:0)-(a.importante?1:0)||(a.criadoEm||0)-(b.criadoEm||0));
    const riscadasCol=tarefas.filter(t=>t.feito&&ehHoje(t.feitoEm)&&colDe(t)===s.id&&naVista(t))
      .sort((a,b)=>(a.feitoEm||0)-(b.feitoEm||0));
    const btnFoco=blocoFoco
      ?el('button',{class:'col-foco',type:'button',title:'Voltar a ver todos os blocos',onclick:()=>focar(null)},['Ver todos os blocos'])
      :el('button',{class:'col-foco ic',type:'button',title:'Ver só este bloco','aria-label':'Ver só o bloco '+s.titulo,html:ICAL.ampliar,onclick:()=>focar(s.id)});
    const col=el('section',{class:'col st-'+s.id,'aria-label':s.titulo},[
      el('div',{class:'col-h'},[el('span',{class:'dot'}),el('h2',{text:blocoFoco?s.titulo:s.cab,title:s.titulo+(blocoFoco?'':' · clique para ver só este bloco'),onclick:()=>{ if(!blocoFoco) focar(s.id); },style:blocoFoco?'':'cursor:pointer'}),el('span',{class:'q',text:String(abertasCol.length)}),btnFoco])
    ]);
    if(!carregado) col.appendChild(el('div',{class:'pvazio',text:'Carregando…'}));
    else if(!abertasCol.length&&!riscadasCol.length) col.appendChild(el('div',{class:'pvazio',text:q?'Nada encontrado aqui.':'Nada pendente aqui.'}));
    else if(!abertasCol.length) col.appendChild(el('div',{class:'pvazio',text:'Tudo riscado por aqui.'}));
    const fazer=t=>editando===t.id?cardEdicao(t):card(t,t.status||'hoje',agora);
    const todas=abertasCol.concat(riscadasCol);
    if(blocoFoco&&setorAtivo==='todos'){
      // bloco aberto com todos os setores: separa por setor
      const ordem=setores.map(x=>x.id).concat([SEM]);
      ordem.forEach(sid=>{
        const doSetor=todas.filter(t=>setorDe(t)===sid);
        if(!doSetor.length) return;
        const nome=sid===SEM?'Sem setor':nomeSetor(sid);
        col.appendChild(el('div',{class:'grp'},[el('span',{class:'mono',style:'--sc:'+corSetor(sid),text:nome.charAt(0).toUpperCase()}),nome,el('span',{class:'q',text:String(doSetor.filter(t=>!t.feito).length)})]));
        col.appendChild(el('div',{class:'cards'},doSetor.map(fazer)));
      });
    } else {
      col.appendChild(el('div',{class:'cards'},todas.map(fazer)));
    }
    quadro.appendChild(col);
  });

  // riscadas
  const feitas=tarefas.filter(t=>t.feito&&naVista(t)).sort((a,b)=>(b.feitoEm||0)-(a.feitoEm||0));
  $('feitasTit').textContent='Riscadas ('+feitas.length+')';
  const lf=$('listaFeitas'); lf.textContent='';
  if(!feitas.length) lf.appendChild(el('div',{class:'dica',text:'Quando riscar uma pendência, ela aparece aqui. As de hoje continuam riscadas no quadro até o fim do dia.'}));
  feitas.slice(0,150).forEach(t=>{
    lf.appendChild(el('div',{class:'fi'},[
      el('span',{class:'ok',html:ICON.check.replace('width="12" height="12"','width="16" height="16"')}),
      el('div',{},[txtEl('txt',t),el('div',{class:'info',text:nomeSetor(t.setor)+' · riscada em '+ddmm(t.feitoEm||Date.now())})]),
      el('div',{class:'acoes'},[
        el('button',{class:'ic',title:'Desfazer risco','aria-label':'Desfazer risco',html:ICON.undo,onclick:()=>mudar(t.id,{feito:false,feitoEm:null})}),
        botaoExcluir(t)
      ])
    ]));
  });
  avisarHub();
}

/* ---------- as abas do quadro: Meu quadro · Enviadas · Acompanho ----------
   Enviadas: o que eu mandei para colegas — se viram, riscaram,
   comentaram. Acompanho: o que colegas me puseram para acompanhar.
   As duas vêm de fora do meu quadro, por consulta aos quadros da
   equipe, e se refazem a cada minuto junto com o resto. */
function refrescarPessoas(){
  if(!db||!store.listarEnviadas||!equipe.length) return Promise.resolve();
  const uids=equipe.map(p=>p.uid);
  return Promise.all([store.listarEnviadas(uids),store.listarAcompanho(uids)]).then(r=>{
    const a=JSON.stringify([enviadas,acompanho]);
    enviadas=(r[0]||[]).filter(t=>t.origemSistema!=='hub-antigo'); acompanho=r[1]||[];
    if(JSON.stringify([enviadas,acompanho])!==a) agendar();
  }).catch(()=>{});
}
function renderAbas(){
  const box=$('abasQ'); if(!box) return;
  box.textContent='';
  if(!colegas().length){ box.hidden=true; if(abaQ!=='quadro') abaQ='quadro'; return; }
  box.hidden=false;
  const abertasEnv=enviadas.filter(t=>!t.feito).length, semVisto=enviadas.filter(t=>!t.feito&&!t.vistoEm).length;
  const novasParaMim=tarefas.filter(t=>!t.feito&&deOutro(t)&&!t.vistoEm).length;
  const abas=[
    {id:'quadro',rot:'Meu quadro',n:tarefas.filter(t=>!t.feito).length,alerta:novasParaMim},
    {id:'enviadas',rot:'Enviadas',n:abertasEnv,alerta:0,dica:semVisto?semVisto+' ainda não vista'+(semVisto>1?'s':''):''},
    {id:'acompanho',rot:'Acompanho',n:acompanho.filter(t=>!t.feito).length,alerta:0}
  ];
  abas.forEach(a=>box.appendChild(el('button',{type:'button',class:'aba-q','aria-pressed':String(abaQ===a.id),title:a.dica||'',onclick:()=>{ abaQ=a.id; render(); }},[a.rot,el('span',{class:'n',text:String(a.n)}),a.alerta?el('span',{class:'novo',text:a.alerta+' nova'+(a.alerta>1?'s':'')}):null])));
}
function statusCurto(t){
  if(t.feito) return 'riscada'+(t.feitoEm?' em '+ddmm(t.feitoEm):'');
  if(t.status==='data'&&t.prazo) return chipPrazo(t.prazo,Date.now()).textContent;
  return (STATUS.find(s=>s.id===t.status)||{}).curto||'';
}
function itemFora(t,modo){
  const dono=nomeDe(t.donoUid);
  const podeRiscar=modo==='enviadas';
  const acoes=[el('button',{class:'ic',title:'Comentar','aria-label':'Comentar',html:ICON.nota,onclick:()=>{ comentandoFora=comentandoFora===t.id?null:t.id; render(); }})];
  if(podeRiscar) acoes.push(t.feito
    ?el('button',{class:'ic',title:'Desfazer risco','aria-label':'Desfazer risco',html:ICON.undo,onclick:()=>mudarFora(t,{feito:false,feitoEm:null})})
    :el('button',{class:'ic',title:'Riscar (feito)','aria-label':'Riscar',html:ICON.check,onclick:()=>mudarFora(t,{feito:true,feitoEm:Date.now(),revisadoEm:null})}));
  // quem mandou desfaz o envio enquanto o dono ainda não viu; depois, só o dono apaga
  if(modo==='enviadas'&&!t.vistoEm) acoes.push(botaoExcluirFora(t));
  const notas=(t.notas||[]);
  const ultima=notas.length?notas[notas.length-1]:null;
  const vistoTx=modo==='enviadas'?(t.vistoEm?'vista por '+primeiroNome(t.donoUid)+' em '+ddmm(t.vistoEm):'ainda não vista'):('de '+(t.criadoPorNome||nomeDe(t.criadoPorUid)||'colega'));
  return el('article',{class:'fora'+(t.feito?' feita':'')+(modo==='enviadas'&&!t.vistoEm&&!t.feito?' nao-vista':''),'data-id':t.id},[
    el('div',{class:'fora-cab'},[el('span',{class:'fora-dono'},[modo==='enviadas'?'para ':'no quadro de ',el('b',{text:dono})]),el('span',{class:'fora-st',text:statusCurto(t)}),el('span',{class:'fora-visto',text:vistoTx}),el('span',{class:'esp'}),el('div',{class:'acoes'},acoes)]),
    txtEl('txt',t),
    ultima?el('div',{class:'fora-nota'},[el('span',{html:ICON.nota}),el('span',{class:'nt'},[ultima.por&&ultima.porUid!==meuUid()?el('b',{class:'por',text:ultima.por+': '}):null,ultima.t]),el('span',{class:'nd',text:quandoNota(ultima.em)}),notas.length>1?el('span',{class:'nd',text:'· '+notas.length+' comentários'}):null]):null,
    comentandoFora===t.id?caixaNotaFora(t):null
  ]);
}
function mudarFora(t,campos){
  return gravar(t.id,async()=>{ await store.alterarTarefaEm(t.donoUid,t.id,campos); await refrescarPessoas(); render(); });
}
function apagarFora(t){
  return gravar(t.id,async()=>{ await store.apagarTarefaEm(t.donoUid,t.id); await refrescarPessoas(); render(); });
}
function botaoExcluirFora(t){
  let armado=false,tm;
  const b=el('button',{class:'ic',title:'Apagar (ainda não foi vista)','aria-label':'Apagar',html:ICON.del});
  b.addEventListener('click',()=>{
    if(!armado){ armado=true; b.className='ic conf'; b.textContent='Apagar?'; tm=setTimeout(()=>{armado=false;b.className='ic';b.innerHTML=ICON.del;},3500); return; }
    clearTimeout(tm); apagarFora(t);
  });
  return b;
}
function caixaNotaFora(t){
  const inp=el('input',{type:'text',maxlength:'300',placeholder:'Comentário para '+primeiroNome(t.donoUid)+' ver','aria-label':'Novo comentário'});
  const salvar=()=>{ const v=inp.value.trim(); if(!v){ inp.focus(); return; } comentandoFora=null; mudarFora(t,{notas:(t.notas||[]).concat([novaNota(v)])}); };
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); salvar(); } if(e.key==='Escape'){ e.preventDefault(); comentandoFora=null; render(); } });
  setTimeout(()=>inp.focus(),0);
  return el('div',{class:'nova-nota'},[inp,el('div',{class:'linha'},[el('span',{class:'esp'}),el('button',{class:'sec',type:'button',onclick:()=>{ comentandoFora=null; render(); }},['Cancelar']),el('button',{class:'prim',type:'button',onclick:salvar},['Comentar'])])]);
}
function renderFora(){
  const box=$('listaPessoas'); if(!box) return;
  box.textContent='';
  const lista=(abaQ==='enviadas'?enviadas:acompanho).slice().sort((a,b)=>(a.feito?1:0)-(b.feito?1:0)||(b.criadoEm||0)-(a.criadoEm||0));
  const q=busca.trim().toLowerCase();
  const vis=lista.filter(t=>!q||(t.texto||'').toLowerCase().includes(q)||nomeDe(t.donoUid).toLowerCase().includes(q));
  if(!vis.length){
    box.appendChild(el('div',{class:'pvazio grande',text:abaQ==='enviadas'
      ?'Você ainda não mandou pendência para ninguém. Em "Para quem", na caixa de nova pendência, escolha quem recebe.'
      :'Ninguém pôs você para acompanhar uma pendência ainda.'}));
    return;
  }
  // agrupadas por pessoa, abertas antes das riscadas
  const porPessoa=new Map();
  vis.forEach(t=>{ const k=abaQ==='enviadas'?t.donoUid:(t.donoUid); if(!porPessoa.has(k)) porPessoa.set(k,[]); porPessoa.get(k).push(t); });
  Array.from(porPessoa.entries()).sort((a,b)=>nomeDe(a[0]).localeCompare(nomeDe(b[0]),'pt-BR')).forEach(([uid,ts])=>{
    const abertas=ts.filter(t=>!t.feito).length;
    box.appendChild(el('div',{class:'grp'},[el('span',{class:'mono',style:'--sc:var(--acomp)',text:nomeDe(uid).charAt(0).toUpperCase()}),nomeDe(uid),el('span',{class:'q',text:abertas+' aberta'+(abertas===1?'':'s')+(ts.length>abertas?' · '+(ts.length-abertas)+' riscada'+(ts.length-abertas===1?'':'s'):'')})]));
    box.appendChild(el('div',{class:'cards'},ts.map(t=>itemFora(t,abaQ))));
  });
}

/* Não há faxina: riscada é concluída, fica na lista Riscadas para
   consulta e ninguém é cobrado para apagar (pedido do Raoni,
   10/11/2026). Apagar continua existindo, à mão, cartão a cartão. */
function botaoConfirmar(rotulo,rotuloConf,acao,cls){
  let armado=false,tm;
  const b=el('button',{class:cls,type:'button',text:rotulo});
  b.addEventListener('click',()=>{
    if(!armado){ armado=true; b.textContent=rotuloConf; b.style.background='var(--perigo)'; b.style.color='#fff'; b.style.borderColor='var(--perigo)'; tm=setTimeout(()=>{armado=false;b.textContent=rotulo;b.style.cssText='';},3500); return; }
    clearTimeout(tm); acao();
  });
  return b;
}
function botaoExcluir(t){
  let armado=false,tm;
  const b=el('button',{class:'ic',title:'Excluir','aria-label':'Excluir',html:ICON.del});
  b.addEventListener('click',()=>{
    if(!armado){ armado=true; b.className='ic conf'; b.textContent='Excluir?'; tm=setTimeout(()=>{armado=false;b.className='ic';b.innerHTML=ICON.del;},3500); return; }
    clearTimeout(tm); apagar(t.id);
  });
  return b;
}

function card(t,st,agora){
  if(t.feito){
    return el('article',{class:'card feito','data-id':t.id},[
      el('button',{class:'chk',title:'Desfazer risco','aria-label':'Desfazer risco',html:ICON.check,onclick:()=>mudar(t.id,{feito:false,feitoEm:null})}),
      txtEl('txt',t),
      chipsAnexos(t.anexos),
      blocoNotas(t,false),
      el('div',{class:'meta'},[setorAtivo==='todos'?tagSetor(t):null,el('span',{text:'riscada hoje'}),el('div',{class:'acoes'},[botaoExcluir(t)])])
    ]);
  }
  let desde=null;
  if(st==='hoje' && t.statusEm && diaISO(t.statusEm)<diaISO(agora)) desde='para hoje desde '+ddmm(t.statusEm);
  if(st==='semana' && t.statusEm && t.statusEm<segunda(agora)) desde='vem da semana de '+ddmm(segunda(t.statusEm));
  if(st==='acompanhar' && t.statusEm) desde='acompanhando desde '+ddmm(t.statusEm);
  if(st==='data' && t.prazo){ const dias=Math.round((new Date(t.prazo+'T12:00')-new Date(diaISO(agora)+'T12:00'))/864e5); if(dias>1) desde='faltam '+dias+' dias'; else if(dias===1) desde='é amanhã'; }
  const diasAtraso=(st==='data'&&t.prazo&&t.prazo<diaISO(agora))?Math.round((new Date(diaISO(agora)+'T12:00')-new Date(t.prazo+'T12:00'))/864e5):0;
  // ir para "Com data" pede a data: abre a edição já nesse prazo
  const mover=STATUS.filter(s=>s.id!==st).map(s=>el('button',{class:'mv st-'+s.id,title:'Mover para '+s.titulo,'aria-label':'Mover para '+s.titulo,onclick:()=>{ if(s.id==='data') abrirEdicao(t.id,'data'); else mudar(t.id,{status:s.id,statusEm:Date.now(),prazo:null}); }},[el('span',{class:'dot'}),el('span',{class:'lbl',text:s.curto})]));
  const urg=st==='data'&&t.prazo===diaISO(agora);
  return el('article',{class:'card'+(t.importante?' imp':'')+(urg?' urg':'')+(diasAtraso?' atrasada':'')+(deOutro(t)&&!t.vistoEm?' nova':''),'data-id':t.id},[
    diasAtraso?el('div',{class:'selo'},[el('span',{html:ICON.alerta}),'ATRASADA HÁ '+diasAtraso+(diasAtraso===1?' DIA':' DIAS')+' · venceu '+ddmmISO(t.prazo)]):null,
    faixaDeQuem(t),
    el('button',{class:'chk',title:'Riscar (feito)','aria-label':'Riscar como feito',html:ICON.check,onclick:()=>mudar(t.id,{feito:true,feitoEm:Date.now(),revisadoEm:null})}),
    txtEl('txt',t,{ondblclick:()=>abrirEdicao(t.id)}),
    chipsAnexos(t.anexos),
    blocoNotas(t,true),
    comentando===t.id?caixaNota(t):null,
    el('div',{class:'meta'},[
      setorAtivo==='todos'?tagSetor(t):null,
      t.prazo?chipPrazo(t.prazo,agora):null,
      desde?el('span',{class:'desde',text:desde}):null,
      chipAcompanham(t),
      el('div',{class:'acoes'},[
        el('button',{class:'ic',title:'Comentar (ex.: esperando retorno)','aria-label':'Comentar',html:ICON.nota,onclick:()=>abrirNota(t.id)}),
        el('button',{class:'ic'+(t.importante?' on':''),title:t.importante?'Tirar do topo':'Importante (fica no topo)','aria-label':'Importante','aria-pressed':String(!!t.importante),html:ICON.star(!!t.importante),onclick:()=>mudar(t.id,{importante:!t.importante})}),
        el('button',{class:'ic',title:'Editar','aria-label':'Editar',html:ICON.edit,onclick:()=>abrirEdicao(t.id)}),
        botaoExcluir(t)
      ])
    ]),
    el('div',{class:'mover'},[el('span',{class:'mvl',text:'Mover para'}),...mover])
  ]);
}
/* ---------- de quem veio, quem acompanha, visto ----------
   A pendência que um colega mandou chega com uma faixa no alto:
   quem mandou e, enquanto o dono não a viu, "nova". Clicar em
   "Visto" avisa quem mandou — é a ciência do quadro antigo, sem
   cerimônia. */
function marcarVisto(t){ if(deOutro(t)&&!t.vistoEm) mudar(t.id,{vistoEm:Date.now()}); }
function faixaDeQuem(t){
  if(!deOutro(t)) return null;
  const antigo=t.origemSistema==='hub-antigo', atos=t.origemSistema==='atos';
  const nome=t.criadoPorNome||nomeDe(t.criadoPorUid)||'um colega';
  const kids=[antigo?el('span',{class:'de-nome'},['do ',el('b',{text:'quadro antigo do Hub'})]):atos?el('span',{class:'de-nome'},['do ',el('b',{text:'Atos Societários'})]):el('span',{class:'de-nome'},['de ',el('b',{text:nome})])];
  if(t.criadoEm) kids.push(el('span',{class:'de-quando',text:ddmm(t.criadoEm)}));
  if(!t.vistoEm) kids.push(el('span',{class:'de-nova',text:'nova'}),el('span',{class:'esp'}),el('button',{class:'de-visto',type:'button',title:'Avisar '+nome+' que você viu',onclick:()=>marcarVisto(t)},['Visto ✓']));
  else kids.push(el('span',{class:'esp'}),el('span',{class:'de-vista',text:'vista em '+ddmm(t.vistoEm)}));
  return el('div',{class:'de'},kids);
}
function chipAcompanham(t){
  const lista=(t.envolvidos||[]).filter(u=>u!==meuUid());
  if(!lista.length) return null;
  const nomes=lista.map(primeiroNome).filter(Boolean);
  return el('span',{class:'acomp',title:'Acompanham: '+lista.map(nomeDe).join(', ')},['👁 '+(nomes.length<=2?nomes.join(' e '):nomes.length+' acompanham')]);
}

/* comentários da pendência ("esperando retorno do cliente"…) */
const SUGESTOES=['Esperando retorno do cliente','Aguardando documento','Aguardando pagamento','Enviado, falta confirmar'];
function quandoNota(ts){ const d=new Date(ts); const h=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); return ehHoje(ts)?'hoje '+h:ddmm(ts)+' '+h; }
function blocoNotas(t,podeApagar){
  const notas=t.notas||[]; if(!notas.length) return null;
  const aberto=notasAbertas.has(t.id);
  const mostrar=aberto?notas.map((n,i)=>[n,i]):[[notas[notas.length-1],notas.length-1]];
  const box=el('div',{class:'notas'});
  mostrar.forEach(([n,i])=>{
    const deColega=n.porUid&&n.porUid!==meuUid();
    const kids=[el('span',{html:ICON.nota}),realcar(el('span',{class:'nt'},[deColega?el('b',{class:'por',text:(n.por||nomeDe(n.porUid)||'colega')+': '}):null,n.t])),el('span',{class:'nd',text:quandoNota(n.em)})];
    if(podeApagar&&aberto){
      let armado=false,tm; const b=el('button',{class:'x',type:'button',title:'Apagar comentário','aria-label':'Apagar comentário'},['×']);
      b.addEventListener('click',()=>{ if(!armado){ armado=true; b.textContent='Apagar?'; b.classList.add('conf'); tm=setTimeout(()=>{armado=false;b.textContent='×';b.classList.remove('conf');},3000); return; } clearTimeout(tm); mudar(t.id,{notas:notas.filter((_,k)=>k!==i)}); });
      kids.push(b);
    }
    box.appendChild(el('div',{class:'nota'},kids));
  });
  if(notas.length>1) box.appendChild(el('button',{class:'vertodas',type:'button',onclick:()=>{ aberto?notasAbertas.delete(t.id):notasAbertas.add(t.id); render(); }},[aberto?'Mostrar só o último':'Ver os '+notas.length+' comentários']));
  else if(podeApagar&&!aberto) box.appendChild(el('button',{class:'vertodas',type:'button',onclick:()=>{ notasAbertas.add(t.id); render(); }},['Apagar comentário']));
  return box;
}
// um comentário leva quem escreveu: no quadro de uma pessoa só isso não importava; entre pessoas, importa
function novaNota(v){ const n={t:v,em:Date.now()}; if(meuUid()){ n.porUid=meuUid(); n.por=meuNome(); } return n; }
function abrirNota(id){
  const t=tarefas.find(x=>x.id===id); if(t) marcarVisto(t);
  comentando=id; render();
  const i=document.querySelector('.nova-nota input'); if(i) i.focus();
}
function fecharNota(){ comentando=null; render(); }
function caixaNota(t){
  const inp=el('input',{type:'text',maxlength:'300',placeholder:'Comentário (ex.: esperando retorno do cliente)','aria-label':'Novo comentário'});
  const salvar=txt=>{
    const v=(txt||inp.value).trim(); if(!v){ inp.focus(); return; }
    mudar(t.id,{notas:(t.notas||[]).concat([novaNota(v)])});
    fecharNota();
  };
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); salvar(); } if(e.key==='Escape'){ e.preventDefault(); fecharNota(); } });
  return el('div',{class:'nova-nota'},[
    inp,
    el('div',{class:'sug'},SUGESTOES.map(x=>el('button',{type:'button',onclick:()=>salvar(x)},[x]))),
    el('div',{class:'linha'},[el('span',{class:'esp'}),el('button',{class:'sec',type:'button',onclick:fecharNota},['Cancelar']),el('button',{class:'prim',type:'button',onclick:()=>salvar()},['Comentar'])])
  ]);
}
function chipPrazo(iso,agora){
  const h=diaISO(agora);
  if(iso<h) return el('span',{class:'pprazo atr',text:'venceu '+ddmmISO(iso)});
  if(iso===h) return el('span',{class:'pprazo hj',text:'vence hoje'});
  const [y,m,d]=iso.split('-').map(Number);
  const sem=new Date(y,m-1,d).toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','');
  return el('span',{class:'pprazo',text:'vence '+sem+' '+ddmmISO(iso)});
}
function tagSetor(t){ return el('span',{class:'tag',style:'--sc:'+corSetor(t.setor)},[el('i'),nomeSetor(t.setor)]); }

function abrirEdicao(id,forcarStatus){
  if(editando&&editando!==id) descartarEdicao();
  const t=tarefas.find(x=>x.id===id);
  if(t) marcarVisto(t);
  comentando=null; editando=id; edAnexos={lista:((t&&t.anexos)||[]).map(a=>Object.assign({},a)),originais:((t&&t.anexos)||[]).map(a=>a.id),st:forcarStatus||(t&&t.status)||'hoje'};
  render();
  if(forcarStatus==='data'){ const d=document.querySelector('.edit input[type="date"]'); if(d){ d.focus(); try{ d.showPicker&&d.showPicker(); }catch(e){} } return; }
  const a=document.querySelector('.edit .editor');
  if(a){ a.focus(); const r=document.createRange(); r.selectNodeContents(a); r.collapse(false); const s=getSelection(); s.removeAllRanges(); s.addRange(r); }
}
// cancelar: apaga os PDFs enviados durante a edição que não chegaram a ser salvos
function descartarEdicao(){
  if(edAnexos) edAnexos.lista.forEach(a=>{ if(a.id&&!edAnexos.originais.includes(a.id)) soltarAsset(a.id); });
  edAnexos=null;
}
function fecharEdicao(){ descartarEdicao(); editando=null; render(); }

function cardEdicao(t){
  const area=el('div',{class:'editor',contenteditable:'true',role:'textbox','aria-label':'Texto da pendência',html:limpar(t.html)});
  area.addEventListener('paste',colarSoTexto);
  const sel=el('select',{'aria-label':'Setor'}); opcoesSetor(sel,t.setor||'');
  const data=el('input',{type:'date','aria-label':'Resolver até','title':'Resolver até',value:t.prazo||''});
  if(!edAnexos) edAnexos={lista:(t.anexos||[]).map(a=>Object.assign({},a)),originais:(t.anexos||[]).map(a=>a.id),st:t.status||'hoje'};
  const ea=edAnexos;
  data.hidden=ea.st!=='data';
  const seg=segmento(()=>ea.st,v=>{ ea.st=v; data.hidden=v!=='data'; if(v==='data'&&!data.value) data.focus(); });
  const boxAnexos=el('div');
  const pintarAnexos=()=>{ boxAnexos.textContent=''; const c=chipsAnexos(ea.lista,a=>{ ea.lista.splice(ea.lista.indexOf(a),1); pintarAnexos(); }); if(c) boxAnexos.appendChild(c); };
  pintarAnexos();
  const arq=el('input',{type:'file',accept:'application/pdf,.pdf',multiple:true,hidden:true});
  arq.addEventListener('change',()=>{ enviarPdfs(arq.files,ea.lista,pintarAnexos); arq.value=''; });
  const btnPdf=assets?el('button',{class:'fb pdf',type:'button',title:'Anexar PDF',html:ICON.clip+'PDF',onclick:()=>arq.click()}):null;
  const salvar=()=>{
    const st=ea.st;
    if(st==='data'&&!data.value){ aviso('Escolha até que dia resolver.'); data.focus(); return; }
    const ext=extrairCadastros(limpar(area.innerHTML));
    const html=ext.html; const texto=textoPuro(html);
    cadastrarClientes(ext.novos);
    if(!texto){ aviso('A pendência ficou vazia. Use excluir se quiser apagar.'); return; }
    if(ea.lista.some(a=>a.enviando)){ aviso('Espere o PDF terminar de enviar.'); return; }
    const manter=ea.lista.filter(a=>a.id).map(limparAnexo);
    const tirados=ea.originais.filter(id=>!manter.some(a=>a.id===id));
    const mud={html,texto,setor:sel.value,prazo:st==='data'?data.value:null,anexos:manter};
    if(st!==t.status){ mud.status=st; mud.statusEm=Date.now(); }
    if(temGrifo(html)&&!temGrifo(t.html)) mud.grifadoEm=Date.now();
    if(!temGrifo(html)) mud.grifadoEm=null;
    gravar(t.id,async()=>{ await ref(t.id).update(mud); tirados.forEach(soltarAsset); });
    edAnexos=null; editando=null; render();
  };
  teclasEditor(area,salvar,fecharEdicao);
  return el('div',{class:'edit'},[
    area,
    boxAnexos,
    arq,
    el('div',{class:'linha'},[barraFormatacao(area),btnPdf,el('span',{class:'esp'}),data,sel,seg]),
    el('div',{class:'linha'},[el('span',{class:'esp'}),el('button',{class:'sec',onclick:fecharEdicao},['Cancelar']),el('button',{class:'prim',onclick:salvar},['Salvar'])])
  ]);
}

function segmento(get,set){
  const box=el('div',{class:'seg',role:'group','aria-label':'Prazo'});
  const pintar=()=>box.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.s===get())));
  STATUS.forEach(s=>box.appendChild(el('button',{type:'button',class:'st-'+s.id,'data-s':s.id,title:s.titulo,onclick:()=>{set(s.id);pintar();}},[el('span',{class:'dot'}),s.curto])));
  pintar();
  box.pintar=pintar;
  return box;
}

/* ---------- nova pendência ---------- */
const novaTxt=$('novaTxt');
$('novaBarra').replaceWith(barraFormatacao(novaTxt));
function escolherStatusNova(v,semFoco){
  novaStatus=v; segNova.pintar();
  $('novaData').hidden=v!=='data';
  if(v==='data'&&!$('novaData').value&&!semFoco){ $('novaData').focus(); try{ $('novaData').showPicker&&$('novaData').showPicker(); }catch(e){} }
}
const segNova=segmento(()=>novaStatus,v=>{ manualStatus=true; escolherStatusNova(v); });
$('novaStatus').replaceWith(segNova);
$('novaData').hidden=true;
novaTxt.addEventListener('paste',colarSoTexto);

/* ---------- para quem, e quem acompanha ----------
   O botão diz para onde a pendência vai ("Para mim", "Para Ana",
   "Para 3 pessoas"). Abre uma lista da equipe em duas colunas de
   caixas: quem recebe (ganha a pendência no próprio quadro) e quem
   acompanha (vê e comenta, sem receber). */
function rotuloPara(){
  if(!novaPara.length) return 'Para mim';
  if(novaPara.length===1) return 'Para '+primeiroNome(novaPara[0]);
  return 'Para '+novaPara.length+' pessoas';
}
function pintarPara(){
  const b=$('novaPara'); if(!b) return;
  b.textContent=''; b.append(el('span',{class:'ico',text:'👤'}),rotuloPara()+(novaAcomp.length?' · '+novaAcomp.length+' acompanha'+(novaAcomp.length>1?'m':''):''));
  b.classList.toggle('on',!!(novaPara.length||novaAcomp.length));
  b.hidden=!colegas().length;
}
function listaPessoas(selecionadas,aoMudar,excluir){
  const box=el('div',{class:'pp-lista'});
  colegas().filter(p=>!excluir||!excluir.includes(p.uid)).forEach(p=>{
    const cb=el('input',{type:'checkbox'}); cb.checked=selecionadas.includes(p.uid);
    cb.addEventListener('change',()=>{ const i=selecionadas.indexOf(p.uid); if(cb.checked&&i<0) selecionadas.push(p.uid); if(!cb.checked&&i>=0) selecionadas.splice(i,1); aoMudar(); });
    box.appendChild(el('label',{class:'pp-item'},[cb,el('span',{class:'pp-ini',text:(p.nome||p.email||'?').charAt(0).toUpperCase()}),el('span',{class:'pp-nome'},[p.nome||p.email,(p.setores&&p.setores.length)?el('small',{text:' · '+p.setores.join(', ')}):null])]));
  });
  if(!box.children.length) box.appendChild(el('div',{class:'dica',text:'Ninguém mais na equipe.'}));
  return box;
}
function abrirPara(){
  const pop=$('pessoasPop'); if(!pop) return;
  if(!pop.hidden){ pop.hidden=true; return; }
  pop.textContent='';
  const refazer=()=>{ pintarPara(); };
  pop.appendChild(el('div',{class:'pp-col'},[el('h4',{text:'Quem recebe'}),el('div',{class:'dica',text:'Ganha a pendência no próprio quadro. Sem ninguém marcado, fica no seu.'}),listaPessoas(novaPara,refazer)]));
  pop.appendChild(el('div',{class:'pp-col'},[el('h4',{text:'Quem acompanha'}),el('div',{class:'dica',text:'Vê a pendência em "Acompanho" e pode comentar.'}),listaPessoas(novaAcomp,refazer)]));
  pop.appendChild(el('div',{class:'linha pp-pe'},[el('button',{class:'sec',type:'button',onclick:()=>{ novaPara=[]; novaAcomp=[]; pintarPara(); pop.hidden=true; }},['Só para mim']),el('span',{class:'esp'}),el('button',{class:'prim',type:'button',onclick:()=>{ pop.hidden=true; novaTxt.focus(); }},['Pronto'])]));
  pop.hidden=false;
}
if($('novaPara')) $('novaPara').addEventListener('click',abrirPara);
document.addEventListener('click',e=>{ const pop=$('pessoasPop'); if(pop&&!pop.hidden&&!pop.contains(e.target)&&e.target!==$('novaPara')&&!$('novaPara').contains(e.target)) pop.hidden=true; });

/* Cria a pendência onde ela tem de nascer: no meu quadro, ou no
   quadro de cada pessoa marcada (uma cópia por pessoa, com o mesmo
   loteId). Quem mandou assina; quem acompanha vai em envolvidos. */
function criarOnde(doc,para,acomp){
  const base=Object.assign({},doc,{envolvidos:(acomp||[]).filter(u=>u!==meuUid()),criadoPorNome:meuNome()||null,vistoEm:null,loteId:null});
  const destinos=(para||[]).filter(u=>u&&u!==meuUid());
  if(!destinos.length) return gravar('nova',()=>store.criarTarefa(base)).then(()=>({onde:'eu'}));
  const lote=destinos.length>1?('l'+Date.now().toString(36)):null;
  return gravar('nova',async()=>{
    for(const uid of destinos){ await store.criarTarefaEm(uid,Object.assign({},base,{loteId:lote,envolvidos:base.envolvidos.filter(u=>u!==uid)})); }
    aviso('Enviada para '+destinos.map(primeiroNome).join(', ')+'.');
    refrescarPessoas();
  }).then(()=>({onde:destinos}));
}

/* ---------- falar (ditado do aparelho) e entender prazo, data e setor pela frase ---------- */
const MESES=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const DSEM=['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
const escRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
let manualStatus=false, manualSetor=false, entenderOff=false, autoStatus=null, statusAntes=null, autoSetor=false;
function proximoDiaSemana(idx){ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+((idx-d.getDay()+7)%7)); return diaISO(d); }
function diaMes(dia,mes,ano){
  const h=new Date(); h.setHours(0,0,0,0);
  const y=ano?(ano<100?2000+ano:ano):h.getFullYear();
  let d=new Date(y,mes?mes-1:h.getMonth(),dia,12);
  if(!ano&&d<h) d=mes?new Date(y+1,mes-1,dia,12):new Date(y,h.getMonth()+1,dia,12);
  return d.getDate()===dia?diaISO(d):null;
}
function padroes(){
  const sNomes=setores.map(s=>escRe(norm(s.nome))).join('|')||'(?!)';
  return {
    setor:'(?:no|na|pro|pra|para o|para a|setor|do setor)\\s+(?:setor\\s+)?('+sNomes+')',
    dataNum:'(?:(?:ate|para|pra|no|vence|vencimento)\\s+)?(?:o\\s+)?(?:dia\\s+)?(\\d{1,2})(?:\\s*\\/\\s*(\\d{1,2})(?:\\s*\\/\\s*(\\d{2,4}))?|\\s+de\\s+('+MESES.join('|')+'))',
    dataDia:'(?:ate|para|pra|no|vence)\\s+(?:o\\s+)?dia\\s+(\\d{1,2})',
    diaSem:'(?:ate|para|pra|na|no)\\s+(?:a\\s+|o\\s+)?(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:[- ]feira)?',
    amanha:'(?:(?:ate|para|pra)\\s+)?amanha',
    hoje:'(?:(?:para|pra)\\s+)?hoje',
    hojeCorte:'(?:para|pra)\\s+hoje',
    semana:'(?:(?:ate|para|pra)\\s+(?:o\\s+fim\\s+d[ae]\\s+)?)?(?:essa|esta|nessa|nesta)\\s+semana',
    acomp:'acompanhar',
    acompCorte:'(?:para|pra)\\s+acompanhar'
  };
}
const B='(?<![\\p{L}\\p{N}])', E='(?![\\p{L}\\p{N}])';
function entender(t){
  const n=norm(t), P=padroes(), r={};
  const m=re=>n.match(new RegExp(B+re+E,'u'));
  let x;
  if((x=m(P.setor))){ const s=setores.find(s=>norm(s.nome)===x[1]); if(s) r.setor=s.id; }
  if(!r.setor){
    // palavras-chave de cada setor (Gerenciar setores); vale a que aparece primeiro na frase
    let melhor=null;
    setores.forEach(s=>(s.palavras||[]).forEach(p=>{
      const k=norm(p.trim()); if(k.length<2) return;
      let pk=escRe(k).replace(/\s+/g,'\\s+');
      pk=/ao$/.test(pk)?pk.slice(0,-2)+'(?:ao|oes|aes|aos)':/l$/.test(pk)?pk.slice(0,-1)+'(?:l|is)':/m$/.test(pk)?pk.slice(0,-1)+'(?:m|ns)':pk+'(?:e?s)?';
      const y=n.match(new RegExp(B+pk+E,'u'));
      if(y&&(!melhor||y.index<melhor.i)) melhor={i:y.index,id:s.id,p:p.trim()};
    }));
    if(melhor){ r.setor=melhor.id; r.palavra=melhor.p; }
  }
  let prazo=null;
  if((x=m(P.dataNum))) prazo=diaMes(+x[1],x[2]?+x[2]:(x[4]?MESES.indexOf(x[4])+1:null),x[3]?+x[3]:null);
  else if((x=m(P.dataDia))) prazo=diaMes(+x[1],null,null);
  else if((x=m(P.diaSem))) prazo=proximoDiaSemana(DSEM.indexOf(x[1]));
  else if(m(P.amanha)){ const d=new Date(); d.setDate(d.getDate()+1); prazo=diaISO(d); }
  if(prazo){ r.status='data'; r.prazo=prazo; }
  else if(m(P.hoje)) r.status='hoje';
  else if(m(P.semana)) r.status='semana';
  else if(m(P.acomp)) r.status='acompanhar';
  return r;
}
// tira do fim da frase os comandos ditados ("… até sexta no fiscal")
function cortarComandos(t,podeTudo){
  const P=padroes();
  const alts=[P.setor,P.dataNum,P.dataDia,P.diaSem,P.amanha,P.hojeCorte,P.semana,P.acompCorte].join('|');
  const re=new RegExp('[\\s,;.\\-]*(?:'+B+'e\\s+)?'+B+'(?:'+alts+')'+E+'[\\s.!,;]*$','u');
  let n=norm(t), out=t;
  if(n.length!==t.length) return t;
  for(let i=0;i<5;i++){ const x=n.match(re); if(!x||(x.index===0&&!podeTudo)) break; out=out.slice(0,x.index); n=n.slice(0,x.index); }
  return out.replace(/\s+$/,'');
}
function cortarNoEditor(){
  const nos=[]; const w=document.createTreeWalker(novaTxt,NodeFilter.SHOW_TEXT);
  while(w.nextNode()) if(w.currentNode.nodeValue.trim()) nos.push(w.currentNode);
  if(!nos.length) return;
  const ult=nos[nos.length-1], orig=ult.nodeValue.normalize('NFC');
  const novo=cortarComandos(orig,nos.length>1);
  if(novo!==orig) ult.nodeValue=novo;
}
function rotuloPrazo(r){
  if(r.prazo){ const [y,mm,d]=r.prazo.split('-').map(Number); return 'até '+new Date(y,mm-1,d).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'}).replace('.',''); }
  return (STATUS.find(s=>s.id===r.status)||{}).curto||'';
}
let entT;
function lerFrase(){
  const box=$('entendi');
  if(entenderOff){ box.hidden=true; return; }
  const r=entender(textoPuro(limpar(novaTxt.innerHTML)));
  // aplica só no que você não escolheu na mão
  if(!manualStatus){
    if(r.status){ if(autoStatus===null) statusAntes=novaStatus; if(r.prazo) $('novaData').value=r.prazo; escolherStatusNova(r.status,true); autoStatus=r.status; }
    else if(autoStatus!==null){ escolherStatusNova(statusAntes||'hoje',true); autoStatus=null; }
  }
  if(!manualSetor&&r.setor){ $('novaSetor').value=r.setor; autoSetor=true; }
  box.textContent='';
  if(!r.status&&!r.setor){ box.hidden=true; return; }
  box.hidden=false;
  box.append('Entendi:');
  if(r.status) box.appendChild(el('span',{class:'ch2 st-'+(r.status==='data'?'data':r.status)},[el('span',{class:'dot'}),rotuloPrazo(r)]));
  if(r.setor) box.appendChild(el('span',{class:'ch2',style:'--c-bg:var(--surface-2)'},[el('span',{class:'mono',style:'--sc:'+corSetor(r.setor)+';width:14px;height:14px;font-size:9px;border-radius:4px',text:nomeSetor(r.setor).charAt(0)}),nomeSetor(r.setor)+(r.palavra?' (por “'+r.palavra+'”)':'')]));
  box.appendChild(el('span',{class:'dica',text:'(o prazo e o setor saem do texto ao adicionar)'}));
  box.appendChild(el('button',{type:'button',onclick:()=>{ entenderOff=true; if(autoStatus!==null&&!manualStatus) escolherStatusNova(statusAntes||'hoje',true); autoStatus=null; box.hidden=true; }},['Ignorar']));
}
novaTxt.addEventListener('input',()=>{ clearTimeout(entT); entT=setTimeout(lerFrase,250); });
$('novaData').addEventListener('change',()=>{ manualStatus=true; });
function zerarEntendimento(){ manualStatus=false; manualSetor=false; entenderOff=false; autoStatus=null; autoSetor=false; $('entendi').hidden=true; }

// botão Falar: tenta o reconhecimento do navegador; se a página não puder usar o microfone, ensina o ditado do aparelho
const ua=navigator.userAgent||'';
function ajudaDitado(){
  const box=$('ditado'); box.textContent='';
  let como;
  if(/iPhone|iPad|iPod/.test(ua)) como='Toque no <b>microfone</b> no canto de baixo do teclado e fale.';
  else if(/Android/.test(ua)) como='Toque no <b>microfone</b> do teclado (no Gboard fica no alto, à direita) e fale.';
  else if(/Mac/.test(ua)) como='Aperte <kbd>Fn</kbd> duas vezes (ou a tecla de microfone) e fale.';
  else como='Aperte <kbd>Windows</kbd> + <kbd>H</kbd> e fale. Na primeira vez o Windows pode pedir para ligar a digitação por voz.';
  box.appendChild(el('div',{html:como+'<br>Diga a pendência e, no fim, o prazo e o setor. Ex.: “DAE da Empresa Alfa <b>até sexta no fiscal</b>”, “ligar pro cliente <b>hoje</b>”, “Empresa Beta <b>dia 30 de outubro no financeiro</b>”. O quadro entende e organiza.'}));
  box.appendChild(el('span',{class:'esp'}));
  box.appendChild(el('button',{class:'x',type:'button','aria-label':'Fechar dica',onclick:()=>{box.hidden=true;}},['×']));
  box.hidden=false;
}
let reconhecendo=null;
$('btnFalar').addEventListener('click',()=>{
  novaTxt.focus();
  const r=document.createRange(); r.selectNodeContents(novaTxt); r.collapse(false); const s=getSelection(); s.removeAllRanges(); s.addRange(r);
  if(reconhecendo){ try{ reconhecendo.stop(); }catch(e){} return; }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ ajudaDitado(); return; }
  try{
    const rec=new SR(); rec.lang='pt-BR'; rec.interimResults=false; rec.continuous=false;
    let ok=false;
    rec.onstart=()=>{ ok=true; reconhecendo=rec; $('btnFalar').classList.add('ouvindo'); };
    rec.onresult=e=>{ const t=Array.from(e.results).map(x=>x[0].transcript).join(' ').trim(); if(t){ novaTxt.focus(); document.execCommand('insertText',false,(novaTxt.textContent.trim()?' ':'')+t); lerFrase(); } };
    rec.onerror=()=>{ if(!ok) ajudaDitado(); };
    rec.onend=()=>{ reconhecendo=null; $('btnFalar').classList.remove('ouvindo'); };
    rec.start();
  }catch(e){ ajudaDitado(); }
});

function adicionar(){
  if(!db){ aviso('Sem conexão com o armazenamento. Recarregue a página.'); return; }
  lerFrase();
  if(!entenderOff&&($('entendi').hidden===false)) cortarNoEditor();
  if(novaStatus==='data'&&!$('novaData').value){ aviso('Escolha até que dia resolver.'); $('novaData').focus(); return; }
  const ext=extrairCadastros(limpar(novaTxt.innerHTML));
  const html=ext.html; const texto=textoPuro(html);
  cadastrarClientes(ext.novos);
  if(!texto){ novaTxt.focus(); if(ext.novos.length){ novaTxt.innerHTML=''; return; } if(novosAnexos.length) aviso('Escreva a pendência antes de adicionar.'); return; }
  if(novosAnexos.some(a=>a.enviando)){ aviso('Espere o PDF terminar de enviar.'); return; }
  const anexos=novosAnexos.filter(a=>a.id).map(limparAnexo);
  novosAnexos=[]; pintarNovosAnexos();
  const agora=Date.now();
  const doc={html,texto,setor:$('novaSetor').value,status:novaStatus,importante:false,feito:false,feitoEm:null,criadoEm:agora,statusEm:agora,grifadoEm:temGrifo(html)?agora:null,revisadoEm:null,prazo:novaStatus==='data'?$('novaData').value:null,anexos,criadoPor:(store&&store.usuario&&store.usuario.email)||null};
  novaTxt.innerHTML='';
  $('novaData').value=diaFiltro||'';
  if(autoStatus!==null) escolherStatusNova(statusAntes||'hoje',true);
  if(autoSetor) $('novaSetor').dataset.escolhido='';
  zerarEntendimento();
  const para=novaPara.slice(), acomp=novaAcomp.slice();
  novaPara=[]; novaAcomp=[]; pintarPara();
  criarOnde(doc,para,acomp);
  if(colMobile!==novaStatus){ colMobile=novaStatus; try{localStorage.setItem('pend.col',novaStatus)}catch(e){} }
  novaTxt.focus();
}
$('btnAdd').addEventListener('click',adicionar);
function pintarNovosAnexos(){
  const box=$('novosAnexos'); box.textContent='';
  const c=chipsAnexos(novosAnexos,a=>{ novosAnexos.splice(novosAnexos.indexOf(a),1); soltarAsset(a.id); pintarNovosAnexos(); });
  box.hidden=!c; if(c) while(c.firstChild) box.appendChild(c.firstChild);
}
$('btnPdf').innerHTML=ICON.clip+'PDF';
$('btnPdf').addEventListener('click',()=>$('arqPdf').click());
$('arqPdf').addEventListener('change',e=>{ enviarPdfs(e.target.files,novosAnexos,pintarNovosAnexos); e.target.value=''; });
(function(){
  const zona=document.querySelector('.nova'); let n=0;
  const temArquivo=e=>e.dataTransfer&&Array.from(e.dataTransfer.types||[]).includes('Files');
  zona.addEventListener('dragenter',e=>{ if(!temArquivo(e)||!assets) return; e.preventDefault(); n++; zona.classList.add('arrastando'); });
  zona.addEventListener('dragover',e=>{ if(temArquivo(e)&&assets) e.preventDefault(); });
  zona.addEventListener('dragleave',()=>{ if(--n<=0){ n=0; zona.classList.remove('arrastando'); } });
  zona.addEventListener('drop',e=>{ if(!temArquivo(e)) return; e.preventDefault(); n=0; zona.classList.remove('arrastando'); enviarPdfs(e.dataTransfer.files,novosAnexos,pintarNovosAnexos); });
})();
$('novaSetor').addEventListener('change',e=>{ e.target.dataset.escolhido='1'; manualSetor=true; });
teclasEditor(novaTxt,adicionar);
$('pendBusca').addEventListener('input',e=>{ busca=e.target.value; agendar(); });

/* ---------- calendário ---------- */
const DS=['D','S','T','Q','Q','S','S'];
const DS_LONGO=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const ICAL={
  ant:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>',
  prox:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
  mes:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v11M15 10v11M3 15.5h18"/></svg>',
  semana:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="8" rx="2"/><path d="M9 8v8M15 8v8"/></svg>',
  ampliar:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>'
};
function diasDoMes(ref){
  const p=new Date(ref.getFullYear(),ref.getMonth(),1);
  const ini=new Date(p); ini.setDate(1-p.getDay());
  let dias=[];
  for(let i=0;i<42;i++){ const d=new Date(ini); d.setDate(ini.getDate()+i); dias.push(d); }
  while(dias.length>28 && dias[dias.length-7].getMonth()!==p.getMonth()) dias=dias.slice(0,-7);
  return dias;
}
function diasDaSemana(ref){
  const ini=new Date(ref); ini.setDate(ref.getDate()-ref.getDay());
  return Array.from({length:7},(_,i)=>{ const d=new Date(ini); d.setDate(ini.getDate()+i); return d; });
}
function doDia(iso){
  return tarefas.filter(t=>t.prazo===iso&&noSetor(t))
    .sort((a,b)=>(a.feito?1:0)-(b.feito?1:0)||(b.importante?1:0)-(a.importante?1:0)||(a.criadoEm||0)-(b.criadoEm||0));
}
function pontos(iso,hoje){
  const cls=[];
  doDia(iso).forEach(t=>{
    const c=t.feito?'pt-feito':(iso<hoje?'st-hoje':'st-'+(t.status||'hoje'));
    if(!cls.includes(c)) cls.push(c);
  });
  return el('span',{class:'pts'},cls.slice(0,4).map(c=>el('i',{class:c})));
}
function mudarRef(delta,modo){
  if(modo==='mes') calRef=new Date(calRef.getFullYear(),calRef.getMonth()+delta,1);
  else { const d=new Date(calRef); d.setDate(d.getDate()+7*delta); calRef=d; }
}
function renderCal(){
  const box=$('cal'); box.textContent='';
  const hoje=diaISO(Date.now());
  const dias=calModo==='mes'?diasDoMes(calRef):diasDaSemana(calRef);
  const mesRef=calModo==='mes'?calRef.getMonth():null;
  const titulo=(calModo==='mes'?calRef:dias[3]).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  // fora do mês (ou da semana) de hoje, um atalho pequeno para voltar
  const agoraD=new Date();
  const foraDeHoje=calModo==='mes'?(calRef.getMonth()!==agoraD.getMonth()||calRef.getFullYear()!==agoraD.getFullYear()):!dias.some(d=>diaISO(d)===hoje);
  box.appendChild(el('div',{class:'cal-h'},[
    el('button',{class:'mes',type:'button',title:'Voltar para hoje',onclick:()=>{calRef=new Date();render();}},[titulo]),
    foraDeHoje?el('button',{class:'volta',type:'button',title:'Voltar para hoje',onclick:()=>{calRef=new Date();render();}},['hoje']):null,
    el('button',{class:'cb',type:'button','aria-label':'Anterior',title:'Anterior',html:ICAL.ant,onclick:()=>{mudarRef(-1,calModo);render();}}),
    el('button',{class:'cb',type:'button','aria-label':'Próximo',title:'Próximo',html:ICAL.prox,onclick:()=>{mudarRef(1,calModo);render();}}),
    el('button',{class:'cb',type:'button','aria-label':calModo==='mes'?'Mostrar só a semana':'Mostrar o mês',title:calModo==='mes'?'Mostrar só a semana':'Mostrar o mês',html:calModo==='mes'?ICAL.semana:ICAL.mes,onclick:()=>{calModo=calModo==='mes'?'semana':'mes';try{localStorage.setItem('pend.calModo',calModo)}catch(e){};render();}}),
    el('button',{class:'cb',type:'button','aria-label':'Ampliar calendário',title:'Ampliar calendário',html:ICAL.ampliar,onclick:abrirGrande})
  ]));
  const g=el('div',{class:'cg'});
  DS.forEach(d=>g.appendChild(el('span',{class:'wd',text:d})));
  dias.forEach(d=>{
    const iso=diaISO(d);
    const cls='cd'+(mesRef!==null&&d.getMonth()!==mesRef?' fora':'')+(iso===hoje?' hj':'')+(iso===diaFiltro?' sel':'');
    g.appendChild(el('button',{class:cls,type:'button','aria-label':rotuloDia(iso),'aria-pressed':String(iso===diaFiltro),onclick:()=>{diaFiltro=diaFiltro===iso?null:iso;$('novaData').value=diaFiltro||'';render();}},[String(d.getDate()),pontos(iso,hoje)]));
  });
  box.appendChild(g);
}

function abrirGrande(){ calSel=diaFiltro||diaISO(Date.now()); $('calg').hidden=false; document.body.style.overflow='hidden'; renderGrande(); }
function fecharGrande(){ $('calg').hidden=true; document.body.style.overflow=''; }
function novaNoDia(iso){ fecharGrande(); $('novaData').value=iso; escolherStatusNova('data'); novaTxt.focus(); novaTxt.scrollIntoView({block:'center'}); }
function renderGrande(){
  const box=$('calg'); box.textContent='';
  const hoje=diaISO(Date.now());
  const dias=diasDoMes(calRef), mes=calRef.getMonth();
  const inner=el('div',{class:'calg-in'});
  inner.appendChild(el('div',{class:'calg-h'},[
    el('h2',{text:calRef.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}),
    el('button',{class:'ic',type:'button','aria-label':'Mês anterior',html:ICAL.ant,onclick:()=>{mudarRef(-1,'mes');renderGrande();renderCal();}}),
    el('button',{class:'ic',type:'button','aria-label':'Próximo mês',html:ICAL.prox,onclick:()=>{mudarRef(1,'mes');renderGrande();renderCal();}}),
    el('button',{class:'sec',type:'button',onclick:()=>{calRef=new Date();calSel=hoje;renderGrande();renderCal();}},['Hoje']),
    el('span',{class:'esp'}),
    setorAtivo!=='todos'?el('span',{class:'dica',text:'Setor: '+(setorAtivo===SEM?'Sem setor':nomeSetor(setorAtivo))}):null,
    el('button',{class:'prim',type:'button',onclick:fecharGrande},['Fechar'])
  ]));
  const g=el('div',{class:'gg'});
  DS_LONGO.forEach(d=>g.appendChild(el('span',{class:'wd',text:d})));
  dias.forEach(d=>{
    const iso=diaISO(d); const lista=doDia(iso);
    const cel=el('div',{class:'gc'+(d.getMonth()!==mes?' fora':'')+(iso===hoje?' hj':'')+(iso===calSel?' sel':''),role:'button',tabindex:'0','aria-label':rotuloDia(iso)+(lista.length?', '+lista.length+' pendências':'')});
    const escolher=()=>{ calSel=iso; renderGrande(); const a=$('calg').querySelector('.agenda'); if(a&&window.innerWidth<900) a.scrollIntoView({block:'nearest'}); };
    cel.addEventListener('click',escolher);
    cel.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); escolher(); } });
    cel.appendChild(el('div',{class:'n'},[String(d.getDate()),el('button',{class:'mais',type:'button',title:'Nova pendência neste dia','aria-label':'Nova pendência neste dia',onclick:e=>{e.stopPropagation();novaNoDia(iso);}},['+'])]));
    lista.slice(0,3).forEach(t=>cel.appendChild(el('span',{class:'ch '+(t.feito?'ok pt-feito ':'')+'st-'+(t.status||'hoje'),text:textoPuro(limpar(t.html)).split('\n')[0]})));
    if(lista.length>3) cel.appendChild(el('span',{class:'resto',text:'+ '+(lista.length-3)+' mais'}));
    cel.appendChild(pontos(iso,hoje));
    g.appendChild(cel);
  });
  inner.appendChild(g);

  // agenda do dia escolhido
  const lista=doDia(calSel);
  const ag=el('section',{class:'pagenda'},[
    el('div',{class:'linha'},[
      el('h3',{text:rotuloDia(calSel)}),
      el('span',{class:'esp'}),
      el('button',{class:'sec',type:'button',onclick:()=>novaNoDia(calSel)},['+ Nova neste dia']),
      lista.length?el('button',{class:'sec',type:'button',onclick:()=>{diaFiltro=calSel;fecharGrande();render();}},['Ver no quadro']):null
    ])
  ]);
  if(!lista.length) ag.appendChild(el('div',{class:'dica',text:'Nenhuma pendência com esta data. Use “+ Nova neste dia” ou coloque a data ao criar ou editar uma pendência.'}));
  lista.forEach(t=>{
    const st='st-'+(t.status||'hoje');
    ag.appendChild(el('div',{class:'ag '+st+(t.feito?' feito':'')},[
      el('button',{class:'chk',type:'button',title:t.feito?'Desfazer risco':'Riscar (feito)','aria-label':t.feito?'Desfazer risco':'Riscar como feito',html:ICON.check,onclick:()=>mudar(t.id,t.feito?{feito:false,feitoEm:null}:{feito:true,feitoEm:Date.now(),revisadoEm:null})}),
      el('div',{},[txtEl('txt'+(t.feito?' ok':''),t),chipsAnexos(t.anexos),el('div',{class:'meta',style:'margin-top:3px'},[tagSetor(t),el('span',{class:'desde',text:STATUS.find(s=>s.id===(t.status||'hoje')).titulo})])]),
      t.feito?null:el('button',{class:'ic',type:'button',title:'Editar','aria-label':'Editar',html:ICON.edit,onclick:()=>{fecharGrande();diaFiltro=null;colMobile=t.status||'hoje';abrirEdicao(t.id);}})
    ]));
  });
  inner.appendChild(ag);
  box.appendChild(inner);
}
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('calg').hidden&&$('veu').hidden) fecharGrande(); });

/* ---------- visualizador de PDF: o do próprio navegador, num quadro ao lado ----------
   Antes era o pdf.js vindo de uma CDN. O Hub não carrega script de
   fora, e o Chrome e o Edge já trazem um leitor de PDF com zoom,
   busca e impressão. O arquivo é buscado com a sessão de quem
   clicou e entregue ao leitor por um endereço temporário desta aba. */
let pdfAtual=null, pdfUrl=null;
const pend=()=>document.querySelector('.pend');
$('pdfAmpliar').innerHTML=ICAL.ampliar;
$('pdfAba').innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>';
async function abrirPdf(a){
  const box=$('pdfv'); box.hidden=false; pend().classList.add('com-pdf');
  $('pdfNome').textContent=a.nome||'PDF'; $('pdfInfo').textContent='Carregando…';
  $('pdfAba').href=urlArquivo(a.id); $('pdfAba').dataset.arq=a.id;
  const corpo=$('pdfCorpo'); corpo.textContent='';
  const meu={}; pdfAtual=meu;
  try{
    const b=await assets.ler(a.id);
    if(pdfAtual!==meu) return;
    if(pdfUrl) URL.revokeObjectURL(pdfUrl);
    pdfUrl=URL.createObjectURL(b.type==='application/pdf'?b:new Blob([b],{type:'application/pdf'}));
    corpo.appendChild(el('iframe',{class:'pdf-quadro',title:a.nome||'PDF',src:pdfUrl+'#navpanes=0'}));
    $('pdfInfo').textContent=tamanho(a.tam||b.size);
  }catch(e){
    if(pdfAtual!==meu) return;
    $('pdfInfo').textContent='';
    corpo.appendChild(el('div',{class:'msg'},['Não consegui mostrar este PDF aqui.',el('a',{class:'sec',href:urlArquivo(a.id),'data-arq':a.id,target:'_blank',rel:'noopener',style:'display:inline-flex;align-items:center;text-decoration:none'},['Abrir em nova aba'])]));
  }
}
function fecharPdf(){
  pdfAtual=null; $('pdfv').hidden=true; $('pdfv').classList.remove('grande'); pend().classList.remove('com-pdf');
  $('pdfCorpo').textContent='';
  if(pdfUrl){ URL.revokeObjectURL(pdfUrl); pdfUrl=null; }
}
$('pdfFechar').addEventListener('click',fecharPdf);
$('pdfAmpliar').addEventListener('click',()=>{
  const g=$('pdfv').classList.toggle('grande');
  $('pdfAmpliar').title=g?'Voltar para o lado':'Ampliar para a tela toda';
  $('pdfAmpliar').setAttribute('aria-label',g?'Voltar para o lado':'Ampliar');
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('pdfv').hidden&&$('veu').hidden){ e.stopImmediatePropagation(); fecharPdf(); } },true);

/* ---------- clientes: reconhecer nomes e mostrar o CNPJ ---------- */
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const soDoc=s=>(s||'').replace(/[^0-9A-Za-z]/g,'').toUpperCase();
function fmtDoc(d){
  d=soDoc(d);
  if(d.length===14) return d.slice(0,2)+'.'+d.slice(2,5)+'.'+d.slice(5,8)+'/'+d.slice(8,12)+'-'+d.slice(12);
  if(d.length===11) return d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6,9)+'-'+d.slice(9);
  return d;
}
const rotDoc=d=>soDoc(d).length===11?'CPF':'CNPJ';
// vale para o CNPJ numérico e para o alfanumérico (letras valem código ASCII − 48)
function cnpjValido(c){
  c=soDoc(c);
  if(!/^[0-9A-Z]{12}[0-9]{2}$/.test(c)||/^(\d)\1+$/.test(c)) return false;
  const dv=(base,pesos)=>{ let s=0; for(let i=0;i<base.length;i++) s+=(base.charCodeAt(i)-48)*pesos[i]; const r=s%11; return r<2?0:11-r; };
  const d1=dv(c.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2]);
  const d2=dv(c.slice(0,12)+d1,[6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return c.slice(12)===''+d1+d2;
}
const docOk=d=>{ d=soDoc(d); return d.length===11||cnpjValido(d); };

let matcher=null;
function montarMatcher(){
  const mapa=new Map();
  clientes.forEach(c=>{
    [c.nome].concat(c.apelidos||[]).forEach(a=>{
      const k=norm((a||'').trim()).replace(/\s+/g,' ');
      if(k.length<2) return;
      if(!mapa.has(k)) mapa.set(k,[]);
      if(!mapa.get(k).includes(c.id)) mapa.get(k).push(c.id);
    });
  });
  if(!mapa.size){ matcher=null; return; }
  const chaves=[...mapa.keys()].sort((a,b)=>b.length-a.length).map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ /g,'\\s+'));
  matcher={mapa,re:new RegExp('(?<![\\p{L}\\p{N}])(?:'+chaves.join('|')+')(?![\\p{L}\\p{N}])','gu')};
}
function realcar(raiz){
  if(!matcher||!raiz) return raiz;
  const nos=[]; const w=document.createTreeWalker(raiz,NodeFilter.SHOW_TEXT);
  while(w.nextNode()) nos.push(w.currentNode);
  nos.forEach(n=>{
    const orig=n.nodeValue.normalize('NFC'); const nt=norm(orig);
    if(nt.length!==orig.length) return;
    matcher.re.lastIndex=0;
    let m, ult=0, frag=null;
    while((m=matcher.re.exec(nt))){
      if(!m[0]){ matcher.re.lastIndex++; continue; }
      frag=frag||document.createDocumentFragment();
      if(m.index>ult) frag.appendChild(document.createTextNode(orig.slice(ult,m.index)));
      const ids=matcher.mapa.get(m[0].replace(/\s+/g,' '))||[];
      frag.appendChild(el('span',{class:'cli',tabindex:'0','data-cli':ids.join(','),text:orig.slice(m.index,m.index+m[0].length)}));
      ult=m.index+m[0].length;
    }
    if(frag){ if(ult<orig.length) frag.appendChild(document.createTextNode(orig.slice(ult))); n.replaceWith(frag); }
  });
  return raiz;
}
const txtEl=(cls,t,extra)=>realcar(el('div',Object.assign({class:cls,html:limpar(t.html)},extra||{})));

function salvarClientes(lista){ return gravar('clientes',()=>store.salvarConfig('clientes',{lista})); }
function nomeBonito(s){
  const pequenas=['de','da','do','das','dos','e'];
  return s.trim().toLowerCase().replace(/\s+/g,' ').split(' ').map((p,i)=>i&&pequenas.includes(p)?p:p.charAt(0).toUpperCase()+p.slice(1)).join(' ');
}
// "(Empresa Alfa é uma empresa que o CNPJ é 12.345.678/0001-95)" dentro da pendência
const RE_CAD=/\(\s*([^()]{2,80}?)\s+(?:é|e)\s+(?:uma\s+|a\s+)?(?:empresa\s+)?(?:que\s+|cujo\s+|com\s+|de\s+)?(?:o\s+)?cnpj\s*(?:é|e|:|=)?\s*([0-9A-Za-z][0-9A-Za-z.\/\-\s]{10,22}?)\s*\)/gi;
function extrairCadastros(html){
  const novos=[];
  const out=html.replace(/&nbsp;/g,' ').replace(RE_CAD,(m,nome,doc)=>{
    const d=soDoc(doc); const n=textoPuro(nome).trim();
    if((d.length!==14&&d.length!==11)||!n) return m;
    novos.push({nome:n,cnpj:d}); return '';
  });
  return {html:novos.length?limpar(out.replace(/ {2,}/g,' ').replace(/ +(<br>|$)/g,'$1')):html,novos};
}
function cadastrarClientes(novos){
  if(!novos.length) return;
  const lista=clientes.map(c=>Object.assign({},c,{apelidos:(c.apelidos||[]).slice()}));
  novos.forEach(nv=>{
    const ex=lista.find(c=>soDoc(c.cnpj)===nv.cnpj);
    if(ex){ if(!ex.apelidos.some(a=>norm(a)===norm(nv.nome))&&norm(ex.nome)!==norm(nv.nome)) ex.apelidos.push(nv.nome); }
    else lista.push({id:'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),nome:nomeBonito(nv.nome),cnpj:nv.cnpj,apelidos:[nv.nome]});
    aviso(nomeBonito(nv.nome)+' gravada: '+rotDoc(nv.cnpj)+' '+fmtDoc(nv.cnpj)+(docOk(nv.cnpj)?'':' (confira: o dígito não bate)'));
  });
  salvarClientes(lista);
}

/* cartão que aparece ao passar o mouse ou tocar no nome */
const pop=$('popCli'); let popAlvo=null, popT=null, popFixo=false;
const temHover=window.matchMedia&&matchMedia('(hover: hover)').matches;
function copiar(txt,btn){
  const ok=()=>{ btn.textContent='Copiado'; setTimeout(()=>{btn.textContent='Copiar';},1500); };
  try{ navigator.clipboard.writeText(txt).then(ok,()=>aviso('Selecione o número e copie com Ctrl+C.')); }catch(e){ aviso('Selecione o número e copie com Ctrl+C.'); }
}
function mostrarPop(span,fixo){
  const lista=(span.dataset.cli||'').split(',').map(id=>clientes.find(c=>c.id===id)).filter(Boolean);
  if(!lista.length) return;
  clearTimeout(popT); popAlvo=span; popFixo=!!fixo;
  pop.textContent='';
  if(lista.length>1) pop.appendChild(el('div',{class:'dica',text:lista.length+' empresas com esse nome:'}));
  lista.forEach(c=>pop.appendChild(el('div',{class:'pc'},[
    el('div',{class:'pn',text:c.nome}),
    infoCli(c)?el('div',{class:'dica',style:'margin-top:2px',text:infoCli(c)}):null,
    el('div',{class:'pd'},[el('span',{class:'rot2',text:rotDoc(c.cnpj)}),el('span',{class:'num',text:fmtDoc(c.cnpj)}),
      el('button',{class:'sec mini',type:'button',onclick:e=>{ e.stopPropagation(); copiar(fmtDoc(c.cnpj),e.currentTarget); }},['Copiar'])])
  ])));
  pop.appendChild(el('button',{class:'lnk',type:'button',onclick:()=>{ esconderPop(true); abrirClientes(lista[0].id); }},['Editar cadastro']));
  pop.hidden=false;
  const r=span.getBoundingClientRect(), w=pop.offsetWidth, h=pop.offsetHeight;
  const x=Math.min(Math.max(8,r.left),window.innerWidth-w-8);
  let y=r.bottom+6; if(y+h>window.innerHeight-8) y=r.top-h-6;
  pop.style.left=x+'px'; pop.style.top=Math.max(8,y)+'px';
}
function infoCli(c){
  return [c.cod?'Cód. '+c.cod:'',c.regime||'',c.cidade||'',c.contato?'Contato: '+c.contato:''].filter(Boolean).join(' · ');
}
function esconderPop(ja){
  clearTimeout(popT);
  const f=()=>{ pop.hidden=true; popAlvo=null; popFixo=false; };
  if(ja) f(); else popT=setTimeout(f,250);
}
document.addEventListener('mouseover',e=>{
  if(!temHover||!e.target.closest) return;
  const s=e.target.closest('.cli');
  if(s){ if(popAlvo!==s&&!popFixo) mostrarPop(s,false); else clearTimeout(popT); }
  else if(e.target.closest('#popCli')) clearTimeout(popT);
});
document.addEventListener('mouseout',e=>{
  if(!temHover||popFixo||!e.target.closest) return;
  if(e.target.closest('.cli')||e.target.closest('#popCli')) esconderPop(false);
});
document.addEventListener('click',e=>{
  const s=e.target.closest&&e.target.closest('.cli');
  if(s){ e.preventDefault(); e.stopPropagation(); mostrarPop(s,true); return; }
  if(!pop.hidden&&!(e.target.closest&&e.target.closest('#popCli'))) esconderPop(true);
},true);
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target.classList&&e.target.classList.contains('cli')){ e.preventDefault(); mostrarPop(e.target,true); }
  if(e.key==='Escape'&&!pop.hidden) esconderPop(true);
});
window.addEventListener('scroll',()=>{ if(!pop.hidden) esconderPop(true); },true);

/* painel de clientes */
let cliEditando=null;
function abrirClientes(id,nomeSugerido){
  $('veuCli').hidden=false; $('cliBusca').value='';
  preencherFormCli(id?clientes.find(c=>c.id===id):null,nomeSugerido);
  desenharClientes();
  (id||nomeSugerido?$('cliDoc'):$('cliNome')).focus();
}
function preencherFormCli(c,nomeSugerido){
  cliEditando=c?c.id:null;
  $('cliNome').value=c?c.nome:(nomeSugerido?nomeBonito(nomeSugerido):'');
  $('cliDoc').value=c?fmtDoc(c.cnpj):'';
  $('cliAp').value=c?(c.apelidos||[]).join(', '):(nomeSugerido||'');
  $('cliSalvar').textContent=c?'Salvar alteração':'Cadastrar';
  $('cliCancelar').hidden=!c;
  // cliente da casa: nome e CNPJ são da administração do Hub; aqui só os apelidos
  const daCasa=!!(c&&c.daCasa);
  $('cliNome').readOnly=daCasa; $('cliDoc').readOnly=daCasa;
  $('cliAviso').textContent=daCasa?'Cliente da casa: o nome e o CNPJ vêm da administração do Hub. Aqui você só muda os apelidos.':''; $('cliAviso').className='dica';
}
function desenharClientes(){
  const q=norm($('cliBusca').value.trim()), qd=soDoc($('cliBusca').value);
  const box=$('lsCli'); box.textContent='';
  const lista=clientes.filter(c=>!q||norm(c.nome).includes(q)||(c.apelidos||[]).some(a=>norm(a).includes(q))||(qd&&soDoc(c.cnpj).includes(qd))||c.cod===$('cliBusca').value.trim())
    .sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  if(!lista.length) box.appendChild(el('div',{class:'dica',style:'padding:12px 2px',text:clientes.length?'Nenhum cliente encontrado.':'Nenhum cliente cadastrado ainda.'}));
  lista.forEach(c=>{
    const ap=(c.apelidos||[]).filter(a=>norm(a)!==norm(c.nome));
    box.appendChild(el('div',{class:'ic-cli'},[
      el('div',{class:'n',text:c.nome}),
      el('div',{class:'bts'},[
        el('button',{class:'sec mini',type:'button',onclick:()=>{ preencherFormCli(c); (c.daCasa?$('cliAp'):$('cliDoc')).focus(); }},[c.daCasa?'Apelidos':'Editar']),
        c.daCasa?el('span',{class:'dica',text:'da casa'}):botaoConfirmar('Excluir','Excluir?',()=>salvarClientes(clientes.filter(x=>x.id!==c.id)),'sec mini')
      ]),
      el('div',{class:'d',text:rotDoc(c.cnpj)+' '+fmtDoc(c.cnpj)+(c.regime?' · '+c.regime:'')+(c.cidade?' · '+c.cidade:'')+(c.cod?' · cód. '+c.cod:'')+(ap.length?' · também: '+ap.join(', '):'')})
    ]));
  });
}
$('formCli').addEventListener('submit',e=>{
  e.preventDefault();
  if(!db){ aviso('Sem conexão com o armazenamento. Recarregue a página.'); return; }
  const nome=$('cliNome').value.trim(), d=soDoc($('cliDoc').value);
  const av=$('cliAviso');
  if(!nome){ av.textContent='Escreva o nome da empresa.'; av.className='dica aviso-doc'; $('cliNome').focus(); return; }
  if(d.length!==14&&d.length!==11){ av.textContent='O CNPJ precisa ter 14 caracteres (ou 11 se for CPF).'; av.className='dica aviso-doc'; $('cliDoc').focus(); return; }
  const outro=clientes.find(c=>soDoc(c.cnpj)===d&&c.id!==cliEditando);
  if(outro){ av.textContent='Esse CNPJ já está cadastrado em '+outro.nome+'.'; av.className='dica aviso-doc'; return; }
  const apelidos=$('cliAp').value.split(',').map(s=>s.trim()).filter(Boolean).filter((a,i,arr)=>arr.findIndex(b=>norm(b)===norm(a))===i);
  const antigo=cliEditando?clientes.find(c=>c.id===cliEditando):null;
  const reg=Object.assign({},antigo||{},{id:cliEditando||('c'+Date.now().toString(36)),nome:antigo&&antigo.daCasa?antigo.nome:nome,cnpj:antigo&&antigo.daCasa?antigo.cnpj:d,apelidos});
  salvarClientes(cliEditando?clientes.map(c=>c.id===cliEditando?reg:c):clientes.concat([reg]));
  aviso((cliEditando?'Alterado: ':'Cadastrado: ')+nome+(docOk(d)?'':' (confira o CNPJ: o dígito não bate)'));
  preencherFormCli(null);
});
$('cliDoc').addEventListener('blur',()=>{ const d=soDoc($('cliDoc').value); if(d.length===14||d.length===11){ $('cliDoc').value=fmtDoc(d); const av=$('cliAviso'); if(!docOk(d)){ av.textContent='Confira o CNPJ: o dígito verificador não bate.'; av.className='dica aviso-doc'; } else { av.textContent=''; av.className='dica'; } } });
$('cliCancelar').addEventListener('click',()=>preencherFormCli(null));
$('cliBusca').addEventListener('input',desenharClientes);
$('btnClientes').addEventListener('click',()=>abrirClientes());
$('fechaCli').addEventListener('click',()=>{ $('veuCli').hidden=true; });
$('veuCli').addEventListener('click',e=>{ if(e.target.id==='veuCli') $('veuCli').hidden=true; });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('veuCli').hidden) $('veuCli').hidden=true; });

/* ---------- painel de setores ---------- */
function abrirSetores(){ desenharSetores(); $('veu').hidden=false; $('novoSetor').focus(); }
$('fechaVeu').addEventListener('click',()=>{$('veu').hidden=true;});
$('veu').addEventListener('click',e=>{ if(e.target.id==='veu') $('veu').hidden=true; });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('veu').hidden) $('veu').hidden=true; });
function desenharSetores(){
  const box=$('lsSetores'); box.textContent='';
  if(!setores.length) box.appendChild(el('div',{class:'dica',text:'Nenhum setor ainda. Crie o primeiro abaixo.'}));
  setores.forEach((s,i)=>{
    const inp=el('input',{value:s.nome,'aria-label':'Nome do setor'});
    inp.addEventListener('change',()=>{ const v=inp.value.trim(); if(!v||v===s.nome) return; salvarSetores(setores.map(x=>x.id===s.id?Object.assign({},x,{nome:v}):x)); });
    const mover=d=>{ const l=setores.slice(); const j=i+d; if(j<0||j>=l.length) return; [l[i],l[j]]=[l[j],l[i]]; salvarSetores(l); };
    const n=tarefas.filter(t=>t.setor===s.id).length;
    const cores=el('div',{class:'cores',role:'group','aria-label':'Cor do setor'});
    PALETA.forEach(c=>cores.appendChild(el('button',{class:'cor',type:'button',style:'--sc:var(--sc-'+c+')','aria-label':'Cor '+c,'aria-pressed':String((s.cor||'cinza')===c),onclick:()=>salvarSetores(setores.map(x=>x.id===s.id?Object.assign({},x,{cor:c}):x))})));
    const pal=el('input',{value:(s.palavras||[]).join(', '),placeholder:'Palavras que já puxam este setor, separadas por vírgula','aria-label':'Palavras-chave do setor '+s.nome});
    pal.addEventListener('change',()=>{ const lista=pal.value.split(',').map(p=>p.trim()).filter(Boolean).filter((p,i,a)=>a.findIndex(q=>norm(q)===norm(p))===i); salvarSetores(setores.map(x=>x.id===s.id?Object.assign({},x,{palavras:lista}):x)); aviso('Palavras do setor '+s.nome+' salvas.'); });
    box.appendChild(el('div',{class:'it'},[
      el('div',{class:'r1'},[
        inp,
        el('button',{class:'ic',title:'Subir','aria-label':'Subir',html:ICON.up,onclick:()=>mover(-1)}),
        el('button',{class:'ic',title:'Descer','aria-label':'Descer',html:ICON.down,onclick:()=>mover(1)}),
        botaoConfirmar('Excluir',n?'Excluir? ('+n+')':'Excluir?',()=>{
          tarefas.filter(t=>t.setor===s.id).forEach(t=>mudar(t.id,{setor:''}));
          salvarSetores(setores.filter(x=>x.id!==s.id));
        },'sec')
      ]),
      cores,
      pal
    ]));
  });
}
function criarSetor(){
  const v=$('novoSetor').value.trim(); if(!v) return;
  if(!db){ aviso('Sem conexão com o armazenamento. Recarregue a página.'); return; }
  if(setores.some(s=>s.nome.toLowerCase()===v.toLowerCase())){ aviso('Esse setor já existe.'); return; }
  const usadas=setores.map(s=>s.cor);
  const cor=PALETA.find(c=>!usadas.includes(c))||'cinza';
  salvarSetores(setores.concat([{id:'s'+Date.now().toString(36),nome:v,cor}]));
  $('novoSetor').value='';
}
$('btnSetor').addEventListener('click',criarSetor);
$('novoSetor').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); criarSetor(); } });

/* ---------- a ponte com o resto do Hub ----------
   O cabeçalho do Hub mostra quantas estão atrasadas e para hoje; a
   tela inicial mostra o cartão "Hoje" com as mesmas pendências e uma
   caixa de criar rápido. Tudo sai daqui, pelo evento
   "pendencias:mudou" (a cada redesenho) e por window.PendenciasHub. */
function resumoHub(){
  const agora=Date.now(), hoje=diaISO(agora);
  const abertas=tarefas.filter(t=>!t.feito);
  const atrasadas=abertas.filter(t=>t.status==='data'&&t.prazo&&t.prazo<hoje);
  const paraHoje=abertas.filter(t=>colunaDe(t,agora)==='hoje'&&!atrasadas.includes(t));
  const semana=abertas.filter(t=>colunaDe(t,agora)==='semana');
  const feitasHoje=tarefas.filter(t=>t.feito&&ehHoje(t.feitoEm));
  const ordem=(a,b)=>(a.prazo||'9').localeCompare(b.prazo||'9')||(b.importante?1:0)-(a.importante?1:0)||(a.criadoEm||0)-(b.criadoEm||0);
  const novasParaMim=abertas.filter(t=>deOutro(t)&&!t.vistoEm);
  const envAbertas=enviadas.filter(t=>!t.feito);
  return {
    carregado, abertas:abertas.length, atrasadas:atrasadas.length, hoje:paraHoje.length, semana:semana.length, feitasHoje:feitasHoje.length,
    listaAtrasadas:atrasadas.sort(ordem), listaHoje:paraHoje.sort(ordem), listaSemana:semana.sort(ordem),
    setores:setores.slice(),
    // entre pessoas
    novasParaMim:novasParaMim.length, listaNovas:novasParaMim.slice().sort(ordem),
    enviadas:{total:enviadas.length, abertas:envAbertas.length, semVisto:envAbertas.filter(t=>!t.vistoEm).length, lista:envAbertas.slice()},
    acompanho:acompanho.filter(t=>!t.feito).length,
    equipe:equipe.slice()
  };
}
function avisarHub(){
  try{ window.dispatchEvent(new CustomEvent('pendencias:mudou',{detail:resumoHub()})); }catch(e){}
}
function escaparHtml(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
window.PendenciasHub={
  resumo:resumoHub,
  textoDe:t=>(t.texto||textoPuro(limpar(t.html||''))).split('\n')[0],
  nomeSetor, corSetor, colunaDe:t=>colunaDe(t,Date.now()),
  rotuloPrazo:t=>t.prazo?chipPrazo(t.prazo,Date.now()).textContent:'',
  riscar:id=>mudar(id,{feito:true,feitoEm:Date.now(),revisadoEm:null}),
  desfazer:id=>mudar(id,{feito:false,feitoEm:null}),
  // cria a partir de uma frase, entendendo prazo e setor como a caixa do quadro faz
  adicionarRapido(frase){ return window.PendenciasHub.criar({frase}); },
  // a criação completa, usada pela tela inicial: texto (ou frase a entender), bloco, prazo, setor,
  // importante, para quem (uids) e quem acompanha (uids)
  criar(d){
    if(!db) return Promise.reject(new Error('sem armazenamento'));
    const bruto=String(d.frase||d.texto||'').trim(); if(!bruto) return Promise.reject(new Error('vazio'));
    const r=d.frase?entender(bruto):{};
    const texto=d.frase?(cortarComandos(bruto,false).trim()||bruto):bruto;
    const html=escaparHtml(texto).replace(/\n/g,'<br>');
    const agora=Date.now();
    let status=d.status||r.status||'hoje', prazo=d.prazo||r.prazo||null;
    if(prazo&&!d.status) status='data';
    if(status!=='data') prazo=null;
    const setor=d.setor!==undefined&&d.setor!==null?d.setor:(r.setor||'');
    const doc={html,texto,setor,status,importante:!!d.importante,feito:false,feitoEm:null,criadoEm:agora,statusEm:agora,grifadoEm:null,revisadoEm:null,prazo,anexos:[],criadoPor:(store&&store.usuario&&store.usuario.email)||null};
    return criarOnde(doc,d.para||[],d.envolvidos||[]).then(x=>({status,prazo,setor,rotulo:rotuloPrazo({status,prazo})||'Hoje',onde:x.onde}));
  },
  entender:frase=>entender(String(frase||'')),
  equipe:()=>equipe.slice(), colegas:()=>colegas(), meuUid:()=>meuUid(), nomeDe:uid=>nomeDe(uid),
  marcarVisto:id=>{ const t=tarefas.find(x=>x.id===id); if(t) marcarVisto(t); },
  mostrarAba(aba){ abaQ=aba||'quadro'; render(); },
  // leva até a pendência no quadro e a destaca por um instante
  irPara(id){
    setorAtivo='todos'; diaFiltro=null; busca=''; $('pendBusca').value='';
    const t=tarefas.find(x=>x.id===id);
    if(t){ const c=colunaDe(t,Date.now()); if(blocoFoco&&blocoFoco!==c){ blocoFoco=null; try{localStorage.setItem('pend.foco','')}catch(e){} } colMobile=c; }
    render();
    const alvo=document.querySelector('.pend .card[data-id="'+id+'"]');
    if(alvo){ alvo.scrollIntoView({block:'center',behavior:'smooth'}); alvo.classList.add('realce'); setTimeout(()=>alvo.classList.remove('realce'),1800); }
  },
  focarNova(){ novaTxt.focus(); novaTxt.scrollIntoView({block:'center'}); },
  // alguém está no meio de alguma coisa? (o Hub não redesenha por cima)
  emUso(){
    if(editando||comentando) return true;
    if(['veu','veuCli','veuBackup','calg','pdfv'].some(id=>!$(id).hidden)) return true;
    if((novaTxt.textContent||'').trim()||novosAnexos.length) return true;
    return false;
  },
  atualizar(){ return Promise.all([(store&&store.atualizar)?store.atualizar():Promise.resolve(),refrescarPessoas()]); },
  tarefas:()=>tarefas.slice(), setores:()=>setores.slice()
};

/* ---------- data e arranque ---------- */
let diaAtual=diaISO(Date.now());
function pintarData(){ $('hojeData').textContent=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}); }
pintarData();
setInterval(()=>{ pintarData(); const d=diaISO(Date.now()); if(d!==diaAtual){ diaAtual=d; agendar(); } },60000);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ pintarData(); agendar(); } });
render();

(async()=>{
  try{ if(!store) throw new Error('sem armazenamento'); await store.iniciar(); db=store; }catch(e){ db=null; console.error(e); }
  if(!db){ $('semDb').hidden=false; carregado=true; render(); return; }
  assets=store.arquivos||null; $('btnPdf').hidden=!assets;
  // a equipe: para quem mandar, quem acompanha, e o nome de quem mandou
  const carregarEquipe=()=>(typeof Dados!=='undefined'&&Dados.listarEquipe?Dados.listarEquipe():Promise.resolve([])).then(l=>{ equipe=(l||[]).filter(p=>p&&p.uid); pintarPara(); return refrescarPessoas(); }).catch(()=>{});
  carregarEquipe().then(()=>agendar());
  setInterval(()=>{ if(!document.hidden) refrescarPessoas(); },60000);
  window.addEventListener('pendencias:equipe-mudou',carregarEquipe);
  store.ouvirTarefas(lista=>{ tarefas=lista.map(t=>Object.assign({},t)); carregado=true; agendar(); },e=>aviso(msgErro(e)));
  store.ouvirConfig('clientes',d=>{
    clientes=(d&&Array.isArray(d.lista))?d.lista.filter(x=>x&&x.id&&x.nome&&x.cnpj):[];
    $('qCli').textContent=clientes.length?String(clientes.length):'';
    montarMatcher(); agendar();
    if(!$('veuCli').hidden) desenharClientes();
  },e=>aviso(msgErro(e)));
  store.ouvirConfig('setores',d=>{ setores=(d&&Array.isArray(d.lista))?d.lista.filter(x=>x&&x.id&&x.nome):[]; agendar(); if(!$('veu').hidden) desenharSetores(); },e=>aviso(msgErro(e)));
})();
})();
