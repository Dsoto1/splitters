// The team brain (bots/teamBrain.ts; docs/BOTS.md, "Team brain"; BOT_AI_PLAN.md Phase B items 2 and 4): groups over a
// trip's corridors, prices, group pushes and interceptors, on made-up corridors (no map needed).
import { describe, expect, it } from 'vitest';
import { CORE_BOT_PROFILES, TICK_RATE, type Vec3 } from '../src/index.ts';
import { DEFAULT_PLAYBOOK, TeamBrain, resample, splits, type BrainMember, type Corridor, type OrderGoal, type SideBrief, type Trip } from '../src/match.ts';

const at = (x: number, z: number): Vec3 => ({ x, y: 0, z });

/** A corridor along a polyline (points every 12 m, the line every 4 m), its via where it bulges furthest from z = 0. */
function corridor(pts: Vec3[], via: Vec3 | null): Corridor {
  const along = (l: Vec3[]) => l.reduce<number[]>((a, p, i) => (a.push(i ? a[i - 1]! + Math.hypot(p.x - l[i - 1]!.x, p.z - l[i - 1]!.z) : 0), a), []);
  const line = resample(pts, 4);
  const points = resample(pts, 12);
  const lineAt = along(line);
  return { points, pointsAt: along(points), line, lineAt, length: lineAt[lineAt.length - 1]!, shared: 0, via, viaApart: via ? Math.abs(via.z) : 0, vias: via ? [via] : [] };
}

// Three ways from (0, 0) to (200, 0): straight, round the north (z 30) and round the south (z -30). Groups split only
// over a long trip (the playbook's `groupsFromLength`): `short`, the same ways over 100 m, has none.
function ways(len: number): Trip {
  const k = len / 100;
  const straight = corridor([at(0, 0), at(100 * k, 0)], null);
  const north = corridor([at(0, 0), at(30 * k, 30), at(70 * k, 30), at(100 * k, 0)], at(50 * k, 30));
  const south = corridor([at(0, 0), at(30 * k, -30), at(70 * k, -30), at(100 * k, 0)], at(50 * k, -30));
  return { from: at(0, 0), to: at(len, 0), corridors: [straight, north, south] };
}
const trip = ways(200);
const short = ways(100);
const flag: OrderGoal = { pos: at(200, 0), radius: 0.5, push: true };

const profile = (i: number) => ({ ...CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]! });
function members(n: number, pos: (i: number) => Vec3 = () => at(2, 0), over: Partial<BrainMember> = {}): BrainMember[] {
  return Array.from({ length: n }, (_, i) => ({ slot: i, pos: pos(i), profile: profile(i), goal: flag, corridor: null, ordered: false, mounted: false, seen: null, ...over }));
}
const attackBrief = (stage: boolean): SideBrief => ({ attack: { pos: at(200, 0), stage }, intercept: null });

describe('team brain', () => {
  it('splits the attackers over the corridors: a main push on the cheapest, flankers on another, a recon pair on the third', () => {
    const brain = new TeamBrain();
    const jobs = brain.update(0, members(9), attackBrief(false), [trip], [trip]);
    const groups = brain.groupsNow();
    const size = (k: string) => groups.find((g) => g.kind === k)!.members.length;
    expect([size('main'), size('flank'), size('recon')]).toEqual([5, 2, 2]);
    expect(new Set(groups.map((g) => g.corridor)).size).toBe(3);
    expect(groups.find((g) => g.kind === 'main')!.corridor).toBe(0);
    for (const [, job] of jobs) {
      expect(job?.to).toEqual(at(200, 0));
      expect(job?.route).toBe(trip.corridors[groups.find((g) => g.kind === job!.group)!.corridor]);
    }
    // The same members and prices a second later: the same groups on the same corridors (nobody swaps).
    brain.update(TICK_RATE, members(9), attackBrief(false), [trip], [trip]);
    expect(brain.groupsNow().map((g) => [g.kind, g.corridor, g.members])).toEqual(groups.map((g) => [g.kind, g.corridor, g.members]));
  });

  it('splits only over a long trip: on a short one each bot takes its own lane', () => {
    expect(splits(trip, DEFAULT_PLAYBOOK)).toBe(true);
    expect(splits(short, DEFAULT_PLAYBOOK)).toBe(false);
    const brain = new TeamBrain();
    const goal: OrderGoal = { pos: at(100, 0), radius: 0.5, push: true };
    const jobs = brain.update(0, members(9, undefined, { goal }), { attack: { pos: at(100, 0), stage: true }, intercept: null }, [short], [short]);
    expect([...jobs.values()].every((j) => j === null)).toBe(true);
    expect(brain.groupsNow().every((g) => g.members.length === 0)).toBe(true);
    // Only one way near the shortest (the others twice as long): no groups either.
    expect(splits({ ...trip, corridors: [trip.corridors[0]!, ways(400).corridors[1]!] }, DEFAULT_PLAYBOOK)).toBe(false);
  });

  it('prices a corridor up where teammates died lately, and a group not mid-push moves off it', () => {
    const brain = new TeamBrain();
    brain.update(0, members(9), attackBrief(false), [trip], [trip]);
    for (let i = 0; i < 4; i++) brain.death(at(50, 0), TICK_RATE);
    brain.update(TICK_RATE * 2, members(9), attackBrief(false), [trip], [trip]);
    expect(brain.trips[0]!.deaths[0]).toBe(4);
    expect(brain.groupsNow().find((g) => g.kind === 'main')!.corridor).not.toBe(0);
    // A minute on, the deaths are forgotten.
    brain.update(TICK_RATE * 70, members(9), attackBrief(false), [trip], [trip]);
    expect(brain.trips[0]!.deaths[0]).toBe(0);
  });

  it('gathers a group at a staging spot on its corridor and sends it on together, a wave at a time', () => {
    const brain = new TeamBrain();
    // Everyone fresh from the spawn: all are sent to stage first.
    let jobs = brain.update(0, members(9), attackBrief(true), [trip], [trip]);
    const main = () => brain.groupsNow().find((g) => g.kind === 'main')!;
    const stage = main().stage!;
    expect(stage).not.toBeNull();
    expect(200 - stage.x).toBeGreaterThanOrEqual(28);
    for (const slot of main().members) expect(jobs.get(slot)?.stage).toEqual(stage);
    // The recon pair goes ahead on its own.
    for (const slot of brain.groupsNow().find((g) => g.kind === 'recon')!.members) expect(jobs.get(slot)?.stage).toBeNull();
    // Most of the main push at the spot: the wave goes; those still on their way keep coming to the spot.
    const ms = main().members;
    const pos = (i: number) => (ms.includes(i) && ms.indexOf(i) < 3 ? { ...stage } : at(2, 0));
    jobs = brain.update(TICK_RATE, members(9, pos), attackBrief(true), [trip], [trip]);
    expect(brain.stats.started).toBe(1);
    for (const slot of ms.slice(0, 3)) expect(jobs.get(slot)?.stage).toBeNull();
    expect(jobs.get(ms[3]!)?.stage).toEqual(stage);
  });

  it('a bot keeps the corridor it set out on when its group moves to another, and never falls back to a staging spot it is past', () => {
    const brain = new TeamBrain();
    let jobs = brain.update(0, members(9), attackBrief(false), [trip], [trip]);
    const main = () => brain.groupsNow().find((g) => g.kind === 'main')!;
    const before = main().corridor;
    const first = main().members[0]!;
    expect(jobs.get(first)?.route).toBe(trip.corridors[before]);
    // Teammates die on the main push's corridor: the group moves, the bots already on their way keep theirs.
    const dead = trip.corridors[before]!.line[Math.floor(trip.corridors[before]!.line.length / 2)]!;
    for (let i = 0; i < 4; i++) brain.death(dead, TICK_RATE);
    jobs = brain.update(TICK_RATE * 2, members(9), attackBrief(false), [trip], [trip]);
    expect(main().corridor).not.toBe(before);
    expect(jobs.get(first)?.route).toBe(trip.corridors[before]);
    // A group push: a bot already 10 m from the objective isn't sent back to stage; one at the start is.
    jobs = brain.update(TICK_RATE * 3, members(9, (i) => (i === first ? at(192, 0) : at(2, 0))), attackBrief(true), [trip], [trip]);
    expect(jobs.get(first)?.stage).toBeNull();
    const other = main().members.find((s) => s !== first)!;
    expect(jobs.get(other)?.stage).not.toBeNull();
  });

  it("sends the members the enemy carrier will run into to cut it off, not those behind it, and leaves people's orders alone", () => {
    const brain = new TeamBrain();
    // Their carrier on the straight way at x 40, running for (100, 0). Ours: two ahead of it, one behind, one ordered.
    const ms: BrainMember[] = [
      { ...members(1, () => at(80, 5))[0]!, slot: 1, goal: null },
      { ...members(1, () => at(95, -8))[0]!, slot: 2, goal: null },
      { ...members(1, () => at(10, 0))[0]!, slot: 3, goal: null },
      { ...members(1, () => at(85, 0))[0]!, slot: 4, goal: null, ordered: true },
    ];
    const jobs = brain.update(0, ms, { attack: null, intercept: { pos: at(40, 0), to: at(100, 0), slot: 99 } }, [short], [short]);
    expect(jobs.get(1)?.group).toBe('intercept');
    expect(jobs.get(2)?.group).toBe('intercept');
    expect(jobs.get(3)).toBeNull();
    expect(jobs.get(4)).toBeNull();
    // Each waits on the carrier's way, ahead of it, a goal to keep to.
    const g = jobs.get(1)!.goal!;
    expect(g.push).toBe(true);
    expect(g.pos.x).toBeGreaterThan(55);
    expect(Math.abs(g.pos.z)).toBeLessThan(1);
  });

  it('gives no jobs to bots under orders, riding, or carrying', () => {
    const brain = new TeamBrain();
    const ms = members(9).map((m, i) => (i < 3 ? { ...m, ordered: true } : i < 5 ? { ...m, mounted: true } : m));
    const jobs = brain.update(0, ms, attackBrief(false), [trip], [trip]);
    for (let i = 0; i < 5; i++) expect(jobs.get(i)).toBeNull();
    expect([...jobs.values()].filter(Boolean).length).toBe(4);
  });
});
