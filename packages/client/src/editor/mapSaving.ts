import {
  emptySelection,
  isRetiredMap,
  newId,
  TERRAIN_MATERIAL_LABELS,
  TERRAIN_MATERIALS,
  type MapDocument,
  type TerrainMaterial
} from '@tiletrigger/shared';
import { loadBuiltInMap, MAP_INDEX } from '../mapIndex.ts';
import { publishedMaps } from '../publishedMaps.ts';
import type { EditorApp } from './editorApp.ts';
import { $, button, escapeHtml } from './editorDom.ts';
import { NEW_MAP_SIZES, SHIPPED_IDS, STARTER_TERRAIN, starterMap } from './editorParts.ts';
import { libraryThumb } from './libraryThumbs.ts';
import {
  clearDraft,
  deleteFromLibrary,
  inLibrary,
  listDrafts,
  listLibrary,
  openFromLibrary,
  saveToLibrary,
  writeDraft
} from './storage.ts';
import { templatePicker } from './templatePicker.ts';

/** Saving and loading the map: drafts kept while unsaved, Save, Quit, New, Open… and replacing the document being edited (split out of editorApp.ts, MapMaker overhaul Phase 2 item 5). */
export class MapSaving {
  constructor(readonly app: EditorApp) {}

  savedRevision = 0;
  autosaveTimer?: number;

  // ---------------------------------------------------------------- persistence / test

  isDirty(): boolean {
    return this.app.history.revision !== this.savedRevision;
  }

  scheduleAutosave(): void {
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = window.setTimeout(() => this.flushDraft(), 400);
  }

  /** Write the draft now: unsaved changes are kept, a clean map has none. */
  flushDraft(): void {
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = undefined;
    if (this.isDirty()) writeDraft(this.app.doc);
    else clearDraft(this.app.doc.metadata.id);
  }

  /** Before switching maps: unsaved changes stay in Open… as a draft. */
  keepDraft(): void {
    if (!this.isDirty()) return;
    this.flushDraft();
    this.app.toast(`Unsaved changes to "${this.app.doc.metadata.name}" kept as a draft in Open…`);
  }

  save(): boolean {
    const stored = saveToLibrary(this.app.doc);
    if (!stored) {
      this.app.toast('Could not save to browser storage — use Export to keep a copy', true);
      return false;
    }
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = undefined;
    clearDraft(stored.metadata.id);
    this.savedRevision = this.app.history.revision;
    this.app.topBar.updateTopBar();
    this.app.toast(`Saved "${stored.metadata.name}"`);
    return true;
  }

  /**
   * Quit to the main menu. With unsaved changes it asks first: Save & quit
   * (naming a map that was never saved), Quit without saving, or Cancel.
   */
  quit(): void {
    if (!this.isDirty()) return this.app.host.goHome();
    const dialog = $<HTMLDialogElement>('ed-quit-dialog');
    const saved = inLibrary(this.app.doc.metadata.id);
    const name = $<HTMLInputElement>('ed-quit-name');
    $('ed-quit-msg').textContent = saved ? `"${this.app.doc.metadata.name}" has changes that are not saved.` : 'This map has never been saved. Name it to keep it in Open….';
    $('ed-quit-name-row').hidden = saved;
    name.value = this.app.doc.metadata.name;
    $('ed-quit-save').onclick = () => {
      const v = name.value.trim().slice(0, 80) || 'Untitled Map';
      if (!saved && v !== this.app.doc.metadata.name) this.app.run('Rename map', { kind: 'setMetadata', before: { name: this.app.doc.metadata.name }, after: { name: v } });
      if (!this.save()) return;
      dialog.close();
      this.app.host.goHome();
    };
    $('ed-quit-discard').onclick = () => {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = undefined;
      clearDraft(this.app.doc.metadata.id);
      dialog.close();
      this.app.host.goHome();
    };
    $('ed-quit-cancel').onclick = () => dialog.close();
    dialog.showModal();
    if (!saved) name.select();
  }

  replaceDocument(doc: MapDocument): void {
    this.app.plan.exit();
    this.app.history.reset(doc);
    this.savedRevision = this.app.history.revision;
    this.app.selection = emptySelection();
    this.app.setLevel(0, true);
    this.app.view.focus({ x: 0, y: 0, z: 0 });
    this.app.refresh(true);
  }

  /** New: pick a size of open ground (or the sky, with no terrain) and a ground material. */
  newMapDialog(): void {
    const dialog = $<HTMLDialogElement>('ed-new-dialog');
    const sizes = $('ed-new-sizes');
    let size = STARTER_TERRAIN;
    const pick = (v: number) => {
      size = v;
      for (const b of sizes.querySelectorAll('button')) b.classList.toggle('on', Number((b as HTMLElement).dataset.size) === v);
      $<HTMLSelectElement>('ed-new-ground').disabled = v === 0;
    };
    sizes.replaceChildren(
      ...NEW_MAP_SIZES.map(([v, label, note]) => {
        const b = document.createElement('button');
        b.dataset.size = String(v);
        b.setAttribute('role', 'radio');
        b.innerHTML = `<b>${label}</b><small>${note}</small>`;
        b.addEventListener('click', () => pick(v));
        b.addEventListener('dblclick', () => $('ed-new-create').click());
        return b;
      }),
    );
    const ground = $<HTMLSelectElement>('ed-new-ground');
    if (!ground.options.length) for (const m of TERRAIN_MATERIALS) ground.append(new Option(TERRAIN_MATERIAL_LABELS[m], m, m === 'grass', m === 'grass'));
    pick(STARTER_TERRAIN);
    // Start from a template (MapMaker overhaul Phase 3 item 5; templatePicker.ts), or open ground in a size.
    const template = templatePicker(dialog, sizes);
    $('ed-new-create').onclick = () => {
      dialog.close();
      this.keepDraft();
      const from = template.chosen();
      if (from)
        return void template.load(from).then((doc) => {
          if (!doc) return this.app.toast(`Couldn't load the ${from} template`, true);
          this.replaceDocument(doc);
          this.app.toast(`New map from the ${template.label(from)} template: make it your own`);
        });
      this.replaceDocument(starterMap(size || null, ground.value as TerrainMaterial));
    };
    $('ed-new-cancel').onclick = () => dialog.close();
    dialog.showModal();
    (sizes.querySelector('button.on') as HTMLButtonElement | null)?.focus();
  }

  openDialog(): void {
    const dialog = $<HTMLDialogElement>('ed-open-dialog');
    const list = $('ed-library');
    list.replaceChildren();
    // Each row shows the map's picture and plan (loaded and drawn as it scrolls into view).
    // Templates are built-in maps: each loads (its own chunk) when its row is seen or opened.
    const tpl = (id: string) => ({ load: () => loadBuiltInMap(id, { forEditing: true }), shipped: true });
    const remix = (id: string, name: (m: MapDocument) => string) => () =>
      void loadBuiltInMap(id, { forEditing: true }).then((m) => m && this.replaceDocument({ ...m, metadata: { ...m.metadata, id: newId('map'), name: name(m), parentId: m.metadata.id } }));
    // The owner opens our maps as they are (same ID), to fix them and Publish; everyone else gets a remix to make their own.
    const edit = (id: string) => () =>
      void loadBuiltInMap(id, { forEditing: true }).then((m) => {
        if (!m) return this.app.toast(`Couldn't open ${id}`, true);
        this.replaceDocument(m);
        this.app.toast(`Editing the official ${m.metadata.name}: Publish puts your changes live for everyone`);
      });
    const template = (id: string, name: (m: MapDocument) => string) => (this.app.owner ? edit(id) : remix(id, name));
    const kind = this.app.owner ? 'Official map' : 'Template';
    const cls = this.app.owner ? 'official' : '';
    const add = (label: string, sub: string, open: () => void, remove?: () => void, cls = '', preview?: { load: () => MapDocument | null | Promise<MapDocument | null>; shipped: boolean }) => {
      const li = document.createElement('li');
      if (cls) li.className = cls;
      if (preview) li.append(libraryThumb(preview.load, preview.shipped));
      const b = button('', () => {
        dialog.close();
        this.keepDraft();
        open();
      });
      b.innerHTML = `${escapeHtml(label)}<br><small>${escapeHtml(sub)}</small>`;
      li.append(b);
      if (remove) li.append(button('Delete', () => confirm(`Delete "${label}" from this browser?`) && (remove(), this.openDialog())));
      list.append(li);
    };
    // Unsaved drafts first (not the map being edited), then saved maps, then templates.
    for (const draft of listDrafts()) {
      if (draft.map.metadata.id === this.app.doc.metadata.id) continue;
      const when = new Date(draft.savedAt).toLocaleString();
      add(`Unsaved draft (${draft.map.metadata.name}, ${when})`, inLibrary(draft.map.metadata.id) ? 'Changes not saved to your saved copy' : 'Never saved', () => {
        this.replaceDocument(draft.map);
        // Still unsaved: the dirty dot stays on and Quit asks to save.
        this.savedRevision = -1;
        this.app.topBar.updateTopBar();
        this.app.toast(`Opened the unsaved draft of "${draft.map.metadata.name}"`);
      }, () => clearDraft(draft.map.metadata.id), 'draft', { load: () => draft.map, shipped: SHIPPED_IDS.has(draft.map.metadata.id) });
    }
    for (const entry of listLibrary()) {
      add(entry.name, `Saved ${new Date(entry.updatedAt).toLocaleString()}`, () => {
        const r = openFromLibrary(entry.id, true);
        if ('map' in r) {
          this.replaceDocument(r.map);
          this.app.toast(`Opened "${r.map.metadata.name}"`);
        } else this.app.toast(`Could not open: ${r.issues[0]?.message}`, true);
      }, () => deleteFromLibrary(entry.id), '', { load: () => ((r) => ('map' in r ? r.map : null))(openFromLibrary(entry.id, true)), shipped: SHIPPED_IDS.has(entry.id) });
    }
    add('Sandgate', `${kind} · desert town for Team Deathmatch, with open courtyards`, template('sandgate', () => 'Sandgate Remix'), undefined, cls, tpl('sandgate'));
    add('Citadel', `${kind} · castle keep with a two-storey atrium, roof terraces, props and breakables`, template('citadel', () => 'Citadel Remix'), undefined, cls, tpl('citadel'));
    add('Rockfall Canyon', `${kind} · sculpted terrain canyon with two bases, boulders and a ridge ledge`, template('canyon', () => 'Canyon Remix'), undefined, cls, tpl('canyon'));
    // Every other shipped map (the homage maps and later additions) is a template too (listed from the index: the maps that load).
    const known = new Set(['phase0_arena', 'm3_vault', 'm4_outpost', 'sandgate', 'citadel', 'canyon']);
    for (const { key: id, metadata } of MAP_INDEX) {
      if (known.has(id) || isRetiredMap(id)) continue;
      add(metadata.name, `${kind} · ${metadata.description.split(/(?<=\.)\s/)[0] ?? ''}`, template(id, (m) => `${m.metadata.name} Remix`), undefined, cls, tpl(id));
    }
    // Official maps added by publishing (not built into the site) join the list once the hub answers.
    void publishedMaps().then((p) => {
      for (const e of p.values()) if (e.added && dialog.open) add(e.name, `${kind} · ${e.description.split(/(?<=\.)\s/)[0] ?? ''}`, template(e.id, (m) => `${m.metadata.name} Remix`), undefined, cls, tpl(e.id));
    });
    dialog.showModal();
  }
}
