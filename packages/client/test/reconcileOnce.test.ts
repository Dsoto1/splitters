import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BUTTON_JUMP, BUTTON_SPRINT, PhysicsWorld, initPhysics, loadMap, type PlayerInput, type PlayerSnapshot, type PrivateState } from '@tiletrigger/shared';
import { Match, initNavigation } from '@tiletrigger/shared/match';
import { LocalPlayer } from '../src/game/prediction.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const arenaPath = fileURLToPath(new URL('../../../maps/phase0_arena.json', import.meta.url));

/**
 * The game reconciles the local player once a frame with the newest snapshot (session.ts reconcileLocal), not once
 * per snapshot: a burst of snapshots replays the pending inputs once. Prediction must come out the same.
 */
describe('reconciling once a frame', () => {
  it('predicts exactly as reconciling every snapshot does, with snapshots in bursts', () => {
    const loaded = loadMap(readFileSync(arenaPath, 'utf8'));
    if (!loaded.ok) throw new Error('arena invalid');
    const match = new Match(loaded.map, undefined, 5);
    const me = match.addHuman('me')!;
    // Every snapshot, and only the newest of each burst.
    const each = new LocalPlayer(new PhysicsWorld(match.geometry));
    const once = new LocalPlayer(new PhysicsWorld(match.geometry));
    match.step();
    const sp = loaded.map.entities.find((e) => e.kind === 'spawn' && e.position[0] === 8 && e.position[2] === -2)!;
    me.move = { ...me.move, pos: { x: sp.position[0], y: sp.position[1], z: sp.position[2] }, velY: 0 };
    me.yaw = 'yaw' in sp ? sp.yaw : 0;
    match.step();
    for (const l of [each, once]) l.reconcile(match.playerSnapshots().find((p) => p.s === me.slot)!, 0, match.privateState(me.slot));
    const start = { ...me.move.pos };

    const latencyTicks = 6;
    const toServer: { at: number; input: PlayerInput }[] = [];
    const toClient: { at: number; snap: PlayerSnapshot; ack: number; priv: PrivateState | undefined }[] = [];
    let bursts = 0;
    for (let t = 0; t < 60 * 12; t++) {
      const yaw = Math.sin(t / 90) * 2.5;
      // Sprinting in stretches (the replay keeps a sprint's exit time), jumping now and then.
      const sample = () => ({ forward: 1, right: Math.sin(t / 25) * 0.6, buttons: (t % 70 === 0 ? BUTTON_JUMP : 0) | (t % 300 < 150 ? BUTTON_SPRINT : 0) });
      const { input } = each.tick(sample(), yaw, 0, 0, 0);
      const { input: same } = once.tick(sample(), yaw, 0, 0, 0);
      expect(same).toEqual(input);
      toServer.push({ at: t + latencyTicks, input });
      while (toServer.length && toServer[0]!.at <= t) match.queueInputs(me.slot, [toServer.shift()!.input]);
      match.step();
      if (t % 2 === 0) toClient.push({ at: t + latencyTicks, snap: match.playerSnapshots().find((p) => p.s === me.slot)!, ack: me.lastSeq, priv: match.privateState(me.slot) });
      // A slow frame now and then: what arrived meanwhile comes in at once (here every 5th tick takes them all).
      if (t % 5 !== 4) continue;
      const due: typeof toClient = [];
      while (toClient.length && toClient[0]!.at <= t) due.push(toClient.shift()!);
      for (const d of due) each.reconcile(d.snap, d.ack, d.priv);
      const last = due.at(-1);
      if (last) once.reconcile(last.snap, last.ack, last.priv);
      if (due.length > 1) bursts++;
      expect(once.state).toEqual(each.state);
    }
    expect(bursts).toBeGreaterThan(50);
    expect(Math.hypot(me.move.pos.x - start.x, me.move.pos.z - start.z)).toBeGreaterThan(3);
    expect(each.corrections).toBe(0);
    expect(once.corrections).toBe(0);
    match.destroy();
  });
});
