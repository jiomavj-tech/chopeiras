/* ═══════════════════════════════════════════════════════════════════
   BASE

   Atalhos, estado em memória e navegação

   Script clássico, não módulo: o aplicativo tem 147 handlers escritos
   no próprio HTML (onclick="salvarCliente()"), e módulo tem escopo
   próprio — todos parariam de funcionar de uma vez. A ordem de
   carregamento está no index.html.
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════ ferramentas ═══════════════════ */
const $ = id => document.getElementById(id);

let toastTimer = null;
function toast(msg, tipo){
  const t = $("toast");
  t.textContent = msg;
  t.className = tipo || "";
  t.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ t.style.display = "none"; }, 3200);
}
function sair(){
  if(window.__demoLoja) return location.reload();
  firebase.auth().signOut().then(() => location.reload());
}

/* O passo a passo do Firebase continua ali, mesmo em demonstração. */
if(typeof USANDO_COLADA !== "undefined" && USANDO_COLADA){
  window.addEventListener("DOMContentLoaded", () => {
    const e = document.getElementById("avisoColada");
    if(e) e.innerHTML = ' · configuração colada neste aparelho ' +
      '(<a href="#" onclick="esquecerConfig();return false;">esquecer</a>)';
  });
}

function verConfiguracao(){
  const g = $("authGate");
  g.style.display = "flex";
  agMostrar("agSetup");
  const s = $("agSetup");
  if(s && !$("btFecharSetup")){
    s.insertAdjacentHTML("beforeend",
      '<div class="btns"><button class="btn" id="btFecharSetup" ' +
      'onclick="document.getElementById(\'authGate\').style.display=\'none\'">Voltar ao app</button></div>');
  }
}

/* ── CNPJ: máscara e conferência dos dois dígitos ── */

/* CPF: formatação e validação */


/* ── telefone só para exibição, sem exigir formato ── */

/* ── foto: reduz na captura, senão não cabe em lugar nenhum ── */
function reduzirImagem(file, lado, qualidade){
  return new Promise((ok, falha)=>{
    const fr = new FileReader();
    fr.onerror = ()=> falha(new Error("não deu para ler a imagem"));
    fr.onload = ()=>{
      const img = new Image();
      img.onerror = ()=> falha(new Error("arquivo não é uma imagem"));
      img.onload = ()=>{
        let {width:w, height:h} = img;
        const maior = Math.max(w, h);
        if(maior > lado){ const f = lado/maior; w = Math.round(w*f); h = Math.round(h*f); }
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        ok(c.toDataURL("image/jpeg", qualidade));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* ═══════════════════ estado ═══════════════════ */
let CLIENTES = [], CHOPEIRAS = [], USUARIOS = [], ORDENS = [], PECAS = [];
let VISTA = "chamados";
let editando = null;   // rascunho do formulário aberto

const ABAS_ADMIN = [
  {id:"semana",    rot:"Semana"},
  {id:"chamados",  rot:"Chamados"},
  {id:"chopeiras", rot:"Chopeiras"},
  {id:"clientes",  rot:"Clientes"},
  {id:"pecas",     rot:"Peças"},
  {id:"avulsos",   rot:"Avulsos"},
  {id:"acessos",   rot:"Acessos"}
];
const ABAS_CLIENTE = [
  {id:"chamados",  rot:"Chamados"},
  {id:"chopeiras", rot:"Chopeiras"},
  {id:"empresa",   rot:"Empresa"}
];

async function iniciar(){
  $("quemSou").innerHTML = EU.admin
    ? 'Painel do administrador · <b>' + esc(EU.email) + '</b>'
    : esc(EU.nome || EU.email);
  desenharNav();
  await recarregar();

  irPara(EU.admin ? "semana" : "chamados");
}


function desenharNav(){
  const abas = EU.admin ? ABAS_ADMIN : ABAS_CLIENTE;
  $("nav").innerHTML = abas.map(a =>
    '<button id="nav_'+a.id+'" onclick="irPara(\''+a.id+'\')">'+esc(a.rot)+'</button>').join("");
}

function irPara(v){
  if(typeof pararDitado === "function") pararDitado();
  VISTA = v; editando = null;
  (EU.admin ? ABAS_ADMIN : ABAS_CLIENTE).forEach(a=>{
    const b = $("nav_"+a.id);
    if(b) b.className = (a.id === v ? "on" : "");
  });
  desenhar();
  window.scrollTo(0,0);
}

async function recarregar(){
  try{
    if(EU.admin){
      const [c, ch, os, pc] = await Promise.all([
        db.collection("clientes").orderBy("nomeFantasia").get(),
        db.collection("chopeiras").orderBy("codigo").get(),
        db.collection("ordens").get(),
        db.collection("pecas").orderBy("descricao").get()
      ]);
      CLIENTES  = c.docs.map(d=>({id:d.id, ...d.data()}));
      CHOPEIRAS = ch.docs.map(d=>({id:d.id, ...d.data()}));
      ORDENS    = ordenar(os.docs.map(d=>({id:d.id, ...d.data()})));
      PECAS     = pc.docs.map(d=>({id:d.id, ...d.data()}));
    } else {
      CLIENTES = [];
      if(EU.clienteId){
        const [c, ch, os] = await Promise.all([
          db.collection("clientes").doc(EU.clienteId).get(),
          db.collection("chopeiras").where("clienteId","==",EU.clienteId).get(),
          db.collection("ordens").where("clienteId","==",EU.clienteId).get()
        ]);
        if(c.exists) CLIENTES = [{id:c.id, ...c.data()}];
        CHOPEIRAS = ch.docs.map(d=>({id:d.id, ...d.data()}))
                      .sort((a,b)=> String(a.codigo||"").localeCompare(String(b.codigo||""), "pt-BR"));
        ORDENS = ordenar(os.docs.map(d=>({id:d.id, ...d.data()})));
      } else {
        CHOPEIRAS = []; ORDENS = [];
      }
      PECAS = [];   /* a tabela de preços não é do cliente */
    }
  }catch(e){
    toast("Não deu para carregar: " + (e.message || e), "err");
  }
  desenharSino();
}

/* Mais recente primeiro. Ordenado aqui e não no Firestore de propósito:
   um campo de servidor fica vazio por um instante depois de gravar, e
   uma ordem recém-criada sumiria da lista justamente quando importa. */

function nomeCliente(id){
  const c = CLIENTES.find(x=>x.id === id);
  return c ? (c.nomeFantasia || c.razaoSocial || "sem nome") : "—";
}

function desenhar(){
  if(VISTA === "semana")    return telaSemana();
  if(VISTA === "chamados")  return telaChamados();
  if(VISTA === "clientes")  return telaClientes();
  if(VISTA === "pecas")     return telaPecas();
  if(VISTA === "avulsos")   return telaDocumentos();
  if(VISTA === "chopeiras") return telaChopeiras();
  if(VISTA === "acessos")   return telaAcessos();
  if(VISTA === "empresa")   return telaEmpresa();
}
