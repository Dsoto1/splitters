import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RULES, MATCH_PLAY, TICK_RATE, createRng, initPhysics, type Vec3 } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { partyBonus, pickSpawn, type SpawnSpot } from '../src/sim/spawns.ts';
import { makeMap } from './helpers.ts';

// Free-for-all parties (docs/GAME_MODES.md "Parties"): members lean towards spawning near each other; safety first.
beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const W = MATCH_PLAY.spawnChoice;
const spot = (x: number, z: number): SpawnSpot => ({ pos: { x, y: 0, z }, yaw: 0, team: null });
const choice = (candidates: SpawnSpot[], seed: number, over: Partial<Parameters<typeof pickSpawn>[0]> = {}) => ({ tick: 1000, candidates, lastUsed: new Map<SpawnSpot, number>(), enemies: [] as Vec3[], occupants: [] as Vec3[], rng: createRng(seed), ...over });
const share = (pick: (seed: number) => number, want: number) => Array.from({ length: 200 }, (_, s) => pick(s + 1)).filter((i) => i === want).length / 200;

describe('free-for-all parties: the spawn choice', () => {
  const west = spot(0, 0);
  const west2 = spot(0, 12);
  const east = spot(80, 0);
  const east2 = spot(80, 12);
  const all = [west, west2, east, east2];
  const mate = { x: 6, y: 0, z: 6 };

  it('the bonus: partyBonus for each member within partyRange, up to partyMax', () => {
    expect(partyBonus(west, [mate])).toBe(W.partyBonus);
    expect(partyBonus(east, [mate])).toBe(0);
    expect(partyBonus(west, Array.from({ length: 6 }, () => mate))).toBe(W.partyMax * W.partyBonus);
    // Height counts: a member on a roof 40 m up isn't near.
    expect(partyBonus(west, [{ x: 0, y: 40, z: 0 }])).toBe(0);
  });

  it('with nobody about, a member spawns near the party (and without one, anywhere)', () => {
    const nearParty = (s: number) => [0, 1].includes(pickSpawn(choice(all, s, { party: [mate] })));
    const alone = (s: number) => [0, 1].includes(pickSpawn(choice(all, s)));
    expect(share((s) => (nearParty(s) ? 1 : 0), 1)).toBeGreaterThan(0.9);
    expect(share((s) => (alone(s) ? 1 : 0), 1)).toBeLessThan(0.75);
  });

  it('never at the price of safety: an enemy beside the party, or one with a clear line to its spawns, sends the member elsewhere', () => {
    const enemies = [{ x: 8, y: 0, z: 2 }];
    expect(share((s) => pickSpawn(choice(all, s, { party: [mate], enemies })), 0) + share((s) => pickSpawn(choice(all, s, { party: [mate], enemies })), 1)).toBe(0);
    // An enemy 45 m off with a clear line to the west spawns only.
    const far = [{ x: -45, y: 0, z: 6 }];
    const sees = (from: Vec3, to: Vec3) => Math.abs(from.x + 45) < 1 && Math.abs(to.x) < 1;
    for (let s = 1; s <= 50; s++) expect(pickSpawn(choice(all, s, { party: [mate], enemies: far, sees }))).toBeGreaterThanOrEqual(2);
    // A point much nearer an enemy than the safest stays out even with the whole party beside it.
    const close = [{ x: 16, y: 0, z: 6 }];
    const crowd = Array.from({ length: 3 }, () => mate);
    for (let s = 1; s <= 50; s++) expect(pickSpawn(choice([west, east], s, { party: crowd, enemies: close }))).toBe(1);
  });
});

describe('free-for-all parties: in a match', () => {
  const tiles = () => {
    const t = [];
    for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) t.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
    return t;
  };
  const kill = (m: Match, victim: Combatant, killer: Combatant) => (m as unknown as { kill: (v: Combatant, k: Combatant, w: string) => void }).kill(victim, killer, 'core.rifle');
  const place = (c: Combatant, x: number, z: number) => (c.move = { pos: { x, y: 0, z }, velY: 0, grounded: true });

  /** How often `a` respawns at the west end while its party mate `b` stands there (and a stranger far off east). */
  function westShare(party: boolean): number {
    const match = new Match(makeMap(tiles(), [[2, 0, 3], [2, 0, 12], [54, 0, 3], [54, 0, 12]]), { ...DEFAULT_RULES['core.deathmatch'], respawnDelayTicks: 1, scoreLimit: 0, timeLimitSeconds: 0 }, 3);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    const stranger = match.addHuman('c')!;
    if (party) a.party = b.party = 'PARTY01';
    for (let i = 0; i < 2; i++) match.step();
    let west = 0;
    const rounds = 30;
    for (let r = 0; r < rounds; r++) {
      place(b, 8, 7);
      place(stranger, 58, 30);
      // a falls in the middle (no fresh body at a spawn), well after its last spawn (no recent-use penalty).
      place(a, 28, 7);
      kill(match, a, stranger);
      for (let i = 0; i < TICK_RATE * 4 && !a.alive; i++) match.step();
      expect(a.alive).toBe(true);
      if (a.move.pos.x < 28) west++;
      for (let i = 0; i < TICK_RATE * 4; i++) match.step();
    }
    return west / rounds;
  }

  it('a member respawns near the party; the same match without the party is a toss-up; damage is unchanged', () => {
    expect(westShare(true)).toBeGreaterThan(0.85);
    expect(westShare(false)).toBeLessThan(0.75);
    const match = new Match(makeMap(tiles(), [[2, 0, 3], [54, 0, 3]]), DEFAULT_RULES['core.deathmatch']);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    a.party = b.party = 'PARTY01';
    // Still each other's opponents: a party is no team.
    expect(match.hostile(a, b)).toBe(true);
    expect(match.canHurt(a, b)).toBe(true);
  });
});
