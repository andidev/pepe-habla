# Pepe Habla — design

**Status:** approved for planning; visual and audio design settled against
working mockups
**Date:** 2026-09-19

A Spanish vocabulary trainer for iOS and Android, built on the pure-TypeScript
core in this repository. Named after Pepe, a street dog from Mexico, who is the
app's mascot and whose illustrated likeness supplies both the animation and a
question type.

## Goals

- Practising feels fast and good enough to do daily. Under two minutes for the
  minimum session.
- Every answer is a tap. Never type a Spanish word.
- Scheduling adapts per word, so hard words come back more often than easy ones.
- Grow to roughly 2,500 words across 8 gated levels and ~28 themes.
- The app runs on the phone and owns the data.

## Non-goals

Explicitly out of scope, to keep this from turning into Duolingo:

- Accounts, login, cloud sync, or any backend. The app is offline and local.
- Social features, leaderboards, XP, gems, leagues.
- Grammar drills or conjugation tables as a separate exercise type. Grammar
  arrives as vocabulary: `comí` is a card like any other.
- Speech recognition. Text-to-speech only.
- Web deployment. The core stays portable, but nothing ships to a browser now.

## Architecture

npm workspaces. No new build tooling beyond what Expo brings.

The layout below is the end state. Phase 1 ships with today's `leitner.ts`
still in place; phase 3 swaps in `scheduler.ts` behind the same call sites.

```
packages/core/       pure TypeScript — no I/O, no node:, no react
  types.ts           Word, Progress, Question, Session
  dates.ts           ISO date arithmetic in UTC
  scheduler.ts       SM-2: ease, intervals, grading  (replaces leitner.ts in phase 3)
  select.ts          choosing a round's words
  quiz.ts            building questions and distractors
  session.ts         the session state machine (pure reducer)
  stats.ts           derived statistics
  levels.ts          unlock rules
  rng.ts             seeded randomness
apps/mobile/         the Expo app
  app/               expo-router screens
  components/        Pepe, ProgressBar, OptionButton, ...
  audio/             generated sound effects
  assets/pepe/       extracted sprites
  storage/           AsyncStorage adapter implementing VocabStore
tools/
  extract-sprites.py cut sprites from the sheets
  make-sounds.py     synthesise the sound effects
  validate-words.ts  duplicate and format checks on seed data
  cli.ts             existing CLI, retained for authoring
data/seed/           the word list, by level
```

**The rule that makes this work:** `packages/core` imports nothing from `node:`,
`react`, or `react-native`, and touches no files. That is what let this port be
cheap, and it is what keeps a web build cheap later.

**The session is a pure state machine.** Round progression, the repair queue,
elastic continuation and scoring all live in `core/session.ts` as a reducer over
plain data. The UI dispatches events and renders state. This is deliberate: it
means the part most likely to have subtle bugs is unit-testable without a
simulator.

## Data model

```ts
interface Word {
  id: string;
  es: string;
  en: string;
  pos: PartOfSpeech;
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  themes: string[];        // ["comida", "casa"] — a word may carry several
  sprite?: string;         // asset key, when Pepe art exists for this word
  note?: string;           // usage, Mexico-vs-Spain, gender traps
}

interface Progress {
  id: string;
  // SM-2 state
  ease: number;            // 1.3 – 3.0, starts at 2.5
  interval: number;        // days until next due
  reps: number;            // consecutive correct; resets to 0 on a miss
  lapses: number;          // lifetime misses
  // history
  seen: number;
  right: number;
  wrong: number;
  rightEsToEn: number;     // for the honest "known" definition below
  rightEnToEs: number;
  lastSeen: string | null;
  dueOn: string;
}
```

Progress is keyed by word id. Words the learner has never seen have no Progress
record at all.

## Scheduling

SM-2, the algorithm behind Anki, simplified for binary input.

**Why not keep Leitner.** Fixed boxes give every word the same 1/2/4/8/16 ladder.
In practice some words need fifteen exposures and some need two, and a fixed
ladder cannot express that. SM-2 gives each word its own `ease`, so a word you
keep missing comes back faster permanently, not just once.

**Grading without extra taps.** SM-2 wants a four-point self-rating. The learner
is tapping multiple choice, so quality is derived from correctness and response
time:

| Outcome | Quality | Effect |
|---|---|---|
| Wrong | `again` | `reps = 0`, `ease -= 0.20`, due tomorrow, repeated this session |
| Correct, ≥ 3s | `good` | normal advance, ease unchanged |
| Correct, < 3s | `easy` | advance, `ease += 0.10` |
| Correct, > 30s | `good` | treated as distraction; never penalised |

`ease` is clamped to [1.3, 3.0].

**Interval progression** on a correct answer:

```
reps 1        → 1 day
reps 2        → 3 days
reps 3+       → round(interval * ease)      (* 1.3 extra on `easy`)
```

capped at 365 days. Intervals are always finite, so a mastered word still
resurfaces occasionally — which is what the learner asked for.

**On a miss**, `interval` resets to 0 and the word is due tomorrow, but `ease`
only steps down by 0.20, so its history is not thrown away.

## Sessions

A **round** is 10 questions. A session is one or more rounds.

```
start → round(10 questions) → score + Pepe reacts
      → repair: immediately re-ask everything missed this round
      → "¿Otra ronda?"  ──yes──> next round
                        ──no───> summary, streak updated
```

**Repair answers do not affect scheduling.** Getting a word right ten seconds
after being told the answer is recognition, not recall, and letting it promote
the word would corrupt every interval that follows. Repair exists to teach; only
the first answer to a word in a session counts for `ease`, `interval` and stats.

- The **streak requires one completed round.** Everything beyond is bonus.
- A missed day resets the streak to zero. There is no freeze, no repair, and
  nothing to buy — the number is only useful if it is true.
- Extra rounds first drain the due queue, then introduce new words.
- If nothing is due and no words remain unlocked, Pepe says so and offers a
  free-practice round drawn from known words instead.

**Round composition.** Due words first, ordered by most overdue. When fewer than
10 are due, top up with new words — and new words arrive **theme-clustered**: a
top-up of five draws all five from one theme, so they land as a coherent set.
From their second exposure onward they interleave with everything else.

This is deliberate. Blocked practice (all kitchen words together) produces better
in-session performance and worse week-later recall than interleaved practice.
Clustering only the *introduction* gets the coherence without paying that cost.

## Question types

All four use the same four-option tap UI. Distractors are drawn from the
learner's own vocabulary, preferring the same part of speech.

1. **es → en** — show `el taco`, pick the English. Recognition.
2. **en → es** — show "the taco", pick the Spanish. Production; harder.
3. **listen → en** — TTS speaks the Spanish, pick the English. No text shown.
4. **picture → es** — show Pepe's sprite for the word, pick the Spanish.
   Only for words with a `sprite`. Skips English entirely.

Mix per round: roughly 40% es→en, 30% en→es, 20% listen, 10% picture, adjusted
for availability.

**On a wrong answer**, the app shows the correct answer *and what the tapped
option actually means* — "you picked `la carne`, which is the meat" — then
speaks the correct word. A miss teaches two words instead of zero. This is free:
every distractor is already a real word with a known gloss.

## Visual design

Settled against interactive mockups rather than described: the canvas is at
`claude.ai/artifact/S8tv25GgxU6oJefCkYtnmc`, and `Session` there is a working
implementation of the round, animation included. It is the reference for phase 1.

**The governing idea: the interface borrows the cartoons' own drawing style.**
Every card, button and chip carries the same 2px near-black outline and flat
fill as Pepe himself, with hard offset shadows rather than blurred ones. This is
what stops the mascot looking pasted on top of a generic app, and it happens to
produce the chunky pressable button that makes tapping feel good.

**Palette**, drawn from the artwork:

| Token | Hex | Use |
|---|---|---|
| ground | `#FBF6EC` | page background, warm bone |
| surface | `#FFFFFF` | cards, option buttons |
| ink | `#1C1714` | outlines, body text |
| muted | `#6B6259` | secondary text |
| chile | `#D1453B` | primary action, wrong answers |
| cactus | `#2E7D5B` | correct answers, progress |
| marigold | `#E9A020` | streak, listen prompts |

**Type**: Fraunces for display (its soft and wonk axes give it character
without being a novelty face) over Figtree for interface text.

**The interface is in Spanish** — ¡Vamos!, Siguiente, ¿Otra ronda?, Se te
atragantan. Free immersion in the chrome, and reversible if it ever gets in
the way.

**Options are a full-width vertical list, never a 2×2 grid.** Both were built
and compared. The list wins on tapping (350×56 = 19,600px² per row against
170×92 = 15,640px² per cell, and a mis-tap has two neighbours rather than four)
and on reading (one flush-left scan line rather than a Z-pattern across ragged
centred text). It also survives long options: `el medio ambiente` wraps in a
170px cell but sits on one line at 18px across the full width. A grid remains
correct for a future four-images-pick-one question type, where cells hold
pictures rather than text.

## Motion

Transform-based, via react-native-reanimated on the UI thread. Timings below
are from the working mock, not invented.

| Moment | Motion |
|---|---|
| Waiting for an answer | breathing bob, translateY 0→-4px, 2.9s ease-in-out, looped |
| Correct | hop to -20px with squash to 0.93/1.09 and a 1.07/0.93 landing, 620ms |
| Wrong | head shake, ±5° with a 3px droop, 520ms |
| Round complete | celebration bob, -13px with a 2° roll, 1.15s looped |
| Feedback appearing | panel rises 16px and fades in, 260ms |
| Correct option revealed | pop to 1.045 and back, 340ms |
| Any button pressed | travels 3px down, shadow collapses to 1px |
| Progress bar | width eased over 420ms |

Every sprite animates about `transform-origin: 50% 100%` — squash and stretch
only reads as weight if the character pivots on the ground rather than its
middle.

`prefers-reduced-motion` disables all of it.

## Pepe

**Sprite extraction** (`tools/extract_sprites.py`, written and run): flood-fill
the background *inward from the border* rather than matching cream globally —
otherwise white artwork (his chest, a sugar skull, a sombrero highlight) punches
holes in the sprite. Dilate, label connected regions, drop those below a size
threshold, crop with padding, alpha out the background, then remove small
components touching the crop edge, which are bleed from the drawing next door.

First run produced **53 crops from 3 sheets**, of which 9 merged two or three
neighbouring drawings because they touch once dilated. **Phase 0 must fix this**
— most likely by reducing dilation and merging only components that overlap
vertically — and hand-name the full set. Twelve clean sprites are already cut
and in use by the mockups.

Each sprite gets a role: `idle`, `happy`, `sad`, `excited`, `sleeping`, or
`vocab:<word-id>` for the costume sprites that illustrate a word.

**Animation** is transform-based via react-native-reanimated, running on the UI
thread: bounce, squash on landing, tilt, wobble, slide-in, plus swapping the
sprite at the right beat. No Lottie, no sprite-sheet frame animation.

| Moment | Pepe |
|---|---|
| Idle / question showing | gentle breathing bob |
| Correct | `happy`, hop with squash-on-land |
| Wrong | `sad`, slow ear-droop tilt |
| Round complete, ≥ 8/10 | `excited`, bounce with confetti |
| Streak milestone | `excited`, bigger celebration |
| Nothing due | `sleeping` |

## Sound and haptics

Sound effects are **synthesised, not sourced** — `tools/make_sounds.py` (written;
the six WAVs are in `apps/assets/audio/`). Nothing is sampled, so there is no
licensing to track and every sound is a parameter rather than a file we are
stuck with.

The palette is **a small mariachi band**, modelled from scratch in the standard
library: vihuela and guitarrón as Karplus-Strong plucked strings, trumpets as
additive brass always voiced in parallel thirds, marimba as a struck bar with a
strong fourth harmonic, maracas as differenced noise.

**Everything sits in A major.** This matters more than any individual sound:
six effects in six unrelated keys read as a pile of beeps however well each is
made, while six sharing a tonal home read as one instrument. The harmony then
carries meaning — `correct` resolves upward onto the tonic, `wrong` falls a
fifth away from it, `levelup` is the full chord arriving.

| File | What plays | Length |
|---|---|---|
| `tap.wav` | one damped nylon string | 0.05s |
| `correct.wav` | marimba rising a fourth over a quiet vihuela chord | 0.49s |
| `wrong.wav` | guitarrón falling a fifth — a shrug, not a buzzer | 0.55s |
| `complete.wav` | marimba arpeggio, one shake, vihuela under it | 0.79s |
| `streak.wav` | the climb carried further, trumpet landing on top | 0.84s |
| `levelup.wav` | the whole band: trumpets in thirds over strum and bass | 1.08s |

A wrong answer must never be punishing. This is meant to be daily, and a harsh
failure sound is the fastest way to stop someone opening the app.

Played through `expo-audio`. Every sound pairs with an `expo-haptics` impact —
light on tap, success on correct, warning on wrong. Haptics do most of the work
on feel and cost nothing.

A mute toggle lives in settings. Haptics stay on when sound is muted.

**Pronunciation** uses `expo-speech` with the `es-MX` voice: a speaker button on
every word, and automatic playback of the correct word after a miss.

## Screens

`expo-router`, three tabs.

**Home.** Pepe, the streak, how many words are due, one large *¡Vamos!* button.
Nothing else.

**Session.** Progress bar for the round, the question, four option buttons,
Pepe reacting below. After an answer: correct/incorrect state on the buttons,
the explanation line, a speaker button, and *Siguiente*.

**Stats.**
- Words known — right in *both* directions, `reps >= 3`
- Learned this week
- Current streak
- **Leeches** — highest `lapses`, still short-interval. The words actually
  blocking progress, which most apps hide.
- Level progress bar toward the 70% unlock
- The real Pepe, full width at the bottom with the ink border and a
  caption plate laid over the foot of the photo. The page scrolls.

**Words.** Every word practised, with accuracy, times seen, next due, and
current interval. Filterable by theme and level. Tapping one speaks it. A
theme can be launched as a deliberate themed session from here.

## Levels and themes

Two independent axes.

**8 levels** gate content. A level unlocks when **70% of the level below has
`reps >= 3`** — mastery, not exposure. Level 1 is unlocked at install.

| Level | Name | Words | Content |
|---|---|---|---|
| 1 | Callejero | ~200 | Top-200 frequency: core verbs, pronouns, connectives |
| 2 | Casa | ~250 | Food, home, body, family, time, numbers |
| 3 | Calle | ~300 | Travel, work, shopping, weather, city |
| 4 | Ayer | ~300 | Preterite and imperfect forms; feelings, opinions |
| 5 | Mañana | ~300 | Future and conditional; abstract nouns |
| 6 | Trabajo | ~350 | Work, money, health, bureaucracy, technology |
| 7 | Ideas | ~400 | Subjunctive triggers, argument, nuance |
| 8 | Mexicano | ~400 | Idioms, slang, regional usage |

**~28 themes** tag words across every level: `comida`, `animales`, `casa`,
`cuerpo`, `ropa`, `transporte`, `trabajo`, `dinero`, `salud`, `emociones`,
`tiempo`, `naturaleza`, `ciudad`, `escuela`, `tecnología`, `deporte`, `música`,
`familia`, `cocina`, `fiesta`, `viaje`, `gobierno`, `negocios`, `verbos`,
`conectores`, `números`, `saludos`, `slang`.

Themes do not gate anything. They drive browsing, themed sessions, and the
theme-clustered introduction of new words.

## Storage

`AsyncStorage`, behind the existing `VocabStore` interface. Progress is held in
memory during a session and written at round boundaries and on app background —
not on every answer, which would mean rewriting a ~500KB blob dozens of times a
minute at full vocabulary size.

If write latency becomes noticeable at full vocabulary size, the escape hatch is
`expo-sqlite`; the `VocabStore` interface means that swap touches one file.

**Migration.** On first run the app seeds progress from the existing
`data/vocab.json`, converting Leitner boxes to SM-2 state. A word in box N has N-1 consecutive
correct answers behind it, so box 1→`reps 0, interval 1`, box 2→`reps 1,
interval 1`, box 3→`reps 2, interval 3`, box 4→`reps 3, interval 8`, box
5→`reps 4, interval 16`. All start at `ease 2.5`.
The ten words already practised are not thrown away.

After that the phone is the sole source of truth. The repo keeps the word list;
`tools/cli.ts` is retained for authoring and validating seed data, not for
practising.

## Notifications

`expo-notifications`, local and scheduled — no push server, no tokens. One daily
reminder in the morning, time configurable in settings, defaulting to 08:00.

The body is specific rather than generic: *"12 words are due — keep your 9-day
streak"*. Specific reminders outperform nagging ones. Nothing fires if the day's
round is already done.

Requires a development build rather than Expo Go for reliable behaviour on both
platforms.

## Testing

**`packages/core` is tested thoroughly with `node:test`**, as it is today. That
covers the scheduler, selection, question building, the session state machine,
stats derivation and unlock rules — everything whose failure is silent. A
scheduler bug does not crash; it just quietly stops teaching you, which is why
these need tests rather than inspection.

**The app is verified in the simulator**, by hand and by screenshot. No React
Native component test harness — the session logic that would be worth testing
lives in core, and what remains is rendering.

`tools/validate-words.ts` runs over seed data: duplicate ids, duplicate Spanish,
missing fields, unknown themes, sprite keys that point at missing assets.

## Risks

**Vocabulary authoring is the biggest risk.** 2,500 hand-written entries, and a
wrong translation gets drilled in rather than caught. Mitigations: one level per
batch, the validator, and treating learner-reported errors as bugs to fix in the
seed data.

**Multiple choice inflates accuracy.** A blind guess is right 25% of the time.
Mitigated by defining "known" as correct in *both* directions with `reps >= 3`,
so the headline number is honest even though the scheduler is lenient.

**Response-time grading is a heuristic.** A fast tap can be a lucky guess. It
only ever moves `ease` by 0.10, so the cost of being wrong is small and
self-correcting.

**Sprite extraction quality is unknown until run.** Sheets are 765–768px wide,
so sprites land around 150–250px and may be soft at 3x. If so, the fallback is
displaying them smaller, or regenerating the sheets at higher resolution.

## Phases

| Phase | Scope |
|---|---|
| **0** | Monorepo restructure; extract and catalogue sprites; generate sounds |
| **1** | The app: home, elastic rounds, all four question types, Pepe, sound, haptics, TTS, wrong-answer explanations, repair rounds |
| **2** | Stats and word-list screens |
| **3** | SM-2 scheduler, levels and unlock gating, themes, vocabulary expansion |
| **4** | Morning notification |

Phase 1 carries the risk. The rest sit on top of it.

**This spec covers all five phases, but only phases 0 and 1 go into the first
implementation plan.** Phases 2 through 4 get their own plans once the app is
real and running on a phone — planning stats screens in detail before the
session loop exists would be guessing.

Note that phase 1 ships against the existing Leitner scheduler and the current
381 words; phase 3 replaces the scheduler and grows the data. This ordering is
deliberate — it gets something playable on the phone early, and keeps the
scheduler swap isolated from the UI work.
