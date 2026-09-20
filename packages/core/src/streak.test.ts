import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { bumpStreak, emptyStreak } from './streak.ts';

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
