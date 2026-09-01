/* ═══════════════════════════════════════════════════════════════════
   ORCAMENTO

   Catálogo de peças, montar e responder orçamento

   Script clássico, não módulo: o aplicativo tem 147 handlers escritos
   no próprio HTML (onclick="salvarCliente()"), e módulo tem escopo
   próprio — todos parariam de funcionar de uma vez. A ordem de
   carregamento está no index.html.
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
   PEÇAS E ORÇAMENTO

   O orçamento é do Giba; a resposta é do cliente. Peças e serviço vão
   em linhas separadas porque é assim que o cliente decide: ele aceita
   pagar a peça, discute a mão de obra, ou o contrário.
   ═══════════════════════════════════════════════════════════════════ */

/* Nomes tirados da tabela de peças de chopeira do app de compressores.
   Servem de sugestão ao cadastrar — ninguém é obrigado a usá-los. */
const PECAS_SUGERIDAS = [
  "Pressostato de baixa (KP1 Danfoss)",
  "Pressostato de alta (cartucho)",
  "Pressostato RCP Robert Shaw",
  "Relé de partida magnético",
  "Relé de partida voltimétrico",
  "Capacitor de partida (eletrolítico)",
  "Capacitor permanente (de marcha)",
  "Protetor térmico",
  "Válvula solenoide (linha de líquido)",
  "Micromotor do ventilador do condensador",
  "Resistência de degelo",
  "Compressor",
  "Filtro secador",
  "Torneira",
  "Guarnição de torneira",
  "Bomba de água",
  "Serpentina",
  "Gás refrigerante (carga)"
];

const SERVICOS_SUGERIDOS = [
  "Mão de obra — manutenção corretiva",
  "Mão de obra — troca de componente",
  "Limpeza e higienização",
  "Carga de gás e teste de estanqueidade",
  "Recolha e entrega"
];


/* O cliente digita "45,90"; o teclado numérico do celular às vezes dá
   "45.90". Os dois têm de virar o mesmo número. */


/* ═══════════════ CADASTRO DE PEÇAS (admin) ═══════════════ */
/* ── Trazer peças do Giba Compressores ────────────────────────────
   O catálogo vem de um arquivo ao lado do aplicativo, gerado a partir
   do app de compressores. Traz só o que ainda não existe, e sempre com
   preço zerado: o valor é seu, não do catálogo. */
async function importarPecasCompressores(){
  const bt = $("btImportar");
  if(bt) bt.disabled = true;
  try{
    const r = await fetch("./pecas-compressores.json");
    if(!r.ok) throw new Error("não achei o catálogo");
    const dados = await r.json();
    const vindas = (dados && dados.pecas) || [];
    if(!vindas.length) throw new Error("catálogo vazio");

    const jaTem = p => PECAS.some(x =>
      (p.codigo && x.codigo && x.codigo.toLowerCase() === p.codigo.toLowerCase()) ||
      (x.descricao || "").toLowerCase() === (p.descricao || "").toLowerCase());

    const novas = vindas.filter(p => !jaTem(p));
    if(!novas.length){
      if(bt) bt.disabled = false;
      return toast("Todas as " + vindas.length + " peças já estão na sua lista.", "ok");
    }
    if(!confirm("Trazer " + novas.length + " peça" + (novas.length===1?"":"s") +
        " do Giba Compressores?\n\nOs preços vêm zerados para você preencher." +
        (novas.length < vindas.length
          ? "\n\n(" + (vindas.length - novas.length) + " já estavam na lista e ficam como estão.)"
          : ""))){
      if(bt) bt.disabled = false;
      return;
    }

    for(const p of novas){
      await db.collection("pecas").add(Object.assign({}, p,
        {criadoEm: firebase.firestore.FieldValue.serverTimestamp()}));
    }
    await recarregar();
    telaPecas();
    toast(novas.length + " peças trazidas. Agora ponha os preços.", "ok");
  }catch(e){
    toast("Não deu para trazer: " + (e.message || e), "err");
    if(bt) bt.disabled = false;
  }
}

function telaPecas(){
  if(editando && editando.tipo === "peca") return formPeca();

  const busca = (window.__buscaPec || "").toLowerCase();
  /* As observações entram na busca de propósito: é lá que fica o
     "substitui: EM20HHR, EM20HHP…" de cada compressor. Chega uma
     máquina com um modelo antigo, digita-se o código que está na
     etiqueta e aparece o que se compra hoje. */
  const lista = PECAS.filter(p => !busca ||
    [p.codigo, p.descricao, p.aplicacao, p.observacoes]
      .map(x => x || "").join(" ").toLowerCase().includes(busca));

  $("tela").innerHTML =
    '<div class="btns" style="margin:0 0 12px">' +
      '<button class="btn pri" onclick="novaPeca()">+ Nova peça</button>' +
      '<button class="btn" id="btImportar" onclick="importarPecasCompressores()">Trazer do Compressores</button>' +
      '<button class="btn" onclick="atualizar()">Atualizar</button>' +
    '</div>' +
    '<div class="busca"><input placeholder="Código, descrição, ou o modelo antigo que substitui" value="' +
      esc(window.__buscaPec||"") + '" oninput="window.__buscaPec=this.value;telaPecas()"></div>' +
    (lista.length ? lista.map(cartaoPeca).join("") :
      '<div class="vazio">' + (PECAS.length ? "Nada encontrado." :
        "Nenhuma peça cadastrada. Lance as que você mais troca — elas entram no orçamento com um toque.") +
      '</div>');
}

function cartaoPeca(p){
  return '<div class="reg"><div class="top"><div style="min-width:0">' +
    '<div class="nm">' + esc(p.descricao) + '</div>' +
    (p.codigo ? '<div class="dt mono">' + esc(p.codigo) + '</div>' : '') +
    (p.aplicacao ? '<div class="dt">' + esc(p.aplicacao) + '</div>' : '') +
    '</div>' +
    '<div style="text-align:right"><div class="nm" style="color:var(--copperhi);white-space:nowrap">' +
      esc(reais(p.precoVenda)) + '</div>' +
      '<div class="dt">' + esc(p.unidade || "un") + '</div>' +
      '<button class="btn sm" style="margin-top:6px" onclick="editarPeca(\'' + p.id + '\')">Abrir</button>' +
    '</div></div></div>';
}

function novaPeca(){
  editando = {tipo:"peca", id:null, dados:{codigo:"", descricao:"", unidade:"un",
    precoVenda:0, aplicacao:"", observacoes:""}};
  telaPecas();
}
function editarPeca(id){
  const p = PECAS.find(x => x.id === id);
  if(!p) return;
  editando = {tipo:"peca", id:id, dados:JSON.parse(JSON.stringify(p))};
  telaPecas();
}

function formPeca(){
  const d = editando.dados;
  $("tela").innerHTML =
    '<div class="card">' +
      '<h2>' + (editando.id ? "Editar peça" : "Nova peça") + '</h2>' +
      '<div class="muted">O preço aqui é o de venda: é ele que entra no orçamento, e dá para ' +
        'mudar em cada orçamento sem mexer no cadastro.</div>' +

      '<label>Descrição</label>' +
      '<input id="p_desc" list="sugestoesPeca" value="' + esc(d.descricao) + '">' +
      '<datalist id="sugestoesPeca">' +
        PECAS_SUGERIDAS.map(s => '<option value="' + esc(s) + '"></option>').join("") +
      '</datalist>' +
      '<div class="esc">A lista sugere as peças de chopeira do seu app de compressores. ' +
        'Pode escrever qualquer outra.</div>' +

      '<div class="lin">' +
        '<div><label>Código</label><input id="p_cod" value="' + esc(d.codigo) + '"></div>' +
        '<div style="flex:0 0 100px"><label>Unidade</label><input id="p_un" value="' +
          esc(d.unidade || "un") + '"></div>' +
      '</div>' +
      '<label>Preço de venda</label>' +
      '<input id="p_preco" inputmode="decimal" value="' +
        esc(d.precoVenda ? String(d.precoVenda).replace(".", ",") : "") + '" placeholder="0,00">' +
      '<label>Serve em</label>' +
      '<input id="p_aplic" placeholder="Embraco 1/5 HP, chopeira Beertec" value="' + esc(d.aplicacao) + '">' +
      '<label>Observações</label><textarea id="p_obs">' + esc(d.observacoes || "") + '</textarea>' +

      '<div class="btns">' +
        '<button class="btn pri" id="btPeca" onclick="salvarPeca()">Salvar</button>' +
        '<button class="btn" onclick="irPara(\'pecas\')">Cancelar</button>' +
        (editando.id ? '<button class="btn dg" onclick="apagarPeca()">Apagar</button>' : '') +
      '</div>' +
    '</div>';
}

async function salvarPeca(){
  const d = {
    codigo: $("p_cod").value.trim(),
    descricao: $("p_desc").value.trim(),
    unidade: $("p_un").value.trim() || "un",
    precoVenda: paraNumero($("p_preco").value),
    aplicacao: $("p_aplic").value.trim(),
    observacoes: $("p_obs").value.trim()
  };
  if(!d.descricao) return toast("Falta a descrição da peça.", "err");

  $("btPeca").disabled = true;
  try{
    if(editando.id) await db.collection("pecas").doc(editando.id).update(d);
    else {
      d.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("pecas").add(d);
    }
    await recarregar();
    irPara("pecas");
    toast("Peça salva.", "ok");
  }catch(e){
    toast("Não deu para salvar: " + (e.message || e), "err");
    const b = $("btPeca"); if(b) b.disabled = false;
  }
}

async function apagarPeca(){
  if(!confirm("Apagar esta peça do cadastro? Os orçamentos já feitos não mudam.")) return;
  try{
    await db.collection("pecas").doc(editando.id).delete();
    await recarregar();
    irPara("pecas");
    toast("Peça apagada.", "ok");
  }catch(e){ toast("Não deu para apagar: " + (e.message || e), "err"); }
}

/* ═══════════════ ORÇAMENTO ═══════════════ */

/* O que os dois lados veem, depois de o orçamento estar na mesa. */
function blocoOrcamento(o){
  const orc = o.orcamento;
  if(!orc || !(orc.itens || []).length) return "";

  const linhas = tipo => (orc.itens || []).filter(i => i.tipo === tipo).map(i =>
    '<tr><td style="padding:7px 8px 7px 0">' + esc(i.descricao) +
      '<div class="dt">' + esc(i.qtd) + ' × ' + esc(reais(i.valorUnit)) + '</div></td>' +
    '<td style="padding:7px 0;text-align:right;white-space:nowrap;font-weight:700">' +
      esc(reais((Number(i.qtd)||0) * (Number(i.valorUnit)||0))) + '</td></tr>').join("");

  const pecas = linhas("peca"), servicos = linhas("servico");
  const d = o.decisaoCliente;

  return '<h3>Orçamento</h3>' +
    '<table style="width:100%">' +
      (pecas ? '<tr><td colspan="2" class="muted" style="padding-top:6px;font-size:11px;' +
        'text-transform:uppercase;letter-spacing:1.2px">Peças</td></tr>' + pecas +
        '<tr><td class="muted" style="padding:6px 0">Subtotal peças</td>' +
        '<td style="text-align:right;padding:6px 0">' + esc(reais(orc.totalPecas)) + '</td></tr>' : '') +
      (servicos ? '<tr><td colspan="2" class="muted" style="padding-top:12px;font-size:11px;' +
        'text-transform:uppercase;letter-spacing:1.2px">Serviço</td></tr>' + servicos +
        '<tr><td class="muted" style="padding:6px 0">Subtotal serviço</td>' +
        '<td style="text-align:right;padding:6px 0">' + esc(reais(orc.totalServico)) + '</td></tr>' : '') +
      '<tr><td style="padding:11px 0 0;font-weight:800;border-top:1px solid var(--line)">Total</td>' +
      '<td style="padding:11px 0 0;text-align:right;font-weight:800;font-size:17px;' +
        'color:var(--copperhi);border-top:1px solid var(--line)">' + esc(reais(orc.total)) + '</td></tr>' +
    '</table>' +
    (orc.prazoDias ? '<div class="alert blu" style="margin-top:10px">' +
      '<b>Fica pronto em ' + esc(orc.prazoDias) + ' dia' +
      (Number(orc.prazoDias) === 1 ? "" : "s") + '</b> depois da aprovação.</div>' : '') +

    (validoAte(o)
      ? (orcamentoVencido(o)
          ? '<div class="alert red" style="margin-top:10px"><b>Este orçamento venceu</b> em ' +
            esc(dataCurta(validoAte(o))) + '. Os preços podem ter mudado — ' +
            (EU.admin ? 'monte um novo para o cliente poder responder.'
                      : 'peça um novo ao Giba.') + '</div>'
          : '<div class="esc">Responda até <b>' + esc(dataCurta(validoAte(o))) + '</b>.' +
            (diasAte(validoAte(o)) <= 3 ? ' Falta pouco.' : '') + '</div>')
      : '') +

    (d ? '<div class="alert ' + (d.valor === "aprovado" ? "grn" : "red") + '" style="margin-top:12px">' +
      '<b>' + (d.valor === "aprovado" ? "Aprovado" : "Não aprovado") + '</b> por ' + esc(d.por) +
      ' em ' + esc(quando(d.quando)) + (d.motivo ? '<br>' + esc(d.motivo) : '') + '</div>' : '') +

    (!d && !EU.admin && o.status === "orcamento_enviado" && !orcamentoVencido(o)
      ? botoesDecisao() : '') +
    (!d && EU.admin && o.status === "orcamento_enviado"
      ? '<div class="esc">Esperando a resposta do cliente. Se ele responder por telefone, ' +
        'registre por ele em <b>Mover o chamado</b>.</div>' : '');
}

function botoesDecisao(){
  return '<div class="btns">' +
      '<button class="btn pri" onclick="responderOrcamento(\'aprovado\')">Aprovar o serviço</button>' +
      '<button class="btn dg" onclick="responderOrcamento(\'reprovado\')">Não aprovar</button>' +
    '</div>' +
    '<div class="esc">A sua resposta fica registrada com o seu nome e a data.</div>';
}

async function responderOrcamento(valor){
  const o = editando.dados;
  let motivo = "";
  if(valor === "reprovado"){
    motivo = prompt("Se quiser, diga por que não aprovou (ajuda o Giba a rever):") || "";
  } else if(!confirm("Aprovar o serviço no valor de " + reais(o.orcamento.total) + "?")){
    return;
  }
  const agora = new Date().toISOString();
  const novo = valor === "aprovado" ? "orcamento_aprovado" : "orcamento_reprovado";
  const decisao = {valor:valor, motivo:motivo.trim(), quando:agora,
                   por: EU.nome || EU.email, porUid: EU.uid};
  const registro = {status:novo, quando:agora, quem: EU.nome || EU.email, nota:motivo.trim()};
  try{
    await db.collection("ordens").doc(o.id).update({
      status: novo,
      decisaoCliente: decisao,
      historico: firebase.firestore.FieldValue.arrayUnion(registro),
      naoLidoAdmin: true,
      naoLidoCliente: false,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    o.status = novo; o.decisaoCliente = decisao;
    o.historico = (o.historico || []).concat([registro]);
    o.naoLidoAdmin = true;
    verOrdem();
    toast(valor === "aprovado" ? "Aprovado. O Giba já foi avisado." : "Resposta registrada.", "ok");
  }catch(e){
    toast("Não deu para registrar: " + (e.message || e), "err");
  }
}

/* ── o editor, só do lado do Giba ─────────────────────────────────── */
function montarOrcamento(){
  const o = editando.dados;
  const orc = o.orcamento;
  editando.orc = {
    itens: orc ? JSON.parse(JSON.stringify(orc.itens || [])) : [],
    validadeDias: orc ? (orc.validadeDias || 15) : 15,
    prazoDias: orc ? (orc.prazoDias || "") : ""
  };
  editando.modo = "orcamento";
  verOrdem();
}

function editorOrcamento(){
  const e = editando.orc;
  const soma = somarOrcamento(e.itens);

  const linha = (i, idx) =>
    '<div class="itemOrc">' +
      '<div class="lin" style="gap:8px">' +
        '<div style="flex:1 1 100%"><input value="' + esc(i.descricao) + '" placeholder="descrição" ' +
          'oninput="mudarItem(' + idx + ',\'descricao\',this.value)"></div>' +
      '</div>' +
      '<div class="lin" style="gap:8px;margin-top:8px;align-items:flex-end">' +
        '<div style="flex:0 0 66px"><label style="margin:0 0 4px">Qtd</label>' +
          '<input inputmode="decimal" value="' + esc(i.qtd) + '" ' +
          'oninput="mudarItem(' + idx + ',\'qtd\',this.value)"></div>' +
        '<div><label style="margin:0 0 4px">Valor unitário</label>' +
          '<input inputmode="decimal" value="' + esc(String(i.valorUnit).replace(".", ",")) + '" ' +
          'oninput="mudarItem(' + idx + ',\'valorUnit\',this.value)"></div>' +
        '<div style="flex:0 0 auto"><button class="btn dg sm" onclick="tirarItem(' + idx + ')">×</button></div>' +
      '</div>' +
      '<div class="esc" style="text-align:right">' +
        esc(reais((Number(i.qtd)||0) * (Number(i.valorUnit)||0))) + '</div>' +
    '</div>';

  const grupo = (tipo, titulo) => {
    const itens = e.itens.map((i, idx) => ({i:i, idx:idx})).filter(x => x.i.tipo === tipo);
    return '<h3>' + titulo + '</h3>' +
      (itens.length ? itens.map(x => linha(x.i, x.idx)).join("") :
        '<div class="esc">Nada ainda.</div>') +
      '<div class="btns" style="margin-top:8px">' +
        '<button class="btn sm" onclick="novoItem(\'' + tipo + '\')">+ Acrescentar</button>' +
        (tipo === "peca" && PECAS.length
          ? '<select style="width:auto;flex:1 1 160px" onchange="itemDoCatalogo(this)">' +
              '<option value="">— do cadastro de peças —</option>' +
              PECAS.map(p => '<option value="' + p.id + '">' + esc(p.descricao) +
                ' · ' + esc(reais(p.precoVenda)) + '</option>').join("") +
            '</select>' : '') +
      '</div>';
  };

  return '<div style="border-top:1px solid var(--line);margin-top:16px;padding-top:4px">' +
    grupo("peca", "Peças") +
    grupo("servico", "Serviço") +
    '<h3>Totais</h3>' +
    '<table style="width:100%">' +
      '<tr><td class="muted">Peças</td><td style="text-align:right">' + esc(reais(soma.totalPecas)) + '</td></tr>' +
      '<tr><td class="muted">Serviço</td><td style="text-align:right">' + esc(reais(soma.totalServico)) + '</td></tr>' +
      '<tr><td style="font-weight:800;padding-top:8px;border-top:1px solid var(--line)">Total</td>' +
      '<td id="somaViva" style="text-align:right;font-weight:800;font-size:17px;' +
        'color:var(--copperhi);padding-top:8px;border-top:1px solid var(--line)">' +
        esc(reais(soma.total)) + '</td></tr>' +
    '</table>' +
    '<div class="lin">' +
      '<div><label>Validade (dias)</label>' +
        '<input id="orc_validade" inputmode="numeric" value="' + esc(e.validadeDias) + '" ' +
          'oninput="editando.orc.validadeDias=this.value"></div>' +
      '<div><label>Fica pronto em (dias)</label>' +
        '<input id="orc_prazo" inputmode="numeric" placeholder="5" value="' + esc(e.prazoDias) + '" ' +
          'oninput="editando.orc.prazoDias=this.value"></div>' +
    '</div>' +
    '<div class="esc">O prazo é o que o cliente mais pergunta depois do preço. ' +
      'Conta a partir da aprovação.</div>' +
    '<div class="btns">' +
      '<button class="btn pri" id="btEnviarOrc" onclick="salvarOrcamento(true)">Salvar e enviar ao cliente</button>' +
      '<button class="btn" onclick="salvarOrcamento(false)">Só salvar</button>' +
      '<button class="btn" onclick="editando.modo=null;verOrdem()">Cancelar</button>' +
    '</div>' +
    '<div class="esc">Enviar coloca o chamado em <b>orçamento enviado</b> e abre os botões de ' +
      'aprovar do lado do cliente. Só salvar deixa guardado para acertar depois.</div>' +
  '</div>';
}

function novoItem(tipo){
  editando.orc.itens.push({tipo:tipo, pecaId:null, descricao:"", qtd:1, valorUnit:0});
  verOrdem();
}
function itemDoCatalogo(sel){
  const p = PECAS.find(x => x.id === sel.value);
  sel.value = "";
  if(!p) return;
  editando.orc.itens.push({tipo:"peca", pecaId:p.id, descricao:p.descricao,
                           qtd:1, valorUnit:Number(p.precoVenda)||0});
  verOrdem();
}
function mudarItem(idx, campo, valor){
  const i = editando.orc.itens[idx];
  if(!i) return;
  i[campo] = (campo === "descricao") ? valor : paraNumero(valor);
  /* Só o total é redesenhado: refazer a tela inteira tiraria o cursor do
     campo no meio da digitação. */
  const alvo = $("somaViva");
  if(alvo) alvo.textContent = reais(somarOrcamento(editando.orc.itens).total);
}
function tirarItem(idx){
  editando.orc.itens.splice(idx, 1);
  verOrdem();
}

async function salvarOrcamento(enviar){
  const e = editando.orc, o = editando.dados;
  const itens = e.itens
    .filter(i => i.descricao.trim())
    .map(i => ({tipo:i.tipo, pecaId:i.pecaId || null, descricao:i.descricao.trim(),
                qtd:Number(i.qtd)||0, valorUnit:Number(i.valorUnit)||0}));
  if(!itens.length) return toast("O orçamento está vazio.", "err");
  if(itens.some(i => !i.qtd)) return toast("Alguma linha está sem quantidade.", "err");

  const soma = somarOrcamento(itens);
  const orc = {
    itens: itens,
    totalPecas: soma.totalPecas, totalServico: soma.totalServico, total: soma.total,
    validadeDias: Number(paraNumero(e.validadeDias)) || 15,
    prazoDias: Number(paraNumero(e.prazoDias)) || 0,
    enviadoEm: enviar ? new Date().toISOString() : (o.orcamento ? o.orcamento.enviadoEm : null)
  };

  const b = $("btEnviarOrc"); if(b) b.disabled = true;
  try{
    const mudanca = {orcamento: orc,
                     atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()};
    if(enviar){
      const agora = new Date().toISOString();
      const registro = {status:"orcamento_enviado", quando:agora, quem: EU.nome || "Giba",
                        nota:"Orçamento de " + reais(orc.total) + "."};
      mudanca.status = "orcamento_enviado";
      mudanca.decisaoCliente = null;
      mudanca.historico = firebase.firestore.FieldValue.arrayUnion(registro);
      mudanca.naoLidoCliente = true;
      o.status = "orcamento_enviado";
      o.decisaoCliente = null;
      o.historico = (o.historico || []).concat([registro]);
      o.naoLidoCliente = true;
    }
    await db.collection("ordens").doc(o.id).update(mudanca);
    o.orcamento = orc;
    editando.modo = null;
    verOrdem();
    desenharSino();
    toast(enviar ? "Orçamento enviado. Avise no WhatsApp." : "Orçamento guardado.", "ok");
  }catch(err){
    toast("Não deu para salvar: " + (err.message || err), "err");
    if(b) b.disabled = false;
  }
}
