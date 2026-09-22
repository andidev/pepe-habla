import type { Progress, VocabDb } from './types.ts';
import { INITIAL_EASE } from './sm2.ts';
import { isISODate } from './dates.ts';

type Added = 'rightEsToEn' | 'rightEnToEs' | 'knownOn';
type Scheduling = 'reps' | 'ease' | 'interval';
type Counts = 'seen' | 'right' | 'wrong';

/** A Leitner box, as every version before SM-2 stored it. 1 = shaky, 5 = solid. */
type Box = 1 | 2 | 3 | 4 | 5;

/**
 * What each box carries over as.
 *
 * A word in box N has N−1 consecutive correct answers behind it. The intervals
 * are mostly SM-2's own values (1, 3, 8 for reps 1, 2, 3), except box 5 keeps
 * Leitner's 16 instead of SM-2's 20. This table is fixed by the spec and must
 * not be recomputed. Nothing moves on the upgrade day because `dueOn` is
 * carried over untouched. Everyone starts at the default ease.
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
  Omit<Progress, Added | Scheduling | Counts>
  & Partial<Pick<Progress, Added | Scheduling | Counts>>
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
      seen: p.seen ?? 0,
      right: p.right ?? 0,
      wrong: p.wrong ?? 0,
      rightEsToEn: p.rightEsToEn ?? 0,
      rightEnToEs: p.rightEnToEs ?? 0,
      knownOn: p.knownOn ?? null,
    };
  }
  const version = db?.version ?? 1;
  return { ...db, version, progress };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Every number migrateProgress will default. Absent and null both heal. */
const COUNTERS = [
  'reps', 'ease', 'interval',
  'seen', 'right', 'wrong',
  'rightEsToEn', 'rightEnToEs',
] as const;

const healsToANumber = (value: unknown): boolean =>
  value === undefined || value === null
  || (typeof value === 'number' && Number.isFinite(value));

const isStoredProgress = (value: unknown): value is StoredProgress => {
  if (!isRecord(value)) return false;
  if (typeof value['id'] !== 'string') return false;
  if (!isISODate(value['dueOn'])) return false;
  if (value['lastSeen'] !== null && !isISODate(value['lastSeen'])) return false;
  if (value['knownOn'] !== undefined && value['knownOn'] !== null
    && !isISODate(value['knownOn'])) return false;
  // `box` is deliberately not checked: boxOf() already turns anything
  // unrecognisable into the shakiest box.
  return COUNTERS.every((field) => healsToANumber(value[field]));
};

/**
 * Is this a blob migrateProgress can actually migrate?
 *
 * Parsing tells you the JSON was well formed, not that it holds progress.
 * migrateProgress fills in what is missing, so this asks only about what it
 * cannot fill in: the dates it carries over untouched, the id it keys on, and
 * counters that are present but not numbers -- `"3" + 1` is `"31"` and
 * `NaN >= 3` is false forever, so such a word could never become known and
 * nothing would ever say why.
 *
 * One bad record condemns the blob. A loader that dropped the bad ones would
 * be deciding, on its own, which months of practice to throw away.
 */
export function isStoredVocabDb(value: unknown): value is StoredVocabDb {
  if (!isRecord(value) || value['version'] !== 1) return false;
  const progress = value['progress'];
  return isRecord(progress) && Object.values(progress).every(isStoredProgress);
}
