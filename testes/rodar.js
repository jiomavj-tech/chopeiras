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
const { spawn, spawnSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
/* Porta 0 = o sistema escolhe uma livre. Fixar uma porta faz o teste
   falhar por já haver algo a ouvir nela, que não é falha nenhuma. */
const PORTA = Number(process.env.PORTA || 0);

/* Duas cópias do aplicativo, e nenhuma delas depende de o arquivo estar
   ou não configurado — o teste tem de correr igual antes e depois de o
   Firebase ser ligado:

     index.html  sempre COM configuração, para o app passar do portão;
     cru.html    sempre SEM, que é onde se testa a tela de configuração,
                 o atalho de colar e a queda para a demonstração.

   O SDK verdadeiro nunca chega a ser carregado: as suítes barram-no e
   põem um Firestore de mentira no lugar. */
const CAMPOS = ['projectId','appId','apiKey','authDomain','storageBucket','messagingSenderId'];

function reescreverConfig(html, valor){
  CAMPOS.forEach(k => {
    html = html.replace(
      new RegExp('(' + k + ':\\s*)"[^"]*"'),
      (m, antes) => antes + '"' + (valor === null ? 'COLE_AQUI_' + k : valor) + '"');
  });
  return html;
}

const temporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'chopeiras-teste-'));
const original = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');

/* A configuração do Firebase passou do index.html para o arranque.js na
   separação. É ela que se troca por valores de teste — e por valores por
   preencher, para a suíte conferir a tela de "como ligar ao Firebase".
   Como cru.html precisa de um arranque diferente do de index.html, cada
   um leva o seu, e o cru aponta para o dele. */
const arranque = fs.readFileSync(path.join(RAIZ, 'arranque.js'), 'utf8');
fs.writeFileSync(path.join(temporaria, 'arranque.js'), reescreverConfig(arranque, 'teste'));
fs.writeFileSync(path.join(temporaria, 'arranque-cru.js'), reescreverConfig(arranque, null));
fs.writeFileSync(path.join(temporaria, 'index.html'), original);
fs.writeFileSync(path.join(temporaria, 'cru.html'),
  original.replace('./arranque.js', './arranque-cru.js'));
/* O núcleo é carregado por <script src> e precisa de estar ao lado da
   página: sem ele o aplicativo nem arranca, e as quatro suítes falhavam
   todas com o mesmo erro, que não era defeito nenhum do aplicativo. */
['icone-192.png','icone-512.png','icone-mascara.png','manifest.webmanifest',
 'style.css','pecas-compressores.json',
 'nucleo.js', 'base.js', 'clientes.js', 'chopeiras.js', 'acessos.js', 'chamados.js', 'integracoes.js', 'servicos.js', 'orcamento.js', 'documentos.js', 'demo.js']
  .forEach(f => fs.copyFileSync(path.join(RAIZ, f), path.join(temporaria, f)));

const TIPOS = {'.html':'text/html; charset=utf-8', '.png':'image/png',
               '.webmanifest':'application/manifest+json', '.js':'text/javascript',
               '.json':'application/json'};

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

/* Conferir a sintaxe custa meio segundo e apanha a classe de erro mais
   cruel: a que derruba o aplicativo inteiro em silêncio. Já aconteceu —
   um "else" sem fechar, e nenhuma tela funcionava. */
function conferirSintaxe(){
  const alvos = ['nucleo.js', 'arranque.js', 'base.js', 'clientes.js', 'chopeiras.js', 'acessos.js', 'chamados.js', 'integracoes.js', 'servicos.js', 'orcamento.js', 'documentos.js', 'demo.js', 'sw.js'];
  for(const f of alvos){
    const r = spawnSync(process.execPath, ['--check', path.join(RAIZ, f)], {encoding:'utf8'});
    if(r.status !== 0){
      console.log('\n✗ ' + f + ' não compila:\n' + (r.stderr || '').split('\n').slice(0,4).join('\n'));
      return false;
    }
  }
  /* O index.html não é JavaScript: confere-se cada bloco <script> dele. */
  const blocos = original.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g) || [];
  for(let i = 0; i < blocos.length; i++){
    const js = blocos[i].replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    const tmp = path.join(temporaria, 'bloco' + i + '.js');
    fs.writeFileSync(tmp, js);
    const r = spawnSync(process.execPath, ['--check', tmp], {encoding:'utf8'});
    fs.rmSync(tmp, {force:true});
    if(r.status !== 0){
      console.log('\n✗ bloco <script> ' + (i+1) + ' do index.html não compila:\n' +
                  (r.stderr || '').split('\n').slice(0,4).join('\n'));
      return false;
    }
  }
  console.log('  sintaxe: ' + (alvos.length + blocos.length) + ' arquivos, tudo compila');
  return true;
}

servidor.listen(PORTA, '127.0.0.1', async () => {
  const url = 'http://127.0.0.1:' + servidor.address().port + '/index.html';
  const ambiente = Object.assign({}, process.env, { URL_TESTE: url });
  let falhou = 0;

  /* Rápido primeiro: se a sintaxe ou uma regra do núcleo estiver errada,
     não vale subir quatro navegadores para descobrir. */
  console.log('\n══ antes de tudo ══');
  if(!conferirSintaxe()){
    servidor.close();
    fs.rmSync(temporaria, { recursive: true, force: true });
    process.exit(1);
  }

  if(!await correr('unidade.js', ambiente)) falhou++;

  for (const suite of ['1-cadastros.js', '2-chamados.js', '3-orcamento.js', '4-laudo-e-semana.js']) {
    if (!await correr(suite, ambiente)) falhou++;
  }

  servidor.close();
  fs.rmSync(temporaria, { recursive: true, force: true });
  console.log(falhou ? '\n' + falhou + ' suíte(s) com falha.' : '\nTudo passou.');
  process.exit(falhou ? 1 : 0);
});
