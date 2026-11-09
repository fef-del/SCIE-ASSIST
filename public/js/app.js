import { classificar, ROTULOS } from './classificar.js';
import * as C from './carga.js';
import { htmlFicha, ligarFicha } from './ficha.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 2) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: d }).format(n);
const ETIQUETA = { verificada: '✔ Verificada', por_verificar: '● Por verificar', divergencia: '▲ Divergência' };
const NIVEIS = [['baixo', 'Baixo'], ['medio', 'Médio'], ['alto', 'Alto']];

let REGRAS; let Q1; let Q2;
const estado = {
  passo: 1, ut: null, arLivre: false, soArmazens: false, temLocaisDE: null, saidaDireta: null,
  params: {}, carga: null, cargaOrigem: '', plantas: [], leitura: null,
  modo: 'dados', ficha: {}, area: '', mat: [{}], act: [{}], qIndicado: '', compartimentos: [], ultimo: null
};

/* ---------- arranque ---------- */
async function arrancar() {
  try {
    [REGRAS, Q1, Q2] = await Promise.all(['regras', 'quadro1', 'quadro2'].map((f) => fetch(`data/${f}.json`).then((r) => { if (!r.ok) throw new Error(f); return r.json(); })));
  } catch (e) {
    document.querySelector('main').innerHTML = '<div class="erro">Não foi possível carregar as tabelas do regime SCIE. Atualize a página; se persistir, abra a aplicação a partir do endereço publicado (não como ficheiro local).</div>';
    return;
  }
  renderPassos(); renderListaUT(); ligarPasso1(); irPara(1);
}

function irPara(n) {
  estado.passo = n;
  $$('.ecra').forEach((e) => e.classList.toggle('ativo', e.id === `ecra-${n}`));
  renderPassos();
  if (n === 2) renderPasso2();
  if (n === 3) renderPasso3();
  if (n === 4) renderPasso4();
  if (n === 5) renderPasso5();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderPassos() {
  const nomes = [['Dados e plantas', 'Identificação e parâmetros'], ['Leitura da planta', 'Sugestões da IA'], ['Resultado', 'Categoria de risco'], ['Projeto', 'Carga de incêndio e próximos passos'], ['Ficha', 'Rascunho para imprimir']];
  $('#passos').innerHTML = nomes.map(([t, s], i) => `<button type="button" class="passo ${i + 1 < estado.passo ? 'feito' : ''}" data-ir="${i + 1}" ${i + 1 === estado.passo ? 'aria-current="step"' : ''}><span class="n">${i + 1 < estado.passo ? '✓' : i + 1}</span><span><b>${t}</b><small>${s}</small></span></button>`).join('');
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-ir]');
  if (b) irPara(Number(b.dataset.ir));
});

/* ---------- passo 1 ---------- */
function renderListaUT() {
  $('#lista-ut').innerHTML = Object.entries(REGRAS.ut).map(([id, u]) => `
    <label class="ut ${estado.ut === id ? 'sel' : ''}"><span style="display:flex;align-items:center"><input type="radio" name="ut" value="${id}" ${estado.ut === id ? 'checked' : ''}>
      <span><b>UT ${id} — ${esc(u.nome)}</b>${u.prioridade ? '<span class="tag-prioridade">principal</span>' : ''}<span class="d">${esc(u.fonte)}</span></span></span>
      <span class="etq ${u.verificacao}">${ETIQUETA[u.verificacao]}</span></label>`).join('');
}

function ligarPasso1() {
  $('#lista-ut').addEventListener('change', (e) => {
    if (e.target.name !== 'ut') return;
    estado.ut = e.target.value; estado.arLivre = false; estado.soArmazens = false; estado.temLocaisDE = null; estado.saidaDireta = null;
    renderListaUT(); renderParametros();
  });
  const btn = $('#btn-escolher'); const inp = $('#ficheiros'); const zona = $('#zona-plantas');
  btn.addEventListener('click', () => inp.click());
  inp.addEventListener('change', () => { adicionarPlantas(inp.files); inp.value = ''; });
  ['dragover', 'dragenter'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add('sobre'); }));
  ['dragleave', 'drop'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove('sobre'); }));
  zona.addEventListener('drop', (e) => adicionarPlantas(e.dataTransfer.files));
  $('#lista-ficheiros').addEventListener('click', (e) => {
    const r = e.target.closest('[data-rem]'); if (!r) return;
    estado.plantas.splice(Number(r.dataset.rem), 1); renderFicheiros();
  });
  $('#lista-ficheiros').addEventListener('input', (e) => { if (e.target.dataset.piso !== undefined) estado.plantas[Number(e.target.dataset.piso)].piso = e.target.value; });
  $('#parametros').addEventListener('input', aoEditarParametro);
  $('#parametros').addEventListener('change', aoEditarParametro);
  $('#parametros').addEventListener('click', (e) => { if (e.target.closest('[data-calcular-carga]')) irPara(4); });
}

function adicionarPlantas(lista) {
  const aceites = ['image/png', 'image/jpeg', 'application/pdf'];
  for (const f of lista) {
    if (!aceites.includes(f.type)) continue;
    if (estado.plantas.length >= 6) break;
    estado.plantas.push({ ficheiro: f, piso: '' });
  }
  renderFicheiros();
}
function renderFicheiros() {
  $('#lista-ficheiros').innerHTML = estado.plantas.map((p, i) => `<div class="ficheiro"><span class="nome" title="${esc(p.ficheiro.name)}">${p.ficheiro.type === 'application/pdf' ? '📄' : '🖼️'} ${esc(p.ficheiro.name)}</span>
    <input type="text" placeholder="Piso (ex.: R/C)" value="${esc(p.piso)}" data-piso="${i}" aria-label="Piso desta planta"><button type="button" data-rem="${i}" aria-label="Remover">×</button></div>`).join('');
}

const AJUDA = {
  altura: 'Altura do edifício, em metros (art. 12.º).',
  pisosAbaixo: 'Número de pisos abaixo do plano de referência.',
  efetivo: 'Número máximo de pessoas previsto no edifício (efetivo).',
  efetivoLocaisDE: 'Pessoas previstas nos locais de risco D ou E (art. 10.º).',
  areaBruta: 'Área bruta de construção do estacionamento, em m².'
};

function renderParametros() {
  const ut = REGRAS.ut[estado.ut]; if (!ut) return;
  $('#cartao-parametros').hidden = false;
  let h = '';
  const temArLivre = ut.arLivreCategoria1 || ut.arLivreEfetivo || ut.arLivreCarga;
  if (temArLivre) h += `<label class="interruptor"><input type="checkbox" data-k="arLivre" ${estado.arLivre ? 'checked' : ''}><span><b>Espaço ao ar livre</b><br><span class="mudo peq">Estacionamento, recinto ou instalação sem edifício coberto: aplicam-se limites próprios.</span></span></label>`;
  const campos = [];
  if (estado.arLivre && ut.arLivreCategoria1) { /* sem campos */ }
  else if (estado.arLivre && ut.arLivreEfetivo) campos.push('efetivo');
  else if (estado.arLivre && ut.arLivreCarga) campos.push('carga');
  else campos.push(...ut.parametros);

  const pedeLocaisDE = ut.parametros.includes('efetivoLocaisDE') && !estado.arLivre;
  for (const p of campos) {
    if (p === 'carga') { h += campoCarga(); continue; }
    if (p === 'efetivoLocaisDE') {
      h += `<div class="campo"><span class="rot">Existem locais de risco D ou E?</span><div class="sim-nao" role="radiogroup">
        <label><input type="radio" name="locaisDE" value="sim" ${estado.temLocaisDE === true ? 'checked' : ''}> Sim</label>
        <label><input type="radio" name="locaisDE" value="nao" ${estado.temLocaisDE === false ? 'checked' : ''}> Não</label></div>
        <div class="ajuda">Locais D: dormitórios/internamento; locais E: ocupantes com dificuldade de mobilidade ou de perceção do alarme (art. 10.º).</div></div>`;
      if (estado.temLocaisDE === false) continue;
    }
    h += `<div class="campo"><label for="p-${p}">${ROTULOS[p] || p}</label><input type="number" min="0" step="${p === 'altura' || p === 'areaBruta' ? '0.01' : '1'}" inputmode="decimal" id="p-${p}" data-p="${p}" value="${estado.params[p] ?? ''}"><div class="ajuda">${AJUDA[p] || ''}</div></div>`;
  }
  if (!estado.arLivre && ut.saidaDiretaCategoria1) {
    const l = ut.saidaDiretaCategoria1 === 'locaisE' ? 'E' : 'D';
    h += `<div class="campo"><label for="saida">Os locais de risco ${l} têm saída independente direta ao exterior?</label><select id="saida" data-k="saidaDireta">
      <option value="">Por confirmar</option><option value="sim" ${estado.saidaDireta === true ? 'selected' : ''}>Sim</option><option value="nao" ${estado.saidaDireta === false ? 'selected' : ''}>Não</option></select>
      <div class="ajuda">Condição para a 1.ª categoria neste tipo de utilização (Quadro do Anexo III).</div></div>`;
  }
  if (ut.cargaArmazensX10) h += `<label class="interruptor"><input type="checkbox" data-k="soArmazens" ${estado.soArmazens ? 'checked' : ''}><span><b>Apenas armazéns</b><br><span class="mudo peq">Quando a utilização é só armazenamento, os limites da carga de incêndio são multiplicados por 10 (nota do quadro; a confirmar no Anexo III).</span></span></label>`;
  if (ut.verificacao !== 'verificada') h += `<div class="aviso peq">Esta tabela está <b>${ut.verificacao === 'divergencia' ? 'com divergência entre diplomas' : 'por verificar'}</b>: os limites foram lidos dos diplomas, mas ainda não foram conferidos no Diário da República.</div>`;
  $('#parametros').innerHTML = h;
}

function campoCarga() {
  return `<div class="campo"><label for="p-carga">Densidade de carga de incêndio modificada (MJ/m²)</label>
    <div style="display:flex; gap:8px"><input type="number" min="0" step="any" id="p-carga" data-p="carga" value="${estado.carga ?? ''}">
    <button type="button" class="btn sec" data-calcular-carga style="white-space:nowrap">Calcular no passo 4</button></div>
    <div class="ajuda">Se já a calculou, escreva-a aqui. Caso contrário, a aplicação calcula-a por si (Despacho n.º 2074/2009).${estado.cargaOrigem ? ` <b>Origem: ${esc(estado.cargaOrigem)}.</b>` : ''}</div></div>`;
}

function aoEditarParametro(e) {
  const t = e.target;
  if (t.dataset.p) {
    const v = t.value === '' ? undefined : Number(t.value);
    if (t.dataset.p === 'carga') { estado.carga = v ?? null; estado.cargaOrigem = v === undefined ? '' : 'indicada manualmente'; } else estado.params[t.dataset.p] = v;
  } else if (t.dataset.k === 'arLivre') { estado.arLivre = t.checked; renderParametros(); }
  else if (t.dataset.k === 'soArmazens') estado.soArmazens = t.checked;
  else if (t.dataset.k === 'saidaDireta') estado.saidaDireta = t.value === '' ? null : t.value === 'sim';
  else if (t.name === 'locaisDE') { estado.temLocaisDE = t.value === 'sim'; renderParametros(); }
}

/* ---------- passo 2: leitura por IA ---------- */
function renderPasso2() {
  $('#p2-ficheiros').innerHTML = estado.plantas.length
    ? estado.plantas.map((p) => `<div class="ficheiro"><span class="nome">${esc(p.ficheiro.name)}</span><span class="mudo peq">${esc(p.piso || 'piso por indicar')}</span></div>`).join('')
    : '<p class="mudo">Ainda não carregou plantas. Volte ao passo 1 para as juntar, ou avance e preencha os valores manualmente.</p>';
  $('#btn-ler').disabled = !estado.plantas.length;
  renderLeitura();
}

function lerComoBase64(ficheiro) {
  return new Promise((resolve, reject) => {
    if (ficheiro.type === 'application/pdf') {
      if (ficheiro.size > 3 * 1024 * 1024) return reject(new Error(`«${ficheiro.name}» tem mais de 3 MB. Exporte a planta em imagem (PNG/JPG) ou reduza o PDF.`));
      const r = new FileReader(); r.onload = () => resolve({ mime: ficheiro.type, dados: String(r.result).split(',')[1] }); r.onerror = reject; r.readAsDataURL(ficheiro); return;
    }
    const url = URL.createObjectURL(ficheiro); const img = new Image();
    img.onload = () => {
      const max = 1800; const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      resolve({ mime: 'image/jpeg', dados: c.toDataURL('image/jpeg', 0.85).split(',')[1] });
    };
    img.onerror = () => reject(new Error(`Não foi possível abrir «${ficheiro.name}».`));
    img.src = url;
  });
}

$('#btn-ler').addEventListener('click', async () => {
  const estadoEl = $('#p2-estado'); const btn = $('#btn-ler');
  btn.disabled = true; estadoEl.textContent = 'A ler as plantas… pode demorar alguns segundos.';
  const leituras = [];
  try {
    for (const p of estado.plantas) {
      const { mime, dados } = await lerComoBase64(p.ficheiro);
      const r = await fetch('/api/ler-planta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: p.ficheiro.name, piso: p.piso, mime, dados }) });
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(corpo.erro || (r.status === 404 ? 'A leitura por IA não está disponível nesta versão da aplicação.' : `Erro ${r.status}`));
      leituras.push({ ficheiro: p.ficheiro.name, piso: p.piso, ...corpo });
    }
    estado.leitura = leituras; estadoEl.textContent = 'Leitura concluída. Reveja cada sugestão.';
  } catch (err) {
    estadoEl.innerHTML = `<span style="color:var(--erro)">${esc(err.message)}</span> Pode preencher os valores manualmente no passo 1.`;
  }
  btn.disabled = false; renderLeitura();
});

const CAMPOS_IA = [['altura_m', 'altura', 'Altura (m)'], ['pisos_abaixo', 'pisosAbaixo', 'Pisos abaixo do plano de referência'], ['area_bruta_m2', 'areaBruta', 'Área bruta (m²)'], ['efetivo_indicado', 'efetivo', 'Efetivo indicado na planta']];

function renderLeitura() {
  const el = $('#p2-resultado');
  if (!estado.leitura) { el.innerHTML = ''; return; }
  let h = '<div class="aviso"><b>Sugestões da IA.</b> Podem estar erradas ou incompletas. Confirme na planta antes de aplicar; o resultado legal só usa os valores que confirmar.</div>';
  estado.leitura.forEach((l, i) => {
    h += `<div class="cartao"><h2>${esc(l.ficheiro)}${l.piso ? ' · ' + esc(l.piso) : ''}</h2><table><thead><tr><th>Campo</th><th class="num">Valor sugerido</th><th>Confiança</th><th>Onde foi lido</th><th></th></tr></thead><tbody>`;
    for (const [k, p, rot] of CAMPOS_IA) {
      const c = l[k]; if (!c || c.valor === null || c.valor === undefined) continue;
      h += `<tr><td>${rot}</td><td class="num mono">${esc(c.valor)}</td><td><span class="conf ${esc(c.confianca)}">${esc(c.confianca || '?')}</span></td><td class="peq">${esc(c.evidencia || '')}</td>
        <td><button type="button" class="btn sec peq" data-aplicar="${i}:${p}:${esc(c.valor)}">Aplicar</button></td></tr>`;
    }
    h += '</tbody></table>';
    if (l.observacoes?.length) h += `<p class="peq mudo" style="margin-bottom:0"><b>Observações:</b> ${l.observacoes.map(esc).join(' · ')}</p>`;
    h += '</div>';
  });
  el.innerHTML = h;
}
$('#p2-resultado').addEventListener('click', (e) => {
  const b = e.target.closest('[data-aplicar]'); if (!b) return;
  const [, p, v] = b.dataset.aplicar.split(':');
  estado.params[p] = Number(v); b.textContent = 'Aplicado ✓'; b.disabled = true;
  if (estado.ut) renderParametros();
});

/* ---------- passo 3: resultado ---------- */
function entradaDoEstado() {
  const ut = REGRAS.ut[estado.ut];
  const e = { ut: estado.ut, arLivre: estado.arLivre };
  for (const p of ut.parametros) if (p !== 'carga') e[p] = estado.params[p];
  e.carga = estado.carga ?? undefined;
  if (ut.parametros.includes('efetivoLocaisDE') && estado.temLocaisDE !== null) e.temLocaisDE = estado.temLocaisDE;
  if (ut.saidaDiretaCategoria1 && estado.saidaDireta !== null) e.saidaDiretaLocais = estado.saidaDireta;
  if (ut.cargaArmazensX10) e.soArmazens = estado.soArmazens;
  return e;
}

let ultimoResultado = null;
function renderPasso3() {
  const el = $('#p3-conteudo'); ultimoResultado = null;
  if (!estado.ut) { $('#p3-sub').textContent = ''; el.innerHTML = '<div class="info">Escolha primeiro a utilização-tipo no passo 1.</div>'; return; }
  const ut = REGRAS.ut[estado.ut];
  const nome = $('#nome').value.trim();
  $('#p3-sub').textContent = `${nome || 'Projeto sem nome'} · UT ${estado.ut} (${ut.nome})`;
  let r;
  try { r = classificar(entradaDoEstado(), REGRAS); } catch (err) {
    const precisaCarga = /carga/i.test(err.message);
    el.innerHTML = `<div class="erro"><b>Ainda não é possível classificar.</b><br>${esc(err.message)}</div>
      <div style="display:flex; gap:10px"><button class="btn" data-ir="1">Completar no passo 1</button>${precisaCarga ? '<button class="btn sec" data-ir="4">Calcular a carga de incêndio</button>' : ''}</div>`;
    return;
  }
  ultimoResultado = r;
  const ficha = r.conclusao === 'ficha';
  const avisos = r.avisos.length ? `<div class="aviso"><b>Atenção</b><ul>${r.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : '';
  const linhas = r.detalhes.map((d) => {
    const dets = d.categoria === r.categoria;
    const lim = d.limites.map((l, i) => `<span class="mono">${i + 1}.ª ≤ ${fmt(l, 2)}</span>`).join('<br>');
    let extra = '';
    if (d.variantes) extra = Object.entries(d.variantes).map(([n, v]) => `<div class="peq mudo">${n === 'anexoILei123_2019' ? 'Anexo I da Lei 123/2019' : 'Republicação / versão atualizada'}: ${v.limites.map((l) => fmt(l, 0)).join(' / ')} → ${v.categoria}.ª</div>`).join('');
    return `<tr class="${dets ? 'det' : ''}"><td>${esc(d.rotulo)}</td><td class="num mono">${fmt(d.valor, 2)}</td><td>${lim}${extra}</td><td><span class="cat-pill">${d.categoria}.ª</span></td></tr>`;
  }).join('');
  const resumo = r.detalhes.length ? `Categoria determinada por: ${r.detalhes.filter((d) => d.categoria === r.categoria).map((d) => d.rotulo.toLowerCase()).join(', ') || 'regra específica'}.` : r.avisos[0] || '';
  el.innerHTML = `
    ${r.verificacao !== 'verificada' ? `<div class="aviso"><b>Tabela ${r.verificacao === 'divergencia' ? 'com divergência entre diplomas' : 'por verificar'}.</b> O enquadramento é provisório até conferir os limites desta utilização-tipo no Diário da República.</div>` : ''}
    <div class="grelha">
      <div>
        <div class="cartao"><div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap"><span class="mudo peq" style="text-transform:uppercase; letter-spacing:.06em">Enquadramento SCIE</span><span class="etq ${r.verificacao}">${ETIQUETA[r.verificacao]}</span></div>
          <div class="categoria"><div class="num"><b>${r.categoria}.ª</b><span>CATEGORIA DE RISCO</span></div><p class="mudo peq" style="max-width:380px; margin:12px auto 0">${esc(resumo)}</p></div>
          <div class="decisao ${ficha ? 'ficha' : ''}"><div class="tag">Decisão procedimental</div>
            <h3>${ficha ? 'Basta a ficha de segurança' : 'Projeto de especialidade de SCIE obrigatório'}</h3>
            <div class="peq">${esc(r.textoConclusao)}</div></div></div>
        <div class="cartao"><h2>Dados do projeto</h2><dl class="dados-projeto"><dt>Projeto</dt><dd>${esc(nome || '—')}</dd><dt>Local</dt><dd>${esc([$('#concelho').value, $('#morada').value].filter(Boolean).join(' · ') || '—')}</dd><dt>Utilização-tipo</dt><dd>UT ${estado.ut} — ${esc(ut.nome)}</dd><dt>Data</dt><dd>${new Date().toLocaleDateString('pt-PT')}</dd></dl></div>
      </div>
      <div>
        <div class="cartao"><h2>Justificação</h2>
          <table><thead><tr><th>Critério</th><th class="num">Valor</th><th>Limites por categoria</th><th>Categoria</th></tr></thead><tbody>${linhas || `<tr><td colspan="4">${esc(r.avisos[0] || 'Regra específica aplicada.')}</td></tr>`}</tbody></table>
          <p class="peq mudo">Regra (art. 13.º): a categoria é a <b>mais baixa</b> que cumpre todos os critérios; basta um valor ultrapassar o limite para subir de categoria. A linha realçada determina o resultado.</p></div>
        ${avisos}
        <div class="cartao"><h2>Base legal</h2><p class="peq" style="margin:0">${esc(r.fonte)}<br>Decisão ficha/projeto: DL n.º 220/2008, art. 17.º.<br>Versão aplicada: ${esc(r.versaoLegal)}.</p></div>
      </div>
    </div>`;
}
$('#btn-imprimir').addEventListener('click', () => window.print());

/* ---------- passo 5: ficha de segurança ---------- */
let fichaLigada = false;
function renderPasso5() {
  const el = $('#p5-conteudo');
  if (!estado.ut) { el.innerHTML = '<div class="info">Escolha primeiro a utilização-tipo no passo 1.</div>'; return; }
  let r;
  try { r = classificar(entradaDoEstado(), REGRAS); } catch (err) { el.innerHTML = `<div class="erro"><b>Ainda não é possível preencher a ficha.</b><br>${esc(err.message)}</div><button class="btn" data-ir="1">Completar no passo 1</button>`; return; }
  el.innerHTML = htmlFicha({ r, ut: REGRAS.ut[estado.ut], utId: estado.ut, estado, nome: $('#nome').value.trim(), concelho: $('#concelho').value.trim(), morada: $('#morada').value.trim(), v: estado.ficha });
  if (!fichaLigada) { ligarFicha(el, estado.ficha); fichaLigada = true; }
}
$('#btn-imprimir-ficha').addEventListener('click', () => window.print());

/* ---------- passo 4: projeto e carga de incêndio ---------- */
function renderPasso4() {
  const el = $('#p4-conteudo');
  const ut = estado.ut && REGRAS.ut[estado.ut];
  const temCarga = ut && ut.parametros.includes('carga');
  $('#p4-sub').textContent = temCarga ? 'Para as utilizações-tipo XI e XII a categoria depende da carga de incêndio: a aplicação calcula-a segundo o Despacho n.º 2074/2009.' : 'Próximos passos para o seu processo.';
  let h = '';
  if (!ut) h += '<div class="info">Escolha primeiro a utilização-tipo no passo 1.</div>';
  else if (temCarga) h += htmlCarga();
  else h += `<div class="info">Nesta utilização-tipo a categoria não depende da carga de incêndio; não é preciso calculá-la para a classificar.</div>`;
  h += htmlProximosPassos();
  el.innerHTML = h;
  if (temCarga) ligarCarga();
}

function htmlProximosPassos() {
  const r = ultimoResultado ?? (() => { try { return estado.ut ? classificar(entradaDoEstado(), REGRAS) : null; } catch { return null; } })();
  if (!r) return '';
  const itens = r.conclusao === 'ficha'
    ? ['Elaborar a ficha de segurança contra incêndio (art. 17.º, n.º 2 do DL 220/2008). O modelo é definido pela ANEPC (Anexo V do diploma): confirme o modelo exigido pela câmara.', 'Guardar o resumo desta classificação (passo 3 → «Imprimir / guardar PDF») para o processo.']
    : ['Elaborar o projeto de especialidade de SCIE (art. 17.º, n.º 1 do DL 220/2008), por técnico habilitado nos termos da lei. Elementos mínimos: ver os anexos do diploma e a Portaria n.º 1532/2008 (confirmar a versão em vigor).', 'Guardar o resumo desta classificação (passo 3 → «Imprimir / guardar PDF») para a memória descritiva.', 'Confirmar os parâmetros assinalados como «por verificar» antes de submeter.'];
  return `<div class="cartao"><h2>Próximos passos — ${r.conclusao === 'ficha' ? 'ficha de segurança' : 'projeto de SCIE'} (${r.categoria}.ª categoria)</h2><ul style="margin:0; padding-left:20px">${itens.map((i) => `<li style="margin-bottom:6px">${esc(i)}</li>`).join('')}</ul>${r.conclusao === 'ficha' ? '<p style="margin:14px 0 0"><button class="btn" type="button" data-ir="5">Preencher a ficha de segurança →</button></p>' : ''}</div>`;
}

const opcoesNivel = (sel, vazio) => `${vazio ? '<option value="">Escolher</option>' : ''}${NIVEIS.map(([v, t]) => `<option value="${v}" ${sel === v ? 'selected' : ''}>${t}</option>`).join('')}`;

function htmlCarga() {
  const m = estado.modo;
  const tab = (id, t) => `<button type="button" class="sep" role="tab" aria-selected="${m === id}" data-modo="${id}">${t}</button>`;
  let corpo = '';
  if (m === 'dados') {
    corpo = `<div class="info peq"><b>Dados completos</b> — cálculo determinístico: qS = Σ(Mi·Hi·Ci·Rai) / S. Indique cada material combustível e a respetiva massa.</div>
      <div class="campo" style="max-width:260px"><label for="c-area">Área útil do compartimento, S (m²)</label><input type="number" id="c-area" min="0" step="any" value="${esc(estado.area)}"></div>
      <div id="linhas-mat">${estado.mat.map((l, i) => linhaMat(l, i)).join('')}</div>
      <button type="button" class="btn sec peq" data-add="mat">+ Adicionar material</button>`;
  } else if (m === 'poucos') {
    corpo = `<div class="info peq"><b>Poucos dados</b> — cálculo probabilístico pelo tipo de atividade (Quadro II do Despacho): qS = Σ(qsi·Si·Ci·Rai) / ΣSi; no armazenamento, qvi·hi em vez de qsi.</div>
      <div id="linhas-act">${estado.act.map((l, i) => linhaAct(l, i)).join('')}</div>
      <button type="button" class="btn sec peq" data-add="act">+ Adicionar zona / atividade</button>`;
  } else {
    corpo = `<div class="info peq"><b>Cálculo já feito</b> — introduza o valor que obteve noutro cálculo; a aplicação aceita-o como dado.</div>
      <div class="campo" style="max-width:320px"><label for="c-ind">Densidade de carga de incêndio modificada (MJ/m²)</label><input type="number" id="c-ind" min="0" step="any" value="${esc(estado.qIndicado)}"></div>
      <div class="campo" style="max-width:260px"><label for="c-area">Área útil do compartimento (m²) — opcional</label><input type="number" id="c-area" min="0" step="any" value="${esc(estado.area)}"><div class="ajuda">Só é preciso se for juntar vários compartimentos.</div></div>`;
  }
  const u = estado.ultimo;
  const res = u ? `<div class="resultado-carga"><div class="peq mudo">${esc(u.formula)}</div><div class="valor mono">${fmt(u.qS, 1)} <span style="font-size:15px; font-weight:500">MJ/m²</span></div>
    ${u.linhas ? `<table style="margin-top:8px"><thead><tr><th>Parcela</th><th class="num">Valor</th></tr></thead><tbody>${u.linhas.map((l) => `<tr><td>${esc(l.nome || '—')}</td><td class="num mono">${fmt(l.parcela, 0)}</td></tr>`).join('')}</tbody></table><p class="peq mudo" style="margin:6px 0 0">Soma das parcelas ÷ ${fmt(u.area, 2)} m².</p>` : ''}
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px"><button type="button" class="btn" data-usar="${m === 'indicado' && !u.area ? 'direto' : 'direto'}">Usar como carga da utilização-tipo</button>
    ${u.area ? '<button type="button" class="btn sec" data-guardar>Guardar como compartimento (para juntar vários)</button>' : ''}</div></div>` : '';
  const comp = estado.compartimentos.length ? htmlCompartimentos() : '';
  return `<div class="cartao"><h2>Carga de incêndio modificada</h2>
    <div class="separadores" role="tablist">${tab('dados', 'Dados completos')}${tab('poucos', 'Poucos dados (por atividade)')}${tab('indicado', 'Cálculo já feito')}</div>
    ${corpo}<div id="erro-carga"></div><div style="margin-top:14px"><button type="button" class="btn" data-calc>Calcular</button></div>${res}</div>${comp}
    ${estado.carga != null ? `<div class="ok"><b>Carga em uso na classificação:</b> <span class="mono">${fmt(estado.carga, 1)} MJ/m²</span> (${esc(estado.cargaOrigem)}). <button type="button" class="btn sec peq" data-ir="3" style="margin-left:8px">Ver resultado →</button></div>` : ''}`;
}

function linhaMat(l, i) {
  return `<div class="linha-edit cols-mat" data-i="${i}"><button type="button" class="rem" data-rem-mat="${i}" aria-label="Remover">×</button>
    <div class="rel"><label>Material (Quadro I)</label><input type="text" data-f="nome" data-s="mat" autocomplete="off" value="${esc(l.nome || '')}" placeholder="Pesquise: madeira, papel…"><div class="sugestoes" hidden></div></div>
    <div><label>Hi (MJ/kg)</label><input type="number" min="0" step="any" data-f="hi" value="${l.hi ?? ''}"></div>
    <div><label>Massa (kg)</label><input type="number" min="0" step="any" data-f="massa" value="${l.massa ?? ''}"></div>
    <div><label title="Combustibilidade (n.º 6.º)">Ci</label><select data-f="ci">${opcoesNivel(l.ci, true)}</select></div>
    <div><label title="Ativação (n.º 7.º)">Rai</label><select data-f="rai">${opcoesNivel(l.rai, true)}</select></div></div>`;
}
function linhaAct(l, i) {
  const arm = l.tipo === 'armazenamento';
  return `<div class="linha-edit cols-act" data-i="${i}"><button type="button" class="rem" data-rem-act="${i}" aria-label="Remover">×</button>
    <div class="rel"><label>Atividade (Quadro II)</label><input type="text" data-f="nome" data-s="act" autocomplete="off" value="${esc(l.nome || '')}" placeholder="Pesquise: papelaria, arquivos…"><div class="sugestoes" hidden></div></div>
    <div><label>Tipo</label><select data-f="tipo"><option value="fabricacao" ${!arm ? 'selected' : ''}>Fabricação / reparação</option><option value="armazenamento" ${arm ? 'selected' : ''}>Armazenamento</option></select></div>
    <div><label>${arm ? 'qvi (MJ/m³)' : 'qsi (MJ/m²)'}</label><input type="number" min="0" step="any" data-f="q" value="${l.q ?? ''}"></div>
    <div><label>${arm ? 'Altura (m)' : 'Altura (n/a)'}</label><input type="number" min="0" step="any" data-f="altura" value="${l.altura ?? ''}" ${arm ? '' : 'disabled'}></div>
    <div><label>Área Si (m²)</label><input type="number" min="0" step="any" data-f="area" value="${l.area ?? ''}"></div>
    <div><label title="Combustibilidade (n.º 6.º)">Ci</label><select data-f="ci">${opcoesNivel(l.ci, true)}</select></div>
    <div><label title="Ativação (n.º 7.º)">Rai</label><select data-f="rai">${opcoesNivel(l.rai, true)}</select></div></div>`;
}
function htmlCompartimentos() {
  const t = C.cargaTotalUT(estado.compartimentos.filter((c) => c.area > 0));
  return `<div class="cartao"><h2>Compartimentos corta-fogo guardados</h2><table><thead><tr><th>Compartimento</th><th class="num">qS (MJ/m²)</th><th class="num">Área (m²)</th><th></th></tr></thead><tbody>
    ${estado.compartimentos.map((c, i) => `<tr><td>${esc(c.nome)}</td><td class="num mono">${fmt(c.qS, 1)}</td><td class="num mono">${fmt(c.area, 1)}</td><td><button type="button" class="btn sec peq" data-rem-comp="${i}">Remover</button></td></tr>`).join('')}</tbody></table>
    <div class="resultado-carga"><div class="peq mudo">Carga da totalidade da utilização-tipo (n.º 4.º): q = Σ(qSk·Sk) / ΣSk</div><div class="valor mono">${fmt(t.q, 1)} <span style="font-size:15px; font-weight:500">MJ/m²</span></div>
    <button type="button" class="btn" data-usar-total="${t.q}" style="margin-top:10px">Usar como carga da utilização-tipo</button></div></div>`;
}

function ligarCarga() {
  const raiz = $('#p4-conteudo');
  if (raiz.dataset.ligado) return; raiz.dataset.ligado = '1';
  raiz.addEventListener('click', (e) => {
    const t = e.target;
    const modo = t.closest('[data-modo]'); if (modo) { estado.modo = modo.dataset.modo; estado.ultimo = null; return renderPasso4(); }
    const add = t.closest('[data-add]'); if (add) { estado[add.dataset.add].push({}); return renderPasso4(); }
    const rm = t.closest('[data-rem-mat]'); if (rm) { estado.mat.splice(Number(rm.dataset.remMat), 1); if (!estado.mat.length) estado.mat.push({}); return renderPasso4(); }
    const ra = t.closest('[data-rem-act]'); if (ra) { estado.act.splice(Number(ra.dataset.remAct), 1); if (!estado.act.length) estado.act.push({}); return renderPasso4(); }
    const rc = t.closest('[data-rem-comp]'); if (rc) { estado.compartimentos.splice(Number(rc.dataset.remComp), 1); return renderPasso4(); }
    const sug = t.closest('[data-sug]'); if (sug) return aplicarSugestao(sug);
    if (t.closest('[data-calc]')) return calcularCarga();
    if (t.closest('[data-usar]')) { usarCarga(estado.ultimo.qS, 'calculada nesta aplicação'); return renderPasso4(); }
    const ut = t.closest('[data-usar-total]'); if (ut) { usarCarga(Number(ut.dataset.usarTotal), 'média ponderada dos compartimentos'); return renderPasso4(); }
    if (t.closest('[data-guardar]')) {
      const nome = prompt('Nome do compartimento (ex.: Armazém 1):', `Compartimento ${estado.compartimentos.length + 1}`);
      if (nome) { estado.compartimentos.push({ nome, qS: estado.ultimo.qS, area: estado.ultimo.area }); renderPasso4(); }
    }
  });
  raiz.addEventListener('input', (e) => {
    const t = e.target; const linha = t.closest('.linha-edit');
    if (t.id === 'c-area') { estado.area = t.value; return; }
    if (t.id === 'c-ind') { estado.qIndicado = t.value; return; }
    if (!linha || !t.dataset.f) return;
    const lista = linha.classList.contains('cols-mat') ? estado.mat : estado.act; const l = lista[Number(linha.dataset.i)];
    const numerico = ['hi', 'massa', 'q', 'altura', 'area'].includes(t.dataset.f);
    l[t.dataset.f] = numerico ? (t.value === '' ? undefined : Number(t.value)) : t.value;
    if (t.dataset.f === 'nome') { l._x = undefined; }
    if (t.dataset.f === 'nome') mostrarSugestoes(t, linha.classList.contains('cols-mat') ? Q1 : Q2);
  });
  raiz.addEventListener('change', (e) => { if (e.target.dataset.f === 'tipo') { const li = e.target.closest('.linha-edit'); const l = estado.act[Number(li.dataset.i)]; aplicarTipoAct(l); renderPasso4(); } });
}

function mostrarSugestoes(input, lista) {
  const caixa = input.parentElement.querySelector('.sugestoes');
  const r = C.pesquisar(lista, input.value);
  if (!r.length) { caixa.hidden = true; return; }
  caixa.innerHTML = r.map((x) => `<button type="button" data-sug='${esc(JSON.stringify(x))}'>${esc(x.nome)} <span class="mudo peq">${x.hi !== undefined ? fmt(x.hi, 2) + ' MJ/kg' : [x.qsi !== undefined ? `qsi ${fmt(x.qsi, 0)}` : '', x.qvi !== undefined ? `qvi ${fmt(x.qvi, 0)}` : ''].filter(Boolean).join(' · ')}</span></button>`).join('');
  caixa.hidden = false;
}
function aplicarSugestao(btn) {
  const x = JSON.parse(btn.dataset.sug); const linha = btn.closest('.linha-edit');
  const mat = linha.classList.contains('cols-mat'); const l = (mat ? estado.mat : estado.act)[Number(linha.dataset.i)];
  l.nome = x.nome;
  if (mat) l.hi = x.hi;
  else { l.tipo = x.qsi !== undefined ? 'fabricacao' : 'armazenamento'; l._x = x; aplicarTipoAct(l); }
  renderPasso4();
}
function aplicarTipoAct(l) {
  const x = l._x || Q2.find((q) => q.nome === l.nome); if (!x) return;
  if (l.tipo === 'armazenamento' && x.qvi !== undefined) { l.q = x.qvi; l.rai = x.raArm; } else if (l.tipo === 'fabricacao' && x.qsi !== undefined) { l.q = x.qsi; l.rai = x.raFab; } else { l.q = undefined; l.rai = undefined; }
}

function calcularCarga() {
  const erro = $('#erro-carga'); erro.innerHTML = '';
  try {
    if (estado.modo === 'dados') {
      const faltaNivel = estado.mat.some((l) => !l.ci || !l.rai);
      if (faltaNivel) throw new Error('Escolha o coeficiente de combustibilidade (Ci) e de ativação (Rai) de cada material.');
      estado.ultimo = { ...C.cargaDeterministica({ area: Number(estado.area), constituintes: estado.mat.map((l) => ({ nome: l.nome, massa: l.massa, hi: l.hi, ci: l.ci, rai: l.rai })) }) };
    } else if (estado.modo === 'poucos') {
      if (estado.act.some((l) => !l.ci || !l.rai)) throw new Error('Escolha Ci e Rai em todas as zonas (o Rai vem preenchido do Quadro II quando escolhe a atividade).');
      estado.ultimo = C.cargaProbabilistica({ zonas: estado.act.map((l) => ({ nome: l.nome, tipo: l.tipo || 'fabricacao', q: l.q, altura: l.altura, area: l.area, ci: l.ci, rai: l.rai })) });
    } else {
      if (estado.qIndicado === '') throw new Error('Escreva o valor da carga de incêndio.');
      estado.ultimo = { ...C.cargaIndicada(Number(estado.qIndicado)), area: Number(estado.area) || 0 };
    }
    renderPasso4();
  } catch (e) { erro.innerHTML = `<div class="erro" style="margin-top:12px">${esc(e.message)}</div>`; }
}
function usarCarga(v, origem) { estado.carga = Math.round(v * 10) / 10; estado.cargaOrigem = origem; }

arrancar();
