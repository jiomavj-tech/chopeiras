/* Entrega 1: portão de acesso, empresas e chopeiras.

   Roda por `node testes/rodar.js`, que levanta o servidor antes.
   O Firestore é de mentira e o SDK verdadeiro é barrado: o que se
   testa aqui é o aplicativo, não o Google. */
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const BASE = __dirname;
const fake = fs.readFileSync(BASE + '/firestore-de-mentira.js', 'utf8');

const erros = [];
const passos = [];
function ok(t){ passos.push('  ok   ' + t); }
function falha(t){ passos.push('  FALHA ' + t); erros.push(t); }

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const pg = await b.newPage({ viewport: { width: 412, height: 900 } });

  /* o SDK real e o service worker são barrados de propósito neste teste:
     as falhas de rede que eles geram não são erro do aplicativo. */
  const ruido = /gstatic|ERR_TUNNEL|sw\.js|service worker|A bad HTTP response code/i;
  pg.on('console', m => {
    if (m.type() === 'error' && !ruido.test(m.text())) erros.push('console: ' + m.text());
  });
  pg.on('pageerror', e => erros.push('pageerror: ' + e.message));

  await pg.addInitScript(fake);
  await pg.route('**/gstatic.com/**', r => r.abort());   // o SDK real não entra
  await pg.route('**/sw.js', r => r.abort());

  await pg.goto(process.env.URL_TESTE || 'http://127.0.0.1:8199/index.html');
  await pg.waitForSelector('#nav button', { timeout: 8000 });

  // ── 1. o portão deixou o admin passar e montou a navegação de admin
  const abas = await pg.$$eval('#nav button', bs => bs.map(b => b.textContent));
  abas.join('|') === 'Semana|Chamados|Chopeiras|Clientes|Peças|Avulsos|Acessos'
    ? ok('portão liberou o admin e montou as 7 abas') : falha('abas erradas: ' + abas.join('|'));

  // ── 2. cadastrar uma empresa, com CNPJ que confere
  await pg.click('#nav_clientes');
  await pg.waitForTimeout(200);
  await pg.click('button:has-text("+ Nova empresa")');
  await pg.fill('#f_cnpj', '11222333000181');
  const aviso = await pg.textContent('#cnpjAviso');
  aviso.includes('confere') ? ok('CNPJ válido reconhecido') : falha('CNPJ válido recusado: ' + aviso);

  await pg.fill('#f_cnpj', '11222333000180');
  const aviso2 = await pg.textContent('#cnpjAviso');
  aviso2.includes('não bate') ? ok('CNPJ com dígito errado barrado') : falha('CNPJ inválido passou: ' + aviso2);

  await pg.fill('#f_cnpj', '11222333000181');
  await pg.fill('#f_razao', 'Bar do Zé Comércio de Bebidas Ltda');
  await pg.fill('#f_fantasia', 'Bar do Zé');
  await pg.fill('#f_cidade', 'Florianópolis');
  await pg.fill('#f_uf', 'sc');
  await pg.fill('#f_whats', '48 99999-1234');
  /* Os e-mails deixaram de ser uma caixa de texto solta: agora cada um
     entra pelo botão Liberar e aparece na lista, com o duplicado barrado. */
  for(const e of ['ze@bardoze.com.br', 'GERENTE@bardoze.com.br']){
    await pg.fill('#f_email_novo', e);
    await pg.click('button:has-text("Liberar")');
    await pg.waitForTimeout(120);
  }
  const naLista = await pg.$$eval('#f_emails_lista div', ns =>
    ns.map(n => n.textContent).filter(t => t.includes('@')).length);
  naLista >= 2 ? ok('dois e-mails liberados na lista')
               : falha('e-mails na lista: ' + naLista);
  await pg.click('#btSalvar');
  await pg.waitForSelector('.reg .nm', { timeout: 5000 });

  const cnpjMostrado = await pg.textContent('.reg .dt.mono');
  cnpjMostrado.trim() === '11.222.333/0001-81'
    ? ok('CNPJ gravado só com dígitos e exibido com máscara') : falha('máscara: ' + cnpjMostrado);

  // ── 3. os convites nasceram junto, em minúsculas, um por e-mail
  const convites = await pg.evaluate(() => Object.keys(window.__LOJA.convites || {}));
  (convites.length === 2 && convites.includes('ze@bardoze.com.br') && convites.includes('gerente@bardoze.com.br'))
    ? ok('convites criados em minúsculas: ' + convites.join(', '))
    : falha('convites errados: ' + JSON.stringify(convites));

  // ── 4. CNPJ repetido em outra empresa é recusado
  await pg.click('button:has-text("+ Nova empresa")');
  await pg.fill('#f_cnpj', '11222333000181');
  await pg.fill('#f_fantasia', 'Outro Bar');
  await pg.click('#btSalvar');
  await pg.waitForTimeout(400);
  const t1 = await pg.textContent('#toast');
  t1.includes('já está em') ? ok('CNPJ repetido recusado') : falha('repetido passou: ' + t1);
  await pg.click('button:has-text("Cancelar")');

  // ── 5. cadastrar uma chopeira ligada à empresa
  await pg.click('#nav_chopeiras');
  await pg.click('button:has-text("+ Nova chopeira")');
  await pg.fill('#c_codigo', 'CH-014');
  await pg.selectOption('#c_cliente', { index: 1 });
  await pg.fill('#c_local', 'balcão da frente');
  await pg.fill('#c_marca', 'Beertec');
  await pg.fill('#c_modelo', 'BT-2T');
  await pg.selectOption('#c_tipo', 'Banco de gelo');
  await pg.fill('#c_torneiras', '2');
  await pg.fill('#c_cmarca', 'Embraco');
  await pg.fill('#c_cgas', 'R134a');
  await pg.click('#btSalvarCho');
  await pg.waitForSelector('.reg .nm.mono', { timeout: 5000 });
  const cod = await pg.textContent('.reg .nm.mono');
  cod.trim() === 'CH-014' ? ok('chopeira cadastrada e listada') : falha('lista: ' + cod);

  // ── 6. número repetido é recusado
  await pg.click('button:has-text("+ Nova chopeira")');
  await pg.fill('#c_codigo', 'ch-014');
  await pg.selectOption('#c_cliente', { index: 1 });
  await pg.click('#btSalvarCho');
  await pg.waitForTimeout(400);
  const t2 = await pg.textContent('#toast');
  t2.includes('Já existe') ? ok('número de chopeira repetido recusado (sem ligar a maiúscula)')
                           : falha('repetida passou: ' + t2);
  await pg.click('button:has-text("Cancelar")');

  // ── 7. chopeira sem empresa é recusada
  await pg.click('button:has-text("+ Nova chopeira")');
  await pg.fill('#c_codigo', 'CH-999');
  await pg.selectOption('#c_cliente', '');
  await pg.click('#btSalvarCho');
  await pg.waitForTimeout(400);
  const t3 = await pg.textContent('#toast');
  t3.includes('Escolha de qual empresa') ? ok('chopeira sem empresa recusada') : falha('passou: ' + t3);
  await pg.click('button:has-text("Cancelar")');

  // ── 8. busca pelo número
  await pg.fill('.busca input', 'CH-014');
  await pg.waitForTimeout(200);
  let n = await pg.$$eval('.reg', r => r.length);
  n === 1 ? ok('busca encontra pelo número') : falha('busca achou ' + n);
  await pg.fill('.busca input', 'zzz');
  await pg.waitForTimeout(200);
  const vazio = await pg.textContent('.vazio');
  vazio.includes('Nada encontrado') ? ok('busca sem resultado avisa') : falha('vazio: ' + vazio);
  await pg.fill('.busca input', '');

  // ── 9. abrir a ficha da chopeira
  await pg.waitForTimeout(200);
  await pg.click('button:has-text("Abrir")');
  await pg.waitForSelector('h2.mono');
  const ficha = await pg.textContent('.card');
  (ficha.includes('CH-014') && ficha.includes('Embraco') && ficha.includes('Bar do Zé'))
    ? ok('ficha mostra equipamento, compressor e dono') : falha('ficha incompleta');
  await pg.click('button:has-text("Voltar")');

  // ── 10. aba de acessos lista o admin sem botão de bloquear
  await pg.click('#nav_acessos');
  await pg.waitForSelector('.reg', { timeout: 5000 });
  const acessos = await pg.textContent('#tela');
  (acessos.includes('Administrador') && acessos.includes('Ninguém na fila'))
    ? ok('acessos: admin marcado, fila vazia') : falha('acessos: ' + acessos.slice(0, 200));

  // ── 11. um cliente pendente aparece na fila e pode ser ligado e aprovado
  await pg.evaluate(() => {
    window.__LOJA.usuarios['u2'] = { nome:'Zé', email:'ze@bardoze.com.br', papel:'cliente',
      ativo:false, clienteId:null, criadoEm:{__ts:true} };
    window.__salvarLoja();
  });
  await pg.click('button:has-text("Atualizar")');
  await pg.waitForTimeout(400);
  const fila = await pg.textContent('#tela');
  fila.includes('Esperando aprovação (1)') ? ok('pendente aparece na fila') : falha('fila não mostrou o pendente');

  await pg.selectOption('#vinc_u2', { index: 1 });
  await pg.waitForTimeout(400);
  const ligado = await pg.evaluate(() => window.__LOJA.usuarios.u2.clienteId);
  ligado ? ok('pendente ligado à empresa') : falha('não ligou à empresa');

  pg.once('dialog', d => d.accept());
  await pg.click('button:has-text("Aprovar")');
  await pg.waitForTimeout(400);
  const ativo = await pg.evaluate(() => window.__LOJA.usuarios.u2.ativo);
  ativo === true ? ok('acesso aprovado') : falha('não aprovou');

  // ── 12. agora entrar como esse cliente: vê só o que é dele
  await pg.evaluate(() => window.__trocarUsuario({ uid:'u2', email:'ze@bardoze.com.br',
    displayName:'Zé', photoURL:'' }));
  await pg.reload();
  await pg.waitForSelector('#nav button', { timeout: 8000 });
  const abasCli = await pg.$$eval('#nav button', bs => bs.map(b => b.textContent));
  abasCli.join('|') === 'Chamados|Chopeiras|Empresa'
    ? ok('cliente vê apenas as suas 3 abas') : falha('abas do cliente: ' + abasCli.join('|'));

  await pg.click('#nav_chopeiras');
  await pg.waitForTimeout(300);
  const telaCli = await pg.textContent('#tela');
  (!telaCli.includes('Nova chopeira') && telaCli.includes('CH-014'))
    ? ok('cliente vê a chopeira e não vê botão de cadastrar') : falha('tela do cliente errada');

  await pg.click('#nav_empresa');
  await pg.waitForTimeout(300);
  const emp = await pg.textContent('#tela');
  (emp.includes('Bar do Zé') && emp.includes('11.222.333/0001-81'))
    ? ok('cliente vê a ficha da própria empresa') : falha('empresa: ' + emp.slice(0, 150));

  // ── 13. um cliente aprovado mas sem empresa é avisado, não fica na tela em branco
  await pg.evaluate(() => {
    window.__LOJA.usuarios['u3'] = { nome:'Solto', email:'solto@x.com', papel:'cliente',
      ativo:true, clienteId:null, criadoEm:{__ts:true} };
    window.__salvarLoja();
    window.__trocarUsuario({ uid:'u3', email:'solto@x.com', displayName:'Solto', photoURL:'' });
  });
  await pg.reload();
  await pg.waitForSelector('#tela .alert', { timeout: 8000 });
  const solto = await pg.textContent('#tela');
  solto.includes('não está ligado a uma empresa')
    ? ok('cliente sem empresa recebe explicação') : falha('sem empresa: ' + solto.slice(0, 150));

  // ── 14. sem convite, o primeiro acesso nasce pendente
  await pg.evaluate(() => {
    delete window.__LOJA.usuarios['u4'];
    window.__salvarLoja();
    window.__trocarUsuario({ uid:'u4', email:'estranho@x.com', displayName:'Estranho', photoURL:'' });
  });
  await pg.reload();
  await pg.waitForSelector('#agPendente:not([style*="display: none"])', { timeout: 8000 });
  const novo = await pg.evaluate(() => window.__LOJA.usuarios.u4);
  (novo && novo.ativo === false && novo.clienteId === null)
    ? ok('sem convite: nasce pendente e sem empresa') : falha('nasceu: ' + JSON.stringify(novo));

  // ── 15. com convite, o primeiro acesso já entra ligado e liberado
  await pg.evaluate(() => {
    delete window.__LOJA.usuarios['u5'];
    window.__salvarLoja();
    window.__trocarUsuario({ uid:'u5', email:'GERENTE@bardoze.com.br', displayName:'Gerente', photoURL:'' });
  });
  await pg.reload();
  await pg.waitForSelector('#nav button', { timeout: 8000 });
  const conv = await pg.evaluate(() => window.__LOJA.usuarios.u5);
  (conv && conv.ativo === true && conv.clienteId)
    ? ok('com convite: entra ligado e liberado, sem passar pela fila')
    : falha('convite não funcionou: ' + JSON.stringify(conv));

  await b.close();

  console.log(passos.join('\n'));
  console.log('\n' + (erros.length ? erros.length + ' PROBLEMA(S):\n - ' + erros.join('\n - ')
                                   : 'tudo passou, sem erro de console'));
  process.exit(erros.length ? 1 : 0);
})().catch(e => {
  console.log(passos.join('\n'));
  console.error('\nquebrou em: ' + e.message.split('\n')[0]);
  if (erros.length) console.error('erros de página:\n - ' + erros.join('\n - '));
  process.exit(2);
});
