import { test } from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';

const mod = sourceLoader()('src/lib/shop-contact.ts');
// The module runs in a vm context, so its objects have another realm's
// prototypes; comparing plain copies keeps deepStrictEqual about the data.
const plain = (value) => JSON.parse(JSON.stringify(value));
const emptyShopContact = plain(mod.emptyShopContact);
const shopContactFrom = (settings) => plain(mod.shopContactFrom(settings));
const shopContactPayload = (form) => plain(mod.shopContactPayload(form));
const validateShopContact = (form) => plain(mod.validateShopContact(form));

// What the owner gave on 2026-10-06 (TASK-0046).
const owner = {
  shop_phone: '0645914468',
  shop_line: '@365xsxog',
  shop_email: 'kanproducts289@gmail.com',
  shop_hours: '09.00-17.30 น.',
};

test('the owner values are valid', () => {
  assert.deepEqual(validateShopContact(owner), {});
});

test('blank fields are valid and are sent as null so they are cleared', () => {
  assert.deepEqual(validateShopContact(emptyShopContact), {});
  assert.deepEqual(
    shopContactPayload({ shop_phone: '  ', shop_email: '', shop_line: ' ', shop_hours: '' }),
    { shop_phone: null, shop_email: null, shop_line: null, shop_hours: null },
  );
});

test('values are trimmed before they are sent', () => {
  assert.deepEqual(shopContactPayload({ ...owner, shop_phone: ' 0645914468 ' }), owner);
});

test('a missing settings row gives empty form fields, not "null"', () => {
  assert.deepEqual(shopContactFrom(null), emptyShopContact);
  assert.deepEqual(shopContactFrom({ shop_phone: null, shop_line: '@a1' }), {
    ...emptyShopContact,
    shop_line: '@a1',
  });
});

test('each invalid channel is reported on its own field, in Thai', () => {
  const errors = validateShopContact({
    shop_phone: 'abc-123',
    shop_email: 'bad@',
    shop_line: 'https://evil.example/x',
    shop_hours: 'x'.repeat(201),
  });
  assert.deepEqual(Object.keys(errors).sort(), ['shop_email', 'shop_hours', 'shop_line', 'shop_phone']);
  for (const message of Object.values(errors)) assert.match(message, /[ก-๙]/);
});

test('LINE accepts an id or a line.me / lin.ee page, nothing else', () => {
  for (const ok of ['@365xsxog', 'https://lin.ee/abc', 'https://line.me/R/ti/p/%40shop']) {
    assert.deepEqual(validateShopContact({ ...emptyShopContact, shop_line: ok }), {}, ok);
  }
  for (const bad of ['shop', 'http://line.me/x', 'https://line.me.evil.example/x', 'https://line.me@evil.example/x', 'javascript:alert(1)']) {
    assert.ok(validateShopContact({ ...emptyShopContact, shop_line: bad }).shop_line, bad);
  }
});

test('phone needs 8-15 digits', () => {
  for (const ok of ['0645914468', '+66 64-591-4468', '02 (123) 4567']) {
    assert.deepEqual(validateShopContact({ ...emptyShopContact, shop_phone: ok }), {}, ok);
  }
  for (const bad of ['1234567', '1234567890123456', '+66+645914468', '064 591 4468 ext']) {
    assert.ok(validateShopContact({ ...emptyShopContact, shop_phone: bad }).shop_phone, bad);
  }
});
