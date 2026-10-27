import { PALETTE_CATEGORIES, PANE_CATEGORY } from './paletteCatalog.ts';
import { matchScore, searchFields, type SearchFields } from './paletteSearch.ts';
import type { PaletteAtlas } from './paletteAtlas.ts';

/** What the palette knows about one piece (a card in a pane). */
export interface EntryMeta {
  /** Stable key: the card's tool (`tile:core.room`, `prop:prop.barrel`, `spawn`…) or `material:<id>`, `ground:<id>`. */
  key: string;
  name: string;
  /** Extra search words: category, theme, what it is. */
  tags?: string;
  /** The content or style pack it comes from (searchable). */
  pack?: string;
  /** Has a model picture (from the atlas, else rendered at runtime). */
  picture?: boolean;
}

interface Entry extends EntryMeta {
  el: HTMLElement;
  pane: string;
  group: string;
  fields: SearchFields;
  /** Shown under the Style Pack filter. */
  inPack: boolean;
}

/** Per-viewer conveniences (favourites, recent, view, open groups): browser storage, never required. */
const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(`tt.palette.${key}`);
      return v === null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(`tt.palette.${key}`, JSON.stringify(value));
    } catch {
      // Private window or storage blocked: it just isn't remembered.
    }
  },
};

const RECENT_MAX = 14;
const RESULTS_MAX = 120;
const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);

/**
 * MapMaker's palette behaviour: collapsible groups in each pane, colour by
 * category, lazy pictures (atlas sprites, runtime renders only for pieces the
 * atlas lacks), fuzzy search with a ranked results grid, favourites and recent
 * pieces, grid or card view with names on hover, and arrow-key navigation.
 */
export class Palette {
  private readonly entries = new Map<string, Entry>();
  private favs: string[] = store.get<string[]>('favs', []);
  private recent: string[] = store.get<string[]>('recent', []);
  private openGroups: Record<string, boolean> = store.get('groups', {});
  private quickMode: 'favs' | 'recent' = store.get('quick', 'favs');
  private query = '';
  private readonly observer?: IntersectionObserver;
  private readonly thumbKeys = new WeakMap<Element, string>();
  private readonly tip: HTMLElement;
  private readonly quick: HTMLElement;
  private readonly results: HTMLElement;

  constructor(
    private readonly root: HTMLElement,
    private readonly search: HTMLInputElement,
    private readonly atlas: PaletteAtlas,
    /** Runtime picture of a piece the atlas lacks (PNG data URL), or null when it has no model. */
    private readonly render: (key: string) => Promise<string> | null,
  ) {
    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver((list) => {
        for (const e of list) {
          if (!e.isIntersecting) continue;
          this.observer!.unobserve(e.target);
          void this.fillThumb(e.target as HTMLElement);
        }
      }, { root });
    }
    this.quick = document.getElementById('ed-pal-quick')!;
    this.results = document.getElementById('ed-pal-results')!;
    this.tip = document.createElement('div');
    this.tip.id = 'ed-pal-tip';
    this.tip.hidden = true;
    root.parentElement!.append(this.tip);
    this.setView(store.get<'grid' | 'cards'>('view', 'grid'));
    this.bind();
  }

  // ------------------------------------------------------------ building

  /** A collapsible group in a pane; returns the grid to add pieces to. */
  group(container: HTMLElement, id: string, title: string, opts: { open?: boolean; grid?: string; note?: string } = {}): HTMLElement {
    const sec = document.createElement('section');
    sec.className = 'ed-group';
    sec.dataset.group = id;
    const open = this.openGroups[id] ?? opts.open ?? true;
    sec.classList.toggle('open', open);
    const head = document.createElement('button');
    head.className = 'ed-group-head';
    head.type = 'button';
    head.setAttribute('aria-expanded', String(open));
    head.innerHTML = `<span class="chev" aria-hidden="true"></span><span class="ttl"></span><small></small>`;
    head.querySelector('.ttl')!.textContent = title;
    head.addEventListener('click', () => this.toggleGroup(sec));
    const body = document.createElement('div');
    body.className = 'ed-group-body';
    if (opts.note) {
      const n = document.createElement('p');
      n.className = 'ed-note';
      n.textContent = opts.note;
      body.append(n);
    }
    const grid = document.createElement('div');
    grid.className = opts.grid ?? 'tiles';
    body.append(grid);
    sec.append(head, body);
    container.append(sec);
    return grid;
  }

  /** A sub-heading inside a group's grid (a prop category). */
  heading(grid: HTMLElement, text: string): void {
    const h = document.createElement('div');
    h.className = 'tile-cat';
    h.textContent = text;
    grid.append(h);
  }

  /** Register a card already in the palette: name label, picture slot, favourite star, hover name. */
  register(el: HTMLElement, meta: EntryMeta): void {
    const paneEl = el.closest<HTMLElement>('.ed-pane');
    const pane = paneEl?.dataset.pane ?? '';
    const group = el.closest<HTMLElement>('.ed-group')?.querySelector('.ttl')?.textContent ?? '';
    // Text after the icon becomes the label (hidden in grid view, shown by the hover card).
    if (!el.querySelector('.lbl')) {
      const text = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE);
      const lbl = document.createElement('span');
      lbl.className = 'lbl';
      lbl.textContent = text.map((n) => n.textContent).join('').trim() || meta.name;
      for (const n of text) n.remove();
      el.append(lbl);
    }
    if (meta.picture) {
      el.classList.add('has-pic');
      let slot = el.querySelector<HTMLElement>('.thumb');
      if (!slot) {
        slot = document.createElement('span');
        slot.className = 'thumb';
        el.querySelector('img')?.remove();
        el.prepend(slot);
      }
      this.watchThumb(slot, meta.key);
    }
    if (el.title) {
      el.dataset.tip = el.title;
      el.removeAttribute('title');
    }
    el.setAttribute('aria-label', meta.name);
    el.dataset.key = meta.key;
    const star = document.createElement('span');
    star.className = 'fav';
    star.setAttribute('aria-hidden', 'true');
    star.textContent = '★';
    star.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.toggleFav(meta.key);
    });
    el.append(star);
    el.addEventListener('click', () => this.used(meta.key));
    const entry: Entry = { ...meta, el, pane, group, fields: searchFields(meta.name, `${meta.tags ?? ''} ${group}`, meta.pack ?? ''), inPack: true };
    this.entries.set(meta.key, entry);
    el.classList.toggle('faved', this.favs.includes(meta.key));
    // The pack may only be known once the atlas manifest is in (props): add it to the search words then.
    if (!meta.pack && meta.picture) void this.atlas.pack(meta.key).then((p) => p && (entry.fields = searchFields(meta.name, `${meta.tags ?? ''} ${group}`, p)));
  }

  /** Tooltip text of a card (set after registering, e.g. a Style Pack's note on a gameplay piece). */
  setTip(el: HTMLElement, tip: string): void {
    el.dataset.tip = tip;
  }

  /** Counts on the group heads; called once everything is registered and after filtering. */
  refresh(): void {
    for (const sec of this.root.querySelectorAll<HTMLElement>('.ed-group')) {
      const cards = [...sec.querySelectorAll<HTMLElement>('[data-key]')];
      const shown = cards.filter((c) => !c.hidden).length;
      const small = sec.querySelector(':scope > .ed-group-head small');
      if (small) small.textContent = cards.length ? String(shown) : '';
      // A group with pieces, all filtered out, folds away; groups of controls (no pieces) stay.
      sec.hidden = cards.length > 0 && shown === 0;
    }
    for (const head of this.root.querySelectorAll<HTMLElement>('.tile-cat, .mat-cat')) {
      let any = false;
      for (let n = head.nextElementSibling; n && !n.classList.contains('tile-cat') && !n.classList.contains('mat-cat'); n = n.nextElementSibling) if (!(n as HTMLElement).hidden) any = true;
      head.hidden = !any;
    }
    this.renderQuick();
    if (this.query) this.renderResults();
  }

  // ------------------------------------------------------------ filters

  /** Narrow every pane to the pieces `keep` accepts (the Style Pack picker); null shows all. */
  filter(keep: ((el: HTMLElement) => boolean) | null): void {
    for (const e of this.entries.values()) {
      e.inPack = !keep || keep(e.el);
      e.el.hidden = !e.inPack;
    }
    this.refresh();
  }

  get searching(): boolean {
    return !!this.query;
  }

  /** Mirror the active state of the real cards onto their copies (favourites, recent, results). */
  syncActive(): void {
    for (const c of this.root.querySelectorAll<HTMLElement>('[data-pick]')) c.classList.toggle('active', !!this.entries.get(c.dataset.pick!)?.el.classList.contains('active'));
  }

  /** Every registered key (tests, tools). */
  keys(): string[] {
    return [...this.entries.keys()];
  }

  // ------------------------------------------------------------ pictures

  private watchThumb(slot: HTMLElement, key: string): void {
    this.thumbKeys.set(slot, key);
    if (this.observer) this.observer.observe(slot);
    else void this.fillThumb(slot);
  }

  /** Atlas sprite first; the runtime renderer only for pieces the atlas hasn't got (new or user content). */
  private async fillThumb(slot: HTMLElement): Promise<void> {
    const key = this.thumbKeys.get(slot);
    if (!key || slot.classList.contains('atlas') || slot.dataset.filled) return;
    slot.dataset.filled = '1';
    if (await this.atlas.paint(slot, key)) return;
    const src = await this.render(key)?.catch(() => null);
    if (!src) return;
    const img = document.createElement('img');
    img.alt = '';
    img.src = src;
    slot.replaceChildren(img);
  }

  // ------------------------------------------------------------ favourites and recent

  private used(key: string): void {
    this.recent = [key, ...this.recent.filter((k) => k !== key)].slice(0, RECENT_MAX);
    store.set('recent', this.recent);
    if (this.quickMode === 'recent') this.renderQuick();
  }

  toggleFav(key: string): void {
    const on = !this.favs.includes(key);
    this.favs = on ? [...this.favs, key] : this.favs.filter((k) => k !== key);
    store.set('favs', this.favs);
    this.entries.get(key)?.el.classList.toggle('faved', on);
    for (const c of this.root.querySelectorAll<HTMLElement>(`[data-pick="${CSS.escape(key)}"]`)) c.classList.toggle('faved', on);
    this.renderQuick();
  }

  private renderQuick(): void {
    const list = (this.quickMode === 'favs' ? this.favs : this.recent).map((k) => this.entries.get(k)).filter((e): e is Entry => !!e && e.inPack);
    for (const b of this.quick.querySelectorAll<HTMLElement>('.ed-quick-tabs button')) {
      b.classList.toggle('on', b.dataset.q === this.quickMode);
      const n = (b.dataset.q === 'favs' ? this.favs : this.recent).filter((k) => this.entries.has(k)).length;
      b.querySelector('small')!.textContent = n ? String(n) : '';
    }
    const row = this.quick.querySelector<HTMLElement>('.ed-quick-row')!;
    row.replaceChildren(...list.map((e) => this.copy(e)));
    const note = this.quick.querySelector<HTMLElement>('.ed-quick-empty')!;
    note.hidden = list.length > 0;
    note.textContent = this.quickMode === 'favs' ? 'Right-click a piece, or ★ it, to keep it here.' : 'Pieces you pick show up here.';
  }

  /** A copy of a card for the favourites/recent row or the search results: clicking it clicks the real one. */
  private copy(e: Entry): HTMLElement {
    const c = e.el.cloneNode(true) as HTMLElement;
    for (const a of ['id', 'data-tool', 'data-material', 'data-ground', 'data-key', 'data-search', 'hidden']) c.removeAttribute(a);
    c.dataset.pick = e.key;
    c.dataset.key = e.key;
    c.classList.toggle('active', e.el.classList.contains('active'));
    c.style.setProperty('--cat', PALETTE_CATEGORIES[PANE_CATEGORY[e.pane] ?? 'structure'].color);
    c.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).closest('.fav')) {
        ev.preventDefault();
        this.toggleFav(e.key);
        return;
      }
      e.el.click();
      this.syncActive();
    });
    const slot = c.querySelector<HTMLElement>('.thumb');
    if (slot && e.picture && !slot.classList.contains('atlas') && !slot.querySelector('img')) {
      delete slot.dataset.filled;
      this.watchThumb(slot, e.key);
    }
    return c;
  }

  // ------------------------------------------------------------ search

  private onSearch(): void {
    this.query = this.search.value.trim();
    this.root.classList.toggle('searching', !!this.query);
    this.results.hidden = !this.query;
    for (const p of this.root.querySelectorAll<HTMLElement>('.ed-pane')) p.classList.toggle('search-hide', !!this.query);
    if (this.query) this.renderResults();
    else this.results.querySelector('.tiles')!.replaceChildren();
    this.root.scrollTop = 0;
  }

  /** Ranked matches over every pane. */
  find(query: string): string[] {
    const scored: [number, Entry][] = [];
    for (const e of this.entries.values()) {
      if (!e.inPack) continue;
      const s = matchScore(query, e.fields);
      if (s > 0) scored.push([s + (this.favs.includes(e.key) ? 8 : 0), e]);
    }
    return scored.sort((a, b) => b[0] - a[0]).map(([, e]) => e.key);
  }

  private renderResults(): void {
    const keys = this.find(this.query);
    const grid = this.results.querySelector<HTMLElement>('.tiles')!;
    grid.replaceChildren(...keys.slice(0, RESULTS_MAX).map((k) => this.copy(this.entries.get(k)!)));
    const head = this.results.querySelector<HTMLElement>('.ed-results-head')!;
    head.textContent = keys.length ? `${keys.length} match${keys.length === 1 ? '' : 'es'}${keys.length > RESULTS_MAX ? ` (best ${RESULTS_MAX} shown)` : ''}` : `Nothing matches “${this.query}”. Try a shorter word, a theme (sci-fi, western) or a pack (Kenney).`;
  }

  // ------------------------------------------------------------ view, hover card, keys

  setView(view: 'grid' | 'cards'): void {
    this.root.classList.toggle('grid', view === 'grid');
    this.root.classList.toggle('cards', view === 'cards');
    store.set('view', view);
    const b = document.getElementById('ed-pal-view');
    if (b) {
      b.dataset.view = view;
      b.title = view === 'grid' ? 'Grid view: pictures only, names on hover. Click for cards with names' : 'Card view: pictures with names. Click for a denser grid';
      b.setAttribute('aria-pressed', String(view === 'grid'));
    }
  }

  private toggleGroup(sec: HTMLElement, open = !sec.classList.contains('open')): void {
    sec.classList.toggle('open', open);
    sec.querySelector(':scope > .ed-group-head')!.setAttribute('aria-expanded', String(open));
    this.openGroups[sec.dataset.group!] = open;
    store.set('groups', this.openGroups);
  }

  /** Open the group holding a card (so it can be seen and clicked). */
  reveal(el: HTMLElement): void {
    const sec = el.closest<HTMLElement>('.ed-group');
    if (sec && !sec.classList.contains('open')) this.toggleGroup(sec, true);
  }

  private showTip(el: HTMLElement): void {
    const key = el.dataset.key!;
    const e = this.entries.get(key);
    if (!e) return;
    const cat = PANE_CATEGORY[e.pane] ?? 'structure';
    const lines = (e.el.dataset.tip ?? '').split('\n').filter((l, i) => l.trim() && !(i === 0 && l.startsWith(e.name)));
    const first = (e.el.dataset.tip ?? '').split('\n')[0] ?? '';
    // A first tip line "Name: what it does" keeps its explanation.
    if (first.startsWith(`${e.name}:`)) lines.unshift(first.slice(e.name.length + 1).trim());
    this.tip.style.setProperty('--cat', PALETTE_CATEGORIES[cat].color);
    this.tip.innerHTML = '<b></b><small></small><span></span><em></em>';
    this.tip.querySelector('b')!.textContent = e.name;
    this.tip.querySelector('small')!.textContent = [PALETTE_CATEGORIES[cat].label, e.group, e.pack].filter(Boolean).join(' · ');
    this.tip.querySelector('span')!.textContent = lines.join('\n');
    this.tip.querySelector('em')!.textContent = this.favs.includes(key) ? '★ Favourite · right-click or F to remove' : 'Right-click or F: add to favourites';
    this.tip.hidden = false;
    const r = el.getBoundingClientRect();
    const pal = this.root.getBoundingClientRect();
    const h = this.tip.offsetHeight;
    this.tip.style.left = `${Math.round(pal.right + 6)}px`;
    this.tip.style.top = `${Math.round(Math.max(pal.top + 4, Math.min(innerHeight - h - 44, r.top + r.height / 2 - h / 2)))}px`;
  }

  private hideTip(): void {
    this.tip.hidden = true;
  }

  /** Visible cards in reading order (palette, favourites, results). */
  private visibleCards(): HTMLElement[] {
    return [...this.root.querySelectorAll<HTMLElement>('[data-key]')].filter((c) => c.offsetParent !== null);
  }

  /** The card next to `cur` in a direction, by position on screen. */
  private neighbour(cur: HTMLElement, key: string): HTMLElement | null {
    const cards = this.visibleCards();
    const i = cards.indexOf(cur);
    if (key === 'ArrowRight') return cards[i + 1] ?? null;
    if (key === 'ArrowLeft') return cards[i - 1] ?? null;
    const grid = cur.parentElement;
    const same = cards.filter((c) => c.parentElement === grid);
    if (key === 'Home') return same[0] ?? null;
    if (key === 'End') return same[same.length - 1] ?? null;
    const a = cur.getBoundingClientRect();
    const cx = a.left + a.width / 2;
    const down = key === 'ArrowDown';
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const c of cards) {
      if (c === cur) continue;
      const b = c.getBoundingClientRect();
      const dy = down ? b.top - a.top : a.top - b.top;
      if (dy < a.height / 2) continue;
      const score = dy * 4 + Math.abs(b.left + b.width / 2 - cx);
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }

  private focusCard(c: HTMLElement): void {
    c.focus({ preventScroll: true });
    c.scrollIntoView({ block: 'nearest' });
    this.showTip(c);
  }

  private bind(): void {
    this.search.addEventListener('input', () => this.onSearch());
    this.search.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        const first = this.visibleCards()[0];
        if (!first) return;
        e.preventDefault();
        if (e.key === 'Enter' && this.query) first.click();
        else this.focusCard(first);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.search.value = '';
        this.onSearch();
        this.search.blur();
      }
    });
    this.root.addEventListener('keydown', (e) => {
      const cur = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
      if (!cur || e.ctrlKey || e.metaKey || e.altKey) return;
      if (ARROWS.has(e.key)) {
        const next = this.neighbour(cur, e.key);
        if (next) this.focusCard(next);
        else if (e.key === 'ArrowUp') this.search.focus();
      } else if (e.key === 'f' || e.key === 'F') {
        this.toggleFav(cur.dataset.key!);
        this.showTip(cur);
      } else return;
      // The palette's own: don't let the editor nudge the selection or focus the camera.
      e.preventDefault();
      e.stopPropagation();
    });
    this.root.addEventListener('contextmenu', (e) => {
      const cur = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
      if (!cur) return;
      e.preventDefault();
      this.toggleFav(cur.dataset.key!);
      this.showTip(cur);
    });
    this.root.addEventListener('pointerover', (e) => {
      const cur = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
      if (cur) this.showTip(cur);
      else this.hideTip();
    });
    this.root.addEventListener('pointerleave', () => this.hideTip());
    this.root.addEventListener('focusout', () => this.hideTip());
    this.root.addEventListener('scroll', () => this.hideTip(), { passive: true });
    this.quick.querySelector('.ed-quick-tabs')!.addEventListener('click', (e) => {
      const q = (e.target as HTMLElement).closest<HTMLElement>('button')?.dataset.q as 'favs' | 'recent' | undefined;
      if (!q) return;
      this.quickMode = q;
      store.set('quick', q);
      this.renderQuick();
    });
    document.getElementById('ed-pal-view')?.addEventListener('click', () => this.setView(this.root.classList.contains('grid') ? 'cards' : 'grid'));
  }
}
