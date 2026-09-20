import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyStreak, type Streak } from '@pepe/core';

const KEY = 'pepe-habla/streak/v1';

export async function loadStreak(): Promise<Streak> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw === null) return emptyStreak();
  try {
    return JSON.parse(raw) as Streak;
  } catch {
    return emptyStreak();
  }
}

export async function saveStreak(streak: Streak): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(streak));
}
