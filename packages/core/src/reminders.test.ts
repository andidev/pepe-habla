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
