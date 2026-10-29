import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ARENA_DISC,
  BOT_DIFFICULTIES,
  BUTTON_FIRE,
  CORE_BOT_PROFILES,
  DEFAULT_RULES,
  DISC_POWERS,
  discApproach,
  discThrows,
  dodgeDisc,
  getItem,
  getWeapon,
  initPhysics,
  loadMap,
  lookAngles,
  playableModes,
  weaponCode,
  type GameEvent,
  type MapDocument,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_RULES['core.discs'], respawnDelayTicks: 100_000 };

function gridRings(): MapDocument {
  const r = loadMap(readFileSync(new URL('../../../maps/grid_rings.json', import.meta.url), 'utf8'));
  if (!r.ok) throw new Error('grid_rings failed to load');
  return r.map;
}

/** A 40 × 16 m walled yard. */
const yard = () => {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4], [30, 0, 4]]);
};

type Proj = { spec: { visual: string; disc?: unknown }; pos: { x: number; y: number; z: number }; bounces?: number; extra?: boolean; stuck?: boolean };
const projectiles = (m: Match) => (m as unknown as { projectiles: Proj[] }).projectiles;

function setup(map: MapDocument) {
  const match = new Match(map, rules);
  const a = match.addHuman('thrower')!;
  const b = match.addHuman('target')!;
  let seq = 0;
  const events: GameEvent[] = [];
  const idle = new Set<Combatant>([a, b]);
  const send = (c: Combatant, yaw: number, pitch: number, buttons = 0) => match.queueInputs(c.slot, [{ seq: ++seq, forward: 0, right: 0, yaw, pitch, buttons }]);
  const step = (n: number, each?: () => void) => {
    for (let i = 0; i < n; i++) {
      for (const c of idle) send(c, c.yaw, c.pitch);
      each?.();
      events.push(...match.step());
    }
  };
  const put = (c: Combatant, x: number, y: number, z: number) => (c.move = { pos: { x, y, z }, velY: 0, grounded: true });
  /** Aim `from` at `to`'s chest and throw. */
  const throwAt = (from: Combatant, to: Combatant) => {
    const eye = { x: from.move.pos.x, y: from.move.pos.y + 1.6, z: from.move.pos.z };
    const aim = lookAngles(eye, { x: to.move.pos.x, y: to.move.pos.y + 1, z: to.move.pos.z });
    idle.delete(from);
    send(from, aim.yaw, aim.pitch, BUTTON_FIRE);
    events.push(...match.step());
    send(from, aim.yaw, aim.pitch, 0);
    events.push(...match.step());
    idle.add(from);
  };
  step(3);
  // Past the spawn guard.
  a.spawnedAt = b.spawnedAt = -10_000;
  return { match, a, b, step, put, throwAt, events, send };
}

const discs = (c: Combatant) => c.weapons.get(weaponCode(getWeapon(ARENA_DISC)))!.mag;

describe('Disc Arena', () => {
  it('is its own mode: arena discs only, no grenades, and Grid Rings offers it', () => {
    const { a } = setup(yard());
    expect([...a.weapons.values()].map((w) => w.def.id)).toEqual([ARENA_DISC]);
    expect(a.throwable).toBeNull();
    expect(discs(a)).toBe(3);
    expect(playableModes(gridRings())).toContain('core.discs');
  });

  /** Throw `a`'s disc at the west wall and wait until it lies on the ground; returns where. */
  const throwAndLand = (t: ReturnType<typeof setup>) => {
    t.put(t.a, 2, 0, 4);
    t.put(t.b, 30, 0, 12);
    const ghost = { move: { pos: { x: -10, y: 0, z: 4 } } } as unknown as Combatant;
    t.throwAt(t.a, ghost);
    let bounced = 0;
    t.step(30, () => (bounced = Math.max(bounced, ...projectiles(t.match).map((p) => p.bounces ?? 0))));
    t.put(t.a, 30, 0, 4);
    t.step(200);
    const lying = projectiles(t.match);
    return { bounced, lying };
  };

  it('a disc bounces off walls, then drops where it stops: picked up again like ammo', () => {
    const t = setup(yard());
    const { bounced, lying } = throwAndLand(t);
    expect(bounced).toBeGreaterThanOrEqual(1);
    // It doesn't fly home: it lies on the ground, and the thrower is a disc short.
    expect(lying).toHaveLength(1);
    expect(lying[0]!.stuck).toBe(true);
    expect(lying[0]!.pos.y).toBeLessThan(0.5);
    expect(discs(t.a)).toBe(2);
    // Walk over it.
    t.put(t.a, lying[0]!.pos.x, 0, lying[0]!.pos.z);
    t.step(2);
    expect(discs(t.a)).toBe(3);
    expect(projectiles(t.match)).toHaveLength(0);
    expect(t.events.some((e) => e.e === 'pickup' && e.s === t.a.slot && e.item === 'core.weapon_arena_disc')).toBe(true);
  });

  it('anyone short of three discs can take a lying one; a full hand walks past it, and one left lying goes home', () => {
    const t = setup(yard());
    const { lying } = throwAndLand(t);
    const at = lying[0]!.pos;
    // The other player, with all three, leaves it.
    t.put(t.b, at.x, 0, at.z);
    t.step(2);
    expect(discs(t.b)).toBe(3);
    expect(projectiles(t.match)).toHaveLength(1);
    // A disc short, they take it.
    t.b.weapons.get(weaponCode(getWeapon(ARENA_DISC)))!.mag = 2;
    t.step(2);
    expect(discs(t.b)).toBe(3);
    expect(discs(t.a)).toBe(2);

    // Nobody comes for it: back to its thrower after a while.
    const u = setup(yard());
    throwAndLand(u);
    expect(discs(u.a)).toBe(2);
    u.step(60 * 16);
    expect(projectiles(u.match)).toHaveLength(0);
    expect(discs(u.a)).toBe(3);
  });

  it('the player a disc knocks over cannot grab it at once', () => {
    const t = setup(yard());
    t.put(t.a, 2, 0, 4);
    t.put(t.b, 8, 0, 4);
    t.b.weapons.get(weaponCode(getWeapon(ARENA_DISC)))!.mag = 1;
    t.throwAt(t.a, t.b);
    // Hold the target still where the disc drops at its feet.
    t.step(20, () => t.put(t.b, 8, 0, 4));
    const before = discs(t.b);
    expect(projectiles(t.match).some((p) => p.stuck)).toBe(true);
    expect(before).toBe(1);
    // After the moment's grace it's anyone's, theirs included.
    t.step(30, () => t.put(t.b, projectiles(t.match).find((p) => p.stuck)?.pos.x ?? 8, 0, projectiles(t.match).find((p) => p.stuck)?.pos.z ?? 4));
    expect(discs(t.b)).toBe(2);
  });

  it('a disc with no ground under it (over the void) goes straight back to its thrower', () => {
    const { match, a, put, step, throwAt } = setup(yard());
    put(a, 2, 0, 4);
    // Straight up: its flight ends some 55 m up, with nothing to land on below for 40 m.
    const ghost = { move: { pos: { x: 2.01, y: 200, z: 4 } } } as unknown as Combatant;
    throwAt(a, ghost);
    expect(discs(a)).toBe(2);
    step(60 * 4);
    expect(projectiles(match).some((p) => p.stuck)).toBe(false);
    expect(discs(a)).toBe(3);
  });

  it('a hit shoves without hurting, and a knock into the void scores for the thrower', () => {
    const { match, a, b, put, step, throwAt, events } = setup(gridRings());
    put(a, -3, 0, -3);
    put(b, 4.5, 0, 4.2);
    step(2);
    throwAt(a, b);
    let pushed = 0;
    step(30, () => (pushed = Math.max(pushed, Math.hypot(b.move.vx ?? 0, b.move.vz ?? 0))));
    expect(pushed).toBeGreaterThan(5);
    expect(b.health).toBe(b.maxHealth);
    step(60 * 6);
    const kill = events.find((e) => e.e === 'kill');
    expect(kill).toMatchObject({ killer: a.slot, victim: b.slot, weapon: ARENA_DISC });
    expect(a.kills).toBe(1);
    expect(b.alive).toBe(false);
    expect(match.scores().find((s) => s.s === a.slot)?.k).toBe(1);
  });

  it('just after spawning, discs glance off', () => {
    const { a, b, put, step, throwAt, match } = setup(gridRings());
    put(a, -3, 0, -3);
    put(b, 4.5, 0, 4.2);
    b.spawnedAt = match.tick;
    step(2);
    throwAt(a, b);
    step(30);
    expect(Math.hypot(b.move.vx ?? 0, b.move.vz ?? 0)).toBe(0);
    expect(b.alive).toBe(true);
  });

  it('jumping off on your own is a death, never a lost kill', () => {
    const { a, put, step, events } = setup(gridRings());
    put(a, 0, 0, 30);
    step(60 * 6);
    expect(events.find((e) => e.e === 'kill')).toMatchObject({ killer: null, victim: a.slot });
    expect(a.kills).toBe(0);
    expect(a.deaths).toBe(1);
  });

  it('power discs: pickups for each, triple throws three, freeze freezes, split splits at the first bounce', () => {
    for (const p of DISC_POWERS) expect(getItem(`core.disc_${p}`)?.effect).toEqual({ kind: 'disc', power: p });
    const spec = getWeapon(ARENA_DISC).projectile!;
    expect(discThrows(spec, 'triple')).toHaveLength(3);
    expect(discThrows(spec, 'fast')[0]!.spec.speed).toBeGreaterThan(spec.speed);

    const t = setup(yard());
    t.put(t.a, 2, 0, 4);
    t.put(t.b, 14, 0, 4);
    t.a.discPower = { kind: 'triple', shots: 3 };
    t.throwAt(t.a, t.b);
    expect(projectiles(t.match).length).toBe(3);
    expect(t.a.discPower?.shots).toBe(2);
    expect(discs(t.a)).toBe(2);
    t.step(200);
    // Only the thrown disc drops to be picked up again, not the extras.
    expect(projectiles(t.match).filter((p) => p.stuck)).toHaveLength(1);
    expect(discs(t.a)).toBe(2);

    const f = setup(yard());
    f.put(f.a, 2, 0, 4);
    f.put(f.b, 12, 0, 4);
    f.a.discPower = { kind: 'freeze', shots: 1 };
    f.throwAt(f.a, f.b);
    let frozen = 0;
    f.step(40, () => (frozen = Math.max(frozen, f.b.frozenTicks)));
    expect(frozen).toBeGreaterThan(0);
    expect(f.a.discPower).toBeUndefined();

    const s = setup(yard());
    s.put(s.a, 2, 0, 4);
    s.put(s.b, 30, 0, 10);
    s.a.discPower = { kind: 'split', shots: 1 };
    s.throwAt(s.a, { move: { pos: { x: -10, y: 0, z: 4 } } } as unknown as Combatant);
    let most = 0;
    s.step(40, () => (most = Math.max(most, projectiles(s.match).length)));
    expect(most).toBe(3);
  });

  it('a power disc pickup arms the next throws', () => {
    const map = yard();
    map.entities.push({ id: 'pd', kind: 'pickup', position: [6, 0, 4], item: 'core.disc_split', respawnSeconds: null } as MapDocument['entities'][number]);
    const { a, put, step } = setup(map);
    put(a, 6, 0, 4);
    step(3);
    expect(a.discPower).toEqual({ kind: 'split', shots: 3 });
  });

  it('bots see a disc coming and step aside onto floor', () => {
    expect(discApproach({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 20 }, { x: 0, y: 1, z: 10 })).toMatchObject({ t: 0.5, miss: 0 });
    expect(discApproach({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -20 }, { x: 0, y: 1, z: 10 })).toBeNull();
    const input = { seq: 1, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 };
    // Disc coming from the south; floor only to the east (+x).
    const dodged = dodgeDisc(input, { pos: { x: 0, y: 0, z: 10 }, yaw: 0, grounded: true }, [{ pos: { x: 0, y: 1, z: 2 }, vel: { x: 0, y: 0, z: 24 } }], (p) => p.x > 0);
    expect(dodged).toBe(true);
    // Facing north (yaw 0), east is "right".
    expect(input.right).toBeGreaterThan(0.5);
    expect(input.buttons).not.toBe(0);
  });

  it('bots play a round on Grid Rings: they throw, knock each other off and score', () => {
    const match = new Match(gridRings(), { ...DEFAULT_RULES['core.discs'], timeLimitSeconds: 0, scoreLimit: 0 }, 7);
    const bots = Array.from({ length: 6 }, (_, i) => match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.hard)!);
    const events: GameEvent[] = [];
    let thrown = 0;
    for (let t = 0; t < 60 * 90; t++) {
      events.push(...match.step());
      thrown = Math.max(thrown, projectiles(match).length);
    }
    const kills = events.filter((e) => e.e === 'kill');
    expect(thrown).toBeGreaterThan(0);
    // Knock-offs credited to a bot, with the disc.
    expect(kills.filter((e) => e.e === 'kill' && e.killer !== null && e.weapon === ARENA_DISC).length).toBeGreaterThan(0);
    // Nobody ever takes damage in Disc Arena.
    for (const b of bots) if (b.alive) expect(b.health).toBe(b.maxHealth);
  }, 60_000);
});
