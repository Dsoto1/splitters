import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_CROUCH,
  BUTTON_FIRE,
  BUTTON_THIRD_PERSON,
  DEFAULT_DEATHMATCH_RULES,
  STANCES,
  TP_BACK,
  TP_SIDE,
  TP_UP,
  getWeapon,
  initPhysics,
  lookAngles,
  sanitizeInput,
  thirdPersonAim,
  thirdPersonCamera,
  viewDirection,
  weaponCode,
  type GameEvent,
  type MapDocument,
  type MapEntity,
  type MatchRules,
  type PlayerInput,
  type RayQuery,
  type Vec3,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/**
 * Third-person shots (sim/thirdPerson.ts): rounds leave from the eye toward
 * what the over-the-shoulder crosshair is on. Before, they went along the
 * view direction from the eye, so a player crouched behind low cover saw over
 * it in third person while their rounds hit it.
 */

const none: RayQuery = () => null;

describe('third-person aim (the maths)', () => {
  it('the camera sits behind, right of and above the eye; a wall behind pulls it in', () => {
    const eye = { x: 0, y: 1.6, z: 0 };
    const free = thirdPersonCamera(none, eye, 0, 0);
    // Facing +z: back is -z, right is +x.
    expect(free.pos.z).toBeCloseTo(-TP_BACK, 6);
    expect(free.pos.x).toBeCloseTo(TP_SIDE, 6);
    expect(free.pos.y).toBeCloseTo(1.6 + TP_UP, 6);
    expect(free.dist).toBeCloseTo(Math.hypot(TP_BACK, TP_SIDE, TP_UP), 6);
    const walled = thirdPersonCamera(() => 1, eye, 0, 0);
    expect(walled.dist).toBeCloseTo(0.75, 6);
  });

  it('aims from the eye at the point the crosshair is on, near or far', () => {
    const eye = { x: 0, y: 1.6, z: 0 };
    // A wall across the view 10 m out: the crosshair's point on it, seen from the eye.
    const wall: RayQuery = (o, d) => (d.z > 0 ? (10 - o.z) / d.z : null);
    const a = thirdPersonAim(wall, eye, 0.1, -0.05);
    const cam = thirdPersonCamera(wall, eye, 0.1, -0.05).pos;
    const f = viewDirection(0.1, -0.05);
    const t = (10 - cam.z) / f.z;
    const p = { x: cam.x + f.x * t, y: cam.y + f.y * t, z: 10 };
    const want = lookAngles(eye, p);
    expect(a.yaw).toBeCloseTo(want.yaw, 9);
    expect(a.pitch).toBeCloseTo(want.pitch, 9);
    // It differs from the view: the shoulder offset seen over 10 m.
    expect(Math.abs(a.yaw - 0.1)).toBeGreaterThan(0.03);
    // Nothing in view: a point far out, almost along the view.
    const far = thirdPersonAim(none, eye, 0.1, -0.05);
    expect(Math.abs(far.yaw - 0.1)).toBeLessThan(0.003);
    expect(Math.abs(far.pitch + 0.05)).toBeLessThan(0.003);
    // A body nearer than the wall wins.
    const body: RayQuery = (o, d, max) => Math.min(max, (5 - o.z) / d.z);
    const b = thirdPersonAim(wall, eye, 0.1, -0.05, body);
    const tb = (5 - cam.z) / f.z;
    const want2 = lookAngles(eye, { x: cam.x + f.x * tb, y: cam.y + f.y * tb, z: 5 });
    expect(b.yaw).toBeCloseTo(want2.yaw, 9);
  });

  it('a crosshair point behind or right at the eye: along the view', () => {
    const eye = { x: 0, y: 1.6, z: 0 };
    // Something between the camera and the eye's plane.
    const close: RayQuery = (o, d) => (d.z > 0 && o.z < 0 ? (0.1 - o.z) / d.z : null);
    expect(thirdPersonAim(close, eye, 0, 0.2)).toEqual({ yaw: 0, pitch: 0.2 });
  });

  it('the button is a known input bit (hosts keep it)', () => {
    const i = sanitizeInput({ seq: 1, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: BUTTON_THIRD_PERSON | BUTTON_FIRE });
    expect(i?.buttons).toBe(BUTTON_THIRD_PERSON | BUTTON_FIRE);
  });
});

/** An open deck with a 1.3 m wall across the line of fire, 15 m out. */
function deck(extra: MapEntity[]): MapDocument {
  const tiles = [];
  for (let x = 0; x < 6; x++) for (let y = -2; y <= 2; y++) tiles.push({ id: `p_${x}_${y}`, tile: 'core.platform', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 0]]);
  return { ...map, entities: [...map.entities, ...extra] };
}

const wall: MapEntity = { id: 'wall', kind: 'block', position: [15, 0, 0], size: [0.4, 1.3, 6], yaw: 0, material: 'core.pbr_concrete', tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 100000 };

function give(c: Combatant, id: string): void {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
  c.raiseTicks = 0;
  c.fireCooldown = 0;
}

/**
 * Crouched behind the wall, a player in third person puts the crosshair on
 * the head of someone standing 5 m beyond it, and fires once. Where does the
 * round land?
 */
function shootOverWall(thirdPerson: boolean): { hit: number | null; to: [number, number, number] } {
  const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
  const match = new Match(deck([wall]), rules, 3);
  const a = match.addHuman('a')!;
  const b = match.addHuman('b')!;
  a.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
  b.move = { pos: { x: 20, y: 0, z: 0 }, velY: 0, grounded: true };
  give(a, 'core.pistol');
  let seq = 0;
  const input = (c: Combatant, i: Partial<PlayerInput>) => match.queueInputs(c.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
  // Crouch down behind the wall.
  for (let t = 0; t < 40; t++) {
    input(a, { yaw: Math.PI / 2, pitch: 0, buttons: BUTTON_CROUCH });
    input(b, {});
    match.step();
  }
  expect(a.move.stance).toBe(1);
  // The view that puts the third-person crosshair on b's head (the camera moves with the view: settle it).
  const eye: Vec3 = { x: a.move.pos.x, y: a.move.pos.y + STANCES[1].eye, z: a.move.pos.z };
  const head = { x: b.move.pos.x, y: b.move.pos.y + 1.6, z: b.move.pos.z };
  let view = lookAngles(eye, head);
  for (let k = 0; k < 20; k++) view = lookAngles(thirdPersonCamera((o, d, max) => match.physics.raycastWorld(o, d, max), eye, view.yaw, view.pitch).pos, head);
  // In third person, the wall is below the crosshair's line: the camera sees b's head over it.
  const cam = thirdPersonCamera((o, d, max) => match.physics.raycastWorld(o, d, max), eye, view.yaw, view.pitch).pos;
  expect(match.physics.lineOfSight(cam, head)).toBe(true);
  const ev: GameEvent[] = [];
  input(a, { ...view, buttons: BUTTON_CROUCH | BUTTON_FIRE | (thirdPerson ? BUTTON_THIRD_PERSON : 0) });
  input(b, {});
  ev.push(...match.step());
  for (let t = 0; t < 30; t++) {
    input(a, { ...view, buttons: BUTTON_CROUCH | (thirdPerson ? BUTTON_THIRD_PERSON : 0) });
    input(b, {});
    ev.push(...match.step());
  }
  for (const e of ev) {
    if (e.e === 'shot' && e.s === a.slot && !e.fl?.includes(0)) return { hit: e.hit[0] ?? null, to: e.to[0]! };
    if (e.e === 'impact' && e.s === a.slot) return { hit: e.hit, to: e.to };
  }
  throw new Error('no shot');
}

describe('third-person shots in the sim', () => {
  it('crouched behind a low wall, crosshair on a head over it: the round reaches them (it used to hit the wall)', () => {
    const tp = shootOverWall(true);
    expect(tp.hit, JSON.stringify(tp)).not.toBeNull();
    // The same view and the same trigger without the third-person bit (as an older client sends): along the view
    // from the eye, into the wall.
    const fp = shootOverWall(false);
    expect(fp.hit, JSON.stringify(fp)).toBeNull();
    expect(fp.to[0]).toBeLessThan(15.5);
  });
});
