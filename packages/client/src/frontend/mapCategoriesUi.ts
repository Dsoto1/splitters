import { MAP_CATEGORIES, type CategoryFilter, type MapCategoryTab } from '@tiletrigger/shared';
import { GLYPHS, glyph } from './setupControls.ts';

/**
 * Match Setup's category tabs (the owner's six categories, shared map/categories.ts; QUEUE "Match Setup redesign"):
 * All dimensions, then Temporal, Dimensional, Environmental, Fictional, Anomalous and Custom, each with how many maps
 * it holds; a category picked shows its sub-tags as chips under the tabs (All, then each tag that has maps).
 */

const ICONS: Record<MapCategoryTab | 'all', string> = {
  all: GLYPHS.infinity,
  temporal: GLYPHS.clock,
  dimensional: GLYPHS.planet,
  environmental: GLYPHS.mountain,
  fictional: GLYPHS.clapper,
  anomalous: GLYPHS.bolt,
  custom: GLYPHS.people,
};

const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
};

export interface CategoryTabsOptions {
  /** The filter on now (null: All dimensions). */
  filter: CategoryFilter | null;
  /** categoryCounts() over the maps the other filters leave (`all` for every one of them). */
  counts: ReadonlyMap<string, number>;
  total: number;
  onPick: (f: CategoryFilter | null) => void;
}

/** Fill the tabs (`bar`) and the picked category's sub-tag chips (`tags`, hidden for All dimensions). */
export function drawCategoryTabs(bar: HTMLElement, tags: HTMLElement, o: CategoryTabsOptions): void {
  const on = o.filter?.category ?? 'all';
  const tab = (id: MapCategoryTab | 'all', label: string, n: number, tip: string) => {
    const b = make('button', `map-cat${id === on ? ' on' : ''}${id === 'all' ? ' all' : ''}`);
    b.type = 'button';
    b.dataset.cat = id;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(id === on));
    b.title = tip;
    b.append(glyph(ICONS[id], 'glyph cat-icon'), make('span', 'cat-label', label), make('small', 'cat-n', String(n)));
    b.addEventListener('click', () => o.onPick(id === 'all' ? null : id === on && !o.filter?.tag ? null : { category: id }));
    return b;
  };
  bar.replaceChildren(tab('all', 'All dimensions', o.total, 'Every map'), ...MAP_CATEGORIES.map((c) => tab(c.id, c.label, o.counts.get(c.id) ?? 0, `${c.label}: ${c.blurb}`)));
  const def = MAP_CATEGORIES.find((c) => c.id === on);
  tags.hidden = !def;
  if (!def) return void tags.replaceChildren();
  const chip = (tag: string | null, label: string, n: number) => {
    const sel = (o.filter?.tag ?? null) === tag;
    const b = make('button', `map-subtag${sel ? ' on' : ''}`);
    b.type = 'button';
    b.dataset.tag = tag ?? '';
    b.setAttribute('aria-pressed', String(sel));
    b.append(make('span', '', label), make('small', 'cat-n', String(n)));
    b.addEventListener('click', () => o.onPick({ category: def.id, tag }));
    return b;
  };
  tags.replaceChildren(
    chip(null, `All ${def.label.toLowerCase()}`, o.counts.get(def.id) ?? 0),
    // Tags no map here has stay out of the way (the one picked always shows).
    ...def.tags.filter(([t]) => (o.counts.get(`${def.id}:${t}`) ?? 0) > 0 || o.filter?.tag === t).map(([t, label]) => chip(t, label, o.counts.get(`${def.id}:${t}`) ?? 0)),
  );
}
