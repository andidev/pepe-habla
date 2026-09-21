# Pepe Habla

A Spanish vocabulary trainer, named after Pepe, a street dog from Mexico who
is the app's mascot. Mexican Spanish, English glosses, Leitner scheduling.

## Practising

The app lives in `apps/app`, a native Expo app. Run it with:

```bash
npx expo start
```

In Claude Code, type `/practice`. You get ten words as multiple-choice
questions — click, don't type — and your answers are recorded.

By hand, from the command line:

```bash
npm run practice -- pick    # today's ten, as JSON questions
npm run practice -- stats   # where you stand
```

## How the scheduling works

Every word sits in one of five boxes. The box decides how long until you see
it again:

| Box | Comes back after |
|---|---|
| 1 | 1 day |
| 2 | 2 days |
| 3 | 4 days |
| 4 | 8 days |
| 5 | 16 days |

A right answer moves a word up one box. A wrong answer sends it straight back
to box 1 — not down one step. Half-forgotten words are worth over-practising,
and the cost of being wrong is only that you see an easy word tomorrow.

Each session fills ten slots from whatever is due, weakest box first and most
overdue first within a box. When fewer than ten are due, new words are
introduced from the lowest tier that still has any. So the words you keep
missing keep coming back, and the ones you have solid fade out.

## Layout

```
packages/core/src/  pure logic — no I/O, no node:/react/react-native imports
  types.ts          shared shapes
  dates.ts          ISO date arithmetic, in UTC
  leitner.ts        boxes, intervals, applying an answer
  select.ts         choosing the day's words
  quiz.ts           building multiple-choice questions
  session.ts        the practice-round reducer
  streak.ts         the daily streak
  rng.ts            seeded randomness (injected, never called internally)
tools/store/
  store.ts          the VocabStore interface
  fileStore.ts      the Node adapter
tools/cli.ts        session driver for the command line
data/seed/          the word list, by tier
data/vocab.json     your progress — the part that matters
apps/app/           the Expo app (see Practising above)
```

`packages/core/` imports nothing from `node:`, `react`, or `react-native`,
and touches no files. That is deliberate: `apps/app` already imports it
unchanged and pairs it with `AsyncStorage`; a future web target could do the
same with `localStorage`, SQLite, or a fetch-backed store. Scheduling,
selection, distractor generation and grading all come along for free.

## Development

```bash
npm test         # node:test, no framework
npm run typecheck
```

Node 24 runs the TypeScript directly, so there is no build step. The only
dependency is TypeScript itself, for typechecking.

Other npm scripts: `npm run practice` (the CLI driver above), `npm run
sprites`, `npm run sounds`, and `npm run speech` (Python tools that build the
app's art and audio assets).

## Adding words

Drop them into `data/seed/tier*.json`. Ids must be unique across all files —
`loadWords` throws if they are not. Nouns carry their article (`el abrigo`),
because the gender is part of what you are learning.
