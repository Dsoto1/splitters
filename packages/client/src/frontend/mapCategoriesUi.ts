import { MAP_CATEGORIES, type MapCategoryTab } from '@tiletrigger/shared';
import { GLYPHS, glyph } from './setupControls.ts';

/**
 * Match Setup's category tabs (one tab per map, shared map/categories.ts; owner, 2026-11-24): All maps, then Modern,
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
  bar.replaceChildren(tab('all', 'All maps', o.total, 'Every map'), ...MAP_CATEGORIES.map((c) => tab(c.id, c.label, o.counts.get(c.id) ?? 0, `${c.label}: ${c.blurb}`)));
}
