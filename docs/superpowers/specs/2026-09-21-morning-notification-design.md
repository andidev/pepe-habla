# Pepe Habla — The Morning Notification (phase 4)

**Status:** design approved in conversation, 2026-09-21.

**Amends:** `2026-09-19-pepe-habla-design.md` § *Notifications*, which is three
paragraphs rather than a design. Where they disagree, this document wins. Reads
`2026-09-21-levels-and-tracks-design.md` for what a track is.

## Why

One reminder a morning, and it has to earn the interruption. A generic nudge is
a notification you swipe away; *"12 palabras esperan — no pierdas tu racha de 9
días"* is one you tap. And a reminder that arrives after the round is already
done is worse than no reminder at all — it teaches the learner that the app
does not know what they have done.

Everything below follows from those two sentences.

## 1. The shape: decisions in core, wiring as thin skin

The feature makes exactly four decisions — whether to fire, on what day, at
what hour, and what to say. All four live in `packages/core/src/reminders.ts`
as one pure function, and all four are unit-tested there.

```ts
export interface ReminderSettings {
  enabled: boolean;
  /** Local wall-clock. 0–23. */
  hour: number;
  /** 0 or 30. */
  minute: number;
}

export type ReminderTone =
  | { kind: 'streak';     due: number; streak: number }
  | { kind: 'due';        due: number }
  | { kind: 'streakOnly'; streak: number }
  | { kind: 'fresh' };

export interface Reminder {
  /** Local ISO date, as `todayISO()` means it. */
  date: string;
  hour: number;
  minute: number;
  tone: ReminderTone;
}

export function planReminders(input: {
  settings: ReminderSettings;
  /** The selected track's progress, already filtered by the caller. */
  progress: readonly Progress[];
  streak: Streak;
  today: string;
  /** Local `hour * 60 + minute`, so core constructs no Date at all. */
  nowMinutes: number;
  /** Mornings to queue. Default 7. */
  horizon?: number;
}): Reminder[];
```

`planReminders` returns `[]` when reminders are off, and otherwise a list in
date order, soonest first.

**Why it takes `Progress[]` and not words-plus-track.** Filtering by track is
the one thing that would collide with phase 3b's `types.ts` and `levels.ts`,
which another session owns. The caller filters exactly as home does —
`WORDS.filter(w => w.track === track)` — and core never learns that tracks
exist. The two sessions cannot step on each other, and `planReminders` stays
testable with a bare array.

Two other files, and no more:

- **`apps/app/notifications.ts`** — the only file in the app that imports
  `expo-notifications` or `Linking`. It mirrors `feedback.ts`: every device
  call wrapped, every failure swallowed, a no-op on web. It owns the
  `AppState` listener too, so no screen has to.
- **`apps/app/storage/reminderStore.ts`** — `loadReminderSettings` /
  `saveReminderSettings`, next to the other stores.

## 2. Whose count, and when nothing fires

**The count is the selected track's.** Tapping the notification lands on home,
and the number on home must be the number that was on the lock screen. A
learner on Gramática is told about grammar cards; a learner on Palabras about
words. Completeness across both tracks would buy a number that matches nothing
the learner then sees.

**The suppression follows the streak, not the track.** A round completed in
*either* track silences the morning, because the levels-and-tracks spec § 3
already rules that the streak counts a round in either. The two rules differ on
purpose: what you are *told* is about the ladder you are climbing, what
*silences* the reminder is having practised at all.

## 3. One-off notifications, re-queued

A repeating `DAILY` trigger cannot be conditionally suppressed — the OS fires
it whatever the app knows. So the app queues **one-off `DATE` triggers**, up to
seven, and re-queues the whole set whenever it learns something new: after a
round's streak bump, on any settings change, and on every foreground.

`new Date(y, m - 1, d, hour, minute)` is local wall-clock, which is exactly the
day `todayISO()` means. The scheduler and the due dates therefore cannot
disagree, and no notification can fire about yesterday's words.

Seven is a week of not opening the app — the learner who most needs reminding —
and sits far under the 64 pending notifications iOS allows.

### Skip rules

A slot for date `D` is dropped when any of these holds:

1. `settings.enabled` is false — nothing is queued at all. Permission is not
   core's business: `refreshReminders` checks it first and does not call
   `planReminders` without it, so a revoked grant queues nothing even while
   the stored setting still says on.
2. `streak.lastDate === D` — **the day's round is already done.** Only ever
   true for today, since no slot is in the past.
3. `D` is today and `hour * 60 + minute <= nowMinutes` — the morning has been
   and gone.

### What it says

The streak is **alive on `D`** when `streak.days > 0` and
`daysBetween(streak.lastDate, D) <= 1`.

| due on `D` | streak alive on `D` | tone | English body |
|---|---|---|---|
| > 0 | yes | `streak` | *12 words are due — keep your 9-day streak* |
| > 0 | no | `due` | *12 words are waiting. Pepe misses you.* |
| 0 | yes | `streakOnly` | *Nothing to review — but don't break your 9-day streak.* |
| 0 | no | `fresh` | *Nothing due. Want to learn some new words?* |

Only the nearest slot can ever claim a streak, and that falls out of the rule
rather than being special-cased: by the morning after a missed day,
`daysBetween` is 2 and the streak really is broken. Promising a learner a
streak they have already lost is the one thing that would make the number
worthless.

Due on a future `D` is `dueOn <= D` over the filtered progress — honest if the
learner does nothing, and re-queued the moment they don't. Words never
introduced have no `Progress` and are not counted: they are new, not due.

The title is `¡Órale!` in all three languages. Pepe's own lines stay Spanish,
as `strings.ts` already rules for the greetings; the body is translated.

## 4. Settings

A fourth card on the settings screen, in the idiom of the sound card:

```
PÅMINNELSE                                        [ on ]
När ska Pepe väcka dig?

( 05:00 )( 05:30 )( 06:00 )( 06:30 )( 07:00 )
( 07:30 )(● 08:00 )( 08:30 )( 09:00 )( 09:30 )( 10:00 )
```

Eleven half-hour pills from 05:00 to 10:00, horizontally scrollable, in the 2px
ink outline with the selected one filled `cactus`. Taps only — no keyboard, no
new dependency. Web has no notification queue, so `permission` there is
`unsupported` and the whole card, pills included, is hidden — a card that can
do nothing is worse than no card. `08:00` is the default, as the original spec
says. The pills are hidden while the switch is off, exactly as the effects row
is hidden while sound is off.

**Off by default, and nothing is asked at launch.** Turning the switch on is
what triggers the OS prompt, which is the only moment a learner has said they
want this. Asking at first launch is how a child taps *Don't allow* and burns
the grant permanently — iOS does not ask a second time.

### Permission denied is a state, not an error

If the request comes back denied, the switch returns to off and stays
disabled, the pills do not appear, and a muted line takes their place:

> *Pepe kan inte nå dig. Notiser är avstängda för Pepe Habla i telefonens
> inställningar.*

Under it, one tappable row — *Öppna inställningar* — calling
`Linking.openSettings()`. Without it a child who declined once has no way back.

No red, no warning icon, and nothing about it anywhere else in the app. A
learner who does not want to be reminded is not in an error state.

## 5. The dependency, and the native build nobody runs

`expo-notifications` goes into `apps/app/package.json` and its config plugin
into `app.json`, in **one deliberate commit that says so**. The plugin reuses
the existing `assets/android-icon-monochrome.png` and `colour.cactus`. This is
real work, not the verification-driven editing of those two files that CLAUDE.md
forbids.

**Local notifications work in Expo Go on both platforms.** From SDK 53 it is
*push* that requires a development build, and this feature has no push, no
tokens and no server. The original spec's "requires a development build"
described the wrong half of the module.

So verification splits cleanly:

- **Unit tests** cover every row of the tone table, all three skip rules, the
  projection and the horizon. This is where the feature is actually tested.
- **Expo Go** verifies the wiring for real: toggle on, grant, pick a pill,
  confirm what is queued and that a near-future slot fires.
- **The development build is a written manual check for Anders**, shipped as a
  list in the plan. No task attempts it.

**No task may run `expo run:ios`, `expo run:android` or `expo prebuild`.** Two
sessions have stalled for over an hour on exactly that. The plan repeats this
where an implementer will read it.

## 6. Amendment to CLAUDE.md

> Only `apps/app/components/Screen.tsx` and `apps/app/feedback.ts` may branch
> on platform or touch device APIs.

`apps/app/notifications.ts` joins that list. It touches `expo-notifications`,
`Linking` and `AppState`, and it must no-op on web where none of them exist.
Concentrating that in one named file is what the rule is for; the rule is
amended in the same PR rather than quietly broken.

## 7. Files

| File | What |
|---|---|
| `packages/core/src/reminders.ts` | `planReminders` and its types |
| `packages/core/src/reminders.test.ts` | every rule above |
| `packages/core/src/index.ts` | one export line |
| `apps/app/notifications.ts` | the only device-API file |
| `apps/app/storage/reminderStore.ts` | load / save the settings |
| `apps/app/i18n/strings.ts` | **new keys only** — the file 3b also edits |
| `apps/app/app/settings.tsx` | the reminder card |
| `apps/app/app/_layout.tsx` | start the refresh listener |
| `apps/app/app/session.tsx` | re-queue after the streak bump |
| `apps/app/app.json`, `apps/app/package.json` | the dependency and its plugin |
| `CLAUDE.md` | § 6 |

## 8. Out of scope

- Deep-linking a tapped notification to a particular screen. It opens the app,
  which is enough.
- More than one reminder a day, or an evening reminder.
- Any reminder outside the 05:00–10:00 window.
- Notifying about the track the learner is *not* on.
- Push notifications, tokens, or any server.
