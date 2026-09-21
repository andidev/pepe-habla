# Pepe Habla — App Language and Answer Flow

**Status:** design approved in conversation, 2026-09-21. Implementation starts
after phase 2 merges to `main`.

**Mocks:** `docs/superpowers/specs/mocks/2026-09-21-language-and-game-flow.html`
(open it from inside the repo so the Pepe images resolve). Frame numbers below
refer to it.

**Amends:** `2026-09-19-pepe-habla-design.md` — the sections *Question types*
and *The interface is in Spanish*. Where the two disagree, this document wins.

## Why

Two things, bundled because they touch the same screen.

1. **The app should speak the learner's language.** The interface is Spanish
   and every gloss is English. The app now has two more learners: Anders,
   who wants Swedish, and his son, who learns in Swedish. For them, a
   question that shows "the book" is a translation exercise inside a
   translation exercise.
2. **The answer loop should teach on every tap.** Today a wrong tap ends the
   question: a sheet slides up from the bottom, pushes the layout, and the
   learner moves on having seen the answer but never chosen it. In the new
   loop you keep going until you tap the right word. Each tap says its word
   aloud, and feedback never moves the buttons.

A third, smaller thing: a child who turns the sound off to hide mistakes also
loses the voice. A separate switch lets them drop the judging noises and keep
the voice.

## Scope

In:
- App language setting: Svenska, English, Español.
- Swedish glosses for all 384 words and all of Pepe's greetings.
- The retry-until-right answer loop, top toasts, spoken options.
- Dropping listening-only questions; the prompt word is always shown and spoken.
- A "sound effects and vibration" switch independent of the voice.

Out:
- The `/practice` CLI skill and `tools/cli.ts` stay English.
- Usage notes (`Word.note`) stay English. They are rare, and translating them
  is a content task of its own.
- Levels, themes, SM-2 and vocabulary growth remain phase 3.

## 1. Languages

There are two separate things, and the code keeps them apart:

| App language | Interface text | Glosses in questions | Voice for glosses |
|---|---|---|---|
| Svenska | Swedish | Swedish (`word.sv`) | sv-SE |
| English | English | English (`word.en`) | en-US |
| Español | Spanish | English (`word.en`) | en-US |

Spanish words are always shown in Spanish and spoken with the Mexican voice,
whatever the app language.

**Types.** In `packages/core`:

```ts
export type AppLanguage = 'sv' | 'en' | 'es';
export type GlossLanguage = 'sv' | 'en';
export const glossLanguage = (l: AppLanguage): GlossLanguage => (l === 'sv' ? 'sv' : 'en');
export const gloss = (w: Word, g: GlossLanguage): string => (g === 'sv' ? w.sv : w.en);
```

`Word` gains a required `sv: string`. Required, not optional: a word with no
Swedish would silently fall back to English mid-round, and a compile error is
cheaper to find.

**Seed content.** Claude drafts `sv` for all 384 words in
`data/seed/tier*.json` and for every entry in `apps/app/storage/greetings.ts`
(`Greeting` gains `sv`). Anders reviews the drafts before merge.
Parentheticals that make an English gloss unambiguous get translated too
(`to be (permanent)` → `att vara (bestående)`). The seed validator gains two
checks: every word has a non-empty `sv`, and no two words share a gloss in the
same language. The second matters because a shared gloss would make two
options identical.

**Interface strings.** One file, `apps/app/strings.ts`, holding a
`Record<AppLanguage, Strings>`. `Strings` is an interface, so a key missing
from one language is a type error. Strings that vary with a number are
functions (`roundScore: (right, total) => string`). There is no i18n library.
Three languages and about 60 strings do not justify one. Screens read strings
through a `useStrings()` hook backed by a small context, so changing the
language re-renders every screen at once.

Every screen with copy moves its text to `strings.ts`: home/Welcome, the
session, the summary, stats, words, settings and the tab bar. The word list
and stats show glosses in the gloss language.

**Persistence and default.** The language is stored in AsyncStorage next to
the mute flag. On first launch, with nothing stored, it follows the device
locale via `expo-localization`: Swedish → `sv`, Spanish → `es`, anything
else → `en`. Changing it takes effect immediately and never touches progress,
which is keyed by word id.

**Settings (frame 8).** A "Språk / Language" card with three radio rows. Each
language is named in its own language ("Svenska", "English", "Español") with
a one-line description, so a learner who picks the wrong one can find their
way back.

## 2. Speech

`feedback.ts` today speaks Spanish only, and fire-and-forget. It becomes:

```ts
type Voice = 'es' | 'sv' | 'en';
/** Resolves when the utterance ends, is stopped, fails, or after a guard timeout. */
function say(text: string, voice: Voice): Promise<void>;
function stopSpeaking(): void;
```

- Voices are chosen at startup the same way the Spanish one is today: best
  match per language (`es-MX` first; `sv-SE`; `en-US` then any `en`). A
  language with no voice on the device is **silent**, never read by another
  language's voice. That is the existing rule, extended.
- `say` resolves on `expo-speech`'s `onDone`, `onStopped` or `onError`. As a
  guard it also resolves after `1.5 s + 80 ms × characters`, because a
  callback that never fires must not freeze the round.
- Starting a new `say` stops the current one. Only one voice speaks at a time.
- When muted, `say` resolves immediately.

**Sound effects switch.** `feedback.ts` gains `effectsOn` (default true,
persisted). When it is off, `cue()` plays no sound **and fires no haptic**, for
every cue (`tap`, `correct`, `wrong`, `complete`, `streak`, `levelup`). The
voice is not affected.

| Sound | Effects | Voice | Cue sounds | Haptics |
|---|---|---|---|---|
| on | on | ✓ | ✓ | ✓ |
| on | off | ✓ | — | — |
| off | (hidden) | — | — | ✓ |

The last row is phase 2's existing behaviour. In settings the effects switch
sits inside the Sound card and only appears while Sound is on.

## 3. Question types

Listening-only questions (`listen->en`) are removed from `Direction`. Their
20% goes to the two text directions: 50% recognition (es→gloss), 40%
production (gloss→es), 10% picture, adjusted for availability as today.

`es->en` and `en->es` keep their names, and "en" now means "the gloss
language". Renaming them would break the stored per-direction counters phase 2
added (`rightEsToEn`, `rightEnToEs`), and the meaning — recognise vs produce —
is unchanged.

`buildQuestions(selected, pool, rng, glossLang)` gains the gloss language.
Question text and options are strings in the right language, so the screen
does no translating. `optionMeaning` gains the same parameter.

**What each type shows and says:**

| Type | Shows | Says on arrival | Tapping an option says |
|---|---|---|---|
| es → gloss (frame 6) | Spanish word | the Spanish word (es) | the option (gloss voice) |
| gloss → es (frames 1–5) | gloss | the gloss (gloss voice) | the option (es) |
| picture (frame 7) | picture only | nothing | the option (es) |

Picture questions deliberately show no word. They stay a genuine "what is
this?" question, and only four words have art.

## 4. The answer loop

### Prompt audio (frames 1–2)

- On arrival the prompt is spoken once.
- While it plays, three small marigold bars pulse in a fixed 28×28 slot to the
  right of the word. When it ends, the slot shows an outlined speaker icon in
  `muted`. The slot never changes size, so the word never shifts.
- Word and icon form one tap target (≥44px tall). A tap restarts the prompt
  from the beginning, even mid-utterance.
- The learner may answer at any time. They are never made to wait for the
  audio.

### A wrong tap (frames 3–4)

1. The option turns `chile` red with ✕, shows its meaning in small text
   ("el pan = brödet"), and is **locked** for the rest of the question.
2. Audio: the option's word is spoken, **then** the `wrong` cue plays.
3. A toast drops in from the top of the screen, over the progress bar: Pepe's
   sad pose (the skull art) and "Försök igen!" / "Try again!" / "¡Otra vez!".
   Nothing else. It slides back up after **2 s**. A further wrong tap while
   it is showing restarts the 2 s. The toast never takes layout space.
4. The question stays open. Other options stay tappable.

### The right tap (frame 5)

1. The option turns `cactus` green with ✓. Every other option dims; wrong
   ones stay red but dimmed.
2. Audio: the option's word is spoken, **then** the `correct` cue plays.
3. A green toast drops in: Pepe's happy pose, "Helt rätt!" / "That's it!" /
   "¡Eso es!", and the pair on one line ("el libro = boken"). A thin bar
   along its bottom counts down.
4. The countdown is **3 s, starting when the correct cue has finished** (or
   when the spoken word finishes, if effects are off or sound is muted). Then
   the next question appears.
5. A tap **anywhere** on the screen advances at once. A one-line hint sits in
   the empty space under the options: "Tryck var som helst för att fortsätta".
6. The "Siguiente" button and the bottom feedback sheet are removed.

### Interruptions

- Any new tap, whether an option or the prompt, stops whatever is speaking
  before it starts its own sequence. The pending cue from an interrupted
  sequence does not play.
- Leaving the screen stops speech and cancels timers.
- Muted: no audio, same visuals. The toasts and the 3 s run on their own
  clock.

## 5. What counts

- **Only the first tap on a question is recorded.** Right first time → right.
  Anything else → wrong, even though the learner eventually taps the right
  word. Response time is measured to the first tap.
- A question missed on the first tap joins the repair queue exactly as today.
  Repair questions use the same retry loop and, as today, record nothing.
- The summary (frame 9) reads "7 av 10 rätt på första försöket", and "Att
  repetera" lists every word missed on the first tap.

### Reducer changes (`packages/core/src/session.ts`)

`SessionState` gains `tried: string[]`, the wrong options tapped on the
current question.

- `answer` in `asking`, wrong option: if `tried` is empty, record a wrong
  result and add the question to `repair`. Append the option to `tried`, stay
  in `asking`. An option already in `tried` is ignored.
- `answer` in `asking`, right option: if `tried` is empty, record a right
  result. Move to `feedback` with `picked` set.
- `answer` in `repairing`: the same `tried` handling, but it never records a
  result and never re-queues. It moves to `repair-feedback` on the right
  option.
- `next` clears `tried` and `picked`, as it clears `picked` today.

Timing, toasts and audio sequencing belong to the screen, not the reducer.
The reducer stays pure and testable.

## 6. Testing

Core (TDD, `node:test`):
- Reducer: wrong-then-right records one wrong result; repeated taps on a
  locked option are ignored; right-first records one right result; repair
  records nothing; the repair queue gets a question once, however many wrong
  taps it took.
- `buildQuestions`: no `listen->en`; the direction mix; options and prompt in
  the requested gloss language; four distinct options in Swedish.
- `gloss` / `glossLanguage`.
- The seed validator's new checks.

App (manual, on the simulator, reported in the plan's log):
- Each question type in each language: what shows, what is said, in which
  voice.
- Wrong → toast for 2 s → wrong again → right → 3 s → next; tap-anywhere
  skip; no layout movement at any point.
- Effects off: voice only, no cues, no haptics. Sound off: silence, haptics.
- Language switch in settings re-renders home, stats and words immediately,
  and progress is untouched.
- First launch on a Swedish-locale simulator picks Svenska.

## 7. Delivery

After phase 2 merges, one implementation plan, in this order so each part
ships usable on its own:

1. **Answer loop** — reducer, `say()` sequencing, toasts, spoken options,
   removing listening questions, effects switch. Needs no content.
2. **Languages** — `sv` on `Word` and greetings, validator, `strings.ts` and
   every screen's copy, the language setting and first-launch default.
3. **Swedish content** — Claude's draft of 384 glosses and the greetings, then
   Anders's review. Can run alongside part 2.

The phase 2 plan's rule "Interface copy in Spanish" is superseded by part 2.

## 8. Deferred review findings

Minor findings from the per-task reviews, left for later:

- `answersInGloss` (quiz.ts) and `answersInEnglish` (leitner.ts) are the same predicate in two files.
- The "no listening-only questions" test partly restates the `Direction` type.
- Swedish glosses worth a native look: `romper` ("att ha sönder"), `gustar` ("att tycka om" loses the backwards construction), and two greetings share "Nu kör vi!".
- Replaying the prompt while a wrong option is being spoken skips that tap's buzz (any new tap stops what is speaking).
- The toast id is `Date.now()` rather than the tap sequence number.
- While a right answer is showing, the tap-anywhere layer also covers the X, so X advances instead of leaving.
- A very fast double tap on the same wrong option can speak it twice (the stats are unaffected).
