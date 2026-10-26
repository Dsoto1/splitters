import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  BOT_DIFFICULTIES,
  BUILT_MOUNT_BASE,
  BUTTON_FIRE,
  BUTTON_JUMP,
  BUTTON_THROW,
  CLASS_DEFS,
  CLASS_IDS,
  CORE_BOT_PROFILES,
  DEFAULT_RULES,
  FX_CLOAK,
  PhysicsWorld,
  buildMapGeometry,
  classSay,
  getWeapon,
  initPhysics,
  loadMap,
  lookAngles,
  pickBotClass,
  stepMovement,
  weaponCode,
  type ClassId,
  type GameEvent,
  type MapDocument,
  type MatchRules,
  type MoveState,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** A 40 × 16 m walled yard with a spawn at each end. */
const yard = () => {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[2, 0, 4], [30, 0, 4]]);
};

const tdm: MatchRules = { ...DEFAULT_RULES['core.tdm'], classes: true, teamSizes: [3, 3], respawnDelayTicks: 30 };

function setup(rules: MatchRules = tdm, map: MapDocument = yard()) {
  const match = new Match(map, rules);
  const a = match.addHuman('a')!;
  const b = match.addHuman('b')!;
  const c = match.addHuman('c')!;
  let seq = 0;
  const events: GameEvent[] = [];
  const held = new Map<Combatant, { yaw: number; pitch: number; buttons: number; say?: number }>();
  const send = (p: Combatant, yaw: number, pitch: number, buttons = 0, say?: number) => match.queueInputs(p.slot, [{ seq: ++seq, forward: 0, right: 0, yaw, pitch, buttons, ...(say ? { say } : {}) }]);
  const step = (n: number, each?: () => void) => {
    for (let i = 0; i < n; i++) {
      for (const p of [a, b, c]) {
        const h = held.get(p);
        send(p, h?.yaw ?? p.yaw, h?.pitch ?? p.pitch, h?.buttons ?? 0);
      }
      each?.();
      events.push(...match.step());
    }
  };
  const pick = (p: Combatant, id: ClassId) => {
    send(p, p.yaw, p.pitch, 0, classSay(id));
    events.push(...match.step());
  };
  const put = (p: Combatant, x: number, z: number, yaw = p.yaw) => {
    p.move = { pos: { x, y: 0, z }, velY: 0, grounded: true };
    p.yaw = yaw;
  };
  const aimAt = (from: Combatant, to: Combatant, buttons: number) => {
    const eye = { x: from.move.pos.x, y: from.move.pos.y + 1.6, z: from.move.pos.z };
    held.set(from, { ...lookAngles(eye, { x: to.move.pos.x, y: to.move.pos.y + 1, z: to.move.pos.z }), buttons });
  };
  step(3);
  // a and c on one side, b on the other (team fill order alternates).
  const [mate, foe] = a.faction === c.faction ? [c, b] : [b, c];
  return { match, a, mate, foe, step, pick, put, aimAt, held, events, send };
}

const weaponIds = (c: Combatant) => [...c.weapons.values()].map((w) => w.def.id);

describe('Classes', () => {
  it('nine classes, each with real weapons, its own health and speed', () => {
    expect(CLASS_IDS).toHaveLength(9);
    for (const id of CLASS_IDS) {
      const def = CLASS_DEFS[id];
      for (const w of def.weapons) expect(() => getWeapon(w), `${id} ${w}`).not.toThrow();
      expect(def.health).toBeGreaterThan(50);
      expect(def.speed).toBeGreaterThan(0.6);
    }
    expect(CLASS_DEFS.runner.speed).toBeGreaterThan(CLASS_DEFS.bulwark.speed);
    expect(CLASS_DEFS.bulwark.health).toBeGreaterThan(CLASS_DEFS.runner.health);
  });

  it('picking a class right after spawning swaps loadout, health and speed on the spot', () => {
    const { match, a, pick } = setup();
    // Newcomers start as whatever their side is short of, with that class's health.
    expect(a.cls).toBeDefined();
    expect(a.maxHealth).toBe(CLASS_DEFS[a.cls!.id].health);
    pick(a, 'bulwark');
    expect(a.cls?.id).toBe('bulwark');
    expect(weaponIds(a)).toEqual(['core.knife', 'core.shotgun', 'core.lmg']);
    expect(a.current).toBe(weaponCode(getWeapon('core.lmg')));
    expect(a.maxHealth).toBe(200);
    expect(a.health).toBe(200);
    expect(a.classSpeed).toBe(CLASS_DEFS.bulwark.speed);
    // The client learns its class (and its movement multiplier) from its private state and the snapshot.
    const me = match.privateState(a.slot)!;
    expect(me.cl?.[0]).toBe(CLASS_IDS.indexOf('bulwark'));
    expect(me.ms).toBe(Math.round(CLASS_DEFS.bulwark.speed * 1000));
    expect(match.playerSnapshots().find((p) => p.s === a.slot)?.cl).toBe(CLASS_IDS.indexOf('bulwark'));
    pick(a, 'runner');
    expect(a.maxHealth).toBe(75);
    expect(weaponIds(a)).toContain('core.sawed_off');
  });

  it('a class pick survives a backlog of inputs (slow server ticks drop the oldest)', () => {
    const { match, a, step } = setup();
    const base = a.lastSeq + 100;
    match.queueInputs(a.slot, Array.from({ length: 24 }, (_, i) => ({ seq: base + i, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0, ...(i === 0 ? { say: classSay('marksman') } : {}) })));
    step(1);
    expect(a.cls?.next).toBe('marksman');
  });

  it('once hurt, a new class waits for the next spawn', () => {
    const { a, pick, step } = setup();
    pick(a, 'medic');
    a.hurtAt = a.cls!.spawnTick + 1;
    pick(a, 'marksman');
    expect(a.cls?.id).toBe('medic');
    expect(a.cls?.next).toBe('marksman');
    a.alive = false;
    a.respawnTick = 0;
    step(2);
    expect(a.cls?.id).toBe('marksman');
    expect(weaponIds(a)).toContain('core.railgun');
  });

  it('class limits per team are kept', () => {
    const { a, mate, pick } = setup({ ...tdm, classLimit: 1 });
    pick(a, 'shade');
    pick(mate, 'shade');
    expect(a.cls?.id).toBe('shade');
    expect(mate.cls?.id).not.toBe('shade');
    expect(pickBotClass(['rocketeer', 'medic'], 1)).toBe('bulwark');
    expect(pickBotClass([], undefined)).toBe('rocketeer');
  });

  it('the Runner double-jumps; nobody else does', () => {
    const map = yard();
    const physics = new PhysicsWorld(buildMapGeometry(map));
    const col = physics.createPlayerCollider();
    const run = (airJumps: number) => {
      let s: MoveState = { pos: { x: 10, y: 0, z: 4 }, velY: 0, grounded: true };
      let peak = 0;
      for (let t = 0; t < 90; t++) {
        // Jump, let go, press again near the top of the jump.
        const jump = t < 3 || (t >= 18 && t < 21);
        s = stepMovement(physics, col, s, { seq: t, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: jump ? BUTTON_JUMP : 0 }, 1, 1 / 60, 1, airJumps ? { airJumps } : {});
        peak = Math.max(peak, s.pos.y);
      }
      return peak;
    };
    expect(run(1)).toBeGreaterThan(run(0) + 0.6);
    physics.free();
  });

  it('a Mechanic builds a sentry (G) that shoots enemies for them and heals teammates beside it', () => {
    const { match, a, mate, foe, pick, put, step, events } = setup();
    pick(a, 'mechanic');
    put(a, 10, 4, Math.PI / 2);
    put(foe, 30, 14);
    put(mate, 30, 0);
    step(2);
    const { send } = { send: (b: number) => match.queueInputs(a.slot, [{ seq: 10_000 + match.tick, forward: 0, right: 0, yaw: Math.PI / 2, pitch: 0, buttons: b }]) };
    send(BUTTON_THROW);
    events.push(...match.step());
    const mounts = match.mountSnapshots();
    const sentry = mounts.find((m) => m[0] === BUILT_MOUNT_BASE + a.slot);
    expect(sentry).toBeDefined();
    expect(sentry![1]).toBeCloseTo(11.6, 0);
    expect(a.cls?.charge).toBe(0);
    // Only one at a time.
    send(BUTTON_THROW);
    step(30);
    expect(match.mountSnapshots().filter((m) => m[0]! >= BUILT_MOUNT_BASE)).toHaveLength(1);
    // A foe walks into view: the sentry kills them and the Mechanic gets the kill.
    put(foe, 20, 4);
    step(60 * 8, () => {
      if (foe.alive) put(foe, 20, 4);
    });
    const kill = events.find((e) => e.e === 'kill' && e.victim === foe.slot);
    expect(kill).toMatchObject({ killer: a.slot });
    // A hurt teammate standing by it is patched up.
    put(mate, 12.5, 4);
    mate.health = 40;
    step(60 * 2, () => put(mate, 12.5, 4));
    expect(mate.health).toBeGreaterThan(55);
  });

  it('a Medic heals a teammate with the medi-beam, charging an overcharge that makes both untouchable', () => {
    const { match, a, mate, foe, pick, put, step, aimAt, held } = setup();
    pick(a, 'medic');
    expect(a.current).toBe(weaponCode(getWeapon('core.medi_beam')));
    put(a, 10, 4, 0);
    put(mate, 15, 4);
    put(foe, 34, 12);
    mate.health = 20;
    aimAt(a, mate, BUTTON_FIRE);
    step(60 * 3, () => put(mate, 15, 4));
    expect(mate.health).toBeGreaterThan(80);
    // Keep healing (the patient keeps getting hurt) until the overcharge is full.
    step(60 * 12, () => {
      put(mate, 15, 4);
      if (mate.health > 50) mate.health = 50;
    });
    expect(a.cls!.charge).toBe(1);
    held.set(a, { yaw: a.yaw, pitch: a.pitch, buttons: BUTTON_THROW });
    step(1);
    held.delete(a);
    expect(match.privateState(a.slot)?.cl?.[3]).toBe(1);
    // Point blank rockets do nothing to either of them for a while.
    const before = mate.health;
    (match as unknown as { damage: (v: Combatant, n: number, by: Combatant, w: string) => void }).damage(mate, 500, foe, 'core.rockets');
    (match as unknown as { damage: (v: Combatant, n: number, by: Combatant, w: string) => void }).damage(a, 500, foe, 'core.rockets');
    expect(mate.health).toBe(before);
    expect(a.alive).toBe(true);
  });

  it('a Shade cloaks (hidden from bots, drawn faint), firing breaks it; a knife in the back kills', () => {
    const { match, a, foe, pick, put, step, held } = setup();
    pick(a, 'shade');
    held.set(a, { yaw: a.yaw, pitch: 0, buttons: BUTTON_THROW });
    step(1);
    held.delete(a);
    step(5);
    expect((match.playerSnapshots().find((p) => p.s === a.slot)?.fx ?? 0) & FX_CLOAK).toBe(FX_CLOAK);
    // Knife from behind: the foe faces +x, the Shade stands behind them.
    put(foe, 20, 4, Math.PI / 2);
    put(a, 19, 4, Math.PI / 2);
    foe.armor = 50;
    held.set(a, { yaw: Math.PI / 2, pitch: -0.3, buttons: BUTTON_FIRE });
    step(30, () => {
      put(foe, 20, 4, Math.PI / 2);
      foe.yaw = Math.PI / 2;
    });
    expect(foe.alive).toBe(false);
    expect((match.playerSnapshots().find((p) => p.s === a.slot)?.fx ?? 0) & FX_CLOAK).toBe(0);
  });

  it('bots take a balanced mix of classes and play a CTF round on Twin Spires with them', () => {
    const r = loadMap(readFileSync(new URL('../../../maps/twin_spires.json', import.meta.url), 'utf8'));
    if (!r.ok) throw new Error('twin_spires failed to load');
    const match = new Match(r.map, { ...DEFAULT_RULES['core.ctf'], classes: true, classLimit: 2, teamSizes: [5, 5] }, 3);
    const bots = Array.from({ length: 10 }, (_, i) => match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal)!);
    for (const team of new Set(bots.map((b) => b.faction))) {
      const ids = bots.filter((b) => b.faction === team).map((b) => b.cls!.id);
      expect(new Set(ids).size).toBe(5);
      expect(ids).toEqual(expect.arrayContaining(['rocketeer', 'medic', 'bulwark', 'mechanic', 'runner']));
    }
    const events: GameEvent[] = [];
    let sentries = 0;
    for (let t = 0; t < 60 * 120; t++) {
      events.push(...match.step());
      sentries = Math.max(sentries, match.mountSnapshots().filter((m) => m[0]! >= BUILT_MOUNT_BASE && m[8] === 1).length);
    }
    expect(sentries).toBeGreaterThan(0);
    expect(events.filter((e) => e.e === 'kill').length).toBeGreaterThan(3);
    // Medics heal teammates (not just themselves).
    const medics = new Set(bots.filter((b) => b.cls?.id === 'medic').map((b) => b.slot));
    expect(events.some((e) => e.e === 'heal' && medics.has(e.s) && e.t !== e.s)).toBe(true);
    // Classes keep their health: a Bulwark spawns with 200.
    for (const b of bots) expect(b.maxHealth).toBe(CLASS_DEFS[b.cls!.id].health);
  }, 120_000);
});
