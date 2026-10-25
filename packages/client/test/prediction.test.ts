import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BUTTON_JUMP, PhysicsWorld, initPhysics, loadMap, type PlayerInput, type PlayerSnapshot, type PrivateState } from '@tiletrigger/shared';
import { Match, initNavigation } from '@tiletrigger/shared/match';
import { LocalPlayer } from '../src/game/prediction.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const arenaPath = fileURLToPath(new URL('../../../maps/phase0_arena.json', import.meta.url));

describe('client prediction', () => {
  it('matches the authoritative server exactly under latency, so reconciliation never corrects', () => {
    const loaded = loadMap(readFileSync(arenaPath, 'utf8'));
    if (!loaded.ok) throw new Error('arena invalid');
    const match = new Match(loaded.map, undefined, 5);
    const me = match.addHuman('me')!;
    const local = new LocalPlayer(new PhysicsWorld(match.geometry));

    const latencyTicks = 6; // ~100 ms each way
    const toServer: { at: number; input: PlayerInput }[] = [];
    const toClient: { at: number; snap: PlayerSnapshot; ack: number; priv: PrivateState | undefined }[] = [];

    // Seed the client with the spawn state, as the first snapshot would.
    match.step();
    local.reconcile(match.playerSnapshots().find((p) => p.s === me.slot)!, 0, match.privateState(me.slot));
    const start = { ...me.move.pos };

    for (let t = 0; t < 60 * 15; t++) {
      // Scripted run: weave around, jump now and then, keep turning.
      const yaw = Math.sin(t / 90) * 2.5;
      const sample = { forward: 1, right: Math.sin(t / 25) * 0.6, buttons: t % 70 === 0 ? BUTTON_JUMP : 0 };
      const { input } = local.tick(sample, yaw, 0, 0, 0);
      toServer.push({ at: t + latencyTicks, input });

      while (toServer.length && toServer[0]!.at <= t) match.queueInputs(me.slot, [toServer.shift()!.input]);
      match.step();
      if (t % 2 === 0) toClient.push({ at: t + latencyTicks, snap: match.playerSnapshots().find((p) => p.s === me.slot)!, ack: me.lastSeq, priv: match.privateState(me.slot) });
      while (toClient.length && toClient[0]!.at <= t) {
        const { snap, ack, priv } = toClient.shift()!;
        local.reconcile(snap, ack, priv);
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

  it('only corrects once, at the speed boost pickup, then stays exact through the boost and its expiry', () => {
    const base = loadMap(readFileSync(arenaPath, 'utf8'));
    if (!base.ok) throw new Error('arena invalid');
    // Single room with a speed boost on the only spawn.
    const map = {
      ...base.map,
      classicStructure: { ...base.map.classicStructure, tiles: [{ id: 'room_only', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 as const }] },
      entities: [
        { id: 'spawn_only', kind: 'spawn' as const, position: [0, 0, -2] as [number, number, number], yaw: 0, faction: null },
        { id: 'pk_speed', kind: 'pickup' as const, position: [0, 0, -1] as [number, number, number], item: 'core.powerup_speed', respawnSeconds: null },
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
    let boosted = false;
    for (let t = 0; t < 60 * 18; t++) {
      // Circle around the room so the boost expires mid-run (15 s).
      const { input } = local.tick({ forward: 1, right: 0, buttons: 0 }, t / 40, 0, 0, 0);
      up.push({ at: t + lag, input });
      while (up.length && up[0]!.at <= t) match.queueInputs(me.slot, [up.shift()!.input]);
      match.step();
      boosted ||= me.speedTicks > 0;
      down.push({ at: t + lag, snap: match.playerSnapshots()[0]!, ack: me.lastSeq, priv: match.privateState(me.slot) });
      while (down.length && down[0]!.at <= t) {
        const d = down.shift()!;
        local.reconcile(d.snap, d.ack, d.priv);
      }
    }
    expect(boosted).toBe(true);
    expect(me.speedTicks).toBe(0);
    // Exactly one correction: when the server reports the pickup (the client does not predict pickups).
    // The boost counting down and expiring 15 s later is predicted exactly.
    expect(local.corrections).toBe(1);
    match.destroy();
  });
});
