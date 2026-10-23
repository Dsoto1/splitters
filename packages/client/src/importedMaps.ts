/**
 * Maps converted from TimeSplitters MapMaker saves
 * (packages/server/src/tools/import-timesplitters.ts). Their own chunk, loaded
 * after the menu is up, so the many imported maps never slow the first screen.
 */
export const IMPORTED_MAPS = import.meta.glob<unknown>('../../../maps/imported/*.json', { eager: true, import: 'default' });
