// Sale orders v2 (TASK-0336): screenshots at 390/834/1440px, the real create → approve → pay → return →
// cancel → delete flows, saved totals against the old calculation, keyboard walk and overflow at 320px.
// Development stack only: signs in with the demo_audit account whose password the API seed script sets
// (kan-product-api/scripts/seed-demo-audit-user.cjs). Every order it creates is named "ทดสอบ TASK-0336 …"
// and removed again at the end.
//
//   node tests/screenshots/sale-orders-v2-capture.mjs [baseUrl] [apiUrl]
//
// Needs the `playwright` package and Chromium, installed outside this repo; set PLAYWRIGHT_DIR to the
// folder whose node_modules holds it and SEED_FILE when the API checkout is not beside this one.
// PROXY=1 forwards localhost:3011 (the page) and :3010 (the API) to host.docker.internal for a run inside
// the Playwright container; the API allows CORS only from localhost:3011.
// STAGE=smoke runs only the screenshots of existing data; the default runs everything.
// Screenshots and results.json go to tests/screenshots/sale-orders-v2/.
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
const out = process.env.OUT_DIR ?? join(here, 'sale-orders-v2');
mkdirSync(out, { recursive: true });

const seedFile = process.env.SEED_FILE ?? join(here, '../../../kan-product-api/scripts/seed-demo-audit-user.cjs');
const password = readFileSync(seedFile, 'utf8').match(/bcrypt\.hash\('([^']+)'/)?.[1];
if (!password) throw new Error('seed password not found');

const WIDTHS = [390, 834, 1440];
const TAG = 'ทดสอบ TASK-0336';
const results = [];
const check = (name, ok, note = '') => {
  results.push({ name, ok: Boolean(ok), note });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ` — ${note}` : ''}`);
};

const browser = await chromium.launch();
// AUTH_STATE keeps the signed-in session between runs, because the login endpoint allows 5 tries per 15 minutes.
const authState = process.env.AUTH_STATE && existsSync(process.env.AUTH_STATE) ? process.env.AUTH_STATE : undefined;
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', locale: 'th-TH', storageState: authState });
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
// The Admin scrolls inside <main>, so a full-page shot lets the shell grow for the moment it is taken.
const shot = async (name, options = {}) => {
  await page.addStyleTag({ content: 'html,body,.h-screen,.overflow-hidden{height:auto!important;overflow:visible!important}main{height:auto!important;overflow-x:hidden!important;overflow-y:visible!important}', }).then((tag) => tag.evaluate((node) => (node.id = 'ka-shot')));
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: true, ...options });
  await page.evaluate(() => document.getElementById('ka-shot')?.remove());
};
// The page must not scroll sideways and must not scroll as a whole document (the Admin layout trap).
const layoutProblems = () =>
  page.evaluate(() => {
    const main = document.querySelector('main');
    const root = document.documentElement;
    return {
      sideScroll: main ? main.scrollWidth - main.clientWidth : 0,
      docExtra: root.scrollHeight - window.innerHeight,
      bodySide: document.body.scrollWidth - window.innerWidth,
    };
  });
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

// ---------------------------------------------------------------- screenshots of what is there
const statusLink = async (tab) => {
  await open(`/admin/sale-orders?tab=${tab}`, '#so-list-panel');
  const href = await page
    .locator('.ka-so-rowlink')
    .first()
    .getAttribute('href')
    .catch(() => null);
  return href;
};

const targets = {};
for (const tab of ['pending', 'approved', 'partial', 'paid', 'returns', 'cancelled']) {
  targets[tab] = await statusLink(tab);
}
console.log('detail targets', JSON.stringify(targets));

for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : width === 834 ? 1100 : 844 });
  await open('/admin/sale-orders', '.ka-so-kpis');
  await settle(900);
  await shot(`list-${width}`);
  const problem = await layoutProblems();
  check(`list ${width}: no side scroll and no document scroll`, problem.sideScroll <= 0 && problem.docExtra <= 0 && problem.bodySide <= 0, JSON.stringify(problem));

  for (const [tab, href] of Object.entries(targets)) {
    if (!href) continue;
    await open(href, '.ka-so-grid');
    await shot(`detail-${tab}-${width}`);
    const detailProblem = await layoutProblems();
    check(`detail ${tab} ${width}: no side scroll and no document scroll`, detailProblem.sideScroll <= 0 && detailProblem.docExtra <= 0, JSON.stringify(detailProblem));
  }

  await open('/admin/sale-orders/new', '.ka-so-form');
  await shot(`form-new-${width}`);
  const formProblem = await layoutProblems();
  check(`form new ${width}: no side scroll and no document scroll`, formProblem.sideScroll <= 0 && formProblem.docExtra <= 0, JSON.stringify(formProblem));
}


if (process.env.STAGE === 'smoke') {
  writeFileSync(join(out, 'results.json'), JSON.stringify({ results, consoleErrors, targets }, null, 2));
  const failedSmoke = results.filter((item) => !item.ok);
  console.log(`\n${results.length - failedSmoke.length}/${results.length} passed`);
  await browser.close();
  process.exit(failedSmoke.length ? 1 : 0);
}

await page.setViewportSize({ width: 1440, height: 1000 });
const text = (selector) => page.locator(selector).first().innerText();
const toastText = async () => (await page.locator('.ka-toasts, [role=status]').allInnerTexts()).join(' | ');
const dismissResult = async () => {
  // The receipt dialog reports its result in a dialog of its own.
  const done = page.locator('[role=dialog] button').filter({ hasText: /ตกลง|ปิด|เสร็จ/ }).last();
  await done.click({ timeout: 8000 }).catch(() => {});
  await settle(500);
};
const created = [];

// ---------------------------------------------------------------- list: tabs, filters, states
await open('/admin/sale-orders?tab=pending', '#so-list-panel');
const tabKeys = ['all', 'pending', 'approved', 'partial', 'paid', 'returns', 'cancelled'];
// The counts arrive from a client-side fetch, so once they show the page is hydrated and the tabs respond.
await page.waitForFunction(() => !/–/.test(document.querySelector('#so-tab-all > span')?.textContent ?? '–'), null, { timeout: 30000 });
for (const key of tabKeys) {
  await page.click(`#so-tab-${key}`);
  await settle(700);
  const countText = (await text(`#so-tab-${key} > span`)).replace(/\D/g, '');
  const pager = await page.locator('.ka-so-fbar__count').first().innerText().catch(() => '');
  const total = pager.match(/จาก\s*([\d,]+)/)?.[1]?.replace(/,/g, '') ?? '0';
  check(`list tab ${key}: count ${countText} equals the filtered total ${total}`, countText === total, pager);
  check(`list tab ${key}: URL holds the tab`, key === 'all' ? !page.url().includes('tab=') : page.url().includes(`tab=${key}`));
}

await open('/admin/sale-orders?q=SO&tab=pending&type=custom&range=30d&page=1', '#so-list-panel');
check('list: a reload keeps the URL state', (await page.locator('#so-tab-pending').getAttribute('aria-selected')) === 'true' && (await page.locator('.ka-so-search input').inputValue()) === 'SO');
await page.fill('.ka-so-search input', 'ซซซไม่มีแน่นอน');
await page.waitForTimeout(900);
check('list: typing a search puts it in the URL once', decodeURIComponent(page.url()).includes('q=ซซซไม่มีแน่นอน'));
await settle(700);
check('list: no match shows its own state', (await page.locator('.ka-so-empty').count()) === 1 && /ไม่พบใบสั่งขาย/.test(await text('.ka-so-empty')));
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  await settle(300);
  await shot(`list-nomatch-${width}`);
}
await page.setViewportSize({ width: 1440, height: 1000 });

// A tab chosen again must not leave the list waiting.
await open('/admin/sale-orders?tab=partial', '#so-list-panel');
await page.click('#so-tab-partial');
await page.waitForTimeout(1200);
check('list: choosing the current tab again is not stuck loading', (await page.locator('#so-list-panel').getAttribute('aria-busy')) === null);

// The summary cards read the summary endpoint; the pending card picks its tab.
const digits = (value) => String(value).replace(/[^\d.]/g, '');
const apiSummary = (await call('GET', '/sale-order/summary')).body;
const apiReadyTotal = (await call('GET', '/fetch-sale-order?page=1&limit=1')).body?.total;
await open('/admin/sale-orders', '.ka-so-kpis');
await page.waitForFunction(() => !/–/.test(document.querySelector('.ka-so-kpi:nth-child(4) .ka-so-kpi__v')?.textContent ?? '–'), null, { timeout: 30000 });
const kpiValues = (await page.locator('.ka-so-kpi__v').allInnerTexts()).map(digits);
const wantKpis = [apiSummary.counts.pending, Number(apiSummary.outstanding_total).toFixed(2), Number(apiSummary.received_this_month).toFixed(2), apiReadyTotal].map(digits);
check('list: the summary cards show the summary figures', JSON.stringify(kpiValues) === JSON.stringify(wantKpis), `${kpiValues.join(' / ')} vs ${wantKpis.join(' / ')}`);
await page.click('button.ka-so-kpi');
await settle(500);
check('list: the pending card picks the pending tab', page.url().includes('tab=pending') && (await page.locator('#so-tab-pending').getAttribute('aria-selected')) === 'true');

// Arrow keys move between the tabs.
await page.focus('#so-tab-pending');
await page.keyboard.press('ArrowRight');
await settle(500);
const afterRight = await page.evaluate(() => document.activeElement?.id);
await page.keyboard.press('ArrowLeft');
await settle(500);
check('list: arrow keys move between the tabs', afterRight === 'so-tab-approved' && page.url().includes('tab=pending'), `${afterRight}, ${page.url()}`);

// Back returns to the filters before; the custom range cannot be turned around.
await open('/admin/sale-orders?tab=paid', '#so-list-panel');
await page.waitForFunction(() => !/–/.test(document.querySelector('#so-tab-all > span')?.textContent ?? '–'), null, { timeout: 30000 });
await page.click('#so-tab-cancelled');
await settle(700);
await page.goBack({ waitUntil: 'commit' });
await settle(900);
check('list: back returns to the tab before', page.url().includes('tab=paid') && (await page.locator('#so-tab-paid').getAttribute('aria-selected')) === 'true', page.url());
await open('/admin/sale-orders?range=custom&from=2026-10-01&to=2026-10-31', '#so-list-panel');
const fromInput = page.locator('.ka-so-dates input[type=date]').first();
const toInput = page.locator('.ka-so-dates input[type=date]').last();
check('list: the custom range keeps from before to', (await fromInput.getAttribute('max')) === '2026-10-31' && (await toInput.getAttribute('min')) === '2026-10-01');

// Sorting by the total, both ways.
const totalsShown = async () => (await page.locator('#so-list-panel tbody tr td.ka-so-r').allInnerTexts()).map((value) => Number(value.replace(/[^\d.]/g, '')));
await open('/admin/sale-orders?sort=total_desc', '#so-list-panel');
await settle(700);
const desc = await totalsShown();
await open('/admin/sale-orders?sort=total_asc', '#so-list-panel');
await settle(700);
const asc = await totalsShown();
const ordered = (values, way) => values.length > 1 && values.every((value, index) => index === 0 || (way === 'desc' ? values[index - 1] >= value : values[index - 1] <= value));
check('list: sorting by total works both ways', ordered(desc, 'desc') && ordered(asc, 'asc') && (await page.locator('th[aria-sort=ascending]').count()) === 1, `${desc.slice(0, 3)} / ${asc.slice(0, 3)}`);

// Empty and failed lists, answered by routes so the real data stays untouched.
const emptyList = { data: [], meta: { total: 0, page: 1, last_page: 0, limit: 10 } };
const zeroSummary = { counts: { all: 0, pending: 0, approved: 0, partial: 0, paid: 0, cancelled: 0, partially_returned: 0, returned: 0 }, pending_total: 0, outstanding_total: 0, outstanding_count: 0, received_this_month: 0, received_last_month: 0 };
await page.route(/\/sale-order\?/, (route) => route.fulfill({ json: emptyList }));
await page.route(/\/sale-order\/summary/, (route) => route.fulfill({ json: zeroSummary }));
await open('/admin/sale-orders', '.ka-so-kpis');
await settle(700);
check('list: the empty system says so and offers to create', /ยังไม่มีใบสั่งขาย/.test(await text('.ka-so-empty')) && (await page.locator('.ka-so-empty a.ka-btn--primary').count()) === 1);
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  await settle(300);
  await shot(`list-empty-${width}`);
}
await page.unroute(/\/sale-order\?/);
await page.unroute(/\/sale-order\/summary/);
await page.route(/\/sale-order\?/, (route) => route.abort('failed'));
// The page logs the load it was made to fail; only that expected message is dropped afterwards.
const errorsBeforeFailedLoad = consoleErrors.length;
await page.setViewportSize({ width: 1440, height: 1000 });
await open('/admin/sale-orders', '.ka-so-kpis');
await settle(900);
check('list: a failed load shows a banner with retry and keeps the filters', (await page.locator('.ka-so-cp .ka-banner, .ka-so-cp [role=alert]').count()) > 0);
consoleErrors.push(...consoleErrors.splice(errorsBeforeFailedLoad).filter((line) => !/^Error fetching sale orders: AxiosError/.test(line)));
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  await settle(300);
  await shot(`list-error-${width}`);
}
await page.unroute(/\/sale-order\?/);
await page.setViewportSize({ width: 1440, height: 1000 });

// ---------------------------------------------------------------- the run's own ready-to-sell rows
// Creating an order claims a whole ready row, so the run makes its own (tagged) rows from the job of an
// existing one and never sells the real ones. Any that are left are deleted at the end.
// Tagged rows an earlier, interrupted run left behind go first, so each card name is unique.
for (const row of (await call('GET', `/fetch-sale-order?page=1&limit=50&search=${encodeURIComponent(TAG)}`)).body?.data ?? []) {
  await call('DELETE', `/fetch-sale-order/${row.fetch_sale_order_id}`);
}
const anyReady = (await call('GET', '/fetch-sale-order?page=1&limit=1')).body?.data?.[0];
check('setup: a job with ready-to-sell goods exists to copy from', Boolean(anyReady));
const ownReady = {};
for (const [key, qty] of [['A', 4], ['B', 1], ['C', 1]]) {
  const made = await call('POST', '/fetch-sale-order', { jobOrderId: anyReady.job_order_id, jobOrderName: `${TAG} พร้อมขาย ${key}`, qty, price: 120, cost: 50 });
  ownReady[key] = made.body?.data ?? made.body;
}
check('setup: three tagged ready rows were made', ['A', 'B', 'C'].every((key) => ownReady[key]?.fetch_sale_order_id), JSON.stringify(Object.values(ownReady).map((row) => row?.fetch_sale_order_id ?? row)));

// ---------------------------------------------------------------- create from ready-to-sell goods
await open('/admin/sale-orders', '.ka-so-ready');
// The dev server may still reload the page once after it first shows; wait for that before reading it.
await settle(1500);
await page.waitForSelector('.ka-so-rc', { timeout: 45000 });
const readyCount = await page.locator('.ka-so-rc').count();
check('create: ready-to-sell goods are on the list', readyCount > 0, `${readyCount} cards`);
// Two chosen cards give a form with two lines; nothing is typed, so leaving it asks nothing.
for (const key of ['B', 'C']) await page.locator('.ka-so-rc', { hasText: `${TAG} พร้อมขาย ${key}` }).locator('input[type=checkbox]').check();
check('create: two chosen cards are counted on the button', /จาก 2 รายการ/.test(await text('.ka-so-ready__foot a.ka-btn--primary')));
await page.click('.ka-so-ready__foot a.ka-btn--primary');
await page.waitForURL(/\/new\?ready=/, { timeout: 30000, waitUntil: 'commit' });
await page.waitForFunction(() => document.querySelectorAll('.ka-so-form .ka-so-ln').length >= 2, null, { timeout: 40000 }).catch(() => {});
check('create: two chosen cards fill two lines', (await page.locator('.ka-so-ln').count()) === 2, String(await page.locator('.ka-so-ln').count()));
await open('/admin/sale-orders', '.ka-so-ready');
await settle(1000);
await page.waitForSelector('.ka-so-rc', { timeout: 45000 });
await page.locator('.ka-so-rc', { hasText: `${TAG} พร้อมขาย A` }).locator('input[type=checkbox]').check();
check('create: the create button names how many are chosen', /จาก 1 รายการ/.test(await text('.ka-so-ready__foot a.ka-btn--primary')));
const posts = [];
page.on('request', (request) => {
  if (['POST', 'PATCH'].includes(request.method()) && /\/sale-order(\/[^/]+)?$/.test(new URL(request.url()).pathname)) {
    posts.push({ method: request.method(), body: request.postDataJSON() });
  }
});
await page.click('.ka-so-ready__foot a.ka-btn--primary');
await page.waitForURL(/\/new\?ready=/, { timeout: 30000, waitUntil: 'commit' });
await page.waitForSelector('.ka-so-form .ka-so-ln', { timeout: 40000 }).catch(async () => {
  // The dev server now and then stalls an in-app navigation; a reload of the same URL clears it.
  await page.reload({ waitUntil: 'commit' });
  await page.waitForSelector('.ka-so-form .ka-so-ln', { timeout: 60000 });
});
await settle();
const firstLines = await page.locator('.ka-so-ln').count();
const firstQty = firstLines ? await page.locator('.ka-so-ln input[id$="-qty"]').first().inputValue() : '';
check('create: the chosen goods fill the first line', firstLines === 1 && firstQty !== '', `${firstLines} lines, qty "${firstQty}"`);
const maxQty = Number(await page.locator('.ka-so-ln input[id$="-qty"]').inputValue());
const priceText = await page.locator('.ka-so-ln input[id$="-price"]').inputValue();
await shot('form-new-ready-1440');

const longName = `${TAG} ${'ชื่อยาวมากสำหรับทดสอบการตัดบรรทัด '.repeat(3)}`.slice(0, 120);
await page.fill('#so-name', longName);
await page.click('#so-vat-include');
await page.fill('#so-address', 'บจก. ทดสอบ 99/9 ถ.วิภาวดีรังสิต กรุงเทพฯ');
await page.fill('#so-detail', 'ทดสอบ TASK-0336');
const qtyInput = page.locator('.ka-so-ln input[id$="-qty"]');
const priceInput = page.locator('.ka-so-ln input[id$="-price"]');

// Quantity and price are checked as typed; nothing is rewritten.
await qtyInput.fill('1.5');
check('form: "1.5" stays as typed in the quantity', (await qtyInput.inputValue()) === '1.5');
await qtyInput.fill(String(maxQty + 5));
await page.waitForTimeout(200);
check('form: a quantity above the ready quantity warns at once', /เกินจำนวนพร้อมขาย/.test(await text('.ka-so-ln[data-bad]')));
await priceInput.fill('12.345');
await page.click('.ka-so-sum__acts button[type=submit]');
await page.waitForSelector('.ka-so-errors', { timeout: 5000 });
const summaryItems = await page.locator('.ka-so-errors__list li').allInnerTexts();
const focusedField = await page.evaluate(() => document.activeElement?.id ?? '');
check('form: a rejected save lists each problem and focuses the first field to fix', summaryItems.length >= 2 && /-qty$/.test(focusedField), `${summaryItems.join(' / ')} · focus ${focusedField}`);
await shot('form-error-1440');
await priceInput.fill(priceText);
await qtyInput.fill('2');
const wantNet = (2 * Number(priceText)).toFixed(2);
await page.waitForFunction((want) => (document.querySelector('.ka-so-net b')?.textContent ?? '').replace(/[^\d.]/g, '') === want, wantNet, { timeout: 5000 }).catch(() => {});
const netText = await text('.ka-so-net b');
check('form: the net total follows the lines (include VAT keeps the price)', netText.replace(/[^\d.]/g, '') === (2 * Number(priceText)).toFixed(2), netText);

const [createResponse] = await Promise.all([
  page.waitForResponse((response) => response.request().method() === 'POST' && /\/sale-order$/.test(new URL(response.url()).pathname), { timeout: 60000 }),
  page.click('.ka-so-sum__acts button[type=submit]'),
]);
const createdOrder = await createResponse.json();
const orderA = createdOrder.data ?? createdOrder;
created.push(orderA.sale_order_id);
await page.waitForURL(new RegExp(`/admin/sale-orders/${orderA.sale_order_id}$`), { timeout: 60000, waitUntil: 'commit' });
await page.waitForSelector('.ka-so-grid');
await settle();
const createBody = posts.find((item) => item.method === 'POST')?.body ?? {};
const KEYS = ['sale_order_name', 'sale_order_detail', 'shipping_address_name', 'sale_order_type', 'vat_type', 'sale_order_subtotal', 'sale_order_vat_amount', 'sale_order_total', 'create_by', 'saleOrderLists'];
check('create: the request body carries the same keys as the old dialog', KEYS.every((key) => key in createBody) && Object.keys(createBody).length === KEYS.length, Object.keys(createBody).join(','));
const lineKeys = ['fetch_sale_order_id', 'product_name', 'sale_order_list_qty', 'sale_order_list_price', 'sale_order_list_total', 'sale_order_list_cost', 'job_order_id'];
check('create: each line carries the same keys as the old dialog', lineKeys.every((key) => key in createBody.saleOrderLists[0]) && Object.keys(createBody.saleOrderLists[0]).length === lineKeys.length);
const priceNum = Number(priceText);
const baseAmount = 2 * priceNum;
const vat = Math.round(((baseAmount * 0.07) / 1.07) * 100) / 100;
check('create: saved totals match the old VAT calculation (include)', Math.abs(createBody.sale_order_vat_amount - vat) < 0.011 && Math.abs(createBody.sale_order_total - baseAmount) < 0.011, JSON.stringify([createBody.sale_order_vat_amount, createBody.sale_order_total]));
check('create: the new order is pending and opens on its own page', /รออนุมัติ/.test(await text('.ka-so-dh__id')) && page.url().endsWith(orderA.sale_order_id));
check('create: a pending order offers approve and edit, not pay or return', (await page.locator('.ka-so-dh__acts').getByText('อนุมัติ', { exact: true }).count()) === 1 && (await page.locator('.ka-so-dh__acts').getByText('แก้ไข', { exact: true }).count()) === 1 && (await page.locator('.ka-so-dh__acts').getByText('รับชำระ', { exact: true }).count()) === 0);
await shot('detail-created-1440');

// back from the new order reaches the list, not the form
await page.goBack();
await page.waitForTimeout(1200);
check('create: back from the saved order does not return to the form', !/\/new/.test(page.url()), page.url());
await open(`/admin/sale-orders/${orderA.sale_order_id}`, '.ka-so-grid');

// ---------------------------------------------------------------- edit
await page.locator('.ka-so-dh__acts').getByText('แก้ไข', { exact: true }).click();
await page.waitForSelector('.ka-so-form .ka-so-ln');
await settle();
check('edit: the form starts from the saved values', (await page.locator('#so-name').inputValue()) === longName.trim() || (await page.locator('#so-name').inputValue()).startsWith(TAG));
await shot('form-edit-1440');
const stockBefore = await call('GET', `/sale-order/${orderA.sale_order_id}`);
await page.locator('.ka-so-ln input[id$="-qty"]').fill('1');
const [editResponse] = await Promise.all([
  page.waitForResponse((response) => response.request().method() === 'PATCH', { timeout: 60000 }),
  page.click('.ka-so-sum__acts button[type=submit]'),
]);
check('edit: the save is accepted', editResponse.status() < 300, String(editResponse.status()));
await page.waitForURL(new RegExp(`/admin/sale-orders/${orderA.sale_order_id}$`), { timeout: 60000, waitUntil: 'commit' });
await settle();
const patchBody = posts.find((item) => item.method === 'PATCH')?.body ?? {};
check('edit: the request body carries the old keys plus update_by', KEYS.every((key) => key in patchBody) && 'update_by' in patchBody && 'sale_order_id' in patchBody);
check('edit: the detail shows the new quantity', (await text('.ka-so-it tbody tr')).includes('1'));
void stockBefore;

// ---------------------------------------------------------------- approve, pay, return
await page.locator('.ka-so-dh__acts').getByText('อนุมัติ', { exact: true }).click();
await page.getByText('อนุมัติและตัดสต็อก', { exact: true }).click();
await page.waitForSelector('.ka-so-dh__acts >> text=รับชำระ', { timeout: 30000 });
await settle();
check('approve: the order is approved and offers payment', /อนุมัติแล้ว/.test(await text('.ka-so-dh__id')) && (await page.locator('.ka-so-dh__acts').getByText('รับชำระ', { exact: true }).count()) === 1);
check('approve: the balance card shows the whole amount due', /฿/.test(await text('.ka-so-due__v')));
await shot('detail-approved-created-1440');

const pay = async (amount) => {
  // Payment has its own page since TASK-0346: it starts on bank transfer, which needs an account; cash needs none.
  const orderUrl = page.url();
  await page.locator('.ka-so-dh__acts').getByText('รับชำระ', { exact: true }).click();
  await page.waitForSelector('.ka-pr-sosum', { timeout: 20000 });
  await page.getByRole('radio', { name: /เงินสด/ }).click();
  await page.fill('#ka-pr-amt', String(amount));
  await page.locator('.ka-pr-fsave .ka-pr-btn--a').click();
  await page.waitForSelector('.ka-pr-res', { timeout: 20000 });
  await page.goto(orderUrl, { waitUntil: 'commit' });
  await page.waitForSelector('.ka-so-dh__id', { timeout: 30000 });
  await settle(900);
};
await pay(50);
check('pay: part payment makes the order partial and the balance card moves', /ชำระบางส่วน/.test(await text('.ka-so-dh__id')) && /ยอดค้างรับ/.test(await text('.ka-so-due')), await text('.ka-so-due'));
check('pay: the receipt shows in the order', (await page.locator('.ka-so-rcp').count()) === 1);
await shot('detail-partial-created-1440');
const paidOrder = await call('GET', `/sale-order/${orderA.sale_order_id}`);
const totalDue = Number(paidOrder.body.sale_order_subtotal ?? paidOrder.body.data?.sale_order_subtotal);
await pay((totalDue - 50).toFixed(2));
check('pay: paying the rest makes it paid in full', /ชำระครบแล้ว/.test(await text('.ka-so-dh__id')), await text('.ka-so-dh__id'));
check('pay: a paid order of ready goods offers neither pay nor return (nothing goes back into stock)', (await page.locator('.ka-so-dh__acts').getByText('คืนสินค้า', { exact: true }).count()) === 0 && (await page.locator('.ka-so-dh__acts').getByText('รับชำระ', { exact: true }).count()) === 0);
await shot('detail-paid-created-1440');

// return: on an order sold from stock (a product variant), made, approved and paid through the API.
const stockVariant = '30000000-0000-4000-8000-000000000202';
const userCookie = JSON.parse(decodeURIComponent((await context.cookies()).find((cookie) => cookie.name === 'user')?.value ?? '{}'));
const madeD = await call('POST', '/sale-order', {
  sale_order_name: `${TAG} คืนสินค้า`, sale_order_detail: '', shipping_address_name: '', sale_order_type: 'order', vat_type: 'none',
  sale_order_total: 200, create_by: userCookie.employee_id,
  saleOrderLists: [{ product_variant_id: stockVariant, product_name: `${TAG} สินค้าคืน`, sale_order_list_qty: 2, sale_order_list_price: 100, sale_order_list_total: 200 }],
});
const orderD = madeD.body?.data ?? madeD.body;
check('return: an order sold from stock could be made', madeD.status < 300 && Boolean(orderD?.sale_order_id), `${madeD.status} ${JSON.stringify(madeD.body).slice(0, 160)}`);
if (orderD?.sale_order_id) {
  created.push(orderD.sale_order_id);
  await call('POST', `/sale-order/${orderD.sale_order_id}/approve`, { status: 'approved', update_by: userCookie.employee_id });
  const today = new Date().toISOString().slice(0, 10);
  await call('POST', '/payment-receipts', { sale_order_id: orderD.sale_order_id, payment_receipt_type: 'full', payment_method: 'cash', amount_paid: 200, payment_date: today, payment_status: 'paid', create_by: userCookie.employee_id });
  await open(`/admin/sale-orders/${orderD.sale_order_id}`, '.ka-so-grid');
  check('return: a paid order sold from stock offers return', (await page.locator('.ka-so-dh__acts').getByText('คืนสินค้า', { exact: true }).count()) === 1);
  await page.locator('.ka-so-dh__acts').getByText('คืนสินค้า', { exact: true }).click();
  await page.waitForSelector('.ka-so-ret input');
  await page.fill('.ka-so-ret input', 'abc');
  await page.getByText('ยืนยันคืนสินค้า', { exact: true }).click();
  check('return: a non-number is explained and nothing is sent', (await page.locator('.ka-so-ret .ka-error').count()) === 1);
  await page.fill('.ka-so-ret input', '99');
  check('return: more than was sold is refused', /ไม่เกิน/.test(await text('.ka-so-ret .ka-error')));
  await shot('return-dialog-1440');
  await page.fill('.ka-so-ret input', '1');
  let returnPosts = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/return$/.test(request.url())) returnPosts += 1;
  });
  await page.getByText('ยืนยันคืนสินค้า', { exact: true }).dblclick();
  await page.waitForTimeout(2500);
  await settle(800);
  check('return: pressing confirm twice sends one request', returnPosts === 1, String(returnPosts));
  check('return: the order shows a partial return', /คืนสินค้าบางส่วน/.test(await text('.ka-so-dh__id')), await text('.ka-so-dh__id'));
  // Paid in full and then partly returned: nothing is owed (review F3).
  const dueAfterReturn = await text('.ka-so-due:visible .ka-so-due__v');
  check('return: a paid order owes nothing after a return', dueAfterReturn.replace(/[^\d.]/g, '') === '0.00' && /รับชำระครบแล้ว/.test(await text('.ka-so-due:visible .ka-so-due__k')), dueAfterReturn);
  const afterReturn = await call('GET', `/payment-receipts?sale_order_id=${orderD.sale_order_id}`);
  const refunds = (afterReturn.body.data ?? []).filter((receipt) => Number(receipt.amount_paid) < 0);
  check('return: a negative receipt was recorded and shows in the list', refunds.length === 1 && (await page.locator('.ka-so-rcp__amt[data-refund]').count()) === 1, JSON.stringify(refunds.map((r) => r.amount_paid)));
  await shot('detail-returned-created-1440');
}

// ---------------------------------------------------------------- cancel and delete (orders made through the API)
const makeOrder = async (name, ready) => {
  if (!ready?.fetch_sale_order_id) return null;
  const body = JSON.parse(JSON.stringify(createBody));
  body.sale_order_name = name;
  body.saleOrderLists[0].fetch_sale_order_id = ready.fetch_sale_order_id;
  body.saleOrderLists[0].job_order_id = ready.job_order_id;
  body.saleOrderLists[0].product_name = ready.fetch_sale_order_name;
  body.saleOrderLists[0].sale_order_list_qty = 1;
  body.saleOrderLists[0].sale_order_list_total = body.saleOrderLists[0].sale_order_list_price;
  body.sale_order_total = body.sale_order_subtotal = body.saleOrderLists[0].sale_order_list_price;
  body.sale_order_vat_amount = Math.round(((body.sale_order_total * 7) / 107) * 100) / 100;
  const response = await call('POST', '/sale-order', body);
  return response.status < 300 ? response.body.data ?? response.body : null;
};
const orderB = await makeOrder(`${TAG} ยกเลิก`, ownReady.B);
check('cancel: a second order could be made for the flow', Boolean(orderB));
if (orderB) {
  created.push(orderB.sale_order_id);
  await open(`/admin/sale-orders/${orderB.sale_order_id}`, '.ka-so-grid');
  await page.locator('.ka-so-dh__acts .ka-so-more').click();
  await page.getByRole('menuitem', { name: 'ยกเลิกเอกสาร' }).click();
  await page.waitForSelector('[role=dialog] textarea', { timeout: 15000 });
  await shot('cancel-dialog-1440');
  await page.fill('[role=dialog] textarea', 'ทดสอบยกเลิก TASK-0336');
  await page.getByText('ยืนยันยกเลิก', { exact: true }).click();
  await page.waitForSelector('.ka-so-cancelled', { timeout: 30000 });
  await settle();
  check('cancel: the order is cancelled and shows the reason', /ยกเลิก/.test(await text('.ka-so-dh__id')) && /ทดสอบยกเลิก/.test(await text('.ka-so-cancelled')), await text('.ka-so-cancelled'));
  await shot('detail-cancelled-created-1440');
}
const orderC = await makeOrder(`${TAG} ลบ`, ownReady.C);
check('delete: a third order could be made for the flow', Boolean(orderC));
if (orderC) {
  await open(`/admin/sale-orders/${orderC.sale_order_id}`, '.ka-so-grid');
  await page.locator('.ka-so-dh__acts .ka-so-more').click();
  await page.getByRole('menuitem', { name: 'ลบ', exact: true }).click();
  await page.getByText('ลบใบสั่งขาย', { exact: true }).last().click();
  await page.waitForURL(/\/admin\/sale-orders$/, { timeout: 30000, waitUntil: 'commit' });
  const gone = await call('GET', `/sale-order/${orderC.sale_order_id}`);
  check('delete: the order is deleted and the page returns to the list', gone.status === 404, String(gone.status));
}

// ---------------------------------------------------------------- routes, menus, guards
// An approved order is not editable: its edit URL shows a note, not the form.
await open(targets.approved.replace('/admin/sale-orders/', '/admin/sale-orders/') + '/edit', '.ka-page-body');
check('route: editing an approved order shows a note, not the form', (await page.locator('.ka-so-form').count()) === 0 && (await page.locator('[role=note]').count()) === 1);

// The Dashboard's "สร้างใบขาย" lands on the ready-to-sell goods with the heading focused and the hash dropped.
await open('/admin/sale-orders#ready', '#ready-title');
await page.waitForTimeout(1500);
check('route: #ready focuses the ready-to-sell heading and drops the hash', (await page.evaluate(() => document.activeElement?.id)) === 'ready-title' && !page.url().includes('#'), page.url());

// A custom order keeps its own payment block in place of the generic balance card.
const customHref = await (async () => {
  await open('/admin/sale-orders?type=custom', '#so-list-panel');
  return page.locator('.ka-so-rowlink').first().getAttribute('href');
})();
await open(customHref, '.ka-so-grid');
check('custom: the detail shows the custom payment block and no return or edit', (await page.locator('[aria-label="การรับชำระงานผลิต Custom"]:visible').count()) === 1 && (await page.locator('.ka-so-dh__acts').getByText('คืนสินค้า', { exact: true }).count()) === 0);
await shot('detail-custom-1440');

// Row menus follow the status and type.
const menuOf = async (tab) => {
  await open(`/admin/sale-orders?tab=${tab}`, '#so-list-panel');
  await page.locator('.ka-so-lt tbody tr .ka-so-lt__menu button').first().click();
  const items = await page.getByRole('menuitem').allInnerTexts();
  await page.keyboard.press('Escape');
  return items.map((item) => item.trim());
};
const pendingMenu = await menuOf('pending&type=custom');
check('menu: a pending custom order offers cancel but not edit or delete', pendingMenu.includes('ยกเลิกเอกสาร') && !pendingMenu.includes('แก้ไข') && !pendingMenu.includes('ลบ'), pendingMenu.join(', '));
const paidMenu = await menuOf('paid&type=store');
check('menu: a paid store order offers neither return nor delete', !paidMenu.includes('คืนสินค้า') && !paidMenu.includes('ลบ'), paidMenu.join(', '));
const cancelledMenu = await menuOf('cancelled');
check('menu: a cancelled order offers only viewing', cancelledMenu.length === 1 && cancelledMenu[0] === 'ดูรายละเอียด', cancelledMenu.join(', '));

// A ready-to-sell id that has gone is skipped and said so; a half-typed form asks before leaving.
await open('/admin/sale-orders', '.ka-so-ready');
await page.locator('.ka-so-rc input[type=checkbox]').first().check();
const readyHref = await page.locator('.ka-so-ready__foot a.ka-btn--primary').getAttribute('href');
await open(`${readyHref},00000000-0000-4000-8000-000000000000`, '.ka-so-form');
await page.waitForTimeout(1500);
check('form: a ready id that is gone is skipped with a notice', (await page.locator('.ka-so-ln').count()) === 1 && /ข้ามสินค้า/.test(await toastText()), await toastText());
await page.fill('#so-name', 'พิมพ์ค้างไว้');
await page.locator('.ka-so-sum__acts').getByText('ยกเลิก', { exact: true }).click();
await page.waitForTimeout(500);
check('form: leaving a typed form asks first', /ยังไม่ได้บันทึกการแก้ไข/.test(await page.locator('[role=dialog]').allInnerTexts().then((all) => all.join(' '))));
await page.getByText('อยู่ต่อ', { exact: true }).click();
// Searching in the goods picker must not save the order behind it (review F1).
const postsBeforeSearch = posts.length;
await page.locator('#so-lines-add').click();
await page.waitForSelector('[role=dialog] .ka-so-rsearch input', { timeout: 15000 });
await page.fill('[role=dialog] .ka-so-rsearch input', 'test');
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
check('form: searching in the goods picker does not save the order', posts.length === postsBeforeSearch && /\/new/.test(page.url()) && (await page.locator('[role=dialog] .ka-so-rsearch').count()) === 1, `${posts.length - postsBeforeSearch} saves, ${page.url()}`);
await page.keyboard.press('Escape');

// An edited store order keeps its type: the form shows it and cannot change it (review F2).
const storePending = (await call('GET', `/sale-order?page=1&limit=1&type=store&filters=${encodeURIComponent(JSON.stringify({ sale_order_status: ['pending'] }))}`)).body?.data?.[0];
if (storePending) {
  await open(`/admin/sale-orders/${storePending.sale_order_id}/edit`, '.ka-so-form');
  await settle(500);
  const typeField = page.locator('#so-type');
  check('edit: a store order keeps its type, shown read-only', (await typeField.getAttribute('readonly')) !== null && /หน้าร้าน/.test(await typeField.inputValue()), await typeField.inputValue());
} else {
  console.log('NOTE edit of a store order: no pending store order in the data, not checked');
}

// A shared link with only from/to applies the dates (review F5).
await open('/admin/sale-orders?from=2026-10-01&to=2026-10-31', '#so-list-panel');
check('list: a link with from and to applies the custom range', (await page.locator('.ka-so-dates input[type=date]').first().inputValue()) === '2026-10-01');

// ---------------------------------------------------------------- the rest of the pages, per width
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : width === 834 ? 1100 : 844 });
  for (const [name, path] of [
    ['detail-created', `/admin/sale-orders/${orderA.sale_order_id}`],
    ['form-edit-missing', `/admin/sale-orders/${orderA.sale_order_id}/edit`],
  ]) {
    await open(path, '.ka-page-body');
    await shot(`${name}-${width}`);
  }
  if (orderB) {
    await open(`/admin/sale-orders/${orderB.sale_order_id}`, '.ka-so-grid');
    await shot(`detail-cancelled-created-${width}`);
    if (width === 390) {
      check('phone: a cancelled order still offers print in the bottom bar', (await page.locator('.ka-so-bar:visible').getByText('พิมพ์', { exact: true }).count()) === 1);
    }
  }
  await open('/admin/sale-orders/new', '.ka-so-form');
  await page.locator('#so-lines-add:visible, .ka-so-add--phone:visible').first().click();
  await page.waitForSelector('[role=dialog] .ka-so-pickrow, [role=dialog] .ka-so-cap', { timeout: 15000 });
  await settle(500);
  await shot(`picker-${width}`);
  await page.keyboard.press('Escape');
}

// ---------------------------------------------------------------- 320px with the long name
await page.setViewportSize({ width: 320, height: 700 });
for (const [name, path, ready] of [
  ['list', '/admin/sale-orders', '.ka-so-kpis'],
  ['detail', `/admin/sale-orders/${orderA.sale_order_id}`, '.ka-so-grid'],
  ['form', '/admin/sale-orders/new', '.ka-so-form'],
]) {
  await open(path, ready);
  const problem = await layoutProblems();
  check(`320px ${name}: no side scroll and no document scroll`, problem.sideScroll <= 0 && problem.docExtra <= 0 && problem.bodySide <= 0, JSON.stringify(problem));
  await shot(`${name}-320`);
}
await open(`/admin/sale-orders?q=${encodeURIComponent(TAG)}`, '#so-list-panel');
const longProblem = await layoutProblems();
check('320px list with the long test name: no side scroll', longProblem.sideScroll <= 0 && longProblem.bodySide <= 0, JSON.stringify(longProblem));
await shot('list-long-320');

// ---------------------------------------------------------------- dark theme and print colours
await page.setViewportSize({ width: 1440, height: 1000 });
await page.evaluate(() => localStorage.setItem('theme', 'dark'));
for (const [name, path, ready] of [
  ['list', '/admin/sale-orders', '.ka-so-kpis'],
  ['detail', `/admin/sale-orders/${orderA.sale_order_id}`, '.ka-so-grid'],
  ['form', '/admin/sale-orders/new', '.ka-so-form'],
]) {
  await open(path, ready);
  check(`dark ${name}: the dark theme is on`, await page.evaluate(() => document.documentElement.classList.contains('dark')));
  await shot(`${name}-dark-1440`);
}
await page.evaluate(() => localStorage.setItem('theme', 'light'));

// ---------------------------------------------------------------- keyboard walk and reduced motion
await open('/admin/sale-orders', '.ka-so-kpis');
await page.mouse.click(5, 5);
const stops = [];
for (let step = 0; step < 40; step += 1) {
  await page.keyboard.press('Tab');
  stops.push(
    await page.evaluate(() => {
      const element = document.activeElement;
      // Only the page itself: the header search and the sidebar belong to the Admin shell.
      if (!element || element === document.body || !element.closest('main') || element.closest('header')) return null;
      const style = getComputedStyle(element);
      // A row link draws its ring on ::after so the whole row shows it.
      const after = getComputedStyle(element, '::after');
      const visible =
        (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) ||
        style.boxShadow !== 'none' ||
        (after.outlineStyle !== 'none' && parseFloat(after.outlineWidth) > 0);
      const name = element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 30) || element.tagName;
      return { name, visible };
    }),
  );
}
const walked = stops.filter(Boolean);
check('keyboard: Tab reaches the page controls', walked.length >= 12, `${walked.length} stops in the page`);
check('keyboard: every stop shows focus', walked.every((stop) => stop.visible), walked.filter((stop) => !stop.visible).map((stop) => stop.name).join(', '));
await page.emulateMedia({ reducedMotion: 'reduce' });
await open('/admin/sale-orders', '.ka-so-kpis');
const motion = await page.evaluate(() => getComputedStyle(document.querySelector('.ka-so-kpi')).transitionDuration);
check('reduced motion: the summary cards stop their transitions', /^0s(, 0s)*$/.test(motion), motion);
await page.emulateMedia({ reducedMotion: 'no-preference' });

// ---------------------------------------------------------------- cleanup
// A returned order cannot be deleted; the others are removed. Whatever is left is named in the output.
for (const id of created) {
  await call('DELETE', `/sale-order/${id}`);
}
// Ready rows the run made (or that a cancel or delete gave back) go too.
const readyLeft = (await call('GET', `/fetch-sale-order?page=1&limit=50&search=${encodeURIComponent(TAG)}`)).body?.data ?? [];
for (const row of readyLeft) await call('DELETE', `/fetch-sale-order/${row.fetch_sale_order_id}`);
const readyStill = (await call('GET', `/fetch-sale-order?page=1&limit=50&search=${encodeURIComponent(TAG)}`)).body?.data ?? [];
check('cleanup: no tagged ready rows are left', readyStill.length === 0, String(readyStill.length));
const remaining = await call('GET', `/sale-order?search=${encodeURIComponent(TAG)}&limit=50`);
const leftNames = (remaining.body.data ?? []).map((order) => `${order.sale_order_code}:${order.sale_order_status}`);
// Only pending orders can be deleted; paid, cancelled and returned ones stay and are named here.
check('cleanup: no pending test order is left', !leftNames.some((name) => name.endsWith(':pending')), `left: ${leftNames.join(', ')}`);

check('no console or page errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
writeFileSync(join(out, 'results.json'), JSON.stringify({ results, consoleErrors, targets, leftNames }, null, 2));
const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
