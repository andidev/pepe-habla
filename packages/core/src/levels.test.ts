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
