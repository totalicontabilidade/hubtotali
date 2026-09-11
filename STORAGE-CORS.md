# Por que o balde precisa de uma política de CORS

O Hub abre um anexo buscando o arquivo **com a sessão de quem clicou**,
num cabeçalho `Authorization`. É isso que mantém o arquivo privado: sem
sessão válida, a regra do Storage recusa.

Cabeçalho personalizado faz o navegador conferir antes se aquela origem
pode ler o arquivo, e sem uma política de CORS no balde a leitura é
barrada. O erro que chega ao código é um "Failed to fetch" mudo, sem
status e sem texto — o navegador esconde o motivo de propósito.

**Uma observação honesta sobre o diagnóstico.** A pergunta prévia
(OPTIONS) ao endpoint do Firebase já respondia liberando tudo, mesmo
antes de a política existir; medi isso. Ainda assim, era a política que
faltava: aplicada, a leitura passou a funcionar no mesmo instante, sem
nenhuma outra mudança. O envio, que também usa cabeçalho, funcionava
desde antes. Não consegui explicar essa diferença, e prefiro registrar
o que observei a inventar um mecanismo.

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
o antigo `totalicontabilidade.github.io` — façam leitura de
arquivo. Só `GET`: enviar e apagar continuam fora, e continuam também
sujeitos às regras do `storage.rules`, que é quem de fato decide.

CORS não é autorização. Ele só diz ao navegador quais páginas podem
*tentar*. Quem responde sim ou não continua sendo a regra do Storage,
que exige estar na lista da equipe.
