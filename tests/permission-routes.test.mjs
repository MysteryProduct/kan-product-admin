import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sourceLoader from './load-source.mjs';

// The sidebar file builds icons with JSX; only the menu data matters here.
const load = sourceLoader({
  'react/jsx-runtime': { jsx: () => null, jsxs: () => null },
});
const { adminMenu } = load('src/lib/admin-menu.tsx');
const { getMenuNameFromPath } = load('src/lib/permission-routes.ts');

const leaves = adminMenu.flatMap((section) =>
  section.items.flatMap((item) => item.subItems ?? []),
);

test('every sidebar page is guarded by the menu it is listed under', () => {
  assert.ok(leaves.length > 0, 'the sidebar has pages');
  for (const leaf of leaves) {
    assert.equal(
      getMenuNameFromPath(leaf.href),
      leaf.menu_name,
      `${leaf.href} must check ${leaf.menu_name} before it loads`,
    );
  }
});

// Menus the API checks that have no sidebar entry of their own.
const MENUS_WITHOUT_SIDEBAR_ENTRY = ['employee_permissions'];

const sourceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
);
const sourceFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });

test('every permission name passed to can() is a menu the API knows', () => {
  const known = new Set([
    ...leaves.map((leaf) => leaf.menu_name),
    ...MENUS_WITHOUT_SIDEBAR_ENTRY,
  ]);
  const unknown = [];
  let checked = 0;
  for (const file of sourceFiles(sourceRoot)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\bcan\(\s*'([a-z_]+)'/g)) {
      checked += 1;
      if (!known.has(match[1]))
        unknown.push(`${path.relative(sourceRoot, file)}: can('${match[1]}')`);
    }
  }
  assert.ok(checked > 0, 'can() calls were found');
  assert.deepEqual(unknown, [], 'permission names the API never checks');
});
