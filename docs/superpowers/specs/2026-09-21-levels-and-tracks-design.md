# Pepe Habla — Levels, Tracks and Scheduling (phase 3)

**Status:** design approved in conversation, 2026-09-21.

**Amends:** `2026-09-19-pepe-habla-design.md` — the sections *Levels and themes*
and *Scheduling*, and its phase 3 delivery. Also `2026-09-21-language-and-game-flow-design.md`
§1 on reviewing Swedish content. Where they disagree, this document wins.

## Why

The original design put grammar inside the one level ladder: levels 4–7 were
past tense, future and subjunctive, and level 8 was slang. So a learner who
only wanted vocabulary could not reach it without clearing the subjunctive
first, and a learner keen on verbs could not reach the verbs without first
grinding three levels of nouns.

This splits the ladder in two. Words and grammar are separate tracks, each
with its own levels, and climbing one never requires climbing the other.

## 1. Two tracks

Every card belongs to exactly one track:

| Track | Name in the app | Cards | Levels |
|---|---|---|---|
| `words` | Palabras | ~2,500 vocabulary items | 8 |
| `grammar` | Gramática | ~600 conjugated forms and patterns | 6 |

`Word` gains a required `track: 'words' | 'grammar'` and a required `level`
within that track. Required, so a card with no track is a compile error rather
than a card that silently never appears.

`level` replaces the existing `tier` field, which is removed. Anything that
reads `tier` today — `selectDaily`'s ordering, the seed validator — moves to
`level` in plan 3b.

**Grammar is cards, not a new exercise.** A grammar card is a Spanish form and
its meaning in the learner's language — `comí` ↔ "I ate" / "jag åt". It uses
the same question types, the same retry loop, the same toasts and the
same scheduler as a word. No new screen or question type.

**Grammar never depends on words.** Grammar cards are built from the ~40 most
common verbs, all of which sit in words level 1. So grammar can be climbed
from day one without the words track mattering, and neither track ever gates
the other.

### Words ladder — 8 levels, 2,500 cards

Ordered by frequency within each level; themes cut across all of them.

| Level | Name | Cards | Content |
|---|---|---|---|
| 1 | Callejero | 200 | The top 200 by frequency: core verbs, pronouns, connectives |
| 2 | Casa | 250 | Home, food, body, family, time, numbers |
| 3 | Calle | 300 | The street: transport, directions, weather, the city |
| 4 | Mercado | 300 | Shopping, money, cooking, clothes |
| 5 | Trabajo | 350 | Work, school, health, the office |
| 6 | Ciudad | 350 | Travel, services, bureaucracy, technology |
| 7 | Ideas | 375 | Opinions, feelings, argument, abstract nouns |
| 8 | Mexicano | 375 | Regional usage, slang, idioms in everyday speech |

The existing 384 words are re-levelled into this scheme by frequency. Most land
in levels 1–2; a few current tier-3 words (`el desarrollo`, `la contaminación`)
move up to where they belong.

### Grammar ladder — 6 levels, ~600 cards

| Level | Name | Cards | Content |
|---|---|---|---|
| 1 | Ahora | 100 | Present tense of the core verbs, all persons |
| 2 | Ayer | 100 | Preterite — *comí, fui, hice, dijo* |
| 3 | Antes | 100 | Imperfect, and when to use it over the preterite |
| 4 | Mañana | 100 | Future and conditional — *iré, haría, podremos* |
| 5 | Ojalá | 100 | Subjunctive and the phrases that trigger it — *ojalá que, para que* |
| 6 | Dichos | 100 | Fixed expressions built on grammar — *acabar de, volver a, tener que* |

### Level names

Levels are named, and the names are Spanish proper nouns in every app language
— "Nivel 3 · Calle". The one-line description under each name is translated
through `apps/app/i18n/strings.ts` like any other interface text.

## 2. Unlocking

Level 1 of each track is open at install. A level opens when **70% of the
level below it, in the same track, has `reps ≥ 3`** — three consecutive correct
first-tap answers.

This is deliberately looser than the stats screen's "known" (three correct in
*each* direction). Gating on "known" would mean roughly 140 rounds of review
before words level 2 opened. The gate measures that a level is well under way;
"Conocidas" on the stats screen stays the strict, honest figure.

The level card shows progress toward the gate as `dominadas`, not
`conocidas`, so the two numbers are never confused.

## 3. Choosing a track

Home keeps one `¡Vamos!`. Above it sits a two-segment toggle —
*Palabras · Gramática* — each segment showing its current level. The choice
is remembered. The home screen's due count and level card follow the
selected track.

A round draws only from the selected track. The summary offers `¿Otra ronda?`
in the same track, and a second, quieter action to switch to the other.

The streak counts a completed round in **either** track.

## 4. Themes

Unchanged from the original spec: about 28 themes (`comida`, `animales`,
`casa`, `cuerpo`, `ropa`, `transporte`, `trabajo`, `dinero`, `salud`,
`emociones`, `tiempo`, `naturaleza`, `ciudad`, `escuela`, `tecnología`,
`deporte`, `música`, `familia`, `cocina`, `fiesta`, `viaje`, `gobierno`,
`negocios`, `verbos`, `conectores`, `números`, `saludos`, `slang`), as tags
on words-track cards. Grammar cards carry the tense or pattern as their theme
(`presente`, `pretérito`…).

Themes do not gate anything. They drive the word list's filter chips,
theme-clustered introduction of new words, and a themed session started from
the word list. Theme names are translated through `i18n/strings.ts`.

**Theme-clustered introduction:** when a round tops up with new cards, the new
ones come from a single theme, so they land as a set. From their second
exposure on, they interleave with everything else.

## 5. Scheduling — SM-2

Replaces Leitner, as the original spec describes, with one change forced by the
language spec's answer loop: **quality comes from the first tap only.** The
reducer already records only the first tap and its response time.

| First tap | Quality | Effect |
|---|---|---|
| Wrong | again | `reps = 0`, `ease -= 0.20`, due tomorrow |
| Right, ≥ 3 s | good | normal advance |
| Right, < 3 s | easy | advance, `ease += 0.10` |
| Right, > 30 s | good | treated as distraction, never penalised |

`ease` is clamped to 1.3–3.0. Intervals: 1 day, then 3, then
`round(interval × ease)` (× 1.3 on easy), capped at 365.

**Migration.** Existing progress carries a Leitner `box`. A word in box N has
N−1 consecutive correct answers behind it: box 1 → `reps 0, interval 1`,
box 2 → `reps 1, interval 1`, box 3 → `reps 2, interval 3`, box 4 →
`reps 3, interval 8`, box 5 → `reps 4, interval 16`, all at `ease 2.5`.
The direction counters and `knownOn` from phase 2 carry over untouched.
`migrateProgress` in core is extended rather than a second migration written.

## 6. Content and review

Claude authors every card's Spanish, English and Swedish. The seed validator
enforces the language spec's rules — a non-empty gloss in every language, and
no two cards sharing a gloss in the same language, which would make two
options identical — plus the new ones: every card has a track and a level in
range, and every words card has at least one known theme.

**Review is by playing, not by reading drafts.** This replaces the language
spec's step where Anders reviews the Swedish before merge. Content ships on
Claude's draft; when something is wrong in the app, Anders reports it and the
seed is corrected. The validator is what stands between a typo and the app.

## 7. Delivery

Three plans, each shipping usable on its own:

**3a — SM-2.** The scheduler in core, response-time grading from the first tap,
the Leitner migration. No visible change except that intervals start
adapting. Track-agnostic.

**3b — Tracks and levels.** `track` and `level` on `Word`; the 384 existing
words re-levelled and themed; grammar level 1 (*Ahora*, ~100 cards) so the
toggle has something behind it; unlock gating; the home toggle and summary
switch; level names and theme names in three languages; the word list's
theme and track filters; theme-clustered introduction.

**3c — Content.** The words ladder to 2,500 and the grammar ladder to ~600,
one level at a time, each level its own PR so the app keeps shipping.

## 8. Out of scope

- Mixed rounds drawing from both tracks at once.
- Themed sessions for grammar.
- Any gate between the two tracks.
- The morning notification (phase 4).
