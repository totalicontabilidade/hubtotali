# Por que o balde precisa de uma política de CORS

O Hub abre um anexo buscando o arquivo **com a sessão de quem clicou**,
num cabeçalho `Authorization`. É isso que mantém o arquivo privado: sem
sessão válida, a regra do Storage recusa.

Cabeçalho personalizado faz o navegador conferir antes se aquela origem
pode ler o arquivo, e sem uma política de CORS no balde a leitura é
barrada. O erro que chega ao código é um "Failed to fetch" mudo, sem
status e sem texto — o navegador esconde o motivo de propósito.

**O que a mudança de endereço esclareceu.** Ficava aqui registrado que
eu não sabia explicar por que o envio, que também usa cabeçalho,
funcionava sem a política. A mudança do Hub para
`hub.totalicontabilidade.com.br` respondeu: da origem nova, ainda fora
da lista, **enviar e apagar anexo funcionaram; só abrir falhou**. Ou
seja, a diferença não é o cabeçalho, é o caminho. O endereço de
download (`?alt=media`) aplica a política de CORS do balde; os
endereços de envio e exclusão respondem com uma liberação própria,
independente dela. Por isso a lista `method` abaixo tem só `GET` e
mesmo assim nada mais quebrou.

A alternativa seria voltar a usar o link com token de download, que
dispensa cabeçalho e dispensa CORS — e dispensa também o login, o que
é justamente o que não queremos: um anexo encaminhado por engano viraria
acesso público e permanente a documento fiscal de cliente.

## Como aplicar, sem instalar nada

1. Abra o **Cloud Shell** no console do Google Cloud: <https://console.cloud.google.com/>
   e clique no ícone de terminal, no canto superior direito. É um terminal
   que roda no navegador, no projeto certo.

2. Cole isto, tudo de uma vez:

```bash
cat > cors.json <<'JSON'
[
  {
    "origin": [
      "https://hub.totalicontabilidade.com.br",
      "https://totalicontabilidade.github.io"
    ],
    "method": ["GET"],
    "responseHeader": ["Content-Type", "Content-Disposition", "Authorization"],
    "maxAgeSeconds": 3600
  }
]
JSON
gcloud storage buckets update gs://hubtotali.firebasestorage.app --cors-file=cors.json
```

3. Para conferir que pegou:

```bash
gcloud storage buckets describe gs://hubtotali.firebasestorage.app --format="default(cors_config)"
```

## O que esta política permite, e o que não permite

Permite que **só os endereços do Hub** — `hub.totalicontabilidade.com.br` e
o antigo `totalicontabilidade.github.io` — façam leitura de arquivo.
Nenhuma outra página da internet consegue ler. Só `GET`, pelo motivo
explicado lá em cima: enviar e apagar não passam por aqui.

Quando o endereço antigo deixar de ser usado, tire-o da lista: cada
origem a mais é uma página a mais que pode tentar.

Tudo continua sujeito ao `storage.rules`, que é quem de fato decide.

CORS não é autorização. Ele só diz ao navegador quais páginas podem
*tentar*. Quem responde sim ou não continua sendo a regra do Storage,
que exige estar na lista da equipe.
