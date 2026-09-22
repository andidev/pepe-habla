import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRACKS, type Track } from '@pepe/core';

export const TRACK_KEY = 'pepe-habla/track/v1';

/**
 * Which ladder the learner is climbing right now. Remembered between
 * launches, next to the language and the sound settings, so picking up the
 * phone lands where they left off rather than always on Palabras.
 */
export async function loadTrack(): Promise<Track> {
  try {
    const raw = await AsyncStorage.getItem(TRACK_KEY);
    return TRACKS.includes(raw as Track) ? (raw as Track) : 'words';
  } catch {
    return 'words';
  }
}

export async function saveTrack(track: Track): Promise<void> {
  try {
    await AsyncStorage.setItem(TRACK_KEY, track);
  } catch {
    // A preference that fails to persist is not worth interrupting practice
    // for; the learner picks it again next launch.
  }
}
