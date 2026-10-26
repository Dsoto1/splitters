import { beforeAll, describe, expect, it } from 'vitest';
import {
  BOT_DIFFICULTIES,
  BUTTON_FIRE,
  BUTTON_ZOOM,
  CORE_BOT_PROFILES,
  DEFAULT_DEATHMATCH_RULES,
  PLAYER,
  PhysicsWorld,
  createRng,
  flightTo,
  getWeapon,
  gunplayOf,
  initPhysics,
  kickOf,
  lookAngles,
  newGunState,
  recoilIdle,
  recoilShot,
  settleTicks,
  spreadOf,
  weaponCode,
  type GameEvent,
  type MapDocument,
  type MatchRules,
  type PlayerInput,
  type Vec3,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';
import { AimModel } from '../src/bots/aim.ts';
import { LocalPlayer } from '../../client/src/game/prediction.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
const eye = (p: Vec3) => ({ x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z });

function yard(): MapDocument {
  const tiles = [];
  for (let x = -1; x <= 3; x++) for (let y = -1; y <= 1; y++) tiles.push({ id: `p_${x}_${y}`, tile: 'core.platform', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 0]]);
}

function give(c: Combatant, id: string): void {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
  c.raiseTicks = 0;
  c.fireCooldown = 0;
}

describe('mechanical recoil', () => {
  it('is a deterministic per-weapon pattern with bounded sideways variance', () => {
    for (const id of ['core.pistol', 'core.revolver', 'core.smg', 'core.rifle']) {
      const k = gunplayOf(getWeapon(id)).kick!;
      for (let i = 0; i < 30; i++) {
        const a = kickOf(k, i);
        expect(kickOf(k, i)).toEqual(a);
        const pattern = k.yaw.length ? Math.max(...k.yaw.map(Math.abs)) : 0;
        expect(Math.abs(a.yaw)).toBeLessThanOrEqual(pattern + k.variance + 1e-12);
        expect(a.pitch).toBeGreaterThan(0);
      }
    }
    // The rifle climbs steadily: its upward pattern is the same every spray.
    const g1 = newGunState();
    const g2 = newGunState();
    const k = gunplayOf(getWeapon('core.rifle')).kick!;
    for (let i = 0; i < 12; i++) {
      recoilShot(g1, k);
      recoilShot(g2, k);
    }
    expect(g1).toEqual(g2);
    expect(g1.rp).toBeCloseTo(k.pitch[0]! + 11 * k.pitch[1]!, 10);
  });

  it('makes the weapons radically different: the revolver kicks hardest, the SMG starts gentlest', () => {
    const first = (id: string) => kickOf(gunplayOf(getWeapon(id)).kick!, 0).pitch;
    expect(first('core.revolver')).toBeGreaterThan(first('core.rifle') * 5);
    expect(first('core.smg')).toBeLessThan(first('core.pistol'));
    expect(first('core.smg')).toBeLessThan(first('core.rifle'));
    // The SMG's sustained climb is harder than its first rounds.
    const smg = gunplayOf(getWeapon('core.smg')).kick!;
    expect(kickOf(smg, 8).pitch).toBeGreaterThan(kickOf(smg, 0).pitch);
  });

  it('recovers predictably back to where the spray started, each weapon on its own curve', () => {
    for (const id of ['core.smg', 'core.rifle', 'core.revolver']) {
      const gp = gunplayOf(getWeapon(id));
      const g = newGunState();
      for (let i = 0; i < 5; i++) recoilShot(g, gp.kick);
      const kicked = g.rp;
      let ticks = 0;
      while (g.rp > 0 && ticks < 2000) {
        recoilIdle(g, gp.kick, gp.accuracy, 1);
        ticks++;
      }
      expect(g.rp).toBe(0);
      expect(g.ry).toBe(0);
      expect(g.shots).toBe(0);
      // The same spray always settles in the same time.
      expect(ticks).toBe(settleTicks(gp.kick!, kicked));
      expect(ticks).toBeGreaterThan(gp.kick!.delay);
    }
    // The revolver settles slowly, the SMG very fast.
    const time = (id: string) => settleTicks(gunplayOf(getWeapon(id)).kick!, 0.1);
    expect(time('core.revolver')).toBeGreaterThan(time('core.smg') * 2);
  });

  it('moves the real aim on the server: a held spray climbs off a target, pulling down against it keeps it on', () => {
    const spray = (counter: number) => {
      const match = new Match(yard(), rules);
      const a = match.addHuman('a')!;
      const b = match.addHuman('b')!;
      a.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
      b.move = { pos: { x: 20, y: 0, z: 0 }, velY: 0, grounded: true };
      give(a, 'core.rifle');
      const look = lookAngles(eye(a.move.pos), { x: 20, y: 1.1, z: 0 });
      let seq = 0;
      const events: GameEvent[] = [];
      for (let t = 0; t < 90; t++) {
        // `counter` share of the recoil is pulled back down each tick (as a player's mouse would).
        const rc: [number, number] | undefined = counter ? [a.gun.rp * counter, a.gun.ry * counter] : undefined;
        match.queueInputs(a.slot, [{ seq: ++seq, forward: 0, right: 0, buttons: BUTTON_FIRE, ...look, ...(rc ? { rc } : {}) }]);
        match.queueInputs(b.slot, [{ seq, forward: 0, right: 0, buttons: 0, yaw: 0, pitch: 0 }]);
        events.push(...match.step());
        b.health = 100;
        b.alive = true;
      }
      const hits = events.filter((e) => (e.e === 'shot' && e.hit[0] === b.slot) || (e.e === 'impact' && e.hit === b.slot)).length;
      match.destroy();
      return { hits, climb: a.gun.rp };
    };
    const free = spray(0);
    const pulled = spray(0.9);
    expect(free.climb).toBeGreaterThan(0.05);
    expect(pulled.climb).toBeLessThan(free.climb * 0.2);
    expect(pulled.hits).toBeGreaterThan(free.hits + 3);
  });

  it('client prediction reproduces the server recoil, spray and reload state input for input', () => {
    const match = new Match(yard(), rules);
    const me = match.addHuman('me')!;
    match.step();
    me.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
    give(me, 'core.smg');
    const local = new LocalPlayer(new PhysicsWorld(match.geometry));
    local.reconcile(match.playerSnapshots().find((p) => p.s === me.slot)!, 0, match.privateState(me.slot), match.tick);
    expect(local.held).toBe(weaponCode(getWeapon('core.smg')));
    let yaw = 0.3;
    let pitch = 0;
    for (let t = 0; t < 400; t++) {
      // Bursts and pauses, the mouse pulling down (countering) during bursts and drifting about otherwise; ADS some of the time.
      const firing = t % 90 < 40 && t < 300;
      pitch += firing ? -0.004 : Math.sin(t / 13) * 0.002;
      yaw += Math.sin(t / 7) * 0.003;
      const buttons = (firing ? BUTTON_FIRE : 0) | (t % 150 > 100 ? BUTTON_ZOOM : 0) | (t === 320 ? 4 /* reload */ : 0);
      const { input, absorbed } = local.tick({ forward: 0, right: 0, buttons }, yaw, pitch, 0, 0);
      if (absorbed) {
        pitch += absorbed[0];
        yaw += absorbed[1];
      }
      match.queueInputs(me.slot, [input]);
      match.step();
      expect(local.gun.rp, `tick ${t}`).toBe(me.gun.rp);
      expect(local.gun.ry, `tick ${t}`).toBe(me.gun.ry);
      expect(local.gun.spray, `tick ${t}`).toBe(me.gun.spray);
      expect(local.gun.ads, `tick ${t}`).toBe(me.gun.ads);
      expect(local.reloadTicks, `tick ${t}`).toBe(me.reloadTicks);
      expect(local.inventory.get(local.held)![0], `tick ${t}`).toBe([...me.weapons.values()].find((w) => w.def.id === 'core.smg')!.mag);
    }
    match.destroy();
  });
});

describe('spread', () => {
  it('SMG: tight for the first rounds of a burst, then opening up fast; quick to recover', () => {
    const gp = gunplayOf(getWeapon('core.smg'));
    const a = gp.accuracy!;
    const g = newGunState();
    const still = { run: 0, airborne: false, stance: 1 };
    const cones: number[] = [];
    for (let i = 0; i < 15; i++) {
      cones.push(spreadOf(a, g, still));
      recoilShot(g, gp.kick);
    }
    expect(a.tight).toBeGreaterThanOrEqual(3);
    expect(a.tight).toBeLessThanOrEqual(5);
    for (let i = 0; i <= a.tight; i++) expect(cones[i]).toBe(a.base);
    expect(cones[14]!).toBeGreaterThan(a.base * 5);
    // Let go: a fraction of a second later it is tight again.
    for (let i = 0; i < 60; i++) recoilIdle(g, gp.kick, a, getWeapon('core.smg').fireIntervalTicks);
    expect(spreadOf(a, g, still)).toBe(a.base);
  });

  it('a settled precision weapon puts its first round where the reticle is; moving and jumping open it up', () => {
    for (const id of ['core.sniper', 'core.revolver', 'core.pistol', 'core.rifle']) {
      const a = gunplayOf(getWeapon(id)).accuracy!;
      const g = { ...newGunState(), ads: 1 };
      expect(spreadOf(a, g, { run: 0, airborne: false, stance: 1 }), id).toBeLessThanOrEqual(0.0015);
      expect(spreadOf(a, g, { run: 1, airborne: false, stance: 1 })).toBeGreaterThan(spreadOf(a, g, { run: 0, airborne: false, stance: 1 }));
      expect(spreadOf(a, g, { run: 0, airborne: true, stance: 1 })).toBeGreaterThan(spreadOf(a, g, { run: 1, airborne: false, stance: 1 }));
    }
    // Hip-fire specialists barely gain from the sights; rifles gain a lot.
    expect(gunplayOf(getWeapon('core.smg')).accuracy!.ads).toBeGreaterThan(gunplayOf(getWeapon('core.rifle')).accuracy!.ads);
  });
});

describe('bots and ballistics', () => {
  /** Where a bot's aim point sits relative to where a target running across at `dist` will be when the round arrives (m, sideways). */
  function leadError(difficulty: keyof typeof BOT_DIFFICULTIES, weapon: string, dist: number): number {
    const def = getWeapon(weapon);
    const aim = new AimModel(createRng(7), BOT_DIFFICULTIES[difficulty], CORE_BOT_PROFILES[0]!);
    const speed = 5.2;
    const ctx = (tick: number) => ({ tick, eye: { x: 0, y: 1.6, z: 0 }, speed: 0, airborne: false, stance: 0 as const, steady: true, weapon: def });
    let sol = { yaw: 0, pitch: 0, dist: 0, halfAngle: 0 };
    let z = 0;
    for (let t = 0; t < 120; t++) {
      z = -10 + (speed * t) / 60;
      aim.track(ctx(t), { slot: 1, pos: { x: dist, y: 0, z } });
      aim.errYaw = 0;
      aim.errPitch = 0;
      sol = aim.solve(ctx(t), { slot: 1, pos: { x: dist, y: 0, z } });
    }
    const t = flightTo(gunplayOf(def).ballistic!, dist).time;
    const arrives = z + speed * t;
    // Yaw 0 faces +z: the aim point's sideways position at that range.
    const aimedZ = dist / Math.tan(sol.yaw);
    return Math.abs(aimedZ - arrives);
  }

  it('a weak bot with a sniper rifle misses a runner far away; a strong one leads it', () => {
    expect(leadError('easy', 'core.sniper', 120)).toBeGreaterThan(PLAYER.radius);
    expect(leadError('hard', 'core.sniper', 120)).toBeLessThan(PLAYER.radius);
    // Slower rounds need more lead, and weak bots fall further behind.
    expect(leadError('easy', 'core.pistol', 80)).toBeGreaterThan(leadError('easy', 'core.sniper', 80));
  });

  it('skill sets lead, drop and recoil compensation and burst discipline', () => {
    const easy = BOT_DIFFICULTIES.easy.aim;
    const hard = BOT_DIFFICULTIES.hard.aim;
    for (const k of ['leadSkill', 'dropComp', 'recoilComp', 'discipline'] as const) expect(hard[k]!, k).toBeGreaterThan(easy[k]!);
  });
});
