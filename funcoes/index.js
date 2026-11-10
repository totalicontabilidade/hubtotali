/* ============================================================
   funcoes/index.js — a ponte brasileira do robô de notícias
   ------------------------------------------------------------
   A SEFAZ/SE não responde a quem está fora do Brasil, e o robô
   de notícias roda no GitHub, que está. Esta função roda no
   Google Cloud em São Paulo (southamerica-east1), dentro do mesmo
   projeto do Hub, e só faz uma coisa: busca a página que o robô
   pedir e devolve o texto. Nada é guardado.

   SÓ OS SITES DA LISTA, e só páginas públicas. Uma ponte aberta
   para qualquer endereço seria um proxy público pago pela Totali;
   a lista fechada (HOSTS) fecha isso. Não há segredo: o endereço
   da função está no workflow, que é público, e um segredo ali
   também seria — o que protege é a lista e o teto de uso
   (maxInstances e o freio por minuto abaixo).

   Publicar: `firebase deploy --only functions` na raiz do Hub
   (firebase.json aponta para esta pasta). O endereço fica em
   PONTE_URL no workflow .github/workflows/atualizar.yml.
   ============================================================ */
"use strict";

const { onRequest } = require("firebase-functions/v2/https");

/* Os sites que a ponte aceita buscar. Fonte nova que bloqueie o
   GitHub entra aqui E ganha `pelaPonte: true` em FONTES do robô. */
const HOSTS = ["www.sefaz.se.gov.br", "sefaz.se.gov.br"];

const UA = "Mozilla/5.0 (compatible; HubTotali/1.0; +https://hub.totalicontabilidade.com.br)";

/* Freio: o robô pede uma página a cada meia hora; sessenta por
   minuto já é alguém brincando com a ponte. */
let janela = { inicio: 0, pedidos: 0 };
function freio() {
  const agora = Date.now();
  if (agora - janela.inicio > 60000) janela = { inicio: agora, pedidos: 0 };
  janela.pedidos++;
  return janela.pedidos <= 60;
}

exports.ponte = onRequest(
  { region: "southamerica-east1", timeoutSeconds: 40, memory: "256MiB", maxInstances: 1, cors: false },
  async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (req.method !== "GET") { res.status(405).send("Só GET."); return; }
    if (!freio()) { res.status(429).send("Devagar."); return; }

    let alvo;
    try { alvo = new URL(String(req.query.url || "")); } catch (e) { res.status(400).send("url inválida"); return; }
    if (alvo.protocol !== "https:" || !HOSTS.includes(alvo.hostname)) { res.status(403).send("site fora da lista"); return; }

    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 30000);
    try {
      const r = await fetch(alvo.href, {
        headers: { "User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8" },
        signal: ctl.signal, redirect: "follow",
      });
      const corpo = Buffer.from(await r.arrayBuffer());
      res.status(r.status);
      res.set("Content-Type", r.headers.get("content-type") || "application/octet-stream");
      res.set("x-ponte", "southamerica-east1");
      res.send(corpo);
    } catch (e) {
      res.status(502).send("A ponte não conseguiu buscar: " + (e.name === "AbortError" ? "tempo esgotado" : (e.message || e)));
    } finally { clearTimeout(t); }
  }
);
