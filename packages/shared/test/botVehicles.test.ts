import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, DEFAULT_DEATHMATCH_RULES, PLAYER, getWeapon, initPhysics, weaponCode, type MapDocument, type MapEntity, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { weaponScore, type CombatantView, type InventoryView, type MountView } from '../src/bots/brain.ts';
import {
  RECOVER_TICKS,
  STUCK_SLOW_TICKS,
  STUCK_WINDOW_TICKS,
  aboutToBlow,
  antiVehicle,
  freshDrive,
  inVehiclePath,
  mountOf,
  noHeadway,
  rideFor,
  steer,
  vehicleFor,
} from '../src/bots/vehicles.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const car = (over: Partial<MountView> = {}): MountView => ({ index: 0, kind: 'vehicle', pos: { x: 0, y: 0, z: 0 }, yaw: 0, health: 1, alive: true, enterRadius: 2, seats: [{ role: 'driver', free: true }], ...over });

describe('bot drivers getting stuck', () => {
  it('backs out for a second when wedged, and gives up (gets out) when still stuck right after', () => {
    const st = freshDrive();
    const m = car();
    const goal = { x: 0, y: 0, z: 100 };
    let firstReverse = -1;
    let reverseTicks = 0;
    let gaveUp = -1;
    for (let t = 0; t < 600 && gaveUp < 0; t++) {
      const c = steer(st, t, m, goal, 100);
      if (c.forward < 0) {
        reverseTicks++;
        if (firstReverse < 0) firstReverse = t;
      }
      if (st.stuck) gaveUp = t;
    }
    // Not moving at all: backs out after about a second and a half, for a second.
    expect(firstReverse).toBeGreaterThan(STUCK_SLOW_TICKS - 5);
    expect(firstReverse).toBeLessThan(STUCK_SLOW_TICKS + 5);
    expect(reverseTicks).toBe(RECOVER_TICKS);
    // Still stuck after that: gives up instead of backing out again and again.
    expect(gaveUp).toBeGreaterThan(firstReverse + RECOVER_TICKS);
    expect(gaveUp).toBeLessThan(firstReverse + RECOVER_TICKS + STUCK_WINDOW_TICKS + 5);
    expect(st.unstick).toBe(1);
    expect(steer(st, 700, m, goal, 100)).toEqual({ forward: 0, right: 0 });
  });

  it('grinding along a wall (moving, but getting nowhere) counts as stuck', () => {
    const st = freshDrive();
    const m = car();
    let reversed = -1;
    // 0.7 m/s: too fast for the stopped check, but under 2 m in 2.5 s.
    for (let t = 0; t < 400 && reversed < 0; t++) {
      m.pos = { x: Math.sin(t / 20) * 1.5, y: 0, z: 0 };
      if (steer(st, t, m, { x: 0, y: 0, z: 100 }, 100).forward < 0) reversed = t;
    }
    expect(reversed).toBeGreaterThanOrEqual(STUCK_WINDOW_TICKS);
    expect(reversed).toBeLessThan(STUCK_WINDOW_TICKS * 2 + 2);
  });

  it('a back-out that frees the vehicle carries on driving', () => {
    const st = freshDrive();
    const m = car();
    let t = 0;
    for (; t < 400 && st.unstick === 0; t++) steer(st, t, m, { x: 0, y: 0, z: 100 }, 100);
    expect(st.unstick).toBe(1);
    // Free now: it gets going again and keeps going.
    for (let i = 0; i < 600; i++, t++) {
      m.pos = { x: 0, y: 0, z: m.pos.z + 0.2 };
      steer(st, t, m, { x: 0, y: 0, z: 1000 }, 1000);
    }
    expect(st.stuck).toBe(false);
    expect(st.unstick).toBe(1);
  });

  it('steering twice in a tick (an armed pilot turning onto a target) does not count as standing still', () => {
    const st = freshDrive();
    const m = car();
    for (let t = 0; t < 400; t++) {
      m.pos = { x: 0, y: 0, z: t * 0.2 };
      steer(st, t, m, { x: 0, y: 0, z: 1000 }, 1000);
      steer(st, t, m, { x: 10, y: 0, z: 1000 }, 30);
    }
    expect(st.unstick).toBe(0);
  });

  it('riders watching a bot driver: no headway over the window is stuck', () => {
    const h = { pos: null, tick: 0 };
    expect(noHeadway(h, { x: 0, y: 0, z: 0 }, 0, 180, 2)).toBe(false);
    expect(noHeadway(h, { x: 0.5, y: 0, z: 0 }, 100, 180, 2)).toBe(false);
    expect(noHeadway(h, { x: 1, y: 0, z: 0 }, 180, 180, 2)).toBe(true);
    // The next window: it moved on.
    expect(noHeadway(h, { x: 9, y: 0, z: 0 }, 360, 180, 2)).toBe(false);
  });

  it('everyone gets out of a burning or wrecked vehicle; stuck and burning ones are not taken', () => {
    expect(aboutToBlow(car({ health: 0.9 }))).toBe(false);
    expect(aboutToBlow(car({ health: 0.2 }))).toBe(true);
    expect(aboutToBlow(car({ health: 0.9, burning: true }))).toBe(true);
    const from = { x: 0, y: 0, z: 0 };
    const goal = { x: 0, y: 0, z: 150 };
    const parked = car({ pos: { x: 4, y: 0, z: -3 } });
    expect(vehicleFor([parked], from, goal, 22)?.index).toBe(0);
    expect(vehicleFor([{ ...parked, burning: true }], from, goal, 22)).toBeNull();
    expect(vehicleFor([parked], from, goal, 22, (m) => m.index === 0)).toBeNull();
    const ride = car({ pos: { x: 4, y: 0, z: 0 }, seats: [{ role: 'driver', free: false, by: 7 }, { role: 'passenger', free: true }] });
    const allies = [{ slot: 7, human: true }];
    expect(rideFor([ride], from, 1, allies, 25)?.index).toBe(0);
    expect(rideFor([ride], from, 1, allies, 25, () => true)).toBeNull();
  });
});

describe('enemy vehicles', () => {
  it('knows when someone is bearing down on it, and which way is out of the path', () => {
    // Heading +z at 15 m/s from the origin.
    const kart = car({ speed: 15 });
    const ahead = inVehiclePath(kart, { x: 1, y: 0, z: 20 });
    expect(ahead).not.toBeNull();
    expect(ahead!.eta).toBeCloseTo(20 / 15, 3);
    // The right of a vehicle heading +z is +x, where the bot is: out of the path is further that way.
    expect(ahead!.side).toBe(1);
    expect(Math.sin(ahead!.away)).toBeCloseTo(1, 5);
    // Off to the side, behind, too far ahead, or going slowly: no danger.
    expect(inVehiclePath(kart, { x: 5, y: 0, z: 20 })).toBeNull();
    expect(inVehiclePath(kart, { x: 0, y: 0, z: -5 })).toBeNull();
    expect(inVehiclePath(kart, { x: 0, y: 0, z: 60 })).toBeNull();
    expect(inVehiclePath(car({ speed: 2 }), { x: 0, y: 0, z: 3 })).toBeNull();
    // Backing up, the danger is behind it.
    expect(inVehiclePath(car({ speed: 6, reversing: true }), { x: 0, y: 0, z: -5 })).not.toBeNull();
    expect(inVehiclePath(car({ speed: 6, reversing: true }), { x: 0, y: 0, z: 5 })).toBeNull();
  });

  it('finds the vehicle an enemy is sitting in', () => {
    const a = car({ index: 3, seats: [{ role: 'driver', free: false, by: 5 }, { role: 'gunner', free: false, by: 6 }] });
    expect(mountOf([car(), a], 6)).toEqual({ mount: a, seat: 1 });
    expect(mountOf([car(), a], 9)).toBeNull();
  });

  it('takes a launcher (not a knife) to a vehicle, even when the driver is nearly dead', () => {
    expect(antiVehicle(getWeapon('core.rockets'))).toBe(true);
    expect(antiVehicle(getWeapon('core.rifle'))).toBe(false);
    const profile = CORE_BOT_PROFILES.find((p) => p.id === 'core.normal') ?? CORE_BOT_PROFILES[0]!;
    const gun = (id: string, mag?: number, reserve?: number): InventoryView => {
      const def = getWeapon(id);
      return { def, mag: mag ?? def.magazine, reserve: reserve ?? def.reserveMax };
    };
    const driver: CombatantView = { slot: 1, pos: { x: 20, y: 0, z: 0 }, yaw: 0, pitch: 0, health: 20, armor: 0, alive: true, mounted: true };
    const pick = (guns: InventoryView[], vehicle: boolean, dist = 20) => {
      let best = '';
      let bestScore = -Infinity;
      for (const w of guns) {
        const s = weaponScore(w, { dist, target: driver, held: w === guns[0], loadedElsewhere: true, profile, vehicle });
        if (s > bestScore) [best, bestScore] = [w.def.id, s];
      }
      return best;
    };
    const kit = [gun('core.rifle'), gun('core.rockets', 1, 0)];
    expect(pick(kit, false)).toBe('core.rifle');
    expect(pick(kit, true)).toBe('core.rockets');
    // Not inside its own blast, though.
    expect(pick(kit, true, 3)).toBe('core.rifle');
  });
});

// ------------------------------------------------------------------ in a match

/** An open yard 40 × 32 m (x -4..36, z -4..28) with walls round it, and some mounts. */
function yard(mounts: Omit<Extract<MapEntity, { kind: 'mount' }>, 'id' | 'kind'>[], spawns: [number, number, number][]): MapDocument {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 4; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, spawns);
  return { ...map, entities: [...map.entities, ...mounts.map((m, i) => ({ id: `mount_${i}`, kind: 'mount' as const, ...m }))] };
}

interface MountRtLike {
  pos: { x: number; y: number; z: number };
  speed: number;
  burning: boolean;
  health: number;
  alive: boolean;
  drive: { forward: number };
}
const internals = (match: Match) => match as unknown as { mounts: MountRtLike[]; enterMount(c: Combatant): boolean };
const place = (c: Combatant, x: number, z: number, yaw = c.yaw) => {
  c.move = { pos: { x, y: 0, z }, velY: 0, grounded: true };
  c.yaw = yaw;
  c.bot?.onSpawn(yaw);
};
const quiet = { ...CORE_BOT_PROFILES[3]!, exploration: 0, itemGreed: 0, tags: [] };
const give = (c: Combatant, id: string) => {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
};

describe('bot vehicle sense in a match', () => {
  it('a bot wedged at the wheel backs out, then gets out and leaves that vehicle alone', () => {
    const match = new Match(yard([{ position: [30, 0, 22], model: 'kart', yaw: 0, faction: null, respawnSeconds: null }], [[0, 0, 0]]), { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, respawnDelayTicks: 100_000 }, 3);
    const bot = match.addBot('bot', quiet, BOT_DIFFICULTIES.normal)!;
    match.step();
    place(bot, 31, 22);
    const { mounts, enterMount } = internals(match);
    const kart = mounts[0]!;
    expect(enterMount.call(match, bot)).toBe(true);
    const home = { ...kart.pos };
    let reversed = -1;
    let out = -1;
    for (let t = 0; t < 60 * 10 && out < 0; t++) {
      match.step();
      // Wedged: it can't move however it is driven.
      kart.pos.x = home.x;
      kart.pos.z = home.z;
      kart.speed = 0;
      if (reversed < 0 && kart.drive.forward < 0) reversed = t;
      if (!bot.mount) out = t;
    }
    expect(reversed).toBeGreaterThan(0);
    expect(out).toBeGreaterThan(reversed);
    // Out within a few seconds of the back-out not working.
    expect(out).toBeLessThan(60 * 7);
    const brain = bot.bot as unknown as { avoidMounts: Map<number, number> };
    expect(brain.avoidMounts.has((kart as unknown as { index: number }).index)).toBe(true);
  });

  it('a bot gets out of a vehicle that catches fire, however healthy it looked', () => {
    const match = new Match(yard([{ position: [30, 0, 22], model: 'kart', yaw: 0, faction: null, respawnSeconds: null }], [[0, 0, 0]]), { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, respawnDelayTicks: 100_000 }, 3);
    const bot = match.addBot('bot', quiet, BOT_DIFFICULTIES.normal)!;
    match.step();
    place(bot, 31, 22);
    const { mounts, enterMount } = internals(match);
    expect(enterMount.call(match, bot)).toBe(true);
    for (let t = 0; t < 90; t++) match.step();
    expect(bot.mount).toBeDefined();
    // Set alight (as by lava): it would blow in five seconds.
    mounts[0]!.burning = true;
    let out = -1;
    for (let t = 0; t < 60 * 4 && out < 0; t++) {
      match.step();
      if (!bot.mount) out = t;
    }
    expect(out).toBeGreaterThanOrEqual(0);
    expect(out).toBeLessThan(90);
  });

  it('steps out of the path of an enemy kart driven at it', () => {
    const run = (dodge: boolean) => {
      const match = new Match(yard([{ position: [4, 0, 12], model: 'kart', yaw: Math.PI / 2, faction: null, respawnSeconds: null }], [[0, 0, 0], [30, 0, 24]]), { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, respawnDelayTicks: 100_000 }, 5);
      const human = match.addHuman('driver')!;
      const bot = match.addBot('bot', quiet, BOT_DIFFICULTIES.hard)!;
      match.step();
      place(human, 4, 13);
      // Facing the kart, a pistol only (nothing that stops a kart).
      place(bot, 30, 12, -Math.PI / 2);
      bot.weapons.clear();
      give(bot, 'core.pistol');
      bot.throwable = null;
      const { enterMount } = internals(match);
      expect(enterMount.call(match, human)).toBe(true);
      if (!dodge) (bot.bot as unknown as { watchTraffic(): void }).watchTraffic = () => {};
      let seq = 0;
      let minHealth = PLAYER.maxHealth;
      for (let t = 0; t < 60 * 3; t++) {
        const i: PlayerInput = { seq: ++seq, forward: 1, right: 0, yaw: human.yaw, pitch: 0, buttons: 0 };
        match.queueInputs(human.slot, [i]);
        human.health = 100;
        match.step();
        minHealth = Math.min(minHealth, bot.alive ? bot.health : 0);
      }
      return minHealth;
    };
    // Standing its ground it gets run over; watching the traffic it gets out of the way.
    expect(run(false)).toBeLessThan(PLAYER.maxHealth);
    expect(run(true)).toBe(PLAYER.maxHealth);
  });

  it('switches to its launcher against an enemy in a vehicle and hits the vehicle', () => {
    const match = new Match(yard([{ position: [8, 0, 12], model: 'buggy', yaw: Math.PI / 2, faction: null, respawnSeconds: null }], [[0, 0, 0], [30, 0, 24]]), { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, respawnDelayTicks: 100_000 }, 7);
    const human = match.addHuman('driver')!;
    const bot = match.addBot('bot', quiet, BOT_DIFFICULTIES.hard)!;
    match.step();
    place(human, 8, 13.5);
    place(bot, 30, 12, -Math.PI / 2);
    bot.weapons.clear();
    give(bot, 'core.rockets');
    give(bot, 'core.rifle');
    const { mounts, enterMount } = internals(match);
    expect(enterMount.call(match, human)).toBe(true);
    const start = mounts[0]!.health;
    let seq = 0;
    let heldRockets = false;
    for (let t = 0; t < 60 * 8; t++) {
      match.queueInputs(human.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: human.yaw, pitch: 0, buttons: 0 }]);
      human.health = 100;
      bot.health = 100;
      match.step();
      if (bot.current === weaponCode(getWeapon('core.rockets'))) heldRockets = true;
    }
    expect(heldRockets).toBe(true);
    expect(mounts[0]!.health).toBeLessThan(start);
  });
});
