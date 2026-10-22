import { z } from 'zod';

/**
 * ChronoSplit map document, format version 2 (v2 added per-surface tile styles).
 *
 * Maps are data, never code. Every placed item carries a stable string ID and
 * references catalog content by content ID. Domains the spec reserves
 * (advancedStructure, terrain, props, factions, objectives, logic, world,
 * legacyMetadata) are not populated in Phase 0; they will be added through
 * migrations as each system lands.
 */
export const MAP_FORMAT = 'chronosplit.map';
export const MAP_FORMAT_VERSION = 2;

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
});

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
});

export const SpawnEntity = EntityBase.extend({
  kind: z.literal('spawn'),
  /** Facing in radians, see viewDirection(). */
  yaw: z.number().finite().default(0),
  /** Faction ID; null spawns are shared by everyone (free-for-all). */
  faction: ContentId.nullable().default(null),
});

export const MapEntity = z.discriminatedUnion('kind', [SpawnEntity]);

export const MapDocument = z.object({
  format: z.literal(MAP_FORMAT),
  formatVersion: z.literal(MAP_FORMAT_VERSION),
  metadata: MapMetadata,
  classicStructure: ClassicStructure,
  entities: z.array(MapEntity).max(4096),
  /** Content packs this map needs, beyond the always-present core pack. */
  dependencies: z.array(z.object({ pack: ContentId, version: z.string() })).default([]),
});

export type MapDocument = z.infer<typeof MapDocument>;
export type MapEntity = z.infer<typeof MapEntity>;
export type SpawnEntity = z.infer<typeof SpawnEntity>;
export type TilePlacement = z.infer<typeof TilePlacement>;
export type Rotation = z.infer<typeof Rotation>;
export type SurfaceStyle = z.infer<typeof SurfaceStyle>;
export type TileSurfaces = z.infer<typeof TileSurfaces>;
