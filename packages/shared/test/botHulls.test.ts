// Bot AI Phase C, moving obstacles (BOT_AI_PLAN.md "Phase C, measured"): parked vehicles, wrecks and turrets aren't on
// the navmesh, so a route can run straight through one. A bot on foot now walks round a still hull in its way by its
// nearer corner (bots/hulls.ts hullDetour, BotBrain.pastHulls) instead of walking into it until the stuck recovery
// steps it aside.
import { beforeAll, describe, expect, it } from 'vitest';
import { CORE_BOT_PROFILES, MOUNT_DEFS, TICK_RATE, initPhysics, loadMap, type MapDocument, type Vec3 } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { hullDetour, segmentEntersBox, stillHull } from '../src/bots/hulls.ts';
import type { MountView } from '../src/bots/vehicles.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const view = (over: Partial<MountView> = {}): MountView => ({ index: 0, kind: 'vehicle', pos: { x: 0, y: 0, z: 0 }, yaw: 0, health: 1, alive: true, enterRadius: 2, seats: [], speed: 0, half: [1, 1, 2.5], ...over });
const anywhere = () => true;

describe('hull geometry', () => {
  it('finds where a segment enters a box, and misses one beside it', () => {
    expect(segmentEntersBox(-5, 0, 5, 0, 1, 1)).toBeCloseTo(0.4);
    expect(segmentEntersBox(-5, 2, 5, 2, 1, 1)).toBe(-1);
    expect(segmentEntersBox(-5, 0, -2, 0, 1, 1)).toBe(-1);
  });

  it('counts parked vehicles, turrets and wrecks as still; a moving or vanished one not', () => {
    expect(stillHull(view())).toBe(true);
    expect(stillHull(view({ speed: 6 }))).toBe(false);
    expect(stillHull(view({ kind: 'turret', speed: undefined }))).toBe(true);
    expect(stillHull(view({ alive: false }))).toBe(false);
    expect(stillHull(view({ alive: false, wreck: true }))).toBe(true);
  });

  it('heads for a corner of a hull across the way, the shorter side, and keeps the side it chose', () => {
    // A hull 2 m wide and 5 m long along z, the way along x through its middle, a little to its +z side.
    const hull = view();
    const me = { x: -6, y: 0, z: 0.3 };
    const to = { x: 6, y: 0, z: 0.3 };
    const p = hullDetour([hull], me, to, null, anywhere)!;
    expect(p).not.toBeNull();
    // Round its +z end (shorter), outside its footprint.
    expect(p.pos.z).toBeGreaterThan(2.5);
    expect(Math.abs(p.pos.x)).toBeGreaterThan(1);
    expect(p.pos.x).toBeLessThan(0);
    // Kept to the other side when chosen before (the difference is under the keep).
    const kept = hullDetour([hull], me, to, { index: 0, side: -p.side }, anywhere)!;
    expect(kept.pos.z).toBeLessThan(-2.5);
    // That side walled off (the caller's check): the other.
    const walled = hullDetour([hull], me, to, null, (_a, c) => c.z < 0)!;
    expect(walled.pos.z).toBeLessThan(-2.5);
    expect(hullDetour([hull], me, to, null, () => false)).toBeNull();
  });

  it('ignores a hull off the way, one being boarded, a moving one, and one under the bot', () => {
    const me = { x: -6, y: 0, z: 0 };
    expect(hullDetour([view({ pos: { x: 0, y: 0, z: 6 } })], me, { x: 6, y: 0, z: 0 }, null, anywhere)).toBeNull();
    expect(hullDetour([view()], me, { x: -1.6, y: 0, z: 0 }, null, anywhere)).toBeNull();
    expect(hullDetour([view({ speed: 8 })], me, { x: 6, y: 0, z: 0 }, null, anywhere)).toBeNull();
    expect(hullDetour([view()], { x: -6, y: 3, z: 0 }, { x: 6, y: 3, z: 0 }, null, anywhere)).toBeNull();
    // Beyond HULL_LOOK ahead: not yet.
    expect(hullDetour([view({ pos: { x: 6, y: 0, z: 0 } })], { x: -6, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }, null, anywhere)).toBeNull();
  });

  it('goes round a turned hull', () => {
    const hull = view({ yaw: Math.PI / 4 });
    const p = hullDetour([hull], { x: -6, y: 0, z: -6 }, { x: 6, y: 0, z: 6 }, null, anywhere);
    expect(p).not.toBeNull();
    // The corner is clear of the turned footprint: in the hull's frame outside |x| 1, |z| 2.5.
    const c = Math.cos(hull.yaw);
    const s = Math.sin(hull.yaw);
    const lx = p!.pos.x * c - p!.pos.z * s;
    const lz = p!.pos.x * s + p!.pos.z * c;
    expect(Math.abs(lx) > 1.4 || Math.abs(lz) > 2.9).toBe(true);
  });
});

/** An open yard (x -4..28, z -4..44), a gun at (12, 0, 34), and a Hauler parked broadside across the way at (12, 0, 18). */
function yard(): MapDocument {
  const tiles = [];
  for (let x = 0; x < 4; x++) for (let y = 0; y < 6; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[12, 0, 2]]);
  const doc = {
    ...map,
    entities: [
      ...map.entities,
      { id: 'mount_0', kind: 'mount' as const, position: [12, 0, 18] as [number, number, number], model: 'hauler' as const, yaw: Math.PI / 2, faction: null, respawnSeconds: null },
      { id: 'gun_1', kind: 'pickup', position: [12, 0, 34], item: 'core.weapon_shotgun', respawnSeconds: null } as MapDocument['entities'][number],
    ],
  } as MapDocument;
  const r = loadMap(doc);
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.map;
}

describe('a bot on foot and a parked vehicle in its way', () => {
  it('walks round the Hauler to the gun beyond it, without being stuck', () => {
    expect(MOUNT_DEFS.hauler.half[0]).toBeGreaterThan(1);
    const match = new Match(yard(), undefined, 3);
    const bot = match.addBot('b', { ...CORE_BOT_PROFILES[0]!, exploration: 0, itemGreed: 100 }, undefined, false)!;
    bot.move = { pos: { x: 12, y: 0, z: 2 }, velY: 0, grounded: true };
    let arrived = -1;
    let minGap = Infinity;
    const hauler = (match as unknown as { mounts: { pos: Vec3; yaw: number; def: { half: [number, number, number] } }[] }).mounts[0]!;
    for (let t = 0; t < TICK_RATE * 20 && arrived < 0; t++) {
      match.step();
      const p = bot.move.pos;
      // How near the hull's side it came (in its frame, the gap beyond its footprint).
      const c = Math.cos(hauler.yaw);
      const s = Math.sin(hauler.yaw);
      const dx = p.x - hauler.pos.x;
      const dz = p.z - hauler.pos.z;
      const gx = Math.abs(dx * c - dz * s) - hauler.def.half[0];
      const gz = Math.abs(dx * s + dz * c) - hauler.def.half[2];
      minGap = Math.min(minGap, Math.max(gx, gz));
      if (Math.hypot(p.x - 12, p.z - 34) < 1.5) arrived = t;
    }
    const brain = bot.bot!;
    match.destroy();
    expect(arrived).toBeGreaterThan(0);
    // 32 m and the way round: well under ten seconds (it took the stuck recovery's three rounds before).
    expect(arrived / TICK_RATE).toBeLessThan(10);
    expect(brain.stuckCount).toBe(0);
    expect(brain.hullDetours).toBeGreaterThan(0);
    // It never pressed into the side.
    expect(minGap).toBeGreaterThan(0.3);
  });
});
