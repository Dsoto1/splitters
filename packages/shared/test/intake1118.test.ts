// The weapons intake of 2026-11-18 (docs/ARSENAL.md): the Heart Taser's healing slime and the Space Shield's guard.
import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_FIRE, DEFAULT_TDM_RULES, getWeapon, initPhysics, weaponCode } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_TDM_RULES, respawnDelayTicks: 100_000, scoreLimit: 0, timeLimit: 0 };
/** A 40 × 16 m walled yard. */
const yard = () => {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4]]);
};
const at = (c: Combatant, x: number, z: number) => (c.move = { pos: { x, y: 0, z }, velY: 0, grounded: true });
const give = (c: Combatant, id: string) => {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
  c.raiseTicks = 0;
};

function three() {
  const match = new Match(yard(), rules);
  const me = match.addHuman('me')!;
  const others = [match.addHuman('b')!, match.addHuman('c')!];
  for (let i = 0; i < 3; i++) match.step();
  const mate = others.find((c) => !match.hostile(me, c))!;
  const foe = others.find((c) => match.hostile(me, c))!;
  return { match, me, mate, foe };
}

describe('Heart Taser', () => {
  it('its slime finds a hurt teammate and heals them 25; it passes through an enemy unharmed', () => {
    const { match, me, mate, foe } = three();
    expect(mate).toBeDefined();
    give(me, 'core.heart_taser');
    mate.health = 50;
    foe.health = 100;
    let seq = 0;
    const hold = () => {
      at(me, 4, 8);
      // The teammate a little off the line of fire (the slime turns to them); the enemy straight ahead, nearer.
      at(foe, 7, 8);
      at(mate, 12, 9.5);
    };
    for (let t = 0; t < 10; t++) {
      hold();
      match.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: Math.PI / 2, pitch: 0.05, buttons: 0 }]);
      match.step();
    }
    hold();
    match.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: Math.PI / 2, pitch: 0.05, buttons: BUTTON_FIRE }]);
    match.step();
    for (let t = 0; t < 120; t++) {
      hold();
      match.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: Math.PI / 2, pitch: 0.05, buttons: 0 }]);
      match.step();
    }
    expect(foe.health).toBe(100);
    expect(mate.health).toBe(75);
  });
});

describe('Space Shield', () => {
  it('takes 60 % of a hit from in front while in hand; not from behind, and not with a gun in hand', () => {
    const { match, me, foe } = three();
    const hit = (victim: Combatant, attacker: Combatant, n: number) => (match as unknown as { damage(v: Combatant, a: number, k: Combatant, w: string): void }).damage(victim, n, attacker, 'core.rifle');
    give(me, 'core.space_shield');
    at(me, 4, 8);
    at(foe, 10, 8);
    me.yaw = Math.PI / 2; // facing +x, the foe
    me.health = 100;
    hit(me, foe, 50);
    expect(me.health).toBeCloseTo(80, 5);
    me.yaw = -Math.PI / 2; // back to the foe
    me.health = 100;
    hit(me, foe, 50);
    expect(me.health).toBeCloseTo(50, 5);
    give(me, 'core.rifle');
    me.yaw = Math.PI / 2;
    me.health = 100;
    hit(me, foe, 50);
    expect(me.health).toBeCloseTo(50, 5);
  });
});
