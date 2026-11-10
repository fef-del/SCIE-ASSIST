// Passo 5: preenche a ficha oficial (Modelo 2020 ANEPC) e devolve o próprio documento, com o desenho original.
import { GRUPOS, UT_NOMES, paraDocumento } from './ficha-campos.js';
import { preencherDocx } from './docxfill.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => (n === undefined || n === null || n === '' ? '' : String(n).replace('.', ','));

// Dados que a aplicação já conhece, aplicados só onde o utilizador ainda não escreveu nada.
export function valoresIniciais(ctx) {
  const { utId, estado, concelho, morada, r } = ctx; const p = estado.params; const o = {};
  if (concelho) o.camara = concelho;
  if (morada) o.morada = morada;
  o.ut21_0_ut = utId; o.ut21_0_nome = UT_NOMES[utId];
  if (p.altura != null && p.altura !== '') o.ut21_0_alt = num(p.altura);
  if (p.areaBruta != null && p.areaBruta !== '') { o.ut21_0_area = num(p.areaBruta); if (utId !== 'I') o[`l_${utId}_area`] = num(p.areaBruta); }
  if (p.pisosAbaixo != null && p.pisosAbaixo !== '') { const d = Number(p.pisosAbaixo) > 0 ? `-${p.pisosAbaixo}` : '0'; o.ut21_0_de = d; o[`l_${utId}_de`] = d; }
  if (p.efetivo != null && p.efetivo !== '') o.efetivo = String(p.efetivo);
  const carga = p.carga ?? estado.carga;
  if (utId === 'XII' && carga != null && carga !== '') { o.carga = num(carga); }
  o.dataFicha = new Date().toISOString().slice(0, 10);
  return Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined));
}

const campoHtml = (it, v, comRot = true) => {
  const val = esc(v[it.k] ?? '');
  const rot = comRot && it.rot ? `<span>${esc(it.rot)}</span>` : '';
  if (it.c !== undefined) return `<label class="fk"><input type="checkbox" data-f="${it.k}" ${v[it.k] ? 'checked' : ''}> ${esc(it.rot || '')}</label>`;
  if (it.radio) return `<div class="fc larga"><span>${esc(it.rot)}</span><span class="fo">${it.radio.map(([r]) => `<label><input type="radio" name="${it.k}" data-f="${it.k}" value="${esc(r)}" ${v[it.k] === r ? 'checked' : ''}> ${esc(r)}</label>`).join('')}<label><input type="radio" name="${it.k}" data-f="${it.k}" value="" ${!v[it.k] ? 'checked' : ''}> —</label></span></div>`;
  if (it.sel) return `<select data-f="${it.k}"><option value=""></option>${it.sel.map((s) => `<option ${v[it.k] === s ? 'selected' : ''}>${s}</option>`).join('')}</select>`;
  if (it.area) return `<label class="fc larga">${rot}<textarea data-f="${it.k}" rows="4">${val}</textarea></label>`;
  const tipo = it.d ? 'date' : 'text';
  return `<label class="fc ${it.larga ? 'larga' : ''}">${rot}<input type="${tipo}" data-f="${it.k}" value="${val}"></label>`;
};

function tabelaHtml(tb, v) {
  const cab = tb.cab.map((c) => `<th>${esc(c)}</th>`).join('');
  const linhas = tb.linhas.map((l) => `<tr><td class="rl">${esc(l.rot)}${l.nome ? `<br>${campoHtml({ ...l.nome, rot: '' }, v, false)}` : ''}</td>${(l.cel || []).map((c) => `<td>${c.c !== undefined ? `<input type="checkbox" data-f="${c.k}" ${v[c.k] ? 'checked' : ''}>` : campoHtml(c, v, false)}</td>`).join('')}</tr>`).join('');
  return `<div class="ftab"><table><thead><tr>${cab}</tr></thead><tbody>${linhas}</tbody></table></div>`;
}

export function htmlFicha(ctx) {
  const { r, ut, utId, v } = ctx;
  const aviso = [];
  if (r.categoria !== 1) aviso.push(`O resultado atual é a <b>${r.categoria}.ª categoria</b>: exige-se projeto de especialidade de SCIE, não ficha. Este modelo só se aplica à 1.ª categoria; use-o apenas como apoio.`);
  if (utId === 'IV' || utId === 'V') aviso.push('O modelo oficial exclui as UT IV (Escolares) e V (Hospitalares e Lares de Idosos) e dispensa o projeto só nos restantes casos da 1.ª categoria: confirme o procedimento na câmara municipal.');
  if (utId === 'I') aviso.push('Para habitações unifamiliares isoladas, geminadas ou em banda, o preenchimento termina no ponto 4.1 (mais os pontos 9, 10 e 11), segundo o próprio modelo.');
  if (ut.verificacao !== 'verificada') aviso.push('A tabela desta UT está «por verificar» ou com divergência: a categoria é provisória.');
  const grupos = GRUPOS.map((g) => {
    const planos = g.itens.filter((it) => !it.tabela); const tabs = g.itens.filter((it) => it.tabela);
    const campos = planos.filter((it) => it.c === undefined && !it.radio && !it.area).map((it) => campoHtml(it, v)).join('');
    const checks = planos.filter((it) => it.c !== undefined).map((it) => campoHtml(it, v)).join('');
    const radios = planos.filter((it) => it.radio).map((it) => campoHtml(it, v)).join('');
    const areas = planos.filter((it) => it.area).map((it) => campoHtml(it, v)).join('');
    return `<details class="fgrp" ${['g1', 'g2', 'g22'].includes(g.id) ? 'open' : ''}><summary>${esc(g.titulo)}</summary>
      ${campos ? `<div class="fgrid">${campos}</div>` : ''}${radios}${tabs.map((t) => tabelaHtml(t.tabela, v)).join('')}${checks ? `<div class="fchecks">${checks}</div>` : ''}${areas}</details>`;
  }).join('');
  return `<div class="ficha">
    ${aviso.map((a) => `<div class="aviso">${a}</div>`).join('')}
    <div class="info"><b>Ficha oficial ANEPC (Modelo 2020).</b> Preencha ou confirme os campos abaixo e descarregue o documento: sai o modelo original, com os logótipos e o desenho, só com os campos preenchidos. As caixas «cumpre» ficam por marcar: são declarações suas como técnico autor. Os campos em branco ficam em branco no documento.</div>
    <div class="cartao"><div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center"><button class="btn" type="button" id="btn-docx">Descarregar ficha preenchida (.docx)</button><span class="mudo peq" id="docx-estado"></span></div></div>
    ${grupos}
  </div>`;
}

export function ligarFicha(el, obtem) {
  const atualizar = (e) => {
    const k = e.target.dataset && e.target.dataset.f; if (!k) return;
    obtem()[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  };
  el.addEventListener('input', atualizar); el.addEventListener('change', atualizar);
  el.addEventListener('click', async (e) => {
    if (e.target.id !== 'btn-docx') return;
    const est = el.querySelector('#docx-estado'); est.textContent = 'A preparar o documento…';
    try {
      const JSZip = await carregarJsZip();
      const modelo = await fetch('modelos/ficha-modelo.docx').then((r) => { if (!r.ok) throw new Error('Modelo da ficha não encontrado.'); return r.arrayBuffer(); });
      const v = obtem(); const { textos, marcas } = paraDocumento(v);
      const bytes = await preencherDocx(JSZip, modelo, textos, marcas);
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `ficha-seguranca-incendio${v.morada ? '-' + String(v.morada).replace(/[^\w]+/g, '-').slice(0, 30) : ''}.docx`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      est.textContent = 'Documento descarregado. Abra no Word, confira e assine.';
    } catch (err) { est.innerHTML = `<span style="color:var(--erro)">${esc(err.message)}</span>`; }
  });
}

let jszip = null;
function carregarJsZip() {
  if (jszip) return jszip;
  jszip = new Promise((resolve, reject) => {
    if (window.JSZip) return resolve(window.JSZip);
    const s = document.createElement('script'); s.src = 'vendor/jszip.min.js';
    s.onload = () => resolve(window.JSZip); s.onerror = () => reject(new Error('Não foi possível carregar o gerador de documentos.'));
    document.head.appendChild(s);
  });
  return jszip;
}
