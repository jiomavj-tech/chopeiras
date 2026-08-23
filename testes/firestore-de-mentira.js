/* Firestore de mentira, em memória, só para exercitar o app num navegador.
   Não imita as regras de segurança — imita a API que o app chama. */
(function(){
  /* Guardado na sessão do navegador para sobreviver a um reload — sem isso
     não dá para testar "o mesmo banco, outra pessoa entrando". */
  function ler(chave, padrao){
    try{ const v = sessionStorage.getItem(chave); return v ? JSON.parse(v) : padrao; }
    catch(e){ return padrao; }
  }
  function gravar(chave, valor){
    try{ sessionStorage.setItem(chave, JSON.stringify(valor)); }catch(e){}
  }

  const LOJA = ler("__loja", {});       // { colecao: { id: dados } }
  const salvar = () => gravar("__loja", LOJA);
  let seq = ler("__seq", 0);
  const novoId = () => { seq++; gravar("__seq", seq); return "id" + seq; };
  const clonar = o => JSON.parse(JSON.stringify(o));
  /* devolve o carimbo com toDate(), como faz o Firestore de verdade */
  function reviver(o){
    if(o === null || typeof o !== "object") return o;
    if(Array.isArray(o)) return o.map(reviver);
    if(typeof o.__ts === "number"){
      const ms = o.__ts;
      return {toDate: () => new Date(ms), seconds: Math.floor(ms/1000)};
    }
    const r = {};
    Object.keys(o).forEach(k => { r[k] = reviver(o[k]); });
    return r;
  }

  window.__LOJA = LOJA;
  window.__USUARIO = ler("__user", { uid:"u1", email:"gibasolucoes@gmail.com",
                                     displayName:"Giba", photoURL:"" });
  window.__trocarUsuario = u => { gravar("__user", u); window.__USUARIO = u; };
  window.__salvarLoja = salvar;

  function snapDoc(col, id){
    const d = LOJA[col] && LOJA[col][id];
    return {
      exists: !!d, id: id,
      data: () => d ? reviver(clonar(d)) : undefined
    };
  }
  function docRef(col, id){
    return {
      id: id,
      get: () => Promise.resolve(snapDoc(col, id)),
      set: v => { LOJA[col] = LOJA[col] || {}; LOJA[col][id] = clonar(v); salvar(); return Promise.resolve(); },
      update: v => {
        if(!(LOJA[col] && LOJA[col][id])) return Promise.reject(new Error("documento não existe"));
        const alvo = LOJA[col][id];
        Object.keys(v).forEach(k => {
          const valor = v[k];
          if(valor && valor.__arrayUnion){
            alvo[k] = (alvo[k] || []).concat(clonar(valor.__arrayUnion));
          }else{
            alvo[k] = clonar(valor);
          }
        });
        salvar();
        return Promise.resolve();
      },
      delete: () => { if(LOJA[col]) delete LOJA[col][id]; salvar(); return Promise.resolve(); }
    };
  }
  function consulta(col, filtros, ordem){
    return {
      where: (c,o,v) => consulta(col, filtros.concat([[c,o,v]]), ordem),
      orderBy: c => consulta(col, filtros, c),
      get: () => {
        let itens = Object.keys(LOJA[col] || {}).map(id => ({id:id, d:LOJA[col][id]}));
        filtros.forEach(([c,o,v]) => { itens = itens.filter(x => x.d[c] === v); });
        if(ordem) itens.sort((a,b)=> String(a.d[ordem]||"").localeCompare(String(b.d[ordem]||"")));
        return Promise.resolve({
          docs: itens.map(x => ({id:x.id, data:()=>reviver(clonar(x.d))})),
          size: itens.length, empty: itens.length === 0
        });
      }
    };
  }
  function colRef(col){
    const q = consulta(col, [], null);
    return {
      doc: id => docRef(col, id || novoId()),
      add: v => { const id = novoId(); LOJA[col] = LOJA[col]||{}; LOJA[col][id] = clonar(v);
                  salvar(); return Promise.resolve({id:id}); },
      where: q.where, orderBy: q.orderBy, get: q.get
    };
  }

  const firestore = () => ({
    collection: colRef,
    enablePersistence: () => Promise.resolve()
  });
  /* serverTimestamp devolve um carimbo com toDate(), como o de verdade,
     para o app conseguir mostrar a data logo depois de gravar. */
  firestore.FieldValue = {
    serverTimestamp: () => ({__ts: Date.now()}),
    arrayUnion: (...itens) => ({__arrayUnion: itens})
  };

  let aoMudar = null;
  const auth = () => ({
    onAuthStateChanged: fn => { aoMudar = fn; setTimeout(()=>fn(window.__USUARIO), 0); },
    signInWithPopup: () => { if(aoMudar) aoMudar(window.__USUARIO); return Promise.resolve(); },
    signOut: () => Promise.resolve()
  });
  auth.GoogleAuthProvider = function(){ this.setCustomParameters = function(){}; };

  window.firebase = { initializeApp: ()=>{}, firestore: firestore, auth: auth };
})();
