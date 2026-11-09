/* ============================================================
   Hub Totali · ler uma planilha de clientes sem biblioteca
   ------------------------------------------------------------
   A administração importa a lista de clientes a partir do relatório
   que o sistema contábil exporta — um .xlsx — ou de um .csv, ou de
   linhas coladas. Sem biblioteca de terceiro, como todo o Hub.

   .xlsx É UM ZIP COM XML DENTRO. O navegador sabe descompactar
   (DecompressionStream, deflate-raw) e sabe ler XML (DOMParser), e
   é só disso que se precisa: o diretório do zip aponta para
   xl/sharedStrings.xml (os textos) e xl/worksheets/sheet1.xml (as
   células). Não há fórmulas a calcular numa lista de clientes.

   AS COLUNAS SÃO ACHADAS PELO CABEÇALHO ("Nome", "CNPJ / CPF",
   "Regime tributário", "Estado", "Cidade"), em qualquer ordem. Sem
   cabeçalho reconhecível, vale a ordem: nome, documento, regime,
   estado, cidade.
   ============================================================ */
(function (raiz) {
  "use strict";

  /* ---------- o zip ---------- */
  function lerZip(buf) {
    var b = new DataView(buf);
    var u8 = new Uint8Array(buf);
    /* O fim do diretório central fica no fim do arquivo. */
    var fim = -1;
    for (var i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) {
      if (b.getUint32(i, true) === 0x06054b50) { fim = i; break; }
    }
    if (fim < 0) throw new Error("Este arquivo não é um .xlsx válido.");
    var quantos = b.getUint16(fim + 10, true);
    var inicioDir = b.getUint32(fim + 16, true);
    var entradas = {};
    var p = inicioDir;
    var dec = new TextDecoder("utf-8");
    for (var n = 0; n < quantos; n++) {
      if (b.getUint32(p, true) !== 0x02014b50) break;
      var metodo = b.getUint16(p + 10, true);
      var tamComp = b.getUint32(p + 20, true);
      var tamOrig = b.getUint32(p + 24, true);
      var nomeLen = b.getUint16(p + 28, true);
      var extraLen = b.getUint16(p + 30, true);
      var comentLen = b.getUint16(p + 32, true);
      var offset = b.getUint32(p + 42, true);
      var nome = dec.decode(u8.subarray(p + 46, p + 46 + nomeLen));
      entradas[nome] = { metodo: metodo, tamComp: tamComp, tamOrig: tamOrig, offset: offset };
      p += 46 + nomeLen + extraLen + comentLen;
    }
    function dadosDe(nome) {
      var e = entradas[nome];
      if (!e) return null;
      /* O cabeçalho local tem o nome e o extra de novo, com
         tamanhos próprios: o começo dos dados sai dele. */
      var nl = b.getUint16(e.offset + 26, true);
      var xl = b.getUint16(e.offset + 28, true);
      var ini = e.offset + 30 + nl + xl;
      return { bytes: u8.subarray(ini, ini + e.tamComp), metodo: e.metodo };
    }
    return { nomes: Object.keys(entradas), dadosDe: dadosDe };
  }

  function inflar(d) {
    if (!d) return Promise.resolve(null);
    if (d.metodo === 0) return Promise.resolve(d.bytes);
    if (d.metodo !== 8) return Promise.reject(new Error("Compactação desconhecida dentro do .xlsx."));
    if (typeof DecompressionStream === "undefined") {
      return Promise.reject(new Error("Este navegador não consegue abrir .xlsx. Salve a planilha como .csv e importe o .csv."));
    }
    var fluxo = new Blob([d.bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(fluxo).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }

  function textoDe(zip, nome) {
    return inflar(zip.dadosDe(nome)).then(function (bytes) {
      return bytes ? new TextDecoder("utf-8").decode(bytes) : null;
    });
  }

  function xml(texto) {
    return new DOMParser().parseFromString(texto, "application/xml");
  }

  /* "AB12" → 27 (coluna, começando em 0). */
  function colunaDe(ref) {
    var letras = String(ref || "").replace(/[^A-Z]/g, "");
    var n = 0;
    for (var i = 0; i < letras.length; i++) n = n * 26 + (letras.charCodeAt(i) - 64);
    return n - 1;
  }

  function lerXlsx(buf) {
    var zip = lerZip(buf);
    var folha = zip.nomes.filter(function (n) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(n); })
      .sort(function (a, b) { return parseInt(a.replace(/\D/g, ""), 10) - parseInt(b.replace(/\D/g, ""), 10); })[0];
    if (!folha) throw new Error("Não achei nenhuma planilha dentro do arquivo.");
    return textoDe(zip, "xl/sharedStrings.xml").then(function (ssTexto) {
      var textos = [];
      if (ssTexto) {
        var si = xml(ssTexto).getElementsByTagName("si");
        for (var i = 0; i < si.length; i++) textos.push(si[i].textContent || "");
      }
      return textoDe(zip, folha).then(function (fTexto) {
        var doc = xml(fTexto);
        var linhas = doc.getElementsByTagName("row");
        var saida = [];
        for (var r = 0; r < linhas.length; r++) {
          var celulas = linhas[r].getElementsByTagName("c");
          var linha = [];
          for (var c = 0; c < celulas.length; c++) {
            var cel = celulas[c];
            var col = colunaDe(cel.getAttribute("r"));
            if (col < 0) col = linha.length;
            var tipo = cel.getAttribute("t");
            var valor = "";
            if (tipo === "s") {
              var v = cel.getElementsByTagName("v")[0];
              valor = v ? (textos[parseInt(v.textContent, 10)] || "") : "";
            } else if (tipo === "inlineStr") {
              valor = cel.textContent || "";
            } else {
              var v2 = cel.getElementsByTagName("v")[0];
              valor = v2 ? v2.textContent : "";
            }
            while (linha.length < col) linha.push("");
            linha[col] = String(valor).trim();
          }
          if (linha.some(function (x) { return x !== ""; })) saida.push(linha);
        }
        return saida;
      });
    });
  }

  /* ---------- csv e texto colado ---------- */
  function lerCsv(texto) {
    var t = String(texto || "").replace(/^﻿/, "");
    var linhasBrutas = t.split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (!linhasBrutas.length) return [];
    /* O separador é o que mais aparece na primeira linha. */
    var cabe = linhasBrutas[0];
    var sep = [";", "\t", ","].sort(function (a, b) { return cabe.split(b).length - cabe.split(a).length; })[0];
    return linhasBrutas.map(function (l) {
      var campos = [], atual = "", aspas = false;
      for (var i = 0; i < l.length; i++) {
        var ch = l.charAt(i);
        if (ch === '"') { if (aspas && l.charAt(i + 1) === '"') { atual += '"'; i++; } else aspas = !aspas; }
        else if (ch === sep && !aspas) { campos.push(atual.trim()); atual = ""; }
        else atual += ch;
      }
      campos.push(atual.trim());
      return campos;
    });
  }

  /* ---------- das linhas para clientes ---------- */
  function semAcento(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function acharColunas(cabecalho) {
    var idx = { nome: -1, doc: -1, regime: -1, uf: -1, cidade: -1 };
    cabecalho.forEach(function (c, i) {
      var t = semAcento(c);
      if (idx.nome < 0 && /nome|razao|empresa|cliente/.test(t)) idx.nome = i;
      else if (idx.doc < 0 && /cnpj|cpf|documento/.test(t)) idx.doc = i;
      else if (idx.regime < 0 && /regime|tribut/.test(t)) idx.regime = i;
      else if (idx.uf < 0 && /^uf$|estado/.test(t)) idx.uf = i;
      else if (idx.cidade < 0 && /cidade|municipio/.test(t)) idx.cidade = i;
    });
    return idx;
  }

  function paraClientes(linhas) {
    if (!linhas || !linhas.length) return [];
    var idx = acharColunas(linhas[0]);
    var temCabecalho = idx.nome >= 0 && idx.doc >= 0;
    if (!temCabecalho) idx = { nome: 0, doc: 1, regime: 2, uf: 3, cidade: 4 };
    var dados = temCabecalho ? linhas.slice(1) : linhas;
    return dados.map(function (l) {
      var pega = function (i) { return i >= 0 && i < l.length ? String(l[i] || "").trim() : ""; };
      return { nome: pega(idx.nome), cnpj: pega(idx.doc).replace(/\D/g, ""), regime: pega(idx.regime), uf: pega(idx.uf), cidade: pega(idx.cidade) };
    }).filter(function (c) { return c.nome && (c.cnpj.length === 14 || c.cnpj.length === 11); });
  }

  raiz.Planilha = { lerXlsx: lerXlsx, lerCsv: lerCsv, paraClientes: paraClientes, lerZip: lerZip };
})(typeof window !== "undefined" ? window : (typeof module !== "undefined" ? module.exports : this));
