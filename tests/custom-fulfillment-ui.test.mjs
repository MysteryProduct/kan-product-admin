import { test } from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';

// TASK-0220: the Admin decisions around a Custom order on the parcel page.
// The real components are called as functions, the way
// custom-document-links.test.mjs does it; nothing is drawn, so layout and
// focus movement are not what these tests show.

const jsx = (type, props) => ({ type, props });
const jsxRuntime = { jsx, jsxs: jsx, Fragment: 'fragment' };
// Objects made inside the loader's context are not the test's own.
const plain = (value) => JSON.parse(JSON.stringify(value));

/** Every element under a node, including what a dialog keeps in `footer`. */
function elements(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const child of node) elements(child, out);
    return out;
  }
  out.push(node);
  elements(node.props?.footer, out);
  elements(node.props?.children, out);
  return out;
}
function text(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return text(node.props?.children);
}
const buttons = (tree) => elements(tree).filter((node) => node.type === 'button');

/** useState that keeps its values between calls of the component. */
function stateful() {
  const slots = [];
  let at = 0;
  return {
    begin() {
      at = 0;
    },
    react: {
      useEffect: () => {},
      useId: () => 'field',
      useRef: (value) => ({ current: value }),
      useState(initial) {
        const slot = at++;
        if (!(slot in slots))
          slots[slot] = typeof initial === 'function' ? initial() : initial;
        return [
          slots[slot],
          (next) => {
            slots[slot] = typeof next === 'function' ? next(slots[slot]) : next;
          },
        ];
      },
    },
  };
}

// --- The sale order page: "ส่งเข้าหน้าจัดส่ง" --------------------------------

const SEND = 'ส่งเข้าหน้าจัดส่ง';
const SENT = 'ส่งเข้าหน้าจัดส่งแล้ว';

function customPayment(info, permissions, status = 'paid') {
  let state = 0;
  const load = sourceLoader({
    react: {
      useEffect: () => {},
      useRef: (value) => ({ current: value }),
      useState: (value) => [state++ === 0 ? info : value, () => {}],
    },
    'react/jsx-runtime': jsxRuntime,
    'next/link': 'a',
    '@/lib/axios': {},
    '@/hooks/usePendingWork': { refreshPendingWork: () => {} },
    '@/hooks/usePermissions': {
      usePermissions: () => ({
        can: (menu, action) => permissions.includes(`${menu}:${action}`),
      }),
    },
    '@/components/CustomSelect': 'select',
  });
  const Component = load(
    'src/app/admin/sale-orders/components/custom-payment.tsx',
  ).default;
  const tree = Component({ orderId: 'so-1', status });
  return {
    words: text(tree),
    // A button that sends, whatever its wording while it is busy.
    sendButtons: buttons(tree).filter((node) => text(node).includes(SEND)),
    allButtons: buttons(tree),
  };
}
const request = (set = {}) => ({
  code: 'CU202611260001',
  status: 'produced',
  depositRequired: 20,
  depositPaid: true,
  outstanding: 0,
  jobOrderId: 'job-1',
  storeOrderId: null,
  receivingAccount: null,
  ...set,
});
const EVERY = [
  'sale_orders:approve',
  'payment_receipts:add',
  'store_fulfillment:add',
];

test('a request still in production has no send button, and says when it will', () => {
  for (const status of ['approved_for_production', 'in_production']) {
    const seen = customPayment(request({ status, outstanding: 80 }), EVERY, 'partial');
    assert.equal(seen.sendButtons.length, 0, status);
    assert.match(seen.words, /ส่งเข้าหน้าจัดส่งได้เมื่อผลิตเสร็จและชำระครบแล้ว/, status);
    assert.doesNotMatch(seen.words, /ชำระครบและผลิตเสร็จแล้ว/, status);
  }
});

test('a produced request with a balance owed has no send button, and asks for the balance first', () => {
  for (const status of ['produced', 'awaiting_balance']) {
    const seen = customPayment(request({ status, outstanding: 80 }), EVERY, 'partial');
    assert.equal(seen.sendButtons.length, 0, status);
    assert.match(seen.words, /ชำระยอดคงเหลือให้ครบก่อน จึงส่งเข้าหน้าจัดส่งได้/, status);
    // The only button is the one that records the balance.
    assert.deepEqual(seen.allButtons.map(text), ['บันทึกรับยอดคงเหลือ'], status);
  }
});

test('a produced, fully paid request shows exactly one send button to someone who may add parcels', () => {
  const seen = customPayment(request(), ['store_fulfillment:add']);
  assert.deepEqual(seen.allButtons.map(text), [SEND]);
  assert.equal(seen.sendButtons[0].props.disabled, false);
  assert.match(seen.words, /ชำระครบและผลิตเสร็จแล้ว/);
  assert.doesNotMatch(seen.words, new RegExp(SENT));
});

test('without the parcel permission the same request shows no button and says which permission is needed', () => {
  const seen = customPayment(request(), ['sale_orders:approve', 'payment_receipts:add']);
  assert.equal(seen.allButtons.length, 0);
  assert.match(seen.words, /ต้องมีสิทธิ์เพิ่มในเมนูจัดส่งพัสดุจึงจะส่งเข้าหน้าจัดส่งได้/);
});

test('a request already sent says so and has no send button', () => {
  const seen = customPayment(
    request({ status: 'ready_to_ship', storeOrderId: 'order-1' }),
    EVERY,
  );
  assert.equal(seen.allButtons.length, 0);
  assert.match(seen.words, new RegExp(SENT));
  assert.doesNotMatch(seen.words, /ชำระครบและผลิตเสร็จแล้ว/);
});

test('a cancelled sale order has no send button even when produced and paid', () => {
  const seen = customPayment(request(), EVERY, 'cancelled');
  assert.equal(seen.allButtons.length, 0);
  assert.doesNotMatch(seen.words, new RegExp(SENT));
});

// --- The parcel page: quantities of a new parcel -----------------------------

const OVER = 'จำนวนที่ส่งเกินยอดคงเหลือ';

function parcelDialog(remainingUnshipped = 2) {
  const hooks = stateful();
  const created = [];
  const focused = [];
  let succeeded = 0;
  const load = sourceLoader(
    {
      react: hooks.react,
      'react/jsx-runtime': jsxRuntime,
      '@/components/Modal': 'modal',
      '@/models/store-fulfillment': class {
        createParcel(storeOrderId, body) {
          created.push({ storeOrderId, body });
          return Promise.resolve({ parcelId: 'parcel-1' });
        }
      },
      '@/lib/api-error': { getApiErrorMessage: (error) => String(error) },
      './sf-icon': 'icon',
    },
    {
      document: {
        getElementById: (id) => ({ focus: () => focused.push(id) }),
      },
    },
  );
  const Component = load(
    'src/app/admin/store-fulfillment/components/create-parcel-modal.tsx',
  ).default;
  const props = {
    isOpen: true,
    onClose: () => {},
    onSuccess: () => {
      succeeded += 1;
    },
    storeOrderId: 'order-1',
    lines: [
      {
        saleOrderListId: 'line-1',
        productName: 'แก้วสั่งผลิต',
        purchasedQty: 3,
        shippedQty: 3 - remainingUnshipped,
        remainingUnshipped,
      },
    ],
    defaultAddress: null,
  };
  const draw = () => {
    hooks.begin();
    return Component(props);
  };
  const quantity = () =>
    elements(draw()).find(
      (node) => node.type === 'input' && node.props.type === 'number',
    );
  const alerts = () =>
    elements(draw()).filter((node) => node.props?.role === 'alert');
  const button = (label) =>
    buttons(draw()).find(
      (node) => node.props['aria-label'] === label || text(node) === label,
    );
  return {
    created,
    focused,
    succeeded: () => succeeded,
    quantity,
    alerts,
    button,
    type(value) {
      quantity().props.onChange({ target: { value } });
    },
    leave() {
      quantity().props.onBlur();
    },
    fillCarrier() {
      const [carrier, tracking] = elements(draw()).filter(
        (node) => node.type === 'input' && node.props.maxLength === 120,
      );
      carrier.props.onChange({ target: { value: 'Flash Express' } });
      tracking.props.onChange({ target: { value: 'TH0123456789EF' } });
    },
    async save() {
      button('บันทึกพัสดุ').props.onClick();
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

test('a quantity above what is left stays as typed and is flagged once the field is left', () => {
  const dialog = parcelDialog(2);
  dialog.type('5');
  // Kept, not lowered to 2; and not judged while it is still being typed.
  assert.equal(dialog.quantity().props.value, 5);
  assert.equal(dialog.quantity().props['aria-invalid'], undefined);
  assert.equal(dialog.alerts().length, 0);

  dialog.leave();
  const field = dialog.quantity();
  assert.equal(field.props.value, 5);
  assert.equal(field.props['aria-invalid'], true);
  const [alert] = dialog.alerts();
  assert.equal(text(alert), OVER);
  assert.equal(field.props['aria-describedby'], alert.props.id);
});

test('a quantity above what is left blocks the save and sends nothing', async () => {
  const dialog = parcelDialog(2);
  dialog.fillCarrier();
  dialog.type('3');
  // Saved without leaving the field first: the save itself is what flags it.
  await dialog.save();
  assert.deepEqual(dialog.created, []);
  assert.equal(dialog.succeeded(), 0);
  assert.deepEqual(dialog.focused, [dialog.quantity().props.id]);
  assert.deepEqual(dialog.alerts().map(text), [OVER]);
  assert.equal(dialog.quantity().props.value, 3);

  // Corrected, the same dialog saves what was typed.
  dialog.type('2');
  assert.equal(dialog.alerts().length, 0);
  await dialog.save();
  assert.deepEqual(plain(dialog.created), [
    {
      storeOrderId: 'order-1',
      body: {
        carrier_name: 'Flash Express',
        tracking_number: 'TH0123456789EF',
        items: [{ sale_order_list_id: 'line-1', quantity: 2 }],
      },
    },
  ]);
  assert.equal(dialog.succeeded(), 1);
});

test('a negative, fractional, empty or non-numeric quantity is read as before', () => {
  const dialog = parcelDialog(2);
  for (const [typed, kept] of [
    ['-3', 0],
    ['1.7', 1],
    ['', 0],
    ['abc', 0],
    ['2', 2],
  ]) {
    dialog.type(typed);
    assert.equal(dialog.quantity().props.value, kept, `typed "${typed}"`);
    assert.equal(dialog.alerts().length, 0, `typed "${typed}"`);
  }
});

test('the minus and plus buttons stay within what can be shipped', () => {
  const dialog = parcelDialog(2);
  assert.equal(dialog.button('ลดจำนวน').props.disabled, true);
  dialog.button('เพิ่มจำนวน').props.onClick();
  dialog.button('เพิ่มจำนวน').props.onClick();
  assert.equal(dialog.quantity().props.value, 2);
  assert.equal(dialog.button('เพิ่มจำนวน').props.disabled, true);
  dialog.button('ลดจำนวน').props.onClick();
  assert.equal(dialog.quantity().props.value, 1);
});

test('one step down from a typed quantity that is too high lands on the limit', () => {
  const dialog = parcelDialog(2);
  dialog.type('9');
  assert.equal(dialog.button('เพิ่มจำนวน').props.disabled, true);
  dialog.button('ลดจำนวน').props.onClick();
  assert.equal(dialog.quantity().props.value, 2);
});

// --- The parcel page: what recording a returned parcel says ------------------

function returnDialogText(isCustom) {
  const hooks = stateful();
  const load = sourceLoader({
    react: hooks.react,
    'react/jsx-runtime': jsxRuntime,
    '@/components/Modal': 'modal',
    '@/components/StatusBadge': 'badge',
    '@/components/CustomSelect': 'select',
    '@/models/store-fulfillment': class {},
    '@/lib/api-error': { getApiErrorMessage: (error) => String(error) },
    './sf-icon': 'icon',
  });
  const Component = load(
    'src/app/admin/store-fulfillment/components/parcel-card.tsx',
  ).default;
  hooks.begin();
  const tree = Component({
    parcel: {
      parcelId: 'parcel-1',
      status: 'shipped',
      carrierName: 'Flash Express',
      trackingNumber: 'TH0123456789EF',
      recipientName: 'ผู้รับ',
      recipientPhone: '0811111111',
      addressLine1: '1',
      addressLine2: null,
      district: 'เขต',
      province: 'จังหวัด',
      postalCode: '10100',
      createdAt: '2026-11-26T03:00:00.000Z',
      shippedAt: '2026-11-26T04:00:00.000Z',
      returnedAt: null,
      items: [{ productName: 'แก้วสั่งผลิต', quantity: 1 }],
    },
    canEdit: true,
    ...(isCustom === undefined ? {} : { isCustom }),
    onChanged: () => {},
  });
  const dialog = elements(tree).find(
    (node) => node.type === 'modal' && node.props.title === 'บันทึกพัสดุตีกลับ',
  );
  assert.ok(dialog, 'the returned-parcel dialog is part of a shipped parcel card');
  return text(dialog);
}

test('recording a returned parcel of a normal order still announces the 50 baht shipping charge', () => {
  for (const isCustom of [undefined, false]) {
    const words = returnDialogText(isCustom);
    assert.match(words, /ระบบจะเรียกเก็บค่าจัดส่ง\s*50 บาทก่อนส่งใหม่/);
    assert.doesNotMatch(words, /Custom/);
  }
});

test('recording a returned parcel of a Custom order says no shipping is charged again, not the 50 baht text', () => {
  const words = returnDialogText(true);
  assert.match(words, /งานสั่งผลิต \(Custom\): ระบบไม่เรียกเก็บค่าจัดส่งซ้ำ/);
  assert.match(words, /สร้างพัสดุใหม่เพื่อส่งอีกครั้งได้ทันที/);
  assert.doesNotMatch(words, /50 บาท/);
  assert.doesNotMatch(words, /เรียกเก็บค่าจัดส่ง\s*50/);
});

// --- The parcel page: what the order view itself decides for a Custom order ---

const BANNER = /งานสั่งผลิต \(Custom\) · คำขอ CU202611260001 — สร้าง พัก และส่งพัสดุได้ตามปกติ การยกเลิก\s+คืนเงิน และรับคืนสินค้าไม่ทำในหน้านี้/;
const NOTHING_LEFT = 'ลงพัสดุครบทั้ง 3 ชิ้นแล้ว ไม่มีสินค้าคงเหลือให้บันทึก';

function orderView({ custom = null, remainingUnshipped = 0, permissions } = {}) {
  const allowed = permissions ?? [
    'store_fulfillment:add',
    'store_fulfillment:edit',
    'sale_orders:view',
  ];
  const load = sourceLoader({
    react: { useId: () => 'reason', useState: (value) => [value, () => {}] },
    'react/jsx-runtime': jsxRuntime,
    'next/link': 'a',
    '@/components/StatusBadge': 'badge',
    '@/hooks/usePermissions': {
      usePermissions: () => ({
        can: (menu, action) => allowed.includes(`${menu}:${action}`),
      }),
    },
    '@/lib/store-order-steps': { storeOrderSteps: () => [] },
    './create-parcel-modal': 'create-parcel',
    './parcel-card': 'parcel-card',
    './pickup-card': {
      __esModule: true,
      default: 'pickup-card',
      PickupFollowUpCards: 'pickup-follow-up',
      usePickupAction: () => ({}),
    },
    './cancellation-card': 'cancellation-card',
    './delivery-conversion-card': 'delivery-conversion-card',
    './tax-invoice-card': 'tax-invoice-card',
    './return-card': 'return-card',
    './sf-icon': 'icon',
    '../store-fulfillment.css': {},
  });
  const Component = load(
    'src/app/admin/store-fulfillment/components/store-order-fulfillment.tsx',
  ).default;
  const tree = Component({
    order: {
      storeOrderId: 'order-1',
      saleOrderCode: 'SO202611260001',
      status: 'paid',
      fulfillmentMethod: 'delivery',
      customerName: 'ลูกค้า',
      customerPhone: '0811111111',
      customerType: 'member',
      createdAt: '2026-11-26T03:00:00.000Z',
      total: 100,
      custom,
      cancellation: null,
      pickup: null,
      taxInvoice: null,
      shippingCharges: [],
      defaultAddress: null,
      items: [
        {
          saleOrderListId: 'line-1',
          productName: 'แก้วสั่งผลิต',
          purchasedQty: 3,
          shippedQty: 3 - remainingUnshipped,
          remainingUnshipped,
        },
      ],
      parcels: [{ parcelId: 'parcel-1', status: 'shipped' }],
      returns: { returnableLines: [], history: [] },
    },
    onChanged: () => {},
  });
  const all = elements(tree);
  const ofType = (type) => all.filter((node) => node.type === type);
  return {
    words: text(tree),
    all,
    badges: ofType('badge').map(text),
    links: ofType('a'),
    returnCards: ofType('return-card'),
    parcelCards: ofType('parcel-card'),
    newParcel: buttons(tree).find((node) => text(node) === 'บันทึกพัสดุใหม่'),
  };
}
const CUSTOM = { requestCode: 'CU202611260001', saleOrderId: 'so/1' };

test('the order view of a Custom order shows the badge, the request code and the banner, hides the return card and tells the parcel card', () => {
  const seen = orderView({ custom: CUSTOM });
  assert.ok(seen.badges.includes('Custom'));
  assert.ok(
    seen.all.some((node) => node.type === 'p' && text(node) === 'คำขอ CU202611260001'),
    'the request code under the order code',
  );
  assert.match(seen.words, BANNER);
  assert.equal(seen.links.length, 1);
  assert.equal(text(seen.links[0]), 'เปิดใบสั่งขาย');
  assert.equal(seen.links[0].props.href, '/admin/sale-orders/so%2F1');
  assert.equal(seen.returnCards.length, 0);
  assert.equal(seen.parcelCards.length, 1);
  assert.equal(seen.parcelCards[0].props.isCustom, true);
});

test('without the sale order view permission the Custom banner stays and its link is absent', () => {
  const seen = orderView({
    custom: CUSTOM,
    permissions: ['store_fulfillment:add', 'store_fulfillment:edit'],
  });
  assert.match(seen.words, BANNER);
  assert.equal(seen.links.length, 0);
  assert.doesNotMatch(seen.words, /เปิดใบสั่งขาย/);
});

test('the order view of a normal order has no Custom badge or banner, keeps the return card and tells the parcel card', () => {
  const seen = orderView({ custom: null });
  assert.ok(!seen.badges.includes('Custom'));
  assert.doesNotMatch(seen.words, /Custom|คำขอ CU|เปิดใบสั่งขาย/);
  assert.equal(seen.links.length, 0);
  assert.equal(seen.returnCards.length, 1);
  assert.equal(seen.returnCards[0].props.storeOrderId, 'order-1');
  assert.equal(seen.parcelCards.length, 1);
  assert.equal(seen.parcelCards[0].props.isCustom, false);
});

test('the new parcel button says why it is disabled when nothing is left, and not when something is', () => {
  const done = orderView({ remainingUnshipped: 0 });
  assert.equal(done.newParcel.props.disabled, true);
  const reason = done.all.find(
    (node) => node.type === 'p' && text(node) === NOTHING_LEFT,
  );
  assert.ok(reason, 'the reason is on the page');
  assert.ok(reason.props.id);
  assert.equal(done.newParcel.props['aria-describedby'], reason.props.id);

  const left = orderView({ remainingUnshipped: 1 });
  assert.equal(left.newParcel.props.disabled, false);
  assert.equal(left.newParcel.props['aria-describedby'], undefined);
  assert.doesNotMatch(left.words, /ไม่มีสินค้าคงเหลือให้บันทึก/);
});
