import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysBetween, todayISO } from './dates.ts';

describe('addDays', () => {
  test('adds within a month', () => {
    assert.equal(addDays('2026-09-19', 4), '2026-09-23');
  });
  test('rolls over a month end', () => {
    assert.equal(addDays('2026-09-28', 8), '2026-10-06');
  });
  test('rolls over a year end', () => {
    assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  });
  test('handles a leap day', () => {
    assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  });
  test('zero is identity', () => {
    assert.equal(addDays('2026-09-19', 0), '2026-09-19');
  });
});

describe('daysBetween', () => {
  test('counts forward', () => {
    assert.equal(daysBetween('2026-09-19', '2026-09-23'), 4);
  });
  test('counts backward as negative', () => {
    assert.equal(daysBetween('2026-09-23', '2026-09-19'), -4);
  });
  test('is unaffected by daylight saving shifts', () => {
    // Mexico abolished DST in 2022, but the host machine's zone may not have.
    assert.equal(daysBetween('2026-03-01', '2026-04-01'), 31);
    assert.equal(daysBetween('2026-10-15', '2026-11-15'), 31);
  });
});

describe('todayISO', () => {
  test('returns a YYYY-MM-DD string', () => {
    assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
  });
});
