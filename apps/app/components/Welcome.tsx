import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { pickOne } from '@pepe/core';
import { POSES, type PoseName } from '../storage/vocabulary';
import { colour } from '../theme';
import { Pepe } from './Pepe';

const POSE_NAMES = Object.keys(POSES) as PoseName[];

interface Props {
  /** Fires once the view has actually painted, not merely mounted. */
  onShown: () => void;
}

/**
 * What you look at while the app boots.
 *
 * A different Pepe each launch, so the wait reads as a small reward rather
 * than a delay. Deliberately wordless: the fonts are the very thing being
 * waited on, so any text here would draw in a fallback face and then jump
 * when Fraunces arrives.
 */
export function Welcome({ onShown }: Props) {
  const [pose] = useState<PoseName>(() => pickOne(POSE_NAMES, Math.random));

  return (
    <View style={styles.root} onLayout={onShown}>
      <Pepe pose={pose} motion="breathe" size={220} />
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
});
