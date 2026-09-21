# Tracks and Levels Implementation Plan (phase 3b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the one level ladder into two independent tracks — Palabras and Gramática — each with its own levels, unlock gate and progress, so neither ever gates the other.

**Architecture:** `Word` gains a required `track`, `level` and `themes`, and loses `tier`. The ladders themselves (level numbers, their Spanish names, their card budgets) are data in `packages/core/src/levels.ts`; the unlock gate is a pure function over `Progress` in `packages/core/src/unlock.ts`. Everything the app does — the home toggle, the round, the word list — reads those two modules, so the rules exist in exactly one place. The selected track is persisted next to the language setting.

**Tech Stack:** TypeScript run directly by Node 24 (no build step), `node:test`, Expo SDK 57, expo-router, AsyncStorage.

**Spec:** `docs/superpowers/specs/2026-09-21-levels-and-tracks-design.md` — §1 (two tracks), §2 (unlocking), §3 (choosing a track), §4 (themes), §6 (content and review), §7 (what 3b delivers). Builds on `docs/superpowers/specs/2026-09-21-language-and-game-flow-design.md`.

**Base:** `main` after phase 3a merged (PR #5). 168 tests pass, typecheck clean at both roots. SM-2 is in place: `Progress` carries `reps`, `ease` and `interval`, and `reps` means consecutive correct **first** taps — which is exactly what the unlock gate measures.

## Global Constraints

- **`packages/core` may not import from `node:`, `react`, `react-native`, or any filesystem API.** `noNodeImports.test.ts` enforces it.
- **Randomness is injected.** Core takes an `Rng` parameter; never `Math.random()` in core.
- **Node 24 runs TypeScript directly.** Relative imports inside core carry explicit `.ts` extensions.
- **TDD for every core change.** Write the test, run it, watch it fail for the right reason, implement, watch it pass.
- **Mexican Spanish**: `carro` not `coche`, `computadora` not `ordenador`, never `vosotros`.
- **Every answer is a tap. Never make the learner type.**
- **Palette only via `apps/app/theme.ts`**, never a literal hex in a component: ground `#FBF6EC`, surface `#FFFFFF`, ink `#1C1714`, muted `#6B6259`, chile `#D1453B`, cactus `#2E7D5B`, marigold `#E9A020`.
- **Every card and button: 2px ink border, hard offset shadow, never blurred.** Use `PressableCard`.
- **Interface copy comes from `apps/app/i18n/strings.ts`.** No user-visible literal in a screen, except the brand words `¡Vamos!`, `Pepe Habla`, Pepe's Spanish greetings, and **the level names**, which are Spanish proper nouns in every app language.
- **Touch targets ≥ 44px.** **Platform branching only in `components/Screen.tsx` and `feedback.ts`.**
- **A repair answer is never recorded. Only the first tap on a question counts.**
- **Never run `expo run:ios`, `expo run:android` or `expo prebuild`, and never edit `package.json` scripts or `app.json` to verify something.** Agents have stalled for over an hour on native builds. Verify in Expo Go: `npx expo start` in `apps/app`, then `xcrun simctl openurl booted "exp://127.0.0.1:8081"`.
- **Consult https://docs.expo.dev/versions/v57.0.0/** for any Expo API, per `apps/app/AGENTS.md`.
- **Stage files by name when committing. Never `git add -A`** — other sessions commit in this repo.
- Run `npm test && npm run typecheck` from the repo root before every commit; both must pass.

## The ladders (from the spec — use these exact values)

`words` — **Palabras**, 8 levels:

| Level | Name | Cards | Content |
|---|---|---|---|
| 1 | Callejero | 200 | The top 200 by frequency: core verbs, pronouns, connectives |
| 2 | Casa | 250 | Home, food, body, family, time, numbers |
| 3 | Calle | 300 | The street: transport, directions, weather, the city |
| 4 | Mercado | 300 | Shopping, money, cooking, clothes |
| 5 | Trabajo | 350 | Work, school, health, the office |
| 6 | Ciudad | 350 | Travel, services, bureaucracy, technology |
| 7 | Ideas | 375 | Opinions, feelings, argument, abstract nouns |
| 8 | Mexicano | 375 | Regional usage, slang, idioms in everyday speech |

`grammar` — **Gramática**, 6 levels:

| Level | Name | Cards | Content |
|---|---|---|---|
| 1 | Ahora | 100 | Present tense of the core verbs, all persons |
| 2 | Ayer | 100 | Preterite — *comí, fui, hice, dijo* |
| 3 | Antes | 100 | Imperfect, and when to use it over the preterite |
| 4 | Mañana | 100 | Future and conditional — *iré, haría, podremos* |
| 5 | Ojalá | 100 | Subjunctive and its triggers — *ojalá que, para que* |
| 6 | Dichos | 100 | Fixed expressions built on grammar — *acabar de, volver a, tener que* |

The card counts are **3c's budget, not 3b's target.** 3b ships the 384 existing words re-levelled plus grammar level 1; every other level is under-filled until 3c. Nothing may assume a level is full.

**The unlock gate:** level 1 of each track is open at install. A level opens when **70% of the level below it, in the same track, has `reps >= 3`**. This is looser than `isKnown` on purpose — gating on "known" would mean roughly 140 rounds before words level 2 opened. The gate's count is called **dominadas** in the app, never *conocidas*, so the two numbers are never confused. A level with no cards in it counts as 0% and does not open the next.

**The themes** (28, exactly these ids): `comida`, `animales`, `casa`, `cuerpo`, `ropa`, `transporte`, `trabajo`, `dinero`, `salud`, `emociones`, `tiempo`, `naturaleza`, `ciudad`, `escuela`, `tecnología`, `deporte`, `música`, `familia`, `cocina`, `fiesta`, `viaje`, `gobierno`, `negocios`, `verbos`, `conectores`, `números`, `saludos`, `slang`. Grammar cards carry their tense or pattern instead: `presente`, `pretérito`, `imperfecto`, `futuro`, `subjuntivo`, `dichos`.

Themes gate nothing. They drive the word list's filter chips, theme-clustered introduction, and a themed session later.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/core/src/levels.ts` (new) | `Track`, `TRACKS`, the two ladders as data, `levelsIn`, `levelName`, `isTheme`, `THEMES`, `GRAMMAR_THEMES` |
| `packages/core/src/levels.test.ts` (new) | its tests |
| `packages/core/src/unlock.ts` (new) | `DOMINADAS_REPS`, `UNLOCK_RATIO`, `isDominada`, `levelStats`, `unlockedThrough` |
| `packages/core/src/unlock.test.ts` (new) | its tests |
| `packages/core/src/types.ts` | `Word` gains `track`, `level`, `themes`; loses `tier` |
| `packages/core/src/select.ts` | draw from one track, introduce by level, cluster new cards by theme |
| `packages/core/src/index.ts` | export the two new modules |
| `data/seed/words-{1..8}.json` | the 384 existing words, re-levelled and themed |
| `data/seed/grammar-1.json` (new) | *Ahora* — present tense, ~100 cards |
| `tools/seed/seed.test.ts` | the new content checks: track, level in range, themes known |
| `apps/app/i18n/strings.ts` | track names, level descriptions, theme names, the toggle and summary copy |
| `apps/app/storage/trackStore.ts` (new) | the selected track, persisted |
| `apps/app/app/(tabs)/index.tsx` | the two-segment toggle, the level card, per-track due count |
| `apps/app/app/session.tsx` | a round draws from the selected track; the summary's switch action |
| `apps/app/app/(tabs)/words.tsx` | track and theme filter chips |

---
### Task 1: The ladders as data, and `Word` gains a track

`Word` loses `tier` and gains `track`, `level` and `themes`. The seed migrates mechanically in this task — `tier N` becomes `level N`, everything is `track: "words"`, and `themes` starts empty. Task 3 assigns the real levels and themes and turns the validator's checks on; until then an empty `themes` is legal.

**Files:**
- Create: `packages/core/src/levels.ts`, `packages/core/src/levels.test.ts`
- Modify: `packages/core/src/types.ts`, `packages/core/src/select.ts`, `packages/core/src/select.test.ts`, `packages/core/src/index.ts`
- Modify (fixtures — swap `tier` for `track`/`level`/`themes`): `packages/core/src/language.test.ts`, `quiz.test.ts`, `stats.test.ts`, `tools/store/fileStore.test.ts`
- Rename + rewrite: `data/seed/tier1.json` → `data/seed/words-1.json`, `tier2.json` → `words-2.json`, `tier3.json` → `words-3.json`

**Interfaces:**
- Consumes: nothing new.
- Produces (all exported from `@pepe/core`):
  - `type Track = 'words' | 'grammar'`, `const TRACKS: readonly Track[]`
  - `interface Level { level: number; name: string; cards: number }`
  - `const LADDERS: Record<Track, readonly Level[]>`
  - `levelsIn(track: Track): number` — how many levels that track has
  - `levelName(track: Track, level: number): string | null`
  - `const THEMES: readonly string[]`, `const GRAMMAR_THEMES: readonly string[]`, `isTheme(track: Track, id: string): boolean`
  - `Word.track: Track`, `Word.level: number`, `Word.themes: readonly string[]`; `Word.tier` gone

- [ ] **Step 1: Write `levels.test.ts`**

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRAMMAR_THEMES, LADDERS, THEMES, TRACKS, isTheme, levelName, levelsIn,
} from './levels.ts';

describe('the ladders', () => {
  test('words has eight levels and grammar has six', () => {
    assert.equal(levelsIn('words'), 8);
    assert.equal(levelsIn('grammar'), 6);
  });

  test('levels are numbered from one, with no gaps', () => {
    for (const track of TRACKS) {
      const numbers = LADDERS[track].map((l) => l.level);
      assert.deepEqual(numbers, numbers.map((_, i) => i + 1), track);
    }
  });

  test('the names are the spec\'s, in order', () => {
    assert.deepEqual(LADDERS.words.map((l) => l.name),
      ['Callejero', 'Casa', 'Calle', 'Mercado', 'Trabajo', 'Ciudad', 'Ideas', 'Mexicano']);
    assert.deepEqual(LADDERS.grammar.map((l) => l.name),
      ['Ahora', 'Ayer', 'Antes', 'Mañana', 'Ojalá', 'Dichos']);
  });

  test('the card budgets add up to the spec\'s totals', () => {
    const sum = (t: 'words' | 'grammar') => LADDERS[t].reduce((n, l) => n + l.cards, 0);
    assert.equal(sum('words'), 2500);
    assert.equal(sum('grammar'), 600);
  });

  test('levelName answers for a real level and refuses an invented one', () => {
    assert.equal(levelName('words', 3), 'Calle');
    assert.equal(levelName('grammar', 1), 'Ahora');
    assert.equal(levelName('words', 9), null);
    assert.equal(levelName('grammar', 0), null);
  });
});

describe('themes', () => {
  test('there are twenty-eight word themes', () => {
    assert.equal(THEMES.length, 28);
  });

  test('no theme id appears twice', () => {
    assert.equal(new Set(THEMES).size, THEMES.length);
    assert.equal(new Set(GRAMMAR_THEMES).size, GRAMMAR_THEMES.length);
  });

  test('each track knows its own themes and not the other\'s', () => {
    assert.equal(isTheme('words', 'comida'), true);
    assert.equal(isTheme('words', 'presente'), false);
    assert.equal(isTheme('grammar', 'presente'), true);
    assert.equal(isTheme('grammar', 'comida'), false);
  });

  test('an invented theme is not a theme on either track', () => {
    assert.equal(isTheme('words', 'astronomía'), false);
    assert.equal(isTheme('grammar', 'astronomía'), false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test packages/core/src/levels.test.ts`
Expected: FAIL — `Cannot find module './levels.ts'`.

- [ ] **Step 3: Write `levels.ts`**

```ts
/**
 * The two ladders, as data.
 *
 * Words and grammar are separate tracks with separate levels, and climbing one
 * never requires climbing the other -- a learner who only wants vocabulary
 * should not have to clear the subjunctive to reach it, and a learner keen on
 * verbs should not have to grind three levels of nouns first.
 *
 * The level names are Spanish proper nouns in every app language ("Nivel 3 ·
 * Calle"), so they live here rather than in the interface strings. Only the
 * one-line description under each name is translated.
 */

export type Track = 'words' | 'grammar';

export const TRACKS: readonly Track[] = ['words', 'grammar'];

export interface Level {
  /** 1-based, and dense: level N is LADDERS[track][N - 1]. */
  level: number;
  /** The Spanish proper noun shown in every language. */
  name: string;
  /**
   * How many cards this level holds when the content is finished. A budget,
   * not a promise: 3b ships the levels under-filled and 3c fills them, so
   * nothing may treat a short level as a bug.
   */
  cards: number;
}

export const LADDERS: Record<Track, readonly Level[]> = {
  words: [
    { level: 1, name: 'Callejero', cards: 200 },
    { level: 2, name: 'Casa', cards: 250 },
    { level: 3, name: 'Calle', cards: 300 },
    { level: 4, name: 'Mercado', cards: 300 },
    { level: 5, name: 'Trabajo', cards: 350 },
    { level: 6, name: 'Ciudad', cards: 350 },
    { level: 7, name: 'Ideas', cards: 375 },
    { level: 8, name: 'Mexicano', cards: 375 },
  ],
  grammar: [
    { level: 1, name: 'Ahora', cards: 100 },
    { level: 2, name: 'Ayer', cards: 100 },
    { level: 3, name: 'Antes', cards: 100 },
    { level: 4, name: 'Mañana', cards: 100 },
    { level: 5, name: 'Ojalá', cards: 100 },
    { level: 6, name: 'Dichos', cards: 100 },
  ],
};

export const levelsIn = (track: Track): number => LADDERS[track].length;

/** The level's name, or null if that track has no such level. */
export function levelName(track: Track, level: number): string | null {
  return LADDERS[track][level - 1]?.name ?? null;
}

/**
 * Themes cut across the levels and gate nothing. They drive the word list's
 * filter chips and theme-clustered introduction, so that new words arrive as a
 * set rather than eight unrelated strangers.
 */
export const THEMES: readonly string[] = [
  'comida', 'animales', 'casa', 'cuerpo', 'ropa', 'transporte', 'trabajo',
  'dinero', 'salud', 'emociones', 'tiempo', 'naturaleza', 'ciudad', 'escuela',
  'tecnología', 'deporte', 'música', 'familia', 'cocina', 'fiesta', 'viaje',
  'gobierno', 'negocios', 'verbos', 'conectores', 'números', 'saludos', 'slang',
];

/** A grammar card's theme is its tense or pattern. */
export const GRAMMAR_THEMES: readonly string[] = [
  'presente', 'pretérito', 'imperfecto', 'futuro', 'subjuntivo', 'dichos',
];

export function isTheme(track: Track, id: string): boolean {
  return (track === 'grammar' ? GRAMMAR_THEMES : THEMES).includes(id);
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `node --test packages/core/src/levels.test.ts`
Expected: PASS, 9 tests (5 for the ladders, 4 for the themes).

- [ ] **Step 5: Change `Word`**

In `packages/core/src/types.ts`, add `import type { Track } from './levels.ts';` at the top, then replace the `tier` field:

```ts
  /** Which ladder this card belongs to. Required: a card with no track would silently never appear. */
  track: Track;
  /** 1-based level within that track. Lower levels are introduced first. */
  level: number;
  /**
   * Tags that cut across the levels. At least one on every words card; a
   * grammar card carries its tense or pattern. They gate nothing.
   */
  themes: readonly string[];
```

Delete the `tier` field and its comment entirely.

- [ ] **Step 6: Order new words by level, not tier**

In `packages/core/src/select.ts`, change the introduction sort and its doc comment:

```ts
    ).sort((a, b) => a.level - b.level);
```

and in the doc comment, "lowest tier first" becomes "lowest level first".

- [ ] **Step 7: Export the new module**

In `packages/core/src/index.ts`, add after the `language.ts` line:

```ts
export * from './levels.ts';
```

- [ ] **Step 8: Migrate the seed files mechanically**

Rename them, then rewrite every record: drop `"tier": N`, add `"track": "words"`, `"level": N`, `"themes": []`. Nothing else about any word changes — not the Spanish, not a gloss, not a note.

```bash
git mv data/seed/tier1.json data/seed/words-1.json
git mv data/seed/tier2.json data/seed/words-2.json
git mv data/seed/tier3.json data/seed/words-3.json
```

Do the field rewrite with a script rather than by hand — 384 records is too many to edit reliably, and a script is auditable:

```bash
node -e '
const fs = require("node:fs");
for (const n of [1, 2, 3]) {
  const path = `data/seed/words-${n}.json`;
  const words = JSON.parse(fs.readFileSync(path, "utf8"));
  const out = words.map((w) => {
    const { tier, ...rest } = w;
    const { id, es, en, sv, pos, ...tail } = rest;
    return { id, es, en, sv, pos, track: "words", level: tier, themes: [], ...tail };
  });
  fs.writeFileSync(path, `[${out.map((w) => JSON.stringify(w)).join(",\n")}]\n`);
  console.log(path, out.length, "words");
}
'
```

Expected output: `words-1.json 147 words` (or whatever each file holds), summing to 384. Check the sum before moving on. Then read the first two lines of each file and confirm the shape looks like the old one — one word per line, `id` first.

- [ ] **Step 9: Update the fixtures**

Every test that builds a `Word` literal needs the new fields. In `packages/core/src/select.test.ts`:

```ts
const word = (id: string, level = 1): Word => ({
  id, es: id, en: id, sv: id, pos: 'noun', track: 'words', level, themes: ['verbos'],
});
```

and rename the test "introduces lower tiers before higher ones" to speak of levels, passing levels where it passed tiers (the values are the same numbers).

In `packages/core/src/language.test.ts`, `quiz.test.ts`, `stats.test.ts` and `tools/store/fileStore.test.ts`, replace `tier: N` with `track: 'words', level: N, themes: []` in every `Word` literal. Do not change any other field.

- [ ] **Step 10: Run everything**

Run: `npm test && npm run typecheck` from the repo root.
Expected: 168 + 9 = 177 tests pass, typecheck clean at both roots. If `tsc` reports a `tier` anywhere, fix it here — `grep -rn "tier" packages tools apps data --include=*.ts --include=*.tsx --include=*.json` should come back empty except in `docs/`.

- [ ] **Step 11: Commit**

```bash
git add packages/core/src/levels.ts packages/core/src/levels.test.ts \
        packages/core/src/types.ts packages/core/src/select.ts packages/core/src/select.test.ts \
        packages/core/src/index.ts packages/core/src/language.test.ts packages/core/src/quiz.test.ts \
        packages/core/src/stats.test.ts tools/store/fileStore.test.ts \
        data/seed/words-1.json data/seed/words-2.json data/seed/words-3.json
git commit -m "Give every card a track and a level, and name the two ladders"
```

The `git mv` in Step 8 already staged the renames.

---

### Task 2: The unlock gate

Pure functions over `Progress`. No screen, no storage.

**Files:**
- Create: `packages/core/src/unlock.ts`, `packages/core/src/unlock.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Track`, `levelsIn` from Task 1; `Progress` and `Word` from `types.ts`.
- Produces (all exported from `@pepe/core`):
  - `const DOMINADAS_REPS = 3`, `const UNLOCK_RATIO = 0.7`
  - `isDominada(p: Progress): boolean`
  - `interface LevelStats { level: number; total: number; dominadas: number; ratio: number }`
  - `levelStats(words, progress, track, level): LevelStats`
  - `unlockedThrough(words, progress, track): number`

- [ ] **Step 1: Write `unlock.test.ts`**

```ts
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test packages/core/src/unlock.test.ts`
Expected: FAIL — `Cannot find module './unlock.ts'`.

- [ ] **Step 3: Write `unlock.ts`**

```ts
import type { Progress, Word } from './types.ts';
import { levelsIn, type Track } from './levels.ts';

/**
 * Consecutive correct first taps before a card counts toward opening the next
 * level. Deliberately looser than `isKnown`, which wants three in *each*
 * direction: gating on that would mean roughly 140 rounds of review before
 * words level 2 opened, and the gate is meant to measure that a level is well
 * under way, not that it is finished.
 */
export const DOMINADAS_REPS = 3;

/** How much of a level must be dominada before the next one opens. */
export const UNLOCK_RATIO = 0.7;

/**
 * The gate's own measure. The app calls this `dominadas` and never
 * `conocidas`, because the stats screen's Conocidas is the stricter, honest
 * figure and the two numbers must never be read as the same thing.
 */
export const isDominada = (p: Progress): boolean => p.reps >= DOMINADAS_REPS;

export interface LevelStats {
  level: number;
  /** Cards that exist in this level. */
  total: number;
  dominadas: number;
  /** dominadas / total, or 0 for a level with no cards yet. */
  ratio: number;
}

export function levelStats(
  words: readonly Word[],
  progress: Readonly<Record<string, Progress>>,
  track: Track,
  level: number,
): LevelStats {
  let total = 0;
  let dominadas = 0;
  for (const w of words) {
    if (w.track !== track || w.level !== level) continue;
    total += 1;
    const p = progress[w.id];
    if (p !== undefined && isDominada(p)) dominadas += 1;
  }
  return { level, total, dominadas, ratio: total === 0 ? 0 : dominadas / total };
}

/**
 * The highest level open on this track. Level 1 is always open.
 *
 * A level with no cards in it is a wall rather than a free pass: it can never
 * be 70% dominada, so nothing beyond it opens. That matters while 3c is still
 * filling the ladder -- an empty level 4 must not hand the learner level 5.
 */
export function unlockedThrough(
  words: readonly Word[],
  progress: Readonly<Record<string, Progress>>,
  track: Track,
): number {
  const top = levelsIn(track);
  let open = 1;
  while (open < top) {
    const { total, dominadas } = levelStats(words, progress, track, open);
    if (total === 0 || dominadas / total < UNLOCK_RATIO) break;
    open += 1;
  }
  return open;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `node --test packages/core/src/unlock.test.ts`
Expected: PASS, 12 tests (1 for `isDominada`, 4 for `levelStats`, 7 for `unlockedThrough`).

- [ ] **Step 5: Export it**

In `packages/core/src/index.ts`, add after the `levels.ts` line:

```ts
export * from './unlock.ts';
```

- [ ] **Step 6: Run everything and commit**

Run: `npm test && npm run typecheck`. Expected: 189 tests, typecheck clean.

```bash
git add packages/core/src/unlock.ts packages/core/src/unlock.test.ts packages/core/src/index.ts
git commit -m "Open a level when 70% of the one below is dominada"
```

---
### Task 3: A round draws from one track, one unlocked level at a time, and new cards arrive as a theme

`selectDaily` gains the track it is drawing from. Due work still comes first and is unchanged; what changes is which cards may be *introduced* — only from unlocked levels of that track, lowest level first, and the new ones in a round come from a single theme so they land as a set.

**Files:**
- Modify: `packages/core/src/select.ts`, `packages/core/src/select.test.ts`

**Interfaces:**
- Consumes: `Track` and `levelsIn` (Task 1), `unlockedThrough` (Task 2).
- Produces: `selectDaily(words, progress, today, count, rng, track: Track): Word[]` — **the track is a new required sixth parameter.** Every caller passes it.

The signature gains a required parameter rather than an optional one on purpose: a caller that forgets would silently mix the two tracks into one round, which is the single thing §8 of the spec puts out of scope.

- [ ] **Step 1: Write the failing tests**

Replace the `word` helper and add these to `packages/core/src/select.test.ts`. Keep every existing test, passing `'words'` as the new sixth argument to each `selectDaily` call.

```ts
const word = (id: string, level = 1, themes: string[] = ['verbos'], track: Track = 'words'): Word =>
  ({ id, es: id, en: id, sv: id, pos: 'noun', track, level, themes });

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
    const l1 = [word('a1', 1, ['comida'])];
    const l2 = [word('b1', 2, ['ropa'])];
    const progress: Record<string, Progress> = { a1: prog('a1', 3, '2026-12-01') };
    // Level 1 is 100% dominada so level 2 is open, but a1 is already answered;
    // nothing unanswered remains in level 1, so b1 is next.
    const picked = selectDaily([...l1, ...l2], progress, '2026-09-19', 5, rng(), 'words');
    assert.deepEqual(picked.map((w) => w.id), ['b1']);
  });
});
```

`select.test.ts` will need `import type { Track } from './levels.ts';` and its `prog` helper's first two parameters are `(id, reps, dueOn)` as Task 1 left them.

- [ ] **Step 2: Run and watch it fail**

Run: `node --test packages/core/src/select.test.ts`
Expected: FAIL — `selectDaily` takes five parameters, and nothing filters by track.

- [ ] **Step 3: Rewrite `select.ts`**

```ts
import type { Progress, Rng, Word } from './types.ts';
import { isDue } from './progress.ts';
import { unlockedThrough } from './unlock.ts';
import type { Track } from './levels.ts';
import { shuffle } from './rng.ts';

/**
 * Choose the cards to practise today, from one track.
 *
 * Due work comes first, shortest streak first, most overdue first within a
 * streak -- so the cards you keep getting wrong keep coming back. Only once the
 * due pile is exhausted do we introduce new ones, lowest level first, and only
 * from levels that are open. Ties are broken randomly so sessions don't
 * fossilise into the same order every day.
 *
 * The track is required rather than optional: a caller that forgot it would
 * silently mix words and grammar into one round, which is the one thing the
 * spec puts out of scope.
 *
 * Due work ignores the level gate. A card the learner has already met must
 * keep coming back even if its level later reads as shut -- locking a level
 * decides what is *introduced*, never what is stranded.
 */
export function selectDaily(
  words: readonly Word[],
  progress: Readonly<Record<string, Progress>>,
  today: string,
  count: number,
  rng: Rng,
  track: Track,
): Word[] {
  const mine = words.filter((w) => w.track === track);
  const byId = new Map(mine.map((w) => [w.id, w]));

  const due = shuffle(
    Object.values(progress).filter((p) => byId.has(p.id) && isDue(p, today)),
    rng,
  ).sort((a, b) => a.reps - b.reps || a.dueOn.localeCompare(b.dueOn));

  const picked: Word[] = [];
  for (const p of due) {
    if (picked.length >= count) break;
    picked.push(byId.get(p.id)!);
  }
  if (picked.length >= count) return picked;

  const open = unlockedThrough(words, progress, track);
  const fresh = shuffle(
    mine.filter((w) => progress[w.id] === undefined && w.level <= open),
    rng,
  ).sort((a, b) => a.level - b.level);

  picked.push(...cluster(fresh, count - picked.length));
  return picked;
}

/**
 * Take `want` new cards, preferring a single theme.
 *
 * New words land far better as a set -- eight words about food are eight hooks
 * into one scene, where eight unrelated words are eight separate problems. The
 * theme is chosen from the lowest level that still has unseen cards, so this
 * never reorders the ladder. From their second exposure on, they interleave
 * with everything else like any other card.
 *
 * If the chosen theme cannot fill the round we widen rather than come up short:
 * a half-empty round is worse than a mixed one.
 */
function cluster(fresh: readonly Word[], want: number): Word[] {
  if (want <= 0 || fresh.length === 0) return [];

  const theme = fresh[0]!.themes[0];
  if (theme === undefined) return fresh.slice(0, want);

  const sameTheme = fresh.filter((w) => w.themes.includes(theme));
  const rest = fresh.filter((w) => !w.themes.includes(theme));
  return [...sameTheme, ...rest].slice(0, want);
}
```

`fresh` is already sorted by level, and `Array.prototype.sort` is stable, so `fresh[0]` is a lowest-level card and `sameTheme` keeps the level order within the theme.

- [ ] **Step 4: Run and watch it pass**

Run: `node --test packages/core/src/select.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the two callers so the tree compiles**

`tools/cli.ts` — the CLI practises words:

```ts
  const selected = selectDaily(words, db.progress, today, count, mulberry32(seedFromDate(today)), 'words');
```

`apps/app/app/session.tsx` — `buildRound` gains the track and passes it through. Add `track: Track` as its **last required parameter**, after `exclude`:

```ts
export function buildRound(
  progress: Record<string, Progress>,
  today: string,
  round: number,
  glossLang: GlossLanguage,
  exclude: ReadonlySet<string> = new Set(),
  track: Track = 'words',
): Question[] {
```

The default keeps this task's diff small; Task 8 removes it and makes every caller pass the chosen track. Add `type Track` to the `@pepe/core` import, and pass `track` to `selectDaily`.

- [ ] **Step 6: Run everything and commit**

Run: `npm test && npm run typecheck`. Expected: 198 tests (9 new in `select.test.ts`), typecheck clean at both roots.

```bash
git add packages/core/src/select.ts packages/core/src/select.test.ts tools/cli.ts apps/app/app/session.tsx
git commit -m "Draw a round from one track, from open levels, one theme at a time"
```

---

### Task 4: Re-level and theme the 384 words

Content, and the validator that guards it. The 384 words currently sit at `level` 1, 2 or 3 — the old tiers, carried across mechanically — with `themes: []`. This task gives each one its real level and at least one theme.

**Anders reviews content by playing, not by reading drafts.** Ship on your draft; the validator is what stands between a typo and the app.

**Files:**
- Modify: `data/seed/words-1.json`, `data/seed/words-2.json`, `data/seed/words-3.json`
- Create: `data/seed/words-4.json`, `data/seed/words-5.json`
- Modify: `tools/seed/seed.test.ts`

**Interfaces:**
- Consumes: `THEMES`, `GRAMMAR_THEMES`, `isTheme`, `LADDERS`, `levelsIn` from Task 1.
- Produces: no code. A seed that satisfies the new validator.

**How to level.** The ladder is ordered by frequency within each level, and the themes cut across all of them. The 384 existing words are A1–B1 vocabulary, so they land in levels 1–5 and none goes higher; levels 6–8 stay empty until 3c and that is correct.

| Level | Name | What belongs | Roughly |
|---|---|---|---|
| 1 | Callejero | The genuinely top-frequency core: `ser`, `estar`, `tener`, `hacer`, `ir`, `poder`, `querer`, `decir`, `ver`, `dar`, the pronouns, and the connectives (`pero`, `porque`, `también`, `todavía`, `ya`, `nunca`, `siempre`) | ~120 |
| 2 | Casa | Home, food, the body, family, time, numbers — `la casa`, `el pan`, `la mano`, `la hermana`, `la mañana`, `comer`, `dormir` | ~110 |
| 3 | Calle | The street: transport, directions, weather, the city — `el camión`, `la calle`, `la lluvia`, `lejos`, `manejar`, `la parada` | ~70 |
| 4 | Mercado | Shopping, money, cooking, clothes — `la cuenta`, `el precio`, `barato`, `la ropa`, `cocinar`, `pagar`, `gastar` | ~45 |
| 5 | Trabajo | Work, school, health, the office — `el jefe`, `el sueldo`, `la reunión`, `el informe`, `la salud`, `el médico`, `contratar` | ~39 |

Those counts are a shape to aim at, not a quota to force. What matters is that a word's level matches how early a learner meets it. A word that genuinely belongs in level 6 or 7 — `la contaminación`, `el desarrollo`, `el desempleo`, `la investigación`, `la población` — goes there, and its file is created for it. Nothing in this plan requires levels 6–8 to be empty.

**How to theme.** Every words card gets **at least one** theme from the 28 in `THEMES`, and may have two or three where they genuinely apply (`cocinar` is both `cocina` and `verbos`). Use `verbos` for verbs that belong to no scene, `conectores` for connectives, `números` for numbers, `saludos` for greetings and courtesy, `slang` for Mexican colloquialism. Do not invent a theme id: the validator rejects it.

**Where the files go.** One file per level, `data/seed/words-N.json`. `fileStore.loadWords()` reads every `.json` in `data/seed` and concatenates them, so a word's file must match its level or the seed becomes impossible to reason about. Moving a word between levels means moving its record between files.

- [ ] **Step 1: Write the validator's new checks first**

Add to `tools/seed/seed.test.ts`, inside the existing `describe('seed words', ...)`:

```ts
  test('every card has a known track', () => {
    const bad = words.filter((w) => w.track !== 'words' && w.track !== 'grammar');
    assert.deepEqual(bad.map((w) => w.id), []);
  });

  test('every card sits at a level its track actually has', () => {
    const bad = words.filter(
      (w) => !Number.isInteger(w.level) || w.level < 1 || w.level > levelsIn(w.track),
    );
    assert.deepEqual(bad.map((w) => `${w.id} (${w.track} ${w.level})`), []);
  });

  test('every words card carries at least one theme', () => {
    const bad = words.filter((w) => w.track === 'words' && w.themes.length === 0);
    assert.deepEqual(bad.map((w) => w.id), []);
  });

  test('every theme is one the track knows', () => {
    const bad: string[] = [];
    for (const w of words) {
      for (const theme of w.themes) {
        if (!isTheme(w.track, theme)) bad.push(`${w.id}: ${theme}`);
      }
    }
    assert.deepEqual(bad, []);
  });

  test('a card lives in the file its level names', () => {
    // A word's level and its filename must agree, or the seed becomes
    // impossible to reason about once 3c starts adding levels one PR at a time.
    assert.deepEqual(misfiled, []);
  });

  test('no level is over its budget', () => {
    const over: string[] = [];
    for (const track of TRACKS) {
      for (const { level, cards } of LADDERS[track]) {
        const n = words.filter((w) => w.track === track && w.level === level).length;
        if (n > cards) over.push(`${track} ${level}: ${n} of ${cards}`);
      }
    }
    assert.deepEqual(over, []);
  });
```

`misfiled` needs the filenames, which `loadWords()` does not return. Add this near the top of the file, beside the existing `words` load:

```ts
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LADDERS, TRACKS, isTheme, levelsIn } from '@pepe/core';

const seedDir = join(projectRoot, 'data', 'seed');
const misfiled: string[] = [];
for (const file of (await readdir(seedDir)).filter((f) => f.endsWith('.json'))) {
  const expected = /^(words|grammar)-(\d+)\.json$/.exec(file);
  if (expected === null) {
    misfiled.push(`${file}: not <track>-<level>.json`);
    continue;
  }
  const [, track, level] = expected;
  for (const w of JSON.parse(await readFile(join(seedDir, file), 'utf8')) as Word[]) {
    if (w.track !== track || String(w.level) !== level) {
      misfiled.push(`${w.id}: ${w.track} ${w.level} in ${file}`);
    }
  }
}
```

and add `import type { Word } from '@pepe/core';` to the imports.

- [ ] **Step 2: Run the validator and watch it fail**

Run: `node --test tools/seed/seed.test.ts`
Expected: FAIL on "every words card carries at least one theme" — all 384 have `themes: []` — and on "a card lives in the file its level names" for nothing yet, since levels still match filenames. Read the failure list; it is your work queue.

- [ ] **Step 3: Assign every word its level and themes**

Work through all 384. Read each word's `es`, `en` and `pos`, decide its level from the table above, and give it at least one theme. Write the files out with one word per line, `id` first, in the existing shape — a script that reads all three current files, applies a mapping you write, and writes five files is far more reliable than hand-editing JSON.

A worked example of the target shape, from level 1:

```json
[{"id": "ser", "es": "ser", "en": "to be (permanent)", "sv": "att vara (bestående)", "pos": "verb", "track": "words", "level": 1, "themes": ["verbos"], "note": "Identity, origin, time: soy de Noruega."},
{"id": "el-pan", "es": "el pan", "en": "the bread", "sv": "brödet", "pos": "noun", "track": "words", "level": 2, "themes": ["comida"]},
{"id": "el-camion", "es": "el camión", "en": "the bus", "sv": "bussen", "pos": "noun", "track": "words", "level": 3, "themes": ["transporte", "ciudad"], "note": "In Mexico a camión is a city bus; in Spain it is a lorry."},
{"id": "cocinar", "es": "cocinar", "en": "to cook", "sv": "att laga mat", "pos": "verb", "track": "words", "level": 4, "themes": ["cocina", "verbos"], "sprite": "vocab-cocinar"}]
```

**Change nothing but `level` and `themes`.** Not an `es`, not a gloss, not a `note`, not a `sprite`, not an `id` — progress is keyed by `id`, and changing one would orphan a learner's history for that word.

- [ ] **Step 4: Run the validator until it is green**

Run: `node --test tools/seed/seed.test.ts`
Expected: PASS. Then `npm test && npm run typecheck` from the root — expected 204 tests (6 new validator checks), typecheck clean.

- [ ] **Step 5: Check the shape of what you produced**

```bash
node -e '
const fs = require("node:fs");
let total = 0;
for (const f of fs.readdirSync("data/seed").sort()) {
  const ws = JSON.parse(fs.readFileSync(`data/seed/${f}`, "utf8"));
  total += ws.length;
  const themes = new Set(ws.flatMap((w) => w.themes));
  console.log(f.padEnd(16), String(ws.length).padStart(4), "cards,", themes.size, "themes");
}
console.log("total", total);
'
```

Expected: `total 384`, every file non-empty, and every level showing more than one theme. A level with exactly one theme across 100 cards means the theming collapsed — go back and fix it, because theme-clustered introduction would then hand the learner the same theme every round.

- [ ] **Step 6: Commit**

```bash
git add data/seed/words-1.json data/seed/words-2.json data/seed/words-3.json \
        data/seed/words-4.json data/seed/words-5.json tools/seed/seed.test.ts
git commit -m "Re-level the 384 words onto the Palabras ladder, and theme them"
```

Add any level-6-and-up file you created to that list.

---
### Task 5: Grammar level 1 — *Ahora*

~100 cards of present tense, so the Gramática toggle has something behind it. A grammar card is a Spanish form and its meaning in the learner's language — `comí` ↔ "I ate" / "jag åt". Same question types, same retry loop, same scheduler. No new screen.

**Grammar never depends on words.** These cards are built from the ~40 most common verbs, all of which sit in words level 1, so Gramática can be climbed from day one whatever the words track is doing.

**Files:**
- Create: `data/seed/grammar-1.json`

**Interfaces:**
- Consumes: the validator from Task 4 — it already checks track, level, themes and filename, and it already checks that no two cards share an `es`, `en` or `sv`.
- Produces: no code.

**What the cards are.** Conjugated present-tense forms of the core verbs, across persons. Every card:

- `track: "grammar"`, `level: 1`, `themes: ["presente"]`
- `id`: the form, slugged — `soy`, `tienes`, `hacemos`, `se-llama`
- `es`: the bare Spanish form, no pronoun — `soy`, not `yo soy` — because the pronoun is usually dropped in speech and the form itself is what must be recognised
- `en` / `sv`: the meaning **with** the English and Swedish subject pronouns, which those languages cannot drop — `"I am"` / `"jag är"`
- `pos: "verb"`
- `note` where Mexico differs or the form is a trap, and nowhere else

**Which forms.** Cover `yo`, `tú`, `él/ella/usted`, `nosotros` and `ellos/ustedes` for the highest-frequency verbs. **No `vosotros`, ever** — this is Mexican Spanish. Start from the irregulars a learner meets first and cannot guess:

`ser` (soy, eres, es, somos, son), `estar` (estoy, estás, está, estamos, están), `tener` (tengo, tienes, tiene, tenemos, tienen), `ir` (voy, vas, va, vamos, van), `hacer` (hago, haces, hace, hacemos, hacen), `poder` (puedo, puedes, puede, podemos, pueden), `querer` (quiero, quieres, quiere, queremos, quieren), `decir` (digo, dices, dice, decimos, dicen), `saber` (sé, sabes, sabe, sabemos, saben), `ver` (veo, ves, ve, vemos, ven), `dar` (doy, das, da, damos, dan), `venir` (vengo, vienes, viene, venimos, vienen), `salir` (salgo, sales, sale, salimos, salen), `poner` (pongo, pones, pone, ponemos, ponen).

That is 70. Fill the rest to about 100 with regular verbs whose pattern is worth drilling — `hablar`, `comer`, `vivir`, `trabajar`, `comprar`, `entender`, `pensar` (stem-changing: pienso), `dormir` (duermo), `jugar` (juego) — favouring the stem-changing ones, since those are where a learner's guess fails.

**The one hard constraint the validator enforces:** no two cards may share an `es`, an `en` or an `sv`, across the whole seed including the 384 words. Two cards with the same gloss would put two identical options in one question. `es` (he/she is) and `es` the Spanish word for "is" is the collision to watch — and note `ser`'s infinitive already exists in words level 1 with `en: "to be (permanent)"`, so the conjugated `es` needs `en: "he is, she is, it is"` and `sv: "han är, hon är, den är"`, which do not collide with it.

- [ ] **Step 1: Write the file**

`data/seed/grammar-1.json`, one card per line, same shape as the words files:

```json
[{"id": "soy", "es": "soy", "en": "I am (permanent)", "sv": "jag är (bestående)", "pos": "verb", "track": "grammar", "level": 1, "themes": ["presente"], "note": "From ser: identity and origin. Soy de Noruega."},
{"id": "estoy", "es": "estoy", "en": "I am (right now)", "sv": "jag är (just nu)", "pos": "verb", "track": "grammar", "level": 1, "themes": ["presente"], "note": "From estar: state and place. Estoy cansado."},
{"id": "tengo", "es": "tengo", "en": "I have", "sv": "jag har", "pos": "verb", "track": "grammar", "level": 1, "themes": ["presente"]},
{"id": "vamos", "es": "vamos", "en": "we go, we are going", "sv": "vi går, vi ska", "pos": "verb", "track": "grammar", "level": 1, "themes": ["presente"], "note": "Also \"let's\": ¡Vamos!"},
{"id": "pienso", "es": "pienso", "en": "I think", "sv": "jag tänker", "pos": "verb", "track": "grammar", "level": 1, "themes": ["presente"], "note": "Stem-changing: pensar becomes pienso, not penso."}]
```

Note the `soy` / `estoy` pair: the two verbs that both mean "to be" must be glossed so a learner can tell them apart from the gloss alone, because both appear as options in the same question.

- [ ] **Step 2: Run the validator**

Run: `node --test tools/seed/seed.test.ts`
Expected: PASS. Any duplicate-gloss failure is a real collision — fix it by making the gloss more specific, never by deleting the card.

- [ ] **Step 3: Check the shape**

```bash
node -e '
const ws = JSON.parse(require("node:fs").readFileSync("data/seed/grammar-1.json", "utf8"));
console.log(ws.length, "cards");
console.log("vosotros forms:", ws.filter((w) => /áis$|éis$|ís$/.test(w.es)).map((w) => w.es));
console.log("with a pronoun in es:", ws.filter((w) => /^(yo|tú|él|ella|usted|nosotros|ellos|ustedes) /.test(w.es)).map((w) => w.es));
'
```

Expected: about 100 cards, and **both lists empty**. A `vosotros` form or a pronoun in `es` is a content bug, not a style preference.

- [ ] **Step 4: Run everything and commit**

Run: `npm test && npm run typecheck`. Expected: green.

```bash
git add data/seed/grammar-1.json
git commit -m "Grammar level 1: the present tense of the verbs you meet first"
```

---

### Task 6: The interface learns to say all of it

Track names, level descriptions, theme names and the new screen copy, in Svenska, English and Español. `Strings` is an interface, so a key missing from one language is a type error.

**Files:**
- Modify: `apps/app/i18n/strings.ts`

**Interfaces:**
- Consumes: `THEMES`, `GRAMMAR_THEMES`, `TRACKS` from Task 1.
- Produces: on `Strings` —
  - `track: { words: string; grammar: string }` — the track's name in the app's language
  - `level.line: (level: number, name: string) => string` — "NIVEL 3 · Calle"
  - `level.desc: { words: readonly string[]; grammar: readonly string[] }` — one line per level, in ladder order
  - `level.dominadas: (done: number, total: number) => string`
  - `level.next: (name: string) => string`
  - `theme: Record<string, string>` — every id in `THEMES` and `GRAMMAR_THEMES`
  - `summary.switchTo: (track: string) => string`
  - `words.filter` gains `track` and `theme`

The level **names** are not here — they are Spanish proper nouns in every language and live in `levels.ts`. Only the descriptions are translated.

- [ ] **Step 1: Extend the `Strings` interface**

In `apps/app/i18n/strings.ts`, add to the interface:

```ts
  track: { words: string; grammar: string };
  level: {
    line: (level: number, name: string) => string;
    desc: { words: readonly string[]; grammar: readonly string[] };
    dominadas: (done: number, total: number) => string;
    next: (name: string) => string;
  };
  theme: Record<string, string>;
```

and to `summary`, `switchTo: (track: string) => string;`, and to `words.filter`, `track: string` plus `theme: string`.

- [ ] **Step 2: Fill all three languages**

Spanish:

```ts
  track: { words: 'Palabras', grammar: 'Gramática' },
  level: {
    line: (n, name) => `NIVEL ${n} · ${name}`,
    desc: {
      words: [
        'Las 200 palabras que más se oyen.',
        'La casa, la comida, el cuerpo, la familia.',
        'La calle: el transporte, el clima, la ciudad.',
        'Las compras, el dinero, la cocina, la ropa.',
        'El trabajo, la escuela, la salud.',
        'Viajes, servicios, trámites, tecnología.',
        'Opiniones, sentimientos, ideas.',
        'Como se habla de verdad en México.',
      ],
      grammar: [
        'El presente de los verbos de siempre.',
        'El pretérito: comí, fui, hice.',
        'El imperfecto, y cuándo usarlo.',
        'El futuro y el condicional.',
        'El subjuntivo y lo que lo pide.',
        'Dichos: acabar de, volver a, tener que.',
      ],
    },
    dominadas: (done, total) => `${done} de ${total} dominadas`,
    next: (name) => `Sigue: ${name}`,
  },
```

English:

```ts
  track: { words: 'Words', grammar: 'Grammar' },
  level: {
    line: (n, name) => `LEVEL ${n} · ${name}`,
    desc: {
      words: [
        'The 200 words you hear most.',
        'Home, food, the body, family.',
        'The street: transport, weather, the city.',
        'Shopping, money, cooking, clothes.',
        'Work, school, health.',
        'Travel, services, paperwork, technology.',
        'Opinions, feelings, ideas.',
        'How people actually talk in Mexico.',
      ],
      grammar: [
        'The present tense of the everyday verbs.',
        'The preterite: comí, fui, hice.',
        'The imperfect, and when to use it.',
        'The future and the conditional.',
        'The subjunctive, and what triggers it.',
        'Set phrases: acabar de, volver a, tener que.',
      ],
    },
    dominadas: (done, total) => `${done} of ${total} mastered`,
    next: (name) => `Next: ${name}`,
  },
```

Swedish:

```ts
  track: { words: 'Ord', grammar: 'Grammatik' },
  level: {
    line: (n, name) => `NIVÅ ${n} · ${name}`,
    desc: {
      words: [
        'De 200 ord du hör oftast.',
        'Hemmet, maten, kroppen, familjen.',
        'Gatan: transport, väder, staden.',
        'Handla, pengar, matlagning, kläder.',
        'Jobbet, skolan, hälsan.',
        'Resor, service, byråkrati, teknik.',
        'Åsikter, känslor, idéer.',
        'Så som man faktiskt pratar i Mexiko.',
      ],
      grammar: [
        'Presens av verben du använder varje dag.',
        'Preteritum: comí, fui, hice.',
        'Imperfekt, och när man tar det.',
        'Futurum och konditionalis.',
        'Konjunktiv, och vad som utlöser den.',
        'Fasta uttryck: acabar de, volver a, tener que.',
      ],
    },
    dominadas: (done, total) => `${done} av ${total} behärskade`,
    next: (name) => `Härnäst: ${name}`,
  },
```

The track names in Spanish keep the spec's `Palabras` / `Gramática`, which are also the toggle's segment labels in that language.

- [ ] **Step 3: Name every theme in all three languages**

All 28 word themes plus the 6 grammar ones, as a `Record<string, string>` per language. Spanish uses the theme id itself where it already is Spanish (`comida` → `'Comida'`, capitalised). English: `comida` → `'Food'`, `animales` → `'Animals'`, `casa` → `'Home'`, `cuerpo` → `'Body'`, `ropa` → `'Clothes'`, `transporte` → `'Transport'`, `trabajo` → `'Work'`, `dinero` → `'Money'`, `salud` → `'Health'`, `emociones` → `'Feelings'`, `tiempo` → `'Time'`, `naturaleza` → `'Nature'`, `ciudad` → `'City'`, `escuela` → `'School'`, `tecnología` → `'Technology'`, `deporte` → `'Sport'`, `música` → `'Music'`, `familia` → `'Family'`, `cocina` → `'Cooking'`, `fiesta` → `'Parties'`, `viaje` → `'Travel'`, `gobierno` → `'Government'`, `negocios` → `'Business'`, `verbos` → `'Verbs'`, `conectores` → `'Connectives'`, `números` → `'Numbers'`, `saludos` → `'Greetings'`, `slang` → `'Slang'`; and `presente` → `'Present'`, `pretérito` → `'Preterite'`, `imperfecto` → `'Imperfect'`, `futuro` → `'Future'`, `subjuntivo` → `'Subjunctive'`, `dichos` → `'Set phrases'`.

Swedish: `Mat`, `Djur`, `Hemmet`, `Kroppen`, `Kläder`, `Transport`, `Jobb`, `Pengar`, `Hälsa`, `Känslor`, `Tid`, `Natur`, `Staden`, `Skolan`, `Teknik`, `Sport`, `Musik`, `Familjen`, `Matlagning`, `Fest`, `Resor`, `Myndigheter`, `Affärer`, `Verb`, `Bindeord`, `Siffror`, `Hälsningar`, `Slang`; and `Presens`, `Preteritum`, `Imperfekt`, `Futurum`, `Konjunktiv`, `Fasta uttryck`.

- [ ] **Step 4: Add the new screen copy**

To `summary`, in the three languages: `switchTo: (track) => \`¿Mejor ${track}?\`` / `` (track) => `Try ${track} instead?` `` / `` (track) => `Hellre ${track}?` ``.

To `words.filter`: `track` → `'Pista'` / `'Track'` / `'Spår'`, and `theme` → `'Tema'` / `'Theme'` / `'Tema'`.

- [ ] **Step 5: Prove no theme is unnamed**

Add to `tools/seed/seed.test.ts`:

```ts
  test('every theme has a name in every language', async () => {
    const { STRINGS } = (await import('../../apps/app/i18n/strings.ts')) as {
      STRINGS: Record<string, { theme: Record<string, string> }>;
    };
    const missing: string[] = [];
    for (const [lang, s] of Object.entries(STRINGS)) {
      for (const id of [...THEMES, ...GRAMMAR_THEMES]) {
        if (!s.theme[id]) missing.push(`${lang}: ${id}`);
      }
    }
    assert.deepEqual(missing, []);
  });
```

Import it by a non-literal specifier, as the file already does for greetings, so `apps/app` stays out of the root `tsc` program. If `strings.ts` does not export its record under the name `STRINGS`, use whatever it is actually called — read the file first.

- [ ] **Step 6: Run everything and commit**

Run: `npm test && npm run typecheck`. Expected: green at both roots. A missing key is a compile error, which is the point of `Strings` being an interface.

```bash
git add apps/app/i18n/strings.ts tools/seed/seed.test.ts
git commit -m "Name the tracks, the levels and the themes in three languages"
```

---
### Task 7: The home toggle and the level card

Home keeps one `¡Vamos!`. Above it sits a two-segment toggle — *Palabras · Gramática* — each segment showing its current level. The choice is remembered. The due count and the level card follow the selected track.

**Files:**
- Create: `apps/app/storage/trackStore.ts`
- Modify: `apps/app/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `TRACKS`, `LADDERS`, `levelName` (Task 1), `unlockedThrough`, `levelStats` (Task 2), the strings (Task 6).
- Produces:
  - `loadTrack(): Promise<Track>` — defaults to `'words'`
  - `saveTrack(track: Track): Promise<void>`
  - `TRACK_KEY = 'pepe-habla/track/v1'`

- [ ] **Step 1: Write `trackStore.ts`**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRACKS, type Track } from '@pepe/core';

const KEY = 'pepe-habla/track/v1';

/**
 * Which ladder the learner is climbing right now. Remembered between
 * launches, next to the language and the sound settings, so picking up the
 * phone lands where they left off rather than always on Palabras.
 */
export async function loadTrack(): Promise<Track> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return TRACKS.includes(raw as Track) ? (raw as Track) : 'words';
  } catch {
    return 'words';
  }
}

export async function saveTrack(track: Track): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, track);
  } catch {
    // A preference that fails to persist is not worth interrupting practice
    // for; the learner picks it again next launch.
  }
}
```

- [ ] **Step 2: Put the toggle on home**

In `apps/app/app/(tabs)/index.tsx`:

Add two pieces of state: `const [track, setTrack] = useState<Track>('words');` and `const [progress, setProgress] = useState<Record<string, Progress>>({});`. The level card needs the records themselves, not just the counts the screen keeps today. `WORDS` is already imported and static, so it needs no state.

Load the track alongside the progress in the existing `useFocusEffect`, and compute everything per track:

```ts
  useFocusEffect(useCallback(() => {
    (async () => {
      const [db, s, chosen] = await Promise.all([loadProgress(), loadStreak(), loadTrack()]);
      const today = todayISO();
      const all = Object.values(db.progress);
      const mine = new Set(WORDS.filter((w) => w.track === chosen).map((w) => w.id));
      setTrack(chosen);
      setDue(all.filter((p) => mine.has(p.id) && isDue(p, today)).length);
      // The same measure the stats screen calls Conocidas: three correct in
      // *each* direction. The looser count is `dominadas`, on the level card.
      setKnown(all.filter(isKnown).length);
      setStreak(s);
      setProgress(db.progress);
    })();
  }, []));
```

Derive the level for the selected track:

```ts
  const open = unlockedThrough(WORDS, progress, track);
  const stats = levelStats(WORDS, progress, track, open);
  const name = levelName(track, open) ?? '';
  const nextName = levelName(track, open + 1);
```

The toggle sits where the `LEVEL 1 · Callejero` chip is today, and that chip becomes the level card below it. Two segments, each ≥44px tall, the selected one on `colour.surface` with the 2px ink border and the unselected one flat on `colour.ground`:

```tsx
  <View style={{ flexDirection: 'row', gap: 8, marginTop: space.md }}>
    {TRACKS.map((id) => {
      const on = id === track;
      const lvl = unlockedThrough(WORDS, progress, id);
      return (
        <Pressable
          key={id}
          onPress={() => { cue('tap'); setTrack(id); void saveTrack(id); }}
          accessibilityRole="button"
          accessibilityState={{ selected: on }}
          accessibilityLabel={`${t.track[id]}, ${t.level.line(lvl, levelName(id, lvl) ?? '')}`}
          style={{
            flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center',
            borderRadius: radius.button, borderWidth: 2, borderColor: colour.ink,
            backgroundColor: on ? colour.surface : colour.ground,
          }}
        >
          <Text style={{ fontFamily: font.display, fontSize: 17, color: colour.ink }}>{t.track[id]}</Text>
          <Text style={{ fontFamily: font.bodyHeavy, fontSize: 11, color: colour.muted, letterSpacing: 0.5 }}>
            {t.level.line(lvl, levelName(id, lvl) ?? '')}
          </Text>
        </Pressable>
      );
    })}
  </View>
```

- [ ] **Step 3: The level card**

Under the toggle, a `PressableCard` (no `onPress` — it is not tappable) showing the current level's line, its description, and progress toward the gate as **dominadas**, never *conocidas*:

```tsx
  <PressableCard depth={3} style={{ marginTop: space.md }}>
    <View style={{ padding: 14 }}>
      <Text style={{ fontFamily: font.bodyHeavy, fontSize: 11, color: colour.muted, letterSpacing: 0.5 }}>
        {t.level.line(open, name)}
      </Text>
      <Text style={{ fontFamily: font.body, fontSize: 14, color: colour.ink, marginTop: 3 }}>
        {t.level.desc[track][open - 1] ?? ''}
      </Text>
      <Meter value={stats.ratio} tint={colour.cactus} />
      <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, marginTop: 5 }}>
        {t.level.dominadas(stats.dominadas, stats.total)}
        {nextName !== null ? ` · ${t.level.next(nextName)}` : ''}
      </Text>
    </View>
  </PressableCard>
```

Check `Meter`'s actual props before wiring it — it is already used on the stats and words screens, and "more value, more fill" is its contract, which is right here: more dominadas, more bar.

Wrap the card in `<View accessible accessibilityLabel={...}>` so a screen reader reads it as one thing, the way `StatTile` does. The phase 2 log has a ruling about exactly this.

- [ ] **Step 4: Verify in Expo Go**

```bash
cd apps/app && npx expo start
```

then `xcrun simctl openurl booted "exp://127.0.0.1:8081"`. **Never `expo run:ios`, `expo run:android` or `expo prebuild`.**

Check and report: both segments show their track's level; tapping switches which is highlighted and changes the due count; the choice survives leaving and re-entering the app; the level card shows dominadas and not conocidas; nothing overflows on the screen; the toggle's targets are comfortably tappable.

- [ ] **Step 5: Run everything and commit**

Run: `npm test && npm run typecheck`. Expected: green.

```bash
git add apps/app/storage/trackStore.ts "apps/app/app/(tabs)/index.tsx"
git commit -m "Choose a track on home, and show where that ladder stands"
```

---

### Task 8: A round follows the chosen track, and the summary offers the other one

**Files:**
- Modify: `apps/app/app/session.tsx`

**Interfaces:**
- Consumes: `loadTrack` (Task 7), `buildRound`'s `track` parameter (Task 3), `t.summary.switchTo` and `t.track` (Task 6).
- Produces: nothing new.

- [ ] **Step 1: Make the track required and load it**

In `apps/app/app/session.tsx`, remove the `= 'words'` default from `buildRound`'s `track` parameter that Task 3 left in place. Every call site must now pass one.

Add `const [track, setTrack] = useState<Track>('words');` and load it in the same effect that loads progress and the streak, before the first round is built. The round must not be built from the default and then rebuilt — a learner who chose Gramática would see a flash of Spanish nouns.

- [ ] **Step 2: Pass it through both call sites**

The first round, and `another()` in the summary. Both already have `g` (the gloss language) to hand; `track` sits beside it.

- [ ] **Step 3: Add the quieter switch action to the summary**

Below `¿Otra ronda?` and above `Klart för idag`, a third action that switches to the other track and starts a round there. Quieter than `¿Otra ronda?` — a plain `Pressable` like `doneForToday`, not a `PressableCard`:

```tsx
  const other: Track = track === 'words' ? 'grammar' : 'words';

  const switchTrack = async () => {
    cue('tap');
    setTrack(other);
    void saveTrack(other);
    const current = db ?? await loadProgress();
    const questions = buildRound(current.progress, todayISO(), state.round + 1, g, new Set(), other);
    if (questions.length === 0) return;      // nothing due or new on that track today
    setState(reduce(state, { type: 'anotherRound', questions }));
  };
```

The `exclude` set is empty on purpose: nothing answered on this track has any bearing on the other one.

```tsx
  <Pressable onPress={switchTrack} accessibilityRole="button" style={{ height: 52, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
    <Text style={{ fontFamily: font.bodyHeavy, fontSize: 16, color: colour.muted }}>
      {t.summary.switchTo(t.track[other])}
    </Text>
  </Pressable>
```

- [ ] **Step 4: Leave the streak alone**

The streak counts a completed round in **either** track. The existing streak effect fires on any completed round and knows nothing about tracks — confirm it stays that way, and do not add a track condition to it.

- [ ] **Step 5: Verify in Expo Go**

Check and report: a round on Palabras shows only words; switching to Gramática on home and starting a round shows only conjugated forms; the summary's switch action starts a round on the other track; the streak goes up from a round in either; leaving mid-round and returning still works. **No `expo run:*`, no `expo prebuild`.**

- [ ] **Step 6: Run everything and commit**

```bash
git add apps/app/app/session.tsx
git commit -m "Practise the track you picked, and offer the other one at the end"
```

---

### Task 9: The word list filters by track and theme

**Files:**
- Modify: `apps/app/app/(tabs)/words.tsx`

**Interfaces:**
- Consumes: `THEMES`, `GRAMMAR_THEMES`, `TRACKS` (Task 1), `t.theme` and `t.words.filter` (Task 6).
- Produces: nothing new.

- [ ] **Step 1: Add a track filter above the existing chips**

The list currently shows every practised word. Add a track segment row — the same two segments as home, in the same shape — and filter `rows` by it. Default to the track from `loadTrack()`, so the list opens on whatever the learner is climbing.

- [ ] **Step 2: Add theme chips**

Below the existing `all / due / known / tricky` chips, a horizontally scrolling row of theme chips for the selected track, plus an "all themes" chip that is selected by default. **Only themes that actually appear** among the practised cards get a chip — a row of 28 chips where 5 have anything behind them is noise. Compute them from `rows` before the theme filter is applied.

```tsx
  const available = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) for (const th of r.word.themes) seen.add(th);
    return (track === 'grammar' ? GRAMMAR_THEMES : THEMES).filter((th) => seen.has(th));
  }, [rows, track]);
```

Each chip's label is `t.theme[id]`, and selecting one filters `rows` to cards carrying it. Chips are ≥44px tall, 2px ink border, selected on `colour.surface` and unselected flat — the same treatment as the existing filter chips, so the two rows read as one control.

- [ ] **Step 3: Keep the empty state honest**

With a theme selected and nothing behind it, the list must say so rather than render blank. Reuse whatever empty-state copy the screen already has; if it has none, the existing `practisedOf` line above the chips is enough context and an empty list is acceptable — do not invent new copy, since every string must come from `strings.ts`.

- [ ] **Step 4: Verify in Expo Go**

Check and report: switching track changes the list; only themes with cards behind them appear as chips; selecting a theme narrows the list; the chips do not overflow or wrap into an unreachable row; a screen reader reads each chip as a button with its state. **No `expo run:*`, no `expo prebuild`.**

- [ ] **Step 5: Run everything and commit**

```bash
git add "apps/app/app/(tabs)/words.tsx"
git commit -m "Filter the word list by track and by theme"
```

---

## When all nine tasks are done

- Run the whole-branch review before the PR.
- Write the execution log to `docs/superpowers/plans/2026-09-21-phase-3b-execution-log.md`: every ruling, every deferred finding, and the Expo Go results from Tasks 7, 8 and 9.
- The PR body should say what a learner sees: two tracks with their own ladders, a toggle on home, levels that open at 70% dominada, and grammar level 1 behind the second segment.

## Out of scope

- Mixed rounds drawing from both tracks at once.
- Themed sessions started from the word list — the filter is 3b, the session is later.
- Any gate between the two tracks.
- Filling words levels 2–8 or grammar levels 2–6 — that is 3c, one level per PR.
- The morning notification (phase 4).
