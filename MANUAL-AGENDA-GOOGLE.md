# Agenda do Google — como ligar

Sem isto o app funciona igual: cada chamado mostra um botão
**"Pôr na agenda"** que abre o Google Agenda já preenchido, e você
confirma. O que está abaixo serve para o compromisso ser criado
**sozinho** — e, ao remarcar, mudar a data no mesmo compromisso em vez
de criar outro.

Faz-se uma vez só.

## 1. Criar o projeto

1. Abra <https://console.cloud.google.com/>
2. No alto, à esquerda, clique em **Selecionar um projeto** → **NOVO PROJETO**
3. Nome: `Chopeiras` → **CRIAR**

## 2. Ligar a API da agenda

1. Na busca do topo, escreva `Google Calendar API`
2. Abra o resultado e clique em **ATIVAR**

## 3. Tela de consentimento

1. Menu à esquerda → **APIs e serviços** → **Tela de permissão OAuth**
2. Tipo: **Externo** → **CRIAR**
3. Preencha só o obrigatório (nome do app: `Chopeiras`, e o seu e-mail)
4. Salve até o fim
5. Em **Usuários de teste**, clique em **+ ADD USERS** e ponha
   `gibasolucoes@gmail.com`

   Sem isso o Google recusa a permissão, porque o app não é público.

## 4. Criar a credencial

1. Menu → **Credenciais** → **+ CRIAR CREDENCIAIS** → **ID do cliente OAuth**
2. Tipo: **Aplicativo da Web**
3. Em **Origens JavaScript autorizadas**, clique em **+ ADICIONAR URI** e
   ponha exatamente:

   ```
   https://jiomavj-tech.github.io
   ```

   Só isso, sem `/chopeiras` no fim. É a origem, não o endereço da página.

4. **CRIAR**
5. Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`)

## 5. Colar no aplicativo

1. Abra o app e entre como administrador
2. Vá na aba **Acessos** e desça até **Agenda do Google**
3. Cole o ID do cliente no campo e clique em **Guardar**
4. Clique em **Conectar agenda** — o Google pede permissão uma vez
5. Se aparecer o aviso "app não verificado", clique em **Avançado** →
   **Acessar Chopeiras (não seguro)**. É o seu próprio app.

Pronto.

## O que passa a acontecer

- Marcar **recolha prevista** cria "Retirar chopeira — *cliente*" às 9h
- Marcar **entrega** cria "Entregar chopeira — *cliente*" às 14h, ou na
  hora exata se você preencher data/hora, com o endereço no local
- **Remarcar muda a data no mesmo compromisso** — não duplica
- **Apagar a data apaga o compromisso** da agenda
- Os compromissos duram 2 horas e ficam no fuso de São Paulo

## Se parar de funcionar

A permissão do Google vale por algumas horas e é renovada calada. Se
você trocar de navegador ou limpar os dados do site, volte na aba
**Acessos** e clique em **Conectar agenda** de novo. O ID do cliente
continua guardado.
