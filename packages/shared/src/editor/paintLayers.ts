/**
 * The painting layers (docs/MAPMAKER_PAINTING_PLAN.md, Phase 2; the owner's answers, all picks): where a surface's
 * look comes from, and what a base-theme change would do.
 *
 * Three layers, the top one with a value wins:
 * 1. the base theme (the Structure theme: `classicStructure.theme`);
 * 2. a set piece's look (its role pack: its own `pack`, else the theme's), or the piece's own fixed material;
 * 3. your paint (a tile's `surfaces`, a free block's `material`, a set piece's `overrides.roles` and `overrides.paint`).
 *
 * A theme change only ever changes layer 1 (and the look a set piece takes from the theme). `themeChangeImpact` counts
 * what would change and what stays; `keepCurrentLookCommand` is the dialog's "Keep current look": today's look written
 * into layer 3 for everything that would change, then the theme changed, one command (one undo step). Plain data.
 */
import { buildMapDecor, buildMapGeometry, type WorldBox } from '../map/geometry.ts';
import { coreMaterials, coreThemes, SURFACE_SLOTS, type SurfaceSlot } from '../map/materials.ts';
import { SET_PIECE_MATERIAL_ROLES, SET_PIECE_ROLES, type MapDocument, type MapEntity, type SetPieceDefinition, type SetPiecePlacement, type SetPieceRoleValues, type SurfaceStyle, type TilePlacement, type TileSurfaces } from '../map/schema.ts';
import { expandSetPieces, piecesFor, placementPack, setPieceParts, withMapLooks, type SetPieceExpansion, type SetPieceLibrary } from '../map/setPieces.ts';
import { faceSlot, resolveSurface, styleKey, type ResolvedStyle } from '../map/surfaces.ts';
import { cellGround, cellPainted, groundBase, groundIndex, groundThemeDef, terrainGroundTheme, type TerrainData } from '../map/terrain.ts';
import type { EditCommand } from './commands.ts';
import { partRole, type StructureTarget } from './paintTargets.ts';

type Block = Extract<MapEntity, { kind: 'block' }>;
type Themed = Pick<MapDocument, 'classicStructure'>;

/** Short names for a slot on the cursor: "Wall", "Floor", "Trim", "Roof", "Metal". */
export const SLOT_SHORT: Record<SurfaceSlot, string> = { floor: 'Floor', walls: 'Wall', solids: 'Pillar, cover or step', underside: 'Underside', trim: 'Trim', roof: 'Roof', metal: 'Metal' };

/** A map with another theme (all resolveSurface reads of a document is its theme). */
const withTheme = <T extends Themed>(doc: T, theme: string): T => ({ ...doc, classicStructure: { ...doc.classicStructure, theme } });

const themeName = (id: string): string => coreThemes.get(id)?.displayName ?? id;

// ---------------------------------------------------------------- what each piece draws

/** The slots a box's faces are painted as (none: a prop, an invisible wall, or a face with its own skin). */
function boxSlots(b: WorldBox, isBlock: boolean): SurfaceSlot[] {
  if (b.kind === 'prop' || b.kind === 'barrier') return [];
  // A box with its own skin (a facade's cladding, a frame) wears it whatever the theme; a block's own material is its paint.
  if (b.surface && !isBlock) return [];
  if (b.kind === 'floor' && !b.paint) return [b.roof ? 'roof' : 'floor', 'underside'];
  return [faceSlot(b, [1, 0, 0])];
}

/** For each piece drawn (a tile, a block, a set-piece part, by id), the slots its faces are painted as. */
export function drawnSlots(map: MapDocument, boxes: readonly WorldBox[] = [...buildMapGeometry(map), ...buildMapDecor(map)]): Map<string, Set<SurfaceSlot>> {
  const blocks = new Set(map.entities.filter((e) => e.kind === 'block').map((e) => e.id));
  const out = new Map<string, Set<SurfaceSlot>>();
  for (const b of boxes) {
    const slots = boxSlots(b, blocks.has(b.sourceId));
    if (!slots.length) continue;
    let set = out.get(b.sourceId);
    if (!set) out.set(b.sourceId, (set = new Set()));
    for (const s of slots) set.add(s);
  }
  return out;
}

/** In SURFACE_SLOTS order (the floor before the roof, which follows it). */
const ordered = (slots: Iterable<SurfaceSlot>): SurfaceSlot[] => {
  const set = new Set(slots);
  return SURFACE_SLOTS.filter((s) => set.has(s));
};

/** The look one slot of a drawn piece shows (a tile's surface, or a block's own material, else the theme's for that face). */
function lookOf(map: Themed, piece: TilePlacement | Block, slot: SurfaceSlot): ResolvedStyle {
  if ('tile' in piece) return resolveSurface(map as MapDocument, piece, slot);
  const own = piece.material ? coreMaterials.get(piece.material) : undefined;
  return own ? { material: own, tint: piece.tint ?? null } : resolveSurface(map as MapDocument, undefined, slot);
}

const pieceIndex = (map: MapDocument): Map<string, TilePlacement | Block> => {
  const m = new Map<string, TilePlacement | Block>();
  for (const t of map.classicStructure.tiles) m.set(t.id, t);
  for (const e of map.entities) if (e.kind === 'block' && !e.glass) m.set(e.id, e);
  return m;
};

/** Whether one slot of a map's own tile is your paint (a roof with no paint of its own shows the floor's). */
const tilePainted = (t: TilePlacement, slot: SurfaceSlot): boolean => !!t.surfaces?.[slot] || (slot === 'roof' && !!t.surfaces?.floor);

/** What a part looks like apart from its materials: a room's facade, a window's glass, a door's style. */
function partShape(piece: TilePlacement | MapEntity | undefined): string {
  if (!piece) return '';
  if ('tile' in piece) return JSON.stringify([piece.options?.facade ?? 'none', piece.glass ?? {}]);
  if (piece.kind === 'door') return piece.style ?? 'sliding';
  if (piece.kind === 'block') return piece.glass ?? '';
  return '';
}

// ---------------------------------------------------------------- the counts

/** What changing the Structure theme would do (the warning's counts). */
export interface ThemeChangeImpact {
  from: string;
  to: string;
  /**
   * Surfaces that follow the theme itself and will change: one per slot a tile draws, one per block, the same for a
   * set piece's parts where nothing above the theme gives the slot a look (an underside, say).
   */
  surfacesChange: number;
  /** Set pieces that take the theme's look, and whose look will change. */
  piecesChange: number;
  /** Surfaces you painted: they stay (tile slots, painted blocks, set pieces' painted roles and parts). */
  surfacesPainted: number;
  /** Set pieces with a look of their own: it stays (parts it leaves to the theme count with the surfaces). */
  piecesOwnLook: number;
  /** The sky and backdrop follow the theme (the map has no backdrop of its own). */
  skyFollows: boolean;
  /** The ids of what will change: the map's tiles and blocks, and set pieces (any of whose surfaces change). */
  changing: { pieces: string[]; setPieces: string[] };
}

interface Compared {
  impact: ThemeChangeImpact;
  before: SetPieceExpansion;
  after: SetPieceExpansion;
  drawn: Map<string, Set<SurfaceSlot>>;
}

function compare(doc: MapDocument, library: SetPieceLibrary, to: string, boxes?: readonly WorldBox[]): Compared {
  const from = doc.classicStructure.theme;
  const before = expandSetPieces(doc, library);
  const after = expandSetPieces(withTheme(doc, to), library);
  const drawn = drawnSlots(before.map, boxes);
  const oldPieces = pieceIndex(before.map);
  const newPieces = pieceIndex(after.map);
  const impact: ThemeChangeImpact = { from, to, surfacesChange: 0, piecesChange: 0, surfacesPainted: 0, piecesOwnLook: 0, skyFollows: !doc.backdrop, changing: { pieces: [], setPieces: [] } };
  const differs = (id: string, slot: SurfaceSlot) => {
    const a = oldPieces.get(id);
    const b = newPieces.get(id);
    return !a || !b || styleKey(lookOf(before.map, a, slot)) !== styleKey(lookOf(after.map, b, slot));
  };
  // The map's own tiles and blocks: a surface each slot they draw.
  for (const t of doc.classicStructure.tiles) {
    let changed = false;
    for (const slot of drawn.get(t.id) ?? []) {
      if (tilePainted(t, slot)) impact.surfacesPainted++;
      else if (differs(t.id, slot)) {
        impact.surfacesChange++;
        changed = true;
      }
    }
    if (changed) impact.changing.pieces.push(t.id);
  }
  for (const e of doc.entities) {
    if (e.kind !== 'block' || e.glass || !drawn.has(e.id)) continue;
    if (e.material) impact.surfacesPainted++;
    else if ([...drawn.get(e.id)!].some((slot) => differs(e.id, slot))) {
      impact.surfacesChange++;
      impact.changing.pieces.push(e.id);
    }
  }
  // Set pieces: one each, by whether anything of theirs changes.
  const partsOf = new Map<string, string[]>();
  for (const [part, placement] of before.partOf) {
    let list = partsOf.get(placement);
    if (!list) partsOf.set(placement, (list = []));
    list.push(part);
  }
  const oldAll = new Map<string, TilePlacement | MapEntity>([...before.map.classicStructure.tiles.map((t) => [t.id, t] as const), ...before.map.entities.map((e) => [e.id, e] as const)]);
  const newAll = new Map<string, TilePlacement | MapEntity>([...after.map.classicStructure.tiles.map((t) => [t.id, t] as const), ...after.map.entities.map((e) => [e.id, e] as const)]);
  for (const p of doc.setPieces ?? []) {
    impact.surfacesPainted += Object.values(p.overrides?.paint ?? {}).reduce((n, v) => n + ('material' in v ? 1 : Object.keys(v).length), 0);
    impact.surfacesPainted += SET_PIECE_MATERIAL_ROLES.filter((r) => p.overrides?.roles?.[r]).length;
    // A part's surface its look (or the piece, or your paint) gives changes with the look; one nothing gives follows
    // the theme itself, as a tile's would (an underside, say): that counts with the surfaces.
    let lookChanged = false;
    let themed = 0;
    for (const id of partsOf.get(p.id) ?? []) {
      if (partShape(oldAll.get(id)) !== partShape(newAll.get(id))) lookChanged = true;
      const part = oldPieces.get(id);
      const slots = [...(drawn.get(id) ?? [])];
      if (part && !('tile' in part)) {
        if (slots.some((slot) => differs(id, slot))) {
          if (part.material) lookChanged = true;
          else themed++;
        }
      } else
        for (const slot of slots) {
          if (!differs(id, slot)) continue;
          if (part && tilePainted(part, slot)) lookChanged = true;
          else themed++;
        }
    }
    impact.surfacesChange += themed;
    if (lookChanged || themed) impact.changing.setPieces.push(p.id);
    if (lookChanged) impact.piecesChange++;
    else if (p.pack) impact.piecesOwnLook++;
  }
  return { impact, before, after, drawn };
}

/**
 * What changing the Structure theme to `to` would do: how many of the map's surfaces follow the theme and will change,
 * how many set pieces will change, how many surfaces you painted (they stay), how many set pieces have a look of their
 * own (they stay), and whether the sky and backdrop follow. `boxes`: the map's boxes as drawn, if already built.
 */
export function themeChangeImpact(doc: MapDocument, library: SetPieceLibrary, to: string, boxes?: readonly WorldBox[]): ThemeChangeImpact {
  return compare(doc, library, to, boxes).impact;
}

/** Whether a theme change would change anything built (no: the dialog is skipped). */
export const impactChanges = (i: ThemeChangeImpact): number => i.surfacesChange + i.piecesChange;

// ---------------------------------------------------------------- Keep current look

/** What a role is for a placement under a look (undefined: the theme's, or the part's default). */
const roleUnder = (k: keyof SetPieceRoleValues, p: SetPiecePlacement, def: SetPieceDefinition, pack: ReturnType<typeof placementPack>) => p.overrides?.roles?.[k] ?? pack?.roles[k] ?? def.roles?.[k];

/** A role's value where no layer gives one, as a value that can be pinned (no facade, a sliding door, no glass). */
const ROLE_DEFAULTS: Partial<Record<keyof SetPieceRoleValues, string>> = { facade: 'none', door: 'sliding', glass: 'none' };

const asStyle = (s: ResolvedStyle): SurfaceStyle => ({ material: s.material.id, tint: s.tint ?? null });

/**
 * "Keep current look": the theme changes (for new pieces and the palette), and everything built keeps today's look,
 * written into your paint (layer 3): each surface of the map's own tiles and blocks that follows the theme and would
 * change, and each set piece that would change (its look's roles pinned in `overrides.roles`, any part still
 * following the theme pinned in `overrides.paint`). One command: one undo step.
 *
 * `approximate`: unpainted blocks whose faces showed two theme materials (a block's top is the theme's floor, its
 * sides the underside): a block is one material, so each keeps the one it shows most (a slab its top, a wall its sides).
 */
export function keepCurrentLookCommand(doc: MapDocument, library: SetPieceLibrary, to: string, boxes?: readonly WorldBox[]): { command: EditCommand; approximate: string[] } {
  library = withMapLooks(doc, library);
  const { before, drawn } = compare(doc, library, to, boxes);
  const newDoc = withTheme(doc, to);
  const approximate: string[] = [];
  const commands: EditCommand[] = [];

  // The map's own tiles: each slot that follows the theme and would change, pinned (the floor first: a roof follows it).
  const tilesBefore: TilePlacement[] = [];
  const tilesAfter: TilePlacement[] = [];
  for (const t of doc.classicStructure.tiles) {
    let next = t;
    for (const slot of ordered(drawn.get(t.id) ?? [])) {
      if (tilePainted(next, slot)) continue;
      const was = lookOf(doc, t, slot);
      if (styleKey(was) === styleKey(lookOf(newDoc, next, slot))) continue;
      next = { ...next, surfaces: { ...next.surfaces, [slot]: asStyle(was) } as TileSurfaces };
    }
    if (next !== t) {
      tilesBefore.push(t);
      tilesAfter.push(next);
    }
  }
  if (tilesBefore.length) commands.push({ kind: 'updateTiles', before: tilesBefore, after: tilesAfter });

  // A block is one material: it keeps the look it shows most, by area (and is noted when its faces showed two).
  const blockPin = (b: Block, slots: SurfaceSlot[]): SurfaceStyle => {
    if (new Set(slots.map((s) => styleKey(lookOf(doc, b, s)))).size > 1) approximate.push(b.id);
    const top = slots.find((s) => s === 'floor' || s === 'roof');
    const side = slots.find((s) => s !== top);
    const [w, h, d] = b.size;
    const pick = top && side ? (w * d >= 2 * (w + d) * h ? top : side) : slots[0]!;
    return asStyle(lookOf(doc, b, pick));
  };
  const blockChanges = (b: Block, n: Block, slots: SurfaceSlot[]) => slots.some((s) => styleKey(lookOf(doc, b, s)) !== styleKey(lookOf(newDoc, n, s)));
  const blocksBefore: MapEntity[] = [];
  const blocksAfter: MapEntity[] = [];
  for (const e of doc.entities) {
    if (e.kind !== 'block' || e.glass || e.material || !drawn.has(e.id)) continue;
    const slots = ordered(drawn.get(e.id)!);
    if (!blockChanges(e, e, slots)) continue;
    const pin = blockPin(e, slots);
    blocksBefore.push(e);
    blocksAfter.push({ ...e, material: pin.material, tint: pin.tint ?? null });
  }
  if (blocksBefore.length) commands.push({ kind: 'updateEntities', before: blocksBefore, after: blocksAfter });

  // Set pieces: the look's roles pinned, then any part still showing something else pinned as part paint.
  const pieces = piecesFor(doc, library);
  const piecesBefore: SetPiecePlacement[] = [];
  const piecesAfter: SetPiecePlacement[] = [];
  for (const p of doc.setPieces ?? []) {
    const def = pieces.get(p.piece);
    if (!def) continue;
    const oldPack = placementPack(p, doc.classicStructure.theme, library);
    const newPack = placementPack(p, to, library);
    let next = p;
    if (oldPack !== newPack) {
      const roles: SetPieceRoleValues = { ...(p.overrides?.roles ?? {}) };
      for (const k of SET_PIECE_ROLES) {
        const was = roleUnder(k, p, def, oldPack);
        if (JSON.stringify(was ?? null) === JSON.stringify(roleUnder(k, p, def, newPack) ?? null)) continue;
        const pin = was ?? ROLE_DEFAULTS[k];
        // A material role no layer gave: its parts showed the theme's slot, pinned part by part below.
        if (pin !== undefined) (roles as Record<string, unknown>)[k] = pin;
      }
      if (Object.keys(roles).length) next = { ...next, overrides: { ...next.overrides, roles } };
    }
    const oldParts = setPieceParts(p, def, doc.classicStructure.theme, library);
    const newParts = setPieceParts(next, def, to, library);
    const newById = new Map<string, TilePlacement | MapEntity>([...newParts.tiles.map((t) => [t.id, t] as const), ...newParts.entities.map((e) => [e.id, e] as const)]);
    const paint: Record<string, SurfaceStyle | TileSurfaces> = { ...(next.overrides?.paint ?? {}) };
    let painted = false;
    for (const t of oldParts.tiles) {
      const n = newById.get(t.id) as TilePlacement | undefined;
      if (!n) continue;
      const key = t.id.slice(t.id.lastIndexOf('_') + 1);
      let surfaces: TileSurfaces = { ...((paint[key] && !('material' in paint[key]!) ? paint[key] : {}) as TileSurfaces) };
      let cur = n;
      for (const slot of ordered(drawn.get(t.id) ?? [])) {
        const was = lookOf(doc, t, slot);
        if (styleKey(was) === styleKey(lookOf(newDoc, cur, slot))) continue;
        surfaces = { ...surfaces, [slot]: asStyle(was) };
        cur = { ...cur, surfaces: { ...cur.surfaces, [slot]: asStyle(was) } };
        painted = true;
      }
      if (Object.keys(surfaces).length) paint[key] = surfaces;
    }
    for (const e of oldParts.entities) {
      if (e.kind !== 'block' || e.glass || !drawn.has(e.id)) continue;
      const n = newById.get(e.id) as Block | undefined;
      if (!n) continue;
      const slots = ordered(drawn.get(e.id)!);
      if (!blockChanges(e, n, slots)) continue;
      paint[e.id.slice(e.id.lastIndexOf('_') + 1)] = blockPin(e, slots);
      painted = true;
    }
    if (painted) next = { ...next, overrides: { ...next.overrides, paint: Object.fromEntries(Object.entries(paint).sort(([a], [b]) => Number(a) - Number(b))) } };
    if (next !== p) {
      piecesBefore.push(p);
      piecesAfter.push(next);
    }
  }
  if (piecesBefore.length) commands.push({ kind: 'updateSetPieces', before: piecesBefore, after: piecesAfter });
  commands.push({ kind: 'setTheme', before: doc.classicStructure.theme, after: to });
  return { command: { kind: 'batch', commands }, approximate };
}

// ---------------------------------------------------------------- the cursor's chain

/** One layer of the chain on the cursor. */
export interface LayerStep {
  layer: 'base' | 'look' | 'paint';
  /** "Structure theme", "Set piece look", "Your paint". */
  title: string;
  /** Where it comes from: the theme's name, the look's name ("Industrial (the theme's)"), "this surface", "across the piece". */
  source: string;
  /** Its value (null: this layer gives nothing here). */
  style: ResolvedStyle | null;
}

/** Where the look under Structure paint's cursor comes from: the three layers, the one shown marked. */
export interface SurfaceLayers {
  /** "Wall", "Floor", "Trim", "Roof", "Metal", "Block". */
  surface: string;
  base: LayerStep;
  look: LayerStep;
  paint: LayerStep;
  /** The layer whose value shows. */
  winner: 'base' | 'look' | 'paint';
}

const step = (layer: LayerStep['layer'], source: string, style: ResolvedStyle | null): LayerStep => ({ layer, title: layer === 'base' ? 'Structure theme' : layer === 'look' ? 'Set piece look' : 'Your paint', source, style });
const styled = (s: SurfaceStyle | undefined | null): ResolvedStyle | null => {
  const m = s ? coreMaterials.get(s.material) : undefined;
  return m ? { material: m, tint: s!.tint ?? null } : null;
};

/**
 * The layers of one surface under Structure paint: the base theme's value for that slot, the set piece's look (if
 * it is a set piece), your paint, and which shows. `faceSlotHint`: the face's slot, for a block (its top is the
 * theme's floor, its sides the underside).
 */
export function surfaceLayer(doc: MapDocument, library: SetPieceLibrary, target: StructureTarget, faceSlotHint?: SurfaceSlot): SurfaceLayers {
  library = withMapLooks(doc, library);
  const theme = themeName(doc.classicStructure.theme);
  if (target.kind === 'tile') {
    const slot = target.slot;
    const own = target.tile.surfaces?.[slot] ?? (slot === 'roof' ? target.tile.surfaces?.floor : undefined);
    const paint = step('paint', own && !target.tile.surfaces?.[slot] ? 'the floor\'s paint' : 'this piece', styled(own));
    return { surface: SLOT_SHORT[slot], base: step('base', theme, resolveSurface(doc, undefined, slot)), look: step('look', 'not a set piece', null), paint, winner: paint.style ? 'paint' : 'base' };
  }
  if (target.kind === 'block') {
    const slot = faceSlotHint ?? 'solids';
    const paint = step('paint', 'this block', styled(target.block.material ? { material: target.block.material, tint: target.block.tint ?? null } : null));
    return { surface: 'Block', base: step('base', theme, resolveSurface(doc, undefined, slot)), look: step('look', 'not a set piece', null), paint, winner: paint.style ? 'paint' : 'base' };
  }
  const { placement: p, def, index } = target;
  const part = def.parts[index]!;
  const slot: SurfaceSlot = target.slot ?? faceSlotHint ?? 'solids';
  const pack = placementPack(p, doc.classicStructure.theme, library);
  const role = partRole(def, index, target.slot);
  // Layer 2: the look's value for the part's role, else the piece's own (a role it gives, or a fixed material).
  let look: LayerStep;
  if (role) {
    const fromPack = pack?.roles[role];
    const fromDef = def.roles?.[role];
    look = fromPack ? step('look', `${pack!.displayName}${p.pack ? '' : " (the theme's)"}`, styled(fromPack)) : fromDef ? step('look', `${def.displayName}'s own`, styled(fromDef)) : step('look', pack ? `${pack.displayName}: no ${role}` : 'none for this theme', null);
  } else {
    const fixed = part.kind === 'tile' ? (target.slot ? part.surfaces?.[target.slot] : undefined) : part.kind === 'block' && typeof part.material === 'string' ? { material: part.material, tint: part.tint ?? null } : undefined;
    look = fixed && !('role' in fixed) ? step('look', `${def.displayName}'s own`, styled(fixed as SurfaceStyle)) : step('look', 'none here', null);
  }
  const partPaint = p.overrides?.paint?.[String(index)];
  const own = partPaint ? ('material' in partPaint ? partPaint : target.slot ? partPaint[target.slot] : undefined) : undefined;
  const across = role ? p.overrides?.roles?.[role] : undefined;
  const paint = own ? step('paint', 'this surface only', styled(own)) : across ? step('paint', 'across the piece', styled(across)) : step('paint', 'none', null);
  const base = step('base', theme, resolveSurface(doc, undefined, slot));
  return { surface: target.slot ? SLOT_SHORT[target.slot] : 'Block', base, look, paint, winner: paint.style ? 'paint' : look.style ? 'look' : 'base' };
}

// ---------------------------------------------------------------- the ground

/** Ground paint's cursor: the ground under it, the map's base ground (its Ground theme's) and whether the cell is painted. */
export interface GroundLayer {
  /** The ground the cell shows (a material id). */
  material: string;
  /** The base ground (the Ground theme's), a material id. */
  base: string;
  /** The Ground theme's id. */
  theme: string;
  painted: boolean;
}

/** The ground layer at a point (null: off the terrain). */
export function groundLayerAt(t: TerrainData, x: number, z: number): GroundLayer | null {
  const c = Math.floor((x - t.origin[0]) / t.spacing);
  const r = Math.floor((z - t.origin[1]) / t.spacing);
  if (c < 0 || r < 0 || c >= t.cols - 1 || r >= t.rows - 1) return null;
  const i = r * (t.cols - 1) + c;
  return { material: cellGround(t, i), base: groundBase(t), theme: terrainGroundTheme(t).id, painted: cellPainted(t, i) };
}

/** What a Ground theme change would do (the warning's counts): the ground area that follows it, and what stays. */
export interface GroundThemeImpact {
  from: string;
  to: string;
  /** The base ground before and after (material ids). */
  baseFrom: string;
  baseTo: string;
  /** Square metres of ground that follow the theme (unpainted cells): they change when the bases differ. */
  followsM2: number;
  /** Square metres you painted: they stay. */
  paintedM2: number;
  /** Whether the ground past the border follows (the map has no backdrop of its own). */
  borderFollows: boolean;
}

export function groundThemeImpact(doc: Pick<MapDocument, 'terrain' | 'backdrop'>, to: string): GroundThemeImpact | null {
  const t = doc.terrain;
  if (!t) return null;
  const cell = t.spacing * t.spacing;
  let follows = 0;
  for (let i = 0; i < t.materials.length; i++) if (!cellPainted(t, i)) follows++;
  const from = terrainGroundTheme(t).id;
  return { from, to, baseFrom: groundBase(t), baseTo: groundThemeDef(to).base, followsM2: follows * cell, paintedM2: (t.materials.length - follows) * cell, borderFollows: !doc.backdrop };
}

/** Whether the change would look different (the bases differ and some ground follows the theme). */
export const groundImpactChanges = (i: GroundThemeImpact | null): boolean => !!i && i.baseFrom !== i.baseTo && i.followsM2 > 0;

/** The terrain on Ground theme `to`, every cell as it shows now unless it follows the theme ("Keep current look": the base cells painted the old base). Null: the list is full. */
export function groundThemeTerrain(t: TerrainData, to: string, keep: boolean): TerrainData | null {
  if (!keep) return { ...t, groundTheme: to };
  const slot = groundIndex(t, groundBase(t));
  if (!slot) return null;
  const k = slot.value;
  const materials = slot.terrain.materials.map((m, i) => (cellPainted(slot.terrain, i) ? m : k));
  return { ...slot.terrain, materials, groundTheme: to };
}

/** The Ground theme change as one command (undo puts the terrain back). Null: no terrain, or Keep with the list full. */
export function setGroundThemeCommand(doc: Pick<MapDocument, 'terrain'>, to: string, keep = false): EditCommand | null {
  const t = doc.terrain;
  if (!t) return null;
  const after = groundThemeTerrain(t, to, keep);
  return after ? { kind: 'setTerrain', before: t, after } : null;
}
