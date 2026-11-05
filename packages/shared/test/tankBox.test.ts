/**
 * The Tank's collision box against its model (content/vehicles/tank.json, `half`): the WWII tank's hull is 2.93 m wide
 * and 6.1 m long, the box was 4.2 m wide (shots and bodies stopped on air beside the tracks). Fitted to the hull, a
 * player walking into its side or front stops against the hull, still gets in from beside it, and gets out clear of it.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_USE, DEFAULT_DEATHMATCH_RULES, MOUNT_DEFS, PLAYER, initPhysics, type MapDocument, type MapEntity, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
const TANK = { x: 16, z: 12 };

/** An open yard 40 × 32 m with the tank at (16, 12), facing +z. */
function yard(): MapDocument {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 4; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 0]]);
  const tank: MapEntity = { id: 'mount_0', kind: 'mount', position: [TANK.x, 0, TANK.z], model: 'tank', yaw: 0, faction: null, respawnSeconds: null };
  return { ...map, entities: [...map.entities, tank] };
}

function setup() {
  const match = new Match(yard(), rules);
  const c = match.addHuman('p')! as Combatant;
  let seq = 0;
  const input = (i: Partial<PlayerInput>) => match.queueInputs(c.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: c.yaw, pitch: 0, buttons: 0, ...i }]);
  const run = (n: number, i: Partial<PlayerInput> = {}) => {
    for (let k = 0; k < n; k++) {
      input(i);
      match.step();
    }
  };
  run(2);
  const place = (x: number, z: number) => (c.move = { pos: { x, y: 0, z }, velY: 0, grounded: true });
  return { match, c, run, place };
}

describe('the Tank collision box', () => {
  const [hx, hy, hz] = MOUNT_DEFS.tank!.half;

  it('fits the hull (2.93 m wide, 6.1 m long, its deck 2 m up), with every seat over it', () => {
    expect(hx).toBeGreaterThanOrEqual(1.45);
    expect(hx).toBeLessThanOrEqual(1.55);
    expect(hz).toBeGreaterThanOrEqual(3);
    expect(hz).toBeLessThanOrEqual(3.15);
    expect(hy * 2).toBeCloseTo(2, 1);
    for (const s of MOUNT_DEFS.tank!.seats) {
      expect(Math.abs(s.offset[0])).toBeLessThan(hx);
      expect(Math.abs(s.offset[2])).toBeLessThan(hz);
      expect(s.offset[1]).toBeGreaterThan(hy * 2 - 0.1);
    }
  });

  it('a player walking into its side or front stops against the hull, not on air beside it', () => {
    const side = setup();
    side.place(TANK.x - 6, TANK.z);
    side.run(150, { forward: 1, yaw: Math.PI / 2 });
    const gapX = TANK.x - side.c.move.pos.x;
    expect(gapX).toBeGreaterThan(hx + PLAYER.radius - 0.1);
    expect(gapX).toBeLessThan(hx + PLAYER.radius + 0.15);
    const front = setup();
    front.place(TANK.x, TANK.z + 8);
    front.run(150, { forward: 1, yaw: Math.PI });
    const gapZ = front.c.move.pos.z - TANK.z;
    expect(gapZ).toBeGreaterThan(hz + PLAYER.radius - 0.1);
    expect(gapZ).toBeLessThan(hz + PLAYER.radius + 0.15);
  });

  it('gets in from beside the hull and out clear of it', () => {
    const { c, run, place } = setup();
    place(TANK.x - hx - PLAYER.radius - 0.05, TANK.z + 1);
    run(1, { buttons: BUTTON_USE });
    run(1);
    expect(c.mount?.seat).toBe(0);
    run(1, { buttons: BUTTON_USE });
    run(30);
    expect(c.mount).toBeUndefined();
    const lx = Math.abs(c.move.pos.x - TANK.x);
    const lz = Math.abs(c.move.pos.z - TANK.z);
    expect(lx > hx + PLAYER.radius - 0.05 || lz > hz + PLAYER.radius - 0.05).toBe(true);
  });
});
