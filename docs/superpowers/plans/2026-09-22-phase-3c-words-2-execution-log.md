# SDD ledger — plan: docs/superpowers/plans/2026-09-22-phase-3c-words-2.md

Spec: `docs/superpowers/specs/2026-09-21-levels-and-tracks-design.md` §1, §4, §6 (read).
Branch: `claude/words-level-2`, off `main` after the validator track-scope fix merged (PR #11).
270 tests at the start and at the end — **no code changed on this branch.** One JSON file, plus
one field in `words-1.json`, plus the plan and this log.

Four tasks, four implementers, a review after each, a whole-branch review, four fix rounds.
Words level 2 — *Casa* — goes **127 → 250 cards**, its budget. The seed goes 668 → 699.

Run on autopilot: the gates were answered without the owner, and every other discipline — the
validator, the reviews, the ledger, the fix loops — ran as it would have with him here.

## What a learner gets

*Casa* is the second of eight levels, and the gate to level 3 needs 70% of it mastered. It held
127 cards with no `la casa`, nothing in the kitchen, no mother or father, and a seed that stopped
counting at ten.

- **Task 1** (`0d76cef`, fixed in `dfccd2a`) — the house: rooms, structure, furniture, the bed and
  bathroom, the appliances. Plus the two `pos` corrections carried from level 1.
- **Task 2** (`6754a0e`, fixed in `59ea45c`) — the kitchen and the food: staples, Mexican staples,
  the table, the pans, five cooking verbs.
- **Task 3** (`77cd833`, fixed in `6e4a5fb`) — the body and the family, plus `el horno`.
- **Task 4** (`6fd3d9c`) — the seven days, the twelve months, the clock, `once` through `quince`.

The Mexican register is the point and it holds throughout: `la recámara`, `el clóset`, `la cobija`,
`el refrigerador`, `la estufa`, `el bote de basura`, `la cochera`, `el tapete`, `el elote`,
`la tortilla` of corn, `los papás`, `mi cuarto`.

## The finding that should change what gets built next

**`Word.note` is rendered nowhere in the app.** Nothing reads the field — verified across
`apps/app`, `packages/core/src` and `tools`, where `note` appears in exactly one place: its own
declaration at `packages/core/src/types.ts:38`. **119 of 699 cards carry a note and not one reaches
a learner.** That includes the three Criticals fixed in level 1 and the five fixed in Task 1 here —
corrections to text nobody sees.

The specs intend otherwise. `2026-09-19-pepe-habla-design.md:85` defines the field as "usage,
Mexico-vs-Spain, gender traps", and `2026-09-21-language-and-game-flow-design.md:43` rules that
notes "stay English" — a decision that only makes sense if they are displayed.

Taking the reversible assumption: kept writing notes, because they are data and the intent is
unambiguous, but treated the `en` and `sv` glosses as **the only teaching surface that exists**.
That reasoning drove several decisions below, most visibly `la tortilla` → "tortillan (av majs)":
a Swedish child hearing bare *tortillan* pictures a supermarket wheat wrap, and the corn fact was
sitting in a note. Where the note UI should live is a design decision, not a content one. It wants
its own plan, and it would make 119 notes' worth of already-written teaching visible at a stroke.

93 of the 123 new cards carry a note — a great deal of well-researched prose written into a field
with no readers. Some of it is teaching that should be cards: `once`'s *dieci-* rule is the
clearest case.

## The other finding: the validator cannot see a comma

A question must have exactly one right answer. The duplicate check compares **whole** normalised
strings, so two cards can share a *comma-separated alternative* and pass — putting two correct
options on screen, one of which the app marks wrong. By `CLAUDE.md` only the first tap is ever
recorded and a repair never is, so each hit **permanently poisons that card's scheduling**.

Task 3 introduced one and the review caught it: `la esposa` ("the wife") against the pre-existing
`la mujer` ("the woman, **the wife**"), reaching a real question ~1.2% of the time in each
direction. Anders learns in English; given `prompt "the wife" -> la mujer / la esposa` there is no
correct tap.

Sweeping all 629 words-track cards for the pattern found **16 shared alternatives**, nearly all
predating this branch. Six can actually co-occur; the rest are split across `pos` pools and never
meet. Two of the six sat **entirely inside level 2** and were fixed here for the same reason the
Critical was:

- `enseñar` ("to teach, to show" / "att lära ut, att visa") against `mostrar` ("to show" /
  "att visa") — ambiguous in **both languages and both directions**, ~2.4%.
- `intentar` ("to try") against `probar` ("to try, to taste") — ~2.2%.

The remaining four cross into levels 1, 3, 4 and 5: `bastante`/`suficiente` on "enough" (4–5%, the
highest rate measured), `lo`/`la` on "it" and "den", `la gente`/`el pueblo`, `el número`/`la cifra`.
They belong to a plan of their own, which should come **before** more content levels, because every
level written until then can add more. The fix is the same shape as the track-scoping change that
shipped in PR #11: the rule is right, its comparison is too coarse.

## Rulings

**A gloss may narrow on a pre-branch card when the pre-branch gloss is what creates the defect.**
Applied three times — `la mujer`, then `la pierna`, then `enseñar` and `probar`. The branch
convention is that pre-branch cards may only gain a `note`; that convention protects `id`s, and
progress is keyed by `id`, not by glosses, so nothing is lost. Each time, leaving the old gloss
alone would have left a question with two right answers or an unanswerable prompt.
*Cost if wrong:* six narrowed glosses, each verified free across the whole track.

**Both halves of an ambiguous pair carry the qualifier.** `el hueso` was glossed "benet (i
skelettet)" against `la pierna`'s bare "benet". That works only when Spanish is the prompt; in the
other direction the *prompt* is the bare ambiguous "benet". `la pierna` now carries
"benet (kroppsdelen)", matching the `el techo`/`la azotea` precedent. The same rule then applied to
`el cuello`/`la garganta`, where Swedish *halsen* covers both neck and throat and the implementer
had put the fix in a note.

**A qualifier must teach, not merely make a string unique.** `el tapete` shipped as
"mattan (den lösa)" purely to get past the validator while `la alfombra` held bare "mattan" — and
at seed 33 a child got `mattan / mattan (den lösa) / ögat / presenten`: two buttons reading the
same. The real fix was the Swedish split, `heltäckningsmattan` against `mattan`. Contrast
`el segundo` → "the second (unit of time)", upheld: English genuinely flattens ordinal and unit,
there was no other card to dodge, and the bare Swedish `sekunden` is correctly left unqualified
because Swedish is not ambiguous there. The qualifier sits where the ambiguity is.

**`la mamá` and `el papá`, not `la madre` and `el padre`.** The forms cannot coexist under the
current gloss scheme. For a Mexico City ten-year-old this is not close: *mi mamá* is what he says,
*la madre* is load-bearing in Mexican slang, and teaching it as the neutral word — with the warning
in a note that renders nowhere — would have been the worse error. `los papás` over `los padres` for
the same reason, and because `los padres` collides with the priest sense. Both formal forms remain
free for a later level. *Cost if wrong:* a learner meets *madre* in writing before he has the card.

**Days and months are written bare and lowercase**, against the seed's "nouns carry their article"
convention, because `el lunes` means *on Monday* and `los lunes` means *on Mondays* — the article
changes the meaning rather than marking gender. The same argument carried into Swedish, where they
are indefinite (`måndag`, not `måndagen`). Nineteen cards, one note each carrying a *different*
fact, no repetition.

**The plan's simulation script tested half of practice, and that is my defect.** `planDirections`
computes `wantProduce = Math.round(n * 0.4)`; with a one-card batch that is **0**, so every question
the briefed script produced was `es->en`. Verified: 4000 questions, not one `en->es`. Production
questions are 40% of real practice and their four options are *Spanish* strings — a different pool,
where `la sal`/`la sala`, `la taza`/`la casa` and `freír`/`reír` would bite. Tasks 1 and 2 were
gated on the wrong half. Fixed in `9690e97` by padding the batch to ten and keeping the target's
question whichever bucket it lands in. The Task 2 reviewer had already covered the missing
direction by hand, so nothing shipped broken.

**`cocinar` stays at level 4** although its whole family — *freír*, *hervir*, *hornear*, *picar*,
*calentar* — is now in level 2. Real misfiling, but moving a card between levels changes which
level a learner first meets it in, and level 4 is not this plan's scope.

**`el vidrio`, not `el cristal`.** The brief named the Spain word for the material; the implementer
overrode it and was right.

**Two briefs of mine were simply wrong.** Task 4 was asked for `el minuto` and `temprano`; both are
already level-1 cards, so the duplicate check would have failed the commit. The work was right and
the brief was not.

## Verification

270 tests, 15/15 seed validator, typecheck clean at both roots, at every commit. 250 cards, 250
unique ids, every `pos` and theme valid.

**Data integrity is exact.** No `id` changed anywhere. The 127 pre-existing cards are byte-identical
in byte-preserved order except the four authorised fields: `mismo`'s `pos`, `la mujer`'s two glosses
and note, `la pierna`'s `sv`, and `la llave`'s added note. `words-1.json` differs by `cada`'s `pos`
alone.

**The pools were measured, not assumed.** The whole-branch reviewer sampled across all four tasks in
both directions and both gloss languages, and measured co-occurrence for nineteen confusable pairs —
`la sal`/`la sala`, `el hombro`/`el hombre`, `la taza`/`la casa`, `la mamá`/`la mañana`,
`el sofá`/`el sillón` and more. **Every one sits at 0.4–1.6%, the baseline rate for any two same-`pos`
cards in a ~300-noun pool.** Nothing clusters.

**The tightest cluster turned out not to be one.** Across 5,600 simulated day questions, 5.4% contain
even one other weekday and **0.0% contain two**; months, 12.4% and 0.5%. Because distractors come
from the whole 629-card track rather than the round, `miércoles` is asked against *småtimmarna*,
*nyheten* and *osten* — there is no category to eliminate by. A child cannot answer it without
knowing it. `mañana` and `la mañana` never co-occur at all (0.0% over 3,200 draws): they carry
different `pos`, so the same-`pos` preference keeps them apart.

**Zero false notes.** The whole-branch reviewer fact-checked all 93 notes on the new cards
independently, in three languages — etymologies, dates, grammar and register — and found none false.
After level 1 shipped three backwards and Task 1 here caught two more, that is the result this
branch is most worth remembering for.

## Deferred — for Anders

**The level counts to fifteen and then jumps to a hundred.** `once` through `quince` landed;
`veinte`, `treinta`, `cuarenta` and `cincuenta` did not, and 16–99 is absent from all 699 cards.
Against a spec that names "numbers" as one of six things level 2 is for, a child who can say
*quince* but not *veinte* cannot tell the time past quarter past, say a price, or say how old his
cousin is.

The level is closed at its 250 budget, so closing this gap means removing something. The reviewer
proposes two out, two in — **`la alfombra`** (CDMX houses have tile floors; fitted carpet is near
zero-utility, and its only remaining job is disambiguating `el tapete`, which stands alone once it
is gone) and **`el sillón`** (which in everyday Mexican speech often means the couch, overlapping
`el sofá`) — for **`veinte`** and **`treinta`**. Both removals are cards added on this branch, so no
learner history exists for either.

**Not taken, deliberately.** It reverses half of a carefully argued Task 2 ruling, and removing
cards to add cards is a content call — and content is reviewed by playing. If the swap is wanted,
`dieciséis` is the third card to add, because it is the only one that makes the *dieci-* pattern
visible now that the note teaching it reaches nobody.

## Other deferred findings

- **`tv:n`** (`la televisión`) is the only gloss in 699 cards containing a colon. Correct written
  Swedish, and Swedish TTS normally expands colon-definites, but it could not be confirmed without a
  device. If it reads wrong, `teven` is the fix. One to listen for.
- **Clothing has no garment at all.** `ropa` has three cards and not one is a thing you wear. Three
  notes cite *la camisa* and *los zapatos*, which appear on no card in the seed.
- **`el jitomate`** — Mexico City says *jitomate* for the red tomato and reserves *tomate* for the
  green tomatillo. The most Mexico-distinctive food word still missing; it belongs in *Mercado*.
- **`la copa` is absent**, so `el vaso`'s note carries the *vaso*/*copa* distinction as prose that is
  never practised. It should not be considered taught.
- **`la prima` and `la vecina` are absent** while `el primo` and `el vecino` are glossed neutrally
  ("the cousin", "the neighbor"). Nothing false — English and Swedish have no gendered word — but a
  child will produce `el primo` forever and never learn `la prima` exists. The repair is those two
  cards at a later level, not a qualifier here.
- **Theme-clustered introduction** will deliver the nineteen days and months within about two rounds,
  since `selectDaily` draws new cards from a single theme. Option pools are unaffected; this is
  pacing, not correctness.
- Register and taste, all standing: `el comedor` → *matsalen* reads as a school canteen to a Swedish
  child; `la galleta` → *småkakan* is narrower than *galleta*; `la salsa` teaches the salsa sense in
  English but not in Swedish; `el jabón`/`la sopa` is an unlucky English button pair for Anders.
- **If the note UI lands**, three gloss choices made *because* it has not should be revisited:
  `el vaso`, `el tapete`, and the reasoning behind `la galleta`.

## What the next level inherits

- **The glosses are the teaching surface.** Until notes render, anything a learner needs belongs on
  the button. A parenthetical that teaches earns its place; one that only makes a string unique does
  not, and both halves of an ambiguous pair need one.
- **The validator cannot see a comma.** Run the comma-alternative sweep before committing a content
  task; the whole-string check will not catch it.
- **Simulate both directions.** A one-card batch can only ever produce `es->en`. Pad it.
- **Two implementers died after committing and before reporting** (Tasks 1 and 4), and both times the
  work had to be reconstructed from the commit. Brief implementers to commit, then report, then
  return — and verify the commit yourself rather than waiting for a report that may never come.
