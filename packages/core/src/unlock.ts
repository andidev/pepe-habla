import type { Progress, Word } from './types.ts';
import { levelsIn, type Track } from './levels.ts';

/**
 * Consecutive correct first taps before a card counts toward opening the next
 * level. Deliberately looser than `isKnown`, which wants three in *each*
 * direction: gating on that would mean roughly 140 rounds of review before
 * words level 2 opened, and the gate is meant to measure that a level is well
 * under way, not that it is finished.
 */
export const DOMINADAS_REPS = 3;

/** How much of a level must be dominada before the next one opens. */
export const UNLOCK_RATIO = 0.7;

/**
 * The gate's own measure. The app calls this `dominadas` and never
 * `conocidas`, because the stats screen's Conocidas is the stricter, honest
 * figure and the two numbers must never be read as the same thing.
 */
export const isDominada = (p: Progress): boolean => p.reps >= DOMINADAS_REPS;

export interface LevelStats {
  level: number;
  /** Cards that exist in this level. */
  total: number;
  dominadas: number;
  /** dominadas / total, or 0 for a level with no cards yet. */
  ratio: number;
}

export function levelStats(
  words: readonly Word[],
  progress: Readonly<Record<string, Progress>>,
  track: Track,
  level: number,
): LevelStats {
  let total = 0;
  let dominadas = 0;
  for (const w of words) {
    if (w.track !== track || w.level !== level) continue;
    total += 1;
    const p = progress[w.id];
    if (p !== undefined && isDominada(p)) dominadas += 1;
  }
  return { level, total, dominadas, ratio: total === 0 ? 0 : dominadas / total };
}

/**
 * The highest level open on this track. Level 1 is always open.
 *
 * A level with no cards in it is a wall rather than a free pass: it can never
 * be 70% dominada, so nothing beyond it opens. That matters while 3c is still
 * filling the ladder -- an empty level 4 must not hand the learner level 5.
 */
export function unlockedThrough(
  words: readonly Word[],
  progress: Readonly<Record<string, Progress>>,
  track: Track,
): number {
  const top = levelsIn(track);
  let open = 1;
  while (open < top) {
    const { total, dominadas } = levelStats(words, progress, track, open);
    if (total === 0 || dominadas / total < UNLOCK_RATIO) break;
    open += 1;
  }
  return open;
}
