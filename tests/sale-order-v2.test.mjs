import { test } from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';

// TASK-0336: the display rules of the sale-order pages and the two model calls they rely on.

const load = sourceLoader({
  '@/lib/status-tones': {
    SALE_ORDER_STATUS_TONE: { pending: 'warning', paid: 'success', cancelled: 'danger', returned: 'neutral' },
  },
});
const display = load('src/app/admin/sale-orders/lib/so-display.ts');

const order = (patch = {}) => ({
  sale_order_id: 'o1',
  sale_order_status: 'approved',
  sale_order_type: 'order',
  sale_order_subtotal: 1000,
  sale_order_total: 1000,
  sale_order_vat_amount: 0,
  saleOrderLists: [{ sale_order_list_id: 'l1', product_variant_id: 'v1', sale_order_list_qty: 5, returned_qty: 0, sale_order_list_price: 200 }],
  ...patch,
});

test('payment text and percent follow the net received amount', () => {
  assert.deepEqual(
    { ...display.paymentState(order(), 0), text: undefined },
    { percent: 0, paid: 0, due: 1000, total: 1000, text: undefined, tone: 'none' },
  );
  const part = display.paymentState(order({ sale_order_status: 'partial' }), 410);
  assert.equal(part.percent, 41);
  assert.equal(part.due, 590);
  assert.equal(part.tone, 'part');
  assert.match(part.text, /รับแล้ว 41%/);
  assert.equal(display.paymentState(order({ sale_order_status: 'paid' }), 1000).text, 'รับครบแล้ว');
});

test('a cancelled or pending order is never shown as awaiting money', () => {
  assert.equal(display.paymentState(order({ sale_order_status: 'cancelled' }), 0).text, 'ยกเลิกก่อนอนุมัติ');
  assert.equal(display.paymentState(order({ sale_order_status: 'pending' }), 0).text, 'ยังไม่เปิดรับชำระ');
});

test('the amount paid on the row is used when no receipt total is given, and never goes past 100%', () => {
  assert.equal(display.paymentState(order({ amount_paid: 250 })).percent, 25);
  assert.equal(display.paymentState(order({ amount_paid: 2500 })).percent, 100);
  assert.equal(display.paymentState(order({ amount_paid: undefined })).paid, 0);
});

test('a returned order owes nothing more than the goods it kept (review F3)', () => {
  // Paid 1000 in full, then 1 of 5 units (200) came back: the refund receipt leaves 800 received of 800 kept.
  const line = { sale_order_list_id: 'l1', product_variant_id: 'v1', sale_order_list_qty: 5, returned_qty: 1, sale_order_list_price: 200 };
  const paidThenReturned = display.paymentState(order({ sale_order_status: 'partially_returned', saleOrderLists: [line] }), 800);
  assert.deepEqual([paidThenReturned.due, paidThenReturned.total, paidThenReturned.percent, paidThenReturned.tone], [0, 800, 100, 'refund']);
  assert.equal(paidThenReturned.text, 'คืนสินค้า ฿200.00 · รับครบ');
  // Approved, 300 paid of 1000, then 4 of 5 units (800) came back: the API refunded only 100 (capped at 300),
  // so the row never claims an 800 refund (review F8).
  const fourBack = { ...line, returned_qty: 4 };
  const underPaid = display.paymentState(order({ sale_order_status: 'partially_returned', saleOrderLists: [fourBack] }), 200);
  assert.equal(underPaid.due, 0);
  assert.doesNotMatch(underPaid.text, /คืนเงิน/);
  // Approved with nothing paid, then the same return: 800 is still owed, and the refund was 0.
  const unpaidThenReturned = display.paymentState(order({ sale_order_status: 'partially_returned', saleOrderLists: [line] }), 0);
  assert.equal(unpaidThenReturned.due, 800);
  assert.match(unpaidThenReturned.text, /คืนสินค้า ฿200\.00 · ค้าง ฿800\.00/);
  // VAT added on top is returned too, as the API refunds it.
  assert.equal(display.returnedValue(order({ vat_type: 'exclude', vat_rate: 7, saleOrderLists: [line] })), 214);
});

test('before-VAT is the payable amount less the stored VAT', () => {
  const included = order({ sale_order_subtotal: 107, sale_order_vat_amount: 7 });
  assert.equal(display.beforeVat(included), 100);
  assert.equal(display.payable(included), 107);
});

test('commands follow the status and the type', () => {
  const { allows } = display;
  assert.ok(allows.approve(order({ sale_order_status: 'pending' })));
  assert.ok(!allows.approve(order({ sale_order_status: 'pending', sale_order_type: 'custom' })));
  assert.ok(allows.edit(order({ sale_order_status: 'pending' })));
  assert.ok(!allows.edit(order({ sale_order_status: 'approved' })));
  assert.ok(allows.remove(order({ sale_order_status: 'pending' })));
  assert.ok(!allows.remove(order({ sale_order_status: 'pending', sale_order_type: 'store' })));
  assert.ok(allows.cancel(order({ sale_order_status: 'pending', sale_order_type: 'store' })));
  assert.ok(allows.pay(order({ sale_order_status: 'partial' })));
  assert.ok(!allows.pay(order({ sale_order_status: 'paid' })));
  assert.ok(!allows.pay(order({ sale_order_status: 'approved', sale_order_type: 'custom' })));
});

test('return is offered only while something is left to return, and never for store or custom orders', () => {
  const { allows } = display;
  assert.ok(allows.return(order({ sale_order_status: 'paid' })));
  assert.ok(allows.return(order({ sale_order_status: 'partially_returned' })));
  assert.ok(!allows.return(order({ sale_order_status: 'pending' })));
  assert.ok(!allows.return(order({ sale_order_status: 'paid', sale_order_type: 'store' })));
  const done = order({ sale_order_status: 'paid', saleOrderLists: [{ sale_order_list_id: 'l1', product_variant_id: 'v1', sale_order_list_qty: 5, returned_qty: 5 }] });
  assert.ok(!allows.return(done));
  assert.equal(display.returnableQty({ product_variant_id: 'v1', sale_order_list_qty: 5, returned_qty: 2 }), 3);
  // A line sold from a job order's ready-to-sell goods has no stock to go back to.
  const fromJob = order({ sale_order_status: 'paid', saleOrderLists: [{ sale_order_list_id: 'l1', fetch_sale_order_id: 'f1', sale_order_list_qty: 5, returned_qty: 0 }] });
  assert.ok(!allows.return(fromJob));
});

test('a line shows its size and colour, or nothing', () => {
  assert.equal(display.variantText({ productVariant: { size: { size_name: 'M' }, color: { color_name: 'ดำ' } } }), 'ขนาด M · สีดำ');
  assert.equal(display.variantText({ productVariant: null }), '');
});

test('money keeps two decimals and the baht sign', () => {
  assert.equal(display.formatBaht(48500), '฿48,500.00');
  assert.equal(display.formatMoney(Number.NaN), '0.00');
});

const modelWith = (get) => {
  const calls = [];
  const loadModel = sourceLoader({
    '@/lib/axios': {
      get: async (url, config) => {
        calls.push({ url, params: config?.params });
        return { data: get(url) };
      },
    },
  });
  const Model = loadModel('src/models/sale-order.ts').default;
  return { model: new Model(), calls };
};

test('the list call sends the status filter as the JSON the API reads, and the Bangkok days', async () => {
  const { model, calls } = modelWith(() => ({ data: [], meta: { total: 0 } }));
  await model.getSaleOrders(2, 10, 'SO', 'create_date', 'DESC', 'store', { statuses: ['partially_returned', 'returned'], dateStart: '2026-11-01', dateEnd: '2026-11-03' });
  const { params } = calls[0];
  assert.equal(params.filters, JSON.stringify({ sale_order_status: ['partially_returned', 'returned'] }));
  assert.equal(params.date_start, '2026-11-01');
  assert.equal(params.date_end, '2026-11-03');
  assert.equal(params.type, 'store');
  await model.getSaleOrders(1, 10);
  assert.ok(!('filters' in calls[1].params) && !('date_start' in calls[1].params), 'nothing new is sent without a filter');
});

test('the ready-to-sell list gets the meta the API leaves out', async () => {
  const { model } = modelWith(() => ({ data: [{ fetch_sale_order_id: 'f1' }], total: 17, page: 2, limit: 8, totalPages: 3 }));
  const response = await model.getFetchSaleOrders(2, 8);
  // The module runs in its own vm context, so compare the values, not the objects.
  assert.equal(JSON.stringify(response.meta), JSON.stringify({ total: 17, page: 2, last_page: 3, limit: 8 }));
  const { model: other } = modelWith(() => ({ data: [], meta: { total: 4, page: 1, last_page: 1, limit: 10 } }));
  assert.equal((await other.getFetchSaleOrders()).meta.total, 4);
});

// AC2: the body for the same input equals what the old insert/update dialogs built (2 lines x 3 VAT types).
test('the save body has the old keys and the old VAT figures for every VAT type', () => {
  const { buildSaleOrderBody } = load('src/app/admin/sale-orders/lib/so-body.ts');
  const { calculateVatSummary } = load('src/lib/vat.ts');
  const lines = [
    { fetch_sale_order_id: 'f1', product_name: 'แก้วเก็บความเย็น', qty: 3, price: 189, cost: 90, job_order_id: 'j1' },
    { fetch_sale_order_id: 'f2', product_name: 'ป้ายชื่อ', qty: 2, price: 250.5, cost: 100, job_order_id: 'j2' },
  ];
  for (const vatType of ['none', 'include', 'exclude']) {
    for (const shippingFee of [0, 60]) {
      const body = buildSaleOrderBody({ name: ' ใบทดสอบ ', detail: 'd', address: 'a', type: 'order', vatType }, lines, shippingFee, 7);
      // The old dialogs: items qty x price, plus the stored shipping fee on update (TASK-0038).
      const old = calculateVatSummary(3 * 189 + 2 * 250.5 + shippingFee, vatType, 7);
      assert.deepEqual(Object.keys(body), [
        'sale_order_name', 'sale_order_detail', 'shipping_address_name', 'sale_order_type', 'vat_type',
        'sale_order_subtotal', 'sale_order_vat_amount', 'sale_order_total', 'saleOrderLists',
      ]);
      assert.equal(body.sale_order_name, 'ใบทดสอบ');
      assert.deepEqual([body.sale_order_subtotal, body.sale_order_vat_amount, body.sale_order_total], [old.subtotal, old.vatAmount, old.total], `${vatType} + ${shippingFee}`);
      assert.deepEqual({ ...body.saleOrderLists[1] }, {
        fetch_sale_order_id: 'f2', product_name: 'ป้ายชื่อ', sale_order_list_qty: 2, sale_order_list_price: 250.5,
        sale_order_list_total: 501, sale_order_list_cost: 100, job_order_id: 'j2',
      });
    }
  }
  // A line typed by hand has no ready-to-sell id; the key stays out of the JSON as before.
  const free = buildSaleOrderBody({ name: 'x', detail: '', address: '', type: 'order', vatType: 'none' }, [{ ...lines[0], fetch_sale_order_id: '' }], 0, 7);
  assert.equal(free.saleOrderLists[0].fetch_sale_order_id, undefined);
});
