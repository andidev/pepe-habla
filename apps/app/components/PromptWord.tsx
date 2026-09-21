import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colour, font } from '../theme';

/** The slot is fixed, so swapping bars for the icon never moves the word. */
const SLOT = 28;

function Bar({ delay, height }: { delay: number; height: number }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(0.45);

  useEffect(() => {
    if (reduced) { scale.value = 1; return; }
    scale.value = withDelay(delay, withRepeat(withSequence(
      withTiming(1, { duration: 450 }),
      withTiming(0.45, { duration: 450 }),
    ), -1));
    return () => cancelAnimation(scale);
  }, [reduced, delay, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));
  return (
    <Animated.View
      style={[{ width: 4, height, borderRadius: 2, backgroundColor: colour.marigold }, style]}
    />
  );
}

function SpeakerIcon() {
  return (
    <View style={{
      width: SLOT, height: SLOT, borderRadius: SLOT / 2, borderWidth: 2, borderColor: colour.muted,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Svg width={15} height={15} viewBox="0 0 24 24">
        <Path d="M4 9v6h4l5 4V5L8 9z" fill={colour.muted} />
        <Path d="M16.5 8.5a5 5 0 0 1 0 7" stroke={colour.muted} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      </Svg>
    </View>
  );
}

/**
 * The question's word, which is also its replay button.
 *
 * While the word is being spoken, three marigold bars pulse beside it; once it
 * has finished, a quiet outlined speaker takes their place. Word and icon are
 * one target, and a tap always restarts from the beginning.
 */
export function PromptWord({ text, playing, onPress, label }: {
  text: string;
  playing: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${text}`}
      hitSlop={8}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        minHeight: 56, paddingHorizontal: 10, borderRadius: 14,
      }}
    >
      <Text style={{
        fontFamily: font.displayHeavy, fontSize: 44, color: colour.ink,
        textAlign: 'center', flexShrink: 1,
      }}>
        {text}
      </Text>
      <View style={{ width: SLOT, height: SLOT, alignItems: 'center', justifyContent: 'center' }}>
        {playing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 22 }}>
            <Bar delay={0} height={10} />
            <Bar delay={150} height={20} />
            <Bar delay={300} height={14} />
          </View>
        ) : (
          <SpeakerIcon />
        )}
      </View>
    </Pressable>
  );
}
