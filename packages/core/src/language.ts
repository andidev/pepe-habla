import type { Direction, Word } from './types.ts';

/** The app's interface language. */
export type AppLanguage = 'sv' | 'en' | 'es';

/** The language glosses are shown in. A Spanish interface keeps English glosses. */
export type GlossLanguage = 'sv' | 'en';

export const APP_LANGUAGES: readonly AppLanguage[] = ['sv', 'en', 'es'];

export const isAppLanguage = (v: unknown): v is AppLanguage =>
  typeof v === 'string' && (APP_LANGUAGES as readonly string[]).includes(v);

export const glossLanguage = (l: AppLanguage): GlossLanguage => (l === 'sv' ? 'sv' : 'en');

export const gloss = (w: Word, g: GlossLanguage): string => (g === 'sv' ? w.sv : w.en);

/** First-launch default: a Swedish or Spanish device gets its own language, anything else English. */
export function languageForLocale(tag: string): AppLanguage {
  const code = tag.toLowerCase().split(/[-_]/)[0];
  if (code === 'sv') return 'sv';
  if (code === 'es') return 'es';
  return 'en';
}

/**
 * Whether the learner answers a question of this direction in the gloss
 * language rather than in Spanish.
 *
 * One definition, two callers: quiz.ts builds the options from it, progress.ts
 * decides which direction counter a correct answer advances. They must mean
 * exactly the same thing.
 */
export const answersInGloss = (d: Direction): boolean => d === 'es->en';
