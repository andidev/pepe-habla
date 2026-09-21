import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { migrateProgress, type StoredVocabDb } from './migrate.ts';

const legacyRecord = {
  id: 'el-abrigo',
  box: 2 as const,
  seen: 3,
  right: 2,
  wrong: 1,
  lastSeen: '2026-09-19',
  dueOn: '2026-09-21',
};

describe('migrateProgress', () => {
  test('a record missing all three new fields comes back with defaults', () => {
    const db: StoredVocabDb = { version: 1, progress: { 'el-abrigo': legacyRecord } };
    const next = migrateProgress(db);
    const got = next.progress['el-abrigo']!;
    assert.equal(got.rightEsToEn, 0);
    assert.equal(got.rightEnToEs, 0);
    assert.equal(got.knownOn, null);
  });

  test('a record that already has them keeps its values untouched', () => {
    const db: StoredVocabDb = {
      version: 1,
      progress: {
        'el-abrigo': { ...legacyRecord, rightEsToEn: 3, rightEnToEs: 5, knownOn: '2026-09-01' },
      },
    };
    const next = migrateProgress(db);
    const got = next.progress['el-abrigo']!;
    assert.equal(got.rightEsToEn, 3);
    assert.equal(got.rightEnToEs, 5);
    assert.equal(got.knownOn, '2026-09-01');
  });

  test('running it twice gives the same result as running it once', () => {
    const db: StoredVocabDb = { version: 1, progress: { 'el-abrigo': legacyRecord } };
    const once = migrateProgress(db);
    const twice = migrateProgress(once);
    assert.deepEqual(twice, once);
  });

  test('does not mutate the input object', () => {
    const db: StoredVocabDb = { version: 1, progress: { 'el-abrigo': legacyRecord } };
    migrateProgress(db);
    assert.equal((legacyRecord as Partial<typeof legacyRecord & { rightEsToEn: number }>).rightEsToEn, undefined);
    assert.deepEqual(db.progress['el-abrigo']!, legacyRecord);
  });
});
