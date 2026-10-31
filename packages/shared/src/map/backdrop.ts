import { TERRAIN_MATERIALS, type TerrainMaterial } from './terrain.ts';
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

export const SCENERY_IDS = ['none', 'hills', 'mountains', 'peaks', 'mesas', 'dunes', 'forest', 'city', 'ocean'] as const;
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
};

/** The backdrop a map is drawn with: its own, or its theme's (the ground carrying on in the terrain's commonest edge material). */
export function resolveBackdrop(doc: Pick<MapDocument, 'backdrop' | 'terrain' | 'classicStructure'>): Backdrop {
  if (doc.backdrop) return doc.backdrop;
  const base = THEME_BACKDROPS[doc.classicStructure.theme] ?? THEME_BACKDROPS['core.prototype']!;
  const t = doc.terrain;
  if (!t || base.ground === 'none' || base.ground === 'water') return base;
  const counts = new Array<number>(TERRAIN_MATERIALS.length).fill(0);
  const w = t.cols - 1;
  const h = t.rows - 1;
  t.materials.forEach((m, i) => {
    const c = i % w;
    const r = Math.floor(i / w);
    if (c === 0 || r === 0 || c === w - 1 || r === h - 1) counts[m] = (counts[m] ?? 0) + 1;
  });
  const top = counts.indexOf(Math.max(...counts));
  return { ...base, ground: (TERRAIN_MATERIALS[top] ?? base.ground) as TerrainMaterial };
}
