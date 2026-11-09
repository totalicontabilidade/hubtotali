/* ============================================================
   Hub Totali · configuração do quadro de pendências
   ------------------------------------------------------------
   O quadro veio do sistema "Pendências Totali" e mora aqui dentro
   do Hub. Toda leitura e gravação passa por window.Armazenamento,
   escolhido em js/pendencias/escolher.js:

     hub    → no banco do Hub (Firestore), um quadro por pessoa,
              com os PDFs no Storage. É o modo normal.
     local  → só neste navegador (modo de teste, sem banco:
              node serve.js --teste).

   Os setores que uma conta recebe na primeira vez saem dos
   setores da casa (Dados.SETORES_DA_CASA, da administração), com
   as palavras-chave abaixo onde o nome bater. Depois disso cada
   pessoa muda os seus em "Gerenciar setores".
   ============================================================ */
window.PENDENCIAS_CONFIG = {
  armazenamento: "auto",       // "auto" decide entre hub e local pelo CONFIG_HUB

  // De quanto em quanto tempo busca novidades no banco (ms). O Hub
  // fica aberto o dia inteiro: um minuto é o passo do resto da tela.
  intervaloAtualizacao: 60000,

  // Palavras que puxam o setor sozinhas, por nome de setor da casa.
  // Setor da casa que não está aqui nasce sem palavra nenhuma.
  palavrasPorSetor: {
    "Pessoal":     ["Folha", "Pró-labore", "Prolabore", "FGTS", "DARF INSS", "Convenção", "eSocial", "Rescisão", "Férias", "Admissão"],
    "Fiscal":      ["ISS", "DAE", "ICMS", "ICMS normal", "ICMS antecipado", "Nota fiscal", "SPED", "PGDAS", "DAS", "DCTFWeb", "EFD"],
    "Contábil":    ["Balanço", "Balancete", "Conciliação", "ECD", "ECF", "Razão", "Lançamento"],
    "Financeiro":  ["Honorário", "Honorários", "Boleto", "Cobrança", "Mensalidade"],
    "Legalização": ["Alteração contratual", "Abertura", "Baixa", "Junta", "Alvará", "Certidão", "Contrato social"],
    "Comercial":   ["Proposta", "Orçamento", "Prospecção"],
    "TI":          ["Certificado digital", "Sistema", "Backup"],
  },

  // Cores dadas aos setores, na ordem em que a casa os lista.
  coresPorOrdem: ["violeta", "teal", "verde", "ocre", "rosa", "cinza"],
};
