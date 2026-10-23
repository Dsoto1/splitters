import { beforeAll, describe, expect, it } from 'vitest';
import {
  BOT_DIFFICULTIES,
  BUTTON_FIRE,
  CORE_BOT_PROFILES,
  DEFAULT_COOP_RULES,
  DEFAULT_DEATHMATCH_RULES,
  STANCES,
  createRng,
  getWeapon,
  initPhysics,
  lookAngles,
  loadMap,
  weaponCode,
  type BotDifficulty,
  type GameEvent,
  type MapDocument,
  type PlayerInput,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** Open courtyard tiles: x from -4 to 28, z from -4 to 20 (cell centres every 8 m). */
function yard(extra: MapDocument['entities'] = [], tileAt: (x: number, z: number) => string = () => 'core.yard', spawns: [number, number, number][] = [[0, 0, 8], [15, 0, 8]]): MapDocument {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  for (let x = 0; x < 4; x++) for (let z = 0; z < 3; z++) tiles.push({ id: `y${x}_${z}`, tile: tileAt(x, z), x, y: z, z: 0, rotation: 0 });
  const map = makeMap(tiles, spawns);
  map.entities.push(...extra);
  const r = loadMap(map);
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.map;
}

/** Two rooms side by side (centres x = 0 and x = 8) joined by a 3 m doorway at x = 4. */
function twoRooms(spawns: [number, number, number][]): MapDocument {
  const map = makeMap(
    [
      { id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 },
      { id: 'room_b', tile: 'core.room', x: 1, y: 0, z: 0, rotation: 0 },
    ],
    spawns,
  );
  const r = loadMap(map);
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.map;
}

const place = (c: Combatant, x: number, z: number, yaw = c.yaw) => {
  c.move = { pos: { x, y: 0, z }, velY: 0, grounded: true };
  c.yaw = yaw;
  c.bot?.onSpawn(yaw);
};

/** Scripted human input, one per tick. */
function driver(match: Match, c: Combatant) {
  let seq = 0;
  return (i: Partial<PlayerInput> = {}) => match.queueInputs(c.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
}

const eyeOf = (c: Combatant) => ({ x: c.move.pos.x, y: c.move.pos.y + STANCES[c.move.stance ?? 0].eye, z: c.move.pos.z });

const give = (c: Combatant, id: string) => {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
};

/**
 * A bot against a player 15 m away (by default) who strafes side to side at
 * walking pace, changing direction every second or so. Returns the share of
 * the bot's rounds that hit, pooled over a few seeds.
 */
function hitRate(difficulty: BotDifficulty, opts: { weapon?: string; range?: number; strafe?: boolean; seeds?: number[]; seconds?: number } = {}): { rate: number; shots: number; dist: number } {
  const weapon = opts.weapon ?? 'core.rifle';
  const range = opts.range ?? 15;
  const seconds = opts.seconds ?? 40;
  let shots = 0;
  let hits = 0;
  let distSum = 0;
  let samples = 0;
  for (const seed of opts.seeds ?? [1, 2, 3, 4]) {
    const match = new Match(yard(), { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0 }, seed);
    const target = match.addHuman('target')!;
    const bot = match.addBot('shooter', { ...CORE_BOT_PROFILES[3]!, accuracy: 50, rangePreference: ((range - 4) / 22) * 100, tags: [] }, difficulty)!;
    bot.move = { pos: { x: 0, y: 0, z: 8 }, velY: 0, grounded: true };
    target.move = { pos: { x: range, y: 0, z: 8 }, velY: 0, grounded: true };
    give(bot, weapon);
    const rng = createRng(seed);
    let dir = 1;
    let flip = 0;
    let seq = 0;
    for (let t = 0; t < seconds * 60; t++) {
      if (t >= flip) {
        dir = -dir;
        flip = t + 35 + Math.floor(rng() * 50);
      }
      if (target.move.pos.z > 15) dir = -1;
      if (target.move.pos.z < 1) dir = 1;
      // Facing the bot (-X), strafing along Z.
      match.queueInputs(target.slot, [{ seq: ++seq, forward: 0, right: opts.strafe === false ? 0 : -dir, yaw: -Math.PI / 2, pitch: 0, buttons: 0 }]);
      target.health = bot.health = 100;
      for (const w of bot.weapons.values()) w.reserve = w.def.reserveMax;
      const events = match.step();
      distSum += Math.hypot(bot.move.pos.x - target.move.pos.x, bot.move.pos.z - target.move.pos.z);
      samples++;
      for (const e of events as GameEvent[]) {
        if (e.e !== 'shot' || e.s !== bot.slot || e.w !== weapon) continue;
        shots += e.hit.length;
        hits += e.hit.filter((h) => h === target.slot).length;
      }
    }
    match.destroy();
  }
  return { rate: hits / Math.max(1, shots), shots, dist: distSum / samples };
}

describe('bot aim', () => {
  it('hits a strafing player at 15 m with a rifle at human-like rates per difficulty', () => {
    const bands = { easy: [0.15, 0.25], normal: [0.3, 0.45], hard: [0.5, 0.65] } as const;
    const rates: string[] = [];
    for (const id of ['easy', 'normal', 'hard'] as const) {
      const r = hitRate(BOT_DIFFICULTIES[id]);
      rates.push(`${id} ${(r.rate * 100).toFixed(1)}% of ${r.shots} rounds at ${r.dist.toFixed(1)} m`);
      expect(r.shots).toBeGreaterThan(200);
      expect(r.dist).toBeGreaterThan(12);
      expect(r.dist).toBeLessThan(19);
      expect(r.rate, rates.join('; ')).toBeGreaterThanOrEqual(bands[id][0]);
      expect(r.rate, rates.join('; ')).toBeLessThanOrEqual(bands[id][1]);
    }
    console.log(rates.join('\n'));
  });

  it('is no longer a perfect shot with a pistol at 8 m against a strafing player, and does better against a still one', () => {
    const strafing = hitRate(BOT_DIFFICULTIES.normal, { weapon: 'core.pistol', range: 8, seeds: [1, 2], seconds: 30 });
    const still = hitRate(BOT_DIFFICULTIES.normal, { weapon: 'core.pistol', range: 8, strafe: false, seeds: [1, 2], seconds: 30 });
    console.log(`pistol 8 m: strafing ${(strafing.rate * 100).toFixed(1)}% (${strafing.shots}, ${strafing.dist.toFixed(1)} m), still ${(still.rate * 100).toFixed(1)}% (${still.shots}, ${still.dist.toFixed(1)} m)`);
    expect(strafing.shots).toBeGreaterThan(30);
    expect(strafing.rate).toBeLessThan(0.75);
    expect(still.rate).toBeGreaterThan(strafing.rate);
  });
});

it.runIf(process.env.AIM_CAL)('calibration', () => {
  for (const id of ['easy', 'normal', 'hard'] as const) {
    const rs = [1, 2, 3, 4, 5].map((s) => hitRate(BOT_DIFFICULTIES[id], { seeds: [s] }));
    console.log(id, rs.map((r) => `${(r.rate * 100).toFixed(0)}%/${r.shots}/${r.dist.toFixed(1)}`).join('  '));
  }
});

describe('bot tactics', () => {
  it('under fire in the open with a low wall nearby, gets behind it and crouches (peeking out to shoot)', () => {
    // A waist-high wall across the yard at z = 8 from x = 4 to 12 (gap in the middle).
    const match = new Match(yard([], (x, z) => (x === 1 && z === 1 ? 'core.yard_wall' : 'core.yard')), { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0 }, 5);
    const shooter = match.addHuman('shooter')!;
    const bot = match.addBot('bot', { ...CORE_BOT_PROFILES[3]!, tags: [] }, BOT_DIFFICULTIES.normal)!;
    place(shooter, 6, 18, Math.PI);
    place(bot, 14, 6, 0);
    give(shooter, 'core.rifle');
    give(bot, 'core.rifle');
    const input = driver(match, shooter);
    let crouchedHidden = 0;
    let firstHidden = -1;
    let exposed = 0;
    let watched = 0;
    for (let t = 0; t < 60 * 10; t++) {
      // The shooter keeps a rifle on the bot (head height) the whole time.
      const aim = lookAngles(eyeOf(shooter), { x: bot.move.pos.x, y: bot.move.pos.y + 1, z: bot.move.pos.z });
      shooter.yaw = aim.yaw;
      shooter.pitch = aim.pitch;
      input({ buttons: BUTTON_FIRE });
      shooter.health = bot.health = 100;
      for (const c of [shooter, bot]) for (const w of c.weapons.values()) w.reserve = w.def.reserveMax;
      match.step();
      const body = STANCES[bot.move.stance ?? 0].height;
      const seen = match.physics.lineOfSight(eyeOf(shooter), { x: bot.move.pos.x, y: bot.move.pos.y + body - 0.25, z: bot.move.pos.z });
      if (bot.move.stance === 1 && !seen) {
        crouchedHidden++;
        if (firstHidden < 0) firstHidden = t;
      }
      if (t >= 60 * 4) {
        watched++;
        if (seen) exposed++;
      }
    }
    expect(firstHidden).toBeGreaterThanOrEqual(0);
    expect(firstHidden).toBeLessThan(60 * 5);
    expect(bot.move.pos.z).toBeLessThan(8);
    expect(crouchedHidden).toBeGreaterThan(60);
    expect(exposed / watched).toBeLessThan(0.6);
  });

  it('checks a doorway before going through: stops short and looks into the room', () => {
    const match = new Match(twoRooms([[8, 0, 0]]), { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0 }, 3);
    const bot = match.addBot('bot', { ...CORE_BOT_PROFILES[3]!, exploration: 0, itemGreed: 0, tags: [] }, BOT_DIFFICULTIES.normal)!;
    place(bot, -2.5, 0, Math.PI / 2);
    let crossed = -1;
    let lookingIn = 0;
    let slow = 0;
    let minYaw = Infinity;
    let maxYaw = -Infinity;
    let last = { ...bot.move.pos };
    for (let t = 0; t < 60 * 12 && crossed < 0; t++) {
      match.step();
      const p = bot.move.pos;
      const speed = Math.hypot(p.x - last.x, p.z - last.z) * 60;
      last = { ...p };
      if (p.x > 4) crossed = t;
      else if (p.x > 0.5) {
        // Close to the doorway, still in the first room.
        const into = Math.abs(Math.atan2(Math.sin(bot.yaw - Math.PI / 2), Math.cos(bot.yaw - Math.PI / 2))) < 1.1;
        if (into && speed < 2) lookingIn++;
        if (speed < 2) slow++;
        minYaw = Math.min(minYaw, bot.yaw);
        maxYaw = Math.max(maxYaw, bot.yaw);
      }
    }
    expect(crossed).toBeGreaterThan(0);
    // It paused at the door for a moment, looking through it, and swept across the room.
    expect(lookingIn).toBeGreaterThan(20);
    expect(slow).toBeGreaterThan(25);
    expect(maxYaw - minYaw).toBeGreaterThan(0.6);
  });

  it('throws a grenade into a room where it heard an enemy, landing inside the room', () => {
    const match = new Match(twoRooms([[-2, 0, 0], [9, 0, 0]]), { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0 }, 9);
    const enemy = match.addHuman('enemy')!;
    const bot = match.addBot('bot', { ...CORE_BOT_PROFILES[3]!, exploration: 0, itemGreed: 0, tags: [] }, BOT_DIFFICULTIES.hard)!;
    // Hiding beside the doorway inside the second room, out of sight from the first.
    place(enemy, 7, 3.5, 0);
    place(bot, -2.5, 0, Math.PI / 2);
    bot.throwable = { kind: 'frag', count: 2 };
    const input = driver(match, enemy);
    const events: GameEvent[] = [];
    for (let t = 0; t < 60 * 12; t++) {
      // The enemy fires into the ceiling now and then: the bot hears it.
      input({ pitch: 1.3, buttons: t % 90 < 2 ? BUTTON_FIRE : 0 });
      enemy.health = 100;
      enemy.move = { ...enemy.move, pos: { x: 7, y: enemy.move.pos.y, z: 3.5 } };
      events.push(...match.step());
      if (events.some((e) => e.e === 'explode' && e.s === bot.slot)) break;
    }
    expect(events.some((e) => e.e === 'throw' && e.s === bot.slot)).toBe(true);
    const blast = events.find((e): e is Extract<GameEvent, { e: 'explode' }> => e.e === 'explode' && e.s === bot.slot);
    expect(blast).toBeDefined();
    // Inside the second room (past the doorway at x = 4), not in the door frame.
    expect(blast!.p[0]).toBeGreaterThan(4.6);
  });

  it('mans a free turret when an enemy is inside its arc, and fires it', () => {
    const turret = { id: 'mount_0', kind: 'mount' as const, model: 'turret_mg' as const, position: [8, 0, 4] as [number, number, number], yaw: 0, faction: null, respawnSeconds: null };
    const match = new Match(yard([turret]), { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0 }, 4);
    const enemy = match.addHuman('enemy')!;
    const bot = match.addBot('bot', { ...CORE_BOT_PROFILES[3]!, tags: [] }, BOT_DIFFICULTIES.normal)!;
    place(enemy, 8, 18, Math.PI);
    place(bot, 10.5, 1, 0);
    const input = driver(match, enemy);
    let mountedAt = -1;
    const events: GameEvent[] = [];
    for (let t = 0; t < 60 * 10; t++) {
      input();
      enemy.health = 100;
      events.push(...match.step());
      if (mountedAt < 0 && bot.mount) mountedAt = t;
    }
    expect(mountedAt).toBeGreaterThanOrEqual(0);
    expect(mountedAt).toBeLessThan(60 * 6);
    expect(events.some((e) => e.e === 'shot' && e.s === bot.slot && e.w === 'core.mount_mg')).toBe(true);
  });

  it('NPC snipers go prone to shoot at long range', () => {
    const enc = {
      id: 'enc_0',
      kind: 'encounter' as const,
      position: [24, 0, 8] as [number, number, number],
      yaw: -Math.PI / 2,
      faction: 'syndicate',
      roster: { trooper: 0, gunner: 0, heavy: 0, sniper: 1 },
      activeCap: 1,
      reinforcements: 0,
      perPlayer: 0,
      respawnSeconds: 1,
      radius: 1,
      order: 'hold' as const,
      orderTarget: null,
      startActive: true,
      difficulty: 'normal' as const,
    };
    const match = new Match(yard([enc], undefined, [[-1, 0, 8]]), DEFAULT_COOP_RULES, 6);
    const me = match.addHuman('me')!;
    place(me, -1, 8, Math.PI / 2);
    const input = driver(match, me);
    let prone = 0;
    let shots = 0;
    for (let t = 0; t < 60 * 8; t++) {
      input();
      me.health = 100;
      const ev = match.step();
      const npc = [...match.npcs.values()][0];
      if (npc?.move.stance === 2) prone++;
      shots += ev.filter((e) => e.e === 'shot' && npc && e.s === npc.slot).length;
    }
    const npc = [...match.npcs.values()][0]!;
    expect(npc.npc!.role).toBe('sniper');
    expect(Math.hypot(npc.move.pos.x - me.move.pos.x, npc.move.pos.z - me.move.pos.z)).toBeGreaterThan(20);
    expect(prone).toBeGreaterThan(60 * 3);
    expect(shots).toBeGreaterThan(0);
  });
});
