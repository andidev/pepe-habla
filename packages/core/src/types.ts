/**
 * Shared data shapes. Pure types only — no runtime code, no I/O.
 */

/** Leitner box. 1 = shaky, 5 = solid. */
export type Box = 1 | 2 | 3 | 4 | 5;

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
  pos: PartOfSpeech;
  /** 1 = end of A1, 2 = A2, 3 = A2+/B1. Lower tiers are introduced first. */
  tier: 1 | 2 | 3;
  /** Asset key for Pepe art illustrating this word, when it exists. */
  sprite?: string;
  /** Usage note, e.g. where Mexico differs from Spain. */
  note?: string;
}

/** What we know about how well a word is known. This is the part that changes. */
export interface Progress {
  id: string;
  box: Box;
  seen: number;
  right: number;
  wrong: number;
  /** Correct answers where the learner read Spanish and chose English. */
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

/** Which way a question is asked. */
export type Direction = 'es->en' | 'en->es' | 'listen->en' | 'picture->es';

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
