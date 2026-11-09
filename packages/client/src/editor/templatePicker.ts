import { MAP_TEMPLATES, startFromTemplate, type MapDocument } from '@tiletrigger/shared';
import { loadMapContent } from '../mapContentLoader.ts';

/**
 * New map → Start from (MapMaker overhaul Phase 3 item 5): open ground in a size (the dialog's sizes), or a starter
 * layout. The layouts are map files of their own, `maps/templates/<id>.json`, built in MapMaker; each is its own chunk,
 * loaded when picked. They sit apart from maps/*.json, so no map list, playlist or menu ever shows them.
 */
const FILES = import.meta.glob<unknown>('../../../../maps/templates/*.json', { import: 'default' });

/** A template's map, loaded and checked, as a new map of your own (null if it doesn't load). */
export async function loadTemplate(id: string): Promise<MapDocument | null> {
  const file = FILES[`../../../../maps/templates/${id}.json`];
  if (!file) return null;
  const [json, { loadMap }] = await Promise.all([file(), loadMapContent()]);
  const r = loadMap(json, undefined, { forEditing: true });
  return r.ok ? startFromTemplate(r.map, 'Untitled Map') : null;
}

/** The Start from row, put in the New map dialog above its sizes: picking a template sets the sizes aside. */
export function templatePicker(dialog: HTMLElement, sizes: HTMLElement): { chosen(): string | null; load(id: string): Promise<MapDocument | null>; label(id: string): string } {
  let chosen: string | null = null;
  dialog.querySelector('#ed-new-templates')?.remove();
  dialog.querySelector('#ed-new-templates-head')?.remove();
  const row = document.createElement('div');
  row.id = 'ed-new-templates';
  row.className = 'ed-new-sizes ed-new-templates';
  row.setAttribute('role', 'radiogroup');
  row.setAttribute('aria-label', 'Start from');
  const ground = dialog.querySelector<HTMLSelectElement>('#ed-new-ground')?.closest('label');
  const pick = (id: string | null) => {
    chosen = id;
    for (const b of row.querySelectorAll<HTMLButtonElement>('button')) b.classList.toggle('on', (b.dataset.template ?? null) === id && id !== null);
    sizes.classList.toggle('off', id !== null);
    ground?.classList.toggle('off', id !== null);
  };
  const head = document.createElement('p');
  head.className = 'ed-note';
  head.id = 'ed-new-templates-head';
  head.textContent = 'Or start from a layout (it becomes your own map):';
  for (const t of MAP_TEMPLATES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.template = t.id;
    b.setAttribute('role', 'radio');
    b.innerHTML = '<b></b><small></small>';
    b.querySelector('b')!.textContent = t.label;
    b.querySelector('small')!.textContent = t.note;
    b.title = t.note;
    b.addEventListener('click', () => pick(chosen === t.id ? null : t.id));
    b.addEventListener('dblclick', () => (pick(t.id), dialog.querySelector<HTMLButtonElement>('#ed-new-create')?.click()));
    row.append(b);
  }
  // A size picked again means open ground (one listener, whichever dialog opening set `pick`).
  const holder = sizes as HTMLElement & { templatePick?: (id: null) => void };
  if (!holder.templatePick) sizes.addEventListener('click', () => holder.templatePick?.(null), { capture: true });
  holder.templatePick = pick;
  sizes.after(head, row);
  pick(null);
  return { chosen: () => chosen, load: loadTemplate, label: (id) => MAP_TEMPLATES.find((t) => t.id === id)?.label ?? id };
}
