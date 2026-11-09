/* Servidor local só para conferir o Hub antes de publicar.
   Rode com:  node serve.js     e abra http://localhost:8123
   Este arquivo NÃO faz falta no GitHub Pages — pode ficar ou sair. */
const http = require("http"), fs = require("fs"), path = require("path");
const raiz = __dirname;
/* node serve.js --teste  →  porta 8124, com o js/config-hub.js EM
   BRANCO. Sem banco, o Hub e a administração entram sozinhos e
   guardam tudo só no navegador: dá para mexer à vontade sem tocar
   na lista de verdade da equipe. */
const teste = process.argv.includes("--teste");
const porta = teste ? 8124 : 8123;
const tipos = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".js":"application/javascript; charset=utf-8", ".png":"image/png",
  ".webmanifest":"application/manifest+json", ".svg":"image/svg+xml" };
http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  const arquivo = path.join(raiz, rel);
  if (!arquivo.startsWith(raiz)) { res.writeHead(403).end("nao"); return; }
  if (teste && rel === "js/config-hub.js") {
    res.writeHead(200, {"Content-Type": tipos[".js"]}).end("const CONFIG_HUB = {};\n");
    return;
  }
  fs.readFile(arquivo, (erro, dados) => {
    if (erro) { res.writeHead(404, {"Content-Type":"text/plain"}).end("nao encontrado"); return; }
    res.writeHead(200, {"Content-Type": tipos[path.extname(arquivo).toLowerCase()] || "application/octet-stream"});
    res.end(dados);
  });
}).listen(porta, () => console.log("Hub Totali em http://localhost:" + porta + (teste ? " (modo de teste, sem banco)" : "")));
