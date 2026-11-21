import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BUTTON_CROUCH, BUTTON_LEAN_LEFT, BUTTON_LEAN_RIGHT, BUTTON_SPRINT, PhysicsWorld, initPhysics, loadMap, type PlayerInput, type PlayerSnapshot, type PrivateState } from '@tiletrigger/shared';
import { Match, initNavigation } from '@tiletrigger/shared/match';
import { LocalPlayer } from '../src/game/prediction.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const arenaPath = fileURLToPath(new URL('../../../maps/phase0_arena.json', import.meta.url));

/** Slide and peek (shared sim/moves.ts) are predicted like the rest of movement: no rubber-banding on a normal connection. */
describe('slide and peek prediction', () => {
  for (const latencyTicks of [3, 6, 9]) {
    it(`slides and leans in step with the host at ${Math.round((latencyTicks * 2000) / 60)} ms round trip: nothing is corrected, and the eye agrees`, () => {
      const loaded = loadMap(readFileSync(arenaPath, 'utf8'));
      if (!loaded.ok) throw new Error('arena invalid');
      // An open yard, 40 × 32 m, one spawn.
      const tiles = [];
      for (let x = 0; x < 5; x++) for (let y = 0; y < 4; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
      const map = { ...loaded.map, classicStructure: { ...loaded.map.classicStructure, tiles }, entities: [{ id: 'spawn_only', kind: 'spawn' as const, position: [16, 0, 6] as [number, number, number], yaw: 0, faction: null }] };
      const match = new Match(map, undefined, 5);
      const me = match.addHuman('me')!;
      const local = new LocalPlayer(new PhysicsWorld(match.geometry));
      match.step();
      me.move = { ...me.move, pos: { x: 16, y: 0, z: 6 }, velY: 0 };
      match.step();
      local.reconcile(match.playerSnapshots().find((p) => p.s === me.slot)!, 0, match.privateState(me.slot));
      const toServer: { at: number; input: PlayerInput }[] = [];
      const toClient: { at: number; snap: PlayerSnapshot; ack: number; priv: PrivateState | undefined }[] = [];
      let slid = 0;
      let leaned = 0;
      let leanedSnaps = 0;
      for (let t = 0; t < 60 * 12; t++) {
        // A 3 s loop: sprint 1 s, crouch (a slide, then a crouch walk) 0.8 s, stand and lean right, then left.
        const phase = t % 180;
        // Up the yard and back, turning a little as it goes.
        const yaw = (Math.floor(t / 180) % 2) * Math.PI + Math.sin(t / 30) * 0.3;
        const buttons = phase < 60 ? BUTTON_SPRINT : phase < 108 ? BUTTON_SPRINT | BUTTON_CROUCH : phase < 144 ? BUTTON_LEAN_RIGHT : BUTTON_LEAN_LEFT;
        const { input } = local.tick({ forward: phase < 108 ? 1 : 0, right: phase >= 108 ? Math.sin(t / 9) * 0.5 : 0, buttons }, yaw, 0, 0, 0);
        toServer.push({ at: t + latencyTicks, input });
        while (toServer.length && toServer[0]!.at <= t) match.queueInputs(me.slot, [toServer.shift()!.input]);
        match.step();
        if (me.move.slide) slid++;
        if (me.move.lean) leaned++;
        if (t % 2 === 0) toClient.push({ at: t + latencyTicks, snap: match.playerSnapshots().find((p) => p.s === me.slot)!, ack: me.lastSeq, priv: match.privateState(me.slot) });
        while (toClient.length && toClient[0]!.at <= t) {
          const { snap, ack, priv } = toClient.shift()!;
          if (snap.ln) leanedSnaps++;
          local.reconcile(snap, ack, priv);
        }
      }
      expect(slid).toBeGreaterThan(60);
      expect(leaned).toBeGreaterThan(120);
      expect(leanedSnaps).toBeGreaterThan(30);
      expect(local.corrections).toBe(0);
      // Caught up (the inputs in flight delivered, then none): the client's lean is the host's.
      for (const { input } of toServer) {
        match.queueInputs(me.slot, [input]);
        match.step();
      }
      for (let t = 0; t < 30; t++) {
        const { input } = local.tick({ forward: 0, right: 0, buttons: BUTTON_LEAN_RIGHT }, 0.4, 0, 0, 0);
        match.queueInputs(me.slot, [input]);
        match.step();
      }
      local.reconcile(match.playerSnapshots().find((p) => p.s === me.slot)!, me.lastSeq, match.privateState(me.slot));
      expect(local.state.lean).toBe(me.move.lean);
      expect(local.state.lean).toBeGreaterThan(0);
      expect(local.corrections).toBe(0);
      match.destroy();
    });
  }
});
