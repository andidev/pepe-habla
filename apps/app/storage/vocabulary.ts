import type { Word } from '@pepe/core';
import words1 from '../../../data/seed/words-1.json';
import words2 from '../../../data/seed/words-2.json';
import words3 from '../../../data/seed/words-3.json';
import manifest from '../assets/pepe/manifest.json';

/**
 * The word list, bundled at build time, with Pepe's art attached.
 *
 * Words come from the repo rather than the network: the app is offline, and
 * the list only changes when a new build ships anyway.
 */
const SEED = [...words1, ...words2, ...words3] as Word[];

export const WORDS: Word[] = SEED.map((w) => {
  const sprite = (manifest.vocab as Record<string, string>)[w.id];
  return sprite ? { ...w, sprite } : w;
});

/**
 * Metro needs every asset path as a literal `require`, so the manifest cannot
 * be used to build paths dynamically. Poses are listed explicitly here; word
 * art is looked up by the filename the manifest gave it.
 */
export const POSES = {
  idle: require('../assets/pepe/pepe-idle.png'),
  happy: require('../assets/pepe/pepe-happy.png'),
  sad: require('../assets/pepe/pepe-sad.png'),
  excited: require('../assets/pepe/pepe-excited.png'),
  sleeping: require('../assets/pepe/pepe-sleeping.png'),
  hero: require('../assets/pepe/pepe-hero.png'),
} as const;

export type PoseName = keyof typeof POSES;

export const VOCAB_ART: Record<string, number> = {
  'vocab-el-taco.png': require('../assets/pepe/vocab-el-taco.png'),
  'vocab-la-guitarra.png': require('../assets/pepe/vocab-la-guitarra.png'),
  'vocab-cocinar.png': require('../assets/pepe/vocab-cocinar.png'),
  'vocab-el-sombrero.png': require('../assets/pepe/vocab-el-sombrero.png'),
};

export const PEPE_PHOTO = require('../assets/photo/pepe-real.jpg');
