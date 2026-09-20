import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuestions, grade } from './quiz.ts';
import { mulberry32 } from './rng.ts';
import type { PartOfSpeech, Word } from './types.ts';

const word = (id: string, pos: PartOfSpeech = 'noun'): Word => ({
  id, es: `es-${id}`, en: `en-${id}`, pos, tier: 1,
});

const pool = Array.from({ length: 20 }, (_, i) => word(`w${i}`));

describe('buildQuestions', () => {
  test('builds one question per selected word', () => {
    const selected = pool.slice(0, 5);
    const qs = buildQuestions(selected, pool, mulberry32(1));
    assert.equal(qs.length, 5);
    assert.deepEqual(qs.map((q) => q.word.id), selected.map((w) => w.id));
  });

  test('every question offers four distinct options', () => {
    const qs = buildQuestions(pool.slice(0, 10), pool, mulberry32(1));
    for (const q of qs) {
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options).size, 4, `duplicate option in ${q.word.id}`);
    }
  });

  test('the answer is always among the options', () => {
    const qs = buildQuestions(pool.slice(0, 10), pool, mulberry32(3));
    for (const q of qs) {
      assert.ok(q.options.includes(q.answer), `answer missing for ${q.word.id}`);
    }
  });

  test('prompt and answer follow the direction', () => {
    const qs = buildQuestions(pool.slice(0, 10), pool, mulberry32(5));
    for (const q of qs) {
      if (q.direction === 'es->en') {
        assert.equal(q.prompt, q.word.es);
        assert.equal(q.answer, q.word.en);
      } else {
        assert.equal(q.prompt, q.word.en);
        assert.equal(q.answer, q.word.es);
      }
    }
  });

  test('mixes both directions over ten words', () => {
    const qs = buildQuestions(pool.slice(0, 10), pool, mulberry32(9));
    const dirs = new Set(qs.map((q) => q.direction));
    assert.equal(dirs.size, 2, 'expected a mix of es->en and en->es');
  });

  test('distractors match the part of speech when enough exist', () => {
    const verbs = Array.from({ length: 6 }, (_, i) => word(`v${i}`, 'verb'));
    const mixed = [...pool, ...verbs];
    const qs = buildQuestions([verbs[0]!], mixed, mulberry32(2));
    const q = qs[0]!;
    const byText = new Map(mixed.map((w) => [q.direction === 'es->en' ? w.en : w.es, w]));
    for (const opt of q.options) {
      if (opt === q.answer) continue;
      assert.equal(byText.get(opt)?.pos, 'verb', `distractor "${opt}" is not a verb`);
    }
  });

  test('falls back to other parts of speech rather than repeating an option', () => {
    const lonely = word('lonely', 'adverb');
    const mixed = [lonely, ...pool];
    const q = buildQuestions([lonely], mixed, mulberry32(4))[0]!;
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4);
  });

  test('copes with a pool too small for four options', () => {
    const tiny = [word('a'), word('b')];
    const q = buildQuestions([tiny[0]!], tiny, mulberry32(1))[0]!;
    assert.equal(q.options.length, 2);
    assert.ok(q.options.includes(q.answer));
  });

  test('never offers the answer as its own distractor', () => {
    const qs = buildQuestions(pool, pool, mulberry32(11));
    for (const q of qs) {
      const others = q.options.filter((o) => o === q.answer);
      assert.equal(others.length, 1, `answer appears twice for ${q.word.id}`);
    }
  });

  test('is deterministic for a given seed', () => {
    const a = buildQuestions(pool.slice(0, 5), pool, mulberry32(8));
    const b = buildQuestions(pool.slice(0, 5), pool, mulberry32(8));
    assert.deepEqual(a, b);
  });
});

describe('grade', () => {
  test('exact match is correct', () => {
    assert.equal(grade('the coat', 'the coat'), true);
  });
  test('case and surrounding space do not matter', () => {
    assert.equal(grade('  The Coat ', 'the coat'), true);
  });
  test('a different answer is wrong', () => {
    assert.equal(grade('the hat', 'the coat'), false);
  });
});
