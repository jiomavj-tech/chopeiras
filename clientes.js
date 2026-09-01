/* ═══════════════════════════════════════════════════════════════════
   CLIENTES

   Empresas e pessoas: cadastro, e-mails liberados, convite

   Script clássico, não módulo: o aplicativo tem 147 handlers escritos
   no próprio HTML (onclick="salvarCliente()"), e módulo tem escopo
   próprio — todos parariam de funcionar de uma vez. A ordem de
   carregamento está no index.html.
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════ CLIENTES (admin) ═══════════════════ */
/* ═══════════════════ CONVIDAR O CLIENTE ═══════════════════
   O aplicativo não tinha como ser passado adiante: o Giba tinha de
   copiar o endereço à mão e explicar tudo de cabeça, toda vez.

   O texto pede as duas coisas sem as quais o acesso não pode ser
   liberado — o documento e o e-mail com que a pessoa vai entrar — e
   diz porquê, para não parecer burocracia.                          */

function enderecoDoApp(){
  return location.origin + location.pathname.replace(/index\.html$/, "");
}

function textoConvite(c){
  const nome = c ? (c.contato || "") : "";
  return (nome ? "Oi, " + nome + "! " : "Oi! ") +
    "Aqui é o Giba, das chopeiras.\n\n" +
    "Fiz um aplicativo para você acompanhar o serviço da sua chopeira: " +
    "pedir para buscar, ver o orçamento, aprovar e acompanhar até a entrega. " +
    "Não precisa instalar nada.\n\n" +
    enderecoDoApp() + "\n\n" +
    "Para liberar o seu acesso, me manda:\n" +
    "1) CNPJ da empresa (ou CPF, se for em seu nome)\n" +
    "2) o e-mail que você vai usar para entrar\n\n" +
    "Precisa ser um e-mail do Google (gmail), porque é por ele que o " +
    "aplicativo reconhece você. Assim que mandar, eu libero e já dá para usar.";
}

/* Partilhar abre o menu do telemóvel (WhatsApp, mensagem, e-mail).
   Onde não houver, copia — e onde nem isso houver, mostra o texto para
   copiar à mão, que é sempre melhor do que um botão que não faz nada. */
async function convidarCliente(clienteId){
  const c = clienteId ? CLIENTES.find(x => x.id === clienteId) : null;
  const texto = textoConvite(c);

  /* Com o WhatsApp do cliente no cadastro, vai direto para a conversa
     dele — é um toque a menos e não erra o contacto. */
  const numero = whatsDo(c);
  if(numero){
    window.open("https://wa.me/" + numero + "?text=" + encodeURIComponent(texto), "_blank");
    return;
  }

  if(navigator.share){
    try{ await navigator.share({title:"Chopeiras — Giba Soluções", text:texto}); return; }
    catch(e){ if(e && e.name === "AbortError") return; }
  }
  try{
    await navigator.clipboard.writeText(texto);
    toast("Convite copiado. É só colar no WhatsApp.", "ok");
    return;
  }catch(e){ /* sem área de transferência: mostra para copiar à mão */ }

  mostrarConvite(texto);
}

function mostrarConvite(texto){
  $("tela").innerHTML =
    '<div class="card">' +
      '<h2>Convite para o cliente</h2>' +
      '<div class="muted">Copie este texto e mande para ele.</div>' +
      '<textarea id="txtConvite" style="min-height:230px">' + esc(texto) + '</textarea>' +
      '<div class="btns">' +
        '<button class="btn pri" onclick="copiarConvite()">Copiar</button>' +
        '<button class="btn" onclick="irPara(\'clientes\')">Voltar</button>' +
      '</div>' +
    '</div>';
}

function copiarConvite(){
  const t = $("txtConvite");
  t.select(); t.setSelectionRange(0, 99999);
  try{
    document.execCommand("copy");
    toast("Copiado.", "ok");
  }catch(e){
    toast("Selecione o texto e copie à mão.", "err");
  }
}

function telaClientes(){
  if(editando && editando.tipo === "cliente") return formCliente();
  const busca = (window.__buscaCli || "").toLowerCase();
  const lista = CLIENTES.filter(c=>{
    if(!busca) return true;
    return [c.nomeFantasia, c.razaoSocial, c.cnpj, c.cpf, c.cidade]
      .map(x => x || "").join(" ").toLowerCase().includes(busca);
  });

  $("tela").innerHTML =
    '<div class="btns" style="margin:0 0 12px">' +
      '<button class="btn pri" onclick="novoCliente()">+ Nova empresa</button>' +
      '<button class="btn" onclick="convidarCliente()">Convidar cliente</button>' +
      '<button class="btn" onclick="atualizar()">Atualizar</button>' +
    '</div>' +
    '<div class="busca"><input placeholder="Buscar por nome, CNPJ, CPF ou cidade" value="'+esc(window.__buscaCli||"")+
      '" oninput="window.__buscaCli=this.value;telaClientes()"></div>' +
    (lista.length ? lista.map(cartaoCliente).join("") :
      '<div class="vazio">' + (CLIENTES.length ? "Nada encontrado." :
        "Nenhuma empresa cadastrada ainda. Comece pela primeira.") + '</div>');
}

function cartaoCliente(c){
  const n = CHOPEIRAS.filter(x=>x.clienteId === c.id).length;
  const convidados = (c.emailsAutorizados || []).length;
  return '<div class="reg">' +
    '<div class="top"><div style="min-width:0">' +
      '<div class="nm">'+esc(c.nomeFantasia || c.razaoSocial || "sem nome")+'</div>' +
      '<div class="dt">'+esc(c.razaoSocial||"")+'</div>' +
      '<div class="dt mono">'+esc(cnpjFormatado(c.cnpj))+'</div>' +
      '<div class="dt">'+esc([c.cidade, c.uf].filter(Boolean).join(" · "))+'</div>' +
    '</div>' +
    '<div style="display:flex;flex-direction:column;gap:6px;flex:0 0 auto">' +
      '<button class="btn sm" onclick="editarCliente(\''+c.id+'\')">Abrir</button>' +
      '<button class="btn sm" onclick="convidarCliente(\''+c.id+'\')">Convidar</button>' +
    '</div></div>' +
    '<div style="margin-top:9px;display:flex;gap:6px;flex-wrap:wrap">' +
      '<span class="pill cold">'+n+' chopeira'+(n===1?"":"s")+'</span>' +
      '<span class="pill">'+convidados+' e-mail'+(convidados===1?"":"s")+' liberado'+(convidados===1?"":"s")+'</span>' +
    '</div></div>';
}

function novoCliente(){
  editando = {tipo:"cliente", id:null, dados:{
    tipoPessoa:"juridica",
    cnpj:"", razaoSocial:"", nomeFantasia:"", endereco:"", cidade:"", uf:"",
    contato:"", telefone:"", whatsapp:"", emailsAutorizados:[], observacoes:""
  }};
  telaClientes();
}
function editarCliente(id){
  const c = CLIENTES.find(x=>x.id === id);
  if(!c) return;
  editando = {tipo:"cliente", id:id, dados:JSON.parse(JSON.stringify(c))};
  telaClientes();
}

function alterarTipo(){
  const tipo = document.querySelector('input[name="tipo"]:checked').value;
  editando.dados.tipoPessoa = tipo;
  formCliente();
}

function checarCpf(){
  const v = $("f_cpf").value, a = $("cpfAviso");
  const d = soDigitos(v);
  if(!d.length){ a.textContent = ""; a.style.color = ""; return; }
  if(d.length < 11){ a.textContent = "faltam " + (11-d.length) + " dígitos"; a.style.color = ""; return; }
  const ok = cpfValido(v);
  a.textContent = ok ? "CPF confere" : "dígito verificador não bate — confira";
  a.style.color = ok ? "var(--ok)" : "var(--danger)";
}

function formCliente(){
  const d = editando.dados;
  const ehPessoaFisica = d.tipoPessoa === "fisica";
  $("tela").innerHTML =
    '<div class="card">' +
      '<h2>'+(editando.id ? "Editar cliente" : "Novo cliente")+'</h2>' +
      '<div class="muted">Identifique se é pessoa jurídica (CNPJ) ou pessoa física (CPF).</div>' +

      '<h3>Tipo de Cliente</h3>' +
      '<div class="lin" style="gap:20px">' +
        '<div><label><input type="radio" name="tipo" value="juridica" ' +
          ((!ehPessoaFisica) ? "checked" : "") + ' onchange="alterarTipo()"> Pessoa Jurídica (CNPJ)</label></div>' +
        '<div><label><input type="radio" name="tipo" value="fisica" ' +
          (ehPessoaFisica ? "checked" : "") + ' onchange="alterarTipo()"> Pessoa Física (CPF)</label></div>' +
      '</div>' +

      '<h3>Identificação</h3>' +
      (ehPessoaFisica ?
        '<label>CPF</label>' +
        '<input id="f_cpf" inputmode="numeric" value="'+esc(cpfFormatado(d.cpf))+'" ' +
          'oninput="this.value=cpfFormatado(this.value);checarCpf()">' +
        '<div class="esc" id="cpfAviso"></div>' +
        '<label>Nome completo</label><input id="f_nome" value="'+esc(d.nome)+'">'
      :
        '<label>CNPJ</label>' +
        '<input id="f_cnpj" inputmode="numeric" value="'+esc(cnpjFormatado(d.cnpj))+'" ' +
          'oninput="this.value=cnpjFormatado(this.value);checarCnpj()">' +
        '<div class="esc" id="cnpjAviso"></div>' +
        '<label>Razão social</label><input id="f_razao" value="'+esc(d.razaoSocial)+'">' +
        '<label>Nome fantasia</label><input id="f_fantasia" value="'+esc(d.nomeFantasia)+'">'
      ) +

      '<h3>Onde fica</h3>' +
      '<label>Endereço</label><input id="f_endereco" value="'+esc(d.endereco)+'">' +
      '<div class="lin">' +
        '<div><label>Cidade</label><input id="f_cidade" value="'+esc(d.cidade)+'"></div>' +
        '<div style="flex:0 0 90px"><label>UF</label><input id="f_uf" maxlength="2" ' +
          'style="text-transform:uppercase" value="'+esc(d.uf)+'"></div>' +
      '</div>' +

      '<h3>Contato</h3>' +
      '<label>Falar com</label><input id="f_contato" value="'+esc(d.contato)+'">' +
      '<div class="lin">' +
        '<div><label>Telefone</label><input id="f_telefone" inputmode="tel" value="'+esc(d.telefone)+'"></div>' +
        '<div><label>WhatsApp</label><input id="f_whats" inputmode="tel" value="'+esc(d.whatsapp)+'"></div>' +
      '</div>' +
      '<div class="esc">O WhatsApp é por onde os avisos de status vão sair.</div>' +

      '<h3>Quem pode entrar no aplicativo</h3>' +
      '<div id="f_emails_lista" style="margin-bottom:15px"></div>' +
      '<div class="esc">Clique "Liberar" para cada e-mail que pode acessar esta empresa.</div>' +

      '<h3>Observações</h3>' +
      '<textarea id="f_obs">'+esc(d.observacoes||"")+'</textarea>' +

      '<div class="btns">' +
        '<button class="btn pri" id="btSalvar" onclick="salvarCliente()">Salvar</button>' +
        '<button class="btn" onclick="irPara(\'clientes\')">Cancelar</button>' +
        (editando.id ? '<button class="btn dg" onclick="apagarCliente()">Apagar</button>' : '') +
      '</div>' +
    '</div>';
  if(ehPessoaFisica){
    checarCpf();
  } else {
    checarCnpj();
  }
  renderizarEmails();
}

function checarCnpj(){
  const v = $("f_cnpj").value, a = $("cnpjAviso");
  const d = soDigitos(v);
  if(!d.length){ a.textContent = ""; a.style.color = ""; return; }
  if(d.length < 14){ a.textContent = "faltam " + (14-d.length) + " dígitos"; a.style.color = ""; return; }
  const ok = cnpjValido(v);
  a.textContent = ok ? "CNPJ confere" : "dígito verificador não bate — confira";
  a.style.color = ok ? "var(--ok)" : "var(--danger)";
}

function renderizarEmails(){
  const lista = (editando.dados.emailsAutorizados || []).map(e => e.toLowerCase());
  editando.dados.emailsAutorizados = lista;

  let html = '<div style="margin-bottom:15px">';
  html += '<label>Adicionar e-mail</label>';
  html += '<div class="lin" style="margin-bottom:10px">';
  html += '<div><input id="f_email_novo" type="email" placeholder="fulano@empresa.com.br" onkeypress="if(event.key===\'Enter\'){liberarEmail();event.preventDefault()}"></div>';
  html += '<div style="flex:0 0 auto"><button class="btn pri" onclick="liberarEmail()" style="width:100%">Liberar</button></div>';
  html += '</div>';

  if(lista.length > 0){
    html += '<label style="margin-top:12px">E-mails liberados</label>';
    html += lista.map((e, i) =>
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;background:var(--panel2);border-radius:8px;padding:10px;border:1px solid #5FBF7A66">' +
        '<span style="color:var(--ok)">✓</span>' +
        '<div style="flex:1">'+esc(e)+'</div>' +
        '<button class="btn sm" onclick="removerEmail('+i+')" style="flex:0 0 auto;background:#E0655533;border-color:#E0655566;color:var(--danger)">✕</button>' +
      '</div>'
    ).join("");
  }
  html += '</div>';

  $("f_emails_lista").innerHTML = html;
}

function liberarEmail(){
  const input = $("f_email_novo");
  const email = input.value.trim().toLowerCase();

  if(!email){
    return toast("Digite um e-mail", "err");
  }
  if(!email.includes("@") || !email.includes(".")){
    return toast("E-mail inválido", "err");
  }

  if(!editando.dados.emailsAutorizados) editando.dados.emailsAutorizados = [];
  if(editando.dados.emailsAutorizados.includes(email)){
    return toast("Este e-mail já foi liberado", "err");
  }

  editando.dados.emailsAutorizados.push(email);
  input.value = "";
  renderizarEmails();
  toast("E-mail adicionado! Clique 'Salvar' para confirmar.", "ok");
}

function removerEmail(i){
  editando.dados.emailsAutorizados.splice(i, 1);
  renderizarEmails();
}

async function salvarCliente(){
  const ehPessoaFisica = document.querySelector('input[name="tipo"]:checked').value === "fisica";

  const dados = {
    tipoPessoa: ehPessoaFisica ? "fisica" : "juridica",
    endereco: $("f_endereco").value.trim(),
    cidade: $("f_cidade").value.trim(),
    uf: $("f_uf").value.trim().toUpperCase(),
    contato: $("f_contato").value.trim(),
    telefone: $("f_telefone").value.trim(),
    whatsapp: $("f_whats").value.trim(),
    emailsAutorizados: (editando.dados.emailsAutorizados || []).map(e => e.toLowerCase()),
    observacoes: $("f_obs").value.trim()
  };

  if(ehPessoaFisica){
    const cpf = soDigitos($("f_cpf").value);
    const nome = $("f_nome").value.trim();

    if(!nome){
      return toast("Falta o nome da pessoa.", "err");
    }
    if(cpf && !cpfValido(cpf)){
      return toast("O CPF não confere. Corrija ou deixe em branco.", "err");
    }

    dados.cpf = cpf;
    dados.nome = nome;
    dados.nomeFantasia = nome;

    const repetido = CLIENTES.find(c => c.cpf && c.cpf === cpf && c.id !== editando.id);
    if(repetido){
      return toast("Este CPF já está cadastrado.", "err");
    }
  } else {
    dados.cnpj = soDigitos($("f_cnpj").value);
    dados.razaoSocial = $("f_razao").value.trim();
    dados.nomeFantasia = $("f_fantasia").value.trim();

    if(!dados.razaoSocial && !dados.nomeFantasia){
      return toast("Falta o nome da empresa.", "err");
    }
    if(dados.cnpj && !cnpjValido(dados.cnpj)){
      return toast("O CNPJ não confere. Corrija ou deixe em branco.", "err");
    }

    const repetidoCnpj = CLIENTES.find(c => c.cnpj && c.cnpj === dados.cnpj && c.id !== editando.id);
    if(repetidoCnpj){
      return toast("Esta empresa já está em " +
        (repetidoCnpj.nomeFantasia || repetidoCnpj.razaoSocial) + ".", "err");
    }
  }

  $("btSalvar").disabled = true;
  try{
    let id = editando.id;

    if(id){
      await db.collection("clientes").doc(id).update(dados);
    } else {
      dados.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
      const ref = await db.collection("clientes").add(dados);
      id = ref.id;
    }

    /* Os convites são o que permite a pessoa entrar já ligada à empresa.
       Um documento por e-mail, que só o dono daquele e-mail consegue ler.
       Regravar todos (e não só os novos) é de propósito: é barato, e
       conserta sozinho qualquer convite que tenha se perdido. */
    const anteriores = editando.id
      ? ((CLIENTES.find(c=>c.id === editando.id) || {}).emailsAutorizados || [])
          .map(e => String(e).toLowerCase())
      : [];
    const saíram = anteriores.filter(e => !dados.emailsAutorizados.includes(e));

    await Promise.all([].concat(
      dados.emailsAutorizados.map(e => db.collection("convites").doc(e).set({
        clienteId: id, criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      })),
      saíram.map(e => db.collection("convites").doc(e).delete())
    ));

    await recarregar();
    irPara("clientes");
    toast("Empresa salva.", "ok");
  }catch(e){
    toast("Não deu para salvar: " + (e.message || e), "err");
    const b = $("btSalvar"); if(b) b.disabled = false;
  }
}

async function apagarCliente(){
  const id = editando.id;
  const n = CHOPEIRAS.filter(c=>c.clienteId === id).length;
  if(n){
    return toast("Esta empresa tem " + n + " chopeira" + (n===1?"":"s") +
      ". Mova ou apague antes.", "err");
  }
  if(!confirm("Apagar esta empresa? Não dá para desfazer.")) return;
  try{
    const emails = (editando.dados.emailsAutorizados || []).map(e => String(e).toLowerCase());
    await Promise.all(emails.map(e =>
      db.collection("convites").doc(e).delete().catch(()=>{})));
    await db.collection("clientes").doc(id).delete();
    await recarregar();
    irPara("clientes");
    toast("Empresa apagada.", "ok");
  }catch(e){
    toast("Não deu para apagar: " + (e.message || e), "err");
  }
}
