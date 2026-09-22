# The Seed Validator Learns About Tracks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope the seed's three duplicate-text checks by track, so a Spanish word can be a card in both tracks, and prove the new rule with fixtures rather than with the seed.

**Architecture:** The check moves out of the test file into a pure module, `tools/seed/duplicates.ts`, that takes a word list and returns the collisions it finds. `seed.test.ts` keeps asserting against the real seed; a new `duplicates.test.ts` asserts against hand-written fixtures, which is the only way to prove a *relaxation* — the real seed has zero collisions today, so it passes under both the old rule and the new one.

**Tech Stack:** TypeScript run directly by Node 24 (no build step), `node:test`, `@pepe/core` for the `Word` and `Track` types.

**Spec:** `docs/superpowers/specs/2026-09-21-levels-and-tracks-design.md` (§4 content and themes, §6 content and review). The finding this plan closes is recorded in `docs/superpowers/plans/2026-09-21-phase-3c-words-1-execution-log.md` under "Deferred findings".

## Why this is correct, not a loosening

The rule's own comment states its reason: *"Glosses are multiple-choice options. Two words sharing one would make a question with two right answers that the app marks as one right, one wrong."*

That reason is about **one question's four options**. Since phase 3b, a question's distractor pool is filtered by track — `apps/app/app/session.tsx:50` builds `trackWords` and passes only that to `buildQuestions`. Two cards in different tracks can therefore never appear as options in the same question, so they cannot produce the two-right-answers bug the rule exists to prevent.

Scoping the rule by track keeps every case it was written to catch and drops only the cases it never protected against. Two cards in the **same** track sharing a text stays an error, for all three of `es`, `en` and `sv`.

What this buys: `como` can be "as, like" in words and "I eat" in grammar. Grammar levels 2–6 add roughly 500 conjugations, and `nada`, `vino`, `cuenta`, `sale` and `llama` are each a word twice over. It is already costing content — `ninguno` was forced to the awkward Swedish "inte en enda" because `nadie` holds "ingen".

## Global Constraints

- `packages/core` is **not touched by this plan**. It imports nothing from `node:`, `react` or `react-native` and touches no filesystem; `noNodeImports.test.ts` enforces it.
- Relative imports carry explicit `.ts` extensions — Node 24 runs TypeScript directly and there is no build step. Follow `tools/store/fileStore.ts`, which imports `./store.ts`.
- `npm test` globs `'tools/**/*.test.ts'`, so a new test file under `tools/` is picked up with no script change. **Never edit `package.json` scripts.**
- **Never run `expo run:ios`, `expo run:android` or `expo prebuild`.** Nothing in this plan needs the app to run.
- **Stage files by name. Never `git add -A`** — other sessions commit in this working directory.
- Both gates must stay green at every commit: `npm test` (258 tests at the start of this plan — main gained tests from another session after this plan was drafted; what matters is the delta, not the absolute) and `npm run typecheck`.
- End every commit message with a `Co-Authored-By:` trailer naming **the model that actually wrote the commit** — `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` if you are Sonnet, `Claude Opus 5` if you are Opus, and so on. Follow your own session's attribution instruction. This repo's history already mixes them (`b7a92b9` is Sonnet, `d7be718` is Opus), because attribution names the writer. Every commit needs the trailer; none may name a model that did not write it.

## File Structure

| File | Responsibility |
|---|---|
| `tools/seed/duplicates.ts` | **Create.** Pure. Normalising, and finding texts shared within one track. Two exports: `collisions` (track-scoped, for cards) and `duplicates` (flat, for the greetings list, which has no track). No `node:` imports. |
| `tools/seed/duplicates.test.ts` | **Create.** Fixtures that pin the new rule: same text in different tracks passes, same text in one track fails, and normalisation still applies. |
| `tools/seed/seed.test.ts` | **Modify.** Delete the local `duplicates` helper and the local `norm`; import both from the new module; rewrite the three duplicate tests to use `collisions`; leave the greetings test working. |

---

### Task 1: The pure collision finder, proven by fixtures

**Files:**
- Create: `tools/seed/duplicates.ts`
- Test: `tools/seed/duplicates.test.ts`

**Interfaces:**
- Consumes: `Word` and `Track` types from `@pepe/core` (type-only imports).
- Produces, for Task 2:
  - `norm(s: string): string`
  - `duplicates(values: readonly string[]): string[]`
  - `interface Collision { track: Track; text: string; ids: string[] }`
  - `collisions(words: readonly Word[], key: 'es' | 'en' | 'sv'): Collision[]`

`collisions` returns one entry per (track, normalised text) that more than one card in that track carries. `ids` lists every card sharing it, in the order they appear in `words`. The result is sorted by `track`, then `text`, so `assert.deepEqual` is stable regardless of seed file order.

- [ ] **Step 1: Write the failing test**

Create `tools/seed/duplicates.test.ts`:

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Word } from '@pepe/core';
import { collisions, duplicates, norm } from './duplicates.ts';

/** A card with only the fields these checks read. */
function card(id: string, track: Word['track'], es: string, en: string, sv: string): Word {
  return { id, es, en, sv, pos: 'other', track, level: 1, themes: ['conectores'] };
}

describe('norm', () => {
  test('ignores surrounding space and case', () => {
    assert.equal(norm('  Como '), 'como');
  });
});

describe('duplicates', () => {
  test('finds a repeated value', () => {
    assert.deepEqual(duplicates(['hola', 'adiós', 'Hola']), ['hola']);
  });

  test('finds nothing in a clean list', () => {
    assert.deepEqual(duplicates(['hola', 'adiós']), []);
  });
});

describe('collisions', () => {
  // The whole point of this plan: the same Spanish word may be a card in each
  // track, because a question's distractors are drawn from one track only.
  test('lets two tracks share a Spanish text', () => {
    const words = [
      card('como-comparacion', 'words', 'como', 'as, like', 'som'),
      card('como-yo-comer', 'grammar', 'como', 'I eat', 'jag äter'),
    ];
    assert.deepEqual(collisions(words, 'es'), []);
  });

  test('still rejects two cards in one track sharing a Spanish text', () => {
    const words = [
      card('como-comparacion', 'words', 'como', 'as, like', 'som'),
      card('como-otra', 'words', 'Como', 'like', 'liksom'),
    ];
    assert.deepEqual(collisions(words, 'es'), [
      { track: 'words', text: 'como', ids: ['como-comparacion', 'como-otra'] },
    ]);
  });

  test('rejects a shared Swedish gloss in one track', () => {
    const words = [
      card('nadie', 'words', 'nadie', 'no one', 'ingen'),
      card('ninguno', 'words', 'ninguno', 'none', 'ingen'),
    ];
    assert.deepEqual(collisions(words, 'sv'), [
      { track: 'words', text: 'ingen', ids: ['nadie', 'ninguno'] },
    ]);
  });

  test('rejects a shared English gloss in one track', () => {
    const words = [
      card('el-carro', 'words', 'el carro', 'the car', 'bilen'),
      card('el-coche', 'words', 'el coche', 'the car', 'vagnen'),
    ];
    assert.deepEqual(collisions(words, 'en'), [
      { track: 'words', text: 'the car', ids: ['el-carro', 'el-coche'] },
    ]);
  });

  test('names every card sharing the text, not just the first two', () => {
    const words = [
      card('a', 'words', 'a', 'one', 'ett'),
      card('b', 'words', 'b', 'one', 'två'),
      card('c', 'words', 'c', 'one', 'tre'),
    ];
    assert.deepEqual(collisions(words, 'en'), [
      { track: 'words', text: 'one', ids: ['a', 'b', 'c'] },
    ]);
  });

  test('reports both tracks when each has its own collision', () => {
    const words = [
      card('g1', 'grammar', 'vino', 'he came', 'han kom'),
      card('g2', 'grammar', 'vino2', 'he came', 'han anlände'),
      card('w1', 'words', 'el vino', 'the wine', 'vinet'),
      card('w2', 'words', 'la copa', 'the wine', 'glaset'),
    ];
    assert.deepEqual(collisions(words, 'en'), [
      { track: 'grammar', text: 'he came', ids: ['g1', 'g2'] },
      { track: 'words', text: 'the wine', ids: ['w1', 'w2'] },
    ]);
  });

  test('finds nothing in a clean list', () => {
    const words = [
      card('el-carro', 'words', 'el carro', 'the car', 'bilen'),
      card('la-casa', 'words', 'la casa', 'the house', 'huset'),
    ];
    assert.deepEqual(collisions(words, 'es'), []);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tools/seed/duplicates.test.ts`

Expected: FAIL — `Cannot find module './duplicates.ts'`. The module does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Create `tools/seed/duplicates.ts`:

```ts
import type { Track, Word } from '@pepe/core';

/** Compare glosses the way a learner reads them: trimmed, case-insensitive. */
export const norm = (s: string): string => s.trim().toLowerCase();

/** Every value that appears more than once, normalised. */
export function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values.map(norm)) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

/** A text that more than one card in the same track carries. */
export interface Collision {
  track: Track;
  text: string;
  ids: string[];
}

/**
 * Texts shared by two cards in the same track.
 *
 * Scoped by track on purpose. The rule exists because a question's four
 * options must have exactly one right answer, and since phase 3b a question's
 * distractors come from one track only (`apps/app/app/session.tsx` filters the
 * pool to `trackWords`). Two cards in different tracks are never options in the
 * same question, so they cannot collide. Scoping lets `como` be "as, like" in
 * words and "I eat" in grammar, which the 500-odd conjugations in grammar
 * levels 2-6 need.
 */
export function collisions(words: readonly Word[], key: 'es' | 'en' | 'sv'): Collision[] {
  const byTrack = new Map<Track, Map<string, Collision>>();
  for (const w of words) {
    const text = norm(w[key]);
    let byText = byTrack.get(w.track);
    if (byText === undefined) {
      byText = new Map<string, Collision>();
      byTrack.set(w.track, byText);
    }
    const found = byText.get(text);
    if (found === undefined) byText.set(text, { track: w.track, text, ids: [w.id] });
    else found.ids.push(w.id);
  }
  return [...byTrack.values()]
    .flatMap((byText) => [...byText.values()])
    .filter((c) => c.ids.length > 1)
    .sort((a, b) => a.track.localeCompare(b.track) || a.text.localeCompare(b.text));
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test tools/seed/duplicates.test.ts`
Expected: PASS, 10 tests (1 for `norm`, 2 for `duplicates`, 7 for `collisions`).

Then run the whole suite and the typechecker — nothing else should have moved:

Run: `npm test`
Expected: PASS, 268 tests (258 before, 10 added).

Run: `npm run typecheck`
Expected: exit 0, no output past the two `tsc` lines.

- [ ] **Step 5: Prove the fixtures are not vacuous**

A test that passes with the implementation broken proves nothing. Verify by mutation, one at a time, restoring the file exactly after each:

1. **Break the track scoping.** In `collisions`, replace both uses of `w.track` in the map lookups — `byTrack.get(w.track)` and `byTrack.set(w.track, byText)` — with the literal `'words'`, so every card lands in one bucket. Run `node --test tools/seed/duplicates.test.ts`. Expected: **`lets two tracks share a Spanish text` fails.** If it still passes, the fixture is not exercising track scoping — fix the fixture, not the assertion.
2. **Break the threshold.** Change `.filter((c) => c.ids.length > 1)` to `.filter(() => true)`. Expected: **both `finds nothing in a clean list` tests fail.**
3. **Break the ordering.** Remove the `.sort(...)` call. Expected: **`reports both tracks when each has its own collision` fails**, because `grammar` would be reported second.

Restore the file exactly, then re-run `node --test tools/seed/duplicates.test.ts` and confirm 10 passing before committing.

- [ ] **Step 6: Commit**

```bash
git add tools/seed/duplicates.ts tools/seed/duplicates.test.ts
git commit -m "$(cat <<'MSG'
Teach the seed's duplicate check what a track is

A question's distractors come from one track, so two cards in different
tracks can never be options against each other. The old rule rejected them
anyway, which blocks every homograph grammar needs.

The seed has no collisions today, so it passes under either rule. Fixtures
are the only thing that can prove a relaxation, so the check moves into a
pure module with its own.

Co-Authored-By: <your model, e.g. Claude Sonnet 5> <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: The seed validator uses it

**Files:**
- Modify: `tools/seed/seed.test.ts` — delete the local `norm` (line 17) and the local `duplicates` helper (lines 38-43), import from the new module, and rewrite the three duplicate tests (lines 52-58).

**Interfaces:**
- Consumes: `norm`, `duplicates` and `collisions` from `tools/seed/duplicates.ts` (Task 1).
- Produces: nothing later tasks rely on. This is the last task.

**What the file looks like now.** Line 17 is `const norm = (s: string) => s.trim().toLowerCase();`. Lines 38-43 hold the local `duplicates`. Lines 52-58 hold the loop that generates three tests. Line 153 calls `duplicates(GREETINGS.map((g) => g.es))` — greetings are a flat list with no track, so that call keeps the flat helper and must keep working unchanged.

Check the line numbers before editing; earlier commits may have shifted them. Match on the code, not the numbers.

- [ ] **Step 1: Write the failing test**

There is no new behaviour to test here — Task 1 proved the rule, and the real seed cannot prove a relaxation. What this step pins instead is that the validator still runs against the real seed and still reports a same-track collision.

Add this to `tools/seed/seed.test.ts`, inside the existing `describe('seed words', ...)` block, directly after the three generated duplicate tests:

```ts
  // The real seed is clean, so it would pass whether or not the check is wired
  // up at all. This proves the wiring by running it over the real seed plus one
  // planted card that collides with a card already in it.
  test('a planted same-track collision is caught in the real seed', () => {
    const first = words[0]!;
    const planted = { ...first, id: `${first.id}-planted` };
    assert.deepEqual(collisions([...words, planted], 'es'), [
      { track: first.track, text: norm(first.es), ids: [first.id, planted.id] },
    ]);
  });
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tools/seed/seed.test.ts`

Expected: FAIL — `collisions is not defined`. (The local `norm` is still in the file at this point, so the failure may name only `collisions`.) Either way it must fail before the import is added.

- [ ] **Step 3: Write the minimal implementation**

Three edits to `tools/seed/seed.test.ts`:

**(a)** Add the import, directly below the existing `import type { Word } from '@pepe/core';`:

```ts
import { collisions, duplicates, norm } from './duplicates.ts';
```

**(b)** Delete the local `norm` (line 17) and the whole local `duplicates` function (lines 38-43, including its surrounding blank lines). Both now come from the import. In the file as it stands, `norm` has exactly one caller — `values.map(norm)` inside that local `duplicates` — so deleting both leaves the imported `norm` used only by the new planted-collision test in Step 1. That is a real use, so the import is not dead; if `tsc` says it is, the Step 1 test did not get added.

**(c)** Replace the three-test loop:

```ts
  // Glosses are multiple-choice options. Two words sharing one would make a
  // question with two right answers that the app marks as one right, one wrong.
  for (const key of ['es', 'en', 'sv'] as const) {
    test(`no two words share a ${key} text`, () => {
      assert.deepEqual(duplicates(words.map((w) => w[key])), []);
    });
  }
```

with:

```ts
  // Glosses are multiple-choice options. Two words sharing one would make a
  // question with two right answers that the app marks as one right, one wrong.
  // Scoped by track because a question's distractors come from one track only,
  // so two tracks may share a text: `como` is "as, like" in words and "I eat"
  // in grammar. See tools/seed/duplicates.ts.
  for (const key of ['es', 'en', 'sv'] as const) {
    test(`no two words in one track share a ${key} text`, () => {
      assert.deepEqual(collisions(words, key), []);
    });
  }
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test tools/seed/seed.test.ts`
Expected: PASS. One more test than before (15, up from 14), and the three renamed tests now read `no two words in one track share a … text`.

Run: `npm test`
Expected: PASS, 269 tests.

Run: `npm run typecheck`
Expected: exit 0. If `tsc` reports `duplicates` declared but never read, the greetings test at the bottom of the file was changed by mistake — it must still call `duplicates(GREETINGS.map((g) => g.es))`, because greetings are a flat list with no track.

- [ ] **Step 5: Confirm the flat helper is still doing its job**

Temporarily duplicate a greeting line in `apps/app/storage/greetings.ts`, then run `node --test tools/seed/seed.test.ts`.
Expected: **`no line appears twice` fails.** Revert the greeting immediately and re-run to confirm green. This is the one consumer of the flat helper, and nothing else would catch it if the import were wired wrong.

- [ ] **Step 6: Commit**

```bash
git add tools/seed/seed.test.ts
git commit -m "$(cat <<'MSG'
Let a Spanish word be a card in each track

The seed's duplicate checks now compare within a track. Same word, two
tracks, two meanings is legal; same word twice in one track is still the
error it always was, for Spanish and for both glosses.

Greetings keep the flat check — they are a list, not cards, and have no
track to scope by.

Co-Authored-By: <your model, e.g. Claude Sonnet 5> <noreply@anthropic.com>
MSG
)"
```

---

## When both tasks are done

- Run the whole-branch review before the PR. The one thing a reviewer must check independently: that the new rule still catches **every** case the old one caught within a track, for all three keys — a relaxation that overshoots would let two identical options into one question, which is the bug the rule exists to prevent.
- Write the execution log to `docs/superpowers/plans/2026-09-22-seed-validator-track-scope-execution-log.md`.
- The PR body should say plainly what changed: the seed can now hold the same Spanish word in both tracks, which the grammar levels need for their conjugations, and no content in the repo uses it yet — the fixtures are what prove it works.
- Carry forward, unfixed by this plan and belonging to the next content plan: `cada` (words level 1) and `mismo` (words level 2) are determiners sitting in the descriptive-adjective pool; unaccented `como` still has no card, and this plan is what makes one possible.
