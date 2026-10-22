import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BUTTON_JUMP, PhysicsWorld, getWeapon, initPhysics, loadMap, type PlayerInput, type PlayerSnapshot } from '@chronosplit/shared';
import { Match, initNavigation } from '@chronosplit/shared/match';
import { LocalPlayer } from '../src/prediction.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const arenaPath = fileURLToPath(new URL('../../../maps/phase0_arena.json', import.meta.url));

describe('client prediction', () => {
  it('matches the authoritative server exactly under latency, so reconciliation never corrects', () => {
    const loaded = loadMap(readFileSync(arenaPath, 'utf8'));
    if (!loaded.ok) throw new Error('arena invalid');
    const match = new Match(loaded.map, undefined, 5);
    const me = match.addHuman('me')!;
    const local = new LocalPlayer(new PhysicsWorld(match.geometry), getWeapon('core.rifle'));

    const latencyTicks = 6; // ~100 ms each way
    const toServer: { at: number; input: PlayerInput }[] = [];
    const toClient: { at: number; snap: PlayerSnapshot; ack: number }[] = [];

    // Seed the client with the spawn state, as the first snapshot would.
    match.step();
    local.reconcile(match.playerSnapshots().find((p) => p.s === me.slot)!, 0);
    const start = { ...me.move.pos };

    for (let t = 0; t < 60 * 15; t++) {
      // Scripted run: weave around, jump now and then, keep turning.
      const yaw = Math.sin(t / 90) * 2.5;
      const sample = { forward: 1, right: Math.sin(t / 25) * 0.6, buttons: t % 70 === 0 ? BUTTON_JUMP : 0 };
      const { input } = local.tick(sample, yaw, 0);
      toServer.push({ at: t + latencyTicks, input });

      while (toServer.length && toServer[0]!.at <= t) match.queueInputs(me.slot, [toServer.shift()!.input]);
      match.step();
      if (t % 2 === 0) toClient.push({ at: t + latencyTicks, snap: match.playerSnapshots().find((p) => p.s === me.slot)!, ack: me.lastSeq });
      while (toClient.length && toClient[0]!.at <= t) {
        const { snap, ack } = toClient.shift()!;
        local.reconcile(snap, ack);
      }
    }
    // The run actually went somewhere, nothing was corrected, and a real divergence would have been caught.
    expect(Math.hypot(me.move.pos.x - start.x, me.move.pos.z - start.z)).toBeGreaterThan(3);
    const drifted = { ...match.playerSnapshots().find((p) => p.s === me.slot)!, p: [me.move.pos.x + 1, me.move.pos.y, me.move.pos.z] as [number, number, number] };
    expect(local.corrections).toBe(0);
    local.reconcile(drifted, me.lastSeq);
    expect(local.corrections).toBe(1);
    match.destroy();
  });
});
