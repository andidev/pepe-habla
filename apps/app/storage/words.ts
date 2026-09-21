import type { Word } from '@pepe/core';
import words1 from '../../../data/seed/words-1.json' with { type: 'json' };
import words2 from '../../../data/seed/words-2.json' with { type: 'json' };
import words3 from '../../../data/seed/words-3.json' with { type: 'json' };
import words4 from '../../../data/seed/words-4.json' with { type: 'json' };
import words5 from '../../../data/seed/words-5.json' with { type: 'json' };
import words6 from '../../../data/seed/words-6.json' with { type: 'json' };
import words7 from '../../../data/seed/words-7.json' with { type: 'json' };
import grammar1 from '../../../data/seed/grammar-1.json' with { type: 'json' };
import manifest from '../assets/pepe/manifest.json' with { type: 'json' };

/**
 * The word list, bundled at build time, with Pepe's art attached.
 *
 * Words come from the repo rather than the network: the app is offline, and
 * the list only changes when a new build ships anyway.
 *
 * This lives apart from vocabulary.ts, which also exports Metro-only
 * `require()`'d image assets: those calls only work under Metro's bundler, so
 * a module that runs them can never be imported directly by a Node test. This
 * module touches nothing but JSON, so the seed validator can import it to
 * confirm every seed file actually reaches the app.
 */
const SEED = [
  ...words1,
  ...words2,
  ...words3,
  ...words4,
  ...words5,
  ...words6,
  ...words7,
  ...grammar1,
] as Word[];

export const WORDS: Word[] = SEED.map((w) => {
  const sprite = (manifest.vocab as Record<string, string>)[w.id];
  return sprite ? { ...w, sprite } : w;
});
