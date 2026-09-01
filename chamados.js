/* ═══════════════════════════════════════════════════════════════════
   CHAMADOS

   Ordens de serviço: abrir, mover, prazos e recados

   Script clássico, não módulo: o aplicativo tem 147 handlers escritos
   no próprio HTML (onclick="salvarCliente()"), e módulo tem escopo
   próprio — todos parariam de funcionar de uma vez. A ordem de
   carregamento está no index.html.
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
   CHAMADOS (ordens de serviço)

   O cliente abre; o Giba move o status; os dois veem a mesma linha do
   tempo. Cada mudança acende um aviso do outro lado — e, quando é o
   cliente que precisa saber, oferece a mensagem pronta no WhatsApp.
   ═══════════════════════════════════════════════════════════════════ */



/* Fluxo sugerido de status baseado na lógica do processo */


/* Numeração no mesmo esquema da OS: data mais sufixo. É de propósito
   não ser um contador sequencial — um contador precisaria de ir ao
   servidor buscar o último número, e sem rede daria dois laudos com o
   mesmo. Aqui cada aparelho gera sozinho, sem colidir. */


function quando(v){
  if(!v) return "";
  const d = v.toDate ? v.toDate() : new Date(v);
  if(isNaN(d)) return "";
  return d.toLocaleString("pt-BR", {day:"2-digit", month:"2-digit", year:"2-digit",
                                    hour:"2-digit", minute:"2-digit"});
}

/* ── o sino ───────────────────────────────────────────────────────── */
function naoLidas(){
  return ORDENS.filter(o => EU.admin ? o.naoLidoAdmin : o.naoLidoCliente).length;
}
function desenharSino(){
  const n = naoLidas(), s = $("sino");
  if(!s) return;
  s.innerHTML = n
    ? '<button class="btn sm" style="border-color:var(--copper);color:var(--copperhi);margin-top:8px" ' +
      'onclick="irPara(\'chamados\')">' + n + ' novidade' + (n===1?"":"s") + ' nos chamados</button>'
    : "";
}

/* ── lista ────────────────────────────────────────────────────────── */
/* ═══════════════════ PRAZOS E RECADOS ═══════════════════
   Duas coisas que o aplicativo tinha pela metade: o cliente nunca via a
   data do que estava combinado, e a validade do orçamento era uma frase
   sem consequência — dava para aprovar preço de três meses atrás.

   Aqui ficam as contas de prazo e o texto que o cliente lê. Um sítio só,
   para a tela e o WhatsApp dizerem a mesma coisa.                     */


/* Até quando o orçamento vale. "" se não há orçamento enviado. */


/* Há quantos dias o orçamento está à espera de resposta. */

/* Desde quando está no estado atual — serve para ver o que empacou. */

/* Data por extenso curta, do jeito que se fala: "26/08". */

/* O recado que o cliente lê — o texto do status, mais a data e o valor
   quando existem. É isto que responde "quando" e "quanto". */

/* O que o cliente precisa fazer agora, se precisar de alguma coisa. */

function telaChamados(){
  if(editando && editando.tipo === "novoChamado") return formChamado();
  if(editando && editando.tipo === "verOrdem")    return verOrdem();

  if(!EU.admin && !EU.clienteId){
    $("tela").innerHTML = '<div class="alert yel"><b>Seu acesso ainda não está ligado a uma empresa.</b> ' +
      'Fale com o Giba.</div>';
    return;
  }

  const soAbertos = window.__soAbertos !== false;
  const lista = ORDENS.filter(o => soAbertos ? ehAberto(o) : true);
  const fechados = ORDENS.length - ORDENS.filter(ehAberto).length;

  $("tela").innerHTML =
    '<div class="btns" style="margin:0 0 12px">' +
      (EU.admin
        ? '<button class="btn pri" onclick="novoChamado()">+ Abrir chamado</button>'
        : '<button class="btn pri" onclick="novoChamado()">Preciso de manutenção</button>') +
      '<button class="btn" onclick="atualizar()">Atualizar</button>' +
      (fechados ? '<button class="btn sm" onclick="window.__soAbertos=' + (soAbertos?'false':'true') +
        ';telaChamados()">' + (soAbertos ? "Ver encerrados ("+fechados+")" : "Ver só os abertos") +
        '</button>' : '') +
    '</div>' +
    (lista.length ? lista.map(cartaoOrdem).join("") :
      '<div class="vazio">' +
        (soAbertos && ORDENS.length ? "Nenhum chamado aberto." :
          (EU.admin ? "Nenhum chamado ainda." :
            "Nenhum chamado ainda. Quando uma chopeira der problema, abra por aqui.")) +
      '</div>');
}

function cartaoOrdem(o){
  const s = status(o.status);
  const novo = EU.admin ? o.naoLidoAdmin : o.naoLidoCliente;
  return '<div class="reg' + (novo ? " pend" : "") + '"><div class="top">' +
    '<div style="display:flex;gap:11px;min-width:0">' +
      (o.thumb ? '<img class="th" src="' + esc(o.thumb) + '" alt="">' : '') +
      '<div style="min-width:0">' +
        '<div class="nm mono">' + esc(o.chopeiraCodigo || "sem número") + '</div>' +
        (EU.admin ? '<div class="dt">' + esc(o.numero) + '</div>' +
                    '<div class="dt">' + esc(nomeCliente(o.clienteId)) + '</div>' : '') +
        '<div class="dt">' + esc(quando(o.abertoEm)) + '</div>' +
      '</div>' +
    '</div>' +
    '<button class="btn sm" onclick="abrirOrdem(\'' + o.id + '\')">Abrir</button>' +
  '</div>' +
  '<div style="margin-top:9px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
    '<span class="pill ' + s.pill + '">' + esc(s.rot) + '</span>' +
    (novo ? '<span class="pill pend">novidade</span>' : '') +
    (o.agenda && o.agenda.recolhaPrevista && ETAPAS.aBuscar.includes(o.status)
      ? '<span class="pill cold">buscar ' + esc(dataCurta(o.agenda.recolhaPrevista)) + '</span>' : '') +
    (o.agenda && o.agenda.entregaPrevista &&
     ETAPAS.aEntregar.includes(o.status)
      ? '<span class="pill cold">entregar ' + esc(dataCurta(o.agenda.entregaPrevista)) + '</span>' : '') +
    (orcamentoVencido(o) ? '<span class="pill dg">orçamento vencido</span>' : '') +
  '</div></div>';
}

/* ── abrir chamado (cliente) ──────────────────────────────────────── */
function novoChamado(){
  editando = {tipo:"novoChamado", chopeira:null, provisoria:false, fotos:[], thumb:null,
    /* O cliente só pode abrir para a empresa dele; o administrador
       escolhe, porque o chamado costuma chegar por telefone. */
    clienteId: EU.admin ? (CLIENTES.length === 1 ? CLIENTES[0].id : "") : EU.clienteId};
  telaChamados();
}

/* De quem é este chamado — a empresa escolhida, ou a de quem está a abrir. */
function empresaDoChamado(){
  return EU.admin ? (editando.clienteId || "") : EU.clienteId;
}

function trocarEmpresaChamado(v){
  editando.clienteId = v;
  editando.chopeira = null;
  editando.provisoria = false;
  formChamado();
}

function formChamado(){
  const e = editando;
  $("tela").innerHTML =
    '<div class="card">' +
      '<h2>' + (EU.admin ? "Abrir chamado" : "Preciso de manutenção") + '</h2>' +
      '<div class="muted">' + (EU.admin
        ? "Chamado que chegou por telefone ou na rua. Escolha a empresa e a chopeira."
        : "Diga qual chopeira é, mande uma foto e conte o que está acontecendo. " +
          "O Giba recebe na hora.") + '</div>' +

      (EU.admin ?
        '<h3>De quem é</h3>' +
        '<label>Empresa</label>' +
        '<select onchange="trocarEmpresaChamado(this.value)">' +
          '<option value="">— escolha —</option>' +
          CLIENTES.map(c => '<option value="' + esc(c.id) + '"' +
            (e.clienteId === c.id ? " selected" : "") + '>' +
            esc(c.nomeFantasia || c.razaoSocial || "sem nome") + '</option>').join("") +
        '</select>'
      : '') +

      '<h3>Qual chopeira</h3>' +

      /* Escolher da lista é melhor do que decorar a etiqueta: quem abre
         o chamado costuma estar à frente da máquina, não do cadastro. */
      listaChopeirasDoChamado() +

      '<label>' + (listaChopeirasDoChamado() ? "Ou digite o número da etiqueta"
                                             : "Número da etiqueta") + '</label>' +
      '<input id="ch_busca" placeholder="CH-014" value="' + esc(e.chopeira ? e.chopeira.codigo : (e.codigoLivre||"")) +
        '" oninput="acharChopeira(this.value)">' +
      '<div id="ch_achou"></div>' +

      '<h3>Foto</h3>' +
      '<input type="file" accept="image/*" capture="environment" onchange="fotoChamado(this)">' +
      '<div id="ch_fotos" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"></div>' +
      '<div class="esc">Até 3 fotos. Ajuda a saber o que levar antes de sair da oficina.</div>' +

      '<h3>O que está acontecendo</h3>' +
      '<textarea id="ch_problema" placeholder="O chope está saindo quente desde ontem de manhã." ' +
        'style="min-height:110px"></textarea>' +
      '<div class="btns" style="margin-top:8px">' +
        '<button class="btn" id="btDitar" aria-pressed="false" onclick="ditarProblema()">Ditar</button>' +
      '</div>' +
      '<div id="ouvindo" class="alert blu" hidden></div>' +
      '<div class="esc">O ditado usa o reconhecimento do navegador e precisa de internet no momento ' +
        'da fala. Sem sinal, escreva — ou use o microfone do próprio teclado.</div>' +

      '<div class="btns">' +
        '<button class="btn pri" id="btEnviar" onclick="enviarChamado()">Enviar chamado</button>' +
        '<button class="btn" onclick="pararDitado();irPara(\'chamados\')">Cancelar</button>' +
      '</div>' +
    '</div>';
  acharChopeira($("ch_busca").value);
  desenharFotosChamado();
}

function acharChopeira(v){
  const e = editando, alvo = $("ch_achou");
  const codigo = String(v||"").trim();
  e.codigoLivre = codigo;
  if(!codigo){ e.chopeira = null; e.provisoria = false; alvo.innerHTML = ""; return; }

  /* O administrador vê todas as chopeiras, mas o chamado é de uma
     empresa só: procurar fora dela daria um chamado ligado à errada. */
  const daEmpresa = CHOPEIRAS.filter(c =>
    !empresaDoChamado() || c.clienteId === empresaDoChamado());

  const achada = daEmpresa.find(c => String(c.codigo||"").toLowerCase() === codigo.toLowerCase());
  if(achada){
    e.chopeira = achada; e.provisoria = false;
    alvo.innerHTML = '<div class="alert grn"><b>' + esc(achada.codigo) + '</b> — ' +
      esc([achada.marca, achada.modelo].filter(Boolean).join(" ") || "sem marca cadastrada") +
      (achada.local ? ' · ' + esc(achada.local) : '') + '</div>';
    return;
  }

  const parecidas = daEmpresa.filter(c =>
    String(c.codigo||"").toLowerCase().includes(codigo.toLowerCase())).slice(0,4);
  e.chopeira = null; e.provisoria = true;
  alvo.innerHTML =
    '<div class="alert yel"><b>Não achei esse número no seu cadastro.</b> ' +
      'Pode enviar assim mesmo — a chopeira entra como <b>provisória</b> e o Giba completa a ficha depois.</div>' +
    (parecidas.length ? '<div class="esc">Você quis dizer: ' +
      parecidas.map(c => '<a href="#" onclick="usarChopeira(\'' + c.id +
        '\');return false;">' + esc(c.codigo) + '</a>').join(" · ") + '</div>' : '');
}
/* As chopeiras já cadastradas da empresa, para tocar em vez de digitar.
   Fica vazio enquanto não houver empresa escolhida — mostrar as de todas
   as empresas convidaria a abrir o chamado na errada. */
function listaChopeirasDoChamado(){
  const empresa = empresaDoChamado();
  if(!empresa) return "";
  const chs = CHOPEIRAS.filter(c => c.clienteId === empresa)
    .sort((a,b) => String(a.codigo||"").localeCompare(String(b.codigo||""), "pt-BR"));
  if(!chs.length) return "";

  const escolhida = editando.chopeira ? editando.chopeira.id : "";
  return '<div class="esc" style="margin-bottom:6px">' +
      (chs.length === 1 ? "A chopeira desta empresa:" : "As chopeiras desta empresa:") + '</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' +
      chs.map(c => '<button class="btn sm' + (c.id === escolhida ? " pri" : "") + '" ' +
        'onclick="usarChopeira(\'' + esc(c.id) + '\')">' +
        esc(c.codigo || "sem número") +
        (c.local ? ' <span style="font-weight:400;opacity:.75">· ' + esc(c.local) + '</span>' : '') +
        '</button>').join("") +
    '</div>';
}

function usarChopeira(id){
  const c = CHOPEIRAS.find(x => x.id === id);
  if(!c) return;
  editando.chopeira = c;
  editando.provisoria = false;
  editando.codigoLivre = c.codigo;
  formChamado();          /* repinta para marcar qual ficou escolhida */
}

async function fotoChamado(input){
  const f = input.files && input.files[0];
  input.value = "";
  if(!f) return;
  if(editando.fotos.length >= 3) return toast("Três fotos já dizem bastante.", "err");
  try{
    toast("Preparando a foto…");
    const grande = await reduzirImagem(f, 1280, 0.72);
    const th = await reduzirImagem(f, 200, 0.6);
    editando.fotos.push({grande:grande, thumb:th});
    if(!editando.thumb) editando.thumb = th;
    desenharFotosChamado();
    toast("Foto pronta.", "ok");
  }catch(e){ toast("Não deu para usar essa imagem.", "err"); }
}
function desenharFotosChamado(){
  const alvo = $("ch_fotos");
  if(!alvo) return;
  alvo.innerHTML = editando.fotos.map((f,i) =>
    '<div style="position:relative">' +
      '<img class="th" style="width:78px;height:78px" src="' + esc(f.thumb) + '" alt="">' +
      '<button class="btn sm" style="position:absolute;top:-6px;right:-6px;padding:2px 8px;' +
        'border-radius:20px" onclick="tirarFoto(' + i + ')">×</button>' +
    '</div>').join("");
}
function tirarFoto(i){
  editando.fotos.splice(i,1);
  editando.thumb = editando.fotos.length ? editando.fotos[0].thumb : null;
  desenharFotosChamado();
}

async function enviarChamado(){
  pararDitado();
  const e = editando;
  const codigo = String($("ch_busca").value || "").trim();
  const problema = $("ch_problema").value.trim();
  const clienteId = empresaDoChamado();
  if(!clienteId) return toast("Escolha de qual empresa é o chamado.", "err");
  if(!codigo)   return toast("Falta o número da chopeira.", "err");
  if(!problema) return toast("Conte o que está acontecendo.", "err");

  $("btEnviar").disabled = true;
  try{
    let chopeiraId = e.chopeira ? e.chopeira.id : null;

    /* Chopeira que o cliente não tinha cadastrada entra provisória: o
       chamado não pode esperar o cadastro ficar perfeito. */
    if(!chopeiraId){
      const ref = await db.collection("chopeiras").add({
        codigo: codigo, clienteId: clienteId, provisorio: true,
        local:"", marca:"", modelo:"", tipo:"", torneiras:"",
        compressorMarca:"", compressorModelo:"", compressorHp:"",
        compressorGas:"", compressorAplicacao:"",
        observacoes: EU.admin ? "Cadastrada ao abrir um chamado."
                             : "Cadastrada pelo cliente ao abrir um chamado.",
        thumb: e.thumb || null, fotoId: null,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
      chopeiraId = ref.id;
    }

    const fotoIds = [];
    for(const f of e.fotos){
      const r = await db.collection("fotos").add({
        dataUrl: f.grande, clienteId: clienteId, de:"ordem",
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
      fotoIds.push(r.id);
    }

    const agora = new Date().toISOString();
    await db.collection("ordens").add({
      numero: numeroOS(),
      clienteId: clienteId,
      chopeiraId: chopeiraId,
      chopeiraCodigo: codigo,
      status: "aberto",
      problemaRelatado: problema,
      fotos: fotoIds,
      thumb: e.thumb || null,
      historico: [{status:"aberto", quando:agora, quem: EU.nome || EU.email, nota:""}],
      agenda: {recolhaPrevista:"", entregaPrevista:""},
      abertoPor: {uid: EU.uid, nome: EU.nome || "", email: EU.email},
      naoLidoAdmin: !EU.admin,
      naoLidoCliente: EU.admin,
      abertoEm: firebase.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });

    await recarregar();
    irPara("chamados");

    if(EU.admin){
      toast("Chamado aberto para " + nomeCliente(clienteId) + ".", "ok");
    } else {
      confirmarChamadoAberto();
    }
  }catch(err){
    toast("Não deu para enviar: " + (err.message || err), "err");
    const b = $("btEnviar"); if(b) b.disabled = false;
  }
}
