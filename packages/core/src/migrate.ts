import type { Progress, VocabDb } from './types.ts';

type Added = 'rightEsToEn' | 'rightEnToEs' | 'knownOn';

/** Progress as an earlier version may have saved it: the added fields may be absent. */
export type StoredProgress = Omit<Progress, Added> & Partial<Pick<Progress, Added>>;

export interface StoredVocabDb {
  version: 1;
  progress: Record<string, StoredProgress>;
}

/**
 * Bring saved progress up to the current shape.
 *
 * Adding to `undefined` gives `NaN`, and `NaN >= 3` is always false — a word
 * with a NaN counter could never become known, and nothing would ever say so.
 * Every loader runs this, whatever wrote the data.
 *
 * `knownOn` defaults to null rather than a guess: we do not know when an
 * already-known word was learned, and guessing would inflate "learned this
 * week" on the first launch after upgrading.
 */
export function migrateProgress(db: StoredVocabDb): VocabDb {
  const progress: Record<string, Progress> = {};
  for (const [id, p] of Object.entries(db.progress)) {
    progress[id] = {
      ...p,
      rightEsToEn: p.rightEsToEn ?? 0,
      rightEnToEs: p.rightEnToEs ?? 0,
      knownOn: p.knownOn ?? null,
    };
  }
  return { ...db, progress };
}
