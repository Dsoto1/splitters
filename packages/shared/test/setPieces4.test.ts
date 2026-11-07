// MAP 21's last two set pieces (docs/SET_PIECES_PLAN.md, "As built: part 4"), in play: the command bunker (the round
// fort at the head of Iron Coast's village, Breakthrough's final hold) and the grand stair's gatehouse. Both have open
// sides (setPiecePlay.test.ts OPEN_SIDED), so their ways through are proved here, in every turn (and mirror, where a
// piece can be mirrored): players walk in through the fort's three gates and up the stair through the gate's arches;
// bots path in, up to the fort's roof and through the gate; the ring wall and the flanking walls stop them elsewhere;
// shots pass the slits and the arches and stop on the stone. What every piece shares (turns, packs, ids, the z-fight
// audit) is setPieceExpand.test.ts and setPiecePlay.test.ts.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  PhysicsWorld,
  applyCommand,
  buildMapDecor,
  buildMapGeometry,
  builtInSetPieces,
  emptyInput,
  explodeSetPieceCommand,
  initPhysics,
  loadMap,
  mapTerrainMesh,
  navLinks,
  newTerrain,
  rotateXZ,
  serializeMap,
  stepMovement,
  type MapDocument,
  type MoveState,
  type Rotation,
  type SetPiecePlacement,
  type Vec3,
} from '../src/index.ts';
import { NavWorld, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const library = builtInSetPieces();
const ROTATIONS = [0, 1, 2, 3] as Rotation[];

/** A map with one piece at (0, 0) on flat terrain at 0, in the Military Compound look. */
function withPiece(piece: string, rotation: Rotation, mirror = false): MapDocument {
  const map = makeMap([{ id: 'home', tile: 'core.room', x: -20, y: -20, z: 0, rotation: 0 }], [[-160, 0, -160]]);
  const p: SetPiecePlacement = { id: 'piece', piece, x: 0, y: 0, z: 0, rotation, mirror, pack: 'military' };
  const r = loadMap(serializeMap({ ...map, classicStructure: { ...map.classicStructure, theme: 'core.military' }, setPieces: [p], terrain: newTerrain(200, 2, [0, 0], 'grass') }));
  if (!r.ok) throw new Error(r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; '));
  return r.map;
}

/** A point of the piece's own frame where the placement puts it: mirrored over its footprint (W: its least plus greatest cell), then turned. */
function place(p: Vec3, rotation: Rotation, mirror: boolean, W: number): Vec3 {
  const x = mirror ? W * 8 - p.x : p.x;
  const [rx, rz] = rotateXZ(x, p.z, rotation);
  return { x: rx, y: p.y, z: rz };
}
/** A facing of the piece's own frame, placed the same way. */
const placeYaw = (yaw: number, rotation: Rotation, mirror: boolean) => (mirror ? -yaw : yaw) + (rotation * Math.PI) / 2;

const physicsOf = (map: MapDocument) => new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
function navOf(map: MapDocument): NavWorld {
  const physics = physicsOf(map);
  return NavWorld.build(buildMapGeometry(map), mapTerrainMesh(map), navLinks(map.entities, physics));
}

/** Walk along `yaw` for `ticks` from `from`. */
function walk(physics: PhysicsWorld, from: Vec3, yaw: number, ticks: number): MoveState {
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

// ------------------------------------------------------------------ the command bunker

describe('the command bunker: a round fort, three gates, the command room, the roof', () => {
  const ID = 'setpiece.command_bunker';
  /** The fort's centre in its own frame, and its gates (south-west, south-east, north-west) as angles round it. */
  const C = { x: 12, y: 0, z: 12 };
  const GATES = [225, 315, 135];
  const at = (deg: number, r: number, y = 0.05): Vec3 => ({ x: C.x + r * Math.cos((deg * Math.PI) / 180), y, z: C.z + r * Math.sin((deg * Math.PI) / 180) });
  const towardCentre = (deg: number) => Math.atan2(-Math.cos((deg * Math.PI) / 180), -Math.sin((deg * Math.PI) / 180));

  it('is a ring 31.6 m across round a 2 × 2 keep, in the Military Compound and Coastal Harbor looks', () => {
    const def = library.pieces.get(ID)!;
    expect(def.packs).toEqual(expect.arrayContaining(['military', 'harbor']));
    expect(def.mirror).toBe('none');
    const map = withPiece(ID, 0);
    const boxes = buildMapGeometry(map).filter((b) => b.sourceId.startsWith('sp_piece_') && b.kind === 'wall' && b.min[1] < 1);
    // The ring's stone, from the centre: from 14.2 to 15.8 m (its pieces' corners stand a little proud of the curve).
    const reach = Math.max(...boxes.map((b) => Math.max(...[b.min[0], b.max[0]].flatMap((x) => [b.min[2], b.max[2]].map((z) => Math.hypot(x - C.x, z - C.z))))));
    expect(reach).toBeGreaterThan(15.7);
    expect(reach).toBeLessThan(16.4);
  });

  it('a standing player fits all the way in through each of the three gates, in every turn; the whole quarter stops them', () => {
    // A player's body checked every 0.2 m along the way in (the move's own room check, PhysicsWorld.headroom): the
    // capsule clears the piers and the lintel from 20 m out to the courtyard 13 m from the centre. (A walk is not
    // used here: Rapier's character controller can stall on a flat merged floor at some spots, wherever it is.)
    const fits = (physics: PhysicsWorld, deg: number, rotation: Rotation, from: number, to: number) => {
      for (let r = from; r >= to; r -= 0.2) if (!physics.headroom(place(at(deg, r, 0.02), rotation, false, 3), 1.8)) return r;
      return null;
    };
    for (const rotation of ROTATIONS) {
      const physics = physicsOf(withPiece(ID, rotation));
      for (const g of GATES) expect(fits(physics, g, rotation, 20, 13), `turned ${rotation}: through the gate at ${g}°`).toBeNull();
      // The north-east quarter has no gate: the wall stands across the way in.
      const blocked = fits(physics, 45, rotation, 20, 13);
      expect(blocked, `turned ${rotation}: the whole quarter`).not.toBeNull();
      expect(blocked!).toBeGreaterThan(15.5);
      // And a player walking at it from outside stays outside.
      const end = walk(physics, place(at(45, 19.5), rotation, false, 3), placeYaw(towardCentre(45), rotation, false), 150);
      const centre = place(C, rotation, false, 3);
      expect(Math.hypot(end.pos.x - centre.x, end.pos.z - centre.z), `turned ${rotation}: walked at the whole quarter`).toBeGreaterThan(15.7);
    }
  });

  it('players walk in through the south-west gate and round the keep', () => {
    const physics = physicsOf(withPiece(ID, 0));
    const end = walk(physics, at(225, 19.5), towardCentre(225), 150);
    // Up to the keep's corner (11.3 m from the centre), in the courtyard.
    expect(Math.hypot(end.pos.x - C.x, end.pos.z - C.z)).toBeLessThan(12.5);
  });

  it('bots path in through every gate to the command room, the radio room and the roof terrace', () => {
    for (const rotation of [0, 2] as Rotation[]) {
      const map = withPiece(ID, rotation);
      const nav = navOf(map);
      const room = place(C, rotation, false, 3);
      const radio = place({ x: 8, y: 4, z: 16 }, rotation, false, 3);
      const terrace = place({ x: 16, y: 4, z: 8 }, rotation, false, 3);
      for (const g of GATES) {
        const from = place(at(g, 21), rotation, false, 3);
        expect(reaches(nav, from, room), `turned ${rotation}: from the gate at ${g}° to the command room`).toBe(true);
      }
      const yard = place(at(225, 20), rotation, false, 3);
      expect(reaches(nav, yard, terrace), `turned ${rotation}: up the stair to the roof`).toBe(true);
      expect(reaches(nav, yard, radio), `turned ${rotation}: into the radio room`).toBe(true);
      nav.destroy();
    }
  });

  it('the command room holds a final hold: 15 m of floor between its walls each way, under its ceiling', () => {
    const physics = physicsOf(withPiece(ID, 0));
    const from = { x: C.x, y: 1, z: C.z + 0.01 };
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const hit = physics.raycastHit({ x: from.x, y: 2.5, z: from.z }, { x: dx, y: 0, z: dz }, 20);
      expect(hit!.dist, `to the wall ${dx},${dz}`).toBeGreaterThan(7.3);
      expect(hit!.dist).toBeLessThan(7.6);
    }
    const up = physics.raycastHit(from, { x: 0, y: 1, z: 0 }, 10);
    expect(up!.dist).toBeLessThan(3.1);
  });

  it('shots go out through the slits at eye height and stop on the wall above and below; from the roof the guns see over the ring', () => {
    for (const rotation of [0, 1] as Rotation[]) {
      const physics = physicsOf(withPiece(ID, rotation));
      // The whole quarter's slits (north-east: 18°, 36°, 54° and 72°), outward from the courtyard.
      for (const deg of [18, 36, 54, 72]) {
        const a = place(at(deg, 12.5, 1.45), rotation, false, 3);
        const b = place(at(deg, 18, 1.45), rotation, false, 3);
        const dir = { x: (b.x - a.x) / 5.5, y: 0, z: (b.z - a.z) / 5.5 };
        expect(physics.raycastHit(a, dir, 5.5), `turned ${rotation}: through the slit at ${deg}°`).toBeNull();
        expect(physics.raycastHit({ ...a, y: 0.8 }, dir, 5.5), `turned ${rotation}: under the slit at ${deg}°`).not.toBeNull();
        expect(physics.raycastHit({ ...a, y: 2.4 }, dir, 5.5), `turned ${rotation}: over the slit at ${deg}°`).not.toBeNull();
      }
      // From the terrace (eyes 1.6 m over it, behind the parapet) to the ground 30 m out: over the ring.
      const eye = place({ x: 16, y: 5.6, z: 5 }, rotation, false, 3);
      const far = place({ x: 16, y: 0.5, z: -30 }, rotation, false, 3);
      expect(physics.lineOfSight(eye, far), `turned ${rotation}: from the roof over the ring`).toBe(true);
    }
  });
});

// ------------------------------------------------------------------ the gatehouse on the grand stair

describe('the grand stair gatehouse: through the gate between the flights', () => {
  const ID = 'setpiece.cliff_stair_gate';
  const turns = ROTATIONS.flatMap((rotation) => [false, true].map((mirror) => [rotation, mirror] as const));

  it('is the Grand Cliff Stair, part for part, with its gate: the same flights, landing, terrace and bases', () => {
    const grand = library.pieces.get('setpiece.cliff_stair_grand')!;
    const gate = library.pieces.get(ID)!;
    expect(gate.footprint.cells).toEqual(grand.footprint.cells);
    expect(gate.ports).toEqual(grand.ports);
    for (const i of [0, 3, 6, 7, 8]) expect(gate.parts[i]).toEqual(grand.parts[i]);
    expect(gate.parts.filter((p) => p.kind === 'tile' && Object.values(p.edges ?? {}).includes('gate_arch')).length).toBe(2);
  });

  it('players climb both flights through the arches to the terrace, in every turn and mirror', () => {
    for (const [rotation, mirror] of turns) {
      const physics = physicsOf(withPiece(ID, rotation, mirror));
      // Through each arch (x 0 and x 8, between the landing's sandbags), up from the beach.
      for (const x of [1.5, 6.5]) {
        const end = walk(physics, place({ x, y: 0.05, z: -7 }, rotation, mirror, 1), placeYaw(0, rotation, mirror), 380);
        const there = place({ x, y: 0, z: 22 }, rotation, mirror, 1);
        expect(end.pos.y, `turned ${rotation}${mirror ? ' mirrored' : ''}, lane ${x}: up two levels`).toBeGreaterThan(7.9);
        expect(Math.hypot(end.pos.x - there.x, end.pos.z - there.z), `turned ${rotation}${mirror ? ' mirrored' : ''}, lane ${x}: on the terrace`).toBeLessThan(5);
      }
    }
  });

  it('bots path up through the gate from anywhere along the foot', () => {
    for (const [rotation, mirror] of [[0, false], [1, true], [2, false], [3, true]] as const) {
      const nav = navOf(withPiece(ID, rotation, mirror));
      for (const x of [-2, 4, 10]) expect(reaches(nav, place({ x, y: 0, z: -8 }, rotation, mirror, 1), place({ x: 4, y: 8, z: 23 }, rotation, mirror, 1)), `turned ${rotation}${mirror ? ' mirrored' : ''} from ${x}`).toBe(true);
      nav.destroy();
    }
  });

  it('shots pass through both arches and stop on the central pier and the flanking walls; nobody leaves the landing sideways', () => {
    for (const [rotation, mirror] of [[0, false], [3, true]] as const) {
      const physics = physicsOf(withPiece(ID, rotation, mirror));
      const north = placeYaw(0, rotation, mirror);
      const dir = { x: Math.sin(north), y: 0, z: Math.cos(north) };
      // 2 m over the landing (6 m up), from the landing's middle north through each arch, 2.4 m deep, to flight 2.
      for (const x of [0, 8]) expect(physics.raycastHit(place({ x, y: 6, z: 7 }, rotation, mirror, 1), dir, 8), `through the arch at ${x}`).toBeNull();
      const pier = physics.raycastHit(place({ x: 4, y: 6, z: 7 }, rotation, mirror, 1), dir, 8);
      expect(pier!.dist, 'the central pier').toBeLessThan(4.2);
      // Over the crown (5.7 m over the landing) the gate is solid up to its battlements.
      expect(physics.raycastHit(place({ x: 0, y: 10.5, z: 7 }, rotation, mirror, 1), dir, 8)).not.toBeNull();
      // The landing's sides are walls two storeys high: walking off it to the west or the east, you stay on it.
      for (const [x, yaw] of [[-1, -Math.PI / 2], [9, Math.PI / 2]] as const) {
        const end = walk(physics, place({ x, y: 4.05, z: 6 }, rotation, mirror, 1), placeYaw(yaw, rotation, mirror), 120);
        expect(end.pos.y, `the ${x < 4 ? 'west' : 'east'} flank`).toBeGreaterThan(3.9);
      }
    }
  });

  it('builds what its exploded parts build (collision, trim and navigation)', () => {
    const map = makeMap([{ id: 'home', tile: 'core.room', x: -20, y: -20, z: 0, rotation: 0 }], [[-160, 0, -160]]);
    const doc: MapDocument = {
      ...map,
      classicStructure: { ...map.classicStructure, theme: 'core.military' },
      terrain: newTerrain(200, 2, [0, 0], 'grass'),
      setPieces: [
        { id: 'gate', piece: ID, x: 0, y: 0, z: 0, rotation: 1, mirror: true, pack: 'harbor' },
        { id: 'fort', piece: 'setpiece.command_bunker', x: 6, y: 0, z: 0, rotation: 0, mirror: false, pack: 'military' },
      ],
    };
    const played = (d: MapDocument) => {
      const r = loadMap(serializeMap(d));
      if (!r.ok) throw new Error(r.issues.map((i) => i.message).join('; '));
      return r.map;
    };
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
  });
});
