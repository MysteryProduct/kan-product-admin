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

const none = { search: '', status: '', fulfillmentMethod: '', dateFrom: '', dateTo: '' };

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
