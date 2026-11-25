import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_FIRE,
  BUTTON_JUMP,
  CORE_BOT_PROFILES,
  CORE_ITEMS,
  DEFAULT_DEATHMATCH_RULES,
  EXTRA_POWERUPS,
  FX_PHANTOM,
  MOON_GRAVITY,
  OVERDRIVE_DAMAGE,
  PHANTOM_REVEAL_TICKS,
  PLAYER,
  POWERUP_OVERDRIVE_BIT,
  POWERUP_RULES,
  RAPID_FIRE,
  RAPID_WITH_DAMAGE,
  REGEN_PER_TICK,
  TICK_RATE,
  VAMPIRE_SHARE,
  fillMagazine,
  getItem,
  getWeapon,
  initPhysics,
  lookAngles,
  rulesFromSetup,
  noPowers,
  parseRuleValue,
  powerMove,
  powersFromWire,
  powersWire,
  rapidSteps,
  ruleSpec,
  type MapDocument,
  type PlayerInput,
} from '../src/index.ts';
import { Match, heldWeapon, initNavigation, pickupNeed, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000, spawnProtection: 0 };
const eye = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z });
const chest = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + 1.0, z: p.z });

function room(pickups: { item: string; at: [number, number, number] }[] = []): MapDocument {
  const map = makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[-3, 0, -3], [3, 0, 3]]);
  return { ...map, entities: [...map.entities, ...pickups.map((p, i) => ({ id: `pickup_${i}`, kind: 'pickup' as const, position: p.at, item: p.item, respawnSeconds: null }))] };
}

function standAt(c: Combatant, p: readonly [number, number, number]): void {
  c.move = { pos: { x: p[0], y: p[1], z: p[2] }, velY: 0, grounded: true };
}

class Driver {
  seq = 0;
  constructor(readonly match: Match) {}
  input(c: Combatant, i: Partial<PlayerInput>): void {
    this.match.queueInputs(c.slot, [{ seq: ++this.seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
  }
  run(n: number, each: () => void = () => {}): void {
    for (let i = 0; i < n; i++) {
      each();
      this.match.step();
    }
  }
  idle(...cs: Combatant[]): () => void {
    return () => cs.forEach((c) => this.input(c, {}));
  }
  shoot(a: Combatant, b: Combatant): void {
    this.input(a, { ...lookAngles(eye(a.move.pos), chest(b.move.pos)), buttons: BUTTON_FIRE });
    this.input(b, {});
  }
}

/** Two players facing each other across the room. */
function duel(pickups: { item: string; at: [number, number, number] }[] = [], r = rules) {
  const match = new Match(room(pickups), r);
  const d = new Driver(match);
  const a = match.addHuman('a')!;
  const b = match.addHuman('b')!;
  standAt(a, [-2, 0, 0]);
  standAt(b, [2, 0, 0]);
  d.run(3, d.idle(a, b));
  return { match, d, a, b };
}

describe('power-ups: data', () => {
  it('has the seven, each a pickup with its own timer, bot value and host switch', () => {
    for (const k of EXTRA_POWERUPS) {
      const item = CORE_ITEMS.find((i) => i.effect.kind === 'powerup' && i.effect.powerup === k);
      expect(item, k).toBeDefined();
      expect(item!.botValue).toBeGreaterThan(0);
      expect(POWERUP_RULES.some((r) => r.kind === k)).toBe(true);
    }
    // Overdrive is the rare one: the slowest respawn of the power-ups.
    const respawn = (id: string) => getItem(id)!.respawnSeconds;
    for (const i of CORE_ITEMS) if (i.effect.kind === 'powerup' && i.id !== 'core.powerup_overdrive') expect(respawn('core.powerup_overdrive')).toBeGreaterThan(i.respawnSeconds);
  });

  it('steps Rapid Fire evenly and travels the timers', () => {
    const steps = (rate: number) => Array.from({ length: 60 }, (_, i) => rapidSteps(60 - i, rate)).reduce((s, n) => s + n, 0);
    expect(steps(RAPID_FIRE)).toBe(Math.round(60 * (RAPID_FIRE - 1)));
    expect(steps(RAPID_WITH_DAMAGE)).toBe(Math.round(60 * (RAPID_WITH_DAMAGE - 1)));
    expect(rapidSteps(0, 2)).toBe(0);
    const p = noPowers();
    expect(powersWire(p)).toBeUndefined();
    p.phantom = 30;
    p.moon = 5;
    expect(powersFromWire(powersWire(p))).toEqual(p);
    expect(powerMove(p).gravity).toBe(MOON_GRAVITY);
  });

  it('keeps a magazine full', () => {
    const w = { def: { magazine: 12, kind: 'hitscan' }, mag: 3, unchambered: true as boolean | undefined, off: { mag: 0 } };
    expect(fillMagazine(w)).toBe(true);
    expect([w.mag, w.unchambered, w.off.mag]).toEqual([12, undefined, 12]);
    expect(fillMagazine(w)).toBe(false);
  });
});

describe('power-ups: in play', () => {
  it('Overdrive: nothing hurts you, and running into an enemy knocks them up and away', () => {
    const { match, d, a, b } = duel();
    b.power.overdrive = 5 * TICK_RATE;
    d.run(1, () => d.shoot(a, b));
    expect(b.health).toBe(PLAYER.maxHealth);
    expect(match.playerSnapshots().find((p) => p.s === b.slot)!.pu & POWERUP_OVERDRIVE_BIT).toBeTruthy();
    // Into a's body: a is thrown and takes the bump's damage, once.
    standAt(b, [-1.4, 0, 0]);
    d.run(3, d.idle(a, b));
    expect(a.health).toBe(PLAYER.maxHealth - OVERDRIVE_DAMAGE);
    expect(Math.abs(a.move.vx ?? 0)).toBeGreaterThan(1);
  });

  it('Regen heals a little every second, up to full', () => {
    const { d, a, b } = duel();
    a.health = 50;
    a.power.regen = 20 * TICK_RATE;
    d.run(TICK_RATE, d.idle(a, b));
    expect(a.health).toBeCloseTo(50 + REGEN_PER_TICK * TICK_RATE, 3);
    d.run(20 * TICK_RATE, d.idle(a, b));
    expect(a.health).toBe(a.maxHealth);
  });

  it('Rapid Fire runs the fire cooldown faster, less so with Double Damage', () => {
    const { d, a, b } = duel();
    a.power.rapid = 10 * TICK_RATE;
    a.fireCooldown = 40;
    d.run(20, d.idle(a, b));
    expect(a.fireCooldown).toBe(40 - 20 - Math.round(20 * (RAPID_FIRE - 1)));
    a.damageTicks = 10 * TICK_RATE;
    a.fireCooldown = 40;
    d.run(20, d.idle(a, b));
    expect(a.fireCooldown).toBe(40 - 20 - Math.round(20 * (RAPID_WITH_DAMAGE - 1)));
  });

  it('Phantom hides you (FX_PHANTOM) until a shot shows you for a moment', () => {
    const { match, d, a, b } = duel();
    a.power.phantom = 10 * TICK_RATE;
    d.run(1, d.idle(a, b));
    const fx = () => match.playerSnapshots().find((p) => p.s === a.slot)!.fx ?? 0;
    expect(fx() & FX_PHANTOM).toBeTruthy();
    // No power-up bit gives it away.
    expect(match.playerSnapshots().find((p) => p.s === a.slot)!.pu).toBe(0);
    d.run(1, () => d.shoot(a, b));
    expect(fx() & FX_PHANTOM).toBeFalsy();
    d.run(PHANTOM_REVEAL_TICKS + 2, d.idle(a, b));
    expect(fx() & FX_PHANTOM).toBeTruthy();
  });

  it('Moon Boots: a higher jump and no fall damage', () => {
    const peak = (moon: boolean) => {
      const { d, a, b } = duel([], { ...rules, fallDamage: true });
      if (moon) a.power.moon = 10 * TICK_RATE;
      let top = 0;
      d.run(1, () => {
        d.input(a, { buttons: BUTTON_JUMP });
        d.input(b, {});
      });
      d.run(3 * TICK_RATE, () => {
        d.idle(a, b)();
        top = Math.max(top, a.move.pos.y);
      });
      return top;
    };
    expect(peak(true)).toBeGreaterThan(peak(false) * 1.5);
    const { d, a, b } = duel([], { ...rules, fallDamage: true });
    a.power.moon = 10 * TICK_RATE;
    a.move = { pos: { x: -2, y: 14, z: 0 }, velY: 0, grounded: false };
    d.run(6 * TICK_RATE, d.idle(a, b));
    expect(a.health).toBe(a.maxHealth);
  });

  it('Vampire: your hits give you back a share of what they did', () => {
    const { d, a, b } = duel();
    a.health = 40;
    a.power.vampire = 10 * TICK_RATE;
    d.run(1, () => d.shoot(a, b));
    const dealt = PLAYER.maxHealth - b.health;
    expect(dealt).toBeGreaterThan(0);
    expect(a.health).toBeCloseTo(40 + dealt * VAMPIRE_SHARE, 3);
  });

  it('Bottomless Mag: firing spends nothing and never reloads', () => {
    const { d, a, b } = duel([{ item: 'core.powerup_bottomless', at: [-2, 0, 0] }]);
    expect(a.power.bottomless).toBeGreaterThan(0);
    const pistol = heldWeapon(a);
    const full = getWeapon('core.pistol').magazine;
    for (let i = 0; i < full + 4; i++) {
      d.run(1, () => d.shoot(a, b));
      d.run(getWeapon('core.pistol').fireIntervalTicks + 1, d.idle(a, b));
    }
    expect(pistol.mag).toBe(full);
    expect(a.reloadTicks).toBe(0);
  });

  it('a power-up the host switched off never lies on the map', () => {
    const off = { ...rules, powerupsOff: ['regen'] };
    const { match, a } = duel([{ item: 'core.powerup_regen', at: [-2, 0, 0] }], off);
    expect(a.power.regen).toBe(0);
    expect(match.snapshot([]).pk).toContain('pickup_0');
    // The host's switch, as a server rule and from Match setup.
    const spec = ruleSpec('regen')!;
    const r = { ...rules };
    spec.write(r, parseRuleValue(spec, 'off').ok ? false : true);
    expect(r.powerupsOff).toEqual(['regen']);
    spec.write(r, true);
    expect(r.powerupsOff).toBeUndefined();
  });
});

describe('power-ups: bots', () => {
  it('want Regen when hurt and every other power-up always', () => {
    const me = { slot: 0, pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, health: 100, armor: 0, alive: true };
    const regen = getItem('core.powerup_regen')!.effect;
    expect(pickupNeed(regen, { ...me, health: 30 }, [], new Map(), 0, null)).toBeGreaterThan(pickupNeed(regen, me, [], new Map(), 0, null));
    expect(pickupNeed(getItem('core.powerup_overdrive')!.effect, me, [], new Map(), 0, null)).toBe(1);
  });

  it('back away from an enemy in Overdrive', () => {
    const match = new Match(room(), rules);
    const d = new Driver(match);
    const h = match.addHuman('h')!;
    const bot = match.addBot('bot', CORE_BOT_PROFILES[0]!)!;
    standAt(h, [-2, 0, 0]);
    standAt(bot, [2, 0, 0]);
    h.power.overdrive = 30 * TICK_RATE;
    let retreated = false;
    d.run(3 * TICK_RATE, () => {
      d.input(h, {});
      retreated ||= bot.bot?.state === 'retreat';
    });
    expect(retreated).toBe(true);
  });
});

// (Match setup's switches reach the match's rules.)
describe('power-ups: Match setup', () => {
  it('turns its switches into MatchRules.powerupsOff', () => {
    const setup = { map: 'test_map', mode: 'core.deathmatch' as const, bots: 1, skill: 'normal' as const, scoreLimit: 20, minutes: 10 };
    expect(rulesFromSetup(setup, room()).rules.powerupsOff).toBeUndefined();
    expect(rulesFromSetup({ ...setup, powerupsOff: ['phantom', 'nonsense'] }, room()).rules.powerupsOff).toEqual(['phantom']);
  });
});
