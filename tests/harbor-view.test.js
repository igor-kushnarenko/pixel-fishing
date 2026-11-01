import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { HarborView } from '../src/harbor-view.js';
import { BOATS, MAP_WIDTH, MAP_HEIGHT } from '../src/harbor-map.js';

function cameraView(width, height) {
  const view = Object.create(HarborView.prototype);
  Object.assign(view, { width, height, zoom: 1, pan: new THREE.Vector2(), camera: new THREE.OrthographicCamera(0, 1448, 1086, 0, 0.1, 100) });
  view.camera.position.z = 50;
  view.baseScale = Math.min((width - 24) / MAP_WIDTH, (height - 154) / MAP_HEIGHT);
  view.updateCamera(); return view;
}
function screenPoint(view, point) {
  const p = new THREE.Vector3(point.x, MAP_HEIGHT - point.y, 0).project(view.camera);
  return { x: (p.x + 1) / 2 * view.width, y: (1 - p.y) / 2 * view.height };
}
test('desktop and portrait camera contain the complete map and round-trip tap coordinates', () => {
  for (const [width, height] of [[1194, 831], [390, 844], [844, 390]]) {
    const view = cameraView(width, height);
    for (const point of [{ x: 0, y: 0 }, { x: MAP_WIDTH, y: MAP_HEIGHT }, { x: 785, y: 618 }]) {
      const screen = screenPoint(view, point);
      assert.ok(screen.x >= 0 && screen.x <= width && screen.y >= 0 && screen.y <= height);
      const restored = view.screenToMap(screen.x, screen.y);
      assert.ok(Math.abs(restored.x - point.x) < 1e-8 && Math.abs(restored.y - point.y) < 1e-8);
    }
  }
});
test('zoom preserves water under the pointer, pan is bounded and fit restores the whole map', () => {
  const view = cameraView(390, 844), x = 220, y = 460;
  const before = view.screenToMap(x, y); view.zoomAt(2, x, y);
  const after = view.screenToMap(x, y);
  assert.ok(Math.abs(before.x - after.x) < 1e-8 && Math.abs(before.y - after.y) < 1e-8);
  view.drag(10000, -10000); assert.ok(Math.abs(view.pan.x) <= MAP_WIDTH * 0.45);
  view.fit(); assert.equal(view.zoom, 1); assert.equal(view.pan.length(), 0);
});
test('reduced motion freezes boats, smoke, light flicker and lighthouse beam while keeping them visible', () => {
  const view = cameraView(390, 844);
  const mesh = () => Object.assign(new THREE.Object3D(), { material: { opacity: 1 } });
  Object.assign(view, {
    time: 4, dayMaterials: [], tintMaterials: [],
    water: { uniforms: { uTime: { value: 0 }, uMotion: { value: 1 } } },
    boats: BOATS.map(boat => ({ ...boat, mesh: mesh() })),
    smoke: [0, 1 / 3, 2 / 3].map(phase => ({ phase, chimney: { x: 518, y: 47 }, mesh: mesh() })),
    glows: [{ phase: 0, mesh: mesh() }], beam: mesh(), beamMaterial: {},
    drawFishing() {}, renderer: { render() {} }, scene: new THREE.Scene()
  });
  const game = { daylight: 0.2, paused: false };
  const snapshot = () => JSON.stringify({ boats: view.boats.map(b => [b.mesh.position.toArray(), b.mesh.rotation.z]), smoke: view.smoke.map(s => [s.mesh.position.toArray(), s.mesh.material.opacity]), beam: view.beam.rotation.z, glow: view.glows[0].mesh.material.opacity });
  view.render(game, 0.1, false); const animated = snapshot();
  view.render(game, 0.5, false); assert.notEqual(snapshot(), animated);
  view.render(game, 0.1, true); const staticFrame = snapshot();
  view.render(game, 5, true); assert.equal(snapshot(), staticFrame);
  assert.equal(view.water.uniforms.uMotion.value, 0);
  assert.ok(view.smoke[0].mesh.material.opacity > 0);
  assert.ok(view.glows[0].mesh.material.opacity > 0);
});
