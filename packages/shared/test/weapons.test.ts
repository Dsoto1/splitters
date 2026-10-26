import { beforeAll, describe, expect, it } from 'vitest';
import {
  ARMOR_ABSORB,
  BOT_DIFFICULTIES,
  BUTTON_FIRE,
  BUTTON_RELOAD,
  CORE_BOT_PROFILES,
  DEFAULT_DEATHMATCH_RULES,
  PLAYER,
  TICK_RATE,
  getWeapon,
  initPhysics,
  lookAngles,
  type GameEvent,
  type MapDocument,
  type PlayerInput,
} from '../src/index.ts';
import { Match, MAX_REWIND_TICKS, heldWeapon, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const eye = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z });
const chest = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + 1.0, z: p.z });
const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };

function room(spawns: [number, number, number][], pickups: { item: string; at: [number, number, number] }[] = []): MapDocument {
  const map = makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], spawns);
  return { ...map, entities: [...map.entities, ...pickups.map((p, i) => ({ id: `pickup_${i}`, kind: 'pickup' as const, position: p.at, item: p.item, respawnSeconds: null }))] };
}

class Driver {
  seq = 0;
  events: GameEvent[] = [];
  constructor(readonly match: Match) {}
  input(c: Combatant, i: Partial<PlayerInput>): void {
    this.match.queueInputs(c.slot, [{ seq: ++this.seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
  }
  /** Run ticks; `each` queues inputs for humans every tick. */
  run(n: number, each: () => void = () => {}): GameEvent[] {
    const out: GameEvent[] = [];
    for (let i = 0; i < n; i++) {
      each();
      out.push(...this.match.step());
    }
    this.events.push(...out);
    return out;
  }
  idle(...cs: Combatant[]): () => void {
    return () => cs.forEach((c) => this.input(c, {}));
  }
  aimAt(c: Combatant, target: Combatant): { yaw: number; pitch: number } {
    return lookAngles(eye(c.move.pos), chest(target.move.pos));
  }
}

describe('weapons', () => {
  it('spawns with knife and pistol, switches only to owned weapons, and waits for the raise', () => {
    const match = new Match(room([[0, 0, 0]]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    expect([...a.weapons.keys()].sort()).toEqual([1, 2]);
    expect(a.current).toBe(getWeapon('core.pistol').slot);
    d.run(5, () => d.input(a, { weapon: 6 })); // launcher not owned
    expect(a.current).toBe(2);
    d.run(1, () => d.input(a, { weapon: 1 }));
    expect(a.current).toBe(1);
    expect(a.raiseTicks).toBe(getWeapon('core.knife').raiseTicks - 1);
  });

  it('empties the magazine, reloads from reserve on fire or R, and stops when ammo runs out', () => {
    const match = new Match(room([[0, 0, 0]]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    const pistol = heldWeapon(a);
    const startReserve = pistol.reserve;
    let shots = 0;
    // The pistol is semi-automatic: tap the trigger (press, release) rather than hold it.
    let pull = 0;
    d.run(12 * (pistol.def.fireIntervalTicks + 1) + 5, () => d.input(a, { buttons: pull++ % 2 ? 0 : BUTTON_FIRE }));
    shots = d.events.filter((e) => e.e === 'shot').length;
    expect(shots).toBe(pistol.def.magazine);
    // The next pull starts a reload; after reloadTicks the magazine is refilled from reserve.
    d.run(pistol.def.reloadTicks + 2, d.idle(a));
    expect(pistol.mag).toBe(pistol.def.magazine);
    expect(pistol.reserve).toBe(startReserve - pistol.def.magazine);
    // Manual reload with R tops up a partly used magazine.
    d.run(pistol.def.fireIntervalTicks * 3, () => d.input(a, { buttons: BUTTON_FIRE }));
    d.run(1, () => d.input(a, { buttons: BUTTON_RELOAD }));
    d.run(pistol.def.reloadTicks + 1, d.idle(a));
    expect(pistol.mag).toBe(pistol.def.magazine);
  });

  it('fires one event per trigger pull with a hit entry per shotgun pellet', () => {
    const match = new Match(room([[-2, 0, -2], [2, 0, 2]], [{ item: 'core.weapon_shotgun', at: [-2, 0, -2] }]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    d.run(10, d.idle(a, b));
    expect(a.current).toBe(getWeapon('core.shotgun').slot); // picked up and auto-switched
    d.run(getWeapon('core.shotgun').raiseTicks + 2, () => {
      d.input(a, { ...d.aimAt(a, b), buttons: BUTTON_FIRE });
      d.input(b, {});
    });
    const shot = d.events.find((e) => e.e === 'shot' && e.w === 'core.shotgun');
    expect(shot && shot.e === 'shot' && shot.to.length).toBe(8);
    expect(shot && shot.e === 'shot' && shot.hit.filter((h) => h === b.slot).length).toBeGreaterThan(4);
  });

  it('knife hits only at close range', () => {
    const match = new Match(room([[0, 0, 0], [0, 0, 1.6]]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    d.run(5, () => {
      d.input(a, { weapon: 1 });
      d.input(b, {});
    });
    // Long enough for the raise and one stab, shorter than the 30-tick swing interval.
    d.run(25, () => {
      d.input(a, { ...d.aimAt(a, b), buttons: BUTTON_FIRE });
      d.input(b, {});
    });
    expect(b.health).toBe(PLAYER.maxHealth - getWeapon('core.knife').damage);
  });
});

describe('grenade launcher', () => {
  function setup(target: [number, number, number]) {
    const match = new Match(room([[-3, 0, -3], target], [{ item: 'core.weapon_launcher', at: [-3, 0, -3] }]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    d.run(5 + getWeapon('core.launcher').raiseTicks, d.idle(a, b));
    expect(a.current).toBe(6);
    return { match, d, a, b };
  }

  it('lobs a grenade that splash-damages and can kill', () => {
    const { d, a, b } = setup([2, 0, 2]);
    // Aim at the floor right next to the target.
    const aim = lookAngles(eye(a.move.pos), { x: b.move.pos.x - 0.6, y: 0, z: b.move.pos.z - 0.6 });
    d.run(1, () => {
      d.input(a, { ...aim, buttons: BUTTON_FIRE });
      d.input(b, {});
    });
    const ev = d.run(TICK_RATE * 2, d.idle(a, b));
    const boom = ev.find((e) => e.e === 'explode');
    expect(boom).toBeDefined();
    expect(b.health).toBeLessThan(PLAYER.maxHealth - 40);
  });

  it('hurts the shooter less than others, and never through walls', () => {
    const { d, a } = setup([3, 0, 3]);
    // Fire straight down at our own feet.
    d.run(1, () => d.input(a, { yaw: 0, pitch: -1.5, buttons: BUTTON_FIRE }));
    d.run(30, d.idle(a));
    const spec = getWeapon('core.launcher').projectile!;
    expect(a.health).toBeLessThan(PLAYER.maxHealth);
    expect(PLAYER.maxHealth - a.health).toBeLessThanOrEqual(spec.splashDamage * spec.selfDamageScale + 0.01);

    const map = makeMap(
      [
        { id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 },
        { id: 'room_b', tile: 'core.room', x: 1, y: 0, z: 0, rotation: 0 },
      ],
      [[2.5, 0, 2.5], [5.0, 0, 2.5]],
    );
    const match2 = new Match({ ...map, entities: [...map.entities, { id: 'pk_gl', kind: 'pickup', position: [2.5, 0, 2.5], item: 'core.weapon_launcher', respawnSeconds: null }] }, rules);
    const d2 = new Driver(match2);
    const s = match2.addHuman('s')!;
    const t = match2.addHuman('t')!;
    d2.run(40, d2.idle(s, t));
    // Grenade into the wall between them (wall section at x 3.5..4.5, z 1.5..4): t is within radius but behind the wall.
    d2.run(1, () => {
      d2.input(s, { ...lookAngles(eye(s.move.pos), { x: 3.5, y: 1, z: 2.5 }), buttons: BUTTON_FIRE });
      d2.input(t, {});
    });
    const ev = d2.run(60, d2.idle(s, t));
    expect(ev.some((e) => e.e === 'explode')).toBe(true);
    expect(t.health).toBe(PLAYER.maxHealth);
  });
});

describe('pickups, armor and powerups', () => {
  it('heals only when hurt, respawns after its timer, and armor absorbs two thirds', () => {
    const match = new Match(room([[0, 0, 0], [2, 0, 2]], [{ item: 'core.health_small', at: [0, 0, 0] }, { item: 'core.armor_large', at: [2, 0, 2] }]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    d.run(5, d.idle(a, b));
    // a is at full health: the health pack stays.
    expect(match.snapshot([]).pk).toEqual(['pickup_1']); // b took the armor
    expect(b.armor).toBe(75);
    a.health = 50;
    const ev = d.run(2, d.idle(a, b));
    expect(a.health).toBe(75);
    expect(ev).toContainEqual({ e: 'pickup', s: a.slot, id: 'pickup_0', item: 'core.health_small' });
    expect(match.snapshot([]).pk).toContain('pickup_0');
    a.health = 10;
    d.run(15 * TICK_RATE - 10, d.idle(a, b));
    expect(a.health).toBe(10);
    d.run(20, d.idle(a, b));
    expect(a.health).toBe(35);

    // Pistol hit on armored b: 2/3 goes to armor.
    const dmg = getWeapon('core.pistol').damage;
    d.run(1, () => {
      d.input(a, { ...d.aimAt(a, b), buttons: BUTTON_FIRE });
      d.input(b, {});
    });
    expect(b.armor).toBeCloseTo(75 - dmg * ARMOR_ABSORB, 5);
    expect(b.health).toBeCloseTo(PLAYER.maxHealth - dmg * (1 - ARMOR_ABSORB), 5);
  });

  it('double damage doubles hits; speed boost makes you faster', () => {
    const match = new Match(room([[-2, 0, -2], [2, 0, 2]], [{ item: 'core.powerup_damage', at: [-2, 0, -2] }]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    d.run(5, d.idle(a, b));
    expect(a.damageTicks).toBeGreaterThan(0);
    d.run(1, () => {
      d.input(a, { ...d.aimAt(a, b), buttons: BUTTON_FIRE });
      d.input(b, {});
    });
    expect(b.health).toBe(PLAYER.maxHealth - getWeapon('core.pistol').damage * 2);
    expect(match.playerSnapshots().find((p) => p.s === a.slot)!.pu).toBe(2);

    const m2 = new Match(room([[-3, 0, -3]], [{ item: 'core.powerup_speed', at: [-3, 0, -3] }]), rules);
    const d2 = new Driver(m2);
    const r = m2.addHuman('r')!;
    d2.run(5, d2.idle(r));
    const z0 = r.move.pos.z;
    d2.run(20, () => d2.input(r, { forward: 1, yaw: 0 }));
    expect(r.move.pos.z - z0).toBeGreaterThan(PLAYER.runSpeed * (20 / TICK_RATE) * 1.2);
  });
});

describe('lag compensation', () => {
  /** b sidesteps north while a fires at where b *was* 12 ticks ago. */
  function scenario(useViewTick: boolean): number {
    const match = new Match(room([[-3, 0, -3], [3, 0, -3]]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    d.run(10, d.idle(a, b));
    const seenTick = match.tick;
    const aimThen = d.aimAt(a, b);
    d.run(12, () => {
      d.input(a, { ...aimThen });
      d.input(b, { forward: 1, yaw: 0 });
    });
    expect(match.tick - seenTick).toBeLessThanOrEqual(MAX_REWIND_TICKS);
    d.run(1, () => {
      d.input(a, { ...aimThen, buttons: BUTTON_FIRE, ...(useViewTick ? { viewTick: seenTick } : {}) });
      d.input(b, {});
    });
    return b.health;
  }

  it('resolves a human shot against where the target was at the viewed tick', () => {
    expect(scenario(false)).toBe(PLAYER.maxHealth);
    expect(scenario(true)).toBe(PLAYER.maxHealth - getWeapon('core.pistol').damage);
  });
});

describe('bots and items', () => {
  it('walk to a weapon they lack and switch to it', () => {
    const map = makeMap(
      [
        { id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 },
        { id: 'room_b', tile: 'core.room', x: 1, y: 0, z: 0, rotation: 0 },
      ],
      [[0, 0, 0]],
    );
    const match = new Match({ ...map, entities: [...map.entities, { id: 'pk_sg', kind: 'pickup', position: [8, 0, 0], item: 'core.weapon_shotgun', respawnSeconds: null }] }, rules, 3);
    const bot = match.addBot('greedy', { ...CORE_BOT_PROFILES[3]!, itemGreed: 90 }, BOT_DIFFICULTIES.normal)!;
    for (let i = 0; i < TICK_RATE * 8 && !bot.weapons.has(4); i++) match.step();
    expect(bot.weapons.has(4)).toBe(true);
  });

  it('pick weapons by range: shotgun up close, not the launcher at point blank', () => {
    const match = new Match(room([[-1, 0, 0], [1, 0, 0]]), rules, 4);
    const bot = match.addBot('b', CORE_BOT_PROFILES[1]!, BOT_DIFFICULTIES.hard)!;
    const target = match.addHuman('t')!;
    for (const id of ['core.shotgun', 'core.launcher', 'core.sniper']) {
      const def = getWeapon(id);
      bot.weapons.set(def.slot, { def, mag: def.magazine, reserve: def.pickupAmmo, alt: 0 });
    }
    let seq = 0;
    for (let i = 0; i < 60; i++) {
      match.queueInputs(target.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 }]);
      match.step();
    }
    expect(bot.current).toBe(getWeapon('core.shotgun').slot);
  });
});
