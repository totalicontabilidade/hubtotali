/* ============================================================
   Hub Totali · tratamento da logomarca
   ------------------------------------------------------------
   Pega os arquivos da logo como vieram do designer — fundo
   chapado, três mil pixels de largura, três megabytes — e
   entrega o que a web precisa: fundo transparente, tamanho de
   tela, e o símbolo recortado para virar ícone da aba.

   Rode da raiz do projeto:

       node ferramentas/tratar-logo.js

   Entra:  assets/logo-hub.png          (texto azul, fundo claro)
           assets/logo-hub-escuro.png   (texto branco, fundo azul)

   Sai:    assets/logo-hub.png          transparente, 1200 px
           assets/logo-hub-escuro.png   transparente, 1200 px
           assets/simbolo.png           só o símbolo, 512 px
           assets/favicon-32.png        ícone da aba
           assets/apple-touch-icon.png  ícone de celular
           assets/originais/            os arquivos como chegaram

   POR QUE À MÃO E NÃO COM UMA BIBLIOTECA: o projeto inteiro não
   tem uma única dependência externa, e não vale começar a ter
   por causa de uma tarefa que roda uma vez por troca de marca.
   PNG sem entrelaçamento é um formato simples de ler: zlib (que
   vem no Node) descomprime, e o resto é desfazer o filtro linha
   a linha.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const RAIZ = path.join(__dirname, "..");
const ASSETS = path.join(RAIZ, "assets");

/* ============================================================
   1. Ler PNG
   ============================================================ */

function lerPNG(caminho) {
  const arquivo = fs.readFileSync(caminho);
  if (arquivo.slice(1, 4).toString() !== "PNG") throw new Error("não é PNG: " + caminho);

  let pos = 8;
  let largura = 0, altura = 0, bits = 0, tipoCor = 0, entrelacado = 0;
  const pedacos = [];
  let paleta = null, transparenciaPaleta = null;

  while (pos < arquivo.length) {
    const tamanho = arquivo.readUInt32BE(pos);
    const tipo = arquivo.slice(pos + 4, pos + 8).toString("ascii");
    const dados = arquivo.slice(pos + 8, pos + 8 + tamanho);
    pos += 12 + tamanho;

    if (tipo === "IHDR") {
      largura = dados.readUInt32BE(0);
      altura = dados.readUInt32BE(4);
      bits = dados[8];
      tipoCor = dados[9];
      entrelacado = dados[12];
    } else if (tipo === "PLTE") paleta = dados;
    else if (tipo === "tRNS") transparenciaPaleta = dados;
    else if (tipo === "IDAT") pedacos.push(dados);
    else if (tipo === "IEND") break;
  }

  if (bits !== 8) throw new Error("só sei ler PNG de 8 bits por canal (este tem " + bits + ")");
  if (entrelacado) throw new Error("PNG entrelaçado não é suportado");

  const canais = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[tipoCor];
  if (!canais) throw new Error("tipo de cor " + tipoCor + " não suportado");

  const cru = zlib.inflateSync(Buffer.concat(pedacos));
  const bpp = canais;                       /* bytes por pixel, já que são 8 bits */
  const porLinha = largura * bpp;
  const linhas = Buffer.alloc(altura * porLinha);

  /* Desfazer o filtro. Cada linha do PNG começa com um byte
     dizendo como ela foi codificada em relação à linha de cima e
     ao pixel da esquerda. É compressão: guardar a diferença rende
     mais que guardar o valor. */
  let leitura = 0;
  for (let y = 0; y < altura; y++) {
    const filtro = cru[leitura++];
    const destino = y * porLinha;
    const anterior = destino - porLinha;

    for (let x = 0; x < porLinha; x++) {
      const bruto = cru[leitura++];
      const a = x >= bpp ? linhas[destino + x - bpp] : 0;   /* esquerda */
      const b = y > 0 ? linhas[anterior + x] : 0;           /* de cima */
      const c = (x >= bpp && y > 0) ? linhas[anterior + x - bpp] : 0;  /* diagonal */
      let valor;
      switch (filtro) {
        case 0: valor = bruto; break;
        case 1: valor = bruto + a; break;
        case 2: valor = bruto + b; break;
        case 3: valor = bruto + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          valor = bruto + (pa <= pb && pa <= pc ? a : (pb <= pc ? b : c));
          break;
        }
        default: throw new Error("filtro desconhecido: " + filtro);
      }
      linhas[destino + x] = valor & 0xff;
    }
  }

  /* Normalizo tudo para RGBA, para o resto do programa não
     precisar saber de que tipo o arquivo era. */
  const px = Buffer.alloc(largura * altura * 4);
  for (let i = 0, n = largura * altura; i < n; i++) {
    const o = i * 4, f = i * bpp;
    if (tipoCor === 0) { px[o] = px[o+1] = px[o+2] = linhas[f]; px[o+3] = 255; }
    else if (tipoCor === 2) { px[o] = linhas[f]; px[o+1] = linhas[f+1]; px[o+2] = linhas[f+2]; px[o+3] = 255; }
    else if (tipoCor === 3) {
      const idx = linhas[f];
      px[o] = paleta[idx*3]; px[o+1] = paleta[idx*3+1]; px[o+2] = paleta[idx*3+2];
      px[o+3] = transparenciaPaleta && idx < transparenciaPaleta.length ? transparenciaPaleta[idx] : 255;
    }
    else if (tipoCor === 4) { px[o] = px[o+1] = px[o+2] = linhas[f]; px[o+3] = linhas[f+1]; }
    else { px[o] = linhas[f]; px[o+1] = linhas[f+1]; px[o+2] = linhas[f+2]; px[o+3] = linhas[f+3]; }
  }

  return { largura, altura, px };
}

/* ============================================================
   2. Escrever PNG
   ============================================================ */

const TABELA_CRC = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function bloco(tipo, dados) {
  const tamanho = Buffer.alloc(4); tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
  let crc = 0xffffffff;
  for (const b of corpo) crc = TABELA_CRC[(crc ^ b) & 0xff] ^ (crc >>> 8);
  const fim = Buffer.alloc(4); fim.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([tamanho, corpo, fim]);
}

function escreverPNG(caminho, img) {
  const porLinha = img.largura * 4;
  const linhas = Buffer.alloc((porLinha + 1) * img.altura);
  for (let y = 0; y < img.altura; y++) {
    linhas[y * (porLinha + 1)] = 0;
    img.px.copy(linhas, y * (porLinha + 1) + 1, y * porLinha, (y + 1) * porLinha);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.largura, 0);
  ihdr.writeUInt32BE(img.altura, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloco("IHDR", ihdr),
    bloco("IDAT", zlib.deflateSync(linhas, { level: 9 })),
    bloco("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(caminho, png);
  return png.length;
}

/* ============================================================
   3. Tirar o fundo
   ============================================================ */

/* A cor do fundo é decidida pelos quatro cantos, não chutada: se
   os quatro concordam, é fundo. */
function corDoFundo(img) {
  const { largura: L, altura: A, px } = img;
  const cantos = [[2,2],[L-3,2],[2,A-3],[L-3,A-3]].map(([x,y]) => {
    const o = (y*L + x) * 4;
    return [px[o], px[o+1], px[o+2]];
  });
  const media = [0,1,2].map(c => Math.round(cantos.reduce((s,k)=>s+k[c],0)/cantos.length));
  const espalhamento = Math.max(...cantos.map(k => distancia(k, media)));
  if (espalhamento > 30) {
    throw new Error("os quatro cantos não concordam sobre a cor do fundo (espalhamento " +
                    Math.round(espalhamento) + ") — a imagem não parece ter fundo chapado");
  }
  return media;
}

function distancia(a, b) {
  const dr = a[0]-b[0], dg = a[1]-b[1], db = a[2]-b[2];
  return Math.sqrt(dr*dr + dg*dg + db*db);
}

/* Duas faixas, e é isso que evita o serrilhado: até `dentro`, o
   pixel é fundo puro e some; de `fora` para cima, é desenho e
   fica; no meio (a borda anti-serrilhada, que é mistura das
   duas) a transparência é proporcional. */
function tirarFundo(img, fundo, dentro = 42, fora = 105) {
  const { largura: L, altura: A, px } = img;
  let sumiram = 0;
  for (let i = 0, n = L*A; i < n; i++) {
    const o = i*4;
    const d = distancia([px[o], px[o+1], px[o+2]], fundo);
    if (d <= dentro) { px[o+3] = 0; sumiram++; }
    else if (d < fora) {
      px[o+3] = Math.round(255 * (d - dentro) / (fora - dentro));
      /* Na borda, a cor do pixel é mistura de desenho e fundo.
         Descontar o fundo devolve a cor original do desenho —
         sem isso sobra um halo com a cor do fundo antigo. */
      const k = px[o+3] / 255;
      for (let c = 0; c < 3; c++) {
        px[o+c] = Math.max(0, Math.min(255, Math.round((px[o+c] - fundo[c]*(1-k)) / k)));
      }
    }
  }
  return sumiram;
}

/* ============================================================
   4. Reduzir
   ============================================================ */

/* Média de área, com a cor pré-multiplicada pela transparência.
   Sem pré-multiplicar, o pixel transparente (que guarda uma cor
   qualquer) entra na média e suja a borda. */
function reduzir(img, novaLargura) {
  const escala = novaLargura / img.largura;
  const novaAltura = Math.max(1, Math.round(img.altura * escala));
  const saida = Buffer.alloc(novaLargura * novaAltura * 4);

  for (let y = 0; y < novaAltura; y++) {
    const y0 = Math.floor(y / escala), y1 = Math.min(img.altura, Math.ceil((y+1) / escala));
    for (let x = 0; x < novaLargura; x++) {
      const x0 = Math.floor(x / escala), x1 = Math.min(img.largura, Math.ceil((x+1) / escala));
      let r=0, g=0, b=0, a=0, n=0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const o = (yy*img.largura + xx) * 4;
          const alfa = img.px[o+3] / 255;
          r += img.px[o]*alfa; g += img.px[o+1]*alfa; b += img.px[o+2]*alfa;
          a += img.px[o+3];
          n++;
        }
      }
      const o = (y*novaLargura + x) * 4;
      const alfaMedio = a / n;
      const peso = alfaMedio / 255 * n;
      saida[o]   = peso ? Math.round(r/peso) : 0;
      saida[o+1] = peso ? Math.round(g/peso) : 0;
      saida[o+2] = peso ? Math.round(b/peso) : 0;
      saida[o+3] = Math.round(alfaMedio);
    }
  }
  return { largura: novaLargura, altura: novaAltura, px: saida };
}

/* ============================================================
   5. Achar e recortar o símbolo
   ============================================================ */

/* O símbolo fica à esquerda e o texto à direita, separados por
   uma faixa de colunas vazias. Procuro essa faixa em vez de
   recortar por porcentagem: porcentagem quebra na próxima vez
   que a marca mudar de proporção. */
function recortarSimbolo(img) {
  const { largura: L, altura: A, px } = img;

  const colunaTemTinta = new Array(L).fill(false);
  for (let x = 0; x < L; x++) {
    for (let y = 0; y < A; y++) {
      if (px[(y*L + x)*4 + 3] > 24) { colunaTemTinta[x] = true; break; }
    }
  }

  let inicio = colunaTemTinta.indexOf(true);
  if (inicio === -1) throw new Error("a imagem ficou vazia depois de tirar o fundo");

  /* A partir do início do desenho, a primeira faixa vazia larga
     o bastante (2% da largura) é o vão entre símbolo e texto. */
  const vaoMinimo = Math.max(6, Math.round(L * 0.02));
  let fim = L, vazias = 0;
  for (let x = inicio; x < L; x++) {
    if (!colunaTemTinta[x]) {
      vazias++;
      if (vazias >= vaoMinimo) { fim = x - vazias + 1; break; }
    } else vazias = 0;
  }

  let topo = A, base = 0;
  for (let y = 0; y < A; y++) {
    for (let x = inicio; x < fim; x++) {
      if (px[(y*L + x)*4 + 3] > 24) { if (y < topo) topo = y; if (y > base) base = y; break; }
    }
  }

  const larguraSimbolo = fim - inicio, alturaSimbolo = base - topo + 1;

  /* Sai quadrado e centralizado: ícone de aba é quadrado, e um
     recorte justo ficaria colado nas bordas. */
  const lado = Math.round(Math.max(larguraSimbolo, alturaSimbolo) * 1.1);
  const saida = Buffer.alloc(lado * lado * 4);
  const deslocaX = Math.round((lado - larguraSimbolo) / 2);
  const deslocaY = Math.round((lado - alturaSimbolo) / 2);

  for (let y = 0; y < alturaSimbolo; y++) {
    for (let x = 0; x < larguraSimbolo; x++) {
      const de = ((topo + y)*L + (inicio + x)) * 4;
      const para = ((deslocaY + y)*lado + (deslocaX + x)) * 4;
      img.px.copy(saida, para, de, de + 4);
    }
  }

  return { img: { largura: lado, altura: lado, px: saida }, largura: larguraSimbolo, altura: alturaSimbolo };
}

/* ============================================================
   6. Execução
   ============================================================ */

function guardarOriginal(nome) {
  const pasta = path.join(ASSETS, "originais");
  fs.mkdirSync(pasta, { recursive: true });
  const destino = path.join(pasta, nome);
  if (!fs.existsSync(destino)) fs.copyFileSync(path.join(ASSETS, nome), destino);
  return destino;
}

function tratar(nome, larguraFinal) {
  guardarOriginal(nome);
  const caminho = path.join(ASSETS, nome);
  const img = lerPNG(caminho);
  const fundo = corDoFundo(img);
  const sumiram = tirarFundo(img, fundo);
  const proporcaoFundo = sumiram / (img.largura * img.altura);

  console.log("  " + nome);
  console.log("    original  : " + img.largura + "x" + img.altura);
  console.log("    fundo     : rgb(" + fundo.join(", ") + ")  ·  " +
              Math.round(proporcaoFundo * 100) + "% da imagem virou transparente");

  if (proporcaoFundo < 0.15) console.log("    ATENÇÃO: pouca coisa virou transparente — confira o resultado");
  if (proporcaoFundo > 0.92) console.log("    ATENÇÃO: quase tudo virou transparente — confira o resultado");

  const pequena = reduzir(img, larguraFinal);
  const bytes = escreverPNG(caminho, pequena);
  console.log("    saída     : " + pequena.largura + "x" + pequena.altura +
              "  ·  " + Math.round(bytes / 1024) + " kB");

  return img;   /* devolvo em tamanho cheio, para o recorte do símbolo */
}

(function () {
  console.log("\n=== Tratando a logomarca ===\n");

  const clara = tratar("logo-hub.png", 1200);
  const escura = tratar("logo-hub-escuro.png", 1200);
  if (!escura) throw new Error("versão escura não tratada");

  console.log("\n=== Recortando o símbolo (da versão clara) ===\n");
  const recorte = recortarSimbolo(clara);
  console.log("  símbolo encontrado: " + recorte.largura + "x" + recorte.altura +
              " · quadro de " + recorte.img.largura + "px");

  const saidas = [
    ["simbolo.png", 512],
    ["apple-touch-icon.png", 180],
    ["favicon-32.png", 32],
  ];
  for (const [nome, lado] of saidas) {
    const bytes = escreverPNG(path.join(ASSETS, nome), reduzir(recorte.img, lado));
    console.log("  " + nome + " · " + lado + "px · " + Math.round(bytes / 1024) + " kB");
  }

  console.log("\nOs arquivos como chegaram ficaram em assets/originais/.\n");
})();
