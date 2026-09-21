# Pepe Habla — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the learner somewhere to look at what they know — an honest stats screen and a browsable word list — plus the settings the app has been missing.

**Architecture:** Statistics are derived in `packages/core` as pure functions over `Word[]` and `Progress`, so the screens stay thin renderers and the arithmetic is unit-tested without a simulator. Two new screens replace the placeholder tabs. One new persisted field per word makes the headline number honest.

**Tech Stack:** Unchanged — TypeScript with no build step, `node:test`, Expo SDK 57, expo-router, Reanimated 4, AsyncStorage.

**Spec:** `docs/superpowers/specs/2026-09-19-pepe-habla-design.md`

**Phase 1 plan (context for what exists):** `docs/superpowers/plans/2026-09-19-pepe-habla-phases-0-1.md`

## Global Constraints

- **`packages/core` may not import from `node:`, `react`, `react-native`, or any filesystem API.** `noNodeImports.test.ts` enforces it.
- **Randomness is injected.** Core takes an `Rng` parameter; never `Math.random()`.
- **Node 24 runs TypeScript directly.** No build step. Relative imports inside core carry explicit `.ts` extensions.
- **TDD for every core addition.** Write the test, run it, watch it fail, implement, watch it pass.
- **Palette** only via `apps/app/theme.ts`, never a literal hex in a component: ground `#FBF6EC`, surface `#FFFFFF`, ink `#1C1714`, muted `#6B6259`, chile `#D1453B`, cactus `#2E7D5B`, marigold `#E9A020`.
- **Every card and button: 2px ink border, hard offset shadow, never blurred.** Use `PressableCard`.
- **Interface copy in Spanish.**
- **Touch targets ≥ 44px.**
- **Platform branching only in `components/Screen.tsx` and `feedback.ts`.**
- **Stage files by name when committing. Never `git add -A`** — broad adds let unrelated work into the phase 1 branch twice.
- **Consult https://docs.expo.dev/versions/v57.0.0/** for any Expo API, per `apps/app/AGENTS.md`.

## What phase 2 is not

Levels, themes, the SM-2 scheduler and the vocabulary expansion past 384 words are **phase 3**. Where a screen would naturally show a level, it shows progress through the whole vocabulary instead, and phase 3 replaces that card. Do not build level gating here.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/core/src/stats.ts` | derive every number the stats screen shows, purely |
| `packages/core/src/stats.test.ts` | its tests |
| `apps/app/app/(tabs)/stats.tsx` | replaces the placeholder |
| `apps/app/app/(tabs)/words.tsx` | replaces the placeholder |
| `apps/app/app/settings.tsx` | mute toggle and the app's own facts |
| `apps/app/components/StatTile.tsx` | the repeated number-and-label tile |
| `apps/app/components/Meter.tsx` | the repeated bordered progress bar |

Modified: `packages/core/src/types.ts` (two counters on `Progress`), `packages/core/src/leitner.ts` (maintain them), `apps/app/storage/progressStore.ts` (migrate), `apps/app/components/PressableCard.tsx` (accessibility), `apps/app/components/Pepe.tsx` (reduced motion), `apps/app/app/(tabs)/_layout.tsx` (settings route).

---

### Task 1: Make the shared components accessible, and respect reduced motion

Do this first. Two more screens are about to copy these components, and both gaps get harder to fix once they are copied.

**Files:**
- Modify: `apps/app/components/PressableCard.tsx`, `apps/app/components/Pepe.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `<PressableCard>` gains optional `label?: string` and `role?: 'button' | 'link'`. Tasks 4, 5 and 6 pass `label` on every interactive card.

- [ ] **Step 1: Give `PressableCard` a role and a label**

The whole-branch review found that every option button, `¡Vamos!`, `Siguiente` and `¿Otra ronda?` is focusable but never announced, because `PressableCard` renders a bare `Pressable`. In `apps/app/components/PressableCard.tsx`, add to the `Props` interface:

```tsx
  /** Announced by a screen reader. Required in practice for anything tappable. */
  label?: string;
  role?: 'button' | 'link';
```

and on the `Pressable`, alongside the existing props:

```tsx
      accessibilityRole={onPress ? (role ?? 'button') : undefined}
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled || !onPress) }}
```

A card with no `onPress` is a container, not a control, so it deliberately gets no role.

- [ ] **Step 2: Honour `prefers-reduced-motion` in `Pepe`**

The spec asks for it; phase 1 shipped without it. In `apps/app/components/Pepe.tsx`, import `AccessibilityInfo` from `react-native`, and add above the existing effect:

```tsx
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setReduceMotion(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { alive = false; sub.remove(); };
  }, []);
```

and make the motion effect bail after resetting to rest:

```tsx
    lift.value = 0; squashX.value = 1; squashY.value = 1; tilt.value = 0;
    if (reduceMotion) return;      // still shows the right pose, just still
```

Add `reduceMotion` to that effect's dependency array. Pepe keeps changing pose — the information is in the sprite, not the movement — he simply stops bouncing.

- [ ] **Step 3: Verify both**

```bash
npm test && npm run typecheck
```
Expect the existing suite passing and typecheck clean.

Then on a simulator: turn on Settings → Accessibility → Motion → Reduce Motion, open the app, and confirm Pepe is still and still correct. Turn it off and confirm he breathes again without a reload — that is what the event listener is for. Report both observations.

- [ ] **Step 4: Commit**

```bash
git add apps/app/components/PressableCard.tsx apps/app/components/Pepe.tsx
git commit -m "Announce buttons to screen readers, and hold still when asked

Every tappable card was focusable but unannounced, and Pepe bounced regardless
of the system's reduce-motion setting. Both were about to be copied into two
more screens."
```

---

### Task 2: An honest "words known"

The spec defines a known word as one answered correctly **in both directions**, at least three times. Phase 1 shipped `box >= 4` because `Progress` had no per-direction counters. `AnswerRecord` already carries `direction`, so the honest definition is reachable now — and this is the phase that puts the number on screen.

**Files:**
- Modify: `packages/core/src/types.ts`, `packages/core/src/leitner.ts`, `packages/core/src/leitner.test.ts`, `apps/app/storage/progressStore.ts`

**Interfaces:**
- Consumes: `Direction` from `./types.ts`.
- Produces: `Progress` gains `rightEsToEn: number`, `rightEnToEs: number` and `knownOn: string | null`; `applyAnswer(p, correct, today, direction?)` takes an optional fourth argument; `isKnown(p)` and `KNOWN_THRESHOLD` are exported from `leitner.ts`. Task 3 re-exports `isKnown` through `stats.ts` and counts `knownOn`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/leitner.test.ts`:

```typescript
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

  test('a listening answer counts as recognition', () => {
    const next = applyAnswer(at(), true, '2026-09-20', 'listen->en');
    assert.equal(next.rightEsToEn, 1);
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
```

The `at()` helper at the top of that file builds a `Progress`; extend its defaults with `rightEsToEn: 0, rightEnToEs: 0`.

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test packages/core/src/leitner.test.ts`
Expected: FAIL — the counters do not exist, so each assertion reads `undefined`.

- [ ] **Step 3: Add the fields**

In `packages/core/src/types.ts`, inside `interface Progress`, after `wrong`:

```typescript
  /** Correct answers where the learner read Spanish and chose English. */
  rightEsToEn: number;
  /** Correct answers where the learner produced the Spanish. */
  rightEnToEs: number;
  /** ISO date this word first counted as known, or null if it never has. */
  knownOn: string | null;
```

`knownOn` is what makes "learned this week" mean what it says. Counting known
words *last answered* in the past week would drift toward the total as the
collection grows and old words keep coming up for review — the screen would
claim you learned a hundred words in a week when you learned none.

- [ ] **Step 4: Maintain them**

In `packages/core/src/leitner.ts`, import the `Direction` type and widen `applyAnswer`.

`isKnown` lives here rather than in `stats.ts` because `applyAnswer` has to ask
the question to stamp `knownOn`, and a module that derives statistics must not
be imported by the module that records answers.

```typescript
/** Which counter a direction advances. Listening is recognition; pictures are production. */
const answersInEnglish = (d: Direction): boolean => d === 'es->en' || d === 'listen->en';

/** Correct answers needed in each direction before a word counts as known. */
export const KNOWN_THRESHOLD = 3;

/**
 * Known means answered correctly in *both* directions, three times each.
 *
 * Recognising `la tienda` is much easier than producing it, and with four
 * options a guess lands a quarter of the time. The number a learner judges
 * themselves by has to be harder to earn than the scheduler's.
 */
export function isKnown(p: Progress): boolean {
  return p.rightEsToEn >= KNOWN_THRESHOLD && p.rightEnToEs >= KNOWN_THRESHOLD;
}

export function applyAnswer(
  p: Progress,
  correct: boolean,
  today: string,
  direction?: Direction,
): Progress {
  const box: Box = correct ? promote(p.box) : 1;
  const scored = correct && direction !== undefined;
  const next: Progress = {
    ...p,
    box,
    seen: p.seen + 1,
    right: p.right + (correct ? 1 : 0),
    wrong: p.wrong + (correct ? 0 : 1),
    rightEsToEn: p.rightEsToEn + (scored && answersInEnglish(direction) ? 1 : 0),
    rightEnToEs: p.rightEnToEs + (scored && !answersInEnglish(direction) ? 1 : 0),
    lastSeen: today,
    dueOn: addDays(today, INTERVALS[box]),
  };
  // Stamp the day it crossed, once. A word that later lapses keeps its date —
  // it was learned then, and "learned this week" is a record of what happened,
  // not a claim about what you still remember.
  return next.knownOn === null && isKnown(next)
    ? { ...next, knownOn: today }
    : next;
}
```

and in `freshProgress`, add `rightEsToEn: 0, rightEnToEs: 0, knownOn: null`.

- [ ] **Step 5: Run and watch them pass**

Run: `node --test packages/core/src/leitner.test.ts`
Expected: PASS, including the seven new tests.

- [ ] **Step 6: Pass the direction through, and migrate old records**

In `apps/app/storage/progressStore.ts`, `recordAnswers` must forward the direction it already has:

```typescript
    progress[record.wordId] = applyAnswer(before, record.correct, today, record.direction);
```

Stored progress written before this change has no counters. Migrate on load, rather than letting `undefined + 1` produce `NaN` — a `NaN` counter would silently make a word un-knowable forever:

```typescript
/** Progress saved before direction counters existed gets them, at zero. */
function migrate(db: VocabDb): VocabDb {
  const progress: Record<string, Progress> = {};
  for (const [id, p] of Object.entries(db.progress)) {
    progress[id] = {
      ...p,
      rightEsToEn: p.rightEsToEn ?? 0,
      rightEnToEs: p.rightEnToEs ?? 0,
      // Deliberately null for words already known before this migration: we do
      // not know when they were learned, and guessing would inflate the
      // "this week" figure on the very first launch after upgrading.
      knownOn: p.knownOn ?? null,
    };
  }
  return { ...db, progress };
}
```

Call it on both return paths of `loadProgress` — the stored blob and the bundled seed.

- [ ] **Step 7: Verify the migration on a device**

Run the app on a simulator with progress already stored from phase 1. Confirm it opens without error and the home screen numbers are unchanged. Then play one round and confirm, via a temporary log of one word's `Progress`, that `rightEsToEn` or `rightEnToEs` has incremented and neither is `NaN`. Remove the log.

- [ ] **Step 8: Commit**

```bash
npm test && npm run typecheck
git add packages/core/src/types.ts packages/core/src/leitner.ts packages/core/src/leitner.test.ts apps/app/storage/progressStore.ts
git commit -m "Count correct answers per direction

The spec defines a known word as one answered correctly in both directions,
which phase 1 could not express. AnswerRecord already carried the direction, so
the honest definition costs two integers. Progress saved before this migrates
to zero rather than to NaN."
```

---

### Task 3: Derive the statistics in core

Every number the stats screen shows, computed purely so the arithmetic is tested without a simulator.

**Files:**
- Create: `packages/core/src/stats.ts`, `packages/core/src/stats.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Word`, `Progress`, `daysBetween`, `isDue`.
- Produces: `summarise(words, progress, today): Summary`, `leeches(words, progress, limit?): Leech[]`, and the types `Summary` and `Leech`, plus `isKnown` and `KNOWN_THRESHOLD` re-exported from `leitner.ts` so screens have one import. Tasks 4 and 5 render these.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/stats.test.ts`:

```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { summarise, leeches } from './stats.ts';
import { isKnown } from './leitner.ts';
import type { Progress, Word } from './types.ts';

const word = (id: string): Word => ({ id, es: `es-${id}`, en: `en-${id}`, pos: 'noun', tier: 1 });

const prog = (over: Partial<Progress> & { id: string }): Progress => ({
  box: 1, seen: 0, right: 0, wrong: 0,
  rightEsToEn: 0, rightEnToEs: 0, knownOn: null,
  lastSeen: null, dueOn: '2026-09-20',
  ...over,
});

describe('isKnown (re-exported from leitner)', () => {
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
    assert.equal(isKnown(prog({ id: 'a', box: 5, rightEsToEn: 3, rightEnToEs: 0 })), false);
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
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test packages/core/src/stats.test.ts`
Expected: FAIL — `Cannot find module './stats.ts'`.

- [ ] **Step 3: Write `packages/core/src/stats.ts`**

```typescript
import type { Progress, Word } from './types.ts';
import { daysBetween } from './dates.ts';
import { isDue, isKnown } from './leitner.ts';

// `isKnown` lives in leitner.ts because applyAnswer has to ask the question to
// stamp `knownOn`, and the module that records answers must not import the one
// that derives statistics. Re-exported here so screens have one import.
export { isKnown, KNOWN_THRESHOLD } from './leitner.ts';

/** Days back that "this week" reaches. */
const WEEK = 7;

export interface Summary {
  /** Words available to learn at all. */
  total: number;
  /** Words answered at least once. */
  practised: number;
  known: number;
  learnedThisWeek: number;
  due: number;
  /** Whole percent over every answer given, or null before the first. */
  accuracy: number | null;
}

export interface Leech {
  word: Word;
  wrong: number;
  seen: number;
  /** Whole percent. */
  accuracy: number;
}

export function summarise(
  words: readonly Word[],
  progress: Readonly<Record<string, Progress>>,
  today: string,
): Summary {
  let practised = 0;
  let known = 0;
  let learnedThisWeek = 0;
  let due = 0;
  let answers = 0;
  let correct = 0;

  for (const w of words) {
    const p = progress[w.id];
    if (p === undefined) continue;
    practised += 1;
    answers += p.seen;
    correct += p.right;
    if (isDue(p, today)) due += 1;
    if (isKnown(p)) known += 1;
    // Counted on the day it was learned, independently of whether it still is:
    // measuring "known words seen recently" would creep toward the total as
    // old words come up for review.
    if (p.knownOn !== null && daysBetween(p.knownOn, today) < WEEK) {
      learnedThisWeek += 1;
    }
  }

  return {
    total: words.length,
    practised,
    known,
    learnedThisWeek,
    due,
    accuracy: answers === 0 ? null : Math.round((correct / answers) * 100),
  };
}

/**
 * The words costing the most, worst first.
 *
 * Most apps hide this. It is the most useful list on the screen: a handful of
 * words usually account for most of the misses, and naming them is what lets
 * the learner do something about it.
 */
export function leeches(
  words: readonly Word[],
  progress: Readonly<Record<string, Progress>>,
  limit = 5,
): Leech[] {
  const out: Leech[] = [];
  for (const w of words) {
    const p = progress[w.id];
    if (p === undefined || p.wrong === 0) continue;
    out.push({
      word: w,
      wrong: p.wrong,
      seen: p.seen,
      accuracy: p.seen === 0 ? 0 : Math.round((p.right / p.seen) * 100),
    });
  }
  return out
    .sort((a, b) => b.wrong - a.wrong || a.accuracy - b.accuracy)
    .slice(0, limit);
}
```

- [ ] **Step 4: Run and watch them pass**

Run: `node --test packages/core/src/stats.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Export and verify the whole suite**

Add to `packages/core/src/index.ts`:

```typescript
export * from './stats.ts';
```

Run: `npm test && npm run typecheck` — all pass, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/stats.ts packages/core/src/stats.test.ts packages/core/src/index.ts
git commit -m "Derive the statistics in core

Known means correct in both directions three times each, not a high Leitner
box: with four options a guess lands a quarter of the time, so the number the
learner judges themselves by has to be harder to earn than the scheduler's."
```

---

### Task 4: The stats screen

**Files:**
- Create: `apps/app/components/StatTile.tsx`, `apps/app/components/Meter.tsx`
- Replace: `apps/app/app/(tabs)/stats.tsx`

**Interfaces:**
- Consumes: `summarise`, `leeches`, `loadProgress`, `loadStreak`, `WORDS`, `PEPE_PHOTO`, `Pepe`, `PressableCard`, `Screen`.
- Produces: `<StatTile value label tint?>` and `<Meter value max tint?>`, both reused by Task 5.

- [ ] **Step 1: Write `apps/app/components/StatTile.tsx`**

```tsx
import { Text, View } from 'react-native';
import { colour, font, radius, outline } from '../theme';

/** One number with its caption. The repeated unit of the stats screen. */
export function StatTile({ value, label, tint }: { value: string; label: string; tint?: string }) {
  return (
    <View style={{
      flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8,
      backgroundColor: colour.surface, borderRadius: radius.button, ...outline,
    }}>
      <Text style={{ fontFamily: font.display, fontSize: 26, color: tint ?? colour.ink }}>
        {value}
      </Text>
      <Text style={{ fontFamily: font.bodyHeavy, fontSize: 11, color: colour.muted, letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Write `apps/app/components/Meter.tsx`**

```tsx
import { View } from 'react-native';
import { colour, radius, outline } from '../theme';

/**
 * A bordered progress bar. Clamped, because a fraction over one would render
 * a fill wider than its own outline.
 */
export function Meter({ value, max, tint = colour.cactus, height = 15 }: {
  value: number; max: number; tint?: string; height?: number;
}) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max, now: value }}
      style={{
        height, backgroundColor: colour.ground, borderRadius: radius.pill,
        overflow: 'hidden', ...outline,
      }}
    >
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: tint }} />
    </View>
  );
}
```

- [ ] **Step 3: Replace `apps/app/app/(tabs)/stats.tsx`**

```tsx
import { useCallback, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import {
  leeches, summarise, todayISO,
  type Leech, type Streak, type Summary,
} from '@pepe/core';
import { Meter } from '../../components/Meter';
import { Pepe } from '../../components/Pepe';
import { Screen } from '../../components/Screen';
import { StatTile } from '../../components/StatTile';
import { loadProgress } from '../../storage/progressStore';
import { loadStreak } from '../../storage/streakStore';
import { PEPE_PHOTO, WORDS } from '../../storage/vocabulary';
import { colour, font, outline, radius, space } from '../../theme';

function Card({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <View style={{
      backgroundColor: colour.surface, borderRadius: radius.card,
      padding: space.lg, ...outline,
    }}>
      <Text style={{ fontFamily: font.display, fontSize: 17, color: colour.ink }}>{title}</Text>
      {subtitle !== undefined && (
        <Text style={{ fontFamily: font.body, fontSize: 12, color: colour.muted, marginTop: 2 }}>
          {subtitle}
        </Text>
      )}
      <View style={{ marginTop: space.md }}>{children}</View>
    </View>
  );
}

export default function Stats() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [worst, setWorst] = useState<Leech[]>([]);
  const [streak, setStreak] = useState<Streak>({ days: 0, lastDate: null });

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      const [db, s] = await Promise.all([loadProgress(), loadStreak()]);
      if (!alive) return;
      const today = todayISO();
      setSummary(summarise(WORDS, db.progress, today));
      setWorst(leeches(WORDS, db.progress, 5));
      setStreak(s);
    })();
    return () => { alive = false; };
  }, []));

  if (summary === null) return <Screen><View style={{ flex: 1 }} /></Screen>;

  const nothingYet = summary.practised === 0;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: space.xl, gap: space.md, paddingBottom: space.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontFamily: font.displayHeavy, fontSize: 32, color: colour.ink }}>
          Progreso
        </Text>

        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: space.md,
          backgroundColor: colour.marigold, borderRadius: 18, padding: space.md, ...outline,
        }}>
          <Svg width={34} height={34} viewBox="0 0 24 24">
            <Path
              d="M12 2c1 4-2 5-2 8a4 4 0 0 0 8 0c0-1-.4-2-1-3 2 2 3 4.5 3 7a8 8 0 0 1-16 0c0-4.5 3-8 8-12z"
              fill={colour.ground} stroke={colour.ink} strokeWidth={1.7} strokeLinejoin="round"
            />
          </Svg>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.displayHeavy, fontSize: 27, color: colour.ink }}>
              {streak.days} {streak.days === 1 ? 'día' : 'días'}
            </Text>
            <Text style={{ fontFamily: font.bodyHeavy, fontSize: 13, color: colour.ink }}>
              {streak.days === 0 ? 'Empieza hoy' : 'seguidos'}
            </Text>
          </View>
          <Pepe pose={streak.days > 0 ? 'happy' : 'sleeping'} motion="breathe" size={62} />
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatTile value={String(summary.known)} label="CONOCIDAS" />
          <StatTile value={`+${summary.learnedThisWeek}`} label="ESTA SEMANA" tint={colour.cactus} />
          <StatTile
            value={summary.accuracy === null ? '—' : `${summary.accuracy}%`}
            label="PRECISIÓN"
          />
        </View>

        <Card
          title="Tu vocabulario"
          subtitle={`${summary.practised} de ${summary.total} palabras practicadas`}
        >
          <Meter value={summary.known} max={summary.total} />
          <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, marginTop: space.sm }}>
            {summary.known} conocidas · {summary.due} por repasar hoy
          </Text>
        </Card>

        {worst.length > 0 && (
          <Card title="Se te atragantan" subtitle="Las que más fallas. Aquí está tu cuello de botella.">
            {worst.map((l) => (
              <View key={l.word.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                <View style={{ width: 118 }}>
                  <Text style={{ fontFamily: font.bodyHeavy, fontSize: 15, color: colour.ink }}>
                    {l.word.es}
                  </Text>
                  <Text style={{ fontFamily: font.body, fontSize: 12, color: colour.muted }}>
                    {l.word.en}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Meter value={l.accuracy} max={100} tint={colour.chile} height={11} />
                </View>
                <Text style={{
                  width: 54, textAlign: 'right', fontFamily: font.bodyHeavy,
                  fontSize: 12, color: colour.muted,
                }}>
                  {l.seen - l.wrong}/{l.seen}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {nothingYet && (
          <Card title="Todavía nada que mostrar">
            <Text style={{ fontFamily: font.body, fontSize: 14, color: colour.muted }}>
              Juega una ronda y aquí verás lo que sabes.
            </Text>
          </Card>
        )}

        <View style={{
          borderRadius: radius.card, overflow: 'hidden', marginTop: space.sm, ...outline,
        }}>
          <Image
            source={PEPE_PHOTO}
            accessibilityLabel="Fotografía del Pepe real, echado en el suelo"
            style={{ width: '100%', height: undefined, aspectRatio: 4 / 3 }}
            resizeMode="cover"
          />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colour.ink, padding: space.md }}>
            <Text style={{ fontFamily: font.display, fontSize: 15, color: colour.ground }}>
              El Pepe de verdad
            </Text>
            <Text style={{ fontFamily: font.body, fontSize: 12, color: colour.ground, opacity: 0.78 }}>
              Perro callejero, Ciudad de México
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
```

- [ ] **Step 4: Verify on a simulator**

Play a round first so there is data. Then open Progreso and confirm: the streak card, three tiles, the vocabulary meter, the leech list with the worst word first, and the photo with its caption plate. Scroll to the bottom — the page must scroll, not clip. Check `CONOCIDAS` against the honest rule: a word needs three correct answers *each way*, so early on this is legitimately 0 while `PRECISIÓN` is high. Say what you saw for each.

Screenshot to `.superpowers/.../screenshots/` named beginning `phase2-stats-`.

- [ ] **Step 5: Commit**

```bash
npm test && npm run typecheck
git add apps/app/components/StatTile.tsx apps/app/components/Meter.tsx "apps/app/app/(tabs)/stats.tsx"
git commit -m "Add the stats screen

Leads with the streak and what you know, and names the words costing you most.
Most apps hide that list; it is the one that tells you what to actually do."
```

---

### Task 5: The word list

**Files:**
- Replace: `apps/app/app/(tabs)/words.tsx`

**Interfaces:**
- Consumes: `isKnown`, `isDue`, `todayISO`, `WORDS`, `loadProgress`, `speak`, `canSpeak`, `Meter`, `Screen`, `PressableCard`.
- Produces: nothing other tasks consume.

**A note on filters.** The approved mockup showed theme chips — `comida`, `casa`, `cuerpo`. **Themes do not exist until phase 3**, so filtering by them here would mean inventing data. Filter by what the app actually knows instead: everything, due today, known, and the words you keep missing. Phase 3 adds themes alongside these.

- [ ] **Step 1: Replace `apps/app/app/(tabs)/words.tsx`**

```tsx
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { isDue, isKnown, todayISO, type Progress, type Word } from '@pepe/core';
import { Meter } from '../../components/Meter';
import { Screen } from '../../components/Screen';
import { canSpeak, cue, speak } from '../../feedback';
import { loadProgress } from '../../storage/progressStore';
import { WORDS } from '../../storage/vocabulary';
import { colour, font, outline, radius, space } from '../../theme';

type Filter = 'todas' | 'repasar' | 'conocidas' | 'fallas';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'repasar', label: 'Por repasar' },
  { key: 'conocidas', label: 'Conocidas' },
  { key: 'fallas', label: 'Se te atragantan' },
];

interface Row { word: Word; p: Progress }

export default function Words() {
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [filter, setFilter] = useState<Filter>('todas');

  useFocusEffect(useCallback(() => {
    let alive = true;
    void loadProgress().then((db) => { if (alive) setProgress(db.progress); });
    return () => { alive = false; };
  }, []));

  const rows = useMemo<Row[]>(() => {
    const today = todayISO();
    // Only words actually practised: a list of 384 untouched entries tells the
    // learner nothing they did not already know.
    const all: Row[] = [];
    for (const word of WORDS) {
      const p = progress[word.id];
      if (p !== undefined) all.push({ word, p });
    }
    const keep = (r: Row) => {
      if (filter === 'repasar') return isDue(r.p, today);
      if (filter === 'conocidas') return isKnown(r.p);
      if (filter === 'fallas') return r.p.wrong > 0 && !isKnown(r.p);
      return true;
    };
    return all
      .filter(keep)
      .sort((a, b) => b.p.wrong - a.p.wrong || a.word.es.localeCompare(b.word.es, 'es'));
  }, [progress, filter]);

  const practised = Object.keys(progress).length;

  return (
    <Screen>
      <View style={{ paddingHorizontal: space.xl, paddingTop: space.lg }}>
        <Text style={{ fontFamily: font.displayHeavy, fontSize: 32, color: colour.ink }}>
          Palabras
        </Text>
        <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted }}>
          {practised} practicadas de {WORDS.length}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.md }}>
          {FILTERS.map(({ key, label }) => {
            const on = key === filter;
            return (
              <Pressable
                key={key}
                onPress={() => { cue('tap'); setFilter(key); }}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: on }}
                style={{
                  minHeight: 44, justifyContent: 'center', paddingHorizontal: 15,
                  borderRadius: radius.pill, ...outline,
                  backgroundColor: on ? colour.ink : colour.surface,
                }}
              >
                <Text style={{
                  fontFamily: font.bodyHeavy, fontSize: 14,
                  color: on ? colour.ground : colour.ink,
                }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.word.id}
        contentContainerStyle={{ padding: space.xl, paddingTop: space.md, gap: 9 }}
        ListEmptyComponent={
          <Text style={{ fontFamily: font.body, fontSize: 14, color: colour.muted }}>
            {practised === 0
              ? 'Todavía no has practicado ninguna palabra.'
              : 'Nada aquí por ahora.'}
          </Text>
        }
        renderItem={({ item }) => {
          const accuracy = item.p.seen === 0 ? 0 : Math.round((item.p.right / item.p.seen) * 100);
          const tint = accuracy >= 80 ? colour.cactus : accuracy >= 50 ? colour.marigold : colour.chile;
          // No recordings ship, so this is a property of the device, not the word.
          const speakable = canSpeak();
          return (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: colour.surface, borderRadius: radius.button,
              paddingVertical: 11, paddingHorizontal: 14, ...outline,
            }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text style={{ fontFamily: font.display, fontSize: 17, color: colour.ink }}>
                    {item.word.es}
                  </Text>
                  <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, flexShrink: 1 }}>
                    {item.word.en}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <View style={{ width: 96 }}>
                    <Meter value={accuracy} max={100} tint={tint} height={9} />
                  </View>
                  <Text style={{ fontFamily: font.bodyHeavy, fontSize: 11, color: colour.muted }}>
                    {item.p.right}/{item.p.seen} · {item.p.dueOn}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => speak(item.word)}
                disabled={!speakable}
                accessibilityRole="button"
                accessibilityLabel={`Escuchar ${item.word.es}`}
                style={{
                  width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: colour.ground, borderRadius: radius.pill,
                  opacity: speakable ? 1 : 0.35, ...outline,
                }}
              >
                <Svg width={19} height={19} viewBox="0 0 24 24">
                  <Path d="M4 9v6h4l5 4V5L8 9z" fill={colour.ink} />
                  <Path d="M16.5 8.5a5 5 0 0 1 0 7" stroke={colour.ink} strokeWidth={2} strokeLinecap="round" fill="none" />
                </Svg>
              </Pressable>
            </View>
          );
        }}
      />
    </Screen>
  );
}
```

- [ ] **Step 2: Verify on a simulator**

Play a round first. Then open Palabras and confirm: the practised count, four working filter chips, rows showing Spanish, English, an accuracy meter, the tally and the next-due date, and a speaker button that pronounces the word. Switch to each filter and confirm the list changes sensibly — `Conocidas` will legitimately be empty early on, and the empty state must read, not sit blank. Report what each filter showed.

Screenshot named beginning `phase2-words-`.

- [ ] **Step 3: Commit**

```bash
npm test && npm run typecheck
git add "apps/app/app/(tabs)/words.tsx"
git commit -m "Add the word list

Filters by what the app actually knows — due, known, and the ones you keep
missing. Themes arrive in phase 3; inventing them here would have meant
inventing the data behind them."
```

---

### Task 6: Settings, and the mute toggle that had nowhere to live

`feedback.ts` has exported `setMuted` and `isMuted` since phase 1 with nothing calling them. This is the screen they were waiting for.

**Files:**
- Create: `apps/app/app/settings.tsx`
- Modify: `apps/app/app/(tabs)/_layout.tsx`, `apps/app/feedback.ts`, `apps/app/app/_layout.tsx`

**Interfaces:**
- Consumes: `setMuted`, `isMuted`, `cue`, `Screen`, `PressableCard`.
- Produces: `loadMuted()` / `saveMuted()` persistence inside `feedback.ts`.

- [ ] **Step 1: Persist the mute setting**

A preference that forgets itself on every launch is not a preference. In `apps/app/feedback.ts`, add near the top:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const MUTE_KEY = 'pepe-habla/muted/v1';
```

and export:

```typescript
/** Called once at startup, before the first cue. */
export async function loadMuted(): Promise<void> {
  try {
    muted = (await AsyncStorage.getItem(MUTE_KEY)) === 'true';
  } catch {
    muted = false;
  }
}

export async function saveMuted(next: boolean): Promise<void> {
  setMuted(next);
  try {
    await AsyncStorage.setItem(MUTE_KEY, String(next));
  } catch {
    // A preference that fails to save is not worth interrupting practice for.
  }
}
```

In `apps/app/app/_layout.tsx`, add `void loadMuted();` to the existing startup effect alongside `prepareAudio()` and `prepareSpeech()`.

- [ ] **Step 2: Write `apps/app/app/settings.tsx`**

```tsx
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Pepe } from '../components/Pepe';
import { PressableCard } from '../components/PressableCard';
import { Screen } from '../components/Screen';
import { cue, isMuted, saveMuted } from '../feedback';
import { WORDS } from '../storage/vocabulary';
import { colour, font, outline, radius, space } from '../theme';

export default function Settings() {
  const router = useRouter();
  const [muted, setMutedState] = useState(isMuted());

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: space.xl, gap: space.md }}>
        <Text style={{ fontFamily: font.displayHeavy, fontSize: 32, color: colour.ink }}>
          Ajustes
        </Text>

        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: space.md,
          backgroundColor: colour.surface, borderRadius: radius.card, padding: space.lg, ...outline,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.display, fontSize: 17, color: colour.ink }}>Sonido</Text>
            <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, marginTop: 2 }}>
              La vibración sigue funcionando aunque lo apagues.
            </Text>
          </View>
          <Switch
            value={!muted}
            onValueChange={(on) => {
              setMutedState(!on);
              void saveMuted(!on);
              if (on) cue('tap');
            }}
            accessibilityLabel="Sonido"
            trackColor={{ false: colour.muted, true: colour.cactus }}
          />
        </View>

        <View style={{
          backgroundColor: colour.surface, borderRadius: radius.card, padding: space.lg, ...outline,
        }}>
          <Text style={{ fontFamily: font.display, fontSize: 17, color: colour.ink }}>
            Pepe Habla
          </Text>
          <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, marginTop: 4, lineHeight: 19 }}>
            {WORDS.length} palabras en español mexicano.
            Pepe es un perro callejero de la Ciudad de México.
          </Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Pepe pose="idle" motion="breathe" size={150} />
        </View>

        <PressableCard label="Volver" onPress={() => { cue('tap'); router.back(); }}>
          <View style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.display, fontSize: 19, color: colour.ink }}>Volver</Text>
          </View>
        </PressableCard>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 3: Reach it from the tabs**

In `apps/app/app/(tabs)/_layout.tsx`, add a header button on the Progreso screen rather than a fourth tab — settings is not a destination people visit often enough to spend a tab on. Give the `Tabs.Screen` for `stats` these options:

```tsx
        options={{
          title: 'Progreso',
          tabBarIcon: ({ color }) => <Icon d={icons.chart} color={color} />,
          headerShown: true,
          headerTitle: '',
          headerStyle: { backgroundColor: colour.ground },
          headerShadowVisible: false,
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Ajustes"
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24">
                <Path
                  d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"
                  stroke={colour.muted} strokeWidth={1.6} fill="none" strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
          ),
        }}
```

Import `Pressable` from `react-native` and `useRouter` from `expo-router`, and call `const router = useRouter();` inside `TabLayout`.

- [ ] **Step 4: Verify on a simulator**

Open Progreso, tap the gear, and confirm: the switch starts on, turning it off silences the cues but **leaves the haptics working** (tap an answer and feel it), the setting survives a full app restart, and `Volver` returns. Report each.

Screenshot named beginning `phase2-settings-`.

- [ ] **Step 5: Commit**

```bash
npm test && npm run typecheck
git add apps/app/app/settings.tsx "apps/app/app/(tabs)/_layout.tsx" apps/app/feedback.ts apps/app/app/_layout.tsx
git commit -m "Add settings, and give the mute toggle somewhere to live

setMuted and isMuted have existed since phase 1 with nothing calling them. The
setting now persists, and muting deliberately leaves haptics alone — they still
work with the phone on silent and carry most of how an answer feels."
```

---

## Phase 2 is done when

- `npm test` passes and `npm run typecheck` is clean.
- Progreso shows a real streak, an honest `CONOCIDAS`, and names the words costing the most.
- Palabras lists what you have practised, filters four ways, and pronounces any word on tap.
- Sound can be turned off, stays off across restarts, and haptics keep working when it is.
- Pepe holds still when the system asks for reduced motion, and every control announces itself.

Phase 3 — the SM-2 scheduler, eight levels, ~28 themes and the vocabulary expansion to ~2,500 words — gets its own plan.

## Self-review notes

Checked against the spec, 2026-09-20:

- **Covered:** accessibility and reduced motion (Task 1, both flagged by the phase 1 whole-branch review); the spec's honest "known" definition, which phase 1 could not express (Tasks 2-3); words known, learned this week, streak, leeches, and the real Pepe photo with its caption plate (Task 4); the word list with accuracy, tally and next-due (Task 5); the mute toggle (Task 6).
- **Deliberately deferred to phase 3:** level progress (the spec's stats screen shows a level bar; there are no levels yet, so Task 4 shows vocabulary progress instead and phase 3 replaces that card), theme filters on the word list, and themed practice sessions.
- **Known gap:** the spec's "tapping a word starts a themed session" needs themes, so the word list's rows are not yet a launch point for practice.
- **Type consistency:** `Progress` gains its two counters in Task 2 before Task 3's `isKnown` reads them; `Summary` and `Leech` are defined once in Task 3 and rendered unchanged in Task 4; `Meter` and `StatTile` are created in Task 4 and reused in Task 5.
