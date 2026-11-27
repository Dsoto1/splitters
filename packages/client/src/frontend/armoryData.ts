import { CORE_WEAPONS, gunplayOf, type WeaponDefinition } from '@tiletrigger/shared';
import { WHEEL_CATEGORIES, WHEEL_CATEGORY_LABELS, wheelCategoryOf, type WheelCategory } from '../game/wheelCategories.ts';
import { arsenalMax } from '../tools/weaponCompare.ts';
import { weaponStats, type WeaponStats } from '../tools/weaponTuningData.ts';

/**
 * The Armory's data (frontend/armory.ts draws it; docs/ARSENAL.md, "Armory"): every weapon a player can hold, in the
 * weapon wheel's eight categories (game/wheelCategories.ts: a weapon's category comes from its own data), its role,
 * description and stat bars. The numbers are the sim's own (tools/weaponTuningData.ts, the weapon tuning page's), on
 * the same arsenal-wide scale (weaponCompare.ts arsenalMax). Nothing owner-only: the Weapon Manager's edits and change
 * sets stay on its own page.
 */

/** Each weapon's notes in its content file (`notes.description`, written in the Weapon Manager; `notes.range`). */
const NOTES = import.meta.glob<Record<string, string> | undefined>('../../../../content/weapons/*.json', { eager: true, import: 'notes' });
const NOTE_OF = new Map<string, Record<string, string>>();
for (const [path, notes] of Object.entries(NOTES)) if (notes) NOTE_OF.set(`core.${path.replace(/^.*\//, '').replace(/\.json$/, '')}`, notes);

/**
 * A weapon players can hold and the Armory lists: in a hand (slot > 0: not a mounted gun or a vehicle's), not hidden
 * (the Weapon Manager's hide), and with a pickup category or swung (melee and tools); mode-only weapons with neither
 * (the arena disc) are left out.
 */
export function inArmory(def: WeaponDefinition): boolean {
  return def.slot > 0 && !def.hidden && (!!def.category || def.kind === 'melee');
}

export interface ArmorySection {
  id: WheelCategory;
  label: string;
  weapons: WeaponDefinition[];
}

/** The Armory's sections: the wheel's categories in its order, each with its weapons by name; empty ones left out. */
export function armorySections(defs: readonly WeaponDefinition[] = Object.values(CORE_WEAPONS)): ArmorySection[] {
  const out = WHEEL_CATEGORIES.map((id) => ({ id, label: WHEEL_CATEGORY_LABELS[id], weapons: [] as WeaponDefinition[] }));
  for (const d of defs) if (inArmory(d)) out[WHEEL_CATEGORIES.indexOf(wheelCategoryOf(d))]!.weapons.push(d);
  for (const s of out) s.weapons.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return out.filter((s) => s.weapons.length);
}

/** The role by family (content/weapons/families.json): what each is for. */
const FAMILY_ROLES: Record<string, string> = {
  pistol: 'Sidearm: quick to draw, steady at close range',
  revolver: 'Heavy sidearm: few rounds, each one counts',
  machine_pistol: 'Spray sidearm: a fast burst up close',
  smg: 'Close range: a high rate of light rounds on the move',
  rifle: 'All-rounder: full auto, good to the middle distance',
  battle_rifle: 'Mid range: heavy rounds, harder to hold on target',
  marksman: 'Marksman: precise single shots at range',
  precision: 'Long range: one well-placed round',
  lmg: 'Suppression: a big magazine and a long spray',
  shotgun: 'Close quarters: a spread of pellets that hits hard',
};

/** The weapon's role in a line: its family's, else what its category and data say it does. */
export function armoryRole(def: WeaponDefinition): string {
  if (def.family && FAMILY_ROLES[def.family]) return FAMILY_ROLES[def.family]!;
  const cat = wheelCategoryOf(def);
  if (cat === 'melee') return def.category === 'melee' ? 'Melee: up close, no ammo to run out of' : 'Gadget: a tool rather than a gun';
  if (def.category === 'explosive') return 'Explosive: splash damage, keep your distance';
  if (cat === 'energy') return def.heat ? 'Energy: no reloads, mind the heat' : 'Energy: runs on cells';
  if (def.category === 'sniper') return 'Long range: one well-placed shot';
  if (def.category === 'shotgun') return 'Close quarters: a spread that hits hard';
  if (def.category === 'special') return 'Special: does something no other gun does';
  return `${WHEEL_CATEGORY_LABELS[cat]}`;
}

/** The weapon's description (`notes.description`, the Weapon Manager's), and its range note when it has one. */
export function armoryText(def: WeaponDefinition): { description: string; range: string } {
  const n = NOTE_OF.get(def.id);
  return { description: n?.description ?? '', range: n?.range ?? '' };
}

/** One stat bar: its label, how full (0..1, on the arsenal's scale), the value as text and a hint. */
export interface ArmoryStat {
  key: string;
  label: string;
  share: number;
  text: string;
  help: string;
}

let maxes: Record<keyof WeaponStats, number> | null = null;
const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** The sim's numbers for a weapon (null when it has none: a tool), safe for any definition. */
function statsOf(def: WeaponDefinition): WeaponStats | null {
  try {
    return weaponStats(def);
  } catch {
    return null;
  }
}

/**
 * The stat bars: damage, fire rate, range, handling, mobility, magazine, reload (a melee weapon or a tool: damage,
 * rate and mobility). Longer is better on every bar (handling and reload are drawn as speed); the scale is the largest
 * any family gun has, so an explosive's splash runs off the end, capped.
 */
export function armoryStats(def: WeaponDefinition): ArmoryStat[] {
  maxes ??= arsenalMax();
  const m = maxes;
  const s = statsOf(def);
  const gp = (() => {
    try {
      return gunplayOf(def);
    } catch {
      return null;
    }
  })();
  const out: ArmoryStat[] = [];
  const melee = def.kind === 'melee';
  const pull = s ? s.damage : def.damage * Math.max(1, def.pellets);
  out.push({ key: 'damage', label: 'Damage', share: clamp(pull / Math.max(1, m.damage)), text: String(Math.round(pull)), help: def.pellets > 1 ? `Damage a pull: ${def.pellets} pellets of ${def.damage}` : 'Damage a hit, before distance and where it lands' });
  if (s && s.rpm > 0) out.push({ key: 'rate', label: melee ? 'Swing rate' : 'Fire rate', share: clamp(s.rpm / Math.max(1, m.rpm)), text: `${Math.round(s.rpm)}`, help: melee ? 'Swings a minute' : 'Rounds a minute' });
  if (!melee) {
    // Range: where its damage stops falling (its falloff's end), else how far it reaches.
    const far = gp?.falloff ? gp.falloff.end : Math.min(def.range, 150);
    out.push({ key: 'range', label: 'Range', share: clamp(far / 150), text: `${Math.round(far)} m`, help: gp?.falloff ? `Full damage to ${Math.round(gp.falloff.start)} m, falling to ${Math.round(gp.falloff.min * 100)} % by ${Math.round(gp.falloff.end)} m` : `Reaches ${Math.round(def.range)} m` });
    if (s && m.ads > 0) out.push({ key: 'handling', label: 'Handling', share: clamp(1 - s.ads / (m.ads * 1.15)), text: `${Math.round(s.ads * 1000)} ms`, help: 'How quickly the sights come up (shorter is better)' });
  }
  if (s && m.move > 0.8) out.push({ key: 'mobility', label: 'Mobility', share: clamp((s.move - 0.8) / (m.move - 0.8)), text: `${Math.round(s.move * 100)} %`, help: 'Your movement speed holding it' });
  if (!melee && def.magazine > 0) {
    out.push({ key: 'magazine', label: 'Magazine', share: clamp(def.magazine / Math.max(1, m.capacity)), text: String(def.magazine), help: `${def.magazine} in the magazine, up to ${def.reserveMax} carried` });
    if (s && s.reload > 0 && m.reload > 0) out.push({ key: 'reload', label: 'Reload', share: clamp(1 - s.reload / (m.reload * 1.1)), text: `${s.reload.toFixed(1)} s`, help: 'A reload from empty (shorter is better)' });
  }
  return out;
}

/** Tags under the name: its category, how it fires and what it takes. */
export function armoryTags(def: WeaponDefinition): string[] {
  const tags: string[] = [WHEEL_CATEGORY_LABELS[wheelCategoryOf(def)]];
  if (def.kind === 'melee') tags.push(def.category === 'melee' ? 'Melee' : 'Tool');
  else tags.push(def.kind === 'hitscan' ? 'Hitscan' : 'Projectile');
  if (def.kind !== 'melee' && (def.heat || def.ammo)) tags.push(def.heat ? 'Heat' : `${def.ammo![0]!.toUpperCase()}${def.ammo!.slice(1)} ammo`);
  return tags;
}

/** The model the Armory shows: the held (sharpest) copy where one exists, else the shared one. */
export const armoryModel = (def: WeaponDefinition): string => def.view.held?.high ?? def.view.held?.medium ?? def.view.model;

/** The Armory's favourites (kept in this browser, like Character Select's). */
const FAVS_KEY = 'tiletrigger.armoryFavs';
export function loadArmoryFavs(store: Pick<Storage, 'getItem'> | null = safe()): string[] {
  try {
    const v = JSON.parse(store?.getItem(FAVS_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 200) : [];
  } catch {
    return [];
  }
}
/** Keep or drop a favourite; whether it's kept now. */
export function toggleArmoryFav(id: string, store: Pick<Storage, 'getItem' | 'setItem'> | null = safe()): boolean {
  const favs = loadArmoryFavs(store);
  const now = !favs.includes(id);
  try {
    store?.setItem(FAVS_KEY, JSON.stringify(now ? [...favs, id] : favs.filter((x) => x !== id)));
  } catch {
    // Storage unavailable: kept for this visit only.
  }
  return now;
}
function safe(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}
