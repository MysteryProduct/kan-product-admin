// Disposable in-memory API fixture for manual browser regression checks.
// Start the Admin with NEXT_PUBLIC_API_URL=http://127.0.0.1:3041/.
import http from 'node:http';
const token = 'fixture-only-session';
const employee = {
  employee_id: '01990000-0000-7000-8000-000000000001',
  employee_username: 'worker',
  employee_firstname: 'Test',
  employee_lastname: 'Employee',
  license_id: '01990000-0000-7000-8000-000000000002',
};
let statusMode = 'normal';
let writeStatus = 403;
let allowMenus = true;
let statusCalls = 0;
const permissions = () =>
  allowMenus
    ? ['BANK_ACCOUNTS', 'employee_licenses', 'job_orders'].map(
        (menu_name, index) => ({
          permission_id: `01990000-0000-7000-8000-00000000000${index + 3}`,
          permission_view: true,
          permission_add: true,
          permission_edit: true,
          permission_delete: true,
          permission_approve: false,
          permission_reject: false,
          menu: { menu_name },
        }),
      )
    : [];

http
  .createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3030');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization',
    );
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PATCH, DELETE, OPTIONS',
    );
    res.setHeader('Content-Type', 'application/json');
    const send = (status, data) => {
      res.writeHead(status);
      res.end(JSON.stringify(data));
    };
    if (req.method === 'OPTIONS') {
      send(204, {});
      return;
    }
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let body = {};
    try {
      if (raw) body = JSON.parse(raw);
    } catch {
      send(400, {});
      return;
    }
    const pathname = new URL(req.url, 'http://127.0.0.1:3041').pathname;
    if (pathname === '/__test/control') {
      if (req.method === 'POST') {
        if (body.statusMode) statusMode = body.statusMode;
        if (body.writeStatus) writeStatus = body.writeStatus;
        if (typeof body.allowMenus === 'boolean') allowMenus = body.allowMenus;
      }
      send(200, { statusMode, writeStatus, allowMenus, statusCalls });
      return;
    }
    if (pathname === '/auth/employee-login') {
      if (body.username !== 'worker' || body.password !== '123') {
        send(401, { message: 'Invalid credentials' });
        return;
      }
      send(201, {
        data: employee,
        access_token: token,
        permissions: permissions(),
      });
      return;
    }
    if (
      req.headers.authorization !== `Bearer ${token}` ||
      statusMode === 'expired'
    ) {
      send(401, { message: 'Unauthorized' });
      return;
    }
    if (pathname === '/auth/status') {
      statusCalls += 1;
      if (statusMode === 'unavailable') {
        send(503, { message: 'ระบบทดสอบไม่พร้อม กรุณาลองใหม่' });
        return;
      }
      send(200, {
        status: 'ok',
        user: {
          sub: employee.employee_id,
          username: employee.employee_username,
          login_type: 'employee',
          license_id: employee.license_id,
          permissions: Object.fromEntries(
            permissions().map((p) => [p.menu.menu_name, p]),
          ),
        },
      });
      return;
    }
    if (pathname === '/bank-account' && req.method === 'POST') {
      send(writeStatus, {
        message:
          writeStatus === 403
            ? 'Forbidden'
            : ['เลขที่บัญชีไม่ถูกต้อง', 'กรุณาตรวจสอบชื่อบัญชี'],
      });
      return;
    }
    send(200, {
      data: [],
      meta: { total: 0, page: 1, limit: 10, last_page: 1 },
    });
  })
  .listen(3041, '127.0.0.1', () =>
    console.log('Browser API fixture listening on 127.0.0.1:3041'),
  );
