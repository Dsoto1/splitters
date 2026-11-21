// Flavius Rule's octagon, phase 3 (docs/map-briefs/sandfall_colosseum/OCTAGON_PLAN.md §3.2 gate row, §3.3-§3.5, §3.7):
// the Arena Corner's gate. `core.arena_corner_ground_gate` and `core.arena_corner_attic_gate` (MapMaker's tile option
// "Gate" of the ground and attic storeys), the gatehouse tower `core.arena_corner_tower` and `setpiece.arena_corner_gate`
// (made by tools/content/kit/arenaCorner.mjs and content/setpieces/arena.json), between straight bay lines of the Arena
// stands as Flavius Rule builds them, with the hypogeum's corner a level under it. In all four turns: bots walk from the
// sand through the gate passage out through the facade and the tower, down each stair well to level -1, up the tower to
// every landing and the lookout, and up the podium stairs either side of the gate; the 45° portcullis blocks its own
// slab when shut and lets bots through when open; a bot presses the chain button to raise it; nothing is drawn twice.
// A mirrored gate corner is a turned one, its five tiles overlap nowhere, and it keeps to its box and light budgets.
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BODY_SIZES,
  CORE_BOT_PROFILES,
  PhysicsWorld,
  TICK_RATE,
  applyCommand,
  boxCorners,
  builtInSetPieces,
  buildMapDecor,
  buildMapGeometry,
  coplanarOverlaps,
  coreCatalog,
  emptyInput,
  explodeSetPieceCommand,
  initPhysics,
  loadMap,
  mapTerrainMesh,
  navLinks,
  rotateXZ,
  segmentHitsAabb,
  serializeMap,
  setTileOptionCommand,
  stepMovement,
  tileDiagonalMirror,
  tileOptionsOf,
  visibleFaces,
  type MapDocument,
  type MapEntity,
  type MoveState,
  type Rotation,
  type SetPiecePlacement,
  type TilePlacement,
  type Vec3,
  type WorldBox,
} from '../src/index.ts';
import { Match, NavWorld, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';
import { DOOR, PIECE, at, cornerBoxes, gateMap, inDiagonal, navOf, onDiagonal, pathLength, physicsOf, played, route, shape, type Placed } from './arenaCornerGateMap.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const library = builtInSetPieces();
/** The gate corner's tiles, in the set piece's order (parts 0-4), and the part index of its portcullis. */
const TILES = ['core.arena_corner_ground_gate', 'core.arena_corner_mid', 'core.arena_corner_upper', 'core.arena_corner_attic_gate', 'core.arena_corner_tower'] as const;
const EIGHTH = Math.PI / 4;
/** The gatehouse tower's collision as phase 3 built it (a hash of its boxes, rounded to the micrometre). */
const TOWER_COLLISION = '0e7adc12155c98ea';

// ------------------------------------------------------------------ the pieces

describe('the gate corner pieces', () => {
  it('the gate is a tile option of the ground and attic storeys (same cells and ports), its own mirror image; the tower is a tile of its own', () => {
    for (const [plain, gate] of [
      ['core.arena_corner_ground', 'core.arena_corner_ground_gate'],
      ['core.arena_corner_attic', 'core.arena_corner_attic_gate'],
    ] as const) {
      const a = coreCatalog.get(plain)!;
      const b = coreCatalog.get(gate)!;
      expect(b.optionOf).toEqual({ tile: plain, option: 'gate' });
      expect(b.cells).toEqual(a.cells);
      expect(b.ports).toEqual(a.ports);
      expect(tileOptionsOf(plain).map((o) => [o.option, o.on, o.onTile])).toEqual([['gate', false, gate]]);
      expect(tileOptionsOf(gate).map((o) => [o.option, o.on, o.off])).toEqual([['gate', true, plain]]);
    }
    for (const id of TILES) expect(tileDiagonalMirror(coreCatalog.get(id)!), id).toBe(true);
    const tower = coreCatalog.get('core.arena_corner_tower')!;
    expect(tower.optionOf).toBeUndefined();
    expect(new Set(tower.cells.map((c) => c[2]))).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]));
    const piece = library.pieces.get(PIECE)!;
    expect(piece.parts.filter((p) => p.kind === 'tile').map((p) => p.kind === 'tile' && p.tile)).toEqual([...TILES]);
    expect(piece.parts[5]).toMatchObject({ kind: 'door', style: 'portcullis', yaw: EIGHTH, startOpen: true });
    expect(piece.mirror).toBe('free');
  });

  it("the inspector's Gate checkbox swaps the tile and keeps its place, turn and paint", () => {
    const placed: TilePlacement = { id: 't', tile: 'core.arena_corner_ground', x: 3, y: -2, z: 0, rotation: 2, surfaces: { floor: { material: 'core.pbr_travertine', tint: '#d8c8b0' } } };
    const doc = makeMap([placed]);
    const on = setTileOptionCommand(doc, ['t'], 'gate', true);
    if ('error' in on) throw new Error(on.error);
    const after = applyCommand(doc, on).classicStructure.tiles[0]!;
    expect(after).toEqual({ ...placed, tile: 'core.arena_corner_ground_gate' });
    const off = setTileOptionCommand(applyCommand(doc, on), ['t'], 'gate', false);
    if ('error' in off) throw new Error(off.error);
    expect(applyCommand(applyCommand(doc, on), off).classicStructure.tiles[0]).toEqual(placed);
  });

  it('a gate corner with its tower collides as well under 2,700 boxes and brings at most 18 lights', () => {
    const map = played(gateMap(0));
    const geo = cornerBoxes(buildMapGeometry(map));
    const decor = cornerBoxes(buildMapDecor(map));
    const counts = TILES.map((_, i) => geo.filter((b) => b.sourceId === `sp_corner_${i}`).length);
    const trim = TILES.map((_, i) => decor.filter((b) => b.sourceId === `sp_corner_${i}`).length);
    const lights = map.entities.filter((e) => e.kind === 'light' && e.id.startsWith('sp_corner_')).length;
    const total = counts.reduce((a, b) => a + b, 0);
    console.log(`arena corner gate: collision ${counts.join(' + ')} = ${total}; trim ${trim.join(' + ')} = ${trim.reduce((a, b) => a + b, 0)}; lights ${lights}`);
    expect(total).toBeLessThan(2000);
    expect(lights).toBeLessThanOrEqual(18);
  });
  it("the tower's arrow slits and string course (owner, phase 3's 3a) are drawn only: its collision is phase 3's", () => {
    const map = played(gateMap(0));
    const geo = cornerBoxes(buildMapGeometry(map)).filter((b) => b.sourceId === 'sp_corner_4');
    const decor = cornerBoxes(buildMapDecor(map)).filter((b) => b.sourceId === 'sp_corner_4');
    // (Phase 3's tower: 291 boxes, hashed to the micrometre.)
    const r = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
    const key = geo.map((b) => [b.min.map(r), b.max.map(r), b.kind, r(b.yaw ?? 0)]);
    expect(geo.length).toBe(291);
    expect(createHash('sha256').update(JSON.stringify(key)).digest('hex').slice(0, 16)).toBe(TOWER_COLLISION);
    // Sixteen dark slits (two on the outer face and one on each side, at four heights) and the course's four bands.
    const slits = decor.filter((b) => b.surface?.material === 'core.pbr_castle_stone');
    expect(slits.length).toBe(16);
    for (const s of slits) expect(s.max[1] - s.min[1]).toBeCloseTo(1.6, 6);
    const course = decor.filter((b) => !b.surface && Math.abs(b.min[1] - 31.7) < 1e-6 && Math.abs(b.max[1] - 32) < 1e-6);
    expect(course.length).toBe(4);
  });
});

// ------------------------------------------------------------------ in all four turns

describe.each([0, 1, 2, 3] as Rotation[])('the gate corner between straight stands, turned %i', (k) => {
  const map = played(gateMap(k));
  let nav: NavWorld;
  beforeAll(() => {
    nav = navOf(map);
    return () => nav.destroy();
  });

  it('bots walk from the sand through the gate passage, out through the facade and the foot of the tower', () => {
    const from = onDiagonal(k, 0, -6, 0);
    for (const v of [12, 30, 52, 65.9]) {
      const to = onDiagonal(k, 0, v, 0);
      const path = route(nav, from, to);
      expect(path, `to depth ${v}`).not.toBeNull();
      // Along the passage on the ground, not round by the stands or the galleries.
      for (const p of inDiagonal(k, path!)) expect(p.y, `depth ${v}: ${JSON.stringify(p)}`).toBeLessThan(0.6);
      expect(pathLength(path!), `depth ${v}`).toBeLessThan((v + 6) * 1.15 + 2);
    }
    // And on out of the tower's gate into the court: nothing in the way.
    const [dx, dz] = rotateXZ(Math.SQRT1_2, Math.SQRT1_2, k);
    expect(physicsOf(map).raycastHit(onDiagonal(k, 0, 50, 1.5), { x: dx, y: 0, z: dz }, 30)).toBeNull();
  });

  it('bots go down each stair well from the passage to the hypogeum a level below, and up again', () => {
    const passage = onDiagonal(k, 0, 26, 0);
    const corner = at(k, 32, -4, 32);
    for (const s of [-1, 1]) {
      // From each well's head (beside the passage) to the ring's corner, by that well: down its flight, not round.
      const head = onDiagonal(k, 3.3 * s, 30.2, 0);
      const down = route(nav, head, corner);
      expect(down, `the ${s < 0 ? 'west' : 'east'} well`).not.toBeNull();
      expect(pathLength(down!)).toBeLessThan(20);
      expect(route(nav, corner, head), `up the ${s < 0 ? 'west' : 'east'} well`).not.toBeNull();
      // Its foot landing, square to the grid, reaches the crossing's arm.
      const foot = s < 0 ? at(k, 32, -4, 37.4) : at(k, 37.4, -4, 32);
      expect(route(nav, foot, corner), `the ${s < 0 ? 'west' : 'east'} foot landing`).not.toBeNull();
    }
    const both = route(nav, passage, corner);
    expect(both, 'from the passage').not.toBeNull();
    expect(pathLength(both!)).toBeLessThan(24);
  });

  it('bots climb the tower to every landing and the lookout, and step off onto the arcades, the attic walk and its roof', () => {
    const foot = onDiagonal(k, 0, 60, 0);
    for (let y = 4; y <= 32; y += 4) {
      const landing = onDiagonal(k, 0, 57.4, y);
      const path = route(nav, foot, landing);
      expect(path, `the landing at ${y} m`).not.toBeNull();
      // Up the switchbacks, about 13 m of walking a storey.
      expect(pathLength(path!), `the landing at ${y} m`).toBeLessThan(10 + (y / 4) * 16);
    }
    // The lookout's far corner, over the core.
    expect(route(nav, foot, onDiagonal(k, 0, 64, 32)), 'the lookout').not.toBeNull();
    // Off the landings through the facade: the arcade storeys (8 and 16 m), the attic walk (24 m) and its roof (28 m).
    for (const [y, v] of [[8, 52], [16, 52], [24, 52], [28, 52]] as const) {
      const off = route(nav, onDiagonal(k, 0, 57.4, y), onDiagonal(k, 0, v, y));
      expect(off, `off the landing at ${y} m`).not.toBeNull();
      expect(pathLength(off!), `off the landing at ${y} m`).toBeLessThan(10);
    }
  });

  it('bots climb the podium stairs either side of the gate, onto the podium walkway and up the seats', () => {
    for (const s of [-1, 1]) {
      const side = s < 0 ? 'west' : 'east';
      const sand = onDiagonal(k, 5 * s, -5, 0);
      const walkway = onDiagonal(k, 10 * s, 1.2, 2);
      const path = route(nav, sand, walkway);
      expect(path, `the ${side} podium stair`).not.toBeNull();
      // Up that stair (on its steps, in front of the podium wall), not round by the gate and the stands.
      expect(inDiagonal(k, path!).some((p) => p.v < 0 && p.y > 0.6 && Math.abs(p.u) < 8.2), `the ${side} podium stair`).toBe(true);
      expect(pathLength(path!), `the ${side} podium stair`).toBeLessThan(16);
      const top = route(nav, sand, onDiagonal(k, 10 * s, 7.4, 4));
      expect(top, `the ${side} top walkway`).not.toBeNull();
      expect(pathLength(top!), `the ${side} top walkway`).toBeLessThan(24);
    }
  });

  it('bots go from the sand through the gate passage into the ground gallery and up each gallery stair (phase 5) into the middle gallery, and back', () => {
    const sand = onDiagonal(k, 0, -6, 0);
    for (const s of [-1, 1]) {
      const side = s < 0 ? 'west' : 'east';
      const mid = onDiagonal(k, 10 * s, 29, 8);
      const up = route(nav, sand, mid);
      expect(up, `up the ${side} stair`).not.toBeNull();
      // On that stair's flights (in the fill behind the ground gallery, between the floors), not round by another way.
      const onStair = (p: { u: number; v: number; y: number }) => p.u * s > 4.9 && p.u * s < 15.4 && p.v > 16 && p.v < 27 && p.y > 0.6 && p.y < 7.6;
      expect(inDiagonal(k, up!).some(onStair), `up the ${side} stair`).toBe(true);
      expect(pathLength(up!), `up the ${side} stair`).toBeLessThan(70);
      const down = route(nav, mid, sand);
      expect(down, `down the ${side} stair`).not.toBeNull();
      expect(inDiagonal(k, down!).some(onStair), `down the ${side} stair`).toBe(true);
    }
  });

  it('the 45° portcullis blocks its own slab when shut and lets bots through when open', () => {
    const shut = new Match(played(gateMap(k), true), undefined, 1);
    const [b] = shut.scenario.blockers(null);
    expect(b, 'a blocker').toBeDefined();
    expect(b!.obox!.half.x).toBeCloseTo(1.5, 6);
    expect(Math.abs(Math.sin(b!.obox!.yaw - EIGHTH - (k * Math.PI) / 2))).toBeLessThan(1e-6);
    const through = [onDiagonal(k, 0, -1, 1), onDiagonal(k, 0, 3, 1)] as const;
    expect(segmentHitsAabb(through[0], through[1], b!)).toBe(true);
    // At the foot of the podium stair beside it: clear (its bounds alone would block it).
    expect(segmentHitsAabb(onDiagonal(k, -3.2, -2, 1), onDiagonal(k, -3.2, -0.2, 1), b!)).toBe(false);
    // Spawns keep out of the slab, not out of the passage beside it.
    expect(shut.scenario.inShutDoor(onDiagonal(k, 0, 1, 0), 0.4)).toBe(true);
    expect(shut.scenario.inShutDoor(onDiagonal(k, 0, 2.2, 0), 0.4)).toBe(false);
    const open = new Match(played(gateMap(k)), undefined, 1);
    expect(open.scenario.blockers(null)).toEqual([]);
    expect(route(open.nav, onDiagonal(k, 0, -4, 0), onDiagonal(k, 0, 6, 0)), 'through the open gate').not.toBeNull();
  });

  it('no coplanar faces left drawn twice, in the gate corner, its tower or where it meets the straight bays', () => {
    const boxes = [...buildMapGeometry(map), ...buildMapDecor(map)];
    const left = coplanarOverlaps(boxes, { faces: visibleFaces(boxes) });
    expect(left.slice(0, 5).map((o) => `${boxes[o.a]!.kind} ${boxes[o.a]!.sourceId} / ${boxes[o.b]!.kind} ${boxes[o.b]!.sourceId} at ${o.center.map((v) => v.toFixed(2))} (${o.area.toFixed(3)} m²)`)).toEqual([]);
  });
});

// ------------------------------------------------------------------ the gate's buttons

describe('a bot raises the 45° portcullis', () => {
  it.each([0, 1, 2, 3] as Rotation[])('turned %i: shut, with its chain button on the sand, a bot after a gun in the passage presses the button and goes through', (k) => {
    const doc = gateMap(k);
    // The chain on the sand beside the gate's mouth (as Flavius Rule's), facing the sand; the gun behind the gate.
    const chain = onDiagonal(k, -2.3, -0.4, 0);
    doc.entities.push(
      { id: 'button_chain', kind: 'button', position: [chain.x, 0, chain.z], yaw: (Math.PI * 5) / 4 - (k * Math.PI) / 2, label: 'Raise / lower the portcullis', once: false, cooldownSeconds: 2, startEnabled: true } as MapEntity,
      { id: 'gun_1', kind: 'pickup', position: [onDiagonal(k, 0, 10, 0).x, 0, onDiagonal(k, 0, 10, 0).z], item: 'core.weapon_shotgun', respawnSeconds: null } as MapEntity,
    );
    doc.logic.rules.push({ id: 'rule_chain', name: '', enabled: true, once: false, if: [], when: { event: 'button_pressed', target: 'button_chain' }, do: [{ type: 'door_toggle', target: DOOR, value: 0, text: '', state: '' }] });
    const match = new Match(played(doc, true), undefined, 7);
    const bot = match.addBot('b', { ...CORE_BOT_PROFILES[0]!, exploration: 100 })!;
    const start = onDiagonal(k, 0, -10, 0);
    bot.move = { pos: start, velY: 0, grounded: true };
    let deepest = -Infinity;
    for (let t = 0; t < TICK_RATE * 40 && deepest < 4; t++) {
      match.step();
      if (bot.alive) deepest = Math.max(deepest, inDiagonal(k, [bot.move.pos])[0]!.v);
    }
    expect(match.scenario.doorOpen(DOOR)).toBeGreaterThan(0.5);
    expect(deepest).toBeGreaterThan(4);
  });
});

// ------------------------------------------------------------------ on terrain

describe('the stair wells on terrain', () => {
  it("the gate's bore takes the ground out of each well: bots still go down to the hypogeum", () => {
    const map = played(gateMap(0, { terrain: true }));
    const physics = physicsOf(map);
    for (const s of [-1, 1]) {
      // Straight down in the well's flight, half way: the step (about -2 m), not the ground at 0.
      const p = onDiagonal(0, 3.3 * s, 25, 1);
      const hit = physics.raycastHit(p, { x: 0, y: -1, z: 0 }, 10);
      expect(hit, `the ${s < 0 ? 'west' : 'east'} well`).not.toBeNull();
      expect(1 - hit!.dist).toBeLessThan(-1.5);
    }
    const nav = navOf(map);
    expect(route(nav, onDiagonal(0, 0, 26, 0), at(0, 32, -4, 32))).not.toBeNull();
    nav.destroy();
  });
});

describe("the stair wells have a room's height over every step (owner, 2026-11-19: a stair going down needed a crouch)", () => {
  it('3.7 m clear over each step of both wells, as the clock tower; the head landing too', () => {
    const map = played(gateMap(0));
    const physics = physicsOf(map);
    for (const s of [-1, 1]) {
      // The flight: 16 steps of 0.25 by 0.5 m up the diagonal's depth from v 21 (level -1) to its head at 29 (the
      // passage's floor, 0); u 2.1 to 4.5 from the centre line.
      for (let i = 0; i < 16; i++) {
        const top = -4 + 0.25 * (i + 1);
        for (const u of [2.3, 3.3, 4.3]) {
          for (const v of [21.1 + 0.5 * i, 21.4 + 0.5 * i]) {
            const up = physics.raycastWorld(onDiagonal(0, u * s, v, top + 0.05), { x: 0, y: 1, z: 0 }, 10);
            expect((up ?? 10) + 0.05, `${s < 0 ? 'west' : 'east'} well, step ${i} at u ${u}, v ${v}`).toBeGreaterThanOrEqual(3.7 - 1e-3);
          }
        }
      }
      const head = physics.raycastWorld(onDiagonal(0, 3.3 * s, 30.2, 0.05), { x: 0, y: 1, z: 0 }, 10);
      expect((head ?? 10) + 0.05).toBeGreaterThanOrEqual(3.7 - 1e-3);
    }
  });

  it('a large body (the tallest) walks down each well standing, from the head landing to the foot', () => {
    const map = played(gateMap(0));
    const physics = physicsOf(map);
    const scale = BODY_SIZES.large.scale;
    for (const s of [-1, 1]) {
      const collider = physics.createPlayerCollider();
      const from = onDiagonal(0, 3.3 * s, 30.4, 0);
      const to = onDiagonal(0, 3.3 * s, 20.6, -4);
      let st: MoveState = { pos: { ...from, y: 0.02 }, velY: 0, grounded: true };
      for (let t = 0; t < TICK_RATE * 6 && Math.hypot(st.pos.x - to.x, st.pos.z - to.z) > 0.3; t++) {
        st = stepMovement(physics, collider, st, { ...emptyInput(t), forward: 1, yaw: Math.atan2(to.x - st.pos.x, to.z - st.pos.z) }, 1, undefined, 1, { scale });
      }
      expect(Math.hypot(st.pos.x - to.x, st.pos.z - to.z), `${s < 0 ? 'west' : 'east'} well: reached the foot (at ${st.pos.x.toFixed(2)}, ${st.pos.y.toFixed(2)}, ${st.pos.z.toFixed(2)})`).toBeLessThan(0.5);
      expect(st.pos.y).toBeLessThan(-3.5);
      physics.removeCollider(collider);
    }
  });
});

// ------------------------------------------------------------------ mirror, overlap, explode

/** The axes of a box in the world and its centre, from its corners. */
function frame(b: WorldBox): { c: number[]; axes: number[][]; half: number[] } {
  const p = boxCorners(b);
  const c = [0, 1, 2].map((k) => p.reduce((s, q) => s + q[k]!, 0) / 8);
  const axes: number[][] = [];
  const half: number[] = [];
  for (const i of [1, 2, 4]) {
    const e = [0, 1, 2].map((k) => p[i]![k]! - p[0]![k]!);
    const len = Math.hypot(e[0]!, e[1]!, e[2]!);
    axes.push(e.map((v) => v / (len || 1)));
    half.push(len / 2);
  }
  return { c, axes, half };
}
const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
/** Whether two boxes' insides overlap by more than 2 mm (separating axes). */
function overlaps(a: WorldBox, b: WorldBox): boolean {
  const A = frame(a);
  const B = frame(b);
  const d = [0, 1, 2].map((k) => B.c[k]! - A.c[k]!);
  const axes = [...A.axes, ...B.axes];
  for (const u of A.axes) for (const v of B.axes) {
    const w = cross(u, v);
    const n = Math.hypot(w[0]!, w[1]!, w[2]!);
    if (n > 1e-6) axes.push(w.map((x) => x / n));
  }
  for (const n of axes) {
    const ra = A.axes.reduce((s, ax, i) => s + A.half[i]! * Math.abs(dot(ax, n)), 0);
    const rb = B.axes.reduce((s, ax, i) => s + B.half[i]! * Math.abs(dot(ax, n)), 0);
    if (Math.abs(dot(d, n)) >= ra + rb - 0.002) return false;
  }
  return true;
}

describe('the gate set piece mirrored, stacked and exploded', () => {
  it('mirrored, it is the same gate corner turned: the same boxes, trim, lights and door', () => {
    for (const r of [0, 1, 2, 3] as Rotation[]) {
      // Mirrored over its footprint (dx 0..8) it is the corner turned three more quarters, its anchor at the far end of its first row.
      const [dx, dy] = rotateXZ(8, 0, r);
      const one = (p: Partial<SetPiecePlacement>) => {
        const map = makeMap([], [[-150, 0, -150]]);
        return played({ ...map, setPieces: [{ id: 'corner', piece: PIECE, x: 0, y: 0, z: 0, rotation: r, mirror: false, ...p }] });
      };
      const mirrored = one({ mirror: true });
      const turned = one({ x: dx, y: dy, rotation: ((r + 3) % 4) as Rotation });
      expect(buildMapGeometry(mirrored).map(shape).sort()).toEqual(buildMapGeometry(turned).map(shape).sort());
      expect(buildMapDecor(mirrored).map(shape).sort()).toEqual(buildMapDecor(turned).map(shape).sort());
      const things = (m: MapDocument) =>
        m.entities
          .filter((e) => e.kind === 'light' || e.kind === 'door')
          .map((e) => `${e.kind} ${e.position.map((v) => v.toFixed(2)).join(',')}`)
          .sort();
      expect(things(mirrored)).toEqual(things(turned));
    }
  });

  it('its five tiles overlap nowhere', () => {
    const boxes = buildMapGeometry(played(gateMap(0)));
    const byTile = TILES.map((_, i) => boxes.filter((b) => b.sourceId === `sp_corner_${i}`));
    for (let i = 0; i < TILES.length - 1; i++) {
      for (let j = i + 1; j < TILES.length; j++) {
        const clash = byTile[i]!.flatMap((a) => byTile[j]!.filter((b) => overlaps(a, b)).map((b) => `${shape(a)} / ${shape(b)}`));
        expect(clash.slice(0, 3), `${TILES[i]} and ${TILES[j]}`).toEqual([]);
      }
    }
  });

  it('explodes into its five tiles, its door and its lights, building the same as the set piece', () => {
    const doc = gateMap(1);
    const r = explodeSetPieceCommand(doc, 'corner');
    if ('error' in r) throw new Error(r.error);
    const exploded = played(applyCommand(doc, r.command));
    const asPlayed = played(doc);
    expect(exploded.classicStructure.tiles.filter((t) => t.tile.startsWith('core.arena_corner_')).length).toBe(5);
    expect(exploded.entities.filter((e) => e.kind === 'door' && e.style === 'portcullis').length).toBe(1);
    expect(buildMapGeometry(exploded).map(shape).sort()).toEqual(buildMapGeometry(asPlayed).map(shape).sort());
  });
});
