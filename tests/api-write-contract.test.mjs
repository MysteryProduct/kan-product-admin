import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sourceLoader from './load-source.mjs';

// TASK-0143. The API publishes, for every route that rejects unknown body
// fields, the fields it accepts (kan-product-api/contracts/admin-write-contract.json,
// exported from the DTOs). This repository keeps a copy, so these checks run
// without the API checkout. A model that spreads a form row into a request body
// fails here instead of answering 400 in the browser.
const here = path.dirname(fileURLToPath(import.meta.url));
const read = file => JSON.parse(fs.readFileSync(path.join(here, file), 'utf8'));
const contract = read('api-write-contract.json');
const plain = value => JSON.parse(JSON.stringify(value));

function setup() {
  const calls = [];
  const axios = Object.fromEntries(['get', 'post', 'patch', 'put', 'delete'].map(method => [method, async (url, body) => {
    calls.push({ method: method.toUpperCase(), url, body: plain(body) });
    return { data: { data: {} } };
  }]));
  const load = sourceLoader({ '@/lib/axios': axios });
  const model = file => {
    const exported = load(`src/models/${file}.ts`);
    return new (exported.default ?? Object.values(exported)[0])();
  };
  return { calls, model };
}

// A template hole (`${...}`) in an Admin URL stands for a value, so it matches
// only a ':param' segment of the contract, never a literal one: otherwise
// `/employee/${id}/${action}` would be taken for `/employee/:id/password`.
const segments = route => route.replace(/\/+$/, '').split('/').filter(Boolean);
function routeKey(verb, url) {
  const wanted = segments(url.replace(/\$\{[^}]*\}/g, ':p'));
  return Object.keys(contract).find(key => {
    const [v, p] = key.split(' ');
    if (v !== verb) return false;
    const parts = segments(p);
    return parts.length === wanted.length && parts.every((part, i) =>
      part.startsWith(':') ? true : !wanted[i].startsWith(':') && part === wanted[i]);
  });
}

test('route matching: holes match params only, literals must be equal', () => {
  assert.equal(routeKey('POST', '/employee/${id}/password'), 'POST /employee/:id/password');
  assert.equal(routeKey('POST', "/employee/${id}/${disabled ? 'disable' : 'enable'}"), undefined);
  assert.equal(routeKey('PATCH', '/category/${category_id}'), 'PATCH /category/:id');
  assert.equal(routeKey('POST', '/category/'), 'POST /category');
  assert.equal(routeKey('PATCH', '/category/'), undefined);
  assert.equal(routeKey('POST', '/category/${id}/extra'), undefined);
  assert.equal(routeKey('PUT', '/category/${id}'), undefined);
});

// The contract lists top-level fields by name and the fields of nested line
// items as `field[].inner`.
const topFields = key => contract[key].filter(field => !field.includes('[]'));
const nestedFields = (key, field) => contract[key]
  .filter(name => name.startsWith(`${field}[].`)).map(name => name.slice(field.length + 3));
// Everything wrong with a request body: fields, and nested item fields, the API would reject.
function violations(key, body = {}) {
  const found = Object.keys(body).filter(field => !topFields(key).includes(field));
  for (const [field, value] of Object.entries(body)) {
    const allowed = nestedFields(key, field);
    if (!Array.isArray(value) || allowed.length === 0) continue;
    for (const item of value) {
      for (const inner of Object.keys(item ?? {})) if (!allowed.includes(inner)) found.push(`${field}[].${inner}`);
    }
  }
  return found;
}

// Realistic form state: a full list row, relations and unknown fields included.
const SIZE_ROW = { size_id: 4, size_name: 'S' };
const ADDRESS = { recipient_name: 'สมชาย', recipient_phone: '0800000000', address_line1: '1 ถนน', address_line2: 'ซอย 2', district: 'บางรัก', province: 'กรุงเทพ', postal_code: '10500' };
const EMPLOYEE = { employee_firstname: 'สมชาย', employee_lastname: 'ใจดี', employee_address: '1 ถนน', employee_phone: '0800000000', employee_email: 'a@b.test' };
const LINE = { sale_order_list_id: 'L1', quantity: 2, name: 'สินค้า', remaining: 5 };
const CASES = [
  ['category', 'category create', m => m('category').createCategory('เสื้อ', [1, 2])],
  ['category', 'category update from a full list row', m => m('category').updateCategory({ category_id: 7, category_name: 'เสื้อ', size_ids: [4], categorySize: [{ id: 1, size_id: 4, size: SIZE_ROW }], sizes: [SIZE_ROW], extra: true })],
  ['color', 'color create', m => m('color').createColor({ color_name: 'แดง', color_hex: '#FF0000', color_id: 9, extra: true })],
  ['color', 'color update from a full row', m => m('color').updateColor({ color_id: 3, color_name: 'แดง', color_hex: '#FF0000', extra: true })],
  ['product-unit', 'product unit create', m => m('product-unit').createProductUnit('ชิ้น')],
  ['product-unit', 'product unit update', m => m('product-unit').updateProductUnit(2, 'กล่อง')],
  ['employee', 'employee create from a full form state', m => m('employee').createEmployee({ employee_username: 'somchai', employee_password: 'pw-12345678', ...EMPLOYEE, license_id: 'L1', confirm_password: 'pw-12345678', employee_id: 'x', extra: true })],
  ['employee', 'employee update from a full employee row', m => m('employee').updateEmployee('E1', { employee_id: 'E1', employee_username: 'somchai', ...EMPLOYEE, license_id: 'L1', license: { license_id: 'L1', license_name: 'Manager' }, disabled_at: null, extra: true })],
  ['employee', 'employee update without a license', m => m('employee').updateEmployee('E1', { ...EMPLOYEE })],
  ['employee', 'employee set password', m => m('employee').setPassword('E1', 'new-password-123')],
  ['contact-request', 'contact request update from a full row', m => m('contact-request').updateContactRequest('C1', { status: 'contacting', contact_result: 'โทรแล้ว', contactRequestId: 'C1', contactName: 'ลูกค้า', extra: true })],
  ['contact-request', 'contact request update with a cleared result', m => m('contact-request').updateContactRequest('C1', { status: 'new', contact_result: '', contactRequestId: 'C1' })],
  ['store-fulfillment', 'fulfillment create parcel from a full form state', m => m('store-fulfillment').createParcel('O1', { carrier_name: 'Kerry', tracking_number: 'T1', items: [LINE], ...ADDRESS, parcelId: 'x', extra: true })],
  ['store-fulfillment', 'fulfillment edit parcel address from a full row', m => m('store-fulfillment').editParcelAddress('P1', { ...ADDRESS, reason: 'ลูกค้าแจ้งแก้', history: [], extra: true })],
  ['store-fulfillment', 'fulfillment convert to delivery from a full form state', m => m('store-fulfillment').convertToDelivery('O1', { ...ADDRESS, note: 'หมายเหตุ', shippingFee: 50, extra: true })],
  ['store-fulfillment', 'fulfillment record parcel return', m => m('store-fulfillment').recordParcelReturn('P1', { reason: 'ส่งไม่ได้', contact_outcome: 'reached', contact_note: 'โทรแล้ว', parcelId: 'P1', extra: true })],
  ['store-fulfillment', 'fulfillment decide cancellation', m => m('store-fulfillment').decideCancellation('R1', { decision: 'approve', note: 'ตกลง', requestId: 'R1', extra: true })],
  ['store-fulfillment', 'fulfillment record manual refund', m => m('store-fulfillment').recordManualRefund('RF1', { reference: 'REF1', amount: 100, transferred_at: '2026-10-08T10:00:00Z', refundId: 'RF1', extra: true })],
  ['store-fulfillment', 'fulfillment create return from a full form state', m => m('store-fulfillment').createReturn('O1', { return_reference: 'U1', reason: 'defective', note: 'ชำรุด', items: [{ sale_order_list_id: 'L1', quantity: 1, restock: false, name: 'สินค้า' }], extra: true })],
  ['store-fulfillment', 'fulfillment schedule second appointment', m => m('store-fulfillment').scheduleSecondAppointment('O1', { scheduled_at: '2026-10-09T10:00:00Z', note: 'นัดใหม่', extra: true })],
  ['store-fulfillment', 'fulfillment log pickup contact', m => m('store-fulfillment').logPickupContact('O1', { channel: 'phone', outcome: 'reached', note: 'โทรแล้ว', extra: true })],
  ['store-fulfillment', 'fulfillment handover pickup', m => m('store-fulfillment').handoverPickup('O1', { phone: '0800000000', recipient_name: 'สมชาย', extra: true })],
  ['store-fulfillment', 'fulfillment hold parcel', m => m('store-fulfillment').holdParcel('P1', 'รอตรวจสอบ')],
  ['store-fulfillment', 'fulfillment void parcel', m => m('store-fulfillment').voidParcel('P1', 'บันทึกผิด')],
  ['employee-license', 'employee license create', m => m('employee-license').createLicense('Manager')],
  ['employee-license', 'employee license save permissions', m => m('employee-license').savePermissions('0199-id', { permissions: [{ menu_id: 'm1', permission_view: true }] })],
  ['employee-license', 'employee license rename', m => m('employee-license').renameLicense('0199-id', 'Manager')],
];

test('contact request update keeps an empty result so the API can clear it, and omits an absent one', async () => {
  const s = setup();
  await s.model('contact-request').updateContactRequest('C1', { status: 'new', contact_result: '', contactRequestId: 'C1' });
  await s.model('contact-request').updateContactRequest('C1', { status: 'closed' });
  assert.deepEqual(s.calls.map(call => call.body), [{ status: 'new', contact_result: '' }, { status: 'closed' }]);
});

test('employee update sends the license only when the caller gave one', async () => {
  const s = setup();
  const details = { employee_firstname: 'ก', employee_lastname: 'ข', employee_address: 'ค', employee_phone: '1', employee_email: 'a@b.test' };
  await s.model('employee').updateEmployee('E1', details);
  await s.model('employee').updateEmployee('E1', { ...details, license_id: 'L2' });
  assert.deepEqual(s.calls.map(call => call.body), [details, { ...details, license_id: 'L2' }]);
});

test('bodies exactly as the forms build them reach the API unchanged', async () => {
  const s = setup();
  const created = { employee_firstname: 'ก', employee_lastname: 'ข', employee_address: 'ค', employee_phone: '1', employee_email: 'a@b.test', employee_username: 'u', employee_password: 'pw-12345678', license_id: 'L1' };
  await s.model('employee').createEmployee(created);
  await s.model('contact-request').updateContactRequest('C1', { status: 'contacting', contact_result: 'ผล' });
  assert.deepEqual(s.calls.map(call => call.body), [created, { status: 'contacting', contact_result: 'ผล' }]);
});

test('nested item lines carry only the fields the API lists for them', async () => {
  const s = setup();
  const m = s.model('store-fulfillment');
  await m.createParcel('O1', { carrier_name: 'K', tracking_number: 'T', items: [{ sale_order_list_id: 'L1', quantity: 2, name: 'x', remaining: 5 }] });
  await m.createReturn('O1', { return_reference: 'U', reason: 'defective', items: [{ sale_order_list_id: 'L1', quantity: 1, restock: true, name: 'x' }] });
  assert.deepEqual(s.calls[0].body.items, [{ sale_order_list_id: 'L1', quantity: 2 }]);
  assert.deepEqual(s.calls[1].body.items, [{ sale_order_list_id: 'L1', quantity: 1, restock: true }]);
  assert.deepEqual(nestedFields('POST /fulfillment/returns/orders/:storeOrderId', 'items').sort(), ['quantity', 'restock', 'sale_order_list_id']);
});

test('a missing items list is left for the API to refuse instead of failing in Admin', async () => {
  const s = setup();
  await s.model('store-fulfillment').createParcel('O1', { carrier_name: 'K', tracking_number: 'T' });
  assert.deepEqual(s.calls[0].body, { carrier_name: 'K', tracking_number: 'T' });
});

test('optional fields stay optional and empty strings are kept', async () => {
  const s = setup();
  const m = s.model('store-fulfillment');
  await m.holdParcel('P1');
  await m.logPickupContact('O1', { channel: 'phone', outcome: 'other', note: '' });
  assert.deepEqual(s.calls.map(call => call.body), [{}, { channel: 'phone', outcome: 'other', note: '' }]);
});

// The other direction: a model must not drop a field the API accepts. Each
// method gets a body carrying every contract field and must send all of them.
const COMPLETE = [
  ['store-fulfillment', 'createParcel', ['O1'], 'POST /fulfillment/orders/:storeOrderId/parcels'],
  ['store-fulfillment', 'editParcelAddress', ['P1'], 'PATCH /fulfillment/parcels/:id/address'],
  ['store-fulfillment', 'convertToDelivery', ['O1'], 'POST /fulfillment/orders/:storeOrderId/convert-to-delivery'],
  ['store-fulfillment', 'recordParcelReturn', ['P1'], 'POST /fulfillment/parcels/:id/return'],
  ['store-fulfillment', 'decideCancellation', ['R1'], 'POST /fulfillment/cancellations/:id/decision'],
  ['store-fulfillment', 'recordManualRefund', ['RF1'], 'POST /fulfillment/cancellations/refunds/:refundId/manual'],
  ['store-fulfillment', 'createReturn', ['O1'], 'POST /fulfillment/returns/orders/:storeOrderId'],
  ['store-fulfillment', 'scheduleSecondAppointment', ['O1'], 'POST /fulfillment/pickup/orders/:storeOrderId/second-appointment'],
  ['store-fulfillment', 'logPickupContact', ['O1'], 'POST /fulfillment/pickup/orders/:storeOrderId/contact-log'],
  ['store-fulfillment', 'handoverPickup', ['O1'], 'POST /fulfillment/pickup/orders/:storeOrderId/handover'],
  ['color', 'createColor', [], 'POST /color'],
  ['color', 'updateColor', [{ color_id: 3 }], 'PATCH /color/:id'],
  ['category', 'updateCategory', [{ category_id: 7 }], 'PATCH /category/:id'],
  ['employee', 'createEmployee', [], 'POST /employee'],
  ['employee', 'updateEmployee', ['E1'], 'PATCH /employee/:id'],
  ['contact-request', 'updateContactRequest', ['C1'], 'PATCH /contact-requests/:id'],
];
for (const [model, method, lead, key] of COMPLETE) {
  test(`${method} sends every field the API accepts for ${key}`, async () => {
    const s = setup();
    const dto = Object.fromEntries(topFields(key).map(field => {
      const inner = nestedFields(key, field);
      return [field, inner.length ? [Object.fromEntries(inner.map(name => [name, 'v']))] : 'v'];
    }));
    // A leading object carries the id of a model that takes one object (updateColor).
    const args = lead.length && typeof lead[0] === 'object' ? [{ ...lead[0], ...dto }] : [...lead, dto];
    await s.model(model)[method](...args);
    const sent = s.calls[0].body;
    assert.deepEqual(Object.keys(sent).sort(), [...topFields(key)].sort());
    for (const field of topFields(key)) {
      const inner = nestedFields(key, field);
      if (inner.length) assert.deepEqual(Object.keys(sent[field][0]).sort(), [...inner].sort(), `${field}[] item fields`);
    }
  });
}

// Contract routes exercised by CASES, recorded while they run.
const exercised = new Set();
for (const [model, name, run] of CASES) {
  test(`${name} sends only fields the strict API accepts`, async () => {
    const s = setup();
    await run(s.model);
    assert.equal(s.calls.length, 1, 'one write request');
    const { method, url, body } = s.calls[0];
    const key = routeKey(method, url);
    assert.ok(key, `${method} ${url} is not a strict route in the contract; update tests/api-write-contract.json`);
    const extra = violations(key, body);
    assert.deepEqual(extra, [], `${key} would be rejected for: ${extra.join(', ')}`);
    exercised.add(`${model} ${key}`);
  });
}

// Strict-route call sites found in src/models by scanning the source.
function writeCallSites() {
  const dir = path.join(here, '..', 'src', 'models');
  const found = new Set();
  for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.ts'))) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    const pattern = /axiosInstance\s*\.\s*(post|patch|put)\s*(?:<[^()]*>)?\s*\(\s*([`'"])([\s\S]*?)\2/g;
    for (const match of text.matchAll(pattern)) {
      const key = routeKey(match[1].toUpperCase(), match[3]);
      if (key) found.add(`${file.replace(/\.ts$/, '')} ${key}`);
    }
  }
  return [...found].sort();
}

// Sites without a case are recorded in api-write-contract.unchecked.json. The
// list can only shrink: a new site needs a case (preferred) or an explicit
// entry, and a site that gained a case or disappeared must leave the list.
test('strict-route call sites without a case match the recorded baseline', async () => {
  for (const [, , run] of CASES) await run(setup().model);
  const covered = new Set(CASES.map(([model]) => model));
  const sites = writeCallSites();
  const withoutCase = sites.filter(site => !covered.has(site.split(' ')[0]));
  const baseline = read('api-write-contract.unchecked.json');
  assert.deepEqual(
    withoutCase.filter(site => !baseline.includes(site)), [],
    'new strict-route call site without a case: add a CASES entry (preferred) or record it in tests/api-write-contract.unchecked.json');
  assert.deepEqual(
    baseline.filter(site => !withoutCase.includes(site)), [],
    'recorded call site is covered by a case now or no longer exists: remove it from tests/api-write-contract.unchecked.json');
  // Every site in a covered model must be hit by some case, or the case misses a route.
  const uncoveredRoutes = sites.filter(site => covered.has(site.split(' ')[0]) && !exercised.has(site));
  assert.deepEqual(uncoveredRoutes, [], 'a model with cases still has a strict write route no case exercises');
});

const apiCopy = path.join(here, '..', '..', 'kan-product-api', 'contracts', 'admin-write-contract.json');
test('the committed contract copy matches the API checkout when it is present', { skip: !fs.existsSync(apiCopy) && 'API checkout not next to this repository' }, () => {
  assert.deepEqual(contract, JSON.parse(fs.readFileSync(apiCopy, 'utf8')),
    'copy kan-product-api/contracts/admin-write-contract.json to tests/api-write-contract.json');
});
