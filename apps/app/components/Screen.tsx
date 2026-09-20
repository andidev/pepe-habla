import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colour } from '../theme';

/** The width the whole app is designed at. */
export const APP_WIDTH = 430;

/**
 * The outer frame of every screen.
 *
 * On a phone this is just a safe-area view. On the web it also centres the
 * app and caps its width, so the design keeps its proportions in a browser
 * window. This and `feedback.ts` are the only places allowed to care which
 * platform they are running on.
 */
export function Screen({
  children, edges = ['top'],
}: {
  children: ReactNode;
  edges?: readonly Edge[];
}) {
  return (
    <View style={{ flex: 1, backgroundColor: colour.ground, alignItems: 'center' }}>
      <SafeAreaView style={{ flex: 1, width: '100%', maxWidth: APP_WIDTH }} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}
