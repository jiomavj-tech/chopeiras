/* ═══════════════════════════════════════════════════════════════════
   Gera o pecas-compressores.json a partir do app Giba Compressores.

   O catálogo não se escreve à mão: as tabelas de equivalência, de
   material elétrico e de ventiladores vivem no outro aplicativo, e é lá
   que são corrigidas. Este script lê aquelas tabelas e escreve o
   arquivo de dados que o botão "Trazer do Compressores" carrega.

   Uso:
     node ferramentas/gerar-catalogo.mjs [caminho/do/giba-compressores/index.html]

   Por omissão procura em ../giba-compressores/index.html, ao lado deste
   repositório. Depois de gerar, rode `node testes/unidade.js`: há
   verificações que apanham catálogo truncado, repetido ou com preço.

   Uma regra que não se pode perder: o preço vai sempre a zero. O valor
   de venda é do Giba e mora no Firestore dele — se o catálogo trouxesse
   preço, uma regeração apagava a tabela de preços inteira.
   ═══════════════════════════════════════════════════════════════════ */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const AQUI    = path.dirname(fileURLToPath(import.meta.url));
const RAIZ    = path.join(AQUI, '..');
const ORIGEM  = process.argv[2] || path.join(RAIZ, '..', 'giba-compressores', 'index.html');
const DESTINO = path.join(RAIZ, 'pecas-compressores.json');

if(!fs.existsSync(ORIGEM)){
  console.error('Não achei o app de compressores em:\n  ' + ORIGEM +
    '\n\nPasse o caminho:  node ferramentas/gerar-catalogo.mjs /caminho/index.html');
  process.exit(1);
}
const src = fs.readFileSync(ORIGEM, 'utf8');
const bloco = n => { const i = src.indexOf('const '+n+' = ['); const j = src.indexOf('\n];', i);
                     return eval(src.slice(i + ('const '+n+' = ').length, j+2)); };

const MICRO=bloco('MICRO'), AXIAL=bloco('AXIAL'), XREF=bloco('XREF');
const ELGIN_CAP=bloco('ELGIN_CAP'), TECUMSEH_CAT=bloco('TECUMSEH_CAT'), EVAPS=bloco('EVAPS');
const ELGIN_ELET=bloco('ELGIN_ELET'), ELGIN_PTM=bloco('ELGIN_PTM');
const KIT_FG=bloco('KIT_FG'), DICOM_REL=bloco('DICOM_REL'), TEC_KIT=bloco('TEC_KIT'), PTC_OHM=bloco('PTC_OHM');

/* O índice de material elétrico é a leitura que o próprio app de
   compressores faz das tabelas — copiada, não reinterpretada. */
const norm = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g,'');
function indiceComp(){
  const idx={};
  const add=(cod,tipo,comp,extra)=>{
    if(!cod||cod==="—") return;
    const k=norm(cod);
    if(!idx[k]) idx[k]={cod:cod,usos:[]};
    idx[k].usos.push({tipo,comp,extra});
  };
  ELGIN_ELET.forEach(r=>{
    const info="Elgin "+r[0]+" · "+r[3]+" V "+r[4]+" Hz · MCC "+r[1]+" A · LRA "+r[6]+" A";
    add(r[7],"Relé de partida",r[0],info);
    add(r[8],"Protetor térmico",r[0],info);
    if(r[9]&&r[9]!=="—") add(r[9],"Capacitor de partida",r[0],info);
  });
  ELGIN_PTM.forEach(r=>{
    const info="Elgin unidade "+r[0]+" · "+r[1]+" HP · compressor "+r[2]+" · "+r[3]+" V "+r[4]+" Hz";
    add(r[7],"Relé de partida",r[0],info);
    add(r[8],"Capacitor de partida",r[0],info);
    if(r[9]&&r[9]!=="—") add(r[9],"Capacitor de funcionamento",r[0],info);
  });
  KIT_FG.forEach(r=>{
    const info="Embraco "+r[0]+" · "+r[1]+" · kit de ALTO torque (HST)";
    add(r[2],"Relé de partida",r[0],info);
    add(r[3],"Protetor térmico",r[0],info);
    add(r[4],"Capacitor de partida",r[0],info);
  });
  DICOM_REL.forEach(r=>{
    const info=(r[1]!=="—"?"Compressor Tecumseh "+r[1]:"compressor não confirmado")+
      (r[2]!=="—"?" · "+r[2]+" HP":"")+" · "+r[3];
    add(r[0],"Relé amperométrico (DICOM)",r[1],info);
  });
  TEC_KIT.forEach(r=>{
    if(r[1]) add(r[1],"Kit de relé Tecumseh",r[0],"Compressor Tecumseh "+r[0]+(r[2]?" · kit antigo "+r[2]:""));
    if(r[2]) add(r[2],"Kit de relé Tecumseh (código antigo)",r[0],"Compressor "+r[0]+" · substituído por "+r[1]);
    if(r[3]) add(r[3],"Kit de protetor Tecumseh",r[0],"Compressor Tecumseh "+r[0]+(r[4]?" · kit antigo "+r[4]:""));
    if(r[4]) add(r[4],"Kit de protetor Tecumseh (código antigo)",r[0],"Compressor "+r[0]+" · substituído por "+r[3]);
  });
  PTC_OHM.forEach(r=>{
    r[0].split(" · ").forEach(c=>add(c,"PTC",c,"Resistência a frio: "+r[1]+" a "+r[2]+" Ω"));
  });
  return idx;
}

const pecas=[], vistos=new Set();
const por=(cod,item)=>{ const k=String(cod||'').toLowerCase().trim();
  if(!k||vistos.has(k)) return; vistos.add(k); pecas.push(item); };

/* ── peças do circuito da chopeira ── */
[["KP1","Pressostato de baixa KP1 (Danfoss)","Controle","Liga e desliga o compressor pela pressão de sucção — é ele que define a temperatura de corte do chope. Diferencial mínimo 0,7 bar (10 psi)."],
 ["","Pressostato de alta tipo cartucho","Proteção","Desarma e desliga o sistema em caso de alta pressão. É proteção, não controle de temperatura."],
 ["","Pressostato RCP (Robert Shaw)","Controle","Alternativa ao KP1: liga e desliga medindo a pressão do reservatório, regulável conforme o gás."],
 ["","Válvula solenoide (Danfoss) — linha de líquido","Refrigeração","Liga e desliga junto com o compressor; impede a migração de fluido para o compressor parado."],
 ["","Relé de partida magnético","Elétrica","Liga a bobina auxiliar e o capacitor de partida na largada. Em chopeira usa-se magnético ou voltimétrico — não o PTC nem o amperométrico de geladeira."],
 ["","Relé de partida voltimétrico","Elétrica","Alternativa ao magnético. Bobina entre os terminais 5 e 2; contato entre 2 e 1 fecha em repouso."],
 ["","Capacitor de partida (eletrolítico)","Elétrica","Entra só na partida e sai do circuito. Exemplo real: 324 a 389 µF, 110/120 VAC."],
 ["","Capacitor permanente (de marcha)","Elétrica","Fica ligado o tempo todo, mantém o giro e corrige o fator de potência."],
 ["","Protetor térmico","Proteção","Protege o compressor contra sobrecarga. Sem continuidade a frio = condenado."],
 ["","Bomba de recirculação","Chopeira","Motor simples; liga com o pré-resfriador ou por chave própria, conforme o modelo."]
].forEach(([cod,desc,ap,obs]) => pecas.push({codigo:cod,descricao:desc,unidade:"un",precoVenda:0,aplicacao:ap,observacoes:obs}));

/* ── MATERIAL ELÉTRICO com código de peça ── */
const idx = indiceComp();
let nEle = 0;
Object.values(idx).forEach(o => {
  const tipos = [...new Set(o.usos.map(u => u.tipo))];
  const comps = [...new Set(o.usos.map(u => u.comp).filter(c => c && c !== "—"))];
  const extras = [...new Set(o.usos.map(u => u.extra))];
  nEle++;
  por(o.cod, {
    codigo: o.cod,
    descricao: tipos.join(" / ") + " " + o.cod,
    unidade: "un", precoVenda: 0,
    aplicacao: "Material elétrico",
    observacoes: [
      comps.length ? "serve: " + comps.slice(0,12).join(", ") + (comps.length>12 ? " e mais " + (comps.length-12) : "") : "",
      extras.slice(0,2).join(" · ")
    ].filter(Boolean).join(" · ")
  });
});

/* ── compressores ── */
XREF.forEach(x => (x.atual||[]).forEach(mod => por(mod, {
  codigo: mod,
  descricao: "Compressor " + mod + " — " + x.hp + " HP, " + x.gas + " " + x.app,
  unidade:"un", precoVenda:0, aplicacao:"Compressor",
  observacoes: [x.c60 ? x.c60+" kcal/h a 60 Hz":"", x.c50 ? x.c50+" kcal/h a 50 Hz":"",
    (x.antigo||[]).length ? "substitui: "+x.antigo.join(", "):"",
    (x.tecumseh||[]).length ? "equivalente Tecumseh: "+x.tecumseh.join(", "):"",
    (x.elgin||[]).length ? "equivalente Elgin: "+x.elgin.join(", "):""].filter(Boolean).join(" · ")
})));
const iM10 = EVAPS.indexOf(-10);
ELGIN_CAP.forEach(b => (b.linhas||[]).forEach(l => {
  const [mod,hp,desl,con,oleo,peso,caps] = l;
  por(mod, {codigo:mod, descricao:"Compressor "+mod+" — "+hp+" HP, "+b.gas+" (Elgin "+b.fam+")",
    unidade:"un", precoVenda:0, aplicacao:"Compressor",
    observacoes:[desl?desl+" cm³":"", (caps&&caps[iM10])?caps[iM10]+" kcal/h a -10 °C":"",
      b.hz?b.hz+" Hz":"", con?"conexões "+con:"", oleo?"óleo "+oleo+" ml":"", peso?peso+" kg":""].filter(Boolean).join(" · ")});
}));
TECUMSEH_CAT.forEach(r => {
  const [mod,fam,linha,app,gas,volt,desl,cap,un,norma] = r;
  por(mod, {codigo:mod, descricao:"Compressor "+mod+" — "+gas+" "+app+" (Tecumseh "+linha+")",
    unidade:"un", precoVenda:0, aplicacao:"Compressor",
    observacoes:[cap?cap+" "+(un||""):"", desl?desl+" cm³":"", volt||"", norma||"", fam?"família "+fam:""].filter(Boolean).join(" · ")});
});

/* ── ventiladores ── */
MICRO.forEach(r => por(r[0], {codigo:r[0], descricao:"Micromotor "+r[0]+" — "+r[1]+" HP, "+r[4],
  unidade:"un", precoVenda:0, aplicacao:"Ventilador do condensador",
  observacoes:[r[5]+" W", r[6]+" A", r[7]+" m³/h", r[8]+" rpm", "hélice "+r[9], r[10],
    r[11]?"com proteção térmica":"SEM proteção térmica",
    r[0].startsWith("EX")?"linha EX — indicada para R290/R600a":""].filter(Boolean).join(" · ")}));
AXIAL.forEach(r => por(r[0], {codigo:r[0], descricao:"Motoventilador axial "+r[0]+" — "+r[1]+" HP, Ø"+r[2],
  unidade:"un", precoVenda:0, aplicacao:"Ventilador do condensador",
  observacoes:[r[3]+" m³/h (60/50 Hz)", r[4]+" rpm", r[6]+" W", "capacitor "+r[5], r[8]].filter(Boolean).join(" · ")}));

/* Capacitor não tem número de peça: o que o identifica é a faixa em µF
   e a tensão. Se isso ficasse no campo do código, o técnico procuraria
   na frente do cliente por um número que não existe em catálogo nenhum.
   A faixa continua na descrição, que é onde se lê. */
pecas.forEach(p => { if(p.codigo && /µF|\/ ?\d+ ?V|–/.test(p.codigo)) p.codigo = ''; });

fs.writeFileSync(DESTINO, JSON.stringify({
  origem:"Giba Compressores — equivalência, catálogos Elgin/Tecumseh/Embraco, índice de material elétrico, ventiladores e diagrama da chopeira",
  gerado:new Date().toISOString().slice(0,10), pecas}, null, 1) + '\n');

const conta = ap => pecas.filter(p => p.aplicacao === ap).length;
console.log("total:", pecas.length);
console.log("  material elétrico:", conta("Material elétrico"), "(códigos únicos:", nEle + ")");
console.log("  compressores:", conta("Compressor"));
console.log("  ventiladores:", conta("Ventilador do condensador"));
console.log("\nexemplos de material elétrico:");
pecas.filter(p=>p.aplicacao==="Material elétrico").slice(0,4).forEach(p=>{
  console.log("  " + p.codigo + " — " + p.descricao);
  console.log("     " + p.observacoes.slice(0,150));
});
