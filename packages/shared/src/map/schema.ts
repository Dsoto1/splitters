import { z } from 'zod';
import { MAP_FORMAT, MAP_FORMAT_VERSION, NPC_ROLES, SQUAD_ORDERS } from './mapKeys.ts';
import { CEILINGS, CORNERS, EDGE_STYLES, FACADES, FLOOR_INSERTS, ROOM_LAYOUTS } from './tileOptions.ts';
import { MAX_TERRAIN_VERTS, TERRAIN_MATERIALS } from './terrain.ts';
import { BACKDROP_GROUNDS, SCENERY_IDS, SKY_IDS } from './backdrop.ts';
import { BORDER_STYLES } from './border.ts';
import { ScenarioLogic } from './logic.ts';

// The plain constants (format, factions, NPC roles, squad orders): mapKeys.ts, which the menu reads without the schemas.
export * from './mapKeys.ts';
import { MOUNT_MODELS, MOUNT_SKINS } from '../sim/mounts.ts';
import { WEAPON_CATEGORIES } from '../sim/weapons.ts';

/**
 * Tile Trigger map document, format version 6 (v2 added per-surface tile styles, v3 pickup
 * entities, v4 scenario entities and logic, v5 factions and NPC encounters, v6 per-side
 * wall styles, trim and props, v7 terrain, v8 map boundary and team setup, v11 flag bases
 * and hills for Capture the Flag and King of the Hill, v18 the race `track`, v19 the transport plane and mount skins, v20 movers, logic-driven
 * lights and blocks, pitched blocks, team-only buttons/doors/zones and tinted liquids, v21 vehicles that ride on water, v22 the map's picture: `metadata.thumbnail`
 * and the camera it was taken from, `metadata.thumbnailCamera`, v23 one path primitive, v24 random weapon pickups:
 * a pickup's `random` category and `keepFixed`, v25 the `zipline` entity, v27 set pieces, v28 the weapon set, v29 Breakthrough's
 * `sector` and `objective` entities and spawn groups: a spawn's `sector` and `side`, v30 the menu card shot's camera,
 * `metadata.cardCamera`, v31 MapMaker's groups and note pins, `groups` and `editorNotes`).
 *
 * Maps are data, never code. Every placed item carries a stable string ID and
 * references catalog content by content ID. Domains the spec reserves
 * (advancedStructure, terrain, props, factions, objectives, logic, world,
 * legacyMetadata) are not populated in Phase 0; they will be added through
 * migrations as each system lands.
 */
/** Content packs a map may name in `dependencies`. */
export const MAX_MAP_DEPENDENCIES = 16;

/** Stable entity/tile ID. Generated once, never derived from array position. */
export const StableId = z.string().regex(/^[A-Za-z0-9_-]{4,64}$/, 'IDs must be 4-64 chars of [A-Za-z0-9_-]');
/** Catalog content ID such as `core.room`. */
export const ContentId = z.string().regex(/^[a-z0-9_]+(\.[a-z0-9_]+)+$/, 'content IDs look like "pack.name"');

const Vec3Tuple = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);

/** Map picture size cap (data URL characters, about 36 KB of image): small enough to ride along in every map transfer. */
export const MAX_THUMBNAIL_CHARS = 48_000;
/** Map pictures set in MapMaker are 16:9 images this size (MapMaker → Set thumbnail). */
export const THUMBNAIL_SIZE = { width: 384, height: 216 } as const;
/** A map picture: a JPEG or WebP data URL captured in-engine, nothing else (no links to outside images). */
export const MapThumbnail = z
  .string()
  .max(MAX_THUMBNAIL_CHARS, 'the map picture is too large')
  .regex(/^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/, 'the map picture must be an image captured in MapMaker');
/** Where a map's picture is taken from: the camera position and the point it looks at (world metres). */
export const ThumbnailCamera = z.object({ position: Vec3Tuple, target: Vec3Tuple });
/**
 * The menu card shot's camera (v30; MapMaker → Map properties → Card shot, editor/cardShot.ts): where the camera
 * stands (world metres) and where it looks: yaw (radians, 0 along +Z, as everywhere) and pitch (radians, up
 * positive). The card picture (maps/shots/<id>.jpg) is rendered from it by tools/content/capture-map-shots.mjs.
 */
export const CardCamera = z.object({ position: Vec3Tuple, yaw: z.number().finite(), pitch: z.number().min(-1.55).max(1.55) });
export type CardCamera = z.infer<typeof CardCamera>;

/**
 * A map's published identity (map/identity.ts): stamped on export (later on
 * publish), never edited by hand. Optional: maps made before it load as they
 * were, and get one the first time they are exported.
 */
export const MapRelease = z.object({
  mapId: z.string().regex(/^m_[a-z2-7]{16}$/),
  versionId: z.string().regex(/^v_[a-z2-7]{16}$/),
  revision: z.number().int().min(1).max(1_000_000),
  contentHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  /** MAP_FORMAT_VERSION when it was stamped. */
  schemaVersion: z.number().int().min(1).max(10_000),
  releasedAt: z.iso.datetime(),
});
export type MapRelease = z.infer<typeof MapRelease>;

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
    // Up to 96 (v29; 32 before): the most a match holds (48 v 48).
    .object({ min: z.number().int().min(1).max(96), max: z.number().int().min(1).max(96) })
    .default({ min: 2, max: 8 }),
  supportedModes: z.array(ContentId).default(['core.deathmatch']),
  /**
   * Player caps by mode (MapMaker's Map properties, "Players by mode"): the recommended and the most players for a
   * mode on this map. A mode not listed takes the automatic caps worked out from the map's size and spawn points
   * (sim/matchSetup.ts autoPlayerCaps; docs/GAME_MODES.md, "Player caps"). The setup screen shows them, and the map
   * rotation and map changes keep a match within the most.
   */
  playerCaps: z.record(ContentId, z.object({ recommended: z.number().int().min(1).max(128), max: z.number().int().min(1).max(128) })).optional(),
  /**
   * The map's own picture (v22), captured in MapMaker from the editor camera
   * (never uploaded): a small JPEG/WebP data URL. Map cards show it instead of
   * the automatic picture. Absent = the automatic one (built-in maps) or none.
   */
  thumbnail: MapThumbnail.optional(),
  /**
   * The camera the picture is taken from (v22): Set thumbnail records it, and
   * for built-in maps it overrides the automatic camera choice
   * (tools/content/capture-map-shots.mjs; map scripts: `m.thumbnailCamera()`).
   */
  thumbnailCamera: ThumbnailCamera.optional(),
  /**
   * The menu card shot's camera (v30), set in MapMaker from the view (eye level by default). No picture is stored:
   * the capture tooling renders the card picture from it (built-in maps). Absent: the automatic camera choice.
   */
  cardCamera: CardCamera.optional(),
  /** Map ID, version ID and content hash, stamped when the map is exported (map/identity.ts). */
  release: MapRelease.optional(),
  /**
   * A map for the tests (maps/test_coverage.json: one of everything), set in MapMaker's Map properties: no map list,
   * template list, rotation or host picker offers it; `?offline=<id>` and MapMaker's Import still open it.
   */
  testOnly: z.boolean().optional(),
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
  /** The top of a room's roof (absent: as the floor). */
  roof: SurfaceStyle.optional(),
});

/** One side of one tile cell, in the tile's own frame: "dx,dy,dz:N". */
export const EdgeKey = z.string().regex(/^-?\d+,-?\d+,-?\d+:[NESW]$/, 'edge keys look like "0,0,0:N"');

/** One cell of a tile, in the tile's own frame: "dx,dy,dz". */
export const LocalCellKey = z.string().regex(/^-?\d+,-?\d+,-?\d+$/, 'cell keys look like "0,0,1"');

/**
 * Real glass in a window (glass panes): `breakable` panes shatter at the
 * first shot or blast (they come back next round, or after the map's glass
 * respawn time); `reinforced` (bulletproof) panes stop shots and only crack.
 * Either kind stops players and lets sight through.
 */
export const GLASS_KINDS = ['breakable', 'reinforced'] as const;
export type GlassKind = (typeof GLASS_KINDS)[number];
export const GLASS_KIND_LABELS: Record<GlassKind, string> = { breakable: 'Breakable', reinforced: 'Reinforced (bulletproof)' };

export const Rotation = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

/** The build limit (MapMaker draws it): tiles stand within this many cells of the centre, across and along. */
export const MAX_TILE_CELL = 256;
/** ...and this many levels up or down. */
export const MAX_TILE_LEVEL = 16;

/**
 * A Classic Grid tile placement. Grid X/Y run along world X/Z; Z is the floor
 * level. Rotation is in clockwise quarter turns. This is the compatibility
 * foundation, so it stays deliberately close to a classic MapMaker layout.
 */
export const TilePlacement = z.object({
  id: StableId,
  tile: ContentId,
  x: z.number().int().min(-MAX_TILE_CELL).max(MAX_TILE_CELL),
  y: z.number().int().min(-MAX_TILE_CELL).max(MAX_TILE_CELL),
  z: z.number().int().min(-MAX_TILE_LEVEL).max(MAX_TILE_LEVEL),
  rotation: Rotation.default(0),
  surfaces: TileSurfaces.optional(),
  /** Per-side wall choices (window, archway, half wall, no wall…); absent sides are `auto`. */
  edges: z.record(EdgeKey, z.enum(EDGE_STYLES)).optional(),
  /** Glass in window edges (window, twin windows, firing slit), per side; absent sides have none. */
  glass: z.record(EdgeKey, z.enum(GLASS_KINDS)).optional(),
  /**
   * Floors added in the piece's own upper storeys (format v26), per tile cell ("dx,dy,dz", its own frame): a full
   * slab at that storey's floor level, like a floor the piece came with. Only storeys a piece leaves without a floor
   * take one (geometry.ts `canAddFloor`); others are ignored.
   */
  upperFloors: z.array(LocalCellKey).max(256).optional(),
  /** Room options on rooms that take them (catalog `configurable`); absent fields leave the tile as designed. */
  options: z
    .object({
      layout: z.enum(ROOM_LAYOUTS).optional(),
      floor: z.enum(FLOOR_INSERTS).optional(),
      ceiling: z.enum(CEILINGS).optional(),
      corners: z.enum(CORNERS).optional(),
      facade: z.enum(FACADES).optional(),
    })
    .optional(),
});

export const ClassicStructure = z.object({
  /** Horizontal size of one grid cell in metres. */
  cellSize: z.number().positive().default(8),
  /** Vertical distance between floor levels in metres. */
  levelHeight: z.number().positive().default(4),
  theme: ContentId.default('core.prototype'),
  tiles: z.array(TilePlacement).max(4096),
});

/** Breakthrough: the most sectors a map can have. */
export const BREAKTHROUGH_MAX_SECTORS = 16;

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
  /**
   * Breakthrough (v29): this spawn point is in the spawn group of sector `sector` (its order, 1-based) for `side`
   * (the attackers or the defenders, whichever team that is in a round). Breakthrough spawns each side at its group
   * for the sector in play; other modes use it like any other spawn point. Absent: in no group.
   */
  sector: z.number().int().min(1).max(BREAKTHROUGH_MAX_SECTORS).optional(),
  side: z.enum(['attack', 'defend']).optional(),
});

/** A pickup (health, armor, ammo, weapon, powerup) that respawns after being taken. */
export const PickupEntity = EntityBase.extend({
  kind: z.literal('pickup'),
  /** The item. A random pickup shows this one in MapMaker; in play it rolls a weapon of its category instead. */
  item: ContentId,
  /** Overrides the item's default respawn time; null = item default. */
  respawnSeconds: z.number().min(1).max(600).nullable().default(null),
  /**
   * Random from category (v24): a weapon pickup that rolls a weapon of this category (sim/weapons.ts
   * WEAPON_CATEGORIES) each time it comes back, the same roll for host and clients (sim/pickupRoll.ts).
   * Absent: the item as placed.
   */
  random: z.enum(WEAPON_CATEGORIES).optional(),
  /** Keep fixed (v24): the host's "Mix up weapon pickups" leaves this pickup as placed. */
  keepFixed: z.boolean().optional(),
});

/** Facing in radians. Doors snap to quarter turns in the editor. */
const Yaw = z.number().finite().default(0);

/**
 * Team filter (v20) on buttons, doors and zones: only this team (a team or
 * faction ID, as for spawns) can press it, open it or count in it. Absent:
 * everyone.
 */
const TeamFilter = z
  .string()
  .regex(/^[a-z0-9_.]{2,64}$/)
  .optional();

/**
 * How a door looks (Style Packs): `sliding` steel leaves (the default),
 * `blast` a heavy hazard-striped blast door, `saloon` swinging louvred
 * half-doors, `vault` a round bank-vault door that swings open. Looks only:
 * every style opens, locks and blocks the same way.
 */
export const DOOR_STYLES = ['sliding', 'blast', 'saloon', 'vault', 'portcullis', 'oak'] as const;
export type DoorStyle = (typeof DOOR_STYLES)[number];
export const DOOR_STYLE_LABELS: Record<DoorStyle, string> = { sliding: 'Sliding steel', blast: 'Blast door', saloon: 'Saloon doors', vault: 'Vault door', portcullis: 'Portcullis', oak: 'Oak door (iron-bound)' };

/** A sliding double door, sized for a Classic Grid doorway (3 m × 3 m). */
export const DoorEntity = EntityBase.extend({
  kind: z.literal('door'),
  yaw: Yaw,
  /** Look (absent: sliding). */
  style: z.enum(DOOR_STYLES).optional(),
  startOpen: z.boolean().default(false),
  locked: z.boolean().default(false),
  /** Opens by itself when a player comes close (if unlocked). Otherwise players press E, or logic opens it. */
  auto: z.boolean().default(true),
  /** Only this team opens it (by walking up or pressing E); logic still opens it for everyone. */
  team: TeamFilter,
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
  /** Only this team can press it. */
  team: TeamFilter,
});

export const DESTRUCTIBLE_MODELS = ['crate', 'barrel', 'wall', 'glass', 'boards', 'gas', 'generator'] as const;

/** Something that can be shot or blown apart: a crate, an explosive barrel, a breakable wall, a window pane, a board barricade, a gas cylinder or a generator. */
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
  /** Only this team's players count (enter, leave, "all" means all of that team). */
  team: TeamFilter,
  /**
   * Low-gravity zone (Style Packs): gravity inside is this multiple of the
   * map's (0.35 = drifting reactor core, 2 = crushing). Applies to movement
   * on the server and in prediction alike, whatever the zone's logic state.
   * Absent: no change.
   */
  gravity: z.number().min(0.1).max(3).optional(),
});

export const TRAP_KINDS = ['spikes', 'flames', 'crusher', 'mine', 'laser', 'shock'] as const;
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
  /** Electric fence (`shock`): length of the run in metres along its local X, posts every 4 m (absent: 12). */
  length: z.number().min(2).max(96).optional(),
  /**
   * Look (Style Packs): a crusher drawn as `rockfall` is a clump of boulders
   * hanging over the spot (no frame) that drops when it fires: falling rocks
   * (06 Jungle Ruins). Looks only: it hurts and times like any crusher.
   */
  style: z.enum(['rockfall']).optional(),
});

/** Faction IDs are short lowercase words (PLAYERS_FACTION, in mapKeys.ts, is every player's in co-op). */
export const FactionId = z.string().regex(/^[a-z0-9_]{2,32}$/, 'faction IDs are 2-32 chars of [a-z0-9_]');

const squadCount = z.number().int().min(0).max(16);
/**
 * How a squad arrives: spread round the point (none), or one by one out of a
 * fixture drawn there: dropping from a ceiling vent, climbing out of a floor
 * hatch, digging out of a burrow, or stepping through a breach in the wall
 * behind the point.
 */
export const ENCOUNTER_ENTRANCES = ['none', 'vent', 'hatch', 'burrow', 'breach'] as const;
export type EncounterEntrance = (typeof ENCOUNTER_ENTRANCES)[number];

/**
 * An NPC encounter: a squad of a faction's soldiers that spawns around this
 * point. `roster` is the first wave; `reinforcements` more spawn one by one as
 * members die, never more than `activeCap` alive at once.
 */
export const EncounterEntity = EntityBase.extend({
  kind: z.literal('encounter'),
  yaw: Yaw,
  faction: FactionId.default('syndicate'),
  // Snipers and creatures are optional (missing = none), so older maps load unchanged.
  roster: z
    .object({
      trooper: squadCount,
      gunner: squadCount,
      heavy: squadCount,
      sniper: squadCount.optional(),
      imp: squadCount.optional(),
      puglin: squadCount.optional(),
      cyclops: squadCount.optional(),
      oculus: squadCount.optional(),
      scolitex: squadCount.optional(),
      zombie: squadCount.optional(),
      goblin: squadCount.optional(),
      otter: squadCount.optional(),
      boglurker: squadCount.optional(),
      warlord: squadCount.optional(),
      hyena: squadCount.optional(),
      alien: squadCount.optional(),
      pirate: squadCount.optional(),
      titan: squadCount.optional(),
    })
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
  /** Patrol order (v23): walk this path (a `route` or `road` path's id) instead of to the target and back. Absent: none. */
  route: z.string().min(1).max(64).optional(),
  startActive: z.boolean().default(true),
  difficulty: z.enum(['easy', 'normal', 'hard']).default('normal'),
  /** Multipliers on the roles' own health and damage, and their body size (hitbox too); absent = 1. */
  health: z.number().min(0.25).max(10).optional(),
  damage: z.number().min(0).max(5).optional(),
  size: z.number().min(0.5).max(2.5).optional(),
  /** Missing = none. */
  entrance: z.enum(ENCOUNTER_ENTRANCES).optional(),
  /** A vent's height above the point (missing = 3.5 m, just under a standard ceiling). */
  ventHeight: z.number().min(2).max(12).optional(),
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
  /**
   * An environment species' variant (`model: 'env.…'`, content/environment.ts): its index (material variants
   * such as summer, autumn, snow share the species' shapes). Absent: the species' first. Other props ignore it.
   */
  variant: z.number().int().min(0).max(255).optional(),
  tint: z
    .string()
    .regex(/^#[0-9a-f]{6}$/)
    .nullable()
    .default(null),
});

/** A turret, sentry gun or vehicle (see sim/mounts.ts). Position is the centre of its footprint on the ground. */
export const MountEntity = EntityBase.extend({
  kind: z.literal('mount'),
  model: z.enum(MOUNT_MODELS),
  yaw: Yaw,
  /** Sentries shoot this team's enemies (null: everyone); vehicles and turrets given a team wear its colour (skin `auto`). */
  faction: FactionId.nullable().default(null),
  /** Override the respawn delay after it is destroyed (null: the mount's own). */
  respawnSeconds: z.number().min(5).max(600).nullable().default(null),
  /** Paint (see MOUNT_SKINS): automatic, factory, desert, forest, snow, urban or team colour. */
  skin: z.enum(MOUNT_SKINS).optional(),
  /**
   * Vehicles (v21): rides on water. Over water or swamp it floats at the surface, sitting its
   * `draft` in it (see MountDef.vehicle.draft), drives a little slower and slides more, and runs up
   * the shore onto land; without it a vehicle sinks to the bed. Lava and acid still take it.
   */
  onWater: z.boolean().optional(),
});

/**
 * Air drop: how players start on a map with a transport plane. `off`: the
 * plane only flies over (jump in from a high place, or ride it from an air
 * drop on another plane); `start`: everyone's first spawn of a round is in
 * the plane (battle-royale start); `always`: every spawn is.
 */
export const AIRDROP_MODES = ['off', 'start', 'always'] as const;
export type AirdropMode = (typeof AIRDROP_MODES)[number];

/**
 * What flies a drop route: the transport `plane` (24 benches) or a
 * `dropship` (12 on its deck). Looks and seats only: both fly the route the
 * same way and have the same drop rules.
 */
export const AIR_CRAFTS = ['plane', 'dropship'] as const;
export type AirCraft = (typeof AIR_CRAFTS)[number];
export const AIR_CRAFT_LABELS: Record<AirCraft, string> = { plane: 'Transport Plane', dropship: 'Dropship' };

/**
 * A transport plane (or dropship, `craft`) flying a fixed route over the
 * map. Position is the route's anchor on the ground (MapMaker moves the
 * whole route with it); `route` points are [x, z] offsets from it, flown at
 * `altitude` metres above it, once round every `loopSeconds`. The route may
 * run outside the map's boundary (a run-in from off the map): riders can
 * jump out only over ground they can land on (sim/airplane.ts, dropPlan),
 * and anyone still aboard when the craft leaves that stretch is dropped at
 * its last good point. A closed route loops; an open one flies first to
 * last, then starts over. Riders jump out with E or jump and parachute down.
 */
export const AirplaneEntity = EntityBase.extend({
  kind: z.literal('airplane'),
  route: z.array(z.tuple([z.number().min(-2000).max(2000), z.number().min(-2000).max(2000)])).min(2).max(32),
  altitude: z.number().min(15).max(400).default(70),
  loopSeconds: z.number().min(10).max(600).default(60),
  closed: z.boolean().default(true),
  airdrop: z.enum(AIRDROP_MODES).default('off'),
  /** What flies it (absent: the transport plane). Additive: older maps are valid as they are. */
  craft: z.enum(AIR_CRAFTS).optional(),
});

/** A jump pad: stepping on it throws you up (`power` m/s) and along its facing (`push` m/s). */
export const PadEntity = EntityBase.extend({
  kind: z.literal('pad'),
  yaw: Yaw,
  power: z.number().min(2).max(40).default(14),
  push: z.number().min(0).max(40).default(6),
});

/**
 * A ladder up a wall. Position is the foot of the ladder against the wall; it
 * faces `yaw` (away from the wall, the way you face when you step off it) and
 * climbs `height` metres. Walk into it to climb, back off or look down to go
 * down, jump to let go.
 */
/** How a ladder looks (Style Packs): wooden `rungs` (the default) or climbing `vines` (06 Jungle Ruins). Looks only: both climb the same. */
export const LADDER_STYLES = ['rungs', 'vines'] as const;
export type LadderStyle = (typeof LADDER_STYLES)[number];
export const LADDER_STYLE_LABELS: Record<LadderStyle, string> = { rungs: 'Wooden ladder', vines: 'Climbing vines' };

export const LadderEntity = EntityBase.extend({
  kind: z.literal('ladder'),
  yaw: Yaw,
  height: z.number().min(1).max(24).default(4),
  width: z.number().min(0.5).max(3).default(0.9),
  /** Look (absent: rungs). */
  style: z.enum(LADDER_STYLES).optional(),
});

/**
 * A free block: a box of any size, at any height (sky platforms, stepping
 * stones, ledges), in any material. Position is the centre of its base.
 * solid: plain level geometry. breakable: shoot or blow it apart.
 * crumble: gives way `delaySeconds` after someone stands on it.
 * trapdoor: drops away at once when stood on (or only when logic says, with
 * trigger "logic"). Broken, crumbled and dropped blocks come back after
 * `respawnSeconds` (null: never).
 */
export const BLOCK_BEHAVIOURS = ['solid', 'breakable', 'crumble', 'trapdoor'] as const;
export const BlockEntity = EntityBase.extend({
  kind: z.literal('block'),
  /** Width and depth down to 5 cm (glass panes); sheets that thin collide like any block. */
  size: z.tuple([z.number().min(0.05).max(64), z.number().min(0.1).max(32), z.number().min(0.05).max(64)]).default([4, 0.5, 4]),
  yaw: Yaw,
  /** A material from the library (null: the theme's solid material). */
  material: ContentId.nullable().default(null),
  tint: z
    .string()
    .regex(/^#[0-9a-f]{6}$/)
    .nullable()
    .default(null),
  behaviour: z.enum(BLOCK_BEHAVIOURS).default('solid'),
  /** step: stepping on it sets off a crumble or trapdoor; logic: only a rule's "destroy" does. */
  trigger: z.enum(['step', 'logic']).default('step'),
  delaySeconds: z.number().min(0).max(10).default(0.8),
  respawnSeconds: z.number().min(1).max(600).nullable().default(8),
  /** Breakable blocks: hit points. */
  health: z.number().min(1).max(5000).default(120),
  /**
   * Tilt (v20): pitch turns the block about its own X axis (its +Z end rises
   * for positive values), roll about its own Z axis (+X end rises). Radians,
   * at most 45° each; ramps, roofs, toppled wrecks. Absent = level.
   */
  pitch: z.number().min(-Math.PI / 4).max(Math.PI / 4).optional(),
  roll: z.number().min(-Math.PI / 4).max(Math.PI / 4).optional(),
  /** Starts gone (v20): logic "Rebuild block" or "Enable" makes it appear (a bridge that extends). */
  startHidden: z.boolean().optional(),
  /**
   * Force field (Style Packs): a glowing, humming barrier that stops players
   * and vehicles but lets shots, grenades and sight through. Logic switches it
   * like any block ("Drop / crumble block" or Disable switches it off,
   * "Rebuild block" or Enable on). Solid behaviour only.
   */
  field: z.boolean().optional(),
  /**
   * Glass (glass panes): a see-through panel that stops players but lets
   * sight through. Breakable glass shatters when shot; reinforced glass stops
   * shots and cracks. Solid behaviour only.
   */
  glass: z.enum(GLASS_KINDS).optional(),
});

/** A body of liquid (position: centre of its floor). Water is swum in; lava and acid hurt; swamp slows you down. */
export const LIQUIDS = ['water', 'lava', 'acid', 'swamp'] as const;
export const WaterEntity = EntityBase.extend({
  kind: z.literal('water'),
  size: z.tuple([z.number().min(0.5).max(512), z.number().min(0.2).max(64), z.number().min(0.5).max(512)]).default([8, 2, 8]),
  liquid: z.enum(LIQUIDS).default('water'),
  /** Colour override (v20): green acid, murky sewer water. Absent = the liquid's own colour. */
  tint: z
    .string()
    .regex(/^#[0-9a-f]{6}$/)
    .optional(),
});

/** Capture the Flag: a team's flag base (position: the floor under the flag). */
export const FlagEntity = EntityBase.extend({
  kind: z.literal('flag'),
  yaw: Yaw,
  /** Team (faction ID, as for spawns) whose flag stands here. */
  team: z.string().regex(/^[a-z0-9_.]{2,64}$/),
});

/**
 * Breakthrough (v29): a sector of the attackers' push (sim/modes/breakthrough.ts). The attackers take the sectors in
 * `order` (1, 2, 3…). Its line runs through `position`, square to `yaw` (the way the attackers push): where the
 * sector's ground starts. Once the sector before it falls, defenders still on the attackers' side of the line have
 * 10 s to fall back over it. Its objectives and spawn groups name its order; `name` is shown on the sector strip.
 */
export const SectorEntity = EntityBase.extend({
  kind: z.literal('sector'),
  yaw: z.number().finite().default(0),
  order: z.number().int().min(1).max(BREAKTHROUGH_MAX_SECTORS).default(1),
  /** How many of its targets must be destroyed for it to fall ("2 of 4"); absent: all of them. */
  need: z.number().int().min(1).max(32).optional(),
  /** Seconds it puts on the clock (the first sector's to start with, each next one's when the one before falls); absent: the match's sector time. */
  seconds: z.number().int().min(30).max(1800).optional(),
});

/** Breakthrough objective kinds: a capture zone, a target to destroy (plant a charge; defenders defuse it), and the capture zone that ends the round. */
export const BREAKTHROUGH_OBJECTIVES = ['zone', 'target', 'final'] as const;
export type BreakthroughObjective = (typeof BREAKTHROUGH_OBJECTIVES)[number];

/**
 * Breakthrough (v29): one of a sector's objectives. `zone`: stand in it to capture it (as a King of the Hill zone,
 * contested while a defender stands in it); `target`: plant a charge at it (Use, then hold still), which the
 * defenders can defuse, as in Bomb; `final`: a capture zone that ends the round. Position: the floor at its centre.
 */
export const ObjectiveEntity = EntityBase.extend({
  kind: z.literal('objective'),
  objective: z.enum(BREAKTHROUGH_OBJECTIVES).default('zone'),
  yaw: z.number().finite().default(0),
  /** The sector it belongs to (that sector's order). */
  sector: z.number().int().min(1).max(BREAKTHROUGH_MAX_SECTORS).default(1),
  /** Its short name on the HUD and the map ("A1", "B3", "C"). */
  label: z.string().min(1).max(3).default('A'),
  /** Zones: the zone's radius; targets: how close you must stand to plant or defuse (m). */
  radius: z.number().min(1).max(20).default(5),
  /** Zones: seconds one attacker alone takes to capture it (more are quicker); absent: 20, a final hold 40. */
  seconds: z.number().int().min(5).max(300).optional(),
});

/** King of the Hill: one of the places the hill moves between (in map order). Position: the floor at its centre. */
export const HillEntity = EntityBase.extend({
  kind: z.literal('hill'),
  radius: z.number().min(2).max(20).default(5),
});

/** Bomb mode: a site the attackers plant the bomb at (labelled A, B, …). */
export const BombsiteEntity = EntityBase.extend({
  kind: z.literal('bombsite'),
  label: z.string().min(1).max(2).default('A'),
  radius: z.number().min(2).max(12).default(4),
});

/** Hostage mode: where a hostage waits at the start of each round. */
export const HostageEntity = EntityBase.extend({
  kind: z.literal('hostage'),
  yaw: Yaw,
});

/** Hostage mode: where rescuers bring hostages out. */
export const RescueEntity = EntityBase.extend({
  kind: z.literal('rescue'),
  radius: z.number().min(2).max(12).default(4),
});

/**
 * What a light looks like where it hangs: nothing, a ceiling panel, a wall
 * lamp, a bare bulb, a long strip, a neon sign, a holographic billboard, or
 * (05 Gothic Estate) a candelabra or a candle chandelier. Candle fixtures
 * flicker gently; set blinking (or logic "Blink light"), they gutter and
 * flare instead of flashing on and off.
 */
export const LIGHT_FIXTURES = ['none', 'ceiling', 'wall', 'bulb', 'strip', 'sign', 'billboard', 'candle', 'chandelier'] as const;
export type LightFixture = (typeof LIGHT_FIXTURES)[number];

/** A light: a glow of `color` fading out over `range` metres, drawn as its fixture (lighting only; no gameplay). */
export const LightEntity = EntityBase.extend({
  kind: z.literal('light'),
  yaw: Yaw,
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/, 'light colours are lowercase #rrggbb')
    .default('#fff1d6'),
  intensity: z.number().min(0.1).max(5).default(1),
  range: z.number().min(1).max(30).default(10),
  fixture: z.enum(LIGHT_FIXTURES).default('ceiling'),
  /** Starts switched off (v20; logic "Light on" switches it on). */
  off: z.boolean().optional(),
  /** Starts blinking this many times a second (v20; alarms, failing tubes). Absent = steady. */
  blink: z.number().min(0.2).max(10).optional(),
  /** Sign and billboard fixtures (Style Packs): the words lit up on it. */
  text: z.string().max(24).optional(),
  /** Sign and billboard fixtures: width and height in metres (signs 2.4 × 0.8, billboards 6 × 3.4 by default). */
  size: z.tuple([z.number().min(0.4).max(24), z.number().min(0.3).max(16)]).optional(),
});

/** How a mover runs: round its points, back and forth, or only when logic sends it. */
export const MOVER_MODES = ['loop', 'pingpong', 'trigger'] as const;
export type MoverMode = (typeof MOVER_MODES)[number];

/**
 * A mover (v20): moving platforms. It carries a group of free blocks
 * (`blocks`, by ID) between its `points`, offsets in metres from where the
 * blocks are placed (the first point is usually [0, 0, 0]). Each point can
 * also turn the group by `angles[k]` (radians) about a horizontal hinge
 * through the mover's position, square to its facing `yaw`: drawbridges.
 * Players standing on a carried block ride it. `loop` goes round the points,
 * `pingpong` there and back, `trigger` only when logic sends it ("Send mover",
 * "Move to point"). It waits `wait` seconds at each point.
 */
export const MoverEntity = EntityBase.extend({
  kind: z.literal('mover'),
  yaw: Yaw,
  blocks: z.array(StableId).min(1).max(32),
  /**
   * Props that ride along (Style Packs: a locomotive on its chassis blocks, a
   * mine cart): drawn moving with the blocks, never colliding themselves (they
   * must not be solid; the blocks are what you stand on and bump into).
   */
  props: z.array(StableId).max(16).optional(),
  points: z.array(Vec3Tuple).min(2).max(16),
  angles: z.array(z.number().min(-Math.PI).max(Math.PI)).max(16).optional(),
  mode: z.enum(MOVER_MODES).default('pingpong'),
  /** Metres per second along the way. */
  speed: z.number().min(0.2).max(40).default(3),
  /** Degrees per second when turning (drawbridges). */
  turnSpeed: z.number().min(5).max(360).default(45),
  wait: z.number().min(0).max(120).default(2),
  /** Loop and pingpong movers run from the start (logic Enable/Disable starts and parks them). */
  startActive: z.boolean().default(true),
});

/**
 * A portal (Style Packs 03 and 09): one of a linked pair of glowing surfaces.
 * Walk (or fly, or shoot) into its front and you come out of the other portal
 * of the same `pair`, moving the same way relative to it: your speed is kept
 * and turned by the difference in the two portals' facings. Position is the
 * centre of its bottom edge; it faces `yaw` (the side you go in by) and is
 * `size` [width, height] metres. Logic can switch it off and on (Enable /
 * Disable); bots use pairs as shortcuts. Absent `color`: the pair's own.
 */
export const PortalEntity = EntityBase.extend({
  kind: z.literal('portal'),
  yaw: Yaw,
  size: z.tuple([z.number().min(1.2).max(8), z.number().min(2.2).max(8)]).default([2.4, 3.2]),
  /** Pair ID: the two portals sharing it lead into each other. */
  pair: z.string().regex(/^[a-z0-9_]{1,32}$/, 'pair IDs are 1-32 chars of [a-z0-9_]'),
  startEnabled: z.boolean().default(true),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/)
    .optional(),
});

/**
 * A zipline (v25): a cable between two posts that players ride (sim/zipline.ts).
 * Position is the foot of the start post; `end` is the foot of the far post as
 * an offset from it (MapMaker moves the whole line with its start). The cable
 * runs between the posts' tops, `height` metres above each foot. Press E near
 * an end (or under the cable) to grab it and ride to the far end at `speed`
 * (downhill it runs faster); `twoWay` lets riders go either way (else only
 * start to end). `team`: only that team can ride it. `sag` is how far the
 * drawn cable droops (a share of its length; looks only: riders follow the
 * straight line).
 */
export const ZiplineEntity = EntityBase.extend({
  kind: z.literal('zipline'),
  end: z.tuple([z.number().min(-400).max(400), z.number().min(-200).max(200), z.number().min(-400).max(400)]),
  height: z.number().min(2.5).max(8).default(3.6),
  speed: z.number().min(3).max(30).default(12),
  twoWay: z.boolean().default(false),
  team: TeamFilter,
  sag: z.number().min(0).max(0.1).default(0.03),
});

export const MapEntity = z.discriminatedUnion('kind', [SpawnEntity, PickupEntity, DoorEntity, ButtonEntity, DestructibleEntity, ZoneEntity, TrapEntity, EncounterEntity, PropEntity, MountEntity, PadEntity, BlockEntity, WaterEntity, FlagEntity, HillEntity, LadderEntity, BombsiteEntity, HostageEntity, RescueEntity, LightEntity, AirplaneEntity, MoverEntity, PortalEntity, ZiplineEntity, SectorEntity, ObjectiveEntity]);

export const RELATIONS = ['ally', 'neutral', 'enemy'] as const;

/** A creator-defined side. Relations default to "ally" with itself and "enemy" with everyone else. */
export const Faction = z.object({
  id: FactionId,
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-f]{6}$/).default('#d04a3a'),
  relations: z.record(FactionId, z.enum(RELATIONS)).default({}),
});

/** Outdoor heightmap terrain (see terrain.ts). Heights are centimetres above baseY. */
export const Terrain = z
  .object({
    origin: z.tuple([z.number().finite(), z.number().finite()]),
    spacing: z.number().min(0.5).max(8),
    cols: z.number().int().min(2).max(MAX_TERRAIN_VERTS),
    rows: z.number().int().min(2).max(MAX_TERRAIN_VERTS),
    baseY: z.number().finite().default(0),
    heights: z.array(z.number().int().min(-5000).max(20000)),
    materials: z.array(z.number().int().min(0).max(TERRAIN_MATERIALS.length - 1)),
    boundary: z.boolean().default(true),
    /** Plant cover per cell, 0 (bare) to 4 (lush, with bushes); empty = chosen from each cell's material. */
    foliage: z.array(z.number().int().min(0).max(4)).default([]),
  })
  .refine((t) => t.heights.length === t.cols * t.rows, 'terrain needs cols × rows heights')
  .refine((t) => t.foliage.length === 0 || t.foliage.length === (t.cols - 1) * (t.rows - 1), 'terrain foliage needs a value for every cell')
  .refine((t) => t.materials.length === (t.cols - 1) * (t.rows - 1), 'terrain needs a material for every cell');

/**
 * The play area's edge: walls round a rectangle (world X/Z), so creators can
 * fence a map in with one setting. `invisible` walls stop players and shots
 * without being drawn; `wall` and `fence` are built in the theme's walls.
 */
export const BOUNDARY_STYLES = ['invisible', 'wall', 'fence'] as const;
export const MapBounds = z
  .object({
    min: z.tuple([z.number().finite(), z.number().finite()]),
    max: z.tuple([z.number().finite(), z.number().finite()]),
    style: z.enum(BOUNDARY_STYLES).default('invisible'),
    /** Wall height above the lowest floor (m); invisible walls always reach high enough. */
    height: z.number().min(1).max(60).default(8),
  })
  .refine((b) => b.max[0] - b.min[0] >= 4 && b.max[1] - b.min[1] >= 4, 'the boundary must be at least 4 m across');

/** Road surfaces a race track is drawn in. */
export const TRACK_SURFACES = ['asphalt', 'dirt'] as const;
/** Vehicles a race can be run in (the wheeled and hovering ones that drive the ground). */
export const RACE_VEHICLES = ['kart', 'speeder', 'buggy'] as const;

/**
 * A race track as the curve code reads it (track.ts): ordered control points
 * (world X, Y, Z of the centre line), `width` metres across, a closed circuit
 * or point to point, and its race settings. Maps keep their race track as a
 * path with the `race` use (MapPath, below): map formats v18-v22 stored it in
 * a `track` field of its own, which migration (v22 -> v23) turns into such a
 * path. raceTrack(map) gives the race path in this shape.
 */
export const Track = z.object({
  points: z.array(Vec3Tuple).min(2).max(200),
  width: z.number().min(5).max(30).default(12),
  loop: z.boolean().default(true),
  /** Laps of a circuit (point to point is always one run). */
  laps: z.number().int().min(1).max(20).default(3),
  /** Places on the start grid (two abreast behind the start line). */
  grid: z.number().int().min(2).max(16).default(8),
  /** Vehicle everyone races in (Arcade can change it). */
  vehicle: z.enum(RACE_VEHICLES).default('kart'),
  /** Weapons, vehicle guns and the sideline sentries on (Arcade can change it). */
  combat: z.boolean().default(false),
  surface: z.enum(TRACK_SURFACES).default('asphalt'),
  /** Red-and-white curbs along both edges. */
  curbs: z.boolean().default(true),
  /**
   * Ambient cars: this many NPC-driven vehicles lapping the track in every
   * mode (no team: they run anyone over, and anyone can shoot them up or
   * take the wheel). Wrecked ones come back in the pit lane.
   */
  ambient: z.number().int().min(0).max(12).default(0),
  ambientVehicle: z.enum(RACE_VEHICLES).default('kart'),
  /** Where wrecked ambient cars come back (lined up behind it, facing down the road); null: just off the road by the start line. */
  pit: Vec3Tuple.nullable().default(null),
});
export type Track = z.infer<typeof Track>;
export type TrackSurface = (typeof TRACK_SURFACES)[number];
export type RaceVehicle = (typeof RACE_VEHICLES)[number];

/** How a path (paths.ts) looks: its surface, and what the ground under it is painted. */
export const PATH_STYLES = ['asphalt', 'concrete', 'cobble', 'flagstone', 'gravel', 'dirt', 'sand', 'planks'] as const;
export type PathStyle = (typeof PATH_STYLES)[number];

/**
 * What a path is for (one path can have several):
 * - `road`: drawn, a ribbon in its `style` (paths.ts); `lay` levels the ground under it;
 * - `race`: the race track: checkpoints along it in point order, laps on a closed path,
 *   one run from the first point to the last on an open one (track.ts). A race road is drawn
 *   with curbs, a start line and arches; a race path that is not a road only gets the arches
 *   and the start line (a race along streets drawn some other way);
 * - `route`: an invisible guide line for the AI: bots driving vehicles follow it (and roads),
 *   and NPC squads with the patrol order walk the one their encounter names. MapMaker shows it dashed.
 */
export const PATH_USES = ['road', 'race', 'route'] as const;
export type PathUse = (typeof PATH_USES)[number];
/** How NPCs walk a route: round and round (an open route: back to its start, then on again), or there and back. */
export const PATROL_STYLES = ['loop', 'back_and_forth'] as const;
export type PatrolStyle = (typeof PATROL_STYLES)[number];
/**
 * How the curve runs through the points: `smooth` (centripetal, sampled every metre: it never
 * overshoots at sharp or uneven corners) or `classic` (the race track's original curve, kept by
 * tracks made before paths and races were one, so they race exactly as they always did).
 */
export const PATH_CURVES = ['smooth', 'classic'] as const;

/** A race path's settings (absent: these defaults). */
export const RaceSettings = z.object({
  /** Laps of a circuit (point to point is always one run). */
  laps: z.number().int().min(1).max(20).default(3),
  /** Places on the start grid (two abreast behind the start line). */
  grid: z.number().int().min(2).max(16).default(8),
  /** Vehicle everyone races in (Arcade can change it). */
  vehicle: z.enum(RACE_VEHICLES).default('kart'),
  /** Weapons, vehicle guns and the sideline sentries on (Arcade can change it). */
  combat: z.boolean().default(false),
  /** Red-and-white curbs along both edges. */
  curbs: z.boolean().default(true),
  /**
   * Ambient cars: this many NPC-driven vehicles lapping the track in every
   * mode (no team: they run anyone over, and anyone can shoot them up or
   * take the wheel). Wrecked ones come back in the pit lane.
   */
  ambient: z.number().int().min(0).max(12).default(0),
  ambientVehicle: z.enum(RACE_VEHICLES).default('kart'),
  /** Where wrecked ambient cars come back (lined up behind it, facing down the road); null: just off the road by the start line. */
  pit: Vec3Tuple.nullable().default(null),
});
export type RaceSettings = z.infer<typeof RaceSettings>;

/**
 * A path drawn in MapMaker: an ordered list of points (a smooth curve through
 * them), open or `closed` (a loop: the last point joins the first), `width`
 * metres wide, with its `uses` (PATH_USES). The points' order is the path's
 * direction: the way a race runs, and the only way traffic goes on a
 * `oneWay` path. Roads: `style`, and `lay`: the ground under it is levelled
 * to the path and painted and its edges blend back into the ground (worked
 * out on load, so moving a path in MapMaker moves the dip with it); a path
 * that doesn't lay keeps its own height (a raised track). Drawn only:
 * nothing collides with a path itself.
 */
export const MapPath = z.object({
  id: z.string().min(1).max(64),
  points: z.array(Vec3Tuple).min(2).max(200),
  /** A loop: the last point joins back to the first ("join ends"). */
  closed: z.boolean().default(false),
  uses: z.array(z.enum(PATH_USES)).min(1).max(3).default(['road']),
  width: z.number().min(0.5).max(30).default(3),
  style: z.enum(PATH_STYLES).default('dirt'),
  lay: z.boolean().default(true),
  /** Traffic only in point order: vehicle bots never drive it the other way, patrols never turn back. */
  oneWay: z.boolean().optional(),
  /** Speed hint for drivers (m/s): bots driving along it keep under it. Absent: none. */
  speed: z.number().min(2).max(80).optional(),
  /** Routes: how NPCs walk it (absent: round a closed path, there and back on an open one). */
  patrol: z.enum(PATROL_STYLES).optional(),
  /** Race settings (absent: the defaults). */
  race: RaceSettings.optional(),
  /** Absent: smooth. */
  curve: z.enum(PATH_CURVES).optional(),
});
export type MapPath = z.infer<typeof MapPath>;

/** Sky, distant scenery, ground past the border and haze (see backdrop.ts). */
export const BackdropSchema = z.object({
  sky: z.enum(SKY_IDS),
  scenery: z.enum(SCENERY_IDS),
  ground: z.enum(BACKDROP_GROUNDS),
  haze: z.number().min(0).max(1).default(0.5),
  mist: z.number().min(0).max(1).optional(),
  /** Border just outside the boundary (see border.ts): cliffs, city blocks, an electric fence, forest or shoreline. Absent: none. */
  border: z.enum(BORDER_STYLES).optional(),
  /** Per-side overrides of `border` (north = +Z edge, east = +X edge). */
  borderSides: z
    .object({ north: z.enum(BORDER_STYLES).optional(), east: z.enum(BORDER_STYLES).optional(), south: z.enum(BORDER_STYLES).optional(), west: z.enum(BORDER_STYLES).optional() })
    .optional(),
});

/** Blood on hits and kills: its colour (green for aliens, oil for robots…) and how much. */
export const BLOOD_AMOUNTS = ['off', 'light', 'heavy'] as const;
export const BloodSettings = z.object({
  color: z.string().regex(/^#[0-9a-f]{6}$/).default('#8a0b0b'),
  amount: z.enum(BLOOD_AMOUNTS).default('light'),
});
export const DEFAULT_BLOOD = { color: '#8a0b0b', amount: 'light' } as const;

/** Recommended team layout for team modes: players per team, 2–8 teams (e.g. [2, 2, 2, 12]). */
export const TeamSetup = z.object({
  // Up to 48 a team (v29; 16 before): a large map's own layout (Iron Coast, 24 v 24 and more on dedicated hosts).
  sizes: z.array(z.number().int().min(1).max(48)).min(2).max(8),
});

/**
 * The map's own Player Bots (sim/botSet.ts), for scenarios: names, looks, skills, styles, teams and squads
 * for its PvP bots or, in co-op, the players' side. They play unless the host picks a set of their own.
 * Only the shape is checked here; validateBotSet makes it valid when a match starts (unknown looks: random).
 */
export const MapBotSet = z.object({
  name: z.string().max(40).default('Map bots'),
  fill: z.enum(['random', 'only']).default('random'),
  entries: z
    .array(
      z.object({
        name: z.string().min(1).max(20),
        look: z.string().max(64).optional(),
        skill: z.enum(['easy', 'normal', 'hard']).optional(),
        style: z.enum(['mixed', 'arena', 'tactical']).optional(),
        team: z.number().int().min(0).max(7).optional(),
        squad: z.string().max(16).optional(),
      }),
    )
    .max(96),
});
export type MapBotSet = z.infer<typeof MapBotSet>;

/** Map-wide physics: gravity as a multiple of normal (0.25 = moon, 2 = heavy) and whether long falls hurt. */
export const MapPhysics = z.object({
  gravity: z.number().min(0.2).max(3).default(1),
  fallDamage: z.boolean().default(false),
});
export type MapPhysics = z.infer<typeof MapPhysics>;

/** Map-wide glass settings: how long a shattered pane stays out (null: until the next round). */
export const GlassSettings = z.object({
  respawnSeconds: z.number().min(1).max(600).nullable().default(null),
});
export type GlassSettings = z.infer<typeof GlassSettings>;

// ---------------------------------------------------------------- set pieces (v27)

/**
 * Set pieces (format v27, docs/SET_PIECES_PLAN.md): multi-cell structures placed as one (a carriageway, a skybridge),
 * declarative data made of the ordinary map pieces. A definition is a footprint and a list of parts in the piece's own
 * frame; a placement names one. loadMap expands every placement into its parts (map/setPieces.ts) before geometry,
 * collision, navigation, validation and the budgets see the map; MapMaker keeps the placements (`forEditing`).
 */

/**
 * The material roles a set piece's parts name instead of fixed materials, so the piece re-themes: a role pack
 * (content/setpieces/roles.json) maps each to a library material, else the map's theme paints it (stone: walls,
 * trim: trim, floor and paving: floor, roof: roof, wood and metal: solids).
 */
export const SET_PIECE_MATERIAL_ROLES = ['stone', 'trim', 'floor', 'paving', 'roof', 'wood', 'metal'] as const;
export type SetPieceMaterialRole = (typeof SET_PIECE_MATERIAL_ROLES)[number];
/** And the roles that are a look rather than a material: the facade rooms wear, the doors' style, the windows' glass. */
export const SET_PIECE_ROLES = [...SET_PIECE_MATERIAL_ROLES, 'facade', 'door', 'glass'] as const;
export type SetPieceRole = (typeof SET_PIECE_ROLES)[number];

/** What each role is: a material role a library material (and tint), `facade` a facade, `door` a door style, `glass` a glass kind or none. */
export const SetPieceRoleValues = z.object({
  stone: SurfaceStyle.optional(),
  trim: SurfaceStyle.optional(),
  floor: SurfaceStyle.optional(),
  paving: SurfaceStyle.optional(),
  roof: SurfaceStyle.optional(),
  wood: SurfaceStyle.optional(),
  metal: SurfaceStyle.optional(),
  facade: z.enum(FACADES).optional(),
  door: z.enum(DOOR_STYLES).optional(),
  glass: z.enum([...GLASS_KINDS, 'none']).optional(),
});
export type SetPieceRoleValues = z.infer<typeof SetPieceRoleValues>;
export type SetPieceRoleValuesInput = z.input<typeof SetPieceRoleValues>;

/** A part's value taken from a role: `{ "role": "stone" }`. */
const MaterialRef = z.object({ role: z.enum(SET_PIECE_MATERIAL_ROLES) });
const PartSurface = z.union([SurfaceStyle, MaterialRef]);

/** A tile part: a TilePlacement in the piece's frame (no id), its surfaces, glass and facade fixed or from a role. */
export const SetPieceTilePart = TilePlacement.omit({ id: true }).extend({
  kind: z.literal('tile'),
  x: z.number().int().min(-64).max(64),
  y: z.number().int().min(-64).max(64),
  z: z.number().int().min(-16).max(16),
  surfaces: z
    .object({ floor: PartSurface.optional(), walls: PartSurface.optional(), solids: PartSurface.optional(), underside: PartSurface.optional(), trim: PartSurface.optional(), roof: PartSurface.optional() })
    .optional(),
  glass: z.record(EdgeKey, z.union([z.enum(GLASS_KINDS), z.object({ role: z.literal('glass') })])).optional(),
  options: z
    .object({
      layout: z.enum(ROOM_LAYOUTS).optional(),
      floor: z.enum(FLOOR_INSERTS).optional(),
      ceiling: z.enum(CEILINGS).optional(),
      corners: z.enum(CORNERS).optional(),
      facade: z.union([z.enum(FACADES), z.object({ role: z.literal('facade') })]).optional(),
    })
    .optional(),
});
/** Entity parts: a block (its material fixed, from a role, or the theme's), a prop, a door (its style fixed or from a role), a ladder or a light, at a position in the piece's frame. */
export const SetPieceBlockPart = BlockEntity.omit({ id: true }).extend({
  material: z.union([ContentId, MaterialRef]).nullable().default(null),
  glass: z.union([z.enum(GLASS_KINDS), z.object({ role: z.literal('glass') })]).optional(),
});
export const SetPieceDoorPart = DoorEntity.omit({ id: true }).extend({ style: z.union([z.enum(DOOR_STYLES), z.object({ role: z.literal('door') })]).optional() });
export const SetPiecePart = z.discriminatedUnion('kind', [SetPieceTilePart, SetPieceBlockPart, PropEntity.omit({ id: true }), SetPieceDoorPart, LadderEntity.omit({ id: true }), LightEntity.omit({ id: true })]);
export type SetPiecePart = z.infer<typeof SetPiecePart>;
/** The kinds of map piece a set piece is made of. */
export const SET_PIECE_PART_KINDS = ['tile', 'block', 'prop', 'door', 'ladder', 'light'] as const;

/** Where a piece meets what is built round it: a side of one of its cells, on one of its levels, facing out of its footprint. */
export const SetPiecePort = z.object({
  side: z.enum(['N', 'E', 'S', 'W']),
  cell: z.tuple([z.number().int(), z.number().int()]),
  level: z.number().int(),
  /** `door`: a doorway; `opening`: open (an arch, a passage's end, open floor). */
  kind: z.enum(['door', 'opening']),
});
export type SetPiecePort = z.infer<typeof SetPiecePort>;

/** A note for logic and MapMaker on some of a piece's parts (inert in play): `doorPair`, two doors that belong together; `spot`, a place (cover, a lookout). */
export const SetPieceMarker = z.object({
  name: z.string().regex(/^[a-z0-9_]{1,32}$/),
  kind: z.enum(['doorPair', 'spot']),
  parts: z.array(z.number().int().min(0).max(1023)).min(1).max(16),
});
export type SetPieceMarker = z.infer<typeof SetPieceMarker>;

/** Set piece ids: `setpiece.<name>` for the shipped ones (content/setpieces/), `local.<name>` for one a map carries. */
export const SetPieceDefId = z.string().regex(/^(setpiece|local)\.[a-z0-9_]{1,40}$/, 'set piece ids look like "setpiece.name" (shipped) or "local.name" (one a map carries)');

/** A set piece's definition (content/setpieces/<family>.json, or a map's own `setPieceDefs`). */
export const SetPieceDefinition = z.object({
  id: SetPieceDefId,
  displayName: z.string().min(1).max(60),
  family: z.string().regex(/^[a-z0-9_]{1,32}$/),
  /** Palette group in MapMaker's Set pieces tab. */
  category: z.string().min(1).max(40),
  blurb: z.string().max(240).optional(),
  /** The role packs it suits (content/setpieces/roles.json): MapMaker offers it with these. */
  packs: z.array(z.string().regex(/^[a-z0-9_]{2,32}$/)).max(32).default([]),
  /** What it claims on the grid: these cells (dx, dy) on every level from levels[0] to levels[1] (dz). */
  footprint: z.object({
    cells: z.array(z.tuple([z.number().int().min(-32).max(32), z.number().int().min(-32).max(32)])).min(1).max(256),
    levels: z.tuple([z.number().int().min(-8).max(8), z.number().int().min(-8).max(8)]),
  }),
  /** `free`: it can be placed mirrored (east and west swapped); `none`: it can't (an asymmetric tile in it has no mirrored twin). */
  mirror: z.enum(['free', 'none']).default('free'),
  /** Its own value for a role no pack gives (else the theme's). */
  roles: SetPieceRoleValues.optional(),
  ports: z.array(SetPiecePort).max(256).default([]),
  parts: z.array(SetPiecePart).min(1).max(1024),
  markers: z.array(SetPieceMarker).max(64).optional(),
});
export type SetPieceDefinition = z.infer<typeof SetPieceDefinition>;
export type SetPieceDefinitionInput = z.input<typeof SetPieceDefinition>;

/**
 * A placement's id. Its parts are `sp_<id>_<part index>` (map/setPieces.ts), so it is at most 48 characters: with
 * at most 1024 parts that keeps every part's id a StableId (64).
 */
export const SetPieceId = z.string().regex(/^[A-Za-z0-9_-]{4,48}$/, 'set piece IDs must be 4-48 chars of [A-Za-z0-9_-]');

/** A placed set piece (v27): the piece, its anchor cell and level, its turn (clockwise quarter turns, after the mirror), and how it is themed. */
export const SetPiecePlacement = z.object({
  id: SetPieceId,
  piece: SetPieceDefId,
  x: z.number().int().min(-MAX_TILE_CELL).max(MAX_TILE_CELL),
  y: z.number().int().min(-MAX_TILE_CELL).max(MAX_TILE_CELL),
  z: z.number().int().min(-MAX_TILE_LEVEL).max(MAX_TILE_LEVEL),
  rotation: Rotation.default(0),
  /** East and west swapped (in the piece's own frame, before the turn), in place over the same footprint. */
  mirror: z.boolean().default(false),
  /** The role pack that themes it (content/setpieces/roles.json); absent: the one for the map's theme, if any. */
  pack: z.string().regex(/^[a-z0-9_]{2,32}$/).optional(),
  /** Small per-placement tweaks: a role's value, or parts left out (by index). */
  overrides: z.object({ roles: SetPieceRoleValues.optional(), hide: z.array(z.number().int().min(0).max(1023)).max(1024).optional() }).optional(),
});
export type SetPiecePlacement = z.infer<typeof SetPiecePlacement>;

/**
 * A group (v31; MapMaker → Group, Ctrl+G; editor/groups.ts): things selected, moved, turned, mirrored and duplicated
 * as one. Its members are ids of the map's own tiles, entities and set-piece placements; each is in one group at most.
 * MapMaker only: play ignores groups.
 */
export const MapGroup = z.object({
  id: StableId,
  /** What MapMaker calls it ("West base"); absent: "Group". */
  name: z.string().min(1).max(40).optional(),
  members: z.array(StableId).min(2).max(2048),
});
export type MapGroup = z.infer<typeof MapGroup>;

/**
 * A note pin (v31; MapMaker's Note tool, J; editor/notes.ts): a note for the map's makers ("the sniper line from B is
 * too long"), pinned at a point (world metres). Shown in MapMaker only, never in play.
 */
export const EditorNote = z.object({
  id: StableId,
  position: Vec3Tuple,
  text: z.string().min(1).max(500),
});
export type EditorNote = z.infer<typeof EditorNote>;

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
  /** Outdoor terrain (grass, dirt, stone… with hills and cliffs), or none. */
  terrain: Terrain.nullable().default(null),
  /** Walls round the play area, or none. */
  bounds: MapBounds.nullable().default(null),
  /** Paths: roads, streets and trails, the race track and AI routes (PATH_USES). Absent: none. */
  paths: z.array(MapPath).max(64).optional(),
  /** What surrounds the play area, or none (the theme's backdrop). */
  backdrop: BackdropSchema.nullable().default(null),
  /** Gravity and fall damage for this map, or none (normal gravity, no fall damage). Matches can override both. */
  physics: MapPhysics.nullable().default(null),
  /** Blood colour and amount, or none (dark red, light). */
  blood: BloodSettings.nullable().default(null),
  /** Glass panes: when shattered panes come back (absent: next round). */
  glass: GlassSettings.optional(),
  /** Recommended teams for team modes, or none (two even teams). */
  teamSetup: TeamSetup.nullable().default(null),
  /** The map's own bots (MapBotSet), or none (random bots). Absent from older maps: they load unchanged. */
  bots: MapBotSet.optional(),
  /**
   * Which looks the map's random bots wear, and so their names (content/botNames.ts): character groups and/or
   * name themes, e.g. ["soldiers"] for a D-Day map. Absent or empty: every look. The host can change it (Match
   * setup, the pause menu, server rules). Absent from older maps: they load unchanged (no migration needed).
   * Unknown ids are left out when a match starts (validBotCast) and flagged by validateMap.
   */
  botCast: z.array(z.string().min(1).max(24)).max(8).optional(),
  /**
   * The map's default weapon set (v28; sim/weaponSets.ts, content/weapon-sets.json: military, scifi, medieval, chaos,
   * mixed), set in MapMaker's Map properties: what a match here spawns with and its pickups hold, unless the host picks
   * another. Absent: Standard (the mode's own loadout, pickups as placed). An id this build has no set for plays
   * Standard and is flagged by validateMap.
   */
  weaponSet: z.string().regex(/^[a-z][a-z0-9_]{1,23}$/, 'weapon set ids look like "military"').optional(),
  /** Content packs this map needs, beyond the always-present core pack. */
  dependencies: z.array(z.object({ pack: ContentId, version: z.string().max(32) })).max(MAX_MAP_DEPENDENCIES).default([]),
  /**
   * Set pieces placed as one (v27): each expands into its parts when the map is loaded for play (map/setPieces.ts).
   * The entity and tile caps count these placements, not their parts. Absent: none.
   */
  setPieces: z.array(SetPiecePlacement).max(1024).optional(),
  /** Set pieces this map defines itself (v27, `local.*`: saved from a selection in MapMaker), so it plays anywhere. Absent: none. */
  setPieceDefs: z.array(SetPieceDefinition).max(64).optional(),
  /** MapMaker's groups (v31): things kept together while editing. Absent: none. Play ignores them. */
  groups: z.array(MapGroup).max(256).optional(),
  /** Notes for the map's makers, pinned on the map (v31): shown in MapMaker, never in play. Absent: none. */
  editorNotes: z.array(EditorNote).max(256).optional(),
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
export type MountEntity = z.infer<typeof MountEntity>;
export type PadEntity = z.infer<typeof PadEntity>;
export type LadderEntity = z.infer<typeof LadderEntity>;
export type BlockEntity = z.infer<typeof BlockEntity>;
export type BloodSettings = z.infer<typeof BloodSettings>;
export type BloodAmount = (typeof BLOOD_AMOUNTS)[number];
export type WaterEntity = z.infer<typeof WaterEntity>;
export type FlagEntity = z.infer<typeof FlagEntity>;
export type HillEntity = z.infer<typeof HillEntity>;
export type BombsiteEntity = z.infer<typeof BombsiteEntity>;
export type SectorEntity = z.infer<typeof SectorEntity>;
export type ObjectiveEntity = z.infer<typeof ObjectiveEntity>;
export type HostageEntity = z.infer<typeof HostageEntity>;
export type RescueEntity = z.infer<typeof RescueEntity>;
export type LightEntity = z.infer<typeof LightEntity>;
export type AirplaneEntity = z.infer<typeof AirplaneEntity>;
export type MoverEntity = z.infer<typeof MoverEntity>;
export type PortalEntity = z.infer<typeof PortalEntity>;
export type ZiplineEntity = z.infer<typeof ZiplineEntity>;
export type BlockBehaviour = (typeof BLOCK_BEHAVIOURS)[number];
export type Liquid = (typeof LIQUIDS)[number];
export type Faction = z.infer<typeof Faction>;
export type MapBounds = z.infer<typeof MapBounds>;
export type BoundaryStyle = (typeof BOUNDARY_STYLES)[number];
export type TeamSetup = z.infer<typeof TeamSetup>;
export type NpcRole = (typeof NPC_ROLES)[number];
export type SquadOrder = (typeof SQUAD_ORDERS)[number];
export type Relation = (typeof RELATIONS)[number];
export type TilePlacement = z.infer<typeof TilePlacement>;
export type Rotation = z.infer<typeof Rotation>;
export type SurfaceStyle = z.infer<typeof SurfaceStyle>;
export type TileSurfaces = z.infer<typeof TileSurfaces>;
