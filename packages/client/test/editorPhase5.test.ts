// MapMaker UI Phase 5 (docs/MAPMAKER_UI_SPEC.md, "Phase 5: as built"): the dock following a resized window, the
// view preferences kept in this browser, the plans' keys (editor/planKeys.ts) and Tile View's keyboard picking.
import { describe, expect, it } from 'vitest';
import { clampDockWidth, dockMaxWidth, parseDockPrefs, resizedDockState, serializeDockPrefs, DOCK_MIN_W, DOCK_MAX_W } from '../src/editor/dockPrefs.ts';
import { planKeyAction, PAN_STEP, PAN_STEP_FAR, ZOOM_STEP, type PlanKeyPress } from '../src/editor/planKeys.ts';
import { cyclePick, type FocusChild, type FocusEdge } from '../src/editor/tileViewModel.ts';
import { DEFAULT_VIEW, parseViewPrefs, serializeViewPrefs } from '../src/editor/viewPrefs.ts';

describe('the dock follows a resized window', () => {
  it('narrowed past 900 px an expanded dock goes compact; widened back it comes back, and only then', () => {
    expect(resizedDockState('expanded', 'expanded', 1440, 860)).toBe('compact');
    expect(resizedDockState('compact', 'expanded', 860, 1280)).toBe('expanded');
    // Chosen compact (or hidden) stays so either way.
    expect(resizedDockState('compact', 'compact', 860, 1280)).toBe('compact');
    expect(resizedDockState('hidden', 'expanded', 1440, 700)).toBe('hidden');
    expect(resizedDockState('hidden', 'hidden', 700, 1440)).toBe('hidden');
    // Resizes that don't cross the line leave it alone (someone expanded it in a narrow window: it stays).
    expect(resizedDockState('expanded', 'expanded', 860, 800)).toBe('expanded');
    expect(resizedDockState('expanded', 'expanded', 1440, 1000)).toBe('expanded');
    expect(resizedDockState('compact', 'expanded', 1280, 1100)).toBe('compact');
  });

  it("fits a kept width to the window without forgetting it, and gives the grip its limits", () => {
    expect(dockMaxWidth(1920)).toBe(DOCK_MAX_W);
    expect(dockMaxWidth(800)).toBe(360);
    expect(dockMaxWidth(400)).toBe(DOCK_MIN_W);
    expect(clampDockWidth(500, 1920)).toBe(500);
    expect(clampDockWidth(500, 800)).toBe(360);
    // The kept number is the person's; only what is drawn is fitted.
    const p = parseDockPrefs(JSON.stringify({ right: 'expanded', left: 'open', width: 500 }));
    expect(p.width).toBe(500);
    expect(JSON.parse(serializeDockPrefs(p)).width).toBe(500);
  });
});

describe('view preferences kept in this browser', () => {
  it('reads Grid, Full grid and Snap back, the defaults written as nothing', () => {
    expect(parseViewPrefs(null)).toEqual(DEFAULT_VIEW);
    expect(serializeViewPrefs(DEFAULT_VIEW)).toBeNull();
    const p = { grid: true, gridFull: true, snap: 'coarse' as const };
    expect(parseViewPrefs(serializeViewPrefs(p))).toEqual(p);
    expect(parseViewPrefs(serializeViewPrefs({ grid: false, gridFull: false, snap: 'off' }))).toEqual({ grid: false, gridFull: false, snap: 'off' });
  });

  it('ignores nonsense, and Full grid without the grid', () => {
    expect(parseViewPrefs('{not json')).toEqual(DEFAULT_VIEW);
    expect(parseViewPrefs('"text"')).toEqual(DEFAULT_VIEW);
    expect(parseViewPrefs(JSON.stringify({ snap: 'huge', grid: 'yes' }))).toEqual(DEFAULT_VIEW);
    expect(parseViewPrefs(JSON.stringify({ grid: false, gridFull: true }))).toEqual({ grid: false, gridFull: false, snap: 'normal' });
    expect(serializeViewPrefs({ grid: false, gridFull: true, snap: 'normal' })).toBe(JSON.stringify({ grid: false }));
  });

  it("every preference MapMaker keeps reads back safely from anything (dock, Tile View, minimap)", () => {
    for (const raw of [null, '', 'null', '[]', '42', '{"right":7,"left":null,"width":"wide","tab":"x","minimapZoom":-3,"tileSnap":"10","tileFrame":1}']) {
      const p = parseDockPrefs(raw);
      expect(p).toEqual({ right: 'expanded', left: 'open' });
      expect(parseDockPrefs(serializeDockPrefs(p))).toEqual(p);
    }
  });
});

const key = (k: string, mods: Partial<PlanKeyPress> = {}): PlanKeyPress => ({ key: k, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...mods });

describe("the plans' keys", () => {
  it('zoom, fit and pan in both; the minimap pans with the plain arrows, Tile View with Alt', () => {
    for (const plan of ['tile', 'minimap'] as const) {
      expect(planKeyAction(key('+'), plan)).toEqual({ kind: 'zoom', k: ZOOM_STEP });
      expect(planKeyAction(key('='), plan)).toEqual({ kind: 'zoom', k: ZOOM_STEP });
      expect(planKeyAction(key('-'), plan)).toEqual({ kind: 'zoom', k: 1 / ZOOM_STEP });
      expect(planKeyAction(key('Home'), plan)).toEqual({ kind: 'fit' });
      expect(planKeyAction(key('ArrowUp', { altKey: true }), plan)).toEqual({ kind: 'pan', dx: 0, dy: -PAN_STEP });
      expect(planKeyAction(key('ArrowLeft', { altKey: true, shiftKey: true }), plan)).toEqual({ kind: 'pan', dx: -PAN_STEP_FAR, dy: 0 });
      // Ctrl and ⌘ belong to MapMaker (undo, save…).
      expect(planKeyAction(key('+', { ctrlKey: true }), plan)).toBeNull();
      expect(planKeyAction(key('ArrowUp', { metaKey: true }), plan)).toBeNull();
    }
    expect(planKeyAction(key('ArrowRight'), 'minimap')).toEqual({ kind: 'pan', dx: PAN_STEP, dy: 0 });
    // In Tile View the plain arrows nudge the picked thing (tileViewPanel), not the plan.
    expect(planKeyAction(key('ArrowRight'), 'tile')).toBeNull();
  });

  it('Tile View: ] and [ pick, Enter goes to the fields; the minimap: Enter opens Tile View', () => {
    expect(planKeyAction(key(']'), 'tile')).toEqual({ kind: 'pick', step: 1 });
    expect(planKeyAction(key('['), 'tile')).toEqual({ kind: 'pick', step: -1 });
    expect(planKeyAction(key(']'), 'minimap')).toBeNull();
    expect(planKeyAction(key('Enter'), 'tile')).toEqual({ kind: 'fields' });
    expect(planKeyAction(key('Enter'), 'minimap')).toEqual({ kind: 'tileView' });
    // R and Esc stay Tile View's own; letters are MapMaker's.
    expect(planKeyAction(key('r'), 'tile')).toBeNull();
    expect(planKeyAction(key('Escape'), 'tile')).toBeNull();
  });
});

describe("Tile View's keyboard picking", () => {
  const kid = (id: string, x: number, z: number, partOf: string | null = null): FocusChild => ({ id, x, z, yaw: null, partOf, half: null });
  const side = (s: 'N' | 'E'): FocusEdge => ({ target: { cell: [0, 0, 0], side: s }, tileId: 't', a: [0, 0], b: [1, 0], style: 'wall' });
  const kids = [kid('south', 0, -2), kid('part', 0, 3, 'sp1'), kid('northwest', -1, 2), kid('northeast', 1, 2), kid('locked', 0, 0)];
  const edges = [side('N'), side('E')];
  const skip = (id: string) => id === 'locked';
  const name = (p: ReturnType<typeof cyclePick>) => (!p ? null : p.kind === 'edge' ? p.edge.target.side : p.id);

  it("goes through the map's own things north to south, west to east, then the sides, then the parts, round again", () => {
    const seen: (string | null)[] = [];
    let p: ReturnType<typeof cyclePick> = null;
    for (let i = 0; i < 7; i++) {
      p = cyclePick(kids, edges, p, 1, skip);
      seen.push(name(p));
    }
    expect(seen).toEqual(['northwest', 'northeast', 'south', 'N', 'E', 'part', 'northwest']);
  });

  it('[ goes back, from nothing the last; locked and hidden things are never picked; nothing to pick: null', () => {
    expect(name(cyclePick(kids, edges, null, -1, skip))).toBe('part');
    expect(name(cyclePick(kids, edges, { kind: 'child', id: 'northwest', part: null }, -1, skip))).toBe('part');
    expect(name(cyclePick(kids, edges, { kind: 'edge', edge: edges[0]! }, -1, skip))).toBe('south');
    expect(name(cyclePick(kids, edges, { kind: 'child', id: 'locked', part: null }, 1, skip))).toBe('northwest');
    expect(cyclePick([kid('locked', 0, 0)], [], null, 1, skip)).toBeNull();
    // A hidden set piece hides its parts.
    expect(name(cyclePick([kid('part', 0, 0, 'sp1')], [], null, 1, (id) => id === 'sp1'))).toBeNull();
  });
});
