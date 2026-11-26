import { keysShape } from '@tiletrigger/shared';
import { inputMode } from '../inputMode.ts';

/**
 * Every keyboard and mouse action in one table (owner, 2026-11-23: "Q and E need to be the peeks. we need a way to
 * remap controls"; docs/CONTROLS.md). Input (input.ts), the menus, the hints and the HUD prompts read the keys from
 * here, and Options → Controls rebinds them: each action has two slots (a key and an alternative), a slot holds a key
 * code (`KeyQ`, `Space`) or a mouse code (`Mouse0` left, `Mouse1` middle, `Mouse2` right, `MouseSide` either side
 * button, `WheelUp` / `WheelDown`), or '' for none.
 *
 * Kept in this browser (`tiletrigger.keys`: only the actions changed from the defaults, so a later default reaches
 * everyone who kept it) and, signed in, on the account (careerStats.ts syncKeys). The old stores (the wheel key, the
 * lean keys, the category keys) move in once (`migrateOldKeys`).
 */

export type BindGroup = 'move' | 'combat' | 'weapons' | 'comms' | 'vehicles' | 'spectate' | 'menus';
/** Where an action works: two actions clash only when they share a key and a place. */
export type BindPlace = 'foot' | 'vehicle' | 'spectate' | 'menu';

export interface BindAction {
  id: string;
  label: string;
  group: BindGroup;
  places: readonly BindPlace[];
  /** The default key and alternative ('' for none). */
  keys: readonly [string, string];
  /** A short note shown under the action on the Controls page. */
  note?: string;
  /** May share its key with the weapon wheel: a tap does this, a hold opens the wheel. */
  tap?: true;
}

export const BIND_GROUPS: readonly { id: BindGroup; label: string }[] = [
  { id: 'move', label: 'Move' },
  { id: 'combat', label: 'Combat' },
  { id: 'weapons', label: 'Weapons' },
  { id: 'comms', label: 'Comms' },
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'spectate', label: 'Spectate and free camera' },
  { id: 'menus', label: 'Menus' },
];

const PLAY: readonly BindPlace[] = ['foot', 'vehicle'];
const ALL_PLAY: readonly BindPlace[] = ['foot', 'vehicle', 'spectate'];

export const CATEGORY_ACTIONS = ['cat1', 'cat2', 'cat3', 'cat4', 'cat5', 'cat6', 'cat7', 'cat8'] as const;
const CATEGORY_NAMES = ['Pistols', 'SMGs', 'Rifles', 'Shotguns', 'Snipers', 'Heavy', 'Energy', 'Melee & gadgets'];

export const BIND_ACTIONS: readonly BindAction[] = [
  // Move
  { id: 'forward', label: 'Forward', group: 'move', places: ALL_PLAY, keys: ['KeyW', ''] },
  { id: 'back', label: 'Back', group: 'move', places: ALL_PLAY, keys: ['KeyS', ''] },
  { id: 'left', label: 'Left', group: 'move', places: ALL_PLAY, keys: ['KeyA', ''] },
  { id: 'right', label: 'Right', group: 'move', places: ALL_PLAY, keys: ['KeyD', ''] },
  { id: 'jump', label: 'Jump (stands you up)', group: 'move', places: ['foot'], keys: ['Space', ''] },
  { id: 'sprint', label: 'Sprint · hold breath through a scope', group: 'move', places: ['foot'], keys: ['ShiftLeft', ''], note: 'Uses stamina. Sprint, then crouch: a slide.' },
  { id: 'crouch', label: 'Crouch (toggle)', group: 'move', places: ['foot'], keys: ['KeyC', ''] },
  { id: 'prone', label: 'Prone (toggle)', group: 'move', places: ['foot'], keys: ['KeyZ', ''] },
  { id: 'leanLeft', label: 'Lean left (peek; hold)', group: 'move', places: ['foot'], keys: ['KeyQ', ''] },
  { id: 'leanRight', label: 'Lean right (peek; hold)', group: 'move', places: ['foot'], keys: ['KeyE', ''] },
  { id: 'dodge', label: 'Dodge · crouched or sprinting: combat roll', group: 'move', places: ['foot'], keys: ['KeyV', ''], note: 'Uses stamina. A quick step the way you move (back, with no direction).' },
  { id: 'thirdPerson', label: 'Third person', group: 'move', places: ['foot'], keys: ['KeyH', ''] },
  { id: 'lookLeft', label: 'Look left (touchpad, keyboard)', group: 'move', places: PLAY, keys: ['ArrowLeft', ''] },
  { id: 'lookRight', label: 'Look right', group: 'move', places: PLAY, keys: ['ArrowRight', ''] },
  { id: 'lookUp', label: 'Look up', group: 'move', places: PLAY, keys: ['ArrowUp', ''] },
  { id: 'lookDown', label: 'Look down', group: 'move', places: PLAY, keys: ['ArrowDown', ''] },
  // Combat
  { id: 'fire', label: 'Fire', group: 'combat', places: PLAY, keys: ['Mouse0', 'AltLeft'] },
  { id: 'aim', label: 'Aim down sights / scope', group: 'combat', places: PLAY, keys: ['Mouse2', 'Backquote'], note: 'Hold or toggle: Accessibility → Aim.' },
  { id: 'altFire', label: 'Second trigger (alt fire)', group: 'combat', places: PLAY, keys: ['Mouse1', ''], note: 'Its V went to Dodge (2026-11-25): a touchpad without a middle button can give it a key here.' },
  { id: 'melee', label: 'Quick melee', group: 'combat', places: ['foot'], keys: ['MouseSide', 'KeyY'], note: 'A punch; a kick on the move or after a punch.' },
  { id: 'reload', label: 'Reload', group: 'combat', places: PLAY, keys: ['KeyR', ''] },
  { id: 'throw', label: 'Throw grenade or mine (hold to aim)', group: 'combat', places: ['foot'], keys: ['KeyG', ''] },
  { id: 'fireMode', label: 'Fire mode', group: 'combat', places: ['foot'], keys: ['KeyU', ''] },
  { id: 'use', label: 'Use · doors · get in or out', group: 'combat', places: PLAY, keys: ['KeyF', ''], note: 'Hold it to resupply.' },
  { id: 'respawn', label: 'Respawn', group: 'combat', places: ['foot', 'spectate'], keys: ['KeyK', ''] },
  { id: 'classMenu', label: 'Class screen', group: 'combat', places: ['foot', 'spectate'], keys: ['KeyL', 'Comma'] },
  // Weapons
  { id: 'weaponWheel', label: 'Weapon wheel (hold)', group: 'weapons', places: ['foot'], keys: ['Tab', ''], note: 'Point at a slice and let go to switch. A tap of its key does what else shares it.' },
  { id: 'lastWeapon', label: 'Last weapon', group: 'weapons', places: ['foot'], keys: ['KeyX', ''], tap: true },
  { id: 'nextWeapon', label: 'Next weapon', group: 'weapons', places: ['foot'], keys: ['WheelDown', ''] },
  { id: 'prevWeapon', label: 'Previous weapon', group: 'weapons', places: ['foot'], keys: ['WheelUp', ''] },
  ...CATEGORY_ACTIONS.map((id, i): BindAction => ({ id, label: `${CATEGORY_NAMES[i]}${i === 0 ? ' (again: the next one)' : ''}`, group: 'weapons', places: ['foot'], keys: [`Digit${i + 1}`, ''] })),
  // Comms
  { id: 'quickMessage', label: 'Quick messages · hold: orders (fireteam lead)', group: 'comms', places: ['foot', 'spectate'], keys: ['KeyB', ''] },
  { id: 'ping', label: 'Ping', group: 'comms', places: ['foot'], keys: ['KeyT', ''] },
  { id: 'dance', label: 'Dance', group: 'comms', places: ['foot'], keys: ['KeyN', ''] },
  { id: 'chat', label: 'Chat (type a line; Tab in the box: team or all)', group: 'comms', places: ALL_PLAY, keys: ['Enter', ''], note: 'Online, when the host relays chat. Enter sends, Esc closes.' },
  { id: 'teamChat', label: 'Team chat', group: 'comms', places: ALL_PLAY, keys: ['KeyI', ''] },
  // Vehicles
  { id: 'vehicleUp', label: 'Brake · climb (aircraft) · jump out (plane)', group: 'vehicles', places: ['vehicle'], keys: ['Space', ''] },
  { id: 'vehicleDown', label: 'Descend (aircraft) · duck where you stand', group: 'vehicles', places: ['vehicle'], keys: ['KeyC', ''] },
  { id: 'vehicleCamera', label: 'Cockpit or chase camera', group: 'vehicles', places: ['vehicle'], keys: ['KeyH', ''] },
  // Spectate
  { id: 'specCamera', label: 'Follow players or free camera', group: 'spectate', places: ['spectate'], keys: ['Space', ''] },
  { id: 'specNext', label: 'Next player (or a left click)', group: 'spectate', places: ['spectate'], keys: ['ArrowRight', ''] },
  { id: 'specPrev', label: 'Previous player (or a right click)', group: 'spectate', places: ['spectate'], keys: ['ArrowLeft', ''] },
  { id: 'freeUp', label: 'Free camera up', group: 'spectate', places: ['spectate'], keys: ['KeyE', ''] },
  { id: 'freeDown', label: 'Free camera down', group: 'spectate', places: ['spectate'], keys: ['KeyQ', 'ControlLeft'] },
  { id: 'freeFast', label: 'Free camera faster', group: 'spectate', places: ['spectate'], keys: ['ShiftLeft', ''] },
  { id: 'joinGame', label: 'Join the game (spectating)', group: 'spectate', places: ['spectate'], keys: ['KeyJ', ''] },
  // Menus
  { id: 'scoreboard', label: 'Scoreboard', group: 'menus', places: ALL_PLAY, keys: ['Tab', ''], tap: true, note: 'Sharing the weapon wheel\'s key, a tap shows it and another hides it; on its own key, hold it.' },
  { id: 'bigMap', label: 'Big map', group: 'menus', places: ALL_PLAY, keys: ['KeyM', ''] },
  { id: 'switchTeam', label: 'Switch team (next respawn)', group: 'menus', places: ['foot', 'spectate'], keys: ['KeyO', ''] },
  { id: 'menuPrev', label: 'Previous tab (menus, pause)', group: 'menus', places: ['menu'], keys: ['KeyQ', ''] },
  { id: 'menuNext', label: 'Next tab (menus, pause)', group: 'menus', places: ['menu'], keys: ['KeyE', ''] },
  { id: 'menuFilter', label: 'Filter maps (Match setup)', group: 'menus', places: ['menu'], keys: ['KeyF', ''] },
];

/** Keys that keep their job and can't be bound: shown on the page as fixed. */
export const FIXED_KEYS: readonly [string, string][] = [
  ['Pause · back', 'Esc'],
  ['Pick in an open menu (quick messages, classes, Roulette)', '1–9 · 0 - = (quick messages)'],
  ['Performance overlay', 'F3'],
  ['Fullscreen', 'F11 · Alt+Enter'],
];
/** Codes no action may take (the browser's or a fixed job's). */
export const UNBINDABLE: ReadonlySet<string> = new Set(['Escape', 'F3', 'F5', 'F11', 'MetaLeft', 'MetaRight', 'ContextMenu']);

const BY_ID = new Map(BIND_ACTIONS.map((a) => [a.id, a]));
export const bindAction = (id: string): BindAction | undefined => BY_ID.get(id);

/** Action id → its two keys. */
export type Bindings = Record<string, [string, string]>;

export function defaultBindings(): Bindings {
  const out: Bindings = {};
  for (const a of BIND_ACTIONS) out[a.id] = [a.keys[0], a.keys[1]];
  return out;
}

/** A code a slot may hold: a key or mouse code (letters and digits), or '' for none. */
export const isBindCode = (c: unknown): c is string => typeof c === 'string' && /^[A-Za-z0-9]{0,24}$/.test(c) && !UNBINDABLE.has(c);

/** Whether two actions may share a key: different places, or the weapon wheel with a tap action. */
export function mayShare(a: BindAction, b: BindAction): boolean {
  if (a.id === b.id) return true;
  if (!a.places.some((p) => b.places.includes(p))) return true;
  return (a.id === 'weaponWheel' && !!b.tap) || (b.id === 'weaponWheel' && !!a.tap);
}

/** The actions `code` would clash with if `action` took it (none: it's free there). */
export function clashesFor(b: Bindings, action: string, code: string): string[] {
  const me = BY_ID.get(action);
  if (!me || !code) return [];
  const out: string[] = [];
  for (const other of BIND_ACTIONS) {
    if (other.id === action || mayShare(me, other)) continue;
    if (b[other.id]?.includes(code)) out.push(other.id);
  }
  // Two tap actions on the wheel's key: only one tap job.
  if (me.tap) {
    const wheel = b.weaponWheel ?? ['', ''];
    if (wheel.includes(code)) for (const other of BIND_ACTIONS) if (other.tap && other.id !== action && b[other.id]?.includes(code)) out.push(other.id);
  }
  return [...new Set(out)];
}

/** Every clash in a table: [action, action, code]. */
export function allClashes(b: Bindings): [string, string, string][] {
  const out: [string, string, string][] = [];
  for (const a of BIND_ACTIONS) for (const code of b[a.id] ?? []) for (const o of clashesFor(b, a.id, code)) if (a.id < o) out.push([a.id, o, code]);
  return out;
}

/** `action`'s slot `slot` takes `code` (a copy; the same key in its other slot is cleared). */
export function setKey(b: Bindings, action: string, slot: 0 | 1, code: string): Bindings {
  const next = cloneBindings(b);
  const keys = (next[action] ??= ['', '']);
  keys[slot] = code;
  if (code && keys[1 - slot] === code) keys[1 - slot] = '';
  return next;
}

/**
 * `action` takes `code` in `slot` and every action it clashes with gets `action`'s old key there instead (or none, if
 * that would clash again): the Controls page's Swap.
 */
export function swapKey(b: Bindings, action: string, slot: 0 | 1, code: string): Bindings {
  const old = b[action]?.[slot] ?? '';
  const others = clashesFor(b, action, code);
  let next = setKey(b, action, slot, code);
  for (const o of others) {
    const i = next[o]!.indexOf(code) as 0 | 1;
    next = setKey(next, o, i, '');
    if (old && clashesFor(next, o, old).length === 0) next = setKey(next, o, i, old);
  }
  return next;
}

export const cloneBindings = (b: Bindings): Bindings => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, [v[0], v[1]]])) as Bindings;

/** Only what differs from the defaults: action → "key,alt". */
export function bindingsDiff(b: Bindings): Record<string, string> {
  const def = defaultBindings();
  const out: Record<string, string> = {};
  for (const a of BIND_ACTIONS) {
    const k = b[a.id];
    if (k && (k[0] !== def[a.id]![0] || k[1] !== def[a.id]![1])) out[a.id] = `${k[0]},${k[1]}`;
  }
  return out;
}

/**
 * A table from a stored diff (unknown actions and bad codes dropped); anything that then clashes goes back to the
 * stored side's choice: an action the player set wins over a default it collides with, which loses that key.
 */
export function bindingsFromDiff(diff: Readonly<Record<string, string>> | null | undefined): Bindings {
  let b = defaultBindings();
  if (!diff) return b;
  const set: string[] = [];
  for (const [id, v] of Object.entries(diff)) {
    if (!BY_ID.has(id) || typeof v !== 'string') continue;
    const [k0 = '', k1 = ''] = v.split(',');
    if (!isBindCode(k0) || !isBindCode(k1)) continue;
    b[id] = [k0, k1 === k0 ? '' : k1];
    set.push(id);
  }
  b = settle(b, set);
  return b;
}

/** Clear the keys of untouched actions that clash with the ones in `wins` (the player's own choices). */
function settle(b: Bindings, wins: readonly string[]): Bindings {
  let next = b;
  for (const id of wins) {
    for (const code of next[id]!) {
      if (!code) continue;
      for (const o of clashesFor(next, id, code)) {
        if (wins.includes(o)) continue;
        const i = next[o]!.indexOf(code) as 0 | 1;
        next = setKey(next, o, i, '');
      }
    }
  }
  return next;
}

// ---------------------------------------------------------------- the stores

const KEYS_PREF = 'tiletrigger.keys';
/** The stores before the bindings table (input.ts until 2026-11-23). */
const OLD_WHEEL = 'tiletrigger.wheelKey';
const OLD_LEAN = 'tiletrigger.leanKeys';
const OLD_CATEGORIES = 'tiletrigger.categoryKeys';
/** Their defaults: a stored value equal to these was not a choice (the Default buttons saved them too). */
const OLD_DEFAULTS = { wheel: 'KeyQ', lean: { left: 'Backquote', right: 'AltLeft' } };

const storage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

/**
 * The old stores as a diff (players who rebound keep their choices): a lean key or a wheel key the player picked, and
 * category keys off 1-8. Only values that were choices: the old defaults give way to the new ones (Q / E lean).
 */
export function migrateOldKeys(read: (k: string) => string | null): Record<string, string> {
  const diff: Record<string, string> = {};
  const def = defaultBindings();
  const json = (k: string): unknown => {
    try {
      return JSON.parse(read(k) ?? 'null');
    } catch {
      return null;
    }
  };
  const wheel = read(OLD_WHEEL);
  if (wheel && isBindCode(wheel) && wheel !== OLD_DEFAULTS.wheel) diff.weaponWheel = `${wheel},`;
  const lean = json(OLD_LEAN) as { left?: unknown; right?: unknown } | null;
  if (lean && typeof lean === 'object') {
    if (isBindCode(lean.left) && lean.left && lean.left !== OLD_DEFAULTS.lean.left) diff.leanLeft = `${lean.left},`;
    if (isBindCode(lean.right) && lean.right && lean.right !== OLD_DEFAULTS.lean.right) diff.leanRight = `${lean.right},`;
  }
  const cats = json(OLD_CATEGORIES);
  if (Array.isArray(cats) && cats.length === CATEGORY_ACTIONS.length && cats.every((c) => isBindCode(c) && c)) {
    cats.forEach((c: string, i) => {
      if (c !== def[CATEGORY_ACTIONS[i]!]![0]) diff[CATEGORY_ACTIONS[i]!] = `${c},`;
    });
  }
  return diff;
}

let current: Bindings | null = null;
const listeners = new Set<(b: Bindings) => void>();

function readStored(): Bindings {
  const s = storage();
  let diff: Record<string, string> | null = null;
  try {
    const raw = s?.getItem(KEYS_PREF);
    if (raw) diff = keysShape(JSON.parse(raw));
    else if (s) {
      // First time with the table: the old stores move in, once.
      diff = migrateOldKeys((k) => s.getItem(k));
      s.setItem(KEYS_PREF, JSON.stringify(diff));
    }
  } catch {
    diff = null;
  }
  return bindingsFromDiff(diff);
}

/** The bindings now (a shared table: don't change it, use setBindings). */
export function bindings(): Bindings {
  return (current ??= readStored());
}

/** Take a new table: kept in this browser, and listeners (the match's input, the account) told. */
export function setBindings(b: Bindings, quiet = false): void {
  current = cloneBindings(b);
  try {
    storage()?.setItem(KEYS_PREF, JSON.stringify(bindingsDiff(current)));
  } catch {
    // Storage blocked: this page only.
  }
  if (!quiet) for (const cb of listeners) cb(current);
}

/** Back to the defaults. */
export const resetBindings = (): void => setBindings(defaultBindings());

/** Your changes from the defaults (what the account keeps). */
export const myKeys = (): Record<string, string> => bindingsDiff(bindings());

/** Take the account's table (careerStats.ts syncKeys). */
export function replaceMyKeys(diff: Readonly<Record<string, string>>, quiet = false): void {
  setBindings(bindingsFromDiff(diff), quiet);
}

/** Told of every change; returns the unsubscribe. */
export function onBindingsChange(cb: (b: Bindings) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** For tests: forget the loaded table. */
export function _resetBindingsCache(): void {
  current = null;
}

// ---------------------------------------------------------------- labels

const NAMED: Record<string, string> = {
  Backquote: '`', CapsLock: 'Caps Lock', AltLeft: 'Left Alt', AltRight: 'Right Alt', ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl', ShiftLeft: 'Shift', ShiftRight: 'Right Shift',
  Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\', Slash: '/', Period: '.', Comma: ',', Minus: '-', Equal: '=', Space: 'Space', Enter: 'Enter', Backspace: 'Backspace',
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  Mouse0: 'Left mouse', Mouse1: 'Middle mouse', Mouse2: 'Right mouse', MouseSide: 'Side mouse', WheelUp: 'Wheel up', WheelDown: 'Wheel down',
};

/** "KeyQ" → "Q", "Mouse2" → "Right mouse": how a code reads. */
export function keyLabel(code: string): string {
  if (!code) return '—';
  return NAMED[code] ?? code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
}

/** An action's key as a hint shows it: its first key (or its alternative), "—" when it has none. */
export function keyFor(action: string, b: Bindings = bindings()): string {
  const k = b[action];
  return keyLabel(k?.[0] || k?.[1] || '');
}

/** What a controller uses for an action (input.ts pollPad); an action not here has no button. */
export const PAD_HINTS: Readonly<Record<string, string>> = {
  use: 'RB', jump: 'A', vehicleUp: 'A', crouch: 'B', vehicleDown: 'B', reload: 'X', fire: 'RT', aim: 'LT', throw: 'LB', sprint: 'L3', dodge: 'LT + B',
  nextWeapon: 'Y', thirdPerson: 'R3', vehicleCamera: 'R3', ping: 'D-pad up', respawn: 'D-pad down', specNext: 'RB', specPrev: 'LB', specCamera: 'Y',
};

/** What an in-game hint shows for an action: the controller's button when the last input was a controller, else its key. */
export function hintKey(action: string, b: Bindings = bindings()): string {
  return (inputMode() === 'pad' && PAD_HINTS[action]) || keyFor(action, b);
}

/** Both keys of an action, "F · Left Alt". */
export function keysFor(action: string, b: Bindings = bindings()): string {
  const k = (b[action] ?? ['', '']).filter(Boolean);
  return k.length ? k.map(keyLabel).join(' · ') : '—';
}

/** A browser mouse button (PointerEvent.button) as a code. */
export const mouseCode = (button: number): string => (button === 0 ? 'Mouse0' : button === 1 ? 'Mouse1' : button === 2 ? 'Mouse2' : button === 3 || button === 4 ? 'MouseSide' : '');

/** Whether a key press is a menu action's key (`menuPrev`, `menuNext`, `menuFilter`): the menus and pause read them here. */
export function isMenuKey(action: 'menuPrev' | 'menuNext' | 'menuFilter', code: string, b: Bindings = bindings()): boolean {
  return !!code && (b[action] ?? ['', '']).includes(code);
}
