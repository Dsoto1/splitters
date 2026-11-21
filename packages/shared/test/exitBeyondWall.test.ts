// Riot Junction nav hole (gunplay pass 3's find, HANDOFF): in `pnpm bot-report riot_junction --mode=core.tdm --seeds=1
// --set=military --spells` a bot rode a Buggy that stopped along the street's east wall (x 203.5..204.1); getting out,
// leaveMount's first spot (beside the hull, checked only for headroom) was beyond the wall, over the void outside the
// street, and the bot fell to the slab 4 m under the street at (196, -4, 42) and stood there with no route out for 195 s.
// A step-out spot now needs nothing solid between the hull and it, and ground (or water) under it within a step down.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_RATE, initPhysics, loadMap, rulesForMode, type MapDocument } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

type V3 = { x: number; y: number; z: number };
interface MountLike { def: { id: string; half: [number, number, number] }; pos: V3; yaw: number; body: unknown }
type Internals = {
  mounts: MountLike[];
  enterMount(c: Combatant): boolean;
  leaveMount(c: Combatant, step: boolean): void;
  physics: { setBoxPose(b: unknown, c: unknown, y: number): void; moveRay(o: V3, d: V3, max: number): number | null };
};
const internals = (match: Match) => match as unknown as Internals;

const mapFile = (id: string): MapDocument => {
  const loaded = loadMap(readFileSync(new URL(`../../../maps/${id}.json`, import.meta.url), 'utf8'));
  if (!loaded.ok) throw new Error(`${id} failed to load`);
  return loaded.map;
};

describe('getting out of a vehicle parked against a wall', () => {
  it("Riot Junction's east wall: the rider steps out on the street side, not beyond the wall and under the street", () => {
    const riot = mapFile('riot_junction');
    const match = new Match(riot, { ...rulesForMode(riot, 'core.tdm'), scoreLimit: 0, respawnDelayTicks: 100_000 }, 1);
    const rider = match.addHuman('rider')!;
    match.step();
    const I = internals(match);
    // The street ends at the wall; beyond it there is no floor until the slab 4 m down.
    expect(I.physics.moveRay({ x: 202, y: 3, z: 45 }, { x: 0, y: -1, z: 0 }, 10)).toBeCloseTo(3, 1);
    expect(I.physics.moveRay({ x: 204.3, y: 3, z: 45 }, { x: 0, y: -1, z: 0 }, 10)).toBeGreaterThan(6.5);
    const m = I.mounts.find((x) => x.def.id === 'troop_buggy')!;
    // Facing south (yaw π), its left side (leaveMount's first spot) to the wall, its hull 0.1 m short of it.
    const at = { x: 204.3 - (m.def.half[0] + 0.9), y: 0, z: 45.3 };
    m.pos = at;
    m.yaw = Math.PI;
    I.physics.setBoxPose(m.body, { x: at.x, y: at.y + m.def.half[1], z: at.z }, Math.PI);
    rider.move = { pos: { x: at.x - m.def.half[0] - 0.6, y: 0, z: at.z }, velY: 0, grounded: true };
    expect(I.enterMount(rider)).toBe(true);
    I.leaveMount(rider, true);
    expect(rider.mount).toBeUndefined();
    // On the street side of the wall (before: x 204.3, beyond it).
    expect(rider.move.pos.x).toBeLessThan(203.5);
    for (let t = 0; t < TICK_RATE * 2; t++) match.step();
    expect(rider.move.pos.y).toBeGreaterThan(-0.5);
  });
});
