# Phase 4 — The Morning Notification: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One local notification each morning, at a time the learner picks, whose
body names the real due count and the real streak — and which does not arrive at
all if the day's round is already done.

**Architecture:** All four decisions the feature makes (whether to fire, on which
day, at what time, what to say) are pure functions in `packages/core/src/reminders.ts`,
unit-tested there. The app queues up to seven one-off `DATE` notifications and
re-queues the whole set after every round, every settings change and every
foreground, because a repeating `DAILY` trigger cannot be conditionally
suppressed. Exactly one app file — `apps/app/notifications.ts` — touches
`expo-notifications`, `Linking` or `AppState`.

**Tech Stack:** TypeScript on Node 24 (no build step), `node:test`, Expo SDK 57,
`expo-notifications@~57.0.20`, React Native 0.86, AsyncStorage.

**Spec:** `docs/superpowers/specs/2026-09-21-morning-notification-design.md` — read it
before Task 1. Every ruling below argues from it.

## Global Constraints

Copied from `CLAUDE.md` and the spec. Every task's requirements include these.

- **Never run `expo run:ios`, `expo run:android` or `expo prebuild`.** Two
  sessions have stalled for over an hour on native builds. Nothing in this plan
  needs one. Verify with `npx expo start` in `apps/app` and
  `xcrun simctl openurl booted "exp://127.0.0.1:8081"`.
- **Local notifications work in Expo Go on both platforms.** From SDK 53 it is
  *push* that requires a development build. This feature has no push.
- `packages/core` imports nothing from `node:`, `react` or `react-native`, and
  touches no filesystem. `noNodeImports.test.ts` enforces it.
- Relative imports in core carry explicit `.ts` extensions.
- Core never calls `Math.random()` and never constructs a `Date` for "now" —
  `planReminders` takes `today` and `nowMinutes` as parameters.
- Only `apps/app/components/Screen.tsx`, `apps/app/feedback.ts` and (as of
  Task 10) `apps/app/notifications.ts` may branch on platform or touch device
  APIs.
- Palette only through `apps/app/theme.ts`. 2px ink borders, hard offset
  shadows, never blurred. Touch targets ≥ 44px.
- Interface copy goes through `apps/app/i18n/strings.ts`. `Strings` is an
  interface, so a key missing from one language is a compile error. Keep it that
  way.
- **Stage files by name. Never `git add -A`.** Another session is committing to
  this repo right now.
- `apps/app/i18n/strings.ts` is also being edited on `claude/phase-3b-tracks-and-levels`.
  **Touch only the keys this plan adds.** Do not reformat, reorder or "tidy"
  anything else in that file.
- `npm test` and `npm run typecheck` from the repo root must both pass before
  every commit.

## File Structure

| File | Responsibility |
|---|---|
| `packages/core/src/reminders.ts` | *Create.* Every decision: which mornings, what tone, the time labels. Pure. |
| `packages/core/src/reminders.test.ts` | *Create.* Every rule in the spec's § 3. |
| `packages/core/src/index.ts` | *Modify.* One export line. |
| `apps/app/package.json` | *Modify.* `expo-notifications` dependency. |
| `apps/app/app.json` | *Modify.* The `expo-notifications` config plugin. |
| `apps/app/i18n/strings.ts` | *Modify.* `notification` section and `settings.reminder*` keys, in three languages. |
| `apps/app/storage/reminderStore.ts` | *Create.* Load / save the reminder settings. |
| `apps/app/i18n/language.tsx` | *Modify.* Export `loadLanguage()` so non-React code can read the stored choice. |
| `apps/app/notifications.ts` | *Create.* The only device-API file: permission, queueing, the `AppState` listener. |
| `apps/app/app/settings.tsx` | *Modify.* The reminder card. |
| `apps/app/app/_layout.tsx` | *Modify.* Start the refresh listener. |
| `apps/app/app/session.tsx` | *Modify.* Re-queue after the streak bump. |
| `CLAUDE.md` | *Modify.* Name `notifications.ts` on the device-API list. |

---

### Task 1: `reminderSlots` — which mornings, and which are skipped

**Files:**
- Create: `packages/core/src/reminders.ts`
- Test: `packages/core/src/reminders.test.ts`

**Interfaces:**
- Consumes: `addDays` from `./dates.ts`, `Streak` from `./streak.ts`.
- Produces: `ReminderSettings { enabled: boolean; hour: number; minute: number }`,
  `REMINDER_TIMES: readonly { hour: number; minute: number }[]`,
  `REMINDER_HORIZON: number`, `defaultReminderSettings(): ReminderSettings`,
  `reminderTimeLabel(t: { hour: number; minute: number }): string`,
  `reminderSlots(input: { settings: ReminderSettings; streak: Streak; today: string; nowMinutes: number; horizon?: number }): { date: string; hour: number; minute: number }[]`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/reminders.test.ts`:

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultReminderSettings, REMINDER_TIMES, reminderSlots, reminderTimeLabel,
} from './reminders.ts';

const at8 = { enabled: true, hour: 8, minute: 0 };
const noStreak = { days: 0, lastDate: null };

describe('REMINDER_TIMES', () => {
  test('is every half hour of the morning, 05:00 to 10:00', () => {
    assert.equal(REMINDER_TIMES.length, 11);
    assert.deepEqual(REMINDER_TIMES[0], { hour: 5, minute: 0 });
    assert.deepEqual(REMINDER_TIMES[10], { hour: 10, minute: 0 });
  });

  test('the default is 08:00, and off', () => {
    assert.deepEqual(defaultReminderSettings(), { enabled: false, hour: 8, minute: 0 });
  });
});

describe('reminderTimeLabel', () => {
  test('pads the minutes', () => {
    assert.equal(reminderTimeLabel({ hour: 8, minute: 0 }), '08:00');
    assert.equal(reminderTimeLabel({ hour: 5, minute: 30 }), '05:30');
    assert.equal(reminderTimeLabel({ hour: 10, minute: 0 }), '10:00');
  });
});

describe('reminderSlots', () => {
  test('queues nothing at all when reminders are off', () => {
    assert.deepEqual(
      reminderSlots({
        settings: { ...at8, enabled: false },
        streak: noStreak, today: '2026-09-21', nowMinutes: 7 * 60,
      }),
      [],
    );
  });

  test('queues a week of mornings, starting today, before the hour has passed', () => {
    const slots = reminderSlots({
      settings: at8, streak: noStreak, today: '2026-09-21', nowMinutes: 7 * 60,
    });
    assert.equal(slots.length, 7);
    assert.deepEqual(slots[0], { date: '2026-09-21', hour: 8, minute: 0 });
    assert.deepEqual(slots[6], { date: '2026-09-27', hour: 8, minute: 0 });
  });

  test("drops today once the morning has been and gone", () => {
    const slots = reminderSlots({
      settings: at8, streak: noStreak, today: '2026-09-21', nowMinutes: 9 * 60,
    });
    assert.equal(slots.length, 6);
    assert.equal(slots[0]?.date, '2026-09-22');
  });

  test('drops today on the exact minute — a notification for now is noise', () => {
    const slots = reminderSlots({
      settings: at8, streak: noStreak, today: '2026-09-21', nowMinutes: 8 * 60,
    });
    assert.equal(slots[0]?.date, '2026-09-22');
  });

  test("drops today when today's round is already done", () => {
    const slots = reminderSlots({
      settings: at8,
      streak: { days: 9, lastDate: '2026-09-21' },
      today: '2026-09-21', nowMinutes: 7 * 60,
    });
    assert.equal(slots.length, 6);
    assert.equal(slots[0]?.date, '2026-09-22');
  });

  test('keeps today when the last round was yesterday', () => {
    const slots = reminderSlots({
      settings: at8,
      streak: { days: 9, lastDate: '2026-09-20' },
      today: '2026-09-21', nowMinutes: 7 * 60,
    });
    assert.equal(slots[0]?.date, '2026-09-21');
  });

  test('honours a shorter horizon', () => {
    const slots = reminderSlots({
      settings: at8, streak: noStreak, today: '2026-09-21', nowMinutes: 7 * 60, horizon: 2,
    });
    assert.deepEqual(slots.map((s) => s.date), ['2026-09-21', '2026-09-22']);
  });

  test('crosses a month boundary', () => {
    const slots = reminderSlots({
      settings: at8, streak: noStreak, today: '2026-09-30', nowMinutes: 7 * 60, horizon: 2,
    });
    assert.deepEqual(slots.map((s) => s.date), ['2026-09-30', '2026-10-01']);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './reminders.ts'`. (Run the whole
suite rather than filtering by name: `node --test` takes its file globs from the
npm script, and extra flags after `--` are not reliably applied.)

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/reminders.ts`:

```ts
/**
 * When the morning reminder fires, and when it does not.
 *
 * Every decision the notification makes lives here as a pure function, so the
 * feature is tested by `node --test` rather than by watching a phone at 08:00.
 * The app layer is left with nothing but the queueing.
 *
 * Nothing here constructs a Date. `today` and `nowMinutes` come in as
 * parameters, which is what lets a test pin a morning down to the minute.
 */
import { addDays } from './dates.ts';
import type { Streak } from './streak.ts';

export interface ReminderSettings {
  enabled: boolean;
  /** Local wall-clock hour, 0-23. */
  hour: number;
  /** 0 or 30. */
  minute: number;
}

/**
 * The pills on the settings screen: every half hour of the morning.
 *
 * A fixed list rather than a free time picker because every answer in this app
 * is a tap and never a keyboard, and because a reminder outside the morning is
 * a different feature.
 */
export const REMINDER_TIMES: readonly { hour: number; minute: number }[] = [
  { hour: 5, minute: 0 }, { hour: 5, minute: 30 },
  { hour: 6, minute: 0 }, { hour: 6, minute: 30 },
  { hour: 7, minute: 0 }, { hour: 7, minute: 30 },
  { hour: 8, minute: 0 }, { hour: 8, minute: 30 },
  { hour: 9, minute: 0 }, { hour: 9, minute: 30 },
  { hour: 10, minute: 0 },
];

/**
 * Off, and at 08:00 when it is switched on.
 *
 * Off is deliberate: turning the switch on is what asks the operating system
 * for permission, and that is the only moment the learner has said they want
 * this. Asking at first launch is how a child taps "Don't allow" and burns the
 * grant permanently, because iOS never asks a second time.
 */
export const defaultReminderSettings = (): ReminderSettings =>
  ({ enabled: false, hour: 8, minute: 0 });

/**
 * Days scanned ahead. A week of not opening the app -- the learner who most
 * needs reminding -- and far under the 64 pending notifications iOS allows.
 *
 * Days *scanned*, not mornings queued: a skipped today leaves six.
 */
export const REMINDER_HORIZON = 7;

export const reminderTimeLabel = (t: { hour: number; minute: number }): string =>
  `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;

/**
 * The mornings worth waking someone for.
 *
 * A repeating daily trigger cannot be suppressed -- the operating system fires
 * it whatever the app knows -- so the app queues one-off notifications and
 * re-queues them whenever it learns something. These are the slots.
 */
export function reminderSlots(input: {
  settings: ReminderSettings;
  streak: Streak;
  today: string;
  /** Local `hour * 60 + minute`. */
  nowMinutes: number;
  horizon?: number;
}): { date: string; hour: number; minute: number }[] {
  const { settings, streak, today, nowMinutes, horizon = REMINDER_HORIZON } = input;
  if (!settings.enabled) return [];

  const at = settings.hour * 60 + settings.minute;
  const slots: { date: string; hour: number; minute: number }[] = [];

  for (let i = 0; i < horizon; i += 1) {
    const date = addDays(today, i);
    // The day's round is already done. This is the whole point of one-off
    // notifications: a reminder that arrives after the round teaches the
    // learner that the app does not know what they have done.
    if (streak.lastDate === date) continue;
    // Today's morning has been and gone.
    if (i === 0 && at <= nowMinutes) continue;
    slots.push({ date, hour: settings.hour, minute: settings.minute });
  }

  return slots;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test` — all of it, so `noNodeImports.test.ts` sees the new file too.
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no output, exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/reminders.ts packages/core/src/reminders.test.ts
git commit -m "Decide which mornings are worth waking someone for"
```

---

### Task 2: `reminderTone` — what the notification says

**Files:**
- Modify: `packages/core/src/reminders.ts`
- Test: `packages/core/src/reminders.test.ts`

**Interfaces:**
- Consumes: Task 1's module; `daysBetween` from `./dates.ts`.
- Produces: `ReminderTone`, a discriminated union on `kind`:
  `{ kind: 'streak'; due: number; streak: number } | { kind: 'due'; due: number } | { kind: 'streakOnly'; streak: number } | { kind: 'fresh' }`,
  and `reminderTone(due: number, streak: Streak, date: string): ReminderTone`.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/reminders.test.ts`, and add `reminderTone` to the
import list at the top of the file:

```ts
describe('reminderTone', () => {
  const live = { days: 9, lastDate: '2026-09-20' };   // a round yesterday

  test('due words and a live streak: the streak is the reason to get up', () => {
    assert.deepEqual(reminderTone(12, live, '2026-09-21'),
      { kind: 'streak', due: 12, streak: 9 });
  });

  test('due words and no streak: Pepe asks instead of promising', () => {
    assert.deepEqual(reminderTone(12, { days: 0, lastDate: null }, '2026-09-21'),
      { kind: 'due', due: 12 });
  });

  test('nothing due but a live streak', () => {
    assert.deepEqual(reminderTone(0, live, '2026-09-21'),
      { kind: 'streakOnly', streak: 9 });
  });

  test('nothing due and no streak', () => {
    assert.deepEqual(reminderTone(0, { days: 0, lastDate: null }, '2026-09-21'),
      { kind: 'fresh' });
  });

  test('a streak is still alive the morning after the last round', () => {
    assert.equal(reminderTone(5, live, '2026-09-21').kind, 'streak');
  });

  test('and dead the morning after that — never promise a streak already lost', () => {
    assert.equal(reminderTone(5, live, '2026-09-22').kind, 'due');
  });

  test('a streak of zero days is no streak, whatever the date says', () => {
    assert.equal(reminderTone(5, { days: 0, lastDate: '2026-09-20' }, '2026-09-21').kind, 'due');
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm test`
Expected: FAIL — `reminderTone is not a function`.

- [ ] **Step 3: Write the implementation**

Change the import line at the top of `packages/core/src/reminders.ts` to pull in
`daysBetween`:

```ts
import { addDays, daysBetween } from './dates.ts';
```

Then append to the same file:

```ts
/**
 * What the body says, as data rather than a string.
 *
 * The app turns this into one of three languages; core stays out of copy.
 */
export type ReminderTone =
  | { kind: 'streak'; due: number; streak: number }
  | { kind: 'due'; due: number }
  | { kind: 'streakOnly'; streak: number }
  | { kind: 'fresh' };

/**
 * A streak may only be promised on the morning it is still winnable.
 *
 * This falls out of `daysBetween` rather than being special-cased: on the
 * morning after a missed day the gap is already 2, and the streak really is
 * broken. Promising a learner a streak they have lost is the one thing that
 * would make the number worthless.
 */
export function reminderTone(due: number, streak: Streak, date: string): ReminderTone {
  const alive = streak.days > 0
    && streak.lastDate !== null
    && daysBetween(streak.lastDate, date) <= 1;

  if (due > 0) {
    return alive ? { kind: 'streak', due, streak: streak.days } : { kind: 'due', due };
  }
  return alive ? { kind: 'streakOnly', streak: streak.days } : { kind: 'fresh' };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/reminders.ts packages/core/src/reminders.test.ts
git commit -m "Say what is actually waiting, and never promise a lost streak"
```

---

### Task 3: `planReminders` — the whole plan, counts and all

**Files:**
- Modify: `packages/core/src/reminders.ts`, `packages/core/src/index.ts`
- Test: `packages/core/src/reminders.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 2; `Progress` from `./types.ts`.
- Produces: `Reminder { date: string; hour: number; minute: number; tone: ReminderTone }`
  and `planReminders(input: { settings: ReminderSettings; progress: readonly Progress[]; streak: Streak; today: string; nowMinutes: number; horizon?: number }): Reminder[]`,
  all exported from `@pepe/core`.

**Why `progress` and not words-plus-track:** filtering by track is the one thing
that would collide with phase 3b, which another session owns. The caller filters;
core never learns tracks exist.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/reminders.test.ts`, adding `planReminders` to the
imports and this helper just under them:

```ts
import type { Progress } from './types.ts';

/** Only `dueOn` matters to a plan; the rest is filler so the type is satisfied. */
const due = (id: string, dueOn: string): Progress => ({
  id, reps: 0, ease: 2.5, interval: 0, seen: 1, right: 1, wrong: 0,
  rightEsToEn: 0, rightEnToEs: 0, knownOn: null, lastSeen: null, dueOn,
});
```

```ts
describe('planReminders', () => {
  const at8 = { enabled: true, hour: 8, minute: 0 };

  const progress = [
    due('a', '2026-09-20'),   // overdue
    due('b', '2026-09-21'),   // due today
    due('c', '2026-09-23'),   // due in two days
    due('d', '2026-10-30'),   // far off
  ];

  test('an off switch plans nothing', () => {
    assert.deepEqual(
      planReminders({
        settings: { ...at8, enabled: false }, progress,
        streak: { days: 9, lastDate: '2026-09-20' },
        today: '2026-09-21', nowMinutes: 7 * 60,
      }),
      [],
    );
  });

  test("today's count is what home will show when the learner taps it", () => {
    const plan = planReminders({
      settings: at8, progress,
      streak: { days: 9, lastDate: '2026-09-20' },
      today: '2026-09-21', nowMinutes: 7 * 60, horizon: 1,
    });
    assert.deepEqual(plan, [{
      date: '2026-09-21', hour: 8, minute: 0,
      tone: { kind: 'streak', due: 2, streak: 9 },
    }]);
  });

  test('the count grows over the week as more words come due', () => {
    const plan = planReminders({
      settings: at8, progress,
      streak: { days: 9, lastDate: '2026-09-20' },
      today: '2026-09-21', nowMinutes: 7 * 60, horizon: 4,
    });
    assert.deepEqual(plan.map((r) => [r.date, r.tone]), [
      ['2026-09-21', { kind: 'streak', due: 2, streak: 9 }],
      ['2026-09-22', { kind: 'due', due: 2 }],
      ['2026-09-23', { kind: 'due', due: 3 }],
      ['2026-09-24', { kind: 'due', due: 3 }],
    ]);
  });

  test('only the nearest morning may claim the streak', () => {
    const plan = planReminders({
      settings: at8, progress,
      streak: { days: 9, lastDate: '2026-09-21' },   // round done today
      today: '2026-09-21', nowMinutes: 7 * 60, horizon: 3,
    });
    // Today is skipped entirely; tomorrow inherits the live streak.
    assert.deepEqual(plan.map((r) => [r.date, r.tone.kind]), [
      ['2026-09-22', 'streak'],
      ['2026-09-23', 'due'],
    ]);
  });

  test('a learner with no progress at all is invited, not nagged', () => {
    const plan = planReminders({
      settings: at8, progress: [],
      streak: { days: 0, lastDate: null },
      today: '2026-09-21', nowMinutes: 7 * 60, horizon: 1,
    });
    assert.deepEqual(plan[0]?.tone, { kind: 'fresh' });
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm test`
Expected: FAIL — `planReminders is not a function`.

- [ ] **Step 3: Write the implementation**

Add `Progress` to the imports at the top of `packages/core/src/reminders.ts`:

```ts
import type { Progress } from './types.ts';
```

Append to the same file:

```ts
export interface Reminder {
  /** Local ISO date, as `todayISO()` means it. */
  date: string;
  hour: number;
  minute: number;
  tone: ReminderTone;
}

/**
 * Words due on or before `date`. Words never introduced have no Progress and
 * are not counted: they are new, not due.
 */
const dueBy = (progress: readonly Progress[], date: string): number =>
  progress.filter((p) => p.dueOn <= date).length;

/**
 * Every morning worth queueing, in date order, soonest first.
 *
 * `progress` is the selected track's, already filtered by the caller -- the
 * count on the lock screen has to be the count on the home screen the learner
 * lands on. A future day's count is honest if the learner does nothing, and
 * the whole plan is re-queued the moment they don't.
 */
export function planReminders(input: {
  settings: ReminderSettings;
  progress: readonly Progress[];
  streak: Streak;
  today: string;
  nowMinutes: number;
  horizon?: number;
}): Reminder[] {
  return reminderSlots(input).map((slot) => ({
    ...slot,
    tone: reminderTone(dueBy(input.progress, slot.date), input.streak, slot.date),
  }));
}
```

- [ ] **Step 4: Export it from core**

In `packages/core/src/index.ts`, add one line after the `./streak.ts` export:

```ts
export * from './reminders.ts';
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/reminders.ts packages/core/src/reminders.test.ts packages/core/src/index.ts
git commit -m "Plan a week of mornings from progress, a streak and a clock"
```

---

### Task 4: The dependency and its config plugin

**Files:**
- Modify: `apps/app/package.json`, `apps/app/app.json`

**Interfaces:**
- Produces: `expo-notifications` importable from app code; an Android
  notification icon and accent colour for the built app.

**This is deliberate work, not verification.** CLAUDE.md forbids editing
`package.json` and `app.json` *to verify something*. Adding a dependency the
feature needs is exactly what those files are for. Say so in the commit message.

- [ ] **Step 1: Add the dependency**

In `apps/app/package.json`, add one line to `dependencies`, in alphabetical
position between `"expo-localization"` and `"expo-router"`:

```json
    "expo-notifications": "~57.0.20",
```

- [ ] **Step 2: Install**

Run from the repo root: `npm install`
Expected: succeeds; `package-lock.json` gains `expo-notifications`.

**Do not run `npx expo install`, `expo prebuild`, or any `expo run:*` command.**
`~57.0.20` is already the SDK 57 version (`npm view expo-notifications dist-tags`
shows `sdk-57: 57.0.20`).

- [ ] **Step 3: Add the config plugin**

In `apps/app/app.json`, `expo.plugins` currently ends with `"expo-localization"`.
Put a comma after it and append this element, so it becomes the last entry in
the array:

```json
      [
        "expo-notifications",
        {
          "icon": "./assets/android-icon-monochrome.png",
          "color": "#2E7D5B"
        }
      ]
```

The icon is the monochrome Android app icon that already ships in `assets/`;
Android notification icons must be monochrome, so it is exactly the right asset.
`#2E7D5B` is `colour.cactus` from `apps/app/theme.ts`.

- [ ] **Step 4: Verify the app still boots**

Run in `apps/app`: `npx expo start`
Then: `xcrun simctl openurl booted "exp://127.0.0.1:8081"`
Expected: the app loads as before. Stop the server with Ctrl-C.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/app/package.json apps/app/app.json package-lock.json
git commit -m "Take on expo-notifications, deliberately

Local and scheduled only -- no push, no tokens, no server. The plugin's
icon is the monochrome Android app icon that already ships, because an
Android notification icon has to be monochrome, and the accent is
colour.cactus from theme.ts.

This edits package.json and app.json on purpose, which is what those
files are for. The rule in CLAUDE.md is against editing them to verify
something, and nothing here is verification."
```

---

### Task 5: The copy, in three languages

**Files:**
- Modify: `apps/app/i18n/strings.ts`

**Interfaces:**
- Produces: `Strings['notification']` — `{ title: string; streak: (due: number, streak: number) => string; due: (due: number) => string; streakOnly: (streak: number) => string; fresh: string }`
  — and four new keys on `Strings['settings']`: `reminder`, `reminderHint`,
  `reminderDenied`, `reminderOpenSettings`.

**This file is also being edited on `claude/phase-3b-tracks-and-levels`. Add only
these keys. Change nothing else — no reordering, no reformatting.**

Plural forms differ per language and are written inline with ternaries, as every
other string in this file already does. Swedish `ord` is the same in the plural;
Swedish `dag`/`dagar` is not. Pepe's own line — the title — stays Spanish in every
language, as the file's header comment rules for the greetings.

- [ ] **Step 1: Extend the `Strings` interface**

In the `settings` block of `interface Strings`, after `effectsHint: string;`:

```ts
    reminder: string;
    reminderHint: string;
    reminderDenied: string;
    reminderOpenSettings: string;
```

And add a whole new section after the `settings` block, still inside
`interface Strings`:

```ts
  /** The morning notification. Written here, fired from notifications.ts. */
  notification: {
    /** Pepe's own voice — Spanish in every language, like the greetings. */
    title: string;
    streak: (due: number, streak: number) => string;
    due: (due: number) => string;
    streakOnly: (streak: number) => string;
    fresh: string;
  };
```

- [ ] **Step 2: Add the Spanish**

In `const es`, in its `settings` block after `effectsHint`:

```ts
    reminder: 'Recordatorio',
    reminderHint: '¿A qué hora te despierta Pepe?',
    reminderDenied: 'Pepe no puede avisarte. Las notificaciones están apagadas para Pepe Habla en los ajustes del teléfono.',
    reminderOpenSettings: 'Abrir ajustes',
```

And a new section after the `settings` block of `const es`:

```ts
  notification: {
    title: '¡Órale!',
    streak: (n, d) =>
      `${n} ${n === 1 ? 'palabra' : 'palabras'} por repasar — no pierdas tu racha de ${d} ${d === 1 ? 'día' : 'días'}.`,
    due: (n) => `${n} ${n === 1 ? 'palabra te espera' : 'palabras te esperan'}. Pepe te extraña.`,
    streakOnly: (d) => `Nada que repasar, pero no rompas tu racha de ${d} ${d === 1 ? 'día' : 'días'}.`,
    fresh: 'Nada que repasar. ¿Aprendemos palabras nuevas?',
  },
```

- [ ] **Step 3: Add the Swedish**

In `const sv`, in its `settings` block after `effectsHint`:

```ts
    reminder: 'Påminnelse',
    reminderHint: 'När ska Pepe väcka dig?',
    reminderDenied: 'Pepe kan inte nå dig. Notiser är avstängda för Pepe Habla i telefonens inställningar.',
    reminderOpenSettings: 'Öppna inställningar',
```

And after the `settings` block of `const sv`:

```ts
  notification: {
    title: '¡Órale!',
    streak: (n, d) => `${n} ord att repetera — behåll din svit på ${d} ${d === 1 ? 'dag' : 'dagar'}.`,
    due: (n) => `${n} ord väntar. Pepe saknar dig.`,
    streakOnly: (d) => `Inget att repetera, men bryt inte din svit på ${d} ${d === 1 ? 'dag' : 'dagar'}.`,
    fresh: 'Inget att repetera. Ska vi lära oss nya ord?',
  },
```

- [ ] **Step 4: Add the English**

In `const en`, in its `settings` block after `effectsHint`:

```ts
    reminder: 'Reminder',
    reminderHint: 'When should Pepe wake you?',
    reminderDenied: "Pepe can't reach you. Notifications are off for Pepe Habla in your phone's settings.",
    reminderOpenSettings: 'Open settings',
```

And after the `settings` block of `const en`:

```ts
  notification: {
    title: '¡Órale!',
    streak: (n, d) => `${n} ${n === 1 ? 'word is' : 'words are'} due — keep your ${d}-day streak.`,
    due: (n) => `${n} ${n === 1 ? 'word is' : 'words are'} waiting. Pepe misses you.`,
    streakOnly: (d) => `Nothing to review — but don't break your ${d}-day streak.`,
    fresh: 'Nothing due. Want to learn some new words?',
  },
```

- [ ] **Step 5: Typecheck — this is the test for this task**

Run: `npm run typecheck`
Expected: exit 0. A key added to one language and forgotten in another is a
compile error here, which is the whole reason `Strings` is an interface.

- [ ] **Step 6: Check the diff touches nothing else**

Run: `git diff --stat apps/app/i18n/strings.ts`
Expected: insertions only, no deletions beyond the lines you replaced.

- [ ] **Step 7: Commit**

```bash
git add apps/app/i18n/strings.ts
git commit -m "Give Pepe something specific to say in the morning"
```

---

### Task 6: `reminderStore` — the settings on disk

**Files:**
- Create: `apps/app/storage/reminderStore.ts`

**Interfaces:**
- Consumes: `defaultReminderSettings`, `REMINDER_TIMES`, `ReminderSettings` from `@pepe/core`.
- Produces: `loadReminderSettings(): Promise<ReminderSettings>`,
  `saveReminderSettings(s: ReminderSettings): Promise<void>`.

- [ ] **Step 1: Write the file**

Create `apps/app/storage/reminderStore.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultReminderSettings, REMINDER_TIMES, type ReminderSettings } from '@pepe/core';

const KEY = 'pepe-habla/reminder/v1';

/**
 * When Pepe should call, and whether he should at all.
 *
 * A stored time that is not one of the pills is thrown away rather than
 * honoured: the settings screen could not show it, so the learner would have
 * no way to change a reminder that kept firing.
 */
export async function loadReminderSettings(): Promise<ReminderSettings> {
  const fallback = defaultReminderSettings();
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw === null) return fallback;
    const stored = JSON.parse(raw) as Partial<ReminderSettings>;
    const known = REMINDER_TIMES.some(
      (t) => t.hour === stored.hour && t.minute === stored.minute,
    );
    return {
      enabled: stored.enabled === true,
      hour: known ? stored.hour! : fallback.hour,
      minute: known ? stored.minute! : fallback.minute,
    };
  } catch {
    return fallback;
  }
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // A preference that fails to persist is not worth interrupting practice
    // for; the learner sets it again next launch.
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/app/storage/reminderStore.ts
git commit -m "Remember when Pepe should call"
```

---

### Task 7: `notifications.ts` — the only file that touches the device

**Files:**
- Create: `apps/app/notifications.ts`
- Modify: `apps/app/i18n/language.tsx`

**Interfaces:**
- Consumes: `planReminders`, `todayISO` from `@pepe/core`; `loadReminderSettings`
  from Task 6; `STRINGS` from Task 5; `loadProgress`, `loadStreak` from the
  existing stores.
- Produces: `PermissionState = 'granted' | 'undetermined' | 'denied' | 'unsupported'`,
  `permissionState(): Promise<PermissionState>`, `askPermission(): Promise<PermissionState>`,
  `openSystemSettings(): Promise<void>`, `refreshReminders(): Promise<void>`,
  `startReminderRefresh(): () => void`. From `language.tsx`:
  `loadLanguage(): Promise<AppLanguage>`.

- [ ] **Step 1: Let non-React code read the stored language**

`notifications.ts` builds the body outside any React tree, so it cannot use
`useLanguage()`. Rather than duplicate the storage key, lift the read out of the
provider. In `apps/app/i18n/language.tsx`, add after `deviceLanguage()`:

```ts
/**
 * The stored choice, for code that runs outside the React tree — the morning
 * notification builds its body from it. Exported rather than duplicated so
 * there is one place that knows the key.
 */
export async function loadLanguage(): Promise<AppLanguage> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    return isAppLanguage(stored) ? stored : deviceLanguage();
  } catch {
    return deviceLanguage();
  }
}
```

- [ ] **Step 2: Decide which progress the count comes from**

The spec says the count is the **selected track's**. Phase 3b, which adds tracks,
is being built in another session. Check whether it has landed:

Run: `git show origin/main:apps/app/storage/trackStore.ts > /dev/null 2>&1 && echo MERGED || echo NOT-YET`

Use the matching `practiceProgress` helper in Step 3. Both are written out below;
take one, and do not invent a third.

- [ ] **Step 3: Write the file**

Create `apps/app/notifications.ts`:

```ts
import { AppState, Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { planReminders, todayISO, type Reminder, type VocabDb } from '@pepe/core';
import { STRINGS, type Strings } from './i18n/strings';
import { loadLanguage } from './i18n/language';
import { loadProgress } from './storage/progressStore';
import { loadReminderSettings } from './storage/reminderStore';
import { loadStreak } from './storage/streakStore';

/**
 * The morning reminder, and the only file in the app that knows what a device
 * is. Everything it decides was decided in core; what is left here is asking
 * permission and putting things in the operating system's queue.
 *
 * Every call is wrapped. A reminder that fails to schedule is a reminder that
 * does not arrive; it is never a reason to break a practice session. This file
 * is one of three allowed to know it is running somewhere unusual.
 */

const CHANNEL = 'morning';

/** Web has no notification queue worth the name. Everything below no-ops there. */
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

// A reminder that lands while the app is open should still be seen: the learner
// asked to be told, and silently swallowing it looks like a bug.
if (supported) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // An older runtime without the handler still schedules fine.
  }
}

export type PermissionState = 'granted' | 'undetermined' | 'denied' | 'unsupported';

const read = (p: { granted: boolean; canAskAgain: boolean }): PermissionState =>
  p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';

/** What the operating system currently allows. Never prompts. */
export async function permissionState(): Promise<PermissionState> {
  if (!supported) return 'unsupported';
  try {
    return read(await Notifications.getPermissionsAsync());
  } catch {
    return 'unsupported';
  }
}

/**
 * Prompt, once. Called only when the learner turns the switch on, which is the
 * only moment they have said they want this -- iOS never asks twice, so a
 * prompt at launch is how a child's "Don't allow" becomes permanent.
 */
export async function askPermission(): Promise<PermissionState> {
  if (!supported) return 'unsupported';
  try {
    return read(await Notifications.requestPermissionsAsync());
  } catch {
    return 'unsupported';
  }
}

/** The way back for someone who declined. Without it, they are stuck. */
export async function openSystemSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Nothing useful to say if the OS will not open its own settings.
  }
}

function body(t: Strings, r: Reminder): string {
  switch (r.tone.kind) {
    case 'streak': return t.notification.streak(r.tone.due, r.tone.streak);
    case 'due': return t.notification.due(r.tone.due);
    case 'streakOnly': return t.notification.streakOnly(r.tone.streak);
    case 'fresh': return t.notification.fresh;
  }
}

let queue: Promise<void> = Promise.resolve();

/**
 * Throw away the queued mornings and work out a new week's worth.
 *
 * Called after a round, after any settings change, and on every foreground.
 * Serialised, because a finished round and a foreground can land in the same
 * tick and two passes would cancel each other's work half-queued.
 */
export function refreshReminders(): Promise<void> {
  queue = queue.then(rebuild, rebuild);
  return queue;
}

async function rebuild(): Promise<void> {
  if (!supported) return;
  try {
    const settings = await loadReminderSettings();

    // This app schedules nothing else, so cancelling everything is both safe
    // and the only way to be sure a stale morning does not survive.
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!settings.enabled) return;
    // A grant revoked in the phone's settings queues nothing, even while our
    // own switch still says on.
    if ((await permissionState()) !== 'granted') return;

    const [db, streak, language] = await Promise.all([
      loadProgress(), loadStreak(), loadLanguage(),
    ]);
    const t = STRINGS[language];

    // One clock reading for the whole pass, so the date and the minute agree.
    const now = new Date();
    const plan = planReminders({
      settings,
      progress: practiceProgress(db),
      streak,
      today: todayISO(now),
      nowMinutes: now.getHours() * 60 + now.getMinutes(),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Pepe Habla',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    for (const r of plan) {
      const [y, m, d] = r.date.split('-').map(Number);
      await Notifications.scheduleNotificationAsync({
        content: { title: t.notification.title, body: body(t, r) },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          // Local wall-clock, which is exactly the day todayISO() means. Any
          // other construction and a reminder fires about yesterday's words.
          date: new Date(y!, m! - 1, d!, r.hour, r.minute, 0, 0),
          channelId: CHANNEL,
        },
      });
    }
  } catch {
    // Queueing is best-effort. Practice is not.
  }
}

/**
 * Start refreshing, and keep refreshing on every foreground. Returns the
 * unsubscribe, so the root layout can use it as an effect cleanup without
 * importing AppState itself.
 */
export function startReminderRefresh(): () => void {
  if (!supported) return () => {};
  void refreshReminders();
  const sub = AppState.addEventListener('change', (next) => {
    if (next === 'active') void refreshReminders();
  });
  return () => sub.remove();
}
```

Now append **one** `practiceProgress` to the end of that file.

**If Step 2 printed `NOT-YET`** — tracks are not on `main` yet:

```ts
/**
 * The progress the count is drawn from.
 *
 * The spec says the selected track's, but phase 3b -- which adds tracks -- has
 * not landed. Until it does there is one ladder, so this is all of it. When
 * 3b merges this becomes a filter and nothing else changes.
 */
const practiceProgress = (db: VocabDb) => Object.values(db.progress);
```

**If Step 2 printed `MERGED`** — tracks are on `main`:

```ts
/**
 * The selected track's progress, and only that.
 *
 * The number on the lock screen has to be the number on the home screen the
 * learner lands on when they tap it. A count across both ladders would match
 * neither.
 */
function practiceProgress(db: VocabDb, track: Track) {
  const mine = new Set(WORDS.filter((w) => w.track === track).map((w) => w.id));
  return Object.values(db.progress).filter((p) => mine.has(p.id));
}
```

and in that case also: add `type Track` to the `@pepe/core` import, add
`import { loadTrack } from './storage/trackStore';` and
`import { WORDS } from './storage/vocabulary';`, load the track alongside the
others in `rebuild` (`const [db, streak, language, track] = await Promise.all([loadProgress(), loadStreak(), loadLanguage(), loadTrack()]);`),
and pass `practiceProgress(db, track)`.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Confirm core is still pure**

Run: `npm test`
Expected: PASS, `noNodeImports` included — this file lives in the app, so core
stays clean.

- [ ] **Step 6: Commit**

```bash
git add apps/app/notifications.ts apps/app/i18n/language.tsx
git commit -m "Queue a week of mornings, and cancel them when the round is done"
```

---

### Task 8: The reminder card in settings

**Files:**
- Modify: `apps/app/app/settings.tsx`

**Interfaces:**
- Consumes: Tasks 5, 6, 7 — `REMINDER_TIMES`, `reminderTimeLabel`,
  `defaultReminderSettings`, `ReminderSettings`; `loadReminderSettings`,
  `saveReminderSettings`; `permissionState`, `askPermission`,
  `openSystemSettings`, `refreshReminders`, `PermissionState`;
  `t.settings.reminder*`.

The card goes **between the sound card and the "Pepe Habla" about card**, and
copies the sound card's idiom exactly: a title, a hint, a `Switch`, and a
sub-section that only appears when the switch is on — the same way the effects
row only appears when sound is on.

- [ ] **Step 1: Add the imports**

At the top of `apps/app/app/settings.tsx`, add `useEffect` to the React import,
and these below the existing imports:

```ts
import {
  defaultReminderSettings, REMINDER_TIMES, reminderTimeLabel, type ReminderSettings,
} from '@pepe/core';
import {
  askPermission, openSystemSettings, permissionState, refreshReminders,
  type PermissionState,
} from '../notifications';
import { loadReminderSettings, saveReminderSettings } from '../storage/reminderStore';
```

The `ScrollView` import already there is reused for the pills.

- [ ] **Step 2: Add the state and the handlers**

Inside `export default function Settings()`, after the `effects` state:

```ts
  const [reminder, setReminder] = useState<ReminderSettings>(defaultReminderSettings());
  const [permission, setPermission] = useState<PermissionState>('unsupported');

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [stored, state] = await Promise.all([loadReminderSettings(), permissionState()]);
      if (!alive) return;
      setReminder(stored);
      setPermission(state);
    })();
    return () => { alive = false; };
  }, []);

  const applyReminder = async (next: ReminderSettings) => {
    setReminder(next);
    await saveReminderSettings(next);
    await refreshReminders();
  };

  const toggleReminder = async (on: boolean) => {
    if (!on) { await applyReminder({ ...reminder, enabled: false }); return; }
    // Asking here, and nowhere else, is the whole permission strategy: this is
    // the only moment the learner has said they want to be reminded.
    const state = permission === 'granted' ? 'granted' : await askPermission();
    setPermission(state);
    if (state !== 'granted') { setReminder({ ...reminder, enabled: false }); return; }
    cue('tap');
    await applyReminder({ ...reminder, enabled: true });
  };
```

- [ ] **Step 3: Add the card**

In the JSX, between the sound card's closing `</View>` and the
`<View style={card}>` holding `Pepe Habla`:

```tsx
        {/* Hidden entirely on web, which has no notification queue. */}
        {permission !== 'unsupported' && (
          <View style={card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.display, fontSize: 17, color: colour.ink }}>
                  {t.settings.reminder}
                </Text>
                <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, marginTop: 2 }}>
                  {t.settings.reminderHint}
                </Text>
              </View>
              <Switch
                value={reminder.enabled}
                onValueChange={(on) => { void toggleReminder(on); }}
                disabled={permission === 'denied'}
                accessibilityLabel={t.settings.reminder}
                trackColor={{ false: colour.muted, true: colour.cactus }}
              />
            </View>

            {/* A learner who declined is not in an error state. No red, no
                warning, and nothing about it anywhere else in the app -- just
                the one door back, which the OS is the only one who can open. */}
            {permission === 'denied' && (
              <View style={{ marginTop: space.md, paddingTop: space.md, borderTopWidth: 1.5, borderTopColor: colour.ground }}>
                <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, lineHeight: 19 }}>
                  {t.settings.reminderDenied}
                </Text>
                <Pressable
                  onPress={() => { cue('tap'); void openSystemSettings(); }}
                  accessibilityRole="button"
                  accessibilityLabel={t.settings.reminderOpenSettings}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text style={{ fontFamily: font.bodyHeavy, fontSize: 15, color: colour.cactus }}>
                    {t.settings.reminderOpenSettings}
                  </Text>
                </Pressable>
              </View>
            )}

            {reminder.enabled && permission === 'granted' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.sm, paddingVertical: space.sm, paddingRight: space.lg }}
                style={{ marginTop: space.md, paddingTop: space.md, borderTopWidth: 1.5, borderTopColor: colour.ground }}
              >
                {REMINDER_TIMES.map((time) => {
                  const on = time.hour === reminder.hour && time.minute === reminder.minute;
                  const label = reminderTimeLabel(time);
                  return (
                    <Pressable
                      key={label}
                      onPress={() => {
                        cue('tap');
                        void applyReminder({ ...reminder, hour: time.hour, minute: time.minute });
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={label}
                      style={{
                        minHeight: 44, minWidth: 72, paddingHorizontal: space.md,
                        alignItems: 'center', justifyContent: 'center',
                        borderRadius: radius.pill, ...outline,
                        backgroundColor: on ? colour.cactus : colour.surface,
                      }}
                    >
                      <Text style={{
                        fontFamily: font.bodyHeavy, fontSize: 15,
                        color: on ? colour.surface : colour.ink,
                      }}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Look at it**

Run in `apps/app`: `npx expo start`
Then: `xcrun simctl openurl booted "exp://127.0.0.1:8081"`

Open Settings and check, by eye:
- the card sits between Sound and the Pepe Habla card, in the same idiom;
- the switch is off and no pills are showing;
- turning it on raises the iOS permission prompt;
- allowing it reveals the pills, with `08:00` filled green;
- tapping `06:30` moves the fill and clicks;
- turning it off hides the pills again;
- every pill is at least 44pt tall and wide.

Stop the server with Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add apps/app/app/settings.tsx
git commit -m "Let the learner say when, and say no"
```

---

### Task 9: Wiring — refresh on launch, on foreground, after a round

**Files:**
- Modify: `apps/app/app/_layout.tsx`, `apps/app/app/session.tsx`

**Interfaces:**
- Consumes: `startReminderRefresh`, `refreshReminders` from Task 7.

- [ ] **Step 1: Start the listener at the root**

In `apps/app/app/_layout.tsx`, add to the imports:

```ts
import { startReminderRefresh } from '../notifications';
```

and change the existing preparation effect in `RootLayout` from:

```ts
  useEffect(() => { void prepareAudio(); void prepareSpeech(); void loadSoundSettings(); }, []);
```

to:

```ts
  useEffect(() => { void prepareAudio(); void prepareSpeech(); void loadSoundSettings(); }, []);

  // Re-queue on launch and on every return to the app. Progress may have moved
  // in a round we already forgot about, and the queue would otherwise promise a
  // streak that is days dead.
  useEffect(() => startReminderRefresh(), []);
```

`startReminderRefresh` returns its own unsubscribe, so it works directly as the
effect's cleanup and `_layout.tsx` never imports `AppState`.

- [ ] **Step 2: Re-queue when a round is finished**

In `apps/app/app/session.tsx`, add to the imports:

```ts
import { refreshReminders } from '../notifications';
```

In the streak-bump effect, after `await saveStreak(next);` and before the `cue(...)`
line, add:

```ts
      // The day's round is done, so tomorrow's morning is the next one worth
      // queueing — and today's, if it has not fired yet, has to go.
      void refreshReminders();
```

- [ ] **Step 3: Typecheck and test**

Run: `npm run typecheck && npm test`
Expected: exit 0, PASS.

- [ ] **Step 4: Verify the suppression in Expo Go**

This is the one behaviour worth watching happen. Run in `apps/app`:
`npx expo start`, then `xcrun simctl openurl booted "exp://127.0.0.1:8081"`.

1. In Settings, turn the reminder on, allow, and pick the *next* pill after the
   current simulator time — if it is 07:10, pick `07:30`.
2. Background the app (Cmd-Shift-H in the simulator) and wait for the banner.
   It should name a real due count.
3. Reopen, play a full round to the summary.
4. In Settings, tap another pill and back, so the queue is rebuilt.
5. Confirm no further banner arrives today.

If the simulator's clock makes this slow, temporarily set the simulator's date
forward rather than editing any code. **Do not run a native build to test this.**

Stop the server with Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/_layout.tsx apps/app/app/session.tsx
git commit -m "Refresh the queue on launch, on return, and when a round lands"
```

---

### Task 10: Amend CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

The device-API rule names two files. `notifications.ts` is now a third, and the
rule is amended rather than quietly broken.

- [ ] **Step 1: Edit the rule**

In `CLAUDE.md`, under *Rules that are not negotiable*, replace:

```markdown
- Only `apps/app/components/Screen.tsx` and `apps/app/feedback.ts` may branch
  on platform or touch device APIs.
```

with:

```markdown
- Only `apps/app/components/Screen.tsx`, `apps/app/feedback.ts` and
  `apps/app/notifications.ts` may branch on platform or touch device APIs.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Name notifications.ts on the device-API list

It touches expo-notifications, Linking and AppState, and no-ops on web.
Concentrating that in one named file is what the rule is for."
```

---

## Manual verification, for Anders

Everything above is verified by `npm test`, `npm run typecheck` and Expo Go.
These three need a real device or a development build, and **no agent should
attempt either** — they are here so they are written down, not so they are done.

1. **A reminder that survives the app being killed.** Swipe Pepe Habla away from
   the app switcher, then wait for a queued morning. It should still arrive: the
   notifications are the OS's, not the app's.
2. **The Android icon and accent.** In a development build, the status-bar icon
   should be Pepe's silhouette in white, and the expanded notification's accent
   green. Expo Go shows Expo's own icon instead, so this cannot be checked there.
3. **A morning after several days of not opening the app.** Day 2 onward should
   say *"Pepe misses you"* and no longer claim a streak.

## Notes for whoever executes this

- `apps/app/i18n/strings.ts` is the collision file. If a rebase conflicts there,
  keep both sides: this plan only ever adds keys.
- The other session owns `data/seed/*.json`, `packages/core/src/levels.ts`,
  `unlock.ts`, `select.ts` and `apps/app/app/(tabs)/index.tsx`. Nothing here
  touches them.
- Rebase onto `origin/main` rather than merging, and re-run `npm test` after.
- **Never `git add -A`.** Every commit above stages by name for a reason.
