import {
  applyCommand,
  clipboardCount,
  copySelection,
  coreCatalog,
  cutGroundToFloorsCommand,
  deleteCommand,
  duplicateCommand,
  emptySelection,
  flipCommand,
  groupCommand,
  mirrorSetPieceCommand,
  moveCommand,
  moveEntitiesCommand,
  normalizeYaw,
  pasteCommand,
  pasteNote,
  rotateCommand,
  selectionMiddle,
  setPieceMirrorRefusal,
  settlePropsCommand,
  ungroupCommand,
  withCopiedGroups,
  yawStep,
  type EditCommand,
  type Rotation
} from '@tiletrigger/shared';
import { readClipboard, writeClipboard } from './clipboardStore.ts';
import type { EditorApp } from './editorApp.ts';
import { $ } from './editorDom.ts';
import { openMirrorDialog } from './mirrorDialog.ts';

/** Edits to the selection: turn, nudge, delete, duplicate, group and ungroup, copy and paste, mirror and flip, cut the ground to the floors and settle props on the ground (split out of editorApp.ts, MapMaker overhaul Phase 2 item 5). */
export class SelectionEdits {
  constructor(readonly app: EditorApp) {}

  /** M: mirror the set piece being placed, or the selected set pieces (one undo step). A piece that can't be says why. */
  mirror(): void {
    if (this.app.tool.kind === 'setpiece') {
      const def = this.app.pieceDef(this.app.tool.piece);
      if (!def) return;
      const why = setPieceMirrorRefusal(def);
      if (why) return this.app.toast(why, true);
      this.app.pieceMirror = !this.app.pieceMirror;
      this.app.toast(`${def.displayName} ${this.app.pieceMirror ? 'mirrored (east and west swapped)' : 'not mirrored'}`);
      this.app.pieces.renderPieceInfo();
      this.app.hover.updateHover();
      return;
    }
    const ids = this.app.selPieces();
    // A group or any other selection: flipped east ↔ west over its own middle, as one (Shift+M: Mirror… for more).
    if (this.app.selCount() && ids.length !== this.app.selCount()) {
      const r = flipCommand(this.app.doc, this.app.selection, 'eastWest', coreCatalog, this.app.placeLib);
      return void this.app.run('Flip east ↔ west', 'error' in r ? r : r.command);
    }
    if (!ids.length) return this.app.toast('M mirrors a set piece or flips the selection: select something, or pick a piece in the Set pieces tab (Shift+M: Mirror…)', true);
    let doc = this.app.doc;
    const commands: EditCommand[] = [];
    for (const id of ids) {
      const p = doc.setPieces?.find((x) => x.id === id);
      const def = p && this.app.pieceDef(p.piece);
      if (!p || !def) continue;
      const why = setPieceMirrorRefusal(def);
      if (why) return this.app.toast(why, true);
      const cmd = mirrorSetPieceCommand(doc, id);
      if ('error' in cmd) return this.app.toast(`Can't mirror: ${cmd.error}`, true);
      commands.push(cmd);
      doc = applyCommand(doc, cmd);
    }
    this.app.run(commands.length > 1 ? `Mirror ${commands.length} set pieces` : 'Mirror', { kind: 'batch', commands });
  }

  /** R turns what you are placing, or the selection, by that kind's step (yawStep); Shift+R by the finer step. */
  rotate(fine = false): void {
    if (!this.app.selCount() && this.app.tool.kind !== 'tile' && this.app.tool.kind !== 'setpiece' && this.app.hints.turnSelected(fine)) return;
    const deg = (yaw: number) => `Facing ${Math.round((yaw * 180) / Math.PI)}°`;
    if (this.app.tool.kind === 'tile' || this.app.tool.kind === 'setpiece') {
      if (fine) this.app.toast(`${this.app.tool.kind === 'tile' ? 'Tiles' : 'Set pieces'} turn in quarter turns`);
      this.app.rotation = ((this.app.rotation + 1) % 4) as Rotation;
      this.app.toast(`${this.app.toolName(this.app.tool)} turned to ${this.app.rotation * 90}°`);
      this.app.pieces.renderPieceInfo();
      this.app.hover.updateHover();
    } else if (this.app.tool.kind === 'spawn') {
      this.app.spawnYaw = normalizeYaw(this.app.spawnYaw + yawStep('spawn', fine));
      this.app.toast(deg(this.app.spawnYaw));
    } else if (this.app.tool.kind === 'prop' || this.app.tool.kind === 'mount') {
      this.app.propYaw = normalizeYaw(this.app.propYaw + yawStep(this.app.tool.kind, fine));
      this.app.toast(deg(this.app.propYaw));
    } else if (this.app.tool.kind === 'npc' || this.app.tool.kind === 'scenario') {
      // Doors, traps, pads, ladders, NPCs and the rest: quarter turns, Shift 15°.
      this.app.scenarioYaw = normalizeYaw(this.app.scenarioYaw + yawStep('door', fine));
      this.app.toast(deg(this.app.scenarioYaw));
    } else if (this.app.selCount()) {
      this.app.run(fine ? 'Rotate a little' : 'Rotate', rotateCommand(this.app.doc, this.app.selection, undefined, { fine }));
    } else {
      this.app.toast('R turns the selection, or the piece you are placing (Shift+R: a finer step): select something first', true);
    }
  }

  nudge(dx: number, dy: number, dz: number): void {
    if (!this.app.selCount()) return;
    // Tiles and set pieces move by whole cells (and things with them); things alone by half a metre.
    if (this.app.selection.tiles.length || this.app.selPieces().length || dz !== 0) {
      this.app.run('Move', moveCommand(this.app.doc, this.app.selection, dx, dy, dz));
      if (dz) this.app.setLevel(this.app.level + dz);
    } else {
      this.app.run('Move', moveEntitiesCommand(this.app.doc, this.app.selection.entities, dx * 0.5, 0, dy * 0.5));
    }
  }

  deleteSelection(): void {
    const n = this.app.selCount();
    if (!n) return this.app.toast('Nothing selected: click something with Select (V) first, or use Erase (X)', true);
    if (this.app.run(n > 1 ? `Delete ${n} items` : 'Delete', deleteCommand(this.app.doc, this.app.selection))) this.app.setSelection(emptySelection());
  }

  duplicate(): void {
    const r = duplicateCommand(this.app.doc, this.app.selection);
    if ('error' in r) return this.app.toast(`Can't duplicate: ${r.error}`, true);
    // Copies of a whole group are a group of their own (groups.ts).
    const g = withCopiedGroups(this.app.doc, this.app.selection, r);
    if (this.app.run('Duplicate', g.command)) this.app.setSelection(g.selection);
  }

  /** Ctrl+G: group the selection (groups.ts): one undo step. */
  group(): void {
    const r = groupCommand(this.app.doc, this.app.selection);
    if ('error' in r) return this.app.toast(`Can't group: ${r.error}`, true);
    if (this.app.run('Group', r.command)) {
      this.app.inspector.renderInspector();
      this.app.toast(`Grouped ${r.group.members.length} things · a click on any picks them all (Alt-click: one) · Ctrl+Shift+G ungroups`);
    }
  }

  /** Ctrl+Shift+G: the selected groups go; their things stay selected. */
  ungroup(): void {
    const r = ungroupCommand(this.app.doc, this.app.selection);
    if ('error' in r) return this.app.toast(`Can't ungroup: ${r.error}`, true);
    if (this.app.run('Ungroup', r.command)) {
      this.app.inspector.renderInspector();
      this.app.toast(`Ungrouped ${r.count === 1 ? 'the group' : `${r.count} groups`} · Ctrl+Z to undo`);
    }
  }

  /** Ctrl+C: the selection to MapMaker's clipboard in this browser (clipboard.ts), for this map or another. */
  copy(): void {
    const c = copySelection(this.app.doc, this.app.selection, coreCatalog, this.app.placeLib);
    if ('error' in c) return this.app.toast(`Can't copy: ${c.error}`, true);
    if (!writeClipboard(c)) return this.app.toast("Can't copy: this browser's storage is full or blocked", true);
    this.app.toast(`Copied ${clipboardCount(c)} thing${clipboardCount(c) === 1 ? '' : 's'} · Ctrl+V pastes at the pointer, here or in another map`);
  }

  /** Ctrl+V: the clipboard pasted with new ids, its anchor on the cell under the pointer, on the level being edited. */
  paste(): void {
    const c = readClipboard();
    if (!c) return this.app.toast('Nothing to paste: select something and copy it (Ctrl+C) first', true);
    const cell = this.app.hoverCell ?? [0, 0];
    const r = pasteCommand(this.app.doc, c, [cell[0], cell[1]], this.app.level, coreCatalog, this.app.placeLib);
    if ('error' in r) return this.app.toast(`Can't paste: ${r.error}`, true);
    if (this.app.run('Paste', r.command)) {
      this.app.setTool({ kind: 'select' });
      this.app.setSelection(r.selection);
      const note = pasteNote(this.app.doc, c);
      this.app.toast(`Pasted ${clipboardCount(c)} thing${clipboardCount(c) === 1 ? '' : 's'} from ${c.from.mapName}${note ? `, ${note}` : ''} · Ctrl+Z to undo`);
    }
  }

  /** The selection menu's Cut ground to floors (groundCut.ts): the ground as made lowered under the selection's floors, however deep. */
  cutGround(): void {
    const r = cutGroundToFloorsCommand(this.app.doc, this.app.selection, coreCatalog, this.app.placeLib);
    if ('error' in r) return this.app.toast(`Can't cut the ground: ${r.error}`, true);
    if (this.app.run('Cut ground to floors', r.command)) this.app.toast(`The ground cut down to the floors: ${r.vertices} point${r.vertices === 1 ? '' : 's'}, up to ${r.deepest} m · Ctrl+Z to undo`);
  }

  /** Shift+M: Mirror… (mirrorDialog.ts), the selection or half the map. */
  mirrorDialog(): void {
    const { bounds, terrain } = this.app.doc;
    openMirrorDialog({
      doc: () => this.app.doc,
      selection: () => this.app.selection,
      middle: () =>
        bounds ? [(bounds.min[0] + bounds.max[0]) / 2, (bounds.min[1] + bounds.max[1]) / 2] : terrain ? [terrain.origin[0] + ((terrain.cols - 1) * terrain.spacing) / 2, terrain.origin[1] + ((terrain.rows - 1) * terrain.spacing) / 2] : [0, 0],
      selectionMiddle: () => selectionMiddle(this.app.doc, this.app.selection, coreCatalog, this.app.placeLib),
      apply: (label, r) => {
        if (!this.app.run(label, r.command)) return;
        this.app.setTool({ kind: 'select' });
        this.app.setSelection(r.selection);
        this.app.toast(`${label}${r.swapped ? `: ${r.swapped} team thing${r.swapped === 1 ? '' : 's'} swapped sides` : ''} · Ctrl+Z to undo`);
      },
      root: $('editor'),
    });
  }

  settleProps(ids?: readonly string[]): void {
    const cmd = settlePropsCommand(this.app.doc, ids);
    if (cmd.kind === 'updateEntities' && cmd.after.length === 0) return this.app.toast('Already on the ground');
    if (this.app.run('Settle props', cmd)) this.app.toast(`Settled ${cmd.kind === 'updateEntities' ? cmd.after.length : 0} props`);
  }
}
