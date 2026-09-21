import { useEffect, useRef, useState } from 'react';
import { useFonts } from 'expo-font';
import {
  Fraunces_800ExtraBold, Fraunces_900Black,
} from '@expo-google-fonts/fraunces';
import { Figtree_600SemiBold, Figtree_800ExtraBold } from '@expo-google-fonts/figtree';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Welcome } from '../components/Welcome';
import { loadSoundSettings, prepareAudio, prepareSpeech } from '../feedback';
import { LanguageProvider, useLanguage } from '../i18n/language';
import { colour } from '../theme';

// Both must run in the global scope, before the first render.
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 300, fade: true });

/**
 * Fonts usually load faster than this, and without a floor Pepe would appear
 * for a couple of frames and vanish, which reads as a glitch rather than a
 * greeting.
 */
const MINIMUM_SPLASH_MS = 1000;

export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    Fraunces_800ExtraBold, Fraunces_900Black,
    Figtree_600SemiBold, Figtree_800ExtraBold,
  });
  const [held, setHeld] = useState(false);
  const hidden = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setHeld(true), MINIMUM_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => { void prepareAudio(); void prepareSpeech(); void loadSoundSettings(); }, []);

  // A font that fails to load must not strand us on the splash forever; the
  // fallback face is a far better outcome than a screen that never advances.
  const fontsReady = loaded || fontError !== null;

  // LanguageProvider sits at the same spot on every render, in both branches
  // below, so switching branches never remounts it and the language choice
  // it holds survives the handover.
  return (
    <LanguageProvider>
      <Gate
        fontsReady={fontsReady}
        fontsLoaded={loaded}
        held={held}
        onShown={() => {
          // Hand over only once our own view has painted. Hiding the native
          // splash any earlier shows a blank frame between the two.
          if (hidden.current) return;
          hidden.current = true;
          void SplashScreen.hideAsync();
        }}
      />
    </LanguageProvider>
  );
}

/**
 * Decides splash vs. app. Split out from RootLayout because it needs
 * `useLanguage()`, which only works inside `LanguageProvider`.
 *
 * A round captures the gloss language once, when it starts. Without this
 * gate the stack could render — and a round could start — before the stored
 * language finished loading, so the round would silently freeze on the
 * device-locale default even if the learner had chosen something else.
 */
function Gate({ fontsReady, fontsLoaded, held, onShown }: {
  fontsReady: boolean;
  fontsLoaded: boolean;
  held: boolean;
  onShown: () => void;
}) {
  const { ready: languageReady } = useLanguage();
  const ready = fontsReady && languageReady;

  if (!ready || !held) {
    return <Welcome fontsReady={fontsLoaded} onShown={onShown} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colour.ground },
        }}
      />
    </SafeAreaProvider>
  );
}
