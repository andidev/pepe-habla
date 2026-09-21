import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Progress } from './types.ts';
import { INITIAL_EASE } from './sm2.ts';
import { applyAnswer, freshProgress, isDue, isKnown } from './progress.ts';

const at = (over: Partial<Progress> = {}): Progress => ({
  id: 'la-cuenta',
  reps: 0,
  ease: INITIAL_EASE,
  interval: 0,
  seen: 0,
  right: 0,
  wrong: 0,
  rightEsToEn: 0,
  rightEnToEs: 0,
  knownOn: null,
  lastSeen: null,
  dueOn: '2026-09-19',
  ...over,
});

describe('applyAnswer', () => {
  test('a right answer advances the streak and dates the next review from it', () => {
    const next = applyAnswer(at({ reps: 2, interval: 3 }), { correct: true, direction: null }, '2026-09-19');
    assert.equal(next.reps, 3);
    assert.equal(next.interval, 8);
    assert.equal(next.dueOn, '2026-09-27');
    assert.equal(next.lastSeen, '2026-09-19');
  });

  test('a fast right answer earns the easy bonus', () => {
    const next = applyAnswer(at({ reps: 2, interval: 3 }), { correct: true, direction: null, ms: 1200 }, '2026-09-19');
    assert.equal(next.ease, 2.6);
    assert.equal(next.interval, 10);
  });

  test('a slow right answer is not punished', () => {
    const next = applyAnswer(at({ reps: 2, interval: 3 }), { correct: true, direction: null, ms: 42_000 }, '2026-09-19');
    assert.equal(next.ease, INITIAL_EASE);
    assert.equal(next.interval, 8);
  });

  test('a wrong answer resets the streak and asks again tomorrow', () => {
    const next = applyAnswer(at({ reps: 4, interval: 40, right: 3 }), { correct: false, direction: null }, '2026-09-19');
    assert.equal(next.reps, 0);
    assert.equal(next.ease, 2.3);
    assert.equal(next.interval, 1);
    assert.equal(next.dueOn, '2026-09-20');
  });

  test('it counts the answer', () => {
    const right = applyAnswer(at(), { correct: true, direction: null }, '2026-09-19');
    assert.deepEqual([right.seen, right.right, right.wrong], [1, 1, 0]);
    const wrong = applyAnswer(at(), { correct: false, direction: null }, '2026-09-19');
    assert.deepEqual([wrong.seen, wrong.right, wrong.wrong], [1, 0, 1]);
  });

  test('it does not mutate the record it was given', () => {
    const before = at({ reps: 2, interval: 3 });
    applyAnswer(before, { correct: true, direction: null }, '2026-09-19');
    assert.equal(before.reps, 2);
    assert.equal(before.interval, 3);
  });
});

describe('direction counters', () => {
  test('recognition advances the es->en counter', () => {
    const next = applyAnswer(at(), { correct: true, direction: 'es->en' }, '2026-09-20');
    assert.deepEqual([next.rightEsToEn, next.rightEnToEs], [1, 0]);
  });

  test('production advances the en->es counter', () => {
    const next = applyAnswer(at(), { correct: true, direction: 'en->es' }, '2026-09-20');
    assert.deepEqual([next.rightEsToEn, next.rightEnToEs], [0, 1]);
  });

  test('a picture question is production', () => {
    const next = applyAnswer(at(), { correct: true, direction: 'picture->es' }, '2026-09-20');
    assert.deepEqual([next.rightEsToEn, next.rightEnToEs], [0, 1]);
  });

  test('a wrong answer advances neither', () => {
    const next = applyAnswer(at({ rightEsToEn: 2 }), { correct: false, direction: 'es->en' }, '2026-09-20');
    assert.deepEqual([next.rightEsToEn, next.rightEnToEs], [2, 0]);
  });

  test('an answer with no known direction credits neither', () => {
    // The CLI records answers this way. Crediting a guess would make a word
    // "known" in a direction it was never asked in.
    const next = applyAnswer(at({ rightEsToEn: 1 }), { correct: true, direction: null }, '2026-09-20');
    assert.deepEqual([next.rightEsToEn, next.rightEnToEs], [1, 0]);
  });
});

describe('isKnown and knownOn', () => {
  test('three in each direction, not six in one', () => {
    assert.equal(isKnown(at({ rightEsToEn: 6, rightEnToEs: 0 })), false);
    assert.equal(isKnown(at({ rightEsToEn: 3, rightEnToEs: 3 })), true);
  });

  test('the day it crossed is stamped once', () => {
    const before = at({ rightEsToEn: 3, rightEnToEs: 2 });
    const next = applyAnswer(before, { correct: true, direction: 'en->es' }, '2026-09-20');
    assert.equal(next.knownOn, '2026-09-20');
  });

  test('a later answer does not restamp it', () => {
    const known = at({ rightEsToEn: 3, rightEnToEs: 3, knownOn: '2026-09-20' });
    const next = applyAnswer(known, { correct: true, direction: 'es->en' }, '2026-09-25');
    assert.equal(next.knownOn, '2026-09-20');
  });

  test('a lapse keeps the date: it was learned then, whatever happened since', () => {
    const known = at({ rightEsToEn: 3, rightEnToEs: 3, knownOn: '2026-09-20' });
    const missed = applyAnswer(known, { correct: false, direction: 'es->en' }, '2026-09-25');
    assert.equal(missed.knownOn, '2026-09-20');
    assert.equal(missed.reps, 0);
  });
});

describe('freshProgress', () => {
  test('a new word starts at the default ease with nothing behind it, due today', () => {
    const p = freshProgress('la-cuenta', '2026-09-20');
    assert.deepEqual(p, {
      id: 'la-cuenta',
      reps: 0,
      ease: INITIAL_EASE,
      interval: 0,
      seen: 0,
      right: 0,
      wrong: 0,
      rightEsToEn: 0,
      rightEnToEs: 0,
      knownOn: null,
      lastSeen: null,
      dueOn: '2026-09-20',
    });
  });
});

describe('isDue', () => {
  test('due today and overdue both count; tomorrow does not', () => {
    assert.equal(isDue(at({ dueOn: '2026-09-20' }), '2026-09-20'), true);
    assert.equal(isDue(at({ dueOn: '2026-09-18' }), '2026-09-20'), true);
    assert.equal(isDue(at({ dueOn: '2026-09-21' }), '2026-09-20'), false);
  });
});
