/**
 * MapMaker's two painters (docs/MAPMAKER_PAINTING_PLAN.md, Phase 1; the owner's answers 1a 2a 5a): what Structure
 * paint (B) can paint under the pointer, what a material may go on, and the command a click makes. Plain data: no DOM.
 *
 * - Structure paint paints tile surfaces, free blocks and set-piece parts. It never paints the ground: over bare ground
 *   it does nothing and says so (Ground paint, Shift+B, is the Terrain tool's Paint brush). Props have their own
 *   models; glass is glass.
 * - Ground materials go on floors and roofs only (2a): never on walls, trim, pillars, metal or a block.
 * - On a set piece (5a), a click paints that material across the piece (its role in this placement: all its Stone),
 *   and "This surface only" paints the one part (`overrides.paint`, format v41). No Explode needed.
 */
import type { WorldBox } from '../map/geometry.ts';
import { coreMaterials, SURFACE_SLOT_LABELS, type SurfaceSlot } from '../map/materials.ts';
import type { MapDocument, MapEntity, SetPieceDefinition, SetPiecePart, SetPiecePlacement, SurfaceStyle, TilePlacement, TileSurfaces } from '../map/schema.ts';
import { piecesFor, type SetPieceExpansion, type SetPieceLibrary } from '../map/setPieces.ts';
import { faceSlot } from '../map/surfaces.ts';
import type { EditCommand } from './commands.ts';
import { paintCommand, type PaintScope } from './operations.ts';

type Block = Extract<MapEntity, { kind: 'block' }>;
type MaterialRole = Extract<NonNullable<NonNullable<Extract<SetPiecePart, { kind: 'tile' }>['surfaces']>['walls']>, { role: string }>['role'];

/** What Structure paint paints on a set piece: the material across the piece (5a, the default) or the one part. */
export type PieceScope = 'piece' | 'part';

/** Something Structure paint can paint. */
export type StructureTarget =
  | { kind: 'tile'; tile: TilePlacement; slot: SurfaceSlot }
  | { kind: 'block'; block: Block }
  /** A set-piece part: a tile part's slot, or a block part (slot null). `drawn` is the part as expanded. */
  | { kind: 'part'; placement: SetPiecePlacement; def: SetPieceDefinition; index: number; slot: SurfaceSlot | null; drawn: TilePlacement | Block };

/** Why Structure paint won't paint what is under the pointer (shown on the status line and by the cursor). */
export interface PaintRefusal {
  kind: 'refused';
  reason: 'ground' | 'prop' | 'glass' | 'other';
  message: string;
}

export const GROUND_REFUSAL = "Structure paint doesn't paint the ground. Use Ground paint (Shift+B).";

/** The part index of a set-piece part id (`sp_<placement>_<index>`). */
const partIndex = (id: string): number => Number(id.slice(id.lastIndexOf('_') + 1));

/**
 * What Structure paint would paint where the pointer's ray meets `box` (null: nothing built: the ground or the sky).
 * `expansion` is the document's set pieces expanded (MapMaker's viewDoc and partOf).
 */
export function structurePaintTarget(
  doc: MapDocument,
  expansion: Pick<SetPieceExpansion, 'map' | 'partOf'>,
  library: SetPieceLibrary,
  hit: { box: Pick<WorldBox, 'kind' | 'roof' | 'paint' | 'sourceId'>; normal: readonly [number, number, number] } | null,
): StructureTarget | PaintRefusal {
  if (!hit) return { kind: 'refused', reason: 'ground', message: GROUND_REFUSAL };
  const { box, normal } = hit;
  if (box.kind === 'prop') return { kind: 'refused', reason: 'prop', message: 'Prop: its own model, not paintable' };
  const tile = doc.classicStructure.tiles.find((t) => t.id === box.sourceId);
  if (tile) return { kind: 'tile', tile, slot: faceSlot(box, normal) };
  const placementId = expansion.partOf.get(box.sourceId);
  if (placementId) {
    const placement = doc.setPieces?.find((p) => p.id === placementId);
    const def = placement && piecesFor(doc, library).get(placement.piece);
    const index = partIndex(box.sourceId);
    const part = def?.parts[index];
    if (placement && def && part) {
      if (part.kind === 'tile') {
        const drawn = expansion.map.classicStructure.tiles.find((t) => t.id === box.sourceId);
        if (drawn) return { kind: 'part', placement, def, index, slot: faceSlot(box, normal), drawn };
      } else if (part.kind === 'block') {
        const drawn = expansion.map.entities.find((e): e is Block => e.id === box.sourceId && e.kind === 'block');
        if (drawn?.glass) return { kind: 'refused', reason: 'glass', message: 'Glass: it stays glass, not paintable' };
        if (drawn) return { kind: 'part', placement, def, index, slot: null, drawn };
      } else if (part.kind === 'prop') return { kind: 'refused', reason: 'prop', message: 'Prop: its own model, not paintable' };
    }
    return { kind: 'refused', reason: 'other', message: 'This part of the set piece has no surface to paint' };
  }
  const entity = doc.entities.find((e) => e.id === box.sourceId);
  if (entity?.kind === 'block') {
    if (entity.glass) return { kind: 'refused', reason: 'glass', message: 'Glass: it stays glass, not paintable' };
    return { kind: 'block', block: entity };
  }
  if (entity?.kind === 'prop') return { kind: 'refused', reason: 'prop', message: 'Prop: its own model, not paintable' };
  return { kind: 'refused', reason: 'other', message: 'Not paintable' };
}

/** The slot a target paints (a block, or a set piece's block part, is one material: `solids`). */
export const targetSlot = (t: StructureTarget): SurfaceSlot => (t.kind === 'block' || (t.kind === 'part' && t.slot === null) ? 'solids' : (t as { slot: SurfaceSlot }).slot);

/** Whether a slot may take a ground material (2a: floors and roofs only). */
export const takesGround = (slot: SurfaceSlot | null): boolean => slot === 'floor' || slot === 'roof';

/**
 * Why `material` can't go on this target, or null when it can: a ground material (gravel, grass, sand…) goes on a
 * tile's floors and roofs only; walls, trim, pillars, the underside and metal never take one (the owner's answer 2a).
 * A block is one material on every face and is often a slab or a ramp (a set piece's asphalt ramp): it may.
 */
export function materialRefusal(target: StructureTarget, material: string): string | null {
  const def = coreMaterials.get(material);
  if (!def) return `${material} is not a material`;
  if (def.category !== 'Ground') return null;
  const slot = target.kind === 'block' ? null : target.slot;
  if (slot === null || takesGround(slot)) return null;
  return `${def.displayName} is a ground: on buildings it goes on floors and roofs only, not on ${SURFACE_SLOT_LABELS[slot].toLowerCase()}`;
}

/** Whether a set piece's material role may take a ground material (the roles that paint floors and roofs). */
export const roleTakesGround = (role: string): boolean => role === 'floor' || role === 'paving' || role === 'roof';

/** The materials Structure paint offers (every material; ground ones are marked "floors and roofs only"). */
export const structurePaintMaterials = (): string[] => coreMaterials.all().map((m) => m.id);

// ---------------------------------------------------------------- set-piece paint

/** A tile part's slot value as the piece gives it: a role, a fixed material, or nothing (the theme's). */
function partSpec(part: SetPiecePart, slot: SurfaceSlot | null): { role: MaterialRole } | SurfaceStyle | null {
  if (part.kind === 'tile') {
    if (!slot) return null;
    return (part.surfaces?.[slot] as { role: MaterialRole } | SurfaceStyle | undefined) ?? null;
  }
  if (part.kind === 'block') return typeof part.material === 'string' ? { material: part.material, tint: part.tint ?? null } : (part.material as { role: MaterialRole } | null);
  return null;
}

const sameSpec = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The parts "across the piece" reaches from the clicked one: every part whose slot is given the same way (the same role, the same fixed material, or the theme's). */
export function pieceSiblings(def: SetPieceDefinition, index: number, slot: SurfaceSlot | null): { index: number; slot: SurfaceSlot | null }[] {
  const part = def.parts[index];
  if (!part) return [];
  const spec = partSpec(part, slot);
  const kind = part.kind;
  const out: { index: number; slot: SurfaceSlot | null }[] = [];
  def.parts.forEach((p, i) => {
    if (p.kind !== kind) return;
    if (kind === 'block') {
      if (sameSpec(partSpec(p, null), spec)) out.push({ index: i, slot: null });
    } else if (slot && sameSpec(partSpec(p, slot), spec)) out.push({ index: i, slot });
  });
  return out;
}

/** The role a part's slot is painted by, if any (what "across the piece" changes). */
export function partRole(def: SetPieceDefinition, index: number, slot: SurfaceSlot | null): MaterialRole | null {
  const part = def.parts[index];
  const spec = part ? partSpec(part, slot) : null;
  return spec && 'role' in spec ? spec.role : null;
}

type PartPaint = NonNullable<NonNullable<SetPiecePlacement['overrides']>['paint']>;

/** A placement with some parts' paint set (style) or cleared (null), its `overrides` tidied (no empty keys). */
function withPartPaint(p: SetPiecePlacement, entries: { index: number; slot: SurfaceSlot | null }[], style: SurfaceStyle | null): SetPiecePlacement {
  const paint: PartPaint = { ...(p.overrides?.paint ?? {}) };
  for (const { index, slot } of entries) {
    const key = String(index);
    if (slot === null) {
      if (style) paint[key] = { material: style.material, tint: style.tint ?? null };
      else delete paint[key];
      continue;
    }
    const was = paint[key];
    const surfaces: TileSurfaces = was && !('material' in was) ? { ...was } : {};
    if (style) surfaces[slot] = { material: style.material, tint: style.tint ?? null };
    else delete surfaces[slot];
    if (Object.keys(surfaces).length) paint[key] = surfaces;
    else delete paint[key];
  }
  return withOverrides(p, { paint: Object.keys(paint).length ? sortKeys(paint) : undefined });
}

const sortKeys = <T>(o: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(o).sort(([a], [b]) => Number(a) - Number(b)));

function withOverrides(p: SetPiecePlacement, change: Partial<NonNullable<SetPiecePlacement['overrides']>>): SetPiecePlacement {
  const overrides: NonNullable<SetPiecePlacement['overrides']> = { ...(p.overrides ?? {}), ...change };
  for (const k of Object.keys(overrides) as (keyof typeof overrides)[]) if (overrides[k] === undefined) delete overrides[k];
  const next: SetPiecePlacement = { ...p, overrides };
  if (!Object.keys(overrides).length) delete next.overrides;
  return next;
}

/** One placement painted: across the piece (its role, or every part given the same way) or this part only. */
export function piecePaintPlacement(p: SetPiecePlacement, def: SetPieceDefinition, index: number, slot: SurfaceSlot | null, style: SurfaceStyle | null, scope: PieceScope): SetPiecePlacement {
  if (scope === 'part') return withPartPaint(p, [{ index, slot }], style);
  const siblings = pieceSiblings(def, index, slot);
  const role = partRole(def, index, slot);
  if (!role) return withPartPaint(p, siblings, style);
  // The role in this placement, and the paint of the parts it reaches cleared, so the whole piece shows it.
  const cleared = withPartPaint(p, siblings, null);
  const roles = { ...(cleared.overrides?.roles ?? {}) };
  if (style) roles[role] = { material: style.material, tint: style.tint ?? null };
  else delete roles[role];
  return withOverrides(cleared, { roles: Object.keys(roles).length ? roles : undefined });
}

/** Free blocks a scope reaches from `origin` (this block, the same material, the same level, or all of them; glass never). */
function blocksInScope(doc: MapDocument, origin: Block, scope: PaintScope): Block[] {
  const level = (b: Block) => Math.floor((b.position[1] + 0.01) / doc.classicStructure.levelHeight);
  return doc.entities.filter((e): e is Block => {
    if (e.kind !== 'block' || e.glass) return false;
    if (scope === 'surface') return e.id === origin.id;
    if (scope === 'sameType') return e.material === origin.material && (e.tint ?? null) === (origin.tint ?? null);
    if (scope === 'level') return level(e) === level(origin);
    return true;
  });
}

/**
 * The command a Structure paint click makes (style null: reset to the layer below: the theme's, or the look's).
 * Tiles take today's scopes; free blocks the same (same type: the same material); a set piece its piece scope.
 */
export function structurePaintCommand(doc: MapDocument, target: StructureTarget, style: SurfaceStyle | null, scope: PaintScope, pieceScope: PieceScope): EditCommand {
  if (target.kind === 'tile') return paintCommand(doc, target.tile.id, target.slot, style, scope);
  if (target.kind === 'block') {
    const before = blocksInScope(doc, target.block, scope).filter((b) => (style ? b.material !== style.material || (b.tint ?? null) !== (style.tint ?? null) : b.material !== null || b.tint !== null));
    const after = before.map((b) => ({ ...b, material: style?.material ?? null, tint: style?.tint ?? null }));
    return { kind: 'updateEntities', before, after };
  }
  const after = piecePaintPlacement(target.placement, target.def, target.index, target.slot, style, pieceScope);
  if (JSON.stringify(after) === JSON.stringify(target.placement)) return { kind: 'updateSetPieces', before: [], after: [] };
  return { kind: 'updateSetPieces', before: [target.placement], after: [after] };
}

/** Whether a command changes nothing (a click on a surface already that colour). */
export const emptyPaint = (cmd: EditCommand): boolean =>
  (cmd.kind === 'updateTiles' || cmd.kind === 'updateEntities' || cmd.kind === 'updateSetPieces') && cmd.before.length === 0;

/** A short name for what is under the cursor: "Walls · Room", "Block", "Bars · Cage Block (set piece)". */
export function targetName(target: StructureTarget, tileName: (id: string) => string): string {
  if (target.kind === 'tile') return `${SURFACE_SLOT_LABELS[target.slot]} · ${tileName(target.tile.tile)}`;
  if (target.kind === 'block') return 'Block';
  const what = target.slot ? `${SURFACE_SLOT_LABELS[target.slot]} · ${tileName((target.drawn as TilePlacement).tile)}` : 'Block';
  return `${what} · ${target.def.displayName} (set piece, part ${target.index + 1})`;
}
