// Preenche os campos de formulário (FORMTEXT / FORMCHECKBOX) de um .docx.
// Os campos são identificados pela ordem em que aparecem no documento.
const escXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Linhas de altura fixa que levam texto longo passam a «pelo menos», para o texto não ficar cortado.
function alargarLinhasLongas(xml, textos) {
  const reCampo = /<w:fldChar w:fldCharType="begin">/g; const linhas = new Set(); let nT = 0; let m;
  while ((m = reCampo.exec(xml))) {
    const fim = xml.indexOf('</w:fldChar>', m.index);
    if (!xml.slice(m.index, fim).includes('<w:textInput')) continue;
    const idx = nT++; const t = textos[idx];
    if (t && (String(t).length > 90 || String(t).includes('\n'))) linhas.add(Math.max(xml.lastIndexOf('<w:tr>', m.index), xml.lastIndexOf('<w:tr ', m.index)));
  }
  for (const ini of [...linhas].sort((a, b) => b - a)) {
    const fimPr = xml.indexOf('</w:trPr>', ini); const fimTr = xml.indexOf('</w:tr>', ini);
    if (fimPr < 0 || fimPr > fimTr) continue;
    xml = xml.slice(0, ini) + xml.slice(ini, fimPr).replace(/w:hRule="exact"/g, 'w:hRule="atLeast"') + xml.slice(fimPr);
  }
  return xml;
}

export function preencherXml(xml, textos = {}, marcas = {}) {
  xml = alargarLinhasLongas(xml, textos);
  let iT = 0; let iC = 0; let nT = 0; let nC = 0; let pos = 0; let saida = '';
  const reCampo = /<w:fldChar w:fldCharType="begin">/g;
  let m;
  while ((m = reCampo.exec(xml))) {
    const ini = m.index;
    const fimBegin = xml.indexOf('</w:fldChar>', ini);
    const ff = xml.slice(ini, fimBegin);
    const ehTexto = ff.includes('<w:textInput'); const ehCheck = ff.includes('<w:checkBox');
    if (!ehTexto && !ehCheck) continue;
    const idx = ehTexto ? nT++ : nC++;
    if (ehTexto) {
      const sep = xml.indexOf('w:fldCharType="separate"', fimBegin);
      const fim = xml.indexOf('w:fldCharType="end"', sep);
      if (sep < 0 || fim < 0 || !(idx in textos)) continue;
      // região entre "separate" e "end": substituir o texto do resultado
      const aSep = xml.indexOf('</w:r>', sep) + 6;
      const aFim = xml.lastIndexOf('<w:r>', fim) >= aSep ? xml.lastIndexOf('<w:r>', fim) : xml.lastIndexOf('<w:r ', fim);
      const meio = xml.slice(aSep, aFim);
      const rprMatch = meio.match(/<w:rPr>.*?<\/w:rPr>/s);
      let rpr = rprMatch ? rprMatch[0] : '<w:rPr></w:rPr>';
      if (!rpr.includes('w:rFonts')) rpr = rpr.replace('<w:rPr>', '<w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow" w:cs="Arial"/>');
      if (!rpr.includes('<w:sz ')) rpr = rpr.replace('</w:rPr>', '<w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>');
      const novo = `<w:r>${rpr}<w:t xml:space="preserve">${String(textos[idx]).split('\n').map(escXml).join('</w:t><w:br/><w:t xml:space="preserve">')}</w:t></w:r>`;
      saida += xml.slice(pos, aSep) + novo; pos = aFim; reCampo.lastIndex = aFim;
    } else if (idx in marcas) {
      const cb = xml.indexOf('<w:checkBox>', ini);
      const fimCb = xml.indexOf('</w:checkBox>', cb);
      let bloco = xml.slice(cb, fimCb).replace(/<w:default[^>]*\/>|<w:checked[^>]*\/>/g, '');
      bloco += marcas[idx] ? '<w:default w:val="1"/><w:checked/>' : '';
      saida += xml.slice(pos, cb) + bloco; pos = fimCb;
    }
  }
  return saida + xml.slice(pos);
}

export async function preencherDocx(JSZip, bufferModelo, textos, marcas) {
  const zip = await JSZip.loadAsync(bufferModelo);
  const xml = await zip.file('word/document.xml').async('string');
  zip.file('word/document.xml', preencherXml(xml, textos, marcas));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
