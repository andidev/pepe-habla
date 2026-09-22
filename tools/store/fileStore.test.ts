import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileStore, projectRoot } from './fileStore.ts';
import { emptyDb } from './store.ts';
import { isStoredVocabDb, MAX_EASE, MIN_EASE } from '@pepe/core';

let root: string;

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'pepe-habla-test-'));
  await mkdir(join(root, 'data', 'seed'), { recursive: true });
});

after(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('fileStore', () => {
  test('missing progress file reads as an empty db rather than throwing', async () => {
    assert.deepEqual(await fileStore(root).loadProgress(), emptyDb());
  });

  test('progress survives a save/load round trip', async () => {
    const store = fileStore(root);
    const db = emptyDb();
    db.progress['ser'] = {
      id: 'ser', reps: 2, ease: 2.5, interval: 3, seen: 4, right: 3, wrong: 1,
      rightEsToEn: 0, rightEnToEs: 0, knownOn: null,
      lastSeen: '2026-09-19', dueOn: '2026-09-23',
    };
    await store.saveProgress(db);
    assert.deepEqual(await store.loadProgress(), db);
  });

  test('a Leitner box saved by an older version carries over to SM-2', async () => {
    await writeFile(
      join(root, 'data', 'vocab.json'),
      JSON.stringify({
        version: 1,
        progress: {
          ser: {
            id: 'ser', box: 4, seen: 6, right: 5, wrong: 1,
            lastSeen: '2026-09-19', dueOn: '2026-09-27',
          },
        },
      }),
    );
    assert.deepEqual((await fileStore(root).loadProgress()).progress['ser'], {
      id: 'ser', reps: 3, ease: 2.5, interval: 8,
      seen: 6, right: 5, wrong: 1,
      rightEsToEn: 0, rightEnToEs: 0, knownOn: null,
      lastSeen: '2026-09-19', dueOn: '2026-09-27',
    });
  });

  test("the repo's own data/vocab.json survives migration", async () => {
    // Committed, seeded from on first launch, and still carrying Leitner
    // boxes. This is the production migration path; everything else here runs
    // against a temp directory.
    const db = await fileStore(projectRoot).loadProgress();
    const records = Object.values(db.progress);
    assert.ok(records.length > 0, 'expected the committed vocab.json to hold progress');
    for (const p of records) {
      assert.ok(Number.isFinite(p.reps) && p.reps >= 0, `${p.id}: reps ${p.reps}`);
      assert.ok(p.ease >= MIN_EASE && p.ease <= MAX_EASE, `${p.id}: ease ${p.ease}`);
      assert.ok(Number.isFinite(p.interval), `${p.id}: interval ${p.interval}`);
      assert.ok(Number.isFinite(p.rightEsToEn) && Number.isFinite(p.rightEnToEs), `${p.id}: NaN counter`);
      assert.ok(p.knownOn === null || typeof p.knownOn === 'string', `${p.id}: knownOn`);
      assert.equal('box' in p, false, `${p.id} still carries a Leitner box`);
    }
  });

  test("the committed data/vocab.json is a blob loadProgress will accept", async () => {
    // The app seeds from this file and does not validate it on the way in, so
    // a hand edit that broke its shape would reach the phone unchallenged.
    const seed: unknown = JSON.parse(await readFile(join(projectRoot, 'data', 'vocab.json'), 'utf8'));
    assert.equal(isStoredVocabDb(seed), true);
    // And the check has teeth: one bad date in one record condemns the blob.
    const broken = JSON.parse(JSON.stringify(seed)) as { progress: Record<string, { dueOn: unknown }> };
    const first = Object.keys(broken.progress)[0]!;
    broken.progress[first]!.dueOn = 20260921;
    assert.equal(isStoredVocabDb(broken), false);
  });

  test('merges every seed file in the directory', async () => {
    await writeFile(
      join(root, 'data', 'seed', 'a.json'),
      JSON.stringify([{ id: 'a', es: 'a', en: 'a', sv: 'a', pos: 'noun', track: 'words', level: 1, themes: [] }]),
    );
    await writeFile(
      join(root, 'data', 'seed', 'b.json'),
      JSON.stringify([{ id: 'b', es: 'b', en: 'b', sv: 'b', pos: 'verb', track: 'words', level: 2, themes: [] }]),
    );
    const words = await fileStore(root).loadWords();
    assert.deepEqual(words.map((w) => w.id).sort(), ['a', 'b']);
  });

  test('rejects duplicate ids across seed files', async () => {
    await writeFile(
      join(root, 'data', 'seed', 'c.json'),
      JSON.stringify([{ id: 'a', es: 'dup', en: 'dup', sv: 'dup', pos: 'noun', track: 'words', level: 1, themes: [] }]),
    );
    await assert.rejects(() => fileStore(root).loadWords(), /Duplicate word id/);
  });

  test('appends session logs rather than overwriting them', async () => {
    const store = fileStore(root);
    await store.appendSessionLog('2026-09-19', 'first\n');
    await store.appendSessionLog('2026-09-19', 'second\n');
    assert.equal(await readFile(join(root, 'log', '2026-09-19.md'), 'utf8'), 'first\nsecond\n');
  });
});
