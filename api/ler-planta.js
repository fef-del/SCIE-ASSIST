// Função serverless (Vercel): lê uma planta com IA multimodal e SUGERE valores.
// A chave nunca vai para o navegador: fica na variável de ambiente GEMINI_API_KEY.
// A IA não decide categorias de risco; isso é feito pelas regras em public/js/classificar.js.

const MODELO = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const ALTERNATIVAS = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3-flash-preview'];
const MAX_POR_HORA = 20; // limite simples por IP (melhor esforço, em memória)
const usos = new Map();
const VERSAO = 'v5';

const PROMPT = `És um assistente que ajuda um técnico português de segurança contra incêndio (SCIE).
Analisa esta planta de arquitetura e extrai APENAS o que estiver visível ou escrito (cotas, quadros de áreas, legendas, cortes).
Se houver quadro de áreas, soma as áreas dos compartimentos e usa-a como área bruta com confiança baixa, explicando na evidência. Se houver cotas de nível ou alçados, calcula a altura. Em 'evidencia' diz sempre porque não leste, quando devolves null. Regras: não inventes; se não conseguires ler um valor, devolve null; não indiques categorias de risco nem utilizações-tipo.
Responde só em JSON, em português de Portugal, com este formato:
{
 "altura_m": {"valor": number|null, "confianca": "alta"|"media"|"baixa", "evidencia": "onde leste isto"},
 "pisos_abaixo": {"valor": number|null, "confianca": "alta"|"media"|"baixa", "evidencia": "..."},
 "pisos_acima": {"valor": number|null, "confianca": "alta"|"media"|"baixa", "evidencia": "..."},
 "area_bruta_m2": {"valor": number|null, "confianca": "alta"|"media"|"baixa", "evidencia": "..."},
 "efetivo_indicado": {"valor": number|null, "confianca": "alta"|"media"|"baixa", "evidencia": "só se estiver escrito na planta"},
 "compartimentos": [{"nome": "...", "uso": "...", "area_m2": number|null}],
 "observacoes": ["dúvidas ou elementos que o técnico deve confirmar"]
}`;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const URL_MODELO = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

// Diagnóstico: abrir /api/ler-planta no navegador mostra a versão e que modelos respondem agora.
async function diagnostico(res) {
  const chave = process.env.GEMINI_API_KEY;
  const saida = { versao: VERSAO, chaveConfigurada: Boolean(chave), modeloConfigurado: MODELO };
  if (!chave) return res.status(200).json(saida);
  const candidatos = [MODELO, ...ALTERNATIVAS].filter((m, i, a) => a.indexOf(m) === i);
  const testar = async (m) => {
    try {
      const t = await fetch(URL_MODELO(m), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Responde apenas: ok' }] }] })
      });
      return [m, t.status];
    } catch { return [m, 'falha']; }
  };
  saida.testes = Object.fromEntries(await Promise.all(candidatos.map(testar)));
  return res.status(200).json(saida);
}

async function tratar(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return diagnostico(res);
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  const chave = process.env.GEMINI_API_KEY;
  if (!chave) return res.status(503).json({ erro: 'A leitura por IA ainda não está configurada (falta a chave GEMINI_API_KEY no servidor).' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'desconhecido';
  const agora = Date.now();
  const recentes = (usos.get(ip) || []).filter((t) => agora - t < 3600000);
  if (recentes.length >= MAX_POR_HORA) return res.status(429).json({ erro: 'Limite de leituras por hora atingido. Tente mais tarde.' });
  usos.set(ip, [...recentes, agora]);

  let corpoPedido = req.body;
  if (typeof corpoPedido === 'string') { try { corpoPedido = JSON.parse(corpoPedido); } catch { corpoPedido = {}; } }
  const { mime, dados, piso, paginas, texto } = corpoPedido || {};
  let imagens = [];
  if (Array.isArray(paginas) && paginas.length) imagens = paginas.slice(0, 5).filter((p) => p && ['image/jpeg', 'image/png'].includes(p.mime) && typeof p.dados === 'string' && p.dados.length > 100);
  else if (['image/jpeg', 'image/png', 'application/pdf'].includes(mime) && typeof dados === 'string' && dados.length >= 100) imagens = [{ mime, dados }];
  if (!imagens.length) return res.status(400).json({ erro: 'Ficheiro inválido (use PNG, JPG ou PDF).' });
  if (imagens.reduce((s, p) => s + p.dados.length, 0) > 4200000) return res.status(413).json({ erro: 'Ficheiro demasiado grande. Reduza a imagem ou o PDF.' });
  const textoPdf = typeof texto === 'string' ? texto.slice(0, 14000) : '';

  const corpo = JSON.stringify({
    contents: [{ parts: [{ text: PROMPT + (piso ? `\nEsta planta corresponde ao piso: ${String(piso).slice(0, 40)}.` : '') + (textoPdf ? `\n\nTEXTO EXTRAÍDO DO PDF (cotas, legendas e quadros, mais fiável do que a imagem para números; linhas por posição):\n${textoPdf}` : '') + (imagens.length > 1 ? `\n\nSeguem ${imagens.length} páginas do mesmo ficheiro.` : '') }, ...imagens.map((p) => ({ inline_data: { mime_type: p.mime, data: p.dados } }))] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' }
  });

  const modelos = [MODELO, ...ALTERNATIVAS].filter((m, i, a) => a.indexOf(m) === i);
  let ultimo = null;
  for (const modelo of modelos) {
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      try {
        const r = await fetch(URL_MODELO(modelo), { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave }, body: corpo });
        if (r.ok) {
          const j = await r.json();
          const texto = (j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts || []).map((p) => p.text || '').join('');
          try {
            const obj = JSON.parse(texto.replace(/^```json\s*|```\s*$/g, ''));
            obj.modeloUsado = modelo;
            return res.status(200).json(obj);
          } catch { return res.status(502).json({ erro: 'Não foi possível interpretar a resposta da IA.' }); }
        }
        const j = await r.json().catch(() => ({}));
        ultimo = { codigo: r.status, modelo, detalhe: String((j && j.error && j.error.message) || '').slice(0, 200) };
        if (r.status === 429) return res.status(429).json({ erro: 'A quota gratuita da IA esgotou-se por agora. Tente daqui a uns minutos.' });
        if ([400, 403, 404].includes(r.status)) break;
        await espera(1200);
      } catch (e) { ultimo = { codigo: 0, modelo, detalhe: 'falha de ligação' }; await espera(800); }
    }
  }
  return res.status(502).json({ erro: `A IA está indisponível (${ultimo ? ultimo.codigo : 'sem resposta'}, modelo ${ultimo ? ultimo.modelo : '-'}). ${ultimo ? ultimo.detalhe : ''} Tente novamente dentro de instantes.` });
}

export default async function handler(req, res) {
  try { return await tratar(req, res); }
  catch (e) {
    console.error('ler-planta', e);
    return res.status(500).json({ erro: `Erro interno da função: ${String((e && e.message) || e).slice(0, 200)}` });
  }
}
