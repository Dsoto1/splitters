/**
 * Deathmatch spawns spread out (owner, 2026-11-18: "we need better way to deploy bots/players in a DM. not all clumped
 * on one another, stagger them"): every player a spawn point of their own while any is free (sim/spawns.ts
 * spawnTaken), every point on the map in play when the shared ones are fewer than the players, and beside a point
 * (clear of everyone) once they're all taken (Match.besideSpot). Before, on Grid Rings with 12 players on 12 points,
 * four pairs started on the same point (0 m apart): the sight check ran on the best few points only, so an occupied
 * point it never looked at outscored the free ones it had.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CORE_BOT_PROFILES, DEFAULT_DEATHMATCH_RULES, createRng, initPhysics, loadMap, type MapDocument, type MatchRules, type Vec3 } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { SPAWN_TAKEN, pickSpawn, spawnTaken, type SpawnSpot } from '../src/sim/spawns.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

function map(id: string): MapDocument {
  const r = loadMap(readFileSync(new URL(`../../../maps/${id}.json`, import.meta.url), 'utf8'));
  if (!r.ok) throw new Error(`${id} invalid`);
  return r.map;
}

function filled(id: string, players: number, rules: MatchRules = DEFAULT_DEATHMATCH_RULES): Match {
  const match = new Match(map(id), { ...rules }, 3);
  match.addHuman('me');
  const profiles = Object.values(CORE_BOT_PROFILES);
  for (let i = 0; i < players - 1; i++) match.addBot(`b${i}`, profiles[i % profiles.length]!);
  match.step();
  return match;
}

const alive = (m: Match): Combatant[] => (m as unknown as { combatants(): Combatant[] }).combatants().filter((c) => c.alive);
const gap = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function closest(cs: Combatant[]): number {
  let min = Infinity;
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) min = Math.min(min, gap(cs[i]!.move.pos, cs[j]!.move.pos));
  return min;
}

describe('Deathmatch spawns spread out', () => {
  it('starts everyone on a point of their own while there are points enough', () => {
    for (const [id, players] of [['grid_rings', 12], ['void_yard', 12], ['sandgate', 12], ['crossroads', 12], ['phase0_arena', 8]] as const) {
      const m = filled(id, players);
      const cs = alive(m);
      expect(cs.length, id).toBe(players);
      // Points are at least ~4 m apart on these maps: nobody shares one.
      expect(closest(cs), id).toBeGreaterThan(3.5);
      m.destroy();
    }
  }, 120_000);

  it('more players than points: beside a point, clear of everyone, never on top of anyone', () => {
    for (const id of ['phase0_arena', 'blackout']) {
      const m = filled(id, 12);
      expect(closest(alive(m)), id).toBeGreaterThanOrEqual(SPAWN_TAKEN);
      m.destroy();
    }
  }, 120_000);

  it('respawns on a free point: a minute of a 12-bot Grid Rings, nobody spawns on someone', () => {
    const m = filled('grid_rings', 12);
    const was = new Map<number, boolean>();
    let respawns = 0;
    for (let t = 0; t < 60 * 60; t++) {
      m.step();
      const cs = alive(m);
      for (const c of (m as unknown as { combatants(): Combatant[] }).combatants()) {
        if (c.alive && was.get(c.slot) === false) {
          respawns++;
          for (const o of cs) if (o !== c) expect(gap(o.move.pos, c.move.pos)).toBeGreaterThanOrEqual(SPAWN_TAKEN - 0.2);
        }
        was.set(c.slot, c.alive);
      }
    }
    expect(respawns).toBeGreaterThan(20);
    m.destroy();
  }, 120_000);

  it('team modes keep to their own spawn sets, spread too', () => {
    const doc = map('canyon');
    const teamOf = new Map<string, string>();
    for (const e of doc.entities) if (e.kind === 'spawn' && e.faction) teamOf.set(`${e.position[0]},${e.position[2]}`, e.faction);
    const m = filled('canyon', 12, { ...DEFAULT_DEATHMATCH_RULES, mode: 'core.tdm' });
    const cs = alive(m);
    expect(cs.length).toBe(12);
    // (A squad spawn puts a teammate 1.4 m beside another, on purpose.)
    expect(closest(cs)).toBeGreaterThanOrEqual(1.35);
    const points = (m as unknown as { spawnPoints: SpawnSpot[] }).spawnPoints;
    for (const c of cs) {
      // On (or beside a teammate near) one of its own side's points.
      const near = points.filter((p) => p.team === c.faction).some((p) => gap(p.pos, c.move.pos) < 4);
      expect(near, `${c.slot} ${c.faction}`).toBe(true);
    }
    m.destroy();
  }, 120_000);

  it('pickSpawn never picks a point someone is on, or one given out this tick, while one is free', () => {
    const spot = (x: number): SpawnSpot => ({ pos: { x, y: 0, z: 0 }, yaw: 0, team: null });
    const pts = [spot(0), spot(10), spot(20)];
    const lastUsed = new Map<SpawnSpot, number>([[pts[1]!, 50]]);
    // Everyone sees everything (the sight penalty on every point checked): still the free one.
    for (let seed = 1; seed < 20; seed++) {
      const i = pickSpawn({ tick: 50, candidates: pts, lastUsed, enemies: [{ x: 0.5, y: 0, z: 0 }], occupants: [{ x: 0.5, y: 0, z: 0 }], sees: () => true, rng: createRng(seed) });
      expect(i).toBe(2);
    }
    expect(spawnTaken(pts[1]!, { occupants: [], lastUsed, tick: 50 })).toBe(true);
    expect(spawnTaken(pts[1]!, { occupants: [], lastUsed, tick: 51 })).toBe(false);
  });
});
