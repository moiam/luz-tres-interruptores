// Simulación eléctrica pura (sin DOM): se puede probar con `npm test`.
// Un cable es { a, b, col } donde a y b son ids de tornillo ("A.L", "lamp.N"...).

export const key = (a, b) => [a, b].sort().join('|');

// Conexiones internas de cada mecanismo según su posición.
function internal(comps, states, add) {
  for (const c of comps) {
    const s = states[c.id], i = c.id;
    if (c.type === 'conm') add(`${i}.L`, `${i}.${s + 1}`);
    else if (c.type === 'cruz') {
      if (s) { add(`${i}.E1`, `${i}.S2`); add(`${i}.E2`, `${i}.S1`); }
      else { add(`${i}.E1`, `${i}.S1`); add(`${i}.E2`, `${i}.S2`); }
    } else if (s) add(`${i}.L`, `${i}.1`);
  }
}

export function simulate(comps, states, wires) {
  const p = new Map();
  const f = (x) => { while (p.has(x)) x = p.get(x); return x; };
  const u = (a, b) => { a = f(a); b = f(b); if (a !== b) p.set(a, b); };
  wires.forEach((w) => u(w.a, w.b));
  internal(comps, states, u);
  const same = (a, b) => f(a) === f(b);
  const short = same('sup.L', 'sup.N') ? 'LN' : same('sup.L', 'sup.PE') ? 'LPE' : same('sup.N', 'sup.PE') ? 'NPE' : null;
  const on = !short && (
    (same('lamp.L', 'sup.L') && same('lamp.N', 'sup.N')) ||
    (same('lamp.N', 'sup.L') && same('lamp.L', 'sup.N')));
  return { same, short, on };
}

// Hasta dónde llega la fase (dL) y qué cables llevan corriente y en qué sentido.
export function currentPaths(comps, states, wires, on) {
  const adj = new Map();
  const add = (u, v) => {
    if (!adj.has(u)) adj.set(u, []);
    if (!adj.has(v)) adj.set(v, []);
    adj.get(u).push(v); adj.get(v).push(u);
  };
  wires.forEach((w) => add(w.a, w.b));
  internal(comps, states, add);
  const bfs = (s) => {
    const d = new Map([[s, 0]]), q = [s];
    while (q.length) {
      const x = q.shift();
      for (const y of adj.get(x) || []) if (!d.has(y)) { d.set(y, d.get(x) + 1); q.push(y); }
    }
    return d;
  };
  const dL = bfs('sup.L'), flow = new Map();
  if (!on) return { dL, flow };
  const dN = bfs('sup.N');
  const [lt, nt] = dL.has('lamp.L') && dN.has('lamp.N') ? ['lamp.L', 'lamp.N'] : ['lamp.N', 'lamp.L'];
  const dLt = bfs(lt), dNt = bfs(nt), D = dL.get(lt), D2 = dN.get(nt);
  const onPath = (m1, m2, a, b, T) => m1.has(a) && m2.has(b) && m1.get(a) + 1 + m2.get(b) === T;
  for (const w of wires) {
    if (onPath(dL, dLt, w.a, w.b, D)) flow.set(w, 'fwd');
    else if (onPath(dL, dLt, w.b, w.a, D)) flow.set(w, 'rev');
    else if (onPath(dNt, dN, w.a, w.b, D2)) flow.set(w, 'fwd');
    else if (onPath(dNt, dN, w.b, w.a, D2)) flow.set(w, 'rev');
  }
  return { dL, flow };
}

// Prueba todas las posiciones: funciona si cada interruptor invierte siempre la luz.
export function analyze(comps, wires) {
  const k = comps.length, res = [];
  for (let m = 0; m < (1 << k); m++) {
    const st = {};
    comps.forEach((c, i) => { st[c.id] = (m >> i) & 1; });
    const r = simulate(comps, st, wires);
    res.push({ m, on: r.on, short: r.short });
  }
  const shortR = res.find((r) => r.short);
  const onCount = res.filter((r) => r.on).length;
  const works = !shortR && onCount > 0 &&
    res.every((r) => comps.every((c, i) => res[r.m ^ (1 << i)].on !== r.on));
  return { shortR, onCount, works, total: res.length };
}

export function stepDone(step, wires) {
  const set = new Set(wires.map((w) => key(w.a, w.b)));
  return step.c.some((cand) => cand.every(([a, b]) => set.has(key(a, b))));
}
