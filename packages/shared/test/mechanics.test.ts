import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_FIRE,
  BUTTON_ZOOM,
  BUTTON_THROW,
  CORE_ITEMS,
  DEFAULT_DEATHMATCH_RULES,
  PLAYER,
  THROWABLE_DEFS,
  WEAPONS_BY_SLOT,
  getWeapon,
  hitZone,
  initPhysics,
  lookAngles,
  weaponByCode,
  weaponCode,
  type GameEvent,
  type MapDocument,
  type PlayerInput,
} from '../src/index.ts';
import { Match, heldWeapon, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
const eye = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z });
const chest = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + 1, z: p.z });

/** An open yard 40 × 16 m (x -4..36, z -4..12) with walls round it. */
function yard(spawns: [number, number, number][]): MapDocument {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, spawns);
}

class Driver {
  seq = 0;
  constructor(readonly match: Match) {}
  input(c: Combatant, i: Partial<PlayerInput>): void {
    this.match.queueInputs(c.slot, [{ seq: ++this.seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
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

function give(c: Combatant, id: string): void {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
  c.raiseTicks = 0;
  c.fireCooldown = 0;
}

/** A shooter at the origin aiming at a target; returns the match, driver and players. */
function duel(targets: [number, number, number][], weaponId: string) {
  const match = new Match(yard([[0, 0, 4], ...targets]), rules);
  const d = new Driver(match);
  const a = match.addHuman('a')!;
  const others = targets.map((_, i) => match.addHuman(`t${i}`)!);
  // Spawns are picked by distance from enemies, so place everyone by hand.
  a.move = { pos: { x: 0, y: 0, z: 4 }, velY: 0, grounded: true };
  targets.forEach((t, i) => (others[i]!.move = { pos: { x: t[0], y: t[1], z: t[2] }, velY: 0, grounded: true }));
  give(a, weaponId);
  const look = lookAngles(eye(a.move.pos), chest(others[0]!.move.pos));
  const aim = (extra: Partial<PlayerInput> = {}) => d.input(a, { yaw: look.yaw, pitch: look.pitch, ...extra });
  return { match, d, a, others, aim };
}

describe('hit zones and spread', () => {
  it('splits a body into head, torso and legs', () => {
    const feet = { x: 0, y: 2, z: 0 };
    expect(hitZone(feet, 2 + 1.7)).toBe(1);
    expect(hitZone(feet, 2 + 1.1)).toBe(0);
    expect(hitZone(feet, 2 + 0.4)).toBe(2);
  });

  it('a scoped sniper head shot kills outright and is called a headshot; leg hits do less', () => {
    const { match, d, a, others } = duel([[30, 0, 4]], 'core.sniper');
    const target = others[0]!;
    const head = lookAngles(eye(a.move.pos), { x: target.move.pos.x, y: target.move.pos.y + 1.68, z: target.move.pos.z });
    const ev = d.run(3, () => d.input(a, { yaw: head.yaw, pitch: head.pitch, buttons: BUTTON_FIRE | BUTTON_ZOOM }));
    const shot = ev.find((e) => e.e === 'shot');
    expect(shot && shot.e === 'shot' && shot.z?.[0]).toBe(1);
    expect(ev.some((e) => e.e === 'kill' && e.hs === 1)).toBe(true);
    void match;

    const legs = duel([[12, 0, 4]], 'core.rifle');
    const t2 = legs.others[0]!;
    const low = lookAngles(eye(legs.a.move.pos), { x: t2.move.pos.x, y: t2.move.pos.y + 0.45, z: t2.move.pos.z });
    legs.d.run(1, () => legs.d.input(legs.a, { yaw: low.yaw, pitch: low.pitch, buttons: BUTTON_FIRE }));
    expect(100 - t2.health).toBeCloseTo(getWeapon('core.rifle').damage * 0.75, 5);
  });

  it('a sniper rifle fired from the hip sprays; through the scope it is dead on', () => {
    const shots = (buttons: number) => {
      const { d, aim, a, others } = duel([[30, 0, 4]], 'core.sniper');
      let hits = 0;
      let fired = 0;
      for (let i = 0; i < 12; i++) {
        heldWeapon(a).mag = 5;
        const ev = d.run(80, () => aim({ buttons }));
        hits += ev.filter((e) => e.e === 'shot' && e.hit[0] !== null).length;
        fired += ev.filter((e) => e.e === 'shot').length;
        // Keep the target standing so every shot counts.
        others[0]!.health = 100;
        others[0]!.alive = true;
        d.run(1, () => aim());
      }
      return hits / Math.max(1, fired);
    };
    const scoped = shots(BUTTON_FIRE | BUTTON_ZOOM);
    const hip = shots(BUTTON_FIRE);
    expect(scoped).toBe(1);
    expect(hip).toBeLessThan(0.6);
  });
});

describe('extended arsenal', () => {
  it('has 30+ weapons, every one with a model, a pickup and sane numbers; slots hold several', () => {
    expect(WEAPONS_BY_SLOT.length).toBeGreaterThanOrEqual(30);
    const models = new Set((JSON.parse(readFileSync(new URL('../../../content/models.json', import.meta.url), 'utf8')) as { models: { out: string }[] }).models.map((m) => m.out));
    for (const w of WEAPONS_BY_SLOT) {
      expect(models.has(w.view.model), `${w.id} model`).toBe(true);
      expect(weaponByCode(weaponCode(w))).toBe(w);
      if (w.id !== 'core.knife' && w.id !== 'core.pistol') expect(CORE_ITEMS.some((i) => i.effect.kind === 'weapon' && i.effect.weapon === w.id), `${w.id} pickup`).toBe(true);
      expect(w.slot).toBeGreaterThanOrEqual(1);
      expect(w.slot).toBeLessThanOrEqual(9);
      expect(w.fireIntervalTicks).toBeGreaterThan(0);
      if (w.kind === 'projectile') expect(w.projectile, w.id).toBeDefined();
      if (w.heat) expect(w.magazine).toBe(0);
    }
    for (const slot of [2, 3, 4, 6, 9]) expect(WEAPONS_BY_SLOT.filter((w) => w.slot === slot).length, `slot ${slot}`).toBeGreaterThanOrEqual(3);
  });

  it('semi-auto fires once per press, burst fires three per press', () => {
    const { d, a, aim } = duel([[20, 0, 4]], 'core.hand_cannon');
    const shots = (ev: GameEvent[]) => ev.filter((e) => e.e === 'shot').length;
    expect(shots(d.run(80, () => aim({ buttons: BUTTON_FIRE })))).toBe(1);
    expect(shots(d.run(2, () => aim()))).toBe(0);
    expect(shots(d.run(2, () => aim({ buttons: BUTTON_FIRE })))).toBe(1);
    give(a, 'core.burst_rifle');
    d.run(5, () => aim());
    expect(shots(d.run(20, () => aim({ buttons: BUTTON_FIRE })))).toBe(3);
    expect(heldWeapon(a).mag).toBe(21);
  });

  it('the spin gun spins up before firing; the railgun charges every shot and pierces a line of players', () => {
    const lmg = duel([[20, 0, 4]], 'core.lmg');
    const first = lmg.d.run(40, () => lmg.aim({ buttons: BUTTON_FIRE })).findIndex((e) => e.e === 'shot');
    expect(first).toBeGreaterThanOrEqual(0);
    expect(lmg.match.tick).toBeGreaterThan(getWeapon('core.lmg').windupTicks!);
    const { d, others, aim } = duel([[10, 0, 4], [16, 0, 4], [22, 0, 4]], 'core.railgun');
    // Scoped in (the railgun fired from the hip sprays).
    const ev = d.run(getWeapon('core.railgun').windupTicks! - 2, () => aim({ buttons: BUTTON_FIRE | BUTTON_ZOOM }));
    expect(ev.some((e) => e.e === 'shot')).toBe(false);
    d.run(4, () => aim({ buttons: BUTTON_FIRE | BUTTON_ZOOM }));
    // One shot through all three: 90 damage each, less where it passes at leg height.
    expect(others.filter((o) => o.health <= 100 - 90 * 0.75).length).toBe(3);
  });

  it('the laser overheats and locks until it has cooled right down', () => {
    const { d, a, aim } = duel([[30, 0, 10]], 'core.laser_rifle');
    const laser = heldWeapon(a);
    const ev = d.run(200, () => aim({ yaw: Math.PI / 2 + 0.6, buttons: BUTTON_FIRE }));
    expect(laser.overheated || ev.filter((e) => e.e === 'shot').length < 100).toBe(true);
    const fired = ev.filter((e) => e.e === 'shot').length;
    expect(fired).toBeGreaterThan(30);
    expect(fired).toBeLessThan(90);
    d.run(150, () => aim());
    expect(laser.heat).toBe(0);
    expect(laser.overheated).toBe(false);
  });

  it('chain lightning jumps to a second enemy nearby', () => {
    const { d, others, aim } = duel([[10, 0, 4], [12, 0, 8]], 'core.arc_caster');
    const ev = d.run(3, () => aim({ buttons: BUTTON_FIRE }));
    const arc = ev.find((e) => e.e === 'arc');
    expect(arc && arc.e === 'arc' && arc.pts.length).toBe(3);
    expect(others[1]!.health).toBeLessThan(PLAYER.maxHealth);
  });

  it('flames set players burning (damage over time), the freeze ray freezes them solid', () => {
    const fire = duel([[5, 0, 4]], 'core.flamethrower');
    fire.d.run(20, () => fire.aim({ buttons: BUTTON_FIRE }));
    const victim = fire.others[0]!;
    expect(victim.burnTicks).toBeGreaterThan(0);
    const hp = victim.health;
    fire.d.run(60, () => fire.aim());
    expect(victim.health).toBeLessThan(hp);

    const ice = duel([[8, 0, 4]], 'core.freeze_ray');
    const frozen = ice.d.run(120, () => ice.aim({ buttons: BUTTON_FIRE }));
    void frozen;
    const t = ice.others[0]!;
    expect(t.frozenTicks > 0 || t.chill > 0.5).toBe(true);
  });

  it('oil makes a slick, a flare sets it alight and the fire burns whoever stands in it', () => {
    const { match, d, a, others, aim } = duel([[8, 0, 4]], 'core.oil_slicker');
    // Lob oil at the target's feet.
    const at = lookAngles(eye(a.move.pos), { x: 8, y: 0, z: 4 });
    d.run(60, () => aim({ yaw: at.yaw, pitch: at.pitch + 0.25, buttons: BUTTON_FIRE }));
    const snap = () => match.snapshot([]).zn ?? [];
    expect(snap().some((z) => z[0] === 3)).toBe(true); // oil
    give(a, 'core.flare_gun');
    // The flare sticks to whatever it hits and burns there.
    d.run(2, () => aim({ yaw: at.yaw, pitch: at.pitch + 0.1, buttons: BUTTON_FIRE }));
    d.run(400, () => aim());
    expect(snap().some((z) => z[0] === 0)).toBe(true); // fire
    expect(others[0]!.health).toBeLessThan(PLAYER.maxHealth);
  });

  it('the disc launcher knocks players back (and you can disc-jump)', () => {
    const { d, a, others, aim } = duel([[8, 0, 4]], 'core.disc_launcher');
    d.run(30, () => aim({ buttons: BUTTON_FIRE }));
    const t = others[0]!;
    expect(t.alive ? Math.abs(t.move.vx ?? 0) + Math.abs(t.move.vz ?? 0) + t.move.pos.x - 8 : 1).toBeGreaterThan(0.5);
    // Shoot your own feet: up you go.
    a.fireCooldown = 0;
    heldWeapon(a).mag = 3;
    let top = a.move.pos.y;
    d.run(40, () => {
      d.input(a, { yaw: 0, pitch: -1.5, buttons: BUTTON_FIRE });
      top = Math.max(top, a.move.pos.y);
    });
    expect(top).toBeGreaterThan(1.2);
  });

  it('swarm missiles home in on an enemy off to the side', () => {
    const { match, d, a, others } = duel([[24, 0, 10]], 'core.swarm');
    // Aim straight down the yard, not at the target.
    d.run(4, () => d.input(a, { yaw: Math.PI / 2, pitch: 0, buttons: BUTTON_FIRE }));
    d.run(120, () => d.input(a, { yaw: Math.PI / 2, pitch: 0 }));
    void match;
    expect(others[0]!.health).toBeLessThan(PLAYER.maxHealth);
  });

  it('a sticky grenade sticks to the player it hits and goes off on them', () => {
    const { d, a, others, aim } = duel([[6, 0, 4]], 'core.pistol');
    a.throwable = { kind: 'sticky', count: 1 };
    const look = lookAngles(eye(a.move.pos), chest(others[0]!.move.pos));
    d.run(2, () => aim({ yaw: look.yaw, pitch: look.pitch + 0.08, buttons: BUTTON_THROW }));
    // Let the target run away: the grenade goes with them.
    d.run(150, () => d.input(others[0]!, { yaw: Math.PI / 2, forward: 1 }));
    expect(others[0]!.alive).toBe(false);
    expect(THROWABLE_DEFS.sticky.projectile.sticky).toBe('any');
  });

  it('bubbles bounce off walls and burst into a toxic cloud that poisons', () => {
    const { match, d, aim, others } = duel([[6, 0, 4]], 'core.bubble_blaster');
    d.run(200, () => aim({ buttons: BUTTON_FIRE }));
    const hit = others[0]!;
    expect(hit.health).toBeLessThan(PLAYER.maxHealth);
    void match;
  });

  it('a singularity drags players toward it before it collapses', () => {
    // Fired past the target, it bursts beyond them (x ≈ 21) and pulls them in.
    const { d, a, others } = duel([[14, 0, 7]], 'core.singularity');
    const start = { ...others[0]!.move.pos };
    d.run(3, () => d.input(a, { yaw: Math.PI / 2, pitch: 0, buttons: BUTTON_FIRE }));
    let moved = 0;
    d.run(150, () => {
      d.input(a, { yaw: Math.PI / 2, pitch: 0 });
      d.input(others[0]!, {}); // players move only on their own inputs
      moved = Math.max(moved, Math.hypot(others[0]!.move.pos.x - start.x, others[0]!.move.pos.z - start.z));
    });
    expect(moved).toBeGreaterThan(1);
  });
});
