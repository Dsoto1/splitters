import { beforeAll, describe, expect, it } from 'vitest';
import {
  BOT_DIFFICULTIES,
  BUTTON_RELOAD,
  BUTTON_ZOOM,
  CORE_BOT_PROFILES,
  DEFAULT_DEATHMATCH_RULES,
  PROTOCOL_VERSION,
  SnapshotDecoder,
  SnapshotStream,
  encodeSnapshots,
  getWeapon,
  gunplayOf,
  initPhysics,
  weaponCode,
  type PlayerInput,
  type PlayerSnapshot,
  type ServerMessage,
  type SnapshotBody,
} from '../src/index.ts';
import { Match, SCOPE_UP_ADS, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };

function yard(spawns: [number, number, number][]) {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, spawns);
}

function give(c: Combatant, id: string): void {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
  c.raiseTicks = 0;
}

/** One player on the yard, driven a tick at a time; `zm` is what the public snapshot says of them after each tick. */
function solo(weapon: string) {
  const match = new Match(yard([[0, 0, 4]]), rules, 3);
  const a = match.addHuman('A')!;
  give(a, weapon);
  let seq = 0;
  const tick = (i: Partial<PlayerInput> = {}): 1 | undefined => {
    match.queueInputs(a.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: a.yaw, pitch: a.pitch, buttons: 0, ...i }]);
    match.step();
    return match.playerSnapshots().find((p) => p.s === a.slot)!.zm;
  };
  return { match, a, tick };
}

describe('PlayerSnapshot.zm: who is aiming through a magnified optic', () => {
  it('is set once the scope is up (aim held, the gun past the no-scope line), and gone the tick the aim is let go', () => {
    const { match, a, tick } = solo('core.sniper');
    const adsTicks = gunplayOf(getWeapon('core.sniper')).accuracy!.adsTicks;
    const up = Math.ceil(SCOPE_UP_ADS * adsTicks);
    // Merely holding the rifle: never.
    for (let i = 0; i < 30; i++) expect(tick()).toBeUndefined();
    expect('zm' in match.playerSnapshots()[0]!).toBe(false);
    // The aim button: not before the gun is half way up, from then on every tick.
    for (let i = 1; i < up; i++) expect(tick({ buttons: BUTTON_ZOOM }), `tick ${i}`).toBeUndefined();
    expect(tick({ buttons: BUTTON_ZOOM })).toBe(1);
    expect(a.gun.ads).toBeGreaterThanOrEqual(SCOPE_UP_ADS);
    for (let i = 0; i < 30; i++) expect(tick({ buttons: BUTTON_ZOOM })).toBe(1);
    // Let go: gone at once (the scope picture cuts out), though the gun is still coming down.
    expect(tick()).toBeUndefined();
    expect(a.gun.ads).toBeGreaterThan(0);
    match.destroy();
  });

  it('only for the magnified optics (2-3x and sniper scopes), not for iron sights, a red dot or a holographic sight', () => {
    const scoped = (weapon: string) => {
      const { match, tick } = solo(weapon);
      let zm: 1 | undefined;
      for (let i = 0; i < 40; i++) zm = tick({ buttons: BUTTON_ZOOM });
      match.destroy();
      return zm;
    };
    for (const w of ['core.sniper', 'core.railgun', 'core.marksman', 'core.battle_rifle']) expect(scoped(w), w).toBe(1);
    for (const w of ['core.pistol', 'core.rifle', 'core.laser_rifle', 'core.arc_caster', 'core.rockets']) expect(scoped(w), w).toBeUndefined();
  });

  it('not while the gun is not ready (reloading, coming up), and not when dead', () => {
    const { match, a, tick } = solo('core.sniper');
    for (let i = 0; i < 40; i++) tick({ buttons: BUTTON_ZOOM });
    expect(tick({ buttons: BUTTON_ZOOM })).toBe(1);
    // A reload with the aim still held: the client shows no scope, the bit is off.
    a.weapons.get(a.current)!.mag = 1;
    expect(tick({ buttons: BUTTON_ZOOM | BUTTON_RELOAD })).toBeUndefined();
    expect(a.reload).not.toBeNull();
    let during = 0;
    for (let i = 0; i < 600 && a.reload; i++) {
      const zm = tick({ buttons: BUTTON_ZOOM });
      if (a.reload) expect(zm).toBeUndefined(), during++;
    }
    expect(during).toBeGreaterThan(10);
    expect(a.reload).toBeNull();
    expect(tick({ buttons: BUTTON_ZOOM })).toBe(1);
    // The gun coming up (a swap, the end of a sprint).
    a.raiseTicks = 5;
    expect(tick({ buttons: BUTTON_ZOOM })).toBeUndefined();
    for (let i = 0; i < 6; i++) tick({ buttons: BUTTON_ZOOM });
    expect(tick({ buttons: BUTTON_ZOOM })).toBe(1);
    a.alive = false;
    expect(match.playerSnapshots()[0]!.zm).toBeUndefined();
    match.destroy();
  });

  it('writing it changes nothing in the match: the same inputs give the same players with or without reading snapshots', () => {
    const run = (read: boolean) => {
      const { match, a, tick } = solo('core.sniper');
      for (let i = 0; i < 120; i++) {
        tick({ buttons: i % 50 < 30 ? BUTTON_ZOOM : 0, yaw: i * 0.01, forward: i % 3 ? 1 : 0 });
        if (read) match.snapshot([]);
      }
      const end = JSON.stringify([a.move.pos, a.yaw, a.gun, a.health]);
      match.destroy();
      return end;
    };
    expect(run(true)).toBe(run(false));
  });

  it('bots set it too: a bot firing a Sniper Rifle at range aims through it, by the same aim state', { timeout: 60_000 }, () => {
    const match = new Match(yard([[0, 0, 4], [30, 0, 4]]), rules, 5);
    const a = match.addHuman('A')!;
    const bot = match.addBot('B', CORE_BOT_PROFILES[0]!, BOT_DIFFICULTIES.hard)!;
    give(bot, 'core.sniper');
    for (const [code] of [...bot.weapons]) if (code !== bot.current) bot.weapons.delete(code);
    a.health = 1e9;
    let scoped = 0;
    let wrong = 0;
    for (let i = 0; i < 600; i++) {
      match.step();
      const zm = match.playerSnapshots().find((p) => p.s === bot.slot)!.zm;
      if (zm) scoped++;
      // Never without the aim button in the input the bot's brain last gave.
      if (zm && !(bot.prevButtons & BUTTON_ZOOM)) wrong++;
      expect(match.playerSnapshots().find((p) => p.s === a.slot)!.zm).toBeUndefined();
    }
    expect(scoped).toBeGreaterThan(30);
    expect(wrong).toBe(0);
    match.destroy();
  });
});

describe('zm in delta snapshots (net/interest.ts)', () => {
  const player = (s: number, more: Partial<PlayerSnapshot> = {}): PlayerSnapshot => ({ s, p: [s * 3, 0, 0], vy: 0, g: 1, yaw: 0, pitch: 0, hp: 100, ar: 0, alive: 1, w: 9, pu: 0, ...more });
  const body = (players: PlayerSnapshot[], tick: number): SnapshotBody => ({ tick, phase: 'playing', timeLeft: 0, players, score: [], ev: [], pr: [], pk: [], np: [] });
  type Wire = { players: Record<string, unknown>[] };

  it('a delta sets it, keeps it without repeating it, and clears it (null) when the player stops aiming', () => {
    const stream = new SnapshotStream();
    const decoder = new SnapshotDecoder();
    const send = (k: number, other: PlayerSnapshot) => {
      const [text] = encodeSnapshots(body([player(0), other], k * 2), [{ slot: 0, ack: k, stream }]);
      const wire = (JSON.parse(text!) as Wire).players.find((p) => p.s === 1)!;
      const got = decoder.snapshot(JSON.parse(text!) as Extract<ServerMessage, { t: 'snapshot' }>).players.find((p) => p.s === 1)!;
      return { wire, got };
    };
    // In full the first time, without the key.
    let r = send(0, player(1));
    expect('p' in r.wire).toBe(true);
    expect('zm' in r.wire).toBe(false);
    expect('zm' in r.got).toBe(false);
    // Nothing changed: the delta is the slot alone (the field costs nothing while nobody is scoped).
    r = send(1, player(1));
    expect(r.wire).toEqual({ s: 1 });
    // Scopes in: the delta says so.
    r = send(2, player(1, { zm: 1 }));
    expect(r.wire).toEqual({ s: 1, zm: 1 });
    expect(r.got.zm).toBe(1);
    // Still scoped: not repeated, and the receiver keeps it.
    r = send(3, player(1, { zm: 1, yaw: 0.5 }));
    expect(r.wire).toEqual({ s: 1, yaw: 0.5 });
    expect(r.got.zm).toBe(1);
    // Stops aiming: the delta names it gone, and the rebuilt entry has no such key.
    r = send(4, player(1, { yaw: 0.5 }));
    expect(r.wire).toEqual({ s: 1, zm: null });
    expect('zm' in r.got).toBe(false);
    expect(r.got).toEqual(player(1, { yaw: 0.5 }));
    // And stays gone.
    r = send(5, player(1, { yaw: 0.5 }));
    expect(r.wire).toEqual({ s: 1 });
    expect('zm' in r.got).toBe(false);
  });

  it('the reserved dw goes the same way, and the receiver\'s own entry carries both in full', () => {
    const stream = new SnapshotStream();
    const decoder = new SnapshotDecoder();
    const round = (k: number, players: PlayerSnapshot[]) => decoder.snapshot(JSON.parse(encodeSnapshots(body(players, k * 2), [{ slot: 0, ack: k, stream }])[0]!) as Extract<ServerMessage, { t: 'snapshot' }>).players;
    round(0, [player(0), player(1)]);
    expect(round(1, [player(0, { zm: 1, dw: 1 }), player(1, { zm: 1, dw: 1 })])).toEqual([player(0, { zm: 1, dw: 1 }), player(1, { zm: 1, dw: 1 })]);
    expect(round(2, [player(0), player(1, { dw: 1 })])).toEqual([player(0), player(1, { dw: 1 })]);
    expect(round(3, [player(0), player(1)])).toEqual([player(0), player(1)]);
  });

  it('is not a new protocol: the version is still 5 (older clients ignore the field, older hosts never send it)', () => {
    expect(PROTOCOL_VERSION).toBe(5);
  });
});
