import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DISTRACTED_MS, EASY_MS, INITIAL_EASE, MAX_EASE, MAX_INTERVAL, MIN_EASE,
  quality, schedule, type Schedule,
} from './sm2.ts';

const at = (over: Partial<Schedule> = {}): Schedule => ({
  reps: 0, ease: INITIAL_EASE, interval: 0, ...over,
});

describe('quality', () => {
  test('a wrong tap is "again", however fast it came', () => {
    assert.equal(quality(false, 100), 'again');
    assert.equal(quality(false, 45_000), 'again');
  });

  test('a right tap under three seconds is "easy"', () => {
    assert.equal(quality(true, EASY_MS - 1), 'easy');
  });

  test('exactly three seconds is "good", not "easy"', () => {
    assert.equal(quality(true, EASY_MS), 'good');
  });

  test('a right tap after thirty seconds is a distraction, not a struggle', () => {
    // Nothing punishes a slow right answer today, so this pins the rule in
    // place for the day a 'hard' grade is added.
    assert.equal(quality(true, DISTRACTED_MS + 15_000), 'good');
  });

  test('an untimed right answer is "good"', () => {
    // The CLI records answers with no clock behind them.
    assert.equal(quality(true), 'good');
  });
});

describe('schedule', () => {
  test('the first right answer comes back tomorrow', () => {
    assert.deepEqual(schedule(at(), 'good'), { reps: 1, ease: 2.5, interval: 1 });
  });

  test('the second comes back in three days', () => {
    assert.deepEqual(schedule(at({ reps: 1, interval: 1 }), 'good'),
      { reps: 2, ease: 2.5, interval: 3 });
  });

  test('from the third answer on, the interval grows by the ease', () => {
    // round(3 x 2.5) = 8
    assert.deepEqual(schedule(at({ reps: 2, interval: 3 }), 'good'),
      { reps: 3, ease: 2.5, interval: 8 });
  });

  test('an easy answer raises the ease and stretches the interval', () => {
    // 2.5 + 0.10 = 2.6; round(3 x 2.6 x 1.3) = 10
    assert.deepEqual(schedule(at({ reps: 2, interval: 3 }), 'easy'),
      { reps: 3, ease: 2.6, interval: 10 });
  });

  test('the first two intervals are fixed even when the answer was easy', () => {
    // The bonus is banked all the same; it pays from the third answer on.
    assert.deepEqual(schedule(at(), 'easy'), { reps: 1, ease: 2.6, interval: 1 });
  });

  test('a miss resets the streak, docks the ease and asks again tomorrow', () => {
    assert.deepEqual(schedule(at({ reps: 4, ease: 2.5, interval: 40 }), 'again'),
      { reps: 0, ease: 2.3, interval: 1 });
  });

  test('ease never falls below the floor, however many misses', () => {
    let s = at({ ease: MIN_EASE });
    for (let i = 0; i < 5; i += 1) s = schedule(s, 'again');
    assert.equal(s.ease, MIN_EASE);
  });

  test('ease never climbs above the ceiling', () => {
    let s = at({ ease: MAX_EASE });
    for (let i = 0; i < 5; i += 1) s = schedule(s, 'easy');
    assert.equal(s.ease, MAX_EASE);
  });

  test('ease is held to two decimals, so a long history does not drift', () => {
    // 2.5 - 0.2 - 0.2 is 2.0999999999999996 in binary floating point. Rounding
    // at each step keeps the number that reaches AsyncStorage readable and
    // keeps assertions about it exact.
    const once = schedule(at({ reps: 3, interval: 8 }), 'again');
    const twice = schedule({ ...once, reps: 3, interval: 8 }, 'again');
    assert.equal(twice.ease, 2.1);
  });

  test('the interval is capped at a year', () => {
    assert.deepEqual(schedule(at({ reps: 9, ease: MAX_EASE, interval: 300 }), 'good'),
      { reps: 10, ease: MAX_EASE, interval: MAX_INTERVAL });
  });

  test('it returns a new object rather than mutating the old one', () => {
    const before = at({ reps: 2, interval: 3 });
    schedule(before, 'good');
    assert.deepEqual(before, { reps: 2, ease: 2.5, interval: 3 });
  });
});
