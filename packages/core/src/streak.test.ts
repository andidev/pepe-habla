import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { bumpStreak, emptyStreak, isStreak } from './streak.ts';

describe('bumpStreak', () => {
  test('a first ever round starts the streak at one', () => {
    assert.deepEqual(bumpStreak(emptyStreak(), '2026-09-19'),
      { days: 1, lastDate: '2026-09-19' });
  });

  test('a round the next day extends it', () => {
    assert.deepEqual(bumpStreak({ days: 3, lastDate: '2026-09-18' }, '2026-09-19'),
      { days: 4, lastDate: '2026-09-19' });
  });

  test('a second round the same day changes nothing', () => {
    assert.deepEqual(bumpStreak({ days: 4, lastDate: '2026-09-19' }, '2026-09-19'),
      { days: 4, lastDate: '2026-09-19' });
  });

  test('a missed day resets to one — no freezes, no repairs', () => {
    assert.deepEqual(bumpStreak({ days: 12, lastDate: '2026-09-17' }, '2026-09-19'),
      { days: 1, lastDate: '2026-09-19' });
  });

  test('it extends across a month boundary', () => {
    assert.deepEqual(bumpStreak({ days: 2, lastDate: '2026-09-30' }, '2026-10-01'),
      { days: 3, lastDate: '2026-10-01' });
  });
});

describe('isStreak', () => {
  test('an empty streak is a streak', () => {
    assert.equal(isStreak(emptyStreak()), true);
  });

  test('a live streak is a streak', () => {
    assert.equal(isStreak({ days: 12, lastDate: '2026-09-21' }), true);
  });

  test('extra fields an older version wrote do not disqualify it', () => {
    assert.equal(isStreak({ days: 1, lastDate: '2026-09-21', best: 9 }), true);
  });

  test('a numeric lastDate is not a streak', () => {
    // This is the blob that cost a learner every morning reminder: it parses,
    // so the old cast let it through, and daysBetween threw days later.
    assert.equal(isStreak({ days: 3, lastDate: 20260921 }), false);
  });

  test('a lastDate that is not a real date is not a streak', () => {
    assert.equal(isStreak({ days: 3, lastDate: 'yesterday' }), false);
  });

  test('a missing lastDate is not a streak', () => {
    assert.equal(isStreak({ days: 3 }), false);
  });

  test('days has to be a finite, non-negative number', () => {
    assert.equal(isStreak({ days: '3', lastDate: '2026-09-21' }), false);
    assert.equal(isStreak({ days: -1, lastDate: '2026-09-21' }), false);
    assert.equal(isStreak({ days: NaN, lastDate: '2026-09-21' }), false);
    assert.equal(isStreak({ days: Infinity, lastDate: '2026-09-21' }), false);
  });

  test('anything that is not an object is not a streak', () => {
    assert.equal(isStreak(null), false);
    assert.equal(isStreak(undefined), false);
    assert.equal(isStreak(7), false);
    assert.equal(isStreak('{"days":1}'), false);
    assert.equal(isStreak([{ days: 1, lastDate: null }]), false);
  });
});
