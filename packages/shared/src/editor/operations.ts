import { SIDE_DIRS, coreCatalog, type EdgeStyle, type Side, type TileCatalog } from '../map/catalog.ts';
import { buildOccupancy, cellKey, edgeKey, localSide, rotateXZ } from '../map/geometry.ts';
import type { SurfaceSlot } from '../map/materials.ts';
import { emptyLogic } from '../map/logic.ts';
import { DESTRUCTIBLE_SPECS, TRAP_SPECS } from '../sim/scenarioDefs.ts';
import { ELECTRIC_FENCE } from '../map/border.ts';
import { MAP_FORMAT, MAP_FORMAT_VERSION, type MapDocument, type MapEntity, type Rotation, type SurfaceStyle, type TilePlacement, type TrapKind, type BlockBehaviour, type Liquid, type LightFixture, type EncounterEntrance } from '../map/schema.ts';
import { newId, type EditCommand } from './commands.ts';
import { getProp } from '../content/props.ts';
import { DEFAULT_TEAMS, mapTeams } from '../sim/npc.ts';
import { FLOAT_TOLERANCE, floatingProps, settledPropY, supportBoxes, supportUnder } from '../map/settle.ts';

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
  // Spawns turn in 45° steps; doors, traps and other facing objects in quarter turns.
  const turned = entities.map((e) => (e.kind === 'spawn' ? { ...e, yaw: normalizeYaw(e.yaw + Math.PI / 4) } : 'yaw' in e ? { ...e, yaw: normalizeYaw(e.yaw + Math.PI / 2) } : e));
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
    factions: [],
    logic: emptyLogic(),
    terrain: null,
    bounds: null,
    track: null,
    teamSetup: null,
    backdrop: null,
    blood: null,
    physics: null,
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
  const t = doc.terrain;
  const after = before.map((e): MapEntity => {
    const moved = { ...e, position: [r(e.position[0] + dx), r(e.position[1] + dy), r(e.position[2] + dz)] as [number, number, number] };
    // A prop resting on the terrain stays on it: re-bedded at its new spot, uphill or down.
    if (t && e.kind === 'prop' && moved.kind === 'prop' && !dy) {
      const was = settledPropY(t, e);
      const now = settledPropY(t, moved);
      if (was !== null && now !== null && Math.abs(e.position[1] - was) <= FLOAT_TOLERANCE) moved.position = [moved.position[0], now, moved.position[2]];
    }
    return moved;
  });
  return { kind: 'updateEntities', before, after };
}

/**
 * Bed props into the terrain under them (the given ones, or every prop on the
 * terrain): base at the lowest ground under the footprint. Props on a floor,
 * block or another prop stay put.
 */
export function settlePropsCommand(doc: MapDocument, ids?: readonly string[]): EditCommand {
  const t = doc.terrain;
  const before: MapEntity[] = [];
  const after: MapEntity[] = [];
  if (!t) return { kind: 'updateEntities', before, after };
  const want = ids ? new Set(ids) : null;
  const boxes = supportBoxes(doc);
  const floating = new Set(floatingProps(doc, boxes).map((f) => f.id));
  for (const e of doc.entities) {
    if (e.kind !== 'prop' || (want && !want.has(e.id))) continue;
    const y = settledPropY(t, e);
    if (y === null || Math.abs(y - e.position[1]) < 0.01) continue;
    // Held up by a floor, block or another prop above the ground: it stays where it stands.
    const held = supportUnder(boxes, e.position[0], e.position[2], e.position[1], e.id);
    if (held > y + 0.05 && held >= e.position[1] - FLOAT_TOLERANCE) continue;
    // Only props near the ground (or reported floating), never ones up on a roof or a crate.
    const near = e.position[1] - y < FLOAT_TOLERANCE + 0.05 && e.position[1] - y > -1.5;
    if (!near && !floating.has(e.id)) continue;
    before.push(e);
    after.push({ ...e, position: [e.position[0], y, e.position[2]] });
  }
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

// ---------------------------------------------------------------- scenario entities

/** Palette entries for scenario objects. Each creates one entity with sensible defaults. */
export const SCENARIO_PALETTE = [
  { key: 'door', label: 'Door', search: 'door auto sliding gate' },
  { key: 'door_locked', label: 'Locked Door', search: 'door locked key gate vault' },
  { key: 'button', label: 'Button', search: 'button switch lever press use' },
  { key: 'pad', label: 'Jump Pad', search: 'jump pad launch bounce boost trampoline' },
  { key: 'ladder', label: 'Ladder', search: 'ladder climb wall up rungs' },
  { key: 'flag', label: 'Flag Base', search: 'flag base ctf capture the flag team objective' },
  { key: 'hill', label: 'Hill', search: 'hill king of the hill koth zone objective control point' },
  { key: 'hostage', label: 'Hostage', search: 'hostage rescue civilian objective counter strike cs' },
  { key: 'rescue', label: 'Rescue Zone', search: 'rescue zone hostage extraction objective' },
  { key: 'bombsite', label: 'Bomb Site', search: 'bomb site plant defuse objective counter strike cs a b' },
  { key: 'crate', label: 'Crate', search: 'crate box destructible break cover' },
  { key: 'barrel', label: 'Explosive Barrel', search: 'barrel explosive destructible red boom' },
  { key: 'wall', label: 'Breakable Wall', search: 'wall breakable destructible breach' },
  { key: 'glass', label: 'Window Pane', search: 'glass window pane breakable shatter destructible' },
  { key: 'boards', label: 'Board Barricade', search: 'boards planks barricade doorway breakable destructible' },
  { key: 'gas', label: 'Gas Cylinder', search: 'gas cylinder tank explosive destructible boom' },
  { key: 'generator', label: 'Generator', search: 'generator machine objective destroy explosive destructible' },
  { key: 'zone', label: 'Trigger Zone', search: 'zone trigger volume area region enter' },
  { key: 'encounter', label: 'NPC Squad', search: 'npc squad encounter enemy soldiers spawner faction ai' },
  { key: 'encounter:vent', label: 'Ceiling Vent Spawner', search: 'npc spawner vent ceiling duct drop squad enemy soldiers' },
  { key: 'encounter:hatch', label: 'Floor Hatch Spawner', search: 'npc spawner hatch floor manhole sewer climb squad enemy soldiers' },
  { key: 'encounter:burrow', label: 'Burrow Spawner', search: 'npc spawner burrow hole ground dig creatures monsters nest' },
  { key: 'encounter:breach', label: 'Wall Breach Spawner', search: 'npc spawner breach broken wall hole crack squad enemy soldiers creatures' },
  { key: 'trap:spikes', label: 'Spike Floor', search: 'trap spikes floor hazard' },
  { key: 'trap:flames', label: 'Flame Jet', search: 'trap flame fire jet hazard burn' },
  { key: 'trap:crusher', label: 'Crusher', search: 'trap crusher ceiling piston hazard' },
  { key: 'trap:mine', label: 'Proximity Mine', search: 'trap mine explosive proximity hazard' },
  { key: 'trap:laser', label: 'Laser Fence', search: 'trap laser beam fence tripwire hazard' },
  { key: 'trap:shock', label: 'Electric Fence', search: 'trap electric fence park dino zoo shock zap wire posts barrier prop hazard border' },
  { key: 'block:solid', label: 'Sky Block', search: 'block sky platform floating box stepping stone ledge solid' },
  { key: 'block:crumble', label: 'Crumbling Floor', search: 'block crumble crumbling platform give way collapse falling floor' },
  { key: 'block:trapdoor', label: 'Trapdoor', search: 'block trapdoor trap door fall drop pit floor hatch' },
  { key: 'block:breakable', label: 'Breakable Block', search: 'block breakable destructible platform shoot' },
  { key: 'light:ceiling', label: 'Ceiling Light', search: 'light lamp ceiling panel lighting bright interior indoor' },
  { key: 'light:wall', label: 'Wall Lamp', search: 'light lamp wall sconce lighting bright' },
  { key: 'light:bulb', label: 'Light Bulb', search: 'light bulb lamp hanging lighting bright' },
  { key: 'light:strip', label: 'Strip Light', search: 'light strip neon fluorescent tube lighting bright' },
  { key: 'light:none', label: 'Hidden Light', search: 'light glow fill hidden invisible lighting bright' },
  { key: 'water:water', label: 'Water', search: 'water pool lake river swim liquid' },
  { key: 'water:lava', label: 'Lava', search: 'lava magma liquid hazard burn' },
  { key: 'water:acid', label: 'Acid', search: 'acid toxic liquid hazard pool' },
  { key: 'water:swamp', label: 'Swamp', search: 'swamp mud bog marsh liquid slow' },
  { key: 'airplane', label: 'Transport Plane', search: 'airplane plane transport air drop parachute route fly over battle royale jump' },
  { key: 'mover:lift', label: 'Lift', search: 'mover lift elevator platform moving up down ride' },
  { key: 'mover:slider', label: 'Sliding Wall', search: 'mover sliding wall door gate moving platform train car shuttle' },
  { key: 'mover:drawbridge', label: 'Drawbridge', search: 'mover drawbridge bridge hinge lower raise castle moat' },
  // Style Pack gameplay pieces (04 Orbital Station, 07 Neon Megacity).
  { key: 'block:field', label: 'Force Field', search: 'force field energy shield barrier laser gate sci-fi orbital station blocks players not shots hum logic' },
  { key: 'zone:lowgrav', label: 'Low-Gravity Zone', search: 'low gravity zone moon float drift space reactor jump orbital station' },
  { key: 'light:sign', label: 'Neon Sign', search: 'neon sign signage glow lit letters shop bar light logic neon megacity cyberpunk' },
  { key: 'light:billboard', label: 'Holo Billboard', search: 'billboard hologram holographic screen advert sign emissive light logic neon megacity cyberpunk' },
  { key: 'mover:elevator', label: 'Tower Elevator', search: 'mover elevator lift tower floors storeys cab ride up down neon megacity' },
  { key: 'mover:tram', label: 'Sky Tram', search: 'mover tram skytrain transit train car shuttle cable car ride moving platform neon megacity' },
  // Style Pack gameplay pieces (01 Military Compound, 02 Frontier Dust), built on the same systems.
  { key: 'door:blast', label: 'Blast Door', search: 'door blast security bunker military compound heavy steel hazard' },
  { key: 'door:saloon', label: 'Saloon Doors', search: 'door saloon swinging batwing western frontier' },
  { key: 'door:vault', label: 'Vault Door', search: 'door vault bank safe locked round steel heist frontier' },
  { key: 'light:alarm', label: 'Alarm Light', search: 'light alarm red blinking beacon siren security military logic' },
  { key: 'block:barrier', label: 'Destructible Barrier', search: 'block barrier destructible concrete breakable military cover' },
  { key: 'block:planks', label: 'Breakable Planks', search: 'block planks wood breakable boards wall western frontier' },
  { key: 'mover:minecart', label: 'Mine Cart', search: 'mover mine cart rails ride ore western frontier' },
  { key: 'mover:train', label: 'Steam Train', search: 'mover train locomotive railroad rails ride western frontier wagon' },
] as const;

export type ScenarioPaletteKey = (typeof SCENARIO_PALETTE)[number]['key'];

/** Entities that sit in a doorway and snap to cell edges. */
export const snapsToDoorway = (key: ScenarioPaletteKey): boolean => key === 'door' || key === 'door_locked' || key.startsWith('door:') || key === 'wall' || key === 'glass' || key === 'boards' || key === 'trap:laser' || key === 'block:field';

/**
 * What a palette entry places: one entity, or for movers a block and the
 * mover that carries it (lift platform, sliding wall, drawbridge deck).
 */
export function newScenarioEntities(key: ScenarioPaletteKey, position: [number, number, number], yaw: number, doc?: MapDocument): MapEntity[] {
  if (!key.startsWith('mover:')) return [newScenarioEntity(key, position, yaw, doc)];
  const block = (size: [number, number, number], at: [number, number, number]): Extract<MapEntity, { kind: 'block' }> => ({ id: newId('block'), kind: 'block', position: at, yaw, size, material: null, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 });
  const mover = (blocks: string[], points: [number, number, number][], extra: Partial<Extract<MapEntity, { kind: 'mover' }>>): Extract<MapEntity, { kind: 'mover' }> => ({ id: newId('mover'), kind: 'mover', position, yaw, blocks, points, mode: 'pingpong', speed: 2, turnSpeed: 45, wait: 2, startActive: true, ...extra });
  const [x, y, z] = position;
  // Along the facing: local +Z goes to (sin yaw, cos yaw), like props.
  const along = (d: number): [number, number] => [Math.round(Math.sin(yaw) * d * 100) / 100, Math.round(Math.cos(yaw) * d * 100) / 100];
  const prop = (model: string, d: number, turn = 0): Extract<MapEntity, { kind: 'prop' }> => {
    const [dx, dz] = along(d);
    return { id: newId('prop'), kind: 'prop', model, position: [x + dx, y, z + dz], yaw: yaw + turn, scale: 1, solid: false, tint: null };
  };
  /** A block `size` (x across, y up, z along) centred `d` along the facing, `y0` up. */
  const hull = (size: [number, number, number], d: number, y0: number, material: string, tint: string | null): Extract<MapEntity, { kind: 'block' }> => {
    const [dx, dz] = along(d);
    return { ...block(size, [x + dx, y + y0, z + dz]), material, tint };
  };
  if (key === 'mover:minecart') {
    // A cart on a block you can stand on (the ore in the tub), rolling 12 m along the facing and back.
    const b = hull([0.96, 0.72, 1.24], 0, 0.14, 'core.pbr_rock', '#5a5048');
    const cart = prop('prop.mine_cart', 0);
    const [ex, ez] = along(12);
    return [b, cart, { ...mover([b.id], [[0, 0, 0], [ex, 0, ez]], { speed: 3, wait: 2 }), props: [cart.id] }];
  }
  if (key === 'mover:train') {
    // A locomotive and two flatbed wagons on hidden chassis blocks, running 60 m along the facing and back.
    // The locomotive model's chimney end is its -Z, so it is turned to lead.
    const loco = prop('prop.locomotive_red', 0, Math.PI);
    const cars = [prop('prop.flatbed_wagon', -7.4), prop('prop.flatbed_wagon', -14.9)];
    const dark = '#2e2c2a';
    const blocks = [hull([2.0, 2.0, 3.6], 1.5, 0.6, 'core.pbr_steel', dark), hull([2.9, 3.1, 2.8], -1.8, 0.6, 'core.pbr_steel', dark), ...cars.map((c, i) => hull([2.7, 0.35, 6.6], -7.4 - 7.5 * i, 0.55, 'core.pbr_weathered_planks', null))];
    const [ex, ez] = along(60);
    return [...blocks, loco, ...cars, { ...mover(blocks.map((b) => b.id), [[0, 0, 0], [ex, 0, ez]], { speed: 8, wait: 6 }), props: [loco.id, ...cars.map((c) => c.id)] }];
  }
  if (key === 'mover:lift') {
    // A 3 m platform that rides one storey up and back.
    const b = block([3, 0.4, 3], [x, y, z]);
    return [b, mover([b.id], [[0, 0, 0], [0, doc?.classicStructure.levelHeight ?? 4, 0]], { speed: 2, wait: 2.5 })];
  }
  if (key === 'mover:elevator') {
    // A 3 m cab floor with a roof that rides three storeys up and back, waiting at the top and bottom.
    const up = 3 * (doc?.classicStructure.levelHeight ?? 4);
    const floor = block([3, 0.3, 3], [x, y, z]);
    return [floor, mover([floor.id], [[0, 0, 0], [0, up, 0]], { speed: 3, wait: 3, name: 'Elevator' })];
  }
  if (key === 'mover:tram') {
    // A tram car (a 3 × 7 m floor with a roof on posts) running 24 m along its facing and back.
    const [fx, fz] = [Math.sin(yaw), Math.cos(yaw)];
    const floor = block([3, 0.3, 7], [x, y, z]);
    const roof = block([3.2, 0.25, 7.2], [x, y + 3, z]);
    const posts = ([[-1.4, -3.3], [1.4, -3.3], [-1.4, 3.3], [1.4, 3.3]] as const).map(([px, pz]) => block([0.2, 2.7, 0.2], [Math.round((x + px * Math.cos(yaw) + pz * fx) * 100) / 100, y + 0.3, Math.round((z - px * Math.sin(yaw) + pz * fz) * 100) / 100]));
    const parts = [floor, roof, ...posts];
    return [...parts, mover(parts.map((b) => b.id), [[0, 0, 0], [Math.round(fx * 2400) / 100, 0, Math.round(fz * 2400) / 100]], { speed: 4, wait: 4, name: 'Sky tram' })];
  }
  if (key === 'mover:slider') {
    // A wall that slides 4 m sideways and back (a gate, a train car, a crushing corridor).
    const [sx, sz] = [Math.cos(yaw) * 4, -Math.sin(yaw) * 4];
    const b = block([4, 3, 0.4], [x, y, z]);
    return [b, mover([b.id], [[0, 0, 0], [Math.round(sx * 100) / 100, 0, Math.round(sz * 100) / 100]], { speed: 1.5, wait: 3 })];
  }
  // Drawbridge: an 8 m deck hinged at the marker, reaching out the way it faces; starts raised, logic lowers it.
  const b = block([3, 0.3, 8], [x + Math.sin(yaw) * 4, y, z + Math.cos(yaw) * 4]);
  return [b, mover([b.id], [[0, 0, 0], [0, 0, 0]], { angles: [Math.PI / 2, 0], mode: 'trigger', turnSpeed: 30, wait: 0 })];
}

/**
 * A new scenario entity with sensible defaults. Flag bases go to the first
 * team (of the map's two) that has none yet when `doc` is given.
 */
export function newScenarioEntity(key: ScenarioPaletteKey, position: [number, number, number], yaw: number, doc?: MapDocument): MapEntity {
  const base = { position, yaw };
  switch (key) {
    case 'flag': {
      const teams = doc ? mapTeams(doc, 2) : DEFAULT_TEAMS.slice(0, 2);
      const free = teams.find((t) => !doc?.entities.some((e) => e.kind === 'flag' && e.team === t.id)) ?? teams[0]!;
      return { id: newId('flag'), kind: 'flag', ...base, team: free.id };
    }
    case 'hill':
      return { id: newId('hill'), kind: 'hill', position, radius: 5 };
    case 'hostage':
      return { id: newId('hostage'), kind: 'hostage', position, yaw: 0 };
    case 'rescue':
      return { id: newId('rescue'), kind: 'rescue', position, radius: 4 };
    case 'bombsite': {
      // A, then B, then C…
      const n = doc?.entities.filter((e) => e.kind === 'bombsite').length ?? 0;
      return { id: newId('site'), kind: 'bombsite', position, label: String.fromCharCode(65 + Math.min(n, 25)), radius: 4 };
    }
    case 'door':
    case 'door_locked':
      return { id: newId('door'), kind: 'door', ...base, startOpen: false, locked: key === 'door_locked', auto: key === 'door' };
    case 'door:blast':
      // Opened by logic or E (wire it to a button and an alarm light).
      return { id: newId('door'), kind: 'door', ...base, startOpen: false, locked: false, auto: false, style: 'blast' };
    case 'door:saloon':
      return { id: newId('door'), kind: 'door', ...base, startOpen: false, locked: false, auto: true, style: 'saloon' };
    case 'door:vault':
      return { id: newId('door'), kind: 'door', ...base, startOpen: false, locked: true, auto: false, style: 'vault' };
    case 'light:alarm':
      return { id: newId('light'), kind: 'light', position, yaw, color: '#ff3020', intensity: 1.6, range: 12, fixture: 'bulb', off: true, blink: 2.5 };
    case 'block:barrier':
      return { id: newId('block'), kind: 'block', position, yaw, size: [3, 1.1, 0.8], material: 'core.pbr_bunker_panels', tint: null, behaviour: 'breakable', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 30, health: 400 };
    case 'block:planks':
      return { id: newId('block'), kind: 'block', position, yaw, size: [3, 3, 0.25], material: 'core.pbr_weathered_planks', tint: null, behaviour: 'breakable', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 20, health: 80 };
    case 'button':
      return { id: newId('button'), kind: 'button', ...base, label: 'Press', once: false, cooldownSeconds: 1, startEnabled: true };
    case 'pad':
      return { id: newId('pad'), kind: 'pad', ...base, power: 14, push: 6 };
    case 'ladder':
      return { id: newId('ladder'), kind: 'ladder', ...base, height: 4, width: 0.9 };
    case 'crate':
    case 'barrel':
    case 'wall':
    case 'glass':
    case 'boards':
    case 'gas':
    case 'generator':
      return { id: newId(key), kind: 'destructible', model: key, ...base, health: null, explosiveOnly: false };
    case 'zone':
      return { id: newId('zone'), kind: 'zone', position, size: [4, 3, 4], who: 'any', count: 1, startEnabled: true };
    case 'encounter':
    case 'encounter:vent':
    case 'encounter:hatch':
    case 'encounter:burrow':
    case 'encounter:breach': {
      const entrance = (key.slice(10) || 'none') as EncounterEntrance;
      // Burrows and breaches suit creatures; vents and hatches soldiers. Entrances keep a trickle coming.
      const creatures = entrance === 'burrow';
      return {
        id: newId('squad'),
        kind: 'encounter',
        position,
        yaw,
        faction: 'syndicate',
        roster: creatures ? { trooper: 0, gunner: 0, heavy: 0, imp: 2, puglin: 1, cyclops: 0, oculus: 0, scolitex: 0 } : { trooper: 2, gunner: 1, heavy: 0, imp: 0, puglin: 0, cyclops: 0, oculus: 0, scolitex: 0 },
        activeCap: 4,
        reinforcements: entrance === 'none' ? 0 : 3,
        perPlayer: 1,
        respawnSeconds: 4,
        radius: 3,
        order: 'hold',
        orderTarget: null,
        startActive: true,
        difficulty: 'normal',
        entrance,
        ventHeight: 3.5,
      };
    }
    case 'block:solid':
    case 'block:crumble':
    case 'block:trapdoor':
    case 'block:breakable': {
      const behaviour = key.slice(6) as BlockBehaviour;
      return { id: newId('block'), kind: 'block', position, yaw: 0, size: [4, 0.5, 4], material: null, tint: null, behaviour, trigger: 'step', delaySeconds: behaviour === 'trapdoor' ? 0.15 : 0.8, respawnSeconds: 8, health: 120 };
    }
    case 'light:ceiling':
    case 'light:wall':
    case 'light:bulb':
    case 'light:strip':
    case 'light:none': {
      const fixture = key.slice(6) as LightFixture;
      return { id: newId('light'), kind: 'light', position, yaw, color: fixture === 'strip' ? '#e8f4ff' : '#fff1d6', intensity: 1, range: fixture === 'none' ? 12 : 10, fixture };
    }
    case 'light:sign':
      return { id: newId('light'), kind: 'light', position, yaw, color: '#ff4fd8', intensity: 1.2, range: 8, fixture: 'sign', text: 'OPEN' };
    case 'light:billboard':
      return { id: newId('light'), kind: 'light', position, yaw, color: '#4fe0ff', intensity: 1.5, range: 14, fixture: 'billboard', text: 'TILE TRIGGER' };
    case 'block:field':
      // A doorway-sized sheet: 3 m wide, 3 m high, 0.2 m thick, along its facing's X.
      return { id: newId('field'), kind: 'block', position, yaw, size: [3, 3, 0.2], material: null, tint: '#5ad8ff', behaviour: 'solid', trigger: 'logic', delaySeconds: 0.8, respawnSeconds: null, health: 120, field: true };
    case 'zone:lowgrav':
      return { id: newId('zone'), kind: 'zone', position, size: [8, 8, 8], who: 'any', count: 1, startEnabled: true, gravity: 0.35, name: 'Low gravity' };
    case 'airplane':
      // A square loop 160 m across, 70 m up, once a minute; no air drop until the creator picks one.
      return { id: newId('plane'), kind: 'airplane', position, route: [[-80, -80], [80, -80], [80, 80], [-80, 80]], altitude: 70, loopSeconds: 60, closed: true, airdrop: 'off' };
    case 'water:water':
    case 'water:lava':
    case 'water:acid':
    case 'water:swamp':
      return { id: newId(key.slice(6)), kind: 'water', position, size: [8, 1.2, 8], liquid: key.slice(6) as Liquid };
    case 'mover:lift':
    case 'mover:slider':
    case 'mover:drawbridge':
    case 'mover:elevator':
    case 'mover:tram':
    case 'mover:minecart':
    case 'mover:train': {
      const all = newScenarioEntities(key, position, yaw, doc);
      return all[all.length - 1]!;
    }
    default: {
      const trap = key.slice(5) as TrapKind;
      const d = TRAP_SPECS[trap].defaults;
      return { id: newId(trap), kind: 'trap', trap, ...base, activation: d.activation, onSeconds: d.onSeconds, offSeconds: d.offSeconds, offsetSeconds: 0, startEnabled: true, damage: null, ...(trap === 'shock' ? { length: ELECTRIC_FENCE.defaultLength } : {}) };
    }
  }
}

/**
 * Snap a point to the middle of the nearest Classic Grid cell edge (where
 * doorways are), returning the position and the facing that spans the opening.
 */
export function snapToDoorway(x: number, z: number, cellSize: number): { x: number; z: number; yaw: number } {
  const half = cellSize / 2;
  // Candidate on a wall running along Z (between cells east/west) and along X.
  const ex = Math.round((x - half) / cellSize) * cellSize + half;
  const ez = Math.round(z / cellSize) * cellSize;
  const nx = Math.round(x / cellSize) * cellSize;
  const nz = Math.round((z - half) / cellSize) * cellSize + half;
  return Math.hypot(x - ex, z - ez) <= Math.hypot(x - nx, z - nz) ? { x: ex, z: ez, yaw: Math.PI / 2 } : { x: nx, z: nz, yaw: 0 };
}

const KIND_LABELS: Record<MapEntity['kind'], string> = { spawn: 'Spawn', pickup: 'Pickup', door: 'Door', button: 'Button', destructible: 'Object', zone: 'Zone', trap: 'Trap', encounter: 'Encounter', prop: 'Prop', mount: 'Vehicle', pad: 'Jump Pad', block: 'Block', water: 'Water', flag: 'Flag Base', hill: 'Hill', ladder: 'Ladder', bombsite: 'Bomb Site', hostage: 'Hostage', rescue: 'Rescue Zone', light: 'Light', airplane: 'Transport Plane', mover: 'Mover' };

/** Display name for an entity: its creator name, or "Door 2" style numbering by kind. */
export function entityLabel(doc: MapDocument, e: MapEntity): string {
  if (e.name) return e.name;
  let kind = KIND_LABELS[e.kind];
  if (e.kind === 'trap') kind = TRAP_SPECS[e.trap].label;
  if (e.kind === 'destructible') kind = DESTRUCTIBLE_SPECS[e.model].label;
  if (e.kind === 'prop') kind = getProp(e.model)?.displayName ?? 'Prop';
  const same = doc.entities.filter(
    (o) =>
      o.kind === e.kind &&
      (e.kind !== 'trap' || (o.kind === 'trap' && o.trap === e.trap)) &&
      (e.kind !== 'destructible' || (o.kind === 'destructible' && o.model === e.model)) &&
      (e.kind !== 'prop' || (o.kind === 'prop' && o.model === e.model)),
  );
  return `${kind} ${same.indexOf(e) + 1}`;
}

/** One side of one grid cell: what the MapMaker's wall tool points at. */
export interface EdgeTarget {
  cell: [number, number, number];
  side: Side;
}

const OPPOSITE_SIDE: Record<Side, Side> = { N: 'S', E: 'W', S: 'N', W: 'E' };

/**
 * The cell side a pointer hit refers to: step a little off the surface along
 * its normal into the space it faces (or back through the wall if that is
 * empty), then take the nearest side of that cell.
 */
export function edgeTargetAt(doc: MapDocument, point: readonly [number, number, number], normal: readonly [number, number, number], catalog: TileCatalog = coreCatalog): EdgeTarget | null {
  const { cellSize, levelHeight } = doc.classicStructure;
  const { cells } = buildOccupancy(doc, catalog);
  for (const k of [0.3, -0.8]) {
    const q = point.map((v, i) => v + normal[i]! * k) as [number, number, number];
    const cell: [number, number, number] = [Math.round(q[0] / cellSize) + 0, Math.round(q[2] / cellSize) + 0, Math.floor((q[1] + 0.01) / levelHeight) + 0];
    if (!cells.has(cellKey(...cell))) continue;
    const dx = q[0] - cell[0] * cellSize;
    const dz = q[2] - cell[1] * cellSize;
    const side: Side = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'E' : 'W') : dz > 0 ? 'N' : 'S';
    return { cell, side };
  }
  return null;
}

/**
 * Set how one cell side is built. The choice is stored on the tile that owns
 * the cell (in its own frame, so it turns with the tile), and any different
 * choice the neighbour made for the same wall is cleared so both halves match.
 */
export function setEdgeCommand(doc: MapDocument, target: EdgeTarget, style: EdgeStyle, catalog: TileCatalog = coreCatalog): EditCommand | { error: string } {
  const { cells } = buildOccupancy(doc, catalog);
  const here = cells.get(cellKey(...target.cell));
  if (!here) return { error: 'no tile there' };
  const [dx, dy] = SIDE_DIRS[target.side];
  const there = cells.get(cellKey(target.cell[0] + dx, target.cell[1] + dy, target.cell[2]));
  if (there?.placement === here.placement) return { error: 'that side is inside one piece' };
  const withEdge = (t: TilePlacement, key: string, value: EdgeStyle | null): TilePlacement => {
    const edges = { ...(t.edges ?? {}) };
    if (value === null || value === 'auto') delete edges[key];
    else edges[key] = value;
    const { edges: _old, ...rest } = t;
    return Object.keys(edges).length ? { ...rest, edges } : rest;
  };
  const before: TilePlacement[] = [here.placement];
  const after: TilePlacement[] = [withEdge(here.placement, edgeKey(here.local, localSide(target.side, here.placement.rotation)), style)];
  if (there) {
    const key = edgeKey(there.local, localSide(OPPOSITE_SIDE[target.side], there.placement.rotation));
    if (there.placement.edges?.[key] !== undefined) {
      before.push(there.placement);
      after.push(withEdge(there.placement, key, null));
    }
  }
  return { kind: 'updateTiles', before, after };
}

/** The effective edge choice stored for a cell side (its own, else the neighbour's), or `auto`. */
export function edgeChoiceAt(doc: MapDocument, target: EdgeTarget, catalog: TileCatalog = coreCatalog): EdgeStyle {
  const { cells } = buildOccupancy(doc, catalog);
  const here = cells.get(cellKey(...target.cell));
  if (!here) return 'auto';
  const own = here.placement.edges?.[edgeKey(here.local, localSide(target.side, here.placement.rotation))];
  if (own) return own;
  const [dx, dy] = SIDE_DIRS[target.side];
  const there = cells.get(cellKey(target.cell[0] + dx, target.cell[1] + dy, target.cell[2]));
  return (there && there.placement.edges?.[edgeKey(there.local, localSide(OPPOSITE_SIDE[target.side], there.placement.rotation))]) ?? 'auto';
}

