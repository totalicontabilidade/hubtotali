# Hub Totali

A página de abertura do navegador da equipe. Todos os sistemas que usamos numa
tela só, sem menu e sem clique intermediário.

Duas páginas:

| Página | Para quem | O que faz |
|---|---|---|
| `index.html` | toda a equipe | mostra os sistemas. **Só leitura** |
| `admin.html` | só o administrador | cadastra, edita, reordena. Pede senha |

Site estático: HTML, CSS e JavaScript, sem framework e sem biblioteca de
terceiro. Nem a do Firebase — ver "Como conversa com o banco", no fim.

---

## Editar o Hub

Abra `admin.html`, entre com o e-mail e a senha, e edite na própria tela:

- **acrescentar, renomear e apagar** sistema e setor;
- **arrastar para reordenar**, inclusive de um setor para outro;
- **escolher se o setor fica à vista** (cartões) **ou recolhido** (gaveta);
- **trocar o logo** de um sistema, enviando uma imagem;
- **editar os recados** da coluna da direita.

Nada é gravado até você clicar em **Salvar** — o botão fica dourado quando há
mudança pendente, e a página avisa se você tentar fechar antes. Depois de
salvar, todo mundo vê no próximo F5.

**A equipe não consegue alterar nada.** O `index.html` só lê, e o banco só
aceita escrita de quem entrou como administrador.

---

## O banco

Já está ligado desde 01/09/2026. Projeto Firebase `hubtotali`, Firestore
Standard em São Paulo, um documento só: `hub/config`.

As regras estão em `firestore.rules` e dizem duas coisas: qualquer um **lê**
(é o que faz o Hub abrir para a equipe sem login) e só o administrador
**escreve**. Todo o resto do banco fica trancado para todo mundo.

Sobre a `apiKey` ficar visível na página: é assim mesmo. No Firebase ela não é
senha, é o endereço do projeto. Quem protege o banco são as regras.

**Trocar de administrador** exige mexer em DOIS lugares com o mesmo UID: o
`ADMIN_UID` em `js/config-hub.js` e a linha do `request.auth.uid` em
`firestore.rules` — e republicar as regras no console. Mudar só um deixa a
pessoa entrando na tela e tomando erro na hora de salvar.

---

## As duas camadas da tela

O que segura tudo dentro de uma tela sem rolagem é a lista ter dois pesos:

| Estilo do setor | Como aparece | Para quê |
|---|---|---|
| **Cartões à vista** | cartão com logo, nome e legenda | o que se abre todo dia |
| **Gaveta fechada** | uma linha só, com a contagem; abre no clique | órgão de governo, consulta pontual |

Vinte e cinco pastilhas soltas na tela eram a maior fonte de poluição visual da
página. Agora são quatro linhas quietas, e cada pessoa mantém abertas as
gavetas que usa — o Hub lembra.

Trocar um setor de camada é um seletor na `admin.html`.

---

## Os logos

Ficam em `assets/logos/`, **baixados uma vez e servidos pela nossa pasta**, por
dois motivos: velocidade (trinta imagens buscadas fora a cada abertura é meio
segundo jogado fora) e privacidade (pedir o ícone de cada site a um serviço de
terceiro conta a ele, toda manhã, quais sistemas a Totali usa).

Para baixar os logos de links novos:

```bash
node ferramentas/baixar-logos.js
```

Sistema **recém-cadastrado** pela tela aponta sozinho para o ícone do próprio
site, sem ninguém clicar em nada. Esse é o único caso em que o Hub busca uma
imagem fora, e é temporário: rodar a ferramenta acima traz o ícone para a nossa
pasta, e a partir daí o arquivo local assume e a busca externa deixa de
acontecer.

Sistema sem logo nenhum aparece com as iniciais num quadradinho — não quebra e
não fica buraco. Também dá para enviar uma imagem pela `admin.html`, que vale
mais que qualquer uma das outras origens.

A ordem, quando há mais de uma opção: imagem enviada à mão → arquivo em
`assets/logos/` → ícone do site → iniciais.

### A logomarca do Hub

| Arquivo | Onde é usado |
|---|---|
| `assets/logo-hub.png` | o cabeçalho (fundo claro) |
| `assets/logo-hub-escuro.png` | guardado, para uso sobre fundo escuro |
| `assets/simbolo.png` | o símbolo sozinho, 512 px |
| `assets/favicon-32.png` | o ícone da aba do navegador |
| `assets/apple-touch-icon.png` | o ícone quando alguém salva na tela do celular |

Todos saem de **um comando só**, a partir dos arquivos do designer:

```bash
node ferramentas/tratar-logo.js
```

A ferramenta tira o fundo chapado (com borda suave, senão fica serrilhado),
reduz para tamanho de web e acha sozinha onde o símbolo termina e o texto
começa, para recortar o ícone. Os arquivos como vieram ficam em
`assets/originais/` — são o único lugar onde a marca existe em tamanho cheio,
então não apague.

Trocou a marca? Ponha os dois arquivos novos em `assets/` com os mesmos nomes,
apague `assets/originais/`, e rode o comando de novo.

---

## Ver antes de publicar

```bash
node serve.js
```

E abra <http://localhost:8123>. O `serve.js` só serve para conferir na sua
máquina; no ar ele não faz falta.

---

## Publicar no GitHub Pages

Está publicado em **https://totalicontabilidade.github.io/hubtotali/**

Para publicar uma mudança de código:

```bash
git add -A
git commit -m "o que mudou"
git push
```

Depois disso, publicar de novo só é preciso quando mudar o código. Acrescentar
um link passa a ser pela `admin.html`, sem `git` nenhum.

---

## Deixar como página de abertura

**Chrome** — Configurações → Ao inicializar → *Abrir uma página específica* →
**Adicionar nova página** → colar o endereço.

**Edge** — Configurações → Início, página inicial e nova guia → *Abrir estas
páginas*.

---

## Decisões que valem lembrar

**Como conversa com o banco.** O Hub abre dezenas de vezes por dia, por pessoa.
Carregar a biblioteca do Firebase custaria uns 300 kB e meio segundo em cada
uma dessas aberturas, para ler um documento só. Então o Hub fala com o
Firestore pela API REST — uma requisição HTTP comum, sem biblioteca. O login do
administrador usa a API REST do Authentication, pelo mesmo motivo. Resultado: a
pasta inteira não tem uma única dependência externa.

**E a espera não existe.** O Hub desenha na hora com a última cópia guardada no
navegador e busca a versão nova por baixo. Se mudou, a tela se atualiza sozinha
um instante depois. Ninguém vê tela branca esperando rede — nem com internet
ruim, nem com o Firebase fora do ar.

**Página pública.** Está na web aberta: aqui só entram **endereços**, nunca
senha, número de cliente ou CNPJ. O `noindex` pede ao Google que não indexe,
mas isso é pedido, não fechadura.

**Favoritos e gavetas são de cada pessoa.** Ficam no navegador de quem marcou.
Não sincronizam entre máquinas, de propósito — sincronizar exigiria conta e
login para a equipe inteira, e o Hub existe para ser aberto sem atrito.

**O id do setor nunca muda.** É a chave dos favoritos de cada um
(`fiscal|e-CAC`). Renomear "Fiscal" para "Tributário" na tela não apaga o
atalho de ninguém.

**Logo enviado vira dado, não arquivo.** A imagem é reduzida a 64×64 no próprio
navegador antes de ser guardada. O documento do banco tem teto de 1 MB para
tudo — sem essa redução, duas fotos de celular o encheriam.

**O que não cabe aqui.** Arquivo em pasta de rede (`Z:\...`) não vira link:
navegador nenhum abre caminho de rede a partir de uma página da web.
