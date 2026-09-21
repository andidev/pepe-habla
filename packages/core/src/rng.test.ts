import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pickOne } from './rng.ts';

describe('pickOne', () => {
  test('picks the item the rng lands on', () => {
    assert.equal(pickOne(['a', 'b', 'c', 'd'], () => 0.5), 'c');
  });
  test('picks the first item at zero', () => {
    assert.equal(pickOne(['a', 'b', 'c'], () => 0), 'a');
  });
  test('stays in range when the rng returns almost one', () => {
    assert.equal(pickOne(['a', 'b'], () => 0.999999), 'b');
  });
});
