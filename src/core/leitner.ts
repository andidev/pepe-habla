import type { Box, Progress } from './types.ts';
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

/** Record an answer. Returns a new Progress; the input is left alone. */
export function applyAnswer(p: Progress, correct: boolean, today: string): Progress {
  const box: Box = correct ? promote(p.box) : 1;
  return {
    ...p,
    box,
    seen: p.seen + 1,
    right: p.right + (correct ? 1 : 0),
    wrong: p.wrong + (correct ? 0 : 1),
    lastSeen: today,
    dueOn: addDays(today, INTERVALS[box]),
  };
}

/** A word being introduced for the first time: shakiest box, due right now. */
export function freshProgress(id: string, today: string): Progress {
  return { id, box: 1, seen: 0, right: 0, wrong: 0, lastSeen: null, dueOn: today };
}

export function isDue(p: Progress, today: string): boolean {
  return p.dueOn <= today; // ISO dates sort lexicographically
}
