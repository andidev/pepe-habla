# SM-2 Scheduler Implementation Plan (phase 3a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Leitner boxes with SM-2 scheduling graded from the first tap's response time, and carry every existing learner's progress across without losing a day of it.

**Architecture:** The algorithm lands in a new `packages/core/src/sm2.ts` that knows nothing about `Progress` — it takes a `{ reps, ease, interval }` and a quality and returns the next one, which makes the arithmetic testable on its own. `leitner.ts` is renamed `progress.ts` and keeps the record-keeping (`applyAnswer`, `freshProgress`, `isDue`, `isKnown`), calling into `sm2.ts` for the dates. `migrateProgress` gains a box-to-SM-2 carry table, so old saves convert on load in both stores and nothing on disk has to be rewritten first.

**Tech Stack:** TypeScript run directly by Node 24 (no build step), `node:test`, Expo SDK 57, expo-router, AsyncStorage.

**Spec:** `docs/superpowers/specs/2026-09-21-levels-and-tracks-design.md` §5 (Scheduling — SM-2) and §7 (Delivery — 3a). It builds on `docs/superpowers/specs/2026-09-21-language-and-game-flow-design.md` §5, which is where "only the first tap is recorded, and its response time with it" comes from. Read both.

**Base:** `main` at `5636a36` (PR #4, the whole-branch review fixes). 144 tests pass, typecheck clean at both roots.

**Scope:** 3a is track-agnostic and content-free. `Word.tier`, `selectDaily`'s tier ordering and the seed files are **not touched** — `track` and `level` arrive in 3b. The only visible change in this plan is that intervals start adapting, plus one stat tile that stops lying (Task 3).

## Global Constraints

- **`packages/core` may not import from `node:`, `react`, `react-native`, or any filesystem API.** `noNodeImports.test.ts` enforces it.
- **Randomness is injected.** Core takes an `Rng` parameter; never `Math.random()` in core.
- **Node 24 runs TypeScript directly.** Relative imports inside core carry explicit `.ts` extensions.
- **TDD for every core change.** Write the test, run it, watch it fail for the right reason, implement, watch it pass.
- **A repair answer is never recorded, and only the first tap on a question counts.** This plan does not touch the reducer that enforces it, but every `Answer` reaching `applyAnswer` is a first tap — the scheduler may assume it.
- **Palette only via `apps/app/theme.ts`**, never a literal hex in a component.
- **Interface copy comes from `apps/app/i18n/strings.ts`.** No user-visible literal in a screen.
- **Touch targets ≥ 44px.** **Platform branching only in `components/Screen.tsx` and `feedback.ts`.**
- **Never run `expo run:ios`, `expo run:android` or `expo prebuild`, and never edit `package.json` scripts or `app.json` to verify something.** Agents have stalled for over an hour on native builds. Verify in Expo Go: `npx expo start` in `apps/app`, then `xcrun simctl openurl booted "exp://127.0.0.1:8081"`.
- **Consult https://docs.expo.dev/versions/v57.0.0/** for any Expo API, per `apps/app/AGENTS.md`.
- **Stage files by name when committing. Never `git add -A`** — other sessions commit in this repo.
- Run `npm test && npm run typecheck` from the repo root before every commit; both must pass.

## The scheduler (from the spec — use these exact values)

Quality comes from the **first tap only**, and the reducer already guarantees that is all `applyAnswer` ever sees.

| First tap | Quality | Effect |
|---|---|---|
| Wrong | `again` | `reps = 0`, `ease -= 0.20`, due tomorrow |
| Right, ≥ 3 s | `good` | normal advance |
| Right, < 3 s | `easy` | advance, `ease += 0.10` |
| Right, > 30 s | `good` | treated as a distraction, never penalised |

| Constant | Value | Meaning |
|---|---|---|
| `EASY_MS` | 3000 | under this, the learner knew it cold |
| `DISTRACTED_MS` | 30000 | over this, they were interrupted, not struggling |
| `INITIAL_EASE` | 2.5 | where every new word starts |
| `MIN_EASE` / `MAX_EASE` | 1.3 / 3.0 | the clamp |
| `EASE_PENALTY` / `EASE_BONUS` | 0.20 / 0.10 | what a miss costs and an easy answer earns |
| `EASY_MULTIPLIER` | 1.3 | extra stretch on an easy answer |
| `FIRST_INTERVAL` / `SECOND_INTERVAL` | 1 / 3 | the two fixed steps, in days |
| `MAX_INTERVAL` | 365 | the cap, in days |

Intervals: **1 day, then 3, then `round(interval × ease)`**, times 1.3 when the answer was easy, capped at 365.

**Two readings this plan fixes in advance, so nobody has to guess:**

1. **The first two intervals are fixed even on an easy answer.** "× 1.3 on easy" attaches to the `round(interval × ease)` step, which is the third answer onwards. An easy first answer still banks the ease bonus; it just pays from the third answer on.
2. **The 30-second row does no work today.** A right answer is never penalised, so a 45-second right answer already grades `good` by the `≥ 3 s` row. It is implemented as a named constant with its own test anyway, so that the distraction rule is already in place if a `hard` grade is ever added — and so that nobody "simplifies" it away without noticing what it was for.

**Migration.** A word in Leitner box N has N−1 consecutive correct answers behind it, and keeps the interval Leitner had given it, so nothing jumps forward or back on the day of the upgrade:

| Box | `reps` | `interval` | `ease` |
|---|---|---|---|
| 1 | 0 | 1 | 2.5 |
| 2 | 1 | 1 | 2.5 |
| 3 | 2 | 3 | 2.5 |
| 4 | 3 | 8 | 2.5 |
| 5 | 4 | 16 | 2.5 |

`dueOn`, `lastSeen`, the direction counters and `knownOn` carry over untouched. `migrateProgress` is **extended**, not joined by a second migration.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/core/src/sm2.ts` (new) | the algorithm alone: `Quality`, `quality()`, `Schedule`, `schedule()`, the constants |
| `packages/core/src/sm2.test.ts` (new) | its tests |
| `packages/core/src/progress.ts` (renamed from `leitner.ts`) | record-keeping: `Answer`, `applyAnswer`, `freshProgress`, `isDue`, `isKnown`, `KNOWN_THRESHOLD` |
| `packages/core/src/progress.test.ts` (renamed from `leitner.test.ts`) | its tests |
| `packages/core/src/types.ts` | `Progress` gains `reps`/`ease`/`interval` and loses `box`; the `Box` type goes |
| `packages/core/src/language.ts` | gains `answersInGloss`, the one definition both `quiz.ts` and `progress.ts` need |
| `packages/core/src/migrate.ts` | the box carry table; tolerates a malformed db |
| `packages/core/src/select.ts` | order due work by `reps` rather than `box` |
| `packages/core/src/stats.ts` | follow the rename; drop one unreachable branch |
| `packages/core/src/index.ts` | export `sm2.ts` and `progress.ts` |
| `tools/cli.ts` | the new `applyAnswer` shape; report reps and ease instead of boxes |
| `tools/store/fileStore.test.ts` | a legacy-box file migrates; the repo's own `data/vocab.json` survives |
| `apps/app/storage/progressStore.ts` | pass the whole answer record, so response time reaches the scheduler |
| `apps/app/app/(tabs)/index.tsx` | "Conocidas" means what the stats screen means by it |

Not touched: `session.ts` (the reducer already records first taps with their `ms`), `quiz.ts` beyond the one import, the seed files, `apps/app/app/session.tsx`.

---

### Task 1: The SM-2 algorithm

A pure module with no knowledge of `Progress`, `Word` or dates. Nothing else in the repo changes, so the suite stays green throughout.

**Files:**
- Create: `packages/core/src/sm2.ts`
- Test: `packages/core/src/sm2.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (all exported from `@pepe/core`):
  - `type Quality = 'again' | 'good' | 'easy'`
  - `quality(correct: boolean, ms?: number): Quality`
  - `interface Schedule { reps: number; ease: number; interval: number }`
  - `schedule(prev: Schedule, q: Quality): Schedule`
  - `EASY_MS`, `DISTRACTED_MS`, `INITIAL_EASE`, `MIN_EASE`, `MAX_EASE`, `EASE_PENALTY`, `EASE_BONUS`, `EASY_MULTIPLIER`, `FIRST_INTERVAL`, `SECOND_INTERVAL`, `MAX_INTERVAL` — all `number`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/sm2.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test packages/core/src/sm2.test.ts`
Expected: FAIL — `Cannot find module './sm2.ts'`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/sm2.ts`:

```ts
/**
 * SM-2 scheduling: how long until a card comes back.
 *
 * This module knows nothing about words, progress records or dates. It takes
 * the three numbers the algorithm owns and returns the next three, which is
 * what makes the arithmetic testable without inventing a Progress for every
 * case. progress.ts is what turns an interval into a due date.
 *
 * The grade comes from the learner's *first* tap and nothing else. A word
 * found on the third try, or after the answer has been shown, is a word that
 * was not recalled -- the session reducer enforces that, and everything here
 * assumes it.
 */

/**
 * How a first tap is graded.
 *
 * There is no 'hard'. With four options and a retry loop, the honest signal is
 * right-or-not plus how long it took; asking a child to rate their own recall
 * on a four-point scale would be noise dressed as data.
 */
export type Quality = 'again' | 'good' | 'easy';

/** Faster than this and the learner knew it cold. */
export const EASY_MS = 3_000;
/**
 * Slower than this and they were interrupted, not struggling. Nothing
 * penalises a slow right answer today, so this changes no outcome -- it is
 * here so the rule already exists if a 'hard' grade is ever added.
 */
export const DISTRACTED_MS = 30_000;

export const INITIAL_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;
export const EASE_PENALTY = 0.2;
export const EASE_BONUS = 0.1;
export const EASY_MULTIPLIER = 1.3;

/** The first two intervals are fixed. From the third on, the ease does the work. */
export const FIRST_INTERVAL = 1;
export const SECOND_INTERVAL = 3;
/** A year. Past this the interval stops meaning anything a learner can feel. */
export const MAX_INTERVAL = 365;

/** The part of a progress record the scheduler owns. */
export interface Schedule {
  /** Consecutive correct first taps. Back to zero after a miss. */
  reps: number;
  /** How fast the interval grows, 1.3 to 3.0. */
  ease: number;
  /** Days from the last answer to the next due date. */
  interval: number;
}

/**
 * Grade a first tap.
 *
 * `ms` is optional because the CLI records answers with no clock behind them;
 * an untimed answer is 'good', never 'easy', so authoring seed data can never
 * inflate a learner's intervals.
 */
export function quality(correct: boolean, ms?: number): Quality {
  if (!correct) return 'again';
  if (ms === undefined || ms > DISTRACTED_MS) return 'good';
  return ms < EASY_MS ? 'easy' : 'good';
}

/**
 * Two decimals, always.
 *
 * 2.5 - 0.2 - 0.2 is 2.0999999999999996 in binary floating point, and this
 * number is written to AsyncStorage and read back for years. Rounding at each
 * step keeps the stored value readable and keeps the drift out.
 */
const clampEase = (ease: number): number =>
  Math.round(Math.min(MAX_EASE, Math.max(MIN_EASE, ease)) * 100) / 100;

/** The next schedule. Returns a new object; the input is left alone. */
export function schedule(prev: Schedule, q: Quality): Schedule {
  // A miss sends the word back to the start rather than down one step.
  // Half-forgotten words are worth over-practising, and the cost of being
  // wrong here is only that you see an easy word tomorrow.
  if (q === 'again') {
    return {
      reps: 0,
      ease: clampEase(prev.ease - EASE_PENALTY),
      interval: FIRST_INTERVAL,
    };
  }

  const ease = q === 'easy' ? clampEase(prev.ease + EASE_BONUS) : prev.ease;
  const reps = prev.reps + 1;
  const stretch = q === 'easy' ? EASY_MULTIPLIER : 1;

  const interval =
    reps === 1 ? FIRST_INTERVAL
    : reps === 2 ? SECOND_INTERVAL
    : Math.min(MAX_INTERVAL, Math.round(prev.interval * ease * stretch));

  return { reps, ease, interval };
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `node --test packages/core/src/sm2.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 5: Export it from core's public surface**

In `packages/core/src/index.ts`, add after the `leitner.ts` line:

```ts
export * from './sm2.ts';
```

- [ ] **Step 6: Run the whole suite and typecheck**

Run: `npm test && npm run typecheck` from the repo root.
Expected: 144 + 16 = 160 tests pass, typecheck clean. Nothing else in the repo changed, so any failure here is a name collision with an existing export — rename the local symbol, not the spec's constant.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/sm2.ts packages/core/src/sm2.test.ts packages/core/src/index.ts
git commit -m "Add the SM-2 interval arithmetic, graded from the first tap"
```

---

### Task 2: Progress, its migration and every call site move onto SM-2

This is one commit because it has to be: the moment `Progress` loses `box`, everything that reads it stops compiling. The steps below keep the work ordered so that only the last one has to be green.

**Files:**
- Create: `packages/core/src/progress.ts`, `packages/core/src/progress.test.ts` (`git mv` from `leitner.ts` / `leitner.test.ts`, then rewrite)
- Delete: `packages/core/src/leitner.ts`, `packages/core/src/leitner.test.ts` (by the rename)
- Modify: `packages/core/src/types.ts`, `language.ts`, `language.test.ts`, `quiz.ts`, `migrate.ts`, `migrate.test.ts`, `select.ts`, `select.test.ts`, `stats.ts`, `stats.test.ts`, `index.ts`
- Modify: `tools/cli.ts`, `tools/store/fileStore.test.ts`
- Modify: `apps/app/storage/progressStore.ts`

**Interfaces:**
- Consumes: `Schedule`, `quality`, `schedule`, `INITIAL_EASE` from Task 1.
- Produces (all exported from `@pepe/core`):
  - `Progress` gains `reps: number`, `ease: number`, `interval: number`; loses `box`. The `Box` type is gone.
  - `interface Answer { correct: boolean; direction: Direction | null; ms?: number }`
  - `applyAnswer(p: Progress, answer: Answer, today: string): Progress` — **new shape**, an object rather than three positionals
  - `freshProgress(id: string, today: string): Progress`, `isDue(p, today): boolean`, `isKnown(p): boolean`, `KNOWN_THRESHOLD` — unchanged signatures, moved file
  - `answersInGloss(d: Direction): boolean` — moved into `language.ts`
  - `StoredProgress` now also tolerates a legacy `box` and missing `reps`/`ease`/`interval`

Three things here close findings from the whole-branch review of main (logged in `docs/superpowers/plans/2026-09-20-phase-2-execution-log.md`): `direction` becomes explicitly nullable rather than optional, `migrateProgress` stops throwing on a malformed db, and the `null`-counter shape gets a test.

- [ ] **Step 1: Move the shared predicate into `language.ts`**

`quiz.ts` and `leitner.ts` each define this rule under a different name. They have to agree — if they ever drift, a correct answer is credited to a direction it was never asked in. One definition, in the module that owns what "the gloss language" means.

In `packages/core/src/language.ts`, add (and make sure `Direction` is in the type import from `./types.ts`):

```ts
/**
 * Whether the learner answers a question of this direction in the gloss
 * language rather than in Spanish.
 *
 * One definition, two callers: quiz.ts builds the options from it, progress.ts
 * decides which direction counter a correct answer advances. They must mean
 * exactly the same thing.
 */
export const answersInGloss = (d: Direction): boolean => d === 'es->en';
```

In `packages/core/src/quiz.ts`, delete the local `const answersInGloss = ...` and add it to the existing import: `import { answersInGloss, gloss, type GlossLanguage } from './language.ts';`

Add to `packages/core/src/language.test.ts`:

```ts
describe('answersInGloss', () => {
  test('recognition is answered in the gloss, production and pictures in Spanish', () => {
    assert.equal(answersInGloss('es->en'), true);
    assert.equal(answersInGloss('en->es'), false);
    assert.equal(answersInGloss('picture->es'), false);
  });
});
```

- [ ] **Step 2: Rename the module and rewrite its test**

```bash
git mv packages/core/src/leitner.ts packages/core/src/progress.ts
git mv packages/core/src/leitner.test.ts packages/core/src/progress.test.ts
```

Replace the whole contents of `packages/core/src/progress.test.ts`:

```ts
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
```

- [ ] **Step 3: Rewrite the migration test**

Replace the whole contents of `packages/core/src/migrate.test.ts`:

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { migrateProgress, type StoredVocabDb } from './migrate.ts';
import { INITIAL_EASE } from './sm2.ts';

/** A record as the Leitner version saved it: a box, and none of the rest. */
const legacy = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'ser',
  box: 2,
  seen: 4,
  right: 3,
  wrong: 1,
  lastSeen: '2026-09-19',
  dueOn: '2026-09-21',
  ...over,
});

// `as unknown as` on purpose: these fixtures build shapes the current types say
// cannot exist -- a null counter, a missing progress map -- and defending
// against exactly those is what migrateProgress is for.
const db = (record: Record<string, unknown>): StoredVocabDb =>
  ({ version: 1, progress: { ser: record } }) as unknown as StoredVocabDb;

describe('migrateProgress', () => {
  test('a Leitner box becomes the streak behind it and the interval it had', () => {
    const p = migrateProgress(db(legacy({ box: 4 }))).progress['ser']!;
    assert.equal(p.reps, 3);
    assert.equal(p.interval, 8);
    assert.equal(p.ease, INITIAL_EASE);
  });

  test('every box carries over', () => {
    const expected = [
      [1, 0, 1],
      [2, 1, 1],
      [3, 2, 3],
      [4, 3, 8],
      [5, 4, 16],
    ] as const;
    for (const [box, reps, interval] of expected) {
      const p = migrateProgress(db(legacy({ box }))).progress['ser']!;
      assert.deepEqual([p.reps, p.interval], [reps, interval], `box ${box}`);
    }
  });

  test('the box itself is dropped, not carried along', () => {
    // A dead field in a record that is rewritten for years is a field somebody
    // will eventually read.
    const p = migrateProgress(db(legacy())).progress['ser']!;
    assert.equal('box' in p, false);
  });

  test('the due date, last seen and the counts are untouched', () => {
    const p = migrateProgress(db(legacy())).progress['ser']!;
    assert.equal(p.dueOn, '2026-09-21');
    assert.equal(p.lastSeen, '2026-09-19');
    assert.deepEqual([p.seen, p.right, p.wrong], [4, 3, 1]);
  });

  test('the fields phase 2 added default rather than becoming NaN', () => {
    const p = migrateProgress(db(legacy())).progress['ser']!;
    assert.deepEqual([p.rightEsToEn, p.rightEnToEs, p.knownOn], [0, 0, null]);
  });

  test('a null counter becomes zero too', () => {
    // A CLI built before migrateProgress existed computed `undefined + 0` and
    // JSON.stringify wrote the NaN out as null. Absent and null must both heal.
    const p = migrateProgress(db(legacy({ rightEsToEn: null, rightEnToEs: null }))).progress['ser']!;
    assert.deepEqual([p.rightEsToEn, p.rightEnToEs], [0, 0]);
  });

  test('a record already on SM-2 is left exactly as it is', () => {
    const current = {
      id: 'ser', reps: 5, ease: 2.8, interval: 45,
      seen: 9, right: 8, wrong: 1,
      rightEsToEn: 4, rightEnToEs: 4, knownOn: '2026-09-10',
      lastSeen: '2026-09-19', dueOn: '2026-11-03',
    };
    assert.deepEqual(migrateProgress(db(current)).progress['ser'], current);
  });

  test('an unrecognisable box is treated as the shakiest one', () => {
    const p = migrateProgress(db(legacy({ box: 99 }))).progress['ser']!;
    assert.deepEqual([p.reps, p.interval], [0, 1]);
  });

  test('a db with no progress map migrates to an empty one rather than throwing', () => {
    // A hand-edited or half-merged vocab.json must not take the CLI down with
    // a TypeError that names neither the file nor the problem.
    assert.deepEqual(migrateProgress({ version: 1 } as unknown as StoredVocabDb), { version: 1, progress: {} });
  });

  test('it is idempotent', () => {
    // A VocabDb is a valid StoredVocabDb -- every optional field is filled in.
    const once = migrateProgress(db(legacy()));
    assert.deepEqual(migrateProgress(once), once);
  });

  test('it does not mutate the input', () => {
    const input = db(legacy());
    migrateProgress(input);
    assert.equal(input.progress['ser']?.box, 2);
  });
});
```

- [ ] **Step 4: Run both and watch them fail**

Run: `node --test packages/core/src/progress.test.ts packages/core/src/migrate.test.ts`
Expected: FAIL — `reps`, `ease` and `interval` are not on `Progress`, and `applyAnswer` still takes three positionals. Read the failures: they should be about the shape, not about a missing module.

- [ ] **Step 5: Change the record's shape**

In `packages/core/src/types.ts`, delete the `Box` type entirely and replace the first field of `Progress`:

```ts
/** What we know about how well a word is known. This is the part that changes. */
export interface Progress {
  /** Stable slug, the same one as the word's. */
  id: string;
  /** Consecutive correct first taps. Back to zero after a miss. */
  reps: number;
  /** SM-2 ease factor, 1.3 to 3.0: how fast the interval grows. */
  ease: number;
  /** Days from the last answer to the next due date. 0 until first answered. */
  interval: number;
  seen: number;
  right: number;
  wrong: number;
  /** Correct answers where the learner read Spanish and chose the gloss. */
  rightEsToEn: number;
  /** Correct answers where the learner produced the Spanish. */
  rightEnToEs: number;
  /** ISO date this word first counted as known, or null if it never has. */
  knownOn: string | null;
  /** ISO date (YYYY-MM-DD) the word was last asked, or null if never. */
  lastSeen: string | null;
  /** ISO date the word is next due. */
  dueOn: string;
}
```

- [ ] **Step 6: Rewrite `progress.ts`**

Replace the whole contents of `packages/core/src/progress.ts`:

```ts
import type { Direction, Progress } from './types.ts';
import { addDays } from './dates.ts';
import { answersInGloss } from './language.ts';
import { INITIAL_EASE, quality, schedule } from './sm2.ts';

/**
 * What the learner did on their **first** tap at a question.
 *
 * Only a first tap ever reaches here. A word found by elimination, or right on
 * the third try, was not recalled; the session reducer drops those, and a
 * repair answer is never recorded at all.
 */
export interface Answer {
  correct: boolean;
  /**
   * Which way round the question was asked, or null when it is genuinely
   * unknown -- the CLI records answers without one. Null rather than optional
   * on purpose: "forgotten" and "deliberately unknown" have to look different
   * at the call site, because the first is a bug that makes a word permanently
   * unknowable and the second is correct.
   */
  direction: Direction | null;
  /** Milliseconds from the question appearing to that first tap. Absent when untimed. */
  ms?: number;
}

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

/** Record an answer. Returns a new Progress; the input is left alone. */
export function applyAnswer(p: Progress, answer: Answer, today: string): Progress {
  const { reps, ease, interval } = schedule(p, quality(answer.correct, answer.ms));
  // Only a correct answer whose direction we know credits a counter.
  const credited = answer.correct ? answer.direction : null;

  const next: Progress = {
    ...p,
    reps,
    ease,
    interval,
    seen: p.seen + 1,
    right: p.right + (answer.correct ? 1 : 0),
    wrong: p.wrong + (answer.correct ? 0 : 1),
    rightEsToEn: p.rightEsToEn + (credited !== null && answersInGloss(credited) ? 1 : 0),
    rightEnToEs: p.rightEnToEs + (credited !== null && !answersInGloss(credited) ? 1 : 0),
    lastSeen: today,
    dueOn: addDays(today, interval),
  };

  // Stamp the day it crossed, once. A word that later lapses keeps its date --
  // it was learned then, and "learned this week" is a record of what happened,
  // not a claim about what you still remember.
  return next.knownOn === null && isKnown(next)
    ? { ...next, knownOn: today }
    : next;
}

/** A word being introduced for the first time: nothing behind it, due right now. */
export function freshProgress(id: string, today: string): Progress {
  return {
    id,
    reps: 0,
    ease: INITIAL_EASE,
    // No interval yet. The first answer sets one; nothing reads this until
    // the third, by which time it has been written twice.
    interval: 0,
    seen: 0,
    right: 0,
    wrong: 0,
    rightEsToEn: 0,
    rightEnToEs: 0,
    knownOn: null,
    lastSeen: null,
    dueOn: today,
  };
}

export function isDue(p: Progress, today: string): boolean {
  return p.dueOn <= today; // ISO dates sort lexicographically
}
```

- [ ] **Step 7: Rewrite `migrate.ts`**

Replace the whole contents of `packages/core/src/migrate.ts`:

```ts
import type { Progress, VocabDb } from './types.ts';
import { INITIAL_EASE } from './sm2.ts';

type Added = 'rightEsToEn' | 'rightEnToEs' | 'knownOn';
type Scheduling = 'reps' | 'ease' | 'interval';

/** A Leitner box, as every version before SM-2 stored it. 1 = shaky, 5 = solid. */
type Box = 1 | 2 | 3 | 4 | 5;

/**
 * What each box carries over as.
 *
 * A word in box N has N-1 consecutive correct answers behind it, and keeps the
 * interval Leitner had already given it, so no word jumps forward or back on
 * the day of the upgrade. Everyone starts at the default ease: we have no
 * response times from before, and guessing at them would be inventing data.
 */
const FROM_BOX: Record<Box, { reps: number; interval: number }> = {
  1: { reps: 0, interval: 1 },
  2: { reps: 1, interval: 1 },
  3: { reps: 2, interval: 3 },
  4: { reps: 3, interval: 8 },
  5: { reps: 4, interval: 16 },
};

const boxOf = (box: unknown): Box =>
  typeof box === 'number' && box >= 1 && box <= 5 ? (Math.round(box) as Box) : 1;

/**
 * Progress as an earlier version may have saved it: the scheduling fields and
 * the phase 2 counters may be absent, and a Leitner `box` may be present.
 */
export type StoredProgress =
  Omit<Progress, Added | Scheduling>
  & Partial<Pick<Progress, Added | Scheduling>>
  & { box?: number };

export interface StoredVocabDb {
  version: 1;
  progress: Record<string, StoredProgress>;
}

/**
 * Bring saved progress up to the current shape.
 *
 * Every loader runs this, whatever wrote the data. Two things it has to get
 * right: adding to `undefined` gives `NaN`, and `NaN >= 3` is always false --
 * a word with a NaN counter could never become known and nothing would ever
 * say so -- and a Leitner box has to become a streak and an interval, because
 * the scheduler that reads them no longer knows what a box is.
 *
 * `knownOn` defaults to null rather than a guess: we do not know when an
 * already-known word was learned, and guessing would inflate "learned this
 * week" on the first launch after upgrading.
 */
export function migrateProgress(db: StoredVocabDb): VocabDb {
  const progress: Record<string, Progress> = {};
  // A hand-edited or half-merged file is worth a clean empty db, not a
  // TypeError that names neither the file nor the problem.
  for (const [id, stored] of Object.entries(db?.progress ?? {})) {
    const { box, ...p } = stored;
    const carried = FROM_BOX[boxOf(box)];
    progress[id] = {
      ...p,
      reps: p.reps ?? carried.reps,
      ease: p.ease ?? INITIAL_EASE,
      interval: p.interval ?? carried.interval,
      rightEsToEn: p.rightEsToEn ?? 0,
      rightEnToEs: p.rightEnToEs ?? 0,
      knownOn: p.knownOn ?? null,
    };
  }
  return { ...db, progress };
}
```

- [ ] **Step 8: Follow the rename through core**

In `packages/core/src/select.ts`, change the import to `./progress.ts` and the due ordering — weakest first now means fewest reps first:

```ts
import { isDue } from './progress.ts';
```

```ts
  ).sort((a, b) => a.reps - b.reps || a.dueOn.localeCompare(b.dueOn));
```

and update the doc comment: "weakest box first" becomes "shortest streak first".

In `packages/core/src/stats.ts`, change both references to `./leitner.ts` to `./progress.ts` (the `import` and the `export { isKnown, KNOWN_THRESHOLD }` line), update the comment that names `leitner.ts`, and drop one unreachable branch in `leeches` — the loop has already skipped `p.wrong === 0`, and `wrong > 0` implies `seen > 0`:

```ts
      accuracy: Math.round((p.right / p.seen) * 100),
```

In `packages/core/src/index.ts`, change `export * from './leitner.ts';` to `export * from './progress.ts';`.

- [ ] **Step 9: Update the remaining core fixtures**

`packages/core/src/select.test.ts` — the helper takes a streak now:

```ts
const prog = (id: string, reps: number, dueOn: string): Progress => ({
  id, reps, ease: 2.5, interval: 1, seen: 5, right: 3, wrong: 2,
  rightEsToEn: 0, rightEnToEs: 0, knownOn: null, lastSeen: '2026-09-01', dueOn,
});
```

Every `prog(...)` call site passes a box today. A word in box N has N−1 correct answers behind it, so each one drops by one and the ordering the tests assert is unchanged:

| Was | Becomes |
|---|---|
| `prog('due1', 1, ...)` | `prog('due1', 0, ...)` |
| `prog('due2', 2, ...)` | `prog('due2', 1, ...)` |
| `prog('strong', 5, ...)` | `prog('strong', 4, ...)` |
| `prog('middling', 3, ...)` | `prog('middling', 2, ...)` |
| `prog('weak', 1, ...)` | `prog('weak', 0, ...)` |

Apply the same −1 to any `prog(...)` call further down the file that is not in this table. Where a test name or comment says "box", say "streak" instead. Leave the tier test exactly as it is — tiers are 3b's problem.

`packages/core/src/stats.test.ts` — in the fixture at the top, replace `box: 1,` with `reps: 0, ease: 2.5, interval: 0,`; at the `isKnown` case, replace `box: 5` with `reps: 4`.

- [ ] **Step 10: Update the CLI**

In `tools/cli.ts`:

Change the import — `INTERVALS` and `Box` are gone, `INITIAL_EASE` arrives:

```ts
import { buildQuestions, selectDaily, applyAnswer, freshProgress, isDue, INITIAL_EASE,
         mulberry32, seedFromDate, todayISO } from '@pepe/core';
import type { Progress } from '@pepe/core';
```

In `answer()`, the new call shape and a row that reports what actually changed:

```ts
    const after = applyAnswer(before, { correct, direction: null }, today);
```

```ts
    rows.push(
      `| ${word.es} | ${word.en} | ${correct ? '✅' : '❌'} | ${before.reps} → ${after.reps} | ${after.interval}d | ${after.dueOn} |`,
    );
```

and the log header:

```ts
      '| Spanish | English | Result | Streak | Interval | Next due |',
      '|---|---|---|---|---|---|',
```

In `stats()`, replace the box histogram with a streak histogram and the mean ease:

```ts
  const buckets = [0, 1, 2, 3, 4].map((reps) => ({
    label: `${reps} in a row`,
    count: all.filter((p) => p.reps === reps).length,
  }));
  buckets.push({ label: '5 or more', count: all.filter((p) => p.reps >= 5).length });

  const meanEase = all.length === 0
    ? INITIAL_EASE
    : all.reduce((n, p) => n + p.ease, 0) / all.length;
```

```ts
  for (const b of buckets) {
    console.log(`  ${b.label.padEnd(10)} ${'█'.repeat(b.count).slice(0, 60)} ${b.count}`);
  }
  console.log('');
  console.log(`Mean ease:   ${meanEase.toFixed(2)}`);
```

The CLI stays English and keeps passing no gloss language, per the language spec's Scope.

- [ ] **Step 11: Update the app's store**

In `apps/app/storage/progressStore.ts`, pass the record itself. `AnswerRecord` already carries `correct`, `direction` and `ms` — exactly what `Answer` wants — so the response time the session screen measured finally reaches the scheduler:

```ts
    progress[record.wordId] = applyAnswer(before, record, today);
```

- [ ] **Step 12: Prove the migration against real files**

In `tools/store/fileStore.test.ts`, the round-trip fixture moves to the current shape:

```ts
    db.progress['ser'] = {
      id: 'ser', reps: 2, ease: 2.5, interval: 3, seen: 4, right: 3, wrong: 1,
      rightEsToEn: 0, rightEnToEs: 0, knownOn: null,
      lastSeen: '2026-09-19', dueOn: '2026-09-23',
    };
```

and two tests are added. Add `projectRoot` to the existing `./fileStore.ts` import and `import { MAX_EASE, MIN_EASE } from '@pepe/core';` at the top. The first test proves a file written by the Leitner version converts; the second is the one nobody had — `data/vocab.json` is committed, both stores seed the first launch from it, it still carries boxes, and until now nothing asserted it survives. Add `projectRoot` and `MIN_EASE`/`MAX_EASE` to the imports:

```ts
  test('a Leitner box saved by an older version carries over to SM-2', async () => {
    await writeFile(
      join(root, 'data', 'vocab.json'),
      JSON.stringify({
        version: 1,
        progress: {
          ser: {
            id: 'ser', box: 4, seen: 6, right: 5, wrong: 1,
            lastSeen: '2026-09-19', dueOn: '2026-09-27',
          },
        },
      }),
    );
    assert.deepEqual((await fileStore(root).loadProgress()).progress['ser'], {
      id: 'ser', reps: 3, ease: 2.5, interval: 8,
      seen: 6, right: 5, wrong: 1,
      rightEsToEn: 0, rightEnToEs: 0, knownOn: null,
      lastSeen: '2026-09-19', dueOn: '2026-09-27',
    });
  });

  test("the repo's own data/vocab.json survives migration", async () => {
    // Committed, seeded from on first launch, and still carrying Leitner
    // boxes. This is the production migration path; everything else here runs
    // against a temp directory.
    const db = await fileStore(projectRoot).loadProgress();
    const records = Object.values(db.progress);
    assert.ok(records.length > 0, 'expected the committed vocab.json to hold progress');
    for (const p of records) {
      assert.ok(Number.isFinite(p.reps) && p.reps >= 0, `${p.id}: reps ${p.reps}`);
      assert.ok(p.ease >= MIN_EASE && p.ease <= MAX_EASE, `${p.id}: ease ${p.ease}`);
      assert.ok(Number.isFinite(p.interval), `${p.id}: interval ${p.interval}`);
      assert.ok(Number.isFinite(p.rightEsToEn) && Number.isFinite(p.rightEnToEs), `${p.id}: NaN counter`);
      assert.ok(p.knownOn === null || typeof p.knownOn === 'string', `${p.id}: knownOn`);
      assert.equal('box' in p, false, `${p.id} still carries a Leitner box`);
    }
  });
```

This test only reads. It must not write to `projectRoot`.

- [ ] **Step 13: Run everything**

Run: `npm test && npm run typecheck` from the repo root.
Expected: all tests pass, typecheck clean at both roots. If `tsc -p apps/app` still complains, something outside this plan's file list reads `Progress.box` — find it with `grep -rn "\.box" apps packages tools` and fix it here rather than leaving the tree broken.

- [ ] **Step 14: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/progress.ts packages/core/src/progress.test.ts \
        packages/core/src/migrate.ts packages/core/src/migrate.test.ts \
        packages/core/src/language.ts packages/core/src/language.test.ts packages/core/src/quiz.ts \
        packages/core/src/select.ts packages/core/src/select.test.ts \
        packages/core/src/stats.ts packages/core/src/stats.test.ts packages/core/src/index.ts \
        tools/cli.ts tools/store/fileStore.test.ts apps/app/storage/progressStore.ts
git commit -m "Schedule by SM-2, and carry every Leitner box across"
```

Note the deleted `leitner.ts` / `leitner.test.ts` are already staged by the `git mv` in Step 2.

---

### Task 3: "Conocidas" stops meaning two different things

The home screen counts a word as known when `box >= 4` — three correct answers in a row, in any direction. The stats screen counts it known when it has three correct answers in *each* direction. Both tiles say **CONOCIDAS / KÄNDA / KNOWN**, and they disagree, usually by a lot.

With `box` gone the line has to change anyway, so it changes to the honest one. The looser measure is not lost: the spec gives it its own name, `dominadas`, on the level card in 3b, where it is the unlock gate. This task is also where the whole plan gets played.

**Files:**
- Modify: `apps/app/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `isKnown` from Task 2 (unchanged signature, new module).
- Produces: nothing.

- [ ] **Step 1: Count known words the way the stats screen does**

In `apps/app/app/(tabs)/index.tsx`, add `isKnown` to the `@pepe/core` import and replace the count:

```ts
      // The same measure the stats screen calls Conocidas: three correct in
      // *each* direction. It used to be box >= 4 here, which is a different,
      // looser thing wearing the same label. The looser count returns in 3b
      // as `dominadas`, on the level card, where it is the unlock gate.
      setKnown(all.filter(isKnown).length);
```

- [ ] **Step 2: Run the suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: green. No test covers this line; the proof is Step 3.

- [ ] **Step 3: Play it**

Start the packager and open it in Expo Go — **never** `expo run:ios`, `expo run:android` or `expo prebuild`:

```bash
cd apps/app && npx expo start
```

then, with a simulator booted, `xcrun simctl openurl booted "exp://127.0.0.1:8081"`.

Check and report each of these in the execution log:

1. **The upgrade path.** The bundled `data/vocab.json` seeds a fresh install with ten Leitner records. Home's *POR REPASAR* count and the words screen's next-review dates must look the same as they did before this plan — nothing should jump a week into the future or all become due at once.
2. **A round records.** Play one round. Answer at least one question wrong on the first tap, one right slowly (wait ~5 s), and one right immediately. Then read the stored record for those three words — from the words screen's next-review column, or by logging `loadProgress()` — and confirm: the miss is due tomorrow, the slow right answer advanced normally, and the fast one got a longer interval than the slow one at the same streak.
3. **Repair still records nothing.** A word answered wrong and then repaired at the end of the round must keep the miss, not be healed by the repair answer.
4. **Home's CONOCIDAS matches the stats screen's.** The two numbers are now the same measure; check they read the same.
5. Nothing on either screen shifted or broke.

- [ ] **Step 4: Commit**

```bash
git add "apps/app/app/(tabs)/index.tsx"
git commit -m "Let home and the stats screen agree on what Conocidas means"
```

---

## When all three tasks are done

- Run the whole-branch review before the PR, not after it is merged. That is the gate plan 2 never got.
- Write the execution log to `docs/superpowers/plans/2026-09-21-phase-3a-execution-log.md`: every ruling, every deferred finding, and the Expo Go results from Task 3 Step 3.
- The PR body should say plainly that the only visible change is that intervals adapt and one stat tile now agrees with the other, and that existing progress converts on load.

## Out of scope

- `track` and `level` on `Word`, the unlock gate, the home toggle — 3b.
- Retiring `Word.tier` and re-levelling the 384 words — 3b.
- Any new content — 3c.
- A `hard` grade, or letting the learner rate their own recall.
- Showing the ease or the interval to the learner anywhere in the app.
