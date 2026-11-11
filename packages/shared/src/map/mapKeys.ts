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
export const MAP_FORMAT_VERSION = 36;

/** `players` is the built-in faction of every player in co-op. */
export const PLAYERS_FACTION = 'players';

/**
 * NPC kinds an encounter can field (NPC_ROLES: the soldiers, then the creatures, in code order) and the creature kinds
 * among them (CREATURE_ROLES: their own bodies and clips, not the soldier rig): content/npcs.json, built by
 * tools/content/npcs.mjs (see sim/npc.ts and sim/creatures.ts). Snapshots send a role's code (its index): never
 * change or reuse one (content/codes.lock.json).
 */
export { CREATURE_ROLES, NPC_ROLES } from '../content/npcRoles.generated.ts';

export const SQUAD_ORDERS = ['hold', 'attack', 'defend', 'patrol', 'follow', 'roam'] as const;
