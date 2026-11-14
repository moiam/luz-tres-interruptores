import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPS, STEPS } from '../js/circuit.js';
import { simulate, analyze, currentPaths, stepDone } from '../js/sim.js';

const solution = () => STEPS.flatMap((s) => s.c[0].map(([a, b]) => ({ a, b, col: s.col })));

test('la solución funciona en las 8 combinaciones', () => {
  const r = analyze(COMPS, solution());
  assert.equal(r.works, true);
  assert.equal(r.onCount, 4);
  assert.equal(r.total, 8);
});

test('la solución completa todos los pasos', () => {
  const w = solution();
  assert.ok(STEPS.every((s) => stepDone(s, w)));
});

test('viajeros cruzados también funcionan', () => {
  const w = solution().map((x) => (x.a === 'A.1' ? { ...x, b: 'C.E2' } : x.a === 'A.2' ? { ...x, b: 'C.E1' } : x));
  assert.equal(analyze(COMPS, w).works, true);
});

test('sin neutro la bombilla no se enciende nunca', () => {
  const w = solution().filter((x) => x.a !== 'sup.N');
  assert.equal(analyze(COMPS, w).onCount, 0);
});

test('fase a un viajero en lugar del común no funciona siempre', () => {
  const w = solution().map((x) => (x.a === 'sup.L' ? { ...x, b: 'A.1' } : x));
  assert.equal(analyze(COMPS, w).works, false);
});

test('unir fase y neutro es cortocircuito', () => {
  const r = simulate(COMPS, { A: 0, C: 0, B: 0 }, [{ a: 'sup.L', b: 'sup.N', col: 'fase' }]);
  assert.equal(r.short, 'LN');
  assert.equal(r.on, false);
});

test('con la luz encendida, todos los cables del camino llevan corriente', () => {
  const w = solution();
  const states = { A: 0, C: 0, B: 0 };
  const on = simulate(COMPS, states, w).on;
  assert.equal(on, true);
  const { flow } = currentPaths(COMPS, states, w, on);
  // fase, un viajero por tramo, retorno y neutro (la tierra no lleva corriente)
  assert.equal(flow.size, 5);
});
