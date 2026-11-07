// Parkour links (nav/parkour.ts; BOT_AI_PLAN.md Phase C item 1) and ground that goes (Scenario.surfaces, Phase C item 2):
// drops, gap jumps and jumps up, played through the movement code at load; bots that take them; routes off a fallen bridge.
import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_CROUCH, BUTTON_JUMP, CORE_BOT_PROFILES, PhysicsWorld, TICK_DT, TICK_RATE, buildMapGeometry, initPhysics, loadMap, stepMovement, type MapDocument, type MoveState } from '../src/index.ts';
import { Match, initNavigation, mapNavigation } from '../src/match.ts';
import { parkourAlong, parkourInput, type ParkourLink } from '../src/nav/parkour.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** Open yard tiles, 3 × 3 (x and z from -4 to 20), floor at 0. */
const yard = (spawns: [number, number, number][]): MapDocument => {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) tiles.push({ id: `yard${x}${z}`, tile: 'core.yard', x, y: z, z: 0, rotation: 0 });
  return makeMap(tiles, spawns);
};
const block = (id: string, center: [number, number], size: [number, number, number], y = 0, behaviour = 'solid') =>
  ({ id, kind: 'block', position: [center[0], y, center[1]], size, yaw: 0, material: null, behaviour, trigger: 'step', delaySeconds: 0.5, respawnSeconds: null, health: 100 }) as MapDocument['entities'][number];
const gun = (at: [number, number, number]) => ({ id: 'gun_1', kind: 'pickup', position: at, item: 'core.weapon_shotgun', respawnSeconds: null }) as MapDocument['entities'][number];
const loaded = (doc: MapDocument): MapDocument => {
  const r = loadMap(doc);
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.map;
};

/** Two platforms 2 m up across a 3 m gap (x 6 to 9), no stairs: the gap jump is the only way between them. */
const gapMap = (withGun: boolean): MapDocument => {
  const doc = yard([
    [0, 2, 8],
    [15, 2, 8],
  ]);
  doc.entities.push(block('west', [1, 8], [10, 2, 24]), block('east', [14.5, 8], [11, 2, 24]));
  if (withGun) doc.entities.push(gun([15, 2, 8]));
  return loaded(doc);
};

/** A ledge 1.1 m up in the yard, no steps: a jump up gets onto it. */
const ledgeMap = (): MapDocument => {
  const doc = yard([
    [0, 0, 8],
    [0, 0, 0],
  ]);
  doc.entities.push(block('ledge', [12, 8], [8, 1.1, 8]), gun([12, 1.1, 8]));
  return loaded(doc);
};

/** Plays a link through stepMovement with a bot's inputs (parkourInput), as the build does: where the body stands at the end. */
function play(physics: PhysicsWorld, link: ParkourLink): MoveState {
  const collider = physics.createPlayerCollider();
  let s: MoveState = { pos: { ...link.start, y: link.start.y + 0.1 }, velY: 0, grounded: false };
  let jumped = false;
  for (let t = 0; t < 120; t++) {
    const c = parkourInput(link, s.pos, s.grounded, jumped);
    if (c.jump) jumped = true;
    s = stepMovement(physics, collider, s, { seq: t, forward: 1, right: 0, yaw: c.yaw, pitch: 0, buttons: c.buttons }, 1, TICK_DT, 1, { autoChute: true });
    if (jumped && s.grounded && t > 10) break;
  }
  physics.removeCollider(collider);
  return s;
}

describe('parkour links', () => {
  it('finds a gap jump each way between two platforms, played through the movement code, the same every build', () => {
    const map = gapMap(false);
    const a = mapNavigation(map);
    const gaps = a.nav.parkour.filter((l) => l.kind === 'gap');
    expect(gaps.some((l) => l.start.x < 6 && l.end.x > 9)).toBe(true);
    expect(gaps.some((l) => l.start.x > 9 && l.end.x < 6)).toBe(true);
    // A jump, at its takeoff: past the start, before the edge.
    const g = gaps.find((l) => l.start.x < 6)!;
    expect(g.takeoff).toBeGreaterThan(0);
    expect(g.takeoff).toBeLessThan(3);
    // The movement code takes a body across (and the routes do too: one platform to the other).
    const end = play(a.physics, g);
    expect(end.pos.x).toBeGreaterThan(9);
    expect(end.pos.y).toBeGreaterThan(1.9);
    expect(a.nav.findPath({ x: 0, y: 2, z: 8 }, { x: 15, y: 2, z: 8 })).not.toBeNull();
    // (Never down into the gap's floor: nothing gets back up out of it.)
    expect(a.nav.parkour.some((l) => l.kind === 'drop' && l.end.y < 0.5)).toBe(false);
    const b = mapNavigation(map);
    expect(b.nav.parkour).toEqual(a.nav.parkour);
    for (const x of [a, b]) {
      x.physics.free();
      x.nav.destroy();
    }
  });

  it('finds a jump up onto a ledge a step can’t climb, and the drop back down', () => {
    const map = ledgeMap();
    const built = mapNavigation(map);
    const up = built.nav.parkour.find((l) => l.kind === 'up');
    expect(up).toBeDefined();
    expect(up!.end.y).toBeGreaterThan(1);
    expect(built.nav.findPath({ x: 0, y: 0, z: 8 }, { x: 12, y: 1.1, z: 8 })).not.toBeNull();
    expect(built.nav.findPath({ x: 12, y: 1.1, z: 8 }, { x: 0, y: 0, z: 8 })).not.toBeNull();
    const end = play(built.physics, up!);
    expect(end.pos.y).toBeGreaterThan(1);
    // The parkour-only places: the ledge's top (where snipers look for spots others don't go).
    expect(built.nav.parkourPlaces().some((p) => p.y > 1 && Math.abs(p.x - 12) < 4)).toBe(true);
    built.physics.free();
    built.nav.destroy();
  });

  it('a jump up from the right takeoff clears the ledge; from too far back it doesn’t (the takeoff is what the build found)', () => {
    const map = ledgeMap();
    const built = mapNavigation(map);
    const up = built.nav.parkour.find((l) => l.kind === 'up')!;
    expect(play(built.physics, up).pos.y).toBeGreaterThan(1);
    // Jumping straight away from a long way back falls short (lands on the yard).
    const back = { ...up, start: { x: up.start.x - Math.sin(up.yaw) * 4, y: up.start.y, z: up.start.z - Math.cos(up.yaw) * 4 }, takeoff: 0 };
    expect(parkourAlong(back, up.start)).toBeCloseTo(4, 1);
    expect(play(built.physics, back).pos.y).toBeLessThan(0.5);
    // (The inputs: a jump at the takeoff, then the legs tucked up for a high ledge.)
    const c = parkourInput({ ...up, tuck: true }, up.start, true, false);
    expect(c.buttons & BUTTON_JUMP).toBe(up.takeoff <= 0 ? BUTTON_JUMP : 0);
    expect(parkourInput({ ...up, tuck: true }, up.start, false, true).buttons & BUTTON_CROUCH).toBe(BUTTON_CROUCH);
    built.physics.free();
    built.nav.destroy();
  });
});

describe('bots take parkour links', () => {
  it('a bot jumps the gap to the gun on the other platform', () => {
    const match = new Match(gapMap(true), undefined, 3);
    const bot = match.addBot('b', { ...CORE_BOT_PROFILES[0]!, exploration: 0 })!;
    bot.move = { pos: { x: 0, y: 2, z: 8 }, velY: 0, grounded: true };
    let crossed = -1;
    for (let t = 0; t < TICK_RATE * 20 && crossed < 0; t++) {
      match.step();
      if (bot.alive && bot.move.pos.x > 9.5 && bot.move.pos.y > 1.8) crossed = t;
    }
    expect(crossed).toBeGreaterThan(0);
    // (A move counts once the bot is down and standing.)
    for (let t = 0; t < 30; t++) match.step();
    expect(bot.bot!.parkourDone.gap).toBeGreaterThan(0);
    match.destroy();
  });

  it('a bot jumps up onto the ledge for the gun on it', () => {
    const match = new Match(ledgeMap(), undefined, 5);
    const bot = match.addBot('b', { ...CORE_BOT_PROFILES[0]!, exploration: 0 })!;
    bot.move = { pos: { x: 0, y: 0, z: 8 }, velY: 0, grounded: true };
    let up = -1;
    for (let t = 0; t < TICK_RATE * 20 && up < 0; t++) {
      match.step();
      if (bot.alive && bot.move.pos.y > 1 && bot.move.pos.x > 8.5) up = t;
    }
    expect(up).toBeGreaterThan(0);
    for (let t = 0; t < 30; t++) match.step();
    expect(bot.bot!.parkourDone.up).toBeGreaterThan(0);
    match.destroy();
  });
});

describe('ground that goes', () => {
  it('routes keep off a bridge once it has crumbled, round by the walkway that is still there', () => {
    // Two platforms 3 m up, a crumbling bridge between them (z 6 to 10) and a solid walkway further round (z 16 to 20).
    const doc = yard([
      [0, 3, 8],
      [16, 3, 8],
    ]);
    doc.entities.push(block('west', [0, 8], [8, 3, 24]), block('east', [16, 8], [8, 3, 24]), block('bridge', [8, 8], [8, 0.4, 4], 2.6, 'crumble'), block('walk', [8, 18], [8, 0.4, 4], 2.6));
    const map = loaded(doc);
    const geometry = buildMapGeometry(map);
    expect(geometry.length).toBeGreaterThan(0);
    const match = new Match(map, undefined, 7);
    match.addBot('b', { ...CORE_BOT_PROFILES[0]!, exploration: 0 });
    const from = { x: 0, y: 3, z: 8 };
    const to = { x: 16, y: 3, z: 8 };
    const maxZ = (p: { z: number }[] | null) => Math.max(...(p ?? []).map((c) => c.z));
    const before = match.nav.findPath(from, to);
    expect(before).not.toBeNull();
    expect(maxZ(before)).toBeLessThan(12);
    // Someone steps on the bridge: it crumbles (half a second), and a few ticks on every route keeps off it.
    const walker = match.addHuman('h')!;
    walker.move = { pos: { x: 8, y: 3, z: 8 }, velY: 0, grounded: true };
    for (let t = 0; t < TICK_RATE * 2; t++) match.step();
    const after = match.nav.findPath(from, to);
    expect(after).not.toBeNull();
    expect(maxZ(after)).toBeGreaterThan(14);
    match.destroy();
  });
});
