import { createAudio } from './audio.js';
import { loadProgress, saveProgress } from './progress.js';
import { FISH_TYPES } from './fish.js';
import { FishingGame } from './game.js';
import { HarborView } from './harbor-view.js';
import { isCastable } from './harbor-map.js';
import './style.css';

const $ = id => document.getElementById(id);
const canvas = $('game'), hud = $('hud'), collection = $('collection'), loading = $('loading');
const audio = createAudio(), reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const progress = loadProgress(FISH_TYPES);
let view, ready = false, lastFrame = performance.now(), hidden = document.hidden;
function say(message) { hud.textContent = message; $('score').textContent = progress.score.toLocaleString('ru-RU'); }
const game = new FishingGame({ progress, onChange: say, onSound: sound => audio[sound](), onCatch: value => {
  saveProgress(value); $('score').textContent = value.score.toLocaleString('ru-RU');
} });
say('Выберите воду справа от рыбака и забросьте удочку');
$('mute').disabled = !audio.supported;
$('mute').addEventListener('click', () => {
  const muted = audio.toggleMute();
  $('mute').setAttribute('aria-pressed', String(muted));
  $('mute').setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
  $('mute').querySelector('span').textContent = muted ? 'Без звука' : 'Звук';
});
document.addEventListener('pointerdown', audio.unlock, { capture: true, once: true });

function sync(now = performance.now()) {
  const dt = Math.max(0, (now - lastFrame) / 1000); lastFrame = now;
  if (ready && !hidden) game.update(dt);
  return hidden || game.paused ? 0 : dt;
}
function tap(point) {
  if (!ready || game.paused) return;
  audio.unlock(); sync(); game.tap(point);
}
$('catch-log').addEventListener('click', () => {
  sync(); game.paused = true;
  const list = $('catch-list'); list.replaceChildren();
  for (const type of FISH_TYPES) {
    const count = progress.caught[type.name], row = document.createElement('li');
    const swatch = document.createElement('span'); swatch.className = 'fish-swatch';
    swatch.style.setProperty('--fish-color', count ? type.color : '#b7beb9'); swatch.setAttribute('aria-hidden', 'true');
    const description = document.createElement('span'); description.className = 'fish-description';
    const name = document.createElement('strong'); name.textContent = count ? type.name : '???';
    const points = document.createElement('small'); points.textContent = count ? `${type.points} очков за рыбу` : 'Ещё не встречалась';
    description.append(name, points);
    const counter = document.createElement('span'); counter.className = 'fish-count'; counter.textContent = `× ${count}`;
    row.append(swatch, description, counter); list.append(row);
  }
  const total = Object.values(progress.caught).reduce((sum, count) => sum + count, 0);
  const discovered = Object.values(progress.caught).filter(count => count > 0).length;
  $('catch-summary').textContent = `Виды: ${discovered}/5 · Поймано: ${total} · Очки: ${progress.score}`;
  $('best-catch').textContent = progress.bestCatch ? `Лучший улов: ${progress.bestCatch.name} · ${progress.bestCatch.points} очков` : 'Ваш лучший улов ещё впереди';
  collection.showModal();
});
$('close-log').addEventListener('click', () => collection.close());
collection.addEventListener('close', () => { lastFrame = performance.now(); game.paused = false; });

const pointers = new Map(); let gesture = null, pinch = null;
const pointerPosition = event => {
  const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top };
};
canvas.addEventListener('pointerdown', event => {
  if (!ready || game.paused || event.button > 0) return;
  canvas.setPointerCapture(event.pointerId);
  const point = pointerPosition(event); pointers.set(event.pointerId, point);
  if (pointers.size === 1) gesture = { start: point, last: point, moved: false };
  else { if (gesture) gesture.moved = true; pinch = null; }
});
canvas.addEventListener('pointermove', event => {
  if (!ready) return;
  const point = pointerPosition(event);
  if (!pointers.has(event.pointerId)) {
    canvas.style.cursor = game.state === 'bite' || isCastable(view.screenToMap(point.x, point.y)) ? 'crosshair' : 'grab'; return;
  }
  pointers.set(event.pointerId, point);
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y);
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (pinch && pinch.distance > 0) {
      view.zoomAt(distance / pinch.distance, center.x, center.y);
      view.drag(center.x - pinch.center.x, center.y - pinch.center.y); updateZoom();
    }
    pinch = { distance, center }; return;
  }
  if (!gesture || pinch) return;
  if (Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) > 6) gesture.moved = true;
  if (gesture.moved) view.drag(point.x - gesture.last.x, point.y - gesture.last.y);
  gesture.last = point;
});
function finishPointer(event, cancelled = false) {
  if (!pointers.has(event.pointerId)) return;
  const point = pointerPosition(event), wasTap = !cancelled && pointers.size === 1 && gesture && !gesture.moved && !pinch;
  pointers.delete(event.pointerId);
  if (wasTap) tap(view.screenToMap(point.x, point.y));
  if (pointers.size === 0) { gesture = null; pinch = null; }
  else if (gesture) gesture.moved = true;
}
canvas.addEventListener('pointerup', event => finishPointer(event));
canvas.addEventListener('pointercancel', event => finishPointer(event, true));
canvas.addEventListener('lostpointercapture', event => { if (pointers.has(event.pointerId)) finishPointer(event, true); });
canvas.addEventListener('wheel', event => {
  if (!ready || game.paused) return;
  event.preventDefault(); const point = pointerPosition(event);
  view.zoomAt(Math.exp(-event.deltaY * 0.0015), point.x, point.y); updateZoom();
}, { passive: false });
canvas.addEventListener('keydown', event => {
  if (event.repeat || !ready || game.paused) return;
  if (['Space', 'Enter'].includes(event.code)) { event.preventDefault(); tap(); }
  else if (event.key === '+' || event.key === '=') { view.zoomAt(1.25); updateZoom(); }
  else if (event.key === '-') { view.zoomAt(0.8); updateZoom(); }
  else if (event.key === '0') { view.fit(); updateZoom(); }
  else if (event.key.startsWith('Arrow')) {
    event.preventDefault();
    view.drag(event.key === 'ArrowLeft' ? 40 : event.key === 'ArrowRight' ? -40 : 0, event.key === 'ArrowUp' ? 40 : event.key === 'ArrowDown' ? -40 : 0);
  }
});
function updateZoom() {
  $('zoom-level').textContent = `${Math.round(view.zoom * 100)}%`;
  $('zoom-out').disabled = view.zoom <= 1; $('zoom-in').disabled = view.zoom >= 3.5;
}
$('zoom-in').addEventListener('click', () => { if (ready) { view.zoomAt(1.25); updateZoom(); } });
$('zoom-out').addEventListener('click', () => { if (ready) { view.zoomAt(0.8); updateZoom(); } });
$('fit-map').addEventListener('click', () => { if (ready) { view.fit(); updateZoom(); } });
addEventListener('resize', () => { if (view) view.resize(); });
document.addEventListener('visibilitychange', () => {
  sync(); hidden = document.hidden; lastFrame = performance.now(); pointers.clear(); gesture = null; pinch = null;
});
function frame(now) {
  const dt = sync(now);
  if (ready && !hidden) {
    view.render(game, dt, reducedMotion.matches);
    const label = game.isNight ? 'Ночная рыбалка' : 'Дневная рыбалка';
    if ($('time-label').textContent !== label) $('time-label').textContent = label;
    document.body.classList.toggle('night', game.isNight); hud.classList.toggle('biting', game.state === 'bite');
  }
  requestAnimationFrame(frame);
}
async function start() {
  try {
    view = new HarborView(canvas); await view.load(); ready = true;
    lastFrame = performance.now(); updateZoom(); loading.hidden = true;
    canvas.setAttribute('aria-busy', 'false'); requestAnimationFrame(frame);
  } catch (error) {
    loading.classList.add('failed'); $('loading-title').textContent = 'Не удалось открыть бухту';
    $('loading-description').textContent = 'Проверьте соединение и обновите страницу. Для игры нужен браузер с WebGL.';
    console.error('Harbor initialization failed:', error);
  }
}
start();
