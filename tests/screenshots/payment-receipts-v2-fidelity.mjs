// Payment receipts v2 (TASK-0346 V3): measures the "Receipt Redesign" artboards and the app at the same viewport
// and compares both with the reference table in the Task. An artboard .dc.html is expanded into plain HTML (its
// <sc-for>/<sc-if>/{{holes}} filled from the artboard's own renderVals(), with props.screen passed in) and
// measured with animation off.
//
//   ARTBOARDS=<folder with the .dc.html files and rc.css> OUT_DIR=<outside tests/> \
//     node tests/screenshots/payment-receipts-v2-fidelity.mjs
//
// DESIGN_ONLY=1 measures the artboards alone, which needs no app and no sign-in. The app side signs in for real and
// answers its API calls from a browser-side fixture with the sheets' own lengths of text (V4); it proves layout
// only. Behaviour is checked against the real API by payment-receipts-v2-capture.mjs.
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
const out = process.env.OUT_DIR;
if (!out) throw new Error('OUT_DIR is required, outside tests/: the dev server watches that folder');
mkdirSync(out, { recursive: true });

const VIEWPORTS = { 1440: 1000, 834: 1112, 390: 844 };
const FILES = { 1440: 'Main.dc.html', 834: 'Receipts-md.dc.html', 390: 'Receipts-sm.dc.html' };
const NO_MOTION = '*,*::before,*::after{animation:none!important;transition:none!important}';
// The container has no Consolas: its fallback gives a block of .code a line of 18px where Consolas gives 15px.
const CONSOLAS_LINE = '.code{line-height:15px}';

// Runs inside the page: turns an artboard's source into the HTML its viewer would draw.
const expandArtboard = ({ source, screen, css }) => {
  // The HTML parser throws <sc-for> out of a <tbody> and leaves one empty row, so the loop rides on the <tbody> itself.
  const inTable = source.replace(/<tbody><sc-for list="\{\{(\w+)\}\}" as="(\w+)"[^>]*>/g, '<tbody data-for="$1" data-as="$2">').replace(/<\/sc-for><\/tbody>/g, '</tbody>');
  const doc = new DOMParser().parseFromString(inTable, 'text/html');
  const script = doc.querySelector('script[data-dc-script]')?.textContent ?? '';
  class DCLogic {
    constructor(props) {
      this.props = props ?? {};
      this.state = {};
    }
    setState() {}
  }
  const Component = new Function('DCLogic', `${script}; return Component;`)(DCLogic);
  const vals = new Component({ screen }).renderVals();
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
    if (tag === 'tbody' && node.dataset.for) {
      const row = node.firstElementChild;
      const list = lookup(node.dataset.for, scope) ?? [];
      list.forEach((item, index) => {
        const clone = row.cloneNode(true);
        expand(clone, { ...scope, [node.dataset.as]: item, $index: index });
        node.appendChild(clone);
      });
      row.remove();
      return;
    }
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
      if (!lookup(node.getAttribute('value').replace(/[{}]/g, ''), scope)) {
        node.remove();
        return;
      }
      for (const child of [...node.childNodes]) expand(child, scope);
      node.replaceWith(...node.childNodes);
      return;
    }
    for (const attribute of [...node.attributes]) {
      if (attribute.name.startsWith('hint-') || attribute.name.startsWith('on')) node.removeAttribute(attribute.name);
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
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style>${head}</head><body>${root.innerHTML}</body></html>`;
};

// [screen, section, artboard selector, reference at 1440, 834, 390]; a reference is x, dy, w, h from the Task.
const SECTIONS = [
  ['list', 'ปุ่มสร้าง', '.ph .btn.a', [1244, 16, 164, 40], [638, 16, 164, 40], [16, 64, 358, 44]],
  ['list', 'การ์ดสถิติ 1', '.stats > .stat', [296, 76, 266, 112], [32, 76, 377, 112], [16, 124, 174, 144]],
  ['list', 'การ์ดคิว 1', '.queue .qc', [313, 304, 351, 217], [49, 432, 362, 194], [29, 576, 332, 221]],
  ['list', 'ปุ่มรับชำระ', '.qc .btn.a', [330, 466, 317, 40], [66, 571, 328, 40], [46, 738, 298, 44]],
  ['list', 'แท็บ', '.tabs', [1076, 577, 307, 42], [470, 888, 307, 42], [33, 1321, 324, 52]],
  ['list', 'แถบตัวกรอง', '.fbar', [297, 638, 1110, 65], [33, 949, 768, 65], [17, 1390, 356, 173]],
  ['list', 'ช่องค้นหา', '.fs', [313, 650, 380, 40], [49, 961, 300, 40], [33, 1402, 324, 44]],
  ['list', 'หัวตาราง', '.lt thead tr', [297, 703, 1110, 41], null, null],
  ['list', 'แถว/การ์ดแรก', '.lt tbody tr, .mc', [297, 744, 1110, 62], [33, 1014, 768, 109], [17, 1563, 356, 109]],
  ['list', 'แถบหน้า', '.pager', [297, 805, 1110, 59], [33, 1558, 768, 59], [17, 2107, 356, 59]],
  ['form', 'ตัวเลือกใบสั่งขาย', '#so', [321, 204, 682, 40], [57, 204, 720, 40], [33, 216, 324, 44]],
  ['form', 'กล่องสรุปใบ', '.sosum', [321, 258, 682, 108], [57, 258, 720, 108], [33, 274, 324, 166]],
  ['form', 'radio ประเภท', '.seg', [321, 515, 682, 74], [57, 515, 720, 74], [33, 589, 324, 238]],
  ['form', 'ช่องยอด', '.amt', [321, 635, 682, 52], [57, 635, 720, 52], [33, 873, 324, 52]],
  ['form', 'บัญชีที่รับเงิน', '#acc', [321, 883, 333, 40], [57, 883, 352, 40], [33, 1121, 324, 44]],
  ['form', 'หมายเหตุ', '#rm', [321, 995, 682, 76], [57, 995, 720, 76], [33, 1325, 324, 76]],
  ['form', 'การ์ดสรุป', '.sumc', [1048, 76, 360, 434], [32, 1112, 377, 434], [16, 1442, 358, 330]],
  ['form', 'ปุ่มบันทึก', '.fsave .btn.a', [1073, 401, 310, 40], [57, 1437, 327, 40], null],
  ['form', 'savebar', '.savebar', null, null, [null, null, null, 74]],
  ['detail', 'ปุ่มพิมพ์', '.dact .btn', [1138, -4, 126, 40], [532, -4, 126, 40], [16, 44, 149, 44]],
  ['detail', 'การ์ดยอด', '.hero', [296, 56, 732, 108], [32, 56, 770, 108], [16, 104, 358, 168]],
  ['detail', 'ข้อมูล dl', '.dl', [321, 264, 682, 172], [57, 264, 720, 296], [33, 372, 324, 296]],
  ['detail', 'การ์ดการชำระ', '.aside > .card', [1048, 56, 360, 287], [32, 601, 377, 287], [16, 709, 358, 291]],
  ['edit', 'banner', '.banner', [296, 76, 1112, 54], [32, 76, 770, 54], [16, 68, 358, 102]],
  ['edit', 'กล่องสรุปใบ', '.sosum', [321, 230, 682, 108], [57, 230, 720, 108], [33, 266, 324, 166]],
  ['edit', 'ช่องยอด', '.amt', [321, 607, 682, 52], [57, 607, 720, 52], [33, 865, 324, 52]],
  ['edit', 'การ์ดสรุป', '.sumc', [1048, 150, 360, 428], [32, 1084, 377, 428], [16, 1480, 358, 324]],
];

const measure = (selectors) => {
  const h1 = document.querySelector('h1').getBoundingClientRect();
  const top = h1.y + window.scrollY;
  return {
    h1y: Math.round(top * 10) / 10,
    font: getComputedStyle(document.body).fontFamily,
    boxes: selectors.map((selector) => {
      const element = [...document.querySelectorAll(selector)].find((node) => node.getBoundingClientRect().width > 0);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const round = (value) => Math.round(value * 10) / 10;
      return [round(rect.x), round(rect.y + window.scrollY - top), round(rect.width), round(rect.height)];
    }),
  };
};

const css = readFileSync(join(artboards, 'rc.css'), 'utf8');
// Hinting rounds glyph advances on Linux, which moves text widths and wraps away from the artboard's own numbers.
const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
const designPage = await (await browser.newContext({ colorScheme: 'light', locale: 'th-TH' })).newPage();

const openDesign = async (file, screen, width) => {
  await designPage.setViewportSize({ width, height: VIEWPORTS[width] });
  await designPage.setContent('<!doctype html><html><body></body></html>');
  const html = await designPage.evaluate(expandArtboard, {
    source: readFileSync(join(artboards, file), 'utf8'),
    screen,
    css: file.startsWith('Print') ? '' : css,
  });
  await designPage.setContent(html, { waitUntil: 'load' });
  await designPage.addStyleTag({ content: NO_MOTION + CONSOLAS_LINE });
  await designPage.evaluate(() => document.fonts.ready);
  await designPage.waitForTimeout(400);
};

// ---------- the app side ----------
const SO = (code, name, customer, total, paid, status) => ({
  sale_order_id: `00000000-0000-4000-8000-${code.slice(-12)}`, sale_order_code: code, legacy_code: null, sale_order_name: name,
  sale_order_status: status, sale_order_type: 'order', sale_order_subtotal: String(total), sale_order_total: String(total),
  amount_paid: paid, shipping_address_name: customer, customer_name: customer, saleOrderLists: [],
});
const ORDERS = [
  SO('SO202611030012', 'แก้วเก็บความเย็นสกรีนโลโก้ 120 ใบ', 'ร้านกาแฟบ้านสวน', 36000, 10800, 'partial'),
  SO('SO202611020007', 'ชุดของขวัญปีใหม่ 40 ชุด', 'คุณมานพ ศรีสุข', 18400, 0, 'approved'),
  SO('SO202611010003', 'กระบอกน้ำเลเซอร์โลโก้ 300 ใบ', 'บริษัท สยามเทรดดิ้ง จำกัด', 85500, 42750, 'partial'),
  // R5 shows "ดูทั้งหมด" only past three orders; the sheets always draw it.
  SO('SO202610300001', 'งานเพิ่มเติม', 'คุณมานพ ศรีสุข', 1000, 0, 'approved'),
];
const KBANK = { account_id: '00000000-0000-4000-8000-0000000000a1', account_number: '123-4-54821', account_name: 'บจก. กานต์ โปรดักส์', bank_name: 'กสิกรไทย' };
const SCB = { account_id: '00000000-0000-4000-8000-0000000000a2', account_number: '123-4-50937', account_name: 'บจก. กานต์ โปรดักส์', bank_name: 'ไทยพาณิชย์' };
const RE = (code, order, customer, extra) => ({
  payment_receipt_id: `00000000-0000-4000-8000-${code.slice(-12)}`, sale_order_id: order.sale_order_id, payment_receipt_code: code, legacy_code: null,
  gateway_reference: null, payment_status: 'paid', payment_receipt_remark: '', account_id: null, create_by_name: 'สุวรรณ บ.',
  custom_linked: false, saleOrder: { ...order, customer_name: customer }, shop: { name: 'ร้าน', address: 'ที่อยู่', tax_id: '1', branch_code: '0', phone: '0' }, ...extra,
});
const OTHER = (code, status = 'paid') => SO(code, 'งาน', 'ลูกค้า', 7450, 7450, status);
const RECEIPTS = [
  RE('RE202611040002', ORDERS[0], 'ร้านกาแฟบ้านสวน', { payment_receipt_type: 'deposit', payment_method: 'bank', amount_paid: 10800, payment_date: '2026-11-04T03:42:00.000Z', payment_receipt_remark: 'โอนเข้า 10:42 น. อ้างอิง 6110-2283', account_id: KBANK.account_id, bankAccount: KBANK }),
  RE('RE202611030005', OTHER('SO202611030009'), 'คุณพิมพ์ชนก ทองดี', { payment_receipt_type: 'online_gateway', payment_method: 'promptpay', amount_paid: 1290, payment_date: '2026-11-03T07:05:00.000Z', gateway_reference: 'chrg_5zq81xk2' }),
  RE('RE202611030004', ORDERS[2], 'บริษัท สยามเทรดดิ้ง จำกัด', { payment_receipt_type: 'partial', payment_method: 'cash', amount_paid: 42750, payment_date: '2026-11-03T03:00:00.000Z' }),
  RE('RE202611020011', OTHER('SO202610280004'), 'คุณวรรณา แก้วมณี', { payment_receipt_type: 'refund', payment_method: 'refund', amount_paid: -590, payment_date: '2026-11-02T03:00:00.000Z', payment_status: 'refunded', payment_receipt_remark: 'คืนสินค้า 1 ชิ้น' }),
  RE('RE202611010002', OTHER('SO202610300015'), 'ร้านดอกไม้ริมทาง', { payment_receipt_type: 'full', payment_method: 'bank', amount_paid: 7450, payment_date: '2026-11-01T03:00:00.000Z', account_id: SCB.account_id, bankAccount: SCB }),
];
// The print sheet's stand-ins, as long as the placeholders drawn on `Print`.
RECEIPTS[0].shop = { name: '[ชื่อบริษัทตามข้อมูลร้าน]', address: '[ที่อยู่บริษัท]', tax_id: '[เลข 13 หลัก]', branch_code: null, phone: '[เบอร์ร้าน]' };
RECEIPTS[0].saleOrder = { ...RECEIPTS[0].saleOrder, shipping_address_name: '[ที่อยู่ลูกค้าตามใบสั่งขาย]' };
const SUMMARY = { month: { receipt_count: 14, receipt_today_count: 2, refund_total: 590, refund_count: 1 }, tabs: { all: 5, paid: 4, refund: 1 }, facets: { method: { bank: 8, cash: 4, online: 1 } } };
const ORDER_SUMMARY = { counts: { all: 3 }, pending_total: 0, outstanding_total: 86350, outstanding_count: 3, received_this_month: 62290, received_last_month: 52788 };
const ENTRY = { actor_name: 'สุวรรณ บ.', actor_id: 'a', supplier_names: {}, purchase_order_codes: {}, material_names: {}, product_unit_names: {}, reason: null, previous_value: null, next_value: null, created_at: '2026-11-04T03:48:00.000Z' };
const HISTORY = { data: [{ ...ENTRY, document_history_id: 'h1', action: 'created' }, { ...ENTRY, document_history_id: 'h2', action: 'status_changed' }], meta: { page: 1, last_page: 1 } };

/** Answers the page's API calls; everything else (session, permissions) goes to the real API. */
async function fixture(route) {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true' }, body: JSON.stringify(body) });
  if (request.method() === 'OPTIONS') return route.fallback();
  if (request.method() === 'PATCH' && /payment-receipts/.test(path)) return json({ message: 'ยอดรับชำระเกินยอดคงค้าง' }, 400);
  if (/\/payment-receipts\/summary$/.test(path)) return json(SUMMARY);
  if (/\/payment-receipts\/[^/]+\/history$/.test(path)) return json(HISTORY);
  if (/\/payment-receipts\/[^/]+$/.test(path)) return json(RECEIPTS.find((row) => path.endsWith(row.payment_receipt_id)) ?? RECEIPTS[0]);
  if (/\/payment-receipts$/.test(path)) {
    const order = url.searchParams.get('sale_order_id');
    const data = order ? RECEIPTS.filter((row) => row.sale_order_id === order) : RECEIPTS;
    return json({ data, meta: { total: order ? data.length : 14, page: 1, last_page: order ? 1 : 2, limit: 10 } });
  }
  if (/\/sale-order\/summary$/.test(path)) return json(ORDER_SUMMARY);
  if (/\/sale-order\/[^/]+$/.test(path)) return json(ORDERS.find((row) => path.endsWith(row.sale_order_id)) ?? ORDERS[0]);
  if (/\/sale-order$/.test(path)) return json({ data: ORDERS, meta: { total: 3, page: 1, last_page: 1, limit: 100 } });
  if (/\/bank-accounts?$/.test(path)) return json({ data: [KBANK, SCB], meta: { total: 2, page: 1, last_page: 1, limit: 200 } });
  return route.fallback();
}

const APP = {
  'list|ปุ่มสร้าง': '.ka-pr-ph .ka-pr-btn--a', 'list|การ์ดสถิติ 1': '.ka-pr-stat', 'list|การ์ดคิว 1': '.ka-pr-qc', 'list|ปุ่มรับชำระ': '.ka-pr-qc .ka-pr-btn--a',
  'list|แท็บ': '.ka-pr-chd .ka-pr-tabs', 'list|แถบตัวกรอง': '.ka-pr-fbar', 'list|ช่องค้นหา': '.ka-pr-fs', 'list|หัวตาราง': '.ka-pr-lt thead tr',
  'list|แถว/การ์ดแรก': '.ka-pr-lt tbody tr, .ka-pr-mc', 'list|แถบหน้า': '.ka-pr-pager',
  'form|ตัวเลือกใบสั่งขาย': '#ka-pr-so', 'form|กล่องสรุปใบ': '.ka-pr-sosum', 'form|radio ประเภท': '.ka-pr-seg', 'form|ช่องยอด': '.ka-pr-amt', 'form|บัญชีที่รับเงิน': '#ka-pr-acc',
  'form|หมายเหตุ': '#ka-pr-rm', 'form|การ์ดสรุป': '.ka-pr-aside > .ka-pr-card', 'form|ปุ่มบันทึก': '.ka-pr-fsave .ka-pr-btn--a', 'form|savebar': '.ka-pr-savebar',
  'detail|ปุ่มพิมพ์': '.ka-pr-dact .ka-pr-btn', 'detail|การ์ดยอด': '.ka-pr-hero', 'detail|ข้อมูล dl': '.ka-pr-dl', 'detail|การ์ดการชำระ': '.ka-pr-aside > .ka-pr-card',
  'edit|banner': '.ka-pr-banner', 'edit|กล่องสรุปใบ': '.ka-pr-sosum', 'edit|ช่องยอด': '.ka-pr-amt', 'edit|การ์ดสรุป': '.ka-pr-aside > .ka-pr-card',
};
const receiptId = RECEIPTS[0].payment_receipt_id;
const PATHS = { list: '/admin/payment-receipts', form: `/admin/payment-receipts/new?sale_order=${ORDERS[0].sale_order_id}`, detail: `/admin/payment-receipts/${receiptId}`, edit: `/admin/payment-receipts/${receiptId}/edit` };
const READY = { list: '.ka-pr-pager', form: '.ka-pr-sosum', detail: '.ka-pr-hero', edit: '.ka-pr-sosum' };

let appPage = null;
if (!process.env.DESIGN_ONLY) {
  if (!process.env.AUTH_STATE) throw new Error('AUTH_STATE is required');
  const haveState = existsSync(process.env.AUTH_STATE);
  const appContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', locale: 'th-TH', storageState: haveState ? process.env.AUTH_STATE : undefined });
  appPage = await appContext.newPage();
  if (!haveState) {
    const seedFile = process.env.SEED_FILE ?? join(here, '../../../kan-product-api/scripts/seed-demo-audit-user.cjs');
    const password = readFileSync(seedFile, 'utf8').match(/bcrypt\.hash\('([^']+)'/)?.[1];
    await appPage.goto(`${base}/login`);
    await appPage.waitForSelector('#username', { timeout: 120000 });
    await appPage.evaluate(() => localStorage.setItem('theme', 'light'));
    await appPage.fill('#username', 'demo_audit');
    await appPage.fill('#password', password);
    await appPage.click('button[type=submit]');
    await appPage.waitForURL(/\/admin/, { timeout: 120000, waitUntil: 'commit' });
    await appContext.storageState({ path: process.env.AUTH_STATE });
  }
  await appContext.route(/:3010\//, fixture);
}

/** `Edit` draws a refused save with the amount over and the account empty; the same steps reach it here. */
async function editState(page) {
  await page.waitForFunction(() => document.querySelector('#ka-pr-amt')?.value);
  await page.fill('#ka-pr-amt', '11000');
  await page.locator('.ka-pr-btn--a:visible', { hasText: 'บันทึกการแก้ไข' }).first().click();
  await page.waitForSelector('.ka-pr-banner');
  await page.getByRole('radio', { name: /เงินสด/ }).click();
  await page.getByRole('radio', { name: /โอนผ่านธนาคาร/ }).click();
  await page.fill('#ka-pr-amt', '38,000');
}

const openApp = async (screen, width) => {
  await appPage.setViewportSize({ width, height: VIEWPORTS[width] });
  await appPage.goto(`${base}${PATHS[screen]}`, { waitUntil: 'commit' });
  await appPage.waitForSelector(READY[screen], { timeout: 90000 });
  await appPage.waitForLoadState('networkidle').catch(() => {});
  await appPage.addStyleTag({ content: NO_MOTION });
  if (screen === 'form') await appPage.waitForFunction(() => document.querySelector('#ka-pr-amt')?.value);
  if (screen === 'edit') await editState(appPage);
  await appPage.evaluate(() => document.fonts.ready);
  await appPage.waitForTimeout(500);
};

const lines = [];
const rows = [];
const near = (delta) => delta.every((value) => Math.abs(value) <= 2);
for (const screen of ['list', 'form', 'detail', 'edit']) {
  for (const width of [1440, 834, 390]) {
    const file = screen === 'edit' ? 'Edit.dc.html' : FILES[width];
    await openDesign(file, screen, width);
    const sections = SECTIONS.filter((section) => section[0] === screen);
    const design = await designPage.evaluate(measure, sections.map((section) => section[2]));
    await designPage.screenshot({ path: join(out, `design-${screen}-${width}.png`), fullPage: true });
    let app = null;
    if (appPage) {
      await openApp(screen, width);
      app = await appPage.evaluate(measure, sections.map((section) => APP[`${screen}|${section[1]}`]));
      await appPage.addStyleTag({ content: 'html,body,.h-screen,.overflow-hidden{height:auto!important;overflow:visible!important}main{height:auto!important;overflow-x:hidden!important;overflow-y:visible!important}' });
      await appPage.screenshot({ path: join(out, `app-${screen}-${width}.png`), fullPage: true });
    }
    lines.push(`# ${screen} ${width}: h1 y design ${design.h1y} app ${app?.h1y ?? '—'}`);
    sections.forEach((section, index) => {
      const reference = section[{ 1440: 3, 834: 4, 390: 5 }[width]];
      const d = design.boxes[index];
      const a = app?.boxes[index] ?? null;
      const box = appPage ? a : d;
      const delta = reference && box ? reference.map((value, at) => (value == null ? 0 : Math.round((box[at] - value) * 10) / 10)) : null;
      const outside = Boolean(reference) !== Boolean(box) || (delta ? !near(delta) : false);
      rows.push({ screen, width, name: section[1], reference, design: d, app: a, delta, outside });
      lines.push(`${outside ? 'OUT ' : 'ok  '} ${screen} ${width} ${section[1]} | ref ${reference ?? '—'} | design ${d ?? '—'} | app ${a ?? '—'} | Δ ${delta ?? '—'}`);
    });
  }
}

// The print sheet against the fixed sizes in the Task, with a shop and an address as long as the sheet's placeholders.
const PRINT = [
  ['หัว', '.hd', '.ka-pr-pg__hd', [60, 56, 674, 157]],
  ['กล่องลูกค้า', '.box', '.ka-pr-pg__box', [null, 237, null, null]],
  ['ตาราง', 'table', '.ka-pr-pg table', [null, 361, null, null]],
  ['สรุป', '.tot', '.ka-pr-pg__tot', [434, 493, 300, null]],
  ['ตัวอักษร', '.words', '.ka-pr-pg__words', [null, 605, null, null]],
  ['ลงชื่อ', '.sig', '.ka-pr-pg__sig', [null, 887, null, null]],
  ['ท้ายกระดาษ', '.ft', '.ka-pr-pg__ft', [null, 1034, null, null]],
];
const boxes = (selectors) =>
  selectors.map((selector) => {
    const rect = document.querySelector(selector).getBoundingClientRect();
    return [rect.x, rect.y + window.scrollY, rect.width, rect.height].map((value) => Math.round(value * 10) / 10);
  });
if (appPage) {
  VIEWPORTS[794] = 1123;
  await openDesign('Print.dc.html', undefined, 794);
  const design = await designPage.evaluate(boxes, PRINT.map((row) => row[1]));
  await appPage.setViewportSize({ width: 794, height: 1123 });
  await appPage.goto(`${base}${PATHS.detail}`, { waitUntil: 'commit' });
  await appPage.waitForSelector('.ka-pr-hero');
  await appPage.waitForLoadState('networkidle').catch(() => {});
  await appPage.emulateMedia({ media: 'print' });
  await appPage.waitForTimeout(500);
  const app = await appPage.evaluate(boxes, PRINT.map((row) => row[2]));
  await appPage.screenshot({ path: join(out, 'app-print.png'), fullPage: true });
  await appPage.emulateMedia({ media: 'screen' });
  lines.push('# print 794');
  PRINT.forEach(([name, , , reference], index) => {
    const delta = reference.map((value, at) => (value == null ? 0 : Math.round((app[index][at] - value) * 10) / 10));
    const outside = !near(delta);
    rows.push({ screen: 'print', width: 794, name, reference, design: design[index], app: app[index], delta, outside });
    lines.push(`${outside ? 'OUT ' : 'ok  '} print 794 ${name} | ref ${reference} | design ${design[index]} | app ${app[index]} | Δ ${delta}`);
  });
}

// The sheets with no numbers in the table: drawn whole, to set beside the capture's screenshots (F2).
for (const [file, width] of [['Actions', 1440], ['DetailVariants', 1440], ['States', 1440], ['Sheets-sm', 1830], ['Print', 794]]) {
  VIEWPORTS[width] ??= 1000;
  await openDesign(`${file}.dc.html`, undefined, width);
  await designPage.screenshot({ path: join(out, `design-${file}.png`), fullPage: true });
}

writeFileSync(join(out, 'fidelity.json'), JSON.stringify(rows, null, 2));
writeFileSync(join(out, 'fidelity.txt'), `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
console.log(`rows ${rows.length}, outside ±2px ${rows.filter((row) => row.outside).length}`);
await browser.close();
process.exit(0);
