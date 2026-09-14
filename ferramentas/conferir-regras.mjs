/* ============================================================
   Hub Totali · conferidor de regras
   ------------------------------------------------------------
   Lê um arquivo .rules e procura os erros que o console do
   Firebase só mostra DEPOIS de você colar tudo lá: parêntese
   sobrando, chave sem fechar, condição que termina no meio.

   POR QUE ISTO EXISTE

   Uma vez as regras foram entregues com um "||" faltando entre
   duas condições. O console recusou com "Line 253: Unexpected
   ')'", e quem levou o susto foi quem estava do outro lado
   tentando publicar. Um arquivo de regras não roda em lugar
   nenhum antes de ir para o console — então este conferidor é a
   única leitura que dá para fazer antes.

   O QUE ELE NÃO FAZ: não valida a semântica. Ele não sabe se
   daEquipe() existe, nem se a regra deixa passar quem não devia.
   Ele pega erro de forma, que é a classe de erro que chegou ao
   usuário. Para o resto não há atalho: é ler.

   Uso:  node ferramentas/conferir-regras.mjs firestore.rules
   ============================================================ */

import { readFileSync } from "node:fs";

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("Uso: node ferramentas/conferir-regras.mjs <arquivo.rules>");
  process.exit(2);
}

const bruto = readFileSync(arquivo, "utf8");
const linhas = bruto.split(/\r?\n/);
const problemas = [];

/* Tira comentários e textos entre aspas antes de contar sinais:
   um "//" dentro de aspas não é comentário, e um parêntese dentro
   de um comentário não desequilibra nada. */
function semRuido(linha) {
  let saida = "";
  let aspas = null;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === "\\") { i++; continue; }
      if (c === aspas) aspas = null;
      continue;
    }
    if (c === "'" || c === '"') { aspas = c; continue; }
    if (c === "/" && linha[i + 1] === "/") break;
    saida += c;
  }
  return { texto: saida, aspasAbertas: aspas };
}

const pilha = [];
const pares = { "(": ")", "[": "]", "{": "}" };
const fechamentos = { ")": "(", "]": "[", "}": "{" };

linhas.forEach((linha, i) => {
  const n = i + 1;
  const { texto, aspasAbertas } = semRuido(linha);

  if (aspasAbertas) problemas.push(`linha ${n}: aspas abertas e não fechadas`);

  for (const c of texto) {
    if (pares[c]) pilha.push({ c, n });
    else if (fechamentos[c]) {
      const topo = pilha.pop();
      if (!topo) problemas.push(`linha ${n}: "${c}" fecha o que não foi aberto`);
      else if (topo.c !== fechamentos[c]) {
        problemas.push(`linha ${n}: "${c}" fecha "${topo.c}" da linha ${topo.n}`);
      }
    }
  }

  /* Uma linha que termina em operador lógico continua na próxima —
     isso é normal e comum aqui. O erro que já aconteceu foi o
     contrário: duas condições coladas SEM operador entre elas. */
  const t = texto.trim();
  if (/^(&&|\|\|)/.test(t) === false && /\)\s*\(/.test(t)) {
    problemas.push(`linha ${n}: dois parênteses colados sem && ou || entre eles`);
  }
});

pilha.forEach((p) => problemas.push(`linha ${p.n}: "${p.c}" ficou sem fechar`));

/* Conferências de forma que valem para todo arquivo de regras. */
if (!/rules_version\s*=\s*'2'/.test(bruto)) {
  problemas.push("falta rules_version = '2' no topo");
}
if (!/service\s+cloud\.firestore|service\s+firebase\.storage/.test(bruto)) {
  problemas.push("falta a linha service (cloud.firestore ou firebase.storage)");
}

const quantasMatch = (bruto.match(/^\s*match\s+\//gm) || []).length;
const quantasAllow = (bruto.match(/^\s*allow\s+/gm) || []).length;

if (problemas.length) {
  console.error(`\n  ${arquivo}: ${problemas.length} problema(s)\n`);
  problemas.forEach((p) => console.error("   · " + p));
  console.error("");
  process.exit(1);
}

console.log(
  `\n  ${arquivo}: forma em ordem — ${linhas.length} linhas, ` +
  `${quantasMatch} match, ${quantasAllow} allow.\n` +
  `  Isto confere a FORMA, não o sentido. Leia as regras novas antes de publicar.\n`
);
