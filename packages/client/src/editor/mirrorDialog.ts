import { MIRROR_LABELS, mirrorCommand, mirrorHalfCommand, mirrorHalves, snapMirrorAt, type MapDocument, type MapHalf, type MirrorAcross, type MirrorPlane, type MirrorResult, type Selection } from '@tiletrigger/shared';

/**
 * Mirror… (Shift+M; MapMaker overhaul Phase 3, item 6; the commands: shared editor/mirror.ts): the selection or half
 * the map, across an east–west or north–south line or through a point. A mirrored copy swaps team things to the
 * other team (spawns, flags, team zones, doors and buttons); unticking "Keep the original" flips the selection itself
 * instead. One command, one undo step. The dialog says beforehand what it will do, or why it can't.
 */
export interface MirrorHost {
  doc(): MapDocument;
  selection(): Selection;
  /** The map's middle (its boundary's, else its terrain's, else the origin), where the line starts. */
  middle(): [number, number];
  /** The selection's middle, or null. */
  selectionMiddle(): [number, number] | null;
  apply(label: string, r: MirrorResult): void;
  /** Where the dialog goes. */
  root: HTMLElement;
}

const HALF_LABELS: Record<MapHalf, string> = { west: 'the west half onto the east', east: 'the east half onto the west', south: 'the south half onto the north', north: 'the north half onto the south' };

export function openMirrorDialog(host: MirrorHost): void {
  document.getElementById('ed-mirror-dialog')?.remove();
  const doc = host.doc();
  const sel = host.selection();
  const count = sel.tiles.length + sel.entities.length + (sel.setPieces?.length ?? 0);
  const dialog = document.createElement('dialog');
  dialog.id = 'ed-mirror-dialog';
  dialog.className = 'ed-mirror';
  const [mx, mz] = host.middle();
  dialog.innerHTML = `
    <h2>Mirror</h2>
    <p class="ed-note">For team maps: build one side, mirror it onto the other. In a mirrored copy, team things swap sides (spawns, flag bases, team zones, doors, buttons and bot hints). Half the map brings its bot hints, and its terrain and paths when you tick them.</p>
    <fieldset class="ed-mirror-what"><legend>What</legend>
      <label><input type="radio" name="ed-mirror-what" value="selection" id="ed-mirror-sel"> The selection (<span></span>)</label>
      <label><input type="radio" name="ed-mirror-what" value="half" id="ed-mirror-half-on"> Half the map: <select id="ed-mirror-half"></select></label>
    </fieldset>
    <label class="ed-dialog-field"><span>Across</span><select id="ed-mirror-across"></select></label>
    <div class="ed-dialog-field ed-mirror-at"><span>At</span>
      <label>x <input type="number" id="ed-mirror-x" step="any"></label>
      <label>z <input type="number" id="ed-mirror-z" step="any"></label>
      <button type="button" id="ed-mirror-mid">Map middle</button>
      <button type="button" id="ed-mirror-selmid">Selection's middle</button>
    </div>
    <label class="ed-mirror-check"><input type="checkbox" id="ed-mirror-keep" checked> Keep the original (add a mirrored copy)</label>
    <label class="ed-mirror-check"><input type="checkbox" id="ed-mirror-swap" checked> Team things swap sides in the copy</label>
    <label class="ed-mirror-check" title="Half the map only: the far half's terrain (heights, paint and plant cover) becomes the near half's mirror image, and the paths wholly on the near half are copied"><input type="checkbox" id="ed-mirror-ground"> Terrain and paths too (half the map)</label>
    <p id="ed-mirror-why" class="ed-note"></p>
    <div class="ed-dialog-actions"><button id="ed-mirror-go" class="primary">Mirror</button><button id="ed-mirror-cancel">Cancel</button></div>`;
  host.root.append(dialog);
  const $ = <T extends HTMLElement>(id: string) => dialog.querySelector<T>(`#${id}`)!;
  const selRadio = $<HTMLInputElement>('ed-mirror-sel');
  const halfRadio = $<HTMLInputElement>('ed-mirror-half-on');
  const half = $<HTMLSelectElement>('ed-mirror-half');
  const across = $<HTMLSelectElement>('ed-mirror-across');
  const x = $<HTMLInputElement>('ed-mirror-x');
  const z = $<HTMLInputElement>('ed-mirror-z');
  const keep = $<HTMLInputElement>('ed-mirror-keep');
  const swap = $<HTMLInputElement>('ed-mirror-swap');
  const ground = $<HTMLInputElement>('ed-mirror-ground');
  const why = $('ed-mirror-why');
  const go = $<HTMLButtonElement>('ed-mirror-go');
  selRadio.parentElement!.querySelector('span')!.textContent = count ? `${count} thing${count === 1 ? '' : 's'}` : 'nothing selected';
  selRadio.disabled = !count;
  (count ? selRadio : halfRadio).checked = true;
  for (const a of Object.keys(MIRROR_LABELS) as MirrorAcross[]) across.append(new Option(MIRROR_LABELS[a], a));
  const cell = doc.classicStructure.cellSize;
  const setAt = (at: [number, number]) => {
    const s = snapMirrorAt(at, cell);
    x.value = String(s[0]);
    z.value = String(s[1]);
  };
  setAt([mx, mz]);
  const selMid = host.selectionMiddle();
  $<HTMLButtonElement>('ed-mirror-selmid').disabled = !selMid;
  $('ed-mirror-mid').addEventListener('click', () => (setAt(host.middle()), update()));
  $('ed-mirror-selmid').addEventListener('click', () => (selMid && setAt(selMid), update()));
  const plane = (): MirrorPlane => ({ across: across.value as MirrorAcross, at: [Number(x.value) || 0, Number(z.value) || 0] });
  /** The command it would run, or why not. */
  const plan = (): { label: string; r: MirrorResult & { onLine?: number; hints?: number; paths?: number; terrain?: boolean } } | { error: string } => {
    const p = plane();
    const d = host.doc();
    if (halfRadio.checked) {
      const r = mirrorHalfCommand(d, p, half.value as MapHalf, { swapTeams: swap.checked, ground: ground.checked });
      return 'error' in r ? r : { label: 'Mirror half the map', r };
    }
    const r = mirrorCommand(d, host.selection(), p, { copy: keep.checked, swapTeams: swap.checked });
    return 'error' in r ? r : { label: keep.checked ? 'Mirror a copy' : 'Mirror', r };
  };
  const update = () => {
    const a = across.value as MirrorAcross;
    const halves = mirrorHalves(a);
    const was = half.value as MapHalf;
    half.replaceChildren(...halves.map((h) => new Option(HALF_LABELS[h], h, false, h === was)));
    // Snapped to where cells land on cells (a cell's middle or edge); x matters across a north–south line, z across an east–west one.
    x.disabled = a === 'northSouth';
    z.disabled = a === 'eastWest';
    keep.disabled = halfRadio.checked;
    swap.disabled = !halfRadio.checked && !keep.checked;
    ground.disabled = !halfRadio.checked;
    const r = plan();
    go.disabled = 'error' in r;
    if ('error' in r) {
      why.textContent = `Can't: ${r.error}`;
      why.classList.add('err');
      return;
    }
    why.classList.remove('err');
    const n = r.r.selection.tiles.length + r.r.selection.entities.length + (r.r.selection.setPieces?.length ?? 0);
    const at = snapMirrorAt(plane().at, cell);
    const where = a === 'eastWest' ? `x = ${at[0]} m` : a === 'northSouth' ? `z = ${at[1]} m` : `(${at[0]}, ${at[1]})`;
    const extra = [r.r.hints ? `${r.r.hints} bot hint${r.r.hints === 1 ? '' : 's'}` : '', r.r.paths ? `${r.r.paths} path${r.r.paths === 1 ? '' : 's'}` : '', r.r.terrain ? 'the terrain' : ''].filter(Boolean);
    why.textContent = halfRadio.checked || keep.checked
      ? `Adds ${n} mirrored thing${n === 1 ? '' : 's'}${extra.length ? ` and ${extra.join(', ')}` : ''} (${where})${r.r.swapped ? `; ${r.r.swapped} swap team` : ''}${r.r.onLine ? `; ${r.r.onLine} on the line stay as they are` : ''}.`
      : `Flips the ${n} selected over (${where}); teams stay as they are.`;
  };
  for (const el of [selRadio, halfRadio, half, across, keep, swap, ground]) el.addEventListener('change', update);
  for (const el of [x, z]) el.addEventListener('input', update);
  update();
  go.addEventListener('click', () => {
    const r = plan();
    if ('error' in r) return update();
    dialog.close();
    dialog.remove();
    host.apply(r.label, r.r);
  });
  $('ed-mirror-cancel').addEventListener('click', () => (dialog.close(), dialog.remove()));
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
  go.focus();
}
