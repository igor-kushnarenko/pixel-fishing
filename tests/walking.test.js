import test from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../src/player.js';
import { isWalkable, isOpenWater, FISHERMAN } from '../src/harbor-map.js';
import { findPath } from '../src/pathfinding.js';

const walk = (player, seconds = 30) => { for (let t = 0; t < seconds; t += 1 / 30) player.update(1 / 30); };

test('the fisherman starts on the pier facing water and can fish there', () => {
  const player = new Player();
  assert.ok(isWalkable(FISHERMAN)); assert.ok(player.canFish);
  assert.ok(isOpenWater(player.castPoint(null, () => 0.5)));
  player.face(1, 0.25); assert.equal(player.canFish, false, 'looking along the pier is not water');
});

test('keyboard input never walks into water or through obstacles', () => {
  const player = new Player(); player.input = { x: 0, y: -1 };
  walk(player, 10);
  assert.ok(isWalkable(player));
  player.input = { x: 0, y: 0 }; walk(player, 0.1); assert.equal(player.moving, false);
});

test('tap-to-move routes from the pier to the beach and the quay', () => {
  for (const goal of [{ x: 350, y: 780 }, { x: 999, y: 481 }, { x: 300, y: 650 }]) {
    const player = new Player(); player.moveTo(goal); walk(player);
    assert.ok(Math.hypot(player.x - goal.x, player.y - goal.y) < 3, `reached ${goal.x},${goal.y}`);
  }
});

test('tapping water walks to the nearest shore and turns to face it', () => {
  const player = new Player(); player.moveTo({ x: 950, y: 600 }); walk(player);
  assert.ok(isWalkable(player)); assert.ok(player.canFish);
  assert.equal(findPath(player, { x: -500, y: -500 }), null);
});
