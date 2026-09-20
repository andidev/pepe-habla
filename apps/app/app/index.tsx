import { Text, View } from 'react-native';
import { INTERVALS, todayISO, mulberry32 } from '@pepe/core';
import { PressableCard } from '../components/PressableCard';
import { Screen } from '../components/Screen';
import { colour, font, space } from '../theme';

export default function Home() {
  const proof = `${todayISO()} · boxes ${Object.values(INTERVALS).join('/')} · rng ${mulberry32(1)().toFixed(3)}`;

  return (
    <Screen>
      <View style={{ flex: 1, backgroundColor: colour.ground, justifyContent: 'center', padding: space.xl }}>
        <PressableCard onPress={() => {}}>
          <View style={{ padding: space.lg }}>
            <Text style={{ fontFamily: font.display, fontSize: 24, color: colour.ink }}>
              Pepe Habla
            </Text>
            <Text style={{ fontFamily: font.body, fontSize: 14, color: colour.muted, marginTop: space.xs }}>
              {proof}
            </Text>
          </View>
        </PressableCard>
      </View>
    </Screen>
  );
}
