/**
 * MapMaker's set-piece edits (docs/SET_PIECES_PLAN.md, "MapMaker"), pure and undoable like the rest of
 * editor/operations.ts: place a piece as one, move, turn, mirror, re-theme and delete it, explode it into its parts
 * (ordinary, editable tiles and entities, one undo step), and save a selection as a new piece. The generic
 * move/turn/duplicate/delete commands take set pieces in a Selection too (`Selection.setPieces`).
 */
import { coreCatalog, type Side, type TileCatalog } from '../map/catalog.ts';
import { rotateSide, rotateXZ, yawXZ } from '../map/geometry.ts';
import { SetPieceDefinition, type MapDocument, type MapEntity, type Rotation, type SetPieceMaterialRole, type SetPiecePart, type SetPiecePlacement, type SurfaceStyle, type TilePlacement } from '../map/schema.ts';
import { checkSetPieceDefinition } from '../map/setPieceCheck.ts';
import { builtInSetPieces } from '../map/setPieceLibrary.ts';
import { ROLE_THEME_SLOT, SET_PIECE_GRID, piecesFor, placementPack, setPieceParts, tileMirrorAxis, type SetPieceLibrary, type SetPieceRolePack } from '../map/setPieces.ts';
import { newId, type EditCommand } from './commands.ts';
import { checkLayout, type PlacementCheck, type Selection } from './operations.ts';

/** Whether set pieces fit where they would go (their footprints against tiles, other set pieces and the build limit). */
export function checkSetPiecePlacement(doc: MapDocument, placements: readonly SetPiecePlacement[], ignoreIds: readonly string[] = [], catalog: TileCatalog = coreCatalog, library: SetPieceLibrary = builtInSetPieces()): PlacementCheck {
  return checkLayout(doc, { setPieces: placements }, ignoreIds, catalog, library);
}

/** Place a set piece as one: anchored at cell (x, y) on level z, turned, mirrored, themed by a role pack (or the map's theme). */
export function placeSetPieceCommand(
  doc: MapDocument,
  piece: string,
  x: number,
  y: number,
  z: number,
  rotation: Rotation = 0,
  opts: { mirror?: boolean; pack?: string; overrides?: SetPiecePlacement['overrides']; catalog?: TileCatalog; library?: SetPieceLibrary } = {},
): { command: EditCommand; placement: SetPiecePlacement } | { error: string } {
  const placement: SetPiecePlacement = { id: newId('setpiece'), piece, x, y, z, rotation, mirror: !!opts.mirror, ...(opts.pack ? { pack: opts.pack } : {}), ...(opts.overrides ? { overrides: opts.overrides } : {}) };
  const check = checkSetPiecePlacement(doc, [placement], [], opts.catalog, opts.library);
  if (!check.ok) return { error: check.reason };
  return { command: { kind: 'addSetPieces', setPieces: [placement] }, placement };
}

/** Change one placement (its anchor, turn, mirror, pack or overrides) if it still fits. */
export function updateSetPieceCommand(doc: MapDocument, before: SetPiecePlacement, after: SetPiecePlacement, catalog: TileCatalog = coreCatalog, library: SetPieceLibrary = builtInSetPieces()): EditCommand | { error: string } {
  const check = checkSetPiecePlacement(doc, [after], [before.id], catalog, library);
  if (!check.ok) return { error: check.reason };
  return { kind: 'updateSetPieces', before: [before], after: [after] };
}

const placementOf = (doc: MapDocument, id: string): SetPiecePlacement | undefined => doc.setPieces?.find((p) => p.id === id);

/** Move a placement by whole cells and levels. */
export function moveSetPieceCommand(doc: MapDocument, id: string, dx: number, dy: number, dz: number, catalog: TileCatalog = coreCatalog, library: SetPieceLibrary = builtInSetPieces()): EditCommand | { error: string } {
  const p = placementOf(doc, id);
  if (!p) return { error: `no set piece ${id}` };
  return updateSetPieceCommand(doc, p, { ...p, x: p.x + dx, y: p.y + dy, z: p.z + dz }, catalog, library);
}

/** Turn a placement clockwise by quarter turns about its anchor cell (R in MapMaker, as for a tile). */
export function rotateSetPieceCommand(doc: MapDocument, id: string, quarters = 1, catalog: TileCatalog = coreCatalog, library: SetPieceLibrary = builtInSetPieces()): EditCommand | { error: string } {
  const p = placementOf(doc, id);
  if (!p) return { error: `no set piece ${id}` };
  return updateSetPieceCommand(doc, p, { ...p, rotation: ((((p.rotation + quarters) % 4) + 4) % 4) as Rotation }, catalog, library);
}

/** Mirror a placement (east and west swapped, in place over the same footprint), or unmirror it (M in MapMaker). */
export function mirrorSetPieceCommand(doc: MapDocument, id: string, catalog: TileCatalog = coreCatalog, library: SetPieceLibrary = builtInSetPieces()): EditCommand | { error: string } {
  const p = placementOf(doc, id);
  if (!p) return { error: `no set piece ${id}` };
  return updateSetPieceCommand(doc, p, { ...p, mirror: !p.mirror }, catalog, library);
}

/** Delete placements. */
export function deleteSetPieceCommand(doc: MapDocument, ids: readonly string[]): EditCommand {
  const set = new Set(ids);
  return { kind: 'removeSetPieces', setPieces: (doc.setPieces ?? []).filter((p) => set.has(p.id)) };
}

/**
 * "Explode to tiles": the placement replaced by its parts as ordinary, editable tiles and entities, keeping their ids
 * (`sp_<id>_<index>`, so logic that named a part still finds it). One undo step puts the placement back.
 */
export function explodeSetPieceCommand(doc: MapDocument, id: string, catalog: TileCatalog = coreCatalog, library: SetPieceLibrary = builtInSetPieces()): { command: EditCommand; selection: Selection } | { error: string } {
  const p = placementOf(doc, id);
  if (!p) return { error: `no set piece ${id}` };
  const def = piecesFor(doc, library).get(p.piece);
  if (!def) return { error: `unknown set piece ${p.piece}` };
  const { tiles, entities } = setPieceParts(p, def, doc.classicStructure.theme, library, catalog);
  const taken = new Set([...doc.classicStructure.tiles.map((t) => t.id), ...doc.entities.map((e) => e.id)]);
  const clash = [...tiles, ...entities].find((x) => taken.has(x.id));
  if (clash) return { error: `can't explode ${def.displayName}: the map already has a piece called ${clash.id}` };
  return {
    command: { kind: 'batch', commands: [{ kind: 'removeSetPieces', setPieces: [p] }, { kind: 'addTiles', tiles }, { kind: 'addEntities', entities }] },
    selection: { tiles: tiles.map((t) => t.id), entities: entities.map((e) => e.id) },
  };
}

/** Put a set piece of the map's own (one saved from a selection) into the map, so placements of it play anywhere. */
export function addSetPieceDefCommand(doc: MapDocument, def: SetPieceDefinition): EditCommand | { error: string } {
  if (!def.id.startsWith('local.')) return { error: `a map's own set piece is named local.<name> (not ${def.id})` };
  const before = doc.setPieceDefs ?? null;
  const rest = (before ?? []).filter((d) => d.id !== def.id);
  return { kind: 'setSetPieceDefs', before, after: [...rest, def] };
}

// ---------------------------------------------------------------- save selection as set piece

/** The kinds of entity a set piece can hold. */
const PART_KINDS = new Set(['block', 'prop', 'door', 'ladder', 'light']);
/** Edge styles that make a way through (a port), not a wall. */
const OPENING_EDGES = new Set(['auto', 'open', 'door', 'wide', 'arch', 'arch_segmental', 'broken', 'shutter']);
const DOORISH_EDGES = new Set(['auto', 'door', 'shutter']);
const round6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0;

/** A name as an id: lower case letters, digits and _ (at most 40). */
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'piece';

/** The role pack whose materials, facades, door styles and glass the selection uses most (ties: the map theme's). */
function bestPack(library: SetPieceLibrary, theme: string, tiles: readonly TilePlacement[], entities: readonly MapEntity[]): SetPieceRolePack | null {
  const themed = placementPack({}, theme, library);
  let best: SetPieceRolePack | null = null;
  let most = 0;
  for (const pack of library.packs.values()) {
    const mats = Object.values(pack.roles).filter((v): v is SurfaceStyle => !!v && typeof v === 'object');
    const has = (m: string, tint: string | null) => mats.some((v) => v.material === m && (v.tint ?? null) === tint);
    let n = 0;
    for (const t of tiles) {
      for (const s of Object.values(t.surfaces ?? {})) if (s && has(s.material, s.tint)) n++;
      if (t.options?.facade && t.options.facade === pack.roles.facade) n++;
    }
    for (const e of entities) {
      if (e.kind === 'block' && e.material && has(e.material, e.tint)) n++;
      if (e.kind === 'door' && e.style && e.style === pack.roles.door) n++;
    }
    if (n > most || (n === most && n > 0 && pack === themed)) [best, most] = [pack, n];
  }
  return best;
}

/** The role a material stands for in a pack, preferring the one that paints the given theme slot. */
function roleFor(pack: SetPieceRolePack | null, s: SurfaceStyle, slot?: string): SetPieceMaterialRole | undefined {
  if (!pack) return undefined;
  const roles = (Object.keys(ROLE_THEME_SLOT) as SetPieceMaterialRole[]).filter((r) => {
    const v = pack.roles[r];
    return v && v.material === s.material && (v.tint ?? null) === (s.tint ?? null);
  });
  return roles.find((r) => ROLE_THEME_SLOT[r] === slot) ?? roles[0];
}

/**
 * "Save selection as set piece": a definition made of the selected tiles, blocks, props, doors, ladders and lights
 * (set pieces in it count as their parts), in the frame of `anchor` (a grid cell and level): its footprint the cells
 * and levels they cover, its ports the tiles' ports facing out of it, mirror `free` when every tile in it is its own
 * mirror image, and materials, facades, door styles and glass turned into roles where the role pack the selection
 * matches best gives them (that pack comes back too: a placement of the new piece takes it).
 */
export function setPieceFromSelection(
  doc: MapDocument,
  sel: Selection,
  anchor: readonly [number, number, number],
  opts: { id?: string; displayName?: string; category?: string; catalog?: TileCatalog; library?: SetPieceLibrary } = {},
): { definition: SetPieceDefinition; pack: string | null; problems: string[] } | { error: string } {
  const catalog = opts.catalog ?? coreCatalog;
  const library = opts.library ?? builtInSetPieces();
  const { cellSize, levelHeight } = SET_PIECE_GRID;
  if (doc.classicStructure.cellSize !== cellSize || doc.classicStructure.levelHeight !== levelHeight) return { error: 'set pieces need the standard grid (8 m cells, 4 m levels)' };
  const tileIds = new Set(sel.tiles);
  const entityIds = new Set(sel.entities);
  const pieceIds = new Set(sel.setPieces ?? []);
  const tiles: TilePlacement[] = doc.classicStructure.tiles.filter((t) => tileIds.has(t.id));
  const entities: MapEntity[] = doc.entities.filter((e) => entityIds.has(e.id));
  // Set pieces in the selection count as what they are made of.
  const pieces = piecesFor(doc, library);
  for (const p of doc.setPieces ?? []) {
    if (!pieceIds.has(p.id)) continue;
    const def = pieces.get(p.piece);
    if (!def) return { error: `unknown set piece ${p.piece}` };
    const parts = setPieceParts(p, def, doc.classicStructure.theme, library, catalog);
    tiles.push(...parts.tiles);
    entities.push(...parts.entities);
  }
  if (!tiles.length && !entities.length) return { error: 'nothing selected: select tiles, blocks, props, doors, ladders or lights' };
  const others = [...new Set(entities.filter((e) => !PART_KINDS.has(e.kind)).map((e) => e.kind))];
  if (others.length) return { error: `a set piece is made of tiles, blocks, props, doors, ladders and lights: leave out the ${others.join(', ')}` };

  const pack = bestPack(library, doc.classicStructure.theme, tiles, entities);
  const [ax, ay, az] = anchor;
  const surface = (s: SurfaceStyle, slot: string) => {
    const role = roleFor(pack, s, slot);
    return role ? { role } : s;
  };
  const parts: SetPiecePart[] = [];
  const cells = new Set<string>();
  let [lo, hi] = [Infinity, -Infinity];
  const claim = (x: number, y: number, z: number) => {
    cells.add(`${x},${y}`);
    lo = Math.min(lo, z);
    hi = Math.max(hi, z);
  };
  const ports: SetPieceDefinition['ports'] = [];
  const portCandidates: { cell: [number, number]; side: Side; level: number; kind: 'door' | 'opening' }[] = [];
  let mirror: 'free' | 'none' = 'free';
  for (const t of tiles) {
    const def = catalog.get(t.tile);
    if (!def) return { error: `unknown tile ${t.tile}` };
    if (tileMirrorAxis(def) === null) mirror = 'none';
    const x = t.x - ax;
    const y = t.y - ay;
    const z = t.z - az;
    for (const [dx, dy, dz] of def.cells) {
      const [rx, ry] = rotateXZ(dx, dy, t.rotation);
      claim(x + rx, y + ry, z + dz);
    }
    for (const port of def.ports) {
      const [cx, cy] = port.cell ?? [0, 0];
      const choice = t.edges?.[`${cx},${cy},${port.level}:${port.side}`] ?? 'auto';
      if (!OPENING_EDGES.has(choice)) continue;
      const [rx, ry] = rotateXZ(cx, cy, t.rotation);
      portCandidates.push({ cell: [x + rx, y + ry], side: rotateSide(port.side, t.rotation), level: z + port.level, kind: def.open || !DOORISH_EDGES.has(choice) ? 'opening' : 'door' });
    }
    const { id: _id, surfaces, glass, options, ...rest } = t;
    void _id;
    const part: Extract<SetPiecePart, { kind: 'tile' }> = { ...rest, kind: 'tile', x, y, z };
    if (surfaces) part.surfaces = Object.fromEntries(Object.entries(surfaces).flatMap(([slot, s]) => (s ? [[slot, surface(s, slot)]] : [])));
    if (glass) part.glass = Object.fromEntries(Object.entries(glass).map(([k, v]) => [k, pack?.roles.glass === v ? { role: 'glass' as const } : v]));
    if (options) part.options = { ...options, ...(options.facade && pack?.roles.facade === options.facade ? { facade: { role: 'facade' as const } } : {}) };
    parts.push(part);
  }
  const tileCells = new Set(cells);
  for (const e of entities) {
    const position: [number, number, number] = [round6(e.position[0] - ax * cellSize), round6(e.position[1] - az * levelHeight), round6(e.position[2] - ay * cellSize)];
    // A point on the line between two cells (a door in a doorway) belongs to the one the tiles hold, if either.
    const cellOf = (px: number, py: number, pz: number) => {
      const near = (v: number) => [...new Set([Math.floor((v + cellSize / 2 + 1e-6) / cellSize), Math.floor((v + cellSize / 2 - 1e-6) / cellSize)])];
      const choices = near(px).flatMap((x) => near(pz).map((y) => [x, y] as const));
      const [x, y] = choices.find(([cx, cy]) => tileCells.has(`${cx},${cy}`)) ?? choices[0]!;
      claim(x, y, Math.floor((py + 0.01) / levelHeight));
    };
    const { id: _id, ...rest } = e;
    void _id;
    if (e.kind === 'block') {
      const [w, h, d] = e.size;
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        const [ox, oz] = yawXZ((sx * w) / 2, (sz * d) / 2, e.yaw);
        cellOf(position[0] + ox * 0.999, position[1], position[2] + oz * 0.999);
        cellOf(position[0] + ox * 0.999, position[1] + h - 0.02, position[2] + oz * 0.999);
      }
      const role = e.material ? roleFor(pack, { material: e.material, tint: e.tint }) : undefined;
      const glassRole = e.glass && pack?.roles.glass === e.glass;
      parts.push({ ...(rest as Omit<Extract<MapEntity, { kind: 'block' }>, 'id'>), position, ...(role ? { material: { role }, tint: null } : {}), ...(glassRole ? { glass: { role: 'glass' as const } } : {}) });
    } else {
      cellOf(position[0], position[1], position[2]);
      if (e.kind === 'door' && e.style && pack?.roles.door === e.style) parts.push({ ...(rest as Omit<Extract<MapEntity, { kind: 'door' }>, 'id'>), position, style: { role: 'door' } });
      else parts.push({ ...rest, position } as SetPiecePart);
    }
  }
  const has = (x: number, y: number, z: number) => cells.has(`${x},${y}`) && z >= lo && z <= hi;
  const seen = new Set<string>();
  for (const c of portCandidates) {
    const [dx, dy] = ({ N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] } as const)[c.side];
    const key = `${c.cell[0]},${c.cell[1]},${c.level}:${c.side}`;
    if (has(c.cell[0] + dx, c.cell[1] + dy, c.level) || seen.has(key)) continue;
    seen.add(key);
    ports.push(c);
  }
  const displayName = (opts.displayName ?? 'My set piece').slice(0, 60);
  const raw = {
    id: opts.id ?? `local.${slug(displayName)}`,
    displayName,
    family: 'custom',
    category: opts.category ?? 'My pieces',
    packs: pack ? [pack.id] : [],
    footprint: { cells: [...cells].map((k) => k.split(',').map(Number) as [number, number]).sort((a, b) => a[1] - b[1] || a[0] - b[0]), levels: [lo, hi] as [number, number] },
    mirror,
    ports,
    parts,
  };
  const parsed = SetPieceDefinition.safeParse(raw);
  if (!parsed.success) return { error: `the selection doesn't make a set piece: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).slice(0, 3).join('; ')}` };
  return { definition: parsed.data, pack: pack?.id ?? null, problems: checkSetPieceDefinition(parsed.data, { packs: library.packs, catalog }) };
}
