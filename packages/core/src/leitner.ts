import type { Box, Direction, Progress } from './types.ts';
import { addDays } from './dates.ts';

/**
 * Leitner scheduling: how many days until a word in each box comes back.
 *
 * A right answer moves a word up one box, so the gap roughly doubles each time
 * it is recalled. A wrong answer sends it all the way back to box 1 rather than
 * down one step — half-forgotten words are worth over-practising, and the cost
 * of being wrong here is only that you see an easy word tomorrow.
 */
export const INTERVALS: Record<Box, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

export const MAX_BOX: Box = 5;

export function promote(box: Box): Box {
  return (box < MAX_BOX ? box + 1 : MAX_BOX) as Box;
}

/** Which counter a direction advances. Listening is recognition; pictures are production. */
const answersInEnglish = (d: Direction): boolean => d === 'es->en' || d === 'listen->en';

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
export function applyAnswer(
  p: Progress,
  correct: boolean,
  today: string,
  direction?: Direction,
): Progress {
  const box: Box = correct ? promote(p.box) : 1;
  const scored = correct && direction !== undefined;
  const next: Progress = {
    ...p,
    box,
    seen: p.seen + 1,
    right: p.right + (correct ? 1 : 0),
    wrong: p.wrong + (correct ? 0 : 1),
    rightEsToEn: p.rightEsToEn + (scored && answersInEnglish(direction) ? 1 : 0),
    rightEnToEs: p.rightEnToEs + (scored && !answersInEnglish(direction) ? 1 : 0),
    lastSeen: today,
    dueOn: addDays(today, INTERVALS[box]),
  };
  // Stamp the day it crossed, once. A word that later lapses keeps its date —
  // it was learned then, and "learned this week" is a record of what happened,
  // not a claim about what you still remember.
  return next.knownOn === null && isKnown(next)
    ? { ...next, knownOn: today }
    : next;
}

/** A word being introduced for the first time: shakiest box, due right now. */
export function freshProgress(id: string, today: string): Progress {
  return {
    id,
    box: 1,
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
