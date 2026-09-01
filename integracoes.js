/* ═══════════════════════════════════════════════════════════════════
   INTEGRACOES

   O que sai para fora: WhatsApp e agenda do Google

   Script clássico, não módulo: o aplicativo tem 147 handlers escritos
   no próprio HTML (onclick="salvarCliente()"), e módulo tem escopo
   próprio — todos parariam de funcionar de uma vez. A ordem de
   carregamento está no index.html.
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
   NOTIFICAÇÕES E INTEGRAÇÃO
   ═══════════════════════════════════════════════════════════════════ */

/* O que existia aqui montava um aviso interno — "NOVO CHAMADO, cliente
   X, problema Y" — e mandava-o para o WhatsApp do próprio cliente, além
   de nunca chegar a abrir. Estava errado no destinatário e no conteúdo.

   Quem tem de saber do chamado novo é o administrador, e ele já sabe: a
   ordem nasce com naoLidoAdmin e o sino acende. O cliente, esse, precisa
   é de confirmação de que o pedido entrou. */
function confirmarChamadoAberto(){
  toast("Pedido enviado. O Giba já foi avisado e entra em contacto.", "ok");
}

/* ═══════════════════ AGENDA DO GOOGLE ═══════════════════
   O compromisso é criado uma vez e depois ATUALIZADO: o id do evento
   fica guardado dentro da ordem, então remarcar muda a data no mesmo
   compromisso em vez de encher a agenda de duplicatas. Apagar a data
   apaga o compromisso.

   Sem Client ID configurado nada disso roda — e o app continua
   funcionando igual, oferecendo o link de "pôr na agenda" à mão. */

const AGENDA_ESCOPO = "https://www.googleapis.com/auth/calendar.events";
const AGENDA_API    = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

function agendaClientId(){
  try{ return (localStorage.getItem("googleClientId") || "").trim(); }
  catch(e){ return ""; }
}

function agendaConfigurada(){ return !!agendaClientId(); }

function agendaDisponivel(){
  return agendaConfigurada() &&
    !!(window.google && google.accounts && google.accounts.oauth2);
}

let AGENDA_TOKEN = null;     /* {valor, expira} — só na memória */
let AGENDA_CLIENTE = null;

/* interativo=true abre a janela de permissão do Google; false tenta
   renovar calado, que é o que serve no meio de um salvamento. */
function tokenAgenda(interativo){
  return new Promise(resolve => {
    if(AGENDA_TOKEN && AGENDA_TOKEN.expira > Date.now() + 30000){
      return resolve(AGENDA_TOKEN.valor);
    }
    if(!agendaDisponivel()) return resolve(null);
    try{
      if(!AGENDA_CLIENTE){
        AGENDA_CLIENTE = google.accounts.oauth2.initTokenClient({
          client_id: agendaClientId(),
          scope: AGENDA_ESCOPO,
          callback: function(){}
        });
      }
      let respondido = false;
      const responder = v => { if(!respondido){ respondido = true; resolve(v); } };
      AGENDA_CLIENTE.callback = function(r){
        if(r && r.access_token){
          AGENDA_TOKEN = {valor: r.access_token,
            expira: Date.now() + (Number(r.expires_in || 3600) - 60) * 1000};
          responder(r.access_token);
        } else responder(null);
      };
      AGENDA_CLIENTE.error_callback = function(){ responder(null); };
      AGENDA_CLIENTE.requestAccessToken({prompt: interativo ? "consent" : ""});
      /* se a renovação calada não voltar, seguimos sem agenda */
      if(!interativo) setTimeout(() => responder(null), 8000);
    }catch(e){ resolve(null); }
  });
}

/* "2026-08-25" + "09:00" → {inicio, fim} no formato que a API quer,
   sem passar por UTC: quem diz o fuso é o campo timeZone. */

async function chamarAgenda(caminho, metodo, corpo){
  const token = await tokenAgenda(false);
  if(!token) return null;
  const r = await fetch(AGENDA_API + caminho, {
    method: metodo,
    headers: {Authorization: "Bearer " + token, "Content-Type": "application/json"},
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  if(r.status === 401 || r.status === 403){ AGENDA_TOKEN = null; return null; }
  if(!r.ok) return null;
  return metodo === "DELETE" ? true : r.json();
}

/* Cria ou atualiza. Devolve o id do evento, ou null se não deu. */
async function porNaAgenda(idExistente, dados){
  const janela = janelaAgenda(dados.data, dados.hora);
  if(!janela) return null;
  const evento = {
    summary: dados.titulo,
    description: dados.descricao || "",
    location: dados.local || "",
    start: {dateTime: janela.inicio, timeZone: AGENDA_FUSO},
    end:   {dateTime: janela.fim,    timeZone: AGENDA_FUSO}
  };
  if(idExistente){
    const r = await chamarAgenda("/" + encodeURIComponent(idExistente), "PATCH", evento);
    if(r && r.id) return r.id;
    /* o evento pode ter sido apagado na mão: cria de novo */
  }
  const novo = await chamarAgenda("", "POST", evento);
  return novo && novo.id ? novo.id : null;
}

async function tirarDaAgenda(id){
  if(!id) return;
  await chamarAgenda("/" + encodeURIComponent(id), "DELETE");
}

/* Link de "pôr na agenda" à mão — é o que sobra quando não há Client ID
   configurado, e funciona sem preparo nenhum. */

/* Os dois compromissos de uma ordem, do jeito que devem estar agora. */
function compromissosDaOrdem(o){
  const cli = nomeCliente(o.clienteId);
  const os  = "OS " + (o.numero || "");
  const lista = [];

  const recolha = (o.agenda && o.agenda.recolhaPrevista) || "";
  if(recolha){
    lista.push({chave:"recolha", data:recolha, hora:"09:00",
      titulo:"Retirar chopeira — " + cli,
      descricao:"Retirada da chopeira de " + cli + ". " + os,
      local:""});
  }

  const entregaData = (o.entrega && o.entrega.quando) ||
                      (o.agenda && o.agenda.entregaPrevista) || "";
  if(entregaData){
    const temHora = String(entregaData).includes("T");
    lista.push({chave:"entrega",
      data: String(entregaData).slice(0,10),
      hora: temHora ? String(entregaData).slice(11,16) : "14:00",
      titulo:"Entregar chopeira — " + cli,
      descricao:"Entrega da chopeira de " + cli + ". " + os,
      local:(o.entrega && o.entrega.local) || ""});
  }
  return lista;
}

/* Põe a agenda de acordo com a ordem: cria o que falta, atualiza o que
   mudou, apaga o que deixou de ter data. Nunca atrapalha o salvamento —
   se a agenda não estiver ligada, sai calada. */
async function sincronizarAgenda(o){
  if(!agendaDisponivel()) return;

  const antes = Object.assign({}, o.eventos || {});
  const depois = Object.assign({}, antes);
  const querem = compromissosDaOrdem(o);
  const chaves = querem.map(c => c.chave);

  try{
    for(const c of querem){
      const id = await porNaAgenda(antes[c.chave], c);
      if(id) depois[c.chave] = id;
    }
    for(const chave of Object.keys(antes)){
      if(!chaves.includes(chave)){
        await tirarDaAgenda(antes[chave]);
        delete depois[chave];
      }
    }

    if(JSON.stringify(antes) !== JSON.stringify(depois)){
      o.eventos = depois;
      await db.collection("ordens").doc(o.id).update({eventos: depois});
    }
  }catch(e){ /* agenda é conforto, não pode derrubar o chamado */ }
}

/* Conectar a agenda: pedido explícito, uma vez. */
async function conectarAgenda(){
  if(!agendaConfigurada()){
    return toast("Cole primeiro o Client ID do Google.", "err");
  }
  if(!agendaDisponivel()){
    return toast("A biblioteca do Google não carregou. Recarregue a página.", "err");
  }
  const t = await tokenAgenda(true);
  toast(t ? "Agenda conectada." : "Não deu para conectar a agenda.", t ? "ok" : "err");
  if(VISTA === "acessos") telaAcessos();
}

function salvarClientIdAgenda(){
  const v = $("cfgClientId").value.trim();
  try{
    if(v) localStorage.setItem("googleClientId", v);
    else localStorage.removeItem("googleClientId");
  }catch(e){ return toast("O navegador não deixou guardar.", "err"); }
  AGENDA_CLIENTE = null; AGENDA_TOKEN = null;
  toast(v ? "Client ID guardado. Agora clique em Conectar." : "Client ID apagado.", "ok");
  telaAcessos();
}

function cartaoAgenda(){
  const ligado = !!AGENDA_TOKEN && AGENDA_TOKEN.expira > Date.now();
  const cid = agendaClientId();
  return '<h3>Agenda do Google</h3>' +
    '<div class="card">' +
      '<div class="muted">Com a agenda ligada, marcar recolha ou entrega cria o ' +
        'compromisso sozinho — e remarcar muda a data no mesmo compromisso, ' +
        'sem duplicar.</div>' +
      '<label>Client ID do Google</label>' +
      '<input id="cfgClientId" placeholder="000000-xxxx.apps.googleusercontent.com" value="' +
        esc(cid) + '">' +
      '<div class="btns">' +
        '<button class="btn" onclick="salvarClientIdAgenda()">Guardar</button>' +
        (cid ? '<button class="btn pri" onclick="conectarAgenda()">' +
          (ligado ? "Reconectar" : "Conectar agenda") + '</button>' : '') +
      '</div>' +
      '<div class="esc">' +
        (!cid ? 'Ainda sem Client ID: por enquanto cada chamado mostra um botão ' +
                'para pôr na agenda à mão.'
              : (ligado ? 'Conectada nesta sessão.'
                        : 'Guardado. Clique em Conectar — o Google vai pedir permissão uma vez.')) +
      '</div>' +
    '</div>';
}

/* Notificar quando muda o status */
/* Isto antes montava o link e fazia console.log — ou seja, o cliente
   nunca recebia nada, embora parecesse que sim. Agora pergunta e abre
   o WhatsApp, que é a única forma de a mensagem sair mesmo. Perguntar
   em vez de abrir sozinho é de propósito: abrir sozinho é intrusivo e
   o navegador do telemóvel costuma bloquear. */
function ofereceAvisarCliente(ordem, cliente){
  if(!cliente) return;
  if(!whatsDo(cliente)) return;
  if(confirm("Avisar o cliente no WhatsApp agora?\n\n" + recadoCliente(ordem))){
    avisarWhats(ordem.id);
  }
}

/* ── ver e mover ──────────────────────────────────────────────────── */
async function abrirOrdem(id){
  const o = ORDENS.find(x => x.id === id);
  if(!o) return;
  editando = {tipo:"verOrdem", id:id, dados:o};
  telaChamados();

  /* Abrir é ler: o aviso do meu lado se apaga. */
  const campo = EU.admin ? "naoLidoAdmin" : "naoLidoCliente";
  if(o[campo]){
    try{
      await db.collection("ordens").doc(id).update({[campo]: false});
      o[campo] = false;
      desenharSino();
    }catch(e){ /* fica marcado, tenta de novo na próxima */ }
  }
  (o.fotos || []).forEach((fid,i) => mostrarFotoOrdem(fid, i));
}

async function mostrarFotoOrdem(fotoId, i){
  try{
    const s = await db.collection("fotos").doc(fotoId).get();
    const img = $("of_" + i);
    if(s.exists && img){ img.src = s.data().dataUrl; img.style.display = "block"; }
  }catch(e){ /* sem a foto, a ficha vive */ }
}
