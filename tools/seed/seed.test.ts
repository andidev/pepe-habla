import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileStore, projectRoot } from '../store/fileStore.ts';
import { LADDERS, TRACKS, isTheme, levelsIn } from '@pepe/core';
import type { Word } from '@pepe/core';

// A non-literal specifier keeps apps/app out of the root tsc program (it has its
// own tsconfig); tsc -p apps/app already enforces Greeting.sv at the type level.
const greetingsPath = '../../apps/app/storage/greetings.ts';
const { GREETINGS } = (await import(greetingsPath)) as {
  GREETINGS: readonly { es: string; sv?: string }[];
};

const words = await fileStore(projectRoot).loadWords();
const norm = (s: string) => s.trim().toLowerCase();

// A word's level and its filename must agree, or the seed becomes impossible
// to reason about once 3c starts adding levels one PR at a time. `loadWords()`
// does not return filenames, so this reads the directory directly.
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
});

describe('the app bundles what the seed holds', () => {
  test('every seed file reaches the app', async () => {
    // vocabulary.ts imports the seed by literal path because Metro cannot
    // build paths dynamically, so a new level file that nobody adds there is
    // simply absent from the app -- and every other check here reads the
    // directory, so nothing else would notice.
    //
    // The check imports words.ts rather than vocabulary.ts itself: vocabulary.ts
    // also re-exports POSES/VOCAB_ART/PEPE_PHOTO, built with Metro's asset
    // `require()`, which only exists under Metro's bundler and throws under
    // Node's module loader -- ES module evaluation runs a file's whole body,
    // so even destructuring only WORDS back out would still execute those
    // requires. words.ts holds the seed-merging logic and nothing else,
    // and vocabulary.ts re-exports WORDS from it unchanged, so this still
    // proves the same thing: every seed word reaches what the app bundles.
    const wordsModulePath = '../../apps/app/storage/words.ts';
    const { WORDS } = (await import(wordsModulePath)) as { WORDS: readonly { id: string }[] };
    const bundled = new Set(WORDS.map((w) => w.id));
    const missing = words.filter((w) => !bundled.has(w.id)).map((w) => w.id);
    assert.deepEqual(missing, [], 'in data/seed but not bundled by vocabulary.ts');
    assert.equal(WORDS.length, words.length);
  });
});

describe('greetings', () => {
  test('every greeting has a Swedish gloss', () => {
    const missing = GREETINGS.filter((g) => !g.sv || g.sv.trim() === '');
    assert.deepEqual(missing.map((g) => g.es), []);
  });
  test('no line appears twice', () => {
    assert.deepEqual(duplicates(GREETINGS.map((g) => g.es)), []);
  });
});
