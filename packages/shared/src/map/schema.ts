import { z } from 'zod';
import { EDGE_STYLES } from './catalog.ts';
import { ScenarioLogic } from './logic.ts';

/**
 * ChronoSplit map document, format version 6 (v2 added per-surface tile styles, v3 pickup
 * entities, v4 scenario entities and logic, v5 factions and NPC encounters, v6 per-side
 * wall styles, trim and props).
 *
 * Maps are data, never code. Every placed item carries a stable string ID and
 * references catalog content by content ID. Domains the spec reserves
 * (advancedStructure, terrain, props, factions, objectives, logic, world,
 * legacyMetadata) are not populated in Phase 0; they will be added through
 * migrations as each system lands.
 */
export const MAP_FORMAT = 'chronosplit.map';
export const MAP_FORMAT_VERSION = 6;

/** Stable entity/tile ID. Generated once, never derived from array position. */
export const StableId = z.string().regex(/^[A-Za-z0-9_-]{4,64}$/, 'IDs must be 4-64 chars of [A-Za-z0-9_-]');
/** Catalog content ID such as `core.room`. */
export const ContentId = z.string().regex(/^[a-z0-9_]+(\.[a-z0-9_]+)+$/, 'content IDs look like "pack.name"');

const Vec3Tuple = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);

export const MapMetadata = z.object({
  id: StableId,
  name: z.string().min(1).max(80),
  author: z.string().max(80).default(''),
  description: z.string().max(2000).default(''),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  /** Remix lineage; null for original maps. */
  parentId: StableId.nullable().default(null),
  recommendedPlayers: z
    .object({ min: z.number().int().min(1).max(32), max: z.number().int().min(1).max(32) })
    .default({ min: 2, max: 8 }),
  supportedModes: z.array(ContentId).default(['core.deathmatch']),
});

/** A material from the library plus an optional tint, applied to one surface slot. */
export const SurfaceStyle = z.object({
  material: ContentId,
  tint: z
    .string()
    .regex(/^#[0-9a-f]{6}$/, 'tints are lowercase #rrggbb')
    .nullable()
    .default(null),
});

/** Per-slot overrides of the map theme. Absent slots use the theme default. */
export const TileSurfaces = z.object({
  floor: SurfaceStyle.optional(),
  walls: SurfaceStyle.optional(),
  solids: SurfaceStyle.optional(),
  underside: SurfaceStyle.optional(),
  trim: SurfaceStyle.optional(),
});

/** One side of one tile cell, in the tile's own frame: "dx,dy,dz:N". */
export const EdgeKey = z.string().regex(/^-?\d+,-?\d+,-?\d+:[NESW]$/, 'edge keys look like "0,0,0:N"');

export const Rotation = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

/**
 * A Classic Grid tile placement. Grid X/Y run along world X/Z; Z is the floor
 * level. Rotation is in clockwise quarter turns. This is the compatibility
 * foundation, so it stays deliberately close to a classic MapMaker layout.
 */
export const TilePlacement = z.object({
  id: StableId,
  tile: ContentId,
  x: z.number().int().min(-256).max(256),
  y: z.number().int().min(-256).max(256),
  z: z.number().int().min(-16).max(16),
  rotation: Rotation.default(0),
  surfaces: TileSurfaces.optional(),
  /** Per-side wall choices (window, archway, half wall, no wall…); absent sides are `auto`. */
  edges: z.record(EdgeKey, z.enum(EDGE_STYLES)).optional(),
});

export const ClassicStructure = z.object({
  /** Horizontal size of one grid cell in metres. */
  cellSize: z.number().positive().default(8),
  /** Vertical distance between floor levels in metres. */
  levelHeight: z.number().positive().default(4),
  theme: ContentId.default('core.prototype'),
  tiles: z.array(TilePlacement).max(4096),
});

const EntityBase = z.object({
  id: StableId,
  position: Vec3Tuple,
  /** Creator-given name shown in the logic editor ("Vault door"). */
  name: z.string().max(40).optional(),
});

export const SpawnEntity = EntityBase.extend({
  kind: z.literal('spawn'),
  /** Facing in radians, see viewDirection(). */
  yaw: z.number().finite().default(0),
  /** Team (faction ID) that spawns here in Team Deathmatch; null spawns are shared by everyone. */
  faction: z
    .string()
    .regex(/^[a-z0-9_.]{2,64}$/)
    .nullable()
    .default(null),
});

/** A pickup (health, armor, ammo, weapon, powerup) that respawns after being taken. */
export const PickupEntity = EntityBase.extend({
  kind: z.literal('pickup'),
  item: ContentId,
  /** Overrides the item's default respawn time; null = item default. */
  respawnSeconds: z.number().min(1).max(600).nullable().default(null),
});

/** Facing in radians. Doors snap to quarter turns in the editor. */
const Yaw = z.number().finite().default(0);

/** A sliding double door, sized for a Classic Grid doorway (3 m × 3 m). */
export const DoorEntity = EntityBase.extend({
  kind: z.literal('door'),
  yaw: Yaw,
  startOpen: z.boolean().default(false),
  locked: z.boolean().default(false),
  /** Opens by itself when a player comes close (if unlocked). Otherwise players press E, or logic opens it. */
  auto: z.boolean().default(true),
});

/** A wall button players press with E. Fires the "button pressed" logic event. */
export const ButtonEntity = EntityBase.extend({
  kind: z.literal('button'),
  yaw: Yaw,
  /** Prompt shown to the player, e.g. "Open the gate". */
  label: z.string().max(40).default('Press'),
  once: z.boolean().default(false),
  cooldownSeconds: z.number().min(0.2).max(60).default(1),
  startEnabled: z.boolean().default(true),
});

export const DESTRUCTIBLE_MODELS = ['crate', 'barrel', 'wall'] as const;

/** Something that can be shot or blown apart: a crate, an explosive barrel or a breakable wall panel. */
export const DestructibleEntity = EntityBase.extend({
  kind: z.literal('destructible'),
  model: z.enum(DESTRUCTIBLE_MODELS),
  yaw: Yaw,
  /** Overrides the model's default health; null = default. */
  health: z.number().min(1).max(5000).nullable().default(null),
  /** Only explosions hurt it (a reinforced wall you have to blow open). */
  explosiveOnly: z.boolean().default(false),
});

/** An invisible box that reports players entering and leaving. Position is the centre of its floor. */
export const ZoneEntity = EntityBase.extend({
  kind: z.literal('zone'),
  size: z.tuple([z.number().min(0.5).max(64), z.number().min(0.5).max(32), z.number().min(0.5).max(64)]).default([4, 3, 4]),
  /** any: every player entering; count: once `count` players are inside; all: once every living player is inside. */
  who: z.enum(['any', 'count', 'all']).default('any'),
  count: z.number().int().min(1).max(32).default(1),
  startEnabled: z.boolean().default(true),
});

export const TRAP_KINDS = ['spikes', 'flames', 'crusher', 'mine', 'laser'] as const;
export const TRAP_ACTIVATIONS = ['always', 'cycle', 'proximity', 'logic'] as const;

/**
 * A hazard. always: permanently on. cycle: on for onSeconds, off for offSeconds.
 * proximity: arms when someone steps in, fires after a short warning, then
 * rearms after offSeconds. logic: fires only when a rule tells it to. Mines
 * are always proximity.
 */
export const TrapEntity = EntityBase.extend({
  kind: z.literal('trap'),
  trap: z.enum(TRAP_KINDS),
  yaw: Yaw,
  activation: z.enum(TRAP_ACTIVATIONS).default('cycle'),
  onSeconds: z.number().min(0.2).max(60).default(2),
  offSeconds: z.number().min(0.2).max(600).default(2),
  /** Shifts a cycling trap's timing so a row of traps can ripple. */
  offsetSeconds: z.number().min(0).max(60).default(0),
  startEnabled: z.boolean().default(true),
  /** Overrides the trap's default damage; null = default. */
  damage: z.number().min(1).max(1000).nullable().default(null),
});

/** Faction IDs are short lowercase words; `players` is the built-in faction of every player in co-op. */
export const FactionId = z.string().regex(/^[a-z0-9_]{2,32}$/, 'faction IDs are 2-32 chars of [a-z0-9_]');
export const PLAYERS_FACTION = 'players';

export const NPC_ROLES = ['trooper', 'gunner', 'heavy'] as const;
export const SQUAD_ORDERS = ['hold', 'attack', 'defend', 'patrol', 'follow'] as const;

/**
 * An NPC encounter: a squad of a faction's soldiers that spawns around this
 * point. `roster` is the first wave; `reinforcements` more spawn one by one as
 * members die, never more than `activeCap` alive at once.
 */
export const EncounterEntity = EntityBase.extend({
  kind: z.literal('encounter'),
  yaw: Yaw,
  faction: FactionId.default('syndicate'),
  roster: z
    .object({ trooper: z.number().int().min(0).max(16), gunner: z.number().int().min(0).max(16), heavy: z.number().int().min(0).max(16) })
    .default({ trooper: 2, gunner: 1, heavy: 0 }),
  activeCap: z.number().int().min(1).max(32).default(4),
  reinforcements: z.number().int().min(0).max(500).default(0),
  /** Extra reinforcements for each player beyond the first (co-op scaling). */
  perPlayer: z.number().int().min(0).max(16).default(1),
  respawnSeconds: z.number().min(0.5).max(120).default(4),
  /** Spawn area radius around the position. */
  radius: z.number().min(1).max(16).default(3),
  order: z.enum(SQUAD_ORDERS).default('hold'),
  /** Point of interest for defend/patrol orders (any entity). */
  orderTarget: StableId.nullable().default(null),
  startActive: z.boolean().default(true),
  difficulty: z.enum(['easy', 'normal', 'hard']).default('normal'),
});

/** A placed prop (furniture, crates, trees, machines…) from the prop catalog. Position is the centre of its footprint on the floor. */
export const PropEntity = EntityBase.extend({
  kind: z.literal('prop'),
  model: ContentId,
  /** Free rotation in radians (MapMaker snaps to 15°). */
  yaw: Yaw,
  scale: z.number().min(0.25).max(4).default(1),
  /** Collides with players, shots and bots (if the prop has a collision box at all). */
  solid: z.boolean().default(true),
  tint: z
    .string()
    .regex(/^#[0-9a-f]{6}$/)
    .nullable()
    .default(null),
});

export const MapEntity = z.discriminatedUnion('kind', [SpawnEntity, PickupEntity, DoorEntity, ButtonEntity, DestructibleEntity, ZoneEntity, TrapEntity, EncounterEntity, PropEntity]);

export const RELATIONS = ['ally', 'neutral', 'enemy'] as const;

/** A creator-defined side. Relations default to "ally" with itself and "enemy" with everyone else. */
export const Faction = z.object({
  id: FactionId,
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-f]{6}$/).default('#d04a3a'),
  relations: z.record(FactionId, z.enum(RELATIONS)).default({}),
});

export const MapDocument = z.object({
  format: z.literal(MAP_FORMAT),
  formatVersion: z.literal(MAP_FORMAT_VERSION),
  metadata: MapMetadata,
  classicStructure: ClassicStructure,
  entities: z.array(MapEntity).max(4096),
  /** NPC factions. Empty means the default enemy faction ("Syndicate"). */
  factions: z.array(Faction).max(16).default([]),
  /** Scenario logic: variables, timers, objectives and WHEN -> IF -> DO rules. */
  logic: ScenarioLogic.default({ variables: [], timers: [], objectives: [], rules: [] }),
  /** Content packs this map needs, beyond the always-present core pack. */
  dependencies: z.array(z.object({ pack: ContentId, version: z.string() })).default([]),
});

export type MapDocument = z.infer<typeof MapDocument>;
export type MapEntity = z.infer<typeof MapEntity>;
export type SpawnEntity = z.infer<typeof SpawnEntity>;
export type PickupEntity = z.infer<typeof PickupEntity>;
export type DoorEntity = z.infer<typeof DoorEntity>;
export type ButtonEntity = z.infer<typeof ButtonEntity>;
export type DestructibleEntity = z.infer<typeof DestructibleEntity>;
export type ZoneEntity = z.infer<typeof ZoneEntity>;
export type TrapEntity = z.infer<typeof TrapEntity>;
export type TrapKind = (typeof TRAP_KINDS)[number];
export type TrapActivation = (typeof TRAP_ACTIVATIONS)[number];
export type DestructibleModel = (typeof DESTRUCTIBLE_MODELS)[number];
export type EntityKind = MapEntity['kind'];
export type EncounterEntity = z.infer<typeof EncounterEntity>;
export type PropEntity = z.infer<typeof PropEntity>;
export type Faction = z.infer<typeof Faction>;
export type NpcRole = (typeof NPC_ROLES)[number];
export type SquadOrder = (typeof SQUAD_ORDERS)[number];
export type Relation = (typeof RELATIONS)[number];
export type TilePlacement = z.infer<typeof TilePlacement>;
export type Rotation = z.infer<typeof Rotation>;
export type SurfaceStyle = z.infer<typeof SurfaceStyle>;
export type TileSurfaces = z.infer<typeof TileSurfaces>;
