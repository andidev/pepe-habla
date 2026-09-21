/**
 * The two ladders, as data.
 *
 * Words and grammar are separate tracks with separate levels, and climbing one
 * never requires climbing the other -- a learner who only wants vocabulary
 * should not have to clear the subjunctive to reach it, and a learner keen on
 * verbs should not have to grind three levels of nouns first.
 *
 * The level names are Spanish proper nouns in every app language ("Nivel 3 ·
 * Calle"), so they live here rather than in the interface strings. Only the
 * one-line description under each name is translated.
 */

export type Track = 'words' | 'grammar';

export const TRACKS: readonly Track[] = ['words', 'grammar'];

export interface Level {
  /** 1-based, and dense: level N is LADDERS[track][N - 1]. */
  level: number;
  /** The Spanish proper noun shown in every language. */
  name: string;
  /**
   * How many cards this level holds when the content is finished. A budget,
   * not a promise: 3b ships the levels under-filled and 3c fills them, so
   * nothing may treat a short level as a bug.
   */
  cards: number;
}

export const LADDERS: Record<Track, readonly Level[]> = {
  words: [
    { level: 1, name: 'Callejero', cards: 200 },
    { level: 2, name: 'Casa', cards: 250 },
    { level: 3, name: 'Calle', cards: 300 },
    { level: 4, name: 'Mercado', cards: 300 },
    { level: 5, name: 'Trabajo', cards: 350 },
    { level: 6, name: 'Ciudad', cards: 350 },
    { level: 7, name: 'Ideas', cards: 375 },
    { level: 8, name: 'Mexicano', cards: 375 },
  ],
  grammar: [
    { level: 1, name: 'Ahora', cards: 100 },
    { level: 2, name: 'Ayer', cards: 100 },
    { level: 3, name: 'Antes', cards: 100 },
    { level: 4, name: 'Mañana', cards: 100 },
    { level: 5, name: 'Ojalá', cards: 100 },
    { level: 6, name: 'Dichos', cards: 100 },
  ],
};

export const levelsIn = (track: Track): number => LADDERS[track].length;

/** The level's name, or null if that track has no such level. */
export function levelName(track: Track, level: number): string | null {
  return LADDERS[track][level - 1]?.name ?? null;
}

/**
 * Themes cut across the levels and gate nothing. They drive the word list's
 * filter chips and theme-clustered introduction, so that new words arrive as a
 * set rather than eight unrelated strangers.
 */
export const THEMES: readonly string[] = [
  'comida', 'animales', 'casa', 'cuerpo', 'ropa', 'transporte', 'trabajo',
  'dinero', 'salud', 'emociones', 'tiempo', 'naturaleza', 'ciudad', 'escuela',
  'tecnología', 'deporte', 'música', 'familia', 'cocina', 'fiesta', 'viaje',
  'gobierno', 'negocios', 'verbos', 'conectores', 'números', 'saludos', 'slang',
];

/** A grammar card's theme is its tense or pattern. */
export const GRAMMAR_THEMES: readonly string[] = [
  'presente', 'pretérito', 'imperfecto', 'futuro', 'subjuntivo', 'dichos',
];

export function isTheme(track: Track, id: string): boolean {
  return (track === 'grammar' ? GRAMMAR_THEMES : THEMES).includes(id);
}
