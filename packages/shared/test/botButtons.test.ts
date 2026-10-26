import { beforeAll, describe, expect, it } from 'vitest';
import { CORE_BOT_PROFILES, TICK_RATE, initPhysics, type MapEntity } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { EAST, act, button, loaded, rule, twoRooms } from './kit20.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const lockedDoor: MapEntity = { id: 'door_1', kind: 'door', position: [4, 0, 0], yaw: EAST, startOpen: false, locked: true, auto: true };

/** A locked door between the rooms, a button in the first room that opens it, and the only gun in the second. */
function map(withButton: boolean) {
  const doc = twoRooms(
    [lockedDoor, ...(withButton ? [button('button_1', [-2, 0, -3])] : []), { id: 'gun_1', kind: 'pickup', position: [9, 0, 0], item: 'core.weapon_shotgun', respawnSeconds: null }],
    withButton ? { rules: [rule({ when: { event: 'button_pressed', target: 'button_1' }, do: [act('door_unlock', { target: 'door_1' }), act('door_open', { target: 'door_1' })] })] } : {},
  );
  doc.entities.push({ id: 'spawn_far', kind: 'spawn', position: [10, 0, 2], yaw: 0, faction: null });
  return loaded(doc);
}

function run(withButton: boolean): { opened: boolean; maxX: number } {
  const match = new Match(map(withButton), undefined, 11);
  const bot = match.addBot('b', { ...CORE_BOT_PROFILES[0]!, exploration: 100 })!;
  bot.move = { pos: { x: -2, y: 0, z: 1 }, velY: 0, grounded: true };
  let maxX = -Infinity;
  for (let t = 0; t < TICK_RATE * 25; t++) {
    match.step();
    if (bot.alive) maxX = Math.max(maxX, bot.move.pos.x);
  }
  return { opened: (match.scenario.doorOpen('door_1') ?? 0) > 0.5 || maxX > 4.5, maxX };
}

describe('bots press buttons', () => {
  it('a bot whose way is shut by a door goes and presses the button that opens it, then goes through', () => {
    const r = run(true);
    expect(r.opened).toBe(true);
    expect(r.maxX).toBeGreaterThan(5);
  });

  it('without a button the locked door stays a wall', () => {
    expect(run(false).maxX).toBeLessThan(3.6);
  });
});

describe('bots ride lifts', () => {
  it('a bot waits for a lift, rides it up to a ledge and takes the gun there', () => {
    const doc = twoRooms([
      // A ledge 2 m up along the west wall of the first room, reached only by the lift beside it.
      { id: 'ledge_1', kind: 'block', position: [-2.5, 1.5, 0], yaw: 0, size: [3, 0.5, 7.6], material: null, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 },
      { id: 'lift_1', kind: 'block', position: [0, 0, 2.5], yaw: 0, size: [2, 0.3, 2], material: null, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 },
      { id: 'mover_1', kind: 'mover', position: [0, 0, 2.5], yaw: 0, blocks: ['lift_1'], points: [[0, 0, 0], [0, 1.7, 0]], mode: 'pingpong', speed: 1.5, turnSpeed: 45, wait: 1.5, startActive: true },
      { id: 'gun_1', kind: 'pickup', position: [-2.5, 2, -2], item: 'core.weapon_shotgun', respawnSeconds: null },
    ]);
    doc.entities.push({ id: 'spawn_far', kind: 'spawn', position: [10, 0, 2], yaw: 0, faction: null });
    const match = new Match(loaded(doc), undefined, 5);
    const bot = match.addBot('b', { ...CORE_BOT_PROFILES[0]!, exploration: 100 })!;
    bot.move = { pos: { x: 2, y: 0, z: 2.5 }, velY: 0, grounded: true };
    let maxY = -Infinity;
    for (let t = 0; t < TICK_RATE * 30 && maxY < 1.9; t++) {
      match.step();
      if (bot.alive && bot.move.grounded) maxY = Math.max(maxY, bot.move.pos.y);
    }
    expect(maxY).toBeGreaterThan(1.9);
  });
});
