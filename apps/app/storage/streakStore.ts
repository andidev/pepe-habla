import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyStreak, isStreak, type Streak } from '@pepe/core';

const KEY = 'pepe-habla/streak/v1';

export async function loadStreak(): Promise<Streak> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw === null) return emptyStreak();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isStreak(parsed)) return parsed;
  } catch {
    // Falls through to the same preservation path as a wrong-shaped blob.
  }
  // Keep whatever we could not read. Silently discarding months of practice is
  // worse than any error we could show. Parsing is not enough: a blob whose
  // lastDate is a number parses fine and then throws inside daysBetween, days
  // later and far from here, so a wrong shape is kept rather than trusted.
  void AsyncStorage.setItem(`${KEY}/corrupt/${Date.now()}`, raw);
  return emptyStreak();
}

export async function saveStreak(streak: Streak): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(streak));
}
