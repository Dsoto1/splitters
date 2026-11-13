import { addPortalsCommand, connectedRun, openEnds, setTileFamilyCommand, tileFamilies, type EditCommand, type MapDocument } from '@tiletrigger/shared';

/**
 * The tile inspector's tunnel tools (shared editor/tunnelRun.ts; Tileset 04 step 3), for buried pieces among the
 * selected tiles:
 *  - **Family**: the material family the pieces are drawn in (map format v37), and with "Whole run" ticked every
 *    buried piece joined to them, in one undo step;
 *  - **Add portal**: a portal on each open end of the selected pieces (an end that leads to nothing built).
 * Null when no selected tile has either.
 */
export function tunnelPanel(doc: MapDocument, tileIds: readonly string[], run: (label: string, cmd: EditCommand | { error: string }) => unknown): HTMLElement | null {
  const ids = new Set(tileIds);
  const tiles = doc.classicStructure.tiles.filter((t) => ids.has(t.id));
  // The families every selected kit piece comes in (the first piece's list: one kit so far), and those in use.
  const withFamilies = tiles.filter((t) => tileFamilies(t).length > 1);
  const ends = openEnds(doc, tileIds);
  if (!withFamilies.length && !ends.length) return null;
  const box = document.createElement('div');
  box.className = 'ed-tile-options ed-tunnel';
  const head = document.createElement('h3');
  head.textContent = 'Tunnel';
  box.append(head);

  if (withFamilies.length) {
    const families = tileFamilies(withFamilies[0]!);
    const inUse = new Set(withFamilies.map((t) => tileFamilies(t).find((f) => f.on)?.family));
    const select = document.createElement('select');
    select.id = 'ed-tunnel-family';
    if (inUse.size > 1) select.append(new Option('(mixed)', ''));
    for (const f of families) select.append(new Option(f.label, f.family));
    select.value = inUse.size === 1 ? [...inUse][0]! : '';
    const whole = document.createElement('input');
    whole.type = 'checkbox';
    whole.id = 'ed-tunnel-run';
    whole.checked = sessionRun;
    whole.addEventListener('change', () => (sessionRun = whole.checked));
    select.addEventListener('change', () => {
      if (!select.value) return;
      const targets = whole.checked ? connectedRun(doc, tileIds) : [...tileIds];
      const label = families.find((f) => f.family === select.value)?.label ?? select.value;
      run(`Tunnel family: ${label}${whole.checked ? ' (whole run)' : ''}`, setTileFamilyCommand(doc, targets, select.value));
    });
    const row = document.createElement('label');
    row.className = 'row';
    row.title = 'The material family the piece is drawn in: the same shape, passage and collision, other materials and trim';
    const name = document.createElement('span');
    name.textContent = 'Family';
    row.append(name, select);
    const runRow = document.createElement('label');
    runRow.className = 'row';
    runRow.title = 'Change every buried piece joined to the selection (the run and its branches), not only the selected pieces';
    const runName = document.createElement('span');
    runName.textContent = `Whole run (${connectedRun(doc, tileIds).length} pieces)`;
    runRow.append(runName, whole);
    box.append(row, runRow);
  }

  if (ends.length) {
    const add = document.createElement('button');
    add.id = 'ed-tunnel-portal';
    add.textContent = ends.length === 1 ? 'Add a portal at the open end' : `Add portals at the ${ends.length} open ends`;
    add.title = 'An end of a buried tunnel that leads to nothing built: a portal there opens the ground and brings the earth to its walls. (For a dead end, set that side to Wall instead.)';
    add.addEventListener('click', () => {
      const made = addPortalsCommand(doc, tileIds);
      run(ends.length === 1 ? 'Add a portal' : 'Add portals', 'error' in made ? made : made.command);
    });
    box.append(add);
  }
  return box;
}

/** "Whole run" stays as last set while MapMaker is open. */
let sessionRun = false;
