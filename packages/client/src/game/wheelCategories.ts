import { type WeaponDefinition, weaponByCode } from '@tiletrigger/shared';

/**
 * The weapon wheel's slices and the number keys' categories (owner, 2026-11-22), clockwise from the top and in key
 * order: key 1 is Pistols, key 8 Melee & gadgets. A weapon's slice comes from its own data (wheelCategoryOf), never
 * from a list of names, so a new weapon, or one whose category the Weapon Manager changes, lands in the right slice.
 */
export const WHEEL_CATEGORIES = ['pistol', 'smg', 'rifle', 'shotgun', 'sniper', 'heavy', 'energy', 'melee'] as const;
export type WheelCategory = (typeof WHEEL_CATEGORIES)[number];
export const WHEEL_CATEGORY_LABELS: Record<WheelCategory, string> = {
  pistol: 'Pistols',
  smg: 'SMGs',
  rifle: 'Rifles',
  shotgun: 'Shotguns',
  sniper: 'Snipers',
  heavy: 'Heavy',
  energy: 'Energy',
  melee: 'Melee & gadgets',
};

/**
 * The wheel slice of a weapon, from its data:
 * - melee weapons and tools (medkit, grapple, builder, medi-beam: no pickup category, swung or used, not fired)
 *   → Melee & gadgets;
 * - anything running on energy cells or heat (lasers, plasma, the railgun, the arc caster…) → Energy;
 * - explosives (launchers, rockets) and the machine-gun family → Heavy;
 * - the other specials: a sidearm (slot 2: the flare gun, the gilded pistol) → Pistols, the rest (flamethrower, goo
 *   gun, oil slicker, bubble blaster) → Heavy;
 * - otherwise its pickup category (pistol, smg, rifle, shotgun, sniper); a weapon with none (mode-only, mounted) → Heavy.
 */
export function wheelCategoryOf(def: WeaponDefinition): WheelCategory {
  if (def.category === 'melee' || (!def.category && def.kind === 'melee')) return 'melee';
  if (def.ammo === 'cells' || def.heat) return def.category === 'explosive' ? 'heavy' : 'energy';
  if (def.category === 'explosive' || def.family === 'lmg') return 'heavy';
  if (def.category === 'special') return def.slot === 2 ? 'pistol' : 'heavy';
  if (def.category && (WHEEL_CATEGORIES as readonly string[]).includes(def.category)) return def.category as WheelCategory;
  return 'heavy';
}

/** The weapons you hold in each slice, in the order given (the wheel's and the number keys' order). */
export function byCategory(codes: readonly number[]): Map<WheelCategory, number[]> {
  const out = new Map<WheelCategory, number[]>(WHEEL_CATEGORIES.map((c) => [c, []]));
  for (const code of codes) {
    const def = weaponByCode(code);
    if (def) out.get(wheelCategoryOf(def))!.push(code);
  }
  return out;
}

/**
 * Each slice's last pick: what a number key, or a quick flick to the slice on the wheel, comes back to. `note` is told
 * every weapon you end up holding (however you got there: a key, the wheel, scrolling, a pickup), so the slice
 * remembers the one you used last.
 */
export class CategoryPicks {
  private readonly last = new Map<WheelCategory, number>();

  note(code: number): void {
    const def = weaponByCode(code);
    if (def) this.last.set(wheelCategoryOf(def), code);
  }

  /** The slice's pick among `held` (its weapons you hold): the last one used if you still have it, else the first. */
  pick(cat: WheelCategory, held: readonly number[]): number | null {
    const l = this.last.get(cat);
    return l !== undefined && held.includes(l) ? l : (held[0] ?? null);
  }

  clear(): void {
    this.last.clear();
  }
}

/**
 * A category key pressed (key `n`, 1-based, in WHEEL_CATEGORIES order): the weapon to switch to, or null. Away from
 * the category it brings back the slice's last pick; with one of its weapons already in hand (or asked for), each
 * press goes on to the next one you hold in it.
 */
export function categoryKeyPick(n: number, owned: readonly number[], current: number, picks: CategoryPicks): number | null {
  const cat = WHEEL_CATEGORIES[n - 1];
  if (!cat) return null;
  const held = byCategory(owned).get(cat)!;
  if (!held.length) return null;
  const i = held.indexOf(current);
  if (i < 0) return picks.pick(cat, held);
  const next = held[(i + 1) % held.length]!;
  return next === current ? null : next;
}
