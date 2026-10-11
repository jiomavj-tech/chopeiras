/* ═══════════════════════════════════════════════════════════════════
   IMPORTAR EQUIPAMENTOS

   Cadastrar vinte chopeiras à mão, uma tela de cada vez, é uma tarde
   inteira — e é onde se erra o número da etiqueta. Esta tela recebe a
   lista pronta, de uma vez só.

   O texto colado NÃO vem para dentro do repositório. Este arquivo é
   público (a página está no GitHub Pages); a lista de equipamentos de
   um cliente, com patrimônio e número de série, não pode ficar numa
   URL que qualquer pessoa abre. Por isso a lista chega colada ou por
   arquivo escolhido no aparelho, e nunca gravada aqui ao lado.

   Script clássico, não módulo — a ordem de carregamento está no
   index.html.
   ═══════════════════════════════════════════════════════════════════ */

/* Os campos que um equipamento importado pode trazer. O que vier fora
   desta lista é recusado com o nome do campo: melhor parar na conferência
   do que gravar um campo com erro de escrita que ninguém mais encontra. */
const CAMPOS_IMPORTAVEIS = [
  "codigo", "local", "marca", "modelo", "tipo", "torneiras",
  "compressorMarca", "compressorModelo", "compressorHp", "compressorGas",
  "compressorAplicacao", "observacoes", "provisorio", "componentes"
];

const CAMPOS_COMPONENTE_IMP = ["tipo", "marca", "modelo", "serie", "spec", "obs"];


/* ── Ler e conferir, sem gravar nada ──────────────────────────────── */
/* Devolve {equipamentos, problemas}. Enquanto houver problema, o botão
   de importar não aparece. */
function lerListaEquipamentos(texto, codigosExistentes){
  const problemas = [];
  let dados;
  try{
    dados = JSON.parse(texto);
  }catch(e){
    return {equipamentos: [], problemas: ["O texto não é um JSON válido: " + e.message]};
  }

  const lista = Array.isArray(dados) ? dados
              : (dados && Array.isArray(dados.equipamentos)) ? dados.equipamentos
              : null;
  if(!lista) return {equipamentos: [], problemas: [
    'Não achei a lista. Esperava uma lista de equipamentos, ou um objeto com "equipamentos": [ ... ].']};
  if(!lista.length) return {equipamentos: [], problemas: ["A lista está vazia."]};

  const jaNoTexto = {};
  const equipamentos = lista.map((bruto, i) => {
    const onde = "equipamento " + (i + 1);
    if(!bruto || typeof bruto !== "object"){
      problemas.push(onde + ": não é um registro.");
      return null;
    }
    Object.keys(bruto).forEach(k => {
      if(CAMPOS_IMPORTAVEIS.indexOf(k) < 0)
        problemas.push(onde + ': campo desconhecido "' + k + '".');
    });

    const codigo = String(bruto.codigo || "").trim();
    if(!codigo){ problemas.push(onde + ": sem número de etiqueta."); return null; }

    const chave = codigo.toLowerCase();
    if(jaNoTexto[chave]) problemas.push('O número "' + codigo + '" aparece duas vezes na lista.');
    jaNoTexto[chave] = true;

    const comps = Array.isArray(bruto.componentes) ? bruto.componentes : [];
    comps.forEach(c => Object.keys(c || {}).forEach(k => {
      if(CAMPOS_COMPONENTE_IMP.indexOf(k) < 0)
        problemas.push(onde + ': componente com campo desconhecido "' + k + '".');
    }));

    const limpo = {};
    CAMPOS_IMPORTAVEIS.forEach(k => {
      if(k === "componentes" || k === "provisorio") return;
      limpo[k] = String(bruto[k] == null ? "" : bruto[k]).trim();
    });
    limpo.provisorio = bruto.provisorio === true;
    limpo.componentes = comps.map(c => {
      const x = componenteVazio();
      CAMPOS_COMPONENTE_IMP.forEach(k => { x[k] = String((c && c[k]) || "").trim(); });
      return x;
    }).filter(componentePreenchido);

    limpo.jaExiste = codigosExistentes.indexOf(chave) >= 0;
    return limpo;
  }).filter(Boolean);

  return {equipamentos: equipamentos, problemas: problemas};
}


/* ── A tela ───────────────────────────────────────────────────────── */
function importarEquipamentos(){
  editando = {tipo:"importarChopeiras", id:null, dados:{
    clienteId: CLIENTES.length === 1 ? CLIENTES[0].id : "",
    texto: "", lido: null
  }};
  telaChopeiras();
}

function formImportarEquipamentos(){
  const d = editando.dados;
  const lido = d.lido;
  const novos = lido ? lido.equipamentos.filter(e => !e.jaExiste) : [];
  const repetidos = lido ? lido.equipamentos.filter(e => e.jaExiste) : [];
  const empresa = CLIENTES.find(c => c.id === d.clienteId);

  $("tela").innerHTML =
    '<div class="card">' +
      '<h2>Importar equipamentos</h2>' +
      '<div class="esc">Para cadastrar uma lista inteira de uma vez, em vez de uma ' +
        'tela de cada vez. Nada é gravado antes de você conferir.</div>' +

      '<label>De qual empresa são</label>' +
      '<select id="imp_cliente" onchange="editando.dados.clienteId=this.value">' +
        '<option value="">— escolha —</option>' +
        CLIENTES.map(c => '<option value="' + c.id + '"' +
          (c.id === d.clienteId ? " selected" : "") + '>' +
          esc(c.nomeFantasia || c.razaoSocial) + '</option>').join("") +
      '</select>' +

      '<label>A lista</label>' +
      '<input type="file" accept=".json,application/json" onchange="arquivoDaLista(this)">' +
      '<div class="esc" style="margin:6px 0">Escolha o arquivo, ou cole o conteúdo aqui embaixo.</div>' +
      '<textarea id="imp_texto" style="min-height:120px;font-family:ui-monospace,monospace;font-size:12px" ' +
        'placeholder=\'{"equipamentos": [ ... ]}\' ' +
        'oninput="editando.dados.texto=this.value">' + esc(d.texto) + '</textarea>' +

      '<div class="btns" style="margin-top:12px">' +
        '<button class="btn" onclick="conferirLista()">Conferir</button>' +
        '<button class="btn" onclick="editando=null;telaChopeiras()">Cancelar</button>' +
      '</div>' +
    '</div>' +

    (lido ? resultadoDaConferencia(lido, novos, repetidos, empresa) : "");
}

function resultadoDaConferencia(lido, novos, repetidos, empresa){
  if(lido.problemas.length){
    return '<div class="card"><h3>A lista tem problemas</h3>' +
      '<div class="alert red" style="text-align:left"><ul style="margin:0;padding-left:18px">' +
        lido.problemas.slice(0, 20).map(p => '<li>' + esc(p) + '</li>').join("") +
        (lido.problemas.length > 20
          ? '<li>… e mais ' + (lido.problemas.length - 20) + '.</li>' : '') +
      '</ul></div>' +
      '<div class="esc">Nada foi gravado. Corrija a lista e confira de novo.</div></div>';
  }

  const semEmpresa = !empresa;
  return '<div class="card">' +
    '<h3>O que vai ser cadastrado</h3>' +
    '<div class="alert ' + (novos.length ? 'yel' : 'yel') + '" style="text-align:left">' +
      '<b>' + novos.length + ' equipamento' + (novos.length === 1 ? '' : 's') + '</b>' +
      (empresa ? ' em <b>' + esc(empresa.nomeFantasia || empresa.razaoSocial) + '</b>' : '') +
      (repetidos.length
        ? '. Outro' + (repetidos.length === 1 ? '' : 's') + ' ' + repetidos.length +
          ' já está' + (repetidos.length === 1 ? '' : 'ão') + ' cadastrado' +
          (repetidos.length === 1 ? '' : 's') + ' e fica' + (repetidos.length === 1 ? '' : 'm') +
          ' como está' + (repetidos.length === 1 ? '' : 'ão') + '.'
        : '.') +
    '</div>' +

    (novos.length ? '<div class="tabelinha">' + novos.map(linhaConferencia).join("") + '</div>' : '') +
    (repetidos.length
      ? '<h3>Já cadastrados, não mexo</h3><div class="esc">' +
        repetidos.map(e => esc(e.codigo)).join(" · ") + '</div>'
      : '') +

    '<div class="btns" style="margin-top:14px">' +
      (novos.length && !semEmpresa
        ? '<button class="btn pri" id="btImportarEq" onclick="gravarLista()">Cadastrar ' +
          novos.length + ' equipamento' + (novos.length === 1 ? '' : 's') + '</button>'
        : '') +
      '<button class="btn" onclick="editando=null;telaChopeiras()">Sair sem gravar</button>' +
    '</div>' +
    (semEmpresa ? '<div class="alert red" style="margin-top:10px">Escolha a empresa antes de cadastrar.</div>' : '') +
  '</div>';
}

function linhaConferencia(e){
  const ficha = (e.componentes || []).length;
  return '<div class="reg"><div class="top"><div style="min-width:0">' +
    '<div class="nm">' + esc(e.codigo) +
      (e.provisorio ? ' <span class="dt">(provisório)</span>' : '') + '</div>' +
    '<div class="dt">' + esc([e.marca, e.modelo].filter(Boolean).join(" · ") || "—") + '</div>' +
    (e.compressorModelo
      ? '<div class="dt mono">' + esc([e.compressorMarca, e.compressorModelo].filter(Boolean).join(" ")) +
        (e.compressorGas ? ' · ' + esc(e.compressorGas) : '') + '</div>'
      : '<div class="dt">compressor não identificado no documento</div>') +
    '</div>' +
    '<div class="dt" style="text-align:right;flex:0 0 auto">' +
      (ficha ? ficha + ' na ficha' : 'sem ficha') + '</div>' +
  '</div></div>';
}


/* ── Os botões ────────────────────────────────────────────────────── */
function arquivoDaLista(input){
  const f = input.files && input.files[0];
  if(!f) return;
  const leitor = new FileReader();
  leitor.onload = () => {
    editando.dados.texto = String(leitor.result || "");
    editando.dados.lido = null;
    telaChopeiras();
    conferirLista();
  };
  leitor.onerror = () => toast("Não deu para ler o arquivo.", "err");
  leitor.readAsText(f);
}

function conferirLista(){
  const campo = $("imp_texto");
  if(campo) editando.dados.texto = campo.value;
  const texto = (editando.dados.texto || "").trim();
  if(!texto){ editando.dados.lido = null; return toast("Cole a lista, ou escolha o arquivo.", "err"); }

  const existentes = CHOPEIRAS.map(c => String(c.codigo || "").toLowerCase());
  editando.dados.lido = lerListaEquipamentos(texto, existentes);
  telaChopeiras();
}

async function gravarLista(){
  const d = editando.dados;
  if(!d.clienteId) return toast("Escolha a empresa.", "err");
  if(!d.lido || d.lido.problemas.length) return toast("Confira a lista primeiro.", "err");

  const novos = d.lido.equipamentos.filter(e => !e.jaExiste);
  if(!novos.length) return toast("Não há nada de novo para cadastrar.", "ok");

  const bt = $("btImportarEq");
  if(bt){ bt.disabled = true; bt.textContent = "Cadastrando…"; }

  let feitos = 0;
  try{
    for(const e of novos){
      const reg = {
        codigo: e.codigo,
        clienteId: d.clienteId,
        local: e.local,
        marca: e.marca,
        modelo: e.modelo,
        tipo: e.tipo,
        torneiras: e.torneiras,
        compressorMarca: e.compressorMarca,
        compressorModelo: e.compressorModelo,
        compressorHp: e.compressorHp,
        compressorGas: e.compressorGas,
        compressorAplicacao: e.compressorAplicacao,
        observacoes: e.observacoes,
        componentes: e.componentes,
        provisorio: e.provisorio,
        thumb: null,
        fotoId: null,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection("chopeiras").add(reg);
      feitos++;
    }
    editando = null;
    await recarregar();
    irPara("chopeiras");
    toast(feitos + " equipamento" + (feitos === 1 ? "" : "s") + " cadastrado" +
          (feitos === 1 ? "" : "s") + ".", "ok");
  }catch(err){
    toast("Parou no " + (feitos + 1) + "º: " + (err.message || err) +
          (feitos ? " (" + feitos + " já entraram)" : ""), "err");
    if(bt){ bt.disabled = false; bt.textContent = "Tentar de novo"; }
    await recarregar();
  }
}

if(typeof module !== "undefined" && module.exports){
  module.exports = {lerListaEquipamentos: lerListaEquipamentos,
                    CAMPOS_IMPORTAVEIS: CAMPOS_IMPORTAVEIS};
}
