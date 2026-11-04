/**
 * Loads mapContent.ts (the tile and prop tables and what reads them) once; a
 * failed load is tried again next time. The menu's first download leaves it
 * out (tools/ci/bundle-budget.mjs, docs/LOADING.md): the first map card, match
 * or MapMaker to need it fetches it, alongside the map it is for.
 */
export type MapContent = typeof import('./mapContent.ts');

let loading: Promise<MapContent> | undefined;
let loaded: MapContent | undefined;

export function loadMapContent(): Promise<MapContent> {
  return (loading ??= import('./mapContent.ts').then(
    (m) => (loaded = m),
    (e: unknown) => {
      loading = undefined;
      throw e;
    },
  ));
}

/** The map content if it has loaded already (draw in the same frame), else undefined. */
export const mapContentNow = (): MapContent | undefined => loaded;
