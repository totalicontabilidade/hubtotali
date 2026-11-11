# Hub Totali

A página de abertura do navegador da equipe. Numa tela só: os sistemas que
usamos, o que cada um tem para fazer hoje, a agenda tributária do mês e as
notícias oficiais do meio contábil.

Duas páginas:

| Página | Para quem | O que faz |
|---|---|---|
| `index.html` | toda a equipe | Início, Pendências e Notícias. Cada pessoa mexe só no próprio quadro |
| `admin.html` | só o administrador | cadastra sistemas e gente, edita recados. Pede senha |

Site estático: HTML, CSS e JavaScript, sem framework e sem biblioteca de
terceiro — nem a do Firebase (ver "Como conversa com o banco", no fim). O que
precisa de servidor (ler os sites do governo) é feito por um robô do GitHub,
que grava o resultado em arquivos da própria pasta.

---

## As cinco vistas

A barra da esquerda, com ícone **e nome** em cada botão, troca entre elas. Uma
vista de cada vez ocupa a tela toda; nada abre por cima de nada. Clicar na
marca (na barra ou no cabeçalho) volta ao Início. A faixa de recados da
administração fica embaixo de todas.

**Início** é o resumo do dia, na ordem em que importa de manhã. À esquerda,
**Minhas pendências**: o que atrasou, o que é para hoje, o que vence ainda esta
semana, a barra do dia e uma caixa para anotar sem sair dali; clicar numa
pendência abre o quadro com ela em destaque. À direita, **Próximos
vencimentos** (dez dias da agenda tributária), **Meus favoritos** (ou os mais
usados, para quem não marcou nenhum) e **Notícias oficiais** (cinco manchetes).

**Pendências.** O quadro inteiro, uma pessoa por quadro: quatro blocos de
prazo (Hoje, Esta semana, Com data, Acompanhar), setores com cores e
palavras-chave, calendário, comentários, anexos em PDF, clientes com CNPJ,
ditado e entendimento da frase. Veio do sistema *Pendências Totali* e está
descrito na seção própria, mais abaixo.

**Sistemas.** Todos os links da casa, na ordem da administração: favoritos,
mais usados (contados neste navegador), os grupos à vista e os grupos de
gaveta (órgãos, impostos e consultas) abertos ali mesmo, com um rótulo por
grupo. A busca do cabeçalho (tecla `/`) procura nesta lista e leva para cá.

**Notícias.** Todas as notícias lidas das fontes oficiais, agrupadas por dia,
com filtro por assunto e por fonte e busca. Cada uma abre no site original.

**Agenda.** O mês inteiro em lista por dia — Hoje, Amanhã, Próximos 7 dias,
Depois e, no fim, o que já venceu —, com setas para o mês anterior e o
seguinte. Lista, e não grade de calendário: para achar uma data, lista é mais
rápida; o dia da semana já está escrito em cada cartão.

A organização seguiu o que a pesquisa de usabilidade recomenda para páginas
iniciais de uso diário: rótulo visível na navegação (ícone sozinho só se
aprende para casa, lupa e impressora), tarefas da pessoa antes de tudo, poucas
notícias e sempre datadas, favoritos com esse nome e não "links rápidos".

---

## O quadro de pendências

### Como se usa

Escreva na caixa de cima e aperte **Adicionar** (ou Ctrl+Enter). O quadro
entende prazo e setor na própria frase:

| Escreve-se | O quadro entende |
|---|---|
| "DAE da Alfa **até sexta** no **fiscal**" | Com data (sexta), setor Fiscal, texto "DAE da Alfa" |
| "Folha da Beta **essa semana**" | Esta semana, setor Pessoal (pela palavra "folha") |
| "Ligar para o cliente **para acompanhar**" | Acompanhar |
| "Conferir convenção **hoje**" | Hoje, setor Pessoal |

A linha "Entendi: …" mostra o que foi lido antes de gravar; **Ignorar** desliga.
As palavras-chave que puxam cada setor se editam em **Gerenciar setores**.

Cada cartão tem: riscar (a bolinha), estrela (fica no topo), comentar (com
atalhos como "Esperando retorno do cliente"), editar, excluir, mover de bloco,
e os PDFs anexados. Uma pendência com data que vence hoje aparece em **Hoje**;
vencida, aparece em Hoje com o selo de atraso; que vence nesta semana aparece
em **Esta semana**. Riscadas somem do quadro no fim do dia e ficam na lista
**Riscadas**, para consulta, sem prazo e sem pergunta: riscada é concluída.
Apagar é à mão, cartão a cartão.

O calendário da lateral filtra por dia e mostra pontinhos onde há prazo; o
ícone de ampliar abre o mês inteiro com a agenda do dia escolhido.

**Clientes e CNPJs.** Cadastre uma empresa e seus apelidos; o nome passa a
aparecer sublinhado nas pendências e, ao passar o mouse, mostra o CNPJ com um
botão de copiar. Também dá para cadastrar escrevendo na pendência:
"DAE da Alfa (Alfa é uma empresa que o CNPJ é 12.345.678/0001-95)".

**Exportar / importar.** Baixa um `.json` com tudo do quadro, PDFs dentro, e
importa de volta sem duplicar. É também o caminho para trazer um quadro de
outra conta ou do sistema antigo.

### Onde os dados ficam

Um quadro por pessoa, no Firestore, identificado pelo uid da conta:

```
quadros/{uid}/tarefas/{id}      uma pendência por documento, campo a campo
quadros/{uid}/config/setores    { json: "{ lista: [...] }" }
quadros/{uid}/config/clientes   idem
Storage: quadros/{uid}/{id}     os PDFs
```

**É seu.** Só o dono lê e escreve o quadro inteiro. Duas portas além dele, e
só essas: o **administrador lê** (não escreve), para a cópia de segurança da
administração trazer o trabalho de todo mundo; e um **colega ou integração
pode criar** uma pendência no quadro de alguém, assinando quem criou
(`criadoPorUid`) — é por aí que a solicitação do Atos Societários chega ao
quadro da Legalização. Quem criou ainda pode riscá-la e comentar; mais nada.

Os setores da primeira vez saem dos **setores da casa** (administração →
Equipe → Setores), com as palavras-chave de `js/pendencias/config.js`.

O quadro se atualiza sozinho de minuto em minuto e ao voltar à aba. O que a
pessoa faz aparece na hora; se o banco recusar, a lista é relida.

### Os arquivos

| Caminho | O que é |
|---|---|
| `js/pendencias/config.js` | intervalo de atualização, palavras-chave e cores dos setores iniciais |
| `js/pendencias/escolher.js` | escolhe o armazenamento (banco do Hub ou navegador) e cria os setores da primeira vez |
| `js/pendencias/armazenamento/firestore.js` | o quadro no Firestore e os PDFs no Storage, pela API REST |
| `js/pendencias/armazenamento/local.js` | o quadro só neste navegador (modo de teste) |
| `js/pendencias/app.js` | toda a lógica da tela, blocos marcados com `/* ---------- nome ---------- */` |
| `js/pendencias/backup.js` | exportar e importar |
| `js/inicio.js` | o cartão Hoje da tela inicial |
| `css/pendencias.css` | o visual do quadro, preso a `.pend` e com as cores do Hub |

Toda leitura e gravação do quadro passa por `window.Armazenamento`; o resto da
página fala com ele por `window.PendenciasHub` e pelo evento `pendencias:mudou`.

**O que mudou em relação ao Pendências Totali original:** classes renomeadas
onde colidiam com as do Hub (`.pnav`, `.pbusca`, `.pvazio`, `.pagenda`,
`.pprazo`, `.pmarca`) e o id da busca (`#pendBusca`); o PDF abre no leitor do
próprio navegador em vez do pdf.js de CDN; nenhuma fonte remota; atributos
`style` trocados por CSSOM — a política de segurança do Hub não aceita nenhum
dos três.

---

## Notícias oficiais

O Hub não fala com site nenhum. Quem lê as fontes é
`ferramentas/buscar-noticias.js`, rodando no GitHub Actions
(`.github/workflows/atualizar.yml`) de meia em meia hora nos dias úteis (07:05
às 19:35) e uma vez no sábado, gravando `dados/noticias.json` só quando algo
mudou. O Hub só abre esse arquivo, e o recarrega a cada dez minutos. A hora da
última gravação está em `atualizadoEm`.

**O relógio.** O agendamento do próprio GitHub não é confiável: atrasa e pula
rodadas (em 10/11/2026 não fez nenhuma das oito da manhã). Quem manda o robô
rodar é a função `relogio` (`funcoes/index.js`), no Google Cloud Scheduler, de
meia em meia hora em dia útil das 7h05 às 19h35 de Brasília; ela só aperta o
"Run workflow" pela API do GitHub. Para isso usa o segredo `GITHUB_DISPARO`, um
token do GitHub restrito ao repositório `hubtotali` com só "Actions: leitura e
escrita", guardado com `firebase.cmd functions:secrets:set GITHUB_DISPARO
--project hubtotali`. Se o token vencer, gere outro do mesmo jeito, grave por
cima com o mesmo comando e publique as funções de novo. O agendamento do GitHub
continua no workflow como reserva, e o sábado de manhã fica só com ele.

**A ponte (SEFAZ/SE).** O site da SEFAZ de Sergipe não responde a quem está
fora do Brasil — a conexão nem abre —, e o GitHub está. Então a SEFAZ vai pela
**ponte**: uma Cloud Function no projeto `hubtotali`, em São Paulo
(`southamerica-east1`), que só busca páginas dos sites da lista `HOSTS` e
devolve o texto, sem guardar nada (`funcoes/index.js`). O robô a chama quando a
fonte tem `pelaPonte: true` e o endereço está em `PONTE_URL` (no workflow);
rodando aqui do escritório, sem a variável, ele lê o site direto. Publicar ou
atualizar a ponte: `firebase.cmd deploy --only functions` na raiz do Hub (Node 22; o
`firebase.json` aponta para `funcoes/`; a conta do Firebase CLI precisa ter o
projeto). O acesso público da ponte foi ligado à mão no Cloud Run (Segurança, "Permitir acesso público"), porque a CLI não consegue dar essa permissão neste projeto; o deploy não mexe nela. Não há segredo: o que protege é a lista fechada de sites, uma
instância no máximo e um freio de sessenta pedidos por minuto. Para pôr outra
fonte na ponte, acrescente o host em `HOSTS` e `pelaPonte: true` em `FONTES`.

**As fontes**, todas oficiais — órgão de governo, casa legislativa, conselho
de classe ou federação do setor:

| Fonte | Como é lida | Entra tudo? |
|---|---|---|
| Receita Federal | listagem "todas as notícias" | sim |
| Simples Nacional | a página de notícias do portal (não tem feed) | sim |
| Portal eSocial | listagem do gov.br | sim |
| Ministério da Fazenda | listagem do gov.br | só o que é do ramo |
| CFC | RSS | sim |
| Fenacon | RSS | sim |
| SEFAZ/SE | RSS do SharePoint | sim |
| Agência Câmara (últimas notícias) | RSS | só o que é do ramo |
| Agência Senado | RSS | só o que é do ramo |
| Agência Brasil (Economia) | RSS | só o que é do ramo |
| Agência Gov (governo federal, antes no portal gov.br) | RSS | só o que é do ramo |

"Do ramo" é uma lista de palavras (tributo, Simples, eSocial, FGTS, reforma
tributária, CNPJ…) em `DO_RAMO`. Cada notícia recebe etiquetas de assunto
(Reforma Tributária, Simples e MEI, Tributos federais, Trabalhista e
Previdência, Contábil e normas, Empresas e cadastros, Legislação, Sergipe) e
uma **relevância** de 0 a 3: fonte do ramo e assunto do dia a dia sobem;
apreensão, concurso, cerimônia descem. O cartão da tela inicial mostra as de
relevância alta dos últimos sete dias; a vista Notícias mostra tudo.

Notícia que saiu do feed fica no arquivo por 45 dias; as três últimas de cada
fonte ficam por seis meses, para fonte que publica pouco não sumir. Manchete
repetida em duas fontes (a Fazenda republica a Receita) entra uma vez.

"Nova" é o que apareceu desde a última vez em que **esta** pessoa abriu a
vista Notícias — fica no navegador dela. O selo da barra conta só as de
relevância alta.

Para acrescentar uma fonte: uma linha em `FONTES`, com `tipo` `rss`,
`plone` (listagem do gov.br) ou `simples`. Se um site mudar de leiaute, o
leitor dele passa a devolver zero itens e a fonte aparece como "sem resposta"
na tela — nada quebra, e o registro do Actions diz qual foi.

Para rodar à mão: `node ferramentas/buscar-noticias.js` (Node 18 ou mais novo,
sem instalar nada). Os testes do leitor: `node testes/teste-noticias.js`.

---

## A agenda tributária

A agenda do mês é **calculada por regra** em `js/agenda.js`: DAS no dia 20,
eSocial no 15, PIS/COFINS no 25, e assim por diante, com o ajuste de fim de
semana e feriado próprio de cada obrigação (tributo federal antecipa, Simples
e declarações adiam, ICMS de Sergipe adia dentro do mês). Feriados nacionais e
os móveis da Páscoa também são calculados. As anuais (DEFIS, DASN-SIMEI, IRPF,
ECD, ECF, DIMOB, as duas parcelas do 13º) entram só no mês delas.

**E é conferida com a Receita.** Todo mês a Receita publica a agenda oficial
por Ato Declaratório Executivo, com uma página por dia de vencimento.
`ferramentas/buscar-agenda.js` lê essas páginas (mês corrente e o seguinte,
quando já publicado) e grava `dados/agenda-oficial.json`. O Hub cruza as duas:

- obrigação federal no mesmo dia ganha o visto ✓;
- em dia diferente, **a data da Receita manda** na tela, com o aviso "A Receita
  publicou dia X (a regra dava Y)" — é ela quem multa;
- obrigação que a Receita lista e a regra não conhece aparece em "Outras
  obrigações na agenda da Receita", no painel do mês inteiro.

A tabela `RECONHECE` em `js/agenda.js` diz como cada regra se reconhece na
agenda oficial (pelo nome da declaração ou pelo código de receita do DARF).
Estado e município saem só da regra: a Receita não os publica. O selo
"conferida com a Receita" no cartão da agenda diz que o cruzamento foi feito.

As linhas marcadas `conferir: true` são as que eu tenho menos certeza — a tela
as mostra com uma etiqueta. **Prazo fiscal é matéria do contador**: confira
cada linha de `REGRAS` antes de a equipe confiar nela. Os testes das datas:
`node testes/teste-agenda.js`.

---

## Editar o Hub (administração)

Abra `admin.html`, entre com o e-mail e a senha, e edite na própria tela:

- **acrescentar, renomear e apagar** sistema e grupo de sistemas;
- **arrastar para reordenar**, inclusive de um grupo para outro;
- **escolher se o setor fica à vista** (cartões) **ou recolhido** (gaveta);
- **trocar o logo** de um sistema, enviando uma imagem;
- **editar os avisos** da faixa inferior do Hub;
- **cadastrar gente**, setores da casa e **liberações**;
- **importar os clientes da casa** e **trazer o quadro antigo**;
- **baixar a cópia de segurança**: sistemas, equipe e os quadros de pendências
  de todo mundo (dos PDFs vai só a ficha);
- **mandar recados** para a equipe e ver quem já viu (aba Recados e
  acompanhamento), e **acompanhar**, só leitura: os quadros da equipe em
  números — abertas, atrasadas, para hoje, não vistas, riscadas na semana —,
  o estado do robô de notícias e agenda (quando gravou, que fonte não
  respondeu, atalho para rodar na mão no GitHub) e o que chegou do Atos.
  O texto das pendências não aparece: a leitura vai com máscara de campos.

Nada da aba "Tela inicial" é gravado até você clicar em **Salvar**. As outras
abas gravam na hora ou só leem.

### Liberações

Na aba **Equipe → Editar**, o administrador marca o que cada pessoa pode fazer
na administração sem ser administradora: acrescentar sistemas, editar e
reordenar, apagar, criar grupos, recados. **Depois de mexer nelas no código,
republique `firestore.rules`.**

---

## O banco

Projeto Firebase `hubtotali`, Firestore em São Paulo. As regras estão em
`firestore.rules` e `storage.rules`; depois de qualquer mudança neles,
**publique de novo no console** — o arquivo daqui é só a cópia. Antes de
colar: `node ferramentas/conferir-regras.mjs firestore.rules`.

Documentos:

| Onde | O quê | Quem escreve |
|---|---|---|
| `hub/config`, `hub/logos`, `hub/anterior` | sistemas, ícones, a versão de antes do último Salvar | administrador e liberações de sistemas |
| `hub/avisos` | os recados | administrador, Gerência e liberação "avisos" |
| `hub/departamentos` | os setores da casa | administrador |
| `equipe/{uid}` | quem pode entrar | administrador |
| `favoritos/{uid}` | os favoritos de cada um | só a pessoa |
| `quadros/{uid}/…` | o quadro de pendências de cada um | a pessoa; colega cria; administrador lê |
| `pendencias`, `pendencias_reservadas` | o quadro antigo do escritório, só leitura | ninguém mais escreve pela tela |

Sobre a `apiKey` ficar visível na página: é assim mesmo. No Firebase ela não é
senha, é o endereço do projeto. Quem protege o banco são as regras.

**Trocar de administrador** exige mexer em DOIS lugares com o mesmo UID: o
`ADMIN_UID` em `js/config-hub.js` e a linha do `request.auth.uid` em
`firestore.rules`.

### O Storage e o CORS

Os PDFs do quadro ficam no balde `hubtotali.firebasestorage.app`, em
`quadros/{uid}/`. Abrir um PDF busca o arquivo com a sessão de quem clicou, e
isso exige a política de CORS do balde (`cors.json`, `STORAGE-CORS.md`) — ela
já está aplicada para os endereços do Hub.

---

## Pendências entre pessoas

O quadro é de cada um, mas o trabalho é da equipe. Por isso (desde 09/11/2026)
a nova pendência tem **Para quem** e **Quem acompanha**, no quadro e na caixa
da tela inicial:

- **Para quem** manda a pendência para o quadro de um colega — ou de vários,
  uma cópia para cada (mesmo `loteId`). Ela chega com a faixa "de Fulano ·
  nova" e um botão **Visto**; o dono cuida dela como de qualquer outra. Quem
  mandou vê na aba **Enviadas** se foi vista, riscada e comentada, e pode
  comentar e riscar de lá — e apagar, enquanto o dono ainda não viu (depois
  disso, só o dono apaga).
- **Quem acompanha** (`envolvidos`) vê a pendência na aba **Acompanho** e pode
  comentar, sem recebê-la.
- Os comentários levam quem escreveu (`por`, `porUid`); o nome aparece quando
  não é o dono do quadro.

A regra do banco é quem garante: o dono muda tudo; quem mandou mexe só no que
é do pedido (texto, prazo, importância, acompanhantes, riscar, comentar) e só
apaga o que ainda não foi visto; quem acompanha só comenta; listar o que está no quadro alheio exige filtrar por
`criadoPorUid` ou `envolvidos`. Para a equipe inteira há duas coisas, e são
diferentes: o **aviso** da faixa de baixo (fica lá até a administração tirar) e
o **recado** da administração, que cada pessoa vê uma vez (seção abaixo).

## Recados da administração

No quadro antigo, junto com as pendências, havia o **recado**: um aviso da
administração para a equipe inteira, que não era tarefa de ninguém. Voltou em
10/11/2026 como coleção própria (`recados/{id}`: `texto`, `criadoEm`,
`criadoPor`, `criadoPorNome`), **escrito só pela administração** (admin.html,
aba Recados e acompanhamento) e visto **uma vez** por cada pessoa: assim que
ela abre o Hub, os recados que ainda não viu aparecem num cartão por cima da
tela (`<dialog>`, `js/recados.js`); "Entendi" (ou Esc) marca como lido e o
recado não volta. O que cada um leu fica em `quadros/{uid}/config/recados`
(a equipe lê, só a pessoa escreve), e é daí que a administração vê "visto por
N de M" e quem falta. Recado não se edita — apaga-se e escreve-se outro, para
ninguém ter "lido" um texto que depois mudou. Recado com mais de trinta dias
não pula na frente de quem entra na equipe depois. Os recados de antes
continuam em `pendencias` (só leitura) e aparecem na administração fechados
numa gaveta, como registro.

Não confundir com os **avisos** da faixa de baixo do Hub (`hub/avisos`): esses
ficam lá o tempo todo, sem leitura marcada, e se editam na aba Tela inicial.

## Os clientes da casa

A administração (aba **Equipe e acessos → Clientes da casa**) importa o
relatório de clientes do sistema contábil — `.xlsx` ou `.csv`, com as colunas
Nome e CNPJ/CPF — ou cola as linhas. O `.xlsx` é lido no próprio navegador,
sem biblioteca (`js/planilha.js`: o arquivo é um zip com XML dentro, e o
navegador sabe descompactar e ler XML). A lista vai para `hub/clientes` e
**todo quadro de pendências a enxerga**: o nome da empresa escrito numa
pendência vira um chip com o CNPJ, inclusive sem o "LTDA" do fim. No quadro,
os clientes da casa aparecem marcados "da casa": a pessoa só lhes dá apelidos,
e acrescenta os seus próprios. A importação substitui a lista inteira; os
apelidos de cada um ficam.

## O quadro antigo e a migração

Até 09/11/2026 o Hub tinha um quadro único do escritório (pendência com
responsável, linha do tempo, recados com ciência). Ele saiu da tela; as
coleções `pendencias` e `pendencias_reservadas` continuam no banco, só
leitura, e a cópia de segurança continua trazendo-as.

**Trazer as pendências antigas para os quadros novos** se faz pela
administração (aba **Equipe e acessos → Quadro antigo**). O botão lê todas,
decide o dono de cada uma — quem fazia; sem responsável, a única pessoa do
setor de destino; sem isso, quem pediu — mostra o plano por pessoa e, com a
confirmação, cria cada pendência no quadro do dono: o "o quê" em negrito, o
porquê e a sugestão embaixo, a linha do tempo como comentários, prazo em "Com
data", urgente marcada como importante, resolvida já riscada. Recados ficam de
fora: voltaram como coleção própria (seção "Recados da administração"), e os
antigos aparecem lá só como registro. Pode rodar de novo: o que já foi trazido
(`origemSistema: "hub-antigo"`, `origemId`) não duplica. Quem decide é
`js/migracao-quadro.js`, testado em `testes/teste-migracao.js`.

Quem usava o Pendências Totali à parte traz o quadro pelo **Exportar /
importar → Importar cópia**, dentro do Hub, logado na própria conta. A
importação não duplica, soma setores e clientes e reenvia os PDFs.

A integração do **Atos Societários** passou a escrever no quadro de uma pessoa
escolhida: ver `integracoes/atos-societarios/LEIAME.md` — é preciso preencher
`DESTINO_UID` no Apps Script e publicar nova versão do `receber.gs`.

---

## Ver antes de publicar

```bash
node serve.js
```

E abra <http://localhost:8123>. Com `node serve.js --teste` (porta 8124) o
Hub roda **sem banco**: entra sozinho e guarda tudo só no navegador — dá para
mexer no quadro à vontade sem tocar na lista de verdade da equipe.

Os testes, sem internet e sem instalar nada:

```bash
node testes/teste-frases.js
node testes/teste-noticias.js
node testes/teste-agenda.js
node testes/teste-migracao.js
```

---

## Publicar

Está publicado em **https://hub.totalicontabilidade.com.br** (GitHub Pages;
o domínio vive no arquivo `CNAME`). Para publicar uma mudança de código:

```bash
git add -A
git commit -m "o que mudou"
git push
```

O robô de notícias e agenda faz os próprios commits ("Notícias e agenda:
atualização automática"); dá para dispará-lo à mão em Actions → *Atualizar
notícias e agenda* → *Run workflow*.

---

## Decisões que valem lembrar

**Como conversa com o banco.** O Hub abre dezenas de vezes por dia, por pessoa.
Carregar a biblioteca do Firebase custaria uns 300 kB em cada abertura. Então
tudo fala com o Firestore e com o Storage pela API REST, e o login pela API
REST do Authentication. A pasta inteira não tem uma dependência externa.

**Nada de fora na página.** A política de segurança (`index.html`) só deixa
carregar script, estilo e fonte da própria pasta; conversar só com o Google;
imagem embutida ou do unavatar.io (o ícone de um link próprio, uma vez). Por
isso as notícias passam por arquivo, e por isso o PDF abre no leitor do
navegador.

**A espera não existe.** O Hub desenha com a última cópia guardada no
navegador e busca a versão nova por baixo. Ninguém vê tela branca esperando
rede.

**Favoritos e gavetas são de cada pessoa**, no banco, por uid. **O quadro de
pendências também é de cada pessoa** — foi a escolha do Pendências Totali, e
é o que faz a caixa "anotar" ser sem atrito: ninguém precisa decidir para quem
mandar antes de anotar.

**O id do setor nunca muda.** É a chave dos favoritos (`fiscal|e-CAC`) e das
pendências por setor. Renomear na tela não apaga o atalho de ninguém.

**Logo enviado vira dado, não arquivo.** A imagem é reduzida a 64×64 no próprio
navegador e guardada no banco. O repositório é público, e nome de arquivo
conta coisa.
