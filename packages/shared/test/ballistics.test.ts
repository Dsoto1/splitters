import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_FIRE,
  DEFAULT_DEATHMATCH_RULES,
  FAMILY_DEFAULTS,
  LETHALITY_HEALTH,
  NEAR_INSTANT_M,
  PLAYER,
  PhysicsWorld,
  bulletPhysics,
  falloffAt,
  flightTo,
  getWeapon,
  gunplayOf,
  initPhysics,
  lookAngles,
  penetrate,
  ricochets,
  traceBullet,
  weaponCode,
  viewDirection,
  type GameEvent,
  type MapDocument,
  type MapEntity,
  type MatchRules,
  type PlayerInput,
} from '../src/index.ts';
import { Match, MAX_REWIND_TICKS, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
const eye = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z });
const chest = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + 1.1, z: p.z });

/** A long, wide open deck (x 0..`len`×8 m, z ±`half`×8 m) for long shots. */
function range(len = 26, half = 3, extra: MapEntity[] = []): MapDocument {
  const tiles = [];
  for (let x = 0; x < len; x++) for (let y = -half; y <= half; y++) tiles.push({ id: `p_${x}_${y}`, tile: 'core.platform', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 0]]);
  return { ...map, entities: [...map.entities, ...extra] };
}

class Driver {
  seq = 0;
  constructor(readonly match: Match) {}
  input(c: Combatant, i: Partial<PlayerInput>): void {
    this.match.queueInputs(c.slot, [{ seq: ++this.seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
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

function give(c: Combatant, id: string): void {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
  c.raiseTicks = 0;
  c.fireCooldown = 0;
}

/** Shooter at the origin, targets placed by hand, everyone standing on the deck. */
function setup(targets: [number, number, number][], weapon: string, opts: { rules?: Partial<MatchRules>; extra?: MapEntity[] } = {}) {
  const match = new Match(range(26, 3, opts.extra), { ...rules, ...opts.rules });
  const d = new Driver(match);
  const a = match.addHuman('a')!;
  const others = targets.map((_, i) => match.addHuman(`t${i}`)!);
  a.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
  targets.forEach((t, i) => (others[i]!.move = { pos: { x: t[0], y: t[1], z: t[2] }, velY: 0, grounded: true }));
  give(a, weapon);
  return { match, d, a, others };
}

/** Where every round of these events finally landed: shot pellets resolved at once, then impacts. */
function landings(ev: GameEvent[]): { hit: number | null; zone: number; to: [number, number, number] }[] {
  const out: { hit: number | null; zone: number; to: [number, number, number] }[] = [];
  for (const e of ev) {
    if (e.e === 'shot') e.to.forEach((to, i) => !e.fl?.includes(i) && out.push({ hit: e.hit[i] ?? null, zone: e.z?.[i] ?? 0, to }));
    if (e.e === 'impact') out.push({ hit: e.hit, zone: e.z ?? 0, to: e.to });
  }
  return out;
}

describe('ballistic bullets', () => {
  it('give each family a velocity from the spec table, and leave beams and energy weapons hitscan', () => {
    expect(gunplayOf(getWeapon('core.pistol')).ballistic?.velocity).toBeGreaterThanOrEqual(325);
    expect(gunplayOf(getWeapon('core.pistol')).ballistic?.velocity).toBeLessThanOrEqual(450);
    expect(gunplayOf(getWeapon('core.revolver')).ballistic?.velocity).toBeLessThanOrEqual(350);
    expect(gunplayOf(getWeapon('core.smg')).ballistic?.velocity).toBeLessThanOrEqual(500);
    expect(gunplayOf(getWeapon('core.rifle')).ballistic?.velocity).toBeGreaterThanOrEqual(650);
    expect(gunplayOf(getWeapon('core.sniper')).ballistic?.velocity).toBeGreaterThanOrEqual(800);
    for (const id of ['core.railgun', 'core.laser_rifle', 'core.pulse_pistol', 'core.gilded_pistol', 'core.shotgun', 'core.knife', 'core.rockets']) expect(gunplayOf(getWeapon(id)).ballistic, id).toBeNull();
  });

  it('resolve near range instantly: the hit lands in the tick the trigger is pulled', () => {
    const { d, a, others } = setup([[6, 0, 0]], 'core.pistol');
    const b = others[0]!;
    const ev = d.run(1, () => {
      d.input(a, { ...lookAngles(eye(a.move.pos), chest(b.move.pos)), buttons: BUTTON_FIRE });
      d.input(b, {});
    });
    const shot = ev.find((e) => e.e === 'shot');
    expect(shot?.e === 'shot' && shot.hit[0]).toBe(b.slot);
    expect(shot?.e === 'shot' && shot.fl).toBeUndefined();
    expect(b.health).toBe(PLAYER.maxHealth - getWeapon('core.pistol').damage);
  });

  it('take time to reach far targets, and drop on the way (more for slower rounds)', () => {
    const rifle = gunplayOf(getWeapon('core.rifle')).ballistic!;
    const pistol = gunplayOf(getWeapon('core.pistol')).ballistic!;
    const precision = FAMILY_DEFAULTS.precision.ballistic!;
    // Negligible up close, meaningful far away (spec §5).
    expect(flightTo(rifle, 30).drop).toBeLessThan(0.01);
    expect(flightTo(pistol, 30).drop).toBeLessThan(0.05);
    expect(flightTo(pistol, 150).drop).toBeGreaterThan(0.6);
    expect(flightTo(pistol, 100).drop).toBeGreaterThan(flightTo(rifle, 100).drop * 3);
    expect(flightTo(precision, 200).drop).toBeLessThan(flightTo(rifle, 200).drop);
    // Arcade ballistics barely drop; advanced drop more (spec §5 creator control).
    expect(flightTo(rifle, 200, { ballistics: 'arcade' }).drop).toBeLessThan(flightTo(rifle, 200).drop * 0.2);
    expect(flightTo(rifle, 200, { ballistics: 'advanced' }).drop).toBeGreaterThan(flightTo(rifle, 200).drop * 2);

    // The simulated flight agrees: a level pistol shot down the deck lands on it, short of where a ray would go.
    const match = new Match(range(), rules);
    const physics = match.physics;
    const flat = traceBullet({ x: 0, y: 1.2, z: 0 }, viewDirection(Math.PI / 2, 0), bulletPhysics(pistol), 400, (o, dir, len) => physics.raycastWorld(o, dir, len));
    expect(flat.hit).toBe(true);
    // From 1.2 m up, with 9.81 m/s² and 375 m/s, it comes down roughly 8 + 375 · √(2 · 1.2 / 9.81) m away.
    const expected = NEAR_INSTANT_M + 375 * Math.sqrt((2 * 1.2) / 9.81);
    expect(flat.end.x).toBeGreaterThan(expected - 8);
    expect(flat.end.x).toBeLessThan(expected + 8);
    expect(flat.time).toBeGreaterThan(0.25);
    match.destroy();
  });

  it('a round aimed at a still target far off lands low; holding over for the drop lands it', () => {
    // Aim dead on the head at 150 m with the pistol: the drop takes it into the body.
    const { d, a, others } = setup([[150, 0, 0]], 'core.pistol');
    const b = others[0]!;
    const head = { x: b.move.pos.x, y: b.move.pos.y + 1.66, z: b.move.pos.z };
    const shoot = (pitchUp: number) => {
      const look = lookAngles(eye(a.move.pos), head);
      // Settle (recoil from the last shot gone), then one round.
      d.run(60, () => (d.input(a, { ...look, pitch: look.pitch + pitchUp }), d.input(b, {})));
      const fired = d.run(1, () => (d.input(a, { ...look, pitch: look.pitch + pitchUp, buttons: BUTTON_FIRE }), d.input(b, {})));
      return landings([...fired, ...d.run(40, () => (d.input(a, { ...look, pitch: look.pitch + pitchUp }), d.input(b, {})))]);
    };
    const level = shoot(0);
    expect(level).toHaveLength(1);
    const p = gunplayOf(getWeapon('core.pistol')).ballistic!;
    const drop = flightTo(p, 150).drop;
    // Aimed at the head, it landed lower by about the drop (the cone of a settled pistol is tiny).
    expect(level[0]!.to[1]).toBeLessThan(head.y - drop * 0.5);
    // Hold over by the drop: it lands at head height.
    const held = shoot(Math.atan2(drop, 150));
    expect(Math.abs(held[0]!.to[1] - head.y)).toBeLessThan(0.35);
  });

  it('a target running across at range must be led by the travel time, and leading by it hits', () => {
    const run = (leadBy: number) => {
      const { d, a, others } = setup([[90, 0, -12]], 'core.pistol');
      const b = others[0]!;
      let hits = 0;
      for (let k = 0; k < 6; k++) {
        // b sprints across (along +z, then back), at speed after a short run-up.
        const dir = k % 2 === 0 ? 1 : -1;
        d.run(36, () => (d.input(a, {}), d.input(b, { yaw: 0, forward: dir })));
        const z0 = b.move.pos.z;
        d.run(1, () => (d.input(a, {}), d.input(b, { yaw: 0, forward: dir })));
        const speed = (b.move.pos.z - z0) * 60;
        const t = flightTo(gunplayOf(getWeapon('core.pistol')).ballistic!, 90).time;
        const at = { ...chest(b.move.pos), z: b.move.pos.z + speed * t * leadBy };
        const ev = d.run(1, () => (d.input(a, { ...lookAngles(eye(a.move.pos), at), buttons: BUTTON_FIRE }), d.input(b, { yaw: 0, forward: dir })));
        ev.push(...d.run(30, () => (d.input(a, {}), d.input(b, { yaw: 0, forward: dir }))));
        hits += landings(ev).filter((l) => l.hit === b.slot).length;
        b.health = 100;
      }
      return hits;
    };
    expect(run(0)).toBeLessThanOrEqual(1);
    expect(run(1)).toBeGreaterThanOrEqual(5);
  });

  it('lag compensation rewinds only the first part of the flight: lead for travel, never for latency', () => {
    // b runs across at 40 m. a saw b `lag` ticks ago and aims where that b would be after the round's flight.
    const trial = (useViewTick: boolean) => {
      const { match, d, a, others } = setup([[40, 0, -6]], 'core.rifle');
      const b = others[0]!;
      d.run(30, () => (d.input(a, {}), d.input(b, { yaw: 0, forward: 1 })));
      const lag = 12;
      const seenTick = match.tick;
      const seen = { ...b.move.pos };
      const z0 = seen.z;
      d.run(1, () => (d.input(a, {}), d.input(b, { yaw: 0, forward: 1 })));
      const speed = (b.move.pos.z - z0) * 60;
      d.run(lag - 1, () => (d.input(a, {}), d.input(b, { yaw: 0, forward: 1 })));
      expect(match.tick - seenTick).toBeLessThanOrEqual(MAX_REWIND_TICKS);
      const t = flightTo(gunplayOf(getWeapon('core.rifle')).ballistic!, 40).time;
      const at = { ...chest(seen), z: seen.z + speed * t };
      const ev = d.run(1, () => (d.input(a, { ...lookAngles(eye(a.move.pos), at), buttons: BUTTON_FIRE, ...(useViewTick ? { viewTick: seenTick } : {}) }), d.input(b, { yaw: 0, forward: 1 })));
      ev.push(...d.run(10, () => (d.input(a, {}), d.input(b, { yaw: 0, forward: 1 }))));
      return landings(ev).some((l) => l.hit === b.slot);
    };
    expect(trial(true)).toBe(true);
    expect(trial(false)).toBe(false);
  });
});

describe('damage over distance and lethality', () => {
  it('falls off differently per family: SMG fast, rifle gradual, precision barely', () => {
    const smg = gunplayOf(getWeapon('core.smg')).falloff;
    const rifle = gunplayOf(getWeapon('core.rifle')).falloff;
    const sniper = gunplayOf(getWeapon('core.sniper')).falloff;
    expect(falloffAt(smg, 5)).toBe(1);
    expect(falloffAt(smg, 40)).toBeCloseTo(smg!.min, 5);
    expect(falloffAt(smg, 25)).toBeLessThan(falloffAt(rifle, 25));
    expect(falloffAt(rifle, 60)).toBeGreaterThan(falloffAt(smg, 60));
    expect(falloffAt(sniper, 120)).toBe(1);
    // Monotonic.
    let last = 1;
    for (let dist = 0; dist < 120; dist += 5) {
      const f = falloffAt(rifle, dist);
      expect(f).toBeLessThanOrEqual(last);
      last = f;
    }
    // Shotgun heads count for less (pellets shouldn't roll instant kills); explosives have no headshots.
    expect(gunplayOf(getWeapon('core.shotgun')).head).toBeLessThan(gunplayOf(getWeapon('core.rifle')).head);
  });

  it('a pistol round at 30 m does less than at 5 m, by its falloff', () => {
    const near = setup([[5, 0, 0]], 'core.pistol');
    near.d.run(1, () => near.d.input(near.a, { ...lookAngles(eye(near.a.move.pos), chest(near.others[0]!.move.pos)), buttons: BUTTON_FIRE }));
    near.d.run(5);
    const far = setup([[30, 0, 0]], 'core.pistol');
    far.d.run(1, () => far.d.input(far.a, { ...lookAngles(eye(far.a.move.pos), chest(far.others[0]!.move.pos)), buttons: BUTTON_FIRE }));
    far.d.run(5);
    const dmg = getWeapon('core.pistol').damage;
    expect(100 - near.others[0]!.health).toBe(dmg);
    const f = falloffAt(gunplayOf(getWeapon('core.pistol')).falloff, 30);
    expect(100 - far.others[0]!.health).toBeCloseTo(dmg * f, 0);
  });

  it('lethality scales every hit systemically (arcade soaks more, tactical less)', () => {
    const hit = (lethality?: MatchRules['lethality']) => {
      const { d, a, others } = setup([[5, 0, 0]], 'core.pistol', { rules: lethality ? { lethality } : {} });
      d.run(1, () => d.input(a, { ...lookAngles(eye(a.move.pos), chest(others[0]!.move.pos)), buttons: BUTTON_FIRE }));
      return 100 - others[0]!.health;
    };
    const dmg = getWeapon('core.pistol').damage;
    expect(hit()).toBeCloseTo(dmg, 5);
    expect(hit('arcade')).toBeCloseTo(dmg / LETHALITY_HEALTH.arcade, 5);
    expect(hit('tactical')).toBeCloseTo(dmg / LETHALITY_HEALTH.tactical, 5);
    expect(LETHALITY_HEALTH.arcade).toBeGreaterThanOrEqual(1.25);
    expect(LETHALITY_HEALTH.tactical).toBeLessThanOrEqual(0.8);
  });
});

describe('materials', () => {
  it('penetration is energy-based: thin cover lets strong rounds through, weakened; concrete stops them', () => {
    const rifle = gunplayOf(getWeapon('core.rifle')).ballistic!.energy;
    const pistol = gunplayOf(getWeapon('core.pistol')).ballistic!.energy;
    expect(penetrate(pistol, 'glass', 0.05)).toBeGreaterThan(pistol * 0.9);
    expect(penetrate(pistol, 'drywall', 0.1)).not.toBeNull();
    expect(penetrate(rifle, 'wood', 0.3)).toBeLessThan(rifle);
    expect(penetrate(pistol, 'thin_metal', 0.1)).toBeNull();
    expect(penetrate(rifle, 'concrete', 0.3)).toBeNull();
    expect(penetrate(rifle, 'brick', 0.25)).toBeNull();
    // Heavier rounds go through more.
    expect(penetrate(gunplayOf(getWeapon('core.revolver')).ballistic!.energy, 'wood', 0.6)).not.toBeNull();
    expect(penetrate(pistol, 'wood', 0.6)).toBeNull();
  });

  it('a rifle round goes through a thin wooden board and hurts the player behind, less; a concrete slab stops it', () => {
    const wall = (material: string, thick: number): MapEntity => ({ id: 'wall', kind: 'block', position: [6, 0, 0], size: [thick, 3, 4], yaw: 0, material, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 });
    const through = (material: string, thick: number) => {
      const { d, a, others } = setup([[10, 0, 0]], 'core.rifle', { extra: [wall(material, thick)] });
      const ev = d.run(1, () => d.input(a, { ...lookAngles(eye(a.move.pos), chest(others[0]!.move.pos)), buttons: BUTTON_FIRE }));
      ev.push(...d.run(4));
      return { dmg: 100 - others[0]!.health, ev };
    };
    const planks = through('core.oak_planks', 0.1);
    expect(planks.dmg).toBeGreaterThan(0);
    expect(planks.dmg).toBeLessThan(getWeapon('core.rifle').damage);
    // The board shows where the round went through.
    expect(planks.ev.some((e) => (e.e === 'shot' || e.e === 'impact') && !!e.pn?.length)).toBe(true);
    expect(through('core.concrete', 0.5).dmg).toBe(0);
  });

  it('ricochets are rare and bounded: grazing hits on hard surfaces only', () => {
    expect(ricochets('metal', 0.05, 0)).toBe(true);
    expect(ricochets('metal', 0.05, 0.99)).toBe(false);
    expect(ricochets('metal', 0.6, 0)).toBe(false);
    expect(ricochets('wood', 0.02, 0)).toBe(false);
    expect(ricochets('glass', 0.02, 0)).toBe(false);
  });

  it('classifies what things are made of', async () => {
    const { entityMaterial, surfaceMaterial } = await import('../src/index.ts');
    expect(surfaceMaterial('core.oak_planks')).toBe('thin_wood');
    expect(surfaceMaterial('core.concrete')).toBe('concrete');
    expect(surfaceMaterial('core.red_brick')).toBe('brick');
    expect(surfaceMaterial('core.steel_plate')).toBe('metal');
    expect(surfaceMaterial('core.pbr_glass_facade')).toBe('glass');
    expect(surfaceMaterial(null)).toBe('concrete');
    expect(entityMaterial({ id: 'g', kind: 'destructible', model: 'glass', position: [0, 0, 0], yaw: 0, health: null, explosiveOnly: false } as MapEntity)).toBe('glass');
    expect(PhysicsWorld).toBeDefined();
  });
});
