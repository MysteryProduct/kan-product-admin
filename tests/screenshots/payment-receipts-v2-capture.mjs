// Payment receipts v2 (TASK-0346 V2): walks the pages against the real API on the development stack, asserts the
// Acceptance items and keeps a screenshot per item. Needs the V1 seed (orders SO2099…, receipts RE2099…, the view-only
// employee demo_view_0346) and signs in with the demo_audit password, which the API seed script sets.
//
//   OUT_DIR=<outside tests/> AUTH_STATE=<file> VIEW_STATE=<file> PROXY=1 node tests/screenshots/payment-receipts-v2-capture.mjs
//
// OUT_DIR stays outside tests/: the dev server watches that folder. Injected failures (network cut, 400, 409) go
// through page.route and prove the page's handling of that answer only; the writes they replace run for real elsewhere.
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
const API = 'http://localhost:3010';
const LIST = '/admin/payment-receipts';
const out = process.env.OUT_DIR;
if (!out) throw new Error('OUT_DIR is required, outside tests/');
mkdirSync(out, { recursive: true });
const seedFile = process.env.SEED_FILE ?? join(here, '../../../kan-product-api/scripts/seed-demo-audit-user.cjs');
const password = readFileSync(seedFile, 'utf8').match(/bcrypt\.hash\('([^']+)'/)?.[1];
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;

const results = [];
const problems = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail: String(detail).slice(0, 300) });
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — ${detail}`}`);
};
const step = async (name, run) => {
  if (only && !only.some((item) => name.startsWith(item))) return;
  try {
    await run();
  } catch (error) {
    check(`${name} finished`, false, error.message.split('\n')[0]);
  }
};

const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });

async function session(username, stateFile, options = {}) {
  const have = existsSync(stateFile);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', locale: 'th-TH', timezoneId: 'Asia/Bangkok', storageState: have ? stateFile : undefined, ...options });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base }).catch(() => {});
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/status of 4\d\d|status of 5\d\d|net::ERR|Failed to load resource|Error fetching/.test(message.text())) problems.push(`console: ${message.text().slice(0, 200)}`);
  });
  if (!have) {
    await page.goto(`${base}/login`);
    await page.waitForSelector('#username', { timeout: 120000 });
    await page.evaluate(() => localStorage.setItem('theme', 'light'));
    await page.fill('#username', username);
    await page.fill('#password', password);
    await page.click('button[type=submit]');
    await page.waitForURL(/\/admin/, { timeout: 120000, waitUntil: 'commit' });
    await context.storageState({ path: stateFile });
  }
  return { context, page };
}

const admin = await session('demo_audit', process.env.AUTH_STATE ?? join(out, 'auth.json'));
const viewer = await session('demo_view_0346', process.env.VIEW_STATE ?? join(out, 'view.json'));
const noOrders = await session('demo_noso_0346', process.env.NOSO_STATE ?? join(out, 'noso.json'));
const { page } = admin;

// A panel that just opened is still sliding in; the wait lets it settle.
const shot = async (target, name) => {
  await target.waitForTimeout(400);
  await target.screenshot({ path: join(out, `${name}.png`), fullPage: false });
};
const open = async (target, path, ready) => {
  await target.goto(`${base}${path}`, { waitUntil: 'commit' });
  if (ready) await target.waitForSelector(ready, { timeout: 60000 });
  await target.waitForLoadState('networkidle').catch(() => {});
};
const api = async (target, path) => {
  const cookies = await target.context().cookies(base);
  const token = decodeURIComponent(cookies.find((cookie) => cookie.name === 'token')?.value ?? '');
  const response = await target.context().request.get(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: response.status(), body: await response.json().catch(() => null) };
};
const widths = async (fn) => {
  for (const [width, height] of [[1440, 1000], [834, 1112], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await fn(width);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
};

await open(page, LIST, '.ka-pr-stats');
const byCode = {};
// A refund made in the Admin; one that came through the Store reads as the Store's.
const REFUND = (await api(page, "/payment-receipts?tab=refund&limit=50")).body.data.find((row) => !row.gateway_reference).payment_receipt_code;
for (const code of ['RE209911030001', 'RE209911030002', 'RE209911030003', 'RE209911030004', 'RE209911030005', 'RE209911030006', 'RE209911030007', 'RE209911030008', 'RE209911030009', 'RE209911030011', 'RE209911030012', 'RE202611030001', 'RE202610270825', REFUND]) {
  const found = await api(page, `/payment-receipts?search=${code}&limit=5`);
  byCode[code] = found.body?.data?.find((row) => row.payment_receipt_code === code);
}
const orders = {};
for (const code of ['SO209911030001', 'SO209911030002', 'SO209911030004', 'SO209911030006', 'SO209911030009', 'SO209911030010']) {
  const found = await api(page, `/sale-order?search=${code}&limit=5`);
  orders[code] = found.body?.data?.find((row) => row.sale_order_code === code);
}
const receiptUrl = (code) => `${LIST}/${byCode[code].payment_receipt_id}`;
check('seed: every receipt and order the run needs exists', Object.values(byCode).every(Boolean) && Object.values(orders).every(Boolean), JSON.stringify(Object.entries(byCode).filter(([, value]) => !value).map(([key]) => key)));

await step('A1 routes', async () => {
  await widths(async (width) => {
    await open(page, LIST, '.ka-pr-stats');
    await shot(page, `A1-list-${width}`);
  });
  await open(page, `${LIST}/new`, '#ka-pr-amt');
  check('A1 /new opens and survives a reload', await page.locator('h1', { hasText: 'สร้างใบเสร็จรับเงิน' }).isVisible());
  await open(page, receiptUrl('RE209911030001'), '.ka-pr-hero');
  await page.reload({ waitUntil: 'commit' });
  await page.waitForSelector('.ka-pr-hero');
  check('A1 /[id] survives a reload', await page.locator('.ka-pr-hero').isVisible());
  await open(page, `/admin/sale-orders/${orders.SO209911030001.sale_order_id}`);
  await page.getByRole('button', { name: 'รับชำระ', exact: true }).first().click();
  await page.waitForURL(/payment-receipts\/new\?sale_order=/);
  await page.waitForSelector('.ka-pr-sosum');
  check('A1 pay on an approved order opens /new with the order chosen', (await page.locator('.ka-pr-sosum').textContent()).includes('SO209911030001'));
  await open(page, `/admin/sale-orders/${byCode.RE209911030001.sale_order_id}`, '.ka-so-rcp');
  await page.locator('.ka-so-rcp a').first().click();
  await page.waitForURL(/payment-receipts\/[0-9a-f-]{36}/);
  check('A1 a receipt row of an order opens /[id]', true);
  await open(page, `${LIST}?search=RE209911030001`, '.ka-pr-lt tbody tr');
  check('A1 ?search= still filters', (await page.locator('.ka-pr-lt tbody tr').count()) === 1);
  const { page: view } = viewer;
  await open(view, `${LIST}/new`, '[role=note]');
  check('A1 view-only: /new shows no form', (await view.locator('#ka-pr-amt').count()) === 0);
  await open(view, `${receiptUrl('RE209911030001')}/edit`, '[role=note]');
  check('A1 view-only: /edit shows no form', (await view.locator('#ka-pr-amt').count()) === 0);
  await shot(view, 'A1-no-permission-1440');
});

await step('A2 stats', async () => {
  await open(page, LIST, '.ka-pr-stat');
  const orderSummary = (await api(page, '/sale-order/summary')).body;
  const summary = (await api(page, '/payment-receipts/summary')).body;
  const text = await page.locator('.ka-pr-stats').textContent();
  const money = (value) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  check('A2 four numbers match the API', [money(orderSummary.received_this_month), money(orderSummary.outstanding_total), `${summary.month.receipt_count} ใบ`, money(summary.month.refund_total)].every((item) => text.includes(item)), text);
  const stub = async (body) => {
    await page.route('**/sale-order/summary', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true' }, body: JSON.stringify({ ...orderSummary, ...body }) }));
    await open(page, LIST, '.ka-pr-stat');
    await page.waitForTimeout(400);
    const line = await page.locator('.ka-pr-stat').first().textContent();
    await page.unroute('**/sale-order/summary');
    return line;
  };
  check('A2 no percent when last month is 0', !/%/.test(await stub({ received_this_month: 500, received_last_month: 0 })));
  const down = await stub({ received_this_month: 500, received_last_month: 1000 });
  check('A2 a fall shows ▼', /▼ 50%/.test(down), down);
  check('A2 null received shows —', /—/.test(await stub({ received_this_month: null, received_last_month: null })));
  await open(noOrders.page, LIST, '.ka-pr-stat');
  await noOrders.page.waitForTimeout(600);
  check('G6 no sale_orders:view: no queue', (await noOrders.page.locator('#ka-pr-queue-title').count()) === 0);
  check('G6 no sale_orders:view: outstanding reads —', (await noOrders.page.locator('.ka-pr-stat').nth(1).textContent()).includes('—'));
  await shot(noOrders.page, 'G6-no-orders-1440');
});

await step('A3 queue', async () => {
  await open(page, LIST, '.ka-pr-qc');
  const codes = async () => page.locator('.ka-pr-qc .ka-pr-code').allTextContents();
  await page.getByRole('button', { name: 'ดูทั้งหมด' }).click();
  await page.waitForURL(/queue=all/);
  check('A3 ดูทั้งหมด puts queue=all in the URL', true);
  await page.waitForTimeout(500);
  const all = await codes();
  check('A3 approved and partial are in the queue', all.includes('SO209911030001') && all.includes('SO209911030002'), all.join(','));
  check('A3 cancelled, pending and paid are not', !all.includes('SO209911030006') && !all.includes('SO209911030004') && !all.includes('SO209911030010') && !all.includes('SO209911030003'), all.join(','));
  const card = page.locator('.ka-pr-qc', { hasText: 'SO209911030002' });
  check('A3 the card owes ฿25,200.00', (await card.textContent()).includes('25,200.00'), await card.textContent());
  const custom = page.locator('.ka-pr-qc', { hasText: 'SO202610240004' });
  if (await custom.count()) {
    const href = await custom.locator('a').getAttribute('href');
    check('A3 a custom card goes to the sale order', href.startsWith('/admin/sale-orders/'), href);
  } else check('A3 a custom card goes to the sale order', false, 'no custom order on this page of the queue');
  await shot(page, 'A3-queue-1440');
  await page.getByRole('button', { name: 'ย่อรายการ' }).click();
  await page.waitForFunction(() => !location.search.includes('queue=all'));
  check('A3 ย่อรายการ takes it back to three', (await codes()).length === 3);
});

await step('A4 table', async () => {
  await open(page, LIST, '.ka-pr-lt tbody tr');
  await page.fill('.ka-pr-fs input', 'RE209911030003');
  await page.waitForFunction(() => location.search.includes('q=RE209911030003'));
  await page.waitForFunction(() => document.querySelectorAll('.ka-pr-lt tbody tr').length === 1);
  const row = page.locator('.ka-pr-lt tbody tr').first();
  check('A4 a receipt of a cancelled order stays in the table', (await row.textContent()).includes('SO209911030004'));
  check('A4 the match is tinted', (await row.locator('mark').count()) > 0);
  await page.fill('.ka-pr-fs input', 'SO209911030005');
  await page.waitForFunction(() => document.querySelectorAll('.ka-pr-lt tbody tr').length === 2);
  check('A4 search by SO finds both receipts', true);
  const named = (await api(page, '/payment-receipts?limit=100')).body.data.find((row) => row.saleOrder?.customer_name);
  await page.fill('.ka-pr-fs input', named.saleOrder.customer_name);
  await page.waitForFunction((code) => document.querySelector('.ka-pr-lt tbody')?.textContent.includes(code), named.payment_receipt_code);
  check('A4 search by customer finds the receipt', (await page.locator('.ka-pr-lt tbody mark').count()) > 0);
  await shot(page, 'A4-search-1440');
  await page.locator('.ka-pr-lt tbody .ka-pr-sochip').first().click();
  await page.waitForURL(/sale-orders\//);
  check('A4 the chip opens the order, not the row', true);
  await page.goBack({ waitUntil: 'commit' });
  await page.waitForSelector('.ka-pr-lt tbody tr');
  await page.locator('.ka-pr-lt tbody tr td').nth(3).click();
  await page.waitForURL(/payment-receipts\/[0-9a-f-]{36}/);
  check('A4 a click on the row opens the receipt', true);
});

await step('A5 methods', async () => {
  const cases = [
    ['RE209911030001', 'โอนผ่านธนาคาร', 'วางมัดจำ'],
    ['RE209911030003', 'เงินสด', 'ชำระบางส่วน'],
    ['RE202610270825', 'หน้าร้านออนไลน์', 'ชำระเต็มจำนวน'],
    [REFUND, 'คืนเงิน', 'คืนเงิน'],
  ];
  for (const [code, main, type] of cases) {
    await open(page, `${LIST}?q=${code}`, '.ka-pr-lt tbody tr');
    const text = await page.locator('.ka-pr-lt tbody tr').first().textContent();
    check(`A5 ${code} reads ${main} / ${type}`, text.includes(main) && text.includes(type) && !/undefined|online_gateway|promptpay\b/.test(text), text);
  }
  await open(page, `${LIST}?q=RE202610270825`, '.ka-pr-lt tbody tr');
  await shot(page, 'A5-store-1440');
});

await step('A6 menus', async () => {
  const items = async (target) => target.locator('.ka-menu__item:visible').allTextContents();
  const menu = async (target, code) => {
    await open(target, `${LIST}?q=${code}`, '.ka-pr-lt tbody tr');
    await target.getByRole('button', { name: `ตัวเลือกของ ${code}` }).click();
    await target.waitForSelector('.ka-menu__item');
    return target;
  };
  await menu(page, 'RE209911030001');
  check('A6 regular: view, edit, print, order, delete', (await items(page)).join('|') === 'ดูรายละเอียด|แก้ไข|พิมพ์ / PDF|ไปที่ใบสั่งขาย|ลบใบเสร็จ', (await items(page)).join('|'));
  await shot(page, 'A6-menu-1440');
  await page.waitForTimeout(400);
  const width = await page.locator('.ka-popover').evaluate((node) => node.getBoundingClientRect().width);
  check('A6 the menu is 260 wide', Math.round(width) === 260, width);
  const height = await page.locator('.ka-menu__item').first().evaluate((node) => node.getBoundingClientRect().height);
  check('A6 an item is 40 high', Math.round(height) === 40, height);
  await page.keyboard.press('ArrowDown');
  check('A6 ArrowDown moves', (await page.evaluate(() => document.activeElement?.textContent)).includes('แก้ไข'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check('A6 Esc returns focus to ⋯', (await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '')).startsWith('ตัวเลือกของ'));
  await menu(page, 'RE209911030002');
  await page.getByRole('menuitem', { name: 'พิมพ์ / PDF' }).click();
  await page.waitForURL(/print=1/);
  check('A6 พิมพ์ / PDF opens /[id]?print=1', true);
  await menu(page, 'RE209911030003');
  check('A6 order not open: no edit', !(await items(page)).includes('แก้ไข') && (await items(page)).includes('ลบใบเสร็จ'), (await items(page)).join('|'));
  await menu(page, REFUND);
  await shot(page, 'A6-menu-refund-1440');
  check('A6 refund: no edit or delete, with the note', !(await items(page)).some((text) => /แก้ไข$|ลบใบเสร็จ/.test(text)) && (await page.locator('.ka-menu__note').textContent()).includes('ใบคืนเงิน'));
  await menu(page, 'RE202611030001');
  check('A6 custom: no edit or delete, with the note', !(await items(page)).includes('ลบใบเสร็จ') && (await page.locator('.ka-menu__note').textContent()).includes('Custom'));
  await menu(page, 'RE202610270825');
  check('A6 store: the Q5 note', (await page.locator('.ka-menu__note').textContent()).includes('ใบจากหน้าร้านออนไลน์ดูและพิมพ์ได้เท่านั้น'));
  await menu(viewer.page, 'RE209911030001');
  check('A6 view-only: no edit or delete', (await items(viewer.page)).join('|') === 'ดูรายละเอียด|พิมพ์ / PDF|ไปที่ใบสั่งขาย', (await items(viewer.page)).join('|'));
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, `${LIST}?q=RE209911030001`, '.ka-pr-mc');
  await page.getByRole('button', { name: 'ตัวเลือกของ RE209911030001' }).locator('visible=true').first().click();
  await page.waitForSelector('.ka-pr-bsi');
  check('A6 at 390 a sheet with the receipt on top', (await page.locator('.ka-modal__title').textContent()).includes('RE209911030001'));
  await shot(page, 'A6-sheet-390');
  await page.getByRole('button', { name: 'ปิด', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
});

await step('A7 filters', async () => {
  await open(page, LIST, '.ka-pr-lt tbody tr');
  await page.getByRole('button', { name: 'วิธีชำระ' }).click();
  await page.waitForTimeout(400);
  const popWidth = await page.locator('.ka-popover').evaluate((node) => node.getBoundingClientRect().width);
  check('A7 the popover is 320 wide', Math.round(popWidth) === 320, popWidth);
  await shot(page, 'A7-popover-1440');
  await page.getByLabel('โอนผ่านธนาคาร').check();
  await page.getByRole('button', { name: 'ใช้ตัวกรอง' }).click();
  await page.waitForFunction(() => location.search.includes('method=bank'));
  await page.getByRole('button', { name: 'ช่วงวันที่' }).click();
  await page.getByRole('button', { name: 'เดือนนี้' }).click();
  await page.getByRole('button', { name: 'ใช้ตัวกรอง' }).click();
  await page.waitForFunction(() => location.search.includes('from='));
  await page.locator('.ka-pr-chip--sq').click();
  await shot(page, 'A7-sort-1440');
  await page.getByRole('menuitem', { name: 'ยอดมากไปน้อย' }).click();
  await page.waitForFunction(() => location.search.includes('sort=amount_desc'));
  await page.waitForTimeout(800);
  const rows = await page.locator('.ka-pr-lt tbody tr').allTextContents();
  check('A7 only bank rows', rows.length > 0 && rows.every((text) => text.includes('โอนผ่านธนาคาร')), rows.length);
  check('A7 the chips name the filters', (await page.locator('.ka-pr-chipon').allTextContents()).join().includes('วิธีชำระ: โอนผ่านธนาคาร'));
  await shot(page, 'A7-filtered-1440');
  const url = page.url();
  await page.reload({ waitUntil: 'commit' });
  await page.waitForSelector('.ka-pr-chipon');
  check('A7 a reload keeps the view', page.url() === url && (await page.locator('.ka-pr-chipon').count()) === 2);
  await page.goBack({ waitUntil: 'commit' });
  await page.waitForFunction(() => !location.search.includes('sort='));
  check('A7 back restores the step before', true);
  await page.getByRole('button', { name: 'เอาตัวกรองวิธีชำระออก' }).click();
  await page.waitForFunction(() => !location.search.includes('method='));
  check('A7 × removes one filter', (await page.locator('.ka-pr-chipon').count()) === 1);
  await open(page, LIST, '.ka-pr-lt tbody tr');
  await page.getByRole('button', { name: 'ประเภท' }).click();
  await shot(page, 'A7-type-1440');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'ช่วงวันที่' }).click();
  await shot(page, 'A7-date-1440');
  const head = page.locator('.ka-pr-cal__head span');
  const before = await head.textContent();
  check('A7 the calendar counts Buddhist years', /25\d\d/.test(before), before);
  await page.locator('.ka-pr-cal__day:not([data-out])').nth(19).click();
  await page.getByRole('button', { name: 'เดือนก่อน', exact: true }).last().click();
  check('A7 the calendar moves a month', (await head.textContent()) !== before);
  await page.locator('.ka-pr-cal__day:not([data-out])').nth(4).click();
  await page.getByRole('button', { name: 'ใช้ตัวกรอง' }).click();
  await page.waitForFunction(() => location.search.includes('from='));
  const search = new URL(page.url()).searchParams;
  check('A7 a backwards range is put in order', search.get('from') < search.get('to'), `${search.get('from')} ${search.get('to')}`);
});

await step('A8 filter sheet', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, LIST, '.ka-pr-mc');
  await page.getByRole('button', { name: 'วิธีชำระ' }).click();
  await page.waitForSelector('.ka-pr-filter');
  await page.waitForTimeout(600);
  const button = page.locator('.ka-pr-filter .ka-pr-btn--a');
  const before = await button.textContent();
  await page.locator('.ka-pr-filter').getByLabel('เงินสด').check();
  await page.waitForFunction((text) => document.querySelector('.ka-pr-filter .ka-pr-btn--a')?.textContent !== text, before);
  check('A8 the button counts before it is pressed', true, `${before} → ${await button.textContent()}`);
  check('A8 the URL has not changed yet', !page.url().includes('method='));
  await shot(page, 'A8-sheet-390');
  await button.click();
  await page.waitForFunction(() => location.search.includes('method=cash'));
  check('A8 the button applies', true);
  await page.setViewportSize({ width: 1440, height: 1000 });
});

await step('A9 picker', async () => {
  const posts = [];
  const watch = (request) => {
    if (request.method() === 'POST' && request.url().includes('/payment-receipts')) posts.push(request.url());
  };
  page.on('request', watch);
  await open(page, `${LIST}/new`, '#ka-pr-so');
  await page.locator('#ka-pr-so').click();
  await page.waitForTimeout(300);
  const options = await page.locator('[role=option]').allTextContents();
  check('A9 no cancelled or custom order offered', !options.some((text) => /SO209911030006|SO209911030004|SO202610240004/.test(text)), options.length);
  await page.keyboard.press('Escape');
  for (const [name, id, words] of [
    ['cancelled', orders.SO209911030006.sale_order_id, 'ถูกยกเลิกแล้ว'],
    ['pending', orders.SO209911030010.sale_order_id, 'ไม่อยู่ในสถานะที่รับชำระได้'],
    ['missing', '00000000-0000-4000-8000-000000000000', 'ใบสั่งขายนี้รับชำระไม่ได้'],
  ]) {
    await open(page, `${LIST}/new?sale_order=${id}`, '.ka-pr-banner');
    const text = await page.locator('.ka-pr-banner').textContent();
    check(`A9 ${name} link says why`, text.includes(words), text);
    check(`A9 ${name} link leaves the picker empty`, (await page.locator('.ka-pr-sosum').count()) === 0);
    if (name === 'cancelled') await shot(page, 'A9-cancelled-1440');
  }
  const custom = (await api(page, '/sale-order?search=SO202610240004&limit=5')).body?.data?.[0];
  await open(page, `${LIST}/new?sale_order=${custom.sale_order_id}`, '.ka-pr-banner');
  check('A9 custom link points to the order', (await page.locator('.ka-pr-banner').textContent()).includes('รับชำระที่ใบสั่งขาย Custom'));
  check('A9 no POST went out', posts.length === 0, posts.length);
  page.off('request', watch);
});

await step('A10 form rules', async () => {
  const id = orders.SO209911030009.sale_order_id;
  await open(page, `${LIST}/new?sale_order=${id}`, '.ka-pr-sosum');
  await page.waitForFunction(() => document.querySelector('#ka-pr-amt')?.value);
  check('A10 the amount starts at what is owed', (await page.inputValue('#ka-pr-amt')) === '1000');
  const preview = () => page.locator('.ka-pr-prev').textContent();
  check('A10 exact amount reads success', (await preview()).includes('ชำระครบแล้ว'));
  await page.fill('#ka-pr-amt', '1000.01');
  check('A10 0.01 over is an error', (await page.locator('.ka-pr-ferr').first().textContent()).includes('เกินยอดค้างชำระ ฿0.01'));
  check('A10 and it cannot be saved', await page.locator('.ka-pr-fsave .ka-pr-btn--a').isDisabled());
  await shot(page, 'A10-over-1440');
  await page.fill('#ka-pr-amt', '1.234');
  check('A10 three decimals are refused', (await page.locator('.ka-pr-ferr').first().textContent()).includes('ทศนิยม'));
  await page.fill('#ka-pr-amt', '1e3');
  check('A10 1e3 is refused, not read as 13', (await page.locator('.ka-pr-ferr').first().textContent()).includes('ตัวเลข'));
  await page.fill('#ka-pr-amt', '0');
  await page.locator('.ka-pr-fsave .ka-pr-btn--a').click();
  check('A10 zero is refused', (await page.locator('.ka-pr-ferr').first().textContent()).includes('ยอดรับชำระต้องมากกว่า 0'));
  await page.fill('#ka-pr-amt', '400');
  await page.locator('.ka-pr-fsave .ka-pr-btn--a').click({ force: true }).catch(() => {});
  check('A10 bank with no account shows the error', (await page.locator('#ka-pr-acc-e').textContent()).includes('เลือกบัญชีที่รับเงิน'));
  const meter = await page.locator('.ka-pr-aside .ka-pr-meter i').evaluateAll((nodes) => nodes.map((node) => node.style.width));
  check('A10 the meter parts match the amount', meter[0] === '0%' && meter[1] === '40%', meter.join());
  await page.getByRole('radio', { name: /ชำระเต็มจำนวน/ }).click();
  check('A10 full locks the amount', (await page.getAttribute('#ka-pr-amt', 'readonly')) !== null && (await page.inputValue('#ka-pr-amt')).includes('1,000'));
  await page.getByRole('radio', { name: /ชำระบางส่วน/ }).click();
  await page.locator('#ka-pr-so').click();
  await page.locator('[role=option]', { hasText: 'SO209911030001' }).click();
  await page.waitForTimeout(200);
  check('A10 another order changes amount and summary', (await page.inputValue('#ka-pr-amt')) === '18400' && (await page.locator('.ka-pr-aside').textContent()).includes('18,400.00'));
  await page.getByRole('radio', { name: /เงินสด/ }).click();
  check('A10 cash hides the account', (await page.locator('#ka-pr-acc').count()) === 0);
  await shot(page, 'A10-form-1440');
});

await step('A11 A12 save', async () => {
  const bodies = [];
  const watch = (request) => {
    if (['POST', 'PATCH'].includes(request.method()) && /payment-receipts/.test(request.url()) && request.postData()) bodies.push({ method: request.method(), body: JSON.parse(request.postData()) });
  };
  page.on('request', watch);
  const id = orders.SO209911030001.sale_order_id;
  await open(page, `${LIST}/new?sale_order=${id}`, '.ka-pr-sosum');
  await page.waitForFunction(() => document.querySelector('#ka-pr-amt')?.value);
  await page.fill('#ka-pr-amt', '100');
  await page.getByRole('radio', { name: /เงินสด/ }).click();
  await page.route('**/payment-receipts', async (route) => (route.request().method() === 'POST' ? route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true' }, body: JSON.stringify({ message: 'ยอดรับชำระเกินยอดคงค้าง' }) }) : route.fallback()));
  await page.locator('.ka-pr-fsave .ka-pr-btn--a').click();
  await page.waitForSelector('.ka-pr-banner[data-tone=danger]');
  check('A12 a 400 shows the banner and keeps the input', (await page.inputValue('#ka-pr-amt')) === '100' && (await page.locator('.ka-pr-banner').textContent()).includes('ยอดรับชำระเกินยอดคงค้าง'));
  await shot(page, 'A12-400-1440');
  await page.unroute('**/payment-receipts');
  await page.route('**/payment-receipts', (route) => (route.request().method() === 'POST' ? route.abort() : route.fallback()));
  await page.locator('.ka-pr-fsave .ka-pr-btn--a').click();
  await page.waitForTimeout(500);
  check('A12 a cut network shows the banner', await page.locator('.ka-pr-banner[data-tone=danger]').isVisible());
  await page.unroute('**/payment-receipts');
  bodies.length = 0;
  await page.route('**/payment-receipts', async (route) => {
    if (route.request().method() === 'POST') await new Promise((done) => setTimeout(done, 900));
    await route.fallback();
  });
  const save = page.locator('.ka-pr-fsave .ka-pr-btn--a');
  await save.evaluate((node) => { node.click(); node.click(); node.click(); });
  await page.waitForTimeout(200);
  check('A12 the button says it is saving', (await save.getAttribute('aria-busy')) === 'true' && (await save.textContent()).includes('กำลังบันทึก'));
  await shot(page, 'A12-saving-1440');
  await page.waitForSelector('.ka-pr-res');
  await page.unroute('**/payment-receipts');
  check('A12 three clicks, one POST', bodies.filter((item) => item.method === 'POST').length === 1, bodies.length);
  await page.waitForTimeout(400);
  const width = await page.locator('.ka-pr-res').evaluate((node) => node.getBoundingClientRect().width);
  check('A12 the result is 300 wide', Math.round(width) === 300, width);
  check('A12 the result names a real RE', /RE\d{12}/.test(await page.locator('.ka-pr-res').textContent()));
  await shot(page, 'A12-result-1440');
  const keys = 'account_id,amount_paid,create_by,payment_date,payment_method,payment_receipt_remark,payment_receipt_type,payment_status,sale_order_id';
  const cash = bodies[0].body;
  check('A11 cash POST: old keys, no account_id', Object.keys(cash).sort().join() === keys.replace('account_id,', '') && cash.payment_status === 'paid' && cash.amount_paid === 100, Object.keys(cash).sort().join());
  await page.getByRole('button', { name: 'ดูใบเสร็จ' }).click();
  await page.waitForURL(/payment-receipts\/[0-9a-f-]{36}/);
  check('A12 ดูใบเสร็จ opens /[id]', true);

  await open(page, `${LIST}/new?sale_order=${id}`, '.ka-pr-sosum');
  await page.waitForFunction(() => document.querySelector('#ka-pr-amt')?.value);
  await page.fill('#ka-pr-amt', '200.50');
  await page.locator('#ka-pr-acc').click();
  await page.locator('[role=option]').first().click();
  await page.getByRole('radio', { name: /วางมัดจำ/ }).click();
  await page.fill('#ka-pr-rm', 'ทดสอบ');
  bodies.length = 0;
  await page.locator('.ka-pr-fsave .ka-pr-btn--a').click();
  await page.waitForSelector('.ka-pr-res');
  const bank = bodies[0].body;
  check('A11 bank POST: old keys and values', Object.keys(bank).sort().join() === keys && bank.amount_paid === 200.5 && bank.payment_receipt_type === 'deposit' && bank.payment_receipt_remark === 'ทดสอบ', JSON.stringify(bank));
  await page.getByRole('button', { name: 'ดูใบเสร็จ' }).click();
  await page.waitForURL(/payment-receipts\/[0-9a-f-]{36}/);

  await open(page, `${receiptUrl('RE209911030007')}/edit`, '.ka-pr-sosum');
  await page.waitForFunction(() => document.querySelector('#ka-pr-amt')?.value);
  await page.fill('#ka-pr-amt', '10900');
  bodies.length = 0;
  await page.locator('.ka-pr-fsave .ka-pr-btn--a').click();
  await page.waitForSelector('.ka-pr-res');
  const patch = bodies[0];
  check('A11 PATCH: old keys, no sale_order_id', patch.method === 'PATCH' && Object.keys(patch.body).sort().join() === 'account_id,amount_paid,payment_date,payment_method,payment_receipt_code,payment_receipt_id,payment_receipt_remark,payment_receipt_type,payment_status,update_by', Object.keys(patch.body).sort().join());
  writeFileSync(join(out, 'A11-bodies.json'), JSON.stringify({ cash, bank, patch: patch.body }, null, 2));
  await page.getByRole('button', { name: 'ดูใบเสร็จ' }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/edit'));
  page.off('request', watch);
});

await step('A13 edit limits', async () => {
  await widths(async (width) => {
    await open(page, `${receiptUrl('RE209911030001')}/edit`, '.ka-pr-sosum');
    await page.waitForFunction(() => document.querySelector('#ka-pr-amt')?.value);
    await page.fill('#ka-pr-amt', '38,000');
    await page.waitForTimeout(150);
    const error = await page.locator('.ka-pr-ferr').first().textContent();
    check(`A13 ${width} over reads as the sheet`, error.includes('เกินยอดที่รับได้ ฿2,000.00') && error.includes('สูงสุด ฿36,000.00') && error.includes('รวมยอดเดิม ฿10,800.00'), error);
    await shot(page, `A13-over-${width}`);
    if (width === 390) check('A13 390 savebar reads the same', (await page.locator('.ka-pr-savebar').textContent()).includes('แก้ 1 ช่องก่อนบันทึก'), await page.locator('.ka-pr-savebar').textContent());
    await page.fill('#ka-pr-amt', '10800');
  });
  await open(page, `${receiptUrl('RE209911030001')}/edit`, '.ka-pr-sosum');
  await page.waitForFunction(() => document.querySelector('#ka-pr-amt')?.value);
  await page.getByRole('button', { name: 'ใส่ยอดสูงสุด' }).click();
  check('A13 ใส่ยอดสูงสุด gives ฿36,000', (await page.inputValue('#ka-pr-amt')) === '36000');
  await page.locator('.ka-pr-fsave .ka-pr-btn--a').click();
  await page.waitForSelector('.ka-pr-res');
  const saved = await api(page, `/payment-receipts/${byCode.RE209911030001.payment_receipt_id}`);
  check('A13 the exact maximum saves', Number((saved.body.data ?? saved.body).amount_paid) === 36000, JSON.stringify(saved.body).slice(0, 120));
  await page.getByRole('button', { name: 'ดูใบเสร็จ' }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/edit'));
});

await step('A14 leaving', async () => {
  const edit = `${receiptUrl('RE209911030002')}/edit`;
  await open(page, edit, '.ka-pr-sosum');
  await page.waitForFunction(() => document.querySelector('#ka-pr-amt')?.value);
  await page.locator('.ka-pr-fsave .ka-pr-btn', { hasText: 'ยกเลิก' }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/edit'));
  check('A14 unchanged: cancel does not ask', true);
  await open(page, edit, '.ka-pr-sosum');
  await page.waitForFunction(() => document.querySelector('#ka-pr-amt')?.value);
  await page.fill('#ka-pr-rm', 'แก้แล้ว');
  check('A14 the dirty tag shows', await page.locator('.ka-pr-chg').isVisible());
  await page.locator('.ka-pr-fsave .ka-pr-btn', { hasText: 'ยกเลิก' }).click();
  await page.getByRole('dialog', { name: 'ออกจากหน้านี้?' }).waitFor();
  check('A14 cancel asks', true);
  await shot(page, 'A14-leave-1440');
  await page.getByRole('button', { name: 'แก้ไขต่อ' }).click();
  await page.goBack({ waitUntil: 'commit' }).catch(() => {});
  await page.getByRole('dialog', { name: 'ออกจากหน้านี้?' }).waitFor();
  check('A14 back asks', true);
  await page.getByRole('button', { name: 'แก้ไขต่อ' }).click();
  const prompted = await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  check('A14 closing the tab asks (beforeunload is prevented)', prompted);
  await page.getByRole('button', { name: 'แก้ไขต่อ' }).waitFor({ state: 'detached' }).catch(() => {});
  await page.locator('.ka-pr-fsave .ka-pr-btn', { hasText: 'ยกเลิก' }).click();
  await page.getByRole('button', { name: 'ทิ้งการแก้ไข' }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/edit'));
  for (const [name, code] of [['refund', REFUND], ['custom', 'RE202611030001'], ['store', 'RE202610270825'], ['cancelled order', 'RE209911030003']]) {
    await open(page, `${receiptUrl(code)}/edit`, '[role=note]');
    check(`A14 ${name}: /edit shows no form`, (await page.locator('#ka-pr-amt').count()) === 0);
  }
  await shot(page, 'A14-locked-1440');
});

await step('A15 detail', async () => {
  await widths(async (width) => {
    await open(page, receiptUrl('RE209911030006'), '.ka-pr-hero');
    await page.waitForTimeout(500);
    await shot(page, `A15-detail-${width}`);
  });
  await open(page, receiptUrl('RE209911030006'), '.ka-pr-hero');
  const dl = await page.locator('.ka-pr-dl').textContent();
  check('A15 deposit share', dl.includes('วางมัดจำ 30%'), dl);
  check('A15 eight fields', (await page.locator('.ka-pr-dl dt').count()) === 8);
  check('A15 the remaining button shows', await page.getByRole('link', { name: 'รับชำระส่วนที่เหลือ' }).isVisible());
  await open(page, receiptUrl('RE209911030005'), '.ka-pr-hero');
  await page.waitForFunction(() => document.querySelectorAll('.ka-pr-pay').length >= 3);
  check('A15 both receipts listed, the current one bold', (await page.locator('.ka-pr-pay[data-current]').count()) === 1 && (await page.locator('.ka-pr-pay a').count()) === 1);
  await open(page, receiptUrl('RE209911030002'), '.ka-pr-hero');
  check('A15 paid order: no remaining button', (await page.getByRole('link', { name: 'รับชำระส่วนที่เหลือ' }).count()) === 0);
  await open(viewer.page, receiptUrl('RE209911030006'), '.ka-pr-hero');
  check('A15 view-only: no remaining button', (await viewer.page.getByRole('link', { name: 'รับชำระส่วนที่เหลือ' }).count()) === 0);
  await page.getByRole('button', { name: 'ดูประวัติทั้งหมด' }).click();
  await page.getByRole('dialog', { name: 'ประวัติการเปลี่ยนแปลง' }).waitFor();
  check('A15 the full history opens', true);
  await page.keyboard.press('Escape');
});

await step('A16 variants', async () => {
  await open(page, receiptUrl(REFUND), '.ka-pr-hero');
  check('A16 refund block', (await page.locator('h1').textContent()).startsWith('ใบคืนเงิน') && (await page.locator('.ka-pr-hero').textContent()).includes('คืนเงินให้ลูกค้าแล้ว') && (await page.getByRole('link', { name: 'แก้ไข' }).count()) === 0);
  await shot(page, 'A16-refund-1440');
  await open(page, receiptUrl('RE202610270825'), '.ka-pr-hero');
  const ref = byCode.RE202610270825.gateway_reference;
  await page.getByRole('button', { name: 'คัดลอกเลขอ้างอิง' }).click();
  await page.getByText('คัดลอกแล้ว').waitFor();
  check('A16 copy puts the whole reference on the clipboard', (await page.evaluate(() => navigator.clipboard.readText())) === ref);
  check('A16 store block', (await page.locator('.ka-pr-hero').textContent()).includes('ลูกค้าชำระผ่านหน้าร้าน') && (await page.locator('.ka-pr-dl').textContent()).includes('ระบบหน้าร้าน'));
  await page.getByRole('button', { name: 'ตัวเลือกเพิ่มเติม' }).click();
  check('A16 store menu: order only', (await page.locator('.ka-menu__item:visible').allTextContents()).join() === 'ไปที่ใบสั่งขาย');
  await page.keyboard.press('Escape');
  await shot(page, 'A16-store-1440');
  await open(page, receiptUrl('RE202611030001'), '.ka-pr-hero');
  check('A16 custom block', (await page.getByRole('link', { name: 'เปิดใบสั่งขาย Custom' }).count()) === 1 && (await page.locator('.ka-pr-note').textContent()).includes('Custom'));
  await shot(page, 'A16-custom-1440');
  await open(page, receiptUrl('RE209911030003'), '.ka-pr-hero');
  const aside = await page.locator('.ka-pr-aside').textContent();
  check('A16 cancelled order block', aside.includes('ใบสั่งขายถูกยกเลิกแล้ว รับชำระเพิ่มไม่ได้') && !aside.includes('รับชำระส่วนที่เหลือ'), aside);
  await shot(page, 'A16-cancelled-1440');
});

await step('A17 delete', async () => {
  const deletes = [];
  const watch = (request) => {
    if (request.method() === 'DELETE') deletes.push(request.url());
  };
  page.on('request', watch);
  await open(page, `${LIST}?q=RE209911030006`, '.ka-pr-lt tbody tr');
  const openDelete = async () => {
    await page.getByRole('button', { name: 'ตัวเลือกของ RE209911030006' }).click();
    await page.getByRole('menuitem', { name: 'ลบใบเสร็จ' }).click();
    await page.waitForSelector('.ka-pr-dlg');
  };
  await openDelete();
  await page.waitForTimeout(400);
  const width = await page.locator('.ka-pr-dlg').evaluate((node) => node.getBoundingClientRect().width);
  check('A17 the dialog is 480 wide', Math.round(width) === 480, width);
  const facts = await page.locator('.ka-pr-facts').textContent();
  check('A17 facts read ฿10,800 and ฿0 of ฿36,000', facts.includes('10,800.00') && facts.includes('฿0.00') && facts.includes('36,000.00'), facts);
  await shot(page, 'A17-dialog-1440');
  await page.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  await page.waitForTimeout(200);
  check('A17 cancel sends no DELETE', deletes.length === 0);
  await page.route('**/payment-receipts/*', (route) => (route.request().method() === 'DELETE' ? route.fulfill({ status: 409, contentType: 'application/json', headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true' }, body: JSON.stringify({ message: 'ไม่สามารถแก้ไขหรือลบใบเสร็จที่ผูกกับคำขอ Custom ได้' }) }) : route.fallback()));
  await openDelete();
  await page.getByRole('button', { name: 'ลบใบเสร็จ' }).last().click();
  await page.waitForSelector('.ka-pr-res');
  check('A17 a 409 shows the error result', (await page.locator('.ka-pr-res').textContent()).includes('ลบไม่สำเร็จ'));
  await shot(page, 'A17-error-1440');
  await page.getByRole('button', { name: 'ปิด', exact: true }).first().click();
  await page.unroute('**/payment-receipts/*');
  await openDelete();
  await page.getByRole('button', { name: 'ลบใบเสร็จ' }).last().click();
  await page.waitForSelector('.ka-pr-res');
  await page.getByRole('button', { name: 'ตกลง' }).click();
  await page.waitForTimeout(800);
  check('A17 the row is gone', (await page.locator('.ka-pr-lt tbody tr').count()) === 0);
  const order = (await api(page, '/sale-order?search=SO209911030007&limit=5')).body.data[0];
  check('A17 the order is reworked', Number(order.amount_paid) === 0 && order.sale_order_status === 'approved', `${order.amount_paid} ${order.sale_order_status}`);
  page.off('request', watch);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, `${LIST}?q=RE209911030005`, '.ka-pr-mc');
  await page.getByRole('button', { name: 'ตัวเลือกของ RE209911030005' }).locator('visible=true').first().click();
  await page.getByRole('button', { name: 'ลบใบเสร็จ' }).click();
  await page.waitForSelector('.ka-pr-dlg');
  await page.waitForTimeout(400);
  await shot(page, 'A17-sheet-390');
  await page.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  await page.getByRole('button', { name: /เปิดเมนู|เมนู/ }).first().click().catch(() => {});
  await shot(page, 'F2-drawer-390');
  await page.setViewportSize({ width: 1440, height: 1000 });
});

await step('A18 print', async () => {
  const pdf = async (name, code) => {
    await open(page, receiptUrl(code), '.ka-pr-hero');
    await page.waitForTimeout(600);
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(200);
    const text = await page.locator('.ka-pr-pg').textContent();
    const hidden = await page.evaluate(() => [...document.querySelectorAll('.ka-sidebar,.ka-header,.ka-pr-hero')].every((node) => getComputedStyle(node).display === 'none' || !node.getClientRects().length));
    const rect = await page.locator('.ka-pr-pg').evaluate((node) => { const box = node.getBoundingClientRect(); return [box.width, box.height]; });
    await page.screenshot({ path: join(out, `A18-${name}.png`), fullPage: true });
    const file = join(out, `A18-${name}.pdf`);
    await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true });
    const pages = (readFileSync(file, 'latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    await page.emulateMedia({ media: 'screen' });
    check(`A18 ${name}: one page, no app parts, 794 wide`, pages === 1 && hidden && rect[0] === 794, `pages ${pages} hidden ${hidden} ${rect}`);
    return text;
  };
  const deposit = await pdf('deposit', 'RE209911030001');
  check('A18 deposit words', deposit.includes('รับชำระมัดจำ') && deposit.includes('ตามใบสั่งขาย'), deposit.slice(0, 200));
  await pdf('full', 'RE209911030002');
  const second = await pdf('second', 'RE209911030005');
  check('A18 second receipt: paid before is not 0', second.includes('20,000.00'), second.slice(0, 300));
  const store = await pdf('store', 'RE202610270825');
  check('A18 store sheet names the reference', store.includes(byCode.RE202610270825.gateway_reference));
  const refund = await pdf('refund', REFUND);
  check("F13 refund sheet: net amount, no balance owed, no paid-by", refund.includes("ยอดชำระสุทธิหลังคืนเงิน") && !refund.includes("คงค้าง") && !refund.includes("ชำระโดย"), refund.slice(0, 200));
  check("F14 no system label on the sheet", !/Store checkout/.test(store + refund), store.slice(0, 200));
  check('A18 refund sheet', refund.includes('ใบคืนเงิน') && refund.includes('REFUND') && refund.includes('คืนเงินให้') && !refund.includes('−'), refund.slice(0, 200));
  const oneReceipt = /:3010\/payment-receipts\/[0-9a-f-]{36}$/;
  await page.route(oneReceipt, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const body = await response.json();
    const data = body.data ?? body;
    data.shop = { ...data.shop, tax_id: null, branch_code: null, phone: null };
    await route.fulfill({ response, json: body.data ? { ...body, data } : data });
  });
  await open(page, receiptUrl('RE209911030002'), '.ka-pr-hero');
  await page.waitForTimeout(400);
  const blank = await page.locator('.ka-pr-pg__hd').textContent();
  await page.unroute(oneReceipt);
  check('A18 no tax id: no line left for it', !blank.includes('เลขประจำตัวผู้เสียภาษี'), blank);
  await open(page, receiptUrl('RE209911030002'), '.ka-pr-hero');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  check('A18 dark theme lifts for print', !(await page.evaluate(() => document.documentElement.classList.contains('dark'))));
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.addInitScript(() => {
    window.__printed = 0;
    window.print = () => { window.__printed += 1; window.__loaded = Boolean(document.querySelector('.ka-pr-pg .ka-pr-pg__ttl')); };
  });
  await open(page, `${receiptUrl('RE209911030002')}?print=1`, '.ka-pr-hero');
  await page.waitForTimeout(1000);
  const printed = await page.evaluate(() => [window.__printed, window.__loaded]);
  check('A18 ?print=1 opens the print window after the data', printed[0] === 1 && printed[1] === true, printed.join());
});

await step('A20 states', async () => {
  const empty = (url, body) => page.route(url, (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true' }, body: JSON.stringify(body) }));
  const none = { data: [], meta: { total: 0, page: 1, last_page: 1, limit: 100 } };
  await empty(/\/sale-order\?/, none);
  await open(page, LIST, '.ka-pr-stats');
  await page.getByText('ไม่มีใบสั่งขายรอรับชำระ').waitFor();
  check('A20 empty queue', true);
  await shot(page, 'A20-empty-queue-1440');
  await open(page, `${LIST}/new`, '.ka-pr-empty');
  check('A20 form with nothing to pay', (await page.getByRole('link', { name: 'ไปที่ใบสั่งขาย' }).count()) === 1);
  await shot(page, 'A20-no-orders-1440');
  await page.unroute(/\/sale-order\?/);
  await page.route(/\/payment-receipts(\?|\/summary)/, (route) => {
    const summary = route.request().url().includes('summary');
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true' }, body: JSON.stringify(summary ? { month: { receipt_count: 0, receipt_today_count: 0, refund_total: 0, refund_count: 0 }, tabs: { all: 0, paid: 0, refund: 0 }, facets: { method: { bank: 0, cash: 0, online: 0 } } } : none) });
  });
  await open(page, LIST, '.ka-pr-stats');
  await page.getByText('ยังไม่มีใบเสร็จรับเงิน').waitFor();
  check('A20 no receipts yet', true);
  await shot(page, 'A20-no-receipts-1440');
  await page.unroute(/\/payment-receipts(\?|\/summary)/);
  await open(page, `${LIST}?q=RE2026119999&type=refund`, '.ka-pr-stats');
  await page.getByText('ไม่พบใบเสร็จที่ตรงกับ “RE2026119999”').waitFor();
  check('A20 search finds nothing', true);
  await shot(page, 'A20-none-found-1440');
  await page.getByRole('button', { name: 'ล้างคำค้นและตัวกรอง' }).click();
  await page.waitForFunction(() => !location.search);
  check('A20 clear empties the URL', true);

  await page.route(/\/sale-order(\?|\/summary)/, (route) => route.abort());
  await open(page, LIST, '.ka-pr-lt tbody tr');
  await page.getByText('ลองอีกครั้ง').first().waitFor();
  check('A20 orders down: the receipts table still works', (await page.locator('.ka-pr-lt tbody tr').count()) > 0);
  await shot(page, 'A20-orders-down-1440');
  await page.unroute(/\/sale-order(\?|\/summary)/);
  await page.route(/\/payment-receipts\?/, (route) => route.abort());
  await open(page, LIST, '.ka-pr-qc');
  await page.getByText('ลองอีกครั้ง').first().waitFor();
  check('A20 receipts down: the queue still works', (await page.locator('.ka-pr-qc').count()) > 0);
  await page.unroute(/\/payment-receipts\?/);

  await open(page, `${LIST}/00000000-0000-4000-8000-000000000000`, '.ka-banner');
  check('A20 an id that does not exist', (await page.locator('.ka-banner').textContent()).includes('ไม่พบ'), await page.locator('.ka-banner').textContent());

  await page.route(/\/payment-receipts\?/, async (route) => {
    await new Promise((done) => setTimeout(done, 1200));
    await route.fallback();
  });
  await page.goto(`${base}${LIST}`, { waitUntil: 'commit' });
  await page.waitForSelector('.ka-pr-skrow');
  const skeletonTop = await page.locator('.ka-pr-fbar').evaluate((node) => node.getBoundingClientRect().top);
  await shot(page, 'A20-skeleton-1440');
  await page.waitForSelector('.ka-pr-lt tbody tr');
  await page.waitForTimeout(300);
  const realTop = await page.locator('.ka-pr-fbar').evaluate((node) => node.getBoundingClientRect().top);
  await page.unroute(/\/payment-receipts\?/);
  check('A20 the skeleton keeps the layout within 8px', Math.abs(realTop - skeletonTop) <= 8, `${skeletonTop} → ${realTop}`);
});

await step('F3 F4 F5', async () => {
  const motion = await browser.newContext({ storageState: process.env.AUTH_STATE ?? join(out, 'auth.json'), viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const still = await motion.newPage();
  await open(still, LIST, '.ka-pr-qc');
  const running = await still.evaluate(() => document.getAnimations().filter((item) => item.effect?.target?.closest?.('.ka-pr')).length);
  check('F4 reduced motion: nothing animates', running === 0, running);
  await motion.close();
  await page.goto(`${base}${LIST}`, { waitUntil: 'commit' });
  await page.waitForSelector('.ka-pr-stats');
  const seen = await page.evaluate(() => document.getAnimations().map((item) => [item.animationName, item.effect?.getTiming().duration, item.effect?.getTiming().delay]));
  check('F4 sections rise over 320ms with a stagger', seen.some(([name, duration]) => name === 'ka-pr-rise' && duration === 320), JSON.stringify(seen.slice(0, 5)));
  await page.setViewportSize({ width: 320, height: 700 });
  for (const path of [LIST, `${LIST}/new`, receiptUrl('RE209911030002'), `${receiptUrl('RE209911030002')}/edit`]) {
    await open(page, path, '.ka-pr h1');
    await page.waitForTimeout(400);
    const over = await page.evaluate(() => { const main = document.querySelector('main'); return [main.scrollWidth - main.clientWidth, document.documentElement.scrollHeight - innerHeight]; });
    check(`F5 320 no sideways scroll on ${path.slice(-24)}`, over[0] <= 0 && over[1] <= 0, over.join());
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, LIST, '.ka-pr-mc');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, `${LIST}/new?sale_order=${orders.SO209911030009.sale_order_id}`, '.ka-pr-sosum');
  const radio = page.getByRole('radio', { name: /ชำระบางส่วน/ });
  await radio.focus();
  await page.keyboard.press('ArrowRight');
  check('F5 arrow keys move the radio', (await page.getByRole('radio', { name: /วางมัดจำ/ }).getAttribute('aria-checked')) === 'true' && (await page.evaluate(() => document.activeElement?.textContent)).includes('วางมัดจำ'));
  await open(page, LIST, '.ka-pr-lt tbody tr');
  let visibleFocus = 0;
  for (let press = 0; press < 40; press += 1) {
    await page.keyboard.press('Tab');
    const outlined = await page.evaluate(() => { const active = document.activeElement; if (!active?.closest?.('.ka-pr')) return null; const style = getComputedStyle(active.closest('.ka-pr-fs') ?? active); return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2; });
    if (outlined === false) { check('F5 focus is visible on every stop', false, await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120))); break; }
    if (outlined) visibleFocus += 1;
  }
  check('F5 Tab reaches the page with visible focus', visibleFocus > 10, visibleFocus);
  await page.getByRole('button', { name: /ตัวเลือกของ/ }).first().click();
  await page.getByRole('menuitem', { name: 'ลบใบเสร็จ' }).first().click().catch(() => {});
  await page.waitForTimeout(200);
  if (await page.locator('.ka-pr-dlg').count()) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    check('F5 a dialog gives focus back', await page.evaluate(() => document.activeElement !== document.body));
  }
  await page.evaluate(() => { localStorage.setItem('theme', 'dark'); document.documentElement.classList.add('dark'); });
  for (const [name, path, ready] of [['list', LIST, '.ka-pr-lt'], ['form', `${LIST}/new?sale_order=${orders.SO209911030009.sale_order_id}`, '.ka-pr-sosum'], ['detail', receiptUrl('RE209911030002'), '.ka-pr-hero']]) {
    await open(page, path, ready);
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(400);
    await shot(page, `F3-dark-${name}-1440`);
    const low = await page.evaluate(() => {
      // A colour mixed in CSS comes back as `color(srgb 0.7 0.3 0.2)`, on a 0–1 scale.
      const parse = (text) => { const values = text.match(/[\d.]+/g).map(Number); return text.startsWith('color(') ? values.slice(0, 3).map((value) => value * 255) : values; };
      const lum = ([r, g, b]) => { const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const background = (node) => { for (let at = node; at; at = at.parentElement) { const color = parse(getComputedStyle(at).backgroundColor); if (color.length === 3 || color[3] > 0.9) return color; } return [17, 21, 27]; };
      const bad = [];
      for (const node of document.querySelectorAll('.ka-pr *')) {
        if (![...node.childNodes].some((child) => child.nodeType === 3 && child.textContent.trim()) || !node.getClientRects().length) continue;
        if (node.closest('[disabled]')) continue;
        const a = lum(parse(getComputedStyle(node).color));
        const b = lum(background(node));
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        if (ratio < 4.5) bad.push(`${node.className} ${ratio.toFixed(2)}`);
      }
      return bad;
    });
    check(`F3 dark ${name}: text at 4.5:1`, low.length === 0, low.slice(0, 5).join(' | '));
  }
  await page.evaluate(() => { localStorage.setItem('theme', 'light'); document.documentElement.classList.remove('dark'); });
});

await step('R1 findings', async () => {
  const json = (body, status = 200) => ({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true' }, body: JSON.stringify(body) });

  // F1: a full receipt that never matched what is owed keeps its amount when only the remark changes.
  const bodies = [];
  const watch = (request) => {
    if (request.method() === 'PATCH' && request.postData()) bodies.push(JSON.parse(request.postData()));
  };
  page.on('request', watch);
  await open(page, `${receiptUrl('RE209911030008')}/edit`, '.ka-pr-sosum');
  await page.waitForTimeout(800);
  check('F1 opening a full receipt changes nothing', (await page.locator('.ka-pr-chg').count()) === 0 && (await page.inputValue('#ka-pr-amt')).includes('600'), await page.inputValue('#ka-pr-amt'));
  await page.fill('#ka-pr-rm', 'แก้หมายเหตุอย่างเดียว');
  await page.locator('.ka-pr-fsave .ka-pr-btn--a').click();
  await page.waitForSelector('.ka-pr-res');
  check('F1 the amount stays ฿600', bodies[0]?.amount_paid === 600, JSON.stringify(bodies[0]));
  // F11: the save is done, so nothing is left to protect.
  const asks = await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  check('F11 after saving, leaving does not ask', !asks);
  await page.getByRole('button', { name: 'ดูใบเสร็จ' }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/edit'));

  // F19: from transfer to cash, the account no longer shows.
  await open(page, `${receiptUrl('RE209911030009')}/edit`, '.ka-pr-sosum');
  await page.waitForFunction(() => document.querySelector('#ka-pr-amt')?.value);
  await page.getByRole('radio', { name: /เงินสด/ }).click();
  await page.locator('.ka-pr-fsave .ka-pr-btn--a').click();
  await page.waitForSelector('.ka-pr-res');
  await page.getByRole('button', { name: 'ดูใบเสร็จ' }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/edit'));
  await page.waitForSelector('.ka-pr-dl');
  const account = await page.locator('.ka-pr-dl > div', { hasText: 'บัญชีที่รับเงิน' }).locator('dd').textContent();
  check('F19 a receipt changed to cash shows no bank account', account === '—', account);
  page.off('request', watch);

  // F5: without the order's receipts there is nothing true to print.
  await page.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed += 1; }; });
  await page.route(/:3010\/payment-receipts\?/, (route) => route.abort());
  await open(page, `${receiptUrl('RE209911030005')}?print=1`, '.ka-pr-hero');
  await page.getByRole('button', { name: 'ลองอีกครั้ง' }).waitFor();
  await page.waitForTimeout(700);
  check('F5 no print while the payments are missing', (await page.evaluate(() => window.__printed)) === 0 && (await page.getByRole('button', { name: 'พิมพ์ / PDF' }).isDisabled()));
  await page.unroute(/:3010\/payment-receipts\?/);

  // F6: the bar of a cancelled order follows the money.
  await open(page, receiptUrl('RE209911030003'), '.ka-pr-hero');
  await page.waitForTimeout(600);
  const bar = await page.locator('.ka-pr-aside .ka-pr-meter i').evaluate((node) => node.style.width);
  check('F6 cancelled bar is 3,000 of 6,000', bar === '50%', bar);

  // F7: the method counts follow the tab.
  const asked = [];
  const listen = (request) => { if (request.url().includes('/payment-receipts/summary')) asked.push(request.url()); };
  page.on('request', listen);
  await open(page, `${LIST}?tab=refund`, '.ka-pr-stats');
  await page.waitForTimeout(500);
  page.off('request', listen);
  check('F7 the summary asks for the tab', asked.some((url) => url.includes('tab=refund')), asked.join(' '));

  // F8: a summary that fails says so and offers a retry.
  await page.route(/:3010\/payment-receipts\/summary/, (route) => route.abort());
  await page.route(/:3010\/sale-order\/summary/, (route) => route.abort());
  await open(page, LIST, '.ka-pr-stats');
  await page.getByText('โหลดตัวเลขสรุปไม่สำเร็จ').waitFor();
  const skeletons = await page.locator('.ka-pr-stat .ka-pr-sk').count();
  check('F8 no stat card stays a skeleton', skeletons === 0, skeletons);
  await shot(page, 'F8-summary-down-1440');
  await page.unroute(/:3010\/payment-receipts\/summary/);
  await page.unroute(/:3010\/sale-order\/summary/);
  await page.route(/:3010\/sale-order\?/, (route) => route.abort());
  await open(page, LIST, '.ka-pr-stats');
  await page.getByText('ลองอีกครั้ง').first().waitFor();
  const head = await page.locator('#ka-pr-queue-title').textContent();
  check('F8 a failed queue does not say 0 orders', !head.includes('0 ใบสั่งขาย'), head);
  await page.unroute(/:3010\/sale-order\?/);

  // F9: a page past the end goes to the last page there is.
  await open(page, `${LIST}?page=999`, '.ka-pr-stats');
  await page.waitForSelector('.ka-pr-lt tbody tr');
  check('F9 ?page past the end lands on real rows', !page.url().includes('page=999'), page.url());

  // F3a: a failed delete closes with a plain button.
  await page.route(/:3010\/payment-receipts\/[0-9a-f-]{36}$/, (route) => (route.request().method() === 'DELETE' ? route.fulfill(json({ message: 'ลบไม่ได้' }, 409)) : route.fallback()));
  await open(page, `${LIST}?q=RE209911030004`, '.ka-pr-lt tbody tr');
  await page.getByRole('button', { name: 'ตัวเลือกของ RE209911030004' }).click();
  await page.getByRole('menuitem', { name: 'ลบใบเสร็จ' }).click();
  await page.waitForSelector('.ka-pr-dlg');
  await page.getByRole('button', { name: 'ลบใบเสร็จ' }).last().click();
  await page.waitForSelector('.ka-pr-res');
  await page.waitForTimeout(350);
  const close = await page.getByRole('button', { name: 'ปิด', exact: true }).first().evaluate((node) => { const style = getComputedStyle(node); return [style.backgroundColor, getComputedStyle(document.querySelector('.ka-pr-res')).backgroundColor]; });
  check('F3 the failed result closes with a plain button', close[0] === close[1], close.join(' / '));
  await page.getByRole('button', { name: 'ปิด', exact: true }).first().click();
  await page.unroute(/:3010\/payment-receipts\/[0-9a-f-]{36}$/);

  // F18: an order past the first twenty options is found by typing.
  await open(page, `${LIST}/new`, '#ka-pr-so');
  await page.locator('#ka-pr-so').click();
  await page.waitForTimeout(300);
  const first = await page.locator('[role=option]').allTextContents();
  check('A9 the far order is not among the first options', !first.some((text) => text.includes('SO209911030150')), first.length);
  await page.getByRole('searchbox').fill('SO209911030150');
  await page.locator('[role=option]', { hasText: 'SO209911030150' }).waitFor();
  check('A9 typing finds the order past the first twenty', true);
  await page.keyboard.press('Escape');
});

await step('R2 findings', async () => {
  // F28: the status arrives late; a press in that gap must not save again.
  const posts = [];
  const watch = (request) => {
    if (request.method() === 'POST' && /:3010\/payment-receipts$/.test(request.url())) posts.push(request.url());
  };
  page.on('request', watch);
  await open(page, `${LIST}/new?sale_order=${orders.SO209911030009.sale_order_id}`, '.ka-pr-sosum');
  await page.waitForFunction(() => document.querySelector('#ka-pr-amt')?.value);
  await page.fill('#ka-pr-amt', '5');
  await page.getByRole('radio', { name: /เงินสด/ }).click();
  await page.route(/:3010\/sale-order\/[0-9a-f-]{36}$/, async (route) => {
    await new Promise((done) => setTimeout(done, 1500));
    await route.fallback();
  });
  const save = page.locator('.ka-pr-fsave .ka-pr-btn--a');
  await save.click();
  await page.waitForSelector('.ka-pr-res');
  check('F28 the result opens without waiting for the status', !(await page.locator('.ka-pr-res').textContent()).includes('ใบสั่งขายเป็น'));
  await save.evaluate((node) => node.click());
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(2000);
  check('F28 a press after the POST sends nothing', posts.length === 1, posts.length);
  check('F28 the status follows from the API', (await page.locator('.ka-pr-res').textContent()).includes('ใบสั่งขายเป็น'));
  await page.unroute(/:3010\/sale-order\/[0-9a-f-]{36}$/);
  page.off('request', watch);

  // F29: a custom receipt goes by its order's name; a store receipt never by the machine label.
  await open(page, receiptUrl('RE202611030001'), '.ka-pr-hero');
  const title = await page.locator('h1').textContent();
  check('F29 a custom receipt keeps a name', !title.includes('—') && title.includes(byCode.RE202611030001.saleOrder.sale_order_name), title);

  // F31: a store order cancelled afterwards reads as cancelled.
  const oneReceipt = /:3010\/payment-receipts\/[0-9a-f-]{36}$/;
  await page.route(oneReceipt, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const body = await response.json();
    const data = body.data ?? body;
    data.saleOrder = { ...data.saleOrder, sale_order_status: 'cancelled' };
    await route.fulfill({ response, json: body.data ? { ...body, data } : data });
  });
  await open(page, receiptUrl('RE202610270825'), '.ka-pr-hero');
  await page.waitForTimeout(500);
  const card = await page.locator('.ka-pr-aside').textContent();
  await page.unroute(oneReceipt);
  check('F31 a cancelled store order says so', card.includes('ใบสั่งขายถูกยกเลิกแล้ว') && !card.includes('ชำระครบ'), card);

  // F32: each refund prints what stood after itself.
  await open(page, receiptUrl('RE209911030011'), '.ka-pr-hero');
  await page.waitForTimeout(600);
  const firstSheet = await page.locator('.ka-pr-pg__tot').textContent();
  check('F32 the first of two refunds prints ฿900', firstSheet.includes('900.00'), firstSheet);
  await open(page, receiptUrl('RE209911030012'), '.ka-pr-hero');
  await page.waitForTimeout(600);
  const secondSheet = await page.locator('.ka-pr-pg__tot').textContent();
  check('F32 the second prints ฿700', secondSheet.includes('700.00'), secondSheet);
});

const small = async (target, where) => {
  const under = await target.evaluate(() =>
    [...document.querySelectorAll('.ka-pr a, .ka-pr button, .ka-pr input, .ka-pr select, .ka-pr textarea, .ka-pr [role=combobox], .ka-pr-filter button, .ka-pr-filter input:not([type=checkbox]), .ka-popover button, .ka-popover label')]
      .filter((node) => node.getClientRects().length && !node.closest('.ka-pr-pg'))
      // Inline links in a sentence are exempt (WCAG 2.5.8); a chip link carries its target in ::after.
      .filter((node) => !node.closest('.ka-pr-banner, [role=note]') && !['ka-pr-sochip', 'ka-pr-rowlink', 'ka-pr-mc__link'].some((name) => node.classList.contains(name)))
      // The search box's input sits inside a 44px field.
      .filter((node) => !node.closest('.ka-pr-fs') || node.tagName === 'BUTTON')
      .filter((node) => Math.round(node.getBoundingClientRect().height) < 44)
      .map((node) => `${node.tagName}.${String(node.className).slice(0, 40)} ${Math.round(node.getBoundingClientRect().height)}`),
  );
  check(`F5 every control is 44 high: ${where}`, under.length === 0, under.slice(0, 6).join(' | '));
};

await step('F5 F4 all pages', async () => {
  // Between 640 and 767 the panels are popovers, not sheets, and G7 still asks for 44.
  await page.setViewportSize({ width: 700, height: 900 });
  await open(page, LIST, '.ka-pr-mc');
  for (const name of ['วิธีชำระ', 'ประเภท', 'ช่วงวันที่']) {
    await page.getByRole('button', { name }).click();
    await page.waitForTimeout(450);
    await small(page, `popover ${name} 700`);
    await page.keyboard.press('Escape');
  }
  await page.locator('.ka-pr-chip--sq').click();
  await page.waitForTimeout(450);
  await small(page, 'sort menu 700');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /ตัวเลือกของ/ }).locator('visible=true').first().click();
  await page.waitForTimeout(450);
  await small(page, 'row menu 700');
  await page.keyboard.press('Escape');
  const pages = [
    ['list', LIST, '.ka-pr-pager'],
    ['form', `${LIST}/new?sale_order=${orders.SO209911030009.sale_order_id}`, '.ka-pr-sosum'],
    ['detail', receiptUrl('RE209911030005'), '.ka-pr-hero'],
    ['edit', `${receiptUrl('RE209911030004')}/edit`, '.ka-pr-sosum'],
  ];
  for (const width of [390, 767]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [name, path, ready] of pages) {
      await open(page, path, ready);
      await page.waitForTimeout(500);
      await small(page, `${name} ${width}`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, LIST, '.ka-pr-mc');
  await page.getByRole('button', { name: 'วิธีชำระ' }).click();
  await page.waitForSelector('.ka-pr-filter');
  await page.waitForTimeout(450);
  await small(page, 'filter sheet 390');
  await page.getByRole('button', { name: 'ปิดตัวกรอง' }).click();
  await page.waitForTimeout(300);
  check('F5 the filter sheet gives focus back', (await page.evaluate(() => document.activeElement?.textContent ?? '')).includes('วิธีชำระ'));
  const trigger = page.getByRole('button', { name: /ตัวเลือกของ/ }).locator('visible=true').first();
  await trigger.focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('.ka-pr-bsi');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  check('F5 the row sheet gives focus back to ⋯', (await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '')).startsWith('ตัวเลือกของ'));
  await page.setViewportSize({ width: 1440, height: 1000 });

  for (const [name, path, ready] of pages) {
    await open(page, path, ready);
    await page.waitForTimeout(400);
    let stops = 0;
    let hidden = '';
    for (let press = 0; press < 60; press += 1) {
      await page.keyboard.press('Tab');
      const seen = await page.evaluate(() => {
        const active = document.activeElement;
        if (!active?.closest?.('.ka-pr')) return null;
        const style = getComputedStyle(active.closest('.ka-pr-fs') ?? active.closest('.ka-pr-amt') ?? active);
        return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2 ? '' : active.outerHTML.slice(0, 90);
      });
      if (seen === null) continue;
      stops += 1;
      if (seen) { hidden = seen; break; }
    }
    check(`F5 Tab through ${name}: focus shows at every stop`, stops > 3 && !hidden, `${stops} ${hidden}`);
  }
  await open(page, `${LIST}?q=RE209911030004`, '.ka-pr-lt tbody tr');
  const menu = page.getByRole('button', { name: 'ตัวเลือกของ RE209911030004' });
  await menu.click();
  await page.getByRole('menuitem', { name: 'ลบใบเสร็จ' }).click();
  await page.waitForSelector('.ka-pr-dlg');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  const back = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName);
  check('F5 the delete dialog gives focus back to ⋯', String(back).startsWith('ตัวเลือกของ'), back);

  const timing = (target) => target.evaluate(() => document.getAnimations().map((item) => [item.animationName, item.effect?.getTiming().duration, item.effect?.getTiming().delay]));
  await page.goto(`${base}${LIST}`, { waitUntil: 'commit' });
  await page.waitForSelector('.ka-pr-stats');
  const rises = (await timing(page)).filter(([name]) => name === 'ka-pr-rise').map(([, , delay]) => delay);
  check('F4 the sections stagger 0/40/80/120', [40, 80, 120].every((delay) => rises.includes(delay)), rises.join());
  await page.waitForSelector('.ka-pr-meter i', { state: 'attached' });
  const grow = (await timing(page)).find(([name]) => name === 'ka-pr-grow');
  check('F4 a meter grows over 600ms', grow?.[1] === 600, JSON.stringify(grow));
  await page.goto(`${base}${receiptUrl('RE209911030002')}`, { waitUntil: 'commit' });
  await page.waitForSelector('.ka-pr-ring path');
  const draw = (await timing(page)).find(([name]) => name === 'ka-pr-draw');
  check('F4 the tick draws over 450ms after 200ms', draw?.[1] === 450 && draw?.[2] === 200, JSON.stringify(draw));
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, LIST, '.ka-pr-mc');
  await page.getByRole('button', { name: /ตัวเลือกของ/ }).locator('visible=true').first().click();
  await page.waitForSelector('.ka-pr-bsi');
  const up = (await timing(page)).find(([name]) => name === 'ka-pr-up');
  check('F4 a sheet rises over 320ms', up?.[1] === 320, JSON.stringify(up));
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 1000 });
});

await step('Widths', async () => {
  for (const [width, height] of [[834, 1112], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await open(page, LIST, '.ka-pr-stat');
    await page.waitForTimeout(600);
    const stats = await page.locator('.ka-pr-stats').textContent();
    check(`A2 ${width} four numbers show`, /฿/.test(stats) && /ใบ/.test(stats) && !/undefined/.test(stats), stats);
    await shot(page, `A2-stats-${width}`);
    const queue = await page.locator('.ka-pr-qc .ka-pr-code').allTextContents();
    check(`A3 ${width} the queue is the oldest three`, queue.length === 3 && !queue.includes('SO209911030006'), queue.join());
    await shot(page, `A3-queue-${width}`);

    await page.fill('.ka-pr-fs input', 'SO209911030005');
    await page.waitForFunction(() => document.querySelectorAll('.ka-pr-mc').length === 2);
    check(`A4 ${width} search finds the cards and tints the match`, (await page.locator('.ka-pr-mc mark').count()) > 0);
    await shot(page, `A4-search-${width}`);
    await page.locator('.ka-pr-mc__link').first().click();
    await page.waitForURL(/payment-receipts\/[0-9a-f-]{36}/);
    check(`A4 ${width} a card opens the receipt`, /payment-receipts\/[0-9a-f-]{36}/.test(page.url()), page.url());

    await open(page, LIST, '.ka-pr-mc');
    await page.getByRole('button', { name: 'วิธีชำระ' }).click();
    if (width === 390) {
      await page.waitForSelector('.ka-pr-filter');
      await page.locator('.ka-pr-filter').getByLabel('โอนผ่านธนาคาร').check();
      await page.locator('.ka-pr-filter .ka-pr-btn--a').click();
    } else {
      await page.getByLabel('โอนผ่านธนาคาร').check();
      await page.getByRole('button', { name: 'ใช้ตัวกรอง' }).click();
    }
    await page.waitForFunction(() => location.search.includes('method=bank'));
    await page.waitForSelector('.ka-pr-chipon');
    check(`A7 ${width} the chip names the filter and leads the row`, await page.locator('.ka-pr-fbar').evaluate((node) => node.children[1].classList.contains('ka-pr-chipon') && node.children[1].textContent.includes('โอนผ่านธนาคาร')), await page.locator('.ka-pr-fbar').textContent());
    await shot(page, `A7-filtered-${width}`);

    await open(page, `${LIST}/new?sale_order=${orders.SO209911030006.sale_order_id}`, '.ka-pr-banner');
    check(`A9 ${width} a cancelled link says why`, (await page.locator('.ka-pr-banner').textContent()).includes('ถูกยกเลิกแล้ว'));
    await shot(page, `A9-cancelled-${width}`);

    await open(page, `${LIST}/new?sale_order=${orders.SO209911030009.sale_order_id}`, '.ka-pr-sosum');
    await page.waitForFunction(() => document.querySelector('#ka-pr-amt')?.value);
    await page.fill('#ka-pr-amt', '10');
    await page.getByRole('radio', { name: /เงินสด/ }).click();
    const save = page.locator(width === 390 ? '.ka-pr-savebar .ka-pr-btn--a' : '.ka-pr-fsave .ka-pr-btn--a');
    const postOnly = /:3010\/payment-receipts$/;
    await page.route(postOnly, (route) => (route.request().method() === 'POST' ? route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true' }, body: JSON.stringify({ message: 'ยอดรับชำระเกินยอดคงค้าง' }) }) : route.fallback()));
    await save.click();
    await page.waitForSelector('.ka-pr-banner[data-tone=danger]');
    check(`A12 ${width} a 400 shows the banner and keeps the input`, (await page.inputValue('#ka-pr-amt')) === '10');
    await page.unroute(postOnly);
    await page.route(postOnly, (route) => (route.request().method() === 'POST' ? route.abort() : route.fallback()));
    await save.click();
    await page.waitForTimeout(500);
    check(`A12 ${width} a cut network keeps the banner`, await page.locator('.ka-pr-banner[data-tone=danger]').isVisible());
    await page.unroute(postOnly);
    let sent = 0;
    await page.route(postOnly, async (route) => {
      if (route.request().method() === 'POST') {
        sent += 1;
        await new Promise((done) => setTimeout(done, 700));
      }
      await route.fallback();
    });
    await save.evaluate((node) => { node.click(); node.click(); node.click(); });
    await page.waitForSelector('.ka-pr-res');
    await page.unroute(postOnly);
    check(`A12 ${width} three clicks, one POST`, sent === 1, sent);
    await shot(page, `A12-result-${width}`);
    check(`A12 ${width} the result names a real RE`, /RE\d{12}/.test(await page.locator('.ka-pr-res').textContent()));
    await page.getByRole('button', { name: 'ดูใบเสร็จ' }).click();
    await page.waitForURL(/payment-receipts\/[0-9a-f-]{36}/);

    await open(page, `${receiptUrl('RE209911030002')}/edit`, '.ka-pr-sosum');
    await page.waitForFunction(() => document.querySelector('#ka-pr-amt')?.value);
    await page.fill('#ka-pr-rm', 'แก้แล้ว');
    await page.goBack({ waitUntil: 'commit' }).catch(() => {});
    await page.getByRole('dialog', { name: 'ออกจากหน้านี้?' }).waitFor();
    await shot(page, `A14-leave-${width}`);
    check(`A14 ${width} back asks`, true);
    await page.getByRole('button', { name: 'ทิ้งการแก้ไข' }).click();
    await page.waitForTimeout(600);

    for (const [name, code] of [['refund', REFUND], ['store', 'RE202610270825'], ['custom', 'RE202611030001'], ['cancelled', 'RE209911030003']]) {
      await open(page, receiptUrl(code), '.ka-pr-hero');
      await page.waitForTimeout(500);
      await shot(page, `A16-${name}-${width}`);
      await page.locator('.ka-pr-aside').scrollIntoViewIfNeeded();
      await shot(page, `A16-${name}-aside-${width}`);
      const text = await page.locator('.ka-pr').textContent();
      const words = { refund: 'คืนเงินให้ลูกค้าแล้ว', store: 'ลูกค้าชำระผ่านหน้าร้าน', custom: 'เปิดใบสั่งขาย Custom', cancelled: 'ใบสั่งขายถูกยกเลิกแล้ว รับชำระเพิ่มไม่ได้' };
      check(`A16 ${width} ${name} block`, text.includes(words[name]), text.slice(0, 160));
    }

    const none = { data: [], meta: { total: 0, page: 1, last_page: 1, limit: 100 } };
    await page.route(/:3010\/sale-order\?/, (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true' }, body: JSON.stringify(none) }));
    await open(page, LIST, '.ka-pr-stats');
    await page.getByText('ไม่มีใบสั่งขายรอรับชำระ').waitFor();
    await shot(page, `A20-empty-queue-${width}`);
    await page.unroute(/:3010\/sale-order\?/);
    check(`A20 ${width} empty queue`, true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });

  // F10: the skeleton and the cards take the same room at every size, measured across the queue's arrival.
  for (const [width, height] of [[1440, 1000], [834, 1112], [390, 844]]) {
    await page.setViewportSize({ width, height });
    // With the sheet's lengths of text (V4): a longer order name wraps and adds its line to the real card.
    const NAMES = ['แก้วเก็บความเย็นสกรีนโลโก้ 120 ใบ', 'ชุดของขวัญปีใหม่ 40 ชุด', 'กระบอกน้ำเลเซอร์โลโก้ 300 ใบ'];
    await page.route(/:3010\/sale-order\?/, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      const body = await response.json();
      body.data.forEach((order, index) => {
        order.sale_order_name = NAMES[index % 3];
      });
      await new Promise((done) => setTimeout(done, 1500));
      await route.fulfill({ response, json: body });
    });
    await page.goto(`${base}${LIST}`, { waitUntil: 'commit' });
    await page.waitForSelector('.ka-pr-qc--sk');
    const before = await page.locator('.ka-pr-fbar').evaluate((node) => node.getBoundingClientRect().top);
    await page.waitForSelector('.ka-pr-qc:not(.ka-pr-qc--sk)');
    await page.waitForTimeout(300);
    const after = await page.locator('.ka-pr-fbar').evaluate((node) => node.getBoundingClientRect().top);
    await page.unroute(/:3010\/sale-order\?/);
    check(`A20 ${width} the queue skeleton keeps the layout within 8px`, Math.abs(after - before) <= 8, `${before} → ${after}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
});

const failed = results.filter((item) => !item.ok);
check('A21 no console or page errors', problems.length === 0, [...new Set(problems)].slice(0, 5).join(' | '));
writeFileSync(join(out, 'results.json'), JSON.stringify({ results, problems: [...new Set(problems)] }, null, 2));
console.log(`\n${results.filter((item) => item.ok).length}/${results.length} passed`);
for (const item of failed) console.log(`FAIL ${item.name}: ${item.detail}`);
await browser.close();
process.exit(0);
