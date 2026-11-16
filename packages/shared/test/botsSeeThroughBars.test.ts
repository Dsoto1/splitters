import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, DEFAULT_RULES, buildMapGeometry, initPhysics, propBoxes, type MapDocument, type MapEntity, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/**
 * Owner, 2026-11-16: "bots wont target me or others when on other side of a fence or bars/door with bars". A bot sees
 * someone by one sight line from its eye to theirs, and bars, a barred gate's bars and a fence's posts and rails were
 * solid to it (the tall fence's middle rail sits at eye height): about a third of the lines across bars were blocked,
 * and a blocked line stays blocked while both stand still. Its "would my round get there" check stopped on a bar too.
 * Those pieces are lattices now (map/edgeShapes.ts edgeLattice, PhysicsWorld GROUP_LATTICE): never in a sight line,
 * left out of a bot's own check, still solid to bodies and to the rounds that strike them.
 */
type Obstacle = 'bars' | 'bars_gate' | 'fence' | 'kit.fence.chainlink' | 'kit.fence.iron';

/** A yard with a room at the middle whose east side (x = 4) is `o` (or, for a kit fence, open with the fence along it). */
function yard(o: Obstacle): MapDocument {
  const tiles = [];
  for (let x = -3; x < 4; x++) for (let y = -3; y < 4; y++) if (x !== 0 || y !== 0) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const kit = o.startsWith('kit.');
  tiles.push({ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 as const, edges: { '0,0,0:E': kit ? 'open' : o } } as never);
  const map = makeMap(tiles as never, [[-20, 0, -20], [20, 0, 20]]);
  if (!kit) return map;
  // Fence panels along x = 4.2, turned to run north-south.
  const fences = [-3, 0, 3].map((z, i) => ({ id: `fence${i}`, kind: 'prop', model: o, position: [4.2, 0, z], yaw: Math.PI / 2, scale: 1, solid: true, tint: null }) as unknown as MapEntity);
  return { ...map, entities: [...map.entities, ...fences] };
}

describe('bots see and shoot through bars and fences', () => {
  for (const o of ['bars', 'bars_gate', 'fence', 'kit.fence.chainlink', 'kit.fence.iron'] as const) {
    it(`${o}: every sight line through it is clear, it still stops bodies, and a bot fights someone on the other side`, () => {
      const map = yard(o);
      // The pieces are lattices.
      const pieces = o.startsWith('kit.') ? propBoxes(map).filter((b) => b.sourceId.startsWith('fence')) : buildMapGeometry(map).filter((b) => b.sourceId === 'room' && b.min[0] > 3.7);
      expect(pieces.length).toBeGreaterThan(0);
      expect(pieces.every((b) => b.lattice)).toBe(true);
      const match = new Match(map, { ...DEFAULT_RULES['core.tdm'], scoreLimit: 0, timeLimitSeconds: 0, teamSizes: [1, 1] } as never, 1);
      const physics = (match as unknown as { physics: { lineOfSight(a: unknown, b: unknown): boolean; raycastWorld(o: unknown, d: unknown, l: number): number | null } }).physics;
      let clear = 0;
      for (let i = 0; i < 100; i++) {
        const a = { x: 1 - (i % 5), y: 1.6, z: -3 + ((i * 7) % 60) / 10 };
        const b = { x: 6 + ((i * 3) % 7), y: 1.6, z: -3 + ((i * 13) % 60) / 10 };
        if (physics.lineOfSight(a, b)) clear++;
      }
      expect(clear).toBe(100);
      // Still solid: a walk straight at it from inside stops at it (a ray along the floor at knee height meets it).
      expect(physics.raycastWorld({ x: 2, y: o === 'fence' ? 0.1 : 0.06, z: o === 'bars_gate' ? 2.65 : 0.05 }, { x: 1, y: 0, z: 0 }, 6)).not.toBeNull();

      const me = match.addHuman('me')! as Combatant;
      const teams = (match as unknown as { teams: { id: string }[] }).teams;
      const bot = match.addBot('b', CORE_BOT_PROFILES[0]!, BOT_DIFFICULTIES.normal, false, { team: teams.find((t) => t.id !== me.faction)!.id })! as Combatant;
      let seq = 0;
      const send = () => match.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: me.yaw, pitch: 0, buttons: 0 } as PlayerInput]);
      for (let k = 0; k < 200; k++) {
        send();
        match.step();
      }
      // Four stand-offs, 3 m inside and 5 m outside; both stand still.
      let fought = 0;
      // Straight across onto a bar or post (a sight line along it meets the piece), and two at a slant.
      const on = o === 'bars' ? [0.05, 1.25] : o === 'bars_gate' ? [2.05, -2.05] : [0, 1];
      for (const [bz, mz] of [[on[0]!, on[0]!], [on[1]!, on[1]!], [-1.3, 0.4], [2, 2.2]] as const) {
        me.move = { pos: { x: 9, y: 0, z: mz }, velY: 0, grounded: true };
        bot.move = { pos: { x: 1, y: 0, z: bz }, velY: 0, grounded: true };
        // Looking that way (it is put there, not walked there).
        (bot as unknown as { bot: { yaw: number } }).bot.yaw = Math.atan2(9 - 1, mz - bz);
        let shots = 0;
        let last = { ...bot.move.pos };
        for (let k = 0; k < 240; k++) {
          send();
          for (const e of match.step() as { e: string; s?: number }[]) if (e.e === 'shot' && e.s === bot.slot) shots++;
          me.health = 100;
          bot.health = 100;
          for (const w of bot.weapons.values()) w.reserve = Math.max(w.reserve, 90);
          // It may go round by the room's doors, or up to the bars, never through them (a barred gate's own gateway aside).
          const p = bot.move.pos;
          if (last.x < 3.8 && p.x > 3.8 && !(o === 'bars_gate' && Math.abs(p.z) < 1.5)) expect(Math.abs(p.z)).toBeGreaterThan(3.8);
          last = { ...p };
        }
        if (shots > 0) fought++;
      }
      expect(fought).toBe(4);
    }, 60_000);
  }
});
