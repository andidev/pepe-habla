# Words Level 1 to Budget Implementation Plan (phase 3c, level 1 of 14)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill words level 1 — *Callejero* — from 78 cards to its 200-card budget, so the only level a learner can reach at install actually holds the 200 words they hear most.

**Architecture:** Content only. No code changes at all: `data/seed/words-1.json` gains 122 records, and `apps/app/storage/words.ts` already imports that file. The seed validator in `tools/seed/seed.test.ts` is the gate, and it already enforces everything this plan needs — a non-empty gloss in every language, no two cards sharing a gloss in any language across the whole 484-card seed, a known track, a level in range, at least one known theme, the filename matching the level, and the budget not exceeded.

**Tech Stack:** JSON seed data. `node:test` for the validator. No build step.

**Spec:** `docs/superpowers/specs/2026-09-21-levels-and-tracks-design.md` §1 (the words ladder: level 1 *Callejero*, 200 cards, "the top 200 by frequency: core verbs, pronouns, connectives"), §4 (themes), §6 (content and review). Phase 3c is §7's third plan, delivered one level at a time.

**Base:** `main` after plan 3b merged (PR #6). 206 tests, typecheck clean at both roots. The seed holds 484 cards: 384 words across levels 1–7 and 100 grammar cards at level 1.

**Why this level first:** it is the only one open at install. The unlock gate needs 70% of it dominada before level 2 opens, so every learner passes through it and nobody reaches anything else until they have. At 78 cards it is also the shortest rung on the ladder.

## Global Constraints

- **Mexican Spanish.** `carro` not `coche`, `computadora` not `ordenador`, `camión` for a city bus, `jugo` not `zumo`, `celular` not `móvil`. **Never `vosotros`.** Flag a Spain difference in a `note` only when it is worth knowing.
- **Every card needs `es`, `en`, `sv`, `pos`, `track`, `level`, `themes`.** `sprite` and `note` are optional and rare.
- **No two cards may share an `es`, an `en` or an `sv`, across the whole seed** — all 484 existing cards included. Two cards with the same gloss would put two identical options in one question and the app would mark one of them wrong. This is the constraint that will actually bite; see each task's Step 1.
- **Every words card carries at least one theme** from the 28 in `packages/core/src/levels.ts`. Do not invent a theme id.
- **The glosses are what the learner reads.** English for Anders, Swedish for his son. Natural Swedish, not translated English.
- **Anders reviews content by playing, not by reading drafts.** Ship on your draft; the validator is what stands between a typo and the app.
- **Change no existing card.** Not an `es`, not a gloss, not a `note`, not an `id`. Progress is keyed by `id`.
- **Stage files by name. Never `git add -A`** — other sessions commit in this repo.
- `npm test && npm run typecheck` from the repo root must both pass before every commit.
- **Never run `expo run:ios`, `expo run:android` or `expo prebuild`, and never edit `package.json` scripts or `app.json`.** No app verification is needed for this plan — it adds no code.

## What level 1 holds today

78 cards: **42 verbs**, **21 adjectives**, **14 adverbs**, **1 noun** (`el taco`). Themes: `verbos` 42, `conectores` 7, `comida` 6, `emociones` 5, and a thin tail.

The shape of the gap is the point. The spec calls level 1 "core verbs, pronouns, connectives", and the verbs are done — the 42 present are the right 42. What is missing is **everything that is not a verb**: there are no pronouns at all, one noun, no question words, no numbers, no greetings, and only seven connectives.

**The 122 new cards are therefore almost entirely function words and the most common nouns**, which is exactly what "the top 200 by frequency" means in Spanish. A frequency list of Spanish is dominated by `que`, `de`, `no`, `a`, `la`, `el`, `y`, `en`, `un`, `ser`, `se`, `los`, `no`, `te`, `lo`, `le` — closed-class words. Some of those cannot be taught as flashcards (bare articles, `de`, `a`), and this plan does not try. What it does add is every closed-class word that *can* stand alone as a card with a meaning a learner can choose from four options.

## Level 1's existing 78, so you do not duplicate them

Verbs: ser, estar, tener, hacer, ir, poder, decir, ver, dar, saber, conocer, querer, llegar, pasar, deber, poner, quedar, creer, hablar, llevar, dejar, seguir, encontrar, venir, pensar, salir, volver, tomar, trabajar, comer, vivir, entender, escribir, leer, abrir, cerrar, empezar, terminar, esperar, necesitar, gustar, llamar.

Adjectives: bueno, malo, grande, pequeño, nuevo, viejo, joven, largo, corto, alto, fácil, difícil, rápido, lento, caliente, frío, feliz, triste, cansado, enfermo, ocupado.

Adverbs: siempre, nunca, ahora, después, antes, todavía, ya, aquí, allí, cerca, lejos, despacio, temprano, demasiado.

Noun: el taco.

**Everything in levels 2–7 is also off limits as a duplicate.** Level 2 in particular holds the common household and food nouns (`el trabajo`, `la comida`, `la gente`, `la mujer`, `el hombre`, `la familia`, `el día`, `la noche`, `la puerta`, `la mesa`, `el agua`, `el café`, `el pan` and so on) — do not pull those down into level 1. If a word you want is already at level 2 and you believe it genuinely belongs at level 1, **leave it where it is** and say so in your report: moving a card between levels is a separate decision and not this plan's job.

---

## File Structure

| File | Responsibility |
|---|---|
| `data/seed/words-1.json` | gains 122 records, reaching the 200-card budget |

Nothing else changes. `apps/app/storage/words.ts` already imports this file, and `levels.ts` already budgets 200 for this level.

---

### Task 1: The pronouns and the question words

The spec names pronouns in level 1's own description and the seed has none. These are the highest-frequency words in the language that are still teachable as cards.

**Files:**
- Modify: `data/seed/words-1.json`

**Interfaces:**
- Consumes: the validator's existing checks.
- Produces: 40 new records. Level 1 goes 78 → 118.

- [ ] **Step 1: Check your list against the seed before you write a single gloss**

Every collision you find now is a rewrite you avoid later. Run this with your candidate `es` values:

```bash
node -e '
const fs = require("node:fs");
const all = fs.readdirSync("data/seed").filter((f) => f.endsWith(".json"))
  .flatMap((f) => JSON.parse(fs.readFileSync(`data/seed/${f}`, "utf8")));
const have = new Set(all.map((w) => w.es.trim().toLowerCase()));
const want = process.argv.slice(1);
const clash = want.filter((w) => have.has(w.trim().toLowerCase()));
console.log(clash.length ? `ALREADY IN SEED: ${clash.join(", ")}` : "no collisions");
console.log(`seed holds ${all.length} cards`);
' yo tú él ella nosotros
```

Pass your whole candidate list. Do the same for your English and Swedish glosses once drafted, swapping `w.es` for `w.en` and `w.sv`.

- [ ] **Step 2: Write the subject and object pronouns**

The subject pronouns, which the grammar track's conjugations assume a learner knows but which no card teaches:

`yo`, `tú`, `él`, `ella`, `usted`, `nosotros`, `ellos`, `ellas`, `ustedes`.

Glosses carry the pronoun plainly — `yo` → "I" / "jag". `usted` needs its register in the gloss, because the distinction is the whole point of the word: "you (formal)" / "du (artigt)", with a `note` saying Mexico uses `usted` with strangers and older people where Spain would often use `tú`. `ustedes` → "you (plural)" / "ni", with a `note` that Mexico has no `vosotros`, so `ustedes` covers every plural you, formal or not.

Then the object and possessive forms a beginner meets immediately:

`me`, `te`, `le`, `nos`, `lo`, `la` (as object pronouns — glossed "it, him" / "den, honom" and "it, her" / "den, henne", **not** as articles), `mi`, `tu`, `su`, `nuestro`.

`mi` / `tu` / `su` are `adjective` (possessive determiners). The rest are `other`. Theme `conectores` for all of them — they are the glue of a sentence and no scene theme fits.

**Watch the collisions.** `la` as an object pronoun must not collide with any existing `la …` noun (it will not — those all carry their noun), and `su` → "his, her, your" needs an English gloss no other card has.

- [ ] **Step 3: Write the question words**

`qué`, `quién`, `cuál`, `cuándo`, `dónde`, `cómo`, `cuánto`, `por qué`.

All `pos: "other"`, theme `conectores`. Accents matter — these carry them as question words and lose them as relatives, and the accented form is what a learner needs.

`por qué` → "why" / "varför" needs a `note` distinguishing it from `porque` ("because"), which Task 3 adds: the two are one space and one accent apart and it is the commonest spelling mistake a learner makes.

- [ ] **Step 4: Write the demonstratives and the remaining deixis**

`este`, `ese`, `aquel`, `esto`, `eso`, `alguien`, `nadie`, `algo`, `nada`, `todo`, `otro`, `mismo`, `cada`.

`este` / `ese` / `aquel` are the three-way distance Spanish has and English does not — "this" / "that (near you)" / "that (over there)", and in Swedish "den här" / "den där" / "den där borta". Give `ese` and `aquel` a `note` each, because an English or Swedish speaker will otherwise map both to one word.

`pos: "adjective"` for the determiners, `"other"` for `esto`/`eso`/`alguien`/`nadie`/`algo`/`nada`. Theme `conectores`.

- [ ] **Step 5: Run the validator**

Run: `node --test tools/seed/seed.test.ts`
Expected: PASS. A duplicate-gloss failure names both cards — fix it by making your new gloss more specific, never by changing the existing card.

- [ ] **Step 6: Check the shape of what you wrote**

```bash
node -e '
const w = JSON.parse(require("node:fs").readFileSync("data/seed/words-1.json", "utf8"));
console.log(w.length, "cards");
const pos = {}; for (const x of w) pos[x.pos] = (pos[x.pos] || 0) + 1;
console.log("pos:", JSON.stringify(pos));
const th = {}; for (const x of w) for (const t of x.themes) th[t] = (th[t] || 0) + 1;
console.log("themes:", Object.entries(th).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(", "));
console.log("vosotros-shaped:", w.filter((x) => /áis$|éis$/.test(x.es)).map((x) => x.es).join(", ") || "none");
'
```

Expected: **118 cards**, no `vosotros`-shaped forms, and `conectores` now a large theme rather than a thin one.

- [ ] **Step 7: Run everything and commit**

Run: `npm test && npm run typecheck` from the repo root. Expected: 206 tests, typecheck clean — this plan adds no tests, it feeds the existing ones more data.

```bash
git add data/seed/words-1.json
git commit -m "Level 1: the pronouns and question words it never had"
```

---

### Task 2: The hundred most common nouns a beginner meets

Level 1 holds exactly one noun. The spec's "top 200 by frequency" cannot be 42 verbs and no nouns.

**Files:**
- Modify: `data/seed/words-1.json`

**Interfaces:**
- Consumes: Task 1's additions (for collision checking).
- Produces: 42 new records. Level 1 goes 118 → 160.

- [ ] **Step 1: Run the collision check from Task 1 Step 1 against your candidate list**

This task is where collisions are most likely, because level 2 already holds the household and food nouns. Check every candidate before drafting glosses.

- [ ] **Step 2: Write them**

The nouns a learner needs in their first weeks that level 2 does not already hold. Candidates, to be checked against the seed first and trimmed or extended to reach exactly 42:

**People and life:** `la persona`, `el niño`, `la niña`, `el señor`, `la señora`, `el nombre`, `la vida`, `el mundo`, `la parte`.

**Time beyond level 2's:** `el momento`, `el minuto`, `la edad`, `el fin`, `el principio`.

**Place and direction:** `el lado`, `el centro`, `la dirección`, `el camino`, `el número`.

**Abstractions a beginner genuinely uses:** `la manera`, `la forma`, `el problema`, `la pregunta`, `la respuesta`, `la razón`, `el ejemplo`, `el caso`, `el punto`, `la idea` — **check each; several of these are already at level 4 or 7 and must stay there.**

**Numbers**, which have no cards at all and are theme `números`: `uno`, `dos`, `tres`, `cuatro`, `cinco`, `seis`, `siete`, `ocho`, `nueve`, `diez`, `cien`, `mil`.

Numbers are `pos: "other"`. Their glosses are the numeral's name — `uno` → "one" / "ett" — and `uno` needs a `note` that it becomes `un` before a masculine noun, which is the first thing that trips a learner.

**Greetings and courtesy**, theme `saludos`: `hola`, `adiós`, `gracias`, `por favor`, `perdón`, `sí`, `no`.

`sí` and `no` are `pos: "other"`, theme `conectores`. `sí` needs a `note` on the accent — `si` without it means "if", which Task 3 adds.

Give every noun its article in `es`, as the seed already does: `la persona`, not `persona`.

- [ ] **Step 3: Validator, shape check, commit**

Run the validator, then the shape check from Task 1 Step 6 — expected **160 cards** — then `npm test && npm run typecheck`.

```bash
git add data/seed/words-1.json
git commit -m "Level 1: the nouns, the numbers and the words you say first"
```

---

### Task 3: The connectives, the quantifiers and what is left

The last 40, and the ones the spec names most explicitly: level 1 is "core verbs, pronouns, **connectives**" and holds seven.

**Files:**
- Modify: `data/seed/words-1.json`

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: 40 new records. Level 1 reaches its **200-card budget exactly**.

- [ ] **Step 1: Count what remains**

```bash
node -e 'console.log(200 - JSON.parse(require("node:fs").readFileSync("data/seed/words-1.json","utf8")).length, "cards to reach budget")'
```

Write exactly that many. The validator fails a level that goes over budget, and a level that stops short is a level 3c has not finished.

- [ ] **Step 2: Write the connectives**

`y`, `o`, `pero`, `porque`, `si`, `cuando`, `como`, `que`, `aunque`, `entonces`, `también`, `tampoco`, `además`, `pues`.

`porque` pairs with Task 1's `por qué` — each should carry a `note` pointing at the other. `si` ("if") pairs with Task 2's `sí` ("yes") the same way. `como` ("as, like") pairs with the question word `cómo` ("how"). These three pairs are the commonest accent mistakes in the language and the cards should teach the difference rather than leave four options that look identical.

All `pos: "other"` except `pero`/`porque`/`aunque` which are also `other`. Theme `conectores`.

- [ ] **Step 3: Write the quantifiers and degree words**

`mucho`, `poco`, `más`, `menos`, `muy`, `tanto`, `bastante`, `casi`, `solo`, `todos`, `algunos`, `ninguno`, `varios`.

`muy` and `mucho` need notes: both translate as "very/a lot" but `muy` modifies an adjective and `mucho` a noun or verb, and choosing wrong is the mistake every learner makes for a year. `pos: "adverb"` for `muy`/`casi`/`más`/`menos`/`solo`, `"adjective"` for the rest. Theme `conectores`.

- [ ] **Step 4: Fill the remainder**

Whatever the count from Step 1 leaves, from the highest-frequency words still missing. Prefer, in this order: prepositional phrases a learner meets whole (`antes de`, `después de`, `dentro de`, `fuera de`, `en frente de`, `al lado de`), the remaining common adverbs (`bien`, `mal`, `así`, `entonces`, `luego`, `pronto`, `tarde`), and the courtesy phrases that are one unit (`de nada`, `con permiso`, `lo siento`, `buenos días`, `buenas noches`).

A multi-word phrase is `pos: "phrase"`. Theme `conectores` or `saludos` as it fits.

- [ ] **Step 5: Prove the level is exactly at budget**

```bash
node --test tools/seed/seed.test.ts
node -e '
const fs = require("node:fs");
const w = JSON.parse(fs.readFileSync("data/seed/words-1.json", "utf8"));
console.log(w.length === 200 ? "level 1 at budget: 200" : `OFF BUDGET: ${w.length}`);
const all = fs.readdirSync("data/seed").filter((f) => f.endsWith(".json"))
  .flatMap((f) => JSON.parse(fs.readFileSync(`data/seed/${f}`, "utf8")));
console.log("seed total:", all.length, "(expected 606)");
for (const k of ["es", "en", "sv"]) {
  const v = all.map((x) => x[k].trim().toLowerCase());
  const dup = v.filter((x, i) => v.indexOf(x) !== i);
  console.log(`dup ${k}:`, dup.join(", ") || "none");
}
'
```

Expected: `level 1 at budget: 200`, `seed total: 606`, and no duplicates in any language.

- [ ] **Step 6: Run everything and commit**

Run: `npm test && npm run typecheck`. Expected: 206 tests, typecheck clean.

```bash
git add data/seed/words-1.json
git commit -m "Level 1: the connectives and quantifiers, and the level is full"
```

---

## When all three tasks are done

- Run the whole-branch review before the PR.
- Write the execution log to `docs/superpowers/plans/2026-09-21-phase-3c-words-1-execution-log.md`.
- The PR body should say plainly what changed for a learner: level 1 now holds 200 cards rather than 78, including the pronouns, question words and numbers it never had, and a learner will meet far more of the language before level 2 opens.

## Out of scope

- Any other level. Each gets its own plan and its own PR, as §7 asks.
- Moving a card between levels. If one is wrong, say so in the execution log and leave it.
- Any code change. This plan touches one JSON file.
- Art for any new card. `sprite` stays absent.
