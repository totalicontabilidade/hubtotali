# Por que o balde precisa de uma política de CORS

O Hub abre um anexo buscando o arquivo **com a sessão de quem clicou**,
num cabeçalho `Authorization`. É isso que mantém o arquivo privado: sem
sessão válida, a regra do Storage recusa.

Só que cabeçalho personalizado faz o navegador mandar antes uma pergunta
ao servidor — "esta origem pode ler isto?" — e o Google Cloud Storage só
responde que sim se o balde tiver uma política de CORS dizendo isso. Sem
ela, o navegador nem chega a fazer o pedido de verdade, e o erro que
aparece é um "Failed to fetch" sem explicação.

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
    "origin": ["https://totalicontabilidade.github.io"],
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

Permite que **uma única origem** — o endereço do Hub — faça leitura de
arquivo. Só `GET`: enviar e apagar continuam fora, e continuam também
sujeitos às regras do `storage.rules`, que é quem de fato decide.

CORS não é autorização. Ele só diz ao navegador quais páginas podem
*tentar*. Quem responde sim ou não continua sendo a regra do Storage,
que exige estar na lista da equipe.
