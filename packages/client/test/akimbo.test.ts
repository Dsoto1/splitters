/**
 * Dual wielding, step 2, on the client (docs/GUNPLAY_SPEC.md, "Akimbo / Dual Wield"): prediction mirrors the match's
 * second gun (its trigger, cooldown, magazine and reloads; the trade; no aiming), the trigger latch treats the second
 * trigger as a trigger, and the input sends it from the aim button while a pair is in hand. The match's own rules are
 * in shared/test/akimbo.test.ts.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_ALT, BUTTON_AUTO_RELOAD, BUTTON_FIRE, BUTTON_RELOAD, BUTTON_SPRINT, BUTTON_ZOOM, DEFAULT_DEATHMATCH_RULES, PhysicsWorld, getWeapon, gunplayOf, initPhysics, setAkimboReady, weaponCode, type MapDocument, type PlayerInput, type PlayerSnapshot, type PrivateState } from '@tiletrigger/shared';
import { Match, initNavigation, type Combatant } from '@tiletrigger/shared/match';
import { makeMap } from '../../shared/test/helpers.ts';
import { LocalPlayer } from '../src/game/prediction.ts';
import { SPRINT_AFTER_FIRE_TICKS, TriggerLatch } from '../src/game/triggerLatch.ts';
import { resetCombatPrefsCache, saveCombatPrefs } from '../src/game/combatPrefs.ts';

beforeAll(async () => {
  await Promise.all([initPhysics(), initNavigation()]);
  setAkimboReady(true);
});
afterAll(() => setAkimboReady());

const EAST = Math.PI / 2;
const PISTOL = 'core.pistol';
const MP = 'core.machine_pistol';
const code = (id: string) => weaponCode(getWeapon(id));

function deck(): MapDocument {
  const tiles = [];
  for (let x = -1; x <= 13; x++) for (let y = -1; y <= 1; y++) tiles.push({ id: `p_${x}_${y}`, tile: 'core.platform', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 0]]);
}

type Inner = { makePair(c: Combatant, w: NonNullable<ReturnType<Combatant['weapons']['get']>>, mag: number): void };

/**
 * The host and the prediction side by side, `lag` ticks each way: someone on the deck holding a pair of `id` (its
 * second gun already up). `step` plays one tick of `sample` and returns what each side fired ('1' the first gun,
 * '2' the second, in order).
 */
function sideBySide(id: string, o: { lag?: number; pair?: boolean; mags?: [number, number]; reserve?: number } = {}) {
  const match = new Match(deck(), { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 });
  const me = match.addHuman('me')!;
  match.step();
  me.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
  const def = getWeapon(id);
  me.weapons.set(weaponCode(def), { def, mag: o.mags?.[0] ?? def.magazine, reserve: o.reserve ?? def.reserveMax, alt: 0 });
  me.current = weaponCode(def);
  me.raiseTicks = 0;
  const w = me.weapons.get(weaponCode(def))!;
  if (o.pair !== false) {
    (match as unknown as Inner).makePair(me, w, o.mags?.[1] ?? def.magazine);
    me.fireCooldown2 = 0;
  }
  match.step();
  const local = new LocalPlayer(new PhysicsWorld(match.geometry));
  const snap = () => match.playerSnapshots().find((p) => p.s === me.slot)!;
  local.reconcile(snap(), me.lastSeq, match.privateState(me.slot));
  // (The first snapshot of a pair starts its raise on the client, as a pickup's would: over for this harness.)
  (local as unknown as { fireCooldown2: number }).fireCooldown2 = 0;
  const lag = o.lag ?? 0;
  const up: { at: number; input: PlayerInput }[] = [];
  const down: { at: number; snap: PlayerSnapshot; ack: number; priv: PrivateState | undefined }[] = [];
  let t = 0;
  const step = (sample: { forward?: number; right?: number; buttons?: number }, weapon = 0): { host: string; predicted: string } => {
    const { input, shot, shot2 } = local.tick({ forward: sample.forward ?? 0, right: sample.right ?? 0, buttons: sample.buttons ?? 0 }, EAST, 0, weapon, 0);
    up.push({ at: t + lag, input });
    while (up.length && up[0]!.at <= t) match.queueInputs(me.slot, [up.shift()!.input]);
    const ev = match.step();
    down.push({ at: t + lag, snap: snap(), ack: me.lastSeq, priv: match.privateState(me.slot) });
    while (down.length && down[0]!.at <= t) {
      const d = down.shift()!;
      local.reconcile(d.snap, d.ack, d.priv);
    }
    t++;
    return {
      host: ev.filter((e) => e.e === 'shot' && e.s === me.slot).map((e) => (e.e === 'shot' && e.off ? '2' : '1')).join(''),
      predicted: `${shot ? '1' : ''}${shot2 ? '2' : ''}`,
    };
  };
  return { match, me, w, local, step };
}

describe('prediction of a pair', () => {
  it('knows the pair from the snapshot (ow, dw), and without one nothing changes', () => {
    const one = sideBySide(PISTOL, { pair: false });
    expect(one.local.paired).toBe(false);
    expect(one.local.offs.size).toBe(0);
    expect(one.local.pairMode()).toBeNull();
    // With one gun the second trigger is no trigger: neither side fires.
    expect(one.step({ buttons: BUTTON_ALT })).toEqual({ host: '', predicted: '' });
    one.match.destroy();
    const two = sideBySide(PISTOL, { mags: [12, 7] });
    expect(two.local.paired).toBe(true);
    expect(two.local.offs.get(code(PISTOL))).toEqual({ mag: 7, unchambered: false, away: false });
    expect(two.local.pairMode()).toBe('pair');
    two.match.destroy();
  });

  it('fires both guns on the host\'s ticks: each trigger its own latch and cooldown, with no latency and with 100 ms each way', () => {
    for (const lag of [0, 6]) {
      for (const id of [PISTOL, MP]) {
        const { match, me, w, local, step } = sideBySide(id, { lag });
        const host: string[] = [];
        const predicted: string[] = [];
        for (let t = 0; t < 90; t++) {
          // The first trigger clicked every third tick, the second every fifth, both held now and then.
          const b = (t % 3 < 2 ? BUTTON_FIRE : 0) | (t % 5 < 2 ? BUTTON_ALT : 0);
          const r = step({ buttons: b });
          predicted.push(r.predicted);
          // What the host fires on a tick is what the prediction fired `lag` ticks before.
          host.push(r.host);
        }
        expect(predicted.join(',').length).toBeGreaterThan(90);
        expect(host.slice(lag), `${id} lag ${lag}`).toEqual(predicted.slice(0, 90 - lag));
        expect(predicted.some((p) => p === '12')).toBe(true);
        expect(predicted.filter((p) => p.includes('2')).length).toBeGreaterThan(3);
        // Without latency the recoil and spray are the host's bit for bit (both guns' rounds in the one pattern).
        if (lag === 0) expect(local.gun).toEqual(me.gun);
        // Let the last inputs land: the magazines agree, both of them.
        for (let t = 0; t < lag + 2; t++) step({});
        expect(local.inventory.get(code(id))![0]).toBe(w.mag);
        expect(local.offs.get(code(id))!.mag).toBe(w.off!.mag);
        match.destroy();
      }
    }
  });

  it('applies the trade as the host does: the same kick and spray after the same rounds, and no sights with the aim button held', () => {
    const { match, me, local, step } = sideBySide(PISTOL);
    for (let t = 0; t < 40; t++) {
      step({ buttons: BUTTON_ZOOM | (t % 12 === 0 ? BUTTON_FIRE | BUTTON_ALT : 0), forward: 1 });
      expect(local.gun).toEqual(me.gun);
      expect(local.gun.ads).toBe(0);
    }
    expect(me.gun.shots + me.gun.spray).toBeGreaterThan(0);
    // Walking with the aim button held was not slowed, on either side: no correction.
    expect(local.corrections).toBe(0);
    expect(local.state.pos.x).toBeCloseTo(me.move.pos.x, 9);
    match.destroy();
  });

  it('the second trigger ends a sprint in the prediction as on the host: no correction, and the shot comes on the same tick', () => {
    const { match, me, local, step } = sideBySide(PISTOL, { lag: 4 });
    const host: string[] = [];
    const predicted: string[] = [];
    for (let t = 0; t < 80; t++) {
      const r = step({ forward: 1, buttons: BUTTON_SPRINT | (t >= 40 && t < 60 ? BUTTON_ALT : 0) });
      host.push(r.host);
      predicted.push(r.predicted);
    }
    expect(predicted.filter((p) => p === '2')).toHaveLength(1);
    expect(host.slice(4)).toEqual(predicted.slice(0, 76));
    expect(predicted.indexOf('2')).toBe(40 + gunplayOf(getWeapon(PISTOL)).handling.sprintExit);
    for (let t = 0; t < 8; t++) step({ forward: 1, buttons: BUTTON_SPRINT });
    // (Had the prediction kept sprinting where the host stopped, every snapshot after would have corrected it.)
    expect(local.corrections).toBe(0);
    expect(me.move.pos.x).toBeGreaterThan(5);
    match.destroy();
  });

  it('reloads as the host does: the emptier gun, then the other, at the pair\'s pace; the other gun fires meanwhile', () => {
    for (const lag of [0, 5]) {
      const { match, me, w, local, step } = sideBySide(PISTOL, { lag, mags: [5, 2], reserve: 40 });
      step({ buttons: BUTTON_RELOAD | BUTTON_AUTO_RELOAD });
      step({ buttons: BUTTON_AUTO_RELOAD });
      // Both are asked for; the hand is on the second gun (the emptier), and the HUD shows its cue only there.
      expect(local.reloadTicks > 0 && local.reloadTicks2 > 0).toBe(true);
      expect(local.pairReloading()).toEqual([false, true]);
      let mismatched = 0;
      let both = 0;
      let firedDuring = '';
      for (let t = 0; t < 220; t++) {
        // One round from the first gun while the second's reload is under way.
        const r = step({ buttons: BUTTON_AUTO_RELOAD | (t === 20 ? BUTTON_FIRE : 0) });
        firedDuring += r.predicted;
        if (lag === 0) {
          // No latency: the prediction is the host's state exactly, every tick.
          if (local.reloadTicks !== me.reloadTicks || local.reloadTicks2 !== me.reloadTicks2) mismatched++;
          if (local.inventory.get(code(PISTOL))![0] !== w.mag || local.offs.get(code(PISTOL))!.mag !== w.off!.mag) mismatched++;
        }
        if (local.reloadTicks2 > 0 && local.reloadTicks > 0) both++;
      }
      expect(mismatched, `lag ${lag}`).toBe(0);
      expect(firedDuring).toBe('1');
      // The first gun gave up its turn by firing; the second is full, the first has what it had less a round, then
      // (auto-reload is off for a gun with rounds) stays so.
      expect([w.mag, w.off!.mag]).toEqual([4, 12]);
      expect(local.inventory.get(code(PISTOL))![0]).toBe(4);
      expect(local.offs.get(code(PISTOL))!.mag).toBe(12);
      expect(local.inventory.get(code(PISTOL))![1]).toBe(w.reserve);
      expect([local.reloadTicks, local.reloadTicks2, local.reload, local.reload2]).toEqual([0, 0, null, null]);
      expect(both).toBeGreaterThan(5);
      match.destroy();
    }
  });

  it('a full staggered reload under latency ends where the host ends, the HUD\'s two counts never running backwards', () => {
    const { match, w, local, step } = sideBySide(PISTOL, { lag: 6, mags: [3, 1], reserve: 40 });
    step({ buttons: BUTTON_RELOAD });
    let last2 = local.offs.get(code(PISTOL))!.mag;
    let back = 0;
    for (let t = 0; t < 200; t++) {
      step({});
      const m2 = local.offs.get(code(PISTOL))!.mag;
      // (A tactical reload takes the magazine out: down to the chambered round once, then up to full once.)
      if (m2 < last2 && m2 !== 1) back++;
      last2 = m2;
    }
    expect(back).toBe(0);
    expect([w.mag, w.off!.mag]).toEqual([12, 12]);
    expect([local.inventory.get(code(PISTOL))![0], local.offs.get(code(PISTOL))!.mag, local.inventory.get(code(PISTOL))![1]]).toEqual([12, 12, w.reserve]);
    match.destroy();
  });

  it('the fire-mode key puts the second gun away and back: sent with every input, applied on both sides, sights again with one gun', () => {
    const { match, me, w, local, step } = sideBySide(PISTOL, { lag: 3 });
    expect(local.cycleFireMode()).not.toBeNull();
    expect(local.pairMode()).toBe('single');
    step({});
    expect(local.paired).toBe(false);
    for (let t = 0; t < 20; t++) step({ buttons: BUTTON_ZOOM });
    expect(w.off).toEqual({ mag: 12, away: true });
    expect(local.gun.ads).toBe(1);
    expect(me.gun.ads).toBe(1);
    // The second trigger is dead on both sides; the gun is today's pistol.
    expect(step({ buttons: BUTTON_ALT }).predicted).toBe('');
    // A snapshot from before the key reached the host does not bring the pair back.
    expect(local.paired).toBe(false);
    local.cycleFireMode();
    expect(local.pairMode()).toBe('pair');
    const fired: string[] = [];
    const host: string[] = [];
    for (let t = 0; t < 30; t++) {
      const r = step({ buttons: t % 2 ? BUTTON_ALT : 0 });
      fired.push(r.predicted);
      host.push(r.host);
    }
    expect(w.off).toEqual({ mag: 12 - host.filter((h) => h === '2').length });
    // The second gun came up after its raise on both sides, on the same tick.
    expect(fired.indexOf('2')).toBeGreaterThanOrEqual(9);
    expect(host.slice(3)).toEqual(fired.slice(0, 27));
    match.destroy();
  });

  it('switching away and back raises the pair at the pair\'s pace on both sides (a replayed switch included)', () => {
    const { match, me, local, step } = sideBySide(PISTOL, { lag: 5 });
    const knife = [...me.weapons.keys()].find((c) => c !== code(PISTOL))!;
    step({}, knife);
    for (let t = 0; t < 12; t++) step({}, knife);
    step({}, code(PISTOL));
    expect(local.raiseTicks).toBe(Math.round(getWeapon(PISTOL).raiseTicks * 1.25) - 1);
    for (let t = 0; t < 4; t++) step({}, code(PISTOL));
    // Mid-raise, with the switch still unacknowledged, the replay keeps the pair's raise.
    expect(local.raiseTicks).toBe(Math.round(getWeapon(PISTOL).raiseTicks * 1.25) - 5);
    for (let t = 0; t < 16; t++) step({}, code(PISTOL));
    expect([local.raiseTicks, me.raiseTicks]).toEqual([0, 0]);
    match.destroy();
  });

  it('a second-gun shot the host never fired is taken back: the magazine is the host\'s again after the snapshot', () => {
    const { match, me, w, local, step } = sideBySide(PISTOL, { lag: 4, mags: [12, 5] });
    // The host's second gun is not ready (say its raise was restarted there): the prediction doesn't know.
    me.fireCooldown2 = 30;
    const r = step({ buttons: BUTTON_ALT });
    expect(r.predicted).toBe('2');
    expect(local.offs.get(code(PISTOL))!.mag).toBe(4);
    let hostFired = '';
    for (let t = 0; t < 12; t++) hostFired += step({}).host;
    expect(hostFired).toBe('');
    expect(w.off!.mag).toBe(5);
    expect(local.offs.get(code(PISTOL))!.mag).toBe(5);
    // And the other way: a round the host fired that the prediction didn't shows after the snapshot.
    w.off!.mag = 3;
    for (let t = 0; t < 6; t++) step({});
    expect(local.offs.get(code(PISTOL))!.mag).toBe(3);
    match.destroy();
  });

  it('a pair made by a pickup shows up with its second gun coming up, as on the host', () => {
    const { match, me, w, local, step } = sideBySide(MP, { pair: false, lag: 2 });
    expect(local.paired).toBe(false);
    (match as unknown as Inner).makePair(me, w, 24);
    const fired: string[] = [];
    const host: string[] = [];
    for (let t = 0; t < 30; t++) {
      const r = step({ buttons: BUTTON_ALT | BUTTON_FIRE });
      fired.push(r.predicted);
      host.push(r.host);
    }
    expect(local.paired).toBe(true);
    // The first gun never stopped; the second joined after its raise (15 ticks on the host).
    expect(host.findIndex((h) => h.includes('2'))).toBeGreaterThanOrEqual(13);
    expect(fired.findIndex((h) => h.includes('2'))).toBeGreaterThanOrEqual(10);
    expect(fired.filter((h) => h.includes('1')).length).toBe(10);
    match.destroy();
  });
});

describe('the trigger latch and the second trigger', () => {
  it('a pull of the second trigger while the pair comes up is kept until it is up, like the first trigger\'s, each by itself', () => {
    const latch = new TriggerLatch();
    // Raising: a one-tick tap of the second trigger, then nothing.
    expect(latch.apply(BUTTON_ALT, true, false, 10, true) & BUTTON_ALT).toBeTruthy();
    expect(latch.apply(0, true, false, 10, true) & BUTTON_ALT).toBeTruthy();
    expect(latch.apply(0, true, false, 10, true) & BUTTON_FIRE).toBeFalsy();
    // Up: the kept pull goes out this tick, then it is let go.
    expect(latch.apply(0, false, false, 10, true) & BUTTON_ALT).toBeTruthy();
    expect(latch.apply(0, false, false, 10, true) & BUTTON_ALT).toBeFalsy();
    // Both tapped while raising: both kept.
    latch.reset();
    latch.apply(BUTTON_ALT | BUTTON_FIRE, true, false, 10, true);
    expect(latch.apply(0, false, false, 10, true) & (BUTTON_ALT | BUTTON_FIRE)).toBe(BUTTON_ALT | BUTTON_FIRE);
    // Out of a sprint too.
    latch.reset();
    expect(latch.apply(BUTTON_ALT | BUTTON_SPRINT, false, true, 10, true) & BUTTON_ALT).toBeTruthy();
    expect(latch.apply(BUTTON_SPRINT, true, false, 10, true) & BUTTON_ALT).toBeTruthy();
    expect(latch.apply(BUTTON_SPRINT, false, false, 10, true) & BUTTON_ALT).toBeTruthy();
    expect(latch.apply(BUTTON_SPRINT, false, false, 10, true) & BUTTON_ALT).toBeFalsy();
  });

  it('the second trigger keeps a held sprint off between taps, as the first does', () => {
    const latch = new TriggerLatch();
    expect(latch.apply(BUTTON_ALT | BUTTON_SPRINT, false, false, 10, true) & BUTTON_SPRINT).toBeFalsy();
    for (let t = 0; t < SPRINT_AFTER_FIRE_TICKS - 1; t++) expect(latch.apply(BUTTON_SPRINT, false, false, 10, true) & BUTTON_SPRINT).toBeFalsy();
    expect(latch.apply(BUTTON_SPRINT, false, false, 10, true) & BUTTON_SPRINT).toBeTruthy();
  });

  it('without a pair nothing changes: a second trigger is never kept and never touches the sprint', () => {
    const latch = new TriggerLatch();
    expect(latch.apply(BUTTON_ALT, true, false, 10)).toBe(BUTTON_ALT);
    expect(latch.apply(0, true, false, 10)).toBe(0);
    expect(latch.apply(0, false, false, 10)).toBe(0);
    expect(latch.apply(BUTTON_ALT | BUTTON_SPRINT, false, false, 10)).toBe(BUTTON_ALT | BUTTON_SPRINT);
    // A pull kept for a pair is dropped when the pair is gone (a swap).
    latch.apply(BUTTON_ALT, true, false, 10, true);
    expect(latch.apply(0, true, false, 10, false)).toBe(0);
    expect(latch.apply(0, false, false, 10, true)).toBe(0);
  });

  it('through the latch, a tap of the second trigger on a sprint fires once the pair is up: host and prediction on the same tick', () => {
    const { match, local, step } = sideBySide(PISTOL, { lag: 2 });
    const latch = new TriggerLatch();
    const host: number[] = [];
    const predicted: number[] = [];
    for (let t = 0; t < 70; t++) {
      // A sprint, then a two-tick click of the second trigger (shorter than the pistol's 3-tick sprint exit).
      const raw = BUTTON_SPRINT | (t === 40 || t === 41 ? BUTTON_ALT : 0);
      const b = latch.apply(raw, local.raiseTicks > 0, !!local.state.sprint, 10, local.paired);
      const r = step({ forward: 1, buttons: b });
      if (r.host) host.push(t);
      if (r.predicted) predicted.push(t);
    }
    // (The host hears of it two ticks later.)
    expect(predicted).toEqual([40 + gunplayOf(getWeapon(PISTOL)).handling.sprintExit]);
    expect(host).toEqual(predicted.map((t) => t + 2));
    match.destroy();
  });
});

describe('input with a pair in hand', () => {
  const g = globalThis as unknown as { window: EventTarget };
  const key = (type: 'keydown' | 'keyup', k: string) => g.window.dispatchEvent(Object.assign(new Event(type), { code: k, repeat: false, metaKey: false, ctrlKey: false }));
  const mouse = (type: 'pointerdown' | 'pointerup', buttons: number) => g.window.dispatchEvent(Object.assign(new Event(type), { buttons, pointerType: 'mouse' }));
  beforeAll(() => {
    // InputState listens on window and document, and the combat options are kept in localStorage.
    const env = globalThis as unknown as Record<string, unknown>;
    env.window ??= new EventTarget();
    env.document ??= Object.assign(new EventTarget(), { pointerLockElement: null });
    const store = new Map<string, string>();
    env.localStorage ??= { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  });
  async function make() {
    const { InputState } = await import('../src/game/input.ts');
    const input = new InputState(new EventTarget() as unknown as HTMLCanvasElement);
    input.wheelKey = 'KeyQ';
    input.setTouchEngaged(true);
    return input;
  }
  afterEach(() => {
    saveCombatPrefs({ aim: 'hold' });
    resetCombatPrefsCache();
  });

  it('the aim button (right mouse, X, touch\'s Aim) is the second trigger, not the aim: BUTTON_ALT, never BUTTON_ZOOM, and nothing zooms', async () => {
    const input = await make();
    mouse('pointerdown', 2);
    expect(input.sample().buttons & (BUTTON_ZOOM | BUTTON_ALT)).toBe(BUTTON_ZOOM);
    expect(input.zooming).toBe(true);
    // The session says a pair is in hand (it sets both).
    input.pairTrigger = input.altTrigger = true;
    expect(input.sample().buttons & (BUTTON_ZOOM | BUTTON_ALT)).toBe(BUTTON_ALT);
    expect(input.zooming).toBe(false);
    mouse('pointerup', 0);
    expect(input.sample().buttons & (BUTTON_ZOOM | BUTTON_ALT)).toBe(0);
    key('keydown', 'KeyX');
    expect(input.sample().buttons & (BUTTON_ZOOM | BUTTON_ALT)).toBe(BUTTON_ALT);
    key('keyup', 'KeyX');
    // The first trigger is its own.
    mouse('pointerdown', 1);
    expect(input.sample().buttons & (BUTTON_FIRE | BUTTON_ALT)).toBe(BUTTON_FIRE);
    mouse('pointerdown', 3);
    expect(input.sample().buttons & (BUTTON_FIRE | BUTTON_ALT)).toBe(BUTTON_FIRE | BUTTON_ALT);
    mouse('pointerup', 0);
    input.dispose();
  });

  it('Aim: Toggle is a hold while paired (a trigger is never latched), and is a toggle again with one gun', async () => {
    saveCombatPrefs({ aim: 'toggle' });
    resetCombatPrefsCache();
    const input = await make();
    // One gun, Toggle: a press latches the aim.
    mouse('pointerdown', 2);
    mouse('pointerup', 0);
    expect(input.sample().buttons & BUTTON_ZOOM).toBe(BUTTON_ZOOM);
    input.cancelAim();
    input.pairTrigger = input.altTrigger = true;
    input.sample();
    mouse('pointerdown', 2);
    expect(input.sample().buttons & BUTTON_ALT).toBe(BUTTON_ALT);
    mouse('pointerup', 0);
    // Let go: no trigger, nothing latched.
    expect(input.sample().buttons & (BUTTON_ALT | BUTTON_ZOOM)).toBe(0);
    expect(input.sample().buttons & (BUTTON_ALT | BUTTON_ZOOM)).toBe(0);
    input.dispose();
  });

  it('a click of the second trigger between two ticks is not lost: it goes out with the next input, once', async () => {
    const input = await make();
    input.pairTrigger = input.altTrigger = true;
    input.sample();
    mouse('pointerdown', 2);
    mouse('pointerup', 0);
    expect(input.sample().buttons & BUTTON_ALT).toBe(BUTTON_ALT);
    expect(input.sample().buttons & BUTTON_ALT).toBe(0);
    // With one gun a press between ticks is not a trigger pull (nor an aim, held).
    input.pairTrigger = input.altTrigger = false;
    mouse('pointerdown', 2);
    mouse('pointerup', 0);
    expect(input.sample().buttons & (BUTTON_ALT | BUTTON_ZOOM)).toBe(0);
    input.dispose();
  });

  it('touch: the Fire button pulls both triggers while paired, the first only with one gun', async () => {
    const input = await make();
    input.virtualKey('KeyF', true);
    expect(input.sample().buttons & (BUTTON_FIRE | BUTTON_ALT)).toBe(BUTTON_FIRE);
    input.pairTrigger = input.altTrigger = true;
    expect(input.sample().buttons & (BUTTON_FIRE | BUTTON_ALT)).toBe(BUTTON_FIRE | BUTTON_ALT);
    input.virtualKey('KeyF', false);
    expect(input.sample().buttons & (BUTTON_FIRE | BUTTON_ALT)).toBe(0);
    // The Aim button is the second trigger by itself.
    input.virtualKey('KeyX', true);
    expect(input.sample().buttons & (BUTTON_FIRE | BUTTON_ALT)).toBe(BUTTON_ALT);
    input.virtualKey('KeyX', false);
    input.dispose();
  });

  it('the weapon wheel still works: open, neither trigger goes out; shut, they do again', async () => {
    const input = await make();
    input.pairTrigger = input.altTrigger = true;
    mouse('pointerdown', 3);
    expect(input.sample().buttons & (BUTTON_FIRE | BUTTON_ALT)).toBe(BUTTON_FIRE | BUTTON_ALT);
    mouse('pointerup', 0);
    input.openWheel('key');
    expect(input.wheelOpen).toBe(true);
    mouse('pointerdown', 2);
    expect(input.sample().buttons & (BUTTON_FIRE | BUTTON_ALT | BUTTON_ZOOM)).toBe(0);
    mouse('pointerup', 0);
    input.closeWheel(false);
    expect(input.wheelOpen).toBe(false);
    input.sample();
    mouse('pointerdown', 2);
    expect(input.sample().buttons & BUTTON_ALT).toBe(BUTTON_ALT);
    mouse('pointerup', 0);
    input.dispose();
  });
});
