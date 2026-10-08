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

// Realistic form state: a full list row, relations and unknown fields included.
const SIZE_ROW = { size_id: 4, size_name: 'S' };
const CASES = [
  ['category', 'category create', m => m('category').createCategory('เสื้อ', [1, 2])],
  ['category', 'category update from a full list row', m => m('category').updateCategory({ category_id: 7, category_name: 'เสื้อ', size_ids: [4], categorySize: [{ id: 1, size_id: 4, size: SIZE_ROW }], sizes: [SIZE_ROW], extra: true })],
  ['color', 'color create', m => m('color').createColor({ color_name: 'แดง', color_hex: '#FF0000', color_id: 9, extra: true })],
  ['color', 'color update from a full row', m => m('color').updateColor({ color_id: 3, color_name: 'แดง', color_hex: '#FF0000', extra: true })],
  ['product-unit', 'product unit create', m => m('product-unit').createProductUnit('ชิ้น')],
  ['product-unit', 'product unit update', m => m('product-unit').updateProductUnit(2, 'กล่อง')],
  ['employee-license', 'employee license create', m => m('employee-license').createLicense('Manager')],
  ['employee-license', 'employee license save permissions', m => m('employee-license').savePermissions('0199-id', { permissions: [{ menu_id: 'm1', permission_view: true }] })],
  ['employee-license', 'employee license rename', m => m('employee-license').renameLicense('0199-id', 'Manager')],
];

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
    const extra = Object.keys(body ?? {}).filter(field => !contract[key].includes(field));
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
