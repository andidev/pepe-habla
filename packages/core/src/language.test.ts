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
