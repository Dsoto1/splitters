import {
  emptyOutlinerFlags,
  outlineEntries,
  outlineRows,
  outlineWindow,
  parseOutlinerFlags,
  pickableSelection,
  toggleOutlinerFlag,
  withoutHidden,
  type MapDocument,
  type OutlineEntry,
  type OutlineRow,
  type OutlinerFlags,
  type Selection,
} from '@tiletrigger/shared';
import type { EditorApp } from './editorApp.ts';

/** One row of the list (px): the list draws only the rows in view (outlineWindow), so 4,096 things stay quick. */
const ROW = 22;
const FLAGS_KEY = (mapId: string) => `tiletrigger.editor.outliner.${mapId}`;
const CLOSED_KEY = 'tiletrigger.editor.outliner.closed';

const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // This page only.
    }
  },
};

/**
 * The outliner (MapMaker overhaul Phase 2 item 3; the list's logic: shared editor/outliner.ts): everything in the map in
 * one searchable list, grouped by kind and then level. A click selects and frames (Shift adds); the eye hides a thing
 * from MapMaker's view and the lock keeps it from being picked or selected. Hide and lock are kept per map in this
 * browser, never in the map file, and a test match plays everything.
 */
export class OutlinerPanel {
  private flags: OutlinerFlags = emptyOutlinerFlags();
  private flagsFor = '';
  /** Bumped when hide changes, so MapMaker redraws the map (EditorApp.refresh). */
  flagsRev = 0;
  /** Hidden ids (not drawn, not picked) and locked ones (not picked or selected). */
  hidden = new Set<string>();
  locked = new Set<string>();
  /** Either: what a click on the map can't pick. */
  blocked = new Set<string>();
  private entriesFor: MapDocument | null = null;
  private entries: OutlineEntry[] = [];
  private rows: OutlineRow[] = [];
  private query = '';
  private closed: Set<string>;
  private readonly list: HTMLElement;
  private readonly spacer: HTMLElement;
  private readonly search: HTMLInputElement;
  private drawn = '';
  open = true;
  /** How long the last full rebuild took (ms): entries, rows and the window. The e2e flow reads it at 4,096 things. */
  lastBuildMs = 0;

  constructor(
    private readonly app: EditorApp,
    private readonly root: HTMLElement,
  ) {
    this.closed = new Set(parseOutlinerFlagsList(store.get(CLOSED_KEY)));
    this.search = document.createElement('input');
    this.search.type = 'search';
    this.search.id = 'ed-ol-search';
    this.search.placeholder = 'Search the map…';
    this.search.setAttribute('aria-label', 'Search everything in the map');
    this.search.addEventListener('input', () => {
      this.query = this.search.value;
      this.list.scrollTop = 0;
      this.rebuildRows();
    });
    this.list = document.createElement('div');
    this.list.id = 'ed-ol-list';
    this.list.className = 'ed-ol-list';
    this.list.setAttribute('role', 'tree');
    this.spacer = document.createElement('div');
    this.spacer.className = 'ed-ol-spacer';
    this.list.append(this.spacer);
    this.list.addEventListener('scroll', () => this.draw());
    this.list.addEventListener('click', (e) => this.onClick(e));
    root.append(this.search, this.list);
  }

  /** The map changed (or another map opened): read its flags, and redraw the list if it's open. */
  update(force = false): void {
    const id = this.app.doc.metadata.id;
    if (id !== this.flagsFor) {
      this.flagsFor = id;
      this.setFlags(parseOutlinerFlags(store.get(FLAGS_KEY(id))), false);
    }
    if (!this.open) return;
    if (force || this.entriesFor !== this.app.doc) this.rebuild();
    else this.draw(true);
  }

  /** The map as drawn: hidden things left out (set pieces with their parts). */
  shown(view: MapDocument): MapDocument {
    return withoutHidden(view, this.hidden, this.app.expansion.partOf);
  }

  /** A selection without the locked things. */
  selectable(sel: Selection): Selection {
    return pickableSelection(sel, this.locked);
  }

  setOpen(open: boolean): void {
    this.open = open;
    if (open) this.update(true);
  }

  private setFlags(flags: OutlinerFlags, save = true): void {
    const hiddenBefore = [...this.hidden].sort().join();
    this.flags = flags;
    this.hidden = new Set(flags.hidden);
    this.locked = new Set(flags.locked);
    this.blocked = new Set([...flags.hidden, ...flags.locked]);
    if ([...this.hidden].sort().join() !== hiddenBefore) this.flagsRev++;
    if (save) store.set(FLAGS_KEY(this.flagsFor), JSON.stringify(flags));
    const n = flags.hidden.length + flags.locked.length;
    const count = document.getElementById('ed-ol-count');
    if (count) count.textContent = n ? `${flags.hidden.length ? `${flags.hidden.length} hidden` : ''}${flags.hidden.length && flags.locked.length ? ' · ' : ''}${flags.locked.length ? `${flags.locked.length} locked` : ''}` : '';
  }

  /** Hide or lock things (or show and unlock them), kept for this map in this browser. */
  flag(which: 'hidden' | 'locked', ids: readonly string[], on: boolean): void {
    const doc = this.app.doc;
    const inMap = new Set([...doc.classicStructure.tiles.map((t) => t.id), ...doc.entities.map((e) => e.id), ...(doc.setPieces ?? []).map((p) => p.id)]);
    this.setFlags(toggleOutlinerFlag(this.flags, which, ids, on, inMap));
    if (on && which === 'locked') this.app.setSelection(this.selectable(this.app.selection), true);
    this.draw(true);
  }

  private rebuild(): void {
    const t0 = performance.now();
    this.entriesFor = this.app.doc;
    this.entries = outlineEntries(this.app.doc, (p) => this.app.pieceDef(p)?.displayName ?? p);
    this.rebuildRows();
    this.lastBuildMs = performance.now() - t0;
  }

  private rebuildRows(): void {
    this.rows = outlineRows(this.entries, { query: this.query, closed: this.closed });
    this.spacer.style.height = `${this.rows.length * ROW}px`;
    this.draw(true);
  }

  /** Draw the rows in view (and a few either side). */
  draw(force = false): void {
    if (!this.open) return;
    const { start, end } = outlineWindow(this.list.scrollTop, this.list.clientHeight || 240, ROW, this.rows.length);
    const sel = this.app.selection;
    const picked = new Set([...sel.tiles, ...sel.entities, ...(sel.setPieces ?? [])]);
    const key = `${start}:${end}:${this.rows.length}`;
    if (!force && key === this.drawn) return;
    this.drawn = key;
    const frag = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      const r = this.rows[i]!;
      const el = document.createElement('div');
      el.style.top = `${i * ROW}px`;
      el.dataset.row = String(i);
      if (r.type === 'item') {
        const e = r.entry;
        el.className = `ed-ol-item${picked.has(e.id) ? ' on' : ''}${this.hidden.has(e.id) ? ' hidden' : ''}${this.locked.has(e.id) ? ' locked' : ''}`;
        el.dataset.id = e.id;
        el.setAttribute('role', 'treeitem');
        el.innerHTML = `<span class="nm"></span><span class="lv"></span><button type="button" class="ed-ol-eye" data-act="hide" title="Hide in MapMaker (editor only)" aria-label="Hide"></button><button type="button" class="ed-ol-lock" data-act="lock" title="Lock: can't be picked or selected (editor only)" aria-label="Lock"></button>`;
        el.querySelector('.nm')!.textContent = e.name;
        el.querySelector('.lv')!.textContent = `L${e.level + 1}`;
      } else {
        el.className = `ed-ol-head ${r.type}${r.open ? ' open' : ''}`;
        el.dataset.key = r.key;
        el.textContent = `${r.open ? '▾' : '▸'} ${r.label} (${r.count})`;
      }
      frag.append(el);
    }
    for (const old of [...this.list.children]) if (old !== this.spacer) old.remove();
    this.list.append(frag);
  }

  private onClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const rowEl = target.closest<HTMLElement>('[data-row]');
    if (!rowEl) return;
    const head = rowEl.dataset.key;
    if (head) {
      if (this.closed.has(head)) this.closed.delete(head);
      else this.closed.add(head);
      store.set(CLOSED_KEY, JSON.stringify([...this.closed]));
      return this.rebuildRows();
    }
    const id = rowEl.dataset.id;
    const entry = id ? this.entries.find((x) => x.id === id) : undefined;
    if (!entry) return;
    const act = target.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'hide') return this.flag('hidden', [entry.id], !this.hidden.has(entry.id));
    if (act === 'lock') return this.flag('locked', [entry.id], !this.locked.has(entry.id));
    if (this.locked.has(entry.id)) {
      this.app.toast(`${entry.name} is locked: unlock it (the padlock) to select it`, true);
      return;
    }
    const one: Selection = entry.kind === 'tile' ? { tiles: [entry.id], entities: [] } : entry.kind === 'setpiece' ? { tiles: [], entities: [], setPieces: [entry.id] } : { tiles: [], entities: [entry.id] };
    const sel = e.shiftKey ? mergeSelections(this.app.selection, one) : one;
    this.app.setTool({ kind: 'select' });
    if (entry.level !== this.app.level && !this.app.showAll) this.app.setLevel(entry.level, true);
    this.app.setSelection(sel);
    this.app.focusSelection();
    this.draw(true);
  }
}

function mergeSelections(a: Selection, b: Selection): Selection {
  const u = (x: readonly string[], y: readonly string[]) => [...new Set([...x, ...y])];
  const pieces = u(a.setPieces ?? [], b.setPieces ?? []);
  return { tiles: u(a.tiles, b.tiles), entities: u(a.entities, b.entities), ...(pieces.length ? { setPieces: pieces } : {}) };
}

function parseOutlinerFlagsList(raw: string | null): string[] {
  try {
    const v = JSON.parse(raw ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
