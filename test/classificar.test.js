import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { classificar as cls, categoriaMinima } from '../public/js/classificar.js';

const regras = JSON.parse(readFileSync(new URL('../public/data/regras.json', import.meta.url), 'utf-8'));
const classificar = (e) => cls(e, regras);

test('categoriaMinima: usa a mais baixa que cumpre o limite', () => {
  assert.strictEqual(categoriaMinima(9, [9, 28, 50]), 1);
  assert.strictEqual(categoriaMinima(9.1, [9, 28, 50]), 2);
  assert.strictEqual(categoriaMinima(50, [9, 28, 50]), 3);
  assert.strictEqual(categoriaMinima(50.1, [9, 28, 50]), 4);
});

test('I habitacional: 22 m e 1 piso abaixo é 2.ª categoria, projeto', () => {
  const r = classificar({ ut: 'I', altura: 22, pisosAbaixo: 1 });
  assert.strictEqual(r.categoria, 2);
  assert.strictEqual(r.conclusao, 'projeto');
});

test('I habitacional: 8 m e 1 piso abaixo é 1.ª categoria, ficha', () => {
  const r = classificar({ ut: 'I', altura: 8, pisosAbaixo: 1 });
  assert.strictEqual(r.categoria, 1);
  assert.strictEqual(r.conclusao, 'ficha');
});

test('I habitacional: basta um parâmetro excedido para subir (2 pisos abaixo com 8 m)', () => {
  const r = classificar({ ut: 'I', altura: 8, pisosAbaixo: 2 });
  assert.strictEqual(r.categoria, 2);
});

test('III administrativo: efetivo 101 com 9 m é 2.ª categoria', () => {
  const r = classificar({ ut: 'III', altura: 9, efetivo: 101 });
  assert.strictEqual(r.categoria, 2);
});

test('II estacionamento ao ar livre é 1.ª categoria', () => {
  const r = classificar({ ut: 'II', arLivre: true });
  assert.strictEqual(r.categoria, 1);
});

test('IV escolar sem locais D/E: efetivo 700 cabe na 2.ª (limite 500 + 50 %)', () => {
  const r = classificar({ ut: 'IV', altura: 9, efetivo: 700, temLocaisDE: false });
  assert.strictEqual(r.categoria, 2);
});

test('IV escolar com locais D/E: efetivo 700 passa para a 3.ª', () => {
  const r = classificar({ ut: 'IV', altura: 9, efetivo: 700, efetivoLocaisDE: 10, temLocaisDE: true });
  assert.strictEqual(r.categoria, 3);
});

test('IV escolar 1.ª categoria sem saída direta dos locais D sobe para a 2.ª', () => {
  const r = classificar({ ut: 'IV', altura: 9, efetivo: 80, efetivoLocaisDE: 10, temLocaisDE: true, saidaDiretaLocais: false });
  assert.strictEqual(r.categoria, 2);
});

test('XII industrial: carga 6 000 MJ/m² é 3.ª categoria', () => {
  const r = classificar({ ut: 'XII', carga: 6000, pisosAbaixo: 0 });
  assert.strictEqual(r.categoria, 3);
});

test('XII armazém: limites ×10, carga 6 000 é 2.ª categoria', () => {
  const r = classificar({ ut: 'XII', carga: 6000, pisosAbaixo: 0, soArmazens: true });
  assert.strictEqual(r.categoria, 2);
});

test('XII ao ar livre: carga 1 000 é 1.ª categoria', () => {
  const r = classificar({ ut: 'XII', arLivre: true, carga: 1000 });
  assert.strictEqual(r.categoria, 1);
});

test('XI bibliotecas: carga 3 000 diverge entre versões e mostra a mais exigente', () => {
  const r = classificar({ ut: 'XI', altura: 9, pisosAbaixo: 0, efetivo: 50, carga: 3000 });
  assert.strictEqual(r.categoria, 2);
  assert.strictEqual(r.verificacao, 'divergencia');
  assert.ok(r.avisos.some((a) => a.includes('Divergência')));
});

test('falta de dados dá erro claro', () => {
  assert.throws(() => classificar({ ut: 'III', altura: 9 }), /Faltam dados: Efetivo/);
});

test('as 12 utilizações-tipo existem e têm limites coerentes (crescentes)', () => {
  assert.strictEqual(Object.keys(regras.ut).length, 12);
  for (const [id, ut] of Object.entries(regras.ut)) {
    const conjuntos = ut.limites ? [ut.limites] : [ut.limitesBase];
    for (const lim of conjuntos) {
      for (const p of Object.keys(lim['1'])) {
        assert.ok(lim['1'][p] <= lim['2'][p] && lim['2'][p] <= lim['3'][p], `${id}.${p} não é crescente`);
      }
    }
  }
});
