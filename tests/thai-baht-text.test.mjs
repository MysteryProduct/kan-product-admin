import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';

// The helper is TypeScript, so it is compiled here the way the Admin's other pure helpers are tested.
const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/lib/thai-baht-text.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } });
const { thaiBahtText } = await import(`data:text/javascript,${encodeURIComponent(outputText)}`);

for (const [amount, words] of [
  [10800, 'หนึ่งหมื่นแปดร้อยบาทถ้วน'],
  [1290.5, 'หนึ่งพันสองร้อยเก้าสิบบาทห้าสิบสตางค์'],
  [21, 'ยี่สิบเอ็ดบาทถ้วน'],
  [101, 'หนึ่งร้อยเอ็ดบาทถ้วน'],
  [1000000, 'หนึ่งล้านบาทถ้วน'],
  [0.25, 'ยี่สิบห้าสตางค์'],
  [11, 'สิบเอ็ดบาทถ้วน'],
  [1000001, 'หนึ่งล้านเอ็ดบาทถ้วน'],
  [0, 'ศูนย์บาทถ้วน'],
]) {
  test(`${amount} reads ${words}`, () => assert.equal(thaiBahtText(amount), words));
}
