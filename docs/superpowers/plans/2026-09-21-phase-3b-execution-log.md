# SDD ledger — plan: docs/superpowers/plans/2026-09-21-phase-3b-tracks-and-levels.md

Spec: `docs/superpowers/specs/2026-09-21-levels-and-tracks-design.md` §1–§4, §6, §7 (read).
Branch: `claude/phase-3b-tracks-and-levels`, off `main` after phase 3a merged (PR #5).
Baseline 168 tests; 206 at the end. Nine tasks, nine implementers, a review after each,
a whole-branch review, one fix wave and one scoped re-review.

Run on autopilot for most of its length: gates were answered without the owner, and
every other discipline — the tests, the reviews, the ledger, the fix loops — ran as it
would have with him here.

## Pre-flight conflict scan

Fourteen rows checked, one defect found: Task 4's six new validator tests are shown
before the `misfiled` block they read, and `tools/seed/seed.test.ts` uses top-level
`await`, so the block must physically precede the `describe`. Carried into the dispatch.

## Rulings

**The plan set.** The spec's §7 names three plans in prose rather than a table, and the
fallback rule — "the plan files that name the spec" — would have ended autopilot after
3a, one plan into a three-plan spec. Took §7's enumeration as the set. *Cost if wrong:*
autopilot runs work the owner meant to sequence differently.

**Task 1 — three files the plan's list missed.** `session.test.ts` built `Word` fixtures
with `tier`, `vocabulary.ts` imported the seed by its pre-rename filenames, and
`fileStore.ts` had a coincidental `tiers` local. The second would have broken the app's
build, not just a test. Accepted all three: each is forced by the type change and the
alternative was committing a tree that does not build. My planning error — the same class
as 3a's missed `stats.test.ts`, and the lesson is to grep for every consumer of a field
being removed, not just the ones the spec names. *Cost if wrong:* three extra files in one
commit, all gated by a green suite.

**Task 3 — a pre-existing test was superseded, not weakened around.**
`introduces lower levels before higher ones` asserted a level-2 card is introduced with
nothing dominada below it, which is exactly what the gate forbids. My brief's "keep every
existing test" was written to protect the due-first ordering and the count cap and should
not have covered it. Rewrote it to keep its intent under the new rule. *Cost if wrong:* one
fixture; the behaviour is also covered by two adjacent tests.

**Task 3 — my replacement test was vacuous, and the implementer said so.** With `count: 1`
and one unseen card per level it passed with the gate removed *and* with the sort removed.
Rewrote the fixture larger and required a mutation proof before the commit: removing the
sort now fails it `[1,2,1,2,1]` against `[1,1,1,1,1]`. *Cost if wrong:* a test that still
does not discriminate, which the proof requirement exists to catch.

**Tasks 4 and 5 — `vocabulary.ts` imports the seed by literal path**, because Metro cannot
build paths dynamically. A new level file that nobody adds there is simply absent from the
app, and nothing would catch it: the validator reads the directory. Both dispatches carried
the instruction, and Task 4 added a test asserting what the app bundles equals what
`loadWords()` reads. *Cost if wrong:* five lines; without it, a whole level could go missing
silently.

**Task 4 — the `words.ts` split was accepted.** The implementer moved the JSON seed imports
out of `vocabulary.ts`, which keeps the Metro-only `require()`'d images. Not in the brief,
and correct: the bundling test I asked for imports the module under plain Node, where those
`require`s throw. My instruction created the problem; this is the right shape of fix.

**Task 5 — four Minor gloss findings went into the fix round with the two Important ones**,
against the skill's default of deferring Minors. All six were edits to one file in one pass,
and one of them — `den` to `det` across all twenty third-person cards — is what the
Swedish-learning child reads on every one of them.

**Task 7 — I ran the Expo Go pass myself** rather than dispatching it, as in 3a: two agents
have stalled over an hour on native builds in this repo.

**Task 7 — the static review found nothing above Minor; playing the screen found two
collisions it structurally could not see.** The bunting cut through the greeting card and
the ¡Vamos! button clipped Pepe's paws, both caused by the toggle and level card adding
~100pt of height. Neither is expressible as a code defect. This is the argument for keeping
a human-eyes pass on every screen task rather than trusting a diff.

**Task 7 — Pepe went 230 → 160 → 200.** The fix shrank him to 160, which left dead space
above and below and read as cramped rather than tidy. Played both and settled on 200, which
fills the column with ~30pt of clearance above the button. 230 is not available without
cutting something else. The owner green-lit it.

**Task 8 — the summary's switch action flipped the remembered track before knowing whether
the other track had a round**, so a tap that could not start anything still swapped the
persisted choice and the button's own label. Gramática is where it bites: 100 cards at one
level, so once they are scheduled forward the round genuinely is empty. Two lines, in a
snippet I wrote.

**Task 9 — the header's track scoping was refused on a false premise.** The implementer
said scoping `practisedOf` would need new copy; it takes numbers. Task 7 had fixed the same
defect on home for the same reason. Sent it back, along with a theme selection that survived
a change to the `all / due / known / tricky` row and could be silently invalidated by it.

**Final review — one fix wave for all four Important findings plus one dead default**, with
two proofs required rather than claimed: the strengthened `cluster` fixture red before green,
and every option's track printed for a real round on both tracks.

## Tasks

| # | Task | Commit | Outcome |
|---|---|---|---|
| 1 | The ladders as data, `Word` gains a track | `f3677a0` | review clean |
| 2 | The unlock gate | `c55c097` | review clean |
| 3 | A round from one track, open levels, one theme | `9c36127` | 1 fix round |
| 4 | Re-level and theme the 384 words | `343b7c0` | review clean |
| 5 | Grammar level 1 — *Ahora* | `0601529` | 1 fix round |
| 6 | The interface in three languages | `c414fac` | 1 fix round |
| 7 | The home toggle and the level card | `68ecdd9` | 1 fix round |
| 8 | A round follows the chosen track | `b0694ec` | 1 fix round |
| 9 | The word list filters by track and theme | `93f198c` | 1 fix round |
| — | Final review fix wave | `80e4462` | re-review clean |

## What the final review found

No Critical. It proved the data intact itself: all 384 records diffed field by field
against the merge base and keyed by `id` — 384 in, 384 out, zero changes to `id`, `es`,
`en`, `sv`, `pos`, `sprite` or `note`. It grepped for a second implementation of the gate
and found none, confirmed the due pile is built before `unlockedThrough` is called so the
gate cannot strand a card a learner has already met, and broke ten things in a scratch
worktree — the ratio, the empty-level guard, the reps threshold, the track filter, the
level cap, `cluster`, a misfiled word, an unbundled level file, a missing grammar import —
every one caught by a test.

**The finding that mattered: distractors were drawn from both tracks.** `selectDaily`
returned one track's cards, but `buildQuestions` got the whole 484-card seed and prefers
same-part-of-speech distractors. All 100 grammar cards are `pos: "verb"`, so they became
100 of the 226 verbs in the pool. A fresh learner's first Palabras question came out
**trabajar → we know / they see / to work / we think** — the answer is the only infinitive.
12–19 of every 40 options came from the wrong track, in both directions. Systematically
answerable by shape rather than meaning, which is the one thing a vocabulary trainer must
not allow, and this branch introduced it.

The fault is the plan's, not an implementer's: §8's "no mixed rounds" was read as being
about the cards drawn, not the options shown, and nothing in the plan considers what a
second track does to the distractor pool. **3c adds 500 more grammar cards to that pool and
must carry this explicitly.**

Three more, all one-liners, and two of them the third and fourth instance of a single class:
home's KNOWN tile still counted both tracks (Task 7 had fixed IN TOTAL, Task 9 the word
list's header), and the word list's theme survived the focus-driven track reset (Task 9's
fix round had closed the same hazard on the other writer). **The general rule, for 3c: when
a screen gains a track, every derived number and every dependent filter must follow it.**

It also found the one non-discriminating test in the branch — `select.test.ts`'s "a lower
level is exhausted before a higher one is touched" gave level 1 a single already-answered
card, so `fresh` held no level-1 card and the assertion proved nothing. Task 3's ruling had
caught exactly this failure mode once and rewritten that fixture; the sibling slipped through.

## Verification in Expo Go

iPhone 17 Pro, Expo Go, across Tasks 7, 8 and 9.

- The toggle switches instantly and the whole screen follows it: level card from
  *LEVEL 1 · Ahora / 0 of 100 mastered · Next: Ayer* to *LEVEL 1 · Callejero / 0 of 78
  mastered · Next: Casa*, and the due tile from 0 to 6, in the same tap.
- A Palabras round showed only vocabulary; the summary's quiet *Try Grammar instead?*
  started a Gramática round showing only conjugated forms; the streak went 0→1 from it,
  so it counts in either track as the spec asks.
- The word list's header reads "14 of 384" on Words against "0 of 100" on Grammar; an
  untouched Gramática shows the honest never-practised empty state; picking a theme and
  then tapping Tricky lands back on *All* with a coherent list.
- Metro bundles the `with { type: 'json' }` import attributes the `words.ts` split
  introduced — home reads 484 in total across the seven word files and the grammar file,
  so every seed file reaches the device.

## Deferred findings

- `select.test.ts`'s `word` fixture uses `themes: ['verbos']` where its neighbours use `[]`.
- Two `levels.test.ts` tests restate the ladder data more than they test behaviour.
- `unlockedThrough` re-derives the ratio instead of reading the `ratio` `levelStats` computed.
- `cluster` re-filters `fresh` for its widening path rather than taking a set difference.
- `select.ts` passes the unfiltered `words` to `unlockedThrough`, which filters by track itself.
- 10–15 of 384 themes are a nearest-available-bucket fit rather than a real one — `la razón`
  as `conectores`, `la idea` as `trabajo`, `caliente` as `comida`. Content taste.
- **The seed has no personal pronouns at all** — no `yo`, `tú`, `él`, in any part of speech,
  before or after this plan. The spec's level 1 is "core verbs, pronouns, connectives", so
  they are simply missing vocabulary. Task 4's mandate forbade adding words. **3c.**
- `llamarse` is absent and grammar level 1 is at its 100-card budget, so adding *me llamo*
  later means dropping three cards. A 3c decision.
- Some third-person-singular grammar cards drop the second sense their other four persons
  carry — `hace` loses "makes", `quiere` loses "loves".
- `jugar` and `dormir` ended up in words level 2 though the spec says grammar is built from
  level 1 verbs. Harmless: the tracks are independent by construction, which is the property
  that sentence exists to protect.
- The Spanish grammar level 6 description opens "Dichos:" under a level named *Dichos*.
- The three filter rows on the word list express "selected" differently — the oldest uses
  ink-on-surface, the two new ones surface-on-ground following home's convention.
- Home renders *LEVEL 1 · Callejero / 0 of 78 mastered* for one frame before progress loads,
  even for a learner at level 4 — a brief wrong level on the screen whose job is to tell
  them their level.
- `while (open < top)` means the empty-level wall does not apply at the top of the ladder:
  3 of words level 7's 4 cards dominada would open an empty level 8. Unreachable until 3c
  fills the middle. **Worth a line in 3c's plan.**
- When the other track has no round, the summary's switch action changes nothing and says
  nothing — a tap, a cue, silence. Gramática at one level is exactly where that lands.

## What 3c inherits

- **The distractor pool is now track-scoped, and 3c adds 500 grammar cards to it.** The plan
  must state that every question's options come from the drawn card's track.
- **When a screen gains a track, every number on it must follow.** Four instances in this
  plan; write it into 3c's constraints rather than finding a fifth.
- Words levels 6–8 hold 10 cards between them and grammar levels 2–6 hold none. The unlock
  gate treats an empty level as a wall, so nothing beyond them opens — correct, and the
  reason 3c ships one level per PR.
- The pronouns, and `llamarse`.
