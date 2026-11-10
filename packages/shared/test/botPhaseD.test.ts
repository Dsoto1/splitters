// Bot AI Phase D (BOT_AI_PLAN.md "Phase D: polish and tools"; docs/BOTS.md): memory and callouts (item 1), holding a
// spot looks alive (item 2), skill tiers that feel human (item 3), the in-game debug view's frames (item 4) and bots
// reading the map's bot hints (item 5), headless.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, TICK_RATE, initPhysics, loadMap, rulesForMode, type BotHint, type MapDocument, type Vec3 } from '../src/index.ts';
import { BotBrain, CalloutBoard, CtfMode, EnemyMemory, Match, hintSpots, initNavigation, mapNavigation, sideHints, stageHint, withHintSpots, type BotDebugFrame, type VantageSpot } from '../src/match.ts';
import { parkourStats } from '../src/nav/parkour.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const maps = new Map<string, MapDocument>();
function map(id: string): MapDocument {
  let m = maps.get(id);
  if (!m) {
    const r = loadMap(readFileSync(new URL(`../../../maps/${id}.json`, import.meta.url), 'utf8'));
    if (!r.ok) throw new Error(`${id} failed to load`);
    maps.set(id, (m = r.map));
  }
  return structuredClone(m);
}

const at = (x: number, z: number, y = 0): Vec3 => ({ x, y, z });

describe('memory (item 1)', () => {
  it('keeps an enemy spot per enemy, refreshed in place, forgets the dead and lets old spots go', () => {
    const m = new EnemyMemory();
    m.note(3, at(10, 0), 100, 'seen');
    m.note(3, at(12, 1), 110, 'seen');
    m.note(-1, at(30, 30), 105, 'shot');
    m.note(-1, at(31, 30), 120, 'shot');
    expect(m.spots.length).toBe(2);
    expect(m.spots.find((s) => s.slot === 3)!.pos.x).toBe(12);
    expect(m.spots.find((s) => s.slot < 0)!.tick).toBe(120);
    // An older word of the same enemy doesn't replace a newer sighting.
    m.note(3, at(50, 50), 90, 'callout');
    expect(m.spots.find((s) => s.slot === 3)!.pos.x).toBe(12);
    // Where it expects someone, and the spot most worth a look (a shot counts most).
    expect(m.expected(at(14, 2), 130, 600)).toBe(true);
    expect(m.expected(at(40, 0), 130, 600)).toBe(false);
    expect(m.best(at(20, 15), 130, 600)!.source).toBe('shot');
    m.forget(3);
    expect(m.spots.some((s) => s.slot === 3)).toBe(false);
    m.expire(120 + 601, 600);
    expect(m.spots.length).toBe(0);
    // At most MEMORY_SIZE (8): the oldest goes.
    for (let i = 0; i < 12; i++) m.note(i, at(i * 10, 0), 200 + i, 'seen');
    expect(m.spots.length).toBe(8);
    expect(m.spots.some((s) => s.slot === 0)).toBe(false);
  });

  it('callouts: posted once every 2 s per caller and enemy, read by teammates in range, never by the caller', () => {
    const b = new CalloutBoard();
    b.post(1, 7, at(0, 0), 100);
    b.post(1, 7, at(1, 0), 110);
    b.post(2, 7, at(1, 0), 110);
    b.post(1, 7, at(2, 0), 100 + TICK_RATE * 2);
    expect(b.posted).toBe(3);
    const got: number[] = [];
    b.read(105, at(10, 0), 45, 3, (c) => got.push(c.by));
    expect(got.sort()).toEqual([1, 2]);
    const none: number[] = [];
    b.read(105, at(200, 0), 45, 3, (c) => none.push(c.by));
    b.read(0, at(0, 0), 45, 1, (c) => none.push(c.by));
    expect(none).toEqual([2]);
  });

  it('in a team match, a teammate hears a callout: memory of an enemy it never saw itself', () => {
    const m = map('sandgate');
    const match = new Match(m, { ...rulesForMode(m, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0, teamSizes: [4, 4] }, 5);
    for (let i = 0; i < 8; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal, true);
    let heard = false;
    for (let t = 0; t < TICK_RATE * 60 && !heard; t++) {
      match.step();
      for (const c of match.combatants()) if (c.bot?.enemies.spots.some((s) => s.source === 'callout')) heard = true;
    }
    match.destroy();
    expect(heard).toBe(true);
  }, 90_000);
});

describe('skill tiers that feel human (item 3)', () => {
  it('easy forgets sooner, hears less, turns to shots later and decides noisier than normal; hard the other way', () => {
    const { easy, normal, hard } = BOT_DIFFICULTIES;
    expect(easy.memorySeconds).toBeLessThan(normal.memorySeconds);
    expect(normal.memorySeconds).toBeLessThan(hard.memorySeconds);
    expect(easy.calloutRange).toBeLessThan(hard.calloutRange);
    expect(easy.shotTurnMs).toBeGreaterThan(normal.shotTurnMs);
    expect(normal.shotTurnMs).toBeGreaterThan(hard.shotTurnMs);
    expect(easy.decisionNoise).toBeGreaterThan(normal.decisionNoise);
    expect(hard.decisionNoise).toBe(0);
    expect(easy.prepared).toBeLessThan(hard.prepared);
    expect(easy.surprise).toBeGreaterThan(hard.surprise);
  });

  it('reaction varies sighting to sighting; slower from behind, quicker where it expected someone', () => {
    const mean = (diff: keyof typeof BOT_DIFFICULTIES, how: 'plain' | 'behind' | 'expected') => {
      const brain = new BotBrain(1, CORE_BOT_PROFILES[0]!, BOT_DIFFICULTIES[diff], 3);
      if (how === 'expected') brain.enemies.note(9, at(10, 10), 100, 'callout');
      const r = brain as unknown as { reactAfter(o: { slot: number; pos: Vec3 }, outOfView: boolean, tick: number): number };
      const all: number[] = [];
      for (let i = 0; i < 200; i++) all.push(r.reactAfter({ slot: 9, pos: at(11, 10) }, how === 'behind', 110));
      return { mean: all.reduce((a, b) => a + b, 0) / all.length, spread: Math.max(...all) - Math.min(...all) };
    };
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const plain = mean(d, 'plain');
      expect(plain.spread).toBeGreaterThan(0);
      expect(mean(d, 'behind').mean).toBeGreaterThan(plain.mean);
      if (d !== 'easy') expect(mean(d, 'expected').mean).toBeLessThan(plain.mean * 0.9);
    }
    expect(mean('easy', 'plain').mean).toBeGreaterThan(mean('normal', 'plain').mean);
    expect(mean('normal', 'plain').mean).toBeGreaterThan(mean('hard', 'plain').mean);
  });
});

describe('holding a spot looks alive (item 2)', () => {
  it('a defender scans its spot one angle at a time (several angles, each dwelt on), moving between places', () => {
    const m = map('bunker_cross');
    const match = new Match(m, { ...rulesForMode(m, 'core.ctf'), scoreLimit: 0, timeLimitSeconds: 0, teamSizes: [2, 2] }, 3);
    const ctf = match.mode as CtfMode;
    const team = ctf.flags[0]!.team;
    for (let i = 0; i < 2; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i + 1]!, BOT_DIFFICULTIES.normal, true, { team });
    match.step();
    const defender = match.combatants().find((c) => ctf.botPlan.roles.get(c.slot) === 'defend')!;
    const base = ctf.flagOf(team)!.base;
    let most = 0;
    const sectors = new Set<number>();
    const spots = new Set<string>();
    for (let t = 0; t < TICK_RATE * 40; t++) {
      match.step();
      if (!defender.alive || Math.hypot(defender.move.pos.x - base.x, defender.move.pos.z - base.z) > 10) continue;
      const w = defender.bot!.debugInfo().watch;
      if (w) most = Math.max(most, w.looks.length);
      sectors.add(Math.round(((defender.yaw % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 4)) % 8);
      if (t % TICK_RATE === 0) spots.add(`${Math.round(defender.move.pos.x / 2)},${Math.round(defender.move.pos.z / 2)}`);
    }
    match.destroy();
    expect(most).toBeGreaterThanOrEqual(2);
    expect(sectors.size).toBeGreaterThanOrEqual(3);
    expect(spots.size).toBeGreaterThanOrEqual(3);
  }, 60_000);
});

describe('the debug view (item 4)', () => {
  it("a frame lists every bot with its state, route, scores and why it stopped, and collects failed searches", () => {
    const m = map('sandgate');
    const match = new Match(m, { ...rulesForMode(m, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0, teamSizes: [3, 3] }, 2);
    for (let i = 0; i < 6; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i]!, BOT_DIFFICULTIES.normal, true);
    for (let t = 0; t < TICK_RATE * 8; t++) match.step();
    let f: BotDebugFrame = match.botDebugFrame();
    expect(f.bots.length).toBe(6);
    for (const b of f.bots) {
      expect(typeof b.state).toBe('string');
      expect(typeof b.doing).toBe('string');
      expect(b.team).not.toBeNull();
      expect(b.skill).toBe('normal');
    }
    expect(f.bots.some((b) => b.path.length > 0)).toBe(true);
    expect(f.bots.some((b) => Object.keys(b.scores).length > 0)).toBe(true);
    // A failed search (as followPathNow records one) shows on the next frame, once.
    const bot = match.combatants().find((c) => c.bot)!.bot!;
    const rec = bot as unknown as { lastNoRoute: { goal: Vec3; from: Vec3 } | null; pathFailures: number };
    rec.lastNoRoute = { goal: at(1, 2, 3), from: at(4, 5, 6) };
    rec.pathFailures++;
    f = match.botDebugFrame();
    const n = f.failed.length;
    expect(f.failed.some((x) => x.goal.x === 1 && x.from.x === 4)).toBe(true);
    expect(match.botDebugFrame().failed.length).toBe(n);
    match.destroy();
  }, 60_000);
});

describe('bots read the map bot hints (item 5)', () => {
  const hint = (h: Partial<BotHint> & Pick<BotHint, 'kind' | 'position'>): BotHint => ({ id: `hint_${h.kind}_${h.position.join('_')}`, radius: 2, ...h }) as BotHint;

  it('sniper and camp hints are vantage spots (their team only), replacing computed ones beside them', () => {
    const ray = () => 50;
    const hinted = hintSpots([hint({ kind: 'sniper', position: [10, 0, 10], yaw: 1 }), hint({ kind: 'camp', position: [40, 0, 0], team: 'red' }), hint({ kind: 'choke', position: [0, 0, 0] })], ray);
    expect(hinted.map((s) => s.kind)).toEqual(['sniper', 'camp']);
    expect(hinted[0]!.yaw).toBe(1);
    expect(hinted[1]!.team).toBe('red');
    const computed: VantageSpot[] = [
      { pos: at(12, 12), kind: 'sniper', yaw: 0, reach: 60, height: 3, score: 2 },
      { pos: at(80, 80), kind: 'sniper', yaw: 0, reach: 60, height: 3, score: 2 },
    ];
    const all = withHintSpots(computed, hinted);
    expect(all.length).toBe(3);
    expect(all.some((s) => s.pos.x === 12)).toBe(false);
    expect(withHintSpots(computed, [])).toBe(computed);
  });

  it('a staging hint by a corridor is where its group gathers; one off the route, or nearer the goal, is not', () => {
    const line = Array.from({ length: 21 }, (_, i) => at(i * 5, 0));
    const computed = at(60, 0);
    const own = sideHints([hint({ kind: 'staging', position: [50, 0, 6] }), hint({ kind: 'staging', position: [55, 0, 40] }), hint({ kind: 'staging', position: [62, 0, 2], team: 'blue' })], 'red');
    expect(own.staging.length).toBe(2);
    expect(stageHint(line, computed, own.staging)).toEqual(at(50, 6));
    expect(stageHint(line, computed, [])).toBeNull();
    // Nearer the goal than the computed spot (past its radius): not a gathering place.
    expect(stageHint(line, computed, sideHints([hint({ kind: 'staging', position: [90, 0, 0] })], null).staging)).toBeNull();
  });

  it('a jump link hint becomes a parkour link when the movement makes it, and not when it cannot', () => {
    const tiles: MapDocument['classicStructure']['tiles'] = [];
    for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) tiles.push({ id: `yard${x}${z}`, tile: 'core.yard', x, y: z, z: 0, rotation: 0 });
    const doc = makeMap(tiles, [
      [0, 2, 8],
      [15, 2, 8],
    ]);
    const block = (id: string, center: [number, number], size: [number, number, number]) => ({ id, kind: 'block', position: [center[0], 0, center[1]], size, yaw: 0, material: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.5, respawnSeconds: null, health: 100 }) as MapDocument['entities'][number];
    doc.entities.push(block('west', [1, 8], [10, 2, 24]), block('east', [14.5, 8], [11, 2, 24]));
    doc.botHints = [
      { id: 'hint_jump_ok', kind: 'jump', position: [5, 2, 14], to: [10, 2, 14], radius: 1 },
      { id: 'hint_jump_far', kind: 'jump', position: [0, 2, 4], to: [19, 2, 4], radius: 1 },
    ] as BotHint[];
    const r = loadMap(doc);
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    const a = mapNavigation(r.map);
    expect(parkourStats.hints.given).toBe(2);
    expect(parkourStats.hints.made).toBe(1);
    expect(a.nav.parkour.some((l) => l.kind === 'gap' && Math.abs(l.start.z - 14) < 1.5 && l.start.x < 6 && l.end.x > 9)).toBe(true);
    a.physics.free();
    a.nav.destroy();
  }, 60_000);

  it('a map with no hints plays as before: no hinted spots, no staging, no jump candidates', () => {
    expect(hintSpots([], () => 10)).toEqual([]);
    expect(sideHints([], 'red')).toEqual({ chokes: [], staging: [] });
  });
});
