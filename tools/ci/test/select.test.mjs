// Change-based selection (e2e/flowMap.mjs) and shard balancing (e2e/shards.mjs).
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COVERED_MAPS, FLOWS, MAP_FLOWS, MAP_PARTS, mapPartOf, selectForPaths, unitTestPaths } from '../../../e2e/flowMap.mjs';
import { assignShards, durationOf, loadTimings, shardCount, MAX_SHARDS, UNKNOWN_FLOW_S } from '../../../e2e/shards.mjs';

const mapIds = readdirSync(new URL('../../../maps/', import.meta.url)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const sel = (...paths) => selectForPaths(paths, mapIds);

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
    expect(s.flows).toEqual(FLOWS);
    expect(s.unit).toBe('all');
    expect(s.reasons.join()).toMatch(/no rule/);
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
    'packages/client/src/game/view.ts',
    'packages/client/src/game/matchHost.ts',
    'content/props.json',
    'tools/content/build.mjs',
    'maps/phase0_arena.json',
  ])('shared code or infrastructure (%s) runs everything', (p) => {
    const s = sel(p);
    expect(s.full).toBe(true);
    expect(s.flows).toEqual(FLOWS);
    expect(s.unit).toBe('all');
    expect(s.perf).toBe(true);
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

  it('a map runs its tour part and the flows that open it', () => {
    const s = sel('maps/sandsweep.json');
    expect(s.full).toBe(false);
    expect(s.flows).toContain(MAP_FLOWS[mapPartOf('sandsweep', mapIds)]);
    expect(s.flows).toContain('race');
    expect(s.flows.filter((f) => MAP_FLOWS.includes(f))).toHaveLength(1);
    const own = sel('maps/m3_vault.json');
    expect(own.flows).toEqual(['vault']);
  });


  it('baselines run the screenshot flow; render code gets the perf check', () => {
    expect(sel('e2e/baselines/menu.png')).toMatchObject({ full: false, flows: ['visual'] });
    expect(sel('packages/client/src/foliage.ts').perf).toBe(true);
    expect(sel('packages/client/src/editor/palette.ts').perf).toBe(false);
  });

  it('combines rules: the union of flows, units widened to all by a full change', () => {
    const s = sel('packages/server/src/lobby.ts', 'packages/client/src/designer/customLooks.ts');
    expect(s.flows).toEqual(['designer', 'characters', 'online', 'hostgame', 'hostcontrols', 'lobby', 'handoff', 'dedicatedhost', 'hostpage']);
    expect(s.unit).toEqual(['client', 'host', 'server']);
    expect(sel('packages/server/src/lobby.ts', 'packages/shared/src/protocol.ts').unit).toBe('all');
  });

  it('every flow named by a rule exists, and run.mjs lists exactly FLOWS', () => {
    const src = readFileSync(new URL('../../../e2e/flowMap.mjs', import.meta.url), 'utf8');
    const named = [...src.matchAll(/'([a-z0-9]+)'/g)].map((m) => m[1]);
    const runner = readFileSync(new URL('../../../e2e/run.mjs', import.meta.url), 'utf8');
    for (const f of FLOWS.filter((f) => !MAP_FLOWS.includes(f))) expect(runner).toMatch(new RegExp(`\\b${f}: \\w+Flow\\b`));
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
    expect(shardCount(FLOWS, timings)).toBe(MAX_SHARDS);
    expect(durationOf({ flows: {} }, 'new')).toBe(UNKNOWN_FLOW_S);
  });

  it('greedy LPT: the longest flows go to separate shards', () => {
    const t = { startup: 0, flows: { a: 10, b: 9, c: 2, d: 2, e: 2, f: 2 } };
    const shards = assignShards(['a', 'b', 'c', 'd', 'e', 'f'], t, 2);
    expect(shards.map((s) => s.seconds).sort()).toEqual([13, 14]);
    expect(shards.find((s) => s.flows.includes('a')).flows).not.toContain('b');
  });
});
