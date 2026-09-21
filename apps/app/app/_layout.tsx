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
  const ready = loaded || fontError !== null;

  if (!ready || !held) {
    return (
      <Welcome
        fontsReady={loaded}
        onShown={() => {
          // Hand over only once our own view has painted. Hiding the native
          // splash any earlier shows a blank frame between the two.
          if (hidden.current) return;
          hidden.current = true;
          void SplashScreen.hideAsync();
        }}
      />
    );
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
