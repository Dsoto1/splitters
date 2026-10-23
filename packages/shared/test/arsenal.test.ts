import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_ALT,
  BUTTON_FIRE,
  BUTTON_THROW,
  DEFAULT_DEATHMATCH_RULES,
  PLAYER,
  getWeapon,
  initPhysics,
  weaponCode,
  lookAngles,
  type GameEvent,
  type MapDocument,
  type MapEntity,
  type PlayerInput,
} from '../src/index.ts';
import { Match, heldWeapon, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
const eye = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z });

function room(spawns: [number, number, number][], extra: MapEntity[] = []): MapDocument {
  const map = makeMap([{ id: 'room', tile: 'core.room_large', x: 0, y: 0, z: 0, rotation: 0 }], spawns);
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

function give(c: Combatant, id: string, alt = 0): void {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt });
  c.current = weaponCode(def);
  c.raiseTicks = 0;
  c.fireCooldown = 0;
}

describe('arsenal', () => {
  it('has nine weapons with typed ammo, and three of them have a second trigger', () => {
    for (const id of ['core.pistol', 'core.rifle', 'core.smg', 'core.shotgun', 'core.sniper', 'core.launcher', 'core.rockets', 'core.plasma']) expect(getWeapon(id).ammo, id).toBeDefined();
    expect(['core.rifle', 'core.shotgun', 'core.plasma'].every((id) => getWeapon(id).alt)).toBe(true);
  });

  it("fires the rifle's underbarrel grenade from its own ammo, and both shotgun barrels from the magazine", () => {
    const match = new Match(room([[0, 0, 0], [6, 0, 0]]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    give(a, 'core.rifle', 2);
    const rifle = heldWeapon(a);
    const ev = d.run(3, () => d.input(a, { buttons: BUTTON_ALT }));
    expect(rifle.alt).toBe(1);
    expect(rifle.mag).toBe(rifle.def.magazine);
    expect(ev.some((e) => e.e === 'shot' && e.alt === 1)).toBe(true);
    d.run(200);
    give(a, 'core.shotgun');
    const shotgun = heldWeapon(a);
    const shots = d.run(2, () => d.input(a, { buttons: BUTTON_ALT })).filter((e) => e.e === 'shot');
    expect(shots).toHaveLength(1);
    expect(shots[0]!.e === 'shot' && shots[0]!.to.length).toBe(16);
    expect(shotgun.mag).toBe(shotgun.def.magazine - 2);
  });

  it('throws a frag that bounces and goes off after its fuse, and spawns everyone with one', () => {
    const match = new Match(room([[0, 0, 0], [6, 0, 6]]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    expect(a.throwable).toEqual({ kind: 'frag', count: 1 });
    // Throw at the floor: it must bounce rather than burst on impact.
    const ev = d.run(20, () => d.input(a, { buttons: BUTTON_THROW, pitch: -0.9 }));
    expect(ev.some((e) => e.e === 'throw')).toBe(true);
    expect(a.throwable).toBeNull();
    expect(ev.some((e) => e.e === 'explode')).toBe(false);
    const later = d.run(150);
    expect(later.filter((e) => e.e === 'explode')).toHaveLength(1);
  });

  it('sticks a proximity mine where it lands and sets it off when an enemy walks up', () => {
    const match = new Match(room([[0, 0, 0], [10, 0, 0]]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    a.throwable = { kind: 'mine', count: 1 };
    a.move.pos = { x: 0, y: 0, z: 0 };
    b.move.pos = { x: 10, y: 0, z: 0 };
    const look = lookAngles(eye(a.move.pos), { x: 4, y: 0, z: 0 });
    d.run(2, () => d.input(a, { buttons: BUTTON_THROW, ...look }));
    // Lands, sticks and arms; nobody near, so nothing happens.
    expect(d.run(180, () => d.input(b, {})).some((e) => e.e === 'explode')).toBe(false);
    // b walks west over it.
    const boom = d.run(200, () => d.input(b, { forward: 1, yaw: -Math.PI / 2 }));
    expect(boom.some((e) => e.e === 'explode')).toBe(true);
    expect(b.health).toBeLessThan(PLAYER.maxHealth);
  });

  it('typed ammo fills only weapons of that type', () => {
    const pickups: MapEntity[] = [{ id: 'ammo_1', kind: 'pickup', position: [0, 0, 0], item: 'core.ammo_shells', respawnSeconds: null }];
    const match = new Match(room([[0, 0, 0]], pickups), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    give(a, 'core.shotgun');
    const shotgun = heldWeapon(a);
    shotgun.reserve = 0;
    const pistol = a.weapons.get(getWeapon('core.pistol').slot)!;
    pistol.reserve = 0;
    d.run(3, () => d.input(a, {}));
    expect(shotgun.reserve).toBe(shotgun.def.pickupAmmo);
    expect(pistol.reserve).toBe(0);
  });

  it('breaks props and window panes, and powder kegs blow up', () => {
    const extra: MapEntity[] = [
      { id: 'crate', kind: 'prop', model: 'prop.crate_large', position: [4, 0, 0], yaw: 0, scale: 1, solid: true, tint: null },
      { id: 'keg', kind: 'prop', model: 'prop.powder_keg', position: [0, 0, 6], yaw: 0, scale: 1, solid: true, tint: null },
      { id: 'pane', kind: 'destructible', model: 'glass', position: [-2, 0, 0], yaw: Math.PI / 2, health: null, explosiveOnly: false },
    ];
    const match = new Match(room([[0, 0, 0]], extra), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    a.move.pos = { x: 0, y: 0, z: 0 };
    give(a, 'core.rifle');
    const shootAt = (p: { x: number; y: number; z: number }, ticks: number) => {
      const look = lookAngles(eye(a.move.pos), p);
      return d.run(ticks, () => d.input(a, { buttons: BUTTON_FIRE, ...look }));
    };
    expect(match.scenario.destructibleAlive('crate')).toBe(true);
    shootAt({ x: 4, y: 0.6, z: 0 }, 60);
    expect(match.scenario.destructibleAlive('crate')).toBe(false);
    shootAt({ x: -2, y: 1.7, z: 0 }, 10);
    expect(match.scenario.destructibleAlive('pane')).toBe(false);
    const ev = shootAt({ x: 0, y: 0.5, z: 6 }, 40);
    expect(match.scenario.destructibleAlive('keg')).toBe(false);
    expect(ev.some((e) => e.e === 'explode')).toBe(true);
  });
});
