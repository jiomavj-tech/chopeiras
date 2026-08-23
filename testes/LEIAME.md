# Testes

Duas suítes que abrem o aplicativo num Chromium de verdade, com um Firestore
de mentira no lugar do Google.

```
node testes/rodar.js
```

O `rodar.js` monta uma cópia do `index.html` com a configuração do Firebase
preenchida de faz de conta, serve numa porta local e corre as suítes.

| Arquivo | O que verifica |
|---|---|
| `1-cadastros.js` | Portão de acesso, convite por e-mail, CNPJ, cadastro de chopeiras, painel de acessos, e o cliente a ver só o que é dele |
| `2-chamados.js` | Abertura de chamado, chopeira provisória, mudança de status, linha do tempo, sino e o link do WhatsApp |
| `3-orcamento.js` | Cadastro de peças, preço em vírgula, orçamento com peças e serviço separados, envio, e a aprovação e a recusa do cliente |
| `firestore-de-mentira.js` | O dublê: guarda tudo na sessão do navegador e imita a API do Firestore, incluindo `arrayUnion` e os carimbos de tempo |

## O que estes testes NÃO cobrem

**As regras de segurança.** O dublê não as aplica — ele imita a API, não o
servidor do Google. O que se testa aqui é o comportamento do aplicativo
(quem vê que botão, o que é gravado). Para provar as regras seria preciso o
emulador do Firebase, com `firebase emulators:exec`.

**O ditado e a câmera.** Precisam de microfone e de internet de verdade.

## Se o Chromium não for encontrado

```
CHROMIUM=/caminho/para/chrome node testes/rodar.js
```
