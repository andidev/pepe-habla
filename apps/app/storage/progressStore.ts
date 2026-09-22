import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyAnswer, freshProgress, isStoredVocabDb, migrateProgress, type VocabDb, type StoredVocabDb } from '@pepe/core';
import type { AnswerRecord } from '@pepe/core';
import seededProgress from '../../../data/vocab.json';

const KEY = 'pepe-habla/progress/v1';

/**
 * Progress lives on the phone. The repo's data/vocab.json seeds the very first
 * launch so the words already practised on the CLI are not thrown away; after
 * that the phone is the only source of truth.
 */
export async function loadProgress(): Promise<VocabDb> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isStoredVocabDb(parsed)) return migrateProgress(parsed);
    } catch {
      // Falls through to the same preservation path as a wrong-shaped blob.
    }
    // Keep whatever we could not read. Silently discarding months of practice
    // is worse than any error we could show. Parsing is not enough: a record
    // whose dueOn is a number parses fine and then throws inside the
    // scheduler, far from here, so a wrong shape is kept rather than trusted.
    void AsyncStorage.setItem(`${KEY}/corrupt/${Date.now()}`, raw);
  }
  // The bundled seed predates the direction counters, so its shape does not
  // satisfy VocabDb until migrateProgress() fills them in.
  return migrateProgress(seededProgress as StoredVocabDb);
}

export async function saveProgress(db: VocabDb): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(db));
}

/**
 * Fold a round's answers into progress.
 *
 * Called at round boundaries rather than per answer: at full vocabulary size
 * the blob is several hundred kilobytes, and rewriting it after every tap
 * would stutter the animations.
 */
export function recordAnswers(
  db: VocabDb,
  records: readonly AnswerRecord[],
  today: string,
): VocabDb {
  const progress = { ...db.progress };
  for (const record of records) {
    const before = progress[record.wordId] ?? freshProgress(record.wordId, today);
    progress[record.wordId] = applyAnswer(before, record, today);
  }
  return { ...db, progress };
}
