import { test } from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';

const load = sourceLoader();
const {
  STORE_ORDER_STATUS_LABELS,
  STORE_ORDER_METHOD_LABELS,
  STORE_CUSTOMER_TYPE_LABELS,
  STORE_ORDER_SEARCH_MAX_LENGTH,
  storeOrderListParams,
} = load('src/lib/store-order-list.ts');
const { STORE_ORDER_STATUS_TONE } = load('src/lib/status-tones.ts');

// What store_order.status may hold (the table's CHECK) and so what the list
// API can send. A status added there is one the Admin must also be able to say.
const API_STATUSES = [
  'awaiting_payment',
  'paid',
  'expired',
  'awaiting_review',
  'cancelled',
];
const THAI = /[฀-๿]/;
// Objects made inside the loader's context are not the test's own.
const plain = (value) => JSON.parse(JSON.stringify(value));

test('every status the API can send has a Thai label and a tone', () => {
  for (const status of API_STATUSES) {
    assert.match(STORE_ORDER_STATUS_LABELS[status] ?? '', THAI, status);
    assert.ok(STORE_ORDER_STATUS_TONE[status], `${status} has no tone`);
  }
  // No label stands for a status the API never sends.
  assert.deepEqual(Object.keys(STORE_ORDER_STATUS_LABELS), API_STATUSES);
  assert.deepEqual(Object.keys(STORE_ORDER_STATUS_TONE).sort(), [...API_STATUSES].sort());
});

test('each status reads differently, so the filter and the badge tell them apart', () => {
  const words = Object.values(STORE_ORDER_STATUS_LABELS);
  assert.equal(new Set(words).size, words.length);
});

test('a cancelled order is marked as such, and a paid one as done', () => {
  assert.equal(STORE_ORDER_STATUS_LABELS.cancelled, 'ยกเลิกแล้ว');
  assert.equal(STORE_ORDER_STATUS_TONE.cancelled, 'danger');
  assert.equal(STORE_ORDER_STATUS_TONE.paid, 'success');
});

test('both ways of receiving, and both kinds of buyer, are said in Thai', () => {
  assert.equal(STORE_ORDER_METHOD_LABELS.delivery, 'จัดส่ง');
  assert.equal(STORE_ORDER_METHOD_LABELS.pickup, 'รับที่ร้าน');
  assert.equal(STORE_CUSTOMER_TYPE_LABELS.member, 'สมาชิก');
  assert.ok(STORE_CUSTOMER_TYPE_LABELS.guest);
});

const none = { search: '', status: '', fulfillmentMethod: '', queue: '', dateFrom: '', dateTo: '' };

test('with no filter only the page is asked for', () => {
  assert.deepEqual(plain(storeOrderListParams(none, 1, 20)), {
    page: 1,
    limit: 20,
  });
});

test('an empty filter is left out rather than sent as an empty value', () => {
  const params = storeOrderListParams({ ...none, search: '   ' }, 3, 20);
  assert.deepEqual(plain(params), { page: 3, limit: 20 });
  assert.ok(!('status' in params));
  assert.ok(!('fulfillment_method' in params));
});

test('each filter reaches the API under the name it expects', () => {
  assert.deepEqual(
    plain(
      storeOrderListParams(
        {
          search: '  081-234-5678 ',
          status: 'cancelled',
          fulfillmentMethod: 'pickup',
          dateFrom: '2026-03-10',
          dateTo: '2026-03-11',
        },
        2,
        20,
      ),
    ),
    {
      page: 2,
      limit: 20,
      search: '081-234-5678',
      status: 'cancelled',
      fulfillment_method: 'pickup',
      date_from: '2026-03-10',
      date_to: '2026-03-11',
    },
  );
});

test('the search box stops where the API refuses', () => {
  assert.equal(STORE_ORDER_SEARCH_MAX_LENGTH, 100);
});

test('a work queue is sent only when one is chosen (TASK-0351)', () => {
  assert.equal('queue' in plain(storeOrderListParams(none, 1, 20)), false);
  assert.equal(plain(storeOrderListParams({ ...none, queue: 'to_ship' }, 1, 20)).queue, 'to_ship');
});

const { storeOrderSteps } = load('src/lib/store-order-steps.ts');
const line = (purchasedQty, shippedQty) => ({
  purchasedQty,
  shippedQty,
  remainingUnshipped: purchasedQty - shippedQty,
});
const parcel = (status, quantity) => ({ status, items: [{ quantity }] });
const order = (set = {}) => ({
  status: 'paid',
  fulfillmentMethod: 'delivery',
  pickup: null,
  cancellation: null,
  items: [line(3, 0)],
  parcels: [],
  ...set,
});
const states = (value) => plain(storeOrderSteps(value)).map((step) => step.state);

test('an order not paid yet goes no further than payment', () => {
  assert.deepEqual(states(order({ status: 'awaiting_payment' })), ['now', 'idle', 'idle']);
  assert.deepEqual(states(order({ status: 'expired' })), ['warn', 'idle', 'idle']);
  assert.deepEqual(states(order({ status: 'cancelled', fulfillmentMethod: 'pickup' })), ['warn', 'idle', 'idle']);
});

test('a delivery is complete only when every parcel left the shop', () => {
  assert.deepEqual(states(order()), ['done', 'now', 'idle']);
  const partly = order({ items: [line(3, 2)], parcels: [parcel('shipped', 1), parcel('preparing', 1)] });
  assert.deepEqual(states(partly), ['done', 'done', 'now']);
  assert.equal(plain(storeOrderSteps(partly))[2].sub, 'จัดส่งแล้ว 1 จาก 3 ชิ้น');
  const recorded = order({ items: [line(2, 2)], parcels: [parcel('preparing', 2)] });
  assert.deepEqual(states(recorded), ['done', 'done', 'now']);
  const sent = order({ items: [line(2, 2)], parcels: [parcel('shipped', 2), parcel('voided', 2)] });
  assert.deepEqual(states(sent), ['done', 'done', 'done']);
  assert.equal(plain(storeOrderSteps(sent))[1].sub, '1 พัสดุ');
});

test('a pickup follows its own status', () => {
  const pickup = (status, set = {}) =>
    order({ fulfillmentMethod: 'pickup', pickup: { status, readyAt: null, pickedUpAt: null, ...set } });
  assert.deepEqual(states(pickup('awaiting_ready')), ['done', 'now', 'idle']);
  assert.deepEqual(states(pickup('ready')), ['done', 'done', 'now']);
  assert.deepEqual(states(pickup('overdue')), ['done', 'done', 'warn']);
  assert.deepEqual(states(pickup('picked_up')), ['done', 'done', 'done']);
});

test('a cancellation request takes the order over until it is decided', () => {
  const asked = order({ cancellation: { status: 'pending', createdAt: '2026-11-01T00:00:00Z' } });
  assert.deepEqual(states(asked), ['done', 'warn', 'idle']);
  const approved = order({ cancellation: { status: 'approved', createdAt: '2026-11-01T00:00:00Z' } });
  assert.deepEqual(states(approved), ['done', 'done', 'now']);
  const rejected = order({ cancellation: { status: 'rejected', createdAt: '2026-11-01T00:00:00Z' } });
  assert.deepEqual(states(rejected), ['done', 'now', 'idle']);
});

const { retryAfterMs } = load('src/lib/retry-after.ts');

test('only a 503 asks again, after the time the API names, within limits', () => {
  const shed = (value) => ({ response: { status: 503, headers: { 'retry-after': value } } });
  assert.equal(retryAfterMs(shed('3')), 3000);
  assert.equal(retryAfterMs(shed('600')), 30000);
  assert.equal(retryAfterMs(shed('nonsense')), 5000);
  assert.equal(retryAfterMs({ response: { status: 503, headers: {} } }), 5000);
  assert.equal(retryAfterMs({ response: { status: 500, headers: {} } }), null);
  assert.equal(retryAfterMs(new Error('offline')), null);
});
