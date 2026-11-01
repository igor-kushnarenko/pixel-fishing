// Pocket Fishing — Vite + Three.js. Style inspired by Pixel Plays (MIT, Amir Mushich): https://github.com/amirmushichge/pixel-plays
import * as THREE from 'three';
import { createAudio } from './audio.js';
import { loadProgress, saveProgress } from './progress.js';

const audio = createAudio();
document.addEventListener('pointerdown', audio.unlock, { once: true, capture: true });
const muteButton = document.getElementById('mute');
muteButton.disabled = !audio.supported;
muteButton.addEventListener('click', () => {
  const muted = audio.toggleMute();
  muteButton.setAttribute('aria-pressed', String(muted));
  muteButton.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
  muteButton.textContent = muted ? 'Звук: выкл.' : 'Звук: вкл.';
});

const FISH_TYPES = [
  { name: 'Карась', color: '#d2aa99', size: 0.8, rarity: 45, points: 10, biteWindow: 0.9 },
  { name: 'Окунь', color: '#6daa2c', size: 1, rarity: 28, points: 20, biteWindow: 0.75 },
  { name: 'Форель', color: '#6dc2ca', size: 1.2, rarity: 16, points: 40, biteWindow: 0.6 },
  { name: 'Щука', color: '#346524', size: 1.5, rarity: 8, points: 80, biteWindow: 0.5 },
  { name: 'Золотая рыбка', color: '#dad45e', size: 0.9, rarity: 3, points: 200, biteWindow: 0.4 }
];

const DAY_LENGTH = 180;
const NIGHT_WEIGHTS = [20, 24, 28, 18, 10];
let dayTime = DAY_LENGTH / 4, isNight = false;

function chooseFish() {
  const weights = isNight ? NIGHT_WEIGHTS : FISH_TYPES.map(type => type.rarity);
  let roll = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (const [index, type] of FISH_TYPES.entries()) {
    roll -= weights[index];
    if (roll < 0) return type;
  }
  return FISH_TYPES[FISH_TYPES.length - 1];
}

const W = 160, H = 120;
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(1);
document.body.appendChild(renderer.domElement);
const rt = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: new THREE.DepthTexture(W, H) });

const scene = new THREE.Scene();
scene.background = new THREE.Color('#ffffff');
const cam = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 100);
cam.position.set(10, 10, 10); cam.lookAt(0, 0, 0);
const hemisphere = new THREE.HemisphereLight('#fff6d0', '#5a4a8a', 1.2); scene.add(hemisphere);
const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(-5, 10, 3); scene.add(sun);

const mat = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
const box = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); scene.add(m); return m; };

// water + pier + character
const water = box(14, 0.4, 14, '#3a7bd5', 0, -0.4, 0);
const dayColors = { sky: new THREE.Color('#fff6d0'), ground: new THREE.Color('#5a4a8a'), sun: new THREE.Color('#ffffff'), water: new THREE.Color('#3a7bd5') };
const nightColors = { sky: new THREE.Color('#597dce'), ground: new THREE.Color('#140c1c'), sun: new THREE.Color('#6dc2ca'), water: new THREE.Color('#202d62') };
function updateDayNight(dt) {
  dayTime = (dayTime + dt) % DAY_LENGTH;
  const daylight = (Math.sin(dayTime / DAY_LENGTH * Math.PI * 2) + 1) / 2;
  isNight = daylight < 0.35;
  hemisphere.color.copy(nightColors.sky).lerp(dayColors.sky, daylight);
  hemisphere.groundColor.copy(nightColors.ground).lerp(dayColors.ground, daylight);
  hemisphere.intensity = 0.35 + daylight * 0.85;
  sun.color.copy(nightColors.sun).lerp(dayColors.sun, daylight);
  sun.intensity = 0.2 + daylight * 1.3;
  water.material.color.copy(nightColors.water).lerp(dayColors.water, daylight);
  const label = document.getElementById('time-of-day'), text = isNight ? 'Ночь · редкая рыба ближе' : 'День';
  if (label.textContent !== text) label.textContent = text;
}

// Voxel bank, trees and reeds. One world step projects to one render-target pixel.
box(4, 0.8, 14, '#854c30', -6.5, -0.35, 0);
box(4, 0.16, 14, '#6daa2c', -6.5, 0.12, 0);
for (const [x, z, height] of [[-6.5, -4.5, 2.6], [-7, -0.5, 3.2], [-6.5, 3.5, 2.8]]) {
  box(0.5, height, 0.5, '#854c30', x, height / 2, z);
  box(1.8, 1.3, 1.8, '#346524', x, height, z);
  box(1.2, 0.8, 1.2, '#6daa2c', x, height + 0.85, z);
}
const reeds = [], reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
for (const [index, z] of [-5.5, -3, 1.7, 2.2, 3.8, 4.3, 5.8].entries()) {
  const x = -4.4 + (index % 2) * 0.25, height = 0.7 + (index % 3) * 0.15;
  box(0.1, height / 2, 0.1, '#346524', x, height / 4, z);
  const top = new THREE.Group(); scene.add(top);
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.1, height / 2, 0.1), mat('#6daa2c'));
  stem.position.set(x, height * 0.75, z); top.add(stem);
  const seed = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), mat('#854c30'));
  seed.position.set(x, height + 0.08, z); top.add(seed);
  reeds.push(top);
}
let sceneryTime = 0, lastSwayTick = -1;
const pixelStep = new THREE.Vector3();
function updateScenery(dt) {
  sceneryTime += dt;
  const tick = reducedMotion.matches ? -2 : Math.floor(sceneryTime * 8);
  if (tick === lastSwayTick) return;
  lastSwayTick = tick;
  pixelStep.setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar((cam.top - cam.bottom) / H);
  reeds.forEach((reed, index) => {
    const pixels = reducedMotion.matches ? 0 : Math.round(Math.sin(tick * 0.55 + index));
    reed.position.copy(pixelStep).multiplyScalar(pixels);
  });
}
for (let i = 0; i < 5; i++) box(1.6, 0.2, 0.9, i % 2 ? '#a0703c' : '#8a5a2b', -4, 0.1, -4 + i);
box(0.3, 1.2, 0.3, '#5a3a1b', -4.7, -0.3, -4); box(0.3, 1.2, 0.3, '#5a3a1b', -3.3, -0.3, 0);
const hero = new THREE.Group(); scene.add(hero); hero.position.set(-4, 0.2, 0);
const part = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); hero.add(m); return m; };
part(0.5, 0.6, 0.4, '#d04040', 0, 0.6, 0); part(0.4, 0.4, 0.4, '#f0c090', 0, 1.1, 0); part(0.5, 0.3, 0.5, '#e8d040', 0, 1.35, 0);
part(0.5, 0.3, 0.3, '#303060', 0, 0.15, 0);
const rod = part(0.06, 0.06, 2.2, '#6a4a2a', 0.2, 0.9, 1.0); rod.rotation.x = -0.4;
const bob = box(0.25, 0.25, 0.25, '#ff3030', 0, -100, 0);
const biteMark = new THREE.Group();
const markMaterial = new THREE.MeshBasicMaterial({ color: '#dad45e' });
for (const [height, y] of [[0.5, 0.3], [0.12, -0.12]]) {
  const pixel = new THREE.Mesh(new THREE.BoxGeometry(0.15, height, 0.15), markMaterial);
  pixel.position.y = y; biteMark.add(pixel);
}
biteMark.visible = false; scene.add(biteMark);
const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#202020' })); scene.add(line);
const fish = box(0.6, 0.3, 0.2, '#e08030', 0, -100, 0);

// post: palette quantize + outline
const PAL = ['#140c1c','#442434','#30346d','#4e4a4e','#854c30','#346524','#d04648','#757161','#597dce','#d27d2c','#8595a1','#6daa2c','#d2aa99','#6dc2ca','#dad45e','#deeed6']
  .map(h => new THREE.Color(h));
const post = new THREE.ShaderMaterial({
  uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, pal: { value: PAL.map(c => new THREE.Vector3(c.r, c.g, c.b)) }, px: { value: new THREE.Vector2(1 / W, 1 / H) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
  fragmentShader: `uniform sampler2D tColor,tDepth; uniform vec3 pal[16]; uniform vec2 px; varying vec2 vUv;
  void main(){ vec3 c=texture2D(tColor,vUv).rgb; float d=texture2D(tDepth,vUv).r;
    float e=0.; e=max(e,texture2D(tDepth,vUv+vec2(px.x,0)).r-d); e=max(e,texture2D(tDepth,vUv+vec2(0,px.y)).r-d);
    e=max(e,texture2D(tDepth,vUv-vec2(px.x,0)).r-d); e=max(e,texture2D(tDepth,vUv-vec2(0,px.y)).r-d);
    if(e>0.01) c*=0.35;
    vec3 best=pal[0]; float bd=1e9; for(int i=0;i<16;i++){ vec3 q=c-pal[i]; float k=dot(q,q); if(k<bd){bd=k;best=pal[i];} }
    if(d>0.9999 && e<=0.01) best=vec3(1.); gl_FragColor=vec4(best,1.);
    #include <colorspace_fragment>
  }`,
  depthTest: false, depthWrite: false
});
const postScene = new THREE.Scene(); postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
const postCam = new THREE.Camera();

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  const a = innerWidth / innerHeight, h = Math.max(6, 4.2 / a);
  cam.position.set(8, 10, 10); cam.lookAt(-2, 0, 0);
  cam.left = -h * a; cam.right = h * a; cam.top = h; cam.bottom = -h; cam.updateProjectionMatrix();
  rt.setSize(Math.round(H * a), H); post.uniforms.px.value.set(1 / Math.round(H * a), 1 / H);
}
addEventListener('resize', resize); resize();

// game loop: idle -> cast -> wait -> bite -> (hook|miss)
const hud = document.getElementById('hud');
const progress = loadProgress(FISH_TYPES);
const collection = document.getElementById('collection');
let pausedAt = 0;
document.getElementById('catch-log').addEventListener('click', () => {
  const list = document.getElementById('catch-list'); list.replaceChildren();
  for (const type of FISH_TYPES) {
    const count = progress.caught[type.name], row = document.createElement('li');
    const swatch = document.createElement('span'); swatch.className = 'fish-swatch';
    swatch.style.backgroundColor = count ? type.color : '#757161'; swatch.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span'); name.textContent = count ? type.name : '???';
    const counter = document.createElement('span'); counter.className = 'fish-count'; counter.textContent = `× ${count}`;
    row.append(swatch, name, counter); list.append(row);
  }
  const total = Object.values(progress.caught).reduce((sum, count) => sum + count, 0);
  const best = progress.bestCatch ? `${progress.bestCatch.name} (${progress.bestCatch.points} очк.)` : 'пока нет';
  document.getElementById('catch-summary').textContent = `Очки: ${progress.score} · Поймано: ${total}\nЛучший улов: ${best}`;
  pausedAt = performance.now(); collection.showModal();
});
document.getElementById('close-log').addEventListener('click', () => collection.close());
collection.addEventListener('close', () => {
  if (state === 'bite') biteStartedAt += performance.now() - pausedAt;
});
let state = 'idle', t = 0, biteAt = 0, biteStartedAt = 0, activeFish = null, lastCatch = null, target = new THREE.Vector3();
const say = s => hud.textContent = `Очки: ${progress.score}${lastCatch ? ` · ${lastCatch.name}` : ''} — ${s}`;
function miss() {
  state = 'idle'; bob.position.y = -100; biteMark.visible = false;
  say('сорвалась. тапни, чтобы закинуть');
}
function tap(e) {
  e.preventDefault();
  if (collection.open) return;
  audio.unlock();
  if (state === 'bite' && performance.now() - biteStartedAt >= activeFish.biteWindow * 1000) { miss(); return; }
  if (state === 'idle') { state = 'cast'; t = 0; target.set(-4 + 2 + Math.random() * 3, -0.15, -1 + Math.random() * 4); say('ждём поклёвку...'); }
  else if (state === 'wait' || state === 'cast') { state = 'idle'; bob.position.y = -100; say('рано! тапни, чтобы закинуть'); }
  else if (state === 'bite') {
    state = 'caught'; t = 0; biteMark.visible = false; lastCatch = activeFish;
    progress.score += activeFish.points; progress.caught[activeFish.name]++;
    if (!progress.bestCatch || activeFish.points > progress.bestCatch.points) {
      progress.bestCatch = { name: activeFish.name, points: activeFish.points };
    }
    saveProgress(progress);
    fish.material.color.set(activeFish.color); fish.scale.setScalar(activeFish.size);
    audio.catch();
    say(`поймал: ${activeFish.name}! +${activeFish.points} 🎣`);
  }
}
renderer.domElement.addEventListener('pointerdown', tap);
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute('role', 'button');
renderer.domElement.setAttribute('aria-label', 'Рыбалка: нажмите, чтобы забросить; при поклёвке нажмите снова, чтобы подсечь');
renderer.domElement.addEventListener('keydown', e => {
  if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) tap(e);
});
say('тапни, чтобы закинуть');

const clock = new THREE.Clock();
const tip = new THREE.Vector3();
function frame() {
  const elapsed = clock.getDelta(), dt = collection.open ? 0 : Math.min(elapsed, 0.1); t += dt;
  updateDayNight(elapsed);
  updateScenery(dt);
  rod.getWorldPosition(tip); tip.z += 1.0; tip.y += 0.45;
  if (!collection.open) {
  if (state === 'cast') { const k = Math.min(t / 0.6, 1); bob.position.lerpVectors(tip, target, k); bob.position.y += Math.sin(k * Math.PI) * 1.5;
    if (k >= 1) { audio.splash(); state = 'wait'; t = 0; biteAt = 1.5 + Math.random() * 4; } }
  else if (state === 'wait') { bob.position.y = -0.15 + Math.sin(t * 3) * 0.03; if (t > biteAt) { activeFish = chooseFish(); state = 'bite'; t = 0; biteStartedAt = performance.now(); audio.bite(); say('КЛЮЁТ! тапай!'); } }
  else if (state === 'bite') { bob.position.y = -0.3 + Math.sin(t * 30) * 0.1; if (performance.now() - biteStartedAt >= activeFish.biteWindow * 1000) miss(); }
  else if (state === 'caught') { fish.position.lerpVectors(target, tip, Math.min(t, 1)); fish.position.y += Math.sin(Math.min(t, 1) * Math.PI); fish.rotation.z = t * 10; bob.position.copy(fish.position);
    if (t > 1.2) { state = 'idle'; fish.position.y = -100; bob.position.y = -100; say('тапни, чтобы закинуть'); } }
  }
  biteMark.visible = state === 'bite';
  biteMark.position.copy(bob.position); biteMark.position.y += 0.9;
  line.visible = bob.position.y > -50;
  lineGeo.setFromPoints([tip, bob.position]);
  renderer.setRenderTarget(rt); renderer.render(scene, cam);
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  requestAnimationFrame(frame);
}
frame();
