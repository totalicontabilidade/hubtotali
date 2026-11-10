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

   Publicar: `firebase.cmd deploy --only functions` na raiz do Hub
   (firebase.json aponta para esta pasta). O endereço fica em
   PONTE_URL no workflow .github/workflows/atualizar.yml.

   O RELÓGIO (mais abaixo) é a segunda função: o agendamento do
   próprio GitHub pula rodadas à vontade (em 10/11/2026 não fez
   nenhuma das oito da manhã), então o Google Cloud Scheduler, que
   é pontual, é quem manda o robô rodar de meia em meia hora.
   ============================================================ */
"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");

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
  /* invoker "public": o robô do GitHub chama sem conta do Google;
     a lista HOSTS e o freio são o que protegem. */
  { region: "southamerica-east1", invoker: "public", timeoutSeconds: 40, memory: "256MiB", maxInstances: 1, cors: false },
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

/* ============================================================
   relogio — dispara o robô de notícias no GitHub
   ------------------------------------------------------------
   De meia em meia hora em dia útil, das 7h05 às 19h35 de Brasília,
   pede ao GitHub para rodar o workflow "Atualizar notícias e
   agenda" (o mesmo botão "Run workflow" da aba Actions). O robô
   continua sendo o do GitHub; aqui é só o despertador.

   GITHUB_DISPARO é um token do GitHub de permissão mínima: só o
   repositório hubtotali e só "Actions: leitura e escrita". Fica
   no Secret Manager do projeto, nunca no código:
     firebase.cmd functions:secrets:set GITHUB_DISPARO --project hubtotali
   Se o token vencer ou for revogado, o relógio falha (aparece no
   log da função) e o agendamento do próprio GitHub segue como reserva.
   ============================================================ */
const GITHUB_DISPARO = defineSecret("GITHUB_DISPARO");
const WORKFLOW = "https://api.github.com/repos/totalicontabilidade/hubtotali/actions/workflows/atualizar.yml/dispatches";

exports.relogio = onSchedule(
  { region: "southamerica-east1", schedule: "5,35 7-19 * * 1-5", timeZone: "America/Sao_Paulo",
    secrets: [GITHUB_DISPARO], timeoutSeconds: 30, memory: "256MiB", maxInstances: 1, retryCount: 1 },
  async () => {
    const r = await fetch(WORKFLOW, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + GITHUB_DISPARO.value(),
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "HubTotali-relogio",
      },
      body: JSON.stringify({ ref: "main" }),
    });
    /* 204 = o GitHub aceitou e pôs o robô na fila. */
    if (r.status !== 204) throw new Error("O GitHub recusou o disparo: HTTP " + r.status + " " + (await r.text()).slice(0, 300));
  }
);
