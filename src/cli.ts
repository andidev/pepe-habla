/**
 * Session driver. Claude runs these commands; a human can too.
 *
 *   node src/cli.ts pick [count]           today's words, as JSON questions
 *   node src/cli.ts answer ser:1 ir:0 ...  record results (1 = right, 0 = wrong)
 *   node src/cli.ts stats                  where you stand
 *
 * All the interesting logic lives in src/core. This file is just plumbing.
 */
import { buildQuestions } from './core/quiz.ts';
import { selectDaily } from './core/select.ts';
import { applyAnswer, freshProgress, isDue, INTERVALS } from './core/leitner.ts';
import { mulberry32, seedFromDate } from './core/rng.ts';
import { todayISO } from './core/dates.ts';
import type { Box, Progress } from './core/types.ts';
import { fileStore, projectRoot } from './storage/fileStore.ts';

const DAILY_COUNT = 10;
const store = fileStore(projectRoot);

async function pick(count: number): Promise<void> {
  const today = todayISO();
  const [words, db] = await Promise.all([store.loadWords(), store.loadProgress()]);

  const selected = selectDaily(words, db.progress, today, count, mulberry32(seedFromDate(today)));
  const questions = buildQuestions(selected, words, mulberry32(seedFromDate(today) ^ 0x5f3759df));

  console.log(JSON.stringify({ date: today, questions }, null, 2));
}

async function answer(pairs: string[]): Promise<void> {
  const today = todayISO();
  const [words, db] = await Promise.all([store.loadWords(), store.loadProgress()]);
  const byId = new Map(words.map((w) => [w.id, w]));

  const rows: string[] = [];
  for (const pair of pairs) {
    const idx = pair.lastIndexOf(':');
    const id = pair.slice(0, idx);
    const flag = pair.slice(idx + 1);

    const word = byId.get(id);
    if (!word) throw new Error(`Unknown word id: "${id}"`);
    if (flag !== '0' && flag !== '1') throw new Error(`Expected ${id}:0 or ${id}:1, got "${pair}"`);

    const correct = flag === '1';
    const before: Progress = db.progress[id] ?? freshProgress(id, today);
    const after = applyAnswer(before, correct, today);
    db.progress[id] = after;

    rows.push(
      `| ${word.es} | ${word.en} | ${correct ? '✅' : '❌'} | ${before.box} → ${after.box} | ${after.dueOn} |`,
    );
  }

  await store.saveProgress(db);
  await store.appendSessionLog(
    today,
    [
      `## Session — ${today}`,
      '',
      '| Spanish | English | Result | Box | Next due |',
      '|---|---|---|---|---|',
      ...rows,
      '',
      '',
    ].join('\n'),
  );

  const right = pairs.filter((p) => p.endsWith(':1')).length;
  console.log(`Recorded ${pairs.length} answers — ${right} right, ${pairs.length - right} wrong.`);
}

async function stats(): Promise<void> {
  const today = todayISO();
  const [words, db] = await Promise.all([store.loadWords(), store.loadProgress()]);
  const all = Object.values(db.progress);

  const boxes = ([1, 2, 3, 4, 5] as Box[]).map((b) => ({
    box: b,
    every: `${INTERVALS[b]}d`,
    count: all.filter((p) => p.box === b).length,
  }));
  const seen = all.reduce((n, p) => n + p.seen, 0);
  const right = all.reduce((n, p) => n + p.right, 0);

  console.log(`Vocabulary:  ${words.length} words available`);
  console.log(`Introduced:  ${all.length}`);
  console.log(`Due today:   ${all.filter((p) => isDue(p, today)).length}`);
  console.log(`Accuracy:    ${seen === 0 ? '—' : `${Math.round((right / seen) * 100)}% of ${seen}`}`);
  console.log('');
  for (const b of boxes) {
    console.log(`  box ${b.box} (every ${b.every.padEnd(3)}) ${'█'.repeat(b.count).slice(0, 60)} ${b.count}`);
  }
}

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case 'pick':
    await pick(Number(rest[0] ?? DAILY_COUNT));
    break;
  case 'answer':
    if (rest.length === 0) throw new Error('Nothing to record. Try: answer ser:1 ir:0');
    await answer(rest);
    break;
  case 'stats':
    await stats();
    break;
  default:
    console.error('Usage: node src/cli.ts <pick [count] | answer id:1 id:0 ... | stats>');
    process.exit(1);
}
