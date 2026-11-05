// TASK-0346 F6: pixels that differ between two sets of shots.mjs. Usage: node compare.mjs <setA> <setB>
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const require = createRequire('/pw/noop.js');
const { chromium } = require('playwright');
const [one, two] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
const names = readdirSync(one).filter((name) => name.endsWith('.png'));
let same = 0; let worst = 0; const lines = [];
for (const name of names) {
  if (!existsSync(`${two}/${name}`)) { lines.push(`MISSING ${name}`); continue; }
  const result = await page.evaluate(async ([a, b]) => {
    const load = (data) => new Promise((done) => { const image = new Image(); image.onload = () => done(image); image.src = `data:image/png;base64,${data}`; });
    const [x, y] = await Promise.all([load(a), load(b)]);
    if (x.width !== y.width || x.height !== y.height) return { size: true };
    const pixels = (image) => { const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); return context.getImageData(0, 0, image.width, image.height).data; };
    const A = pixels(x); const B = pixels(y); let delta = 0; let count = 0; let left = 1e9; let top = 1e9; let right = -1; let bottom = -1;
    for (let at = 0; at < A.length; at += 4) if (A[at] !== B[at] || A[at + 1] !== B[at + 1] || A[at + 2] !== B[at + 2]) { delta = Math.max(delta, Math.abs(A[at] - B[at]), Math.abs(A[at + 1] - B[at + 1]), Math.abs(A[at + 2] - B[at + 2])); const index = at / 4; const X = index % x.width; const Y = Math.floor(index / x.width); count += 1; left = Math.min(left, X); right = Math.max(right, X); top = Math.min(top, Y); bottom = Math.max(bottom, Y); }
    return { count, delta, box: [left, top, right, bottom] };
  }, [readFileSync(`${one}/${name}`).toString('base64'), readFileSync(`${two}/${name}`).toString('base64')]);
  if (result.size) lines.push(`SIZE ${name}`);
  else if (!result.count) same += 1;
  else { worst = Math.max(worst, result.count); lines.push(`${name} ${result.count} px, largest channel step ${result.delta}, box ${result.box}`); }
}
console.log(`${one} vs ${two}: ${names.length} images, identical ${same}, worst ${worst} px`);
console.log(lines.join('\n'));
await browser.close();
