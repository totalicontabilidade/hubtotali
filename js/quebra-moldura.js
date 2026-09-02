/* ============================================================
   Hub Totali · quebra-moldura
   ------------------------------------------------------------
   Impede que a página seja aberta dentro da moldura de outro
   site.

   POR QUE EM JAVASCRIPT, E NÃO NO CABEÇALHO

   A defesa correta contra clickjacking é o cabeçalho HTTP
   X-Frame-Options, ou o frame-ancestors da política de
   segurança. O GitHub Pages não deixa mandar cabeçalho nenhum, e
   frame-ancestors escrito dentro de <meta> o navegador ignora de
   propósito. Sobrou este caminho.

   O RISCO QUE ISTO EVITA: um site qualquer embute a administração
   numa moldura transparente por cima de botões falsos. O
   administrador acha que está clicando numa coisa e está
   clicando em outra — inclusive em "desligar pessoa" ou
   "apagar". Como a sessão dele já está aberta, o clique vale.
   ============================================================ */

(function () {
  "use strict";
  if (window.top === window.self) return;

  document.documentElement.textContent =
    "Esta página não pode ser aberta dentro de outro site.";
  try {
    window.top.location = window.self.location;
  } catch (e) {
    /* Outra origem não deixa nem redirecionar. A página já foi
       esvaziada acima, que é o que importa. */
  }
})();
