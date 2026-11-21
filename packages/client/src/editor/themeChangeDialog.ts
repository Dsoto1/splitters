import { coreMaterials, coreThemes, groundImpactChanges, groundThemeDef, groundThemeImpact, impactChanges, keepCurrentLookCommand, matchingGroundTheme, setGroundThemeCommand, setThemeCommand, terrainGroundTheme, themeChangeImpact, type EditCommand } from '@tiletrigger/shared';
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
 * With a terrain whose Ground theme isn't the new theme's match, a tick box (off; the owner's 4a) changes the Ground
 * theme to that match in the same step: with Keep current look the ground keeps its look too.
 * A dialog, not a bright moment: nothing flashes.
 */
export function changeStructureTheme(app: EditorApp, to: string, done: () => void = () => {}): void {
  const doc = app.doc;
  const from = doc.classicStructure.theme;
  if (to === from || !coreThemes.get(to)) return done();
  const name = (id: string) => coreThemes.get(id)?.displayName ?? id;
  const boxes = app.drawnBoxes();
  const impact = themeChangeImpact(doc, app.setPieceLib, to, boxes);
  const n = impactChanges(impact);
  // The Ground theme too (Phase 4): offered when the new theme's match isn't the terrain's Ground theme.
  const match = matchingGroundTheme(to);
  const ground = doc.terrain && terrainGroundTheme(doc.terrain).id !== match ? groundThemeImpact(doc, match) : null;
  if (n === 0 && !ground) {
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
    <div class="ed-dialog-actions"><button id="ed-theme-change" class="primary">${n ? `Change ${plural(n, 'thing')}` : 'Change'}</button><button id="ed-theme-keep" class="keep">Keep current look</button><button id="ed-theme-cancel">Cancel</button></div>
    ${ground ? `<label class="check ed-theme-ground" id="ed-theme-ground-row"><input type="checkbox" id="ed-theme-ground"> Also change the Ground theme to <b>${escape(groundThemeDef(match).displayName)}</b> (${escape(name(to))}'s match): <b>${fmt(ground.followsM2)} m²</b> of ground follows it.</label>` : ''}
    <p class="ed-note" id="ed-theme-keep-note">${escape(keepNote)}</p>`;
  $('editor').append(dialog);
  let settled = false;
  const finish = (choice: 'change' | 'keep' | 'cancel') => {
    if (settled) return;
    settled = true;
    dialog.close();
    dialog.remove();
    const withGround = !!ground && (dialog.querySelector('#ed-theme-ground') as HTMLInputElement | null)?.checked === true;
    const both = (cmd: EditCommand, keepGround: boolean): EditCommand => {
      const g = withGround ? setGroundThemeCommand(app.doc, match, keepGround) : null;
      return g ? { kind: 'batch', commands: [cmd, g] } : cmd;
    };
    if (choice === 'change') app.run(withGround ? 'Change theme and Ground theme' : 'Change theme', both(setThemeCommand(app.doc, to), false));
    else if (choice === 'keep') {
      app.run('Change theme, keep the look', both(keep.command, true));
      app.toast(`Structure theme: ${name(to)}${withGround ? ` and Ground theme: ${groundThemeDef(match).displayName}` : ''} · what is built keeps its look (as your paint)`);
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


/**
 * The warning before a Ground theme change (painting Phase 4): Map settings' Ground theme comes here. It says how much
 * ground follows the theme and will change (the cells nobody painted, in m²), what you painted and stays, and whether
 * the ground past the border follows too; then Change, Keep current look (the base cells keep today's ground, as your
 * paint; the theme then leads Ground paint's list and is what new ground starts as) or Cancel. Each is one undo step.
 * A change that would look no different (the same base ground, or nothing unpainted) skips the dialog.
 */
export function changeGroundTheme(app: EditorApp, to: string, done: () => void = () => {}): void {
  const doc = app.doc;
  const t = doc.terrain;
  if (!t || terrainGroundTheme(t).id === to) return done();
  const impact = groundThemeImpact(doc, to)!;
  const theme = groundThemeDef(to);
  const mat = (id: string) => coreMaterials.get(id)?.displayName ?? id;
  if (!groundImpactChanges(impact)) {
    app.run('Change Ground theme', setGroundThemeCommand(doc, to)!);
    app.toast(`Ground theme: ${theme.displayName} (${impact.followsM2 ? `its base is ${mat(impact.baseTo)} too` : 'every cell is painted'}, so the ground looks the same)`);
    return done();
  }
  const keep = setGroundThemeCommand(doc, to, true);
  document.getElementById('ed-ground-dialog')?.remove();
  const dialog = document.createElement('dialog');
  dialog.id = 'ed-ground-dialog';
  dialog.className = 'ed-theme-warn';
  const fmt = (v: number) => Math.round(v).toLocaleString('en-GB');
  const lines = [
    { cls: 'tw-change', id: 'follows', html: `<b>${fmt(impact.followsM2)} m² of ground</b> follows the Ground theme and will change from ${escape(mat(impact.baseFrom))} to ${escape(mat(impact.baseTo))}.` },
    { cls: 'tw-stay', id: 'painted', html: `<b>${fmt(impact.paintedM2)} m² you painted</b> stay${impact.paintedM2 ? '' : 's'} as ${impact.paintedM2 ? 'they are' : 'it is'}.` },
    ...(impact.borderFollows ? [{ cls: 'tw-info', id: 'border', html: 'The ground past the border follows it too.' }] : []),
  ];
  const keepNote = keep
    ? "Keep current look: the Ground theme changes for Ground paint's list and new ground; the ground now keeps today's look (it becomes your paint). Either way it is one undo step."
    : 'Keep current look needs room for one more ground, and this terrain already uses 16.';
  dialog.innerHTML = `
    <h2 id="ed-ground-title">Change the Ground theme to ${escape(theme.displayName)}?</h2>
    <p class="ed-note" id="ed-ground-was">Now: ${escape(terrainGroundTheme(t).displayName)} (base ${escape(mat(impact.baseFrom))}). ${escape(theme.displayName)}'s base is ${escape(mat(impact.baseTo))}.</p>
    <ul class="ed-theme-counts">${lines.map((l) => `<li class="${l.cls}" data-count="${l.id}">${l.html}</li>`).join('')}</ul>
    <div class="ed-dialog-actions"><button id="ed-ground-change" class="primary">Change the ground</button><button id="ed-ground-keep" class="keep"${keep ? '' : ' disabled'}>Keep current look</button><button id="ed-ground-cancel">Cancel</button></div>
    <p class="ed-note" id="ed-ground-keep-note">${escape(keepNote)}</p>`;
  $('editor').append(dialog);
  let settled = false;
  const finish = (choice: 'change' | 'keep' | 'cancel') => {
    if (settled) return;
    settled = true;
    dialog.close();
    dialog.remove();
    if (choice === 'change') app.run('Change Ground theme', setGroundThemeCommand(app.doc, to)!);
    else if (choice === 'keep' && keep) {
      app.run('Change Ground theme, keep the look', keep);
      app.toast(`Ground theme: ${theme.displayName} · the ground keeps its look (as your paint)`);
    }
    done();
  };
  dialog.querySelector('#ed-ground-change')!.addEventListener('click', () => finish('change'));
  dialog.querySelector('#ed-ground-keep')!.addEventListener('click', () => finish('keep'));
  dialog.querySelector('#ed-ground-cancel')!.addEventListener('click', () => finish('cancel'));
  dialog.addEventListener('close', () => finish('cancel'));
  dialog.showModal();
  (dialog.querySelector('#ed-ground-cancel') as HTMLButtonElement).focus();
}
