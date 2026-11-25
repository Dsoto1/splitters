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
  /** Soldiers & Spies only: Army or Agency (CHARACTER_BRANCHES; `branch` in its manifest). */
  branch?: CharacterBranch;
  /** A Character Select collection it is listed in instead of its group's section (CHARACTER_COLLECTIONS; `collection` in its manifest). */
  collection?: CharacterCollection;
  /** Character Select lists it as if it were named this (`sortAs` in its manifest; the owner's order): left out, its name. */
  sortAs?: string;
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
  /** The shooting palm's point on a pistol's grip, moved by this much (third person: a hand whose palm sat inside the grip). */
  gripPistol?: [number, number, number];
}

/**
 * Character Select's groups, by what a character is (not how its look was built), in tab order. Every
 * built-in look names one: the presets below, the whole-body manifests (`group` in content/characters/*.json,
 * whose checker keeps the same list) and the NPC skins (NPC_ROLE_SPECS).
 * The owner's Roster Board, 2026-11-14/15: Knights & Legends became Legends (`legends`), Creatures & Machines split
 * into Creatures and Machines, Animals renamed Animalia (`animals`), Undead & Horror renamed Horrors (`horror`); Outer
 * Space and Agents & Spies are new. The owner's pass of 2026-11-17: Creatures merged into Horrors as Horrors &
 * Creatures (`horror`), Agents & Spies into Soldiers as Soldiers & Spies (`soldiers`; each one's `branch` says Army or
 * Agency). The old ids still read as their new group (CHARACTER_GROUP_ALIASES).
 */
export const CHARACTER_GROUPS = [
  { id: 'soldiers', label: 'Soldiers & Spies' },
  { id: 'folk', label: 'Everyday Folk' },
  { id: 'space', label: 'Outer Space' },
  { id: 'legends', label: 'Legends' },
  { id: 'animals', label: 'Animalia' },
  { id: 'machines', label: 'Machines' },
  { id: 'horror', label: 'Horrors & Creatures' },
] as const;
export type CharacterGroup = (typeof CHARACTER_GROUPS)[number]['id'];
export const CHARACTER_GROUP_LABELS = Object.fromEntries(CHARACTER_GROUPS.map((g) => [g.id, g.label])) as Record<CharacterGroup, string>;
/** Retired group ids (saved settings, maps' bot casts, server rules) and the group each one went into (2026-11-17). */
export const CHARACTER_GROUP_ALIASES: Readonly<Record<string, CharacterGroup>> = { agents: 'soldiers', creatures: 'horror' };
/**
 * Soldiers & Spies' sub-designators (`branch` on every look in `soldiers`): Army (the uniformed soldiers) or Agency
 * (agents and spies). A map or a bot-characters setting can ask for one (a real battle's Army only). IDs never change.
 */
export const CHARACTER_BRANCHES = [
  { id: 'army', label: 'Army', group: 'soldiers' },
  { id: 'agency', label: 'Agency', group: 'soldiers' },
] as const satisfies readonly { id: string; label: string; group: CharacterGroup }[];
export type CharacterBranch = (typeof CHARACTER_BRANCHES)[number]['id'];
export const isCharacterBranch = (x: unknown): x is CharacterBranch => CHARACTER_BRANCHES.some((b) => b.id === x);
/** What a character bleeds when hit (BLOOD_KINDS in content/blood.ts, apart so the menu's first JS doesn't carry it). */
export type BloodKind = 'red' | 'green' | 'blue' | 'oil' | 'bone' | 'spirit' | 'stone';
export const isCharacterGroup = (x: unknown): x is CharacterGroup => CHARACTER_GROUPS.some((g) => g.id === x);

/**
 * Character Select's collections: a set of characters with a section of its own, placed after the group named by
 * `after` (owner, 2026-11-22: "Chrono Crew", the time crew). A collection is only Character Select's: its characters
 * keep their `group` for everything else (bot types, rank marks, Roulette, NPC casts), and they are listed in it
 * whatever their tier (an experimental one stays out of automatic picks, but not out of its collection's section).
 * `collection` in a manifest; the checker's list (COLLECTIONS in character-manifests.mjs) matches this one.
 */
export const CHARACTER_COLLECTIONS = [{ id: 'chrono', label: 'Chrono Crew', after: 'space' }] as const satisfies readonly { id: string; label: string; after: CharacterGroup }[];
export type CharacterCollection = (typeof CHARACTER_COLLECTIONS)[number]['id'];
export const isCharacterCollection = (x: unknown): x is CharacterCollection => CHARACTER_COLLECTIONS.some((c) => c.id === x);

/** Character Select's section for the experimental tier (after the groups, before Yours), and Yours (your designs). */
export const EXPERIMENTAL_SECTION = 'experimental';
export const MINE_SECTION = 'mine';
/**
 * Characters Character Select lists side by side (owner, 2026-11-24): each list sits together, in this order, where its
 * first member in the section's order falls. One list to change (they can become one tile with variants later); a list
 * works within one section, so its members share a group.
 */
export const CHARACTER_NEIGHBOURS: readonly (readonly string[])[] = [
  ['core.frida', 'core.larry'], // Freaky Frida, Scary Larry
  ['core.undeadsoldier', 'core.zombiesoldier2', 'core.zombiesoldier1'], // Dog Tag Doyle, Grinning Gus, Zombie Soldier A
  ['core.groaner', 'core.shambler', 'core.fearsomeundead'], // Groaner, Shambler, Fearsome Undead
  ['core.rattles', 'core.bonesworth'], // Rattles, Count Bonesworth
  ['core.mummybot', 'core.pharaoh'], // Mummy Bot, Pharaoh Mummy Warrior
  ['core.aldric', 'core.halvard'], // King Aldric, Old King Halvard
  ['core.imperialguard', 'core.mei'], // Imperial Guard, Lancer Mei
];

function withNeighbours<T extends { id?: string }>(sorted: T[]): T[] {
  let out = sorted;
  for (const list of CHARACTER_NEIGHBOURS) {
    const members = list.map((id) => out.find((c) => c.id === id)).filter((c): c is T => !!c);
    if (members.length < 2) continue;
    const at = Math.min(...members.map((m) => out.indexOf(m)));
    const rest = out.filter((c) => !members.includes(c));
    out = [...rest.slice(0, at), ...members, ...rest.slice(at)];
  }
  return out;
}

/**
 * Character Select's sections for a roster whose entries say which section they sit in (`group`: a CHARACTER_GROUPS
 * id, EXPERIMENTAL_SECTION or MINE_SECTION): each group anyone is in (listed by name), then Experimental when there
 * is anyone in it, then Other (anyone with no group, in the order given) only when there is anyone in it: "Yours" and
 * its "Design new" went with the Character Designer (2026-11-25). An entry with `sortAs` sits where that name would.
 */
export function characterSections<T extends { id?: string; name: string; group: string; sortAs?: string }>(roster: readonly T[]): { id: string; label: string; looks: T[] }[] {
  const byName = (id: string) => withNeighbours(roster.filter((c) => c.group === id).sort((a, b) => (a.sortAs ?? a.name).localeCompare(b.sortAs ?? b.name)));
  const after = (g: string) => CHARACTER_COLLECTIONS.filter((c) => c.after === g).map((c) => ({ id: c.id as string, label: c.label as string, looks: byName(c.id) }));
  const groups = [...CHARACTER_GROUPS.flatMap((g) => [{ id: g.id as string, label: g.label as string, looks: byName(g.id) }, ...after(g.id)]), { id: EXPERIMENTAL_SECTION, label: CHARACTER_TIER_LABELS.experimental, looks: byName(EXPERIMENTAL_SECTION) }].filter((s) => s.looks.length);
  const other = roster.filter((c) => c.group === MINE_SECTION);
  return other.length ? [...groups, { id: MINE_SECTION, label: 'Other', looks: other }] : groups;
}

/**
 * The Character Select section a built-in look sits in: its collection's (CHARACTER_COLLECTIONS, whatever its tier),
 * else Experimental for an experimental one (it leaves its group's section, as an experimental map does), else its group.
 */
export function characterSectionOf(l: Pick<CharacterLook, 'group' | 'collection' | 'tier'>): string | undefined {
  return l.collection ?? (characterTier(l) === 'experimental' ? EXPERIMENTAL_SECTION : l.group);
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

/** Skin tones of the modular presets. */
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
 * retired 14 original modular looks and Ivory Rustwalker, then Engineer and Warden (Linktifa and Sprout stayed until 2026-11-24).
 */
export const RETIRED_LOOKS: Readonly<Record<string, string>> = {
  // Owner, 2026-11-24 ("Let's just retire linktifa and sprout"): both off the roster (files, manifests and portraits kept;
  // the Designer keeps Linktifa's modular body as its base: DESIGNER_BASE_LOOK). A saved pick plays Honest Abe (Legends)
  // and Lancer Mei (Everyday Folk), kept looks of the same group; every older retirement that led to either now leads
  // straight to the kept look, in one step.
  'core.ranger': 'core.abe',
  'core.sprout': 'core.mei',
  // Owner, 2026-11-24: nine more off the roster (files, manifests and portraits kept); a saved pick plays a kept look of
  // the same group. (The Dummy is the trooper NPC skin, off Character Select in PLAYER_NPC_LOOKS; see npc.ts.)
  'core.astroexplorer': 'core.astronaut', // Astronaut Explorer -> Spacewalker
  'core.neonninja': 'core.shadowenforcer', // Neon Shadow Ninja -> Shadow Enforcer
  'core.neonguardian': 'core.starvoyager', // Neon Guardian -> Star Voyager
  'core.hector': 'core.dale', // Bill the Barbarian -> Cal
  'core.brasshare': 'core.biscuit', // Brass Hare -> Biscuit
  'core.bigbab': 'core.gorillag', // Big Bab -> Gorilla G
  'core.tortoise': 'core.coachtortoise', // Shellback -> Coach Hank Shelton
  'core.giggles': 'core.teddy', // Giggles -> Teddy
  // Owner, 2026-11-24: Brutus Hornbeck off the roster too (files kept); a saved pick plays Gorilla G, a kept large Animalia.
  'core.rhinojuggernaut': 'core.gorillag', // Brutus Hornbeck -> Gorilla G
  // The Dummy (the trooper mannequin NPC skin): off Character Select (PLAYER_NPC_LOOKS); a saved pick plays Stealth
  // Operative, a kept Agency soldier. The trooper NPC role (training targets, soldiers) keeps its mannequin.
  'npc:trooper': 'core.stealthop',
  'core.champion': 'core.dale',
  'core.desperado': 'core.dale',
  'core.miller': 'core.mei',
  'core.raider': 'core.abe',
  'core.sprinter': 'core.mei',
  'core.striker': 'core.abe',
  'core.huntress': 'core.abe',
  'core.tracker': 'core.abe',
  'core.bulwark': 'core.grunt68',
  'core.commando': 'core.grunt68',
  'core.operative': 'core.grunt68',
  'core.scout': 'core.mei',
  'core.pathfinder': 'core.mei',
  'core.wayfarer': 'core.mei',
  'core.frost': 'core.mei',
  'core.medic': 'core.mei',
  'core.sentinel': 'core.mei',
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
  'core.otter': 'core.biscuit',
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
  'core.panda': 'core.coachtortoise',
  // Owner, 2026-11-06 (after the intake that gave it the light-blue astronaut): Capt. Nova off the roster (files,
  // manifest and portrait kept); saved choices and bot sets play Spacewalker, the nearest astronaut.
  'core.nova': 'core.astronaut',
  // Owner's Roster Board, 2026-11-14 (flagged Remove): off the roster (files, manifests and portraits kept); saved
  // choices and bot sets play the nearest kept look: Uncle Bao the Old Timer, the Rusty Mech T-TreeFitty (a large robot).
  'core.unclebao': 'core.oldtimer',
  'core.rustymech': 'core.t350',
  // Owner, 2026-11-21 ("remove gas mask engineer character from game"): removed, files and all (its model, first-person
  // arms and portrait); saved choices and bot sets play Grunt '68, a kept Army soldier.
  'core.gasmaskengineer': 'core.grunt68',
  // Owner, 2026-11-22: two of the 2026-11-21/22 intake became the models of characters already on the roster, and their
  // own entries went (models, arms, portraits and manifests): Tinker Goblina's GoblinaRigged model is Goblina's now,
  // the Sunset Gunslinger's model Dusty Ranger's. Saved choices and bot sets play the look that kept the model.
  'core.goblinatinker': 'core.grizzelda',
  'core.sunsetgunslinger': 'core.dustycolt',
  // Owner, 2026-11-22 (the raccoon question): Zero Ringtail's model (the raccoon hacker of that afternoon) is Bandit's now,
  // and its own entry went (manifest and portrait; its built files renamed to Bandit's). Saved choices and bot sets play Bandit.
  'core.raccoonhacker': 'core.bandit',
};

/**
 * Retired looks an NPC role is still drawn as (NPC_ROLE_SPECS `look`): off the roster, and a player's saved choice
 * of one plays its replacement (validLookId), but getLook still gives the look itself so the NPC keeps its model.
 */
/** Linktifa's id: the Designer's base body (retired from play, kept drawable). */
const DESIGNER_BASE_ID = 'core.ranger';
/** The sim's fixed default look: Cal, a kept, pickable look (owner, 2026-11-24: the default is never a retired look). */
const DEFAULT_LOOK_ID = 'core.dale';
export const NPC_KEPT_LOOKS: ReadonlySet<string> = new Set(['core.goblin', 'core.otter', DESIGNER_BASE_ID]);

/** Every preset ever defined, retired ones included (see RETIRED_LOOKS). */
const ALL_LOOKS: readonly CharacterLook[] = [
  { id: 'core.ranger', name: 'Linktifa', body: 'male', head: 'head_male', parts: ranger('m'), hair: ['hair_simpleparted'], colorways: [], skin: null, hairColor: '#8a6a50', gear: ['pack'], group: 'legends', nameTheme: 'knight' },
  { id: 'core.huntress', name: 'Huntress', body: 'female', head: 'head_female', parts: ranger('f'), hair: ['hair_long'], colorways: [], skin: null, hairColor: '#b08850', cloth: '#7a2a2a', trim: '#2a2622', gear: ['bandolier'], group: 'folk' },
  // Two sizes off the standard: Sprout is small and quick, Bulwark big and tough.
  { id: 'core.sprout', name: 'Sprout', body: 'female', head: 'head_female', parts: peasant('f'), hair: ['hair_buns'], colorways: [], skin: SKIN_TONES[1], hairColor: '#c07a40', size: 'small', cloth: '#e0b84a', gear: ['headband'], group: 'folk', nameTheme: 'townsfolk' },
  { id: 'core.bulwark', name: 'Bulwark', body: 'male', head: 'head_male', parts: ranger('m', false, true), hair: ['hair_buzzed', 'hair_beard'], colorways: ['ranger_moss'], skin: SKIN_TONES[3], hairColor: '#2a2422', size: 'large', cloth: '#4a4f58', trim: '#1e2126', gear: ['helmet', 'vest'], group: 'soldiers', branch: 'army' },
  { id: 'core.warden', name: 'Warden', body: 'male', head: 'head_male', parts: ranger('m', false, true), hair: ['hair_buzzed', 'hair_beard'], colorways: ['ranger_moss'], skin: SKIN_TONES[3], hairColor: '#3a3030', cloth: '#2a3a5c', trim: '#3a2a22', gear: ['beret', 'radio'], group: 'soldiers', branch: 'army' },
  { id: 'core.scout', name: 'Scout', body: 'female', head: 'head_female', parts: ranger('f', true, false), hair: ['hair_buns'], colorways: ['ranger_moss'], skin: SKIN_TONES[2], hairColor: '#4a3428', cloth: '#c8b88a', trim: '#6a4a30', gear: ['goggles', 'scarf'], group: 'soldiers', branch: 'army' },
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
  { id: 'core.commando', name: 'Commando', body: 'male', head: 'head_male', parts: ranger('m', false, false), hair: ['hair_buzzed'], colorways: [], skin: SKIN_TONES[4], hairColor: '#1e1a18', cloth: '#262a30', trim: '#1a1c20', gear: ['helmet', 'goggles', 'vest'], group: 'soldiers', branch: 'army' },
  { id: 'core.frost', name: 'Frost', body: 'female', head: 'head_female', parts: ranger('f', false, false), hair: ['hair_long'], colorways: [], skin: SKIN_TONES[1], hairColor: '#f0e0c0', cloth: '#e8e4dc', trim: '#7a8088', gear: ['beanie', 'goggles', 'pack'], group: 'soldiers', branch: 'army' },
  { id: 'core.operative', name: 'Operative', body: 'male', head: 'head_male', parts: ranger('m', false, false), hair: ['hair_simpleparted'], colorways: [], skin: SKIN_TONES[1], hairColor: '#2a2422', cloth: '#1e2126', trim: '#1e2126', gear: ['shades'], group: 'soldiers', branch: 'agency' },
  { id: 'core.medic', name: 'Medic', body: 'female', head: 'head_female', parts: peasant('f'), hair: ['hair_buns'], colorways: [], skin: SKIN_TONES[2], hairColor: '#3a2a22', cloth: '#e8e4dc', trim: '#a83030', gear: ['cap', 'pack'], group: 'soldiers', branch: 'army' },
  { id: 'core.engineer', name: 'Engineer', body: 'male', head: 'head_male', parts: peasant('m'), hair: ['hair_beard'], colorways: [], skin: SKIN_TONES[3], hairColor: '#5a4030', cloth: '#d07a2a', trim: '#3a3a3a', gear: ['mk2_helmet', 'tank'], group: 'folk' },
  // Whole-body characters, one per manifest in content/characters (generated: characters.generated.ts).
  ...WHOLE_BODY_LOOKS,
  { id: 'core.sentinel', name: 'Sentinel', body: 'female', head: 'head_female', parts: ranger('f', false, true), hair: ['hair_buns'], colorways: [], skin: SKIN_TONES[3], hairColor: '#2a2422', size: 'large', cloth: '#9aa0a8', trim: '#3a3f48', gear: ['beret', 'vest'], group: 'soldiers', branch: 'army' },
];

/**
 * The clip set every look on the shared rig moves with unless it names another or opts out (`clips: false`):
 * content/clip-sets/shooter.json (tools/content/character-manifests.mjs keeps the same name). Looks made later
 * and characters rigged later get it without asking.
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

/**
 * The sim's fixed default look (a combatant before it picks, the tests' standard body): Cal, a kept look (Linktifa's
 * body was the default until it retired, 2026-11-24). A new player's first look is random instead
 * (`randomFirstLook`, drawn by the front end); an unknown id still falls back to the roster's first pickable look.
 */
export const DEFAULT_LOOK = DEFAULT_LOOK_ID;

/** A random pickable look for a new player with no saved pick (`roll` in [0, 1): Math.random(), or a fixed value). */
export const randomFirstLook = (roll: number): string => PICKABLE_LOOKS[Math.min(PICKABLE_LOOKS.length - 1, Math.floor(roll * PICKABLE_LOOKS.length))]!.id;

/**
 * The modular base body (Linktifa's parts), once the Character Designer's start (the Designer was removed 2026-11-25):
 * off the roster, kept drawable as the shared rig's baseline for the content tools (hitboxes, grips, sight sheets) and tests.
 */
export const DESIGNER_BASE_LOOK: CharacterLook = ALL_LOOKS.find((l) => l.id === DESIGNER_BASE_ID)!;

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

// ---------------------------------------------------------------- the part catalogue (modular looks)

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
 * Custom looks travel as a short ID. Players no longer make them (the Character Designer went, 2026-11-25; a saved
 * one plays the default: validLookId); the client still builds them for its own uses (an NPC skin's first-person arms):
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
  return lookIn(CORE_LOOKS, id, CORE_LOOKS.find((l) => l.id === DEFAULT_LOOK_ID));
};

/**
 * getLook over a roster. By id a look resolves whatever its tier (a saved choice of an experimental character keeps
 * working, and a bot set's hand pick); only the fallback is a pick: the roster's first core look.
 */
export function lookIn(roster: readonly CharacterLook[], id: string | undefined, fallback?: CharacterLook): CharacterLook {
  const key = (id && RETIRED_LOOKS[id]) || id;
  return roster.find((l) => l.id === key) ?? (key ? decodeLook(key) : null) ?? fallback ?? roster.find((l) => characterTier(l) === 'core')!;
}

/** A stable look for the `index`-th bot, spread across a roster's core tier (never an experimental character). */
export function botLookFrom(roster: readonly Pick<CharacterLook, 'id' | 'tier'>[], index: number): string {
  const pool = pickableLooks(roster);
  return pool[(index + 1) % pool.length]!.id;
}

/** A stable look for a Player Bot, spread across the core roster, in roster order (a match deals its own: botLookOrder). */
export const lookForBot = (index: number): string => botLookFrom(PICKABLE_LOOKS, index);

/**
 * The order a match deals random bots' looks from a pool (owner, 2026-11-16: "make sure they are indeed random and
 * not the first 60+ in the list"): a shuffle seeded by the match seed, so host and dedicated host deal the same cast
 * for the same seed (clients get each look in the roster) and matches differ. Seed 1 (tests and `?test=1`, as bot
 * names) keeps the roster order, rotated by one as botLookFrom.
 */
export function botLookOrder<T extends { id: string }>(pool: readonly T[], seed: number): string[] {
  const ids = pool.map((l) => l.id);
  if (!ids.length) return ids;
  if (seed === 1) return [...ids.slice(1), ids[0]!];
  // mulberry32 (math.ts createRng), salted so the deal is not the match's other rolls.
  let s = (Math.imul(seed | 0, 0x9e3779b1) ^ 0x5bd1e995) >>> 0;
  const rnd = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  }
  return ids;
}

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
