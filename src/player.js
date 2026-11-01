import { findPath } from './pathfinding.js';
import { FISHERMAN, isWalkable, isWater, isOpenWater } from './harbor-map.js';

export const WALK_SPEED = 95;      // map px per second
export const CAST_RANGE = 230;     // max distance of a cast from the feet
const EDGE_PROBE = 95;             // how far ahead water must start to allow fishing

// Rod offsets relative to the feet when facing right (taken from the original pose).
const GRIP = { x: 18, y: -46 }, TIP = { x: 108, y: -81 };

export class Player {
  x = FISHERMAN.x; y = FISHERMAN.y; facing = { x: 0.85, y: -0.53 };
  target = null; path = []; moving = false; walkTime = 0; input = { x: 0, y: 0 };

  get flip() { return this.facing.x < 0 ? -1 : 1; }
  get rodGrip() { return { x: this.x + GRIP.x * this.flip, y: this.y + GRIP.y }; }
  get rodTip() { return { x: this.x + TIP.x * this.flip, y: this.y + TIP.y }; }

  /** Water directly ahead of the character (pier or shore edge, facing the water). */
  get canFish() {
    if (this.moving) return false;
    const len = Math.hypot(this.facing.x, this.facing.y) || 1, fx = this.facing.x / len, fy = this.facing.y / len;
    // Water must start right in front (piles/quay walls are up to ~90px tall in the art)…
    let edge = false;
    for (let d = 15; d <= EDGE_PROBE && !edge; d += 15) if (isWater({ x: this.x + fx * d, y: this.y + fy * d })) edge = true;
    if (!edge) return false;
    // …and there must be open water (no boats) to cast into.
    const base = Math.atan2(fy, fx);
    for (const a of [0, -0.2, 0.2, -0.4, 0.4]) for (let d = 80; d <= CAST_RANGE; d += 30)
      if (isOpenWater({ x: this.x + Math.cos(base + a) * d, y: this.y + Math.sin(base + a) * d })) return true;
    return false;
  }

  /** Tap-to-move: route around obstacles; tapping water walks to the nearest shore. */
  moveTo(point) {
    this.path = findPath(this, point) ?? [];
    this.target = this.path.shift() ?? null;
    this.goal = this.target ? { x: point.x, y: point.y } : null;
  }
  stop() { this.target = null; this.path = []; this.goal = null; }

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
    if (!(dt > 0)) return;
    let dx = this.input.x, dy = this.input.y;
    if (dx || dy) this.stop();
    else if (this.target) {
      dx = this.target.x - this.x; dy = this.target.y - this.y;
      if (Math.hypot(dx, dy) < 2) {
        this.target = this.path.shift() ?? null;
        if (!this.target) {
          // Arrived: turn toward where the player tapped (often the water).
          if (this.goal) this.face(this.goal.x - this.x, this.goal.y - this.y);
          this.goal = null; this.moving = false; this.walkTime = 0; return;
        }
        dx = this.target.x - this.x; dy = this.target.y - this.y;
      }
    }
    const len = Math.hypot(dx, dy);
    if (!len) { this.moving = false; this.walkTime = 0; return; }
    this.face(dx, dy);
    const step = Math.min(len, WALK_SPEED * dt), sx = dx / len * step, sy = dy / len * step;
    if (step <= 0) return; // zero-length frame: keep the current route
    // Slide along walls: try the full step, then each axis separately.
    let moved = false;
    for (const [nx, ny] of [[this.x + sx, this.y + sy], [this.x + sx, this.y], [this.x, this.y + sy]]) {
      if ((nx !== this.x || ny !== this.y) && isWalkable({ x: nx, y: ny })) { this.x = nx; this.y = ny; moved = true; break; }
    }
    this.moving = moved;
    if (moved) this.walkTime += dt; else { this.stop(); this.walkTime = 0; }
  }
}
