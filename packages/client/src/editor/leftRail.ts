import type { EditorApp } from './editorApp.ts';
import { $ } from './editorDom.ts';

/**
 * The left rail (MapMaker UI spec Phase 1; the lead's note 1: it stays small): Map (Map settings, the same view the
 * top bar's title opens), the asset browser (the palette: opens it, or with it open goes to its search) and collapse
 * (folds the asset browser to the rail and back: \). The workspace tabs stay in the top bar. Kept in this browser.
 */
export class LeftRail {
  constructor(readonly app: EditorApp) {}

  get open(): boolean {
    return !$('editor').classList.contains('pal-collapsed');
  }

  mount(): void {
    $('ed-rail-map').addEventListener('click', () => this.app.mapSettings.toggle());
    $('ed-rail-assets').addEventListener('click', () => {
      if (!this.open) return this.setOpen(true);
      const search = $<HTMLInputElement>('ed-search');
      search.focus();
      search.select();
    });
    $('ed-pal-toggle').addEventListener('click', () => this.toggle());
    this.setOpen(this.app.dock.prefs.left !== 'rail', false);
  }

  /** \: fold the asset browser to the rail, or open it again. */
  toggle(): void {
    this.setOpen(!this.open);
  }

  setOpen(open: boolean, persist = true): void {
    $('editor').classList.toggle('pal-collapsed', !open);
    const btn = $('ed-pal-toggle');
    btn.textContent = open ? '‹' : '›';
    btn.title = `${open ? 'Fold the asset browser to the rail' : 'Open the asset browser'} (\\)`;
    btn.setAttribute('aria-label', open ? 'Fold the asset browser' : 'Open the asset browser');
    btn.setAttribute('aria-expanded', String(open));
    $('ed-rail-assets').setAttribute('aria-pressed', String(open));
    if (persist) this.app.dock.saveLeft(open ? 'open' : 'rail');
  }

  /** The Map entry lit while Map settings are open. */
  syncMap(open: boolean): void {
    $('ed-rail-map').setAttribute('aria-pressed', String(open));
  }
}
