import { MAP_WIDTH, MAP_HEIGHT, isWalkable } from './harbor-map.js';

// Coarse walk grid + A*. Lets tap-to-move route around the cafe, lamps and pier corners.
export const CELL = 8;
const COLS = Math.ceil(MAP_WIDTH / CELL), ROWS = Math.ceil(MAP_HEIGHT / CELL);
let grid = null;
function walkGrid() {
  if (grid) return grid;
  grid = new Uint8Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
    grid[r * COLS + c] = isWalkable({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 }) ? 1 : 0;
  return grid;
}
const cellOf = p => [Math.floor(p.x / CELL), Math.floor(p.y / CELL)];
const center = (c, r) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 });
const open = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && walkGrid()[r * COLS + c] === 1;

/** Nearest walkable cell to a point (e.g. the shore when water was tapped). */
function nearestOpen(c, r, maxRadius = 40) {
  if (open(c, r)) return [c, r];
  for (let d = 1; d <= maxRadius; d++) {
    let best = null, bestDist = Infinity;
    for (let dc = -d; dc <= d; dc++) for (const dr of [-d, d]) for (const [x, y] of [[c + dc, r + dr], [c + dr, r + dc]])
      if (open(x, y)) { const dist = (x - c) ** 2 + (y - r) ** 2; if (dist < bestDist) { bestDist = dist; best = [x, y]; } }
    if (best) return best;
  }
  return null;
}

/** Returns a list of waypoints from `from` to (the walkable spot nearest) `to`, or null. */
export function findPath(from, to) {
  const start = nearestOpen(...cellOf(from), 3), goal = nearestOpen(...cellOf(to));
  if (!start || !goal) return null;
  const key = (c, r) => r * COLS + c, goalKey = key(...goal);
  const g = new Map([[key(...start), 0]]), came = new Map(), heap = [[0, ...start]];
  const h = (c, r) => Math.hypot(c - goal[0], r - goal[1]);
  while (heap.length) {
    let bi = 0; for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[bi][0]) bi = i;
    const [, c, r] = heap[bi]; heap[bi] = heap[heap.length - 1]; heap.pop();
    const k = key(c, r);
    if (k === goalKey) break;
    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const nc = c + dc, nr = r + dr;
      if (!open(nc, nr) || (dc && dr && (!open(c + dc, r) || !open(c, r + dr)))) continue;
      const nk = key(nc, nr), cost = g.get(k) + (dc && dr ? Math.SQRT2 : 1);
      if (cost < (g.get(nk) ?? Infinity)) { g.set(nk, cost); came.set(nk, k); heap.push([cost + h(nc, nr), nc, nr]); }
    }
    if (g.size > 20000) return null;
  }
  if (!g.has(goalKey)) return null;
  const cells = []; for (let k = goalKey; k !== undefined; k = came.get(k)) cells.unshift([k % COLS, Math.floor(k / COLS)]);
  // Drop intermediate points on straight runs.
  const points = cells.filter((cell, i) => {
    if (i === 0 || i === cells.length - 1) return i !== 0;
    const [pc, pr] = cells[i - 1], [nc, nr] = cells[i + 1];
    return cell[0] - pc !== nc - cell[0] || cell[1] - pr !== nr - cell[1];
  }).map(([c, r]) => center(c, r));
  if (open(...cellOf(to)) && points.length) points[points.length - 1] = { x: to.x, y: to.y };
  return points;
}
