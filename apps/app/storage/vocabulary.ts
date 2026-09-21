export { WORDS } from './words';

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
