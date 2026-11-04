// What a shot costs against measured hit shapes (sim/hitbox.ts) with a full 96-body match on the host: every shot
// is tested against every hostile body (the broad phase sphere rejects nearly all of them). Compared with the old
// single capsule; HITBOX_BENCH=1 prints the numbers.
import { describe, expect, it } from 'vitest';
import { CORE_LOOKS, PLAYER, lookHitbox, rayBody, rayCapsule, type HitBody } from '../src/index.ts';

/** 96 bodies over a 120 m square (the looks of the roster, standing, crouching and prone), and rays among them. */
function scene() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const bodies: HitBody[] = Array.from({ length: 96 }, (_, i) => {
    const look = CORE_LOOKS[i % CORE_LOOKS.length]!.id;
    const h = lookHitbox(look);
    return { feet: { x: rnd() * 120 - 60, y: 0, z: rnd() * 120 - 60 }, yaw: rnd() * Math.PI * 2, stance: (i % 7 === 0 ? 1 : i % 11 === 0 ? 2 : 0) as 0 | 1 | 2, scale: h.scale * (i % 5 === 0 ? 0.78 : i % 5 === 1 ? 1.18 : 1), box: h.box };
  });
  // Rays from one body's eye toward another's chest (a shot), with a little spread.
  const rays = Array.from({ length: 4000 }, () => {
    const a = bodies[Math.floor(rnd() * bodies.length)]!;
    const b = bodies[Math.floor(rnd() * bodies.length)]!;
    const o = { x: a.feet.x, y: 1.6, z: a.feet.z };
    const d = { x: b.feet.x - o.x + (rnd() - 0.5), y: 1.2 - o.y + (rnd() - 0.5), z: b.feet.z - o.z + (rnd() - 0.5) };
    const l = Math.hypot(d.x, d.y, d.z) || 1;
    return { o, d: { x: d.x / l, y: d.y / l, z: d.z / l }, from: a };
  });
  return { bodies, rays };
}

function time(f: () => number, rounds = 5): { ms: number; hits: number } {
  let best = Infinity;
  let hits = 0;
  for (let r = 0; r < rounds; r++) {
    const t0 = performance.now();
    hits = f();
    best = Math.min(best, performance.now() - t0);
  }
  return { ms: best, hits };
}

describe('hit shapes: cost per shot with 96 bodies', () => {
  it('a shot against 96 measured bodies costs a few microseconds and hits about as often as the old capsule', () => {
    const { bodies, rays } = scene();
    const shapes = time(() => {
      let n = 0;
      for (const r of rays) for (const b of bodies) if (b !== r.from && rayBody(r.o, r.d, b, 200) !== null) n++;
      return n;
    });
    const capsule = time(() => {
      let n = 0;
      for (const r of rays) for (const b of bodies) if (b !== r.from && rayCapsule(r.o, r.d, b.feet, PLAYER.radius * b.scale, (b.stance === 0 ? 1.8 : b.stance === 1 ? 1.2 : 0.8) * b.scale) !== null) n++;
      return n;
    });
    const perShot = (ms: number) => (ms * 1000) / rays.length;
    if (process.env.HITBOX_BENCH) console.log(`per shot vs 96 bodies: shapes ${perShot(shapes.ms).toFixed(2)} µs (${shapes.hits} hits), old capsule ${perShot(capsule.ms).toFixed(2)} µs (${capsule.hits} hits)`);
    // Generous for a loaded CI box: a shot against 96 bodies well under 0.1 ms (a 96-bot match fires about one shot a tick).
    expect(perShot(shapes.ms)).toBeLessThan(100);
    // With the margin (HITBOX_MARGIN) the measured bodies are about as easy to hit as the old 0.8 m-wide capsule.
    expect(shapes.hits).toBeGreaterThan(capsule.hits * 0.8);
    expect(shapes.hits).toBeLessThan(capsule.hits * 1.25);
  });
});
