import { TERRAIN_MATERIALS, TERRAIN_SURFACES, cellGround, groundKind, type TerrainMaterial } from './terrain.ts';
import type { MapDocument } from './schema.ts';
import type { BorderSides, BorderStyle } from './border.ts';
import { PHOTO_SKIES } from '../content/skies.generated.ts';

/**
 * What surrounds the play area: a sky, distant scenery (mountains, a city
 * skyline…), the ground carrying on past the border, and haze that softens
 * the distance. It is only drawn (never collides). Each theme has a default
 * (see THEME_BACKDROPS); a map can pick its own.
 */
export const SKY_IDS = ['clear', 'cloudy', 'overcast', 'misty', 'sunrise', 'sunset', 'dusk', 'night', 'storm', 'snowy', 'space', 'plain'] as const;
export type SkyId = (typeof SKY_IDS)[number];

export const SCENERY_IDS = ['none', 'hills', 'mountains', 'peaks', 'mesas', 'dunes', 'forest', 'city', 'ocean', 'volcano'] as const;
export type SceneryId = (typeof SCENERY_IDS)[number];

/** Ground beyond the border: a terrain material, open water, or nothing (floating in the sky or space). */
export const BACKDROP_GROUNDS = [...TERRAIN_MATERIALS, 'water', 'none'] as const;
export type BackdropGround = (typeof BACKDROP_GROUNDS)[number];

export interface Backdrop {
  sky: SkyId;
  scenery: SceneryId;
  ground: BackdropGround;
  /** 0 (crystal clear) to 1 (thick haze). */
  haze: number;
  /** Ground mist, 0 (none) to 1 (thick): fog that pools in low ground and thins with height. */
  mist?: number;
  /** What stands just outside the boundary (see border.ts); absent: nothing. */
  border?: BorderStyle;
  /** Per-side overrides of `border`. */
  borderSides?: BorderSides;
}

export interface SkyDefinition {
  id: string;
  name: string;
  /** Equirectangular photo (public/), or none for drawn skies. */
  file: string | null;
  /** Colour along the horizon (haze and fog) and overhead. */
  horizon: string;
  zenith: string;
  /** Scene lighting under this sky: hemisphere and sun intensity, sun colour and elevation (degrees). */
  light: { hemi: number; sun: number; sunColor: string; elevation: number };
}

/** Skies drawn without a photo: a starfield, or the theme's flat colour. */
const DRAWN_SKIES: readonly SkyDefinition[] = [
  { id: 'space', name: 'Starfield', file: null, horizon: '#0a0d18', zenith: '#020308', light: { hemi: 0.7, sun: 0.6, sunColor: '#e8eeff', elevation: 50 } },
  { id: 'plain', name: 'Plain colour', file: null, horizon: '#85a0b8', zenith: '#85a0b8', light: { hemi: 0.8, sun: 0.6, sunColor: '#ffffff', elevation: 60 } },
];

export const SKIES: ReadonlyMap<string, SkyDefinition> = new Map([...PHOTO_SKIES, ...DRAWN_SKIES].map((s) => [s.id, s]));

export const SCENERY_LABELS: Record<SceneryId, string> = {
  none: 'None',
  hills: 'Rolling hills',
  mountains: 'Mountains',
  peaks: 'Snowy peaks',
  mesas: 'Mesas',
  dunes: 'Dunes',
  forest: 'Forest',
  city: 'City skyline',
  ocean: 'Open sea',
  volcano: 'Hills and a volcano',
};

const b = (sky: SkyId, scenery: SceneryId, ground: BackdropGround, haze = 0.5): Backdrop => ({ sky, scenery, ground, haze });

/** Each theme's backdrop when the map doesn't choose one. */
export const THEME_BACKDROPS: Record<string, Backdrop> = {
  'core.prototype': b('cloudy', 'hills', 'grass'),
  'core.tomb': b('clear', 'dunes', 'sand', 0.6),
  'core.desert': b('clear', 'mesas', 'sand', 0.55),
  'core.factory': b('overcast', 'city', 'gravel', 0.65),
  'core.lab': b('night', 'city', 'gravel', 0.4),
  'core.manor': b('night', 'forest', 'grass', 0.55),
  'core.castle': b('cloudy', 'mountains', 'grass'),
  'core.station': b('space', 'none', 'none', 0),
  'core.ruins': b('misty', 'forest', 'moss', 0.7),
  'core.neon': b('night', 'city', 'mud', 0.45),
  'core.arctic': b('snowy', 'peaks', 'snow', 0.6),
  'core.saloon': b('sunset', 'mesas', 'sand', 0.5),
  'core.volcano': b('storm', 'mountains', 'stone', 0.7),
  'core.city': b('cloudy', 'city', 'gravel', 0.5),
  'core.temple': b('clear', 'hills', 'grass', 0.45),
  'core.harbour': b('cloudy', 'ocean', 'water', 0.5),
  'core.bunker': b('overcast', 'hills', 'dirt', 0.6),
  'core.forest': b('cloudy', 'forest', 'grass', 0.55),
  'core.canyon': b('clear', 'mesas', 'dirt', 0.5),
  'core.garden': b('clear', 'hills', 'grass', 0.45),
  'core.orbital': b('space', 'none', 'none', 0),
  'core.neon_megacity': b('night', 'city', 'stone', 0.5),
  'core.military': b('clear', 'hills', 'dirt', 0.45),
  'core.frontier': b('clear', 'mesas', 'sand', 0.5),
  'core.adobe': b('sunset', 'mesas', 'sand', 0.5),
  'core.gothic_estate': b('night', 'forest', 'grass', 0.6),
  'core.jungle_temple': b('misty', 'forest', 'moss', 0.65),
  'core.suburban': b('clear', 'hills', 'grass', 0.4),
  'core.imperial': b('clear', 'hills', 'dirt', 0.4),
  'core.egypt': b('clear', 'mesas', 'sand', 0.55),
  'core.medieval': b('cloudy', 'hills', 'grass', 0.45),
  'core.snow_outpost': { ...b('snowy', 'peaks', 'snow', 0.6), mist: 0.25 },
  'core.coastal': b('overcast', 'ocean', 'water', 0.5),
  'core.desert_city': b('clear', 'mesas', 'sand', 0.5),
  'core.ancient_temple': b('clear', 'forest', 'moss', 0.55),
  'core.industrial': b('overcast', 'city', 'gravel', 0.6),
};

/** The ground the terrain's edge cells show most (a material id; the first on a tie, in order of first use), or null with no terrain. */
function commonestEdgeGround(t: NonNullable<MapDocument['terrain']>): string | null {
  const counts = new Map<string, number>();
  const w = t.cols - 1;
  const h = t.rows - 1;
  for (let i = 0; i < t.materials.length; i++) {
    const c = i % w;
    const r = Math.floor(i / w);
    if (c === 0 || r === 0 || c === w - 1 || r === h - 1) {
      const g = cellGround(t, i);
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let most = 0;
  // Old layer order first (as before v45: its ties went to the earlier layer), then any other ground.
  const order = [...TERRAIN_MATERIALS.map((m) => TERRAIN_SURFACES[m]), ...counts.keys()];
  for (const g of order) if ((counts.get(g) ?? 0) > most) [best, most] = [g, counts.get(g)!];
  return best;
}

/** The backdrop a map is drawn with: its own, or its theme's (the ground carrying on as the kind of the terrain's commonest edge ground). */
export function resolveBackdrop(doc: Pick<MapDocument, 'backdrop' | 'terrain' | 'classicStructure'>): Backdrop {
  if (doc.backdrop) return doc.backdrop;
  const base = THEME_BACKDROPS[doc.classicStructure.theme] ?? THEME_BACKDROPS['core.prototype']!;
  const t = doc.terrain;
  if (!t || base.ground === 'none' || base.ground === 'water') return base;
  const top = commonestEdgeGround(t);
  return { ...base, ground: top ? groundKind(top) : base.ground };
}

/**
 * The ground material drawn past the border (null: water or nothing): with the theme's backdrop, the terrain's
 * commonest edge ground itself (Packed Snow carries on as Packed Snow); with a backdrop of the map's own, its ground
 * kind's material.
 */
export function backdropGroundSurface(doc: Pick<MapDocument, 'backdrop' | 'terrain' | 'classicStructure'>): string | null {
  const b = resolveBackdrop(doc);
  if (b.ground === 'none' || b.ground === 'water') return null;
  if (!doc.backdrop && doc.terrain) {
    const top = commonestEdgeGround(doc.terrain);
    if (top) return top;
  }
  return TERRAIN_SURFACES[b.ground as TerrainMaterial];
}
