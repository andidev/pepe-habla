import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import {
  Fraunces_800ExtraBold, Fraunces_900Black,
} from '@expo-google-fonts/fraunces';
import { Figtree_600SemiBold, Figtree_800ExtraBold } from '@expo-google-fonts/figtree';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { prepareAudio } from '../feedback';
import { colour } from '../theme';

export default function RootLayout() {
  const [ready] = useFonts({
    Fraunces_800ExtraBold, Fraunces_900Black,
    Figtree_600SemiBold, Figtree_800ExtraBold,
  });

  useEffect(() => { void prepareAudio(); }, []);

  if (!ready) return null;

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
