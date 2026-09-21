import { Text, View } from 'react-native';
import { colour, font, radius, outline } from '../theme';

/** One number with its caption. The repeated unit of the stats screen. */
export function StatTile({ value, label, tint }: { value: string; label: string; tint?: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${value} ${label.toLowerCase()}`}
      style={{
        flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8,
        backgroundColor: colour.surface, borderRadius: radius.button, ...outline,
      }}>
      <Text style={{ fontFamily: font.display, fontSize: 26, color: tint ?? colour.ink }}>
        {value}
      </Text>
      <Text style={{ fontFamily: font.bodyHeavy, fontSize: 11, color: colour.muted, letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  );
}
