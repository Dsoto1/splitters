import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_FIRE,
  CORE_PROPS,
  CREATURE_ROLES,
  CREATURE_SPECS,
  DEFAULT_COOP_RULES,
  NPC_ROLES,
  NPC_ROLE_SPECS,
  chargeIntoMelee,
  getProp,
  getWeapon,
  initPhysics,
  loadMap,
  propBoxes,
  type GameEvent,
  type MapDocument,
  type PlayerInput,
} from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** Three rooms in a row along +X with one encounter in the far room. */
function hall(roster: Record<string, number> | undefined): MapDocument {
  const map = makeMap(
    [
      { id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 },
      { id: 'room_b', tile: 'core.room', x: 1, y: 0, z: 0, rotation: 0 },
      { id: 'room_c', tile: 'core.room', x: 2, y: 0, z: 0, rotation: 0 },
    ],
    [[-2, 0, 0]],
  );
  map.entities.push({
    id: 'enc_0',
    kind: 'encounter',
    position: [12, 0, 0],
    yaw: -Math.PI / 2,
    faction: 'syndicate',
    ...(roster ? { roster } : {}),
    activeCap: 4,
    reinforcements: 0,
    perPlayer: 0,
    respawnSeconds: 1,
    radius: 1,
    order: 'attack',
    orderTarget: null,
    startActive: true,
    difficulty: 'hard',
  } as MapDocument['entities'][number]);
  return map;
}

describe('creature NPC kinds', () => {
  it('are NPC roles with stats and a model, and melee ones carry a melee weapon', () => {
    for (const role of CREATURE_ROLES) {
      expect(NPC_ROLES).toContain(role);
      const spec = NPC_ROLE_SPECS[role];
      expect(spec.creature).toBe(true);
      expect(CREATURE_SPECS[role].model).toMatch(/^creatures\/.+\.glb$/);
      if (spec.melee) expect(getWeapon(spec.weapon).kind).toBe('melee');
      else expect(getWeapon(spec.weapon).kind).toBe('projectile');
    }
    // The soldiers keep their snapshot indices.
    expect(NPC_ROLES.slice(0, 3)).toEqual(['trooper', 'gunner', 'heavy']);
  });

  it('maps saved before creatures existed load with no creatures in their squads', () => {
    const loaded = loadMap(hall({ trooper: 2, gunner: 1, heavy: 0 }));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const e = loaded.map.entities.find((x) => x.kind === 'encounter');
    expect(e?.kind === 'encounter' && e.roster).toEqual({ trooper: 2, gunner: 1, heavy: 0, imp: 0, puglin: 0, cyclops: 0, oculus: 0, scolitex: 0 });
  });

  it('a melee creature rushes in and claws the player', () => {
    const loaded = loadMap(hall({ trooper: 0, gunner: 0, heavy: 0, imp: 1 }));
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
    const match = new Match(loaded.map, DEFAULT_COOP_RULES, 5);
    const me = match.addHuman('me')!;
    match.queueInputs(me.slot, [{ seq: 0, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 }]);
    for (let i = 0; i < 5; i++) match.step();
    // In the middle room, in view of the squad.
    me.move = { pos: { x: 6, y: 0, z: 0 }, velY: 0, grounded: true };
    const events: GameEvent[] = [];
    let seq = 0;
    let closest = Infinity;
    for (let i = 0; i < 60 * 12 && me.alive && !events.some((e) => e.e === 'melee'); i++) {
      match.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: Math.PI / 2, pitch: 0, buttons: 0 }]);
      events.push(...match.step());
      for (const n of match.npcs.values()) closest = Math.min(closest, Math.hypot(n.move.pos.x - me.move.pos.x, n.move.pos.z - me.move.pos.z));
    }
    const imp = [...match.npcs.values()][0]!;
    expect(imp.npc?.role).toBe('imp');
    expect(closest).toBeLessThan(2.5);
    expect(events.some((e) => e.e === 'melee' && e.s === imp.slot)).toBe(true);
  });

  it('chargeIntoMelee steers straight at a close target and strikes in reach', () => {
    const input: PlayerInput = { seq: 1, forward: 0, right: 1, yaw: 0, pitch: 0, buttons: 0 };
    chargeIntoMelee(input, { x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, 2.2);
    expect(input.yaw).toBeCloseTo(Math.PI / 2);
    expect(input.forward).toBe(1);
    expect(input.right).toBe(0);
    expect(input.buttons & BUTTON_FIRE).toBe(0);
    chargeIntoMelee(input, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1.5 }, 2.2);
    expect(input.buttons & BUTTON_FIRE).toBe(BUTTON_FIRE);
    // Too far away: the brain keeps pathing.
    const far: PlayerInput = { seq: 2, forward: 0.3, right: 0, yaw: 1, pitch: 0, buttons: 0 };
    chargeIntoMelee(far, { x: 0, y: 0, z: 0 }, { x: 40, y: 0, z: 0 }, 2.2);
    expect(far).toEqual({ seq: 2, forward: 0.3, right: 0, yaw: 1, pitch: 0, buttons: 0 });
  });
});

describe('sci-fi kit set pieces', () => {
  it('come in their own categories with collision', () => {
    const kit = CORE_PROPS.filter((p) => p.id.startsWith('prop.sf_'));
    expect(kit.length).toBeGreaterThanOrEqual(80);
    expect(new Set(kit.map((p) => p.category))).toEqual(new Set(['Sci-Fi Base', 'Sci-Fi Walls', 'Sci-Fi Platforms', 'Sci-Fi Decals']));
    for (const p of kit.filter((k) => k.category === 'Sci-Fi Decals')) expect(p.collision).toBeNull();
    for (const p of kit.filter((k) => k.category === 'Sci-Fi Walls' && k.collision)) expect(p.size[1]).toBeGreaterThanOrEqual(0.9);
  });

  it('stairs collide as steps a player can walk up, turned with the prop', () => {
    const stairs = getProp('prop.sf_stairs_4')!;
    expect(stairs.boxes?.length).toBeGreaterThan(4);
    const map = makeMap([{ id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[-2, 0, 0]]);
    const place = (yaw: number) => {
      map.entities = [{ id: 'p', kind: 'prop', model: 'prop.sf_stairs_4', position: [0, 0, 0], yaw, scale: 1, solid: true, tint: null }];
      return propBoxes(map);
    };
    const flat = place(0);
    expect(flat.length).toBe(stairs.boxes!.length);
    // Each step rises at most 0.3 m over the one before, and the top is at the +Z end.
    const tops = flat.map((b) => b.max[1]).sort((a, b) => a - b);
    tops.forEach((t, i) => expect(t - (tops[i - 1] ?? 0)).toBeLessThanOrEqual(0.3));
    const highest = flat.reduce((a, b) => (b.max[1] > a.max[1] ? b : a));
    expect((highest.min[2] + highest.max[2]) / 2).toBeGreaterThan(1);
    // A quarter turn (yaw π/2) climbs toward +X.
    const turned = place(Math.PI / 2);
    const top = turned.reduce((a, b) => (b.max[1] > a.max[1] ? b : a));
    expect((top.min[0] + top.max[0]) / 2).toBeGreaterThan(1);
  });

  it('doorways stay open in the middle', () => {
    const map = makeMap([{ id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[-2, 0, 0]]);
    map.entities = [{ id: 'd', kind: 'prop', model: 'prop.sf_doorway_square', position: [0, 0, 0], yaw: 0, scale: 1, solid: true, tint: null }];
    const boxes = propBoxes(map);
    const blocksCentre = boxes.some((b) => b.min[0] < 0 && b.max[0] > 0 && b.min[1] < 1.5);
    expect(blocksCentre).toBe(false);
    expect(boxes.length).toBe(3);
  });
});
