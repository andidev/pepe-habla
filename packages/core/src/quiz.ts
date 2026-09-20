import type { Direction, Question, Rng, Word } from './types.ts';
import { shuffle } from './rng.ts';

const OPTIONS_PER_QUESTION = 4;

/** Which language the learner answers in. */
const answersInEnglish = (d: Direction): boolean =>
  d === 'es->en' || d === 'listen->en';

const solve = (w: Word, d: Direction): string =>
  answersInEnglish(d) ? w.en : w.es;

const show = (w: Word, d: Direction): string => {
  if (d === 'picture->es') return '';        // the art is the prompt
  return d === 'en->es' ? w.en : w.es;       // listen->en carries the Spanish to speak
};

/**
 * Decide how each word is asked: roughly 40% recognition, 30% production,
 * 20% listening, 10% picture.
 *
 * Picture questions need art, so they are allocated first and only to words
 * that have it; a word without art falls through to the next type rather than
 * losing its slot.
 */
function planDirections(words: readonly Word[], rng: Rng): Direction[] {
  const n = words.length;
  const wantPicture = Math.round(n * 0.1);
  const wantListen = Math.round(n * 0.2);
  const wantProduce = Math.round(n * 0.3);

  const plan: Direction[] = new Array(n).fill('es->en');
  let pictures = 0;
  let listens = 0;
  let produces = 0;

  for (const i of shuffle(words.map((_, idx) => idx), rng)) {
    const w = words[i]!;
    if (pictures < wantPicture && w.sprite) {
      plan[i] = 'picture->es';
      pictures += 1;
    } else if (listens < wantListen) {
      plan[i] = 'listen->en';
      listens += 1;
    } else if (produces < wantProduce) {
      plan[i] = 'en->es';
      produces += 1;
    }
  }
  return plan;
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
  const directions = planDirections(selected, rng);

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
      promptImage: direction === 'picture->es' ? word.sprite : undefined,
      options: shuffle([answer, ...distractors], rng),
      answer,
    };
  });
}

/**
 * What the tapped option actually meant.
 *
 * A wrong answer is a chance to learn two words rather than none: the correct
 * one, and the one you reached for instead. Every distractor is a real word
 * from the learner's own vocabulary, so the gloss is already available.
 */
export function optionMeaning(
  direction: Direction,
  option: string,
  pool: readonly Word[],
): string | null {
  for (const w of pool) {
    if (solve(w, direction) === option) {
      return answersInEnglish(direction) ? w.es : w.en;
    }
  }
  return null;
}

export function grade(given: string, answer: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  return norm(given) === norm(answer);
}
