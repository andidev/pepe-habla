import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import {
  isDue, isKnown, levelName, levelStats, todayISO, TRACKS, unlockedThrough,
  type Progress, type Streak, type Track,
} from '@pepe/core';
import { Bunting } from '../../components/Bunting';
import { Meter } from '../../components/Meter';
import { Screen } from '../../components/Screen';
import { Pepe } from '../../components/Pepe';
import { PressableCard } from '../../components/PressableCard';
import { cue } from '../../feedback';
import { useLanguage } from '../../i18n/language';
import { loadProgress } from '../../storage/progressStore';
import { loadStreak } from '../../storage/streakStore';
import { loadTrack, saveTrack } from '../../storage/trackStore';
import { WORDS } from '../../storage/vocabulary';
import { colour, font, outline, radius, space } from '../../theme';

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 7,
      backgroundColor: colour.surface, borderWidth: 2, borderColor: colour.ink,
      borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 14,
    }}>
      {children}
    </View>
  );
}

/** One number with its caption. Grouped, so a screen reader says "12 kända"
 *  rather than stopping on "12" and then on "KÄNDA". */
function Stat({ value, label, tint }: { value: string; label: string; tint?: string }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label.toLowerCase()}`} style={{ flex: 1 }}>
      <PressableCard depth={3}>
        <View style={{ paddingVertical: 11, paddingHorizontal: 8, alignItems: 'center' }}>
          <Text style={{ fontFamily: font.display, fontSize: 23, color: tint ?? colour.ink }}>{value}</Text>
          <Text style={{ fontFamily: font.bodyHeavy, fontSize: 11, color: colour.muted, letterSpacing: 0.5 }}>
            {label}
          </Text>
        </View>
      </PressableCard>
    </View>
  );
}

export default function Home() {
  const router = useRouter();
  const { t } = useLanguage();
  const [known, setKnown] = useState(0);
  const [streak, setStreak] = useState<Streak>({ days: 0, lastDate: null });
  const [track, setTrack] = useState<Track>('words');
  const [progress, setProgress] = useState<Record<string, Progress>>({});

  // Refresh on every focus, so finishing a round updates these immediately.
  useFocusEffect(useCallback(() => {
    (async () => {
      const [db, s, chosen] = await Promise.all([loadProgress(), loadStreak(), loadTrack()]);
      const all = Object.values(db.progress);
      setTrack(chosen);
      // The same measure the stats screen calls Conocidas: three correct in
      // *each* direction. It used to be box >= 4 here, which is a different,
      // looser thing wearing the same label. The looser count returns in 3b
      // as `dominadas`, on the level card, where it is the unlock gate.
      setKnown(all.filter((p) => isKnown(p)).length);
      setStreak(s);
      setProgress(db.progress);
    })();
  }, []));

  // Derived from live state rather than set once on focus, so tapping the
  // toggle updates it immediately instead of waiting for the next focus.
  const today = todayISO();
  const mine = new Set(WORDS.filter((w) => w.track === track).map((w) => w.id));
  const due = Object.values(progress).filter((p) => mine.has(p.id) && isDue(p, today)).length;
  const waiting = due > 0 ? t.home.waiting(due) : t.home.caughtUp;
  const open = unlockedThrough(WORDS, progress, track);
  const stats = levelStats(WORDS, progress, track, open);
  const levelTitle = levelName(track, open) ?? '';
  const nextName = levelName(track, open + 1);

  return (
    <Screen edges={['top']}>
      <View style={{ flex: 1, paddingHorizontal: space.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: space.md }}>
          <Chip>
            <Svg width={17} height={17} viewBox="0 0 24 24">
              <Path
                d="M12 2c1 4-2 5-2 8a4 4 0 0 0 8 0c0-1-.4-2-1-3 2 2 3 4.5 3 7a8 8 0 0 1-16 0c0-4.5 3-8 8-12z"
                fill={colour.marigold} stroke={colour.ink} strokeWidth={1.7} strokeLinejoin="round"
              />
            </Svg>
            <Text style={{ fontFamily: font.bodyHeavy, fontSize: 15, color: colour.ink }}>{streak.days}</Text>
          </Chip>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: space.sm }}>
          {TRACKS.map((id) => {
            const on = id === track;
            const lvl = unlockedThrough(WORDS, progress, id);
            return (
              <Pressable
                key={id}
                onPress={() => { cue('tap'); setTrack(id); void saveTrack(id); }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${t.track[id]}, ${t.level.line(lvl, levelName(id, lvl) ?? '')}`}
                style={{
                  flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center',
                  borderRadius: radius.button, backgroundColor: on ? colour.surface : colour.ground,
                  ...outline,
                }}
              >
                <Text style={{ fontFamily: font.display, fontSize: 17, color: colour.ink }}>{t.track[id]}</Text>
                <Text style={{ fontFamily: font.bodyHeavy, fontSize: 11, color: colour.muted, letterSpacing: 0.5 }}>
                  {t.level.line(lvl, levelName(id, lvl) ?? '')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          accessible
          accessibilityLabel={`${t.level.line(open, levelTitle)}. ${t.level.desc[track][open - 1] ?? ''}. ${t.level.dominadas(stats.dominadas, stats.total)}${nextName !== null ? ` ${t.level.next(nextName)}` : ''}`}
        >
          <PressableCard depth={3} style={{ marginTop: space.sm }}>
            <View style={{ paddingVertical: 10, paddingHorizontal: 14 }}>
              <Text style={{ fontFamily: font.bodyHeavy, fontSize: 11, color: colour.muted, letterSpacing: 0.5 }}>
                {t.level.line(open, levelTitle)}
              </Text>
              <Text style={{ fontFamily: font.body, fontSize: 14, color: colour.ink, marginTop: 2 }}>
                {t.level.desc[track][open - 1] ?? ''}
              </Text>
              <View style={{ marginTop: 6 }}>
                <Meter value={stats.dominadas} max={stats.total} tint={colour.cactus} />
              </View>
              <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, marginTop: 4 }}>
                {t.level.dominadas(stats.dominadas, stats.total)}
                {nextName !== null ? ` · ${t.level.next(nextName)}` : ''}
              </Text>
            </View>
          </PressableCard>
        </View>

        <View style={{ alignItems: 'center', marginTop: space.sm }}>
          <Bunting />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{
            backgroundColor: colour.surface, borderWidth: 2, borderColor: colour.ink,
            borderRadius: 18, paddingVertical: 10, paddingHorizontal: 18, maxWidth: 300,
          }}>
            <Text style={{ fontFamily: font.display, fontSize: 19, color: colour.ink, textAlign: 'center' }}>
              {waiting}
            </Text>
          </View>
          <View style={{ marginTop: space.sm }}>
            <Pepe pose="hero" motion="breathe" size={200} />
          </View>
        </View>

        <PressableCard
          depth={5}
          face={colour.chile}
          label="¡Vamos!"
          onPress={() => { cue('tap'); router.push('/session'); }}
        >
          <View style={{ height: 58, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.displayHeavy, fontSize: 25, color: colour.surface }}>¡Vamos!</Text>
          </View>
        </PressableCard>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: space.md, marginBottom: space.sm }}>
          <Stat value={String(known)} label={t.home.known} />
          <Stat value={String(due)} label={t.home.due} />
          <Stat value={String(mine.size)} label={t.home.total} />
        </View>
      </View>
    </Screen>
  );
}
