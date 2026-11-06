// Set pieces part 3 (docs/SET_PIECES_PLAN.md, "As built: part 3"): the pieces MAP 21 and the Sandfall Colosseum need,
// in play. The sunken trenches carve the terrain under them, players and bots move along them and out of their ends,
// crouched cover holds and the fire step clears the parapet; the casemate's embrasure is a gun port, not a way in,
// and its rooms loop; the cliff stairs climb; the colosseum's stands stack and their galleries, vomitoria and aisles
// connect; the hypogeum's tunnels, cages and hatches; the insulae and stair towers reach every floor. What every piece
// shares (turns, mirrors, packs, ids, the z-fight audit, every port of the walled pieces) is setPieceExpand.test.ts
// and setPiecePlay.test.ts; collision and navigation built from the expansion equal the exploded map's here.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  PLAYER,
  PhysicsWorld,
  STANCES,
  applyCommand,
  buildMapDecor,
  buildMapGeometry,
  buildOccupancy,
  builtInSetPieces,
  emptyInput,
  explodeSetPieceCommand,
  initPhysics,
  loadMap,
  mapTerrainMesh,
  navLinks,
  newTerrain,
  resolveEdge,
  serializeMap,
  setPieceFootprint,
  stepMovement,
  terrainHeightAt,
  type MapDocument,
  type MoveState,
  type Rotation,
  type SetPiecePlacement,
  type TilePlacement,
  type Vec3,
} from '../src/index.ts';
import { NavWorld, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const library = builtInSetPieces();
type PieceIn = Omit<SetPiecePlacement, 'mirror' | 'rotation'> & Partial<Pick<SetPiecePlacement, 'mirror' | 'rotation'>>;
const tileAt = (id: string, tile: string, x: number, y: number, z = 0, rotation: Rotation = 0): TilePlacement => ({ id, tile, x, y, z, rotation });

/** A map of these tiles and set pieces in a theme, with flat terrain at 0 when asked (the spawn far off on the ground). */
function mapOf(tiles: TilePlacement[], pieces: PieceIn[], theme: string, terrain = false): MapDocument {
  const map = makeMap(tiles.length ? tiles : [tileAt('home', 'core.room', -20, -20)], [[-160, 0, -160]]);
  return {
    ...map,
    classicStructure: { ...map.classicStructure, theme },
    setPieces: pieces.map((p) => ({ ...p, rotation: p.rotation ?? 0, mirror: p.mirror ?? false })),
    ...(terrain ? { terrain: newTerrain(200, 2, [0, 0], 'grass') } : {}),
  };
}

const played = (doc: MapDocument): MapDocument => {
  const r = loadMap(serializeMap(doc));
  if (!r.ok) throw new Error(r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; '));
  return r.map;
};

/** The physics world of a played map: its boxes and its terrain. */
const physicsOf = (map: MapDocument) => new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
/** Its navigation: boxes, terrain and the links ladders give. */
function navOf(map: MapDocument): NavWorld {
  const physics = physicsOf(map);
  return NavWorld.build(buildMapGeometry(map), mapTerrainMesh(map), navLinks(map.entities, physics));
}

/** Walk (or crouch-walk) along `yaw` for `ticks` from `from`. */
function walk(physics: PhysicsWorld, from: Vec3, yaw: number, ticks = 300): MoveState {
  const collider = physics.createPlayerCollider();
  let s: MoveState = { pos: { ...from }, velY: 0, grounded: true };
  for (let i = 0; i < ticks; i++) s = stepMovement(physics, collider, s, { ...emptyInput(i), forward: 1, yaw });
  physics.removeCollider(collider);
  return s;
}

/** A bot's path from a to b reaches b (within a metre). */
function reaches(nav: NavWorld, a: Vec3, b: Vec3): boolean {
  const path = nav.findPath(a, b);
  return !!path && Math.hypot(path.at(-1)!.x - b.x, path.at(-1)!.y - b.y, path.at(-1)!.z - b.z) < 1;
}

const NORTH = 0;
const EAST = Math.PI / 2;
const SOUTH = Math.PI;
const WEST = -Math.PI / 2;

// ------------------------------------------------------------------ MAP 21: the trench run

describe('the trench run: sunk into the terrain, a way along it, cover in it', () => {
  // West to east along y 0: an end (steps up west), a fire bay, a sandbag fire bay, a junction (a branch north to an end),
  // the jog round a traverse (to y 1), a bend north and an end (steps up north).
  const pieces: PieceIn[] = [
    { id: 'tr_end_w', piece: 'setpiece.trench_end', x: -3, y: 0, z: 0, rotation: 2 },
    { id: 'tr_bay_1', piece: 'setpiece.trench_straight', x: -2, y: 0, z: 0 },
    { id: 'tr_bay_2', piece: 'setpiece.trench_straight_sandbag', x: -1, y: 0, z: 0, mirror: true },
    { id: 'tr_junc', piece: 'setpiece.trench_junction', x: 0, y: 0, z: 0 },
    { id: 'tr_branch', piece: 'setpiece.trench_straight', x: 0, y: 1, z: 0, rotation: 1 },
    { id: 'tr_branch_end', piece: 'setpiece.trench_end', x: 0, y: 2, z: 0, rotation: 3 },
    { id: 'tr_jog', piece: 'setpiece.trench_jog_sandbag', x: 1, y: 0, z: 0 },
    { id: 'tr_bend', piece: 'setpiece.trench_bend', x: 3, y: 1, z: 0 },
    { id: 'tr_end_n', piece: 'setpiece.trench_end', x: 3, y: 2, z: 0, rotation: 3 },
  ];
  const doc = mapOf([], pieces, 'core.military', true);
  const map = played(doc);

  it('carves its slot: the terrain under every channel lies below the channel floor; round the trench it meets the ground slabs', () => {
    const t = map.terrain!;
    const occupied = buildOccupancy(map).cells;
    let channel = 0;
    let edge = 0;
    for (let gx = -4; gx <= 4; gx++) {
      for (let gy = -1; gy <= 3; gy++) {
        const occ = occupied.get(`${gx},${gy},0`);
        if (!occ || !occ.def.id.startsWith('core.trench_sunk')) continue;
        // Over the cell, on a 0.25 m grid: wherever the channel's floor is, the terrain is under it.
        const floors = buildMapGeometry(map).filter((b) => b.sourceId === occ.placement.id && b.kind === 'floor' && b.max[1] < -1.4 && b.max[1] > -1.6);
        for (let x = gx * 8 - 3.9; x < gx * 8 + 4; x += 0.25) {
          for (let z = gy * 8 - 3.9; z < gy * 8 + 4; z += 0.25) {
            if (!floors.some((f) => x >= f.min[0] && x <= f.max[0] && z >= f.min[2] && z <= f.max[2])) continue;
            expect(terrainHeightAt(t, x, z)!, `${occ.def.id} at ${x.toFixed(2)}, ${z.toFixed(2)}`).toBeLessThan(-1.5);
            channel++;
          }
        }
        // At the cell's edge beside the channel the ground is just under the earth slabs (no step to the terrain round it).
        const [cx, cz] = [gx * 8, gy * 8];
        for (const [x, z] of [[cx - 4, cz - 3.5], [cx + 4, cz + 3.5], [cx - 3.5, cz - 4]]) {
          const h = terrainHeightAt(t, x!, z!)!;
          if (h < -0.4) continue;
          expect(h, `${occ.def.id}: the edge at ${x}, ${z}`).toBeGreaterThan(-0.4);
          expect(h).toBeLessThan(0.01);
          edge++;
        }
      }
    }
    expect(channel).toBeGreaterThan(2000);
    expect(edge).toBeGreaterThan(10);
    // Away from the trench the ground is untouched.
    expect(terrainHeightAt(t, -40, 30)).toBe(0);
  });

  it('players walk in at an end, along the fire bays and out at the far end of the branch', () => {
    const physics = physicsOf(map);
    // From the ground west of the west end, east down its steps and along the channel (z 0.5: the clear floor, north of
    // the fire step), past the junction.
    const along = walk(physics, { x: -34, y: 0.05, z: 0.8 }, EAST, 420);
    expect(along.pos.x, 'walked down into the trench and along it').toBeGreaterThan(-4);
    expect(along.pos.y, 'down in the channel').toBeLessThan(-1.2);
    // Up the branch's end (steps north) out onto the ground.
    const out = walk(physics, { x: 0, y: -1.45, z: 10 }, NORTH, 360);
    expect(out.pos.z, 'out at the end').toBeGreaterThan(20);
    expect(out.pos.y, 'back on the ground').toBeGreaterThan(-0.2);
  });

  it("bots' paths run from the ground at one end, along the trench, round the jog and the bend, to the ground at the other", () => {
    const nav = navOf(map);
    const westGround: Vec3 = { x: -33, y: 0, z: 0 };
    expect(reaches(nav, westGround, { x: 24, y: -1.5, z: 8.6 }), 'into the jog\'s fire bay').toBe(true);
    expect(reaches(nav, westGround, { x: 24, y: 0, z: 30 }), 'out of the north end').toBe(true);
    expect(reaches(nav, westGround, { x: 0, y: 0, z: 22 }), 'out of the branch').toBe(true);
    // The path stays in the trench: it never climbs out between the ends.
    const path = nav.findPath(westGround, { x: 9, y: -1.5, z: 7 })!;
    for (const p of path) if (p.x > -22 && p.x < 4 && Math.abs(p.z) < 3) expect(p.y, JSON.stringify(p)).toBeLessThan(-0.7);
    nav.destroy();
  });

  it('crouched cover holds from the front and the rear; standing on the fire step your eyes clear the parapet', () => {
    const physics = physicsOf(map);
    const crouch = STANCES[1];
    // A crouched player on the channel floor of a fire bay (x -16) is hidden from the front, the rear and slantwise;
    // one crouched on its fire step (up at the parapet) from the front.
    const front = [{ x: -16, y: 1.6, z: -30 }, { x: -10, y: 1.6, z: -12 }, { x: -24, y: 1.6, z: -18 }];
    const rear = [{ x: -16, y: 1.6, z: 30 }, { x: -22, y: 1.6, z: 14 }];
    for (const [z, feet, sides] of [[0.8, -1.5, [...front, ...rear]], [-1.7, -0.75, front]] as const) {
      const head = { x: -16, y: feet + crouch.height + 0.12, z };
      for (const from of sides) {
        const d = { x: head.x - from.x, y: head.y - from.y, z: head.z - from.z };
        const len = Math.hypot(d.x, d.y, d.z);
        const hit = physics.raycastHit(from, { x: d.x / len, y: d.y / len, z: d.z / len }, len);
        expect(hit, `crouched at z ${z}: seen from ${JSON.stringify(from)}`).not.toBeNull();
      }
    }
    // Standing in the channel your head is under the parapet's top seen from the front.
    const standing = { x: -16, y: -1.5 + PLAYER.height + 0.12, z: 0.8 };
    const ahead = front[0]!;
    const d = { x: 0, y: standing.y - ahead.y, z: standing.z - ahead.z };
    const len = Math.hypot(d.y, d.z);
    expect(physics.raycastHit(ahead, { x: 0, y: d.y / len, z: d.z / len }, len), 'standing in the channel, hidden from the front').not.toBeNull();
    // On the fire step (0.75 m), eyes 1.6 m up: out over the parapet to the ground 20 m in front.
    const eye = { x: -16, y: -0.75 + PLAYER.eyeHeight, z: -1.7 };
    const target = { x: -16, y: 0.4, z: -22 };
    const e = { x: 0, y: target.y - eye.y, z: target.z - eye.z };
    const el = Math.hypot(e.y, e.z);
    expect(physics.raycastHit(eye, { x: 0, y: e.y / el, z: e.z / el }, el), 'from the fire step over the parapet').toBeNull();
  });
});

// ------------------------------------------------------------------ MAP 21: the casemate

describe('the gun casemate: an embrasure to shoot through, two ways in, no dead ends', () => {
  const doc = mapOf([tileAt('ground', 'core.yard', -6, -6)], [{ id: 'casemate', piece: 'setpiece.casemate', x: 0, y: 0, z: 0, pack: 'military' }], 'core.military', true);
  const map = played(doc);

  it('shots go out of the embrasure beside the gun and in from the beach; players cannot climb in through it', () => {
    const physics = physicsOf(map);
    // From inside the gun room (centred 0, 8), beside the gun's shield, out through the slot (sill 0.9, head 2.0 at z 4).
    for (const x of [-1.5, 1.5]) {
      const hit = physics.raycastHit({ x, y: 1.5, z: 6 }, { x: 0, y: 0, z: -1 }, 30);
      expect(hit === null || hit.dist > 29, `out at x ${x}: stopped at ${hit?.dist}`).toBe(true);
    }
    // From the beach (30 m out) in through the slot into the room.
    const hit = physics.raycastHit({ x: 1.5, y: 1.5, z: -26 }, { x: 0, y: 0, z: 1 }, 40);
    expect(hit!.dist, 'in through the embrasure to the back wall').toBeGreaterThan(30);
    // The wall either side and under it stops shots.
    expect(physics.raycastHit({ x: 3.0, y: 1.5, z: -26 }, { x: 0, y: 0, z: 1 }, 40)!.dist).toBeLessThan(30.5);
    expect(physics.raycastHit({ x: 0.5, y: 0.5, z: -26 }, { x: 0, y: 0, z: 1 }, 40)!.dist).toBeLessThan(30.5);
    // Walking into it from in front: stopped at the wall.
    expect(walk(physics, { x: 1.5, y: 0.05, z: -10 }, NORTH, 300).pos.z).toBeLessThan(3.6);
  });

  it('two ways in, and every room has two ways out (a loop): bots go round it both ways', () => {
    const nav = navOf(map);
    const rear: Vec3 = { x: 0, y: 0, z: 24 };
    const side: Vec3 = { x: 16, y: 0, z: 8 };
    const rooms: Record<string, Vec3> = { gun: { x: -2, y: 0, z: 9 }, ammo: { x: 6, y: 0, z: 9 }, hall: { x: 0, y: 0, z: 16 }, crew: { x: 6, y: 0, z: 15 } };
    for (const [name, at] of Object.entries(rooms)) {
      expect(reaches(nav, rear, at), `rear door to the ${name} room`).toBe(true);
      expect(reaches(nav, side, at), `side door to the ${name} room`).toBe(true);
    }
    nav.destroy();
    // Each room cell has at least two passable sides (doorways or open), so clearing it never meets a dead end.
    const { cells } = buildOccupancy(map);
    for (const [gx, gy] of [[0, 1], [1, 1], [0, 2], [1, 2]]) {
      const ways = (['N', 'E', 'S', 'W'] as const).map((s) => resolveEdge(cells, gx!, gy!, 0, s)).filter((s) => s === 'door' || s === 'none');
      expect(ways.length, `room ${gx}, ${gy}`).toBeGreaterThanOrEqual(2);
    }
  });
});

// ------------------------------------------------------------------ MAP 21: the cliff stairs

describe('the cliff stairs: up a cliff for many players', () => {
  it('the grand stair: players climb both flights to the terrace; bots path up it; it is 15 m wide', () => {
    const map = played(mapOf([], [{ id: 'grand', piece: 'setpiece.cliff_stair_grand', x: 0, y: 0, z: 0, pack: 'military' }], 'core.military', true));
    const physics = physicsOf(map);
    // Up the middle (x 4) past the landing's barrier and between its sandbags; and up each side lane.
    for (const x of [1.5, 6.5]) {
      const end = walk(physics, { x, y: 0.05, z: -7 }, NORTH, 380);
      expect(end.pos.y, `lane x ${x}: up two levels`).toBeGreaterThan(7.9);
      expect(end.pos.z).toBeGreaterThan(20);
    }
    const nav = navOf(map);
    for (const x of [-2, 4, 10]) expect(reaches(nav, { x, y: 0, z: -8 }, { x: 4, y: 8, z: 23 }), `from x ${x}`).toBe(true);
    nav.destroy();
    // Shots run up the flights unhindered over the middle (no wall across the way up).
    const up = physicsOf(map).raycastHit({ x: 6, y: 1.6, z: -6 }, { x: 0, y: 0.4, z: 0.92 }, 16);
    expect(up === null || up.dist > 12).toBe(true);
  });

  it('the stair tower: bots path from the foot door to the head door, three levels up', () => {
    // A ledge outside the head door on level 3.
    const map = played(mapOf([tileAt('ledge', 'core.platform', 0, 1, 3)], [{ id: 'tower', piece: 'setpiece.cliff_stair_side', x: 0, y: 0, z: 0, pack: 'military' }], 'core.military', true));
    const nav = navOf(map);
    expect(reaches(nav, { x: 0, y: 0, z: -8 }, { x: 0, y: 12, z: 8 })).toBe(true);
    nav.destroy();
  });
});

// ------------------------------------------------------------------ Colosseum: the stands

/** One bay line of the stands, the arena to the south: the podium bay, two arcades under the upper tier, a vomitorium tier, the facade's arcades and the attic; then a bay either side so the rows continue. */
function stands(): PieceIn[] {
  const out: PieceIn[] = [];
  for (const x of [-1, 0, 1]) {
    out.push({ id: `podium_${x + 1}`, piece: 'setpiece.arena_bay_podium', x, y: 0, z: 0 });
    out.push({ id: `arc_a_${x + 1}`, piece: 'setpiece.arena_arcade', x, y: 2, z: 0 });
    out.push({ id: `arc_b_${x + 1}`, piece: 'setpiece.arena_arcade', x, y: 3, z: 0 });
    out.push({ id: `tier_${x + 1}`, piece: x === 0 ? 'setpiece.arena_vomitorium' : 'setpiece.arena_bay_tier', x, y: 2, z: 2 });
    out.push({ id: `face_a_${x + 1}`, piece: 'setpiece.arena_arcade', x, y: 4, z: 0 });
    out.push({ id: `face_b_${x + 1}`, piece: 'setpiece.arena_arcade', x, y: 4, z: 2 });
    out.push({ id: `attic_${x + 1}`, piece: 'setpiece.arena_attic', x, y: 4, z: 4 });
  }
  return out;
}

describe('the colosseum stands: bays stack, and gallery, vomitorium and aisles connect', () => {
  const sand: TilePlacement[] = [-1, 0, 1].flatMap((x) => [tileAt(`sand_${x + 1}a`, 'core.yard', x, -1), tileAt(`sand_${x + 1}b`, 'core.yard', x, -2)]);
  const map = played(mapOf(sand, stands(), 'core.imperial'));

  it('from the podium walkway bots climb the aisles, through the vomitorium into the gallery and up to the attic walkway 16 m up', () => {
    const nav = navOf(map);
    const podiumTop: Vec3 = { x: 0, y: 4, z: 3.4 };
    expect(reaches(nav, podiumTop, { x: 0, y: 8, z: 24 }), "into the upper tier's gallery").toBe(true);
    expect(reaches(nav, podiumTop, { x: 0, y: 16, z: 32 }), 'up to the attic').toBe(true);
    expect(reaches(nav, { x: 0, y: 0, z: 8 }, { x: 8, y: 0, z: 16 }), 'along the ground gallery and out through its arch into the arcades').toBe(true);
    nav.destroy();
  });

  it('players walk out of the gallery through the vomitorium onto the walkway in front of the tier', () => {
    const physics = physicsOf(map);
    const end = walk(physics, { x: 0, y: 8.05, z: 25 }, SOUTH, 140);
    expect(end.pos.z, 'out of the passage').toBeLessThan(13.5);
    expect(end.pos.y).toBeGreaterThan(7.8);
    // Shots down the passage, and through the ground gallery's arch, the arcades' arches and out of the facade.
    const passage = physics.raycastHit({ x: 0, y: 9.5, z: 25 }, { x: 0, y: 0, z: -1 }, 11);
    expect(passage === null || passage.dist > 10.9).toBe(true);
    const arches = physics.raycastHit({ x: 0, y: 1.6, z: 7 }, { x: 0, y: 0, z: 1 }, 40);
    expect(arches === null || arches.dist > 39, `through the arches: stopped at ${arches?.dist}`).toBe(true);
  });

  it('the seats: rows of 0.5 m with the aisle meeting each; a player walks up the aisle', () => {
    const physics = physicsOf(map);
    // Up the podium cavea's aisle (x 0, z 4 to 12, 4 m to 8 m).
    const end = walk(physics, { x: -8, y: 4.05, z: 3.6 }, NORTH, 300);
    expect(end.pos.y, 'up the aisle').toBeGreaterThan(7.9);
  });
});

// ------------------------------------------------------------------ Colosseum: the hypogeum

describe('the hypogeum: tunnels, beast pens and hatch risers', () => {
  const floor: TilePlacement[] = [];
  const skip = new Set(['1,-1', '4,-2', '5,-2', '4,-1', '5,-1', '3,-2']);
  for (let x = -1; x <= 6; x++) for (let y = -3; y <= 1; y++) if (!skip.has(`${x},${y}`)) floor.push(tileAt(`sand_${x + 1}_${y + 3}`, 'core.yard', x, y, 0));
  const pieces: PieceIn[] = [
    { id: 'cages', piece: 'setpiece.cage_block', x: -1, y: 0, z: -1 },
    { id: 'junction', piece: 'setpiece.tunnel_junction', x: 1, y: 0, z: -1 },
    { id: 'hatch', piece: 'setpiece.tunnel_hatch', x: 1, y: -1, z: -1 },
    { id: 'straight', piece: 'setpiece.tunnel_straight', x: 2, y: 0, z: -1, rotation: 1 },
    { id: 'bend', piece: 'setpiece.tunnel_bend', x: 3, y: 0, z: -1, rotation: 1 },
    { id: 'cross', piece: 'setpiece.tunnel_cross', x: 3, y: -1, z: -1 },
    { id: 'corner_hatch', piece: 'setpiece.tunnel_hatch_corner', x: 4, y: -2, z: -1 },
    { id: 'lift', piece: 'setpiece.cage_lift', x: 3, y: -2, z: -1 },
  ];
  const map = played(mapOf(floor, pieces, 'core.imperial'));

  it('bots path along the tunnels from the pens to the corner hatch hall, and up the ladders into the arena', () => {
    const nav = navOf(map);
    const pens: Vec3 = { x: -8, y: -4, z: 0 };
    expect(reaches(nav, pens, { x: 24, y: -4, z: -8 }), 'to the crossing').toBe(true);
    expect(reaches(nav, pens, { x: 36, y: -4, z: -8 }), 'into the corner hatch hall').toBe(true);
    expect(reaches(nav, pens, { x: 8, y: 0, z: -12 }), 'up the hatch ladder onto the arena floor').toBe(true);
    nav.destroy();
  });

  it('players walk the tunnels; the pens\' bars stop them while shots pass between the bars', () => {
    const physics = physicsOf(map);
    // East along the pens' passage, through the junction and the straight tunnel to the bend.
    expect(walk(physics, { x: -10, y: -3.95, z: -1 }, EAST, 360).pos.x).toBeGreaterThan(20);
    // North from the passage into the bars beside the gate: stopped at the bars (z 4).
    expect(walk(physics, { x: -3, y: -3.95, z: 0 }, NORTH, 200).pos.z).toBeLessThan(3.95);
    let through = 0;
    for (let x = -3.9; x < -1.7; x += 0.05) if (!physics.raycastHit({ x, y: -2.5, z: 2 }, { x: 0, y: 0, z: 1 }, 6)) through++;
    expect(through, 'rays between the bars').toBeGreaterThan(20);
  });

  it('the corner hatch: four quarter holes open a 3.2 m hatch on the corner the four cells share', () => {
    const physics = physicsOf(map);
    // Corner of cells (4..5, -2..-1) at x 36, z -12: straight down through the hole to the hall floor 4 m below.
    expect(physics.raycastHit({ x: 36, y: 6, z: -12 }, { x: 0, y: -1, z: 0 }, 12)!.dist).toBeGreaterThan(9.9);
    for (const [dx, dz] of [[1.4, 1.4], [-1.4, 1.4], [1.4, -1.4], [-1.4, -1.4]]) expect(physics.raycastHit({ x: 36 + dx!, y: 6, z: -12 + dz! }, { x: 0, y: -1, z: 0 }, 12)!.dist).toBeGreaterThan(9.9);
    // Off the hole the arena floor holds.
    expect(physics.raycastHit({ x: 36 + 2.2, y: 6, z: -12 }, { x: 0, y: -1, z: 0 }, 12)!.dist).toBeCloseTo(6, 1);
  });
});

// ------------------------------------------------------------------ Colosseum: insulae and stair towers

describe('the insulae and the stair towers reach every floor', () => {
  it('in every insula bots go from the street through the entrance passage to every flat on every floor', () => {
    for (const piece of ['setpiece.insula', 'setpiece.insula_corner', 'setpiece.insula_tall']) {
      const def = library.pieces.get(piece)!;
      const map = played(mapOf([tileAt('street_a', 'core.yard', 1, -1), tileAt('street_b', 'core.yard', 0, -1), tileAt('street_c', 'core.yard', 2, -1)], [{ id: 'insula', piece, x: 0, y: 0, z: 0, pack: 'imperial' }], 'core.imperial'));
      const nav = navOf(map);
      const street: Vec3 = { x: 8, y: 0, z: -10 };
      // Storeys of flats: the pitched-roof insulae claim one more level for their roof.
      const top = piece === 'setpiece.insula_tall' ? 3 : 2;
      expect(def.footprint.levels[1]).toBe(3);
      for (let z = 1; z <= top; z++) for (const x of [0, 1, 2]) expect(reaches(nav, street, { x: x * 8, y: z * 4, z: 0 }), `${piece}: the flat ${x}, 0 on floor ${z}`).toBe(true);
      expect(reaches(nav, street, { x: top % 2 === 0 ? 0 : 16, y: top * 4, z: 8 }), `${piece}: the back flat at the top`).toBe(true);
      // The shops open on the street.
      expect(reaches(nav, street, { x: 0, y: 0, z: -2 }) && reaches(nav, street, { x: 16, y: 0, z: -2 }), `${piece}: the shops`).toBe(true);
      nav.destroy();
    }
  });

  it('a stair tower reaches its hall on every level, and a player walks out of the hall through its arches', () => {
    for (const levels of [4, 6, 8]) {
      const map = played(mapOf([tileAt('apron', 'core.yard', 1, -1)], [{ id: 'tower', piece: `setpiece.stair_tower_${levels}`, x: 0, y: 0, z: 0, pack: 'imperial' }], 'core.imperial'));
      const nav = navOf(map);
      for (let z = 0; z <= levels; z++) expect(reaches(nav, { x: 8, y: 0, z: -8 }, { x: 8, y: z * 4, z: 0 }), `${levels} levels: the hall on level ${z}`).toBe(true);
      nav.destroy();
      const physics = physicsOf(map);
      expect(walk(physics, { x: 8, y: 0.05, z: 0 }, SOUTH, 150).pos.z).toBeLessThan(-5);
    }
  });
});

// ------------------------------------------------------------------ the expansion is the exploded map

describe('part 3 pieces build what their exploded parts build', () => {
  it('collision, trim and navigation from the expansion equal those from the exploded map', () => {
    const pieces: PieceIn[] = [
      { id: 'casemate', piece: 'setpiece.casemate', x: 0, y: 0, z: 0, pack: 'military', mirror: true },
      { id: 'trench', piece: 'setpiece.trench_jog', x: 4, y: 0, z: 0, rotation: 1 },
      { id: 'grand', piece: 'setpiece.cliff_stair_grand', x: -4, y: 0, z: 0, rotation: 3 },
      { id: 'vomitorium', piece: 'setpiece.arena_vomitorium', x: 8, y: 0, z: 0, pack: 'imperial' },
      { id: 'cages', piece: 'setpiece.cage_block', x: 12, y: 0, z: 0, rotation: 2, mirror: true },
      { id: 'insula', piece: 'setpiece.insula_corner', x: 0, y: 8, z: 0, pack: 'desert', rotation: 1 },
      { id: 'tower', piece: 'setpiece.stair_tower_4', x: 8, y: 8, z: 0 },
      { id: 'hatch', piece: 'setpiece.tunnel_hatch_corner', x: 14, y: 8, z: 0 },
    ];
    const doc = mapOf([], pieces, 'core.military', true);
    for (const p of doc.setPieces!) expect(setPieceFootprint(p, library.pieces.get(p.piece)!).length).toBeGreaterThan(0);
    const asPlayed = played(doc);
    let exploded = doc;
    for (const p of doc.setPieces!) {
      const r = explodeSetPieceCommand(exploded, p.id);
      if ('error' in r) throw new Error(r.error);
      exploded = applyCommand(exploded, r.command);
    }
    const asExploded = played(exploded);
    expect(serializeMap(asExploded)).toBe(serializeMap(asPlayed));
    expect(buildMapGeometry(asExploded)).toEqual(buildMapGeometry(asPlayed));
    expect(buildMapDecor(asExploded)).toEqual(buildMapDecor(asPlayed));
    const a = navOf(asPlayed);
    const b = navOf(asExploded);
    for (const [from, to] of [
      [{ x: 0, y: 0, z: 24 }, { x: 8, y: 0, z: 9 }],
      [{ x: 64, y: 0, z: -8 }, { x: 64, y: 8, z: 24 }],
      [{ x: 64, y: 0, z: 72 }, { x: 64, y: 16, z: 64 }],
    ] as const) expect(a.findPath(from, to)).toEqual(b.findPath(from, to));
    a.destroy();
    b.destroy();
  });
});
