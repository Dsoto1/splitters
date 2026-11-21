import {
  addPortalsCommand,
  closeOpenEndsCommand,
  connectedRun,
  connectedRunPieces,
  openEnds,
  setPieceFamilies,
  setRunFamilyCommand,
  tileFamilies,
  type EditCommand,
  type MapDocument,
} from '@tiletrigger/shared';

/**
 * The tile inspector's tunnel tools (shared editor/tunnelRun.ts; Tileset 04 steps 3 and 5), for buried pieces among
 * the selected tiles, or a selected set piece's buried parts (`piece`: its id):
 *  - **Family**: the material family the pieces are drawn in (map format v37; a set piece's tunnel parts: v44), and
 *    with "Whole run" ticked every buried piece joined to them, set pieces in the run included, in one undo step;
 *  - **Add portal**: a portal on each open end of the selected pieces (an end that leads to nothing built);
 *  - **Close open ends**: a Dead End on each of those ends instead.
 * Null when no selected tile has any of these. A click works on the map as it is then (`current`), not as the panel was
 * drawn from: MapMaker redraws the inspector on its next frame, and a click before it (a slow frame) acted on the map
 * before the last edit (a Family change, then Close open ends at once, closed the ends in the old family).
 */
export function tunnelPanel(doc: MapDocument, tileIds: readonly string[], run: (label: string, cmd: EditCommand | { error: string }) => unknown, piece?: string, current: () => MapDocument = () => doc): HTMLElement | null {
  const ids = new Set(tileIds);
  const tiles = doc.classicStructure.tiles.filter((t) => ids.has(t.id));
  const placement = piece ? doc.setPieces?.find((p) => p.id === piece) : undefined;
  // The families the selection comes in: a set piece's (those all its tunnel parts come in), else the first selected
  // kit piece's (one kit so far), and those in use.
  const withFamilies = placement ? [] : tiles.filter((t) => tileFamilies(t).length > 1);
  const families = placement ? setPieceFamilies(doc, placement) : withFamilies.length ? tileFamilies(withFamilies[0]!) : [];
  const ends = openEnds(doc, tileIds);
  if (families.length < 2 && !ends.length) return null;
  const box = document.createElement('div');
  box.className = 'ed-tile-options ed-tunnel';
  const head = document.createElement('h3');
  head.textContent = 'Tunnel';
  box.append(head);

  if (families.length > 1) {
    const inUse = new Set(placement ? families.filter((f) => f.on).map((f) => f.family) : withFamilies.map((t) => tileFamilies(t).find((f) => f.on)?.family));
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
    const runTiles = () => connectedRun(current(), tileIds);
    const runPieces = () => connectedRunPieces(current(), tileIds);
    select.addEventListener('change', () => {
      if (!select.value) return;
      const targets = whole.checked ? runTiles() : placement ? [] : [...tileIds];
      const pieces = whole.checked ? runPieces() : placement ? [placement.id] : [];
      const label = families.find((f) => f.family === select.value)?.label ?? select.value;
      run(`Tunnel family: ${label}${whole.checked ? ' (whole run)' : ''}`, setRunFamilyCommand(current(), targets, pieces, select.value));
    });
    const row = document.createElement('label');
    row.className = 'row';
    row.title = placement
      ? "The material family the set piece's tunnel parts are drawn in: the same shapes, passage and collision, other materials and trim"
      : 'The material family the piece is drawn in: the same shape, passage and collision, other materials and trim';
    const name = document.createElement('span');
    name.textContent = 'Family';
    row.append(name, select);
    const runRow = document.createElement('label');
    runRow.className = 'row';
    runRow.title = 'Change every buried piece joined to the selection (the run and its branches, set pieces in it too), not only the selection';
    const runName = document.createElement('span');
    const count = runTiles().length + runPieces().length;
    runName.textContent = `Whole run (${count} piece${count === 1 ? '' : 's'})`;
    runRow.append(runName, whole);
    box.append(row, runRow);
  }

  if (ends.length) {
    const add = document.createElement('button');
    add.id = 'ed-tunnel-portal';
    add.textContent = ends.length === 1 ? 'Add a portal at the open end' : `Add portals at the ${ends.length} open ends`;
    add.title = 'An end of a buried tunnel that leads to nothing built: a portal there opens the ground and brings the earth to its walls.';
    add.addEventListener('click', () => {
      const made = addPortalsCommand(current(), tileIds);
      run(ends.length === 1 ? 'Add a portal' : 'Add portals', 'error' in made ? made : made.command);
    });
    const close = document.createElement('button');
    close.id = 'ed-tunnel-close';
    close.textContent = ends.length === 1 ? 'Close the open end' : `Close the ${ends.length} open ends`;
    close.title = "A Dead End on each end that leads to nothing built, in the piece's family (a chamber's unused openings too). The vaulted tunnels have no Dead End: wall them up with Sides.";
    close.addEventListener('click', () => {
      const made = closeOpenEndsCommand(current(), tileIds);
      run(ends.length === 1 ? 'Close the open end' : 'Close open ends', 'error' in made ? made : made.command);
    });
    box.append(add, close);
  }
  return box;
}

/** "Whole run" stays as last set while MapMaker is open. */
let sessionRun = false;
