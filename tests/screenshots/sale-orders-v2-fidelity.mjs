// Sale orders v2 (TASK-0336 V1): measures the app against the "Sales Order Redesign" artboards at the same
// viewport. Each artboard .dc.html is expanded into plain HTML (its <sc-for>/<sc-if>/{{holes}} filled from the
// artboard's own renderVals()) and served from memory, then the same landmarks are measured in both with
// getBoundingClientRect. Development stack only; needs the demo_audit session saved by the capture script.
//
//   ARTBOARDS=<folder with the .dc.html files> node tests/screenshots/sale-orders-v2-fidelity.mjs
//
// Same environment variables as sale-orders-v2-capture.mjs (PLAYWRIGHT_DIR, PROXY, AUTH_STATE, SEED_FILE).
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(process.env.PLAYWRIGHT_DIR ?? here, 'noop.js'));
const { chromium } = require('playwright');

if (process.env.PROXY) {
  const forward = (port) =>
    net
      .createServer((client) => {
        const upstream = net.connect(port, 'host.docker.internal');
        client.pipe(upstream).pipe(client);
        client.on('error', () => upstream.destroy());
        upstream.on('error', () => client.destroy());
      })
      .listen(port, '127.0.0.1');
  forward(3011);
  forward(3010);
}

const base = (process.argv[2] ?? 'http://localhost:3011').replace(/\/$/, '');
const artboards = process.env.ARTBOARDS ?? '/artboards';
// OUT_DIR keeps the files away from the dev server, which watches tests/ through its mount.
const out = process.env.OUT_DIR ?? join(here, 'sale-orders-v2');
mkdirSync(out, { recursive: true });
if (!process.env.AUTH_STATE) throw new Error('AUTH_STATE is required');

// Runs inside the page: turns an artboard's source into the HTML its viewer would draw.
const expandArtboard = (source) => {
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const script = doc.querySelector('script[data-dc-script]')?.textContent ?? '';
  const Component = new Function('DCLogic', `${script}; return Component;`)(class DCLogic { constructor() { this.props = {}; } });
  const vals = new Component().renderVals();
  const lookup = (path, scope) => {
    const [head, ...rest] = path.trim().split('.');
    let value = head in scope ? scope[head] : vals[head];
    for (const key of rest) value = value == null ? undefined : value[key];
    return value;
  };
  const fill = (text, scope) => text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, path) => String(lookup(path, scope) ?? ''));
  const expand = (node, scope) => {
    if (node.nodeType === 3) {
      node.textContent = fill(node.textContent, scope);
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'sc-for') {
      const list = lookup(node.getAttribute('list').replace(/[{}]/g, ''), scope) ?? [];
      const as = node.getAttribute('as');
      const fragment = document.createDocumentFragment();
      list.forEach((item, index) => {
        for (const child of node.childNodes) {
          const clone = child.cloneNode(true);
          expand(clone, { ...scope, [as]: item, $index: index });
          fragment.appendChild(clone);
        }
      });
      node.replaceWith(fragment);
      return;
    }
    if (tag === 'sc-if') {
      const on = Boolean(lookup(node.getAttribute('value').replace(/[{}]/g, ''), scope));
      if (!on) {
        node.remove();
        return;
      }
      for (const child of [...node.childNodes]) expand(child, scope);
      node.replaceWith(...node.childNodes);
      return;
    }
    for (const attribute of [...node.attributes]) {
      if (attribute.name.startsWith('hint-')) node.removeAttribute(attribute.name);
      else if (/^\{\{[^}]+\}\}$/.test(attribute.value.trim())) {
        const raw = lookup(attribute.value.replace(/[{}]/g, ''), scope);
        if (raw === false || raw == null) node.removeAttribute(attribute.name);
        else node.setAttribute(attribute.name, raw === true ? '' : String(raw));
      } else if (attribute.value.includes('{{')) node.setAttribute(attribute.name, fill(attribute.value, scope));
    }
    for (const child of [...node.childNodes]) expand(child, scope);
  };
  const root = doc.querySelector('x-dc');
  const helmet = root.querySelector('helmet');
  const head = helmet ? helmet.innerHTML : '';
  helmet?.remove();
  for (const child of [...root.childNodes]) expand(child, {});
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${head}<style>body{margin:0}</style></head><body>${root.innerHTML}</body></html>`;
};

// Landmarks: [name, artboard selector, app selector]; each is measured as { x, y, w, h } (y from the page top).
const SCREENS = {
  list: {
    path: '/admin/sale-orders',
    ready: '.ka-so-kpis',
    marks: [
      ['title h1', 'main h1', '.ka-so-ph h1'],
      ['kpi card 1', 'main > div:nth-child(2) > div:nth-child(1)', '.ka-so-kpis > :nth-child(1)'],
      ['kpi card 2', 'main > div:nth-child(2) > div:nth-child(2)', '.ka-so-kpis > :nth-child(2)'],
      ['kpi card 4', 'main > div:nth-child(2) > div:nth-child(4)', '.ka-so-kpis > :nth-child(4)'],
      ['ready heading', '#ready-title', '#ready-title'],
      ['status tabs', '[role=tablist]', '.ka-so-tabs'],
      ['table head row', 'thead tr', '.ka-so-lt thead tr'],
      ['first table row', 'tbody tr', '.ka-so-lt tbody tr'],
      ['status badge', 'tbody tr td:nth-child(7) span', '.ka-so-lt tbody tr .ka-badge'],
    ],
  },
  detail: {
    path: null,
    ready: '.ka-so-grid',
    marks: [
      ['code heading', 'main h1', '.ka-so-dh__code'],
      ['steps card', 'ol', '.ka-so-steps, .ka-so-vsteps'],
      ['items heading', '#items-t', '#so-items'],
      ['items table head', 'thead tr', '.ka-so-it thead tr'],
      ['items first row', 'tbody tr', '.ka-so-it tbody tr'],
      ['balance card', 'section[aria-labelledby=pay-t]', '.ka-so-due'],
      ['info heading', '#info-t', '#so-doc'],
    ],
  },
  form: {
    path: '/admin/sale-orders/new',
    ready: '.ka-so-form',
    marks: [
      ['title h1', 'main h1', '.ka-so-ph h1'],
      ['info card heading', '#f1', '#so-doc-title'],
      ['name input', 'input', '#so-name'],
      ['lines heading', '#f2', '#so-lines-title'],
      ['summary heading', '#sum-t', '#so-sum-title'],
    ],
  },
};

const measure = (selectors) =>
  selectors.map((selector) => {
    const element = [...document.querySelectorAll(selector)].find((node) => node.getBoundingClientRect().width > 0);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return { x: Math.round(rect.x * 10) / 10, y: Math.round((rect.y + window.scrollY) * 10) / 10, w: Math.round(rect.width * 10) / 10, h: Math.round(rect.height * 10) / 10, font: `${style.fontSize}/${style.fontWeight}` };
  });

const FILES = {
  list: { 1440: 'Main.dc.html', 834: 'List-Tablet.dc.html', 390: 'List-Phone.dc.html' },
  detail: { 1440: 'Detail.dc.html', 834: 'Detail-Tablet.dc.html', 390: 'Detail-Phone.dc.html' },
  form: { 1440: 'Create.dc.html', 834: 'Create-Tablet.dc.html', 390: 'Create-Phone.dc.html' },
};
const only = (process.env.ONLY ?? 'list,detail,form').split(',');

const browser = await chromium.launch();
const haveState = existsSync(process.env.AUTH_STATE);
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', locale: 'th-TH', storageState: haveState ? process.env.AUTH_STATE : undefined });
const appPage = await context.newPage();
const designPage = await context.newPage();
if (!haveState) {
  // One sign-in, saved for the next runs (the login allows 5 tries per 15 minutes).
  const seedFile = process.env.SEED_FILE ?? join(here, '../../../kan-product-api/scripts/seed-demo-audit-user.cjs');
  const password = readFileSync(seedFile, 'utf8').match(/bcrypt\.hash\('([^']+)'/)?.[1];
    await appPage.goto(`${base}/login`);
  await appPage.waitForSelector('#username', { timeout: 120000 });
  await appPage.evaluate(() => localStorage.setItem('theme', 'light'));
  await appPage.fill('#username', 'demo_audit');
  await appPage.fill('#password', password);
  await appPage.click('button[type=submit]');
  await appPage.waitForURL(/\/admin/, { timeout: 120000, waitUntil: 'commit' });
  await context.storageState({ path: process.env.AUTH_STATE });
}

const rows = [];
const settle = async (page, ms = 700) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
};

for (const [screen, config] of Object.entries(SCREENS)) {
  if (!only.includes(screen)) continue;
  for (const width of [1440, 834, 390]) {
    const height = width === 1440 ? 1000 : width === 834 ? 1100 : 844;
    await appPage.setViewportSize({ width, height });
    await designPage.setViewportSize({ width, height });

    const source = readFileSync(join(artboards, FILES[screen][width]), 'utf8');
    await designPage.setContent('<!doctype html><html><body></body></html>');
    const html = await designPage.evaluate(expandArtboard, source);
    await designPage.setContent(html, { waitUntil: 'load' });
    await designPage.waitForTimeout(800);

    let path = config.path;
    if (!path) {
      // A detail page needs a real order; the paid store order the list shows first is a stable choice.
      await appPage.goto(`${base}/admin/sale-orders?tab=paid`, { waitUntil: 'commit' });
      await appPage.waitForSelector('.ka-so-rowlink', { timeout: 120000, state: 'attached' });
      path = await appPage.locator('.ka-so-rowlink').first().getAttribute('href');
    }
    await appPage.goto(`${base}${path}`, { waitUntil: 'commit' });
    try {
      await appPage.waitForSelector(config.ready, { timeout: 45000 }).catch(async () => {
        // The Admin shell now and then stays on its loading spinner; a reload clears it.
        await appPage.reload({ waitUntil: 'commit' });
        await appPage.waitForSelector(config.ready, { timeout: 45000 });
      });
    } catch {
      await appPage.screenshot({ path: join(out, `fail-${screen}-${width}.png`) });
      console.log('MISSING', screen, width, appPage.url());
      continue;
    }
    await settle(appPage, 1200);

    const design = await designPage.evaluate(measure, config.marks.map((mark) => mark[1]));
    const app = await appPage.evaluate(measure, config.marks.map((mark) => mark[2]));
    // The first landmark both sides show (a screen-reader-only title is 1px wide and does not count).
    const shared = config.marks.findIndex((_, index) => design[index]?.w > 1 && app[index]?.w > 1);
    const top = (list) => list[shared]?.y ?? 0;
    config.marks.forEach(([name], index) => {
      const d = design[index];
      const a = app[index];
      rows.push({
        screen,
        width,
        name,
        design: d,
        app: a,
        dx: d && a ? Math.round((a.x - d.x) * 10) / 10 : null,
        dw: d && a ? Math.round((a.w - d.w) * 10) / 10 : null,
        dh: d && a ? Math.round((a.h - d.h) * 10) / 10 : null,
        // Vertical position relative to the title, so content above it does not shift every row.
        dyRel: d && a ? Math.round(((a.y - top(app)) - (d.y - top(design))) * 10) / 10 : null,
      });
    });
    await designPage.screenshot({ path: join(out, `artboard-${screen}-${width}.png`), fullPage: true });
    // The Admin scrolls inside <main>; let the shell grow for the full-page shot of the app.
    await appPage.addStyleTag({ content: 'html,body,.h-screen,.overflow-hidden{height:auto!important;overflow:visible!important}main{height:auto!important;overflow-x:hidden!important;overflow-y:visible!important}' });
    await appPage.screenshot({ path: join(out, `app-${screen}-${width}.png`), fullPage: true });
  }
}

writeFileSync(join(out, 'fidelity.json'), JSON.stringify(rows, null, 2));
const pad = (value, size) => String(value ?? '–').padEnd(size);
console.log(pad('screen', 7), pad('w', 5), pad('landmark', 20), pad('dx', 6), pad('dw', 6), pad('dh', 6), pad('dy*', 6), 'design (w×h)  app (w×h)');
for (const row of rows) {
  console.log(
    pad(row.screen, 7), pad(row.width, 5), pad(row.name, 20), pad(row.dx, 6), pad(row.dw, 6), pad(row.dh, 6), pad(row.dyRel, 6),
    row.design ? `${row.design.w}×${row.design.h} ${row.design.font}` : 'missing', ' ', row.app ? `${row.app.w}×${row.app.h} ${row.app.font}` : 'missing',
  );
}
await browser.close();
process.exit(0);
