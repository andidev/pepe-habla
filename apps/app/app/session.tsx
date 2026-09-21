import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import {
  buildQuestions, bumpStreak, currentQuestion, gloss, mulberry32, optionMeaning,
  optionSpoken, promptSpoken, reduce, roundScore, seedFromDate, selectDaily,
  sessionScore, startSession, todayISO,
  type Direction, type GlossLanguage, type Progress, type Question, type SessionState,
  type Spoken, type Streak, type VocabDb,
} from '@pepe/core';
import { FeedbackToast, type ToastKind } from '../components/FeedbackToast';
import { OptionButton, type OptionState } from '../components/OptionButton';
import { Pepe } from '../components/Pepe';
import { PressableCard } from '../components/PressableCard';
import { PromptWord } from '../components/PromptWord';
import { Screen } from '../components/Screen';
import { cue, effectsOn, isMuted, say, stopSpeaking, type Voice } from '../feedback';
import { useLanguage } from '../i18n/language';
import type { Strings } from '../i18n/strings';
import { loadProgress, recordAnswers, saveProgress } from '../storage/progressStore';
import { loadStreak, saveStreak } from '../storage/streakStore';
import { VOCAB_ART, WORDS } from '../storage/vocabulary';
import { colour, font, radius, space } from '../theme';

const ROUND_SIZE = 10;
/** How long "try again" stays down. */
const WRONG_TOAST_MS = 2000;
/** The pause on a right answer before moving on, unless the learner taps. */
const ADVANCE_MS = 3000;
/** The right/wrong chimes last about 0.4 s; the countdown starts after one. */
const CUE_MS = 450;

export function buildRound(
  progress: Record<string, Progress>,
  today: string,
  round: number,
  glossLang: GlossLanguage,
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
  return buildQuestions(selected, WORDS, rng, glossLang);
}

const voiceFor = (s: Spoken, g: GlossLanguage): Voice => (s === 'es' ? 'es' : g);

const taskLabel = (t: Strings, d: Direction): string =>
  d === 'es->en' ? t.session.task.recognise
    : d === 'en->es' ? t.session.task.produce
      : t.session.task.picture;

interface Toast { kind: ToastKind; id: number; countdown: boolean }

export default function Session() {
  const router = useRouter();
  const { t, gloss: g } = useLanguage();
  const [state, setState] = useState<SessionState | null>(null);
  const [db, setDb] = useState<VocabDb | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [playing, setPlaying] = useState(false);
  const shownAt = useRef(Date.now());
  const counted = useRef<number>(0);        // rounds whose streak has been bumped
  // Every tap bumps this. An audio chain that finds it changed has been
  // interrupted and must not play its cue or start its countdown.
  const seq = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // `answering`/`state.tried` are only current as of the last render, so two
  // taps landing in the same frame (e.g. right then wrong, or the same wrong
  // option twice) would both pass the render-time guard in onAnswer. These
  // refs are updated synchronously inside onAnswer itself, so the second tap
  // sees the first tap's effect immediately.
  const settled = useRef(false);           // true once the right option lands for this question
  const triedThisFrame = useRef<Set<string>>(new Set());

  const clearTimers = useCallback(() => {
    for (const id of timers.current) clearTimeout(id);
    timers.current = [];
  }, []);
  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  // Leaving the round must leave nothing talking or ticking behind it.
  // Bumping seq first matters: stopSpeaking() resolves the pending say(), and
  // its .then must find the chain interrupted rather than cue and schedule an
  // advance on a screen that is gone.
  useEffect(() => () => {
    clearTimers();
    seq.current += 1;
    stopSpeaking();
  }, [clearTimers]);

  useEffect(() => {
    (async () => {
      const [loaded, s] = await Promise.all([loadProgress(), loadStreak()]);
      setDb(loaded);
      setStreak(s);
      // The language cannot change mid-round: settings is not reachable from here.
      setState(startSession(buildRound(loaded.progress, todayISO(), 1, g)));
    })();
  }, []);

  const question = state ? currentQuestion(state) : null;
  const answering = state?.phase === 'asking' || state?.phase === 'repairing';

  const playPrompt = useCallback((q: Question) => {
    const spoken = promptSpoken(q.direction);
    if (spoken === null) return;                     // a picture says nothing
    const id = ++seq.current;
    setPlaying(true);
    void say(q.prompt, voiceFor(spoken, g)).then(() => {
      if (seq.current === id) setPlaying(false);
    });
  }, [g]);

  // A new question: reset the clock and say it once. Keyed on position, not
  // just phase — a wrong tap leaves the phase and the word unchanged, and must
  // not replay the prompt.
  useEffect(() => {
    shownAt.current = Date.now();
    // A fresh question: neither ref's guard should carry over from the last one.
    settled.current = false;
    triedThisFrame.current = new Set();
    if (!question || !answering) return;
    setToast(null);
    playPrompt(question);
  }, [question?.word.id, state?.phase, state?.index, state?.repairIndex, state?.round]);

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

  const advance = useCallback(() => {
    clearTimers();
    seq.current += 1;
    stopSpeaking();
    setToast(null);
    settled.current = false;
    triedThisFrame.current = new Set();
    setState((s) => (s ? reduce(s, { type: 'next' }) : s));
  }, [clearTimers]);

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
      const questions = buildRound(current.progress, todayISO(), state.round + 1, g, seen);
      if (questions.length === 0) return;             // nothing left today
      setState(reduce(state, { type: 'anotherRound', questions }));
    };

    return (
      <Screen edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 }}>
          <Pepe pose="excited" motion="celebrate" size={168} />
          <Text style={{ fontFamily: font.displayHeavy, fontSize: 34, color: colour.ink, marginTop: space.sm }}>
            {t.summary.title}
          </Text>
          <Text style={{ fontFamily: font.body, fontSize: 16, color: colour.muted }}>
            {t.summary.firstTry(round.right, round.total)}
          </Text>
          {state.round > 1 && (
            <Text style={{ fontFamily: font.body, fontSize: 14, color: colour.muted, marginTop: 2 }}>
              {t.summary.wholeSession(session.right, session.total)}
            </Text>
          )}

          {missed.length > 0 && (
            <View style={{ width: '100%', marginTop: space.xl, backgroundColor: colour.surface, borderWidth: 2, borderColor: colour.ink, borderRadius: radius.card, padding: 16 }}>
              <Text style={{ fontFamily: font.bodyHeavy, fontSize: 12, color: colour.muted, letterSpacing: 1, marginBottom: 9 }}>
                {t.summary.toReview}
              </Text>
              {missed.map((w) => (
                <View key={w.id} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 9, marginBottom: 4 }}>
                  <Text style={{ fontFamily: font.display, fontSize: 19, color: colour.ink }}>{w.es}</Text>
                  <Text style={{ fontFamily: font.body, fontSize: 15, color: colour.muted }}>{gloss(w, g)}</Text>
                </View>
              ))}
              <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, marginTop: 5 }}>
                {t.summary.backTomorrow}
              </Text>
            </View>
          )}

          <PressableCard depth={5} face={colour.cactus} onPress={another} label={t.summary.anotherRound} style={{ width: '100%', marginTop: space.xl }}>
            <View style={{ height: 60, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: font.displayHeavy, fontSize: 22, color: colour.surface }}>{t.summary.anotherRound}</Text>
            </View>
          </PressableCard>

          <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ height: 52, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
            <Text style={{ fontFamily: font.bodyHeavy, fontSize: 16, color: colour.muted }}>{t.summary.doneForToday}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (!question) {
    return <View style={{ flex: 1, backgroundColor: colour.ground }} />;
  }

  const onAnswer = (option: string) => {
    if (!answering || state.tried.includes(option)) return;
    // `answering`/`state.tried` above are only as fresh as the last render,
    // so two taps in the same frame (right then wrong, or the same wrong
    // option twice) both pass that check. These refs are set synchronously
    // below, so the second tap in the pair sees the first tap's effect.
    if (settled.current || triedThisFrame.current.has(option)) return;
    const id = ++seq.current;
    clearTimers();
    setPlaying(false);

    const hit = option === question.answer;
    if (hit) settled.current = true;
    else triedThisFrame.current.add(option);
    const ms = Date.now() - shownAt.current;
    // Functional, so a second tap before a re-render reduces from the state the
    // first tap left, not a stale copy with nothing tried.
    setState((s) => (s ? reduce(s, { type: 'answer', option, ms }) : s));

    const toastId = Date.now();
    setToast({ kind: hit ? 'good' : 'bad', id: toastId, countdown: false });
    if (!hit) {
      later(WRONG_TOAST_MS, () => setToast((x) => (x?.id === toastId ? null : x)));
    }

    // Word first, then the verdict — hearing the word is the lesson.
    void say(option, voiceFor(optionSpoken(question.direction), g)).then(() => {
      if (seq.current !== id) return;               // interrupted by a newer tap
      cue(hit ? 'correct' : 'wrong');
      if (!hit) return;
      later(effectsOn() && !isMuted() ? CUE_MS : 0, () => {
        setToast((x) => (x?.id === toastId ? { ...x, countdown: true } : x));
        later(ADVANCE_MS, advance);
      });
    });
  };

  const optionState = (label: string): OptionState => {
    const tried = state.tried.includes(label);
    if (answering) return tried ? 'wrong' : 'idle';
    if (label === question.answer) return 'correct';
    return tried ? 'wrong-faded' : 'dimmed';
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
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t.session.exit} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
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
          {inRepair ? t.session.task.repair : taskLabel(t, question.direction)}
        </Text>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {question.direction === 'picture->es' && question.promptImage ? (
            <View style={{ backgroundColor: colour.surface, borderWidth: 2, borderColor: colour.ink, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 22 }}>
              <Image source={VOCAB_ART[question.promptImage]} style={{ width: 190, height: 190 }} resizeMode="contain" />
            </View>
          ) : (
            <PromptWord
              text={question.prompt}
              playing={playing}
              onPress={() => playPrompt(question)}
              label={t.session.listenAgain}
            />
          )}
        </View>

        <View style={{ gap: 10 }}>
          {question.options.map((option) => {
            const tried = state.tried.includes(option);
            return (
              <OptionButton
                key={option}
                label={option}
                state={optionState(option)}
                disabled={!answering || tried}
                detail={tried ? optionMeaning(question.direction, option, WORDS, g) ?? undefined : undefined}
                onPress={() => onAnswer(option)}
              />
            );
          })}
        </View>

        {/* Reserved whether or not the hint shows, so nothing above it moves. */}
        <View style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>
          {!answering && (
            <Text style={{ fontFamily: font.bodyHeavy, fontSize: 13, color: colour.muted }}>
              {t.session.tapToContinue}
            </Text>
          )}
        </View>
      </View>

      {toast !== null && (
        <FeedbackToast
          key={toast.id}
          kind={toast.kind}
          title={toast.kind === 'good' ? t.session.correct : t.session.tryAgain}
          subtitle={toast.kind === 'good' ? `${question.word.es} = ${gloss(question.word, g)}` : undefined}
          countdownMs={toast.countdown ? ADVANCE_MS : undefined}
        />
      )}

      {!answering && (
        <Pressable
          onPress={advance}
          accessibilityRole="button"
          accessibilityLabel={t.session.tapToContinue}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 }}
        />
      )}
    </Screen>
  );
}
