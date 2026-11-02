import { test } from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';

function dialog(onConfirm) {
  const state = [];
  let cursor = 0, closed = 0;
  const jsx = (type, props) => ({ type, props });
  const Component = sourceLoader({
    react: {
      useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value; }]; },
      useRef(initial) { const index = cursor++; return state[index] ??= { current: initial }; },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    '@/components/Modal': 'modal',
  })('src/components/CancellationDialog.tsx').default;
  const render = () => { cursor = 0; return Component({ title: 'ยกเลิก', onClose: () => closed++, onConfirm }); };
  const buttons = tree => tree.props.footer.props.children;
  // Find by element, not position: the body nests the free-text field in a fragment.
  const find = (node, match) => {
    if (!node || typeof node !== 'object') return undefined;
    if (Array.isArray(node)) { for (const child of node) { const hit = find(child, match); if (hit) return hit; } return undefined; }
    return match(node) ? node : find(node.props?.children, match);
  };
  const input = tree => find(tree.props.children, node => node.type === 'textarea');
  const alert = tree => find(tree.props.children, node => node.props?.role === 'alert');
  return { render, buttons, input, alert, closed: () => closed };
}

test('requires reason, trims it and suppresses duplicate submission', async () => {
  const reasons = []; let resolve;
  const pending = new Promise(done => { resolve = done; });
  const ui = dialog(reason => { reasons.push(reason); return pending; });
  let tree = ui.render();
  assert.equal(ui.buttons(tree)[1].props.disabled, true);
  ui.input(tree).props.onChange({ target: { value: '  เหตุผลทดสอบ  ' } });
  tree = ui.render();
  assert.equal(ui.buttons(tree)[1].props.disabled, false);
  ui.buttons(tree)[1].props.onClick();
  ui.buttons(tree)[1].props.onClick();
  tree = ui.render();
  assert.equal(ui.input(tree).props.disabled, true);
  tree.props.onClose();
  assert.equal(ui.closed(), 0);
  assert.deepEqual(reasons, ['เหตุผลทดสอบ']);
  resolve(); await new Promise(setImmediate);
  assert.equal(ui.closed(), 1);
});

test('failure preserves reason, shows error and permits retry', async () => {
  const ui = dialog(async () => { throw new Error('failure'); });
  let tree = ui.render();
  ui.input(tree).props.onChange({ target: { value: 'เหตุผลเดิม' } });
  tree = ui.render(); ui.buttons(tree)[1].props.onClick();
  await new Promise(setImmediate);
  tree = ui.render();
  assert.equal(ui.closed(), 0);
  assert.equal(ui.input(tree).props.value, 'เหตุผลเดิม');
  assert.equal(ui.buttons(tree)[1].props.disabled, false);
  assert.equal(ui.alert(tree)?.props.children, 'ยกเลิกไม่สำเร็จ กรุณาลองใหม่');
});
