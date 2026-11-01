import { FISHERMAN, isWalkable, isWater, isOpenWater } from './harbor-map.js';

export const WALK_SPEED = 95;      // map px per second
export const CAST_RANGE = 230;     // max distance of a cast from the feet
const EDGE_PROBE = 34;             // how far ahead water must start to allow fishing

// Rod offsets relative to the feet when facing right (taken from the original pose).
const GRIP = { x: 18, y: -46 }, TIP = { x: 108, y: -81 };

export class Player {
  x = FISHERMAN.x; y = FISHERMAN.y; facing = { x: 0.85, y: -0.53 };
  target = null; moving = false; walkTime = 0; input = { x: 0, y: 0 };

  get flip() { return this.facing.x < 0 ? -1 : 1; }
  get rodGrip() { return { x: this.x + GRIP.x * this.flip, y: this.y + GRIP.y }; }
  get rodTip() { return { x: this.x + TIP.x * this.flip, y: this.y + TIP.y }; }

  /** Water directly ahead of the character (pier or shore edge, facing the water). */
  get canFish() {
    if (this.moving) return false;
    const len = Math.hypot(this.facing.x, this.facing.y) || 1;
    for (const d of [EDGE_PROBE * 0.6, EDGE_PROBE, EDGE_PROBE * 1.6]) {
      const probe = { x: this.x + this.facing.x / len * d, y: this.y + this.facing.y / len * d };
      if (isWater(probe)) return true;
    }
    return false;
  }

  moveTo(point) { this.target = { x: point.x, y: point.y }; }
  stop() { this.target = null; }

  face(dx, dy) { const l = Math.hypot(dx, dy); if (l > 0.001) this.facing = { x: dx / l, y: dy / l }; }

  /** Turn toward a point; used before casting at a tapped spot. */
  lookAt(point) { this.face(point.x - this.x, point.y - this.y); }

  /** Pick a cast target: the tapped water if it's in range and ahead, otherwise straight ahead. */
  castPoint(point, random = Math.random) {
    if (point && isOpenWater(point) && Math.hypot(point.x - this.x, point.y - this.y) <= CAST_RANGE) return point;
    for (let i = 0; i < 40; i++) {
      const angle = Math.atan2(this.facing.y, this.facing.x) + (random() - 0.5) * 0.8;
      const d = 80 + random() * (CAST_RANGE - 80);
      const p = { x: this.x + Math.cos(angle) * d, y: this.y + Math.sin(angle) * d };
      if (isOpenWater(p)) return p;
    }
    return null;
  }

  update(dt) {
    let dx = this.input.x, dy = this.input.y;
    if (dx || dy) this.target = null;
    else if (this.target) {
      dx = this.target.x - this.x; dy = this.target.y - this.y;
      if (Math.hypot(dx, dy) < 2) { this.target = null; dx = dy = 0; }
    }
    const len = Math.hypot(dx, dy);
    if (!len) { this.moving = false; this.walkTime = 0; return; }
    this.face(dx, dy);
    const step = Math.min(len, WALK_SPEED * dt), sx = dx / len * step, sy = dy / len * step;
    // Slide along walls: try the full step, then each axis separately.
    let moved = false;
    for (const [nx, ny] of [[this.x + sx, this.y + sy], [this.x + sx, this.y], [this.x, this.y + sy]]) {
      if ((nx !== this.x || ny !== this.y) && isWalkable({ x: nx, y: ny })) { this.x = nx; this.y = ny; moved = true; break; }
    }
    this.moving = moved;
    if (moved) this.walkTime += dt; else { this.target = null; this.walkTime = 0; }
  }
}
