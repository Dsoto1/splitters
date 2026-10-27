/**
 * The seven benchmark weapons of docs/GUNPLAY_DIRECTION.md and the feel rules
 * of its "Do not accidentally make" list (audit: docs/GUNPLAY_AUDIT.md). These
 * pin the personalities, not exact numbers: the revolver absurd but
 * punishing, the SMG steady then wild, the shotgun close, the precision rifle
 * patient with drop, the rocket slow with splash and self-damage; switches
 * fast, hip fire strong, sprinting never delays a shot.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_FIRE,
  BUTTON_SPRINT,
  DEFAULT_DEATHMATCH_RULES,
  PLAYER,
  TICK_RATE,
  falloffAt,
  flightTo,
  getWeapon,
  gunplayOf,
  initPhysics,
  kickOf,
  lookAngles,
  newGunState,
  penetrate,
  recoilIdle,
  recoilShot,
  shotCone,
  spreadOf,
  waterSpan,
  weaponCode,
  type GameEvent,
  type MapDocument,
  type MapEntity,
  type MatchRules,
  type PlayerInput,
} from '../src/index.ts';
import { Match, NO_SCOPE_SPREAD, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** Benchmark → the existing weapon it maps to (GUNPLAY_AUDIT.md). */
const BENCH = {
  pistol: 'core.pistol',
  revolver: 'core.revolver',
  smg: 'core.smg',
  rifle: 'core.rifle',
  shotgun: 'core.shotgun',
  precision: 'core.sniper',
  rocket: 'core.rockets',
} as const;

const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
const still = { run: 0, airborne: false, stance: 1 };
const running = { run: 1, airborne: false, stance: 1 };
const eye = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z });
const chest = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + 1.1, z: p.z });
const head = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + PLAYER.height - 0.12, z: p.z });

function deck(extra: MapEntity[] = []): MapDocument {
  const tiles = [];
  for (let x = -1; x < 12; x++) for (let y = -2; y <= 2; y++) tiles.push({ id: `p_${x}_${y}`, tile: 'core.platform', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 0]]);
  return { ...map, entities: [...map.entities, ...extra] };
}

function give(c: Combatant, id: string): void {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
  c.raiseTicks = 0;
  c.fireCooldown = 0;
}

/** Shooter at the origin with `weapon`, targets standing where given. */
function setup(weapon: string, targets: [number, number, number][], extra: MapEntity[] = []) {
  const match = new Match(deck(extra), rules);
  const a = match.addHuman('a')!;
  const others = targets.map((_, i) => match.addHuman(`t${i}`)!);
  a.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
  targets.forEach((t, i) => (others[i]!.move = { pos: { x: t[0], y: t[1], z: t[2] }, velY: 0, grounded: true }));
  give(a, weapon);
  let seq = 0;
  const step = (i: Partial<PlayerInput> = {}): GameEvent[] => {
    match.queueInputs(a.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: a.yaw, pitch: a.pitch, buttons: 0, ...i }]);
    for (const o of others) match.queueInputs(o.slot, [{ seq, forward: 0, right: 0, yaw: o.yaw, pitch: o.pitch, buttons: 0 }]);
    return match.step();
  };
  return { match, a, others, step };
}

describe('benchmark personalities', () => {
  it('the heavy revolver is absurdly powerful: a head shot kills at any range, a body shot takes most of a life', () => {
    const def = getWeapon(BENCH.revolver);
    const gp = gunplayOf(def);
    expect(def.damage).toBeGreaterThanOrEqual(85);
    expect(def.damage * gp.head * falloffAt(gp.falloff, 1000)).toBeGreaterThanOrEqual(PLAYER.maxHealth);
    expect(def.damage).toBeGreaterThan(getWeapon(BENCH.pistol).damage * 3);
    // In a match: one round to the head at 40 m drops a player.
    const { a, others, step } = setup(BENCH.revolver, [[40, 0, 0]]);
    const target = others[0]!;
    const aim = lookAngles(eye(a.move.pos), head(target.move.pos));
    step({ ...aim, buttons: BUTTON_FIRE });
    for (let i = 0; i < 10; i++) step(aim);
    expect(target.alive).toBe(false);
  });

  it('the revolver punishes misses: savage kick, five rounds, and fanning it throws the next round wide', () => {
    const def = getWeapon(BENCH.revolver);
    const gp = gunplayOf(def);
    expect(def.magazine).toBeLessThanOrEqual(5);
    expect(def.fireIntervalTicks).toBeGreaterThanOrEqual(36);
    expect(kickOf(gp.kick!, 0).pitch).toBeGreaterThan(kickOf(gunplayOf(getWeapon(BENCH.rifle)).kick!, 0).pitch * 10);
    // Rhythm: fire again as soon as the hammer is back and the round goes ~40 times wider than a settled one.
    const g = newGunState();
    const first = spreadOf(gp.accuracy!, g, still);
    recoilShot(g, gp.kick);
    for (let i = 0; i < def.fireIntervalTicks; i++) recoilIdle(g, gp.kick, gp.accuracy, def.fireIntervalTicks);
    const fanned = spreadOf(gp.accuracy!, g, still);
    expect(fanned).toBeGreaterThan(first * 20);
    expect(fanned * 25).toBeGreaterThan(PLAYER.radius); // a coin toss on a body at 25 m
    // Wait out the rhythm (about a second between shots) and it is dead on again.
    for (let i = 0; i < TICK_RATE - def.fireIntervalTicks; i++) recoilIdle(g, gp.kick, gp.accuracy, def.fireIntervalTicks);
    expect(spreadOf(gp.accuracy!, g, still)).toBe(first);
  });

  it('the SMG is steady for its first rounds, then increasingly wild while the trigger stays down', () => {
    const def = getWeapon(BENCH.smg);
    const gp = gunplayOf(def);
    const a = gp.accuracy!;
    const g = newGunState();
    const cones: number[] = [];
    const kicks: number[] = [];
    for (let i = 0; i < 20; i++) {
      cones.push(spreadOf(a, g, still));
      kicks.push(kickOf(gp.kick!, i).pitch);
      recoilShot(g, gp.kick);
    }
    for (let i = 0; i <= 5; i++) expect(cones[i]).toBe(a.base);
    // The first kicks are the gentlest of the seven; the climb then triples.
    expect(kicks[0]).toBeLessThan(kickOf(gunplayOf(getWeapon(BENCH.pistol)).kick!, 0).pitch / 3);
    expect(kicks[10]!).toBeGreaterThanOrEqual(kicks[0]! * 3);
    expect(cones[10]!).toBeGreaterThan(a.base * 5);
    expect(cones[19]!).toBeGreaterThan(a.base * 12);
    // Let go: even a 20-round spray is forgotten in half a second (a short burst almost at once).
    for (let i = 0; i < TICK_RATE / 2 + def.fireIntervalTicks; i++) recoilIdle(g, gp.kick, a, def.fireIntervalTicks);
    expect(spreadOf(a, g, still)).toBe(a.base);
  });

  it('the shotgun has a real pattern: one shot kills up close, it barely scratches at 20 m', () => {
    const def = getWeapon(BENCH.shotgun);
    const gp = gunplayOf(def);
    // The pellets spread even from a settled stance (the pattern is the weapon's own).
    expect(shotCone(def, gp.accuracy!, newGunState(), still)).toBeGreaterThanOrEqual(def.spread);
    const blast = (dist: number) => {
      const { a, others, step } = setup(BENCH.shotgun, [[dist, 0, 0]]);
      const aim = lookAngles(eye(a.move.pos), chest(others[0]!.move.pos));
      step({ ...aim, buttons: BUTTON_FIRE });
      step(aim);
      return PLAYER.maxHealth - Math.max(0, others[0]!.health);
    };
    expect(blast(3)).toBeGreaterThanOrEqual(PLAYER.maxHealth);
    let far = 0;
    for (let i = 0; i < 4; i++) far = Math.max(far, blast(20));
    expect(far).toBeLessThan(35);
  });

  it('the precision rifle rewards patience and holdover: least lead, real drop far out, a settled next shot', () => {
    const def = getWeapon(BENCH.precision);
    const gp = gunplayOf(def);
    const b = gp.ballistic!;
    for (const id of [BENCH.pistol, BENCH.smg, BENCH.rifle, BENCH.revolver]) expect(flightTo(b, 200).time).toBeLessThan(flightTo(gunplayOf(getWeapon(id)).ballistic!, 200).time);
    expect(flightTo(b, 200).drop).toBeGreaterThan(0.35);
    expect(flightTo(b, 50).drop).toBeLessThan(0.05);
    // A head shot kills outright; a body shot and anything else does.
    expect(def.damage * gp.head).toBeGreaterThan(PLAYER.maxHealth * 2);
    expect(def.damage + getWeapon(BENCH.pistol).damage).toBeGreaterThanOrEqual(PLAYER.maxHealth);
    // Patience: scoped, the shot the moment the bolt closes is off by more than a head at 100 m; wait and it is true.
    const g = { ...newGunState(), ads: 1 };
    recoilShot(g, gp.kick);
    for (let i = 0; i < def.fireIntervalTicks; i++) recoilIdle(g, gp.kick, gp.accuracy, def.fireIntervalTicks);
    expect(spreadOf(gp.accuracy!, g, still) * 100).toBeGreaterThan(0.15);
    for (let i = 0; i < TICK_RATE; i++) recoilIdle(g, gp.kick, gp.accuracy, def.fireIntervalTicks);
    expect(spreadOf(gp.accuracy!, g, still)).toBe(0);
  });

  it('the rocket launcher rewards prediction: a slow rocket, a big blast, self-damage, quick to bring back', () => {
    const def = getWeapon(BENCH.rocket);
    const p = def.projectile!;
    expect(p.speed).toBeLessThanOrEqual(40);
    // Leading a runner at 20 m by a few metres.
    expect((20 / p.speed) * PLAYER.runSpeed).toBeGreaterThan(3);
    expect((p.impactDamage ?? 0) + p.splashDamage).toBeGreaterThanOrEqual(PLAYER.maxHealth);
    expect(p.splashRadius).toBeGreaterThanOrEqual(4.5);
    expect(p.selfDamageScale).toBeGreaterThanOrEqual(0.7);
    expect(def.raiseTicks).toBeLessThanOrEqual(TICK_RATE * 0.55);
    // Trigger held: a rocket about every 1.5 s, reload included.
    const { a, step } = setup(BENCH.rocket, []);
    const w = a.weapons.get(weaponCode(def))!;
    const before = w.mag + w.reserve;
    for (let i = 0; i < TICK_RATE * 4.6; i++) step({ yaw: 0, pitch: 0.4, buttons: BUTTON_FIRE });
    expect(before - (w.mag + w.reserve)).toBeGreaterThanOrEqual(3);
  });
});

describe('do not accidentally make (GUNPLAY_DIRECTION.md)', () => {
  const ids = Object.values(BENCH);

  it('hip fire is strong and moving costs little: a running hip shot stays on a body at 25 m', () => {
    for (const id of [BENCH.pistol, BENCH.revolver, BENCH.smg, BENCH.rifle]) {
      const a = gunplayOf(getWeapon(id)).accuracy!;
      expect(spreadOf(a, newGunState(), still), id).toBeLessThanOrEqual(0.006);
      expect(spreadOf(a, newGunState(), running) * 25, id).toBeLessThanOrEqual(PLAYER.radius);
    }
    // Hip specialists barely gain from the sights.
    for (const id of [BENCH.smg, BENCH.shotgun]) expect(gunplayOf(getWeapon(id)).accuracy!.ads, id).toBeGreaterThanOrEqual(0.8);
    // Even the sniper can take a hip shot across a room.
    expect(NO_SCOPE_SPREAD * 8).toBeLessThanOrEqual(PLAYER.radius);
  });

  it('switching is fast: every benchmark weapon is up in about half a second or less, sidearms in a quarter', () => {
    for (const id of ids) expect(getWeapon(id).raiseTicks, id).toBeLessThanOrEqual(TICK_RATE * 0.55);
    expect(getWeapon(BENCH.pistol).raiseTicks).toBeLessThanOrEqual(TICK_RATE * 0.17);
    expect(getWeapon(BENCH.revolver).raiseTicks).toBeLessThanOrEqual(TICK_RATE * 0.3);
  });

  it('no two benchmark weapons are alike on rate and damage', () => {
    const sig = ids.map((id) => {
      const d = getWeapon(id);
      return `${d.fireIntervalTicks}/${d.damage * d.pellets + (d.projectile?.splashDamage ?? 0)}`;
    });
    expect(new Set(sig).size).toBe(ids.length);
  });

  it('sprinting never delays a shot: fire while sprinting goes off in that same input', () => {
    for (const id of [BENCH.pistol, BENCH.rifle, BENCH.shotgun]) {
      const { a, step } = setup(id, []);
      for (let i = 0; i < 20; i++) step({ forward: 1, yaw: Math.PI / 2, buttons: BUTTON_SPRINT });
      expect(a.move.sprint, id).toBe(true);
      const ev = step({ forward: 1, yaw: Math.PI / 2, buttons: BUTTON_SPRINT | BUTTON_FIRE });
      expect(ev.some((e) => e.e === 'shot' && e.s === a.slot), id).toBe(true);
      expect(a.move.sprint).toBeFalsy();
    }
  });
});

describe('water soaks up bullets', () => {
  const pool = (thick: number): MapEntity => ({ id: 'pool', kind: 'water', position: [6, 0, 0], size: [thick, 3, 4], liquid: 'water' }) as MapEntity;

  it('measures the path under water', () => {
    const box = [{ min: { x: 5.5, y: 0, z: -2 }, max: { x: 6.5, y: 3, z: 2 }, liquid: 'water' as const }];
    const span = waterSpan(box, { x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 20)!;
    expect(span.enter).toBeCloseTo(5.5, 6);
    expect(span.length).toBeCloseTo(1, 6);
    expect(waterSpan(box, { x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 5)).toBeNull();
    expect(waterSpan([{ ...box[0]!, liquid: 'lava' as const }], { x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 20)).toBeNull();
    // A metre of water stops a pistol round, a rifle round gets through weakened.
    expect(penetrate(gunplayOf(getWeapon(BENCH.pistol)).ballistic!.energy, 'water', 1)).toBeNull();
    expect(penetrate(gunplayOf(getWeapon(BENCH.rifle)).ballistic!.energy, 'water', 1)).not.toBeNull();
  });

  it('a rifle round through a metre of water hurts the player behind it less; a pistol round dies in it', () => {
    const through = (weapon: string) => {
      const { a, others, step } = setup(weapon, [[12, 0, 0]], [pool(1)]);
      const aim = lookAngles(eye(a.move.pos), chest(others[0]!.move.pos));
      step({ ...aim, buttons: BUTTON_FIRE });
      for (let i = 0; i < 4; i++) step(aim);
      return PLAYER.maxHealth - others[0]!.health;
    };
    const rifle = through(BENCH.rifle);
    expect(rifle).toBeGreaterThan(0);
    expect(rifle).toBeLessThan(getWeapon(BENCH.rifle).damage);
    expect(through(BENCH.pistol)).toBe(0);
  });
});
