import type { VocabDb, Word } from '../core/types.ts';

/**
 * Everything the trainer needs from the outside world.
 *
 * Core logic never touches this — the CLI wires an implementation in. A web
 * build supplies a localStorage adapter, an Expo build an AsyncStorage or
 * SQLite one, and neither has to change a line of scheduling code.
 */
export interface VocabStore {
  /** The static word list. */
  loadWords(): Promise<Word[]>;
  /** What is known about each word. */
  loadProgress(): Promise<VocabDb>;
  saveProgress(db: VocabDb): Promise<void>;
  /** Record of one practice session, for reading back later. */
  appendSessionLog(date: string, markdown: string): Promise<void>;
}

export const emptyDb = (): VocabDb => ({ version: 1, progress: {} });
