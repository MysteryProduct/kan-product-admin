import test from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';
const plain = (value) => JSON.parse(JSON.stringify(value));
test('color update sends editable fields without client identity', async () => {
  const calls = [];
  const load = sourceLoader({
    '@/lib/axios': {
      patch: async (...args) => {
        calls.push(plain(args));
        return { data: {} };
      },
    },
  });
  const model = new (load('src/models/color.ts').default)();
  await model.updateColor({
    color_id: 42,
    color_name: 'สีเขียว',
    color_hex: '#00ff00',
  });
  assert.deepEqual(calls, [
    ['/color/42', { color_name: 'สีเขียว', color_hex: '#00ff00' }],
  ]);
});
for (const [source, method, path, idKey, nameKey] of [
  [
    'category',
    'getAllCategories',
    '/category/',
    'category_id',
    'category_name',
  ],
  ['color', 'getAllColors', '/color/', 'color_id', 'color_name'],
])
  test(
    source + ' options retain all205 rows with legal page limits',
    async () => {
      const calls = [];
      const load = sourceLoader({
        '@/lib/axios': {
          get: async (url, { params }) => {
            assert.equal(url, path);
            assert.equal(params.limit, 100);
            calls.push(params.page);
            return {
              data: {
                data: Array.from(
                  { length: params.page === 3 ? 5 : 100 },
                  (_, i) => ({
                    [idKey]: (params.page - 1) * 100 + i + 1,
                    [nameKey]: 'option',
                  }),
                ),
                meta: {
                  page: params.page,
                  limit: 100,
                  total: 205,
                  last_page: 3,
                },
              },
            };
          },
        },
      });
      const model = new (load('src/models/' + source + '.ts').default)();
      const result = await model[method]();
      assert.equal(result.data.length, 205);
      assert.equal(result.data.at(-1)[idKey], 205);
      assert.deepEqual(calls, [1, 2, 3]);
    },
  );
