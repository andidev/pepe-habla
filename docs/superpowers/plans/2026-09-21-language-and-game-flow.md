# App Language and Answer Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the learner choose Svenska, English or Español (with Swedish glosses in Swedish mode), and replace the one-shot answer with a retry-until-right loop where every tap is spoken and feedback drops in from the top without moving the buttons.

**Architecture:** Languages are pure data and pure functions in `packages/core` (`gloss`, `glossLanguage`, `languageForLocale`), so questions arrive at the screen already in the right language. The retry rule lives in the session reducer, which stays pure; the screen owns timing, toasts and audio sequencing on top of a promise-returning `say()` in `feedback.ts`. Interface copy moves to one typed strings file behind a small React context.

**Tech Stack:** TypeScript run directly by Node 24 (no build step), `node:test`, Expo SDK 57, expo-router, Reanimated 4, expo-speech, AsyncStorage, expo-localization (new).

**Spec:** `docs/superpowers/specs/2026-09-21-language-and-game-flow-design.md` (mocks: `docs/superpowers/specs/mocks/2026-09-21-language-and-game-flow.html`)

**Base:** this branch already contains phase 2 tasks 1–5 (merged from `phase-2`). Phase 2's Task 6 — the settings screen with a persistent mute toggle — was never committed; it is folded into Tasks 4 and 8 here. Its half-finished code lives uncommitted in the main checkout; do **not** touch that checkout.

## Global Constraints

- **`packages/core` may not import from `node:`, `react`, `react-native`, or any filesystem API.** `noNodeImports.test.ts` enforces it.
- **Randomness is injected.** Core takes an `Rng` parameter; never `Math.random()` in core.
- **Node 24 runs TypeScript directly.** Relative imports inside core carry explicit `.ts` extensions.
- **TDD for every core change.** Write the test, run it, watch it fail, implement, watch it pass.
- **Palette only via `apps/app/theme.ts`**, never a literal hex in a component: ground `#FBF6EC`, surface `#FFFFFF`, ink `#1C1714`, muted `#6B6259`, chile `#D1453B`, cactus `#2E7D5B`, marigold `#E9A020`.
- **Every card and button: 2px ink border, hard offset shadow, never blurred.** Use `PressableCard`.
- **Interface copy comes from `apps/app/i18n/strings.ts`** (from Task 5 on). No user-visible literal in a screen, except the brand words `¡Vamos!`, `Callejero`, `Pepe Habla`, and Pepe's Spanish greetings.
- **Spanish words are always shown in Spanish and spoken with the Mexican voice.** Only glosses change language.
- **Touch targets ≥ 44px.**
- **Platform branching only in `components/Screen.tsx` and `feedback.ts`.**
- **Stage files by name when committing. Never `git add -A`.**
- **Consult https://docs.expo.dev/versions/v57.0.0/** for any Expo API, per `apps/app/AGENTS.md`.
- Run `npm test && npm run typecheck` from the repo root before every commit; both must pass.

## Timings (from the spec — use these exact values)

| Constant | Value | Meaning |
|---|---|---|
| `WRONG_TOAST_MS` | 2000 | how long "try again" stays down |
| `ADVANCE_MS` | 3000 | countdown before the next question, after a right answer |
| `CUE_MS` | 450 | wait after the correct cue starts before the countdown begins (cues are ~0.4 s) |
| speech guard | `1500 + 80 × characters` ms | `say()` resolves by then even if no callback fires |

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/core/src/language.ts` (new) | `AppLanguage`, `GlossLanguage`, `gloss`, `glossLanguage`, `languageForLocale`, `isAppLanguage` |
| `packages/core/src/language.test.ts` (new) | its tests |
| `packages/core/src/quiz.ts` | drop listening; gloss-language-aware questions; which side is spoken |
| `packages/core/src/session.ts` | retry-until-right reducer (`tried`) |
| `tools/seed/seed.test.ts` (new) | content checks: every word and greeting has Swedish; glosses unique |
| `data/seed/tier{1,2,3}.json` | gain `sv` |
| `apps/app/storage/greetings.ts` | `Greeting` gains `sv` |
| `apps/app/feedback.ts` | `say()` → Promise, voices per language, effects switch, persisted sound settings |
| `apps/app/i18n/strings.ts` (new) | every interface string, in three languages |
| `apps/app/i18n/language.tsx` (new) | `LanguageProvider`, `useLanguage()`, persistence, first-launch default |
| `apps/app/components/PromptWord.tsx` (new) | the word + sound-bars/speaker slot |
| `apps/app/components/FeedbackToast.tsx` (new) | the top toast |
| `apps/app/components/OptionButton.tsx` | `wrong-faded` state, meaning line, accessibility label |
| `apps/app/app/session.tsx` | the new answer loop |
| `apps/app/app/settings.tsx` (new) | language, sound, effects, about |
| `apps/app/app/(tabs)/_layout.tsx`, `index.tsx`, `stats.tsx`, `words.tsx`, `apps/app/components/Welcome.tsx`, `apps/app/app/_layout.tsx` | strings + language |

---

### Task 1: Languages and questions in core

**Files:**
- Create: `packages/core/src/language.ts`, `packages/core/src/language.test.ts`
- Modify: `packages/core/src/types.ts`, `packages/core/src/quiz.ts`, `packages/core/src/quiz.test.ts`, `packages/core/src/leitner.ts`, `packages/core/src/leitner.test.ts`, `packages/core/src/index.ts`
- Modify (fixtures only — add `sv`): `packages/core/src/migrate.test.ts`, `select.test.ts`, `stats.test.ts`, `session.test.ts`, `tools/store/fileStore.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (all exported from `@pepe/core`):
  - `type AppLanguage = 'sv' | 'en' | 'es'`, `type GlossLanguage = 'sv' | 'en'`
  - `APP_LANGUAGES: readonly AppLanguage[]`, `isAppLanguage(v: unknown): v is AppLanguage`
  - `glossLanguage(l: AppLanguage): GlossLanguage`, `gloss(w: Word, g: GlossLanguage): string`, `languageForLocale(tag: string): AppLanguage`
  - `Word.sv: string` (required)
  - `Direction = 'es->en' | 'en->es' | 'picture->es'` (no `listen->en`)
  - `buildQuestions(selected, pool, rng, glossLang: GlossLanguage = 'en'): Question[]`
  - `optionMeaning(direction, option, pool, glossLang: GlossLanguage = 'en'): string | null`
  - `type Spoken = 'es' | 'gloss'`, `promptSpoken(d: Direction): Spoken | null`, `optionSpoken(d: Direction): Spoken`

`es->en` / `en->es` keep their names: "en" now means "the gloss language". Renaming them would break phase 2's stored counters `rightEsToEn` / `rightEnToEs`.

- [ ] **Step 1: Write `language.test.ts`**

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  gloss, glossLanguage, isAppLanguage, languageForLocale,
} from './language.ts';
import type { Word } from './types.ts';

const w: Word = { id: 'el-libro', es: 'el libro', en: 'the book', sv: 'boken', pos: 'noun', tier: 1 };

describe('glossLanguage', () => {
  test('Swedish glosses in Swedish', () => assert.equal(glossLanguage('sv'), 'sv'));
  test('English glosses in English', () => assert.equal(glossLanguage('en'), 'en'));
  test('a Spanish interface keeps English glosses', () => assert.equal(glossLanguage('es'), 'en'));
});

describe('gloss', () => {
  test('picks the Swedish', () => assert.equal(gloss(w, 'sv'), 'boken'));
  test('picks the English', () => assert.equal(gloss(w, 'en'), 'the book'));
});

describe('languageForLocale', () => {
  test('Swedish device → sv', () => assert.equal(languageForLocale('sv-SE'), 'sv'));
  test('bare language code', () => assert.equal(languageForLocale('sv'), 'sv'));
  test('underscore form', () => assert.equal(languageForLocale('es_MX'), 'es'));
  test('Spanish device → es', () => assert.equal(languageForLocale('es-419'), 'es'));
  test('anything else → en', () => {
    assert.equal(languageForLocale('nb-NO'), 'en');
    assert.equal(languageForLocale('en-GB'), 'en');
    assert.equal(languageForLocale(''), 'en');
  });
  test('case does not matter', () => assert.equal(languageForLocale('SV-se'), 'sv'));
});

describe('isAppLanguage', () => {
  test('accepts the three', () => {
    for (const l of ['sv', 'en', 'es']) assert.equal(isAppLanguage(l), true);
  });
  test('rejects anything else', () => {
    for (const v of ['de', '', null, undefined, 3]) assert.equal(isAppLanguage(v), false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test packages/core/src/language.test.ts`
Expected: FAIL — cannot find module `./language.ts`.

- [ ] **Step 3: Add `sv` to `Word` and drop listening from `Direction` in `types.ts`**

In `interface Word`, after `en`:

```ts
  /** Swedish: "boken". Required — a missing gloss must fail the build, not the round. */
  sv: string;
```

Replace the `Direction` line with:

```ts
/**
 * Which way a question is asked. "en" means the gloss language, which is
 * Swedish or English depending on the app language; the names predate that
 * and are kept because stored counters (rightEsToEn, rightEnToEs) use them.
 */
export type Direction = 'es->en' | 'en->es' | 'picture->es';
```

- [ ] **Step 4: Write `language.ts`**

```ts
import type { Word } from './types.ts';

/** The app's interface language. */
export type AppLanguage = 'sv' | 'en' | 'es';

/** The language glosses are shown in. A Spanish interface keeps English glosses. */
export type GlossLanguage = 'sv' | 'en';

export const APP_LANGUAGES: readonly AppLanguage[] = ['sv', 'en', 'es'];

export const isAppLanguage = (v: unknown): v is AppLanguage =>
  typeof v === 'string' && (APP_LANGUAGES as readonly string[]).includes(v);

export const glossLanguage = (l: AppLanguage): GlossLanguage => (l === 'sv' ? 'sv' : 'en');

export const gloss = (w: Word, g: GlossLanguage): string => (g === 'sv' ? w.sv : w.en);

/** First-launch default: a Swedish or Spanish device gets its own language, anything else English. */
export function languageForLocale(tag: string): AppLanguage {
  const code = tag.toLowerCase().split(/[-_]/)[0];
  if (code === 'sv') return 'sv';
  if (code === 'es') return 'es';
  return 'en';
}
```

Add `export * from './language.ts';` to `packages/core/src/index.ts`, after the `types.ts` line.

- [ ] **Step 5: Run `language.test.ts` and watch it pass**

Run: `node --test packages/core/src/language.test.ts`
Expected: PASS.

- [ ] **Step 6: Rewrite `quiz.test.ts` for gloss languages and no listening**

Replace the fixture helper at the top with:

```ts
const word = (id: string, pos: PartOfSpeech = 'noun'): Word => ({
  id, es: `es-${id}`, en: `en-${id}`, sv: `sv-${id}`, pos, tier: 1,
});
```

and update the import to `import { buildQuestions, grade, optionMeaning, optionSpoken, promptSpoken } from './quiz.ts';`.

Keep every test in `describe('buildQuestions')` as is, **plus** add at the end of that block:

```ts
  test('in Swedish, prompt and answer use the Swedish gloss', () => {
    const qs = buildQuestions(pool.slice(0, 10), pool, mulberry32(5), 'sv');
    for (const q of qs) {
      if (q.direction === 'en->es') {
        assert.equal(q.prompt, q.word.sv);
        assert.equal(q.answer, q.word.es);
      } else if (q.direction === 'es->en') {
        assert.equal(q.prompt, q.word.es);
        assert.equal(q.answer, q.word.sv);
        for (const o of q.options) assert.ok(o.startsWith('sv-'), `option "${o}" is not Swedish`);
      }
    }
  });

  test('defaults to English glosses', () => {
    assert.deepEqual(
      buildQuestions(pool.slice(0, 5), pool, mulberry32(8)),
      buildQuestions(pool.slice(0, 5), pool, mulberry32(8), 'en'),
    );
  });

  test('distinct options are judged in the gloss language', () => {
    // Two words whose Swedish collides must never both be offered.
    const twins = [
      { ...word('a'), sv: 'samma' },
      { ...word('b'), sv: 'samma' },
      ...pool.slice(0, 6),
    ];
    for (let seed = 1; seed < 30; seed++) {
      for (const q of buildQuestions([twins[0]!], twins, mulberry32(seed), 'sv')) {
        assert.equal(new Set(q.options).size, q.options.length);
      }
    }
  });
```

Replace the whole `describe('four question types', …)` block with:

```ts
describe('three question types', () => {
  const withSprites = pool.map((w, i) =>
    i % 3 === 0 ? { ...w, sprite: `vocab-${w.id}.png` } : w);

  test('a picture question shows art and is answered in Spanish', () => {
    const only = [{ ...word('taco'), sprite: 'vocab-taco.png' }];
    const qs = buildQuestions(only, [...only, ...pool], mulberry32(1));
    const q = qs[0]!;
    if (q.direction !== 'picture->es') return;     // mix may not pick it for one word
    assert.equal(q.promptImage, 'vocab-taco.png');
    assert.equal(q.prompt, '');
    assert.equal(q.answer, 'es-taco');
  });

  test('there are no listening-only questions', () => {
    for (let seed = 1; seed < 20; seed++) {
      const qs = buildQuestions(withSprites.slice(0, 10), withSprites, mulberry32(seed));
      for (const q of qs) {
        assert.ok(['es->en', 'en->es', 'picture->es'].includes(q.direction), q.direction);
      }
    }
  });

  test('over ten words the mix is 5 / 4 / 1', () => {
    const qs = buildQuestions(withSprites.slice(0, 10), withSprites, mulberry32(5));
    const count = (d: string) => qs.filter((q) => q.direction === d).length;
    assert.equal(count('picture->es'), 1);
    assert.equal(count('en->es'), 4);
    assert.equal(count('es->en'), 5);
  });

  test('a word with no art never gets a picture question', () => {
    const qs = buildQuestions(pool.slice(0, 10), pool, mulberry32(7));
    assert.equal(qs.filter((q) => q.direction === 'picture->es').length, 0);
  });

  test('picture options are still four distinct plausible words', () => {
    const qs = buildQuestions(withSprites.slice(0, 10), withSprites, mulberry32(9));
    for (const q of qs) {
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options).size, 4);
      assert.ok(q.options.includes(q.answer));
    }
  });
});

describe('what is spoken', () => {
  test('recognition speaks the Spanish prompt and the gloss options', () => {
    assert.equal(promptSpoken('es->en'), 'es');
    assert.equal(optionSpoken('es->en'), 'gloss');
  });
  test('production speaks the gloss prompt and the Spanish options', () => {
    assert.equal(promptSpoken('en->es'), 'gloss');
    assert.equal(optionSpoken('en->es'), 'es');
  });
  test('a picture says nothing on arrival and Spanish on a tap', () => {
    assert.equal(promptSpoken('picture->es'), null);
    assert.equal(optionSpoken('picture->es'), 'es');
  });
});
```

In `describe('optionMeaning')`, delete the test `'treats a listening question as answered in English'` and add:

```ts
  test('a Spanish option means its Swedish gloss in Swedish', () => {
    assert.equal(optionMeaning('en->es', 'es-a', words, 'sv'), 'sv-a');
  });

  test('a Swedish option means its Spanish', () => {
    assert.equal(optionMeaning('es->en', 'sv-b', words, 'sv'), 'es-b');
  });
```

- [ ] **Step 7: Run it and watch it fail**

Run: `node --test packages/core/src/quiz.test.ts`
Expected: FAIL — `optionSpoken`/`promptSpoken` are not exported, the mix test expects 5/4/1, and the Swedish tests get English.

- [ ] **Step 8: Rewrite `quiz.ts`**

Replace everything above `export function buildQuestions` with:

```ts
import type { Direction, Question, Rng, Word } from './types.ts';
import { gloss, type GlossLanguage } from './language.ts';
import { shuffle } from './rng.ts';

const OPTIONS_PER_QUESTION = 4;

/** Whether the learner answers with the gloss (rather than the Spanish). */
const answersInGloss = (d: Direction): boolean => d === 'es->en';

const solve = (w: Word, d: Direction, g: GlossLanguage): string =>
  answersInGloss(d) ? gloss(w, g) : w.es;

const show = (w: Word, d: Direction, g: GlossLanguage): string => {
  if (d === 'picture->es') return '';        // the art is the prompt
  return d === 'en->es' ? gloss(w, g) : w.es;
};

/** Which side of a question is read aloud. The screen maps 'gloss' to the gloss voice. */
export type Spoken = 'es' | 'gloss';

/** What is spoken when the question appears. A picture says nothing: the art is the question. */
export const promptSpoken = (d: Direction): Spoken | null =>
  d === 'picture->es' ? null : d === 'es->en' ? 'es' : 'gloss';

/** What is spoken when an option is tapped. */
export const optionSpoken = (d: Direction): Spoken =>
  answersInGloss(d) ? 'gloss' : 'es';

/**
 * Decide how each word is asked: roughly 50% recognition, 40% production,
 * 10% picture. Listening-only questions were dropped: every prompt is now
 * both shown and spoken, which makes a listen-only type redundant.
 *
 * Picture questions need art, so they are allocated first and only to words
 * that have it; a word without art falls through to the next type rather than
 * losing its slot.
 */
function planDirections(words: readonly Word[], rng: Rng): Direction[] {
  const n = words.length;
  const wantPicture = Math.round(n * 0.1);
  const wantProduce = Math.round(n * 0.4);

  const plan: Direction[] = new Array(n).fill('es->en');
  let pictures = 0;
  let produces = 0;

  for (const i of shuffle(words.map((_, idx) => idx), rng)) {
    const w = words[i]!;
    if (pictures < wantPicture && w.sprite) {
      plan[i] = 'picture->es';
      pictures += 1;
    } else if (produces < wantProduce) {
      plan[i] = 'en->es';
      produces += 1;
    }
  }
  return plan;
}
```

In `buildQuestions`, change the signature to

```ts
export function buildQuestions(
  selected: readonly Word[],
  pool: readonly Word[],
  rng: Rng,
  glossLang: GlossLanguage = 'en',
): Question[] {
```

and pass `glossLang` as the third argument to **every** `solve(…)` and `show(…)` call in its body (there are four `solve` calls and one `show`).

Replace `optionMeaning` with:

```ts
export function optionMeaning(
  direction: Direction,
  option: string,
  pool: readonly Word[],
  glossLang: GlossLanguage = 'en',
): string | null {
  for (const w of pool) {
    if (solve(w, direction, glossLang) === option) {
      return answersInGloss(direction) ? w.es : gloss(w, glossLang);
    }
  }
  return null;
}
```

Keep the existing doc comments on `buildQuestions` and `optionMeaning`.

- [ ] **Step 9: Update leitner for the removed direction**

In `packages/core/src/leitner.ts` replace the `answersInEnglish` line and its comment with:

```ts
/** Which counter a direction advances. Recognition reads Spanish; pictures are production. */
const answersInEnglish = (d: Direction): boolean => d === 'es->en';
```

In `leitner.test.ts` delete the test `'a listening answer counts as recognition'` (around line 104).

- [ ] **Step 10: Add `sv` to every other test fixture**

Each of these files builds `Word` literals with `en:`. Add a matching `sv` next to every `en`, using the same pattern as its `en` (e.g. `en: \`en-${id}\`` → add `sv: \`sv-${id}\``; a literal `en: 'the coat'` → add `sv: 'rocken'`, any non-empty string is fine):
`packages/core/src/migrate.test.ts`, `select.test.ts`, `stats.test.ts`, `session.test.ts`, `leitner.test.ts`, `tools/store/fileStore.test.ts`.

Find them with: `grep -n "en:" packages/core/src/*.test.ts tools/store/*.test.ts`

- [ ] **Step 11: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass. `typecheck` may report `apps/app/app/session.tsx` still referencing `'listen->en'` (in `TASK_LABEL` and two comparisons). Fix only those references in this task by deleting the `'listen->en'` entry from `TASK_LABEL` and replacing the two `question.direction === 'listen->en'` branches with `false`-free code: in the `useEffect` that speaks listening questions, delete the line `if (question && question.direction === 'listen->en') speak(question.word);`; in the prompt JSX, delete the `question.direction === 'listen->en' ? (<Speaker big … />) :` branch. Task 7 rewrites this file anyway; the goal here is only a green typecheck.

Also confirm nothing else mentions listening: `grep -rn "listen->en" packages tools apps/app --include='*.ts' --include='*.tsx'` → no hits (excluding `node_modules`).

- [ ] **Step 12: Commit**

```bash
git add packages/core/src/language.ts packages/core/src/language.test.ts packages/core/src/types.ts \
  packages/core/src/quiz.ts packages/core/src/quiz.test.ts packages/core/src/leitner.ts \
  packages/core/src/leitner.test.ts packages/core/src/index.ts packages/core/src/migrate.test.ts \
  packages/core/src/select.test.ts packages/core/src/stats.test.ts packages/core/src/session.test.ts \
  tools/store/fileStore.test.ts apps/app/app/session.tsx
git commit -m "Ask questions in the learner's gloss language, and drop listen-only questions"
```

---

### Task 2: Swedish content

**Files:**
- Create: `tools/seed/seed.test.ts`
- Modify: `data/seed/tier1.json`, `tier2.json`, `tier3.json`, `apps/app/storage/greetings.ts`
- Read: `docs/superpowers/plans/assets/2026-09-21-sv-glosses.json` (reviewed drafts: `{ [wordId]: sv }`, 384 entries)

**Interfaces:**
- Consumes: `Word.sv` (Task 1).
- Produces: every seed word has `sv`; `Greeting` is `{ es: string; en: string; sv: string }`.

- [ ] **Step 1: Write the content test `tools/seed/seed.test.ts`**

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fileStore, projectRoot } from '../store/fileStore.ts';
import { GREETINGS } from '../../apps/app/storage/greetings.ts';

const words = await fileStore(projectRoot).loadWords();
const norm = (s: string) => s.trim().toLowerCase();

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values.map(norm)) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

describe('seed words', () => {
  test('every word has a Swedish gloss', () => {
    const missing = words.filter((w) => typeof w.sv !== 'string' || w.sv.trim() === '');
    assert.deepEqual(missing.map((w) => w.id), []);
  });

  // Glosses are multiple-choice options. Two words sharing one would make a
  // question with two right answers that the app marks as one right, one wrong.
  for (const key of ['es', 'en', 'sv'] as const) {
    test(`no two words share a ${key} text`, () => {
      assert.deepEqual(duplicates(words.map((w) => w[key])), []);
    });
  }
});

describe('greetings', () => {
  test('every greeting has a Swedish gloss', () => {
    const missing = Object.values(GREETINGS).flat().filter((g) => !g.sv || g.sv.trim() === '');
    assert.deepEqual(missing.map((g) => g.es), []);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tools/seed/seed.test.ts`
Expected: FAIL — 384 words missing `sv`, and every greeting missing `sv`.

Also confirm the root test glob picks the new file up: `npm test 2>&1 | grep -c "seed words"` should print at least `1`. If it prints `0`, the glob `tools/**/*.test.ts` did not match — move the file to `tools/store/seed.test.ts` (fix the two import paths to `./fileStore.ts` and `../../apps/app/storage/greetings.ts`) and re-check.

- [ ] **Step 3: Merge the Swedish glosses into the seeds**

The seed files are one JSON object per line: `[{…},\n{…},\n…]\n`. Keep that format so the diff shows one changed line per word. Run from the repo root:

```bash
python3 - <<'EOF'
import json
from pathlib import Path

sv = json.loads(Path('docs/superpowers/plans/assets/2026-09-21-sv-glosses.json').read_text())

def dump(words):
    return '[' + ',\n'.join(json.dumps(w, ensure_ascii=False) for w in words) + ']\n'

for f in sorted(Path('data/seed').glob('tier*.json')):
    text = f.read_text()
    words = json.loads(text)
    assert dump(words) == text, f'{f}: writer would reformat the file; stop and adjust dump()'
    out = []
    for w in words:
        n = {}
        for k, v in w.items():
            n[k] = v
            if k == 'en':
                n['sv'] = sv[w['id']]
        out.append(n)
    f.write_text(dump(out))
    print(f, len(out))
EOF
```

Expected output: three lines, counts 141, 135, 108. If the assert fires, compare `dump(words)` with the file and adjust the separators until the round trip is exact **before** writing.

Then check the diff is only additions of `"sv": …`: `git diff --stat data/seed` shows each file with equal insertions and deletions (one per word).

- [ ] **Step 4: Give every greeting a Swedish gloss**

In `apps/app/storage/greetings.ts`, extend the interface:

```ts
export interface Greeting {
  /** What Pepe says. */
  es: string;
  /** The gloss underneath, for an A2 reader who has not met the slang yet. */
  en: string;
  /** The same gloss for a Swedish interface. */
  sv: string;
}
```

Then add `sv` to each of the greetings, after `en`, translating the **meaning** of the Spanish into natural, playful Swedish a child would enjoy. Keep them as short as the English. Rules: keep the joke (e.g. `'¿Y mi taco?'` → `'Var är min taco?'`); El Santo stays El Santo; lucha libre phrases translate literally (`'¡Máscara contra cabellera!'` → `'Mask mot hår!'`); no gendered address problems exist in Swedish, so translate directly. Examples to anchor the tone:

| es | sv |
|---|---|
| ¡Órale! | Hej! / Oj! |
| ¿Qué onda? | Läget? |
| ¡Qué padre! | Vad coolt! |
| ¡Échale ganas! | Ge järnet! |
| Cinco minutos más... | Fem minuter till... |
| Te extrañé. | Jag saknade dig. |

- [ ] **Step 5: Run the checks**

Run: `npm test && npm run typecheck`
Expected: all pass, including `tools/seed/seed.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add tools/seed/seed.test.ts data/seed/tier1.json data/seed/tier2.json data/seed/tier3.json apps/app/storage/greetings.ts
git commit -m "Swedish glosses for every word and greeting"
```

---

### Task 3: Retry until right, in the reducer

**Files:**
- Modify: `packages/core/src/session.ts`, `packages/core/src/session.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SessionState.tried: string[]` — the wrong options tapped on the current question, in tap order. Behaviour:
  - `answer` with a wrong option in `asking` or `repairing`: appends to `tried`, **stays** in that phase. If it is the first tap on the question and the phase is `asking`, records a wrong result and queues the question for repair.
  - `answer` with the right option: moves to `feedback` (from `asking`) or `repair-feedback` (from `repairing`) and sets `picked`. Records a right result only if it is the first tap and the phase is `asking`.
  - `answer` with an option already in `tried` → state unchanged (same object).
  - `next` in `asking`/`repairing` → state unchanged (the question is still open). Every transition clears `tried` and `picked`.
  - Repair never records and never re-queues.

- [ ] **Step 1: Replace `session.test.ts`**

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  startSession, reduce, currentQuestion, roundScore, sessionScore,
} from './session.ts';
import type { Question, Word } from './types.ts';

const word = (id: string): Word =>
  ({ id, es: `es-${id}`, en: `en-${id}`, sv: `sv-${id}`, pos: 'noun', tier: 1 });

const q = (id: string): Question => ({
  word: word(id),
  direction: 'es->en',
  prompt: `es-${id}`,
  options: [`en-${id}`, 'wrong-a', 'wrong-b', 'wrong-c'],
  answer: `en-${id}`,
});

const right = (question: Question, ms = 1200) =>
  ({ type: 'answer', option: question.answer, ms }) as const;
const wrong = (option = 'wrong-a', ms = 1200) => ({ type: 'answer', option, ms }) as const;
const next = () => ({ type: 'next' }) as const;

describe('startSession', () => {
  test('opens asking the first question, with nothing tried', () => {
    const s = startSession([q('a'), q('b')]);
    assert.equal(s.phase, 'asking');
    assert.equal(s.round, 1);
    assert.equal(currentQuestion(s)?.word.id, 'a');
    assert.deepEqual(s.results, []);
    assert.deepEqual(s.tried, []);
  });
});

describe('answering', () => {
  test('a right first tap moves to feedback and is recorded as right', () => {
    const qs = [q('a'), q('b')];
    const s = reduce(startSession(qs), right(qs[0]!));
    assert.equal(s.phase, 'feedback');
    assert.equal(s.picked, 'en-a');
    assert.deepEqual(s.results.map((r) => [r.wordId, r.correct]), [['a', true]]);
  });

  test('a wrong tap keeps the question open, records wrong, and queues repair', () => {
    const s = reduce(startSession([q('a'), q('b')]), wrong());
    assert.equal(s.phase, 'asking');
    assert.equal(s.picked, null);
    assert.deepEqual(s.tried, ['wrong-a']);
    assert.deepEqual(s.results.map((r) => [r.wordId, r.correct]), [['a', false]]);
    assert.deepEqual(s.repair.map((x) => x.word.id), ['a']);
  });

  test('right after wrong finishes the question but still counts as wrong', () => {
    const qs = [q('a'), q('b')];
    let s = reduce(startSession(qs), wrong());
    s = reduce(s, right(qs[0]!));
    assert.equal(s.phase, 'feedback');
    assert.equal(s.picked, 'en-a');
    assert.deepEqual(s.results.map((r) => [r.wordId, r.correct]), [['a', false]]);
  });

  test('several wrong taps record one result and queue repair once', () => {
    const qs = [q('a')];
    let s = startSession(qs);
    s = reduce(s, wrong('wrong-a'));
    s = reduce(s, wrong('wrong-b'));
    s = reduce(s, wrong('wrong-c'));
    s = reduce(s, right(qs[0]!));
    assert.equal(s.results.length, 1);
    assert.equal(s.repair.length, 1);
    assert.deepEqual(s.tried, ['wrong-a', 'wrong-b', 'wrong-c']);
  });

  test('tapping an option already tried changes nothing', () => {
    const once = reduce(startSession([q('a')]), wrong());
    const twice = reduce(once, wrong());
    assert.equal(twice, once);
  });

  test('response time is taken from the first tap', () => {
    const qs = [q('a')];
    let s = reduce(startSession(qs), wrong('wrong-a', 500));
    s = reduce(s, right(qs[0]!, 3000));
    assert.equal(s.results[0]?.ms, 500);
  });

  test('a tap during feedback is ignored', () => {
    const qs = [q('a'), q('b')];
    const once = reduce(startSession(qs), right(qs[0]!));
    const twice = reduce(once, wrong());
    assert.deepEqual(twice, once);
  });

  test('does not mutate the state it is given', () => {
    const before = startSession([q('a')]);
    reduce(before, wrong());
    assert.equal(before.phase, 'asking');
    assert.deepEqual(before.results, []);
    assert.deepEqual(before.tried, []);
  });
});

describe('advancing', () => {
  test('next is ignored while the question is still open', () => {
    const s = reduce(startSession([q('a'), q('b')]), wrong());
    assert.equal(reduce(s, next()), s);
  });

  test('next moves to the following question and clears what was tried', () => {
    const qs = [q('a'), q('b')];
    let s = reduce(startSession(qs), wrong());
    s = reduce(s, right(qs[0]!));
    s = reduce(s, next());
    assert.equal(s.phase, 'asking');
    assert.equal(currentQuestion(s)?.word.id, 'b');
    assert.deepEqual(s.tried, []);
    assert.equal(s.picked, null);
  });

  test('a clean round goes straight to the summary', () => {
    const qs = [q('a')];
    const s = reduce(reduce(startSession(qs), right(qs[0]!)), next());
    assert.equal(s.phase, 'summary');
    assert.equal(currentQuestion(s), null);
  });

  test('a round with misses goes to repair instead', () => {
    const qs = [q('a')];
    let s = reduce(startSession(qs), wrong());
    s = reduce(s, right(qs[0]!));
    s = reduce(s, next());
    assert.equal(s.phase, 'repairing');
    assert.equal(currentQuestion(s)?.word.id, 'a');
  });
});

describe('repair', () => {
  const intoRepair = () => {
    const qs = [q('a'), q('b')];
    let s = startSession(qs);
    s = reduce(s, wrong());            // miss a
    s = reduce(s, right(qs[0]!));
    s = reduce(s, next());
    s = reduce(s, right(qs[1]!));      // get b
    s = reduce(s, next());             // -> repairing
    return { s, qs };
  };

  test('repair taps are NOT recorded — being told is not recall', () => {
    let { s, qs } = intoRepair();
    assert.equal(s.phase, 'repairing');
    const before = s.results.length;

    s = reduce(s, wrong());
    assert.equal(s.phase, 'repairing');
    assert.deepEqual(s.tried, ['wrong-a']);
    assert.equal(s.results.length, before, 'a wrong repair tap must not add a result');
    assert.equal(s.repair.length, 1, 'a wrong repair tap must not re-queue');

    s = reduce(s, right(qs[0]!));
    assert.equal(s.phase, 'repair-feedback');
    assert.equal(s.results.length, before, 'a right repair tap must not add a result');
    assert.deepEqual(sessionScore(s), { right: 1, total: 2 });
  });

  test('repair walks every miss, then reaches the summary', () => {
    const qs = [q('a'), q('b')];
    let s = startSession(qs);
    s = reduce(s, wrong()); s = reduce(s, right(qs[0]!)); s = reduce(s, next());
    s = reduce(s, wrong()); s = reduce(s, right(qs[1]!)); s = reduce(s, next());
    assert.equal(s.phase, 'repairing');
    assert.equal(currentQuestion(s)?.word.id, 'a');

    s = reduce(s, right(qs[0]!)); s = reduce(s, next());
    assert.equal(currentQuestion(s)?.word.id, 'b');
    assert.deepEqual(s.tried, []);

    s = reduce(s, right(qs[1]!)); s = reduce(s, next());
    assert.equal(s.phase, 'summary');
  });
});

describe('another round', () => {
  test('resets the queue but keeps what you already answered', () => {
    const qs = [q('a')];
    let s = reduce(reduce(startSession(qs), right(qs[0]!)), next());
    s = reduce(s, { type: 'anotherRound', questions: [q('c'), q('d')] });

    assert.equal(s.phase, 'asking');
    assert.equal(s.round, 2);
    assert.equal(currentQuestion(s)?.word.id, 'c');
    assert.equal(s.results.length, 1, 'earlier answers survive');
    assert.deepEqual(s.repair, []);
    assert.deepEqual(s.tried, []);
  });

  test('roundScore counts this round, sessionScore counts everything', () => {
    const qs = [q('a')];
    let s = reduce(reduce(startSession(qs), right(qs[0]!)), next());
    s = reduce(s, { type: 'anotherRound', questions: [q('c')] });
    s = reduce(s, wrong());

    assert.deepEqual(roundScore(s), { right: 0, total: 1 });
    assert.deepEqual(sessionScore(s), { right: 1, total: 2 });
  });

  test('is ignored mid-repair, so pending repairs are never silently dropped', () => {
    const qs = [q('a'), q('b')];
    let s = startSession(qs);
    s = reduce(s, wrong()); s = reduce(s, right(qs[0]!)); s = reduce(s, next());
    s = reduce(s, right(qs[1]!)); s = reduce(s, next());
    assert.equal(s.phase, 'repairing');

    const before = { phase: s.phase, repair: s.repair, round: s.round };
    s = reduce(s, { type: 'anotherRound', questions: [q('c'), q('d')] });
    assert.deepEqual(s.phase, before.phase, 'should stay repairing');
    assert.deepEqual(s.repair, before.repair, 'repair queue must be preserved');
    assert.equal(s.round, before.round, 'round must not change');
  });

  test('is ignored after finishing, so finished is terminal', () => {
    const s = reduce(startSession([q('a')]), { type: 'finish' });
    assert.equal(s.phase, 'finished');
    const s2 = reduce(s, { type: 'anotherRound', questions: [q('b')] });
    assert.equal(s2.phase, 'finished');
    assert.equal(s2.round, 1);
  });
});

describe('finishing', () => {
  test('finish ends the session', () => {
    const s = reduce(startSession([q('a')]), { type: 'finish' });
    assert.equal(s.phase, 'finished');
    assert.equal(currentQuestion(s), null);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test packages/core/src/session.test.ts`
Expected: FAIL — `tried` is undefined and a wrong tap moves to `feedback`.

- [ ] **Step 3: Implement in `session.ts`**

Update the file's top doc comment: after "Miss one and it joins the repair queue…" add the sentence: `A question stays open until the right option is tapped; only the first tap is recorded, so a word found by elimination still counts as missed.`

In `SessionState`, after `picked`:

```ts
  /** Wrong options tapped on the current question, in order. They stay locked. */
  tried: string[];
```

Add `tried: [],` to the object returned by `startSession`, to the `anotherRound` case, and to the `finish` case (`return { ...state, phase: 'finished', picked: null, tried: [] };`).

Replace `answer` with:

```ts
function answer(state: SessionState, option: string, ms: number): SessionState {
  const question = currentQuestion(state);
  if (question === null) return state;
  if (state.phase !== 'asking' && state.phase !== 'repairing') return state;
  if (state.tried.includes(option)) return state;

  const correct = option === question.answer;
  // Only the first tap on a question is recall. Repair records nothing at all.
  const firstTap = state.tried.length === 0;
  const records = state.phase === 'asking' && firstTap;

  const results = records
    ? [...state.results, {
        wordId: question.word.id,
        direction: question.direction,
        correct,
        ms,
        round: state.round,
      }]
    : state.results;
  const repair = records && !correct ? [...state.repair, question] : state.repair;

  if (!correct) {
    return { ...state, tried: [...state.tried, option], results, repair };
  }
  return {
    ...state,
    phase: state.phase === 'asking' ? 'feedback' : 'repair-feedback',
    picked: option,
    results,
    repair,
  };
}
```

In `advance`, add `tried: []` to **every** returned object that changes phase (four places: next question, into repairing, into summary from feedback, and both returns in the repair branch). The final `return state;` stays as is.

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test packages/core/src/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass. (The old session screen still compiles: it never reads `tried`.)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/session.ts packages/core/src/session.test.ts
git commit -m "Keep a question open until the right tap, counting only the first"
```

---

### Task 4: Speech that says when it is done, and the effects switch

**Files:**
- Modify: `apps/app/feedback.ts`, `apps/app/app/_layout.tsx` (one line)

**Interfaces:**
- Consumes: nothing new.
- Produces (exports of `apps/app/feedback.ts`):
  - `type Voice = 'es' | 'sv' | 'en'`
  - `say(text: string, voice: Voice): Promise<void>` — resolves when the utterance ends, is stopped, fails, is superseded by another `say`, or after `1500 + 80 × text.length` ms. Resolves immediately when muted or when the device has no voice for that language.
  - `stopSpeaking(): void` — stops speech and resolves any pending `say`.
  - `speak(word: { es: string }): void` — unchanged behaviour, now `void say(word.es, 'es')`.
  - `canSpeak(voice: Voice = 'es'): boolean`
  - `cue(name)` — silent **and without haptics** when effects are off.
  - `loadSoundSettings(): Promise<void>`, `saveMuted(next: boolean): Promise<void>`, `isMuted(): boolean`, `setMuted(next: boolean): void`, `saveEffects(next: boolean): Promise<void>`, `effectsOn(): boolean`
  - `prepareAudio()`, `prepareSpeech()` unchanged in signature.

- [ ] **Step 1: Rewrite `apps/app/feedback.ts`**

Keep `SOURCES`, `HAPTIC`, `players`, `attempt` and `prepareAudio` exactly as they are. Replace the rest so the whole file reads:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

const MUTE_KEY = 'pepe-habla/muted/v1';
const EFFECTS_KEY = 'pepe-habla/effects/v1';

export type CueName = 'tap' | 'correct' | 'wrong' | 'complete' | 'streak' | 'levelup';

/* … SOURCES, HAPTIC, players, attempt, prepareAudio: unchanged … */

let muted = false;
/**
 * Sound effects and haptics, separately from the voice. A learner who hates
 * being buzzed at for a mistake would otherwise mute everything, and lose the
 * pronunciation along with the judgement.
 */
let effects = true;

export function cue(name: CueName): void {
  if (!effects) return;                  // the effects switch silences touch too
  attempt(HAPTIC[name]);                 // haptics ignore the mute switch
  if (muted) return;
  const player = players[name];
  if (!player) return;
  attempt(() => player.seekTo(0).then(() => player.play()));
}

/**
 * Pronunciation, in three languages.
 *
 * Spanish is always Spanish; Swedish and English read the glosses. For each,
 * the best device voice for that language, or silence. Silence is deliberate:
 * a device with no Swedish voice would read Swedish with an English mouth, and
 * teaching a wrong pronunciation is worse than teaching none.
 */
export type Voice = 'es' | 'sv' | 'en';

const LOCALE: Record<Voice, string> = { es: 'es-MX', sv: 'sv-SE', en: 'en-US' };

function rankVoice(want: Voice, v: { language: string; quality?: string }): number {
  const lang = v.language.toLowerCase().replace('_', '-');
  let score = 0;
  if (want === 'es') {
    if (lang.startsWith('es-mx')) score = 100;
    else if (lang.startsWith('es-419') || /^es-(ar|co|cl|pe|us)/.test(lang)) score = 60;
    else if (lang.startsWith('es')) score = 30;
  } else if (want === 'sv') {
    if (lang.startsWith('sv-se')) score = 100;
    else if (lang.startsWith('sv')) score = 60;
  } else {
    if (lang.startsWith('en-us')) score = 100;
    else if (lang.startsWith('en-gb')) score = 90;
    else if (lang.startsWith('en')) score = 50;
  }
  // Between two voices with the same accent, the enhanced one is far less robotic.
  return score > 0 && v.quality === 'Enhanced' ? score + 5 : score;
}

const voices: Record<Voice, string | null> = { es: null, sv: null, en: null };
let voicesChecked = false;
let speechReady: Promise<void> | null = null;

/** Called once at startup, after prepareAudio. */
export function prepareSpeech(): Promise<void> {
  speechReady = (async () => {
    try {
      const all = await Speech.getAvailableVoicesAsync();
      for (const want of Object.keys(voices) as Voice[]) {
        const best = all
          .map((v) => ({ v, score: rankVoice(want, v) }))
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)[0];
        voices[want] = best ? best.v.identifier : null;
      }
    } catch {
      for (const want of Object.keys(voices) as Voice[]) voices[want] = null;
    } finally {
      voicesChecked = true;
    }
  })();
  return speechReady;
}

/** False when this device has no voice for the language. */
export function canSpeak(voice: Voice = 'es'): boolean {
  return voicesChecked && voices[voice] !== null;
}

/** Resolves the utterance in flight, if any. Only one voice speaks at a time. */
let finishCurrent: (() => void) | null = null;

/**
 * Speak, and say when you are done.
 *
 * The answer loop chains on this — word first, then the right/wrong cue — so
 * it must always resolve: on done, on stop, on error, when another `say`
 * replaces it, and after a guard timeout in case the platform never calls back.
 */
export function say(text: string, voice: Voice): Promise<void> {
  finishCurrent?.();
  if (muted || text.length === 0) return Promise.resolve();

  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      if (finishCurrent === finish) finishCurrent = null;
      resolve();
    };
    const guard = setTimeout(finish, 1500 + 80 * text.length);
    finishCurrent = finish;

    (speechReady ?? Promise.resolve())
      .then(async () => {
        if (done) return;
        const id = voices[voice];
        if (id === null) { finish(); return; }      // no voice: silence
        await Speech.stop();
        if (done) return;
        Speech.speak(text, {
          language: LOCALE[voice],
          voice: id,
          rate: 0.95,
          pitch: 1.0,
          onDone: finish,
          onStopped: finish,
          onError: finish,
        });
      })
      .catch(finish);
  });
}

/** Fire-and-forget Spanish, for the word list. */
export function speak(word: { es: string }): void {
  void say(word.es, 'es');
}

export function stopSpeaking(): void {
  finishCurrent?.();
  attempt(() => Speech.stop());
}

export function setMuted(next: boolean): void {
  muted = next;
  if (next) stopSpeaking();
}

export function isMuted(): boolean {
  return muted;
}

export function effectsOn(): boolean {
  return effects;
}

/** Called once at startup, before the first cue. */
export async function loadSoundSettings(): Promise<void> {
  try {
    const [m, e] = await Promise.all([
      AsyncStorage.getItem(MUTE_KEY),
      AsyncStorage.getItem(EFFECTS_KEY),
    ]);
    muted = m === 'true';
    effects = e !== 'false';
  } catch {
    muted = false;
    effects = true;
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

export async function saveEffects(next: boolean): Promise<void> {
  effects = next;
  try {
    await AsyncStorage.setItem(EFFECTS_KEY, String(next));
  } catch {
    // As above.
  }
}
```

Check `expo-speech`'s `SpeechOptions` in the SDK 57 docs (`https://docs.expo.dev/versions/v57.0.0/sdk/speech/`) for the exact callback names (`onDone`, `onStopped`, `onError`) and the `Voice.quality` value (`'Enhanced'`); adjust if the docs differ.

- [ ] **Step 2: Load the settings at startup**

In `apps/app/app/_layout.tsx`, import `loadSoundSettings` alongside `prepareAudio, prepareSpeech`, and change the effect to:

```ts
  useEffect(() => { void prepareAudio(); void prepareSpeech(); void loadSoundSettings(); }, []);
```

- [ ] **Step 3: Check callers still compile**

Run: `npm test && npm run typecheck`
Expected: pass. `words.tsx` calls `canSpeak()` and `speak(item.word)`; `session.tsx` calls `speak(question.word)` and `cue(…)` — all still valid.

- [ ] **Step 4: Commit**

```bash
git add apps/app/feedback.ts apps/app/app/_layout.tsx
git commit -m "Speak Swedish and English too, say when speech ends, and let effects be switched off"
```

---

### Task 5: Interface strings and the language provider

**Files:**
- Create: `apps/app/i18n/strings.ts`, `apps/app/i18n/language.tsx`
- Modify: `apps/app/app/_layout.tsx`, `apps/app/components/Welcome.tsx`, `apps/app/package.json` (via `npx expo install`)

**Interfaces:**
- Consumes: `AppLanguage`, `GlossLanguage`, `glossLanguage`, `languageForLocale`, `isAppLanguage` from `@pepe/core`.
- Produces:
  - `STRINGS: Record<AppLanguage, Strings>`, `interface Strings` (shape below), `LANGUAGE_CHOICES`.
  - `<LanguageProvider>` and `useLanguage(): { language: AppLanguage; gloss: GlossLanguage; t: Strings; ready: boolean; setLanguage(l: AppLanguage): void }`.

- [ ] **Step 1: Install expo-localization**

Run from `apps/app`: `npx expo install expo-localization`
Expected: `apps/app/package.json` gains `"expo-localization": "~57.x.x"`. Read `https://docs.expo.dev/versions/v57.0.0/sdk/localization/` and confirm `getLocales()` returns objects with `languageTag` (e.g. `"sv-SE"`). If network is unavailable, stop and report — do not hand-edit the version.

- [ ] **Step 2: Write `apps/app/i18n/strings.ts`**

```ts
import type { AppLanguage } from '@pepe/core';

/**
 * Every word of interface copy, in each app language.
 *
 * An interface rather than a loose object, so a key missing from one language
 * is a compile error instead of a blank label. Pepe's own lines — ¡Vamos!,
 * the greetings — stay Spanish in every language: they are his voice.
 */
export interface Strings {
  tabs: { home: string; progress: string; words: string; settings: string };
  home: {
    waiting: (due: number) => string;
    caughtUp: string;
    level: string;
    known: string;
    due: string;
    total: string;
  };
  session: {
    exit: string;
    task: { recognise: string; produce: string; picture: string; repair: string };
    listenAgain: string;
    tryAgain: string;
    correct: string;
    tapToContinue: string;
  };
  summary: {
    title: string;
    firstTry: (right: number, total: number) => string;
    wholeSession: (right: number, total: number) => string;
    toReview: string;
    backTomorrow: string;
    anotherRound: string;
    doneForToday: string;
  };
  stats: {
    title: string;
    streakLabel: (days: number) => string;
    streakDays: (days: number) => string;
    streakCaption: (days: number) => string;
    known: string;
    thisWeek: string;
    accuracy: string;
    vocabulary: string;
    practisedOf: (practised: number, total: number) => string;
    knownAndDue: (known: number, due: number) => string;
    tricky: string;
    trickyHint: string;
    emptyTitle: string;
    emptyBody: string;
    photoLabel: string;
    photoTitle: string;
    photoCaption: string;
  };
  words: {
    title: string;
    practisedOf: (practised: number, total: number) => string;
    filter: { all: string; due: string; known: string; tricky: string };
    emptyNone: string;
    emptyFilter: string;
    listen: (es: string) => string;
  };
  settings: {
    title: string;
    language: string;
    languageHint: string;
    sound: string;
    soundHint: string;
    effects: string;
    effectsHint: string;
    about: (words: number) => string;
    back: string;
  };
}

const es: Strings = {
  tabs: { home: 'Inicio', progress: 'Progreso', words: 'Palabras', settings: 'Ajustes' },
  home: {
    waiting: (n) => `¡Órale! Tienes ${n} ${n === 1 ? 'palabra esperándote' : 'palabras esperándote'}.`,
    caughtUp: 'Todo al día. ¿Quieres aprender palabras nuevas?',
    level: 'NIVEL 1',
    known: 'CONOCIDAS',
    due: 'POR REPASAR',
    total: 'EN TOTAL',
  },
  session: {
    exit: 'Salir de la ronda',
    task: {
      recognise: 'ESCOGE LA TRADUCCIÓN',
      produce: '¿CÓMO SE DICE?',
      picture: '¿QUÉ ES ESTO?',
      repair: 'OTRA VEZ, SIN PRISA',
    },
    listenAgain: 'Escuchar otra vez',
    tryAgain: '¡Otra vez!',
    correct: '¡Eso es!',
    tapToContinue: 'Toca en cualquier parte para seguir',
  },
  summary: {
    title: '¡Bien hecho!',
    firstTry: (r, t) => `${r} de ${t} correctas al primer intento`,
    wholeSession: (r, t) => `${r} de ${t} en toda la sesión`,
    toReview: 'PARA REPASAR',
    backTomorrow: 'Vuelven mañana.',
    anotherRound: '¿Otra ronda?',
    doneForToday: 'Terminar por hoy',
  },
  stats: {
    title: 'Progreso',
    streakLabel: (d) => (d === 0 ? 'Sin racha todavía. Empieza hoy.' : `Racha de ${d} ${d === 1 ? 'día' : 'días'}`),
    streakDays: (d) => `${d} ${d === 1 ? 'día' : 'días'}`,
    streakCaption: (d) => (d === 0 ? 'Empieza hoy' : d === 1 ? 'seguido' : 'seguidos'),
    known: 'CONOCIDAS',
    thisWeek: 'ESTA SEMANA',
    accuracy: 'PRECISIÓN',
    vocabulary: 'Tu vocabulario',
    practisedOf: (p, t) => `${p} de ${t} palabras practicadas`,
    knownAndDue: (k, d) => `${k} conocidas · ${d} por repasar hoy`,
    tricky: 'Se te atragantan',
    trickyHint: 'Las que más fallas. Aquí está tu cuello de botella.',
    emptyTitle: 'Todavía nada que mostrar',
    emptyBody: 'Juega una ronda y aquí verás lo que sabes.',
    photoLabel: 'Fotografía del Pepe real, echado en el suelo',
    photoTitle: 'El Pepe de verdad',
    photoCaption: 'Perro callejero, Ciudad de México',
  },
  words: {
    title: 'Palabras',
    practisedOf: (p, t) => `${p} practicadas de ${t}`,
    filter: { all: 'Todas', due: 'Por repasar', known: 'Conocidas', tricky: 'Se te atragantan' },
    emptyNone: 'Todavía no has practicado ninguna palabra.',
    emptyFilter: 'Nada aquí por ahora.',
    listen: (w) => `Escuchar ${w}`,
  },
  settings: {
    title: 'Ajustes',
    language: 'Idioma',
    languageHint: 'El idioma de la app y de las traducciones.',
    sound: 'Sonido',
    soundHint: 'La vibración sigue funcionando aunque lo apagues.',
    effects: 'Efectos y vibración',
    effectsHint: 'Los sonidos de acierto y error. La voz siempre se oye.',
    about: (n) => `${n} palabras en español mexicano. Pepe es un perro callejero de la Ciudad de México.`,
    back: 'Volver',
  },
};

const sv: Strings = {
  tabs: { home: 'Hem', progress: 'Framsteg', words: 'Ord', settings: 'Inställningar' },
  home: {
    waiting: (n) => `¡Órale! Du har ${n} ord som väntar.`,
    caughtUp: 'Allt är klart. Vill du lära dig nya ord?',
    level: 'NIVÅ 1',
    known: 'KÄNDA',
    due: 'ATT REPETERA',
    total: 'TOTALT',
  },
  session: {
    exit: 'Avsluta rundan',
    task: {
      recognise: 'VÄLJ ÖVERSÄTTNINGEN',
      produce: 'HUR SÄGER MAN?',
      picture: 'VAD ÄR DETTA?',
      repair: 'EN GÅNG TILL, I LUGN OCH RO',
    },
    listenAgain: 'Lyssna igen',
    tryAgain: 'Försök igen!',
    correct: 'Helt rätt!',
    tapToContinue: 'Tryck var som helst för att fortsätta',
  },
  summary: {
    title: 'Bra jobbat!',
    firstTry: (r, t) => `${r} av ${t} rätt på första försöket`,
    wholeSession: (r, t) => `${r} av ${t} under hela passet`,
    toReview: 'ATT REPETERA',
    backTomorrow: 'De kommer tillbaka i morgon.',
    anotherRound: 'En runda till?',
    doneForToday: 'Klart för idag',
  },
  stats: {
    title: 'Framsteg',
    streakLabel: (d) => (d === 0 ? 'Ingen svit än. Börja i dag.' : `En svit på ${d} ${d === 1 ? 'dag' : 'dagar'}`),
    streakDays: (d) => `${d} ${d === 1 ? 'dag' : 'dagar'}`,
    streakCaption: (d) => (d === 0 ? 'Börja i dag' : 'i rad'),
    known: 'KÄNDA',
    thisWeek: 'DENNA VECKA',
    accuracy: 'TRÄFFSÄKERHET',
    vocabulary: 'Ditt ordförråd',
    practisedOf: (p, t) => `${p} av ${t} ord övade`,
    knownAndDue: (k, d) => `${k} kända · ${d} att repetera i dag`,
    tricky: 'Svåra ord',
    trickyHint: 'De du missar oftast. Här sitter flaskhalsen.',
    emptyTitle: 'Inget att visa än',
    emptyBody: 'Spela en runda så ser du här vad du kan.',
    photoLabel: 'Foto av den riktiga Pepe som ligger på marken',
    photoTitle: 'Den riktiga Pepe',
    photoCaption: 'Gatuhund, Mexico City',
  },
  words: {
    title: 'Ord',
    practisedOf: (p, t) => `${p} av ${t} övade`,
    filter: { all: 'Alla', due: 'Att repetera', known: 'Kända', tricky: 'Svåra' },
    emptyNone: 'Du har inte övat på något ord än.',
    emptyFilter: 'Inget här just nu.',
    listen: (w) => `Lyssna på ${w}`,
  },
  settings: {
    title: 'Inställningar',
    language: 'Språk',
    languageHint: 'Appens språk och översättningarna i frågorna.',
    sound: 'Ljud',
    soundHint: 'Vibrationen fungerar även när ljudet är av.',
    effects: 'Ljudeffekter och vibration',
    effectsHint: 'Pling när det är rätt, surr när det är fel. Rösten hörs alltid.',
    about: (n) => `${n} ord på mexikansk spanska. Pepe är en gatuhund från Mexico City.`,
    back: 'Tillbaka',
  },
};

const en: Strings = {
  tabs: { home: 'Home', progress: 'Progress', words: 'Words', settings: 'Settings' },
  home: {
    waiting: (n) => `¡Órale! You have ${n} ${n === 1 ? 'word' : 'words'} waiting.`,
    caughtUp: 'All caught up. Want to learn some new words?',
    level: 'LEVEL 1',
    known: 'KNOWN',
    due: 'TO REVIEW',
    total: 'IN TOTAL',
  },
  session: {
    exit: 'Leave the round',
    task: {
      recognise: 'PICK THE TRANSLATION',
      produce: 'HOW DO YOU SAY IT?',
      picture: 'WHAT IS THIS?',
      repair: 'ONE MORE TIME, NO RUSH',
    },
    listenAgain: 'Listen again',
    tryAgain: 'Try again!',
    correct: "That's it!",
    tapToContinue: 'Tap anywhere to continue',
  },
  summary: {
    title: 'Well done!',
    firstTry: (r, t) => `${r} of ${t} right first time`,
    wholeSession: (r, t) => `${r} of ${t} across the whole session`,
    toReview: 'TO REVIEW',
    backTomorrow: 'They come back tomorrow.',
    anotherRound: 'Another round?',
    doneForToday: 'Done for today',
  },
  stats: {
    title: 'Progress',
    streakLabel: (d) => (d === 0 ? 'No streak yet. Start today.' : `A ${d}-day streak`),
    streakDays: (d) => `${d} ${d === 1 ? 'day' : 'days'}`,
    streakCaption: (d) => (d === 0 ? 'Start today' : 'in a row'),
    known: 'KNOWN',
    thisWeek: 'THIS WEEK',
    accuracy: 'ACCURACY',
    vocabulary: 'Your vocabulary',
    practisedOf: (p, t) => `${p} of ${t} words practised`,
    knownAndDue: (k, d) => `${k} known · ${d} to review today`,
    tricky: 'Tricky words',
    trickyHint: 'The ones you miss most. This is your bottleneck.',
    emptyTitle: 'Nothing to show yet',
    emptyBody: 'Play a round and you will see what you know here.',
    photoLabel: 'Photo of the real Pepe, lying on the ground',
    photoTitle: 'The real Pepe',
    photoCaption: 'Street dog, Mexico City',
  },
  words: {
    title: 'Words',
    practisedOf: (p, t) => `${p} of ${t} practised`,
    filter: { all: 'All', due: 'To review', known: 'Known', tricky: 'Tricky' },
    emptyNone: 'You have not practised any words yet.',
    emptyFilter: 'Nothing here for now.',
    listen: (w) => `Listen to ${w}`,
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    languageHint: 'The app language and the translations in questions.',
    sound: 'Sound',
    soundHint: 'Vibration still works when sound is off.',
    effects: 'Sound effects and vibration',
    effectsHint: 'The right and wrong sounds. The voice is always heard.',
    about: (n) => `${n} words of Mexican Spanish. Pepe is a street dog from Mexico City.`,
    back: 'Back',
  },
};

export const STRINGS: Record<AppLanguage, Strings> = { sv, en, es };

/**
 * The language picker's rows. Each is written in its own language, never the
 * current one, so a learner who picks the wrong one can still find the way back.
 */
export const LANGUAGE_CHOICES: readonly { id: AppLanguage; name: string; detail: string }[] = [
  { id: 'sv', name: 'Svenska', detail: 'Frågor på svenska' },
  { id: 'en', name: 'English', detail: 'Questions in English' },
  { id: 'es', name: 'Español', detail: 'Todo en español · preguntas en inglés' },
];
```

- [ ] **Step 3: Write `apps/app/i18n/language.tsx`**

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import {
  glossLanguage, isAppLanguage, languageForLocale,
  type AppLanguage, type GlossLanguage,
} from '@pepe/core';
import { STRINGS, type Strings } from './strings';

const KEY = 'pepe-habla/language/v1';

interface LanguageState {
  language: AppLanguage;
  /** The language glosses are shown and spoken in. */
  gloss: GlossLanguage;
  t: Strings;
  /** False until the stored choice has been read, so nothing flashes in the wrong language. */
  ready: boolean;
  setLanguage: (next: AppLanguage) => void;
}

const Ctx = createContext<LanguageState | null>(null);

function deviceLanguage(): AppLanguage {
  try {
    return languageForLocale(getLocales()[0]?.languageTag ?? 'en');
  } catch {
    return 'en';
  }
}

/**
 * The app language, for every screen at once.
 *
 * A context rather than a module variable, so changing it in settings
 * re-renders the tabs behind the settings screen immediately.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setState] = useState<AppLanguage>(deviceLanguage);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((stored) => { if (alive && isAppLanguage(stored)) setState(stored); })
      .catch(() => {})
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  const value = useMemo<LanguageState>(() => ({
    language,
    gloss: glossLanguage(language),
    t: STRINGS[language],
    ready,
    setLanguage: (next) => {
      setState(next);
      AsyncStorage.setItem(KEY, next).catch(() => {});
    },
  }), [language, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLanguage(): LanguageState {
  const value = useContext(Ctx);
  if (value === null) throw new Error('useLanguage() outside <LanguageProvider>');
  return value;
}
```

- [ ] **Step 4: Wrap the app, splash included**

In `apps/app/app/_layout.tsx`, import `{ LanguageProvider } from '../i18n/language'`. Both branches of `RootLayout` must return a `<LanguageProvider>` at the root, so it stays mounted (and keeps its state) when the splash hands over to the stack:

```tsx
  if (!ready || !held) {
    return (
      <LanguageProvider>
        <Welcome
          fontsReady={loaded}
          onShown={() => { /* unchanged body */ }}
        />
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <SafeAreaProvider>
        {/* unchanged StatusBar + Stack */}
      </SafeAreaProvider>
    </LanguageProvider>
  );
```

Keep the existing `onShown` body verbatim.

- [ ] **Step 5: Gloss the greeting in the app language**

In `apps/app/components/Welcome.tsx`: import `useLanguage` from `'../i18n/language'`; inside the component add `const { gloss, ready } = useLanguage();`; change the fade effect and the caption condition from `fontsReady` to `fontsReady && ready` (both places, including the effect's dependency array); render the gloss line as `{gloss === 'sv' ? greeting.sv : greeting.en}`. Rename the style `english` to `gloss` and its use.

- [ ] **Step 6: Check**

Run: `npm test && npm run typecheck`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add apps/app/i18n/strings.ts apps/app/i18n/language.tsx apps/app/app/_layout.tsx \
  apps/app/components/Welcome.tsx apps/app/package.json package-lock.json
git commit -m "Interface strings in Swedish, English and Spanish, with a language provider"
```

---

### Task 6: The answer-loop components

**Files:**
- Create: `apps/app/components/PromptWord.tsx`, `apps/app/components/FeedbackToast.tsx`
- Modify: `apps/app/components/OptionButton.tsx`

**Interfaces:**
- Consumes: `Pepe` (`pose`, `motion: 'still' | 'breathe' | 'hop' | 'shake' | 'celebrate'`, `size`), `PressableCard` (`face`, `depth`, `label`, `onPress`, `disabled`, `style`), theme tokens.
- Produces:
  - `<PromptWord text: string; playing: boolean; onPress: () => void; label: string />`
  - `type ToastKind = 'good' | 'bad'`; `<FeedbackToast kind: ToastKind; title: string; subtitle?: string; countdownMs?: number />` — absolutely positioned at the top of its parent; slides in on mount, out on unmount; when `countdownMs` is set, a bar along the bottom drains over that time.
  - `OptionState = 'idle' | 'correct' | 'wrong' | 'wrong-faded' | 'dimmed'`; `<OptionButton label state onPress disabled detail?: string />`.

- [ ] **Step 1: Write `PromptWord.tsx`**

```tsx
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colour, font } from '../theme';

/** The slot is fixed, so swapping bars for the icon never moves the word. */
const SLOT = 28;

function Bar({ delay, height }: { delay: number; height: number }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(0.45);

  useEffect(() => {
    if (reduced) { scale.value = 1; return; }
    scale.value = withDelay(delay, withRepeat(withSequence(
      withTiming(1, { duration: 450 }),
      withTiming(0.45, { duration: 450 }),
    ), -1));
    return () => cancelAnimation(scale);
  }, [reduced, delay, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));
  return (
    <Animated.View
      style={[{ width: 4, height, borderRadius: 2, backgroundColor: colour.marigold }, style]}
    />
  );
}

function SpeakerIcon() {
  return (
    <View style={{
      width: SLOT, height: SLOT, borderRadius: SLOT / 2, borderWidth: 2, borderColor: colour.muted,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Svg width={15} height={15} viewBox="0 0 24 24">
        <Path d="M4 9v6h4l5 4V5L8 9z" fill={colour.muted} />
        <Path d="M16.5 8.5a5 5 0 0 1 0 7" stroke={colour.muted} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      </Svg>
    </View>
  );
}

/**
 * The question's word, which is also its replay button.
 *
 * While the word is being spoken, three marigold bars pulse beside it; once it
 * has finished, a quiet outlined speaker takes their place. Word and icon are
 * one target, and a tap always restarts from the beginning.
 */
export function PromptWord({ text, playing, onPress, label }: {
  text: string;
  playing: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${text}`}
      hitSlop={8}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        minHeight: 56, paddingHorizontal: 10, borderRadius: 14,
      }}
    >
      <Text style={{
        fontFamily: font.displayHeavy, fontSize: 44, color: colour.ink,
        textAlign: 'center', flexShrink: 1,
      }}>
        {text}
      </Text>
      <View style={{ width: SLOT, height: SLOT, alignItems: 'center', justifyContent: 'center' }}>
        {playing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 22 }}>
            <Bar delay={0} height={10} />
            <Bar delay={150} height={20} />
            <Bar delay={300} height={14} />
          </View>
        ) : (
          <SpeakerIcon />
        )}
      </View>
    </Pressable>
  );
}
```

Confirm `useReducedMotion` is exported by the installed `react-native-reanimated` (4.x): `grep -rn "useReducedMotion" node_modules/react-native-reanimated/lib/typescript/index.d.ts` (or the package's `index.d.ts`). If it is not, use the `AccessibilityInfo` pattern from `components/Pepe.tsx` instead.

- [ ] **Step 2: Write `FeedbackToast.tsx`**

```tsx
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing, SlideInUp, SlideOutUp, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { colour, font, outline, radius, space } from '../theme';
import { Pepe } from './Pepe';
import { PressableCard } from './PressableCard';

export type ToastKind = 'good' | 'bad';

/**
 * Feedback that drops from the top of the screen instead of pushing the
 * answers up from the bottom. It floats over the progress bar and never takes
 * layout space, so the option under the learner's thumb stays where it is.
 *
 * Mount a fresh one (a new `key`) for each tap, so each one slides in again.
 */
export function FeedbackToast({ kind, title, subtitle, countdownMs }: {
  kind: ToastKind;
  title: string;
  subtitle?: string;
  countdownMs?: number;
}) {
  const good = kind === 'good';
  const left = useSharedValue(1);

  useEffect(() => {
    if (countdownMs !== undefined) {
      left.value = withTiming(0, { duration: countdownMs, easing: Easing.linear });
    }
  }, [countdownMs, left]);

  const drain = useAnimatedStyle(() => ({ width: `${left.value * 100}%` }));

  return (
    <Animated.View
      entering={SlideInUp.duration(240)}
      exiting={SlideOutUp.duration(200)}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={{ position: 'absolute', top: space.sm, left: space.md, right: space.md, zIndex: 20 }}
    >
      <PressableCard face={good ? colour.cactus : colour.chile} depth={4}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: space.md,
          paddingVertical: space.sm, paddingLeft: space.sm, paddingRight: space.lg,
          paddingBottom: countdownMs !== undefined || good ? space.lg : space.sm,
        }}>
          <View style={{ backgroundColor: colour.surface, borderRadius: 12, ...outline, padding: 2 }}>
            <Pepe pose={good ? 'happy' : 'sad'} motion={good ? 'hop' : 'shake'} size={54} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.display, fontSize: 22, color: colour.surface }}>{title}</Text>
            {subtitle !== undefined && (
              <Text style={{ fontFamily: font.body, fontSize: 14, color: colour.surface, opacity: 0.95, marginTop: 2 }}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        {countdownMs !== undefined && (
          <View style={{
            position: 'absolute', left: space.md, right: space.md, bottom: 7,
            height: 4, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden',
          }}>
            <Animated.View style={[{ height: '100%', backgroundColor: colour.surface }, drain]} />
          </View>
        )}
      </PressableCard>
    </Animated.View>
  );
}
```

The `rgba(255,255,255,0.3)` track is a translucent white, not a palette colour; it is the only exception and needs a one-line comment: `{/* translucent surface, so the track reads on either toast colour */}`.

- [ ] **Step 3: Extend `OptionButton.tsx`**

Replace the three maps and the component with:

```tsx
export type OptionState = 'idle' | 'correct' | 'wrong' | 'wrong-faded' | 'dimmed';

const FACE: Record<OptionState, string> = {
  idle: colour.surface,
  correct: colour.cactus,
  wrong: colour.chile,
  'wrong-faded': colour.chile,
  dimmed: colour.surface,
};

const TEXT: Record<OptionState, string> = {
  idle: colour.ink,
  correct: colour.surface,
  wrong: colour.surface,
  'wrong-faded': colour.surface,
  dimmed: colour.muted,
};

const MARK: Record<OptionState, string> = {
  idle: '', correct: '✓', wrong: '✕', 'wrong-faded': '✕', dimmed: '',
};

const FADED: ReadonlySet<OptionState> = new Set(['dimmed', 'wrong-faded']);

/**
 * One answer.
 *
 * Full width on purpose: a 350x56 row is a larger target than a grid cell and
 * gives one flush-left scan line rather than a Z-pattern across centred text,
 * and long words like "el medio ambiente" stay on one line.
 *
 * A wrong option stays red and shows what it actually means, so a miss
 * teaches two words; the old bottom sheet used to say this, and the short
 * toast no longer can.
 */
export function OptionButton({
  label, state, onPress, disabled, detail,
}: {
  label: string;
  state: OptionState;
  onPress: () => void;
  disabled: boolean;
  /** What a wrong option means, shown small beside it. */
  detail?: string;
}) {
  return (
    <PressableCard
      face={FACE[state]}
      onPress={disabled ? undefined : onPress}
      label={detail ? `${label}, ${detail}` : label}
      style={{ opacity: FADED.has(state) ? 0.45 : 1 }}
    >
      <View style={{
        minHeight: 56, paddingHorizontal: 18,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md,
      }}>
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 18, color: TEXT[state], flexShrink: 1 }}>
          {label}
          {detail !== undefined && (
            <Text style={{ fontFamily: font.body, fontSize: 14 }}>{`  = ${detail}`}</Text>
          )}
        </Text>
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 19, color: TEXT[state] }}>
          {MARK[state]}
        </Text>
      </View>
    </PressableCard>
  );
}
```

- [ ] **Step 4: Check**

Run: `npm test && npm run typecheck`
Expected: pass (the new components are not used yet; `OptionButton`'s existing call site still compiles because `detail` is optional).

- [ ] **Step 5: Commit**

```bash
git add apps/app/components/PromptWord.tsx apps/app/components/FeedbackToast.tsx apps/app/components/OptionButton.tsx
git commit -m "Prompt word with replay, top feedback toast, and wrong options that explain themselves"
```

---

### Task 7: The new answer loop on the session screen

**Files:**
- Modify: `apps/app/app/session.tsx`

**Interfaces:**
- Consumes: `reduce`/`SessionState.tried` (Task 3); `buildQuestions(…, glossLang)`, `optionMeaning(…, glossLang)`, `promptSpoken`, `optionSpoken`, `gloss` (Task 1); `say`, `stopSpeaking`, `cue`, `effectsOn`, `isMuted`, `type Voice` (Task 4); `useLanguage` (Task 5); `PromptWord`, `FeedbackToast`, `OptionButton` (Task 6).
- Produces: `buildRound(progress, today, round, glossLang, exclude?)` (was without `glossLang`).

Behaviour to implement, exactly (spec §4):

1. When a question appears (asking or repairing), its prompt is spoken once via `say(question.prompt, voice)` where voice is `'es'` if `promptSpoken` is `'es'`, the gloss language if `'gloss'`, and nothing for a picture. `playing` is true until that `say` resolves.
2. Tapping the prompt restarts it.
3. A tap on an option: bump a sequence counter, cancel timers, set `playing` false, `reduce` the answer, show the toast immediately (new `id` each tap), speak the option (`say(option, voice)` with `optionSpoken`), and **after** it resolves — only if no newer tap happened — play `cue('correct' | 'wrong')`.
4. Wrong: toast "try again" for `WRONG_TOAST_MS`, then hides (only if it is still the same toast). Option stays red, locked, with its meaning.
5. Right: toast with title `t.session.correct` and subtitle `"{es} = {gloss}"`. After the cue, wait `CUE_MS` (0 if effects are off or muted), then start the toast countdown and schedule `advance` after `ADVANCE_MS`.
6. While a right answer is showing, a full-screen transparent pressable over everything advances immediately.
7. `advance` clears timers, bumps the sequence, stops speech, hides the toast and dispatches `next`.
8. Leaving the screen stops speech and clears timers.

- [ ] **Step 1: Replace the imports, constants, `buildRound` and `Speaker`**

Delete the `Speaker` component and `TASK_LABEL`. Replace the top of the file down to (not including) `export default function Session()` with:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import {
  buildQuestions, bumpStreak, currentQuestion, gloss, mulberry32, optionMeaning,
  optionSpoken, promptSpoken, reduce, roundScore, seedFromDate, selectDaily,
  sessionScore, startSession, todayISO,
  type Direction, type GlossLanguage, type Progress, type Question, type SessionState,
  type Spoken, type Streak, type VocabDb,
} from '@pepe/core';
import { FeedbackToast, type ToastKind } from '../components/FeedbackToast';
import { OptionButton, type OptionState } from '../components/OptionButton';
import { Pepe } from '../components/Pepe';
import { PressableCard } from '../components/PressableCard';
import { PromptWord } from '../components/PromptWord';
import { Screen } from '../components/Screen';
import { cue, effectsOn, isMuted, say, stopSpeaking, type Voice } from '../feedback';
import { useLanguage } from '../i18n/language';
import type { Strings } from '../i18n/strings';
import { loadProgress, recordAnswers, saveProgress } from '../storage/progressStore';
import { loadStreak, saveStreak } from '../storage/streakStore';
import { VOCAB_ART, WORDS } from '../storage/vocabulary';
import { colour, font, radius, space } from '../theme';

const ROUND_SIZE = 10;
/** How long "try again" stays down. */
const WRONG_TOAST_MS = 2000;
/** The pause on a right answer before moving on, unless the learner taps. */
const ADVANCE_MS = 3000;
/** The right/wrong chimes last about 0.4 s; the countdown starts after one. */
const CUE_MS = 450;

export function buildRound(
  progress: Record<string, Progress>,
  today: string,
  round: number,
  glossLang: GlossLanguage,
  exclude: ReadonlySet<string> = new Set(),
): Question[] {
  // Seeded by the day so a round is reproducible, and by the round number so a
  // second round is not the same ten words again.
  const rng = mulberry32(seedFromDate(today) ^ (round * 0x9e3779b9));
  // Words already answered this session are out — the seed alone cannot
  // separate rounds when ten or fewer words are due, because then every due
  // word is selected no matter what the rng says.
  const pool = exclude.size === 0 ? WORDS : WORDS.filter((w) => !exclude.has(w.id));
  const selected = selectDaily(pool, progress, today, ROUND_SIZE, rng);
  return buildQuestions(selected, WORDS, rng, glossLang);
}

const voiceFor = (s: Spoken, g: GlossLanguage): Voice => (s === 'es' ? 'es' : g);

const taskLabel = (t: Strings, d: Direction): string =>
  d === 'es->en' ? t.session.task.recognise
    : d === 'en->es' ? t.session.task.produce
      : t.session.task.picture;

interface Toast { kind: ToastKind; id: number; countdown: boolean }
```

(`Streak` and `VocabDb` move into the main import; delete the old separate `import type { Streak, VocabDb } from '@pepe/core';` line and the old imports of `speak`, `useMemo`, `Animated`, `FadeInDown`.)

- [ ] **Step 2: Replace the component body down to the summary**

Inside `Session()`, replace everything from the first line down to (not including) `if (state.phase === 'summary' || state.phase === 'finished') {` with:

```tsx
  const router = useRouter();
  const { t, gloss: g } = useLanguage();
  const [state, setState] = useState<SessionState | null>(null);
  const [db, setDb] = useState<VocabDb | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [playing, setPlaying] = useState(false);
  const shownAt = useRef(Date.now());
  const counted = useRef<number>(0);        // rounds whose streak has been bumped
  // Every tap bumps this. An audio chain that finds it changed has been
  // interrupted and must not play its cue or start its countdown.
  const seq = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timers.current) clearTimeout(id);
    timers.current = [];
  }, []);
  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  // Leaving the round must leave nothing talking or ticking behind it.
  useEffect(() => () => { clearTimers(); stopSpeaking(); }, [clearTimers]);

  useEffect(() => {
    (async () => {
      const [loaded, s] = await Promise.all([loadProgress(), loadStreak()]);
      setDb(loaded);
      setStreak(s);
      setState(startSession(buildRound(loaded.progress, todayISO(), 1, g)));
    })();
  }, []);

  const question = state ? currentQuestion(state) : null;
  const answering = state?.phase === 'asking' || state?.phase === 'repairing';

  const playPrompt = useCallback((q: Question) => {
    const spoken = promptSpoken(q.direction);
    if (spoken === null) return;                     // a picture says nothing
    const id = ++seq.current;
    setPlaying(true);
    void say(q.prompt, voiceFor(spoken, g)).then(() => {
      if (seq.current === id) setPlaying(false);
    });
  }, [g]);

  // A new question: reset the clock and say it once. Keyed on position, not
  // just phase — a wrong tap leaves the phase and the word unchanged, and must
  // not replay the prompt.
  useEffect(() => {
    shownAt.current = Date.now();
    if (!question || !answering) return;
    setToast(null);
    playPrompt(question);
  }, [question?.word.id, state?.phase, state?.index, state?.repairIndex, state?.round]);

  // How many of state.results have reached storage. Counting answers rather
  // than rounds means a mid-round write and the summary write compose instead
  // of one blocking the other.
  const persisted = useRef(0);
  const latest = useRef<{ state: SessionState | null; db: VocabDb | null }>({ state: null, db: null });
  latest.current = { state, db };

  const persistAnswers = useCallback(async () => {
    const { state: s, db: current } = latest.current;
    if (!s || !current) return;
    const unwritten = s.results.slice(persisted.current);
    if (unwritten.length === 0) return;
    persisted.current = s.results.length;          // claim them before awaiting
    const next = recordAnswers(current, unwritten, todayISO());
    setDb(next);
    await saveProgress(next);
  }, []);

  // Leaving mid-round must not cost the learner the answers they gave.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void persistAnswers();
    });
    return () => {
      sub.remove();
      void persistAnswers();                        // also on unmount, e.g. the X
    };
  }, [persistAnswers]);

  // Bump the streak exactly once, when a round reaches its summary. The
  // `counted` ref is what stops a re-render from bumping the same round twice.
  useEffect(() => {
    if (!state || !streak) return;
    if (state.phase !== 'summary' || counted.current >= state.round) return;

    const fresh = state.results.filter((r) => r.round === state.round);
    if (fresh.length === 0) return;                 // nothing answered — no false streak
    counted.current = state.round;

    (async () => {
      await persistAnswers();
      const today = todayISO();
      const next = bumpStreak(streak, today);
      const grew = next.days > streak.days;
      setStreak(next);
      await saveStreak(next);
      // A longer streak is worth more noise than finishing a routine round.
      cue(grew && next.days % 5 === 0 ? 'streak' : 'complete');
    })();
  }, [state?.phase, state?.round]);

  const advance = useCallback(() => {
    clearTimers();
    seq.current += 1;
    stopSpeaking();
    setToast(null);
    setState((s) => (s ? reduce(s, { type: 'next' }) : s));
  }, [clearTimers]);

  if (!state) {
    return <View style={{ flex: 1, backgroundColor: colour.ground }} />;
  }
```

Note: the mount effect reads `g` once. The language cannot change mid-round (settings is not reachable from the session screen), so this is intended; add the comment `// The language cannot change mid-round: settings is not reachable from here.` above `setState(startSession(…))`.

- [ ] **Step 3: Update the summary block**

In the summary branch:
- `buildRound(current.progress, todayISO(), state.round + 1, seen)` → `buildRound(current.progress, todayISO(), state.round + 1, g, seen)`.
- `¡Bien hecho!` → `{t.summary.title}`.
- `{round.right} de {round.total} correctas` → `{t.summary.firstTry(round.right, round.total)}`.
- `{session.right} de {session.total} en toda la sesión` → `{t.summary.wholeSession(session.right, session.total)}`.
- `PARA REPASAR` → `{t.summary.toReview}`; `{w.en}` → `{gloss(w, g)}`; `Vuelven mañana.` → `{t.summary.backTomorrow}`.
- `¿Otra ronda?` → `{t.summary.anotherRound}`, and give that `PressableCard` `label={t.summary.anotherRound}`.
- `Terminar por hoy` → `{t.summary.doneForToday}`, and give that `Pressable` `accessibilityRole="button"`.

- [ ] **Step 4: Replace the question screen**

Replace everything from `if (!question) {` to the end of the component with:

```tsx
  if (!question) {
    return <View style={{ flex: 1, backgroundColor: colour.ground }} />;
  }

  const onAnswer = (option: string) => {
    if (!answering || state.tried.includes(option)) return;
    const id = ++seq.current;
    clearTimers();
    setPlaying(false);

    const hit = option === question.answer;
    setState(reduce(state, { type: 'answer', option, ms: Date.now() - shownAt.current }));

    const toastId = Date.now();
    setToast({ kind: hit ? 'good' : 'bad', id: toastId, countdown: false });
    if (!hit) {
      later(WRONG_TOAST_MS, () => setToast((x) => (x?.id === toastId ? null : x)));
    }

    // Word first, then the verdict — hearing the word is the lesson.
    void say(option, voiceFor(optionSpoken(question.direction), g)).then(() => {
      if (seq.current !== id) return;               // interrupted by a newer tap
      cue(hit ? 'correct' : 'wrong');
      if (!hit) return;
      later(effectsOn() && !isMuted() ? CUE_MS : 0, () => {
        setToast((x) => (x?.id === toastId ? { ...x, countdown: true } : x));
        later(ADVANCE_MS, advance);
      });
    });
  };

  const optionState = (label: string): OptionState => {
    const tried = state.tried.includes(label);
    if (answering) return tried ? 'wrong' : 'idle';
    if (label === question.answer) return 'correct';
    return tried ? 'wrong-faded' : 'dimmed';
  };

  const inRepair = state.phase === 'repairing' || state.phase === 'repair-feedback';
  const progress = inRepair
    ? 100
    : Math.round((state.index / state.queue.length) * 100);
  const counter = inRepair
    ? `${state.repairIndex + 1} / ${state.repair.length}`
    : `${Math.min(state.index + 1, state.queue.length)} / ${state.queue.length}`;

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: space.xl, paddingTop: space.md }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t.session.exit} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={19} height={19} viewBox="0 0 24 24">
            <Path d="M5 5l14 14M19 5L5 19" stroke={colour.muted} strokeWidth={2.6} strokeLinecap="round" />
          </Svg>
        </Pressable>
        <View style={{ flex: 1, height: 15, backgroundColor: colour.surface, borderWidth: 2, borderColor: colour.ink, borderRadius: radius.pill, overflow: 'hidden' }}>
          <View style={{ width: `${progress}%`, height: '100%', backgroundColor: colour.cactus }} />
        </View>
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 14, color: colour.muted }}>
          {counter}
        </Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: space.xl }}>
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 13, color: colour.muted, letterSpacing: 1, marginTop: 22, marginBottom: space.md }}>
          {inRepair ? t.session.task.repair : taskLabel(t, question.direction)}
        </Text>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {question.direction === 'picture->es' && question.promptImage ? (
            <View style={{ backgroundColor: colour.surface, borderWidth: 2, borderColor: colour.ink, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 22 }}>
              <Image source={VOCAB_ART[question.promptImage]} style={{ width: 190, height: 190 }} resizeMode="contain" />
            </View>
          ) : (
            <PromptWord
              text={question.prompt}
              playing={playing}
              onPress={() => playPrompt(question)}
              label={t.session.listenAgain}
            />
          )}
        </View>

        <View style={{ gap: 10 }}>
          {question.options.map((option) => {
            const tried = state.tried.includes(option);
            return (
              <OptionButton
                key={option}
                label={option}
                state={optionState(option)}
                disabled={!answering || tried}
                detail={tried ? optionMeaning(question.direction, option, WORDS, g) ?? undefined : undefined}
                onPress={() => onAnswer(option)}
              />
            );
          })}
        </View>

        {/* Reserved whether or not the hint shows, so nothing above it moves. */}
        <View style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>
          {!answering && (
            <Text style={{ fontFamily: font.bodyHeavy, fontSize: 13, color: colour.muted }}>
              {t.session.tapToContinue}
            </Text>
          )}
        </View>
      </View>

      {toast !== null && (
        <FeedbackToast
          key={toast.id}
          kind={toast.kind}
          title={toast.kind === 'good' ? t.session.correct : t.session.tryAgain}
          subtitle={toast.kind === 'good' ? `${question.word.es} = ${gloss(question.word, g)}` : undefined}
          countdownMs={toast.countdown ? ADVANCE_MS : undefined}
        />
      )}

      {!answering && (
        <Pressable
          onPress={advance}
          accessibilityRole="button"
          accessibilityLabel={t.session.tapToContinue}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 }}
        />
      )}
    </Screen>
  );
}
```

`Pepe` is still used in the summary — keep its import. `Image`, `PressableCard`, `VOCAB_ART` also stay.

- [ ] **Step 5: Check**

Run: `npm test && npm run typecheck`
Expected: pass. Also `grep -n "Siguiente\|FadeInDown\|La respuesta es\|Escogiste" apps/app/app/session.tsx` → no hits.

- [ ] **Step 6: Verify on the simulator, if the iOS Simulator tool is available to you**

Start the app (`npx expo start --ios` from `apps/app`, or the project's `/run` skill). Walk one round and confirm, reporting each: (a) the prompt is spoken on arrival and the bars turn into the speaker icon; (b) a wrong tap speaks the option, then buzzes, shows the red toast for ~2 s, locks the option with its meaning, and nothing below the toast moves; (c) a right tap speaks the option, then chimes, shows the green toast whose bar drains over 3 s, then moves on; (d) tapping anywhere during that wait moves on at once; (e) the summary counts a wrong-then-right word as wrong. If no simulator tool is available, say so in your report — the controller verifies at the end.

- [ ] **Step 7: Commit**

```bash
git add apps/app/app/session.tsx
git commit -m "Retry until right: spoken taps, top toasts, and tap anywhere to move on"
```

---

### Task 8: Settings, and every other screen in the chosen language

**Files:**
- Create: `apps/app/app/settings.tsx`
- Modify: `apps/app/app/(tabs)/_layout.tsx`, `apps/app/app/(tabs)/index.tsx`, `apps/app/app/(tabs)/stats.tsx`, `apps/app/app/(tabs)/words.tsx`

**Interfaces:**
- Consumes: `useLanguage`, `LANGUAGE_CHOICES` (Task 5); `isMuted`, `saveMuted`, `effectsOn`, `saveEffects`, `cue` (Task 4); `gloss` (Task 1).
- Produces: the `/settings` route, reached from a gear on the Progress tab header.

- [ ] **Step 1: Write `apps/app/app/settings.tsx`**

```tsx
import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Pepe } from '../components/Pepe';
import { PressableCard } from '../components/PressableCard';
import { Screen } from '../components/Screen';
import { cue, effectsOn, isMuted, saveEffects, saveMuted } from '../feedback';
import { useLanguage } from '../i18n/language';
import { LANGUAGE_CHOICES } from '../i18n/strings';
import { WORDS } from '../storage/vocabulary';
import { colour, font, outline, radius, space } from '../theme';

const card = {
  backgroundColor: colour.surface, borderRadius: radius.card, padding: space.lg, ...outline,
} as const;

export default function Settings() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const [soundOn, setSoundOn] = useState(!isMuted());
  const [effects, setEffects] = useState(effectsOn());

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: space.xl, gap: space.md }}>
        <Text style={{ fontFamily: font.displayHeavy, fontSize: 32, color: colour.ink }}>
          {t.settings.title}
        </Text>

        <View style={card}>
          <Text style={{ fontFamily: font.display, fontSize: 17, color: colour.ink }}>{t.settings.language}</Text>
          <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, marginTop: 2 }}>
            {t.settings.languageHint}
          </Text>
          <View accessibilityRole="radiogroup" style={{ marginTop: space.sm }}>
            {LANGUAGE_CHOICES.map((choice, i) => {
              const on = choice.id === language;
              return (
                <Pressable
                  key={choice.id}
                  onPress={() => { cue('tap'); setLanguage(choice.id); }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${choice.name}. ${choice.detail}`}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52,
                    borderTopWidth: i === 0 ? 0 : 1.5, borderTopColor: colour.ground,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.bodyHeavy, fontSize: 16, color: colour.ink }}>{choice.name}</Text>
                    <Text style={{ fontFamily: font.body, fontSize: 12, color: colour.muted }}>{choice.detail}</Text>
                  </View>
                  <View style={{
                    width: 24, height: 24, borderRadius: 12, ...outline,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {on && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colour.cactus }} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.display, fontSize: 17, color: colour.ink }}>{t.settings.sound}</Text>
              <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, marginTop: 2 }}>
                {t.settings.soundHint}
              </Text>
            </View>
            <Switch
              value={soundOn}
              onValueChange={(on) => {
                setSoundOn(on);
                void saveMuted(!on);
                if (on) cue('tap');
              }}
              accessibilityLabel={t.settings.sound}
              trackColor={{ false: colour.muted, true: colour.cactus }}
            />
          </View>

          {/* Only meaningful while there is sound to separate from the voice. */}
          {soundOn && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: space.md,
              marginTop: space.md, paddingTop: space.md, borderTopWidth: 1.5, borderTopColor: colour.ground,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.bodyHeavy, fontSize: 15, color: colour.ink }}>{t.settings.effects}</Text>
                <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, marginTop: 2 }}>
                  {t.settings.effectsHint}
                </Text>
              </View>
              <Switch
                value={effects}
                onValueChange={(on) => {
                  setEffects(on);
                  void saveEffects(on);
                  if (on) cue('tap');
                }}
                accessibilityLabel={t.settings.effects}
                trackColor={{ false: colour.muted, true: colour.cactus }}
              />
            </View>
          )}
        </View>

        <View style={card}>
          <Text style={{ fontFamily: font.display, fontSize: 17, color: colour.ink }}>Pepe Habla</Text>
          <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, marginTop: 4, lineHeight: 19 }}>
            {t.settings.about(WORDS.length)}
          </Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Pepe pose="idle" motion="breathe" size={110} />
        </View>

        <PressableCard label={t.settings.back} onPress={() => { cue('tap'); router.back(); }}>
          <View style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.display, fontSize: 19, color: colour.ink }}>{t.settings.back}</Text>
          </View>
        </PressableCard>
      </View>
    </Screen>
  );
}
```

`colour.ground` as the divider colour is a deliberate, palette-only light rule inside a white card.

- [ ] **Step 2: The tab bar, with the settings gear on Progress**

Replace `apps/app/app/(tabs)/_layout.tsx`'s imports and `TabLayout` so the tab titles come from strings and the Progress tab carries a gear in its header (this is phase 2 Task 6's unfinished header, completed):

```tsx
import { Tabs, useRouter } from 'expo-router';
import { Pressable, type ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useLanguage } from '../../i18n/language';
import { colour, font } from '../../theme';
```

Keep `icons` and `Icon` unchanged. Inside `TabLayout`, add `const router = useRouter();` and `const { t } = useLanguage();`, keep the existing `screenOptions` unchanged, and replace the three `Tabs.Screen` elements with:

```tsx
      <Tabs.Screen name="index" options={{ title: t.tabs.home, tabBarIcon: ({ color }) => <Icon d={icons.home} color={color} /> }} />
      <Tabs.Screen
        name="stats"
        options={{
          title: t.tabs.progress,
          tabBarIcon: ({ color }) => <Icon d={icons.chart} color={color} />,
          headerShown: true,
          headerTitle: '',
          headerStyle: { backgroundColor: colour.ground },
          headerShadowVisible: false,
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel={t.tabs.settings}
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
      />
      <Tabs.Screen name="words" options={{ title: t.tabs.words, tabBarIcon: ({ color }) => <Icon d={icons.list} color={color} /> }} />
```

- [ ] **Step 3: Home in the chosen language**

In `apps/app/app/(tabs)/index.tsx`: import `useLanguage` from `'../../i18n/language'`; add `const { t } = useLanguage();` at the top of `Home`. Replace:
- the `waiting` expression with `const waiting = due > 0 ? t.home.waiting(due) : t.home.caughtUp;`
- `NIVEL 1` → `{t.home.level}` (the word `Callejero` stays).
- `label="CONOCIDAS"` → `label={t.home.known}`, `"POR REPASAR"` → `t.home.due`, `"EN TOTAL"` → `t.home.total`.
- Give the `¡Vamos!` `PressableCard` `label="¡Vamos!"`.

- [ ] **Step 4: Progress in the chosen language**

In `apps/app/app/(tabs)/stats.tsx`: import `useLanguage` and `gloss` (from `@pepe/core`, added to the existing import); add `const { t, gloss: g } = useLanguage();` at the top of `Stats`. Replace each literal with its key:

| Old | New |
|---|---|
| `Progreso` (the heading) | `{t.stats.title}` |
| the `accessibilityLabel` ternary on the streak card | `t.stats.streakLabel(streak.days)` |
| `{streak.days} {streak.days === 1 ? 'día' : 'días'}` | `{t.stats.streakDays(streak.days)}` |
| `{streak.days === 0 ? 'Empieza hoy' : … 'seguidos'}` | `{t.stats.streakCaption(streak.days)}` |
| `"CONOCIDAS"` / `"ESTA SEMANA"` / `"PRECISIÓN"` | `t.stats.known` / `t.stats.thisWeek` / `t.stats.accuracy` |
| `title="Tu vocabulario"` | `title={t.stats.vocabulary}` |
| `` `${summary.practised} de ${summary.total} palabras practicadas` `` | `t.stats.practisedOf(summary.practised, summary.total)` |
| `{summary.known} conocidas · {summary.due} por repasar hoy` | `{t.stats.knownAndDue(summary.known, summary.due)}` |
| `title="Se te atragantan" subtitle="Las que más fallas…"` | `title={t.stats.tricky} subtitle={t.stats.trickyHint}` |
| `{l.word.en}` | `{gloss(l.word, g)}` |
| `title="Todavía nada que mostrar"` | `title={t.stats.emptyTitle}` |
| `Juega una ronda y aquí verás lo que sabes.` | `{t.stats.emptyBody}` |
| photo `accessibilityLabel` | `t.stats.photoLabel` |
| `El Pepe de verdad` / `Perro callejero, Ciudad de México` | `{t.stats.photoTitle}` / `{t.stats.photoCaption}` |

The Progress tab now shows a header (for the gear), so reduce the `ScrollView`'s top padding: change `contentContainerStyle`'s `padding: space.xl` to `paddingHorizontal: space.xl, paddingTop: 0`, keeping `gap` and `paddingBottom`.

- [ ] **Step 5: Words in the chosen language**

In `apps/app/app/(tabs)/words.tsx`: import `useLanguage` and `gloss`; add `const { t, gloss: g } = useLanguage();` at the top of `Words`. Rename the `Filter` type values to language-neutral keys and build labels from strings:

```tsx
type Filter = 'all' | 'due' | 'known' | 'tricky';
const FILTER_KEYS: Filter[] = ['all', 'due', 'known', 'tricky'];
```

Delete `FILTERS`. Initial state `useState<Filter>('all')`. In `keep`: `'repasar'` → `'due'`, `'conocidas'` → `'known'`, `'fallas'` → `'tricky'`. Render the chips with `FILTER_KEYS.map((key) => { const label = t.words.filter[key]; … })` (rest of the chip unchanged). Replace:
- `Palabras` → `{t.words.title}`; `{practised} practicadas de {WORDS.length}` → `{t.words.practisedOf(practised, WORDS.length)}`.
- the empty texts → `t.words.emptyNone` / `t.words.emptyFilter`.
- `{item.word.en}` → `{gloss(item.word, g)}`.
- `` accessibilityLabel={`Escuchar ${item.word.es}`} `` → `accessibilityLabel={t.words.listen(item.word.es)}`.

Sorting stays by Spanish (`localeCompare(…, 'es')`).

- [ ] **Step 6: Nothing Spanish left behind**

Run:

```bash
grep -rnE "'[^']*[áéíóúñ¡¿][^']*'|\"[^\"]*[áéíóúñ¡¿][^\"]*\"|>[^<{]*[áéíóúñ¡¿][^<{]*<" apps/app/app apps/app/components | grep -v "¡Vamos!\|¡Órale!" 
```

Expected: no hits except inside `i18n/strings.ts` (not searched) and `storage/greetings.ts` (not searched). Also scan by eye for unaccented Spanish copy in `apps/app/app` and `apps/app/components` (words like `Inicio`, `Palabras`, `Todas`, `Volver`, `Sonido`). Fix any leftovers by adding a key to `Strings` in all three languages.

Run: `npm test && npm run typecheck` — pass.

- [ ] **Step 7: Verify on the simulator, if available**

Switch to each language in settings and confirm the tab titles, home, progress and words change immediately; toggle sound off and see the effects row disappear; toggle effects off and confirm a wrong tap in a round speaks the word with no buzz and no vibration cue sound. Report what you saw, or that no simulator was available.

- [ ] **Step 8: Commit**

```bash
git add apps/app/app/settings.tsx "apps/app/app/(tabs)/_layout.tsx" "apps/app/app/(tabs)/index.tsx" \
  "apps/app/app/(tabs)/stats.tsx" "apps/app/app/(tabs)/words.tsx"
git commit -m "Settings for language, sound and effects; every screen in the chosen language"
```

---

### Task 9: Documentation, and the end-to-end check

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-09-19-pepe-habla-design.md`, `docs/superpowers/plans/2026-09-20-pepe-habla-phase-2.md`

- [ ] **Step 1: README**

In `README.md`, change the opening paragraph's "English glosses" to "English or Swedish glosses", and add a short section after "## Practising":

```markdown
## Languages

Settings → Language offers Svenska, English and Español. The choice sets the
interface language and the language of the glosses: Swedish glosses in
Swedish, English glosses in English and in Spanish (where the interface itself
is the immersion). Spanish words are always Spanish. On first launch the app
follows the phone's language.

The `/practice` command and the CLI stay in English.
```

In the "Layout" code block, add under `quiz.ts`: `  language.ts       app and gloss languages`.

- [ ] **Step 2: Mark what the new spec supersedes**

In `docs/superpowers/specs/2026-09-19-pepe-habla-design.md`:
- Under `## Question types`, add a first line: `> **Superseded in part by `2026-09-21-language-and-game-flow-design.md`:** listening questions are gone and a question stays open until the right tap.`
- Directly after the paragraph starting `**The interface is in Spanish**`, add: `> **Superseded by `2026-09-21-language-and-game-flow-design.md`:** the interface language is now a setting (Svenska, English, Español).`

In `docs/superpowers/plans/2026-09-20-pepe-habla-phase-2.md`, add under the `### Task 6` heading: `> **Folded into `2026-09-21-language-and-game-flow.md` (Tasks 4 and 8).** This task was never committed on `phase-2`; its settings screen was rebuilt there with language and effects.`

- [ ] **Step 3: Full check**

Run: `npm test && npm run typecheck`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-09-19-pepe-habla-design.md docs/superpowers/plans/2026-09-20-pepe-habla-phase-2.md
git commit -m "Document app languages and the answer loop"
```

- [ ] **Step 5 (controller): Manual verification on the iOS simulator**

Walk through spec §6 "App (manual)" end to end — every question type in each language, the wrong → wrong → right → countdown → tap-anywhere loop, effects off, sound off, the language switch, and a first launch with no stored language on a Swedish-locale simulator (erase app data first). Record each observation in the execution log.

---

## Self-review notes

- **Spec coverage:** §1 languages → Tasks 1, 2, 5, 8; §2 speech + effects → Task 4 (+ settings in 8); §3 question types → Task 1; §4 answer loop → Tasks 6, 7; §5 what counts → Task 3 (+ summary copy in 7); §6 testing → core tests in 1–3, content test in 2, manual in 7, 8, 9; §7 delivery order → Tasks 1–3 core/content, 4–8 app, 9 docs.
- **Stats honesty:** only the first tap is recorded (Task 3), and `recordAnswers` is unchanged, so phase 2's counters (`rightEsToEn`, `rightEnToEs`, `knownOn`) see exactly one result per question as before.
- **Names used across tasks:** `tried`, `gloss`, `glossLanguage`, `GlossLanguage`, `promptSpoken`, `optionSpoken`, `Spoken`, `say`, `Voice`, `effectsOn`, `saveEffects`, `loadSoundSettings`, `useLanguage`, `STRINGS`, `LANGUAGE_CHOICES`, `PromptWord`, `FeedbackToast`, `ToastKind`, `OptionState` `'wrong-faded'` — each defined once and used with the same signature.
