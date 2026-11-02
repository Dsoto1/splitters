import { beforeAll, describe, expect, it } from 'vitest';
import { ARC_SENTRY_SPAWN_CLEAR, MOUNT_DEFS, MOUNT_FLAG_ARC, MOUNT_FLAG_CHARGING, PLAYER, TICK_RATE, DEFAULT_DEATHMATCH_RULES, arcSentryIssues, getWeapon, initPhysics, validateMap, type GameEvent, type MapDocument, type MapEntity } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
const def = MOUNT_DEFS.sentry_arc;
const arc = def.sentry!.arc!;
const gun = getWeapon(def.sentry!.weapon);
const WIND_UP = Math.round(arc.windUpSeconds * TICK_RATE);

/** An open yard 40 × 32 m (x -4..36, z -4..28) with an Arc Turret at (10, 10) facing +X, and extra entities. */
function yard(extra: MapEntity[] = [], faction: string | null = null): MapDocument {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 4; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 26]]);
  const turret: MapEntity = { id: 'arc', kind: 'mount', model: 'sentry_arc', position: [10, 0, 10], yaw: Math.PI / 2, faction, respawnSeconds: 5 };
  return { ...map, entities: [...map.entities, turret, ...extra] };
}

const place = (c: Combatant, x: number, z: number) => (c.move = { pos: { x, y: 0, z }, velY: 0, grounded: true });
const wall: MapEntity = { id: 'wall', kind: 'block', position: [14, 0, 14], size: [0.6, 3, 4], yaw: 0, material: null, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 };

/** Inputs sent per player (their sequence numbers). */
const sent = new Map<Combatant, number>();
/** Step the match `n` ticks, players standing still (their inputs kept flowing), returning the events. */
function run(match: Match, players: Combatant[], n: number): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    for (const p of players) {
      const seq = (sent.get(p) ?? 0) + 1;
      sent.set(p, seq);
      match.queueInputs(p.slot, [{ seq, forward: 0, right: 0, yaw: p.yaw, pitch: p.pitch, buttons: 0 }]);
    }
    out.push(...match.step());
  }
  return out;
}

const flags = (match: Match) => match.snapshot([]).mt![0]![8]!;
const arcEvents = (ev: GameEvent[]) => ev.filter((e): e is Extract<GameEvent, { e: 'arc' }> => e.e === 'arc' && e.m !== undefined);

describe('Arc Turret (arc sentry)', () => {
  it('is a sentry with an arc: a wind-up, a lock that ends in a vent, a weapon that chains once', () => {
    expect(def.kind).toBe('sentry');
    expect(def.seats).toEqual([]);
    expect(arc.windUpSeconds).toBeGreaterThanOrEqual(0.5);
    expect(arc.ventSeconds).toBeGreaterThan(0);
    expect(gun.chain?.jumps).toBe(1);
    expect(gun.slot).toBe(0);
    // Fair: no single hit is more than a twentieth of a player, and 100 health takes at least 2.5 s in the open
    // from when it starts winding up (the Sentry Gun's is about 1.6 s when every round lands).
    expect(gun.damage).toBeLessThanOrEqual(PLAYER.maxHealth / 20);
    const hits = Math.ceil(PLAYER.maxHealth / gun.damage);
    const ttk = arc.windUpSeconds + ((hits - 1) * gun.fireIntervalTicks + 1) / TICK_RATE;
    expect(ttk).toBeGreaterThanOrEqual(2.5);
    // A whole lock does at most a full player's health: one lock never kills through armour or a health top-up.
    const lockHits = Math.ceil((arc.lockSeconds * TICK_RATE) / gun.fireIntervalTicks);
    expect(lockHits * gun.damage).toBeLessThanOrEqual(PLAYER.maxHealth);
    expect(validateMap(yard()).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('winds up (charging, no damage) before it locks its arc on, then hits without missing', () => {
    const match = new Match(yard(), rules);
    const a = match.addHuman('a')!;
    run(match, [a], 2);
    place(a, 20, 10);
    const early = run(match, [a], WIND_UP - 5);
    expect(a.health).toBe(PLAYER.maxHealth);
    expect(arcEvents(early)).toEqual([]);
    expect(flags(match) & MOUNT_FLAG_CHARGING).toBeTruthy();
    const ev = run(match, [a], 60);
    expect(flags(match) & MOUNT_FLAG_ARC).toBeTruthy();
    const arcs = arcEvents(ev);
    // Ten hits a second, every one landing (55 ticks into the lock: hits on ticks 1, 7, ..., 55).
    expect(arcs.length).toBeGreaterThanOrEqual(9);
    expect(arcs[0]!.m).toBe(match.snapshot([]).mt![0]![0]);
    expect(a.health).toBe(PLAYER.maxHealth - arcs.length * gun.damage);
  });

  it('never kills in an instant: standing in the open, death comes after 2.5 s', () => {
    const match = new Match(yard(), rules);
    const a = match.addHuman('a')!;
    run(match, [a], 2);
    place(a, 20, 10);
    let ticks = 0;
    let worst = 0;
    let last = a.health;
    while (a.alive && ticks < 10 * TICK_RATE) {
      run(match, [a], 1);
      worst = Math.max(worst, last - a.health);
      last = a.health;
      ticks++;
    }
    expect(a.alive).toBe(false);
    expect(ticks / TICK_RATE).toBeGreaterThanOrEqual(2.5);
    expect(worst).toBeLessThanOrEqual(gun.damage);
  });

  it('breaking line of sight drops the lock, and coming back out needs a whole new wind-up', () => {
    const match = new Match(yard([wall]), rules);
    const a = match.addHuman('a')!;
    run(match, [a], 2);
    place(a, 20, 10);
    run(match, [a], WIND_UP + 20);
    const hurt = a.health;
    expect(hurt).toBeLessThan(PLAYER.maxHealth);
    // Behind the wall (the turret at (10, 10), the wall at x 14 across z 12..16): no more hits.
    place(a, 16, 15);
    const hidden = run(match, [a], 40);
    expect(arcEvents(hidden)).toEqual([]);
    expect(a.health).toBe(hurt);
    expect(flags(match) & (MOUNT_FLAG_ARC | MOUNT_FLAG_CHARGING)).toBe(0);
    // Back out: it has to charge again before it can hurt.
    place(a, 20, 10);
    run(match, [a], WIND_UP - 5);
    expect(a.health).toBe(hurt);
  });

  it('a full lock ends in a vent: no arc for a while, then it winds up again', () => {
    const match = new Match(yard(), rules);
    const a = match.addHuman('a')!;
    run(match, [a], 2);
    a.armor = 200;
    a.maxHealth = a.health = 1000;
    place(a, 20, 10);
    run(match, [a], WIND_UP + Math.round(arc.lockSeconds * TICK_RATE) + 2);
    const before = a.health;
    const vent = run(match, [a], Math.round(arc.ventSeconds * TICK_RATE) - 4);
    expect(arcEvents(vent)).toEqual([]);
    expect(a.health).toBe(before);
    const again = run(match, [a], WIND_UP + 30);
    expect(arcEvents(again).length).toBeGreaterThan(0);
  });

  it('the arc jumps to one more enemy beside the target, weaker; it spares its own team', () => {
    const match = new Match(yard(), rules);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    const c = match.addHuman('c')!;
    run(match, [a, b, c], 2);
    place(a, 20, 10);
    place(b, 22, 12);
    place(c, 23, 7);
    const ev = run(match, [a, b, c], WIND_UP + 40);
    const arcs = arcEvents(ev);
    expect(arcs.length).toBeGreaterThan(0);
    expect(arcs.every((e) => e.pts.length === 3)).toBe(true);
    expect(a.health).toBeLessThan(PLAYER.maxHealth);
    // One of the two beside a took half hits; the other none (one jump).
    const second = [b, c].filter((p) => p.health < PLAYER.maxHealth);
    expect(second).toHaveLength(1);
    expect(PLAYER.maxHealth - second[0]!.health).toBeCloseTo(((PLAYER.maxHealth - a.health) * (gun.chain!.falloff)), 5);
  });

  it('a team turret leaves its own team alone', () => {
    const map = yard([], 'red');
    const match = new Match(map, rules);
    const a = match.addHuman('a')!;
    run(match, [a], 2);
    a.faction = 'red';
    place(a, 20, 10);
    run(match, [a], WIND_UP + 60);
    expect(a.health).toBe(PLAYER.maxHealth);
  });

  it('bots see it as a target, like the Sentry Gun', () => {
    const match = new Match(yard(), rules);
    const a = match.addHuman('a')!;
    run(match, [a], 2);
    place(a, 20, 10);
    const seen = (match as unknown as { hostileSentries(c: Combatant): { object: boolean }[] }).hostileSentries(a);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.object).toBe(true);
  });

  it('MapMaker warns when one stands within reach of a spawn it would shoot at', () => {
    const at = (x: number, faction: string | null = null): MapEntity[] => [
      { id: 'arc', kind: 'mount', model: 'sentry_arc', position: [0, 0, 0], yaw: 0, faction: 'red', respawnSeconds: null },
      { id: 'sp', kind: 'spawn', position: [x, 0, 0], yaw: 0, faction },
    ];
    expect(arcSentryIssues(at(ARC_SENTRY_SPAWN_CLEAR - 2)).map((i) => i.code)).toEqual(['mount.arc_spawn']);
    expect(arcSentryIssues(at(ARC_SENTRY_SPAWN_CLEAR + 2))).toEqual([]);
    expect(arcSentryIssues(at(4, 'red'))).toEqual([]);
    expect(arcSentryIssues(at(4, 'blue'))).toHaveLength(1);
    // The Sentry Gun has no such rule.
    expect(arcSentryIssues([{ ...at(4)[0]!, model: 'sentry' } as MapEntity, at(4)[1]!])).toEqual([]);
    const map = yard();
    map.entities.push({ id: 'near', kind: 'spawn', position: [14, 0, 10], yaw: 0, faction: null });
    expect(validateMap(map).some((i) => i.code === 'mount.arc_spawn' && i.targetId === 'arc')).toBe(true);
  });
});
