import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  buildQuestions, currentQuestion, mulberry32, optionMeaning, reduce,
  seedFromDate, selectDaily, startSession, todayISO,
  type Progress, type Question, type SessionState, type Word,
} from '@pepe/core';
import { OptionButton, type OptionState } from '../components/OptionButton';
import { Screen } from '../components/Screen';
import { Pepe } from '../components/Pepe';
import { PressableCard } from '../components/PressableCard';
import { cue, speak } from '../feedback';
import { loadProgress } from '../storage/progressStore';
import { VOCAB_ART, WORDS } from '../storage/vocabulary';
import { colour, font, radius, space } from '../theme';

const ROUND_SIZE = 10;

export function buildRound(
  progress: Record<string, Progress>,
  today: string,
  round: number,
): Question[] {
  // Seeded by the day so a round is reproducible, and by the round number so a
  // second round is not the same ten words again.
  const rng = mulberry32(seedFromDate(today) ^ (round * 0x9e3779b9));
  const selected = selectDaily(WORDS, progress, today, ROUND_SIZE, rng);
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
  'listen->en': 'ESCUCHA Y ESCOGE',
  'picture->es': '¿QUÉ ES ESTO?',
};

export default function Session() {
  const router = useRouter();
  const [state, setState] = useState<SessionState | null>(null);
  const shownAt = useRef(Date.now());

  useEffect(() => {
    (async () => {
      const db = await loadProgress();
      setState(startSession(buildRound(db.progress, todayISO(), 25)));
    })();
  }, []);

  const question = state ? currentQuestion(state) : null;

  // Speak listening questions as soon as they appear, and reset the clock.
  useEffect(() => {
    shownAt.current = Date.now();
    if (question && question.direction === 'listen->en') speak(question.word.es);
  }, [question?.word.id, state?.phase === 'asking']);

  const meaning = useMemo(() => {
    if (!state?.picked || !question) return null;
    return optionMeaning(question.direction, state.picked, WORDS);
  }, [state?.picked, question]);

  if (!state || !question) {
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
    if (!hit) speak(question.word.es);      // hear the right word after a miss
    setState(reduce(state, { type: 'answer', option, ms }));
  };

  const progress = Math.round((state.index / state.queue.length) * 100);

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
          {Math.min(state.index + 1, state.queue.length)} / {state.queue.length}
        </Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: space.xl }}>
        <Text style={{ fontFamily: font.bodyHeavy, fontSize: 13, color: colour.muted, letterSpacing: 1, marginTop: 22, marginBottom: space.md }}>
          {TASK_LABEL[question.direction]}
        </Text>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {question.direction === 'picture->es' && question.promptImage ? (
            <View style={{ backgroundColor: colour.surface, borderWidth: 2, borderColor: colour.ink, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 22 }}>
              <Image source={VOCAB_ART[question.promptImage]} style={{ width: 190, height: 190 }} resizeMode="contain" />
            </View>
          ) : question.direction === 'listen->en' ? (
            <Speaker big onPress={() => speak(question.word.es)} />
          ) : (
            <View style={{ alignItems: 'center', gap: 14 }}>
              <Text style={{ fontFamily: font.displayHeavy, fontSize: 44, color: colour.ink, textAlign: 'center' }}>
                {question.prompt}
              </Text>
              {question.direction === 'es->en' && <Speaker onPress={() => speak(question.word.es)} />}
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
