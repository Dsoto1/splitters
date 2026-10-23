import { getWeapon } from '@chronosplit/shared';
import type { ModelThumbnails } from './modelThumbs.ts';

/**
 * Weapon icons for the HUD kill feed and the character loadout, rendered
 * side-on from the weapons' own models (one renderer for the whole app).
 */
let source: ModelThumbnails | null = null;

export function setWeaponIconSource(thumbs: ModelThumbnails): void {
  source = thumbs;
}

/** An <img> for a weapon (empty until its icon has rendered), or null for non-weapons (hazards, grenades). */
export function weaponIcon(weaponId: string, className = 'wicon'): HTMLImageElement | null {
  if (!source) return null;
  let model: string;
  try {
    model = getWeapon(weaponId).view.model;
  } catch {
    return null;
  }
  const img = document.createElement('img');
  img.className = className;
  img.alt = '';
  void source.get(model, 'side').then((src) => (img.src = src), () => undefined);
  return img;
}
