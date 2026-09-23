# Solicitação do Atos vira pendência no Hub

O Atos Societários avisa um endereço quando uma solicitação é criada ou
finalizada. Um script na conta Google da Totali recebe esse aviso e abre (ou
fecha) a pendência no Hub.

São três peças, e cada uma existe por um motivo:

| Peça | Onde mora | Para quê |
|---|---|---|
| Aviso de saída | Atos Societários | manda um JSON genérico para um endereço configurável |
| `receber.gs` | Apps Script da Totali | traduz esse aviso para o vocabulário do Hub |
| Conta do robô | Hub | dá dono às pendências que nascem da integração |

**Por que o Atos não escreve direto no Hub.** Porque ele vai ser vendido. Um
produto que conhece o formato de pendência do Hub só serve para quem tem o Hub,
e obrigaria cada comprador a guardar a senha de um sistema alheio dentro do
navegador. O Atos manda "solicitação criada"; quem traduz é a Totali.

---

## 1. Criar o robô no Hub

Pela página de administrador do Hub, cadastre uma pessoa como cadastraria
qualquer outra:

- **Nome:** Atos Societários
- **E-mail:** `atos@totalicontabilidade.com.br` (ou outro que ninguém use para entrar)
- **Setor:** Legalização
- **Senha:** uma senha longa, que ninguém precisa decorar — ela vai ficar
  guardada no script, não com uma pessoa.

Isso cria a conta e o cadastro na equipe de uma vez. Sem esse cadastro, o banco
recusa tudo o que o robô tentar escrever — é a mesma regra que vale para gente.

## 2. Publicar o recebedor

1. Abra <https://script.google.com> na conta Google da Totali → **Novo projeto**.
2. Apague o conteúdo do `Código.gs` e cole o `receber.gs` desta pasta.
3. **Configurações do projeto** → **Propriedades do script** → acrescente:

   | Propriedade | Valor |
   |---|---|
   | `SEGREDO` | invente uma senha só para isto (a mesma vai no Atos) |
   | `EMAIL` | `atos@totalicontabilidade.com.br` |
   | `SENHA` | a senha do robô |
   | `PROJETO` | `hubtotali` |
   | `CHAVE` | a `apiKey` que está em `js/config-hub.js` |
   | `SETOR` | `Legalização` |

4. Com tudo preenchido, rode a função **`conferir`** uma vez pelo editor. Ela não
   cria nada: só diz, no registro de execução, se o robô entrou e se o Hub
   respondeu. **Rode antes de ligar o Atos** — assim, se algo estiver errado, o
   erro aparece aqui e não no meio do trabalho de alguém.
5. **Implantar → Nova implantação → App da web**, com:
   - *Executar como:* **Eu**
   - *Quem pode acessar:* **Qualquer pessoa**
6. Copie o endereço que aparece. É ele que vai no Atos.

> **"Qualquer pessoa" assusta e é necessário.** É o que permite o Atos chamar
> sem login do Google. Quem barra estranho é o `SEGREDO`, conferido na primeira
> linha: sem ele, o script responde "recusado" e não escreve nada.

## 3. Ligar no Atos

Na tela de configuração do Atos, em **Integrações**, cole o endereço e o mesmo
segredo. A partir daí:

- **solicitação criada** → abre pendência no Hub, sem dono, endereçada à
  Legalização, com prazo e observação da solicitação;
- **solicitação finalizada** → resolve a pendência, deixando a anotação na linha
  do tempo.

---

## O que a integração NÃO faz, e por quê

- **Não duplica.** Antes de criar, procura pendência com o mesmo `origemId`. Se
  a rede cair no meio ou alguém salvar duas vezes, o segundo aviso não vira
  pendência nova.
- **Não volta.** Resolver a pendência no Hub não finaliza a solicitação no Atos.
  Fazer os dois lados escreverem um no outro pede regra de quem manda quando os
  dois mudam junto, e isso não vale a complicação agora.
- **Não leva anexo.** O arquivo continua no Atos. Copiá-lo para o Hub criaria
  duas cópias do documento de um cliente, em dois sistemas, com dois donos —
  exatamente o que a LGPD pede para evitar.

## Quando algo não funcionar

O Apps Script guarda o registro de cada chamada em **Execuções**, no menu da
esquerda. É lá que aparece o motivo — inclusive a recusa do Hub, com o texto
que o banco devolveu.

Se o Hub recusar com 403, o suspeito número um é o cadastro do robô na equipe
(item 1), e o número dois é a senha nas propriedades.
