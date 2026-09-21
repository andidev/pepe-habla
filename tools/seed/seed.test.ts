import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fileStore, projectRoot } from '../store/fileStore.ts';

// A non-literal specifier keeps apps/app out of the root tsc program (it has its
// own tsconfig); tsc -p apps/app already enforces Greeting.sv at the type level.
const greetingsPath = '../../apps/app/storage/greetings.ts';
const { GREETINGS } = (await import(greetingsPath)) as {
  GREETINGS: readonly { es: string; sv?: string }[];
};

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
    const missing = GREETINGS.filter((g) => !g.sv || g.sv.trim() === '');
    assert.deepEqual(missing.map((g) => g.es), []);
  });
  test('no line appears twice', () => {
    assert.deepEqual(duplicates(GREETINGS.map((g) => g.es)), []);
  });
});
