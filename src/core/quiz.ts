import type { Direction, Question, Rng, Word } from './types.ts';
import { shuffle } from './rng.ts';

const OPTIONS_PER_QUESTION = 4;

const show = (w: Word, d: Direction): string => (d === 'es->en' ? w.es : w.en);
const solve = (w: Word, d: Direction): string => (d === 'es->en' ? w.en : w.es);

/** Half the questions each way, in a shuffled order. */
function directionsFor(n: number, rng: Rng): Direction[] {
  const dirs: Direction[] = Array.from({ length: n }, (_, i) =>
    i % 2 === 0 ? 'es->en' : 'en->es',
  );
  return shuffle(dirs, rng);
}

/**
 * Build multiple-choice questions.
 *
 * Distractors are drawn from the learner's own vocabulary and prefer the same
 * part of speech, so a noun question doesn't give itself away by being the only
 * noun on offer. If there aren't enough same-part-of-speech candidates we widen
 * rather than repeat an option — a duplicated option would make the question
 * unanswerable.
 */
export function buildQuestions(
  selected: readonly Word[],
  pool: readonly Word[],
  rng: Rng,
): Question[] {
  const directions = directionsFor(selected.length, rng);

  return selected.map((word, i) => {
    const direction = directions[i]!;
    const answer = solve(word, direction);

    const candidates = shuffle(
      pool.filter((w) => w.id !== word.id && solve(w, direction) !== answer),
      rng,
    );
    const samePos = candidates.filter((w) => w.pos === word.pos);
    const rest = candidates.filter((w) => w.pos !== word.pos);

    const distractors: string[] = [];
    const taken = new Set<string>([answer]);
    for (const w of [...samePos, ...rest]) {
      if (distractors.length >= OPTIONS_PER_QUESTION - 1) break;
      const text = solve(w, direction);
      if (taken.has(text)) continue;
      taken.add(text);
      distractors.push(text);
    }

    return {
      word,
      direction,
      prompt: show(word, direction),
      options: shuffle([answer, ...distractors], rng),
      answer,
    };
  });
}

export function grade(given: string, answer: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  return norm(given) === norm(answer);
}
