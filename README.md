# Pepe Habla

A Spanish vocabulary trainer, named after Pepe, a street dog from Mexico who
is the app's mascot. Mexican Spanish, English glosses, Leitner scheduling.

## Practising

In Claude Code, type `/practice`. You get ten words as multiple-choice
questions — click, don't type — and your answers are recorded.

By hand:

```bash
node src/cli.ts pick      # today's ten, as JSON questions
node src/cli.ts stats     # where you stand
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
src/core/       pure logic — no I/O, no node: imports
  types.ts      shared shapes
  dates.ts      ISO date arithmetic, in UTC
  leitner.ts    boxes, intervals, applying an answer
  select.ts     choosing the day's words
  quiz.ts       building multiple-choice questions
  rng.ts        seeded randomness
src/storage/
  store.ts      the VocabStore interface
  fileStore.ts  the Node adapter
src/cli.ts      session driver
data/seed/      the word list, by tier
data/vocab.json your progress — the part that matters
log/            one file per session
```

`src/core/` imports nothing from `node:` and touches no files. That is
deliberate: to put this on the web or in an Expo app, import `src/core/`
unchanged and write a new `VocabStore` — `localStorage`, `AsyncStorage`,
SQLite, or a fetch-backed one. Scheduling, selection, distractor generation
and grading all come along for free.

## Development

```bash
npm test         # node:test, no framework
npm run typecheck
```

Node 24 runs the TypeScript directly, so there is no build step. The only
dependency is TypeScript itself, for typechecking.

## Adding words

Drop them into `data/seed/tier*.json`. Ids must be unique across all files —
`loadWords` throws if they are not. Nouns carry their article (`el abrigo`),
because the gender is part of what you are learning.
