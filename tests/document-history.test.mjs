import { test } from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';

// TASK-0338: what the history dialog says about each entry, against the snapshots the API records
// (`historySnapshot` in the sale-order, purchase-order, purchase-receipt and job-order services).

const load = sourceLoader();
const history = load('src/components/document-history/history-entry.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

const entry = (patch = {}) => ({
  document_history_id: 'h1',
  action: 'updated',
  actor_name: 'suwan',
  actor_id: '11111111-1111-4111-8111-111111111111',
  supplier_names: {},
  purchase_order_codes: {},
  material_names: {},
  product_unit_names: {},
  reason: null,
  previous_value: null,
  next_value: null,
  created_at: '2026-11-03T10:55:00.000Z',
  ...patch,
});

const soLine = (patch = {}) => ({
  sale_order_list_id: 'l1',
  product_variant_id: null,
  product_name: 'พวงกุญแจหนังสลักชื่อ',
  quantity: 150,
  returned_qty: 0,
  job_order_id: 'j1',
  ...patch,
});

test('every known action has its own label, tone and icon; an unknown one keeps its name with a dot (AC4)', () => {
  for (const key of Object.keys(history.ACTIONS)) {
    const style = history.actionStyle(key);
    assert.equal(style.label, history.ACTIONS[key]);
    assert.notEqual(style.icon, 'dot', key);
  }
  assert.deepEqual(plain(history.actionStyle('approved')), { label: 'อนุมัติ', tone: 'success', icon: 'check' });
  assert.deepEqual(plain(history.actionStyle('archived_by_job')), { label: 'archived_by_job', tone: 'neutral', icon: 'dot' });
});

test('an actor is a name, the store system, or someone not in the system - never an id (AC5)', () => {
  const person = history.actorOf({ actor_name: 'นภัส ศ.', actor_id: 'x' });
  assert.equal(person.kind, 'person');
  assert.equal(person.initials, 'นภ');
  assert.equal(history.actorOf({ actor_name: 'Demo Audit', actor_id: 'y' }).initials, 'DA');
  assert.equal(history.actorOf({ actor_name: 'นภัส ศ.', actor_id: 'x' }).tone, person.tone, 'the same person keeps one colour');
  const system = history.actorOf({ actor_name: '00000000-0000-0000-0000-000000000000', actor_id: '00000000-0000-0000-0000-000000000000' });
  assert.deepEqual([system.kind, system.name], ['system', 'ระบบ']);
  const customer = history.actorOf({ actor_name: '6f1c2a90-3b4d-4e5f-8a7b-9c0d1e2f3a4b', actor_id: '6f1c2a90-3b4d-4e5f-8a7b-9c0d1e2f3a4b' });
  assert.deepEqual([customer.kind, customer.name], ['unknown', 'ลูกค้าหรือผู้ใช้ที่ไม่อยู่ในระบบ']);
});

test('entries group by the viewer\'s day, today first and labelled, minutes apart across midnight split (AC3)', () => {
  const now = new Date(2026, 10, 3, 18, 0);
  const at = (day, hour, minute) => new Date(2026, 10, day, hour, minute).toISOString();
  const groups = history.groupByDay(
    [
      entry({ document_history_id: 'a', created_at: at(3, 17, 55) }),
      entry({ document_history_id: 'b', created_at: at(3, 9, 12) }),
      entry({ document_history_id: 'c', created_at: at(2, 0, 1) }),
      entry({ document_history_id: 'd', created_at: at(1, 23, 59) }),
    ],
    now,
  );
  assert.deepEqual(plain(groups.map((group) => group.entries.map((item) => item.document_history_id))), [['a', 'b'], ['c'], ['d']]);
  assert.match(groups[0].label, /^วันนี้ · /);
  assert.doesNotMatch(groups[1].label, /วันนี้/);
  assert.match(history.timeOf(at(3, 9, 12)), /^09:12$/);
});

test('a status change is two badges in the document\'s tones; a first status stands alone (AC6)', () => {
  const approved = history.fieldChanges(entry({ previous_value: { sale_order_status: 'pending' }, next_value: { sale_order_status: 'approved' } }));
  assert.deepEqual(plain(approved), [
    { key: 'sale_order_status', label: 'สถานะใบขาย', before: 'รออนุมัติ', after: 'อนุมัติแล้ว', status: true, beforeTone: 'warning', afterTone: 'info' },
  ]);
  const paid = history.fieldChanges(entry({ previous_value: { sale_order_status: 'partial' }, next_value: { sale_order_status: 'paid' } }))[0];
  assert.deepEqual([paid.before, paid.after], ['ชำระบางส่วน', 'ชำระครบแล้ว'], 'sale-order words, not goods received');
  const po = history.fieldChanges(entry({ previous_value: { purchase_order_status: 'draft' }, next_value: { purchase_order_status: 'pending' } }))[0];
  assert.deepEqual([po.beforeTone, po.afterTone], ['neutral', 'warning']);
  const job = history.fieldChanges(entry({ previous_value: { job_order_status: 'in_progress' }, next_value: { job_order_status: 'completed' } }))[0];
  assert.deepEqual([job.beforeTone, job.afterTone], ['info', 'success'], 'job orders get tones too (review F5)');
  const invoice = history.fieldChanges(entry({ previous_value: { invoice_supplier_status: 'pending' }, next_value: { invoice_supplier_status: 'partial' } }))[0];
  assert.deepEqual([invoice.before, invoice.after], ['รอชำระ', 'ชำระบางส่วน']);
  const created = history.fieldChanges(entry({ action: 'created', next_value: { sale_order_status: 'pending', sale_order_type: 'order', sale_order_list_price: 120 } }));
  assert.deepEqual(plain(created.map((change) => [change.label, change.before, change.after])), [
    ['สถานะเริ่มต้น', null, 'รออนุมัติ'],
    ['ประเภทใบขาย', null, 'ขายจากการสั่งซื้อ'],
  ]);
});

test('an edited sale order follows its lines by variant or job and name, not by the new line ids (AC7, D1)', () => {
  const changes = history.itemChanges(
    entry({
      previous_value: { items: [soLine(), soLine({ sale_order_list_id: 'l2', product_name: 'สติกเกอร์โลโก้ไดคัท', quantity: 500 })] },
      next_value: {
        items: [
          soLine({ sale_order_list_id: 'n1', quantity: 200 }),
          soLine({ sale_order_list_id: 'n2', product_name: 'กล่องไม้ใส่นามบัตร', quantity: 100, job_order_id: 'j2' }),
        ],
      },
    }),
  );
  assert.deepEqual(plain(changes).map((change) => [change.kind, change.name, change.quantity, change.previousQuantity]), [
    ['added', 'กล่องไม้ใส่นามบัตร', 100, undefined],
    ['qty', 'พวงกุญแจหนังสลักชื่อ', 200, 150],
    ['removed', 'สติกเกอร์โลโก้ไดคัท', 500, undefined],
  ]);
});

test('a return says how many came back this time, out of what was sold (AC7)', () => {
  const first = history.itemChanges(entry({ action: 'returned', previous_value: { items: [soLine()] }, next_value: { items: [soLine({ returned_qty: 10 })] } }));
  assert.deepEqual(plain(first).map((change) => [change.kind, change.returned, change.quantity]), [['returned', 10, 150]]);
  const second = history.itemChanges(entry({ action: 'returned', previous_value: { items: [soLine({ returned_qty: 10 })] }, next_value: { items: [soLine({ returned_qty: 15 })] } }));
  assert.deepEqual(plain(second).map((change) => [change.kind, change.returned]), [['returned', 5]]);
});

test('purchase lines follow material and unit; a status change of a line is shown; names never fall back to ids (AC7)', () => {
  const line = (patch = {}) => ({ material_id: 'm1', product_unit_id: 3, quantity: 20, status: 'pending', ...patch });
  const changes = history.itemChanges(
    entry({
      material_names: { m1: 'กระดาษคราฟท์' },
      product_unit_names: { 3: 'รีม' },
      previous_value: { items: [line(), line({ material_id: 'm9', product_unit_id: undefined })] },
      next_value: { items: [line({ status: 'completed' }), line({ material_id: 'm9', product_unit_id: undefined })] },
    }),
  );
  assert.deepEqual(plain(changes).map((change) => [change.kind, change.name, change.unit, change.status?.before, change.status?.after]), [
    ['status', 'กระดาษคราฟท์', 'รีม', 'รออนุมัติ', 'ผลิตเสร็จแล้ว'],
  ]);
  const created = history.itemChanges(entry({ action: 'created', next_value: { items: [line({ material_id: 'm9', product_unit_id: undefined })] } }));
  assert.deepEqual(plain(created).map((change) => [change.kind, change.name, change.unit]), [['listed', 'ไม่ทราบรายการ', '']]);
});

test('the matching rule is what keeps an edit from reading as remove-all and add-all (regression for D1)', () => {
  // The previous dialog compared the whole lists; matching by line id alone would show every line twice.
  const changes = history.itemChanges(entry({ previous_value: { items: [soLine()] }, next_value: { items: [soLine({ sale_order_list_id: 'n1' })] } }));
  assert.deepEqual(plain(changes), []);
});

test('who and when are told only once every entry is loaded (AC2, D3)', () => {
  const entries = [
    entry({ actor_name: 'suwan', actor_id: 'a', created_at: '2026-11-03T10:55:00.000Z' }),
    entry({ actor_name: 'นภัส ศ.', actor_id: 'b', created_at: '2026-11-01T03:05:00.000Z' }),
    entry({ actor_name: 'suwan', actor_id: 'a', created_at: '2026-10-31T09:00:00.000Z' }),
    entry({ actor_name: '00000000-0000-0000-0000-000000000000', actor_id: '00000000-0000-0000-0000-000000000000', created_at: '2026-10-28T23:35:00.000Z' }),
  ];
  const all = history.summarize(entries, 4, 1, 1);
  assert.deepEqual([all.allLoaded, all.actors.length, all.first, all.last], [true, 3, '2026-10-28T23:35:00.000Z', '2026-11-03T10:55:00.000Z']);
  const part = history.summarize(entries, 9, 2, 1);
  assert.deepEqual([part.allLoaded, part.loaded, part.total], [false, 4, 9]);
});

test('a payment receipt type reads in the words of the receipt pages; an unknown one keeps its value', () => {
  const text = (value) => history.displayValue(value, 'payment_receipt_type', entry());
  assert.equal(text('partial'), 'ชำระบางส่วน');
  assert.equal(text('full'), 'ชำระเต็มจำนวน');
  assert.equal(text('deposit'), 'วางมัดจำ');
  assert.equal(text('online_gateway'), 'ชำระเต็มจำนวน');
  assert.equal(text('refund'), 'คืนเงิน');
  assert.equal(text('other'), 'other');
});
