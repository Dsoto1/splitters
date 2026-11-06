import { describe, expect, it } from 'vitest';
import { CASCADE_MARGIN, REFRESH_FRAMES, cascadeHolds, centredSlice, refreshDue } from '../src/game/shadowCache.ts';

/** The 8 corners of a camera's view slice from `near` to `far` m, looking along `yaw` (the game's wide view). */
function slice(eye: { x: number; y: number; z: number }, yaw: number, near: number, far: number): { x: number; y: number; z: number }[] {
  const th = 1.6;
  const tv = 0.8;
  const out = [];
  for (const d of [near, far]) {
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const fwd = d;
      const side = sx * d * th;
      out.push({ x: eye.x + Math.sin(yaw) * fwd + Math.cos(yaw) * side, y: eye.y + sy * d * tv, z: eye.z + Math.cos(yaw) * fwd - Math.sin(yaw) * side });
    }
  }
  return out;
}

describe('static shadow cache', () => {
  it('centres a cascade on the camera: turning keeps it, walking past its margin moves it', () => {
    const eye = { x: 3, y: 1.6, z: -7 };
    const far = slice(eye, 0, 40, 120);
    const r = centredSlice(eye, far);
    // It holds the whole slice.
    for (const c of far) expect(Math.hypot(c.x - eye.x, c.y - eye.y, c.z - eye.z)).toBeLessThanOrEqual(r);
    const cached = { ...eye, r: r * (1 + CASCADE_MARGIN[2]) };
    // Turned any way: the same square. (The slice's centroid swings round with the view: a quarter turn moves it far
    // past the margin, so Babylon's own square moved and redrew on every turn of a few tens of degrees.)
    const centroid = (cs: { x: number; y: number; z: number }[]) => cs.reduce((a, c) => ({ x: a.x + c.x / 8, y: a.y + c.y / 8, z: a.z + c.z / 8 }), { x: 0, y: 0, z: 0 });
    for (const yaw of [0.2, 1, 2.5]) {
      const turned = slice(eye, yaw, 40, 120);
      expect(centredSlice(eye, turned)).toBeCloseTo(r, 6);
      expect(cascadeHolds(cached, { ...eye, r: centredSlice(eye, turned) })).toBe(true);
      if (yaw >= 1) expect(Math.hypot(centroid(turned).x - centroid(far).x, centroid(turned).z - centroid(far).z)).toBeGreaterThan(r * CASCADE_MARGIN[2]);
    }
    // Walked a few metres: still held; walked past the margin: moved.
    expect(cascadeHolds(cached, { x: eye.x + r * CASCADE_MARGIN[2] * 0.9, y: eye.y, z: eye.z, r })).toBe(true);
    expect(cascadeHolds(cached, { x: eye.x + r * CASCADE_MARGIN[2] * 1.1, y: eye.y, z: eye.z, r })).toBe(false);
  });

  it('keeps a cascade while its view slice stays inside the grown square', () => {
    const r = 10;
    const cached = { x: 0, y: 0, z: 0, r: r * (1 + CASCADE_MARGIN[1]) };
    expect(cascadeHolds(cached, { x: 0, y: 0, z: 0, r })).toBe(true);
    // Moved by less than the margin: still covered.
    expect(cascadeHolds(cached, { x: r * CASCADE_MARGIN[1] * 0.9, y: 0, z: 0, r })).toBe(true);
    // Past the margin (a turn or a few steps): the cascade moves and its static casters are drawn again.
    expect(cascadeHolds(cached, { x: r * CASCADE_MARGIN[1] * 1.1, y: 0, z: 0, r })).toBe(false);
    // A wider slice (a scope zoomed out again) doesn't fit either.
    expect(cascadeHolds(cached, { x: 0, y: 0, z: 0, r: cached.r + 0.1 })).toBe(false);
  });

  it('redraws each cascade at least every REFRESH_FRAMES or so, staggered by cascade', () => {
    expect(refreshDue(10, 0, 10)).toBe(false);
    expect(refreshDue(10 + REFRESH_FRAMES, 0, 10)).toBe(true);
    const due = [0, 1, 2].map((layer) => {
      let f = 1;
      while (!refreshDue(f, layer, 0)) f++;
      return f;
    });
    expect(new Set(due).size).toBe(3);
    for (const f of due) expect(f).toBeLessThanOrEqual(REFRESH_FRAMES + 11);
    // A frame counter that went back (a new generator) redraws at once.
    expect(refreshDue(3, 1, 50)).toBe(true);
  });
});
