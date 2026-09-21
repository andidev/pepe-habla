import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { selectDaily } from './select.ts';
import { mulberry32 } from './rng.ts';
import type { Progress, Word } from './types.ts';

const word = (id: string, tier: 1 | 2 | 3 = 1): Word => ({
  id, es: id, en: id, sv: id, pos: 'noun', tier,
});

const prog = (id: string, reps: number, dueOn: string): Progress => ({
  id, reps, ease: 2.5, interval: 1, seen: 5, right: 3, wrong: 2,
  rightEsToEn: 0, rightEnToEs: 0, knownOn: null, lastSeen: '2026-09-01', dueOn,
});

const rng = () => mulberry32(42);

describe('selectDaily', () => {
  test('returns nothing when there are no words at all', () => {
    assert.deepEqual(selectDaily([], {}, '2026-09-19', 10, rng()), []);
  });

  test('introduces new words when nothing is due yet', () => {
    const words = [word('a'), word('b'), word('c')];
    const picked = selectDaily(words, {}, '2026-09-19', 10, rng());
    assert.equal(picked.length, 3, 'never invents words it does not have');
    assert.deepEqual(picked.map((w) => w.id).sort(), ['a', 'b', 'c']);
  });

  test('caps at the requested count', () => {
    const words = Array.from({ length: 50 }, (_, i) => word(`w${i}`));
    assert.equal(selectDaily(words, {}, '2026-09-19', 10, rng()).length, 10);
  });

  test('introduces lower tiers before higher ones', () => {
    const words = [word('hard', 3), word('mid', 2), word('easy', 1)];
    const picked = selectDaily(words, {}, '2026-09-19', 2, rng());
    assert.deepEqual(picked.map((w) => w.id), ['easy', 'mid']);
  });

  test('prefers due words over introducing new ones', () => {
    const words = [word('due1'), word('due2'), word('new1'), word('new2')];
    const progress = {
      due1: prog('due1', 0, '2026-09-19'),
      due2: prog('due2', 1, '2026-09-18'),
    };
    const picked = selectDaily(words, progress, '2026-09-19', 2, rng());
    assert.deepEqual(picked.map((w) => w.id).sort(), ['due1', 'due2']);
  });

  test('weak words come before strong ones — the whole point of the thing', () => {
    const words = [word('strong'), word('weak'), word('middling')];
    const progress = {
      strong: prog('strong', 4, '2026-09-19'),
      weak: prog('weak', 0, '2026-09-19'),
      middling: prog('middling', 2, '2026-09-19'),
    };
    const picked = selectDaily(words, progress, '2026-09-19', 3, rng());
    assert.deepEqual(picked.map((w) => w.id), ['weak', 'middling', 'strong']);
  });

  test('within a streak, the most overdue comes first', () => {
    const words = [word('recent'), word('ancient')];
    const progress = {
      recent: prog('recent', 1, '2026-09-19'),
      ancient: prog('ancient', 1, '2026-08-01'),
    };
    const picked = selectDaily(words, progress, '2026-09-19', 1, rng());
    assert.deepEqual(picked.map((w) => w.id), ['ancient']);
  });

  test('tops up with new words when too few are due', () => {
    const words = [word('due1'), word('new1'), word('new2')];
    const progress = { due1: prog('due1', 0, '2026-09-19') };
    const picked = selectDaily(words, progress, '2026-09-19', 3, rng());
    assert.equal(picked.length, 3);
    assert.equal(picked[0]?.id, 'due1', 'due work still leads');
  });

  test('never returns the same word twice', () => {
    const words = Array.from({ length: 30 }, (_, i) => word(`w${i}`));
    const progress = Object.fromEntries(
      words.slice(0, 5).map((w) => [w.id, prog(w.id, 0, '2026-09-19')]),
    );
    const picked = selectDaily(words, progress, '2026-09-19', 10, rng());
    assert.equal(new Set(picked.map((w) => w.id)).size, picked.length);
  });

  test('skips words that are not due yet', () => {
    const words = [word('later')];
    const progress = { later: prog('later', 2, '2026-09-25') };
    assert.deepEqual(selectDaily(words, progress, '2026-09-19', 10, rng()), []);
  });

  test('ignores progress for words no longer in the seed', () => {
    const progress = { ghost: prog('ghost', 0, '2026-09-19') };
    assert.deepEqual(selectDaily([word('a')], progress, '2026-09-19', 10, rng()).map((w) => w.id), ['a']);
  });

  test('is deterministic for a given seed', () => {
    const words = Array.from({ length: 40 }, (_, i) => word(`w${i}`, 2));
    const a = selectDaily(words, {}, '2026-09-19', 10, mulberry32(7));
    const b = selectDaily(words, {}, '2026-09-19', 10, mulberry32(7));
    assert.deepEqual(a.map((w) => w.id), b.map((w) => w.id));
  });
});
