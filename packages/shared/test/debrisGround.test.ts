import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { EffectsWorld, buildMapGeometry, debrisBurst, environmentShapes, initPhysics, loadMap, mapTerrainMesh, rulesForMode, terrainHeightAt, vehicleDebris, type GameEvent, type Vec3 } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/**
 * Explosion debris falling through the world (HANDOFF, open bug of 2026-11-05: physicsfx on Rockfall Canyon counted
 * one vehicle explosion's 16 + 6 chunks falling at 60 m/s). A vehicle or turret blows up centred its half-height
 * above its base (Match.destroyMount) and View.vehicleExplosion scatters its chunks over a cube up to 2.4 m across
 * round that point, so some started under the terrain's surface: under a one-sided mesh, with nothing below it.
 * Every chunk now starts clear of the ground (EffectsWorld.clearOfGround), and the view removes any that still
 * get below the world (EffectsWorld.belowWorld).
 */
const canyon = (() => {
  const r = loadMap(readFileSync(fileURLToPath(new URL('../../../maps/canyon.json', import.meta.url)), 'utf8'));
  if (!r.ok) throw new Error('canyon failed to load');
  return r.map;
})();

interface MountState { index: number; pos: Vec3; alive: boolean; def: { id: string } }

/** Every vehicle and turret on Rockfall Canyon blown up by one big blast each, as the sim sends it (centre, radius). */
let blastsMemo: { id: string; at: Vec3; r: number }[] | null = null;
function blasts(): { id: string; at: Vec3; r: number }[] {
  if (blastsMemo) return blastsMemo;
  const match = new Match(canyon, { ...rulesForMode(canyon, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0 }, 1);
  for (let i = 0; i < 30; i++) match.step();
  const int = match as unknown as { mounts: MountState[]; pendingEvents: GameEvent[]; splash(at: Vec3, radius: number, damage: number, edge: number, owner: null, weapon: string, selfScale: number, knockback: number): void };
  int.pendingEvents.length = 0;
  // The physicsfx flow's mass blast (500 damage over 6 m) at each one still standing (one going up can take its
  // neighbours with it).
  for (const m of int.mounts) if (m.alive) int.splash({ x: m.pos.x, y: m.pos.y + 0.5, z: m.pos.z }, 6, 500, 400, null, 'core.rockets', 1, 12);
  expect(int.mounts.filter((m) => m.alive).map((m) => m.def.id)).toEqual([]);
  return (blastsMemo = int.pendingEvents.flatMap((e) => (e.e === 'explode' && e.m !== undefined ? [{ id: int.mounts.find((m) => m.index === e.m)!.def.id, at: { x: e.p[0], y: e.p[1], z: e.p[2] }, r: e.r }] : [])));
}

/** Each blast's debris, as View.vehicleExplosion throws it, stepped for 5 s; the chunks that ended up below the ground. */
function run(clear: boolean, seed: number) {
  const world = new EffectsWorld(buildMapGeometry(canyon), mapTerrainMesh(canyon), environmentShapes(canyon));
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const chunks: { id: string; body: ReturnType<EffectsWorld['addBody']> }[] = [];
  const list = blasts();
  for (const b of list) {
    for (const burst of vehicleDebris(b.r)) {
      for (const c of debrisBurst(b.at, burst.size, burst.count, burst.speed, rnd)) {
        const half = c.size / 2;
        const p = clear ? world.clearOfGround(b.at, c.start, half) : c.start;
        chunks.push({ id: b.id, body: world.addBody({ kind: 'box', half: { x: half, y: half, z: half } }, p, { x: 0, y: 0, z: 0, w: 1 }, 'debris', { vel: c.vel, spin: c.spin, density: 0.6 }) });
      }
    }
  }
  for (let i = 0; i < 300; i++) world.step(1 / 60);
  const lost = chunks.filter((c) => {
    const t = c.body.translation();
    return t.y < (terrainHeightAt(canyon.terrain!, t.x, t.z) ?? 0) - 0.5;
  });
  const fastest = Math.max(...chunks.map((c) => Math.hypot(c.body.linvel().x, c.body.linvel().y, c.body.linvel().z)));
  const fallen = lost.filter((c) => world.belowWorld(c.body.translation().y)).length;
  world.free();
  return { blasts: list.length, chunks: chunks.length, lost: lost.map((c) => c.id), fastest, fallen };
}

describe('explosion debris on the ground', () => {
  it('reproduces the fall: chunks started under the ground as thrown before the fix fall out of the world', () => {
    const r = [1, 2, 3].map((seed) => run(false, seed));
    expect(r.reduce((n, x) => n + x.lost.length, 0)).toBeGreaterThan(0);
    // Those are past the world's floor, where the view's safety net takes them.
    expect(r.every((x) => x.fallen === x.lost.length)).toBe(true);
  });

  it('every chunk of every vehicle and turret blown up on Rockfall Canyon settles on the ground', () => {
    for (const seed of [1, 2, 3, 4]) {
      const r = run(true, seed);
      expect(r.blasts).toBeGreaterThanOrEqual(8);
      expect(r.chunks).toBe(r.blasts * 22);
      expect(r.lost, `seed ${seed}`).toEqual([]);
      expect(r.fastest, `seed ${seed}`).toBeLessThan(1.5);
    }
  });
});
