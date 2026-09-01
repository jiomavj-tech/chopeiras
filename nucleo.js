/* ═══════════════════ NÚCLEO ═══════════════════
   As regras que não dependem de tela, de banco nem de rede: validação de
   documento, contas de prazo, soma de orçamento, o texto que o cliente
   lê, o fluxo de status.

   Estão aqui fora por um motivo prático: assim dá para conferi-las no
   Node, em menos de um segundo, sem subir um navegador. Enquanto isso
   custava dois minutos, a conferência era pulada — e foi assim que um
   "else" sem fechar derrubou o aplicativo inteiro sem ninguém notar.

   A regra para mexer aqui: nada neste arquivo pode tocar em document,
   window, db, firebase, nem nas listas globais do aplicativo. Se
   precisar disso, o lugar é o index.html.

   Rodar os testes:  node testes/unidade.js
   ═══════════════════════════════════════════════ */

const esc = s => String(s == null ? "" : s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#39;");

function soDigitos(s){ return String(s||"").replace(/\D/g,""); }

function cnpjFormatado(v){
  const d = soDigitos(v).slice(0,14);
  if(d.length <= 2) return d;
  if(d.length <= 5) return d.slice(0,2)+"."+d.slice(2);
  if(d.length <= 8) return d.slice(0,2)+"."+d.slice(2,5)+"."+d.slice(5);
  if(d.length <= 12) return d.slice(0,2)+"."+d.slice(2,5)+"."+d.slice(5,8)+"/"+d.slice(8);
  return d.slice(0,2)+"."+d.slice(2,5)+"."+d.slice(5,8)+"/"+d.slice(8,12)+"-"+d.slice(12);
}

function cnpjValido(v){
  const d = soDigitos(v);
  if(d.length !== 14) return false;
  if(/^(\d)\1{13}$/.test(d)) return false;
  const calc = (base, pesos) => {
    let s = 0;
    for(let i=0;i<pesos.length;i++) s += Number(base[i]) * pesos[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const dv1 = calc(d, [5,4,3,2,9,8,7,6,5,4,3,2]);
  if(dv1 !== Number(d[12])) return false;
  const dv2 = calc(d, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return dv2 === Number(d[13]);
}

function cpfFormatado(v){
  const d = soDigitos(v).slice(0,11);
  if(d.length <= 3) return d;
  if(d.length <= 6) return d.slice(0,3)+"."+d.slice(3);
  if(d.length <= 9) return d.slice(0,3)+"."+d.slice(3,6)+"."+d.slice(6);
  return d.slice(0,3)+"."+d.slice(3,6)+"."+d.slice(6,9)+"-"+d.slice(9);
}

function cpfValido(v){
  const d = soDigitos(v);
  if(d.length !== 11) return false;
  if(/^(\d)\1{10}$/.test(d)) return false;
  const calc = (base, pos1, pos2) => {
    let s = 0;
    for(let i=0;i<pos1;i++) s += Number(base[i]) * (pos1+1-i);
    const r = s % 11;
    const dv = r < 2 ? 0 : 11 - r;
    return dv === Number(base[pos2]);
  };
  return calc(d, 9, 9) && calc(d, 10, 10);
}

function soWhats(v){
  const d = soDigitos(v);
  return d.length >= 10 ? (d.length <= 11 ? "55"+d : d) : "";
}

function ordenar(lista){
  const t = o => {
    const v = o.atualizadoEm || o.abertoEm;
    return v && v.toDate ? v.toDate().getTime() : 0;
  };
  return lista.sort((a,b) => t(b) - t(a));
}

function componenteVazio(){
  return {tipo:"", marca:"", modelo:"", serie:"", spec:"", obs:""};
}

function componentePreenchido(x){
  return !!(x && (x.tipo || x.marca || x.modelo || x.serie || x.spec || x.obs));
}

function resumoComponente(x){
  return [x.marca, x.modelo, x.serie ? "série " + x.serie : "", x.spec]
    .map(v => (v || "").trim()).filter(Boolean).join(" · ") || "—";
}

function acharPorTipo(lista, tipo){
  return (lista || []).find(x => (x.tipo || "") === tipo);
}

const STATUS = [
  {id:"aberto",           rot:"Chamado aberto",       pill:"cold", cli:"Recebemos o seu chamado. Em breve combinamos a recolha."},
  {id:"recolha_agendada", rot:"Recolha agendada",     pill:"cold", cli:"A recolha está agendada."},
  {id:"recebido",         rot:"Recebido na oficina",  pill:"",     cli:"A chopeira chegou na oficina."},
  {id:"em_teste",         rot:"Em teste",             pill:"",     cli:"Estamos testando para achar o problema."},
  {id:"em_manutencao",    rot:"Em manutenção",        pill:"",     cli:"O conserto está em andamento."},
  {id:"aguardando_peca",  rot:"Aguardando peça",      pill:"pend", cli:"O serviço está parado esperando peça."},
  {id:"orcamento_enviado",   rot:"Aguardando aprovação",  pill:"orc", cli:"O orçamento está no aplicativo, esperando a sua resposta."},
  {id:"orcamento_aprovado",  rot:"Orçamento aprovado",   pill:"ok",  cli:"Orçamento aprovado. O serviço segue."},
  {id:"orcamento_reprovado", rot:"Orçamento não aprovado", pill:"dg", cli:"O orçamento não foi aprovado. Combinamos a devolução."},
  {id:"concluido",        rot:"Manutenção concluída", pill:"ok",   cli:"O serviço está pronto."},
  {id:"entrega_agendada", rot:"Entrega agendada",     pill:"ok",   cli:"A entrega está agendada."},
  {id:"saiu_pra_entrega", rot:"Saiu para entrega",    pill:"ok",   cli:"Sua chopeira saiu para entrega!"},
  {id:"entregue",         rot:"Entregue",             pill:"ok",   cli:"Chopeira entregue. Obrigado!"},
  {id:"cancelado",        rot:"Cancelado",            pill:"dg",   cli:"O chamado foi cancelado."}
];

const ABERTOS = ["aberto","recolha_agendada","recebido","em_teste","em_manutencao",
                 "aguardando_peca","orcamento_enviado","orcamento_aprovado",
                 "orcamento_reprovado","concluido","entrega_agendada"];

function status(id){ return STATUS.find(s => s.id === id) || {id:id, rot:id, pill:"", cli:""}; }

function ehAberto(o){ return ABERTOS.includes(o.status); }

const FLUXO_PADRAO = {
  "aberto": "recolha_agendada",
  "recolha_agendada": "recebido",
  "recebido": "em_teste",
  "em_teste": "em_manutencao",
  "em_manutencao": "concluido",
  "aguardando_peca": "em_manutencao",
  "orcamento_enviado": "orcamento_aprovado",
  "orcamento_aprovado": "concluido",
  "orcamento_reprovado": "cancelado",
  "concluido": "entrega_agendada",
  "entrega_agendada": "saiu_pra_entrega",
  "saiu_pra_entrega": "entregue",
  "entregue": "entregue",
  "cancelado": "cancelado"
};

function proximoStatusSugerido(statusAtual){
  return FLUXO_PADRAO[statusAtual] || null;
}

function numeroLaudo(){
  const d = new Date(), p = n => String(n).padStart(2,"0");
  const sufixo = Math.random().toString(36).slice(2,6).toUpperCase();
  return "LAU-" + String(d.getFullYear()).slice(2) + p(d.getMonth()+1) + p(d.getDate()) + "-" + sufixo;
}

function numeroOS(){
  const d = new Date(), p = n => String(n).padStart(2,"0");
  const sufixo = Math.random().toString(36).slice(2,6).toUpperCase();
  return "OS-" + String(d.getFullYear()).slice(2) + p(d.getMonth()+1) + p(d.getDate()) + "-" + sufixo;
}

function dataCurta(s){
  if(!s) return "";
  const [a,m,d] = String(s).split("-");
  return d ? d + "/" + m + "/" + a.slice(2) : s;
}

function somaDias(iso, dias){
  if(!iso) return "";
  const d = new Date(iso);
  if(isNaN(d)) return "";
  d.setDate(d.getDate() + (Number(dias) || 0));
  return d.toISOString().slice(0,10);
}

function validoAte(o){
  const orc = o && o.orcamento;
  if(!orc || !orc.enviadoEm) return "";
  return somaDias(orc.enviadoEm, orc.validadeDias || 15);
}

function orcamentoVencido(o){
  const ate = validoAte(o);
  if(!ate) return false;
  if(o.decisaoCliente) return false;          /* já respondido, não vence */
  const d = diasAte(ate);
  return d !== null && d < 0;
}

function diasEsperandoResposta(o){
  const orc = o && o.orcamento;
  if(!orc || !orc.enviadoEm || o.status !== "orcamento_enviado") return null;
  const d = diasAte(String(orc.enviadoEm).slice(0,10));
  return d === null ? null : -d;
}

function diasNoStatus(o){
  const h = (o.historico || []).filter(x => x.status === o.status);
  const ult = h[h.length - 1];
  const iso = ult && ult.quando ? String(ult.quando).slice(0,10) : "";
  if(!iso) return null;
  const d = diasAte(iso);
  return d === null ? null : -d;
}

function dataFalada(iso){
  const t = dataCurta(iso);
  return t ? t.slice(0,5) : "";
}

function recadoCliente(o){
  const s = status(o.status) || {};
  let t = s.cli || "";

  const recolha = o.agenda && o.agenda.recolhaPrevista;
  const entrega = o.agenda && o.agenda.entregaPrevista;

  if(o.status === "recolha_agendada" && recolha){
    t = "Passamos para buscar dia " + dataFalada(recolha) + ".";
  }
  if(o.status === "entrega_agendada" && entrega){
    t = "Levamos de volta dia " + dataFalada(entrega) + ".";
  }
  if(o.status === "aberto" && recolha){
    t = "Recebemos o seu pedido. Passamos para buscar dia " + dataFalada(recolha) + ".";
  }
  if(o.status === "orcamento_enviado" && o.orcamento){
    const ate = validoAte(o);
    t = "O orçamento ficou em " + reais(o.orcamento.total) + ".";
    if(o.orcamento.prazoDias){
      t += " Fica pronto em " + o.orcamento.prazoDias + " dia" +
           (Number(o.orcamento.prazoDias) === 1 ? "" : "s") + " depois que você aprovar.";
    }
    if(ate) t += " Responda até " + dataFalada(ate) + ".";
  }
  if(o.status === "orcamento_aprovado" && o.orcamento && o.orcamento.prazoDias){
    t = "Aprovado. Fica pronto em até " + o.orcamento.prazoDias + " dia" +
        (Number(o.orcamento.prazoDias) === 1 ? "" : "s") + ".";
  }
  if(o.status === "concluido"){
    t = entrega ? "Está pronta. Levamos de volta dia " + dataFalada(entrega) + "."
                : "Está pronta. Já combinamos a entrega.";
  }
  return t;
}

function proximoPassoCliente(o){
  if(o.status === "orcamento_enviado" && !o.decisaoCliente){
    return orcamentoVencido(o)
      ? "Este orçamento venceu. Peça um novo para seguir."
      : "Você precisa aprovar ou recusar para eu seguir.";
  }
  return "";
}

const AGENDA_FUSO   = "America/Sao_Paulo";

const AGENDA_HORAS  = 2;

function janelaAgenda(data, hora){
  const dia = String(data || "").slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null;
  const hm = /^\d{2}:\d{2}$/.test(hora || "") ? hora : "09:00";
  const [h, m] = hm.split(":").map(Number);
  const fim = new Date(2000, 0, 1, h + AGENDA_HORAS, m);
  const dois = n => String(n).padStart(2, "0");
  return {
    inicio: dia + "T" + hm + ":00",
    fim:    dia + "T" + dois(Math.min(fim.getHours(), 23)) + ":" + dois(fim.getMinutes()) + ":00"
  };
}

function linkAgenda(dados){
  const janela = janelaAgenda(dados.data, dados.hora);
  if(!janela) return "";
  const cru = s => String(s).replace(/[-:]/g, "");
  return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    "&text="     + encodeURIComponent(dados.titulo || "") +
    "&dates="    + cru(janela.inicio) + "/" + cru(janela.fim) +
    "&details="  + encodeURIComponent(dados.descricao || "") +
    "&location=" + encodeURIComponent(dados.local || "") +
    "&ctz="      + encodeURIComponent(AGENDA_FUSO);
}

function soLetras(s){
  return (s||"").toLowerCase().replace(/[^0-9a-záàâãéêíóôõúüçñ]/gi, "");
}

function arrumarFrase(t){
  t = (t||"").trim();
  if(!t) return "";
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(t) ? t : t + ".";
}

function reais(v){
  return (Number(v) || 0).toLocaleString("pt-BR", {style:"currency", currency:"BRL"});
}

function paraNumero(v){
  const s = String(v == null ? "" : v).trim().replace(/[^\d.,-]/g, "");
  if(!s) return 0;
  if(s.includes(",")) return Number(s.replace(/\./g, "").replace(",", ".")) || 0;
  return Number(s) || 0;
}

function somarOrcamento(itens){
  const soma = t => (itens || []).filter(i => i.tipo === t)
    .reduce((n, i) => n + (Number(i.qtd)||0) * (Number(i.valorUnit)||0), 0);
  const pecas = soma("peca"), servico = soma("servico");
  return {totalPecas: pecas, totalServico: servico, total: pecas + servico};
}

function diaDaOrdem(o){
  const v = o.abertoEm;
  if(v && v.toDate) return v.toDate().toISOString().slice(0,10);
  if(typeof v === "string") return v.slice(0,10);
  return "";
}

function limparNome(s){
  return String(s || "documento").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function hojeISO(){
  const d = new Date(), p = n => String(n).padStart(2,"0");
  return d.getFullYear() + "-" + p(d.getMonth()+1) + "-" + p(d.getDate());
}

function diasAte(iso){
  if(!iso) return null;
  const [a,m,d] = String(iso).split("-").map(Number);
  if(!a || !m || !d) return null;
  const alvo = new Date(a, m-1, d), hoje = new Date();
  hoje.setHours(0,0,0,0); alvo.setHours(0,0,0,0);
  return Math.round((alvo - hoje) / 86400000);
}

/* Em Node vira módulo, para os testes; no navegador esta parte não roda
   e tudo continua global, como o resto do aplicativo espera. */
if(typeof module !== "undefined" && module.exports){
  module.exports = {
    esc,
    soDigitos,
    cnpjFormatado,
    cnpjValido,
    cpfFormatado,
    cpfValido,
    soWhats,
    ordenar,
    componenteVazio,
    componentePreenchido,
    resumoComponente,
    acharPorTipo,
    STATUS,
    ABERTOS,
    status,
    ehAberto,
    FLUXO_PADRAO,
    proximoStatusSugerido,
    numeroLaudo,
    numeroOS,
    dataCurta,
    somaDias,
    validoAte,
    orcamentoVencido,
    diasEsperandoResposta,
    diasNoStatus,
    dataFalada,
    recadoCliente,
    proximoPassoCliente,
    AGENDA_FUSO,
    AGENDA_HORAS,
    janelaAgenda,
    linkAgenda,
    soLetras,
    arrumarFrase,
    reais,
    paraNumero,
    somarOrcamento,
    diaDaOrdem,
    limparNome,
    hojeISO,
    diasAte
  };
}
