import { Text, View } from 'react-native';
import { PressableCard } from '../components/PressableCard';
import { cue, speak, type CueName } from '../feedback';
import { colour, font, space } from '../theme';

const CUES: CueName[] = ['tap', 'correct', 'wrong', 'complete', 'streak', 'levelup'];

export default function Home() {
  return (
    <View style={{ flex: 1, backgroundColor: colour.ground, padding: space.xl, justifyContent: 'center', gap: space.sm }}>
      {CUES.map((c) => (
        <PressableCard key={c} onPress={() => cue(c)}>
          <Text style={{ fontFamily: font.bodyHeavy, fontSize: 17, padding: space.lg, color: colour.ink }}>{c}</Text>
        </PressableCard>
      ))}
      <PressableCard face={colour.marigold} onPress={() => speak('la madrugada')}>
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 17, padding: space.lg, color: colour.ink }}>
          hablar: la madrugada
        </Text>
      </PressableCard>
    </View>
  );
}
