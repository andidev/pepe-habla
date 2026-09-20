/**
 * ISO date (YYYY-MM-DD) arithmetic, done in UTC.
 *
 * Everything here works on date strings rather than Date objects so that a
 * machine in Oslo and a phone in Mexico City agree on what "tomorrow" means.
 * Using local-time Date maths would silently shift a due date by a day across
 * a daylight-saving boundary, and a word that drifts out of the due window is
 * a word that quietly stops being practised.
 */

const toUTC = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`Not an ISO date: "${iso}"`);
  }
  return Date.UTC(y, m - 1, d);
};

const fromUTC = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

const DAY_MS = 86_400_000;

export function addDays(iso: string, days: number): string {
  return fromUTC(toUTC(iso) + days * DAY_MS);
}

/** Positive when `to` is later than `from`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

/** Today in the *local* zone, rendered as an ISO date — the day the user is living in. */
export function todayISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
