// MapMaker UI spec Phase 1 (docs/MAPMAKER_UI_SPEC.md): the right dock's stored state and its three states, the
// contextual tool bar's table and its overflow, the status bar's words, and the page's top bar, rail and dock.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { newMapDocument, EDITOR_KEYS } from '@tiletrigger/shared';
import { clampDockWidth, DOCK_MAX_W, DOCK_MIN_W, nextDockState, parseDockPrefs, serializeDockPrefs, startingDockState } from '../src/editor/dockPrefs.ts';
import { EDITOR_MODES } from '../src/editor/editorModes.ts';
import { BAR_TOOLS, barToolsFor, lightsFor, overflowGroups } from '../src/editor/toolBarTools.ts';
import { countWords, otherLevelCount, selectionWords } from '../src/editor/statusBar.ts';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const top = html.slice(html.indexOf('<header id="ed-top">'), html.indexOf('</header>', html.indexOf('<header id="ed-top">')));

describe('the right dock (dockPrefs)', () => {
  it('cycles expanded, compact, hidden (Shift+\\)', () => {
    expect(nextDockState('expanded')).toBe('compact');
    expect(nextDockState('compact')).toBe('hidden');
    expect(nextDockState('hidden')).toBe('expanded');
  });

  it('starts compact under 900 px wide instead of expanded; a chosen compact or hidden stays', () => {
    expect(startingDockState('expanded', 899)).toBe('compact');
    expect(startingDockState('expanded', 900)).toBe('expanded');
    expect(startingDockState('hidden', 600)).toBe('hidden');
    expect(startingDockState('compact', 1920)).toBe('compact');
  });

  it('reads its stored state safely, and carries the old edge tabs over once', () => {
    expect(parseDockPrefs(null)).toEqual({ right: 'expanded', left: 'open' });
    expect(parseDockPrefs('not json')).toEqual({ right: 'expanded', left: 'open' });
    expect(parseDockPrefs('{"right":"sideways","left":7,"width":"wide"}')).toEqual({ right: 'expanded', left: 'open' });
    expect(parseDockPrefs('{"right":"compact","left":"rail","width":312.4}')).toEqual({ right: 'compact', left: 'rail', width: 312 });
    // Before Phase 1: tiletrigger.editor.sidebars, `{ pal, right }` folded.
    expect(parseDockPrefs(null, '{"pal":true,"right":true}')).toEqual({ right: 'hidden', left: 'rail' });
    expect(parseDockPrefs(null, '{"pal":false}')).toEqual({ right: 'expanded', left: 'open' });
    // The new key wins over the old one.
    expect(parseDockPrefs('{"right":"expanded"}', '{"right":true}').right).toBe('expanded');
  });

  it('writes the same text for the same state, and keeps a dragged width within its limits', () => {
    const a = serializeDockPrefs({ right: 'hidden', left: 'open', width: 300 });
    expect(a).toBe(serializeDockPrefs({ left: 'open', width: 300, right: 'hidden' }));
    expect(parseDockPrefs(a)).toEqual({ right: 'hidden', left: 'open', width: 300 });
    expect(clampDockWidth(100, 1920)).toBe(DOCK_MIN_W);
    expect(clampDockWidth(2000, 1920)).toBe(DOCK_MAX_W);
    expect(clampDockWidth(480, 1000)).toBe(450);
    expect(clampDockWidth(300, 400)).toBe(DOCK_MIN_W);
  });
});

describe('the contextual tool bar (toolBarTools)', () => {
  const ids = (ws: string) => barToolsFor(ws).map((t) => t.id);

  it("puts Ground paint, Terrain and the Environment brush on the Environment tab's bar only (the owner's answer 2), Structure paint on Build's too (painting plan Phase 1)", () => {
    for (const id of ['ed-tb-groundpaint', 'ed-tb-terrain', 'ed-tb-envbrush']) {
      expect(BAR_TOOLS.find((t) => t.id === id)?.tabs).toEqual(['environment']);
    }
    expect(BAR_TOOLS.find((t) => t.id === 'ed-tb-paint')?.tabs).toEqual(['build', 'environment']);
    expect(ids('environment')).toEqual(expect.arrayContaining(['ed-tb-paint', 'ed-tb-groundpaint', 'ed-tb-terrain', 'ed-tb-envbrush']));
    expect(ids('build')).toEqual(['ed-tb-select', 'ed-tb-place', 'ed-tb-erase', 'ed-tb-walls', 'ed-tb-paint', 'ed-tb-rotate', 'ed-tb-delete', 'ed-tb-keys', 'ed-tb-help']);
    expect(ids('test')).toEqual(['ed-tb-select', 'ed-tb-bothints', 'ed-tb-measure', 'ed-tb-notes', 'ed-tb-plan', 'ed-maptest', 'ed-tb-keys', 'ed-tb-help']);
  });

  it('gives every tab Select, Keys and Help, and a bar short enough for a laptop', () => {
    for (const m of EDITOR_MODES) {
      expect(ids(m.ws)).toEqual(expect.arrayContaining(['ed-tb-select', 'ed-tb-keys', 'ed-tb-help']));
      expect(ids(m.ws).length).toBeLessThanOrEqual(10);
    }
  });

  it('lists every tool and action in the overflow menu, once, so none is lost in any tab', () => {
    const listed = overflowGroups().flatMap((g) => g.tools.map((t) => t.id));
    expect(listed.sort()).toEqual(BAR_TOOLS.map((t) => t.id).sort());
    expect(new Set(listed).size).toBe(listed.length);
    // Every tool of the fixed bar before Phase 1 is still there, with its id (the tour and the e2e flows use them).
    for (const id of ['ed-tb-select', 'ed-tb-place', 'ed-tb-erase', 'ed-tb-paint', 'ed-tb-walls', 'ed-tb-terrain', 'ed-tb-measure', 'ed-tb-rotate', 'ed-tb-delete', 'ed-tb-keys', 'ed-tb-help']) expect(listed).toContain(id);
    // So are the top bar's Plan and Bot test, and Map properties' Dress all and Settle all.
    for (const id of ['ed-tb-plan', 'ed-maptest', 'ed-tb-dress-all', 'ed-tb-settle-all']) expect(listed).toContain(id);
  });

  it("names each tool's key as the key table does", () => {
    const tableKeys = new Set(EDITOR_KEYS.map((k) => k.keys));
    for (const t of BAR_TOOLS) if (t.key && t.key !== 'Del') expect(tableKeys.has(t.key) || EDITOR_KEYS.some((k) => k.keys.split(/ or |, /).includes(t.key!)), `${t.id} ${t.key}`).toBe(true);
  });

  it('lights the tool in hand', () => {
    const place = BAR_TOOLS.find((t) => t.id === 'ed-tb-place')!;
    const paths = BAR_TOOLS.find((t) => t.id === 'ed-tb-paths')!;
    expect(lightsFor(place, { kind: 'prop', model: 'x' })).toBe(true);
    expect(lightsFor(place, { kind: 'select' })).toBe(false);
    expect(lightsFor(paths, { kind: 'route' })).toBe(true);
  });
});

describe('the status bar (statusBar)', () => {
  it('says how much of the selection is on other levels', () => {
    expect(selectionWords(0, 0)).toBe('');
    expect(selectionWords(3, 0)).toBe('3 selected');
    expect(selectionWords(1, 1)).toBe('1 selected · on another level');
    expect(selectionWords(3, 1)).toBe('3 selected · 1 on another level');
    expect(selectionWords(3, 2)).toBe('3 selected · 2 on other levels');
    expect(selectionWords(3, 3)).toBe('3 selected · all on other levels');
  });

  it('counts things off the level by their height, tiles by their level', () => {
    const doc = newMapDocument('Levels');
    const lh = doc.classicStructure.levelHeight;
    doc.entities.push(
      { id: 'a', kind: 'spawn', position: [0, 0, 0], yaw: 0, team: null } as never,
      { id: 'b', kind: 'spawn', position: [0, lh + 0.2, 0], yaw: 0, team: null } as never,
    );
    expect(otherLevelCount(doc, { tiles: [], entities: ['a', 'b'] }, 0)).toBe(1);
    expect(otherLevelCount(doc, { tiles: [], entities: ['a', 'b'] }, 1)).toBe(1);
    expect(otherLevelCount(doc, { tiles: [], entities: ['a'] }, 2)).toBe(1);
    expect(otherLevelCount(doc, { tiles: [], entities: [] }, 0)).toBe(0);
  });

  it('keeps the counts short, the full list for the tooltip', () => {
    const doc = newMapDocument('Counts');
    const w = countWords(doc, 12);
    expect(w.short).toMatch(/^\d+ tiles? · \d+ things?$/);
    expect(w.long).toContain('12 collision boxes');
  });
});

describe('the page (index.html)', () => {
  it("keeps the top bar to the title, files, undo, the 7 tabs, View, Snap, the Structure theme chip, TEST's bots and skill, and play", () => {
    for (const id of ['ed-title', 'ed-view-btn', 'ed-snap', 'ed-theme-chip', 'ed-bots', 'ed-skill', 'ed-test', 'ed-test-here', 'ed-modes', 'ed-undo', 'ed-redo', 'ed-save']) expect(top, id).toContain(`id="${id}"`);
    // Moved: grid, full grid and overlaps to the View menu (built by viewMenu.ts); Plan to View and the Test tab's
    // bar; Bot test to the Test tab's bar; the problems pill to the status bar; the name field to Map settings; the theme select to Map settings
    // (painting Phase 3: the chip opens it there).
    for (const id of ['ed-theme', 'ed-grid', 'ed-grid-full', 'ed-overlaps', 'ed-plan', 'ed-maptest', 'ed-status', 'ed-name']) expect(top, id).not.toContain(`id="${id}"`);
    expect(html.slice(html.indexOf('<footer id="ed-bottom">'), html.indexOf('</footer>', html.indexOf('<footer id="ed-bottom">')))).toContain('id="ed-status"');
  });

  it('has a small left rail (Map, the asset browser, collapse) and a right dock with Map settings in it', () => {
    const rail = html.slice(html.indexOf('<nav id="ed-rail"'), html.indexOf('</nav>', html.indexOf('<nav id="ed-rail"')));
    expect([...rail.matchAll(/<button id="([a-z-]+)"/g)].map((m) => m[1])).toEqual(['ed-rail-map', 'ed-rail-assets', 'ed-pal-toggle']);
    const dock = html.slice(html.indexOf('<aside id="ed-right"'), html.indexOf('</aside>', html.indexOf('<aside id="ed-right"')));
    for (const id of ['ed-map-settings', 'ed-ms-body', 'ed-dock-panels', 'ed-dock-mini', 'ed-dock-compact', 'ed-dock-hide', 'ed-dock-grip', 'ed-inspector', 'ed-outliner', 'ed-issues']) expect(dock, id).toContain(`id="${id}"`);
    expect(dock).toContain('aria-label="Right dock"');
  });

  it('describes Shift+\\ as the dock cycle in the key list', () => {
    expect(EDITOR_KEYS.find((k) => k.action === 'toggleSidePanel')?.what).toMatch(/expanded, compact.*hidden/);
  });
});
