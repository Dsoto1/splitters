/**
 * MapMaker's mode tabs (MapMaker overhaul Phase 2 item 1): the top bar's Build, Props, Gameplay, Logic, Environment,
 * Paths and Test. Each mode has its own row of palette tabs (its panes, below) and its own part of the inspector with
 * nothing selected (modeInspector.ts). Every palette pane belongs to exactly one mode, so every tool stays reachable.
 * `ws` is the mode's id in the page (`data-ws`); Gameplay keeps the id `entities` it had as the Entities tab.
 */
export interface EditorMode {
  ws: string;
  label: string;
  /** Its palette panes (`data-pane`), the first one shown when the mode is picked. Logic has none: its panel opens. */
  panes: readonly string[];
  /** What the tab's tooltip says. */
  title: string;
}

export const EDITOR_MODES: readonly EditorMode[] = [
  { ws: 'build', label: 'Build', panes: ['tiles', 'setpieces', 'advanced'], title: 'Build: tiles, set pieces, walls and openings' },
  { ws: 'props', label: 'Props', panes: ['props', 'lights'], title: 'Props: furniture, clutter and dressing by theme; lights and liquids' },
  { ws: 'entities', label: 'Gameplay', panes: ['entities', 'npcs', 'vehicles', 'scenario'], title: 'Gameplay: spawns, objectives and pickups, NPCs, vehicles, doors, logic objects and traps' },
  { ws: 'logic', label: 'Logic', panes: [], title: 'Scenario logic: objectives, variables, timers, rules (L)' },
  { ws: 'environment', label: 'Environment', panes: ['paint', 'plants', 'terrain', 'sky'], title: 'Environment: paint, plants and terrain; sky, backdrop and border' },
  { ws: 'paths', label: 'Paths', panes: ['paths'], title: 'Paths: roads, streets and trails, the track for NPC traffic, AI routes and drop routes' },
  { ws: 'test', label: 'Test', panes: ['test'], title: 'Test: play the map, play from here, the bot test and the plan view' },
];

/** The mode a palette pane belongs to. */
export function paneMode(pane: string): EditorMode | undefined {
  return EDITOR_MODES.find((m) => m.panes.includes(pane));
}

/** The pane a mode opens on. */
export function firstPane(ws: string): string {
  return EDITOR_MODES.find((m) => m.ws === ws)?.panes[0] ?? 'tiles';
}
