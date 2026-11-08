/**
 * The keys MapMaker overhaul Phase 3 part A adds (Play from here, the plan view), in one place until the key table
 * (`editor/keymap.ts`, `wip/mapmaker-p1a`) is on main: then these rows move into it. Same shape as its rows.
 */
export interface WorkflowKey {
  action: 'playFromHere' | 'planView';
  keys: string;
  what: string;
  codes: readonly string[];
  shift?: boolean;
}

export const WORKFLOW_KEYS: readonly WorkflowKey[] = [
  { action: 'playFromHere', keys: 'Shift+F5', what: 'Play from here: test the map standing below the camera, facing where it looks', codes: ['F5'], shift: true },
  { action: 'planView', keys: 'K', what: 'Plan view: the level from straight above, with spawns, objectives and pickups (again: back)', codes: ['KeyK'] },
];
