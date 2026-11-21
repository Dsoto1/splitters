import { keepViewPref, readViewPrefs } from './viewPrefs.ts';
import {
  coreThemes,
  terrainGroundTheme,
  emptySelection
} from '@tiletrigger/shared';
import { isBuiltInMap } from '../mapIndex.ts';
import type { EditorApp } from './editorApp.ts';
import { $ } from './editorDom.ts';
import { firstPane } from './editorModes.ts';
import { groundThemeLabel } from './editorParts.ts';
import { rememberedShowAll } from './showAllSetting.ts';
import { openPublishDialog } from './ownerPublish.ts';
import {
  exportMap,
  importMapFile
} from './storage.ts';

/** The top bar: file buttons, the title (it opens Map settings), workspace tabs, snap, the Structure theme's chip, the TEST bots and skill, the level strip's buttons (split out of editorApp.ts, MapMaker overhaul Phase 2 item 5; the View menu, the tool bar and the status bar have modules of their own since UI Phase 1). */
export class TopBar {
  constructor(readonly app: EditorApp) {}

  /** The tool bar over the view: each tab's own tools and the ⋯ menu of every tool (toolBar.ts). */
  buildToolbar(): void {
    this.app.toolBar.build();
    this.syncToolbar();
  }

  /** Selection actions are only live with something selected. */
  syncToolbar(): void {
    this.app.toolBar.syncSelection();
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
    for (const b of document.querySelectorAll<HTMLElement>('#ed-modes .tab')) {
      b.classList.toggle('on', b.dataset.ws === on);
      b.setAttribute('aria-pressed', String(b.dataset.ws === on));
    }
    this.app.toolBar.syncTab();
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
    $('ed-level-up').addEventListener('click', () => this.app.setLevel(this.app.level + 1));
    $('ed-level-down').addEventListener('click', () => this.app.setLevel(this.app.level - 1));
    $('ed-showall').addEventListener('click', (e) => {
      this.app.setShowAll(!this.app.showAll);
      (e.currentTarget as HTMLElement).blur();
    });
    // As it was left last time (the level list's Show all levels, H).
    if (rememberedShowAll()) this.app.setShowAll(true, true);

    const bots = $<HTMLSelectElement>('ed-bots');
    for (let i = 0; i <= 15; i++) bots.append(new Option(`${i} bot${i === 1 ? "" : "s"}`, String(i), i === 3, i === 3));

    // Snap and View → Grid as they were left (UI Phase 5, viewPrefs.ts; never in the map).
    const snap = $<HTMLSelectElement>('ed-snap');
    snap.value = this.app.snapMode = readViewPrefs().snap;
    snap.addEventListener('change', () => {
      this.app.snapMode = snap.value as typeof this.app.snapMode;
      keepViewPref({ snap: this.app.snapMode });
    });
    this.app.viewMenu.applyKept();
    // The Structure theme's chip (painting Phase 3: the top bar's theme select went) and the Ground theme's (Phase 4):
    // each opens Map settings at its theme, so a theme is changed in one place, through the warning.
    $('ed-theme-chip').addEventListener('click', () => this.openSetting('ed-prop-theme'));
    $('ed-ground-chip').addEventListener('click', () => this.openGroundTheme());
  }

  /** Map settings, at its Ground theme row. */
  openGroundTheme(): void {
    this.openSetting('ed-prop-ground-theme');
  }

  private openSetting(id: string): void {
    this.app.mapSettings.open();
    const select = document.getElementById(id);
    select?.scrollIntoView({ block: 'center' });
    select?.focus();
  }

  updateTopBar(): void {
    const theme = coreThemes.get(this.app.doc.classicStructure.theme)?.displayName ?? this.app.doc.classicStructure.theme;
    const chip = $('ed-theme-chip-name');
    if (chip.textContent !== theme) chip.textContent = theme;
    $('ed-theme-chip').title = `Structure theme: ${theme}. The base look of every wall, floor and roof nothing paints: change it in Map settings`;
    // The Ground theme's chip: the base ground every unpainted cell shows (no terrain: none).
    const t = this.app.doc.terrain;
    const ground = t ? terrainGroundTheme(t) : null;
    const groundName = ground ? ground.displayName : 'No terrain';
    const gchip = $('ed-ground-chip-name');
    if (gchip.textContent !== groundName) gchip.textContent = groundName;
    $('ed-ground-chip').title = ground ? `Ground theme: ${groundThemeLabel(ground)}. The base ground every cell you haven't painted shows: change it in Map settings` : 'Ground theme: the map has no terrain (Environment → Terrain makes one)';
    // The palette and the paint lists follow the theme (painting Phase 3).
    this.app.palettes.syncTheme();
    // The title (it opens Map settings, where the name is edited).
    const name = this.app.doc.metadata.name;
    const title = $('ed-title-name');
    if (title.textContent !== name) title.textContent = name;
    $('ed-title').title = `${name} · Map settings: name, theme, players, modes, picture, card shot, time and weather`;
    $('ed-dirty').classList.toggle('on', this.app.saving.isDirty());
    $<HTMLButtonElement>('ed-undo').disabled = !this.app.history.canUndo;
    $<HTMLButtonElement>('ed-redo').disabled = !this.app.history.canRedo;
    $('ed-undo').title = this.app.history.undoLabel ? `Undo ${this.app.history.undoLabel} (Ctrl+Z)` : 'Undo (Ctrl+Z)';
    $('ed-redo').title = this.app.history.redoLabel ? `Redo ${this.app.history.redoLabel} (Ctrl+Y)` : 'Redo (Ctrl+Y)';
  }

  updateCounts(): void {
    this.app.statusBar.updateCounts();
  }
}
