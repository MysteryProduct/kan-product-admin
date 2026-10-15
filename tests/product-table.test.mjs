import { test } from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';

// TASK-0160. Pure helpers of the product table: column preferences kept in the
// browser, the latest-request gate and the before/after lines of group
// commands. They load the real TypeScript; no browser or API is involved.
// The sources run in a separate VM context, so results are compared as plain JSON.
const plain = value => JSON.parse(JSON.stringify(value));
const load = sourceLoader();
const prefs = load('src/lib/table-preferences.ts');
const { createLatestGate } = load('src/lib/latest-request.ts');
const bulk = load('src/lib/product-bulk.ts');

const memory = (initial = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: key => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: key => { delete data[key]; },
  };
};
const ALLOWED = ['category', 'color', 'stock'];
const REQUIRED = ['product_code', 'product_name'];

test('preferences round-trip per employee and table, and reset removes the entry', () => {
  const storage = memory();
  const a = prefs.preferenceKey('products', 'emp-a');
  const b = prefs.preferenceKey('products', 'emp-b');
  assert.notEqual(a, b);
  assert.notEqual(a, prefs.preferenceKey('materials', 'emp-a'));
  assert.equal(prefs.saveHiddenColumns(storage, a, ['color', 'stock']), true);
  assert.deepEqual(plain(prefs.loadHiddenColumns(storage, a, ALLOWED, REQUIRED)), ['color', 'stock']);
  assert.deepEqual(plain(prefs.loadHiddenColumns(storage, b, ALLOWED, REQUIRED)), [], 'another employee is unaffected');
  assert.equal(prefs.saveHiddenColumns(storage, a, []), true);
  assert.equal(a in storage.data, false, 'reset leaves nothing behind');
  assert.deepEqual(plain(prefs.loadHiddenColumns(storage, a, ALLOWED, REQUIRED)), []);
});

test('a stored value can never hide a required or unknown column', () => {
  const key = prefs.preferenceKey('products', 'emp-a');
  const storage = memory({ [key]: JSON.stringify({ v: 1, hidden: ['product_code', 'product_name', 'nope', 7, 'color', 'color'] }) });
  assert.deepEqual(plain(prefs.loadHiddenColumns(storage, key, ALLOWED, REQUIRED)), ['color']);
});

test('corrupt, old-version or unavailable storage reads as no preference and never throws', () => {
  const key = 'k';
  for (const raw of ['{bad', 'null', '[]', '"x"', JSON.stringify({ v: 0, hidden: ['color'] }), JSON.stringify({ v: 1, hidden: 'color' })]) {
    assert.deepEqual(plain(prefs.loadHiddenColumns(memory({ [key]: raw }), key, ALLOWED, REQUIRED)), [], raw);
  }
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('denied'); } };
  assert.deepEqual(plain(prefs.loadHiddenColumns(blocked, key, ALLOWED, REQUIRED)), []);
  assert.equal(prefs.saveHiddenColumns(blocked, key, ['color']), false, 'the caller is told the choice was not stored');
  assert.deepEqual(plain(prefs.loadHiddenColumns(null, key, ALLOWED, REQUIRED)), []);
  assert.equal(prefs.saveHiddenColumns(null, key, ['color']), false);
});

test('only the newest request may apply its result', () => {
  const gate = createLatestGate();
  const slow = gate.begin();
  const fast = gate.begin();
  assert.equal(gate.isLatest(slow), false, 'an older query that answers late is ignored');
  assert.equal(gate.isLatest(fast), true);
  const next = gate.begin();
  assert.equal(gate.isLatest(fast), false);
  assert.equal(gate.isLatest(next), true);
});

const variant = (id, size, color, status) => ({ product_variant_id: id, size: { size_name: size }, color: { color_name: color }, product_variant_status: status });
const PRODUCTS = [
  { product_id: 'p1', product_name: 'ถ้วย', category: { category_name: 'ครัว' }, productVariants: [variant('v1', 'S', 'แดง', 'active'), variant('v2', 'L', 'น้ำเงิน', 'available')] },
  { product_id: 'p2', product_name: 'จาน', category: { category_name: 'ครัว' }, product_variants: [variant('v3', 'M', 'ขาว', 'inactive')] },
];

test('variant status: only inactive is inactive; legacy "available" reads as active', () => {
  assert.equal(bulk.variantStatusOf(PRODUCTS[0].productVariants[1]), 'active');
  assert.equal(bulk.variantStatusOf(PRODUCTS[1].product_variants[0]), 'inactive');
  assert.equal(bulk.variantStatusOf({}), 'active');
});

test('status preview lists exactly the chosen variants, siblings stay out', () => {
  const lines = bulk.statusPreview(PRODUCTS, new Set(['v2', 'v3']), 'inactive');
  assert.deepEqual(plain(lines.map(l => [l.key, l.before, l.after])), [
    ['v2', 'เปิดใช้งาน', 'ปิดใช้งาน'],
    ['v3', 'ปิดใช้งาน', 'ปิดใช้งาน'],
  ]);
  assert.equal(lines[0].detail, 'L / น้ำเงิน');
});

test('policy preview shows only changed switches and an unread policy as unknown, not off', () => {
  const policies = new Map([['p1', { product_id: 'p1', published: true, online_purchase: false, contact_enabled: false }]]);
  const lines = bulk.policyPreview(PRODUCTS, policies, { published: false, contact_enabled: true });
  assert.deepEqual(plain(lines.map(l => [l.key, l.before, l.after])), [
    ['p1:published', 'เปิด', 'ปิด'],
    ['p1:contact_enabled', 'ปิด', 'เปิด'],
    ['p2:published', 'ไม่ทราบค่า', 'ปิด'],
    ['p2:contact_enabled', 'ไม่ทราบค่า', 'เปิด'],
  ]);
});

test('category preview and selection keep to the rows on the page', () => {
  assert.deepEqual(plain(bulk.categoryPreview(PRODUCTS, 'ของใช้').map(l => [l.key, l.before, l.after])), [['p1', 'ครัว', 'ของใช้'], ['p2', 'ครัว', 'ของใช้']]);
  assert.deepEqual(plain(bulk.selectedProducts(PRODUCTS, new Set(['p2', 'gone'])).map(p => p.product_id)), ['p2']);
});
