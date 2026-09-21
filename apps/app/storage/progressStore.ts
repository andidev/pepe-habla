import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyAnswer, freshProgress, type Progress, type VocabDb } from '@pepe/core';
import type { AnswerRecord } from '@pepe/core';
import seededProgress from '../../../data/vocab.json';

const KEY = 'pepe-habla/progress/v1';

/** Progress saved before direction counters existed gets them, at zero. */
function migrate(db: VocabDb): VocabDb {
  const progress: Record<string, Progress> = {};
  for (const [id, p] of Object.entries(db.progress)) {
    progress[id] = {
      ...p,
      rightEsToEn: p.rightEsToEn ?? 0,
      rightEnToEs: p.rightEnToEs ?? 0,
      // Deliberately null for words already known before this migration: we do
      // not know when they were learned, and guessing would inflate the
      // "this week" figure on the very first launch after upgrading.
      knownOn: p.knownOn ?? null,
    };
  }
  return { ...db, progress };
}

/**
 * Progress lives on the phone. The repo's data/vocab.json seeds the very first
 * launch so the words already practised on the CLI are not thrown away; after
 * that the phone is the only source of truth.
 */
export async function loadProgress(): Promise<VocabDb> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw !== null) {
    try {
      return migrate(JSON.parse(raw) as VocabDb);
    } catch {
      // Keep whatever we could not parse. Silently discarding months of
      // practice is worse than any error we could show.
      void AsyncStorage.setItem(`${KEY}/corrupt/${Date.now()}`, raw);
      // The bundled seed predates the direction counters, so its shape does
      // not satisfy VocabDb until migrate() fills them in.
      return migrate(seededProgress as unknown as VocabDb);
    }
  }
  return migrate(seededProgress as unknown as VocabDb);
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
    progress[record.wordId] = applyAnswer(before, record.correct, today, record.direction);
  }
  return { ...db, progress };
}
