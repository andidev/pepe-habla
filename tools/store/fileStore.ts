import { readFile, writeFile, readdir, mkdir, appendFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { VocabDb, Word, StoredVocabDb } from '@pepe/core';
import { migrateProgress } from '@pepe/core';
import { emptyDb, type VocabStore } from './store.ts';

/** The Node adapter: seed files on disk, progress in data/vocab.json, logs in log/. */
export function fileStore(root: string): VocabStore {
  const seedDir = join(root, 'data', 'seed');
  const dbPath = join(root, 'data', 'vocab.json');
  const logDir = join(root, 'log');

  return {
    async loadWords(): Promise<Word[]> {
      const files = (await readdir(seedDir)).filter((f) => f.endsWith('.json')).sort();
      const tiers = await Promise.all(
        files.map(async (f) => JSON.parse(await readFile(join(seedDir, f), 'utf8')) as Word[]),
      );
      const words = tiers.flat();

      const seen = new Set<string>();
      for (const w of words) {
        if (seen.has(w.id)) throw new Error(`Duplicate word id in seed data: "${w.id}"`);
        seen.add(w.id);
      }
      return words;
    },

    async loadProgress(): Promise<VocabDb> {
      try {
        const stored = JSON.parse(await readFile(dbPath, 'utf8')) as StoredVocabDb;
        return migrateProgress(stored);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return emptyDb();
        throw err;
      }
    },

    async saveProgress(db: VocabDb): Promise<void> {
      await mkdir(dirname(dbPath), { recursive: true });
      await writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
    },

    async appendSessionLog(date: string, markdown: string): Promise<void> {
      await mkdir(logDir, { recursive: true });
      await appendFile(join(logDir, `${date}.md`), markdown, 'utf8');
    },
  };
}

/** The project root, found relative to this file. */
export const projectRoot = join(import.meta.dirname, '..', '..');
