import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultReminderSettings, REMINDER_TIMES, reminderSlots, reminderTimeLabel, reminderTone,
  planReminders,
} from './reminders.ts';
import type { Progress } from './types.ts';

/** Only `dueOn` matters to a plan; the rest is filler so the type is satisfied. */
const due = (id: string, dueOn: string): Progress => ({
  id, reps: 0, ease: 2.5, interval: 0, seen: 1, right: 1, wrong: 0,
  rightEsToEn: 0, rightEnToEs: 0, knownOn: null, lastSeen: null, dueOn,
});

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
