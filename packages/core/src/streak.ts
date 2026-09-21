import { daysBetween } from './dates.ts';

export interface Streak {
  days: number;
  /** ISO date of the last completed round. */
  lastDate: string | null;
}

export const emptyStreak = (): Streak => ({ days: 0, lastDate: null });

/**
 * Record that a round was completed today.
 *
 * A missed day resets to one. There is no freeze and nothing to buy: the number
 * is only worth looking at if it is true.
 */
export function bumpStreak(streak: Streak, today: string): Streak {
  if (streak.lastDate === null) return { days: 1, lastDate: today };

  const gap = daysBetween(streak.lastDate, today);
  if (gap === 0) return streak;
  if (gap === 1) return { days: streak.days + 1, lastDate: today };
  return { days: 1, lastDate: today };
}
