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
import { startReminderRefresh } from '../notifications';
import { colour } from '../theme';

// Both must run in the global scope, before the first render.
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 300, fade: true });

export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    Fraunces_800ExtraBold, Fraunces_900Black,
    Figtree_600SemiBold, Figtree_800ExtraBold,
  });
  const hidden = useRef(false);

  useEffect(() => { void prepareAudio(); void prepareSpeech(); void loadSoundSettings(); }, []);

  // Re-queue on launch and on every return to the app. Progress may have moved
  // in a round we already forgot about, and the queue would otherwise promise a
  // streak that is days dead.
  useEffect(() => startReminderRefresh(), []);

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
 *
 * Once ready, the app mounts *underneath* the splash rather than replacing
 * it, so the splash can fade out over it. Both children keep their positions
 * on every render, so Welcome is never remounted mid-greeting.
 */
function Gate({ fontsReady, fontsLoaded, onShown }: {
  fontsReady: boolean;
  fontsLoaded: boolean;
  onShown: () => void;
}) {
  const { ready: languageReady } = useLanguage();
  const ready = fontsReady && languageReady;
  const [splashGone, setSplashGone] = useState(false);

  return (
    <>
      {ready ? (
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colour.ground },
            }}
          />
        </SafeAreaProvider>
      ) : null}
      {splashGone ? null : (
        <Welcome
          onShown={onShown}
          canGreet={fontsLoaded && languageReady}
          ready={ready}
          onGone={() => setSplashGone(true)}
        />
      )}
    </>
  );
}
