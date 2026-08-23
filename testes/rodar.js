/* Levanta o aplicativo num servidor de mentira e corre as duas suítes.

     node testes/rodar.js

   Precisa do Playwright instalado. Se o Chromium não estiver no lugar
   habitual, aponte-o:  CHROMIUM=/caminho/para/chrome node testes/rodar.js

   Por que existe um servidor em vez de abrir o arquivo direto: em
   `file://` o navegador nega o sessionStorage, e sem ele o Firestore de
   mentira perderia tudo a cada recarregamento — justamente o que é
   preciso para testar "o mesmo banco, outra pessoa a entrar". */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const RAIZ = path.join(__dirname, '..');
/* Porta 0 = o sistema escolhe uma livre. Fixar uma porta faz o teste
   falhar por já haver algo a ouvir nela, que não é falha nenhuma. */
const PORTA = Number(process.env.PORTA || 0);

/* O app recusa-se a arrancar sem a configuração do Firebase — e ainda
   bem. Para o teste, uma configuração de faz de conta basta: o SDK
   verdadeiro nunca chega a ser carregado. */
const temporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'chopeiras-teste-'));
let html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
['projectId','appId','apiKey','authDomain','storageBucket','messagingSenderId']
  .forEach(k => { html = html.split('"COLE_AQUI_' + k + '"').join('"teste"'); });
fs.writeFileSync(path.join(temporaria, 'index.html'), html);
['icone-192.png','icone-512.png','icone-mascara.png','manifest.webmanifest']
  .forEach(f => fs.copyFileSync(path.join(RAIZ, f), path.join(temporaria, f)));

const TIPOS = {'.html':'text/html; charset=utf-8', '.png':'image/png',
               '.webmanifest':'application/manifest+json', '.js':'text/javascript'};

const servidor = http.createServer((req, res) => {
  const nome = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const alvo = path.join(temporaria, path.normalize(nome).replace(/^(\.\.[/\\])+/, ''));
  fs.readFile(alvo, (erro, dados) => {
    if (erro) { res.writeHead(404); res.end('não encontrado'); return; }
    res.writeHead(200, {'content-type': TIPOS[path.extname(alvo)] || 'application/octet-stream'});
    res.end(dados);
  });
});

/* As suítes correm uma a uma, e sem bloquear: quem serve as páginas é
   este mesmo processo. Com spawnSync o servidor ficaria mudo enquanto o
   navegador pede a página, e o teste falhava por tempo esgotado — que
   não era falha do aplicativo nenhuma. */
function correr(suite, ambiente){
  return new Promise(resolve => {
    console.log('\n══ ' + suite + ' ══');
    const p = spawn(process.execPath, [path.join(__dirname, suite)],
                    { stdio: 'inherit', env: ambiente });
    p.on('close', codigo => resolve(codigo === 0));
  });
}

servidor.listen(PORTA, '127.0.0.1', async () => {
  const url = 'http://127.0.0.1:' + servidor.address().port + '/index.html';
  const ambiente = Object.assign({}, process.env, { URL_TESTE: url });
  let falhou = 0;

  for (const suite of ['1-cadastros.js', '2-chamados.js', '3-orcamento.js']) {
    if (!await correr(suite, ambiente)) falhou++;
  }

  servidor.close();
  fs.rmSync(temporaria, { recursive: true, force: true });
  console.log(falhou ? '\n' + falhou + ' suíte(s) com falha.' : '\nTudo passou.');
  process.exit(falhou ? 1 : 0);
});
