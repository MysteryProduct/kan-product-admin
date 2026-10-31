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
    // A second picture only when the body really scrolls (otherwise it repeats the first).
    const scrolls = await dialog().locator('.ka-modal__body').evaluate((el) => {
      if (el.scrollHeight <= el.clientHeight + 1) return false;
      el.scrollTo(0, el.scrollHeight);
      return true;
    });
    if (scrolls) {
      await page.waitForTimeout(200);
      await shot(`${file}-bottom`);
    }
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

// ---------- Flows the first pass did not reach (review round 1, F6) ----------
// Requests below are answered by page.route where noted: they prove how the dialogs
// handle those answers, not what the API does. Nothing reaches the database.
await page.setViewportSize({ width: 1440, height: 1000 });

// Stacked: "ตั้งค่า" over the detail; Esc closes one at a time and focus walks back.
await openProducts();
const eye2 = page.getByRole('button', { name: `ดูรายละเอียด ${OUT_OF_STOCK}` }).first();
await eye2.click();
await settle(900);
const settings = dialog().getByRole('button', { name: 'ตั้งค่า', exact: true });
await settings.click();
await settle();
await shot('stacked-detail-policy-1440');
check('stacked: policy opens over the detail', (await page.getByRole('dialog').count()) === 2);
await page.keyboard.press('Escape');
await settle(300);
check('stacked: first Esc closes only the policy dialog', (await page.getByRole('dialog').count()) === 1);
check('stacked: focus back on "ตั้งค่า"', await openerIsFocused(settings));
await page.keyboard.press('Escape');
await settle(300);
check('stacked: second Esc closes the detail, focus on the eye button', (await page.getByRole('dialog').count()) === 0 && (await openerIsFocused(eye2)));

// Saving and a failed save (PATCH answered by the test: 1.5s delay, then 500).
await page.route('**/product/store-policy/bulk', async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'ทดสอบ: บันทึกไม่สำเร็จ' }) });
});
await select(OUT_OF_STOCK);
await bulk('ตั้งค่าหน้าร้าน').click();
await settle();
const contact = dialog().getByRole('radiogroup', { name: 'ขอติดต่อกลับได้' });
await contact.getByRole('radio', { name: 'ปิด', exact: true }).click();
await dialog().getByRole('button', { name: 'ตรวจสอบก่อนบันทึก' }).click();
await dialog().getByRole('button', { name: /ยืนยันบันทึก/ }).click();
await page.waitForTimeout(300);
await shot('policy-saving-1440');
check('saving: aria-busy and "กำลังบันทึก…"', (await dialog().locator('[aria-busy="true"]').count()) > 0 && (await dialog().getByRole('button', { name: 'กำลังบันทึก…' }).isDisabled()));
await page.keyboard.press('Escape');
check('saving: Esc does not close while saving', (await page.getByRole('dialog').count()) === 1);
await page.waitForTimeout(1800);
await shot('policy-error-1440');
check('error: danger banner with the API message', (await dialog().getByRole('alert').innerText()).includes('ทดสอบ: บันทึกไม่สำเร็จ'));
check('error: retry offered', await dialog().getByRole('button', { name: 'ลองบันทึกอีกครั้ง' }).isVisible());
await dialog().getByRole('button', { name: 'กลับไปแก้ไข' }).click();
check('error: choice kept', (await contact.getByRole('radio', { checked: true }).innerText()) === 'ปิด');
await page.keyboard.press('Escape');
await settle(300);
await page.unroute('**/product/store-policy/bulk');
await unselectAll();

// Delete from the detail goes to the existing confirmation; cancelled, nothing deleted.
await page.getByRole('button', { name: `ดูรายละเอียด ${OUT_OF_STOCK}` }).first().click();
await settle(900);
await dialog().getByRole('button', { name: 'ลบสินค้า' }).click();
await settle(300);
await shot('detail-delete-confirm-1440');
check('delete: detail closes and the existing confirmation opens', (await page.getByRole('dialog').count()) === 1 && (await dialog().innerText()).includes(`ลบ “${OUT_OF_STOCK}”?`));
await dialog().getByRole('button', { name: 'ยกเลิก' }).click();
await settle(300);
check('delete: cancelled, product still listed', (await page.getByRole('button', { name: `ดูรายละเอียด ${OUT_OF_STOCK}` }).count()) > 0);

// Richer data than the dev database holds (answers rewritten by the test): four product
// tiles (one a video), a variant picture, contact switched off; then the product unpublished.
const rewrite = async (published) => {
  await page.route(/\/product\/store-policy\/batch/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const row of body.data ?? []) {
      row.contact_enabled = false;
      row.published = published;
    }
    await route.fulfill({ response, json: body });
  });
  await page.route(/\/product\/[0-9a-f-]{36}$/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const body = await response.json();
    const product = body.data ?? body;
    const [first] = product.files ?? [];
    const variant = (product.productVariants ?? product.product_variants ?? [])[0];
    if (first) {
      product.files = [
        first,
        { ...first, product_file_id: 900001 },
        { ...first, product_file_id: 900002 },
        { ...first, product_file_id: 900003, product_file_category: 'video' },
        ...(variant ? [{ ...first, product_file_id: 900004, product_variant_id: variant.product_variant_id }] : []),
      ];
    }
    await route.fulfill({ response, json: body });
  });
};
for (const [published, name] of [[true, 'detail-rich-1440'], [false, 'detail-unpublished-1440']]) {
  await rewrite(published);
  await openProducts();
  await page.getByRole('button', { name: `ดูรายละเอียด ${OUT_OF_STOCK}` }).first().click();
  await settle(900);
  await dialog().getByRole('button', { name: 'รูปที่ 3' }).click();
  await shot(name);
  const text = await dialog().innerText();
  if (published) {
    check(
      'rich: four tiles, one ringed, "ปิด" chip, contact-off sold-out note',
      (await dialog().locator('.ka-pm__gal .ka-pm__tile:not(.ka-pm__tile--count)').count()) === 4 &&
        (await dialog().locator('.ka-pm__tile[aria-pressed="true"]').count()) === 1 &&
        /ขอติดต่อกลับได้\s*ปิด/.test(text) &&
        text.includes('สินค้าหมด ลูกค้าซื้อหรือสอบถามออนไลน์ไม่ได้'),
    );
    check('rich: variant picture row', (await dialog().locator('.ka-pm__vfiles img').count()) === 1 && text.includes('รูปเฉพาะแบบ 1'));
  } else {
    check('unpublished: note says customers cannot see it', text.includes('ไม่แสดงบนหน้าร้าน ลูกค้าไม่เห็นสินค้านี้') && !text.includes('สอบถามได้'));
  }
  await page.keyboard.press('Escape');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

// Dark mode, through the app's own saved theme.
await page.evaluate(() => localStorage.setItem('theme', 'dark'));
for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: width < 640 ? 844 : 1000 });
  await openProducts();
  await page.getByRole('button', { name: `ดูรายละเอียด ${OUT_OF_STOCK}` }).first().click();
  await settle(900);
  check(`dark ${width}: theme applied`, await page.evaluate(() => document.documentElement.classList.contains('dark')));
  await shot(`detail-dark-${width}`);
  await page.keyboard.press('Escape');
  await settle(300);
  await select(OUT_OF_STOCK);
  await bulk('ตั้งค่าหน้าร้าน').click();
  await settle();
  await dialog().getByRole('radiogroup', { name: 'ขอติดต่อกลับได้' }).getByRole('radio', { name: 'ปิด', exact: true }).click();
  await shot(`policy-edit-dark-${width}`);
  await page.keyboard.press('Escape');
  await settle(300);
  await bulk('เปลี่ยนหมวดหมู่').click();
  await settle();
  await dialog().locator('.ka-pm__cat:not([aria-disabled="true"])').first().click();
  await shot(`category-edit-dark-${width}`);
  await page.keyboard.press('Escape');
  await settle(300);
  await bulk('เปลี่ยนสถานะตัวเลือก').click();
  await settle();
  await dialog().getByRole('checkbox').first().check();
  await shot(`status-edit-dark-${width}`);
  await page.keyboard.press('Escape');
  await settle(300);
  await unselectAll();
}
await page.evaluate(() => localStorage.setItem('theme', 'light'));

// The shared .ka-seg elsewhere keeps its own look (review round 1, F1).
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${base}/admin/sales-dashboard`);
await settle(1500);
const seg = await page.evaluate(() => {
  const el = document.querySelector('.ka-seg');
  if (!el) return null;
  const box = getComputedStyle(el);
  const button = getComputedStyle(el.querySelector('button'));
  return { radius: box.borderTopLeftRadius, gap: box.columnGap, buttonRadius: button.borderTopLeftRadius, minWidth: button.minWidth };
});
check('shared .ka-seg on the sales page untouched', seg && seg.radius === '8px' && seg.buttonRadius === '6px' && seg.minWidth !== '64px', JSON.stringify(seg));

writeFileSync(join(out, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
// The proxy servers keep the event loop alive.
process.exit(failed ? 1 : 0);
