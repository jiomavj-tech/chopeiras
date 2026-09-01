/* ═══════════════════════════════════════════════════════════════════
   ARRANQUE

   Configuração do Firebase, portão de acesso, gravação sem esperar
   a rede e o aviso de versão. Corre antes de haver aplicativo.

   Script clássico, não módulo: o aplicativo tem 147 handlers escritos
   no próprio HTML (onclick="salvarCliente()"), e módulo tem escopo
   próprio — todos parariam de funcionar de uma vez. A ordem de
   carregamento está no index.html.
   ═══════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   Configuração do Firebase.
   Estes valores NÃO são segredo: numa página web eles são
   públicos por definição. Quem protege os dados são as regras
   em firestore.rules, conferidas no servidor do Google.
   ───────────────────────────────────────────────────────────── */
const ADMIN_EMAIL = "gibasolucoes@gmail.com";
const CFG_ARQUIVO = {
  projectId:         "giba-chopeiras",
  appId:             "1:71037864694:web:4180a7ff5977444c7c3ad7",
  apiKey:            "AIzaSyCrO_C06FdhiW8UfIynarN5uB_0NbIY5xE",
  authDomain:        "giba-chopeiras.firebaseapp.com",
  storageBucket:     "giba-chopeiras.firebasestorage.app",
  messagingSenderId: "71037864694"
};

/* Enquanto o arquivo não tiver a configuração, ela pode ser colada no
   próprio aparelho — serve para experimentar com o Firebase de verdade
   sem ter de editar e publicar nada. Fica só neste navegador: para os
   clientes verem, os valores têm de acabar no arquivo. */
function cfgColada(){
  try{ const v = localStorage.getItem("chopeiras.cfg"); return v ? JSON.parse(v) : null; }
  catch(e){ return null; }
}
const CFG_VAZIA = String(CFG_ARQUIVO.apiKey).startsWith("COLE_AQUI");
const CFG = CFG_VAZIA ? (cfgColada() || CFG_ARQUIVO) : CFG_ARQUIVO;
const CONFIGURADO = !String(CFG.apiKey).startsWith("COLE_AQUI");
const USANDO_COLADA = CONFIGURADO && CFG_VAZIA;

/* Aceita o bloco inteiro copiado do console — const firebaseConfig = {…},
   ou o JSON puro. Ninguém devia ter de separar campo por campo. */
function lerConfigColada(t){
  const pega = k => {
    /* a aspa depois do nome é opcional: no JSON a chave vem entre aspas
       ("apiKey": "..."), no JavaScript não (apiKey: "..."). */
    const m = String(t).match(new RegExp(k + "[\"'`]?\\s*[:=]\\s*[\"'`]([^\"'`]+)[\"'`]"));
    return m ? m[1].trim() : "";
  };
  return {
    apiKey:            pega("apiKey"),
    authDomain:        pega("authDomain"),
    projectId:         pega("projectId"),
    storageBucket:     pega("storageBucket"),
    messagingSenderId: pega("messagingSenderId"),
    appId:             pega("appId")
  };
}

function ligarConfigColada(){
  const c = lerConfigColada(document.getElementById("agColar").value);
  const faltam = ["apiKey","authDomain","projectId","appId"].filter(k => !c[k]);
  const aviso = document.getElementById("agColarErro");
  if(faltam.length){
    aviso.style.display = "";
    aviso.innerHTML = "<b>Falta " + faltam.join(", ") + ".</b> Cole o bloco inteiro que o " +
      "console mostra, do <code>{</code> ao <code>}</code>.";
    return;
  }
  try{ localStorage.setItem("chopeiras.cfg", JSON.stringify(c)); }
  catch(e){
    aviso.style.display = "";
    aviso.textContent = "Este navegador não deixou guardar a configuração.";
    return;
  }
  location.reload();
}

function esquecerConfig(){
  if(!confirm("Esquecer a configuração colada e voltar à demonstração?")) return;
  try{ localStorage.removeItem("chopeiras.cfg"); }catch(e){}
  location.reload();
}

let db = null;
/* EU: quem está usando o app agora. Preenchido depois do portão. */
let EU = { uid:null, email:"", nome:"", foto:"", papel:"cliente", clienteId:null, admin:false };

function agMostrar(id){
  ["agLoading","agLogin","agPendente","agSetup"].forEach(k=>{
    const e = document.getElementById(k);
    if(e) e.style.display = (k === id ? "" : "none");
  });
}

function agEntrar(){
  const p = new firebase.auth.GoogleAuthProvider();
  p.setCustomParameters({prompt:"select_account"});
  firebase.auth().signInWithPopup(p).catch(e=>{
    const erro = document.getElementById("agErro");
    erro.style.display = "";
    erro.innerHTML = "<b>Não deu para entrar.</b> " + (e && e.message ? e.message : "Tente de novo.");
  });
}
function agSair(){ firebase.auth().signOut().then(()=>location.reload()); }

/* ═══════════════════ GRAVAR SEM DEPENDER DA REDE ═══════════════════
   No Firestore, a promessa de um set/update só resolve quando o
   servidor confirma. Sem internet ela fica pendurada para sempre — e
   como o aplicativo esperava por ela, a tela travava com o botão
   apagado, embora o dado já estivesse gravado no aparelho.

   Este envelope devolve o controlo assim que a gravação entra na fila
   local. A ida ao servidor continua a acontecer sozinha quando a rede
   voltar; o que ficou por sincronizar aparece na faixa do topo.        */

let PENDENTES = 0;

function seguirSincronia(promessa){
  PENDENTES++;
  pintarRede();
  promessa.then(
    () => { PENDENTES = Math.max(0, PENDENTES - 1); pintarRede(); },
    (e) => {
      PENDENTES = Math.max(0, PENDENTES - 1); pintarRede();
      /* Offline não dá erro: fica na fila. Se deu, o servidor recusou. */
      if(navigator.onLine){
        try{ toast("O servidor recusou uma gravação: " + (e.message || e), "err"); }catch(_){}
      }
    }
  );
  return Promise.resolve();
}

/* Mesma cara do Firestore, mas as escritas não esperam a rede. */
function semEsperarRede(fs){
  const doc = d => ({
    id: d.id,
    get:    ()  => d.get(),
    set:    v   => seguirSincronia(d.set(v)),
    update: v   => seguirSincronia(d.update(v)),
    delete: ()  => seguirSincronia(d.delete())
  });
  return {
    _fs: fs,
    collection(nome){
      const col = fs.collection(nome);
      return {
        doc: id => doc(id ? col.doc(id) : col.doc()),
        add: v => { const d = col.doc(); return seguirSincronia(d.set(v)).then(() => ({id: d.id})); },
        get: () => col.get(),
        where: (...a) => col.where(...a),
        orderBy: (...a) => col.orderBy(...a)
      };
    }
  };
}

/* Faixa do topo: sem rede, ou com coisa por sincronizar. */
function pintarRede(){
  const f = document.getElementById("faixaRede");
  if(!f) return;
  const fora = !navigator.onLine;
  if(!fora && !PENDENTES){ f.style.display = "none"; return; }
  f.style.display = "";
  f.className = fora ? "fora" : "sinc";
  const n = PENDENTES;
  const alt = n === 1 ? "1 altera\u00e7\u00e3o" : n + " altera\u00e7\u00f5es";
  f.textContent = fora
    ? (n ? "Sem internet \u2014 " + alt + " guardada" + (n===1?"":"s") +
           " no aparelho. Sobe sozinho quando a rede voltar."
         : "Sem internet \u2014 pode trabalhar normalmente. Tudo sobe quando a rede voltar.")
    : "Enviando " + alt + "\u2026";
}
window.addEventListener("online",  pintarRede);
window.addEventListener("offline", pintarRede);

/* ═══════════════════ VERSÃO E ATUALIZAÇÃO ═══════════════════
   O número no rodapé é lido da cache do service worker, e não escrito à
   mão: escrito à mão ele diverge — e foi o que aconteceu, com a página
   a dizer 5 enquanto o service worker já ia no 6. Quem olha o rodapé
   precisa de saber qual versão o aparelho tem de facto.              */

async function mostrarVersao(){
  const el = document.getElementById("versaoApp");
  if(!el || !window.caches) return;
  try{
    const ks = await caches.keys();
    const n = ks.map(k => (k.match(/^chopeiras-v(\d+)$/) || [])[1])
                .filter(Boolean).map(Number).sort((a,b) => b - a)[0];
    if(n) el.textContent = "versão " + n;
  }catch(e){ /* fica o que está escrito */ }
}

/* Um aparelho pode ficar com a versão antiga guardada — e aí um botão
   novo simplesmente não existe, sem erro nenhum a explicar porquê.
   Isto vai buscar a versão nova e recarrega. */
async function procurarAtualizacao(){
  /* Sem rede não há o que procurar — e o pedido seria respondido pela
     própria cache, dando a impressão falsa de que atualizou. */
  if(!navigator.onLine){
    return toast("Sem internet agora \u2014 o aplicativo continua a funcionar.", "err");
  }
  if(!("serviceWorker" in navigator)){ location.reload(); return; }
  toast("Procurando atualiza\u00e7\u00e3o\u2026", "");
  try{
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.update()));
    await fetch("./index.html", {cache:"no-store"});   /* confirma que h\u00e1 rede */
    toast("Recarregando com a vers\u00e3o mais nova\u2026", "ok");
    setTimeout(() => location.reload(), 800);
  }catch(e){
    toast("Sem internet agora \u2014 o aplicativo continua a funcionar.", "err");
  }
}

const QUER_DEMO = /[?&]demo\b/.test(location.search);

if(!CONFIGURADO || QUER_DEMO){
  /* Sem Firebase o aplicativo não teria o que mostrar. Em vez de uma
     página de instruções e mais nada, ele abre em demonstração — e as
     instruções ficam a um toque, no rodapé da faixa. */
  document.getElementById("agDominio").textContent =
    "Domínio desta página:\n" + location.origin;
  window.addEventListener("DOMContentLoaded", () => {
    try{ ligarDemo(); }
    catch(e){ agMostrar("agSetup"); }
  });
} else {
  firebase.initializeApp(CFG);
  const fs = firebase.firestore();
  fs.enablePersistence({synchronizeTabs:true}).catch(()=>{});
  db = semEsperarRede(fs);
  pintarRede();

  firebase.auth().onAuthStateChanged(function(user){
    if(!user){ agMostrar("agLogin"); return; }
    agMostrar("agLoading");
    portao(user);
  });
}

/* O portão decide três coisas: quem é a pessoa, se está liberada,
   e a qual empresa pertence. */
async function portao(user){
  const email = (user.email || "").toLowerCase();
  const admin = email === ADMIN_EMAIL.toLowerCase();
  const ref = db.collection("usuarios").doc(user.uid);

  try{
    let snap = await ref.get();

    /* O convite é o que liga a pessoa à empresa. É conferido em TODO
       acesso, e não só no primeiro: quem entrou antes de o administrador
       liberar o e-mail ficaria pendente para sempre, mesmo depois de
       liberado — que foi exatamente o que aconteceu. */
    async function convite(){
      try{
        const c = await db.collection("convites").doc(email).get();
        return c.exists ? c.data() : null;
      }catch(e){ return null; }
    }

    if(!snap.exists){
      const cv = await convite();
      await ref.set({
        nome:  user.displayName || "",
        email: email,
        foto:  user.photoURL || "",
        papel: "cliente",
        ativo: !!cv,
        clienteId: cv ? cv.clienteId : null,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        ultimoAcesso: firebase.firestore.FieldValue.serverTimestamp()
      });
      snap = await ref.get();
    } else {
      ref.update({ultimoAcesso: firebase.firestore.FieldValue.serverTimestamp()}).catch(()=>{});

      /* Já existia e ainda está na fila: se o administrador liberou o
         e-mail nesse meio tempo, a pessoa entra agora, sem recadastro. */
      const d0 = snap.data() || {};
      if(!admin && d0.ativo !== true){
        const cv = await convite();
        if(cv){
          await ref.update({ativo: true, clienteId: cv.clienteId});
          snap = await ref.get();
        }
      }
    }

    const d = snap.data() || {};
    if(admin || d.ativo === true){
      EU = {
        uid: user.uid,
        email: email,
        nome: d.nome || user.displayName || "",
        foto: d.foto || user.photoURL || "",
        papel: admin ? "admin" : (d.papel || "cliente"),
        clienteId: d.clienteId || null,
        admin: admin
      };
      document.getElementById("authGate").style.display = "none";
      iniciar();
    } else {
      document.getElementById("agEmail").textContent = user.email || "";
      agMostrar("agPendente");
    }
  }catch(e){
    document.getElementById("agEmail").textContent = user.email || "";
    agMostrar("agPendente");
  }
}
