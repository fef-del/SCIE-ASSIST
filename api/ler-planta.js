// Função serverless (Vercel): lê uma planta com IA multimodal e SUGERE valores.
// A chave nunca vai para o navegador: fica na variável de ambiente GEMINI_API_KEY.
// A IA não decide categorias de risco; isso é feito pelas regras em public/js/classificar.js.

const MODELO = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const MAX_POR_HORA = 20; // limite simples por IP (melhor esforço, em memória)
const usos = new Map();
const VERSAO = 'v3-diagnostico';

const PROMPT = `És um assistente que ajuda um técnico português de segurança contra incêndio (SCIE).
Analisa esta planta de arquitetura e extrai APENAS o que estiver visível ou escrito (cotas, quadros de áreas, legendas, cortes).
Regras: não inventes; se não conseguires ler um valor, devolve null; não indiques categorias de risco nem utilizações-tipo.
Responde só em JSON, em português de Portugal, com este formato:
{
 "altura_m": {"valor": number|null, "confianca": "alta"|"media"|"baixa", "evidencia": "onde leste isto"},
 "pisos_abaixo": {"valor": number|null, "confianca": "...", "evidencia": "..."},
 "pisos_acima": {"valor": number|null, "confianca": "...", "evidencia": "..."},
 "area_bruta_m2": {"valor": number|null, "confianca": "...", "evidencia": "..."},
 "efetivo_indicado": {"valor": number|null, "confianca": "...", "evidencia": "só se estiver escrito na planta"},
 "compartimentos": [{"nome": "...", "uso": "...", "area_m2": number|null}],
 "observacoes": ["dúvidas ou elementos que o técnico deve confirmar"]
}`;

// Diagnóstico: abra /api/ler-planta no navegador para ver a versão, se a chave existe e que modelos a conta pode usar.
async function diagnostico(res) {
  const chave = process.env.GEMINI_API_KEY;
  const saida = { versao: VERSAO, chaveConfigurada: Boolean(chave), modeloConfigurado: MODELO };
  if (!chave) return res.status(200).json(saida);
  try {
    const l = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': chave } });
    saida.listaModelosStatus = l.status;
    const j = await l.json().catch(() => ({}));
    if (l.ok) saida.modelosFlash = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent') && /flash/i.test(m.name)).map((m) => m.name.replace('models/', ''));
    else saida.erroLista = j?.error?.message;
    const t = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Responde apenas: ok' }] }] })
    });
    saida.testeModeloConfigurado = t.status;
    if (!t.ok) saida.erroTeste = (await t.json().catch(() => ({})))?.error?.message;
  } catch (e) { saida.falha = String(e.message || e); }
  return res.status(200).json(saida);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return diagnostico(res);
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  const chave = process.env.GEMINI_API_KEY;
  if (!chave) return res.status(503).json({ erro: 'A leitura por IA ainda não está configurada (falta a chave GEMINI_API_KEY no servidor).' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'desconhecido';
  const agora = Date.now();
  const recentes = (usos.get(ip) || []).filter((t) => agora - t < 3600_000);
  if (recentes.length >= MAX_POR_HORA) return res.status(429).json({ erro: 'Limite de leituras por hora atingido. Tente mais tarde.' });
  usos.set(ip, [...recentes, agora]);

  const { mime, dados, piso } = req.body || {};
  if (!['image/jpeg', 'image/png', 'application/pdf'].includes(mime) || typeof dados !== 'string' || dados.length < 100) {
    return res.status(400).json({ erro: 'Ficheiro inválido (use PNG, JPG ou PDF).' });
  }
  if (dados.length > 4_000_000) return res.status(413).json({ erro: 'Ficheiro demasiado grande. Reduza a imagem ou o PDF.' });

  const corpo = JSON.stringify({
    contents: [{ parts: [{ text: PROMPT + (piso ? `\nEsta planta corresponde ao piso: ${String(piso).slice(0, 40)}.` : '') }, { inline_data: { mime_type: mime, data: dados } }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' }
  });
  const modelos = [MODELO, ...(process.env.GEMINI_FALLBACK ? [process.env.GEMINI_FALLBACK] : ['gemini-3.5-flash-lite'])].filter((m, i, a) => a.indexOf(m) === i);
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  let ultimo = null;
  for (const modelo of modelos) {
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave }, body: corpo
        });
        if (r.ok) {
          const j = await r.json();
          const texto = j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
          try { return res.status(200).json(JSON.parse(texto.replace(/^```json\s*|```\s*$/g, ''))); } catch { return res.status(502).json({ erro: 'Não foi possível interpretar a resposta da IA.' }); }
        }
        const detalhe = (await r.json().catch(() => ({})))?.error?.message || '';
        ultimo = { codigo: r.status, modelo, detalhe: String(detalhe).slice(0, 200) };
        if (r.status === 429) return res.status(429).json({ erro: 'A quota gratuita da IA esgotou-se por agora. Tente daqui a uns minutos.' });
        if (r.status === 404 || r.status === 400 || r.status === 403) break; // não adianta repetir; tenta o outro modelo
        await espera(1500);
      } catch { ultimo = { codigo: 0, modelo, detalhe: 'falha de ligação' }; await espera(1000); }
    }
  }
  return res.status(502).json({ erro: `A IA está indisponível (${ultimo?.codigo || 'sem resposta'}, modelo ${ultimo?.modelo}). ${ultimo?.detalhe || ''} Tente novamente dentro de instantes.`.trim() });
}
