import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultReminderSettings, REMINDER_TIMES, type ReminderSettings } from '@pepe/core';

const KEY = 'pepe-habla/reminder/v1';

/**
 * When Pepe should call, and whether he should at all.
 *
 * A stored time that is not one of the pills is thrown away rather than
 * honoured: the settings screen could not show it, so the learner would have
 * no way to change a reminder that kept firing.
 */
export async function loadReminderSettings(): Promise<ReminderSettings> {
  const fallback = defaultReminderSettings();
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw === null) return fallback;
    const stored = JSON.parse(raw) as Partial<ReminderSettings>;
    const known = REMINDER_TIMES.some(
      (t) => t.hour === stored.hour && t.minute === stored.minute,
    );
    return {
      enabled: stored.enabled === true,
      hour: known ? stored.hour! : fallback.hour,
      minute: known ? stored.minute! : fallback.minute,
    };
  } catch {
    return fallback;
  }
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // A preference that fails to persist is not worth interrupting practice
    // for; the learner sets it again next launch.
  }
}
