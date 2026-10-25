/**
 * Preset character looks built from the shared character parts (see
 * tools/content/prepare-characters.mjs and docs/CHARACTERS.md). Every part for
 * a body type shares one skeleton, so heads, hair, outfit parts, colourways and
 * tints combine freely. The Character Designer builds custom looks from the
 * same catalogue; they travel as short IDs (encodeLook / decodeLook).
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
  /** Body size (BODY_SIZES); absent = standard. */
  size?: 'small' | 'large';
  /** Outfit dye: the cloth (greens, olives, sportswear) recoloured to this, or the original. */
  cloth?: string | null;
  /** Second dye: leather, belts and trim (the browns). */
  trim?: string | null;
  /** Gear worn over the outfit (GEAR ids, at most one per gear slot). */
  gear?: string[];
  /**
   * A whole-body character (one model with its own textures, `parts[0]`; see
   * tools/content/prepare-meshy-characters.mjs): no separate head, hair, gear or
   * dyes, and not a Designer base. `arms` is its first-person arms file.
   */
  whole?: { arms: string };
}

/** Where a piece of gear goes; one per slot. */
export type GearSlot = 'hat' | 'face' | 'chest' | 'back';

/** Gear built in-game from simple shapes (no model files), coloured by the look's dyes. */
export const GEAR: readonly { id: string; slot: GearSlot; label: string }[] = [
  { id: 'cap', slot: 'hat', label: 'Cap' },
  { id: 'beanie', slot: 'hat', label: 'Beanie' },
  { id: 'helmet', slot: 'hat', label: 'Combat helmet' },
  { id: 'beret', slot: 'hat', label: 'Beret' },
  { id: 'brim', slot: 'hat', label: 'Wide-brim hat' },
  { id: 'headband', slot: 'hat', label: 'Headband' },
  { id: 'shades', slot: 'face', label: 'Sunglasses' },
  { id: 'goggles', slot: 'face', label: 'Goggles' },
  { id: 'mask', slot: 'face', label: 'Bandana mask' },
  { id: 'vest', slot: 'chest', label: 'Plate vest' },
  { id: 'bandolier', slot: 'chest', label: 'Bandolier' },
  { id: 'scarf', slot: 'chest', label: 'Scarf' },
  { id: 'pack', slot: 'back', label: 'Backpack' },
  { id: 'radio', slot: 'back', label: 'Radio pack' },
  { id: 'tank', slot: 'back', label: 'Tank' },
];
export const GEAR_SLOTS: readonly GearSlot[] = ['hat', 'face', 'chest', 'back'];
export const GEAR_SLOT_LABELS: Record<GearSlot, string> = { hat: 'Headwear', face: 'Face', chest: 'Chest', back: 'Back' };
export const gearInfo = (id: string) => GEAR.find((g) => g.id === id);

/** Dye swatches for the Designer (cloth and trim). */
export const DYE_COLORS = ['#2f3a2a', '#5a6b3a', '#8a7a52', '#c8b88a', '#e8e4dc', '#9aa0a8', '#4a4f58', '#1e2126', '#2a3a5c', '#3d6ea8', '#7a2a2a', '#c0392b', '#d07a2a', '#6a3a7a', '#2a7a6a'] as const;

/** Skin tones offered by the presets and the Character Designer. */
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

/** Presets that between them use every part, hairstyle and colourway, and show off dyes and gear. */
export const CORE_LOOKS: readonly CharacterLook[] = [
  { id: 'core.ranger', name: 'Ranger', body: 'male', head: 'head_male', parts: ranger('m'), hair: ['hair_simpleparted'], colorways: [], skin: null, hairColor: '#8a6a50', gear: ['pack'] },
  { id: 'core.huntress', name: 'Huntress', body: 'female', head: 'head_female', parts: ranger('f'), hair: ['hair_long'], colorways: [], skin: null, hairColor: '#b08850', cloth: '#7a2a2a', trim: '#2a2622', gear: ['bandolier'] },
  // Two sizes off the standard: Sprout is small and quick, Bulwark big and tough.
  { id: 'core.sprout', name: 'Sprout', body: 'female', head: 'head_female', parts: peasant('f'), hair: ['hair_buns'], colorways: [], skin: SKIN_TONES[1], hairColor: '#c07a40', size: 'small', cloth: '#e0b84a', gear: ['headband'] },
  { id: 'core.bulwark', name: 'Bulwark', body: 'male', head: 'head_male', parts: ranger('m', false, true), hair: ['hair_buzzed', 'hair_beard'], colorways: ['ranger_moss'], skin: SKIN_TONES[3], hairColor: '#2a2422', size: 'large', cloth: '#4a4f58', trim: '#1e2126', gear: ['helmet', 'vest'] },
  { id: 'core.warden', name: 'Warden', body: 'male', head: 'head_male', parts: ranger('m', false, true), hair: ['hair_buzzed', 'hair_beard'], colorways: ['ranger_moss'], skin: SKIN_TONES[3], hairColor: '#3a3030', cloth: '#2a3a5c', trim: '#3a2a22', gear: ['beret', 'radio'] },
  { id: 'core.scout', name: 'Scout', body: 'female', head: 'head_female', parts: ranger('f', true, false), hair: ['hair_buns'], colorways: ['ranger_moss'], skin: SKIN_TONES[2], hairColor: '#4a3428', cloth: '#c8b88a', trim: '#6a4a30', gear: ['goggles', 'scarf'] },
  { id: 'core.farmhand', name: 'Farmhand', body: 'male', head: 'head_male', parts: peasant('m'), hair: ['hair_buzzed'], colorways: [], skin: SKIN_TONES[1], hairColor: '#c09060', gear: ['brim'] },
  { id: 'core.miller', name: 'Miller', body: 'female', head: 'head_female', parts: peasant('f'), hair: ['hair_buns'], colorways: ['peasant_dusk'], skin: null, hairColor: '#6a4a3a', gear: ['scarf'] },
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
    cloth: '#5a6b3a',
    gear: ['cap', 'shades'],
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
    cloth: '#2a7a6a',
    gear: ['goggles', 'pack'],
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
    cloth: '#4a4f58',
    trim: '#1e2126',
    gear: ['mask'],
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
    cloth: '#6a3a7a',
    gear: ['pack'],
  },
  { id: 'core.brawler', name: 'Brawler', body: 'male', head: 'head_male', parts: ['athlete_torso_m', 'peasant_legs_m', 'peasant_feet_m'], hair: ['hair_buzzed'], colorways: [], skin: SKIN_TONES[2], hairColor: '#2a2422', cloth: '#c0392b', gear: ['headband'] },
  { id: 'core.sprinter', name: 'Sprinter', body: 'female', head: 'head_female', parts: ['athlete_torso_f', 'athlete_legs_f', 'athlete_feet_f'], hair: ['hair_buzzedfemale'], colorways: [], skin: SKIN_TONES[1], hairColor: '#d0a060', cloth: '#3d6ea8', gear: ['shades'] },
  { id: 'core.champion', name: 'Champion', body: 'male', head: 'head_male', parts: ['athlete_torso_m', 'athlete_legs_m', 'athlete_feet_m', 'ranger_pauldron_m'], hair: ['hair_simpleparted'], colorways: ['athlete_light_m'], skin: SKIN_TONES[1], hairColor: '#2a2422', cloth: '#d0a020' },
  { id: 'core.striker', name: 'Striker', body: 'female', head: 'head_female', parts: ['athlete_torso_f', 'ranger_legs_f', 'ranger_feet_f', 'ranger_pauldron_f'], hair: ['hair_long'], colorways: ['athlete_light_f'], skin: null, hairColor: '#8a3a2a', cloth: '#c0392b', trim: '#1e2126', gear: ['headband'] },
  // Uniforms and specialists: one outfit dyed and kitted out differently each time.
  { id: 'core.commando', name: 'Commando', body: 'male', head: 'head_male', parts: ranger('m', false, false), hair: ['hair_buzzed'], colorways: [], skin: SKIN_TONES[4], hairColor: '#1e1a18', cloth: '#262a30', trim: '#1a1c20', gear: ['helmet', 'goggles', 'vest'] },
  { id: 'core.frost', name: 'Frost', body: 'female', head: 'head_female', parts: ranger('f', false, false), hair: ['hair_long'], colorways: [], skin: SKIN_TONES[1], hairColor: '#f0e0c0', cloth: '#e8e4dc', trim: '#7a8088', gear: ['beanie', 'goggles', 'pack'] },
  { id: 'core.operative', name: 'Operative', body: 'male', head: 'head_male', parts: ranger('m', false, false), hair: ['hair_simpleparted'], colorways: [], skin: SKIN_TONES[1], hairColor: '#2a2422', cloth: '#1e2126', trim: '#1e2126', gear: ['shades'] },
  { id: 'core.medic', name: 'Medic', body: 'female', head: 'head_female', parts: peasant('f'), hair: ['hair_buns'], colorways: [], skin: SKIN_TONES[2], hairColor: '#3a2a22', cloth: '#e8e4dc', trim: '#a83030', gear: ['cap', 'pack'] },
  { id: 'core.engineer', name: 'Engineer', body: 'male', head: 'head_male', parts: peasant('m'), hair: ['hair_beard'], colorways: [], skin: SKIN_TONES[3], hairColor: '#5a4030', cloth: '#d07a2a', trim: '#3a3a3a', gear: ['helmet', 'tank'] },
  { id: 'core.desperado', name: 'Desperado', body: 'male', head: 'head_male', parts: ['peasant_torso_m', 'peasant_arms_m', 'peasant_legs_m', 'ranger_feet_m'], hair: ['hair_simpleparted', 'hair_beard'], colorways: [], skin: SKIN_TONES[2], hairColor: '#2a2422', cloth: '#8a7a52', trim: '#4a3020', gear: ['brim', 'mask', 'bandolier'] },
  { id: 'core.raider', name: 'Raider', body: 'female', head: 'head_female', parts: ranger('f', false, true), hair: ['hair_buzzedfemale'], colorways: [], skin: SKIN_TONES[4], hairColor: '#8a3a2a', cloth: '#6a3a7a', trim: '#1e2126', gear: ['goggles', 'bandolier'] },
  // Whole-body originals (prepare-meshy-characters.mjs).
  { id: 'core.knight', name: 'Iron Knight', body: 'male', head: '', parts: ['meshy_knight'], hair: [], colorways: [], skin: null, hairColor: null, whole: { arms: 'meshy_knight_fparms' } },
  { id: 'core.nova', name: 'Capt. Nova', body: 'female', head: '', parts: ['meshy_nova'], hair: [], colorways: [], skin: null, hairColor: null, whole: { arms: 'meshy_nova_fparms' } },
  { id: 'core.dapper', name: 'The Dapper', body: 'male', head: '', parts: ['meshy_dapper'], hair: [], colorways: [], skin: null, hairColor: null, whole: { arms: 'meshy_dapper_fparms' } },
  { id: 'core.sentinel', name: 'Sentinel', body: 'female', head: 'head_female', parts: ranger('f', false, true), hair: ['hair_buns'], colorways: [], skin: SKIN_TONES[3], hairColor: '#2a2422', size: 'large', cloth: '#9aa0a8', trim: '#3a3f48', gear: ['beret', 'vest'] },
];

export const DEFAULT_LOOK = CORE_LOOKS[0]!.id;

/** One-line bios for the presets (character select). */
export const LOOK_BIOS: Readonly<Record<string, string>> = {
  'core.ranger': 'A woodland scout who prefers long sightlines and longer silences.',
  'core.huntress': 'Tracks anything that moves. Has opinions about rifles.',
  'core.warden': 'Keeps the forest roads safe, and keeps score while doing it.',
  'core.scout': 'First in, first out, usually carrying the flag of someone else.',
  'core.farmhand': 'Up before dawn, armed by noon. Hits like a hay bale.',
  'core.miller': 'Grinds grain and opponents with equal patience.',
  'core.tracker': 'Half ranger, half drifter, fully lost on purpose.',
  'core.pathfinder': 'Knows every shortcut, including the ones through walls.',
  'core.drifter': 'Hooded traveller with a pauldron and no forwarding address.',
  'core.wayfarer': 'Walked here from somewhere. Will walk away the winner.',
  'core.brawler': 'Skipped the shirt, kept the attitude.',
  'core.sprinter': 'Track star turned arena regular. Never stops moving.',
  'core.champion': 'Undefeated in the ring; considering the arena a warm-up.',
  'core.striker': 'Sports top, ranger boots, zero patience for campers.',
  'core.commando': 'Helmet, goggles, plates. Treats every room as a breach.',
  'core.frost': 'Came down from the mountain pass. Brought the cold with her.',
  'core.operative': 'Dark suit of armour, darker glasses. Never seen arriving.',
  'core.medic': 'Patches up her team, then patches holes in yours.',
  'core.knight': 'Rode out to a tournament in 1342 and took a very wrong turn. Still undefeated.',
  'core.nova': 'First person on the Moon in 1969, by her own account. Mission control lost the paperwork.',
  'core.dapper': 'Chicago, 1927. Runs the numbers, the speakeasy and, lately, the leaderboard.',
  'core.engineer': 'Hard hat, fuel tank, short temper. Builds things; breaks more.',
  'core.desperado': 'Wanted in three maps. The poster doesn\'t do him justice.',
  'core.raider': 'Goggles down, bandolier full, already halfway across the map.',
  'core.sentinel': 'Holds the line because nobody has ever moved her off it.',
};

// ---------------------------------------------------------------- the part catalogue (Character Designer)

export interface PartInfo {
  id: string;
  body: BodyType;
  slot: PartSlot;
  /** Outfit family, which is also the colourway family of its material. */
  outfit: 'ranger' | 'peasant' | 'athlete';
  label: string;
}

const SLOT_LABEL: Record<PartSlot, string> = { torso: 'Top', arms: 'Arms', legs: 'Trousers', feet: 'Feet', hood: 'Hood', pauldron: 'Pauldrons' };
const OUTFIT_LABEL = { ranger: 'Ranger', peasant: 'Peasant', athlete: 'Sportswear' } as const;
const OUTFIT_SLOTS: Record<PartInfo['outfit'], readonly PartSlot[]> = {
  ranger: ['torso', 'arms', 'legs', 'feet', 'hood', 'pauldron'],
  peasant: ['torso', 'arms', 'legs', 'feet'],
  athlete: ['torso', 'legs', 'feet'],
};

/** Every outfit part, in a fixed order (the order custom look IDs encode). */
export const CHARACTER_PARTS: readonly PartInfo[] = (['male', 'female'] as const).flatMap((body) =>
  (['ranger', 'peasant', 'athlete'] as const).flatMap((outfit) =>
    OUTFIT_SLOTS[outfit].map((slot): PartInfo => {
      const label = outfit === 'athlete' && slot === 'feet' ? 'Bare feet' : outfit === 'athlete' && slot === 'torso' ? 'Sportswear top (bare arms)' : `${OUTFIT_LABEL[outfit]} ${SLOT_LABEL[slot].toLowerCase()}`;
      return { id: `${outfit}_${slot}_${body === 'male' ? 'm' : 'f'}`, body, slot, outfit, label };
    }),
  ),
);

export const PART_SLOTS: readonly PartSlot[] = ['torso', 'arms', 'legs', 'feet', 'hood', 'pauldron'];
export const PART_SLOT_LABELS = SLOT_LABEL;
/** Slots a look must fill (arms are covered by a sportswear top). */
export const REQUIRED_SLOTS: readonly PartSlot[] = ['torso', 'legs', 'feet'];

export const HAIR_STYLES: Readonly<Record<BodyType, readonly { id: string; label: string }[]>> = {
  male: [
    { id: 'hair_simpleparted', label: 'Parted' },
    { id: 'hair_buzzed', label: 'Buzzed' },
    { id: 'hair_beard', label: 'Beard' },
  ],
  female: [
    { id: 'hair_long', label: 'Long' },
    { id: 'hair_buns', label: 'Buns' },
    { id: 'hair_buzzedfemale', label: 'Buzzed' },
  ],
};

/** Alternative colourways, by outfit family (each body has the same choices). */
export const COLORWAYS: readonly { id: string; family: PartInfo['outfit']; body: BodyType | null; label: string }[] = [
  { id: 'ranger_moss', family: 'ranger', body: null, label: 'Moss' },
  { id: 'peasant_dusk', family: 'peasant', body: null, label: 'Dusk' },
  { id: 'athlete_light_m', family: 'athlete', body: 'male', label: 'Light' },
  { id: 'athlete_light_f', family: 'athlete', body: 'female', label: 'Light' },
];

export const HAIR_COLORS = ['#f0e0c0', '#d0a060', '#b08850', '#8a6a50', '#8a3a2a', '#5a4030', '#3a2a22', '#2a2422', '#9aa0a8'] as const;

const partById = new Map(CHARACTER_PARTS.map((p) => [p.id, p]));
export const partInfo = (id: string): PartInfo | undefined => partById.get(id);

/** The part shown as a look's own arms in first person: its arms part, or bare arms under a sportswear top. */
export function firstPersonArms(l: Pick<CharacterLook, 'body' | 'parts' | 'whole'>): string {
  if (l.whole) return l.whole.arms;
  return l.parts.find((p) => partById.get(p)?.slot === 'arms') ?? `athlete_fparms_${l.body === 'male' ? 'm' : 'f'}`;
}

/** Why a look can't be worn (empty when it can). */
export function lookProblems(l: Pick<CharacterLook, 'body' | 'parts' | 'hair' | 'colorways' | 'gear' | 'whole'>): string[] {
  // A whole-body character is complete as it is.
  if (l.whole) return [];
  const out: string[] = [];
  const parts = l.parts.map((id) => partById.get(id));
  if (parts.some((p) => !p || p.body !== l.body)) out.push('a part is for the other body type');
  const slots = parts.filter((p): p is PartInfo => !!p).map((p) => p.slot);
  for (const s of PART_SLOTS) if (slots.filter((x) => x === s).length > 1) out.push(`two parts in the ${SLOT_LABEL[s].toLowerCase()} slot`);
  for (const s of REQUIRED_SLOTS) if (!slots.includes(s)) out.push(`needs ${SLOT_LABEL[s].toLowerCase()}`);
  const bareArms = parts.some((p) => p?.outfit === 'athlete' && p.slot === 'torso');
  if (bareArms && slots.includes('arms')) out.push('a sportswear top already has arms');
  if (!bareArms && !slots.includes('arms')) out.push('needs arms');
  if (l.hair.some((h) => !HAIR_STYLES[l.body].some((s) => s.id === h))) out.push('a hairstyle is for the other body type');
  if (l.colorways.some((c) => !COLORWAYS.some((w) => w.id === c && (w.body === null || w.body === l.body)))) out.push('unknown colourway');
  const gear = (l.gear ?? []).map(gearInfo);
  if (gear.some((g) => !g)) out.push('unknown gear');
  for (const s of GEAR_SLOTS) if (gear.filter((g) => g?.slot === s).length > 1) out.push(`two pieces of ${GEAR_SLOT_LABELS[s].toLowerCase()}`);
  if (gear.some((g) => g?.slot === 'hat') && slots.includes('hood')) out.push('a hat doesn\'t fit over a hood');
  return out;
}

// ---------------------------------------------------------------- custom look IDs

/**
 * Custom looks travel as a short ID (sent in hello, kept in the roster):
 * `c1-` + body (m/f) + part bitmask (4 hex) + hair bitmask (1 hex) +
 * colourway bitmask (1 hex) + skin (6 hex, or "------" for none) + hair colour
 * (6 hex or "------"), then "-s" (small) or "-l" (large) for a size other than standard. Bits follow CHARACTER_PARTS / HAIR_STYLES / COLORWAYS order.
 */
const CUSTOM_PREFIX = 'c1-';

export function encodeLook(l: Pick<CharacterLook, 'body' | 'parts' | 'hair' | 'colorways' | 'skin' | 'hairColor' | 'size' | 'cloth' | 'trim' | 'gear'>): string {
  const bodyParts = CHARACTER_PARTS.filter((p) => p.body === l.body);
  const bits = <T>(list: readonly T[], has: (x: T) => boolean, width: number) =>
    list
      .reduce((n, x, i) => (has(x) ? n | (1 << i) : n), 0)
      .toString(16)
      .padStart(width, '0');
  const colour = (c: string | null) => (c ? c.slice(1).toLowerCase() : '------');
  // Parts keep their order (the first carries the skeleton): sort the bitmask's parts back by slot on decode.
  return [
    CUSTOM_PREFIX,
    l.body === 'male' ? 'm' : 'f',
    bits(bodyParts, (p) => l.parts.includes(p.id), 4),
    bits(HAIR_STYLES[l.body], (h) => l.hair.includes(h.id), 1),
    bits(COLORWAYS, (c) => l.colorways.includes(c.id), 1),
    colour(l.skin),
    colour(l.hairColor),
    // Size travels as an optional suffix, so standard looks keep their old IDs.
    l.size === 'small' ? '-s' : l.size === 'large' ? '-l' : '',
    // Dyes and gear, likewise optional: "-d" + cloth + trim, "-g" + gear bitmask.
    l.cloth || l.trim ? `-d${colour(l.cloth ?? null)}${colour(l.trim ?? null)}` : '',
    l.gear?.length ? `-g${bits(GEAR, (g) => l.gear!.includes(g.id), 4)}` : '',
  ].join('');
}

const CUSTOM_RE = /^c1-([mf])([0-9a-f]{4})([0-9a-f])([0-9a-f])([0-9a-f]{6}|-{6})([0-9a-f]{6}|-{6})(-[sl])?(?:-d([0-9a-f]{6}|-{6})([0-9a-f]{6}|-{6}))?(?:-g([0-9a-f]{4}))?$/;

/** A custom look from its ID, or null if the ID is malformed or the look can't be worn. */
export function decodeLook(id: string): CharacterLook | null {
  const m = CUSTOM_RE.exec(id);
  if (!m) return null;
  const body: BodyType = m[1] === 'm' ? 'male' : 'female';
  const has = (mask: string, i: number) => (parseInt(mask, 16) & (1 << i)) !== 0;
  const parts = CHARACTER_PARTS.filter((p) => p.body === body)
    .filter((_, i) => has(m[2]!, i))
    .sort((a, b) => PART_SLOTS.indexOf(a.slot) - PART_SLOTS.indexOf(b.slot))
    .map((p) => p.id);
  const hair = HAIR_STYLES[body].filter((_, i) => has(m[3]!, i)).map((h) => h.id);
  const colorways = COLORWAYS.filter((_, i) => has(m[4]!, i)).map((c) => c.id);
  const colour = (s: string) => (s.startsWith('-') ? null : `#${s}`);
  const look: CharacterLook = { id, name: 'Custom', body, head: body === 'male' ? 'head_male' : 'head_female', parts, hair, colorways, skin: colour(m[5]!), hairColor: colour(m[6]!), ...(m[7] ? { size: m[7] === '-s' ? ('small' as const) : ('large' as const) } : {}) };
  if (m[8] !== undefined) {
    look.cloth = colour(m[8]);
    look.trim = colour(m[9]!);
  }
  if (m[10]) look.gear = GEAR.filter((_, i) => has(m[10]!, i)).map((g) => g.id);
  return lookProblems(look).length ? null : look;
}

/** A preset or custom look by ID; anything unknown or invalid falls back to the default. */
export const getLook = (id: string | undefined): CharacterLook => CORE_LOOKS.find((l) => l.id === id) ?? (id ? decodeLook(id) : null) ?? CORE_LOOKS[0]!;

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

/** A look's body size (custom or preset); standard when it has none. */
export const bodySizeOf = (look: string | undefined): 'small' | 'standard' | 'large' => getLook(look).size ?? 'standard';
