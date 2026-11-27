/**
 * Match Setup's map tabs (owner, 2026-11-25, QUEUE "The plan" step 3: "Match Setup by sector, from data"): Story ·
 * Arenas · Arcade · Battlegrounds · Custom. Story is built from the campaign's sectors (campaign/setupRows.ts);
 * Custom is every map (the full list, with its category chips); the three between sort the suite's built-in maps by
 * their own metadata, so a map moves by itself when its modes or its player count change (docs/CAMPAIGN.md,
 * "Match Setup by sector"). No map file names its tab.
 *
 * The rule, in order (every built-in map is under exactly one of the three):
 *   1. Arcade: its first mode (the one it is made for) is a party or arcade mode (ARCADE_MODES).
 *   2. Battlegrounds: it is made for big battles: BATTLEGROUND_PLAYERS or more recommended players, or it plays a
 *      large-battle mode (BATTLEGROUND_MODES).
 *   3. Arenas: everything else (the small and mid-size combat maps).
 * A player's own and the community maps are only under Custom (they are theirs, not the suite's).
 *
 * Plain data, no zod: the menu imports it (docs/LOADING.md).
 */

export const SETUP_KINDS = ['story', 'arenas', 'arcade', 'battlegrounds', 'custom'] as const;
export type SetupKind = (typeof SETUP_KINDS)[number];

export interface SetupKindDef {
  id: SetupKind;
  label: string;
  /** What is there (the tab's tooltip). */
  blurb: string;
}

export const SETUP_KIND_DEFS: readonly SetupKindDef[] = [
  { id: 'story', label: 'Story', blurb: 'The campaign’s sectors, a row each: win a map in Story to host the next.' },
  { id: 'arenas', label: 'Arenas', blurb: 'Small and mid-size combat maps (up to 20 players).' },
  { id: 'arcade', label: 'Arcade', blurb: 'Party and arcade modes: Discs, Forts, Co-op, Zombies, Roulette.' },
  { id: 'battlegrounds', label: 'Battlegrounds', blurb: 'Big battles: 24 players or more, Breakthrough.' },
  { id: 'custom', label: 'Custom', blurb: 'Every map: the whole list, your own and the community’s too.' },
];

/** A map made first for one of these is Arcade. */
export const ARCADE_MODES: readonly string[] = ['core.discs', 'core.forts', 'core.coop', 'core.zombies', 'core.roulette'];
/** A map that plays one of these is a Battleground (unless it is Arcade). */
export const BATTLEGROUND_MODES: readonly string[] = ['core.breakthrough'];
/** A map recommended for this many players or more is a Battleground (unless it is Arcade). */
export const BATTLEGROUND_PLAYERS = 24;

/** What the rule reads: the map's modes (its first is the one it is made for) and its recommended players. */
export interface KindedMap {
  modes: readonly string[];
  maxPlayers: number;
  /** The player's own MapMaker map, or a community map from the server: Custom only. */
  own?: boolean;
  community?: boolean;
}

/** The one tab of Arenas, Arcade and Battlegrounds a built-in map is under (null for own and community maps). */
export function builtInKind(m: KindedMap): 'arenas' | 'arcade' | 'battlegrounds' | null {
  if (m.own || m.community) return null;
  if (m.modes[0] && ARCADE_MODES.includes(m.modes[0])) return 'arcade';
  if (m.maxPlayers >= BATTLEGROUND_PLAYERS || m.modes.some((x) => BATTLEGROUND_MODES.includes(x))) return 'battlegrounds';
  return 'arenas';
}

/** Whether a map card shows under the tab: Custom holds every map; Story's rows come from the campaign instead. */
export function inSetupKind(m: KindedMap, kind: SetupKind): boolean {
  if (kind === 'custom') return true;
  if (kind === 'story') return false;
  return builtInKind(m) === kind;
}

export const isSetupKind = (x: unknown): x is SetupKind => (SETUP_KINDS as readonly unknown[]).includes(x);
