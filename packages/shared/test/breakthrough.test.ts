import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  MAP_FORMAT_VERSION,
  loadMap,
  migrateMapDocument,
  serializeMap,
  BT_OBJ_ACTIVE,
  BT_OBJ_DONE,
  BT_OBJ_PLANTED,
  BT_OBJ_SKIPPED,
  BT_OBJ_WAITING,
  BT_ROUND_ATTACKERS,
  BT_ROUND_DEFENDERS,
  BUTTON_USE,
  CORE_BOT_PROFILES,
  BOT_DIFFICULTIES,
  DEFAULT_RULES,
  breakthroughIssues,
  breakthroughMinutesFor,
  breakthroughPoolFor,
  initPhysics,
  mapCanRun,
  modeOptions,
  playableModes,
  rulesFromSetup,
  suggestedLimits,
  type GameEvent,
  type MapDocument,
  type MatchRules,
  type MatchSetup,
} from '../src/index.ts';
import { BT_FALLBACK_SECONDS, BT_FUSE_SECONDS, Match, initNavigation, type BreakthroughMode, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const TICKS = 60;
type Entity = MapDocument['entities'][number];

/**
 * A 24 × 80 m range (3 × 10 yard cells, z from -4 to 76) pushed along +z in three sectors:
 * 1 "The beach" (line z 0): capture zones A1 and A2 (5 s each);
 * 2 "The guns" (line z 28): targets B1, B2, B3, two of three to destroy;
 * 3 "The fort" (line z 56): a final hold C (6 s).
 * Each sector has an attackers' spawn group just before its line and a defenders' one beyond it.
 */
function range(): MapDocument {
  const tiles = [];
  for (let x = 0; x < 3; x++) for (let y = 0; y < 10; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, []);
  map.metadata.supportedModes = ['core.breakthrough', 'core.tdm'];
  const e = (x: Entity) => map.entities.push(x);
  const sector = (id: string, order: number, z: number, name: string, extra: object = {}) => e({ id, kind: 'sector', position: [8, 0, z], yaw: 0, order, name, ...extra } as Entity);
  const obj = (id: string, objective: 'zone' | 'target' | 'final', sector: number, label: string, x: number, z: number, radius: number, seconds?: number) =>
    e({ id, kind: 'objective', objective, sector, label, position: [x, 0, z], yaw: 0, radius, ...(seconds ? { seconds } : {}) } as Entity);
  const spawn = (id: string, sector: number, side: 'attack' | 'defend', x: number, z: number) => e({ id, kind: 'spawn', position: [x, 0, z], yaw: side === 'attack' ? 0 : Math.PI, faction: null, sector, side } as Entity);
  sector('sec_one', 1, 0, 'The beach');
  sector('sec_two', 2, 28, 'The guns', { need: 2 });
  sector('sec_three', 3, 56, 'The fort');
  obj('obj_a1', 'zone', 1, 'A1', 2, 16, 3, 5);
  obj('obj_a2', 'zone', 1, 'A2', 14, 16, 3, 5);
  obj('obj_b1', 'target', 2, 'B1', 0, 42, 2);
  obj('obj_b2', 'target', 2, 'B2', 8, 42, 2);
  obj('obj_b3', 'target', 2, 'B3', 16, 42, 2);
  obj('obj_c', 'final', 3, 'C', 8, 68, 4, 6);
  for (const [s, az, dz] of [[1, 0, 24], [2, 24, 50], [3, 52, 74]] as const) {
    spawn(`spawn_a${s}a`, s, 'attack', 4, az);
    spawn(`spawn_a${s}b`, s, 'attack', 12, az);
    spawn(`spawn_d${s}a`, s, 'defend', 4, dz);
    spawn(`spawn_d${s}b`, s, 'defend', 12, dz);
  }
  return map;
}

function setup(rules: Partial<MatchRules> = {}) {
  const match = new Match(range(), { ...DEFAULT_RULES['core.breakthrough'], teamSizes: [1, 1], ...rules });
  const a = match.addHuman('att')!;
  const d = match.addHuman('def')!;
  const mode = match.mode as unknown as BreakthroughMode;
  const att = [a, d].find((c) => c.faction === mode.attackers)!;
  const def = att === a ? d : a;
  let seq = 0;
  const events: GameEvent[] = [];
  const step = (n: number, each?: () => void) => {
    for (let i = 0; i < n; i++) {
      for (const c of [att, def]) match.queueInputs(c.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 }]);
      each?.();
      events.push(...match.step());
    }
  };
  const press = (c: Combatant) => match.queueInputs(c.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: BUTTON_USE }]);
  const put = (c: Combatant, x: number, z: number) => (c.move = { pos: { x, y: 0, z }, velY: 0, grounded: true });
  /** Kill a player as the match does (the private damage path, so the mode hears about it). */
  const kill = (c: Combatant) => (match as unknown as { damage(v: Combatant, n: number, a: Combatant | null, w: string): void }).damage(c, 10_000, null, 'core.fall');
  const state = (id: string) => {
    const i = match.map.entities.findIndex((x) => x.id === id);
    return match.snapshot([]).md!.bo!.find((r) => r[0] === i)!;
  };
  step(5);
  return { match, mode, att, def, step, press, put, kill, events, state };
}

type Setup = ReturnType<typeof setup>;

/** The attacker stands in both beach zones in turn (the defender far away) until sector 1 falls. */
function takeBeach(s: Setup): void {
  s.put(s.def, 8, 74);
  s.step(5 * TICKS + 10, () => s.put(s.att, 2, 16));
  s.step(5 * TICKS + 10, () => s.put(s.att, 14, 16));
}

/** Plant at a target and keep everyone away until it goes off. */
function blow(s: Setup, x: number, z: number): void {
  s.put(s.att, x, z);
  s.step(1);
  s.press(s.att);
  s.step(3 * TICKS + 5, () => s.put(s.def, 8, 74));
  s.put(s.att, 4, 24);
  s.step(BT_FUSE_SECONDS * TICKS + 5, () => {
    s.put(s.def, 8, 74);
    s.put(s.att, 4, 24);
  });
}

describe('Breakthrough', () => {
  it('runs only on maps that define sectors, and those offer it', () => {
    expect(mapCanRun(makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }]), 'core.breakthrough')).toBe(false);
    expect(mapCanRun(range(), 'core.breakthrough')).toBe(true);
    expect(playableModes(range())).toContain('core.breakthrough');
    expect(playableModes(makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }]))).not.toContain('core.breakthrough');
  });

  it('takes sectors in order: later objectives wait, sectors are read by their order', () => {
    const s = setup();
    expect(s.mode.sectors.map((x) => x.name)).toEqual(['The beach', 'The guns', 'The fort']);
    expect(s.mode.active).toBe(0);
    expect(s.state('obj_a1')[1]).toBe(BT_OBJ_ACTIVE);
    expect(s.state('obj_b1')[1]).toBe(BT_OBJ_WAITING);
    expect(s.state('obj_c')[1]).toBe(BT_OBJ_WAITING);
    // Standing on a later sector's target does nothing yet.
    s.put(s.att, 0, 42);
    s.step(1);
    s.press(s.att);
    s.step(4 * TICKS, () => s.put(s.def, 8, 74));
    expect(s.state('obj_b1')[1]).toBe(BT_OBJ_WAITING);
    takeBeach(s);
    expect(s.events.filter((e) => e.e === 'bt' && e.a === 'capture').length).toBe(2);
    const fell = s.events.find((e) => e.e === 'bt' && e.a === 'sector');
    expect(fell && fell.e === 'bt' && fell.n).toBe(0);
    expect(s.mode.active).toBe(1);
    expect(s.state('obj_b1')[1]).toBe(BT_OBJ_ACTIVE);
    expect(s.state('obj_c')[1]).toBe(BT_OBJ_WAITING);
  });

  it('a capture zone is contested while a defender stands in it, slips back with only defenders, and is taken by attackers alone', () => {
    const s = setup();
    s.step(2 * TICKS, () => s.put(s.att, 2, 16));
    const half = s.state('obj_a1')[2];
    expect(half).toBeGreaterThanOrEqual(35);
    // A defender steps in: contested, nothing moves.
    s.step(2 * TICKS, () => {
      s.put(s.att, 2, 16);
      s.put(s.def, 3, 16);
    });
    expect(Math.abs(s.state('obj_a1')[2] - half)).toBeLessThanOrEqual(1);
    expect(s.state('obj_a1')[3]).toBe(3);
    // Only the defender: it slips back.
    s.step(TICKS, () => {
      s.put(s.att, 4, 2);
      s.put(s.def, 3, 16);
    });
    expect(s.state('obj_a1')[2]).toBeLessThan(half);
    // The attacker alone again: captured, and it stays captured.
    s.step(5 * TICKS, () => {
      s.put(s.att, 2, 16);
      s.put(s.def, 8, 74);
    });
    expect(s.state('obj_a1')[1]).toBe(BT_OBJ_DONE);
    s.step(TICKS, () => s.put(s.def, 2, 16));
    expect(s.state('obj_a1')[1]).toBe(BT_OBJ_DONE);
    expect(s.att.objective).toBeGreaterThanOrEqual(1);
  });

  it('targets: an attacker plants (Use, hold still), a defender defuses, a charge goes off after the fuse; two of three take the sector', () => {
    const s = setup();
    takeBeach(s);
    // Plant at B1, then the defender defuses it.
    s.put(s.att, 0, 42);
    s.step(1);
    s.press(s.att);
    s.step(3 * TICKS + 5, () => s.put(s.def, 8, 74));
    expect(s.state('obj_b1')[1]).toBe(BT_OBJ_PLANTED);
    expect(s.state('obj_b1')[3]).toBeGreaterThan(BT_FUSE_SECONDS - 2);
    s.put(s.att, 4, 24);
    // Walking off part way through cancels a defuse.
    s.put(s.def, 0.5, 42);
    s.step(1);
    s.press(s.def);
    s.step(TICKS);
    s.put(s.def, 6, 46);
    s.step(10);
    expect(s.state('obj_b1')[1]).toBe(BT_OBJ_PLANTED);
    s.put(s.def, 0.5, 42);
    s.step(1);
    s.press(s.def);
    s.step(5 * TICKS + 5, () => s.put(s.att, 4, 24));
    expect(s.events.some((e) => e.e === 'bt' && e.a === 'defuse')).toBe(true);
    expect(s.state('obj_b1')[1]).toBe(BT_OBJ_ACTIVE);
    // Now two go off: the sector falls with the third standing, which is no longer needed.
    blow(s, 0, 42);
    expect(s.state('obj_b1')[1]).toBe(BT_OBJ_DONE);
    expect(s.mode.active).toBe(1);
    blow(s, 8, 42);
    expect(s.events.filter((e) => e.e === 'bt' && e.a === 'destroy').length).toBe(2);
    expect(s.mode.active).toBe(2);
    expect(s.state('obj_b3')[1]).toBe(BT_OBJ_SKIPPED);
    expect(s.state('obj_c')[1]).toBe(BT_OBJ_ACTIVE);
  });

  it('spawns move up as a sector falls, and defenders behind the new line are warned, then hurt', () => {
    const s = setup();
    // Round start: each side at its sector 1 group.
    s.kill(s.att);
    s.kill(s.def);
    s.step(10 * TICKS);
    expect(s.att.alive && s.att.move.pos.z < 6).toBe(true);
    expect(s.def.alive && s.def.move.pos.z > 20 && s.def.move.pos.z < 28).toBe(true);
    takeBeach(s);
    // Respawns now come at sector 2's groups.
    s.kill(s.att);
    s.kill(s.def);
    s.step(10 * TICKS, () => undefined);
    expect(s.att.alive && Math.abs(s.att.move.pos.z - 24) < 4).toBe(true);
    expect(s.def.alive && Math.abs(s.def.move.pos.z - 50) < 4).toBe(true);
    // A defender back on the beach: warned for BT_FALLBACK_SECONDS, unhurt; then it hurts.
    s.put(s.att, 4, 24);
    s.step(TICKS, () => s.put(s.def, 8, 10));
    const warned = s.match.snapshot([]).md!.bf ?? [];
    expect(warned.some(([slot, secs]) => slot === s.def.slot && secs > 0 && secs <= BT_FALLBACK_SECONDS)).toBe(true);
    expect(s.def.health).toBe(s.def.maxHealth);
    s.step((BT_FALLBACK_SECONDS - 1) * TICKS + 30, () => s.put(s.def, 8, 10));
    expect(s.def.health).toBeLessThan(s.def.maxHealth);
    // Back over the line: the warning goes.
    s.step(5, () => s.put(s.def, 8, 34));
    expect((s.match.snapshot([]).md!.bf ?? []).some(([slot]) => slot === s.def.slot)).toBe(false);
  });

  it('the pool: each attacker death costs one, a sector taken tops it up; spent, the fallen stay down and the defenders win', () => {
    const s = setup({ breakthroughPool: 2 });
    expect(s.mode.pool).toBe(2);
    expect(s.match.snapshot([]).md!.bt![4]).toBe(2);
    s.kill(s.att);
    expect(s.mode.pool).toBe(1);
    s.step(5 * TICKS);
    expect(s.att.alive).toBe(true);
    // Defenders: no cost, a slower respawn than the attackers'.
    s.kill(s.def);
    expect(s.mode.pool).toBe(1);
    expect(s.def.respawnTick - s.match.tick).toBeGreaterThan(s.match.rules.respawnDelayTicks);
    s.step(8 * TICKS);
    takeBeach(s);
    expect(s.mode.pool).toBe(2);
    s.kill(s.att);
    s.step(5 * TICKS);
    s.kill(s.att);
    s.step(2);
    expect(s.mode.pool).toBe(0);
    expect(s.events.some((e) => e.e === 'bt' && e.a === 'pool' && e.n === 0)).toBe(true);
    // That death spent the last one: back once more, and the next is for good.
    s.step(5 * TICKS);
    expect(s.att.alive).toBe(true);
    expect(s.match.phase).toBe('playing');
    s.kill(s.att);
    s.step(2);
    expect(s.att.respawnTick).toBe(Infinity);
    const won = s.events.find((e) => e.e === 'bt' && e.a === 'round');
    expect(won && won.e === 'bt' && won.team).toBe(s.def.faction);
    expect(s.match.phase).toBe('intermission');
    const end = s.events.find((e) => e.e === 'round_end');
    expect(end && end.e === 'round_end' && end.team).toBe(s.def.faction);
  });

  it('the clock: each sector puts its time on, out of time the defenders win, a burning charge plays on', () => {
    const s = setup({ breakthroughSectorSeconds: 60 });
    expect(s.match.snapshot([]).md!.bt![5]).toBeGreaterThan(55);
    expect(s.match.timeLeftSeconds()).toBe(s.match.snapshot([]).md!.bt![5]);
    takeBeach(s);
    const left = s.mode.timeLeft;
    // About 60 - 10.5 s used + 60 for sector 2.
    expect(left).toBeGreaterThan(100);
    expect(left).toBeLessThanOrEqual(110);
    // Plant with a few seconds to go: the round plays on past the clock until it goes off.
    s.step((left - 5) * TICKS, () => {
      s.put(s.att, 4, 24);
      s.put(s.def, 8, 74);
    });
    s.put(s.att, 8, 42);
    s.step(1);
    s.press(s.att);
    s.step(3 * TICKS + 5, () => s.put(s.def, 8, 74));
    expect(s.state('obj_b2')[1]).toBe(BT_OBJ_PLANTED);
    s.put(s.att, 4, 24);
    s.step(3 * TICKS, () => s.put(s.def, 8, 74));
    expect(s.mode.timeLeft).toBe(0);
    expect(s.mode.outcome).toBe(0);
    expect(s.match.phase).toBe('playing');
    s.step(BT_FUSE_SECONDS * TICKS, () => s.put(s.def, 8, 74));
    expect(s.events.some((e) => e.e === 'bt' && e.a === 'destroy')).toBe(true);
    // Gone off, nothing burning, no time: the defenders hold.
    s.step(2);
    expect(s.mode.outcome).toBe(BT_ROUND_DEFENDERS);
    expect(s.match.phase).toBe('intermission');
  });

  it('the final hold ends the round: the attackers win when the last sector falls', () => {
    const s = setup();
    takeBeach(s);
    blow(s, 0, 42);
    blow(s, 8, 42);
    s.step(6 * TICKS + 10, () => {
      s.put(s.att, 8, 68);
      s.put(s.def, 8, 30);
    });
    expect(s.mode.outcome).toBe(BT_ROUND_ATTACKERS);
    const end = s.events.find((e) => e.e === 'round_end');
    expect(end && end.e === 'round_end' && end.team).toBe(s.att.faction);
    expect(s.match.teamScores().get(s.att.faction!)).toBe(3);
  });

  it('a second round swaps the sides; the better attack wins (sectors, then the time left)', () => {
    const s = setup({ breakthroughSwap: true, breakthroughPool: 1 });
    const first = s.att;
    const second = s.def;
    // Round 1: the first team takes the beach, then runs out of reinforcements.
    takeBeach(s);
    s.kill(first);
    s.step(5 * TICKS);
    s.kill(first);
    s.step(5 * TICKS);
    s.kill(first);
    s.step(2);
    s.kill(first);
    s.step(2);
    expect(s.events.some((e) => e.e === 'bt' && e.a === 'round' && e.n === 1)).toBe(true);
    expect(s.match.phase).toBe('playing');
    // The break, then round 2 with the sides swapped.
    s.step(9 * TICKS);
    expect(s.events.some((e) => e.e === 'bt' && e.a === 'start' && e.n === 2 && e.team === second.faction)).toBe(true);
    expect(s.mode.attackers).toBe(second.faction);
    expect(s.mode.active).toBe(0);
    expect(s.state('obj_a1')[1]).toBe(BT_OBJ_ACTIVE);
    // The second team takes the beach too, but slower (it waits 5 s first), and then fails.
    s.put(first, 8, 74);
    s.step(5 * TICKS, () => s.put(second, 4, 2));
    s.step(5 * TICKS + 10, () => s.put(second, 2, 16));
    s.step(5 * TICKS + 10, () => s.put(second, 14, 16));
    expect(s.mode.active).toBe(1);
    for (let i = 0; i < 4 && s.match.phase === 'playing'; i++) {
      s.kill(second);
      s.step(5 * TICKS);
    }
    expect(s.match.phase).toBe('intermission');
    expect(s.match.teamScores().get(first.faction!)).toBe(1);
    expect(s.match.teamScores().get(second.faction!)).toBe(1);
    // One sector each: the first team took its sector with more time left, so it wins the match.
    const end = s.events.find((e) => e.e === 'round_end');
    expect(end && end.e === 'round_end' && end.team).toBe(first.faction);
  });

  it('format v28: a v27 map migrates unchanged, and a map with sectors saves and loads', () => {
    expect(MAP_FORMAT_VERSION).toBe(28);
    const v27 = { ...JSON.parse(readFileSync(new URL('./fixtures/iron_compound_v26.json', import.meta.url), 'utf8')), formatVersion: 27 };
    const { doc, fromVersion } = migrateMapDocument(structuredClone(v27));
    expect(fromVersion).toBe(27);
    expect(doc).toEqual({ ...v27, formatVersion: 28 });
    const back = loadMap(serializeMap(range()));
    expect(back.ok && back.map.entities.filter((e) => e.kind === 'sector' || e.kind === 'objective').length).toBe(9);
    expect(back.ok && back.map.entities.filter((e) => e.kind === 'spawn' && e.side === 'defend' && e.sector === 2).length).toBe(2);
  });

  it('checks the sectors in MapMaker: complete order, objectives and both spawn groups per sector', () => {
    expect(breakthroughIssues(range())).toEqual([]);
    const map = range();
    map.entities = map.entities.filter((e) => e.id !== 'spawn_d2a' && e.id !== 'spawn_d2b' && e.id !== 'obj_c');
    const sec = map.entities.find((e) => e.id === 'sec_three');
    if (sec?.kind === 'sector') sec.order = 4;
    const codes = breakthroughIssues(map).map((i) => `${i.severity} ${i.code}`);
    expect(codes).toContain('error breakthrough.no_spawns');
    expect(codes).toContain('error breakthrough.order_gap');
    expect(codes).toContain('error breakthrough.no_objectives');
    expect(breakthroughIssues(makeMap([]))).toEqual([]);
  });

  it('Match Setup offers it only on maps with sectors; reinforcements, sector time and the second round come from the setup, the suggestions follow the size', () => {
    const room = makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }]);
    expect(modeOptions(range(), playableModes(range())).find((o) => o.mode === 'core.breakthrough')).toEqual({ mode: 'core.breakthrough', ok: true });
    expect(modeOptions(room, playableModes(room)).find((o) => o.mode === 'core.breakthrough')).toMatchObject({ ok: false, reason: expect.stringMatching(/sectors/) });
    // Small teams get more lives each and shorter sectors; big ones fewer and longer.
    expect(suggestedLimits('core.breakthrough', 8, [4, 4])).toEqual({ scoreLimit: breakthroughPoolFor(4), minutes: breakthroughMinutesFor(4) });
    expect(breakthroughPoolFor(4)).toBeGreaterThan(breakthroughPoolFor(24));
    expect(breakthroughMinutesFor(4)).toBeLessThan(breakthroughMinutesFor(24));
    const setup: MatchSetup = { map: 'range', mode: 'core.breakthrough', bots: 0, skill: 'normal', scoreLimit: 7, minutes: 3, teams: [6, 6, 6], btSwap: true };
    const { rules, fill } = rulesFromSetup(setup, range());
    expect(rules).toMatchObject({ mode: 'core.breakthrough', breakthroughPool: 7, breakthroughSectorSeconds: 180, breakthroughSwap: true, scoreLimit: 0, timeLimitSeconds: 0, teamSizes: [6, 6] });
    expect(fill).toBe(12);
    // Following the suggestion: 16 a side.
    const auto = rulesFromSetup({ ...setup, teams: [16, 16], scoreAuto: true, timeAuto: true, btSwap: false }, range()).rules;
    expect(auto).toMatchObject({ breakthroughPool: breakthroughPoolFor(16), breakthroughSectorSeconds: breakthroughMinutesFor(16) * 60 });
    expect(auto.breakthroughSwap).toBeUndefined();
  });

  it('is deterministic by seed: the same bots on the same seed play the same match', () => {
    const play = () => {
      const match = new Match(range(), { ...DEFAULT_RULES['core.breakthrough'], teamSizes: [3, 3] }, 7);
      for (let i = 0; i < 6; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal);
      const log: string[] = [];
      for (let t = 0; t < 30 * TICKS; t++) {
        for (const e of match.step()) if (e.e === 'bt' || e.e === 'kill') log.push(`${match.tick} ${JSON.stringify(e)}`);
        if (t % TICKS === 0) log.push(JSON.stringify(match.snapshot([]).md));
      }
      match.destroy();
      return log;
    };
    const a = play();
    expect(a.length).toBeGreaterThan(30);
    expect(play()).toEqual(a);
  });
});
