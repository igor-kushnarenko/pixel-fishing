import test from 'node:test';
import assert from 'node:assert/strict';
import { FishingGame } from '../src/game.js';
import { FISH_TYPES, chooseFish, daylightAt } from '../src/fish.js';
import { isCastable, randomCastPoint, FISHERMAN, BOATS } from '../src/harbor-map.js';
import { loadProgress, saveProgress } from '../src/progress.js';

const target = { x: 785, y: 618 };
function setup(roll = 0) {
  const messages = [], sounds = [], saved = new Map();
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  const game = new FishingGame({ progress: loadProgress(FISH_TYPES, storage), random: () => roll,
    onChange: message => messages.push(message), onSound: sound => sounds.push(sound), onCatch: progress => saveProgress(progress, storage) });
  return { game, messages, sounds, storage };
}
function bite(game) { game.tap(target); game.update(0.6); game.update(game.biteAt); assert.equal(game.state, 'bite'); }

test('early tap cancels and a valid catch awards points only once, with compatible persistence', () => {
  const { game, sounds, storage } = setup();
  game.tap(target); game.tap(target); assert.equal(game.state, 'idle');
  bite(game); game.tap(); game.tap();
  assert.equal(game.progress.score, 10); assert.equal(game.progress.caught.Карась, 1);
  assert.deepEqual(game.progress.bestCatch, { name: 'Карась', points: 10 });
  assert.deepEqual(sounds, ['splash', 'bite', 'catch']);
  assert.deepEqual(loadProgress(FISH_TYPES, storage), game.progress);
  game.update(1.3); assert.equal(game.state, 'idle');
});

test('each of five species can be caught, and each deadline rejects a late hook', () => {
  for (const [index, roll] of [0, 0.5, 0.8, 0.92, 0.99].entries()) {
    const { game } = setup(roll); bite(game);
    assert.equal(game.activeFish, FISH_TYPES[index]);
    game.update(game.activeFish.biteWindow - 0.01); assert.equal(game.state, 'bite');
    game.tap(); assert.equal(game.progress.score, FISH_TYPES[index].points);
    const late = setup(roll).game; bite(late);
    late.update(late.activeFish.biteWindow); assert.equal(late.state, 'idle');
    late.tap(target); assert.equal(late.progress.score, 0);
  }
});

test('collection and hidden-page pauses preserve the bite window and day clock', () => {
  const { game } = setup(); bite(game); game.update(0.15);
  const before = game.biteRemaining, time = game.dayTime;
  game.paused = true; game.update(100);
  game.tap(); assert.equal(game.state, 'bite'); assert.equal(game.progress.score, 0);
  assert.equal(game.biteRemaining, before); assert.equal(game.dayTime, time);
  game.paused = false; game.tap(); assert.equal(game.progress.score, 10);
});

test('night changes rarity weights and the day/night cycle is exactly 180 seconds', () => {
  const { game } = setup(); const initial = game.daylight;
  assert.equal(chooseFish(false, () => 0.3).name, 'Карась');
  game.update(90); assert.equal(game.isNight, true); assert.ok(game.daylight < initial);
  assert.equal(chooseFish(true, () => 0.3).name, 'Окунь');
  game.update(90); assert.equal(game.isNight, false); assert.equal(game.daylight, initial);
  assert.equal(daylightAt(45), daylightAt(225));
});

test('land, docks, hulls and invalid coordinates do not accept casts', () => {
  const { game } = setup();
  for (const point of [FISHERMAN, { x: 520, y: 120 }, { x: 1250, y: 240 }, { x: -2, y: 50 }, { x: NaN, y: 630 }, { x: 900, y: Infinity }]) {
    assert.equal(isCastable(point), false); game.tap(point); assert.equal(game.state, 'idle');
  }
  for (const boat of BOATS) {
    const height = boat.width * boat.crop[3] / boat.crop[2];
    assert.equal(isCastable({ x: boat.x, y: boat.y + height * 0.32 }), false);
  }
  assert.equal(isCastable(target), true);
  game.tap(target); assert.equal(game.state, 'cast');
});

test('keyboard cast selection always finds safe water, including a pathological random source', () => {
  for (const value of [0, 0.2, 0.5, 0.7, 0.99]) assert.equal(isCastable(randomCastPoint(() => value)), true);
  let seed = 42;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < 1000; i++) assert.equal(isCastable(randomCastPoint(random)), true);
});
