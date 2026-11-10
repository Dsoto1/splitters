import { TILE_OPTION_HELP, setTileOptionCommand, tileOptionsOf, type EditCommand, type MapDocument, type TileOptionId } from '@tiletrigger/shared';

/**
 * The tile inspector's tile options (shared editor/tileVariants.ts): a checkbox per option the selected tiles share
 * (the Vaulted Tunnel's Side walls). For several tiles it shows ticked when all have it on, half when some do; a click
 * sets it on or off for every one of them in one undo step. Null when no selected tile has an option.
 */
export function tileOptionPanel(doc: MapDocument, tileIds: readonly string[], run: (label: string, cmd: EditCommand | { error: string }) => unknown): HTMLElement | null {
  const ids = new Set(tileIds);
  const tiles = doc.classicStructure.tiles.filter((t) => ids.has(t.id));
  const states = new Map<TileOptionId, { label: string; on: number; of: number }>();
  for (const t of tiles) {
    for (const s of tileOptionsOf(t.tile)) {
      const e = states.get(s.option) ?? { label: s.label, on: 0, of: 0 };
      e.of++;
      if (s.on) e.on++;
      states.set(s.option, e);
    }
  }
  if (!states.size) return null;
  const box = document.createElement('div');
  box.className = 'ed-tile-options';
  const head = document.createElement('h3');
  head.textContent = 'Options';
  box.append(head);
  for (const [option, s] of states) {
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.id = `ed-tile-opt-${option}`;
    check.checked = s.on === s.of;
    check.indeterminate = s.on > 0 && s.on < s.of;
    check.addEventListener('change', () => {
      const on = check.checked;
      run(`${on ? 'Add' : 'Remove'} ${s.label.toLowerCase()}`, setTileOptionCommand(doc, tileIds, option, on));
    });
    const label = document.createElement('label');
    label.className = 'row';
    label.title = TILE_OPTION_HELP[option];
    const name = document.createElement('span');
    name.textContent = s.of > 1 ? `${s.label} (${s.on} of ${s.of})` : s.label;
    label.append(name, check);
    box.append(label);
  }
  return box;
}
