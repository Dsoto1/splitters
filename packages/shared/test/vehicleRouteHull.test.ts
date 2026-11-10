// Bot vehicle routing (HANDOFF, "For the other session, bot vehicle routing (found on Whiteout Station)"): bots planned a
// vehicle's drive on the foot route and checked it only with routeFits' square box every 2 m, so a doorway a little
// wider than the hull passed and the vehicle stalled in it. On Whiteout Station the Snow Sleds on the garage apron were
// driven into the hangar towards the yard and stalled at its 1.6 m north doors (and at the west block's door); KotH
// seeds 1-4 on that layout: 10 stalls, 9 sleds given up on. vehicleRouteFits now also sweeps the hull's own footprint
// along the route's heading (hullFits), so those routes don't fit: the bot keeps the route it has or goes on foot.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, MOUNT_DEFS, TICK_RATE, initPhysics, loadMap, rulesForMode, type MapDocument } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { hullFits, routeFits, vehicleRouteFits, type MountView } from '../src/bots/vehicles.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

type V3 = { x: number; y: number; z: number };
interface MountLike {
  index: number;
  def: (typeof MOUNT_DEFS)[keyof typeof MOUNT_DEFS];
  pos: V3;
  yaw: number;
  body: unknown;
}
type Internals = {
  mounts: MountLike[];
  enterMount(c: Combatant): boolean;
  mountViews(actors: readonly Combatant[]): MountView[];
  nav: { findPath(a: V3, b: V3): V3[] | null };
  physics: { setBoxPose(b: unknown, c: unknown, y: number): void };
};
const internals = (match: Match) => match as unknown as Internals;

const mapFile = (id: string): MapDocument => {
  const loaded = loadMap(readFileSync(new URL(`../../../maps/${id}.json`, import.meta.url), 'utf8'));
  if (!loaded.ok) throw new Error(`${id} failed to load`);
  return loaded.map;
};

function pose(match: Match, m: MountLike, at: [number, number, number], yaw: number) {
  m.pos = { x: at[0], y: at[1], z: at[2] };
  m.yaw = yaw;
  internals(match).physics.setBoxPose(m.body, { x: at[0], y: at[1] + m.def.half[1], z: at[2] }, yaw);
}

const view = (id: keyof typeof MOUNT_DEFS): Pick<MountView, 'routeHalfWidth' | 'half'> => {
  const d = MOUNT_DEFS[id];
  return { half: d.half, routeHalfWidth: Math.min(d.half[0], d.half[2]) * (d.vehicle!.routeFit ?? 0.95) };
};

describe("Whiteout Station's hangar: the Snow Sled's route through its doors doesn't fit (hullFits)", () => {
  const whiteout = mapFile('whiteout_station');
  const koth = { ...rulesForMode(whiteout, 'core.tdm'), scoreLimit: 0, respawnDelayTicks: 100_000 };
  // The garage apron, where the map had two sleds before they moved to the road's west end.
  const APRON = { x: 0, y: 0, z: -34 };
  const SLED = view('snow_sled');

  it('from the apron to the yard: the foot route crosses the hangar on a slant; it passed routeFits, not hullFits', () => {
    const match = new Match(whiteout, koth, 1);
    match.step();
    const path = internals(match).nav.findPath(APRON, { x: 4, y: 0, z: 0 })!;
    expect(path).toBeTruthy();
    // Through the hangar's north door (its wall at z -12.5, the door at x 6..8).
    expect(path.some((p) => Math.abs(p.z + 12.4) < 0.5 && p.x > 6 && p.x < 8)).toBe(true);
    const long = MOUNT_DEFS.snow_sled.half[2];
    const skip = long + MOUNT_DEFS.snow_sled.half[0] + 0.5;
    // Before: the square box every 2 m (its height too) found it clear.
    expect(routeFits(match.physics, path, SLED.routeHalfWidth!, skip, Infinity, { height: MOUNT_DEFS.snow_sled.half[1] * 2, reach: long })).toBe(true);
    // Now: the hull turned to the route's heading (and swinging through the hard turn just past the door) doesn't.
    expect(hullFits(match.physics, path, { half: [SLED.routeHalfWidth!, 0.55, long], height: 1.1 }, skip)).toBe(false);
    expect(vehicleRouteFits(match.physics, SLED, path)).toBe(false);
    // Short of the hangar it fits (only the first `upTo` m are looked at).
    expect(vehicleRouteFits(match.physics, SLED, path, 12)).toBe(true);
  });

  it('through a doorway square on the sled fits; turning hard in it, or crossing it at 45°, it does not', () => {
    const match = new Match(whiteout, koth, 1);
    match.step();
    const hull = { half: [SLED.routeHalfWidth!, 0.55, MOUNT_DEFS.snow_sled.half[2]] as const, height: 1.1 };
    // The north door: about 1.6 m wide round x 7, in a thin wall at z -12.5. Due north through its middle.
    expect(hullFits(match.physics, [{ x: 7, y: 0, z: -20 }, { x: 7, y: 0, z: -4 }], hull, 0)).toBe(true);
    // Square on, then a turn west 2.7 m past the door (along the hangar's north side): fits.
    expect(hullFits(match.physics, [{ x: 7, y: 0, z: -20 }, { x: 7, y: 0, z: -9.8 }, { x: -2, y: 0, z: -9.8 }], hull, 0)).toBe(true);
    // The same turn in the doorway (the foot route's corner there): the hull swings into the jamb.
    expect(hullFits(match.physics, [{ x: 7, y: 0, z: -20 }, { x: 7, y: 0, z: -12.4 }, { x: 2, y: 0, z: -7.4 }], hull, 0)).toBe(false);
    // Through its middle at 45° off square.
    expect(hullFits(match.physics, [{ x: -1, y: 0, z: -20.5 }, { x: 15, y: 0, z: -4.5 }], hull, 0)).toBe(false);
  });

  it('the road east from the apron is open: it still fits', () => {
    const match = new Match(whiteout, koth, 1);
    match.step();
    const path = internals(match).nav.findPath(APRON, { x: 36, y: 0, z: -34 })!;
    expect(path).toBeTruthy();
    expect(vehicleRouteFits(match.physics, SLED, path)).toBe(true);
  });

  it('a bot at the wheel on the apron, sent to the yard, never noses into the hangar doorway', () => {
    const match = new Match(whiteout, koth, 2);
    const bot = match.addBot('bot', { ...CORE_BOT_PROFILES[3]!, exploration: 0, itemGreed: 0, tags: [] }, BOT_DIFFICULTIES.normal)!;
    match.step();
    const m = internals(match).mounts.find((x) => x.def.id === 'snow_sled')!;
    pose(match, m, [0, 0, -34], 0);
    bot.move = { pos: { x: 1.6, y: 0, z: -34 }, velY: 0, grounded: true };
    bot.bot?.onSpawn(0);
    expect(internals(match).enterMount(bot)).toBe(true);
    (bot.bot as unknown as { roamGoal: V3 }).roamGoal = { x: 4, y: 0, z: 0 };
    let north = -Infinity;
    for (let t = 0; t < TICK_RATE * 12; t++) {
      match.step();
      north = Math.max(north, m.pos.z);
    }
    // The hangar's north wall is at z -12.5: its nose (1.5 m ahead of its middle) never reaches it.
    expect(north).toBeLessThan(-14);
  });
});
