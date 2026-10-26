import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BOT_DIFFICULTIES,
  CORE_BOT_PROFILES,
  DEFAULT_CTF_RULES,
  DEFAULT_ELIM_RULES,
  DEFAULT_KOTH_RULES,
  DEFAULT_TEAMS,
  FLAG_CARRIED,
  FLAG_DROPPED,
  FLAG_HOME,
  TICK_RATE,
  initPhysics,
  loadMap,
  playableModes,
  rulesForMap,
  rulesForMode,
  validateMap,
  type Faction,
  type GameEvent,
  type MapDocument,
} from '../src/index.ts';
import { CtfMode, ElimMode, KothMode, Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const [A, B] = DEFAULT_TEAMS as [Faction, Faction];

/** Three rooms in a row (x 0..16); team A spawns and keeps its flag in the west room, B in the east. */
function modeMap(mode: string, extra: MapDocument['entities'] = []): MapDocument {
  const map = makeMap(
    [
      { id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 },
      { id: 'room_m', tile: 'core.room', x: 1, y: 0, z: 0, rotation: 0 },
      { id: 'room_b', tile: 'core.room', x: 2, y: 0, z: 0, rotation: 0 },
    ],
    [[-2, 0, -2], [-2, 0, 2], [18, 0, -2], [18, 0, 2]],
  );
  map.metadata.supportedModes = [mode];
  map.entities.forEach((e, i) => {
    if (e.kind === 'spawn') e.faction = i < 2 ? A.id : B.id;
  });
  map.entities.push(...extra);
  return map;
}

const flagBases: MapDocument['entities'] = [
  { id: 'flag_a', kind: 'flag', position: [-1, 0, 0], yaw: 0, team: A.id },
  { id: 'flag_b', kind: 'flag', position: [17, 0, 0], yaw: 0, team: B.id },
];

const place = (c: Combatant, x: number, z = 0) => {
  c.move = { pos: { x, y: 0, z }, velY: 0, grounded: true };
};
const steps = (m: Match, n: number): GameEvent[] => {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) out.push(...m.step());
  return out;
};
const kill = (m: Match, c: Combatant) => (m as unknown as { kill(v: Combatant, k: Combatant | null, w: string): void }).kill(c, null, 'core.knife');

function ctfMatch(rules = DEFAULT_CTF_RULES) {
  const match = new Match(modeMap('core.ctf', flagBases), rules);
  const a = match.addHuman('a')!;
  const b = match.addHuman('b')!;
  const a2 = match.addHuman('a2')!;
  const b2 = match.addHuman('b2')!;
  // Park everyone in the middle room, clear of both flags.
  for (const [i, c] of [a, b, a2, b2].entries()) place(c, 6 + i, 2);
  steps(match, 2);
  return { match, a, b, a2, b2, ctf: match.mode as CtfMode };
}

describe('Capture the Flag', () => {
  it('is offered only on maps with a flag base for each team', () => {
    const map = modeMap('core.ctf', flagBases);
    expect(rulesForMap(map).mode).toBe('core.ctf');
    expect(playableModes(map)).toContain('core.ctf');
    const bare = modeMap('core.tdm');
    expect(playableModes(bare)).not.toContain('core.ctf');
    expect(rulesForMap(modeMap('core.ctf', [flagBases[0]!])).mode).toBe('core.deathmatch');
    // Listing CTF without both bases is a map error.
    expect(validateMap(modeMap('core.ctf', [flagBases[0]!])).some((i) => i.code === 'ctf.flag_missing' && i.severity === 'error')).toBe(true);
    expect(validateMap(modeMap('core.ctf', flagBases)).some((i) => i.severity === 'error')).toBe(false);
  });

  it('migrates a v10 map unchanged', () => {
    const map = modeMap('core.deathmatch');
    const loaded = loadMap({ ...map, formatVersion: 10 });
    expect(loaded.ok && loaded.migratedFrom).toBe(10);
  });

  it('touching the enemy flag picks it up: the carrier is slowed and kept off jetpacks and vehicles', () => {
    const { match, b, ctf } = ctfMatch();
    b.jetFuel = 50;
    place(b, -1.5, 0.5);
    const ev = steps(match, 1);
    expect(ev).toContainEqual({ e: 'flag', a: 'take', team: A.id, s: b.slot });
    const flag = ctf.flagOf(A.id)!;
    expect(flag.state).toBe(FLAG_CARRIED);
    expect(flag.carrier).toBe(b.slot);
    expect(match.privateState(b.slot)!.ms).toBe(850);
    expect(b.jetFuel).toBeNull();
    expect(ctf.blocksVehicle(b)).toBe(true);
    // Touching your own flag at home does nothing.
    const { match: m2, a: a2, ctf: c2 } = ctfMatch();
    place(a2, -1, 0);
    expect(steps(m2, 1).some((e) => e.e === 'flag')).toBe(false);
    expect(c2.flagOf(A.id)!.state).toBe(FLAG_HOME);
  });

  it('a carrier who dies drops the flag at their feet; a defender touching it sends it home', () => {
    const { match, a, b, ctf } = ctfMatch();
    place(b, -1, 0);
    steps(match, 1);
    place(b, 6, -1);
    steps(match, 1);
    kill(match, b);
    const ev = steps(match, 1);
    const flag = ctf.flagOf(A.id)!;
    expect(ev).toContainEqual({ e: 'flag', a: 'drop', team: A.id, s: b.slot });
    expect(flag.state).toBe(FLAG_DROPPED);
    expect(flag.pos.x).toBeCloseTo(6, 1);
    expect(b.modeSpeed).toBeUndefined();
    expect(match.snapshot([]).md!.fl![0]![1]).toBe(FLAG_DROPPED);
    place(a, 6.5, -1);
    expect(steps(match, 1)).toContainEqual({ e: 'flag', a: 'return', team: A.id, s: a.slot });
    expect(flag.state).toBe(FLAG_HOME);
    expect(flag.pos.x).toBe(-1);
  });

  it('a dropped flag goes home on its own after 30 s', () => {
    const { match, b, ctf } = ctfMatch();
    place(b, -1, 0);
    steps(match, 1);
    place(b, 6, -1);
    steps(match, 1);
    kill(match, b);
    steps(match, 2);
    expect(ctf.flagOf(A.id)!.state).toBe(FLAG_DROPPED);
    const ev = steps(match, 30 * TICK_RATE);
    expect(ev).toContainEqual({ e: 'flag', a: 'return', team: A.id, s: null });
    expect(ctf.flagOf(A.id)!.state).toBe(FLAG_HOME);
  });

  it('scores only while your own flag is home, and ends the round at the capture limit', () => {
    const { match, a, b, b2, ctf } = ctfMatch({ ...DEFAULT_CTF_RULES, scoreLimit: 2 });
    // Both flags taken.
    place(b, -1, 0);
    place(a, 17, 0);
    steps(match, 1);
    expect(ctf.flagOf(A.id)!.carrier).toBe(b.slot);
    expect(ctf.flagOf(B.id)!.carrier).toBe(a.slot);
    // B brings A's flag home, but B's own flag is away: no capture.
    place(b, 17, 0.4);
    place(a, 8, -2);
    let ev = steps(match, 2);
    expect(ev.some((e) => e.e === 'flag' && e.a === 'capture')).toBe(false);
    // A's carrier dies; the flag drops, a B player returns it, and now B's carrier scores.
    kill(match, a);
    steps(match, 1);
    place(b2, 8.3, -2);
    ev = steps(match, 1);
    expect(ev).toContainEqual({ e: 'flag', a: 'return', team: B.id, s: b2.slot });
    ev = steps(match, 1);
    expect(ev).toContainEqual({ e: 'flag', a: 'capture', team: A.id, s: b.slot });
    expect(match.teamScores().get(B.id)).toBe(1);
    expect(ctf.flagOf(A.id)!.state).toBe(FLAG_HOME);
    expect(b.modeSpeed).toBeUndefined();
    expect(match.snapshot([]).md!.ts).toEqual([0, 1]);
    // The capture is the carrier's on the scoreboard.
    expect(match.scores().find((e) => e.s === b.slot)?.o).toBe(1);
    expect(match.scores().find((e) => e.s === a.slot)?.o).toBeUndefined();
    // Kills don't count in CTF: only captures.
    expect(match.teamScores().get(A.id)).toBe(0);
    // Second capture reaches the limit.
    place(b, -1, 0);
    steps(match, 1);
    place(b, 17, 0);
    ev = steps(match, 1);
    expect(ev).toContainEqual({ e: 'flag', a: 'capture', team: A.id, s: b.slot });
    expect(ev).toContainEqual({ e: 'round_end', winner: null, team: B.id });
    expect(match.phase).toBe('intermission');
    // The next round starts with both flags home and no captures.
    steps(match, DEFAULT_CTF_RULES.intermissionTicks + 1);
    expect(match.teamScores().get(B.id)).toBe(0);
    expect(ctf.flags.every((f) => f.state === FLAG_HOME)).toBe(true);
  });

  it('a carrier who leaves the match drops the flag', () => {
    const { match, b, ctf } = ctfMatch();
    place(b, -1, 0);
    steps(match, 1);
    place(b, 7, 1);
    steps(match, 1);
    match.remove(b.slot);
    expect(ctf.flagOf(A.id)!.state).toBe(FLAG_DROPPED);
  });
});

describe('Capture the Flag with bots', () => {
  it('a bot-only 4v4 on Bunker Cross scores a capture within five minutes', () => {
    const loaded = loadMap(readFileSync(new URL('../../../maps/bunker_cross.json', import.meta.url), 'utf8'));
    if (!loaded.ok) throw new Error('bunker_cross failed to load');
    expect(playableModes(loaded.map)).toContain('core.ctf');
    const match = new Match(loaded.map, { ...rulesForMode(loaded.map, 'core.ctf'), scoreLimit: 0, timeLimitSeconds: 0 }, 42);
    for (let i = 0; i < 8; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal);
    const seen = new Set<string>();
    for (let t = 0; t < 5 * 60 * TICK_RATE && !seen.has('capture'); t++) for (const e of match.step()) if (e.e === 'flag') seen.add(e.a);
    match.destroy();
    expect([...seen].sort()).toContain('take');
    expect(seen.has('capture')).toBe(true);
  }, 120_000);
});

describe('King of the Hill', () => {
  const hills: MapDocument['entities'] = [
    { id: 'hill_1', kind: 'hill', position: [8, 0, 0], radius: 3 },
    { id: 'hill_2', kind: 'hill', position: [0, 0, 0], radius: 3 },
  ];

  it('scores a team for each second it alone holds the hill, which moves on a timer', () => {
    const match = new Match(modeMap('core.koth', hills), { ...DEFAULT_KOTH_RULES, hillSeconds: 4, scoreLimit: 100 });
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    const koth = match.mode as KothMode;
    place(a, 8, 0);
    place(b, 16, 0);
    let ev = steps(match, 2 * TICK_RATE);
    expect(ev).toContainEqual({ e: 'hill', a: 'hold', i: match.map.entities.findIndex((e) => e.id === 'hill_1'), team: A.id });
    expect(match.teamScores().get(A.id)).toBe(2);
    // Contested: nobody scores.
    place(b, 9, 1);
    ev = steps(match, TICK_RATE);
    expect(koth.holder).toBe('contested');
    expect(match.teamScores().get(A.id)).toBe(2);
    expect(match.teamScores().get(B.id)).toBe(0);
    // After 4 s the hill moves to the next spot.
    ev = steps(match, TICK_RATE + 2);
    expect(ev.some((e) => e.e === 'hill' && e.a === 'move')).toBe(true);
    expect(koth.hill.pos.x).toBe(0);
    expect(match.snapshot([]).md!.hl![0]).toBe(match.map.entities.findIndex((e) => e.id === 'hill_2'));
  });

  it('ends the round at the score limit and needs a hill to be offered', () => {
    const match = new Match(modeMap('core.koth', hills), { ...DEFAULT_KOTH_RULES, scoreLimit: 2 });
    const a = match.addHuman('a')!;
    match.addHuman('b');
    place(a, 8, 0);
    const ev = steps(match, 2 * TICK_RATE + 1);
    expect(ev).toContainEqual({ e: 'round_end', winner: null, team: A.id });
    expect(playableModes(modeMap('core.tdm'))).not.toContain('core.koth');
    expect(playableModes(modeMap('core.tdm', hills))).toContain('core.koth');
  });
});

describe('Elimination', () => {
  it('keeps the dead out until the round is won, then starts a new round for everyone', () => {
    const match = new Match(modeMap('core.elim'), { ...DEFAULT_ELIM_RULES, scoreLimit: 2 });
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    const a2 = match.addHuman('a2')!;
    const b2 = match.addHuman('b2')!;
    const elim = match.mode as ElimMode;
    steps(match, 2);
    kill(match, b);
    steps(match, DEFAULT_ELIM_RULES.respawnDelayTicks + 5);
    expect(b.alive).toBe(false);
    kill(match, b2);
    let ev = steps(match, 1);
    expect(ev).toContainEqual({ e: 'elim', a: 'win', round: 1, team: A.id });
    expect(match.teamScores().get(A.id)).toBe(1);
    expect(a.alive && a2.alive).toBe(true);
    ev = steps(match, 3 * TICK_RATE + 1);
    expect(ev).toContainEqual({ e: 'elim', a: 'start', round: 2, team: null });
    expect([a, b, a2, b2].every((c) => c.alive)).toBe(true);
    expect(elim.round).toBe(2);
    // Second round win reaches the limit.
    kill(match, b);
    kill(match, b2);
    ev = steps(match, 1);
    expect(ev).toContainEqual({ e: 'round_end', winner: null, team: A.id });
  });

  it('respawns as normal while only one team has players (warm-up)', () => {
    const match = new Match(modeMap('core.elim'), DEFAULT_ELIM_RULES);
    const a = match.addHuman('a')!;
    steps(match, 2);
    kill(match, a);
    steps(match, DEFAULT_ELIM_RULES.respawnDelayTicks + 5);
    expect(a.alive).toBe(true);
  });
});
