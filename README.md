# Chopeiras — gestão de manutenção

👉 quando publicado: `https://jiomavj-tech.github.io/chopeiras/`

Cadastro das chopeiras de cada cliente, com acesso controlado: o cliente entra com a conta Google
dele e vê apenas os equipamentos da própria empresa. O Giba vê e mantém tudo.

**As cinco entregas planeadas estão feitas.** O que continua de fora, e porquê, está no fim.

## Experimentar sem configurar nada

Enquanto o Firebase não estiver ligado — ou acrescentando `?demo` ao endereço — o aplicativo abre
em **modo demonstração**: um banco de exemplo que vive dentro do navegador, com duas empresas,
três chopeiras, um orçamento à espera de resposta e um serviço já entregue com laudo.

Dá para percorrer tudo, dos dois lados: a faixa no topo tem o botão **Ver como o cliente**, que
troca de papel sem sair da página, e **Recomeçar**, que devolve o exemplo ao estado inicial. Nada
sai do aparelho e nada ali é real — é para ver como funciona antes de ligar ao Firebase.

## O que já funciona

**Portão de acesso.** Login com conta Google. Quem entra pela primeira vez cai numa fila e não vê
nada até ser aprovado — e ninguém se aprova a si próprio, nem por erro de programação: a regra que
proíbe está em `firestore.rules`, conferida no servidor do Google, não nesta página.

**Convite por e-mail.** Ao cadastrar a empresa, escrevem-se os e-mails que podem entrar por ela.
Quem entrar com um desses e-mails já nasce ligado àquela empresa e liberado, sem passar pela fila.
Sem isto, um e-mail novo a aparecer no painel não teria como ser ligado à empresa certa — e aprovar
às cegas é como alguém acaba a ver a chopeira do vizinho.

**Cadastro de empresas.** CNPJ com máscara e conferência dos dois dígitos verificadores (avisa na
hora se não bater, e recusa CNPJ repetido noutra empresa), razão social, nome fantasia, endereço,
contacto e o WhatsApp — que é por onde os avisos de status vão sair na entrega 2.

**Cadastro de chopeiras.** Número da etiqueta (é por ele que se busca), empresa dona, local de
instalação, marca, modelo, tipo, torneiras, e os dados do compressor: marca, modelo, potência, gás
e aplicação. Mais uma foto, reduzida no próprio aparelho antes de subir.

**Painel de acessos.** Quem está na fila, quem já entrou, a que empresa cada um pertence, e os
botões de aprovar e bloquear. Aprovar alguém sem empresa ligada dá aviso antes — essa pessoa
entraria e não veria nada.

**Chamado aberto pelo cliente.** Ele digita o número da etiqueta e o app busca no cadastro dele:
se achar, mostra a ficha para confirmar; se não achar, deixa enviar assim mesmo e a chopeira entra
como **provisória**, para o Giba completar depois — um chamado não pode esperar o cadastro ficar
perfeito. Até três fotos, e o problema escrito ou **ditado**.

**Status e linha do tempo.** Dez estados, de *chamado aberto* a *entregue*. Cada mudança guarda
quem mudou, quando, e o recado escrito para o cliente — e os dois lados veem a mesma linha do
tempo. Os encerrados saem da lista de abertos sem sumir: ficam atrás de um botão.

**Aviso de duas vias.** Toda mudança acende um **sino** no cabeçalho do outro lado, que se apaga
ao abrir o chamado. E o Giba tem o botão **Avisar no WhatsApp**, que abre a conversa com a
mensagem já escrita — status, recado, número da OS e, quando é orçamento, o total.

**Cadastro de peças.** Código, descrição, unidade, preço de venda e onde serve. A descrição sugere
as peças de chopeira do app de compressores — pressostato KP1, relé voltimétrico, capacitor de
partida, protetor térmico — mas aceita qualquer outra. O preço entra sozinho no orçamento e pode
ser mudado ali sem mexer no cadastro.

**Orçamento com peças e serviço separados.** Peça vem do cadastro com um toque, ou escrita na mão;
serviço é sempre escrito. Cada grupo tem o seu subtotal, e o total soma os dois — é assim que o
cliente decide, porque ele aceita pagar a peça e discute a mão de obra, ou o contrário. O valor
total é recalculado enquanto se digita.

**Semana.** A fila de chamados diz em que pé está cada um; esta tela responde a outra pergunta,
que é a que faz sair de casa: o que **buscar**, o que está **na oficina** e o que **entregar**.
Data vencida vira selo de *atrasado* com a contagem de dias, e o resumo do topo diz quantos
esperam peça e quantos esperam resposta do cliente.

**Laudo com os ensaios que você faz.** Ao concluir, o app monta o laudo a partir da sua própria
tabela de testes do app de compressores — protetor térmico, relé magnético e voltimétrico,
capacitores, solenoide, micromotor, pressostatos e o checklist do compressor. **Nenhum ensaio
entra sozinho**: você escolhe o que mediu, e o texto fica editável. Relé e protetor vêm com o
aviso de que os testes são opostos, porque trocar um pelo outro condena peça boa e aprova peça
ruim.

**PDF com as fotos, sem biblioteca nenhuma.** Capa com cliente e equipamento, reclamação,
problema constatado, ensaios com a conclusão de cada um, serviço executado, peças substituídas
com valores, recomendações, as fotos do chamado e as duas linhas de assinatura. No celular, o
botão abre a folha de partilha e vai direto para o WhatsApp.

**Aprovação do cliente, por escrito.** Quando o orçamento é enviado, aparecem no aplicativo dele os
botões de **aprovar** e **não aprovar** — este último pedindo o motivo. A resposta fica gravada com
o nome de quem respondeu e a data, e entra na linha do tempo. Depois de respondido, os botões dão
lugar ao registro: responde-se uma vez.

## Como se usa

Do lado do Giba: cadastra a empresa, escreve os e-mails de quem vai poder entrar, e lança as
chopeiras daquela empresa uma a uma. Do lado do cliente: abre, entra com o Google, e vê a lista dos
equipamentos dele com a ficha completa de cada um.

## Quem vê o quê

| | Cliente aprovado | Giba |
|---|---|---|
| A própria empresa | lê | lê e escreve todas |
| Chopeiras | lê só as da empresa dele; cria provisória ao abrir chamado | tudo |
| Chamados | lê só os da empresa dele; abre novos | tudo |
| Status do chamado | não move | é quem move |
| Cadastro de peças e preços | não vê | tudo |
| Valores do orçamento | vê os da ordem dele; não altera | é quem lança |
| Aprovar ou não aprovar | responde uma vez, só com orçamento na mesa | pode registrar por ele |
| Laudo | lê e baixa o PDF | emite e refaz |
| Semana | não vê | é a tela de abertura |
| Fotos | lê só as da empresa dele; pode criar | tudo |
| O próprio acesso | não se aprova | aprova e bloqueia |
| Empresa a que pertence | não escolhe | define |

Isto não é conferido dentro da página. Está em `firestore.rules` e é conferido antes de gravar —
mesmo que alguém abra o console do navegador e tente escrever direto no banco, a regra recusa.

## Ligar ao Firebase (uma vez só)

O aplicativo abre já com as instruções na tela enquanto não estiver ligado. Em resumo:

1. Em [console.firebase.google.com](https://console.firebase.google.com), criar o projeto
   **giba-chopeiras**.
2. **Authentication → Sign-in method → Google**: ativar.
3. **Firestore Database → Criar banco**: modo produção, região `southamerica-east1` (São Paulo).
4. **Configurações do projeto → Seus apps → Web**: registar um app e copiar o bloco
   `firebaseConfig`.
5. Colar esses valores na constante `CFG`, no topo do `index.html`.
6. Publicar as regras: `firebase deploy --only firestore`.

**Atalho para experimentar antes de editar o arquivo.** A tela de configuração tem uma caixa onde
se cola o bloco `firebaseConfig` inteiro, tal como o console o mostra. Ele fica guardado só naquele
navegador e o aplicativo liga na hora — serve para conferir que o projeto está de pé sem publicar
nada. Para os clientes verem, os valores têm de acabar mesmo no `index.html`; enquanto isso, o
rodapé avisa que a configuração é local e oferece esquecê-la.
7. **Authentication → Settings → Domínios autorizados**: acrescentar o domínio onde a página está
   publicada. Sem este passo o login abre e fecha sem dizer porquê.

Os valores do `CFG` não são segredo: numa página web são públicos por definição. Quem protege os
dados são as regras do passo 6.

Publicar, no Firebase Hosting: `firebase deploy --only hosting`.

## Publicar no GitHub Pages

Alternativa ao Firebase Hosting, e o caminho mais curto para ver no celular: em
**Settings → Pages** do repositório, escolher *Deploy from a branch* → `master` → `/ (root)`.
Um a dois minutos depois a página está em `https://jiomavj-tech.github.io/chopeiras/`.

Publicando assim, as regras do Firestore continuam a ter de ser enviadas à parte —
`firebase deploy --only firestore` — porque elas vivem no Google, não na página.

## Estrutura

| Arquivo | Para que serve |
|---|---|
| `index.html` | O aplicativo inteiro: portão, cadastros, chamados, painel |
| `firestore.rules` | Quem vê o quê — conferido no servidor |
| `firebase.json`, `.firebaserc` | Hospedagem e projeto |
| `manifest.webmanifest` | Nome, cores e ícones para instalar no celular |
| `sw.js` | Faz o app abrir sem rede depois de instalado |
| `testes/` | As quatro suítes e o Firestore de mentira |
| `robots.txt` | Pede aos buscadores que não indexem: é app de uso restrito |

Ao publicar uma alteração, incrementar `VERSAO` no `sw.js` e o número em `#versaoApp` no
`index.html`. O `sw.js` busca o HTML **pela rede primeiro** e só recorre à cache se não houver
ligação: um service worker que serve a cache primeiro faz a versão antiga continuar a aparecer
depois de publicada uma correção, e o sintoma é indistinguível de um erro no código.

## Testes

```
node testes/rodar.js
```

Abre o aplicativo num Chromium de verdade, com um Firestore de mentira no lugar do Google, e
percorre os fluxos inteiros — **75 verificações**, incluindo gerar o PDF e conferir que o arquivo
é mesmo um PDF, com a foto embutida. Detalhe do que cobre e do que **não** cobre
em [`testes/LEIAME.md`](testes/LEIAME.md).

## O que ficou de fora, e porquê

**Notificação push automática.** Exige um servidor para disparar — uma página estática não pode
guardar a chave de envio — e isso pede o plano pago do Firebase. Enquanto isso o aviso sai pelo
sino dentro do app e pelo WhatsApp, com a mensagem pronta. No iPhone, push exigiria ainda que o
cliente tivesse o app na tela inicial.

**Desconto e imposto no orçamento.** É soma de linhas: quantidade × valor, em dois grupos.
Desconto, por ora, é uma linha de serviço com valor negativo.

## Limitações conhecidas

- **Notificação push ainda não existe.** O aviso sai pelo sino dentro do app e pelo WhatsApp, com
  a mensagem já escrita, mas é o Giba quem aperta o botão. Push automático exige servidor — e, no
  iPhone, exige ainda que o cliente tenha o app na tela inicial. Fica para a entrega 5.
- **O ditado precisa de internet no momento da fala.** O reconhecimento é do navegador, não do
  app: no meio do salão sem sinal, não vai. O campo continua editável no teclado, e no iPhone o
  microfone do próprio teclado faz o mesmo serviço.
- **A foto vive dentro do banco**, num documento próprio, comprimida a 1280 px. Três a cinco fotos
  por equipamento é confortável; álbum, não.
- **O cadastro é mantido pelo Giba.** O cliente lê e não corrige — de propósito, para não haver
  duas versões da mesma empresa.
- **O orçamento não calcula imposto nem desconto.** É soma de linhas: quantidade × valor, em dois
  grupos. Desconto, por enquanto, é uma linha de serviço com valor negativo.

## Licença

**Todos os direitos reservados** — veja [LICENSE](LICENSE).
