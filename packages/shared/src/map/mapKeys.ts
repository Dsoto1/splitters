/**
 * The map format's plain constants: its name and version, the players'
 * faction, the NPC roles and squad orders. schema.ts re-exports them; modules
 * the menu runs (sim/npc.ts, sim/creatures.ts, map/identity.ts) import them
 * from here, so the menu's first download doesn't carry the zod schemas
 * (docs/LOADING.md).
 */
export const MAP_FORMAT = 'tiletrigger.map';
/** The format name maps were saved under while the game was called ChronoSplit; they load and are re-saved as MAP_FORMAT. */
export const LEGACY_MAP_FORMAT = 'chronosplit.map';
export const MAP_FORMAT_VERSION = 25;

/** `players` is the built-in faction of every player in co-op. */
export const PLAYERS_FACTION = 'players';

/**
 * NPC kinds an encounter can field: the soldiers, then the creatures (see
 * sim/npc.ts and sim/creatures.ts). Order matters: snapshots send the index.
 */
export const NPC_ROLES = ['trooper', 'gunner', 'heavy', 'sniper', 'imp', 'puglin', 'cyclops', 'oculus', 'scolitex', 'zombie', 'goblin', 'otter', 'boglurker', 'warlord', 'hyena', 'alien', 'pirate', 'titan'] as const;
/** The creature kinds among NPC_ROLES (their own bodies and clips, not the soldier rig). */
export const CREATURE_ROLES = ['imp', 'puglin', 'cyclops', 'oculus', 'scolitex'] as const satisfies readonly (typeof NPC_ROLES)[number][];

export const SQUAD_ORDERS = ['hold', 'attack', 'defend', 'patrol', 'follow', 'roam'] as const;
