import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';

// The helper is TypeScript and imports the sale-order display code, which this check does not exercise, so that import is stubbed.
const here = dirname(fileURLToPath(import.meta.url));
const path = process.env.RECEIPT_DISPLAY || join(here, '../src/app/admin/payment-receipts/lib/receipt-display.ts');
const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } });
const stub = `data:text/javascript,${encodeURIComponent('export const formatBaht = String, payable = () => 0, paymentState = () => null;')}`;
const code = outputText.replace('@/app/admin/sale-orders/lib/so-display', stub);
const { customerOf, netAfter } = await import(`data:text/javascript,${encodeURIComponent(code)}`);

const receipt = (id, code, date, amount) => ({ payment_receipt_id: id, payment_receipt_code: code, payment_date: date, amount_paid: amount });
const paid = receipt('a', 'RE1', '2026-10-01', '1000.00');
const first = receipt('b', 'RE2', '2026-10-31', '-100.00');
const second = receipt('c', 'RE3', '2026-11-01', '-200.00');
const all = [second, paid, first];

test('each refund shows what stood after itself, not after later refunds', () => {
  assert.equal(netAfter(first, all), 900);
  assert.equal(netAfter(second, all), 700);
});

test('two refunds on one date follow the document code', () => {
  const sameDay = receipt('d', 'RE4', '2026-11-01', '-50.00');
  assert.equal(netAfter(second, [...all, sameDay]), 700);
  assert.equal(netAfter(sameDay, [...all, sameDay]), 650);
});

test('a later receipt changes nothing for an earlier one', () => {
  const later = receipt('e', 'RE5', '2026-12-01', '300.00');
  assert.equal(netAfter(first, [...all, later]), 900);
});

test('a custom order with no customer keeps its name, a store order does not (D25)', () => {
  assert.equal(customerOf({ saleOrder: { sale_order_type: 'custom', sale_order_name: 'Custom MUG-103' } }), 'Custom MUG-103');
  assert.equal(customerOf({ saleOrder: { sale_order_type: 'store', sale_order_name: 'Store 12' } }), '—');
});
