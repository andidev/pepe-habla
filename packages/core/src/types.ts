/**
 * Shared data shapes. Pure types only — no runtime code, no I/O.
 */

import type { Track } from './levels.ts';

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'phrase'
  | 'other';

/** A vocabulary item. Static content — never mutated by practice. */
export interface Word {
  /** Stable slug, e.g. "el-abrigo". Used as the key into Progress. */
  id: string;
  /** Spanish, including the article for nouns: "el abrigo". */
  es: string;
  /** English: "the coat". */
  en: string;
  /** Swedish: "boken". Required — a missing gloss must fail the build, not the round. */
  sv: string;
  pos: PartOfSpeech;
  /** Which ladder this card belongs to. Required: a card with no track would silently never appear. */
  track: Track;
  /** 1-based level within that track. Lower levels are introduced first. */
  level: number;
  /**
   * Tags that cut across the levels. At least one on every words card; a
   * grammar card carries its tense or pattern. They gate nothing.
   */
  themes: readonly string[];
  /** Asset key for Pepe art illustrating this word, when it exists. */
  sprite?: string;
  /** Usage note, e.g. where Mexico differs from Spain. */
  note?: string;
}

/** What we know about how well a word is known. This is the part that changes. */
export interface Progress {
  /** Stable slug, the same one as the word's. */
  id: string;
  /** Consecutive correct first taps. Back to zero after a miss. */
  reps: number;
  /** SM-2 ease factor, 1.3 to 3.0: how fast the interval grows. */
  ease: number;
  /** Days from the last answer to the next due date. 0 until first answered. */
  interval: number;
  seen: number;
  right: number;
  wrong: number;
  /** Correct answers where the learner read Spanish and chose the gloss. */
  rightEsToEn: number;
  /** Correct answers where the learner produced the Spanish. */
  rightEnToEs: number;
  /** ISO date this word first counted as known, or null if it never has. */
  knownOn: string | null;
  /** ISO date (YYYY-MM-DD) the word was last asked, or null if never. */
  lastSeen: string | null;
  /** ISO date the word is next due. */
  dueOn: string;
}

/** The persisted brain: progress only. Words live in the seed files. */
export interface VocabDb {
  version: 1;
  progress: Record<string, Progress>;
}

/**
 * Which way a question is asked. "en" means the gloss language, which is
 * Swedish or English depending on the app language; the names predate that
 * and are kept because stored counters (rightEsToEn, rightEnToEs) use them.
 */
export type Direction = 'es->en' | 'en->es' | 'picture->es';

export interface Question {
  word: Word;
  direction: Direction;
  /** What to show as the prompt. */
  prompt: string;
  /** Asset key to show instead of text, for picture questions. */
  promptImage?: string;
  /** Four options, shuffled. Exactly one equals `answer`. */
  options: string[];
  answer: string;
}

/** Injected randomness, so core stays pure and tests stay deterministic. */
export type Rng = () => number;
