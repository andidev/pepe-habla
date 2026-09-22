/**
 * When the morning reminder fires, and when it does not.
 *
 * Every decision the notification makes lives here as a pure function, so the
 * feature is tested by `node --test` rather than by watching a phone at 08:00.
 * The app layer is left with nothing but the queueing.
 *
 * Nothing here constructs a Date. `today` and `nowMinutes` come in as
 * parameters, which is what lets a test pin a morning down to the minute.
 */
import { addDays, daysBetween } from './dates.ts';
import type { Streak } from './streak.ts';

export interface ReminderSettings {
  enabled: boolean;
  /** Local wall-clock hour, 0-23. */
  hour: number;
  /** 0 or 30. */
  minute: number;
}

/**
 * The pills on the settings screen: every half hour of the morning.
 *
 * A fixed list rather than a free time picker because every answer in this app
 * is a tap and never a keyboard, and because a reminder outside the morning is
 * a different feature.
 */
export const REMINDER_TIMES: readonly { hour: number; minute: number }[] = [
  { hour: 5, minute: 0 }, { hour: 5, minute: 30 },
  { hour: 6, minute: 0 }, { hour: 6, minute: 30 },
  { hour: 7, minute: 0 }, { hour: 7, minute: 30 },
  { hour: 8, minute: 0 }, { hour: 8, minute: 30 },
  { hour: 9, minute: 0 }, { hour: 9, minute: 30 },
  { hour: 10, minute: 0 },
];

/**
 * Off, and at 08:00 when it is switched on.
 *
 * Off is deliberate: turning the switch on is what asks the operating system
 * for permission, and that is the only moment the learner has said they want
 * this. Asking at first launch is how a child taps "Don't allow" and burns the
 * grant permanently, because iOS never asks a second time.
 */
export const defaultReminderSettings = (): ReminderSettings =>
  ({ enabled: false, hour: 8, minute: 0 });

/**
 * Days scanned ahead. A week of not opening the app -- the learner who most
 * needs reminding -- and far under the 64 pending notifications iOS allows.
 *
 * Days *scanned*, not mornings queued: a skipped today leaves six.
 */
export const REMINDER_HORIZON = 7;

export const reminderTimeLabel = (t: { hour: number; minute: number }): string =>
  `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;

/**
 * The mornings worth waking someone for.
 *
 * A repeating daily trigger cannot be suppressed -- the operating system fires
 * it whatever the app knows -- so the app queues one-off notifications and
 * re-queues them whenever it learns something. These are the slots.
 */
export function reminderSlots(input: {
  settings: ReminderSettings;
  streak: Streak;
  today: string;
  /** Local `hour * 60 + minute`. */
  nowMinutes: number;
  horizon?: number;
}): { date: string; hour: number; minute: number }[] {
  const { settings, streak, today, nowMinutes, horizon = REMINDER_HORIZON } = input;
  if (!settings.enabled) return [];

  const at = settings.hour * 60 + settings.minute;
  const slots: { date: string; hour: number; minute: number }[] = [];

  for (let i = 0; i < horizon; i += 1) {
    const date = addDays(today, i);
    // The day's round is already done. This is the whole point of one-off
    // notifications: a reminder that arrives after the round teaches the
    // learner that the app does not know what they have done.
    if (streak.lastDate === date) continue;
    // Today's morning has been and gone.
    if (i === 0 && at <= nowMinutes) continue;
    slots.push({ date, hour: settings.hour, minute: settings.minute });
  }

  return slots;
}

/**
 * What the body says, as data rather than a string.
 *
 * The app turns this into one of three languages; core stays out of copy.
 */
export type ReminderTone =
  | { kind: 'streak'; due: number; streak: number }
  | { kind: 'due'; due: number }
  | { kind: 'streakOnly'; streak: number }
  | { kind: 'fresh' };

/**
 * A streak may only be promised on the morning it is still winnable.
 *
 * This falls out of `daysBetween` rather than being special-cased: on the
 * morning after a missed day the gap is already 2, and the streak really is
 * broken. Promising a learner a streak they have lost is the one thing that
 * would make the number worthless.
 */
export function reminderTone(due: number, streak: Streak, date: string): ReminderTone {
  const alive = streak.days > 0
    && streak.lastDate !== null
    && daysBetween(streak.lastDate, date) <= 1;

  if (due > 0) {
    return alive ? { kind: 'streak', due, streak: streak.days } : { kind: 'due', due };
  }
  return alive ? { kind: 'streakOnly', streak: streak.days } : { kind: 'fresh' };
}
