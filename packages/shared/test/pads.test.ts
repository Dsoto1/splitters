import { readdirSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics, loadMap, mapPads, padLandings, PhysicsWorld, buildMapGeometry, mapTerrainMesh, type MapDocument } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';

beforeAll(async () => {
  await Promise.all([initPhysics(), initNavigation()]);
});

const load = (id: string): MapDocument => {
  const r = loadMap(readFileSync(new URL(`../../../maps/${id}.json`, import.meta.url), 'utf8'));
  if (!r.ok) throw new Error(`${id} invalid`);
  return r.map;
};

describe('jump pads land where bots are told they do', () => {
  // On maps like Void Yard (nothing but pads over the void) a flight that falls short is a death.
  const withPads = readdirSync(new URL('../../../maps/', import.meta.url))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .filter((id) => load(id).entities.some((e) => e.kind === 'pad'));
  it.each(withPads)('every pad on %s carries a player to its predicted landing', { timeout: 180_000 }, (id) => {
    const map = load(id);
    const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
    const pads = mapPads(map.entities);
    const predicted = padLandings(pads, physics);
    physics.free();
    for (const pad of pads) {
      const match = new Match(map, undefined, 1);
      const me = match.addHuman('me')!;
      let seq = 0;
      const step = () => {
        match.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: me.yaw, pitch: 0, buttons: 0 }]);
        match.step();
      };
      me.health = 100;
      // Maps with an air drop start you in the plane: get out first.
      match.leaveMount(me, false);
      me.move = { pos: { ...pad.pos }, velY: 0, grounded: true };
      let left = false;
      for (let i = 0; i < 600; i++) {
        me.health = 100;
        step();
        if (!me.move.grounded) left = true;
        if (left && me.move.grounded) break;
      }
      const landing = predicted.find((l) => l.start.x === pad.pos.x && l.start.z === pad.pos.z);
      expect(landing, `pad at ${pad.pos.x},${pad.pos.z} comes down somewhere`).toBeTruthy();
      const want = landing!.end;
      const got = me.move.pos;
      expect(me.alive, `pad at ${pad.pos.x},${pad.pos.z}: alive`).toBe(true);
      expect(Math.hypot(got.x - want.x, got.z - want.z), `pad at ${pad.pos.x},${pad.pos.z}: landed ${got.x.toFixed(1)},${got.z.toFixed(1)}, predicted ${want.x.toFixed(1)},${want.z.toFixed(1)}`).toBeLessThan(2.5);
      expect(Math.abs(got.y - want.y), `pad at ${pad.pos.x},${pad.pos.z}: landed at ${got.y.toFixed(1)} m, predicted ${want.y.toFixed(1)} m`).toBeLessThan(1);
    }
  });
});
