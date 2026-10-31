export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const length = (a: Vec3): number => Math.sqrt(dot(a, a));
/**
 * sqrt(a² + b² + c²). The sim's stand-in for Math.hypot, which V8 runs as a builtin call that boxes its
 * result: in a 96-bot match that was ~20,000 heap numbers a tick (about a fifth of everything the server
 * tick allocated, and the young-generation collections that come with it), and three times slower. No
 * overflow guard: game distances are nowhere near 1e154.
 */
export const hypot = (a: number, b: number, c = 0): number => Math.sqrt(a * a + b * b + c * c);
export const distance = (a: Vec3, b: Vec3): number => hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const horizontalDistance = (a: Vec3, b: Vec3): number => hypot(a.x - b.x, a.z - b.z);

export function normalize(a: Vec3): Vec3 {
  const len = length(a);
  return len > 1e-9 ? scale(a, 1 / len) : vec3();
}

/**
 * View direction for a yaw/pitch pair. Yaw 0 faces +Z and increases toward +X
 * (clockwise seen from above, matching Babylon's left-handed camera); positive
 * pitch looks up.
 */
export function viewDirection(yaw: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch);
  return { x: Math.sin(yaw) * cp, y: Math.sin(pitch), z: Math.cos(yaw) * cp };
}

/** Yaw/pitch that look from `from` toward `to`. Inverse of {@link viewDirection}. */
export function lookAngles(from: Vec3, to: Vec3): { yaw: number; pitch: number } {
  const d = sub(to, from);
  return { yaw: Math.atan2(d.x, d.z), pitch: Math.atan2(d.y, hypot(d.x, d.z)) };
}

/** Smallest signed difference `b - a` between two angles, in (-PI, PI]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Small deterministic PRNG (mulberry32) so simulations and tests are reproducible. */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
