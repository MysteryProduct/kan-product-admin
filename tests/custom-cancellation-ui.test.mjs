import { test } from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';

// TASK-0217: cancelling a Custom request on the sale order page, and taking a
// Custom order back on the parcel page. The real components are called as
// functions, the way custom-fulfillment-ui.test.mjs does it; nothing is drawn,
// so layout and focus movement are not what these tests show.

const jsx = (type, props) => ({ type, props });
const jsxRuntime = { jsx, jsxs: jsx, Fragment: 'fragment' };
const plain = (value) => JSON.parse(JSON.stringify(value));
const settle = () => new Promise((resolve) => setImmediate(resolve));

function elements(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const child of node) elements(child, out);
    return out;
  }
  out.push(node);
  elements(node.props?.children, out);
  return out;
}
function text(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return text(node.props?.children);
}
const ofType = (tree, type) => elements(tree).filter((node) => node.type === type);
const button = (tree, label) =>
  ofType(tree, 'button').find((node) => text(node) === label);

/** Hooks that keep their values between calls; `seed` presets useState slots. */
function stateful(seed = {}) {
  const slots = [];
  const refs = [];
  let at = 0;
  let refAt = 0;
  return {
    begin() {
      at = 0;
      refAt = 0;
    },
    peek: (slot) => slots[slot],
    useEffect: () => {},
    useId: () => 'f',
    useRef(value) {
      const slot = refAt++;
      if (!(slot in refs)) refs[slot] = { current: value };
      return refs[slot];
    },
    useState(initial) {
      const slot = at++;
      if (!(slot in slots))
        slots[slot] =
          slot in seed ? seed[slot] : typeof initial === 'function' ? initial() : initial;
      return [
        slots[slot],
        (next) => {
          slots[slot] = typeof next === 'function' ? next(slots[slot]) : next;
        },
      ];
    },
  };
}
/** A react double whose hooks belong to whichever component is being drawn. */
function reactFor(holder) {
  return {
    useEffect: (...args) => holder.current.useEffect(...args),
    useId: () => holder.current.useId(),
    useRef: (value) => holder.current.useRef(value),
    useState: (initial) => holder.current.useState(initial),
  };
}

// --- The sale order page: "การยกเลิกคำขอ" ------------------------------------

const cancellationRow = (set = {}) => ({
  id: 'cc-1',
  customRequestId: 'cr-1',
  status: 'pending',
  requestedBy: 'employee',
  reason: 'ลูกค้าเปลี่ยนใจ',
  createdAt: '2026-11-26T03:00:00.000Z',
  refundAccount: { name: 'สมหญิง ใจดี', bank: 'กสิกรไทย', number: '123-4-56789-0' },
  decidedAt: null,
  decisionNote: null,
  productionStage: null,
  jobOrderId: null,
  jobOrderCode: null,
  paidAmount: null,
  refundAmount: null,
  refundDue: false,
  refund: null,
  ...set,
});
const OPEN_PREVIEW = {
  canRequest: true,
  blocked: null,
  productionStage: 'in_progress',
  paidAmount: 240,
  refundAmount: 120,
};
const viewOf = (set = {}) => ({
  customRequestId: 'cr-1',
  canRequest: false,
  preview: OPEN_PREVIEW,
  current: null,
  history: [],
  ...set,
});
const EVERY = ['sale_orders:view', 'sale_orders:reject', 'payment_receipts:add', 'payment_receipts:view'];

// useState slots of the component, in the order it declares them.
const SLOT = { data: 0, reload: 2, formOpen: 3, reason: 4, account: 5, note: 6, transfer: 7, confirming: 11 };

function cancellation(view, { permissions = EVERY, seed = {}, fail } = {}) {
  const posts = [];
  const events = [];
  const hooks = stateful({
    [SLOT.data]: { code: 'CU256911260003', jobOrderId: 'job-1', view },
    ...seed,
  });
  const load = sourceLoader(
    {
      react: reactFor({ current: hooks }),
      'react/jsx-runtime': jsxRuntime,
      'next/link': 'a',
      '@/lib/axios': {
        get: async () => ({ data: {} }),
        post: async (url, body) => {
          posts.push({ url, body: plain(body) });
          if (fail) throw new Error(fail);
          return { data: {} };
        },
      },
      '@/hooks/usePendingWork': { refreshPendingWork: () => events.push('pending-work') },
      '@/hooks/usePermissions': {
        usePermissions: () => ({
          can: (menu, action = 'view') => permissions.includes(`${menu}:${action}`),
        }),
      },
      '@/lib/api-error': { getApiErrorMessage: (error) => error.message },
      '@/components/ConfirmDialog': 'confirm',
      '@/components/StatusBadge': 'badge',
    },
    { document: { getElementById: () => null } },
  );
  const Component = load('src/app/admin/sale-orders/components/custom-cancellation.tsx').default;
  const draw = () => {
    hooks.begin();
    return Component({ orderId: 'so-1', onSuccess: () => events.push('success') });
  };
  return { draw, posts, events, peek: hooks.peek };
}
const submit = (tree) => ofType(tree, 'form')[0].props.onSubmit({ preventDefault() {} });
const dialog = (tree) => ofType(tree, 'confirm')[0];

const APPROVED = cancellationRow({
  status: 'approved',
  decidedAt: '2026-11-26T04:00:00.000Z',
  productionStage: 'in_progress',
  jobOrderId: 'job/1',
  jobOrderCode: 'JO256911260007',
  paidAmount: 240,
  refundAmount: 120,
  refundDue: true,
});
const CLOSED = { canRequest: false, blocked: 'cancelled' };

// Owner decision D7: reading a cancellation needs the permission that cancels
// a sale order, because the view carries the customer's bank account.
test('without the sale order reject permission the section is not drawn, whatever else is held', () => {
  for (const view of [
    viewOf({ canRequest: true }),
    viewOf({ current: cancellationRow() }),
    viewOf({ current: APPROVED, preview: CLOSED }),
  ]) {
    const ui = cancellation(view, {
      permissions: ['sale_orders:view', 'sale_orders:approve', 'payment_receipts:add', 'payment_receipts:view'],
    });
    assert.equal(ui.draw(), null);
  }
});

test('without that permission nothing is asked of the API either', () => {
  const calls = [];
  const effects = [];
  const load = sourceLoader({
    react: {
      useEffect: (run) => effects.push(run),
      useId: () => 'f',
      useRef: (value) => ({ current: value }),
      useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
    },
    'react/jsx-runtime': jsxRuntime,
    'next/link': 'a',
    '@/lib/axios': {
      get: async (url) => {
        calls.push(url);
        return { data: {} };
      },
    },
    '@/hooks/usePendingWork': { refreshPendingWork: () => {} },
    '@/hooks/usePermissions': {
      usePermissions: () => ({ can: (menu, action = 'view') => `${menu}:${action}` === 'sale_orders:view' }),
    },
    '@/lib/api-error': { getApiErrorMessage: (error) => error.message },
    '@/components/ConfirmDialog': 'confirm',
    '@/components/StatusBadge': 'badge',
  });
  for (const file of ['custom-cancellation.tsx', 'custom-cancellation-strip.tsx']) {
    const Component = load(`src/app/admin/sale-orders/components/${file}`).default;
    assert.equal(Component({ orderId: 'so-1' }), null, file);
  }
  for (const run of effects) run();
  assert.deepEqual(calls, []);
});

test('no request yet: the refund a cancellation would bring, and one button that opens the form', () => {
  const ui = cancellation(viewOf({ canRequest: true }));
  const tree = ui.draw();
  assert.match(text(tree), /ยกเลิกตอนนี้ร้านคืนเงิน 120\.00 บาท/);
  assert.deepEqual(ofType(tree, 'button').map(text), ['บันทึกคำขอยกเลิกแทนลูกค้า']);
  assert.equal(ofType(tree, 'form').length, 0);
});

test('filing a request sends the reason and the account, trimmed, and never an amount', async () => {
  const ui = cancellation(viewOf({ canRequest: true }), {
    seed: {
      [SLOT.formOpen]: true,
      [SLOT.reason]: '  ลูกค้าเปลี่ยนใจ  ',
      [SLOT.account]: { name: ' สมหญิง ใจดี ', bank: 'กสิกรไทย', number: '123-4-56789-0' },
    },
  });
  submit(ui.draw());
  await settle();
  assert.deepEqual(ui.posts, [
    {
      url: '/custom-cancellation/requests/cr-1',
      body: {
        reason: 'ลูกค้าเปลี่ยนใจ',
        refund_account_name: 'สมหญิง ใจดี',
        refund_account_bank: 'กสิกรไทย',
        refund_account_number: '123-4-56789-0',
      },
    },
  ]);
  assert.deepEqual(ui.events, ['pending-work', 'success']);
});

test('a request with money received is not sent until the reason and the whole account are there', () => {
  const ui = cancellation(viewOf({ canRequest: true }), {
    seed: { [SLOT.formOpen]: true, [SLOT.account]: { name: 'สมหญิง', bank: '', number: '' } },
  });
  submit(ui.draw());
  assert.deepEqual(ui.posts, []);
  const tree = ui.draw();
  const flagged = ofType(tree, 'input')
    .concat(ofType(tree, 'textarea'))
    .filter((node) => node.props['aria-invalid']);
  assert.equal(flagged.length, 3, 'reason, bank and number');
  assert.match(text(tree), /กรุณากรอกเหตุผลที่ลูกค้าขอยกเลิก/);
});

test('a request on which nothing was paid asks for no account and sends none', async () => {
  const ui = cancellation(
    viewOf({ canRequest: true, preview: { ...OPEN_PREVIEW, productionStage: 'not_started', paidAmount: 0, refundAmount: 0 } }),
    { seed: { [SLOT.formOpen]: true, [SLOT.reason]: 'เปลี่ยนใจ' } },
  );
  const tree = ui.draw();
  assert.equal(ofType(tree, 'input').length, 0);
  submit(tree);
  await settle();
  assert.deepEqual(ui.posts, [{ url: '/custom-cancellation/requests/cr-1', body: { reason: 'เปลี่ยนใจ' } }]);
});

test('a failed save keeps what was typed and shows the reason as an alert', async () => {
  const ui = cancellation(viewOf({ canRequest: true, preview: { ...OPEN_PREVIEW, paidAmount: 0, refundAmount: 0 } }), {
    seed: { [SLOT.formOpen]: true, [SLOT.reason]: 'เปลี่ยนใจ' },
    fail: 'มีคำขอยกเลิกค้างอยู่แล้ว',
  });
  submit(ui.draw());
  await settle();
  const tree = ui.draw();
  assert.equal(ofType(tree, 'textarea')[0].props.value, 'เปลี่ยนใจ');
  const alerts = elements(tree).filter((node) => node.props?.role === 'alert');
  assert.deepEqual(alerts.map(text), ['มีคำขอยกเลิกค้างอยู่แล้ว']);
  assert.deepEqual(ui.events, []);
});

test('approval goes through the confirmation dialog and sends only the decision and the note', async () => {
  const ui = cancellation(viewOf({ current: cancellationRow() }), { seed: { [SLOT.note]: ' แจ้งลูกค้าแล้ว ' } });
  let tree = ui.draw();
  assert.match(text(tree), /ยอดที่ต้องโอนคืน 120\.00 บาท/);
  assert.equal(dialog(tree).props.isOpen, false);
  button(tree, 'อนุมัติยกเลิก').props.onClick();
  assert.deepEqual(ui.posts, [], 'the button itself decides nothing');
  tree = ui.draw();
  const confirm = dialog(tree);
  assert.equal(confirm.props.isOpen, true);
  assert.equal(confirm.props.title, 'ยืนยันอนุมัติยกเลิกคำขอ CU256911260003');
  assert.match(confirm.props.message, /ย้อนกลับไม่ได้/);
  assert.match(text(confirm), /งานผลิตเริ่มผลิตแล้ว ระบบไม่ยกเลิกงานและไม่คืนวัตถุดิบให้เอง/);
  assert.match(text(confirm), /ร้านต้องโอนคืน 120\.00 บาท/);
  confirm.props.onConfirm();
  await settle();
  assert.deepEqual(ui.posts, [
    {
      url: '/custom-cancellation/cc-1/decision',
      // The stage the dialog's figure came from goes with the approval; no amount does.
      body: { decision: 'approve', note: 'แจ้งลูกค้าแล้ว', expected_stage: 'in_progress' },
    },
  ]);
  assert.deepEqual(ui.events, ['pending-work', 'success']);
});

test('an approval before production starts says so to the API', async () => {
  const ui = cancellation(
    viewOf({ current: cancellationRow(), preview: { ...OPEN_PREVIEW, productionStage: 'not_started', refundAmount: 240 } }),
  );
  dialog(ui.draw()).props.onConfirm();
  await settle();
  assert.deepEqual(ui.posts[0].body, { decision: 'approve', expected_stage: 'not_started' });
});

test('when production moved on before the approval, the refusal is shown, the card is read again and nothing counts as done', async () => {
  const refusal = 'สถานะงานผลิตเปลี่ยนไปแล้ว ยอดคืนจึงเปลี่ยน กรุณาตรวจยอดใหม่แล้วยืนยันอีกครั้ง';
  const ui = cancellation(viewOf({ current: cancellationRow() }), { fail: refusal });
  ui.draw();
  const before = ui.peek(SLOT.reload);
  button(ui.draw(), 'อนุมัติยกเลิก').props.onClick();
  dialog(ui.draw()).props.onConfirm();
  // ConfirmDialog closes itself with the confirmation, as it calls onCancel after onConfirm.
  dialog(ui.draw()).props.onCancel();
  await settle();
  const tree = ui.draw();
  assert.deepEqual(
    elements(tree).filter((node) => node.props?.role === 'alert').map(text),
    [refusal],
  );
  assert.equal(ui.peek(SLOT.reload), before + 1, 'the view is loaded again');
  assert.equal(dialog(tree).props.isOpen, false, 'the employee must open the dialog and confirm again');
  assert.ok(button(tree, 'อนุมัติยกเลิก'), 'the request is still to be decided');
  assert.deepEqual(ui.events, []);
});

test('another refusal of a decision does not read the card again', async () => {
  const ui = cancellation(viewOf({ current: cancellationRow() }), { fail: 'คำขอยกเลิกนี้ได้รับการพิจารณาไปแล้ว' });
  ui.draw();
  const before = ui.peek(SLOT.reload);
  dialog(ui.draw()).props.onConfirm();
  await settle();
  assert.equal(ui.peek(SLOT.reload), before);
});

test('before production starts the dialog says the job is cancelled and the refund is in full', () => {
  const ui = cancellation(
    viewOf({ current: cancellationRow(), preview: { ...OPEN_PREVIEW, productionStage: 'not_started', refundAmount: 240 } }),
  );
  const words = text(dialog(ui.draw()));
  assert.match(words, /งานผลิตถูกยกเลิกและคืนยอดจองวัตถุดิบ/);
  assert.match(words, /ร้านต้องโอนคืน 240\.00 บาท \(เต็มจำนวนที่รับชำระ\)/);
});

test('rejecting sends the decision at once, and a second click while it runs sends nothing more', async () => {
  const ui = cancellation(viewOf({ current: cancellationRow() }));
  const reject = button(ui.draw(), 'ปฏิเสธคำขอ');
  reject.props.onClick();
  reject.props.onClick();
  await settle();
  assert.deepEqual(ui.posts, [{ url: '/custom-cancellation/cc-1/decision', body: { decision: 'reject' } }]);
});

test('a pending request on goods already produced can only be rejected', () => {
  const ui = cancellation(
    viewOf({ current: cancellationRow(), preview: { canRequest: false, blocked: 'produced' } }),
  );
  const tree = ui.draw();
  assert.deepEqual(ofType(tree, 'button').map(text), ['ปฏิเสธคำขอ']);
  assert.match(text(tree), /งานนี้ผลิตเสร็จแล้ว อนุมัติยกเลิกไม่ได้ ปฏิเสธคำขอได้อย่างเดียว/);
});

test('recording the transfer sends the reference and the day, and never an amount', async () => {
  const ui = cancellation(viewOf({ current: APPROVED, preview: CLOSED }), {
    seed: { [SLOT.transfer]: { reference: ' 2026112600451 ', date: '2026-11-26' } },
  });
  const tree = ui.draw();
  assert.match(text(tree), /โอนคืน 120\.00 บาท/);
  assert.match(text(tree), /เข้าบัญชี สมหญิง ใจดี · กสิกรไทย · 123-4-56789-0/);
  const [job] = ofType(tree, 'a');
  assert.equal(job.props.href, '/admin/job-orders?jobId=job%2F1');
  assert.equal(text(button(tree, 'บันทึกการโอนคืน 120.00 บาท')), 'บันทึกการโอนคืน 120.00 บาท');
  submit(tree);
  await settle();
  assert.deepEqual(ui.posts, [
    {
      url: '/custom-cancellation/cc-1/refund',
      body: { reference: '2026112600451', transferred_at: '2026-11-26T00:00:00.000Z' },
    },
  ]);
});

test('the transfer is not sent without a reference', () => {
  const ui = cancellation(viewOf({ current: APPROVED, preview: CLOSED }));
  submit(ui.draw());
  assert.deepEqual(ui.posts, []);
  assert.match(text(ui.draw()), /กรุณากรอกเลขอ้างอิงการโอนจากสลิป/);
});

test('the transfer form needs the receipt permission as well as the reject one', () => {
  const ui = cancellation(viewOf({ current: APPROVED, preview: CLOSED }), {
    permissions: ['sale_orders:view', 'sale_orders:reject'],
  });
  const tree = ui.draw();
  assert.equal(ofType(tree, 'form').length, 0);
  assert.equal(ofType(tree, 'input').length, 0);
  assert.equal(ofType(tree, 'button').length, 0);
  assert.match(text(tree), /ต้องมีสิทธิ์ยกเลิกในเมนูใบสั่งขาย\s+และสิทธิ์เพิ่มในเมนูใบเสร็จรับเงิน จึงจะบันทึกการโอนคืนได้/);
  // The amount owed stays readable.
  assert.match(text(tree), /โอนคืน 120\.00 บาท/);
  // The receipt permission alone reads nothing (D7).
  assert.equal(
    cancellation(viewOf({ current: APPROVED, preview: CLOSED }), {
      permissions: ['sale_orders:view', 'payment_receipts:add'],
    }).draw(),
    null,
  );
});

test('no job warning when production had not started at approval', () => {
  const ui = cancellation(
    viewOf({ current: { ...APPROVED, productionStage: 'not_started' }, preview: CLOSED }),
  );
  assert.doesNotMatch(text(ui.draw()), /ยังเปิดอยู่/);
});

test('finished states: refunded, nothing to refund, rejected, produced', () => {
  const refunded = cancellation(
    viewOf({
      preview: CLOSED,
      current: {
        ...APPROVED,
        refundDue: false,
        refund: { reference: '2026112600451', transferredAt: '2026-11-26T00:00:00.000Z', recordedAt: '2026-11-26T05:00:00.000Z', paymentReceiptId: 'pr-1' },
      },
    }),
  ).draw();
  assert.match(text(refunded), /โอนคืน 120\.00 บาท เมื่อ .* · อ้างอิง 2026112600451/);
  assert.deepEqual(ofType(refunded, 'a').map((node) => node.props.href), ['/admin/payment-receipts']);
  assert.deepEqual(ofType(refunded, 'badge').map(text), ['ยกเลิกแล้ว', 'โอนคืนแล้ว']);
  assert.equal(ofType(refunded, 'button').length, 0);

  const nothing = cancellation(
    viewOf({ preview: CLOSED, current: { ...APPROVED, paidAmount: 0, refundAmount: 0, refundDue: false } }),
  ).draw();
  assert.match(text(nothing), /ไม่มียอดที่ต้องคืน/);
  assert.equal(ofType(nothing, 'form').length, 0);

  const rejected = cancellationRow({ status: 'rejected', decidedAt: '2026-11-26T04:00:00.000Z', decisionNote: 'ลูกค้าตกลงรับสินค้าตามเดิม' });
  const again = cancellation(viewOf({ canRequest: true, history: [rejected] })).draw();
  assert.match(text(again), /ปฏิเสธเมื่อ .* · หมายเหตุ: ลูกค้าตกลงรับสินค้าตามเดิม/);
  assert.deepEqual(ofType(again, 'button').map(text), ['บันทึกคำขอยกเลิกแทนลูกค้า']);

  const produced = cancellation(viewOf({ preview: { canRequest: false, blocked: 'produced' } })).draw();
  assert.match(text(produced), /งานนี้ผลิตเสร็จแล้ว ยกเลิกไม่ได้/);
  assert.equal(ofType(produced, 'button').length, 0);
});

// --- The sale order list: work that waits ------------------------------------

function strip(queue, permissions = ['sale_orders:reject']) {
  const load = sourceLoader({
    react: { useEffect: () => {}, useState: () => [queue, () => {}] },
    'react/jsx-runtime': jsxRuntime,
    'next/link': 'a',
    '@/lib/axios': {},
    '@/hooks/usePermissions': {
      usePermissions: () => ({ can: (menu, action = 'view') => permissions.includes(`${menu}:${action}`) }),
    },
    '@/components/StatusBadge': 'badge',
  });
  return load('src/app/admin/sale-orders/components/custom-cancellation-strip.tsx').default({});
}
const queueRow = (n, set = {}) => ({
  ...cancellationRow({ id: `cc-${n}`, ...set }),
  customRequestCode: `CU${n}`,
  saleOrderId: `so-${n}`,
  saleOrderCode: `SO${n}`,
  buyerName: 'ลูกค้า',
});

test('the list strip is absent with nothing waiting, after a failed load, and without the reject permission', () => {
  assert.equal(strip({ data: [], meta: { total: 0 } }), null);
  assert.equal(strip(null), null);
  assert.equal(strip({ data: [queueRow(1)], meta: { total: 1 } }, []), null);
  // Seeing sale orders is not enough (D7).
  assert.equal(strip({ data: [queueRow(1)], meta: { total: 1 } }, ['sale_orders:view']), null);
});

test('the list strip counts the work, links each sale order and says what it waits for', () => {
  const tree = strip({
    data: [queueRow(1), queueRow(2, { status: 'approved', refundAmount: 300, refundDue: true })],
    meta: { total: 2 },
  });
  assert.deepEqual(ofType(tree, 'badge').map(text), ['คำขอยกเลิก Custom ค้าง 2 รายการ']);
  assert.deepEqual(ofType(tree, 'a').map((node) => node.props.href), ['/admin/sale-orders/so-1', '/admin/sale-orders/so-2']);
  assert.deepEqual(ofType(tree, 'li').map(text), ['CU1 · SO1 — รอพิจารณา', 'CU2 · SO2 — รอโอนคืน 300.00 บาท']);
  assert.doesNotMatch(text(tree), /และอีก/);
});

test('the list strip shows five lines and counts the rest', () => {
  const tree = strip({ data: [1, 2, 3, 4, 5, 6].map((n) => queueRow(n)), meta: { total: 8 } });
  assert.equal(ofType(tree, 'li').length, 5);
  assert.match(text(tree), /คำขอยกเลิก Custom ค้าง 8 รายการ/);
  assert.match(text(tree), /และอีก 3 รายการ/);
});

// --- The parcel page: a Custom order coming back ------------------------------

function returnCard(returns, { canEdit = true, orderStatus = 'paid' } = {}) {
  const posts = [];
  const holder = { current: stateful() };
  const card = holder.current;
  const form = stateful();
  let changed = 0;
  const load = sourceLoader(
    {
      react: reactFor(holder),
      'react/jsx-runtime': jsxRuntime,
      '@/lib/axios': {
        post: async (url, body) => {
          posts.push({ url, body: plain(body) });
          return { data: {} };
        },
      },
      '@/hooks/useNow': { useNow: () => Date.parse('2026-11-26T05:00:00.000Z') },
      '@/lib/api-error': { getApiErrorMessage: (error) => error.message },
      '@/components/ConfirmDialog': 'confirm',
      '@/components/CustomSelect': 'select',
      './cancellation-card': { RefundPanel: 'refund-panel' },
    },
    {
      crypto: { randomUUID: () => '11111111-1111-4111-8111-111111111111' },
      document: { getElementById: () => null },
    },
  );
  const Component = load('src/app/admin/store-fulfillment/components/return-card.tsx').default;
  const draw = () => {
    holder.current = card;
    card.begin();
    return Component({
      storeOrderId: 'order-1',
      orderStatus,
      returns,
      canEdit,
      onChanged: () => {
        changed += 1;
      },
    });
  };
  // The Custom form is its own component inside the card.
  const drawForm = () => {
    const node = elements(draw()).find((item) => typeof item.type === 'function');
    if (!node) return null;
    holder.current = form;
    form.begin();
    return node.type(node.props);
  };
  return { draw, drawForm, posts, changed: () => changed };
}
const LINE = {
  saleOrderListId: 'line-1',
  productName: 'แก้วสั่งผลิต',
  unitPrice: 120,
  purchasedQty: 10,
  deliveredQty: 10,
  returnedQty: 0,
  returnableQty: 10,
};
// Shipped more than 30 days before the clock above.
const RECEIVED = [{ source: 'parcel', date: '2026-10-01T04:00:00.000Z' }];
const customReturns = (set = {}) => ({
  custom: { canReturn: true, returned: false, refundAmount: 1200 },
  lines: [LINE],
  receivedDates: RECEIVED,
  returns: [],
  ...set,
});

test('the Custom return card keeps the dates, drops the 30-day warning and the store form, and says what may come back', () => {
  const ui = returnCard(customReturns());
  const tree = ui.draw();
  assert.match(text(tree), /ส่งพัสดุ .* · ผ่านมา 56 วัน/);
  assert.doesNotMatch(text(tree), /ผ่านมาเกิน 30 วันแล้ว/);
  assert.match(text(tree), /งานสั่งผลิตรับคืนได้เฉพาะสินค้าชำรุด หรือผลิตไม่ตรงแบบที่อนุมัติ/);
  assert.doesNotMatch(text(tree), /บันทึกรับคืนสินค้า|นำกลับเข้าสต็อกพร้อมขาย/);
  const form = ui.drawForm();
  assert.match(text(form), /คืนเงิน 1,200\.00 บาท/);
  const radios = ofType(form, 'input').filter((node) => node.props.type === 'radio');
  assert.deepEqual(radios.map((node) => node.props.checked), [false, false]);
  assert.equal(ofType(form, 'fieldset').length, 1);
  assert.match(text(ofType(form, 'legend')[0]), /กรณีที่รับคืน/);
});

test('the Custom form is absent when the order cannot be returned, is not paid, or the employee cannot edit', () => {
  assert.equal(returnCard(customReturns({ custom: { canReturn: false, returned: true, refundAmount: 0 } })).drawForm(), null);
  assert.equal(returnCard(customReturns(), { orderStatus: 'cancelled' }).drawForm(), null);
  assert.equal(returnCard(customReturns(), { canEdit: false }).drawForm(), null);
});

test('a Custom order not yet shipped in full says when it can be returned, and has no form', () => {
  const NOT_YET = /รับคืนงานสั่งผลิตได้เมื่อจัดส่งครบทุกชิ้นแล้ว/;
  const partly = returnCard(customReturns({ custom: { canReturn: false, returned: false, refundAmount: 1200 } }));
  assert.match(text(partly.draw()), NOT_YET);
  assert.equal(partly.drawForm(), null);
  // Not once it can be returned, nor once it has been.
  assert.doesNotMatch(text(returnCard(customReturns()).draw()), NOT_YET);
  const returned = returnCard(
    customReturns({
      custom: { canReturn: false, returned: true, refundAmount: 0 },
      returns: [{ returnId: 'ret-1', reason: 'defective', note: null, goodsReturned: true, createdBy: 'e', createdAt: '2026-11-26T03:00:00.000Z', items: [], refund: null }],
    }),
  );
  assert.doesNotMatch(text(returned.draw()), NOT_YET);
  // A Store order never shows it.
  assert.doesNotMatch(text(returnCard({ lines: [LINE], receivedDates: RECEIVED, returns: [] }).draw()), NOT_YET);
});

test('the Custom form asks for the case first and takes the account whole or not at all', () => {
  const ui = returnCard(customReturns());
  button(ui.drawForm(), 'บันทึกรับคืน').props.onClick();
  let form = ui.drawForm();
  assert.equal(ofType(form, 'confirm')[0].props.isOpen, false);
  assert.match(text(form), /กรุณาเลือกกรณีที่รับคืน/);

  const radios = ofType(form, 'input').filter((node) => node.props.type === 'radio');
  radios[1].props.onChange();
  const name = ofType(ui.drawForm(), 'input').find((node) => node.props.maxLength === 120);
  name.props.onChange({ target: { value: 'สมหญิง ใจดี' } });
  button(ui.drawForm(), 'บันทึกรับคืน').props.onClick();
  form = ui.drawForm();
  assert.equal(ofType(form, 'confirm')[0].props.isOpen, false);
  assert.match(text(form), /กรอกบัญชีรับเงินคืนให้ครบทั้งสามช่อง หรือเว้นว่างทั้งหมด/);
  assert.deepEqual(ui.posts, []);
});

test('the Custom form posts to the Custom route with only its own fields, after the dialog', async () => {
  const ui = returnCard(customReturns());
  let form = ui.drawForm();
  ofType(form, 'input').filter((node) => node.props.type === 'radio')[1].props.onChange();
  ofType(form, 'input').find((node) => node.props.type === 'checkbox').props.onChange({ target: { checked: true } });
  ofType(form, 'textarea')[0].props.onChange({ target: { value: ' ลายไม่ตรง ' } });
  button(ui.drawForm(), 'บันทึกรับคืน').props.onClick();
  assert.deepEqual(ui.posts, [], 'the button opens the dialog');
  form = ui.drawForm();
  const confirm = ofType(form, 'confirm')[0];
  assert.equal(confirm.props.isOpen, true);
  assert.match(confirm.props.message, /คืนเงิน 1,200\.00 บาท ร้านเป็นผู้โอนคืนเอง/);
  assert.match(confirm.props.message, /ย้อนกลับไม่ได้ และรับคืนได้ครั้งเดียวต่อคำสั่งซื้อ/);
  confirm.props.onConfirm();
  confirm.props.onConfirm();
  await settle();
  assert.deepEqual(ui.posts, [
    {
      url: '/fulfillment/returns/orders/order-1/custom',
      body: {
        return_reference: '11111111-1111-4111-8111-111111111111',
        reason: 'not_as_approved',
        note: 'ลายไม่ตรง',
        goods_returned: true,
      },
    },
  ]);
  assert.equal(ui.changed(), 1);
});

test('a stated account goes with the Custom return, all three fields', async () => {
  const ui = returnCard(customReturns());
  ofType(ui.drawForm(), 'input').filter((node) => node.props.type === 'radio')[0].props.onChange();
  for (const [index, value] of ['สมหญิง ใจดี', 'กสิกรไทย', '123-4-56789-0'].entries()) {
    ofType(ui.drawForm(), 'input').filter((node) => node.props.className === 'ka-input')[index].props.onChange({ target: { value } });
  }
  button(ui.drawForm(), 'บันทึกรับคืน').props.onClick();
  ofType(ui.drawForm(), 'confirm')[0].props.onConfirm();
  await settle();
  assert.deepEqual(ui.posts[0].body, {
    return_reference: '11111111-1111-4111-8111-111111111111',
    reason: 'defective',
    goods_returned: false,
    refund_account_name: 'สมหญิง ใจดี',
    refund_account_bank: 'กสิกรไทย',
    refund_account_number: '123-4-56789-0',
  });
});

test('a recorded Custom return shows its own reason, whether the goods are back, and the Custom refund panel', () => {
  const record = (set) => ({
    returnId: 'ret-1',
    reason: 'wrong_item',
    note: null,
    goodsReturned: true,
    createdBy: 'emp-1',
    createdAt: '2026-11-26T03:00:00.000Z',
    items: [{ productName: 'แก้วสั่งผลิต', quantity: 10, unitPrice: 120, restocked: false }],
    refund: { refundId: 'rf-1' },
    ...set,
  });
  const ui = returnCard(
    customReturns({ custom: { canReturn: false, returned: true, refundAmount: 0 }, returns: [record()] }),
  );
  const tree = ui.draw();
  assert.match(text(tree), /รับคืนเมื่อ .* · ผลิตไม่ตรงแบบที่อนุมัติ/);
  assert.match(text(tree), /แก้วสั่งผลิต × 10 · ได้รับของกลับแล้ว · ไม่นำกลับเข้าสต็อก/);
  const [panel] = ofType(tree, 'refund-panel');
  assert.equal(panel.props.title, 'การคืนเงินงานสั่งผลิตที่รับคืน');
  assert.equal(panel.props.customOrder, true);
  assert.equal(ui.drawForm(), null);

  const notBack = returnCard(
    customReturns({ custom: { canReturn: false, returned: true, refundAmount: 0 }, returns: [record({ reason: 'defective', goodsReturned: false })] }),
  ).draw();
  assert.match(text(notBack), /รับคืนเมื่อ .* · สินค้าชำรุด/);
  assert.match(text(notBack), /ยังไม่ได้รับของกลับ/);
});

test('a Custom return shows only what staff typed as its note, not the reason the API puts before it', () => {
  const record = (note) => ({
    returnId: 'ret-1',
    reason: 'defective',
    note,
    goodsReturned: true,
    createdBy: 'emp-1',
    createdAt: '2026-11-26T03:00:00.000Z',
    items: [],
    refund: null,
  });
  const words = (note) =>
    text(
      returnCard(
        customReturns({ custom: { canReturn: false, returned: true, refundAmount: 0 }, returns: [record(note)] }),
      ).draw(),
    );
  assert.doesNotMatch(words('สินค้าชำรุด'), /หมายเหตุ/);
  assert.match(words('สินค้าชำรุด: หูแก้วร้าว'), /หมายเหตุ: หูแก้วร้าว/);
  assert.doesNotMatch(words('สินค้าชำรุด: หูแก้วร้าว'), /หมายเหตุ: สินค้าชำรุด/);
  assert.match(words('โทรแจ้งแล้ว'), /หมายเหตุ: โทรแจ้งแล้ว/);
});

test('the store return card is as before: 30-day warning, store wording, and a form that posts items', async () => {
  const ui = returnCard({
    lines: [LINE],
    receivedDates: RECEIVED,
    returns: [
      {
        returnId: 'ret-0',
        reason: 'wrong_item',
        note: null,
        goodsReturned: null,
        createdBy: 'emp-1',
        createdAt: '2026-11-20T03:00:00.000Z',
        items: [{ productName: 'แก้ว', quantity: 1, unitPrice: 120, restocked: true }],
        refund: { refundId: 'rf-0' },
      },
    ],
  });
  let tree = ui.draw();
  assert.match(text(tree), /ผ่านมาเกิน 30 วันแล้ว/);
  assert.doesNotMatch(text(tree), /งานสั่งผลิต|ได้รับของกลับ/);
  assert.match(text(tree), /รับคืนเมื่อ .* · สินค้าไม่ตรงตามที่สั่ง/);
  assert.match(text(tree), /แก้ว × 1 · นำกลับเข้าสต็อกแล้ว/);
  const [panel] = ofType(tree, 'refund-panel');
  assert.equal(panel.props.title, 'การคืนเงินค่าสินค้าที่คืน');
  assert.equal(panel.props.customOrder, false);
  assert.equal(ui.drawForm(), null, 'no Custom form');

  ofType(tree, 'button').find((node) => node.props['aria-label'] === 'เพิ่มจำนวน').props.onClick();
  ofType(ui.draw(), 'select')[0].props.onChange('defective');
  tree = ui.draw();
  button(tree, 'บันทึกรับคืนและคืนเงิน 120.00 บาท').props.onClick();
  ofType(ui.draw(), 'confirm')[0].props.onConfirm();
  await settle();
  assert.deepEqual(ui.posts, [
    {
      url: '/fulfillment/returns/orders/order-1',
      body: {
        return_reference: '11111111-1111-4111-8111-111111111111',
        reason: 'defective',
        items: [{ sale_order_list_id: 'line-1', quantity: 1, restock: false }],
      },
    },
  ]);
});

// --- The refund panel: what a transfer refund says ----------------------------

function refundPanelText(props) {
  const load = sourceLoader({
    react: { useState: (value) => [value, () => {}] },
    'react/jsx-runtime': jsxRuntime,
    '@/models/store-fulfillment': class {},
    '@/lib/api-error': { getApiErrorMessage: (error) => String(error) },
    '@/components/StatusBadge': 'badge',
  });
  const { RefundPanel } = load('src/app/admin/store-fulfillment/components/cancellation-card.tsx');
  return text(
    RefundPanel({
      title: 'การคืนเงิน',
      refund: {
        refundId: 'rf-1',
        status: 'pending',
        refundChannel: 'manual_transfer',
        manualRefundRequired: true,
        accountRequired: false,
        amount: 1200,
        confirmedAmount: null,
        gatewayRefundId: null,
        failureReason: null,
        attempts: 0,
      },
      account: null,
      canEdit: true,
      onChanged: () => {},
      ...props,
    }),
  );
}
const PROMPTPAY = /ยอดนี้ชำระด้วยพร้อมเพย์ ผู้ให้บริการคืนเงินให้ไม่ได้ ต้องโอนคืนเข้าบัญชีลูกค้าแล้วบันทึกหลักฐานการโอนที่นี่/;
const CUSTOM_TRANSFER = /งานสั่งผลิตคืนเงินด้วยการโอนจากร้าน โอนแล้วบันทึกหลักฐานที่นี่/;

test('the refund panel keeps the PromptPay wording unless it is told the order is Custom', () => {
  for (const props of [{}, { customOrder: false }]) {
    const words = refundPanelText(props);
    assert.match(words, PROMPTPAY);
    assert.doesNotMatch(words, CUSTOM_TRANSFER);
  }
  const custom = refundPanelText({ customOrder: true });
  assert.match(custom, CUSTOM_TRANSFER);
  assert.doesNotMatch(custom, /พร้อมเพย์/);
});
