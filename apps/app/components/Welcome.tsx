import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { pickOne } from '@pepe/core';
import { useLanguage } from '../i18n/language';
import { GREETINGS } from '../storage/greetings';
import { POSES, type PoseName } from '../storage/vocabulary';
import { colour, font, space } from '../theme';
import { Pepe } from './Pepe';

const POSE_NAMES = Object.keys(POSES) as PoseName[];

interface Props {
  /** Fires once the view has actually painted, not merely mounted. */
  onShown: () => void;
  /** The greeting waits for this; see below. */
  fontsReady: boolean;
}

/**
 * What you look at while the app boots.
 *
 * A different Pepe each launch, with a line only that pose would say, so the
 * wait reads as a small reward rather than a delay.
 *
 * The greeting is held back until the display face has loaded. Fonts are the
 * very thing being waited on, so drawing text any earlier would render it in
 * a fallback face and then visibly reflow when Fraunces arrived. The caption
 * keeps its height while empty, so Pepe does not jump when the line appears.
 */
export function Welcome({ onShown, fontsReady }: Props) {
  const [pose] = useState<PoseName>(() => pickOne(POSE_NAMES, Math.random));
  const [greeting] = useState(() => pickOne(GREETINGS[pose], Math.random));
  const { gloss, ready } = useLanguage();

  const fade = useSharedValue(0);
  useEffect(() => {
    if (fontsReady && ready) fade.value = withTiming(1, { duration: 260 });
  }, [fontsReady, ready, fade]);
  const fading = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <View style={styles.root} onLayout={onShown}>
      <Pepe pose={pose} motion="breathe" size={220} />
      <View style={styles.caption}>
        {fontsReady && ready ? (
          <Animated.View style={fading}>
            <Text style={styles.spanish}>{greeting.es}</Text>
            <Text style={styles.gloss}>{gloss === 'sv' ? greeting.sv : greeting.en}</Text>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colour.ground,
  },
  caption: {
    height: 84,
    marginTop: space.lg,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: space.xl,
  },
  spanish: {
    fontFamily: font.display,
    fontSize: 30,
    color: colour.ink,
    textAlign: 'center',
  },
  gloss: {
    fontFamily: font.body,
    fontSize: 15,
    color: colour.muted,
    textAlign: 'center',
    marginTop: space.xs,
  },
});
