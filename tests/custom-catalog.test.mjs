import { test } from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';

const { bodyFromForm, formFromRevision, formProblems, priceFrom } = sourceLoader()('src/lib/custom-catalog.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

const revision = () => ({
  custom_template_id: 't1',
  template_code: 'MUG',
  template_name: 'แก้ว',
  type: { type_code: 'mug', type_name: 'แก้ว', sale_unit: 'ชิ้น' },
  revision: 1,
  status: 'draft',
  model_version: null,
  description: null,
  base_unit_price: '199.00',
  min_quantity: 1,
  max_quantity: null,
  published_at: null,
  groups: [
    {
      group_key: 'size',
      group_label: 'ขนาด',
      is_required: true,
      sort_order: 0,
      values: [
        { value_key: '11', value_label: '11 oz', unit_price_delta: '0.00' },
        { value_key: '15', value_label: '15 oz', unit_price_delta: '50.50' },
      ],
    },
  ],
  rules: [],
  recipe: [
    {
      group_key: null,
      value_key: null,
      material_id: 'm1',
      material_code: 'MT1',
      material_name: 'x',
      product_unit_id: 1,
      qty_per_unit: 1,
      setup_qty: 2,
    },
  ],
});

test('a revision round-trips through the form and the save body', () => {
  const form = formFromRevision(revision());
  assert.equal(form.model_version, '');
  assert.equal(form.max_quantity, '');
  const body = plain(bodyFromForm(form));
  assert.equal(body.base_unit_price, '199.00');
  assert.equal('model_version' in body, false);
  assert.equal('max_quantity' in body, false);
  assert.deepEqual(body.recipe[0], { material_id: 'm1', product_unit_id: 1, qty_per_unit: 1, setup_qty: 2 });
  assert.equal(body.groups[0].values[1].unit_price_delta, '50.50');
});

test('the form names a fractional quantity, a zero price and an empty recipe amount', () => {
  const form = formFromRevision(revision());
  assert.deepEqual(plain(formProblems(form)), []);
  form.min_quantity = '1.5';
  form.base_unit_price = '0';
  form.recipe[0].qty_per_unit = '0';
  form.recipe[0].setup_qty = '0';
  assert.equal(formProblems(form).length, 3);
});

test('a rule or recipe line that points at a missing option is reported', () => {
  const form = formFromRevision(revision());
  form.rules = [{ group_key: 'size', value_key: '11', other_group_key: 'size', other_value_key: 'gone', kind: 'excludes' }];
  form.recipe[0].group_key = 'size';
  form.recipe[0].value_key = '';
  assert.equal(formProblems(form).length, 2);
});

test('the lowest price counts required groups at their cheapest value', () => {
  const form = formFromRevision(revision());
  assert.equal(priceFrom(form), '199.00');
  form.groups[0].values[0].unit_price_delta = '-20';
  assert.equal(priceFrom(form), '179.00');
  form.base_unit_price = '';
  assert.equal(priceFrom(form), null);
});
