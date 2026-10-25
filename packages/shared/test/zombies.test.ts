import { beforeAll, describe, expect, it } from 'vitest';
import { CORE_BOT_PROFILES, DEFAULT_ZOMBIES_RULES, NPC_ID_BASE, TICK_RATE, initPhysics, loadMap, playableModes, type GameEvent, type MapDocument, type Vec3 } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { ZOMBIE_BREAK_SECONDS, ZOMBIE_FIRST_BREAK_SECONDS, ZombieSurvival, zombieCap, zombiesInWave, type ZombieHost } from '../src/sim/zombies.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** A scripted host: players are plain records, zombies are IDs we kill by hand. */
function fakeHost(players = 2) {
  const state = {
    tick: 0,
    players: Array.from({ length: players }, (_, i) => ({ slot: i, alive: true, pos: { x: 0, y: 0, z: 0 }, eye: { x: 0, y: 1.6, z: 0 }, bot: false })),
    zombies: new Map<number, boolean>(),
    events: [] as GameEvent[],
    defeated: false,
    nextId: 1000,
  };
  const host: ZombieHost = {
    get tick() {
      return state.tick;
    },
    players: () => state.players,
    spawnSpots: (): Vec3[] => [
      { x: 40, y: 0, z: 0 },
      { x: 5, y: 0, z: 0 },
    ],
    sees: () => false,
    spawnZombie: () => {
      const id = state.nextId++;
      state.zombies.set(id, true);
      return id;
    },
    zombieAlive: (id) => state.zombies.get(id) === true,
    revive: (slot) => (state.players[slot]!.alive = true),
    emit: (ev) => state.events.push(ev),
    defeat: () => (state.defeated = true),
    random: () => 0.5,
  };
  return { state, host };
}

const run = (z: ZombieSurvival, state: { tick: number }, seconds: number) => {
  for (let i = 0; i < seconds * TICK_RATE; i++) {
    state.tick++;
    z.step();
  }
};

describe('zombie survival director', () => {
  it('waits, then raises a wave a few at a time, away from the players', () => {
    const { state, host } = fakeHost(2);
    const z = new ZombieSurvival(host);
    run(z, state, ZOMBIE_FIRST_BREAK_SECONDS - 1);
    expect(z.wave).toBe(0);
    expect(state.zombies.size).toBe(0);
    run(z, state, 2);
    expect(z.wave).toBe(1);
    expect(state.events.some((e) => e.e === 'msg' && e.text === 'Wave 1')).toBe(true);
    // Not all at once: one every second or so.
    expect(state.zombies.size).toBeGreaterThan(0);
    expect(state.zombies.size).toBeLessThan(zombiesInWave(1, 2));
    run(z, state, 30);
    // No more than the cap up at once; the rest wait their turn.
    expect(state.zombies.size).toBe(Math.min(zombiesInWave(1, 2), zombieCap(1, 2)));
    expect(z.left).toBe(zombiesInWave(1, 2));
  });

  it('clears a wave, takes a break, brings the fallen back and sends a bigger wave', () => {
    const { state, host } = fakeHost(2);
    const z = new ZombieSurvival(host);
    run(z, state, ZOMBIE_FIRST_BREAK_SECONDS + 30);
    state.players[1]!.alive = false;
    // Kill them as they come until the wave is done.
    for (let i = 0; i < 40 && z.left > 0; i++) {
      for (const id of state.zombies.keys()) state.zombies.set(id, false);
      run(z, state, 2);
    }
    expect(z.left).toBe(0);
    expect(z.snapshot()[2]).toBeGreaterThan(0);
    expect(state.events.some((e) => e.e === 'msg' && e.text === 'Wave 1 cleared')).toBe(true);
    run(z, state, ZOMBIE_BREAK_SECONDS - 1);
    expect(z.wave).toBe(2);
    expect(state.players[1]!.alive).toBe(true);
    expect(z.left).toBe(zombiesInWave(2, 2));
    expect(zombiesInWave(2, 2)).toBeGreaterThan(zombiesInWave(1, 2));
  });

  it('ends the game when nobody is left standing', () => {
    const { state, host } = fakeHost(2);
    const z = new ZombieSurvival(host);
    run(z, state, ZOMBIE_FIRST_BREAK_SECONDS + 2);
    for (const p of state.players) p.alive = false;
    run(z, state, 1);
    expect(state.defeated).toBe(true);
  });
});

/** An open yard of 4 × 4 cells. */
function yard(): MapDocument {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) tiles.push({ id: `yard_${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 });
  const r = loadMap(makeMap(tiles, [[4, 0, 4], [8, 0, 4]]));
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.map;
}

describe('zombies mode', () => {
  it('is offered on every map', () => {
    expect(playableModes(yard())).toContain('core.zombies');
  });

  it('bots hold out: the zombies come straight for them and the bots cut them down, wave after wave', () => {
    const match = new Match(yard(), DEFAULT_ZOMBIES_RULES, 3);
    const bots = [match.addBot('a', CORE_BOT_PROFILES[3]!), match.addBot('b', CORE_BOT_PROFILES[3]!)].filter(Boolean);
    expect(bots.length).toBe(2);
    expect(bots.every((b) => b!.faction === 'players')).toBe(true);
    const events: GameEvent[] = [];
    // Each zombie's distance to the nearest bot when first seen, and the closest it got after.
    const gap = new Map<number, { first: number; best: number }>();
    for (let t = 0; t < TICK_RATE * 60; t++) {
      events.push(...match.step());
      for (const z of match.actors()) {
        if (z.npc?.role !== 'zombie' || !z.alive) continue;
        const d = Math.min(...bots.filter((b) => b!.alive).map((b) => Math.hypot(z.move.pos.x - b!.move.pos.x, z.move.pos.z - b!.move.pos.z)));
        const g = gap.get(z.slot);
        if (!g) gap.set(z.slot, { first: d, best: d });
        else g.best = Math.min(g.best, d);
      }
    }
    expect(match.zombies!.wave).toBeGreaterThanOrEqual(2);
    expect(events.filter((e) => e.e === 'kill' && e.victim >= NPC_ID_BASE).length).toBeGreaterThan(5);
    // They closed in on the living (most got a good deal closer than where they rose).
    const closed = [...gap.values()].filter((g) => g.best < g.first - 4).length;
    expect(closed).toBeGreaterThan(gap.size / 2);
  });

  it('zombies claw a player who stands still, and the game ends when nobody is left', () => {
    const match = new Match(yard(), DEFAULT_ZOMBIES_RULES, 5);
    const me = match.addHuman('me')!;
    const events: GameEvent[] = [];
    for (let t = 0; t < TICK_RATE * 90 && !events.some((e) => e.e === 'round_end'); t++) events.push(...match.step());
    expect(events.some((e) => e.e === 'melee' && e.s >= NPC_ID_BASE && e.hit === me.slot)).toBe(true);
    expect(events.find((e) => e.e === 'round_end')).toMatchObject({ outcome: 'defeat' });
    expect(events.some((e) => e.e === 'msg' && e.text === 'Overrun on wave 1')).toBe(true);
  });
});
