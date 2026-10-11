/* Entrega 3: peças, orçamento e a resposta do cliente.

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

  /* Um ouvinte só para os diálogos: o Playwright chama todos os que
     estiverem registados para a mesma caixa, e o segundo a responder
     rebenta com "already handled". Quem decide é a mensagem. */
  let respostaDoPrompt = '';
  pg.on('dialog', d => {
    if(/WhatsApp/.test(d.message())) return d.dismiss();   /* abriria janela para fora */
    if(d.type() === 'prompt') return d.accept(respostaDoPrompt);
    return d.accept();
  });
  /* ERR_CERT_AUTHORITY_INVALID: em máquina atrás de proxy com certificado
     próprio, o Chromium recusa os scripts de fora. A página em teste vem
     por http do 127.0.0.1, então este erro nunca é do aplicativo. */
  const ruido = /gstatic|ERR_TUNNEL|ERR_CERT_AUTHORITY_INVALID|ERR_FAILED|sw\.js|service worker|A bad HTTP response code/i;
  pg.on('console', m => { if (m.type() === 'error' && !ruido.test(m.text())) erros.push('console: ' + m.text()); });
  pg.on('pageerror', e => erros.push('pageerror: ' + e.message));

  await pg.addInitScript(fake);
  /* Barrar TUDO o que é de fora: o que se testa aqui é o aplicativo, não
     o Google. Em expressão regular, e não no glob que estava aqui antes:
     aquele padrão pedia uma barra logo antes de "gstatic.com", e no
     endereço verdadeiro o que vem antes é "www.", com ponto. Nunca casou.
     As suítes passaram meses a depender de a rede estar quebrada — quando
     o ambiente ganhou saída para a internet, o SDK verdadeiro carregou
     por cima do de mentira e as quatro caíram de uma vez, sem nada ter
     mudado no aplicativo. */
  await pg.route(/gstatic\.com|googleapis\.com|accounts\.google\.com/,
                 r => r.abort());
  await pg.route(/\/sw\.js(\?|$)/, r => r.abort());
  await pg.goto(process.env.URL_TESTE || 'http://127.0.0.1:8199/index.html');
  await pg.waitForSelector('#nav button');

  // cenário: empresa, chopeira, cliente ligado, e um chamado já em manutenção
  await pg.evaluate(() => {
    const t = Date.now(), L = window.__LOJA;
    L.clientes = { c1:{cnpj:'11222333000181', razaoSocial:'Zé Bebidas Ltda', nomeFantasia:'Bar do Zé',
      cidade:'Florianópolis', uf:'SC', contato:'Zé', whatsapp:'48 99999-1234', telefone:'',
      emailsAutorizados:['ze@bardoze.com.br'], endereco:'Rua das Palmeiras, 210'} };
    L.chopeiras = { h1:{codigo:'CH-014', clienteId:'c1', marca:'Beertec', modelo:'BT-2T',
      tipo:'Banco de gelo', torneiras:'2', compressorGas:'R134a', provisorio:false} };
    L.usuarios = { u2:{nome:'Zé', email:'ze@bardoze.com.br', papel:'cliente', ativo:true,
      clienteId:'c1', criadoEm:{__ts:t}} };
    L.ordens = { o1:{numero:'OS-260823-K7QP', clienteId:'c1', chopeiraId:'h1', chopeiraCodigo:'CH-014',
      status:'em_manutencao', problemaRelatado:'Chope saindo quente.', fotos:[], thumb:null,
      historico:[{status:'aberto', quando:new Date(t-3600000).toISOString(), quem:'Zé', nota:''},
                 {status:'em_manutencao', quando:new Date(t-600000).toISOString(), quem:'Giba', nota:''}],
      agenda:{recolhaPrevista:'', entregaPrevista:''},
      abertoPor:{uid:'u2', nome:'Zé', email:'ze@bardoze.com.br'},
      naoLidoAdmin:false, naoLidoCliente:false,
      abertoEm:{__ts:t-3600000}, atualizadoEm:{__ts:t-600000}} };
    window.__salvarLoja();
  });
  await pg.reload();
  await pg.waitForSelector('#nav button');

  // ── 1. o Giba tem a aba de peças
  const abas = await pg.$$eval('#nav button', bs => bs.map(b => b.textContent));
  abas.join('|') === 'Semana|Chamados|Chopeiras|Clientes|Peças|Avulsos|Acessos'
    ? ok('aba Peças no lugar') : falha('abas: ' + abas.join('|'));

  // ── 2. cadastrar uma peça, com preço em vírgula
  await pg.click('#nav_pecas');
  await pg.click('button:has-text("+ Nova peça")');
  await pg.fill('#p_desc', 'Pressostato de baixa (KP1 Danfoss)');
  await pg.fill('#p_cod', 'KP1-060');
  await pg.fill('#p_preco', '289,90');
  await pg.fill('#p_aplic', 'chopeira com banco de gelo');
  await pg.click('#btPeca');
  await pg.waitForSelector('.reg .nm', { timeout: 5000 });
  const peca = await pg.evaluate(() => Object.values(window.__LOJA.pecas)[0]);
  peca && peca.precoVenda === 289.9
    ? ok('preço com vírgula virou número certo (289,90 → 289.9)')
    : falha('preço gravado: ' + JSON.stringify(peca && peca.precoVenda));

  const mostrado = await pg.textContent('.reg');
  mostrado.includes('R$') && mostrado.includes('289,90')
    ? ok('preço exibido em real brasileiro') : falha('exibição: ' + mostrado.slice(0,80));

  // ── 3. as sugestões vêm do material dele
  await pg.click('button:has-text("+ Nova peça")');
  const nSug = await pg.$$eval('#sugestoesPeca option', os => os.length);
  const temKP1 = await pg.$$eval('#sugestoesPeca option', os =>
    os.some(o => o.value.includes('KP1')));
  (nSug > 10 && temKP1) ? ok('sugestões de peça de chopeira carregadas (' + nSug + ')')
                        : falha('sugestões: ' + nSug);
  await pg.click('button:has-text("Cancelar")');

  let t;

  // ── 3b. trazer o catálogo do Giba Compressores
  /* O catálogo é um arquivo à parte, e é grande: compressores,
     ventiladores e o material elétrico com o número de peça de cada
     relé, protetor e capacitor. Este teste existe porque ninguém
     percebe que o arquivo deixou de ser copiado até um técnico
     procurar um código na frente do cliente e não achar nada. */
  await pg.click('#btImportar');
  await pg.waitForFunction(() => Object.keys(window.__LOJA.pecas).length > 300,
    null, { timeout: 30000 });
  const nPecas = await pg.evaluate(() => Object.keys(window.__LOJA.pecas).length);
  const catalogo = await pg.evaluate(() => Object.values(window.__LOJA.pecas));
  const eletricas = catalogo.filter(p => p.aplicacao === 'Material elétrico');
  (nPecas === 399 && eletricas.length === 189)
    ? ok('catálogo trazido: ' + nPecas + ' peças, ' + eletricas.length + ' de material elétrico')
    : falha('trouxe ' + nPecas + ' peças, ' + eletricas.length + ' elétricas');

  catalogo.filter(p => p.aplicacao === 'Material elétrico' || p.aplicacao === 'Compressor')
          .every(p => p.precoVenda === 0)
    ? ok('catálogo chega com preço zerado — o valor é dele, não do fornecedor')
    : falha('veio peça com preço de fábrica');

  /* O que o técnico tem na mão é o modelo escrito no compressor, não o
     código do relé. A busca tem de ir pelas observações. */
  /* Letra a letra, e não de uma vez: é assim que a pessoa digita, e é
     só assim que se apanha a tela a ser redesenhada por baixo da caixa
     de busca — que apagava o <input> em uso, fechava o teclado do
     telemóvel e deixava entrar só a primeira letra. */
  await pg.click('.busca input');
  await pg.keyboard.type('FG70AK', { delay: 40 });
  await pg.waitForTimeout(400);
  const caixa = await pg.evaluate(() => ({
    focada: document.activeElement === document.querySelector('.busca input'),
    valor: document.querySelector('.busca input').value }));
  (caixa.focada && caixa.valor === 'FG70AK')
    ? ok('a caixa de busca não perde o foco enquanto se digita')
    : falha('busca depois de digitar: ' + JSON.stringify(caixa));
  const achou = await pg.textContent('#tela');
  (achou.includes('513506090') && achou.includes('Relé de partida')
    && achou.includes('Protetor térmico'))
    ? ok('procurar pelo modelo do compressor acha o relé e o protetor dele')
    : falha('busca por FG70AK: ' + achou.slice(0, 200));

  await pg.fill('.busca input', '');
  await pg.evaluate(() => filtrarPecas(''));
  await pg.waitForTimeout(300);

  // ── 3c. trazer de novo não duplica
  await pg.click('#btImportar');
  await pg.waitForTimeout(800);
  const depoisDeRepetir = await pg.evaluate(() => Object.keys(window.__LOJA.pecas).length);
  t = await pg.textContent('#toast');
  (depoisDeRepetir === nPecas && t.includes("já estão"))
    ? ok('trazer duas vezes não duplica nada')
    : falha('segunda importação: ' + depoisDeRepetir + ' peças, aviso ' + t);

  // ── 4. peça sem descrição é recusada
  await pg.click('button:has-text("+ Nova peça")');
  await pg.fill('#p_preco', '10');
  await pg.click('#btPeca');
  await pg.waitForTimeout(300);
  t = await pg.textContent('#toast');
  t.includes('Falta a descrição') ? ok('peça sem descrição recusada') : falha('recusa: ' + t);
  await pg.click('button:has-text("Cancelar")');

  // ── 5. não dá para enviar orçamento que não existe
  await pg.click('#nav_chamados');
  await pg.locator('.reg').first().locator('button:has-text("Abrir")').click();
  await pg.waitForSelector('#os_status');
  await pg.selectOption('#os_status', 'orcamento_enviado');
  await pg.click('#btMover');
  await pg.waitForTimeout(300);
  t = await pg.textContent('#toast');
  t.includes('Monte o orçamento antes') ? ok('status de orçamento barrado sem orçamento montado')
                                        : falha('barreira: ' + t);

  // ── 6. montar o orçamento: peça do catálogo + serviço na mão
  await pg.click('button:has-text("Montar o orçamento")');
  await pg.waitForSelector('button:has-text("+ Acrescentar")');
  /* Escolhida pelo nome, e não pela posição: o catálogo do Compressores
     entrou na mesma lista e a primeira opção já não é a peça deste teste. */
  const opKP1 = await pg.$$eval('select[onchange^="itemDoCatalogo"] option',
    os => (os.find(o => o.textContent.includes('KP1')) || {}).value);
  opKP1 ? ok('a peça do cadastro continua na lista do orçamento')
        : falha('KP1 sumiu da lista do catálogo');
  await pg.selectOption('select[onchange^="itemDoCatalogo"]', opKP1);
  await pg.waitForTimeout(300);
  const doCatalogo = await pg.evaluate(() => editando.orc.itens[0]);
  (doCatalogo && doCatalogo.descricao.includes('KP1') && doCatalogo.valorUnit === 289.9
    && doCatalogo.tipo === 'peca')
    ? ok('peça do cadastro entra no orçamento já com o preço')
    : falha('do catálogo: ' + JSON.stringify(doCatalogo));

  await pg.locator('button:has-text("+ Acrescentar")').nth(1).click();
  await pg.waitForTimeout(250);
  const campos = pg.locator('.itemOrc').nth(1);
  await campos.locator('input').first().fill('Mão de obra — troca de componente');
  await campos.locator('input').nth(2).fill('180,00');
  await pg.waitForTimeout(250);

  const somaViva = await pg.textContent('#somaViva');
  somaViva.includes('469,90') ? ok('total ao vivo soma peça e serviço (R$ 469,90)')
                              : falha('soma ao vivo: ' + somaViva);

  // ── 7. enviar: muda o status, avisa o cliente, guarda os subtotais
  await pg.click('#btEnviarOrc');
  await pg.waitForTimeout(600);
  const enviado = await pg.evaluate(() => window.__LOJA.ordens.o1);
  (enviado.status === 'orcamento_enviado' && enviado.naoLidoCliente === true
    && enviado.orcamento.totalPecas === 289.9 && enviado.orcamento.totalServico === 180
    && enviado.orcamento.total === 469.9 && enviado.orcamento.itens.length === 2
    && enviado.historico.length === 3)
    ? ok('orçamento enviado: status, subtotais separados, histórico e aviso')
    : falha('enviado: ' + JSON.stringify({s:enviado.status, o:enviado.orcamento,
        h:enviado.historico.length}));

  // ── 8. o WhatsApp leva o total e os dois subtotais
  const link = await pg.evaluate(() => {
    let capturado = null; const original = window.open;
    window.open = u => { capturado = u; };
    document.querySelector('button[onclick^="avisarWhats"]').click();
    window.open = original;
    return capturado;
  });
  const texto = link ? decodeURIComponent(link) : '';
  /* Os subtotais saíram da mensagem de propósito: a decomposição
     peças/serviço convida a negociar item a item, e o que o cliente
     precisa é do total, do prazo e do que tem de decidir. */
  (texto.includes('469,90')
    && !/pe\u00e7as R\$|servi\u00e7o R\$/.test(texto)
    && /aprovar ou recusar/.test(texto))
    ? ok('WhatsApp leva o total e o próximo passo, sem subtotais nem OS')
    : falha('mensagem: ' + texto.slice(0,150));

  // ── 9. o cliente vê o orçamento com os grupos separados
  await pg.evaluate(() => window.__trocarUsuario({uid:'u2', email:'ze@bardoze.com.br',
    displayName:'Zé', photoURL:''}));
  await pg.reload();
  await pg.waitForSelector('#nav button');
  const abasCli = await pg.$$eval('#nav button', bs => bs.map(b => b.textContent));
  !abasCli.includes('Peças') ? ok('cliente não recebe a aba de peças') : falha('cliente viu Peças');

  await pg.locator('.reg').first().locator('button:has-text("Abrir")').click();
  await pg.waitForSelector('.linha');
  const visto = await pg.textContent('#tela');
  (visto.includes('Peças') && visto.includes('Serviço') && visto.includes('469,90')
    && visto.includes('KP1') && visto.includes('Aprovar o serviço'))
    ? ok('cliente vê peças e serviço separados, o total e os botões')
    : falha('visão do cliente incompleta');

  // ── 10. o cliente não vê o editor
  const editor = await pg.$('button:has-text("Montar o orçamento")');
  !editor ? ok('cliente não recebe o editor de orçamento') : falha('cliente viu o editor');

  // ── 11. aprovar grava a decisão com nome, data e aviso ao Giba
  await pg.click('button:has-text("Aprovar o serviço")');
  await pg.waitForTimeout(600);
  const decidida = await pg.evaluate(() => window.__LOJA.ordens.o1);
  (decidida.status === 'orcamento_aprovado' && decidida.decisaoCliente.valor === 'aprovado'
    && decidida.decisaoCliente.porUid === 'u2' && decidida.decisaoCliente.por === 'Zé'
    && decidida.naoLidoAdmin === true && decidida.historico.length === 4
    && decidida.orcamento.total === 469.9)
    ? ok('aprovação gravada com nome e data, sem tocar nos valores')
    : falha('decisão: ' + JSON.stringify({s:decidida.status, d:decidida.decisaoCliente}));

  // ── 12. os botões somem depois de respondido
  const depois = await pg.textContent('#tela');
  (!depois.includes('Aprovar o serviço') && depois.includes('Aprovado') && depois.includes('Zé'))
    ? ok('respondido uma vez, os botões dão lugar ao registro')
    : falha('depois da resposta: ' + depois.slice(0,150));

  // ── 13. reprovar, noutra ordem, guarda o motivo
  await pg.evaluate(() => {
    const t = Date.now(), L = window.__LOJA;
    L.ordens.o2 = {numero:'OS-260824-P2LM', clienteId:'c1', chopeiraId:'h1', chopeiraCodigo:'CH-014',
      status:'orcamento_enviado', problemaRelatado:'Não gela.', fotos:[], thumb:null,
      historico:[{status:'aberto', quando:new Date(t-7200000).toISOString(), quem:'Zé', nota:''}],
      agenda:{recolhaPrevista:'', entregaPrevista:''},
      orcamento:{itens:[{tipo:'peca', pecaId:null, descricao:'Compressor', qtd:1, valorUnit:1200}],
                 totalPecas:1200, totalServico:0, total:1200, validadeDias:15,
                 enviadoEm:new Date(t).toISOString()},
      decisaoCliente:null,
      abertoPor:{uid:'u2', nome:'Zé', email:'ze@bardoze.com.br'},
      naoLidoAdmin:false, naoLidoCliente:true,
      abertoEm:{__ts:t-7200000}, atualizadoEm:{__ts:t}};
    window.__salvarLoja();
  });
  await pg.reload();
  await pg.waitForSelector('#nav button');
  await pg.locator('.reg').first().locator('button:has-text("Abrir")').click();
  await pg.waitForSelector('button:has-text("Não aprovar")');
  respostaDoPrompt = 'Muito caro, vou pesquisar.';
  await pg.click('button:has-text("Não aprovar")');
  await pg.waitForTimeout(600);
  const rep = await pg.evaluate(() => window.__LOJA.ordens.o2);
  (rep.status === 'orcamento_reprovado' && rep.decisaoCliente.valor === 'reprovado'
    && rep.decisaoCliente.motivo.includes('caro')
    && rep.historico[rep.historico.length-1].nota.includes('caro'))
    ? ok('recusa guarda o motivo, no registro e na linha do tempo')
    : falha('recusa: ' + JSON.stringify(rep.decisaoCliente));

  // ── 14. reprovado continua na lista de abertos: falta devolver
  await pg.click('button:has-text("Voltar")');
  await pg.waitForTimeout(300);
  const naLista = await pg.textContent('#tela');
  naLista.includes('não aprovado') || naLista.includes('não aprovado'.toUpperCase())
    || naLista.includes('Orçamento não aprovado')
    ? ok('reprovado segue nos abertos — a chopeira ainda tem de voltar')
    : falha('lista depois de reprovar: ' + naLista.slice(0,150));

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
