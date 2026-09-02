/* ═══════════════════════════════════════════════════════════════════
   ACESSOS

   Quem entra no aplicativo, e o que o cliente vê da empresa

   Script clássico, não módulo: o aplicativo tem 147 handlers escritos
   no próprio HTML (onclick="salvarCliente()"), e módulo tem escopo
   próprio — todos parariam de funcionar de uma vez. A ordem de
   carregamento está no index.html.
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════ ACESSOS (admin) ═══════════════════ */
async function telaAcessos(){
  $("tela").innerHTML = '<div class="vazio">Carregando…</div>';
  try{
    const s = await db.collection("usuarios").orderBy("criadoEm","desc").get();
    USUARIOS = s.docs.map(d=>({uid:d.id, ...d.data()}));
  }catch(e){
    $("tela").innerHTML = '<div class="alert red">Não deu para carregar: '+esc(e.message||e)+'</div>';
    return;
  }
  const pend = USUARIOS.filter(u => !u.ativo && !ehAdminEmail(u.email));
  const lib  = USUARIOS.filter(u => u.ativo || ehAdminEmail(u.email));

  $("tela").innerHTML =
    '<div class="btns" style="margin:0 0 12px"><button class="btn" onclick="telaAcessos()">Atualizar</button></div>' +
    (pend.length
      ? '<h3>Esperando aprovação ('+pend.length+')</h3>' + pend.map(u=>cartaoUsuario(u,true)).join("")
      : '<div class="alert grn">Ninguém na fila.</div>') +
    '<h3>Com acesso liberado ('+lib.length+')</h3>' +
    (lib.length ? lib.map(u=>cartaoUsuario(u,false)).join("") : '<div class="vazio">Ninguém ainda.</div>') +
    cartaoAgenda();
}

function ehAdminEmail(e){ return !!(e && e.toLowerCase() === ADMIN_EMAIL.toLowerCase()); }

function cartaoUsuario(u, pendente){
  const admin = ehAdminEmail(u.email);
  const sel = '<select id="vinc_'+u.uid+'" onchange="vincular(\''+u.uid+'\')">' +
    '<option value="">— sem empresa —</option>' +
    CLIENTES.map(c=>'<option value="'+c.id+'"'+(c.id===u.clienteId?" selected":"")+'>'+
      esc(c.nomeFantasia || c.razaoSocial)+'</option>').join("") + '</select>';
  return '<div class="reg'+(pendente?" pend":"")+'">' +
    '<div class="top"><div style="min-width:0">' +
      '<div class="nm">'+esc(u.nome || "sem nome")+'</div>' +
      '<div class="dt">'+esc(u.email)+'</div>' +
      '<div class="dt">'+(u.ultimoAcesso && u.ultimoAcesso.toDate ?
        "último acesso: " + u.ultimoAcesso.toDate().toLocaleString("pt-BR") : "")+'</div>' +
    '</div>' +
    '<div style="text-align:right">' +
      (admin ? '<span class="pill adm">Administrador</span>'
             : '<span class="pill '+(u.ativo?"ok":"pend")+'">'+(u.ativo?"liberado":"na fila")+'</span>') +
    '</div></div>' +
    (admin ? '' :
      '<label>Empresa</label>' + sel +
      '<div class="btns">' +
        (u.ativo
          ? '<button class="btn dg sm" onclick="liberar(\''+u.uid+'\',false)">Bloquear</button>'
          : '<button class="btn pri sm" onclick="liberar(\''+u.uid+'\',true)">Aprovar</button>') +
      '</div>' +
      (!u.clienteId ? '<div class="esc" style="color:var(--warn)">Sem empresa ligada, esta pessoa ' +
        'entra e não vê chopeira nenhuma.</div>' : '')) +
  '</div>';
}

async function liberar(uid, valor){
  const u = USUARIOS.find(x=>x.uid === uid);
  if(valor && u && !u.clienteId && !confirm(
      "Esta pessoa ainda não está ligada a nenhuma empresa e vai entrar sem ver nada. Aprovar assim mesmo?")){
    return;
  }
  try{
    /* "bloqueado" é a marca que a regra do servidor confere: distingue
       quem nunca foi liberado de quem o administrador barrou. */
    await db.collection("usuarios").doc(uid).update({ativo: !!valor, bloqueado: !valor});

    /* Bloquear tem de segurar. Quem tem convite pode ligar-se sozinho à
       empresa dele no acesso seguinte — é o que impede quem entrou antes
       de ser liberado de ficar pendente para sempre. Só que a mesma
       porta desfazia o bloqueio: bloqueava-se alguém e, ao abrir o
       aplicativo, ele voltava a entrar. O convite é a chave, e ao
       bloquear tira-se a chave. */
    const email = (u && u.email || "").toLowerCase();
    if(email){
      if(!valor){
        await db.collection("convites").doc(email).delete();
      } else if(u && u.clienteId){
        await db.collection("convites").doc(email).set({
          clienteId: u.clienteId, criadoEm: firebase.firestore.FieldValue.serverTimestamp()});
      }
    }

    toast(valor ? "Acesso liberado." : "Acesso bloqueado.", "ok");
    telaAcessos();
  }catch(e){ toast("Não deu: " + (e.message||e), "err"); }
}

async function vincular(uid){
  const v = $("vinc_"+uid).value || null;
  const u = USUARIOS.find(x => x.uid === uid);
  try{
    await db.collection("usuarios").doc(uid).update({clienteId: v});

    /* O convite manda mais do que esta decisão: no acesso seguinte, a
       pessoa liga-se sozinha à empresa que o convite disser. Se ficasse
       um convite antigo apontando para outra empresa, ela voltaria para
       lá e a mudança feita aqui desfazia-se sem aviso nenhum.

       Por isso o convite acompanha: apagado quando se desliga, e
       reescrito para a empresa nova quando se muda. */
    const email = (u && u.email || "").toLowerCase();
    if(email){
      if(v){
        await db.collection("convites").doc(email).set({
          clienteId: v, criadoEm: firebase.firestore.FieldValue.serverTimestamp()});
      } else {
        await db.collection("convites").doc(email).delete();
      }
    }

    toast(v ? "Ligado a " + nomeCliente(v) + "." : "Desligado da empresa.", "ok");
    telaAcessos();
  }catch(e){ toast("Não deu: " + (e.message||e), "err"); }
}

/* ═══════════════════ MINHA EMPRESA (cliente) ═══════════════════ */
function telaEmpresa(){
  const c = CLIENTES[0];
  if(!c){
    $("tela").innerHTML = '<div class="alert yel"><b>Seu acesso ainda não está ligado a uma empresa.</b> ' +
      'Fale com o Giba.</div>';
    return;
  }
  const linha = (r,v) => v ? '<tr><td class="muted" style="padding:6px 10px 6px 0;white-space:nowrap">'+
    esc(r)+'</td><td style="padding:6px 0;font-weight:700">'+esc(v)+'</td></tr>' : '';
  const n = CHOPEIRAS.length;
  $("tela").innerHTML =
    '<div class="card">' +
      '<h2>'+esc(c.nomeFantasia || c.razaoSocial)+'</h2>' +
      '<table style="width:100%;margin-top:8px">' +
        (c.tipoPessoa === "fisica" ?
          linha("Pessoa", "Física") +
          linha("CPF", cpfFormatado(c.cpf))
        :
          linha("Razão social", c.razaoSocial) +
          linha("CNPJ", cnpjFormatado(c.cnpj))
        ) +
        linha("Endereço", c.endereco) +
        linha("Cidade", [c.cidade, c.uf].filter(Boolean).join(" · ")) +
        linha("Contato", c.contato) +
        linha("Telefone", c.telefone) +
      '</table>' +
      '<div style="margin-top:12px"><span class="pill cold">'+n+' chopeira'+(n===1?"":"s")+
        ' cadastrada'+(n===1?"":"s")+'</span></div>' +
      '<div class="esc" style="margin-top:12px">Algum dado errado? Avise o Giba — o cadastro é ' +
        'mantido por ele para não haver duas versões da mesma empresa.</div>' +
    '</div>';
}
