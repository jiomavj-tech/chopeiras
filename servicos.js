/* ═══════════════════════════════════════════════════════════════════
   SERVICOS

   Serviços executados na máquina, e o ditado por voz

   Script clássico, não módulo: o aplicativo tem 147 handlers escritos
   no próprio HTML (onclick="salvarCliente()"), e módulo tem escopo
   próprio — todos parariam de funcionar de uma vez. A ordem de
   carregamento está no index.html.
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════ SERVIÇOS EXECUTADOS ═══════════════════
   O que foi feito na máquina neste chamado. Nem todo serviço é troca de
   peça: limpeza, ajuste do pressostato, carga de gás e regulagem são a
   maior parte do trabalho e também precisam ficar registados.

   Quando o serviço É uma troca, ele atualiza a ficha da chopeira de
   uma vez — a peça nova entra como atual e a antiga vai para o
   histórico de trocas. Assim não há duas listas a divergir.          */

const SERVICOS_TIPOS = [
  "Limpeza",
  "Higienização",
  "Ajuste do pressostato",
  "Regulagem de temperatura / pressão",
  "Carga de gás",
  "Troca de peça",
  "Solda / reparo",
  "Teste / diagnóstico",
  "Lubrificação",
  "Outro"
];

function montarServico(){
  editando.modo = "servico";
  editando.servico = {tipo:"", detalhe:"", comp: componenteVazio()};
  verOrdem();
}

function mudarTipoServico(v){
  editando.servico.tipo = v;
  verOrdem();
}
function mudarServico(campo, v){ editando.servico[campo] = v; }
function mudarCompServico(campo, v){ editando.servico.comp[campo] = v; }

function formServico(){
  const s = editando.servico;
  const ehTroca = s.tipo === "Troca de peça";
  const c = CHOPEIRAS.find(x => x.id === editando.dados.chopeiraId);
  const atual = ehTroca && s.comp.tipo ? acharPorTipo(c && c.componentes, s.comp.tipo) : null;

  return '<h3>Registrar serviço</h3>' +
    '<label>O que foi feito</label>' +
    '<select onchange="mudarTipoServico(this.value)">' +
      '<option value="">— escolha —</option>' +
      SERVICOS_TIPOS.map(t => '<option value="' + esc(t) + '"' +
        (s.tipo === t ? " selected" : "") + '>' + esc(t) + '</option>').join("") +
    '</select>' +

    (ehTroca ?
      '<label>Qual componente</label>' +
      '<select onchange="mudarCompServico(\'tipo\',this.value);verOrdem()">' +
        '<option value="">— escolha —</option>' +
        TIPOS_COMPONENTE.map(t => '<option value="' + esc(t) + '"' +
          (s.comp.tipo === t ? " selected" : "") + '>' + esc(t) + '</option>').join("") +
      '</select>' +
      (atual ? '<div class="esc">Estava: ' + esc(resumoComponente(atual)) + '</div>' : '') +
      '<div class="lin">' +
        '<div><label>Marca (peça nova)</label><input value="' + esc(s.comp.marca) +
          '" oninput="mudarCompServico(\'marca\',this.value)"></div>' +
        '<div><label>Modelo</label><input value="' + esc(s.comp.modelo) +
          '" oninput="mudarCompServico(\'modelo\',this.value)"></div>' +
      '</div>' +
      '<div class="lin">' +
        '<div><label>Número de série</label><input value="' + esc(s.comp.serie) +
          '" oninput="mudarCompServico(\'serie\',this.value)"></div>' +
        '<div><label>Especificação</label><input value="' + esc(s.comp.spec) +
          '" oninput="mudarCompServico(\'spec\',this.value)"></div>' +
      '</div>'
    : '') +

    '<label>Detalhe' + (ehTroca ? " (opcional)" : "") + '</label>' +
    '<textarea oninput="mudarServico(\'detalhe\',this.value)" placeholder="' +
      esc(ehTroca ? "Motivo da troca, o que a peça velha apresentava…"
                  : "Pressostato ajustado para cortar a 0,9 bar…") + '">' +
      esc(s.detalhe) + '</textarea>' +

    '<div class="btns">' +
      '<button class="btn pri" id="btServico" onclick="salvarServico()">Registrar</button>' +
      '<button class="btn" onclick="editando.modo=null;verOrdem()">Cancelar</button>' +
    '</div>' +
    '<div class="esc">' +
      (ehTroca ? 'A troca também entra na ficha da chopeira: a peça nova passa a ser a ' +
                 'atual e a antiga vai para o histórico.'
               : 'Fica no chamado e o cliente vê o que foi feito.') +
    '</div>';
}

async function salvarServico(){
  const o = editando.dados;
  const s = editando.servico;

  if(!s.tipo) return toast("Escolha o que foi feito.", "err");
  const ehTroca = s.tipo === "Troca de peça";
  if(ehTroca && !s.comp.tipo) return toast("Escolha qual componente foi trocado.", "err");
  if(ehTroca && !componentePreenchido(s.comp)){
    return toast("Diga ao menos marca ou modelo da peça nova.", "err");
  }
  if(!ehTroca && !s.detalhe.trim()) return toast("Escreva o que foi feito.", "err");

  const agora = new Date().toISOString();
  const registo = {
    quando: agora,
    quem: EU.nome || EU.email || "Giba",
    tipo: s.tipo,
    detalhe: s.detalhe.trim(),
    componente: ehTroca ? Object.assign({}, s.comp) : null
  };

  $("btServico").disabled = true;
  try{
    await db.collection("ordens").doc(o.id).update({
      servicos: (o.servicos || []).concat([registo]),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    o.servicos = (o.servicos || []).concat([registo]);

    /* A troca reflete-se na ficha da chopeira, para não haver duas
       listas a dizer coisas diferentes sobre a mesma máquina. */
    if(ehTroca && o.chopeiraId){
      const c = CHOPEIRAS.find(x => x.id === o.chopeiraId);
      if(c){
        const antes = acharPorTipo(c.componentes, s.comp.tipo);
        const nova = Object.assign(componenteVazio(), s.comp);
        const componentes = (c.componentes || []).filter(x => x.tipo !== s.comp.tipo).concat([nova]);
        const mudanca = {
          componentes: componentes,
          trocas: (c.trocas || []).concat([{
            quando: agora, quem: registo.quem, ordemId: o.id, tipo: s.comp.tipo,
            antes: antes ? resumoComponente(antes) : "(não constava)",
            depois: resumoComponente(nova)
          }])
        };
        /* Sem ficha original ainda: esta passa a ser o ponto de partida. */
        if(!(c.fichaOriginal && (c.fichaOriginal.itens || []).length)){
          mudanca.fichaOriginal = {quando: agora, quem: registo.quem, itens: componentes};
        }
        await db.collection("chopeiras").doc(c.id).update(mudanca);
        Object.assign(c, mudanca);
      }
    }

    editando.modo = null;
    verOrdem();
    toast(ehTroca ? "Troca registada, e a ficha da chopeira foi atualizada."
                  : "Serviço registado.", "ok");
  }catch(e){
    toast("Não deu para registar: " + (e.message || e), "err");
    const b = $("btServico"); if(b) b.disabled = false;
  }
}

/* O que já foi feito neste chamado — o cliente também vê. */
function blocoServicos(o){
  const lista = o.servicos || [];
  if(!lista.length) return "";
  return '<h3>Serviços executados</h3>' +
    lista.slice().reverse().map(s =>
      '<div class="itemOrc">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">' +
          '<b>' + esc(s.tipo) + '</b>' +
          '<span class="esc">' + esc(dataCurta(String(s.quando).slice(0,10))) + '</span>' +
        '</div>' +
        (s.componente ? '<div style="margin-top:2px">' + esc(s.componente.tipo) + ': <b>' +
          esc(resumoComponente(s.componente)) + '</b></div>' : '') +
        (s.detalhe ? '<div style="font-size:13px;margin-top:2px;white-space:pre-wrap">' +
          esc(s.detalhe) + '</div>' : '') +
      '</div>').join("");
}

function verOrdem(){
  const o = editando.dados, s = status(o.status);
  const cho = CHOPEIRAS.find(c => c.id === o.chopeiraId);

  const linhaTempo = (o.historico || []).slice().reverse().map((h,i) => {
    const hs = status(h.status);
    return '<div class="passo' + (i===0 ? " agora" : "") + '">' +
      '<div class="bola"><i class="p-' + (hs.pill||"neutro") + '"></i></div>' +
      '<div class="txt"><div class="pt">' + esc(hs.rot) + '</div>' +
        '<div class="pd">' + esc(quando(h.quando)) + (h.quem ? ' · ' + esc(h.quem) : '') + '</div>' +
        (h.nota ? '<div class="pn">' + esc(h.nota) + '</div>' : '') +
      '</div></div>';
  }).join("");

  const fotos = (o.fotos || []).map((f,i) =>
    '<img id="of_' + i + '" class="foto" style="display:none" alt="Foto do chamado">').join("");

  $("tela").innerHTML =
    '<div class="card">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">' +
        '<div><div class="brand" style="letter-spacing:2px">' + esc(o.numero) + '</div>' +
        '<h2 class="mono" style="font-size:22px">' + esc(o.chopeiraCodigo) + '</h2>' +
        '<div class="muted">' + (cho ? esc([cho.marca, cho.modelo].filter(Boolean).join(" ") ||
          "ficha ainda por completar") : "chopeira não encontrada") +
          (EU.admin ? ' · ' + esc(nomeCliente(o.clienteId)) : '') + '</div></div>' +
        '<span class="pill ' + s.pill + '">' + esc(s.rot) + '</span>' +
      '</div>' +

      (cho && cho.provisorio ? '<div class="alert yel" style="margin-top:12px">' +
        '<b>Cadastro provisório.</b> Esta chopeira foi lançada pelo cliente ao abrir o chamado. ' +
        (EU.admin ? 'Complete a ficha na aba Chopeiras.' : 'O Giba completa a ficha na recolha.') +
        '</div>' : '') +

      '<h3>O que o cliente contou</h3>' +
      '<div style="white-space:pre-wrap">' + esc(o.problemaRelatado || "—") + '</div>' +
      (o.abertoPor && o.abertoPor.nome ? '<div class="esc">por ' + esc(o.abertoPor.nome) +
        ' · ' + esc(quando(o.abertoEm)) + '</div>' : '') +
      fotos +

      ((o.agenda && (o.agenda.recolhaPrevista || o.agenda.entregaPrevista)) ?
        '<h3>Agenda</h3><div style="display:flex;gap:6px;flex-wrap:wrap">' +
          (o.agenda.recolhaPrevista ? '<span class="pill cold">recolha ' +
            esc(dataCurta(o.agenda.recolhaPrevista)) + '</span>' : '') +
          (o.agenda.entregaPrevista ? '<span class="pill cold">entrega ' +
            esc(dataCurta(o.agenda.entregaPrevista)) + '</span>' : '') +
        '</div>' : '') +

      (recadoCliente(o) ? '<div class="alert blu"><b>' + esc(recadoCliente(o)) + '</b>' +
        (proximoPassoCliente(o) ? '<br>' + esc(proximoPassoCliente(o)) : '') + '</div>' : '') +

      blocoOrcamento(o) +
      blocoServicos(o) +
      blocoLaudo(o) +

      '<h3>Andamento</h3><div class="linha">' + linhaTempo + '</div>' +

      (EU.admin
        ? (editando.modo === "orcamento" ? editorOrcamento()
          : editando.modo === "laudo"    ? formLaudo()
          : editando.modo === "servico"  ? formServico()
          : painelAdmin(o))
        : '') +

      '<div class="btns"><button class="btn" onclick="irPara(\'chamados\')">Voltar</button></div>' +
    '</div>';
}

function painelAdmin(o){
  const seguintes = STATUS.filter(s => s.id !== o.status);
  const proximoSugerido = proximoStatusSugerido(o.status);
  const temOrca = o.orcamento && Object.keys(o.orcamento).length > 1;

  return '<h3>Serviço executado</h3>' +
    '<div class="btns" style="margin-top:0">' +
      '<button class="btn" onclick="montarServico()">+ Registrar serviço</button>' +
      ((o.servicos && o.servicos.length)
        ? '<span class="muted" style="align-self:center">' + o.servicos.length +
          ' registado' + (o.servicos.length===1?"":"s") + '</span>'
        : '') +
    '</div>' +
    '<div class="esc">Limpeza, ajuste, carga de gás, troca de peça — o que foi feito na máquina.</div>' +

    '<h3>Orçamento</h3>' +
    '<div class="btns" style="margin-top:0">' +
      '<button class="btn" onclick="montarOrcamento()">' +
        (temOrca ? "Editar orçamento" : "Montar o orçamento") + '</button>' +
      (temOrca ? '<span class="muted" style="align-self:center">' +
        esc(reais(o.orcamento.total)) + '</span>' : '') +
    '</div>' +

    '<h3>Mover o chamado</h3>' +
    '<label>Novo status</label>' +
    '<select id="os_status">' +
      (proximoSugerido ?
        '<option value="' + proximoSugerido + '" style="font-weight:bold;background:#6ba3ff">' +
          esc(status(proximoSugerido).rot) + ' (sugerido)' + '</option>' +
        '<optgroup label="Outros status:">' : '') +
      seguintes.map(s =>
        (s.id === proximoSugerido ? '' :
          '<option value="' + s.id + '">' + esc(s.rot) + '</option>')).join("") +
      (proximoSugerido ? '</optgroup>' : '') +
    '</select>' +
    '<label>Recado para o cliente (opcional)</label>' +
    '<input id="os_nota" placeholder="Compressor testado, o problema é o pressostato">' +
    '<div class="lin">' +
      '<div><label>Recolha prevista</label><input type="date" id="os_recolha" value="' +
        esc((o.agenda&&o.agenda.recolhaPrevista)||"") + '"></div>' +
      '<div><label>Entrega prevista</label><input type="date" id="os_entrega" value="' +
        esc((o.agenda&&o.agenda.entregaPrevista)||"") + '"></div>' +
    '</div>' +
    (ETAPAS.naEntrega.includes(o.status) ?
      '<div class="lin">' +
        '<div><label>Data/hora entrega</label><input type="datetime-local" id="os_entrega_real" value="' +
          esc((o.entrega&&o.entrega.quando)||"") + '"></div>' +
        '<div><label>Local entrega</label><input id="os_entrega_local" placeholder="Endereço de entrega" value="' +
          esc((o.entrega&&o.entrega.local)||"") + '"></div>' +
      '</div>' : '') +
    '<div class="btns">' +
      '<button class="btn pri" id="btMover" onclick="moverOrdem()">Registrar mudança</button>' +
      botaoWhats(o) +
    '</div>' +
    botoesAgendaManual(o) +
    '<div class="esc">Registrar acende o aviso no aplicativo do cliente. O WhatsApp é o empurrão ' +
      'para ele ver hoje.</div>';
}

/* Quando a agenda automática não está ligada, cada compromisso da ordem
   vira um link que abre o Google Agenda já preenchido. */
function botoesAgendaManual(o){
  if(agendaConfigurada()) return "";
  const cs = compromissosDaOrdem(o);
  if(!cs.length) return "";
  return '<div class="btns" style="margin-top:10px">' +
    cs.map(c => '<a class="btn sm" target="_blank" rel="noopener" href="' +
      esc(linkAgenda(c)) + '">Pôr na agenda: ' +
      (c.chave === "recolha" ? "retirada" : "entrega") + '</a>').join("") +
    '</div>';
}

function botaoWhats(o){
  const c = CLIENTES.find(x => x.id === o.clienteId);
  const numero = whatsDo(c);
  if(!numero) return '<button class="btn" disabled title="Sem WhatsApp no cadastro">Sem WhatsApp</button>';
  return '<button class="btn" onclick="avisarWhats(\'' + o.id + '\')">Avisar no WhatsApp</button>';
}

function avisarWhats(id){
  const o = ORDENS.find(x => x.id === id) || editando.dados;
  const c = CLIENTES.find(x => x.id === o.clienteId);
  const numero = whatsDo(c);
  if(!numero) return toast("Esta empresa não tem WhatsApp no cadastro.", "err");

  /* Nada de número de OS nem de subtotais: o cliente não sabe o que é
     OS, e a decomposição peças/serviço só convida a negociar item a
     item. Ele precisa de saber o quê, quando, quanto e o que decidir. */
  const ultima = (o.historico || [])[(o.historico || []).length - 1] || {};
  const passo = proximoPassoCliente(o);
  const texto =
    (c.contato ? "Oi, " + c.contato + "! " : "Oi! ") +
    "Sobre a sua chopeira " + (o.chopeiraCodigo || "") + ":\n\n" +
    recadoCliente(o) +
    (ultima.nota ? "\n" + ultima.nota : "") +
    (passo ? "\n\n" + passo : "") +
    "\n\nQualquer dúvida é só chamar.";
  window.open("https://wa.me/" + numero + "?text=" + encodeURIComponent(texto), "_blank");
}

async function moverOrdem(){
  const o = editando.dados;
  const novo = $("os_status").value;
  const nota = $("os_nota").value.trim();
  if(novo === "orcamento_enviado" && !(o.orcamento && (o.orcamento.itens||[]).length)){
    return toast("Monte o orçamento antes de mandar para o cliente.", "err");
  }
  const agenda = {
    recolhaPrevista: $("os_recolha").value || "",
    entregaPrevista: $("os_entrega").value || ""
  };

  const updateObj = {
    status: novo,
    agenda: agenda,
    historico: firebase.firestore.FieldValue.arrayUnion({status:novo, quando:new Date().toISOString(),
                      quem: EU.nome || "Giba", nota:nota}),
    naoLidoCliente: true,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  };

  if(ETAPAS.naEntrega.includes(novo)){
    const entregaQuando = $("os_entrega_real");
    const entregaLocal = $("os_entrega_local");
    if(entregaQuando && entregaQuando.value){
      updateObj.entrega = {
        quando: entregaQuando.value,
        local: (entregaLocal && entregaLocal.value) || ""
      };
    }
  }

  if(!novo) return;

  /* Concluir sem dizer o que foi feito é o registo que faz falta seis
     meses depois. Avisa, mas não impede: às vezes só se olhou. */
  if(ETAPAS.fechando.includes(novo) && !((o.servicos || []).length)){
    if(!confirm("Nenhum serviço registado neste chamado.\n\n" +
        "Limpeza, ajuste, carga de gás, troca de peça — nada foi anotado. " +
        "Sem isso, daqui a seis meses ninguém sabe o que foi feito nesta máquina.\n\n" +
        "Seguir assim mesmo?")) return;
  }

  $("btMover").disabled = true;
  try{
    await db.collection("ordens").doc(o.id).update(updateObj);
    o.status = novo;
    o.agenda = agenda;
    if(updateObj.entrega) o.entrega = updateObj.entrega;
    o.historico = (o.historico || []).concat([{status:novo, quando:new Date().toISOString(),
                      quem: EU.nome || "Giba", nota:nota}]);
    o.naoLidoCliente = true;

    /* a agenda acompanha a ordem: cria, remarca ou desmarca sozinha */
    const cliente = CLIENTES.find(x => x.id === o.clienteId);
    sincronizarAgenda(o);

    /* notificar cliente */
    ofereceAvisarCliente(o, cliente);

    verOrdem();
    desenharSino();
    toast("Status registrado. Avise no WhatsApp para ele ver hoje.", "ok");
  }catch(e){
    toast("Não deu para registrar: " + (e.message || e), "err");
    const b = $("btMover"); if(b) b.disabled = false;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   DITADO

   Reaproveitado do app de Laudo, com as duas armadilhas já resolvidas
   lá: no celular a escuta termina sozinha depois de um silêncio (por
   isso religa), e o Android reentrega a MESMA fala cada vez maior
   ("está saindo" → "está saindo quente") — somar escrevia a frase
   quatro vezes. A frase nova que começa pela anterior substitui.
   ═══════════════════════════════════════════════════════════════════ */
let dit = {rec:null, ligado:false, alvo:null, fixo:"", aberta:"", lidos:0};


function ditarProblema(){
  if(dit.ligado){ pararDitado(); return; }
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!Rec){
    return toast("Este navegador não faz ditado. Use o microfone do teclado.", "err");
  }
  const alvo = $("ch_problema"), painel = $("ouvindo"), botao = $("btDitar");
  const rec = new Rec();
  rec.lang = "pt-BR"; rec.continuous = true; rec.interimResults = true;

  dit = {rec:rec, ligado:true, alvo:alvo, fixo:alvo.value || "", aberta:"", lidos:0};
  botao.setAttribute("aria-pressed","true");
  botao.textContent = "Parar";
  painel.hidden = false;
  painel.innerHTML = "<b>Ouvindo…</b> fale normalmente; toque em Parar quando acabar.";

  rec.onstart = () => { dit.lidos = 0; };
  rec.onresult = ev => {
    let parcial = "";
    for(let i = 0; i < ev.results.length; i++){
      const r = ev.results[i];
      if(!r.isFinal){ parcial += r[0].transcript; continue; }
      if(i >= dit.lidos){ receberFrase(r[0].transcript); dit.lidos = i + 1; }
      else if(i === dit.lidos - 1){ receberFrase(r[0].transcript); }
    }
    painel.innerHTML = parcial
      ? "<b>… </b>" + esc(parcial)
      : "<b>Ouvindo… </b>toque em Parar quando acabar.";
  };
  rec.onerror = ev => {
    if(ev.error === "no-speech" || ev.error === "aborted") return;
    toast(ev.error === "not-allowed" || ev.error === "service-not-allowed"
      ? "O navegador bloqueou o microfone. Libere nas permissões do site."
      : (ev.error === "network"
          ? "O ditado precisa de internet. Sem sinal, escreva no teclado."
          : "Ditado interrompido: " + ev.error), "err");
    pararDitado();
  };
  rec.onend = () => {
    if(dit.ligado && dit.rec === rec){
      dit.lidos = 0;
      try{ rec.start(); }catch(e){ pararDitado(); }
    }
  };
  try{ rec.start(); }
  catch(e){ toast("Não deu para ligar o microfone.", "err"); pararDitado(); }
}

function receberFrase(bruta){
  const nova = (bruta||"").trim();
  if(!nova) return;
  const anterior = soLetras(dit.aberta), chegou = soLetras(nova);
  if(anterior && chegou.indexOf(anterior) === 0){
    dit.aberta = nova;                        // a mesma fala, mais apurada
  }else{
    const fechada = arrumarFrase(dit.aberta);
    if(fechada) dit.fixo = dit.fixo ? (dit.fixo.replace(/\s+$/,"") + " " + fechada) : fechada;
    dit.aberta = nova;
  }
  escreverDitado();
}

function escreverDitado(){
  if(!dit.alvo) return;
  const partes = [];
  if(dit.fixo) partes.push(dit.fixo.replace(/\s+$/,""));
  const ultima = arrumarFrase(dit.aberta);
  if(ultima) partes.push(ultima);
  const novo = partes.join(" ");
  if(dit.alvo.value === novo) return;
  dit.alvo.value = novo;
  dit.alvo.scrollTop = dit.alvo.scrollHeight;
}

function pararDitado(){
  if(!dit.rec){ dit.ligado = false; return; }
  const rec = dit.rec;
  dit.ligado = false; dit.rec = null;
  try{ rec.onend = null; rec.stop(); }catch(e){}
  const b = $("btDitar"), p = $("ouvindo");
  if(b){ b.setAttribute("aria-pressed","false"); b.textContent = "Ditar"; }
  if(p) p.hidden = true;
  dit.alvo = null; dit.fixo = ""; dit.aberta = ""; dit.lidos = 0;
}
