import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EDITOR_KEYS, EDITOR_KEY_NOTES, FLY_KEYS, FREE_MEASURE_KEYS, FREE_PLACE_KEYS, editorKeyGroups, keyFor, matchEditorKey, type KeyAction } from '../src/index.ts';

/** Every KeyboardEvent.code a keyboard sends, near enough: letters, digits, F keys, punctuation, navigation, modifiers. */
const CODES = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => `Key${c}`),
  ...'0123456789'.split('').map((c) => `Digit${c}`),
  ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
  ...['Backquote', 'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Backslash', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash', 'IntlBackslash'],
  ...['Escape', 'Tab', 'CapsLock', 'Space', 'Enter', 'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
  ...['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'ContextMenu'],
  ...['Numpad0', 'Numpad5', 'NumpadAdd', 'NumpadEnter'],
];
/** The key a US layout gives for a code (enough for `?`). */
const keyOf = (code: string, shift: boolean) => (code === 'Slash' ? (shift ? '?' : '/') : code.startsWith('Key') ? (shift ? code.slice(3) : code.slice(3).toLowerCase()) : code);

/**
 * MapMaker's keydown handler before the key table (editorApp.ts, 2026-11-08, with Phase 1B's U and Esc), as data: what each key did. The table
 * must do the same, except Shift+/ (`?`), which now opens the key list (it searched the palette, as / does).
 */
function before(code: string, shift: boolean, mod: boolean): KeyAction | null {
  if (code === 'F5') return 'test';
  if (mod) return code === 'KeyZ' ? (shift ? 'redo' : 'undo') : code === 'KeyY' ? 'redo' : code === 'KeyS' ? 'save' : code === 'KeyD' ? 'duplicate' : null;
  if (code === 'Backslash') return shift ? 'toggleSidePanel' : 'togglePalette';
  const plain: Record<string, KeyAction> = {
    KeyR: shift ? 'rotateFine' : 'rotate',
    KeyM: 'mirror',
    KeyF: 'focus',
    Home: 'resetView',
    KeyL: 'logic',
    KeyB: 'paint',
    KeyT: 'terrain',
    KeyO: 'walls',
    KeyX: 'erase',
    KeyU: 'measure',
    KeyG: shift ? 'raceTrack' : 'paths',
    KeyN: 'scatter',
    KeyP: 'place',
    KeyI: 'pickStyle',
    KeyV: 'select',
    Escape: 'escape',
    KeyH: 'showAll',
    Slash: 'search',
    Delete: 'delete',
    Backspace: 'delete',
    PageUp: shift ? 'liftSelection' : 'levelUp',
    PageDown: shift ? 'lowerSelection' : 'levelDown',
    BracketRight: 'brushBigger',
    BracketLeft: 'brushSmaller',
    ArrowUp: 'nudgeNorth',
    ArrowDown: 'nudgeSouth',
    ArrowLeft: 'nudgeWest',
    ArrowRight: 'nudgeEast',
  };
  return plain[code] ?? null;
}

const press = (code: string, shift: boolean, mod: boolean, meta = false) => matchEditorKey({ code, key: keyOf(code, shift), shiftKey: shift, ctrlKey: mod && !meta, metaKey: mod && meta });

describe('MapMaker key table and the ? overlay (Phase 1, item 5)', () => {
  it('every key keeps what it did before the table (Shift+/ now opens the key list; Shift+F5 and K are new)', () => {
    for (const code of CODES)
      for (const shift of [false, true])
        for (const mod of [false, true]) {
          const now = press(code, shift, mod)?.action ?? null;
          // Added since (Phase 3 part A): Shift+F5 plays from here, K is the plan view.
          const added =
            code === 'F5' && shift
              ? 'playFromHere'
              : code === 'KeyK' && !mod
                ? 'planView'
                : // Phase 3 part B: Ctrl+G group, Ctrl+Shift+G ungroup, Ctrl+C / Ctrl+V copy and paste, Shift+M Mirror…, J note pins.
                  code === 'KeyG' && mod
                  ? shift
                    ? 'ungroup'
                    : 'group'
                  : code === 'KeyC' && mod
                    ? 'copy'
                    : code === 'KeyV' && mod
                      ? 'paste'
                      : code === 'KeyM' && shift && !mod
                        ? 'mirrorDialog'
                        : code === 'KeyJ' && !mod
                          ? 'notes'
                          : // Phase 4 item 3: Y bot hints.
                            code === 'KeyY' && !mod
                            ? 'botHints'
                            : null;
          const want = added ?? (code === 'Slash' && shift && !mod ? 'keys' : before(code, shift, mod));
          expect(now, `${mod ? 'Ctrl+' : ''}${shift ? 'Shift+' : ''}${code}`).toBe(want);
          // ⌘ on a Mac is Ctrl.
          if (mod) expect(press(code, shift, true, true)?.action ?? null).toBe(want);
        }
    // "?" wherever a layout puts it.
    expect(matchEditorKey({ code: 'Minus', key: '?', shiftKey: true, ctrlKey: false, metaKey: false })?.action).toBe('keys');
  });

  it('every key the handler responds to is listed in the overlay, with its own key text', () => {
    const listed = new Set(editorKeyGroups().flatMap((g) => g.rows.map((r) => `${r.keys}|${r.what}`)));
    const seen = new Map<string, string>();
    for (const code of CODES)
      for (const shift of [false, true])
        for (const mod of [false, true]) {
          const b = press(code, shift, mod);
          if (!b) continue;
          expect(listed.has(`${b.keys}|${b.what}`), `${b.keys} (${b.action}) is in the overlay`).toBe(true);
          // The text names the modifiers the binding needs.
          expect(b.keys.includes('Ctrl+'), b.keys).toBe(!!b.mod);
          if (b.shift) expect(b.keys.startsWith('Shift+') || b.keys.includes('Shift+') || b.keys === '?', b.keys).toBe(true);
          seen.set(b.keys, b.action);
        }
    // And every binding in the table is reachable by some key.
    for (const b of EDITOR_KEYS) expect(seen.has(b.keys), `${b.keys} reachable`).toBe(true);
    // The overlay lists R, Ctrl+Z and the tool keys.
    for (const k of ['R', 'Ctrl+Z', 'V', 'P', 'X', 'B', 'O', 'T', 'G', 'N', 'U', 'Esc', '?']) expect([...listed].some((l) => l.startsWith(`${k}|`)), k).toBe(true);
    expect(keyFor('undo')).toBe('Ctrl+Z');
  });

  it('the held keys MapMaker reads are the table’s (the fly camera, free placing)', () => {
    const held = new Set(EDITOR_KEY_NOTES.flatMap((n) => n.held ?? []));
    for (const c of [...Object.values(FLY_KEYS), ...FREE_PLACE_KEYS, ...FREE_MEASURE_KEYS]) expect(held.has(c), c).toBe(true);
    // MapMaker reads no other held key by name: every `keys.has('…')` in the editor is from the table's lists.
    const src = readFileSync(fileURLToPath(new URL('../../client/src/editor/editorApp.ts', import.meta.url)), 'utf8');
    expect(src.match(/keys\.has\('[A-Za-z]+'\)/g) ?? []).toEqual([]);
    expect(src.match(/\['(Control|Shift|Alt|Meta)\w+'/g) ?? [], 'held-key lists come from the table').toEqual([]);
    // And no key is matched by hand outside the table (the old handler's `case 'KeyR':` and `e.code === 'F5'`).
    expect(src.match(/case '(Key[A-Z]|Digit\d|Escape|F5|PageUp|PageDown|Arrow\w+|Bracket\w+|Slash|Backslash|Delete|Home)':/g) ?? []).toEqual([]);
  });
});
