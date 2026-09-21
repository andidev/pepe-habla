import { Text, View } from 'react-native';
import { PressableCard } from './PressableCard';
import { colour, font, space } from '../theme';

export type OptionState = 'idle' | 'correct' | 'wrong' | 'wrong-faded' | 'dimmed';

const FACE: Record<OptionState, string> = {
  idle: colour.surface,
  correct: colour.cactus,
  wrong: colour.chile,
  'wrong-faded': colour.chile,
  dimmed: colour.surface,
};

const TEXT: Record<OptionState, string> = {
  idle: colour.ink,
  correct: colour.surface,
  wrong: colour.surface,
  'wrong-faded': colour.surface,
  dimmed: colour.muted,
};

const MARK: Record<OptionState, string> = {
  idle: '', correct: '✓', wrong: '✕', 'wrong-faded': '✕', dimmed: '',
};

const FADED: ReadonlySet<OptionState> = new Set(['dimmed', 'wrong-faded']);

/**
 * One answer.
 *
 * Full width on purpose: a 350x56 row is a larger target than a grid cell and
 * gives one flush-left scan line rather than a Z-pattern across centred text,
 * and long words like "el medio ambiente" stay on one line.
 *
 * A wrong option stays red and shows what it actually means, so a miss
 * teaches two words; the old bottom sheet used to say this, and the short
 * toast no longer can.
 */
export function OptionButton({
  label, state, onPress, disabled, detail,
}: {
  label: string;
  state: OptionState;
  onPress: () => void;
  disabled: boolean;
  /** What a wrong option means, shown small beside it. */
  detail?: string;
}) {
  return (
    <PressableCard
      face={FACE[state]}
      onPress={disabled ? undefined : onPress}
      label={detail ? `${label}, ${detail}` : label}
      style={{ opacity: FADED.has(state) ? 0.45 : 1 }}
    >
      <View style={{
        minHeight: 56, paddingHorizontal: 18,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md,
      }}>
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 18, color: TEXT[state], flexShrink: 1 }}>
          {label}
          {detail !== undefined && (
            <Text style={{ fontFamily: font.body, fontSize: 14 }}>{`  = ${detail}`}</Text>
          )}
        </Text>
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 19, color: TEXT[state] }}>
          {MARK[state]}
        </Text>
      </View>
    </PressableCard>
  );
}
