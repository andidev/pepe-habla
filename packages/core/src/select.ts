import type { Progress, Rng, Word } from './types.ts';
import { isDue } from './leitner.ts';
import { shuffle } from './rng.ts';

/**
 * Choose the words to practise today.
 *
 * Due work comes first, weakest box first, most overdue first within a box —
 * so the words you keep getting wrong keep coming back. Only once the due pile
 * is exhausted do we introduce new words, lowest tier first. Ties are broken
 * randomly so sessions don't fossilise into the same order every day.
 */
export function selectDaily(
  words: readonly Word[],
  progress: Readonly<Record<string, Progress>>,
  today: string,
  count: number,
  rng: Rng,
): Word[] {
  const byId = new Map(words.map((w) => [w.id, w]));

  const due = shuffle(
    Object.values(progress).filter((p) => byId.has(p.id) && isDue(p, today)),
    rng,
  ).sort((a, b) => a.box - b.box || a.dueOn.localeCompare(b.dueOn));

  const picked: Word[] = [];
  for (const p of due) {
    if (picked.length >= count) break;
    picked.push(byId.get(p.id)!);
  }

  if (picked.length < count) {
    const unseen = shuffle(
      words.filter((w) => progress[w.id] === undefined),
      rng,
    ).sort((a, b) => a.tier - b.tier);
    for (const w of unseen) {
      if (picked.length >= count) break;
      picked.push(w);
    }
  }

  return picked;
}
