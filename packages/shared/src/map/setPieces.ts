/**
 * Set pieces (format v27, docs/SET_PIECES_PLAN.md): a carriageway, a skybridge, a bunker cluster, placed as one and
 * made of the ordinary map pieces. A definition (content/setpieces/<family>.json, or a map's own `setPieceDefs`) is a
 * footprint and a list of parts in the piece's own frame: tile placements (cells from the anchor cell, quarter turns,
 * edges, glass, upper floors, room options) and blocks, props, doors, ladders and lights (metres from the anchor
 * cell's centre on its level's floor), with material roles where re-theming should change them. A placement names a
 * piece, its anchor cell and level, its turn, whether it is mirrored and the role pack that themes it.
 *
 * `expandSetPieces` turns every placement into its parts: ordinary tiles and entities appended to the map, with
 * stable ids (`sp_<placement id>_<part index>`), so geometry, collision, navigation, the flicker clipping, level
 * merging, validation, the budgets and the server need no special case. It is pure and deterministic. loadMap expands
 * for play; MapMaker keeps the placements (`forEditing`) and expands them for its view.
 *
 * The transform of a part: mirror (east and west swapped, in place over the footprint: x → W − x, where W is the
 * footprint's least plus greatest dx), then the turn (clockwise quarter turns about the anchor cell), then the move to
 * the anchor. A tile mirrored stays the same tile when it is mirror-symmetric (`tileMirrorAxis`), turned the other
 * way, its anchor moved so it covers the mirrored cells, and its edge, glass and upper-floor keys mirrored (E ↔ W);
 * a piece with an asymmetric tile says `mirror: "none"`. Entities: positions mirrored and turned, yaws negated and
 * turned, a block's roll negated, and an untilted block turned a quarter keeps its yaw with its width and depth
 * swapped (it stays axis-aligned). Props are placed mirrored in position and facing, not in shape.
 */
import { coreCatalog, type LocalBox, type Side, type TileCatalog, type TileDefinition } from './catalog.ts';
import { cellKey, rotateSide, rotateXZ } from './geometry.ts';
import {
  MAX_TILE_CELL,
  MAX_TILE_LEVEL,
  MapEntity,
  SetPieceDefinition,
  TilePlacement,
  type MapDocument,
  type Rotation,
  type SetPieceMaterialRole,
  type SetPiecePart,
  type SetPiecePlacement,
  type SetPieceRoleValues,
  type SetPieceRoleValuesInput,
  type SurfaceStyle,
} from './schema.ts';
import type { ValidationIssue } from './validate.ts';

export type { SetPieceDefinition, SetPiecePlacement };

/** A role pack (content/setpieces/roles.json): what each role is in one look, and the themes it is the default for. */
export interface SetPieceRolePack {
  id: string;
  displayName: string;
  /** The Style Pack it goes with, if any (MapMaker's pack picker). */
  stylePack?: string;
  /** Maps in these themes use it for a placement that names no pack. */
  themes: readonly string[];
  roles: SetPieceRoleValues;
}
/** A role pack as the data gives it (tints may be left out). */
export type SetPieceRolePackInput = Omit<SetPieceRolePack, 'roles'> & { roles: SetPieceRoleValuesInput };

/** The set pieces and role packs an expansion reads (the shipped ones: setPieceLibrary.ts). */
export interface SetPieceLibrary {
  pieces: ReadonlyMap<string, SetPieceDefinition>;
  packs: ReadonlyMap<string, SetPieceRolePack>;
}

/** The grid set pieces are built for: their tiles' parts and their entities' metres assume it. */
export const SET_PIECE_GRID = { cellSize: 8, levelHeight: 4 } as const;
/** Most parts the expansion adds to a map (a hard load budget: the map is refused past it). */
export const SET_PIECE_EXPANDED_MAX = { tiles: 8192, entities: 8192 } as const;

/** The id of a placement's part. */
export const setPiecePartId = (placementId: string, index: number): string => `sp_${placementId}_${index}`;

/** The pieces a map can name: the library's, and the map's own (`setPieceDefs`, which never replace a shipped one). */
export function piecesFor(doc: Pick<MapDocument, 'setPieceDefs'>, library: SetPieceLibrary): ReadonlyMap<string, SetPieceDefinition> {
  if (!doc.setPieceDefs?.length) return library.pieces;
  const out = new Map(library.pieces);
  for (const d of doc.setPieceDefs) if (!out.has(d.id)) out.set(d.id, d);
  return out;
}

// ---------------------------------------------------------------- frames

/** W: the footprint's least plus greatest dx. Mirroring takes dx to W − dx, so the piece stays over its own cells. */
export function mirrorWidth(def: Pick<SetPieceDefinition, 'footprint'>): number {
  const xs = def.footprint.cells.map((c) => c[0]);
  return Math.min(...xs) + Math.max(...xs);
}

const MIRROR_SIDE: Record<Side, Side> = { N: 'N', E: 'W', S: 'S', W: 'E' };
type Pose = Pick<SetPiecePlacement, 'x' | 'y' | 'z' | 'rotation' | 'mirror'>;

/** A cell of the piece's frame (dx, dy) on the map's grid. */
export function placeCell(p: Pose, def: Pick<SetPieceDefinition, 'footprint'>, dx: number, dy: number): [number, number] {
  const mx = p.mirror ? mirrorWidth(def) - dx : dx;
  const [rx, ry] = rotateXZ(mx, dy, p.rotation);
  return [p.x + rx, p.y + ry];
}

/** A side of a cell of the piece's frame, on the map. */
export const placeSide = (p: Pick<SetPiecePlacement, 'rotation' | 'mirror'>, side: Side): Side => rotateSide(p.mirror ? MIRROR_SIDE[side] : side, p.rotation);

const round6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
const QUARTER = Math.PI / 2;

/** A yaw in (−π, π], exact on quarter turns, else to a millionth of a radian. */
export function snapYaw(yaw: number): number {
  let y = yaw % (2 * Math.PI);
  if (y > Math.PI) y -= 2 * Math.PI;
  if (y <= -Math.PI) y += 2 * Math.PI;
  const k = Math.round(y / QUARTER);
  if (Math.abs(y - k * QUARTER) < 1e-6) return k === -2 ? Math.PI : k === 0 ? 0 : k * QUARTER;
  return round6(y);
}

/** A point of the piece's frame (metres from the anchor cell's centre on its level's floor) in the map. */
export function placePoint(p: Pose, def: Pick<SetPieceDefinition, 'footprint'>, at: readonly [number, number, number]): [number, number, number] {
  const { cellSize, levelHeight } = SET_PIECE_GRID;
  const mx = p.mirror ? mirrorWidth(def) * cellSize - at[0] : at[0];
  const [rx, rz] = rotateXZ(mx, at[2], p.rotation);
  return [round6(p.x * cellSize + rx), round6(p.z * levelHeight + at[1]), round6(p.y * cellSize + rz)];
}

/** A facing of the piece's frame (radians, like an entity's yaw: local +Z toward (sin, cos)) in the map. */
export const placeYaw = (p: Pick<SetPiecePlacement, 'rotation' | 'mirror'>, yaw: number): number => snapYaw((p.mirror ? -yaw : yaw) + p.rotation * QUARTER);

/** Every grid cell a placement claims: its footprint's cells on each of its levels. */
export function setPieceFootprint(p: Pose, def: Pick<SetPieceDefinition, 'footprint'>): [number, number, number][] {
  const out: [number, number, number][] = [];
  const [l0, l1] = def.footprint.levels;
  for (const [dx, dy] of def.footprint.cells) {
    const [x, y] = placeCell(p, def, dx, dy);
    for (let dz = Math.min(l0, l1); dz <= Math.max(l0, l1); dz++) out.push([x, y, p.z + dz]);
  }
  return out;
}

/** A placement's ports on the map: the cell, level and side where it meets what is built round it. */
export function setPiecePorts(p: Pose, def: Pick<SetPieceDefinition, 'footprint' | 'ports'>): { x: number; y: number; z: number; side: Side; kind: 'door' | 'opening' }[] {
  return def.ports.map((port) => {
    const [x, y] = placeCell(p, def, port.cell[0], port.cell[1]);
    return { x, y, z: p.z + port.level, side: placeSide(p, port.side), kind: port.kind };
  });
}

// ---------------------------------------------------------------- mirror-symmetric tiles

const r4 = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
const boxKey = (b: LocalBox) =>
  [b.min.map(r4).join(','), b.max.map(r4).join(','), r4(b.yaw ?? 0), r4(b.pitch ?? 0), r4(b.roll ?? 0), b.kind ?? 'solid', b.surface ? `${b.surface.material}|${b.surface.tint ?? '-'}` : '-'].join(' ');
/** The box mirrored across x = axis (metres). */
const mirrorBox = (b: LocalBox, axis: number): LocalBox => ({
  ...b,
  min: [2 * axis - b.max[0], b.min[1], b.min[2]],
  max: [2 * axis - b.min[0], b.max[1], b.max[2]],
  ...(b.yaw ? { yaw: -b.yaw } : {}),
  ...(b.roll ? { roll: -b.roll } : {}),
});
const sameBag = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n');

const mirrorAxes = new WeakMap<TileDefinition, number | null>();
/**
 * A tile that is its own mirror image (east and west swapped) about the line x = a2 / 2 cells of its own frame:
 * returns a2, an integer (its cells' least plus greatest dx); null when it isn't (stairs climbing one way, a tile
 * drawn from a model). Its cells, ports, default edges and parts must all mirror onto themselves.
 */
export function tileMirrorAxis(def: TileDefinition): number | null {
  const known = mirrorAxes.get(def);
  if (known !== undefined) return known;
  const result = ((): number | null => {
    if (def.model) return null;
    const xs = def.cells.map((c) => c[0]);
    const a2 = Math.min(...xs) + Math.max(...xs);
    const cell = (c: readonly number[]) => `${c[0]},${c[1]},${c[2]}`;
    if (!sameBag(def.cells.map(cell), def.cells.map((c) => cell([a2 - c[0]!, c[1]!, c[2]!])))) return null;
    const port = (p: TileDefinition['ports'][number], m: boolean) => {
      const [cx, cy] = p.cell ?? [0, 0];
      return `${m ? MIRROR_SIDE[p.side] : p.side} ${p.level} ${m ? a2 - cx : cx},${cy}`;
    };
    if (!sameBag(def.ports.map((p) => port(p, false)), def.ports.map((p) => port(p, true)))) return null;
    const edges = Object.entries(def.edgeDefaults ?? {});
    const edge = ([k, v]: [string, string], m: boolean) => {
      if (!m) return `${k}=${v}`;
      const [c, s] = k.split(':') as [string, Side];
      const [x, y, z] = c.split(',').map(Number) as [number, number, number];
      return `${a2 - x},${y},${z}:${MIRROR_SIDE[s]}=${v}`;
    };
    if (!sameBag(edges.map((e) => edge(e, false)), edges.map((e) => edge(e, true)))) return null;
    const axis = (a2 * SET_PIECE_GRID.cellSize) / 2;
    for (const list of [def.solids ?? [], def.extraFloors ?? []]) {
      if (!sameBag(list.map(boxKey), list.map((b) => boxKey(mirrorBox(b, axis))))) return null;
    }
    return a2;
  })();
  mirrorAxes.set(def, result);
  return result;
}

const mirrorProblems = new WeakMap<SetPieceDefinition, string | null>();
/**
 * Why a piece can't be placed mirrored, or null when it can: every tile in it must be its own mirror image
 * (tileMirrorAxis), or it would need a mirrored twin no tile has. Room layouts and the broken wall's hole are drawn
 * as they are (not mirrored): they are still whole, just not a mirror image.
 */
export function setPieceMirrorProblem(def: SetPieceDefinition, catalog: TileCatalog = coreCatalog): string | null {
  const known = catalog === coreCatalog ? mirrorProblems.get(def) : undefined;
  if (known !== undefined) return known;
  let out: string | null = null;
  for (const part of def.parts) {
    if (part.kind !== 'tile') continue;
    const t = catalog.get(part.tile);
    if (!t) out = `${part.tile} is not a tile`;
    else if (tileMirrorAxis(t) === null) out = `${t.displayName} (${t.id}) isn't its own mirror image`;
    if (out) break;
  }
  if (catalog === coreCatalog) mirrorProblems.set(def, out);
  return out;
}

/** A tile-frame key ("dx,dy,dz" or "dx,dy,dz:S") of a tile mirrored about its axis a2. */
function mirrorKey(key: string, a2: number): string {
  const [c, s] = key.split(':') as [string, Side | undefined];
  const [x, y, z] = c.split(',').map(Number) as [number, number, number];
  const cell = `${a2 - x + 0},${y},${z}`;
  return s ? `${cell}:${MIRROR_SIDE[s]}` : cell;
}

// ---------------------------------------------------------------- roles

/** Which slot of the map's theme paints a material role no pack gives (the part's surface is then left as the theme's). */
export const ROLE_THEME_SLOT: Record<SetPieceMaterialRole, 'walls' | 'trim' | 'floor' | 'roof' | 'solids'> = { stone: 'walls', trim: 'trim', floor: 'floor', paving: 'floor', roof: 'roof', wood: 'solids', metal: 'solids' };

/** The role pack a placement is themed by: its own, else the one for the map's theme (null: the theme's own look). */
export function placementPack(p: Pick<SetPiecePlacement, 'pack'>, theme: string, library: Pick<SetPieceLibrary, 'packs'>): SetPieceRolePack | null {
  if (p.pack) return library.packs.get(p.pack) ?? null;
  for (const pack of library.packs.values()) if (pack.themes.includes(theme)) return pack;
  return null;
}

/** What a role is for one placement: its override, else its pack's, else the piece's own (undefined: the theme's). */
function roleValue<K extends keyof SetPieceRoleValues>(role: K, p: SetPiecePlacement, def: SetPieceDefinition, pack: SetPieceRolePack | null): SetPieceRoleValues[K] | undefined {
  return p.overrides?.roles?.[role] ?? pack?.roles[role] ?? def.roles?.[role];
}

// ---------------------------------------------------------------- expansion

/** A placement's parts as ordinary map pieces (hidden ones left out), in the map's frame, ids `sp_<id>_<index>`. */
export function setPieceParts(p: SetPiecePlacement, def: SetPieceDefinition, theme: string, library: Pick<SetPieceLibrary, 'packs'>, catalog: TileCatalog = coreCatalog): { tiles: TilePlacement[]; entities: MapEntity[] } {
  const pack = placementPack(p, theme, library);
  const hidden = new Set(p.overrides?.hide ?? []);
  const material = (v: SurfaceStyle | { role: SetPieceMaterialRole }): SurfaceStyle | undefined => ('role' in v ? roleValue(v.role, p, def, pack) : v);
  const glass = (v: string | { role: 'glass' }): 'breakable' | 'reinforced' | undefined => {
    const k = typeof v === 'string' ? v : roleValue('glass', p, def, pack);
    return k === 'breakable' || k === 'reinforced' ? k : undefined;
  };
  const tiles: TilePlacement[] = [];
  const entities: MapEntity[] = [];
  def.parts.forEach((part, i) => {
    if (hidden.has(i)) return;
    const id = setPiecePartId(p.id, i);
    // Through the map schema: each part as a map file would hold it (its fields in the schema's order).
    if (part.kind === 'tile') tiles.push(TilePlacement.parse(placeTilePart(p, def, part, id, material, glass, (v) => (typeof v === 'string' ? v : roleValue('facade', p, def, pack)), catalog)));
    else entities.push(MapEntity.parse(placeEntityPart(p, def, part, id, material, glass, (v) => (typeof v === 'string' ? v : roleValue('door', p, def, pack)))));
  });
  return { tiles, entities };
}

type Resolve<V, R> = (v: V) => R | undefined;

function placeTilePart(
  p: SetPiecePlacement,
  def: SetPieceDefinition,
  part: Extract<SetPiecePart, { kind: 'tile' }>,
  id: string,
  material: Resolve<SurfaceStyle | { role: SetPieceMaterialRole }, SurfaceStyle>,
  glass: Resolve<string | { role: 'glass' }, 'breakable' | 'reinforced'>,
  facade: Resolve<string | { role: 'facade' }, string>,
  catalog: TileCatalog,
): TilePlacement {
  const { kind: _k, surfaces, glass: glassIn, options, edges, upperFloors, x, y, z, rotation, tile } = part;
  void _k;
  let ax = x;
  let ay = y;
  let rot: number = rotation;
  let key = (k: string) => k;
  if (p.mirror) {
    // The tile mirrored onto itself (tileMirrorAxis; definitions that need it are checked to have it), turned the
    // other way, its anchor moved so it covers the mirrored cells.
    const tileDef = catalog.get(tile);
    const a2 = (tileDef && tileMirrorAxis(tileDef)) ?? 0;
    rot = (4 - rotation) % 4;
    const [sx, sy] = rotateXZ(a2, 0, rot);
    ax = mirrorWidth(def) - x - sx;
    ay = y - sy;
    key = (k: string) => mirrorKey(k, a2);
  }
  const [rx, ry] = rotateXZ(ax, ay, p.rotation);
  const out: TilePlacement = { id, tile, x: p.x + rx, y: p.y + ry, z: p.z + z, rotation: ((rot + p.rotation) % 4) as Rotation };
  if (surfaces) {
    const s: NonNullable<TilePlacement['surfaces']> = {};
    for (const [slot, v] of Object.entries(surfaces) as [keyof typeof surfaces, SurfaceStyle | { role: SetPieceMaterialRole }][]) {
      const m = v && material(v);
      if (m) s[slot] = { material: m.material, tint: m.tint ?? null };
    }
    if (Object.keys(s).length) out.surfaces = s;
  }
  if (edges && Object.keys(edges).length) out.edges = Object.fromEntries(Object.entries(edges).map(([k, v]) => [key(k), v] as const).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  if (glassIn) {
    const g = Object.entries(glassIn).flatMap(([k, v]) => {
      const kind = glass(v);
      return kind ? [[key(k), kind] as const] : [];
    });
    if (g.length) out.glass = Object.fromEntries(g.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  }
  if (upperFloors?.length) out.upperFloors = upperFloors.map(key).sort();
  if (options) {
    const { facade: f, ...rest } = options;
    const o: NonNullable<TilePlacement['options']> = { ...rest };
    const look = f !== undefined ? facade(f) : undefined;
    if (look) o.facade = look as NonNullable<TilePlacement['options']>['facade'];
    if (Object.keys(o).length) out.options = o;
  }
  return out;
}

function placeEntityPart(
  p: SetPiecePlacement,
  def: SetPieceDefinition,
  part: Exclude<SetPiecePart, { kind: 'tile' }>,
  id: string,
  material: Resolve<SurfaceStyle | { role: SetPieceMaterialRole }, SurfaceStyle>,
  glass: Resolve<string | { role: 'glass' }, 'breakable' | 'reinforced'>,
  doorStyle: Resolve<string | { role: 'door' }, string>,
): MapEntity {
  const position = placePoint(p, def, part.position);
  const yaw = placeYaw(p, part.yaw);
  if (part.kind === 'block') {
    const { material: m, glass: g, tint, size, pitch, roll, ...rest } = part;
    const surface = m === null ? undefined : typeof m === 'string' ? { material: m, tint: null } : material(m);
    const tilted = !!(pitch || roll);
    const r = p.rotation % 2 === 1;
    // An untilted block turned a quarter keeps its yaw with width and depth swapped: it stays as it was drawn.
    const block: Extract<MapEntity, { kind: 'block' }> = {
      ...rest,
      id,
      position,
      size: !tilted && r ? [size[2], size[1], size[0]] : [size[0], size[1], size[2]],
      yaw: tilted ? yaw : snapYaw(p.mirror ? -part.yaw : part.yaw),
      material: surface?.material ?? null,
      tint: tint ?? surface?.tint ?? null,
      ...(pitch ? { pitch } : {}),
      ...(roll ? { roll: p.mirror ? -roll : roll } : {}),
    };
    const kind = g === undefined ? undefined : glass(g);
    if (kind) block.glass = kind;
    else delete block.glass;
    return block;
  }
  if (part.kind === 'door') {
    const { style, ...rest } = part;
    const s = style === undefined ? undefined : doorStyle(style);
    const door: Extract<MapEntity, { kind: 'door' }> = { ...rest, id, position, yaw };
    if (s) door.style = s as NonNullable<typeof door.style>;
    return door;
  }
  return { ...part, id, position, yaw } as MapEntity;
}

/** What expanding a map's set pieces gives. */
export interface SetPieceExpansion {
  /** The map as played: every placement's parts added to its tiles and entities, and no `setPieces` (nor `setPieceDefs`). */
  map: MapDocument;
  /** What stopped a placement expanding, or was ignored: unknown pieces, mirrored pieces that can't be, overrides that don't apply. */
  issues: ValidationIssue[];
  /** Each part's id and the placement it came from. */
  partOf: ReadonlyMap<string, string>;
  /** Each placement's footprint (grid cells) as expanded. */
  footprints: ReadonlyMap<string, readonly [number, number, number][]>;
}

const cache = new WeakMap<MapDocument, { library: SetPieceLibrary; catalog: TileCatalog; result: SetPieceExpansion }>();

/**
 * Every set piece of a map expanded into its parts (pure, deterministic: the same ids and parts every time). Placements
 * that can't expand (an unknown piece, a mirror the piece doesn't allow, a map not on the 8 m / 4 m grid) are left
 * out with an error; a map without set pieces comes back as it is.
 */
export function expandSetPieces(doc: MapDocument, library: SetPieceLibrary, catalog: TileCatalog = coreCatalog): SetPieceExpansion {
  const hit = cache.get(doc);
  if (hit && hit.library === library && hit.catalog === catalog) return hit.result;
  const result = expand(doc, library, catalog);
  cache.set(doc, { library, catalog, result });
  return result;
}

function expand(doc: MapDocument, library: SetPieceLibrary, catalog: TileCatalog): SetPieceExpansion {
  const placements = doc.setPieces ?? [];
  const issues: ValidationIssue[] = [];
  const partOf = new Map<string, string>();
  const footprints = new Map<string, [number, number, number][]>();
  if (doc.setPieces === undefined && doc.setPieceDefs === undefined) return { map: doc, issues, partOf, footprints };
  const pieces = piecesFor(doc, library);
  const { setPieces: _p, setPieceDefs: _d, ...rest } = doc;
  void _p;
  void _d;
  for (const d of doc.setPieceDefs ?? []) {
    if (!d.id.startsWith('local.')) issues.push({ severity: 'error', code: 'setpiece.def_id', message: `the map's own set piece ${d.id} must be named local.<name> (setpiece.* are the shipped ones)` });
    else if ((doc.setPieceDefs ?? []).filter((o) => o.id === d.id).length > 1) issues.push({ severity: 'error', code: 'setpiece.def_id', message: `the map defines set piece ${d.id} twice` });
  }
  const grid = doc.classicStructure.cellSize === SET_PIECE_GRID.cellSize && doc.classicStructure.levelHeight === SET_PIECE_GRID.levelHeight;
  const tiles: TilePlacement[] = [];
  const entities: MapEntity[] = [];
  for (const p of placements) {
    const def = pieces.get(p.piece);
    if (!def) {
      issues.push({ severity: 'error', code: 'setpiece.unknown', message: `set piece ${p.id} names an unknown piece "${p.piece}"`, targetId: p.id });
      continue;
    }
    if (!grid) {
      issues.push({ severity: 'error', code: 'setpiece.grid', message: `set piece ${p.id}: set pieces need the standard grid (8 m cells, 4 m levels)`, targetId: p.id });
      continue;
    }
    const asymmetric = p.mirror ? (def.mirror === 'none' ? def.displayName : setPieceMirrorProblem(def, catalog)) : null;
    if (asymmetric) {
      issues.push({ severity: 'error', code: 'setpiece.mirror', message: `set piece ${p.id}: ${def.displayName} can't be mirrored (${def.mirror === 'none' ? 'it says so' : asymmetric}); place it unmirrored`, targetId: p.id });
      continue;
    }
    if (p.pack && !library.packs.has(p.pack)) issues.push({ severity: 'warning', code: 'setpiece.pack', message: `set piece ${p.id} names an unknown role pack "${p.pack}": it takes the map's theme`, targetId: p.id });
    const bad = (p.overrides?.hide ?? []).filter((i) => i >= def.parts.length);
    if (bad.length) issues.push({ severity: 'warning', code: 'setpiece.hide', message: `set piece ${p.id} hides part ${bad.join(', ')}, which ${def.displayName} doesn't have (it has ${def.parts.length})`, targetId: p.id });
    const cells = setPieceFootprint(p, def);
    footprints.set(p.id, cells);
    if (cells.some(([x, y, z]) => Math.abs(x) > MAX_TILE_CELL || Math.abs(y) > MAX_TILE_CELL || Math.abs(z) > MAX_TILE_LEVEL)) {
      issues.push({ severity: 'error', code: 'setpiece.limit', message: `set piece ${p.id} reaches past the build limit`, targetId: p.id });
      continue;
    }
    const parts = setPieceParts(p, def, doc.classicStructure.theme, library, catalog);
    for (const t of parts.tiles) partOf.set(t.id, p.id);
    for (const e of parts.entities) partOf.set(e.id, p.id);
    tiles.push(...parts.tiles);
    entities.push(...parts.entities);
  }
  const allTiles = doc.classicStructure.tiles.length + tiles.length;
  const allEntities = doc.entities.length + entities.length;
  if (tiles.length > SET_PIECE_EXPANDED_MAX.tiles || entities.length > SET_PIECE_EXPANDED_MAX.entities) {
    issues.push({ severity: 'error', code: 'budget.setpieces', message: `the set pieces add ${tiles.length} tiles and ${entities.length} entities: at most ${SET_PIECE_EXPANDED_MAX.tiles} and ${SET_PIECE_EXPANDED_MAX.entities} (${allTiles} tiles and ${allEntities} entities in all)` });
  }
  const map: MapDocument = { ...rest, classicStructure: { ...doc.classicStructure, tiles: [...doc.classicStructure.tiles, ...tiles] }, entities: [...doc.entities, ...entities] };
  return { map, issues, partOf, footprints };
}

/**
 * Footprints that overlap: a placement's cells against tiles placed by hand and against other placements (errors, as
 * tiles overlapping tiles are). `cells`: the grid occupancy of the map's own tiles (not the parts).
 */
export function setPieceOverlapIssues(doc: MapDocument, expansion: Pick<SetPieceExpansion, 'footprints'>, cells: ReadonlyMap<string, { placement: TilePlacement }>): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const claimed = new Map<string, string>();
  for (const [id, fp] of expansion.footprints) {
    let reported = false;
    for (const [x, y, z] of fp) {
      const key = cellKey(x, y, z);
      const tile = cells.get(key);
      if (tile && !reported) {
        out.push({ severity: 'error', code: 'setpiece.overlap', message: `set piece ${id} and tile ${tile.placement.id} overlap at cell ${key}`, targetId: id });
        reported = true;
      }
      const other = claimed.get(key);
      if (other && other !== id && !reported) {
        out.push({ severity: 'error', code: 'setpiece.overlap', message: `set pieces ${other} and ${id} overlap at cell ${key}`, targetId: id });
        reported = true;
      }
      claimed.set(key, id);
    }
  }
  return out;
}

/** The grid cells set pieces claim, each with its placement's id. */
export function setPieceCells(doc: MapDocument, pieces: ReadonlyMap<string, SetPieceDefinition>, ignore: ReadonlySet<string> = new Set()): Map<string, SetPiecePlacement> {
  const out = new Map<string, SetPiecePlacement>();
  for (const p of doc.setPieces ?? []) {
    if (ignore.has(p.id)) continue;
    const def = pieces.get(p.piece);
    if (!def) continue;
    for (const [x, y, z] of setPieceFootprint(p, def)) if (!out.has(cellKey(x, y, z))) out.set(cellKey(x, y, z), p);
  }
  return out;
}

/** Parse a set piece definition from untrusted data (a player's library, an imported file): the definition, or why not. */
export function parseSetPiece(raw: unknown): { ok: true; def: SetPieceDefinition } | { ok: false; problems: string[] } {
  const r = SetPieceDefinition.safeParse(raw);
  if (!r.success) return { ok: false, problems: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
  return { ok: true, def: r.data };
}

