// Dibujo SVG del banco de pruebas en dos disposiciones:
// horizontal (escritorio) y vertical (móvil). Las piezas se definen en
// coordenadas locales (u: sentido de la corriente, v: transversal) y se proyectan.
import { KIND, COLORS } from './circuit.js';

const NS = 'http://www.w3.org/2000/svg';
export function el(tag, attrs, parent, text) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

export const LAYOUTS = {
  h: { vert: false, vb: '0 0 1000 450', hit: 15, snap: 34,
       pos: { A: [250, 360], C: [500, 360], B: [750, 360] } },
  v: { vert: true, vb: '0 0 400 990', hit: 21, snap: 40,
       pos: { A: [170, 225], C: [170, 445], B: [170, 665] } },
};

let uid = 0;

/* ---------- cuadro con PIA ---------- */
function drawPanel(svg, terms, L) {
  const g = el('g', { class: 'panel' }, svg);
  const pia = el('g', { class: 'pia', tabindex: 0, role: 'switch', 'aria-label': 'PIA: toca para dar o quitar la corriente' }, g);
  let body, knobY, labelAt;
  if (!L.vert) {
    el('text', { class: 'lbl', x: 70, y: 30, 'text-anchor': 'middle' }, g, 'Cuadro');
    el('rect', { class: 'box', x: 20, y: 40, width: 100, height: 210, rx: 8 }, g);
    body = { x: 40, y: 52, w: 60, h: 96 }; labelAt = [70, 166];
    [['PE', 185], ['N', 210], ['L', 235]].forEach(([n, y]) => {
      el('text', { class: 'term', x: 106, y: y + 4, 'text-anchor': 'end' }, g, n);
      el('circle', { class: 'tdot', cx: 120, cy: y, r: 4.5 }, g);
      terms[`sup.${n}`] = { x: 120, y, dir: [1, 0] };
    });
  } else {
    el('rect', { class: 'box', x: 16, y: 14, width: 236, height: 82, rx: 8 }, g);
    el('text', { class: 'lbl', x: 266, y: 50 }, g, 'Cuadro');
    body = { x: 26, y: 20, w: 48, h: 70 }; labelAt = [96, 44];
    [['PE', 132], ['N', 176], ['L', 220]].forEach(([n, x]) => {
      el('text', { class: 'term', x, y: 82, 'text-anchor': 'middle' }, g, n);
      el('circle', { class: 'tdot', cx: x, cy: 96, r: 4.5 }, g);
      terms[`sup.${n}`] = { x, y: 96, dir: [0, 1] };
    });
  }
  g.appendChild(pia); // encima de la caja del cuadro
  el('rect', { class: 'pia-hit', x: body.x - 8, y: body.y - 8, width: body.w + 16 + (L.vert ? 40 : 0), height: body.h + 16 + (L.vert ? 0 : 26) }, pia);
  el('rect', { class: 'pia-body', x: body.x, y: body.y, width: body.w, height: body.h, rx: 6 }, pia);
  const slotW = 16, sx = body.x + body.w / 2 - slotW / 2, sy = body.y + 10, sh = body.h - 20;
  el('rect', { class: 'pia-slot', x: sx, y: sy, width: slotW, height: sh, rx: 8 }, pia);
  const knobH = Math.round(sh * 0.45);
  const knob = el('rect', { class: 'pia-knob', x: sx - 6, y: sy, width: slotW + 12, height: knobH, rx: 5 }, pia);
  knobY = sh - knobH;
  const txt = el('text', { class: 'pia-txt', x: labelAt[0], y: labelAt[1], 'text-anchor': L.vert ? 'start' : 'middle' }, pia, 'PIA');
  const st = el('text', { class: 'pia-state', x: labelAt[0], y: labelAt[1] + 18, 'text-anchor': L.vert ? 'start' : 'middle' }, pia, 'ON');
  return {
    g: pia,
    set(p) {
      knob.style.transform = `translateY(${p ? 0 : knobY}px)`;
      pia.classList.toggle('on', p);
      pia.setAttribute('aria-checked', p);
      st.textContent = p ? 'ON' : 'OFF';
      txt.textContent = 'PIA';
    },
  };
}

/* ---------- bombilla ---------- */
function drawLamp(svg, terms, L) {
  const id = `glow${uid++}`;
  const defs = el('defs', {}, svg);
  const rg = el('radialGradient', { id, cx: '50%', cy: '50%', r: '50%' }, defs);
  [['0', '.8'], ['.45', '.28'], ['1', '0']].forEach(([o, a]) =>
    el('stop', { offset: o, 'stop-color': 'var(--amber)', 'stop-opacity': a }, rg));
  const lamp = el('g', { class: 'lamp' }, svg);
  const [bx, by] = L.vert ? [170, 930] : [875, 100];
  el('circle', { class: 'glow', cx: bx, cy: by, r: 95, fill: `url(#${id})` }, lamp);
  const rays = el('g', { class: 'rays' }, lamp);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    if (L.vert ? Math.sin(a) < -0.6 : Math.sin(a) > 0.6) continue;
    el('line', { x1: bx + Math.cos(a) * 50, y1: by + Math.sin(a) * 50, x2: bx + Math.cos(a) * 64, y2: by + Math.sin(a) * 64 }, rays);
  }
  el('circle', { class: 'bulb', cx: bx, cy: by, r: 40 }, lamp);
  let ts;
  if (!L.vert) {
    el('path', { class: 'fil', d: 'M862 132 V108 l5 -10 l4 10 l4 -10 l4 10 l4 -10 l5 10 V132' }, lamp);
    el('rect', { class: 'neck', x: 860, y: 132, width: 30, height: 18 }, lamp);
    el('rect', { class: 'box', x: 845, y: 150, width: 60, height: 30, rx: 4 }, lamp);
    el('text', { class: 'lbl', x: 815, y: 105, 'text-anchor': 'end' }, lamp, 'Bombilla');
    ts = [['N', 845, 165, [-1, 0], 836, 158, 'end'], ['L', 875, 180, [0, 1], 886, 200, 'start'], ['PE', 905, 165, [1, 0], 914, 158, 'start']];
  } else {
    el('path', { class: 'fil', d: 'M157 898 V922 l5 10 l4 -10 l4 10 l4 -10 l4 10 l5 -10 V898' }, lamp);
    el('rect', { class: 'neck', x: 155, y: 874, width: 30, height: 18 }, lamp);
    el('rect', { class: 'box', x: 120, y: 800, width: 100, height: 74, rx: 6 }, lamp);
    el('text', { class: 'lbl', x: 236, y: 936 }, lamp, 'Bombilla');
    ts = [['L', 170, 800, [0, -1], 184, 792, 'start'], ['N', 120, 818, [-1, 0], 108, 823, 'end'], ['PE', 120, 856, [-1, 0], 108, 861, 'end']];
  }
  ts.forEach(([n, x, y, dir, lx, ly, an]) => {
    el('circle', { class: 'tdot', cx: x, cy: y, r: 4.5 }, lamp);
    el('text', { class: 'term', x: lx, y: ly, 'text-anchor': an }, lamp, n);
    terms[`lamp.${n}`] = { x, y, dir };
  });
  return {
    setOn(on) { lamp.classList.toggle('on', on); },
    flash() {
      lamp.classList.remove('flash'); void lamp.getBBox(); lamp.classList.add('flash');
      setTimeout(() => lamp.classList.remove('flash'), 950);
    },
  };
}

/* ---------- conmutador / cruzamiento ---------- */
function drawComp(parent, c, terms, L) {
  const V = L.vert, [cx, cy] = L.pos[c.id], m = c.mirror ? -1 : 1, id = c.id, k = KIND[c.type];
  const M = (u, v) => (V ? [cx + v, cy + u] : [cx + u, cy + v]);
  const seg = (u1, v1, u2, v2) => { const [a, b] = M(u1, v1), [x, y] = M(u2, v2); return `M${a} ${b} L${x} ${y}`; };
  const rot = (a) => (V ? -a : a);
  const g = el('g', { class: 'sw', tabindex: 0, role: 'button', 'aria-label': `Interruptor ${c.n} (${k.name}). Toca para cambiar su posición` }, parent);
  g.style.setProperty('--k', `var(${k.tok})`);

  const [px, py] = V ? [cx + 150, cy - 28] : [cx, cy - 150];
  el('text', { class: 'klbl', x: px, y: py - 20, 'text-anchor': 'middle' }, g, k.name);
  el('rect', { class: 'plate', x: px - 35, y: py, width: 70, height: 70, rx: 10 }, g);
  const rt = el('rect', { class: 'rock', x: px - 22, y: py + 12, width: 44, height: 23, rx: 4 }, g);
  const rb = el('rect', { class: 'rock', x: px - 22, y: py + 35, width: 44, height: 23, rx: 4 }, g);
  el('circle', { class: 'badge', cx: px + 35, cy: py, r: 12 }, g);
  el('text', { class: 'badge-t', x: px + 35, y: py + 5, 'text-anchor': 'middle' }, g, c.n);
  if (V) el('rect', { class: 'box', x: cx - 65, y: cy - 70, width: 130, height: 140, rx: 8 }, g);
  else el('rect', { class: 'box', x: cx - 70, y: cy - 65, width: 140, height: 130, rx: 8 }, g);

  const P = {};
  const path = (name, d) => { P[name] = el('path', { class: 'inner', d }, g); };
  const dot = (u, v) => { const [x, y] = M(u, v); el('circle', { class: 'tdot', cx: x, cy: y, r: 4 }, g); };
  const T = (name, u, v, du, lu, lv) => {
    const [x, y] = M(u, v);
    terms[`${id}.${name}`] = { x, y, dir: V ? [0, du] : [du, 0] };
    const [tx, ty] = M(lu, lv);
    el('text', { class: 'term', x: tx, y: ty + 4, 'text-anchor': 'middle' }, g, name);
  };
  let lever = null;
  const mkLever = (u1, u2) => {
    const [x1, y1] = M(u1, 0), [x2, y2] = M(u2, 0);
    lever = el('line', { class: 'inner lever', x1, y1, x2, y2 }, g);
    lever.style.transformOrigin = `${x1}px ${y1}px`;
  };
  if (c.type === 'conm') {
    path('L', seg(-70 * m, 0, -40 * m, 0)); path('1', seg(40 * m, -35, 70 * m, -35)); path('2', seg(40 * m, 35, 70 * m, 35));
    mkLever(-40 * m, 47.3 * m); dot(-40 * m, 0); dot(40 * m, -35); dot(40 * m, 35);
    T('L', -70 * m, 0, -m, -56 * m, 18); T('1', 70 * m, -35, m, 56 * m, -48); T('2', 70 * m, 35, m, 56 * m, 48);
  } else {
    path('E1', seg(-70, -35, -50, -35)); path('E2', seg(-70, 35, -50, 35));
    path('S1', seg(50, -35, 70, -35)); path('S2', seg(50, 35, 70, 35));
    path('s1', seg(-50, -35, 50, -35)); path('s2', seg(-50, 35, 50, 35));
    path('x1', seg(-50, -35, 50, 35)); path('x2', seg(-50, 35, 50, -35));
    [[-50, -35], [-50, 35], [50, -35], [50, 35]].forEach((p) => dot(...p));
    T('E1', -70, -35, -1, -54, -50); T('E2', -70, 35, -1, -54, 50);
    T('S1', 70, -35, 1, 54, -50); T('S2', 70, 35, 1, 54, 50);
  }

  function update(s, live) {
    const Lv = (t) => live(`${id}.${t}`);
    if (c.type === 'conm') {
      lever.style.transform = `rotate(${rot((s ? 1 : -1) * 23.63 * m)}deg)`;
      lever.classList.toggle('live', Lv('L')); P.L.classList.toggle('live', Lv('L'));
      P['1'].classList.toggle('live', Lv('1')); P['2'].classList.toggle('live', Lv('2'));
    } else {
      P.s1.style.opacity = P.s2.style.opacity = s ? 0 : 1;
      P.x1.style.opacity = P.x2.style.opacity = s ? 1 : 0;
      ['E1', 'E2', 'S1', 'S2'].forEach((t) => P[t].classList.toggle('live', Lv(t)));
      P.s1.classList.toggle('live', Lv('E1') && Lv('S1')); P.s2.classList.toggle('live', Lv('E2') && Lv('S2'));
      P.x1.classList.toggle('live', Lv('E1') && Lv('S2')); P.x2.classList.toggle('live', Lv('E2') && Lv('S1'));
    }
    rt.classList.toggle('dn', s === 0); rb.classList.toggle('dn', s === 1);
  }
  return { g, update, c };
}

/* ---------- cables ---------- */
export function wirePath(terms, a, b) {
  const A = terms[a], B = terms[b];
  const k = Math.max(30, Math.min(140, Math.hypot(B.x - A.x, B.y - A.y) * 0.35));
  return `M${A.x} ${A.y} C${A.x + A.dir[0] * k} ${A.y + A.dir[1] * k} ${B.x + B.dir[0] * k} ${B.y + B.dir[1] * k} ${B.x} ${B.y}`;
}

export function makeWire(parent, d, col) {
  const g = el('g', { class: 'wire' }, parent);
  el('path', { class: 'touch', d }, g);
  el('path', { class: 'casing', d, pathLength: 1 }, g);
  const core = el('path', { class: 'core', d, pathLength: 1 }, g);
  core.style.stroke = `var(${COLORS[col].tok})`;
  if (col === 'tierra') el('path', { class: 'stripe', d }, g);
  el('path', { class: 'flowp', d }, g);
  return g;
}

/* ---------- montaje completo ---------- */
export function drawBoard(svg, L, comps) {
  svg.innerHTML = '';
  svg.setAttribute('viewBox', L.vb);
  svg.classList.toggle('vert', L.vert);
  const terms = {};
  const wireLayer = el('g', {}, svg);
  const lamp = drawLamp(svg, terms, L);
  const pia = drawPanel(svg, terms, L);
  const parts = comps.map((c) => drawComp(svg, c, terms, L));
  const preview = el('path', { class: 'preview', d: '' }, svg);
  const hitLayer = el('g', {}, svg);
  const hits = {};
  for (const [id, t] of Object.entries(terms)) {
    hits[id] = el('circle', { class: 'hit', cx: t.x, cy: t.y, r: L.hit, tabindex: 0, role: 'button' }, hitLayer);
    hits[id].dataset.t = id;
  }
  return { terms, wireLayer, lamp, pia, parts, preview, hits };
}
