import { chooseFish, DAY_LENGTH, daylightAt } from './fish.js';
import { isCastable, randomCastPoint } from './harbor-map.js';

export class FishingGame {
  state = 'idle'; stateTime = 0; dayTime = DAY_LENGTH / 4;
  paused = false; activeFish = null; lastCatch = null;
  target = null; biteAt = 0;

  constructor({ progress, random = Math.random, canCast = isCastable, onChange = () => {}, onSound = () => {}, onCatch = () => {} }) {
    this.progress = progress; this.random = random; this.canCast = canCast;
    this.onChange = onChange; this.onSound = onSound; this.onCatch = onCatch;
  }
  get daylight() { return daylightAt(this.dayTime); }
  get isNight() { return this.daylight < 0.35; }
  get biteRemaining() { return this.state === 'bite' ? Math.max(0, 1 - this.stateTime / this.activeFish.biteWindow) : 0; }

  message(text) { this.onChange(text); }
  enter(state, text) {
    this.state = state; this.stateTime = 0;
    if (text) this.message(text);
  }

  tap(point) {
    if (this.paused) return;
    if (this.state === 'idle') {
      point ??= randomCastPoint(this.random);
      if (!this.canCast(point)) { this.message('Выберите свободную воду справа от рыбака'); return; }
      this.target = { ...point }; this.enter('cast', 'Забрасываем…');
    } else if (this.state === 'cast' || this.state === 'wait') {
      this.enter('idle', 'Рановато! Дождитесь поклёвки');
    } else if (this.state === 'bite') {
      const fish = this.activeFish;
      this.lastCatch = fish;
      this.progress.score += fish.points; this.progress.caught[fish.name]++;
      if (!this.progress.bestCatch || fish.points > this.progress.bestCatch.points) this.progress.bestCatch = { name: fish.name, points: fish.points };
      this.enter('caught', `${fish.name}! +${fish.points} очков`);
      this.onSound('catch'); this.onCatch(this.progress);
    }
  }

  update(dt) {
    if (this.paused || !Number.isFinite(dt) || dt <= 0) return;
    this.dayTime = (this.dayTime + dt) % DAY_LENGTH;
    this.stateTime += dt;
    if (this.state === 'cast' && this.stateTime >= 0.6) {
      this.biteAt = 1.5 + this.random() * 4;
      this.enter('wait', 'Тихо… ждём поклёвку'); this.onSound('splash');
    } else if (this.state === 'wait' && this.stateTime >= this.biteAt) {
      this.activeFish = chooseFish(this.isNight, this.random);
      this.enter('bite', 'КЛЮЁТ! Подсекайте!'); this.onSound('bite');
    } else if (this.state === 'bite' && this.stateTime >= this.activeFish.biteWindow) {
      this.enter('idle', 'Сорвалась… Попробуем ещё?');
    } else if (this.state === 'caught' && this.stateTime >= 1.3) {
      this.enter('idle', 'Выберите место для следующего заброса');
    }
  }
}
