import { Text, View } from 'react-native';
import { PressableCard } from './PressableCard';
import { colour, font, space } from '../theme';

export type OptionState = 'idle' | 'correct' | 'wrong' | 'dimmed';

const FACE: Record<OptionState, string> = {
  idle: colour.surface,
  correct: colour.cactus,
  wrong: colour.chile,
  dimmed: colour.surface,
};

const TEXT: Record<OptionState, string> = {
  idle: colour.ink,
  correct: colour.surface,
  wrong: colour.surface,
  dimmed: colour.muted,
};

const MARK: Record<OptionState, string> = {
  idle: '', correct: '✓', wrong: '✕', dimmed: '',
};

/**
 * One answer.
 *
 * Full width on purpose: a 350x56 row is a larger target than a grid cell and
 * gives one flush-left scan line rather than a Z-pattern across centred text,
 * and long words like "el medio ambiente" stay on one line.
 */
export function OptionButton({
  label, state, onPress, disabled,
}: {
  label: string;
  state: OptionState;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <PressableCard
      face={FACE[state]}
      onPress={disabled ? undefined : onPress}
      style={{ opacity: state === 'dimmed' ? 0.45 : 1 }}
    >
      <View style={{
        minHeight: 56, paddingHorizontal: 18,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md,
      }}>
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 18, color: TEXT[state], flexShrink: 1 }}>
          {label}
        </Text>
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 19, color: TEXT[state] }}>
          {MARK[state]}
        </Text>
      </View>
    </PressableCard>
  );
}
