// MapMaker's map tests (overhaul Phase 4, items 1 and 2): heatmap binning (editor/heatmap.ts), the spawn exposure and
// sightline maths (editor/spawnExposure.ts), the stuck and failed-search trace bot-report shares (bots/botTrace.ts),
// and a short headless bot test run and exposure check on a real map (editor/mapTest.ts).
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { EXPOSED_SHARE, HEAT_BAND, botTestLines, addHeat, exposureIssues, heatCellFor, heatCells, heatColor, heatGrid, heatTotal, initPhysics, loadMap, longSightlines, samplePlaces, spawnExposure, type Vec3 } from '../src/index.ts';
import { BotTestRun, BotTrace, botTestRules, initNavigation, mapExposure } from '../src/match.ts';

describe('heatmap binning', () => {
  it('bins points into cells from above, keeping the mean height', () => {
    const g = heatGrid(2);
    expect(addHeat(g, 0.1, 0, 0.1)).toBe(true);
    addHeat(g, 1.9, 1, 1.9);
    addHeat(g, 2.1, 0, 0.5);
    addHeat(g, -0.1, 0, 0.5, 3);
    const cells = heatCells(g);
    expect(cells.length).toBe(3);
    // The busiest first: the -2..0 cell (weight 3), then the 0..2 cell (2), then 2..4 (1).
    expect(cells.map((c) => [c.x, c.z, c.value])).toEqual([
      [-1, 1, 3],
      [1, 1, 2],
      [3, 1, 1],
    ]);
    expect(cells[1]!.y).toBeCloseTo(0.5);
    expect(cells[0]!.share).toBe(1);
    expect(cells[2]!.share).toBeCloseTo(1 / 3);
    expect(heatTotal(g)).toBe(6);
  });

  it('keeps two floors over the same ground apart', () => {
    const g = heatGrid(2);
    addHeat(g, 1, 0.2, 1);
    addHeat(g, 1, HEAT_BAND + 0.5, 1);
    addHeat(g, 1, HEAT_BAND + 0.7, 1);
    const cells = heatCells(g);
    expect(cells.length).toBe(2);
    expect(cells[0]!.y).toBeCloseTo(HEAT_BAND + 0.6);
    expect(cells[1]!.y).toBeCloseTo(0.2);
  });

  it('leaves out points that are not numbers, weights of nothing, and cells under the share asked for', () => {
    const g = heatGrid(4);
    expect(addHeat(g, NaN, 0, 0)).toBe(false);
    expect(addHeat(g, 0, 0, 0, 0)).toBe(false);
    for (let i = 0; i < 10; i++) addHeat(g, 1, 0, 1);
    addHeat(g, 9, 0, 9);
    expect(heatCells(g, 0.5).length).toBe(1);
    expect(heatCells(g, 0, 1)[0]!.value).toBe(10);
    expect(heatCells(heatGrid())).toEqual([]);
  });

  it('picks a coarser cell for a big map, and colours run blue to red', () => {
    expect(heatCellFor(60)).toBe(2);
    expect(heatCellFor(400)).toBe(3);
    expect(heatCellFor(5000)).toBe(8);
    expect(heatColor(0)[2]).toBeGreaterThan(0.8);
    expect(heatColor(1)[0]).toBe(1);
    expect(heatColor(1)[1]).toBeLessThan(0.2);
    expect(heatColor(2)).toEqual(heatColor(1));
  });
});

describe('spawn exposure maths', () => {
  // A wall along x = 10 from z = -100 to 100 (nothing sees through it).
  const sees = (a: Vec3, b: Vec3) => (a.x - 10) * (b.x - 10) > 0;
  const grid: Vec3[] = [];
  for (let x = -40; x <= 40; x += 10) for (let z = -40; z <= 40; z += 10) grid.push({ x, y: 0, z });

  it('counts the places that see a spawn, and how far they are', () => {
    const [open, hidden] = spawnExposure(
      [
        { id: 'a', pos: { x: 0, y: 0, z: 0 } },
        { id: 'b', pos: { x: 35, y: 0, z: 0 }, team: 'blue' },
      ],
      grid,
      sees,
    );
    // West of the wall: x from -40 to 10 (x = 10 is on the wall: not either side) less its own spot: 6 × 9 - 1.
    const west = grid.filter((p) => p.x < 10 && Math.hypot(p.x, p.z) >= 4).length;
    expect(open!.seenFrom).toBe(west);
    expect(open!.of).toBe(grid.length);
    expect(open!.share).toBeCloseTo(west / grid.length);
    expect(open!.nearest).toBe(10);
    expect(open!.farthest).toBeCloseTo(Math.hypot(40, 40));
    expect(open!.lines.length).toBe(3);
    expect(open!.lines[0]![1]).toEqual({ x: 0, y: 1.2, z: 0 });
    expect(open!.lines[0]![0].y).toBe(1.5);
    expect(hidden!.team).toBe('blue');
    expect(hidden!.seenFrom).toBe(grid.filter((p) => p.x > 10).length);
    expect(hidden!.share).toBeLessThan(open!.share);
  });

  it('leaves out places past the range and the spawn’s own spot', () => {
    const [r] = spawnExposure([{ id: 'a', pos: { x: 0, y: 0, z: 0 } }], grid, () => true, { range: 15 });
    // Within 15 m, at least 4 m off: the 4 at 10 m and the 4 at 14.1 m.
    expect(r!.seenFrom).toBe(8);
    expect(r!.median).toBeCloseTo((10 + Math.hypot(10, 10)) / 2);
  });

  it('warns about spawns seen from enough of the map, and only those', () => {
    // The wall at x = 25 here: east of it only x = 30 and 40 (18 of 81 places).
    const seesFrom25 = (a: Vec3, b: Vec3) => (a.x - 25) * (b.x - 25) > 0;
    const results = spawnExposure(
      [
        { id: 'open', pos: { x: 0, y: 0, z: 0 } },
        { id: 'tucked', pos: { x: 45, y: 0, z: 0 } },
      ],
      grid,
      seesFrom25,
    );
    expect(results[0]!.share).toBeGreaterThanOrEqual(EXPOSED_SHARE);
    expect(results[1]!.share).toBeLessThan(EXPOSED_SHARE);
    const issues = exposureIssues(results);
    expect(issues.map((i) => [i.targetId, i.severity, i.code])).toEqual([['open', 'warning', 'spawn.exposed']]);
    expect(issues[0]!.message).toMatch(/^Exposed spawn: \d+% of the map can see it \(from up to 57 m away\)/);
    expect(exposureIssues(results, 1.01)).toEqual([]);
  });

  it('finds the long sightlines, longest first, one per view', () => {
    const lines = longSightlines(grid, sees, { min: 50, keep: 50 });
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.length).toBeGreaterThanOrEqual(50);
      expect(sees(l.a, l.b)).toBe(true);
    }
    for (let i = 1; i < lines.length; i++) expect(lines[i]!.length).toBeLessThanOrEqual(lines[i - 1]!.length);
    // The longest: corner to corner west of the wall ((-40, -40) to (0, 40); across the wall none).
    expect(lines[0]!.length).toBeCloseTo(Math.hypot(40, 80));
    // Two kept lines never share both ends within 12 m.
    for (let i = 0; i < lines.length; i++)
      for (let j = i + 1; j < lines.length; j++) {
        const a = lines[i]!;
        const b = lines[j]!;
        const near = (p: Vec3, q: Vec3) => Math.hypot(p.x - q.x, p.z - q.z) < 12;
        expect((near(a.a, b.a) && near(a.b, b.b)) || (near(a.a, b.b) && near(a.b, b.a))).toBe(false);
      }
  });

  it('samples places evenly and the same way each time', () => {
    const many = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: 0, z: 0 }));
    const s = samplePlaces(many, 100);
    expect(s.length).toBe(100);
    expect(s[1]!.x - s[0]!.x).toBe(10);
    expect(samplePlaces(many, 100)).toEqual(s);
    expect(samplePlaces(grid, 1000).length).toBe(grid.length);
  });
});

describe('bot trace', () => {
  it('reports stuck recoveries and failed searches since the last look', () => {
    const t = new BotTrace();
    const bot = { stuckCount: 0, pathFailures: 0, lastNoRoute: null as { goal: Vec3; from: Vec3 } | null, doing: 'roam' };
    const c = { slot: 3, move: { pos: { x: 1, y: 0, z: 2 } }, bot };
    expect(t.look(c)).toMatchObject({ stuck: 0, failed: 0, noRoute: null });
    bot.stuckCount = 2;
    bot.pathFailures = 1;
    bot.lastNoRoute = { goal: { x: 9, y: 0, z: 9 }, from: { x: 1, y: 0, z: 2 } };
    expect(t.look(c)).toMatchObject({ stuck: 2, failed: 1, noRoute: bot.lastNoRoute, doing: 'roam' });
    expect(t.look(c)).toMatchObject({ stuck: 0, failed: 0, noRoute: null });
    expect(t.look({ slot: 4, move: c.move })).toBeNull();
  });
});

describe('a bot test run and exposure on a real map', () => {
  beforeAll(() => Promise.all([initPhysics(), initNavigation()]));
  const arena = () => {
    const r = loadMap(JSON.parse(readFileSync(new URL('../../../maps/phase0_arena.json', import.meta.url), 'utf8')));
    if (!r.ok) throw new Error('phase0_arena did not load');
    return r.map;
  };

  it('sizes the bots by mode', () => {
    const map = arena();
    expect(botTestRules(map, { mode: 'core.deathmatch', teamSize: 4, bots: 6, seconds: 10 }).total).toBe(6);
    expect(botTestRules(map, { mode: 'core.tdm', teamSize: 5, bots: 6, seconds: 10 }).total).toBe(10);
    expect(botTestRules(map, { mode: 'core.tdm', teamSize: 99, bots: 6, seconds: 10 }).total).toBe(32);
    expect(botTestRules(map, { mode: 'core.deathmatch', teamSize: 4, bots: 200, seconds: 10 }).total).toBe(32);
  });

  it('plays a short match in slices and gives heatmaps and a summary', () => {
    const run = new BotTestRun(arena(), { mode: 'core.deathmatch', teamSize: 4, bots: 6, seconds: 30, seed: 2 });
    try {
      let slices = 0;
      while (!run.done) {
        run.advance(120);
        slices++;
      }
      expect(slices).toBe(15);
      expect(run.progress).toBe(1);
      const r = run.result();
      expect(r.summary.bots).toBe(6);
      expect(r.summary.seconds).toBe(30);
      expect(r.summary.kills).toBeGreaterThan(0);
      expect(r.summary.searches).toBeGreaterThan(0);
      expect(r.layers.went.length).toBeGreaterThan(20);
      // Where they died: one heat point per kill.
      expect(r.layers.died.reduce((a, c) => a + c.value, 0)).toBe(r.summary.kills);
      expect(r.layers.stuck.reduce((a, c) => a + c.value, 0)).toBeLessThanOrEqual(r.summary.stuck);
      expect(r.layers.failed.reduce((a, c) => a + c.value, 0)).toBeLessThanOrEqual(r.summary.failed);
      expect(r.cell).toBe(2);
      const lines = botTestLines(r.summary);
      expect(lines[0]).toBe('Deathmatch, 6 bots, 0:30 played');
      expect(lines[1]).toMatch(/^Kills: \d+ \(/);
    } finally {
      run.destroy();
    }
  });

  it('works out every spawn’s exposure and the long sightlines', () => {
    const map = arena();
    const r = mapExposure(map);
    expect(r.spawns.length).toBe(map.entities.filter((e) => e.kind === 'spawn').length);
    expect(r.places).toBeGreaterThan(30);
    for (const s of r.spawns) {
      expect(s.share).toBeGreaterThanOrEqual(0);
      expect(s.share).toBeLessThanOrEqual(1);
      expect(s.farthest).toBeGreaterThanOrEqual(s.median);
      expect(s.median).toBeGreaterThanOrEqual(s.nearest);
    }
    expect(r.spawns.some((s) => s.seenFrom > 0)).toBe(true);
    for (const l of r.lines) expect(l.length).toBeGreaterThanOrEqual(50);
  });
});
