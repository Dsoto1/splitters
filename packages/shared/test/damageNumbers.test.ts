/**
 * Damage numbers (a HUD option, off by default): the host tells each human player, in their private state (`dd`),
 * what their hits did, one entry per target per tick, so the client can float the number over the target.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_FIRE, DEFAULT_DEATHMATCH_RULES, PLAYER, getWeapon, initPhysics, lookAngles, weaponCode, type MapDocument, type MapEntity, type MatchRules, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };

function deck(extra: MapEntity[] = []): MapDocument {
  const tiles = [];
  for (let x = -1; x < 12; x++) for (let y = -2; y <= 2; y++) tiles.push({ id: `p_${x}_${y}`, tile: 'core.platform', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 0]]);
  return { ...map, entities: [...map.entities, ...extra] };
}

function setup(weapon: string, target: [number, number, number] | null, extra: MapEntity[] = []) {
  const match = new Match(deck(extra), rules);
  const a = match.addHuman('a')!;
  const t = target ? match.addHuman('t')! : null;
  a.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
  if (t && target) t.move = { pos: { x: target[0], y: target[1], z: target[2] }, velY: 0, grounded: true };
  const def = getWeapon(weapon);
  a.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  a.current = weaponCode(def);
  a.raiseTicks = 0;
  let seq = 0;
  const step = (i: Partial<PlayerInput> = {}) => {
    match.queueInputs(a.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: a.yaw, pitch: a.pitch, buttons: 0, ...i }]);
    if (t) match.queueInputs(t.slot, [{ seq, forward: 0, right: 0, yaw: t.yaw, pitch: t.pitch, buttons: 0 }]);
    match.step();
  };
  return { match, a, t, step };
}

const chestOf = (c: Combatant) => ({ x: c.move.pos.x, y: c.move.pos.y + 1.1, z: c.move.pos.z });
const eyeOf = (c: Combatant) => ({ x: c.move.pos.x, y: c.move.pos.y + PLAYER.eyeHeight, z: c.move.pos.z });

describe('damage numbers (privateState dd)', () => {
  it('a body hit reports its damage over the target, once per tick; nothing for anyone else', () => {
    const { match, a, t, step } = setup('core.pistol', [6, 0, 0]);
    const aim = lookAngles(eyeOf(a), chestOf(t!));
    step({ ...aim, buttons: BUTTON_FIRE });
    for (let i = 0; i < 3; i++) step(aim);
    const dd = match.privateState(a.slot)!.dd!;
    expect(dd).toHaveLength(1);
    const [tick, amount, flags, x] = dd[0]!;
    expect(amount).toBe(PLAYER.maxHealth - t!.health);
    expect(amount).toBe(getWeapon('core.pistol').damage);
    expect(flags).toBe(0);
    expect(x).toBeCloseTo(6, 1);
    expect(tick).toBeLessThanOrEqual(match.tick);
    expect(match.privateState(t!.slot)!.dd).toBeUndefined();
    // A few snapshots later it is gone.
    for (let i = 0; i < 10; i++) step(aim);
    expect(match.privateState(a.slot)!.dd).toBeUndefined();
  });

  it('a shotgun shell is one number (its pellets summed), marked as a kill; armour is marked too', () => {
    const { match, a, t, step } = setup('core.shotgun', [4, 0, 0]);
    const aim = lookAngles(eyeOf(a), chestOf(t!));
    step({ ...aim, buttons: BUTTON_FIRE });
    step(aim);
    const dd = match.privateState(a.slot)!.dd!;
    expect(dd).toHaveLength(1);
    expect(dd[0]![1]).toBeGreaterThanOrEqual(PLAYER.maxHealth);
    expect(dd[0]![2] & 4).toBe(4);

    const b = setup('core.pistol', [6, 0, 0]);
    b.t!.armor = 100;
    b.step({ ...lookAngles(eyeOf(b.a), chestOf(b.t!)), buttons: BUTTON_FIRE });
    b.step();
    const hit = b.match.privateState(b.a.slot)!.dd![0]!;
    expect(hit[2] & 2).toBe(2);
    expect(hit[1]).toBe(getWeapon('core.pistol').damage);
  });

  it('a round into a breakable board shows what it would do to a body there', () => {
    const board: MapEntity = { id: 'board', kind: 'block', position: [8, 0, 0], size: [0.2, 1.9, 1.2], yaw: 0, material: 'core.crate_wood', tint: null, behaviour: 'breakable', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 4, health: 600 } as unknown as MapEntity;
    const { match, a, step } = setup('core.pistol', null, [board]);
    const aim = lookAngles(eyeOf(a), { x: 7.9, y: 1.1, z: 0 });
    step({ ...aim, buttons: BUTTON_FIRE });
    for (let i = 0; i < 3; i++) step(aim);
    const dd = match.privateState(a.slot)!.dd!;
    expect(dd).toHaveLength(1);
    expect(dd[0]![2]).toBe(8);
    expect(dd[0]![1]).toBe(getWeapon('core.pistol').damage);
  });
});
