import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BUTTON_CROUCH, BUTTON_DODGE, BUTTON_FIRE, BUTTON_SPRINT, PhysicsWorld, getWeapon, initPhysics, loadMap, weaponCode, type PlayerInput, type PlayerSnapshot, type PrivateState } from '@tiletrigger/shared';
import { Match, initNavigation } from '@tiletrigger/shared/match';
import { LocalPlayer } from '../src/game/prediction.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const arenaPath = fileURLToPath(new URL('../../../maps/phase0_arena.json', import.meta.url));

/** The dodge-step and combat roll (shared sim/moves.ts) are predicted like the rest of movement: no rubber-banding. */
describe('dodge-step and roll prediction', () => {
  for (const latencyTicks of [3, 6, 9]) {
    it(`steps and rolls in step with the host at ${Math.round((latencyTicks * 2000) / 60)} ms round trip: nothing is corrected, the gun's raise agrees`, () => {
      const loaded = loadMap(readFileSync(arenaPath, 'utf8'));
      if (!loaded.ok) throw new Error('arena invalid');
      const tiles = [];
      for (let x = 0; x < 5; x++) for (let y = 0; y < 4; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
      const map = { ...loaded.map, classicStructure: { ...loaded.map.classicStructure, tiles }, entities: [{ id: 'spawn_only', kind: 'spawn' as const, position: [16, 0, 16] as [number, number, number], yaw: 0, faction: null }] };
      const match = new Match(map, undefined, 5);
      const me = match.addHuman('me')!;
      const def = getWeapon('core.battle_rifle');
      me.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
      me.current = weaponCode(def);
      const local = new LocalPlayer(new PhysicsWorld(match.geometry));
      match.step();
      me.move = { ...me.move, pos: { x: 16, y: 0, z: 16 }, velY: 0 };
      match.step();
      local.reconcile(match.playerSnapshots().find((p) => p.s === me.slot)!, 0, match.privateState(me.slot));
      const toServer: { at: number; input: PlayerInput }[] = [];
      const toClient: { at: number; snap: PlayerSnapshot; ack: number; priv: PrivateState | undefined }[] = [];
      let stepped = 0;
      let rolled = 0;
      let rollSnaps = 0;
      for (let t = 0; t < 60 * 18; t++) {
        // A 6 s loop: a dodge-step left, then right, a sprint and a roll out of it, a crouch and a roll back, firing
        // through and after it (the roll's lowered gun is predicted too), then 2 s standing for the stamina to come back.
        const phase = t % 360;
        const yaw = (Math.floor(t / 360) % 2) * Math.PI + Math.sin(t / 40) * 0.2;
        let buttons = 0;
        let forward = 0;
        let right = 0;
        if (phase < 40) right = -1;
        else if (phase < 80) right = 1;
        else if (phase < 140) {
          forward = 1;
          buttons = BUTTON_SPRINT;
        } else if (phase < 200) buttons = BUTTON_CROUCH;
        else if (phase < 240) forward = -1;
        if (phase === 2 || phase === 42 || phase === 120 || phase === 170) buttons |= BUTTON_DODGE;
        if (phase >= 200 && phase < 240) buttons |= phase % 6 < 3 ? BUTTON_FIRE : 0;
        if (phase >= 170 && phase < 200) buttons |= BUTTON_FIRE;
        if (phase === 170) forward = -1;
        const { input } = local.tick({ forward, right, buttons }, yaw, 0, 0, 0);
        toServer.push({ at: t + latencyTicks, input });
        while (toServer.length && toServer[0]!.at <= t) match.queueInputs(me.slot, [toServer.shift()!.input]);
        match.step();
        if (me.move.dodge && !me.move.roll) stepped++;
        if (me.move.roll) rolled++;
        if (t % 2 === 0) toClient.push({ at: t + latencyTicks, snap: match.playerSnapshots().find((p) => p.s === me.slot)!, ack: me.lastSeq, priv: match.privateState(me.slot) });
        while (toClient.length && toClient[0]!.at <= t) {
          const { snap, ack, priv } = toClient.shift()!;
          if (snap.dg?.[0] === 2) rollSnaps++;
          local.reconcile(snap, ack, priv);
        }
      }
      expect(stepped).toBeGreaterThan(30);
      expect(rolled).toBeGreaterThan(80);
      expect(rollSnaps).toBeGreaterThan(20);
      expect(local.corrections).toBe(0);
      match.destroy();
    });
  }
});
