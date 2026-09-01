/* ============================================================
   Hub Totali · ligação com o banco
   ------------------------------------------------------------
   JÁ ESTÁ LIGADO. Este arquivo não precisa mais ser tocado no
   dia a dia — tudo se edita pela página admin.html.

   Projeto Firebase: hubtotali (criado em 01/09/2026)
   Banco: Firestore, edição Standard, São Paulo (southamerica-east1)
   Documento: hub/config — um só, com a lista inteira dentro
   Regras: firestore.rules, nesta mesma pasta

   PARA TROCAR DE ADMINISTRADOR, são DOIS lugares, e os dois
   precisam ter o mesmo UID: o ADMIN_UID aqui embaixo e a linha
   do request.auth.uid em firestore.rules (que precisa ser
   publicada de novo no console). Mudar só um dos dois deixa a
   pessoa entrando na tela e levando erro ao salvar.

   O UID sai de: console.firebase.google.com → Authentication →
   aba Users → coluna "UID do usuário".

   ------------------------------------------------------------
   Uma coisa que costuma assustar e não deveria: a apiKey abaixo
   fica visível para quem abrir o Hub. É assim mesmo — no
   Firebase ela não é senha, é só o endereço do projeto. Quem
   protege o banco são as REGRAS, que deixam qualquer um LER a
   lista de links (ela é pública de qualquer jeito) e só deixam
   o administrador ESCREVER.
   ============================================================ */

const CONFIG_HUB = {

  /* Do app web do console (ícone </>) */
  apiKey:    "AIzaSyAzLwPqnZCANoUxy75GdsJhPWAPYAx_85E",
  projectId: "hubtotali",

  /* Do Authentication → Users → UID do usuário */
  ADMIN_UID: "UMBvjqMpw2bEbpvBIZnhE5iwlB23",

};
