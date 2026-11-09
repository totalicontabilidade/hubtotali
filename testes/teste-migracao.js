/* ============================================================
   Hub Totali · teste da migração do quadro antigo
   ------------------------------------------------------------
   Uma pendência do modelo antigo (pendencias/{id}, com andamento)
   tem de virar uma tarefa do quadro certo, com a forma que a regra
   do banco aceita. E a lista de clientes de uma planilha tem de
   virar a lista da casa.

       node testes/teste-migracao.js
   ============================================================ */
"use strict";
const path = require("path");
const { MigracaoQuadro } = require(path.join(__dirname, "..", "js", "migracao-quadro.js"));
const { Planilha } = require(path.join(__dirname, "..", "js", "planilha.js"));

let falhas = 0;
function afirmar(oque, cond, detalhe) {
  console.log((cond ? "ok   " : "FALHA") + " " + oque + (cond ? "" : "  → " + JSON.stringify(detalhe)));
  if (!cond) falhas++;
}

const equipe = [
  { uid: "u-hesley", nome: "Hesley", setores: ["Legalização", "TI"], ativo: true },
  { uid: "u-hilany", nome: "Hilany", setores: ["Contábil"], ativo: true },
  { uid: "u-rodrigo", nome: "Rodrigo", setores: ["Contábil"], ativo: true },
  { uid: "u-raoni", nome: "Raoni", setores: ["Diretoria"], ativo: true },
];
const ctx = {
  equipe: equipe,
  euUid: "u-raoni", euEmail: "raoni@totali",
  agora: Date.parse("2026-11-09T18:00:00-03:00"),
  setoresDoDono: { "u-hilany": [{ id: "contabil", nome: "Contábil" }], "u-hesley": [{ id: "legalizacao", nome: "Legalização" }] },
};

/* ---------- a pendência aberta, com responsável ---------- */
const aberta = {
  _id: "0dd2S0Yqtqd6aCvUg5KU",
  oque: "HELP", porque: "Contabilizar 1º semestre/2026", sugestao: "",
  responsavel: "u-hilany", criadoPor: "u-hilany", envolvidos: [],
  prazo: "2026-09-16", setorDestino: "Contábil", setorOrigem: "Contábil",
  situacao: "aberta", urgencia: "urgente",
  criadoEm: "2026-09-15T11:55:40.000Z",
  _andamento: [
    { autor: "u-hesley", autorNome: "Hesley", texto: "Vi aqui.", criadoEm: "2026-09-15T12:00:00.000Z" },
    { autor: "u-hilany", autorNome: "Hilany", texto: "", apagado: true, criadoEm: "2026-09-15T12:01:00.000Z" },
  ],
  _anexos: [{ nome: "x.pdf" }],
};
let r = MigracaoQuadro.converter(aberta, ctx);
afirmar("vai para o quadro do responsável", r.uid === "u-hilany", r);
afirmar("com prazo vira 'Com data' e guarda o prazo", r.doc.status === "data" && r.doc.prazo === "2026-09-16", r.doc);
afirmar("urgente vira importante", r.doc.importante === true, r.doc.importante);
afirmar("não está riscada", r.doc.feito === false && r.doc.feitoEm === null, r.doc);
afirmar("texto começa pelo 'o quê' e traz o porquê", /^HELP\nPor quê: Contabilizar/.test(r.doc.texto), r.doc.texto);
afirmar("html tem a primeira linha em negrito", r.doc.html.indexOf("<b>HELP</b><br>Por quê:") === 0, r.doc.html);
afirmar("setor cai no id do setor do dono", r.doc.setor === "contabil", r.doc.setor);
afirmar("comentário apagado não vem; o outro vem com o nome", r.doc.notas.length === 3 && r.doc.notas[1].t === "Hesley: Vi aqui.", r.doc.notas);
afirmar("a nota do anexo está lá", /Tinha 1 anexo/.test(r.doc.notas[2].t), r.doc.notas[2]);
afirmar("assinada por quem migra, com a origem", r.doc.criadoPorUid === "u-raoni" && r.doc.origemSistema === "hub-antigo" && r.doc.origemId === "0dd2S0Yqtqd6aCvUg5KU", r.doc);
afirmar("criadoEm é número (ms)", typeof r.doc.criadoEm === "number" && r.doc.criadoEm === Date.parse("2026-09-15T11:55:40.000Z"), r.doc.criadoEm);

/* ---------- resolvida: riscada na hora do último comentário ---------- */
const resolvida = Object.assign({}, aberta, { _id: "b", situacao: "resolvida", prazo: "", urgencia: "normal", _anexos: [] });
r = MigracaoQuadro.converter(resolvida, ctx);
afirmar("resolvida vira riscada", r.doc.feito === true, r.doc.feito);
afirmar("hora da riscada = último comentário", r.doc.feitoEm === Date.parse("2026-09-15T12:01:00.000Z"), r.doc.feitoEm);
afirmar("sem prazo e sem urgência vai para Acompanhar", r.doc.status === "acompanhar" && r.doc.prazo === null, r.doc);

/* ---------- sem responsável: setor com uma pessoa só ---------- */
r = MigracaoQuadro.converter({ _id: "c", oque: "Alvará", setorDestino: "Legalização", criadoPor: "u-raoni", situacao: "aberta", urgencia: "urgente" }, ctx);
afirmar("setor de destino com uma pessoa só → ela", r.uid === "u-hesley" && /única pessoa/.test(r.como), r);
afirmar("urgente sem prazo vai para Hoje", r.doc.status === "hoje", r.doc.status);
afirmar("diz quem pediu quando não é o dono", /Pedido por Raoni/.test(r.doc.texto), r.doc.texto);

/* ---------- sem responsável: setor com duas pessoas → quem pediu ---------- */
r = MigracaoQuadro.converter({ _id: "d", oque: "Balancete", setorDestino: "Contábil", criadoPor: "u-raoni", situacao: "aberta" }, ctx);
afirmar("setor com duas pessoas → quem pediu", r.uid === "u-raoni" && /quem pediu/.test(r.como), r);

/* ---------- recado e sem dono ---------- */
afirmar("recado é pulado", MigracaoQuadro.converter({ _id: "e", oque: "Aviso", ehRecado: true }, ctx).motivo === "recado");
afirmar("sem ninguém é pulada", MigracaoQuadro.converter({ _id: "f", oque: "?" }, ctx).motivo === "sem dono");

/* ---------- o plano ---------- */
const plano = MigracaoQuadro.planejar({ pendencias: [aberta, resolvida, { _id: "e", oque: "Aviso", ehRecado: true }], reservadas: [{ _id: "g", oque: "Reservada", responsavel: "u-hesley", situacao: "aberta" }] },
  Object.assign({}, ctx, { existentes: { "u-hilany": ["b"] } }));
afirmar("plano conta abertas, riscadas, recados e já trazidas", plano.itens.length === 2 && plano.recados === 1 && plano.jaTrazidas === 1 && plano.abertas === 2, plano);
afirmar("plano por dono", plano.porDono["u-hilany"] === 1 && plano.porDono["u-hesley"] === 1, plano.porDono);
afirmar("reservada vem marcada na nota", /era reservada/.test(plano.itens[1].doc.notas[0].t), plano.itens[1].doc.notas[0]);

/* ---------- a forma que a regra do banco exige ---------- */
const d = plano.itens[0].doc;
afirmar("campos na forma da regra", typeof d.texto === "string" && d.texto.length <= 6000 && typeof d.html === "string" &&
  ["hoje", "semana", "data", "acompanhar"].indexOf(d.status) !== -1 && Array.isArray(d.notas) && d.notas.length <= 200 &&
  typeof d.criadoPorUid === "string" && d.criadoPorUid.length <= 128 && (d.origemId.length <= 120), d);
afirmar("id novo tem 20 caracteres", MigracaoQuadro.novoId().length === 20);

/* ---------- a planilha de clientes ---------- */
const csv = "Nome;CNPJ / CPF;Regime tributário;Estado;Cidade\nTOTALI SOLUCOES CONTABEIS LTDA;62.269.366/0001-18;Simples Nacional;SE;Itabaiana\n\"ARISILDA SANTOS\";255.698.725-15;Pessoa Física;SE;Ribeirópolis\nSEM DOC;;x;SE;Y\n";
const linhas = Planilha.lerCsv(csv);
afirmar("csv com ; separa em 5 colunas", linhas[0].length === 5 && linhas[1][0] === "TOTALI SOLUCOES CONTABEIS LTDA", linhas);
const clientes = Planilha.paraClientes(linhas);
afirmar("acha as colunas pelo cabeçalho e ignora quem não tem documento", clientes.length === 2 && clientes[0].cnpj === "62269366000118" && clientes[1].cnpj === "25569872515" && clientes[1].cidade === "Ribeirópolis", clientes);
const semCab = Planilha.paraClientes([["Alfa Ltda", "12.345.678/0001-95"], ["Beta", "11.111.111/0001-11", "MEI"]]);
afirmar("sem cabeçalho vale a ordem", semCab.length === 2 && semCab[1].regime === "MEI", semCab);
const tab = Planilha.lerCsv("Nome\tCNPJ\nX\t12.345.678/0001-95");
afirmar("tab também separa", tab[1][1] === "12.345.678/0001-95", tab);

console.log(falhas ? "\n" + falhas + " falha(s)." : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
