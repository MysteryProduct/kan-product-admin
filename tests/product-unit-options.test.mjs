import test from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';

function setup(handler) {
  const calls = [];
  const axios = {
    get: async (url, config) => {
      calls.push([url, JSON.parse(JSON.stringify(config))]);
      return handler(url, config);
    },
  };
  const load = sourceLoader({ '@/lib/axios': axios });
  return { calls, units: new (load('src/models/product-unit.ts').ProductUnitModel)() };
}

const pageOf = (total) => (url, config) => {
  const { page, limit } = config.params;
  const count = Math.max(0, Math.min(limit, total - (page - 1) * limit));
  return {
    data: {
      data: Array.from({ length: count }, (_, i) => ({
        product_unit_id: (page - 1) * limit + i + 1,
        product_unit_name: `unit ${(page - 1) * limit + i + 1}`,
      })),
      meta: { total, page, limit, last_page: Math.ceil(total / limit) },
    },
  };
};

test('all unit options page through the list at the legal limit instead of stopping at 100 (TASK-0149)', async () => {
  const s = setup(pageOf(233));
  const { data } = await s.units.getAllProductUnits();
  assert.equal(data.length, 233);
  assert.equal(data.at(-1).product_unit_id, 233);
  assert.deepEqual(s.calls.map(([, config]) => config.params.page), [1, 2, 3]);
  assert.ok(s.calls.every(([url, config]) => url === '/product-unit' && config.params.limit === 100));
});

test('all unit options keep a search term on every page and an empty list stays empty', async () => {
  const searched = setup(pageOf(150));
  await searched.units.getAllProductUnits('ชิ้น');
  assert.ok(searched.calls.every(([, config]) => config.params.search === 'ชิ้น'));

  const empty = setup(pageOf(0));
  const { data, meta } = await empty.units.getAllProductUnits();
  assert.equal(data.length, 0);
  assert.equal(meta.last_page, 0);
  assert.equal(empty.calls.length, 1);
});
