import type { Progress, VocabDb } from './types.ts';
import { INITIAL_EASE } from './sm2.ts';

type Added = 'rightEsToEn' | 'rightEnToEs' | 'knownOn';
type Scheduling = 'reps' | 'ease' | 'interval';

/** A Leitner box, as every version before SM-2 stored it. 1 = shaky, 5 = solid. */
type Box = 1 | 2 | 3 | 4 | 5;

/**
 * What each box carries over as.
 *
 * A word in box N has N-1 consecutive correct answers behind it, and keeps the
 * interval Leitner had already given it, so no word jumps forward or back on
 * the day of the upgrade. Everyone starts at the default ease: we have no
 * response times from before, and guessing at them would be inventing data.
 */
const FROM_BOX: Record<Box, { reps: number; interval: number }> = {
  1: { reps: 0, interval: 1 },
  2: { reps: 1, interval: 1 },
  3: { reps: 2, interval: 3 },
  4: { reps: 3, interval: 8 },
  5: { reps: 4, interval: 16 },
};

const boxOf = (box: unknown): Box =>
  typeof box === 'number' && box >= 1 && box <= 5 ? (Math.round(box) as Box) : 1;

/**
 * Progress as an earlier version may have saved it: the scheduling fields and
 * the phase 2 counters may be absent, and a Leitner `box` may be present.
 */
export type StoredProgress =
  Omit<Progress, Added | Scheduling>
  & Partial<Pick<Progress, Added | Scheduling>>
  & { box?: number };

export interface StoredVocabDb {
  version: 1;
  progress: Record<string, StoredProgress>;
}

/**
 * Bring saved progress up to the current shape.
 *
 * Every loader runs this, whatever wrote the data. Two things it has to get
 * right: adding to `undefined` gives `NaN`, and `NaN >= 3` is always false --
 * a word with a NaN counter could never become known and nothing would ever
 * say so -- and a Leitner box has to become a streak and an interval, because
 * the scheduler that reads them no longer knows what a box is.
 *
 * `knownOn` defaults to null rather than a guess: we do not know when an
 * already-known word was learned, and guessing would inflate "learned this
 * week" on the first launch after upgrading.
 */
export function migrateProgress(db: StoredVocabDb): VocabDb {
  const progress: Record<string, Progress> = {};
  // A hand-edited or half-merged file is worth a clean empty db, not a
  // TypeError that names neither the file nor the problem.
  for (const [id, stored] of Object.entries(db?.progress ?? {})) {
    const { box, ...p } = stored;
    const carried = FROM_BOX[boxOf(box)];
    progress[id] = {
      ...p,
      reps: p.reps ?? carried.reps,
      ease: p.ease ?? INITIAL_EASE,
      interval: p.interval ?? carried.interval,
      rightEsToEn: p.rightEsToEn ?? 0,
      rightEnToEs: p.rightEnToEs ?? 0,
      knownOn: p.knownOn ?? null,
    };
  }
  return { ...db, progress };
}
