import type { EditorApp } from './editorApp.ts';
import { $ } from './editorDom.ts';
import {
  clampDockWidth,
  DEFAULT_TILE_SNAP,
  DOCK_MIN_W,
  dockMaxWidth,
  DOCK_KEY,
  LEGACY_SIDEBARS_KEY,
  nextDockState,
  parseDockPrefs,
  resizedDockState,
  serializeDockPrefs,
  startingDockState,
  type DockPrefs,
  type DockState,
  type DockTab
} from './dockPrefs.ts';
import { mountPanels } from './panels.ts';

const STATE_WORDS: Record<DockState, string> = { expanded: 'expanded', compact: 'compact (minimap only)', hidden: 'hidden' };

/**
 * The right dock (MapMaker UI spec Phase 1, §2 and §8; the owner's answers 1, 4 and 7). Three states, cycled by
 * Shift+\ and its own buttons, kept in this browser (dockPrefs.ts):
 * - expanded: Minimap | Outliner (tabs, Phase 3; the Outliner unless chosen), Properties (the inspector) and
 *   Validation, or Map settings in their place;
 * - compact: the minimap only (minimapPanel.ts), in a small card;
 * - hidden: gone, with an edge tab to bring it back; the view has the window.
 * Its width can be dragged (kept); under 900 px wide it starts compact. Selecting never opens it; asking for Map
 * settings or the problems list does. Folding and showing it only changes classes and one width: the canvas already
 * covers the window, so nothing is resized and nothing runs per frame.
 */
export class RightDock {
  state: DockState = 'expanded';
  prefs: DockPrefs = parseDockPrefs(null);
  /** Whether the Outliner's panel is unfolded (panels.ts); it draws only while it can be seen. */
  private outlinerFolded = false;
  /** The expanded dock's top tab (kept with the dock's state). */
  tab: DockTab = 'outliner';

  constructor(readonly app: EditorApp) {}

  mount(): void {
    let raw: string | null = null;
    let legacy: string | null = null;
    try {
      raw = localStorage.getItem(DOCK_KEY);
      if (!raw) legacy = localStorage.getItem(LEGACY_SIDEBARS_KEY);
    } catch {
      // Storage blocked: the defaults.
    }
    this.prefs = parseDockPrefs(raw, legacy);
    // The Outliner, Properties and Validation fold from their headings, as each person left them.
    const folds = mountPanels($('ed-right'), (id, open) => {
      if (id !== 'outliner') return;
      this.outlinerFolded = !open;
      this.syncOutliner();
    });
    this.outlinerFolded = !folds.isOpen('outliner');
    this.tab = this.prefs.tab ?? 'outliner';
    this.mountTabs();
    $('ed-dock-compact').addEventListener('click', () => this.set(this.state === 'compact' ? 'expanded' : 'compact'));
    $('ed-dock-hide').addEventListener('click', () => this.set('hidden'));
    $('ed-dock-expand').addEventListener('click', () => this.set('expanded'));
    $('ed-right-toggle').addEventListener('click', () => this.set(this.state === 'hidden' ? 'expanded' : 'hidden'));
    this.mountGrip();
    if (this.prefs.width) this.applyWidth(this.prefs.width);
    this.set(startingDockState(this.prefs.right, innerWidth), false);
    this.mountResize();
  }

  /**
   * The window resized (UI Phase 5): a kept width is fitted to the new window again (never more than 45 % of it; the
   * kept number stays, so widening the window gives it back), and crossing 900 px folds or restores the dock
   * (dockPrefs resizedDockState). Once a frame at most; nothing is read from the page but the window's width.
   */
  private mountResize(): void {
    requestAnimationFrame(() => this.syncGrip());
    let width = innerWidth;
    let queued = 0;
    addEventListener('resize', () => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        const now = innerWidth;
        if (now === width) return;
        if (this.prefs.width) this.applyWidth(this.prefs.width);
        else this.syncGrip();
        const next = resizedDockState(this.state, this.prefs.right, width, now);
        width = now;
        if (next !== this.state) this.set(next, false);
      });
    });
  }

  /** The grip's value for screen readers: the dock's width now and its limits in this window. */
  private syncGrip(w?: number): void {
    const grip = document.getElementById('ed-dock-grip');
    if (!grip) return;
    grip.setAttribute('aria-valuemin', String(DOCK_MIN_W));
    grip.setAttribute('aria-valuemax', String(dockMaxWidth(innerWidth)));
    const now = w ?? this.prefs.width ?? Math.round(document.getElementById('ed-right')?.getBoundingClientRect().width ?? 0);
    if (now) grip.setAttribute('aria-valuenow', String(now));
  }

  /** Shift+\: expanded → compact → hidden → expanded. */
  cycle(): void {
    this.set(nextDockState(this.state));
    this.app.toast(`Right dock ${STATE_WORDS[this.state]} (Shift+\\)`);
  }

  set(state: DockState, persist = true): void {
    this.state = state;
    const root = $('editor');
    root.dataset.dock = state;
    const right = $('ed-right');
    right.dataset.state = state;
    const compact = $('ed-dock-compact');
    compact.textContent = state === 'compact' ? '⇤' : '▭';
    compact.title = state === 'compact' ? 'Expand the dock: Outliner and Properties (Shift+\\)' : 'Compact: the minimap only (Shift+\\)';
    compact.setAttribute('aria-label', state === 'compact' ? 'Expand the dock' : 'Make the dock compact');
    $('ed-dock-mini').hidden = state !== 'compact';
    const toggle = $('ed-right-toggle');
    toggle.textContent = state === 'hidden' ? '‹' : '›';
    toggle.title = state === 'hidden' ? 'Show the right dock (Shift+\\)' : 'Hide the right dock (Shift+\\)';
    toggle.setAttribute('aria-label', state === 'hidden' ? 'Show the right dock' : 'Hide the right dock');
    toggle.setAttribute('aria-expanded', String(state !== 'hidden'));
    this.syncViews();
    if (persist && this.prefs.right !== state) {
      this.prefs.right = state;
      this.save();
    }
  }

  /** For Map settings and the problems list: the dock expanded (on purpose, so it is kept). */
  ensureExpanded(): void {
    if (this.state !== 'expanded') this.set('expanded');
  }

  /** Which of the dock's views shows: the panels, or Map settings in their place. */
  syncViews(): void {
    const settings = this.app.mapSettings.isOpen;
    $('ed-dock-panels').hidden = settings;
    $('ed-map-settings').hidden = !settings;
    this.syncOutliner();
  }

  /** The status pill and the Test tab's Problems list: Validation unfolded and in view. */
  showProblems(): void {
    this.app.mapSettings.close();
    this.ensureExpanded();
    const panel = document.querySelector<HTMLElement>('#ed-right .ed-panel[data-panel="issues"]');
    if (panel?.classList.contains('folded')) panel.querySelector<HTMLButtonElement>('.ed-panel-head > button')?.click();
    $('ed-issues').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /** Minimap | Outliner (WAI-ARIA tabs: a click, or the arrow keys, Home and End on a tab). */
  private mountTabs(): void {
    const tabs = [...document.querySelectorAll<HTMLButtonElement>('#ed-outliner-panel [role="tab"]')];
    for (const t of tabs) {
      t.addEventListener('click', () => this.setTab(t.dataset.tab as DockTab));
      t.addEventListener('keydown', (e) => {
        const i = tabs.indexOf(t);
        const to = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
        if (to < 0) return;
        e.preventDefault();
        e.stopPropagation();
        this.setTab(tabs[to]!.dataset.tab as DockTab);
        tabs[to]!.focus();
      });
    }
    this.applyTab();
  }

  /** Show the Minimap or the Outliner above Properties (kept in this browser, never in the map). */
  setTab(tab: DockTab): void {
    if (tab === this.tab) return;
    this.tab = tab;
    this.applyTab();
    this.syncViews();
    const want = tab === 'minimap' ? 'minimap' : undefined;
    if (this.prefs.tab !== want) {
      if (want) this.prefs.tab = want;
      else delete this.prefs.tab;
      this.save();
    }
  }

  private applyTab(): void {
    $('ed-outliner-panel').dataset.tab = this.tab;
    for (const t of document.querySelectorAll<HTMLButtonElement>('#ed-outliner-panel [role="tab"]')) {
      const on = t.dataset.tab === this.tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    }
    // Tile View (Phase 4a) takes the minimap's place while it is open.
    const tile = this.app.tileView.isOpen;
    $('ed-minimap-host').hidden = this.tab !== 'minimap' || tile;
    $('ed-tileview-host').hidden = this.tab !== 'minimap' || !tile;
    $('ed-outliner').hidden = this.tab !== 'outliner';
  }

  /**
   * Tile View opened or closed (UI spec Phase 4a): it shows in the expanded dock in the Minimap's place. Opening it is
   * asked for (Enter, a double-click, its button), so the dock expands and shows the Minimap tab; closing it gives the
   * minimap back.
   */
  tileViewChanged(open: boolean): void {
    if (open) {
      this.app.mapSettings.close();
      this.ensureExpanded();
      if (this.outlinerFolded) document.querySelector<HTMLButtonElement>('#ed-outliner-panel .ed-nav-fold')?.click();
      if (this.tab !== 'minimap') this.setTab('minimap');
    }
    this.applyTab();
    this.syncViews();
  }

  /** Tile View's snap step (cm) and coordinates, kept with the dock (never in the map). */
  tileSnapCm(): number {
    return this.prefs.tileSnap ?? DEFAULT_TILE_SNAP;
  }

  setTileSnapCm(cm: number): void {
    const want = cm === DEFAULT_TILE_SNAP ? undefined : cm;
    if (this.prefs.tileSnap === want) return;
    if (want) this.prefs.tileSnap = want;
    else delete this.prefs.tileSnap;
    this.save();
  }

  tileFrame(): 'local' | 'world' {
    return this.prefs.tileFrame ?? 'local';
  }

  setTileFrame(f: 'local' | 'world'): void {
    if (this.tileFrame() === f) return;
    if (f === 'world') this.prefs.tileFrame = 'world';
    else delete this.prefs.tileFrame;
    this.save();
  }

  /** The minimap's zoom, kept with the dock (never in the map). */
  minimapZoom(): number {
    return this.prefs.minimapZoom ?? 1;
  }

  setMinimapZoom(z: number): void {
    const want = z > 1 ? Math.round(z * 100) / 100 : undefined;
    if (this.prefs.minimapZoom === want) return;
    if (want) this.prefs.minimapZoom = want;
    else delete this.prefs.minimapZoom;
    this.save();
  }

  private syncOutliner(): void {
    // The minimap: in the compact card, or the expanded dock's Minimap tab while it shows; else nothing of it runs.
    const panels = this.state === 'expanded' && !this.app.mapSettings.isOpen && !this.outlinerFolded;
    const tile = this.app.tileView.isOpen;
    this.app.minimap.show(this.state === 'compact' ? $('ed-minimap-mini') : panels && this.tab === 'minimap' && !tile ? $('ed-minimap-host') : null);
    this.app.tileView.show(this.state === 'expanded' && panels && this.tab === 'minimap' && tile ? $('ed-tileview-host') : null);
    const seen = panels && this.tab === 'outliner';
    if (seen === this.app.outliner.open) return;
    // (While MapMaker is still being put together there is no map to list yet: the flag alone.)
    if (!this.app.history) this.app.outliner.open = seen;
    else this.app.outliner.setOpen(seen);
  }

  private save(): void {
    try {
      localStorage.setItem(DOCK_KEY, serializeDockPrefs(this.prefs));
    } catch {
      // This page only.
    }
  }

  saveLeft(left: DockPrefs['left']): void {
    if (this.prefs.left === left) return;
    this.prefs.left = left;
    this.save();
  }

  private applyWidth(w: number): void {
    const px = clampDockWidth(w, innerWidth);
    $('editor').style.setProperty('--ed-dock-w', `${px}px`);
    this.syncGrip(px);
  }

  /** The dock's inner edge drags its width (and the arrow keys, with it focused); kept once let go. */
  private mountGrip(): void {
    const grip = $('ed-dock-grip');
    let from: { x: number; w: number } | null = null;
    const commit = () => {
      const w = Math.round($('ed-right').getBoundingClientRect().width);
      this.prefs.width = clampDockWidth(w, innerWidth);
      grip.setAttribute('aria-valuenow', String(this.prefs.width));
      this.save();
    };
    grip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      from = { x: e.clientX, w: $('ed-right').getBoundingClientRect().width };
      grip.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    grip.addEventListener('pointermove', (e) => {
      if (from) this.applyWidth(from.w + (from.x - e.clientX));
    });
    const end = () => {
      if (!from) return;
      from = null;
      commit();
    };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    grip.addEventListener('dblclick', () => {
      delete this.prefs.width;
      $('editor').style.removeProperty('--ed-dock-w');
      this.save();
      requestAnimationFrame(() => this.syncGrip());
    });
    // The arrows widen and narrow it 16 px (Shift: 64), Home and End go to its narrowest and widest (a WAI-ARIA
    // window splitter).
    const keySteps: Record<string, number> = { ArrowLeft: 16, ArrowRight: -16, ArrowUp: 16, ArrowDown: -16 };
    grip.addEventListener('keydown', (e) => {
      const step = keySteps[e.key];
      const to = e.key === 'Home' ? DOCK_MIN_W : e.key === 'End' ? dockMaxWidth(innerWidth) : step !== undefined ? $('ed-right').getBoundingClientRect().width + step * (e.shiftKey ? 4 : 1) : null;
      if (to === null) return;
      e.preventDefault();
      e.stopPropagation();
      this.applyWidth(to);
      commit();
    });
  }
}
