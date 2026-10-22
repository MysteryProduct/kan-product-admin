import { test } from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';

const { bodyFromForm, clearMeshPicks, formFromRevision, formProblems, modelProblems, priceFrom, wrapLimitMm } =
  sourceLoader()('src/lib/custom-catalog.ts');
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

// TASK-0224: print area, cup shape, model picks and the product colour.
const cupConfig = () => ({
  faces: { front: { width_mm: 200, height_mm: 80, mesh: 'Print' } },
  cup: { top_diameter_mm: 82, bottom_diameter_mm: 60, height_mm: 95, margin_top_mm: 5, margin_bottom_mm: 8 },
  body_mesh: 'Body',
});
const withConfig = (config) => ({ ...revision(), model_config: config, model_file: null });

test('a revision without model data keeps the default and sends no model_config', () => {
  const form = formFromRevision(revision());
  assert.equal(form.model.shape, 'flat');
  assert.deepEqual(plain(modelProblems(form.model)), []);
  assert.equal('model_config' in plain(bodyFromForm(form)), false);
});

test('a cup config round-trips as millimetres and numbers', () => {
  const form = formFromRevision(withConfig(cupConfig()));
  assert.equal(form.model.shape, 'cup');
  assert.equal(form.model.front.width, '200');
  assert.equal(form.model.cup.marginBottom, '8');
  assert.deepEqual(plain(bodyFromForm(form).model_config), cupConfig());
  assert.deepEqual(plain(formProblems(form)), []);
});

test('a shirt sends a back face only while it is a shirt', () => {
  const config = {
    faces: { front: { width_mm: 280, height_mm: 350, mesh: 'Chest' }, back: { width_mm: 300, height_mm: 380, mesh: 'Back' } },
  };
  const form = formFromRevision(withConfig(config));
  assert.equal(form.model.shape, 'shirt');
  assert.deepEqual(plain(bodyFromForm(form).model_config), config);
  form.model.shape = 'flat';
  assert.equal('back' in plain(bodyFromForm(form).model_config.faces), false);
  form.model.shape = 'shirt';
  form.model.back.width = '';
  assert.equal(modelProblems(form.model).length, 1);
});

test('the form names a cup print area wider or taller than the cup allows', () => {
  const form = formFromRevision(withConfig(cupConfig()));
  assert.ok(Math.abs(wrapLimitMm(form.model) - Math.PI * 82) < 1e-9);
  form.model.front.width = '300';
  assert.match(modelProblems(form.model).join(), /เส้นรอบวง/);
  form.model.front.width = '200';
  form.model.front.height = '90';
  assert.match(modelProblems(form.model).join(), /ช่วงระหว่างระยะขอบ/);
  form.model.front.height = '80';
  form.model.cup.marginTop = '60';
  form.model.cup.marginBottom = '40';
  assert.match(modelProblems(form.model).join(), /ระยะขอบบนและล่าง/);
});

test('sizes must be millimetres with one decimal and a mesh cannot be both print and dye', () => {
  const form = formFromRevision(withConfig(cupConfig()));
  form.model.front.width = '100.55';
  assert.equal(modelProblems(form.model).length, 1);
  form.model.front.width = '100.5';
  form.model.body_mesh = 'Print';
  assert.match(modelProblems(form.model).join(), /ต้องไม่ใช่ mesh พื้นที่พิมพ์/);
  form.model.shape = 'cup';
  form.model.front = { width: '', height: '', mesh: '' };
  assert.ok(modelProblems(form.model).length >= 2);
});

test('a new model file clears the mesh picks and keeps the sizes', () => {
  const form = clearMeshPicks(formFromRevision(withConfig(cupConfig())));
  assert.equal(form.model.front.mesh, '');
  assert.equal(form.model.body_mesh, '');
  assert.equal(form.model.front.width, '200');
  assert.equal(form.model.cup.top, '82');
});

test('the colour group sends a lower-case hex on each value and nowhere else', () => {
  const r = revision();
  r.groups.push({
    group_key: 'color',
    group_label: 'สี',
    is_required: true,
    is_color_group: true,
    sort_order: 1,
    values: [{ value_key: 'red', value_label: 'แดง', unit_price_delta: '0.00', color_hex: '#C0392B' }],
  });
  const form = formFromRevision(r);
  const body = plain(bodyFromForm(form));
  assert.equal(body.groups[1].is_color_group, true);
  assert.equal(body.groups[1].values[0].color_hex, '#c0392b');
  assert.equal('is_color_group' in body.groups[0], false);
  assert.equal('color_hex' in body.groups[0].values[0], false);
  // A leftover hex typed before the box was unticked is not sent.
  form.groups[1].is_color_group = false;
  assert.equal('color_hex' in plain(bodyFromForm(form)).groups[1].values[0], false);
});

test('the form names a colour value without a valid hex and a second colour group', () => {
  const r = revision();
  r.groups[0].is_color_group = true;
  const form = formFromRevision(r);
  assert.equal(formProblems(form).length, 2);
  form.groups[0].values.forEach((v) => (v.color_hex = '#336699'));
  assert.deepEqual(plain(formProblems(form)), []);
  form.groups.push({ ...form.groups[0], group_key: 'other', is_color_group: true });
  assert.match(formProblems(form).join(), /หนึ่งกลุ่ม/);
});
