import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing, SlideInUp, SlideOutUp, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { colour, font, outline, radius, space } from '../theme';
import { Pepe } from './Pepe';
import { PressableCard } from './PressableCard';

export type ToastKind = 'good' | 'bad';

/**
 * Feedback that drops from the top of the screen instead of pushing the
 * answers up from the bottom. It floats over the progress bar and never takes
 * layout space, so the option under the learner's thumb stays where it is.
 *
 * Mount a fresh one (a new `key`) for each tap, so each one slides in again.
 */
export function FeedbackToast({ kind, title, subtitle, countdownMs }: {
  kind: ToastKind;
  title: string;
  subtitle?: string;
  countdownMs?: number;
}) {
  const good = kind === 'good';
  const left = useSharedValue(1);

  useEffect(() => {
    if (countdownMs !== undefined) {
      left.value = withTiming(0, { duration: countdownMs, easing: Easing.linear });
    }
  }, [countdownMs, left]);

  const drain = useAnimatedStyle(() => ({ width: `${left.value * 100}%` }));

  return (
    <Animated.View
      entering={SlideInUp.duration(240)}
      exiting={SlideOutUp.duration(200)}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={{ position: 'absolute', top: space.sm, left: space.md, right: space.md, zIndex: 20 }}
    >
      <PressableCard face={good ? colour.cactus : colour.chile} depth={4}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: space.md,
          paddingVertical: space.sm, paddingLeft: space.sm, paddingRight: space.lg,
          paddingBottom: countdownMs !== undefined || good ? space.lg : space.sm,
        }}>
          <View style={{ backgroundColor: colour.surface, borderRadius: 12, ...outline, padding: 2 }}>
            <Pepe pose={good ? 'happy' : 'sad'} motion={good ? 'hop' : 'shake'} size={54} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.display, fontSize: 22, color: colour.surface }}>{title}</Text>
            {subtitle !== undefined && (
              <Text style={{ fontFamily: font.body, fontSize: 14, color: colour.surface, opacity: 0.95, marginTop: 2 }}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        {countdownMs !== undefined && (
          <View style={{
            position: 'absolute', left: space.md, right: space.md, bottom: 7,
            height: 4, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden',
          }}>
            {/* translucent surface, so the track reads on either toast colour */}
            <Animated.View style={[{ height: '100%', backgroundColor: colour.surface }, drain]} />
          </View>
        )}
      </PressableCard>
    </Animated.View>
  );
}
