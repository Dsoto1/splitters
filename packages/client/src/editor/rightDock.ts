import type { EditorApp } from './editorApp.ts';
import { $ } from './editorDom.ts';
import {
  clampDockWidth,
  DOCK_KEY,
  LEGACY_SIDEBARS_KEY,
  nextDockState,
  parseDockPrefs,
  serializeDockPrefs,
  startingDockState,
  type DockPrefs,
  type DockState
} from './dockPrefs.ts';
import { mountPanels } from './panels.ts';

const STATE_WORDS: Record<DockState, string> = { expanded: 'expanded', compact: 'compact (minimap only)', hidden: 'hidden' };

/**
 * The right dock (MapMaker UI spec Phase 1, §2 and §8; the owner's answers 1, 4 and 7). Three states, cycled by
 * Shift+\ and its own buttons, kept in this browser (dockPrefs.ts):
 * - expanded: the Outliner, Properties (the inspector) and Validation, or Map settings in their place;
 * - compact: the minimap only (a placeholder until Phase 3 builds it), in a small card;
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
    $('ed-dock-compact').addEventListener('click', () => this.set(this.state === 'compact' ? 'expanded' : 'compact'));
    $('ed-dock-hide').addEventListener('click', () => this.set('hidden'));
    $('ed-dock-expand').addEventListener('click', () => this.set('expanded'));
    $('ed-right-toggle').addEventListener('click', () => this.set(this.state === 'hidden' ? 'expanded' : 'hidden'));
    this.mountGrip();
    if (this.prefs.width) this.applyWidth(this.prefs.width);
    this.set(startingDockState(this.prefs.right, innerWidth), false);
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

  private syncOutliner(): void {
    const seen = this.state === 'expanded' && !this.app.mapSettings.isOpen && !this.outlinerFolded;
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
    $('editor').style.setProperty('--ed-dock-w', `${clampDockWidth(w, innerWidth)}px`);
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
    });
    grip.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      e.stopPropagation();
      this.applyWidth($('ed-right').getBoundingClientRect().width + (e.key === 'ArrowLeft' ? 16 : -16));
      commit();
    });
  }
}
