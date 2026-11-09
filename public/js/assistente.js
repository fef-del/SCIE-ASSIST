// Assistente virtual «Capitão». Fala com /api/assistente, lê o contexto do ecrã (passo, UT, resultado) e muda de expressão.
const LIMITE_SESSAO = 12;
const SUGESTOES = ['Como funciona a aplicação?', 'Qual a diferença entre ficha e projeto?', 'O que é a utilização-tipo?', 'Como se calcula a carga de incêndio?'];
// Expressões: normal, piscar, feliz, pensando, surpreso, preocupado (imagens em assets/capitao-*.png)
let humor = 'normal'; let temporizador = null;
const cara = (n) => `assets/capitao-${n}.png`;
function setHumor(h, ms) {
  humor = h; document.querySelectorAll('#assistente img.cara').forEach((i) => { i.src = cara(h); });
  clearTimeout(temporizador);
  if (ms) temporizador = setTimeout(() => setHumor('normal'), ms);
}
let perguntas = 0; let historico = []; let aberto = false; let ocupado = false;

const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'css/assistente.css'; document.head.appendChild(css);
const raiz = document.createElement('div'); raiz.id = 'assistente'; document.body.appendChild(raiz);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function md(t) {
  const linhas = esc(t).split('\n'); let html = ''; let lista = false;
  for (const l of linhas) {
    const item = l.match(/^\s*[-*•]\s+(.*)/);
    if (item) { if (!lista) { html += '<ul>'; lista = true; } html += `<li>${item[1]}</li>`; }
    else { if (lista) { html += '</ul>'; lista = false; } html += l.trim() ? `<p style="margin:0 0 6px">${l}</p>` : ''; }
  }
  if (lista) html += '</ul>';
  return html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

function contexto() {
  const passo = document.querySelector('.passo[aria-current="step"] b')?.textContent || '';
  const ut = document.querySelector('input[name="ut"]:checked')?.value;
  let c = `Ecrã atual: ${passo}.`;
  if (ut) c += ` Utilização-tipo escolhida: UT ${ut}.`;
  const res = document.querySelector('#ecra-3.ativo #p3-conteudo');
  if (res && res.innerText.trim()) c += `\nResultado mostrado ao utilizador:\n${res.innerText.replace(/\s+/g, ' ').slice(0, 1100)}`;
  return c;
}

function desenhar() {
  if (!aberto) {
    raiz.innerHTML = `<button class="as-botao" aria-label="Abrir o assistente Capitão"><span class="as-balao">Dúvidas? Pergunta ao Capitão</span><img class="pixel cara" src="${cara(humor)}" alt="Mascote bombeiro"></button>`;
    raiz.querySelector('.as-botao').onclick = () => { aberto = true; setHumor('feliz', 2200); desenhar(); };
    return;
  }
  raiz.innerHTML = `<section class="as-painel" role="dialog" aria-label="Assistente Capitão">
    <div class="as-topo"><img class="pixel cara" src="${cara(humor)}" alt=""><div><b>Capitão</b><span>Assistente SCIE · dúvidas sobre a app e o DL 220/2008</span></div><button type="button" aria-label="Fechar">×</button></div>
    <div class="as-msgs" id="as-msgs" aria-live="polite"></div><div class="as-chips" id="as-chips"></div>
    <form class="as-form"><input type="text" id="as-in" maxlength="600" placeholder="Escreve a tua dúvida…" autocomplete="off"><button type="submit">Enviar</button></form>
    <div class="as-rodape" id="as-rod"></div></section>`;
  raiz.querySelector('.as-topo button').onclick = () => { aberto = false; desenhar(); };
  raiz.querySelector('form').onsubmit = (e) => { e.preventDefault(); const i = raiz.querySelector('#as-in'); const t = i.value.trim(); if (t) { i.value = ''; perguntar(t); } };
  const msgs = raiz.querySelector('#as-msgs');
  if (!historico.length) historico.push({ papel: 'model', texto: 'Olá! Sou o **Capitão**. Posso ajudar com a aplicação e com o regime de segurança contra incêndio (DL 220/2008). Respondo só com base nos diplomas e cito o artigo. Em que posso ajudar?', inicial: true });
  for (const m of historico) msgs.insertAdjacentHTML('beforeend', `<div class="as-msg ${m.erro ? 'erro' : m.papel === 'user' ? 'eu' : 'bot'}">${md(m.texto)}</div>`);
  const chips = raiz.querySelector('#as-chips');
  if (historico.length <= 1) SUGESTOES.forEach((s) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = s; b.onclick = () => perguntar(s); chips.appendChild(b); });
  atualizarRodape(); msgs.scrollTop = msgs.scrollHeight; raiz.querySelector('#as-in').focus();
}
function atualizarRodape() {
  const r = raiz.querySelector('#as-rod'); if (!r) return;
  r.textContent = `Perguntas nesta sessão: ${perguntas}/${LIMITE_SESSAO}. Não escrevas dados pessoais. As respostas são um apoio: confirma sempre no diploma.`;
  const b = raiz.querySelector('.as-form button'); if (b) b.disabled = ocupado || perguntas >= LIMITE_SESSAO;
}

async function perguntar(texto) {
  if (ocupado) return;
  if (perguntas >= LIMITE_SESSAO) { setHumor('surpreso', 3000); historico.push({ papel: 'model', texto: 'Já atingimos o limite de perguntas desta sessão. Atualiza a página para recomeçar.', erro: true }); return desenhar(); }
  ocupado = true; perguntas += 1; setHumor('pensando');
  const envio = historico.filter((m) => !m.erro && !m.inicial).map((m) => ({ papel: m.papel, texto: m.texto }));
  historico.push({ papel: 'user', texto });
  desenhar();
  const msgs = raiz.querySelector('#as-msgs');
  msgs.insertAdjacentHTML('beforeend', '<div class="as-msg bot" id="as-pensa">A pensar…</div>'); msgs.scrollTop = msgs.scrollHeight;
  try {
    const r = await fetch('/api/assistente', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pergunta: texto, contexto: contexto(), historico: envio }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || (r.status === 404 ? 'O assistente não está disponível nesta versão.' : `Erro ${r.status}`));
    historico.push({ papel: 'model', texto: j.resposta });
    if (/não encontrei/i.test(j.resposta)) setHumor('preocupado', 3500); else setHumor('feliz', 2500);
  } catch (e) { historico.push({ papel: 'model', texto: e.message, erro: true }); setHumor('preocupado', 4000); }
  ocupado = false; desenhar();
}

// Pisca de vez em quando e, com o painel fechado, avisa quando o resultado tem notas importantes.
setInterval(() => { if (humor === 'normal') { setHumor('piscar'); setTimeout(() => { if (humor === 'piscar') setHumor('normal'); }, 160); } }, 4500);
setInterval(() => {
  if (aberto || ocupado) return;
  const balao = raiz.querySelector('.as-balao'); if (!balao) return;
  const nota = document.querySelector('#ecra-3.ativo .aviso, #ecra-3.ativo .erro');
  if (nota) { balao.textContent = 'Atenção! Tenho uma nota sobre este resultado'; if (humor === 'normal' || humor === 'piscar') setHumor('surpreso'); }
  else { balao.textContent = 'Dúvidas? Pergunta ao Capitão'; if (humor === 'surpreso') setHumor('normal'); }
}, 1200);
desenhar();
