import { test } from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';

// A labelled-by-time card must follow the clock: the hook re-reads the time on a timer and stops the timer on unmount.
function harness() {
  const clock = { time: 1_000_000 };
  const timers = [];
  const cleared = [];
  const states = [];
  let cursor = 0;
  const effects = [];
  class FakeDate { static now() { return clock.time; } }
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], (value) => { states[index] = value; }];
    },
    useEffect(callback) { effects.push(callback); },
  };
  const globals = {
    Date: FakeDate,
    setInterval: (callback, ms) => { timers.push({ callback, ms }); return timers.length; },
    clearInterval: (id) => cleared.push(id),
  };
  const { useNow } = sourceLoader({ react }, globals)('src/hooks/useNow.ts');
  const useRendered = (ms) => { cursor = 0; effects.length = 0; return useNow(ms); };
  return { clock, timers, cleared, useRendered, effects };
}

test('reads the time on mount and again on every tick', () => {
  const h = harness();
  assert.equal(h.useRendered(), 1_000_000);
  const cleanup = h.effects[0]();
  assert.equal(h.timers.length, 1);
  assert.equal(h.timers[0].ms, 60_000);
  h.clock.time = 1_000_000 + 3 * 86_400_000;
  h.timers[0].callback();
  assert.equal(h.useRendered(), 1_000_000 + 3 * 86_400_000);
  cleanup();
  assert.deepEqual(h.cleared, [1]);
});

test('a custom interval is used', () => {
  const h = harness();
  h.useRendered(5_000);
  h.effects[0]();
  assert.equal(h.timers[0].ms, 5_000);
});
