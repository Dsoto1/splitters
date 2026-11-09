import { GRID_SPACINGS, MAX_TERRAIN_VERTS, RESOURCE_BUDGETS, changeGridCommand, planGrid, resampleTerrain, serializeMap, utf8Length, type EditCommand, type GridInterpolation, type MapDocument, type TerrainData } from '@tiletrigger/shared';

/**
 * Terrain → Change grid… (map format v32; the command: shared editor/changeGrid.ts): the terrain resampled to vertices
 * a new distance apart, finer or coarser, heights, paint and plants together, one undo step. Before it runs the dialog
 * shows the new grid's vertex count against the 321-a-side cap, the triangles to collide, navigate and draw, and the
 * map file's size against its 2 MB budget.
 */
export interface ChangeGridHost {
  doc(): MapDocument;
  /** The ground as shown (kept under floors, paths laid in) for a terrain: things on it move with it. */
  shownFor(t: TerrainData): TerrainData;
  apply(label: string, command: EditCommand, moved: number): void;
  root: HTMLElement;
}

const fmt = (n: number) => n.toLocaleString('en-GB');
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.round(n / 1024)} KB`);

export function openChangeGridDialog(host: ChangeGridHost): void {
  document.getElementById('ed-grid-dialog')?.remove();
  const doc = host.doc();
  const t = doc.terrain;
  if (!t) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'ed-grid-dialog';
  dialog.className = 'ed-grid';
  dialog.innerHTML = `
    <h2>Change grid</h2>
    <p class="ed-note">Resample the terrain to vertices a new distance apart: finer for sharper cliffs and smaller shapes, coarser for a lighter map. Heights, ground paint and plants come across; heights where old and new vertices meet stay exactly as they are. One undo step.</p>
    <label class="ed-dialog-field"><span>Vertices apart</span><select id="ed-grid-spacing"></select></label>
    <label class="ed-dialog-field" title="Smooth: rolling ground gets a smooth curve between the old vertices; where it is steep (cliffs, banks over 30-45°) the old surface is kept, so cliffs stay sharp. Exact: the old surface everywhere (half the spacing then draws exactly as before)"><span>Between vertices</span><select id="ed-grid-mode"><option value="smooth" selected>Smooth (cliffs kept sharp)</option><option value="exact">Exact (the surface as it is)</option></select></label>
    <table class="ed-grid-plan"><tbody>
      <tr><th></th><th>Now</th><th>After</th></tr>
      <tr><td>Grid</td><td id="ed-grid-now"></td><td id="ed-grid-after"></td></tr>
      <tr><td>Vertices</td><td id="ed-grid-verts-now"></td><td id="ed-grid-verts"></td></tr>
      <tr><td>Triangles</td><td id="ed-grid-tris-now"></td><td id="ed-grid-tris"></td></tr>
      <tr><td>Map file</td><td id="ed-grid-size-now"></td><td id="ed-grid-size"></td></tr>
    </tbody></table>
    <p id="ed-grid-why" class="ed-note"></p>
    <div class="ed-dialog-actions"><button id="ed-grid-go" class="primary">Change grid</button><button id="ed-grid-cancel">Cancel</button></div>`;
  host.root.append(dialog);
  const $ = <T extends HTMLElement>(id: string) => dialog.querySelector<T>(`#${id}`)!;
  const spacing = $<HTMLSelectElement>('ed-grid-spacing');
  const mode = $<HTMLSelectElement>('ed-grid-mode');
  const why = $('ed-grid-why');
  const go = $<HTMLButtonElement>('ed-grid-go');
  const choices = [...new Set([...GRID_SPACINGS, t.spacing])].sort((a, b) => a - b);
  for (const s of choices) {
    const p = planGrid(t, s);
    const label = s === t.spacing ? `${s} m (now)` : `${s} m: ${p.cols} × ${p.rows}${p.error ? ' (too fine)' : ''}`;
    spacing.append(new Option(label, String(s), false, false));
  }
  // The first finer choice that fits, else the next coarser.
  const finer = choices.filter((s) => s < t.spacing && !planGrid(t, s).error);
  spacing.value = String(finer.length ? finer[finer.length - 1] : (choices.find((s) => s > t.spacing) ?? t.spacing));
  const sizeNow = utf8Length(serializeMap(doc));
  $('ed-grid-now').textContent = `${t.spacing} m · ${t.cols} × ${t.rows}`;
  $('ed-grid-verts-now').textContent = fmt(t.cols * t.rows);
  $('ed-grid-tris-now').textContent = fmt((t.cols - 1) * (t.rows - 1) * 2);
  $('ed-grid-size-now').textContent = kb(sizeNow);
  const update = () => {
    const s = Number(spacing.value);
    const p = planGrid(t, s);
    $('ed-grid-after').textContent = `${s} m · ${p.cols} × ${p.rows}`;
    $('ed-grid-verts').textContent = `${fmt(p.vertices)} (×${(p.vertices / p.before).toFixed(1)})`;
    $('ed-grid-tris').textContent = fmt((p.cols - 1) * (p.rows - 1) * 2);
    let size = 0;
    if (!p.error) size = utf8Length(serializeMap({ ...doc, terrain: resampleTerrain(t, s, mode.value as GridInterpolation) }));
    $('ed-grid-size').textContent = p.error ? '' : `${kb(size)} of ${RESOURCE_BUDGETS.mapBytes / 1048576} MB`;
    const over = !p.error && size > RESOURCE_BUDGETS.mapBytes;
    go.disabled = !!p.error || over;
    const notes: string[] = [];
    if (p.error) notes.push(`Can't: ${p.error}.`);
    else if (over) notes.push(`Can't: the map would be ${kb(size)}, over its ${RESOURCE_BUDGETS.mapBytes / 1048576} MB budget.`);
    else {
      if (Math.abs(p.width - p.widthBefore) > 0.01 || Math.abs(p.depth - p.depthBefore) > 0.01) notes.push(`The terrain becomes ${p.width} × ${p.depth} m (now ${p.widthBefore} × ${p.depthBefore} m): a whole number of ${s} m cells.`);
      if (p.vertices > p.before * 2) notes.push(`Four times the triangles cost collision, the bots' navigation and drawing a little more; the most is ${MAX_TERRAIN_VERTS} a side.`);
      if (s > t.spacing) notes.push('Coarser: detail smaller than the new cells goes (heights are kept where the vertices meet).');
    }
    why.textContent = notes.join(' ');
    why.classList.toggle('err', go.disabled);
  };
  spacing.addEventListener('change', update);
  mode.addEventListener('change', update);
  update();
  go.addEventListener('click', () => {
    const s = Number(spacing.value);
    const r = changeGridCommand(host.doc(), s, { mode: mode.value as GridInterpolation, shownFor: host.shownFor });
    if ('error' in r) return update();
    dialog.close();
    dialog.remove();
    host.apply(`Change grid to ${s} m`, r.command, r.moved);
  });
  $('ed-grid-cancel').addEventListener('click', () => (dialog.close(), dialog.remove()));
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
  go.focus();
}
