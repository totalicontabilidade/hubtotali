/* ============================================================
   Hub Totali · agenda tributária que se calcula sozinha
   ------------------------------------------------------------
   POR QUE NÃO UMA API DO GOVERNO

   Procurei. Não existe. O dados.gov.br exige chave e não publica
   esse conjunto; a Receita divulga a agenda como página e
   planilha mensal, feitas para gente ler, não para programa. Ler
   aquela página por raspagem quebraria no primeiro dia em que o
   governo trocasse o leiaute — e quebraria calado, que é o pior
   jeito de quebrar numa tela de prazo fiscal.

   O QUE FUNCIONA MELHOR, E É O QUE ESTÁ AQUI

   A agenda tributária não é imprevisível: ela é uma REGRA. DAS
   no dia 20, eSocial no 15, PIS/COFINS no 25 — todo mês, o ano
   inteiro. O que varia é só o que acontece quando a data cai em
   fim de semana ou feriado, e isso também é regra: uns
   antecipam para o dia útil anterior, outros adiam para o
   seguinte.

   Então o Hub CALCULA as datas do mês corrente a partir das
   regras abaixo, e recalcula sozinho na virada de todo mês, para
   sempre, sem depender de ninguém publicar nada. Feriado
   nacional também é calculado — inclusive os móveis, que saem da
   data da Páscoa.

   ------------------------------------------------------------
   ATENÇÃO, E ISTO É IMPORTANTE

   As regras da tabela REGRAS foram escritas por mim a partir do
   uso comum. Prazo fiscal é matéria do contador, não minha:
   CONFIRA CADA LINHA antes de a equipe confiar nela. O campo
   "conferir: true" marca as que eu tenho menos certeza, e some
   quando você tirar a linha.
   ============================================================ */

const Agenda = (function () {
  "use strict";

  /* ---------- as regras ----------
     dia      · o vencimento no mês seguinte ao fato gerador
     ajuste   · "antecipa" (vai para o dia útil anterior) ou
                "adia" (vai para o dia útil seguinte)
     conferir · marca o que eu não tenho certeza                */
  var REGRAS = [
    { nome:"eSocial e FGTS Digital", quem:"fechamento da folha",   dia:15, ajuste:"antecipa" },
    { nome:"DCTFWeb",                quem:"competência anterior",  dia:15, ajuste:"antecipa" },
    { nome:"DAS do Simples",         quem:"todos os optantes",     dia:20, ajuste:"adia" },
    { nome:"INSS e IRRF",            quem:"retenções na fonte",    dia:20, ajuste:"antecipa" },
    { nome:"PIS e COFINS",           quem:"lucro presumido e real",dia:25, ajuste:"antecipa" },
    { nome:"ICMS Sergipe",           quem:"apuração mensal",       dia:10, ajuste:"adia", conferir:true },
    { nome:"ISS Itabaiana",          quem:"serviços do mês",       dia:10, ajuste:"adia", conferir:true },
    { nome:"EFD-Contribuições",      quem:"escrituração",          dia:10, ajuste:"antecipa", conferir:true },
    { nome:"SPED Fiscal",            quem:"EFD ICMS/IPI",          dia:15, ajuste:"antecipa", conferir:true },
  ];

  /* ---------- feriados ----------
     Os fixos são lista; os móveis saem todos da Páscoa. Uso o
     algoritmo de Meeus, que é o mesmo que a Igreja usa e vale
     para qualquer ano do calendário gregoriano. */
  function pascoa(ano) {
    var a = ano % 19,
        b = Math.floor(ano / 100), c = ano % 100,
        d = Math.floor(b / 4), e = b % 4,
        f = Math.floor((b + 8) / 25),
        g = Math.floor((b - f + 1) / 3),
        h = (19 * a + b - d - g + 15) % 30,
        i = Math.floor(c / 4), k = c % 4,
        l = (32 + 2 * e + 2 * i - h - k) % 7,
        m = Math.floor((a + 11 * h + 22 * l) / 451),
        mes = Math.floor((h + l - 7 * m + 114) / 31),
        dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(ano, mes - 1, dia);
  }

  function somarDias(data, n) {
    var d = new Date(data.getTime());
    d.setDate(d.getDate() + n);
    return d;
  }

  function chave(d) {
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  /* Feriados nacionais e os dias em que o banco não abre. Carnaval
     e a quarta-feira de cinzas até o meio-dia não são feriado por
     lei, mas não há expediente bancário — e o que importa para
     vencimento é o expediente, não a lei. */
  function feriados(ano) {
    var p = pascoa(ano);
    var lista = [
      new Date(ano, 0, 1),    /* Confraternização */
      new Date(ano, 3, 21),   /* Tiradentes */
      new Date(ano, 4, 1),    /* Trabalho */
      new Date(ano, 8, 7),    /* Independência */
      new Date(ano, 9, 12),   /* Aparecida */
      new Date(ano, 10, 2),   /* Finados */
      new Date(ano, 10, 15),  /* Proclamação da República */
      new Date(ano, 10, 20),  /* Consciência Negra */
      new Date(ano, 11, 25),  /* Natal */
      somarDias(p, -48),      /* segunda de carnaval */
      somarDias(p, -47),      /* terça de carnaval */
      somarDias(p, -2),       /* sexta-feira santa */
      somarDias(p, 60),       /* Corpus Christi */
    ];
    var mapa = {};
    lista.forEach(function (d) { mapa[chave(d)] = true; });
    return mapa;
  }

  var CACHE_FERIADOS = {};
  function ehDiaUtil(d) {
    if (d.getDay() === 0 || d.getDay() === 6) return false;
    var ano = d.getFullYear();
    if (!CACHE_FERIADOS[ano]) CACHE_FERIADOS[ano] = feriados(ano);
    return !CACHE_FERIADOS[ano][chave(d)];
  }

  function ajustar(d, como) {
    var passo = (como === "adia") ? 1 : -1;
    var limite = 0;
    while (!ehDiaUtil(d) && limite++ < 15) d = somarDias(d, passo);
    return d;
  }

  /* ---------- a agenda do mês ---------- */

  /* Devolve a lista no mesmo formato que a tela espera:
     { dia, nome, quem, estado }. O estado é calculado contra
     HOJE — é ele que pinta a tarja de vermelho ou azul. */
  function doMes(referencia) {
    var hoje = referencia || new Date();
    var ano = hoje.getFullYear(), mes = hoje.getMonth();
    var diaHoje = hoje.getDate();

    return REGRAS.map(function (r) {
      var venc = ajustar(new Date(ano, mes, r.dia), r.ajuste);
      var faltam = Math.round((venc - new Date(ano, mes, diaHoje)) / 86400000);
      return {
        dia: ("0" + venc.getDate()).slice(-2),
        nome: r.nome,
        quem: r.quem,
        estado: faltam === 0 ? "hoje" : (faltam > 0 && faltam <= 5 ? "perto" : ""),
        _ordem: venc.getTime(),
        _passou: faltam < 0,
        conferir: !!r.conferir,
      };
    })
    /* Vencimento que já passou sai da tela: agenda de prazo
       vencido não ajuda ninguém, atrapalha. */
    .filter(function (x) { return !x._passou; })
    .sort(function (a, b) { return a._ordem - b._ordem; });
  }

  return { doMes: doMes, ehDiaUtil: ehDiaUtil, feriados: feriados, REGRAS: REGRAS };

})();
