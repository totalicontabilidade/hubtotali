/* ============================================================
   Hub Totali · a agenda oficial da Receita Federal
   ------------------------------------------------------------
   A agenda do mês que o Hub mostra é CALCULADA por regra
   (js/agenda.js): DAS no dia 20, eSocial no 15, e assim por
   diante, com o ajuste de fim de semana e feriado. Regra não
   atrasa e não depende de ninguém publicar nada — mas regra
   também não sabe de prorrogação, de obrigação nova nem de
   mudança de prazo.

   A Receita publica todo mês, por Ato Declaratório Executivo, a
   agenda oficial das obrigações acessórias federais, com uma
   página por dia de vencimento:

     gov.br/receitafederal/pt-br/assuntos/agenda-tributaria/2026/Novembro/dia-20-11-2026

   Este programa lê essas páginas (mês corrente e o seguinte,
   quando já publicado) e grava dados/agenda-oficial.json. O Hub
   cruza o que calculou com o que a Receita publicou: data igual
   ganha o selo "conferida"; data diferente mostra a da Receita e
   avisa. Obrigação que a Receita lista e a regra não conhece
   aparece à parte, para ninguém ser pego de surpresa.

   O que NÃO está aqui: pagamentos (DARF, DAS, FGTS). A Receita os
   publica só na planilha do ADE, e os dias deles são estáveis em
   lei — é o que a regra já calcula bem. Estado e município também
   ficam só na regra: não têm agenda publicada em formato legível.

       node ferramentas/buscar-agenda.js
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");

const SAIDA = path.join(__dirname, "..", "dados", "agenda-oficial.json");
const BASE = "https://www.gov.br/receitafederal/pt-br/assuntos/agenda-tributaria/";
const UA = "Mozilla/5.0 (compatible; HubTotali/1.0; +https://hub.totalicontabilidade.com.br)";
const MESES = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MESES_NOME = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function decodificar(t) {
  return String(t || "").replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function semTags(h) { return decodificar(String(h || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(); }

async function baixar(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: ctl.signal, redirect: "follow" });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("HTTP " + r.status + " em " + url);
    return await r.text();
  } finally { clearTimeout(t); }
}

/* As tabelas de um dia. São duas:

     Declarações  Interessado · Declaração · Período · Base
     Pagamentos   Código · Grupo · Descrição · Período · Documento ·
                  Categoria · Fundamentação

   A de pagamentos vem com cada linha QUEBRADA em dois <tr>: o
   primeiro traz código, grupo, descrição e período; o segundo,
   documento, categoria e fundamentação. Aqui elas são emendadas
   de volta. */
function lerDia(html) {
  const declaracoes = [], pagamentos = [];
  const tabelas = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  tabelas.forEach(tab => {
    const linhas = (tab.match(/<tr[\s\S]*?<\/tr>/gi) || []).map(tr =>
      (tr.match(/<td[\s\S]*?<\/td>/gi) || []).map(td => ({
        texto: semTags(td), link: (td.match(/href="([^"]+)"/) || [])[1] || "",
      })));
    if (!linhas.length) return;
    const cab = linhas[0].map(c => c.texto).join(" | ");
    if (/Declara[cç][oõ]es, Demonstrativos/i.test(cab)) {
      linhas.slice(1).forEach(tds => {
        if (tds.length < 2 || !tds[1].texto) return;
        declaracoes.push({ quem: tds[0].texto, nome: tds[1].texto,
          periodo: tds[2] ? tds[2].texto : "", base: tds[3] ? tds[3].texto : "", baseLink: tds[3] ? tds[3].link : "" });
      });
      return;
    }
    if (/C[oó]digo de Receita/i.test(cab)) {
      let meio = null;
      linhas.slice(1).forEach(tds => {
        const t = tds.map(c => c.texto);
        /* Primeira metade: começa com um código (dígitos ou "--"). */
        if (t.length >= 3 && /^(\d{3,5}|--)$/.test(t[0])) {
          if (meio) pagamentos.push(meio);
          meio = { codigo: t[0], grupo: t[1] || "", descricao: t[2] || "", periodo: t[3] || "", documento: "", categoria: "", base: "" };
          return;
        }
        if (meio && t.length >= 2 && /^(DARF|DAS|DAE|GPS|GRU|--)/i.test(t[0])) {
          meio.documento = t[0]; meio.categoria = t[1] || ""; meio.base = t[2] || "";
          pagamentos.push(meio); meio = null;
          return;
        }
        /* Linha de sete colunas, se algum mês vier inteira. */
        if (t.length >= 7 && /^(\d{3,5}|--)$/.test(t[0])) {
          pagamentos.push({ codigo: t[0], grupo: t[1], descricao: t[2], periodo: t[3], documento: t[4], categoria: t[5], base: t[6] });
        }
      });
      if (meio) pagamentos.push(meio);
    }
  });
  return { declaracoes, pagamentos };
}

async function lerMes(ano, mes) {
  const url = BASE + ano + "/" + MESES[mes];
  const html = await baixar(url);
  if (!html) return null;

  /* Os dias são links do tipo .../Novembro/dia-20-11-2026 — um deles
     veio como "Dia 13-11-2026", com espaço codificado e maiúscula. */
  const vistos = new Set();
  const dias = [];
  const re = new RegExp("href=\"(" + url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/[Dd]ia(?:%20|\\s|-)*(\\d{2})-(\\d{2})-(\\d{4})/?)\"", "g");
  let m;
  while ((m = re.exec(html))) {
    const data = m[4] + "-" + m[3] + "-" + m[2];
    if (vistos.has(data)) continue;
    vistos.add(data);
    dias.push({ data, url: m[1] });
  }
  dias.sort((a, b) => a.data.localeCompare(b.data));

  const ade = (html.match(/anexo-ade-corat-no-(\d+)-de-(\d{2})-(\d{2})-(\d{2,4})/i) || []);
  const texto = semTags(html);
  const adeTexto = (texto.match(/Ato Declarat[oó]rio Executivo[^.]{0,40}?n[ºo°.]*\s*(\d+)[^.]{0,30}?(\d{2}\/\d{2}\/\d{2,4})/i) || []);

  for (const d of dias) {
    const pagina = await baixar(d.url);
    const lido = pagina ? lerDia(pagina) : { declaracoes: [], pagamentos: [] };
    d.declaracoes = lido.declaracoes;
    d.pagamentos = lido.pagamentos;
  }

  return {
    ano, mes: mes + 1, nome: MESES_NOME[mes] + " de " + ano,
    url,
    ade: ade[1] ? ("ADE Corat nº " + ade[1] + "/" + (ade[4].length === 2 ? "20" + ade[4] : ade[4])) : (adeTexto[1] ? "ADE Corat nº " + adeTexto[1] : ""),
    dias: dias.filter(d => d.declaracoes.length || d.pagamentos.length)
              .map(d => ({ data: d.data, url: d.url, declaracoes: d.declaracoes, pagamentos: d.pagamentos })),
  };
}

async function principal() {
  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  const hoje = new Date();
  const alvos = [[hoje.getFullYear(), hoje.getMonth()]];
  const prox = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  alvos.push([prox.getFullYear(), prox.getMonth()]);

  let anterior = { meses: [] };
  try { anterior = JSON.parse(fs.readFileSync(SAIDA, "utf8")); } catch (e) { /* primeira vez */ }

  const meses = [];
  for (const [ano, mes] of alvos) {
    try {
      const m = await lerMes(ano, mes);
      if (m && m.dias.length) { meses.push(m); console.log("ok   " + m.nome + ": " + m.dias.length + " dias, " + m.ade); }
      else {
        const velho = (anterior.meses || []).find(x => x.ano === ano && x.mes === mes + 1);
        if (velho) { meses.push(velho); console.log("mantido " + velho.nome + " (a Receita não respondeu agora)"); }
        else console.log("sem  " + MESES_NOME[mes] + " de " + ano + ": ainda não publicado");
      }
    } catch (e) {
      const velho = (anterior.meses || []).find(x => x.ano === ano && x.mes === mes + 1);
      if (velho) meses.push(velho);
      console.log("FALHA " + MESES_NOME[mes] + " de " + ano + ": " + e.message);
    }
  }
  if (!meses.length) { console.error("Nenhum mês lido."); process.exitCode = 1; return; }

  const saida = { formato: "hub-totali-agenda-oficial", versao: 1, fonte: "Receita Federal — Agenda Tributária", fonteUrl: BASE, atualizadoEm: new Date().toISOString(), meses };
  const semHora = o => JSON.stringify(Object.assign({}, o, { atualizadoEm: null }));
  if (semHora(saida) !== semHora(anterior) || process.argv.includes("--forcar")) {
    fs.writeFileSync(SAIDA, JSON.stringify(saida, null, 1) + "\n");
    console.log("Gravado " + path.relative(process.cwd(), SAIDA));
  } else console.log("Nada mudou; arquivo mantido.");
}

if (require.main === module) principal().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { lerDia, lerMes };
