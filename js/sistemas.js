/* ============================================================
   Hub Totali · semente
   ------------------------------------------------------------
   ESTE ARQUIVO NÃO CONTÉM MAIS A LISTA DA CASA.

   A lista real vive no banco e é privada: o Firestore só a
   entrega a quem está na equipe. Aqui ficava uma cópia dela — e
   este arquivo é servido pela web para qualquer pessoa, porque o
   repositório é público. Guardar a lista aqui tornaria a regra
   do banco decorativa: bastaria abrir o endereço deste .js.

   O que sobrou é o mínimo para a tela não quebrar antes de o
   banco responder, e um exemplo de formato para quem for mexer
   no código. Sistema novo se cadastra na tela de administração.

   Os estilos de setor continuam valendo:
     estilo:"cartao"  à vista, com logo. Para o de todo dia.
     estilo:"gaveta"  fechado numa linha só; abre no clique.
   ============================================================ */

const SETORES = [
  {
    titulo: "Principais",
    estilo: "cartao",
    itens: [
      /* { nome:"Nome do sistema", url:"https://endereco", nota:"o que é" }, */
    ],
  },
];

const AVISOS = [
  /* { tipo:"prazo", titulo:"DAS do Simples", texto:"Vence todo dia 20." }, */
];

/* A agenda do mês é CALCULADA por js/agenda.js, não listada aqui.
   Esta lista só entra se alguém gravar uma à mão pelo banco. */
const AGENDA = [
];
