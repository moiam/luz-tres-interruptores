// Datos del circuito: piezas, colores de cable, pasos de la solución y textos.
// Todo lo que describe "qué" es el circuito vive aquí; la lógica está en sim.js.

export const KIND = {
  conm: { name: 'Conmutador', tok: '--k-conm' },
  cruz: { name: 'Cruzamiento', tok: '--k-cruz' },
};

// Interruptor 1 · cruzamiento (2) · interruptor 3
export const COMPS = [
  { id: 'A', type: 'conm', n: 1 },
  { id: 'C', type: 'cruz', n: 2 },
  { id: 'B', type: 'conm', n: 3, mirror: true },
];

export const COLORS = {
  fase:    { name: 'Fase',    tok: '--c-l',  desc: 'marrón' },
  neutro:  { name: 'Neutro',  tok: '--c-n',  desc: 'azul' },
  tierra:  { name: 'Tierra',  tok: '--c-pe', desc: 'amarillo-verde' },
  viajero: { name: 'Viajero', tok: '--c-tv', desc: 'gris' },
  retorno: { name: 'Retorno', tok: '--c-r',  desc: 'negro' },
};

// Cada paso se cumple si existen todos los pares de alguna de sus alternativas (c).
export const STEPS = [
  { t: 'Tierra: cuadro PE → bombilla PE', col: 'tierra', c: [[['sup.PE', 'lamp.PE']]] },
  { t: 'Neutro: cuadro N → bombilla N', col: 'neutro', c: [[['sup.N', 'lamp.N']]] },
  { t: 'Fase: cuadro L → L del interruptor 1', col: 'fase', c: [[['sup.L', 'A.L']]] },
  { t: 'Viajeros: 1 y 2 del interruptor 1 → E1 y E2 del cruzamiento', col: 'viajero',
    c: [[['A.1', 'C.E1'], ['A.2', 'C.E2']], [['A.1', 'C.E2'], ['A.2', 'C.E1']]] },
  { t: 'Viajeros: S1 y S2 del cruzamiento → 1 y 2 del interruptor 3', col: 'viajero',
    c: [[['C.S1', 'B.1'], ['C.S2', 'B.2']], [['C.S1', 'B.2'], ['C.S2', 'B.1']]] },
  { t: 'Retorno: L del interruptor 3 → bombilla L', col: 'retorno', c: [[['B.L', 'lamp.L']]] },
];

export const SHORT_MSG = {
  LN: 'Has unido la fase con el neutro: es un cortocircuito y salta el PIA.',
  LPE: 'Has unido la fase con la tierra: salta el diferencial.',
  NPE: 'Has unido el neutro con la tierra: salta el diferencial.',
};

const NAMES = { sup: 'Cuadro', lamp: 'Bombilla', A: 'Interruptor 1', C: 'Cruzamiento', B: 'Interruptor 3' };
export function nice(t) {
  const [c, n] = t.split('.');
  return `${NAMES[c]} · ${n}`;
}

// Color recomendado según el tornillo donde empieza el cable.
export function suggestColor(t) {
  if (t === 'sup.N' || t === 'lamp.N') return 'neutro';
  if (t.endsWith('.PE')) return 'tierra';
  if (t === 'sup.L' || t === 'A.L') return 'fase';
  if (t === 'lamp.L' || t === 'B.L') return 'retorno';
  return 'viajero';
}
