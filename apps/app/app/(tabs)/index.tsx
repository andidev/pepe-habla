import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { isDue, todayISO, type Streak } from '@pepe/core';
import { Bunting } from '../../components/Bunting';
import { Screen } from '../../components/Screen';
import { Pepe } from '../../components/Pepe';
import { PressableCard } from '../../components/PressableCard';
import { cue } from '../../feedback';
import { loadProgress } from '../../storage/progressStore';
import { loadStreak } from '../../storage/streakStore';
import { WORDS } from '../../storage/vocabulary';
import { colour, font, radius, space } from '../../theme';

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 7,
      backgroundColor: colour.surface, borderWidth: 2, borderColor: colour.ink,
      borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 14,
    }}>
      {children}
    </View>
  );
}

function Stat({ value, label, tint }: { value: string; label: string; tint?: string }) {
  return (
    <PressableCard style={{ flex: 1 }} depth={3}>
      <View style={{ paddingVertical: 11, paddingHorizontal: 8, alignItems: 'center' }}>
        <Text style={{ fontFamily: font.display, fontSize: 23, color: tint ?? colour.ink }}>{value}</Text>
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 11, color: colour.muted, letterSpacing: 0.5 }}>
          {label}
        </Text>
      </View>
    </PressableCard>
  );
}

export default function Home() {
  const router = useRouter();
  const [due, setDue] = useState(0);
  const [known, setKnown] = useState(0);
  const [streak, setStreak] = useState<Streak>({ days: 0, lastDate: null });

  // Refresh on every focus, so finishing a round updates these immediately.
  useFocusEffect(useCallback(() => {
    (async () => {
      const [db, s] = await Promise.all([loadProgress(), loadStreak()]);
      const today = todayISO();
      const all = Object.values(db.progress);
      setDue(all.filter((p) => isDue(p, today)).length);
      setKnown(all.filter((p) => p.box >= 4).length);
      setStreak(s);
    })();
  }, []));

  const waiting = due > 0
    ? `¡Órale! Tienes ${due} ${due === 1 ? 'palabra esperándote' : 'palabras esperándote'}.`
    : 'Todo al día. ¿Quieres aprender palabras nuevas?';

  return (
    <Screen edges={['top']}>
      <View style={{ flex: 1, paddingHorizontal: space.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: space.lg }}>
          <Chip>
            <Svg width={17} height={17} viewBox="0 0 24 24">
              <Path
                d="M12 2c1 4-2 5-2 8a4 4 0 0 0 8 0c0-1-.4-2-1-3 2 2 3 4.5 3 7a8 8 0 0 1-16 0c0-4.5 3-8 8-12z"
                fill={colour.marigold} stroke={colour.ink} strokeWidth={1.7} strokeLinejoin="round"
              />
            </Svg>
            <Text style={{ fontFamily: font.bodyHeavy, fontSize: 15, color: colour.ink }}>{streak.days}</Text>
          </Chip>
          <Chip>
            <Text style={{ fontFamily: font.bodyHeavy, fontSize: 12, color: colour.muted }}>NIVEL 1</Text>
            <Text style={{ fontFamily: font.display, fontSize: 15, color: colour.chile }}>Callejero</Text>
          </Chip>
        </View>

        <View style={{ alignItems: 'center', marginTop: space.md }}>
          <Bunting />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{
            backgroundColor: colour.surface, borderWidth: 2, borderColor: colour.ink,
            borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18, maxWidth: 300,
          }}>
            <Text style={{ fontFamily: font.display, fontSize: 19, color: colour.ink, textAlign: 'center' }}>
              {waiting}
            </Text>
          </View>
          <View style={{ marginTop: space.md }}>
            <Pepe pose="hero" motion="breathe" size={230} />
          </View>
        </View>

        <PressableCard
          depth={5}
          face={colour.chile}
          onPress={() => { cue('tap'); router.push('/session'); }}
        >
          <View style={{ height: 62, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.displayHeavy, fontSize: 25, color: colour.surface }}>¡Vamos!</Text>
          </View>
        </PressableCard>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: space.lg, marginBottom: space.md }}>
          <Stat value={String(known)} label="CONOCIDAS" />
          <Stat value={String(due)} label="POR REPASAR" />
          <Stat value={String(WORDS.length)} label="EN TOTAL" />
        </View>
      </View>
    </Screen>
  );
}
