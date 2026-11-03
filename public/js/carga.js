// Densidade de carga de incêndio modificada (UT XI e XII).
// Fórmulas do Despacho n.º 2074/2009 (ANEPC), n.os 3.º e 4.º. Nenhuma IA entra aqui.

export const CI = { alto: 1.6, medio: 1.3, baixo: 1.0 };   // n.º 6.º
export const RAI = { alto: 3.0, medio: 1.5, baixo: 1.0 };  // n.º 7.º, n.º 2

const chave = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const nivel = (v) => { const k = chave(v); if (!CI[k]) throw new Error(`Nível inválido: ${v}`); return k; };
const positivo = (n, nome) => { if (!Number.isFinite(n) || n < 0) throw new Error(`Indique um valor válido em: ${nome}.`); return n; };

// n.º 3.º, 1: qS = Σ(Mi·Hi·Ci·Rai) / S   (dados completos)
export function cargaDeterministica({ area, constituintes }) {
  positivo(area, 'área'); if (area === 0) throw new Error('A área útil tem de ser maior que zero.');
  if (!constituintes || !constituintes.length) throw new Error('Indique pelo menos um material combustível.');
  let soma = 0;
  const linhas = constituintes.map((c) => {
    const parcela = positivo(c.massa, 'massa') * positivo(c.hi, 'poder calorífico') * CI[nivel(c.ci)] * RAI[nivel(c.rai)];
    soma += parcela;
    return { ...c, parcela };
  });
  return { metodo: 'deterministico', qS: soma / area, area, linhas, formula: 'qS = Σ(Mi·Hi·Ci·Rai) / S' };
}

// n.º 3.º, 2, alíneas a) e b): cálculo probabilístico por atividade.
// zona.tipo: 'fabricacao' (qsi em MJ/m²) ou 'armazenamento' (qvi em MJ/m³, com altura de armazenagem hi).
export function cargaProbabilistica({ zonas }) {
  if (!zonas || !zonas.length) throw new Error('Indique pelo menos uma zona de atividade.');
  let num = 0; let areaTotal = 0;
  const linhas = zonas.map((z) => {
    positivo(z.area, 'área da zona'); positivo(z.q, 'carga da atividade');
    const base = z.tipo === 'armazenamento' ? z.q * positivo(z.altura, 'altura de armazenagem') : z.q;
    const parcela = base * z.area * CI[nivel(z.ci)] * RAI[nivel(z.rai)];
    num += parcela; areaTotal += z.area;
    return { ...z, parcela };
  });
  if (areaTotal === 0) throw new Error('A área total tem de ser maior que zero.');
  return {
    metodo: 'probabilistico', qS: num / areaTotal, area: areaTotal, linhas,
    formula: 'qS = Σ(qsi·Si·Ci·Rai) / ΣSi   |   armazenamento: Σ(qvi·hi·Si·Ci·Rai) / ΣSi'
  };
}

// n.º 4.º: carga da totalidade da utilização-tipo: q = Σ(qSk·Sk) / ΣSk
export function cargaTotalUT(compartimentos) {
  if (!compartimentos.length) throw new Error('Sem compartimentos corta-fogo.');
  let num = 0; let area = 0;
  for (const c of compartimentos) { num += positivo(c.qS, 'qS') * positivo(c.area, 'área'); area += c.area; }
  if (area === 0) throw new Error('A área total tem de ser maior que zero.');
  return { q: num / area, area, formula: 'q = Σ(qSk·Sk) / ΣSk' };
}

// Cálculo já feito pelo técnico: aceite como dado de entrada.
export function cargaIndicada(qS) { return { metodo: 'indicado', qS: positivo(qS, 'carga'), formula: 'valor indicado pelo técnico' }; }

// Rai quando há várias atividades no compartimento (n.º 7.º, 3): a de maior risco se ocupar ≥ 10 % da área,
// ou a média ponderada pelas áreas. Devolve os dois valores para o técnico escolher.
export function raiVariasAtividades(zonas) {
  const total = zonas.reduce((s, z) => s + z.area, 0);
  const ordem = ['baixo', 'medio', 'alto'];
  const maior = zonas.filter((z) => z.area / total >= 0.10).map((z) => nivel(z.rai)).sort((a, b) => ordem.indexOf(b) - ordem.indexOf(a))[0];
  const media = zonas.reduce((s, z) => s + RAI[nivel(z.rai)] * z.area, 0) / total;
  return { maiorRisco: maior ? RAI[maior] : null, mediaPonderada: media };
}

// Pesquisa simples (sem acentos) nas listas do Despacho.
export function pesquisar(lista, texto, max = 25) {
  const t = chave(texto).trim();
  if (!t) return [];
  return lista.filter((x) => chave(x.nome).includes(t)).slice(0, max);
}
