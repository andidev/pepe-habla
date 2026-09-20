import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileStore } from './fileStore.ts';
import { emptyDb } from './store.ts';

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
      id: 'ser', box: 3, seen: 4, right: 3, wrong: 1,
      lastSeen: '2026-09-19', dueOn: '2026-09-23',
    };
    await store.saveProgress(db);
    assert.deepEqual(await store.loadProgress(), db);
  });

  test('merges every seed file in the directory', async () => {
    await writeFile(
      join(root, 'data', 'seed', 'a.json'),
      JSON.stringify([{ id: 'a', es: 'a', en: 'a', pos: 'noun', tier: 1 }]),
    );
    await writeFile(
      join(root, 'data', 'seed', 'b.json'),
      JSON.stringify([{ id: 'b', es: 'b', en: 'b', pos: 'verb', tier: 2 }]),
    );
    const words = await fileStore(root).loadWords();
    assert.deepEqual(words.map((w) => w.id).sort(), ['a', 'b']);
  });

  test('rejects duplicate ids across seed files', async () => {
    await writeFile(
      join(root, 'data', 'seed', 'c.json'),
      JSON.stringify([{ id: 'a', es: 'dup', en: 'dup', pos: 'noun', tier: 1 }]),
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
