// Captures the product page modals (detail, store policy, category, variant status) at 390, 834
// and 1440px and walks them with the keyboard only (TASK-0322). Development stack only: signs in
// with the demo_audit account whose password the API seed script sets
// (kan-product-api/scripts/seed-demo-audit-user.cjs). Nothing is saved: every dialog stops at
// review and closes with Esc.
//
//   node tests/screenshots/product-modals-capture.mjs [baseUrl]
//
// Needs the `playwright` package and Chromium, installed outside this repo; set PLAYWRIGHT_DIR to
// the folder whose node_modules holds it and SEED_FILE when the API checkout is not beside this
// one. PROXY=1 forwards localhost:3011 and :3010 to host.docker.internal (PROXY_ADMIN_PORT, default
// 3021) for a run inside the Playwright container, so the API's CORS origin still matches.
// Screenshots and results.json go to tests/screenshots/product-modals/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(process.env.PLAYWRIGHT_DIR ?? here, 'noop.js'));
const { chromium } = require('playwright');

if (process.env.PROXY) {
  const forward = (listenPort, targetPort) =>
    net
      .createServer((client) => {
        const upstream = net.connect(targetPort, 'host.docker.internal');
        client.pipe(upstream).pipe(client);
        client.on('error', () => upstream.destroy());
        upstream.on('error', () => client.destroy());
      })
      .listen(listenPort, '127.0.0.1');
  forward(3011, Number(process.env.PROXY_ADMIN_PORT ?? 3021));
  forward(3010, 3010);
}

const base = process.argv[2] ?? 'http://localhost:3011';
const out = join(here, 'product-modals');
mkdirSync(out, { recursive: true });

const seedFile = process.env.SEED_FILE ?? join(here, '../../../kan-product-api/scripts/seed-demo-audit-user.cjs');
const password = readFileSync(seedFile, 'utf8').match(/bcrypt\.hash\('([^']+)'/)?.[1];
if (!password) throw new Error('seed password not found');

const OUT_OF_STOCK = 'แก้วมีหูจับพร้อมหลอด'; // PD00006: one variant, one picture, nothing in stock
const IN_STOCK = 'แก้วเก็บความเย็น 350 ml.'; // PD00004: one variant, one picture, in stock
const WIDTHS = [390, 834, 1440];
const results = [];
const check = (name, ok, note = '') => {
  results.push({ name, ok: Boolean(ok), note });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ` — ${note}` : ''}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', locale: 'th-TH' });
const page = await context.newPage();

await page.goto(`${base}/login`);
await page.waitForSelector('#username', { timeout: 120000 });
await page.fill('#username', 'demo_audit');
await page.fill('#password', password);
await page.click('button[type=submit]');
// A dev server may still be compiling the dashboard; the URL changes before its load event.
await page.waitForURL(/\/admin/, { timeout: 120000, waitUntil: 'commit' });

const settle = async (ms = 500) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
};
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });
const dialog = () => page.getByRole('dialog').last();
const openProducts = async () => {
  await page.goto(`${base}/admin/products`);
  await settle(800);
};
const select = (name) => page.getByRole('checkbox', { name: new RegExp(`เลือก .*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).first().check();
const unselectAll = async () => {
  for (const name of [OUT_OF_STOCK, IN_STOCK]) {
    const box = page.getByRole('checkbox', { name: new RegExp(`เลือก .*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).first();
    if (await box.isChecked().catch(() => false)) await box.uncheck();
  }
};
const bulk = (label) => page.locator('.ka-bulk').getByRole('button', { name: label }).first();
const panelBox = async () =>
  page.evaluate(() => {
    const panel = [...document.querySelectorAll('[role=dialog]')].pop();
    const r = panel.getBoundingClientRect();
    return { width: Math.round(r.width), height: Math.round(r.height), bottom: Math.round(r.bottom), radius: getComputedStyle(panel).borderTopLeftRadius };
  });
const noSideScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

for (const width of WIDTHS) {
  const height = width < 640 ? 844 : width < 1024 ? 1112 : 1000;
  await page.setViewportSize({ width, height });
  await openProducts();

  // P1 detail: out of stock (the artboard's product), then one in stock.
  for (const [name, file] of [[OUT_OF_STOCK, `detail-${width}`], [IN_STOCK, `detail-instock-${width}`]]) {
    await page.getByRole('button', { name: `ดูรายละเอียด ${name}` }).first().click();
    await settle(900);
    await shot(file);
    const box = await panelBox();
    if (width === 1440) check(`detail ${name} 1440: panel 720px`, box.width === 720, `${box.width}px`);
    if (width === 390) check(`detail ${name} 390: bottom sheet`, box.bottom === height && box.width === 390 && box.radius === '16px', JSON.stringify(box));
    await dialog().locator('.ka-modal__body').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(200);
    await shot(`${file}-bottom`);
    const parts = await page.evaluate(() => {
      const panel = [...document.querySelectorAll('[role=dialog]')].pop();
      const close = panel.querySelector('.ka-modal__head > button').getBoundingClientRect();
      const buttons = [...panel.querySelectorAll('.ka-modal__foot > .ka-btn')].map((b) => b.getBoundingClientRect());
      return {
        close: Math.round(close.width),
        closeLabel: panel.querySelector('.ka-modal__head > button').getAttribute('aria-label'),
        footHeights: buttons.map((b) => Math.round(b.height)),
        primaryRightmost: panel.querySelector('.ka-modal__foot > .ka-btn--primary').getBoundingClientRect().right >= Math.max(...buttons.map((b) => b.right)) - 1,
      };
    });
    const closeSize = width < 768 ? 44 : 36;
    check(`detail ${name} ${width}: close ${closeSize}px "ปิด"`, parts.close === closeSize && parts.closeLabel === 'ปิด', JSON.stringify(parts));
    if (width < 640) check(`detail ${name} ${width}: footer buttons 48px`, parts.footHeights.every((h) => h === 48), JSON.stringify(parts.footHeights));
    else check(`detail ${name} ${width}: primary button rightmost`, parts.primaryRightmost);
    const text = await dialog().innerText();
    check(`detail ${name} ${width}: no "แบบ ER" / "ID:"`, !text.includes('แบบ ER') && !/ID:/.test(text));
    check(`detail ${name} ${width}: no sideways scroll`, await noSideScroll());
    await page.keyboard.press('Escape');
    await settle(300);
  }

  // P2 policy: two products, one change.
  await select(OUT_OF_STOCK);
  await select(IN_STOCK);
  await bulk('ตั้งค่าหน้าร้าน').click();
  await settle();
  await dialog().getByRole('radiogroup', { name: 'ขอติดต่อกลับได้' }).getByRole('radio', { name: 'ปิด', exact: true }).click();
  await page.waitForTimeout(200);
  await shot(`policy-edit-${width}`);
  check(`policy ${width}: summary shown`, await dialog().locator('.ka-pm__summary').isVisible());
  check(`policy ${width}: no select`, (await dialog().locator('select, [role=combobox]').count()) === 0);
  await dialog().getByRole('button', { name: 'ตรวจสอบก่อนบันทึก' }).click();
  await page.waitForTimeout(300);
  await shot(`policy-review-${width}`);
  check(`policy ${width}: review button`, await dialog().getByRole('button', { name: /ยืนยันบันทึก \d+ รายการ/ }).isVisible());
  await page.keyboard.press('Escape');
  await settle(300);

  // P4 status: same two products, one variant ticked.
  await bulk('เปลี่ยนสถานะตัวเลือก').click();
  await settle();
  await dialog().getByRole('checkbox').first().check();
  await page.waitForTimeout(200);
  await shot(`status-edit-${width}`);
  await page.keyboard.press('Escape');
  await settle(300);
  await unselectAll();

  // P3 category: one product, a new category picked.
  await select(OUT_OF_STOCK);
  await bulk('เปลี่ยนหมวดหมู่').click();
  await settle();
  await dialog().locator('.ka-pm__cat:not([aria-disabled="true"])').first().click();
  await page.waitForTimeout(200);
  await shot(`category-edit-${width}`);
  check(`category ${width}: summary shown`, await dialog().locator('.ka-pm__summary').isVisible());
  await dialog().getByRole('button', { name: 'ตรวจสอบก่อนบันทึก' }).click();
  await page.waitForTimeout(300);
  await shot(`category-review-${width}`);
  check(`category ${width}: review button "ย้ายไป"`, await dialog().getByRole('button', { name: /^ย้ายไป/ }).isVisible());
  await page.keyboard.press('Escape');
  await settle(300);
  await unselectAll();
}

// Keyboard only at 1440: open, Tab round every control, arrows, Esc, focus back on the opener.
await page.setViewportSize({ width: 1440, height: 1000 });
await openProducts();
const active = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el ? `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[${el.getAttribute('role')}]` : ''} ${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)}` : '';
  });
const tabRound = async (label) => {
  // Elements are told apart by identity (two buttons may share the name "ปิด").
  const seen = [];
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press('Tab');
    const again = await page.evaluate(() => {
      const el = document.activeElement;
      if (el.dataset.kbdSeen) return true;
      el.dataset.kbdSeen = '1';
      return false;
    });
    if (again) break;
    seen.push(await active());
  }
  const inside = await page.evaluate(() => {
    document.querySelectorAll('[data-kbd-seen]').forEach((el) => delete el.dataset.kbdSeen);
    return [...document.querySelectorAll('[role=dialog]')].pop().contains(document.activeElement);
  });
  check(`keyboard ${label}: Tab stays in the dialog`, inside, `${seen.length} stops: ${seen.join(' | ')}`);
};
const openerIsFocused = (locator) => locator.evaluate((el) => el === document.activeElement);

// Detail.
const eye = page.getByRole('button', { name: `ดูรายละเอียด ${OUT_OF_STOCK}` }).first();
await eye.focus();
await page.keyboard.press('Enter');
await settle(900);
check('keyboard detail: focus moves into the dialog', await page.evaluate(() => document.querySelector('[role=dialog]').contains(document.activeElement)), await active());
await tabRound('detail');
await page.keyboard.press('Escape');
await settle(300);
check('keyboard detail: Esc closes', (await page.getByRole('dialog').count()) === 0);
check('keyboard detail: focus back on the eye button', await openerIsFocused(eye));

// Policy.
await select(OUT_OF_STOCK);
const policyOpener = bulk('ตั้งค่าหน้าร้าน');
await policyOpener.focus();
await page.keyboard.press('Enter');
await settle();
await tabRound('policy');
const firstGroup = dialog().getByRole('radiogroup').first();
await firstGroup.getByRole('radio', { checked: true }).focus();
await page.keyboard.press('ArrowRight');
check('keyboard policy: ArrowRight picks เปิด', (await firstGroup.getByRole('radio', { checked: true }).innerText()) === 'เปิด');
await page.keyboard.press('ArrowRight');
check('keyboard policy: ArrowRight again picks ปิด', (await firstGroup.getByRole('radio', { checked: true }).innerText()) === 'ปิด');
await page.keyboard.press('ArrowLeft');
await page.keyboard.press('ArrowLeft');
check('keyboard policy: ArrowLeft back to ไม่เปลี่ยน', (await firstGroup.getByRole('radio', { checked: true }).innerText()) === 'ไม่เปลี่ยน');
check('keyboard policy: review disabled with no change', await dialog().getByRole('button', { name: 'ตรวจสอบก่อนบันทึก' }).isDisabled());
await page.keyboard.press('Escape');
await settle(300);
check('keyboard policy: Esc closes', (await page.getByRole('dialog').count()) === 0);
check('keyboard policy: focus back on the bulk button', await openerIsFocused(policyOpener));

// Category.
const categoryOpener = bulk('เปลี่ยนหมวดหมู่');
await categoryOpener.focus();
await page.keyboard.press('Enter');
await settle();
await tabRound('category');
await dialog().locator('.ka-pm__cat[tabindex="0"]').focus();
await page.keyboard.press('ArrowDown');
const firstPick = await dialog().getByRole('radio', { checked: true }).innerText().catch(() => '');
await page.keyboard.press('ArrowDown');
const secondPick = await dialog().getByRole('radio', { checked: true }).innerText().catch(() => '');
check('keyboard category: ArrowDown moves the choice', firstPick && secondPick && firstPick !== secondPick, `${firstPick} → ${secondPick}`);
check('keyboard category: current category never picked', !(await dialog().locator('.ka-pm__cat[aria-disabled="true"][aria-checked="true"]').count()));
await page.keyboard.press('Escape');
await settle(300);
check('keyboard category: Esc closes', (await page.getByRole('dialog').count()) === 0);
check('keyboard category: focus back on the bulk button', await openerIsFocused(categoryOpener));

// Status.
const statusOpener = bulk('เปลี่ยนสถานะตัวเลือก');
await statusOpener.focus();
await page.keyboard.press('Enter');
await settle();
await tabRound('status');
const statusGroup = dialog().getByRole('radiogroup', { name: 'สถานะใหม่' });
const before = await statusGroup.getByRole('radio', { checked: true }).innerText();
await statusGroup.getByRole('radio', { checked: true }).focus();
await page.keyboard.press('ArrowRight');
const after = await statusGroup.getByRole('radio', { checked: true }).innerText();
check('keyboard status: ArrowRight switches the status', before !== after, `${before} → ${after}`);
await page.keyboard.press('Escape');
await settle(300);
check('keyboard status: Esc closes', (await page.getByRole('dialog').count()) === 0);
check('keyboard status: focus back on the bulk button', await openerIsFocused(statusOpener));

writeFileSync(join(out, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
// The proxy servers keep the event loop alive.
process.exit(failed ? 1 : 0);
