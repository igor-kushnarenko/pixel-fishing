import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProgress, saveProgress, SAVE_KEY } from '../src/progress.js';

const fish = [{ name: 'Карась', points: 10 }, { name: 'Щука', points: 80 }];
const empty = { score: 0, caught: { Карась: 0, Щука: 0 }, bestCatch: null };
function memory(value = null) {
  return { getItem: key => key === SAVE_KEY ? value : null, setItem: (key, next) => { assert.equal(key, SAVE_KEY); value = next; } };
}

test('new game and save/load round trip preserve points, counts and best catch', () => {
  const storage = memory();
  assert.deepEqual(loadProgress(fish, storage), empty);
  const progress = { score: 100, caught: { Карась: 2, Щука: 1 }, bestCatch: { name: 'Щука', points: 80 } };
  assert.equal(saveProgress(progress, storage), true);
  assert.deepEqual(loadProgress(fish, storage), progress);
});

test('invalid JSON, negative/fractional counts and inconsistent points reset safely', () => {
  for (const value of ['{', 'null', '{}',
    JSON.stringify({ score: 10, caught: { Карась: -1, Щука: 0 } }),
    JSON.stringify({ score: 5, caught: { Карась: 0.5, Щука: 0 } }),
    JSON.stringify({ score: 200, caught: { Карась: 1, Щука: 0 } })]) {
    assert.deepEqual(loadProgress(fish, memory(value)), empty);
  }
});

test('unavailable storage never prevents gameplay', () => {
  const storage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  assert.deepEqual(loadProgress(fish, storage), empty);
  assert.equal(saveProgress(empty, storage), false);
});

test('best catch is validated against actual caught species', () => {
  const saved = { score: 10, caught: { Карась: 1, Щука: 0 }, bestCatch: { name: 'Щука', points: 999 } };
  assert.deepEqual(loadProgress(fish, memory(JSON.stringify(saved))).bestCatch, { name: 'Карась', points: 10 });
});
