import { daysBetween, isISODate } from './dates.ts';

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

/**
 * Is this a streak we can do arithmetic on?
 *
 * Storage casts what it parses; this is what makes the cast true. A streak
 * whose `lastDate` is a number reaches `daysBetween` and throws there, and in
 * the notification scheduler that throw lands after the old reminders have
 * already been cancelled — the learner then gets none, for good, while the
 * settings switch still reads on.
 */
export function isStreak(value: unknown): value is Streak {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const { days, lastDate } = value as { days?: unknown; lastDate?: unknown };
  if (typeof days !== 'number' || !Number.isFinite(days) || days < 0) return false;
  return lastDate === null || isISODate(lastDate);
}
