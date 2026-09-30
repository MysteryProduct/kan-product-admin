import { test } from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';

const { describeAccessLog } = sourceLoader()('src/lib/access-log.ts');
// Values built inside the vm context have that realm's prototypes.
const plain = (value) => JSON.parse(JSON.stringify(value));

const entry = (type, action, previous_value = null, next_value = null, target_name = 'เป้าหมาย') => ({
  id: 'log-1',
  created_at: '2026-09-30T03:00:00.000Z',
  type,
  action,
  target_id: 'target-1',
  target_name,
  actor_id: 'actor-1',
  actor_username: 'admin',
  actor_name: 'ผู้ดูแล ระบบ',
  previous_value,
  next_value,
});

test('license events read in Thai, a rename shows both names', () => {
  assert.equal(describeAccessLog(entry('employee_license', 'created')).event, 'สร้างกลุ่มสิทธิ์');
  assert.equal(describeAccessLog(entry('employee_license', 'deleted')).event, 'ลบกลุ่มสิทธิ์');
  const renamed = describeAccessLog(
    entry('employee_license', 'renamed', { license_name: 'ฝ่ายขาย' }, { license_name: 'ฝ่ายขายหน้าร้าน' }),
  );
  assert.deepEqual(plain(renamed), {
    event: 'แก้ชื่อกลุ่มสิทธิ์',
    typeLabel: 'กลุ่มสิทธิ์',
    target: 'เป้าหมาย',
    details: ['"ฝ่ายขาย" → "ฝ่ายขายหน้าร้าน"'],
  });
});

test('a permission change lists what each menu gained and lost, with the page title when known', () => {
  const described = describeAccessLog(
    entry(
      'employee_license',
      'permissions_updated',
      {
        menus: [
          { menu_id: 'm1', menu_name: 'colors', actions: ['view', 'delete'] },
          { menu_id: 'm2', menu_name: 'payments', actions: [] },
        ],
      },
      {
        menus: [
          { menu_id: 'm1', menu_name: 'colors', actions: ['view', 'edit'] },
          { menu_id: 'm2', menu_name: 'payments', actions: ['view'] },
        ],
      },
    ),
    (name) => (name === 'colors' ? 'สีของสินค้า' : name),
  );
  assert.equal(described.event, 'เปลี่ยนสิทธิ์รายเมนู');
  assert.deepEqual(plain(described.details), [
    'สีของสินค้า: เพิ่มสิทธิ์ แก้ไข / เอาสิทธิ์ ลบ ออก',
    'payments: เพิ่มสิทธิ์ ดู',
  ]);
});

test('employee events show the license involved; an unknown action falls back to its code', () => {
  assert.deepEqual(
    plain(describeAccessLog(entry('employee', 'created', null, { employee_username: 'staff', license_name: 'คลังสินค้า' })).details),
    ['กลุ่มสิทธิ์: คลังสินค้า'],
  );
  assert.deepEqual(
    plain(
      describeAccessLog(
        entry('employee', 'license_changed', { license_name: 'คลังสินค้า' }, { license_name: 'ฝ่ายขาย' }),
      ).details,
    ),
    ['คลังสินค้า → ฝ่ายขาย'],
  );
  const disabled = describeAccessLog(entry('employee', 'disabled'));
  assert.equal(disabled.event, 'ปิดใช้งาน');
  assert.equal(disabled.typeLabel, 'พนักงาน');
  assert.deepEqual(plain(disabled.details), []);
  assert.equal(describeAccessLog(entry('employee', 'something_new')).event, 'something_new');
  // A missing snapshot name never breaks the line, and a missing target name shows the id.
  assert.deepEqual(plain(describeAccessLog(entry('employee', 'license_changed', {}, null, null))), {
    event: 'ย้ายกลุ่มสิทธิ์',
    typeLabel: 'พนักงาน',
    target: 'target-1',
    details: ['กลุ่มที่ไม่พบชื่อ → กลุ่มที่ไม่พบชื่อ'],
  });
});
