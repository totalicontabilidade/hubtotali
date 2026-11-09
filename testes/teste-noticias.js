/* ============================================================
   Hub Totali · teste do leitor de notícias
   ------------------------------------------------------------
   Confere, sem internet, as partes do ferramentas/buscar-noticias.js
   que mais quebram quando um site muda: a leitura de cada formato
   de feed, a página do Simples Nacional, as listagens do gov.br, a
   classificação por assunto e a peneira do que é do ramo.

       node testes/teste-noticias.js
   ============================================================ */
"use strict";
const m = require("../ferramentas/buscar-noticias.js");

let falhas = 0;
function afirmar(oque, cond, detalhe) {
  console.log((cond ? "ok   " : "FALHA") + " " + oque + (cond ? "" : "  → " + detalhe));
  if (!cond) falhas++;
}

/* ---------- RSS 2.0 (CFC, Fenacon, Câmara) ---------- */
const rss2 = `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>
<item><title><![CDATA[CFC abre audiência pública]]></title><link>https://cfc.org.br/noticias/a/</link>
<pubDate>Mon, 09 Nov 2026 12:42:39 +0000</pubDate><description><![CDATA[Texto &amp; mais <a href="x">Continuar Lendo</a>]]></description></item>
<item><title>Segunda</title><guid>https://cfc.org.br/?p=2</guid><pubDate>Sun, 08 Nov 2026 10:00:00 +0000</pubDate><description></description></item>
</channel></rss>`;
let itens = m.lerFeed(rss2);
afirmar("RSS 2.0: dois itens", itens.length === 2, itens.length);
afirmar("RSS 2.0: título sem CDATA", itens[0].titulo === "CFC abre audiência pública", itens[0].titulo);
afirmar("RSS 2.0: link", itens[0].link === "https://cfc.org.br/noticias/a/", itens[0].link);
afirmar("RSS 2.0: sem link usa o guid", itens[1].link === "https://cfc.org.br/?p=2", itens[1].link);
afirmar("RSS 2.0: data em ISO", m.quando(itens[0].data) === "2026-11-09T12:42:39.000Z", m.quando(itens[0].data));
afirmar("resumo tira o 'Continuar Lendo' e as tags", m.resumir(itens[0].resumo) === "Texto & mais", JSON.stringify(m.resumir(itens[0].resumo)));

/* ---------- RSS 1.0 / RDF do gov.br: pastas e imagens fora ---------- */
const rdf = `<rdf:RDF><channel><title>Notícias</title></channel>
<item rdf:about="a"><title>2026</title><link>https://www.gov.br/x/2026</link><dc:date>2026-01-01T00:00:00Z</dc:date><dc:type>Folder</dc:type></item>
<item rdf:about="b"><title>Receita lança portal</title><link>https://www.gov.br/x/portal</link><dc:date>2026-11-04T16:10:27Z</dc:date><dc:type>collective.nitf.content</dc:type></item>
<item rdf:about="c"><title>foto.png</title><link>https://www.gov.br/x/foto.png/view</link><dc:type>Image</dc:type></item>
</rdf:RDF>`;
itens = m.lerFeed(rdf);
afirmar("RDF: só a notícia passa (pasta e imagem fora)", itens.length === 1 && itens[0].titulo === "Receita lança portal", JSON.stringify(itens.map(i => i.titulo)));

/* ---------- Atom ---------- */
const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Entrada</title>
<link rel="alternate" href="https://exemplo.gov.br/e1"/><updated>2026-11-01T10:00:00Z</updated><summary>Resumo</summary></entry></feed>`;
itens = m.lerFeed(atom);
afirmar("Atom: link pelo href", itens.length === 1 && itens[0].link === "https://exemplo.gov.br/e1", JSON.stringify(itens));

/* ---------- a página do Simples Nacional ---------- */
const sn = `<div id="listaNoticias"><div class="row"><div class="col-lg-12"><h4>
<a href="NoticiaCompleta.aspx?id=bff8b291" style="text-decoration:none;" class="azulClaro">
  Publicado Roteiro da Opção pelo Simples Nacional Para o Ano de 2027
</a></h4></div></div>
<div class="row"><div class="col-lg-12"><div class="tags"><span><span class="azulClaro">Palavras-chave:</span></span><span>Simples Nacional</span></div></div></div>
<div class="row"><div class="col-lg-12"><p><span style="color:x">
  21/08/2026
</span> -
<span style="color:y">
  Veja as principais modificações na forma de opção
</span></p></div></div></div>`;
itens = m.lerSimples(sn, "https://www8.receita.fazenda.gov.br/SimplesNacional/Noticias/TodasNoticias.aspx");
afirmar("Simples: um item", itens.length === 1, itens.length);
afirmar("Simples: título", itens[0] && itens[0].titulo === "Publicado Roteiro da Opção pelo Simples Nacional Para o Ano de 2027", itens[0] && itens[0].titulo);
afirmar("Simples: link absoluto", itens[0] && itens[0].link === "https://www8.receita.fazenda.gov.br/SimplesNacional/Noticias/NoticiaCompleta.aspx?id=bff8b291", itens[0] && itens[0].link);
afirmar("Simples: data brasileira vira ISO (meio-dia de Brasília)", m.quando(itens[0].data) === "2026-08-21T15:00:00.000Z", m.quando(itens[0].data));
afirmar("Simples: resumo", itens[0].resumo === "Veja as principais modificações na forma de opção", itens[0].resumo);

/* ---------- listagens do gov.br sem feed ---------- */
const tiles = `<article class="tileItem visualIEFloatFix"><div class="tileContent"><h2 class="tileHeadline">
<a class="summary url" href="https://www.gov.br/esocial/pt-br/noticias/x" title="t">Ferramentas apresentam instabilidade</a></h2>
<p class="tileBody"><span class="description">Alguns pedidos não retornam.</span></p></div>
<span class="documentByLine"><span class="summary-view-icon"><i class="icon-day"></i> 27/08/2026</span>
<span class="summary-view-icon"><i class="icon-hour"></i> 17h11</span></span></article>`;
itens = m.lerPlone(tiles);
afirmar("gov.br tiles: título e data com hora", itens.length === 1 && itens[0].titulo === "Ferramentas apresentam instabilidade" && itens[0].data === "27/08/2026 17:11", JSON.stringify(itens));
afirmar("gov.br tiles: resumo", itens[0] && itens[0].resumo === "Alguns pedidos não retornam.", itens[0] && itens[0].resumo);

const lista = `<ul class="noticias"><li><div class="conteudo"><div class="subtitulo-noticia">BOLETIM</div>
<h2 class="titulo"><a href="https://www.gov.br/fazenda/pt-br/assuntos/noticias/2026/novembro/x">Receita divulga portaria</a></h2>
<span class="descricao"><span class="data"> 09/11/2026 </span><span> - </span> Comissão é criada </span></div></li></ul>`;
itens = m.lerPlone(lista);
afirmar("gov.br lista com foto: título, data e resumo", itens.length === 1 && itens[0].data === "09/11/2026" && itens[0].resumo === "Comissão é criada", JSON.stringify(itens));

/* ---------- classificação ---------- */
afirmar("classifica reforma tributária", m.classificar("Comitê Gestor do IBS define regras da CBS").indexOf("reforma") !== -1);
afirmar("classifica Simples e MEI", m.classificar("Prazo da DASN-SIMEI para o MEI").indexOf("simples") !== -1);
afirmar("classifica trabalhista", m.classificar("eSocial muda leiaute do FGTS Digital").indexOf("trabalhista") !== -1);
afirmar("etiqueta fixa da fonte entra primeiro", m.classificar("Texto qualquer", "sergipe")[0] === "sergipe");

/* ---------- a peneira ---------- */
afirmar("do ramo: salário mínimo", m.DO_RAMO.test("Governo define salário mínimo de 2027"));
afirmar("do ramo: Selic", m.DO_RAMO.test("Copom mantém Selic em 15%"));
afirmar("fora do ramo: Gás do Povo", !m.DO_RAMO.test("Gás do Povo: governo prorroga vigência do auxílio até 2031 por medida provisória"));
afirmar("fora do ramo: vacinação", !m.DO_RAMO.test("Ministério amplia campanha de vacinação contra a gripe"));

/* ---------- repetidas ---------- */
afirmar("títulos parecidos são a mesma notícia",
  m.parecidas("Receita Federal abre consulta pública sobre alteração da IN do Adicional da CSLL",
              "Receita Federal abre consulta pública sobre alteração da Instrução Normativa do Adicional da CSLL"));
afirmar("títulos diferentes não são",
  !m.parecidas("CFC abre audiência pública para revisão de normas de auditoria", "Receita Federal abre consulta pública sobre a IN do Adicional"));

/* ---------- o endereço como chave ---------- */
afirmar("chave do link ignora www e barra final", m.chaveDoLink("https://www.cfc.org.br/noticias/a/") === m.chaveDoLink("https://cfc.org.br/noticias/a"));
afirmar("chave do link preserva o id do Simples", m.chaveDoLink("https://www8.receita.fazenda.gov.br/SimplesNacional/Noticias/NoticiaCompleta.aspx?id=1") !== m.chaveDoLink("https://www8.receita.fazenda.gov.br/SimplesNacional/Noticias/NoticiaCompleta.aspx?id=2"));

console.log(falhas ? falhas + " caso(s) falharam." : "Todos os casos passaram.");
process.exitCode = falhas ? 1 : 0;
