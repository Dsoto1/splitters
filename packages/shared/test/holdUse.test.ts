import { beforeAll, describe, expect, it } from 'vitest';
import {
  BOT_DIFFICULTIES,
  BUTTON_FIRE,
  BUTTON_USE,
  BUTTON_USE_HOLD,
  CORE_BOT_PROFILES,
  DEFAULT_DEATHMATCH_RULES,
  HOLD_HEAL_SCALE,
  HOLD_SECONDS,
  TICK_RATE,
  getWeapon,
  holdProgress,
  holdTicks,
  initPhysics,
  isHoldHealTool,
  startHold,
  stepHold,
  weaponCode,
  type GameEvent,
  type MapDocument,
  type PlayerInput,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };

describe('hold to use (sim/holdUse.ts): the state', () => {
  const ok = { held: true, inReach: true, fired: false, weapon: 3 };
  it('runs its time, then is done', () => {
    const h = startHold('resupply', 100, 3, { box: 1 });
    expect(h.ticks).toBe(Math.round(HOLD_SECONDS.resupply * TICK_RATE));
    expect(stepHold(h, 100 + h.ticks - 1, ok)).toBeNull();
    expect(holdProgress(h, 100 + h.ticks / 2)).toBeCloseTo(0.5);
    expect(stepHold(h, 100 + h.ticks, ok)).toBe('done');
  });
  it('a heal takes longer than a resupply', () => {
    expect(holdTicks('heal')).toBeGreaterThan(holdTicks('resupply'));
  });
  it('stops short on each cause, in the order the player reads them', () => {
    const h = startHold('resupply', 100, 3, { box: 1 });
    expect(stepHold(h, 110, { ...ok, held: false })).toBe('released');
    expect(stepHold(h, 110, { ...ok, inReach: false })).toBe('moved');
    expect(stepHold(h, 110, { ...ok, fired: true })).toBe('fired');
    expect(stepHold(h, 110, { ...ok, weapon: 4 })).toBe('swapped');
    expect(stepHold(h, 110, { ...ok, hurtAt: 105 })).toBe('hurt');
    // Hurt before it began doesn't count.
    expect(stepHold(h, 110, { ...ok, hurtAt: 99 })).toBeNull();
    // A heal's trigger is the hold: "fired" is not a cancel for it.
    expect(stepHold(startHold('heal', 100, 3, { target: 0 }), 110, { ...ok, fired: true })).toBeNull();
  });
  it('the Medkit is held, the Medi-Beam stays a beam', () => {
    expect(isHoldHealTool(getWeapon('core.medkit'))).toBe(true);
    expect(isHoldHealTool(getWeapon('core.medi_beam'))).toBe(false);
    expect(isHoldHealTool(getWeapon('core.rifle'))).toBe(false);
  });
});

/** An open yard 40 × 32 m with an Ammo Box placed at (10, 0, 10). */
function yard(): MapDocument {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 4; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 0]]);
  return { ...map, entities: [...map.entities, { id: 'ammo_1', kind: 'pickup' as const, item: 'core.ammo', position: [10, 0, 10] as [number, number, number], respawnSeconds: 30 }] };
}

class Driver {
  seq = new Map<number, number>();
  constructor(readonly match: Match) {}
  input(c: Combatant, i: Partial<PlayerInput>): void {
    const seq = (this.seq.get(c.slot) ?? 0) + 1;
    this.seq.set(c.slot, seq);
    this.match.queueInputs(c.slot, [{ seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
  }
  run(n: number, each: () => void = () => {}): GameEvent[] {
    const out: GameEvent[] = [];
    for (let i = 0; i < n; i++) {
      each();
      out.push(...this.match.step());
    }
    return out;
  }
}

const place = (c: Combatant, x: number, z: number) => (c.move = { pos: { x, y: 0, z }, velY: 0, grounded: true });
const empty = (c: Combatant) => {
  for (const w of c.weapons.values()) w.reserve = 0;
  c.throwable = null;
};
const of = <K extends GameEvent['e']>(ev: GameEvent[], e: K) => ev.filter((x): x is Extract<GameEvent, { e: K }> => x.e === e);

function atTheBox(): { match: Match; d: Driver; a: Combatant } {
  const match = new Match(yard(), rules);
  const d = new Driver(match);
  const a = match.addHuman('a')!;
  d.run(2);
  place(a, 11.2, 10);
  empty(a);
  return { match, d, a };
}

describe('hold to use in a match', () => {
  it('a resupply takes the hold: nothing at the press, the stock once it has run, progress in the private state', () => {
    const { match, d, a } = atTheBox();
    const first = d.run(1, () => d.input(a, { buttons: BUTTON_USE | BUTTON_USE_HOLD }));
    expect(of(first, 'resupply')).toEqual([]);
    expect(a.hold?.kind).toBe('resupply');
    expect([...a.weapons.values()].some((w) => w.def.reserveMax > 0 && w.reserve === 0)).toBe(true);
    const mid = d.run(holdTicks('resupply') - 2, () => d.input(a, { buttons: BUTTON_USE_HOLD }));
    expect(of(mid, 'resupply')).toEqual([]);
    expect(match.privateState(a.slot)?.hu).toEqual([0, holdTicks('resupply') - 2, holdTicks('resupply')]);
    const end = d.run(2, () => d.input(a, { buttons: BUTTON_USE_HOLD }));
    expect(of(end, 'resupply')).toMatchObject([{ ok: true }]);
    expect(a.hold).toBeUndefined();
    expect(match.privateState(a.slot)?.hu).toBeUndefined();
    expect([...a.weapons.values()].filter((w) => w.def.reserveMax > 0).every((w) => w.reserve === w.def.reserveMax)).toBe(true);
  });

  it('nothing to give: the press says so at once and no hold starts', () => {
    const { d, a } = atTheBox();
    for (const w of a.weapons.values()) w.reserve = w.def.reserveMax;
    a.throwable = { kind: 'frag', count: 9 };
    const ev = d.run(1, () => d.input(a, { buttons: BUTTON_USE | BUTTON_USE_HOLD }));
    expect(of(ev, 'resupply')).toMatchObject([{ ok: false }]);
    expect(a.hold).toBeUndefined();
  });

  const cancelled = (setup: (d: Driver, a: Combatant, match: Match) => GameEvent[]) => {
    const { match, d, a } = atTheBox();
    d.run(1, () => d.input(a, { buttons: BUTTON_USE | BUTTON_USE_HOLD }));
    d.run(20, () => d.input(a, { buttons: BUTTON_USE_HOLD }));
    const ev = setup(d, a, match);
    // And nothing given after, however long E stays down.
    ev.push(...d.run(holdTicks('resupply'), () => d.input(a, { buttons: BUTTON_USE_HOLD })));
    expect(of(ev, 'resupply').filter((e) => e.ok)).toEqual([]);
    expect(a.hold).toBeUndefined();
    return of(ev, 'hold');
  };

  it('letting go of E cancels it', () => {
    expect(cancelled((d, a) => d.run(1, () => d.input(a, {})))).toEqual([{ e: 'hold', s: 0, k: 0, x: 'released' }]);
  });
  it('walking out of reach cancels it', () => {
    expect(cancelled((d, a) => (place(a, 14, 10), d.run(1, () => d.input(a, { buttons: BUTTON_USE_HOLD })))).map((e) => e.x)).toEqual(['moved']);
  });
  it('firing cancels it', () => {
    expect(cancelled((d, a) => d.run(1, () => d.input(a, { buttons: BUTTON_USE_HOLD | BUTTON_FIRE }))).map((e) => e.x)).toEqual(['fired']);
  });
  it('swapping weapons cancels it', () => {
    expect(
      cancelled((d, a) => {
        a.current = [...a.weapons.keys()].find((k) => k !== a.current) ?? a.current + 1;
        return d.run(1, () => d.input(a, { buttons: BUTTON_USE_HOLD }));
      }).map((e) => e.x),
    ).toEqual(['swapped']);
  });
  it('taking damage cancels it', () => {
    expect(
      cancelled((d, a) => {
        a.hurtAt = (d.match as unknown as { tick: number }).tick;
        return d.run(1, () => d.input(a, { buttons: BUTTON_USE_HOLD }));
      }).map((e) => e.x),
    ).toEqual(['hurt']);
  });

  it('the Medkit heals on a held trigger: nothing at the click, twice its heal once the hold has run', () => {
    const match = new Match(yard(), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    d.run(2);
    place(a, 3, 3);
    const def = getWeapon('core.medkit');
    a.weapons.set(weaponCode(def), { def, mag: 0, reserve: 0, alt: 0 });
    a.current = weaponCode(def);
    a.raiseTicks = 0;
    a.fireCooldown = 0;
    a.health = 40;
    d.run(1, () => d.input(a, { buttons: BUTTON_FIRE }));
    expect(a.hold?.kind).toBe('heal');
    expect(a.health).toBe(40);
    const ev = d.run(holdTicks('heal'), () => d.input(a, { buttons: BUTTON_FIRE }));
    expect(of(ev, 'heal')).toEqual([{ e: 'heal', s: a.slot, t: a.slot, n: def.heal! * HOLD_HEAL_SCALE }]);
    expect(a.health).toBe(40 + def.heal! * HOLD_HEAL_SCALE);
    // Let go early: nothing.
    a.health = 40;
    d.run(1, () => d.input(a, {}));
    d.run(def.fireIntervalTicks, () => d.input(a, {}));
    d.run(1, () => d.input(a, { buttons: BUTTON_FIRE }));
    const early = d.run(30, () => d.input(a, { buttons: BUTTON_FIRE }));
    early.push(...d.run(1, () => d.input(a, {})));
    expect(of(early, 'heal')).toEqual([]);
    expect(of(early, 'hold').map((e) => e.x)).toEqual(['released']);
    expect(a.health).toBe(40);
  });

  it('a bot short of ammo waits the hold out beside the box, standing still, then has its stock', () => {
    const match = new Match(yard(), rules);
    const bot = match.addBot('bot', { ...CORE_BOT_PROFILES[3]!, itemGreed: 100 }, BOT_DIFFICULTIES.normal)!;
    match.step();
    place(bot, 4, 4);
    let started: number | null = null;
    let at: { x: number; z: number } | null = null;
    let got: GameEvent | undefined;
    let moved = 0;
    const cancels: GameEvent[] = [];
    for (let t = 0; t < 20 * TICK_RATE && !got; t++) {
      if (started === null) for (const w of bot.weapons.values()) w.reserve = 0;
      const ev = match.step();
      cancels.push(...of(ev, 'hold'));
      got = ev.find((e) => e.e === 'resupply' && e.s === bot.slot && e.ok);
      if (bot.hold && started === null) {
        started = t;
        at = { x: bot.move.pos.x, z: bot.move.pos.z };
      }
      if (bot.hold && at) moved = Math.max(moved, Math.hypot(bot.move.pos.x - at.x, bot.move.pos.z - at.z));
    }
    expect(got).toBeDefined();
    expect(cancels).toEqual([]);
    expect(moved).toBeLessThan(0.3);
  });
});
