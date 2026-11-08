/**
 * Every key MapMaker binds, in one table (docs/MAPMAKER_OVERHAUL_PLAN.md, Phase 1 item 5): MapMaker's keydown handler
 * finds the binding for a key here (`matchEditorKey`) and runs its action, the fly camera reads its held keys from
 * here, and the `?` overlay lists this same table, so the overlay can't go stale. Plain data: no DOM.
 */

/** What a key does; MapMaker maps each to its handler (a Record over this type, so none can be left out). */
export type KeyAction =
  | 'test'
  | 'undo'
  | 'redo'
  | 'save'
  | 'duplicate'
  | 'togglePalette'
  | 'toggleSidePanel'
  | 'rotate'
  | 'rotateFine'
  | 'mirror'
  | 'focus'
  | 'resetView'
  | 'logic'
  | 'paint'
  | 'terrain'
  | 'walls'
  | 'erase'
  | 'measure'
  | 'escape'
  | 'paths'
  | 'raceTrack'
  | 'scatter'
  | 'place'
  | 'pickStyle'
  | 'select'
  | 'showAll'
  | 'search'
  | 'keys'
  | 'delete'
  | 'levelUp'
  | 'levelDown'
  | 'liftSelection'
  | 'lowerSelection'
  | 'brushBigger'
  | 'brushSmaller'
  | 'nudgeNorth'
  | 'nudgeSouth'
  | 'nudgeWest'
  | 'nudgeEast';

export const KEY_GROUPS = ['Tools', 'Edit', 'Selection', 'Levels', 'View and camera', 'Brushes', 'Placing', 'Map and panels', 'Mouse', 'Palette'] as const;
export type KeyGroup = (typeof KEY_GROUPS)[number];

/** A key the handler acts on when it's pressed. */
export interface KeyBinding {
  action: KeyAction;
  group: KeyGroup;
  /** The key as the overlay and tooltips show it: "R", "Shift+R", "Ctrl+Z", "PgUp". */
  keys: string;
  what: string;
  /** KeyboardEvent.code values it answers to. */
  codes: readonly string[];
  /** Or KeyboardEvent.key values (layouts where "?" is elsewhere). */
  chars?: readonly string[];
  /** Ctrl (⌘ on a Mac) held: true; never held: absent. */
  mod?: boolean;
  /** Shift held (true), not held (false), either (absent). */
  shift?: boolean;
  /** Also while typing in a field or with a dialog open (F5). */
  always?: boolean;
}

/** A key or button the overlay lists that isn't pressed-and-handled: held (the fly camera), the mouse's, the palette's own. */
export interface KeyNote {
  group: KeyGroup;
  keys: string;
  what: string;
  /** Held keys: the codes MapMaker reads while they are down. */
  held?: readonly string[];
}

/** The fly camera's held keys (WASD, Q and E; Shift for faster). Ctrl or ⌘ held stops it (Ctrl+S, Ctrl+D…). */
export const FLY_KEYS = { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', up: 'KeyE', down: 'KeyQ', fast: 'ShiftLeft' } as const;
export const FLY_PAUSE_KEYS = ['ControlLeft', 'ControlRight', 'MetaLeft'] as const;
/** Held while measuring: no snapping (the measure tool). */
export const FREE_MEASURE_KEYS = ['ControlLeft', 'ControlRight', 'MetaLeft', 'AltLeft', 'AltRight'] as const;
/** Held while placing: no snapping (one rule for every kind). */
export const FREE_PLACE_KEYS = ['ControlLeft', 'ControlRight', 'MetaLeft', 'ShiftLeft', 'ShiftRight'] as const;

const tool = (action: KeyAction, keys: string, code: string, what: string): KeyBinding => ({ action, group: 'Tools', keys, what, codes: [code] });

/** Pressed keys, first match wins (so Ctrl+Shift+Z is before Ctrl+Z, Shift+R before R). */
export const EDITOR_KEYS: readonly KeyBinding[] = [
  { action: 'test', group: 'Map and panels', keys: 'F5', what: 'Play test the map with the chosen bots', codes: ['F5'], always: true },
  { action: 'redo', group: 'Edit', keys: 'Ctrl+Shift+Z', what: 'Redo', codes: ['KeyZ'], mod: true, shift: true },
  { action: 'undo', group: 'Edit', keys: 'Ctrl+Z', what: 'Undo', codes: ['KeyZ'], mod: true },
  { action: 'redo', group: 'Edit', keys: 'Ctrl+Y', what: 'Redo', codes: ['KeyY'], mod: true },
  { action: 'save', group: 'Map and panels', keys: 'Ctrl+S', what: 'Save the map (in this browser)', codes: ['KeyS'], mod: true },
  { action: 'duplicate', group: 'Selection', keys: 'Ctrl+D', what: 'Duplicate the selection', codes: ['KeyD'], mod: true },
  { action: 'toggleSidePanel', group: 'Map and panels', keys: 'Shift+\\', what: 'Hide or show the side panel', codes: ['Backslash'], shift: true },
  { action: 'togglePalette', group: 'Map and panels', keys: '\\', what: 'Hide or show the palette', codes: ['Backslash'], shift: false },
  tool('select', 'V', 'KeyV', 'Select: pick, move and edit things'),
  { action: 'escape', group: 'Tools', keys: 'Esc', what: 'Cancel a ring turn mid-drag, else clear a measurement, else back to Select (with Select in hand: select none)', codes: ['Escape'] },
  tool('place', 'P', 'KeyP', 'Place: the last piece picked from the palette'),
  tool('erase', 'X', 'KeyX', 'Erase: click anything to delete it'),
  tool('measure', 'U', 'KeyU', 'Measure: distance, height difference and slope between points'),
  tool('paint', 'B', 'KeyB', 'Paint surfaces'),
  tool('walls', 'O', 'KeyO', 'Walls & openings (again: the next style)'),
  tool('terrain', 'T', 'KeyT', 'Terrain (again: the next brush)'),
  { action: 'raceTrack', group: 'Tools', keys: 'Shift+G', what: 'Paths, on the race track', codes: ['KeyG'], shift: true },
  tool('paths', 'G', 'KeyG', 'Paths: roads, walks and tracks'),
  tool('scatter', 'N', 'KeyN', 'Scatter: the last set of plants or rocks'),
  tool('logic', 'L', 'KeyL', 'Open or close the logic panel'),
  { action: 'rotateFine', group: 'Selection', keys: 'Shift+R', what: 'Turn the selection or the piece being placed a finer step', codes: ['KeyR'], shift: true },
  { action: 'rotate', group: 'Selection', keys: 'R', what: 'Turn the selection or the piece being placed', codes: ['KeyR'], shift: false },
  { action: 'mirror', group: 'Selection', keys: 'M', what: 'Mirror the set piece (selected, or being placed)', codes: ['KeyM'] },
  { action: 'delete', group: 'Selection', keys: 'Del', what: 'Delete the selection (or a path point)', codes: ['Delete', 'Backspace'] },
  { action: 'nudgeNorth', group: 'Selection', keys: '↑', what: 'Move the selection north', codes: ['ArrowUp'] },
  { action: 'nudgeSouth', group: 'Selection', keys: '↓', what: 'Move the selection south', codes: ['ArrowDown'] },
  { action: 'nudgeWest', group: 'Selection', keys: '←', what: 'Move the selection west', codes: ['ArrowLeft'] },
  { action: 'nudgeEast', group: 'Selection', keys: '→', what: 'Move the selection east', codes: ['ArrowRight'] },
  { action: 'liftSelection', group: 'Levels', keys: 'Shift+PgUp', what: 'Move the selection up a level', codes: ['PageUp'], shift: true },
  { action: 'levelUp', group: 'Levels', keys: 'PgUp', what: 'Edit the level above', codes: ['PageUp'], shift: false },
  { action: 'lowerSelection', group: 'Levels', keys: 'Shift+PgDn', what: 'Move the selection down a level', codes: ['PageDown'], shift: true },
  { action: 'levelDown', group: 'Levels', keys: 'PgDn', what: 'Edit the level below', codes: ['PageDown'], shift: false },
  { action: 'showAll', group: 'Levels', keys: 'H', what: 'Show the levels above too', codes: ['KeyH'] },
  { action: 'focus', group: 'View and camera', keys: 'F', what: 'Frame the selection', codes: ['KeyF'] },
  { action: 'resetView', group: 'View and camera', keys: 'Home', what: "Back to the level's overview", codes: ['Home'] },
  { action: 'brushBigger', group: 'Brushes', keys: ']', what: 'Bigger brush (Terrain, Scatter)', codes: ['BracketRight'] },
  { action: 'brushSmaller', group: 'Brushes', keys: '[', what: 'Smaller brush (Terrain, Scatter)', codes: ['BracketLeft'] },
  { action: 'pickStyle', group: 'Brushes', keys: 'I', what: 'Paint: pick up the look under the pointer', codes: ['KeyI'] },
  { action: 'keys', group: 'Map and panels', keys: '?', what: 'This list of keys', codes: ['Slash'], chars: ['?'], shift: true },
  { action: 'search', group: 'Map and panels', keys: '/', what: 'Search the palette', codes: ['Slash'] },
];

/** The rest of what the overlay lists: held keys, the mouse, the palette's own keys. */
export const EDITOR_KEY_NOTES: readonly KeyNote[] = [
  { group: 'View and camera', keys: 'W A S D', what: 'Fly forward, left, back, right (hold)', held: [FLY_KEYS.forward, FLY_KEYS.left, FLY_KEYS.back, FLY_KEYS.right] },
  { group: 'View and camera', keys: 'Q E', what: 'Fly down, up (hold)', held: [FLY_KEYS.down, FLY_KEYS.up] },
  { group: 'View and camera', keys: 'Shift', what: 'Fly or zoom faster (hold)', held: [FLY_KEYS.fast] },
  { group: 'Placing', keys: 'Ctrl or Shift', what: 'Place without snapping (hold while placing)', held: FREE_PLACE_KEYS },
  { group: 'Placing', keys: 'Ctrl or Alt', what: 'Measure without snapping (hold while measuring)', held: FREE_MEASURE_KEYS },
  { group: 'Mouse', keys: 'Click', what: 'Place, select or act with the tool in hand' },
  { group: 'Mouse', keys: 'Shift+click', what: 'Add to the selection (Paths, Routes: put a point in)' },
  { group: 'Mouse', keys: 'Drag', what: 'Select: move it, or box-select on empty ground; brushes: paint a stroke' },
  { group: 'Mouse', keys: 'Alt+click', what: 'Select or Erase: just that piece of a moving build; Paint: pick up a look' },
  { group: 'Mouse', keys: 'Shift+drag', what: 'Terrain: the brush the other way (lower, for Raise)' },
  { group: 'Mouse', keys: 'Right-click', what: 'Select: the selection menu; Walls: back to automatic; paths: remove a point' },
  { group: 'Mouse', keys: 'Ring drag', what: "Select: drag the gizmo's ring to turn the selection (Shift: a finer step; Esc cancels)" },
  { group: 'Mouse', keys: 'Right-drag', what: 'Look round' },
  { group: 'Mouse', keys: 'Wheel', what: 'Zoom (Shift: faster)' },
  { group: 'Palette', keys: '↑ ↓ ← →', what: 'Move between pieces (from the search box: ↓)' },
  { group: 'Palette', keys: 'Enter', what: 'In the search box: pick the best match' },
  { group: 'Palette', keys: 'F', what: 'Add the focused piece to your favourites (or right-click it)' },
  { group: 'Palette', keys: 'Esc', what: 'In the search box: clear it' },
];

/** What a key press is, as the handler sees it (a KeyboardEvent has all of these). */
export interface KeyPress {
  code: string;
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/** The binding a key press runs, or null (the key is left to the browser). */
export function matchEditorKey(e: KeyPress): KeyBinding | null {
  const mod = e.ctrlKey || e.metaKey;
  for (const b of EDITOR_KEYS) {
    if (!b.always && !!b.mod !== mod) continue;
    if (b.chars?.includes(e.key)) return b;
    if (!b.codes.includes(e.code)) continue;
    if (b.shift !== undefined && b.shift !== e.shiftKey) continue;
    return b;
  }
  return null;
}

/** The overlay's rows by group, in the table's order: each pressed key once per key text, then the notes. */
export function editorKeyGroups(): { group: KeyGroup; rows: { keys: string; what: string }[] }[] {
  return KEY_GROUPS.map((group) => ({
    group,
    rows: [...EDITOR_KEYS.filter((b) => b.group === group), ...EDITOR_KEY_NOTES.filter((n) => n.group === group)].map((r) => ({ keys: r.keys, what: r.what })),
  })).filter((g) => g.rows.length);
}

/** The key text the table gives an action (its first binding), for tooltips and menus. */
export function keyFor(action: KeyAction): string {
  return EDITOR_KEYS.find((b) => b.action === action)?.keys ?? '';
}
