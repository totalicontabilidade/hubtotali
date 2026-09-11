/* ============================================================
   Hub Totali · só-https
   ------------------------------------------------------------
   Se a página chegou por http://, manda de volta por https://.

   POR QUE ISTO EXISTE

   O Hub mudou de endereço. O endereço antigo continua valendo e
   redireciona para cá — mas redireciona para http://, sem
   criptografia. Quem ainda tem o link velho salvo cai numa
   página onde a senha do login e o token da sessão viajariam
   abertos pela rede, legíveis por qualquer um no caminho (o
   wi-fi do escritório, o provedor, a rede do cliente).

   ISTO É REMENDO, NÃO CONSERTO

   Quando esta linha roda, o navegador já baixou o HTML e este
   próprio arquivo em texto aberto. Quem estivesse no meio do
   caminho poderia tê-los adulterado antes de chegarem aqui —
   inclusive apagando este redirecionamento. O conserto de
   verdade é ligar "Enforce HTTPS" nas configurações do GitHub
   Pages, que faz o servidor recusar http:// antes de entregar
   qualquer coisa. Enquanto isso não estiver ligado, isto aqui
   fecha o caso comum: o link antigo salvo no navegador.

   A exceção é o endereço local, usado para abrir os arquivos
   direto da máquina durante o desenvolvimento.
   ============================================================ */

(function () {
  "use strict";
  if (location.protocol !== "http:") return;
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return;

  /* replace, e não assign: a página insegura não fica no
     histórico para o botão "voltar" trazê-la de novo. */
  location.replace("https:" + location.href.substring(location.protocol.length));
})();
