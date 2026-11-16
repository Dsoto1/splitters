import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, BUTTON_FIRE, BUTTON_USE, CORE_BOT_PROFILES, DEFAULT_RULES, initPhysics, lookAngles, type MapDocument, type MapEntity, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** A wide yard: spawns at (10, 10) and (80, 80), a Troop Buggy at (40, 40) facing +z. */
function yard(): MapDocument {
  const tiles = [];
  for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[10, 0, 10], [80, 0, 80]]);
  return { ...map, entities: [...map.entities, { id: 'mount_0', kind: 'mount' as const, position: [40, 0, 40], model: 'troop_buggy', yaw: 0, faction: null, respawnSeconds: null } as MapEntity] };
}

type Ev = { e: string; s?: number; hit?: (number | null)[] | number | null };
const hitsOn = (events: Ev[], shooters: Set<number>, victim: number): number => {
  let n = 0;
  for (const e of events) {
    if ((e.e !== 'shot' && e.e !== 'impact') || !shooters.has(e.s!)) continue;
    for (const h of Array.isArray(e.hit) ? e.hit : [e.hit]) if (h === victim) n++;
  }
  return n;
};

function driving(drive: 'rigid' | 'classic', bots: number) {
  const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], scoreLimit: 0, timeLimitSeconds: 0, teamSizes: [1, Math.max(1, bots)] } as never, 1, { drive });
  const me = match.addHuman('me')! as Combatant;
  const teams = (match as unknown as { teams: { id: string }[] }).teams;
  const enemy = teams.find((t) => t.id !== me.faction)!.id;
  const list = Array.from({ length: bots }, (_, i) => match.addBot(`b${i}`, CORE_BOT_PROFILES[i]!, BOT_DIFFICULTIES.normal, false, { team: enemy })! as Combatant);
  let seq = 0;
  const send = (i: Partial<PlayerInput> = {}) => match.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: me.yaw, pitch: 0, buttons: 0, ...i }]);
  for (let k = 0; k < 400; k++) {
    send();
    match.step();
  }
  me.move = { pos: { x: 42.4, y: 0.3, z: 40 }, velY: 0, grounded: true };
  send({ buttons: BUTTON_USE });
  match.step();
  expect(me.mount?.seat).toBe(0);
  const mount = (match as unknown as { mounts: { health: number }[] }).mounts[0]!;
  return { match, me, bots: list, send, mount, enemy };
}

/**
 * Owner, 2026-11-16, in the Troop Buggy: "for the bots not being able to shoot me, i notice it is only me, the driver,
 * my passengers get shot, and when i get out i get shot ... they had surrounded my buggy ... i sat and waited and they
 * left me alone and went off". The buggy's collision box (1.6 m tall, over an open tube frame) had a seated rider's
 * chest inside it, so every round aimed at the driver's middle stopped in the box (it hurt the buggy, never the
 * driver); only a head shot got through. And a bot with only a rifle counted itself outgunned by any vehicle: it took
 * cover (often beside the buggy) or went off for a launcher. Riders of an open vehicle are exposed now (Match.openHull);
 * only a sealed vehicle's crew (the Tank's) is out of reach of bullets.
 */
describe('bots shoot the driver of an open vehicle', () => {
  for (const drive of ['rigid', 'classic'] as const) {
    it(`three bots round a stopped ${drive} buggy hit its driver`, () => {
      const { match, me, bots, send, mount } = driving(drive, 3);
      // Round it, close (they had surrounded it).
      const spots: [number, number][] = [[40, 45.5], [44.5, 42], [36, 36.5]];
      bots.forEach((b, i) => {
        b.move = { pos: { x: spots[i]![0], y: 0, z: spots[i]![1] }, velY: 0, grounded: true };
        b.yaw = Math.atan2(40 - spots[i]![0], 40 - spots[i]![1]);
      });
      const shooters = new Set(bots.map((b) => b.slot));
      let onDriver = 0;
      let engaged = 0;
      for (let k = 0; k < 600; k++) {
        send();
        onDriver += hitsOn(match.step() as Ev[], shooters, me.slot);
        // Nobody dies or runs dry: this counts rounds, not outcomes.
        me.health = 100;
        mount.health = 450;
        for (const b of bots) {
          b.health = 100;
          for (const w of b.weapons.values()) w.reserve = Math.max(w.reserve, 90);
          if ((b as unknown as { bot: { targetSlot: number | null } }).bot.targetSlot === me.slot) engaged++;
        }
      }
      // Before: 26-30 rounds on the driver in 10 s (head shots over the box), the rest into the buggy; now 51-52.
      expect(onDriver).toBeGreaterThan(40);
      // And they keep at it (not off to hide or fetch a launcher): over half the bot-ticks on the driver.
      expect(engaged).toBeGreaterThan(600 * 3 * 0.5);
    }, 60_000);
  }

  it('a player can shoot a driver through the open frame', () => {
    const { match, me } = driving('rigid', 0);
    const foe = match.addHuman('foe')! as Combatant;
    foe.faction = (match as unknown as { teams: { id: string }[] }).teams.find((t) => t.id !== me.faction)!.id;
    let seq = 0;
    for (let k = 0; k < 30; k++) match.step();
    foe.move = { pos: { x: 30, y: 0, z: 40.3 }, velY: 0, grounded: true };
    // The driver's chest: the seat cushion (0.8 m up) plus the middle of a seated body; inside the buggy's box.
    const chest = { x: me.move.pos.x, y: me.move.pos.y + 0.6, z: me.move.pos.z };
    const look = lookAngles({ x: 30, y: 1.6, z: 40.3 }, chest);
    let hits = 0;
    for (let k = 0; k < 240; k++) {
      // A shot every half second (the spread settles in between).
      match.queueInputs(foe.slot, [{ seq: ++seq, forward: 0, right: 0, ...look, buttons: k % 30 === 0 ? BUTTON_FIRE : 0 }]);
      hits += hitsOn(match.step() as Ev[], new Set([foe.slot]), me.slot);
      me.health = 100;
    }
    // Before: 0 of 8 (every round stopped in the buggy's box).
    expect(hits).toBeGreaterThanOrEqual(6);
  }, 60_000);
});
