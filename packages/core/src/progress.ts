import type { Direction, Progress } from './types.ts';
import { addDays } from './dates.ts';
import { answersInGloss } from './language.ts';
import { INITIAL_EASE, quality, schedule } from './sm2.ts';

/**
 * What the learner did on their **first** tap at a question.
 *
 * Only a first tap ever reaches here. A word found by elimination, or right on
 * the third try, was not recalled; the session reducer drops those, and a
 * repair answer is never recorded at all.
 */
export interface Answer {
  correct: boolean;
  /**
   * Which way round the question was asked, or null when it is genuinely
   * unknown -- the CLI records answers without one. Null rather than optional
   * on purpose: "forgotten" and "deliberately unknown" have to look different
   * at the call site, because the first is a bug that makes a word permanently
   * unknowable and the second is correct.
   */
  direction: Direction | null;
  /** Milliseconds from the question appearing to that first tap. Absent when untimed. */
  ms?: number;
}

/** Correct answers needed in each direction before a word counts as known. */
export const KNOWN_THRESHOLD = 3;

/**
 * Known means answered correctly in *both* directions, three times each.
 *
 * Recognising `la tienda` is much easier than producing it, and with four
 * options a guess lands a quarter of the time. The number a learner judges
 * themselves by has to be harder to earn than the scheduler's.
 */
export function isKnown(p: Progress): boolean {
  return p.rightEsToEn >= KNOWN_THRESHOLD && p.rightEnToEs >= KNOWN_THRESHOLD;
}

/** Record an answer. Returns a new Progress; the input is left alone. */
export function applyAnswer(p: Progress, answer: Answer, today: string): Progress {
  const { reps, ease, interval } = schedule(p, quality(answer.correct, answer.ms));
  // Only a correct answer whose direction we know credits a counter.
  const credited = answer.correct ? answer.direction : null;

  const next: Progress = {
    ...p,
    reps,
    ease,
    interval,
    seen: p.seen + 1,
    right: p.right + (answer.correct ? 1 : 0),
    wrong: p.wrong + (answer.correct ? 0 : 1),
    rightEsToEn: p.rightEsToEn + (credited !== null && answersInGloss(credited) ? 1 : 0),
    rightEnToEs: p.rightEnToEs + (credited !== null && !answersInGloss(credited) ? 1 : 0),
    lastSeen: today,
    dueOn: addDays(today, interval),
  };

  // Stamp the day it crossed, once. A word that later lapses keeps its date --
  // it was learned then, and "learned this week" is a record of what happened,
  // not a claim about what you still remember.
  return next.knownOn === null && isKnown(next)
    ? { ...next, knownOn: today }
    : next;
}

/** A word being introduced for the first time: nothing behind it, due right now. */
export function freshProgress(id: string, today: string): Progress {
  return {
    id,
    reps: 0,
    ease: INITIAL_EASE,
    // No interval yet. The first answer sets one; nothing reads this until
    // the third, by which time it has been written twice.
    interval: 0,
    seen: 0,
    right: 0,
    wrong: 0,
    rightEsToEn: 0,
    rightEnToEs: 0,
    knownOn: null,
    lastSeen: null,
    dueOn: today,
  };
}

export function isDue(p: Progress, today: string): boolean {
  return p.dueOn <= today; // ISO dates sort lexicographically
}
