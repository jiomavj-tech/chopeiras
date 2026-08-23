/* Entregas 4 e 5: laudo, PDF, agenda da semana e modo demonstração.

   Roda por `node testes/rodar.js`, que levanta o servidor antes.
   O Firestore é de mentira e o SDK verdadeiro é barrado: o que se
   testa aqui é o aplicativo, não o Google. */
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const path = require('path');
const BASE = __dirname;
const fake = fs.readFileSync(BASE + '/firestore-de-mentira.js', 'utf8');

const erros = [], passos = [];
const ok = t => passos.push('  ok   ' + t);
const falha = t => { passos.push('  FALHA ' + t); erros.push(t); };

/* Uma foto minúscula de verdade (JPEG 2×2), para o PDF ter o que embutir. */
const JPEG_2x2 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsL' +
  'DBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAACAAIBAREA/8QAHwAAAQUBAQEBAQEA' +
  'AAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAk' +
  'M2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZ' +
  'mqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiii' +
  'iiiiiiiiiiiiiiiiiiiiiv/Z';

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const pg = await b.newPage({ viewport: { width: 412, height: 900 }, acceptDownloads: true });
  const ruido = /gstatic|ERR_TUNNEL|sw\.js|service worker|A bad HTTP response code/i;
  pg.on('console', m => { if (m.type() === 'error' && !ruido.test(m.text())) erros.push('console: ' + m.text()); });
  pg.on('pageerror', e => erros.push('pageerror: ' + e.message));

  await pg.addInitScript(fake);
  await pg.route('**/gstatic.com/**', r => r.abort());
  await pg.route('**/sw.js', r => r.abort());
  const URL_BASE = process.env.URL_TESTE || 'http://127.0.0.1:8199/index.html';
  await pg.goto(URL_BASE);
  await pg.waitForSelector('#nav button');

  // cenário: uma ordem concluída com orçamento aprovado e foto, e duas em agenda
  await pg.evaluate((foto) => {
    const t = Date.now(), dia = 86400000, L = window.__LOJA;
    const iso = n => new Date(t - n*dia).toISOString();
    const data = n => { const d = new Date(t + n*dia), p = x => String(x).padStart(2,'0');
      return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); };
    L.clientes = { c1:{cnpj:'11222333000181', razaoSocial:'Zé Comércio de Bebidas Ltda',
      nomeFantasia:'Bar do Zé', endereco:'Rua das Palmeiras, 210', cidade:'Florianópolis',
      uf:'SC', contato:'Zé', whatsapp:'48 99999-1234', telefone:'',
      emailsAutorizados:['ze@bardoze.com.br']} };
    L.chopeiras = { h1:{codigo:'CH-014', clienteId:'c1', marca:'Beertec', modelo:'BT-2T',
      tipo:'Banco de gelo', torneiras:'2', compressorMarca:'Embraco', compressorModelo:'EMIS70HER',
      compressorHp:'1/5 HP', compressorGas:'R134a', provisorio:false} };
    L.usuarios = { u2:{nome:'Zé', email:'ze@bardoze.com.br', papel:'cliente', ativo:true,
      clienteId:'c1', criadoEm:{__ts:t}} };
    L.fotos = { f1:{dataUrl:foto, clienteId:'c1', de:'ordem', criadoEm:{__ts:t}} };
    L.ordens = {
      o1:{numero:'OS-260819-K7QP', clienteId:'c1', chopeiraId:'h1', chopeiraCodigo:'CH-014',
        status:'concluido', problemaRelatado:'Não estava ligando de jeito nenhum.',
        fotos:['f1'], thumb:null,
        historico:[{status:'aberto', quando:iso(6), quem:'Zé', nota:''},
                   {status:'concluido', quando:iso(1), quem:'Giba', nota:''}],
        agenda:{recolhaPrevista:data(-5), entregaPrevista:data(1)},
        orcamento:{itens:[
          {tipo:'peca', pecaId:null, descricao:'Relé de partida voltimétrico', qtd:1, valorUnit:132},
          {tipo:'servico', pecaId:null, descricao:'Mão de obra', qtd:1, valorUnit:180}],
          totalPecas:132, totalServico:180, total:312, validadeDias:15, enviadoEm:iso(4)},
        decisaoCliente:{valor:'aprovado', motivo:'', quando:iso(3), por:'Zé', porUid:'u2'},
        abertoPor:{uid:'u2', nome:'Zé', email:'ze@bardoze.com.br'},
        naoLidoAdmin:false, naoLidoCliente:false,
        abertoEm:{__ts:t-6*dia}, atualizadoEm:{__ts:t-dia}},
      o2:{numero:'OS-260823-P2LM', clienteId:'c1', chopeiraId:'h1', chopeiraCodigo:'CH-014',
        status:'recolha_agendada', problemaRelatado:'Barulho alto.', fotos:[], thumb:null,
        historico:[{status:'aberto', quando:iso(2), quem:'Zé', nota:''}],
        agenda:{recolhaPrevista:data(-2), entregaPrevista:''},
        abertoPor:{uid:'u2', nome:'Zé', email:'ze@bardoze.com.br'},
        naoLidoAdmin:false, naoLidoCliente:false,
        abertoEm:{__ts:t-2*dia}, atualizadoEm:{__ts:t-2*dia}},
      o3:{numero:'OS-260824-Q8WN', clienteId:'c1', chopeiraId:'h1', chopeiraCodigo:'CH-014',
        status:'aguardando_peca', problemaRelatado:'Vazando.', fotos:[], thumb:null,
        historico:[{status:'aberto', quando:iso(1), quem:'Zé', nota:''}],
        agenda:{recolhaPrevista:'', entregaPrevista:''},
        abertoPor:{uid:'u2', nome:'Zé', email:'ze@bardoze.com.br'},
        naoLidoAdmin:false, naoLidoCliente:false,
        abertoEm:{__ts:t-dia}, atualizadoEm:{__ts:t-dia}}
    };
    window.__salvarLoja();
  }, JPEG_2x2);
  await pg.reload();
  await pg.waitForSelector('#nav button');

  // ── 1. o Giba abre na Semana
  const aba = await pg.$eval('#nav button.on', b => b.textContent);
  aba === 'Semana' ? ok('o dia começa na aba Semana') : falha('abriu em: ' + aba);

  // ── 2. os três grupos, com a ordem no grupo certo
  const semana = await pg.textContent('#tela');
  (semana.includes('Buscar (1)') && semana.includes('Na oficina (1)') && semana.includes('Entregar (1)'))
    ? ok('semana separa buscar, oficina e entregar') : falha('grupos: ' +
        (semana.match(/(Buscar|Na oficina|Entregar) \(\d\)/g) || []).join(' '));

  // ── 3. data vencida vira "atrasado", e conta os dias
  const atrasado = await pg.$$eval('.pill.dg', ps => ps.map(p => p.textContent));
  atrasado.some(t => /atrasado 2 dias/.test(t))
    ? ok('recolha vencida marcada como atrasada, com os dias certos')
    : falha('selos de atraso: ' + atrasado.join(' / '));

  // ── 4. o resumo conta o que está parado
  semana.includes('1 esperando peça') ? ok('resumo conta o que espera peça')
                                      : falha('resumo: ' + semana.slice(0,120));

  // ── 5. abrir da semana leva à ficha do chamado
  await pg.locator('.reg').first().locator('button:has-text("Abrir")').click();
  await pg.waitForSelector('.linha', { timeout: 5000 });
  ok('abrir pela semana leva à ficha da ordem');

  // ── 6. o laudo só aparece quando há o que laudar
  await pg.click('button:has-text("Voltar")');
  await pg.waitForTimeout(300);
  await pg.click('#nav_chamados');
  await pg.waitForTimeout(300);
  const naOficina = pg.locator('.reg').filter({ hasText: 'Aguardando peça' }).first();
  await naOficina.locator('button:has-text("Abrir")').click();
  await pg.waitForSelector('.linha');
  const semLaudo = await pg.$('button:has-text("Emitir o laudo")');
  !semLaudo ? ok('chamado ainda em manutenção não oferece laudo')
            : falha('ofereceu laudo cedo demais');
  await pg.click('button:has-text("Voltar")');
  await pg.waitForTimeout(300);

  // ── 7. na concluída, o laudo é oferecido
  const concluida = pg.locator('.reg').filter({ hasText: 'Manutenção concluída' }).first();
  await concluida.locator('button:has-text("Abrir")').click();
  await pg.waitForSelector('button:has-text("Emitir o laudo")', { timeout: 5000 });
  ok('chamado concluído oferece emitir o laudo');

  // ── 8. as peças do orçamento aprovado já vêm preenchidas
  await pg.click('button:has-text("Emitir o laudo")');
  await pg.waitForSelector('#l_constatado');
  const pecas = await pg.evaluate(() => editando.laudo.pecas);
  (pecas.length === 1 && pecas[0].descricao.includes('Relé'))
    ? ok('peças vêm do orçamento aprovado, sem serviço junto')
    : falha('peças: ' + JSON.stringify(pecas));

  // ── 9. o ensaio escolhido traz o texto do material do Giba
  await pg.selectOption('select[onchange^="porEnsaio"]', { label: 'Relé de partida voltimétrico' });
  await pg.waitForTimeout(400);
  const ensaio = await pg.evaluate(() => editando.laudo.componentes[0]);
  (ensaio && ensaio.ensaios.includes('20 kΩ') && ensaio.ensaios.includes('terminais 5 e 2'))
    ? ok('ensaio traz o texto real (escala 20 kΩ, terminais 5 e 2)')
    : falha('ensaio: ' + JSON.stringify(ensaio && ensaio.ensaios.slice(0,80)));

  // ── 10. relé e protetor trazem o aviso de que os testes são opostos
  ensaio.ensaios.includes('testes opostos')
    ? ok('relé traz o aviso de que relé e protetor têm testes opostos')
    : falha('sem o aviso do relé');

  // ── 11. um ensaio não entra duas vezes
  const desabilitado = await pg.$$eval('select[onchange^="porEnsaio"] option',
    os => os.filter(o => o.disabled).map(o => o.textContent));
  desabilitado.includes('Relé de partida voltimétrico')
    ? ok('ensaio já usado sai da lista de escolha') : falha('repetível: ' + desabilitado.join(','));

  // ── 12. laudo vazio é recusado
  await pg.click('#btLaudo');
  await pg.waitForTimeout(300);
  let t = await pg.textContent('#toast');
  t.includes('não diz nada') ? ok('laudo sem constatação nem serviço é recusado')
                             : falha('recusa: ' + t);

  // ── 13. salvar grava e avisa o cliente
  await pg.fill('#l_constatado', 'Relé voltimétrico com contato colado, mantendo o enrolamento de partida energizado.');
  await pg.fill('#l_servico', 'Substituído o relé de partida voltimétrico e testado o ciclo completo.');
  await pg.fill('#l_recomenda', 'Limpeza do condensador a cada três meses.');
  const conclusao = pg.locator('.itemOrc').first().locator('input').first();
  await conclusao.fill('componente condenado, substituído');
  await pg.click('#btLaudo');
  await pg.waitForTimeout(700);
  const laudo = await pg.evaluate(() => window.__LOJA.ordens.o1.laudo);
  const avisa = await pg.evaluate(() => window.__LOJA.ordens.o1.naoLidoCliente);
  (laudo && laudo.componentes.length === 1 && laudo.problemaConstatado.includes('colado')
    && laudo.pecas.length === 1 && avisa === true)
    ? ok('laudo gravado com ensaios, peças e aviso ao cliente')
    : falha('laudo: ' + JSON.stringify(laudo && {c:laudo.componentes.length, p:laudo.pecas.length}));

  // ── 14. o PDF sai, e é um PDF de verdade com a foto dentro
  const espera = pg.waitForEvent('download', { timeout: 20000 });
  await pg.click('#btPdf');
  const dl = await espera;
  const destino = path.join(require('os').tmpdir(), 'laudo-teste.pdf');
  await dl.saveAs(destino);
  const bytes = fs.readFileSync(destino);
  const texto = bytes.toString('latin1');
  (bytes.slice(0,5).toString() === '%PDF-' && texto.includes('%%EOF')
    && texto.includes('/Type /Catalog') && texto.includes('DCTDecode'))
    ? ok('PDF válido (' + Math.round(bytes.length/1024) + ' KB), com a foto embutida')
    : falha('PDF suspeito: ' + bytes.length + ' bytes');

  (/\/Count (\d+)/.test(texto) && Number(texto.match(/\/Count (\d+)/)[1]) >= 1)
    ? ok('PDF declara as páginas montadas') : falha('sem contagem de páginas');
  fs.unlinkSync(destino);

  // ── 15. o cliente vê o laudo e também baixa o PDF
  await pg.evaluate(() => window.__trocarUsuario({uid:'u2', email:'ze@bardoze.com.br',
    displayName:'Zé', photoURL:''}));
  await pg.reload();
  await pg.waitForSelector('#nav button');
  const abasCli = await pg.$$eval('#nav button', bs => bs.map(b => b.textContent));
  !abasCli.includes('Semana') ? ok('cliente não recebe a aba Semana')
                              : falha('cliente viu a Semana');
  const doCliente = pg.locator('.reg').filter({ hasText: 'Manutenção concluída' }).first();
  await doCliente.locator('button:has-text("Abrir")').click();
  await pg.waitForSelector('.linha');
  const visto = await pg.textContent('#tela');
  const temBotaoPdf = await pg.$('#btPdf');
  const podeRefazer = await pg.$('button:has-text("Refazer")');
  (visto.includes('Laudo emitido') && visto.includes('condenado') && temBotaoPdf && !podeRefazer)
    ? ok('cliente lê o laudo e baixa o PDF, sem poder refazê-lo')
    : falha('lado do cliente: ' + visto.slice(0,150));

  // ── 16. o modo demonstração levanta sozinho, sem Firebase
  const pg2 = await b.newPage({ viewport: { width: 412, height: 900 } });
  pg2.on('pageerror', e => erros.push('demo pageerror: ' + e.message));
  await pg2.route('**/gstatic.com/**', r => r.abort());
  await pg2.route('**/sw.js', r => r.abort());
  await pg2.goto(URL_BASE.replace('index.html', 'index.html?demo'));
  await pg2.waitForSelector('#faixaDemo', { timeout: 10000 });
  await pg2.waitForSelector('#nav button');
  const demo = await pg2.textContent('#tela');
  (demo.includes('em aberto') && demo.includes('Buscar'))
    ? ok('demonstração abre com dados de exemplo, sem Firebase')
    : falha('demonstração: ' + demo.slice(0,120));

  // ── 17. e dá para ver dos dois lados
  await pg2.click('button:has-text("Ver como o cliente")');
  await pg2.waitForSelector('#faixaDemo');
  await pg2.waitForSelector('#nav button');
  const comoCliente = await pg2.$$eval('#nav button', bs => bs.map(b => b.textContent));
  comoCliente.join('|') === 'Chamados|Chopeiras|Empresa'
    ? ok('a demonstração troca para o lado do cliente')
    : falha('papel trocado: ' + comoCliente.join('|'));

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
