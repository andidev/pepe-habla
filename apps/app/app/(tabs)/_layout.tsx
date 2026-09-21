import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colour, font } from '../../theme';

const icons = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  list: 'M4 6h16M4 12h16M4 18h10',
} as const;

const Icon = ({ d, color }: { d: string; color: ColorValue }) => (
  <Svg width={23} height={23} viewBox="0 0 24 24">
    <Path d={d} stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" fill="none" />
  </Svg>
);

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colour.chile,
        tabBarInactiveTintColor: colour.muted,
        tabBarLabelStyle: { fontFamily: font.bodyHeavy, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colour.surface,
          borderTopWidth: 2,
          borderTopColor: colour.ink,
        },
        sceneStyle: { backgroundColor: colour.ground },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: ({ color }) => <Icon d={icons.home} color={color} /> }} />
      <Tabs.Screen name="stats" options={{ title: 'Progreso', tabBarIcon: ({ color }) => <Icon d={icons.chart} color={color} /> }} />
      <Tabs.Screen name="words" options={{ title: 'Palabras', tabBarIcon: ({ color }) => <Icon d={icons.list} color={color} /> }} />
    </Tabs>
  );
}
