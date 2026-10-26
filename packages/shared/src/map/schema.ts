import { z } from 'zod';
import { CEILINGS, CORNERS, EDGE_STYLES, FACADES, FLOOR_INSERTS, ROOM_LAYOUTS } from './catalog.ts';
import { MAX_TERRAIN_VERTS, TERRAIN_MATERIALS } from './terrain.ts';
import { BACKDROP_GROUNDS, SCENERY_IDS, SKY_IDS } from './backdrop.ts';
import { BORDER_STYLES } from './border.ts';
import { ScenarioLogic } from './logic.ts';
import { MOUNT_MODELS, MOUNT_SKINS } from '../sim/mounts.ts';

/**
 * Tile Trigger map document, format version 6 (v2 added per-surface tile styles, v3 pickup
 * entities, v4 scenario entities and logic, v5 factions and NPC encounters, v6 per-side
 * wall styles, trim and props, v7 terrain, v8 map boundary and team setup, v11 flag bases
 * and hills for Capture the Flag and King of the Hill, v18 the race `track`, v19 the transport plane and mount skins, v20 movers, logic-driven
 * lights and blocks, pitched blocks, team-only buttons/doors/zones and tinted liquids).
 *
 * Maps are data, never code. Every placed item carries a stable string ID and
 * references catalog content by content ID. Domains the spec reserves
 * (advancedStructure, terrain, props, factions, objectives, logic, world,
 * legacyMetadata) are not populated in Phase 0; they will be added through
 * migrations as each system lands.
 */
export const MAP_FORMAT = 'tiletrigger.map';
/** The format name maps were saved under while the game was called ChronoSplit; they load and are re-saved as MAP_FORMAT. */
export const LEGACY_MAP_FORMAT = 'chronosplit.map';
export const MAP_FORMAT_VERSION = 20;

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

/**
 * Team filter (v20) on buttons, doors and zones: only this team (a team or
 * faction ID, as for spawns) can press it, open it or count in it. Absent:
 * everyone.
 */
const TeamFilter = z
  .string()
  .regex(/^[a-z0-9_.]{2,64}$/)
  .optional();

/** A sliding double door, sized for a Classic Grid doorway (3 m × 3 m). */
export const DoorEntity = EntityBase.extend({
  kind: z.literal('door'),
  yaw: Yaw,
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
});

/** Faction IDs are short lowercase words; `players` is the built-in faction of every player in co-op. */
export const FactionId = z.string().regex(/^[a-z0-9_]{2,32}$/, 'faction IDs are 2-32 chars of [a-z0-9_]');
export const PLAYERS_FACTION = 'players';

/**
 * NPC kinds an encounter can field: the soldiers, then the creatures (see
 * sim/npc.ts and sim/creatures.ts). Order matters: snapshots send the index.
 */
export const NPC_ROLES = ['trooper', 'gunner', 'heavy', 'sniper', 'imp', 'puglin', 'cyclops', 'oculus', 'scolitex', 'zombie'] as const;
/** The creature kinds among NPC_ROLES (their own bodies and clips, not the soldier rig). */
export const CREATURE_ROLES = ['imp', 'puglin', 'cyclops', 'oculus', 'scolitex'] as const satisfies readonly (typeof NPC_ROLES)[number][];
const squadCount = z.number().int().min(0).max(16);
export const SQUAD_ORDERS = ['hold', 'attack', 'defend', 'patrol', 'follow', 'roam'] as const;
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
 * A transport plane flying a fixed route over the map. Position is the
 * route's anchor on the ground (MapMaker moves the whole route with it);
 * `route` points are [x, z] offsets from it, flown at `altitude` metres
 * above it, once round every `loopSeconds`. A closed route loops; an open
 * one flies first to last, then the plane starts over and anyone still
 * aboard is thrown out. Riders jump out with E or jump and parachute down.
 */
export const AirplaneEntity = EntityBase.extend({
  kind: z.literal('airplane'),
  route: z.array(z.tuple([z.number().min(-2000).max(2000), z.number().min(-2000).max(2000)])).min(2).max(32),
  altitude: z.number().min(15).max(400).default(70),
  loopSeconds: z.number().min(10).max(600).default(60),
  closed: z.boolean().default(true),
  airdrop: z.enum(AIRDROP_MODES).default('off'),
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
export const LadderEntity = EntityBase.extend({
  kind: z.literal('ladder'),
  yaw: Yaw,
  height: z.number().min(1).max(24).default(4),
  width: z.number().min(0.5).max(3).default(0.9),
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
  size: z.tuple([z.number().min(0.2).max(64), z.number().min(0.1).max(32), z.number().min(0.2).max(64)]).default([4, 0.5, 4]),
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

/** What a light looks like where it hangs: nothing, a ceiling panel, a wall lamp, a bare bulb, or a long strip. */
export const LIGHT_FIXTURES = ['none', 'ceiling', 'wall', 'bulb', 'strip'] as const;
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

export const MapEntity = z.discriminatedUnion('kind', [SpawnEntity, PickupEntity, DoorEntity, ButtonEntity, DestructibleEntity, ZoneEntity, TrapEntity, EncounterEntity, PropEntity, MountEntity, PadEntity, BlockEntity, WaterEntity, FlagEntity, HillEntity, LadderEntity, BombsiteEntity, HostageEntity, RescueEntity, LightEntity, AirplaneEntity, MoverEntity]);

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
 * A race track (map format v18; see track.ts): a smooth road through ordered
 * control points (world X, Y, Z of its centre line), `width` metres across,
 * either a closed circuit or point to point. Checkpoints and the start grid
 * are derived from it. Race mode needs one; other modes just drive on it.
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
  sizes: z.array(z.number().int().min(1).max(16)).min(2).max(8),
});

/** Map-wide physics: gravity as a multiple of normal (0.25 = moon, 2 = heavy) and whether long falls hurt. */
export const MapPhysics = z.object({
  gravity: z.number().min(0.2).max(3).default(1),
  fallDamage: z.boolean().default(false),
});
export type MapPhysics = z.infer<typeof MapPhysics>;

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
  /** Race track (road, checkpoints, start grid), or none. */
  track: Track.nullable().default(null),
  /** What surrounds the play area, or none (the theme's backdrop). */
  backdrop: BackdropSchema.nullable().default(null),
  /** Gravity and fall damage for this map, or none (normal gravity, no fall damage). Matches can override both. */
  physics: MapPhysics.nullable().default(null),
  /** Blood colour and amount, or none (dark red, light). */
  blood: BloodSettings.nullable().default(null),
  /** Recommended teams for team modes, or none (two even teams). */
  teamSetup: TeamSetup.nullable().default(null),
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
export type HostageEntity = z.infer<typeof HostageEntity>;
export type RescueEntity = z.infer<typeof RescueEntity>;
export type LightEntity = z.infer<typeof LightEntity>;
export type AirplaneEntity = z.infer<typeof AirplaneEntity>;
export type MoverEntity = z.infer<typeof MoverEntity>;
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
