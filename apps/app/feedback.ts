import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { RECORDINGS } from './storage/speech';

export type CueName = 'tap' | 'correct' | 'wrong' | 'complete' | 'streak' | 'levelup';

/**
 * Every piece of feedback that is not on the screen.
 *
 * Sound and haptics always fire together: the haptic does most of the work on
 * how an answer feels, and it still works with the phone on silent, so muting
 * audio must not mute touch.
 */
const SOURCES: Record<CueName, number> = {
  tap: require('./assets/audio/tap.wav'),
  correct: require('./assets/audio/correct.wav'),
  wrong: require('./assets/audio/wrong.wav'),
  complete: require('./assets/audio/complete.wav'),
  streak: require('./assets/audio/streak.wav'),
  levelup: require('./assets/audio/levelup.wav'),
};

const HAPTIC: Record<CueName, () => void> = {
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  correct: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  wrong: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  complete: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  streak: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  levelup: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
};

let players: Partial<Record<CueName, AudioPlayer>> = {};
let muted = false;

/**
 * Every device API here is optional. On the web, haptics fall back to the
 * Vibration API or nothing at all, and audio support is less mature than on
 * the phones. None of that is worth crashing a practice session over, so every
 * call is wrapped. This file is one of only two allowed to know it is running
 * somewhere unusual; if the web ever needs genuinely different behaviour, it
 * gets a `feedback.web.ts` sibling and no screen changes.
 */
function attempt(action: () => unknown): void {
  try {
    const result = action();
    if (result instanceof Promise) result.catch(() => {});
  } catch {
    // Feedback is never worth interrupting practice for.
  }
}

/**
 * Play through the silent switch, and do not stop the user's music for a 0.4s
 * chime. Called once at startup.
 */
export async function prepareAudio(): Promise<void> {
  attempt(() => setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: 'mixWithOthers',
  }));
  for (const name of Object.keys(SOURCES) as CueName[]) {
    attempt(() => { players[name] = createAudioPlayer(SOURCES[name]); });
  }
}

export function cue(name: CueName): void {
  attempt(HAPTIC[name]);                 // haptics ignore the mute switch
  if (muted) return;
  const player = players[name];
  if (!player) return;
  attempt(() => player.seekTo(0).then(() => player.play()));
}

/**
 * Pronunciation, best source first.
 *
 * 1. A bundled recording — identical on every device, offline.
 * 2. Device speech with an explicitly chosen Mexican voice.
 * 3. The nearest Spanish voice the device has.
 * 4. Silence.
 *
 * Step 4 is deliberate: a device with no Spanish voice will happily read
 * Spanish with an English mouth, and teaching a wrong pronunciation is worse
 * than teaching none.
 */
let spanishVoice: string | null = null;
let voicesChecked = false;
let wordPlayer: AudioPlayer | null = null;

function rankVoice(v: { language: string; identifier: string }): number {
  const lang = v.language.toLowerCase().replace('_', '-');
  if (lang.startsWith('es-mx')) return 100;
  if (lang.startsWith('es-419') || /^es-(ar|co|cl|pe|us)/.test(lang)) return 60;
  if (lang.startsWith('es')) return 30;
  return 0;
}

/** Called once at startup, after prepareAudio. */
export async function prepareSpeech(): Promise<void> {
  try {
    const all = await Speech.getAvailableVoicesAsync();
    const best = all
      .map((v) => ({ v, score: rankVoice(v) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)[0];
    spanishVoice = best ? best.v.identifier : null;
  } catch {
    spanishVoice = null;
  } finally {
    voicesChecked = true;
  }
}

/** False when this device can neither play a recording nor speak Spanish. */
export function canSpeak(word?: { id: string }): boolean {
  if (word && RECORDINGS[word.id] !== undefined) return true;
  return !voicesChecked || spanishVoice !== null;
}

export function speak(word: { id: string; es: string }): void {
  if (muted) return;

  const recording = RECORDINGS[word.id];
  if (recording !== undefined) {
    attempt(() => {
      if (wordPlayer === null) {
        wordPlayer = createAudioPlayer(recording);
      } else {
        wordPlayer.replace(recording);      // one player for all 384 words
      }
      return wordPlayer.seekTo(0).then(() => wordPlayer?.play());
    });
    return;
  }

  if (voicesChecked && spanishVoice === null) return;   // never an English mouth
  attempt(() => Speech.stop().then(() => Speech.speak(word.es, {
    language: 'es-MX',
    rate: 0.95,
    pitch: 1.0,
    ...(spanishVoice ? { voice: spanishVoice } : {}),
  })));
}

export function stopSpeaking(): void {
  attempt(() => Speech.stop());
}

export function setMuted(next: boolean): void {
  muted = next;
  if (next) attempt(() => Speech.stop());
}

export function isMuted(): boolean {
  return muted;
}
