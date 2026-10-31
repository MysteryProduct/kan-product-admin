import { test } from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';

// Job order card helpers (TASK-0323): the size/colour pills split from a job name and the
// target-date label, counted in Bangkok days whatever the device's time zone.
const { splitVariantLabel, getVariantLabel, getDueInfo, bangkokDayKey } = sourceLoader()('src/app/admin/job-orders/board-model.ts');

const job = (status, target_date) => ({ job_order_status: status, target_date });
// 10:00 on 31 Oct 2026 in Bangkok.
const NOW = new Date('2026-10-31T03:00:00Z');

test('splitVariantLabel takes size and colour out of the name', () => {
  assert.deepEqual(
    { ...splitVariantLabel('แก้วเก็บความเย็น Kan 20 ออนซ์ Size:20 ออนซ์ Color:กรมท่า') },
    { name: 'แก้วเก็บความเย็น Kan 20 ออนซ์', size: '20 ออนซ์', color: 'กรมท่า' },
  );
});

test('splitVariantLabel handles only one part, either order and any case', () => {
  assert.deepEqual({ ...splitVariantLabel('กระบอกน้ำ Color:ดำ') }, { name: 'กระบอกน้ำ', color: 'ดำ' });
  assert.deepEqual({ ...splitVariantLabel('แก้ว 40 ออนซ์ Size:40 ออนซ์') }, { name: 'แก้ว 40 ออนซ์', size: '40 ออนซ์' });
  assert.deepEqual({ ...splitVariantLabel('แก้ว color:เทา SIZE:L') }, { name: 'แก้ว', size: 'L', color: 'เทา' });
});

test('splitVariantLabel leaves a plain name alone', () => {
  assert.deepEqual({ ...splitVariantLabel('test') }, { name: 'test' });
  assert.deepEqual({ ...splitVariantLabel('ป้ายชื่อ Sizeใหญ่') }, { name: 'ป้ายชื่อ Sizeใหญ่' });
});

test('splitVariantLabel collapses repeated spaces', () => {
  assert.deepEqual(
    { ...splitVariantLabel('  แก้ว   มีหูจับ   Size :  40   ออนซ์   Color:  เทา เข้ม ') },
    { name: 'แก้ว มีหูจับ', size: '40 ออนซ์', color: 'เทา เข้ม' },
  );
});

test('getVariantLabel prefers the job size and colour, and drops them from the title', () => {
  const label = getVariantLabel({
    job_order_name: 'แก้ว Kan Size:20 ออนซ์ Color:กรมท่า',
    size: { size_id: 1, size_name: '20 oz' },
    color: { color_id: 2, color_name: 'Navy' },
  });
  assert.equal(label.title, 'แก้ว Kan');
  assert.deepEqual([...label.pills], ['20 oz', 'Navy']);
  assert.deepEqual([...getVariantLabel({ job_order_name: 'test' }).pills], []);
  assert.deepEqual([...getVariantLabel({ job_order_name: 'แก้ว Color:ดำ' }).pills], ['ดำ']);
});

test('getDueInfo labels each status', () => {
  assert.deepEqual({ ...getDueInfo(job('completed', '2026-10-16'), NOW) }, { text: 'เสร็จ · 16 ต.ค.', tone: 'success', late: false, days: -15 });
  assert.deepEqual({ ...getDueInfo(job('cancelled', '2026-10-16'), NOW) }, { text: '16 ต.ค.', tone: 'neutral', late: false, days: -15 });
  assert.deepEqual({ ...getDueInfo(job('in_progress', '2026-10-19'), NOW) }, { text: 'เลย 12 วัน · 19 ต.ค.', tone: 'danger', late: true, days: -12 });
  assert.deepEqual({ ...getDueInfo(job('pending', '2026-10-31'), NOW) }, { text: 'ครบวันนี้', tone: 'warning', late: false, days: 0 });
  assert.deepEqual({ ...getDueInfo(job('pending', '2026-11-03'), NOW) }, { text: 'อีก 3 วัน · 3 พ.ย.', tone: 'warning', late: false, days: 3 });
  assert.deepEqual({ ...getDueInfo(job('pending', '2026-11-04'), NOW) }, { text: 'อีก 4 วัน · 4 พ.ย.', tone: 'neutral', late: false, days: 4 });
  assert.deepEqual({ ...getDueInfo(job('pending', null), NOW) }, { text: 'ไม่ระบุวัน', tone: 'neutral', late: false, days: null });
});

test('getDueInfo counts across a month and a year', () => {
  assert.equal(getDueInfo(job('pending', '2026-11-01'), NOW).days, 1);
  const newYearEve = new Date('2026-12-31T05:00:00Z');
  const next = getDueInfo(job('pending', '2027-01-02'), newYearEve);
  assert.equal(next.days, 2);
  // Another year shows its Buddhist-era year.
  assert.equal(next.text, 'อีก 2 วัน · 2 ม.ค. 70');
});

test('getDueInfo counts Bangkok days at 23:30 and 00:30', () => {
  // 23:30 on 30 Oct in Bangkok is still 30 Oct; 00:30 on 31 Oct is already the 31st.
  const lateEvening = new Date('2026-10-30T16:30:00Z');
  const pastMidnight = new Date('2026-10-30T17:30:00Z');
  assert.equal(getDueInfo(job('pending', '2026-10-31'), lateEvening).text, 'อีก 1 วัน · 31 ต.ค.');
  assert.equal(getDueInfo(job('pending', '2026-10-31'), pastMidnight).text, 'ครบวันนี้');
  // A stored timestamp of Bangkok midnight, written as UTC, is that Bangkok day.
  assert.equal(bangkokDayKey('2026-10-30T17:00:00.000Z'), '2026-10-31');
  assert.equal(bangkokDayKey('2026-10-31T00:00:00.000Z'), '2026-10-31');
});
