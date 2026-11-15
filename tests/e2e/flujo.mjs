import { chromium, webkit, devices } from 'playwright';

const SITE = process.env.SITE || 'https://moiam.github.io/luz-tres-interruptores/';
import { mkdirSync } from 'node:fs';
const OUT = new globalThis.URL('../../test-results/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const CIRCUIT = [['sup.PE', 'lamp.PE'], ['sup.N', 'lamp.N'], ['sup.L', 'A.L'], ['A.1', 'C.E1'], ['A.2', 'C.E2'], ['C.S1', 'B.1'], ['C.S2', 'B.2'], ['B.L', 'lamp.L']];
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; };

async function center(page, sel) {
  const loc = page.locator(sel).first();
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
}
const state = (page) => page.evaluate(() => ({
  wires: document.querySelectorAll('.wire').length,
  on: !!document.querySelector('.lamp.on'),
  flow: document.querySelectorAll('.wire.flow').length,
  status: document.getElementById('status').textContent.trim(),
  pia: document.querySelector('.pia').getAttribute('aria-checked'),
  scrollW: document.documentElement.scrollWidth, w: innerWidth,
}));

async function run(label, browserType, ctxOpts, mode) {
  console.log(`\n=== ${label} ===`);
  const browser = await browserType.launch(browserType === chromium ? { channel: 'chrome' } : {});
  const ctx = await browser.newContext(ctxOpts);
  // las pruebas no cuentan como visitas en las estadísticas
  await ctx.route(/goatcounter\.com|gc\.zgo\.at/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(SITE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.hit');

  const press = async (sel) => {
    const [x, y] = await center(page, sel);
    if (mode === 'touch') await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
    await page.waitForTimeout(200);
  };
  const t = (id) => `.hit[data-t="${id}"]`;

  let s = await state(page);
  check('carga sin errores y sin scroll lateral', errors.length === 0 && s.scrollW <= s.w, `ancho ${s.scrollW}/${s.w}`);
  check('PIA arranca encendido', s.pia === 'true');

  // 1) primer cable tocando dos tornillos
  await press(t('sup.PE'));
  s = await state(page);
  check('tocar un tornillo empieza el cable', s.status.startsWith('Desde Cuadro · PE'), s.status);
  await press(t('lamp.PE'));
  s = await state(page);
  check('tocar el segundo tornillo pone el cable', s.wires === 1);

  // 2) segundo cable arrastrando
  if (mode === 'touch' && browserType === chromium) {
    const cdp = await ctx.newCDPSession(page);
    const [x1, y1] = await center(page, t('A.1'));
    const b = await page.locator(t('C.E1')).boundingBox();
    const [x2, y2] = [b.x + b.width / 2, b.y + b.height / 2];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] });
    for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + (x2 - x1) * i / 12, y: y1 + (y2 - y1) * i / 12 }] }); await page.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else if (mode === 'mouse') {
    const [x1, y1] = await center(page, t('A.1'));
    const b = await page.locator(t('C.E1')).boundingBox();
    await page.mouse.move(x1, y1); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 6, b.y + b.height / 2 + 4, { steps: 12 }); // suelta un poco desviado: debe engancharse
    await page.mouse.up();
  } else { await press(t('A.1')); await press(t('C.E1')); }
  await page.waitForTimeout(300);
  s = await state(page);
  check(mode === 'touch' && browserType !== chromium ? 'segundo cable (toques)' : 'arrastrar pone el cable (con imán)', s.wires === 2, `cables=${s.wires}`);

  // 3) resto del circuito
  for (const [a, b] of CIRCUIT) {
    if ((a === 'sup.PE') || (a === 'A.1')) continue;
    await press(t(a)); await press(t(b));
  }
  await page.waitForTimeout(500);
  s = await state(page);
  check('circuito completo: bombilla encendida', s.wires === 8 && s.on, `cables=${s.wires} on=${s.on}`);
  check('flujo de corriente visible en 5 cables', s.flow === 5, `flow=${s.flow}`);
  await page.screenshot({ path: `${OUT}${label}-encendida.png`, fullPage: false });

  // 4) cada interruptor invierte la luz
  for (const [i, sel] of [[1, '.sw >> nth=0'], [2, '.sw >> nth=1'], [3, '.sw >> nth=2']]) {
    const before = (await state(page)).on;
    const plate = page.locator(sel).locator('.plate');
    await plate.scrollIntoViewIfNeeded();
    const bb = await plate.boundingBox();
    if (mode === 'touch') await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); else await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.waitForTimeout(250);
    check(`interruptor ${i} cambia la luz`, (await state(page)).on !== before);
  }

  // 5) PIA
  const onBefore = (await state(page)).on;
  await press('.pia-body');
  s = await state(page);
  check('PIA se baja y apaga todo', s.pia === 'false' && !s.on);
  await press('.pia-body');
  s = await state(page);
  check('PIA se sube y vuelve como estaba', s.pia === 'true' && s.on === onBefore);

  // 6) seleccionar y quitar cable
  const wire = page.locator('.wire .touch').nth(1);
  await wire.scrollIntoViewIfNeeded();
  const wb = await page.locator('.wire').nth(1).locator('.core').boundingBox();
  // punto sobre el trazo: usa el punto medio del path
  const mid = await page.evaluate(() => { const p = document.querySelectorAll('.wire .touch')[1]; const L = p.getTotalLength(); const q = p.getPointAtLength(L / 2); const m = p.getScreenCTM(); return [q.x * m.a + m.e, q.y * m.d + m.f]; });
  if (mode === 'touch') await page.touchscreen.tap(...mid); else await page.mouse.click(...mid);
  await page.waitForTimeout(200);
  const hasRm = await page.locator('#rmWire').isVisible().catch(() => false);
  check('tocar un cable lo selecciona y ofrece "Quitar"', hasRm);
  if (hasRm) { await press('#rmWire'); check('"Quitar" elimina el cable', (await state(page)).wires === 7); }
  await press('#aUndo');
  check('Deshacer lo recupera', (await state(page)).wires === 8);

  // 7) Comprobar
  await press('#aCheck');
  await page.waitForTimeout(300);
  const title = await page.locator('#sheetTitle').textContent();
  check('Comprobar abre el resultado', await page.locator('#sheet').isVisible(), title);
  await page.screenshot({ path: `${OUT}${label}-resultado.png` });
  await press('#sheetClose');
  await page.waitForTimeout(400);
  check('el resultado se cierra y la página vuelve a responder', !(await page.locator('#sheet').isVisible()));
  await press(t('sup.L'));
  check('tras cerrar, los tornillos siguen respondiendo', (await state(page)).status.startsWith('Desde'));

  // 8) Borrar + Pista + Solución
  await page.keyboard.press('Escape');
  await press('#aClear');
  check('Borrar quita todos los cables', (await state(page)).wires === 0);
  await press('#aHint');
  const hinted = await page.locator('.hit.hintme').count();
  check('Pista marca los tornillos', hinted === 2, `${hinted}`);
  await press('#aSol');
  await page.waitForTimeout(600);
  s = await state(page);
  check('Solución monta el circuito', s.wires === 8);

  check('sin errores de JavaScript', errors.length === 0, errors.join(' / '));
  await page.screenshot({ path: `${OUT}${label}-completa.png`, fullPage: true });
  await browser.close();
}

// Uso: SITE=http://localhost:8000/ npm run test:e2e  (por defecto, la web publicada)
await run('escritorio-chrome', chromium, { viewport: { width: 1280, height: 900 } }, 'mouse');
await run('movil-chrome', chromium, { ...devices['Pixel 7'] }, 'touch');
await run('iphone-safari', webkit, { ...devices['iPhone 13'] }, 'touch');
console.log(`\n${fails ? fails + ' FALLOS' : 'TODO OK'}`);
process.exitCode = fails ? 1 : 0;
