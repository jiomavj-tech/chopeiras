/* ═══════════════════════════════════════════════════════════════════
   CHOPEIRAS

   Equipamentos: cadastro e ficha técnica dos componentes

   Script clássico, não módulo: o aplicativo tem 147 handlers escritos
   no próprio HTML (onclick="salvarCliente()"), e módulo tem escopo
   próprio — todos parariam de funcionar de uma vez. A ordem de
   carregamento está no index.html.
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════ CHOPEIRAS ═══════════════════ */
const TIPOS = ["Direta", "Banco de gelo", "Portátil", "Outra"];
const APLICACOES = ["LBP", "MBP", "HBP", "não sei"];

function telaChopeiras(){
  if(editando && editando.tipo === "chopeira") return formChopeira();
  if(editando && editando.tipo === "verChopeira") return verChopeira();
  if(editando && editando.tipo === "componentes") return formComponentes();

  if(!EU.admin && !EU.clienteId){
    $("tela").innerHTML = '<div class="alert yel"><b>Seu acesso ainda não está ligado a uma empresa.</b> ' +
      'Fale com o Giba para ligar o seu e-mail ao cadastro da sua empresa.</div>';
    return;
  }

  const busca = (window.__buscaCho || "").toLowerCase();
  const lista = CHOPEIRAS.filter(c=>{
    if(!busca) return true;
    return [c.codigo, c.marca, c.modelo, c.local, EU.admin ? nomeCliente(c.clienteId) : ""]
      .map(x => x || "").join(" ").toLowerCase().includes(busca);
  });

  $("tela").innerHTML =
    (EU.admin ? '<div class="btns" style="margin:0 0 12px">' +
      '<button class="btn pri" onclick="novaChopeira()">+ Nova chopeira</button>' +
      '<button class="btn" onclick="atualizar()">Atualizar</button></div>' : '') +
    '<div class="busca"><input placeholder="Buscar pelo número, marca ou local" value="'+esc(window.__buscaCho||"")+
      '" oninput="window.__buscaCho=this.value;telaChopeiras()"></div>' +
    (lista.length ? lista.map(cartaoChopeira).join("") :
      '<div class="vazio">' + (CHOPEIRAS.length ? "Nada encontrado." :
        (EU.admin ? "Nenhuma chopeira cadastrada ainda." :
          "Nenhuma chopeira cadastrada na sua empresa ainda.")) + '</div>');
}

function cartaoChopeira(c){
  return '<div class="reg"><div class="top">' +
    '<div style="display:flex;gap:11px;min-width:0">' +
      (c.thumb ? '<img class="th" src="'+esc(c.thumb)+'" alt="">' : '') +
      '<div style="min-width:0">' +
        '<div class="nm mono">'+esc(c.codigo || "sem número")+'</div>' +
        '<div class="dt">'+esc([c.marca, c.modelo].filter(Boolean).join(" ") || "sem marca")+'</div>' +
        (EU.admin ? '<div class="dt">'+esc(nomeCliente(c.clienteId))+'</div>' : '') +
        (c.local ? '<div class="dt">'+esc(c.local)+'</div>' : '') +
      '</div>' +
    '</div>' +
    '<button class="btn sm" onclick="verChopeiraId(\''+c.id+'\')">Abrir</button>' +
  '</div>' +
  '<div style="margin-top:9px;display:flex;gap:6px;flex-wrap:wrap">' +
    (c.tipo ? '<span class="pill">'+esc(c.tipo)+'</span>' : '') +
    (c.torneiras ? '<span class="pill">'+esc(c.torneiras)+' torneira'+(Number(c.torneiras)===1?"":"s")+'</span>' : '') +
    (c.compressorGas ? '<span class="pill cold">'+esc(c.compressorGas)+'</span>' : '') +
    (c.provisorio ? '<span class="pill pend">ficha por completar</span>' : '') +
  '</div></div>';
}

function verChopeiraId(id){
  const c = CHOPEIRAS.find(x=>x.id === id);
  if(!c) return;
  editando = {tipo:"verChopeira", id:id, dados:c, foto:null};
  telaChopeiras();
  if(c.fotoId) carregarFoto(c.fotoId);
}

async function carregarFoto(fotoId){
  try{
    const s = await db.collection("fotos").doc(fotoId).get();
    if(s.exists && editando && editando.tipo === "verChopeira"){
      const img = $("fotoGrande");
      if(img){ img.src = s.data().dataUrl; img.style.display = "block"; }
    }
  }catch(e){ /* sem foto, a tela vive sem ela */ }
}

/* ═══════════════════ FICHA TÉCNICA DA CHOPEIRA ═══════════════════
   O que a máquina tem, peça por peça, com número de série.

   São três coisas diferentes, e é de propósito:
     · componentes    — o que ela tem HOJE
     · fichaOriginal  — como ela chegou da primeira vez, congelada
     · trocas         — o que mudou, quando e em que chamado

   Assim, quando a máquina volta, dá para dizer o que era original e o
   que já foi substituído — sem depender da memória de ninguém.        */

const TIPOS_COMPONENTE = [
  "Compressor",
  "Pressostato de baixa (KP1)",
  "Pressostato de alta (cartucho)",
  "Micromotor / ventilador",
  "Válvula solenoide",
  "Relé de partida",
  "Capacitor de partida",
  "Capacitor permanente",
  "Protetor térmico",
  "Bomba de recirculação",
  "Filtro secador",
  "Serpentina / banho",
  "Torneira",
  "Painel / controlador",
  "Gás refrigerante",
  "Outro"
];

const CAMPOS_COMPONENTE = [
  ["tipo",  "Componente"],
  ["marca", "Marca"],
  ["modelo","Modelo"],
  ["serie", "Número de série"],
  ["spec",  "Especificação"],
  ["obs",   "Observação"]
];


/* Só o que a pessoa preencheu conta como componente. */


/* Duas fichas são a mesma peça se o tipo bate. */

function editarComponentes(id){
  const c = CHOPEIRAS.find(x => x.id === id);
  if(!c) return;
  const itens = (c.componentes || []).map(x => Object.assign(componenteVazio(), x));
  if(!itens.length) itens.push(componenteVazio());
  editando = {tipo:"componentes", id:id, dados:JSON.parse(JSON.stringify(c)), itens:itens};
  telaChopeiras();
}

function formComponentes(){
  const c = editando.dados;
  const jaTemFicha = !!(c.fichaOriginal && (c.fichaOriginal.itens || []).length);

  $("tela").innerHTML =
    '<div class="card">' +
      '<div class="brand" style="letter-spacing:2px">Ficha técnica</div>' +
      '<h2 class="mono" style="font-size:20px">' + esc(c.codigo || "sem número") + '</h2>' +
      '<div class="muted">' +
        (jaTemFicha
          ? 'A ficha original já está congelada. O que você mudar aqui entra como ' +
            '<b>troca</b>, com data — a original continua guardada para comparação.'
          : 'Esta é a primeira ficha desta máquina. Ao salvar, ela fica guardada como ' +
            '<b>ficha original</b>: é o retrato de como a chopeira chegou.') +
      '</div>' +
      '<div id="listaComp"></div>' +
      '<div class="btns">' +
        '<button class="btn" onclick="addComponente()">+ Componente</button>' +
      '</div>' +
      '<h3>Chamado (opcional)</h3>' +
      '<label>Ligar estas trocas a um chamado</label>' +
      '<select id="comp_ordem">' +
        '<option value="">— nenhum —</option>' +
        ORDENS.filter(o => o.chopeiraId === c.id).map(o =>
          '<option value="' + esc(o.id) + '">' + esc((o.numero || o.id.slice(0,5)) + " · " +
            (status(o.status) || {}).rot) + '</option>').join("") +
      '</select>' +
      '<div class="btns">' +
        '<button class="btn pri" id="btComp" onclick="salvarComponentes()">Salvar ficha</button>' +
        '<button class="btn" onclick="verChopeiraId(\'' + esc(c.id) + '\')">Cancelar</button>' +
      '</div>' +
    '</div>';
  desenharComponentes();
}

function desenharComponentes(){
  $("listaComp").innerHTML = editando.itens.map((x, i) =>
    '<div class="itemOrc">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
        '<b style="font-size:12px;color:var(--copperhi)">' + (i+1) + '</b>' +
        '<button class="btn sm dg" onclick="tirarComponente(' + i + ')">Tirar</button>' +
      '</div>' +
      '<label>Componente</label>' +
      '<select onchange="mudarComponente(' + i + ',\'tipo\',this.value)">' +
        '<option value="">— escolha —</option>' +
        TIPOS_COMPONENTE.map(t => '<option value="' + esc(t) + '"' +
          (x.tipo === t ? " selected" : "") + '>' + esc(t) + '</option>').join("") +
      '</select>' +
      '<div class="lin">' +
        '<div><label>Marca</label><input value="' + esc(x.marca) +
          '" oninput="mudarComponente(' + i + ',\'marca\',this.value)"></div>' +
        '<div><label>Modelo</label><input value="' + esc(x.modelo) +
          '" oninput="mudarComponente(' + i + ',\'modelo\',this.value)"></div>' +
      '</div>' +
      '<div class="lin">' +
        '<div><label>Número de série</label><input value="' + esc(x.serie) +
          '" oninput="mudarComponente(' + i + ',\'serie\',this.value)"></div>' +
        '<div><label>Especificação</label><input placeholder="1/3 HP, R290, 220 V…" value="' +
          esc(x.spec) + '" oninput="mudarComponente(' + i + ',\'spec\',this.value)"></div>' +
      '</div>' +
      '<label>Observação</label>' +
      '<input value="' + esc(x.obs) + '" oninput="mudarComponente(' + i + ',\'obs\',this.value)">' +
    '</div>').join("");
}

function addComponente(){
  editando.itens.push(componenteVazio());
  desenharComponentes();
  window.scrollTo(0, document.body.scrollHeight);
}
function mudarComponente(i, campo, v){
  if(editando.itens[i]) editando.itens[i][campo] = v;
}
function tirarComponente(i){
  editando.itens.splice(i, 1);
  if(!editando.itens.length) editando.itens.push(componenteVazio());
  desenharComponentes();
}

async function salvarComponentes(){
  const c = editando.dados;
  const novos = editando.itens.filter(componentePreenchido)
    .map(x => ({tipo:(x.tipo||"").trim(), marca:(x.marca||"").trim(),
                modelo:(x.modelo||"").trim(), serie:(x.serie||"").trim(),
                spec:(x.spec||"").trim(), obs:(x.obs||"").trim()}));

  const semTipo = novos.find(x => !x.tipo);
  if(semTipo) return toast("Escolha o componente em cada linha preenchida.", "err");

  const antigos = c.componentes || [];
  const ordemId = ($("comp_ordem") || {}).value || "";
  const agora = new Date().toISOString();

  /* O que mudou de uma ficha para a outra vira troca registada. */
  const trocas = [];
  novos.forEach(n => {
    const a = acharPorTipo(antigos, n.tipo);
    const de = a ? resumoComponente(a) : "";
    const para = resumoComponente(n);
    if(de !== para){
      trocas.push({quando:agora, quem:EU.nome || EU.email || "Giba", ordemId:ordemId,
                   tipo:n.tipo, antes:de || "(não constava)", depois:para});
    }
  });
  antigos.forEach(a => {
    if(!acharPorTipo(novos, a.tipo)){
      trocas.push({quando:agora, quem:EU.nome || EU.email || "Giba", ordemId:ordemId,
                   tipo:a.tipo, antes:resumoComponente(a), depois:"(retirado)"});
    }
  });

  const mudanca = {componentes: novos};

  /* A ficha original congela na primeira vez, e só nela. */
  if(!(c.fichaOriginal && (c.fichaOriginal.itens || []).length) && novos.length){
    mudanca.fichaOriginal = {quando:agora, quem:EU.nome || EU.email || "Giba", itens:novos};
  } else if(trocas.length){
    mudanca.trocas = (c.trocas || []).concat(trocas);
  }

  $("btComp").disabled = true;
  try{
    await db.collection("chopeiras").doc(editando.id).update(mudanca);
    Object.assign(c, mudanca);
    const naLista = CHOPEIRAS.find(x => x.id === editando.id);
    if(naLista) Object.assign(naLista, mudanca);
    verChopeiraId(editando.id);
    toast(mudanca.fichaOriginal ? "Ficha original guardada."
          : (trocas.length ? trocas.length + " troca" + (trocas.length===1?"":"s") + " registada" +
             (trocas.length===1?"":"s") + "." : "Ficha salva."), "ok");
  }catch(e){
    toast("Não deu para salvar: " + (e.message || e), "err");
    const b = $("btComp"); if(b) b.disabled = false;
  }
}

/* O bloco que aparece na ficha da chopeira. */
function blocoFicha(c){
  const atuais = c.componentes || [];
  const orig = (c.fichaOriginal && c.fichaOriginal.itens) || [];
  const trocas = c.trocas || [];

  if(!atuais.length && !orig.length){
    return '<h3>Ficha técnica</h3>' +
      '<div class="muted">Ainda sem componentes registados. É aqui que entra o que a ' +
        'máquina tem — compressor, pressostato, capacitores, número de série.</div>' +
      (EU.admin ? '<div class="btns"><button class="btn" onclick="editarComponentes(\'' +
        esc(c.id) + '\')">Registrar componentes</button></div>' : '');
  }

  const linhas = atuais.map(x => {
    const o = acharPorTipo(orig, x.tipo);
    const mudou = o && resumoComponente(o) !== resumoComponente(x);
    return '<div class="itemOrc">' +
      '<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">' +
        '<b>' + esc(x.tipo) + '</b>' +
        (mudou ? '<span class="pill pend">trocado</span>'
               : (o ? '<span class="pill ok">original</span>' : '<span class="pill">acrescentado</span>')) +
      '</div>' +
      '<div style="margin-top:3px">' + esc(resumoComponente(x)) + '</div>' +
      (mudou ? '<div class="esc">era: ' + esc(resumoComponente(o)) + '</div>' : '') +
      (x.obs ? '<div class="esc">' + esc(x.obs) + '</div>' : '') +
    '</div>';
  }).join("");

  const sumiram = orig.filter(o => !acharPorTipo(atuais, o.tipo)).map(o =>
    '<div class="itemOrc">' +
      '<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">' +
        '<b>' + esc(o.tipo) + '</b><span class="pill dg">retirado</span></div>' +
      '<div class="esc">era: ' + esc(resumoComponente(o)) + '</div>' +
    '</div>').join("");

  return '<h3>Ficha técnica</h3>' +
    (c.fichaOriginal ? '<div class="esc">Ficha original de ' +
      esc(dataCurta(String(c.fichaOriginal.quando).slice(0,10))) + '.</div>' : '') +
    linhas + sumiram +
    (EU.admin ? '<div class="btns"><button class="btn" onclick="editarComponentes(\'' +
      esc(c.id) + '\')">Editar ficha</button></div>' : '') +
    (trocas.length ?
      '<h3>Trocas</h3>' + trocas.slice().reverse().map(t =>
        '<div class="itemOrc">' +
          '<div class="esc">' + esc(dataCurta(String(t.quando).slice(0,10))) + ' · ' + esc(t.quem) + '</div>' +
          '<b>' + esc(t.tipo) + '</b>' +
          '<div style="font-size:13px">' + esc(t.antes) + ' → <b>' + esc(t.depois) + '</b></div>' +
        '</div>').join("")
      : "");
}

function verChopeira(){
  const c = editando.dados;
  const linha = (r, v) => v ? '<tr><td class="muted" style="padding:6px 10px 6px 0;white-space:nowrap">'+
    esc(r)+'</td><td style="padding:6px 0;font-weight:700">'+esc(v)+'</td></tr>' : '';
  $("tela").innerHTML =
    '<div class="card">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">' +
        '<div><div class="brand" style="letter-spacing:2px">Chopeira</div>' +
        '<h2 class="mono" style="font-size:22px">'+esc(c.codigo||"sem número")+'</h2></div>' +
        (EU.admin ? '<button class="btn sm" onclick="editarChopeira(\''+c.id+'\')">Editar</button>' : '') +
      '</div>' +
      (c.fotoId ? '<img id="fotoGrande" class="foto" style="display:none" alt="Foto da chopeira">' :
        (c.thumb ? '<img class="foto" src="'+esc(c.thumb)+'" alt="Foto da chopeira">' : '')) +
      '<h3>Equipamento</h3><table style="width:100%">' +
        linha("Marca", c.marca) + linha("Modelo", c.modelo) + linha("Tipo", c.tipo) +
        linha("Torneiras", c.torneiras) + linha("Local", c.local) +
        (EU.admin ? linha("Cliente", nomeCliente(c.clienteId)) : "") +
      '</table>' +
      ((c.compressorMarca || c.compressorModelo || c.compressorGas || c.compressorHp) ?
        '<h3>Compressor</h3><table style="width:100%">' +
          linha("Marca", c.compressorMarca) + linha("Modelo", c.compressorModelo) +
          linha("Potência", c.compressorHp) + linha("Gás", c.compressorGas) +
          linha("Aplicação", c.compressorAplicacao) +
        '</table>' : '') +
      blocoFicha(c) +
      (c.observacoes ? '<h3>Observações</h3><div class="muted" style="white-space:pre-wrap">'+
        esc(c.observacoes)+'</div>' : '') +
      '<div class="btns">' +
        (ordensDaChopeira(c.id).length
          ? '<button class="btn pri" onclick="baixarRelatorio(\'' + esc(c.id) +
            '\')">Relatório de manutenção</button>' : '') +
        '<button class="btn" onclick="irPara(\'chopeiras\')">Voltar</button>' +
      '</div>' +
    '</div>';
}

function novaChopeira(){
  editando = {tipo:"chopeira", id:null, novaFoto:null, dados:{
    codigo:"", clienteId: CLIENTES.length === 1 ? CLIENTES[0].id : "", local:"",
    marca:"", modelo:"", torneiras:"", tipo:"",
    compressorMarca:"", compressorModelo:"", compressorHp:"", compressorGas:"", compressorAplicacao:"",
    observacoes:"", fotoId:null, thumb:null
  }};
  telaChopeiras();
}
function editarChopeira(id){
  const c = CHOPEIRAS.find(x=>x.id === id);
  if(!c) return;
  editando = {tipo:"chopeira", id:id, novaFoto:null, dados:JSON.parse(JSON.stringify(c))};
  telaChopeiras();
}

function formChopeira(){
  const d = editando.dados;
  const opcoes = (lista, sel) => lista.map(o =>
    '<option value="'+esc(o)+'"'+(o === sel ? " selected":"")+'>'+esc(o)+'</option>').join("");
  $("tela").innerHTML =
    '<div class="card">' +
      '<h2>'+(editando.id ? "Editar chopeira" : "Nova chopeira")+'</h2>' +
      '<div class="muted">O número é a etiqueta do equipamento — é por ele que se busca na hora do chamado.</div>' +

      '<h3>Identificação</h3>' +
      '<label>Número / código</label><input id="c_codigo" value="'+esc(d.codigo)+'">' +
      '<label>Empresa dona</label>' +
      '<select id="c_cliente"><option value="">— escolha —</option>' +
        CLIENTES.map(c=>'<option value="'+c.id+'"'+(c.id===d.clienteId?" selected":"")+'>'+
          esc(c.nomeFantasia || c.razaoSocial)+'</option>').join("") +
      '</select>' +
      '<label>Local de instalação</label>' +
      '<input id="c_local" placeholder="salão, depósito, balcão da frente" value="'+esc(d.local)+'">' +

      '<h3>A chopeira</h3>' +
      '<div class="lin">' +
        '<div><label>Marca</label><input id="c_marca" value="'+esc(d.marca)+'"></div>' +
        '<div><label>Modelo</label><input id="c_modelo" value="'+esc(d.modelo)+'"></div>' +
      '</div>' +
      '<div class="lin">' +
        '<div><label>Tipo</label><select id="c_tipo"><option value="">—</option>'+opcoes(TIPOS, d.tipo)+'</select></div>' +
        '<div><label>Torneiras</label><input id="c_torneiras" inputmode="numeric" value="'+esc(d.torneiras)+'"></div>' +
      '</div>' +

      '<h3>Compressor</h3>' +
      '<div class="lin">' +
        '<div><label>Marca</label><input id="c_cmarca" value="'+esc(d.compressorMarca)+'"></div>' +
        '<div><label>Modelo</label><input id="c_cmodelo" value="'+esc(d.compressorModelo)+'"></div>' +
      '</div>' +
      '<div class="lin">' +
        '<div><label>Potência</label><input id="c_chp" placeholder="1/3 HP" value="'+esc(d.compressorHp)+'"></div>' +
        '<div><label>Gás</label><input id="c_cgas" placeholder="R134a" value="'+esc(d.compressorGas)+'"></div>' +
        '<div><label>Aplicação</label><select id="c_capl"><option value="">—</option>'+
          opcoes(APLICACOES, d.compressorAplicacao)+'</select></div>' +
      '</div>' +
      '<div class="esc">Só o que estiver na plaqueta. O que não souber, deixe em branco — ' +
        'chute em ficha técnica atrapalha na hora do conserto.</div>' +

      '<h3>Foto</h3>' +
      '<input type="file" accept="image/*" capture="environment" onchange="pegarFoto(this)">' +
      '<img id="previa" class="foto" style="display:'+(d.thumb?"block":"none")+'" ' +
        'src="'+esc(d.thumb||"")+'" alt="">' +
      '<div class="esc">A foto é reduzida no aparelho antes de subir — ninguém precisa de 4 MB para ' +
        'reconhecer uma chopeira.</div>' +

      '<h3>Observações</h3>' +
      '<textarea id="c_obs">'+esc(d.observacoes||"")+'</textarea>' +

      '<div class="btns">' +
        '<button class="btn pri" id="btSalvarCho" onclick="salvarChopeira()">Salvar</button>' +
        '<button class="btn" onclick="irPara(\'chopeiras\')">Cancelar</button>' +
        (editando.id ? '<button class="btn dg" onclick="apagarChopeira()">Apagar</button>' : '') +
      '</div>' +
    '</div>';

  /* a miniatura esticada fica borrada: busca a foto inteira para a prévia */
  if(d.fotoId && !editando.novaFoto){
    db.collection("fotos").doc(d.fotoId).get().then(s=>{
      const p = $("previa");
      if(s.exists && p && editando && editando.tipo === "chopeira"){
        p.src = s.data().dataUrl; p.style.display = "block";
      }
    }).catch(()=>{});
  }
}

async function pegarFoto(input){
  const f = input.files && input.files[0];
  if(!f) return;
  try{
    toast("Preparando a foto…");
    const grande = await reduzirImagem(f, 1280, 0.72);
    const thumb  = await reduzirImagem(f, 200, 0.6);
    editando.novaFoto = grande;
    editando.dados.thumb = thumb;
    const p = $("previa");
    p.src = grande; p.style.display = "block";
    toast("Foto pronta.", "ok");
  }catch(e){
    toast("Não deu para usar essa imagem.", "err");
  }
}

async function salvarChopeira(){
  const d = {
    codigo: $("c_codigo").value.trim(),
    clienteId: $("c_cliente").value,
    local: $("c_local").value.trim(),
    marca: $("c_marca").value.trim(),
    modelo: $("c_modelo").value.trim(),
    tipo: $("c_tipo").value,
    torneiras: $("c_torneiras").value.trim(),
    compressorMarca: $("c_cmarca").value.trim(),
    compressorModelo: $("c_cmodelo").value.trim(),
    compressorHp: $("c_chp").value.trim(),
    compressorGas: $("c_cgas").value.trim(),
    compressorAplicacao: $("c_capl").value,
    observacoes: $("c_obs").value.trim(),
    provisorio: false,
    thumb: editando.dados.thumb || null,
    fotoId: editando.dados.fotoId || null
  };
  if(!d.codigo)    return toast("Falta o número da chopeira.", "err");
  if(!d.clienteId) return toast("Escolha de qual empresa é.", "err");

  const repetida = CHOPEIRAS.find(c =>
    String(c.codigo || "").toLowerCase() === d.codigo.toLowerCase() && c.id !== editando.id);
  if(repetida) return toast("Já existe uma chopeira com este número.", "err");

  $("btSalvarCho").disabled = true;
  try{
    if(editando.novaFoto){
      const ref = await db.collection("fotos").add({
        dataUrl: editando.novaFoto,
        clienteId: d.clienteId,
        de: "chopeira",
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
      const antiga = d.fotoId;
      d.fotoId = ref.id;
      if(antiga) db.collection("fotos").doc(antiga).delete().catch(()=>{});
    }
    if(editando.id){
      await db.collection("chopeiras").doc(editando.id).update(d);
    } else {
      d.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("chopeiras").add(d);
    }
    await recarregar();
    irPara("chopeiras");
    toast("Chopeira salva.", "ok");
  }catch(e){
    toast("Não deu para salvar: " + (e.message || e), "err");
    const b = $("btSalvarCho"); if(b) b.disabled = false;
  }
}

async function apagarChopeira(){
  if(!confirm("Apagar esta chopeira? Não dá para desfazer.")) return;
  try{
    const f = editando.dados.fotoId;
    if(f) db.collection("fotos").doc(f).delete().catch(()=>{});
    await db.collection("chopeiras").doc(editando.id).delete();
    await recarregar();
    irPara("chopeiras");
    toast("Chopeira apagada.", "ok");
  }catch(e){
    toast("Não deu para apagar: " + (e.message || e), "err");
  }
}
