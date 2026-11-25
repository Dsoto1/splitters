import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BUTTON_JUMP, PhysicsWorld, loadMap, initPhysics, type PlayerInput, type PlayerSnapshot, type PrivateState } from '@tiletrigger/shared';
import { Match, initNavigation } from '@tiletrigger/shared/match';
import { LocalPlayer } from '../src/game/prediction.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const arenaPath = fileURLToPath(new URL('../../../maps/phase0_arena.json', import.meta.url));

/** A run round one room over a power-up on the spawn, under latency, jumping now and then (as the Speed Boost test). */
function run(item: string, seconds: number) {
  const base = loadMap(readFileSync(arenaPath, 'utf8'));
  if (!base.ok) throw new Error('arena invalid');
  const map = {
    ...base.map,
    classicStructure: { ...base.map.classicStructure, tiles: [{ id: 'room_only', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 as const }] },
    entities: [
      { id: 'spawn_only', kind: 'spawn' as const, position: [0, 0, -2] as [number, number, number], yaw: 0, faction: null },
      { id: 'pk', kind: 'pickup' as const, position: [0, 0, -1] as [number, number, number], item, respawnSeconds: null },
    ],
  };
  const match = new Match(map, undefined, 9);
  const me = match.addHuman('me')!;
  const local = new LocalPlayer(new PhysicsWorld(match.geometry));
  match.step();
  local.reconcile(match.playerSnapshots()[0]!, 0, match.privateState(me.slot));
  const lag = 5;
  const up: { at: number; input: PlayerInput }[] = [];
  const down: { at: number; snap: PlayerSnapshot; ack: number; priv: PrivateState | undefined }[] = [];
  let on = false;
  for (let t = 0; t < 60 * seconds; t++) {
    const { input } = local.tick({ forward: 1, right: 0, buttons: t % 80 === 40 ? BUTTON_JUMP : 0 }, t / 40, 0, 0, 0);
    up.push({ at: t + lag, input });
    while (up.length && up[0]!.at <= t) match.queueInputs(me.slot, [up.shift()!.input]);
    match.step();
    on ||= me.power.moon > 0 || me.power.overdrive > 0;
    down.push({ at: t + lag, snap: match.playerSnapshots()[0]!, ack: me.lastSeq, priv: match.privateState(me.slot) });
    while (down.length && down[0]!.at <= t) {
      const d = down.shift()!;
      local.reconcile(d.snap, d.ack, d.priv);
    }
  }
  match.destroy();
  return { on, corrections: local.corrections, local };
}

describe('power-up prediction', () => {
  it("predicts Overdrive's speed and Moon Boots' low gravity and high jumps exactly (one correction: the pickup)", () => {
    for (const [item, secs] of [['core.powerup_overdrive', 10], ['core.powerup_moon', 17]] as const) {
      const r = run(item, secs);
      expect(r.on, item).toBe(true);
      expect(r.corrections, item).toBeLessThanOrEqual(1);
      // Run out by the end, on both sides.
      expect(r.local.power.moon + r.local.power.overdrive).toBe(0);
    }
  });
});
