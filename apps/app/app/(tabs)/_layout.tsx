import { Tabs, useRouter } from 'expo-router';
import { Pressable, type ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useLanguage } from '../../i18n/language';
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
  const router = useRouter();
  const { t } = useLanguage();
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
      <Tabs.Screen name="index" options={{ title: t.tabs.home, tabBarIcon: ({ color }) => <Icon d={icons.home} color={color} /> }} />
      <Tabs.Screen
        name="stats"
        options={{
          title: t.tabs.progress,
          tabBarIcon: ({ color }) => <Icon d={icons.chart} color={color} />,
          headerShown: true,
          headerTitle: '',
          headerStyle: { backgroundColor: colour.ground },
          headerShadowVisible: false,
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel={t.tabs.settings}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24">
                <Path
                  d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"
                  stroke={colour.muted} strokeWidth={1.6} fill="none" strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen name="words" options={{ title: t.tabs.words, tabBarIcon: ({ color }) => <Icon d={icons.list} color={color} /> }} />
    </Tabs>
  );
}
