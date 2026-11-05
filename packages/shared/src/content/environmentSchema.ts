/**
 * The zod schema of the environment's gameplay data (docs/PROCEDURAL_ENVIRONMENT_AUDIT.md §9.1), for the tests and
 * for anything that reads species data from outside the generated table. Kept apart from content/environment.ts so
 * the lookups the simulation runs don't bring zod's schemas with them.
 */
import { z } from 'zod';
import { SURFACE_TYPE_IDS } from './surfaceTypes.generated.ts';
import { ENV_CATEGORIES } from './environment.ts';

const V3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const Blocks = z.enum(['all', 'shots']);
const Surface = z.enum(SURFACE_TYPE_IDS);

export const EnvShapeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('capsule'), a: V3, b: V3, r: z.number().positive(), blocks: Blocks, surface: Surface }).strict(),
  z.object({ kind: z.literal('box'), min: V3, max: V3, yaw: z.number().optional(), blocks: Blocks, surface: Surface }).strict(),
  z.object({ kind: z.literal('hull'), points: z.array(V3).min(4).max(64), blocks: Blocks, surface: Surface }).strict(),
  z.object({ kind: z.literal('mesh'), positions: z.array(z.number().finite()).max(3 * 512), indices: z.array(z.number().int().min(0)).max(3 * 512), blocks: Blocks, surface: Surface }).strict(),
]);

export const EnvVariantSchema = z
  .object({
    index: z.number().int().min(0).max(255),
    name: z.string().regex(/^[a-z][a-z0-9_]*$/),
    seed: z.number().int(),
    size: V3,
    shapes: z.array(EnvShapeSchema).max(24),
  })
  .strict();

export const EnvironmentSpeciesSchema = z
  .object({
    id: z.string().regex(/^env\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/),
    assetVersion: z.number().int().min(1),
    family: z.string().min(1),
    category: z.enum(ENV_CATEGORIES),
    displayName: z.string().min(1),
    nominalHeight: z.number().positive(),
    surface: Surface,
    nav: z.enum(['none', 'obstacle', 'boundary']),
    role: z.enum(['decorative', 'cover', 'blocking']),
    conceals: z.object({ radius: z.number().positive(), height: z.number().positive() }).strict().nullable(),
    placement: z.object({ maxSlopeDegrees: z.number(), minSpacing: z.number(), scale: z.tuple([z.number(), z.number()]) }).strict(),
    variants: z.array(EnvVariantSchema).min(1),
  })
  .strict();
