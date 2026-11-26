import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';

// TASK-0212: the page "งาน Custom หลังผลิต". The real page component is called
// as a function with React doubles, the way custom-fulfillment-ui.test.mjs does
// it; nothing is drawn, so layout, focus and the browser are not what these
// tests show. The API is a double: only what the page asks for is checked.

const jsx = (type, props) => ({ type, props });
const jsxRuntime = { jsx, jsxs: jsx, Fragment: 'fragment' };
const plain = (value) => JSON.parse(JSON.stringify(value));

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
const tick = () => new Promise((resolve) => setImmediate(resolve));

const row = (set = {}) => ({
  id: 'request-1',
  code: 'CU202611260001',
  saleOrderId: 'so/1',
  saleOrderCode: 'SO202611260001',
  status: 'awaiting_balance',
  group: 'awaiting_balance',
  buyerName: 'ร้านกาแฟบ้านสวน',
  total: 12840.5,
  paid: 5000,
  outstanding: 7840.5,
  storeOrderId: null,
  pieces: 3,
  shippedPieces: 0,
  openParcels: 0,
  awaitingResend: false,
  updatedAt: '2026-11-26T03:00:00.000Z',
  ...set,
});
const answer = (data, counts = { awaiting_balance: 1, ready_to_ship: 2, shipped: 3 }) => ({
  data,
  meta: { total: data.length, page: 1, limit: 20, last_page: 1, counts },
});

const PAY = ['sale_orders:approve', 'payment_receipts:add'];
const EVERY = ['sale_orders:view', 'store_fulfillment:view', ...PAY];

/** The page with its hooks kept between draws and its effects run after each one. */
function page({ permissions = EVERY, respond } = {}) {
  const slots = [];
  const effects = [];
  let at = 0;
  let effectAt = 0;
  const requests = [];
  const pending = [];
  const react = {
    useState(initial) {
      const slot = at++;
      if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial;
      return [
        slots[slot],
        (next) => {
          slots[slot] = typeof next === 'function' ? next(slots[slot]) : next;
        },
      ];
    },
    useEffect(run, deps) {
      const slot = effectAt++;
      const before = effects[slot];
      const changed = !before || deps.some((dep, index) => dep !== before.deps[index]);
      effects[slot] = { deps, run: changed ? run : null, cleanup: before?.cleanup };
    },
  };
  const load = sourceLoader({
    react,
    'react/jsx-runtime': jsxRuntime,
    'next/link': 'a',
    '@/components/DataTable': { DataTable: 'table' },
    '@/components/LoadErrorBanner': 'banner',
    '@/components/Pagination': 'pager',
    '@/components/StatusBadge': 'badge',
    '@/hooks/usePermissions': {
      usePermissions: () => ({
        can: (menu, action) => permissions.includes(`${menu}:${action}`),
      }),
    },
    '@/lib/api-error': { getApiErrorMessage: (error) => String(error.message ?? error) },
    '@/lib/axios': {
      get(url, config) {
        requests.push({ url, params: plain(config.params) });
        if (respond) return Promise.resolve({ data: respond(config.params) });
        return new Promise((resolve, reject) => {
          pending.push({
            params: config.params,
            resolve: (data) => resolve({ data }),
            reject,
          });
        });
      },
    },
    '../store-fulfillment/components/sf-icon': 'icon',
    '../store-fulfillment/store-fulfillment.css': {},
    './custom-post-production.css': {},
  });
  const Component = load('src/app/admin/custom-post-production/page.tsx').default;
  const draw = () => {
    at = 0;
    effectAt = 0;
    const tree = Component();
    for (const effect of effects) {
      if (!effect.run) continue;
      effect.cleanup?.();
      effect.cleanup = effect.run() ?? undefined;
      effect.run = null;
    }
    return tree;
  };
  const table = () => ofType(draw(), 'table')[0];
  return {
    requests,
    pending,
    draw,
    table,
    /** Draws until the answers that already arrived are on the page. */
    async settle() {
      draw();
      await tick();
      await tick();
      return draw();
    },
    tile(label) {
      return ofType(draw(), 'button').find((node) => text(node).includes(label));
    },
    column(key, value) {
      const { columns } = table().props;
      return columns.find((column) => column.key === key).render(value[key], value);
    },
    card(value) {
      return table().props.renderCard(value);
    },
    search(typed) {
      const tree = draw();
      ofType(tree, 'input')[0].props.onChange({ target: { value: typed } });
      ofType(draw(), 'form')[0].props.onSubmit({ preventDefault: () => {} });
    },
  };
}

async function loaded(rows, options = {}) {
  const view = page({ respond: () => answer(rows), ...options });
  await view.settle();
  return view;
}

// --- Badge ---------------------------------------------------------------------

test('the badge follows the group, not the request status', async () => {
  const cases = [
    [row(), 'รอชำระส่วนที่เหลือ', 'warning'],
    // Fully paid, not yet sent: the status is still awaiting_balance.
    [row({ group: 'ready_to_ship', status: 'awaiting_balance', outstanding: 0 }), 'พร้อมจัดส่ง', 'info'],
    [row({ group: 'ready_to_ship', status: 'produced', outstanding: 0 }), 'พร้อมจัดส่ง', 'info'],
    [row({ group: 'shipped', status: 'shipped', outstanding: 0, storeOrderId: 'order-1', shippedPieces: 3 }), 'จัดส่งแล้ว', 'success'],
  ];
  const view = await loaded(cases.map(([value]) => value));
  for (const [value, label, tone] of cases) {
    for (const drawn of [view.column('group', value), view.card(value)]) {
      const [badge] = ofType(drawn, 'badge');
      assert.equal(text(badge), label, `${value.group}/${value.status}`);
      assert.equal(badge.props.tone, tone, `${value.group}/${value.status}`);
    }
  }
});

// --- The line under the badge and the one link -----------------------------------

const SALE_ORDER = '/admin/sale-orders/so%2F1';
const PARCELS = '/admin/store-fulfillment?orderId=order%2F1';
const sent = { group: 'ready_to_ship', outstanding: 0, storeOrderId: 'order/1' };
const STEPS = [
  ['a balance owed', row(), '', 'บันทึกรับชำระ', SALE_ORDER],
  ['paid, not yet sent to the parcel page', row({ group: 'ready_to_ship', outstanding: 0 }), 'ชำระครบ รอส่งเข้าหน้าจัดส่ง', 'เปิดใบสั่งขาย', SALE_ORDER],
  ['sent, no parcel yet', row(sent), 'รอสร้างพัสดุ', 'เปิดหน้าจัดส่ง', PARCELS],
  ['a parcel made, not yet confirmed shipped', row({ ...sent, openParcels: 1 }), 'มีพัสดุรอยืนยันจัดส่ง', 'เปิดหน้าจัดส่ง', PARCELS],
  ['partly shipped', row({ ...sent, shippedPieces: 1 }), 'ส่งแล้ว 1 จาก 3 ชิ้น', 'เปิดหน้าจัดส่ง', PARCELS],
  ['a parcel came back', row({ ...sent, shippedPieces: 1, awaitingResend: true }), 'พัสดุตีกลับ รอส่งซ้ำ', 'เปิดหน้าจัดส่ง', PARCELS],
  ['shipped', row({ ...sent, group: 'shipped', status: 'shipped', shippedPieces: 3 }), 'ส่งแล้ว 3 จาก 3 ชิ้น', 'เปิดหน้าจัดส่ง', PARCELS],
];

test('each row says what it waits for and links to the page where that is done', async () => {
  const view = await loaded(STEPS.map(([, value]) => value));
  for (const [name, value, note, label, href] of STEPS) {
    const state = view.column('group', value);
    const [badge] = ofType(state, 'badge');
    // What the cell says besides its badge and the link kept for narrow screens.
    const narrow = ofType(state, 'a');
    assert.equal(
      text(state).replace(text(badge), '').replace(narrow.map(text).join(''), ''),
      note,
      name,
    );
    for (const drawn of [view.column('saleOrderId', value), state, view.card(value)]) {
      const links = ofType(drawn, 'a');
      assert.equal(links.length, 1, name);
      assert.equal(text(links[0]), label, name);
      assert.equal(links[0].props.href, href, name);
      assert.ok(links[0].props['aria-label'].startsWith(label), name);
    }
    assert.ok(text(view.card(value)).includes(note), name);
  }
});

test('only a returned parcel is drawn as a warning, with its icon', async () => {
  const view = await loaded(STEPS.map(([, value]) => value));
  for (const [name, value] of STEPS) {
    const warned = elements(view.column('group', value)).some((node) =>
      String(node.props?.className ?? '').includes('ka-cp-warn'),
    );
    assert.equal(warned, name === 'a parcel came back', name);
  }
  const state = view.column('group', STEPS.find(([name]) => name === 'a parcel came back')[1]);
  const warning = elements(state).find((node) => String(node.props?.className ?? '').includes('ka-cp-warn'));
  assert.equal(text(warning), 'พัสดุตีกลับ รอส่งซ้ำ');
  assert.ok(ofType(warning, 'icon').some((icon) => icon.props.name === 'warn'));
});

test('without the parcel page permission its link is replaced by a dash with hidden words; sale order links stay', async () => {
  const view = await loaded(
    STEPS.map(([, value]) => value),
    { permissions: ['sale_orders:view', ...PAY] },
  );
  for (const [name, value, , label, href] of STEPS) {
    const cell = view.column('saleOrderId', value);
    const links = [cell, view.column('group', value), view.card(value)].flatMap((drawn) => ofType(drawn, 'a'));
    if (href === PARCELS) {
      assert.equal(links.length, 0, name);
      assert.match(text(cell), /^–ไม่มีลิงก์ คุณไม่มีสิทธิ์ดูหน้าจัดส่ง$/, name);
      const hidden = elements(cell).find((node) => node.props?.className === 'sr-only');
      assert.ok(hidden, name);
      // The hidden words sit in a positioned box, or the admin page grows a blank band.
      assert.match(cell.props.className, /ka-cp-none/, name);
      assert.doesNotMatch(text(view.card(value)), /เปิดหน้าจัดส่ง/, name);
      // The narrow column and the phone card show the same dash (D8; review round 1 F6).
      for (const drawn of [view.column('group', value), view.card(value)]) {
        const dash = elements(drawn).find((node) => /ka-cp-none/.test(node.props?.className ?? ''));
        assert.ok(dash, name);
        assert.equal(text(dash), '–ไม่มีลิงก์ คุณไม่มีสิทธิ์ดูหน้าจัดส่ง', name);
      }
    } else {
      assert.equal(links.length, 3, name);
      for (const link of links) {
        assert.equal(text(link), label, name);
        assert.equal(link.props.href, href, name);
      }
    }
  }
});

test('who may not record a payment gets a link that only opens the sale order', async () => {
  const owing = row();
  for (const missing of PAY) {
    const view = await loaded([owing], { permissions: EVERY.filter((held) => held !== missing) });
    for (const drawn of [view.column('saleOrderId', owing), view.card(owing)]) {
      const [link] = ofType(drawn, 'a');
      assert.equal(text(link), 'เปิดใบสั่งขาย', missing);
      assert.equal(link.props.href, SALE_ORDER, missing);
    }
  }
});

// --- Permission ----------------------------------------------------------------

test('without the sale order view permission the page says so and asks the API nothing', async () => {
  const view = page({ permissions: ['store_fulfillment:view'], respond: () => answer([row()]) });
  const tree = await view.settle();
  assert.match(text(tree), /คุณไม่มีสิทธิ์เข้าถึงงาน Custom หลังผลิต/);
  assert.match(text(tree), /กรุณาติดต่อผู้ดูแลระบบ/);
  assert.equal(ofType(tree, 'table').length, 0);
  assert.equal(ofType(tree, 'button').length, 0);
  assert.deepEqual(view.requests, []);
});

// --- Requests --------------------------------------------------------------------

test('the page asks for the default group first, then for what was chosen, with an empty search left out', async () => {
  const view = page({ respond: () => answer([row()]) });
  await view.settle();
  assert.deepEqual(view.requests, [
    { url: '/sale-order/custom/post-production', params: { group: 'awaiting_balance', page: 1, limit: 20 } },
  ]);

  // Typing alone asks nothing; submitting sends the trimmed text.
  ofType(view.draw(), 'input')[0].props.onChange({ target: { value: '  CU2026  ' } });
  await view.settle();
  assert.equal(view.requests.length, 1);
  view.search('  CU2026  ');
  await view.settle();
  assert.deepEqual(view.requests.at(-1).params, { group: 'awaiting_balance', page: 1, limit: 20, q: 'CU2026' });

  view.table().props.onPageChange(2);
  await view.settle();
  assert.deepEqual(view.requests.at(-1).params, { group: 'awaiting_balance', page: 2, limit: 20, q: 'CU2026' });

  // Another group starts at its first page and keeps the search.
  view.tile('ส่งแล้ว').props.onClick();
  await view.settle();
  assert.deepEqual(view.requests.at(-1).params, { group: 'shipped', page: 1, limit: 20, q: 'CU2026' });

  // Only spaces is no search: `q` is not sent at all.
  view.search('   ');
  await view.settle();
  assert.deepEqual(view.requests.at(-1).params, { group: 'shipped', page: 1, limit: 20 });
  assert.ok(view.requests.every((request) => Object.keys(request.params).every((key) => ['group', 'q', 'page', 'limit'].includes(key))));
});

test('the tiles show the counts of the answer, one is pressed, and pressing it again asks nothing', async () => {
  const view = page({ respond: () => answer([row()], { awaiting_balance: 5, ready_to_ship: 0, shipped: 1234 }) });
  // Before the first answer there is no number to show.
  assert.doesNotMatch(text(view.tile('รอยอดคงเหลือ')), /\d/);
  await view.settle();
  assert.equal(text(view.tile('รอยอดคงเหลือ')), '5รอยอดคงเหลือ');
  assert.equal(text(view.tile('พร้อมจัดส่ง')), '0พร้อมจัดส่ง');
  assert.equal(text(view.tile('ส่งแล้ว')), '1,234ส่งแล้ว');
  assert.equal(view.tile('รอยอดคงเหลือ').props['aria-pressed'], true);
  assert.equal(view.tile('พร้อมจัดส่ง').props['aria-pressed'], false);
  view.tile('รอยอดคงเหลือ').props.onClick();
  await view.settle();
  assert.equal(view.requests.length, 1);
});

test('an answer that arrives after a newer request was made is ignored', async () => {
  const view = page();
  view.draw();
  view.tile('พร้อมจัดส่ง').props.onClick();
  view.draw();
  assert.deepEqual(view.pending.map((request) => request.params.group), ['awaiting_balance', 'ready_to_ship']);

  const [older, newer] = view.pending;
  newer.resolve(answer([row({ id: 'new', group: 'ready_to_ship', outstanding: 0 })]));
  await view.settle();
  older.resolve(answer([row({ id: 'old' })], { awaiting_balance: 9, ready_to_ship: 9, shipped: 9 }));
  await view.settle();
  assert.deepEqual(plain(view.table().props.data.map((value) => value.id)), ['new']);
  assert.equal(text(view.tile('พร้อมจัดส่ง')), '2พร้อมจัดส่ง');
});

test('the rows of one group are never shown under another tile while the new group loads', async () => {
  const view = page();
  view.draw();
  view.pending[0].resolve(answer([row()]));
  await view.settle();
  assert.equal(view.table().props.data.length, 1);
  view.tile('ส่งแล้ว').props.onClick();
  const table = view.table();
  assert.equal(table.props.data.length, 0);
  assert.equal(table.props.loading, true);
  // The counts of the last answer stay on the tiles meanwhile.
  assert.equal(text(view.tile('รอยอดคงเหลือ')), '1รอยอดคงเหลือ');
});

test('a failed load shows what failed with a retry, hides the table and keeps the last counts', async () => {
  const view = page();
  view.draw();
  view.pending[0].resolve(answer([row()]));
  await view.settle();
  view.table().props.onPageChange(2);
  view.draw();
  view.pending[1].reject(new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'));
  const tree = await view.settle();
  const [banner] = ofType(tree, 'banner');
  assert.equal(banner.props.message, 'โหลดรายการงาน Custom หลังผลิตไม่สำเร็จ: เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
  assert.equal(ofType(tree, 'table').length, 0);
  assert.equal(text(view.tile('ส่งแล้ว')), '3ส่งแล้ว');
  banner.props.onRetry();
  view.draw();
  assert.deepEqual(plain(view.pending.at(-1).params), { group: 'awaiting_balance', page: 2, limit: 20 });
});

test('an empty group and an empty search use the table’s own empty words', async () => {
  const view = page({ respond: () => answer([]) });
  await view.settle();
  assert.equal(view.table().props.emptyHint, 'ไม่มีงานในกลุ่มนี้');
  assert.deepEqual(plain(view.table().props.activeFilters), []);
  view.search('CU202611129999');
  await view.settle();
  assert.deepEqual(plain(view.table().props.activeFilters), ['คำค้นหา']);
  // Clearing from the empty state asks again without the search.
  view.table().props.onClearFilters();
  await view.settle();
  assert.deepEqual(view.requests.at(-1).params, { group: 'awaiting_balance', page: 1, limit: 20 });
  assert.equal(ofType(view.draw(), 'input')[0].props.value, '');
});

// --- Menu ------------------------------------------------------------------------

test('the page is in the sales menu and opens with the sale order permission', () => {
  const load = sourceLoader({ 'react/jsx-runtime': { jsx: () => null, jsxs: () => null } });
  const { adminMenu } = load('src/lib/admin-menu.tsx');
  const { getMenuNameFromPath, getPathsForMenu } = load('src/lib/permission-routes.ts');
  const sales = adminMenu.flatMap((section) => section.items).find((item) => item.title === 'ขายสินค้า');
  const leaf = sales.subItems.find((item) => item.href === '/admin/custom-post-production');
  assert.deepEqual(plain(leaf), { title: 'งาน Custom หลังผลิต', menu_name: 'sale_orders', href: '/admin/custom-post-production' });
  assert.equal(getMenuNameFromPath('/admin/custom-post-production'), 'sale_orders');
  assert.ok(getPathsForMenu('sale_orders').includes('/admin/custom-post-production'));
  // The permission pages name the menu by its first page, not by this one.
  assert.equal(sales.subItems.find((item) => item.menu_name === 'sale_orders').title, 'ใบสั่งขาย');
});

test('the permission pages name a menu by its first sidebar page (TASK-0212 D9)', () => {
  const load = sourceLoader({ 'react/jsx-runtime': { jsx: () => null, jsxs: () => null } });
  const { adminMenu } = load('src/lib/admin-menu.tsx');
  const leaves = adminMenu.flatMap((section) => section.items.flatMap((item) => item.subItems ?? []));
  // The rule both pages apply: entries reversed into a Map, so the first leaf of a menu is set last.
  const titles = new Map(leaves.map((leaf) => [leaf.menu_name, leaf.title]).reverse());
  assert.equal(titles.get('sale_orders'), 'ใบสั่งขาย');
  assert.equal(titles.get('products'), 'สินค้า');
  assert.equal(titles.get('job_orders'), 'ผลิตสินค้า');
  for (const file of [
    'src/app/admin/access-logs/page.tsx',
    'src/app/admin/license/components/permission-matrix.tsx',
  ]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(source, /leaf\.menu_name, leaf\.title\] as const\)[\s\S]{0,40}\.reverse\(\)/, file);
  }
});
