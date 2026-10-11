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
  "compressorAplicacao", "observacoes", "provisorio", "componentes",
  "fotos", "thumb"
];

/* Foto entra como data:image/... — o mesmo que a câmara do aparelho
   produz. Qualquer outra coisa é recusada: um http:// aqui gravaria um
   endereço que um dia deixa de responder, e a ficha ficaria com um
   quadrado vazio sem ninguém saber porquê. */
const FOTO_VALIDA = /^data:image\/(jpeg|png|webp);base64,/;

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

    const fotos = Array.isArray(bruto.fotos) ? bruto.fotos : [];
    fotos.forEach((f, n) => {
      if(typeof f !== "string" || !FOTO_VALIDA.test(f))
        problemas.push(onde + ": foto " + (n+1) + " não é uma imagem.");
    });
    if(bruto.thumb != null && !FOTO_VALIDA.test(String(bruto.thumb)))
      problemas.push(onde + ": a miniatura não é uma imagem.");

    const comps = Array.isArray(bruto.componentes) ? bruto.componentes : [];
    comps.forEach(c => Object.keys(c || {}).forEach(k => {
      if(CAMPOS_COMPONENTE_IMP.indexOf(k) < 0)
        problemas.push(onde + ': componente com campo desconhecido "' + k + '".');
    }));

    const limpo = {};
    CAMPOS_IMPORTAVEIS.forEach(k => {
      if(k === "componentes" || k === "provisorio" || k === "fotos") return;
      limpo[k] = String(bruto[k] == null ? "" : bruto[k]).trim();
    });
    limpo.provisorio = bruto.provisorio === true;
    limpo.fotos = fotos;
    limpo.componentes = comps.map(c => {
      const x = componenteVazio();
      CAMPOS_COMPONENTE_IMP.forEach(k => { x[k] = String((c && c[k]) || "").trim(); });
      return x;
    }).filter(componentePreenchido);

    limpo.jaExiste = codigosExistentes.indexOf(chave) >= 0;

    /* Três coisas diferentes podem estar na lista, e a tela tem de dizer
       qual é qual antes de gravar:
         novo       — equipamento que ainda não existe, entra inteiro
         sofotos    — já cadastrado, e a linha só traz fotos: acrescenta
         jatem      — já cadastrado e nada a fazer; não se mexe
       Sem esta distinção, quem já cadastrou tudo à mão e só quer pôr as
       fotos via a lista inteira ser ignorada, sem explicação. */
    const soTrazFotos = limpo.fotos.length > 0 &&
      !CAMPOS_IMPORTAVEIS.some(k =>
        k !== "codigo" && k !== "fotos" && k !== "thumb" && k !== "provisorio" &&
        (k === "componentes" ? limpo.componentes.length : limpo[k]));

    /* Uma linha que só traz fotos é para juntar a um equipamento que já
       existe. Se o número não casar com nenhum, é engano de número — e
       criar a máquina na mesma faria nascer uma chopeira em branco, sem
       marca nem compressor, só com as fotos penduradas. Avisa e não
       grava. */
    limpo.acao = soTrazFotos
      ? (limpo.jaExiste ? "sofotos" : "naoachei")
      : (limpo.jaExiste ? "jatem" : "novo");
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
  const novos = lido ? lido.equipamentos.filter(e => e.acao === "novo") : [];
  const naoAchei = lido ? lido.equipamentos.filter(e => e.acao === "naoachei") : [];
  const comFotos = lido ? lido.equipamentos.filter(e => e.acao === "sofotos") : [];
  const repetidos = lido ? lido.equipamentos.filter(e => e.acao === "jatem") : [];
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

    (lido ? resultadoDaConferencia(lido, novos, comFotos, repetidos, naoAchei, empresa) : "");
}

function resultadoDaConferencia(lido, novos, comFotos, repetidos, naoAchei, empresa){
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
  const nFotos = comFotos.reduce((t, e) => t + e.fotos.length, 0) +
                 novos.reduce((t, e) => t + e.fotos.length, 0);
  const plural = (n, um, muitos) => n === 1 ? um : muitos;

  return '<div class="card">' +
    '<h3>O que vai acontecer</h3>' +
    '<div class="alert yel" style="text-align:left">' +
      (novos.length
        ? '<b>' + novos.length + ' equipamento' + plural(novos.length, '', 's') + '</b> ' +
          plural(novos.length, 'entra', 'entram') +
          (empresa ? ' em <b>' + esc(empresa.nomeFantasia || empresa.razaoSocial) + '</b>' : '') + '.<br>'
        : '') +
      (comFotos.length
        ? '<b>' + comFotos.length + ' já cadastrado' + plural(comFotos.length, '', 's') + '</b> ' +
          plural(comFotos.length, 'recebe', 'recebem') + ' foto. Só as fotos entram — ' +
          'nada do que você já preencheu é mexido.<br>'
        : '') +
      (nFotos ? '<b>' + nFotos + ' foto' + plural(nFotos, '', 's') + '</b> no total.<br>' : '') +
      (repetidos.length
        ? repetidos.length + ' já ' + plural(repetidos.length, 'está', 'estão') +
          ' cadastrado' + plural(repetidos.length, '', 's') + ' e ' +
          plural(repetidos.length, 'fica', 'ficam') + ' como ' +
          plural(repetidos.length, 'está', 'estão') + '.'
        : '') +
      (!novos.length && !comFotos.length ? '<b>Não há nada a fazer com esta lista.</b>' : '') +
    '</div>' +

    (novos.length ? '<h3>Entram novos</h3><div class="tabelinha">' +
      novos.map(linhaConferencia).join("") + '</div>' : '') +
    (comFotos.length ? '<h3>Recebem fotos</h3><div class="tabelinha">' +
      comFotos.map(linhaConferencia).join("") + '</div>' : '') +
    (repetidos.length
      ? '<h3>Já cadastrados, não mexo</h3><div class="esc">' +
        repetidos.map(e => esc(e.codigo)).join(" · ") + '</div>'
      : '') +
    (naoAchei.length
      ? '<h3>Não achei estes números</h3>' +
        '<div class="alert red" style="text-align:left">' +
          'Estas linhas só trazem fotos, e o número delas não bate com nenhum equipamento ' +
          'cadastrado: <b>' + naoAchei.map(e => esc(e.codigo)).join(" · ") + '</b>.<br>' +
          'As fotos destas não entram. Confira o número da etiqueta no cadastro e corrija a ' +
          'lista — se eu cadastrasse na mesma, nasceria uma chopeira em branco só com fotos.' +
        '</div>'
      : '') +

    '<div class="btns" style="margin-top:14px">' +
      ((novos.length || comFotos.length) && !(semEmpresa && novos.length)
        ? '<button class="btn pri" id="btImportarEq" onclick="gravarLista()">' +
          (novos.length && comFotos.length
            ? 'Cadastrar ' + novos.length + ' e acrescentar fotos a ' + comFotos.length
            : novos.length
              ? 'Cadastrar ' + novos.length + ' equipamento' + plural(novos.length, '', 's')
              : 'Acrescentar ' + nFotos + ' foto' + plural(nFotos, '', 's')) +
          '</button>'
        : '') +
      '<button class="btn" onclick="editando=null;telaChopeiras()">Sair sem gravar</button>' +
    '</div>' +
    (semEmpresa && novos.length
      ? '<div class="alert red" style="margin-top:10px">Escolha a empresa antes de cadastrar ' +
        'equipamento novo. Para só acrescentar fotos, a empresa não é precisa.</div>' : '') +
  '</div>';
}

function linhaConferencia(e){
  const ficha = (e.componentes || []).length;
  const nf = (e.fotos || []).length;
  const umaFoto = nf === 1 ? "1 foto" : nf + " fotos";

  /* Uma linha que só traz fotos não descreve a máquina — descreve o que
     vai ser acrescentado a ela. Mostrar aqui "compressor não
     identificado" faria parecer que o cadastro ia ficar pior do que
     está, quando nada do cadastro é tocado. */
  if(e.acao === "sofotos" || e.acao === "naoachei"){
    return '<div class="reg"><div class="top"><div style="min-width:0">' +
      '<div class="nm">' + esc(e.codigo) + '</div>' +
      '<div class="dt">' + (e.acao === "naoachei"
        ? 'não há equipamento com este número' : 'só fotos — o cadastro não é tocado') + '</div>' +
      '</div>' +
      '<div class="dt" style="text-align:right;flex:0 0 auto">' + umaFoto + '</div>' +
    '</div></div>';
  }

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
      (nf ? umaFoto + '<br>' : '') +
      (ficha ? ficha + ' na ficha' : '') + '</div>' +
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

/* Guarda as fotos de um equipamento e devolve os ids. Cada foto é um
   documento à parte, como já era a foto única: assim a lista de
   chopeiras abre sem carregar imagem nenhuma. */
async function guardarFotos(fotos, clienteId){
  const ids = [];
  for(const dataUrl of fotos){
    const ref = await db.collection("fotos").add({
      dataUrl: dataUrl,
      clienteId: clienteId || null,
      de: "chopeira",
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    ids.push(ref.id);
  }
  return ids;
}

async function gravarLista(){
  const d = editando.dados;
  if(!d.lido || d.lido.problemas.length) return toast("Confira a lista primeiro.", "err");

  const novos = d.lido.equipamentos.filter(e => e.acao === "novo");
  const comFotos = d.lido.equipamentos.filter(e => e.acao === "sofotos");
  if(novos.length && !d.clienteId) return toast("Escolha a empresa.", "err");
  if(!novos.length && !comFotos.length) return toast("Não há nada a fazer.", "ok");

  const bt = $("btImportarEq");
  if(bt){ bt.disabled = true; bt.textContent = "Gravando…"; }

  let feitos = 0, fotosFeitas = 0;
  try{
    for(const e of novos){
      const ids = await guardarFotos(e.fotos, d.clienteId);
      fotosFeitas += ids.length;
      await db.collection("chopeiras").add({
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
        thumb: e.thumb || null,
        fotoId: ids[0] || null,
        fotos: ids,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
      feitos++;
    }

    /* Acrescentar, nunca substituir: quem já tinha posto uma foto à mão
       não a perde por importar as do documento. */
    for(const e of comFotos){
      const alvo = CHOPEIRAS.find(c =>
        String(c.codigo || "").toLowerCase() === e.codigo.toLowerCase());
      if(!alvo) continue;
      const ids = await guardarFotos(e.fotos, alvo.clienteId || d.clienteId);
      fotosFeitas += ids.length;
      const antigas = (Array.isArray(alvo.fotos) && alvo.fotos.length)
        ? alvo.fotos : (alvo.fotoId ? [alvo.fotoId] : []);
      const todas = antigas.concat(ids);
      const mudanca = {fotos: todas, fotoId: todas[0] || null};
      if(!alvo.thumb && e.thumb) mudanca.thumb = e.thumb;
      await db.collection("chopeiras").doc(alvo.id).update(mudanca);
      feitos++;
    }

    editando = null;
    await recarregar();
    irPara("chopeiras");
    toast(feitos + " equipamento" + (feitos === 1 ? "" : "s") + " e " +
          fotosFeitas + " foto" + (fotosFeitas === 1 ? "" : "s") + " no cadastro.", "ok");
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
