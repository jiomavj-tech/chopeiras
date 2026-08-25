/* Entrega 2: chamado, status, linha do tempo, sino e WhatsApp.

   Roda por `node testes/rodar.js`, que levanta o servidor antes.
   O Firestore é de mentira e o SDK verdadeiro é barrado: o que se
   testa aqui é o aplicativo, não o Google. */
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const BASE = __dirname;
const fake = fs.readFileSync(BASE + '/firestore-de-mentira.js', 'utf8');

const erros = [], passos = [];
const ok = t => passos.push('  ok   ' + t);
const falha = t => { passos.push('  FALHA ' + t); erros.push(t); };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const pg = await b.newPage({ viewport: { width: 412, height: 900 } });

  /* O aplicativo passou a perguntar duas coisas ao mover o status: se
     falta registar serviço, e se quer avisar o cliente pelo WhatsApp.
     Sem responder, o Playwright recusa por omissão e a mudança é
     cancelada — o teste falharia por um diálogo, não por um defeito.
     Segue-se em frente no primeiro e recusa-se o segundo, que abriria
     uma janela para fora. */
  pg.on('dialog', d => /WhatsApp/.test(d.message()) ? d.dismiss() : d.accept());
  const ruido = /gstatic|ERR_TUNNEL|sw\.js|service worker|A bad HTTP response code/i;
  pg.on('console', m => { if (m.type() === 'error' && !ruido.test(m.text())) erros.push('console: ' + m.text()); });
  pg.on('pageerror', e => erros.push('pageerror: ' + e.message));

  await pg.addInitScript(fake);
  await pg.route('**/gstatic.com/**', r => r.abort());
  await pg.route('**/sw.js', r => r.abort());
  await pg.goto(process.env.URL_TESTE || 'http://127.0.0.1:8199/index.html');
  await pg.waitForSelector('#nav button');

  // cenário: uma empresa, uma chopeira, um cliente ligado a ela
  await pg.evaluate(() => {
    const L = window.__LOJA;
    L.clientes = { c1:{cnpj:'11222333000181', razaoSocial:'Zé Bebidas Ltda', nomeFantasia:'Bar do Zé',
      cidade:'Florianópolis', uf:'SC', contato:'Zé', telefone:'', whatsapp:'48 99999-1234',
      emailsAutorizados:['ze@bardoze.com.br'], endereco:'Rua das Palmeiras, 210'} };
    L.chopeiras = { h1:{codigo:'CH-014', clienteId:'c1', local:'balcão', marca:'Beertec',
      modelo:'BT-2T', tipo:'Banco de gelo', torneiras:'2', compressorMarca:'Embraco',
      compressorGas:'R134a', provisorio:false, observacoes:''} };
    L.usuarios = L.usuarios || {};
    L.usuarios.u2 = {nome:'Zé', email:'ze@bardoze.com.br', papel:'cliente', ativo:true,
      clienteId:'c1', criadoEm:{__ts:Date.now()}};
    window.__salvarLoja();
    window.__trocarUsuario({uid:'u2', email:'ze@bardoze.com.br', displayName:'Zé', photoURL:''});
  });
  await pg.reload();
  await pg.waitForSelector('#nav button');

  // ── 1. o cliente abre nos chamados, com as três abas dele
  const abas = await pg.$$eval('#nav button', bs => bs.map(b => b.textContent));
  abas.join('|') === 'Chamados|Chopeiras|Empresa'
    ? ok('cliente abre na aba Chamados') : falha('abas: ' + abas.join('|'));

  // ── 2. abrir chamado numa chopeira que existe
  await pg.click('button:has-text("Preciso de manutenção")');
  await pg.fill('#ch_busca', 'CH-014');
  await pg.waitForTimeout(250);
  const achou = await pg.textContent('#ch_achou');
  (achou.includes('CH-014') && achou.includes('Beertec'))
    ? ok('busca acha a chopeira cadastrada e mostra a ficha') : falha('busca: ' + achou.slice(0,120));

  // ── 3. número desconhecido oferece cadastro provisório
  await pg.fill('#ch_busca', 'CH-999');
  await pg.waitForTimeout(250);
  const naoAchou = await pg.textContent('#ch_achou');
  naoAchou.includes('provisória') ? ok('número novo oferece cadastro provisório')
                                  : falha('desconhecido: ' + naoAchou.slice(0,120));

  // ── 4. sem problema descrito, não envia
  await pg.fill('#ch_busca', 'CH-014');
  await pg.waitForTimeout(250);
  await pg.click('#btEnviar');
  await pg.waitForTimeout(300);
  let t = await pg.textContent('#toast');
  t.includes('Conte o que está acontecendo') ? ok('chamado sem descrição é recusado') : falha('recusa: ' + t);

  // ── 5. enviar o chamado
  await pg.fill('#ch_problema', 'O chope está saindo quente desde ontem de manhã.');
  await pg.click('#btEnviar');
  await pg.waitForSelector('.reg .nm.mono', { timeout: 5000 });
  const os = await pg.evaluate(() => {
    const k = Object.keys(window.__LOJA.ordens || {});
    return k.length === 1 ? window.__LOJA.ordens[k[0]] : null;
  });
  (os && os.status === 'aberto' && os.naoLidoAdmin === true && os.naoLidoCliente === false
    && os.clienteId === 'c1' && os.abertoPor.uid === 'u2' && os.historico.length === 1
    && /^OS-\d{6}-[A-Z0-9]{4}$/.test(os.numero))
    ? ok('chamado gravado: aberto, com número, histórico e aviso para o Giba')
    : falha('ordem gravada errada: ' + JSON.stringify(os && {s:os.status, n:os.numero,
        a:os.naoLidoAdmin, h:(os.historico||[]).length}));

  // ── 6. chamado numa chopeira desconhecida cria a provisória
  await pg.click('button:has-text("Preciso de manutenção")');
  await pg.fill('#ch_busca', 'CH-777');
  await pg.fill('#ch_problema', 'Não gela.');
  await pg.click('#btEnviar');
  await pg.waitForSelector('.reg .nm.mono', { timeout: 5000 });
  const prov = await pg.evaluate(() => Object.values(window.__LOJA.chopeiras)
    .find(c => c.codigo === 'CH-777'));
  (prov && prov.provisorio === true && prov.clienteId === 'c1')
    ? ok('chopeira desconhecida entra como provisória, ligada à empresa certa')
    : falha('provisória: ' + JSON.stringify(prov));

  // ── 7. o cliente ainda não tem novidade (ele é que abriu)
  let sino = await pg.textContent('#sino');
  sino.trim() === '' ? ok('quem abriu o chamado não recebe aviso de si mesmo')
                     : falha('sino do cliente: ' + sino);

  // ── 8. agora o Giba: dois chamados esperando, sino aceso
  await pg.evaluate(() => window.__trocarUsuario({uid:'u1', email:'gibasolucoes@gmail.com',
    displayName:'Giba', photoURL:''}));
  await pg.reload();
  await pg.waitForSelector('#nav button');
  await pg.click('#nav_chamados');
  await pg.waitForTimeout(250);
  await pg.waitForTimeout(400);
  sino = await pg.textContent('#sino');
  sino.includes('2 novidades') ? ok('sino do Giba acusa os 2 chamados') : falha('sino: ' + sino);

  // ── 9. abrir apaga o aviso daquele chamado
  await pg.locator('.reg').first().locator('button:has-text("Abrir")').click();
  await pg.waitForSelector('#os_status', { timeout: 5000 });
  await pg.waitForTimeout(300);
  sino = await pg.textContent('#sino');
  sino.includes('1 novidade') && !sino.includes('1 novidades')
    ? ok('abrir o chamado apaga o aviso, e o singular está certo') : falha('sino depois de abrir: ' + sino);

  // ── 10. a ficha traz o que o cliente contou
  const ficha = await pg.textContent('#tela');
  ficha.includes('saindo quente') || ficha.includes('Não gela')
    ? ok('a ficha mostra o problema relatado') : falha('ficha sem o problema');

  // ── 11. mover o status grava histórico, agenda e aviso para o cliente
  await pg.selectOption('#os_status', 'recolha_agendada');
  await pg.fill('#os_nota', 'Passo aí quinta de manhã.');
  await pg.fill('#os_recolha', '2026-08-27');
  await pg.click('#btMover');
  await pg.waitForTimeout(500);
  const movida = await pg.evaluate(() => {
    const o = Object.values(window.__LOJA.ordens).find(x => x.naoLidoCliente === true);
    return o && {s:o.status, h:o.historico.length, nota:o.historico[o.historico.length-1].nota,
                 rec:o.agenda.recolhaPrevista, avisa:o.naoLidoCliente};
  });
  (movida && movida.s === 'recolha_agendada' && movida.h === 2 && movida.rec === '2026-08-27'
    && movida.avisa === true && movida.nota.includes('quinta'))
    ? ok('status movido: histórico cresceu, agenda gravada, cliente avisado')
    : falha('mudança: ' + JSON.stringify(movida));

  // ── 12. a linha do tempo mostra os dois passos, o mais novo primeiro
  const passosTela = await pg.$$eval('.passo .pt', ps => ps.map(p => p.textContent));
  (passosTela.length === 2 && passosTela[0] === 'Recolha agendada' && passosTela[1] === 'Chamado aberto')
    ? ok('linha do tempo com os 2 passos, o mais recente em cima')
    : falha('linha do tempo: ' + passosTela.join(' / '));

  // ── 13. o link do WhatsApp sai com número e recado
  const link = await pg.evaluate(() => {
    let capturado = null;
    const original = window.open;
    window.open = u => { capturado = u; };
    document.querySelector('button[onclick^="avisarWhats"]').click();
    window.open = original;
    return capturado;
  });
  /* A mensagem foi reescrita para a língua do cliente: diz a data do que
     foi combinado e o recado, e deixou de citar o número da OS e a
     decomposição peças/serviço, que são coisas de dentro da oficina. */
  const texto = link ? decodeURIComponent(link) : '';
  (link && link.startsWith('https://wa.me/5548999991234?text=')
    && /Passamos para buscar dia \d{2}\/\d{2}/.test(texto)
    && texto.includes('quinta')
    && !/OS-\d/.test(texto))
    ? ok('WhatsApp: número com 55, data combinada e recado, sem número de OS')
    : falha('link: ' + texto.slice(0,160));

  // ── 14. o cliente vê a mudança e o aviso
  await pg.evaluate(() => window.__trocarUsuario({uid:'u2', email:'ze@bardoze.com.br',
    displayName:'Zé', photoURL:''}));
  await pg.reload();
  await pg.waitForSelector('#nav button');
  await pg.waitForTimeout(400);
  sino = await pg.textContent('#sino');
  const listaCli = await pg.textContent('#tela');
  (sino.includes('1 novidade') && listaCli.includes('Recolha agendada') && listaCli.includes('buscar 27/08/26'))
    ? ok('cliente vê o aviso, o novo status e a data de buscar')
    : falha('lado do cliente: ' + sino + ' | ' + listaCli.slice(0,150));

  // ── 15. o cliente não tem como mexer no status
  await pg.locator('.reg').first().locator('button:has-text("Abrir")').click();
  await pg.waitForSelector('.linha', { timeout: 5000 });
  const temPainel = await pg.$('#os_status');
  !temPainel ? ok('cliente não recebe o painel de mudar status') : falha('cliente viu o painel de status');

  // ── 16. encerrado sai da lista de abertos, mas continua achável
  await pg.evaluate(() => window.__trocarUsuario({uid:'u1', email:'gibasolucoes@gmail.com',
    displayName:'Giba', photoURL:''}));
  await pg.reload();
  await pg.waitForSelector('#nav button');
  await pg.click('#nav_chamados');
  await pg.waitForTimeout(250);
  await pg.locator('.reg').first().locator('button:has-text("Abrir")').click();
  await pg.waitForSelector('#os_status');
  await pg.selectOption('#os_status', 'entregue');
  await pg.click('#btMover');
  await pg.waitForTimeout(500);
  await pg.click('button:has-text("Voltar")');
  await pg.waitForTimeout(300);
  const abertos = await pg.$$eval('.reg', r => r.length);
  const temBotao = await pg.textContent('#tela');
  (abertos === 1 && temBotao.includes('Ver encerrados (1)'))
    ? ok('entregue sai dos abertos e aparece o botão de ver encerrados')
    : falha('abertos=' + abertos + ' botão=' + temBotao.includes('Ver encerrados'));

  await pg.click('button:has-text("Ver encerrados")');
  await pg.waitForTimeout(300);
  const todos = await pg.$$eval('.reg', r => r.length);
  todos === 2 ? ok('encerrados continuam achaveis') : falha('encerrados: ' + todos);

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
