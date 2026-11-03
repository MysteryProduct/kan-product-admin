// The history dialog v2 (TASK-0338): opens on every caller with real history, then the artboard's own data
// (a route fixture) for the dialog's figures, widths, states, keyboard, dark theme and the V1 comparison with
// the canvas artboards History (1440) and History-Phone (390). Development stack only; it changes no data.
//
//   node tests/screenshots/document-history-v2-capture.mjs [baseUrl] [apiUrl]
//
// Same environment as sale-orders-v2-capture.mjs (PLAYWRIGHT_DIR, PROXY, AUTH_STATE, SEED_FILE, OUT_DIR);
// ARTBOARDS = the folder holding the canvas's History*.dc.html files turns on the V1 comparison.
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
const api = (process.argv[3] ?? 'http://localhost:3010').replace(/\/$/, '');
// OUT_DIR keeps the files away from the dev server, which watches tests/ through its mount.
const out = process.env.OUT_DIR ?? join(here, 'document-history-v2');
mkdirSync(out, { recursive: true });

const seedFile = process.env.SEED_FILE ?? join(here, '../../../kan-product-api/scripts/seed-demo-audit-user.cjs');
const password = readFileSync(seedFile, 'utf8').match(/bcrypt\.hash\('([^']+)'/)?.[1];
if (!password) throw new Error('seed password not found');



const results = [];
const check = (name, ok, note = '') => {
  results.push({ name, ok: Boolean(ok), note });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ` — ${note}` : ''}`);
};

const browser = await chromium.launch();
// AUTH_STATE keeps the signed-in session between runs, because the login endpoint allows 5 tries per 15 minutes.
const authState = process.env.AUTH_STATE && existsSync(process.env.AUTH_STATE) ? process.env.AUTH_STATE : undefined;
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', locale: 'th-TH', timezoneId: 'Asia/Bangkok', storageState: authState });
const page = await context.newPage();
const consoleErrors = [];
// Each error names the page it came from, so a failure points at a screen.
const where = () => new URL(page.url()).pathname + new URL(page.url()).search;
page.on('pageerror', (error) => consoleErrors.push(`${String(error)} @ ${where()}`));
page.on('console', (message) => {
  if (message.type() === 'error' && !/favicon|Failed to load resource/.test(message.text())) consoleErrors.push(`${message.text().split('\n')[0]} @ ${where()}`);
});

if (process.env.DEBUG_NET) {
  page.on('response', (response) => response.status() >= 400 && console.log('HTTP', response.status(), response.url()));
  page.on('requestfailed', (request) => console.log('FAILED', request.url(), request.failure()?.errorText));
}
if (authState) {
  await page.goto(`${base}/admin`, { waitUntil: 'commit' });
  await page.waitForURL(/\/admin/, { timeout: 120000, waitUntil: 'commit' });
} else {
  await page.goto(`${base}/login`);
  await page.waitForSelector('#username', { timeout: 120000 });
  await page.evaluate(() => localStorage.setItem('theme', 'light'));
  await page.fill('#username', 'demo_audit');
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/admin/, { timeout: 120000, waitUntil: 'commit' });
  if (process.env.AUTH_STATE) await context.storageState({ path: process.env.AUTH_STATE });
}

const settle = async (ms = 600) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
};
const open = async (path, ready = '.ka-page-body') => {
  // A navigation that the dev server's own client routing interrupts is simply tried again.
  for (let attempt = 0; ; attempt += 1) {
    try {
      await page.goto(`${base}${path}`, { waitUntil: 'commit' });
      break;
    } catch (error) {
      if (attempt >= 3 || !/ERR_ABORTED/.test(String(error))) throw error;
      await page.waitForTimeout(800);
    }
  }
  try {
    await page.waitForSelector(ready, { timeout: 45000 }).catch(async () => {
      // The Admin shell now and then stays on its loading spinner; a reload clears it.
      await page.reload({ waitUntil: 'commit' });
      await page.waitForSelector(ready, { timeout: 45000 });
    });
  } catch (error) {
    // Leave evidence of what the page showed instead of only a timeout.
    await page.screenshot({ path: join(out, `fail-${path.replace(/\W+/g, '_').slice(0, 60)}.png`) }).catch(() => {});
    console.log('PAGE ERRORS', consoleErrors.slice(-5).join(' | '));
    console.log('BODY', (await page.locator('body').innerText().catch(() => '')).slice(0, 400));
    throw error;
  }
  await settle();
};
const token = async () => (await context.cookies()).find((cookie) => cookie.name === 'token')?.value;
const call = async (method, path, body) => {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
};


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

// ---------------------------------------------------------------- fixture: the artboard's four entries (D11)
const at = (day, hour, minute) => new Date(Date.UTC(2026, 10, day, hour - 7, minute)).toISOString(); // Bangkok time
const STAFF_A = '11111111-1111-4111-8111-111111111111';
const STAFF_B = '22222222-2222-4222-8222-222222222222';
const SYSTEM = '00000000-0000-0000-0000-000000000000';
const line = (id, name, quantity, patch = {}) => ({ sale_order_list_id: id, product_variant_id: null, product_name: name, quantity, returned_qty: 0, job_order_id: `job-${name}`, ...patch });
const CUP = 'แก้วเก็บความเย็น 30oz สกรีนโลโก้';
const TAG_ = 'พวงกุญแจหนังสลักชื่อ';
const BOX = 'กล่องไม้ใส่นามบัตร';
const STICKER = 'สติกเกอร์โลโก้ไดคัท';
const blank = { supplier_names: {}, purchase_order_codes: {}, material_names: {}, product_unit_names: {} };
const fixtureEntries = [
  { ...blank, document_history_id: 'f1', action: 'returned', actor_id: STAFF_A, actor_name: 'suwan', reason: 'ลูกค้าแจ้งว่าสีแก้วไม่ตรงกับที่สั่ง', created_at: at(3, 17, 55),
    previous_value: { sale_order_status: 'paid', items: [line('n1', CUP, 150), line('n2', TAG_, 200), line('n3', BOX, 100)] },
    next_value: { sale_order_status: 'partially_returned', items: [line('n1', CUP, 150, { returned_qty: 10 }), line('n2', TAG_, 200), line('n3', BOX, 100)] } },
  { ...blank, document_history_id: 'f2', action: 'approved', actor_id: STAFF_A, actor_name: 'suwan', reason: null, created_at: at(3, 9, 12),
    previous_value: { sale_order_status: 'pending' }, next_value: { sale_order_status: 'approved' } },
  { ...blank, document_history_id: 'f3', action: 'updated', actor_id: STAFF_B, actor_name: 'นภัส ศ.', reason: null, created_at: at(1, 10, 5),
    previous_value: { vat_type: 'none', items: [line('o1', CUP, 150), line('o2', TAG_, 150), line('o3', STICKER, 500)] },
    next_value: { vat_type: 'include', items: [line('n1', CUP, 150), line('n2', TAG_, 200), line('n3', BOX, 100)] } },
  { ...blank, document_history_id: 'f4', action: 'created', actor_id: SYSTEM, actor_name: SYSTEM, reason: null, created_at: new Date(Date.UTC(2026, 9, 28, 23, 35)).toISOString(),
    previous_value: null,
    next_value: { sale_order_type: 'order', sale_order_status: 'pending', items: [line('o1', CUP, 150), line('o2', TAG_, 150), line('o3', STICKER, 500)] } },
];
const page1 = { data: fixtureEntries, meta: { total: 9, page: 1, limit: 20, last_page: 3 } };
const HISTORY = /\/sale-order\/[^/?]+\/history/;
const UUID_TEXT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const openHistory = async () => {
  const opener = page.getByRole('button', { name: /ดูประวัติ/ }).first();
  await opener.scrollIntoViewIfNeeded().catch(() => {});
  await opener.click();
  await page.waitForSelector('.ka-hist', { timeout: 20000 });
  await page.waitForTimeout(700); // the rise animation
};
const closeHistory = async () => {
  await page.keyboard.press('Escape');
  await page.waitForSelector('.ka-hist', { state: 'detached', timeout: 10000 }).catch(() => {});
};
const dialogText = () => page.locator('.ka-hist').innerText();
const dialogShot = (name) => page.screenshot({ path: join(out, `${name}.png`) });

// ---------------------------------------------------------------- real history on every caller (AC10, AC5)
const firstId = async (path, key) => (await call('GET', path)).body?.data?.[0]?.[key];
const soId = await firstId(`/sale-order?page=1&limit=1&filters=${encodeURIComponent(JSON.stringify({ sale_order_status: ['partially_returned'] }))}`, 'sale_order_id');
const customSo = await firstId('/sale-order?page=1&limit=1&type=custom', 'sale_order_id');
const callers = [
  ['sale-order', `/admin/sale-orders/${soId}`, '.ka-so-grid'],
  ['sale-order-custom', `/admin/sale-orders/${customSo}`, '.ka-so-grid'],
  ['purchase-order', `/admin/purchase-orders/${await firstId('/purchase-order?page=1&limit=1', 'purchase_order_id')}`, '.ka-page-body'],
  ['purchase-receipt', `/admin/purchase-receipt/${await firstId('/purchase-receipt?page=1&limit=1', 'purchase_receipt_id')}`, '.ka-page-body'],
  ['job-order', `/admin/job-orders?jobId=${await firstId('/job-order?page=1&limit=1', 'job_order_id')}`, '[role=dialog]'],
  ['invoice-supplier', '/admin/invoice-supplier', 'tbody tr'],
  ['payment-receipt', '/admin/payment-receipts', 'tbody tr'],
];
for (const [name, path, ready] of callers) {
  try {
    await open(path, ready);
    if (name === 'invoice-supplier' || name === 'payment-receipt') {
      // These open their detail from the list: the first row's link or button.
      const opener = name === 'payment-receipt' ? page.locator('button[title="ดูรายละเอียด"]').first() : page.locator('tbody tr').first().locator('a, button').first();
      await opener.click();
      await page.waitForTimeout(1500);
    }
    await openHistory();
    await settle(800);
    const text = await dialogText();
    const label = await page.locator('.ka-hist .ka-modal__desc').innerText();
    check(`caller ${name}: the dialog opens with the document's label and no id`, label.length > 0 && !UUID_TEXT.test(text), `${label} · ${text.length} chars`);
    await dialogShot(`history-${name}-1440`);
    await closeHistory();
  } catch (error) {
    check(`caller ${name}: the dialog opens with the document's label and no id`, false, String(error).split('\n')[0]);
  }
}
// The page's own timeline is unchanged by this Task.
await open(`/admin/sale-orders/${soId}`, '.ka-so-grid');
check('caller sale-order: the on-page timeline still lists entries as before', (await page.locator('.ka-tl > li').count()) > 0);

// Focus returns to the opener; Tab stays in the dialog and shows where it is (AC9).
await openHistory();
const tabStops = [];
for (let index = 0; index < 6; index += 1) {
  await page.keyboard.press('Tab');
  tabStops.push(await page.evaluate(() => {
    const element = document.activeElement;
    const style = element ? getComputedStyle(element) : null;
    return { inside: Boolean(element?.closest('.ka-hist')), ring: Boolean(style && (style.outlineStyle !== 'none' || style.boxShadow !== 'none')) };
  }));
}
check('keyboard: Tab stays in the dialog and every stop shows focus', tabStops.every((stop) => stop.inside && stop.ring), JSON.stringify(tabStops));
await closeHistory();
check('keyboard: closing returns focus to "ดูประวัติทั้งหมด"', /ดูประวัติ/.test(await page.evaluate(() => document.activeElement?.textContent ?? '')));

// ---------------------------------------------------------------- the artboard's data (fixture)
await page.route(HISTORY, (route) => {
  const url = new URL(route.request().url());
  if (url.searchParams.get('page') === '2') return route.abort('failed');
  return route.fulfill({ json: page1 });
});
const errorsBefore = consoleErrors.length;
await open(`/admin/sale-orders/${soId}`, '.ka-so-grid');
await page.setViewportSize({ width: 1440, height: 1080 });
await openHistory();
const fixtureText = await dialogText();
check('fixture: grouped by day, today labelled', /วันนี้ · 3 พ\.ย\. 2569/.test(fixtureText) && /1 พ\.ย\. 2569/.test(fixtureText) && /29 ต\.ค\. 2569/.test(fixtureText), fixtureText.slice(0, 120));
check('fixture: the system shows as "ระบบ" and no id is printed', /ระบบ/.test(fixtureText) && !UUID_TEXT.test(fixtureText));
check('fixture: a return reads "คืน 10 จาก 150"', /คืน 10 จาก 150/.test(fixtureText));
check('fixture: an edit reads added, quantity changed and removed', /เพิ่ม[\s\S]*กล่องไม้ใส่นามบัตร/.test(fixtureText) && /150\s*→\s*200/.test(fixtureText) && /นำออก[\s\S]*สติกเกอร์โลโก้ไดคัท/.test(fixtureText));
check('fixture: creation has no "– →" and a first status', /สถานะเริ่มต้น/.test(fixtureText) && !/-\s*→/.test(fixtureText));
check('fixture: not all loaded, so who and when give way to "โหลดแล้ว 4 จาก 9"', /โหลดแล้ว\s*4 จาก 9 รายการ/.test(fixtureText) && !/ช่วงเวลา/.test(fixtureText));
check('fixture: the foot says how many are shown and offers more', /แสดง 4 จาก 9 รายการ/.test(fixtureText) && (await page.locator('.ka-hist .ka-modal__foot button').count()) === 1);
await dialogShot('history-fixture-1440');
// Loading more fails: the four stay and a retry is offered (AC1).
await page.locator('.ka-hist .ka-modal__foot button').click();
await page.waitForTimeout(1500);
check('load more: a failure keeps the entries and offers a retry', (await page.locator('.ka-hist__item').count()) === 4 && /โหลดประวัติเพิ่มเติมไม่สำเร็จ/.test(await dialogText()) && (await page.locator('.ka-hist .ka-hist__err button').count()) === 1);
await dialogShot('history-loadmore-error-1440');
await closeHistory();
consoleErrors.splice(errorsBefore);

// Every entry loaded: who and when are told (AC2).
await page.unroute(HISTORY);
await page.route(HISTORY, (route) => route.fulfill({ json: { data: fixtureEntries, meta: { total: 4, page: 1, limit: 20, last_page: 1 } } }));
await openHistory();
const allText = await dialogText();
check('summary: all loaded shows 3 people and "29 ต.ค. – 3 พ.ย. 2569"', /3 คน/.test(allText) && /29 ต\.ค\. – 3 พ\.ย\. 2569/.test(allText), allText.slice(0, 160));
await dialogShot('history-all-loaded-1440');
await closeHistory();

// Widths: inside the screen, no page scroll, nothing wider than the dialog (AC9).
for (const [width, height] of [[834, 1100], [390, 844], [320, 700]]) {
  await page.setViewportSize({ width, height });
  await openHistory();
  const fit = await page.evaluate(() => {
    const panel = document.querySelector('.ka-hist').getBoundingClientRect();
    const body = document.querySelector('.ka-hist .ka-modal__body');
    return { inside: panel.left >= 0 && panel.right <= window.innerWidth + 0.5 && panel.bottom <= window.innerHeight + 0.5, side: body.scrollWidth - body.clientWidth, doc: document.documentElement.scrollHeight - window.innerHeight };
  });
  check(`width ${width}: the dialog fits, nothing runs sideways, the page does not scroll`, fit.inside && fit.side <= 0 && fit.doc <= 0, JSON.stringify(fit));
  await dialogShot(`history-fixture-${width}`);
  await closeHistory();
}
await page.setViewportSize({ width: 1440, height: 1080 });

// A long reason wraps at 320px (AC4).
await page.unroute(HISTORY);
const longReason = 'เหตุผลยาว '.repeat(30).trim();
await page.route(HISTORY, (route) => route.fulfill({ json: { data: [{ ...fixtureEntries[0], reason: longReason }], meta: { total: 1, page: 1, limit: 20, last_page: 1 } } }));
await page.setViewportSize({ width: 320, height: 700 });
await openHistory();
const wrap = await page.evaluate(() => {
  const why = document.querySelector('.ka-hist__why');
  const body = document.querySelector('.ka-hist .ka-modal__body');
  return { lines: Math.round(why.getBoundingClientRect().height / 22), side: body.scrollWidth - body.clientWidth };
});
check('a long reason wraps inside the dialog at 320px', wrap.lines > 3 && wrap.side <= 0, JSON.stringify(wrap));
await closeHistory();
await page.setViewportSize({ width: 1440, height: 1080 });

// States: loading, failed then retried, empty (AC8).
await page.unroute(HISTORY);
let failFirst = true;
await page.route(HISTORY, async (route) => {
  if (route.request().url().includes('limit=20') && failFirst === 'slow') {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    return route.fulfill({ json: page1 });
  }
  if (failFirst === true) return route.abort('failed');
  return route.fulfill({ json: failFirst === 'empty' ? { data: [], meta: { total: 0, page: 1, limit: 20, last_page: 0 } } : page1 });
});
const errorsBeforeStates = consoleErrors.length;
for (const [width, height] of [[1440, 1080], [390, 844]]) {
  await page.setViewportSize({ width, height });
  await open(`/admin/sale-orders/${soId}`, '.ka-so-grid');
  failFirst = true;
  await openHistory();
  check(`state ${width}: a failed load says so and offers a retry`, /ไม่สามารถโหลดประวัติการเปลี่ยนแปลงได้/.test(await dialogText()) && (await page.locator('.ka-hist .ka-hist__err button').count()) === 1);
  await dialogShot(`history-error-${width}`);
  failFirst = false;
  await page.locator('.ka-hist .ka-hist__err button').click();
  await page.waitForSelector('.ka-hist__item', { timeout: 10000 });
  check(`state ${width}: retry loads the entries`, (await page.locator('.ka-hist__item').count()) === 4);
  await closeHistory();
  failFirst = 'empty';
  await openHistory();
  check(`state ${width}: no history says so`, /ยังไม่มีประวัติการเปลี่ยนแปลง/.test(await dialogText()));
  await dialogShot(`history-empty-${width}`);
  await closeHistory();
  failFirst = 'slow';
  await page.locator('button', { hasText: /ดูประวัติ/ }).first().click();
  await page.waitForSelector('.ka-hist__skel', { timeout: 3000 });
  check(`state ${width}: loading shows the placeholder timeline`, (await page.locator('.ka-hist__skelrow').count()) === 3);
  await dialogShot(`history-loading-${width}`);
  await page.waitForSelector('.ka-hist__item', { timeout: 10000 });
  await closeHistory();
}
consoleErrors.splice(errorsBeforeStates);
await page.unroute(HISTORY);
await page.route(HISTORY, (route) => route.fulfill({ json: page1 }));

// Dark theme and reduced motion (AC9).
await page.setViewportSize({ width: 1440, height: 1080 });
await page.emulateMedia({ colorScheme: 'dark' });
await page.evaluate(() => localStorage.setItem('theme', 'dark'));
await open(`/admin/sale-orders/${soId}`, '.ka-so-grid');
await openHistory();
check('dark: the dialog uses the dark surface', await page.evaluate(() => getComputedStyle(document.querySelector('.ka-hist')).backgroundColor !== 'rgb(255, 255, 255)'));
await dialogShot('history-fixture-dark-1440');
await closeHistory();
await page.evaluate(() => localStorage.setItem('theme', 'light'));
await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
await page.unroute(HISTORY);
await page.route(HISTORY, async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return route.fulfill({ json: page1 });
});
await open(`/admin/sale-orders/${soId}`, '.ka-so-grid');
await page.locator('button', { hasText: /ดูประวัติ/ }).first().click();
await page.waitForSelector('.ka-hist__skel', { timeout: 5000 });
check('reduced motion: the placeholder does not pulse', await page.evaluate(() => getComputedStyle(document.querySelector('.ka-hist__skelbody i')).animationName === 'none'));
await page.waitForSelector('.ka-hist__item', { timeout: 10000 });
await closeHistory();
await page.emulateMedia({ reducedMotion: 'no-preference' });

// ---------------------------------------------------------------- V1: the artboards against the app
const artboards = process.env.ARTBOARDS;
const fidelity = [];
if (artboards) {
  await page.unroute(HISTORY);
  await page.route(HISTORY, (route) => route.fulfill({ json: page1 }));
  const designPage = await context.newPage();
  const measure = (selectors) =>
    selectors.map((selector) => {
      const element = selector && [...document.querySelectorAll(selector)].find((node) => node.getBoundingClientRect().width > 0);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { x: Math.round(rect.x * 10) / 10, y: Math.round(rect.y * 10) / 10, w: Math.round(rect.width * 10) / 10, h: Math.round(rect.height * 10) / 10, font: `${style.fontSize}/${style.fontWeight}` };
    });
  const MARKS = {
    1440: [
      ['dialog', 'section[role=dialog]', '.ka-hist'],
      ['icon tile', 'section[role=dialog] header > span', '.ka-hist__tile'],
      ['title', '#h-title', '.ka-hist .ka-modal__title'],
      ['label', 'section[role=dialog] header p', '.ka-hist .ka-modal__desc'],
      ['summary card 1', 'section[role=dialog] > div:nth-of-type(1) > div:nth-child(1)', '.ka-hist__stat'],
      ['day heading', 'h3', '.ka-hist__dayh'],
      ['first action icon', 'ol > li > div > span', '.ka-hist__ic'],
      ['first action name', 'ol > li > div:nth-child(2) > div > span', '.ka-hist__act'],
      ['first time', 'ol > li time', '.ka-hist__time'],
      ['reason', 'ol p', '.ka-hist__why'],
      ['first change box', 'dl', '.ka-hist__box'],
      ['first status badge', 'dd > span', '.ka-hist__box .ka-badge'],
      ['second day heading', 'h3:nth-of-type(2)', '.ka-hist__day:nth-child(2) .ka-hist__dayh'],
      ['edit change box', 'ol:nth-of-type(2) dl', '.ka-hist__day:nth-child(2) .ka-hist__box'],
      ['added item row', 'dl ul > li', '.ka-hist__it[data-kind="added"]'],
      ['foot', 'footer', '.ka-hist .ka-modal__foot'],
    ],
    390: [
      ['sheet', 'section[role=dialog]', '.ka-hist'],
      ['icon tile', 'section[role=dialog] header > span', '.ka-hist__tile'],
      ['title', '#hp-title', '.ka-hist .ka-modal__title'],
      ['day heading', 'h3', '.ka-hist__dayh'],
      ['first action icon', 'ol > li > div > span', '.ka-hist__ic'],
      ['first action name', 'ol > li > div:nth-child(2) > div > div > span', '.ka-hist__act'],
      ['reason', 'ol p', '.ka-hist__why'],
      ['first change box', 'dl', '.ka-hist__box'],
      ['first status badge', 'dd > span', '.ka-hist__box .ka-badge'],
      ['added item row', 'dl ul > li', '.ka-hist__it[data-kind="added"]'],
      ['foot button', 'footer button', '.ka-hist .ka-modal__foot button'],
    ],
  };
  for (const [width, height, file] of [[1440, 1080, 'History.dc.html'], [390, 1500, 'History-Phone.dc.html']]) {
    await designPage.setViewportSize({ width, height });
    await page.setViewportSize({ width, height });
    const source = readFileSync(join(artboards, file), 'utf8');
    await designPage.setContent('<!doctype html><html><body></body></html>');
    await designPage.setContent(await designPage.evaluate(expandArtboard, source), { waitUntil: 'load' });
    await designPage.waitForTimeout(800);
    await open(`/admin/sale-orders/${soId}`, '.ka-so-grid');
    await openHistory();
    await settle(800);
    const marks = MARKS[width];
    const design = await designPage.evaluate(measure, marks.map((mark) => mark[1]));
    const app = await page.evaluate(measure, marks.map((mark) => mark[2]));
    // Positions inside the dialog, so its own place on the screen does not shift every row.
    marks.forEach(([name], index) => {
      const d = design[index];
      const a = app[index];
      const dx = d && a ? Math.round(((a.x - app[0].x) - (d.x - design[0].x)) * 10) / 10 : null;
      const dy = d && a ? Math.round(((a.y - app[0].y) - (d.y - design[0].y)) * 10) / 10 : null;
      fidelity.push({ width, name, dx, dy, dw: d && a ? Math.round((a.w - d.w) * 10) / 10 : null, dh: d && a ? Math.round((a.h - d.h) * 10) / 10 : null, design: d, app: a });
    });
    await designPage.screenshot({ path: join(out, `artboard-history-${width}.png`), fullPage: true });
    await dialogShot(`app-history-${width}`);
    await closeHistory();
  }
  const pad = (value, size) => String(value ?? '–').padEnd(size);
  console.log(['w', 'landmark', 'dx', 'dy', 'dw', 'dh', 'design', 'app'].map((h, i) => pad(h, [6, 20, 7, 7, 7, 7, 22, 22][i])).join(''));
  for (const row of fidelity) {
    const box = (value) => (value ? `${value.w}×${value.h} ${value.font}` : 'missing');
    console.log([row.width, row.name, row.dx, row.dy, row.dw, row.dh, box(row.design), box(row.app)].map((v, i) => pad(v, [6, 20, 7, 7, 7, 7, 22, 22][i])).join(''));
  }
}

check('no console or page errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
writeFileSync(join(out, 'results.json'), JSON.stringify({ results, consoleErrors, fidelity }, null, 2));
const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
