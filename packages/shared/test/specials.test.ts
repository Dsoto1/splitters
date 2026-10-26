import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_FIRE, BUTTON_THROW, DEFAULT_DEATHMATCH_RULES, getItem, getWeapon, initPhysics, weaponCode, type GameEvent, type ThrowableKind } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
/** A 40 × 16 m walled yard. */
const yard = () => {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4]]);
};
type Proj = { spec: { visual: string }; pos: { x: number; y: number; z: number }; walking?: boolean };
const projectiles = (m: Match) => (m as unknown as { projectiles: Proj[] }).projectiles;

function setup(kind?: ThrowableKind) {
  const match = new Match(yard(), rules);
  const me = match.addHuman('me')!;
  for (let i = 0; i < 3; i++) match.step();
  me.move = { pos: { x: 0, y: 0, z: 4 }, velY: 0, grounded: true };
  if (kind) me.throwable = { kind, count: 1 };
  let seq = 0;
  const input = (c: Combatant, yaw: number, pitch: number, buttons = 0) => match.queueInputs(c.slot, [{ seq: ++seq, forward: 0, right: 0, yaw, pitch, buttons }]);
  return { match, me, input };
}

describe('Worms-style specials and the guided rocket', () => {
  it('a cluster bomb bursts into bomblets', () => {
    const { match, me, input } = setup('cluster');
    input(me, Math.PI / 2, 0.3, BUTTON_THROW);
    let most = 0;
    for (let t = 0; t < 200; t++) {
      match.step();
      most = Math.max(most, projectiles(match).filter((p) => p.spec.visual === 'bomblet').length);
    }
    expect(most).toBe(6);
  });

  it('an airstrike flare calls in a line of bombs from above', () => {
    const { match, me, input } = setup('airstrike');
    input(me, Math.PI / 2, 0.2, BUTTON_THROW);
    const events: GameEvent[] = [];
    let bombs = 0;
    for (let t = 0; t < 400; t++) {
      events.push(...match.step());
      bombs = Math.max(bombs, projectiles(match).filter((p) => p.spec.visual === 'bomb').length);
    }
    expect(bombs).toBe(5);
    expect(events.filter((e) => e.e === 'explode').length).toBeGreaterThanOrEqual(5);
  });

  it('a sheep lands, walks off along the ground, then goes off', () => {
    const { match, me, input } = setup('sheep');
    input(me, Math.PI / 2, 0.2, BUTTON_THROW);
    let walked = 0;
    let startX: number | null = null;
    const events: GameEvent[] = [];
    for (let t = 0; t < 600; t++) {
      events.push(...match.step());
      const s = projectiles(match).find((p) => p.spec.visual === 'sheep');
      if (s?.walking) {
        startX ??= s.pos.x;
        walked = Math.max(walked, s.pos.x - startX);
      }
    }
    expect(walked).toBeGreaterThan(3);
    expect(events.some((e) => e.e === 'explode')).toBe(true);
  });

  it('a guided rocket follows the crosshair', () => {
    const { match, me, input } = setup();
    const def = getWeapon('core.guided');
    me.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
    me.current = weaponCode(def);
    me.raiseTicks = 0;
    // Fire east down the yard, then aim across it (north): the rocket turns to follow.
    input(me, Math.PI / 2, 0, BUTTON_FIRE);
    match.step();
    let seen = false;
    let north = 0;
    for (let t = 0; t < 40; t++) {
      input(me, 0.25, 0);
      match.step();
      const r = projectiles(match).find((p) => p.spec.visual === 'rocket');
      if (r) {
        seen = true;
        north = Math.max(north, r.pos.z);
      }
    }
    expect(seen).toBe(true);
    expect(north).toBeGreaterThan(5); // swung north of the line it was fired along (z = 4)
  });
});

describe('deployable cover', () => {
  it('sandbags land as a wall that stops bullets until shot apart', () => {
    const { match, me, input } = setup('sandbag');
    input(me, Math.PI / 2, 0, BUTTON_THROW);
    let snap = match.snapshot([]);
    for (let t = 0; t < 120; t++) {
      match.step();
      snap = match.snapshot([]);
      if (snap.cv?.length) break;
    }
    expect(snap.cv?.length).toBe(1);
    const [, x, y] = snap.cv![0]!;
    expect(x).toBeGreaterThan(1);
    expect(y).toBeCloseTo(0, 1);
    // A crouched enemy behind it can't be shot through it.
    const foe = match.addHuman('foe')!;
    for (let i = 0; i < 3; i++) match.step();
    foe.move = { pos: { x: x + 1.5, y: 0, z: 4 }, velY: 0, grounded: true };
    const rifle = getWeapon('core.rifle')!;
    me.weapons.set(weaponCode(rifle), { def: rifle, mag: 999, reserve: 999, alt: 0 });
    me.current = weaponCode(rifle);
    me.health = me.maxHealth = 10_000;
    const pitch = Math.atan2(0.5 - (me.move.pos.y + 1.6), x - me.move.pos.x);
    const before = foe.health;
    // Aim low at the bags, then fire short bursts until they break (a long spray climbs off them).
    let broke = -1;
    for (let t = 0; t < 600 && broke < 0; t++) {
      input(me, Math.PI / 2, pitch, t % 30 < 6 ? BUTTON_FIRE : 0);
      foe.move = { pos: { x: x + 1.5, y: 0, z: 4 }, velY: 0, grounded: true };
      match.step();
      if (t === 20) expect(foe.health).toBe(before);
      if (!match.snapshot([]).cv) broke = t;
    }
    expect(broke).toBeGreaterThan(20);
  });
});

describe('grapple hook', () => {
  it('yanks you toward the spot you hooked', () => {
    const { match, me, input } = setup();
    const hook = getWeapon('core.grapple')!;
    me.weapons.set(weaponCode(hook), { def: hook, mag: 0, reserve: 0, alt: 0 });
    me.current = weaponCode(hook);
    for (let t = 0; t < 20; t++) {
      input(me, Math.PI / 2, 0, 0);
      match.step();
    }
    const start = { ...me.move.pos };
    input(me, Math.PI / 2, -0.15, BUTTON_FIRE);
    let top = 0;
    for (let t = 0; t < 40; t++) {
      if (t) input(me, Math.PI / 2, -0.15, 0);
      const ev = match.step();
      if (process.env.DBG) for (const e of ev) console.log(JSON.stringify(e));
      top = Math.max(top, me.move.pos.y);
    }
    expect(me.move.pos.x - start.x).toBeGreaterThan(5);
    expect(top).toBeGreaterThan(0.3);
  });
});

describe('UAV', () => {
  it('runs a sweep for your side that times out', () => {
    const { match, me } = setup();
    const applied = (match as unknown as { applyItem: (c: Combatant, i: unknown) => boolean }).applyItem(me, getItem('core.uav'));
    expect(applied).toBe(true);
    match.step();
    expect(match.privateState(me.slot)?.uv).toBe(20);
    for (let t = 0; t < 21 * 60; t++) match.step();
    expect(match.privateState(me.slot)?.uv).toBeUndefined();
  });
});

describe('spears only', () => {
  it('everyone holds one spear; it kills in one hit, drops, and can be picked back up', () => {
    const match = new Match(yard(), { ...rules, weapons: 'spears', startingGrenades: 1 });
    const me = match.addHuman('me')!;
    const foe = match.addHuman('foe')!;
    for (let i = 0; i < 3; i++) match.step();
    const spear = weaponCode(getWeapon('core.spear'));
    expect([...me.weapons.keys()]).toEqual([spear]);
    expect(me.throwable).toBeNull();
    me.move = { pos: { x: 4, y: 0, z: 8 }, velY: 0, grounded: true };
    foe.move = { pos: { x: 12, y: 0, z: 8 }, velY: 0, grounded: true };
    let seq = 0;
    const input = (c: Combatant, buttons: number) => match.queueInputs(c.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: Math.PI / 2, pitch: 0.06, buttons }]);
    for (let t = 0; t < 20; t++) {
      input(me, 0);
      match.step();
    }
    input(me, BUTTON_FIRE);
    match.step();
    for (let t = 0; t < 60; t++) {
      foe.move = { pos: { x: 12, y: 0, z: 8 }, velY: 0, grounded: true };
      match.step();
    }
    expect(foe.alive).toBe(false);
    expect(me.weapons.get(spear)!.mag).toBe(0);
    const lying = projectiles(match).find((p) => p.spec.visual === 'spear');
    expect(lying).toBeTruthy();
    // Walk over it: the spear is back in hand.
    me.move = { pos: { x: lying!.pos.x, y: 0, z: lying!.pos.z }, velY: 0, grounded: true };
    match.step();
    expect(me.weapons.get(spear)!.mag).toBe(1);
    expect(projectiles(match).some((p) => p.spec.visual === 'spear')).toBe(false);
  });
});
