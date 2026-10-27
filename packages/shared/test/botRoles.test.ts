import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CHARACTER_PROFILES, CORE_BOT_PROFILES, TICK_RATE, createRng, horizontalDistance, initPhysics, loadMap, rulesForMode, type BotProfile, type Vec3 } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { BotDirector, assignRoles, type DirectorMember } from '../src/bots/director.ts';
import { MapMemory } from '../src/bots/explore.ts';
import { RegionMap, regionLayout } from '../src/bots/regions.ts';
import { VantageBoard, computeVantage } from '../src/bots/vantage.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const profiles = Object.values(CHARACTER_PROFILES);
const roster = (n: number) => Array.from({ length: n }, (_, i) => ({ slot: i, profile: profiles[i % profiles.length]! }));

describe('roles', () => {
  it('are a small, style-dependent minority, deterministic, and fit the personality', () => {
    const count = (m: Map<number, string>, r: string) => [...m.values()].filter((x) => x === r).length;
    const mixed = assignRoles(roster(96), 'mixed', 42);
    expect(assignRoles(roster(96), 'mixed', 42)).toEqual(mixed);
    expect(count(mixed, 'camper')).toBe(Math.floor(96 * 0.08));
    expect(count(mixed, 'sniper')).toBeGreaterThan(0);
    expect(count(mixed, 'lone_wolf')).toBeGreaterThan(0);
    expect(count(mixed, 'squad')).toBeGreaterThan(96 * 0.6);
    // Tactical matches camp more than mixed ones, arena ones hardly at all.
    expect(count(assignRoles(roster(96), 'tactical', 42), 'camper')).toBeGreaterThan(count(mixed, 'camper'));
    expect(count(assignRoles(roster(96), 'arena', 42), 'camper')).toBeLessThan(count(mixed, 'camper'));
    // Snipers are SNIPER-tagged or long-range characters; berserkers never camp or snipe.
    const bots = roster(96);
    for (const b of bots) {
      const role = mixed.get(b.slot);
      if (b.profile.tags.includes('BERSERKER')) expect(['squad', 'lone_wolf']).toContain(role);
      if (role === 'sniper') expect(b.profile.tags.includes('SNIPER') || b.profile.rangePreference >= 80).toBe(true);
    }
    // Duels and small games: no roles.
    expect([...assignRoles(roster(4), 'tactical', 1).values()].every((r) => r === 'squad')).toBe(true);
  });
});

/** A flat grid of places, 7 m apart, 140 m square. */
const grid = (): Vec3[] => {
  const out: Vec3[] = [];
  for (let x = 0; x < 140; x += 7) for (let z = 0; z < 140; z += 7) out.push({ x, y: 0, z });
  return out;
};

const member = (slot: number, pos: Vec3, over: Partial<DirectorMember> = {}): DirectorMember => ({ slot, pos, fighting: false, enemyAt: null, free: true, teamLeader: false, profile: CORE_BOT_PROFILES[3]!, ...over });

describe('squads (clusters)', () => {
  it('form from free bots close together, 3 to 6 strong, with a leader, a goal and different routes', () => {
    const places = grid();
    const d = new BotDirector(7, regionLayout(places), places);
    // Two groups of eight free bots far apart, two bots under orders, one sniper.
    const members: DirectorMember[] = [];
    for (let i = 0; i < 8; i++) members.push(member(i, { x: 10 + (i % 3) * 2, y: 0, z: 10 + Math.floor(i / 3) * 2 }));
    for (let i = 8; i < 16; i++) members.push(member(i, { x: 120 + (i % 3) * 2, y: 0, z: 120 + Math.floor(i / 3) * 2 }));
    members.push(member(16, { x: 12, y: 0, z: 12 }, { free: false }));
    const towards = [{ x: 130, y: 0, z: 10 }, { x: 130, y: 0, z: 60 }, { x: 100, y: 0, z: 10 }];
    d.update(TICK_RATE, 'red', members.map((m) => m.pos), members, towards, true, () => {});
    const squads = d.squads('red');
    expect(squads.length).toBeGreaterThanOrEqual(2);
    for (const s of squads) {
      expect(s.members.length).toBeGreaterThanOrEqual(2);
      expect(s.members.length).toBeLessThanOrEqual(6);
      expect(s.members).toContain(s.leader);
      expect(s.members).not.toContain(16);
      expect(s.goal).not.toBeNull();
      // Members of a squad are near each other.
      const lead = members[s.leader]!.pos;
      for (const m of s.members) expect(horizontalDistance(members[m]!.pos, lead)).toBeLessThan(30);
    }
    const inSquads = squads.flatMap((s) => s.members);
    expect(new Set(inSquads).size).toBe(inSquads.length);
    expect(d.planFor(16).cluster).toBeNull();
    // Every member reads its squad from its plan; squads don't all head for one region.
    expect(d.planFor(squads[0]!.members[0]!).cluster?.leader).toBe(squads[0]!.leader);
    const goals = squads.map((s) => `${s.goal!.x},${s.goal!.z}`);
    expect(new Set(goals).size).toBe(goals.length);
  });

  it('keep members as they move, drop one that strays, and tell members when the leader fights', () => {
    const places = grid();
    const d = new BotDirector(3, regionLayout(places), places);
    const members = Array.from({ length: 4 }, (_, i) => member(i, { x: 20 + i, y: 0, z: 20 }));
    const start = [member(10, { x: 100, y: 0, z: 20 }), member(11, { x: 20, y: 0, z: 120 }), ...members];
    d.update(TICK_RATE, 'blue', start.map((m) => m.pos), start, null, true, () => {});
    const first = d.squads('blue');
    expect(first.length).toBe(1);
    const leader = first[0]!.leader;
    // One strays 100 m off; the leader finds a fight (two more free bots about keep the side over the squad minimum).
    const extra = [member(10, { x: 100, y: 0, z: 20 }), member(11, { x: 20, y: 0, z: 120 })];
    const moved = [...extra, ...members].map((m) => (m.slot === (leader + 1) % 4 ? { ...m, pos: { x: 130, y: 0, z: 130 } } : m.slot === leader ? { ...m, fighting: true, enemyAt: { x: 40, y: 0, z: 20 } } : m));
    const alerts: number[] = [];
    d.update(TICK_RATE * 2, 'blue', moved.map((m) => m.pos), moved, null, true, (slot) => alerts.push(slot));
    const after = d.squads('blue');
    expect(after[0]!.leader).toBe(leader);
    expect(after[0]!.members).not.toContain((leader + 1) % 4);
    expect(alerts.length).toBe(after[0]!.members.length - 1);
    expect(alerts).not.toContain(leader);
    // Squads off (small match or objective mode): nobody is in one.
    d.update(TICK_RATE * 3, 'blue', moved.map((m) => m.pos), moved, null, false, () => {});
    expect(d.squads('blue').length).toBe(0);
    expect(d.planFor(leader).cluster).toBeNull();
  });
});

describe('route variety', () => {
  it('sends a side to regions nobody has been to lately, and spreads bots over them', () => {
    const places = grid();
    const regions = new RegionMap(regionLayout(places));
    // The side has been all over the west half just now.
    regions.update(places.filter((p) => p.x < 70), 100 * TICK_RATE);
    const rng = createRng(5);
    const picks = Array.from({ length: 40 }, () => regions.pick({ from: { x: 70, y: 0, z: 70 }, tick: 100 * TICK_RATE, rng, ideal: 50, novelty: 1.5, crowd: 0.8 })!.pos);
    const east = picks.filter((p) => p.x >= 70).length;
    expect(east).toBeGreaterThan(30);
    // Many different places, not one.
    expect(new Set(picks.map((p) => `${p.x},${p.z}`)).size).toBeGreaterThan(8);
    // A bot's own memory counts too: somewhere it has just been is less interesting.
    const memory = new MapMemory();
    for (const p of places) if (p.x >= 70 && p.z < 70) memory.mark(p, 100 * TICK_RATE);
    const own = Array.from({ length: 40 }, () => regions.pick({ from: { x: 70, y: 0, z: 70 }, tick: 100 * TICK_RATE, rng, ideal: 50, novelty: 1.5, crowd: 0.8, memory })!.pos);
    expect(own.filter((p) => p.x >= 70 && p.z >= 70).length).toBeGreaterThan(own.filter((p) => p.x >= 70 && p.z < 70).length);
  });

  it('gives bots of one side different routes across a real map', () => {
    const r = loadMap(readFileSync(new URL('../../../maps/riot_junction.json', import.meta.url), 'utf8'));
    if (!r.ok) throw new Error('map');
    const match = new Match(r.map, { ...rulesForMode(r.map, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0, teamSizes: [12, 12] }, 9);
    for (let i = 0; i < 24; i++) match.addBot(`b${i}`, CORE_BOT_PROFILES[(i % 2) * 3]!, BOT_DIFFICULTIES.normal);
    const seen = new Map<number, Set<string>>();
    for (let t = 0; t < TICK_RATE * 20; t++) {
      match.step();
      if (t % TICK_RATE) continue;
      for (const c of match.combatants()) {
        if (!c.alive) continue;
        const k = `${Math.floor(c.move.pos.x / 24)},${Math.floor(c.move.pos.z / 24)}`;
        let set = seen.get(c.slot);
        if (!set) seen.set(c.slot, (set = new Set()));
        set.add(k);
      }
    }
    // Paths differ: the regions each bot went through aren't all the same set.
    const sets = [...seen.values()].map((s) => [...s].sort().join('|'));
    expect(new Set(sets).size).toBeGreaterThan(sets.length / 2);
    match.destroy();
  }, 60_000);
});

describe('vantage spots', () => {
  it('finds long sightlines (sniper) and tucked-in corners (camp), spread out, deterministically', () => {
    // A 50 m yard with walls round it and a 3 m-high ledge in one corner.
    const W = 50;
    const places: Vec3[] = [];
    for (let x = 1.5; x < W; x += 3.5) for (let z = 1.5; z < W; z += 3.5) places.push({ x, y: x > 38 && z > 38 ? 3 : 0, z });
    const ray = (o: Vec3, d: Vec3, max: number) => {
      // Distance to the yard's walls (0..W on x and z).
      const tx = d.x > 1e-9 ? (W - o.x) / d.x : d.x < -1e-9 ? -o.x / d.x : Infinity;
      const tz = d.z > 1e-9 ? (W - o.z) / d.z : d.z < -1e-9 ? -o.z / d.z : Infinity;
      const t = Math.min(tx, tz);
      return t <= max ? t : null;
    };
    const spots = computeVantage(places, ray);
    expect(computeVantage(places, ray)).toEqual(spots);
    const sniper = spots.filter((s) => s.kind === 'sniper');
    const camp = spots.filter((s) => s.kind === 'camp');
    expect(sniper.length).toBeGreaterThan(0);
    expect(camp.length).toBeGreaterThan(0);
    // The ledge makes a sniper spot; snipers see a long way.
    expect(sniper.some((s) => s.height > 1)).toBe(true);
    for (const s of sniper) expect(s.reach).toBeGreaterThanOrEqual(40);
    // Camp spots are against the walls.
    for (const c of camp) expect(Math.min(c.pos.x, c.pos.z, W - c.pos.x, W - c.pos.z)).toBeLessThan(3);
    // Spread out (on one level: a ledge above may overlook a spot below).
    for (const list of [sniper, camp]) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (Math.abs(list[i]!.pos.y - list[j]!.pos.y) < 3) expect(horizontalDistance(list[i]!.pos, list[j]!.pos)).toBeGreaterThanOrEqual(14);
    // One bot a spot: a claimed spot isn't offered to another until it's released.
    const board = new VantageBoard(spots);
    const rng = createRng(1);
    const a = board.pick('camp', camp[0]!.pos, 0, 200, rng);
    board.claim(a, 1, 1000);
    expect(board.pick('camp', board.spots[a]!.pos, 10, 1, rng)).not.toBe(a);
    board.release(a, 1);
    expect(board.heldBy(a)).toBe(-1);
  });
});

describe('role behaviour in a match', () => {
  const play = (style: 'mixed' | 'tactical', seconds: number) => {
    const r = loadMap(readFileSync(new URL('../../../maps/riot_junction.json', import.meta.url), 'utf8'));
    if (!r.ok) throw new Error('map');
    const match = new Match(r.map, { ...rulesForMode(r.map, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0, teamSizes: [16, 16], botStyle: style === 'mixed' ? undefined : style }, 21);
    const camper: BotProfile = { ...CORE_BOT_PROFILES[2]!, id: 'test.camper', tags: ['CAMPER'] };
    const wolf: BotProfile = { ...CORE_BOT_PROFILES[3]!, id: 'test.wolf', tags: ['LONE_WOLF'] };
    for (let i = 0; i < 32; i++) match.addBot(`b${i}`, i % 8 === 0 ? camper : i % 8 === 1 ? wolf : CORE_BOT_PROFILES[(i % 2) * 3]!, BOT_DIFFICULTIES.normal);
    const held = new Map<number, number>();
    const posts = new Map<number, number>();
    const wolvesInSquads = new Set<number>();
    const director = (match as unknown as { director: BotDirector }).director;
    for (let t = 0; t < TICK_RATE * seconds; t++) {
      match.step();
      if (t % 30) continue;
      for (const c of match.combatants()) {
        const v = c.alive ? c.bot!.vantage : null;
        if (v?.arrived) held.set(c.slot, (held.get(c.slot) ?? 0) + 0.5);
        if (v && !posts.has(c.slot)) posts.set(c.slot, t);
        if (director.planFor(c.slot).role === 'lone_wolf' && director.planFor(c.slot).cluster) wolvesInSquads.add(c.slot);
      }
    }
    match.destroy();
    return { held, posts, wolvesInSquads, director };
  };

  it('campers take up vantage spots for a limited time; lone wolves stay out of squads', () => {
    const { held, posts, wolvesInSquads } = play('mixed', 90);
    // Somebody went to a spot and held it a while...
    expect(posts.size).toBeGreaterThan(0);
    const longest = Math.max(0, ...held.values());
    expect(longest).toBeGreaterThan(5);
    // ...but not all match long: camping is time-limited (holds of under a minute, then roam).
    expect(longest).toBeLessThan(80);
    expect(wolvesInSquads.size).toBe(0);
  }, 120_000);

  it('snipers with a scope hold long sightlines and move to another spot soon after a kill', () => {
    const r = loadMap(readFileSync(new URL('../../../maps/riot_junction.json', import.meta.url), 'utf8'));
    if (!r.ok) throw new Error('map');
    const rules = rulesForMode(r.map, 'core.tdm');
    const match = new Match(r.map, { ...rules, scoreLimit: 0, timeLimitSeconds: 0, teamSizes: [16, 16], startingWeapons: [...rules.startingWeapons, 'core.sniper'] }, 4);
    for (let i = 0; i < 32; i++) match.addBot(`b${i}`, CORE_BOT_PROFILES[i % 4 === 1 ? 1 : (i % 2) * 3]!, BOT_DIFFICULTIES.normal);
    const director = (match as unknown as { director: BotDirector }).director;
    const snipers = match.combatants().filter((c) => director.planFor(c.slot).role === 'sniper');
    expect(snipers.length).toBeGreaterThan(0);
    let posted = 0;
    const kills: { slot: number; at: Vec3; tick: number }[] = [];
    let moved = 0;
    for (let t = 0; t < TICK_RATE * 120; t++) {
      const events = match.step();
      for (const e of events) {
        if (e.e !== 'kill' || e.killer === null) continue;
        const k = match.actor(e.killer);
        const v = k?.bot?.vantage;
        if (v?.arrived && v.kind === 'sniper') kills.push({ slot: e.killer, at: { ...v.pos }, tick: match.tick });
      }
      for (const c of snipers) if (c.alive && c.bot!.vantage?.arrived && c.bot!.vantage.kind === 'sniper') posted++;
      // Two and a half seconds after a kill from a spot, the sniper is off it (or dead).
      for (const k of kills) {
        if (match.tick !== k.tick + Math.round(TICK_RATE * 2.5)) continue;
        const c = match.actor(k.slot)!;
        const v = c.bot!.vantage;
        if (!c.alive || !v || horizontalDistance(v.pos, k.at) > 1) moved++;
      }
    }
    match.destroy();
    expect(posted).toBeGreaterThan(TICK_RATE * 10);
    const due = kills.filter((k) => k.tick + TICK_RATE * 2.5 < TICK_RATE * 120).length;
    expect(moved).toBe(due);
  }, 180_000);
});

void createRng;
