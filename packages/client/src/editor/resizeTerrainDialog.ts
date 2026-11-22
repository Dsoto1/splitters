import { RESOURCE_BUDGETS, TERRAIN_EDGES, planResize, resizeTerrain, serializeMap, utf8Length, type EditCommand, type MapDocument, type ResizeFill, type TerrainEdges, resizeTerrainCommand } from '@tiletrigger/shared';

/**
 * Terrain → Resize… (the command: shared editor/resizeTerrain.ts; owner, 2026-11-16): grow or shrink each edge (or
 * all of them) by whole cells, keeping every sculpted height, painted cell and plant where it is. Before it runs the
 * dialog shows the size, the vertices against the cap, the map file against its budget, and the things standing on
 * ground that would be cut off (they go with it). One undo step.
 */
export interface ResizeTerrainHost {
  doc(): MapDocument;
  apply(label: string, command: EditCommand, cut: number): void;
  root: HTMLElement;
}

const fmt = (n: number) => n.toLocaleString('en-GB');
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.round(n / 1024)} KB`);
const LABELS: Record<(typeof TERRAIN_EDGES)[number], string> = { north: 'North (+Z)', south: 'South (−Z)', east: 'East (+X)', west: 'West (−X)' };

export function openResizeTerrainDialog(host: ResizeTerrainHost): void {
  document.getElementById('ed-resize-dialog')?.remove();
  const doc = host.doc();
  const t = doc.terrain;
  if (!t) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'ed-resize-dialog';
  dialog.className = 'ed-grid';
  const edgeRows = `<div class="ed-resize-edges">${TERRAIN_EDGES.map((k) => `<label class="ed-dialog-field"><span>${LABELS[k]}</span><input id="ed-resize-${k}" type="number" step="${t.spacing}" value="0" inputmode="decimal"> m</label>`).join('')}</div>`;
  dialog.innerHTML = `
    <h2>Resize terrain</h2>
    <p class="ed-note">Grow (more than 0) or shrink (less than 0) each edge, in ${t.spacing} m cells. Every sculpted height, painted ground and plant stays where it is; new ground continues the edge. One undo step.</p>
    <label class="ed-dialog-field"><span>Every edge</span><input id="ed-resize-all" type="number" step="${t.spacing}" placeholder="—" inputmode="decimal"> m</label>
    ${edgeRows}
    <label class="ed-dialog-field" title="Flat: the edge's heights carried straight out. Eased: from the edge's height down (or up) to the terrain's base over the new ground"><span>New ground</span><select id="ed-resize-fill"><option value="flat" selected>Flat (the edge's height)</option><option value="eased">Eased (to the base height)</option></select></label>
    <table class="ed-grid-plan"><tbody>
      <tr><th></th><th>Now</th><th>After</th></tr>
      <tr><td>Size</td><td id="ed-resize-size-now"></td><td id="ed-resize-size-after"></td></tr>
      <tr><td>Vertices</td><td id="ed-resize-verts-now"></td><td id="ed-resize-verts"></td></tr>
      <tr><td>Map file</td><td id="ed-resize-file-now"></td><td id="ed-resize-file"></td></tr>
    </tbody></table>
    <p id="ed-resize-why" class="ed-note"></p>
    <div class="ed-dialog-actions"><button id="ed-resize-go" class="primary">Resize</button><button id="ed-resize-cancel">Cancel</button></div>`;
  host.root.append(dialog);
  const $ = <T extends HTMLElement>(id: string) => dialog.querySelector<T>(`#${id}`)!;
  const fill = $<HTMLSelectElement>('ed-resize-fill');
  const why = $('ed-resize-why');
  const go = $<HTMLButtonElement>('ed-resize-go');
  const cellsOf = (id: string) => {
    const v = Number($<HTMLInputElement>(id).value);
    return Number.isFinite(v) ? Math.round(v / t.spacing) : 0;
  };
  const edges = (): TerrainEdges => ({ north: cellsOf('ed-resize-north'), south: cellsOf('ed-resize-south'), east: cellsOf('ed-resize-east'), west: cellsOf('ed-resize-west') });
  $('ed-resize-size-now').textContent = `${(t.cols - 1) * t.spacing} × ${(t.rows - 1) * t.spacing} m`;
  $('ed-resize-verts-now').textContent = `${fmt(t.cols * t.rows)} (${t.cols} × ${t.rows})`;
  $('ed-resize-file-now').textContent = kb(utf8Length(serializeMap(doc)));
  const update = () => {
    const e = edges();
    const p = planResize(doc, e);
    $('ed-resize-size-after').textContent = `${p.width} × ${p.depth} m`;
    $('ed-resize-verts').textContent = `${fmt(p.vertices)} (${p.cols} × ${p.rows})`;
    let size = 0;
    if (!p.error) size = utf8Length(serializeMap({ ...doc, terrain: resizeTerrain(t, e, fill.value as ResizeFill), entities: doc.entities.filter((x) => !p.cut.includes(x)) }));
    $('ed-resize-file').textContent = p.error ? '' : `${kb(size)} of ${RESOURCE_BUDGETS.mapBytes / 1048576} MB`;
    const over = !p.error && size > RESOURCE_BUDGETS.mapBytes;
    go.disabled = !!p.error || over;
    const notes: string[] = [];
    if (p.error) notes.push(`Can't: ${p.error}.`);
    else if (over) notes.push(`Can't: the map would be ${kb(size)}, over its ${RESOURCE_BUDGETS.mapBytes / 1048576} MB budget.`);
    else if (p.cut.length) {
      const kinds = new Map<string, number>();
      for (const x of p.cut) kinds.set(x.kind, (kinds.get(x.kind) ?? 0) + 1);
      notes.push(`Cut off with the ground: ${[...kinds].map(([k, n]) => `${n} ${k}${n > 1 ? 's' : ''}`).join(', ')} (${p.cut.slice(0, 6).map((x) => x.id).join(', ')}${p.cut.length > 6 ? '…' : ''}).`);
    }
    why.textContent = notes.join(' ');
    why.classList.toggle('err', go.disabled && !(TERRAIN_EDGES.every((k) => e[k] === 0)));
  };
  $<HTMLInputElement>('ed-resize-all').addEventListener('input', () => {
    const v = $<HTMLInputElement>('ed-resize-all').value;
    for (const k of TERRAIN_EDGES) $<HTMLInputElement>(`ed-resize-${k}`).value = v === '' ? '0' : v;
    update();
  });
  for (const k of TERRAIN_EDGES) $(`ed-resize-${k}`).addEventListener('input', update);
  fill.addEventListener('change', update);
  update();
  go.addEventListener('click', () => {
    const e = edges();
    const r = resizeTerrainCommand(host.doc(), e, fill.value as ResizeFill);
    if ('error' in r) return update();
    dialog.close();
    dialog.remove();
    host.apply(`Resize terrain to ${r.plan.width} × ${r.plan.depth} m`, r.command, r.plan.cut.length);
  });
  $('ed-resize-cancel').addEventListener('click', () => (dialog.close(), dialog.remove()));
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
  $<HTMLInputElement>('ed-resize-all').focus();
}
