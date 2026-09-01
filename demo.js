/* ═══════════════════════════════════════════════════════════════════
   DEMO

   Firestore de mentira, para experimentar sem configurar

   Script clássico, não módulo: o aplicativo tem 147 handlers escritos
   no próprio HTML (onclick="salvarCliente()"), e módulo tem escopo
   próprio — todos parariam de funcionar de uma vez. A ordem de
   carregamento está no index.html.
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
   MODO DEMONSTRAÇÃO

   Liga sozinho quando o Firebase ainda não está configurado, e à mão
   com ?demo na barra de endereço. Põe no lugar do Firestore um banco
   que vive dentro do navegador, com dados de exemplo — dá para
   percorrer o aplicativo inteiro, dos dois lados, sem conta, sem
   servidor e sem internet.

   Nada daqui sai do aparelho, e nada aqui é real: é para ver como
   funciona antes de ligar ao Firebase de verdade.
   ═══════════════════════════════════════════════════════════════════ */
function ligarDemo(){
  const ler = (k, p) => {
    try{ const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : p; }catch(e){ return p; }
  };
  const gravar = (k, v) => { try{ sessionStorage.setItem(k, JSON.stringify(v)); }catch(e){} };

  const LOJA = ler("demo.loja", null) || semear();
  const salvar = () => gravar("demo.loja", LOJA);
  let seq = ler("demo.seq", 100);
  const novoId = () => { seq++; gravar("demo.seq", seq); return "d" + seq; };
  const clonar = o => JSON.parse(JSON.stringify(o));

  /* devolve o carimbo com toDate(), como faz o Firestore */
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

  function docRef(col, id){
    return {
      id: id,
      get: () => {
        const d = LOJA[col] && LOJA[col][id];
        return Promise.resolve({exists: !!d, id: id,
          data: () => d ? reviver(clonar(d)) : undefined});
      },
      set: v => { LOJA[col] = LOJA[col] || {}; LOJA[col][id] = clonar(v); salvar();
                  return Promise.resolve(); },
      update: v => {
        if(!(LOJA[col] && LOJA[col][id])) return Promise.reject(new Error("não existe"));
        const alvo = LOJA[col][id];
        Object.keys(v).forEach(k => {
          const val = v[k];
          if(val && val.__arrayUnion) alvo[k] = (alvo[k] || []).concat(clonar(val.__arrayUnion));
          else alvo[k] = clonar(val);
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
        filtros.forEach(([c,,v]) => { itens = itens.filter(x => x.d[c] === v); });
        if(ordem) itens.sort((a,b) =>
          String(a.d[ordem]||"").localeCompare(String(b.d[ordem]||""), "pt-BR"));
        return Promise.resolve({
          docs: itens.map(x => ({id:x.id, data:() => reviver(clonar(x.d))})),
          size: itens.length, empty: !itens.length});
      }
    };
  }
  function colRef(col){
    const q = consulta(col, [], null);
    return {
      doc: id => docRef(col, id || novoId()),
      add: v => { const id = novoId(); LOJA[col] = LOJA[col] || {}; LOJA[col][id] = clonar(v);
                  salvar(); return Promise.resolve({id:id}); },
      where: q.where, orderBy: q.orderBy, get: q.get
    };
  }

  window.__demoLoja = LOJA;
  db = {collection: colRef, enablePersistence: () => Promise.resolve()};
  window.firebase = window.firebase || {};
  firebase.firestore = firebase.firestore || {};
  firebase.firestore.FieldValue = {
    serverTimestamp: () => ({__ts: Date.now()}),
    arrayUnion: (...itens) => ({__arrayUnion: itens})
  };

  const papel = ler("demo.papel", "admin");
  EU = papel === "admin"
    ? {uid:"demo-giba", email:"gibasolucoes@gmail.com", nome:"Giba", foto:"",
       papel:"admin", clienteId:null, admin:true}
    : {uid:"demo-ze", email:"ze@bardoze.com.br", nome:"Zé", foto:"",
       papel:"cliente", clienteId:"cli1", admin:false};

  window.demoTrocarPapel = () => {
    gravar("demo.papel", ler("demo.papel","admin") === "admin" ? "cliente" : "admin");
    location.reload();
  };
  window.demoRecomecar = () => {
    if(!confirm("Apagar tudo o que você mexeu na demonstração e voltar ao exemplo?")) return;
    try{ sessionStorage.removeItem("demo.loja"); sessionStorage.removeItem("demo.seq"); }catch(e){}
    location.reload();
  };

  document.getElementById("authGate").style.display = "none";
  document.body.insertAdjacentHTML("afterbegin",
    '<div id="faixaDemo">' +
      '<b>Modo demonstração</b> — dados de exemplo, guardados só neste aparelho. ' +
      'Você está vendo como <b>' + (EU.admin ? "Giba" : "o cliente Zé") + '</b>.' +
      '<div class="btns" style="margin-top:8px;justify-content:center">' +
        '<button class="btn sm" onclick="demoTrocarPapel()">Ver como ' +
          (EU.admin ? "o cliente" : "o Giba") + '</button>' +
        '<button class="btn sm" onclick="demoRecomecar()">Recomeçar</button>' +
      '</div>' +
    '</div>');
  iniciar();
}

/* Um exemplo que já tem história: uma chopeira à espera de peça, outra
   com orçamento na mesa, e uma terceira já entregue com laudo. */
function semear(){
  const t = Date.now(), dia = 86400000;
  const iso = n => new Date(t - n*dia).toISOString();
  const data = n => {
    const d = new Date(t + n*dia), p = x => String(x).padStart(2,"0");
    return d.getFullYear() + "-" + p(d.getMonth()+1) + "-" + p(d.getDate());
  };
  return {
    clientes: {
      cli1:{cnpj:"11222333000181", razaoSocial:"Zé Comércio de Bebidas Ltda",
        nomeFantasia:"Bar do Zé", endereco:"Rua das Palmeiras, 210", cidade:"Florianópolis",
        uf:"SC", contato:"Zé", telefone:"(48) 3333-1234", whatsapp:"48 99999-1234",
        emailsAutorizados:["ze@bardoze.com.br"], observacoes:"", criadoEm:{__ts:t-40*dia}},
      cli2:{cnpj:"04252011000110", razaoSocial:"Choperia Trilho Norte Ltda",
        nomeFantasia:"Trilho Norte", endereco:"Av. Central, 1500", cidade:"São José",
        uf:"SC", contato:"Marcia", telefone:"(48) 3222-8080", whatsapp:"48 98888-7777",
        emailsAutorizados:["marcia@trilhonorte.com.br"], observacoes:"", criadoEm:{__ts:t-30*dia}}
    },
    usuarios: {
      "demo-ze":{nome:"Zé", email:"ze@bardoze.com.br", papel:"cliente", ativo:true,
        clienteId:"cli1", criadoEm:{__ts:t-40*dia}, ultimoAcesso:{__ts:t-dia}},
      "demo-marcia":{nome:"Marcia", email:"marcia@trilhonorte.com.br", papel:"cliente",
        ativo:false, clienteId:null, criadoEm:{__ts:t-2*dia}, ultimoAcesso:{__ts:t-2*dia}}
    },
    chopeiras: {
      cho1:{codigo:"CH-014", clienteId:"cli1", local:"balcão da frente", marca:"Beertec",
        modelo:"BT-2T", tipo:"Banco de gelo", torneiras:"2", compressorMarca:"Embraco",
        compressorModelo:"EMIS70HER", compressorHp:"1/5 HP", compressorGas:"R134a",
        compressorAplicacao:"MBP", provisorio:false, observacoes:"", criadoEm:{__ts:t-40*dia}},
      cho2:{codigo:"CH-021", clienteId:"cli1", local:"depósito", marca:"Gelopar",
        modelo:"GRBC-2", tipo:"Direta", torneiras:"2", compressorMarca:"Tecumseh",
        compressorGas:"R134a", compressorAplicacao:"MBP", provisorio:false,
        observacoes:"", criadoEm:{__ts:t-38*dia}},
      cho3:{codigo:"TN-003", clienteId:"cli2", local:"salão", marca:"Maxbeer", modelo:"MX-4",
        tipo:"Banco de gelo", torneiras:"4", compressorMarca:"Embraco",
        compressorGas:"R290", compressorAplicacao:"MBP", provisorio:false,
        observacoes:"", criadoEm:{__ts:t-30*dia}}
    },
    pecas: {
      pe1:{codigo:"KP1-060", descricao:"Pressostato de baixa (KP1 Danfoss)", unidade:"un",
        precoVenda:289.9, aplicacao:"chopeira com banco de gelo", observacoes:""},
      pe2:{codigo:"CAP-330", descricao:"Capacitor de partida (eletrolítico)", unidade:"un",
        precoVenda:48.5, aplicacao:"324–389 µF, 110/120 VAC", observacoes:""},
      pe3:{codigo:"REL-VOLT", descricao:"Relé de partida voltimétrico", unidade:"un",
        precoVenda:132, aplicacao:"compressor de chopeira", observacoes:""},
      pe4:{codigo:"FS-032", descricao:"Filtro secador", unidade:"un", precoVenda:34.9,
        aplicacao:"", observacoes:""}
    },
    ordens: {
      os1:{numero:"OS-260819-K7QP", clienteId:"cli1", chopeiraId:"cho1", chopeiraCodigo:"CH-014",
        status:"orcamento_enviado",
        problemaRelatado:"O chope está saindo quente desde ontem de manhã. O motor liga mas não gela como antes.",
        fotos:[], thumb:null,
        historico:[
          {status:"aberto", quando:iso(4), quem:"Zé", nota:""},
          {status:"recolha_agendada", quando:iso(4), quem:"Giba", nota:"Passo aí quinta de manhã."},
          {status:"recebido", quando:iso(3), quem:"Giba", nota:""},
          {status:"em_teste", quando:iso(2), quem:"Giba", nota:"Compressor parte e roda. Pressostato não fecha o contato."},
          {status:"orcamento_enviado", quando:iso(0), quem:"Giba", nota:"Orçamento de R$ 469,90."}],
        agenda:{recolhaPrevista:data(-3), entregaPrevista:""},
        orcamento:{itens:[
          {tipo:"peca", pecaId:"pe1", descricao:"Pressostato de baixa (KP1 Danfoss)", qtd:1, valorUnit:289.9},
          {tipo:"servico", pecaId:null, descricao:"Mão de obra — troca de componente", qtd:1, valorUnit:180}],
          totalPecas:289.9, totalServico:180, total:469.9, validadeDias:15, enviadoEm:iso(0)},
        decisaoCliente:null,
        abertoPor:{uid:"demo-ze", nome:"Zé", email:"ze@bardoze.com.br"},
        naoLidoAdmin:false, naoLidoCliente:true,
        abertoEm:{__ts:t-4*dia}, atualizadoEm:{__ts:t-3600000}},

      os2:{numero:"OS-260821-M3XZ", clienteId:"cli2", chopeiraId:"cho3", chopeiraCodigo:"TN-003",
        status:"aguardando_peca", problemaRelatado:"Torneira 3 pingando sem parar.",
        fotos:[], thumb:null,
        historico:[
          {status:"aberto", quando:iso(2), quem:"Marcia", nota:""},
          {status:"recebido", quando:iso(1), quem:"Giba", nota:""},
          {status:"aguardando_peca", quando:iso(0), quem:"Giba", nota:"Guarnição encomendada, chega quarta."}],
        agenda:{recolhaPrevista:data(-1), entregaPrevista:data(3)},
        abertoPor:{uid:"demo-marcia", nome:"Marcia", email:"marcia@trilhonorte.com.br"},
        naoLidoAdmin:true, naoLidoCliente:false,
        abertoEm:{__ts:t-2*dia}, atualizadoEm:{__ts:t-7200000}},

      os3:{numero:"OS-260805-B9TR", clienteId:"cli1", chopeiraId:"cho2", chopeiraCodigo:"CH-021",
        status:"entregue", problemaRelatado:"Não estava ligando de jeito nenhum.",
        fotos:[], thumb:null,
        historico:[
          {status:"aberto", quando:iso(18), quem:"Zé", nota:""},
          {status:"recebido", quando:iso(17), quem:"Giba", nota:""},
          {status:"em_teste", quando:iso(16), quem:"Giba", nota:""},
          {status:"orcamento_enviado", quando:iso(15), quem:"Giba", nota:"Orçamento de R$ 312,00."},
          {status:"orcamento_aprovado", quando:iso(14), quem:"Zé", nota:""},
          {status:"concluido", quando:iso(12), quem:"Giba", nota:""},
          {status:"entregue", quando:iso(11), quem:"Giba", nota:""}],
        agenda:{recolhaPrevista:data(-18), entregaPrevista:data(-11)},
        orcamento:{itens:[
          {tipo:"peca", pecaId:"pe3", descricao:"Relé de partida voltimétrico", qtd:1, valorUnit:132},
          {tipo:"servico", pecaId:null, descricao:"Mão de obra — troca de componente", qtd:1, valorUnit:180}],
          totalPecas:132, totalServico:180, total:312, validadeDias:15, enviadoEm:iso(15)},
        decisaoCliente:{valor:"aprovado", motivo:"", quando:iso(14), por:"Zé", porUid:"demo-ze"},
        laudo:{
          problemaConstatado:"Compressor não partia. O relé voltimétrico apresentava continuidade " +
            "no contato fora da condição de repouso, mantendo o enrolamento de partida energizado.",
          componentes:[
            {nome:"Relé de partida voltimétrico",
             ensaios:"Escala 20 kΩ para testar a bobina, entre os terminais 5 e 2. Escala 200 Ω " +
               "para testar o contato, entre 2 e 1 — deve haver continuidade com o relé em " +
               "repouso, ao contrário do relé de corrente comum.",
             conclusao:"componente condenado, substituído"},
            {nome:"Compressor — checklist completo",
             ensaios:"Isolação para a carcaça verificada: nenhum terminal apresenta continuidade " +
               "com a carcaça. Medida a resistência entre as três combinações de terminais e " +
               "identificados comum, start e run pela resistência. Ligação direta com medição de " +
               "corrente e teste de compressão com manifold.",
             conclusao:"componente aprovado no ensaio"}],
          servicoExecutado:"Substituído o relé de partida voltimétrico. Refeita a conexão " +
            "elétrica e testado o ciclo completo de partida e corte.",
          recomendacoes:"Recomendada a limpeza do condensador a cada três meses.",
          pecas:[{descricao:"Relé de partida voltimétrico", qtd:1, valorUnit:132}],
          tecnico:"Giba", emitidoEm:iso(12)},
        abertoPor:{uid:"demo-ze", nome:"Zé", email:"ze@bardoze.com.br"},
        naoLidoAdmin:false, naoLidoCliente:false,
        abertoEm:{__ts:t-18*dia}, atualizadoEm:{__ts:t-11*dia}}
    },
    convites: {"ze@bardoze.com.br":{clienteId:"cli1", criadoEm:{__ts:t-40*dia}}},
    fotos: {}
  };
}

async function atualizar(){
  toast("Atualizando…");
  await recarregar();
  desenhar();
  toast("Pronto.", "ok");
}
