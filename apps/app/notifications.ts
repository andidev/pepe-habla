import { AppState, Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { planReminders, todayISO, type AppLanguage, type Reminder, type VocabDb } from '@pepe/core';
import { STRINGS, type Strings } from './i18n/strings';
import { loadLanguage } from './i18n/language';
import { loadProgress } from './storage/progressStore';
import { loadReminderSettings } from './storage/reminderStore';
import { loadStreak } from './storage/streakStore';

/**
 * The morning reminder, and the only file in the app that knows what a device
 * is. Everything it decides was decided in core; what is left here is asking
 * permission and putting things in the operating system's queue.
 *
 * Every call is wrapped. A reminder that fails to schedule is a reminder that
 * does not arrive; it is never a reason to break a practice session. This file
 * is one of three allowed to know it is running somewhere unusual.
 */

const CHANNEL = 'morning';

/** Web has no notification queue worth the name. Everything below no-ops there. */
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

// A reminder that lands while the app is open should still be seen: the learner
// asked to be told, and silently swallowing it looks like a bug.
if (supported) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // An older runtime without the handler still schedules fine.
  }
}

export type PermissionState = 'granted' | 'undetermined' | 'denied' | 'unsupported';

const read = (p: { granted: boolean; canAskAgain: boolean }): PermissionState =>
  p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';

/** What the operating system currently allows. Never prompts. */
export async function permissionState(): Promise<PermissionState> {
  if (!supported) return 'unsupported';
  try {
    return read(await Notifications.getPermissionsAsync());
  } catch {
    return 'unsupported';
  }
}

/**
 * Prompt, once. Called only when the learner turns the switch on, which is the
 * only moment they have said they want this -- iOS never asks twice, so a
 * prompt at launch is how a child's "Don't allow" becomes permanent.
 */
export async function askPermission(): Promise<PermissionState> {
  if (!supported) return 'unsupported';
  try {
    return read(await Notifications.requestPermissionsAsync());
  } catch {
    return 'unsupported';
  }
}

/** The way back for someone who declined. Without it, they are stuck. */
export async function openSystemSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Nothing useful to say if the OS will not open its own settings.
  }
}

/**
 * Watch for the grant changing outside the app.
 *
 * The one route out of the denied state leads through the phone's own
 * settings, and coming back from there neither unmounts nor refocuses the
 * screen -- so without this the learner returns to a card that still says
 * Pepe cannot reach them.
 */
export function watchPermission(onChange: (state: PermissionState) => void): () => void {
  if (!supported) return () => {};
  const sub = AppState.addEventListener('change', (next) => {
    if (next === 'active') void permissionState().then(onChange);
  });
  return () => sub.remove();
}

function body(t: Strings, r: Reminder): string {
  switch (r.tone.kind) {
    case 'streak': return t.notification.streak(r.tone.due, r.tone.streak);
    case 'due': return t.notification.due(r.tone.due);
    case 'streakOnly': return t.notification.streakOnly(r.tone.streak);
    case 'fresh': return t.notification.fresh;
  }
}

let queue: Promise<void> = Promise.resolve();

/**
 * Throw away the queued mornings and work out a new week's worth.
 *
 * Called after a round, after any settings change, and on every foreground.
 * Serialised, because a finished round and a foreground can land in the same
 * tick and two passes would cancel each other's work half-queued.
 *
 * `language` overrides the stored language. `setLanguage` writes to storage
 * without awaiting, so a refresh that reads storage right after can still see
 * the language the learner just left; passing the new one explicitly avoids
 * that race.
 */
export function refreshReminders(language?: AppLanguage): Promise<void> {
  const run = () => rebuild(language);
  queue = queue.then(run, run);
  return queue;
}

async function rebuild(language?: AppLanguage): Promise<void> {
  if (!supported) return;
  try {
    const settings = await loadReminderSettings();

    // This app schedules nothing else, so cancelling everything is both safe
    // and the only way to be sure a stale morning does not survive.
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!settings.enabled) return;
    // A grant revoked in the phone's settings queues nothing, even while our
    // own switch still says on.
    if ((await permissionState()) !== 'granted') return;

    const [db, streak, resolvedLanguage] = await Promise.all([
      loadProgress(), loadStreak(), language ? Promise.resolve(language) : loadLanguage(),
    ]);
    const t = STRINGS[resolvedLanguage];

    // One clock reading for the whole pass, so the date and the minute agree.
    const now = new Date();
    const plan = planReminders({
      settings,
      progress: practiceProgress(db),
      streak,
      today: todayISO(now),
      nowMinutes: now.getHours() * 60 + now.getMinutes(),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Pepe Habla',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    for (const r of plan) {
      const [y, m, d] = r.date.split('-').map(Number);
      // Local wall-clock, which is exactly the day todayISO() means. Any
      // other construction and a reminder fires about yesterday's words.
      const date = new Date(y!, m! - 1, d!, r.hour, r.minute, 0, 0);
      // planReminders works in whole minutes, so a slot can go stale between
      // planning and scheduling -- e.g. today's 08:00 is still "later than
      // now" at 07:59:59.8, but the clock can cross 08:00:00 before this
      // iteration runs. The OS rejects a trigger in the past, so skip it.
      if (date.getTime() <= Date.now()) continue;
      try {
        await Notifications.scheduleNotificationAsync({
          content: { title: t.notification.title, body: body(t, r) },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date,
            channelId: CHANNEL,
          },
        });
      } catch {
        // One rejected morning must not cost the rest of the week: cancelling
        // ran once, up front, so a bad day here should not stop later days
        // from being queued.
      }
    }
  } catch {
    // Queueing is best-effort. Practice is not.
  }
}

/**
 * Start refreshing, and keep refreshing on every foreground. Returns the
 * unsubscribe, so the root layout can use it as an effect cleanup without
 * importing AppState itself.
 */
export function startReminderRefresh(): () => void {
  if (!supported) return () => {};
  void refreshReminders();
  const sub = AppState.addEventListener('change', (next) => {
    if (next === 'active') void refreshReminders();
  });
  return () => sub.remove();
}

/**
 * The progress the count is drawn from.
 *
 * The spec says the selected track's, but phase 3b -- which adds tracks -- has
 * not landed. Until it does there is one ladder, so this is all of it. When
 * 3b merges this becomes a filter and nothing else changes.
 */
const practiceProgress = (db: VocabDb) => Object.values(db.progress);
