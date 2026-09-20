import { useState } from 'react';
import { Text, View } from 'react-native';
import { Pepe, type Motion } from '../components/Pepe';
import { PressableCard } from '../components/PressableCard';
import { POSES, type PoseName } from '../storage/vocabulary';
import { colour, font, space } from '../theme';

const MOTIONS: Motion[] = ['breathe', 'hop', 'shake', 'celebrate'];

export default function Home() {
  const [motion, setMotion] = useState<Motion>('breathe');
  const [pose, setPose] = useState<PoseName>('idle');

  return (
    <View style={{ flex: 1, backgroundColor: colour.ground, padding: space.xl, justifyContent: 'center', gap: space.lg }}>
      <View style={{ height: 240, alignItems: 'center', justifyContent: 'flex-end' }}>
        <Pepe pose={pose} motion={motion} size={190} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {MOTIONS.map((m) => (
          <PressableCard key={m} onPress={() => setMotion(m)} face={m === motion ? colour.marigold : colour.surface}>
            <Text style={{ fontFamily: font.bodyHeavy, padding: space.md, color: colour.ink }}>{m}</Text>
          </PressableCard>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {(Object.keys(POSES) as PoseName[]).map((p) => (
          <PressableCard key={p} onPress={() => setPose(p)} face={p === pose ? colour.cactus : colour.surface}>
            <Text style={{ fontFamily: font.bodyHeavy, padding: space.md, color: p === pose ? colour.surface : colour.ink }}>{p}</Text>
          </PressableCard>
        ))}
      </View>
    </View>
  );
}
