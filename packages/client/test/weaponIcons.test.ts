/**
 * Every weapon in the game ships its icon (public/weapon-icons/, captured by tools/content/capture-weapon-icons.mjs,
 * the "Capture portraits" workflow): the kill feed, the loadout, the weapon wheel and the Weapon Manager show it
 * without building the weapon's model. A weapon whose model changes needs its icon captured again
 * (`node tools/content/capture-weapon-icons.mjs <url> <model>`, docs/CONTENT_PIPELINE.md); until then the
 * Manager shows "no picture" and the kill feed builds the model mid-match.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CORE_WEAPONS } from '@tiletrigger/shared';
import { SHIPPED_WEAPON_ICONS } from '../src/frontend/weaponIconIndex.ts';

const ICONS = join(dirname(fileURLToPath(import.meta.url)), '../public/weapon-icons');
const weapons = Object.values(CORE_WEAPONS);

describe('weapon icons', () => {
  it('every weapon has a shipped icon for its model', () => {
    const missing = weapons.filter((w) => !SHIPPED_WEAPON_ICONS[w.view.model]).map((w) => `${w.id} (${w.view.model})`);
    expect(missing, 'capture them with tools/content/capture-weapon-icons.mjs').toEqual([]);
  });

  it("every icon in the index is a file that ships, with its hash", () => {
    for (const [model, entry] of Object.entries(SHIPPED_WEAPON_ICONS)) {
      const [file, query] = entry.split('?');
      expect(query, model).toMatch(/^v=[0-9a-f]{10}$/);
      expect(existsSync(join(ICONS, file!)), `${model}: ${file}`).toBe(true);
    }
  });

  it('the index names no model a weapon no longer uses', () => {
    const used = new Set(weapons.map((w) => w.view.model));
    expect(Object.keys(SHIPPED_WEAPON_ICONS).filter((m) => !used.has(m))).toEqual([]);
  });
});
