import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Progress, Word } from './types.ts';
import { DOMINADAS_REPS, isDominada, levelStats, unlockedThrough } from './unlock.ts';

const word = (id: string, level: number): Word =>
  ({ id, es: id, en: id, sv: id, pos: 'noun', track: 'words', level, themes: ['verbos'] });

const at = (id: string, reps: number): Progress => ({
  id, reps, ease: 2.5, interval: 1, seen: reps, right: reps, wrong: 0,
  rightEsToEn: 0, rightEnToEs: 0, knownOn: null, lastSeen: null, dueOn: '2026-09-21',
});

/** n words in a level, the first `strong` of them dominadas. */
const level = (n: number, lvl: number, strong: number) => {
  const words = Array.from({ length: n }, (_, i) => word(`l${lvl}-w${i}`, lvl));
  const progress: Record<string, Progress> = {};
  words.forEach((w, i) => { progress[w.id] = at(w.id, i < strong ? DOMINADAS_REPS : 0); });
  return { words, progress };
};

describe('isDominada', () => {
  test('three correct first taps in a row, in any direction', () => {
    assert.equal(isDominada(at('a', 2)), false);
    assert.equal(isDominada(at('a', 3)), true);
    assert.equal(isDominada(at('a', 9)), true);
  });
});

describe('levelStats', () => {
  test('counts only the cards in that level of that track', () => {
    const a = level(10, 1, 7);
    const b = level(4, 2, 4);
    const stats = levelStats([...a.words, ...b.words], { ...a.progress, ...b.progress }, 'words', 1);
    assert.equal(stats.total, 10);
    assert.equal(stats.dominadas, 7);
    assert.equal(stats.ratio, 0.7);
  });

  test('a word never practised is not dominada', () => {
    const { words } = level(4, 1, 0);
    const stats = levelStats(words, {}, 'words', 1);
    assert.deepEqual([stats.total, stats.dominadas, stats.ratio], [4, 0, 0]);
  });

  test('an empty level is zero, not a divide by zero', () => {
    const stats = levelStats([], {}, 'words', 5);
    assert.deepEqual([stats.total, stats.dominadas, stats.ratio], [0, 0, 0]);
  });

  test('the other track is invisible', () => {
    const w = word('conjugated', 1);
    const g: Word = { ...w, id: 'g1', track: 'grammar' };
    const progress = { g1: at('g1', 5) };
    assert.equal(levelStats([g], progress, 'words', 1).total, 0);
    assert.equal(levelStats([g], progress, 'grammar', 1).dominadas, 1);
  });
});

describe('unlockedThrough', () => {
  test('level 1 is open from the start, with nothing practised at all', () => {
    assert.equal(unlockedThrough([], {}, 'words'), 1);
    assert.equal(unlockedThrough([], {}, 'grammar'), 1);
  });

  test('seventy percent of the level below opens the next one', () => {
    const a = level(10, 1, 7);
    const b = level(10, 2, 0);
    const words = [...a.words, ...b.words];
    assert.equal(unlockedThrough(words, { ...a.progress, ...b.progress }, 'words'), 2);
  });

  test('sixty-nine percent does not', () => {
    const a = level(100, 1, 69);
    assert.equal(unlockedThrough(a.words, a.progress, 'words'), 1);
  });

  test('it climbs as far as the evidence goes, and stops there', () => {
    const a = level(10, 1, 10);
    const b = level(10, 2, 8);
    const c = level(10, 3, 1);
    const words = [...a.words, ...b.words, ...c.words];
    const progress = { ...a.progress, ...b.progress, ...c.progress };
    assert.equal(unlockedThrough(words, progress, 'words'), 3);
  });

  test('an empty level is a wall: it can never be 70% done', () => {
    // Level 2 holds nothing yet, so level 3 stays shut however well level 1 goes.
    const a = level(10, 1, 10);
    const c = level(10, 3, 10);
    const words = [...a.words, ...c.words];
    assert.equal(unlockedThrough(words, { ...a.progress, ...c.progress }, 'words'), 2);
  });

  test('it never runs past the top of the ladder', () => {
    const words: Word[] = [];
    const progress: Record<string, Progress> = {};
    for (let l = 1; l <= 6; l += 1) {
      const { words: ws, progress: ps } = level(4, l, 4);
      words.push(...ws);
      Object.assign(progress, ps);
    }
    const grammar = words.map((w) => ({ ...w, track: 'grammar' as const }));
    assert.equal(unlockedThrough(grammar, progress, 'grammar'), 6);
  });

  test('the two tracks are independent', () => {
    const a = level(10, 1, 10);
    const grammar = a.words.map((w) => ({ ...w, id: `g-${w.id}`, track: 'grammar' as const }));
    // Words level 1 is fully dominada; grammar has never been touched.
    assert.equal(unlockedThrough([...a.words, ...grammar], a.progress, 'words'), 2);
    assert.equal(unlockedThrough([...a.words, ...grammar], a.progress, 'grammar'), 1);
  });
});
