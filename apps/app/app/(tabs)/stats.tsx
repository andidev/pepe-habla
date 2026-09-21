import { useCallback, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import {
  gloss, leeches, summarise, todayISO,
  type Leech, type Streak, type Summary,
} from '@pepe/core';
import { Meter } from '../../components/Meter';
import { Pepe } from '../../components/Pepe';
import { Screen } from '../../components/Screen';
import { StatTile } from '../../components/StatTile';
import { useLanguage } from '../../i18n/language';
import { loadProgress } from '../../storage/progressStore';
import { loadStreak } from '../../storage/streakStore';
import { PEPE_PHOTO, WORDS } from '../../storage/vocabulary';
import { colour, font, outline, radius, space } from '../../theme';

function Card({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <View style={{
      backgroundColor: colour.surface, borderRadius: radius.card,
      padding: space.lg, ...outline,
    }}>
      <Text style={{ fontFamily: font.display, fontSize: 17, color: colour.ink }}>{title}</Text>
      {subtitle !== undefined && (
        <Text style={{ fontFamily: font.body, fontSize: 12, color: colour.muted, marginTop: 2 }}>
          {subtitle}
        </Text>
      )}
      <View style={{ marginTop: space.md }}>{children}</View>
    </View>
  );
}

export default function Stats() {
  const { t, gloss: g } = useLanguage();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [worst, setWorst] = useState<Leech[]>([]);
  const [streak, setStreak] = useState<Streak>({ days: 0, lastDate: null });

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      const [db, s] = await Promise.all([loadProgress(), loadStreak()]);
      if (!alive) return;
      const today = todayISO();
      setSummary(summarise(WORDS, db.progress, today));
      setWorst(leeches(WORDS, db.progress, 5));
      setStreak(s);
    })();
    return () => { alive = false; };
  }, []));

  if (summary === null) return <Screen><View style={{ flex: 1 }} /></Screen>;

  const nothingYet = summary.practised === 0;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: 0, gap: space.md, paddingBottom: space.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontFamily: font.displayHeavy, fontSize: 32, color: colour.ink }}>
          {t.stats.title}
        </Text>

        <View
          accessible
          accessibilityLabel={t.stats.streakLabel(streak.days)}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space.md,
            backgroundColor: colour.marigold, borderRadius: 18, padding: space.md, ...outline,
          }}>
          <Svg width={34} height={34} viewBox="0 0 24 24">
            <Path
              d="M12 2c1 4-2 5-2 8a4 4 0 0 0 8 0c0-1-.4-2-1-3 2 2 3 4.5 3 7a8 8 0 0 1-16 0c0-4.5 3-8 8-12z"
              fill={colour.ground} stroke={colour.ink} strokeWidth={1.7} strokeLinejoin="round"
            />
          </Svg>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.displayHeavy, fontSize: 27, color: colour.ink }}>
              {t.stats.streakDays(streak.days)}
            </Text>
            <Text style={{ fontFamily: font.bodyHeavy, fontSize: 13, color: colour.ink }}>
              {t.stats.streakCaption(streak.days)}
            </Text>
          </View>
          <Pepe pose={streak.days > 0 ? 'happy' : 'sleeping'} motion="breathe" size={62} />
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatTile value={String(summary.known)} label={t.stats.known} />
          <StatTile value={`+${summary.learnedThisWeek}`} label={t.stats.thisWeek} tint={colour.cactus} />
          <StatTile
            value={summary.accuracy === null ? '—' : `${summary.accuracy}%`}
            label={t.stats.accuracy}
          />
        </View>

        <Card
          title={t.stats.vocabulary}
          subtitle={t.stats.practisedOf(summary.practised, summary.total)}
        >
          <Meter value={summary.known} max={summary.total} />
          <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, marginTop: space.sm }}>
            {t.stats.knownAndDue(summary.known, summary.due)}
          </Text>
        </Card>

        {worst.length > 0 && (
          <Card title={t.stats.tricky} subtitle={t.stats.trickyHint}>
            {worst.map((l) => (
              <View key={l.word.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                <View style={{ width: 118 }}>
                  <Text style={{ fontFamily: font.bodyHeavy, fontSize: 15, color: colour.ink }}>
                    {l.word.es}
                  </Text>
                  <Text style={{ fontFamily: font.body, fontSize: 12, color: colour.muted }}>
                    {gloss(l.word, g)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  {/* Fill shows how often it goes wrong, so the worst word has the
                      fullest bar — the same order as the list itself. */}
                  <Meter value={100 - l.accuracy} max={100} tint={colour.chile} height={11} />
                </View>
                <Text style={{
                  width: 54, textAlign: 'right', fontFamily: font.bodyHeavy,
                  fontSize: 12, color: colour.muted,
                }}>
                  {l.seen - l.wrong}/{l.seen}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {nothingYet && (
          <Card title={t.stats.emptyTitle}>
            <Text style={{ fontFamily: font.body, fontSize: 14, color: colour.muted }}>
              {t.stats.emptyBody}
            </Text>
          </Card>
        )}

        <View style={{
          borderRadius: radius.card, overflow: 'hidden', marginTop: space.sm, ...outline,
        }}>
          <Image
            source={PEPE_PHOTO}
            accessibilityLabel={t.stats.photoLabel}
            style={{ width: '100%', height: undefined, aspectRatio: 4 / 3 }}
            resizeMode="cover"
          />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colour.ink, padding: space.md }}>
            <Text style={{ fontFamily: font.display, fontSize: 15, color: colour.ground }}>
              {t.stats.photoTitle}
            </Text>
            <Text style={{ fontFamily: font.body, fontSize: 12, color: colour.ground, opacity: 0.78 }}>
              {t.stats.photoCaption}
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
