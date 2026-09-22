# Words Level 2 — *Casa* — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill words level 2 from 127 cards to its 250-card budget, so a learner who clears level 1 meets a whole house, a kitchen, a body, a family and a calendar before level 3 opens.

**Architecture:** Content only. One file, `data/seed/words-2.json`, plus two one-word corrections carried forward from level 1. No code changes. The seed validator (`tools/seed/seed.test.ts`) is the gate.

**Tech Stack:** JSON seed data, validated by `node:test`. Node 24 runs TypeScript directly; there is no build step.

**Spec:** `docs/superpowers/specs/2026-09-21-levels-and-tracks-design.md`. §1 defines level 2: **Casa, 250 cards, "Home, food, body, family, time, numbers"**. §4 covers themes. §6 covers content and review.

**Prior art you must read before Task 1:** `docs/superpowers/plans/2026-09-21-phase-3c-words-1-execution-log.md`. Level 1 shipped three Criticals' worth of notes that taught grammar backwards and a giveaway that made 17 cards answerable without knowing them. Every constraint below exists because of something that went wrong there.

## The learners

A father learning in English or Swedish, and **his son, who learns in Swedish**. Mexican Spanish: `carro` not `coche`, `computadora` not `ordenador`, no `vosotros`. Flag a Spain difference only when it is worth knowing.

**Every answer is a tap. Every gloss becomes an option.** A gloss is not a dictionary entry — it is a button the learner presses.

## Global Constraints

- **`data/seed/words-2.json` is the only content file.** Every card in it carries `"track": "words"` and `"level": 2`. The validator enforces the filename-to-level match.
- **Never touch an existing card's `id`.** Progress is keyed by `id`; changing one silently resets a learner's history for that word. The 127 cards already in the file must come out byte-identical except where this plan names them.
- **Every card needs** `id`, `es`, `en`, `sv`, `pos`, `track`, `level`, `themes` (at least one). `sprite` and `note` are optional.
- `pos` is one of `noun`, `verb`, `adjective`, `adverb`, `phrase`, `other`. `themes` entries must come from the 28 in `packages/core/src/levels.ts` — read it; inventing a theme fails the build.
- **Nouns carry their article** in `es`: `la casa`, not `casa`. That is how the seed already reads and how the learner needs to meet them.
- **Swedish nouns go in the definite form** — `huset`, not `ett hus` — matching the rest of the seed.
- **`pos` is a pedagogical decision, not a grammatical one.** `buildQuestions` prefers same-`pos` distractors, so a card's `pos` decides who it competes against. A determiner among descriptive adjectives is answerable by elimination. If a word is a determiner, quantifier or function word, it goes in `other` even when a grammar book would call it an adjective.
- **The duplicate check compares the whole normalised string** (trimmed, lowercased) **within a track.** Two cards in the words track may not share an `es`, an `en` or an `sv`. A *qualified* gloss is therefore always free: `"bra (om hur något görs)"` does not collide with `"bra"`. **Never degrade a gloss to dodge a duplicate** — qualify it instead.
- **A note must be true.** Every grammatical claim gets fact-checked independently, in all three languages. Three notes shipped in level 1 stating a rule backwards, and each read perfectly plausibly.
- **A note never names a task, a plan, a step or a file.** It is prose the child reads. One level-1 note shipped saying "which Task 3 adds".
- **Never `git add -A`.** Stage files by name; other sessions commit in this working directory.
- **Never run `expo run:ios`, `expo run:android` or `expo prebuild`**, and never edit `package.json` or `app.json`. Agents have stalled for over an hour on native builds here. Nothing in this plan needs the app to run.
- Both gates stay green at every commit: `npm test` (270 tests at the start of this plan) and `npm run typecheck`.
- End every commit message with a `Co-Authored-By:` trailer naming **the model that actually wrote the commit** — follow your own session's attribution instruction. This repo's history names the writer.

## What level 2 holds today

127 cards: 66 nouns, 40 verbs, 17 adjectives, 4 phrases. **No adverbs and no function words at all** — those live in level 1 and are available as distractors from there, since the distractor pool is the whole words track, not the level.

By theme, with what is conspicuously missing:

| Theme | Has | Missing |
|---|---|---|
| `casa` | 17 — `la puerta`, `la ventana`, `la mesa`, `la silla`, `la cama`, `el baño`, `la cocina`, `el cuarto`, `la llave`, plus `limpiar`, `lavar` and five adjectives | **`la casa` itself.** Also every room but bathroom and kitchen, all furniture beyond table/chair/bed, and everything you keep in a house. |
| `comida` | 17 — `el desayuno`, `la cena`, `el agua`, `el café`, `la leche`, `el pan`, `la carne`, `el pollo`, `el huevo`, `la fruta`, `la verdura`, `el frijol` | Staples (rice, salt, sugar, oil, cheese, fish), Mexican staples (tortilla, chile, salsa), dishes, anything sweet. |
| `cocina` | **0** | Every utensil, every plate and cup, every cooking verb. The level has `la cocina` the room but nothing in it. |
| `cuerpo` | 13 — `la cabeza`, `la mano`, `el pie`, `el ojo`, `la boca`, `el brazo`, `la pierna`, `el corazón`, `la espalda` | Hair, ear, nose, tooth, neck, finger, knee, shoulder, skin, throat, stomach. |
| `familia` | 6 — `la mujer`, `el hombre`, `el amigo`, `la familia`, `el hermano`, `la hija` | **Mother and father.** Also son, sister, grandparents, aunt/uncle, cousin, baby, child. |
| `tiempo` | 11 — `la semana`, `el mes`, `el año`, `el día`, `la noche`, `la mañana`, `la tarde`, `la hora`, `la madrugada` | **Every day of the week and every month.** Also minute, clock, yesterday/today/tomorrow, early/late. |
| `números` | 1 (`primero`) | Level 1 has one to ten plus `cien` and `mil`. **Eleven through ninety-nine is absent from the entire seed**, as are the ordinals past first. |

**123 cards to add.** Four tasks of roughly 31 each.

## Two corrections carried forward from level 1

Recorded as deferred in `2026-09-21-phase-3c-words-1-execution-log.md`. Both are one-word `pos` changes, both fixed in Task 1:

- **`cada`** ("varje") in `data/seed/words-1.json` — `pos: "adjective"`, but it is a determiner. It was measurably serving as a giveaway distractor in the level-1 pool.
- **`mismo`** ("samma") in `data/seed/words-2.json` — same shape, same fix.

Seven level-1 determiners were moved to `other` for exactly this reason; a scoping error left these two behind.

## File Structure

| File | Responsibility |
|---|---|
| `data/seed/words-2.json` | **Modify, all four tasks.** The level's cards. |
| `data/seed/words-1.json` | **Modify, Task 1 only, one field.** `cada`'s `pos`. |

---

### Task 1: The house, and the two determiners left behind

**Files:**
- Modify: `data/seed/words-2.json` — add 31 cards
- Modify: `data/seed/words-1.json` — change one `pos` value
- Test: `tools/seed/seed.test.ts` (existing; run it, do not edit it)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: 31 new ids in the `casa` theme. Later tasks must not duplicate these words, these ids, or any of their glosses.

- [ ] **Step 1: Read what is already there**

```bash
node -e 'const a=require("./data/seed/words-2.json");const ws=a.words||a;console.log(ws.length);console.log(ws.map(w=>w.es+" | "+w.en+" | "+w.sv).join("\n"))'
```

Read all 127. You are adding to a level, not starting one — every gloss you write competes with these for uniqueness, and every card you add will appear as a distractor against them.

- [ ] **Step 2: Fix the two determiners**

In `data/seed/words-1.json`, change `cada`'s `pos` from `"adjective"` to `"other"`. In `data/seed/words-2.json`, change `mismo`'s `pos` from `"adjective"` to `"other"`. Change nothing else on either card — not the `id`, not a gloss, not the themes.

- [ ] **Step 3: Write 31 house cards**

Add them to `data/seed/words-2.json`. Every card: `"track": "words"`, `"level": 2`, `"themes": ["casa"]` (a second theme is fine where it genuinely applies).

Cover, at minimum:
- **The house itself and its rooms** — `la casa`, and the rooms level 2 lacks: living room, dining room, bedroom, garden, garage, stairs. Use Mexican usage: **`la recámara`** for bedroom, not `el dormitorio`.
- **The structure** — floor, ceiling, wall, roof.
- **Furniture** — sofa, armchair, closet/wardrobe, shelf, lamp, mirror, rug, curtain.
- **The bed and the bathroom** — pillow, blanket, sheet, towel, soap.
- **The things a house has** — the fridge, the stove, the television, the trash, the light, the water heater if it earns a slot.
- **Two or three verbs** that belong to a house and are not already there (`limpiar` and `lavar` are taken): tidying, turning on and off, opening and closing if absent — check first.

Write ids as the slug of the Spanish including the article: `la recámara` → `la-recamara` (no accents in ids; look at existing ids and match the convention exactly).

Add a `note` only where the learner needs one, not on every card. Good reasons for a note: Mexico differs from Spain in a way worth knowing (`la recámara`); the word looks like an English word it does not mean; two cards in this level are easy to confuse and the note separates them. **Every factual claim in a note must be verified independently before you write it.**

- [ ] **Step 4: Run the gate**

```bash
node --test tools/seed/seed.test.ts
```

Expected: PASS. If the duplicate check fails, **qualify the gloss** — the check compares whole strings, so `"lampan"` and `"lampan (i taket)"` are different. Do not reach for a worse word.

Then:

```bash
npm test && npm run typecheck
```

Expected: 270 tests passing, typecheck exit 0. Confirm the level is at 158:

```bash
node -e 'const a=require("./data/seed/words-2.json");const ws=a.words||a;console.log(ws.length, new Set(ws.map(w=>w.id)).size)'
```

Expected: `158 158`.

- [ ] **Step 5: Check your cards are not answerable without knowing them**

The failure that cost level 1 seventeen cards was invisible in the JSON — it only showed up
when the questions were actually built. Write this file at the repo root as `sim.ts`, run it,
then **delete it and never stage it**:

```ts
import { buildQuestions, mulberry32 } from '@pepe/core';
import { fileStore, projectRoot } from './tools/store/fileStore.ts';

const words = (await fileStore(projectRoot).loadWords()).filter((w) => w.track === 'words');
const ids = process.argv.slice(2);

// buildQuestions decides directions per BATCH: round(n * 0.4) of them are
// produce (gloss->es). With n = 1 that is 0, so a one-card call can only ever
// show es->en -- half of real practice, and the half whose options are Swedish.
// Pad the batch so the target can land in either bucket, then keep only the
// target's question.
const pad = words.filter((w) => !ids.includes(w.id)).slice(0, 9);

for (const id of ids) {
  const target = words.find((w) => w.id === id);
  if (!target) { console.log(`${id}: NOT FOUND`); continue; }
  const seen = new Map<string, number>();
  const dirs = new Map<string, number>();
  for (let seed = 1; seed <= 300; seed++) {
    const q = buildQuestions([target, ...pad], words, mulberry32(seed), 'sv')
      .find((x) => x.word.id === id);
    if (!q) continue;
    dirs.set(q.direction, (dirs.get(q.direction) ?? 0) + 1);
    const key = `${q.direction}  ${q.options.join(' / ')}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  console.log(`\n### ${id} (${target.es} = ${target.sv}, pos ${target.pos})  directions: ${[...dirs].map(([d, n]) => `${d} ${n}`).join(', ')}`);
  for (const [k, n] of [...seen].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    console.log(`  ${n.toString().padStart(3)}x  ${k}`);
  }
}
```

**Both directions must appear** in the `directions:` line — roughly 60% `es->en`, 40% `en->es`.
If you see only `es->en`, the padding is not working and you are testing half of practice. The
`en->es` direction is the one whose four options are *Spanish* strings, so it is where a
near-identical pair like `la sal` / `la sala` or `freír` / `reír` would bite.


Run it over a sample of the cards you added, at least eight, mixing every `pos` you used:

```bash
node sim.ts la-casa la-recamara el-sofa el-espejo la-toalla el-piso la-pared el-jardin
rm sim.ts
```

Read the option sets as a learner would. You are looking for a card whose three distractors
are all of a visibly different kind — the only room among three verbs, the only piece of
furniture among three foods — so the answer is obvious without knowing the word. If you find
one, the fix is that card's `pos` or its gloss. **Never change the simulation to make the
result look better.**

Put the output for every card you sampled in your report, whether it looked good or not.

- [ ] **Step 6: Commit**

```bash
git add data/seed/words-1.json data/seed/words-2.json
git commit -m "$(cat <<'MSG'
Level 2: the house itself, and the rooms it never had

<one paragraph on what a learner gets>

Co-Authored-By: <your model> <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: The kitchen and the table

**Files:**
- Modify: `data/seed/words-2.json` — add 31 cards
- Test: `tools/seed/seed.test.ts` (existing; run it, do not edit it)

**Interfaces:**
- Consumes: Task 1's 31 `casa` cards — read them before you start so you do not duplicate a word or a gloss.
- Produces: 31 new ids across the `cocina` and `comida` themes.

- [ ] **Step 1: Read the level as it now stands**

Same command as Task 1 Step 1. It now holds 158 cards. Note especially the 17 `comida` cards already there — you are extending that set, and every gloss must be distinct from all of them.

- [ ] **Step 2: Write 31 kitchen and food cards**

`"themes": ["cocina"]` for utensils, dishes and cooking; `["comida"]` for ingredients and meals. Cover, at minimum:

- **Staples not yet in the seed** — rice, salt, sugar, oil, cheese, fish, soup.
- **Mexican staples**, which this level has none of and which are the point of a Mexican Spanish trainer — `la tortilla`, `el chile`, `la salsa`, `el aguacate`, `el elote`. If Spain would say something different for one of these, that is exactly the note worth writing.
- **Something sweet** — dessert, cake, cookie, ice cream, chocolate.
- **The table** — plate, glass, cup, spoon, fork, knife, napkin.
- **The pans** — pot, frying pan.
- **Cooking verbs** — to cook, to fry, to boil, to bake, to chop, to heat. Check which are already in the seed first; `probar` is taken.

**Two traps in this set specifically:**
1. `el vaso` (drinking glass), `la copa` (stemmed glass) and `el cristal` (the material) are three different words English flattens to "glass". If you add more than one, each needs a gloss that distinguishes it — and Swedish `glaset` cannot be used twice.
2. `la comida` already means "the food" *and* is the Mexican word for the midday meal. It is already a card. Do not add a second card for the meal sense; if the double meaning is worth teaching, it belongs in a note on the existing card — **and that is an edit to an existing card's `note`, which is allowed, unlike its `id` or glosses.**

- [ ] **Step 3: Run the gate**

```bash
node --test tools/seed/seed.test.ts && npm test && npm run typecheck
```

Expected: PASS, 270 tests, typecheck clean. Confirm 189 cards, 189 unique ids, with the command from Task 1 Step 4.

- [ ] **Step 4: Check the option pools**

Use the `sim.ts` script from Task 1 Step 5 — it is written out in full there; copy it, run it, delete it. Sample at least eight of the cards you added, mixing nouns and cooking verbs. This set is mostly concrete nouns, which is the safest shape, but check that a cooking verb does not come up as the only verb among three nouns. Put the output in your report.

- [ ] **Step 5: Commit**

```bash
git add data/seed/words-2.json
git commit -m "$(cat <<'MSG'
Level 2: the kitchen, the table, and the food a Mexican kitchen has

<one paragraph on what a learner gets>

Co-Authored-By: <your model> <noreply@anthropic.com>
MSG
)"
```

---

### Task 3: The body and the family

**Files:**
- Modify: `data/seed/words-2.json` — add 31 cards
- Test: `tools/seed/seed.test.ts` (existing; run it, do not edit it)

**Interfaces:**
- Consumes: Tasks 1 and 2's 62 cards — read them first.
- Produces: 31 new ids across the `cuerpo` and `familia` themes.

- [ ] **Step 1: Read the level as it now stands** (189 cards)

- [ ] **Step 2: Write roughly 14 body cards**

`"themes": ["cuerpo"]`. The level has head, hand, foot, eye, mouth, arm, leg, heart, back. Add: hair, ear, nose, tooth, neck, finger, knee, shoulder, skin, throat, stomach, bone, blood, face.

**`el pelo` and `el cabello`** both mean hair; `el pelo` is what a Mexican family says. Pick one.

- [ ] **Step 3: Write roughly 17 family cards**

`"themes": ["familia"]`. The level has `la familia`, `el hermano`, `la hija`, `el amigo`, `la mujer`, `el hombre`. **It has no mother and no father** — those come first.

Then: son, sister, grandmother, grandfather, aunt, uncle, cousin, baby, boy, girl, wife, husband, neighbour.

**This set is where the gendered-pair problem lives, and level 1 got it wrong twice.** Spanish family words come in `-o`/`-a` pairs, and the seed can only hold the forms you give it. Rules for this task:

- The card's `es` is one form, and its glosses name **that** form: `la abuela` → "the grandmother" / "mormor, farmor". Never gloss `el abuelo` as "the grandparent" — that is `los abuelos` and a different card.
- Where you add both forms of a pair, **both glosses must be distinct strings**, which they will be naturally if each names its own gender.
- Swedish splits what Spanish does not: `mormor` (mother's mother) and `farmor` (father's mother) are both `la abuela`. Gloss it with both, comma-separated — this is precisely the qualified-gloss case, and it is free.
- If you write a note about gender agreement, **check it**: in Spanish, an adjective agrees with the noun's gender, and a possessive agrees with the **thing owned**, not the owner. A level-1 note stated that backwards and reached a Critical.

- [ ] **Step 4: Run the gate and check the pools**

As before. Expected 220 cards, 220 unique ids, 270 tests, typecheck clean.

**Check one thing specifically in the simulation:** the family cards are a tight semantic cluster of `noun`s. Confirm that a question for `la abuela` is not drawn against three other family members in a way that makes the Swedish a giveaway — and if the pool does cluster them, say so in your report rather than fixing it silently.

- [ ] **Step 5: Commit**

```bash
git add data/seed/words-2.json
git commit -m "$(cat <<'MSG'
Level 2: a body with a face, and a family with parents

<one paragraph on what a learner gets>

Co-Authored-By: <your model> <noreply@anthropic.com>
MSG
)"
```

---

### Task 4: The calendar, the clock and the numbers

**Files:**
- Modify: `data/seed/words-2.json` — add 30 cards
- Test: `tools/seed/seed.test.ts` (existing; run it, do not edit it)

**Interfaces:**
- Consumes: Tasks 1-3's 93 cards — read them first.
- Produces: the final 30 ids. After this task the level is **at its 250 budget and closed**.

- [ ] **Step 1: Read the level as it now stands** (220 cards)

- [ ] **Step 2: Write the seven days**

`"themes": ["tiempo"]`. `lunes`, `martes`, `miércoles`, `jueves`, `viernes`, `sábado`, `domingo`.

**Two facts to get right, because both are easy to state backwards:**
- Spanish day names are **not capitalised**. Swedish ones are not either; English ones are. Gloss them accordingly — `"Monday"` and `"måndag"`.
- Five of the seven are **identical in singular and plural** (`el lunes` / `los lunes`). Only `el sábado` and `el domingo` add `-s`. If you write that note, write it on one card, not seven.

Decide whether the `es` carries the article. The seed's convention is that nouns do — but `lunes` alone is how the word is used and how a learner meets it, and `el lunes` specifically means "on Monday". **Rule: write them bare** (`lunes`), because the article changes the meaning rather than just marking gender, and note that on one card.

- [ ] **Step 3: Write the twelve months**

`"themes": ["tiempo"]`. `enero` through `diciembre`, bare, lowercase, same capitalisation rule as the days.

- [ ] **Step 4: Write roughly eleven time and number cards**

Fill what is left of the 30 with the most useful of:
- **The clock** — `el minuto`, `el segundo`, `el reloj`, `el fin de semana`.
- **When** — `hoy`, `ayer`, `mañana` (tomorrow), `temprano`. These are `pos: "adverb"`, and level 2 currently has **none**, so they will be drawn against level 1's 26 adverbs.
- **Numbers** — the seed stops at ten and jumps to `cien`. Add the teens and the tens: `once`, `doce`, `trece`, `quince`, `veinte`, `treinta`, `cuarenta`, `cincuenta`. `"themes": ["números"]`, `pos: "other"` to match how level 1 files its numbers — **check `uno` in `words-1.json` and match it exactly.**

**Two traps here:**
1. **`mañana` is already in the seed twice over.** `la mañana` ("the morning") is a level-2 card. A bare `mañana` meaning "tomorrow" is a *different string*, so the validator will accept it — but a learner will meet both. Give the new card a note pointing at the old one, and **check whether `mañana` (tomorrow) already exists in level 1** before adding it. If it does, do not add it again; the duplicate-id check will catch you, but find out first.
2. **`el segundo` (the second, time) and `segundo` (second, ordinal)** are the same word doing two jobs, and `primero` is already a level-2 card. Adding both senses in one level needs each to earn its place; if you add only one, add the time one.

- [ ] **Step 5: Run the gate**

```bash
node --test tools/seed/seed.test.ts && npm test && npm run typecheck
```

Confirm the level is exactly at budget:

```bash
node -e 'const a=require("./data/seed/words-2.json");const ws=a.words||a;console.log(ws.length, new Set(ws.map(w=>w.id)).size, ws.every(w=>w.track==="words"&&w.level===2))'
```

Expected: `250 250 true`.

- [ ] **Step 6: Check the pools one last time**

Sample the days and the months. Seven days glossed to seven Swedish weekday names, all `noun`, all one theme, is the tightest cluster in the level — confirm a question for `miércoles` is answerable only by knowing it. Report what you find either way.

- [ ] **Step 7: Commit**

```bash
git add data/seed/words-2.json
git commit -m "$(cat <<'MSG'
Level 2: the days, the months, and the numbers past ten

<one paragraph on what a learner gets>

Co-Authored-By: <your model> <noreply@anthropic.com>
MSG
)"
```

---

## When all four tasks are done

- Run the whole-branch review before the PR. Point it at the level **as a whole** — no per-task review can see whether 250 cards make a coherent *Casa*, and that is where level 1's worst findings came from.
- Write the execution log to `docs/superpowers/plans/2026-09-22-phase-3c-words-2-execution-log.md`, carrying every ruling and every deferred finding.
- The PR body should say plainly what changed for a learner: level 2 now holds 250 cards rather than 127, with a house that has rooms, a kitchen with things in it, a family with parents, and a calendar.
- Still carried forward from level 1, and **not** closed by this plan: `hay` and the basic prepositions (`de`, `en`, `a`, `con`, `por`, `para`) are absent from the whole seed, and unaccented `como` has no card. All three need a budget swap in a level that is already full, which is a content call for Anders once he has played.
