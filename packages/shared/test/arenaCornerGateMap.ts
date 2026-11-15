// The Arena Corner's gate on a test map (arenaCornerGate.test.ts): the gate corner between straight bay lines of the
// Arena stands as Flavius Rule builds them, the hypogeum a level under it, and the measures the tests take.
import {
  PhysicsWorld,
  boxCorners,
  buildMapGeometry,
  loadMap,
  mapTerrainMesh,
  navLinks,
  newTerrain,
  rotateXZ,
  serializeMap,
  type MapDocument,
  type MapEntity,
  type Rotation,
  type SetPiecePlacement,
  type TilePlacement,
  type Vec3,
  type WorldBox,
} from '../src/index.ts';
import { NavWorld } from '../src/match.ts';
import { makeMap } from './helpers.ts';

export const PIECE = 'setpiece.arena_corner_gate';
/** The portcullis: part 5 of the set piece placed as "corner". */
export const DOOR = 'sp_corner_5';

export type Placed = Omit<SetPiecePlacement, 'mirror'> & { mirror?: boolean };

const block = (id: string, x: number, z: number, sx: number, sy: number, sz: number, k: number): MapEntity => {
  const [px, pz] = rotateXZ(x, z, k);
  return { id, kind: 'block', name: 'Stand fill', position: [px, 0, pz], size: k % 2 ? [sz, sy, sx] : [sx, sy, sz], yaw: 0, material: 'core.pbr_limestone', tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 } as MapEntity;
};

/**
 * The gate corner north-east of the sand with a straight bay line of each stand beside it (as arenaCorner.test.ts),
 * sand to the south-west, and the hypogeum a level down: the ring's corner under the stand at cell (4, 4) as a
 * Vaulted Tunnel Crossing, open north and east to the two stair wells, its ring running on south and west; all
 * turned `k` quarter turns about the arena's centre. `terrain`: flat ground at y 0 round it all.
 */
export function gateMap(k: Rotation, opts: { corner?: Partial<Placed>; terrain?: boolean; shut?: boolean } = {}): MapDocument {
  const turn = (x: number, y: number): [number, number] => rotateXZ(x, y, k);
  const pieces: Placed[] = [];
  const piece = (id: string, name: string, x: number, y: number, z: number, rotation: number) => {
    const [px, py] = turn(x, y);
    pieces.push({ id, piece: name, x: px, y: py, z, rotation: ((rotation + k) % 4) as Rotation });
  };
  for (const [side, rot, at] of [['n', 0, (d: number) => [1, d]], ['e', 1, (d: number) => [d, 1]]] as const) {
    const p = (id: string, name: string, d: number, z: number) => piece(`${side}_${id}`, name, at(d)[0]!, at(d)[1]!, z, rot);
    p('podium', 'setpiece.arena_bay_podium', 4, 0);
    p('tier_a', 'setpiece.arena_bay_tier', 6, 2);
    p('tier_b', 'setpiece.arena_bay_tier', 8, 4);
    p('attic', 'setpiece.arena_attic', 10, 6);
    for (const z of [0, 2, 4]) p(`arcade_${z}`, 'setpiece.arena_arcade', 10, z);
  }
  const [cx, cy] = turn(2, 2);
  pieces.push({ id: 'corner', piece: PIECE, x: cx, y: cy, z: 0, rotation: k, ...opts.corner });
  const tiles: TilePlacement[] = [];
  for (let x = -1; x <= 3; x++) {
    for (let y = -1; y <= 3; y++) {
      if (x === 3 && y === 3) continue;
      const [tx, ty] = turn(x, y);
      tiles.push({ id: `sand_${x + 1}_${y + 1}`, tile: 'core.yard', x: tx, y: ty, z: 0, rotation: 0 });
    }
  }
  // The hypogeum: the corner crossing, the ring south (x 4) and west (y 4) of it.
  const tunnel = (id: string, tile: string, x: number, y: number, rotation: number) => {
    const [tx, ty] = turn(x, y);
    tiles.push({ id, tile, x: tx, y: ty, z: -1, rotation: ((rotation + k) % 4) as Rotation });
  };
  tunnel('hyp_corner', 'core.tunnel_vault_cross', 4, 4, 0);
  for (const y of [2, 3]) tunnel(`hyp_s${y}`, 'core.tunnel_vault', 4, y, 0);
  for (const x of [2, 3]) tunnel(`hyp_w${x}`, 'core.tunnel_vault', x, 4, 1);
  const map = makeMap(tiles, [[-150, 0, -150]]);
  const doc: MapDocument = {
    ...map,
    classicStructure: { ...map.classicStructure, theme: 'core.imperial' },
    entities: [...map.entities, block('fill_n_low', 8, 52, 8, 8, 16, k), block('fill_n_high', 8, 68, 8, 16, 16, k), block('fill_e_low', 52, 8, 16, 8, 8, k), block('fill_e_high', 68, 8, 16, 16, 8, k)],
    setPieces: pieces.map((p) => ({ mirror: false, ...p })),
  };
  if (opts.terrain) doc.terrain = newTerrain(200, 2, [0, 0]);
  return doc;
}

export const played = (doc: MapDocument, shut = false): MapDocument => {
  const r = loadMap(serializeMap(doc));
  if (!r.ok) throw new Error(r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; '));
  if (shut) for (const e of r.map.entities) if (e.kind === 'door' && e.id === DOOR) e.startOpen = false;
  return r.map;
};
export const physicsOf = (map: MapDocument) => new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
export function navOf(map: MapDocument): NavWorld {
  const physics = physicsOf(map);
  return NavWorld.build(buildMapGeometry(map), mapTerrainMesh(map), navLinks(map.entities, physics));
}

/** A point of the corner as built north-east of the sand, turned k quarter turns. */
export const at = (k: number, x: number, y: number, z: number): Vec3 => {
  const [rx, rz] = rotateXZ(x, z, k);
  return { x: rx, y, z: rz };
};
/** A point in the diagonal's frame: u along the front (+ toward the east stand), v its depth from the sand. */
export const onDiagonal = (k: number, u: number, v: number, y: number) => at(k, 20 + (u + v) / Math.SQRT2, y, 20 + (v - u) / Math.SQRT2);

export const pathLength = (path: readonly Vec3[]) => path.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - path[i]!.x, p.y - path[i]!.y, p.z - path[i]!.z), 0);
/** A bot's path from a to b that reaches b (within a metre), or null. */
export function route(nav: NavWorld, a: Vec3, b: Vec3): Vec3[] | null {
  const path = nav.findPath(a, b);
  if (!path?.length) return null;
  const end = path.at(-1)!;
  return Math.hypot(end.x - b.x, end.y - b.y, end.z - b.z) < 1 ? path : null;
}
/** The path's points back in the corner's own frame (u, v, y). */
export const inDiagonal = (k: number, path: readonly Vec3[]) =>
  path.map((p) => {
    const [x, z] = rotateXZ(p.x, p.z, (4 - k) % 4);
    return { u: (x - z) / Math.SQRT2, v: (x + z - 40) / Math.SQRT2, y: p.y };
  });

export const shape = (b: Pick<WorldBox, 'min' | 'max' | 'yaw' | 'pitch' | 'roll' | 'kind'>) =>
  `${b.kind} ${boxCorners(b)
    .map((p) => p.map((v) => (Math.round(v * 1000) / 1000 + 0).toFixed(3)).join(','))
    .sort()
    .join(' ')}`;
export const cornerBoxes = (boxes: readonly WorldBox[]) => boxes.filter((b) => b.sourceId.startsWith('sp_corner_'));

