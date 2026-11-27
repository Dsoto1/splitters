import { MAP_CATEGORIES, SETUP_KIND_DEFS, type MapCategoryTab, type SetupKind } from '@tiletrigger/shared';
import { GLYPHS, glyph } from './setupControls.ts';

/**
 * Match Setup's category tabs (one tab per map, shared map/categories.ts; owner, 2026-11-24; the chips of the list's
 * Custom tab since 2026-11-27): All maps, then Modern,
 * Historic, Future & Space, Weird and Custom, each with how many maps it holds. Every map is under exactly one, so the
 * five counts add up to All maps'.
 */

const ICONS: Record<MapCategoryTab | 'all', string> = {
  all: GLYPHS.infinity,
  modern: GLYPHS.mountain,
  historic: GLYPHS.clock,
  future: GLYPHS.planet,
  weird: GLYPHS.bolt,
  custom: GLYPHS.people,
};

const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
};

export interface CategoryTabsOptions {
  /** The tab on now (null: All maps). */
  filter: MapCategoryTab | null;
  /** categoryCounts() over the maps the other filters leave. */
  counts: ReadonlyMap<string, number>;
  total: number;
  onPick: (f: MapCategoryTab | null) => void;
}

/** Fill the tabs (`bar`). A tab picked again goes back to All maps. */
export function drawCategoryTabs(bar: HTMLElement, o: CategoryTabsOptions): void {
  const on = o.filter ?? 'all';
  const tab = (id: MapCategoryTab | 'all', label: string, n: number, tip: string) => {
    const b = make('button', `map-cat${id === on ? ' on' : ''}${id === 'all' ? ' all' : ''}`);
    b.type = 'button';
    b.dataset.cat = id;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(id === on));
    b.title = tip;
    b.append(glyph(ICONS[id], 'glyph cat-icon'), make('span', 'cat-label', label), make('small', 'cat-n', String(n)));
    b.addEventListener('click', () => o.onPick(id === 'all' || id === on ? null : id));
    return b;
  };
  // (Under the Custom tab of the list, its own and community chip reads "Mine & community", not Custom again.)
  const label = (c: (typeof MAP_CATEGORIES)[number]) => (c.id === 'custom' ? 'Mine & community' : c.label);
  bar.replaceChildren(tab('all', 'All maps', o.total, 'Every map'), ...MAP_CATEGORIES.map((c) => tab(c.id, label(c), o.counts.get(c.id) ?? 0, `${label(c)}: ${c.blurb}`)));
}

const KIND_ICONS: Record<SetupKind, string> = {
  story: GLYPHS.clock,
  arenas: GLYPHS.mountain,
  arcade: GLYPHS.bolt,
  battlegrounds: GLYPHS.people,
  custom: GLYPHS.infinity,
};

export interface KindTabsOptions {
  kind: SetupKind;
  /** How many there are under a tab (Story: its sectors; the others: maps). */
  counts: (k: SetupKind) => number;
  onPick: (k: SetupKind) => void;
}

/**
 * The map list's tabs over everything (shared map/setupKinds.ts; owner, 2026-11-25): Story · Arenas · Arcade ·
 * Battlegrounds · Custom, each with its count (Story: sectors).
 */
export function drawKindTabs(bar: HTMLElement, o: KindTabsOptions): void {
  bar.replaceChildren(
    ...SETUP_KIND_DEFS.map((d) => {
      const on = d.id === o.kind;
      const b = make('button', `map-kind${on ? ' on' : ''}`);
      b.type = 'button';
      b.id = `map-kind-${d.id}`;
      b.dataset.kind = d.id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(on));
      b.title = `${d.label}: ${d.blurb}`;
      const n = o.counts(d.id);
      b.setAttribute('aria-label', `${d.label}: ${n}`);
      b.append(glyph(KIND_ICONS[d.id], 'glyph kind-icon'), make('span', 'kind-label', d.label), make('small', 'kind-n', String(n)));
      b.addEventListener('click', () => o.onPick(d.id));
      return b;
    }),
  );
}
