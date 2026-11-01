import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { loadProgress, saveProgress, SAVE_KEY } from '../src/progress.js';

// Run the real game loop and Three.js scene with only browser/GPU boundaries replaced.
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').replace(/^import .*;$/gm, '');
function game(saved = null) {
  let now = 0, delta = 0, random = 0, nextFrame;
  const data = new Map(saved ? [[SAVE_KEY, saved]] : []);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  class Element {
    textContent = ''; children = []; style = {}; attributes = {}; handlers = {}; open = false;
    addEventListener(type, handler) { (this.handlers[type] ??= []).push(handler); }
    emit(type, event = {}) { for (const handler of this.handlers[type] ?? []) handler({ preventDefault() {}, ...event }); }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.append(child); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(key, value) { this.attributes[key] = value; }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
  }
  const elements = new Map(), motion = { matches: false };
  const element = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const document = { getElementById: element, createElement: () => new Element(), body: new Element(), addEventListener() {} };
  const sounds = [];
  const audio = { supported: true, unlock() {}, toggleMute: () => true };
  for (const sound of ['splash', 'bite', 'catch']) audio[sound] = () => sounds.push(sound);
  class Renderer {
    domElement = element('canvas');
    setPixelRatio() {} setSize() {} setRenderTarget() {}
    render(scene) { scene.updateMatrixWorld(); }
  }
  const math = Object.create(Math); math.random = () => random;
  const context = vm.createContext({
    THREE: { ...THREE, WebGLRenderer: Renderer, Clock: class { getDelta() { return delta; } } },
    document, window: {}, innerWidth: 390, innerHeight: 844, addEventListener() {},
    matchMedia: () => motion, Math: math, performance: { now: () => now },
    requestAnimationFrame: callback => { nextFrame = callback; },
    createAudio: () => audio,
    loadProgress: types => loadProgress(types, storage), saveProgress: progress => saveProgress(progress, storage)
  });
  vm.runInContext(source, context);
  return {
    element, data, sounds, motion,
    read: expression => vm.runInContext(expression, context),
    roll(value) { random = value; },
    tick(seconds = 0.05) { delta = seconds; now += seconds * 1000; nextFrame(); },
    advance(seconds) { for (let remaining = seconds; remaining > 0.00001; remaining -= 0.05) this.tick(Math.min(0.05, remaining)); },
    tap() { element('canvas').emit('pointerdown'); },
    until(state) {
      for (let i = 0; i < 160 && this.read('state') !== state; i++) this.tick();
      assert.equal(this.read('state'), state);
    }
  };
}

test('early tap cancels; a bite awards points once and persists the actual fish', () => {
  const g = game();
  g.tap(); g.tap(); assert.equal(g.read('state'), 'idle');
  assert.equal(g.read('progress.score'), 0);
  g.tap(); g.until('bite');
  assert.equal(g.read('biteMark.visible'), true);
  g.tap(); g.tap();
  assert.equal(g.read('progress.score'), 10);
  assert.equal(g.read('fish.scale.x'), 0.8);
  assert.equal(g.read('fish.material.color.getHexString()'), 'd2aa99');
  const saved = JSON.parse(g.data.get(SAVE_KEY));
  assert.equal(saved.caught.Карась, 1);
  assert.deepEqual(saved.bestCatch, { name: 'Карась', points: 10 });
  assert.deepEqual(g.sounds, ['splash', 'bite', 'catch']);
  g.advance(1.3); assert.equal(g.read('state'), 'idle');
  const reloaded = game(g.data.get(SAVE_KEY));
  assert.match(reloaded.element('hud').textContent, /Очки: 10/);
  reloaded.element('catch-log').emit('click');
  assert.equal(reloaded.element('catch-list').children[0].children[1].textContent, 'Карась');
  assert.equal(reloaded.element('catch-list').children[1].children[1].textContent, '???');
});

test('every species has a progressively shorter deadline; late taps miss', () => {
  for (const [index, roll] of [0, 0.5, 0.8, 0.92, 0.99].entries()) {
    const g = game(); g.roll(roll); g.tap(); g.until('bite');
    assert.equal(g.read('activeFish.name'), g.read(`FISH_TYPES[${index}].name`));
    const window = g.read('activeFish.biteWindow');
    assert.ok(window >= 0.4 && window <= 0.9);
    g.advance(window + 0.01); g.tap();
    assert.equal(g.read('progress.score'), 0);
    assert.equal(g.read('biteMark.visible'), false);
  }
});

test('collection pauses both fishing time and the bite deadline', () => {
  const g = game(); g.tap(); g.until('bite');
  g.element('catch-log').emit('click'); g.advance(10);
  assert.equal(g.read('state'), 'bite');
  g.element('close-log').emit('click'); g.tap();
  assert.equal(g.read('progress.score'), 10);
});

test('night changes species weights and lighting; the full cycle is 180 seconds', () => {
  const g = game(); g.roll(0.3);
  assert.equal(g.read('chooseFish().name'), 'Карась');
  const dayLight = g.read('sun.intensity');
  g.tick(90); assert.equal(g.read('isNight'), true);
  assert.equal(g.read('chooseFish().name'), 'Окунь');
  assert.ok(g.read('sun.intensity') < dayLight);
  assert.match(g.element('time-of-day').textContent, /Ночь/);
  g.tick(90); assert.equal(g.read('isNight'), false);
  assert.equal(g.read('sun.intensity'), dayLight);
});

test('reeds update at 8 fps, snap to pixels, and stop for reduced motion', () => {
  const g = game();
  const positions = () => g.read('JSON.stringify(reeds.map(reed => reed.position.toArray()))');
  const before = positions(); g.tick(0.05); assert.equal(positions(), before);
  g.advance(1); assert.notEqual(positions(), before);
  assert.equal(g.read('reeds.every(reed => Math.abs(reed.position.length() / pixelStep.length() - Math.round(reed.position.length() / pixelStep.length())) < 1e-6)'), true);
  g.motion.matches = true; g.tick();
  assert.equal(g.read('reeds.every(reed => reed.position.length() === 0)'), true);
  const frozen = positions(); g.advance(1); assert.equal(positions(), frozen);
});

test('portrait camera contains the hero and all cast corners', () => {
  const g = game();
  assert.equal(g.read(`[
    new THREE.Vector3(-4, 1.55, 0),
    ...[-2, 1].flatMap(x => [-1, 3].map(z => new THREE.Vector3(x, -0.15, z)))
  ].every(point => { point.project(cam); return Math.abs(point.x) < 0.95 && Math.abs(point.y) < 0.95; })`), true);
});
