import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_FIRE,
  BUTTON_RELOAD,
  BUTTON_SPRINT,
  DEFAULT_DEATHMATCH_RULES,
  beginReload,
  getWeapon,
  gunplayOf,
  initPhysics,
  roundsReady,
  stepReload,
  weaponCode,
  type AmmoBox,
  type GameEvent,
  type MatchRules,
  type PlayerInput,
} from '../src/index.ts';
import { Match, heldWeapon, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };

/** Run a reload to the end (or `ticks` inputs), returning the box. */
function reloadFor(id: string, box: AmmoBox, ticks = Infinity): { box: AmmoBox; ran: number; done: boolean } {
  const def = getWeapon(id);
  let run = beginReload(def, box);
  let ran = 0;
  while (run && ran < ticks) {
    run = stepReload(def, box, run);
    ran++;
  }
  return { box, ran, done: !run };
}

function setup(weapon: string, mag?: number) {
  const match = new Match(makeMap([{ id: 'room', tile: 'core.room_large', x: 0, y: 0, z: 0, rotation: 0 }], [[0, 0, 0]]), rules);
  const a = match.addHuman('a')!;
  const def = getWeapon(weapon);
  a.weapons.set(weaponCode(def), { def, mag: mag ?? def.magazine, reserve: def.reserveMax, alt: 0 });
  a.current = weaponCode(def);
  a.raiseTicks = 0;
  let seq = 0;
  const step = (i: Partial<PlayerInput> = {}): GameEvent[] => {
    match.queueInputs(a.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0, ...i }]);
    return match.step();
  };
  const run = (n: number, i: Partial<PlayerInput> = {}): GameEvent[] => {
    const out: GameEvent[] = [];
    for (let k = 0; k < n; k++) out.push(...step(i));
    return out;
  };
  return { match, a, def, step, run, held: () => heldWeapon(a) };
}

const shots = (ev: GameEvent[]) => ev.filter((e) => e.e === 'shot').length;

describe('reload timing', () => {
  it('tactical reloads are quicker than empty ones, and every benchmark weapon has its own rhythm', () => {
    for (const id of ['core.pistol', 'core.smg', 'core.rifle']) {
      const def = getWeapon(id);
      const tactical = beginReload(def, { mag: 3, reserve: 100 })!;
      const empty = beginReload(def, { mag: 0, reserve: 100 })!;
      expect(tactical.kind).toBe('tactical');
      expect(empty.kind).toBe('empty');
      expect(empty.total, id).toBeGreaterThan(tactical.total);
      expect(empty.total).toBe(def.reloadTicks);
    }
    const total = (id: string) => beginReload(getWeapon(id), { mag: 0, reserve: 100 })!.total;
    // Snappy SMG, quick pistol, medium rifle, a slow deliberate revolver and a long LMG commitment (spec §17).
    expect(total('core.pistol')).toBeLessThan(total('core.rifle'));
    expect(total('core.smg')).toBeLessThan(total('core.rifle'));
    expect(total('core.revolver')).toBeGreaterThan(total('core.rifle'));
    expect(total('core.lmg')).toBeGreaterThan(total('core.revolver'));
    // No two benchmark weapons reload alike.
    expect(new Set(['core.pistol', 'core.smg', 'core.rifle', 'core.revolver'].map(total)).size).toBe(4);
  });

  it('ammunition follows the stage a magazine reload reached', () => {
    const def = getWeapon('core.rifle');
    const r = gunplayOf(def).reload;
    if (r.type !== 'magazine') throw new Error('rifle reloads by magazine');
    // Tactical, stopped after the old magazine came out: one round stays chambered, the rest went back to reserve.
    const out = reloadFor('core.rifle', { mag: 12, reserve: 60 }, Math.round(r.tactical * r.out) + 1);
    expect(out.box).toEqual({ mag: 1, reserve: 71 });
    expect(roundsReady(out.box)).toBe(1);
    // Empty, stopped after the new magazine went in but before the bolt: full, but nothing chambered.
    const mid = reloadFor('core.rifle', { mag: 0, reserve: 60 }, Math.round(r.empty * r.in) + 1);
    expect(mid.box.mag).toBe(def.magazine);
    expect(mid.box.unchambered).toBe(true);
    expect(roundsReady(mid.box)).toBe(0);
    // Pressing reload again only works the bolt: a short chamber-only reload.
    const chamber = beginReload(def, mid.box)!;
    expect(chamber.kind).toBe('chamber');
    expect(chamber.total).toBeLessThan(r.empty * 0.5);
    const rest = reloadFor('core.rifle', mid.box);
    expect(rest.done).toBe(true);
    expect(roundsReady(rest.box)).toBe(def.magazine);
    // Run to the end: full and chambered, reserve spent by what was needed.
    const full = reloadFor('core.rifle', { mag: 7, reserve: 60 });
    expect(full.box).toEqual({ mag: def.magazine, reserve: 60 - (def.magazine - 7) });
    expect(full.ran).toBe(r.tactical);
  });

  it('loads a shotgun shell by shell, each one there the moment it goes in', () => {
    const def = getWeapon('core.shotgun');
    const r = gunplayOf(def).reload;
    if (r.type !== 'shell') throw new Error('shotgun reloads by the shell');
    const box: AmmoBox = { mag: 0, reserve: 20 };
    let run = beginReload(def, box);
    const loadedAt: number[] = [];
    for (let t = 1; run; t++) {
      const before = box.mag;
      run = stepReload(def, box, run);
      if (box.mag > before) loadedAt.push(t);
    }
    expect(box.mag).toBe(def.magazine);
    expect(box.reserve).toBe(20 - def.magazine);
    // A steady rhythm: one shell every `each` ticks after the start.
    expect(loadedAt).toEqual(Array.from({ length: def.magazine }, (_, k) => r.start + r.each * (k + 1)));
  });
});

describe('reload interrupts (in a match)', () => {
  it('fire interrupts a tactical reload with the chambered round, and the reload keeps its stage', () => {
    const { run, held, a, def } = setup('core.rifle', 10);
    run(1, { buttons: BUTTON_RELOAD });
    expect(a.reloadTicks).toBeGreaterThan(0);
    const r = gunplayOf(def).reload;
    if (r.type !== 'magazine') throw new Error('magazine');
    // Past "magazine out": 1 in the chamber.
    run(Math.round(r.tactical * r.out) + 1);
    expect(held().mag).toBe(1);
    const ev = run(1, { buttons: BUTTON_FIRE });
    expect(shots(ev)).toBe(1);
    expect(a.reloadTicks).toBe(0);
    expect(held().mag).toBe(0);
  });

  it('a shotgun fires a freshly loaded shell straight out of the reload', () => {
    const { run, held, a, def } = setup('core.shotgun', 0);
    const r = gunplayOf(def).reload;
    if (r.type !== 'shell') throw new Error('shell');
    run(1, { buttons: BUTTON_RELOAD });
    run(r.start + r.each);
    expect(held().mag).toBe(1);
    expect(a.reloadTicks).toBeGreaterThan(0);
    expect(shots(run(1, { buttons: BUTTON_FIRE }))).toBe(1);
    expect(held().mag).toBe(0);
    // Load another, fire it: load 1 → can fire → load another → can fire (spec §17).
    run(def.fireIntervalTicks, { buttons: BUTTON_RELOAD });
    run(r.start + r.each);
    expect(held().mag).toBeGreaterThanOrEqual(1);
    expect(shots(run(1, { buttons: BUTTON_FIRE }))).toBe(1);
  });

  it('the revolver reloads round by round in a slow rhythm, and each round can be fired', () => {
    const { run, held, def } = setup('core.revolver', 0);
    const r = gunplayOf(def).reload;
    if (r.type !== 'shell') throw new Error('round by round');
    run(1, { buttons: BUTTON_RELOAD });
    run(r.start + r.each * 2);
    expect(held().mag).toBe(2);
    expect(shots(run(1, { buttons: BUTTON_FIRE }))).toBe(1);
    expect(r.start + r.each * def.magazine + r.end).toBeGreaterThan(100);
  });

  it('swapping weapons stops a reload where it is; sprinting does too', () => {
    const { run, held, a, def, step } = setup('core.rifle', 0);
    const r = gunplayOf(def).reload;
    if (r.type !== 'magazine') throw new Error('magazine');
    run(1, { buttons: BUTTON_RELOAD });
    run(Math.round(r.empty * r.in) + 1);
    // Magazine in, not chambered.
    expect(held().mag).toBe(def.magazine);
    expect(held().unchambered).toBe(true);
    step({ weapon: weaponCode(getWeapon('core.pistol')) });
    expect(a.reloadTicks).toBe(0);
    expect(heldWeapon(a).def.id).toBe('core.pistol');
    const rifle = [...a.weapons.values()].find((w) => w.def.id === 'core.rifle')!;
    expect(rifle.mag).toBe(def.magazine);
    expect(rifle.unchambered).toBe(true);
    // Back to the rifle: the trigger works the bolt (a short reload), then it fires.
    step({ weapon: weaponCode(def) });
    run(def.raiseTicks + 1);
    run(1, { buttons: BUTTON_FIRE });
    expect(a.reloadTicks).toBeGreaterThan(0);
    expect(a.reloadTicks).toBeLessThan(r.empty * 0.5);
    run(a.reloadTicks + 1);
    expect(shots(run(2, { buttons: BUTTON_FIRE }))).toBeGreaterThanOrEqual(1);

    // Sprinting off cancels a reload too.
    const s = setup('core.smg', 5);
    s.run(1, { buttons: BUTTON_RELOAD });
    s.run(3);
    expect(s.a.reloadTicks).toBeGreaterThan(0);
    s.step({ buttons: BUTTON_SPRINT, forward: 1 });
    expect(s.a.reloadTicks).toBe(0);
  });
});

describe('equip times', () => {
  it('sidearms come up fast, heavy weapons slowly (spec §19)', () => {
    const raise = (id: string) => getWeapon(id).raiseTicks;
    expect(raise('core.pistol')).toBeLessThan(raise('core.smg'));
    expect(raise('core.smg')).toBeLessThan(raise('core.rifle'));
    expect(raise('core.rifle')).toBeLessThan(raise('core.lmg'));
    expect(raise('core.rifle')).toBeLessThan(raise('core.rockets'));
    expect(raise('core.pistol')).toBeLessThanOrEqual(10);
    expect(raise('core.revolver')).toBeGreaterThan(raise('core.pistol'));
  });

  it('caught reloading the LMG, swapping to the pistol gets a shot off long before the reload would end', () => {
    const { match, run, step, a } = setup('core.lmg', 0);
    const pistol = getWeapon('core.pistol');
    a.weapons.set(weaponCode(pistol), { def: pistol, mag: pistol.magazine, reserve: 24, alt: 0 });
    run(1, { buttons: BUTTON_RELOAD });
    const left = a.reloadTicks;
    const start = match.tick;
    step({ weapon: weaponCode(pistol) });
    let firedAt = -1;
    for (let i = 0; i < 60 && firedAt < 0; i++) if (shots(step({ buttons: BUTTON_FIRE })) > 0) firedAt = match.tick;
    expect(firedAt - start).toBeLessThanOrEqual(pistol.raiseTicks + 2);
    expect(firedAt - start).toBeLessThan(left / 4);
  });
});
