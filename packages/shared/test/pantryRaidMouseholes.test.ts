import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { CORE_BOT_PROFILES, TICK_RATE, initPhysics, type MapDocument } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { loaded } from './kit20.ts';

/**
 * Pantry Raid's mouse holes (docs/FX_CHECKS_2026-11-13.md, section 1; the owner's pick 1a, 2026-11-14): the room's
 * 0.9 m skirting board ran straight across both portals, so only a Small body that jumped got in, and a bot that took
 * the navmesh's portal link walked into the board. The board is split at each hole in MapMaker; these hold that.
 */
beforeAll(() => Promise.all([initPhysics(), initNavigation()]));
const doc = (): MapDocument => loaded(JSON.parse(readFileSync(new URL('../../../maps/pantry_raid.json', import.meta.url), 'utf8')));

// West hole: portal at (0.15, 0, 28) facing +x. South hole: (70, 0, 0.15) facing +z.
const holes = [
  { name: 'west', start: { x: 3, y: 0, z: 28 }, yaw: -Math.PI / 2 },
  { name: 'south', start: { x: 70, y: 0, z: 3 }, yaw: Math.PI },
];

describe("Pantry Raid's mouse holes", () => {
  it('a Standard and a Large body walk straight through both holes', () => {
    const d = doc();
    for (const h of holes) {
      for (const look of ['core.ranger', 'core.knight']) {
        const match = new Match(d, undefined, 7);
        const me = match.addHuman('me', look)!;
        me.move = { pos: { ...h.start }, velY: 0, grounded: true };
        let seq = 0;
        let through = false;
        for (let t = 0; t < TICK_RATE * 3 && !through; t++) {
          match.queueInputs(me.slot, [{ seq: ++seq, forward: 1, right: 0, yaw: h.yaw, pitch: 0, buttons: 0 }]);
          match.step();
          // Out of the other hole: far from where it started.
          if (Math.hypot(me.move.pos.x - h.start.x, me.move.pos.z - h.start.z) > 6) through = true;
        }
        match.destroy();
        expect(through, `${look} through the ${h.name} hole`).toBe(true);
      }
    }
  });

  it('the skirting board stops at each hole: no board block crosses an opening', () => {
    const blocks = doc().entities.filter((e) => e.kind === 'block' && e.size[1] <= 1 && e.position[1] < 0.1);
    const crosses = (lo: number, hi: number, a: number, b: number) => lo < b && hi > a;
    // West opening z 26.6 to 29.4 by the wall x < 0.6; south opening x 68.6 to 71.4 by the wall z < 0.6.
    const west = blocks.filter((e) => e.kind === 'block' && e.position[0] < 0.6 && crosses(e.position[2] - e.size[2] / 2, e.position[2] + e.size[2] / 2, 26.6, 29.4));
    const south = blocks.filter((e) => e.kind === 'block' && e.position[2] < 0.6 && crosses(e.position[0] - e.size[0] / 2, e.position[0] + e.size[0] / 2, 68.6, 71.4));
    expect([...west, ...south].map((e) => e.id)).toEqual([]);
  });

  it('a bot routed through the holes goes through them', () => {
    // A bot in front of the west hole, sent for a gun just out of the south hole: the navmesh's portal link is the
    // short way, and it takes it.
    // (The map's own pickups are left out of this copy, so the gun is what it goes for.)
    const dd = doc();
    dd.entities = dd.entities.filter((e) => e.kind !== 'pickup');
    dd.entities.push({ id: 'zz_gun', kind: 'pickup', position: [70, 0, 3], item: 'core.weapon_shotgun', respawnSeconds: null } as MapDocument['entities'][number]);
    const match = new Match(loaded(dd), undefined, 7);
    const bot = match.addBot('b', { ...CORE_BOT_PROFILES[0]!, exploration: 100 }, undefined, false, { look: 'core.ranger' })!;
    bot.move = { pos: { x: 3, y: 0, z: 28 }, velY: 0, grounded: true };
    let through = false;
    for (let t = 0; t < TICK_RATE * 30 && !through && bot.alive; t++) {
      const before = bot.move.pos;
      match.step();
      const p = bot.move.pos;
      // A jump of more than 5 m in one tick near the south hole: it came out of the portal.
      if (Math.hypot(p.x - before.x, p.z - before.z) > 5 && Math.hypot(p.x - 70, p.z - 1) < 3) through = true;
    }
    match.destroy();
    expect(through).toBe(true);
  });
});
