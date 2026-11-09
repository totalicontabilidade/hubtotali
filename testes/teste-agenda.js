/* ============================================================
   Hub Totali · teste da agenda tributária
   ------------------------------------------------------------
   As datas que a Receita publicou, reproduzidas pela regra. Se o
   motor deixar de reproduzi-las, alguma regra foi mexida sem
   querer. E o cruzamento com a agenda oficial: dia igual confere,
   dia diferente avisa, obrigação desconhecida vira extra.

       node testes/teste-agenda.js
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const raiz = path.join(__dirname, "..");
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(raiz, "js", "agenda.js"), "utf8") + "\nthis.Agenda = Agenda;", ctx);
const Agenda = ctx.Agenda;

let falhas = 0;
function afirmar(oque, cond, detalhe) {
  console.log((cond ? "ok   " : "FALHA") + " " + oque + (cond ? "" : "  → " + detalhe));
  if (!cond) falhas++;
}
function diaDe(lista, nome) {
  const x = lista.filter(i => i.nome === nome)[0];
  return x ? x.dia : "(não apareceu)";
}

/* Agosto de 2026, como a Receita publicou. */
const ago = Agenda.doMes(new Date(2026, 7, 1));
afirmar("EFD-Contribuições em 14/ago (10º dia útil)", diaDe(ago, "EFD-Contribuições") === "14", diaDe(ago, "EFD-Contribuições"));
afirmar("EFD-Reinf em 17/ago (15 caiu no sábado, adia)", diaDe(ago, "EFD-Reinf") === "17", diaDe(ago, "EFD-Reinf"));
afirmar("DCTFWeb em 31/ago (último dia útil)", diaDe(ago, "DCTFWeb") === "31", diaDe(ago, "DCTFWeb"));

/* Setembro separa as duas regras: no mesmo dia 20 da lei, tributo
   federal antecipa e Simples adia. 20/09/2026 é domingo. */
const set = Agenda.doMes(new Date(2026, 8, 1));
afirmar("FGTS em 18/set (antecipa do domingo)", diaDe(set, "FGTS") === "18", diaDe(set, "FGTS"));
afirmar("DAS em 21/set (adia do domingo)", diaDe(set, "DAS do Simples") === "21", diaDe(set, "DAS do Simples"));

/* Novembro de 2026: dia 20 é feriado (Consciência Negra), uma sexta. */
const nov = Agenda.doMes(new Date(2026, 10, 1));
afirmar("INSS e IRRF em 19/nov (antecipa do feriado)", diaDe(nov, "INSS e IRRF") === "19", diaDe(nov, "INSS e IRRF"));
afirmar("PGDAS-D em 23/nov (adia do feriado)", diaDe(nov, "PGDAS-D") === "23", diaDe(nov, "PGDAS-D"));
afirmar("EFD-Contribuições em 16/nov (10º dia útil, com Finados)", diaDe(nov, "EFD-Contribuições") === "16", diaDe(nov, "EFD-Contribuições"));
afirmar("13º · 1ª parcela em 30/nov", diaDe(nov, "13º · 1ª parcela") === "30", diaDe(nov, "13º · 1ª parcela"));
afirmar("ICMS normal (SE) em 09/nov (adia no mês)", diaDe(nov, "ICMS normal e FCP") === "09", diaDe(nov, "ICMS normal e FCP"));

/* Anuais só no mês delas. */
afirmar("DEFIS só em março", diaDe(Agenda.doMes(new Date(2026, 2, 1)), "DEFIS") === "31" && diaDe(nov, "DEFIS") === "(não apareceu)");
afirmar("ECF no último dia útil de julho", diaDe(Agenda.doMes(new Date(2026, 6, 1)), "ECF") === "31");
afirmar("DASN-SIMEI em 31/mai", diaDe(Agenda.doMes(new Date(2026, 4, 1)), "DASN-SIMEI") === "31");
afirmar("IRPJ trimestral só em jan/abr/jul/out", diaDe(nov, "IRPJ e CSLL") === "(não apareceu)" && diaDe(Agenda.doMes(new Date(2026, 9, 1)), "IRPJ e CSLL") !== "(não apareceu)");

/* ---------- o cruzamento com a agenda oficial ---------- */
const oficial = {
  ano: 2026, mes: 11, ade: "ADE Corat nº 85/2026",
  dias: [
    { data: "2026-11-16", url: "u16", declaracoes: [{ nome: "EFD-Reinf – Escrituração" }, { nome: "EFD-Contribuições – Escrituração" }], pagamentos: [] },
    { data: "2026-11-19", url: "u19", declaracoes: [], pagamentos: [{ codigo: "0561", grupo: "IRRF" }] },
    { data: "2026-11-20", url: "u20", declaracoes: [{ nome: "Dirbi – Declaração de Incentivos" }], pagamentos: [] },
    { data: "2026-11-23", url: "u23", declaracoes: [{ nome: "PGDAS-D – Programa Gerador" }], pagamentos: [{ codigo: "--", grupo: "Simples Nacional" }] },
    { data: "2026-11-30", url: "u30", declaracoes: [{ nome: "DCTFWeb – Declaração" }, { nome: "DME – Declaração de Operações" }, { nome: "Nova Obrigação – Teste" }], pagamentos: [] },
  ],
};
const r = Agenda.cruzar(nov, oficial);
const item = nome => r.itens.filter(i => i.nome === nome)[0];
afirmar("EFD-Reinf confere (16)", item("EFD-Reinf").confere === true && item("EFD-Reinf").oficialDia === "16");
afirmar("INSS e IRRF confere pelo código 0561 (19)", item("INSS e IRRF").confere === true);
afirmar("DAS confere pelo grupo Simples Nacional (23)", item("DAS do Simples").confere === true);
afirmar("DIRBI diverge: regra 23, Receita 20", item("DIRBI").confere === false && item("DIRBI").oficialDia === "20" && item("DIRBI").dia === "23", JSON.stringify(item("DIRBI")));
afirmar("DCTFWeb confere (30)", item("DCTFWeb").confere === true);
afirmar("eSocial não tem contraparte e fica como está", item("eSocial").oficialDia === undefined);
afirmar("extra: a obrigação desconhecida aparece; a DME ignorada não", r.extras.length === 1 && r.extras[0].nome === "Nova Obrigação", JSON.stringify(r.extras));
afirmar("ADE repassado", r.ade === "ADE Corat nº 85/2026");

/* A conferência com o arquivo de verdade, se existir. */
try {
  const real = JSON.parse(fs.readFileSync(path.join(raiz, "dados", "agenda-oficial.json"), "utf8"));
  const mesReal = real.meses.filter(m => m.ano === 2026 && m.mes === 11)[0];
  if (mesReal) {
    const rr = Agenda.cruzar(nov, mesReal);
    const divergentes = rr.itens.filter(i => i.oficialDia && !i.confere).map(i => i.nome + " regra " + i.dia + " / Receita " + i.oficialDia);
    const conferidos = rr.itens.filter(i => i.confere).map(i => i.nome);
    console.log("     novembro/2026 de verdade — conferidos: " + conferidos.join(", "));
    console.log("     novembro/2026 de verdade — divergentes: " + (divergentes.join("; ") || "nenhum"));
    afirmar("arquivo real: pelo menos cinco obrigações conferem", conferidos.length >= 5, conferidos.length);
  }
} catch (e) { console.log("     (sem dados/agenda-oficial.json para novembro: pulado)"); }

console.log(falhas ? falhas + " caso(s) falharam." : "Todos os casos passaram.");
process.exitCode = falhas ? 1 : 0;
