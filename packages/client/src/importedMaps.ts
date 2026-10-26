/**
 * Maps converted from TimeSplitters MapMaker saves
 * (packages/server/src/tools/import-timesplitters.ts). One small chunk per
 * map, loaded after the menu is up and only when asked for: the verified ones
 * (VISIBLE_IMPORTED_MAPS) for the Arcade, all of them with `?imported`, or
 * one with `?offline=<id>`.
 */
const LOADERS = import.meta.glob<unknown>('../../../maps/imported/*.json', { import: 'default' });

export const importedPath = (id: string): string => `../../../maps/imported/${id}.json`;

/** The map files for `ids` (every imported map when omitted), keyed by path like import.meta.glob. */
export async function loadImportedMaps(ids?: readonly string[]): Promise<Record<string, unknown>> {
  const paths = ids ? ids.map(importedPath).filter((p) => p in LOADERS) : Object.keys(LOADERS);
  const out: Record<string, unknown> = {};
  await Promise.all(paths.map(async (p) => void (out[p] = await LOADERS[p]!())));
  return out;
}
