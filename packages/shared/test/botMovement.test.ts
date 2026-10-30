import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, BUTTON_FIRE, BUTTON_JUMP, BUTTON_USE, CORE_BOT_PROFILES, DEFAULT_DEATHMATCH_RULES, DEFAULT_TDM_RULES, DEFAULT_TEAMS, createRng, getWeapon, initPhysics, loadMap, weaponCode, type BotDifficulty, type Faction, type GameEvent, type MapDocument } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** Open yard 48 × 32 m (x -4..44, z -4..28). */
function yard(): MapDocument {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  for (let x = 0; x < 6; x++) for (let z = 0; z < 4; z++) tiles.push({ id: `y${x}_${z}`, tile: 'core.yard', x, y: z, z: 0, rotation: 0 });
  const r = loadMap(makeMap(tiles, [[0, 0, 12], [40, 0, 12], [20, 0, 0], [20, 0, 24]]));
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.map;
}

const give = (c: Combatant, id: string) => {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
};

interface Jitter {
  /** Sideways (across the line to the enemy) direction reversals per second. */
  flips: number;
  /** Abrupt velocity changes (over 4 m/s in one tick) per second. */
  jerks: number;
  /** Running, stopped dead for a moment, then running again, per second. */
  stops: number;
  /** Mean distance covered per second (m/s). */
  speed: number;
}

/**
 * A bot fighting a human who strafes about (or, `retreat`, a badly hurt bot
 * with the human walking after it), measured from the bot's own motion.
 */
function jitter(difficulty: BotDifficulty, opts: { retreat?: boolean; seeds?: number[]; seconds?: number } = {}): Jitter {
  const seconds = opts.seconds ?? 20;
  let flips = 0;
  let jerks = 0;
  let stops = 0;
  let dist = 0;
  let time = 0;
  for (const seed of opts.seeds ?? [1, 2, 3]) {
    const match = new Match(yard(), { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0 }, seed);
    const human = match.addHuman('human')!;
    const profile = { ...CORE_BOT_PROFILES[3]!, tags: [], selfPreservation: opts.retreat ? 90 : 50, itemGreed: 0, exploration: 0 };
    const bot = match.addBot('bot', profile, difficulty)!;
    bot.move = { pos: { x: 14, y: 0, z: 12 }, velY: 0, grounded: true };
    human.move = { pos: { x: 26, y: 0, z: 12 }, velY: 0, grounded: true };
    give(bot, 'core.rifle');
    give(human, 'core.rifle');
    const rng = createRng(seed);
    let dir = 1;
    let flip = 0;
    let seq = 0;
    let last = { ...bot.move.pos };
    let lastV = { x: 0, z: 0 };
    let side = 0;
    let running = false;
    let halted = 0;
    for (let t = 0; t < seconds * 60; t++) {
      if (t >= flip) {
        dir = -dir;
        flip = t + 40 + Math.floor(rng() * 60);
      }
      const dx = bot.move.pos.x - human.move.pos.x;
      const dz = bot.move.pos.z - human.move.pos.z;
      const yaw = Math.atan2(dx, dz);
      const d = Math.hypot(dx, dz);
      // The human faces the bot: strafes in a fight; when it retreats, walks after it (not shooting).
      const forward = opts.retreat ? (d > 9 ? 1 : 0) : 0;
      match.queueInputs(human.slot, [{ seq: ++seq, forward, right: opts.retreat ? 0 : dir, yaw, pitch: 0, buttons: opts.retreat ? 0 : t % 50 < 6 ? BUTTON_FIRE : 0 }]);
      human.health = 100;
      bot.health = opts.retreat ? 25 : 100;
      for (const c of [human, bot]) for (const w of c.weapons.values()) w.reserve = w.def.reserveMax;
      match.step();
      const p = bot.move.pos;
      const v = { x: (p.x - last.x) * 60, z: (p.z - last.z) * 60 };
      last = { ...p };
      if (t < 60) {
        lastV = v;
        continue;
      }
      const sp = Math.hypot(v.x, v.z);
      dist += sp / 60;
      time += 1 / 60;
      if (Math.hypot(v.x - lastV.x, v.z - lastV.z) > 4) jerks++;
      lastV = v;
      // Across the line to the human.
      const ux = -dz / (d || 1);
      const uz = dx / (d || 1);
      const lat = v.x * ux + v.z * uz;
      if (Math.abs(lat) > 1) {
        const s = Math.sign(lat);
        if (side && s !== side) flips++;
        side = s;
      }
      // Stop-and-go: running, a short halt (a reversal passes through zero in a tick or two; a deliberate hold lasts), running again.
      if (sp > 2.5) {
        if (halted >= 3 && halted <= 30) stops++;
        running = true;
        halted = 0;
      } else if (sp < 0.5 && running) halted++;
      if (halted > 30) running = false;
    }
    match.destroy();
  }
  return { flips: flips / time, jerks: jerks / time, stops: stops / time, speed: dist / time };
}

const fmt = (j: Jitter) => `flips ${j.flips.toFixed(2)}/s jerks ${j.jerks.toFixed(2)}/s stops ${j.stops.toFixed(2)}/s speed ${j.speed.toFixed(1)} m/s`;

describe('bot movement smoothness', () => {
  it('strafes in committed runs, without stutter-stepping, while fighting', () => {
    for (const id of ['easy', 'normal', 'hard'] as const) {
      const j = jitter(BOT_DIFFICULTIES[id]);
      console.log(`fight ${id}: ${fmt(j)}`);
      // Before smoothing: up to 5 reversals and 7 jolts a second (normal bots dithering at the edge of a range band).
      expect(j.flips, id).toBeLessThan(1.5);
      expect(j.jerks, id).toBeLessThan(0.5);
      expect(j.stops, id).toBeLessThan(0.25);
      expect(j.speed, id).toBeGreaterThan(1.2);
    }
  });

  it('retreats steadily: keeps running instead of stopping and turning back every moment', () => {
    for (const id of ['easy', 'normal', 'hard'] as const) {
      const j = jitter(BOT_DIFFICULTIES[id], { retreat: true });
      console.log(`retreat ${id}: ${fmt(j)}`);
      // Before: 0.5 to 2 stop-and-go halts a second (turning back to look for the enemy, then running again).
      expect(j.flips, id).toBeLessThan(0.5);
      expect(j.jerks, id).toBeLessThan(0.5);
      expect(j.stops, id).toBeLessThan(0.3);
      expect(j.speed, id).toBeGreaterThan(4);
    }
  });
});

/** An open TDM yard 48 × 32 m with a buggy (or another vehicle) parked at the west end, facing east. */
function rideYard(model: 'buggy' | 'gun_jeep' = 'buggy'): MapDocument {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  for (let x = 0; x < 6; x++) for (let z = 0; z < 4; z++) tiles.push({ id: `y${x}_${z}`, tile: 'core.yard', x, y: z, z: 0, rotation: 0 });
  const map = makeMap(tiles, [[0, 0, 4], [0, 0, 20], [40, 0, 4], [40, 0, 20]]);
  map.metadata.supportedModes = ['core.tdm'];
  const [a, b] = DEFAULT_TEAMS as [Faction, Faction];
  map.entities.forEach((e, i) => {
    if (e.kind === 'spawn') e.faction = i < 2 ? a.id : b.id;
  });
  map.entities.push({ id: 'mount_0', kind: 'mount', model, position: [4, 0, 12], yaw: Math.PI / 2, faction: null, respawnSeconds: null });
  const r = loadMap(map);
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.map;
}

describe('bots ride with a teammate', () => {
  // The gun jeep's free roof gun first; the buggy has no gun seat, so a passenger seat and the bot's own weapon.
  it.each([
    ['gun_jeep', 1, (w: string) => w === 'core.mount_mg'],
    ['buggy', 1, (w: string) => !w.startsWith('core.mount_')],
  ] as const)('hops into the free seat of a %s a human drives by (seat %i), fires at an enemy, and gets out when the driver does', (model, wantSeat, gunOk) => {
    const match = new Match(rideYard(model), { ...DEFAULT_TDM_RULES, scoreLimit: 0, respawnDelayTicks: 100_000 }, 3);
    const me = match.addHuman('me')!;
    const enemy = match.addHuman('enemy')!;
    const bot = match.addBot('mate', { ...CORE_BOT_PROFILES[3]!, tags: [], itemGreed: 0 }, BOT_DIFFICULTIES.normal)!;
    expect(bot.faction).toBe(me.faction);
    expect(enemy.faction).not.toBe(me.faction);
    let seq = 0;
    let eseq = 0;
    const drive = (forward: number, buttons = 0) => match.queueInputs(me.slot, [{ seq: ++seq, forward, right: 0, yaw: me.yaw, pitch: 0, buttons }]);
    const idle = () => match.queueInputs(enemy.slot, [{ seq: ++eseq, forward: 0, right: 0, yaw: -Math.PI / 2, pitch: 0, buttons: 0 }]);
    me.move = { pos: { x: 4, y: 0, z: 10.6 }, velY: 0, grounded: true };
    bot.move = { pos: { x: 20, y: 0, z: 17 }, velY: 0, grounded: true };
    bot.bot!.onSpawn(0);
    // The enemy waits out of the way at the far end for now.
    enemy.move = { pos: { x: 42, y: 0, z: 26 }, velY: 0, grounded: true };
    for (let i = 0; i < 2; i++) match.step();
    drive(0, BUTTON_USE);
    idle();
    match.step();
    expect(me.mount?.seat).toBe(0);
    // Drive east past the bot at a crawl, then pull up.
    let boardedAt = -1;
    for (let t = 0; t < 60 * 8 && boardedAt < 0; t++) {
      drive(t < 60 * 3 ? 0.45 : 0, t >= 60 * 3 ? BUTTON_JUMP : 0);
      idle();
      enemy.health = me.health = bot.health = 100;
      match.step();
      if (bot.mount) boardedAt = t;
    }
    expect(boardedAt, 'boarded').toBeGreaterThanOrEqual(0);
    expect(boardedAt).toBeLessThan(60 * 6);
    // The gun was free: it took that seat (in the buggy, the front passenger seat).
    expect(bot.mount!.seat).toBe(wantSeat);
    // An enemy shows up ahead: the rider opens up, with the mounted gun or its own (and stays in).
    enemy.move = { pos: { x: 40, y: 0, z: 12 }, velY: 0, grounded: true };
    const events: GameEvent[] = [];
    for (let t = 0; t < 60 * 5; t++) {
      drive(0);
      idle();
      enemy.health = me.health = bot.health = 100;
      events.push(...match.step());
    }
    expect(events.some((e) => e.e === 'shot' && e.s === bot.slot && gunOk(e.w))).toBe(true);
    expect(bot.mount).toBeDefined();
    // The driver gets out: so does the bot, soon after.
    enemy.move = { pos: { x: 42, y: 0, z: 26 }, velY: 0, grounded: true };
    drive(0, BUTTON_USE);
    idle();
    match.step();
    expect(me.mount).toBeUndefined();
    let outAt = -1;
    for (let t = 0; t < 60 * 3 && outAt < 0; t++) {
      drive(0);
      idle();
      match.step();
      if (!bot.mount) outAt = t;
    }
    expect(outAt, 'got out').toBeGreaterThanOrEqual(0);
    match.destroy();
  });

  it('stays put when it may not take a vehicle, or has been kept out of them', () => {
    const match = new Match(rideYard(), { ...DEFAULT_TDM_RULES, scoreLimit: 0, respawnDelayTicks: 100_000 }, 3);
    const me = match.addHuman('me')!;
    match.addHuman('enemy');
    const bot = match.addBot('mate', { ...CORE_BOT_PROFILES[3]!, tags: [], itemGreed: 0 }, BOT_DIFFICULTIES.normal)!;
    (bot.bot as unknown as { nextMountTick: number }).nextMountTick = Number.MAX_SAFE_INTEGER;
    let seq = 0;
    me.move = { pos: { x: 4, y: 0, z: 10.6 }, velY: 0, grounded: true };
    bot.move = { pos: { x: 12, y: 0, z: 15 }, velY: 0, grounded: true };
    for (let i = 0; i < 2; i++) match.step();
    match.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: me.yaw, pitch: 0, buttons: BUTTON_USE }]);
    match.step();
    expect(me.mount).toBeDefined();
    for (let t = 0; t < 60 * 5; t++) {
      match.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: me.yaw, pitch: 0, buttons: 0 }]);
      match.step();
      expect(bot.mount).toBeUndefined();
    }
    match.destroy();
  });
});
