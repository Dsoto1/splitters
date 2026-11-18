/**
 * Gun handling extras (docs/GUNPLAY_SPEC.md §27, §35, §5; GUNPLAY_GAPS G2): movement speed per weapon, sprint-exit
 * time and scope holdover marks. The host (Match) and client prediction (LocalPlayer) run the same rules, so a
 * player moving, sprinting, switching and firing is predicted exactly; bots go through the same movement step.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_FIRE,
  BUTTON_SPRINT,
  CORE_BOT_PROFILES,
  CORE_WEAPONS,
  DEFAULT_DEATHMATCH_RULES,
  FAMILY_DEFAULTS,
  PLAYER,
  PhysicsWorld,
  flightTo,
  getWeapon,
  gunplayOf,
  holdoverMarks,
  initPhysics,
  weaponCode,
  type MapDocument,
  type MatchRules,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';
import { LocalPlayer } from '../../client/src/game/prediction.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
/** Facing +x (stepMovement: forward is (sin yaw, cos yaw)). */
const EAST = Math.PI / 2;

/** A long deck: 14 cells (112 m) along x. */
function deck(): MapDocument {
  const tiles = [];
  for (let x = -1; x <= 13; x++) for (let y = -1; y <= 1; y++) tiles.push({ id: `p_${x}_${y}`, tile: 'core.platform', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 0]]);
}

function give(c: Combatant, ...ids: string[]): void {
  for (const id of ids) {
    const def = getWeapon(id);
    c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  }
  c.current = weaponCode(getWeapon(ids[0]!));
  c.raiseTicks = 0;
  c.fireCooldown = 0;
}

function solo(...ids: string[]) {
  const match = new Match(deck(), rules);
  const me = match.addHuman('me')!;
  match.step();
  me.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
  give(me, ...ids);
  return { match, me };
}

/** Metres run east in `ticks` inputs holding `id`, sprinting or not. */
function run(id: string, ticks: number, sprint: boolean): number {
  const { match, me } = solo(id);
  for (let t = 0; t < ticks; t++) {
    match.queueInputs(me.slot, [{ seq: t + 1, forward: 1, right: 0, buttons: sprint ? BUTTON_SPRINT : 0, yaw: EAST, pitch: 0 }]);
    match.step();
  }
  const x = me.move.pos.x;
  match.destroy();
  return x;
}

/** Ticks from the input that ends a sprint (and pulls the trigger, held) to the first round, holding `id`. */
function exitTicks(id: string, sprintFor: number): number | null {
  const { match, me } = solo(id);
  let pressed: number | null = null;
  for (let t = 0; t < sprintFor + 60; t++) {
    const fire = t >= sprintFor;
    if (fire && pressed === null) pressed = t;
    match.queueInputs(me.slot, [{ seq: t + 1, forward: 1, right: 0, buttons: fire ? BUTTON_FIRE : BUTTON_SPRINT, yaw: EAST, pitch: 0 }]);
    const ev = match.step();
    if (ev.some((e) => e.e === 'shot' && e.s === me.slot)) {
      match.destroy();
      return t - pressed!;
    }
  }
  match.destroy();
  return null;
}

describe('gun handling (spec §27, §35)', () => {
  it('every family and weapon carries mild handling: 0.85-1.1 of running speed, out of a sprint within 0.3 s', () => {
    for (const [fam, d] of Object.entries(FAMILY_DEFAULTS)) {
      expect(d.handling.move, fam).toBeGreaterThanOrEqual(0.85);
      expect(d.handling.sprintExit, fam).toBeLessThanOrEqual(18);
    }
    for (const def of Object.values(CORE_WEAPONS)) {
      const h = gunplayOf(def).handling;
      expect(h.move, def.id).toBeGreaterThanOrEqual(0.85);
      expect(h.move, def.id).toBeLessThanOrEqual(1.1);
      expect(h.sprintExit, def.id).toBeGreaterThanOrEqual(0);
      expect(h.sprintExit, def.id).toBeLessThanOrEqual(18);
      if (def.kind === 'melee') expect(h.sprintExit, def.id).toBe(0);
    }
    // Sidearms and SMGs at full speed and quickest out of a sprint; the heavy end slower on both.
    expect(gunplayOf(getWeapon('core.pistol')).handling).toEqual({ move: 1, sprintExit: 3 });
    expect(gunplayOf(getWeapon('core.smg')).handling).toEqual({ move: 1, sprintExit: 5 });
    expect(gunplayOf(getWeapon('core.rifle')).handling).toEqual({ move: 0.97, sprintExit: 8 });
    expect(gunplayOf(getWeapon('core.lmg')).handling).toEqual({ move: 0.9, sprintExit: 13 });
    expect(gunplayOf(getWeapon('core.sniper')).handling).toEqual({ move: 0.93, sprintExit: 12 });
    expect(gunplayOf(getWeapon('core.rockets')).handling).toEqual({ move: 0.92, sprintExit: 12 });
    expect(gunplayOf(getWeapon('core.knife')).handling).toEqual({ move: 1, sprintExit: 0 });
  });

  it('runs at the held weapon\'s speed; a sprint is as fast with every weapon', () => {
    const pistol = run('core.pistol', 90, false);
    const lmg = run('core.lmg', 90, false);
    expect(pistol).toBeGreaterThan(PLAYER.runSpeed * 1.4);
    expect(lmg / pistol).toBeCloseTo(0.9, 2);
    expect(run('core.rifle', 90, false) / pistol).toBeCloseTo(0.97, 2);
    expect(run('core.lmg', 60, true)).toBeCloseTo(run('core.pistol', 60, true), 5);
  });

  it('fires its sprint-exit time after a sprint ends (a held trigger waits, then fires); at once from a run', () => {
    for (const id of ['core.pistol', 'core.smg', 'core.rifle', 'core.lmg', 'core.shotgun']) {
      // (A spin-up weapon starts spinning once it is up: the LMG's wind-up follows its exit.)
      const def = getWeapon(id);
      expect(exitTicks(id, 30), id).toBe(gunplayOf(def).handling.sprintExit + Math.max(0, (def.windupTicks ?? 0) - 1));
      // Not sprinting: no wait.
      const { match, me } = solo(id);
      let first = -1;
      for (let t = 0; t < 60 && first < 0; t++) {
        match.queueInputs(me.slot, [{ seq: t + 1, forward: 1, right: 0, buttons: BUTTON_FIRE, yaw: EAST, pitch: 0 }]);
        if (match.step().some((e) => e.e === 'shot' && e.s === me.slot)) first = t;
      }
      expect(first, id).toBe(def.windupTicks ? def.windupTicks - 1 : 0);
      match.destroy();
    }
    // A knife is ready straight out of a sprint.
    const { match, me } = solo('core.knife');
    for (let t = 0; t < 31; t++) {
      match.queueInputs(me.slot, [{ seq: t + 1, forward: 1, right: 0, buttons: t < 30 ? BUTTON_SPRINT : 0, yaw: EAST, pitch: 0 }]);
      match.step();
    }
    expect(me.raiseTicks).toBe(0);
    match.destroy();
  });

  it('client prediction matches the host tick for tick: running, sprinting, switching, firing', () => {
    const { match, me } = solo('core.rifle', 'core.pistol', 'core.lmg');
    const local = new LocalPlayer(new PhysicsWorld(match.geometry));
    local.reconcile(match.playerSnapshots().find((p) => p.s === me.slot)!, 0, match.privateState(me.slot), match.tick);
    const codes = ['core.rifle', 'core.pistol', 'core.lmg'].map((id) => weaponCode(getWeapon(id)));
    let exits = 0;
    let raisedBySprint = 0;
    for (let t = 0; t < 600; t++) {
      const phase = t % 50;
      const buttons = phase < 20 ? BUTTON_SPRINT : phase < 26 || (phase > 34 && phase < 40) ? BUTTON_FIRE : 0;
      const weapon = t % 150 === 45 ? codes[(t / 150) % 3 | 0]! : t % 150 === 100 ? codes[((t / 150 | 0) + 1) % 3]! : 0;
      const forward = t % 300 < 150 ? 1 : -1;
      const yaw = forward > 0 ? EAST : -EAST;
      const sprintBefore = !!me.move.sprint;
      const { input } = local.tick({ forward: 1, right: phase > 40 ? 0.5 : 0, buttons }, yaw, 0, weapon, 0);
      match.queueInputs(me.slot, [input]);
      match.step();
      if (sprintBefore && !me.move.sprint) {
        exits++;
        if (me.raiseTicks > 0) raisedBySprint++;
      }
      expect(local.state.pos, `tick ${t}`).toEqual(me.move.pos);
      expect(local.raiseTicks, `tick ${t}`).toBe(me.raiseTicks);
      expect(local.held, `tick ${t}`).toBe(me.current);
      expect(local.inventory.get(local.held)![0], `tick ${t}`).toBe(me.weapons.get(me.current)!.mag);
    }
    expect(exits).toBeGreaterThan(5);
    expect(raisedBySprint).toBeGreaterThan(5);
    match.destroy();
  });

  it('a correction replays held-back inputs with the weapon in hand at each and the sprint exit they made', () => {
    const { match, me } = solo('core.lmg', 'core.pistol');
    const local = new LocalPlayer(new PhysicsWorld(match.geometry));
    const sync = () => local.reconcile(match.playerSnapshots().find((p) => p.s === me.slot)!, me.lastSeq, match.privateState(me.slot), match.tick);
    const pending: ReturnType<LocalPlayer['tick']>['input'][] = [];
    sync();
    const pistol = weaponCode(getWeapon('core.pistol'));
    /** Each correction must change nothing: what was predicted live is what the replay from the host's state gives. */
    const step = (t: number) => {
      match.queueInputs(me.slot, [pending.shift()!]);
      match.step();
      const pos = { ...local.state.pos };
      const raise = local.raiseTicks;
      sync();
      expect(local.state.pos, `tick ${t}`).toEqual(pos);
      expect(local.raiseTicks, `tick ${t}`).toBe(raise);
    };
    let raisedOutOfSprint = 0;
    for (let t = 0; t < 120; t++) {
      // Sprint, stop, switch to the pistol mid-way, sprint and stop again; the host hears them 6 inputs late.
      const buttons = t < 20 || (t >= 60 && t < 80) ? BUTTON_SPRINT : 0;
      pending.push(local.tick({ forward: 1, right: 0, buttons }, EAST, 0, t === 40 ? pistol : 0, 0).input);
      if ((t === 20 || t === 80) && local.raiseTicks > 0) raisedOutOfSprint++;
      if (pending.length > 6) step(t);
    }
    while (pending.length) step(120);
    expect(raisedOutOfSprint).toBe(2);
    expect(local.state.pos).toEqual(me.move.pos);
    expect(local.raiseTicks).toBe(me.raiseTicks);
    expect(local.held).toBe(pistol);
    match.destroy();
  });

  it('bots run by the same rule: an LMG-carrying bot runs at 0.9 of a pistol-carrying one', () => {
    /** The fastest a bot holding `id` runs (not sprinting, nothing pushing it), over its body's speed. */
    const fastest = (id: string): number => {
      const match = new Match(deck(), rules);
      const bot = match.addBot('bot', CORE_BOT_PROFILES[0]!)!;
      const me = match.addHuman('me')!;
      match.step();
      give(bot, id);
      me.move = { pos: { x: 90, y: 0, z: 6 }, velY: 0, grounded: true };
      let top = 0;
      for (let t = 0; t < 600; t++) {
        match.queueInputs(me.slot, [{ seq: t + 1, forward: 0, right: 0, buttons: 0, yaw: 0, pitch: 0 }]);
        match.step();
        bot.current = weaponCode(getWeapon(id));
        if (bot.alive && bot.move.grounded && !bot.move.sprint && !bot.move.stance && !bot.move.vx && !bot.move.vz && bot.speedTicks === 0) top = Math.max(top, bot.moveSpeed / bot.speedMul);
      }
      match.destroy();
      return top;
    };
    const pistol = fastest('core.pistol');
    expect(pistol).toBeGreaterThan(PLAYER.runSpeed * 0.95);
    // (Bots' top speeds are sampled tick by tick, so within a percent.)
    const ratio = fastest('core.lmg') / pistol;
    expect(ratio).toBeGreaterThan(0.89);
    expect(ratio).toBeLessThan(0.915);
  });
});

describe('scope holdover marks (spec §5)', () => {
  it('are the drop at each distance, growing with range and with the ballistics rule', () => {
    const b = gunplayOf(getWeapon('core.sniper')).ballistic!;
    const marks = holdoverMarks(b, {}, [100, 200, 300, 400]);
    marks.forEach((m) => expect(m.angle).toBeCloseTo(Math.atan2(flightTo(b, m.dist).drop, m.dist), 9));
    for (let i = 1; i < marks.length; i++) expect(marks[i]!.angle).toBeGreaterThan(marks[i - 1]!.angle);
    const at = (ballistics: 'arcade' | 'standard' | 'advanced') => holdoverMarks(b, { ballistics }, [300])[0]!.angle;
    expect(at('arcade')).toBeLessThan(at('standard'));
    expect(at('standard')).toBeLessThan(at('advanced'));
    // Subtle at ordinary distances, deliberate far out: well under a milliradian at 100 m, several at 400 m.
    expect(marks[0]!.angle).toBeLessThan(0.002);
    expect(marks[3]!.angle).toBeGreaterThan(0.004);
  });
});
