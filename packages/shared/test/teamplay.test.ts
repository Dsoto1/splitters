import { beforeAll, describe, expect, it } from 'vitest';
import { CORE_BOT_PROFILES, DEFAULT_DEATHMATCH_RULES, DEFAULT_RULES, PING, SAY_FOLLOW, initPhysics, type GameEvent } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));
/** A 40 × 16 m walled yard. */
const yard = () => {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4], [30, 0, 4]]);
};
const kill = (m: Match, victim: Combatant, killer: Combatant) => (m as unknown as { kill: (v: Combatant, k: Combatant, w: string) => void }).kill(victim, killer, 'core.rifle');

describe('kill streaks', () => {
  it('3 kills runs a UAV, 7 jams the enemy minimap, 9 hands over an airstrike; dying resets it', () => {
    const match = new Match(yard(), { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 1 });
    const me = match.addHuman('me')!;
    const foe = match.addHuman('foe')!;
    for (let i = 0; i < 5; i++) match.step();
    const events: GameEvent[] = [];
    const killFoe = () => {
      kill(match, foe, me);
      for (let i = 0; i < 10; i++) events.push(...match.step());
    };
    for (let k = 0; k < 3; k++) killFoe();
    expect(events.some((e) => e.e === 'streak' && e.s === me.slot && e.r === 0)).toBe(true);
    expect(match.privateState(me.slot)?.uv).toBeGreaterThan(0);
    expect(match.privateState(me.slot)?.ks).toBe(3);
    for (let k = 0; k < 4; k++) killFoe();
    expect(match.privateState(foe.slot)?.jm).toBeGreaterThan(0);
    expect(match.privateState(me.slot)?.jm).toBeUndefined();
    for (let k = 0; k < 2; k++) killFoe();
    expect(me.throwable?.kind).toBe('airstrike');
    kill(match, me, foe);
    expect(me.streak).toBe(0);
  });

  it('can be turned off', () => {
    const match = new Match(yard(), { ...DEFAULT_DEATHMATCH_RULES, killstreaks: false, respawnDelayTicks: 1 });
    const me = match.addHuman('me')!;
    const foe = match.addHuman('foe')!;
    for (let i = 0; i < 5; i++) match.step();
    const events: GameEvent[] = [];
    for (let k = 0; k < 3; k++) {
      kill(match, foe, me);
      for (let i = 0; i < 10; i++) events.push(...match.step());
    }
    expect(events.some((e) => e.e === 'streak')).toBe(false);
  });
});

describe('squad play', () => {
  it('a ping marks the spot you aim at, for your team', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2] });
    const me = match.addHuman('me')!;
    for (let i = 0; i < 5; i++) match.step();
    match.queueInputs(me.slot, [{ seq: 1, forward: 0, right: 0, yaw: Math.PI / 2, pitch: -0.2, buttons: 0, say: PING }]);
    const ev = match.step().find((e) => e.e === 'ping');
    expect(ev && ev.e === 'ping' && ev.team).toBe(me.faction);
  });

  it('"Follow me!" makes your team’s bots follow you; teammates respawn beside a teammate', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2], respawnDelayTicks: 1 });
    const me = match.addHuman('me')!;
    const bots = [0, 1, 2].map((i) => match.addBot(`b${i}`, CORE_BOT_PROFILES[1]!)!);
    const bot = bots.find((b) => b.faction === me.faction)!;
    // Only my teammate stays: the others would fight.
    for (const b of bots) if (b !== bot) match.remove(b.slot);
    for (let i = 0; i < 5; i++) match.step();
    me.move = { pos: { x: 20, y: 0, z: 10 }, velY: 0, grounded: true };
    bot.move = { pos: { x: 8, y: 0, z: 6 }, velY: 0, grounded: true };
    match.queueInputs(me.slot, [{ seq: 1, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0, say: SAY_FOLLOW }]);
    match.step();
    expect(bot.order?.kind).toBe('follow');
    for (let t = 0; t < 60 * 8; t++) {
      me.move = { pos: { x: 20, y: 0, z: 10 }, velY: 0, grounded: true };
      match.queueInputs(me.slot, [{ seq: 2 + t, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 }]);
      match.step();
    }
    expect(Math.hypot(bot.move.pos.x - 20, bot.move.pos.z - 10)).toBeLessThan(6);

    // The bot dies; it comes back next to me (the only teammate, out of any fight) most of the time.
    let beside = 0;
    for (let k = 0; k < 6; k++) {
      kill(match, bot, bot);
      for (let i = 0; i < 5; i++) match.step();
      if (bot.alive && Math.hypot(bot.move.pos.x - 20, bot.move.pos.z - 10) < 3) beside++;
    }
    expect(beside).toBeGreaterThanOrEqual(2);
  });
});

describe('rotating team spawns (maps without team bases)', () => {
  it('spawns you away from the enemy and near your team', () => {
    const tiles = [];
    for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
    // Shared spawns at both ends of the yard.
    const map = makeMap(tiles, [[2, 0, 3], [2, 0, 12], [37, 0, 3], [37, 0, 12]]);
    const match = new Match(map, { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2], respawnDelayTicks: 1, squadSpawn: false });
    const me = match.addHuman('me')!;
    const others = [0, 1, 2].map((i) => match.addHuman(`p${i}`)!);
    const mate = others.find((o) => o.faction === me.faction)!;
    const foes = others.filter((o) => o.faction !== me.faction);
    for (let i = 0; i < 5; i++) match.step();
    let west = 0;
    for (let k = 0; k < 8; k++) {
      // The enemy holds the east end; my teammate is in the west.
      for (const f of foes) f.move = { pos: { x: 34, y: 0, z: 8 }, velY: 0, grounded: true };
      mate.move = { pos: { x: 6, y: 0, z: 8 }, velY: 0, grounded: true };
      kill(match, me, me);
      for (let i = 0; i < 4; i++) match.step();
      if (me.alive && me.move.pos.x < 20) west++;
    }
    expect(west).toBe(8);
  });
});
