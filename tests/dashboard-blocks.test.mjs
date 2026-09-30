import { test } from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';

const { unavailableText } = sourceLoader()('src/components/dashboard/blockLabels.ts');

test('no text when nothing failed', () => {
  assert.equal(unavailableText(undefined), null);
  assert.equal(unavailableText([]), null);
});

test('names each failed block in Thai, in the order given', () => {
  assert.equal(
    unavailableText(['operations.job_orders', 'sales.received']),
    'โหลดข้อมูลบางส่วนไม่สำเร็จ: งานผลิต, ยอดที่รับชำระจริง',
  );
});

test('falls back to the block name the API sent when it has no label', () => {
  assert.equal(unavailableText(['future.block']), 'โหลดข้อมูลบางส่วนไม่สำเร็จ: future.block');
});
