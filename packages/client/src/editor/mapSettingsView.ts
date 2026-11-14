import { autoPlayerCaps, mapPlayerCaps, playableModes, setupFamily, type MapDocument } from '@tiletrigger/shared';
import type { EditorApp } from './editorApp.ts';
import { $ } from './editorDom.ts';
import { rebuildKeepingEdit } from './inspectorKeep.ts';

/** How long after the last edit that left Map settings standing they are built again (after the problems list has caught up: mapChecks.ts). */
const CATCH_UP_MS = 500;

/**
 * Map settings, a view in the right dock (MapMaker UI spec §3; the owner's answer 4: in the dock, not a modal, so the
 * 3D view stays live for the time-of-day preview and for framing the picture and the card shot). The top bar's title
 * and the left rail's Map entry open the same view; the inspector's empty line links to it. The fields are Map
 * properties' (mapProperties.ts), unchanged, every one an undoable command. They are built only while the view is
 * open: building them works out the map's problems, measures the file and draws the plan (25 to 50 ms on a big map).
 * Selecting something closes the view, so the dock shows what was selected.
 */
export class MapSettingsView {
  isOpen = false;
  /** What the view was last built from (a rebuild is skipped when nothing it shows has changed). */
  private built: { doc: MapDocument; placed: string } | null = null;
  private later?: number;

  constructor(readonly app: EditorApp) {}

  mount(): void {
    $('ed-title').addEventListener('click', () => this.toggle());
    $('ed-ms-close').addEventListener('click', () => this.close(true));
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    if (!this.isOpen) {
      this.isOpen = true;
      this.built = null;
      this.rebuild();
    }
    this.sync();
    this.app.dock.ensureExpanded();
    $('ed-right').scrollTop = 0;
  }

  close(focusBack = false): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.built = null;
    clearTimeout(this.later);
    this.later = undefined;
    $('ed-ms-body').replaceChildren();
    this.sync();
    if (focusBack) $('ed-title').focus();
  }

  private sync(): void {
    const title = $('ed-title');
    title.setAttribute('aria-expanded', String(this.isOpen));
    title.classList.toggle('on', this.isOpen);
    this.app.rail.syncMap(this.isOpen);
    this.app.dock.syncViews();
  }

  /** After an edit (EditorApp.refresh): the view brought up to date while it is open. */
  refresh(): void {
    if (!this.isOpen || this.stands()) return;
    this.rebuild();
  }

  private rebuild(): void {
    clearTimeout(this.later);
    this.later = undefined;
    const body = $('ed-ms-body');
    rebuildKeepingEdit(body, () => {
      body.replaceChildren();
      this.app.mapProps.renderMapProperties(body);
    });
    this.built = { doc: this.app.doc, placed: this.placedKey(this.app.doc) };
  }

  /**
   * The view as shown is still right, so it is not built again. It is built again at once when any of the map's
   * settings changed (every part of the document but the things placed on it) or what it works out at once from the
   * things placed (the modes the map plays, the player caps, Settle all props). An edit that only moves, adds or
   * removes things leaves it standing, and the plan and the quality gates (which follow those) are brought up to date
   * a moment after the last such edit, as the problems list is. (The inspector's rule before Phase 1.)
   */
  private stands(): boolean {
    const b = this.built;
    if (!b) return false;
    const doc = this.app.doc;
    if (doc === b.doc) return true;
    for (const k of new Set([...Object.keys(doc), ...Object.keys(b.doc)]) as Set<keyof MapDocument>) if (k !== 'entities' && doc[k] !== b.doc[k]) return false;
    if (this.placedKey(doc) !== b.placed) return false;
    clearTimeout(this.later);
    this.later = window.setTimeout(() => this.catchUp(), CATCH_UP_MS);
    return true;
  }

  private catchUp(): void {
    this.later = undefined;
    if (!this.isOpen || !this.built || this.built.doc === this.app.doc) return;
    if (this.app.input.drag) {
      this.later = window.setTimeout(() => this.catchUp(), CATCH_UP_MS);
      return;
    }
    this.rebuild();
  }

  private placedKey(doc: MapDocument): string {
    const modes = playableModes(doc);
    const caps = modes.filter((m) => setupFamily(m) === 'ffa' || setupFamily(m) === 'teams').map((m) => [mapPlayerCaps(doc, m), autoPlayerCaps(doc, m)]);
    return JSON.stringify([modes, caps, doc.entities.some((e) => e.kind === 'prop')]);
  }
}
