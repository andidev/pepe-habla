import { useEffect, useState } from 'react';
import { AccessibilityInfo, Image } from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { POSES, type PoseName } from '../storage/vocabulary';

export type Motion = 'still' | 'breathe' | 'hop' | 'shake' | 'celebrate';

interface Props {
  pose: PoseName;
  motion?: Motion;
  size: number;
}

const AnimatedImage = Animated.createAnimatedComponent(Image);

/**
 * The mascot.
 *
 * Everything animates about the bottom edge: squash and stretch only reads as
 * weight if the character pivots on the ground rather than its middle, which is
 * why `transformOrigin` is set rather than left at the default centre.
 */
export function Pepe({ pose, motion = 'breathe', size }: Props) {
  const lift = useSharedValue(0);
  const squashX = useSharedValue(1);
  const squashY = useSharedValue(1);
  const tilt = useSharedValue(0);

  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setReduceMotion(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { alive = false; sub.remove(); };
  }, []);

  useEffect(() => {
    cancelAnimation(lift);
    cancelAnimation(squashX);
    cancelAnimation(squashY);
    cancelAnimation(tilt);
    lift.value = 0; squashX.value = 1; squashY.value = 1; tilt.value = 0;
    if (reduceMotion) return;      // still shows the right pose, just still

    const ease = Easing.inOut(Easing.ease);

    if (motion === 'breathe') {
      lift.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 1450, easing: ease }),
          withTiming(0, { duration: 1450, easing: ease }),
        ), -1, false);
    }

    if (motion === 'hop') {
      // 620ms: up with a stretch, down with a squash on landing, small rebound.
      lift.value = withSequence(
        withTiming(-20, { duration: 140, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 160, easing: Easing.in(Easing.quad) }),
        withTiming(-7, { duration: 120, easing: ease }),
        withTiming(0, { duration: 200, easing: ease }),
      );
      squashY.value = withSequence(
        withTiming(1.09, { duration: 140 }),
        withTiming(0.93, { duration: 160 }),
        withTiming(1, { duration: 320 }),
      );
      squashX.value = withSequence(
        withTiming(0.93, { duration: 140 }),
        withTiming(1.07, { duration: 160 }),
        withTiming(1, { duration: 320 }),
      );
    }

    if (motion === 'shake') {
      tilt.value = withSequence(
        withTiming(-5, { duration: 105, easing: ease }),
        withTiming(4, { duration: 130, easing: ease }),
        withTiming(-2, { duration: 130, easing: ease }),
        withTiming(0, { duration: 155, easing: ease }),
      );
      lift.value = withSequence(
        withTiming(3, { duration: 240, easing: ease }),
        withTiming(0, { duration: 280, easing: ease }),
      );
    }

    if (motion === 'celebrate') {
      lift.value = withRepeat(
        withSequence(
          withTiming(-13, { duration: 575, easing: ease }),
          withTiming(0, { duration: 575, easing: ease }),
        ), -1, false);
      tilt.value = withRepeat(
        withSequence(
          withTiming(2, { duration: 575, easing: ease }),
          withTiming(-1.5, { duration: 575, easing: ease }),
        ), -1, false);
    }

    return () => {
      cancelAnimation(lift);
      cancelAnimation(squashX);
      cancelAnimation(squashY);
      cancelAnimation(tilt);
    };
  }, [motion, pose, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: lift.value },
      { scaleX: squashX.value },
      { scaleY: squashY.value },
      { rotate: `${tilt.value}deg` },
    ],
  }));

  return (
    <AnimatedImage
      source={POSES[pose]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      style={[{ width: size, height: size, transformOrigin: '50% 100%' }, style]}
    />
  );
}
