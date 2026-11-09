/* ============================================================
   Hub Totali · teste do "entender a frase" do quadro
   ------------------------------------------------------------
   Prazo, data e setor tirados do texto digitado ou ditado:
   "DAE da Empresa Alfa até sexta no fiscal" vira uma pendência
   com data na sexta, no setor Fiscal, com o texto "DAE da Empresa
   Alfa". Usa o código de verdade (trecho de js/pendencias/app.js)
   e os setores padrão de js/pendencias/config.js.

       node testes/teste-frases.js

   A data de hoje muda o resultado das datas relativas ("sexta",
   "amanhã"); os casos abaixo só conferem o tipo de prazo.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const raiz = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(raiz, "js", "pendencias", "app.js"), "utf8");
const trecho = app.slice(app.indexOf("const MESES="), app.indexOf("function cortarNoEditor"));

/* Os setores que uma conta recebe na primeira vez, montados como
   escolher.js monta: nomes da casa + palavras da configuração. */
const janela = {};
vm.runInNewContext(fs.readFileSync(path.join(raiz, "js", "pendencias", "config.js"), "utf8"), { window: janela });
const palavras = janela.PENDENCIAS_CONFIG.palavrasPorSetor;
const setores = ["Fiscal", "Contábil", "Pessoal", "Legalização", "Financeiro", "Comercial", "TI"].map((n, i) => ({
  id: n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(), nome: n, cor: "teal", palavras: palavras[n] || [],
}));

const contexto = {
  setores,
  norm: s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
  diaISO: d => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); },
  STATUS: [{ id: "hoje", curto: "Hoje" }, { id: "semana", curto: "Semana" }, { id: "data", curto: "Com data" }, { id: "acompanhar", curto: "Acompanhar" }],
  saida: null,
};
vm.runInNewContext(trecho.replace(/^let manualStatus.*$/m, "") + "\nsaida={entender,cortarComandos};", contexto);
const { entender, cortarComandos } = contexto.saida;

// [frase, setor esperado, status esperado, texto que deve sobrar]
const casos = [
  ["DAE da Empresa Alfa até sexta no fiscal", "fiscal", "data", "DAE da Empresa Alfa"],
  ["Empresa Beta dia 30 de outubro no financeiro", "financeiro", "data", "Empresa Beta"],
  ["Folha da Empresa Gama essa semana e no pessoal", "pessoal", "semana", "Folha da Empresa Gama"],
  ["Processo do cliente para acompanhar", undefined, "acompanhar", "Processo do cliente"],
  ["Reunião amanhã", undefined, "data", "Reunião"],
  ["Conferir folha de hoje", "pessoal", "hoje", "Conferir folha de hoje"],
  ["Cobrar honorários da Empresa Alfa", "financeiro", undefined, "Cobrar honorários da Empresa Alfa"],
  ["Conferir convenções do comércio", "pessoal", undefined, "Conferir convenções do comércio"],
  ["Emitir nota fiscal da Empresa Beta até 25/10", "fiscal", "data", "Emitir nota fiscal da Empresa Beta"],
  ["Folha da Empresa Gama no fiscal", "fiscal", undefined, "Folha da Empresa Gama"],
  /* os setores da casa que o Pendências original não tinha */
  ["Alteração contratual da Delta até dia 28", "legalizacao", "data", "Alteração contratual da Delta"],
  ["Fechar o balancete da Omega esta semana", "contabil", "semana", "Fechar o balancete da Omega"],
  ["Renovar certificado digital do cliente", "ti", undefined, "Renovar certificado digital do cliente"],
  ["Enviar DCTFWeb da Sigma até sexta", "fiscal", "data", "Enviar DCTFWeb da Sigma"],
];

let falhas = 0;
for (const [frase, setor, status, sobra] of casos) {
  const r = entender(frase);
  const resto = cortarComandos(frase, false);
  const ok = r.setor === setor && r.status === status && resto === sobra;
  if (!ok) falhas++;
  console.log((ok ? "ok   " : "FALHA") + " " + JSON.stringify(frase) + " → setor " + (r.setor || "-") + ", prazo " + (r.status || "-") + (r.prazo ? " " + r.prazo : "") + ", texto " + JSON.stringify(resto));
}
console.log(falhas ? falhas + " caso(s) falharam." : "Todos os casos passaram.");
process.exitCode = falhas ? 1 : 0;
