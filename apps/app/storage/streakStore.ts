import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyStreak, type Streak } from '@pepe/core';

const KEY = 'pepe-habla/streak/v1';

export async function loadStreak(): Promise<Streak> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw === null) return emptyStreak();
  try {
    return JSON.parse(raw) as Streak;
  } catch {
    // Keep whatever we could not parse. Silently discarding months of
    // practice is worse than any error we could show.
    void AsyncStorage.setItem(`${KEY}/corrupt/${Date.now()}`, raw);
    return emptyStreak();
  }
}

export async function saveStreak(streak: Streak): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(streak));
}
