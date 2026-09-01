/* ============================================================
   Baixa o logo de cada site listado em js/sistemas.js
   ------------------------------------------------------------
   Rode da raiz do projeto:

       node ferramentas/baixar-logos.js

   Os arquivos caem em assets/logos/ e passam a ser servidos pela
   nossa própria pasta. Isso é de propósito, e por dois motivos:

     1. Velocidade — 30 imagens de fora, toda vez que alguém abre
        o navegador, é meio segundo de espera por nada.
     2. Privacidade — buscar o ícone de cada site num serviço de
        terceiro conta a esse terceiro, toda manhã, quais sistemas
        a Totali usa. Baixando uma vez, ninguém fica sabendo.

   Quem já tem arquivo não é baixado de novo. Para forçar:

       node ferramentas/baixar-logos.js --tudo
   ============================================================ */

const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

const RAIZ = path.join(__dirname, "..");
const DESTINO = path.join(RAIZ, "assets", "logos");
const REFAZER = process.argv.includes("--tudo");

/* ---------- lê a lista ----------
   A lista de verdade mora no Firestore (é o que a administração
   edita). Só se o banco não estiver ligado, ou não responder, é
   que caio na semente de js/sistemas.js. É isso que faz a
   ferramenta pegar os sistemas cadastrados pela tela, e não só
   os que estão escritos no código. */
function lerConfig() {
  const fonte = fs.readFileSync(path.join(RAIZ, "js", "config-hub.js"), "utf8");
  try { return new Function(fonte + "; return CONFIG_HUB;")(); }
  catch (e) { return {}; }
}

function lerSemente() {
  const fonte = fs.readFileSync(path.join(RAIZ, "js", "sistemas.js"), "utf8");
  return new Function(fonte + "; return SETORES;")();
}

async function lerSistemas() {
  const cfg = lerConfig();
  if (!cfg.apiKey || !cfg.projectId) {
    console.log("Banco não configurado — usando a semente de js/sistemas.js.\n");
    return lerSemente();
  }

  try {
    const url = "https://firestore.googleapis.com/v1/projects/" + cfg.projectId +
                "/databases/(default)/documents/hub/config?key=" + encodeURIComponent(cfg.apiKey);
    const doc = JSON.parse((await baixar(url)).toString("utf8"));
    if (doc.error) throw new Error(doc.error.message);
    const d = JSON.parse(doc.fields.json.stringValue);
    console.log("Lendo a lista do banco (" + cfg.projectId + ").\n");
    return d.setores || [];
  } catch (e) {
    console.log("Não consegui ler o banco (" + e.message + ").");
    console.log("Usando a semente de js/sistemas.js.\n");
    return lerSemente();
  }
}

/* ---------- nome de arquivo a partir do nome do sistema ---------- */
function apelido(nome) {
  return nome.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function baixar(url, redirecionamentos = 0) {
  return new Promise((ok, erro) => {
    if (redirecionamentos > 4) return erro(new Error("redirecionou demais"));
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0 HubTotali" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return ok(baixar(new URL(res.headers.location, url).href, redirecionamentos + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return erro(new Error("HTTP " + res.statusCode)); }
      const pedacos = [];
      res.on("data", (d) => pedacos.push(d));
      res.on("end", () => ok(Buffer.concat(pedacos)));
    }).on("error", erro);
  });
}

/* O serviço do Google devolve um globo cinza genérico quando não
   conhece o site. Como o globo é sempre o MESMO arquivo, dá para
   reconhecê-lo pela impressão digital e recusar — melhor mostrar
   as iniciais do que um globo igual em dez cartões. */
const GLOBOS = new Set();
function digital(buffer) {
  return crypto.createHash("sha1").update(buffer).digest("hex");
}

/* Os sites do governo quase nunca respondem em /favicon.ico e
   quase nunca estão nos serviços de ícone. Mas todos declaram o
   ícone no <head> da própria página. Então, em último caso, leio
   o HTML e vou buscar onde ele mesmo aponta. */
async function logoDeclaradoNoHtml(url) {
  const html = (await baixar(url)).toString("utf8").slice(0, 200000);
  const achados = [];
  const marcador = /<link\b[^>]*>/gi;
  let m;
  while ((m = marcador.exec(html))) {
    const tag = m[0];
    if (!/rel\s*=\s*["'][^"']*icon/i.test(tag)) continue;
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!href) continue;
    const tamanho = tag.match(/sizes\s*=\s*["'](\d+)/i);
    achados.push({ href: href[1], peso: tamanho ? parseInt(tamanho[1], 10) : 32 });
  }
  /* o maior primeiro: 180x180 rende bem melhor que 16x16 */
  achados.sort((a, b) => b.peso - a.peso);
  return achados.map((a) => new URL(a.href, url).href);
}

async function buscarLogo(dominio, urlDoSistema) {
  const tentativas = [
    "https://www.google.com/s2/favicons?sz=128&domain=" + dominio,
    "https://icons.duckduckgo.com/ip3/" + dominio + ".ico",
    "https://" + dominio + "/favicon.ico",
  ];

  try {
    tentativas.push(...(await logoDeclaradoNoHtml(urlDoSistema)));
  } catch (e) { /* site fora do ar ou HTML ilegível: segue sem */ }
  for (const endereco of tentativas) {
    try {
      const dados = await baixar(endereco);
      if (dados.length < 120) continue;               /* vazio ou placeholder 1x1 */
      if (GLOBOS.has(digital(dados))) continue;       /* globo genérico */
      const cabeca = dados.slice(0, 8).toString("hex");
      const inicio = dados.slice(0, 40).toString("utf8").trim().toLowerCase();
      const ext = cabeca.startsWith("89504e47") ? ".png"
                : cabeca.startsWith("ffd8ff")   ? ".jpg"
                : (inicio.startsWith("<svg") || inicio.startsWith("<?xml")) ? ".svg"
                : ".ico";
      return { dados, ext, fonte: new URL(endereco).hostname };
    } catch (e) { /* tenta a próxima */ }
  }
  return null;
}

(async function () {
  fs.mkdirSync(DESTINO, { recursive: true });

  /* Primeiro aprendo como é o globo genérico, pedindo o ícone de
     um domínio que com certeza não existe. */
  try {
    const globo = await baixar("https://www.google.com/s2/favicons?sz=128&domain=dominio-que-nao-existe-hub-totali.invalid");
    GLOBOS.add(digital(globo));
  } catch (e) { /* sem problema: só perde o filtro */ }

  const setores = await lerSistemas();
  const itens = setores.flatMap((s) => s.itens || []);
  const relatorio = { baixados: [], jaTinha: [], semLogo: [] };

  for (const item of itens) {
    if (!item.url) { relatorio.semLogo.push(item.nome); continue; }

    const arquivoBase = apelido(item.nome);
    const existente = ["png", "ico", "svg"]
      .map((e) => arquivoBase + "." + e)
      .find((n) => fs.existsSync(path.join(DESTINO, n)));

    if (existente && !REFAZER) { relatorio.jaTinha.push(item.nome); continue; }

    const dominio = new URL(item.url).hostname.replace(/^www\./, "");
    const logo = await buscarLogo(dominio, item.url);

    if (!logo) { relatorio.semLogo.push(item.nome); continue; }

    const nomeArquivo = arquivoBase + logo.ext;
    fs.writeFileSync(path.join(DESTINO, nomeArquivo), logo.dados);
    relatorio.baixados.push(item.nome + "  →  " + nomeArquivo + "  (" + Math.round(logo.dados.length / 1024) + " kB)");
  }

  /* ---------- índice dos arquivos ----------
     A página precisa saber que "e-CAC" mora em "e-cac.ico" e não
     em "e-cac.png". Em vez de a página ficar tentando extensão
     por extensão (e sujando o console de erro 404 na cara de
     quem abre o navegador), a lista é escrita aqui, uma vez. */
  const arquivos = fs.readdirSync(DESTINO).filter((n) => !n.startsWith("."));
  const indice = {};
  arquivos.sort().forEach((n) => { indice[n.replace(/\.[^.]+$/, "")] = n; });

  fs.writeFileSync(path.join(RAIZ, "js", "logos.js"),
    "/* GERADO POR ferramentas/baixar-logos.js — NÃO EDITE À MÃO.\n" +
    "   Diz em que arquivo mora o logo de cada sistema.\n" +
    "   Para atualizar:  node ferramentas/baixar-logos.js  */\n\n" +
    "const LOGOS = " + JSON.stringify(indice, null, 2) + ";\n");

  console.log("\nÍndice escrito em js/logos.js (" + arquivos.length + " logos).");

  console.log("\n=== Logos baixados ===");
  relatorio.baixados.forEach((l) => console.log("  " + l));
  if (relatorio.jaTinha.length) console.log("\nJá tinham arquivo: " + relatorio.jaTinha.join(", "));
  if (relatorio.semLogo.length) {
    console.log("\nSem logo (vão aparecer com as iniciais): " + relatorio.semLogo.join(", "));
    console.log("Se quiser um desses, salve a imagem à mão em assets/logos/ com o nome apelidado.");
  }
  console.log("");
})();
