// Função serverless (Vercel): lê uma planta com IA multimodal e SUGERE valores.
// A chave nunca vai para o navegador: fica na variável de ambiente GEMINI_API_KEY.
// A IA não decide categorias de risco; isso é feito pelas regras em public/js/classificar.js.

const MODELO = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_POR_HORA = 20; // limite simples por IP (melhor esforço, em memória)
const usos = new Map();

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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
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

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT + (piso ? `\nEsta planta corresponde ao piso: ${String(piso).slice(0, 40)}.` : '') }, { inline_data: { mime_type: mime, data: dados } }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' }
      })
    });
    if (r.status === 429) return res.status(429).json({ erro: 'A quota gratuita da IA esgotou-se por agora. Tente daqui a uns minutos.' });
    if (!r.ok) return res.status(502).json({ erro: `A IA devolveu um erro (${r.status}). Verifique a chave e o nome do modelo.` });
    const j = await r.json();
    const texto = j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    let obj;
    try { obj = JSON.parse(texto.replace(/^```json\s*|```\s*$/g, '')); } catch { return res.status(502).json({ erro: 'Não foi possível interpretar a resposta da IA.' }); }
    return res.status(200).json(obj);
  } catch {
    return res.status(502).json({ erro: 'Falha na ligação à IA.' });
  }
}
