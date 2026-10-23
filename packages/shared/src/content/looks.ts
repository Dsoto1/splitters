/**
 * Preset character looks built from the shared character parts (see
 * tools/content/prepare-characters.mjs and docs/CHARACTERS.md). Every part for
 * a body type shares one skeleton, so heads, hair, outfit parts, colourways and
 * tints combine freely; the Character Designer will expose the same choices.
 */
export type BodyType = 'male' | 'female';

/** Where an outfit part goes. A look uses at most one part per slot. */
export type PartSlot = 'arms' | 'torso' | 'legs' | 'feet' | 'hood' | 'pauldron';

export interface CharacterLook {
  id: string;
  name: string;
  body: BodyType;
  /** Part files in public/characters (without .glb). */
  head: string;
  /** Outfit parts; the first one carries the skeleton. */
  parts: string[];
  /** Hair, beards (any number, all for this body). */
  hair: string[];
  /** Alternative colourways (texture IDs) replacing a material family's default. */
  colorways: string[];
  /** Skin tint multiplied over the skin texture (#rrggbb), or null for none. */
  skin: string | null;
  /** Hair tint multiplied over the hair texture, or null for none. */
  hairColor: string | null;
}

/** Skin tones offered by the presets and, later, the Character Designer. */
export const SKIN_TONES = ['#ffffff', '#f0d8c8', '#c89878', '#9a6a4e', '#6e4a38'] as const;

const ranger = (s: 'm' | 'f', hood = true, pauldron = true): string[] => [
  `ranger_torso_${s}`,
  `ranger_arms_${s}`,
  `ranger_legs_${s}`,
  `ranger_feet_${s}`,
  ...(hood ? [`ranger_hood_${s}`] : []),
  ...(pauldron ? [`ranger_pauldron_${s}`] : []),
];
const peasant = (s: 'm' | 'f'): string[] => [`peasant_torso_${s}`, `peasant_arms_${s}`, `peasant_legs_${s}`, `peasant_feet_${s}`];

/** Presets that between them use every part, hairstyle and colourway. */
export const CORE_LOOKS: readonly CharacterLook[] = [
  { id: 'core.ranger', name: 'Ranger', body: 'male', head: 'head_male', parts: ranger('m'), hair: ['hair_simpleparted'], colorways: [], skin: null, hairColor: '#8a6a50' },
  { id: 'core.huntress', name: 'Huntress', body: 'female', head: 'head_female', parts: ranger('f'), hair: ['hair_long'], colorways: [], skin: null, hairColor: '#b08850' },
  { id: 'core.warden', name: 'Warden', body: 'male', head: 'head_male', parts: ranger('m'), hair: ['hair_buzzed', 'hair_beard'], colorways: ['ranger_moss'], skin: SKIN_TONES[3], hairColor: '#3a3030' },
  { id: 'core.scout', name: 'Scout', body: 'female', head: 'head_female', parts: ranger('f', true, false), hair: ['hair_buns'], colorways: ['ranger_moss'], skin: SKIN_TONES[2], hairColor: '#4a3428' },
  { id: 'core.farmhand', name: 'Farmhand', body: 'male', head: 'head_male', parts: peasant('m'), hair: ['hair_buzzed'], colorways: [], skin: SKIN_TONES[1], hairColor: '#c09060' },
  { id: 'core.miller', name: 'Miller', body: 'female', head: 'head_female', parts: peasant('f'), hair: ['hair_buns'], colorways: ['peasant_dusk'], skin: null, hairColor: '#6a4a3a' },
  {
    id: 'core.tracker',
    name: 'Tracker',
    body: 'male',
    head: 'head_male',
    parts: ['ranger_torso_m', 'ranger_arms_m', 'peasant_legs_m', 'ranger_feet_m'],
    hair: ['hair_simpleparted', 'hair_beard'],
    colorways: ['peasant_dusk'],
    skin: SKIN_TONES[4],
    hairColor: '#2a2422',
  },
  {
    id: 'core.pathfinder',
    name: 'Pathfinder',
    body: 'female',
    head: 'head_female',
    parts: ['ranger_torso_f', 'ranger_arms_f', 'peasant_legs_f', 'ranger_feet_f', 'ranger_pauldron_f'],
    hair: ['hair_long'],
    colorways: ['ranger_moss'],
    skin: SKIN_TONES[4],
    hairColor: '#2a2422',
  },
  {
    id: 'core.drifter',
    name: 'Drifter',
    body: 'male',
    head: 'head_male',
    parts: ['peasant_torso_m', 'peasant_arms_m', 'peasant_legs_m', 'peasant_feet_m', 'ranger_hood_m', 'ranger_pauldron_m'],
    hair: ['hair_beard'],
    colorways: ['peasant_dusk'],
    skin: SKIN_TONES[2],
    hairColor: '#5a4030',
  },
  {
    id: 'core.wayfarer',
    name: 'Wayfarer',
    body: 'female',
    head: 'head_female',
    parts: ['peasant_torso_f', 'peasant_arms_f', 'peasant_legs_f', 'ranger_feet_f', 'ranger_hood_f'],
    hair: ['hair_buzzedfemale'],
    colorways: [],
    skin: SKIN_TONES[3],
    hairColor: '#3a2a22',
  },
  { id: 'core.brawler', name: 'Brawler', body: 'male', head: 'head_male', parts: ['athlete_torso_m', 'peasant_legs_m', 'peasant_feet_m'], hair: ['hair_buzzed'], colorways: [], skin: SKIN_TONES[2], hairColor: '#2a2422' },
  { id: 'core.sprinter', name: 'Sprinter', body: 'female', head: 'head_female', parts: ['athlete_torso_f', 'athlete_legs_f', 'athlete_feet_f'], hair: ['hair_buzzedfemale'], colorways: [], skin: SKIN_TONES[1], hairColor: '#d0a060' },
  { id: 'core.champion', name: 'Champion', body: 'male', head: 'head_male', parts: ['athlete_torso_m', 'athlete_legs_m', 'athlete_feet_m', 'ranger_pauldron_m'], hair: ['hair_simpleparted'], colorways: ['athlete_light_m'], skin: SKIN_TONES[1], hairColor: '#2a2422' },
  { id: 'core.striker', name: 'Striker', body: 'female', head: 'head_female', parts: ['athlete_torso_f', 'ranger_legs_f', 'ranger_feet_f', 'ranger_pauldron_f'], hair: ['hair_long'], colorways: ['athlete_light_f'], skin: null, hairColor: '#8a3a2a' },
];

export const DEFAULT_LOOK = CORE_LOOKS[0]!.id;

export const getLook = (id: string | undefined): CharacterLook => CORE_LOOKS.find((l) => l.id === id) ?? CORE_LOOKS[0]!;

/** A stable look for a Player Bot, spread across the roster. */
export const lookForBot = (index: number): string => CORE_LOOKS[(index + 1) % CORE_LOOKS.length]!.id;

/** Material families that take a shared texture, by material-name prefix. */
const FAMILIES: readonly [RegExp, string][] = [
  [/^MI_Ranger/, 'ranger'],
  [/^MI_Peasant/, 'peasant'],
  [/^MI_Athlete/, 'athlete'],
  [/^MI_(Regular|Superhero)/, 'skin'],
  [/^MI_Hair_1/, 'hair'],
  [/^MI_Hair_2/, 'hair'],
];

/** Whether a material shows skin (takes the look's skin tint; sportswear is tinted with it) or hair (its hair colour). */
export const materialTint = (material: string): 'skin' | 'hair' | null =>
  /^MI_(Regular|Superhero|Athlete)/.test(material) ? 'skin' : /^MI_Hair/.test(material) ? 'hair' : null;

/**
 * The shared texture (public/characters/textures/<id>.jpg) for one of a part's
 * materials, or null if the part carries its own. Colourway IDs start with
 * their family's name; per-body textures end in _m / _f.
 */
export function textureFor(material: string, look: CharacterLook): string | null {
  const family = FAMILIES.find(([re]) => re.test(material))?.[1];
  if (!family) return null;
  const sex = look.body === 'male' ? 'm' : 'f';
  if (family === 'hair') return material.startsWith('MI_Hair_1') ? 'hair_1' : 'hair_2';
  if (family === 'skin') return `skin_${sex}`;
  const colorway = look.colorways.find((c) => c.split('_')[0] === family);
  if (colorway) return colorway;
  return family === 'athlete' ? `athlete_${sex}` : family;
}
