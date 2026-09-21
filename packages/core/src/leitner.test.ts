import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { INTERVALS, applyAnswer, freshProgress, isDue } from './leitner.ts';
import type { Progress } from './types.ts';

const at = (over: Partial<Progress> = {}): Progress => ({
  id: 'el-abrigo',
  box: 1,
  seen: 0,
  right: 0,
  wrong: 0,
  rightEsToEn: 0,
  rightEnToEs: 0,
  lastSeen: null,
  dueOn: '2026-09-19',
  knownOn: null,
  ...over,
});

describe('intervals', () => {
  test('double each box, 1 through 16 days', () => {
    assert.deepEqual(INTERVALS, { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 });
  });
});

describe('applyAnswer', () => {
  test('a right answer promotes one box and schedules by the new box', () => {
    const next = applyAnswer(at({ box: 2 }), true, '2026-09-19');
    assert.equal(next.box, 3);
    assert.equal(next.dueOn, '2026-09-23'); // +4 days, box 3
    assert.equal(next.right, 1);
    assert.equal(next.seen, 1);
    assert.equal(next.lastSeen, '2026-09-19');
  });

  test('box 5 is the ceiling', () => {
    const next = applyAnswer(at({ box: 5 }), true, '2026-09-19');
    assert.equal(next.box, 5);
    assert.equal(next.dueOn, '2026-10-05'); // +16 days
  });

  test('a wrong answer drops straight to box 1, not one box down', () => {
    const next = applyAnswer(at({ box: 4, right: 3 }), false, '2026-09-19');
    assert.equal(next.box, 1);
    assert.equal(next.dueOn, '2026-09-20'); // back tomorrow
    assert.equal(next.wrong, 1);
    assert.equal(next.right, 3, 'past successes are not erased');
  });

  test('does not mutate the progress it is given', () => {
    const before = at({ box: 2 });
    applyAnswer(before, true, '2026-09-19');
    assert.equal(before.box, 2);
    assert.equal(before.seen, 0);
  });

  test('crosses month boundaries correctly', () => {
    const next = applyAnswer(at({ box: 3 }), true, '2026-09-28');
    assert.equal(next.dueOn, '2026-10-06'); // +8 days, box 4
  });
});

describe('freshProgress', () => {
  test('a new word starts in box 1 and is due immediately', () => {
    const p = freshProgress('la-cuenta', '2026-09-19');
    assert.equal(p.box, 1);
    assert.equal(p.dueOn, '2026-09-19');
    assert.equal(p.lastSeen, null);
    assert.equal(p.seen, 0);
  });
});

describe('isDue', () => {
  test('due today counts as due', () => {
    assert.equal(isDue(at({ dueOn: '2026-09-19' }), '2026-09-19'), true);
  });
  test('overdue counts as due', () => {
    assert.equal(isDue(at({ dueOn: '2026-09-01' }), '2026-09-19'), true);
  });
  test('tomorrow does not', () => {
    assert.equal(isDue(at({ dueOn: '2026-09-20' }), '2026-09-19'), false);
  });
});

describe('direction counters', () => {
  test('a new word starts with both at zero', () => {
    const p = freshProgress('la-cuenta', '2026-09-20');
    assert.equal(p.rightEsToEn, 0);
    assert.equal(p.rightEnToEs, 0);
  });

  test('a correct recognition answer counts only toward es->en', () => {
    const next = applyAnswer(at(), true, '2026-09-20', 'es->en');
    assert.equal(next.rightEsToEn, 1);
    assert.equal(next.rightEnToEs, 0);
  });

  test('a correct production answer counts only toward en->es', () => {
    const next = applyAnswer(at(), true, '2026-09-20', 'en->es');
    assert.equal(next.rightEsToEn, 0);
    assert.equal(next.rightEnToEs, 1);
  });

  test('a picture answer counts as production', () => {
    const next = applyAnswer(at(), true, '2026-09-20', 'picture->es');
    assert.equal(next.rightEnToEs, 1);
  });

  test('a wrong answer counts toward neither', () => {
    const next = applyAnswer(at({ rightEsToEn: 2 }), false, '2026-09-20', 'es->en');
    assert.equal(next.rightEsToEn, 2, 'a miss must not erase past successes either');
    assert.equal(next.rightEnToEs, 0);
  });

  test('omitting the direction leaves both counters alone', () => {
    const next = applyAnswer(at({ rightEsToEn: 1 }), true, '2026-09-20');
    assert.equal(next.rightEsToEn, 1);
    assert.equal(next.rightEnToEs, 0);
  });
});

describe('knownOn', () => {
  test('is stamped the day the word crosses in both directions', () => {
    const before = at({ rightEsToEn: 3, rightEnToEs: 2 });
    assert.equal(before.knownOn, null);
    const next = applyAnswer(before, true, '2026-09-20', 'en->es');
    assert.equal(next.knownOn, '2026-09-20');
  });

  test('is not stamped while only one direction is satisfied', () => {
    const next = applyAnswer(at({ rightEsToEn: 9 }), true, '2026-09-20', 'es->en');
    assert.equal(next.knownOn, null);
  });

  test('keeps its original date on later answers', () => {
    const known = at({ rightEsToEn: 3, rightEnToEs: 3, knownOn: '2026-09-01' });
    const next = applyAnswer(known, true, '2026-09-20', 'es->en');
    assert.equal(next.knownOn, '2026-09-01');
  });

  test('survives a lapse — it records when you learned it, not whether you still know it', () => {
    const known = at({ rightEsToEn: 3, rightEnToEs: 3, knownOn: '2026-09-01' });
    const missed = applyAnswer(known, false, '2026-09-20', 'es->en');
    assert.equal(missed.knownOn, '2026-09-01');
    assert.equal(missed.box, 1);
  });
});
