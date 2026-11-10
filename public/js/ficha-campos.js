// Mapa entre os campos da ficha oficial (Modelo 2020 ANEPC, .docx) e a interface da aplicação.
// «t» = n.º do campo de texto do documento; «c» = n.º da caixa de marcar (ambos pela ordem no documento).
const T = (k, rot, t, extra = {}) => ({ k, rot, t, ...extra });
const C = (k, rot, c) => ({ k, rot, c });
const D = (k, rot, d) => ({ k, rot, d });

const UT_NUM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export const UT_NOMES = { I: 'Habitacionais', II: 'Estacionamentos', III: 'Administrativos', IV: 'Escolares', V: 'Hospitalares e Lares de Idosos', VI: 'Espetáculos e Reuniões Públicas', VII: 'Hoteleiros e Restauração', VIII: 'Comerciais e Gares de Transportes', IX: 'Desportivos e de Lazer', X: 'Museus e Galerias de Arte', XI: 'Bibliotecas e Arquivos', XII: 'Industriais, Oficinas e Armazéns' };
// linhas da lista 2.2 (UT existentes no edifício): [UT, 1.º campo de texto]
const LISTA_UT = [['I', 56], ['II', 60], ['III', 64], ['VI', 68], ['VII', 72], ['VIII', 76], ['IX', 80], ['X', 84], ['XI', 88], ['XII', 94]];
const BASES_21 = [25, 32, 39];

const tabela = (id, cab, linhas) => ({ tabela: { id, cab, linhas } });
const cel4 = (id, base, nome) => ['pav', 'par', 'cob', 'por'].map((c, i) => T(`${id}_${c}`, '', base[i]));

export const GRUPOS = [
  { id: 'g1', titulo: '1 · Identificação', itens: [
    T('camara', 'Câmara Municipal', 0), T('distrito', 'Distrito', 1), T('processo', 'Processo n.º', 2),
    T('morada', 'Morada do prédio', 3, { larga: true }), { k: 'cp', rot: 'Código postal', cp: [4, 5] },
    T('freguesia', 'Freguesia (matriz predial)', 6), T('artigo', 'Artigo n.º', 7), T('conservatoria', 'Conservatória do Registo Predial de', 8), T('descricao', 'Descrição predial n.º', 9),
    T('licNum', 'Licença de utilização n.º', 10), D('licData', 'Emitida em', [11, 12, 13]),
    T('alvNum', 'Alvará de licença de construção n.º', 14), D('alvData', 'Emitido em', [15, 16, 17]), T('prazo', 'Prazo previsto para conclusão das obras', 18),
    T('reqNome', 'Requerente — nome', 19, { larga: true }), T('reqNif', 'NIF / NIPC', 20),
    T('reqMorada', 'Requerente — morada', 21, { larga: true }), { k: 'reqCp', rot: 'Código postal', cp: [22, 23] }, T('reqLocal', 'Localidade', 24)
  ] },
  { id: 'g2', titulo: '2.1 · Caracterização das utilizações-tipo (operação urbanística)', itens: [
    tabela('ut21', ['UT', 'Designação', 'Altura (m)', 'N.º pisos', 'Piso de', 'a', 'Área bruta (m²)'],
      BASES_21.map((b, i) => ({ rot: `Linha ${i + 1}`, cel: [T(`ut21_${i}_ut`, '', b, { sel: UT_NUM }), T(`ut21_${i}_nome`, '', b + 1), T(`ut21_${i}_alt`, '', b + 2), T(`ut21_${i}_np`, '', b + 3), T(`ut21_${i}_de`, '', b + 4), T(`ut21_${i}_a`, '', b + 5), T(`ut21_${i}_area`, '', b + 6)] })))
  ] },
  { id: 'g22', titulo: '2.2 · Caracterização global do edifício', itens: [
    T('areaTotal', 'Área bruta total (m²)', 46), T('nFracoes', 'N.º total de frações', 48), T('nPisos', 'N.º total de pisos', 49), T('acima', 'Pisos acima do solo', 50), T('abaixo', 'Pisos abaixo do solo', 51),
    T('altEdif', 'Altura do edifício (m)', 52), T('nEscadas', 'N.º total de escadas', 54), T('nAscensores', 'N.º de ascensores', 55),
    { k: 'ut1tipo', rot: 'UT I — tipo', radio: [['Unifamiliar isolada', 0], ['Unifamiliar geminada', 1], ['Unifamiliar em banda', 2], ['Multifamiliar', 3]] },
    tabela('lista', ['UT existentes', 'N.º pisos', 'Piso de', 'a', 'Área bruta (m²)'],
      LISTA_UT.map(([u, b]) => ({ rot: `UT ${u} — ${UT_NOMES[u]}`, cel: [T(`l_${u}_np`, '', b), T(`l_${u}_de`, '', b + 1), T(`l_${u}_a`, '', b + 2), T(`l_${u}_area`, '', b + 3)] }))),
    T('carga', 'UT XII — carga de incêndio (MJ/m²)', 92)
  ] },
  { id: 'g3', titulo: '3 · Condições exteriores ao edifício ou recinto', itens: [
    C('c3', 'Cumpre os artigos aplicáveis do Título II do RT-SCIE (art. 3.º e 12.º)', 4),
    T('viaLarg', 'Via de acesso: largura útil (m)', 98), T('viaAlt', 'Altura útil (m)', 99), T('viaIncl', 'Inclinação (%)', 100),
    T('distFach', 'Menor distância entre fachadas em confronto (m)', 101), T('diedros', 'Zonas da fachada com diedros de abertura inferior a 135º', 102, { larga: true }),
    T('marco', 'Distância da saída ao marco de incêndio mais próximo (m)', 103), T('boca', 'Distância à boca-de-incêndio mais próxima (m)', 104),
    T('empena', 'Paredes de empena: resistência ao fogo EI', 105), T('guarda', '«Guarda-fogos» com altura > 0,6 m', 107), T('cobertura', 'Resistência ao fogo da cobertura REI', 108)
  ] },
  { id: 'g4', titulo: '4 · Resistência ao fogo dos elementos de construção', itens: [
    C('c41', '4.1 Cumpre os artigos aplicáveis do Título III do RT-SCIE (art. 14.º a 19.º)', 5),
    T('rR', 'Elementos só com função de suporte: resistência R', 109), T('rREI', 'Suporte e compartimentação: REI', 112), T('rIso', 'Isolamento e proteção entre UT distintas (REI/EI)', 116),
    C('c42', '4.2 Cumpre art. 20.º a 37.º do RT-SCIE', 6),
    tabela('t42', ['Zonas', 'Pavimentos', 'Paredes', 'Coberturas', 'Portas'], [
      ['Vias horizontais de evacuação', [118, 121, 124, 128]], ['Vias verticais de evacuação', [132, 134, 136, 138]], ['Caixas dos elevadores', [140, 142, 144, 146]],
      ['Locais de risco B', [148, 150, 152, 154]], ['Locais de risco C', [156, 158, 160, 162]], ['Locais de risco (outros)', [164, 166, 168, 170]]
    ].map(([rot, b], i) => ({ rot, cel: cel4(`r42_${i}`, b) })))
  ] },
  { id: 'g5', titulo: '5 · Reação ao fogo dos materiais de construção', itens: [
    C('c5', 'Cumpre art. 38.º a 49.º do RT-SCIE', 7),
    tabela('t5', ['Zonas', 'Pavimentos', 'Paredes', 'Tetos', 'Observações'], [
      ['Vias horizontais de evacuação', [172, 174, 176, 178]], ['Vias verticais de evacuação', [180, 182, 184, 186]], ['Locais de risco B', [188, 190, 192, 194]], ['Locais de risco C', [196, 198, 200, 202]], ['Locais de risco (outros)', [206, 208, 210, 212]]
    ].map(([rot, b], i) => ({ rot, cel: ['pav', 'par', 'tec', 'obs'].map((c, j) => T(`r5_${i}_${c}`, '', b[j])) })))
  ] },
  { id: 'g6', titulo: '6 · Condições de evacuação do edifício', itens: [
    T('efetivo', 'Efetivo total do edifício (art. 51.º do RT-SCIE)', 214),
    T('efA', 'Efetivo em locais de risco A', 216), T('efB', 'B', 218), T('efE', 'E', 220), T('efOutros', 'Outros', 221), T('efArLivre', 'Efetivo em locais ao ar livre', 223),
    C('c6a', 'Cumpre art. 52.º a 60.º (n.º/localização de saídas, unidades de passagem)', 8),
    C('c6b', 'Cumpre art. 61.º a 67.º nas vias horizontais', 9), C('c6c', 'Cumpre art. 61.º a 67.º nas vias verticais', 10),
    C('c6d', 'As portas nos percursos de evacuação abrem no sentido da saída', 11)
  ] },
  { id: 'g7', titulo: '7 · Instalações técnicas', itens: [
    C('c71', '7.1 Energia elétrica — o projeto cumpre art. 70.º a 79.º', 12), C('c72', '7.2 Aquecimento/arrefecimento — art. 80.º a 91.º', 13),
    C('c73', '7.3 Evacuação de afluentes de combustão / ventilação — art. 92.º a 100.º', 14), C('c74', '7.4 Ascensores — art. 101.º a 105.º', 15), C('c75', '7.5 Líquidos e gases combustíveis — art. 106.º e 107.º', 16)
  ] },
  { id: 'g8', titulo: '8 · Equipamentos e sistemas de segurança', itens: [
    C('c81', '8.1 Sinalização — cumpre art. 108.º a 112.º', 17), C('c81a', 'Dimensões adequadas', 18), C('c81b', 'Formato e materiais adequados', 19), C('c81c', 'Distribuição, localização e visibilidade adequadas', 20),
    C('c82', '8.2 Iluminação de emergência — cumpre art. 113.º a 115.º', 21), C('c82a', 'Iluminação de substituição com alimentação diferenciada', 22), C('c82b', 'Blocos autónomos permanentes', 23), C('c82c', 'Blocos autónomos não permanentes', 24),
    C('c82A', 'Iluminação ambiente: local de risco A', 25), C('c82B', 'B', 26), C('c82C', 'C', 27), C('c82E', 'E', 28), C('c82F', 'F', 29),
    C('c82p', 'Balizagem: percursos, patamares e saídas', 30), C('c82q', 'Comandos de equipamentos de segurança', 31), C('c82r', 'Câmaras corta-fogo', 32), C('c82s', 'Meios de 1.ª intervenção', 33),
    C('c83', '8.3 Deteção, alarme e alerta — cumpre art. 116.º a 132.º', 34),
    { tabela: { id: 't83', cab: ['Espaços com deteção automática', 'Configuração 1', 'Configuração 2'], linhas: [
      { rot: 'Locais de risco B', cel: [C('d_B1', '', 35), C('d_B2', '', 36)] }, { rot: 'Locais de risco C', cel: [C('d_C1', '', 37), C('d_C2', '', 38)] },
      { rot: 'Pavimentos e tetos falsos', cel: [C('d_P1', '', 39), C('d_P2', '', 40)] },
      { rot: 'Outros locais (1)', nome: T('d_O1n', '', 225), cel: [C('d_O11', '', 41), C('d_O12', '', 42)] }, { rot: 'Outros locais (2)', nome: T('d_O2n', '', 236), cel: [C('d_O21', '', 43), C('d_O22', '', 44)] }] } },
    C('c84', '8.4 Controlo de fumo — cumpre art. 133.º a 161.º', 45),
    { tabela: { id: 't84', cab: ['Espaços com controlo de fumo', 'Passivo', 'Ativo'], linhas: [
      { rot: 'Pátios interiores cobertos, vias circundantes e pisos', cel: [C('f_1p', '', 46), C('f_1a', '', 47)] }, { rot: 'Vias horizontais de evacuação', cel: [C('f_2p', '', 48), C('f_2a', '', 49)] },
      { rot: 'Vias verticais de evacuação enclausuradas', cel: [C('f_3p', '', 50), C('f_3a', '', 51)] }, { rot: 'Outros espaços, nomeadamente em:', nome: T('f_On', '', 247), cel: [C('f_4p', '', 52), C('f_4a', '', 53)] }] } },
    T('obtAd', 'Obturadores de admissão E', 248), T('obtEx', 'Obturadores de extração EI', 249), T('condutas', 'Condutas e/ou ductos EI', 250),
    C('c85', '8.5 Meios de 1.ª e 2.ª intervenção — cumpre art. 163.º a 171.º', 54),
    { tabela: { id: 't85', cab: ['Extintores previstos', 'Quantidade', 'Capacidade (l ou kg)'], linhas: [
      ['Água / água e espuma', 251], ['Pó químico AB', 253], ['Pó químico ABC', 255], ['CO₂', 257], ['Outro', 269], ['Totais', 271]].map(([rot, b], i) => ({ rot, cel: [T(`e_${i}_q`, '', b), T(`e_${i}_c`, '', b + 1)], ...(i === 4 ? { nome: T('e_4n', '', 259) } : {}) })) } },
    T('distExt', 'Distância máxima de qualquer ponto a um extintor (m)', 273), C('c85r', 'Possui rede de incêndio armada tipo carretel', 55), T('espRia', 'Espaços cobertos pela rede de incêndio', 274, { larga: true }),
    C('c86a', '8.6 Possui deteção automática de gás combustível', 56), C('c86b', 'Cumpre art. 184.º e 185.º', 57),
    C('c87a', '8.7 Possui controlo de poluição do ar', 58), C('c87b', 'Cumpre art. 180.º a 183.º', 59)
  ] },
  { id: 'g9', titulo: '9 · Observações e 10 · Autor da ficha', itens: [
    T('obs91', '9.1 Comentários e justificação das eventuais não conformidades', 292, { area: true }),
    C('c92', '9.2 Autoproteção — cumpre art. 193.º a 207.º', 60),
    T('obs92', 'Comentários à futura implementação das medidas de autoproteção', 401, { area: true }),
    D('dataFicha', '10 · Data', [506, 507, 508])
  ] }
];

// percorre todos os campos «folha» (com t, c, d, cp ou radio)
export function folhear(cb) {
  const visita = (it) => { if (!it) return; if (it.t !== undefined || it.c !== undefined || it.d || it.cp || it.radio) cb(it); };
  for (const g of GRUPOS) for (const it of g.itens) {
    if (it.tabela) for (const l of it.tabela.linhas) { visita(l.nome); (l.cel || []).forEach(visita); } else visita(it);
  }
}

// valores da interface -> campos do documento
export function paraDocumento(v) {
  const textos = {}; const marcas = {};
  const pad = (n) => String(n).padStart(2, '0');
  folhear((it) => {
    const x = v[it.k];
    if (it.c !== undefined) { if (x) marcas[it.c] = true; return; }
    if (it.radio) { const op = it.radio.find(([r]) => r === x); if (op) marcas[op[1]] = true; return; }
    if (x === undefined || x === null || x === '') return;
    if (it.d) { const m = String(x).match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) { textos[it.d[0]] = m[3]; textos[it.d[1]] = m[2]; textos[it.d[2]] = m[1]; } return; }
    if (it.cp) { const [a, b = ''] = String(x).split('-'); textos[it.cp[0]] = a.trim(); textos[it.cp[1]] = b.trim(); return; }
    textos[it.t] = String(x);
  });
  return { textos, marcas, pad };
}
