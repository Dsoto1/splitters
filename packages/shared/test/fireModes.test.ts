import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_FIRE,
  BUTTON_ZOOM,
  DESIGNER_BASE_LOOK,
  DEFAULT_DEATHMATCH_RULES,
  PLAYER,
  PhysicsWorld,
  clampFireMode,
  fireModeCount,
  firingOf,
  getWeapon,
  gunplayOf,
  initPhysics,
  lookAngles,
  nextFireMode,
  weaponCode,
  CORE_WEAPONS,
  CORE_BOT_PROFILES,
  BOT_DIFFICULTIES,
  type GameEvent,
  type MapDocument,
  type MatchRules,
  type Vec3,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { botFireMode, BOT_BURST_INSIDE, BOT_MODE_BAND } from '../src/bots/fireModePick.ts';
import { makeMap } from './helpers.ts';
import { LocalPlayer } from '../../client/src/game/prediction.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
const eye = (p: Vec3) => ({ x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z });
const BR = 'core.battle_rifle';
const SINGLE = 0;
const BURST = 1;

/** A long deck: 10 cells (80 m) along x. */
function range(): MapDocument {
  const tiles = [];
  for (let x = -1; x <= 9; x++) for (let y = -1; y <= 1; y++) tiles.push({ id: `p_${x}_${y}`, tile: 'core.platform', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 0]]);
}

function give(c: Combatant, id: string): void {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
  c.raiseTicks = 0;
  c.fireCooldown = 0;
}

/** Shooter `a` at the origin, target `b` `dist` m down the deck. */
function duel(dist: number) {
  const match = new Match(range(), rules);
  const a = match.addHuman('a')!;
  const b = match.addHuman('b')!;
  // (Both on Linktifa's body, the one these numbers were measured on: the sim's default look moved to Cal on 2026-11-24, and
  // Linktifa is off the roster, so set here rather than picked; the hit shapes follow the look.)
  a.look = b.look = DESIGNER_BASE_LOOK.id;
  a.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
  b.move = { pos: { x: dist, y: 0, z: 0 }, velY: 0, grounded: true };
  give(a, BR);
  return { match, a, b };
}

/** Ticks at which `a` fired a round (`shot` events), over `ticks` inputs pressing per `press(t)`. */
function shots(mode: number, ticks: number, press: (t: number, a: Combatant) => boolean, modeAt: (t: number) => number = () => mode) {
  const { match, a, b } = duel(30);
  b.move.pos.z = 6; // out of the line of fire
  const fired: number[] = [];
  const look = lookAngles(eye(a.move.pos), { x: 30, y: 1.2, z: 0 });
  for (let t = 0; t < ticks; t++) {
    match.queueInputs(a.slot, [{ seq: t + 1, forward: 0, right: 0, buttons: press(t, a) ? BUTTON_FIRE : 0, ...look, fireMode: modeAt(t) }]);
    match.queueInputs(b.slot, [{ seq: t + 1, forward: 0, right: 0, buttons: 0, yaw: 0, pitch: 0 }]);
    for (const e of match.step()) if (e.e === 'shot' && e.s === a.slot) fired.push(t);
  }
  const mag = [...a.weapons.values()].find((w) => w.def.id === BR)!.mag;
  match.destroy();
  return { fired, mag };
}

/**
 * Time to kill a standing target `dist` m away (ms, first round to the kill), aimed at the chest, a perfect clicker
 * (pressing whenever the gun is ready), `counter` share of the recoil pulled back down each input (0: none). Null: no
 * kill in 3 s.
 */
function ttk(mode: number, dist: number, aimY = 1.25, counter = 0): number | null {
  const { match, a, b } = duel(dist);
  const look = lookAngles(eye(a.move.pos), { x: dist, y: aimY, z: 0 });
  let first: number | null = null;
  let kill: number | null = null;
  for (let t = 0; t < 180 && kill === null; t++) {
    const press = a.fireCooldown <= 1 && a.burstLeft === 0;
    const rc: [number, number] | undefined = counter ? [a.gun.rp * counter, a.gun.ry * counter] : undefined;
    match.queueInputs(a.slot, [{ seq: t + 1, forward: 0, right: 0, buttons: press ? BUTTON_FIRE : 0, ...look, fireMode: mode, ...(rc ? { rc } : {}) }]);
    match.queueInputs(b.slot, [{ seq: t + 1, forward: 0, right: 0, buttons: 0, yaw: 0, pitch: 0 }]);
    const ev: GameEvent[] = match.step();
    if (first === null && ev.some((e) => e.e === 'shot' && e.s === a.slot)) first = t;
    if (!b.alive) kill = t;
  }
  match.destroy();
  return kill === null || first === null ? null : Math.round(((kill - first) * 1000) / 60);
}

describe('fire modes (spec §36)', () => {
  it('leaves weapons without a list on their own trigger: the Burst Rifle and the semi-autos are unchanged', () => {
    for (const def of Object.values(CORE_WEAPONS)) {
      if (def.fireModes) continue;
      const f = firingOf(def);
      expect(fireModeCount(def)).toBe(1);
      expect(f.mode).toBe(def.fireMode ?? 'auto');
      expect(f.interval).toBe(def.fireIntervalTicks);
      expect(f.burst).toEqual(def.fireMode === 'burst' ? (def.burst ?? null) : null);
      expect(f.kick).toBe(gunplayOf(def).kick);
      // A wanted mode it doesn't have is its own.
      expect(firingOf(def, 3)).toBe(f);
    }
    const br = firingOf(getWeapon('core.burst_rifle'));
    expect(br).toMatchObject({ mode: 'burst', interval: 24, burst: { count: 3, intervalTicks: 4 } });
  });

  it('gives the Battle Rifle Single and a 3-round Burst, switched round', () => {
    const def = getWeapon(BR);
    expect(fireModeCount(def)).toBe(2);
    expect(firingOf(def, SINGLE)).toMatchObject({ mode: 'semi', label: 'Single', interval: 12, burst: null });
    expect(firingOf(def, BURST)).toMatchObject({ mode: 'burst', label: 'Burst', interval: 33, burst: { count: 3, intervalTicks: 5 } });
    expect(nextFireMode(def, SINGLE)).toBe(BURST);
    expect(nextFireMode(def, BURST)).toBe(SINGLE);
    expect(clampFireMode(def, 7)).toBe(SINGLE);
    // The burst's own recoil, over the weapon's recovery.
    const k = firingOf(def, BURST).kick!;
    expect(k.pitch).toEqual([0.007, 0.006, 0.034]);
    expect(k.yaw).toEqual([0.015, -0.02, 0.002]);
    expect(k.settle).toBe(gunplayOf(def).kick!.settle);
  });

  it('Single: one round a press, never quicker than its 12-tick interval; holding the trigger fires once', () => {
    expect(shots(SINGLE, 60, () => true).fired).toEqual([0]);
    // Pressing every other tick: one round per press once the interval has passed.
    const { fired } = shots(SINGLE, 60, (t) => t % 2 === 0);
    expect(fired).toEqual([0, 12, 24, 36, 48]);
  });

  it('Burst: three rounds 5 ticks apart per press, the next burst 33 ticks after the first', () => {
    // Held: one burst.
    const held = shots(BURST, 60, () => true);
    expect(held.fired).toEqual([0, 5, 10]);
    expect(held.mag).toBe(17);
    const ready = (_t: number, a: Combatant) => a.fireCooldown <= 1 && a.burstLeft === 0;
    const tapped = shots(BURST, 80, ready);
    expect(tapped.fired).toEqual([0, 5, 10, 33, 38, 43, 66, 71, 76]);
    // A burst runs out with the magazine: 20 rounds are six bursts and two rounds.
    const all = shots(BURST, 240, ready);
    expect(all.fired.length).toBe(20);
    expect(all.fired.slice(-2)).toEqual([198, 203]);
  });

  it('a mode switch mid-burst lets the burst finish; the next press is a single', () => {
    const { fired } = shots(BURST, 60, (_t, a) => a.fireCooldown <= 1 && a.burstLeft === 0, (t) => (t < 3 ? BURST : SINGLE));
    expect(fired).toEqual([0, 5, 10, 33, 45, 57]);
  });

  it('keeps the TTK identity: single 0.6 s body, burst 0.55 s, never quicker than the Assault Rifle; 2 heads kill', () => {
    // Perfect recoil control (the damage model's TTK).
    expect(ttk(SINGLE, 10, 1.25, 1)).toBe(600);
    expect(ttk(BURST, 10, 1.25, 1)).toBe(550);
    // Two rounds to the head kill: 0.2 s in Single, within one burst (5 ticks) up close.
    expect(ttk(SINGLE, 10, 1.62, 1)).toBe(200);
    expect(ttk(BURST, 10, 1.62, 1)).toBe(83);
  });

  it('the burst kicks off target: two heads in one burst only up close, and past 35 m it misses where Single kills', () => {
    // No recoil control at all (the burst's rounds come 83 ms apart: too quick to pull against).
    const chest = [10, 20, 30, 40].map((d) => ({ d, single: ttk(SINGLE, d, 1.2), burst: ttk(BURST, d, 1.2) }));
    const head = [10, 20, 30].map((d) => ({ d, single: ttk(SINGLE, d, 1.6), burst: ttk(BURST, d, 1.6) }));
    // (Measured 2026-11-16: chest 10 m 600/550, 20 m 400/167, 30 m 417/567, 40 m 2833/none; head 10 m 200/83, 20 m 200/550, 30 m 217/567.
    // 2026-11-17, arms their own zone at 0.9x: uncontrolled, the climb puts rounds on the forearms held in front of the chest, 22.5
    // each, so a fifth round: chest 10 m 800/633, 20 m 400/167, 30 m 2817/733, 40 m 2833/none; heads unchanged. With the recoil
    // pulled down (the test above) it is still 600/550.)
    expect(chest[0]).toEqual({ d: 10, single: 800, burst: 633 });
    expect(head[0]!.burst).toBe(83);
    // The second round's sideways kick takes it off a head 20 m away.
    expect(head[1]!.burst!).toBeGreaterThan(head[1]!.single!);
    expect(chest[3]!.single).not.toBeNull();
    expect(chest[3]!.burst === null || chest[3]!.burst > chest[3]!.single!).toBe(true);
  });

  it('client prediction reproduces the host in both modes, switches included, input for input', () => {
    const match = new Match(range(), rules);
    const me = match.addHuman('me')!;
    match.step();
    me.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
    give(me, BR);
    const local = new LocalPlayer(new PhysicsWorld(match.geometry));
    local.reconcile(match.playerSnapshots().find((p) => p.s === me.slot)!, 0, match.privateState(me.slot), match.tick);
    expect(local.fireMode()?.label).toBe('Single');
    let pitch = 0;
    let yaw = 0.2;
    const host = () => [...me.weapons.values()].find((w) => w.def.id === BR)!;
    for (let t = 0; t < 420; t++) {
      if (t === 40 || t === 200 || t === 260) local.cycleFireMode();
      const buttons = (t % 7 < 3 ? BUTTON_FIRE : 0) | (t % 120 > 80 ? BUTTON_ZOOM : 0) | (t === 300 ? 4 : 0);
      pitch += t % 7 < 3 ? -0.003 : 0.001;
      const { input, absorbed } = local.tick({ forward: 0, right: 0, buttons }, yaw, pitch, 0, 0);
      expect(input.fireMode).toBe(t < 40 || (t >= 200 && t < 260) ? SINGLE : BURST);
      if (absorbed) {
        pitch += absorbed[0];
        yaw += absorbed[1];
      }
      match.queueInputs(me.slot, [input]);
      match.step();
      expect(host().mode ?? 0, `tick ${t}`).toBe(input.fireMode);
      expect(local.gun.rp, `tick ${t}`).toBe(me.gun.rp);
      expect(local.gun.ry, `tick ${t}`).toBe(me.gun.ry);
      expect(local.gun.shots, `tick ${t}`).toBe(me.gun.shots);
      expect(local.reloadTicks, `tick ${t}`).toBe(me.reloadTicks);
      expect(local.inventory.get(local.held)![0], `tick ${t}`).toBe(host().mag);
    }
    match.destroy();
  });

  it('a mode the host has not seen is replayed after a correction (reconcile keeps the wanted mode)', () => {
    const match = new Match(range(), rules);
    const me = match.addHuman('me')!;
    match.step();
    give(me, BR);
    const local = new LocalPlayer(new PhysicsWorld(match.geometry));
    local.reconcile(match.playerSnapshots().find((p) => p.s === me.slot)!, 0, match.privateState(me.slot), match.tick);
    expect(local.cycleFireMode()?.label).toBe('Burst');
    // The host hears nothing for a while (inputs held back), then a snapshot arrives: the mode stays wanted.
    const held = [];
    for (let t = 0; t < 5; t++) held.push(local.tick({ forward: 0, right: 0, buttons: 0 }, 0, 0, 0, 0).input);
    local.reconcile(match.playerSnapshots().find((p) => p.s === me.slot)!, 0, match.privateState(me.slot), match.tick);
    expect(local.fireMode()?.label).toBe('Burst');
    match.queueInputs(me.slot, held);
    for (let t = 0; t < 5; t++) match.step();
    expect([...me.weapons.values()].find((w) => w.def.id === BR)!.mode).toBe(BURST);
    match.destroy();
  });

  it('bots: a burst up close, single shots at range, the mode held inside the band', () => {
    const def = getWeapon(BR);
    expect(botFireMode(def, 8, SINGLE)).toBe(BURST);
    expect(botFireMode(def, 60, BURST)).toBe(SINGLE);
    expect(botFireMode(def, BOT_BURST_INSIDE, SINGLE)).toBe(SINGLE);
    expect(botFireMode(def, BOT_BURST_INSIDE, BURST)).toBe(BURST);
    expect(botFireMode(def, BOT_BURST_INSIDE + BOT_MODE_BAND + 1, BURST)).toBe(SINGLE);
    expect(botFireMode(def, null, BURST)).toBe(BURST);
    // A weapon without modes is left alone.
    expect(botFireMode(getWeapon('core.burst_rifle'), 5, 0)).toBe(0);
  });

  it('bots in a match send the mode for the Battle Rifle and fight with it', () => {
    const match = new Match(range(), rules);
    const bot = match.addBot('bot', CORE_BOT_PROFILES[0]!, BOT_DIFFICULTIES.hard)!;
    const me = match.addHuman('me')!;
    match.step();
    bot.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
    me.move = { pos: { x: 10, y: 0, z: 0 }, velY: 0, grounded: true };
    give(bot, BR);
    let fired = 0;
    for (let t = 0; t < 600 && me.alive; t++) {
      match.queueInputs(me.slot, [{ seq: t + 1, forward: 0, right: 0, buttons: 0, yaw: 0, pitch: 0 }]);
      for (const e of match.step()) if (e.e === 'shot' && e.s === bot.slot) fired++;
      bot.weapons.forEach((w) => (w.reserve = w.def.reserveMax));
    }
    const br = [...bot.weapons.values()].find((w) => w.def.id === BR);
    expect(fired).toBeGreaterThan(0);
    expect(br?.mode).toBe(BURST);
    match.destroy();
  });
});
