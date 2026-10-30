import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_DEATHMATCH_RULES, DEFAULT_RULES, initPhysics, parseClientMessage, type GameEvent, type PlayerInput } from '../src/index.ts';
import { AWAY, BotFiller, Match, initNavigation } from '../src/match.ts';
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

const still = (seq: number): PlayerInput => ({ seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 });

describe('spectating by choice', () => {
  it('takes the player out of the match (a bot fills the place), keeps their slot and score, and puts them back', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2] }, 3);
    const filler = new BotFiller(match);
    filler.join('Host', undefined, 4);
    const ana = filler.join('Ana', undefined, 4)!;
    run(match, 30);
    ana.kills = 4;
    ana.deaths = 2;
    const slot = ana.slot;
    expect(filler.spectate(slot, 4)).toBe(true);
    // No body in the slot; the team is topped up by a bot; the roster lists her as a spectator on no team.
    expect(match.slots[slot]).toBeNull();
    expect(match.isSpectator(slot)).toBe(true);
    expect(match.combatants()).toHaveLength(4);
    expect(match.combatants().filter((c) => c.kind === 'human')).toHaveLength(1);
    expect(match.roster().find((p) => p.slot === slot)).toMatchObject({ name: 'Ana', sp: 1, team: null, bot: false });
    // Her snapshot has no private state and she isn't among the players.
    expect(match.privateState(slot)).toBeUndefined();
    expect(match.snapshot([]).players.some((p) => p.s === slot)).toBe(false);
    // A newcomer never takes the slot kept for her.
    const cleo = filler.join('Cleo', undefined, 4)!;
    expect(cleo.slot).not.toBe(slot);
    // Spectating twice, or a bot, does nothing.
    expect(filler.spectate(slot, 4)).toBe(false);
    const bot = match.combatants().find((c) => c.kind === 'bot')!;
    expect(filler.spectate(bot.slot, 4)).toBe(false);
    run(match, 30);
    // She joins again: same slot, her score, a bot gives way to keep the fill.
    const back = filler.rejoin(slot, 4)!;
    expect(back).toMatchObject({ slot, kind: 'human', name: 'Ana', kills: 4, deaths: 2 });
    expect(match.isSpectator(slot)).toBe(false);
    expect(match.combatants()).toHaveLength(4);
    expect(match.roster().some((p) => p.sp)).toBe(false);
    expect(filler.rejoin(slot, 4)).toBeNull();
  });

  it('a spectator who leaves frees the slot', () => {
    const match = new Match(yard(), DEFAULT_DEATHMATCH_RULES, 4);
    const filler = new BotFiller(match);
    const host = filler.join('Host', undefined, 3)!;
    const bea = filler.join('Bea', undefined, 3)!;
    filler.spectate(bea.slot, 3);
    expect(match.combatants()).toHaveLength(3);
    filler.leave(bea.slot, 3);
    expect(match.isSpectator(bea.slot)).toBe(false);
    expect(match.roster().map((p) => p.name)).not.toContain('Bea');
    expect(match.slots[host.slot]!.kind).toBe('human');
  });

  it("counts a spectator's camera input as activity: never marked away; removed only after the idle-kick time with no input at all", () => {
    const match = new Match(yard(), DEFAULT_DEATHMATCH_RULES, 5);
    const filler = new BotFiller(match);
    filler.join('Host', undefined, 2);
    const dan = filler.join('Dan', undefined, 2)!;
    const people = new Set([dan.slot]);
    filler.spectate(dan.slot, 2);
    run(match, 1);
    filler.input(dan.slot, [still(1)]);
    // Ten minutes of watching, sending camera input (sp) now and then: never away, never removed.
    let seq = 2;
    for (let s = 0; s < 600; s += 30) {
      run(match, 60 * 30);
      expect(filler.input(dan.slot, [{ ...still(seq++), sp: 1 }])).toBe(false);
      const w = filler.watch(2, people, AWAY.afkSeconds, 1);
      expect(w.away).toEqual([]);
      expect(w.kick).toEqual([]);
      expect(w.warn).toEqual([]);
    }
    expect(match.idleSeconds(dan.slot)).toBe(0);
    // Untouched inputs only, for longer than the idle-kick time: the host is told to remove them.
    run(match, 60 * 61);
    filler.input(dan.slot, [still(seq++)]);
    expect(filler.watch(2, people, AWAY.afkSeconds, 1).kick).toEqual([dan.slot]);
  });

  it('camera input alone (sp: a dead player watching, nothing else touched) keeps a player from being marked away', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2] }, 6);
    const filler = new BotFiller(match);
    filler.join('Host', undefined, 4);
    const eve = filler.join('Eve', undefined, 4)!;
    const people = new Set([eve.slot]);
    filler.input(eve.slot, [still(1)]);
    let seq = 2;
    for (let s = 0; s < AWAY.afkSeconds * 2; s++) {
      run(match, 60);
      // Same view, no keys: only the spectator flag says they're there.
      filler.input(eve.slot, [{ ...still(seq++), sp: 1 }]);
      const w = filler.watch(4, people, AWAY.afkSeconds);
      expect(w.away).toEqual([]);
      expect(w.warn).toEqual([]);
    }
    expect(filler.isAway(eve.slot)).toBe(false);
  });

  it('parses the spectate message and the input flag; refuses bad shapes', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'spectate', on: true }))).toEqual({ t: 'spectate', on: true });
    expect(parseClientMessage(JSON.stringify({ t: 'spectate', on: 1 }))).toBeNull();
    const msg = parseClientMessage(JSON.stringify({ t: 'input', inputs: [{ ...still(1), sp: 1 }, { ...still(2), sp: 'x' }] }));
    expect(msg).toEqual({ t: 'input', inputs: [{ ...still(1), sp: 1 }, still(2)] });
  });
});
