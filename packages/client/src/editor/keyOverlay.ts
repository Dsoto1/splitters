import { editorKeyGroups } from '@tiletrigger/shared';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * MapMaker's `?` overlay (docs/MAPMAKER_OVERHAUL_PLAN.md, Phase 1 item 5): every key MapMaker binds, grouped, drawn
 * from the same table the keydown handler reads (keymap.ts), so it can't go stale. `?` or the tool bar's Keys button
 * opens it; Esc, `?` or a click outside closes it. A modal dialog: MapMaker's own keys are off while it's open.
 */
export class KeyOverlay {
  readonly dialog: HTMLDialogElement;
  /** The header's Take the tour button (tour.ts): set by MapMaker. */
  onTour: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'ed-keys';
    this.dialog.className = 'ed-keys';
    this.dialog.setAttribute('aria-labelledby', 'ed-keys-title');
    this.dialog.addEventListener('keydown', (e) => {
      if (e.key === '?' || (e.code === 'Slash' && e.shiftKey)) {
        e.preventDefault();
        // Not on to the editor's handler, which would open it again.
        e.stopPropagation();
        this.close();
      }
    });
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog || (e.target as HTMLElement).closest('[data-close]')) this.close();
      if ((e.target as HTMLElement).closest('[data-tour]')) {
        this.close();
        this.onTour?.();
      }
    });
    parent.append(this.dialog);
  }

  get isOpen(): boolean {
    return this.dialog.open;
  }

  open(): void {
    if (this.dialog.open) return;
    const groups = editorKeyGroups()
      .map(
        (g) =>
          `<section class="ed-keys-group"><h3>${esc(g.group)}</h3><dl>${g.rows
            .map((r) => `<div class="ed-keys-row"><dt>${r.keys.split(' or ').map((k) => `<kbd>${esc(k)}</kbd>`).join(' or ')}</dt><dd>${esc(r.what)}</dd></div>`)
            .join('')}</dl></section>`,
      )
      .join('');
    this.dialog.innerHTML = `<div class="ed-keys-inner"><header><h2 id="ed-keys-title">Keys</h2><span class="ed-keys-hint">Esc or ? closes</span><button type="button" data-tour id="ed-keys-tour" title="A short walk through making a map: a room, a spawn, a pickup, then test it">Take the tour</button><button type="button" data-close aria-label="Close">✕</button></header><div class="ed-keys-grid">${groups}</div></div>`;
    this.dialog.showModal();
  }

  close(): void {
    if (this.dialog.open) this.dialog.close();
  }
}
