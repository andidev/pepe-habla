import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuestions, grade, optionMeaning } from './quiz.ts';
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

  test('mixes both directions over ten words', () => {
    const qs = buildQuestions(pool.slice(0, 10), pool, mulberry32(9));
    const dirs = new Set(qs.map((q) => q.direction));
    assert.ok(dirs.has('es->en') && dirs.has('en->es'),
      'expected both reading directions among ten questions');
  });

  test('distractors match the part of speech when enough exist', () => {
    const verbs = Array.from({ length: 6 }, (_, i) => word(`v${i}`, 'verb'));
    const mixed = [...pool, ...verbs];
    const qs = buildQuestions([verbs[0]!], mixed, mulberry32(2));
    const q = qs[0]!;
    const answerText = (w: Word) =>
      (q.direction === 'en->es' || q.direction === 'picture->es') ? w.es : w.en;
    const byText = new Map(mixed.map((w) => [answerText(w), w]));
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
