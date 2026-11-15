import type { EditorApp } from './editorApp.ts';
import type { Tool } from './editorParts.ts';

/**
 * The contextual tool bar's table (MapMaker UI spec Phase 1, the owner's answer 2): which tools and actions each
 * workspace tab shows on its bar, and the overflow menu, which lists every one of them in every tab, so nothing is
 * lost when a tab leaves a tool off its bar. Paint, Terrain and the Environment brush are on Environment's bar only.
 * Keys are the key table's (shared editor/keymap.ts); this table only says where a tool shows. No DOM here: the bar
 * and the menu are built by toolBar.ts.
 */

/** A workspace tab (`data-ws`, editorModes.ts). */
export type Ws = 'build' | 'props' | 'entities' | 'logic' | 'environment' | 'paths' | 'test';

export interface BarTool {
  /** The bar button's id (kept from the fixed bar where a button had one: e2e flows and the tour use them). */
  id: string;
  label: string;
  /** Icon key (toolBar.ts BAR_ICONS). */
  icon: string;
  /** The key, as the key list shows it; absent: no key. */
  key?: string;
  title: string;
  /** The tabs whose bar shows it; [] for the overflow menu only. */
  tabs: readonly Ws[];
  /** The overflow menu's group. */
  group: 'Tools' | 'Selection' | 'Views and checks' | 'Map tools' | 'Help';
  /** The tool kinds that light it (it is the tool in hand). */
  lights?: readonly Tool['kind'][];
  /** Lit only when this also holds (Terrain and Ground paint share the terrain tool: its brush tells them apart). */
  litWhen?: (app: EditorApp) => boolean;
  /** Only live with a selection. */
  needsSelection?: boolean;
  run: (app: EditorApp) => void;
}

const ALL: readonly Ws[] = ['build', 'props', 'entities', 'logic', 'environment', 'paths', 'test'];
/** The tabs that edit what's placed (the selection's Rotate and Delete). */
const EDITING: readonly Ws[] = ['build', 'props', 'entities', 'logic', 'environment', 'paths'];
const PLACING_KINDS: readonly Tool['kind'][] = ['tile', 'setpiece', 'spawn', 'pickup', 'scenario', 'prop', 'mount', 'npc'];

export const BAR_TOOLS: readonly BarTool[] = [
  { id: 'ed-tb-select', label: 'Select', icon: 'select', key: 'V', title: 'Select, move and edit things', tabs: ALL, group: 'Tools', lights: ['select'], run: (a) => a.setTool({ kind: 'select' }) },
  { id: 'ed-tb-place', label: 'Place', icon: 'place', key: 'P', title: 'Place the last piece you picked from the palette', tabs: ['build', 'props', 'entities'], group: 'Tools', lights: PLACING_KINDS, run: (a) => a.placeTool() },
  { id: 'ed-tb-erase', label: 'Erase', icon: 'erase', key: 'X', title: 'Erase: click anything to delete it', tabs: ['build', 'props', 'entities', 'environment', 'paths'], group: 'Tools', lights: ['erase'], run: (a) => a.setTool({ kind: 'erase' }) },
  { id: 'ed-tb-walls', label: 'Walls', icon: 'edge', key: 'O', title: 'Walls & openings: doors, windows, arches on any side', tabs: ['build'], group: 'Tools', lights: ['edge'], run: (a) => a.paint.wallsTool(false) },
  { id: 'ed-tb-paint', label: 'Paint', icon: 'paint', key: 'B', title: 'Structure paint: tiles, blocks, bars and set pieces (never the ground)', tabs: ['build', 'environment'], group: 'Tools', lights: ['paint'], run: (a) => a.setTool({ kind: 'paint' }) },
  { id: 'ed-tb-groundpaint', label: 'Ground', icon: 'terrain', key: 'Shift+B', title: 'Ground paint: the ground only; buildings stay as they are', tabs: ['environment'], group: 'Tools', lights: ['terrain'], litWhen: (a) => a.terrain.terrainBrush === 'paint', run: (a) => a.terrain.setTerrainBrush('paint') },
  { id: 'ed-tb-terrain', label: 'Terrain', icon: 'terrain', key: 'T', title: 'Sculpt the terrain (raise, lower, smooth, flatten, roughen, plants)', tabs: ['environment'], group: 'Tools', lights: ['terrain'], litWhen: (a) => a.terrain.terrainBrush !== 'paint', run: (a) => a.terrain.terrainTool(false) },
  { id: 'ed-tb-envbrush', label: 'Plants', icon: 'envbrush', key: 'N', title: 'Environment brush: paint trees, rocks and plants as a mix (settings in the Nature tab)', tabs: ['environment'], group: 'Tools', lights: ['envbrush'], run: (a) => a.setTool({ kind: 'envbrush' }) },
  { id: 'ed-tb-paths', label: 'Paths', icon: 'path', key: 'G', title: 'Paths: roads, streets and trails (Shift+G: the track for NPC traffic)', tabs: ['paths'], group: 'Tools', lights: ['path', 'route'], run: (a) => a.setTool({ kind: 'path' }) },
  { id: 'ed-tb-bothints', label: 'Bot hints', icon: 'bothint', key: 'Y', title: 'Bot hints: mark spots, chokes and jumps for bots', tabs: ['entities', 'test'], group: 'Tools', lights: ['bothint'], run: (a) => a.setTool({ kind: 'bothint', hint: a.lastHint }) },
  { id: 'ed-tb-measure', label: 'Measure', icon: 'measure', key: 'U', title: 'Measure: distance, height difference and slope between points', tabs: ['test'], group: 'Tools', lights: ['measure'], run: (a) => a.setTool({ kind: 'measure' }) },
  { id: 'ed-tb-notes', label: 'Notes', icon: 'note', key: 'J', title: "Note pins: notes for the map's makers, shown in MapMaker only", tabs: ['test'], group: 'Tools', lights: ['note'], run: (a) => a.setTool({ kind: 'note' }) },
  { id: 'ed-tb-rotate', label: 'Rotate', icon: 'rotate', key: 'R', title: 'Rotate the selection, or the piece you are placing (Shift+R: a finer step)', tabs: EDITING, group: 'Selection', run: (a) => a.edits.rotate() },
  { id: 'ed-tb-delete', label: 'Delete', icon: 'delete', key: 'Del', title: 'Delete the selection', tabs: EDITING, group: 'Selection', needsSelection: true, run: (a) => a.edits.deleteSelection() },
  { id: 'ed-tb-mirror', label: 'Mirror', icon: 'mirror', key: 'M', title: 'Mirror the selected set pieces', tabs: [], group: 'Selection', needsSelection: true, run: (a) => a.edits.mirror() },
  { id: 'ed-tb-mirror-dialog', label: 'Mirror…', icon: 'mirror', key: 'Shift+M', title: 'Mirror the selection or half the map', tabs: [], group: 'Selection', run: (a) => a.edits.mirrorDialog() },
  { id: 'ed-tb-duplicate', label: 'Duplicate', icon: 'duplicate', key: 'Ctrl+D', title: 'Duplicate the selection', tabs: [], group: 'Selection', needsSelection: true, run: (a) => a.edits.duplicate() },
  { id: 'ed-tb-group', label: 'Group', icon: 'group', key: 'Ctrl+G', title: 'Group the selection: a click on any part picks them all', tabs: [], group: 'Selection', needsSelection: true, run: (a) => a.edits.group() },
  { id: 'ed-tb-ungroup', label: 'Ungroup', icon: 'group', key: 'Ctrl+Shift+G', title: 'Ungroup the selected groups', tabs: [], group: 'Selection', needsSelection: true, run: (a) => a.edits.ungroup() },
  { id: 'ed-tb-plan', label: 'Plan', icon: 'plan', key: 'K', title: 'Plan view: the level being edited from straight above, with spawns, objectives and pickups', tabs: ['test'], group: 'Views and checks', run: (a) => a.plan.toggle() },
  { id: 'ed-maptest', label: 'Bot test', icon: 'maptest', title: 'Test the map: a bot match in the background with heatmaps of where bots went, got stuck and died, and how exposed each spawn is', tabs: ['test'], group: 'Views and checks', run: (a) => a.mapTest.show(!a.mapTest.isShown) },
  { id: 'ed-tb-dress-all', label: 'Dress all bare rooms', icon: 'place', title: 'Furnish every room with no props in it, as a room type guessed from its size and the theme (undo takes it back)', tabs: [], group: 'Map tools', run: (a) => a.inspector.dressAllRooms() },
  { id: 'ed-tb-settle-all', label: 'Settle all props on ground', icon: 'terrain', title: 'Bed every prop standing on the terrain into the slope under it; props on floors and blocks stay put', tabs: [], group: 'Map tools', run: (a) => a.edits.settleProps() },
  { id: 'ed-tb-keys', label: 'Keys', icon: 'keys', key: '?', title: 'Every key MapMaker binds', tabs: ALL, group: 'Help', run: (a) => a.keyOverlay.open() },
  { id: 'ed-tb-help', label: 'Help', icon: 'help', title: 'Help: a short walk through making a map (a room, a spawn, a pickup, then test it)', tabs: ALL, group: 'Help', run: (a) => a.tour.start() },
];

/** The tools on a tab's bar, in the table's order. */
export function barToolsFor(ws: string): BarTool[] {
  return BAR_TOOLS.filter((t) => (t.tabs as readonly string[]).includes(ws));
}

/** The overflow menu: every tool and action, grouped, in every tab. */
export function overflowGroups(): { group: BarTool['group']; tools: BarTool[] }[] {
  const groups: BarTool['group'][] = ['Tools', 'Selection', 'Views and checks', 'Map tools', 'Help'];
  return groups.map((group) => ({ group, tools: BAR_TOOLS.filter((t) => t.group === group) }));
}

/** Whether `tool` (the one in hand) lights this bar tool. */
export function lightsFor(t: BarTool, tool: Tool, app?: EditorApp): boolean {
  return !!t.lights?.includes(tool.kind) && (!t.litWhen || !app || t.litWhen(app));
}
