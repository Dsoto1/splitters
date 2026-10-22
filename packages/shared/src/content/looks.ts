/**
 * Preset character looks built from the shared character parts (see
 * tools/content/prepare-characters.mjs and docs/CHARACTERS.md). Every part of a
 * look is made for the same body and shares one skeleton, so the Character
 * Designer can later swap heads, hair, outfits and colourways freely.
 */
export type BodyType = 'male' | 'female';

export interface CharacterLook {
  id: string;
  name: string;
  body: BodyType;
  /** Part files in public/characters (without .glb). The outfit carries the skeleton. */
  head: string;
  outfit: string;
  hair: string | null;
  /** Alternative colourway for the outfit material (public/characters/textures/<id>.jpg). */
  colorway: string | null;
}

export const CORE_LOOKS: readonly CharacterLook[] = [
  { id: 'core.ranger', name: 'Ranger', body: 'male', head: 'head_male', outfit: 'outfit_ranger_m', hair: 'hair_simpleparted', colorway: null },
  { id: 'core.huntress', name: 'Huntress', body: 'female', head: 'head_female', outfit: 'outfit_ranger_f', hair: 'hair_long', colorway: null },
  { id: 'core.warden', name: 'Warden', body: 'male', head: 'head_male', outfit: 'outfit_ranger_m', hair: 'hair_beard', colorway: 'ranger_moss' },
  { id: 'core.scout', name: 'Scout', body: 'female', head: 'head_female', outfit: 'outfit_ranger_f', hair: 'hair_buns', colorway: 'ranger_moss' },
  { id: 'core.farmhand', name: 'Farmhand', body: 'male', head: 'head_male', outfit: 'outfit_peasant_m', hair: 'hair_buzzed', colorway: null },
  { id: 'core.miller', name: 'Miller', body: 'female', head: 'head_female', outfit: 'outfit_peasant_f', hair: 'hair_buns', colorway: 'peasant_dusk' },
];

export const DEFAULT_LOOK = CORE_LOOKS[0]!.id;

export const getLook = (id: string | undefined): CharacterLook => CORE_LOOKS.find((l) => l.id === id) ?? CORE_LOOKS[0]!;

/** A stable look for a Player Bot, spread across the roster. */
export const lookForBot = (index: number): string => CORE_LOOKS[(index + 1) % CORE_LOOKS.length]!.id;
