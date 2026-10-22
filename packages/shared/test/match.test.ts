import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, BUTTON_FIRE, CORE_BOT_PROFILES, getWeapon, DEFAULT_DEATHMATCH_RULES, MAX_PLAYER_SLOTS, PLAYER, initPhysics, lookAngles, type GameEvent } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { loadArena, makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const eye = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z });
const chest = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + 1.1, z: p.z });

function runTicks(match: Match, n: number, each?: () => void): GameEvent[] {
  const all: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    each?.();
    all.push(...match.step());
  }
  return all;
}

describe('Match', () => {
  it('lets a human shoot and kill another human, scoring the kill', () => {
    const map = makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[-2, 0, -2], [2, 0, 2]]);
    const match = new Match(map, { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 10_000 });
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    runTicks(match, 30); // settle onto the floor
    let seq = 0;
    const events = runTicks(match, 120, () => {
      const aim = lookAngles(eye(a.move.pos), chest(b.move.pos));
      match.queueInputs(a.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: aim.yaw, pitch: aim.pitch, buttons: BUTTON_FIRE }]);
    });
    const pistol = getWeapon('core.pistol');
    const shots = events.filter((e) => e.e === 'shot');
    const hits = shots.filter((e) => e.e === 'shot' && e.hit[0] === b.slot);
    expect(hits.length).toBe(Math.ceil(PLAYER.maxHealth / pistol.damage));
    // Fire rate is limited by the weapon's interval, not by how often the button is held.
    expect(shots.length).toBeLessThanOrEqual(Math.ceil(120 / pistol.fireIntervalTicks));
    expect(events).toContainEqual({ e: 'kill', killer: a.slot, victim: b.slot, weapon: 'core.pistol' });
    expect(a.kills).toBe(1);
    expect(b.deaths).toBe(1);
    expect(b.alive).toBe(false);
    expect(a.lastSeq).toBe(seq);
  });

  it('does not hit through walls', () => {
    const map = makeMap(
      [
        { id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 },
        { id: 'room_b', tile: 'core.room', x: 1, y: 0, z: 0, rotation: 0 },
      ],
      [[0, 0, 2], [8, 0, 2]],
    );
    const match = new Match(map);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    runTicks(match, 30);
    // A wall section stands between z=1.5..4 on the shared edge; the doorway is at |z| < 1.5.
    const aim = lookAngles(eye(a.move.pos), chest(b.move.pos));
    const events = runTicks(match, 60, () => match.queueInputs(a.slot, [{ seq: match.tick + 1, forward: 0, right: 0, yaw: aim.yaw, pitch: aim.pitch, buttons: BUTTON_FIRE }]));
    expect(events.some((e) => e.e === 'shot')).toBe(true);
    expect(events.some((e) => e.e === 'shot' && e.hit.some((h) => h !== null))).toBe(false);
    expect(b.health).toBe(PLAYER.maxHealth);
  });

  it('respawns the dead after the configured delay', () => {
    const map = makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[-2, 0, -2], [2, 0, 2]]);
    const match = new Match(map, { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 30 });
    const a = match.addHuman('a')!;
    a.health = 1;
    const b = match.addHuman('b')!;
    runTicks(match, 20);
    const aim = lookAngles(eye(b.move.pos), chest(a.move.pos));
    match.queueInputs(b.slot, [{ seq: 1, forward: 0, right: 0, yaw: aim.yaw, pitch: aim.pitch, buttons: BUTTON_FIRE }]);
    a.health = 1;
    runTicks(match, 1);
    expect(a.alive).toBe(false);
    runTicks(match, 29);
    expect(a.alive).toBe(false);
    const ev = runTicks(match, 1);
    expect(a.alive).toBe(true);
    expect(ev).toContainEqual({ e: 'spawn', s: a.slot });
  });

  it('ends the round at the score limit and restarts after intermission', () => {
    const map = makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[-2, 0, -2], [2, 0, 2]]);
    const match = new Match(map, { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 1, respawnDelayTicks: 5, intermissionTicks: 10 });
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    runTicks(match, 20);
    b.health = 1;
    const aim = lookAngles(eye(a.move.pos), chest(b.move.pos));
    match.queueInputs(a.slot, [{ seq: 1, forward: 0, right: 0, yaw: aim.yaw, pitch: aim.pitch, buttons: BUTTON_FIRE }]);
    const ev = runTicks(match, 1);
    expect(ev).toContainEqual({ e: 'round_end', winner: a.slot });
    expect(match.phase).toBe('intermission');
    const later = runTicks(match, 10);
    expect(later).toContainEqual({ e: 'round_start' });
    expect(match.phase).toBe('playing');
    expect(a.kills).toBe(0);
    expect(b.alive).toBe(true);
  });

  it('supports 32 player slots and rejects the 33rd', () => {
    const match = new Match(loadArena());
    for (let i = 0; i < MAX_PLAYER_SLOTS; i++) expect(match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % 4]!)).not.toBeNull();
    expect(match.addHuman('late')).toBeNull();
    match.remove(5);
    expect(match.addHuman('late')?.slot).toBe(5);
  });

  it('drops stale and duplicate input sequence numbers', () => {
    const match = new Match(makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }]));
    const a = match.addHuman('a')!;
    const inp = (seq: number) => ({ seq, forward: 1, right: 0, yaw: 0, pitch: 0, buttons: 0 });
    match.queueInputs(a.slot, [inp(1), inp(2), inp(2), inp(1), inp(3)]);
    expect(a.queue.map((i) => i.seq)).toEqual([1, 2, 3]);
  });
});

describe('Player Bots', () => {
  it('find, chase and kill an idle human on the arena using the navmesh', () => {
    const match = new Match(loadArena(), { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 60 }, 7);
    const human = match.addHuman('target')!;
    const bot = match.addBot('hunter', CORE_BOT_PROFILES[0]!, BOT_DIFFICULTIES.hard)!;
    let seq = 0;
    const events = runTicks(match, 60 * 60, () => match.queueInputs(human.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 }]));
    const kills = events.filter((e) => e.e === 'kill' && e.killer === bot.slot);
    expect(kills.length).toBeGreaterThanOrEqual(3);
    expect(bot.bot!.stuckCount).toBeLessThan(10);
  });

  it('run a 32-bot match without errors and keep everyone inside the map', () => {
    const match = new Match(loadArena(), DEFAULT_DEATHMATCH_RULES, 3);
    for (let i = 0; i < MAX_PLAYER_SLOTS; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % 4]!, BOT_DIFFICULTIES.normal);
    const events = runTicks(match, 60 * 20);
    expect(events.filter((e) => e.e === 'kill').length).toBeGreaterThan(10);
    expect(events.some((e) => e.e === 'kill' && e.weapon === 'core.fall')).toBe(false);
    for (const c of match.combatants()) expect(c.move.pos.y).toBeGreaterThan(-1);
  });
});
