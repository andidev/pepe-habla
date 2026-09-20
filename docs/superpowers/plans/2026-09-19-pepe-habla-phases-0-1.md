# Pepe Habla — Phases 0 and 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get a playable Spanish trainer onto an iPhone and an Android phone — Pepe animated, mariachi sounds, four question types, elastic rounds — built on the existing pure-TypeScript core.

**Architecture:** npm workspaces. `packages/core` holds every decision the app makes (scheduling, selection, question building, the session state machine) as pure functions over plain data, importing nothing from `node:`, `react` or `react-native`. `apps/mobile` is an Expo app that renders that state and owns all I/O. The session is a reducer in core, so the part most likely to have subtle bugs is unit-testable without a simulator.

**Tech Stack:** TypeScript (no build step — Node 24 strips types natively), `node:test`, Expo SDK 57, expo-router, react-native-reanimated 4, expo-audio, expo-haptics, expo-speech, AsyncStorage.

**Spec:** `docs/superpowers/specs/2026-09-19-pepe-habla-design.md`

**Reference mockup:** `https://claude.ai/artifact/S8tv25GgxU6oJefCkYtnmc` — the `Session` artboard is a working implementation of the round with the real animation timings. When this plan and the mock disagree about a pixel, the mock wins.

## Global Constraints

- **`packages/core` may not import from `node:`, `react`, `react-native`, or any filesystem API.** This is the constraint that makes a future web build cheap. A test that violates it is in Task 1.
- **Randomness is injected.** Core functions take an `Rng` (`() => number`) parameter; core never calls `Math.random()`.
- **Node 24+ runs TypeScript directly.** No bundler, no build step, no `tsc` emit for core. Relative imports inside core carry explicit `.ts` extensions — this is required by Node's type stripping, and Metro resolves them too.
- **TDD throughout.** Write the failing test, watch it fail, implement, watch it pass, commit.
- **Palette** (exact values; use the `theme` module, never a literal hex in a component):
  `ground #FBF6EC`, `surface #FFFFFF`, `ink #1C1714`, `muted #6B6259`, `chile #D1453B`, `cactus #2E7D5B`, `marigold #E9A020`.
- **Every card and button carries a 2px `ink` border and a hard offset shadow, never a blurred one.** This is what makes the UI belong to the cartoons.
- **Interface copy is in Spanish.** `¡Vamos!`, `Siguiente`, `¿Otra ronda?`, `Terminar por hoy`, `Se te atragantan`.
- **Touch targets are at least 44px.**
- **A wrong answer is never punishing.** Soft sound, no red flash of the whole screen, no life lost.
- **Repair answers never affect scheduling or stats.** Only the first answer to a word in a session counts.
- **Install Expo packages with `npx expo install <pkg>`, never `npm install <pkg>`** — it resolves the version matching SDK 57. Do not pin versions by hand.

---

## File Structure

**Phase 0 moves these:**

| From | To | Responsibility |
|---|---|---|
| `src/core/*.ts` | `packages/core/src/*.ts` | pure logic, unchanged |
| `src/storage/*.ts` | `tools/store/*.ts` | Node-only file storage for the CLI |
| `src/cli.ts` | `tools/cli.ts` | word-list authoring and validation |
| `apps/assets/*` | `apps/mobile/assets/*` | sprites, audio, photo |

**Phase 0 and 1 create these:**

| File | Responsibility |
|---|---|
| `packages/core/package.json` | workspace package `@pepe/core` |
| `packages/core/src/index.ts` | the single public surface of core |
| `packages/core/src/session.ts` | round progression, repair queue, elastic continuation — a pure reducer |
| `packages/core/src/session.test.ts` | its tests |
| `packages/core/src/noNodeImports.test.ts` | guards the constraint above |
| `tools/sprite_manifest.py` | names the extracted sprites and writes a manifest |
| `apps/mobile/app/_layout.tsx` | fonts, tabs, the storage provider |
| `apps/mobile/app/index.tsx` | home screen |
| `apps/mobile/app/session.tsx` | the round |
| `apps/mobile/theme.ts` | palette, type scale, the card/button recipes |
| `apps/mobile/components/Pepe.tsx` | the animated mascot |
| `apps/mobile/components/OptionButton.tsx` | one tappable answer |
| `apps/mobile/components/PressableCard.tsx` | the chunky-button press, shared |
| `apps/mobile/feedback.ts` | sound, haptics and speech behind one call |
| `apps/mobile/storage/progressStore.ts` | AsyncStorage implementation of progress persistence |
| `apps/mobile/storage/vocabulary.ts` | bundled seed words plus the sprite manifest |

---

# Phase 0 — groundwork

### Task 1: Restructure into npm workspaces

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/index.ts`, `packages/core/src/noNodeImports.test.ts`
- Move: `src/core/*` → `packages/core/src/`, `src/storage/*` → `tools/store/`, `src/cli.ts` → `tools/cli.ts`, `apps/assets/*` → `apps/mobile/assets/`
- Modify: `package.json`, `tsconfig.json`

**Interfaces:**
- Consumes: nothing.
- Produces: the package `@pepe/core`, whose `src/index.ts` re-exports every symbol later tasks import. `npm test` from the repo root runs all core tests.

- [ ] **Step 1: Move the files with git so history follows them**

```bash
mkdir -p packages/core/src tools/store apps/mobile
git mv src/core/dates.ts src/core/dates.test.ts src/core/leitner.ts src/core/leitner.test.ts \
       src/core/quiz.ts src/core/quiz.test.ts src/core/rng.ts src/core/select.ts \
       src/core/select.test.ts src/core/types.ts packages/core/src/
git mv src/storage/store.ts src/storage/fileStore.ts src/storage/fileStore.test.ts tools/store/
git mv src/cli.ts tools/cli.ts
git mv apps/assets apps/mobile/assets
rmdir src/core src/storage src 2>/dev/null || true
```

- [ ] **Step 2: Fix the import paths the move broke**

`tools/store/fileStore.ts` and `tools/store/store.ts` import core types via `../core/types.ts`. Change both to `@pepe/core`:

```bash
sed -i '' "s|from '../core/types.ts'|from '@pepe/core'|" tools/store/store.ts tools/store/fileStore.ts
sed -i '' "s|from './core/|from '@pepe/core'; // |" /dev/null 2>/dev/null || true
```

Then edit `tools/cli.ts` by hand. Replace its four core imports:

```typescript
import { buildQuestions, selectDaily, applyAnswer, freshProgress, isDue, INTERVALS,
         mulberry32, seedFromDate, todayISO } from '@pepe/core';
import type { Box, Progress } from '@pepe/core';
import { fileStore, projectRoot } from './store/fileStore.ts';
```

and in `tools/store/fileStore.ts` change `projectRoot` to climb one fewer level, since the file moved from `src/storage/` to `tools/store/` (both are two deep, so this line is unchanged — verify it still reads):

```typescript
export const projectRoot = join(import.meta.dirname, '..', '..');
```

- [ ] **Step 3: Write `packages/core/src/index.ts`**

```typescript
/** The public surface of core. Nothing outside reaches past this file. */
export * from './types.ts';
export * from './dates.ts';
export * from './rng.ts';
export * from './leitner.ts';
export * from './select.ts';
export * from './quiz.ts';
```

- [ ] **Step 4: Write `packages/core/package.json`**

```json
{
  "name": "@pepe/core",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "node --test 'src/**/*.test.ts'"
  }
}
```

- [ ] **Step 5: Write the test that guards the purity constraint**

Create `packages/core/src/noNodeImports.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The whole reason a web or Expo build is cheap is that core is pure. That is
 * easy to break by accident and invisible until the port, so it gets a test.
 */
test('core imports nothing from node:, react or react-native', async () => {
  const dir = import.meta.dirname;
  const files = (await readdir(dir)).filter(
    (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'),
  );
  assert.ok(files.length > 0, 'expected source files to scan');

  const offenders: string[] = [];
  for (const file of files) {
    const text = await readFile(join(dir, file), 'utf8');
    for (const m of text.matchAll(/from\s+'([^']+)'/g)) {
      const spec = m[1]!;
      if (spec.startsWith('node:') || spec === 'react' || spec === 'react-native') {
        offenders.push(`${file} imports ${spec}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});
```

- [ ] **Step 6: Run it and watch it pass**

Run: `node --test 'packages/core/src/noNodeImports.test.ts'`
Expected: PASS, 1 test. (It passes immediately — it is a guard, not a red-green cycle. If it fails, core was already impure and that is the bug to fix.)

- [ ] **Step 7: Write the root `package.json`**

```json
{
  "name": "pepe-habla",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "apps/mobile"],
  "description": "A Spanish vocabulary trainer. Core logic is platform-agnostic.",
  "scripts": {
    "test": "node --test 'packages/core/src/**/*.test.ts' 'tools/**/*.test.ts'",
    "typecheck": "tsc --noEmit",
    "practice": "node tools/cli.ts",
    "sprites": "python3 tools/extract_sprites.py",
    "sounds": "python3 tools/make_sounds.py apps/mobile/assets/audio/"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.10.0"
  }
}
```

- [ ] **Step 8: Point the root tsconfig at the new layout**

Replace `"include"` and add a path mapping so `@pepe/core` resolves during typecheck:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "allowImportingTsExtensions": true,
    "rewriteRelativeImportExtensions": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "types": ["node"],
    "baseUrl": ".",
    "paths": { "@pepe/core": ["packages/core/src/index.ts"] }
  },
  "include": ["packages/core/src/**/*.ts", "tools/**/*.ts"]
}
```

- [ ] **Step 9: Install so the workspace symlink exists, then verify everything still works**

```bash
npm install
npm test
npm run typecheck
node tools/cli.ts stats
```

Expected: 50 tests pass (49 existing plus the purity guard); typecheck clean; `stats` prints the same summary it printed before the move, reading `data/vocab.json`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Restructure into npm workspaces

Core becomes @pepe/core so the Expo app and the CLI share one copy. A test now
guards the rule that makes the port cheap: core imports nothing from node:,
react or react-native."
```

---

### Task 2: Fix sprite extraction and catalogue the full set

The first run produced 53 crops from 3 sheets, but 9 of them merged two or three neighbouring drawings that touch once dilated. Fix the merging, then name every sprite.

**Files:**
- Modify: `tools/extract_sprites.py`
- Create: `tools/sprite_manifest.py`, `apps/mobile/assets/pepe/manifest.json`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `apps/mobile/assets/pepe/manifest.json`, shape
  `{ "poses": { "idle": "pepe-idle.png", ... }, "vocab": { "el-taco": "vocab-taco.png", ... } }`.
  Task 6 and Task 10 read it via `apps/mobile/storage/vocabulary.ts`.

- [ ] **Step 1: Reduce the dilation and split blobs that are really two drawings**

In `tools/extract_sprites.py`, change `DILATION = 7` to `DILATION = 3`, then replace `find_drawings` with a version that rejects blobs whose bounding box is far larger than their filled area — the signature of two drawings joined by a thin bridge:

```python
def find_drawings(fg: np.ndarray, total: int) -> list[tuple[slice, slice]]:
    grown = ndimage.binary_dilation(fg, np.ones((DILATION, DILATION), bool))
    labels, count = ndimage.label(grown)

    boxes = []
    for i, sl in enumerate(ndimage.find_objects(labels), start=1):
        filled = int((labels[sl] == i).sum())
        if filled < total * MIN_AREA_FRACTION:
            continue
        area = (sl[0].stop - sl[0].start) * (sl[1].stop - sl[1].start)
        # Two drawings bridged by a whisker fill very little of their shared box.
        if filled / area < 0.22:
            boxes.extend(_split(labels == i, sl))
        else:
            boxes.append(sl)

    boxes.sort(key=lambda s: (round(s[0].start / 60), s[1].start))
    return boxes


def _split(mask: np.ndarray, sl) -> list[tuple[slice, slice]]:
    """Cut a merged blob at its emptiest row or column."""
    sub = mask[sl]
    rows = sub.sum(axis=1)
    cols = sub.sum(axis=0)
    # Prefer whichever axis has a clear gap nearer its middle.
    best = None
    for axis, profile in ((0, rows), (1, cols)):
        mid = len(profile) // 2
        window = range(int(len(profile) * 0.25), int(len(profile) * 0.75))
        if not window:
            continue
        cut = min(window, key=lambda i: (profile[i], abs(i - mid)))
        if profile[cut] <= profile.max() * 0.05:
            score = abs(cut - mid)
            if best is None or score < best[0]:
                best = (score, axis, cut)
    if best is None:
        return [sl]

    _, axis, cut = best
    ys, xs = sl
    if axis == 0:
        return [(slice(ys.start, ys.start + cut), xs),
                (slice(ys.start + cut, ys.stop), xs)]
    return [(ys, slice(xs.start, xs.start + cut)),
            (ys, slice(xs.start + cut, xs.stop))]
```

- [ ] **Step 2: Re-run extraction and count**

```bash
rm -rf images/sprites && mkdir -p images/sprites
for f in images/originals/0396b7e7*.jpeg images/originals/5f7d7642*.jpeg images/originals/9e3fbdef*.jpeg; do
  python3 tools/extract_sprites.py "$f" images/sprites/
done
ls images/sprites | wc -l
```

Expected: **65–75 sprites** (the sheets hold roughly 72 drawings). Fewer than 60 means blobs are still merging; more than 80 means `_split` is cutting single drawings in half.

- [ ] **Step 3: Look at every crop before trusting the number**

```bash
python3 - <<'PY'
from PIL import Image, ImageDraw
from pathlib import Path
files = sorted(Path('images/sprites').glob('*.png'))
CELL, COLS = 150, 8
rows = (len(files) + COLS - 1) // COLS
sheet = Image.new('RGB', (COLS*CELL, rows*CELL), (250, 250, 250))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGBA'); im.thumbnail((CELL-18, CELL-18))
    x, y = (i % COLS)*CELL, (i // COLS)*CELL
    sheet.paste(im, (x+(CELL-im.width)//2, y+14+(CELL-18-im.height)//2), im)
    d.rectangle([x, y, x+CELL-1, y+CELL-1], outline=(215, 215, 215))
    d.text((x+5, y+3), f.stem, fill=(90, 90, 90))
sheet.save('/tmp/contact.png')
print('wrote /tmp/contact.png —', len(files), 'sprites')
PY
```

Open `/tmp/contact.png` and confirm: one drawing per cell, no dog cut in half, no stray fragments. If any cell still holds two drawings, lower the `0.22` fill threshold; if a dog is split, raise it.

- [ ] **Step 4: Write the manifest tool**

Create `tools/sprite_manifest.py`:

```python
"""
Name the extracted sprites and write the manifest the app reads.

Extraction produces numbered crops; this maps the ones we use to roles and to
vocabulary ids. Edit POSES and VOCAB after looking at the contact sheet — the
numbers change whenever extraction is retuned.

Usage:  python tools/sprite_manifest.py
"""
import json
import shutil
from pathlib import Path

SRC = Path('images/sprites')
OUT = Path('apps/mobile/assets/pepe')

# Emotional states. These drive the mascot; every one is required.
POSES = {
    'idle':     '9e3fbdef-02',
    'happy':    '9e3fbdef-01',
    'sad':      '5f7d7642-04',
    'excited':  '5f7d7642-02',
    'sleeping': '9e3fbdef-03',
    'hero':     '9e3fbdef-04',
}

# Costume drawings that illustrate a word. Keys are word ids from data/seed.
VOCAB = {
    'el-taco':      '5f7d7642-03',
    'la-guitarra':  '5f7d7642-01',
    'cocinar':      '0396b7e7-01',
    'el-sombrero':  '5f7d7642-16',
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {'poses': {}, 'vocab': {}}
    missing = []

    for role, stem in POSES.items():
        src = SRC / f'{stem}.png'
        if not src.exists():
            missing.append(f'pose {role} -> {stem}')
            continue
        name = f'pepe-{role}.png'
        shutil.copy(src, OUT / name)
        manifest['poses'][role] = name

    for word_id, stem in VOCAB.items():
        src = SRC / f'{stem}.png'
        if not src.exists():
            missing.append(f'vocab {word_id} -> {stem}')
            continue
        name = f'vocab-{word_id}.png'
        shutil.copy(src, OUT / name)
        manifest['vocab'][word_id] = name

    if missing:
        raise SystemExit('Missing sprites:\n  ' + '\n  '.join(missing))

    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'{len(manifest["poses"])} poses, {len(manifest["vocab"])} vocab sprites')


if __name__ == '__main__':
    main()
```

- [ ] **Step 5: Reconcile the stems with the new numbering, then run it**

The numbers in `POSES` and `VOCAB` come from the *old* extraction. Open `/tmp/contact.png`, find the same drawings, and update each stem to its new filename. Then:

```bash
python3 tools/sprite_manifest.py
cat apps/mobile/assets/pepe/manifest.json
```

Expected: `6 poses, 4 vocab sprites` and a manifest listing them. A `SystemExit` naming a missing sprite means a stem is still wrong.

- [ ] **Step 6: Check every vocab id actually exists in the seed data**

```bash
node -e "
const fs = require('fs');
const words = ['tier1','tier2','tier3'].flatMap(t => require('./data/seed/'+t+'.json'));
const ids = new Set(words.map(w => w.id));
const m = require('./apps/mobile/assets/pepe/manifest.json');
const bad = Object.keys(m.vocab).filter(id => !ids.has(id));
console.log(bad.length ? 'NOT IN SEED DATA: ' + bad.join(', ') : 'all vocab ids valid');
"
```

Expected: `all vocab ids valid`. Anything listed must either be added to `data/seed/` or dropped from `VOCAB` — a manifest pointing at a word that does not exist will crash question building in Task 4.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Fix sprite extraction merging and add a manifest

Drawings that touch after dilation were merging into one crop. Dilation drops
to 3 and blobs that fill little of their bounding box are cut at their emptiest
row or column. Adds the manifest the app reads to find poses and word art."
```

---

# Phase 1 — the app

### Task 3: The session state machine

Round progression, the repair queue and elastic continuation live in core as a pure reducer. This is the part most likely to have subtle bugs, and putting it here means it can be tested without a simulator.

**Files:**
- Create: `packages/core/src/session.ts`, `packages/core/src/session.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Question`, `Direction` from `./types.ts`.
- Produces:
  `startSession(questions: Question[]): SessionState`,
  `reduce(state: SessionState, event: SessionEvent): SessionState`,
  `currentQuestion(state: SessionState): Question | null`,
  `roundScore(state): { right: number; total: number }`,
  `sessionScore(state): { right: number; total: number }`,
  types `SessionState`, `SessionEvent`, `SessionPhase`, `AnswerRecord`.
  Tasks 10 and 11 drive the whole session screen through these.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/session.test.ts`:

```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  startSession, reduce, currentQuestion, roundScore, sessionScore,
} from './session.ts';
import type { Question, Word } from './types.ts';

const word = (id: string): Word => ({ id, es: `es-${id}`, en: `en-${id}`, pos: 'noun', tier: 1 });

const q = (id: string): Question => ({
  word: word(id),
  direction: 'es->en',
  prompt: `es-${id}`,
  options: [`en-${id}`, 'wrong-a', 'wrong-b', 'wrong-c'],
  answer: `en-${id}`,
});

const right = (question: Question, ms = 1200) =>
  ({ type: 'answer', option: question.answer, ms }) as const;
const wrong = (ms = 1200) => ({ type: 'answer', option: 'wrong-a', ms }) as const;
const next = () => ({ type: 'next' }) as const;

describe('startSession', () => {
  test('opens asking the first question', () => {
    const s = startSession([q('a'), q('b')]);
    assert.equal(s.phase, 'asking');
    assert.equal(s.round, 1);
    assert.equal(currentQuestion(s)?.word.id, 'a');
    assert.deepEqual(s.results, []);
  });
});

describe('answering', () => {
  test('a correct answer moves to feedback and is recorded', () => {
    const qs = [q('a'), q('b')];
    const s = reduce(startSession(qs), right(qs[0]!));
    assert.equal(s.phase, 'feedback');
    assert.equal(s.picked, 'en-a');
    assert.deepEqual(s.results.map((r) => [r.wordId, r.correct]), [['a', true]]);
  });

  test('a wrong answer is recorded and queued for repair', () => {
    const s = reduce(startSession([q('a'), q('b')]), wrong());
    assert.equal(s.phase, 'feedback');
    assert.deepEqual(s.results.map((r) => [r.wordId, r.correct]), [['a', false]]);
    assert.deepEqual(s.repair.map((x) => x.word.id), ['a']);
  });

  test('response time is kept, for the phase 3 scheduler', () => {
    const qs = [q('a')];
    const s = reduce(startSession(qs), right(qs[0]!, 850));
    assert.equal(s.results[0]?.ms, 850);
  });

  test('a second answer during feedback is ignored', () => {
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
  });
});

describe('advancing', () => {
  test('next moves to the following question', () => {
    const qs = [q('a'), q('b')];
    const s = reduce(reduce(startSession(qs), right(qs[0]!)), next());
    assert.equal(s.phase, 'asking');
    assert.equal(currentQuestion(s)?.word.id, 'b');
  });

  test('a clean round goes straight to the summary', () => {
    const qs = [q('a')];
    const s = reduce(reduce(startSession(qs), right(qs[0]!)), next());
    assert.equal(s.phase, 'summary');
    assert.equal(currentQuestion(s), null);
  });

  test('a round with misses goes to repair instead', () => {
    const s = reduce(reduce(startSession([q('a')]), wrong()), next());
    assert.equal(s.phase, 'repairing');
    assert.equal(currentQuestion(s)?.word.id, 'a');
  });
});

describe('repair', () => {
  test('repair answers are NOT recorded — being told is not recall', () => {
    const qs = [q('a'), q('b')];
    let s = startSession(qs);
    s = reduce(s, wrong());            // miss a
    s = reduce(s, next());
    s = reduce(s, right(qs[1]!));      // get b
    s = reduce(s, next());             // -> repairing
    assert.equal(s.phase, 'repairing');

    const before = s.results.length;
    s = reduce(s, right(qs[0]!));      // now get a right, in repair
    assert.equal(s.phase, 'repair-feedback');
    assert.equal(s.results.length, before, 'repair must not add a result');
    assert.deepEqual(sessionScore(s), { right: 1, total: 2 });
  });

  test('repair walks every miss, then reaches the summary', () => {
    const qs = [q('a'), q('b')];
    let s = startSession(qs);
    s = reduce(s, wrong()); s = reduce(s, next());
    s = reduce(s, wrong()); s = reduce(s, next());
    assert.equal(s.phase, 'repairing');
    assert.equal(currentQuestion(s)?.word.id, 'a');

    s = reduce(s, right(qs[0]!)); s = reduce(s, next());
    assert.equal(currentQuestion(s)?.word.id, 'b');

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
  });

  test('roundScore counts this round, sessionScore counts everything', () => {
    const qs = [q('a')];
    let s = reduce(reduce(startSession(qs), right(qs[0]!)), next());
    s = reduce(s, { type: 'anotherRound', questions: [q('c')] });
    s = reduce(s, wrong());

    assert.deepEqual(roundScore(s), { right: 0, total: 1 });
    assert.deepEqual(sessionScore(s), { right: 1, total: 2 });
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

- [ ] **Step 2: Run the tests and watch them fail**

Run: `node --test 'packages/core/src/session.test.ts'`
Expected: FAIL — `Cannot find module './session.ts'`.

- [ ] **Step 3: Write `packages/core/src/session.ts`**

```typescript
import type { Direction, Question } from './types.ts';

/**
 * A practice session as a pure reducer.
 *
 * A round is a fixed list of questions. Miss one and it joins the repair queue,
 * which runs at the end of the round. When the round is done you may take
 * another — rounds are elastic, and only the first is needed for the streak.
 *
 * The rule that matters most: a repair answer is never recorded. Getting a word
 * right ten seconds after being shown the answer is recognition, not recall,
 * and letting it count would corrupt every interval the scheduler derives.
 */
export type SessionPhase =
  | 'asking'
  | 'feedback'
  | 'repairing'
  | 'repair-feedback'
  | 'summary'
  | 'finished';

export interface AnswerRecord {
  wordId: string;
  direction: Direction;
  correct: boolean;
  /** Milliseconds from question shown to answer tapped. */
  ms: number;
  round: number;
}

export interface SessionState {
  round: number;
  queue: Question[];
  index: number;
  phase: SessionPhase;
  /** The option the learner tapped, or null while asking. */
  picked: string | null;
  /** First answers only, across every round of this session. */
  results: AnswerRecord[];
  repair: Question[];
  repairIndex: number;
}

export type SessionEvent =
  | { type: 'answer'; option: string; ms: number }
  | { type: 'next' }
  | { type: 'anotherRound'; questions: Question[] }
  | { type: 'finish' };

export function startSession(questions: Question[]): SessionState {
  return {
    round: 1,
    queue: questions,
    index: 0,
    phase: questions.length > 0 ? 'asking' : 'summary',
    picked: null,
    results: [],
    repair: [],
    repairIndex: 0,
  };
}

export function currentQuestion(state: SessionState): Question | null {
  if (state.phase === 'asking' || state.phase === 'feedback') {
    return state.queue[state.index] ?? null;
  }
  if (state.phase === 'repairing' || state.phase === 'repair-feedback') {
    return state.repair[state.repairIndex] ?? null;
  }
  return null;
}

export function reduce(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case 'answer':
      return answer(state, event.option, event.ms);
    case 'next':
      return advance(state);
    case 'anotherRound':
      return {
        ...state,
        round: state.round + 1,
        queue: event.questions,
        index: 0,
        phase: event.questions.length > 0 ? 'asking' : 'summary',
        picked: null,
        repair: [],
        repairIndex: 0,
      };
    case 'finish':
      return { ...state, phase: 'finished', picked: null };
  }
}

function answer(state: SessionState, option: string, ms: number): SessionState {
  const question = currentQuestion(state);
  if (question === null) return state;

  if (state.phase === 'repairing') {
    // Deliberately records nothing.
    return { ...state, phase: 'repair-feedback', picked: option };
  }
  if (state.phase !== 'asking') return state;

  const correct = option === question.answer;
  return {
    ...state,
    phase: 'feedback',
    picked: option,
    results: [...state.results, {
      wordId: question.word.id,
      direction: question.direction,
      correct,
      ms,
      round: state.round,
    }],
    repair: correct ? state.repair : [...state.repair, question],
  };
}

function advance(state: SessionState): SessionState {
  if (state.phase === 'feedback') {
    const index = state.index + 1;
    if (index < state.queue.length) {
      return { ...state, index, phase: 'asking', picked: null };
    }
    return state.repair.length > 0
      ? { ...state, index, phase: 'repairing', repairIndex: 0, picked: null }
      : { ...state, index, phase: 'summary', picked: null };
  }

  if (state.phase === 'repair-feedback') {
    const repairIndex = state.repairIndex + 1;
    return repairIndex < state.repair.length
      ? { ...state, repairIndex, phase: 'repairing', picked: null }
      : { ...state, repairIndex, phase: 'summary', picked: null };
  }

  return state;
}

const tally = (records: AnswerRecord[]) => ({
  right: records.filter((r) => r.correct).length,
  total: records.length,
});

export const roundScore = (state: SessionState) =>
  tally(state.results.filter((r) => r.round === state.round));

export const sessionScore = (state: SessionState) => tally(state.results);
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `node --test 'packages/core/src/session.test.ts'`
Expected: PASS, 14 tests.

- [ ] **Step 5: Export it from core**

Add to `packages/core/src/index.ts`:

```typescript
export * from './session.ts';
```

- [ ] **Step 6: Run everything**

Run: `npm test && npm run typecheck`
Expected: 64 tests pass, typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/session.ts packages/core/src/session.test.ts packages/core/src/index.ts
git commit -m "Add the session state machine

A pure reducer over rounds, the repair queue and elastic continuation. Repair
answers are deliberately not recorded: being shown the answer and repeating it
is recognition, not recall, and counting it would corrupt every interval the
scheduler later derives."
```

---

### Task 4: Four question types

Today `buildQuestions` produces two directions. Add listening and picture questions, and the mix that decides which a word gets.

**Files:**
- Modify: `packages/core/src/types.ts`, `packages/core/src/quiz.ts`, `packages/core/src/quiz.test.ts`

**Interfaces:**
- Consumes: `Word`, `Rng`, `shuffle` from core.
- Produces: `Direction` widened to `'es->en' | 'en->es' | 'listen->en' | 'picture->es'`; `Word` gains optional `sprite?: string`; `Question` gains optional `promptImage?: string`. `buildQuestions` keeps its signature `(selected, pool, rng) => Question[]`. Task 10 renders from `direction`, `prompt` and `promptImage`.

- [ ] **Step 1: Widen the types**

In `packages/core/src/types.ts`, replace the `Direction` type and add the two optional fields:

```typescript
/** Which way a question is asked. */
export type Direction = 'es->en' | 'en->es' | 'listen->en' | 'picture->es';
```

In `interface Word`, after `tier`, add:

```typescript
  /** Asset key for Pepe art illustrating this word, when it exists. */
  sprite?: string;
```

In `interface Question`, after `prompt`, add:

```typescript
  /** Asset key to show instead of text, for picture questions. */
  promptImage?: string;
```

- [ ] **Step 2: Write the failing tests**

Append to `packages/core/src/quiz.test.ts`:

```typescript
describe('four question types', () => {
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

  test('a listening question is answered in English and carries the Spanish to speak', () => {
    const qs = buildQuestions(pool.slice(0, 10), pool, mulberry32(3));
    const listens = qs.filter((q) => q.direction === 'listen->en');
    assert.ok(listens.length > 0, 'expected at least one listening question in ten');
    for (const q of listens) {
      assert.equal(q.prompt, q.word.es, 'prompt is the Spanish the app will speak');
      assert.equal(q.answer, q.word.en);
      assert.equal(q.promptImage, undefined);
    }
  });

  test('over ten words the mix is roughly 4 / 3 / 2 / 1', () => {
    const qs = buildQuestions(withSprites.slice(0, 10), withSprites, mulberry32(5));
    const count = (d: string) => qs.filter((q) => q.direction === d).length;
    assert.equal(count('picture->es'), 1);
    assert.equal(count('listen->en'), 2);
    assert.equal(count('en->es'), 3);
    assert.equal(count('es->en'), 4);
  });

  test('a word with no art never gets a picture question', () => {
    const qs = buildQuestions(pool.slice(0, 10), pool, mulberry32(7));
    assert.equal(qs.filter((q) => q.direction === 'picture->es').length, 0);
  });

  test('picture and listening options are still four distinct plausible words', () => {
    const qs = buildQuestions(withSprites.slice(0, 10), withSprites, mulberry32(9));
    for (const q of qs) {
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options).size, 4);
      assert.ok(q.options.includes(q.answer));
    }
  });
});
```

- [ ] **Step 3: Update the three existing tests the widening breaks**

Two existing tests assume only two directions exist. In `packages/core/src/quiz.test.ts`:

Replace the body of `'mixes both directions over ten words'`:

```typescript
  test('mixes both directions over ten words', () => {
    const qs = buildQuestions(pool.slice(0, 10), pool, mulberry32(9));
    const dirs = new Set(qs.map((q) => q.direction));
    assert.ok(dirs.has('es->en') && dirs.has('en->es'),
      'expected both reading directions among ten questions');
  });
```

Replace the body of `'prompt and answer follow the direction'`:

```typescript
  test('prompt and answer follow the direction', () => {
    const qs = buildQuestions(pool.slice(0, 10), pool, mulberry32(5));
    for (const q of qs) {
      if (q.direction === 'en->es') {
        assert.equal(q.prompt, q.word.en);
        assert.equal(q.answer, q.word.es);
      } else if (q.direction === 'picture->es') {
        assert.equal(q.answer, q.word.es);
      } else {
        assert.equal(q.prompt, q.word.es);
        assert.equal(q.answer, q.word.en);
      }
    }
  });
```

And in `'distractors match the part of speech when enough exist'`, replace the line building `byText` so it uses the answer language rather than assuming two directions:

```typescript
    const answerText = (w: Word) =>
      (q.direction === 'en->es' || q.direction === 'picture->es') ? w.es : w.en;
    const byText = new Map(mixed.map((w) => [answerText(w), w]));
```

- [ ] **Step 4: Run the tests and watch them fail**

Run: `node --test 'packages/core/src/quiz.test.ts'`
Expected: FAIL — the mix test reports 0 picture questions and 0 listening questions, because `buildQuestions` still only produces two directions.

- [ ] **Step 5: Rewrite the direction planning in `packages/core/src/quiz.ts`**

Replace `show`, `solve` and `directionsFor` with:

```typescript
/** Which language the learner answers in. */
const answersInEnglish = (d: Direction): boolean =>
  d === 'es->en' || d === 'listen->en';

const solve = (w: Word, d: Direction): string =>
  answersInEnglish(d) ? w.en : w.es;

const show = (w: Word, d: Direction): string => {
  if (d === 'picture->es') return '';        // the art is the prompt
  return d === 'en->es' ? w.en : w.es;       // listen->en carries the Spanish to speak
};

/**
 * Decide how each word is asked: roughly 40% recognition, 30% production,
 * 20% listening, 10% picture.
 *
 * Picture questions need art, so they are allocated first and only to words
 * that have it; a word without art falls through to the next type rather than
 * losing its slot.
 */
function planDirections(words: readonly Word[], rng: Rng): Direction[] {
  const n = words.length;
  const wantPicture = Math.round(n * 0.1);
  const wantListen = Math.round(n * 0.2);
  const wantProduce = Math.round(n * 0.3);

  const plan: Direction[] = new Array(n).fill('es->en');
  let pictures = 0;
  let listens = 0;
  let produces = 0;

  for (const i of shuffle(words.map((_, idx) => idx), rng)) {
    const w = words[i]!;
    if (pictures < wantPicture && w.sprite) {
      plan[i] = 'picture->es';
      pictures += 1;
    } else if (listens < wantListen) {
      plan[i] = 'listen->en';
      listens += 1;
    } else if (produces < wantProduce) {
      plan[i] = 'en->es';
      produces += 1;
    }
  }
  return plan;
}
```

- [ ] **Step 6: Use the plan when building each question**

In `buildQuestions`, replace `const directions = directionsFor(selected.length, rng);` with:

```typescript
  const directions = planDirections(selected, rng);
```

and replace the returned object so it carries the art:

```typescript
    return {
      word,
      direction,
      prompt: show(word, direction),
      promptImage: direction === 'picture->es' ? word.sprite : undefined,
      options: shuffle([answer, ...distractors], rng),
      answer,
    };
```

- [ ] **Step 7: Run the tests and watch them pass**

Run: `node --test 'packages/core/src/quiz.test.ts'`
Expected: PASS — 16 tests, including the four new ones.

- [ ] **Step 8: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/quiz.ts packages/core/src/quiz.test.ts
git commit -m "Add listening and picture question types

Roughly 40/30/20/10 recognition, production, listening, picture. Picture slots
are allocated first and only to words that have art; a word without art falls
through to the next type rather than wasting the slot."
```

---

### Task 5: Expo app, design system, and proof that core is wired in

**Files:**
- Create: `apps/mobile/` (scaffolded), `apps/mobile/metro.config.js`, `apps/mobile/theme.ts`, `apps/mobile/components/PressableCard.tsx`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app/index.tsx`
- Modify: `apps/mobile/package.json`

**Interfaces:**
- Consumes: `@pepe/core` (any export, to prove resolution).
- Produces: `colour`, `font`, `radius` and `space` from `./theme.ts`; `<PressableCard>` with props `{ depth?: number; face?: string; onPress?: () => void; disabled?: boolean; style?: ViewStyle; children: ReactNode }`. Tasks 9, 10 and 11 build every surface from these.

- [ ] **Step 1: Scaffold the app inside the workspace**

```bash
npx create-expo-app@latest apps/mobile --template blank-typescript --no-install
cd apps/mobile
npx expo install expo-router react-native-safe-area-context react-native-screens \
  expo-linking expo-constants expo-status-bar react-native-reanimated \
  expo-font @expo-google-fonts/fraunces @expo-google-fonts/figtree
cd ../..
npm install
```

- [ ] **Step 2: Point the app at expo-router and at core**

Edit `apps/mobile/package.json`: set `"main": "expo-router/entry"`, and add core as a dependency so the workspace links it:

```json
  "main": "expo-router/entry",
  "dependencies": {
    "@pepe/core": "*"
  }
```

(Keep every dependency `expo install` already added; just merge `@pepe/core` in.)

In `apps/mobile/app.json`, inside `expo`, add the router plugin and a scheme:

```json
    "scheme": "pepehabla",
    "plugins": ["expo-router"]
```

- [ ] **Step 3: Teach Metro about the monorepo**

Create `apps/mobile/metro.config.js`. Without this, Metro cannot see `packages/core` because it lives outside the app folder:

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so edits in packages/core trigger a reload.
config.watchFolders = [workspaceRoot];
// Resolve from the app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Core is TypeScript source with explicit .ts import extensions.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

- [ ] **Step 4: Write `apps/mobile/theme.ts`**

```typescript
/**
 * The design system, lifted from the approved mockups.
 *
 * The governing idea: the interface borrows the cartoons' own drawing style —
 * a 2px near-black outline and a flat fill on every surface, with hard offset
 * shadows rather than blurred ones. That is what stops Pepe looking pasted on
 * top of a generic app.
 */
export const colour = {
  ground: '#FBF6EC',
  surface: '#FFFFFF',
  ink: '#1C1714',
  muted: '#6B6259',
  chile: '#D1453B',
  cactus: '#2E7D5B',
  marigold: '#E9A020',
} as const;

export const font = {
  display: 'Fraunces_800ExtraBold',
  displayHeavy: 'Fraunces_900Black',
  body: 'Figtree_600SemiBold',
  bodyHeavy: 'Figtree_800ExtraBold',
} as const;

export const radius = { pill: 999, card: 16, button: 14 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

/** Borders are always this. Fills vary; the outline does not. */
export const outline = { borderWidth: 2, borderColor: colour.ink } as const;
```

- [ ] **Step 5: Write `apps/mobile/components/PressableCard.tsx`**

React Native's `shadow*` props blur on iOS and `elevation` blurs on Android, so neither gives the hard offset the design needs. Draw the shadow as a solid slab behind the face instead — identical on both platforms, and it animates for free.

```tsx
import type { ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { colour, outline, radius } from '../theme';

interface Props {
  children: ReactNode;
  /** How far the face floats above its shadow slab. */
  depth?: number;
  face?: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

/**
 * A surface with a hard offset shadow that sinks when pressed.
 *
 * The shadow is a solid View behind the face rather than a shadow property,
 * because both platforms' native shadows are blurred and this design is not.
 */
export function PressableCard({
  children, depth = 4, face = colour.surface, onPress, disabled, style,
}: Props) {
  const sunk = useSharedValue(0);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -depth + sunk.value * depth }],
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      onPressIn={() => { sunk.value = withTiming(1, { duration: 60 }); }}
      onPressOut={() => { sunk.value = withTiming(0, { duration: 110 }); }}
      style={[{ borderRadius: radius.card, backgroundColor: colour.ink }, style]}
    >
      <Animated.View
        style={[
          { borderRadius: radius.card, backgroundColor: face, marginBottom: depth },
          outline,
          faceStyle,
        ]}
      >
        <View>{children}</View>
      </Animated.View>
    </Pressable>
  );
}
```

- [ ] **Step 6: Write `apps/mobile/app/_layout.tsx`**

```tsx
import { useFonts } from 'expo-font';
import {
  Fraunces_800ExtraBold, Fraunces_900Black,
} from '@expo-google-fonts/fraunces';
import { Figtree_600SemiBold, Figtree_800ExtraBold } from '@expo-google-fonts/figtree';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colour } from '../theme';

export default function RootLayout() {
  const [ready] = useFonts({
    Fraunces_800ExtraBold, Fraunces_900Black,
    Figtree_600SemiBold, Figtree_800ExtraBold,
  });

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colour.ground },
        }}
      />
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 7: Write a temporary `apps/mobile/app/index.tsx` that proves core resolves**

This screen is replaced in Task 9. Its only job is to fail loudly now if Metro cannot import `@pepe/core`.

```tsx
import { Text, View } from 'react-native';
import { INTERVALS, todayISO, mulberry32 } from '@pepe/core';
import { PressableCard } from '../components/PressableCard';
import { colour, font, space } from '../theme';

export default function Home() {
  const proof = `${todayISO()} · boxes ${Object.values(INTERVALS).join('/')} · rng ${mulberry32(1)().toFixed(3)}`;

  return (
    <View style={{ flex: 1, backgroundColor: colour.ground, justifyContent: 'center', padding: space.xl }}>
      <PressableCard onPress={() => {}}>
        <View style={{ padding: space.lg }}>
          <Text style={{ fontFamily: font.display, fontSize: 24, color: colour.ink }}>
            Pepe Habla
          </Text>
          <Text style={{ fontFamily: font.body, fontSize: 14, color: colour.muted, marginTop: space.xs }}>
            {proof}
          </Text>
        </View>
      </PressableCard>
    </View>
  );
}
```

- [ ] **Step 8: Run it on the simulator and look at it**

```bash
cd apps/mobile && npx expo start --clear
```

Press `i` for iOS. Confirm on screen:
1. Today's date, `boxes 1/2/4/8/16`, and an rng value — this is core running inside the app.
2. Fraunces on the title, Figtree on the line below.
3. Pressing the card makes it sink into its shadow.

If Metro fails to resolve `@pepe/core`, the likely cause is the `.ts` import extensions inside core. Check the error names a file under `packages/core`; if so, confirm `config.resolver.sourceExts` includes `ts` (it does by default) and that `npm install` created `node_modules/@pepe/core` as a symlink.

- [ ] **Step 9: Check it on Android too, before more is built on top**

Press `a` in the same Expo session (or `npx expo start --android`). Confirm the card's hard shadow looks identical to iOS — this is the check that the shadow-slab approach worked. If the shadow is blurred, a native shadow prop leaked in somewhere.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Scaffold the Expo app with the design system

Metro is configured for the workspace so the app and the CLI share one copy of
core, and the home screen renders values from it as proof. Hard shadows are
drawn as a solid slab behind each face, because both platforms' native shadows
are blurred and this design is not."
```

---

### Task 6: Vocabulary and progress storage

**Files:**
- Create: `apps/mobile/storage/vocabulary.ts`, `apps/mobile/storage/progressStore.ts`
- Modify: `apps/mobile/package.json` (adds AsyncStorage)

**Interfaces:**
- Consumes: `VocabDb`, `Progress`, `Word` from `@pepe/core`; `apps/mobile/assets/pepe/manifest.json` from Task 2.
- Produces:
  `WORDS: Word[]` (every seed word, with `sprite` filled in where art exists),
  `SPRITES: Record<string, ReturnType<typeof require>>` (asset name → required module, for `<Image source>`),
  `loadProgress(): Promise<VocabDb>`,
  `saveProgress(db: VocabDb): Promise<void>`,
  `recordAnswers(db, records, today): VocabDb`.
  Tasks 9, 10 and 11 read `WORDS` and call `loadProgress` / `saveProgress` / `recordAnswers`.

- [ ] **Step 1: Add AsyncStorage**

```bash
cd apps/mobile && npx expo install @react-native-async-storage/async-storage && cd ../..
```

- [ ] **Step 2: Write `apps/mobile/storage/vocabulary.ts`**

```typescript
import type { Word } from '@pepe/core';
import tier1 from '../../../data/seed/tier1.json';
import tier2 from '../../../data/seed/tier2.json';
import tier3 from '../../../data/seed/tier3.json';
import manifest from '../assets/pepe/manifest.json';

/**
 * The word list, bundled at build time, with Pepe's art attached.
 *
 * Words come from the repo rather than the network: the app is offline, and
 * the list only changes when a new build ships anyway.
 */
const SEED = [...tier1, ...tier2, ...tier3] as Word[];

export const WORDS: Word[] = SEED.map((w) => {
  const sprite = (manifest.vocab as Record<string, string>)[w.id];
  return sprite ? { ...w, sprite } : w;
});

/**
 * Metro needs every asset path as a literal `require`, so the manifest cannot
 * be used to build paths dynamically. Poses are listed explicitly here; word
 * art is looked up by the filename the manifest gave it.
 */
export const POSES = {
  idle: require('../assets/pepe/pepe-idle.png'),
  happy: require('../assets/pepe/pepe-happy.png'),
  sad: require('../assets/pepe/pepe-sad.png'),
  excited: require('../assets/pepe/pepe-excited.png'),
  sleeping: require('../assets/pepe/pepe-sleeping.png'),
  hero: require('../assets/pepe/pepe-hero.png'),
} as const;

export type PoseName = keyof typeof POSES;

export const VOCAB_ART: Record<string, number> = {
  'vocab-el-taco.png': require('../assets/pepe/vocab-el-taco.png'),
  'vocab-la-guitarra.png': require('../assets/pepe/vocab-la-guitarra.png'),
  'vocab-cocinar.png': require('../assets/pepe/vocab-cocinar.png'),
  'vocab-el-sombrero.png': require('../assets/pepe/vocab-el-sombrero.png'),
};

export const PEPE_PHOTO = require('../assets/photo/pepe-real.jpg');
```

If Task 2's manifest ended up with different vocab ids, update `VOCAB_ART` and the `manifest.json` together — the keys here must match the filenames the manifest lists.

- [ ] **Step 3: Write `apps/mobile/storage/progressStore.ts`**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyAnswer, freshProgress, type VocabDb } from '@pepe/core';
import type { AnswerRecord } from '@pepe/core';
import seededProgress from '../../../data/vocab.json';

const KEY = 'pepe-habla/progress/v1';

/**
 * Progress lives on the phone. The repo's data/vocab.json seeds the very first
 * launch so the words already practised on the CLI are not thrown away; after
 * that the phone is the only source of truth.
 */
export async function loadProgress(): Promise<VocabDb> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw !== null) {
    try {
      return JSON.parse(raw) as VocabDb;
    } catch {
      // A corrupt blob should cost you your history, not the app.
      return seededProgress as VocabDb;
    }
  }
  return seededProgress as VocabDb;
}

export async function saveProgress(db: VocabDb): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(db));
}

/**
 * Fold a round's answers into progress.
 *
 * Called at round boundaries rather than per answer: at full vocabulary size
 * the blob is several hundred kilobytes, and rewriting it after every tap
 * would stutter the animations.
 */
export function recordAnswers(
  db: VocabDb,
  records: readonly AnswerRecord[],
  today: string,
): VocabDb {
  const progress = { ...db.progress };
  for (const record of records) {
    const before = progress[record.wordId] ?? freshProgress(record.wordId, today);
    progress[record.wordId] = applyAnswer(before, record.correct, today);
  }
  return { ...db, progress };
}
```

- [ ] **Step 4: Allow importing JSON from outside the app folder**

`data/seed/*.json` sits above `apps/mobile`. Metro already watches the workspace root from Task 5, but TypeScript needs `resolveJsonModule`. In `apps/mobile/tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "resolveJsonModule": true,
    "paths": { "@pepe/core": ["../../packages/core/src/index.ts"] }
  },
  "include": ["**/*.ts", "**/*.tsx", "../../packages/core/src/**/*.ts"]
}
```

- [ ] **Step 5: Prove it round-trips on the device**

Temporarily replace the body of `apps/mobile/app/index.tsx` with a check, run it, and read the screen:

```tsx
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { todayISO } from '@pepe/core';
import { WORDS } from '../storage/vocabulary';
import { loadProgress, saveProgress, recordAnswers } from '../storage/progressStore';
import { colour, font, space } from '../theme';

export default function Home() {
  const [line, setLine] = useState('checking…');

  useEffect(() => {
    (async () => {
      const db = await loadProgress();
      const known = Object.keys(db.progress).length;
      const next = recordAnswers(db, [{
        wordId: WORDS[0]!.id, direction: 'es->en', correct: true, ms: 900, round: 1,
      }], todayISO());
      await saveProgress(next);
      const back = await loadProgress();
      const art = WORDS.filter((w) => w.sprite).length;
      setLine(`${WORDS.length} words · ${art} with art · ${known} known · saved ${Object.keys(back.progress).length}`);
    })();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colour.ground, justifyContent: 'center', padding: space.xl }}>
      <Text style={{ fontFamily: font.body, fontSize: 15, color: colour.ink }}>{line}</Text>
    </View>
  );
}
```

Run it. Expected on screen: `381 words · 4 with art · 10 known · saved 10` or `saved 11` if the first word was new. Reload the app — `known` should now match what was saved, proving it persisted rather than falling back to the seed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Bundle the vocabulary and persist progress on the phone

data/vocab.json seeds the first launch so CLI practice is not lost; after that
AsyncStorage is the only source of truth. Answers are folded in at round
boundaries, not per tap — the blob gets large enough that rewriting it mid-round
would stutter the animations."
```

---

### Task 7: Pepe, animated

**Files:**
- Create: `apps/mobile/components/Pepe.tsx`

**Interfaces:**
- Consumes: `POSES`, `PoseName` from `../storage/vocabulary`.
- Produces: `<Pepe pose={PoseName} motion={Motion} size={number} />` where
  `type Motion = 'still' | 'breathe' | 'hop' | 'shake' | 'celebrate'`.
  Tasks 9, 10 and 11 use it.

- [ ] **Step 1: Write `apps/mobile/components/Pepe.tsx`**

Timings are from the approved mock, not invented.

```tsx
import { useEffect } from 'react';
import { Image } from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { POSES, type PoseName } from '../storage/vocabulary';

export type Motion = 'still' | 'breathe' | 'hop' | 'shake' | 'celebrate';

interface Props {
  pose: PoseName;
  motion?: Motion;
  size: number;
}

const AnimatedImage = Animated.createAnimatedComponent(Image);

/**
 * The mascot.
 *
 * Everything animates about the bottom edge: squash and stretch only reads as
 * weight if the character pivots on the ground rather than its middle, which is
 * why `transformOrigin` is set rather than left at the default centre.
 */
export function Pepe({ pose, motion = 'breathe', size }: Props) {
  const lift = useSharedValue(0);
  const squashX = useSharedValue(1);
  const squashY = useSharedValue(1);
  const tilt = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(lift);
    cancelAnimation(squashX);
    cancelAnimation(squashY);
    cancelAnimation(tilt);
    lift.value = 0; squashX.value = 1; squashY.value = 1; tilt.value = 0;

    const ease = Easing.inOut(Easing.ease);

    if (motion === 'breathe') {
      lift.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 1450, easing: ease }),
          withTiming(0, { duration: 1450, easing: ease }),
        ), -1, false);
    }

    if (motion === 'hop') {
      // 620ms: up with a stretch, down with a squash on landing, small rebound.
      lift.value = withSequence(
        withTiming(-20, { duration: 140, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 160, easing: Easing.in(Easing.quad) }),
        withTiming(-7, { duration: 120, easing: ease }),
        withTiming(0, { duration: 200, easing: ease }),
      );
      squashY.value = withSequence(
        withTiming(1.09, { duration: 140 }),
        withTiming(0.93, { duration: 110 }),
        withTiming(1, { duration: 370 }),
      );
      squashX.value = withSequence(
        withTiming(0.93, { duration: 140 }),
        withTiming(1.07, { duration: 110 }),
        withTiming(1, { duration: 370 }),
      );
    }

    if (motion === 'shake') {
      tilt.value = withSequence(
        withTiming(-5, { duration: 105, easing: ease }),
        withTiming(4, { duration: 130, easing: ease }),
        withTiming(-2, { duration: 130, easing: ease }),
        withTiming(0, { duration: 155, easing: ease }),
      );
      lift.value = withSequence(
        withTiming(3, { duration: 240, easing: ease }),
        withTiming(0, { duration: 280, easing: ease }),
      );
    }

    if (motion === 'celebrate') {
      lift.value = withRepeat(
        withSequence(
          withTiming(-13, { duration: 575, easing: ease }),
          withTiming(0, { duration: 575, easing: ease }),
        ), -1, false);
      tilt.value = withRepeat(
        withSequence(
          withTiming(2, { duration: 575, easing: ease }),
          withTiming(-1.5, { duration: 575, easing: ease }),
        ), -1, false);
    }
  }, [motion, pose]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: lift.value },
      { scaleX: squashX.value },
      { scaleY: squashY.value },
      { rotate: `${tilt.value}deg` },
    ],
  }));

  return (
    <AnimatedImage
      source={POSES[pose]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      style={[{ width: size, height: size, transformOrigin: '50% 100%' }, style]}
    />
  );
}
```

- [ ] **Step 2: Look at all four motions before building screens on them**

Temporarily replace `apps/mobile/app/index.tsx` with a harness:

```tsx
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Pepe, type Motion } from '../components/Pepe';
import { PressableCard } from '../components/PressableCard';
import { POSES, type PoseName } from '../storage/vocabulary';
import { colour, font, space } from '../theme';

const MOTIONS: Motion[] = ['breathe', 'hop', 'shake', 'celebrate'];

export default function Home() {
  const [motion, setMotion] = useState<Motion>('breathe');
  const [pose, setPose] = useState<PoseName>('idle');

  return (
    <View style={{ flex: 1, backgroundColor: colour.ground, padding: space.xl, justifyContent: 'center', gap: space.lg }}>
      <View style={{ height: 240, alignItems: 'center', justifyContent: 'flex-end' }}>
        <Pepe pose={pose} motion={motion} size={190} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {MOTIONS.map((m) => (
          <PressableCard key={m} onPress={() => setMotion(m)} face={m === motion ? colour.marigold : colour.surface}>
            <Text style={{ fontFamily: font.bodyHeavy, padding: space.md, color: colour.ink }}>{m}</Text>
          </PressableCard>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {(Object.keys(POSES) as PoseName[]).map((p) => (
          <PressableCard key={p} onPress={() => setPose(p)} face={p === pose ? colour.cactus : colour.surface}>
            <Text style={{ fontFamily: font.bodyHeavy, padding: space.md, color: p === pose ? colour.surface : colour.ink }}>{p}</Text>
          </PressableCard>
        ))}
      </View>
    </View>
  );
}
```

Tap through every motion against every pose. Confirm:
1. `breathe` loops gently and never stops.
2. `hop` visibly squashes on landing — he should look like he has weight, not like a sticker sliding.
3. `shake` reads as "no", not as a glitch.
4. `celebrate` loops.
5. Switching motion mid-animation does not leave him stuck off-centre — that is what the `cancelAnimation` block is for.

If he grows and shrinks about his middle rather than his feet, `transformOrigin` is not being applied; check the React Native version supports it and, if not, wrap him in a `View` with `alignItems: 'flex-end'` and animate a height-preserving container instead.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/Pepe.tsx apps/mobile/app/index.tsx
git commit -m "Add the animated mascot

Four motions on shared values, all pivoting on his bottom edge so squash and
stretch reads as weight rather than a sticker changing size."
```

---

### Task 8: Sound, haptics and speech behind one call

**Files:**
- Create: `apps/mobile/feedback.ts`
- Modify: `apps/mobile/package.json`

**Interfaces:**
- Consumes: the WAVs in `apps/mobile/assets/audio/`.
- Produces: `cue(name: CueName): void` where
  `type CueName = 'tap' | 'correct' | 'wrong' | 'complete' | 'streak' | 'levelup'`;
  `speak(spanish: string): void`; `stopSpeaking(): void`;
  `setMuted(muted: boolean): void`; `isMuted(): boolean`.
  Tasks 9, 10 and 11 call these.

- [ ] **Step 1: Install the three modules**

```bash
cd apps/mobile && npx expo install expo-audio expo-haptics expo-speech && cd ../..
```

- [ ] **Step 2: Write `apps/mobile/feedback.ts`**

```typescript
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

export type CueName = 'tap' | 'correct' | 'wrong' | 'complete' | 'streak' | 'levelup';

/**
 * Every piece of feedback that is not on the screen.
 *
 * Sound and haptics always fire together: the haptic does most of the work on
 * how an answer feels, and it still works with the phone on silent, so muting
 * audio must not mute touch.
 */
const SOURCES: Record<CueName, number> = {
  tap: require('./assets/audio/tap.wav'),
  correct: require('./assets/audio/correct.wav'),
  wrong: require('./assets/audio/wrong.wav'),
  complete: require('./assets/audio/complete.wav'),
  streak: require('./assets/audio/streak.wav'),
  levelup: require('./assets/audio/levelup.wav'),
};

const HAPTIC: Record<CueName, () => void> = {
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  correct: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  wrong: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  complete: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  streak: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  levelup: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
};

let players: Partial<Record<CueName, AudioPlayer>> = {};
let muted = false;

/**
 * Play through the silent switch, and do not stop the user's music for a 0.4s
 * chime. Called once at startup.
 */
export async function prepareAudio(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: 'mixWithOthers',
  });
  for (const name of Object.keys(SOURCES) as CueName[]) {
    players[name] = createAudioPlayer(SOURCES[name]);
  }
}

export function cue(name: CueName): void {
  HAPTIC[name]();                        // haptics ignore the mute switch
  if (muted) return;
  const player = players[name];
  if (!player) return;
  try {
    player.seekTo(0);
    player.play();
  } catch {
    // A cue that cannot play is never worth interrupting practice for.
  }
}

export function speak(spanish: string): void {
  if (muted) return;
  Speech.stop();
  Speech.speak(spanish, { language: 'es-MX', rate: 0.95, pitch: 1.0 });
}

export function stopSpeaking(): void {
  Speech.stop();
}

export function setMuted(next: boolean): void {
  muted = next;
  if (next) Speech.stop();
}

export function isMuted(): boolean {
  return muted;
}
```

- [ ] **Step 3: Call `prepareAudio` at startup**

In `apps/mobile/app/_layout.tsx`, add the import and an effect:

```tsx
import { useEffect } from 'react';
import { prepareAudio } from '../feedback';
```

and inside `RootLayout`, before the `if (!ready)` line:

```tsx
  useEffect(() => { void prepareAudio(); }, []);
```

- [ ] **Step 4: Hear every cue on a real device**

Temporarily add buttons to `apps/mobile/app/index.tsx`:

```tsx
import { Text, View } from 'react-native';
import { PressableCard } from '../components/PressableCard';
import { cue, speak, type CueName } from '../feedback';
import { colour, font, space } from '../theme';

const CUES: CueName[] = ['tap', 'correct', 'wrong', 'complete', 'streak', 'levelup'];

export default function Home() {
  return (
    <View style={{ flex: 1, backgroundColor: colour.ground, padding: space.xl, justifyContent: 'center', gap: space.sm }}>
      {CUES.map((c) => (
        <PressableCard key={c} onPress={() => cue(c)}>
          <Text style={{ fontFamily: font.bodyHeavy, fontSize: 17, padding: space.lg, color: colour.ink }}>{c}</Text>
        </PressableCard>
      ))}
      <PressableCard face={colour.marigold} onPress={() => speak('la madrugada')}>
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 17, padding: space.lg, color: colour.ink }}>
          hablar: la madrugada
        </Text>
      </PressableCard>
    </View>
  );
}
```

Confirm on a **physical phone**, not the simulator — the iOS Simulator does not produce haptics and its speech voices differ:
1. Each cue plays and is felt.
2. `levelup` is the mariachi one.
3. The speech button says *la madrugada* in a Mexican voice, not a Castilian one. If it sounds Castilian, the device has no `es-MX` voice installed; log `await Speech.getAvailableVoicesAsync()` and pick the closest `es-MX` or `es-419` identifier explicitly.
4. Audio plays with the ring switch off.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/feedback.ts apps/mobile/app/_layout.tsx apps/mobile/app/index.tsx
git commit -m "Add sound, haptics and Mexican text-to-speech

Haptics deliberately ignore the mute switch: they still work with the phone on
silent and do most of the work on how an answer feels. Audio mixes with other
apps rather than stopping the user's music for a 0.4s chime."
```

---

### Task 9: Streak, tab navigation, and the home screen

**Files:**
- Create: `packages/core/src/streak.ts`, `packages/core/src/streak.test.ts`, `apps/mobile/app/(tabs)/_layout.tsx`, `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/(tabs)/stats.tsx`, `apps/mobile/app/(tabs)/words.tsx`, `apps/mobile/components/Bunting.tsx`, `apps/mobile/storage/streakStore.ts`
- Delete: `apps/mobile/app/index.tsx` (replaced by the tab route)
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `PressableCard`, `Pepe`, `cue`, `WORDS`, `loadProgress`, `isDue`, `todayISO`.
- Produces: `bumpStreak(streak: Streak, today: string): Streak` and `type Streak = { days: number; lastDate: string | null }` from core; `loadStreak()` / `saveStreak()` from `../storage/streakStore`. Task 11 calls `bumpStreak` when a round completes.

- [ ] **Step 1: Write the failing streak tests**

Create `packages/core/src/streak.test.ts`:

```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { bumpStreak, emptyStreak } from './streak.ts';

describe('bumpStreak', () => {
  test('a first ever round starts the streak at one', () => {
    assert.deepEqual(bumpStreak(emptyStreak(), '2026-09-19'),
      { days: 1, lastDate: '2026-09-19' });
  });

  test('a round the next day extends it', () => {
    assert.deepEqual(bumpStreak({ days: 3, lastDate: '2026-09-18' }, '2026-09-19'),
      { days: 4, lastDate: '2026-09-19' });
  });

  test('a second round the same day changes nothing', () => {
    assert.deepEqual(bumpStreak({ days: 4, lastDate: '2026-09-19' }, '2026-09-19'),
      { days: 4, lastDate: '2026-09-19' });
  });

  test('a missed day resets to one — no freezes, no repairs', () => {
    assert.deepEqual(bumpStreak({ days: 12, lastDate: '2026-09-17' }, '2026-09-19'),
      { days: 1, lastDate: '2026-09-19' });
  });

  test('it extends across a month boundary', () => {
    assert.deepEqual(bumpStreak({ days: 2, lastDate: '2026-09-30' }, '2026-10-01'),
      { days: 3, lastDate: '2026-10-01' });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test 'packages/core/src/streak.test.ts'`
Expected: FAIL — `Cannot find module './streak.ts'`.

- [ ] **Step 3: Write `packages/core/src/streak.ts`**

```typescript
import { daysBetween } from './dates.ts';

export interface Streak {
  days: number;
  /** ISO date of the last completed round. */
  lastDate: string | null;
}

export const emptyStreak = (): Streak => ({ days: 0, lastDate: null });

/**
 * Record that a round was completed today.
 *
 * A missed day resets to one. There is no freeze and nothing to buy: the number
 * is only worth looking at if it is true.
 */
export function bumpStreak(streak: Streak, today: string): Streak {
  if (streak.lastDate === null) return { days: 1, lastDate: today };

  const gap = daysBetween(streak.lastDate, today);
  if (gap === 0) return streak;
  if (gap === 1) return { days: streak.days + 1, lastDate: today };
  return { days: 1, lastDate: today };
}
```

- [ ] **Step 4: Run it and watch it pass, then export**

Run: `node --test 'packages/core/src/streak.test.ts'`
Expected: PASS, 5 tests.

Add to `packages/core/src/index.ts`:

```typescript
export * from './streak.ts';
```

- [ ] **Step 5: Write `apps/mobile/storage/streakStore.ts`**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyStreak, type Streak } from '@pepe/core';

const KEY = 'pepe-habla/streak/v1';

export async function loadStreak(): Promise<Streak> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw === null) return emptyStreak();
  try {
    return JSON.parse(raw) as Streak;
  } catch {
    return emptyStreak();
  }
}

export async function saveStreak(streak: Streak): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(streak));
}
```

- [ ] **Step 6: Add the bunting**

```bash
cd apps/mobile && npx expo install react-native-svg && cd ../..
```

Create `apps/mobile/components/Bunting.tsx`:

```tsx
import Svg, { Line, Path } from 'react-native-svg';
import { colour } from '../theme';

const FILLS = [colour.chile, colour.cactus, colour.marigold];

/** Papel picado across the top of the home screen. */
export function Bunting({ width = 350 }: { width?: number }) {
  const flags = Math.floor(width / 50);
  return (
    <Svg width={width} height={26} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Line x1={0} y1={2} x2={width} y2={2} stroke={colour.ink} strokeWidth={2} />
      {Array.from({ length: flags }, (_, i) => {
        const x = i * 50 + 2;
        return (
          <Path
            key={i}
            d={`M${x} 2 h44 l-22 22 z`}
            fill={FILLS[i % FILLS.length]}
            stroke={colour.ink}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        );
      })}
    </Svg>
  );
}
```

- [ ] **Step 7: Move the home screen into a tab group**

```bash
mkdir -p "apps/mobile/app/(tabs)"
git rm -f apps/mobile/app/index.tsx
```

Create `apps/mobile/app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colour, font } from '../../theme';

const icons = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  list: 'M4 6h16M4 12h16M4 18h10',
} as const;

const Icon = ({ d, color }: { d: string; color: string }) => (
  <Svg width={23} height={23} viewBox="0 0 24 24">
    <Path d={d} stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" fill="none" />
  </Svg>
);

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colour.chile,
        tabBarInactiveTintColor: colour.muted,
        tabBarLabelStyle: { fontFamily: font.bodyHeavy, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colour.surface,
          borderTopWidth: 2,
          borderTopColor: colour.ink,
        },
        sceneStyle: { backgroundColor: colour.ground },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: ({ color }) => <Icon d={icons.home} color={color} /> }} />
      <Tabs.Screen name="stats" options={{ title: 'Progreso', tabBarIcon: ({ color }) => <Icon d={icons.chart} color={color} /> }} />
      <Tabs.Screen name="words" options={{ title: 'Palabras', tabBarIcon: ({ color }) => <Icon d={icons.list} color={color} /> }} />
    </Tabs>
  );
}
```

Create the two phase-2 placeholders. `apps/mobile/app/(tabs)/stats.tsx`:

```tsx
import { Text, View } from 'react-native';
import { Pepe } from '../../components/Pepe';
import { colour, font, space } from '../../theme';

export default function Stats() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl }}>
      <Pepe pose="sleeping" motion="breathe" size={150} />
      <Text style={{ fontFamily: font.display, fontSize: 22, color: colour.ink }}>Pronto</Text>
      <Text style={{ fontFamily: font.body, fontSize: 14, color: colour.muted, textAlign: 'center' }}>
        Aquí verás tu racha, tus palabras conocidas y las que se te atragantan.
      </Text>
    </View>
  );
}
```

`apps/mobile/app/(tabs)/words.tsx` is identical except the last line reads:

```tsx
        Aquí verás todas tus palabras y qué tan bien las sabes.
```

- [ ] **Step 8: Write the home screen at `apps/mobile/app/(tabs)/index.tsx`**

```tsx
import { useCallback, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { isDue, todayISO, type Streak } from '@pepe/core';
import { Bunting } from '../../components/Bunting';
import { Pepe } from '../../components/Pepe';
import { PressableCard } from '../../components/PressableCard';
import { cue } from '../../feedback';
import { loadProgress } from '../../storage/progressStore';
import { loadStreak } from '../../storage/streakStore';
import { WORDS } from '../../storage/vocabulary';
import { colour, font, radius, space } from '../../theme';

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 7,
      backgroundColor: colour.surface, borderWidth: 2, borderColor: colour.ink,
      borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 14,
    }}>
      {children}
    </View>
  );
}

function Stat({ value, label, tint }: { value: string; label: string; tint?: string }) {
  return (
    <PressableCard style={{ flex: 1 }} depth={3}>
      <View style={{ paddingVertical: 11, paddingHorizontal: 8, alignItems: 'center' }}>
        <Text style={{ fontFamily: font.display, fontSize: 23, color: tint ?? colour.ink }}>{value}</Text>
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 11, color: colour.muted, letterSpacing: 0.5 }}>
          {label}
        </Text>
      </View>
    </PressableCard>
  );
}

export default function Home() {
  const router = useRouter();
  const [due, setDue] = useState(0);
  const [known, setKnown] = useState(0);
  const [streak, setStreak] = useState<Streak>({ days: 0, lastDate: null });

  // Refresh on every focus, so finishing a round updates these immediately.
  useFocusEffect(useCallback(() => {
    (async () => {
      const [db, s] = await Promise.all([loadProgress(), loadStreak()]);
      const today = todayISO();
      const all = Object.values(db.progress);
      setDue(all.filter((p) => isDue(p, today)).length);
      setKnown(all.filter((p) => p.box >= 4).length);
      setStreak(s);
    })();
  }, []));

  const waiting = due > 0
    ? `¡Órale! Tienes ${due} ${due === 1 ? 'palabra esperándote' : 'palabras esperándote'}.`
    : 'Todo al día. ¿Quieres aprender palabras nuevas?';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colour.ground }} edges={['top']}>
      <View style={{ flex: 1, paddingHorizontal: space.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: space.lg }}>
          <Chip>
            <Svg width={17} height={17} viewBox="0 0 24 24">
              <Path
                d="M12 2c1 4-2 5-2 8a4 4 0 0 0 8 0c0-1-.4-2-1-3 2 2 3 4.5 3 7a8 8 0 0 1-16 0c0-4.5 3-8 8-12z"
                fill={colour.marigold} stroke={colour.ink} strokeWidth={1.7} strokeLinejoin="round"
              />
            </Svg>
            <Text style={{ fontFamily: font.bodyHeavy, fontSize: 15, color: colour.ink }}>{streak.days}</Text>
          </Chip>
          <Chip>
            <Text style={{ fontFamily: font.bodyHeavy, fontSize: 12, color: colour.muted }}>NIVEL 1</Text>
            <Text style={{ fontFamily: font.display, fontSize: 15, color: colour.chile }}>Callejero</Text>
          </Chip>
        </View>

        <View style={{ alignItems: 'center', marginTop: space.md }}>
          <Bunting />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{
            backgroundColor: colour.surface, borderWidth: 2, borderColor: colour.ink,
            borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18, maxWidth: 300,
          }}>
            <Text style={{ fontFamily: font.display, fontSize: 19, color: colour.ink, textAlign: 'center' }}>
              {waiting}
            </Text>
          </View>
          <View style={{ marginTop: space.md }}>
            <Pepe pose="hero" motion="breathe" size={230} />
          </View>
        </View>

        <PressableCard
          depth={5}
          face={colour.chile}
          onPress={() => { cue('tap'); router.push('/session'); }}
        >
          <View style={{ height: 62, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.displayHeavy, fontSize: 25, color: colour.surface }}>¡Vamos!</Text>
          </View>
        </PressableCard>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: space.lg, marginBottom: space.md }}>
          <Stat value={String(known)} label="CONOCIDAS" />
          <Stat value={String(due)} label="POR REPASAR" />
          <Stat value={String(WORDS.length)} label="EN TOTAL" />
        </View>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 9: Run it and compare against the mock**

Run the app. Open the `Inicio` artboard in the mockup canvas side by side and confirm: bunting, chips, speech bubble, Pepe breathing, the red `¡Vamos!` sinking when pressed, three stat cards, and a tab bar with three working tabs. Numbers should be real — `POR REPASAR` should match what `node tools/cli.ts stats` prints for "Due today".

- [ ] **Step 10: Run the whole suite and commit**

```bash
npm test && npm run typecheck
git add -A
git commit -m "Add the streak, tab navigation and the home screen

A missed day resets the streak to one: no freezes and nothing to buy, because
the number is only worth looking at if it is true."
```

---

### Task 10: The round — asking, all four question types, and feedback

**Files:**
- Create: `apps/mobile/components/OptionButton.tsx`, `apps/mobile/app/session.tsx`
- Modify: `packages/core/src/quiz.ts`, `packages/core/src/quiz.test.ts`

**Interfaces:**
- Consumes: `startSession`, `reduce`, `currentQuestion`, `selectDaily`, `buildQuestions`, `mulberry32`, `seedFromDate`, `todayISO` from core; `Pepe`, `PressableCard`, `cue`, `speak`, `WORDS`, `VOCAB_ART`, `loadProgress`.
- Produces: `optionMeaning(direction, option, pool): string | null` from core; `<OptionButton>` with props `{ label: string; state: 'idle' | 'correct' | 'wrong' | 'dimmed'; onPress: () => void; disabled: boolean }`. Task 11 extends `app/session.tsx`.

- [ ] **Step 1: Write the failing test for explaining a wrong answer**

A miss should teach two words: the right answer, and what the option you tapped actually meant. Append to `packages/core/src/quiz.test.ts`:

```typescript
describe('optionMeaning', () => {
  const words = [word('a'), word('b')];

  test('finds what a Spanish option means when answering in Spanish', () => {
    assert.equal(optionMeaning('en->es', 'es-a', words), 'en-a');
  });

  test('finds what an English option means when answering in English', () => {
    assert.equal(optionMeaning('es->en', 'en-b', words), 'es-b');
  });

  test('treats a picture question as answered in Spanish', () => {
    assert.equal(optionMeaning('picture->es', 'es-a', words), 'en-a');
  });

  test('treats a listening question as answered in English', () => {
    assert.equal(optionMeaning('listen->en', 'en-a', words), 'es-a');
  });

  test('returns null for an option that is not in the pool', () => {
    assert.equal(optionMeaning('es->en', 'nonsense', words), null);
  });
});
```

Add `optionMeaning` to the import at the top of the file.

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test 'packages/core/src/quiz.test.ts'`
Expected: FAIL — `optionMeaning is not a function`.

- [ ] **Step 3: Add it to `packages/core/src/quiz.ts`**

```typescript
/**
 * What the tapped option actually meant.
 *
 * A wrong answer is a chance to learn two words rather than none: the correct
 * one, and the one you reached for instead. Every distractor is a real word
 * from the learner's own vocabulary, so the gloss is already available.
 */
export function optionMeaning(
  direction: Direction,
  option: string,
  pool: readonly Word[],
): string | null {
  for (const w of pool) {
    if (solve(w, direction) === option) {
      return answersInEnglish(direction) ? w.es : w.en;
    }
  }
  return null;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test 'packages/core/src/quiz.test.ts'`
Expected: PASS, 21 tests.

- [ ] **Step 5: Write `apps/mobile/components/OptionButton.tsx`**

```tsx
import { Text, View } from 'react-native';
import { PressableCard } from './PressableCard';
import { colour, font, space } from '../theme';

export type OptionState = 'idle' | 'correct' | 'wrong' | 'dimmed';

const FACE: Record<OptionState, string> = {
  idle: colour.surface,
  correct: colour.cactus,
  wrong: colour.chile,
  dimmed: colour.surface,
};

const TEXT: Record<OptionState, string> = {
  idle: colour.ink,
  correct: colour.surface,
  wrong: colour.surface,
  dimmed: colour.muted,
};

const MARK: Record<OptionState, string> = {
  idle: '', correct: '✓', wrong: '✕', dimmed: '',
};

/**
 * One answer.
 *
 * Full width on purpose: a 350x56 row is a larger target than a grid cell and
 * gives one flush-left scan line rather than a Z-pattern across centred text,
 * and long words like "el medio ambiente" stay on one line.
 */
export function OptionButton({
  label, state, onPress, disabled,
}: {
  label: string;
  state: OptionState;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <PressableCard
      face={FACE[state]}
      onPress={disabled ? undefined : onPress}
      style={{ opacity: state === 'dimmed' ? 0.45 : 1 }}
    >
      <View style={{
        minHeight: 56, paddingHorizontal: 18,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md,
      }}>
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 18, color: TEXT[state], flexShrink: 1 }}>
          {label}
        </Text>
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 19, color: TEXT[state] }}>
          {MARK[state]}
        </Text>
      </View>
    </PressableCard>
  );
}
```

- [ ] **Step 6: Write `apps/mobile/app/session.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  buildQuestions, currentQuestion, mulberry32, optionMeaning, reduce,
  seedFromDate, selectDaily, startSession, todayISO,
  type Progress, type Question, type SessionState, type Word,
} from '@pepe/core';
import { OptionButton, type OptionState } from '../components/OptionButton';
import { Pepe } from '../components/Pepe';
import { PressableCard } from '../components/PressableCard';
import { cue, speak } from '../feedback';
import { loadProgress } from '../storage/progressStore';
import { VOCAB_ART, WORDS } from '../storage/vocabulary';
import { colour, font, radius, space } from '../theme';

const ROUND_SIZE = 10;

export function buildRound(
  progress: Record<string, Progress>,
  today: string,
  round: number,
): Question[] {
  // Seeded by the day so a round is reproducible, and by the round number so a
  // second round is not the same ten words again.
  const rng = mulberry32(seedFromDate(today) ^ (round * 0x9e3779b9));
  const selected = selectDaily(WORDS, progress, today, ROUND_SIZE, rng);
  return buildQuestions(selected, WORDS, rng);
}

function Speaker({ onPress, big }: { onPress: () => void; big?: boolean }) {
  const size = big ? 54 : 22;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Escuchar la palabra"
      style={{
        width: big ? 190 : 48, height: big ? 130 : 48,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: big ? colour.marigold : colour.surface,
        borderWidth: 2, borderColor: colour.ink,
        borderRadius: big ? 22 : radius.pill,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M4 9v6h4l5 4V5L8 9z" fill={colour.ink} />
        <Path d="M16.5 8.5a5 5 0 0 1 0 7" stroke={colour.ink} strokeWidth={2} strokeLinecap="round" fill="none" />
      </Svg>
    </Pressable>
  );
}

const TASK_LABEL: Record<string, string> = {
  'es->en': 'ESCOGE LA TRADUCCIÓN',
  'en->es': '¿CÓMO SE DICE?',
  'listen->en': 'ESCUCHA Y ESCOGE',
  'picture->es': '¿QUÉ ES ESTO?',
};

export default function Session() {
  const router = useRouter();
  const [state, setState] = useState<SessionState | null>(null);
  const shownAt = useRef(Date.now());

  useEffect(() => {
    (async () => {
      const db = await loadProgress();
      setState(startSession(buildRound(db.progress, todayISO(), 1)));
    })();
  }, []);

  const question = state ? currentQuestion(state) : null;

  // Speak listening questions as soon as they appear, and reset the clock.
  useEffect(() => {
    shownAt.current = Date.now();
    if (question && question.direction === 'listen->en') speak(question.word.es);
  }, [question?.word.id, state?.phase === 'asking']);

  const meaning = useMemo(() => {
    if (!state?.picked || !question) return null;
    return optionMeaning(question.direction, state.picked, WORDS);
  }, [state?.picked, question]);

  if (!state || !question) {
    return <View style={{ flex: 1, backgroundColor: colour.ground }} />;
  }

  const answering = state.phase === 'asking' || state.phase === 'repairing';
  const correct = state.picked === question.answer;

  const optionState = (label: string): OptionState => {
    if (answering) return 'idle';
    if (label === question.answer) return 'correct';
    if (label === state.picked) return 'wrong';
    return 'dimmed';
  };

  const onAnswer = (option: string) => {
    const ms = Date.now() - shownAt.current;
    const hit = option === question.answer;
    cue(hit ? 'correct' : 'wrong');
    if (!hit) speak(question.word.es);      // hear the right word after a miss
    setState(reduce(state, { type: 'answer', option, ms }));
  };

  const progress = Math.round((state.index / state.queue.length) * 100);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colour.ground }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: space.xl, paddingTop: space.md }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Salir de la ronda" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={19} height={19} viewBox="0 0 24 24">
            <Path d="M5 5l14 14M19 5L5 19" stroke={colour.muted} strokeWidth={2.6} strokeLinecap="round" />
          </Svg>
        </Pressable>
        <View style={{ flex: 1, height: 15, backgroundColor: colour.surface, borderWidth: 2, borderColor: colour.ink, borderRadius: radius.pill, overflow: 'hidden' }}>
          <View style={{ width: `${progress}%`, height: '100%', backgroundColor: colour.cactus }} />
        </View>
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 14, color: colour.muted }}>
          {Math.min(state.index + 1, state.queue.length)} / {state.queue.length}
        </Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: space.xl }}>
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 13, color: colour.muted, letterSpacing: 1, marginTop: 22, marginBottom: space.md }}>
          {TASK_LABEL[question.direction]}
        </Text>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {question.direction === 'picture->es' && question.promptImage ? (
            <View style={{ backgroundColor: colour.surface, borderWidth: 2, borderColor: colour.ink, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 22 }}>
              <Image source={VOCAB_ART[question.promptImage]} style={{ width: 190, height: 190 }} resizeMode="contain" />
            </View>
          ) : question.direction === 'listen->en' ? (
            <Speaker big onPress={() => speak(question.word.es)} />
          ) : (
            <View style={{ alignItems: 'center', gap: 14 }}>
              <Text style={{ fontFamily: font.displayHeavy, fontSize: 44, color: colour.ink, textAlign: 'center' }}>
                {question.prompt}
              </Text>
              {question.direction === 'es->en' && <Speaker onPress={() => speak(question.word.es)} />}
            </View>
          )}
        </View>

        <View style={{ gap: 10, paddingBottom: space.md }}>
          {question.options.map((option) => (
            <OptionButton
              key={option}
              label={option}
              state={optionState(option)}
              disabled={!answering}
              onPress={() => onAnswer(option)}
            />
          ))}
        </View>
      </View>

      {!answering && (
        <Animated.View
          entering={FadeInDown.duration(260)}
          style={{ borderTopWidth: 2, borderTopColor: colour.ink, backgroundColor: correct ? colour.cactus : colour.chile }}
        >
          <View style={{ padding: space.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Pepe pose={correct ? 'happy' : 'sad'} motion={correct ? 'hop' : 'shake'} size={72} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.display, fontSize: correct ? 22 : 20, color: colour.surface }}>
                  {correct ? '¡Eso es!' : `La respuesta es ${question.answer}`}
                </Text>
                {!correct && meaning && (
                  <Text style={{ fontFamily: font.body, fontSize: 14, color: colour.surface, opacity: 0.92, marginTop: 2 }}>
                    Escogiste {state.picked}, que significa {meaning}.
                  </Text>
                )}
              </View>
            </View>
            <PressableCard onPress={() => { cue('tap'); setState(reduce(state, { type: 'next' })); }} style={{ marginTop: space.md }}>
              <View style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: font.display, fontSize: 19, color: colour.ink }}>Siguiente</Text>
              </View>
            </PressableCard>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 7: Play a round and check each question type appears**

Run the app, press `¡Vamos!`, and play ten questions. Confirm:
1. All four task labels appear across ten questions.
2. A picture question shows Pepe art; a listening question speaks on arrival and again when tapped.
3. Correct: green panel, Pepe hops, chime.
4. Wrong: red panel, Pepe shakes, soft guitarrón, the correct Spanish is spoken, and the line reads *Escogiste la carne, que significa the meat.*
5. Options lock after answering — tapping another does nothing.

Reaching the end currently leaves a blank screen; Task 11 fixes that.

- [ ] **Step 8: Commit**

```bash
npm test && npm run typecheck
git add -A
git commit -m "Add the round: four question types with feedback

A miss names what the tapped option actually meant, so it teaches two words
rather than none, and speaks the correct Spanish. Options are a full-width list
because it is both the larger tap target and the faster one to read."
```

---

### Task 11: Repair round, summary, and elastic continuation

**Files:**
- Modify: `apps/mobile/app/session.tsx`

**Interfaces:**
- Consumes: `roundScore`, `sessionScore`, `bumpStreak` from core; `recordAnswers`, `saveProgress`, `loadStreak`, `saveStreak`.
- Produces: nothing new. This completes phase 1.

- [ ] **Step 1: Add the imports session.tsx needs**

At the top of `apps/mobile/app/session.tsx`, extend the core import with `roundScore`, `sessionScore`, `bumpStreak`, and add:

```tsx
import { loadProgress, saveProgress, recordAnswers } from '../storage/progressStore';
import { loadStreak, saveStreak } from '../storage/streakStore';
import type { Streak, VocabDb } from '@pepe/core';
```

- [ ] **Step 2: Hold the database in state so a second round can use fresh progress**

Replace the mount effect with one that keeps the db around:

```tsx
  const [db, setDb] = useState<VocabDb | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const saved = useRef<number>(0);          // rounds already written to storage

  useEffect(() => {
    (async () => {
      const [loaded, s] = await Promise.all([loadProgress(), loadStreak()]);
      setDb(loaded);
      setStreak(s);
      setState(startSession(buildRound(loaded.progress, todayISO(), 1)));
    })();
  }, []);
```

- [ ] **Step 3: Persist exactly once, when a round reaches its summary**

Add this effect below the one that speaks listening questions. The `saved` ref is what stops a re-render from writing the same round twice.

```tsx
  useEffect(() => {
    if (!state || !db || !streak) return;
    if (state.phase !== 'summary' || saved.current >= state.round) return;
    saved.current = state.round;

    (async () => {
      const today = todayISO();
      // Only this round's first answers. Repair answers were never recorded.
      const fresh = state.results.filter((r) => r.round === state.round);
      const nextDb = recordAnswers(db, fresh, today);
      const nextStreak = bumpStreak(streak, today);

      setDb(nextDb);
      setStreak(nextStreak);
      await Promise.all([saveProgress(nextDb), saveStreak(nextStreak)]);

      // A longer streak is worth more noise than finishing a routine round.
      cue(nextStreak.days > streak.days && nextStreak.days % 5 === 0 ? 'streak' : 'complete');
    })();
  }, [state?.phase, state?.round]);
```

- [ ] **Step 4: Label the repair questions differently**

Replace the task-label `Text` so repair announces itself — the learner should know these do not count:

```tsx
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 13, color: colour.muted, letterSpacing: 1, marginTop: 22, marginBottom: space.md }}>
          {state.phase === 'repairing' || state.phase === 'repair-feedback'
            ? 'OTRA VEZ, SIN PRISA'
            : TASK_LABEL[question.direction]}
        </Text>
```

- [ ] **Step 5: Freeze the progress bar during repair**

During repair, `state.index` is already past the end, so the bar would read 100% and the counter would overflow. Replace the two progress expressions:

```tsx
  const inRepair = state.phase === 'repairing' || state.phase === 'repair-feedback';
  const progress = inRepair
    ? 100
    : Math.round((state.index / state.queue.length) * 100);
  const counter = inRepair
    ? `${state.repairIndex + 1} / ${state.repair.length}`
    : `${Math.min(state.index + 1, state.queue.length)} / ${state.queue.length}`;
```

and use `{counter}` in place of the inline expression in the header.

- [ ] **Step 6: Render the summary**

The current `if (!state || !question) return <View …/>` swallows the summary, because `currentQuestion` is null there. Replace it with a real screen. Put this immediately after that guard's condition is narrowed — that is, change the guard to handle the three cases in order:

```tsx
  if (!state) {
    return <View style={{ flex: 1, backgroundColor: colour.ground }} />;
  }

  if (state.phase === 'summary' || state.phase === 'finished') {
    const round = roundScore(state);
    const session = sessionScore(state);
    const missed = state.repair.map((q) => q.word);

    const another = async () => {
      cue('tap');
      const current = db ?? await loadProgress();
      setState(reduce(state, {
        type: 'anotherRound',
        questions: buildRound(current.progress, todayISO(), state.round + 1),
      }));
    };

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colour.ground }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 }}>
          <Pepe pose="excited" motion="celebrate" size={168} />
          <Text style={{ fontFamily: font.displayHeavy, fontSize: 34, color: colour.ink, marginTop: space.sm }}>
            ¡Bien hecho!
          </Text>
          <Text style={{ fontFamily: font.body, fontSize: 16, color: colour.muted }}>
            {round.right} de {round.total} correctas
          </Text>
          {state.round > 1 && (
            <Text style={{ fontFamily: font.body, fontSize: 14, color: colour.muted, marginTop: 2 }}>
              {session.right} de {session.total} en toda la sesión
            </Text>
          )}

          {missed.length > 0 && (
            <View style={{ width: '100%', marginTop: space.xl, backgroundColor: colour.surface, borderWidth: 2, borderColor: colour.ink, borderRadius: radius.card, padding: 16 }}>
              <Text style={{ fontFamily: font.bodyHeavy, fontSize: 12, color: colour.muted, letterSpacing: 1, marginBottom: 9 }}>
                PARA REPASAR
              </Text>
              {missed.map((w) => (
                <View key={w.id} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 9, marginBottom: 4 }}>
                  <Text style={{ fontFamily: font.display, fontSize: 19, color: colour.ink }}>{w.es}</Text>
                  <Text style={{ fontFamily: font.body, fontSize: 15, color: colour.muted }}>{w.en}</Text>
                </View>
              ))}
              <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, marginTop: 5 }}>
                Vuelven mañana.
              </Text>
            </View>
          )}

          <PressableCard depth={5} face={colour.cactus} onPress={another} style={{ width: '100%', marginTop: space.xl }}>
            <View style={{ height: 60, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: font.displayHeavy, fontSize: 22, color: colour.surface }}>¿Otra ronda?</Text>
            </View>
          </PressableCard>

          <Pressable onPress={() => router.back()} style={{ height: 52, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
            <Text style={{ fontFamily: font.bodyHeavy, fontSize: 16, color: colour.muted }}>Terminar por hoy</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!question) {
    return <View style={{ flex: 1, backgroundColor: colour.ground }} />;
  }
```

- [ ] **Step 7: Play it through and check the rules hold**

Run the app and play a full round, **deliberately missing two questions**. Confirm:

1. After the tenth question, repair starts and the label reads `OTRA VEZ, SIN PRISA`.
2. Repair asks exactly the words you missed, in order, and the counter reads `1 / 2` then `2 / 2`.
3. Getting a repair question right does **not** change the score on the summary — it still says `8 de 10`.
4. The summary lists both missed words under `PARA REPASAR`.
5. `¿Otra ronda?` starts a fresh round with different words and the counter resets to `1 / 10`.
6. `Terminar por hoy` returns to the home screen, and the streak chip there has gone up by one.
7. Kill the app, reopen it: the streak and the due count are still right, proving the write happened.

- [ ] **Step 8: Verify repair really is excluded from storage, not just from the display**

```bash
node -e "
const db = require('./data/vocab.json');
console.log('CLI copy is untouched by the app:', Object.keys(db.progress).length, 'words');
"
```

Then in the app, add a temporary `console.log(fresh.length, fresh.map(r => r.wordId))` inside the persist effect from Step 3 and play a round missing two. Expected: exactly 10 records, each word once — **not** 12. If it prints 12, repair answers are leaking into `results` and Task 3's reducer is wrong.

Remove the `console.log` before committing.

- [ ] **Step 9: Run everything and commit**

```bash
npm test && npm run typecheck
git add -A
git commit -m "Add repair rounds, the summary and elastic continuation

Progress is written once per round at the summary, not per tap. Only first
answers are stored: a repair answer is recognition rather than recall, and
counting it would corrupt the intervals the scheduler derives from it."
```

---

## Phase 1 is done when

- `npm test` passes and `npm run typecheck` is clean.
- The app runs on an iPhone and an Android phone from `npx expo start`.
- You can open it, press `¡Vamos!`, answer ten questions across all four types, repair your misses, see a summary, take another round, and quit — and the streak and due count survive a restart.
- Nothing in `packages/core` imports from `node:`, `react` or `react-native`; the guard test proves it.

Phases 2 through 4 — the stats and word-list screens, the SM-2 scheduler, levels and themes, the expanded vocabulary, and the morning notification — get their own plans.

---

## Self-review notes

Checked against the spec, 2026-09-19:

- **Covered:** monorepo and the purity constraint (Task 1); sprite extraction and the merge bug (Task 2); the session state machine including the repair-does-not-score rule (Task 3); all four question types and the 40/30/20/10 mix (Task 4); the design system, palette, fonts and the hard-shadow press (Task 5); on-device progress with batched writes and seeding from `data/vocab.json` (Task 6); the motion table (Task 7); mariachi audio, haptics and `es-MX` speech (Task 8); the streak with no freezes, tabs and the home screen (Task 9); the round, the wrong-answer explanation (Task 10); repair, summary, elastic rounds (Task 11).
- **Deliberately deferred to later phases,** matching the spec's phasing: the SM-2 scheduler (phase 1 ships on Leitner), levels and unlock gating, themes and theme-clustered introduction, the stats and word-list screens, the morning notification, and the vocabulary expansion past 381 words.
- **Known gap:** the spec's mute toggle has no home in phase 1, because there is no settings screen until phase 2. `setMuted` exists and works; nothing calls it yet. Add the toggle when the stats screen lands.
- **Type consistency:** `AnswerRecord` is defined once in `session.ts` and consumed unchanged by `recordAnswers`; `Direction` is widened in Task 4 before Tasks 10 and 11 switch on it; `PoseName` comes from `vocabulary.ts` and is used by `Pepe`; `buildRound` is defined in Task 10 and reused in Task 11.
