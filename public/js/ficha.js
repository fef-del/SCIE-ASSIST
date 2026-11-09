// Ficha de segurança contra incêndio: rascunho pré-preenchido (DL 220/2008, art. 17.º n.º 2 e Anexo V).
// A aplicação preenche só dados que já tem. As declarações de conformidade ficam por marcar: são do técnico.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(n);

const OPCOES = ['Cumpre', 'Não cumpre', 'N/A'];
// Secções técnicas (Anexo V, art. 2.º, alíneas c a h). Itens genéricos: o técnico completa com os artigos do RT-SCIE.
const SECCOES = [
  ['3. Condições exteriores', ['Vias de acesso e acessibilidade às fachadas para os meios de socorro', 'Pontos de tomada de água / hidrantes exteriores', 'Limitação da propagação do incêndio pelo exterior (distâncias, empenas, cobertura)']],
  ['4. Resistência ao fogo de elementos de construção', ['Estabilidade ao fogo da estrutura (classe R)', 'Compartimentação corta-fogo (classes E, EI, REI)', 'Isolamento e proteção de vias de evacuação e locais de risco']],
  ['5. Reação ao fogo dos materiais', ['Revestimentos de paredes e tetos', 'Revestimentos de pavimentos', 'Isolamentos e outros produtos de construção']],
  ['6. Condições gerais de evacuação', ['Número e largura das saídas e vias de evacuação', 'Distâncias máximas a percorrer', 'Escadas, portas e sentido de abertura', 'Efetivo total e por locais de risco']],
  ['7. Instalações técnicas', ['Instalações elétricas e de energia', 'Aquecimento, ventilação e ar condicionado', 'Instalações de gás', 'Ascensores']],
  ['8. Equipamentos e sistemas de segurança', ['Sinalização de segurança', 'Iluminação de emergência', 'Deteção, alarme e alerta', 'Controlo de fumo', 'Meios de primeira intervenção (extintores / RIA)']]
];

const EXTRA_UT = {
  I: [['fogos', 'N.º de frações / fogos'], ['escadas', 'N.º de escadas comuns'], ['ascensores', 'N.º de ascensores']],
  II: [['lugares', 'N.º de lugares de estacionamento']],
  IV: [['alunos', 'Capacidade máxima (alunos e pessoal)']],
  V: [['camas', 'N.º de camas / utentes']],
  VI: [['lotacao', 'Lotação máxima do recinto']],
  VII: [['quartos', 'N.º de quartos / lugares de refeição']],
  XI: [['documentos', 'Tipo de acervo documental']],
  XII: [['atividade', 'Atividade / produtos armazenados']]
};

export function htmlFicha(ctx) {
  const { r, ut, utId, estado, nome, concelho, morada, v } = ctx;
  const val = (k, d = '') => esc(v[k] ?? d);
  const campo = (k, rot, tipo = 'text', d = '') => `<label class="fc"><span>${rot}</span><input type="${tipo}" data-f="${k}" value="${val(k, d)}"></label>`;
  const p = estado.params;
  const dado = (rot, valor, un = '') => `<div class="fd"><span>${rot}</span><b>${valor === undefined || valor === null || valor === '' ? '<i class="vazio">por preencher</i>' : esc(typeof valor === 'number' ? fmt(valor) : valor) + un}</b></div>`;
  const cat1 = r.categoria === 1;
  const aviso = [];
  if (!cat1) aviso.push(`O resultado atual é a <b>${r.categoria}.ª categoria</b>: nesta categoria exige-se projeto de especialidade de SCIE, não ficha. O rascunho abaixo serve apenas de apoio e <b>não substitui</b> o projeto.`);
  if (utId === 'IV' || utId === 'V') aviso.push('Segundo as notas dos modelos de ficha consultados, as UT IV e V não são abrangidas pelo modelo geral: confirme na sua câmara municipal / ANEPC o modelo aplicável.');
  if (ut.verificacao !== 'verificada') aviso.push('A tabela desta UT está «por verificar» ou com divergência: a categoria é provisória.');
  const extra = (EXTRA_UT[utId] || []).map(([k, rot]) => campo(k, rot)).join('');
  const carga = p.carga ?? estado.carga;
  const secoes = SECCOES.map(([t, itens], si) => `
    <section class="fs"><h3>${t}</h3>
      ${itens.map((it, ii) => { const k = `s${si}i${ii}`; return `<div class="fi"><span>${it}</span><span class="fo">${OPCOES.map((o) => `<label><input type="radio" name="${k}" data-f="${k}" value="${o}" ${v[k] === o ? 'checked' : ''}> ${o}</label>`).join('')}</span></div>`; }).join('')}
      <label class="fc larga"><span>Artigos / elementos de referência e notas</span><textarea data-f="n${si}" rows="2">${val('n' + si)}</textarea></label>
    </section>`).join('');
  return `
  <div class="ficha">
    ${aviso.map((a) => `<div class="aviso nao-imprimir">${a}</div>`).join('')}
    <div class="aviso nao-imprimir"><b>Rascunho de apoio.</b> A aplicação preenche os dados que já tem; as declarações de conformidade (secções 3 a 8) e a assinatura são do técnico autor. O modelo oficial é definido pela ANEPC (DL 220/2008, Anexo V, art. 1.º): confirme o modelo exigido pela câmara municipal antes de entregar.</div>
    <div class="folha">
      <h2>Ficha de segurança contra incêndio em edifícios</h2>
      <p class="peq mudo">DL n.º 220/2008, art. 17.º, n.º 2 e Anexo V · Utilização-tipo ${utId} — ${esc(ut.nome)}</p>
      <section class="fs"><h3>1. Identificação</h3>
        <div class="fgrid">
          ${campo('predio', 'Prédio urbano / designação', 'text', nome)}
          ${campo('morada', 'Morada / freguesia', 'text', morada)}
          ${campo('concelho', 'Concelho', 'text', concelho)}
          ${campo('artigo', 'Artigo matricial / descrição predial')}
          ${campo('requerente', 'Requerente')}
          ${campo('autor', 'Autor da ficha')}
          ${campo('nif', 'NIF do autor')}
          ${campo('ordem', 'Ordem profissional e n.º de membro')}
        </div>
      </section>
      <section class="fs"><h3>2. Caracterização</h3>
        <div class="fgrid dados">
          ${dado('Utilização-tipo', `${utId} — ${ut.nome}`)}
          ${dado('Categoria de risco', r.categoria + '.ª')}
          ${dado('Altura da UT', p.altura, ' m')}
          ${dado('Pisos abaixo do plano de referência', p.pisosAbaixo)}
          ${dado('Área bruta', p.areaBruta, ' m²')}
          ${dado('Efetivo', p.efetivo)}
          ${utId === 'XI' || utId === 'XII' ? dado('Carga de incêndio modificada', carga, ' MJ/m²') : ''}
        </div>
        <div class="fgrid">${campo('pisosAcima', 'Pisos acima do plano de referência', 'number')}${campo('areaTotal', 'Área bruta total do edifício (m²)', 'number')}${extra}</div>
        <p class="peq mudo nao-imprimir">Os dados a cinzento vêm do que indicou nos passos anteriores (incluindo sugestões da IA que confirmou). Os restantes campos são para preencher.</p>
      </section>
      ${secoes}
      <section class="fs"><h3>9. Observações</h3>
        <label class="fc larga"><span>Não conformidades, medidas de autoproteção e outras observações</span><textarea data-f="obs" rows="4">${val('obs')}</textarea></label></section>
      <section class="fs"><h3>10. Autor da ficha</h3>
        <div class="fgrid">${campo('data', 'Data', 'date', new Date().toISOString().slice(0, 10))}<div class="fc"><span>Assinatura</span><div class="assin"></div></div></div></section>
      <section class="fs"><h3>11. Para uso da fiscalização municipal</h3><div class="assin" style="height:48px"></div></section>
    </div>
  </div>`;
}

export function ligarFicha(el, v) {
  el.addEventListener('input', (e) => { const k = e.target.dataset && e.target.dataset.f; if (k) v[k] = e.target.value; });
  el.addEventListener('change', (e) => { const k = e.target.dataset && e.target.dataset.f; if (k) v[k] = e.target.value; });
}
