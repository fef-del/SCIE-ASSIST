// Motor de regras do SCIE Assist.
// Nenhuma IA entra aqui: a categoria de risco sai das tabelas de data/regras.json.
// Regra (DL 220/2008, art. 13.º): a categoria é a mais baixa que cumpre todos os critérios;
// basta um valor ser excedido para subir de categoria.


const ROTULOS = {
  altura: 'Altura (m)',
  pisosAbaixo: 'Pisos abaixo do plano de referência',
  efetivo: 'Efetivo',
  efetivoLocaisDE: 'Efetivo em locais de risco D ou E',
  areaBruta: 'Área bruta (m²)',
  carga: 'Densidade de carga de incêndio modificada (MJ/m²)'
};

// Categoria mínima (1 a 4) para um valor, dados os limites máximos das categorias 1, 2 e 3.
export function categoriaMinima(valor, limites) {
  for (let i = 0; i < limites.length; i += 1) {
    if (valor <= limites[i]) return i + 1;
  }
  return 4;
}

function limitesDoParametro(ut, parametro, opcoes) {
  const cats = ['1', '2', '3'];
  let limites;
  if (opcoes.limitesBase) {
    limites = cats.map((c) => opcoes.limitesBase[c][parametro]);
  } else {
    limites = cats.map((c) => ut.limites[c][parametro]);
  }
  return limites;
}

function numero(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

export function classificar(entrada, regras) {
  const ut = regras.ut[entrada.ut];
  if (!ut) throw new Error(`Utilização-tipo desconhecida: ${entrada.ut}`);

  const avisos = [];
  const detalhes = [];
  let categoria = 1;

  // Casos ao ar livre com regras próprias.
  if (entrada.arLivre && ut.arLivreCategoria1) {
    return resultado(regras, ut, entrada, 1, [], [
      'Estacionamento ao ar livre: 1.ª categoria (Quadro II).'
    ]);
  }

  if (entrada.arLivre && ut.arLivreEfetivo) {
    if (!numero(entrada.efetivo)) throw new Error('Falta o efetivo.');
    const limites = [ut.arLivreEfetivo['1'], ut.arLivreEfetivo['2'], ut.arLivreEfetivo['3']];
    const cat = categoriaMinima(entrada.efetivo, limites);
    detalhes.push({ parametro: 'efetivo', rotulo: `${ROTULOS.efetivo} (ao ar livre)`, valor: entrada.efetivo, limites, categoria: cat });
    return resultado(regras, ut, entrada, cat, detalhes, avisos);
  }

  if (entrada.arLivre && ut.arLivreCarga) {
    if (!numero(entrada.carga)) throw new Error('Falta a densidade de carga de incêndio.');
    const fator = entrada.soArmazens && ut.cargaArmazensX10 ? 10 : 1;
    const limites = ['1', '2', '3'].map((c) => ut.arLivreCarga[c] * fator);
    const cat = categoriaMinima(entrada.carga, limites);
    detalhes.push({ parametro: 'carga', rotulo: `${ROTULOS.carga} (ao ar livre)`, valor: entrada.carga, limites, categoria: cat });
    if (fator === 10) avisos.push('Armazém: limites da carga de incêndio multiplicados por 10 (Quadro X, nota).');
    return resultado(regras, ut, entrada, cat, detalhes, avisos);
  }

  // Parâmetros em falta.
  const parametros = ut.parametros.filter((p) => {
    if (p === 'efetivoLocaisDE' && entrada.temLocaisDE === false) return false;
    return true;
  });
  const faltam = parametros.filter((p) => !numero(entrada[p]));
  if (faltam.length) {
    throw new Error(`Faltam dados: ${faltam.map((p) => ROTULOS[p] || p).join(', ')}.`);
  }

  // Utilização-tipo XI: duas variantes de carga de incêndio (divergência entre fontes).
  if (entrada.ut === 'XI') {
    return classificarXI(regras, ut, entrada, parametros);
  }

  for (const p of parametros) {
    let limites = limitesDoParametro(ut, p, {});
    if (p === 'efetivo' && ut.efetivoMais50SemLocaisDE && entrada.temLocaisDE === false) {
      limites = [limites[0], limites[1] * 1.5, limites[2] * 1.5];
      avisos.push('Escolar sem locais de risco D ou E: efetivo das 2.ª e 3.ª categorias aumentado em 50 % (art. 13.º, n.º 3).');
    }
    if (p === 'carga' && entrada.soArmazens && ut.cargaArmazensX10) {
      limites = limites.map((l) => l * 10);
      avisos.push('Armazém: limites da carga de incêndio multiplicados por 10 (Quadro X, nota).');
    }
    const cat = categoriaMinima(entrada[p], limites);
    detalhes.push({ parametro: p, rotulo: ROTULOS[p] || p, valor: entrada[p], limites, categoria: cat });
    categoria = Math.max(categoria, cat);
  }

  // IV, V e VII: na 1.ª categoria exige-se saída independente direta ao exterior dos locais D (IV, V) ou E (VII).
  if (categoria === 1 && ut.saidaDiretaCategoria1) {
    const locais = ut.saidaDiretaCategoria1 === 'locaisE' ? 'E' : 'D';
    if (entrada.saidaDiretaLocais === false) {
      categoria = 2;
      avisos.push(`1.ª categoria exige saída independente direta ao exterior dos locais de risco ${locais}; sem ela, sobe para a 2.ª (interpretação do Quadro, a confirmar).`);
    } else if (entrada.saidaDiretaLocais === undefined && entrada.temLocaisDE !== false) {
      avisos.push(`Confirmar se os locais de risco ${locais} têm saída independente direta ao exterior, ao nível do plano de referência (condição da 1.ª categoria).`);
    }
  }

  return resultado(regras, ut, entrada, categoria, detalhes, avisos);
}

function classificarXI(regras, ut, entrada, parametros) {
  const avisos = [];
  const detalhesBase = [];
  let catBase = 1;
  for (const p of parametros.filter((x) => x !== 'carga')) {
    const limites = limitesDoParametro(ut, p, { limitesBase: ut.limitesBase });
    const cat = categoriaMinima(entrada[p], limites);
    detalhesBase.push({ parametro: p, rotulo: ROTULOS[p] || p, valor: entrada[p], limites, categoria: cat });
    catBase = Math.max(catBase, cat);
  }
  const fator = entrada.soArmazens && ut.cargaArmazensX10 ? 10 : 1;
  if (fator === 10) avisos.push('Armazém: limites da carga de incêndio multiplicados por 10 (Quadro IX, nota).');

  const variantes = ut.variantesCarga;
  const porVariante = {};
  for (const [nome, v] of Object.entries(variantes)) {
    const limites = ['1', '2', '3'].map((c) => v[c] * fator);
    porVariante[nome] = { limites, categoria: categoriaMinima(entrada.carga, limites) };
  }
  const cats = Object.values(porVariante).map((v) => v.categoria);
  const catCarga = Math.max(...cats);
  const divergem = new Set(cats).size > 1;
  if (divergem) {
    avisos.push('Divergência nos diplomas: a categoria depende da versão do Quadro IX. Mostra-se a mais exigente até haver confirmação.');
  }
  const categoria = Math.max(catBase, catCarga);
  const detalhes = detalhesBase.concat([{
    parametro: 'carga',
    rotulo: ROTULOS.carga,
    valor: entrada.carga,
    limites: porVariante.republicacaoEVersaoAtualizada.limites,
    categoria: porVariante.republicacaoEVersaoAtualizada.categoria,
    variantes: porVariante
  }]);
  return resultado(regras, ut, entrada, categoria, detalhes, avisos, divergem ? 'divergencia' : null);
}

function resultado(regras, ut, entrada, categoria, detalhes, avisos, verificacaoForcada) {
  const verificacao = verificacaoForcada || ut.verificacao;
  const todosAvisos = avisos.slice();
  if (verificacao === 'por_verificar') {
    todosAvisos.push('Os limites desta utilização-tipo ainda não foram conferidos com o Diário da República.');
  }
  return {
    ut: entrada.ut,
    nome: ut.nome,
    categoria,
    conclusao: categoria === 1 ? 'ficha' : 'projeto',
    textoConclusao: categoria === 1
      ? 'Basta a ficha de segurança contra incêndio (DL 220/2008, art. 17.º, n.º 2).'
      : 'É obrigatório projeto de especialidade de SCIE (DL 220/2008, art. 17.º, n.º 1).',
    detalhes,
    avisos: todosAvisos,
    fonte: ut.fonte,
    verificacao,
    versaoLegal: regras.versaoLegal
  };
}

export { ROTULOS };
