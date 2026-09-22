# SDD ledger — plan: docs/superpowers/plans/2026-09-22-seed-validator-track-scope.md

Spec: `docs/superpowers/specs/2026-09-21-levels-and-tracks-design.md` (read). The finding
this plan closes was carried out of `2026-09-21-phase-3c-words-1-execution-log.md`.
Branch: `claude/seed-validator-track-scope`, off `main` after words level 1 merged (PR #10).
Baseline 268 tests. Two tasks, two implementers, a review after each, a whole-branch review,
one fix round inside Task 1 and one final fix wave.

Run on autopilot: the gates were answered without the owner, and every other discipline —
the tests, the reviews, the ledger, the fix loops — ran as it would have with him here.

## What changed

`tools/seed/seed.test.ts` rejected any Spanish string or gloss appearing twice **anywhere**
in the seed. The check now compares only **within a track**. Same word in `words` and in
`grammar` is legal; the same word twice in one track is still the error it always was, for
Spanish and for both glosses. Greetings keep the flat, unscoped check — they are a list of
splash lines, not cards, and have no track.

- **Task 1** (`cf3429a`, fixed in `5c27132`) — `tools/seed/duplicates.ts`, a pure module with
  `norm`, `duplicates`, `Collision` and `collisions`, plus fixtures.
- **Task 2** (`f86ad60`) — `seed.test.ts` imports it, drops its local copies, and rewrites the
  three duplicate tests.

## Why this is not simply a loosening

The rule's own comment states its reason: a question's four options must contain exactly one
right answer, or the app marks a correct tap wrong. That reason is about **one question's
options** — and since phase 3b a question's distractors come from a single track.

The final reviewer re-derived this from source rather than taking the plan's word, and went
further than the plan had: `apps/app/app/session.tsx:50` builds `trackWords`, and line 54's
`pool` — the one that actually reaches `buildQuestions` — descends from it. Both top-up paths
pass a track. The repair path cannot mix at all, for a stronger reason than filtering:
`packages/core/src/session.ts:125` stores the already-built `Question` and replays its frozen
options. No path can put two tracks' cards in one option set.

## What it buys

`como` can be "as, like" in words and "I eat" in grammar. Grammar levels 2–6 add roughly 500
conjugations, and `nada`, `vino`, `cuenta`, `sale` and `llama` are each a word twice over. The
old rule was already costing content: `ninguno` was forced to the awkward Swedish
"inte en enda" because `nadie` holds "ingen".

## The hard part: proving a relaxation

The seed has **zero** collisions today, so it passes under the old rule and the new one alike.
The suite could not tell you whether the check was even wired up. Fixtures are the only thing
that can carry the proof, which made every vacuous fixture a real defect rather than a style
note — and three were found.

- **Task 1, found by the implementer itself.** Mutation 3 removed the `.sort()` from
  `collisions` and all ten tests still passed: my fixture listed its `grammar` cards first, so
  `Map` insertion order coincidentally equalled sorted order. The implementer disclosed it
  rather than quietly editing the brief's fixture — the right call. Fix round 1 reordered the
  input so `words` comes first while the expectation stays `grammar` first; removing the sort
  now fails exactly that one test.
- **Final review, two more of the same class.** No fixture put **two** colliding texts in one
  track, which left two mutations alive: replacing the sort's secondary key with `|| 0`, and
  reporting the raw text while still grouping by the normalised one. One added fixture closes
  both.
- **What did hold.** The final reviewer ran fifteen mutations and caught thirteen. Hardcoding
  the compared key to each of `es`, `en` and `sv` fails four, two and four tests respectively,
  so all three keys are independently pinned — the "silently dropped a key" failure, invisible
  against a clean seed, is genuinely covered.

## Rulings

**The premise was verified, not assumed.** Recorded at the pre-flight scan and checked again
by the final reviewer. If the track filter in `session.tsx` were ever reverted, this
relaxation would put two identical options in one question. *Cost if wrong:* precisely the bug
the rule exists to prevent.

**Two defects in my own plan text, both caught before dispatch.** It claimed `norm` was also
called by the `misfiled` block — it was not; its only caller was the helper being deleted. And
it said nine new tests where the fixtures define ten. A wrong expected count sends an
implementer hunting a phantom failure.

**The plan's baseline test count was stale.** It said 206; the real baseline was 268, because
another session merged two PRs into main after the plan was drafted. Corrected, and both
implementers were told the delta is what binds, not the absolute.

**Commits keep their own attribution; the constraint was wrong.** The plan demanded every
commit be trailered `Claude Opus 5`, but implementers are chosen per task by model tier, so an
implementer could satisfy either the plan or its own session's attribution rule, not both. This
repo's history already names the writer — `b7a92b9` says Sonnet, `d7be718` says Opus. Rewrote
the constraint to say "the model that actually wrote the commit". Did not amend the two
commits: `Claude Sonnet 5` is true, and replacing it would make the history lie to satisfy a
rule that was wrong.

**`optionMeaning` was fixed on this branch, though the plan's scope said tools only.**
`apps/app/app/session.tsx:402` passed the whole unscoped `WORDS` to `optionMeaning`, which
resolves by first-match-on-text. With a cross-track homograph it returns the **other** track's
meaning: tap `como` in a grammar round and the hint reads "as, like" when the card means
"I eat". Grading stays correct, so this is not the two-right-answers bug — it is the hint whose
stated purpose is "a chance to learn two words rather than none" teaching the wrong one.

It also refutes one sentence of the plan. The plan argued the change "keeps every case it was
written to catch and drops only the cases it never protected against". The old blanket rule
*did* protect this path, incidentally but really, and the plan reasoned only about
`buildQuestions`. Latent today, but this branch exists to unlock exactly the content that
triggers it, so deferring it would leave a defect nothing catches and the next content plan has
no reason to look for. *Cost if wrong:* one filtered call site in `apps/app` inside an
otherwise tools-only PR.

**The call site was fixed, not `optionMeaning`'s signature.** The better fix is to give the core
function a `track` parameter so no caller can get it wrong. Declined: it changes a
`packages/core` signature and six existing test call sites inside a plan that deliberately
touched no core, and there is exactly one caller. Took the caller-side filter plus a contract in
the doc comment. *Cost if wrong:* a future second caller could repeat the mistake, with only the
doc comment standing between.

## Verification

270 tests and typecheck clean at both roots, at every commit. The `optionMeaning` fix was
proved by reproduction before and after, on two fixture cards sharing `es: 'como'` across
tracks:

```
un-filtered pool (WORDS, both tracks): as, like
filtered pool (question.word.track only): I eat
```

The re-reviewer re-ran both surviving `duplicates.ts` mutations itself rather than trusting
the fixer's report — the third vacuous fixture on this branch had made that claim worth
checking — and confirmed the new test fails under each, with the file restored byte-identical.
It also confirmed the hoisted filter sits after the `if (!question) return` guard and is a
plain `const`, not a hook, so there is no hook-ordering hazard.

## Deferred findings

**`optionMeaning` should take the track rather than trust its caller.** The fix above is correct
at the one call site that exists; it does not make the mistake impossible. Giving the core
function the track — or the whole `Question` — and filtering inside would. Belongs in a plan
that is already touching `packages/core`.

**Commit `5c27132` carries no `Co-Authored-By` trailer**, the only commit on the branch missing
one. Not amended: rewriting history mid-branch for a cosmetic line risks more than it buys, and
no check enforces trailers.

**Nothing in the repo exercises the new freedom yet.** No seed content uses a cross-track
homograph, so the fixtures are the whole proof. The first content that adds one is also the
first end-to-end test of this change — and it should be written knowing that.

## Carried forward to the next content plan

- **`cada`** (words level 1) and **`mismo`** (words level 2) are determiners sitting in the
  descriptive-adjective distractor pool, which makes them answerable by elimination. Same defect
  as the seven fixed in words level 1; a scoping error of mine left these two out.
- **Unaccented `como` still has no card.** Its twin teaches it in prose, but `que`, `cuando` and
  `tu` each have both halves drilled. This plan is what makes the card possible at all.
- **`hay` and the basic prepositions** (`de`, `en`, `a`, `con`, `por`, `para`) are absent from all
  606 cards. Level 1 is at budget, so closing that gap means displacing cards.
