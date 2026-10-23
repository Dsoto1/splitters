import type { WorldBox } from './geometry.ts';
import { coreMaterials, coreThemes, type MaterialCatalog, type MaterialDefinition, type SurfaceSlot, type ThemeCatalog } from './materials.ts';
import type { MapDocument, TilePlacement } from './schema.ts';

export interface ResolvedStyle {
  material: MaterialDefinition;
  tint: string | null;
}

const FALLBACK_THEME = 'core.prototype';

/** Effective style of one tile surface: the tile's override, else the map theme's default. */
export function resolveSurface(
  doc: MapDocument,
  tile: TilePlacement | undefined,
  slot: SurfaceSlot,
  materials: MaterialCatalog = coreMaterials,
  themes: ThemeCatalog = coreThemes,
): ResolvedStyle {
  const theme = themes.get(doc.classicStructure.theme) ?? themes.get(FALLBACK_THEME)!;
  const override = tile?.surfaces?.[slot];
  const chosen = override ?? theme.slots[slot];
  const material = materials.get(chosen.material) ?? materials.get(theme.slots[slot].material)!;
  return { material, tint: chosen.tint ?? null };
}

/** Which paintable slot a box face belongs to. Floor slabs: top face is the floor, every other face the underside. */
export function faceSlot(box: Pick<WorldBox, 'kind'>, normal: readonly [number, number, number]): SurfaceSlot {
  if (box.kind === 'trim') return 'trim';
  if (box.kind === 'prop') return 'solids';
  if (box.kind === 'wall') return 'walls';
  if (box.kind === 'solid') return 'solids';
  return normal[1] > 0.5 ? 'floor' : 'underside';
}

export const styleKey = (s: ResolvedStyle): string => `${s.material.id}|${s.tint ?? '-'}`;
