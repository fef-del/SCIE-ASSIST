import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { cargaDeterministica, cargaProbabilistica, cargaTotalUT, cargaIndicada, raiVariasAtividades, pesquisar } from '../public/js/carga.js';

const q1 = JSON.parse(readFileSync(new URL('../public/data/quadro1.json', import.meta.url), 'utf-8'));
const q2 = JSON.parse(readFileSync(new URL('../public/data/quadro2.json', import.meta.url), 'utf-8'));
const perto = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('determinístico: 1000 kg de madeira (16,7) em 200 m², Ci baixo, Rai médio', () => {
  const r = cargaDeterministica({ area: 200, constituintes: [{ massa: 1000, hi: 16.7, ci: 'baixo', rai: 'medio' }] });
  perto(r.qS, 1000 * 16.7 * 1.0 * 1.5 / 200);
});

test('determinístico: aceita "médio" com acento e soma vários materiais', () => {
  const r = cargaDeterministica({ area: 100, constituintes: [
    { massa: 100, hi: 42, ci: 'alto', rai: 'médio' },
    { massa: 50, hi: 16.7, ci: 'baixo', rai: 'baixo' }] });
  perto(r.qS, (100 * 42 * 1.6 * 1.5 + 50 * 16.7) / 100);
});

test('determinístico: área zero ou sem materiais dá erro', () => {
  assert.throws(() => cargaDeterministica({ area: 0, constituintes: [{ massa: 1, hi: 1, ci: 'baixo', rai: 'baixo' }] }));
  assert.throws(() => cargaDeterministica({ area: 10, constituintes: [] }));
});

test('probabilístico: fabricação e armazenamento, média ponderada pelas áreas', () => {
  const r = cargaProbabilistica({ zonas: [
    { tipo: 'fabricacao', q: 400, area: 300, ci: 'baixo', rai: 'baixo' },
    { tipo: 'armazenamento', q: 800, altura: 3, area: 100, ci: 'medio', rai: 'medio' }] });
  perto(r.qS, (400 * 300 * 1 * 1 + 800 * 3 * 100 * 1.3 * 1.5) / 400);
});

test('carga total da UT é média ponderada pelas áreas dos compartimentos', () => {
  const r = cargaTotalUT([{ qS: 1000, area: 100 }, { qS: 200, area: 300 }]);
  perto(r.q, (1000 * 100 + 200 * 300) / 400);
});

test('carga indicada pelo técnico', () => { assert.strictEqual(cargaIndicada(1234).qS, 1234); });

test('Rai com várias atividades: maior risco só conta se ocupar 10 % ou mais', () => {
  const a = raiVariasAtividades([{ area: 95, rai: 'baixo' }, { area: 5, rai: 'alto' }]);
  assert.strictEqual(a.maiorRisco, 1.0);
  const b = raiVariasAtividades([{ area: 80, rai: 'baixo' }, { area: 20, rai: 'alto' }]);
  assert.strictEqual(b.maiorRisco, 3.0);
  perto(b.mediaPonderada, 0.8 * 1 + 0.2 * 3);
});

test('quadros do Despacho: dados carregados e pesquisa sem acentos', () => {
  assert.ok(q1.length > 120 && q2.length > 400);
  assert.ok(q1.find((m) => m.nome === 'Madeira' && m.hi === 16.7));
  const biblio = pesquisar(q2, 'bibliotecas');
  assert.ok(biblio.some((a) => a.nome === 'Bibliotecas' && a.qvi === 2000 && a.raArm === 'alto'));
  assert.ok(pesquisar(q2, 'acucar').some((a) => a.nome === 'Açúcar'));
  for (const a of q2) assert.ok(a.qsi !== undefined || a.qvi !== undefined, a.nome);
});
