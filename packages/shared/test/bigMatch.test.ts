import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, DEFAULT_DEATHMATCH_RULES, DEFAULT_RULES, INTEREST_MIN_PLAYERS, MAX_PLAYER_SLOTS, SNAPSHOT_INTERVAL_TICKS, encodeSnapshots, initPhysics, interestFor, loadMap, rulesForMode, type GameEvent, type PlayerSnapshot, type SnapshotBody } from '../src/index.ts';
import { BotFiller, Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const yard = () => {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4], [30, 0, 4], [10, 0, 10], [20, 0, 10]]);
};

const run = (m: Match, n: number): GameEvent[] => {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) out.push(...m.step());
  return out;
};

describe('players take over bots', () => {
  it('a joining player takes a bot’s place where it stands, on the team that needs a player, keeping its loadout', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2] }, 5);
    const filler = new BotFiller(match);
    const host = filler.join('Host', undefined, 4)!;
    expect(match.combatants()).toHaveLength(4);
    run(match, 90);
    // The host's team already has a person: the newcomer goes to the other one, into a bot's body.
    const before = new Map(match.combatants().filter((c) => c.kind === 'bot').map((c) => [c.slot, { name: c.name, pos: { ...c.move.pos }, weapons: [...c.weapons.keys()], kills: c.kills, alive: c.alive }]));
    const ana = filler.join('Ana', undefined, 4)!;
    const was = before.get(ana.slot)!;
    expect(was).toBeDefined();
    expect(ana.faction).not.toBe(host.faction);
    expect(match.combatants()).toHaveLength(4);
    expect(ana.kind).toBe('human');
    expect(ana.bot).toBeUndefined();
    expect(ana.alive).toBe(was.alive);
    expect(ana.move.pos).toEqual(was.pos);
    expect([...ana.weapons.keys()]).toEqual(was.weapons);
    expect(ana.kills).toBe(was.kills);
    expect(match.step().find((e) => e.e === 'takeover')).toEqual({ e: 'takeover', s: ana.slot, to: 'Ana', from: was.name });
    // Its inputs start from seq 1 like any new player.
    match.queueInputs(ana.slot, [{ seq: 1, forward: 1, right: 0, yaw: 0, pitch: 0, buttons: 0 }]);
    expect(ana.queue).toHaveLength(1);
  });

  it('a leaving player hands their place back to a bot where they were (or not, when take-back is off)', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2] }, 6);
    const filler = new BotFiller(match);
    filler.join('Host', undefined, 4);
    run(match, 30);
    const ana = filler.join('Ana', undefined, 4)!;
    run(match, 60);
    const slot = ana.slot;
    const pos = { ...ana.move.pos };
    filler.leave(slot, 4);
    const back = match.slots[slot]!;
    expect(back.kind).toBe('bot');
    expect(back.bot).toBeDefined();
    expect(back.move.pos).toEqual(pos);
    expect(match.step().find((e) => e.e === 'takeover')).toMatchObject({ s: slot, from: 'Ana', bot: 1 });
    expect(match.combatants()).toHaveLength(4);
    // The bot plays on.
    run(match, 60);
    expect(back.bot!.state).not.toBe('dead');

    const off = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2] }, 6);
    const plain = new BotFiller(off, BOT_DIFFICULTIES.normal, { takeBack: false });
    plain.join('Host', undefined, 4);
    const bea = plain.join('Bea', undefined, 4)!;
    plain.leave(bea.slot, 4);
    expect(off.combatants()).toHaveLength(4);
    expect(off.combatants().filter((c) => c.kind === 'human')).toHaveLength(1);
    expect(off.step().some((e) => e.e === 'takeover' && e.bot)).toBe(false);
  });

  it('a match without bots to take over gives the newcomer a free slot, and a full one turns them away', () => {
    const match = new Match(yard(), DEFAULT_DEATHMATCH_RULES, 1);
    const filler = new BotFiller(match);
    expect(filler.join('A', undefined, 1)!.kind).toBe('human');
    expect(match.combatants()).toHaveLength(1);
    expect(filler.join('B', undefined, 1)!.kind).toBe('human');
    for (let i = 2; i < MAX_PLAYER_SLOTS; i++) match.addHuman(`p${i}`);
    expect(filler.join('late', undefined, 1)).toBeNull();
  });
});

describe('interest management', () => {
  const player = (s: number, x: number, alive: 0 | 1 = 1): PlayerSnapshot => ({ s, p: [x, 0, 0], vy: 0, g: 1, yaw: 0, pitch: 0, hp: 100, ar: 0, alive, w: 1, pu: 0 });
  const body = (players: PlayerSnapshot[], tick: number): SnapshotBody => ({ tick, phase: 'playing', timeLeft: 0, players, score: [], ev: [], pr: [], pk: [], np: [] });

  it('small matches send everyone every time', () => {
    const players = Array.from({ length: INTEREST_MIN_PLAYERS }, (_, i) => player(i, i * 20));
    const [text] = encodeSnapshots(body(players, 10), [{ slot: 0, ack: 3 }]);
    const msg = JSON.parse(text!);
    expect(msg.players).toHaveLength(INTEREST_MIN_PLAYERS);
    expect(msg.hold).toBeUndefined();
    expect(msg.ack).toBe(3);
  });

  it('big matches send far players less often, near ones and yourself every time, and say who was held back', () => {
    const players = Array.from({ length: 96 }, (_, i) => player(i, i < 10 ? i : i < 40 ? 100 : 400));
    const seen = new Map<number, number>();
    const snaps = 8;
    for (let k = 0; k < snaps; k++) {
      const b = body(players, k * SNAPSHOT_INTERVAL_TICKS);
      const { send, hold } = interestFor(b, 0);
      expect(send.length + hold.length).toBe(96);
      for (const i of send) seen.set(players[i]!.s, (seen.get(players[i]!.s) ?? 0) + 1);
      const msg = JSON.parse(encodeSnapshots(b, [{ slot: 0, ack: 1, me: { inv: [], rl: 0, rs: 0, sp: 0, dm: 0 } }])[0]!);
      expect(msg.players.length + msg.hold.length).toBe(96);
      expect(msg.me).toBeDefined();
    }
    expect(seen.get(0)).toBe(snaps);
    expect(seen.get(5)).toBe(snaps);
    expect(seen.get(20)).toBe(snaps / 2);
    expect(seen.get(60)).toBe(snaps / 4);
    // A dead viewer (spectating) gets everyone.
    const dead = players.map((p) => (p.s === 0 ? player(0, 0, 0) : p));
    expect(interestFor(body(dead, 2), 0).hold).toHaveLength(0);
  });
});

describe('96 players', () => {
  it(`runs ${MAX_PLAYER_SLOTS} bots on Frost Basin within the tick budget (bench, generous threshold)`, () => {
    expect(MAX_PLAYER_SLOTS).toBe(96);
    const loaded = loadMap(readFileSync(fileURLToPath(new URL('../../../maps/frost_basin.json', import.meta.url)), 'utf8'));
    if (!loaded.ok) throw new Error('Frost Basin failed to load');
    const map = loaded.map;
    const match = new Match(map, { ...rulesForMode(map, 'core.tdm'), teamSizes: [48, 48], scoreLimit: 0, timeLimitSeconds: 0 }, 42);
    for (let i = 0; i < MAX_PLAYER_SLOTS; i++) expect(match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal)).not.toBeNull();
    const teams = new Map<string | null, number>();
    for (const c of match.combatants()) teams.set(c.faction, (teams.get(c.faction) ?? 0) + 1);
    expect([...teams.values()]).toEqual([48, 48]);
    const ticks = 60 * 15;
    let total = 0;
    let max = 0;
    for (let i = 0; i < ticks; i++) {
      const t0 = performance.now();
      match.step();
      const ms = performance.now() - t0;
      total += ms;
      max = Math.max(max, ms);
    }
    const avg = total / ticks;
    console.log(`96 bots on Frost Basin: avg tick ${avg.toFixed(2)} ms, max ${max.toFixed(1)} ms (target avg < 8 ms; pnpm bench 96 60 maps/frost_basin.json --mode=core.tdm)`);
    // Generous: shared CI runners are slow and noisy. The real budget is 16.7 ms a tick.
    expect(avg).toBeLessThan(30);
    for (const c of match.combatants()) expect(c.move.pos.y).toBeGreaterThan(match.killY);
    match.destroy();
  }, 180_000);
});
