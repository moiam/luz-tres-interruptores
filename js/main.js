// Interfaz: estado, render, conexión de cables (toque o arrastre) y acciones.
import { COMPS, COLORS, STEPS, SHORT_MSG, nice, suggestColor } from './circuit.js';
import { key, simulate, currentPaths, analyze, stepDone } from './sim.js';
import { colorIssues, mistakes } from './checks.js';
import { LAYOUTS, drawBoard, makeWire, wirePath, el } from './draw.js';

const $ = (id) => document.getElementById(id);
const svg = $('board');
const mq = matchMedia('(max-width: 720px)');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const S = {
  wires: [], hist: [],
  states: { A: 0, C: 0, B: 0 },
  color: 'fase', autoColor: true,
  pending: null, selWire: null,
  power: true, wasOn: false, justWired: false,
};
let L, B; // disposición actual y elementos dibujados

/* ---------- avisos ---------- */
let toastTimer;
function toast(html, kind = '') {
  const t = $('toast');
  t.className = `toast show ${kind}`;
  t.innerHTML = html;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), kind === 'ok' ? 4500 : 3000);
}
function openSheet(kind, title, html) {
  const sh = $('sheet');
  sh.dataset.kind = kind;
  $('sheetTitle').textContent = title;
  $('sheetBody').innerHTML = html;
  sh.hidden = false;
  requestAnimationFrame(() => sh.classList.add('open'));
  $('sheetClose').focus();
}
function closeSheet() {
  const sh = $('sheet');
  sh.classList.remove('open');
  setTimeout(() => { sh.hidden = true; }, reduceMotion.matches ? 0 : 220);
}
$('sheetClose').onclick = closeSheet;
$('sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });

/* ---------- selector de cable ---------- */
const chips = $('colors');
for (const [k, c] of Object.entries(COLORS)) {
  const b = document.createElement('button');
  b.className = 'chip';
  b.dataset.c = k;
  b.innerHTML = `<b class="sw-c c-${k}"></b><span>${c.name}</span>`;
  b.title = `${c.name} (${c.desc})`;
  b.onclick = () => { S.color = k; S.autoColor = false; syncChips(); render(); };
  chips.appendChild(b);
}
function syncChips() {
  chips.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', b.dataset.c === S.color));
}

/* ---------- montaje del tablero ---------- */
function build() {
  L = mq.matches ? LAYOUTS.v : LAYOUTS.h;
  S.pending = null;
  B = drawBoard(svg, L, COMPS);
  B.parts.forEach((o) => {
    const toggle = (e) => {
      if (S.pending) return; // con un cable a medias, el toque lo gestiona el tablero
      e.stopPropagation();
      S.states[o.c.id] ^= 1;
      render();
    };
    o.g.addEventListener('click', toggle);
    o.g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } });
  });
  const piaToggle = (e) => {
    if (S.pending) return;
    e.stopPropagation();
    S.power = !S.power;
    toast(S.power ? 'PIA subido: hay corriente.' : 'PIA bajado: sin corriente.');
    render();
  };
  B.pia.g.addEventListener('click', piaToggle);
  B.pia.g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); piaToggle(e); } });
  for (const [id, h] of Object.entries(B.hits)) {
    h.setAttribute('aria-label', `Tornillo ${nice(id)}`);
    h.addEventListener('pointerdown', (e) => onTermDown(e, id));
    h.addEventListener('click', (e) => e.stopPropagation());
    h.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapTerm(id); } });
  }
  drawWires(null);
  render();
}

function drawWires(fresh) {
  B.wireLayer.innerHTML = '';
  for (const w of S.wires) {
    const g = makeWire(B.wireLayer, wirePath(B.terms, w.a, w.b), w.col);
    w.g = g;
    el('title', {}, g, `${nice(w.a)} → ${nice(w.b)}`);
    if (fresh === 'all' || w === fresh) requestAnimationFrame(() => requestAnimationFrame(() => g.classList.add('shown')));
    else g.classList.add('shown');
    g.addEventListener('click', (e) => {
      if (S.pending) return;
      e.stopPropagation();
      S.selWire = S.selWire === w ? null : w;
      render();
    });
  }
}

/* ---------- conectar cables: toque-toque o arrastrar ---------- */
let drag = null;
function svgPoint(e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
function nearest(q, R, exclude) {
  let best = null, bd = R;
  for (const [id, t] of Object.entries(B.terms)) {
    if (id === exclude) continue;
    const d = Math.hypot(t.x - q.x, t.y - q.y);
    if (d < bd) { bd = d; best = id; }
  }
  return best;
}
function startFrom(id) {
  S.pending = id;
  S.selWire = null;
  if (S.autoColor) { S.color = suggestColor(id); syncChips(); }
}
function tapTerm(id) {
  if (S.pending && S.pending !== id) connect(S.pending, id);
  else if (S.pending === id) cancel();
  else { startFrom(id); render(); }
}
function onTermDown(e, id) {
  e.preventDefault();
  e.stopPropagation();
  if (S.pending) { tapTerm(id); return; }
  startFrom(id);
  drag = { pid: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  try { svg.setPointerCapture(e.pointerId); } catch (_) { /* sin captura */ }
  render();
}
let target = null;
function setTarget(t) {
  if (target === t) return;
  if (target && B.hits[target]) B.hits[target].classList.remove('target');
  target = t;
  if (t && B.hits[t]) B.hits[t].classList.add('target');
}
svg.addEventListener('pointermove', (e) => {
  if (!S.pending) return;
  const q = svgPoint(e);
  const t = B.terms[S.pending];
  if (drag && e.pointerId === drag.pid && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) drag.moved = true;
  const snap = (drag && drag.moved) || e.pointerType === 'mouse' ? nearest(q, L.snap, S.pending) : null;
  setTarget(snap);
  const end = snap ? B.terms[snap] : q;
  B.preview.setAttribute('d', `M${t.x} ${t.y} L${end.x} ${end.y}`);
});
svg.addEventListener('pointerup', (e) => {
  if (!drag || e.pointerId !== drag.pid) return;
  const moved = drag.moved;
  drag = null;
  if (!moved) return; // fue un toque: queda esperando el destino
  const t2 = nearest(svgPoint(e), L.snap * 1.2, S.pending);
  if (t2) connect(S.pending, t2);
  else { cancel(); toast('Suelta el cable encima de un tornillo.'); }
});
svg.addEventListener('pointercancel', () => { drag = null; });
// En táctil, un gesto que empieza en un tornillo es un cable, no un desplazamiento de página.
// (touch-action no se aplica a elementos internos del SVG en todos los navegadores.)
svg.addEventListener('touchstart', (e) => { if (e.target.closest?.('.hit')) e.preventDefault(); }, { passive: false });
svg.addEventListener('touchmove', (e) => { if (drag) e.preventDefault(); }, { passive: false });
svg.addEventListener('click', (e) => {
  if (S.pending) {
    const t2 = nearest(svgPoint(e), L.snap, null);
    if (t2 === S.pending) return;
    if (t2) connect(S.pending, t2); else cancel();
  } else if (S.selWire) { S.selWire = null; render(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('sheet').hidden) closeSheet();
  else if (S.pending) cancel();
});

function cancel() {
  S.pending = null;
  setTarget(null);
  B.preview.setAttribute('d', '');
  render();
}
function connect(a, b) {
  S.pending = null;
  setTarget(null);
  B.preview.setAttribute('d', '');
  if (S.wires.some((w) => key(w.a, w.b) === key(a, b))) { toast('Esos dos tornillos ya están unidos.'); render(); return; }
  snapshot();
  const w = { a, b, col: S.color };
  S.wires.push(w);
  S.hint = [];
  S.autoColor = true;
  drawWires(w);
  S.justWired = true;
  const lit = render();
  if (!lit) toast(`Cable de <strong>${COLORS[w.col].name.toLowerCase()}</strong>: ${nice(a)} → ${nice(b)}`);
}
function snapshot() {
  S.hist.push(S.wires.map(({ a, b, col }) => ({ a, b, col })));
  if (S.hist.length > 80) S.hist.shift();
}

/* ---------- render ---------- */
S.hint = [];
function render() {
  const r = simulate(COMPS, S.states, S.wires);
  if (S.power && r.short) {
    S.power = false;
    openSheet('bad', '¡Ha saltado la protección!', `<p>${SHORT_MSG[r.short]}</p><p>Quita el cable que sobra y toca el PIA para volver a dar corriente.</p>`);
  }
  const power = S.power;
  const live = (t) => power && r.same(t, 'sup.L');
  const on = power && r.on;
  const cp = currentPaths(COMPS, S.states, S.wires, on);

  for (const w of S.wires) {
    const f = cp.flow.get(w);
    w.g.classList.toggle('live', live(w.a));
    w.g.classList.toggle('flow', !!f);
    w.g.classList.toggle('rev', f === 'rev');
    w.g.classList.toggle('sel', w === S.selWire);
  }
  B.parts.forEach((o) => { o.update(S.states[o.c.id], live); o.g.classList.toggle('run', on); });
  B.lamp.setOn(on);
  B.pia.set(power);
  svg.classList.toggle('picking', !!S.pending);

  let lit = false;
  if (on && !S.wasOn) {
    B.lamp.flash();
    if (navigator.vibrate) try { navigator.vibrate(40); } catch (_) { /* no soportado */ }
    if (S.justWired) { lit = true; toast('<strong>¡Bombilla encendida!</strong> Mira cómo circula la corriente.', 'ok'); }
  }
  S.wasOn = on;
  S.justWired = false;

  for (const [id, h] of Object.entries(B.hits)) {
    h.classList.toggle('sel', id === S.pending);
    h.classList.toggle('cand', !!S.pending && id !== S.pending);
    h.classList.toggle('hintme', S.hint.includes(id));
    h.classList.toggle('volt', power && cp.dL.has(id) && !id.startsWith('sup.'));
  }

  renderStatus(power, on, cp);
  renderProgress();
  return lit;
}

function renderStatus(power, on, cp) {
  const st = $('status');
  let html;
  if (S.pending) {
    html = `<span class="dotc c-${S.color}"></span>Desde <strong>${nice(S.pending)}</strong>. Toca o arrastra hasta el otro tornillo.`;
  } else if (S.selWire) {
    const w = S.selWire;
    html = `<span class="dotc c-${w.col}"></span><span>${nice(w.a)} → ${nice(w.b)}</span><button class="mini danger" id="rmWire">Quitar</button>`;
  } else if (!power) {
    html = '<span class="dotc off"></span>Sin corriente. Toca el <strong>PIA</strong> del cuadro para subirlo.';
  } else if (on) {
    html = '<span class="dotc lit"></span>Bombilla encendida. Toca un interruptor para apagarla.';
  } else {
    html = `<span class="dotc volt"></span>${whereStops(cp.dL)}`;
  }
  st.innerHTML = html;
  const rm = $('rmWire');
  if (rm) rm.onclick = (e) => { e.stopPropagation(); removeWire(S.selWire); };
}
function whereStops(dL) {
  if (dL.has('lamp.L') || dL.has('lamp.N')) return 'La fase llega a la bombilla. Falta el <strong>neutro</strong> para volver.';
  const ts = [...dL.keys()].filter((t) => !t.startsWith('sup.'));
  if (!ts.length) return 'Toca un tornillo para empezar un cable.';
  const far = ts.reduce((a, b) => (dL.get(b) > dL.get(a) ? b : a));
  return `La fase llega hasta <strong>${nice(far)}</strong>.`;
}

function renderProgress() {
  const done = STEPS.map((s) => stepDone(s, S.wires));
  const n = done.filter(Boolean).length;
  $('progN').textContent = `${n}/${STEPS.length}`;
  $('progBar').style.width = `${(n / STEPS.length) * 100}%`;
  const ul = $('steps');
  ul.innerHTML = '';
  STEPS.forEach((s, i) => {
    const li = document.createElement('li');
    li.className = done[i] ? 'ok' : '';
    li.innerHTML = `<i aria-hidden="true">${done[i] ? '✓' : i + 1}</i><span>${s.t}</span><b class="sw-c c-${s.col}"></b>`;
    ul.appendChild(li);
  });
}

function removeWire(w) {
  snapshot();
  S.wires = S.wires.filter((x) => x !== w);
  S.selWire = null;
  drawWires(null);
  render();
  toast('Cable quitado. Puedes recuperarlo con Deshacer.');
}

/* ---------- acciones ---------- */
$('aCheck').onclick = () => {
  if (!S.wires.length) { openSheet('info', 'Aún no hay cables', '<p>Empieza por la tierra y el neutro de la bombilla.</p>'); return; }
  const an = analyze(COMPS, S.wires);
  const cols = colorIssues(S.wires, nice), mist = mistakes(S.wires, nice);
  const miss = STEPS.find((s) => !stepDone(s, S.wires));
  const hasPE = STEPS[0] && stepDone(STEPS[0], S.wires);
  const list = (a) => (a.length ? `<ul>${a.map((x) => `<li>${x}</li>`).join('')}</ul>` : '');
  if (an.shortR) {
    openSheet('bad', 'Cortocircuito', `<p>${SHORT_MSG[an.shortR.short]} Pasa en alguna posición de los interruptores.</p>${list(mist)}`);
  } else if (an.works) {
    const extra = hasPE ? [] : ['Falta la tierra hasta la bombilla. La luz funciona, pero es obligatoria.'];
    const clean = !extra.length && !cols.length;
    openSheet(clean ? 'ok' : 'info', clean ? '¡Funciona!' : 'Funciona, pero…',
      `<p>Cada interruptor enciende y apaga la luz en las ${an.total} combinaciones posibles.</p>${list(extra.concat(cols))}`);
  } else {
    const pre = an.onCount === 0
      ? 'La bombilla no se enciende en ninguna posición.'
      : `Se enciende en ${an.onCount} de ${an.total} posiciones, pero algún interruptor no la controla siempre.`;
    openSheet('bad', 'Todavía no funciona', `<p>${pre}</p>${list(mist.concat(cols))}${miss ? `<p class="next">Siguiente paso: ${miss.t}. Usa <strong>Pista</strong> para ver los tornillos.</p>` : ''}`);
  }
};
$('aHint').onclick = () => {
  const miss = STEPS.find((s) => !stepDone(s, S.wires));
  if (!miss) { S.hint = []; render(); toast('Tienes todos los cables. Prueba los interruptores.', 'ok'); return; }
  const set = new Set(S.wires.map((w) => key(w.a, w.b)));
  S.hint = [...new Set(miss.c[0].filter(([a, b]) => !set.has(key(a, b))).flat())];
  S.color = miss.col; S.autoColor = false; syncChips();
  render();
  toast(`<strong>Pista:</strong> ${miss.t}. Los tornillos parpadean en verde.`);
};
$('aUndo').onclick = () => {
  const h = S.hist.pop();
  if (!h) { toast('No hay nada que deshacer.'); return; }
  S.wires = h; S.selWire = null;
  drawWires(null); render();
  toast('Último cambio deshecho.');
};
$('aClear').onclick = () => {
  if (!S.wires.length) return;
  snapshot();
  S.wires = []; S.hint = []; S.selWire = null;
  drawWires(null); render();
  toast('Cables borrados. Deshacer los recupera.');
};
$('aSol').onclick = () => {
  snapshot();
  S.wires = [];
  STEPS.forEach((s) => s.c[0].forEach(([a, b]) => S.wires.push({ a, b, col: s.col })));
  S.hint = []; S.selWire = null; S.power = true;
  drawWires('all');
  S.justWired = true;
  if (!render()) toast('Solución puesta. Deshacer vuelve a tus cables.');
};

// La barra inferior es fija: la página reserva su altura al llevar algo a la vista
// y el tablero deja un hueco al final para que ningún tornillo quede tapado.
const dock = document.querySelector('.dock');
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--dock-h', `${dock.offsetHeight}px`);
}).observe(dock);

mq.addEventListener('change', build);
syncChips();
build();
toast('Toca un tornillo y luego otro para poner un cable.');
