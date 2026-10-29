import { CORE_WEAPONS, getWeapon } from '@tiletrigger/shared';
import type { ModelThumbnails } from './modelThumbs.ts';
import { SHIPPED_WEAPON_ICONS } from './weaponIconIndex.ts';

/**
 * Weapon icons for the HUD kill feed and the character loadout: side-on
 * pictures of the weapons' own models. They ship with the site
 * (public/weapon-icons/, tools/content/capture-weapon-icons.mjs), so a kill
 * feed line in a big fight never builds a 3D model and compiles its shaders
 * mid-match; a model missing from that set is rendered live (one renderer
 * for the whole app).
 */
let source: ModelThumbnails | null = null;

export function setWeaponIconSource(thumbs: ModelThumbnails): void {
  source = thumbs;
  // For the capture tool: every weapon model, and a live render of one.
  (globalThis as unknown as { __weaponIcons: unknown }).__weaponIcons = {
    models: () => [...new Set(Object.values(CORE_WEAPONS).map((w) => w.view.model))],
    render: (model: string) => thumbs.get(model, 'side'),
  };
}

/** An <img> for a weapon (empty until its icon has loaded), or null for non-weapons (hazards, grenades). */
export function weaponIcon(weaponId: string, className = 'wicon'): HTMLImageElement | null {
  let model: string;
  try {
    model = getWeapon(weaponId).view.model;
  } catch {
    return null;
  }
  const shipped = SHIPPED_WEAPON_ICONS[model];
  if (!shipped && !source) return null;
  const img = document.createElement('img');
  img.className = className;
  img.alt = '';
  if (shipped) img.src = `${import.meta.env.BASE_URL}weapon-icons/${shipped}`;
  else void source!.get(model, 'side').then((src) => (img.src = src), () => undefined);
  return img;
}
