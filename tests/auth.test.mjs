import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import sourceLoader from './load-source.mjs';

function browserEnvironment() {
  const cookies = new Map();
  const redirects = [];
  const events = [];
  const removedKeys = [];
  const load = sourceLoader(
    {
      'js-cookie': {
        get: (key) => cookies.get(key),
        set: (key, value) => cookies.set(key, value),
        remove: (key) => cookies.delete(key),
      },
    },
    {
      window: {
        location: {
          pathname: '/admin/bank-account',
          assign: (url) => redirects.push(url),
        },
        dispatchEvent: (event) => {
          events.push(event.type);
          return true;
        },
      },
      localStorage: { removeItem: (key) => removedKeys.push(key) },
    },
  );
  return { load, cookies, redirects, events, removedKeys };
}

function rejectedResponse(status, data, beforeReject) {
  return (config) => {
    beforeReject?.(config);
    const response = {
      status,
      data,
      config,
      statusText: 'test response',
      headers: {},
    };
    return Promise.reject(
      new axios.AxiosError(
        'original error',
        'ERR_BAD_RESPONSE',
        config,
        {},
        response,
      ),
    );
  };
}

test('403 preserves the session and Axios response; refreshes permissions', async () => {
  const env = browserEnvironment();
  env.cookies.set('token', 'current-session');
  env.cookies.set('user', 'cached-user');
  const client = env.load('src/lib/axios.ts').default;
  const data = { message: 'Forbidden' };
  await assert.rejects(
    client.post(
      '/bank-account',
      { account_name: 'draft' },
      {
        adapter: rejectedResponse(403, data),
      },
    ),
    (error) => {
      assert.equal(axios.isAxiosError(error), true);
      assert.equal(error.response.status, 403);
      assert.equal(error.response.data, data);
      assert.match(error.message, /ไม่มีสิทธิ์/);
      return true;
    },
  );
  assert.equal(env.cookies.get('token'), 'current-session');
  assert.equal(env.cookies.get('user'), 'cached-user');
  assert.deepEqual(env.redirects, []);
  assert.deepEqual(env.events, ['auth:refresh-permissions']);
});

test('401 on login preserves session and stays on the login form', async () => {
  const env = browserEnvironment();
  env.cookies.set('token', 'existing-session');
  const client = env.load('src/lib/axios.ts').default;
  await assert.rejects(
    client.post(
      '/auth/employee-login',
      { username: 'worker', password: 'wrong' },
      {
        adapter: rejectedResponse(
          401,
          { message: 'Invalid credentials' },
          (config) => {
            assert.equal(config.headers.Authorization, undefined);
          },
        ),
      },
    ),
    /ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง/,
  );
  assert.equal(env.cookies.get('token'), 'existing-session');
  assert.deepEqual(env.redirects, []);
  assert.deepEqual(env.events, []);
});

test('401 for the current authenticated request clears session and redirects', async () => {
  const env = browserEnvironment();
  env.cookies.set('token', 'expired-session');
  env.cookies.set('user', 'cached-user');
  const client = env.load('src/lib/axios.ts').default;
  await assert.rejects(
    client.get('/auth/status', { adapter: rejectedResponse(401, {}) }),
  );
  assert.equal(env.cookies.size, 0);
  assert.deepEqual(env.redirects, ['/login']);
  assert.deepEqual(env.events, ['auth:session-expired']);
});

test('a late 401 from an old token does not invalidate a new session', async () => {
  const env = browserEnvironment();
  env.cookies.set('token', 'old-session');
  const client = env.load('src/lib/axios.ts').default;
  await assert.rejects(
    client.get('/user', {
      adapter: rejectedResponse(401, {}, () =>
        env.cookies.set('token', 'new-session'),
      ),
    }),
  );
  assert.equal(env.cookies.get('token'), 'new-session');
  assert.deepEqual(env.redirects, []);
  assert.deepEqual(env.events, []);
});

test('400 validation arrays retain every message and original response details', async () => {
  const env = browserEnvironment();
  const client = env.load('src/lib/axios.ts').default;
  const data = {
    message: ['email must be an email', 'password should not be empty'],
  };
  await assert.rejects(
    client.post(
      '/user/insertUser',
      {},
      { adapter: rejectedResponse(400, data) },
    ),
    (error) => {
      assert.equal(error.message, data.message.join('\n'));
      assert.equal(error.response.data, data);
      assert.equal(error.response.status, 400);
      return true;
    },
  );
});

test('network failures preserve session and can be retried', async () => {
  const env = browserEnvironment();
  env.cookies.set('token', 'current-session');
  const client = env.load('src/lib/axios.ts').default;
  await assert.rejects(
    client.get('/auth/status', {
      adapter: (config) =>
        Promise.reject(
          new axios.AxiosError('Network Error', 'ERR_NETWORK', config, {}),
        ),
    }),
    /ไม่สามารถเชื่อมต่อ/,
  );
  assert.equal(env.cookies.get('token'), 'current-session');
  assert.deepEqual(env.events, []);
  assert.deepEqual(env.redirects, []);
});

test('a failed status refresh does not recursively trigger another refresh', async () => {
  const env = browserEnvironment();
  env.cookies.set('token', 'current-session');
  const client = env.load('src/lib/axios.ts').default;
  await assert.rejects(
    client.get('/auth/status', { adapter: rejectedResponse(403, {}) }),
  );
  assert.deepEqual(env.events, []);
});

test('HTTP error handling also works without browser globals', async () => {
  const load = sourceLoader();
  const client = load('src/lib/axios.ts').default;
  await assert.rejects(
    client.get('/user', { adapter: rejectedResponse(403, {}) }),
    /ไม่มีสิทธิ์/,
  );
});

test('case-insensitive permissions require a literal true and deny missing actions', () => {
  const { permissionMap, hasPermission } = sourceLoader()(
    'src/lib/permissions.ts',
  );
  const map = permissionMap([
    {
      menu: { menu_name: 'Job_Orders' },
      permission_view: true,
      permission_add: false,
    },
  ]);
  assert.equal(hasPermission(map, 'job_orders'), true);
  assert.equal(hasPermission(map, 'JOB_ORDERS'), true);
  assert.equal(hasPermission(map, 'job_orders', 'add'), false);
  assert.equal(hasPermission(map, 'job_orders', 'delete'), false);
  assert.equal(hasPermission(map, 'missing'), false);
  assert.equal(
    hasPermission(
      permissionMap([
        { menu: { menu_name: 'users' }, permission_view: 'true' },
      ]),
      'users',
    ),
    false,
  );
});

test('job and license routes match API menus and only match path boundaries', () => {
  const { getMenuNameFromPath } = sourceLoader()(
    'src/lib/permission-routes.ts',
  );
  assert.equal(getMenuNameFromPath('/admin/job-orders'), 'job_orders');
  assert.equal(getMenuNameFromPath('/admin/job-orders/123'), 'job_orders');
  assert.equal(getMenuNameFromPath('/admin/license'), 'employee_licenses');
  assert.equal(getMenuNameFromPath('/admin/products-other'), null);
});

test('session restoration uses the verified API identity and excludes hashes', () => {
  const { load } = browserEnvironment();
  const { employeeFromStatus, publicEmployee } = load(
    'src/lib/auth-storage.ts',
  );
  const status = {
    status: 'ok',
    user: {
      sub: 'employee-1',
      username: 'current-name',
      login_type: 'employee',
      license_id: 'license-1',
    },
  };
  const cached = {
    employee_id: 'employee-1',
    employee_username: 'old-name',
    employee_firstname: 'First',
    employee_password: 'never-store',
  };
  const employee = employeeFromStatus(status, cached);
  assert.equal(employee.employee_username, 'current-name');
  assert.equal(employee.employee_firstname, 'First');
  assert.equal(employee.employee_password, undefined);
  assert.equal(
    employeeFromStatus(status, { ...cached, employee_id: 'someone-else' })
      .employee_firstname,
    undefined,
  );
  assert.equal(
    employeeFromStatus(
      { ...status, user: { ...status.user, login_type: 'user' } },
      cached,
    ),
    null,
  );
  assert.equal(publicEmployee({ user_id: 'not-employee' }), null);
});

test('corrupt profile cookies do not prevent restoring identity from the API', () => {
  const env = browserEnvironment();
  env.cookies.set('user', 'invalid JSON');
  const { readCachedEmployee, employeeFromStatus, storeSession } = env.load(
    'src/lib/auth-storage.ts',
  );
  assert.equal(readCachedEmployee(), null);
  const employee = employeeFromStatus(
    {
      status: 'ok',
      user: { sub: 'employee-1', username: 'worker', login_type: 'employee' },
    },
    null,
  );
  assert.equal(employee.employee_id, 'employee-1');
  storeSession('test-session', { ...employee, password: 'never-store' });
  assert.equal(JSON.parse(env.cookies.get('user')).password, undefined);
  assert.equal(env.cookies.get('token'), 'test-session');
  assert.deepEqual(env.removedKeys, ['permissions']);
});

test('settings updates reject missing response data instead of reporting false success', async () => {
  const load = sourceLoader({
    '@/lib/axios': { patch: async () => ({ data: { data: [] } }) },
  });
  const SettingsModel = load('src/models/settings.ts').default;
  await assert.rejects(
    new SettingsModel().updateSettings({ setting_id: 'settings-1' }),
    /ไม่ได้ส่งข้อมูล/,
  );
});
