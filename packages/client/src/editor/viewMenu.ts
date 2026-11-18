import type { EditorApp } from './editorApp.ts';
import { $ } from './editorDom.ts';
import { menuHeading, menuItem, popupMenu, setChecked, type PopupMenu } from './popupMenu.ts';
import { keepViewPref, readViewPrefs } from './viewPrefs.ts';

/** Map layers: editor-only view filters (EditorView.hiddenLayers), not saved with the map. */
export const VIEW_LAYERS: readonly [string, string][] = [
  ['tile', 'Tiles'],
  ['prop', 'Props'],
  ['pickup', 'Pickups'],
  ['logic', 'Logic & traps'],
  ['spawn', 'Spawn points'],
];

/**
 * The top bar's View menu (MapMaker UI spec Phase 1, the owner's answer 5): the grid, the full grid and overlaps
 * (top-bar toggles before), the plan view (K) and the map layers (Map properties before: they only change what
 * MapMaker shows, never the map). Each item is a checkbox; the ids are the old toggles', so their actions read the same.
 */
export class ViewMenu {
  private menu!: PopupMenu;

  constructor(readonly app: EditorApp) {}

  mount(): void {
    const btn = $<HTMLButtonElement>('ed-view-btn');
    const menu = document.createElement('div');
    menu.id = 'ed-view-menu';
    const grid = menuItem('ed-grid', 'Grid', { checkbox: true, title: "Grid lines on the level being edited, round where you're looking (the playable boundary and build limit always show)", onClick: () => this.setGrid(!grid.classList.contains('on')) });
    const full = menuItem('ed-grid-full', 'Full grid', { checkbox: true, title: 'Full grid: the grid over the whole build area, out to the build limit (off: just round where you are looking)', onClick: () => this.setGridFull(!this.app.view.area.gridFull) });
    const overlaps = menuItem('ed-overlaps', 'Overlaps', { checkbox: true, title: "Highlight places where a block's face lies in the same plane as another piece's (only one look shows there)", onClick: () => this.setOverlaps(!this.app.checks.overlapsOn) });
    const plan = menuItem('ed-plan', 'Plan view', { checkbox: true, key: 'K', title: 'Plan view: the level being edited from straight above, with spawns, objectives and pickups', onClick: () => this.app.plan.toggle() });
    setChecked(grid, true);
    setChecked(full, false);
    setChecked(overlaps, false);
    setChecked(plan, false);
    menu.append(grid, full, overlaps, plan, menuHeading('Map layers (MapMaker only)'));
    for (const [key, label] of VIEW_LAYERS) {
      const item = menuItem(`ed-layer-${key}`, label, { checkbox: true, title: `Show or hide ${label.toLowerCase()} in MapMaker (the map keeps them)`, onClick: () => this.setLayer(key, this.app.view.hiddenLayers.has(key)) });
      item.dataset.layer = key;
      setChecked(item, true);
      menu.append(item);
    }
    $('editor').append(menu);
    this.menu = popupMenu(btn, menu, { label: 'View', onOpen: () => this.sync() });
  }

  /** The items ticked as things stand (on opening: the plan view and layers can change from elsewhere). */
  sync(): void {
    setChecked($('ed-plan'), this.app.plan.on);
    for (const [key] of VIEW_LAYERS) setChecked($(`ed-layer-${key}`), !this.app.view.hiddenLayers.has(key));
  }

  /** View → Grid and Full grid as they were left (viewPrefs.ts), once the view exists. */
  applyKept(): void {
    const kept = readViewPrefs();
    if (!kept.grid) this.setGrid(false, false);
    else if (kept.gridFull) this.setGridFull(true, false);
  }

  setGrid(on: boolean, keep = true): void {
    if (keep) keepViewPref({ grid: on, ...(on ? {} : { gridFull: false }) });
    setChecked($('ed-grid'), on);
    this.app.view.setGridVisible(on);
    // Off also leaves the full grid.
    if (!on && this.app.view.area.gridFull) this.setGridFull(false, keep);
  }

  /** Full grid: over the whole build area, out to the build limit (owner, 2026-11-05); turns Grid on. */
  setGridFull(on: boolean, keep = true): void {
    if (keep) keepViewPref({ gridFull: on, ...(on ? { grid: true } : {}) });
    this.app.view.setGridFull(on);
    setChecked($('ed-grid-full'), on);
    if (on && !$('ed-grid').classList.contains('on')) this.setGrid(true, keep);
  }

  /** Overlaps: highlight where two pieces' faces share a plane (the geometry.coplanar warning's places). */
  setOverlaps(on: boolean): void {
    this.app.checks.overlapsOn = on;
    setChecked($('ed-overlaps'), on);
    this.app.view.setOverlaps(on ? this.app.checks.zSpots : null);
  }

  setLayer(key: string, shown: boolean): void {
    if (shown) this.app.view.hiddenLayers.delete(key);
    else this.app.view.hiddenLayers.add(key);
    setChecked($(`ed-layer-${key}`), shown);
    this.app.view.applyTileLayer();
    this.app.updateSelectionVisuals();
  }

  /** The plan view went on or off (K, the menu, the Test tab's Plan). */
  planChanged(on: boolean): void {
    setChecked($('ed-plan'), on);
    const tb = document.getElementById('ed-tb-plan');
    tb?.classList.toggle('active', on);
    tb?.setAttribute('aria-pressed', String(on));
  }

  close(): void {
    this.menu?.close();
  }
}
