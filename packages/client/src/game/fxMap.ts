import { SURFACE_TYPES, cellGround, faceSlot, guessSurface, materialSurface, propSurface, resolveSurface, type FootstepFamily, type ImpactSound, type MapDocument, type SurfaceTypeId, type TilePlacement, type Vec3, type WeaponDefinition, type WorldBox } from '@tiletrigger/shared';
import { FX_MAP } from './fxMap.generated.ts';

/**
 * Which effect plays where, read from content/vfx.json's `map` (fxMap.generated.ts): muzzle flashes by
 * weapon family, impacts by the surface type a round hit (content/surface-types.json, shared with the server), explosions by weapon and kind, and moments of play.
 * Everything here is data lookups; godotVfx.ts and impactVisuals.ts draw.
 */

/** One Binbun effect: `pack` is public/vfx/<pack>.json (hit_fx, explosion_fx, electric_fx …). */
export interface FxRef {
  readonly pack: string;
  readonly effect: string;
  readonly scale: number;
  /** A lasting effect that only dresses the scene (a fire prop's flame): drawn after every other lasting one. */
  readonly decor?: boolean;
  /** A lasting effect on a thing of the map that matters to play (a portal, a jump pad): after the effects of the moment, before every `decor` one. */
  readonly fixture?: boolean;
  /** Recolour it (#rrggbb): godotVfx.ts VfxOptions.tint. */
  readonly tint?: string;
  /** Lasting effects: parts of it left out (node names; godotVfx.ts VfxOptions.skip). */
  readonly skip?: readonly string[];
}

/** What a surface is made of (content/surface-types.json), the same list the server's ballistic classes come from. */
export type Surface = SurfaceTypeId;

/**
 * How a round hitting a level surface looks and sounds: sparks, dust colour and size, chips (splinters, leaves,
 * grit) and their colour, whether it leaves a hole, the sound family, and an optional accent effect.
 */
export interface ImpactStyle {
  readonly sparks: number;
  readonly dust: string | null;
  readonly dustSize: number;
  readonly chips: number;
  readonly chip: string;
  readonly hole: boolean;
  readonly sound: ImpactSound;
  readonly accent: FxRef | null;
}

const muzzle = FX_MAP.muzzle as Record<string, { effect: string; scale: number }>;

/** The muzzle flash of a weapon (an effect of muzzle_flash.json and its size), or none (melee, beams, the railgun, a weapon whose `view.muzzle` is `none`: the Crossbow). */
export function muzzleEffectFor(def: WeaponDefinition): { id: string; scale: number } | null {
  if (def.kind === 'melee' || def.view.beam || def.id === 'core.railgun') return null;
  const own = def.view.muzzle;
  if (own) return own.effect === 'none' ? null : { id: own.effect, scale: own.scale ?? 0.2 };
  const m = (def.family && muzzle[def.family]) || (def.projectile ? muzzle.projectile : !def.ammo ? null : def.pellets > 1 ? muzzle.pellets : def.damage >= 60 ? muzzle.heavy : muzzle.default);
  return m ? { id: m.effect, scale: m.scale } : null;
}

/**
 * Each placement's surface type, made once per map: a prop's own (content/props `surface`, the one the server's
 * ballistic class comes from), else guessed from its model; tiles guessed from their id with the map's theme
 * (their structure is concrete to the server).
 */
export function surfaceIndex(doc: Pick<MapDocument, 'entities' | 'classicStructure'>): Map<string, Surface> {
  const out = new Map<string, Surface>();
  for (const e of doc.entities) if (e.kind === 'prop') out.set(e.id, propSurface(e.model));
  const theme = doc.classicStructure.theme;
  for (const t of doc.classicStructure.tiles) out.set(t.id, guessSurface(`${t.tile} ${theme}`));
  return out;
}

/** The surface of a level box a round hit (none: the terrain, which is dirt): a free block's material, else its placement's (surfaceIndex). */
export function surfaceOfBox(box: WorldBox | null | undefined, index: ReadonlyMap<string, Surface> | null): Surface {
  if (!box) return 'dirt';
  if (box.surface?.material) return materialSurface(box.surface.material);
  return index?.get(box.sourceId) ?? SURFACE_GUESS_FALLBACK;
}

const SURFACE_GUESS_FALLBACK = guessSurface('');

/**
 * What the map's surfaces are made of, made once per map: each placement's guess (surfaceIndex), the tiles by id (a
 * tile's face is the material painted on it, or its theme's) and the terrain (each cell's ground).
 */
export interface SurfaceMap {
  doc: Pick<MapDocument, 'classicStructure' | 'terrain'>;
  tiles: ReadonlyMap<string, TilePlacement>;
  index: ReadonlyMap<string, Surface>;
}

export function surfaceMap(doc: Pick<MapDocument, 'entities' | 'classicStructure' | 'terrain'>): SurfaceMap {
  return { doc, tiles: new Map(doc.classicStructure.tiles.map((t) => [t.id, t])), index: surfaceIndex(doc) };
}

/** The ground (terrain cell) at x, z: its ground material's surface type; dirt off the terrain or with none. */
export function terrainSurfaceAt(terrain: MapDocument['terrain'], x: number, z: number): Surface {
  if (!terrain) return 'dirt';
  const c = Math.floor((x - terrain.origin[0]) / terrain.spacing);
  const r = Math.floor((z - terrain.origin[1]) / terrain.spacing);
  if (c < 0 || r < 0 || c > terrain.cols - 2 || r > terrain.rows - 2) return 'dirt';
  return materialSurface(cellGround(terrain, r * (terrain.cols - 1) + c));
}

/**
 * The surface type of the face a ray met (footsteps and impacts; client only, looked up from the map, nothing sent):
 * the terrain's ground under `at`, a free block's material, a tile face's material (its own paint, else the theme's for
 * that slot: floors, walls, solids), else the placement's guess (props, set pieces).
 */
export function surfaceOfFace(box: WorldBox | null | undefined, normal: Vec3, at: Vec3, map: SurfaceMap | null): Surface {
  if (!box) return map ? terrainSurfaceAt(map.doc.terrain, at.x, at.z) : 'dirt';
  if (box.surface?.material) return materialSurface(box.surface.material);
  const tile = map?.tiles.get(box.sourceId);
  if (tile && map && (box.kind === 'floor' || box.kind === 'wall' || box.kind === 'solid' || box.kind === 'trim')) {
    return materialSurface(resolveSurface(map.doc as MapDocument, tile, faceSlot(box, [normal.x, normal.y, normal.z])).material.id);
  }
  return map?.index.get(box.sourceId) ?? SURFACE_GUESS_FALLBACK;
}

/** The footsteps for a surface type's footstep family (content/surface-types.json; content/sounds.json footstep.*). */
export function footstepSoundId(surface: Surface): 'footstep' | 'footstep.metal' | 'footstep.wood' | 'footstep.grass' | 'footstep.dirt' | 'footstep.gravel' | 'footstep.snow' {
  const family: FootstepFamily | undefined = SURFACE_TYPES[surface]?.footstep;
  switch (family) {
    case 'metal':
      return 'footstep.metal';
    case 'wood':
      return 'footstep.wood';
    case 'grass':
    case 'foliage':
      return 'footstep.grass';
    case 'dirt':
    case 'soft':
    case 'sand':
      return 'footstep.dirt';
    case 'gravel':
      return 'footstep.gravel';
    case 'snow':
      return 'footstep.snow';
    default:
      // hard (concrete, stone, brick, tiles, glass), water, and anything with no family.
      return 'footstep';
  }
}

const impacts = FX_MAP.impacts as unknown as Record<string, Partial<Omit<ImpactStyle, 'hole' | 'sound'>> | number>;

/** How a round lands on `surface`: content/vfx.json map.impacts for the drawing, content/surface-types.json for the decal and sound. */
export function impactStyle(surface: Surface): ImpactStyle {
  const t = SURFACE_TYPES[surface] ?? SURFACE_TYPES[SURFACE_GUESS_FALLBACK];
  const s = impacts[t.id];
  const d = typeof s === 'object' ? s : {};
  return { sparks: d.sparks ?? 0, dust: d.dust ?? null, dustSize: d.dustSize ?? 1, chips: d.chips ?? 0, chip: d.chip ?? '#808080', hole: t.impact.decal === 'hole', sound: t.impact.sound, accent: d.accent ?? null };
}

/** The sound a round makes landing on a surface type's sound family (content/sounds.json), or none. */
export function impactSoundId(sound: ImpactSound): 'impact.world' | 'impact.wood' | 'impact.metal' | 'impact.soft' | 'impact.glass' | 'water.splash' | null {
  switch (sound) {
    case 'hard':
      return 'impact.world';
    case 'wood':
      return 'impact.wood';
    case 'metal':
      return 'impact.metal';
    case 'soft':
      return 'impact.soft';
    case 'glass':
      return 'impact.glass';
    case 'water':
      return 'water.splash';
    default:
      return null;
  }
}

/** Beyond this many metres from the camera an impact's accent effect is skipped. */
export const ACCENT_RANGE = (FX_MAP.impacts as { accentRange?: number }).accentRange ?? 45;

const weaponImpacts = FX_MAP.weaponImpacts as Record<string, FxRef>;

/** A weapon whose rounds land with an effect of their own (the railgun's big impact, plasma bolts), by id, then projectile visual. */
export function weaponImpact(def: WeaponDefinition | undefined): FxRef | null {
  if (!def) return null;
  return weaponImpacts[def.id] ?? (def.projectile ? weaponImpacts[def.projectile.visual] : undefined) ?? null;
}

/** A blow landing on a body: the two hit flashes, alternating. */
export function meleeImpact(alt: boolean): FxRef | null {
  return weaponImpacts[alt ? 'melee.alt' : 'melee'] ?? weaponImpacts.melee ?? null;
}

const explosions = FX_MAP.explosions as Record<string, FxRef>;

/**
 * The explosion for a blast: by the weapon id the event carried, then that weapon's projectile visual, then
 * `kind` (vehicle, barrel, trap, bomb), then the default. `air` (nothing under the blast) turns a ground
 * explosion into the air burst. Its scale is per metre of blast radius.
 */
export function explosionFor(weapon: string | undefined, kind: string | null, lookup: (id: string) => WeaponDefinition | undefined): FxRef {
  const pick = (): FxRef => {
    if (kind === 'vehicle' && explosions.vehicle) return explosions.vehicle;
    if (weapon) {
      if (explosions[weapon]) return explosions[weapon]!;
      if (weapon === 'core.barrel' && explosions.barrel) return explosions.barrel;
      if (weapon === 'core.bomb' && explosions.bomb) return explosions.bomb;
      if (weapon.startsWith('core.trap_') && explosions.trap) return explosions.trap;
      const visual = lookup(weapon)?.projectile?.visual;
      if (visual && explosions[visual]) return explosions[visual]!;
    }
    return (kind && kind !== 'air' && explosions[kind]) || explosions.default!;
  };
  const fx = pick();
  return kind === 'air' && explosions.air && /ground_explosion/.test(fx.effect) ? explosions.air : fx;
}

const gameplay = FX_MAP.gameplay as Record<string, FxRef>;

/** A moment of play's effect (`pickup.health`, `spawn`, `portal`, `pad`, `trap.shock`, `zipline` …): the exact key, else the part before the dot. */
export function gameplayFx(key: string): FxRef | null {
  return gameplay[key] ?? gameplay[key.split('.')[0]!] ?? null;
}

/** Lightning along an `arc` event's jumps: the bolt, the crackle where it lands, and how much faster than the pack's it plays. */
export interface ArcFx {
  readonly zap: FxRef;
  readonly hit: FxRef | null;
  readonly speed: number;
}
const arcs = ((FX_MAP as Record<string, unknown>).arcs ?? {}) as Record<string, ArcFx>;

/** The lightning for an arc: `mount` (an arc sentry), `fence` (an electric fence) or `default` (a gun: the Arc Caster). */
export function arcFx(source: 'mount' | 'fence' | 'default'): ArcFx | null {
  return arcs[source] ?? arcs.default ?? null;
}

const lasting = ((FX_MAP as Record<string, unknown>).lasting ?? {}) as Record<string, FxRef>;

/** An effect that lasts while something is so (`charge.sentry_arc`, `fire.zone` …): the exact key, else the part before the dot. */
export function lastingFx(key: string): FxRef | null {
  return lasting[key] ?? lasting[key.split('.')[0]!] ?? null;
}

/** Every lasting effect's key (`charge.sentry_arc`, `fire.zone` …), for the performance probe. */
export function lastingKeys(): string[] {
  return Object.keys(lasting);
}

/** Every pack effect the map can play, for warming up a match's effects before the first fight. */
export function mappedEffects(): FxRef[] {
  const seen = new Map<string, FxRef>();
  const visit = (r: unknown) => {
    if (!r || typeof r !== 'object') return;
    if ('pack' in r && 'effect' in r) seen.set(`${(r as FxRef).pack}/${(r as FxRef).effect}`, r as FxRef);
    else for (const x of Object.values(r)) visit(x);
  };
  const { muzzle: _m, ...rest } = FX_MAP as Record<string, unknown>;
  visit(rest);
  return [...seen.values()];
}

/** The effect packs (public/vfx/<pack>.json) the map plays from, for loading with the match. */
export function mappedPacks(): string[] {
  return [...new Set(mappedEffects().map((r) => r.pack))];
}

/** Bursts seen from afar (View.farSize) keep the size on screen they have this far off (m; the flashing flow's moments are 3 m off), growing up to this many times. */
const FAR_FX_NEAR = 3;
const FAR_FX_MOST = 4;

/** A burst's size `d` m off that keeps it as big on screen as FAR_FX_NEAR m off (1 nearer, at most FAR_FX_MOST). */
export const farFxSize = (d: number): number => Math.max(1, Math.min(FAR_FX_MOST, d / FAR_FX_NEAR));
