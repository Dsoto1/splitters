import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_FIRE, DEFAULT_RULES, MATCH_PLAY, TICK_RATE, createRng, initPhysics, spawnProtection, type GameEvent, type PlayerInput, type Vec3 } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { SPAWN_DEATH_TICKS, SpawnSides, pickSpawn, spawnScore, type SpawnSpot } from '../src/sim/spawns.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const spot = (x: number, z: number, team: string | null = null): SpawnSpot => ({ pos: { x, y: 0, z }, yaw: 0, team });
const choice = (candidates: SpawnSpot[], over: Partial<Parameters<typeof pickSpawn>[0]> = {}) => ({ tick: 1000, candidates, lastUsed: new Map<SpawnSpot, number>(), enemies: [] as Vec3[], occupants: [] as Vec3[], rng: createRng(1), ...over });
const W = MATCH_PLAY.spawnChoice;

describe('spawn scoring (content/match-play.json spawnChoice)', () => {
  it('scores distance to the nearest enemy up to enemyRange, a little less far past farRange', () => {
    const near = spot(0, 0);
    const mid = spot(0, 40);
    const far = spot(0, 120);
    const c = choice([near, mid, far], { enemies: [{ x: 0, y: 0, z: -10 }] });
    expect(spawnScore(near, c)).toBeCloseTo(10, 5);
    expect(spawnScore(mid, c)).toBe(W.enemyRange);
    // 130 m off: past farRange, out of the game.
    expect(spawnScore(far, c)).toBeLessThan(spawnScore(mid, c));
    expect(spawnScore(far, c)).toBeGreaterThan(spawnScore(near, c));
  });

  it('a fresh death nearby costs up to deathPenalty, less with distance and age, at most twice however many fell', () => {
    const sp = spot(0, 0);
    const base = spawnScore(sp, choice([sp]));
    const now = (deaths: { pos: Vec3; tick: number }[]) => spawnScore(sp, choice([sp], { deaths }));
    expect(now([{ pos: { x: 0, y: 0, z: 0 }, tick: 1000 }])).toBeCloseTo(base - W.deathPenalty, 5);
    expect(now([{ pos: { x: W.deathRadius / 2, y: 0, z: 0 }, tick: 1000 }])).toBeCloseTo(base - W.deathPenalty / 2, 5);
    expect(now([{ pos: { x: 0, y: 0, z: 0 }, tick: 1000 - SPAWN_DEATH_TICKS / 2 }])).toBeCloseTo(base - W.deathPenalty / 2, 5);
    expect(now([{ pos: { x: 0, y: 0, z: 0 }, tick: 1000 - SPAWN_DEATH_TICKS }])).toBe(base);
    expect(now([{ pos: { x: W.deathRadius + 1, y: 0, z: 0 }, tick: 1000 }])).toBe(base);
    const pile = Array.from({ length: 10 }, () => ({ pos: { x: 0, y: 0, z: 0 }, tick: 1000 }));
    expect(now(pile)).toBeCloseTo(base - 2 * W.deathPenalty, 5);
  });

  it('picks at random among the safest few: never a much worse one, and not always the same', () => {
    // Four equally safe points and one beside an enemy.
    const safe = [spot(0, 0), spot(0, 20), spot(20, 0), spot(20, 20)];
    const bad = spot(100, 100);
    const enemies = [{ x: 60, y: 0, z: 60 }, { x: 104, y: 0, z: 100 }];
    const seen = new Set<number>();
    const rng = createRng(5);
    for (let k = 0; k < 40; k++) {
      const i = pickSpawn(choice([...safe, bad], { enemies, rng }));
      expect(i).not.toBe(4);
      seen.add(i);
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(seen.size).toBeLessThanOrEqual(W.safeFew);
    // One clearly safest (the others well within an enemy's reach): always it.
    const lone = [spot(0, 0), spot(50, 50), spot(52, 50), spot(50, 52)];
    for (let k = 0; k < 10; k++) expect(pickSpawn(choice(lone, { enemies: [{ x: 51, y: 0, z: 51 }], rng }))).toBe(0);
  });

  it('an enemy sight line rules a point out of the few; teammates out of a fight pull toward theirs', () => {
    const a = spot(0, 0);
    const b = spot(0, 30);
    const sees = (_from: Vec3, to: Vec3) => Math.abs(to.z) < 1;
    for (let k = 0; k < 10; k++) expect(pickSpawn(choice([a, b], { enemies: [{ x: -40, y: 0, z: 15 }], sees, rng: createRng(k) }))).toBe(1);
    const mates = [{ x: 1, y: 0, z: 31 }, { x: -1, y: 0, z: 29 }];
    expect(spawnScore(b, choice([a, b], { mates }))).toBe(spawnScore(a, choice([a, b], { mates })) + 2 * W.mateBonus);
  });

  it('team modes on shared spawns: each side keeps its end of the map (no spawn flips)', () => {
    const sides = new SpawnSides();
    for (let k = 0; k < 5; k++) {
      sides.note('a', { x: -40, y: 0, z: 0 });
      sides.note('b', { x: 40, y: 0, z: 0 });
    }
    const west = spot(-35, 0);
    const east = spot(35, 0);
    // No enemy in range: side a keeps the west, b the east.
    const forA = choice([west, east], { side: sides.of('a') });
    const forB = choice([west, east], { side: sides.of('b') });
    expect(spawnScore(west, forA) - spawnScore(east, forA)).toBe(2 * W.sideMax);
    expect(spawnScore(east, forB) - spawnScore(west, forB)).toBe(2 * W.sideMax);
    // But safety still decides: an enemy at the west end sends a to the east.
    expect(pickSpawn(choice([west, east], { side: sides.of('a'), enemies: [{ x: -33, y: 0, z: 0 }] }))).toBe(1);
  });
});

// ------------------------------------------------------------------ spawn protection

class Driver {
  seq = 0;
  constructor(readonly match: Match) {}
  input(c: Combatant, i: Partial<PlayerInput>): void {
    this.match.queueInputs(c.slot, [{ seq: ++this.seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
  }
  run(n: number, each: () => void = () => {}): GameEvent[] {
    const out: GameEvent[] = [];
    for (let i = 0; i < n; i++) {
      each();
      out.push(...this.match.step());
    }
    return out;
  }
}
const kill = (m: Match, victim: Combatant, killer: Combatant) => (m as unknown as { kill: (v: Combatant, k: Combatant, w: string) => void }).kill(victim, killer, 'core.rifle');
const hurt = (m: Match, victim: Combatant, amount: number, by: Combatant | null) => (m as unknown as { damage(v: Combatant, a: number, k: Combatant | null, w: string): void }).damage(victim, amount, by, 'core.pistol');

function yard(mode: 'core.deathmatch' | 'core.tdm') {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const match = new Match(makeMap(tiles, [[2, 0, 3], [2, 0, 12], [37, 0, 3], [37, 0, 12]]), { ...DEFAULT_RULES[mode], respawnDelayTicks: 1, scoreLimit: 0 });
  const d = new Driver(match);
  return { match, d, a: match.addHuman('a')!, b: match.addHuman('b')! };
}

describe('spawn protection', () => {
  it('Deathmatch and Team Deathmatch: 3 s from the data; other modes none; a rule overrides', () => {
    expect(spawnProtection({ mode: 'core.deathmatch' })).toBe(MATCH_PLAY.spawnProtection['core.deathmatch']);
    expect(spawnProtection({ mode: 'core.tdm' })).toBe(MATCH_PLAY.spawnProtection['core.tdm']);
    expect(spawnProtection({ mode: 'core.deathmatch' })).toBeGreaterThanOrEqual(2);
    expect(spawnProtection({ mode: 'core.deathmatch' })).toBeLessThanOrEqual(3);
    expect(spawnProtection({ mode: 'core.ctf' })).toBe(0);
    expect(spawnProtection({ mode: 'core.tdm', roulette: true })).toBe(MATCH_PLAY.spawnProtection['core.roulette']);
    expect(spawnProtection({ mode: 'core.deathmatch', spawnProtection: 0 })).toBe(0);
  });

  for (const mode of ['core.deathmatch', 'core.tdm'] as const) {
    it(`${mode}: a respawn is shielded until they fire, then hits land; it runs out by itself`, () => {
      const { match, d, a, b } = yard(mode);
      d.run(2);
      // The round's opening lives: none.
      expect(match.shielded(a)).toBe(false);
      kill(match, a, b);
      kill(match, b, a);
      d.run(3);
      expect(a.alive && b.alive).toBe(true);
      expect(match.shielded(a)).toBe(true);
      const before = a.health;
      hurt(match, a, 40, b);
      expect(a.health).toBe(before);
      // Its own fall or grenade still hurts (no attacker).
      hurt(match, a, 5, null);
      expect(a.health).toBe(before - 5);
      // Firing drops it at once.
      d.run(1, () => d.input(a, { buttons: BUTTON_FIRE }));
      expect(match.shielded(a)).toBe(false);
      hurt(match, a, 40, b);
      expect(a.health).toBeLessThan(before - 5);
      // b never fired: it runs out on its own.
      expect(match.shielded(b)).toBe(true);
      d.run(Math.round(spawnProtection(match.rules) * TICK_RATE) + 2);
      expect(match.shielded(b)).toBe(false);
    });
  }

  it('someone joining mid-round is shielded from their first life', () => {
    const { match, d } = yard('core.deathmatch');
    d.run(TICK_RATE * 3);
    const late = match.addHuman('late')!;
    d.run(2);
    expect(late.alive).toBe(true);
    expect(match.shielded(late)).toBe(true);
  });
});
