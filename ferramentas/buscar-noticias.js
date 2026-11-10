/* ============================================================
   Hub Totali · buscador de notícias oficiais
   ------------------------------------------------------------
   Lê as fontes OFICIAIS do meio contábil (Receita Federal,
   Simples Nacional, eSocial, Ministério da Fazenda, CFC, Fenacon,
   Câmara, Senado, Agência Brasil, SEFAZ/SE e o portal gov.br),
   peneira o que interessa a um escritório de contabilidade,
   classifica por assunto e grava tudo em dados/noticias.json.

   É esse arquivo que o Hub lê. O Hub NÃO fala com nenhum desses
   sites: a política de segurança da página só deixa buscar da
   própria pasta. Quem fala com os sites é este programa, rodando
   no GitHub Actions (.github/workflows/atualizar.yml) de hora em
   hora, ou à mão:

       node ferramentas/buscar-noticias.js

   SEM DEPENDÊNCIA NENHUMA, como o resto do Hub: só Node 18+.
   O XML dos feeds é lido com um leitor pequeno e tolerante, feito
   para feed gerado por máquina — não para XML qualquer.

   O QUE "OFICIAL" QUER DIZER AQUI: órgão de governo, casa
   legislativa, conselho de classe ou federação do setor. Portal de
   notícias privado não entra, nem como fonte secundária — a
   equipe precisa poder citar a notícia para o cliente sem
   conferir em outro lugar.
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");

const SAIDA = path.join(__dirname, "..", "dados", "noticias.json");
/* A ponte brasileira (funcoes/index.js): só para as fontes com
   pelaPonte, e só quando o endereço vem do ambiente — rodando aqui
   do escritório, o site responde direto e a ponte nem é chamada. */
const PONTE_URL = String(process.env.PONTE_URL || "").replace(/\/+$/, "");
const UA = "Mozilla/5.0 (compatible; HubTotali/1.0; +https://hub.totalicontabilidade.com.br)";
const DIAS_GUARDADOS = 45;       // notícia some do arquivo depois disto
const MAXIMO = 180;              // teto de notícias no arquivo
const TEMPO_LIMITE_MS = 25000;

/* ---------- as fontes ----------
   tipo:  rss      → RSS 2.0, RSS 1.0 (RDF) ou Atom
          simples  → a página do Simples Nacional (não tem feed)
          plone    → listagem HTML do gov.br (eSocial e Fazenda
                     não publicam feed na pasta de notícias)
   peneira: true   → a fonte fala de tudo; só entra o que passa
                     pelas palavras do escritório (ehDoRamo)
            false  → a fonte já é do ramo; entra tudo
   categoria: etiqueta fixa que toda notícia da fonte recebe   */
const FONTES = [
  /* O RSS da pasta de notícias da Receita lista subpastas, não
     notícias; a listagem "todas as notícias" traz as trinta últimas. */
  { id: "receita",  sigla: "RFB",     nome: "Receita Federal",
    url: "https://www.gov.br/receitafederal/pt-br/assuntos/noticias/todas-as-noticias",
    site: "https://www.gov.br/receitafederal/pt-br/assuntos/noticias", tipo: "plone", peneira: false, categoria: "tributos" },
  { id: "simples",  sigla: "SN",      nome: "Simples Nacional",
    url: "https://www8.receita.fazenda.gov.br/SimplesNacional/Noticias/TodasNoticias.aspx",
    site: "https://www8.receita.fazenda.gov.br/SimplesNacional/Noticias/TodasNoticias.aspx",
    tipo: "simples", peneira: false, categoria: "simples" },
  { id: "esocial",  sigla: "eSocial", nome: "Portal eSocial",
    url: "https://www.gov.br/esocial/pt-br/noticias",
    site: "https://www.gov.br/esocial/pt-br/noticias", tipo: "plone", peneira: false, categoria: "trabalhista" },
  { id: "fazenda",  sigla: "MF",      nome: "Ministério da Fazenda",
    url: "https://www.gov.br/fazenda/pt-br/assuntos/noticias",
    site: "https://www.gov.br/fazenda/pt-br/assuntos/noticias", tipo: "plone", peneira: true },
  { id: "cfc",      sigla: "CFC",     nome: "Conselho Federal de Contabilidade",
    url: "https://cfc.org.br/feed/", site: "https://cfc.org.br/noticias/", tipo: "rss", peneira: false, categoria: "contabil" },
  { id: "fenacon",  sigla: "Fenacon", nome: "Fenacon",
    url: "https://fenacon.org.br/feed/", site: "https://fenacon.org.br/noticias/", tipo: "rss", peneira: false },
  { id: "sefaz-se", sigla: "SEFAZ/SE", nome: "Secretaria da Fazenda de Sergipe",
    url: "https://www.sefaz.se.gov.br/_layouts/15/listfeed.aspx?List=%7B47165FFB%2D27C2%2D4C86%2DB8E5%2DDE40B54B162E%7D",
    site: "https://www.sefaz.se.gov.br/", tipo: "rss", peneira: false, categoria: "sergipe",
    /* Não responde a quem está fora do Brasil (o GitHub): a conexão
       nem abre. Vai pela ponte — a função no Google Cloud em São
       Paulo (funcoes/index.js), cujo endereço está em PONTE_URL. */
    pelaPonte: true },
  { id: "camara",   sigla: "Câmara",  nome: "Agência Câmara (Economia)",
    url: "https://www.camara.leg.br/noticias/rss/dinamico/ECONOMIA",
    site: "https://www.camara.leg.br/noticias", tipo: "rss", peneira: true, categoria: "legislacao" },
  { id: "senado",   sigla: "Senado",  nome: "Agência Senado",
    url: "https://www12.senado.leg.br/noticias/rss.xml",
    site: "https://www12.senado.leg.br/noticias", tipo: "rss", peneira: true, categoria: "legislacao" },
  { id: "ebc",      sigla: "EBC",     nome: "Agência Brasil (Economia)",
    url: "https://agenciabrasil.ebc.com.br/rss/economia/feed.xml",
    site: "https://agenciabrasil.ebc.com.br/economia", tipo: "rss", peneira: true },
  { id: "govbr",    sigla: "gov.br",  nome: "Portal gov.br",
    url: "https://www.gov.br/pt-br/noticias/RSS",
    site: "https://www.gov.br/pt-br/noticias", tipo: "rss", peneira: true },
];

/* ---------- os assuntos ----------
   Cada notícia recebe as etiquetas cujas palavras aparecerem no
   título ou no resumo. A ordem aqui é a ordem dos filtros na tela. */
const CATEGORIAS = [
  { id: "reforma",     nome: "Reforma Tributária",
    re: /reforma tribut|\bibs\b|\bcbs\b|imposto seletivo|comit[eê] gestor|split payment|lc 214|lei complementar 214|iva dual|n[aã]o cumulativ/i },
  { id: "simples",     nome: "Simples e MEI",
    re: /simples nacional|\bmei\b|microempreendedor|pgdas|dasn|defis|\bsimei\b|cgsn|sublimite/i },
  { id: "tributos",    nome: "Tributos federais",
    re: /receita federal|\birpj\b|\bcsll\b|\bpis\b|\bcofins\b|\bipi\b|\bdarf\b|dctf|\birpf\b|imposto de renda|\bcarf\b|\bpgfn\b|d[ií]vida ativa|parcelamento|transa[cç][aã]o tribut|malha|restitui[cç][aã]o|e-cac|\becac\b|tribut|imposto|al[ií]quota|isen[cç][aã]o|contribui[cç][aã]o/i },
  { id: "trabalhista", nome: "Trabalhista e Previdência",
    re: /esocial|\bfgts\b|\binss\b|previd[eê]nc|trabalh|folha de pagamento|sal[aá]rio|emprego|aposentad|\bctps\b|rescis|sindic|conven[cç][aã]o coletiva|\bcaged\b|reinf|13[ºo]|d[eé]cimo terceiro|f[eé]rias|benef[ií]cio/i },
  { id: "contabil",    nome: "Contábil e normas",
    re: /\bcfc\b|\bcrc\b|contab|\bnbc\b|auditoria|per[ií]cia|balan[cç]o|\bsped\b|\becd\b|\becf\b|escritura[cç][aã]o|demonstra[cç][oõ]es|\bifrs\b|cpc \d|exame de sufici[eê]ncia/i },
  { id: "empresas",    nome: "Empresas e cadastros",
    re: /\bcnpj\b|\bcpf\b|abertura de empresa|redesim|junta comercial|alvar[aá]|licen[cç]a|nota fiscal|nf-?e\b|nfs-?e|nfcom|certificado digital|cadastro/i },
  { id: "legislacao",  nome: "Legislação",
    re: /\blei\b|decreto|medida provis[oó]ria|portaria|instru[cç][aã]o normativa|projeto de lei|\bpl\s?\d|\bplp\b|\bpec\b|aprova|sancion|promulg|publicad[ao] no diário|\bdou\b|regulament/i },
  { id: "sergipe",     nome: "Sergipe",
    re: /sergipe|aracaju|itabaiana|sefaz\/?se\b|\bse\)|estado de sergipe/i },
];

/* O que faz uma notícia de fonte geral (Senado, Câmara, Agência
   Brasil, gov.br, Fazenda) interessar a um escritório contábil. */
const DO_RAMO = /tribut|imposto|receita federal|simples nacional|\bmei\b|\bicms\b|\biss\b|\bpis\b|cofins|\birpj\b|\bcsll\b|\bibs\b|\bcbs\b|reforma tribut|contab|esocial|\bfgts\b|\binss\b|previd[eê]nc|trabalhist|folha de pagamento|sal[aá]rio m[ií]nimo|\bcnpj\b|nota fiscal|\bsped\b|\bdctf\b|\bdarf\b|imposto de renda|\birpf\b|declara[cç][aã]o de|microempres|empreendedor|\bcarf\b|\bpgfn\b|d[ií]vida ativa|\brefis\b|parcelamento|\bselic\b|desonera[cç][aã]o|al[ií]quota|isen[cç][aã]o|13[ºo] sal|d[eé]cimo terceiro|carteira de trabalho|emprego formal|\bcaged\b|aposentad|benef[ií]cio previd|certificado digital|\bcpf\b|cr[eé]dito tribut|\bfisco\b|obriga[cç][aã]o acess|escala 6x1|jornada de trabalho|hora extra|sal[aá]rio|rescis|\bcnae\b|\bnf-?e\b|nfs-?e/i;

/* Notícia que é oficial mas não é do escritório: aduana, apreensão,
   concurso. Fica no arquivo com relevância baixa, para não ocupar a
   vitrine da tela inicial, mas continua acessível em "Todas". */
const FORA_DO_BALCAO = /apreens|apreend|contraband|droga|coca[ií]na|maconha|haxixe|fuzil|aeroporto|alf[aâ]ndega|aduan|carga e tr[aâ]nsito|leil[aã]o|concurso|posse d[eo]|nomea|cerim[oô]nia|homenage|exposi[cç][aã]o|semin[aá]rio|congresso|palestra|webinar|live|pr[eê]mio|vote|deflagra|opera[cç][aã]o (?:fronteira|[A-Z])|pol[ií]cia|interceptam|comunicado|instabilidade|manuten[cç][aã]o programada/;

/* ============================================================
   leitura de feed sem biblioteca
   ============================================================ */

function decodificar(t) {
  return String(t || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function semTags(html) {
  return decodificar(decodificar(html))        /* feeds que escapam duas vezes */
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ").trim();
}

/* Conteúdo da primeira tag com um dos nomes dados, dentro do bloco. */
function tag(bloco, nomes) {
  for (const nome of nomes) {
    const re = new RegExp("<" + nome + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + nome + ">", "i");
    const m = bloco.match(re);
    if (m) return m[1].trim();
  }
  return "";
}

/* Atom guarda o link no atributo href. */
function linkAtom(bloco) {
  const m = bloco.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ||
            bloco.match(/<link[^>]*href=["']([^"']+)["']/i);
  return m ? m[1] : "";
}

function lerFeed(xml) {
  const blocos = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>|<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) || [];
  return blocos.map(b => {
    const tipo = tag(b, ["dc:type"]);
    return {
      titulo: semTags(tag(b, ["title"])),
      link: decodificar(tag(b, ["link"])) || linkAtom(b) || decodificar(tag(b, ["guid", "id"])),
      resumo: tag(b, ["description", "summary", "content:encoded", "content"]),
      data: tag(b, ["pubDate", "dc:date", "published", "updated", "lastBuildDate"]),
      tipo,
    };
  })
  /* O RSS do gov.br lista pastas e imagens junto das notícias.
     "collective.nitf.content" é a notícia; o resto é estrutura. */
  .filter(i => !i.tipo || /nitf|news|not[ií]cia/i.test(i.tipo));
}

/* ---------- a página do Simples Nacional ---------- */
function lerSimples(html, base) {
  const saida = [];
  const re = /<a href="(NoticiaCompleta\.aspx\?id=[^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>[\s\S]*?(\d{2}\/\d{2}\/\d{4})\s*<\/span>\s*-\s*<span[^>]*>\s*([\s\S]*?)\s*<\/span>/g;
  let m;
  while ((m = re.exec(html))) {
    saida.push({
      titulo: semTags(m[2]),
      link: new URL(m[1], base).href,
      data: m[3],
      resumo: semTags(m[4]),
    });
  }
  return saida;
}

/* ---------- listagens do gov.br sem feed ---------- */
function lerPlone(html) {
  const saida = [];
  /* Dois leiautes: os "tiles" (eSocial) e a lista com foto (Fazenda). */
  const tiles = html.match(/<article class="tileItem[\s\S]*?<\/article>/g) || [];
  tiles.forEach(t => {
    const a = t.match(/<h2 class="tileHeadline">\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) return;
    const d = t.match(/icon-day"><\/i>\s*(\d{2}\/\d{2}\/\d{4})/);
    const h = t.match(/icon-hour"><\/i>\s*(\d{2})h(\d{2})/);
    saida.push({
      titulo: semTags(a[2]), link: a[1],
      data: d ? d[1] + (h ? " " + h[1] + ":" + h[2] : "") : "",
      resumo: semTags(((t.match(/<span class="description">([\s\S]*?)<\/span>/) || t.match(/<p class="tileBody">([\s\S]*?)<\/p>/) || [])[1]) || ""),
    });
  });
  const itens = html.match(/<li>\s*<div class="conteudo">[\s\S]*?<\/li>/g) || [];
  itens.forEach(t => {
    const a = t.match(/<h2 class="titulo">\s*<a href="([^"]+)">([\s\S]*?)<\/a>/);
    if (!a) return;
    const d = t.match(/<span class="data">\s*(\d{2}\/\d{2}\/\d{4})/);
    const desc = t.match(/<\/span>\s*<span>\s*-\s*<\/span>\s*([\s\S]*?)<\/span>/);
    saida.push({ titulo: semTags(a[2]), link: a[1], data: d ? d[1] : "", resumo: desc ? semTags(desc[1]) : "" });
  });
  return saida;
}

/* ============================================================
   datas, texto e classificação
   ============================================================ */

/* "05/11/2026 17:05" e "05/11/2026" são do Brasil e o Date não
   entende; o resto (RFC 822, ISO) ele entende. Sem data, fica a de
   agora — a notícia acabou de aparecer no feed, afinal. */
function quando(texto) {
  const t = String(texto || "").trim();
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (br) {
    const d = new Date(Date.UTC(+br[3], +br[2] - 1, +br[1], (br[4] ? +br[4] : 12) + 3, br[5] ? +br[5] : 0));
    return d.toISOString();
  }
  const n = Date.parse(t);
  return isNaN(n) ? new Date().toISOString() : new Date(n).toISOString();
}

function resumir(html, titulo) {
  let t = semTags(html);
  /* A Agência Brasil repete o título e cola "Notícias relacionadas"
     dentro do resumo; o CFC cola "Continuar Lendo". */
  t = t.replace(/Not[ií]cias relacionadas:[\s\S]*$/i, "").replace(/Continuar Lendo\s*$/i, "").trim();
  if (titulo && t.toLowerCase().indexOf(titulo.toLowerCase()) === 0) t = t.slice(titulo.length).replace(/^[\s\-–—:.]+/, "");
  if (t.length > 280) t = t.slice(0, 277).replace(/\s+\S*$/, "") + "…";
  return t;
}

function classificar(texto, fixa) {
  const lista = CATEGORIAS.filter(c => c.re.test(texto)).map(c => c.id);
  if (fixa && lista.indexOf(fixa) === -1) lista.unshift(fixa);
  return lista;
}

/* Relevância de 0 a 3: decide a ordem da vitrine na tela inicial.
   Fonte do ramo vale mais; assunto do dia a dia vale mais; aduana e
   cerimônia valem menos. */
function relevancia(fonte, texto, categorias) {
  let r = fonte.peneira ? 1 : 2;
  if (categorias.some(c => ["reforma", "simples", "trabalhista", "tributos"].indexOf(c) !== -1)) r++;
  if (FORA_DO_BALCAO.test(texto)) r -= 2;
  return Math.max(0, Math.min(3, r));
}

/* O mesmo endereço escrito de dois jeitos é a mesma notícia. */
function chaveDoLink(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    /* A busca (?id=...) só conta onde ela é o que distingue a notícia. */
    var busca = u.pathname.indexOf("NoticiaCompleta") !== -1 ? u.search.toLowerCase() : "";
    return (u.host.replace(/^www\./, "") + u.pathname).toLowerCase().replace(/\/+$/, "") + busca;
  } catch (e) { return String(url).toLowerCase(); }
}

function chaveDoTitulo(t) {
  return String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 90);
}

/* Dois títulos falam da mesma coisa quando dividem quase todas as
   palavras que carregam sentido (as de quatro letras ou mais). */
const ABREVIA = { in: "instrucao normativa", mp: "medida provisoria", lc: "lei complementar", rfb: "receita federal", pl: "projeto de lei" };
function palavrasFortes(t) {
  const base = String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ");
  const expandida = base.split(/\s+/).map(w => ABREVIA[w] || w).join(" ");
  return new Set(expandida.split(/\s+/).filter(w => w.length >= 4));
}
function parecidas(a, b) {
  const A = palavrasFortes(a), B = palavrasFortes(b);
  if (A.size < 4 || B.size < 4) return false;
  let comuns = 0;
  A.forEach(w => { if (B.has(w)) comuns++; });
  return comuns / Math.min(A.size, B.size) >= 0.75;
}

function idDe(chave) {
  /* djb2 — curto, estável, sem biblioteca. Serve para a tela guardar
     "já vi esta" por pessoa. */
  let h = 5381;
  for (let i = 0; i < chave.length; i++) h = ((h << 5) + h + chave.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/* ============================================================
   buscar
   ============================================================ */

async function baixar(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TEMPO_LIMITE_MS);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8" }, signal: ctl.signal, redirect: "follow" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    /* Quase tudo é UTF-8; o Simples Nacional declara o seu no HTML. */
    const cabeca = buf.slice(0, 2048).toString("latin1");
    const m = cabeca.match(/charset=["']?([\w-]+)/i);
    const enc = m && /8859|1252|latin/i.test(m[1]) ? "latin1" : "utf8";
    return buf.toString(enc);
  } finally { clearTimeout(t); }
}

async function lerFonte(f) {
  let bruto;
  if (f.pelaPonte && PONTE_URL) {
    /* Pela ponte primeiro; se ela falhar, ainda tenta direto. */
    try { bruto = await baixar(PONTE_URL + "?url=" + encodeURIComponent(f.url)); f._via = "ponte"; }
    catch (e) { bruto = await baixar(f.url); f._via = undefined; }
  } else {
    try { bruto = await baixar(f.url); }
    catch (e) {
      /* Uma segunda tentativa cobre a oscilação de rede de sempre. */
      await new Promise(r => setTimeout(r, 3000));
      bruto = await baixar(f.url);
    }
  }
  let itens;
  if (f.tipo === "simples") itens = lerSimples(bruto, f.url);
  else if (f.tipo === "plone") itens = lerPlone(bruto);
  else itens = lerFeed(bruto);
  if (!itens.length) throw new Error("a página veio, mas não achei notícia nenhuma nela (mudou o leiaute?)");

  return itens.map(i => {
    const titulo = i.titulo.slice(0, 220);
    const resumo = resumir(i.resumo, titulo);
    const texto = titulo + " " + resumo;
    const categorias = classificar(texto, f.categoria);
    return {
      id: idDe(chaveDoLink(i.link)),
      titulo, link: i.link, resumo,
      fonte: f.id, fonteNome: f.nome, sigla: f.sigla,
      publicadoEm: quando(i.data),
      categorias,
      relevancia: relevancia(f, texto, categorias),
      _doRamo: !f.peneira || DO_RAMO.test(texto),
    };
  }).filter(n => n.titulo && n.link && /^https?:/.test(n.link) && n._doRamo);
}

function lerAnterior() {
  try { return JSON.parse(fs.readFileSync(SAIDA, "utf8")); }
  catch (e) { return { noticias: [], fontes: [] }; }
}

async function principal() {
  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  const anterior = lerAnterior();
  const agora = Date.now();
  const limite = agora - DIAS_GUARDADOS * 864e5;

  const estado = [];
  const novas = [];
  await Promise.all(FONTES.map(async f => {
    try {
      const lista = await lerFonte(f);
      lista.forEach(n => { delete n._doRamo; novas.push(n); });
      const ok = { id: f.id, sigla: f.sigla, nome: f.nome, site: f.site, ok: true, quantas: lista.length };
      if (f._via) ok.via = f._via;
      estado.push(ok);
      console.log("ok   " + f.nome + ": " + lista.length + (f._via ? " (pela ponte)" : ""));
    } catch (e) {
      estado.push({ id: f.id, sigla: f.sigla, nome: f.nome, site: f.site, ok: false, erro: String(e.message || e).slice(0, 200) });
      console.log("FALHA " + f.nome + ": " + (e.message || e));
    }
  }));

  /* Junta com o que já havia: notícia que saiu do feed continua no
     arquivo até vencer o prazo. Entre a nova e a antiga, vale a
     nova, mas a data de quando ela APARECEU aqui pela primeira vez
     se preserva — é ela que diz à tela o que é novidade. */
  const porId = new Map();
  (anterior.noticias || []).forEach(n => { if (Date.parse(n.publicadoEm) >= agora - 183 * 864e5) porId.set(n.id, n); });
  novas.forEach(n => {
    const velha = porId.get(n.id);
    n.vistaEm = velha && velha.vistaEm ? velha.vistaEm : new Date(agora).toISOString();
    /* Notícia sem data no feed herda a que já tinha, para não
       "renascer" como de hoje a cada rodada. */
    if (velha && Math.abs(Date.parse(n.publicadoEm) - agora) < 120000 && velha.publicadoEm) n.publicadoEm = velha.publicadoEm;
    porId.set(n.id, n);
  });

  /* Mesma manchete em duas fontes (a Fazenda republica a Receita, a
     Agência Brasil republica as duas): fica a da fonte do ramo, ou a
     mais antiga. A comparação é por palavras, não por texto igual —
     "IN do Adicional" e "Instrução Normativa do Adicional" são a
     mesma notícia escrita de dois jeitos. */
  const porTitulo = new Map();
  const escolhidas = [];
  Array.from(porId.values()).sort((a, b) => b.relevancia - a.relevancia || Date.parse(a.publicadoEm) - Date.parse(b.publicadoEm))
    .forEach(n => {
      const k = chaveDoTitulo(n.titulo);
      if (porTitulo.has(k)) return;
      const repetida = escolhidas.some(e => Math.abs(Date.parse(e.publicadoEm) - Date.parse(n.publicadoEm)) < 3 * 864e5 && parecidas(e.titulo, n.titulo));
      if (repetida) return;
      porTitulo.set(k, n); escolhidas.push(n);
    });

  /* Fonte que publica pouco (Simples Nacional, eSocial) não pode
     sumir da tela só porque a última notícia tem dois meses: as
     três mais recentes de cada fonte ficam, até meio ano. */
  const todas = Array.from(porTitulo.values())
    .filter(n => Date.parse(n.publicadoEm) <= agora + 864e5)
    .sort((a, b) => Date.parse(b.publicadoEm) - Date.parse(a.publicadoEm));
  const porFonte = {};
  const lista = todas.filter(n => {
    porFonte[n.fonte] = (porFonte[n.fonte] || 0) + 1;
    const t = Date.parse(n.publicadoEm);
    return t >= limite || (porFonte[n.fonte] <= 3 && t >= agora - 183 * 864e5);
  }).slice(0, MAXIMO);

  /* Fonte que falhou agora mantém o registro da última vez em que
     respondeu, para a tela poder dizer "SEFAZ/SE sem resposta desde…". */
  const fontesAntes = new Map((anterior.fontes || []).map(f => [f.id, f]));
  estado.forEach(f => {
    const antes = fontesAntes.get(f.id);
    f.ultimaVez = f.ok ? new Date(agora).toISOString() : (antes && antes.ultimaVez) || null;
  });
  estado.sort((a, b) => FONTES.findIndex(f => f.id === a.id) - FONTES.findIndex(f => f.id === b.id));

  const saida = {
    formato: "hub-totali-noticias", versao: 1,
    atualizadoEm: new Date(agora).toISOString(),
    categorias: CATEGORIAS.map(c => ({ id: c.id, nome: c.nome })),
    fontes: estado,
    noticias: lista,
  };

  /* Só reescreve se mudou algo além do relógio: um commit por hora
     sem notícia nova é lixo no histórico. */
  const antesSemHora = JSON.stringify(Object.assign({}, anterior, { atualizadoEm: null, fontes: (anterior.fontes || []).map(f => Object.assign({}, f, { ultimaVez: null })) }));
  const depoisSemHora = JSON.stringify(Object.assign({}, saida, { atualizadoEm: null, fontes: saida.fontes.map(f => Object.assign({}, f, { ultimaVez: null })) }));
  const mudou = antesSemHora !== depoisSemHora;
  const velhoDemais = !anterior.atualizadoEm || (agora - Date.parse(anterior.atualizadoEm)) > 6 * 3600e3;
  if (mudou || velhoDemais || process.argv.includes("--forcar")) {
    fs.writeFileSync(SAIDA, JSON.stringify(saida, null, 1) + "\n");
    console.log("\nGravado " + path.relative(process.cwd(), SAIDA) + ": " + lista.length + " notícias, " +
      estado.filter(f => f.ok).length + "/" + estado.length + " fontes.");
  } else {
    console.log("\nNada novo: " + lista.length + " notícias, arquivo mantido.");
  }
  const falhas = estado.filter(f => !f.ok).length;
  if (falhas === estado.length) { console.error("Nenhuma fonte respondeu."); process.exitCode = 1; }
}

if (require.main === module) {
  principal().catch(e => { console.error(e); process.exitCode = 1; });
}

module.exports = { lerFeed, lerSimples, lerPlone, lerFonte, classificar, quando, resumir, semTags, chaveDoLink, parecidas, DO_RAMO, CATEGORIAS, FONTES };
