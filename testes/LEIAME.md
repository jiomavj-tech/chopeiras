# Testes

Dois níveis, e a ordem importa: o rápido primeiro, para não subir quatro
navegadores só para descobrir um erro de sintaxe.

## `unidade.js` — as regras, em ~90 ms

```
node testes/unidade.js
```

Carrega o `nucleo.js` como módulo do Node e confere as 60 regras que não
dependem de tela nem de banco: CPF e CNPJ, contas de prazo, orçamento que
vence, soma com vírgula, o recado que o cliente lê, fluxo de status,
numeração de OS e laudo, janela da agenda.

É este que se roda **enquanto se mexe**. Custa menos de um segundo, então
não há desculpa para pular.

Ao acrescentar uma regra ao `nucleo.js`, o teste dela vem junto — se não
vier, a regra passa a existir sem rede de segurança.

## `rodar.js` — tudo, em ~2 min

```
node testes/rodar.js
```

Nesta ordem:

1. **Sintaxe** de `nucleo.js`, `sw.js` e de cada bloco `<script>` do
   `index.html`. Meio segundo, e apanha a classe de erro mais cruel: a
   que derruba o aplicativo inteiro em silêncio.
2. **`unidade.js`**, as regras.
3. **As quatro suítes de navegador**, num Chromium de verdade com um
   Firestore de mentira no lugar do Google.

É este que se roda **antes de publicar**.

---

*Nota:* as suítes de navegador contam qualquer erro de console como
problema. Num ambiente sem saída para a internet, os pedidos ao CDN do
Firebase falham e aparecem como falha — não são.
