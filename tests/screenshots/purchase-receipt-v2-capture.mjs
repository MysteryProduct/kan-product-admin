// Purchase receipts v2 (TASK-0325): screenshots at 390/834/1440px, the owner's receive flow on a
// 200-piece order (balance, order status and material stock recorded at every step), totals for the
// three VAT types against the old calculation, a keyboard-only walk and overflow at 320px.
// Development stack only: signs in with the demo_audit account whose password the API seed script sets
// (kan-product-api/scripts/seed-demo-audit-user.cjs). The orders it creates are named "ทดสอบ TASK-0325 …";
// their receipts and the orders are deleted again at the end.
//
//   node tests/screenshots/purchase-receipt-v2-capture.mjs [baseUrl] [apiUrl]
//
// Needs the `playwright` package and Chromium, installed outside this repo; set PLAYWRIGHT_DIR to the
// folder whose node_modules holds it and SEED_FILE when the API checkout is not beside this one.
// PROXY=1 forwards localhost:3031 (the page) and :3032 (the API, via a CORS-rewriting proxy on the host)
// to host.docker.internal for a run inside the Playwright container.
// STATE=<file> reuses a saved sign-in (and saves one there), since sign-in allows 5 tries per 15 minutes.
// Screenshots and results.json go to tests/screenshots/purchase-receipt-v2/.
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
  forward(3031);
  forward(3032);
}

const base = process.argv[2] ?? 'http://localhost:3031';
const api = (process.argv[3] ?? 'http://localhost:3032').replace(/\/$/, '');
const out = join(here, 'purchase-receipt-v2');
mkdirSync(out, { recursive: true });

const seedFile = process.env.SEED_FILE ?? join(here, '../../../kan-product-api/scripts/seed-demo-audit-user.cjs');
const password = readFileSync(seedFile, 'utf8').match(/bcrypt\.hash\('([^']+)'/)?.[1];
if (!password) throw new Error('seed password not found');

const WIDTHS = [390, 834, 1440];
const TAG = 'ทดสอบ TASK-0325';
const LIST = '/admin/purchase-receipt';
const results = [];
const notes = {};
const flow = [];
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
const money = (text) => Number(String(text).replace(/[฿,\s]/g, ''));

const browser = await chromium.launch();
const statePath = process.env.STATE;
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: 'light',
  locale: 'th-TH',
  storageState: statePath && existsSync(statePath) ? statePath : undefined,
});
let page = await context.newPage();
const consoleErrors = [];
page.on('pageerror', (error) => {
  consoleErrors.push(String(error));
  console.log('PAGEERROR', page.url(), String(error).slice(0, 160));
});
// Reloading or leaving a form with edits raises the browser's "leave site?" prompt; the run leaves.
const leavePrompts = [];
const inFlight = new Map();
page.on('request', (request) => inFlight.set(request, `${request.method()} ${request.url()}`));
page.on('requestfinished', (request) => inFlight.delete(request));
page.on('requestfailed', (request) => inFlight.delete(request));
page.on('dialog', (dialog) => {
  if (dialog.type() === 'beforeunload') leavePrompts.push(page.url());
  void dialog.accept();
});

await page.goto(`${base}/admin/purchase-receipt`, { waitUntil: 'commit' });
await page.waitForTimeout(2500);
if (page.url().includes('/login')) {
  await page.waitForSelector('#username', { timeout: 120000 });
  await page.evaluate(() => localStorage.setItem('theme', 'light'));
  await page.fill('#username', 'demo_audit');
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/admin/, { timeout: 120000, waitUntil: 'commit' });
  await page.waitForTimeout(1500);
  if (statePath) await context.storageState({ path: statePath });
}
// The sign-in as it was at the start, for the fresh browser context of the 320px step.
const initialState = await context.storageState();

const settle = async (ms = 600) => {
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(ms);
};
// The admin shell scrolls inside <main>; let it grow for the shot so the whole page is captured.
const shot = async (name) => {
  const style = await page.addStyleTag({
    content: 'html,body,.h-screen,main{height:auto!important;max-height:none!important;overflow:visible!important}',
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
  await style.evaluate((node) => node.remove());
};
const noSideScroll = () =>
  page.evaluate(() => {
    const main = document.querySelector('main');
    return document.documentElement.scrollWidth <= window.innerWidth + 1 && (!main || main.scrollWidth <= main.clientWidth + 1);
  });
const cookieValue = async (name) => (await context.cookies()).find((cookie) => cookie.name === name)?.value;
const headers = async () => ({ Authorization: `Bearer ${await cookieValue('token')}` });
const apiGet = async (path) => (await page.request.get(`${api}${path}`, { headers: await headers() })).json();
const apiPost = async (path, data) => page.request.post(`${api}${path}`, { headers: await headers(), data });
const apiDelete = async (path) => page.request.delete(`${api}${path}`, { headers: await headers() });
const employeeId = JSON.parse(decodeURIComponent((await cookieValue('user')) ?? '{}')).employee_id;

await settle(1500);

// ---------- Clean up anything an earlier, interrupted run left ----------
async function removeOrder(orderId) {
  const receipts = (await apiGet(`/purchase-receipt?page=1&limit=100`)).data ?? [];
  for (const receipt of receipts.filter((item) => item.purchase_order_id === orderId)) {
    notes[`cleanup_receipt_${receipt.purchase_receipt_code}`] = (await apiDelete(`/purchase-receipt/${receipt.purchase_receipt_id}`)).status();
  }
  let status = (await apiDelete(`/purchase-order/${orderId}`)).status();
  if (status >= 400) {
    // An approved order may not be deletable; cancel it first, then delete.
    await apiPost(`/purchase-order/${orderId}/reject`, { reason: `${TAG} cleanup` });
    status = (await apiDelete(`/purchase-order/${orderId}`)).status();
  }
  return status;
}
for (const stale of (await apiGet(`/purchase-order?page=1&limit=50&search=${encodeURIComponent(TAG)}`)).data ?? []) {
  notes[`stale_${stale.purchase_order_code}`] = await removeOrder(stale.purchase_order_id);
}

// ---------- Fixtures: a VAT-registered supplier, one material with a unit, two approved orders ----------
const suppliers = (await apiGet('/supplier/?page=1&limit=100')).data ?? [];
const supplier = suppliers.find((item) => item.is_vat_register) ?? suppliers[0];
const material = ((await apiGet('/materials?page=1&limit=100')).data ?? [])[0];
const unit = ((await apiGet('/product-unit?search=')).data ?? [])[0];
if (!supplier?.is_vat_register || !material || !unit || !employeeId) throw new Error('fixtures missing: VAT-registered supplier, material, unit, employee');
notes.fixtures = { supplier: supplier.supplier_name, material: material.material_name, unit: unit.product_unit_name };

async function createApprovedOrder(name, qty, price, vatType, approve = true) {
  const amount = qty * price;
  const sums = oldVatSummary(amount, vatType);
  const created = await apiPost('/purchase-order', {
    purchase_order_name: name,
    purchase_order_detail: 'ใบสั่งซื้อทดสอบหน้าใบรับสินค้า',
    supplier_id: supplier.supplier_id,
    vat_type: vatType,
    purchase_order_subtotal: sums.subtotal,
    purchase_order_vat_amount: sums.vat,
    create_by: employeeId,
    purchase_order_total: sums.total,
    purchaseOrderLists: [
      { material_id: material.material_id, purchase_order_list_qty: qty, purchase_order_list_price: price, purchase_order_list_total: amount, product_unit_id: unit.product_unit_id },
    ],
  });
  const body = await created.json();
  const order = body.data ?? body;
  if (!order?.purchase_order_id) throw new Error(`order not created: ${created.status()} ${JSON.stringify(body).slice(0, 200)}`);
  if (!approve) return order.purchase_order_id;
  const approved = await apiPost(`/purchase-order/${order.purchase_order_id}/approve`, { status: 'active', update_by: employeeId });
  if (approved.status() >= 400) throw new Error(`order not approved: ${approved.status()}`);
  return order.purchase_order_id;
}
const orderIds = [];
const flowOrder = await createApprovedOrder(`${TAG} รับ 200 ชิ้น`, 200, 10, 'exclude');
orderIds.push(flowOrder);
const vatOrder = await createApprovedOrder(`${TAG} สามแบบ VAT`, 30, 123.45, 'exclude');
orderIds.push(vatOrder);
// Review F1: an order saved without VAT keeps vat_rate 0, which the API applies to its receipts.
const noVatOrder = await createApprovedOrder(`${TAG} ใบสั่งซื้อไม่คิด VAT`, 5, 123.45, 'none');
orderIds.push(noVatOrder);
// Review F6: an order still waiting for approval.
const pendingOrder = await createApprovedOrder(`${TAG} รออนุมัติ`, 5, 10, 'exclude', false);
orderIds.push(pendingOrder);

const orderState = async (orderId) => {
  const order = (await apiGet(`/purchase-order/${orderId}`)).data;
  const line = order.purchaseOrderLists?.[0];
  return { po: order.purchase_order_code, status: order.purchase_order_status, balance: Number(line?.purchase_order_list_balance_qty), ordered: Number(line?.purchase_order_list_qty) };
};
const stock = async () => {
  const rows = await apiGet(`/stock-materials/material/${material.material_id}`);
  return (Array.isArray(rows) ? rows : rows.data ?? []).reduce((sum, row) => sum + Number(row.stock_material_remain_qty || 0), 0);
};
const receiptState = async (id) => (await apiGet(`/purchase-receipt/${id}`)).data;
const record = async (step, receiptId) => {
  const state = await orderState(flowOrder);
  const entry = { step, ...state, stock: await stock(), receipt: receiptId ? (await receiptState(receiptId))?.purchase_receipt_status : undefined };
  flow.push(entry);
  console.log('FLOW', JSON.stringify(entry));
  return entry;
};

const bodies = [];
page.on('request', (request) => {
  const path = new URL(request.url()).pathname;
  if (request.method() !== 'GET' && /\/purchase-receipt(\/[0-9a-f-]{36})?$/.test(path)) {
    try {
      bodies.push({ method: request.method(), path, body: JSON.parse(request.postData() ?? 'null') });
    } catch {
      // not JSON
    }
  }
});

const qtyInput = () => page.locator('.ka-pr-step input').first();
const saveButton = () => page.locator('.ka-po-sum__acts button[type=submit]');
const outcomeText = () => page.locator('#pr-outcome').innerText();
// Under `next dev` a Fast Refresh full reload can leave a load on the shell's "กำลังโหลด…"; run against
// `next start`. A page that has not appeared after 20 s is reloaded (counted in results.json).
const stuckReloads = [];
const waitForPage = async (selector) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.waitForSelector(selector, { timeout: attempt === 2 ? 90000 : 20000 });
      return;
    } catch (error) {
      if (attempt === 2) {
        await page.screenshot({ path: join(out, 'debug-open-form.png') });
        console.log('DEBUG', page.url(), JSON.stringify([...inFlight.values()].slice(-12)), JSON.stringify(consoleErrors.slice(-5)));
        console.log('DEBUG storage', await page.evaluate(async (apiBase) => {
          const token = document.cookie.split('; ').find((c) => c.startsWith('token='))?.slice(6) ?? '';
          let status = 'none';
          try {
            const r = await Promise.race([fetch(`${apiBase}/auth/status`, { headers: { Authorization: `Bearer ${decodeURIComponent(token)}` } }), new Promise((_, no) => setTimeout(() => no(new Error('timeout 8s')), 8000))]);
            status = `${r.status}`;
          } catch (e) { status = String(e); }
          return JSON.stringify({ cookies: document.cookie.split('; ').map((c) => c.split('=')[0]), local: Object.keys(localStorage), session: Object.keys(sessionStorage), status });
        }, api));
        throw error;
      }
      stuckReloads.push(page.url());
      await page.reload();
    }
  }
};
const openForm = async (orderId) => {
  await page.goto(`${base}${LIST}/new?po=${orderId}`);
  await waitForPage('.ka-pr-step input');
  await settle(500);
};
const saveAndOpen = async () => {
  await saveButton().click();
  await page.waitForURL(/\/admin\/purchase-receipt\/[0-9a-f-]{36}$/, { timeout: 60000 });
  await page.waitForSelector('.ka-po-big', { timeout: 60000 });
  await settle(800);
  return page.url().split('/').pop();
};
const toastText = async () => page.locator('.ka-toasts').innerText().catch(() => '');
const openMore = async () => {
  await page.getByRole('button', { name: /ตัวเลือกเพิ่มเติมของ/ }).click();
  await page.waitForTimeout(300);
};
const cancelReceipt = async (reason) => {
  await openMore();
  await page.getByRole('menuitem', { name: 'ยกเลิกเอกสาร' }).click();
  const dialog = page.getByRole('dialog');
  const title = await dialog.locator('h2, [id$=title]').first().innerText().catch(() => '');
  await dialog.locator('textarea').fill(reason);
  await dialog.getByRole('button', { name: 'ยืนยันยกเลิก' }).click();
  await page.waitForTimeout(1500);
  await settle(800);
  return title;
};

const OLD_CREATE_KEYS = ['purchase_order_id', 'supplier_id', 'entry_date', 'purchase_receipt_detail', 'vat_type', 'purchase_receipt_subtotal', 'purchase_receipt_vat_amount', 'purchase_receipt_total', 'create_by', 'purchaseReceiptLists'].sort();
const OLD_UPDATE_KEYS = ['purchase_receipt_id', 'purchase_order_id', 'supplier_id', 'entry_date', 'purchase_receipt_detail', 'vat_type', 'purchase_receipt_subtotal', 'purchase_receipt_vat_amount', 'purchase_receipt_total', 'update_by', 'create_by', 'purchaseReceiptLists'].sort();
const OLD_LINE_KEYS = ['material_id', 'purchase_order_list_id', 'purchase_receipt_list_qty', 'purchase_receipt_list_price', 'purchase_receipt_list_total', 'product_unit_id'].sort();
const keysOf = (value) => JSON.stringify(Object.keys(value ?? {}).sort());

// ---------- The owner's flow on a 200-piece order ----------
const start = await record('เริ่ม: PO 200 อนุมัติแล้ว');
check('flow start: order active, balance 200', start.status === 'active' && start.balance === 200, JSON.stringify(start));
const stock0 = start.stock;

// Form screenshots: fresh (every line at 0), partial (120 of 200) and over (201).
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: width < 640 ? 844 : width < 1024 ? 1112 : 1000 });
  await openForm(flowOrder);
  if (width === 1440) {
    check('form: a new receipt starts at 0', (await qtyInput().inputValue()) === '0');
    check('form: empty outcome', (await outcomeText()).includes('ยังไม่ได้ใส่จำนวนที่รับ'));
    const crumb = await page.locator('.ka-header').innerText().catch(() => '');
    check('form: crumb "← ใบรับสินค้า / รับสินค้า {PO}"', crumb.includes('ใบรับสินค้า') && crumb.includes(`รับสินค้า ${start.po}`), crumb.replace(/\s+/g, ' ').slice(0, 120));
    const stepH = await page.locator('.ka-pr-step').first().evaluate((el) => el.getBoundingClientRect().height);
    check('form 1440: stepper 40px', Math.round(stepH) === 40, String(stepH));
  }
  if (width === 390) {
    const stepH = await page.locator('.ka-pr-step').first().evaluate((el) => el.getBoundingClientRect().height);
    const saveH = await page.locator('.ka-po-savebar button[type=submit]').evaluate((el) => el.getBoundingClientRect().height);
    check('form 390: stepper and save 44px', Math.round(stepH) === 44 && Math.round(saveH) >= 44, `${stepH} / ${saveH}`);
    check('form 390: save bar shows, summary buttons hidden', (await page.locator('.ka-po-savebar').isVisible()) && !(await page.locator('.ka-po-sum__acts').isVisible()));
  }
  await shot(`form-${width}`);
  check(`form ${width}: no page side-scroll`, await noSideScroll());
  await qtyInput().fill('120');
  await page.waitForTimeout(200);
  await shot(`form-partial-${width}`);
  await qtyInput().fill('201');
  await page.waitForTimeout(200);
  await shot(`form-over-${width}`);
  // The lines card clips what does not fit, so the page-level check cannot see it.
  const rowFits = await page.locator('.ka-pr-rl').first().evaluate((row) => {
    const card = row.closest('.ka-card').getBoundingClientRect();
    return [...row.querySelectorAll('*')].every((el) => el.getBoundingClientRect().right <= card.right + 1);
  });
  check(`form ${width}: the line row fits its card`, rowFits);
  if (width === 1440) {
    check('form over: error under the field', (await page.locator('.ka-pr-step__foot').first().innerText()).includes('เกินคงเหลือ 1'));
    check('form over: save disabled', await saveButton().isDisabled());
    check('form over: outcome danger', (await outcomeText()).includes('จำนวนรับเกินคงเหลือ แก้ก่อนบันทึก'));
    // Leaving with unsaved quantities asks first.
    await page.locator('.ka-header a', { hasText: 'ใบรับสินค้า' }).first().click();
    await page.waitForTimeout(500);
    check('form: leaving with edits asks first', (await page.getByRole('dialog').innerText().catch(() => '')).includes('ยังไม่ได้บันทึกการแก้ไข'));
    await page.getByRole('button', { name: 'แก้ไขต่อ' }).click();
  }
}
await page.setViewportSize({ width: 1440, height: 1000 });

// 1) Receive 120: pending, balance 80, order partly received, stock unchanged.
await openForm(flowOrder);
await qtyInput().fill('120');
await page.waitForTimeout(200);
check('120: outcome says the order becomes partly received', (await outcomeText()).includes('รับบางส่วน'));
const formTotal120 = money(await page.locator('.ka-po-sum .ka-po-big').innerText());
let before = bodies.length;
const receiptA = await saveAndOpen();
const created120 = bodies.slice(before).find((entry) => entry.method === 'POST')?.body;
check('create: body keys as before', keysOf(created120) === JSON.stringify(OLD_CREATE_KEYS), keysOf(created120));
check('create: line keys as before, one line', created120?.purchaseReceiptLists?.length === 1 && keysOf(created120.purchaseReceiptLists[0]) === JSON.stringify(OLD_LINE_KEYS));
const stepA = await record('บันทึกรับ 120 (pending)', receiptA);
const codeA = (await receiptState(receiptA)).purchase_receipt_code;
check('120 saved: pending, balance 80, order partial, stock unchanged', stepA.receipt === 'pending' && stepA.balance === 80 && stepA.status === 'partial' && stepA.stock === stock0, JSON.stringify(stepA));
check('120 saved: toast names the receipt', (await toastText()).includes(`บันทึกใบรับสินค้า ${codeA} แล้ว`), (await toastText()).trim());
check('120 saved: detail total = form total', money(await page.locator('.ka-po-aside .ka-po-big').innerText()) === formTotal120);
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: width < 640 ? 844 : width < 1024 ? 1112 : 1000 });
  await page.reload();
  await waitForPage('.ka-po-big');
  await settle(800);
  await shot(`detail-pending-${width}`);
  check(`detail pending ${width}: no page side-scroll`, await noSideScroll());
}
await page.setViewportSize({ width: 1440, height: 1000 });
check('detail pending: stock card says it adds on approval', (await page.locator('[aria-labelledby=pr-stock]').innerText()).includes('จะเพิ่มเมื่ออนุมัติ'));

// 2) Approve: stock +120.
await page.getByRole('button', { name: 'อนุมัติ', exact: true }).click();
await page.getByRole('dialog').getByRole('button', { name: 'อนุมัติ', exact: true }).click();
await page.waitForTimeout(1500);
await settle(800);
const stepApprove = await record('อนุมัติใบ 120', receiptA);
check('approve: stock +120, receipt approved', stepApprove.receipt === 'approved' && stepApprove.stock === stock0 + 120, JSON.stringify(stepApprove));
check('approve: toast and page reloaded in place', (await toastText()).includes(`อนุมัติใบรับสินค้า ${codeA} แล้ว`) && (await page.locator('.ka-po-idrow').innerText()).includes('อนุมัติแล้ว'));
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: width < 640 ? 844 : width < 1024 ? 1112 : 1000 });
  await page.reload();
  await waitForPage('.ka-po-big');
  await settle(800);
  await shot(`detail-approved-${width}`);
}
await page.setViewportSize({ width: 1440, height: 1000 });
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(300);
await page.screenshot({ path: join(out, 'print-1440.png'), fullPage: true });
const printHidden = await page.evaluate(() => ['.ka-sidebar', '.ka-header', '.ka-po-noprint'].every((selector) => [...document.querySelectorAll(selector)].every((el) => getComputedStyle(el).display === 'none')));
check('print: sidebar, header and actions hidden', printHidden);
await page.emulateMedia({ media: 'screen' });

// 3) 81 cannot be saved; 80 completes the order.
await openForm(flowOrder);
await qtyInput().fill('81');
await page.waitForTimeout(200);
before = bodies.length;
check('81: save disabled and over error', (await saveButton().isDisabled()) && (await page.locator('.ka-pr-step__foot').first().innerText()).includes('เกินคงเหลือ 1'));
await qtyInput().press('Enter');
await page.waitForTimeout(800);
check('81: nothing sent to the API (Enter in the field too)', bodies.length === before && page.url().includes('/new?po='));
await page.getByRole('button', { name: /^ใส่คงเหลือ/ }).first().click();
check('ใส่คงเหลือ fills 80', (await qtyInput().inputValue()) === '80');
check('80: outcome says the order becomes fully received', (await outcomeText()).includes('รับครบแล้ว') && (await outcomeText()).includes('เมื่ออนุมัติ'));
const receiptB = await saveAndOpen();
const stepB = await record('บันทึกรับ 80 (pending)', receiptB);
check('80 saved: balance 0, order completed, stock unchanged', stepB.balance === 0 && stepB.status === 'completed' && stepB.stock === stock0 + 120, JSON.stringify(stepB));
check('queue: a completed order leaves the queue', !((await apiGet('/purchase-order/advisePurchaseOrders?page=1&limit=100')).data ?? []).some((order) => order.purchase_order_id === flowOrder));

// 4) Edit the pending 80: ceiling = balance 0 + 80 it took.
await page.goto(`${base}${LIST}/${receiptB}/edit`);
await waitForPage('.ka-pr-step input');
await settle(500);
const remainingShown = Number((await page.locator('.ka-pr-c--l b').first().innerText()).replace(/,/g, ''));
check('edit: คงเหลือ = balance 0 + 80 this receipt took', remainingShown === 80 && (await qtyInput().inputValue()) === '80', String(remainingShown));
await qtyInput().fill('81');
await page.waitForTimeout(200);
check('edit: 81 is over the ceiling', await saveButton().isDisabled());
await qtyInput().fill('70');
before = bodies.length;
await saveAndOpen();
const patch = bodies.slice(before).find((entry) => entry.method === 'PATCH')?.body;
check('update: body keys as before', keysOf(patch) === JSON.stringify(OLD_UPDATE_KEYS), keysOf(patch));
const stepEdit = await record('แก้ไขใบ pending เป็น 70', receiptB);
check('edit saved: balance 10, order partial', stepEdit.balance === 10 && stepEdit.status === 'partial', JSON.stringify(stepEdit));

// 5) Cancel the pending receipt: its 70 goes back to the order.
const pendingTitle = await cancelReceipt(`${TAG} ยกเลิกใบ pending`);
const stepCancelPending = await record('ยกเลิกใบ pending', receiptB);
check('cancel pending: balance 80, stock unchanged, rejected', stepCancelPending.balance === 80 && stepCancelPending.stock === stock0 + 120 && stepCancelPending.receipt === 'rejected', JSON.stringify(stepCancelPending));
check('cancel pending: the dialog says the balance goes back', pendingTitle.includes('คืนยอดคงเหลือ'), pendingTitle);
check('cancel pending: banner on the page', (await page.locator('.ka-po-cancelled').innerText()).includes('ใบรับสินค้านี้ถูกยกเลิก'));
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: width < 640 ? 844 : width < 1024 ? 1112 : 1000 });
  await page.reload();
  await waitForPage('.ka-po-big');
  await settle(800);
  await shot(`detail-rejected-${width}`);
}
await page.setViewportSize({ width: 1440, height: 1000 });

// 6) Cancel the approved receipt: balance back and the stock comes out.
await page.goto(`${base}${LIST}/${receiptA}`);
await waitForPage('.ka-po-big');
await settle(800);
const approvedTitle = await cancelReceipt(`${TAG} ยกเลิกใบ approved`);
const stepCancelApproved = await record('ยกเลิกใบ approved', receiptA);
check('cancel approved: balance 200, stock back, order active', stepCancelApproved.balance === 200 && stepCancelApproved.stock === stock0 && stepCancelApproved.status === 'active', JSON.stringify(stepCancelApproved));
check('cancel approved: the dialog says the stock comes out', approvedTitle.includes('ดึงสต็อก'), approvedTitle);

// 7) Delete a pending receipt.
await openForm(flowOrder);
await qtyInput().fill('10');
const receiptC = await saveAndOpen();
await record('บันทึกรับ 10 (pending)', receiptC);
await openMore();
await page.getByRole('menuitem', { name: 'ลบ' }).click();
await page.getByRole('dialog').getByRole('button', { name: 'ลบใบรับสินค้า' }).click();
await page.waitForURL(/\/admin\/purchase-receipt$/, { timeout: 60000 });
await settle(800);
const stepDelete = await record('ลบใบ pending');
const goneC = await page.request.get(`${api}/purchase-receipt/${receiptC}`, { headers: await headers() });
check('delete pending: balance 200, receipt gone', stepDelete.balance === 200 && !(await goneC.json().catch(() => ({}))).data, JSON.stringify(stepDelete));

// ---------- The three VAT types: form, detail and list show the same totals as the old calculation ----------
const LINE_PRICE = 123.45;
const vatReceipts = {};
for (const vat of ['none', 'include', 'exclude']) {
  await openForm(vatOrder);
  await page.locator(`#pr-vat-${vat}`).click();
  await qtyInput().fill('1');
  await page.waitForTimeout(200);
  const expected = oldVatSummary(LINE_PRICE, vat);
  const formTotal = money(await page.locator('.ka-po-sum .ka-po-big').innerText());
  before = bodies.length;
  const id = await saveAndOpen();
  vatReceipts[vat] = id;
  const body = bodies.slice(before).find((entry) => entry.method === 'POST')?.body;
  const detailTotal = money(await page.locator('.ka-po-aside .ka-po-big').innerText());
  const detailSub = money((await page.locator('.ka-po-tot > div').nth(0).locator('dd').innerText()));
  const saved = await receiptState(id);
  await page.goto(`${base}${LIST}?q=${encodeURIComponent(saved.purchase_receipt_code)}`);
  await waitForPage('.ka-pr-lt tbody tr .ka-po-amt');
  await settle(600);
  const listTotal = money(await page.locator('.ka-pr-lt tbody tr', { hasText: saved.purchase_receipt_code }).locator('.ka-po-amt').innerText());
  notes[`vat_${vat}`] = { expected, formTotal, detailTotal, detailSub, listTotal, sent: { subtotal: body?.purchase_receipt_subtotal, vat: body?.purchase_receipt_vat_amount, total: body?.purchase_receipt_total }, stored: { total: Number(saved.purchase_receipt_total), subtotal: Number(saved.purchase_receipt_subtotal), vat: Number(saved.purchase_receipt_vat_amount), vat_type: saved.vat_type, vat_rate: saved.vat_rate } };
  check(`VAT ${vat}: body totals = old calculation`, body?.purchase_receipt_subtotal === expected.subtotal && body?.purchase_receipt_vat_amount === expected.vat && body?.purchase_receipt_total === expected.total, JSON.stringify(notes[`vat_${vat}`].sent));
  check(`VAT ${vat}: form = detail = list = old total`, formTotal === expected.total && detailTotal === expected.total && listTotal === expected.total, JSON.stringify({ formTotal, detailTotal, listTotal, expected: expected.total }));
  check(`VAT ${vat}: detail subtotal = old subtotal`, detailSub === expected.subtotal, `${detailSub} vs ${expected.subtotal}`);
  check(`VAT ${vat}: API saved this VAT and the old VAT amount`, saved.vat_type === vat && Number(saved.purchase_receipt_vat_amount) === expected.vat, JSON.stringify(notes[`vat_${vat}`].stored));
}

// ---------- Review F1: the rate the API saves, on create and on edit ----------
{
  await openForm(noVatOrder);
  await page.locator('#pr-vat-exclude').click();
  await qtyInput().fill('1');
  await page.waitForTimeout(200);
  const formTotal = money(await page.locator('.ka-po-sum .ka-po-big').innerText());
  const hint = await page.locator('#pr-vat-hint').innerText();
  const id = await saveAndOpen();
  vatReceipts.noVatOrder = id;
  const saved = await receiptState(id);
  const detailTotal = money(await page.locator('.ka-po-aside .ka-po-big').innerText());
  notes.f1_create = { formTotal, detailTotal, stored: { total: Number(saved.purchase_receipt_total), vat: Number(saved.purchase_receipt_vat_amount), vat_type: saved.vat_type, vat_rate: saved.vat_rate }, hint };
  check('F1 create: order saved without VAT, "แยก VAT" picked: form = detail = saved (rate 0)', formTotal === 123.45 && detailTotal === 123.45 && Number(saved.purchase_receipt_vat_amount) === 0 && saved.vat_type === 'exclude', JSON.stringify(notes.f1_create));
  check('F1 create: the form says the order keeps VAT 0%', hint.includes('VAT 0%'), hint);

  // A receipt saved "ไม่คิด VAT" under a 7% order, switched to "แยก VAT" on edit: the API uses the order's 7%.
  await page.goto(`${base}${LIST}/${vatReceipts.none}/edit`);
  await waitForPage('.ka-pr-step input');
  await settle(500);
  await page.locator('#pr-vat-exclude').click();
  await page.waitForTimeout(200);
  const editTotal = money(await page.locator('.ka-po-sum .ka-po-big').innerText());
  await saveAndOpen();
  const edited = await receiptState(vatReceipts.none);
  const editDetail = money(await page.locator('.ka-po-aside .ka-po-big').innerText());
  const expected = oldVatSummary(LINE_PRICE, 'exclude');
  notes.f1_edit = { editTotal, editDetail, expected, stored: { vat: Number(edited.purchase_receipt_vat_amount), vat_rate: edited.vat_rate } };
  check('F1 edit: receipt saved without VAT switched to แยก VAT: form = detail = 7% of the order', editTotal === expected.total && editDetail === expected.total && Number(edited.purchase_receipt_vat_amount) === expected.vat, JSON.stringify(notes.f1_edit));
}

// ---------- Review F6: an order the API will not receive against ----------
await page.goto(`${base}${LIST}/new?po=${pendingOrder}`);
await waitForPage('.ka-banner');
await settle(400);
const notReceivable = await page.locator('main').innerText();
check('F6: a pending order shows a note in Thai, no form', notReceivable.includes('รออนุมัติ') && notReceivable.includes('รับสินค้าได้เฉพาะ') && (await page.locator('.ka-pr-step').count()) === 0 && !/active|partial|pending/.test(notReceivable), notReceivable.replace(/\s+/g, ' ').slice(0, 160));

// ---------- List: screenshots, search by order code, the queue's empty state ----------
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: width < 640 ? 844 : width < 1024 ? 1112 : 1000 });
  await page.goto(`${base}${LIST}`);
  await waitForPage('.ka-pr-qc, .ka-po-empty');
  await settle(1000);
  await shot(`list-${width}`);
  check(`list ${width}: no page side-scroll`, await noSideScroll());
}
await page.setViewportSize({ width: 1440, height: 1000 });
const vatCode = (await orderState(vatOrder)).po;
await page.locator('.ka-po-search input').fill(vatCode);
await page.waitForTimeout(1200);
await settle(600);
const rowsForOrder = await page.locator('.ka-pr-lt tbody tr').count();
check('list: searching an order code finds its receipts', rowsForOrder === 3, String(rowsForOrder));
check('list: search went into the URL after the pause', page.url().includes(`q=${encodeURIComponent(vatCode)}`) || page.url().includes(`q=${vatCode}`), page.url());
const queueCard = page.locator('.ka-pr-qc', { hasText: vatCode });
check('queue: partly received order offers "รับส่วนที่เหลือ"', await page.goto(`${base}${LIST}`).then(() => settle(800)).then(() => queueCard.getByRole('link', { name: /รับส่วนที่เหลือ/ }).count()) === 1);
check('queue: progress "รับแล้ว 3 / 30"', (await queueCard.innerText()).includes('3 / 30'), (await queueCard.innerText()).replace(/\s+/g, ' '));
await page.route(/\/purchase-order\/advisePurchaseOrders/, (route) => route.fulfill({ json: { data: [], meta: { total: 0, page: 1, last_page: 0, limit: 6 } } }));
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: width < 640 ? 844 : width < 1024 ? 1112 : 1000 });
  await page.goto(`${base}${LIST}`);
  await waitForPage('.ka-po-empty');
  await settle(800);
  await shot(`list-queue-empty-${width}`);
}
check('queue empty: message and link', (await page.locator('.ka-po-empty').first().innerText()).includes('ไม่มีใบสั่งซื้อที่รอรับสินค้า') && (await page.getByRole('link', { name: 'ไปหน้าใบสั่งซื้อ →' }).count()) === 1);
await page.unrouteAll({ behavior: 'ignoreErrors' });
await page.setViewportSize({ width: 1440, height: 1000 });

// Review F3: a sort by amount follows the totals on screen.
await page.goto(`${base}${LIST}?sort=high`);
await waitForPage('#pr-list-title');
await page.waitForSelector('.ka-pr-lt tbody tr .ka-po-amt', { timeout: 60000 });
await settle(600);
const amounts = (await page.locator('.ka-pr-lt tbody tr .ka-po-amt').allInnerTexts()).map(money);
check('F3: "ยอดมากไปน้อย" is in order of the totals shown', amounts.length > 1 && amounts.every((value, index) => index === 0 || amounts[index - 1] >= value), JSON.stringify(amounts));

// Review F4: the supplier chip lists every supplier.
const supplierTotal = (await apiGet('/supplier/?page=1&limit=1')).meta?.total ?? 0;
await page.locator('.ka-pr-fbar .ka-chip', { hasText: 'ผู้จำหน่าย' }).click();
await page.waitForTimeout(500);
const supplierOptions = await page.locator('.ka-chip-options .ka-option').count();
check('F4: supplier chip lists every supplier', supplierOptions === supplierTotal, `${supplierOptions} of ${supplierTotal}`);
await page.keyboard.press('Escape');

// Review F5: with a search, paging is done here without loading the receipts again.
await page.goto(`${base}${LIST}?q=PR`);
await waitForPage('#pr-list-title');
await page.waitForSelector('.ka-pr-lt tbody tr', { timeout: 60000 });
await settle(800);
const nextPage = page.locator('.ka-po-pager button', { hasText: /^2$/ }).first();
if (await nextPage.count()) {
  let listCalls = 0;
  const count = (request) => {
    if (request.method() === 'GET' && /\/purchase-receipt\?/.test(request.url())) listCalls += 1;
  };
  page.on('request', count);
  await nextPage.click();
  await page.waitForTimeout(1500);
  page.off('request', count);
  check('F5: paging a search does not reload the receipts', listCalls === 0 && page.url().includes('page=2'), `${listCalls} list calls, ${page.url()}`);
} else {
  notes.f5 = 'not-run: fewer than 11 receipts match "PR"';
}

// Review F2: "พิมพ์" in the row menu opens the print dialog once.
await page.goto(`${base}${LIST}`);
await waitForPage('#pr-list-title');
await page.waitForSelector('.ka-pr-lt tbody tr', { timeout: 60000 });
await settle(600);
await page.evaluate(() => {
  window.__prints = 0;
  window.print = () => {
    window.__prints += 1;
  };
});
await page.locator('.ka-pr-lt tbody tr').first().getByRole('button', { name: /ตัวเลือกของ/ }).click();
await page.getByRole('menuitem', { name: 'พิมพ์' }).click();
await page.waitForURL(/\/admin\/purchase-receipt\/[0-9a-f-]{36}$/, { timeout: 60000 });
await page.waitForTimeout(2000);
const prints = await page.evaluate(() => window.__prints);
check('F2: list "พิมพ์" opens the detail and prints once', prints === 1 && !page.url().includes('print='), `${prints} prints, ${page.url()}`);

// /new without ?po= shows the order picker.
await page.goto(`${base}${LIST}/new`);
await waitForPage('#pr-pick');
check('new without ?po: order picker', (await page.locator('#pr-pick').count()) === 1);

// ---------- Keyboard only on the form ----------
await openForm(vatOrder);
// Start on the link before the date, so the date is reached by Tab as a keyboard user reaches it.
await page.locator('.ka-pr-posum__link').focus();
const visited = [];
let invisibleFocus = 0;
for (let i = 0; i < 16; i += 1) {
  await page.keyboard.press('Tab');
  // Focus rings fade in (box-shadow transition); read them once they are drawn.
  await page.waitForTimeout(250);
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    const style = getComputedStyle(el);
    const ring = (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || (style.boxShadow && style.boxShadow !== 'none');
    const within = el.closest('.ka-pr-step');
    const ringWithin = within ? getComputedStyle(within).boxShadow !== 'none' : false;
    return { label: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30) || el.id, ring: ring || ringWithin };
  });
  visited.push(info.label);
  if (!info.ring) {
    invisibleFocus += 1;
    notes.focus_without_ring = [...(notes.focus_without_ring ?? []), info.label];
  }
  if (info.label?.includes('บันทึกใบรับสินค้า')) break;
}
notes.keyboard_order = visited;
const reached = (text) => visited.some((label) => label?.includes(text));
// "−" is disabled while the quantity is 0, so Tab passes it; it is checked again below at 2.
check('keyboard: Tab reaches VAT, note, fill-all, price, quantity, +, ใส่คงเหลือ and save', ['VAT', 'pr-detail', 'รับครบทุกรายการ', 'ราคาต่อ', 'รับครั้งนี้', 'เพิ่มจำนวนรับ', 'ใส่คงเหลือ', 'บันทึกใบรับสินค้า'].every(reached), visited.join(' → '));
check('keyboard: every stop shows a focus ring', invisibleFocus === 0, `${invisibleFocus} without a ring: ${JSON.stringify(notes.focus_without_ring ?? [])}`);
await qtyInput().focus();
await page.keyboard.press('ArrowUp');
await page.keyboard.press('ArrowUp');
await page.keyboard.press('ArrowUp');
await page.keyboard.press('ArrowDown');
check('keyboard: arrow keys step the quantity', (await qtyInput().inputValue()) === '2', await qtyInput().inputValue());
await page.keyboard.press('Shift+Tab');
check('keyboard: "−" is reachable once the quantity is above 0', ((await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) ?? '').startsWith('ลดจำนวนรับ'));
await page.getByRole('button', { name: 'รับครบทุกรายการ' }).focus();
await page.keyboard.press('Space');
check('keyboard: Space on รับครบทุกรายการ fills the balance', (await qtyInput().inputValue()) === '27', await qtyInput().inputValue());
await page.locator('#pr-vat-exclude').focus();
await page.keyboard.press('ArrowLeft');
check('keyboard: arrows move the VAT choice', (await page.locator('#pr-vat-include').getAttribute('aria-checked')) === 'true');
const unnamed = await page.evaluate(() =>
  [...document.querySelectorAll('main button, main a')].filter((el) => !(el.getAttribute('aria-label') || el.textContent?.trim())).length,
);
check('every button and link in the form has a name', unnamed === 0, String(unnamed));
// Leave without the prompt for the next steps.
await page.reload();

// ---------- 320px with long names ----------
// A new browser context with the sign-in from the start, so the long run above does not carry over.
await page.close();
const context320 = await browser.newContext({ viewport: { width: 320, height: 720 }, colorScheme: 'light', locale: 'th-TH', storageState: initialState });
page = await context320.newPage();
page.on('pageerror', (error) => consoleErrors.push(String(error)));
page.on('dialog', (dialog) => void dialog.accept());
const LONG_NAME = 'สั่งวัตถุดิบล็อตใหญ่สำหรับงานแก้วเก็บความเย็นและฝาปิดใสหลายขนาดรอบเดือนพฤศจิกายน'.padEnd(80, 'ก').slice(0, 80);
const LONG_SUPPLIER = 'บริษัท ไทยสตีลซัพพลายแอนด์แพคเกจจิ้งอินเตอร์เนชั่นแนลเทรดดิ้งคอร์ปอเรชั่น จำกัด'.padEnd(80, 'ข').slice(0, 80);
const lengthen = (value) => {
  const next = { ...value, supplier: value.supplier ? { ...value.supplier, supplier_name: LONG_SUPPLIER } : value.supplier };
  if ('purchase_order_name' in next) next.purchase_order_name = LONG_NAME;
  if ('purchase_receipt_detail' in next) next.purchase_receipt_detail = LONG_NAME;
  return next;
};
// API calls only: the page's own chunks also have /purchase-receipt/ in their paths.
await page.route((url) => url.href.startsWith(api) && /\/(purchase-receipt|purchase-order)(\/|\?|$)/.test(url.pathname + url.search), async (route) => {
  if (route.request().method() !== 'GET' || /history/.test(route.request().url())) return route.continue();
  const response = await route.fetch();
  const json = await response.json().catch(() => null);
  if (!json) return route.fulfill({ response });
  if (Array.isArray(json.data)) json.data = json.data.map(lengthen);
  else if (json.data) json.data = lengthen(json.data);
  await route.fulfill({ response, json });
});
await page.setViewportSize({ width: 320, height: 720 });
for (const [label, path, selector] of [
  ['list', LIST, '#pr-list-title'],
  ['form', `${LIST}/new?po=${vatOrder}`, '.ka-pr-step input'],
  ['detail', `${LIST}/${vatReceipts.exclude}`, '.ka-po-big'],
]) {
  await page.goto(`${base}${path}`);
  await waitForPage(selector);
  await settle(1500);
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

// ---------- Clean up: every receipt and order this run created ----------
for (const orderId of orderIds) notes[`cleanup_order_${orderId}`] = await removeOrder(orderId);
const left = ((await apiGet(`/purchase-order?page=1&limit=50&search=${encodeURIComponent(TAG)}`)).data ?? []).length;
check('cleanup: no test orders left', left === 0, `${left} left`);
check('cleanup: stock back to where it started', (await stock()) === stock0, `${await stock()} vs ${stock0}`);
check('no page errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

notes.stuck_shell_reloads = stuckReloads;
notes.leave_prompts_accepted = leavePrompts.length;
writeFileSync(join(out, 'results.json'), `${JSON.stringify({ results, flow, notes }, null, 2)}\n`);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
// The proxy servers keep the event loop alive.
process.exit(failed ? 1 : 0);
