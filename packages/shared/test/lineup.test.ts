import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_FIRE,
  BUTTON_JUMP,
  BUTTON_USE,
  DEFAULT_DEATHMATCH_RULES,
  MOUNT_DEFS,
  MOUNT_SKINS,
  TICK_RATE,
  initPhysics,
  loadMap,
  mountTint,
  validateMap,
  type GameEvent,
  type MapDocument,
  type MapEntity,
  type MountModel,
  type PlayerInput,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
/** The Sprint 5 lineup and the handling class each one uses. */
const LINEUP: [MountModel, 'wheeled' | 'hover' | 'flying'][] = [
  ['gun_jeep', 'wheeled'],
  ['armored_rover', 'wheeled'],
  ['hover_bike', 'hover'],
  ['gunship', 'flying'],
  ['ice_cream_truck', 'wheeled'],
  ['snow_sled', 'hover'],
];

/** An open yard 40 × 32 m (x -4..36, z -4..28) with one vehicle at (4, 4) facing +x. */
function yard(model: MountModel, extra: Partial<Extract<MapEntity, { kind: 'mount' }>> = {}): MapDocument {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 4; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles);
  return { ...map, entities: [...map.entities, { id: 'mount_1', kind: 'mount', position: [4, 0, 12], model, yaw: Math.PI / 2, faction: null, respawnSeconds: null, ...extra }] };
}

class Driver {
  private seq = new Map<number, number>();
  constructor(readonly match: Match) {}
  input(c: Combatant, i: Partial<PlayerInput> = {}): void {
    const seq = (this.seq.get(c.slot) ?? 0) + 1;
    this.seq.set(c.slot, seq);
    this.match.queueInputs(c.slot, [{ seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
  }
  run(n: number, each: () => void = () => {}): GameEvent[] {
    const out: GameEvent[] = [];
    for (let i = 0; i < n; i++) {
      each();
      out.push(...this.match.step());
    }
    return out;
  }
  use(c: Combatant): void {
    this.run(1, () => this.input(c, { buttons: BUTTON_USE }));
    this.run(1, () => this.input(c));
  }
}

const place = (c: Combatant, x: number, z: number) => (c.move = { pos: { x, y: 0, z }, velY: 0, grounded: true });

describe('Sprint 5 vehicle lineup', () => {
  it.each(LINEUP)('%s (%s) validates, takes a driver and drives off', (model, handling) => {
    const def = MOUNT_DEFS[model];
    expect(def.kind).toBe('vehicle');
    expect(!!def.vehicle?.hover).toBe(handling !== 'wheeled');
    expect(!!def.vehicle?.fly).toBe(handling === 'flying');
    const map = yard(model);
    expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
    const match = new Match(map, rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    d.run(2);
    place(a, 4, 12 - def.half[0] - 1);
    d.use(a);
    expect(a.mount?.seat).toBe(0);
    const start = (match.mountSnapshots()[0] as number[])[1]!;
    d.run(TICK_RATE * 2, () => d.input(a, { forward: 1 }));
    const moved = (match.mountSnapshots()[0] as number[])[1]! - start;
    // Two seconds of throttle: most of the way to top speed for every class.
    expect(moved).toBeGreaterThan(def.vehicle!.maxSpeed * 0.6);
    expect(moved).toBeLessThan(def.vehicle!.maxSpeed * 2 + 0.5);
  });

  it('the hover bike is the quickest and the armored rover the heaviest of the new ones', () => {
    const speeds = LINEUP.map(([m]) => MOUNT_DEFS[m].vehicle!.maxSpeed);
    expect(MOUNT_DEFS.hover_bike.vehicle!.maxSpeed).toBe(Math.max(...speeds));
    const masses = LINEUP.map(([m]) => MOUNT_DEFS[m].vehicle!.mass ?? 1);
    expect(MOUNT_DEFS.armored_rover.vehicle!.mass).toBe(Math.max(...masses));
  });

  it('the gunship flies like the dropship: climbs on jump and holds its height', () => {
    const match = new Match(yard('gunship'), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    d.run(2);
    place(a, 4, 9);
    d.use(a);
    d.run(TICK_RATE, () => d.input(a, { buttons: BUTTON_JUMP }));
    const up = (match.mountSnapshots()[0] as number[])[2]!;
    expect(up).toBeGreaterThan(3);
    d.run(30, () => d.input(a));
    expect(Math.abs((match.mountSnapshots()[0] as number[])[2]! - up)).toBeLessThan(1.5);
  });

  it("the gunship's door gunners aim out of their own side, and the rover's two gunners both fire", () => {
    const match = new Match(yard('gunship'), rules);
    const d = new Driver(match);
    const [p, l, r] = [0, 1, 2].map((i) => match.addHuman(`p${i}`)!);
    d.run(2);
    for (const c of [p!, l!, r!]) {
      place(c, 4, 9);
      d.use(c);
    }
    expect([p!, l!, r!].map((c) => c.mount?.seat).sort()).toEqual([0, 1, 2]);
    const left = [p!, l!, r!].find((c) => c.mount?.seat === 1)!;
    const right = [p!, l!, r!].find((c) => c.mount?.seat === 2)!;
    // The gunship faces +x (yaw π/2): left is +z (yaw 0), right is -z (yaw π). Ask both to look forward.
    d.run(2, () => {
      d.input(left, { yaw: Math.PI / 2 });
      d.input(right, { yaw: Math.PI / 2 });
    });
    const mountYaw = Math.PI / 2;
    const off = (c: Combatant, facing: number) => Math.abs(Math.atan2(Math.sin(c.yaw - (mountYaw + facing)), Math.cos(c.yaw - (mountYaw + facing))));
    expect(off(left, -Math.PI / 2)).toBeLessThanOrEqual(MOUNT_DEFS.gunship.seats[1]!.arc! + 1e-6);
    expect(off(right, Math.PI / 2)).toBeLessThanOrEqual(MOUNT_DEFS.gunship.seats[2]!.arc! + 1e-6);

    const rover = new Match(yard('armored_rover'), rules);
    const rd = new Driver(rover);
    const crew = [0, 1, 2].map((i) => rover.addHuman(`c${i}`)!);
    rd.run(2);
    for (const c of crew) {
      place(c, 4, 9);
      rd.use(c);
    }
    const gunners = crew.filter((c) => c.mount && MOUNT_DEFS.armored_rover.seats[c.mount.seat]!.role === 'gunner');
    expect(gunners).toHaveLength(2);
    const ev = rd.run(20, () => {
      for (const g of gunners) rd.input(g, { yaw: g.yaw, buttons: BUTTON_FIRE });
    });
    const shooters = new Set(ev.filter((e) => e.e === 'shot' && e.w === 'core.mount_mg').map((e) => (e as { s: number }).s));
    expect(shooters.size).toBe(2);
  });
});

describe('vehicle skins', () => {
  it('automatic paint follows the team; explicit skins override it; factory leaves it alone', () => {
    expect(mountTint(undefined, null)).toBeNull();
    expect(mountTint('auto', '#d04a3a')).toBe('#d04a3a');
    expect(mountTint('team', '#3a7bd5')).toBe('#3a7bd5');
    expect(mountTint('factory', '#3a7bd5')).toBeNull();
    expect(mountTint('snow', '#3a7bd5')).toMatch(/^#[0-9a-f]{6}$/);
    for (const skin of MOUNT_SKINS) expect(() => mountTint(skin, null)).not.toThrow();
  });

  it('a skin on a placed mount loads and validates; an unknown one is refused', () => {
    expect(loadMap(JSON.stringify(yard('gun_jeep', { skin: 'desert' }))).ok).toBe(true);
    expect(loadMap(JSON.stringify(yard('gun_jeep', { skin: 'chrome' as 'desert' }))).ok).toBe(false);
  });
});
