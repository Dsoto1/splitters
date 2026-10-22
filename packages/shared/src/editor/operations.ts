import { coreCatalog, type TileCatalog } from '../map/catalog.ts';
import { buildOccupancy, cellKey, rotateXZ } from '../map/geometry.ts';
import type { SurfaceSlot } from '../map/materials.ts';
import { MAP_FORMAT, MAP_FORMAT_VERSION, type MapDocument, type MapEntity, type Rotation, type SurfaceStyle, type TilePlacement } from '../map/schema.ts';
import { newId, type EditCommand } from './commands.ts';

/** Editor-level selection: stable IDs only, never object references or indices. */
export interface Selection {
  tiles: string[];
  entities: string[];
}

export const emptySelection = (): Selection => ({ tiles: [], entities: [] });

export type PlacementCheck = { ok: true } | { ok: false; reason: string; conflicts: string[] };

/** Grid cells a placement would occupy. */
export function placementCells(p: Pick<TilePlacement, 'tile' | 'x' | 'y' | 'z' | 'rotation'>, catalog: TileCatalog = coreCatalog): [number, number, number][] | null {
  const def = catalog.get(p.tile);
  if (!def) return null;
  return def.cells.map(([dx, dy, dz]) => {
    const [rx, ry] = rotateXZ(dx, dy, p.rotation);
    return [p.x + rx, p.y + ry, p.z + dz];
  });
}

/** Check that placements fit: known tiles, inside grid bounds, and no overlap with tiles not being replaced. */
export function checkPlacement(doc: MapDocument, placements: readonly TilePlacement[], ignoreIds: readonly string[] = [], catalog: TileCatalog = coreCatalog): PlacementCheck {
  const ignore = new Set([...ignoreIds, ...placements.map((p) => p.id)]);
  const others: MapDocument = { ...doc, classicStructure: { ...doc.classicStructure, tiles: doc.classicStructure.tiles.filter((t) => !ignore.has(t.id)) } };
  const { cells } = buildOccupancy(others, catalog);
  const claimed = new Map<string, string>();
  const conflicts = new Set<string>();
  for (const p of placements) {
    const pc = placementCells(p, catalog);
    if (!pc) return { ok: false, reason: `unknown tile ${p.tile}`, conflicts: [] };
    for (const [x, y, z] of pc) {
      if (Math.abs(x) > 256 || Math.abs(y) > 256 || Math.abs(z) > 16) return { ok: false, reason: 'outside the build area', conflicts: [] };
      const key = cellKey(x, y, z);
      const hit = cells.get(key);
      if (hit) conflicts.add(hit.placement.id);
      const mine = claimed.get(key);
      if (mine && mine !== p.id) conflicts.add(mine);
      claimed.set(key, p.id);
    }
  }
  return conflicts.size ? { ok: false, reason: 'overlaps another tile', conflicts: [...conflicts] } : { ok: true };
}

/** The tile occupying a grid cell, if any. */
export function tileAt(doc: MapDocument, x: number, y: number, z: number, catalog: TileCatalog = coreCatalog): TilePlacement | undefined {
  return buildOccupancy(doc, catalog).cells.get(cellKey(x, y, z))?.placement;
}

export function placeTileCommand(doc: MapDocument, tile: string, x: number, y: number, z: number, rotation: Rotation, catalog: TileCatalog = coreCatalog): { command: EditCommand; placement: TilePlacement } | { error: string } {
  const placement: TilePlacement = { id: newId('tile'), tile, x, y, z, rotation };
  const check = checkPlacement(doc, [placement], [], catalog);
  if (!check.ok) return { error: check.reason };
  return { command: { kind: 'addTiles', tiles: [placement] }, placement };
}

function selected(doc: MapDocument, sel: Selection): { tiles: TilePlacement[]; entities: MapEntity[] } {
  const t = new Set(sel.tiles);
  const e = new Set(sel.entities);
  return { tiles: doc.classicStructure.tiles.filter((x) => t.has(x.id)), entities: doc.entities.filter((x) => e.has(x.id)) };
}

export function deleteCommand(doc: MapDocument, sel: Selection): EditCommand {
  const { tiles, entities } = selected(doc, sel);
  return { kind: 'batch', commands: [{ kind: 'removeTiles', tiles }, { kind: 'removeEntities', entities }] };
}

/** Move selected tiles by whole cells and entities by the same world offset. */
export function moveCommand(doc: MapDocument, sel: Selection, dx: number, dy: number, dz: number, catalog: TileCatalog = coreCatalog): EditCommand | { error: string } {
  const { tiles, entities } = selected(doc, sel);
  const { cellSize, levelHeight } = doc.classicStructure;
  const moved = tiles.map((t) => ({ ...t, x: t.x + dx, y: t.y + dy, z: t.z + dz }));
  const check = checkPlacement(doc, moved, [], catalog);
  if (!check.ok) return { error: check.reason };
  const movedEntities = entities.map((e) => ({ ...e, position: [e.position[0] + dx * cellSize, e.position[1] + dz * levelHeight, e.position[2] + dy * cellSize] as [number, number, number] }));
  return {
    kind: 'batch',
    commands: [
      { kind: 'updateTiles', before: tiles, after: moved },
      { kind: 'updateEntities', before: entities, after: movedEntities },
    ],
  };
}

/** Rotate selected tiles a quarter turn clockwise in place, and spawns by 45°. */
export function rotateCommand(doc: MapDocument, sel: Selection, catalog: TileCatalog = coreCatalog): EditCommand | { error: string } {
  const { tiles, entities } = selected(doc, sel);
  const rotated = tiles.map((t) => ({ ...t, rotation: ((t.rotation + 1) % 4) as Rotation }));
  const check = checkPlacement(doc, rotated, [], catalog);
  if (!check.ok) return { error: check.reason };
  const turned = entities.map((e) => (e.kind === 'spawn' ? { ...e, yaw: normalizeYaw(e.yaw + Math.PI / 4) } : e));
  return {
    kind: 'batch',
    commands: [
      { kind: 'updateTiles', before: tiles, after: rotated },
      { kind: 'updateEntities', before: entities, after: turned },
    ],
  };
}

/** Copy the selection to the first free offset east of it. Returns the new selection. */
export function duplicateCommand(doc: MapDocument, sel: Selection, catalog: TileCatalog = coreCatalog): { command: EditCommand; selection: Selection } | { error: string } {
  const { tiles, entities } = selected(doc, sel);
  if (!tiles.length && !entities.length) return { error: 'nothing selected' };
  const { cellSize } = doc.classicStructure;
  for (let dx = 1; dx <= 32; dx++) {
    const copies = tiles.map((t) => ({ ...t, id: newId('tile'), x: t.x + dx }));
    if (!checkPlacement(doc, copies, [], catalog).ok) continue;
    const entityCopies = entities.map((e) => ({ ...e, id: newId(e.kind), position: [e.position[0] + dx * cellSize, e.position[1], e.position[2]] as [number, number, number] }));
    return {
      command: { kind: 'batch', commands: [{ kind: 'addTiles', tiles: copies }, { kind: 'addEntities', entities: entityCopies }] },
      selection: { tiles: copies.map((c) => c.id), entities: entityCopies.map((c) => c.id) },
    };
  }
  return { error: 'no free space to duplicate into' };
}

export function addSpawnCommand(position: [number, number, number], yaw: number): { command: EditCommand; id: string } {
  const id = newId('spawn');
  return { command: { kind: 'addEntities', entities: [{ id, kind: 'spawn', position, yaw, faction: null }] }, id };
}

export function normalizeYaw(yaw: number): number {
  let y = yaw % (Math.PI * 2);
  if (y > Math.PI) y -= Math.PI * 2;
  if (y <= -Math.PI) y += Math.PI * 2;
  return Math.round(y * 1000) / 1000;
}

/** A new map: one room and one spawn, so TEST works immediately. */
export function newMapDocument(name = 'Untitled Map', now: Date = new Date()): MapDocument {
  const ts = now.toISOString();
  return {
    format: MAP_FORMAT,
    formatVersion: MAP_FORMAT_VERSION,
    metadata: {
      id: newId('map'),
      name,
      author: '',
      description: '',
      createdAt: ts,
      updatedAt: ts,
      parentId: null,
      recommendedPlayers: { min: 2, max: 8 },
      supportedModes: ['core.deathmatch'],
    },
    classicStructure: { cellSize: 8, levelHeight: 4, theme: 'core.prototype', tiles: [{ id: newId('tile'), tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }] },
    entities: [{ id: newId('spawn'), kind: 'spawn', position: [0, 0, 0], yaw: 0, faction: null }],
    dependencies: [],
  };
}

/** Change one tile (type, position or rotation) if the result still fits. */
export function updateTileCommand(doc: MapDocument, before: TilePlacement, after: TilePlacement, catalog: TileCatalog = coreCatalog): EditCommand | { error: string } {
  const check = checkPlacement(doc, [after], [before.id], catalog);
  if (!check.ok) return { error: check.reason };
  return { kind: 'updateTiles', before: [before], after: [after] };
}

/** Move entities by a free world offset (entity-only drags snap finer than a grid cell). */
export function moveEntitiesCommand(doc: MapDocument, ids: readonly string[], dx: number, dy: number, dz: number): EditCommand {
  const set = new Set(ids);
  const before = doc.entities.filter((e) => set.has(e.id));
  const r = (v: number) => Math.round(v * 1000) / 1000;
  const after = before.map((e) => ({ ...e, position: [r(e.position[0] + dx), r(e.position[1] + dy), r(e.position[2] + dz)] as [number, number, number] }));
  return { kind: 'updateEntities', before, after };
}

/** Which tiles a paint stroke affects (PLAYER_EXPRESSION.md §1). */
export type PaintScope = 'surface' | 'sameType' | 'level' | 'all';

/**
 * Set one surface slot on the clicked tile, or on every tile in the chosen
 * scope. `style` null clears the override back to the theme default.
 * Tiles already carrying the exact style are left out, so the command only
 * records real changes.
 */
export function paintCommand(doc: MapDocument, tileId: string, slot: SurfaceSlot, style: SurfaceStyle | null, scope: PaintScope = 'surface'): EditCommand {
  const origin = doc.classicStructure.tiles.find((t) => t.id === tileId);
  if (!origin) return { kind: 'updateTiles', before: [], after: [] };
  const inScope = (t: TilePlacement) =>
    scope === 'surface' ? t.id === tileId : scope === 'sameType' ? t.tile === origin.tile : scope === 'level' ? t.z === origin.z : true;
  const before: TilePlacement[] = [];
  const after: TilePlacement[] = [];
  for (const t of doc.classicStructure.tiles) {
    if (!inScope(t)) continue;
    const current = t.surfaces?.[slot];
    const same = style === null ? current === undefined : current?.material === style.material && (current.tint ?? null) === (style.tint ?? null);
    if (same) continue;
    const surfaces = { ...t.surfaces };
    if (style === null) delete surfaces[slot];
    else surfaces[slot] = { material: style.material, tint: style.tint ?? null };
    const next: TilePlacement = { ...t, surfaces };
    if (Object.keys(surfaces).length === 0) delete next.surfaces;
    before.push(t);
    after.push(next);
  }
  return { kind: 'updateTiles', before, after };
}

/** Change the map's theme (its default palette). Tile overrides are kept. */
export function setThemeCommand(doc: MapDocument, theme: string): EditCommand {
  return { kind: 'setTheme', before: doc.classicStructure.theme, after: theme };
}
