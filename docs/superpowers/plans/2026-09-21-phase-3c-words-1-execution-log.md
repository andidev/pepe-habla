# SDD ledger — plan: docs/superpowers/plans/2026-09-21-phase-3c-words-1.md

Spec: `docs/superpowers/specs/2026-09-21-levels-and-tracks-design.md` §1, §4, §6 (read).
Branch: `claude/phase-3c-content`, off `main` after phase 3b merged (PR #6).
206 tests at the start and at the end — **no code changed on this branch at all**. One
JSON file, `data/seed/words-1.json`, plus the plan and this log.

Three tasks, three implementers, a content review after each, a whole-branch review and
one fix round. Words level 1 goes **78 cards to 200**, its budget. The seed goes 484 to 606.

Run on autopilot: the gates were answered without the owner, and every other discipline —
the validator, the reviews, the ledger, the fix loops — ran as it would have with him here.

## What a learner gets

*Callejero* is the only level open at install, and the level-2 gate needs 70% of it
mastered. It held 42 verbs, 21 adjectives, 14 adverbs and one noun. A learner could pass
the gate without meeting a single pronoun, question word or number.

- **Task 1** (`d15f3f9`) — 40 pronouns, question words and demonstratives. 78 to 118.
- **Task 2** (`2b44d4f`) — 42 nouns, the twelve numbers, the greetings. 118 to 160.
- **Task 3** (`b7a92b9`) — 40 connectives, quantifiers, prepositional phrases, adverbs. 160 to 200.
- **Fix round** (`f0184c9`) — the whole-branch review's findings.

## Rulings

**One plan per level, not one plan for 3c.** The spec delivers phase 3 content as
"plan 3c", but 14 levels and 3,100 cards in one plan is a plan nobody can review. Split
to one plan and one PR per level, this being the first of 14. *Cost if wrong:* 13 more
plan files than the spec anticipated.

**Three Criticals, all the same shape: a note that teaches the grammar backwards.**

- Task 1 — `su`'s note said possessives agree with the **owner**. They agree with the
  thing owned. A learner acting on it produces `sus libro`.
- Task 2 — `uno`'s note claimed Swedish `en`/`ett` and Spanish `un`/`una` "split gender
  the same way". They do not, and the claim was aimed at exactly the learner it would
  mislead: the Swedish-speaking child.
- Task 3 — `cuando` and `entonces` held **each other's** Swedish. The son would see `då`,
  tap `entonces` on correct instinct, and be marked wrong.

Each was caught by that task's content review and fixed before the next task started. The
third is the worst of the three: the first two teach a wrong fact, the third punishes a
right one. *Lesson carried forward:* a content review must fact-check every note
independently rather than read it for plausibility — all three read plausibly.

**Task 2 — `sí`'s note said "which Task 3 adds".** Build scaffolding in learner content.
Removed. A note is prose the child reads; it cannot name a task, a plan or a step.

**Whole-branch review — seven determiners answerable by elimination.** No per-task review
could see this: `buildQuestions` prefers same-`pos` distractors, and `mi`, `tu`, `su`,
`nuestro`, `este`, `ese`, `aquel` were `pos: adjective` in a pool of 77 that is otherwise
descriptive. Measured, not guessed: all three distractors were descriptive adjectives in
**50–56%** of questions for every one of the seven, in both directions. `den här` against
`triste`, `difícil`, `importante` is a tap a child makes without knowing the word — and
the level-2 gate counts `reps >= 3`, so the gate was easier than designed. Moved to
`other`, where the ~63-card function-word pool gives real competition; after the change,
**0%** in all fourteen card/direction pairs over 300 (`sv`) and 500 (`en`) seeds, with no
new trivial shape. This deviates from the plan's Steps 2 and 4, which named `adjective`;
the plan could not see the option pools and the simulation is the better evidence.
*Cost if wrong:* seven `pos` values, no id touched, progress unaffected.

**Whole-branch review — four accent twins taught from one side.** The plan required paired
words to point at each other. Honoured for `por qué`/`porque` and `sí`/`si`, missed for
`cómo`, `qué`, `cuándo`, `tú` — the forms the learner meets **first**, so the warning
arrived late or never. Fixed. `cómo`'s note teaches its twin outright, since unaccented
`como` is not a card anywhere in the seed; a note is prose, not a link.

**Whole-branch review — `esto`/`eso` taught for distance, not for the split.** A Swedish
child reads `den här`/`det här` as the common/neuter split he already knows; Spanish's is
masculine/feminine/neuter. The same trap family as `uno`'s Critical, one level down in
severity because nothing was stated backwards. `esto`'s note now says outright that the
`det` is not a gender clue.

Also fixed in that round: `ninguno` omitted that the shortening is before a *masculine*
noun (`uno`'s note got it right), `mal` never got the qualifier its twin `bien` got, and
`nosotros` had no `nosotras` note while `ellos` and `ellas` each carried one — the level
taught gendered "they" and ungendered "we".

## Verification

206 tests, 14/14 seed validator, typecheck clean at both roots, at every task boundary.
200 cards, no duplicate ids, every `pos` in the allowed six, every theme among the 28.
The **78 pre-branch cards are byte-identical** against `git show 118f017:data/seed/words-1.json`,
in the same order, with no id renamed — verified by the reviewer and again by the fixer.
That is the one thing that cannot be got wrong here: progress is keyed by `id`.

## Deferred findings

**The duplicate-`es` check should be track-scoped.** The validator rejects any repeated
Spanish string seed-wide. That already blocks legitimate homographs (`como` = "I eat" and
"as, like") and it will get worse: grammar adds ~500 conjugations, and `nada`, `vino`,
`cuenta`, `sale` and `llama` are all words twice over. It is also **costing content now** —
it forced `ninguno` into the awkward "inte en enda" because `nadie` holds "ingen". The fix
is to scope the Spanish check by track and keep the gloss checks seed-wide. Deliberately
not done inside a content plan. *For the next level's brief:* the check compares the whole
normalised string, so a **qualified** gloss is always free — never degrade a gloss to dodge
a duplicate.

**`hay` is absent from the whole 606-card seed**, and `de` is taught nowhere while this
level ships six `X de` phrases (`antes de`, `después de`, `dentro de`, `fuera de`,
`enfrente de`, `al lado de`). No basic preposition — `de`, `en`, `a`, `con`, `por`, `para` —
exists anywhere in the seed. For a level the spec defines as "the top 200 by frequency",
`hay` is the most conspicuous single omission: highest-frequency, invariant, trivially
teachable. The level is at budget, so closing this means displacing cards — Anders's call
once he has played it. `ahí` belongs in the same decision: it is missing while `aquí` and
`allí` are present, `ese` has no adverbial partner, and in Mexican Spanish `ahí` is the
most used of the three.

**`conectores` is 94 of 200 cards.** Theme-clustered introduction (§4) will therefore
deliver function words in large batches — a plausible eight are `tanto`, `tan`, `bastante`,
`varios`, `algunos`, `todos`, `poco`, `mucho`, which is the worst possible set for a child
to meet at once. There is no suitable existing theme to split the pronouns and question
words into: the 28 in `levels.ts` are all concrete domains, and forcing pronouns into
`familia` would be worse than the batching. A `pronombres` theme is a `levels.ts` change
plus a §4 amendment — a design change, and this was a content plan.

**`cada` ("varje") is the same defect as the seven determiners** — a determiner sitting in
the descriptive-adjective pool, which is why it appeared as a distractor in the before-run.
My ruling scoped the fix to seven and drew the line at "quantifiers", which put `cada` on
the wrong side of it. My scoping error, not the fixer's. One card of 200, and reopening a
fix wave to correct it is the churn the no-second-wave rule exists to prevent. Fixed in the
next level's plan together with **`mismo` ("samma", level 2)**, which has the same shape.

**Unaccented `como` has no card.** Its twin now teaches it in prose, but `que`, `cuando`
and `tu` each have both halves drilled and `como` does not. First candidate when level 1
next has room — and it needs the validator fix above to exist at all.

**Two id conventions across the accent pairs.** `cómo` took `como-pregunta`, reserving the
bare slug for its twin; `qué` and `cuándo` took the bare `que` and `cuando` and pushed the
connectives to `-conector`. Nothing is broken, but ids are keyed to progress and effectively
permanent, so the two conventions will collide the first time a relative `que` is added.

**`bueno` and `malo` carry theme `comida`** while their adverb twins `bien` and `mal` carry
`conectores`. Both are pre-branch cards, untouchable here. Good and bad filed under food is
a misfiling worth a pass of its own.

**Register and taste, all standing:** `ellos` → "de (killar eller blandad grupp)" is natural
child Swedish but clashes with the formal `usted` → "du (artigt)" beside it, and both restrict
the pronouns to people; `el centro` → "centrumet" (a Swede says "centrum" for downtown);
`el señor` → "herrn"; `todo`'s `pos`; `la forma`'s narrow sense split; `muy`'s Swedish
narrower than its English, though its note carries the full truth.

## What the next level inherits

- **Themes play no part in a question.** `buildQuestions` pools by `pos` and widens only
  when candidates run short. A theme affects *introduction order* and nothing else. The
  corollary is the determiner finding: `pos` is a pedagogical decision, not a taxonomic one.
- **Simulate the option pools before shipping a level.** Two reviews and three implementers
  read these 200 cards carefully and none of them saw the 50–56% giveaway, because it is
  invisible in the JSON. It took running `buildQuestions` over the real seed.
- **Fact-check every note independently.** Three Criticals on this branch were all notes
  that read perfectly well and were false.
- The `pos` sets, the 28 themes and the per-level budgets in `packages/core/src/levels.ts`
  are the contract; a content plan changes none of them.
