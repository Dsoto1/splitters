import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_FIRE, DEFAULT_DEATHMATCH_RULES, TICK_RATE, initPhysics } from '../src/index.ts';
import { BotFiller, COUNTDOWN_SECONDS, Match, START_WAIT_SECONDS, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const room = () => makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[-2, 0, -2], [2, 0, 2]]);
const run = (m: Match, ticks: number) => {
  for (let i = 0; i < ticks; i++) m.step();
};

describe('start gate', () => {
  it('waits for every player to load, counts down, then plays; nobody moves or fires before', () => {
    const m = new Match(room(), DEFAULT_DEATHMATCH_RULES, 1, { startGate: true });
    const a = m.addHuman('a')!;
    const b = m.addHuman('b')!;
    expect(m.phase).toBe('waiting');
    const start = { ...a.move.pos };
    m.ready(a.slot);
    for (let i = 1; i <= TICK_RATE; i++) {
      m.queueInputs(a.slot, [{ seq: i, forward: 1, right: 0, yaw: 0, pitch: 0, buttons: BUTTON_FIRE }]);
      m.step();
    }
    expect(m.phase).toBe('waiting');
    expect(Math.hypot(a.move.pos.x - start.x, a.move.pos.z - start.z)).toBeLessThan(0.05);
    m.ready(b.slot);
    run(m, 2);
    expect(m.phase).toBe('countdown');
    run(m, COUNTDOWN_SECONDS * TICK_RATE);
    expect(m.phase).toBe('playing');
  });

  it("doesn't wait forever for a player who never finishes loading", () => {
    const m = new Match(room(), DEFAULT_DEATHMATCH_RULES, 1, { startGate: true });
    m.addHuman('slow');
    run(m, (START_WAIT_SECONDS + COUNTDOWN_SECONDS) * TICK_RATE + 2);
    expect(m.phase).toBe('playing');
  });
});

describe('start gate with spectators', () => {
  it('a match only spectators watch starts as soon as they have loaded (bots against bots)', () => {
    const m = new Match(room(), DEFAULT_DEATHMATCH_RULES, 1, { startGate: true });
    const filler = new BotFiller(m);
    const me = filler.join('watcher', undefined, 4)!;
    expect(filler.spectate(me.slot, 4)).toBe(true);
    expect(m.combatants().filter((c) => c.kind === 'human')).toHaveLength(0);
    run(m, TICK_RATE);
    // Not loaded yet: it waits for them (no player to wait for isn't nobody to wait for).
    expect(m.phase).toBe('waiting');
    m.ready(me.slot);
    run(m, 2);
    expect(m.phase).toBe('countdown');
    run(m, COUNTDOWN_SECONDS * TICK_RATE);
    expect(m.phase).toBe('playing');
    expect(m.combatants().filter((c) => c.kind === 'bot')).toHaveLength(4);
  });

  it('spectating after loading keeps you counted as loaded; a player still loading is waited for', () => {
    const m = new Match(room(), DEFAULT_DEATHMATCH_RULES, 1, { startGate: true });
    const filler = new BotFiller(m);
    const me = filler.join('host', undefined, 4)!;
    const friend = filler.join('friend', undefined, 4)!;
    m.ready(me.slot);
    expect(filler.spectate(me.slot, 4)).toBe(true);
    run(m, 2);
    expect(m.phase).toBe('waiting');
    m.ready(friend.slot);
    run(m, 2);
    expect(m.phase).toBe('countdown');
  });

  it('a spectator who leaves is no longer waited for; with nobody at all, the wait runs out as before', () => {
    const m = new Match(room(), DEFAULT_DEATHMATCH_RULES, 1, { startGate: true });
    const filler = new BotFiller(m);
    const me = filler.join('gone', undefined, 2)!;
    filler.spectate(me.slot, 2);
    filler.leave(me.slot, 2);
    expect(m.isSpectator(me.slot)).toBe(false);
    run(m, START_WAIT_SECONDS * TICK_RATE - 2);
    expect(m.phase).toBe('waiting');
    run(m, 4);
    expect(m.phase).toBe('countdown');
  });
});
