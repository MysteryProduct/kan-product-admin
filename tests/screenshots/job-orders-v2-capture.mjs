// Production page v2 (TASK-0323): screenshots at 390/834/1440px, the status flow with its dialogs and
// toasts, a keyboard-only walk, the ?view= / stored view order, filters against the pill counts, overflow
// with long text at 320–1440px, the load-error banner, reduced motion and the contrast of status labels.
// The job list, a job and status changes are answered by an in-memory fixture (page.route), so nothing is
// written to a database; everything else (sign-in, permissions) is the development stack. The browser
// clock is fixed at 31 Oct 2026 10:00 Bangkok time, the day the artboard shows, and at 10 Nov 2026 for
// the overflow run, so "เลย 12 วัน · 29 ต.ค." appears on a card.
// Signs in with the demo_audit account whose password the API seed script sets
// (kan-product-api/scripts/seed-demo-audit-user.cjs).
//
//   node tests/screenshots/job-orders-v2-capture.mjs [baseUrl]
//
// Needs the `playwright` package and Chromium, installed outside this repo; set PLAYWRIGHT_DIR to the
// folder whose node_modules holds it and SEED_FILE when the API checkout is not beside this one.
// PROXY=1 forwards localhost:3011 (the page) and :3010 (the API) to host.docker.internal for a run
// inside the Playwright container. Screenshots and results.json go to tests/screenshots/job-orders-v2/.
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
  forward(3011);
  forward(3010);
}

const base = process.argv[2] ?? 'http://localhost:3011';
const PAGE = '/admin/job-orders';
const out = join(here, 'job-orders-v2');
mkdirSync(out, { recursive: true });

const seedFile = process.env.SEED_FILE ?? join(here, '../../../kan-product-api/scripts/seed-demo-audit-user.cjs');
const password = readFileSync(seedFile, 'utf8').match(/bcrypt\.hash\('([^']+)'/)?.[1];
if (!password) throw new Error('seed password not found');

const WIDTHS = [390, 834, 1440];
const heightOf = (width) => (width < 640 ? 844 : width < 1024 ? 1112 : 1000);
const TODAY = new Date('2026-10-31T10:00:00+07:00');
const LATER = new Date('2026-11-10T10:00:00+07:00');
const results = [];
const notes = {};
const requests = [];
const check = (name, ok, note = '') => {
  results.push({ name, ok: Boolean(ok), note });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ` — ${note}` : ''}`);
};

// ---------- Fixture: the jobs of the artboard's month, with fixture codes ----------
const employee = (name) => ({ employee_id: `emp-${name}`, employee_firstname: name });
const job = (id, code, name, type, qty, target, status, extra = {}) => ({
  job_order_id: id,
  job_order_code: code,
  job_order_name: name,
  job_order_type: type,
  job_order_qty: qty,
  job_order_defect_qty: 0,
  target_date: target,
  job_order_status: status,
  employee_id: 'emp-suwan',
  employee: employee('suwan'),
  jobOrderMaterials: [],
  ...extra,
});
const BASE_JOBS = () => [
  job('f1', 'JO202610160001', 'test', 'purchase', 4, '2026-10-16', 'completed'),
  job('f2', 'JO202610160002', 'แก้วเก็บความเย็น Kan 20 ออนซ์', 'website', 1, '2026-10-16', 'completed', { size: { size_id: 1, size_name: '20 ออนซ์' }, color: { color_id: 1, color_name: 'กรมท่า' } }),
  job('f3', 'JO202610310001', 'แก้วมีหูจับพร้อมหลอด', 'website', 20, '2026-10-31', 'pending', { size: { size_id: 2, size_name: '40 ออนซ์' }, color: { color_id: 2, color_name: 'เทา' } }),
  job('f4', 'JO202610290001', 'กระบอกน้ำสแตนเลส ฝาหูหิ้ว', 'purchase', 12, '2026-10-29', 'in_progress', { color: { color_id: 3, color_name: 'ดำ' } }),
  job('f5', 'JO202611040001', 'แก้วเก็บความเย็น 350 ml. Size:350 ml Color:ดำ', 'custom', 6, '2026-11-04', 'pending'),
];
const LONG_NAME = 'แก้วเก็บความเย็นสแตนเลสสองชั้นพร้อมฝาปิดสไลด์และหลอดซิลิโคนสำหรับงานสกรีนโลโก้ลูกค้า'.slice(0, 80);
const LONG_PERSON = 'สุวรรณภูมิ ศรีประเสริฐวงศ์กุลชัย'.padEnd(30, 'ก').slice(0, 30);
const LONG_JOBS = () => [
  job('l1', 'JO202610290009', LONG_NAME, 'purchase', 1200, '2026-10-29', 'in_progress', { employee: { employee_id: 'emp-long', employee_fullname: LONG_PERSON }, employee_id: 'emp-long', size: { size_id: 9, size_name: '30 ออนซ์ (887 มล.)' }, color: { color_id: 9, color_name: 'เขียวมิ้นต์พาสเทล' } }),
  job('l2', 'JO202611100009', LONG_NAME, 'website', 35, '2026-11-10', 'pending', { employee: { employee_id: 'emp-long', employee_fullname: LONG_PERSON }, employee_id: 'emp-long' }),
  job('l3', 'JO202611120009', LONG_NAME, 'custom', 8, '2026-11-12', 'pending', { employee: undefined, employee_id: undefined }),
  job('l4', 'JO202611050009', LONG_NAME, 'website', 50, '2026-11-05', 'completed', { employee: { employee_id: 'emp-long', employee_fullname: LONG_PERSON }, employee_id: 'emp-long' }),
  job('l5', 'JO202611060009', LONG_NAME, 'purchase', 2, '2026-11-06', 'cancelled'),
];

let jobs = BASE_JOBS();
let listMode = 'normal'; // 'normal' | 'empty' | 'error' | 'slow'
const LIST_API = /\/job-order\?/;
const ONE_API = /\/job-order\/[^/?]+(\/status)?$/;

async function installFixture(page) {
  await page.route(LIST_API, async (route) => {
    if (listMode === 'error') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'fixture: server error' }) });
    if (listMode === 'slow') await new Promise((resolve) => setTimeout(resolve, 4000));
    const data = listMode === 'empty' ? [] : jobs;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, meta: { total: data.length, page: 1, last_page: 1, limit: 300 } }) });
  });
  await page.route(ONE_API, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const id = path.split('/')[2];
    const found = jobs.find((item) => item.job_order_id === id);
    if (!found) return route.fallback();
    if (request.method() === 'PATCH' && path.endsWith('/status')) {
      const body = JSON.parse(request.postData() ?? '{}');
      Object.assign(found, { job_order_status: body.job_order_status }, typeof body.job_order_qty === 'number' ? { job_order_qty: body.job_order_qty } : {});
      requests.push({ method: 'PATCH', path, status: 200, body });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: found }) });
    }
    if (request.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(found) });
    return route.fallback();
  });
}

const browser = await chromium.launch();
const stateFile = process.env.STATE;
let savedState;
try {
  savedState = stateFile ? JSON.parse(readFileSync(stateFile, 'utf8')) : undefined;
} catch {
  savedState = undefined;
}
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', locale: 'th-TH', timezoneId: 'Asia/Bangkok', storageState: savedState });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(`${error} · after "${results.at(-1)?.name ?? 'start'}" · ${(error.stack ?? '').split('\n').slice(1, 3).join(' ').trim()}`));
const inFlight = new Set();
page.on('request', (request) => request.resourceType() === 'xhr' || request.resourceType() === 'fetch' ? inFlight.add(new URL(request.url()).pathname) : null);
page.on('requestfinished', (request) => inFlight.delete(new URL(request.url()).pathname));
page.on('requestfailed', (request) => inFlight.delete(new URL(request.url()).pathname));

// Signed in on the real clock, so the session cookie's expiry is not set from the fixed date.
if (!savedState) {
  await page.goto(`${base}/login`);
  await page.waitForSelector('#username', { timeout: 120000 });
  await page.fill('#username', 'demo_audit');
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/admin/, { timeout: 120000, waitUntil: 'commit' });
  await page.waitForTimeout(1500);
  if (stateFile) writeFileSync(stateFile, JSON.stringify(await context.storageState()));
} else {
  await page.goto(`${base}/admin`, { waitUntil: 'commit' });
}
await page.evaluate(() => {
  localStorage.setItem('theme', 'light');
  localStorage.removeItem('ka.jobOrders.view');
});
await context.clock.setFixedTime(TODAY);
await installFixture(page);

const settle = async (ms = 600) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
};
// The admin shell scrolls inside <main>, so a full-page shot grows the viewport to the content first.
async function fullShot(target, path, full = true) {
  const size = target.viewportSize();
  const extra = full ? await target.evaluate(() => {
    const main = document.querySelector('main');
    return main ? Math.max(0, main.scrollHeight - main.clientHeight) : 0;
  }) : 0;
  if (extra > 0) {
    await target.setViewportSize({ width: size.width, height: size.height + extra });
    await target.waitForTimeout(300);
  }
  await target.screenshot({ path });
  if (extra > 0) await target.setViewportSize(size);
}
const shot = (name, options = {}) => fullShot(page, join(out, `${name}.png`), options.fullPage !== false);
const noSideScroll = () => page.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth);
// The development stack now and then leaves the app shell on "กำลังโหลด…"; one reload is allowed and counted.
const openOn = async (target, query) => {
  // A navigation the dev server aborts (ERR_ABORTED while it recompiles) is retried by the reload below.
  await target.goto(`${base}${PAGE}${query}`).catch((error) => {
    notes.aborted = [...(notes.aborted ?? []), { query, error: error.message.split('\n')[0] }];
  });
  for (let attempt = 1; ; attempt += 1) {
    const opened = await target.locator('.ka-jo .ka-ph__title').waitFor({ timeout: 25000 }).then(() => true, () => false);
    if (opened) return;
    if (attempt > 3) throw new Error(`${query} stayed on the app shell after ${attempt - 1} reloads`);
    notes.reloads = [...(notes.reloads ?? []), { query, attempt, pending: target === page ? [...inFlight] : [] }];
    await target.goto(`${base}${PAGE}${query}`).catch(() => {});
  }
};
const open = async (query = '', ms = 900) => {
  await openOn(page, query);
  await settle(ms);
};
const tabCount = (label) => page.locator('.ka-jo-tab', { hasText: label }).locator('.ka-jo-tab__n').innerText();
const listRows = () => page.locator('.ka-jo-list .ka-jo-row:not(.ka-jo-row--head)').count();

// Warm up the page once (the dev server compiles it on first visit).
await open('', 2000);
check('page loads behind the fixture', (await page.locator('.ka-jo-card').count()) === 5, `${await page.locator('.ka-jo-card').count()} cards`);

// ---------- V3 screenshots: board, list, list-overdue, calendar, calendar-empty-day, empty ----------
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: heightOf(width) });
  jobs = BASE_JOBS();
  await open('?view=board');
  await shot(`board-${width}`);
  check(`board ${width}: no page side-scroll`, await noSideScroll());
  const lead = await page.locator('.ka-ph__lead').innerText();
  check(`board ${width}: header counts (H1)`, lead === '5 งานในช่วงนี้ · เลยกำหนด 1 งาน', lead);
  const columns = await page.locator('.ka-board .ka-col').evaluateAll((cols) => cols.map((col) => ({ top: getComputedStyle(col).borderTopWidth, height: Math.round(col.getBoundingClientRect().height), width: Math.round(col.getBoundingClientRect().width), snap: getComputedStyle(col).scrollSnapAlign })));
  notes[`columns_${width}`] = columns;
  check(`board ${width}: 4 columns with a 3px top bar (B1)`, columns.length === 4 && columns.every((col) => col.top === '3px'), JSON.stringify(columns));
  check(`board ${width}: columns size to their cards (B2)`, new Set(columns.map((col) => col.height)).size > 1, JSON.stringify(columns.map((col) => col.height)));
  if (width === 834) check('board 834: columns ≥280px (B5)', columns.every((col) => col.width >= 280), JSON.stringify(columns.map((col) => col.width)));
  if (width === 390) {
    const boardWidth = await page.locator('.ka-board').evaluate((el) => el.clientWidth);
    check('board 390: columns 86% with scroll-snap (B5)', columns.every((col) => Math.abs(col.width - boardWidth * 0.86) <= 2 && col.snap.includes('start')), `${boardWidth} → ${columns.map((col) => col.width)}`);
  }
  const emptyText = await page.locator('.ka-col').nth(3).locator('.ka-col__empty').innerText().catch(() => '');
  check(`board ${width}: empty column says so (B3)`, emptyText === 'ไม่มีงานที่ยกเลิก', emptyText);
  const order = await page.locator('.ka-col').nth(0).locator('.ka-kc .numeric').first().innerText();
  check(`board ${width}: nearest target first (B4)`, order === 'JO202610310001', order);

  await open('?view=list');
  await shot(`list-${width}`);
  check(`list ${width}: no page side-scroll`, await noSideScroll());
  const groups = await page.locator('.ka-jo-group__head').allInnerTexts();
  check(`list ${width}: four groups, empty one says so (L1)`, groups.length === 4 && (await page.locator('.ka-jo-group__empty').innerText()) === 'ไม่มีงานในสถานะนี้', groups.join(' | '));
  const columnsShown = await page.locator('.ka-jo-row:not(.ka-jo-row--head)').first().evaluate((row) => ['type', 'qty', 'due', 'own', 'act'].filter((part) => {
    const el = row.querySelector(`.ka-jo-row__${part}`);
    return el && getComputedStyle(el).display !== 'none';
  }));
  const expected = width >= 1024 ? ['type', 'qty', 'due', 'own', 'act'] : width >= 640 ? ['type', 'due', 'act'] : ['due', 'act'];
  check(`list ${width}: columns shown (L2–L4)`, JSON.stringify(columnsShown) === JSON.stringify(expected), columnsShown.join(','));
  check(`list ${width}: header row ${width < 640 ? 'hidden' : 'shown'}`, (await page.locator('.ka-jo-row--head').isVisible()) === width >= 640);

  await page.locator('.ka-jo-tab', { hasText: 'เลยกำหนด' }).click();
  await settle(300);
  await shot(`list-overdue-${width}`);
  check(`list-overdue ${width}: only the overdue job, in its status group (L1)`, (await listRows()) === 1 && (await page.locator('.ka-jo-group__head').allInnerTexts()).join('').includes('กำลังผลิต'));

  await open('?view=calendar');
  await shot(`calendar-${width}`);
  check(`calendar ${width}: no page side-scroll`, await noSideScroll());
  const title = await page.locator('.ka-cal__head h2').innerText();
  check(`calendar ${width}: Thai month title (K1)`, title === 'ตุลาคม 2569', title);
  const today = page.locator('.ka-cell[data-today]');
  const todayStyle = await today.evaluate((cell) => ({ cell: getComputedStyle(cell).backgroundColor, dot: getComputedStyle(cell.querySelector('.ka-cell__d')).backgroundColor, shadow: getComputedStyle(cell).boxShadow, height: Math.round(cell.getBoundingClientRect().height) }));
  notes[`calendar_today_${width}`] = todayStyle;
  check(`calendar ${width}: today is a filled number, selected day inset (K2)`, todayStyle.dot !== 'rgba(0, 0, 0, 0)' && todayStyle.shadow.includes('inset'), JSON.stringify(todayStyle));
  check(`calendar ${width}: cell height (K2/K6)`, width < 640 ? Math.abs(todayStyle.height - 52) <= 8 : todayStyle.height >= 88, String(todayStyle.height));
  const panelBox = await page.locator('.ka-cal__day').boundingBox();
  const gridBox = await page.locator('.ka-cal__grid').boundingBox();
  check(`calendar ${width}: panel ${width >= 1024 ? 'beside (340px)' : 'under'} the month (K4/K6)`, width >= 1024 ? Math.abs(panelBox.width - 340) <= 2 && panelBox.x > gridBox.x : panelBox.y > gridBox.y + gridBox.height - 1, JSON.stringify({ panelBox, gridBox }));
  const day16 = await page.locator('.ka-cell[data-day="2026-10-16"]').getAttribute('aria-label');
  check(`calendar ${width}: day button label (K5)`, day16 === '16 ตุลาคม 2 งาน', day16);

  await page.locator('.ka-cell[data-day="2026-10-20"]').click();
  await settle(300);
  await shot(`calendar-empty-day-${width}`);
  const panel = await page.locator('.ka-cal__day').innerText();
  check(`calendar-empty-day ${width}: "ไม่มีงานครบกำหนดวันนี้" and unfinished jobs (K4)`, panel.includes('ไม่มีงานครบกำหนดวันนี้') && panel.includes('งานที่ยังไม่เสร็จ') && (await page.locator('.ka-cal__day .ka-jo-pj').count()) === 3, panel.replace(/\s+/g, ' '));
  if (width === 1440) {
    // "+ เพิ่มงานในวันที่นี้" opens the create drawer with that day; closed again without saving.
    await page.getByRole('button', { name: 'เพิ่มงานในวันที่นี้' }).click();
    await page.locator('#jo-date').waitFor({ timeout: 30000 });
    check('calendar: เพิ่มงานในวันที่นี้ opens the drawer on that day (K4)', (await page.inputValue('#jo-date')) === '2026-10-20', await page.inputValue('#jo-date'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'สร้างงานผลิต' }).first().click();
    await page.locator('#jo-date').waitFor({ timeout: 30000 });
    check('header: สร้างงานผลิต opens the create drawer (H3)', await page.locator('#jo-date').isVisible());
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  listMode = 'empty';
  await open('?view=board');
  await shot(`empty-${width}`);
  check(`empty ${width}: text and create button (E2)`, (await page.locator('.ka-empty strong').innerText()) === 'ยังไม่มีงานผลิตในช่วงนี้' && (await page.locator('.ka-empty').getByRole('button', { name: 'สร้างงานผลิต' }).isVisible()));
  listMode = 'normal';
}

// ---------- Dragging and dark ----------
await page.setViewportSize({ width: 1440, height: 1000 });
await open('?view=board');
const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
const pendingCard = page.locator('.ka-col').nth(0).locator('.ka-jo-card').first();
await pendingCard.dispatchEvent('dragstart', { dataTransfer });
await page.locator('.ka-col').nth(1).dispatchEvent('dragover', { dataTransfer });
await page.waitForTimeout(300);
await shot('board-dragging-1440');
const drop = await page.locator('.ka-col').evaluateAll((cols) => cols.map((col) => ({ drop: col.dataset.drop ?? null, outline: getComputedStyle(col).outlineStyle, border: getComputedStyle(col).borderStyle, opacity: getComputedStyle(col).opacity })));
notes.dragging = drop;
check('dragging: allowed columns dashed, others faded (B3)', drop[1].drop === 'allowed' && drop[3].drop === 'allowed' && drop[2].drop === 'blocked' && Number(drop[2].opacity) < 1, JSON.stringify(drop));
await pendingCard.dispatchEvent('dragend', { dataTransfer });

await page.evaluate(() => localStorage.setItem('theme', 'dark'));
await open('?view=board');
await shot('board-1440-dark');
check('dark: page in the dark theme', await page.evaluate(() => document.documentElement.classList.contains('dark')));

// ---------- A3 contrast in light and dark ----------
const contrast = () =>
  page.evaluate(() => {
    const rgb = (value) => {
      const m = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1];
      return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 };
    };
    const lum = ({ r, g, b }) => {
      const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const backgroundOf = (el) => {
      for (let node = el; node; node = node.parentElement) {
        const bg = rgb(getComputedStyle(node).backgroundColor);
        if (bg.a > 0.5) return bg;
      }
      return { r: 255, g: 255, b: 255 };
    };
    const ratio = (el) => {
      const a = lum(rgb(getComputedStyle(el).color));
      const b = lum(backgroundOf(el));
      return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
    };
    const pick = (selector) => [...document.querySelectorAll(selector)].map((el) => ({ what: `${selector} ${el.dataset.tone ?? ''} ${el.textContent.trim().slice(0, 18)}`, ratio: ratio(el) }));
    return [...pick('.ka-jo-due'), ...pick('.ka-jo-next'), ...pick('.ka-jo-type'), ...pick('.ka-jo-pill'), ...pick('.ka-jo-tab'), ...pick('.ka-jo-tab__n'), ...pick('.ka-col__n'), ...pick('.ka-ev')];
  });
const darkBoard = await contrast();
await open('?view=calendar');
const darkCalendar = await contrast();
await page.evaluate(() => localStorage.setItem('theme', 'light'));
await open('?view=board');
const lightBoard = await contrast();
await open('?view=calendar');
const lightCalendar = await contrast();
for (const [label, list] of [['light', [...lightBoard, ...lightCalendar]], ['dark', [...darkBoard, ...darkCalendar]]]) {
  const low = list.filter((item) => item.ratio < 4.5);
  notes[`contrast_${label}`] = { measured: list.length, min: Math.min(...list.map((item) => item.ratio)), low };
  check(`contrast ${label}: every status label and button ≥4.5:1 (A3)`, list.length > 10 && low.length === 0, `${list.length} measured, min ${notes[`contrast_${label}`].min}${low.length ? ` · ${JSON.stringify(low.slice(0, 4))}` : ''}`);
}

// ---------- V4 status flow: start, finish (quantity dialog), cancel (reason dialog) ----------
jobs = BASE_JOBS();
requests.length = 0;
await open('?view=board');
const toastText = async () => (await page.locator('.ka-toasts').innerText().catch(() => '')).trim();
await page.getByRole('button', { name: 'เริ่มผลิต JO202610310001' }).click();
await settle(500);
check('flow: เริ่มผลิต moves the job to in progress', (await page.locator('.ka-col').nth(1).locator('.ka-jo-card', { hasText: 'JO202610310001' }).count()) === 1);
check('flow: toast after start (C7)', (await toastText()).includes('ย้าย JO202610310001 ไป กำลังผลิต แล้ว'), await toastText());
await page.getByRole('button', { name: 'ผลิตเสร็จ JO202610310001' }).click();
await page.locator('#jo-done-qty').waitFor({ timeout: 10000 });
check('flow: ผลิตเสร็จ opens the quantity dialog first', (await page.inputValue('#jo-done-qty')) === '20' && requests.filter((r) => r.body.job_order_status === 'completed').length === 0);
await shot('flow-complete-dialog-1440', { fullPage: false });
await page.fill('#jo-done-qty', '19');
await page.fill('#jo-defect-qty', '1');
await page.getByRole('dialog').getByRole('button', { name: /ยืนยัน/ }).click();
await settle(600);
check('flow: completed after the dialog', (await page.locator('.ka-col').nth(2).locator('.ka-jo-card', { hasText: 'JO202610310001' }).count()) === 1);
check('flow: toast after finish (C7)', (await toastText()).includes('ย้าย JO202610310001 ไป ผลิตเสร็จแล้ว แล้ว'), await toastText());
await page.getByRole('button', { name: 'จัดการ JO202611040001' }).click();
await page.getByRole('menuitem', { name: 'ยกเลิกงาน' }).click();
await page.locator('#cancel-reason').waitFor({ timeout: 10000 });
check('flow: ยกเลิกงาน opens the reason dialog first', requests.filter((r) => r.body.job_order_status === 'cancelled').length === 0);
await page.locator('#cancel-reason').click();
await page.getByRole('option', { name: 'สร้างงานซ้ำ' }).click();
await shot('flow-cancel-dialog-1440', { fullPage: false });
await page.getByRole('button', { name: 'ยืนยันยกเลิก' }).click();
await settle(800);
check('flow: cancelled after the dialog', (await page.locator('.ka-col').nth(3).locator('.ka-jo-card', { hasText: 'JO202611040001' }).count()) === 1);
// The toast names the status with mapStatusToLabel, whose cancelled label is "ยกเลิกการผลิต".
check('flow: toast after cancel (C7)', (await toastText()).includes('ย้าย JO202611040001 ไป ยกเลิกการผลิต แล้ว'), await toastText());
notes.flowRequests = requests.map(({ method, path, status, body }) => ({ method, path, status, body }));
check('flow: three PATCH …/status calls with the old payload', requests.length === 3 && requests.every((r) => r.method === 'PATCH' && r.path.endsWith('/status') && r.status === 200) && requests[1].body.job_order_qty === 19 && requests[1].body.job_order_defect_qty === 1 && requests[2].body.reason, JSON.stringify(notes.flowRequests));
check('flow: completed/cancelled cards have no next-step button', (await page.locator('.ka-col').nth(2).locator('.ka-jo-next').count()) === 0 && (await page.locator('.ka-col').nth(3).locator('.ka-jo-next').count()) === 0);
// The card body (not a button) opens the job.
await page.locator('.ka-jo-card', { hasText: 'JO202610290001' }).locator('.ka-jo-pills').click();
await page.waitForTimeout(500);
check('card body opens the detail (C6)', await page.getByRole('dialog').isVisible());
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.locator('.ka-jo-tab', { hasText: 'ทั้งหมด' }).click();
await page.locator('.ka-jo-views [role=tab]', { hasText: 'รายการ' }).click();
await settle(300);
await page.locator('.ka-jo-row', { hasText: 'JO202610290001' }).locator('.ka-jo-row__due').click();
await page.waitForTimeout(500);
check('list row opens the detail (L5)', await page.getByRole('dialog').isVisible());
await page.keyboard.press('Escape');

// ---------- V5 keyboard only ----------
jobs = BASE_JOBS();
await open('?view=board');
const focusInfo = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    const style = getComputedStyle(el);
    return { tag: el.tagName, inPage: Boolean(el.closest('.ka-jo')), cls: String(el.className).slice(0, 30), text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30), outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`, border: style.borderColor };
  });
const focusColor = await page.evaluate(() => {
  const probe = document.createElement('span');
  probe.style.color = 'var(--focus)';
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
});
await page.locator('.ka-jo-views [aria-selected=true]').focus();
await page.keyboard.press('ArrowRight');
await settle(300);
check('keyboard: arrow on the view tabs opens the list (H2)', new URL(page.url()).searchParams.get('view') === 'list' && (await page.locator('.ka-jo-list').isVisible()));
const walk = [];
for (let step = 0; step < 24; step += 1) {
  await page.keyboard.press('Tab');
  // Let border/outline transitions finish before reading the focus style.
  await page.waitForTimeout(250);
  const info = await focusInfo();
  // Only this page's controls; Tab past the end reaches the shared sidebar.
  if (info.inPage) walk.push(info);
}
notes.keyboardWalk = walk;
check('keyboard: Tab reaches status tabs, filters, rows and step buttons', walk.some((s) => s.cls.includes('ka-jo-tab')) && walk.some((s) => s.cls.includes('ka-chip')) && walk.some((s) => s.cls.includes('ka-jo-row__title')) && walk.some((s) => s.cls.includes('ka-jo-next')), walk.map((s) => s.cls.split(' ')[0]).join(' → '));
// Text inputs use the shared .ka-input focus (a --focus border and a ring), recorded apart from the outline check.
const unfocused = walk.filter((s) => s.tag !== 'INPUT' && !(s.outline.startsWith('solid 2px') && s.outline.endsWith(focusColor)));
check('keyboard: every button stop shows a 2px --focus outline (A1)', unfocused.length === 0, JSON.stringify(unfocused.slice(0, 4)));
const inputs = walk.filter((s) => s.tag === 'INPUT');
check('keyboard: the search input shows the shared --focus border', inputs.length > 0 && inputs.every((s) => s.border === focusColor), JSON.stringify(inputs));
await page.locator('.ka-jo-tab', { hasText: 'รอดำเนินการ' }).focus();
await page.keyboard.press('Enter');
await settle(200);
check('keyboard: Enter picks a status tab', (await page.locator('.ka-jo-tab[aria-selected=true]').innerText()).includes('รอดำเนินการ'));
await page.getByRole('button', { name: 'เริ่มผลิต JO202610310001' }).focus();
await page.keyboard.press('Enter');
await settle(400);
check('keyboard: Enter on the step button moves the job (A2)', jobs.find((j) => j.job_order_id === 'f3').job_order_status === 'in_progress');
await page.locator('.ka-jo-views [aria-selected=true]').focus();
await page.keyboard.press('ArrowRight');
await settle(400);
await page.locator('.ka-cell[tabindex="0"]').focus();
const startDay = await page.evaluate(() => document.activeElement.dataset.day);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(150);
const afterRight = await page.evaluate(() => document.activeElement.dataset.day);
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(150);
const afterUp = await page.evaluate(() => document.activeElement.dataset.day);
// Each press waits for the focus to follow; crossing into November re-renders the month first.
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(400);
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(400);
const afterDowns = await page.evaluate(() => ({ day: document.activeElement.dataset.day, title: document.querySelector('.ka-cal__head h2').textContent }));
const tabStops = await page.locator('.ka-cell[tabindex="0"]').count();
notes.calendarKeys = { startDay, afterRight, afterUp, afterDowns, tabStops };
check('keyboard: calendar arrows move the day, across months, one tab stop (K5)', startDay === '2026-10-31' && afterRight === '2026-11-01' && afterUp === '2026-10-25' && afterDowns.day === '2026-11-08' && afterDowns.title === 'พฤศจิกายน 2569' && tabStops === 1, JSON.stringify(notes.calendarKeys));
// View order: ?view= > stored > width default.
await open('?view=list');
check('view order: ?view=list opens the list', await page.locator('.ka-jo-list').isVisible());
await page.locator('.ka-jo-views [role=tab]', { hasText: 'ปฏิทิน' }).click();
await page.goto(`${base}${PAGE}`);
await settle(900);
check('view order: without ?view= the stored view opens', await page.locator('.ka-jo-cal').isVisible());
await page.goto(`${base}${PAGE}?view=board`);
await settle(900);
check('view order: ?view= beats the stored view', await page.locator('.ka-board').isVisible());
await page.evaluate(() => localStorage.removeItem('ka.jobOrders.view'));
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}${PAGE}`);
await settle(900);
check('view order: nothing stored, 390px opens the list', await page.locator('.ka-jo-list').isVisible());
await page.evaluate(() => localStorage.removeItem('ka.jobOrders.view'));
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${base}${PAGE}`);
await settle(900);
check('view order: nothing stored, 1440px opens the board', await page.locator('.ka-board').isVisible());
const viewTabs = await page.locator('.ka-jo-views').evaluate((el) => ({ role: el.getAttribute('role'), tabs: [...el.querySelectorAll('[role=tab]')].map((tab) => `${tab.textContent}:${tab.getAttribute('aria-selected')}:${Math.round(tab.getBoundingClientRect().height)}`) }));
check('view switch: tablist of 3 tabs, 34px tall at 1440 (H2)', viewTabs.role === 'tablist' && viewTabs.tabs.length === 3 && viewTabs.tabs.every((tab) => tab.endsWith(':34')), JSON.stringify(viewTabs));

// ---------- V7 filters ----------
jobs = BASE_JOBS();
await open('?view=list');
const tabs = { all: 'ทั้งหมด', late: 'เลยกำหนด', pending: 'รอดำเนินการ', in_progress: 'กำลังผลิต', completed: 'เสร็จแล้ว', cancelled: 'ยกเลิก' };
const tabResults = {};
for (const label of Object.values(tabs)) {
  await page.locator('.ka-jo-tab', { hasText: label }).first().click();
  await settle(200);
  tabResults[label] = { pill: Number(await tabCount(label)), rows: await listRows() };
}
notes.tabCounts = tabResults;
check('filters: each status pill count = rows shown (H5)', Object.values(tabResults).every((item) => item.pill === item.rows) && tabResults['ทั้งหมด'].rows === 5, JSON.stringify(tabResults));
await page.locator('.ka-jo-tab', { hasText: 'ทั้งหมด' }).click();
await page.getByRole('button', { name: /ประเภท/ }).click();
await page.locator('.ka-option', { hasText: 'ขายบน Website' }).click();
await page.keyboard.press('Escape');
await settle(300);
const typeCounts = { all: Number(await tabCount('ทั้งหมด')), rows: await listRows(), completed: Number(await tabCount('เสร็จแล้ว')) };
check('filters: type chip narrows rows and the pill counts', typeCounts.all === 2 && typeCounts.rows === 2 && typeCounts.completed === 1, JSON.stringify(typeCounts));
const chipStyle = await page.getByRole('button', { name: /ประเภท/ }).evaluate((el) => ({ border: getComputedStyle(el).borderColor, bg: getComputedStyle(el).backgroundColor, style: getComputedStyle(el).borderStyle }));
notes.activeChip = chipStyle;
await page.fill('#jo-search', 'ไม่มีงานนี้แน่นอน');
await settle(500);
await shot('nomatch-1440');
const noMatch = await page.locator('.ka-empty').innerText().catch(() => '');
check('filters: no match shows the filters on and a clear button (E3)', noMatch.includes('ไม่พบงานที่ตรงกับตัวกรอง') && noMatch.includes('ค้นหา') && noMatch.includes('ประเภท ขายบน Website'), noMatch.replace(/\s+/g, ' '));
await page.getByRole('button', { name: 'ล้างตัวกรอง' }).click();
await settle(400);
check('filters: ล้างตัวกรอง brings every row back', (await listRows()) === 5 && (await page.inputValue('#jo-search')) === '');
await page.fill('#jo-search', 'JO202610290001');
await settle(400);
check('filters: search by JO number', (await listRows()) === 1);
await page.fill('#jo-search', '');
await open('?view=board');
await page.getByRole('button', { name: 'ดูงานที่เลยกำหนด' }).click();
await settle(400);
check('overdue banner: switches to the list filtered to overdue (H4)', new URL(page.url()).searchParams.get('view') === 'list' && (await page.locator('.ka-jo-tab[aria-selected=true]').innerText()).includes('เลยกำหนด') && (await listRows()) === 1);
jobs = BASE_JOBS().filter((item) => item.job_order_id !== 'f4');
await open('?view=board');
check('overdue banner: hidden when nothing is late, header says so (H1/H4)', (await page.getByRole('button', { name: 'ดูงานที่เลยกำหนด' }).count()) === 0 && (await page.locator('.ka-ph__lead').innerText()).endsWith('ไม่มีงานเลยกำหนด'));
jobs = BASE_JOBS();

// ---------- E1 skeletons, E4 load error ----------
for (const view of ['board', 'list', 'calendar']) {
  listMode = 'slow';
  await page.goto(`${base}${PAGE}?view=${view}`);
  await page.locator('.ka-skel').first().waitFor({ timeout: 15000 }).catch(() => {});
  const skeleton = await page.locator('[aria-busy=true] .ka-skel, .ka-skel').count();
  await shot(`skeleton-${view}-1440`, { fullPage: false });
  check(`skeleton ${view}: placeholder of the open view (E1)`, skeleton > 0 && (await page.locator(view === 'board' ? '.ka-board[aria-busy=true]' : view === 'list' ? '.ka-jo-list[aria-busy=true]' : '.ka-jo-cal[aria-busy=true]').count()) === 1, String(skeleton));
  listMode = 'normal';
  await settle(4500);
}
listMode = 'error';
await open('?view=board', 1200);
await shot('load-error-1440', { fullPage: false });
const banner = await page.locator('[role=alert].ka-banner').innerText().catch(() => '');
check('load error: LoadErrorBanner with retry (E4)', banner.includes('งานผลิต') && (await page.getByRole('button', { name: 'ลองอีกครั้ง' }).isVisible()), banner);
listMode = 'normal';
await page.getByRole('button', { name: 'ลองอีกครั้ง' }).click();
await settle(800);
check('load error: retry loads the jobs', (await page.locator('.ka-jo-card').count()) === 5 && (await page.locator('[role=alert].ka-banner').count()) === 0);

// ---------- A4 reduced motion ----------
const reduced = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', locale: 'th-TH', timezoneId: 'Asia/Bangkok', reducedMotion: 'reduce', storageState: await context.storageState() });
await reduced.clock.setFixedTime(TODAY);
const calm = await reduced.newPage();
await installFixture(calm);
await openOn(calm, '?view=board');
await calm.locator('.ka-jo-card').first().waitFor({ timeout: 60000 });
await calm.locator('.ka-jo-card').first().hover();
await calm.waitForTimeout(400);
const calmCard = await calm.locator('.ka-jo-card').first().evaluate((el) => getComputedStyle(el).transform);
await page.locator('.ka-jo-card').first().hover();
await page.waitForTimeout(400);
const movingCard = await page.locator('.ka-jo-card').first().evaluate((el) => getComputedStyle(el).transform);
notes.reducedMotion = { reduce: calmCard, normal: movingCard };
check('reduced motion: hovered card does not move; without it, it lifts 1px (A4, C6)', calmCard === 'none' && movingCard.includes('-1'), JSON.stringify(notes.reducedMotion));
await reduced.close();

// ---------- V6 overflow at 320/390/834/1440, 10 Nov 2026 ----------
const later = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', locale: 'th-TH', timezoneId: 'Asia/Bangkok', storageState: await context.storageState() });
await later.clock.setFixedTime(LATER);
const wide = await later.newPage();
jobs = LONG_JOBS();
await installFixture(wide);
for (const width of [320, ...WIDTHS]) {
  await wide.setViewportSize({ width, height: heightOf(width) });
  const views = {};
  for (const view of ['board', 'list', 'calendar']) {
    await openOn(wide, `?view=${view}`);
    await wide.waitForLoadState('networkidle').catch(() => {});
    await wide.waitForTimeout(700);
    if (view === 'calendar') await wide.locator('.ka-cell[data-day="2026-11-10"]').click();
    views[view] = await wide.evaluate(() => {
      const over = (selector) => [...document.querySelectorAll(selector)].filter((el) => el.scrollWidth > el.clientWidth).map((el) => `${selector} ${el.scrollWidth}>${el.clientWidth}`);
      return {
        page: `${document.scrollingElement.scrollWidth}<=${window.innerWidth}`,
        pageOk: document.scrollingElement.scrollWidth <= window.innerWidth,
        // Admin layout trap (vault/standards/frontend.md): only <main> scrolls, never the document.
        height: `${document.documentElement.scrollHeight}<=${window.innerHeight}`,
        heightOk: document.documentElement.scrollHeight <= window.innerHeight,
        cards: document.querySelectorAll('.ka-kc').length,
        rows: document.querySelectorAll('.ka-jo-row:not(.ka-jo-row--head)').length,
        over: [...over('.ka-kc'), ...over('.ka-jo-row:not(.ka-jo-row--head)'), ...over('.ka-jo-pj'), ...over('.ka-cal__day')],
        due: [...document.querySelectorAll('.ka-jo-due')].map((el) => el.textContent).filter((text) => text.startsWith('เลย')),
      };
    });
    await fullShot(wide, join(out, view === 'board' ? `overflow-${width}.png` : `overflow-${view}-${width}.png`));
  }
  notes[`overflow_${width}`] = views;
  const bad = Object.entries(views).filter(([, value]) => !value.pageOk || !value.heightOk || value.over.length);
  check(`overflow ${width}: no card, row or page wider than its box (V6)`, bad.length === 0 && views.board.cards === 5 && views.list.rows === 5 && views.board.due.includes('เลย 12 วัน · 29 ต.ค.'), JSON.stringify(bad.length ? bad : { cards: views.board.cards, rows: views.list.rows, due: views.board.due }));
  if (width === 320 || width === 390) {
    await openOn(wide, '?view=board');
    await wide.locator('.ka-jo-card').first().waitFor({ timeout: 60000 });
    const card = await wide.locator('.ka-jo-card', { hasText: 'JO202610290009' }).evaluate((el) => {
      const meta = el.querySelector('.ka-kc__meta').getBoundingClientRect();
      const due = el.querySelector('.ka-jo-due').getBoundingClientRect();
      const who = el.querySelector('.ka-jo-card__who');
      return { dueBelowMeta: due.top >= meta.bottom - 1, whoEllipsis: getComputedStyle(who).textOverflow, whoClipped: who.scrollWidth > who.clientWidth };
    });
    check(`overflow ${width}: due label on its own line, long name ellipsised (C3, C4)`, card.dueBelowMeta && card.whoEllipsis === 'ellipsis', JSON.stringify(card));
  }
}
await later.close();

check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
writeFileSync(join(out, 'results.json'), `${JSON.stringify({ results, notes }, null, 2)}\n`);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
// The proxy servers keep the event loop alive.
process.exit(failed ? 1 : 0);
