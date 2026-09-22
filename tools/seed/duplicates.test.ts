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
