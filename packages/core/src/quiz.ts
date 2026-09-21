import type { Direction, Question, Rng, Word } from './types.ts';
import { answersInGloss, gloss, type GlossLanguage } from './language.ts';
import { shuffle } from './rng.ts';

const OPTIONS_PER_QUESTION = 4;

const solve = (w: Word, d: Direction, g: GlossLanguage): string =>
  answersInGloss(d) ? gloss(w, g) : w.es;

const show = (w: Word, d: Direction, g: GlossLanguage): string => {
  if (d === 'picture->es') return '';        // the art is the prompt
  return d === 'en->es' ? gloss(w, g) : w.es;
};

/** Which side of a question is read aloud. The screen maps 'gloss' to the gloss voice. */
export type Spoken = 'es' | 'gloss';

/** What is spoken when the question appears. A picture says nothing: the art is the question. */
export const promptSpoken = (d: Direction): Spoken | null =>
  d === 'picture->es' ? null : d === 'es->en' ? 'es' : 'gloss';

/** What is spoken when an option is tapped. */
export const optionSpoken = (d: Direction): Spoken =>
  answersInGloss(d) ? 'gloss' : 'es';

/**
 * Decide how each word is asked: roughly 50% recognition, 40% production,
 * 10% picture. Listening-only questions were dropped: every prompt is now
 * both shown and spoken, which makes a listen-only type redundant.
 *
 * Picture questions need art, so they are allocated first and only to words
 * that have it; a word without art falls through to the next type rather than
 * losing its slot.
 */
function planDirections(words: readonly Word[], rng: Rng): Direction[] {
  const n = words.length;
  const wantPicture = Math.round(n * 0.1);
  const wantProduce = Math.round(n * 0.4);

  const plan: Direction[] = new Array(n).fill('es->en');
  let pictures = 0;
  let produces = 0;

  for (const i of shuffle(words.map((_, idx) => idx), rng)) {
    const w = words[i]!;
    if (pictures < wantPicture && w.sprite) {
      plan[i] = 'picture->es';
      pictures += 1;
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
  glossLang: GlossLanguage = 'en',
): Question[] {
  const directions = planDirections(selected, rng);

  return selected.map((word, i) => {
    const direction = directions[i]!;
    const answer = solve(word, direction, glossLang);

    const candidates = shuffle(
      pool.filter((w) => w.id !== word.id && solve(w, direction, glossLang) !== answer),
      rng,
    );
    const samePos = candidates.filter((w) => w.pos === word.pos);
    const rest = candidates.filter((w) => w.pos !== word.pos);

    const distractors: string[] = [];
    const taken = new Set<string>([answer]);
    for (const w of [...samePos, ...rest]) {
      if (distractors.length >= OPTIONS_PER_QUESTION - 1) break;
      const text = solve(w, direction, glossLang);
      if (taken.has(text)) continue;
      taken.add(text);
      distractors.push(text);
    }

    return {
      word,
      direction,
      prompt: show(word, direction, glossLang),
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
  glossLang: GlossLanguage = 'en',
): string | null {
  for (const w of pool) {
    if (solve(w, direction, glossLang) === option) {
      return answersInGloss(direction) ? w.es : gloss(w, glossLang);
    }
  }
  return null;
}

export function grade(given: string, answer: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  return norm(given) === norm(answer);
}
