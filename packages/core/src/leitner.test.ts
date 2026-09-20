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
  lastSeen: null,
  dueOn: '2026-09-19',
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
