// Leitura de PDF no navegador: desenha cada página como imagem de alta resolução
// e extrai o texto do PDF (cotas, legendas e quadros de áreas de desenhos vetoriais).
let carregado = null;
function carregarPdfJs() {
  if (carregado) return carregado;
  carregado = new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib);
    const s = document.createElement('script'); s.src = 'vendor/pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; resolve(window.pdfjsLib); };
    s.onerror = () => reject(new Error('Não foi possível carregar o leitor de PDF.'));
    document.head.appendChild(s);
  });
  return carregado;
}

function textoDaPagina(conteudo) {
  const itens = conteudo.items.filter((i) => i.str && i.str.trim()).map((i) => ({ t: i.str.trim(), x: i.transform[4], y: i.transform[5] }));
  itens.sort((a, b) => (Math.abs(b.y - a.y) > 4 ? b.y - a.y : a.x - b.x));
  const linhas = []; let atual = null;
  for (const i of itens) {
    if (atual && Math.abs(atual.y - i.y) <= 4) atual.p.push(i.t); else { atual = { y: i.y, p: [i.t] }; linhas.push(atual); }
  }
  return linhas.map((l) => l.p.join('  ')).join('\n');
}

const jpeg = (canvas, q) => canvas.toDataURL('image/jpeg', q).split(',')[1];

// Devolve { paginas: [{mime, dados}], texto, totalPaginas, usadas }
export async function lerPdf(ficheiro, { maxPaginas = 4, orcamento = 3800000 } = {}) {
  const pdfjs = await carregarPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await ficheiro.arrayBuffer()) }).promise;
  const usadas = Math.min(doc.numPages, maxPaginas);
  const textos = []; const folhas = [];
  for (let n = 1; n <= usadas; n += 1) {
    const pag = await doc.getPage(n);
    const base = pag.getViewport({ scale: 1 });
    folhas.push({ pag, base });
    try { const t = textoDaPagina(await pag.getTextContent()); if (t) textos.push(usadas > 1 ? `--- Página ${n} ---\n${t}` : t); } catch { /* sem texto */ }
  }
  let lado = 2600; let q = 0.88; let paginas = [];
  for (let tentativa = 0; tentativa < 5; tentativa += 1) {
    paginas = [];
    for (const { pag, base } of folhas) {
      const k = lado / Math.max(base.width, base.height);
      const vp = pag.getViewport({ scale: k });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await pag.render({ canvasContext: ctx, viewport: vp }).promise;
      paginas.push({ mime: 'image/jpeg', dados: jpeg(c, q) });
    }
    if (paginas.reduce((s, p) => s + p.dados.length, 0) <= orcamento) break;
    lado = Math.round(lado * 0.8); q = Math.max(0.7, q - 0.05);
  }
  return { paginas, texto: textos.join('\n').slice(0, 14000), totalPaginas: doc.numPages, usadas };
}
