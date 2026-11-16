import { writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, BUTTON_USE, CORE_BOT_PROFILES, DEFAULT_RULES, initPhysics, type MapDocument, type MapEntity, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** A wide yard: spawns at (10, 10) and (80, 80), a Troop Buggy at (40, 40). */
function yard(): MapDocument {
  const tiles = [];
  for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[10, 0, 10], [80, 0, 80]]);
  return { ...map, entities: [...map.entities, { id: 'mount_0', kind: 'mount' as const, position: [40, 0, 40], model: 'troop_buggy', yaw: 0, faction: null, respawnSeconds: null } as MapEntity] };
}

/**
 * Owner, 2026-11-15, driving the Troop Buggy on Rockfall Canyon: "bots are not shooting at me ... they didn't see me
 * until i shot at them". Bots only knew of a vehicle they could see (in their view, or within 6 m): gunfire was a
 * noise, an engine wasn't. A driven vehicle is now heard (Match.noteCombat), so an enemy walking away from it turns.
 */
describe('bots hear a driven vehicle', () => {
  for (const drive of ['rigid', 'classic'] as const) {
    it(`an enemy bot walking away 22 m off turns on a ${drive} buggy driven nearby and fights it`, () => {
      const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], scoreLimit: 0, timeLimitSeconds: 0, teamSizes: [1, 1] } as never, 1, { drive });
      const me = match.addHuman('me')! as Combatant;
      const teams = (match as unknown as { teams: { id: string }[] }).teams;
      const bot = match.addBot('b', CORE_BOT_PROFILES[0]!, BOT_DIFFICULTIES.normal, false, { team: teams.find((t) => t.id !== me.faction)!.id })! as Combatant;
      let seq = 0;
      const send = (i: Partial<PlayerInput> = {}) => match.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: me.yaw, pitch: 0, buttons: 0, ...i }]);
      for (let k = 0; k < 400; k++) {
        send();
        match.step();
      }
      me.move = { pos: { x: 42.4, y: 0.3, z: 40 }, velY: 0, grounded: true };
      send({ buttons: BUTTON_USE });
      match.step();
      expect(me.mount).toBeTruthy();
      // Behind it, heading off toward the far spawn.
      bot.move = { pos: { x: 40, y: 0, z: 62 }, velY: 0, grounded: true };
      let shots = 0;
      for (let k = 0; k < 900; k++) {
        send({ forward: 0.4, right: 0.6 });
        for (const e of match.step() as { e: string; s?: number }[]) if (e.e === 'shot' && e.s === bot.slot) shots++;
        me.health = 100;
        bot.health = 100;
      }
      expect(shots).toBeGreaterThan(5);
      // Out of the buggy, on foot beside it: they keep on at you, not at the empty buggy (owner: "after i got out ...
      // they didn't see me until i shot at them"). Its magazine is full again (the buggy took the last ones).
      send({ buttons: BUTTON_USE });
      match.step();
      expect(me.mount).toBeFalsy();
      for (const w of bot.weapons.values()) w.mag = Math.max(w.mag, 30);
      let on = -1;
      let hits = 0;
      for (let k = 0; k < 300; k++) {
        send();
        const before = me.health;
        match.step();
        if (me.health < before) hits++;
        if (on < 0 && (bot as unknown as { bot: { targetSlot?: number } }).bot.targetSlot === me.slot) on = k;
        me.health = 100;
        bot.health = 100;
      }
      if (process.env.DRIVE_TRACE) writeFileSync(`${process.env.DRIVE_TRACE}/out-of-buggy-${drive}.txt`, `on foot: the bot on you after ${(on / 60).toFixed(2)} s, hit ${hits} times in 5 s`);
      expect(on).toBeGreaterThanOrEqual(0);
      expect(on).toBeLessThan(60);
      expect(hits).toBeGreaterThan(3);
    }, 60_000);
  }
});
