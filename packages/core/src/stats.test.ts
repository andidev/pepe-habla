import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { summarise, leeches } from './stats.ts';
import { isKnown } from './progress.ts';
import type { Progress, Word } from './types.ts';

const word = (id: string): Word => ({ id, es: `es-${id}`, en: `en-${id}`, sv: `sv-${id}`, pos: 'noun', track: 'words', level: 1, themes: [] });

const prog = (over: Partial<Progress> & { id: string }): Progress => ({
  reps: 0, ease: 2.5, interval: 0, seen: 0, right: 0, wrong: 0,
  rightEsToEn: 0, rightEnToEs: 0, knownOn: null,
  lastSeen: null, dueOn: '2026-09-20',
  ...over,
});

describe('isKnown (re-exported from progress)', () => {
  test('needs three correct answers in each direction', () => {
    assert.equal(isKnown(prog({ id: 'a', rightEsToEn: 3, rightEnToEs: 3 })), true);
  });

  test('is not satisfied by one direction alone, however many times', () => {
    assert.equal(isKnown(prog({ id: 'a', rightEsToEn: 12, rightEnToEs: 0 })), false);
  });

  test('is not satisfied by two of each', () => {
    assert.equal(isKnown(prog({ id: 'a', rightEsToEn: 2, rightEnToEs: 2 })), false);
  });

  test('a high box does not make a word known on its own', () => {
    assert.equal(isKnown(prog({ id: 'a', reps: 4, rightEsToEn: 3, rightEnToEs: 0 })), false);
  });
});

describe('summarise', () => {
  const words = [word('a'), word('b'), word('c')];

  test('counts what is known, seen and still due', () => {
    const progress = {
      a: prog({ id: 'a', rightEsToEn: 3, rightEnToEs: 3, seen: 8, right: 7, wrong: 1, dueOn: '2026-09-25' }),
      b: prog({ id: 'b', rightEsToEn: 1, rightEnToEs: 0, seen: 2, right: 1, wrong: 1, dueOn: '2026-09-20' }),
    };
    const s = summarise(words, progress, '2026-09-20');
    assert.equal(s.total, 3);
    assert.equal(s.practised, 2);
    assert.equal(s.known, 1);
    assert.equal(s.due, 1);
  });

  test('accuracy is over answers, not words, and is null before any answer', () => {
    assert.equal(summarise(words, {}, '2026-09-20').accuracy, null);
    const progress = { a: prog({ id: 'a', seen: 4, right: 3, wrong: 1 }) };
    assert.equal(summarise(words, progress, '2026-09-20').accuracy, 75);
  });

  test('learnedThisWeek counts when a word BECAME known, not when it was last seen', () => {
    const progress = {
      // Learned three days ago — counts.
      a: prog({ id: 'a', rightEsToEn: 3, rightEnToEs: 3, knownOn: '2026-09-17', lastSeen: '2026-09-17' }),
      // Learned months ago but reviewed yesterday — must NOT count. This is the
      // case that would otherwise make the figure drift toward the total.
      b: prog({ id: 'b', rightEsToEn: 9, rightEnToEs: 9, knownOn: '2026-06-01', lastSeen: '2026-09-19' }),
      // Practised this week but not known yet.
      c: prog({ id: 'c', rightEsToEn: 1, rightEnToEs: 0, lastSeen: '2026-09-19' }),
    };
    const s = summarise(words, progress, '2026-09-20');
    assert.equal(s.learnedThisWeek, 1);
  });

  test('a word learned today counts', () => {
    const progress = { a: prog({ id: 'a', rightEsToEn: 3, rightEnToEs: 3, knownOn: '2026-09-20' }) };
    assert.equal(summarise(words, progress, '2026-09-20').learnedThisWeek, 1);
  });

  test('a word learned exactly seven days ago has aged out', () => {
    const progress = { a: prog({ id: 'a', rightEsToEn: 3, rightEnToEs: 3, knownOn: '2026-09-13' }) };
    assert.equal(summarise(words, progress, '2026-09-20').learnedThisWeek, 0);
  });

  test('ignores progress for words no longer in the list', () => {
    const progress = { ghost: prog({ id: 'ghost', rightEsToEn: 3, rightEnToEs: 3 }) };
    const s = summarise(words, progress, '2026-09-20');
    assert.equal(s.practised, 0);
    assert.equal(s.known, 0);
  });
});

describe('leeches', () => {
  test('ranks the most-missed first', () => {
    const words = [word('a'), word('b'), word('c')];
    const progress = {
      a: prog({ id: 'a', seen: 9, right: 2, wrong: 7 }),
      b: prog({ id: 'b', seen: 5, right: 4, wrong: 1 }),
      c: prog({ id: 'c', seen: 8, right: 3, wrong: 5 }),
    };
    assert.deepEqual(leeches(words, progress).map((l) => l.word.id), ['a', 'c', 'b']);
  });

  test('leaves out words never answered wrong', () => {
    const words = [word('a'), word('b')];
    const progress = {
      a: prog({ id: 'a', seen: 3, right: 3, wrong: 0 }),
      b: prog({ id: 'b', seen: 3, right: 1, wrong: 2 }),
    };
    assert.deepEqual(leeches(words, progress).map((l) => l.word.id), ['b']);
  });

  test('honours the limit and reports the tally', () => {
    const words = [word('a'), word('b'), word('c')];
    const progress = {
      a: prog({ id: 'a', seen: 9, right: 2, wrong: 7 }),
      b: prog({ id: 'b', seen: 6, right: 2, wrong: 4 }),
      c: prog({ id: 'c', seen: 5, right: 2, wrong: 3 }),
    };
    const top = leeches(words, progress, 2);
    assert.equal(top.length, 2);
    assert.deepEqual(top[0], { word: words[0], wrong: 7, seen: 9, accuracy: 22 });
  });
});
