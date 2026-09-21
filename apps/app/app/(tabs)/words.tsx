import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { isDue, isKnown, todayISO, type Progress, type Word } from '@pepe/core';
import { Meter } from '../../components/Meter';
import { Screen } from '../../components/Screen';
import { canSpeak, cue, speak } from '../../feedback';
import { loadProgress } from '../../storage/progressStore';
import { WORDS } from '../../storage/vocabulary';
import { colour, font, outline, radius, space } from '../../theme';

type Filter = 'todas' | 'repasar' | 'conocidas' | 'fallas';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'repasar', label: 'Por repasar' },
  { key: 'conocidas', label: 'Conocidas' },
  { key: 'fallas', label: 'Se te atragantan' },
];

interface Row { word: Word; p: Progress }

export default function Words() {
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [filter, setFilter] = useState<Filter>('todas');

  useFocusEffect(useCallback(() => {
    let alive = true;
    void loadProgress().then((db) => { if (alive) setProgress(db.progress); });
    return () => { alive = false; };
  }, []));

  const rows = useMemo<Row[]>(() => {
    const today = todayISO();
    // Only words actually practised: a list of 384 untouched entries tells the
    // learner nothing they did not already know.
    const all: Row[] = [];
    for (const word of WORDS) {
      const p = progress[word.id];
      if (p !== undefined) all.push({ word, p });
    }
    const keep = (r: Row) => {
      if (filter === 'repasar') return isDue(r.p, today);
      if (filter === 'conocidas') return isKnown(r.p);
      if (filter === 'fallas') return r.p.wrong > 0 && !isKnown(r.p);
      return true;
    };
    return all
      .filter(keep)
      .sort((a, b) => b.p.wrong - a.p.wrong || a.word.es.localeCompare(b.word.es, 'es'));
  }, [progress, filter]);

  const practised = Object.keys(progress).length;

  return (
    <Screen>
      <View style={{ paddingHorizontal: space.xl, paddingTop: space.lg }}>
        <Text style={{ fontFamily: font.displayHeavy, fontSize: 32, color: colour.ink }}>
          Palabras
        </Text>
        <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted }}>
          {practised} practicadas de {WORDS.length}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.md }}>
          {FILTERS.map(({ key, label }) => {
            const on = key === filter;
            return (
              <Pressable
                key={key}
                onPress={() => { cue('tap'); setFilter(key); }}
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
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.word.id}
        contentContainerStyle={{ padding: space.xl, paddingTop: space.md, gap: 9 }}
        ListEmptyComponent={
          <Text style={{ fontFamily: font.body, fontSize: 14, color: colour.muted }}>
            {practised === 0
              ? 'Todavía no has practicado ninguna palabra.'
              : 'Nada aquí por ahora.'}
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
                    {item.word.en}
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
                accessibilityLabel={`Escuchar ${item.word.es}`}
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
