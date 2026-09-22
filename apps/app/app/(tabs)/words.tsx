import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import {
  GRAMMAR_THEMES, gloss, isDue, isKnown, THEMES, todayISO, TRACKS,
  type Progress, type Track, type Word,
} from '@pepe/core';
import { Meter } from '../../components/Meter';
import { Screen } from '../../components/Screen';
import { canSpeak, cue, speak } from '../../feedback';
import { useLanguage } from '../../i18n/language';
import { loadProgress } from '../../storage/progressStore';
import { loadTrack } from '../../storage/trackStore';
import { WORDS } from '../../storage/vocabulary';
import { colour, font, outline, radius, space } from '../../theme';

type Filter = 'all' | 'due' | 'known' | 'tricky';
const FILTER_KEYS: Filter[] = ['all', 'due', 'known', 'tricky'];

interface Row { word: Word; p: Progress }

export default function Words() {
  const { t, gloss: g } = useLanguage();
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [filter, setFilter] = useState<Filter>('all');
  // Defaults to whatever ladder the learner is climbing (loadTrack), but is a
  // filter local to this screen from then on: browsing the other track's
  // practised cards should not silently change what a session drawn from
  // home practises next. Only home's own toggle calls saveTrack.
  const [track, setTrack] = useState<Track>('words');
  // null = "all themes". A theme id from one track means nothing on the
  // other (presente vs. comida), so switching track resets it.
  const [theme, setTheme] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    void Promise.all([loadProgress(), loadTrack()]).then(([db, chosen]) => {
      if (!alive) return;
      setProgress(db.progress);
      setTrack(chosen);
    });
    return () => { alive = false; };
  }, []));

  const rows = useMemo<Row[]>(() => {
    const today = todayISO();
    // Only words actually practised: a list of 384 untouched entries tells the
    // learner nothing they did not already know.
    const all: Row[] = [];
    for (const word of WORDS) {
      if (word.track !== track) continue;
      const p = progress[word.id];
      if (p !== undefined) all.push({ word, p });
    }
    const keep = (r: Row) => {
      if (filter === 'due') return isDue(r.p, today);
      if (filter === 'known') return isKnown(r.p);
      if (filter === 'tricky') return r.p.wrong > 0 && !isKnown(r.p);
      return true;
    };
    return all
      .filter(keep)
      .sort((a, b) => b.p.wrong - a.p.wrong || a.word.es.localeCompare(b.word.es, 'es'));
  }, [progress, filter, track]);

  // Only themes with a practised card behind them get a chip: 28 chips where
  // 5 have anything behind them is noise. Computed from `rows` before the
  // theme filter below is applied, or picking a theme would erase every
  // other chip.
  const available = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) for (const th of r.word.themes) seen.add(th);
    return (track === 'grammar' ? GRAMMAR_THEMES : THEMES).filter((th) => seen.has(th));
  }, [rows, track]);

  const visible = useMemo(
    () => (theme === null ? rows : rows.filter((r) => r.word.themes.includes(theme))),
    [rows, theme],
  );

  const selectTrack = (id: Track) => {
    cue('tap');
    setTrack(id);
    setTheme(null);
  };

  const selectFilter = (key: Filter) => {
    cue('tap');
    setFilter(key);
    setTheme(null);
  };

  // Scoped to the selected track, so a learner on Gramática is not told how
  // many of the whole seed's 484 cards they have touched (Task 7 fixed the
  // same defect on home).
  const mine = useMemo(() => WORDS.filter((w) => w.track === track), [track]);
  const practised = useMemo(
    () => mine.filter((w) => progress[w.id] !== undefined).length,
    [mine, progress],
  );

  return (
    <Screen>
      <View style={{ paddingHorizontal: space.xl, paddingTop: space.lg }}>
        <Text style={{ fontFamily: font.displayHeavy, fontSize: 32, color: colour.ink }}>
          {t.words.title}
        </Text>
        <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted }}>
          {t.words.practisedOf(practised, mine.length)}
        </Text>

        <Text style={{
          fontFamily: font.bodyHeavy, fontSize: 11, color: colour.muted,
          letterSpacing: 0.5, marginTop: space.md,
        }}>
          {t.words.filter.track}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          {TRACKS.map((id) => {
            const on = id === track;
            return (
              <Pressable
                key={id}
                onPress={() => selectTrack(id)}
                accessibilityRole="button"
                accessibilityLabel={t.track[id]}
                accessibilityState={{ selected: on }}
                style={{
                  flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center',
                  borderRadius: radius.button, backgroundColor: on ? colour.surface : colour.ground,
                  ...outline,
                }}
              >
                <Text style={{ fontFamily: font.display, fontSize: 17, color: colour.ink }}>
                  {t.track[id]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.md }}>
          {FILTER_KEYS.map((key) => {
            const label = t.words.filter[key];
            const on = key === filter;
            return (
              <Pressable
                key={key}
                onPress={() => selectFilter(key)}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: on }}
                style={{
                  minHeight: 44, justifyContent: 'center', paddingHorizontal: 15,
                  borderRadius: radius.pill, ...outline,
                  backgroundColor: on ? colour.ink : colour.surface,
                }}
              >
                <Text style={{
                  fontFamily: font.bodyHeavy, fontSize: 14,
                  color: on ? colour.ground : colour.ink,
                }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={{
          fontFamily: font.bodyHeavy, fontSize: 11, color: colour.muted,
          letterSpacing: 0.5, marginTop: space.md,
        }}>
          {t.words.filter.theme}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginTop: 6 }}
        >
          <Pressable
            onPress={() => { cue('tap'); setTheme(null); }}
            accessibilityRole="button"
            accessibilityLabel={t.words.filter.all}
            accessibilityState={{ selected: theme === null }}
            style={{
              minHeight: 44, justifyContent: 'center', paddingHorizontal: 15,
              borderRadius: radius.pill, ...outline,
              backgroundColor: theme === null ? colour.surface : colour.ground,
            }}
          >
            <Text style={{ fontFamily: font.bodyHeavy, fontSize: 14, color: colour.ink }}>
              {t.words.filter.all}
            </Text>
          </Pressable>
          {available.map((id) => {
            const on = id === theme;
            return (
              <Pressable
                key={id}
                onPress={() => { cue('tap'); setTheme(id); }}
                accessibilityRole="button"
                accessibilityLabel={t.theme[id]}
                accessibilityState={{ selected: on }}
                style={{
                  minHeight: 44, justifyContent: 'center', paddingHorizontal: 15,
                  borderRadius: radius.pill, ...outline,
                  backgroundColor: on ? colour.surface : colour.ground,
                }}
              >
                <Text style={{ fontFamily: font.bodyHeavy, fontSize: 14, color: colour.ink }}>
                  {t.theme[id]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(r) => r.word.id}
        contentContainerStyle={{ padding: space.xl, paddingTop: space.md, gap: 9 }}
        ListEmptyComponent={
          <Text style={{ fontFamily: font.body, fontSize: 14, color: colour.muted }}>
            {practised === 0 ? t.words.emptyNone : t.words.emptyFilter}
          </Text>
        }
        renderItem={({ item }) => {
          const accuracy = item.p.seen === 0 ? 0 : Math.round((item.p.right / item.p.seen) * 100);
          const tint = accuracy >= 80 ? colour.cactus : accuracy >= 50 ? colour.marigold : colour.chile;
          // No recordings ship, so this is a property of the device, not the word.
          const speakable = canSpeak();
          return (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: colour.surface, borderRadius: radius.button,
              paddingVertical: 11, paddingHorizontal: 14, ...outline,
            }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text style={{ fontFamily: font.display, fontSize: 17, color: colour.ink }}>
                    {item.word.es}
                  </Text>
                  <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, flexShrink: 1 }}>
                    {gloss(item.word, g)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <View style={{ width: 96 }}>
                    <Meter value={accuracy} max={100} tint={tint} height={9} />
                  </View>
                  <Text style={{ fontFamily: font.bodyHeavy, fontSize: 11, color: colour.muted }}>
                    {item.p.right}/{item.p.seen} · {item.p.dueOn}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => speak(item.word)}
                disabled={!speakable}
                accessibilityRole="button"
                accessibilityLabel={t.words.listen(item.word.es)}
                style={{
                  width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: colour.ground, borderRadius: radius.pill,
                  opacity: speakable ? 1 : 0.35, ...outline,
                }}
              >
                <Svg width={19} height={19} viewBox="0 0 24 24">
                  <Path d="M4 9v6h4l5 4V5L8 9z" fill={colour.ink} />
                  <Path d="M16.5 8.5a5 5 0 0 1 0 7" stroke={colour.ink} strokeWidth={2} strokeLinecap="round" fill="none" />
                </Svg>
              </Pressable>
            </View>
          );
        }}
      />
    </Screen>
  );
}
