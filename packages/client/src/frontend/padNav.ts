/**
 * Controller navigation in the menus (owner, 2026-11-23: "unable to really navigate or select a map easily … is there
 * a directional stick support with way to scroll"). Pure logic, unit tested (test/padNav.test.ts):
 * - `nextInDirection`: the spatial move from one box to the next in a direction (cards in a grid, controls in a panel);
 * - `DirRepeat`: a held direction (d-pad or left stick) moves once, then again after a short delay, then at a steady rate;
 * - `stickDir` / `scrollStep`: the sticks' dead zones.
 */

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The box to move to from `from` in `dir`, as an index into `boxes` (null: nothing that way). A candidate must lie
 * ahead (its near edge past the middle of `from`); those whose span overlaps `from` across the move (the same row
 * for left and right, the same column for up and down) come first, then the nearest ahead, then the best lined up.
 * So in a grid, right goes to the next card in the row (never down a row), down to the card under it, or the nearest
 * one when the row below is shorter.
 */
export function nextInDirection(from: Box, boxes: readonly Box[], dir: Dir): number | null {
  const fx = from.left + from.width / 2;
  const fy = from.top + from.height / 2;
  const horizontal = dir === 'left' || dir === 'right';
  const sign = dir === 'right' || dir === 'down' ? 1 : -1;
  let best: { i: number; key: [number, number, number] } | null = null;
  boxes.forEach((b, i) => {
    if (b === from || (b.left === from.left && b.top === from.top && b.width === from.width && b.height === from.height)) return;
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    // Ahead: its near edge past from's middle, and its middle past from's far-ish edge (no sideways neighbours).
    const ahead = horizontal ? sign * (bx - fx) > from.width / 4 && (sign > 0 ? b.left + b.width > fx : b.left < fx) : sign * (by - fy) > from.height / 4 && (sign > 0 ? b.top + b.height > fy : b.top < fy);
    if (!ahead) return;
    const overlap0 = horizontal ? Math.min(b.top + b.height, from.top + from.height) - Math.max(b.top, from.top) : Infinity;
    // Left and right keep to the row (something overlapping it): off the row's end is the zone's edge.
    if (overlap0 <= 1) return;
    const overlap = horizontal ? Math.min(b.top + b.height, from.top + from.height) - Math.max(b.top, from.top) : Math.min(b.left + b.width, from.left + from.width) - Math.max(b.left, from.left);
    const along = horizontal ? Math.abs(bx - fx) : Math.abs(by - fy);
    const across = horizontal ? Math.abs(by - fy) : Math.abs(bx - fx);
    const key: [number, number, number] = [overlap > 1 ? 0 : 1, Math.round(along), across];
    if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && (key[1] < best.key[1] || (key[1] === best.key[1] && key[2] < best.key[2])))) best = { i, key };
  });
  return best ? (best as { i: number }).i : null;
}

/** How far a stick must lean to count as a direction. */
export const STICK_DEAD = 0.5;
/** Below this, the right stick doesn't scroll. */
export const SCROLL_DEAD = 0.2;

/** The direction a stick leans (the stronger axis), or null inside the dead zone. */
export function stickDir(x: number, y: number, dead = STICK_DEAD): Dir | null {
  if (Math.max(Math.abs(x), Math.abs(y)) < dead) return null;
  return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up';
}

/** Pixels the right stick scrolls this frame (`dt` seconds): nothing in the dead zone, then up to `speed` px/s, eased. */
export function scrollStep(y: number, dt: number, speed = 1400, dead = SCROLL_DEAD): number {
  const a = Math.abs(y);
  if (a < dead) return 0;
  const k = (a - dead) / (1 - dead);
  return Math.sign(y) * k * k * speed * dt;
}

/** A held direction: the first move at once, the next after `delay` ms, then one every `rate` ms; a new direction starts over. */
export class DirRepeat {
  private dir: Dir | null = null;
  private next = 0;
  constructor(
    readonly delay = 380,
    readonly rate = 110,
  ) {}

  /** The direction held now (null: none) at `now` ms: returns the direction to move this frame, or null. */
  update(dir: Dir | null, now: number): Dir | null {
    if (dir !== this.dir) {
      this.dir = dir;
      this.next = now + this.delay;
      return dir;
    }
    if (!dir || now < this.next) return null;
    this.next += this.rate;
    // A long frame (a tab in the background) doesn't fire a burst: one move, then the steady rate from now.
    if (this.next < now) this.next = now + this.rate;
    return dir;
  }
}
