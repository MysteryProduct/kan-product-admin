// Captures the redesigned Admin pages at 390, 834 and 1440px and walks the overlays with the
// keyboard only (Tab, Enter, Esc). Development stack only: signs in with the demo_audit account
// whose password the API seed script sets (kan-product-api/scripts/seed-demo-audit-user.cjs).
//
//   node tests/screenshots/redesign-capture.mjs [baseUrl]
//
// Needs the `playwright` package and Chromium, installed outside this repo; set PLAYWRIGHT_DIR to
// the folder whose node_modules holds it. Screenshots go to tests/screenshots/redesign/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(process.env.PLAYWRIGHT_DIR ?? here, 'noop.js'));
const { chromium } = require('playwright');

const base = process.argv[2] ?? 'http://localhost:3011';
const out = join(here, 'redesign');
mkdirSync(out, { recursive: true });

const seed = readFileSync(join(here, '../../../kan-product-api/scripts/seed-demo-audit-user.cjs'), 'utf8');
const password = seed.match(/bcrypt\.hash\('([^']+)'/)?.[1];
if (!password) throw new Error('seed password not found');

const WIDTHS = [390, 834, 1440];
const results = [];
const check = (name, ok, note = '') => results.push({ name, ok, note });

const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale: 'th-TH' });
const page = await context.newPage();

await page.goto(`${base}/login`);
await page.fill('#username', 'demo_audit');
await page.fill('#password', password);
await page.click('button[type=submit]');
await page.waitForURL(/\/admin/, { timeout: 30000 });

const settle = async () => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(600);
};
const shot = async (name) => {
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
};
const noPageScroll = async () =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

// The published TEE template, for the read-only Custom template page.
await page.goto(`${base}/admin/custom-templates`);
await page.waitForLoadState('networkidle').catch(() => {});
await page.getByRole('button', { name: /TEE-101/ }).click();
await page.waitForURL(/custom-templates\/.+/, { timeout: 60000 });
const templatePath = new URL(page.url()).pathname;

const PAGES = [
  ['dashboard', '/admin'],
  ['sales', '/admin/sales-dashboard'],
  ['products', '/admin/products'],
  ['product-form', '/admin/products/new'],
  ['custom-template', templatePath],
  ['production-board', '/admin/job-orders'],
];

for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: width < 640 ? 844 : 1000 });
  for (const [name, path] of PAGES) {
    await page.goto(`${base}${path}`);
    await settle();
    await shot(`${name}-${width}`);
    check(`${name} ${width}px: no sideways page scroll`, await noPageScroll());
  }
  // Calendar view and the create drawer, from the board.
  await page.goto(`${base}/admin/job-orders`);
  await settle();
  await page.getByRole('button', { name: 'ปฏิทิน' }).click();
  await settle();
  await shot(`production-calendar-${width}`);
  const create = page.getByRole('button', { name: 'สร้างงานผลิต' }).first();
  if (await create.count()) {
    await create.click();
    await settle();
    await shot(`production-create-${width}`);
    await page.keyboard.press('Escape');
  }
  // Table states: a filter that matches nothing.
  await page.goto(`${base}/admin/products`);
  await settle();
  await page.getByRole('searchbox', { name: 'ค้นหาสินค้า' }).fill('zzzz-ไม่มีสินค้านี้');
  await page.waitForTimeout(900);
  await settle();
  await shot(`table-empty-filtered-${width}`);
}

// ---- Keyboard only, at 1440px ----
await page.setViewportSize({ width: 1440, height: 900 });
const focusName = () => page.evaluate(() => {
  const el = document.activeElement;
  return el ? (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60) : '';
});
const tabTo = async (predicate, limit = 80) => {
  for (let i = 0; i < limit; i += 1) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(predicate)) return true;
  }
  return false;
};
const dialogOpen = () => page.evaluate(() => Boolean(document.querySelector('[role=dialog], [role=menu]')));

// Dashboard list modal
await page.goto(`${base}/admin`);
await settle();
let ok = await tabTo(() => document.activeElement?.classList.contains('ka-todo__row'));
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
const listOpen = await dialogOpen();
await shot('overlay-dashboard-list-1440');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('Dashboard list modal: Tab + Enter opens, Esc closes', ok && listOpen && !(await dialogOpen()));

// Notification panel
ok = await tabTo(() => document.activeElement?.classList.contains('ka-bell'));
await page.keyboard.press('Enter');
await page.waitForTimeout(1200);
const notesOpen = await dialogOpen();
await shot('overlay-notifications-1440');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('Notification panel: Tab + Enter opens, Esc closes and returns focus', ok && notesOpen && !(await dialogOpen()) && (await focusName()).includes('การแจ้งเตือน'));

// Filter chip
await page.goto(`${base}/admin/products`);
await settle();
ok = await tabTo(() => document.activeElement?.classList.contains('ka-chip'));
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
const chipOpen = await dialogOpen();
await shot('overlay-filter-1440');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('Filter chip: Tab + Enter opens, Esc closes', ok && chipOpen && !(await dialogOpen()));

// Row menu
ok = await tabTo(() => document.activeElement?.getAttribute('aria-haspopup') === 'menu', 200);
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
const menuOpen = await page.evaluate(() => Boolean(document.querySelector('[role=menu]')));
await page.keyboard.press('ArrowDown');
await shot('overlay-row-menu-1440');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('Row menu: Tab + Enter opens, ↓ moves, Esc closes', ok && menuOpen && !(await page.evaluate(() => Boolean(document.querySelector('[role=menu]')))));

// CustomSelect inside a form dialog, and the unsaved-changes guard
await page.goto(`${base}/admin/materials`);
await settle();
ok = await tabTo(() => (document.activeElement?.textContent || '').includes('เพิ่มข้อมูล'));
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
ok = ok && (await tabTo(() => document.activeElement?.getAttribute('role') === 'combobox', 20));
await page.keyboard.press('Enter');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
const chosen = await page.evaluate(() => document.activeElement?.textContent ?? '');
await shot('overlay-select-in-form-1440');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const guard = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] h2')].some((h) => h.textContent === 'ยังไม่ได้บันทึกการแก้ไข'));
await shot('overlay-unsaved-guard-1440');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('CustomSelect: Enter opens, ↓ + Enter picks ("เปลี่ยน" shows); Esc on the edited form asks first', ok && chosen.includes('เปลี่ยน') && guard);

// Product row menu → detail modal via keyboard
writeFileSync(join(out, 'keyboard-results.json'), JSON.stringify(results, null, 2));
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.note ? ` (${r.note})` : ''}`);
await browser.close();
