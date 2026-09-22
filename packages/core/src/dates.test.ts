import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysBetween, isISODate, todayISO } from './dates.ts';

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

describe('isISODate', () => {
  test('accepts a YYYY-MM-DD string', () => {
    assert.equal(isISODate('2026-09-21'), true);
  });

  test('accepts a leap day that exists', () => {
    assert.equal(isISODate('2028-02-29'), true);
  });

  test('rejects a number that looks like a date', () => {
    // A stored blob holding 20260921 parses as JSON and then blows up inside
    // daysBetween with "iso.split is not a function", far from the storage
    // layer that let it through.
    assert.equal(isISODate(20260921), false);
  });

  test('rejects null and undefined', () => {
    assert.equal(isISODate(null), false);
    assert.equal(isISODate(undefined), false);
  });

  test('rejects an unpadded date', () => {
    assert.equal(isISODate('2026-9-1'), false);
  });

  test('rejects a date with a time on it', () => {
    assert.equal(isISODate('2026-09-21T00:00:00.000Z'), false);
  });

  test('rejects a day the calendar does not have', () => {
    // Date.UTC would silently roll 2026-02-30 forward to March, so a due date
    // nobody ever lived through would still compare as a real one.
    assert.equal(isISODate('2026-02-30'), false);
    assert.equal(isISODate('2026-13-01'), false);
  });
});
