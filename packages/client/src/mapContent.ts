/**
 * What reads the tile and prop tables (map/catalog.ts, the Style Pack pieces in
 * packTiles*.ts, content/props.generated.ts, editor/stylePacks.ts): loading and
 * checking a map, its geometry and its plan (its meshes: mapMeshes.ts, with a
 * match or MapMaker). The menu draws none of
 * it until a map is drawn, opened or played, so this is a chunk of its own,
 * loaded through loadMapContent() (mapContentLoader.ts) like the maps
 * themselves; a match and MapMaker import the same modules. See docs/LOADING.md.
 */
export { buildMapGeometry, loadMap, newMapDocument } from '@tiletrigger/shared';
export { drawMapPlan } from './frontend/mapPlan.ts';
