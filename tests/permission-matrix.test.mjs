import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import sourceLoader from './load-source.mjs';

const load = sourceLoader();
// Values built inside the vm context have that realm's prototypes.
const plain = (value) => JSON.parse(JSON.stringify(value));
const matrix = load('src/lib/permission-matrix.ts');

const off = {
  permission_view: false,
  permission_add: false,
  permission_edit: false,
  permission_delete: false,
  permission_approve: false,
  permission_reject: false,
};
const menu = (menu_id, menu_group, flags = {}) => ({
  menu_id,
  menu_group,
  menu_name: menu_id,
  menu_number: 1,
  menu_url: '',
  ...off,
  ...flags,
});
const menus = [
  menu('colors', 'development', { permission_view: true }),
  menu('sizes', 'development'),
  menu('stock_product', 'stock', { permission_view: true, permission_edit: true }),
];

test('a loaded matrix has no changes until a tick differs', () => {
  const original = matrix.draftFromMenus(menus);
  assert.deepEqual(plain(matrix.changedMenuIds(original, original)), []);
  const toggled = matrix.toggleCell(original, 'sizes', 'add');
  assert.equal(toggled.sizes.permission_add, true);
  assert.equal(original.sizes.permission_add, false, 'the loaded copy is not mutated');
  assert.deepEqual(plain(matrix.changedMenuIds(original, toggled)), ['sizes']);
  const back = matrix.toggleCell(toggled, 'sizes', 'add');
  assert.deepEqual(plain(matrix.changedMenuIds(original, back)), []);
});

test('row and column helpers tick or clear every cell they cover', () => {
  const draft = matrix.draftFromMenus(menus);
  assert.equal(matrix.rowState(draft, 'colors'), 'some');
  assert.equal(matrix.rowState(draft, 'sizes'), 'none');
  const fullRow = matrix.setRow(draft, 'sizes', true);
  assert.equal(matrix.rowState(fullRow, 'sizes'), 'all');
  assert.equal(matrix.rowState(matrix.setRow(fullRow, 'sizes', false), 'sizes'), 'none');

  assert.equal(matrix.columnState(draft, 'view'), 'some');
  const allView = matrix.setColumn(draft, 'view', true);
  assert.equal(matrix.columnState(allView, 'view'), 'all');
  // Scoped to one group, other groups keep their ticks.
  const devOnly = matrix.setColumn(draft, 'view', false, ['colors', 'sizes']);
  assert.equal(matrix.columnState(devOnly, 'view', ['colors', 'sizes']), 'none');
  assert.equal(devOnly.stock_product.permission_view, true);
  assert.equal(matrix.columnState(draft, 'view', []), 'none');
});

test('the save payload sends every menu with all six flags', () => {
  const draft = matrix.toggleCell(matrix.draftFromMenus(menus), 'sizes', 'reject');
  const { permissions } = matrix.toSavePayload(draft);
  assert.equal(permissions.length, 3);
  assert.deepEqual(
    plain(permissions.find((row) => row.menu_id === 'sizes')),
    { menu_id: 'sizes', ...off, permission_reject: true },
  );
  for (const row of permissions) assert.equal(Object.keys(row).length, 7);
});

test('menus are grouped in the order the API sent them', () => {
  const groups = matrix.groupMenus(menus);
  assert.deepEqual(
    plain(groups.map((group) => [group.group, group.menus.map((m) => m.menu_id)])),
    [
      ['development', ['colors', 'sizes']],
      ['stock', ['stock_product']],
    ],
  );
});

test('saving PUTs the whole set and surfaces the API refusal text', async () => {
  const cookies = new Map([['token', 'session']]);
  const loadModel = sourceLoader(
    {
      'js-cookie': {
        get: (key) => cookies.get(key),
        set: (key, value) => cookies.set(key, value),
        remove: (key) => cookies.delete(key),
      },
    },
    {
      window: {
        location: { pathname: '/admin/license', assign: () => {} },
        dispatchEvent: () => true,
      },
      localStorage: { removeItem: () => {} },
    },
  );
  const axiosInstance = loadModel('src/lib/axios.ts').default;
  const Model = loadModel('src/models/employee-license.ts').default;
  const requests = [];
  const refusal = 'บันทึกไม่ได้ เพราะกลุ่มสิทธิ์ของคุณเองจะเสียสิทธิ์แก้ไขสิทธิ์รายเมนู';
  axiosInstance.defaults.adapter = (config) => {
    requests.push({ method: config.method, url: config.url, body: JSON.parse(config.data) });
    const response = { status: 409, data: { message: refusal }, config, statusText: 'Conflict', headers: {} };
    return Promise.reject(new axios.AxiosError('conflict', 'ERR_BAD_REQUEST', config, {}, response));
  };
  const body = plain(matrix.toSavePayload(matrix.draftFromMenus(menus)));
  await assert.rejects(new Model().savePermissions('license-1', body), (error) => error.message === refusal);
  assert.deepEqual(requests, [{ method: 'put', url: '/employee-permission/license/license-1', body }]);
});

test('a menu is described by the Admin routes gated on it, not by its stored menu_url', () => {
  const routes = load('src/lib/permission-routes.ts');
  assert.deepEqual(plain(routes.getPathsForMenu('employee_licenses')), ['/admin/license']);
  assert.deepEqual(plain(routes.getPathsForMenu('Employee_Licenses')), ['/admin/license']);
  // The `license` menu row stores /admin/license, but no route checks it.
  assert.deepEqual(plain(routes.getPathsForMenu('license')), []);
  assert.deepEqual(plain(routes.getPathsForMenu('employee_permissions')), []);
});
