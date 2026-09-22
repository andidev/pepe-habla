import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isStoredVocabDb, migrateProgress, type StoredVocabDb } from './migrate.ts';
import { INITIAL_EASE } from './sm2.ts';

/** A record as the Leitner version saved it: a box, and none of the rest. */
const legacy = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'ser',
  box: 2,
  seen: 4,
  right: 3,
  wrong: 1,
  lastSeen: '2026-09-19',
  dueOn: '2026-09-21',
  ...over,
});

// `as unknown as` on purpose: these fixtures build shapes the current types say
// cannot exist -- a null counter, a missing progress map -- and defending
// against exactly those is what migrateProgress is for.
const db = (record: Record<string, unknown>): StoredVocabDb =>
  ({ version: 1, progress: { ser: record } }) as unknown as StoredVocabDb;

describe('migrateProgress', () => {
  test('a Leitner box becomes the streak behind it and the interval it had', () => {
    const p = migrateProgress(db(legacy({ box: 4 }))).progress['ser']!;
    assert.equal(p.reps, 3);
    assert.equal(p.interval, 8);
    assert.equal(p.ease, INITIAL_EASE);
  });

  test('every box carries over', () => {
    const expected = [
      [1, 0, 1],
      [2, 1, 1],
      [3, 2, 3],
      [4, 3, 8],
      [5, 4, 16],
    ] as const;
    for (const [box, reps, interval] of expected) {
      const p = migrateProgress(db(legacy({ box }))).progress['ser']!;
      assert.deepEqual([p.reps, p.interval], [reps, interval], `box ${box}`);
    }
  });

  test('the box itself is dropped, not carried along', () => {
    // A dead field in a record that is rewritten for years is a field somebody
    // will eventually read.
    const p = migrateProgress(db(legacy())).progress['ser']!;
    assert.equal('box' in p, false);
  });

  test('the due date, last seen and the counts are untouched', () => {
    const p = migrateProgress(db(legacy())).progress['ser']!;
    assert.equal(p.dueOn, '2026-09-21');
    assert.equal(p.lastSeen, '2026-09-19');
    assert.deepEqual([p.seen, p.right, p.wrong], [4, 3, 1]);
  });

  test('the fields phase 2 added default rather than becoming NaN', () => {
    const p = migrateProgress(db(legacy())).progress['ser']!;
    assert.deepEqual([p.rightEsToEn, p.rightEnToEs, p.knownOn], [0, 0, null]);
  });

  test('missing seen, right and wrong default to zero', () => {
    // No stored record has ever lacked these -- this is purely defensive --
    // but a NaN counter is exactly the failure migrateProgress exists to heal.
    const record = legacy();
    delete record.seen;
    delete record.right;
    delete record.wrong;
    const p = migrateProgress(db(record)).progress['ser']!;
    assert.deepEqual([p.seen, p.right, p.wrong], [0, 0, 0]);
  });

  test('a null counter becomes zero too', () => {
    // A CLI built before migrateProgress existed computed `undefined + 0` and
    // JSON.stringify wrote the NaN out as null. Absent and null must both heal.
    const p = migrateProgress(db(legacy({ rightEsToEn: null, rightEnToEs: null }))).progress['ser']!;
    assert.deepEqual([p.rightEsToEn, p.rightEnToEs], [0, 0]);
  });

  test('a record already on SM-2 is left exactly as it is', () => {
    const current = {
      id: 'ser', reps: 5, ease: 2.8, interval: 45,
      seen: 9, right: 8, wrong: 1,
      rightEsToEn: 4, rightEnToEs: 4, knownOn: '2026-09-10',
      lastSeen: '2026-09-19', dueOn: '2026-11-03',
    };
    assert.deepEqual(migrateProgress(db(current)).progress['ser'], current);
  });

  test('an unrecognisable box is treated as the shakiest one', () => {
    const p = migrateProgress(db(legacy({ box: 99 }))).progress['ser']!;
    assert.deepEqual([p.reps, p.interval], [0, 1]);
  });

  test('a db with no progress map migrates to an empty one rather than throwing', () => {
    // A hand-edited or half-merged vocab.json must not take the CLI down with
    // a TypeError that names neither the file nor the problem.
    assert.deepEqual(migrateProgress({ version: 1 } as unknown as StoredVocabDb), { version: 1, progress: {} });
  });

  test('it is idempotent', () => {
    // A VocabDb is a valid StoredVocabDb -- every optional field is filled in.
    const once = migrateProgress(db(legacy()));
    assert.deepEqual(migrateProgress(once), once);
  });

  test('it does not mutate the input', () => {
    const input = db(legacy());
    migrateProgress(input);
    assert.equal(input.progress['ser']?.box, 2);
  });
});

/** A stored blob wrapping one record, as `unknown` — the validator's input. */
const blob = (record: unknown): unknown => ({ version: 1, progress: { ser: record } });

describe('isStoredVocabDb', () => {
  test('the shape the bundled seed uses passes', () => {
    assert.equal(isStoredVocabDb(blob(legacy())), true);
  });

  test('a record already on SM-2 passes', () => {
    assert.equal(isStoredVocabDb(blob({
      id: 'ser', reps: 5, ease: 2.8, interval: 45,
      seen: 9, right: 8, wrong: 1,
      rightEsToEn: 4, rightEnToEs: 4, knownOn: '2026-09-10',
      lastSeen: '2026-09-19', dueOn: '2026-11-03',
    })), true);
  });

  test('an empty progress map passes', () => {
    assert.equal(isStoredVocabDb({ version: 1, progress: {} }), true);
  });

  test('counters migrateProgress can heal pass', () => {
    // Absent and null both become zero; rejecting them would throw away a
    // history that loads perfectly well.
    assert.equal(isStoredVocabDb(blob(legacy({ rightEsToEn: null, seen: null }))), true);
    const record = legacy();
    delete record.seen;
    assert.equal(isStoredVocabDb(blob(record)), true);
  });

  test('a box of any shape passes — migrateProgress owns that field', () => {
    assert.equal(isStoredVocabDb(blob(legacy({ box: 99 }))), true);
    assert.equal(isStoredVocabDb(blob(legacy({ box: 'two' }))), true);
  });

  test('a due date that is not an ISO date fails', () => {
    assert.equal(isStoredVocabDb(blob(legacy({ dueOn: 20260921 }))), false);
    assert.equal(isStoredVocabDb(blob(legacy({ dueOn: null }))), false);
    const record = legacy();
    delete record.dueOn;
    assert.equal(isStoredVocabDb(blob(record)), false);
  });

  test('lastSeen must be null or an ISO date', () => {
    assert.equal(isStoredVocabDb(blob(legacy({ lastSeen: null }))), true);
    assert.equal(isStoredVocabDb(blob(legacy({ lastSeen: 20260919 }))), false);
    const record = legacy();
    delete record.lastSeen;
    assert.equal(isStoredVocabDb(blob(record)), false);
  });

  test('knownOn must be absent, null or an ISO date', () => {
    assert.equal(isStoredVocabDb(blob(legacy({ knownOn: '2026-09-10' }))), true);
    assert.equal(isStoredVocabDb(blob(legacy({ knownOn: 'last week' }))), false);
  });

  test('a counter that is present but not a number fails', () => {
    // `"3" + 1` is "31", and NaN >= 3 is false forever: a word with either
    // could never become known and nothing would say why.
    assert.equal(isStoredVocabDb(blob(legacy({ seen: '3' }))), false);
    assert.equal(isStoredVocabDb(blob(legacy({ ease: 'easy' }))), false);
    assert.equal(isStoredVocabDb(blob(legacy({ reps: NaN }))), false);
    assert.equal(isStoredVocabDb(blob(legacy({ interval: Infinity }))), false);
  });

  test('a record with no id fails', () => {
    const record = legacy();
    delete record.id;
    assert.equal(isStoredVocabDb(blob(record)), false);
  });

  test('a record that is not an object fails', () => {
    assert.equal(isStoredVocabDb(blob('ser')), false);
    assert.equal(isStoredVocabDb(blob(null)), false);
  });

  test('the wrapper itself has to be a version 1 db with a progress map', () => {
    assert.equal(isStoredVocabDb(null), false);
    assert.equal(isStoredVocabDb([]), false);
    assert.equal(isStoredVocabDb('{}'), false);
    assert.equal(isStoredVocabDb({ version: 1 }), false);
    assert.equal(isStoredVocabDb({ version: 2, progress: {} }), false);
    assert.equal(isStoredVocabDb({ progress: {} }), false);
    assert.equal(isStoredVocabDb({ version: 1, progress: [] }), false);
  });

  test('everything it accepts, migrateProgress can migrate', () => {
    const accepted = blob(legacy());
    assert.ok(isStoredVocabDb(accepted));
    const migrated = migrateProgress(accepted).progress['ser']!;
    assert.equal(typeof migrated.dueOn, 'string');
    assert.equal(Number.isFinite(migrated.seen), true);
  });
});
