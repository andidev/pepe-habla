/**
 * SM-2 scheduling: how long until a card comes back.
 *
 * This module knows nothing about words, progress records or dates. It takes
 * the three numbers the algorithm owns and returns the next three, which is
 * what makes the arithmetic testable without inventing a Progress for every
 * case. progress.ts is what turns an interval into a due date.
 *
 * The grade comes from the learner's *first* tap and nothing else. A word
 * found on the third try, or after the answer has been shown, is a word that
 * was not recalled -- the session reducer enforces that, and everything here
 * assumes it.
 */

/**
 * How a first tap is graded.
 *
 * There is no 'hard'. With four options and a retry loop, the honest signal is
 * right-or-not plus how long it took; asking a child to rate their own recall
 * on a four-point scale would be noise dressed as data.
 */
export type Quality = 'again' | 'good' | 'easy';

/** Faster than this and the learner knew it cold. */
export const EASY_MS = 3_000;
/**
 * Slower than this and they were interrupted, not struggling. Nothing
 * penalises a slow right answer today, so this changes no outcome -- it is
 * here so the rule already exists if a 'hard' grade is ever added.
 */
export const DISTRACTED_MS = 30_000;

export const INITIAL_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;
export const EASE_PENALTY = 0.2;
export const EASE_BONUS = 0.1;
export const EASY_MULTIPLIER = 1.3;

/** The first two intervals are fixed. From the third on, the ease does the work. */
export const FIRST_INTERVAL = 1;
export const SECOND_INTERVAL = 3;
/** A year. Past this the interval stops meaning anything a learner can feel. */
export const MAX_INTERVAL = 365;

/** The part of a progress record the scheduler owns. */
export interface Schedule {
  /** Consecutive correct first taps. Back to zero after a miss. */
  reps: number;
  /** How fast the interval grows, 1.3 to 3.0. */
  ease: number;
  /** Days from the last answer to the next due date. */
  interval: number;
}

/**
 * Grade a first tap.
 *
 * `ms` is optional because the CLI records answers with no clock behind them;
 * an untimed answer is 'good', never 'easy', so authoring seed data can never
 * inflate a learner's intervals.
 */
export function quality(correct: boolean, ms?: number): Quality {
  if (!correct) return 'again';
  if (ms === undefined || ms > DISTRACTED_MS) return 'good';
  return ms < EASY_MS ? 'easy' : 'good';
}

/**
 * Two decimals, always.
 *
 * 2.5 - 0.2 - 0.2 is 2.0999999999999996 in binary floating point, and this
 * number is written to AsyncStorage and read back for years. Rounding at each
 * step keeps the stored value readable and keeps the drift out.
 */
const clampEase = (ease: number): number =>
  Math.round(Math.min(MAX_EASE, Math.max(MIN_EASE, ease)) * 100) / 100;

/** The next schedule. Returns a new object; the input is left alone. */
export function schedule(prev: Schedule, q: Quality): Schedule {
  // A miss sends the word back to the start rather than down one step.
  // Half-forgotten words are worth over-practising, and the cost of being
  // wrong here is only that you see an easy word tomorrow.
  if (q === 'again') {
    return {
      reps: 0,
      ease: clampEase(prev.ease - EASE_PENALTY),
      interval: FIRST_INTERVAL,
    };
  }

  const ease = q === 'easy' ? clampEase(prev.ease + EASE_BONUS) : prev.ease;
  const reps = prev.reps + 1;
  const stretch = q === 'easy' ? EASY_MULTIPLIER : 1;

  const interval =
    reps === 1 ? FIRST_INTERVAL
    : reps === 2 ? SECOND_INTERVAL
    : Math.min(MAX_INTERVAL, Math.round(prev.interval * ease * stretch));

  return { reps, ease, interval };
}
