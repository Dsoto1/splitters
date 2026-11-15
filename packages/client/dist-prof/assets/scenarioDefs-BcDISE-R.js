import { aM as PRECIPITATION, _ as TERRAIN_MATERIALS, aN as MAX_TERRAIN_VERTS, aO as SQUAD_ORDERS, aP as WEAPON_CATEGORIES, aQ as MOUNT_SKINS, aR as MOUNT_MODELS, aS as RETIRED_MOUNT_MODELS, $ as MAP_FORMAT_VERSION, a0 as MAP_FORMAT, aT as TICK_DT, aI as hypot, a4 as TICK_RATE, P as PLAYER } from "./index-BAsW2uYW.js";
import { O as ScenarioLogic, P as FACADES, Q as CORNERS, R as CEILINGS, T as FLOOR_INSERTS, U as ROOM_LAYOUTS, V as EDGE_STYLES, W as BORDER_STYLES, X as BACKDROP_GROUNDS, Y as SCENERY_IDS, Z as SKY_IDS, _ as isBreakableProp, J as isEnvModel, $ as GLASS_EDGE_STYLES, j as coreCatalog, l as buildOccupancy, a0 as SIDES, o as edgeKey, p as localSide, a1 as resolveEdge, a2 as EDGE_SHAPES, a3 as TILE_DIMENSIONS, a4 as KIT_FAMILIES, a5 as KIT_ALIASES, a6 as envSurfaceOf, a7 as CORE_MATERIALS, a as getEnvSpecies, y as envVariant, N as yawXZ, E as ELECTRIC_FENCE, a8 as dynamicBlockIds, a9 as envHalfSize, g as getProp, G as boxQuat } from "./settle-BDJE4VMF.js";
import { o as object, _ as _enum, n as number, b as boolean, a as array, s as string, l as literal, t as tuple, r as record, d as discriminatedUnion, u as union, c as datetime } from "./vendor-BIr0ad6t.js";
const MAX_MAP_DEPENDENCIES = 16;
const StableId = string().regex(/^[A-Za-z0-9_-]{4,64}$/, "IDs must be 4-64 chars of [A-Za-z0-9_-]");
const ContentId = string().regex(/^[a-z0-9_]+(\.[a-z0-9_]+)+$/, 'content IDs look like "pack.name"');
const Vec3Tuple = tuple([number().finite(), number().finite(), number().finite()]);
const MAX_THUMBNAIL_CHARS = 48e3;
const THUMBNAIL_SIZE = { width: 384, height: 216 };
const MapThumbnail = string().max(MAX_THUMBNAIL_CHARS, "the map picture is too large").regex(/^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/, "the map picture must be an image captured in MapMaker");
const ThumbnailCamera = object({ position: Vec3Tuple, target: Vec3Tuple });
const CardCamera = object({ position: Vec3Tuple, yaw: number().finite(), pitch: number().min(-1.55).max(1.55) });
const MapRelease = object({
  mapId: string().regex(/^m_[a-z2-7]{16}$/),
  versionId: string().regex(/^v_[a-z2-7]{16}$/),
  revision: number().int().min(1).max(1e6),
  contentHash: string().regex(/^sha256:[0-9a-f]{64}$/),
  /** MAP_FORMAT_VERSION when it was stamped. */
  schemaVersion: number().int().min(1).max(1e4),
  releasedAt: datetime()
});
const MapMetadata = object({
  id: StableId,
  name: string().min(1).max(80),
  author: string().max(80).default(""),
  description: string().max(2e3).default(""),
  createdAt: datetime(),
  updatedAt: datetime(),
  /** Remix lineage; null for original maps. */
  parentId: StableId.nullable().default(null),
  recommendedPlayers: object({ min: number().int().min(1).max(96), max: number().int().min(1).max(96) }).default({ min: 2, max: 8 }),
  supportedModes: array(ContentId).default(["core.deathmatch"]),
  /**
   * Player caps by mode (MapMaker's Map properties, "Players by mode"): the recommended and the most players for a
   * mode on this map. A mode not listed takes the automatic caps worked out from the map's size and spawn points
   * (sim/matchSetup.ts autoPlayerCaps; docs/GAME_MODES.md, "Player caps"). The setup screen shows them, and the map
   * rotation and map changes keep a match within the most.
   */
  playerCaps: record(ContentId, object({ recommended: number().int().min(1).max(128), max: number().int().min(1).max(128) })).optional(),
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
  testOnly: boolean().optional(),
  /**
   * The map's tier (v35; owner, 2026-11-11), set in MapMaker's Map properties. `experimental`: shown under an
   * "Experimental" heading and left out of Quick Play, playlists and official rotations, and its quality gates
   * (map/qualityGates.ts) only report. Absent or `core`: on the core roster, where every gate must pass. A new map
   * starts experimental.
   */
  tier: _enum(["core", "experimental"]).optional(),
  /**
   * Destructible environment (v36), set in MapMaker's Map properties: every solid prop can be shot apart, not only the
   * ones the catalogue makes breakable (natural rocks stay; a prop marked `unbreakable` stays). Blocks break by their
   * own `behaviour`; walls, floors, terrain and doors never do. Absent: off.
   */
  destruction: boolean().optional()
});
const SurfaceStyle = object({
  material: ContentId,
  tint: string().regex(/^#[0-9a-f]{6}$/, "tints are lowercase #rrggbb").nullable().default(null)
});
const TileSurfaces = object({
  floor: SurfaceStyle.optional(),
  walls: SurfaceStyle.optional(),
  solids: SurfaceStyle.optional(),
  underside: SurfaceStyle.optional(),
  trim: SurfaceStyle.optional(),
  /** The top of a room's roof (absent: as the floor). */
  roof: SurfaceStyle.optional()
});
const EdgeKey = string().regex(/^-?\d+,-?\d+,-?\d+:[NESW]$/, 'edge keys look like "0,0,0:N"');
const LocalCellKey = string().regex(/^-?\d+,-?\d+,-?\d+$/, 'cell keys look like "0,0,1"');
const GLASS_KINDS = ["breakable", "reinforced"];
const GLASS_KIND_LABELS = { breakable: "Breakable", reinforced: "Reinforced (bulletproof)" };
const Rotation = union([literal(0), literal(1), literal(2), literal(3)]);
const MAX_TILE_CELL = 256;
const MAX_TILE_LEVEL = 16;
const TilePlacement = object({
  id: StableId,
  tile: ContentId,
  x: number().int().min(-MAX_TILE_CELL).max(MAX_TILE_CELL),
  y: number().int().min(-MAX_TILE_CELL).max(MAX_TILE_CELL),
  z: number().int().min(-MAX_TILE_LEVEL).max(MAX_TILE_LEVEL),
  rotation: Rotation.default(0),
  surfaces: TileSurfaces.optional(),
  /**
   * The material family the piece is drawn in (format v37; the tunnel kit, content/tiles/tunnels.json: concrete,
   * brick…): the same shape, ports, collision and bore, another family's materials and trim. Absent: the tile's own.
   * A family the tile doesn't come in is ignored (and a validator warning).
   */
  family: string().regex(/^[a-z][a-z0-9_]*$/).max(32).optional(),
  /** Per-side wall choices (window, archway, half wall, no wall…); absent sides are `auto`. */
  edges: record(EdgeKey, _enum(EDGE_STYLES)).optional(),
  /** Glass in window edges (window, twin windows, firing slit), per side; absent sides have none. */
  glass: record(EdgeKey, _enum(GLASS_KINDS)).optional(),
  /**
   * Floors added in the piece's own upper storeys (format v26), per tile cell ("dx,dy,dz", its own frame): a full
   * slab at that storey's floor level, like a floor the piece came with. Only storeys a piece leaves without a floor
   * take one (geometry.ts `canAddFloor`); others are ignored.
   */
  upperFloors: array(LocalCellKey).max(256).optional(),
  /** Room options on rooms that take them (catalog `configurable`); absent fields leave the tile as designed. */
  options: object({
    layout: _enum(ROOM_LAYOUTS).optional(),
    floor: _enum(FLOOR_INSERTS).optional(),
    ceiling: _enum(CEILINGS).optional(),
    corners: _enum(CORNERS).optional(),
    facade: _enum(FACADES).optional()
  }).optional()
});
const ClassicStructure = object({
  /** Horizontal size of one grid cell in metres. */
  cellSize: number().positive().default(8),
  /** Vertical distance between floor levels in metres. */
  levelHeight: number().positive().default(4),
  theme: ContentId.default("core.prototype"),
  tiles: array(TilePlacement).max(4096)
});
const BREAKTHROUGH_MAX_SECTORS = 16;
const EntityBase = object({
  id: StableId,
  position: Vec3Tuple,
  /** Creator-given name shown in the logic editor ("Vault door"). */
  name: string().max(40).optional()
});
const SpawnEntity = EntityBase.extend({
  kind: literal("spawn"),
  /** Facing in radians, see viewDirection(). */
  yaw: number().finite().default(0),
  /** Team (faction ID) that spawns here in Team Deathmatch; null spawns are shared by everyone. */
  faction: string().regex(/^[a-z0-9_.]{2,64}$/).nullable().default(null),
  /**
   * Breakthrough (v29): this spawn point is in the spawn group of sector `sector` (its order, 1-based) for `side`
   * (the attackers or the defenders, whichever team that is in a round). Breakthrough spawns each side at its group
   * for the sector in play; other modes use it like any other spawn point. Absent: in no group.
   */
  sector: number().int().min(1).max(BREAKTHROUGH_MAX_SECTORS).optional(),
  side: _enum(["attack", "defend"]).optional()
});
const PickupEntity = EntityBase.extend({
  kind: literal("pickup"),
  /** The item. A random pickup shows this one in MapMaker; in play it rolls a weapon of its category instead. */
  item: ContentId,
  /** Overrides the item's default respawn time; null = item default. */
  respawnSeconds: number().min(1).max(600).nullable().default(null),
  /**
   * Random from category (v24): a weapon pickup that rolls a weapon of this category (sim/weapons.ts
   * WEAPON_CATEGORIES) each time it comes back, the same roll for host and clients (sim/pickupRoll.ts).
   * Absent: the item as placed.
   */
  random: _enum(WEAPON_CATEGORIES).optional(),
  /** Keep fixed (v24): the host's "Mix up weapon pickups" leaves this pickup as placed. */
  keepFixed: boolean().optional()
});
const Yaw = number().finite().default(0);
const TeamFilter = string().regex(/^[a-z0-9_.]{2,64}$/).optional();
const DOOR_STYLES = ["sliding", "blast", "saloon", "vault", "portcullis", "oak"];
const DOOR_STYLE_LABELS = { sliding: "Sliding steel", blast: "Blast door", saloon: "Saloon doors", vault: "Vault door", portcullis: "Portcullis", oak: "Oak door (iron-bound)" };
const DoorEntity = EntityBase.extend({
  kind: literal("door"),
  yaw: Yaw,
  /** Look (absent: sliding). */
  style: _enum(DOOR_STYLES).optional(),
  startOpen: boolean().default(false),
  locked: boolean().default(false),
  /** Opens by itself when a player comes close (if unlocked). Otherwise players press E, or logic opens it. */
  auto: boolean().default(true),
  /** Only this team opens it (by walking up or pressing E); logic still opens it for everyone. */
  team: TeamFilter
});
const ButtonEntity = EntityBase.extend({
  kind: literal("button"),
  yaw: Yaw,
  /** Prompt shown to the player, e.g. "Open the gate". */
  label: string().max(40).default("Press"),
  once: boolean().default(false),
  cooldownSeconds: number().min(0.2).max(60).default(1),
  startEnabled: boolean().default(true),
  /** Only this team can press it. */
  team: TeamFilter
});
const DESTRUCTIBLE_MODELS = ["crate", "barrel", "wall", "glass", "boards", "gas", "generator"];
const DestructibleEntity = EntityBase.extend({
  kind: literal("destructible"),
  model: _enum(DESTRUCTIBLE_MODELS),
  yaw: Yaw,
  /** Overrides the model's default health; null = default. */
  health: number().min(1).max(5e3).nullable().default(null),
  /** Only explosions hurt it (a reinforced wall you have to blow open). */
  explosiveOnly: boolean().default(false)
});
const ZoneEntity = EntityBase.extend({
  kind: literal("zone"),
  size: tuple([number().min(0.5).max(64), number().min(0.5).max(32), number().min(0.5).max(64)]).default([4, 3, 4]),
  /** any: every player entering; count: once `count` players are inside; all: once every living player is inside. */
  who: _enum(["any", "count", "all"]).default("any"),
  count: number().int().min(1).max(32).default(1),
  startEnabled: boolean().default(true),
  /** Only this team's players count (enter, leave, "all" means all of that team). */
  team: TeamFilter,
  /**
   * Low-gravity zone (Style Packs): gravity inside is this multiple of the
   * map's (0.35 = drifting reactor core, 2 = crushing). Applies to movement
   * on the server and in prediction alike, whatever the zone's logic state.
   * Absent: no change.
   */
  gravity: number().min(0.1).max(3).optional()
});
const TRAP_KINDS = ["spikes", "flames", "crusher", "mine", "laser", "shock"];
const TRAP_ACTIVATIONS = ["always", "cycle", "proximity", "logic"];
const TrapEntity = EntityBase.extend({
  kind: literal("trap"),
  trap: _enum(TRAP_KINDS),
  yaw: Yaw,
  activation: _enum(TRAP_ACTIVATIONS).default("cycle"),
  onSeconds: number().min(0.2).max(60).default(2),
  offSeconds: number().min(0.2).max(600).default(2),
  /** Shifts a cycling trap's timing so a row of traps can ripple. */
  offsetSeconds: number().min(0).max(60).default(0),
  startEnabled: boolean().default(true),
  /** Overrides the trap's default damage; null = default. */
  damage: number().min(1).max(1e3).nullable().default(null),
  /** Electric fence (`shock`): length of the run in metres along its local X, posts every 4 m (absent: 12). */
  length: number().min(2).max(96).optional(),
  /**
   * Look (Style Packs): a crusher drawn as `rockfall` is a clump of boulders
   * hanging over the spot (no frame) that drops when it fires: falling rocks
   * (06 Jungle Ruins). Looks only: it hurts and times like any crusher.
   */
  style: _enum(["rockfall"]).optional()
});
const FactionId = string().regex(/^[a-z0-9_]{2,32}$/, "faction IDs are 2-32 chars of [a-z0-9_]");
const squadCount = number().int().min(0).max(16);
const ENCOUNTER_ENTRANCES = ["none", "vent", "hatch", "burrow", "breach"];
const EncounterEntity = EntityBase.extend({
  kind: literal("encounter"),
  yaw: Yaw,
  faction: FactionId.default("syndicate"),
  // Snipers and creatures are optional (missing = none), so older maps load unchanged.
  roster: object({
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
    titan: squadCount.optional()
  }).default({ trooper: 2, gunner: 1, heavy: 0 }),
  activeCap: number().int().min(1).max(32).default(4),
  reinforcements: number().int().min(0).max(500).default(0),
  /** Extra reinforcements for each player beyond the first (co-op scaling). */
  perPlayer: number().int().min(0).max(16).default(1),
  respawnSeconds: number().min(0.5).max(120).default(4),
  /** Spawn area radius around the position. */
  radius: number().min(1).max(16).default(3),
  order: _enum(SQUAD_ORDERS).default("hold"),
  /** Point of interest for defend/patrol orders (any entity). */
  orderTarget: StableId.nullable().default(null),
  /** Patrol order (v23): walk this path (a `route` or `road` path's id) instead of to the target and back. Absent: none. */
  route: string().min(1).max(64).optional(),
  startActive: boolean().default(true),
  difficulty: _enum(["easy", "normal", "hard"]).default("normal"),
  /** Multipliers on the roles' own health and damage, and their body size (hitbox too); absent = 1. */
  health: number().min(0.25).max(10).optional(),
  damage: number().min(0).max(5).optional(),
  size: number().min(0.5).max(2.5).optional(),
  /** Missing = none. */
  entrance: _enum(ENCOUNTER_ENTRANCES).optional(),
  /** A vent's height above the point (missing = 3.5 m, just under a standard ceiling). */
  ventHeight: number().min(2).max(12).optional()
});
const PropEntity = EntityBase.extend({
  kind: literal("prop"),
  model: ContentId,
  /** Free rotation in radians (MapMaker snaps to 15°). */
  yaw: Yaw,
  scale: number().min(0.25).max(4).default(1),
  /** Collides with players, shots and bots (if the prop has a collision box at all). */
  solid: boolean().default(true),
  /** Its own health (v36): it can be shot apart at this much damage, whatever the catalogue says. Absent: the catalogue's, or its size and material's on a map with `metadata.destruction`. */
  health: number().min(1).max(1e5).optional(),
  /** Never breaks (v36), whatever the catalogue or the map's `destruction` says: cover the author wants kept. */
  unbreakable: boolean().optional(),
  /**
   * An environment species' variant (`model: 'env.…'`, content/environment.ts): its index (material variants
   * such as summer, autumn, snow share the species' shapes). Absent: the species' first. Other props ignore it.
   */
  variant: number().int().min(0).max(255).optional(),
  tint: string().regex(/^#[0-9a-f]{6}$/).nullable().default(null)
});
const MountEntity = EntityBase.extend({
  kind: literal("mount"),
  /** A placeable mount, or a retired vehicle's id (a map made with one: it plays as its replacement, mountAliases.ts). */
  model: _enum([...MOUNT_MODELS, ...RETIRED_MOUNT_MODELS]),
  yaw: Yaw,
  /** Sentries shoot this team's enemies (null: everyone); vehicles and turrets given a team wear its colour (skin `auto`). */
  faction: FactionId.nullable().default(null),
  /** Override the respawn delay after it is destroyed (null: the mount's own). */
  respawnSeconds: number().min(5).max(600).nullable().default(null),
  /** Paint (see MOUNT_SKINS): automatic, factory, desert, forest, snow, urban or team colour. */
  skin: _enum(MOUNT_SKINS).optional(),
  /**
   * Vehicles (v21): rides on water. Over water or swamp it floats at the surface, sitting its
   * `draft` in it (see MountDef.vehicle.draft), drives a little slower and slides more, and runs up
   * the shore onto land; without it a vehicle sinks to the bed. Lava and acid still take it.
   */
  onWater: boolean().optional()
});
const AIRDROP_MODES = ["off", "start", "always"];
const AIR_CRAFTS = ["plane", "dropship"];
const AIR_CRAFT_LABELS = { plane: "Drop Carrier", dropship: "Dropship" };
const AirplaneEntity = EntityBase.extend({
  kind: literal("airplane"),
  route: array(tuple([number().min(-2e3).max(2e3), number().min(-2e3).max(2e3)])).min(2).max(32),
  altitude: number().min(15).max(400).default(70),
  loopSeconds: number().min(10).max(600).default(60),
  closed: boolean().default(true),
  airdrop: _enum(AIRDROP_MODES).default("off"),
  /** What flies it (absent: the transport plane). Additive: older maps are valid as they are. */
  craft: _enum(AIR_CRAFTS).optional()
});
const PadEntity = EntityBase.extend({
  kind: literal("pad"),
  yaw: Yaw,
  power: number().min(2).max(40).default(14),
  push: number().min(0).max(40).default(6)
});
const LADDER_STYLES = ["rungs", "vines"];
const LADDER_STYLE_LABELS = { rungs: "Wooden ladder", vines: "Climbing vines" };
const LadderEntity = EntityBase.extend({
  kind: literal("ladder"),
  yaw: Yaw,
  height: number().min(1).max(24).default(4),
  width: number().min(0.5).max(3).default(0.9),
  /** Look (absent: rungs). */
  style: _enum(LADDER_STYLES).optional()
});
const BLOCK_BEHAVIOURS = ["solid", "breakable", "crumble", "trapdoor"];
const BlockEntity = EntityBase.extend({
  kind: literal("block"),
  /** Width and depth down to 5 cm (glass panes); sheets that thin collide like any block. */
  size: tuple([number().min(0.05).max(64), number().min(0.1).max(32), number().min(0.05).max(64)]).default([4, 0.5, 4]),
  yaw: Yaw,
  /** A material from the library (null: the theme's solid material). */
  material: ContentId.nullable().default(null),
  tint: string().regex(/^#[0-9a-f]{6}$/).nullable().default(null),
  behaviour: _enum(BLOCK_BEHAVIOURS).default("solid"),
  /** step: stepping on it sets off a crumble or trapdoor; logic: only a rule's "destroy" does. */
  trigger: _enum(["step", "logic"]).default("step"),
  delaySeconds: number().min(0).max(10).default(0.8),
  respawnSeconds: number().min(1).max(600).nullable().default(8),
  /** Breakable blocks: hit points. */
  health: number().min(1).max(5e3).default(120),
  /**
   * Tilt (v20): pitch turns the block about its own X axis (its +Z end rises
   * for positive values), roll about its own Z axis (+X end rises). Radians,
   * at most 45° each; ramps, roofs, toppled wrecks. Absent = level.
   */
  pitch: number().min(-Math.PI / 4).max(Math.PI / 4).optional(),
  roll: number().min(-Math.PI / 4).max(Math.PI / 4).optional(),
  /** Starts gone (v20): logic "Rebuild block" or "Enable" makes it appear (a bridge that extends). */
  startHidden: boolean().optional(),
  /**
   * Force field (Style Packs): a glowing, humming barrier that stops players
   * and vehicles but lets shots, grenades and sight through. Logic switches it
   * like any block ("Drop / crumble block" or Disable switches it off,
   * "Rebuild block" or Enable on). Solid behaviour only.
   */
  field: boolean().optional(),
  /**
   * Glass (glass panes): a see-through panel that stops players but lets
   * sight through. Breakable glass shatters when shot; reinforced glass stops
   * shots and cracks. Solid behaviour only.
   */
  glass: _enum(GLASS_KINDS).optional()
});
const LIQUIDS = ["water", "lava", "acid", "swamp"];
const WaterEntity = EntityBase.extend({
  kind: literal("water"),
  size: tuple([number().min(0.5).max(512), number().min(0.2).max(64), number().min(0.5).max(512)]).default([8, 2, 8]),
  liquid: _enum(LIQUIDS).default("water"),
  /** Colour override (v20): green acid, murky sewer water. Absent = the liquid's own colour. */
  tint: string().regex(/^#[0-9a-f]{6}$/).optional()
});
const FlagEntity = EntityBase.extend({
  kind: literal("flag"),
  yaw: Yaw,
  /** Team (faction ID, as for spawns) whose flag stands here. */
  team: string().regex(/^[a-z0-9_.]{2,64}$/)
});
const SectorEntity = EntityBase.extend({
  kind: literal("sector"),
  yaw: number().finite().default(0),
  order: number().int().min(1).max(BREAKTHROUGH_MAX_SECTORS).default(1),
  /** How many of its targets must be destroyed for it to fall ("2 of 4"); absent: all of them. */
  need: number().int().min(1).max(32).optional(),
  /** Seconds it puts on the clock (the first sector's to start with, each next one's when the one before falls); absent: the match's sector time. */
  seconds: number().int().min(30).max(1800).optional()
});
const BREAKTHROUGH_OBJECTIVES = ["zone", "target", "final"];
const ObjectiveEntity = EntityBase.extend({
  kind: literal("objective"),
  objective: _enum(BREAKTHROUGH_OBJECTIVES).default("zone"),
  yaw: number().finite().default(0),
  /** The sector it belongs to (that sector's order). */
  sector: number().int().min(1).max(BREAKTHROUGH_MAX_SECTORS).default(1),
  /** Its short name on the HUD and the map ("A1", "B3", "C"). */
  label: string().min(1).max(3).default("A"),
  /** Zones: the zone's radius; targets: how close you must stand to plant or defuse (m). */
  radius: number().min(1).max(20).default(5),
  /** Zones: seconds one attacker alone takes to capture it (more are quicker); absent: 20, a final hold 40. */
  seconds: number().int().min(5).max(300).optional()
});
const HillEntity = EntityBase.extend({
  kind: literal("hill"),
  radius: number().min(2).max(20).default(5)
});
const BombsiteEntity = EntityBase.extend({
  kind: literal("bombsite"),
  label: string().min(1).max(2).default("A"),
  radius: number().min(2).max(12).default(4)
});
const HostageEntity = EntityBase.extend({
  kind: literal("hostage"),
  yaw: Yaw
});
const RescueEntity = EntityBase.extend({
  kind: literal("rescue"),
  radius: number().min(2).max(12).default(4)
});
const LIGHT_FIXTURES = ["none", "ceiling", "wall", "bulb", "strip", "sign", "billboard", "candle", "chandelier"];
const LightEntity = EntityBase.extend({
  kind: literal("light"),
  yaw: Yaw,
  color: string().regex(/^#[0-9a-f]{6}$/, "light colours are lowercase #rrggbb").default("#fff1d6"),
  intensity: number().min(0.1).max(5).default(1),
  range: number().min(1).max(30).default(10),
  fixture: _enum(LIGHT_FIXTURES).default("ceiling"),
  /** Starts switched off (v20; logic "Light on" switches it on). */
  off: boolean().optional(),
  /** Starts blinking this many times a second (v20; alarms, failing tubes). Absent = steady. */
  blink: number().min(0.2).max(10).optional(),
  /** Sign and billboard fixtures (Style Packs): the words lit up on it. */
  text: string().max(24).optional(),
  /** Sign and billboard fixtures: width and height in metres (signs 2.4 × 0.8, billboards 6 × 3.4 by default). */
  size: tuple([number().min(0.4).max(24), number().min(0.3).max(16)]).optional()
});
const MOVER_MODES = ["loop", "pingpong", "trigger"];
const MoverEntity = EntityBase.extend({
  kind: literal("mover"),
  yaw: Yaw,
  blocks: array(StableId).min(1).max(32),
  /**
   * Props that ride along (Style Packs: a locomotive on its chassis blocks, a
   * mine cart): drawn moving with the blocks, never colliding themselves (they
   * must not be solid; the blocks are what you stand on and bump into).
   */
  props: array(StableId).max(16).optional(),
  points: array(Vec3Tuple).min(2).max(16),
  angles: array(number().min(-Math.PI).max(Math.PI)).max(16).optional(),
  mode: _enum(MOVER_MODES).default("pingpong"),
  /** Metres per second along the way. */
  speed: number().min(0.2).max(40).default(3),
  /** Degrees per second when turning (drawbridges). */
  turnSpeed: number().min(5).max(360).default(45),
  wait: number().min(0).max(120).default(2),
  /** Loop and pingpong movers run from the start (logic Enable/Disable starts and parks them). */
  startActive: boolean().default(true)
});
const PortalEntity = EntityBase.extend({
  kind: literal("portal"),
  yaw: Yaw,
  size: tuple([number().min(1.2).max(8), number().min(2.2).max(8)]).default([2.4, 3.2]),
  /** Pair ID: the two portals sharing it lead into each other. */
  pair: string().regex(/^[a-z0-9_]{1,32}$/, "pair IDs are 1-32 chars of [a-z0-9_]"),
  startEnabled: boolean().default(true),
  color: string().regex(/^#[0-9a-f]{6}$/).optional(),
  /**
   * How its swirl is drawn: `pack` (absent: the pack's gate effect in the pair's colour, where it has a place) or
   * `painted` (always the game's own painted spiral, in the pair's colour: a dark hole for a dark colour, such as
   * Pantry Raid's mouse holes). Looks only; optional, so no format bump (an older client drops it and draws `pack`).
   */
  swirl: _enum(["pack", "painted"]).optional()
});
const ZiplineEntity = EntityBase.extend({
  kind: literal("zipline"),
  end: tuple([number().min(-400).max(400), number().min(-200).max(200), number().min(-400).max(400)]),
  height: number().min(2.5).max(8).default(3.6),
  speed: number().min(3).max(30).default(12),
  twoWay: boolean().default(false),
  team: TeamFilter,
  sag: number().min(0).max(0.1).default(0.03)
});
const MapEntity = discriminatedUnion("kind", [SpawnEntity, PickupEntity, DoorEntity, ButtonEntity, DestructibleEntity, ZoneEntity, TrapEntity, EncounterEntity, PropEntity, MountEntity, PadEntity, BlockEntity, WaterEntity, FlagEntity, HillEntity, LadderEntity, BombsiteEntity, HostageEntity, RescueEntity, LightEntity, AirplaneEntity, MoverEntity, PortalEntity, ZiplineEntity, SectorEntity, ObjectiveEntity]);
const RELATIONS = ["ally", "neutral", "enemy"];
const Faction = object({
  id: FactionId,
  name: string().min(1).max(40),
  color: string().regex(/^#[0-9a-f]{6}$/).default("#d04a3a"),
  relations: record(FactionId, _enum(RELATIONS)).default({})
});
const Terrain = object({
  origin: tuple([number().finite(), number().finite()]),
  spacing: number().min(0.5).max(8),
  cols: number().int().min(2).max(MAX_TERRAIN_VERTS),
  rows: number().int().min(2).max(MAX_TERRAIN_VERTS),
  baseY: number().finite().default(0),
  heights: array(number().int().min(-5e3).max(2e4)),
  materials: array(number().int().min(0).max(TERRAIN_MATERIALS.length - 1)),
  boundary: boolean().default(true),
  /** Plant cover per cell, 0 (bare) to 4 (lush, with bushes); empty = chosen from each cell's material. */
  foliage: array(number().int().min(0).max(4)).default([])
}).refine((t) => t.heights.length === t.cols * t.rows, "terrain needs cols × rows heights").refine((t) => t.foliage.length === 0 || t.foliage.length === (t.cols - 1) * (t.rows - 1), "terrain foliage needs a value for every cell").refine((t) => t.materials.length === (t.cols - 1) * (t.rows - 1), "terrain needs a material for every cell");
const BOUNDARY_STYLES = ["invisible", "wall", "fence"];
const MapBounds = object({
  min: tuple([number().finite(), number().finite()]),
  max: tuple([number().finite(), number().finite()]),
  style: _enum(BOUNDARY_STYLES).default("invisible"),
  /** Wall height above the lowest floor (m); invisible walls always reach high enough. */
  height: number().min(1).max(60).default(8)
}).refine((b) => b.max[0] - b.min[0] >= 4 && b.max[1] - b.min[1] >= 4, "the boundary must be at least 4 m across");
const TRACK_SURFACES = ["asphalt", "dirt"];
const RACE_VEHICLES = ["hover_bike", "speeder", "troop_buggy"];
const RaceVehicleId = _enum(["kart", "buggy", ...RACE_VEHICLES]).default("hover_bike");
object({
  points: array(Vec3Tuple).min(2).max(200),
  width: number().min(5).max(30).default(12),
  loop: boolean().default(true),
  surface: _enum(TRACK_SURFACES).default("asphalt"),
  /** Red-and-white curbs along both edges. */
  curbs: boolean().default(true),
  /**
   * Ambient cars: this many NPC-driven vehicles lapping the track in every
   * mode (no team: they run anyone over, and anyone can shoot them up or
   * take the wheel). Wrecked ones come back in the pit lane.
   */
  ambient: number().int().min(0).max(12).default(0),
  ambientVehicle: RaceVehicleId,
  /** Where wrecked ambient cars come back (lined up behind it, facing down the road); null: just off the road by the start line. */
  pit: Vec3Tuple.nullable().default(null)
});
const PATH_STYLES = ["asphalt", "concrete", "cobble", "flagstone", "gravel", "dirt", "sand", "planks"];
const PATH_USES = ["road", "race", "route"];
const PATROL_STYLES = ["loop", "back_and_forth"];
const PATH_CURVES = ["smooth", "classic"];
const RaceSettings = object({
  /** Red-and-white curbs along both edges. */
  curbs: boolean().default(true),
  /**
   * Ambient cars: this many NPC-driven vehicles lapping the track in every
   * mode (no team: they run anyone over, and anyone can shoot them up or
   * take the wheel). Wrecked ones come back in the pit lane.
   */
  ambient: number().int().min(0).max(12).default(0),
  ambientVehicle: RaceVehicleId,
  /** Where wrecked ambient cars come back (lined up behind it, facing down the road); null: just off the road by the start line. */
  pit: Vec3Tuple.nullable().default(null)
});
const MapPath = object({
  id: string().min(1).max(64),
  points: array(Vec3Tuple).min(2).max(200),
  /** A loop: the last point joins back to the first ("join ends"). */
  closed: boolean().default(false),
  uses: array(_enum(PATH_USES)).min(1).max(3).default(["road"]),
  width: number().min(0.5).max(30).default(3),
  style: _enum(PATH_STYLES).default("dirt"),
  lay: boolean().default(true),
  /** Traffic only in point order: vehicle bots never drive it the other way, patrols never turn back. */
  oneWay: boolean().optional(),
  /** Speed hint for drivers (m/s): bots driving along it keep under it. Absent: none. */
  speed: number().min(2).max(80).optional(),
  /** Routes: how NPCs walk it (absent: round a closed path, there and back on an open one). */
  patrol: _enum(PATROL_STYLES).optional(),
  /** Race settings (absent: the defaults). */
  race: RaceSettings.optional(),
  /** Absent: smooth. */
  curve: _enum(PATH_CURVES).optional()
});
const BackdropSchema = object({
  sky: _enum(SKY_IDS),
  scenery: _enum(SCENERY_IDS),
  ground: _enum(BACKDROP_GROUNDS),
  haze: number().min(0).max(1).default(0.5),
  mist: number().min(0).max(1).optional(),
  /** Border just outside the boundary (see border.ts): cliffs, city blocks, an electric fence, forest or shoreline. Absent: none. */
  border: _enum(BORDER_STYLES).optional(),
  /** Per-side overrides of `border` (north = +Z edge, east = +X edge). */
  borderSides: object({ north: _enum(BORDER_STYLES).optional(), east: _enum(BORDER_STYLES).optional(), south: _enum(BORDER_STYLES).optional(), west: _enum(BORDER_STYLES).optional() }).optional()
});
const WeatherSchema = object({
  fall: _enum(PRECIPITATION),
  amount: number().min(0).max(1),
  wind: number().min(0).max(1),
  fog: number().min(0).max(1)
});
const BLOOD_AMOUNTS = ["off", "light", "heavy"];
const BloodSettings = object({
  color: string().regex(/^#[0-9a-f]{6}$/).default("#8a0b0b"),
  amount: _enum(BLOOD_AMOUNTS).default("light")
});
const DEFAULT_BLOOD = { color: "#8a0b0b", amount: "light" };
const TeamSetup = object({
  // Up to 48 a team (v29; 16 before): a large map's own layout (Iron Coast, 24 v 24 and more on dedicated hosts).
  sizes: array(number().int().min(1).max(48)).min(2).max(8)
});
const MapBotSet = object({
  name: string().max(40).default("Map bots"),
  fill: _enum(["random", "only"]).default("random"),
  entries: array(
    object({
      name: string().min(1).max(20),
      look: string().max(64).optional(),
      skill: _enum(["easy", "normal", "hard"]).optional(),
      style: _enum(["mixed", "arena", "tactical"]).optional(),
      team: number().int().min(0).max(7).optional(),
      squad: string().max(16).optional()
    })
  ).max(96)
});
const MapPhysics = object({
  gravity: number().min(0.2).max(3).default(1),
  fallDamage: boolean().default(false)
});
const GlassSettings = object({
  respawnSeconds: number().min(1).max(600).nullable().default(null)
});
const SET_PIECE_MATERIAL_ROLES = ["stone", "trim", "floor", "paving", "roof", "wood", "metal"];
[...SET_PIECE_MATERIAL_ROLES, "facade", "door", "glass"];
const SetPieceRoleValues = object({
  stone: SurfaceStyle.optional(),
  trim: SurfaceStyle.optional(),
  floor: SurfaceStyle.optional(),
  paving: SurfaceStyle.optional(),
  roof: SurfaceStyle.optional(),
  wood: SurfaceStyle.optional(),
  metal: SurfaceStyle.optional(),
  facade: _enum(FACADES).optional(),
  door: _enum(DOOR_STYLES).optional(),
  glass: _enum([...GLASS_KINDS, "none"]).optional()
});
const MaterialRef = object({ role: _enum(SET_PIECE_MATERIAL_ROLES) });
const PartSurface = union([SurfaceStyle, MaterialRef]);
const SetPieceTilePart = TilePlacement.omit({ id: true }).extend({
  kind: literal("tile"),
  x: number().int().min(-64).max(64),
  y: number().int().min(-64).max(64),
  z: number().int().min(-16).max(16),
  surfaces: object({ floor: PartSurface.optional(), walls: PartSurface.optional(), solids: PartSurface.optional(), underside: PartSurface.optional(), trim: PartSurface.optional(), roof: PartSurface.optional() }).optional(),
  glass: record(EdgeKey, union([_enum(GLASS_KINDS), object({ role: literal("glass") })])).optional(),
  options: object({
    layout: _enum(ROOM_LAYOUTS).optional(),
    floor: _enum(FLOOR_INSERTS).optional(),
    ceiling: _enum(CEILINGS).optional(),
    corners: _enum(CORNERS).optional(),
    facade: union([_enum(FACADES), object({ role: literal("facade") })]).optional()
  }).optional()
});
const SetPieceBlockPart = BlockEntity.omit({ id: true }).extend({
  material: union([ContentId, MaterialRef]).nullable().default(null),
  glass: union([_enum(GLASS_KINDS), object({ role: literal("glass") })]).optional()
});
const SetPieceDoorPart = DoorEntity.omit({ id: true }).extend({ style: union([_enum(DOOR_STYLES), object({ role: literal("door") })]).optional() });
const SetPiecePart = discriminatedUnion("kind", [SetPieceTilePart, SetPieceBlockPart, PropEntity.omit({ id: true }), SetPieceDoorPart, LadderEntity.omit({ id: true }), LightEntity.omit({ id: true })]);
const SetPiecePort = object({
  side: _enum(["N", "E", "S", "W"]),
  cell: tuple([number().int(), number().int()]),
  level: number().int(),
  /** `door`: a doorway; `opening`: open (an arch, a passage's end, open floor). */
  kind: _enum(["door", "opening"])
});
const SetPieceMarker = object({
  name: string().regex(/^[a-z0-9_]{1,32}$/),
  kind: _enum(["doorPair", "spot"]),
  parts: array(number().int().min(0).max(1023)).min(1).max(16)
});
const SetPieceDefId = string().regex(/^(setpiece|local)\.[a-z0-9_]{1,40}$/, 'set piece ids look like "setpiece.name" (shipped) or "local.name" (one a map carries)');
const SetPieceDefinition = object({
  id: SetPieceDefId,
  displayName: string().min(1).max(60),
  family: string().regex(/^[a-z0-9_]{1,32}$/),
  /** Palette group in MapMaker's Set pieces tab. */
  category: string().min(1).max(40),
  blurb: string().max(240).optional(),
  /** The role packs it suits (content/setpieces/roles.json): MapMaker offers it with these. */
  packs: array(string().regex(/^[a-z0-9_]{2,32}$/)).max(32).default([]),
  /** What it claims on the grid: these cells (dx, dy) on every level from levels[0] to levels[1] (dz). */
  footprint: object({
    cells: array(tuple([number().int().min(-32).max(32), number().int().min(-32).max(32)])).min(1).max(256),
    levels: tuple([number().int().min(-8).max(8), number().int().min(-8).max(8)])
  }),
  /** `free`: it can be placed mirrored (east and west swapped); `none`: it can't (an asymmetric tile in it has no mirrored twin). */
  mirror: _enum(["free", "none"]).default("free"),
  /** Its own value for a role no pack gives (else the theme's). */
  roles: SetPieceRoleValues.optional(),
  ports: array(SetPiecePort).max(256).default([]),
  parts: array(SetPiecePart).min(1).max(1024),
  markers: array(SetPieceMarker).max(64).optional()
});
const SetPieceId = string().regex(/^[A-Za-z0-9_-]{4,48}$/, "set piece IDs must be 4-48 chars of [A-Za-z0-9_-]");
const SetPiecePlacement = object({
  id: SetPieceId,
  piece: SetPieceDefId,
  x: number().int().min(-MAX_TILE_CELL).max(MAX_TILE_CELL),
  y: number().int().min(-MAX_TILE_CELL).max(MAX_TILE_CELL),
  z: number().int().min(-MAX_TILE_LEVEL).max(MAX_TILE_LEVEL),
  rotation: Rotation.default(0),
  /** East and west swapped (in the piece's own frame, before the turn), in place over the same footprint. */
  mirror: boolean().default(false),
  /** The role pack that themes it (content/setpieces/roles.json); absent: the one for the map's theme, if any. */
  pack: string().regex(/^[a-z0-9_]{2,32}$/).optional(),
  /** Small per-placement tweaks: a role's value, or parts left out (by index). */
  overrides: object({ roles: SetPieceRoleValues.optional(), hide: array(number().int().min(0).max(1023)).max(1024).optional() }).optional()
});
const MapGroup = object({
  id: StableId,
  /** What MapMaker calls it ("West base"); absent: "Group". */
  name: string().min(1).max(40).optional(),
  members: array(StableId).min(2).max(2048)
});
const EditorNote = object({
  id: StableId,
  position: Vec3Tuple,
  text: string().min(1).max(500)
});
const BOT_HINT_KINDS = ["choke", "sniper", "camp", "staging", "jump"];
const BotHint = object({
  id: StableId,
  kind: _enum(BOT_HINT_KINDS),
  position: Vec3Tuple,
  yaw: number().finite().optional(),
  radius: number().finite().min(0.5).max(40),
  team: string().regex(/^[a-z0-9_.]{2,64}$/).optional(),
  /** A jump's landing (jump links only). */
  to: Vec3Tuple.optional()
}).refine((h) => h.kind === "jump" === (h.to !== void 0), { message: "a jump link has a `to`, and only a jump link does", path: ["to"] });
const MapDocument = object({
  format: literal(MAP_FORMAT),
  formatVersion: literal(MAP_FORMAT_VERSION),
  metadata: MapMetadata,
  classicStructure: ClassicStructure,
  entities: array(MapEntity).max(4096),
  /** NPC factions. Empty means the default enemy faction ("Syndicate"). */
  factions: array(Faction).max(16).default([]),
  /** Scenario logic: variables, timers, objectives and WHEN -> IF -> DO rules. */
  logic: ScenarioLogic.default({ variables: [], timers: [], objectives: [], rules: [] }),
  /** Outdoor terrain (grass, dirt, stone… with hills and cliffs), or none. */
  terrain: Terrain.nullable().default(null),
  /** Walls round the play area, or none. */
  bounds: MapBounds.nullable().default(null),
  /** Paths: roads, streets and trails, the race track and AI routes (PATH_USES). Absent: none. */
  paths: array(MapPath).max(64).optional(),
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
  botCast: array(string().min(1).max(24)).max(8).optional(),
  /**
   * The map's default weapon set (v28; sim/weaponSets.ts, content/weapon-sets.json: military, scifi, medieval, chaos,
   * mixed), set in MapMaker's Map properties: what a match here spawns with and its pickups hold, unless the host picks
   * another. Absent: Standard (the mode's own loadout, pickups as placed). An id this build has no set for plays
   * Standard and is flagged by validateMap.
   */
  weaponSet: string().regex(/^[a-z][a-z0-9_]{1,23}$/, 'weapon set ids look like "military"').optional(),
  /** Content packs this map needs, beyond the always-present core pack. */
  dependencies: array(object({ pack: ContentId, version: string().max(32) })).max(MAX_MAP_DEPENDENCIES).default([]),
  /**
   * Set pieces placed as one (v27): each expands into its parts when the map is loaded for play (map/setPieces.ts).
   * The entity and tile caps count these placements, not their parts. Absent: none.
   */
  setPieces: array(SetPiecePlacement).max(1024).optional(),
  /** Set pieces this map defines itself (v27, `local.*`: saved from a selection in MapMaker), so it plays anywhere. Absent: none. */
  setPieceDefs: array(SetPieceDefinition).max(64).optional(),
  /** MapMaker's groups (v31): things kept together while editing. Absent: none. Play ignores them. */
  groups: array(MapGroup).max(256).optional(),
  /** Notes for the map's makers, pinned on the map (v31): shown in MapMaker, never in play. Absent: none. */
  editorNotes: array(EditorNote).max(256).optional(),
  /** Bot hints (v33): chokepoints, sniper, camp and staging spots and jump links the maker marks for bots. Absent: none. */
  botHints: array(BotHint).max(256).optional(),
  /**
   * The time of day (v34; map/timeOfDay.ts), hours 0-24: the sun's place and light, and the sky blended between the
   * presets (night, dusk, sunrise, the map's own day sky, sunset). Fixed for the match. Absent: the sky's own look.
   */
  timeOfDay: number().min(0).max(24).optional(),
  /** Weather (v34; map/weather.ts): rain or snow, wind, fog banks. The host may play another. Absent: clear. */
  weather: WeatherSchema.optional()
});
const RESOURCE_BUDGETS = {
  // ---- checked before / while loading
  /** Raw map JSON, checked before parsing wherever a map arrives. */
  mapBytes: 2 * 1024 * 1024,
  /** Entities in the file (also the schema's cap). */
  entities: 4096,
  /** Vehicles, mounted guns and airplanes. */
  vehicles: 32,
  /** Destructibles plus blocks that break, crumble, drop or are glass. */
  destructibles: 1024,
  /** Scenario rules (also the schema's cap). */
  triggerRules: 256,
  // ---- enforced while the match runs
  /** NPCs alive at once, map-wide (each encounter also has its own activeCap ≤ 32). */
  activeNpcs: 64,
  /** NPCs spawned per second and per minute, map-wide (encounters and hordes). */
  npcSpawnsPerSecond: 32,
  npcSpawnsPerMinute: 256,
  /** Projectiles in flight (grenades, rockets, arrows…); past it the oldest bot/NPC projectile goes first. */
  activeProjectiles: 512,
  /** Scenario actions run per tick; the rest of a sequence resumes next tick. */
  triggerActionsPerTick: 2e3,
  /** Rule firings per tick; later events wait for the next tick. */
  ruleFiringsPerTick: 256,
  /** How often one rule may fire a second; more are dropped. */
  ruleFiringsPerSecond: 30,
  /** Events waiting for the next tick; more are dropped. */
  deferredEvents: 1024
};
function utf8Length(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 128) n += 1;
    else if (c < 2048) n += 2;
    else if (c >= 55296 && c <= 56319) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}
function resourceBudgetIssues(map) {
  const out = [];
  const count = (pred) => map.entities.filter(pred).length;
  const vehicles = count((e) => e.kind === "mount" || e.kind === "airplane");
  if (vehicles > RESOURCE_BUDGETS.vehicles) out.push({ severity: "error", code: "budget.vehicles", message: `${vehicles} vehicles and mounted guns: at most ${RESOURCE_BUDGETS.vehicles} per map` });
  const breakables = count((e) => e.kind === "destructible" || e.kind === "block" && (e.behaviour !== "solid" || !!e.glass) || !!map.metadata.destruction && isBreakableProp(e, true) || e.kind === "prop" && isEnvModel(e.model) && isBreakableProp(e));
  if (breakables > RESOURCE_BUDGETS.destructibles) out.push({ severity: "error", code: "budget.destructibles", message: `${breakables} destructibles and breakable blocks: at most ${RESOURCE_BUDGETS.destructibles} per map` });
  const npcCap = map.entities.reduce((n, e) => n + (e.kind === "encounter" ? e.activeCap : 0), 0);
  if (npcCap > RESOURCE_BUDGETS.activeNpcs) {
    out.push({ severity: "warning", code: "budget.npcs", message: `encounters allow ${npcCap} NPCs alive at once; matches keep it to ${RESOURCE_BUDGETS.activeNpcs} map-wide, so some squads will wait` });
  }
  for (const c of logicCycles(map.logic.rules)) {
    const names = c.map((r) => `"${r.name || r.id}"`);
    out.push({
      severity: "warning",
      code: "logic.cycle",
      message: `rules set each other off in a loop (${[...names, names[0]].join(" → ")}): it runs up to the per-tick limit every time; add a condition, a Wait or "once" to break it`,
      targetId: c[0].id
    });
  }
  return out;
}
function eventsOf(a) {
  switch (a.type) {
    case "set_var":
    case "add_var":
      return [{ event: "variable_changed", target: a.target }];
    case "objective":
      return a.state === "complete" ? [{ event: "objective_completed", target: a.target }] : [];
    case "destroy":
    case "disable":
    case "block_drop":
      return [{ event: "destroyed", target: a.target }];
    case "door_open":
      return [{ event: "door_opened", target: a.target }];
    case "door_close":
      return [{ event: "door_closed", target: a.target }];
    case "door_toggle":
      return [
        { event: "door_opened", target: a.target },
        { event: "door_closed", target: a.target }
      ];
    default:
      return [];
  }
}
function logicCycles(rules) {
  const live = rules.filter((r) => r.enabled && !r.once);
  const next = /* @__PURE__ */ new Map();
  for (const a of live) {
    const fired = [];
    for (const act of a.do) {
      if (act.type === "wait" && act.value > 0) break;
      fired.push(...eventsOf(act));
    }
    next.set(
      a.id,
      live.filter((b) => fired.some((f) => f.event === b.when.event && (b.when.target === null || b.when.target === f.target)))
    );
  }
  const index = /* @__PURE__ */ new Map();
  const low = /* @__PURE__ */ new Map();
  const stack = [];
  const onStack = /* @__PURE__ */ new Set();
  const out = [];
  let i = 0;
  const visit = (r) => {
    index.set(r.id, i);
    low.set(r.id, i++);
    stack.push(r);
    onStack.add(r.id);
    for (const n of next.get(r.id) ?? []) {
      if (!index.has(n.id)) {
        visit(n);
        low.set(r.id, Math.min(low.get(r.id), low.get(n.id)));
      } else if (onStack.has(n.id)) low.set(r.id, Math.min(low.get(r.id), index.get(n.id)));
    }
    if (low.get(r.id) !== index.get(r.id)) return;
    const comp = [];
    let x;
    do {
      x = stack.pop();
      onStack.delete(x.id);
      comp.push(x);
    } while (x.id !== r.id);
    if (comp.length > 1 || (next.get(r.id) ?? []).some((n) => n.id === r.id)) out.push(comp.reverse());
  };
  for (const r of live) if (!index.has(r.id)) visit(r);
  return out;
}
const GLASS = {
  /** Pane thickness (m): thin, but thick enough for the character controller. */
  thickness: 0.06,
  /** Breakable glass breaks at the first hit. */
  breakableHealth: 1,
  /** Reinforced glass soaks this much before it is fully cracked (it never breaks). */
  reinforcedHealth: 600,
  /** Share of its damage a round keeps for each breakable pane it shatters on the way (glass slows it a little). */
  passDamage: 0.8,
  /** Default tint (a slight sea-green, like float glass seen edge on). */
  tint: "#bfe3e8"
};
const GLASS_EDGES = new Set(GLASS_EDGE_STYLES);
function windowOpenings(style, height) {
  if (style === "none" || !GLASS_EDGES.has(style)) return [];
  return (EDGE_SHAPES[style]?.openings ?? []).map(([u0, u1, y0, y1]) => [u0, u1, y0, Math.min(y1, height)]);
}
function blockBox(e) {
  const [w, h, d] = e.size;
  return { center: { x: e.position[0], y: e.position[1] + h / 2, z: e.position[2] }, half: { x: w / 2, y: h / 2, z: d / 2 }, yaw: e.yaw };
}
const isGlassBlock = (e) => e.kind === "block" && !!e.glass && e.behaviour === "solid" && !e.field;
function windowPanes(map, catalog = coreCatalog) {
  if (!map.classicStructure.tiles.some((t) => t.glass && Object.keys(t.glass).length)) return [];
  const { cellSize, levelHeight } = map.classicStructure;
  const half = cellSize / 2;
  const v = TILE_DIMENSIONS.wallThickness / 2;
  const { cells } = buildOccupancy(map, catalog);
  const out = [];
  for (const [key, occ] of cells) {
    const glass = occ.placement.glass;
    if (!glass) continue;
    const [gx, gy, gz] = key.split(",").map(Number);
    for (const side of SIDES) {
      const ek = edgeKey(occ.local, localSide(side, occ.placement.rotation));
      const kind = glass[ek];
      if (!kind) continue;
      const style = resolveEdge(cells, gx, gy, gz, side);
      if (!GLASS_EDGES.has(style)) continue;
      const cx = gx * cellSize;
      const cz = gy * cellSize;
      const baseY = gz * levelHeight;
      windowOpenings(style, levelHeight).forEach(([u0, u1, y0, y1], n) => {
        const u = (u0 + u1) / 2;
        const hu = (u1 - u0) / 2;
        const hy = (y1 - y0) / 2;
        const t = GLASS.thickness / 2;
        const y = baseY + y0 + hy;
        const center = side === "N" ? { x: cx + u, y, z: cz + half - v } : side === "S" ? { x: cx + u, y, z: cz - half + v } : side === "E" ? { x: cx + half - v, y, z: cz + u } : { x: cx - half + v, y, z: cz + u };
        const halfBox = side === "N" || side === "S" ? { x: hu, y: hy, z: t } : { x: t, y: hy, z: hu };
        out.push({ id: `${occ.placement.id}:${ek}${n ? `:${n}` : ""}`, box: { center, half: halfBox, yaw: 0 }, kind });
      });
    }
  }
  return out;
}
function glassBlocks(map) {
  const out = [];
  map.entities.forEach((e, i) => {
    if (isGlassBlock(e)) out.push({ id: e.id, box: blockBox(e), kind: e.glass, entity: i, ...e.tint ? { tint: e.tint } : {} });
  });
  return out;
}
function rayOBox(origin, dir, maxDist, b) {
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  const ox = origin.x - b.center.x;
  const oz = origin.z - b.center.z;
  const lo = slab(0, maxDist, ox * c - oz * s, dir.x * c - dir.z * s, b.half.x);
  if (lo === null) return null;
  const lo2 = slab(lo[0], lo[1], origin.y - b.center.y, dir.y, b.half.y);
  if (lo2 === null) return null;
  const lo3 = slab(lo2[0], lo2[1], ox * s + oz * c, dir.x * s + dir.z * c, b.half.z);
  return lo3 === null ? null : lo3[0];
}
function slab(t0, t1, o, d, h) {
  if (Math.abs(d) < 1e-9) {
    if (o < -h || o > h) return null;
  } else {
    let u = (-h - o) / d;
    let w = (h - o) / d;
    if (u > w) {
      const x = u;
      u = w;
      w = x;
    }
    if (u > t0) t0 = u;
    if (w < t1) t1 = w;
    if (t0 > t1) return null;
  }
  span[0] = t0;
  span[1] = t1;
  return span;
}
const span = [0, 0];
const glassCracks = (healthPct) => Math.max(0, Math.min(1, 1 - healthPct / 100));
const paneCache = /* @__PURE__ */ new WeakMap();
function cachedWindowPanes(map) {
  let panes = paneCache.get(map);
  if (!panes) paneCache.set(map, panes = windowPanes(map));
  return panes;
}
function glassAt(map, i) {
  if (i >= map.entities.length) return cachedWindowPanes(map)[i - map.entities.length] ?? null;
  const e = map.entities[i];
  return e && isGlassBlock(e) ? { id: e.id, box: blockBox(e), kind: e.glass, entity: i, ...e.tint ? { tint: e.tint } : {} } : null;
}
const isKitModel = (model) => model.startsWith("kit.");
let byId;
const getKitFamily = (id) => (byId ??= new Map(KIT_FAMILIES.map((f) => [f.id, f]))).get(id);
function kitVariant(family, index) {
  return index !== void 0 && family.variants.find((v) => v.index === index) || family.variants[0];
}
function kitModelFile(model, variant) {
  const f = isKitModel(model) ? getKitFamily(model) : void 0;
  return f ? kitVariant(f, variant).file : void 0;
}
const kitSurfaceOf = (model) => isKitModel(model) ? getKitFamily(model)?.surface : void 0;
let aliases;
const propAlias = (model) => (aliases ??= new Map(KIT_ALIASES.map((a) => [a.from, a]))).get(model);
const FAMILY_DEFAULTS = {
  pistol: {
    ballistic: { velocity: 375, gravityScale: 1, energy: 450, tracerEvery: 0, tracerFinal: 0 },
    accuracy: { base: 2e-3, move: 6e-3, air: 0.02, perShot: 3e-3, tight: 1, max: 0.03, recovery: 10, ads: 0.6, adsTicks: 8 },
    kick: { pitch: [0.012], yaw: [2e-3, -2e-3], variance: 3e-3, delay: 4, settle: 12, rate: 0.35, visual: 0.5 },
    falloff: { start: 18, end: 45, min: 0.65, curve: "linear" },
    head: 2,
    legs: 0.8
  },
  // accuracy: A true first shot, but a round fired before the last one's spray has settled (about half a second) is a guess.
  revolver: {
    ballistic: { velocity: 300, gravityScale: 1, energy: 1800, tracerEvery: 1 },
    accuracy: { base: 5e-4, move: 0.012, air: 0.06, perShot: 0.022, tight: 0, max: 0.06, recovery: 3, ads: 0.5, adsTicks: 10 },
    kick: { pitch: [0.12], yaw: [0.012, -8e-3], variance: 8e-3, delay: 10, settle: 3.5, rate: 0.06, visual: 1.5 },
    falloff: { start: 25, end: 60, min: 0.7, curve: "smooth" },
    head: 1.75,
    legs: 0.85
  },
  machine_pistol: {
    ballistic: { velocity: 360, gravityScale: 1, energy: 350, tracerEvery: 4 },
    accuracy: { base: 0.012, move: 6e-3, air: 0.03, perShot: 6e-3, tight: 2, max: 0.08, recovery: 16, ads: 0.85, adsTicks: 8 },
    kick: {
      pitch: [6e-3],
      yaw: [3e-3, 4e-3, -2e-3, -4e-3],
      variance: 4e-3,
      delay: 3,
      settle: 14,
      rate: 0.3,
      visual: 0.4
    },
    falloff: { start: 8, end: 25, min: 0.5, curve: "steep" },
    head: 1.5,
    legs: 0.85
  },
  // accuracy: Dead steady for five rounds, then it climbs and blooms hard; let go and it is steady again almost at once.
  smg: {
    ballistic: { velocity: 400, gravityScale: 1, energy: 400, tracerEvery: 3, tracerFinal: 5 },
    accuracy: { base: 6e-3, move: 4e-3, air: 0.03, perShot: 65e-4, tight: 5, max: 0.09, recovery: 40, ads: 0.8, adsTicks: 10 },
    kick: {
      pitch: [3e-3, 3e-3, 3e-3, 3e-3, 3e-3, 6e-3, 8e-3, 0.01, 0.011],
      yaw: [0, 1e-3, 2e-3, 3e-3, 4e-3, 2e-3, -2e-3, -4e-3, -4e-3, -2e-3],
      variance: 4e-3,
      delay: 3,
      settle: 14,
      rate: 0.3,
      visual: 0.45
    },
    falloff: { start: 15, end: 35, min: 0.55, curve: "steep" },
    head: 1.5,
    legs: 0.85
  },
  rifle: {
    ballistic: { velocity: 820, gravityScale: 1, energy: 1200, tracerEvery: 3, tracerFinal: 3 },
    accuracy: {
      base: 15e-4,
      move: 8e-3,
      air: 0.035,
      perShot: 12e-4,
      tight: 3,
      max: 0.025,
      recovery: 8,
      ads: 0.4,
      adsTicks: 14
    },
    kick: {
      pitch: [0.01, 85e-4],
      yaw: [0, 1e-3, 2e-3, 2e-3, 1e-3, 0, -1e-3, -2e-3, -2e-3, -1e-3],
      variance: 2e-3,
      delay: 5,
      settle: 7,
      rate: 0.12,
      visual: 0.6
    },
    falloff: { start: 25, end: 70, min: 0.6, curve: "smooth" },
    head: 2,
    legs: 0.8
  },
  battle_rifle: {
    ballistic: { velocity: 880, gravityScale: 1, energy: 1800, tracerEvery: 2 },
    accuracy: { base: 1e-3, move: 0.02, air: 0.06, perShot: 4e-3, tight: 1, max: 0.03, recovery: 6, ads: 0.3, adsTicks: 16 },
    kick: { pitch: [0.03], yaw: [4e-3, -3e-3], variance: 4e-3, delay: 6, settle: 6, rate: 0.1, visual: 0.8 },
    falloff: { start: 40, end: 100, min: 0.8, curve: "smooth" },
    head: 2,
    legs: 0.85
  },
  marksman: {
    ballistic: { velocity: 900, gravityScale: 1, energy: 2e3, tracerEvery: 1 },
    accuracy: { base: 1e-3, move: 0.025, air: 0.07, perShot: 5e-3, tight: 0, max: 0.035, recovery: 5, ads: 0.3, adsTicks: 16 },
    kick: { pitch: [0.035], yaw: [3e-3, -3e-3], variance: 4e-3, delay: 6, settle: 6, rate: 0.1, visual: 0.8 },
    falloff: { start: 60, end: 150, min: 0.85, curve: "smooth" },
    head: 2,
    legs: 0.85
  },
  // ballistic: Fast (least lead of all) but heavy: 12 cm of drop at 100 m, half a metre at 200 m.
  // accuracy: A shot taken the moment the bolt closes is a little off; wait a beat and it is dead on (patience).
  precision: {
    ballistic: { velocity: 950, gravityScale: 2.5, energy: 3e3, tracerEvery: 1 },
    accuracy: { base: 0, move: 0.03, air: 0.1, perShot: 0.015, tight: 0, max: 0.05, recovery: 1.2, ads: 0.2, adsTicks: 18 },
    kick: { pitch: [0.07], yaw: [6e-3, -4e-3], variance: 5e-3, delay: 8, settle: 5, rate: 0.08, visual: 1.1 },
    falloff: { start: 150, end: 300, min: 0.9, curve: "linear" },
    head: 3,
    legs: 0.9
  },
  lmg: {
    ballistic: { velocity: 760, gravityScale: 1, energy: 1500, tracerEvery: 4 },
    accuracy: { base: 0.012, move: 0.03, air: 0.07, perShot: 12e-4, tight: 6, max: 0.045, recovery: 5, ads: 0.7, adsTicks: 20 },
    kick: {
      pitch: [5e-3],
      yaw: [2e-3, -1e-3, 1e-3, -2e-3],
      variance: 3e-3,
      delay: 4,
      settle: 6,
      rate: 0.12,
      visual: 0.45
    },
    falloff: { start: 30, end: 80, min: 0.7, curve: "smooth" },
    head: 1.5,
    legs: 0.85
  },
  // ballistic: Pellets stay hitscan (spec §3.1 allows it for performance): damage loss comes from spread and per-pellet falloff.
  // accuracy: The pellet pattern is the weapon's own `spread` (pelletCone); this is aim error on top of it.
  shotgun: {
    ballistic: null,
    accuracy: { base: 0, move: 6e-3, air: 0.02, perShot: 0, tight: 0, max: 0.04, recovery: 6, ads: 0.9, adsTicks: 10 },
    kick: { pitch: [0.06], yaw: [6e-3, -6e-3], variance: 4e-3, delay: 8, settle: 5, rate: 0.1, visual: 1 },
    falloff: { start: 8, end: 28, min: 0.25, curve: "steep" },
    head: 1.25,
    legs: 0.85
  }
};
const SURFACE_TYPE_LIST = [
  { id: "concrete", name: "Concrete", ballistic: "concrete", impact: { decal: "hole", debris: ["dust", "sparks"], sound: "hard" }, footstep: "hard" },
  { id: "stone", name: "Stone (dressed)", ballistic: "stone", impact: { decal: "hole", debris: ["dust", "sparks"], sound: "hard" }, footstep: "hard" },
  { id: "rock", name: "Rock (boulders, cliffs)", ballistic: "stone", impact: { decal: "hole", debris: ["dust", "chips", "sparks"], sound: "hard" }, footstep: "hard" },
  { id: "brick", name: "Brick", ballistic: "brick", impact: { decal: "hole", debris: ["dust", "chips", "sparks"], sound: "hard" }, footstep: "hard" },
  { id: "plaster", name: "Plaster and drywall", ballistic: "drywall", impact: { decal: "hole", debris: ["dust"], sound: "hard" }, footstep: "hard" },
  { id: "wood", name: "Wood", ballistic: "wood", impact: { decal: "hole", debris: ["dust", "splinters"], sound: "wood" }, footstep: "wood" },
  { id: "thin_wood", name: "Thin wood (boards, crates)", ballistic: "thin_wood", impact: { decal: "hole", debris: ["dust", "splinters"], sound: "wood" }, footstep: "wood" },
  { id: "bark", name: "Bark (trunks, stumps, logs)", ballistic: "heavy_wood", impact: { decal: "hole", debris: ["dust", "splinters"], sound: "wood" }, footstep: "wood" },
  { id: "foliage", name: "Foliage (bushes, crowns)", ballistic: "foliage", impact: { decal: "none", debris: ["dust", "leaves"], sound: "soft" }, footstep: "foliage" },
  { id: "metal", name: "Metal (heavy)", ballistic: "metal", impact: { decal: "hole", debris: ["dust", "sparks"], sound: "metal" }, footstep: "metal" },
  { id: "sheet_metal", name: "Sheet metal (containers, vehicles)", ballistic: "thin_metal", impact: { decal: "hole", debris: ["dust", "sparks"], sound: "metal" }, footstep: "metal" },
  { id: "glass", name: "Glass", ballistic: "glass", impact: { decal: "hole", debris: ["dust", "chips"], sound: "glass" }, footstep: "hard" },
  { id: "dirt", name: "Dirt and mud", ballistic: "soil", impact: { decal: "hole", debris: ["dust"], sound: "soft" }, footstep: "soft" },
  { id: "grass", name: "Grass and moss", ballistic: "soil", impact: { decal: "hole", debris: ["dust"], sound: "soft" }, footstep: "soft" },
  { id: "sand", name: "Sand", ballistic: "soil", impact: { decal: "hole", debris: ["dust"], sound: "soft" }, footstep: "sand" },
  { id: "gravel", name: "Gravel", ballistic: "soil", impact: { decal: "hole", debris: ["dust", "chips"], sound: "hard" }, footstep: "gravel" },
  { id: "snow", name: "Snow", ballistic: "soil", impact: { decal: "hole", debris: ["dust"], sound: "soft" }, footstep: "snow" },
  { id: "water", name: "Water", ballistic: "water", impact: { decal: "none", debris: [], sound: "water" }, footstep: "water" },
  { id: "flesh", name: "Flesh", ballistic: "flesh", impact: { decal: "none", debris: [], sound: "none" } },
  { id: "fabric", name: "Fabric (canvas, carpet, tents)", ballistic: "drywall", impact: { decal: "hole", debris: ["dust"], sound: "soft" }, footstep: "soft" },
  { id: "plastic", name: "Plastic", ballistic: "drywall", impact: { decal: "hole", debris: ["dust", "chips"], sound: "hard" }, footstep: "hard" },
  { id: "armor", name: "Armour plate (vaults, bulletproof glass)", ballistic: "armor", impact: { decal: "hole", debris: ["dust", "sparks"], sound: "metal" }, footstep: "metal" },
  { id: "energy", name: "Energy (force fields)", ballistic: "energy", impact: { decal: "none", debris: ["sparks"], sound: "none" } }
];
const SURFACE_GUESS = {
  fallback: "concrete",
  words: [
    ["metal", ["metal", "steel", "iron", "container", "barrel", "drum", "tank", "pipe", "vehicle", "truck", "car_", "_car", "bus", "train", "rail", "crane", "excavator", "machine", "sci", "orbital", "station", "space", "hangar", "gantry", "catwalk", "grate", "locker", "generator", "turret", "fence_metal", "sign", "lamp", "neon", "industrial", "factory"]],
    ["wood", ["wood", "timber", "plank", "crate", "pallet", "log", "cabin", "barn", "shack", "stall", "cart", "wagon", "fence", "table", "bench", "chair", "shelf", "door", "dock", "pier", "boat", "ship", "frontier", "wild_west", "ww_", "saloon", "medieval", "mv_"]],
    ["dirt", ["dirt", "sand", "mud", "grass", "soil", "hay", "sandbag", "earth", "ground", "desert", "dune", "snow", "jungle_floor"]]
  ]
};
const PROP_SURFACES = {
  "prop.pine": "bark",
  "prop.pine_crooked": "bark",
  "prop.rocks_tall": "rock",
  "prop.oak": "bark",
  "prop.oak_dark": "bark",
  "prop.oak_autumn": "bark",
  "prop.tree_round": "bark",
  "prop.tree_round_dark": "bark",
  "prop.tree_round_autumn": "bark",
  "prop.tree_fat": "bark",
  "prop.tree_detailed": "bark",
  "prop.tree_cone": "bark",
  "prop.tree_plateau": "bark",
  "prop.tree_thin": "bark",
  "prop.tree_blocks": "bark",
  "prop.tree_small": "bark",
  "prop.pine_tall": "bark",
  "prop.pine_tall_b": "bark",
  "prop.pine_round": "bark",
  "prop.pine_small": "bark",
  "prop.palm_tall": "bark",
  "prop.palm_short": "bark",
  "prop.bush": "foliage",
  "prop.bush_large": "foliage",
  "prop.bush_leafy": "foliage",
  "prop.bush_small": "foliage",
  "prop.bush_cone": "foliage",
  "prop.boulder_round": "rock",
  "prop.boulder_jagged": "rock",
  "prop.boulder_flat": "rock",
  "prop.rock_spire_tall": "rock",
  "prop.stump_old": "bark",
  "prop.stump_cut": "bark",
  "prop.log_big": "bark",
  "prop.log_stack": "bark",
  "prop.cliff": "rock",
  "prop.cliff_corner": "rock",
  "prop.cliff_steps": "rock",
  "prop.palm": "bark",
  "prop.palm_bent": "bark",
  "prop.tree": "bark",
  "prop.tree_tall": "bark",
  "prop.tree_autumn": "bark",
  "prop.log": "bark",
  "prop.rock_large": "rock",
  "prop.rock_medium": "rock",
  "prop.rock_small": "rock",
  "prop.rock_flat": "rock",
  "prop.stump": "bark",
  "prop.rock_mossy_spire": "rock",
  "prop.lcvp_beached": "metal",
  "prop.mn_oak": "bark",
  "prop.mn_birch": "bark",
  "prop.mn_fir": "bark",
  "prop.mn_banana": "bark",
  "prop.mn_shrub": "foliage",
  "prop.mn_rock_spires": "rock",
  "prop.rock_pile": "rock",
  "prop.rn_dead_tree": "bark",
  "prop.nt_birch": "bark",
  "prop.nt_birch_autumn": "bark",
  "prop.nt_birch_snow": "bark",
  "prop.nt_common_tree": "bark",
  "prop.nt_common_tree_2": "bark",
  "prop.nt_common_tree_autumn": "bark",
  "prop.nt_dead_tree": "bark",
  "prop.nt_common_tree_snow": "bark",
  "prop.nt_pine_tall": "bark",
  "prop.nt_pine_small": "bark",
  "prop.nt_pine_snow_tall": "bark",
  "prop.nt_pine_autumn": "bark",
  "prop.nt_palm_curved": "bark",
  "prop.nt_palm_tall": "bark",
  "prop.nt_willow": "bark",
  "prop.nt_willow_autumn": "bark",
  "prop.nt_willow_dead": "bark",
  "prop.nt_bush_leafy": "foliage",
  "prop.nt_bush_berries": "foliage",
  "prop.nt_bush_snow": "foliage",
  "prop.nt_boulder_tall": "rock",
  "prop.nt_boulder": "rock",
  "prop.nt_rock_flat": "rock",
  "prop.nt_boulder_moss": "rock",
  "prop.nt_rock_moss": "rock",
  "prop.nt_boulder_snow": "rock",
  "prop.nt_rock_snow": "rock",
  "prop.nt_stump_large": "bark",
  "prop.nt_stump_moss": "bark",
  "prop.nt_log_large": "bark",
  "prop.nt_log_moss": "bark",
  "prop.nt_log_snow": "bark",
  "prop.eg_palm": "bark",
  "prop.jt_tree_trunk": "bark",
  "prop.landing_craft": "metal",
  "prop.landing_craft_wreck": "metal",
  "prop.landing_craft_wreck_burning": "metal",
  "prop.hedgehog_beach": "metal",
  "prop.belgian_gate": "metal",
  "prop.sandbag_stack": "dirt",
  "prop.timber_baulk": "bark",
  "prop.timber_stack": "bark",
  "prop.dory": "dirt",
  "prop.straw_bale": "dirt",
  "prop.jg_bamboo": "bark"
};
const SURFACE_TYPES = Object.fromEntries(SURFACE_TYPE_LIST.map((t) => [t.id, t]));
const propSurfaceOf = (model) => PROP_SURFACES[model] ?? envSurfaceOf(model) ?? kitSurfaceOf(model);
const MATERIALS = new Map(CORE_MATERIALS.map((m) => [m.id, m]));
const materialSurfaceOf = (id) => id ? MATERIALS.get(id)?.surface : void 0;
function materialBallisticOf(id) {
  const m = id ? MATERIALS.get(id) : void 0;
  if (!m) return void 0;
  return m.ballistic ?? (m.surface ? SURFACE_TYPES[m.surface].ballistic : void 0);
}
function guessSurface(name) {
  const n = name.toLowerCase();
  for (const [s, words] of SURFACE_GUESS.words) if (words.some((w) => n.includes(w))) return s;
  return SURFACE_GUESS.fallback;
}
const propSurface = (model) => propSurfaceOf(model) ?? guessSurface(model);
const materialSurface = (id) => materialSurfaceOf(id) ?? guessSurface(id);
const BULLET_GRAVITY = 9.81;
const NEAR_INSTANT_M = 8;
const BULLET_SUBSTEPS = 2;
const BULLET_LIFETIME = 3;
const acc = (base, move, air, perShot, tight, max, recovery, ads, adsTicks = 12) => ({ base, move, air, perShot, tight, max, recovery, ads, adsTicks });
const kick = (pitch, yaw, variance, delay, settle, rate, visual) => ({ pitch, yaw, variance, delay, settle, rate, visual });
const DEFAULT_HEAD = 2;
const DEFAULT_LEGS = 0.75;
const cache = /* @__PURE__ */ new WeakMap();
function gunplayOf(def) {
  let g = cache.get(def);
  if (g) return g;
  const fam = def.family ? FAMILY_DEFAULTS[def.family] : null;
  const ballistic = def.ballistic === null ? null : def.ballistic ? { ...fam?.ballistic ?? {}, ...def.ballistic } : fam?.ballistic ?? null;
  g = {
    family: def.family ?? null,
    // Hitscan weapons with a bullet family fly; projectiles, beams and melee never do.
    ballistic: def.kind === "hitscan" && !def.view.beam ? ballistic : null,
    accuracy: def.accuracy ? { ...fam?.accuracy ?? acc(def.spread, 0.014, 0.035, 0, 0, 0.1, 6, 0.55), ...def.accuracy } : fam?.accuracy ?? null,
    // Weapons without a family kick only by their own `kick` (the exotic arsenal's old camera kick, folded in).
    // A melee weapon never kicks; its second trigger's kick (the Battle Axe's blunderbuss) settles by its own curve.
    kick: def.kick ? { ...fam?.kick ?? kick([0], [0], 0, 4, 8, 0.1, 0.5), ...def.kick } : fam?.kick ?? (def.kind === "melee" ? def.alt?.kick ?? null : null),
    reload: def.reload ?? { type: "magazine", tactical: def.reloadTicks, empty: def.reloadTicks, out: 0.35, in: 1 },
    falloff: def.falloff ?? fam?.falloff ?? null,
    head: def.headshot ?? fam?.head ?? DEFAULT_HEAD,
    legs: def.legshot ?? fam?.legs ?? DEFAULT_LEGS
  };
  cache.set(def, g);
  return g;
}
const LETHALITY_HEALTH = { arcade: 1.4, standard: 1, tactical: 0.72 };
const BALLISTICS_SCALE = {
  arcade: { velocity: 1.6, gravity: 0.25, drag: 0.5 },
  standard: { velocity: 1, gravity: 1, drag: 1 },
  advanced: { velocity: 0.8, gravity: 1.75, drag: 1.5 }
};
function lethalityScale(rules) {
  return 1 / (LETHALITY_HEALTH[rules.lethality ?? "standard"] ?? 1);
}
function bulletPhysics(b, rules = {}) {
  const s = BALLISTICS_SCALE[rules.ballistics ?? "standard"] ?? BALLISTICS_SCALE.standard;
  return { speed: b.velocity * s.velocity, gravity: BULLET_GRAVITY * b.gravityScale * s.gravity, drag: (b.drag ?? 0) * s.drag };
}
function falloffAt(f, dist) {
  if (!f || dist <= f.start) return 1;
  if (dist >= f.end) return f.min;
  const u = (dist - f.start) / (f.end - f.start);
  const k = f.curve === "smooth" ? u * u * (3 - 2 * u) : f.curve === "steep" ? 1 - (1 - u) * (1 - u) : u;
  return 1 - (1 - f.min) * k;
}
const newGunState = () => ({ rp: 0, ry: 0, shots: 0, idle: 1e3, spray: 0, ads: 0 });
function wobble(i) {
  let h = (i + 1) * 2654435761;
  h = Math.imul(h ^ h >>> 15, 2246822507);
  h = Math.imul(h ^ h >>> 13, 3266489909);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295 * 2 - 1;
}
function kickOf(k, i) {
  const pitch = k.pitch[Math.min(i, k.pitch.length - 1)] ?? 0;
  const yaw = (k.yaw.length ? k.yaw[i % k.yaw.length] : 0) + k.variance * wobble(i);
  return { pitch, yaw };
}
function recoilShot(g, k) {
  if (k) {
    const r = kickOf(k, g.shots);
    g.rp += r.pitch;
    g.ry += r.yaw;
  }
  g.shots++;
  g.spray++;
  g.idle = 0;
}
function counterRecoil(g, pitch, yaw) {
  if (pitch > 0 && g.rp > 0) g.rp -= Math.min(g.rp, pitch);
  if (yaw !== 0 && g.ry !== 0 && Math.sign(yaw) === Math.sign(g.ry)) g.ry -= Math.sign(g.ry) * Math.min(Math.abs(g.ry), Math.abs(yaw));
}
function counterFrom(g, dPitch, dYaw) {
  const p = dPitch < 0 && g.rp > 0 ? Math.min(g.rp, -dPitch) : 0;
  let y = 0;
  if (g.ry > 0 && dYaw < 0) y = Math.min(g.ry, -dYaw);
  else if (g.ry < 0 && dYaw > 0) y = -Math.min(-g.ry, dYaw);
  return [p, y];
}
function recoilIdle(g, k, a, interval, dt = TICK_DT) {
  g.idle++;
  if (a && g.idle > interval && g.spray > 0) g.spray = Math.max(0, g.spray - a.recovery * dt);
  const delay = k?.delay ?? 4;
  if (g.idle <= delay) return;
  const settle = k ? 1 - Math.exp(-k.settle * dt) : 1;
  const rate = (k?.rate ?? 1) * dt;
  const back = (v) => {
    const s = Math.abs(v) * settle + rate;
    return Math.abs(v) <= s ? 0 : v - Math.sign(v) * s;
  };
  g.rp = back(g.rp);
  g.ry = back(g.ry);
  if (g.rp === 0 && g.ry === 0) g.shots = 0;
}
function stepAds(g, a, aiming) {
  const step = 1 / Math.max(1, a?.adsTicks ?? 12);
  g.ads = aiming ? Math.min(1, g.ads + step) : Math.max(0, g.ads - step * 2);
}
function spreadOf(a, g, ctx) {
  const sustained = Math.max(0, g.spray - a.tight) * a.perShot;
  const moving = ctx.run > 0.25 ? a.move * Math.min(1, ctx.run) : 0;
  const cone = Math.min(a.max, a.base + moving + (ctx.airborne ? a.air : 0) + sustained);
  return cone * (1 + (a.ads - 1) * g.ads) * ctx.stance;
}
function shotCone(def, a, g, ctx) {
  return spreadOf(a, g, ctx) + (def.pellets > 1 ? def.spread : 0);
}
const loaders = /* @__PURE__ */ new WeakMap();
function barrelLoader(def) {
  const a = def.alt;
  if (def.magazine > 0 || !a?.reload || a.ammo !== "own") return null;
  let l = loaders.get(def);
  if (!l) {
    l = { ...def, magazine: a.max ?? 1, reload: { type: "shell", ...a.reload } };
    loaders.set(def, l);
  }
  return l;
}
const RELOAD_KINDS = ["tactical", "empty", "chamber", "shell"];
function canReload(def, w) {
  const barrel = barrelLoader(def);
  if (barrel) return canReload(barrel, { mag: w.alt ?? 0, reserve: w.reserve });
  if (def.magazine === 0 || def.heat) return false;
  if (w.unchambered) return true;
  return w.mag < def.magazine && w.reserve > 0;
}
function beginReload(def, w) {
  const barrel = barrelLoader(def);
  if (barrel) return beginReload(barrel, { mag: w.alt ?? 0, reserve: w.reserve });
  if (!canReload(def, w)) return null;
  const r = gunplayOf(def).reload;
  if (r.type === "shell") {
    const missing = Math.min(def.magazine - w.mag, w.reserve);
    return { kind: "shell", t: 0, total: r.start + r.each * missing + r.end, stage: 0 };
  }
  if (w.unchambered) return { kind: "chamber", t: 0, total: Math.max(1, Math.round(r.empty * (1 - r.in))), stage: 2 };
  const kind = w.mag > 0 ? "tactical" : "empty";
  return { kind, t: 0, total: kind === "tactical" ? r.tactical : r.empty, stage: 0 };
}
function stepReload(def, w, run) {
  const barrel = barrelLoader(def);
  if (barrel) {
    const b = { mag: w.alt ?? 0, reserve: w.reserve };
    const next = stepReload(barrel, b, run);
    w.alt = b.mag;
    w.reserve = b.reserve;
    return next;
  }
  const r = gunplayOf(def).reload;
  run.t++;
  if (r.type === "shell") {
    if (run.t >= r.start + r.each * (run.stage + 1) && w.mag < def.magazine && w.reserve > 0) {
      w.mag++;
      w.reserve--;
      run.stage++;
    }
    if (w.mag >= def.magazine || w.reserve === 0) run.total = Math.min(run.total, Math.max(run.t, r.start + r.each * run.stage) + r.end);
    return run.t >= run.total ? null : run;
  }
  if (run.kind === "chamber") {
    if (run.t >= run.total) {
      w.unchambered = false;
      return null;
    }
    return run;
  }
  const outAt = Math.max(1, Math.round(run.total * r.out));
  const inAt = Math.max(outAt, Math.round(run.total * r.in));
  if (run.stage === 0 && run.t >= outAt) {
    const keep = run.kind === "tactical" ? Math.min(1, w.mag) : 0;
    w.reserve += w.mag - keep;
    w.mag = keep;
    run.stage = 1;
  }
  if (run.stage === 1 && run.t >= inAt) {
    const take = Math.min(def.magazine - w.mag, w.reserve);
    w.mag += take;
    w.reserve -= take;
    if (run.kind === "empty" && w.mag > 0) w.unchambered = true;
    run.stage = 2;
  }
  if (run.t >= run.total) {
    if (run.kind === "empty") w.unchambered = false;
    return null;
  }
  return run;
}
const roundsReady = (w) => w.unchambered ? 0 : w.mag;
function autoReloadDue(def, box, t, busy) {
  if (def.magazine <= 0 || def.kind === "melee" || def.heat || box.reserve <= 0 || roundsReady(box) > 0) return false;
  if (t.reloadTicks > 0 || t.fireCooldown > 0 || t.raiseTicks > 0 || t.burstLeft > 0) return false;
  return !busy;
}
function flyBullet(b, gravity, drag, dt) {
  const from = { ...b.pos };
  if (drag > 0) {
    const k = Math.max(0, 1 - drag * dt);
    b.vel = { x: b.vel.x * k, y: b.vel.y * k, z: b.vel.z * k };
  }
  b.vel = { x: b.vel.x, y: b.vel.y - gravity * dt, z: b.vel.z };
  b.pos = { x: b.pos.x + b.vel.x * dt, y: b.pos.y + b.vel.y * dt, z: b.pos.z + b.vel.z * dt };
  return { from, to: { ...b.pos } };
}
function traceBullet(origin, dir, phys, maxDist, raycast) {
  const near = Math.min(NEAR_INSTANT_M, maxDist);
  const first = raycast(origin, dir, near);
  if (first !== null) return { end: { x: origin.x + dir.x * first, y: origin.y + dir.y * first, z: origin.z + dir.z * first }, time: 0, hit: true };
  const b = { pos: { x: origin.x + dir.x * near, y: origin.y + dir.y * near, z: origin.z + dir.z * near }, vel: { x: dir.x * phys.speed, y: dir.y * phys.speed, z: dir.z * phys.speed } };
  let travelled = near;
  let time = 0;
  const dt = TICK_DT / BULLET_SUBSTEPS;
  while (time < BULLET_LIFETIME && travelled < maxDist) {
    const seg = flyBullet(b, phys.gravity, phys.drag, dt);
    time += dt;
    const d = { x: seg.to.x - seg.from.x, y: seg.to.y - seg.from.y, z: seg.to.z - seg.from.z };
    const len = hypot(d.x, d.y, d.z);
    if (len < 1e-9) break;
    const u = { x: d.x / len, y: d.y / len, z: d.z / len };
    const hit = raycast(seg.from, u, len);
    if (hit !== null) return { end: { x: seg.from.x + u.x * hit, y: seg.from.y + u.y * hit, z: seg.from.z + u.z * hit }, time: time - dt + hit / len * dt, hit: true };
    travelled += len;
  }
  return { end: b.pos, time, hit: false };
}
function isTracer(b, n, left) {
  if (!b) return true;
  if (b.tracerFinal && left < b.tracerFinal) return true;
  return b.tracerEvery > 0 && n % b.tracerEvery === 0;
}
const MATERIAL_BALLISTICS = {
  flesh: { resist: 2500, ricochet: 0, destruction: 1 },
  glass: { resist: 150, ricochet: 0, destruction: 3 },
  thin_wood: { resist: 600, ricochet: 0, destruction: 1.5 },
  wood: { resist: 1e3, ricochet: 0, destruction: 1.2 },
  drywall: { resist: 500, ricochet: 0, destruction: 1.5 },
  stone: { resist: 6e3, ricochet: 0.1, destruction: 0.4 },
  brick: { resist: 5e3, ricochet: 0.05, destruction: 0.6 },
  concrete: { resist: 7e3, ricochet: 0.1, destruction: 0.4 },
  thin_metal: { resist: 4500, ricochet: 0.45, destruction: 0.8 },
  metal: { resist: 16e3, ricochet: 0.5, destruction: 0.5 },
  armor: { resist: 4e4, ricochet: 0.6, destruction: 0.2 },
  water: { resist: 400, ricochet: 0.2, destruction: 0 },
  soil: { resist: 5e3, ricochet: 0, destruction: 0 },
  energy: { resist: 1e9, ricochet: 0, destruction: 0 },
  // Tree trunks, stumps and logs (surface type `bark`, owner decision Q3 of PROCEDURAL_ENVIRONMENT_AUDIT.md): full
  // cover, a 0.5 m trunk stops even a precision round (3000 energy), but no ricochet off bark, unlike concrete.
  heavy_wood: { resist: 6e3, ricochet: 0, destruction: 0.3 },
  // Bushes and crowns (surface type `foliage`): rounds pass through, barely slowed (they have no collider today).
  foliage: { resist: 30, ricochet: 0, destruction: 0 }
};
const PENETRATION_MIN_ENERGY = 60;
const MAX_PENETRATIONS = 3;
const RICOCHET_MAX_ANGLE = 0.35;
const MAX_RICOCHETS = 1;
function materialClass(id, category) {
  const s = (id ?? "").toLowerCase();
  if (/glass|window|pane/.test(s)) return "glass";
  if (/drywall|plaster|paint|canvas|carpet|fabric|tent/.test(s)) return "drywall";
  if (/board|crate|plank|fence|barricade|pallet|shelf|table|chair|door|box|siding|walnut|wood|barrel_wood|keg/.test(s)) return /plank|board|crate|fence|pallet|siding|barricade/.test(s) ? "thin_wood" : "wood";
  if (/armor|vault|blast/.test(s)) return "armor";
  if (/sheet|corrugated|panel_metal|locker|cabinet|vending|car|van|bus|truck|container|grate|walkway|barrel|gas|generator|tank/.test(s)) return "thin_metal";
  if (/steel|metal|iron|plate|brass|rust|pipe|machine/.test(s)) return "metal";
  if (/brick/.test(s)) return "brick";
  if (/sand|soil|dirt|mud|grass|sandbag|rock|terrain/.test(s)) return /rock/.test(s) ? "stone" : "soil";
  if (/stone|cobble|marble|travertine|onyx|flagstone|tile|terrazzo|paving/.test(s)) return "stone";
  if (/concrete/.test(s)) return "concrete";
  if (/energy|field|neon|glow|light/.test(s)) return "energy";
  switch (category) {
    case "Wood":
      return "wood";
    case "Metal":
      return "metal";
    case "Brick":
      return "brick";
    case "Stone":
    case "Tile":
      return "stone";
    case "Fabric":
    case "Paint":
      return "drywall";
    case "Ground":
      return "soil";
    default:
      return "concrete";
  }
}
const penetrationLoss = (m, thickness) => MATERIAL_BALLISTICS[m].resist * Math.max(0, thickness);
function penetrate(energy, m, thickness) {
  const left = energy - penetrationLoss(m, thickness);
  return left >= PENETRATION_MIN_ENERGY ? left : null;
}
function ricochets(m, grazing, roll) {
  const chance = MATERIAL_BALLISTICS[m].ricochet;
  if (chance <= 0 || grazing >= RICOCHET_MAX_ANGLE) return false;
  return roll < chance * (1 - grazing / RICOCHET_MAX_ANGLE);
}
const MATERIAL_CATEGORY = new Map(CORE_MATERIALS.map((m) => [m.id, m.category]));
const surfaceMaterial = (id) => id ? materialBallisticOf(id) ?? materialClass(id, MATERIAL_CATEGORY.get(id) ?? null) : "concrete";
function propMaterial(model) {
  const s = propSurfaceOf(model);
  return s ? SURFACE_TYPES[s].ballistic : materialClass(model);
}
const DESTRUCTIBLE_MATERIAL = { crate: "thin_wood", barrel: "thin_metal", wall: "brick", glass: "glass", boards: "thin_wood", gas: "thin_metal", generator: "metal" };
function entityMaterial(e) {
  switch (e.kind) {
    case "destructible":
      return DESTRUCTIBLE_MATERIAL[e.model] ?? "wood";
    case "door":
      return "wood";
    case "block":
      return surfaceMaterial(e.material);
    case "prop":
      return propMaterial(e.model);
    default:
      return "concrete";
  }
}
function environmentPlacements(map, breakable = false) {
  const carried = new Set(map.entities.flatMap((e) => e.kind === "mover" ? e.props ?? [] : []));
  const out = [];
  for (const e of map.entities) {
    if (e.kind !== "prop" || !isEnvModel(e.model) || !e.solid || carried.has(e.id) || isBreakableProp(e) !== breakable) continue;
    const species = getEnvSpecies(e.model);
    if (species) out.push({ e, species });
  }
  return out;
}
function environmentShapes(map, breakable = false) {
  return environmentPlacements(map, breakable).flatMap(({ e, species }) => placementShapes(e, species));
}
function placementShapes(e, species) {
  const v = envVariant(species, e.variant);
  const [px, py, pz] = e.position;
  const s = e.scale;
  const at = (x, y, z) => {
    const [rx, rz] = yawXZ(x * s, z * s, e.yaw);
    return [px + rx, py + y * s, pz + rz];
  };
  return v.shapes.map((sh) => placeShape(sh, at, s, e.id, species.nav !== "none"));
}
function placeShape(sh, at, s, sourceId, navOk) {
  const base = { sourceId, blocks: sh.blocks, surface: sh.surface, nav: navOk && sh.blocks === "all" };
  switch (sh.kind) {
    case "capsule":
      return { ...base, kind: "capsule", a: at(...sh.a), b: at(...sh.b), r: sh.r * s };
    case "hull":
      return { ...base, kind: "hull", points: sh.points.flatMap((p) => at(...p)) };
    case "box": {
      const pts = [];
      const cx = (sh.min[0] + sh.max[0]) / 2;
      const cz = (sh.min[2] + sh.max[2]) / 2;
      for (const x of [sh.min[0], sh.max[0]])
        for (const y of [sh.min[1], sh.max[1]])
          for (const z of [sh.min[2], sh.max[2]]) {
            const [rx, rz] = yawXZ(x - cx, z - cz, sh.yaw ?? 0);
            pts.push(...at(cx + rx, y, cz + rz));
          }
      return { ...base, kind: "hull", points: pts };
    }
    case "mesh": {
      const positions = [];
      for (let i = 0; i < sh.positions.length; i += 3) positions.push(...at(sh.positions[i], sh.positions[i + 1], sh.positions[i + 2]));
      return { ...base, kind: "mesh", positions, indices: [...sh.indices] };
    }
  }
}
function hull2(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
function environmentNavTriangles(shapes) {
  const P = [];
  const I = [];
  for (const sh of shapes) {
    if (!sh.nav) continue;
    if (sh.kind === "mesh") {
      const o2 = P.length / 3;
      P.push(...sh.positions);
      for (const i of sh.indices) I.push(i + o2);
      continue;
    }
    let foot;
    let y0;
    let y1;
    if (sh.kind === "capsule") {
      foot = [];
      for (const c of [sh.a, sh.b]) for (let k = 0; k < 8; k++) foot.push([c[0] + Math.cos(k * Math.PI / 4) * sh.r, c[2] + Math.sin(k * Math.PI / 4) * sh.r]);
      y0 = Math.min(sh.a[1], sh.b[1]) - sh.r;
      y1 = Math.max(sh.a[1], sh.b[1]) + sh.r;
    } else {
      foot = [];
      y0 = Infinity;
      y1 = -Infinity;
      for (let i = 0; i < sh.points.length; i += 3) {
        foot.push([sh.points[i], sh.points[i + 2]]);
        y0 = Math.min(y0, sh.points[i + 1]);
        y1 = Math.max(y1, sh.points[i + 1]);
      }
    }
    const ring = hull2(foot);
    const o = P.length / 3;
    for (const [x, z] of ring) P.push(x, y0, z, x, y1, z);
    const n = ring.length;
    for (let k = 0; k < n; k++) {
      const a = o + k * 2;
      const b = o + (k + 1) % n * 2;
      I.push(a, b, b + 1, a, b + 1, a + 1);
    }
    for (let k = 1; k + 1 < n; k++) I.push(o + 1, o + (k + 1) * 2 + 1, o + k * 2 + 1);
  }
  return P.length ? { positions: new Float32Array(P), indices: new Uint32Array(I) } : null;
}
function joinTriangles(...parts) {
  const list = parts.filter((p) => !!p);
  if (list.length <= 1) return list[0] ?? null;
  const positions = new Float32Array(list.reduce((n, p) => n + p.positions.length, 0));
  const indices = new Uint32Array(list.reduce((n, p) => n + p.indices.length, 0));
  let po = 0;
  let io = 0;
  for (const p of list) {
    positions.set(p.positions, po);
    for (let i = 0; i < p.indices.length; i++) indices[io + i] = p.indices[i] + po / 3;
    po += p.positions.length;
    io += p.indices.length;
  }
  return { positions, indices };
}
const entityPos = (e) => ({ x: e.position[0], y: e.position[1], z: e.position[2] });
function localToWorld(origin, yaw, lx, ly, lz) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: origin.x + lx * c + lz * s, y: origin.y + ly, z: origin.z - lx * s + lz * c };
}
function pointInOBox(b, p, inflate = 0) {
  const dx = p.x - b.center.x;
  const dz = p.z - b.center.z;
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) <= b.half.x + inflate && Math.abs(lz) <= b.half.z + inflate && Math.abs(p.y - b.center.y) <= b.half.y;
}
function playerInOBox(b, feet) {
  for (const h of [0.2, PLAYER.height / 2, PLAYER.height - 0.2]) {
    if (pointInOBox(b, { x: feet.x, y: feet.y + h, z: feet.z }, PLAYER.radius)) return true;
  }
  return false;
}
function oboxAabb(b) {
  const c = Math.abs(Math.cos(b.yaw));
  const s = Math.abs(Math.sin(b.yaw));
  const hx = b.half.x * c + b.half.z * s;
  const hz = b.half.x * s + b.half.z * c;
  return {
    min: { x: b.center.x - hx, y: b.center.y - b.half.y, z: b.center.z - hz },
    max: { x: b.center.x + hx, y: b.center.y + b.half.y, z: b.center.z + hz }
  };
}
function offGrid(yaw) {
  const q = yaw / (Math.PI / 2);
  return Math.abs(q - Math.round(q)) > 1e-6;
}
function orientedAabb(b) {
  const box = oboxAabb(b);
  return offGrid(b.yaw) ? { ...box, obox: b } : box;
}
function oboxLocal(b, x, z) {
  const dx = x - b.center.x;
  const dz = z - b.center.z;
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  return [dx * c - dz * s, dx * s + dz * c];
}
function bodyInAabb(box, pos, radius, height) {
  if (!(pos.y + height > box.min.y && pos.y < box.max.y)) return false;
  const o = box.obox;
  if (!o) return pos.x + radius > box.min.x && pos.x - radius < box.max.x && pos.z + radius > box.min.z && pos.z - radius < box.max.z;
  const [lx, lz] = oboxLocal(o, pos.x, pos.z);
  return Math.abs(lx) < o.half.x + radius && Math.abs(lz) < o.half.z + radius;
}
function segmentHitsAabb(a, b, box, pad = 0) {
  if (box.obox) {
    const o = box.obox;
    const [ax, az] = oboxLocal(o, a.x, a.z);
    const [bx, bz] = oboxLocal(o, b.x, b.z);
    const local = { min: { x: -o.half.x, y: o.center.y - o.half.y, z: -o.half.z }, max: { x: o.half.x, y: o.center.y + o.half.y, z: o.half.z } };
    return segmentHitsAabb({ x: ax, y: a.y, z: az }, { x: bx, y: b.y, z: bz }, local, pad);
  }
  let t0 = 0;
  let t1 = 1;
  for (const k of ["x", "y", "z"]) {
    const p = k === "y" ? 0 : pad;
    const d = b[k] - a[k];
    const lo = box.min[k] - p;
    const hi = box.max[k] + p;
    if (Math.abs(d) < 1e-9) {
      if (a[k] < lo || a[k] > hi) return false;
      continue;
    }
    let u = (lo - a[k]) / d;
    let v = (hi - a[k]) / d;
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u);
    t1 = Math.min(t1, v);
    if (t0 > t1) return false;
  }
  return true;
}
const DOOR = {
  width: 3,
  height: 3,
  thickness: 0.2,
  /** Seconds to fully open or close. */
  travelSeconds: 0.6,
  /** Auto doors open when a player is this close to the doorway centre. */
  autoRadius: 3,
  /** Auto doors close this long after the last player left. */
  autoCloseSeconds: 1.5
};
function doorLeaves(e, open) {
  const o = entityPos(e);
  const w = DOOR.width / 4;
  const half = { x: w, y: DOOR.height / 2, z: DOOR.thickness / 2 };
  const shift = open * (DOOR.width / 2);
  return [
    { center: localToWorld(o, e.yaw, -w - shift, DOOR.height / 2, 0), half, yaw: e.yaw },
    { center: localToWorld(o, e.yaw, w + shift, DOOR.height / 2, 0), half, yaw: e.yaw }
  ];
}
function doorway(e) {
  return { center: localToWorld(entityPos(e), e.yaw, 0, DOOR.height / 2, 0), half: { x: DOOR.width / 2, y: DOOR.height / 2, z: 0.6 }, yaw: e.yaw };
}
const BUTTON = {
  /** Height of the button face above the entity position. */
  height: 1.2,
  /** Players must be this close (eye to button) and roughly facing it to press. */
  reach: 2.2,
  facingCos: 0.6
};
const DOOR_USE_REACH = 2.6;
const DESTRUCTIBLE_SPECS = {
  crate: { label: "Crate", half: { x: 0.6, y: 0.6, z: 0.6 }, health: 60 },
  barrel: { label: "Explosive barrel", half: { x: 0.45, y: 0.65, z: 0.45 }, health: 30, blast: { radius: 4.5, damage: 90, edge: 15 } },
  wall: { label: "Breakable wall", half: { x: 1.5, y: 1.5, z: 0.25 }, health: 250, blocksPaths: true },
  glass: { label: "Window pane", half: { x: 1.3, y: 0.7, z: 0.04 }, health: 1, lift: 1 },
  boards: { label: "Board barricade", half: { x: 1.5, y: 1.5, z: 0.1 }, health: 70, blocksPaths: true },
  gas: { label: "Gas cylinder", half: { x: 0.3, y: 0.65, z: 0.3 }, health: 15, blast: { radius: 5, damage: 110, edge: 20 } },
  generator: { label: "Generator", half: { x: 1, y: 0.9, z: 0.7 }, health: 400, blast: { radius: 4, damage: 80, edge: 10 } }
};
function destructibleBox(e) {
  const spec = DESTRUCTIBLE_SPECS[e.model];
  return { center: localToWorld(entityPos(e), e.yaw, 0, (spec.lift ?? 0) + spec.half.y, 0), half: spec.half, yaw: e.yaw };
}
function glassBreakable(p) {
  return { box: p.box, health: p.kind === "reinforced" ? GLASS.reinforcedHealth : GLASS.breakableHealth, explosiveOnly: false, blocksPaths: true, glass: p.kind };
}
const windowPaneIndex = (map, k) => map.entities.length + k;
function blockOBox(e) {
  const [w, h, d] = e.size;
  return { center: { x: e.position[0], y: e.position[1] + h / 2, z: e.position[2] }, half: { x: w / 2, y: h / 2, z: d / 2 }, yaw: e.yaw, ...e.pitch || e.roll ? { rot: boxQuat(e.yaw, e.pitch, e.roll) } : {} };
}
const CLASS_HEALTH = { glass: 10, foliage: 30, drywall: 60, thin_wood: 60, wood: 120, heavy_wood: 250, thin_metal: 150, soil: 300, brick: 400, metal: 500, stone: 700, concrete: 700, armor: 2e3 };
function propHealth(model, collision, scale) {
  const volume = collision[0] * collision[1] * collision[2] * scale ** 3;
  const size = Math.min(8, Math.max(0.25, volume)) ** (2 / 3);
  return Math.max(5, Math.round((CLASS_HEALTH[propMaterial(model)] ?? 200) * size / 5) * 5);
}
const CLASS_DEBRIS = { glass: "#bfe6f5", foliage: "#4f6b3a", drywall: "#cfc9bd", thin_wood: "#8a5d33", wood: "#8a5a32", heavy_wood: "#6e4a2a", thin_metal: "#7d8388", soil: "#6b5a44", brick: "#9a5a44", metal: "#5a6066", stone: "#8d8c86", concrete: "#9a9892", armor: "#4a4f54" };
function propBreakLook(model, debris) {
  const c = propMaterial(model);
  const sound = c === "glass" ? "break.glass" : c === "brick" || c === "stone" || c === "concrete" || c === "soil" ? "break.wall" : "break.crate";
  return { debris: debris ?? CLASS_DEBRIS[c] ?? "#8a5a32", sound };
}
function breakableOf(e, dynamic, everything = false) {
  if (isGlassBlock(e)) return glassBreakable({ box: blockOBox(e), kind: e.glass });
  if (e.kind === "block" && e.behaviour === "solid" && dynamic?.has(e.id)) {
    return { box: blockOBox(e), health: 1, explosiveOnly: false, blocksPaths: false, shootable: false };
  }
  if (e.kind === "destructible") {
    const spec = DESTRUCTIBLE_SPECS[e.model];
    return { box: destructibleBox(e), health: e.health ?? spec.health, explosiveOnly: e.explosiveOnly, ...spec.blast ? { blast: spec.blast } : {}, blocksPaths: !!spec.blocksPaths };
  }
  if (e.kind === "block" && e.behaviour !== "solid") {
    return { box: blockOBox(e), health: e.health, explosiveOnly: false, blocksPaths: false, shootable: e.behaviour === "breakable" };
  }
  if (e.kind === "prop" && isEnvModel(e.model)) {
    const half = isBreakableProp(e, everything) ? envHalfSize(e) : null;
    if (!half) return null;
    return {
      box: { center: { x: e.position[0], y: e.position[1] + half[1], z: e.position[2] }, half: { x: half[0], y: half[1], z: half[2] }, yaw: e.yaw },
      shapes: placementShapes(e, getEnvSpecies(e.model)),
      health: e.health,
      explosiveOnly: false,
      blocksPaths: false
    };
  }
  if (e.kind === "prop" && isBreakableProp(e, everything)) {
    const def = getProp(e.model);
    const [w, h, d] = def.collision.map((v) => v * e.scale / 2);
    return {
      box: { center: { x: e.position[0], y: e.position[1] + h, z: e.position[2] }, half: { x: w, y: h, z: d }, yaw: e.yaw },
      ...def.boxes ? { parts: propParts(e, def.boxes) } : {},
      health: e.health ?? (def.breakable ? def.breakable.health * e.scale : propHealth(e.model, def.collision, e.scale)),
      explosiveOnly: false,
      ...def.breakable?.blast ? { blast: def.breakable.blast } : {},
      blocksPaths: false
    };
  }
  return null;
}
function propParts(e, boxes) {
  const c = Math.cos(e.yaw);
  const s = Math.sin(e.yaw);
  return boxes.map(([x0, y0, z0, x1, y1, z1]) => {
    const cx = (x0 + x1) / 2 * e.scale;
    const cz = (z0 + z1) / 2 * e.scale;
    return {
      center: { x: e.position[0] + cx * c + cz * s, y: e.position[1] + (y0 + y1) / 2 * e.scale, z: e.position[2] - cx * s + cz * c },
      half: { x: (x1 - x0) / 2 * e.scale, y: (y1 - y0) / 2 * e.scale, z: (z1 - z0) / 2 * e.scale },
      yaw: e.yaw
    };
  });
}
function zoneBox(e) {
  const [sx, sy, sz] = e.size;
  return { center: { x: e.position[0], y: e.position[1] + sy / 2, z: e.position[2] }, half: { x: sx / 2, y: sy / 2, z: sz / 2 }, yaw: 0 };
}
const TRAP_SPECS = {
  spikes: {
    label: "Spike floor",
    hazard: { center: [0, 0.5, 0], half: [1.5, 0.5, 1.5] },
    damage: 35,
    intervalTicks: TICK_RATE / 2,
    warnTicks: Math.round(TICK_RATE * 0.4),
    defaults: { activation: "cycle", onSeconds: 1.5, offSeconds: 2.5 }
  },
  flames: {
    label: "Flame jet",
    hazard: { center: [0, 1.1, 3], half: [0.8, 1, 2.6] },
    damage: 9,
    intervalTicks: 6,
    warnTicks: Math.round(TICK_RATE * 0.25),
    defaults: { activation: "cycle", onSeconds: 2, offSeconds: 3 }
  },
  crusher: {
    label: "Crusher",
    hazard: { center: [0, 1.6, 0], half: [1.5, 1.6, 1.5] },
    damage: 300,
    intervalTicks: TICK_RATE,
    pulseDelayTicks: 9,
    warnTicks: Math.round(TICK_RATE * 0.3),
    defaults: { activation: "cycle", onSeconds: 1.2, offSeconds: 3 }
  },
  mine: {
    label: "Proximity mine",
    hazard: { center: [0, 0.1, 0], half: [0.3, 0.1, 0.3] },
    trigger: { center: [0, 1, 0], half: [1.4, 1, 1.4] },
    damage: 110,
    intervalTicks: TICK_RATE,
    warnTicks: Math.round(TICK_RATE * 0.35),
    blast: { radius: 4.5, damage: 110, edge: 20 },
    defaults: { activation: "proximity", onSeconds: 0.5, offSeconds: 20 }
  },
  laser: {
    label: "Laser fence",
    hazard: { center: [0, 1.15, 0], half: [1.5, 0.85, 0.1] },
    damage: 25,
    intervalTicks: TICK_RATE / 4,
    warnTicks: 0,
    defaults: { activation: "cycle", onSeconds: 2, offSeconds: 2 }
  },
  shock: {
    label: "Electric Fence",
    // Half-length is the run's own (see trapHazard); posts and wires stand 3.2 m tall.
    hazard: { center: [0, ELECTRIC_FENCE.height / 2, 0], half: [ELECTRIC_FENCE.defaultLength / 2, ELECTRIC_FENCE.height / 2, 0.35] },
    damage: ELECTRIC_FENCE.damage,
    intervalTicks: Math.round(TICK_RATE * ELECTRIC_FENCE.interval),
    warnTicks: 0,
    knockback: ELECTRIC_FENCE.knockback,
    defaults: { activation: "always", onSeconds: 2, offSeconds: 2 }
  }
};
const region = (e, r) => ({
  center: localToWorld(entityPos(e), e.yaw, r.center[0], r.center[1], r.center[2]),
  half: { x: r.half[0], y: r.half[1], z: r.half[2] },
  yaw: e.yaw
});
const trapHazard = (e) => {
  const h = TRAP_SPECS[e.trap].hazard;
  if (e.trap === "shock") return region(e, { center: h.center, half: [(e.length ?? ELECTRIC_FENCE.defaultLength) / 2 + 0.1, h.half[1], h.half[2]] });
  return region(e, h);
};
const trapTrigger = (e) => TRAP_SPECS[e.trap].trigger ? region(e, TRAP_SPECS[e.trap].trigger) : trapHazard(e);
const trapDamage = (e) => e.damage ?? TRAP_SPECS[e.trap].damage;
class ScenarioBodies {
  constructor(physics, map) {
    this.physics = physics;
    this.map = map;
    const dynamic = dynamicBlockIds(map);
    map.entities.forEach((e, i) => {
      if (e.kind === "door") {
        const [a, b] = doorLeaves(e, 0);
        const leaves = [physics.createBox(a.center, a.half, a.yaw), physics.createBox(b.center, b.half, b.yaw)];
        this.doors.set(i, leaves);
        this.doorOpen.set(i, 0);
        for (const c of leaves) this.byHandle.set(c.handle, i);
        this.setDoorOpen(i, e.startOpen ? 1 : 0);
      } else {
        const b = breakableOf(e, dynamic, !!map.metadata.destruction);
        if (!b) return;
        const hulls = b.shapes?.map((sh) => physics.createShape(sh)).filter((c) => !!c);
        const cs = hulls?.length ? hulls : (b.parts ?? [b.box]).map((box) => isGlassBlock(e) ? physics.createGlassBox(box.center, box.half, box.yaw, e.glass === "reinforced", box.rot) : physics.createBox(box.center, box.half, box.yaw, box.rot, e.kind === "block" && !!e.field));
        this.solids.set(i, cs);
        for (const c of cs) {
          this.byHandle.set(c.handle, i);
          if (e.kind === "block" && e.startHidden) physics.setBoxEnabled(c, false);
        }
      }
    });
    windowPanes(map).forEach((p, k) => {
      const c = physics.createGlassBox(p.box.center, p.box.half, p.box.yaw, p.kind === "reinforced");
      const i = windowPaneIndex(map, k);
      this.solids.set(i, [c]);
      this.byHandle.set(c.handle, i);
    });
    physics.commit();
  }
  physics;
  map;
  doors = /* @__PURE__ */ new Map();
  /** Each scenario body's colliders (one, or a breakable prop's `parts`). */
  solids = /* @__PURE__ */ new Map();
  byHandle = /* @__PURE__ */ new Map();
  doorOpen = /* @__PURE__ */ new Map();
  /** Entity index of the scenario body a ray hit, if it was one. */
  entityAt(handle) {
    return this.byHandle.get(handle);
  }
  setDoorOpen(index, open) {
    const leaves = this.doors.get(index);
    const e = this.map.entities[index];
    if (!leaves || e?.kind !== "door" || this.doorOpen.get(index) === open) return;
    this.doorOpen.set(index, open);
    const boxes = doorLeaves(e, open);
    leaves.forEach((c, k) => this.physics.moveBox(c, boxes[k].center));
    for (const c of leaves) this.physics.setBoxEnabled(c, open < 0.999);
  }
  /** Move a carried block (movers). */
  setTransform(index, center, rot) {
    const c = this.solids.get(index)?.[0];
    if (c) this.physics.setBoxTransform(c, center, rot);
  }
  setSolid(index, present) {
    for (const c of this.solids.get(index) ?? []) this.physics.setBoxEnabled(c, present);
  }
  commit() {
    this.physics.commit();
  }
}
export {
  falloffAt as $,
  shotCone as A,
  BREAKTHROUGH_MAX_SECTORS as B,
  isTracer as C,
  DESTRUCTIBLE_SPECS as D,
  bulletPhysics as E,
  traceBullet as F,
  GLASS_EDGES as G,
  RELOAD_KINDS as H,
  roundsReady as I,
  glassAt as J,
  propBreakLook as K,
  ScenarioBodies as L,
  MAX_TILE_LEVEL as M,
  NEAR_INSTANT_M as N,
  BULLET_GRAVITY as O,
  segmentHitsAabb as P,
  joinTriangles as Q,
  RESOURCE_BUDGETS as R,
  SetPieceDefinition as S,
  TRAP_SPECS as T,
  environmentNavTriangles as U,
  windowPanes as V,
  doorway as W,
  DOOR as X,
  destructibleBox as Y,
  EncounterEntity as Z,
  GLASS as _,
  MAX_TILE_CELL as a,
  BLOOD_AMOUNTS as a$,
  BULLET_SUBSTEPS as a0,
  flyBullet as a1,
  BULLET_LIFETIME as a2,
  PENETRATION_MIN_ENERGY as a3,
  penetrationLoss as a4,
  MATERIAL_BALLISTICS as a5,
  MAX_RICOCHETS as a6,
  RICOCHET_MAX_ANGLE as a7,
  ricochets as a8,
  MAX_PENETRATIONS as a9,
  BOT_HINT_KINDS as aA,
  SET_PIECE_MATERIAL_ROLES as aB,
  MapPath as aC,
  PATH_STYLES as aD,
  RACE_VEHICLES as aE,
  BREAKTHROUGH_OBJECTIVES as aF,
  MOVER_MODES as aG,
  AIR_CRAFTS as aH,
  AIR_CRAFT_LABELS as aI,
  AIRDROP_MODES as aJ,
  LADDER_STYLES as aK,
  LADDER_STYLE_LABELS as aL,
  ENCOUNTER_ENTRANCES as aM,
  TRAP_KINDS as aN,
  TRAP_ACTIVATIONS as aO,
  LIQUIDS as aP,
  BLOCK_BEHAVIOURS as aQ,
  GLASS_KINDS as aR,
  GLASS_KIND_LABELS as aS,
  DESTRUCTIBLE_MODELS as aT,
  DOOR_STYLES as aU,
  DOOR_STYLE_LABELS as aV,
  propHealth as aW,
  RELATIONS as aX,
  THUMBNAIL_SIZE as aY,
  MAX_THUMBNAIL_CHARS as aZ,
  MapThumbnail as a_,
  penetrate as aa,
  entityMaterial as ab,
  surfaceMaterial as ac,
  lethalityScale as ad,
  BUTTON as ae,
  entityPos as af,
  DOOR_USE_REACH as ag,
  breakableOf as ah,
  windowPaneIndex as ai,
  glassBreakable as aj,
  pointInOBox as ak,
  playerInOBox as al,
  rayOBox as am,
  zoneBox as an,
  trapTrigger as ao,
  trapHazard as ap,
  trapDamage as aq,
  oboxAabb as ar,
  bodyInAabb as as,
  orientedAabb as at,
  localToWorld as au,
  glassBlocks as av,
  glassCracks as aw,
  BotHint as ax,
  MapGroup as ay,
  SetPiecePlacement as az,
  TilePlacement as b,
  MapEntity as c,
  SetPieceRoleValues as d,
  environmentShapes as e,
  MapDocument as f,
  getKitFamily as g,
  DEFAULT_BLOOD as h,
  SURFACE_TYPES as i,
  propSurface as j,
  kitModelFile as k,
  guessSurface as l,
  materialSurface as m,
  gunplayOf as n,
  newGunState as o,
  propAlias as p,
  counterFrom as q,
  resourceBudgetIssues as r,
  counterRecoil as s,
  stepReload as t,
  utf8Length as u,
  beginReload as v,
  stepAds as w,
  autoReloadDue as x,
  recoilIdle as y,
  recoilShot as z
};
