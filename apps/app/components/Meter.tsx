import { View } from 'react-native';
import { colour, radius, outline } from '../theme';

/**
 * A bordered progress bar. Clamped, because a fraction over one would render
 * a fill wider than its own outline.
 */
export function Meter({ value, max, tint = colour.cactus, height = 15 }: {
  value: number; max: number; tint?: string; height?: number;
}) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max, now: value }}
      style={{
        height, backgroundColor: colour.ground, borderRadius: radius.pill,
        overflow: 'hidden', ...outline,
      }}
    >
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: tint }} />
    </View>
  );
}
