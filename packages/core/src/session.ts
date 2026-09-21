import type { Direction, Question } from './types.ts';

/**
 * A practice session as a pure reducer.
 *
 * A round is a fixed list of questions. Miss one and it joins the repair queue,
 * which runs at the end of the round. When the round is done you may take
 * another — rounds are elastic, and only the first is needed for the streak.
 *
 * The rule that matters most: a repair answer is never recorded. Getting a word
 * right ten seconds after being shown the answer is recognition, not recall,
 * and letting it count would corrupt every interval the scheduler derives.
 * A question stays open until the right option is tapped; only the first tap is
 * recorded, so a word found by elimination still counts as missed.
 */
export type SessionPhase =
  | 'asking'
  | 'feedback'
  | 'repairing'
  | 'repair-feedback'
  | 'summary'
  | 'finished';

export interface AnswerRecord {
  wordId: string;
  direction: Direction;
  correct: boolean;
  /** Milliseconds from question shown to answer tapped. */
  ms: number;
  round: number;
}

export interface SessionState {
  round: number;
  queue: Question[];
  index: number;
  phase: SessionPhase;
  /** The option the learner tapped, or null while asking. */
  picked: string | null;
  /** Wrong options tapped on the current question, in order. They stay locked. */
  tried: string[];
  /** First answers only, across every round of this session. */
  results: AnswerRecord[];
  repair: Question[];
  repairIndex: number;
}

export type SessionEvent =
  | { type: 'answer'; option: string; ms: number }
  | { type: 'next' }
  | { type: 'anotherRound'; questions: Question[] }
  | { type: 'finish' };

export function startSession(questions: Question[]): SessionState {
  return {
    round: 1,
    queue: questions,
    index: 0,
    phase: questions.length > 0 ? 'asking' : 'summary',
    picked: null,
    tried: [],
    results: [],
    repair: [],
    repairIndex: 0,
  };
}

export function currentQuestion(state: SessionState): Question | null {
  if (state.phase === 'asking' || state.phase === 'feedback') {
    return state.queue[state.index] ?? null;
  }
  if (state.phase === 'repairing' || state.phase === 'repair-feedback') {
    return state.repair[state.repairIndex] ?? null;
  }
  return null;
}

export function reduce(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case 'answer':
      return answer(state, event.option, event.ms);
    case 'next':
      return advance(state);
    case 'anotherRound':
      // Only from the summary. Accepting it mid-round would discard the repair
      // queue without a trace, and accepting it after `finish` would make a
      // finished session un-finish itself.
      if (state.phase !== 'summary') return state;
      return {
        ...state,
        round: state.round + 1,
        queue: event.questions,
        index: 0,
        phase: event.questions.length > 0 ? 'asking' : 'summary',
        picked: null,
        tried: [],
        repair: [],
        repairIndex: 0,
      };
    case 'finish':
      return { ...state, phase: 'finished', picked: null, tried: [] };
  }
}

function answer(state: SessionState, option: string, ms: number): SessionState {
  const question = currentQuestion(state);
  if (question === null) return state;
  if (state.phase !== 'asking' && state.phase !== 'repairing') return state;
  if (state.tried.includes(option)) return state;

  const correct = option === question.answer;
  // Only the first tap on a question is recall. Repair records nothing at all.
  const firstTap = state.tried.length === 0;
  const records = state.phase === 'asking' && firstTap;

  const results = records
    ? [...state.results, {
        wordId: question.word.id,
        direction: question.direction,
        correct,
        ms,
        round: state.round,
      }]
    : state.results;
  const repair = records && !correct ? [...state.repair, question] : state.repair;

  if (!correct) {
    return { ...state, tried: [...state.tried, option], results, repair };
  }
  return {
    ...state,
    phase: state.phase === 'asking' ? 'feedback' : 'repair-feedback',
    picked: option,
    results,
    repair,
  };
}

function advance(state: SessionState): SessionState {
  if (state.phase === 'feedback') {
    const index = state.index + 1;
    if (index < state.queue.length) {
      return { ...state, index, phase: 'asking', picked: null, tried: [] };
    }
    return state.repair.length > 0
      ? { ...state, index, phase: 'repairing', repairIndex: 0, picked: null, tried: [] }
      : { ...state, index, phase: 'summary', picked: null, tried: [] };
  }

  if (state.phase === 'repair-feedback') {
    const repairIndex = state.repairIndex + 1;
    return repairIndex < state.repair.length
      ? { ...state, repairIndex, phase: 'repairing', picked: null, tried: [] }
      : { ...state, repairIndex, phase: 'summary', picked: null, tried: [] };
  }

  return state;
}

const tally = (records: AnswerRecord[]) => ({
  right: records.filter((r) => r.correct).length,
  total: records.length,
});

export const roundScore = (state: SessionState) =>
  tally(state.results.filter((r) => r.round === state.round));

export const sessionScore = (state: SessionState) => tally(state.results);
