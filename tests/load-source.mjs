import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

// Load the actual TypeScript modules with isolated browser boundaries.
// No extra test runtime/dependency is required by this repository.
export default function sourceLoader(mocks = {}, globals = {}) {
  const cache = new Map();
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const compiled = { exports: {} };
    cache.set(filename, compiled);
    const requireFromSource = createRequire(filename);
    const localRequire = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('@/') || name.startsWith('.')) {
        const target = name.startsWith('@/')
          ? path.join(root, 'src', name.slice(2))
          : path.resolve(path.dirname(filename), name);
        return load(`${target}.ts`);
      }
      return requireFromSource(name);
    };
    const { outputText } = ts.transpileModule(
      fs.readFileSync(filename, 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
        },
        fileName: filename,
      },
    );
    vm.runInNewContext(
      outputText,
      {
        module: compiled,
        exports: compiled.exports,
        require: localRequire,
        process: { env: { NODE_ENV: 'test' } },
        console,
        Event,
        ...globals,
      },
      { filename },
    );
    return compiled.exports;
  }
  return load;
}
