// MapMaker overhaul Phase 2 (docs/MAPMAKER_OVERHAUL_PLAN.md): the mode tabs and their palette panes, the folding
// panels' stored state, and the quick row's mode-first order.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EDITOR_MODES, firstPane, paneMode } from '../src/editor/editorModes.ts';
import { parsePanelFolds, withPanelFold } from '../src/editor/panels.ts';
import { quickOrder } from '../src/editor/palette.ts';
import { PANE_CATEGORY } from '../src/editor/paletteCatalog.ts';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const attrs = (re: RegExp) => [...html.matchAll(re)].map((m) => m[1]!);

describe('mode tabs', () => {
  it('are the seven of the plan, in order, each a tab in the top bar', () => {
    expect(EDITOR_MODES.map((m) => m.label)).toEqual(['Build', 'Props', 'Gameplay', 'Logic', 'Environment', 'Paths', 'Test']);
    const top = html.slice(html.indexOf('id="ed-modes"'), html.indexOf('</div>', html.indexOf('id="ed-modes"')));
    expect(attrs(/data-ws="([a-z]+)"/g).length).toBeGreaterThan(0);
    expect([...top.matchAll(/data-ws="([a-z]+)"/g)].map((m) => m[1])).toEqual(EDITOR_MODES.map((m) => m.ws));
  });

  it('give every palette pane to exactly one mode, matching the page, so every tool stays reachable', () => {
    const tabs = [...html.matchAll(/data-ws="([a-z]+)" data-pane="([a-z]+)"/g)].map((m) => ({ ws: m[1]!, pane: m[2]! }));
    const panes = attrs(/class="ed-pane" data-pane="([a-z]+)"/g);
    expect(tabs.map((t) => t.pane).sort()).toEqual([...panes].sort());
    for (const t of tabs) expect(paneMode(t.pane)?.ws, t.pane).toBe(t.ws);
    const all = EDITOR_MODES.flatMap((m) => m.panes);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual([...panes].sort());
    for (const m of EDITOR_MODES) if (m.panes.length) expect(firstPane(m.ws)).toBe(m.panes[0]);
    // Each pane has a colour (its category), the new Paths and Test panes too.
    for (const p of panes.filter((p) => p !== 'sky')) expect(PANE_CATEGORY[p], p).toBeDefined();
  });

  it('put the paths, the track and the drop routes in the Paths pane, and the Test pane in Test', () => {
    const pane = (id: string) => html.slice(html.indexOf(`class="ed-pane" data-pane="${id}"`), html.indexOf('</div>\n        </div>', html.indexOf(`class="ed-pane" data-pane="${id}"`)));
    expect(pane('paths')).toContain('id="ed-terrain-paths"');
    expect(pane('test')).toContain('id="ed-test-pane"');
    expect(pane('terrain')).not.toContain('ed-terrain-paths');
  });
});

describe('collapsible panels', () => {
  it('read back safely and store the same state the same way', () => {
    expect([...parsePanelFolds(null)]).toEqual([]);
    expect([...parsePanelFolds('nope')]).toEqual([]);
    expect([...parsePanelFolds('["outliner",3]')]).toEqual(['outliner']);
    expect(withPanelFold(new Set(['issues']), 'outliner', true)).toEqual(['issues', 'outliner']);
    expect(withPanelFold(new Set(['issues', 'outliner']), 'issues', false)).toEqual(['outliner']);
  });

  it("are the side panel's outliner, inspector and validation", () => {
    expect(attrs(/class="ed-panel" data-panel="([a-z]+)"/g)).toEqual(['outliner', 'inspector', 'issues']);
  });
});

describe("the quick row's favourites and recent", () => {
  const pane: Record<string, string> = { 'tile:a': 'tiles', 'prop:b': 'props', 'tile:c': 'tiles', 'material:d': 'paint' };
  it("put the mode's own pieces first, keeping their order, or only them", () => {
    const keys = ['prop:b', 'tile:a', 'material:d', 'tile:c'];
    expect(quickOrder(keys, (k) => pane[k], null, false)).toEqual(keys);
    expect(quickOrder(keys, (k) => pane[k], paneMode('tiles')!.panes, false)).toEqual(['tile:a', 'tile:c', 'prop:b', 'material:d']);
    expect(quickOrder(keys, (k) => pane[k], paneMode('paint')!.panes, true)).toEqual(['material:d']);
  });
});
