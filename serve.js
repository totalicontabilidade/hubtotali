/* Servidor local só para conferir o Hub antes de publicar.
   Rode com:  node serve.js     e abra http://localhost:8123
   Este arquivo NÃO faz falta no GitHub Pages — pode ficar ou sair. */
const http = require("http"), fs = require("fs"), path = require("path");
const raiz = __dirname, porta = 8123;
const tipos = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".js":"application/javascript; charset=utf-8", ".png":"image/png",
  ".webmanifest":"application/manifest+json", ".svg":"image/svg+xml" };
http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  const arquivo = path.join(raiz, rel);
  if (!arquivo.startsWith(raiz)) { res.writeHead(403).end("nao"); return; }
  fs.readFile(arquivo, (erro, dados) => {
    if (erro) { res.writeHead(404, {"Content-Type":"text/plain"}).end("nao encontrado"); return; }
    res.writeHead(200, {"Content-Type": tipos[path.extname(arquivo).toLowerCase()] || "application/octet-stream"});
    res.end(dados);
  });
}).listen(porta, () => console.log("Hub Totali em http://localhost:" + porta));
