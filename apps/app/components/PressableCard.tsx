import type { ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { colour, outline, radius } from '../theme';

interface Props {
  children: ReactNode;
  /** How far the face floats above its shadow slab. */
  depth?: number;
  face?: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  /** Announced by a screen reader. Required in practice for anything tappable. */
  label?: string;
  role?: 'button' | 'link';
}

/**
 * A surface with a hard offset shadow that sinks when pressed.
 *
 * The shadow is a solid View behind the face rather than a shadow property,
 * because both platforms' native shadows are blurred and this design is not.
 */
export function PressableCard({
  children, depth = 4, face = colour.surface, onPress, disabled, style, label, role,
}: Props) {
  const sunk = useSharedValue(0);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -depth + sunk.value * depth }],
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      onPressIn={() => { sunk.value = withTiming(1, { duration: 60 }); }}
      onPressOut={() => { sunk.value = withTiming(0, { duration: 110 }); }}
      accessibilityRole={onPress ? (role ?? 'button') : undefined}
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled || !onPress) }}
      style={[{ borderRadius: radius.card, backgroundColor: colour.ink }, style]}
    >
      <Animated.View
        style={[
          { borderRadius: radius.card, backgroundColor: face, marginBottom: depth },
          outline,
          faceStyle,
        ]}
      >
        <View>{children}</View>
      </Animated.View>
    </Pressable>
  );
}
