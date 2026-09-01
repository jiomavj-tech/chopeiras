/* ═══════════════════════════════════════════════════════════════════
   DOCUMENTOS

   Os papéis: motor de PDF, laudo, relatório e avulsos

   Script clássico, não módulo: o aplicativo tem 147 handlers escritos
   no próprio HTML (onclick="salvarCliente()"), e módulo tem escopo
   próprio — todos parariam de funcionar de uma vez. A ordem de
   carregamento está no index.html.
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
   GERADOR DE PDF

   Escrito à mão, sem biblioteca — portado do app de Laudo, onde já
   passou por campo. As fotos entram como JPEG cru (filtro DCTDecode),
   que é o formato que o PDF aceita sem conversão; é por isso que a
   foto é recomprimida em JPEG logo na captura.

   O texto usa Helvetica, das fontes que todo leitor de PDF já tem,
   com codificação WinAnsi — acento de português passa. A tabela de
   larguras abaixo existe para quebrar as linhas na medida certa: o
   PDF não quebra nada sozinho, cada linha é posta por coordenada.
   ═══════════════════════════════════════════════════════════════════ */
const LARG_N = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
  556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,
  667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,
  278,278,278,469,556,333,
  556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,
  334,260,334,584];
const LARG_B = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,
  556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,
  722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,
  333,278,333,584,556,333,
  556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,
  389,280,389,584];

/* Acentuados: cada um empresta a largura da letra base — a de "A com
   acento" e a de "A" são a mesma. O "?" marca os que não seguem essa
   regra e estão listados em EXTRAS. */
const BASES  = 'AAAAAA?CEEEEIIIIDNOOOOO?OUUUUYP?aaaaaa?ceeeeIIIIonooooo?ouuuuypy';
const EXTRAS = {
  0x85:[1000,1000], 0x91:[222,278], 0x92:[222,278], 0x93:[333,500], 0x94:[333,500],
  0x95:[350,350], 0x96:[556,556], 0x97:[1000,1000], 0xA0:[278,278], 0xA7:[556,556],
  0xA9:[737,737], 0xAA:[370,370], 0xAE:[737,737], 0xB0:[400,400], 0xB2:[333,333],
  0xB3:[333,333], 0xB5:[556,556], 0xB7:[278,278], 0xB9:[333,333], 0xBA:[365,365],
  0xC6:[1000,1000], 0xD7:[584,584], 0xDF:[611,611], 0xE6:[889,889], 0xF7:[584,584]
};

/* Sinais fora do WinAnsi. Uns têm código próprio na tabela do PDF (a
   aspa curva não é a aspa reta), outros só se resolvem por escrito —
   e num laudo de refrigeração há mais destes do que parece: µF, Ω, °C. */
const TRANSLITERA = {};
[[0x2018,0x91],[0x2019,0x92],[0x201C,0x93],[0x201D,0x94],
 [0x2013,0x96],[0x2014,0x97],[0x2026,0x85],[0x2022,0x95],
 [0x00A0,0x20],[0x2212,0x2D],[0x2032,0x27],[0x2033,0x22],
 [0x00B5,0xB5],[0x00B0,0xB0]
].forEach(p => { TRANSLITERA[String.fromCharCode(p[0])] = String.fromCharCode(p[1]); });
[[0x2192,'->'],[0x2190,'<-'],[0x2265,'>='],[0x2264,'<='],
 [0x00BD,'1/2'],[0x00BC,'1/4'],[0x2122,'(TM)'],[0x20AC,'EUR'],
 [0x03A9,'ohm'],[0x2126,'ohm'],[0x00B3,'3'],[0x00B2,'2']
].forEach(p => { TRANSLITERA[String.fromCharCode(p[0])] = p[1]; });

function paraWinAnsi(s){
  s = String(s == null ? "" : s).replace(/\r\n?/g, "\n");
  let saida = "";
  for(let i = 0; i < s.length; i++){
    const ch = s.charAt(i), cod = s.charCodeAt(i);
    if(cod === 10 || (cod >= 32 && cod <= 126)){ saida += ch; continue; }
    if(TRANSLITERA[ch] !== undefined){ saida += TRANSLITERA[ch]; continue; }
    /* 0x80–0x9F já são códigos WinAnsi de uma passagem anterior: o texto
       passa por aqui duas vezes, ao quebrar em linhas e ao escrever. */
    if(cod >= 0x80 && cod <= 0xFF){ saida += ch; continue; }
    saida += "?";
  }
  return saida;
}

function largCod(cod, negrito){
  if(cod >= 32 && cod <= 126) return (negrito ? LARG_B : LARG_N)[cod - 32];
  if(cod >= 192 && cod <= 255){
    const b = BASES.charAt(cod - 192);
    if(b !== "?") return (negrito ? LARG_B : LARG_N)[b.charCodeAt(0) - 32];
  }
  const e = EXTRAS[cod];
  return e ? e[negrito ? 1 : 0] : 556;
}
function largura(s, tam, negrito){
  let t = 0;
  for(let i = 0; i < s.length; i++) t += largCod(s.charCodeAt(i), negrito);
  return t * tam / 1000;
}

/* Quebra por palavra; palavra maior que a linha (um código, um modelo de
   compressor) é partida. */
function quebrar(s, larg, tam, negrito){
  const saida = [];
  paraWinAnsi(s).split("\n").forEach(bruta => {
    const palavras = bruta.split(/\s+/).filter(p => p.length);
    if(!palavras.length){ saida.push(""); return; }
    let linha = "";
    palavras.forEach(p => {
      while(largura(p, tam, negrito) > larg && p.length > 1){
        let corte = p.length;
        while(corte > 1 && largura(p.slice(0, corte), tam, negrito) > larg) corte--;
        if(linha){ saida.push(linha); linha = ""; }
        saida.push(p.slice(0, corte));
        p = p.slice(corte);
      }
      const tentativa = linha ? linha + " " + p : p;
      if(largura(tentativa, tam, negrito) <= larg) linha = tentativa;
      else { if(linha) saida.push(linha); linha = p; }
    });
    if(linha) saida.push(linha);
  });
  return saida;
}

function escPDF(s){
  let saida = "";
  for(let i = 0; i < s.length; i++){
    const c = s.charAt(i), cod = s.charCodeAt(i);
    if(c === "\\" || c === "(" || c === ")") saida += "\\" + c;
    else if(cod < 32 || cod > 126) saida += "\\" + ("00" + cod.toString(8)).slice(-3);
    else saida += c;
  }
  return saida;
}
function n2(v){ return String(Math.round(v * 100) / 100); }
function bytesLatin(s){
  const b = new Uint8Array(s.length);
  for(let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255;
  return b;
}
function bytesDeDataUrl(dataUrl){
  const bin = atob(String(dataUrl).split(",")[1] || "");
  const u8 = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function medirImagem(dataUrl){
  return new Promise(ok => {
    const im = new Image();
    im.onload  = () => ok({w: im.naturalWidth, h: im.naturalHeight});
    im.onerror = () => ok(null);
    im.src = dataUrl;
  });
}

const PAG = {w:595.28, h:841.89, ml:46, mr:46, mt:48, mb:56};
const COR = {
  tinta:[0.078,0.110,0.200], fraca:[0.400,0.431,0.549], linha:[0.788,0.804,0.863],
  marca:[0.788,0.482,0.239], papel:[1,1,1],
  ok:[0.118,0.420,0.271], atencao:[0.659,0.314,0.059], critico:[0.608,0.106,0.133]
};

/* Duas passagens: primeiro o conteúdo, que vai criando páginas conforme
   o texto e as fotos ocupam a folha; só no fim se sabe o total, e aí o
   rodapé é escrito em todas. */
function montarLaudo(dados, imagens){
  /* Desenha com o mesmo folhaPDF dos outros documentos. Antes tinha os
     seus próprios ajudantes — 29 linhas iguais às de lá — e qualquer
     correção no motor do PDF tinha de ser feita duas vezes. */
  const f = folhaPDF("Laudo técnico · " + (dados.numeroLaudo || dados.numero) +
                     " · chopeira " + dados.chopeiraCodigo);

  /* ── capa ── */
  f.novaPagina();
  f.escrever(PAG.ml, f.y - 8, "GIBA SOLUÇÕES", 9, true, COR.marca);
  f.y -= 24;
  f.escrever(PAG.ml, f.y - 20, "Laudo técnico de manutenção", 21, true, COR.tinta);
  f.y -= 30;
  f.escrever(PAG.ml, f.y - 10,
           (dados.numeroLaudo ? dados.numeroLaudo + "  ·  " : "") + dados.numero +
           "  ·  chopeira " + dados.chopeiraCodigo + "  ·  " + dados.dataLaudo,
           10, false, COR.fraca);
  f.y -= 20;
  f.risco(PAG.ml, f.y, PAG.w - PAG.mr, f.y, COR.linha, 1);
  f.y -= 20;

  /* ── cliente e equipamento, lado a lado ── */
  const meia = (f.LU - 18) / 2;
  const yTopo = f.y;
  f.escrever(PAG.ml, f.y - 8, "CLIENTE", 8, true, COR.fraca);
  f.y -= 16;
  [dados.cliente.nome, dados.cliente.razao, dados.cliente.cnpj ? "CNPJ " + dados.cliente.cnpj : "",
   dados.cliente.endereco, dados.cliente.cidade].filter(Boolean).forEach(l => {
    f.paragrafo(l, PAG.ml, meia, 9.5, false, COR.tinta, 12.5);
  });
  const yEsq = f.y;

  f.y = yTopo;
  const xd = PAG.ml + meia + 18;
  f.escrever(xd, f.y - 8, "EQUIPAMENTO", 8, true, COR.fraca);
  f.y -= 16;
  [dados.equipamento.codigo, dados.equipamento.marcaModelo, dados.equipamento.tipo,
   dados.equipamento.compressor, dados.equipamento.gas].filter(Boolean).forEach(l => {
    f.paragrafo(l, xd, meia, 9.5, false, COR.tinta, 12.5);
  });
  f.y = Math.min(yEsq, f.y) - 10;
  f.risco(PAG.ml, f.y, PAG.w - PAG.mr, f.y, COR.linha, 0.7);
  f.y -= 6;

  /* ── o corpo ── */
  if(dados.problemaRelatado){
    f.titulo("Reclamação do cliente");
    f.paragrafo(dados.problemaRelatado, PAG.ml, f.LU, 10.5, false, COR.tinta, 14);
  }
  if(dados.problemaConstatado){
    f.titulo("Problema constatado");
    f.paragrafo(dados.problemaConstatado, PAG.ml, f.LU, 10.5, false, COR.tinta, 14);
  }

  if((dados.componentes || []).length){
    f.titulo("Ensaios realizados");
    dados.componentes.forEach(c => {
      f.garantir(46);
      f.y -= 4;
      f.escrever(PAG.ml, f.y - 10, c.nome, 10.5, true, COR.tinta);
      f.y -= 17;
      f.paragrafo(c.ensaios, PAG.ml + 10, f.LU - 10, 9.8, false, COR.tinta, 13);
      if(c.conclusao){
        const c1 = /condena|substitu|troca|defeit/i.test(c.conclusao) ? COR.critico : COR.ok;
        f.garantir(14);
        f.escrever(PAG.ml + 10, f.y - 9, "→ " + c.conclusao, 9.8, true, c1);
        f.y -= 16;
      }
      f.y -= 3;
    });
  }

  if(dados.servicoExecutado || (dados.servicos || []).length){
    f.titulo("Serviço executado");
    if(dados.servicoExecutado){
      f.paragrafo(dados.servicoExecutado, PAG.ml, f.LU, 10.5, false, COR.tinta, 14);
      if((dados.servicos || []).length) f.y -= 8;
    }
    /* O que foi registado na máquina, item a item, com data. É isto que
       responde "o que foi feito" quando o laudo é lido meses depois. */
    (dados.servicos || []).forEach(sv => {
      f.garantir(20);
      f.escrever(PAG.ml, f.y - 9, "•", 10, false, COR.fraca);
      f.escrever(PAG.ml + 12, f.y - 9, sv.tipo, 10, true, COR.tinta);
      f.escrever(PAG.w - PAG.mr - largura(paraWinAnsi(sv.quando), 8.5, false), f.y - 9,
               sv.quando, 8.5, false, COR.fraca);
      f.y -= 14;
      if(sv.peca)    f.paragrafo(sv.peca,    PAG.ml + 12, f.LU - 12, 9.5, false, COR.tinta, 12.5);
      if(sv.detalhe) f.paragrafo(sv.detalhe, PAG.ml + 12, f.LU - 12, 9.5, false, COR.fraca, 12.5);
      f.y -= 5;
    });
  }

  if((dados.pecas || []).length){
    f.titulo("Peças substituídas");
    dados.pecas.forEach(p => {
      f.garantir(15);
      f.escrever(PAG.ml, f.y - 9, "•", 10, false, COR.fraca);
      const t = p.qtd ? p.qtd + " × " + p.descricao : p.descricao;
      f.paragrafo(t, PAG.ml + 12, f.LU - 12 - (p.valor ? 90 : 0), 10, false, COR.tinta, 13.5);
      if(p.valor){
        f.escrever(PAG.w - PAG.mr - largura(paraWinAnsi(p.valor), 10, true), f.y + 13.5 - 9,
                 p.valor, 10, true, COR.tinta);
      }
    });
    if(dados.totais){
      f.y -= 6;
      f.risco(PAG.ml, f.y, PAG.w - PAG.mr, f.y, COR.linha, 0.7);
      f.y -= 16;
      f.escrever(PAG.ml, f.y, "Total do serviço", 10, true, COR.tinta);
      f.escrever(PAG.w - PAG.mr - largura(paraWinAnsi(dados.totais), 11, true), f.y,
               dados.totais, 11, true, COR.marca);
      f.y -= 18;
    }
  }

  /* ── ficha técnica: o que a máquina tem, peça por peça ──
     Vai depois do serviço de propósito: primeiro o que foi feito,
     depois como a máquina ficou. */
  if(((dados.ficha || {}).itens || []).length){
    f.titulo("Ficha técnica do equipamento");
    if(dados.ficha.desde){
      f.paragrafo("Ficha original de " + dados.ficha.desde + ".", PAG.ml, f.LU, 9, false, COR.fraca, 12);
      f.y -= 4;
    }
    dados.ficha.itens.forEach(it => {
      f.garantir(24);
      f.escrever(PAG.ml, f.y - 9, it.tipo, 10, true, COR.tinta);
      const marca = paraWinAnsi(it.estado);
      f.escrever(PAG.w - PAG.mr - largura(marca, 8, true), f.y - 9, it.estado, 8, true,
               it.estado === "original" ? COR.fraca : COR.marca);
      f.y -= 13;
      if(it.resumo) f.paragrafo(it.resumo, PAG.ml + 12, f.LU - 12, 9.5, false, COR.tinta, 12.5);
      if(it.era)    f.paragrafo("era: " + it.era, PAG.ml + 12, f.LU - 12, 8.5, false, COR.fraca, 11.5);
      f.y -= 5;
    });
  }

  if(dados.recomendacoes){
    f.titulo("Recomendações");
    f.paragrafo(dados.recomendacoes, PAG.ml, f.LU, 10.5, false, COR.tinta, 14);
  }

  /* ── fotos ── */
  const fotos = (dados.fotos || []).map(id => imagens[id]).filter(Boolean);
  if(fotos.length){
    f.titulo("Registro fotográfico", 200);
    fotos.forEach(img => {
      const larg = Math.min(f.LU, 330);
      const alt = larg * img.h / img.w;
      f.garantir(alt + 14);
      f.cru("q " + n2(larg) + " 0 0 " + n2(alt) + " " + n2(PAG.ml) + " " +
               n2(f.y - alt) + " cm /" + img.nome + " Do Q");
      f.y -= alt + 14;
    });
  }

  /* ── assinaturas ── */
  f.garantir(96);
  f.y -= 24;
  f.risco(PAG.ml, f.y, PAG.w - PAG.mr, f.y, COR.linha, 0.7);
  f.y -= 34;
  const larguraAss = (f.LU - 30) / 2;
  f.risco(PAG.ml, f.y, PAG.ml + larguraAss, f.y, COR.tinta, 0.7);
  f.risco(PAG.ml + larguraAss + 30, f.y, PAG.w - PAG.mr, f.y, COR.tinta, 0.7);
  f.y -= 12;
  f.escrever(PAG.ml, f.y, dados.tecnico || "Técnico responsável", 9, false, COR.tinta);
  f.escrever(PAG.ml + larguraAss + 30, f.y, dados.cliente.nome || "Cliente", 9, false, COR.tinta);
  f.y -= 11;
  f.escrever(PAG.ml, f.y, "Técnico responsável", 8, false, COR.fraca);
  f.escrever(PAG.ml + larguraAss + 30, f.y, "Recebido por", 8, false, COR.fraca);

  f.rodape(dados.dataLaudo, "laudo");

  return f.paginas;
}

function escreverPDF(paginas, imagens, dados){
  const partes = [], offsets = {};
  let tam = 0, proximo = 1;

  const emitir = u8 => { partes.push(u8); tam += u8.length; };
  const alocar = () => proximo++;
  function objeto(num, corpo, fluxo){
    offsets[num] = tam;
    emitir(bytesLatin(num + " 0 obj\n" + corpo));
    if(fluxo){
      emitir(bytesLatin("\nstream\n"));
      emitir(fluxo);
      emitir(bytesLatin("\nendstream"));
    }
    emitir(bytesLatin("\nendobj\n"));
  }

  const nCatalogo = alocar(), nPaginas = alocar(), nF1 = alocar(), nF2 = alocar(), nInfo = alocar();
  const listaImg = Object.keys(imagens).map(k => imagens[k]);
  listaImg.forEach(img => { img.num = alocar(); });

  const nPag = [], nConteudo = [];
  paginas.forEach(() => { nPag.push(alocar()); nConteudo.push(alocar()); });

  emitir(bytesLatin("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"));
  objeto(nCatalogo, "<< /Type /Catalog /Pages " + nPaginas + " 0 R >>");

  const recImg = listaImg.map(i => "/" + i.nome + " " + i.num + " 0 R").join(" ");
  objeto(nPaginas,
    "<< /Type /Pages /Count " + paginas.length +
    " /Kids [" + nPag.map(n => n + " 0 R").join(" ") + "]" +
    " /MediaBox [0 0 " + n2(PAG.w) + " " + n2(PAG.h) + "]" +
    " /Resources << /Font << /F1 " + nF1 + " 0 R /F2 " + nF2 + " 0 R >>" +
    (recImg ? " /XObject << " + recImg + " >>" : "") + " >> >>");

  objeto(nF1, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objeto(nF2, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  const agora = new Date(), dois = v => ("0" + v).slice(-2);
  const carimbo = "D:" + agora.getFullYear() + dois(agora.getMonth()+1) + dois(agora.getDate()) +
                  dois(agora.getHours()) + dois(agora.getMinutes()) + dois(agora.getSeconds());
  objeto(nInfo,
    "<< /Title (" + escPDF(paraWinAnsi(dados.tituloPDF ||
      ("Laudo técnico " + (dados.numeroLaudo || dados.numero)))) + ")" +
    " /Author (" + escPDF(paraWinAnsi(dados.tecnico || "Giba Soluções")) + ")" +
    " /Creator (Chopeiras) /Producer (Chopeiras) /CreationDate (" + carimbo + ") >>");

  listaImg.forEach(img => {
    objeto(img.num,
      "<< /Type /XObject /Subtype /Image /Width " + img.w + " /Height " + img.h +
      " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
      img.bytes.length + " >>", img.bytes);
  });

  paginas.forEach((pgOps, i) => {
    const fluxo = bytesLatin(pgOps.join("\n"));
    objeto(nConteudo[i], "<< /Length " + fluxo.length + " >>", fluxo);
    objeto(nPag[i], "<< /Type /Page /Parent " + nPaginas + " 0 R /Contents " +
                    nConteudo[i] + " 0 R >>");
  });

  const inicioXref = tam, total = proximo;
  let xref = "xref\n0 " + total + "\n0000000000 65535 f \n";
  for(let n = 1; n < total; n++){
    xref += ("0000000000" + (offsets[n] || 0)).slice(-10) + " 00000 n \n";
  }
  xref += "trailer\n<< /Size " + total + " /Root " + nCatalogo + " 0 R /Info " + nInfo +
          " 0 R >>\nstartxref\n" + inicioXref + "\n%%EOF\n";
  emitir(bytesLatin(xref));

  return new Blob(partes, {type:"application/pdf"});
}

/* ═══════════════════════════════════════════════════════════════════
   LAUDO

   O texto dos ensaios não é inventado aqui: veio da tabela "Testando
   cada peça do diagrama" do app de compressores, escrita pelo Giba e
   marcada lá como CAMPO — critério de técnico, não do fabricante.

   Nenhum ensaio entra sozinho no laudo. O técnico escolhe o que de
   facto mediu, e o texto fica editável: um laudo que descreve um
   ensaio que não foi feito é pior do que laudo nenhum, porque é
   assinado por quem o entrega.
   ═══════════════════════════════════════════════════════════════════ */
const ENSAIOS = [
  {nome:"Protetor térmico", origem:"CAMPO", texto:
    "Continuidade entre os dois terminais no ohmímetro. Sem continuidade a frio, sem ter " +
    "disparado, o componente está condenado."},

  {nome:"Relé de partida magnético", origem:"CAMPO", texto:
    "Resistência da bobina no ohmímetro — poucos ohms, é enrolamento de fio grosso."},

  {nome:"Relé de partida voltimétrico", origem:"CAMPO", texto:
    "Escala 20 kΩ para testar a bobina, entre os terminais 5 e 2. Escala 200 Ω para testar o " +
    "contato, entre 2 e 1 — deve haver continuidade com o relé em repouso, ao contrário do " +
    "relé de corrente comum."},

  {nome:"Capacitor de partida", origem:"CAMPO", texto:
    "Capacitor descarregado antes de qualquer medição, com resistor de 150 kΩ 2 W entre os " +
    "terminais — nunca em curto direto. Medido no capacímetro e comparado com o valor " +
    "impresso no corpo."},

  {nome:"Capacitor permanente", origem:"CAMPO", texto:
    "Mesmo procedimento do capacitor de partida: descarregado antes, medido no capacímetro e " +
    "comparado com o valor impresso no corpo."},

  {nome:"Válvula solenoide", origem:"CAMPO", texto:
    "Resistência da bobina no ohmímetro. Conferida a tensão de alimentação e verificada a " +
    "atração magnética com a bobina energizada, encostando objeto ferroso no núcleo."},

  {nome:"Micromotor do ventilador", origem:"CAMPO", texto:
    "Eixo verificado quanto a giro livre, sem travamento. Resistência da bobina do motor e " +
    "tensão de alimentação medidas. Motor energizado diretamente para confirmar rotação."},

  {nome:"Pressostato de alta (cartucho)", origem:"CAMPO", texto:
    "Continuidade no ohmímetro entre os dois terminais, que deve fechar. Com manifold, " +
    "aplicada pressão para confirmar o desarme no ponto de ajuste."},

  {nome:"Pressostato de baixa (KP1)", origem:"CAMPO", texto:
    "Verificado o corte e o religamento pela pressão de sucção, com manifold, contra os " +
    "pontos de ajuste do equipamento."},

  {nome:"Compressor — checklist completo", origem:"CAMPO", texto:
    "Isolação para a carcaça verificada: nenhum terminal apresenta continuidade com a " +
    "carcaça. Medida a resistência entre as três combinações de terminais e identificados " +
    "comum, start e run pela resistência. Ligação direta com medição de corrente e teste de " +
    "compressão com manifold."},

  {nome:"Estanqueidade e carga", origem:"CAMPO", texto:
    "Sistema pressurizado e verificado quanto a vazamento. Vácuo aplicado antes da carga, e " +
    "carga de gás refrigerante conferida pelas pressões de trabalho."}
];

/* Aviso que anda junto do relé e do protetor: os testes são opostos, e
   trocar um pelo outro condena peça boa e aprova peça ruim. */
const AVISO_RELE = "Relé de corrente e protetor térmico têm testes opostos: em repouso e frio, " +
  "o contato do relé está aberto e o do protetor está fechado. Relé colado fechado mantém o " +
  "enrolamento de partida energizado e queima o compressor em poucos dias.";

function podeLaudo(o){
  return ["concluido", "entrega_agendada", "entregue", "orcamento_reprovado"].includes(o.status);
}

/* ── o que os dois lados veem, depois de emitido ── */
function blocoLaudo(o){
  const l = o.laudo;
  if(!l) return EU.admin && podeLaudo(o)
    ? '<h3>Laudo</h3><div class="btns" style="margin-top:0">' +
      '<button class="btn pri" onclick="montarLaudoForm()">Emitir o laudo</button></div>' +
      '<div class="esc">O laudo é o documento que fica com o cliente: o que foi constatado, ' +
      'o que foi ensaiado e o que foi trocado.</div>'
    : '';

  const comp = (l.componentes || []).map(c =>
    '<div style="margin-bottom:10px">' +
      '<div style="font-weight:700">' + esc(c.nome) + '</div>' +
      '<div class="muted" style="white-space:pre-wrap">' + esc(c.ensaios) + '</div>' +
      (c.conclusao ? '<div style="font-weight:700;color:' +
        (/condena|substitu|troca|defeit/i.test(c.conclusao) ? 'var(--danger)' : 'var(--ok)') +
        '">→ ' + esc(c.conclusao) + '</div>' : '') +
    '</div>').join("");

  return '<h3>Laudo</h3>' +
    '<div class="alert grn" style="margin-top:0"><b>Laudo emitido</b> em ' +
      esc(quando(l.emitidoEm)) + (l.tecnico ? ' por ' + esc(l.tecnico) : '') + '.</div>' +
    (l.problemaConstatado ? '<div style="margin-top:10px"><b>Problema constatado</b>' +
      '<div class="muted" style="white-space:pre-wrap">' + esc(l.problemaConstatado) + '</div></div>' : '') +
    (comp ? '<div style="margin-top:12px"><b>Ensaios realizados</b><div style="margin-top:6px">' +
      comp + '</div></div>' : '') +
    (l.servicoExecutado ? '<div style="margin-top:6px"><b>Serviço executado</b>' +
      '<div class="muted" style="white-space:pre-wrap">' + esc(l.servicoExecutado) + '</div></div>' : '') +
    (l.recomendacoes ? '<div style="margin-top:10px"><b>Recomendações</b>' +
      '<div class="muted" style="white-space:pre-wrap">' + esc(l.recomendacoes) + '</div></div>' : '') +
    '<div class="btns">' +
      '<button class="btn pri" id="btPdf" onclick="baixarLaudo()">Baixar o PDF</button>' +
      (EU.admin ? '<button class="btn" onclick="montarLaudoForm()">Refazer</button>' : '') +
    '</div>';
}

/* ── o formulário, só do lado do Giba ── */
function montarLaudoForm(){
  const o = editando.dados, l = o.laudo;
  const aprovado = o.decisaoCliente && o.decisaoCliente.valor === "aprovado";
  const pecasDoOrcamento = (aprovado && o.orcamento ? o.orcamento.itens : [])
    .filter(i => i.tipo === "peca")
    .map(i => ({descricao:i.descricao, qtd:i.qtd, valorUnit:i.valorUnit}));

  editando.laudo = {
    problemaConstatado: l ? l.problemaConstatado : "",
    componentes: l ? JSON.parse(JSON.stringify(l.componentes || [])) : [],
    servicoExecutado: l ? l.servicoExecutado : "",
    recomendacoes: l ? l.recomendacoes : "",
    pecas: l ? JSON.parse(JSON.stringify(l.pecas || [])) : pecasDoOrcamento,
    tecnico: l ? l.tecnico : (EU.nome || "Giba Soluções")
  };
  editando.modo = "laudo";
  verOrdem();
}

function formLaudo(){
  const e = editando.laudo;
  const usados = e.componentes.map(c => c.nome);

  const cartaoComp = (c, i) =>
    '<div class="itemOrc">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">' +
        '<b>' + esc(c.nome) + '</b>' +
        '<button class="btn dg sm" onclick="tirarEnsaio(' + i + ')">×</button>' +
      '</div>' +
      '<label style="margin-top:8px">Ensaios (edite para o que você fez de verdade)</label>' +
      '<textarea oninput="mudarEnsaio(' + i + ',\'ensaios\',this.value)" ' +
        'style="min-height:88px">' + esc(c.ensaios) + '</textarea>' +
      '<label>Conclusão</label>' +
      '<input value="' + esc(c.conclusao || "") + '" list="conclusoes" ' +
        'placeholder="componente condenado, substituído" ' +
        'oninput="mudarEnsaio(' + i + ',\'conclusao\',this.value)">' +
    '</div>';

  return '<div style="border-top:1px solid var(--line);margin-top:16px;padding-top:4px">' +
    '<h3>Emitir o laudo</h3>' +
    '<div class="alert blu" style="margin-top:0">Os textos de ensaio vêm da sua tabela de testes ' +
      'do app de compressores. <b>Escolha só o que você mediu</b>, e corrija o texto se o ' +
      'ensaio foi outro — quem assina é você.</div>' +

    '<label>Problema constatado</label>' +
    '<textarea id="l_constatado" placeholder="Pressostato de baixa não fechava o contato, ' +
      'deixando o compressor sem partir." style="min-height:80px">' +
      esc(e.problemaConstatado) + '</textarea>' +

    '<h3>Ensaios realizados</h3>' +
    (e.componentes.length ? e.componentes.map(cartaoComp).join("") :
      '<div class="esc">Nenhum ensaio no laudo ainda.</div>') +
    '<datalist id="conclusoes">' +
      ['componente aprovado no ensaio','componente condenado, substituído',
       'dentro do valor especificado','fora do valor especificado',
       'sem continuidade, condenado','substituído por peça nova'].map(c =>
        '<option value="' + esc(c) + '"></option>').join("") +
    '</datalist>' +
    '<label>Acrescentar ensaio</label>' +
    '<select onchange="porEnsaio(this)">' +
      '<option value="">— escolha o componente —</option>' +
      ENSAIOS.map((s, i) => '<option value="' + i + '"' +
        (usados.includes(s.nome) ? " disabled" : "") + '>' + esc(s.nome) + '</option>').join("") +
      '<option value="livre">— outro, escrevo eu —</option>' +
    '</select>' +

    '<h3>Serviço executado</h3>' +
    '<textarea id="l_servico" placeholder="Substituído o pressostato de baixa, refeita a ' +
      'conexão elétrica e testado o ciclo completo." style="min-height:80px">' +
      esc(e.servicoExecutado) + '</textarea>' +

    '<h3>Peças substituídas</h3>' +
    (e.pecas.length
      ? '<div class="esc">Vieram do orçamento aprovado. Tire as que não foram trocadas.</div>' +
        e.pecas.map((p, i) =>
          '<div class="itemOrc" style="display:flex;justify-content:space-between;gap:10px;' +
            'align-items:center"><div>' + esc(p.qtd) + ' × ' + esc(p.descricao) +
            '<div class="dt">' + esc(reais((Number(p.qtd)||0)*(Number(p.valorUnit)||0))) + '</div></div>' +
            '<button class="btn dg sm" onclick="tirarPecaLaudo(' + i + ')">×</button></div>').join("")
      : '<div class="esc">Nenhuma peça — ou o orçamento não foi aprovado, ou o serviço não ' +
        'trocou nada.</div>') +

    '<h3>Recomendações</h3>' +
    '<textarea id="l_recomenda" placeholder="Recomendada a limpeza do condensador a cada ' +
      'três meses.">' + esc(e.recomendacoes) + '</textarea>' +

    '<label>Assina o laudo</label>' +
    '<input id="l_tecnico" value="' + esc(e.tecnico) + '">' +

    '<div class="btns">' +
      '<button class="btn pri" id="btLaudo" onclick="salvarLaudo()">Salvar o laudo</button>' +
      '<button class="btn" onclick="editando.modo=null;verOrdem()">Cancelar</button>' +
    '</div>' +
  '</div>';
}

function porEnsaio(sel){
  const v = sel.value;
  sel.value = "";
  if(!v) return;
  if(v === "livre"){
    const nome = prompt("Nome do componente ou do ensaio:");
    if(!nome || !nome.trim()) return;
    editando.laudo.componentes.push({nome:nome.trim(), ensaios:"", conclusao:""});
  } else {
    const s = ENSAIOS[Number(v)];
    if(!s) return;
    const releOuProtetor = /relé|protetor/i.test(s.nome);
    editando.laudo.componentes.push({
      nome: s.nome,
      ensaios: s.texto + (releOuProtetor ? "\n\n" + AVISO_RELE : ""),
      conclusao: ""
    });
  }
  verOrdem();
}
function mudarEnsaio(i, campo, valor){
  const c = editando.laudo.componentes[i];
  if(c) c[campo] = valor;      /* sem redesenhar: o cursor ficaria para trás */
}
function tirarEnsaio(i){ editando.laudo.componentes.splice(i,1); verOrdem(); }
function tirarPecaLaudo(i){ editando.laudo.pecas.splice(i,1); verOrdem(); }

async function salvarLaudo(){
  const e = editando.laudo, o = editando.dados;
  const laudo = {
    problemaConstatado: $("l_constatado").value.trim(),
    componentes: e.componentes.filter(c => c.nome).map(c => ({
      nome: c.nome, ensaios: (c.ensaios||"").trim(), conclusao: (c.conclusao||"").trim()})),
    servicoExecutado: $("l_servico").value.trim(),
    recomendacoes: $("l_recomenda").value.trim(),
    pecas: e.pecas,
    tecnico: $("l_tecnico").value.trim() || "Giba Soluções",
    emitidoEm: new Date().toISOString(),
    /* reeditar não renumera: o laudo que já saiu tem de continuar o mesmo */
    numero: (o.laudo && o.laudo.numero) || numeroLaudo()
  };
  if(!laudo.problemaConstatado && !laudo.servicoExecutado){
    return toast("Um laudo sem problema constatado nem serviço executado não diz nada.", "err");
  }

  const b = $("btLaudo"); if(b) b.disabled = true;
  try{
    await db.collection("ordens").doc(o.id).update({
      laudo: laudo,
      naoLidoCliente: true,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    o.laudo = laudo;
    o.naoLidoCliente = true;
    editando.modo = null;
    verOrdem();
    desenharSino();
    toast("Laudo emitido. O cliente já pode baixar o PDF.", "ok");
  }catch(err){
    toast("Não deu para salvar: " + (err.message || err), "err");
    if(b) b.disabled = false;
  }
}

/* ── o PDF ── */
async function baixarLaudo(){
  const o = editando.dados, l = o.laudo;
  if(!l) return;
  const b = $("btPdf");
  if(b){ b.disabled = true; b.textContent = "Montando…"; }
  try{
    const c = CLIENTES.find(x => x.id === o.clienteId) || {};
    const cho = CHOPEIRAS.find(x => x.id === o.chopeiraId) || {};

    /* As fotos do chamado entram no laudo: são a prova do estado em que
       o equipamento chegou. */
    const imagens = {};
    let n = 0;
    for(const fid of (o.fotos || [])){
      try{
        const snap = await db.collection("fotos").doc(fid).get();
        if(!snap.exists) continue;
        const url = snap.data().dataUrl;
        const dim = await medirImagem(url);
        if(!dim) continue;
        n++;
        imagens[fid] = {nome:"Im" + n, w:dim.w, h:dim.h, bytes:bytesDeDataUrl(url)};
      }catch(e){ /* uma foto que não vem não impede o laudo */ }
    }

    const aprovado = o.decisaoCliente && o.decisaoCliente.valor === "aprovado";
    const dados = {
      numero: o.numero,
      chopeiraCodigo: o.chopeiraCodigo,
      dataLaudo: quando(l.emitidoEm),
      cliente: {
        nome: c.nomeFantasia || c.razaoSocial || "",
        razao: c.razaoSocial && c.nomeFantasia ? c.razaoSocial : "",
        cnpj: c.cnpj ? cnpjFormatado(c.cnpj) : "",
        endereco: c.endereco || "",
        cidade: [c.cidade, c.uf].filter(Boolean).join(" · ")
      },
      equipamento: {
        codigo: "Chopeira " + (cho.codigo || o.chopeiraCodigo),
        marcaModelo: [cho.marca, cho.modelo].filter(Boolean).join(" "),
        tipo: cho.tipo ? cho.tipo + (cho.torneiras ? " · " + cho.torneiras + " torneiras" : "") : "",
        compressor: [cho.compressorMarca, cho.compressorModelo, cho.compressorHp]
          .filter(Boolean).join(" "),
        gas: cho.compressorGas ? "Gás " + cho.compressorGas : ""
      },
      problemaRelatado: o.problemaRelatado || "",
      problemaConstatado: l.problemaConstatado,
      componentes: l.componentes,
      numeroLaudo: l.numero || "",
      servicoExecutado: l.servicoExecutado,
      ficha: (function(){
        const atuais = cho.componentes || [];
        const orig = (cho.fichaOriginal && cho.fichaOriginal.itens) || [];
        const itens = atuais.map(x => {
          const antes = acharPorTipo(orig, x.tipo);
          const mudou = antes && resumoComponente(antes) !== resumoComponente(x);
          return {tipo: x.tipo, resumo: resumoComponente(x),
                  estado: mudou ? "trocado" : (antes ? "original" : "acrescentado"),
                  era: mudou ? resumoComponente(antes) : ""};
        });
        /* O que saiu e não foi reposto também conta como história. */
        orig.filter(a => !acharPorTipo(atuais, a.tipo)).forEach(a => {
          itens.push({tipo: a.tipo, resumo: "", estado: "retirado", era: resumoComponente(a)});
        });
        return {desde: cho.fichaOriginal
                  ? dataCurta(String(cho.fichaOriginal.quando).slice(0,10)) : "",
                itens: itens};
      })(),
      servicos: (o.servicos || []).map(x => ({
        quando: dataCurta(String(x.quando).slice(0,10)),
        tipo: x.tipo,
        detalhe: x.detalhe || "",
        peca: x.componente ? x.componente.tipo + ": " + resumoComponente(x.componente) : ""
      })),
      recomendacoes: l.recomendacoes,
      pecas: (l.pecas || []).map(p => ({
        descricao: p.descricao, qtd: p.qtd,
        valor: aprovado ? reais((Number(p.qtd)||0) * (Number(p.valorUnit)||0)) : ""
      })),
      totais: aprovado && o.orcamento ? reais(o.orcamento.total) : "",
      fotos: o.fotos || [],
      tecnico: l.tecnico
    };

    const paginas = montarLaudo(dados, imagens);
    const blob = escreverPDF(paginas, imagens, dados);
    const nome = "laudo-" + String(o.numero).toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".pdf";

    /* Partilhar, no celular, abre o WhatsApp direto. Onde não houver,
       cai no download de sempre. */
    const arquivo = new File([blob], nome, {type:"application/pdf"});
    if(navigator.canShare && navigator.canShare({files:[arquivo]})){
      try{
        await navigator.share({files:[arquivo], title:"Laudo " + o.numero});
        return;
      }catch(err){ if(err && err.name === "AbortError") return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast("PDF gerado.", "ok");
  }catch(err){
    toast("Não deu para gerar o PDF: " + (err.message || err), "err");
  }finally{
    const bb = $("btPdf");
    if(bb){ bb.disabled = false; bb.textContent = "Baixar o PDF"; }
  }
}


/* ═══════════════════════════════════════════════════════════════════
   SEMANA

   A fila de chamados responde "em que pé está cada um". Esta tela
   responde outra pergunta, que é a que faz sair de casa: o que buscar,
   o que está parado na bancada, e o que entregar.
   ═══════════════════════════════════════════════════════════════════ */
const GRUPOS = [
  {id:"buscar",  rot:"Buscar",     status: ETAPAS.aBuscar,
   data:"recolhaPrevista",
   vazio:"Nada para buscar."},
  {id:"oficina", rot:"Na oficina", status:["recebido","em_teste","em_manutencao",
                                           "aguardando_peca","orcamento_enviado",
                                           "orcamento_aprovado","orcamento_reprovado"],
   data:null,
   vazio:"A bancada está limpa."},
  {id:"entregar", rot:"Entregar",  status:["concluido","entrega_agendada"],
   data:"entregaPrevista",
   vazio:"Nada pronto para entregar."}
];

/* ═══════════════════ RELATÓRIO DE MANUTENÇÃO ═══════════════════
   O histórico da máquina numa folha só: cada vez que ela veio, a data,
   o número do laudo e o que foi feito — com destaque para o que foi
   trocado. Não é o laudo; é o resumo de todos eles.

   Serve para o cliente responder sozinho "o que já fizeram nesta
   chopeira?" sem abrir laudo por laudo.                              */


function ordensDaChopeira(id){
  return ORDENS.filter(o => o.chopeiraId === id)
    .slice()
    .sort((a,b) => String(diaDaOrdem(a)).localeCompare(String(diaDaOrdem(b))));
}

/* As folhas do relatório usam os mesmos primitivos do laudo, mas em
   caixa própria: o laudo é documento assinado e não se mexe nele. */
function folhaPDF(rodapeTexto){
  const LU = PAG.w - PAG.ml - PAG.mr;
  const paginas = [];
  let ops = null, y = 0;
  const cor = (c, traco) => n2(c[0]) + " " + n2(c[1]) + " " + n2(c[2]) + (traco ? " RG" : " rg");

  const f = {
    get LU(){ return LU; },
    get y(){ return y; },
    set y(v){ y = v; },
    paginas: paginas,
    escrever(x, base, txt, tam, negrito, c){
      txt = paraWinAnsi(txt);
      if(!txt) return;
      ops.push("BT " + cor(c || COR.tinta) + " /" + (negrito ? "F2" : "F1") + " " + n2(tam) +
               " Tf 1 0 0 1 " + n2(x) + " " + n2(base) + " Tm (" + escPDF(txt) + ") Tj ET");
    },
    caixa(x, yy, w, h, c){
      ops.push(cor(c) + " " + n2(x) + " " + n2(yy) + " " + n2(w) + " " + n2(h) + " re f");
    },
    risco(x1, y1, x2, y2, c, esp){
      ops.push(cor(c || COR.linha, true) + " " + n2(esp || 0.7) + " w " +
               n2(x1) + " " + n2(y1) + " m " + n2(x2) + " " + n2(y2) + " l S");
    },
    novaPagina(){
      ops = []; paginas.push(ops);
      y = PAG.h - PAG.mt;
      if(paginas.length > 1){
        f.escrever(PAG.ml, y - 7, rodapeTexto, 8, false, COR.fraca);
        f.risco(PAG.ml, y - 13, PAG.w - PAG.mr, y - 13, COR.linha, 0.7);
        y -= 26;
      }
    },
    garantir(h){ if(y - h < PAG.mb) f.novaPagina(); },
    paragrafo(txt, x, larg, tam, negrito, c, entre){
      entre = entre || tam * 1.38;
      quebrar(txt, larg, tam, negrito).forEach(l => {
        if(l === ""){ y -= entre * 0.5; return; }
        f.garantir(entre);
        f.escrever(x, y - tam * 0.86, l, tam, negrito, c);
        y -= entre;
      });
    },
    /* "arrasta" é quanto do que vem a seguir se quer manter junto do
       título: sem isto um título cai no fim da página e o conteúdo dele
       começa na seguinte, que é feio e confunde quem lê. */
    titulo(txt, arrasta){
      f.garantir(40 + Math.min(arrasta || 30, 300));
      y -= 6;
      f.escrever(PAG.ml, y - 13, txt, 13, true, COR.tinta);
      f.caixa(PAG.ml, y - 19, largura(paraWinAnsi(txt), 13, true), 3.5, COR.marca);
      y -= 30;
    },

    /* rótulo pequeno em cima, valor por baixo — a ficha do cliente e a
       do equipamento são feitas disto. */
    campo(rot, valor, x, larg){
      if(!valor) return;
      f.escrever(x, y - 7, rot.toUpperCase(), 7, true, COR.fraca);
      y -= 11;
      f.paragrafo(valor, x, larg, 10, false, COR.tinta, 13);
      y -= 4;
    },

    /* para o que não passa pelos ajudantes — desenhar imagem, por ora */
    cru(op){ ops.push(op); },
    rodape(dataEmissao, oQue){
      paginas.forEach((pg, i) => {
        const guarda = ops;
        ops = pg;
        f.risco(PAG.ml, PAG.mb - 14, PAG.w - PAG.mr, PAG.mb - 14, COR.linha, 0.7);
        f.escrever(PAG.ml, PAG.mb - 26,
          "Giba Soluções · " + (oQue || "relatório") + " emitido em " + dataEmissao,
          8, false, COR.fraca);
        const t = "Página " + (i + 1) + " de " + paginas.length;
        f.escrever(PAG.w - PAG.mr - largura(paraWinAnsi(t), 8, false), PAG.mb - 26,
          t, 8, false, COR.fraca);
        ops = guarda;
      });
    }
  };
  return f;
}

function montarRelatorio(dados){
  const f = folhaPDF("Relatório de manutenção · chopeira " + dados.chopeiraCodigo);
  f.novaPagina();

  f.escrever(PAG.ml, f.y - 8, "GIBA SOLUÇÕES", 9, true, COR.marca);
  f.y -= 24;
  f.escrever(PAG.ml, f.y - 20, "Relatório de manutenção", 21, true, COR.tinta);
  f.y -= 30;
  f.escrever(PAG.ml, f.y - 10, "Chopeira " + dados.chopeiraCodigo +
    (dados.equipamento ? "  ·  " + dados.equipamento : "") +
    "  ·  " + dados.cliente, 10, false, COR.fraca);
  f.y -= 20;
  f.risco(PAG.ml, f.y, PAG.w - PAG.mr, f.y, COR.linha, 1);
  f.y -= 22;

  /* o cabeçalho que responde à pergunta de uma olhada */
  f.escrever(PAG.ml, f.y - 10, dados.resumo, 11, true, COR.tinta);
  f.y -= 26;

  if(!dados.visitas.length){
    f.paragrafo("Esta chopeira ainda não tem manutenção registada.",
      PAG.ml, f.LU, 10.5, false, COR.fraca, 14);
  }

  dados.visitas.forEach((v, i) => {
    f.garantir(60);
    if(i) f.y -= 6;
    f.risco(PAG.ml, f.y + 6, PAG.w - PAG.mr, f.y + 6, COR.linha, 0.7);
    f.y -= 6;

    /* data à esquerda, números à direita */
    f.escrever(PAG.ml, f.y - 10, v.data, 12, true, COR.marca);
    const ref = [v.numeroLaudo, v.numeroOS].filter(Boolean).join("  ·  ");
    if(ref) f.escrever(PAG.w - PAG.mr - largura(paraWinAnsi(ref), 8.5, false),
                       f.y - 10, ref, 8.5, false, COR.fraca);
    f.y -= 20;

    if(v.problema){
      f.paragrafo(v.problema, PAG.ml, f.LU, 9.5, false, COR.fraca, 12.5);
      f.y -= 3;
    }

    /* primeiro o que foi trocado — é o que ele quer ver de relance */
    v.trocas.forEach(t => {
      f.garantir(16);
      f.caixa(PAG.ml + 1, f.y - 7.5, 4, 4, COR.marca);
      f.paragrafo(t, PAG.ml + 12, f.LU - 12, 10, true, COR.tinta, 13);
    });
    v.outros.forEach(t => {
      f.garantir(15);
      f.escrever(PAG.ml, f.y - 9, "•", 10, false, COR.fraca);
      f.paragrafo(t, PAG.ml + 12, f.LU - 12, 9.5, false, COR.tinta, 12.5);
    });
    if(!v.trocas.length && !v.outros.length){
      f.paragrafo(v.situacao || "Sem serviço registado.",
        PAG.ml + 12, f.LU - 12, 9.5, false, COR.fraca, 12.5);
    }
    f.y -= 8;
  });

  f.rodape(dados.dataEmissao);
  return f.paginas;
}

async function baixarRelatorio(chopeiraId){
  const cho = CHOPEIRAS.find(x => x.id === chopeiraId);
  if(!cho) return toast("Chopeira não encontrada.", "err");

  const ordens = ordensDaChopeira(chopeiraId);
  let trocasTotal = 0;

  const visitas = ordens.map(o => {
    const servicos = o.servicos || [];
    const trocas = servicos.filter(s => s.componente).map(s => {
      trocasTotal++;
      return s.componente.tipo + " — " + resumoComponente(s.componente);
    });
    const outros = servicos.filter(s => !s.componente)
      .map(s => s.tipo + (s.detalhe ? ": " + s.detalhe : ""));
    return {
      data: dataCurta(diaDaOrdem(o)) || "—",
      numeroOS: o.numero || "",
      numeroLaudo: (o.laudo && o.laudo.numero) || "",
      problema: (o.problemaRelatado || "").trim(),
      trocas: trocas,
      outros: outros,
      situacao: "Em andamento — " + ((status(o.status) || {}).rot || o.status)
    };
  });

  const periodo = visitas.length
    ? (visitas[0].data === visitas[visitas.length-1].data
        ? visitas[0].data
        : visitas[0].data + " a " + visitas[visitas.length-1].data)
    : "";
  const resumo = visitas.length
    ? visitas.length + (visitas.length === 1 ? " manutenção" : " manutenções") +
      (periodo ? " · " + periodo : "") +
      (trocasTotal ? " · " + trocasTotal + (trocasTotal === 1 ? " peça trocada" : " peças trocadas")
                   : " · nenhuma peça trocada")
    : "Sem manutenção registada";

  const dados = {
    chopeiraCodigo: cho.codigo || "sem número",
    equipamento: [cho.marca, cho.modelo].filter(Boolean).join(" "),
    cliente: nomeCliente(cho.clienteId),
    dataEmissao: new Date().toLocaleDateString("pt-BR"),
    tecnico: EU.nome || "Giba Soluções",
    numero: "REL-" + (cho.codigo || ""),
    tituloPDF: "Relatório de manutenção · chopeira " + (cho.codigo || ""),
    resumo: resumo,
    visitas: visitas
  };

  try{
    const blob = escreverPDF(montarRelatorio(dados), [], dados);
    const nome = "relatorio-" +
      String(cho.codigo || "chopeira").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".pdf";
    const arquivo = new File([blob], nome, {type:"application/pdf"});
    if(navigator.canShare && navigator.canShare({files:[arquivo]})){
      try{ await navigator.share({files:[arquivo], title:"Relatório " + dados.chopeiraCodigo}); return; }
      catch(e){ /* cancelou: cai no download */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nome; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }catch(e){
    toast("Não deu para gerar: " + (e.message || e), "err");
  }
}

/* ═══════════════════ DOCUMENTOS AVULSOS ═══════════════════
   Nem todo trabalho começa num chamado. Uma instalação, uma visita de
   avaliação, um contrato de manutenção — coisas que precisam de um
   papel na hora, para um cliente que às vezes ainda nem está
   cadastrado.

   Estes dois não ficam guardados: viram PDF e vão embora. Guardar
   exigiria uma coleção nova e regras novas no Firestore, e um orçamento
   de prospecto que nunca vai entrar no aplicativo não ganha nada com
   isso. O que vira serviço nasce como chamado, e aí sim fica gravado.  */

function telaDocumentos(){
  if(editando && editando.tipo === "orcAvulso")  return formOrcAvulso();
  if(editando && editando.tipo === "visita")     return formVisita();

  $("tela").innerHTML =
    '<div class="card">' +
      '<h2>Orçamento avulso</h2>' +
      '<div class="muted">Instalação, visita, contrato — qualquer trabalho que ainda não é um ' +
        'chamado. Sai em PDF e vai para o WhatsApp.</div>' +
      '<div class="btns"><button class="btn pri" onclick="novoOrcAvulso()">Montar orçamento</button></div>' +
    '</div>' +
    '<div class="card">' +
      '<h2>Relatório de visita</h2>' +
      '<div class="muted">O que você viu em cada equipamento numa ida ao cliente, com as duas ' +
        'linhas de assinatura.</div>' +
      '<div class="btns"><button class="btn pri" onclick="novaVisita()">Montar relatório</button></div>' +
    '</div>';
}

/* ── quem é o cliente, escolhido ou escrito ── */
function blocoQuemE(d){
  return '<h3>Para quem</h3>' +
    '<label>Empresa cadastrada</label>' +
    '<select onchange="escolherClienteAvulso(this.value)">' +
      '<option value="">— não cadastrado / escrever à mão —</option>' +
      CLIENTES.map(c => '<option value="' + esc(c.id) + '"' +
        (d.clienteId === c.id ? " selected" : "") + '>' +
        esc(c.nomeFantasia || c.razaoSocial || "sem nome") + '</option>').join("") +
    '</select>' +
    '<div class="lin">' +
      '<div><label>Nome</label><input id="av_nome" value="' + esc(d.nome) +
        '" oninput="editando.dados.nome=this.value"></div>' +
      '<div><label>Telefone</label><input id="av_tel" value="' + esc(d.telefone) +
        '" oninput="editando.dados.telefone=this.value"></div>' +
    '</div>' +
    '<label>Local</label><input id="av_local" value="' + esc(d.local) +
      '" oninput="editando.dados.local=this.value">';
}

function escolherClienteAvulso(id){
  const d = editando.dados;
  d.clienteId = id;
  const c = CLIENTES.find(x => x.id === id);
  if(c){
    d.nome = c.nomeFantasia || c.razaoSocial || "";
    d.telefone = c.whatsapp || c.telefone || "";
    d.local = [c.endereco, c.cidade].filter(Boolean).join(" · ");
  }
  editando.tipo === "visita" ? formVisita() : formOrcAvulso();
}

/* ═══════ orçamento avulso ═══════ */

function novoOrcAvulso(){
  editando = {tipo:"orcAvulso", dados:{
    clienteId:"", nome:"", telefone:"", local:"",
    titulo:"", itens:[{descricao:"", qtd:"1", valorUnit:""}],
    validadeDias:"15", prazoDias:"", observacoes:""
  }};
  telaDocumentos();
}

function mudarItemAvulso(i, campo, v){
  editando.dados.itens[i][campo] = v;
  if(campo !== "descricao") somaAvulsoViva();
}
function novoItemAvulso(){
  editando.dados.itens.push({descricao:"", qtd:"1", valorUnit:""});
  formOrcAvulso();
}
function tirarItemAvulso(i){
  editando.dados.itens.splice(i, 1);
  if(!editando.dados.itens.length) editando.dados.itens.push({descricao:"", qtd:"1", valorUnit:""});
  formOrcAvulso();
}
function somaAvulso(){
  return (editando.dados.itens || []).reduce((t, i) =>
    t + (paraNumero(i.qtd) || 0) * (paraNumero(i.valorUnit) || 0), 0);
}
function somaAvulsoViva(){
  const el = $("somaAvulso");
  if(el) el.textContent = reais(somaAvulso());
}

function formOrcAvulso(){
  const d = editando.dados;
  $("tela").innerHTML =
    '<div class="card">' +
      '<h2>Orçamento avulso</h2>' +
      blocoQuemE(d) +

      '<h3>O trabalho</h3>' +
      '<label>Do que se trata</label>' +
      '<input id="av_titulo" placeholder="Instalação de chopeira de 2 torneiras" value="' +
        esc(d.titulo) + '" oninput="editando.dados.titulo=this.value">' +

      '<h3>Itens</h3>' +
      d.itens.map((i, n) =>
        '<div class="itemOrc">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
            '<b style="font-size:12px;color:var(--copperhi)">' + (n+1) + '</b>' +
            '<button class="btn sm dg" onclick="tirarItemAvulso(' + n + ')">Tirar</button>' +
          '</div>' +
          '<label>Descrição</label>' +
          '<input value="' + esc(i.descricao) +
            '" oninput="mudarItemAvulso(' + n + ',\'descricao\',this.value)">' +
          '<div class="lin">' +
            '<div style="flex:0 0 90px"><label>Qtd</label>' +
              '<input inputmode="decimal" value="' + esc(i.qtd) +
              '" oninput="mudarItemAvulso(' + n + ',\'qtd\',this.value)"></div>' +
            '<div><label>Valor unitário</label>' +
              '<input inputmode="decimal" value="' + esc(i.valorUnit) +
              '" oninput="mudarItemAvulso(' + n + ',\'valorUnit\',this.value)"></div>' +
          '</div>' +
        '</div>').join("") +
      '<div class="btns"><button class="btn" onclick="novoItemAvulso()">+ Item</button></div>' +

      '<table style="width:100%;margin-top:12px">' +
        '<tr><td style="font-weight:800;padding-top:8px;border-top:1px solid var(--line)">Total</td>' +
        '<td id="somaAvulso" style="text-align:right;font-weight:800;font-size:17px;' +
          'color:var(--copperhi);padding-top:8px;border-top:1px solid var(--line)">' +
          esc(reais(somaAvulso())) + '</td></tr>' +
      '</table>' +

      '<div class="lin">' +
        '<div><label>Validade (dias)</label><input inputmode="numeric" value="' +
          esc(d.validadeDias) + '" oninput="editando.dados.validadeDias=this.value"></div>' +
        '<div><label>Fica pronto em (dias)</label><input inputmode="numeric" placeholder="5" value="' +
          esc(d.prazoDias) + '" oninput="editando.dados.prazoDias=this.value"></div>' +
      '</div>' +

      '<label>Observações</label>' +
      '<textarea oninput="editando.dados.observacoes=this.value">' + esc(d.observacoes) + '</textarea>' +

      '<div class="btns">' +
        '<button class="btn pri" onclick="baixarOrcAvulso()">Gerar PDF</button>' +
        '<button class="btn" onclick="whatsOrcAvulso()">Mandar no WhatsApp</button>' +
        '<button class="btn" onclick="irPara(\'avulsos\')">Voltar</button>' +
      '</div>' +
      '<div class="esc">Este orçamento não fica guardado no aplicativo. O que virar serviço, ' +
        'abra como chamado — aí sim entra no histórico da máquina.</div>' +
    '</div>';
}

function validarAvulso(){
  const d = editando.dados;
  if(!d.nome.trim()){ toast("Falta o nome de quem recebe.", "err"); return null; }
  const itens = d.itens.filter(i => i.descricao.trim());
  if(!itens.length){ toast("O orçamento está vazio.", "err"); return null; }
  return itens;
}

function whatsOrcAvulso(){
  const d = editando.dados;
  const itens = validarAvulso();
  if(!itens) return;
  const numero = soWhats(d.telefone);
  if(!numero) return toast("Sem telefone para mandar. Gere o PDF.", "err");

  const texto = "Oi! Aqui é o Giba, das chopeiras.\n\n" +
    (d.titulo ? d.titulo + "\n\n" : "") +
    "Ficou em " + reais(somaAvulso()) + "." +
    (paraNumero(d.prazoDias) ? " Fica pronto em " + d.prazoDias + " dia" +
      (Number(d.prazoDias) === 1 ? "" : "s") + " depois de aprovado." : "") +
    (paraNumero(d.validadeDias) ? " O valor vale por " + d.validadeDias + " dias." : "") +
    "\n\nÉ só me dizer se pode fazer.";
  window.open("https://wa.me/" + numero + "?text=" + encodeURIComponent(texto), "_blank");
}

async function baixarOrcAvulso(){
  const d = editando.dados;
  const itens = validarAvulso();
  if(!itens) return;
  try{
    const paginas = montarAvulso({
      titulo: "Orçamento",
      subtitulo: d.titulo,
      cliente: d, itens: itens, total: somaAvulso(),
      validadeDias: d.validadeDias, prazoDias: d.prazoDias,
      observacoes: d.observacoes,
      dataEmissao: new Date().toLocaleDateString("pt-BR"),
      tecnico: EU.nome || "Giba Soluções"
    });
    baixarPDF(paginas, {
      tituloPDF: "Orçamento — " + d.nome,
      tecnico: EU.nome || "Giba Soluções",
      dataEmissao: new Date().toLocaleDateString("pt-BR")
    }, "orcamento-" + limparNome(d.nome) + ".pdf");
  }catch(e){ toast("Não deu para gerar: " + (e.message || e), "err"); }
}

/* ═══════ relatório de visita ═══════ */

function novaVisita(){
  editando = {tipo:"visita", dados:{
    clienteId:"", nome:"", telefone:"", local:"",
    data: hojeISO(),
    itens:[{equipamento:"", detalhe:""}],
    observacoes:""
  }};
  telaDocumentos();
}

function mudarItemVisita(i, campo, v){ editando.dados.itens[i][campo] = v; }
function novoItemVisita(){
  editando.dados.itens.push({equipamento:"", detalhe:""});
  formVisita();
}
function tirarItemVisita(i){
  editando.dados.itens.splice(i, 1);
  if(!editando.dados.itens.length) editando.dados.itens.push({equipamento:"", detalhe:""});
  formVisita();
}

/* As chopeiras da empresa entram com um toque: escrever à mão o que já
   está cadastrado é erro à espera de acontecer. */
function trazerChopeirasDaVisita(){
  const d = editando.dados;
  if(!d.clienteId) return toast("Escolha a empresa primeiro.", "err");
  const chs = CHOPEIRAS.filter(c => c.clienteId === d.clienteId);
  if(!chs.length) return toast("Esta empresa não tem chopeira cadastrada.", "err");
  const jaTem = e => d.itens.some(i => i.equipamento === e);
  let n = 0;
  chs.forEach(c => {
    const rot = (c.codigo || "sem número") +
      ([c.marca, c.modelo].filter(Boolean).length ? " — " + [c.marca, c.modelo].filter(Boolean).join(" ") : "");
    if(!jaTem(rot)){ d.itens.push({equipamento: rot, detalhe:""}); n++; }
  });
  d.itens = d.itens.filter(i => i.equipamento || i.detalhe);
  if(!d.itens.length) d.itens.push({equipamento:"", detalhe:""});
  formVisita();
  toast(n ? n + " equipamento" + (n===1?"":"s") + " trazido" + (n===1?"":"s") + "."
          : "Já estavam todos na lista.", "ok");
}

function formVisita(){
  const d = editando.dados;
  $("tela").innerHTML =
    '<div class="card">' +
      '<h2>Relatório de visita</h2>' +
      blocoQuemE(d) +
      '<label>Data da visita</label>' +
      '<input type="date" value="' + esc(d.data) + '" oninput="editando.dados.data=this.value">' +

      '<h3>O que foi visto</h3>' +
      (d.clienteId ? '<div class="btns" style="margin-top:0">' +
        '<button class="btn" onclick="trazerChopeirasDaVisita()">Trazer as chopeiras desta empresa</button>' +
      '</div>' : '') +
      d.itens.map((i, n) =>
        '<div class="itemOrc">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
            '<b style="font-size:12px;color:var(--copperhi)">' + (n+1) + '</b>' +
            '<button class="btn sm dg" onclick="tirarItemVisita(' + n + ')">Tirar</button>' +
          '</div>' +
          '<label>Equipamento</label>' +
          '<input value="' + esc(i.equipamento) + '" placeholder="CH-014 — Beertec 2 torneiras" ' +
            'oninput="mudarItemVisita(' + n + ',\'equipamento\',this.value)">' +
          '<label>O que foi visto</label>' +
          '<textarea oninput="mudarItemVisita(' + n + ',\'detalhe\',this.value)">' +
            esc(i.detalhe) + '</textarea>' +
        '</div>').join("") +
      '<div class="btns"><button class="btn" onclick="novoItemVisita()">+ Equipamento</button></div>' +

      '<label>Observações gerais</label>' +
      '<textarea oninput="editando.dados.observacoes=this.value">' + esc(d.observacoes) + '</textarea>' +

      '<div class="btns">' +
        '<button class="btn pri" onclick="baixarVisita()">Gerar PDF</button>' +
        '<button class="btn" onclick="irPara(\'avulsos\')">Voltar</button>' +
      '</div>' +
    '</div>';
}

async function baixarVisita(){
  const d = editando.dados;
  if(!d.nome.trim()) return toast("Falta o nome de quem recebe.", "err");
  const itens = d.itens.filter(i => i.equipamento.trim() || i.detalhe.trim());
  if(!itens.length) return toast("Não há nada registado na visita.", "err");
  try{
    const paginas = montarAvulso({
      titulo: "Relatório de visita",
      subtitulo: "",
      cliente: d, visita: itens,
      dataVisita: dataCurta(d.data),
      observacoes: d.observacoes,
      assinaturas: true,
      dataEmissao: new Date().toLocaleDateString("pt-BR"),
      tecnico: EU.nome || "Giba Soluções"
    });
    baixarPDF(paginas, {
      tituloPDF: "Relatório de visita — " + d.nome,
      tecnico: EU.nome || "Giba Soluções",
      dataEmissao: new Date().toLocaleDateString("pt-BR")
    }, "visita-" + limparNome(d.nome) + ".pdf");
  }catch(e){ toast("Não deu para gerar: " + (e.message || e), "err"); }
}

/* ═══════ o papel ═══════ */


async function baixarPDF(paginas, dados, nome){
  const blob = escreverPDF(paginas, [], dados);
  const arquivo = new File([blob], nome, {type:"application/pdf"});
  if(navigator.canShare && navigator.canShare({files:[arquivo]})){
    try{ await navigator.share({files:[arquivo], title: dados.tituloPDF}); return; }
    catch(e){ /* cancelou: cai no download */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function montarAvulso(d){
  const f = folhaPDF(d.titulo + " · " + (d.cliente.nome || ""));
  f.novaPagina();

  f.escrever(PAG.ml, f.y - 8, "GIBA SOLUÇÕES", 9, true, COR.marca);
  f.y -= 24;
  f.escrever(PAG.ml, f.y - 20, d.titulo, 21, true, COR.tinta);
  f.y -= 30;
  if(d.subtitulo){
    f.paragrafo(d.subtitulo, PAG.ml, f.LU, 11, false, COR.fraca, 14);
    f.y -= 2;
  }
  f.escrever(PAG.ml, f.y - 10, (d.dataVisita ? "Visita em " + d.dataVisita + "  ·  " : "") +
    "Emitido em " + d.dataEmissao, 9.5, false, COR.fraca);
  f.y -= 20;
  f.risco(PAG.ml, f.y, PAG.w - PAG.mr, f.y, COR.linha, 1);
  f.y -= 20;

  f.escrever(PAG.ml, f.y - 8, "PARA", 8, true, COR.fraca);
  f.y -= 16;
  [d.cliente.nome, d.cliente.telefone, d.cliente.local]
    .map(v => (v || "").trim()).filter(Boolean)
    .forEach(l => f.paragrafo(l, PAG.ml, f.LU, 9.5, false, COR.tinta, 12.5));
  f.y -= 6;

  /* itens com valor — o orçamento */
  if(d.itens){
    f.titulo("Itens");
    d.itens.forEach(i => {
      f.garantir(18);
      const qtd = paraNumero(i.qtd) || 0, unit = paraNumero(i.valorUnit) || 0;
      const val = reais(qtd * unit);
      const larguraValor = largura(paraWinAnsi(val), 10, true) + 10;
      f.escrever(PAG.ml, f.y - 9, "•", 10, false, COR.fraca);
      f.escrever(PAG.w - PAG.mr - largura(paraWinAnsi(val), 10, true), f.y - 9, val, 10, true, COR.tinta);
      f.paragrafo(i.descricao, PAG.ml + 12, f.LU - 12 - larguraValor, 10, false, COR.tinta, 13);
      const detalhe = qtd + " × " + reais(unit);
      f.paragrafo(detalhe, PAG.ml + 12, f.LU - 12, 8.5, false, COR.fraca, 11.5);
      f.y -= 4;
    });

    f.garantir(34);
    f.y -= 6;
    f.risco(PAG.ml, f.y, PAG.w - PAG.mr, f.y, COR.linha, 0.7);
    f.y -= 18;
    const tot = reais(d.total);
    f.escrever(PAG.ml, f.y, "Total", 13, true, COR.tinta);
    f.escrever(PAG.w - PAG.mr - largura(paraWinAnsi(tot), 15, true), f.y, tot, 15, true, COR.marca);
    f.y -= 22;

    const notas = [];
    if(paraNumero(d.prazoDias)) notas.push("Fica pronto em " + d.prazoDias + " dia" +
      (Number(d.prazoDias) === 1 ? "" : "s") + " depois de aprovado.");
    if(paraNumero(d.validadeDias)) notas.push("Este valor vale por " + d.validadeDias + " dias.");
    notas.forEach(t => f.paragrafo(t, PAG.ml, f.LU, 9.5, false, COR.fraca, 12.5));
  }

  /* itens sem valor — a visita */
  if(d.visita){
    f.titulo("O que foi visto");
    d.visita.forEach(i => {
      f.garantir(30);
      if(i.equipamento) f.escrever(PAG.ml, f.y - 10, i.equipamento, 11, true, COR.tinta);
      f.y -= 15;
      if(i.detalhe) f.paragrafo(i.detalhe, PAG.ml, f.LU, 10, false, COR.tinta, 13.5);
      f.y -= 8;
    });
  }

  if(d.observacoes){
    f.titulo("Observações");
    f.paragrafo(d.observacoes, PAG.ml, f.LU, 10, false, COR.tinta, 13.5);
  }

  if(d.assinaturas){
    f.garantir(90);
    f.y -= 30;
    const meia = (f.LU - 30) / 2;
    f.risco(PAG.ml, f.y, PAG.ml + meia, f.y, COR.tinta, 0.7);
    f.risco(PAG.ml + meia + 30, f.y, PAG.w - PAG.mr, f.y, COR.tinta, 0.7);
    f.y -= 12;
    f.escrever(PAG.ml, f.y, d.tecnico, 9, false, COR.tinta);
    f.escrever(PAG.ml + meia + 30, f.y, d.cliente.nome || "Cliente", 9, false, COR.tinta);
    f.y -= 11;
    f.escrever(PAG.ml, f.y, "Técnico responsável", 8, false, COR.fraca);
    f.escrever(PAG.ml + meia + 30, f.y, "Recebido por", 8, false, COR.fraca);
  }

  f.rodape(d.dataEmissao, d.itens ? "orçamento" : "relatório");
  return f.paginas;
}


/* Quantos dias faltam (negativo = atrasado). Comparação por texto ISO
   não serve: "2026-09-01" é menor que "2026-1-5" em texto. */

function telaSemana(){
  if(editando && editando.tipo === "verOrdem") return verOrdem();

  const abertas = ORDENS.filter(ehAberto);
  const parados = abertas.filter(o => o.status === "aguardando_peca").length;
  const esperando = abertas.filter(o => o.status === "orcamento_enviado").length;
  const vencidos = abertas.filter(orcamentoVencido).length;
  const atrasados = abertas.filter(o => {
    const iso = (o.agenda || {}).recolhaPrevista || (o.agenda || {}).entregaPrevista;
    const d = iso ? diasAte(iso) : null;
    return d !== null && d < 0;
  }).length;

  const grupo = g => {
    const itens = abertas.filter(o => g.status.includes(o.status))
      .sort((a,b) => {
        const da = g.data && a.agenda ? a.agenda[g.data] : "";
        const db_ = g.data && b.agenda ? b.agenda[g.data] : "";
        if(da && db_) return da.localeCompare(db_);
        if(da) return -1;
        if(db_) return 1;
        return 0;
      });
    return '<h3>' + esc(g.rot) + ' (' + itens.length + ')</h3>' +
      (itens.length ? itens.map(o => cartaoSemana(o, g)).join("") :
        '<div class="esc">' + esc(g.vazio) + '</div>');
  };

  $("tela").innerHTML =
    '<div class="btns" style="margin:0 0 12px"><button class="btn" onclick="atualizar()">Atualizar</button></div>' +
    '<div class="card" style="padding:13px">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<span class="pill cold">' + abertas.length + ' em aberto</span>' +
        (atrasados ? '<span class="pill dg">' + atrasados + ' com data atrasada</span>' : '') +
        (vencidos ? '<span class="pill dg">' + vencidos + ' orçamento' +
          (vencidos===1?"":"s") + ' vencido' + (vencidos===1?"":"s") + '</span>' : '') +
        (parados ? '<span class="pill pend">' + parados + ' esperando peça</span>' : '') +
        (esperando ? '<span class="pill orc">' + esperando + ' esperando resposta</span>' : '') +
      '</div>' +
    '</div>' +
    GRUPOS.map(grupo).join("");
}

function cartaoSemana(o, g){
  const s = status(o.status);
  const iso = g.data && o.agenda ? o.agenda[g.data] : "";
  const d = diasAte(iso);
  let selo = "";
  if(d !== null){
    if(d < 0)       selo = '<span class="pill dg">atrasado ' + (-d) + ' dia' + (d === -1 ? "" : "s") + '</span>';
    else if(d === 0) selo = '<span class="pill pend">hoje</span>';
    else if(d === 1) selo = '<span class="pill cold">amanhã</span>';
    else             selo = '<span class="pill">em ' + d + ' dias</span>';
  } else if(g.data){
    selo = '<span class="pill">sem data</span>';
  }

  /* O que empacou dentro da oficina não tem data de agenda, e por isso
     não aparecia em lado nenhum — um chamado podia ficar três semanas
     parado sem nada a assinalá-lo. Estes selos são essa cobrança. */
  const espera = diasEsperandoResposta(o);
  if(espera !== null && espera > 0){
    selo += '<span class="pill ' + (espera > 7 ? "dg" : "orc") + '">sem resposta há ' +
            espera + ' dia' + (espera === 1 ? "" : "s") + '</span>';
  }
  if(orcamentoVencido(o)){
    selo += '<span class="pill dg">orçamento vencido</span>';
  }
  if(o.status === "aguardando_peca"){
    const parado = diasNoStatus(o);
    selo += '<span class="pill pend">esperando peça' +
            (parado ? " há " + parado + " dia" + (parado === 1 ? "" : "s") : "") + '</span>';
  }

  const urgente = (d !== null && d <= 0) || orcamentoVencido(o) ||
                  (diasEsperandoResposta(o) || 0) > 7;
  return '<div class="reg' + (urgente ? " pend" : "") + '"><div class="top">' +
    '<div style="min-width:0">' +
      '<div class="nm mono">' + esc(o.chopeiraCodigo) + '</div>' +
      '<div class="dt">' + esc(nomeCliente(o.clienteId)) + '</div>' +
      (iso ? '<div class="dt">' + esc(dataCurta(iso)) + '</div>' : '') +
    '</div>' +
    '<button class="btn sm" onclick="abrirDaSemana(\'' + o.id + '\')">Abrir</button>' +
  '</div>' +
  '<div style="margin-top:9px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
    '<span class="pill ' + s.pill + '">' + esc(s.rot) + '</span>' + selo +
  '</div></div>';
}

function abrirDaSemana(id){
  VISTA = "chamados";
  (EU.admin ? ABAS_ADMIN : ABAS_CLIENTE).forEach(a => {
    const b = $("nav_" + a.id);
    if(b) b.className = (a.id === "chamados" ? "on" : "");
  });
  abrirOrdem(id);
}
