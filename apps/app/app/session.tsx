import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  buildQuestions, bumpStreak, currentQuestion, mulberry32, optionMeaning, reduce,
  roundScore, seedFromDate, selectDaily, sessionScore, startSession, todayISO,
  type Progress, type Question, type SessionState, type Word,
} from '@pepe/core';
import { OptionButton, type OptionState } from '../components/OptionButton';
import { Screen } from '../components/Screen';
import { Pepe } from '../components/Pepe';
import { PressableCard } from '../components/PressableCard';
import { cue, speak } from '../feedback';
import { loadProgress, saveProgress, recordAnswers } from '../storage/progressStore';
import { loadStreak, saveStreak } from '../storage/streakStore';
import { VOCAB_ART, WORDS } from '../storage/vocabulary';
import { colour, font, radius, space } from '../theme';
import type { Streak, VocabDb } from '@pepe/core';

const ROUND_SIZE = 10;

export function buildRound(
  progress: Record<string, Progress>,
  today: string,
  round: number,
  exclude: ReadonlySet<string> = new Set(),
): Question[] {
  // Seeded by the day so a round is reproducible, and by the round number so a
  // second round is not the same ten words again.
  const rng = mulberry32(seedFromDate(today) ^ (round * 0x9e3779b9));
  // Words already answered this session are out — the seed alone cannot
  // separate rounds when ten or fewer words are due, because then every due
  // word is selected no matter what the rng says.
  const pool = exclude.size === 0 ? WORDS : WORDS.filter((w) => !exclude.has(w.id));
  const selected = selectDaily(pool, progress, today, ROUND_SIZE, rng);
  return buildQuestions(selected, WORDS, rng);
}

function Speaker({ onPress, big }: { onPress: () => void; big?: boolean }) {
  const size = big ? 54 : 22;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Escuchar la palabra"
      style={{
        width: big ? 190 : 48, height: big ? 130 : 48,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: big ? colour.marigold : colour.surface,
        borderWidth: 2, borderColor: colour.ink,
        borderRadius: big ? 22 : radius.pill,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M4 9v6h4l5 4V5L8 9z" fill={colour.ink} />
        <Path d="M16.5 8.5a5 5 0 0 1 0 7" stroke={colour.ink} strokeWidth={2} strokeLinecap="round" fill="none" />
      </Svg>
    </Pressable>
  );
}

const TASK_LABEL: Record<string, string> = {
  'es->en': 'ESCOGE LA TRADUCCIÓN',
  'en->es': '¿CÓMO SE DICE?',
  'picture->es': '¿QUÉ ES ESTO?',
};

export default function Session() {
  const router = useRouter();
  const [state, setState] = useState<SessionState | null>(null);
  const [db, setDb] = useState<VocabDb | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const shownAt = useRef(Date.now());
  const counted = useRef<number>(0);        // rounds whose streak has been bumped

  useEffect(() => {
    (async () => {
      const [loaded, s] = await Promise.all([loadProgress(), loadStreak()]);
      setDb(loaded);
      setStreak(s);
      setState(startSession(buildRound(loaded.progress, todayISO(), 1)));
    })();
  }, []);

  const question = state ? currentQuestion(state) : null;

  // Speak listening questions as soon as they appear, and reset the clock.
  useEffect(() => {
    shownAt.current = Date.now();
    // Only while asking or repairing. The dep array alone is not enough:
    // answering flips the phase without changing the word, which re-runs this
    // effect. Repair must speak too — for a listening question the prompt is
    // the audio, so skipping it here left repair silent.
    if (state?.phase !== 'asking' && state?.phase !== 'repairing') return;
  }, [question?.word.id, state?.phase]);

  // How many of state.results have reached storage. Counting answers rather
  // than rounds means a mid-round write and the summary write compose instead
  // of one blocking the other.
  const persisted = useRef(0);
  const latest = useRef<{ state: SessionState | null; db: VocabDb | null }>({ state: null, db: null });
  latest.current = { state, db };

  const persistAnswers = useCallback(async () => {
    const { state: s, db: current } = latest.current;
    if (!s || !current) return;
    const unwritten = s.results.slice(persisted.current);
    if (unwritten.length === 0) return;
    persisted.current = s.results.length;          // claim them before awaiting
    const next = recordAnswers(current, unwritten, todayISO());
    setDb(next);
    await saveProgress(next);
  }, []);

  // Leaving mid-round must not cost the learner the answers they gave.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void persistAnswers();
    });
    return () => {
      sub.remove();
      void persistAnswers();                        // also on unmount, e.g. the X
    };
  }, [persistAnswers]);

  // Bump the streak exactly once, when a round reaches its summary. The
  // `counted` ref is what stops a re-render from bumping the same round twice.
  useEffect(() => {
    if (!state || !streak) return;
    if (state.phase !== 'summary' || counted.current >= state.round) return;

    const fresh = state.results.filter((r) => r.round === state.round);
    if (fresh.length === 0) return;                 // nothing answered — no false streak
    counted.current = state.round;

    (async () => {
      await persistAnswers();
      const today = todayISO();
      const next = bumpStreak(streak, today);
      const grew = next.days > streak.days;
      setStreak(next);
      await saveStreak(next);
      // A longer streak is worth more noise than finishing a routine round.
      cue(grew && next.days % 5 === 0 ? 'streak' : 'complete');
    })();
  }, [state?.phase, state?.round]);

  const meaning = useMemo(() => {
    if (!state?.picked || !question) return null;
    return optionMeaning(question.direction, state.picked, WORDS);
  }, [state?.picked, question]);

  if (!state) {
    return <View style={{ flex: 1, backgroundColor: colour.ground }} />;
  }

  if (state.phase === 'summary' || state.phase === 'finished') {
    const round = roundScore(state);
    const session = sessionScore(state);
    const missed = state.repair.map((q) => q.word);

    const another = async () => {
      cue('tap');
      const current = db ?? await loadProgress();
      // Everything already answered this session is out, so another round is
      // genuinely new material rather than the same ten words reshuffled.
      const seen = new Set(state.results.map((r) => r.wordId));
      const questions = buildRound(current.progress, todayISO(), state.round + 1, seen);
      if (questions.length === 0) return;             // nothing left today
      setState(reduce(state, { type: 'anotherRound', questions }));
    };

    return (
      <Screen edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 }}>
          <Pepe pose="excited" motion="celebrate" size={168} />
          <Text style={{ fontFamily: font.displayHeavy, fontSize: 34, color: colour.ink, marginTop: space.sm }}>
            ¡Bien hecho!
          </Text>
          <Text style={{ fontFamily: font.body, fontSize: 16, color: colour.muted }}>
            {round.right} de {round.total} correctas
          </Text>
          {state.round > 1 && (
            <Text style={{ fontFamily: font.body, fontSize: 14, color: colour.muted, marginTop: 2 }}>
              {session.right} de {session.total} en toda la sesión
            </Text>
          )}

          {missed.length > 0 && (
            <View style={{ width: '100%', marginTop: space.xl, backgroundColor: colour.surface, borderWidth: 2, borderColor: colour.ink, borderRadius: radius.card, padding: 16 }}>
              <Text style={{ fontFamily: font.bodyHeavy, fontSize: 12, color: colour.muted, letterSpacing: 1, marginBottom: 9 }}>
                PARA REPASAR
              </Text>
              {missed.map((w) => (
                <View key={w.id} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 9, marginBottom: 4 }}>
                  <Text style={{ fontFamily: font.display, fontSize: 19, color: colour.ink }}>{w.es}</Text>
                  <Text style={{ fontFamily: font.body, fontSize: 15, color: colour.muted }}>{w.en}</Text>
                </View>
              ))}
              <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, marginTop: 5 }}>
                Vuelven mañana.
              </Text>
            </View>
          )}

          <PressableCard depth={5} face={colour.cactus} onPress={another} style={{ width: '100%', marginTop: space.xl }}>
            <View style={{ height: 60, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: font.displayHeavy, fontSize: 22, color: colour.surface }}>¿Otra ronda?</Text>
            </View>
          </PressableCard>

          <Pressable onPress={() => router.back()} style={{ height: 52, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
            <Text style={{ fontFamily: font.bodyHeavy, fontSize: 16, color: colour.muted }}>Terminar por hoy</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (!question) {
    return <View style={{ flex: 1, backgroundColor: colour.ground }} />;
  }

  const answering = state.phase === 'asking' || state.phase === 'repairing';
  const correct = state.picked === question.answer;

  const optionState = (label: string): OptionState => {
    if (answering) return 'idle';
    if (label === question.answer) return 'correct';
    if (label === state.picked) return 'wrong';
    return 'dimmed';
  };

  const onAnswer = (option: string) => {
    const ms = Date.now() - shownAt.current;
    const hit = option === question.answer;
    cue(hit ? 'correct' : 'wrong');
    if (!hit) speak(question.word);          // hear the right word after a miss
    setState(reduce(state, { type: 'answer', option, ms }));
  };

  const inRepair = state.phase === 'repairing' || state.phase === 'repair-feedback';
  const progress = inRepair
    ? 100
    : Math.round((state.index / state.queue.length) * 100);
  const counter = inRepair
    ? `${state.repairIndex + 1} / ${state.repair.length}`
    : `${Math.min(state.index + 1, state.queue.length)} / ${state.queue.length}`;

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: space.xl, paddingTop: space.md }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Salir de la ronda" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={19} height={19} viewBox="0 0 24 24">
            <Path d="M5 5l14 14M19 5L5 19" stroke={colour.muted} strokeWidth={2.6} strokeLinecap="round" />
          </Svg>
        </Pressable>
        <View style={{ flex: 1, height: 15, backgroundColor: colour.surface, borderWidth: 2, borderColor: colour.ink, borderRadius: radius.pill, overflow: 'hidden' }}>
          <View style={{ width: `${progress}%`, height: '100%', backgroundColor: colour.cactus }} />
        </View>
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 14, color: colour.muted }}>
          {counter}
        </Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: space.xl }}>
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 13, color: colour.muted, letterSpacing: 1, marginTop: 22, marginBottom: space.md }}>
          {state.phase === 'repairing' || state.phase === 'repair-feedback'
            ? 'OTRA VEZ, SIN PRISA'
            : TASK_LABEL[question.direction]}
        </Text>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {question.direction === 'picture->es' && question.promptImage ? (
            <View style={{ backgroundColor: colour.surface, borderWidth: 2, borderColor: colour.ink, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 22 }}>
              <Image source={VOCAB_ART[question.promptImage]} style={{ width: 190, height: 190 }} resizeMode="contain" />
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: 14 }}>
              <Text style={{ fontFamily: font.displayHeavy, fontSize: 44, color: colour.ink, textAlign: 'center' }}>
                {question.prompt}
              </Text>
              {question.direction === 'es->en' && <Speaker onPress={() => speak(question.word)} />}
            </View>
          )}
        </View>

        <View style={{ gap: 10, paddingBottom: space.md }}>
          {question.options.map((option) => (
            <OptionButton
              key={option}
              label={option}
              state={optionState(option)}
              disabled={!answering}
              onPress={() => onAnswer(option)}
            />
          ))}
        </View>
      </View>

      {!answering && (
        <Animated.View
          entering={FadeInDown.duration(260)}
          style={{ borderTopWidth: 2, borderTopColor: colour.ink, backgroundColor: correct ? colour.cactus : colour.chile }}
        >
          <View style={{ padding: space.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Pepe pose={correct ? 'happy' : 'sad'} motion={correct ? 'hop' : 'shake'} size={72} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.display, fontSize: correct ? 22 : 20, color: colour.surface }}>
                  {correct ? '¡Eso es!' : `La respuesta es ${question.answer}`}
                </Text>
                {!correct && meaning && (
                  <Text style={{ fontFamily: font.body, fontSize: 14, color: colour.surface, opacity: 0.92, marginTop: 2 }}>
                    Escogiste {state.picked}, que significa {meaning}.
                  </Text>
                )}
              </View>
            </View>
            <PressableCard onPress={() => { cue('tap'); setState(reduce(state, { type: 'next' })); }} style={{ marginTop: space.md }}>
              <View style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: font.display, fontSize: 19, color: colour.ink }}>Siguiente</Text>
              </View>
            </PressableCard>
          </View>
        </Animated.View>
      )}
    </Screen>
  );
}
