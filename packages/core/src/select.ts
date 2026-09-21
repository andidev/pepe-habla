import type { Progress, Rng, Word } from './types.ts';
import { isDue } from './progress.ts';
import { unlockedThrough } from './unlock.ts';
import type { Track } from './levels.ts';
import { shuffle } from './rng.ts';

/**
 * Choose the cards to practise today, from one track.
 *
 * Due work comes first, shortest streak first, most overdue first within a
 * streak -- so the cards you keep getting wrong keep coming back. Only once the
 * due pile is exhausted do we introduce new ones, lowest level first, and only
 * from levels that are open. Ties are broken randomly so sessions don't
 * fossilise into the same order every day.
 *
 * The track is required rather than optional: a caller that forgot it would
 * silently mix words and grammar into one round, which is the one thing the
 * spec puts out of scope.
 *
 * Due work ignores the level gate. A card the learner has already met must
 * keep coming back even if its level later reads as shut -- locking a level
 * decides what is *introduced*, never what is stranded.
 */
export function selectDaily(
  words: readonly Word[],
  progress: Readonly<Record<string, Progress>>,
  today: string,
  count: number,
  rng: Rng,
  track: Track,
): Word[] {
  const mine = words.filter((w) => w.track === track);
  const byId = new Map(mine.map((w) => [w.id, w]));

  const due = shuffle(
    Object.values(progress).filter((p) => byId.has(p.id) && isDue(p, today)),
    rng,
  ).sort((a, b) => a.reps - b.reps || a.dueOn.localeCompare(b.dueOn));

  const picked: Word[] = [];
  for (const p of due) {
    if (picked.length >= count) break;
    picked.push(byId.get(p.id)!);
  }
  if (picked.length >= count) return picked;

  const open = unlockedThrough(words, progress, track);
  const fresh = shuffle(
    mine.filter((w) => progress[w.id] === undefined && w.level <= open),
    rng,
  ).sort((a, b) => a.level - b.level);

  picked.push(...cluster(fresh, count - picked.length));
  return picked;
}

/**
 * Take `want` new cards, preferring a single theme.
 *
 * New words land far better as a set -- eight words about food are eight hooks
 * into one scene, where eight unrelated words are eight separate problems. The
 * theme is chosen from the lowest level that still has unseen cards, so this
 * never reorders the ladder. From their second exposure on, they interleave
 * with everything else like any other card.
 *
 * If the chosen theme cannot fill the round we widen rather than come up short:
 * a half-empty round is worse than a mixed one.
 */
function cluster(fresh: readonly Word[], want: number): Word[] {
  if (want <= 0 || fresh.length === 0) return [];

  const theme = fresh[0]!.themes[0];
  if (theme === undefined) return fresh.slice(0, want);

  const sameTheme = fresh.filter((w) => w.themes.includes(theme));
  const rest = fresh.filter((w) => !w.themes.includes(theme));
  return [...sameTheme, ...rest].slice(0, want);
}
