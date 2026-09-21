import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  startSession, reduce, currentQuestion, roundScore, sessionScore,
} from './session.ts';
import type { Question, Word } from './types.ts';

const word = (id: string): Word => ({ id, es: `es-${id}`, en: `en-${id}`, sv: `sv-${id}`, pos: 'noun', tier: 1 });

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

  test('is ignored mid-repair, so pending repairs are never silently dropped', () => {
    const qs = [q('a'), q('b')];
    let s = startSession(qs);
    s = reduce(s, wrong());            // miss a
    s = reduce(s, next());
    s = reduce(s, right(qs[1]!));      // get b
    s = reduce(s, next());             // -> repairing
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

    const before = s.phase;
    const s2 = reduce(s, { type: 'anotherRound', questions: [q('b')] });
    assert.equal(s2.phase, before, 'should stay finished');
    assert.equal(s2.round, 1, 'round must not change');
  });
});

describe('finishing', () => {
  test('finish ends the session', () => {
    const s = reduce(startSession([q('a')]), { type: 'finish' });
    assert.equal(s.phase, 'finished');
    assert.equal(currentQuestion(s), null);
  });
});
