import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { AppState } from 'react-native';

const MUTE_KEY = 'pepe-habla/muted/v1';
const EFFECTS_KEY = 'pepe-habla/effects/v1';

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

let muted = false;
/**
 * Sound effects and haptics, separately from the voice. A learner who hates
 * being buzzed at for a mistake would otherwise mute everything, and lose the
 * pronunciation along with the judgement.
 */
let effects = true;

export function cue(name: CueName): void {
  // Spec §2's table: the effects switch only silences touch while there is
  // sound to silence it from. With Sound off, effects is hidden and haptics
  // must still fire, so effects alone must not skip the haptic below.
  if (!effects && !muted) return;
  attempt(HAPTIC[name]);                 // haptics ignore the mute switch
  if (muted) return;
  const player = players[name];
  if (!player) return;
  attempt(() => player.seekTo(0).then(() => player.play()));
}

/**
 * Pronunciation, in three languages.
 *
 * Spanish is always Spanish; Swedish and English read the glosses. For each,
 * the best device voice for that language, or silence. Silence is deliberate:
 * a device with no Swedish voice would read Swedish with an English mouth, and
 * teaching a wrong pronunciation is worse than teaching none.
 */
export type Voice = 'es' | 'sv' | 'en';

const LOCALE: Record<Voice, string> = { es: 'es-MX', sv: 'sv-SE', en: 'en-US' };

function rankVoice(want: Voice, v: { language: string; quality?: string }): number {
  const lang = v.language.toLowerCase().replace('_', '-');
  let score = 0;
  if (want === 'es') {
    if (lang.startsWith('es-mx')) score = 100;
    else if (lang.startsWith('es-419') || /^es-(ar|co|cl|pe|us)/.test(lang)) score = 60;
    else if (lang.startsWith('es')) score = 30;
  } else if (want === 'sv') {
    if (lang.startsWith('sv-se')) score = 100;
    else if (lang.startsWith('sv')) score = 60;
  } else {
    if (lang.startsWith('en-us')) score = 100;
    else if (lang.startsWith('en-gb')) score = 90;
    else if (lang.startsWith('en')) score = 50;
  }
  // Between two voices with the same accent, the enhanced one is far less robotic.
  return score > 0 && v.quality === 'Enhanced' ? score + 5 : score;
}

const voices: Record<Voice, string | null> = { es: null, sv: null, en: null };
let voicesChecked = false;
let speechReady: Promise<void> | null = null;

/** Called once at startup, after prepareAudio. */
export function prepareSpeech(): Promise<void> {
  speechReady = (async () => {
    try {
      const all = await Speech.getAvailableVoicesAsync();
      for (const want of Object.keys(voices) as Voice[]) {
        const best = all
          .map((v) => ({ v, score: rankVoice(want, v) }))
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)[0];
        voices[want] = best ? best.v.identifier : null;
      }
    } catch {
      for (const want of Object.keys(voices) as Voice[]) voices[want] = null;
    } finally {
      voicesChecked = true;
    }
  })();
  return speechReady;
}

/** False when this device has no voice for the language. */
export function canSpeak(voice: Voice = 'es'): boolean {
  return voicesChecked && voices[voice] !== null;
}

/** Resolves the utterance in flight, if any. Only one voice speaks at a time. */
let finishCurrent: (() => void) | null = null;

/**
 * Speak, and say when you are done.
 *
 * The answer loop chains on this — word first, then the right/wrong cue — so
 * it must always resolve: on done, on stop, on error, when another `say`
 * replaces it, and after a guard timeout in case the platform never calls back.
 */
export function say(text: string, voice: Voice): Promise<void> {
  finishCurrent?.();
  // A new tap silences the old one even when this call has nothing to say.
  // finishCurrent() only resolves the previous promise; Speech.stop() is the
  // only thing that reaches the platform. Without this, a muted app -- or a
  // phone with no voice for this language -- leaves the last word running
  // underneath the next one.
  if (muted || text.length === 0) {
    attempt(() => Speech.stop());
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      if (finishCurrent === finish) finishCurrent = null;
      resolve();
    };
    const guard = setTimeout(finish, 1500 + 80 * text.length);
    finishCurrent = finish;

    (speechReady ?? Promise.resolve())
      .then(async () => {
        if (done) return;
        await Speech.stop();                        // stop first, speak second
        if (done) return;
        const id = voices[voice];
        if (id === null) { finish(); return; }      // no voice: silence
        Speech.speak(text, {
          language: LOCALE[voice],
          voice: id,
          rate: 0.95,
          pitch: 1.0,
          onDone: finish,
          onStopped: finish,
          onError: finish,
        });
      })
      .catch(finish);
  });
}

/** Fire-and-forget Spanish, for the word list. */
export function speak(word: { es: string }): void {
  void say(word.es, 'es');
}

export function stopSpeaking(): void {
  finishCurrent?.();
  attempt(() => Speech.stop());
}

export function setMuted(next: boolean): void {
  muted = next;
  if (next) stopSpeaking();
}

export function isMuted(): boolean {
  return muted;
}

export function effectsOn(): boolean {
  return effects;
}

/** Called once at startup, before the first cue. */
export async function loadSoundSettings(): Promise<void> {
  try {
    const [m, e] = await Promise.all([
      AsyncStorage.getItem(MUTE_KEY),
      AsyncStorage.getItem(EFFECTS_KEY),
    ]);
    muted = m === 'true';
    effects = e !== 'false';
  } catch {
    muted = false;
    effects = true;
  }
}

export async function saveMuted(next: boolean): Promise<void> {
  setMuted(next);
  try {
    await AsyncStorage.setItem(MUTE_KEY, String(next));
  } catch {
    // A preference that fails to save is not worth interrupting practice for.
  }
}

export async function saveEffects(next: boolean): Promise<void> {
  effects = next;
  try {
    await AsyncStorage.setItem(EFFECTS_KEY, String(next));
  } catch {
    // As above.
  }
}

/**
 * Call `fn` whenever the app leaves the foreground, and return the
 * unsubscribe.
 *
 * A screen with something to save before the learner switches away gets it
 * through this, and uses the return value straight as an effect cleanup, so no
 * screen has to import `AppState` and know it is running on a device.
 */
export function onBackgrounded(fn: () => void): () => void {
  const sub = AppState.addEventListener('change', (next) => {
    if (next !== 'active') fn();
  });
  return () => sub.remove();
}
