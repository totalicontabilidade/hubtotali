/* ============================================================
   Hub Totali · Lista de sistemas
   ------------------------------------------------------------
   ESTE É O ÚNICO ARQUIVO QUE PRECISA SER EDITADO NO DIA A DIA.

   Cada setor tem um ESTILO, e é ele que decide quanto espaço os
   links daquele setor ocupam na tela:

     estilo:"cartao"  cartão grande, com logo do site, sempre à
                      vista. Para o que se abre todo dia.

     estilo:"gaveta"  fica FECHADO. Vira uma linha só, com o nome
                      do setor e quantos links tem dentro; abre
                      no clique. Para o que se abre de vez em
                      quando — órgão de governo, consulta
                      pontual. Cada gaveta lembra se a pessoa
                      deixou aberta.

                      Para uma gaveta já nascer aberta, ponha
                      aberto:true no setor.

   Para acrescentar um sistema, copie uma linha e mude os campos:

     { nome:"Como aparece na tela",
       url:"https://endereco-do-sistema",
       nota:"legenda curta (só aparece no estilo cartão)",
       logo:"arquivo.png",     <-- opcional, ver abaixo
       sigla:"XY",             <-- opcional
       verificar:true }        <-- opcional

   LOGO — o desenho do site fica em assets/logos/. Para baixar os
   que faltam depois de acrescentar links novos, rode:

       node ferramentas/baixar-logos.js

   Quem não tiver logo aparece com as iniciais num quadradinho
   dourado. Não quebra, não fica buraco na tela.

   VERIFICAR — acende um ponto âmbar no cartão, marcando "este
   endereço ainda não foi conferido por ninguém". Confira o link
   e apague a linha; o ponto some.

   A ordem dos setores e dos itens é a mesma que aparece na tela.
   ============================================================ */

const SETORES = [

  /* ============ CAMADA 1 — cartão grande, uso diário ============ */

  /* Os três primeiros da tela. Sistema sem endereço aparece
     apagado, sem clique — é o aviso de que falta colar o link. */
  {
    id: "principais",
    titulo: "Principais",
    nota: "O que se abre primeiro",
    estilo: "cartao",
    itens: [
      { nome:"Confi Tarefas", url:"https://app.confi.net.br/",  nota:"Tarefas, prazos e controle do que fazer" },
      { nome:"Confi Chat",    url:"https://chat.confi.net.br/", nota:"Atendimento e conversa com o cliente" },
      { nome:"Gmail",         url:"https://mail.google.com/", nota:"E-mail da Totali" },
    ]
  },

  {
    id: "totali",
    titulo: "Nossos sistemas",
    nota: "Feitos aqui dentro",
    estilo: "cartao",
    destaque: true,
    itens: [
      { nome:"Portal do Cliente",  url:"https://totalicontabilidade.github.io/portaldocliente/",            nota:"Onboarding · visão do cliente" },
      { nome:"Painel da Equipe",   url:"https://totalicontabilidade.github.io/portaldocliente/equipe.html", nota:"Clientes, pendências, mensagens" },
      { nome:"Atos Societários",   url:"https://totalicontabilidade.github.io/atos-societarios/",           nota:"Gerador de contratos e alterações" },
      { nome:"GeRescisão",         url:"https://gerescisao-cloud.web.app/",                                 nota:"Cálculo de verbas rescisórias", verificar:true },
    ]
  },

  {
    id: "diario",
    titulo: "Do dia a dia",
    nota: "O que fica aberto o tempo todo",
    estilo: "cartao",
    itens: [
      { nome:"Econet",         url:"https://www.econeteditora.com.br/", nota:"Legislação e tabelas" },
      { nome:"Google Drive",   url:"https://drive.google.com/",      nota:"Arquivos compartilhados" },
      { nome:"Google Agenda",  url:"https://calendar.google.com/",   nota:"Compromissos da equipe" },
      { nome:"WhatsApp Web",   url:"https://web.whatsapp.com/",      nota:"Atendimento ao cliente" },
      { nome:"Claude",         url:"https://claude.ai/",             nota:"Assistente de IA" },
    ]
  },

  /* ====== CAMADA 2 — gavetas fechadas, uso pontual ====== */

  {
    id: "fiscal",
    titulo: "Fiscal",
    nota: "Órgãos e obrigações",
    estilo: "gaveta",
    itens: [
      { nome:"e-CAC",            url:"https://cav.receita.fazenda.gov.br/autenticacao/login" },
      { nome:"Simples Nacional", url:"https://www8.receita.fazenda.gov.br/SimplesNacional/" },
      { nome:"SEFAZ Sergipe",    url:"https://www.sefaz.se.gov.br/" },
      { nome:"Portal da NF-e",   url:"https://www.nfe.fazenda.gov.br/portal/principal.aspx" },
      { nome:"NFS-e Nacional",   url:"https://www.nfse.gov.br/" },
      { nome:"SPED",             url:"https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/declaracoes-e-demonstrativos/sped" },
    ]
  },

  {
    id: "pessoal",
    titulo: "Pessoal e Trabalhista",
    nota: "Folha, eSocial e FGTS",
    estilo: "gaveta",
    itens: [
      { nome:"eSocial",              url:"https://www.gov.br/esocial/pt-br" },
      { nome:"FGTS Digital",         url:"https://fgtsdigital.sistema.gov.br/" },
      { nome:"Conectividade Social", url:"https://conectividadesocialv2.caixa.gov.br/" },
      { nome:"Novo CAGED",           url:"https://www.gov.br/trabalho-e-emprego/pt-br" },
      { nome:"Meu INSS",             url:"https://meu.inss.gov.br/" },
      { nome:"Mediador · CCT",       url:"https://www3.mte.gov.br/sistemas/mediador/" },
    ]
  },

  {
    id: "legalizacao",
    titulo: "Legalização e Societário",
    nota: "Abertura, alteração e baixa",
    estilo: "gaveta",
    itens: [
      { nome:"JUCESE",       url:"https://www.jucese.se.gov.br/" },
      { nome:"REGIN",        url:"https://regin.jucese.se.gov.br/", verificar:true },
      { nome:"Redesim",      url:"https://www.gov.br/empresas-e-negocios/pt-br/redesim" },
      { nome:"Pref. Aracaju",    url:"https://www.aracaju.se.gov.br/" },
      { nome:"Pref. Itabaiana",  url:"https://www.itabaiana.se.gov.br/", verificar:true },
      { nome:"Bombeiros SE", url:"https://www.bombeiros.se.gov.br/", verificar:true },
    ]
  },

  {
    id: "consultas",
    titulo: "Consultas e certificados",
    nota: "Abre, confere, fecha",
    estilo: "gaveta",
    itens: [
      { nome:"Consulta CNPJ",  url:"https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp" },
      { nome:"Gov.br",         url:"https://www.gov.br/pt-br", sigla:"GOV" },
      { nome:"MEI",            url:"https://www.gov.br/empresas-e-negocios/pt-br/empreendedor" },
      { nome:"Soluti",         url:"https://www.soluti.com.br/" },
      { nome:"CFC",            url:"https://cfc.org.br/", sigla:"CFC" },
      { nome:"Banese",         url:"https://www.banese.com.br/" },
      { nome:"Busca CEP",      url:"https://buscacepinter.correios.com.br/app/endereco/" },
    ]
  },

];

/* ============================================================
   Recados e prazos — a coluna da direita
   ------------------------------------------------------------
   Deixe a lista vazia ([]) para o bloco sumir da tela. O "tipo"
   muda só a cor do ponto:
       "prazo" âmbar  ·  "aviso" azul  ·  "ok" verde
   ============================================================ */

const AVISOS = [
  { tipo:"prazo", titulo:"DAS do Simples", texto:"Vence todo dia 20." },
  { tipo:"prazo", titulo:"eSocial e FGTS Digital", texto:"Fechamento da folha até o dia 15." },
  { tipo:"aviso", titulo:"Este Hub é editável", texto:"Faltou um sistema? Edite js/sistemas.js." },
];

/* ============================================================
   Agenda do mês — os vencimentos que aparecem no centro da tela
   ------------------------------------------------------------
   O "estado" muda só a cor da tarja à esquerda:
       "hoje"  vermelho  ·  "perto" azul-aço  ·  vazio, neutro

   Como o dia é texto e não data, ele vale para todo mês — a
   agenda tributária repete os mesmos vencimentos. Quem edita
   marca à mão o que está perto, na admin.html.
   ============================================================ */

const AGENDA = [
  { dia:"07", nome:"FGTS · Conectividade",   quem:"todos os clientes",   estado:"perto" },
  { dia:"15", nome:"eSocial e FGTS Digital", quem:"fechamento da folha", estado:"perto" },
  { dia:"20", nome:"DAS do Simples",         quem:"todos os optantes",   estado:"" },
  { dia:"20", nome:"INSS e IRRF",            quem:"retenções",           estado:"" },
  { dia:"25", nome:"PIS e COFINS",           quem:"lucro presumido",     estado:"" },
  { dia:"30", nome:"ICMS Sergipe",           quem:"apuração mensal",     estado:"" },
];
