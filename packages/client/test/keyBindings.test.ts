import { beforeEach, describe, expect, it } from 'vitest';

const store = new Map<string, string>();
Object.assign(globalThis, { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } });

const kb = await import('../src/game/keyBindings.ts');
const { BIND_ACTIONS, BIND_GROUPS, allClashes, bindings, bindingsDiff, bindingsFromDiff, clashesFor, defaultBindings, keyFor, keyLabel, keysFor, migrateOldKeys, setBindings, setKey, swapKey, _resetBindingsCache } = kb;

beforeEach(() => {
  store.clear();
  _resetBindingsCache();
});

describe('the bindings table', () => {
  it("has the owner's defaults (2026-11-23): Q / E lean, F use, X last weapon, hold Tab the wheel", () => {
    const d = defaultBindings();
    expect(d.leanLeft![0]).toBe('KeyQ');
    expect(d.leanRight![0]).toBe('KeyE');
    expect(d.use![0]).toBe('KeyF');
    expect(d.lastWeapon![0]).toBe('KeyX');
    expect(d.weaponWheel![0]).toBe('Tab');
    // The scoreboard shares Tab (a tap), the free camera keeps E / Q up and down, the menus Q / E for tabs.
    expect(d.scoreboard![0]).toBe('Tab');
    expect([d.freeUp![0], d.freeDown![0]]).toEqual(['KeyE', 'KeyQ']);
    expect([d.menuPrev![0], d.menuNext![0]]).toEqual(['KeyQ', 'KeyE']);
  });

  it('every action has a group, unique ids, and the defaults clash nowhere', () => {
    const ids = BIND_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of BIND_ACTIONS) expect(BIND_GROUPS.some((g) => g.id === a.group)).toBe(true);
    for (const g of BIND_GROUPS) expect(BIND_ACTIONS.some((a) => a.group === g.id)).toBe(true);
    expect(allClashes(defaultBindings())).toEqual([]);
  });

  it('a key clashes only where both actions work: E leans on foot and lifts the free camera', () => {
    const d = defaultBindings();
    expect(clashesFor(d, 'freeUp', 'KeyE')).toEqual([]);
    expect(clashesFor(d, 'leanLeft', 'KeyR')).toEqual(['reload']);
    // On foot F is Use; F in the menus is Filter maps: no clash.
    expect(clashesFor(d, 'menuFilter', 'KeyF')).toEqual([]);
    // The wheel's key may carry one tap job, not two.
    expect(clashesFor(d, 'lastWeapon', 'Tab')).toEqual(['scoreboard']);
    expect(clashesFor(setKey(d, 'scoreboard', 0, 'KeyP'), 'lastWeapon', 'Tab')).toEqual([]);
    // A mouse button is a key like any other.
    expect(clashesFor(d, 'melee', 'Mouse0')).toEqual(['fire']);
  });

  it('swap gives the other action the old key; a clashing old key leaves it with none', () => {
    const d = defaultBindings();
    const s = swapKey(d, 'leanLeft', 0, 'KeyR');
    expect(s.leanLeft![0]).toBe('KeyR');
    expect(s.reload![0]).toBe('KeyQ');
    expect(allClashes(s)).toEqual([]);
    // The defaults stay as they were (a copy).
    expect(d.leanLeft![0]).toBe('KeyQ');
    // Setting a slot to its other slot's key moves it.
    const m = setKey(d, 'fire', 1, 'Mouse0');
    expect(m.fire).toEqual(['', 'Mouse0']);
  });

  it('stores only the changes, and reads them back over the defaults', () => {
    const b = setKey(defaultBindings(), 'leanLeft', 0, 'KeyP');
    expect(bindingsDiff(b)).toEqual({ leanLeft: 'KeyP,' });
    setBindings(b);
    expect(JSON.parse(store.get('tiletrigger.keys')!)).toEqual({ leanLeft: 'KeyP,' });
    _resetBindingsCache();
    expect(bindings().leanLeft).toEqual(['KeyP', '']);
    expect(keyFor('leanLeft')).toBe('P');
  });

  it('a stored choice wins over a default it collides with, which loses the key; junk is dropped', () => {
    const b = bindingsFromDiff({ leanLeft: 'KeyR,', nonsense: 'KeyQ,', fire: '<x>,' });
    expect(b.leanLeft![0]).toBe('KeyR');
    expect(b.reload![0]).toBe('');
    expect(b.fire).toEqual(['Mouse0', 'AltLeft']);
    expect(allClashes(b)).toEqual([]);
  });
});

describe('players who rebound keep their choices (the old stores move in once)', () => {
  const read = (m: Record<string, string>) => (k: string) => m[k] ?? null;

  it('old default lean keys (` and Left Alt) and wheel key (Q) give way to the new defaults', () => {
    expect(migrateOldKeys(read({ 'tiletrigger.leanKeys': JSON.stringify({ left: 'Backquote', right: 'AltLeft' }), 'tiletrigger.wheelKey': 'KeyQ' }))).toEqual({});
  });

  it('rebound lean keys, wheel key and category keys are kept', () => {
    const diff = migrateOldKeys(
      read({
        'tiletrigger.leanKeys': JSON.stringify({ left: 'KeyI', right: 'AltLeft' }),
        'tiletrigger.wheelKey': 'CapsLock',
        'tiletrigger.categoryKeys': JSON.stringify(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Numpad8']),
      }),
    );
    expect(diff).toEqual({ leanLeft: 'KeyI,', weaponWheel: 'CapsLock,', cat8: 'Numpad8,' });
    const b = bindingsFromDiff(diff);
    expect(b.leanLeft![0]).toBe('KeyI');
    // Right lean was on the old default: Q / E's partner E now.
    expect(b.leanRight![0]).toBe('KeyE');
    expect(b.weaponWheel![0]).toBe('CapsLock');
    expect(allClashes(b)).toEqual([]);
  });

  it('a kept lean key on a new default (Left Alt, the second fire key) takes it from that action', () => {
    const b = bindingsFromDiff(migrateOldKeys(read({ 'tiletrigger.leanKeys': JSON.stringify({ left: 'AltLeft', right: 'Backquote' }) })));
    expect(b.leanLeft![0]).toBe('AltLeft');
    expect(b.leanRight![0]).toBe('Backquote');
    expect(b.fire).toEqual(['Mouse0', '']);
    expect(b.aim).toEqual(['Mouse2', '']);
    expect(allClashes(b)).toEqual([]);
  });

  it('migrates on first read and not again', () => {
    store.set('tiletrigger.leanKeys', JSON.stringify({ left: 'KeyI', right: 'KeyO' }));
    expect(bindings().leanLeft![0]).toBe('KeyI');
    // KeyO was Switch team's: the player's choice wins.
    expect(bindings().leanRight![0]).toBe('KeyO');
    expect(bindings().switchTeam![0]).toBe('');
    expect(JSON.parse(store.get('tiletrigger.keys')!)).toEqual({ leanLeft: 'KeyI,', leanRight: 'KeyO,' });
    store.set('tiletrigger.leanKeys', JSON.stringify({ left: 'KeyJ', right: 'KeyK' }));
    _resetBindingsCache();
    expect(bindings().leanLeft![0]).toBe('KeyI');
  });
});

describe('labels', () => {
  it('reads keys and mouse buttons as people say them', () => {
    expect(keyLabel('KeyQ')).toBe('Q');
    expect(keyLabel('Digit3')).toBe('3');
    expect(keyLabel('Mouse2')).toBe('Right mouse');
    expect(keyLabel('AltLeft')).toBe('Left Alt');
    expect(keyLabel('')).toBe('—');
    expect(keysFor('fire', defaultBindings())).toBe('Left mouse · Left Alt');
    expect(keyFor('weaponWheel', defaultBindings())).toBe('Tab');
  });
});
