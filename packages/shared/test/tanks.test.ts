/**
 * Tanks (owner, 2026-11-07; content/vehicles/tank.json): a sealed crew nobody outside can hurt, who die with it;
 * armour that bullets barely scratch and blasts wear down; a cannon with limited shells (back slowly, all at an ammo
 * pickup) that the driver works while its seat is empty; tracks that turn on the spot; and bots that drive it, fire it
 * at targets worth a shell and get out when it is nearly dead.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BOT_DIFFICULTIES,
  BUTTON_FIRE,
  BUTTON_USE,
  CORE_BOT_PROFILES,
  DEFAULT_DEATHMATCH_RULES,
  MOUNT_DEFS,
  PLAYER,
  TICK_RATE,
  armourScale,
  firingSeat,
  getWeapon,
  initPhysics,
  lookAngles,
  weaponCode,
  type GameEvent,
  type MapDocument,
  type MapEntity,
  type PlayerInput,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { aboutToBlow, type MountView } from '../src/bots/vehicles.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const TANK = MOUNT_DEFS.tank;
const CANNON = TANK.seats.findIndex((s) => s.weapon === 'core.tank_cannon');
const rules = { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, respawnDelayTicks: 100_000 };
type MountEntity = Omit<Extract<MapEntity, { kind: 'mount' }>, 'id' | 'kind'>;
const mount = (model: string, x: number, z: number, yaw = 0): MountEntity => ({ position: [x, 0, z], model: model as 'tank', yaw, faction: null, respawnSeconds: null });

/** An open yard of `w` × `h` 8 m tiles from (-4, -4), with mounts and anything else. */
function yard(mounts: MountEntity[], extra: MapEntity[] = [], w = 5, h = 4, spawns: [number, number, number][] = [[0, 0, 0]]): MapDocument {
  const tiles = [];
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, spawns);
  return { ...map, entities: [...map.entities, ...mounts.map((m, i) => ({ id: `mount_${i}`, kind: 'mount' as const, ...m })), ...extra] };
}

interface GunLike {
  shells?: number;
  heat?: number;
}
interface MountLike {
  index: number;
  pos: { x: number; y: number; z: number };
  yaw: number;
  speed: number;
  health: number;
  alive: boolean;
  seats: (number | null)[];
  guns: (GunLike | null)[];
  body: { handle: number };
  def: (typeof MOUNT_DEFS)[keyof typeof MOUNT_DEFS];
  drive: { forward: number; right: number };
}
interface Internals {
  mounts: MountLike[];
  projectiles: unknown[];
  enterMount(c: Combatant): boolean;
  damageMount(m: MountLike, n: number, by: Combatant | null, raw?: boolean, hit?: string): void;
  damageMountBody(handle: number, n: number, by: Combatant | null, hit?: string): boolean;
  splash(at: unknown, r: number, dmg: number, edge: number, owner: Combatant | null, w: string, self: number): void;
  materialAt(handle: number): string;
}
const internals = (match: Match) => match as unknown as Internals;

class Pad {
  seq = new Map<number, number>();
  constructor(readonly match: Match) {}
  input(c: Combatant, i: Partial<PlayerInput>): void {
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
}

const place = (c: Combatant, x: number, z: number, yaw = c.yaw) => {
  c.move = { pos: { x, y: 0, z }, velY: 0, grounded: true };
  c.yaw = yaw;
  c.bot?.onSpawn(yaw);
};
const give = (c: Combatant, id: string) => {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
};
/** Into seat `seat` of mount `m` (the match's own enterMount fills driver, then gunner, then the rest). */
const board = (match: Match, c: Combatant, m: MountLike, seats: number): void => {
  for (let i = 0; i < seats; i++) {
    const filler = match.addHuman(`filler${c.slot}_${i}`)!;
    place(filler, m.pos.x + 2, m.pos.z);
    internals(match).enterMount(filler);
  }
  place(c, m.pos.x + 2, m.pos.z);
  expect(internals(match).enterMount(c)).toBe(true);
};

describe('the Tank data', () => {
  it('armour plate: bullets do a tenth, blasts 1.25 times, melee nothing; the crew is sealed in', () => {
    expect(TANK.armour).toMatchObject({ surface: 'armor', sealed: true });
    expect(armourScale(TANK, 'bullet')).toBe(0.1);
    expect(armourScale(TANK, 'blast')).toBe(1.25);
    expect(armourScale(TANK, 'melee')).toBe(0);
    expect(armourScale(TANK, 'other')).toBe(1);
    // Other vehicles keep full damage of every kind.
    expect(armourScale(MOUNT_DEFS.buggy, 'bullet')).toBe(1);
  });

  it('the cannon has 10 shells, one back every 15 s, and the driver fires it while its seat is empty', () => {
    expect(TANK.seats[CANNON]!.ammo).toEqual({ max: 10, refillSeconds: 15 });
    const driver = TANK.seats.findIndex((s) => s.role === 'driver');
    expect(firingSeat(TANK, driver, () => false)).toBe(CANNON);
    expect(firingSeat(TANK, driver, (i) => i === CANNON)).toBeNull();
    expect(firingSeat(TANK, CANNON, () => true)).toBe(CANNON);
    // A buggy's driver still has no gun.
    expect(firingSeat(MOUNT_DEFS.buggy, 0, () => false)).toBeNull();
  });
});

describe('the crew is sealed in', () => {
  it('nobody aboard a tank can be shot, blasted or struck from outside; a buggy driver can', () => {
    const match = new Match(yard([mount('tank', 12, 12), mount('buggy', 26, 12)]), rules, 3);
    const pad = new Pad(match);
    const shooter = match.addHuman('shooter')!;
    const crew = match.addHuman('crew')!;
    const rider = match.addHuman('rider')!;
    pad.run(2);
    const [tank, buggy] = internals(match).mounts;
    place(crew, 14, 12);
    expect(internals(match).enterMount(crew)).toBe(true);
    place(rider, 28, 12);
    expect(internals(match).enterMount(rider)).toBe(true);
    pad.run(2);
    // A pistol (hitscan) emptied at each from 8 m: at the head of the tank's driver, standing in its hatch.
    give(shooter, 'core.pistol');
    const shootAt = (target: Combatant) => {
      const at = { x: target.move.pos.x, y: target.move.pos.y + 0.9, z: target.move.pos.z };
      place(shooter, target.move.pos.x - 8, target.move.pos.z);
      shooter.health = shooter.maxHealth;
      for (let k = 0; k < 40; k++) {
        const eye = { x: shooter.move.pos.x, y: shooter.move.pos.y + PLAYER.eyeHeight, z: shooter.move.pos.z };
        const { yaw, pitch } = lookAngles(eye, at);
        shooter.yaw = yaw;
        shooter.pitch = pitch;
        pad.run(1, () => pad.input(shooter, { yaw, pitch, buttons: k % 2 ? 0 : BUTTON_FIRE }));
        const w = shooter.weapons.get(shooter.current)!;
        if (w.mag === 0) w.mag = w.def.magazine;
      }
    };
    shootAt(crew);
    expect(crew.health).toBe(crew.maxHealth);
    shootAt(rider);
    expect(rider.health).toBeLessThan(rider.maxHealth);
    // A rocket's blast beside them: the tank takes it, its crew doesn't.
    const before = tank!.health;
    internals(match).splash({ x: crew.move.pos.x + 1, y: crew.move.pos.y + 1, z: crew.move.pos.z }, 5, 120, 20, shooter, 'core.rockets', 1);
    expect(crew.health).toBe(crew.maxHealth);
    expect(crew.alive).toBe(true);
    expect(tank!.health).toBeLessThan(before);
    expect(buggy!.alive).toBe(true);
  });

  it('everyone still inside dies with it, credited to whoever destroyed it, and the wreck is left', () => {
    const match = new Match(yard([mount('tank', 12, 12)]), rules, 3);
    const pad = new Pad(match);
    const attacker = match.addHuman('attacker')!;
    const driver = match.addHuman('driver')!;
    const gunner = match.addHuman('gunner')!;
    pad.run(2);
    place(attacker, 30, 24);
    const tank = internals(match).mounts[0]!;
    for (const c of [driver, gunner]) {
      place(c, 14, 12);
      expect(internals(match).enterMount(c)).toBe(true);
    }
    expect(tank.seats.filter((s) => s !== null).length).toBe(2);
    internals(match).damageMount(tank, 100_000, attacker);
    const events = pad.run(2);
    expect(tank.alive).toBe(false);
    for (const c of [driver, gunner]) {
      expect(c.alive).toBe(false);
      expect(c.mount).toBeUndefined();
      expect(events.find((e) => e.e === 'kill' && e.victim === c.slot)).toMatchObject({ killer: attacker.slot, weapon: 'core.wreck' });
    }
    expect(attacker.kills).toBe(2);
    expect(events.some((e) => e.e === 'explode' && e.m === tank.index)).toBe(true);
    expect((match.snapshot([]).mt![0]! as number[])[8]! & 2).toBe(2);
  });

  it('a buggy blowing up still throws its riders out into the blast instead', () => {
    const match = new Match(yard([mount('buggy', 12, 12)]), rules, 3);
    const pad = new Pad(match);
    const driver = match.addHuman('driver')!;
    pad.run(2);
    place(driver, 14, 12);
    expect(internals(match).enterMount(driver)).toBe(true);
    driver.health = 1000;
    driver.maxHealth = 1000;
    internals(match).damageMount(internals(match).mounts[0]!, 100_000, null);
    pad.run(1);
    expect(driver.mount).toBeUndefined();
    expect(driver.alive).toBe(true);
  });
});

describe('armour: rockets against bullets', () => {
  it('a rocket blast and a shell wear it down; the same damage in bullets barely marks it', () => {
    const match = new Match(yard([mount('tank', 12, 12)]), rules, 3);
    const pad = new Pad(match);
    const a = match.addHuman('a')!;
    pad.run(2);
    place(a, 30, 24);
    const tank = internals(match).mounts[0]!;
    const full = tank.health;
    // 100 damage of bullets: 10 off.
    expect(internals(match).damageMountBody(tank.body.handle, 100, a, 'bullet')).toBe(true);
    expect(full - tank.health).toBeCloseTo(10);
    // 100 of a rocket's direct hit (a blast): 125 off.
    const mid = tank.health;
    internals(match).damageMountBody(tank.body.handle, 100, a, 'blast');
    expect(mid - tank.health).toBeCloseTo(125);
    // A rocket's splash (120 at the centre) against its hull: 150 off.
    const before = tank.health;
    internals(match).splash({ x: 12, y: 1, z: 12 + TANK.half[2] + 0.2 }, 5, 120, 20, a, 'core.rockets', 1);
    expect(before - tank.health).toBeGreaterThan(100);
    expect(before - tank.health).toBeLessThanOrEqual(150.01);
    // Melee does nothing to it.
    const now = tank.health;
    internals(match).damageMountBody(tank.body.handle, 60, a, 'melee');
    expect(tank.health).toBe(now);
    // Its hull is armour plate to bullets (rounds stop on it, never through it).
    expect(internals(match).materialAt(tank.body.handle)).toBe('armor');
    // How many of each kill a fresh one: about 6 rockets (40 + 120), 400 rifle-like rounds (30 each).
    const rocket = (40 + 120) * armourScale(TANK, 'blast');
    const round = 30 * armourScale(TANK, 'bullet');
    expect(Math.ceil(TANK.health / rocket)).toBe(6);
    expect(Math.ceil(TANK.health / round)).toBe(400);
  });

  it('bullets fired at it really do a tenth: an assault rifle emptied into the hull', () => {
    const match = new Match(yard([mount('tank', 12, 12), mount('buggy', 26, 12)]), rules, 3);
    const pad = new Pad(match);
    const a = match.addHuman('a')!;
    pad.run(2);
    const [tank, buggy] = internals(match).mounts;
    const hit = (m: MountLike) => {
      place(a, m.pos.x, m.pos.z - 9);
      give(a, 'core.pistol');
      const start = m.health;
      for (let k = 0; k < 40; k++) {
        const eye = { x: a.move.pos.x, y: a.move.pos.y + PLAYER.eyeHeight, z: a.move.pos.z };
        const { yaw, pitch } = lookAngles(eye, { x: m.pos.x, y: m.pos.y + 0.6, z: m.pos.z });
        pad.run(1, () => pad.input(a, { yaw, pitch, buttons: k % 2 ? 0 : BUTTON_FIRE }));
        const w = a.weapons.get(a.current)!;
        if (w.mag === 0) w.mag = w.def.magazine;
      }
      return start - m.health;
    };
    const onBuggy = hit(buggy!);
    const onTank = hit(tank!);
    expect(onBuggy).toBeGreaterThan(0);
    expect(onTank).toBeGreaterThan(0);
    expect(onTank / onBuggy).toBeCloseTo(0.1, 1);
  });
});

describe('the cannon: limited shells, refills and the ammo pickup', () => {
  const ammoBox = (x: number, z: number): MapEntity => ({ id: 'ammo_1', kind: 'pickup', position: [x, 0, z], item: 'core.ammo', respawnSeconds: null }) as MapEntity;

  it('the driver alone fires it, one shell a shot, and it stops at none; the HUD state carries the count', () => {
    const match = new Match(yard([mount('tank', 12, 6)], [], 5, 4), rules, 3);
    const pad = new Pad(match);
    const driver = match.addHuman('driver')!;
    pad.run(2);
    const tank = internals(match).mounts[0]!;
    place(driver, 14, 6);
    expect(internals(match).enterMount(driver)).toBe(true);
    expect(TANK.seats[driver.mount!.seat]!.role).toBe('driver');
    const gun = tank.guns[CANNON]!;
    expect(gun.shells).toBe(10);
    expect(match.privateState(driver.slot)!.mo).toEqual([tank.index, driver.mount!.seat, 0, 10]);
    // Fire ahead (up a little, over the yard) until the trigger does nothing.
    let shots = 0;
    for (let k = 0; k < TICK_RATE * 30 && gun.shells! > 0; k++) {
      const before = internals(match).projectiles.length;
      pad.run(1, () => pad.input(driver, { yaw: 0, pitch: 0.3, buttons: BUTTON_FIRE }));
      if (internals(match).projectiles.length > before) shots++;
    }
    expect(gun.shells).toBe(0);
    expect(shots).toBe(10);
    const launched = internals(match).projectiles.length;
    pad.run(TICK_RATE * 3, () => pad.input(driver, { yaw: 0, pitch: 0.3, buttons: BUTTON_FIRE }));
    expect(internals(match).projectiles.length).toBeLessThanOrEqual(launched);
    expect(match.privateState(driver.slot)!.mo![3]).toBe(0);
  });

  it('a shell comes back every 15 s, up to 10', () => {
    const match = new Match(yard([mount('tank', 12, 6)]), rules, 3);
    const pad = new Pad(match);
    pad.run(2);
    const gun = internals(match).mounts[0]!.guns[CANNON]!;
    gun.shells = 0;
    pad.run(TICK_RATE * 15 - 5);
    expect(gun.shells).toBe(0);
    pad.run(10);
    expect(gun.shells).toBe(1);
    pad.run(TICK_RATE * 15 * 12);
    expect(gun.shells).toBe(10);
  });

  it('a crewed tank over an ammo pickup fills right up and takes the pickup; an empty one leaves it', () => {
    const match = new Match(yard([mount('tank', 12, 12)], [ammoBox(12, 13)]), rules, 3);
    const pad = new Pad(match);
    const driver = match.addHuman('driver')!;
    pad.run(2);
    const tank = internals(match).mounts[0]!;
    const gun = tank.guns[CANNON]!;
    gun.shells = 2;
    // Nobody aboard: it stays where it is.
    let events = pad.run(12);
    expect(gun.shells).toBe(2);
    expect(events.some((e) => e.e === 'pickup')).toBe(false);
    place(driver, 14, 12);
    expect(internals(match).enterMount(driver)).toBe(true);
    events = pad.run(12);
    expect(gun.shells).toBe(10);
    expect(events.find((e) => e.e === 'pickup')).toMatchObject({ s: driver.slot, id: 'ammo_1', item: 'core.ammo' });
    // Taken: down a shell again, it doesn't refill until the pickup is back.
    gun.shells = 5;
    pad.run(12);
    expect(gun.shells).toBe(5);
  });

  it('a gunner in the cannon seat takes the gun over from the driver, shells and all', () => {
    const match = new Match(yard([mount('tank', 12, 6)]), rules, 3);
    const pad = new Pad(match);
    const driver = match.addHuman('driver')!;
    const gunner = match.addHuman('gunner')!;
    pad.run(2);
    const tank = internals(match).mounts[0]!;
    place(driver, 14, 6);
    internals(match).enterMount(driver);
    tank.guns[CANNON]!.shells = 7;
    place(gunner, 14, 6);
    internals(match).enterMount(gunner);
    expect(gunner.mount!.seat).toBe(CANNON);
    expect(match.privateState(gunner.slot)!.mo![3]).toBe(7);
    // The driver has no gun now.
    expect(match.privateState(driver.slot)!.mo!.length).toBe(3);
    const before = internals(match).projectiles.length;
    pad.run(TICK_RATE, () => pad.input(driver, { yaw: 0, pitch: 0.3, buttons: BUTTON_FIRE }));
    expect(internals(match).projectiles.length).toBe(before);
    expect(tank.guns[CANNON]!.shells).toBe(7);
  });

  it('a respawned tank comes back with a full load', () => {
    const match = new Match(yard([{ ...mount('tank', 12, 6), respawnSeconds: 2 }]), rules, 3);
    const pad = new Pad(match);
    pad.run(2);
    const tank = internals(match).mounts[0]!;
    tank.guns[CANNON]!.shells = 1;
    internals(match).damageMount(tank, 100_000, null);
    pad.run(TICK_RATE * 3);
    expect(tank.alive).toBe(true);
    expect(tank.guns[CANNON]!.shells).toBe(10);
  });
});

describe('tracks', () => {
  it('a tank turns on the spot; a buggy standing still does not', () => {
    const match = new Match(yard([mount('tank', 12, 12), mount('buggy', 28, 12)]), rules, 3);
    const pad = new Pad(match);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    pad.run(2);
    const [tank, buggy] = internals(match).mounts;
    place(a, 14, 12);
    internals(match).enterMount(a);
    place(b, 30, 12);
    internals(match).enterMount(b);
    pad.run(TICK_RATE * 2, () => {
      pad.input(a, { right: 1 });
      pad.input(b, { right: 1 });
    });
    // 0.8 rad/s for 2 s.
    expect(Math.abs(tank!.yaw)).toBeGreaterThan(1.3);
    expect(Math.hypot(tank!.pos.x - 12, tank!.pos.z - 12)).toBeLessThan(0.5);
    expect(Math.abs(buggy!.yaw)).toBeLessThan(0.05);
  });
});

describe('bots in tanks', () => {
  const quiet = { ...CORE_BOT_PROFILES[3]!, exploration: 0, itemGreed: 0, tags: [] };

  it('bail out at a quarter of its health (not before), and at once when it catches fire', () => {
    const view = (health: number, burning = false): MountView => ({ index: 0, kind: 'vehicle', pos: { x: 0, y: 0, z: 0 }, yaw: 0, health, alive: true, enterRadius: 4, seats: [], sealed: true, bailHealth: 0.25, ...(burning ? { burning } : {}) });
    expect(aboutToBlow(view(0.28))).toBe(false);
    expect(aboutToBlow(view(0.24))).toBe(true);
    expect(aboutToBlow(view(0.9, true))).toBe(true);
    // Other vehicles keep 0.3.
    expect(aboutToBlow({ ...view(0.28), bailHealth: undefined })).toBe(true);

    const match = new Match(yard([mount('tank', 20, 14)], [], 5, 4, [[0, 0, 0], [30, 0, 24]]), rules, 3);
    const bot = match.addBot('bot', quiet, BOT_DIFFICULTIES.normal)!;
    match.step();
    const tank = internals(match).mounts[0]!;
    place(bot, 22, 14);
    expect(internals(match).enterMount(bot)).toBe(true);
    // Still above a quarter: it stays in.
    tank.health = TANK.health * 0.3;
    for (let t = 0; t < TICK_RATE * 2; t++) match.step();
    expect(bot.mount).toBeDefined();
    tank.health = TANK.health * 0.2;
    let out = -1;
    for (let t = 0; t < TICK_RATE * 3 && out < 0; t++) {
      match.step();
      if (!bot.mount) out = t;
    }
    expect(out).toBeGreaterThanOrEqual(0);
    expect(out).toBeLessThan(TICK_RATE * 1.5);
    expect(bot.alive).toBe(true);
    expect(bot.bot!.tankLog.bails).toBe(1);
  });

  it('a bot drives a tank across an open field to the far side without getting stuck', () => {
    // A 112 m field; it gets in at one corner, its goal (the far spawn) is the other.
    const match = new Match(yard([mount('tank', 12, 12, Math.PI)], [], 14, 14, [[0, 0, 0], [96, 0, 96]]), rules, 5);
    const bot = match.addBot('bot', quiet, BOT_DIFFICULTIES.normal)!;
    match.step();
    const tank = internals(match).mounts[0]!;
    place(bot, 14, 12);
    expect(internals(match).enterMount(bot)).toBe(true);
    // Where it is going (a far objective, as a match's roam or order would give it).
    (bot.bot as unknown as { roamGoal: { x: number; y: number; z: number } }).roamGoal = { x: 96, y: 0, z: 96 };
    let out = -1;
    for (let t = 0; t < TICK_RATE * 40 && out < 0; t++) {
      match.step();
      if (!bot.mount) out = t;
    }
    // It got there (out within 14 m of its goal, the spawn furthest from where it set off), turning round first
    // (it was parked facing away), with no back-outs and no drive given up.
    expect(out).toBeGreaterThan(0);
    expect(Math.hypot(tank.pos.x - 96, tank.pos.z - 96)).toBeLessThan(20);
    expect(bot.bot!.tankLog).toMatchObject({ drives: 1, backOuts: 0, stuck: 0 });
  });

  it('a bot alone at the wheel fires the cannon at an enemy vehicle and keeps its shells for targets worth one', () => {
    const match = new Match(yard([mount('tank', 12, 6), mount('buggy', 12, 42)], [], 5, 7, [[0, 0, 0], [30, 0, 48]]), rules, 7);
    const bot = match.addBot('bot', quiet, BOT_DIFFICULTIES.hard)!;
    const enemy = match.addHuman('enemy')!;
    match.step();
    const [tank, buggy] = internals(match).mounts;
    place(bot, 14, 6, 0);
    expect(internals(match).enterMount(bot)).toBe(true);
    place(enemy, 14, 42);
    expect(internals(match).enterMount(enemy)).toBe(true);
    const start = buggy!.health;
    for (let t = 0; t < TICK_RATE * 15 && buggy!.alive; t++) match.step();
    // It turned onto the buggy and shelled it.
    expect(tank!.guns[CANNON]!.shells).toBeLessThan(10);
    expect(buggy!.health).toBeLessThan(start);
    expect(bot.mount).toBeDefined();
  });
});
