import { test } from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';

// TASK-0210 F11: the review page lists the ZIP's originals/ paths by copying the
// Store's `originalFiles`/`safeName` (kan-product-store src/lib/custom-export.ts).
// The Store is not in this repository, so the expected paths below were produced
// by running the Store's own functions on these layers at Store revision cc48fb4
// (2026-11-12). A change on either side that renames a file breaks this test.
const { originalRows, safeName } = load();

function load() {
  return sourceLoader()('src/lib/custom-review.ts');
}

const img = (file_name, width = 10, height = 20) => ({ kind: 'image', file_name, width, height });
const item = (layers) => ({ itemNo: 3, design: { layers } });

test('originals/ paths match the Store export: order, padding, sanitising and truncation', () => {
  const names = [
    'logo.png',
    'a/b:c*?.png',
    '  spaced name .jpg  ',
    'x'.repeat(100) + '.png',
    'noext',
    '.hidden',
    'archive.tar.gzipped',
    'รูปภาพ.PNG',
    '"quote"|pipe.webp',
    'tab\tname.png',
    '',
  ];
  const layers = [
    { kind: 'text', text: 'hi' },
    ...names.slice(0, 5).map((n) => img(n)),
    { kind: 'text', text: 'mid' },
    ...names.slice(5).map((n) => img(n)),
  ];
  const rows = originalRows(item(layers));
  assert.deepEqual(
    rows.map((r) => r.path),
    [
      'originals/01_logo.png',
      'originals/02_a_b_c__.png',
      'originals/03_spaced name .jpg',
      `originals/04_${'x'.repeat(76)}.png`,
      'originals/05_noext',
      'originals/06_.hidden',
      'originals/07_archive.tar.gzipped',
      'originals/08_รูปภาพ.PNG',
      'originals/09__quote__pipe.webp',
      'originals/10_tab_name.png',
      'originals/11_file',
    ],
  );
  // Numbered among image layers; the layer number on screen counts every layer.
  assert.deepEqual(
    rows.map((r) => r.layerNo),
    [2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13],
  );
  assert.ok(rows.every((r) => r.itemNo === 3 && r.size === '10 × 20'));
});

test('the number is padded to the image count: 9 images use 1_, 10 use 01_', () => {
  const series = (n) => Array.from({ length: n }, (_, i) => img(`p${i + 1}.png`));
  const nine = originalRows(item(series(9))).map((r) => r.path);
  assert.deepEqual(nine.slice(0, 2), ['originals/1_p1.png', 'originals/2_p2.png']);
  const ten = originalRows(item(series(10))).map((r) => r.path);
  assert.deepEqual([ten[0], ten[9]], ['originals/01_p1.png', 'originals/10_p10.png']);
});

test('safeName keeps the extension within the length limit, as the Store does', () => {
  assert.equal(safeName('y'.repeat(50) + '.jpeg', 40), `${'y'.repeat(35)}.jpeg`);
});

test('a text-only design has no originals', () => {
  // Lengths, not deepEqual: the source runs in its own vm realm, so its [] is another Array.
  assert.equal(originalRows(item([{ kind: 'text', text: 'only' }])).length, 0);
  assert.equal(originalRows({ itemNo: 1 }).length, 0);
});

// TASK-0210 F17: a request past approval (or any status outside the queue) is never shown as waiting for a deposit.
test('statusView words every request status of the custom_request CHECK', () => {
  const { statusView } = load();
  const word = (s) => statusView(s).label;
  assert.equal(word('reviewing'), 'กำลังตรวจ');
  assert.equal(word('awaiting_deposit'), 'รอมัดจำ');
  assert.equal(word('cancelled'), 'ยกเลิกแล้ว');
  assert.equal(word('in_production'), 'กำลังผลิต');
  assert.equal(word('produced'), 'ผลิตเสร็จแล้ว');
  assert.equal(word('awaiting_balance'), 'รอชำระส่วนที่เหลือ');
  assert.equal(word('ready_to_ship'), 'พร้อมจัดส่ง');
  assert.equal(word('shipped'), 'จัดส่งแล้ว');
  assert.equal(statusView('shipped').dot, 'ok');
  assert.equal(word('constructor'), 'constructor');
});
