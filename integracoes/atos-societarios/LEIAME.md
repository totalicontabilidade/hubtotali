# Solicitação do Atos vira pendência no Hub

O Atos Societários avisa um endereço quando uma solicitação é criada,
finalizada, excluída ou reaberta. Um script na conta Google da Totali recebe
esse aviso e abre (ou risca) a pendência no **quadro de quem cuida da
Legalização** no Hub.

São três peças, e cada uma existe por um motivo:

| Peça | Onde mora | Para quê |
|---|---|---|
| Aviso de saída | Atos Societários | manda um JSON genérico para um endereço configurável |
| `receber.gs` | Apps Script da Totali | traduz esse aviso para o vocabulário do quadro do Hub |
| Conta do robô | Hub | assina as pendências que nascem da integração |

**Por que o Atos não escreve direto no Hub.** Porque ele vai ser vendido. Um
produto que conhece o formato de pendência do Hub só serve para quem tem o Hub,
e obrigaria cada comprador a guardar a senha de um sistema alheio dentro do
navegador. O Atos manda "solicitação criada"; quem traduz é a Totali.

**O que mudou em 09/11/2026.** O Hub trocou o quadro do escritório por um
quadro por pessoa. A pendência da integração passou a nascer no quadro de
**uma pessoa escolhida** (a propriedade `DESTINO_UID`), no bloco *Acompanhar*
(ou *Com data*, quando a solicitação tem prazo), com o pedido do cliente no
texto e um comentário dizendo de onde veio. Ela aparece para essa pessoa como
qualquer outra pendência — pode ser movida, comentada, riscada. Quando a
solicitação termina no Atos, o robô a risca e deixa um comentário.

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

## 2. Escolher o quadro de destino

Decida **quem** recebe as solicitações do Atos no Hub (a pessoa da
Legalização). Pegue o **UID** dela em: console do Firebase → Authentication →
Users → coluna "UID do usuário". É isso que vai em `DESTINO_UID`.

Se quiser que a pendência já nasça no setor certo do quadro dela, abra o Hub
com a conta dela → Pendências → Gerenciar setores; o id do setor é o nome em
minúsculas e sem acento (`legalizacao`, em geral). É o `SETOR_ID`, opcional.

## 3. Publicar o recebedor

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
   | `DESTINO_UID` | o UID da pessoa que recebe (item 2) |
   | `SETOR_ID` | opcional, ex.: `legalizacao` |

4. Com tudo preenchido, rode a função **`conferir`** uma vez pelo editor. Ela
   não cria nada: diz se o robô entrou e como o Hub respondeu. **Um 403 ao
   listar é o esperado** — o robô só pode criar no quadro alheio e ler o que
   ele mesmo criou; quem confere a criação de verdade é o primeiro aviso do Atos.
5. **Implantar → Nova implantação → App da web**, com:
   - *Executar como:* **Eu**
   - *Quem pode acessar:* **Qualquer pessoa**
6. Copie o endereço que aparece. É ele que vai no Atos.

> **"Qualquer pessoa" assusta e é necessário.** É o que permite o Atos chamar
> sem login do Google. Quem barra estranho é o `SEGREDO`, conferido na primeira
> linha: sem ele, o script responde "recusado" e não escreve nada.

## 4. Ligar no Atos

Na tela de configuração do Atos, em **Integrações**, cole o endereço e o mesmo
segredo. A partir daí:

- **solicitação criada** → pendência no quadro de destino, em *Acompanhar*
  (ou *Com data*), com o pedido, o CNPJ e o contato no texto;
- **solicitação finalizada** → a pendência é riscada, com o comentário
  "Finalizada no Atos Societários";
- **solicitação excluída** → riscada, com o comentário "excluída no Atos"
  (apagar de vez continua sendo decisão do dono do quadro);
- **solicitação reaberta** → a pendência volta a ficar aberta, com comentário.

**Depois de mudar o `receber.gs`**, cole de novo no Apps Script e publique uma
**nova versão da mesma implantação** (Implantar → Gerenciar implantações →
lápis → Versão: Nova versão). Assim o endereço continua o mesmo e o Atos não
precisa ser reconfigurado.

---

## O que a integração NÃO faz, e por quê

- **Não duplica.** Antes de criar, procura pendência com o mesmo `origemId`
  que o próprio robô criou. Se a rede cair no meio ou alguém salvar duas vezes,
  o segundo aviso não vira pendência nova.
- **Não volta (do Hub para o Atos).** Riscar a pendência no Hub não finaliza
  a solicitação no Atos.
- **Não leva anexo.** O arquivo continua no Atos. Copiá-lo para o Hub criaria
  duas cópias do documento de um cliente, em dois sistemas, com dois donos.
- **Não mexe no que não é dele.** A regra do banco deixa quem criou no quadro
  alheio riscar, desriscar e comentar — e só. Texto, prazo e exclusão são do
  dono do quadro.

## Quando algo não funcionar

O Apps Script guarda o registro de cada chamada em **Execuções**, no menu da
esquerda. É lá que aparece o motivo — inclusive a recusa do Hub, com o texto
que o banco devolveu.

Se o Hub recusar com 403 na **criação**, o suspeito número um é o cadastro do
robô na equipe (item 1), o número dois é a senha nas propriedades e o número
três é `DESTINO_UID` errado (um UID que não é de ninguém também dá 403 na
hora de criar, porque a regra confere quem está escrevendo, não o destino).
