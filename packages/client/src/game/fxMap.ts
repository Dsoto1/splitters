import type { MapDocument, WeaponDefinition, WorldBox } from '@tiletrigger/shared';
import { FX_MAP } from './fxMap.generated.ts';

/**
 * Which effect plays where, read from content/vfx.json's `map` (fxMap.generated.ts): muzzle flashes by
 * weapon family, impacts by the surface a round hit, explosions by weapon and kind, and moments of play.
 * Everything here is data lookups; godotVfx.ts and impactVisuals.ts draw.
 */

/** One Binbun effect: `pack` is public/vfx/<pack>.json (hit_fx, explosion_fx, electric_fx …). */
export interface FxRef {
  readonly pack: string;
  readonly effect: string;
  readonly scale: number;
}

export type Surface = 'stone' | 'metal' | 'wood' | 'dirt' | 'flesh' | 'water';

/** How a round hitting a level surface looks: sparks, dust colour and size, and an optional accent effect. */
export interface ImpactStyle {
  readonly sparks: number;
  readonly dust: string;
  readonly dustSize: number;
  readonly accent: FxRef | null;
}

const muzzle = FX_MAP.muzzle as Record<string, { effect: string; scale: number }>;

/** The muzzle flash of a weapon (an effect of muzzle_flash.json and its size), or none (melee, beams, the railgun). */
export function muzzleEffectFor(def: WeaponDefinition): { id: string; scale: number } | null {
  if (def.kind === 'melee' || def.view.beam || def.id === 'core.railgun') return null;
  const own = def.view.muzzle;
  if (own) return { id: own.effect, scale: own.scale ?? 0.2 };
  const m = (def.family && muzzle[def.family]) || (def.projectile ? muzzle.projectile : !def.ammo ? null : def.pellets > 1 ? muzzle.pellets : def.damage >= 60 ? muzzle.heavy : muzzle.default);
  return m ? { id: m.effect, scale: m.scale } : null;
}

const SURFACE_WORDS = Object.entries(FX_MAP.surfaces as Record<string, readonly string[]>).filter(([, w]) => w.length) as [Surface, readonly string[]][];

/** The surface named by an id or material (`prop.shipping_container_red`, `core.wood_planks` …): the first word list that matches; stone otherwise. */
export function surfaceOfName(name: string): Surface {
  const n = name.toLowerCase();
  for (const [s, words] of SURFACE_WORDS) if (words.some((w) => n.includes(w))) return s;
  return 'stone';
}

/** Each placement's surface (prop entities by their model, tiles by their id with the map's theme), made once per map. */
export function surfaceIndex(doc: Pick<MapDocument, 'entities' | 'classicStructure'>): Map<string, Surface> {
  const out = new Map<string, Surface>();
  for (const e of doc.entities) if (e.kind === 'prop') out.set(e.id, surfaceOfName(e.model));
  const theme = doc.classicStructure.theme;
  for (const t of doc.classicStructure.tiles) out.set(t.id, surfaceOfName(`${t.tile} ${theme}`));
  return out;
}

/** The surface of a level box a round hit (none: the terrain, which is dirt): a free block's material, else its placement's (surfaceIndex). */
export function surfaceOfBox(box: WorldBox | null | undefined, index: ReadonlyMap<string, Surface> | null): Surface {
  if (!box) return 'dirt';
  if (box.surface?.material) return surfaceOfName(box.surface.material);
  return index?.get(box.sourceId) ?? 'stone';
}

const impacts = FX_MAP.impacts as unknown as Record<string, Partial<ImpactStyle> | number>;
const STONE: ImpactStyle = { sparks: 2, dust: '#a39d92', dustSize: 1, accent: null };

/** How a round lands on `surface`. */
export function impactStyle(surface: Surface): ImpactStyle {
  const s = impacts[surface];
  return typeof s === 'object' ? { ...STONE, ...s } : STONE;
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
  const { muzzle: _m, surfaces: _s, ...rest } = FX_MAP as Record<string, unknown>;
  visit(rest);
  return [...seen.values()];
}

/** The effect packs (public/vfx/<pack>.json) the map plays from, for loading with the match. */
export function mappedPacks(): string[] {
  return [...new Set(mappedEffects().map((r) => r.pack))];
}
