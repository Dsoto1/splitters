/**
 * Preset character looks built from the shared character parts (see
 * tools/content/prepare-characters.mjs and docs/CHARACTERS.md). Every part for
 * a body type shares one skeleton, so heads, hair, outfit parts, colourways and
 * tints combine freely. The Character Designer builds custom looks from the
 * same catalogue; they travel as short IDs (encodeLook / decodeLook).
 */
import type { CharacterStats } from '../sim/characterStats.ts';
import { WHOLE_BODY_BIOS, WHOLE_BODY_LOOKS } from './characters.generated.ts';

export type BodyType = 'male' | 'female';

/** Where an outfit part goes. A look uses at most one part per slot. */
export type PartSlot = 'arms' | 'torso' | 'legs' | 'feet' | 'hood' | 'pauldron';

/**
 * Tiers for characters, the same rules as for maps (owner, 2026-11-11; map/qualityGates.ts): a character is `core`
 * (the roster the game is judged by: bots, random characters and Roulette draw from it) or `experimental` (offered
 * under its own heading in Character Select and left out of every automatic pick; a person can still choose one, for
 * themselves or for a bot). To be core a character passes every blocking gate (content/characterGates.ts); for an
 * experimental one the gates only report. Absent = core, as every character offered before the tiers.
 */
export type CharacterTier = 'core' | 'experimental';
export const CHARACTER_TIERS: readonly CharacterTier[] = ['core', 'experimental'];
export const CHARACTER_TIER_LABELS: Record<CharacterTier, string> = { core: 'Core', experimental: 'Experimental' };
export const characterTier = (look: { tier?: CharacterTier | undefined }): CharacterTier => look.tier ?? 'core';
/** The looks of a roster an automatic pick may draw (a bot's, a random character's, Roulette's): its core tier, in order. */
export const pickableLooks = <T extends { tier?: CharacterTier | undefined }>(roster: readonly T[]): T[] => roster.filter((l) => characterTier(l) === 'core');

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
  /**
   * How the body gets about: absent, it walks (the rig's gait clips); `roll`, it has no legs to walk on (a robot on a
   * ball) and glides, leaning into its motion and its turns (CharacterAnimator). `locomotion` in its manifest.
   */
  locomotion?: 'roll';
  /**
   * The authored clip set this body moves with while it holds a gun and walks or runs upright (characters/<set>_clips.glb,
   * tools/content/clip-set.mjs: walk and run legs, the upper body walking and running while shooting, walking back
   * while shooting). Absent: DEFAULT_CLIP_SET; a set's id: that one; `false`: the rig's own gait. `clips` in its
   * manifest. A rolling body has none (clipSetOf).
   */
  clips?: string | false;
  /** Outfit dye: the cloth (greens, olives, sportswear) recoloured to this, or the original. */
  cloth?: string | null;
  /** Second dye: leather, belts and trim (the browns). */
  trim?: string | null;
  /** Gear worn over the outfit (GEAR ids, at most one per gear slot). */
  gear?: string[];
  /**
   * A whole-body character (one model with its own textures, `parts[0]`; see
   * tools/content/prepare-meshy-characters.mjs and content/characters): no
   * separate head, hair, gear or dyes, and not a Designer base. In first person
   * it wears `arms`: its own forearms and hands (`<part>_fparms`, cut from the
   * same model), or a universal base-body arms part on the shared rig dyed to
   * match (`cloth`/`trim` for the sleeves, `skin` for the hands). `body:
   * false`: full-body first person shows these arms instead of the whole
   * character (a model whose hat or cape fills the view from its own eyes).
   * `hold`: where this body holds a long gun against everyone's hold, in metres at a 1.8 m body (`forward` along the
   * barrel, `down` square to it, `out` level toward the gun shoulder's side), for a build the shared hold puts the stock at the face of (Bandit: broad, with
   * his head low between high shoulders); `fixes.hold` in its manifest.
   */
  whole?: { arms: string; skin?: string; cloth?: string; trim?: string; body?: false; hold?: { forward?: number; down?: number; out?: number }; grip?: GripTune };
  /** What the character is (Character Select's tabs): set on every built-in look; a design of yours has none. */
  group?: CharacterGroup;
  /** Its tier (`tier` in its manifest; characterTier below): absent = core, as every character offered before the tiers. */
  tier?: CharacterTier;
  /** What kind of creature it is, for its bots' names (NAME_THEMES in botNames.ts); absent: its group's. */
  nameTheme?: string;
  /** Its own character stats (sim/characterStats.ts; `stats` in its manifest): each left out is its size class's. */
  stats?: Partial<CharacterStats>;
}

/**
 * One look's own hands and arms on a held gun, against everyone's (`fixes.grip` in its manifest; third person and
 * Character Select). Each is left out unless that look needs it: the shared hold is tuned for most bodies, and a
 * change to it moves every look (round 2 of the owner's 3 Nov notes), so a body that holds badly is fixed here.
 * Lengths in metres at a 1.8 m body; points `[right, up, ahead]` in the gun's own frame.
 */
export interface GripTune {
  /** Long gun: where the shooting elbow bends toward, added to the shared pole (out from the shoulder, and down). */
  elbowOut?: number;
  elbowDown?: number;
  /** How far each hand closes, as a share of its measured curl (1 unless set; up to 1.6). */
  curlR?: number;
  curlL?: number;
  /** The support hand's point on a pistol / on a long gun's handguard, moved by this much. */
  supportPistol?: [number, number, number];
  supportLong?: [number, number, number];
  /** Each hand turned about its own fingers once it is on the gun (radians). */
  rollR?: number;
  rollL?: number;
  /** The shooting palm's point on a long gun's grip, moved by this much. */
  gripLong?: [number, number, number];
}

/**
 * Character Select's groups, by what a character is (not how its look was built), in tab order. Every
 * built-in look names one: the presets below, the whole-body manifests (`group` in content/characters/*.json,
 * whose checker keeps the same list) and the NPC skins (NPC_ROLE_SPECS). Designs of yours go under Yours.
 */
export const CHARACTER_GROUPS = [
  { id: 'soldiers', label: 'Soldiers' },
  { id: 'legends', label: 'Knights & Legends' },
  { id: 'folk', label: 'Everyday Folk' },
  { id: 'horror', label: 'Undead & Horror' },
  { id: 'animals', label: 'Animals' },
  { id: 'creatures', label: 'Creatures & Machines' },
] as const;
export type CharacterGroup = (typeof CHARACTER_GROUPS)[number]['id'];
export const CHARACTER_GROUP_LABELS = Object.fromEntries(CHARACTER_GROUPS.map((g) => [g.id, g.label])) as Record<CharacterGroup, string>;
export const isCharacterGroup = (x: unknown): x is CharacterGroup => CHARACTER_GROUPS.some((g) => g.id === x);

/** Character Select's section for the experimental tier (after the groups, before Yours), and Yours (your designs). */
export const EXPERIMENTAL_SECTION = 'experimental';
export const MINE_SECTION = 'mine';
/**
 * Character Select's sections for a roster whose entries say which section they sit in (`group`: a CHARACTER_GROUPS
 * id, EXPERIMENTAL_SECTION or MINE_SECTION): each group anyone is in (listed by name), then Experimental when there
 * is anyone in it, then Yours (always, in the order given: it holds "Design new").
 */
export function characterSections<T extends { name: string; group: string }>(roster: readonly T[]): { id: string; label: string; looks: T[] }[] {
  const byName = (id: string) => roster.filter((c) => c.group === id).sort((a, b) => a.name.localeCompare(b.name));
  const groups = [...CHARACTER_GROUPS.map((g) => ({ id: g.id as string, label: g.label as string, looks: byName(g.id) })), { id: EXPERIMENTAL_SECTION, label: CHARACTER_TIER_LABELS.experimental, looks: byName(EXPERIMENTAL_SECTION) }].filter((s) => s.looks.length);
  return [...groups, { id: MINE_SECTION, label: 'Yours', looks: roster.filter((c) => c.group === MINE_SECTION) }];
}

/** Where a piece of gear goes; one per slot. */
export type GearSlot = 'hat' | 'face' | 'chest' | 'back';

/**
 * Gear worn over the outfit. Most is built in-game from shapes fitted to the wearer's head and body (no model files),
 * coloured by the look's dyes; a piece with `model` is a textured model (public/gear/<model>.glb, built by
 * tools/content/prepare-gear.mjs from content/gear.json), fitted to the wearer's head. Custom look IDs encode gear by
 * its place here: only append.
 */
export const GEAR: readonly { id: string; slot: GearSlot; label: string; model?: string }[] = [
  { id: 'cap', slot: 'hat', label: 'Cap' },
  { id: 'beanie', slot: 'hat', label: 'Beanie' },
  { id: 'helmet', slot: 'hat', label: 'Combat helmet', model: 'military_helmet' },
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
  { id: 'steel_helmet', slot: 'hat', label: 'Steel helmet', model: 'steel_helmet' },
  { id: 'aviator_helmet', slot: 'hat', label: 'Aviator helmet', model: 'aviator_helmet' },
  { id: 'mk2_helmet', slot: 'hat', label: 'Brimmed helmet', model: 'mk2_helmet' },
  { id: 'viking_helmet', slot: 'hat', label: 'Horned helmet', model: 'viking_helmet' },
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

/**
 * Looks that were retired, and the kept look each one now resolves to, so a saved profile, setup, bot set or map
 * that still names one keeps working. A retired look stays defined (below) but leaves CORE_LOOKS: Character
 * Select, the bot rotation and the Designer's presets no longer offer it. 2026-11-01: the owner's Roster Board
 * retired 14 original modular looks and Ivory Rustwalker, then Engineer and Warden (Linktifa and Sprout stay).
 */
export const RETIRED_LOOKS: Readonly<Record<string, string>> = {
  'core.champion': 'core.dale',
  'core.desperado': 'core.dale',
  'core.miller': 'core.sprout',
  'core.raider': 'core.ranger',
  'core.sprinter': 'core.sprout',
  'core.striker': 'core.ranger',
  'core.huntress': 'core.ranger',
  'core.tracker': 'core.ranger',
  'core.bulwark': 'core.grunt68',
  'core.commando': 'core.grunt68',
  'core.operative': 'core.grunt68',
  'core.scout': 'core.sprout',
  'core.pathfinder': 'core.sprout',
  'core.wayfarer': 'core.sprout',
  'core.frost': 'core.sprout',
  'core.medic': 'core.sprout',
  'core.sentinel': 'core.sprout',
  'core.farmhand': 'core.dale',
  'core.drifter': 'core.dale',
  'core.brawler': 'core.dale',
  'core.engineer': 'core.dale',
  'core.warden': 'core.grunt68',
  'core.rustwalker': 'core.t350',
  'core.slugger': 'core.t350',
  'core.crimsonop': 'core.stealthop', // held back: a close likeness of a famous game character; owner to decide (files kept)
  // Owner, 2026-11-03: off the roster (files and manifests kept). Rotter tears open at the sides and
  // waist (its download stands with the hands on the hips; see HANDOFF); the others by the owner's choice. Giggles
  // was here too until its new model (Tattered Circus Nightmare, a T-pose rig) replaced it, 2026-11-05.
  'core.vampire': 'core.bonesworth',
  'core.hollowvisitor': 'core.visitor',
  'core.dusttrooper': 'core.desertranger',
  'core.goblin': 'core.grizzelda',
  'core.rotter': 'core.shambler',
  // Owner, 2026-11-04: off the roster (files and manifests kept): their source models weren't in a T-pose, so their
  // hands can't be fixed. The otter NPC role keeps its model (NPC_KEPT_LOOKS).
  'core.otter': 'core.brasshare',
  'core.shade': 'core.mei',
  // Owner, 2026-11-05 ("Remove Briggs and Hollis"): off the roster (files and manifests kept); a saved choice plays
  // the closest soldier kept.
  'core.tposesoldier1': 'core.wwiisoldier', // Hollis
  'core.tposesoldier2': 'core.grunt68', // Briggs
  // Owner, 2026-11-05: Bill off the roster (files and manifests kept). Hyena Warrior (Gnoll) and Snikkit (Goblin
  // Mischief) stay; their hands get the palm-orientation fix first.
  'core.bill': 'core.dale',
  // Owner, 2026-11-06 ("Retire bamboo, add the new turtle"): Bamboo off the roster (files, manifest and portrait
  // kept); saved choices and bot sets play the tortoise, the animal that came in with it.
  'core.panda': 'core.tortoise',
  // Owner, 2026-11-06 (after the intake that gave it the light-blue astronaut): Capt. Nova off the roster (files,
  // manifest and portrait kept); saved choices and bot sets play Spacewalker, the nearest astronaut.
  'core.nova': 'core.astronaut',
};

/**
 * Retired looks an NPC role is still drawn as (NPC_ROLE_SPECS `look`): off the roster, and a player's saved choice
 * of one plays its replacement (validLookId), but getLook still gives the look itself so the NPC keeps its model.
 */
export const NPC_KEPT_LOOKS: ReadonlySet<string> = new Set(['core.goblin', 'core.otter']);

/** Every preset ever defined, retired ones included (see RETIRED_LOOKS). */
const ALL_LOOKS: readonly CharacterLook[] = [
  { id: 'core.ranger', name: 'Linktifa', body: 'male', head: 'head_male', parts: ranger('m'), hair: ['hair_simpleparted'], colorways: [], skin: null, hairColor: '#8a6a50', gear: ['pack'], group: 'legends', nameTheme: 'knight' },
  { id: 'core.huntress', name: 'Huntress', body: 'female', head: 'head_female', parts: ranger('f'), hair: ['hair_long'], colorways: [], skin: null, hairColor: '#b08850', cloth: '#7a2a2a', trim: '#2a2622', gear: ['bandolier'], group: 'folk' },
  // Two sizes off the standard: Sprout is small and quick, Bulwark big and tough.
  { id: 'core.sprout', name: 'Sprout', body: 'female', head: 'head_female', parts: peasant('f'), hair: ['hair_buns'], colorways: [], skin: SKIN_TONES[1], hairColor: '#c07a40', size: 'small', cloth: '#e0b84a', gear: ['headband'], group: 'folk', nameTheme: 'townsfolk' },
  { id: 'core.bulwark', name: 'Bulwark', body: 'male', head: 'head_male', parts: ranger('m', false, true), hair: ['hair_buzzed', 'hair_beard'], colorways: ['ranger_moss'], skin: SKIN_TONES[3], hairColor: '#2a2422', size: 'large', cloth: '#4a4f58', trim: '#1e2126', gear: ['helmet', 'vest'], group: 'soldiers' },
  { id: 'core.warden', name: 'Warden', body: 'male', head: 'head_male', parts: ranger('m', false, true), hair: ['hair_buzzed', 'hair_beard'], colorways: ['ranger_moss'], skin: SKIN_TONES[3], hairColor: '#3a3030', cloth: '#2a3a5c', trim: '#3a2a22', gear: ['beret', 'radio'], group: 'soldiers' },
  { id: 'core.scout', name: 'Scout', body: 'female', head: 'head_female', parts: ranger('f', true, false), hair: ['hair_buns'], colorways: ['ranger_moss'], skin: SKIN_TONES[2], hairColor: '#4a3428', cloth: '#c8b88a', trim: '#6a4a30', gear: ['goggles', 'scarf'], group: 'soldiers' },
  { id: 'core.farmhand', name: 'Farmhand', body: 'male', head: 'head_male', parts: peasant('m'), hair: ['hair_buzzed'], colorways: [], skin: SKIN_TONES[1], hairColor: '#c09060', gear: ['brim'], group: 'folk' },
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
    group: 'folk',
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
    group: 'folk',
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
    group: 'folk',
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
    group: 'folk',
  },
  { id: 'core.brawler', name: 'Brawler', body: 'male', head: 'head_male', parts: ['athlete_torso_m', 'peasant_legs_m', 'peasant_feet_m'], hair: ['hair_buzzed'], colorways: [], skin: SKIN_TONES[2], hairColor: '#2a2422', cloth: '#c0392b', gear: ['headband'], group: 'folk' },
  // Uniforms and specialists: one outfit dyed and kitted out differently each time.
  { id: 'core.commando', name: 'Commando', body: 'male', head: 'head_male', parts: ranger('m', false, false), hair: ['hair_buzzed'], colorways: [], skin: SKIN_TONES[4], hairColor: '#1e1a18', cloth: '#262a30', trim: '#1a1c20', gear: ['helmet', 'goggles', 'vest'], group: 'soldiers' },
  { id: 'core.frost', name: 'Frost', body: 'female', head: 'head_female', parts: ranger('f', false, false), hair: ['hair_long'], colorways: [], skin: SKIN_TONES[1], hairColor: '#f0e0c0', cloth: '#e8e4dc', trim: '#7a8088', gear: ['beanie', 'goggles', 'pack'], group: 'soldiers' },
  { id: 'core.operative', name: 'Operative', body: 'male', head: 'head_male', parts: ranger('m', false, false), hair: ['hair_simpleparted'], colorways: [], skin: SKIN_TONES[1], hairColor: '#2a2422', cloth: '#1e2126', trim: '#1e2126', gear: ['shades'], group: 'soldiers' },
  { id: 'core.medic', name: 'Medic', body: 'female', head: 'head_female', parts: peasant('f'), hair: ['hair_buns'], colorways: [], skin: SKIN_TONES[2], hairColor: '#3a2a22', cloth: '#e8e4dc', trim: '#a83030', gear: ['cap', 'pack'], group: 'soldiers' },
  { id: 'core.engineer', name: 'Engineer', body: 'male', head: 'head_male', parts: peasant('m'), hair: ['hair_beard'], colorways: [], skin: SKIN_TONES[3], hairColor: '#5a4030', cloth: '#d07a2a', trim: '#3a3a3a', gear: ['mk2_helmet', 'tank'], group: 'folk' },
  // Whole-body characters, one per manifest in content/characters (generated: characters.generated.ts).
  ...WHOLE_BODY_LOOKS,
  { id: 'core.sentinel', name: 'Sentinel', body: 'female', head: 'head_female', parts: ranger('f', false, true), hair: ['hair_buns'], colorways: [], skin: SKIN_TONES[3], hairColor: '#2a2422', size: 'large', cloth: '#9aa0a8', trim: '#3a3f48', gear: ['beret', 'vest'], group: 'soldiers' },
];

/**
 * The clip set every look on the shared rig moves with unless it names another or opts out (`clips: false`):
 * content/clip-sets/shooter.json (tools/content/character-manifests.mjs keeps the same name). Looks made later,
 * Designer looks and characters rigged later get it without asking.
 */
export const DEFAULT_CLIP_SET = 'shooter';

/** The clip set a look moves with (`clips`, else DEFAULT_CLIP_SET), or null: opted out, or a rolling body (no legs). */
export function clipSetOf(look: Pick<CharacterLook, 'clips' | 'locomotion'>): string | null {
  if (look.clips === false || look.locomotion === 'roll') return null;
  return look.clips ?? DEFAULT_CLIP_SET;
}

/**
 * The looks on offer (Character Select, the bot manager's list, presets): every preset not retired, of either tier
 * ("core" in the name is the `core.` id prefix, not the tier).
 */
export const CORE_LOOKS: readonly CharacterLook[] = ALL_LOOKS.filter((l) => !(l.id in RETIRED_LOOKS));

/** The looks an automatic pick draws from (the default look, random bots, random characters, Roulette): the core tier of the roster. */
export const PICKABLE_LOOKS: readonly CharacterLook[] = pickableLooks(CORE_LOOKS);

export const DEFAULT_LOOK = PICKABLE_LOOKS[0]!.id;

/** One-line bios for the presets (character select). */
export const LOOK_BIOS: Readonly<Record<string, string>> = {
  'core.ranger': 'A general larper.',
  'core.huntress': 'Tracks anything that moves. Has opinions about rifles.',
  'core.warden': 'Keeps the forest roads safe, and keeps score while doing it.',
  'core.scout': 'First in, first out, usually carrying the flag of someone else.',
  'core.farmhand': 'Up before dawn, armed by noon. Hits like a hay bale.',
  'core.tracker': 'Half ranger, half drifter, fully lost on purpose.',
  'core.pathfinder': 'Knows every shortcut, including the ones through walls.',
  'core.drifter': 'Hooded traveller with a pauldron and no forwarding address.',
  'core.wayfarer': 'Walked here from somewhere. Will walk away the winner.',
  'core.brawler': 'Skipped the shirt, kept the attitude.',
  'core.commando': 'Helmet, goggles, plates. Treats every room as a breach.',
  'core.frost': 'Came down from the mountain pass. Brought the cold with her.',
  'core.operative': 'Dark suit of armour, darker glasses. Never seen arriving.',
  'core.medic': 'Patches up her team, then patches holes in yours.',
  ...WHOLE_BODY_BIOS,
  'core.engineer': 'Hard hat, fuel tank, short temper. Builds things; breaks more.',
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

const CUSTOM_RE = /^c1-([mf])([0-9a-f]{4})([0-9a-f])([0-9a-f])([0-9a-f]{6}|-{6})([0-9a-f]{6}|-{6})(-[sl])?(?:-d([0-9a-f]{6}|-{6})([0-9a-f]{6}|-{6}))?(?:-g([0-9a-f]{4,8}))?$/;

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


/** A preset or custom look by ID (a retired preset gives its replacement); anything unknown or invalid falls back to the default. */
export const getLook = (id: string | undefined): CharacterLook => {
  const npc = id && NPC_KEPT_LOOKS.has(id) ? ALL_LOOKS.find((l) => l.id === id) : undefined;
  if (npc) return npc;
  return lookIn(CORE_LOOKS, id);
};

/**
 * getLook over a roster. By id a look resolves whatever its tier (a saved choice of an experimental character keeps
 * working, and a bot set's hand pick); only the fallback is a pick: the roster's first core look.
 */
export function lookIn(roster: readonly CharacterLook[], id: string | undefined): CharacterLook {
  const key = (id && RETIRED_LOOKS[id]) || id;
  return roster.find((l) => l.id === key) ?? (key ? decodeLook(key) : null) ?? roster.find((l) => characterTier(l) === 'core')!;
}

/** A stable look for the `index`-th bot, spread across a roster's core tier (never an experimental character). */
export function botLookFrom(roster: readonly Pick<CharacterLook, 'id' | 'tier'>[], index: number): string {
  const pool = pickableLooks(roster);
  return pool[(index + 1) % pool.length]!.id;
}

/** A stable look for a Player Bot, spread across the core roster. */
export const lookForBot = (index: number): string => botLookFrom(PICKABLE_LOOKS, index);

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
