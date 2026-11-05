// TASK-0346 F6: the same pages and steps on either revision, compared by compare.mjs. A delete is answered 409 by the
// browser, so the confirm and result dialogs open and nothing is written. Usage: SET=<folder> node shots.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import net from 'node:net';
const require = createRequire('/pw/noop.js');
const { chromium } = require('playwright');
for (const port of [3011, 3010]) net.createServer((c) => { const u = net.connect(port, 'host.docker.internal'); c.pipe(u).pipe(c); c.on('error', () => u.destroy()); u.on('error', () => c.destroy()); }).listen(port, '127.0.0.1');
const out = process.env.SET;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
const context = await browser.newContext({ storageState: '/auth/auth.json', viewport: { width: 1440, height: 1000 }, colorScheme: 'light', locale: 'th-TH', timezoneId: 'Asia/Bangkok', reducedMotion: 'reduce' });
const page = await context.newPage();
await context.route(/:3010\//, (route) => (route.request().method() === 'DELETE'
  ? route.fulfill({ status: 409, contentType: 'application/json', headers: { 'access-control-allow-origin': 'http://localhost:3011', 'access-control-allow-credentials': 'true' }, body: JSON.stringify({ message: 'ทดสอบ' }) })
  : route.fallback()));
const still = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
const PAGES = ['sale-orders', 'purchase-orders', 'products', 'materials', 'suppliers', 'employees', 'bank-account', 'categories', 'colors', 'sizes', 'job-orders', 'invoice-supplier'];
const log = [];
for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
  for (const name of PAGES) {
    await page.goto(`http://localhost:3011/admin/${name}`, { waitUntil: 'commit' });
    await page.waitForSelector('main', { timeout: 120000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.addStyleTag({ content: still });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/${name}-${width}.png` });
    const menus = page.locator('button[aria-haspopup="menu"]:visible');
    const count = Math.min(await menus.count(), 6);
    let shown = false;
    for (let index = 0; index < count && !shown; index += 1) {
      await menus.nth(index).click();
      await page.waitForTimeout(450);
      if (index === 0) await page.screenshot({ path: `${out}/${name}-menu-${width}.png` });
      const danger = page.locator('.ka-menu__item[data-tone="danger"]:visible').first();
      if (await danger.count()) {
        await danger.click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${out}/${name}-confirm-${width}.png` });
        shown = true;
        const confirm = page.locator('.ka-modal__foot .ka-btn--danger:visible, .ka-modal__foot .ka-btn--primary:visible').last();
        if (await confirm.count()) {
          await confirm.click().catch(() => {});
          await page.waitForTimeout(900);
          await page.screenshot({ path: `${out}/${name}-result-${width}.png` });
        }
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
    log.push(`${name} ${width} confirm ${shown}`);
  }
}
console.log(log.join('\n'));
await browser.close();
process.exit(0);
