/* Testes do núcleo — sem navegador, sem Firebase, sem esperar.
   Roda em menos de um segundo:  node testes/unidade.js

   Serve para o que dá para conferir com uma conta: documento válido,
   prazo que vira o mês, orçamento que vence, o texto que o cliente lê.
   Fluxo de tela continua sendo conferido pelas suítes do navegador. */

const N = require('../nucleo.js');

let ok = 0, falhas = [];
const eq = (rot, achado, esperado) => {
  const a = JSON.stringify(achado), e = JSON.stringify(esperado);
  a === e ? ok++ : falhas.push(rot + '\n      esperado ' + e + '\n      veio     ' + a);
};
const certo  = (rot, v) => eq(rot, !!v, true);
const errado = (rot, v) => eq(rot, !!v, false);

/* dia fixo, para os testes de prazo não mudarem de resultado amanhã */
const HOJE = new Date();
const dia = n => {
  const d = new Date(HOJE); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/* ── documentos ───────────────────────────────────────────── */
eq('soDigitos tira tudo que não é número', N.soDigitos('11.222.333/0001-81'), '11222333000181');
eq('CNPJ ganha máscara enquanto se digita', N.cnpjFormatado('112223330001'), '11.222.333/0001');
certo('CNPJ válido passa',            N.cnpjValido('11222333000181'));
errado('CNPJ com dígito trocado cai',  N.cnpjValido('11222333000182'));
errado('CNPJ curto cai',               N.cnpjValido('112223330001'));
errado('CNPJ todo igual cai',          N.cnpjValido('11111111111111'));

eq('CPF ganha máscara', N.cpfFormatado('52998224725'), '529.982.247-25');
certo('CPF válido passa',              N.cpfValido('529.982.247-25'));
errado('CPF com dígito trocado cai',   N.cpfValido('52998224726'));
errado('CPF todo igual cai',           N.cpfValido('11111111111'));
errado('CPF curto cai',                N.cpfValido('5299822472'));

eq('WhatsApp ganha o 55',        N.soWhats('48 99999-1234'), '5548999991234');
eq('WhatsApp que já tem 55 fica', N.soWhats('5548999991234'), '5548999991234');
eq('telefone curto demais vira vazio', N.soWhats('1234'), '');

/* ── dinheiro ─────────────────────────────────────────────── */
eq('vírgula é decimal, não milhar', N.paraNumero('1.234,56'), 1234.56);
eq('número simples com vírgula',    N.paraNumero('42,50'), 42.5);
eq('texto sem número vira zero',    N.paraNumero('abc'), 0);
certo('reais formata em BRL', /R\$/.test(N.reais(1105)));

const soma = N.somarOrcamento([
  {tipo:'peca',    qtd:2, valorUnit:100},
  {tipo:'peca',    qtd:1, valorUnit:89.9},
  {tipo:'servico', qtd:1, valorUnit:180}
]);
eq('soma separa peças de serviço', [soma.totalPecas, soma.totalServico, soma.total], [289.9, 180, 469.9]);

/* ── prazos ───────────────────────────────────────────────── */
eq('hoje dá zero dias',        N.diasAte(dia(0)), 0);
eq('amanhã dá um',             N.diasAte(dia(1)), 1);
eq('ontem dá menos um',        N.diasAte(dia(-1)), -1);
eq('data vazia não dá número', N.diasAte(''), null);
eq('soma que vira o mês', N.somaDias('2026-08-28T10:00:00.000Z', 5), '2026-09-02');
eq('soma que vira o ano',  N.somaDias('2026-12-30T10:00:00.000Z', 3), '2027-01-02');

/* ── orçamento que vence ──────────────────────────────────── */
const orc = d => ({ status:'orcamento_enviado',
  orcamento:{ total:100, validadeDias:15,
              enviadoEm:new Date(Date.now() - d*864e5).toISOString() } });

errado('orçamento de 3 dias não venceu',  N.orcamentoVencido(orc(3)));
certo ('orçamento de 40 dias venceu',     N.orcamentoVencido(orc(40)));
eq    ('esperando resposta há 9 dias',    N.diasEsperandoResposta(orc(9)), 9);
eq    ('sem orçamento não há espera',     N.diasEsperandoResposta({status:'aberto'}), null);

const jaRespondeu = orc(40); jaRespondeu.decisaoCliente = {valor:'aprovado'};
errado('orçamento já respondido não vence', N.orcamentoVencido(jaRespondeu));

/* ── fluxo de status ──────────────────────────────────────── */
eq('status devolve o rótulo', N.status('orcamento_enviado').rot, 'Aguardando aprovação');
eq('status desconhecido não quebra', typeof N.status('nao_existe'), 'object');
eq('depois de aberto vem recolha', N.proximoStatusSugerido('aberto'), 'recolha_agendada');
eq('depois de concluído vem entrega', N.proximoStatusSugerido('concluido'), 'entrega_agendada');
certo('chamado aberto conta como aberto', N.ehAberto({status:'em_teste'}));
errado('entregue não conta como aberto',  N.ehAberto({status:'entregue'}));

/* ── o que o cliente lê ───────────────────────────────────── */
const recolha = N.recadoCliente({status:'recolha_agendada', agenda:{recolhaPrevista:'2026-09-10'}});
certo('recado de recolha traz a data', recolha.includes('10/09'));
certo('recado de recolha não fala em status', !recolha.toLowerCase().includes('agendad'));

const comOrc = N.recadoCliente({ status:'orcamento_enviado',
  orcamento:{ total:469.9, prazoDias:5, validadeDias:15, enviadoEm:new Date().toISOString() } });
certo('recado de orçamento traz o valor', /469,90/.test(comOrc));
certo('recado de orçamento traz o prazo', comOrc.includes('5 dias'));
certo('recado de orçamento traz até quando responder', /Responda at/.test(comOrc));

eq('próximo passo pede resposta',
   N.proximoPassoCliente({status:'orcamento_enviado', orcamento:{}}),
   'Você precisa aprovar ou recusar para eu seguir.');
certo('orçamento vencido manda pedir outro',
   N.proximoPassoCliente(orc(40)).includes('venceu'));
eq('sem orçamento não há passo nenhum',
   N.proximoPassoCliente({status:'em_teste'}), '');

/* ── componentes da chopeira ──────────────────────────────── */
const comp = {tipo:'Compressor', marca:'Embraco', modelo:'EMIS80HER', serie:'SN-55', spec:'1/5 HP', obs:''};
eq('resumo junta o que existe', N.resumoComponente(comp), 'Embraco · EMIS80HER · série SN-55 · 1/5 HP');
eq('resumo vazio vira travessão', N.resumoComponente(N.componenteVazio()), '—');
errado('componente vazio não conta', N.componentePreenchido(N.componenteVazio()));
certo ('componente com marca conta',  N.componentePreenchido({marca:'Weg'}));
eq('acha por tipo', N.acharPorTipo([comp], 'Compressor').modelo, 'EMIS80HER');
eq('não acha o que não tem', N.acharPorTipo([comp], 'Torneira'), undefined);

/* ── etapas e contacto ────────────────────────────────────── */
eq('a buscar', N.ETAPAS.aBuscar, ['aberto','recolha_agendada']);
eq('nenhuma etapa se repete entre grupos que se excluem',
   N.ETAPAS.aBuscar.filter(x => N.ETAPAS.naEntrega.includes(x)), []);
certo('entregue está na entrega', N.ETAPAS.naEntrega.includes('entregue'));
certo('concluído fecha o serviço',  N.ETAPAS.fechando.includes('concluido'));
eq('toda etapa listada existe de verdade',
   Object.values(N.ETAPAS).flat().filter(id => !N.STATUS.some(s => s.id === id)), []);

eq('WhatsApp na frente do telefone',
   N.whatsDo({whatsapp:'48 99999-1234', telefone:'48 3333-1111'}), '5548999991234');
eq('sem WhatsApp usa o telefone',
   N.whatsDo({telefone:'48 3333-1111'}), '554833331111');
eq('sem nenhum dos dois, vazio', N.whatsDo({}), '');
eq('sem cliente, vazio', N.whatsDo(null), '');

/* ── numeração ────────────────────────────────────────────── */
certo('número de OS no formato',    /^OS-\d{6}-[A-Z0-9]{4}$/.test(N.numeroOS()));
certo('número de laudo no formato', /^LAU-\d{6}-[A-Z0-9]{4}$/.test(N.numeroLaudo()));
certo('dois laudos seguidos não colidem', N.numeroLaudo() !== N.numeroLaudo());

/* ── agenda ───────────────────────────────────────────────── */
const janela = N.janelaAgenda('2026-09-10', '09:00');
eq('compromisso de 2 horas', [janela.inicio, janela.fim],
   ['2026-09-10T09:00:00', '2026-09-10T11:00:00']);
eq('data inválida não vira compromisso', N.janelaAgenda('não é data', '09:00'), null);
certo('link da agenda leva o fuso',
   N.linkAgenda({data:'2026-09-10', hora:'09:00', titulo:'Retirar'}).includes('America%2FSao_Paulo'));

/* ── texto ────────────────────────────────────────────────── */
eq('esc fecha as tags', N.esc('<b>&"'), '&lt;b&gt;&amp;&quot;');
eq('esc aceita nulo', N.esc(null), '');
eq('nome de arquivo sem acento nem espaço', N.limparNome('Bar do Zé & Cia'), 'bar-do-z-cia');

/* ── ordenação ────────────────────────────────────────────── */
const ts = ms => ({toDate: () => new Date(ms)});
const ordenado = N.ordenar([
  {id:'velha', atualizadoEm: ts(1000)},
  {id:'nova',  atualizadoEm: ts(9000)},
  {id:'meio',  atualizadoEm: ts(5000)}
]).map(o => o.id);
eq('mais recente primeiro', ordenado, ['nova','meio','velha']);

/* ── o service worker conhece tudo o que a página pede? ──────
   Esta apanhou-me: separei o CSS para style.css e esqueci-o na lista do
   sw.js. Sem rede, o aplicativo abria sem estilo nenhum — e é defeito
   que só aparece longe do escritório, onde não há como consertar. */
const fs = require('fs'), caminho = require('path');
const raiz = caminho.join(__dirname, '..');
const html = fs.readFileSync(caminho.join(raiz, 'index.html'), 'utf8');
const sw   = fs.readFileSync(caminho.join(raiz, 'sw.js'), 'utf8');

const pedidos = [...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map(m => m[1]);
const guardados = [...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);

eq('tudo o que o index.html pede está guardado para o offline',
   pedidos.filter(f => !guardados.includes(f)), []);
eq('nada é guardado sem existir no disco',
   guardados.filter(f => f && !fs.existsSync(caminho.join(raiz, f))), []);
certo('há ficheiros guardados', guardados.length > 5);

/* ── as regras do Firestore dizem o que devem dizer? ─────────
   Não substituem o emulador, mas apanham o esquecimento: um campo novo
   que a regra devia proteger e não protege. Duas destas falhas já
   aconteceram nesta sessão. */
const regras = fs.readFileSync(caminho.join(raiz, 'firestore.rules'), 'utf8');

certo('a foto tem teto de tamanho',      /dataUrl\.size\(\) <= \d+/.test(regras));
certo('o chamado nasce com campos fechados', /keys\(\)\.hasOnly\(/.test(regras));
certo('o bloqueio trava a auto-liberação',
      /get\('bloqueado', false\) != true/.test(regras));
eq('nenhum campo de acesso fica desprotegido na regra do próprio nome',
   ['ativo','papel','clienteId','email','bloqueado']
     .filter(c => !new RegExp("hasAny\\(\\[[^\\]]*'" + c + "'").test(regras)), []);
certo('o chamado do cliente continua a nascer como aberto',
      /request\.resource\.data\.status == 'aberto'/.test(regras));

/* ── resultado ────────────────────────────────────────────── */
console.log('');
if(falhas.length){
  console.log('  ' + ok + ' passaram, ' + falhas.length + ' FALHARAM\n');
  falhas.forEach(f => console.log('  ✗ ' + f + '\n'));
  process.exit(1);
}
console.log('  ' + ok + ' verificações do núcleo, todas certas.\n');
