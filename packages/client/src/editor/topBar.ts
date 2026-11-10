import {
  coreThemes,
  emptySelection,
  setThemeCommand,
  type MapDocument
} from '@tiletrigger/shared';
import { isBuiltInMap } from '../mapIndex.ts';
import type { EditorApp } from './editorApp.ts';
import { $ } from './editorDom.ts';
import { firstPane } from './editorModes.ts';
import { TOOL_ICONS } from './editorParts.ts';
import { openPublishDialog } from './ownerPublish.ts';
import {
  exportMap,
  importMapFile
} from './storage.ts';

/** The top bar and the tool bar: file buttons, workspace tabs, levels, grid, overlaps, snap, theme, the counts line, and folding the side panels (split out of editorApp.ts, MapMaker overhaul Phase 2 item 5). */
export class TopBar {
  constructor(readonly app: EditorApp) {}

  // ---------------------------------------------------------------- sidebars

  /** Fold the palette or the side panel away (and back): their tabs, Backslash and Shift+Backslash; remembered in this browser. */
  setupSidebars(): void {
    const root = $('editor');
    const key = 'tiletrigger.editor.sidebars';
    let saved: { pal?: boolean; right?: boolean } = {};
    try {
      saved = JSON.parse(localStorage.getItem(key) ?? '{}') as typeof saved;
    } catch {
      // Storage blocked: both open.
    }
    const apply = (side: 'pal' | 'right', collapsed: boolean) => {
      root.classList.toggle(`${side}-collapsed`, collapsed);
      const btn = $(side === 'pal' ? 'ed-pal-toggle' : 'ed-right-toggle');
      const name = side === 'pal' ? 'the palette' : 'the side panel';
      btn.textContent = (side === 'pal') === collapsed ? '›' : '‹';
      btn.title = `${collapsed ? 'Show' : 'Hide'} ${name} (${side === 'pal' ? '\\' : 'Shift+\\'})`;
      btn.setAttribute('aria-label', `${collapsed ? 'Show' : 'Hide'} ${name}`);
      btn.setAttribute('aria-expanded', String(!collapsed));
    };
    this.toggleSidebar = (side) => {
      const collapsed = !root.classList.contains(`${side}-collapsed`);
      apply(side, collapsed);
      saved[side] = collapsed;
      try {
        localStorage.setItem(key, JSON.stringify(saved));
      } catch {
        // This page only.
      }
    };
    apply('pal', !!saved.pal);
    apply('right', !!saved.right);
    $('ed-pal-toggle').addEventListener('click', () => this.toggleSidebar('pal'));
    $('ed-right-toggle').addEventListener('click', () => this.toggleSidebar('right'));
  }
  toggleSidebar: (side: 'pal' | 'right') => void = () => undefined;
  countedDoc: MapDocument | null = null;
  countedBoxes = 0;

  /** The always-visible tool bar over the view: modes, then actions, each with its key. */
  buildToolbar(): void {
    const bar = $('ed-toolbar');
    const add = (id: string, icon: string, label: string, key: string, title: string, onClick: () => void, tool?: string) => {
      const b = document.createElement('button');
      b.id = id;
      b.className = 'tb-btn';
      if (tool) b.dataset.tool = tool;
      b.title = `${title} (${key})`;
      b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${TOOL_ICONS[icon]}</svg><span class="tb-label">${label}</span>${id === 'ed-tb-place' ? '<small id="ed-tb-place-what"></small>' : ''}<kbd>${key}</kbd>`;
      b.addEventListener('click', () => {
        onClick();
        b.blur();
      });
      bar.append(b);
      return b;
    };
    add('ed-tb-select', 'select', 'Select', 'V', 'Select, move and edit things', () => this.app.setTool({ kind: 'select' }), 'select');
    add('ed-tb-place', 'place', 'Place', 'P', 'Place the last piece you picked from the palette', () => this.app.placeTool(), 'place');
    add('ed-tb-erase', 'erase', 'Erase', 'X', 'Erase: click anything to delete it', () => this.app.setTool({ kind: 'erase' }), 'erase');
    add('ed-tb-paint', 'paint', 'Paint', 'B', 'Paint surfaces', () => this.app.setTool({ kind: 'paint' }), 'paint');
    add('ed-tb-walls', 'edge', 'Walls', 'O', 'Walls & openings: doors, windows, arches on any side', () => this.app.paint.wallsTool(false), 'edge');
    add('ed-tb-terrain', 'terrain', 'Terrain', 'T', 'Sculpt and paint the terrain', () => this.app.terrain.setTerrainBrush(this.app.terrain.terrainBrush), 'terrain');
    add('ed-tb-measure', 'measure', 'Measure', 'U', 'Measure: distance, height difference and slope between points', () => this.app.setTool({ kind: 'measure' }), 'measure');
    const sep = document.createElement('span');
    sep.className = 'tb-sep';
    bar.append(sep);
    add('ed-tb-rotate', 'rotate', 'Rotate', 'R', 'Rotate the selection, or the piece you are placing (Shift+R: a finer step)', () => this.app.edits.rotate());
    add('ed-tb-delete', 'delete', 'Delete', 'Del', 'Delete the selection', () => this.app.edits.deleteSelection());
    this.app.keyOverlay.mountButton(bar);
    // Help: the first-time tour again (tour.ts), for anyone without a ? key to reach the key list's Take the tour.
    const help = document.createElement('button');
    help.id = 'ed-tb-help';
    help.className = 'tb-btn';
    help.title = 'Help: a short walk through making a map (a room, a spawn, a pickup, then test it)';
    help.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.2 9.3a2.9 2.9 0 1 1 4.1 2.6c-.8.4-1.3 1-1.3 1.9v.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.2" fill="currentColor"/></svg><span class="tb-label">Help</span>';
    help.addEventListener('click', () => {
      help.blur();
      this.app.tour.start();
    });
    bar.append(help);
    this.syncToolbar();
  }

  /** Selection actions are only live with something selected. */
  syncToolbar(): void {
    $<HTMLButtonElement>('ed-tb-delete').disabled = !this.app.selCount();
    const save = document.getElementById('ed-sp-save') as HTMLButtonElement | null;
    if (save) save.disabled = !this.app.selCount();
  }

  /**
   * The top bar's mode tabs (editorModes.ts): each picks its own row of palette tabs and opens on its first pane; Logic
   * opens the rules panel. Test is a mode of its own (its pane plays the map), no longer a shortcut that plays at once.
   */
  setWorkspace(ws: string): void {
    if (ws === 'logic') {
      if (!this.app.logic.isOpen) this.app.logic.open();
      return;
    }
    if (this.app.logic.isOpen) this.app.logic.close();
    this.app.paletteWs = ws;
    this.app.showPane(firstPane(ws));
    if (ws === 'environment' && this.app.selCount()) this.app.setSelection(emptySelection());
  }

  /** The mode the inspector last drew for (its part with nothing selected follows the mode: modeInspector.ts). */
  private shownWs = '';

  /** Light the top bar's workspace tab: Logic while its panel is open, else the palette's workspace. */
  syncWorkspaceTabs(): void {
    const on = this.app.logic?.isOpen ? 'logic' : this.app.paletteWs;
    for (const b of document.querySelectorAll<HTMLElement>('#ed-modes .tab')) b.classList.toggle('on', b.dataset.ws === on);
    if (this.shownWs !== this.app.paletteWs) {
      const first = !this.shownWs;
      this.shownWs = this.app.paletteWs;
      if (!first && this.app.history && this.app.selCount() === 0) this.app.inspector.renderInspector();
    }
  }

  bindUi(): void {
    $('ed-home').addEventListener('click', () => this.app.saving.quit());
    $('ed-undo').addEventListener('click', () => this.app.undo());
    $('ed-redo').addEventListener('click', () => this.app.redo());
    $('ed-save').addEventListener('click', () => this.app.saving.save());
    $('ed-export').addEventListener('click', () => {
      // Keep the identity the export stamped (map ID, version, hash), so the next export continues it.
      const release = exportMap(this.app.doc).metadata.release;
      if (release) this.app.doc.metadata.release = release;
    });
    $('ed-new').addEventListener('click', () => this.app.saving.newMapDialog());
    $('ed-open').addEventListener('click', () => this.app.saving.openDialog());
    $('ed-import').addEventListener('click', () => $('ed-import-file').click());
    $('ed-publish').addEventListener('click', () => {
      void openPublishDialog($<HTMLDialogElement>('ed-publish-dialog'), { doc: () => this.app.doc, builtIn: isBuiltInMap, toast: (t, err) => this.app.toast(t, err) });
    });
    $<HTMLInputElement>('ed-import-file').addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      (e.target as HTMLInputElement).value = '';
      if (!file) return;
      const r = await importMapFile(file);
      if (!('map' in r)) return this.app.toast(`Import failed: ${r.issues[0]?.message ?? 'unknown error'}`, true);
      this.app.saving.keepDraft();
      this.app.saving.replaceDocument(r.map);
      const errors = r.issues.filter((i) => i.severity === 'error').length;
      this.app.toast(`Imported ${r.map.metadata.name}${errors ? ` (${errors} problem${errors === 1 ? '' : 's'} to fix before it plays: see the list)` : ''}`);
    });
    $('ed-test').addEventListener('click', () => this.app.test());
    $('ed-test-here').addEventListener('click', () => this.app.playFromHere());
    $('ed-plan').addEventListener('click', (e) => {
      this.app.plan.toggle();
      (e.currentTarget as HTMLElement).blur();
    });
    this.setupSidebars();
    $('ed-status').addEventListener('click', () => $('ed-issues').scrollIntoView({ behavior: 'smooth' }));
    $('ed-level-up').addEventListener('click', () => this.app.setLevel(this.app.level + 1));
    $('ed-level-down').addEventListener('click', () => this.app.setLevel(this.app.level - 1));
    $<HTMLInputElement>('ed-showall').addEventListener('change', (e) => this.app.setShowAll((e.target as HTMLInputElement).checked));

    const name = $<HTMLInputElement>('ed-name');
    name.addEventListener('change', () => {
      const v = name.value.trim().slice(0, 80) || 'Untitled Map';
      if (v !== this.app.doc.metadata.name) this.app.run('Rename map', { kind: 'setMetadata', before: { name: this.app.doc.metadata.name }, after: { name: v } });
    });
    name.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') name.blur();
    });

    const bots = $<HTMLSelectElement>('ed-bots');
    for (let i = 0; i <= 15; i++) bots.append(new Option(`${i} bot${i === 1 ? "" : "s"}`, String(i), i === 3, i === 3));

    $('ed-grid').addEventListener('click', () => {
      const on = !$('ed-grid').classList.contains('on');
      $('ed-grid').classList.toggle('on', on);
      $('ed-grid').setAttribute('aria-pressed', String(on));
      this.app.view.setGridVisible(on);
      // Off also leaves the full grid.
      if (!on && this.app.view.area.gridFull) this.setGridFull(false);
    });
    // Full grid: over the whole build area, out to the build limit (owner, 2026-11-05); turns Grid on.
    $('ed-grid-full').addEventListener('click', () => this.setGridFull(!this.app.view.area.gridFull));
    // Overlaps: highlight where two pieces' faces share a plane (the geometry.coplanar warning's places).
    $('ed-overlaps').addEventListener('click', () => {
      this.app.checks.overlapsOn = !this.app.checks.overlapsOn;
      $('ed-overlaps').classList.toggle('on', this.app.checks.overlapsOn);
      $('ed-overlaps').setAttribute('aria-pressed', String(this.app.checks.overlapsOn));
      this.app.view.setOverlaps(this.app.checks.overlapsOn ? this.app.checks.zSpots : null);
    });
    $<HTMLSelectElement>('ed-snap').addEventListener('change', (e) => (this.app.snapMode = (e.target as HTMLSelectElement).value as typeof this.app.snapMode));
    const theme = $<HTMLSelectElement>('ed-theme');
    for (const t of coreThemes.all()) theme.append(new Option(t.displayName, t.id));
    theme.addEventListener('change', () => this.app.run('Change theme', setThemeCommand(this.app.doc, theme.value)));
  }

  setGridFull(on: boolean): void {
    this.app.view.setGridFull(on);
    $('ed-grid-full').classList.toggle('on', on);
    $('ed-grid-full').setAttribute('aria-pressed', String(on));
    if (on && !$('ed-grid').classList.contains('on')) $('ed-grid').click();
  }

  updateTopBar(): void {
    $<HTMLSelectElement>('ed-theme').value = this.app.doc.classicStructure.theme;
    const name = $<HTMLInputElement>('ed-name');
    if (document.activeElement !== name) name.value = this.app.doc.metadata.name;
    $('ed-dirty').classList.toggle('on', this.app.saving.isDirty());
    $<HTMLButtonElement>('ed-undo').disabled = !this.app.history.canUndo;
    $<HTMLButtonElement>('ed-redo').disabled = !this.app.history.canRedo;
    $('ed-undo').title = this.app.history.undoLabel ? `Undo ${this.app.history.undoLabel} (Ctrl+Z)` : 'Undo (Ctrl+Z)';
    $('ed-redo').title = this.app.history.redoLabel ? `Redo ${this.app.history.redoLabel} (Ctrl+Y)` : 'Redo (Ctrl+Y)';
  }

  updateCounts(): void {
    const tiles = this.app.doc.classicStructure.tiles.length;
    const spawns = this.app.doc.entities.filter((e) => e.kind === 'spawn').length;
    const pickups = this.app.doc.entities.filter((e) => e.kind === 'pickup').length;
    const npcs = this.app.doc.entities.filter((e) => e.kind === 'encounter').length;
    const scenario = this.app.doc.entities.length - spawns - pickups - npcs;
    const rules = this.app.doc.logic.rules.length;
    const pieces = this.app.doc.setPieces?.length ?? 0;
    // Counted once per version of the document (refresh runs this on every edit and level change), set pieces expanded.
    if (this.countedDoc !== this.app.doc) {
      this.countedDoc = this.app.doc;
      this.countedBoxes = this.app.mapBoxes().length;
    }
    const boxes = this.countedBoxes;
    $('ed-counts').textContent = `${tiles} tiles${pieces ? ` · ${pieces} set piece${pieces === 1 ? '' : 's'}` : ''} · ${spawns} spawns · ${pickups} pickups · ${scenario} scenario objects · ${npcs} NPC squads · ${rules} rules · ${boxes} collision boxes`;
  }
}
