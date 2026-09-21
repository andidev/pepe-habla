import type { Progress, Word } from './types.ts';
import { daysBetween } from './dates.ts';
import { isDue, isKnown } from './progress.ts';

// `isKnown` lives in progress.ts because applyAnswer has to ask the question to
// stamp `knownOn`, and the module that records answers must not import the one
// that derives statistics. Re-exported here so screens have one import.
export { isKnown, KNOWN_THRESHOLD } from './progress.ts';

/** Days back that "this week" reaches. */
const WEEK = 7;

export interface Summary {
  /** Words available to learn at all. */
  total: number;
  /** Words answered at least once. */
  practised: number;
  known: number;
  learnedThisWeek: number;
  due: number;
  /** Whole percent over every answer given, or null before the first. */
  accuracy: number | null;
}

export interface Leech {
  word: Word;
  wrong: number;
  seen: number;
  /** Whole percent. */
  accuracy: number;
}

export function summarise(
  words: readonly Word[],
  progress: Readonly<Record<string, Progress>>,
  today: string,
): Summary {
  let practised = 0;
  let known = 0;
  let learnedThisWeek = 0;
  let due = 0;
  let answers = 0;
  let correct = 0;

  for (const w of words) {
    const p = progress[w.id];
    if (p === undefined) continue;
    practised += 1;
    answers += p.seen;
    correct += p.right;
    if (isDue(p, today)) due += 1;
    if (isKnown(p)) known += 1;
    // Counted on the day it was learned, independently of whether it still is:
    // measuring "known words seen recently" would creep toward the total as
    // old words come up for review.
    if (p.knownOn !== null && daysBetween(p.knownOn, today) < WEEK) {
      learnedThisWeek += 1;
    }
  }

  return {
    total: words.length,
    practised,
    known,
    learnedThisWeek,
    due,
    accuracy: answers === 0 ? null : Math.round((correct / answers) * 100),
  };
}

/**
 * The words costing the most, worst first.
 *
 * Most apps hide this. It is the most useful list on the screen: a handful of
 * words usually account for most of the misses, and naming them is what lets
 * the learner do something about it.
 */
export function leeches(
  words: readonly Word[],
  progress: Readonly<Record<string, Progress>>,
  limit = 5,
): Leech[] {
  const out: Leech[] = [];
  for (const w of words) {
    const p = progress[w.id];
    if (p === undefined || p.wrong === 0) continue;
    out.push({
      word: w,
      wrong: p.wrong,
      seen: p.seen,
      accuracy: Math.round((p.right / p.seen) * 100),
    });
  }
  return out
    .sort((a, b) => b.wrong - a.wrong || a.accuracy - b.accuracy)
    .slice(0, limit);
}
