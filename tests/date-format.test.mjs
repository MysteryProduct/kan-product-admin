import { test } from 'node:test';
import assert from 'node:assert/strict';
import sourceLoader from './load-source.mjs';

// The clock the module under test sees; `new Date()` inside it reads `now`.
const RealDate = Date;
let now = 0;
class FakeDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(now);
    else super(...args);
  }

  static now() {
    return now;
  }
}
const { toLocalIsoDate, todayLocalIso, toDateInputValue } = sourceLoader({}, { Date: FakeDate })(
  'src/lib/date-format.ts',
);

const inZone = (zone, isoInstant, run) => {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  now = RealDate.parse(isoInstant);
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
};

test('at 00:30 in Thailand today is the Thai date, not the UTC one the old code gave', () => {
  // 2026-09-30 00:30 in Bangkok is still 2026-09-29 17:30 UTC.
  inZone('Asia/Bangkok', '2026-09-29T17:30:00Z', () => {
    assert.equal(new RealDate(now).toISOString().slice(0, 10), '2026-09-29', 'what toISOString() returned');
    assert.equal(todayLocalIso(), '2026-09-30');
  });
});

test('the date follows the device time zone, not a fixed one', () => {
  // 2026-09-30 05:00 UTC is 2026-09-29 22:00 in Los Angeles and 2026-09-30 14:00 in Tokyo.
  inZone('America/Los_Angeles', '2026-09-30T05:00:00Z', () => assert.equal(todayLocalIso(), '2026-09-29'));
  inZone('Asia/Tokyo', '2026-09-30T05:00:00Z', () => assert.equal(todayLocalIso(), '2026-09-30'));
});

test('a given Date is read in local time and padded', () => {
  inZone('Asia/Bangkok', '2026-01-05T00:00:00Z', () => {
    assert.equal(toLocalIsoDate(new FakeDate(2026, 0, 5, 0, 30)), '2026-01-05');
    assert.equal(toLocalIsoDate(new FakeDate(2026, 11, 31, 23, 59)), '2026-12-31');
  });
});

test('a stored date shows as stored in every zone, so saving it again does not move it', () => {
  // The API keeps the chosen day as midnight UTC; some rows hold a later time of day (a default timestamp).
  for (const zone of ['Asia/Bangkok', 'America/Los_Angeles', 'UTC']) {
    inZone(zone, '2026-09-30T12:00:00Z', () => {
      assert.equal(toDateInputValue('2026-09-10T00:00:00.000Z'), '2026-09-10', zone);
      assert.equal(toDateInputValue('2026-09-10T20:00:00.000Z'), '2026-09-10', zone);
      assert.equal(toDateInputValue('2026-09-10'), '2026-09-10', zone);
      assert.equal(toDateInputValue('2026-09-10 12:05:46'), '2026-09-10', zone);
    });
  }
});

test('a missing or unreadable stored date falls back to today', () => {
  inZone('Asia/Bangkok', '2026-09-29T17:30:00Z', () => {
    assert.equal(toDateInputValue(undefined), '2026-09-30');
    assert.equal(toDateInputValue(null), '2026-09-30');
    assert.equal(toDateInputValue(''), '2026-09-30');
    assert.equal(toDateInputValue('not a date'), '2026-09-30');
  });
});
