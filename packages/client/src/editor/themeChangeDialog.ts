import { coreThemes, impactChanges, keepCurrentLookCommand, setThemeCommand, themeChangeImpact } from '@tiletrigger/shared';
import type { EditorApp } from './editorApp.ts';
import { $, escapeHtml as escape } from './editorDom.ts';

/**
 * The warning before any Structure theme change (docs/MAPMAKER_PAINTING_PLAN.md, Phase 2; the owner's answer 4a):
 * Map settings' Structure theme, the top bar's theme and the palette's "Use theme" all come here. It counts what
 * follows the theme and will change and what stays (shared editor/paintLayers.ts), then offers:
 * - **Change N things**: the theme changes, and with it everything that follows it;
 * - **Keep current look**: the theme changes for new pieces and the palette, and what is built keeps today's look,
 *   pinned as your paint;
 * - **Cancel**: nothing changes (the select that asked goes back).
 * Change and Keep current look are one undo step each. A change that would change nothing built skips the dialog.
 * (The Ground theme's tick box comes with the Ground theme, Phase 4.) A dialog, not a bright moment: nothing flashes.
 */
export function changeStructureTheme(app: EditorApp, to: string, done: () => void = () => {}): void {
  const doc = app.doc;
  const from = doc.classicStructure.theme;
  if (to === from || !coreThemes.get(to)) return done();
  const name = (id: string) => coreThemes.get(id)?.displayName ?? id;
  const boxes = app.drawnBoxes();
  const impact = themeChangeImpact(doc, app.setPieceLib, to, boxes);
  const n = impactChanges(impact);
  if (n === 0) {
    app.run('Change theme', setThemeCommand(doc, to));
    app.toast(`Structure theme: ${name(to)} (nothing built follows it, so nothing else changed)`);
    return done();
  }
  const keep = keepCurrentLookCommand(doc, app.setPieceLib, to, boxes);
  document.getElementById('ed-theme-dialog')?.remove();
  const dialog = document.createElement('dialog');
  dialog.id = 'ed-theme-dialog';
  dialog.className = 'ed-theme-warn';
  const fmt = (v: number) => v.toLocaleString('en-GB');
  const plural = (v: number, one: string, many = `${one}s`) => `${fmt(v)} ${v === 1 ? one : many}`;
  const lines: { cls: string; id: string; html: string }[] = [];
  if (impact.surfacesChange) lines.push({ cls: 'tw-change', id: 'surfaces', html: `<b>${plural(impact.surfacesChange, 'surface')}</b> follow${impact.surfacesChange === 1 ? 's' : ''} the theme and will change.` });
  if (impact.piecesChange) lines.push({ cls: 'tw-change', id: 'pieces', html: `<b>${plural(impact.piecesChange, 'set piece')}</b> use${impact.piecesChange === 1 ? 's' : ''} the theme's look and will change.` });
  lines.push({ cls: 'tw-stay', id: 'painted', html: `<b>${plural(impact.surfacesPainted, 'surface')} you painted</b> stay${impact.surfacesPainted === 1 ? 's' : ''} as ${impact.surfacesPainted === 1 ? 'it is' : 'they are'}.` });
  if (impact.piecesOwnLook) lines.push({ cls: 'tw-stay', id: 'ownlook', html: `<b>${plural(impact.piecesOwnLook, 'set piece')}</b> with a look of ${impact.piecesOwnLook === 1 ? 'its' : 'their'} own stay${impact.piecesOwnLook === 1 ? 's' : ''}.` });
  if (impact.skyFollows) lines.push({ cls: 'tw-info', id: 'sky', html: 'The sky and backdrop follow the theme too.' });
  const approx = keep.approximate.length;
  const keepNote = `Keep current look: the theme changes for new pieces and the palette; what is built now keeps today's look (it becomes your paint)${approx ? `, but ${plural(approx, 'block')} that showed two of the theme's materials (top and sides) keep${approx === 1 ? 's' : ''} the one ${approx === 1 ? 'it shows' : 'they show'} most: a block is one material` : ''}. Either way it is one undo step.`;
  dialog.innerHTML = `
    <h2 id="ed-theme-title">Change the Structure theme to ${escape(name(to))}?</h2>
    <p class="ed-note" id="ed-theme-was">Now: ${escape(name(from))}.</p>
    <ul class="ed-theme-counts">${lines.map((l) => `<li class="${l.cls}" data-count="${l.id}">${l.html}</li>`).join('')}</ul>
    <div class="ed-dialog-actions"><button id="ed-theme-change" class="primary">Change ${plural(n, 'thing')}</button><button id="ed-theme-keep" class="keep">Keep current look</button><button id="ed-theme-cancel">Cancel</button></div>
    <p class="ed-note" id="ed-theme-keep-note">${escape(keepNote)}</p>`;
  $('editor').append(dialog);
  let settled = false;
  const finish = (choice: 'change' | 'keep' | 'cancel') => {
    if (settled) return;
    settled = true;
    dialog.close();
    dialog.remove();
    if (choice === 'change') app.run('Change theme', setThemeCommand(app.doc, to));
    else if (choice === 'keep') {
      app.run('Change theme, keep the look', keep.command);
      app.toast(`Structure theme: ${name(to)} · what is built keeps its look (as your paint)`);
    }
    done();
  };
  dialog.querySelector('#ed-theme-change')!.addEventListener('click', () => finish('change'));
  dialog.querySelector('#ed-theme-keep')!.addEventListener('click', () => finish('keep'));
  dialog.querySelector('#ed-theme-cancel')!.addEventListener('click', () => finish('cancel'));
  // Esc (and anything else that closes it) is Cancel.
  dialog.addEventListener('close', () => finish('cancel'));
  dialog.showModal();
  (dialog.querySelector('#ed-theme-cancel') as HTMLButtonElement).focus();
}

