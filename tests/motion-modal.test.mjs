import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function fixture(initialOverflow = 'auto') {
  const effects = [];
  const listeners = new Set();
  const document = {
    body: { style: { overflow: initialOverflow } },
    activeElement: null,
    addEventListener: (_, callback) => listeners.add(callback),
    removeEventListener: (_, callback) => listeners.delete(callback),
  };
  class HTMLElement {
    isConnected = true;
    focus() { document.activeElement = this; }
    querySelector() { return this; }
    querySelectorAll() { return [this]; }
  }
  const opener = new HTMLElement();
  opener.focus();
  const jsx = (_, props) => {
    if (props?.role === 'dialog') props.ref.current = new HTMLElement();
    return props;
  };
  const context = vm.createContext({
    document, HTMLElement, exports: {},
    require: (name) => name === 'react' ? {
      useRef: (current) => ({ current }),
      useEffect: (callback) => effects.push(callback),
      useId: () => 'fixture',
    } : name === 'react-dom' ? { createPortal: (child) => child } : { jsx, jsxs: jsx },
  });
  const file = process.env.MOTION_TEST_SOURCE_ROOT
    ? path.join(process.env.MOTION_TEST_SOURCE_ROOT, 'components/Modal.tsx')
    : new URL('../src/components/Modal.tsx', import.meta.url);
  vm.runInContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  return {
    document, opener, listeners,
    open() {
      effects.length = 0;
      context.exports.default({ isOpen: true, title: 'ทดสอบ', onClose() {}, children: null });
      const cleanups = effects.map((callback) => callback());
      return () => { for (const cleanup of cleanups) cleanup?.(); };
    },
  };
}

test('closing stacked form and result in either cleanup order restores the original scroll/focus', () => {
  for (const order of [[0,1], [1,0]]) {
    const s = fixture();
    const close = [s.open(), s.open()];
    close[order[0]]();
    assert.equal(s.document.body.style.overflow, 'hidden');
    close[order[1]]();
    assert.equal(s.document.body.style.overflow, 'auto');
    assert.equal(s.document.activeElement, s.opener);
    assert.equal(s.listeners.size, 0);
  }
});

test('rapid open/close preserves a pre-existing body lock and removes listeners', () => {
  const s = fixture('hidden');
  for (let i=0;i<4;i++) s.open()();
  assert.equal(s.document.body.style.overflow, 'hidden');
  assert.equal(s.document.activeElement, s.opener);
  assert.equal(s.listeners.size, 0);
});

test('closing a lower modal leaves focus in the upper modal', () => {
  const s = fixture();
  const lower = s.open();
  const upper = s.open();
  const upperFocus = s.document.activeElement;
  lower();
  assert.equal(s.document.activeElement, upperFocus);
  upper();
  assert.equal(s.document.body.style.overflow, 'auto');
});
