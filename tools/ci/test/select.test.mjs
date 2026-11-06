// Change-based selection (e2e/flowMap.mjs) and shard balancing (e2e/shards.mjs).
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHARACTER_FLOWS, COVERAGE_MAP, COVERED_MAPS, FLOWS, MAP_FLOWS, MAP_PARTS, MAX_NAMED_MAPS, mapPartOf, selectForPaths, unitJobs, unitTestPaths } from '../../../e2e/flowMap.mjs';
import { assignShards, durationOf, loadTimings, planShards, shardCount, withNamedMaps, MAX_SHARDS, PER_MAP_S, TARGET_SHARD_S, UNKNOWN_FLOW_S } from '../../../e2e/shards.mjs';
import { mergeTimings } from '../timings.mjs';

const mapIds = readdirSync(new URL('../../../maps/', import.meta.url)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const sel = (...paths) => selectForPaths(paths, mapIds);
const tourSel = (...paths) => selectForPaths(paths, mapIds, { tour: true });
/** Everything but the browser map tour (check branches and main pushes). */
const NO_TOUR = FLOWS.filter((f) => !MAP_FLOWS.includes(f));

describe('change-based selection', () => {
  it('docs alone run nothing', () => {
    const s = sel('docs/PERF_96.md', 'README.md', 'CHANGELOG.md', 'CLAUDE.md');
    expect(s).toMatchObject({ full: false, flows: [], unit: [], docsOnly: true, perf: false });
  });

  it('the box\'s deploy scripts run no flows', () => {
    expect(sel('infra/tiletrigger-update.sh', 'infra/toshiro-trigger-multiplayer.yaml', 'deploy/aws-lightsail-setup.sh')).toMatchObject({ full: false, flows: [], unit: [] });
  });

  it('anything unmapped runs everything', () => {
    const s = sel('docs/UI.md', 'somewhere/new/file.txt');
    expect(s.full).toBe(true);
    expect(s.flows).toEqual(NO_TOUR);
    expect(s.flows).toContain('coverage');
    expect(s.unit).toBe('all');
    expect(s.reasons.join()).toMatch(/no rule/);
    // Nightly, v* tags and Run workflow: the tour too.
    expect(tourSel('somewhere/new/file.txt').flows).toEqual(FLOWS);
  });

  it.each([
    'packages/shared/src/sim/match.ts',
    'packages/shared/src/bots/brain.ts',
    '.github/workflows/ci.yml',
    'e2e/run.mjs',
    'e2e/flowMap.mjs',
    'package.json',
    'pnpm-lock.yaml',
    'packages/client/src/main.ts',
    'packages/client/src/game/session.ts',
    'packages/client/src/game/matchHost.ts',
    'content/models.json',
    'content/packs.json',
    'content/intake/queue.json',
    'assets-src/x.png',
    'tools/content/build.mjs',
    'maps/phase0_arena.json',
  ])('shared code or infrastructure (%s) runs everything', (p) => {
    const s = sel(p);
    expect(s.full).toBe(true);
    expect(s.flows).toEqual(NO_TOUR);
    expect(s.maps).toEqual([]);
    expect(s.unit).toBe('all');
    expect(s.perf).toBe(true);
  });

  it('the bots, navigation, the sim and its modes, the scorecard itself and the maps its check plays get the bot scorecard check; nothing else does', () => {
    for (const p of ['packages/shared/src/bots/brain.ts', 'packages/shared/src/nav/audit.ts', 'packages/shared/src/sim/match.ts', 'packages/shared/src/sim/modes/ctfBots.ts', 'packages/server/src/tools/bot-report.ts', 'packages/server/src/tools/bot-limits.json', 'package.json', 'maps/diamond_park.json', 'maps/shingle_point.json']) expect(sel(p).bots, p).toBe(true);
    for (const p of ['docs/BOTS.md', 'packages/client/src/game/view.ts', 'packages/client/src/editor/palette.ts', 'packages/server/src/tools/bench.ts', 'content/props.json', 'maps/canyon.json']) expect(sel(p).bots, p).toBe(false);
  });

  it('the match renderer runs every flow that plays a match, and the client unit tests', () => {
    const s = sel('packages/client/src/game/view.ts');
    expect(s.full).toBe(false);
    expect(s.flows).toEqual(NO_TOUR.filter((f) => !['editorux', 'hostpage', 'webgpu'].includes(f)));
    expect(s.unit).toEqual(['client']);
    expect(s.perf).toBe(true);
  });

  it.each([
    ['content/characters/soldier.json', ['designer', ...CHARACTER_FLOWS, 'visual'], ['client', 'content', 'shared']],
    ['content/characters.lock.json', ['designer', ...CHARACTER_FLOWS, 'visual'], ['client', 'content', 'shared']],
    ['content/clip-sets/rifle.json', [...CHARACTER_FLOWS, 'visual'], ['client', 'content', 'shared']],
    ['content/props.json', ['editor', 'scenery', 'setpieces', 'visual'], ['client', 'shared']],
    ['content/props/kenney-survival-kit.json', ['editor', 'scenery', 'setpieces', 'visual'], ['client', 'shared']],
    ['content/props.lock.json', ['editor', 'scenery', 'setpieces', 'visual'], ['client', 'shared']],
    ['content/guns.json', ['arsenal', 'vehicles', ...CHARACTER_FLOWS], ['shared']],
    ['content/vfx.json', ['physicsfx', 'arsenal'], ['client']],
    ['content/gear.json', ['designer', ...CHARACTER_FLOWS, 'visual'], ['shared']],
    ['content/sounds.json', ['offline'], ['client']],
  ])('a content manifest (%s) runs the flows that look at it', (p, flows, unit) => {
    const s = sel(p);
    expect(s).toMatchObject({ full: false, flows, unit, perf: true, docsOnly: false });
  });

  it('skies and city run the coverage map and the map flows (the tour itself nightly), not the online ones', () => {
    for (const p of ['content/skies.json', 'content/city.json']) {
      const s = sel(p);
      expect(s.full).toBe(false);
      expect(s.flows).toEqual(expect.arrayContaining(['coverage', 'scenery', 'setpieces', 'canyon']));
      expect(s.flows.some((f) => MAP_FLOWS.includes(f))).toBe(false);
      expect(s.flows).not.toContain('online');
      expect(tourSel(p).flows).toEqual(expect.arrayContaining(MAP_FLOWS));
      expect(tourSel(p).flows).not.toContain('coverage');
    }
    expect(unitTestPaths(['content'])).toEqual(['tools/content/test']);
  });

  it('MapMaker code runs the editor flows and client unit tests only', () => {
    const s = sel('packages/client/src/editor/palette.ts');
    expect(s.full).toBe(false);
    expect(s.flows).toEqual(expect.arrayContaining(['editor', 'editorux', 'scenery', 'visual']));
    expect(s.flows).not.toContain('online');
    expect(s.flows.some((f) => MAP_FLOWS.includes(f))).toBe(false);
    expect(s.unit).toEqual(['client']);
    expect(unitTestPaths(s.unit)).toEqual(['packages/client/test']);
  });

  it('server code runs the online flows and server unit tests', () => {
    const s = sel('packages/server/src/lobby.ts');
    expect(s.flows).toEqual(['online', 'hostgame', 'hostcontrols', 'lobby', 'handoff', 'dedicatedhost', 'hostpage']);
    expect(s.unit).toEqual(['host', 'server']);
  });

  it('unit tests alone run their package, no browser', () => {
    expect(sel('packages/client/test/palette.test.ts')).toMatchObject({ full: false, flows: [], unit: ['client'] });
    expect(sel('packages/shared/test/botai.test.ts')).toMatchObject({ full: false, flows: [], unit: ['shared'] });
    expect(sel('tools/ci/test/select.test.mjs')).toMatchObject({ flows: [], unit: ['tools'] });
    expect(unitTestPaths(['shared', 'tools'])).toEqual(['packages/shared/test', 'tools/ci/test']);
  });

  it('a map tours just that map (E2E_MAPS) and runs the flows that open it', () => {
    const s = sel('maps/sandsweep.json');
    expect(s.full).toBe(false);
    expect(s.flows).toEqual(['race', 'maps']);
    expect(s.maps).toEqual(['sandsweep']);
    expect(s.unit).toBe('all');
    const own = sel('maps/m3_vault.json');
    expect(own.flows).toEqual(['vault']);
    expect(own.maps).toEqual([]);
    expect(sel(`maps/${COVERAGE_MAP}.json`)).toMatchObject({ flows: ['coverage'], maps: [] });
    // A few maps: just those; more than MAX_NAMED_MAPS: the tour parts that hold them.
    const tour = mapIds.filter((id) => !COVERED_MAPS.has(id)).sort();
    const few = sel(...tour.slice(0, MAX_NAMED_MAPS).map((id) => `maps/${id}.json`));
    expect(few.flows.filter((f) => MAP_FLOWS.includes(f))).toEqual(['maps']);
    expect(few.maps).toEqual(tour.slice(0, MAX_NAMED_MAPS));
    const many = sel(...tour.slice(0, MAX_NAMED_MAPS + 1).map((id) => `maps/${id}.json`));
    expect(many.maps).toEqual([]);
    expect(many.flows.filter((f) => MAP_FLOWS.includes(f))).toEqual(MAP_FLOWS.slice(0, MAX_NAMED_MAPS + 1));
    // With shared code too: everything but the tour, and the changed map toured.
    const both = sel('maps/sandsweep.json', 'packages/shared/src/sim/match.ts');
    expect(both.flows).toEqual(FLOWS.filter((f) => NO_TOUR.includes(f) || f === 'maps'));
    expect(both.maps).toEqual(['sandsweep']);
    // Nightly: the map's tour part, no names.
    expect(tourSel('maps/sandsweep.json')).toMatchObject({ flows: ['race', MAP_FLOWS[mapPartOf('sandsweep', mapIds)]], maps: [] });
  });

  it('the default map of most flows runs everything, still without the tour', () => {
    expect(sel('maps/phase0_arena.json')).toMatchObject({ full: true, flows: NO_TOUR, maps: [] });
  });

  it('built-in bot sets run the Bots window flows and the tests that check them', () => {
    expect(sel('maps/botsets/zombie_horde.json')).toMatchObject({ full: false, flows: ['offline', 'teams', 'hostcontrols', 'dedicatedhost'], unit: ['host', 'server', 'shared'] });
  });


  it('baselines run the screenshot flow; render code gets the perf check', () => {
    expect(sel('e2e/baselines/menu.png')).toMatchObject({ full: false, flows: ['visual'] });
    expect(sel('packages/client/src/foliage.ts').perf).toBe(true);
    expect(sel('packages/client/src/editor/palette.ts').perf).toBe(false);
  });

  it('combines rules: the union of flows, units widened to all by a full change', () => {
    const s = sel('packages/server/src/lobby.ts', 'packages/client/src/designer/customLooks.ts');
    expect(s.flows).toEqual(['designer', ...CHARACTER_FLOWS, 'online', 'hostgame', 'hostcontrols', 'lobby', 'handoff', 'dedicatedhost', 'hostpage']);
    expect(s.unit).toEqual(['client', 'host', 'server']);
    expect(sel('packages/server/src/lobby.ts', 'packages/shared/src/protocol.ts').unit).toBe('all');
  });

  it('every flow named by a rule exists, and run.mjs lists exactly FLOWS', () => {
    const src = readFileSync(new URL('../../../e2e/flowMap.mjs', import.meta.url), 'utf8');
    const named = [...src.matchAll(/'([a-z0-9]+)'/g)].map((m) => m[1]);
    const runner = readFileSync(new URL('../../../e2e/run.mjs', import.meta.url), 'utf8');
    for (const f of FLOWS.filter((f) => !MAP_FLOWS.includes(f) && !CHARACTER_FLOWS.includes(f))) expect(runner).toMatch(new RegExp(`\\b${f}: \\w+Flow\\b`));
    expect(runner).toMatch(/CHARACTER_FLOWS\.map\(\(name, part\) => \[name, \(b\) => charactersFlow\(b, part\)\]\)/);
    expect(new Set(FLOWS).size).toBe(FLOWS.length);
    expect(named.filter((n) => FLOWS.includes(n)).length).toBeGreaterThan(20);
  });
});

describe('map tour parts', () => {
  it('splits the tour into MAP_PARTS parts of near-equal size, covering every map once', () => {
    const tour = mapIds.filter((id) => !COVERED_MAPS.has(id));
    const sizes = Array(MAP_PARTS).fill(0);
    for (const id of tour) sizes[mapPartOf(id, mapIds)]++;
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(tour.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(mapPartOf('canyon', mapIds)).toBe(-1);
  });
});

describe('shards', () => {
  const timings = loadTimings();

  it('has a measured time for every flow', () => {
    for (const f of FLOWS) expect(timings.flows[f], f).toBeGreaterThan(0);
  });

  it('assigns every flow to exactly one shard, balanced within the longest flow', () => {
    const shards = assignShards(FLOWS, timings, MAX_SHARDS, FLOWS);
    expect(shards).toHaveLength(MAX_SHARDS);
    expect(shards.flatMap((s) => s.flows).sort()).toEqual([...FLOWS].sort());
    const secs = shards.map((s) => s.seconds);
    const longest = Math.max(...FLOWS.map((f) => durationOf(timings, f)));
    expect(Math.max(...secs) - Math.min(...secs)).toBeLessThanOrEqual(longest);
    // Within a shard, the runner's own order.
    for (const s of shards) expect(s.flows).toEqual(FLOWS.filter((f) => s.flows.includes(f)));
  });

  it('is stable and uses fewer shards for a few short flows', () => {
    expect(assignShards(FLOWS, timings, 8, FLOWS)).toEqual(assignShards([...FLOWS].reverse(), timings, 8, FLOWS));
    expect(shardCount(['vault'], timings)).toBe(1);
    expect(planShards(['vault'], timings)).toHaveLength(1);
    expect(durationOf({ flows: {} }, 'new')).toBe(UNKNOWN_FLOW_S);
  });

  it('greedy LPT: the longest flows go to separate shards', () => {
    const t = { startup: 0, flows: { a: 10, b: 9, c: 2, d: 2, e: 2, f: 2 } };
    const shards = assignShards(['a', 'b', 'c', 'd', 'e', 'f'], t, 2);
    expect(shards.map((s) => s.seconds).sort()).toEqual([13, 14]);
    expect(shards.find((s) => s.flows.includes('a')).flows).not.toContain('b');
  });

  it('plans the fewest shards that finish within the target, or within the longest flow', () => {
    const t = { startup: 0, flows: { a: 200, b: 200, c: 100, d: 100, e: 50, f: 50 } };
    // 700 s of work at 300 s a shard: 3 shards (200+100, 200+100, 50+50) fit.
    const three = planShards(['a', 'b', 'c', 'd', 'e', 'f'], t, { target: 300 });
    expect(three).toHaveLength(3);
    expect(Math.max(...three.map((s) => s.seconds))).toBeLessThanOrEqual(300);
    // A flow longer than the target: no more shards than needed to finish with it.
    const long = { startup: 0, flows: { big: 500, x: 100, y: 100, z: 100 } };
    const plan = planShards(['big', 'x', 'y', 'z'], long, { target: 300 });
    expect(plan.find((s) => s.flows.includes('big')).flows).toEqual(['big']);
    expect(Math.max(...plan.map((s) => s.seconds))).toBe(500);
    expect(plan).toHaveLength(2);
    // Never more than max, never more than there are flows.
    expect(planShards(['a', 'b'], t, { target: 1 })).toHaveLength(2);
    expect(planShards(Object.keys(t.flows), t, { target: 1, max: 4 })).toHaveLength(4);
    expect(planShards([], t)).toEqual([]);
  });

  it('packs the full check-branch run into at most 16 shards of about 5 minutes, the tour into 16 too', () => {
    const shards = planShards(NO_TOUR, timings, { order: FLOWS });
    expect(shards.length).toBeLessThanOrEqual(MAX_SHARDS);
    expect(shards.flatMap((s) => s.flows).sort()).toEqual([...NO_TOUR].sort());
    const longest = Math.max(...NO_TOUR.map((f) => durationOf(timings, f))) + timings.startup;
    expect(Math.max(...shards.map((s) => s.seconds))).toBeLessThanOrEqual(Math.max(TARGET_SHARD_S, longest));
    const nightly = planShards(FLOWS, timings, { order: FLOWS });
    expect(nightly).toHaveLength(MAX_SHARDS);
    expect(nightly.flatMap((s) => s.flows).sort()).toEqual([...FLOWS].sort());
  });

  it('times a tour of named maps by perMap', () => {
    expect(withNamedMaps(timings, []).flows.maps).toBe(timings.flows.maps);
    expect(withNamedMaps({ flows: {} }, ['a', 'b']).flows.maps).toBe(PER_MAP_S * 2 + 20);
    expect(withNamedMaps({ perMap: 40, flows: {} }, ['a']).flows.maps).toBe(60);
  });

  it('has no flow over about 6 minutes on a check branch (long ones are split)', () => {
    for (const f of NO_TOUR) expect(durationOf(timings, f), f).toBeLessThanOrEqual(400);
  });
});

describe('unit-test jobs', () => {
  it('splits everything into vitest shards and two jobs for the headless map check', () => {
    const all = unitJobs('all');
    expect(all.map((j) => j.name)).toEqual(['1/3', '2/3', '3/3', 'maps 1/2', 'maps 2/2']);
    expect(all[0].args).toBe('--shard=1/3 --exclude=**/allMaps*.test.ts');
    expect(all[3].args).toBe('packages/shared/test/allMaps --shard=1/2');
  });

  it('runs one job for one package, and none for none', () => {
    expect(unitJobs(['client'])).toEqual([{ name: '1/1', args: 'packages/client/test --shard=1/1' }]);
    expect(unitJobs(['shared']).map((j) => j.name)).toEqual(['1/2', '2/2', 'maps 1/2', 'maps 2/2']);
    expect(unitJobs([])).toEqual([]);
  });
});

describe('timing refresh', () => {
  it('moves each measured flow halfway to its measurement, and keeps the rest', () => {
    const { table, lines } = mergeTimings({ startup: 40, perMap: 60, flows: { a: 100, b: 50 } }, [{ flows: { a: 200, c: 30 } }, { flows: {}, perMap: 40 }], '2026-11-04');
    expect(table.flows).toEqual({ a: 150, b: 50, c: 30 });
    expect(table.perMap).toBe(50);
    expect(table.startup).toBe(40);
    expect(table.source).toMatch(/2026-11-04/);
    expect(lines).toHaveLength(3);
  });

  it('ignores junk', () => {
    const { table, lines } = mergeTimings({ flows: { a: 100 } }, [{ flows: { a: -1, b: 'x' } }, {}]);
    expect(table.flows).toEqual({ a: 100 });
    expect(lines).toEqual([]);
  });
});
