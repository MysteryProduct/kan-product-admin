// Purchase orders v2 (TASK-0324): screenshots at 390/834/1440px, the real create → approve → edit →
// cancel → delete → reorder flows, saved totals against the old calculation, a keyboard-only walk and
// overflow at 320px. Development stack only: signs in with the demo_audit account whose password the
// API seed script sets (kan-product-api/scripts/seed-demo-audit-user.cjs). Every order it creates is
// named "ทดสอบ TASK-0324 …" and deleted again at the end.
//
//   node tests/screenshots/purchase-orders-v2-capture.mjs [baseUrl] [apiUrl]
//
// Needs the `playwright` package and Chromium, installed outside this repo; set PLAYWRIGHT_DIR to the
// folder whose node_modules holds it and SEED_FILE when the API checkout is not beside this one.
// PROXY=1 forwards localhost:3021 (the page) and :3022 (the API, via a CORS-rewriting proxy on the host)
// to host.docker.internal for a run inside the Playwright container.
// Screenshots and results.json go to tests/screenshots/purchase-orders-v2/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  forward(3021);
  forward(3022);
}

const base = process.argv[2] ?? 'http://localhost:3021';
const api = (process.argv[3] ?? 'http://localhost:3022').replace(/\/$/, '');
const out = join(here, 'purchase-orders-v2');
mkdirSync(out, { recursive: true });

const seedFile = process.env.SEED_FILE ?? join(here, '../../../kan-product-api/scripts/seed-demo-audit-user.cjs');
const password = readFileSync(seedFile, 'utf8').match(/bcrypt\.hash\('([^']+)'/)?.[1];
if (!password) throw new Error('seed password not found');

const WIDTHS = [390, 834, 1440];
// The API list call; the page itself is /admin/purchase-orders (with an s), which this must not catch.
const LIST_API = /\/purchase-order\?/;
const TAG = 'ทดสอบ TASK-0324';
const results = [];
const notes = {};
const check = (name, ok, note = '') => {
  results.push({ name, ok: Boolean(ok), note });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ` — ${note}` : ''}`);
};

// The calculation the old insert/update dialogs sent (src/lib/vat.ts calculateVatSummary, unchanged).
const toMoney = (value) => (Number.isFinite(value) ? Math.round(value * 100) / 100 : 0);
function oldVatSummary(baseAmount, vatType, ratePercent = 7) {
  const amount = Math.max(0, Number(baseAmount || 0));
  const rate = ratePercent / 100;
  if (vatType === 'exclude') {
    const vat = toMoney(amount * rate);
    return { subtotal: toMoney(amount), vat, total: toMoney(amount + vat) };
  }
  if (vatType === 'include') {
    const vat = toMoney((amount * rate) / (1 + rate));
    return { subtotal: toMoney(amount - vat), vat, total: toMoney(amount) };
  }
  return { subtotal: toMoney(amount), vat: 0, total: toMoney(amount) };
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', locale: 'th-TH' });
const page = await context.newPage();
const consoleErrors = [];
page.on('pageerror', (error) => consoleErrors.push(String(error)));

await page.goto(`${base}/login`);
await page.waitForSelector('#username', { timeout: 120000 });
await page.evaluate(() => localStorage.setItem('theme', 'light'));
await page.fill('#username', 'demo_audit');
await page.fill('#password', password);
await page.click('button[type=submit]');
await page.waitForURL(/\/admin/, { timeout: 120000, waitUntil: 'commit' });

const settle = async (ms = 500) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
};
const shot = (name, options = {}) => page.screenshot({ path: join(out, `${name}.png`), fullPage: true, ...options });
const noSideScroll = () =>
  page.evaluate(() => {
    const main = document.querySelector('main');
    return document.documentElement.scrollWidth <= window.innerWidth + 1 && (!main || main.scrollWidth <= main.clientWidth + 1);
  });
const token = async () => (await context.cookies()).find((cookie) => cookie.name === 'token')?.value;
const apiGet = async (path) => {
  const response = await page.request.get(`${api}${path}`, { headers: { Authorization: `Bearer ${await token()}` } });
  return response.json();
};
const apiDelete = async (path) => page.request.delete(`${api}${path}`, { headers: { Authorization: `Bearer ${await token()}` } });

await settle(1500);

// Orders left by an earlier run that stopped half-way.
for (const stale of (await apiGet(`/purchase-order?page=1&limit=50&search=${encodeURIComponent(TAG)}`)).data ?? []) {
  notes[`stale_${stale.purchase_order_code}`] = (await apiDelete(`/purchase-order/${stale.purchase_order_id}`)).status();
}

// ---------- Pick a VAT-registered supplier and two materials with units ----------
const suppliers = (await apiGet('/supplier/?page=1&limit=100')).data ?? [];
const supplier = suppliers.find((item) => item.is_vat_register) ?? suppliers[0];
const materials = ((await apiGet('/materials?page=1&limit=100')).data ?? []).slice(0, 2);
const units = (await apiGet('/product-unit?search=')).data ?? [];
notes.supplier = { name: supplier?.supplier_name, is_vat_register: supplier?.is_vat_register };
notes.materials = materials.map((m) => m.material_name);
if (!supplier || materials.length < 2 || units.length < 1) throw new Error('fixtures missing: supplier, 2 materials, 1 unit');

const pickOption = async (triggerId, label) => {
  await page.locator(`#${triggerId}`).click();
  const search = page.getByRole('searchbox');
  if (await search.count()) await search.fill(label.slice(0, 20));
  await page.getByRole('option', { name: label, exact: false }).first().click();
};

const createdIds = [];
const postBodies = [];
page.on('request', (request) => {
  if (request.method() !== 'GET' && /\/purchase-order(\/[^/]+)?$/.test(new URL(request.url()).pathname)) {
    try {
      postBodies.push({ method: request.method(), body: JSON.parse(request.postData() ?? 'null') });
    } catch {
      // not JSON
    }
  }
});

/** Fills the create form: name, supplier, VAT, detail and two lines. Returns the expected old totals. */
async function fillForm({ name, vat, lines }) {
  await page.fill('#po-name', name);
  await pickOption('po-supplier', supplier.supplier_name);
  await page.locator(`#po-vat-${vat}`).click();
  await page.fill('#po-detail', 'สร้างโดยสคริปต์ทดสอบ ลบทิ้งเมื่อจบ');
  for (let index = 0; index < lines.length; index += 1) {
    if (index > 0) await page.getByRole('button', { name: 'เพิ่มรายการวัตถุดิบ' }).click();
    const row = page.locator('.ka-po-ln').nth(index);
    const ids = await row.evaluate((el) => [...el.querySelectorAll('[id^="po-"]')].map((node) => node.id));
    const id = (part) => ids.find((value) => value.endsWith(`-${part}`));
    await pickOption(id('material'), lines[index].material);
    await page.fill(`#${id('qty')}`, String(lines[index].qty));
    await page.fill(`#${id('price')}`, String(lines[index].price));
    await pickOption(id('unit'), units[0].product_unit_name);
  }
  const baseAmount = lines.reduce((sum, line) => sum + line.qty * line.price, 0);
  return oldVatSummary(baseAmount, vat);
}

async function saveAndOpen() {
  await page.locator('.ka-po-sum__acts button[type=submit]').click();
  await page.waitForURL(/\/admin\/purchase-orders\/[0-9a-f-]{36}$/, { timeout: 60000 });
  await settle(800);
  const id = page.url().split('/').pop();
  createdIds.push(id);
  return id;
}

// ---------- Flow 1: create with each VAT type, compare the body and the saved totals ----------
await page.setViewportSize({ width: 1440, height: 1000 });
const LINES = [
  { material: materials[0].material_name, qty: 3, price: 123.45 },
  { material: materials[1].material_name, qty: 7, price: 19.99 },
];
const created = {};
for (const vat of ['none', 'include', 'exclude']) {
  await page.goto(`${base}/admin/purchase-orders/new`);
  await settle(1200);
  const expected = await fillForm({ name: `${TAG} VAT ${vat}`, vat, lines: LINES });
  const shown = await page.locator('.ka-po-sum .ka-po-big').innerText();
  const before = postBodies.length;
  const id = await saveAndOpen();
  const body = postBodies.slice(before).find((entry) => entry.method === 'POST')?.body;
  const saved = (await apiGet(`/purchase-order/${id}`)).data;
  created[vat] = { id, code: saved.purchase_order_code };
  const sent = { subtotal: body?.purchase_order_subtotal, vat: body?.purchase_order_vat_amount, total: body?.purchase_order_total };
  const stored = { base: Number(saved.purchase_order_total), subtotal: Number(saved.purchase_order_subtotal), vat: Number(saved.purchase_order_vat_amount), vat_type: saved.vat_type };
  const storedSummary = oldVatSummary(stored.base, stored.vat_type);
  notes[`vat_${vat}`] = { expected, sent, stored, shown, lines: body?.purchaseOrderLists };
  check(`create ${vat}: body totals = old calculation`, sent.subtotal === expected.subtotal && sent.vat === expected.vat && sent.total === expected.total, JSON.stringify({ expected, sent }));
  check(`create ${vat}: body keys as before`, body && JSON.stringify(Object.keys(body)) === JSON.stringify(['purchase_order_name', 'purchase_order_detail', 'supplier_id', 'vat_type', 'purchase_order_subtotal', 'purchase_order_vat_amount', 'create_by', 'purchase_order_total', 'purchaseOrderLists']), JSON.stringify(Object.keys(body ?? {})));
  // The API works the totals out again from the lines (its own code, unchanged here): the base it stores
  // and the VAT on it must equal what the old dialogs computed for the same lines.
  const baseAmount = LINES.reduce((sum, line) => sum + line.qty * line.price, 0);
  check(`create ${vat}: saved base and VAT = old calculation`, stored.base === toMoney(baseAmount) && stored.vat === expected.vat && stored.vat_type === vat, JSON.stringify({ stored, expected }));
  check(`create ${vat}: page total = old total`, shown.replace(/[฿,\s]/g, '') === expected.total.toFixed(2), `${shown} vs ${expected.total}`);
  check(`create ${vat}: detail shows total`, (await page.locator('.ka-po-aside .ka-po-big').innerText()).replace(/[฿,\s]/g, '') === storedSummary.total.toFixed(2));
  check(`create ${vat}: status pending`, saved.purchase_order_status === 'pending');
  const toast = await page.locator('.ka-toasts').innerText().catch(() => '');
  check(`create ${vat}: toast names the PO`, toast.includes(`สร้างใบสั่งซื้อ ${saved.purchase_order_code} แล้ว`), toast.trim());
}

// ---------- Screenshots: list, empty, detail pending/completed, form new/error ----------
const completedId = (await apiGet('/purchase-order?page=1&limit=1&filters=' + encodeURIComponent(JSON.stringify({ purchase_order_status: JSON.stringify(['completed']) })))).data?.[0]?.purchase_order_id;
for (const width of WIDTHS) {
  const height = width < 640 ? 844 : width < 1024 ? 1112 : 1000;
  await page.setViewportSize({ width, height });

  await page.goto(`${base}/admin/purchase-orders`);
  await settle(1200);
  await shot(`list-${width}`);
  check(`list ${width}: no page side-scroll`, await noSideScroll());
  const tabs = await page.getByRole('tab').allInnerTexts();
  check(`list ${width}: status tabs with counts`, tabs.length >= 6, tabs.join(' | '));

  // "ยังไม่มีใบสั่งซื้อ": the API answers with no orders at all.
  await page.route(LIST_API, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { total: 0, page: 1, last_page: 0, limit: 10 } }) }),
  );
  await page.goto(`${base}/admin/purchase-orders`);
  await settle(1000);
  await shot(`list-empty-${width}`);
  check(`list-empty ${width}: create button in the empty state`, await page.locator('.ka-po-empty').getByRole('link', { name: 'สร้างใบสั่งซื้อ' }).isVisible());
  await page.unroute(LIST_API);

  await page.goto(`${base}/admin/purchase-orders?q=${encodeURIComponent('ไม่มีใบนี้แน่นอน')}`);
  await settle(1000);
  await shot(`list-nomatch-${width}`);
  check(`list-nomatch ${width}: clear filters`, await page.getByRole('button', { name: 'ล้างตัวกรอง' }).isVisible());

  await page.goto(`${base}/admin/purchase-orders/${created.exclude.id}`);
  await settle(1200);
  await shot(`detail-pending-${width}`);
  check(`detail-pending ${width}: no page side-scroll`, await noSideScroll());

  if (completedId) {
    await page.goto(`${base}/admin/purchase-orders/${completedId}`);
    await settle(1200);
    await shot(`detail-completed-${width}`);
    check(`detail-completed ${width}: no page side-scroll`, await noSideScroll());
  }

  await page.goto(`${base}/admin/purchase-orders/new`);
  await settle(1200);
  await shot(`form-new-${width}`);
  check(`form-new ${width}: no page side-scroll`, await noSideScroll());
  await page.locator(width < 640 ? '.ka-po-savebar button[type=submit]' : '.ka-po-sum__acts button[type=submit]').click();
  await page.waitForTimeout(400);
  await shot(`form-error-${width}`);
  const errorLinks = await page.locator('.ka-po-errors__list a').count();
  check(`form-error ${width}: summary with links`, errorLinks >= 5, `${errorLinks} links`);
  if (width < 640) check('form 390: savebar visible, summary buttons hidden', (await page.locator('.ka-po-savebar').isVisible()) && !(await page.locator('.ka-po-sum__acts').isVisible()));
}

// Print preview of the completed order.
if (completedId) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/admin/purchase-orders/${completedId}`);
  await settle(1200);
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(300);
  await shot('print-1440');
  const hidden = await page.evaluate(() => ['.ka-sidebar', '.ka-header', '.ka-po-noprint'].every((selector) => [...document.querySelectorAll(selector)].every((el) => getComputedStyle(el).display === 'none')));
  check('print: sidebar, header and buttons hidden', hidden);
  await page.emulateMedia({ media: 'screen' });
}

// ---------- Flow 2: approve the exclude order ----------
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${base}/admin/purchase-orders/${created.exclude.id}`);
await settle(1000);
await page.getByRole('button', { name: 'อนุมัติ', exact: true }).click();
await page.getByRole('dialog').getByRole('button', { name: 'อนุมัติ', exact: true }).click();
await settle(1500);
const approved = (await apiGet(`/purchase-order/${created.exclude.id}`)).data;
check('approve: status active', approved.purchase_order_status === 'active', approved.purchase_order_status);
check('approve: stays on the page with the new badge', page.url().endsWith(created.exclude.id) && (await page.locator('.ka-po-idrow').innerText()).includes('อนุมัติแล้ว · รอรับ'));
check('approve: toast', (await page.locator('.ka-toasts').innerText()).includes(`อนุมัติใบสั่งซื้อ ${created.exclude.code} แล้ว`));
check('approve: step "รับสินค้า" is current', (await page.locator('.ka-po-st[aria-current=step]').innerText()).includes('รับสินค้า'));
await shot('flow-approved-1440');

// ---------- Flow 3: edit the pending include order (quantity 3 → 5 on line 1) ----------
await page.goto(`${base}/admin/purchase-orders/${created.include.id}/edit`);
await settle(1500);
const firstQty = page.locator('.ka-po-ln').first().locator('input[inputmode=numeric]');
await firstQty.fill('5');
const beforeEdit = postBodies.length;
await page.locator('.ka-po-sum__acts button[type=submit]').click();
await page.waitForURL(new RegExp(`${created.include.id}$`), { timeout: 60000 });
await settle(1000);
const editBody = postBodies.slice(beforeEdit).find((entry) => entry.method === 'PATCH')?.body;
const editExpected = oldVatSummary(5 * 123.45 + 7 * 19.99, 'include');
const edited = (await apiGet(`/purchase-order/${created.include.id}`)).data;
notes.edit = { expected: editExpected, sent: editBody && { subtotal: editBody.purchase_order_subtotal, vat: editBody.purchase_order_vat_amount, total: editBody.purchase_order_total }, stored: { base: edited.purchase_order_total, subtotal: edited.purchase_order_subtotal, vat: edited.purchase_order_vat_amount } };
check('edit: PATCH body totals = old calculation', editBody && editBody.purchase_order_total === editExpected.total && editBody.purchase_order_vat_amount === editExpected.vat, JSON.stringify(notes.edit));
check('edit: PATCH body keys as before', editBody && JSON.stringify(Object.keys(editBody)) === JSON.stringify(['purchase_order_id', 'purchase_order_name', 'purchase_order_detail', 'supplier_id', 'vat_type', 'purchase_order_subtotal', 'purchase_order_vat_amount', 'update_by', 'purchase_order_total', 'purchaseOrderLists']), JSON.stringify(Object.keys(editBody ?? {})));
check('edit: saved quantity 5', orderQty(edited) === 5, String(orderQty(edited)));
function orderQty(order) {
  return Number((order.purchaseOrderLists ?? []).find((line) => Number(line.purchase_order_list_price) === 123.45)?.purchase_order_list_qty);
}
// An approved order cannot be edited.
await page.goto(`${base}/admin/purchase-orders/${created.exclude.id}/edit`);
await settle(1000);
check('edit: approved order refused', (await page.locator('[role=note]').innerText()).includes('แก้ไขได้เฉพาะ'));

// ---------- Flow 4: cancel (reject) the pending none order ----------
await page.goto(`${base}/admin/purchase-orders/${created.none.id}`);
await settle(1000);
await page.getByRole('button', { name: `ตัวเลือกเพิ่มเติมของ ${created.none.code}` }).click();
await page.getByRole('menuitem', { name: 'ยกเลิกใบสั่งซื้อ' }).click();
await page.getByRole('dialog').locator('textarea, input[type=text]').first().fill('ทดสอบการยกเลิก TASK-0324');
await page.getByRole('dialog').getByRole('button', { name: 'ยืนยันยกเลิก' }).click();
await settle(1500);
const rejected = (await apiGet(`/purchase-order/${created.none.id}`)).data;
check('cancel: status inactive', rejected.purchase_order_status === 'inactive', rejected.purchase_order_status);
const banner = await page.locator('.ka-po-cancelled').innerText().catch(() => '');
check('cancel: banner with reason, no steps', banner.includes('ใบสั่งซื้อนี้ถูกยกเลิก') && banner.includes('ทดสอบการยกเลิก') && (await page.locator('.ka-po-steps').count()) === 0, banner.replace(/\s+/g, ' '));
await shot('flow-cancelled-1440');

// ---------- Flow 5: reorder from the completed order ----------
if (completedId) {
  await page.goto(`${base}/admin/purchase-orders/${completedId}`);
  await settle(1000);
  await page.getByRole('link', { name: 'สั่งซ้ำ' }).click();
  await page.waitForURL(/\/new\?copy=/, { timeout: 60000 });
  await settle(1500);
  const name = await page.inputValue('#po-name');
  const lineCount = await page.locator('.ka-po-ln').count();
  check('reorder: name ends with (สั่งซ้ำ), lines copied', name.endsWith('(สั่งซ้ำ)') && lineCount >= 1, `${name} · ${lineCount} lines`);
  await shot('flow-reorder-1440');
  await page.fill('#po-name', `${TAG} สั่งซ้ำ`);
  const id = await saveAndOpen();
  const copy = (await apiGet(`/purchase-order/${id}`)).data;
  const source = (await apiGet(`/purchase-order/${completedId}`)).data;
  check('reorder: same supplier, VAT and materials', copy.supplier_id === source.supplier_id && copy.vat_type === source.vat_type && copy.purchaseOrderLists.length === source.purchaseOrderLists.length);
}

// ---------- Flow 6: delete the edited pending order from its ⋯ menu ----------
await page.goto(`${base}/admin/purchase-orders/${created.include.id}`);
await settle(1000);
await page.getByRole('button', { name: `ตัวเลือกเพิ่มเติมของ ${created.include.code}` }).click();
await page.getByRole('menuitem', { name: 'ลบ' }).click();
await page.getByRole('dialog').getByRole('button', { name: 'ลบใบสั่งซื้อ' }).click();
await page.waitForURL(/\/admin\/purchase-orders$/, { timeout: 60000 });
await settle(800);
const gone = await page.request.get(`${api}/purchase-order/${created.include.id}`, { headers: { Authorization: `Bearer ${await token()}` } });
const goneBody = await gone.json().catch(() => ({}));
check('delete: order no longer returned', !goneBody?.data, `HTTP ${gone.status()}`);

// ---------- Leave guard: back button with unsaved edits asks ----------
await page.goto(`${base}/admin/purchase-orders`);
await settle(600);
await page.goto(`${base}/admin/purchase-orders/new`);
await settle(1200);
await page.fill('#po-name', 'ยังไม่บันทึก');
await page.goBack();
await page.waitForTimeout(600);
check('leave guard: back asks first', await page.getByRole('dialog').getByText('ยังไม่ได้บันทึกการแก้ไข').isVisible(), page.url());
await page.getByRole('button', { name: 'แก้ไขต่อ' }).click();
check('leave guard: stay keeps the text', (await page.inputValue('#po-name')) === 'ยังไม่บันทึก');
await page.locator('.ka-crumb__back').click();
await page.waitForTimeout(400);
check('leave guard: header crumb asks first', await page.getByRole('dialog').getByText('ยังไม่ได้บันทึกการแก้ไข').isVisible());
await page.getByRole('button', { name: 'ทิ้งการแก้ไข' }).click();
await page.waitForURL(/\/admin\/purchase-orders$/, { timeout: 30000 });
check('leave guard: discard leaves', page.url().endsWith('/admin/purchase-orders'));

// ---------- Keyboard only: the create form ----------
await page.goto(`${base}/admin/purchase-orders/new`);
await settle(1200);
await page.locator('#po-name').waitFor();
// The dev server's own overlay can take focus while it loads; start once the name field holds it.
for (let attempt = 0; attempt < 10 && (await page.evaluate(() => document.activeElement?.id)) !== 'po-name'; attempt += 1) {
  await page.waitForTimeout(500);
  await page.locator('#po-name').click();
}
const walk = [];
for (let step = 0; step < 14; step += 1) {
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    const style = getComputedStyle(el);
    return { tag: el.tagName, label: el.getAttribute('aria-label') || el.id || el.textContent?.trim().slice(0, 24), outline: `${style.outlineStyle} ${style.outlineWidth}`, shadow: style.boxShadow !== 'none' };
  });
  // NEXTJS-PORTAL is the dev server's tool button, absent from a production build.
  // BODY is the end of the page, where Tab passes to the browser before wrapping to the sidebar.
  if (info.tag !== 'NEXTJS-PORTAL' && info.tag !== 'BODY') walk.push(info);
  await page.keyboard.press('Tab');
}
notes.keyboardWalk = walk;
check('keyboard: every stop shows focus (outline or ring)', walk.every((stop) => stop.outline.startsWith('solid') || stop.shadow), JSON.stringify(walk.filter((stop) => !(stop.outline.startsWith('solid') || stop.shadow))));
await page.locator('#po-vat-none').focus();
await page.keyboard.press('ArrowRight');
check('keyboard: arrow moves the VAT choice', (await page.locator('#po-vat-include').getAttribute('aria-checked')) === 'true' && (await page.evaluate(() => document.activeElement?.id)) === 'po-vat-include');
await page.keyboard.press('End');
check('keyboard: End picks the last VAT choice', (await page.locator('#po-vat-exclude').getAttribute('aria-checked')) === 'true');
await page.getByRole('button', { name: 'เพิ่มรายการวัตถุดิบ' }).focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
check('keyboard: new line focuses its material', (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'วัตถุดิบ รายการที่ 2');
await page.goto(`${base}/admin/purchase-orders`);
await settle(1000);
await page.getByRole('tab', { selected: true }).focus();
await page.keyboard.press('ArrowRight');
await settle(800);
check('keyboard: arrow moves the status tab', new URL(page.url()).searchParams.get('tab') !== null, page.url());

// ---------- 320px with 80-character names ----------
const LONG_NAME = 'สั่งวัตถุดิบล็อตใหญ่สำหรับงานแก้วเก็บความเย็นและฝาปิดใสหลายขนาดรอบเดือนพฤศจิกายน'.padEnd(80, 'ก').slice(0, 80);
const LONG_SUPPLIER = 'บริษัท ไทยสตีลซัพพลายแอนด์แพคเกจจิ้งอินเตอร์เนชั่นแนลเทรดดิ้งคอร์ปอเรชั่น จำกัด'.padEnd(80, 'ข').slice(0, 80);
const lengthen = (order) => ({ ...order, purchase_order_name: LONG_NAME, supplier: { ...(order.supplier ?? {}), supplier_name: LONG_SUPPLIER } });
await page.route(LIST_API, async (route) => {
  const response = await route.fetch();
  const json = await response.json();
  json.data = (json.data ?? []).map(lengthen);
  await route.fulfill({ response, json });
});
await page.route(/\/purchase-order\/[0-9a-f-]{36}$/, async (route) => {
  const response = await route.fetch();
  const json = await response.json();
  if (json.data) json.data = lengthen(json.data);
  await route.fulfill({ response, json });
});
await page.setViewportSize({ width: 320, height: 720 });
for (const [label, path] of [
  ['list', '/admin/purchase-orders'],
  ['detail', `/admin/purchase-orders/${created.exclude.id}`],
  ['form', `/admin/purchase-orders/${created.exclude.id}/edit`],
  ['form-new', '/admin/purchase-orders/new'],
]) {
  await page.goto(`${base}${path}`);
  await settle(1200);
  const overflow = await page.evaluate(() => {
    const main = document.querySelector('main');
    const limit = main.getBoundingClientRect().right + 1;
    const wide = [...main.querySelectorAll('*')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= limit) return false;
        // Content scrolled inside its own box (a table in its card) is fine.
        let parent = el.parentElement;
        while (parent && parent !== main) {
          const style = getComputedStyle(parent);
          if (/(auto|scroll|hidden)/.test(style.overflowX) && parent.getBoundingClientRect().right <= limit) return false;
          parent = parent.parentElement;
        }
        return true;
      })
      .slice(0, 5)
      .map((el) => `${el.tagName}.${String(el.className).slice(0, 40)}`);
    return { docScroll: document.documentElement.scrollWidth, mainScroll: main.scrollWidth, mainWidth: main.clientWidth, wide };
  });
  await shot(`overflow-320-${label}`);
  check(`320px ${label}: nothing past the screen`, overflow.docScroll <= 320 && overflow.mainScroll <= overflow.mainWidth + 1 && overflow.wide.length === 0, JSON.stringify(overflow));
}
await page.unrouteAll({ behavior: 'ignoreErrors' });

// ---------- Clean up every order this run created ----------
for (const id of createdIds) {
  const response = await apiDelete(`/purchase-order/${id}`);
  notes[`cleanup_${id}`] = response.status();
}
const left = ((await apiGet(`/purchase-order?page=1&limit=50&search=${encodeURIComponent(TAG)}`)).data ?? []).length;
check('cleanup: no test orders left', left === 0, `${left} left`);
check('no page errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

writeFileSync(join(out, 'results.json'), `${JSON.stringify({ results, notes }, null, 2)}\n`);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
// The proxy servers keep the event loop alive.
process.exit(failed ? 1 : 0);
