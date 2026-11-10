/* ============================================================
   buscar-fonte-local.js — o robô que roda NESTE computador
   ------------------------------------------------------------
   A SEFAZ/SE responde de dentro do Brasil, mas não aos servidores
   do GitHub, que ficam fora. Então quem lê a SEFAZ é este script,
   rodando no computador do escritório (tarefa agendada do Windows,
   de meia em meia hora — ver robo-local.cmd), e o resultado vai
   para dados/fontes/<id>.json, no mesmo repositório. O robô do
   GitHub (buscar-noticias.js), quando a fonte não lhe responde,
   usa esse arquivo como se tivesse lido o site.

   Uso: node ferramentas/buscar-fonte-local.js [id da fonte ...]
   Sem argumento, lê as fontes marcadas com `local: true` em FONTES
   (hoje, só a sefaz-se). Grava só se mudou — commit por nada é
   lixo no histórico.
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const robo = require("./buscar-noticias.js");

const PASTA = path.join(__dirname, "..", "dados", "fontes");

async function principal() {
  const pedidas = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const fontes = robo.FONTES.filter(f => pedidas.length ? pedidas.includes(f.id) : f.local === true);
  if (!fontes.length) { console.error("Nenhuma fonte para ler (ids: " + robo.FONTES.map(f => f.id).join(", ") + ")."); process.exitCode = 1; return; }
  fs.mkdirSync(PASTA, { recursive: true });

  let falhas = 0;
  for (const f of fontes) {
    const arquivo = path.join(PASTA, f.id + ".json");
    try {
      const lista = await robo.lerFonte(f);
      lista.forEach(n => { delete n._doRamo; });
      const saida = { formato: "hub-totali-fonte", versao: 1, fonte: f.id, atualizadoEm: new Date().toISOString(), noticias: lista };
      let anterior = null;
      try { anterior = JSON.parse(fs.readFileSync(arquivo, "utf8")); } catch (e) { /* primeira vez */ }
      const mesmas = anterior && JSON.stringify(anterior.noticias) === JSON.stringify(lista);
      const velho = !anterior || !anterior.atualizadoEm || Date.now() - Date.parse(anterior.atualizadoEm) > 6 * 3600e3;
      if (mesmas && !velho && !process.argv.includes("--forcar")) {
        console.log("igual " + f.nome + ": " + lista.length + " notícias, arquivo mantido.");
        continue;
      }
      fs.writeFileSync(arquivo, JSON.stringify(saida, null, 1) + "\n");
      console.log("ok    " + f.nome + ": " + lista.length + " notícias → " + path.relative(process.cwd(), arquivo));
    } catch (e) {
      falhas++;
      console.log("FALHA " + f.nome + ": " + (e.message || e));
    }
  }
  if (falhas === fontes.length) process.exitCode = 1;
}

principal().catch(e => { console.error(e); process.exitCode = 1; });
