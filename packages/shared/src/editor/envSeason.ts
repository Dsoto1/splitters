import { getEnvSpecies } from '../content/environment.ts';
import type { MapDocument, PropEntity } from '../map/schema.ts';
import type { EditCommand } from './commands.ts';

/**
 * A season across the whole map in one go (environment Phase 5): MapMaker's Environment pane sets every placed
 * species to its look for the season (the oaks and maples autumn, the pines snow-laden, the grass dry), as one undo
 * step. It only changes each placement's look (`variant`): the looks of a species share its collision, size and
 * concealment, so play is unchanged, and the map format is too (it is the same edit as picking a look by hand).
 *
 * Looks chosen on purpose stay: a placement whose look is not a seasonal one (mossy boulders, red sandstone, the
 * flowers' colours, the spruce's alpine look) is left alone. A species with no look for the season goes back to its
 * first look (an evergreen in autumn stays green). Summer takes every seasonal look back to the first.
 */
export const ENV_SEASONS = ['summer', 'autumn', 'snow', 'dry'] as const;
export type EnvSeason = (typeof ENV_SEASONS)[number];

export const ENV_SEASON_LABELS: Record<EnvSeason, string> = { summer: 'Summer (as painted)', autumn: 'Autumn', snow: 'Snow-dusted', dry: 'Dry season' };

/** The look names that are a season's (and so may be changed by another season). */
const SEASONAL = new Set(['autumn', 'snow', 'dry', 'straw']);

/** A season's looks by preference; `ground`: also for ground cover and plants only (dry grass in autumn). */
const LOOKS: Record<Exclude<EnvSeason, 'summer'>, { all: readonly string[]; ground: readonly string[] }> = {
  autumn: { all: ['autumn'], ground: ['dry', 'straw'] },
  snow: { all: ['snow'], ground: [] },
  dry: { all: ['dry', 'straw'], ground: [] },
};

/** The look a placement of `model` (now `variant`) takes for `season`; the same variant when it keeps its look. */
export function seasonVariant(model: string, variant: number | undefined, season: EnvSeason): number | undefined {
  const s = getEnvSpecies(model);
  if (!s) return variant;
  const now = s.variants.find((v) => v.index === (variant ?? 0)) ?? s.variants[0]!;
  if (now.index !== s.variants[0]!.index && !SEASONAL.has(now.name)) return variant;
  if (season === 'summer') return undefined;
  const want = LOOKS[season];
  const names = s.category === 'groundcover' || s.category === 'plant' ? [...want.all, ...want.ground] : want.all;
  for (const name of names) {
    const v = s.variants.find((x) => x.name === name);
    if (v) return v.index === 0 ? undefined : v.index;
  }
  return undefined;
}

/** The edit setting the whole map to `season` (null when nothing changes). */
export function seasonCommand(doc: MapDocument, season: EnvSeason): (EditCommand & { kind: 'updateEntities' }) | null {
  const before: PropEntity[] = [];
  const after: PropEntity[] = [];
  for (const e of doc.entities) {
    if (e.kind !== 'prop' || !getEnvSpecies(e.model)) continue;
    const v = seasonVariant(e.model, e.variant, season);
    if ((v ?? 0) === (e.variant ?? 0)) continue;
    const { variant: _old, ...rest } = e;
    before.push(e);
    after.push(v === undefined ? rest : { ...rest, variant: v });
  }
  return before.length ? { kind: 'updateEntities', before, after } : null;
}
