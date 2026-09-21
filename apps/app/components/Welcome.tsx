import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { pickOne } from '@pepe/core';
import { useLanguage } from '../i18n/language';
import { GREETINGS } from '../storage/greetings';
import { colour, font, space } from '../theme';

const SPLASH_IMAGE = require('../assets/splash.png');

/**
 * The splash image's box, in points: a square centred on the screen, with the
 * image fitted inside it. The native splash draws its image exactly this way,
 * sized by imageWidth in app.json -- so that is read here rather than copied,
 * and the two can never disagree. tools/make_splash.py builds the image from
 * the same number.
 */
const SPLASH: number = require('../app.json').expo.plugins
  .find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1].imageWidth;

/** How long the greeting stays up once it has appeared, unless tapped away. */
const GREETING_MS = 2500;
const FADE_OUT_MS = 300;

interface Props {
  /** Fires once the view has actually painted, not merely mounted. */
  onShown: () => void;
  /** Fonts and the stored language have loaded, so the line can be drawn. */
  canGreet: boolean;
  /** The app may be entered. True without `canGreet` if a font failed. */
  ready: boolean;
  /** The splash has finished fading out and can be unmounted. */
  onGone: () => void;
}

/**
 * What you look at while the app boots, and the handover from the native
 * splash that precedes it.
 *
 * The native splash is a static image -- the app's name above Pepe -- drawn
 * before any JavaScript runs. This view draws the very same image in the very
 * same box, so when it takes over nothing moves, and the only change is the
 * greeting fading in underneath. The name is part of the image rather than
 * text for the same reason: the native splash cannot draw text, and live text
 * would render differently from a picture of it.
 *
 * The greeting waits for fonts, since drawing it in a fallback face would
 * reflow when Fraunces arrived. It then stays up long enough to read, counted
 * from when it appears rather than from launch, and a tap skips ahead. The
 * app is mounted underneath by then, so leaving is a crossfade, not a cut.
 */
export function Welcome({ onShown, canGreet, ready, onGone }: Props) {
  const [greeting] = useState(() => pickOne(GREETINGS, Math.random));
  const { gloss } = useLanguage();
  const { width } = useWindowDimensions();
  const [leaving, setLeaving] = useState(false);
  const leaveOnce = useRef(false);

  const caption = useSharedValue(0);
  const whole = useSharedValue(1);

  const leave = () => {
    if (!ready || leaveOnce.current) return;
    leaveOnce.current = true;
    setLeaving(true);
    whole.value = withTiming(0, { duration: FADE_OUT_MS });
    setTimeout(onGone, FADE_OUT_MS);
  };

  useEffect(() => {
    if (!canGreet) return;
    caption.value = withTiming(1, { duration: 260 });
    const timer = setTimeout(leave, GREETING_MS);
    return () => clearTimeout(timer);
  }, [canGreet, ready]);

  // A font that failed to load leaves nothing to greet with; go straight in
  // rather than hold an empty splash.
  useEffect(() => {
    if (ready && !canGreet) leave();
  }, [ready, canGreet]);

  const fadingCaption = useAnimatedStyle(() => ({ opacity: caption.value }));
  const fadingWhole = useAnimatedStyle(() => ({ opacity: whole.value }));

  const captionWidth = width - space.xl * 2;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, fadingWhole]}
      pointerEvents={leaving ? 'none' : 'auto'}
      onLayout={onShown}
    >
      <Pressable style={styles.centre} onPress={leave} accessible={false}>
        <View style={styles.box}>
          <Image
            source={SPLASH_IMAGE}
            resizeMode="contain"
            style={styles.box}
            accessibilityLabel="Pepe Habla"
          />
          {canGreet ? (
            <Animated.View
              style={[
                styles.caption,
                { width: captionWidth, left: (SPLASH - captionWidth) / 2 },
                fadingCaption,
              ]}
            >
              <Text style={styles.spanish}>{greeting.es}</Text>
              <Text style={styles.gloss}>{gloss === 'sv' ? greeting.sv : greeting.en}</Text>
            </Animated.View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colour.ground,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: SPLASH,
    height: SPLASH,
  },
  caption: {
    position: 'absolute',
    top: SPLASH + space.sm,
    alignItems: 'center',
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
