import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { selectDaily } from './select.ts';
import { mulberry32 } from './rng.ts';
import type { Progress, Word } from './types.ts';
import type { Track } from './levels.ts';

const word = (id: string, level = 1, themes: string[] = ['verbos'], track: Track = 'words'): Word =>
  ({ id, es: id, en: id, sv: id, pos: 'noun', track, level, themes });

const prog = (id: string, reps: number, dueOn: string): Progress => ({
  id, reps, ease: 2.5, interval: 1, seen: 5, right: 3, wrong: 2,
  rightEsToEn: 0, rightEnToEs: 0, knownOn: null, lastSeen: '2026-09-01', dueOn,
});

const rng = () => mulberry32(42);

describe('selectDaily', () => {
  test('returns nothing when there are no words at all', () => {
    assert.deepEqual(selectDaily([], {}, '2026-09-19', 10, rng(), 'words'), []);
  });

  test('introduces new words when nothing is due yet', () => {
    const words = [word('a'), word('b'), word('c')];
    const picked = selectDaily(words, {}, '2026-09-19', 10, rng(), 'words');
    assert.equal(picked.length, 3, 'never invents words it does not have');
    assert.deepEqual(picked.map((w) => w.id).sort(), ['a', 'b', 'c']);
  });

  test('caps at the requested count', () => {
    const words = Array.from({ length: 50 }, (_, i) => word(`w${i}`));
    assert.equal(selectDaily(words, {}, '2026-09-19', 10, rng(), 'words').length, 10);
  });

  test('introduces the lowest open level first', () => {
    // Level 1 is 12 of 17 dominada, so level 2 is open. Both levels hold five
    // unseen cards, and a round of five has to take all five from level 1 --
    // with the level sort gone, a shuffle over ten candidates would have to
    // pick the same five by luck.
    const done = Array.from({ length: 12 }, (_, i) => word(`done${i}`, 1));
    const lower = Array.from({ length: 5 }, (_, i) => word(`low${i}`, 1));
    const upper = Array.from({ length: 5 }, (_, i) => word(`up${i}`, 2));
    const progress: Record<string, Progress> = {};
    done.forEach((w) => { progress[w.id] = prog(w.id, 3, '2026-12-01'); });
    const picked = selectDaily(
      [...done, ...lower, ...upper], progress, '2026-09-19', 5, rng(), 'words',
    );
    assert.deepEqual(picked.map((w) => w.level), [1, 1, 1, 1, 1]);
  });

  test('prefers due words over introducing new ones', () => {
    const words = [word('due1'), word('due2'), word('new1'), word('new2')];
    const progress = {
      due1: prog('due1', 0, '2026-09-19'),
      due2: prog('due2', 1, '2026-09-18'),
    };
    const picked = selectDaily(words, progress, '2026-09-19', 2, rng(), 'words');
    assert.deepEqual(picked.map((w) => w.id).sort(), ['due1', 'due2']);
  });

  test('weak words come before strong ones — the whole point of the thing', () => {
    const words = [word('strong'), word('weak'), word('middling')];
    const progress = {
      strong: prog('strong', 4, '2026-09-19'),
      weak: prog('weak', 0, '2026-09-19'),
      middling: prog('middling', 2, '2026-09-19'),
    };
    const picked = selectDaily(words, progress, '2026-09-19', 3, rng(), 'words');
    assert.deepEqual(picked.map((w) => w.id), ['weak', 'middling', 'strong']);
  });

  test('within a streak, the most overdue comes first', () => {
    const words = [word('recent'), word('ancient')];
    const progress = {
      recent: prog('recent', 1, '2026-09-19'),
      ancient: prog('ancient', 1, '2026-08-01'),
    };
    const picked = selectDaily(words, progress, '2026-09-19', 1, rng(), 'words');
    assert.deepEqual(picked.map((w) => w.id), ['ancient']);
  });

  test('tops up with new words when too few are due', () => {
    const words = [word('due1'), word('new1'), word('new2')];
    const progress = { due1: prog('due1', 0, '2026-09-19') };
    const picked = selectDaily(words, progress, '2026-09-19', 3, rng(), 'words');
    assert.equal(picked.length, 3);
    assert.equal(picked[0]?.id, 'due1', 'due work still leads');
  });

  test('never returns the same word twice', () => {
    const words = Array.from({ length: 30 }, (_, i) => word(`w${i}`));
    const progress = Object.fromEntries(
      words.slice(0, 5).map((w) => [w.id, prog(w.id, 0, '2026-09-19')]),
    );
    const picked = selectDaily(words, progress, '2026-09-19', 10, rng(), 'words');
    assert.equal(new Set(picked.map((w) => w.id)).size, picked.length);
  });

  test('skips words that are not due yet', () => {
    const words = [word('later')];
    const progress = { later: prog('later', 2, '2026-09-25') };
    assert.deepEqual(selectDaily(words, progress, '2026-09-19', 10, rng(), 'words'), []);
  });

  test('ignores progress for words no longer in the seed', () => {
    const progress = { ghost: prog('ghost', 0, '2026-09-19') };
    assert.deepEqual(selectDaily([word('a')], progress, '2026-09-19', 10, rng(), 'words').map((w) => w.id), ['a']);
  });

  test('is deterministic for a given seed', () => {
    const words = Array.from({ length: 40 }, (_, i) => word(`w${i}`, 2));
    const a = selectDaily(words, {}, '2026-09-19', 10, mulberry32(7), 'words');
    const b = selectDaily(words, {}, '2026-09-19', 10, mulberry32(7), 'words');
    assert.deepEqual(a.map((w) => w.id), b.map((w) => w.id));
  });
});

describe('selectDaily and tracks', () => {
  test('a round never mixes the two tracks', () => {
    const words = [word('w1'), word('g1', 1, ['presente'], 'grammar')];
    assert.deepEqual(selectDaily(words, {}, '2026-09-19', 10, rng(), 'words').map((w) => w.id), ['w1']);
    assert.deepEqual(selectDaily(words, {}, '2026-09-19', 10, rng(), 'grammar').map((w) => w.id), ['g1']);
  });

  test('due work from the other track is left alone', () => {
    const words = [word('w1'), word('g1', 1, ['presente'], 'grammar')];
    const progress = { g1: prog('g1', 0, '2026-09-19') };
    const picked = selectDaily(words, progress, '2026-09-19', 10, rng(), 'words');
    assert.deepEqual(picked.map((w) => w.id), ['w1']);
  });

  test('a locked level is not introduced', () => {
    // Level 1 has 10 cards, none dominada, so level 2 is shut.
    const l1 = Array.from({ length: 10 }, (_, i) => word(`a${i}`, 1));
    const l2 = [word('b0', 2)];
    const picked = selectDaily([...l1, ...l2], {}, '2026-09-19', 20, rng(), 'words');
    assert.equal(picked.some((w) => w.level === 2), false);
    assert.equal(picked.length, 10);
  });

  test('an unlocked level is introduced once the one below is 70% dominada', () => {
    const l1 = Array.from({ length: 10 }, (_, i) => word(`a${i}`, 1));
    const l2 = [word('b0', 2)];
    const progress: Record<string, Progress> = {};
    // Seven of ten dominada, and all of them answered, so none is "new".
    l1.forEach((w, i) => { progress[w.id] = prog(w.id, i < 7 ? 3 : 0, '2026-12-01'); });
    const picked = selectDaily([...l1, ...l2], progress, '2026-09-19', 20, rng(), 'words');
    assert.deepEqual(picked.map((w) => w.id), ['b0']);
  });

  test('a due word in a locked level still comes back', () => {
    // Locking a level must never strand a card the learner has already met.
    const stranded = word('b0', 2);
    const progress = { b0: prog('b0', 1, '2026-09-19') };
    const picked = selectDaily([stranded], progress, '2026-09-19', 10, rng(), 'words');
    assert.deepEqual(picked.map((w) => w.id), ['b0']);
  });
});

describe('theme-clustered introduction', () => {
  test('the new cards in a round all come from one theme', () => {
    const words = [
      word('c1', 1, ['comida']), word('c2', 1, ['comida']), word('c3', 1, ['comida']),
      word('r1', 1, ['ropa']), word('r2', 1, ['ropa']), word('r3', 1, ['ropa']),
    ];
    const picked = selectDaily(words, {}, '2026-09-19', 3, rng(), 'words');
    const themes = new Set(picked.flatMap((w) => w.themes));
    assert.equal(themes.size, 1, `expected one theme, got ${[...themes].join(', ')}`);
  });

  test('it widens rather than short-change the round', () => {
    // One theme cannot fill the round, so the rest come from elsewhere: a
    // half-empty round is worse than a mixed one.
    const words = [
      word('c1', 1, ['comida']), word('c2', 1, ['comida']),
      word('r1', 1, ['ropa']), word('r2', 1, ['ropa']), word('r3', 1, ['ropa']),
    ];
    assert.equal(selectDaily(words, {}, '2026-09-19', 5, rng(), 'words').length, 5);
  });

  test('clustering never displaces due work', () => {
    const due = word('due1', 1, ['comida']);
    const fresh = [word('r1', 1, ['ropa']), word('r2', 1, ['ropa'])];
    const progress = { due1: prog('due1', 0, '2026-09-19') };
    const picked = selectDaily([due, ...fresh], progress, '2026-09-19', 3, rng(), 'words');
    assert.equal(picked[0]?.id, 'due1');
    assert.equal(picked.length, 3);
  });

  test('a lower level is exhausted before a higher one is touched', () => {
    // Level 1 is 12 of 17 dominada, so level 2 is open. Level 1's five
    // remaining unseen cards split across two themes -- one 'comida', four
    // 'ropa' -- and level 2 holds three unseen cards spanning those same two
    // themes. Whichever of the two themes `cluster` happens to pick from
    // level 1's first card, level 2 has a card in that same theme: a `cluster`
    // that lets a theme match reach across levels will prefer that level-2
    // card over the *other* level-1 theme's card, even though level 1 is not
    // exhausted. The round must stay entirely at level 1 regardless.
    const done = Array.from({ length: 12 }, (_, i) => word(`done${i}`, 1));
    const l1a = [word('x1', 1, ['comida'])];
    const l1b = Array.from({ length: 4 }, (_, i) => word(`y${i}`, 1, ['ropa']));
    const l2 = [
      word('x2a', 2, ['comida']), word('x2b', 2, ['comida']),
      word('y2a', 2, ['ropa']),
    ];
    const progress: Record<string, Progress> = {};
    done.forEach((w) => { progress[w.id] = prog(w.id, 3, '2026-12-01'); });
    const picked = selectDaily(
      [...done, ...l1a, ...l1b, ...l2], progress, '2026-09-19', 5, rng(), 'words',
    );
    assert.deepEqual(picked.map((w) => w.level), [1, 1, 1, 1, 1]);
  });
});
