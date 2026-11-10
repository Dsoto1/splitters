import {
  applyCommand,
  emptySelection,
  groupName,
  groupOf,
  levelName,
  matchEditorKey,
  moveCommand,
  moveEntitiesCommand,
  moverGroupOf,
  placementCells,
  selectionGroup,
  TERRAIN_BRUSHES,
  withMoverGroups,
  type KeyAction,
  type Vec3
} from '@tiletrigger/shared';
import { readClipboard } from './clipboardStore.ts';
import type { EditorApp } from './editorApp.ts';
import { $, escapeHtml, isTyping } from './editorDom.ts';
import { LOOK_SENSITIVITY, snap, type DragState } from './editorParts.ts';

/** MapMaker's input: the pointer on the view (pick, drag, box select, brushes, fly-look), right-click and its menu, and the keys through the key table (keymap.ts) (split out of editorApp.ts, MapMaker overhaul Phase 2 item 5). */
export class EditorInput {
  constructor(readonly app: EditorApp) {}

  /** Box select (Select tool, drag on empty ground): the rectangle on screen. */
  marquee: { x0: number; y0: number; x1: number; y1: number; add: boolean; moved: boolean } | null = null;
  drag: DragState | null = null;

  /**
   * Right-click, one rule for every tool: it takes back what that tool does, where you click.
   * Paint resets the surface, Walls resets the wall, Scatter clears its plants, Road and Paths remove
   * a point or path, and a placing tool removes a thing of its own kind (Erase removes anything).
   * With Select it opens the selection menu.
   */
  secondaryClick(x: number, y: number, alt: boolean): void {
    const tool = this.app.tool;
    switch (tool.kind) {
      case 'select':
        return this.openContextMenu(x, y);
      case 'paint':
        return this.app.paint.paintAtHover(true);
      case 'edge':
        return this.app.paint.edgeAtHover('auto');
      case 'envbrush':
        return this.app.hoverPoint ? this.app.env.dab(this.app.hoverPoint.x, this.app.hoverPoint.z, true) : undefined;
      case 'path':
        return this.app.paths.erase(this.app.hoverPoint);
      case 'route':
        return this.app.routes.erase(this.app.hoverPoint);
      case 'measure':
        this.app.measure.back();
        return this.app.hover.updateHover();
      case 'terrain':
        return this.app.toast('Terrain: Shift-drag does the opposite (lower, or raise)');
      case 'erase':
      case 'note':
      case 'bothint':
        return;
    }
    const hit = this.app.hover.pick();
    const e = hit?.kind === 'entity' ? this.app.doc.entities.find((x) => x.id === hit.id) : undefined;
    const mine =
      !!hit &&
      (tool.kind === 'tile'
        ? hit.kind === 'tile'
        : tool.kind === 'setpiece'
          ? hit.kind === 'setpiece'
          : tool.kind === 'spawn' || tool.kind === 'pickup' || tool.kind === 'prop' || tool.kind === 'mount'
            ? e?.kind === tool.kind
            : hit.kind === 'entity');
    if (!hit) return this.app.toast(`Nothing to remove here on ${levelName(this.app.level)}`, true);
    if (!mine) return this.app.toast(`Right-click removes what this tool places; ${this.app.hover.targetName(hit)} is something else (Erase, X, removes anything)`, true);
    this.app.placing.eraseAtHover(alt);
  }

  /** The selection menu (right-click with Select): picks what is under the pointer first if it isn't selected. */
  openContextMenu(x: number, y: number): void {
    const hit = this.app.hover.pick();
    if (hit) {
      const ids = (hit.kind === 'entity' && moverGroupOf(this.app.doc, hit.id)) || [hit.id];
      const now = hit.kind === 'tile' ? this.app.selection.tiles : hit.kind === 'setpiece' ? this.app.selPieces() : this.app.selection.entities;
      if (!ids.every((id) => now.includes(id))) this.app.setSelection(hit.kind === 'tile' ? { tiles: [hit.id], entities: [] } : hit.kind === 'setpiece' ? { tiles: [], entities: [], setPieces: [hit.id] } : { tiles: [], entities: ids });
    }
    const has = this.app.selCount() > 0;
    const pieces = this.app.selPieces();
    document.getElementById('ed-ctx')?.remove();
    const menu = document.createElement('div');
    menu.id = 'ed-ctx';
    menu.className = 'ed-ctx';
    menu.setAttribute('role', 'menu');
    const item = (label: string, keys: string, run: () => void, enabled = has) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.disabled = !enabled;
      b.innerHTML = `<span>${escapeHtml(label)}</span><kbd>${escapeHtml(keys)}</kbd>`;
      b.addEventListener('click', () => {
        close();
        run();
      });
      menu.append(b);
    };
    const close = () => {
      menu.remove();
      window.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('keydown', onKey, true);
    };
    const outside = (ev: PointerEvent) => {
      if (!menu.contains(ev.target as Node)) close();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        close();
      }
    };
    item('Rotate', 'R', () => this.app.edits.rotate());
    item('Rotate a little', 'Shift+R', () => this.app.edits.rotate(true));
    item(pieces.length && pieces.length === this.app.selCount() ? 'Mirror' : 'Flip east ↔ west', 'M', () => this.app.edits.mirror());
    item('Mirror…', 'Shift+M', () => this.app.edits.mirrorDialog(), true);
    item('Duplicate', 'Ctrl+D', () => this.app.edits.duplicate());
    item('Copy', 'Ctrl+C', () => this.app.edits.copy());
    item('Paste here', 'Ctrl+V', () => this.app.edits.paste(), !!readClipboard());
    const grouped = selectionGroup(this.app.doc, this.app.selection);
    item('Group', 'Ctrl+G', () => this.app.edits.group(), this.app.selCount() > 1 && !grouped);
    item(grouped ? `Ungroup “${groupName(grouped)}”` : 'Ungroup', 'Ctrl+Shift+G', () => this.app.edits.ungroup(), this.app.selCount() > 0 && [...this.app.selection.tiles, ...this.app.selection.entities, ...pieces].some((id) => groupOf(this.app.doc, id)));
    item('Focus', 'F', () => this.app.focusSelection());
    item('Delete', 'Del', () => this.app.edits.deleteSelection());
    if (pieces.length === 1 && this.app.selCount() === 1) item('Explode to tiles', '', () => this.app.pieces.explode(pieces[0]!));
    item('Save as set piece…', '', () => this.app.pieces.saveSelectionDialog());
    if (this.app.doc.terrain) item('Cut ground to floors', '', () => this.app.edits.cutGround());
    item('Select none', 'Esc', () => this.app.setSelection(emptySelection()));
    $('editor').append(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = `${Math.min(x, innerWidth - r.width - 8)}px`;
    menu.style.top = `${Math.min(y, innerHeight - r.height - 8)}px`;
    window.addEventListener('pointerdown', outside, true);
    window.addEventListener('keydown', onKey, true);
    (menu.querySelector('button:not([disabled])') as HTMLButtonElement | null)?.focus();
  }

  /** A drag with Paint, Walls, Scatter or Erase: what it last touched, so each surface, wall or thing is done once. */
  brush: { invert: boolean; alt: boolean; key: string | null; at: { x: number; z: number } | null } | null = null;

  /** Apply the brush tool under the pointer if it has moved onto something new (always on the first press). */
  brushAtHover(first: boolean): void {
    const b = this.brush;
    const tool = this.app.tool;
    if (!b) return;
    if (tool.kind === 'paint' && this.app.paintGround && !this.app.hoverFace) {
      const p = this.app.paintGround;
      if (b.at && Math.hypot(p.x - b.at.x, p.z - b.at.z) < this.app.terrain.brushRadius * 0.5) return;
      b.at = { x: p.x, z: p.z };
      b.key = null;
      if (!b.invert) this.app.paint.paintGroundAtHover();
      return;
    }
    if (tool.kind === 'paint') {
      const t = this.app.paint.paintTarget();
      const key = t ? `${t.tile.id}:${t.slot}` : null;
      if (!key || key === b.key) return;
      b.key = key;
      return this.app.paint.paintAtHover(b.invert);
    }
    if (tool.kind === 'edge') {
      const key = this.app.paint.hoverEdge ? JSON.stringify(this.app.paint.hoverEdge) : null;
      if (!key || key === b.key) return;
      b.key = key;
      return this.app.paint.edgeAtHover(b.invert ? 'auto' : tool.style);
    }
    if (tool.kind === 'envbrush') return this.app.env.drag(this.app.hoverPoint, b.invert || b.alt, first);
    if (tool.kind === 'erase') {
      const hit = this.app.hover.pick();
      if (!hit && !first) return;
      if (hit && hit.id === b.key) return;
      b.key = hit?.id ?? null;
      this.app.placing.eraseAtHover(b.alt);
    }
  }

  updateDrag(): void {
    const d = this.drag;
    if (!d || !this.app.hoverPoint || !this.app.hoverCell) return;
    const cellOffset: [number, number] = [this.app.hoverCell[0] - d.startCell[0], this.app.hoverCell[1] - d.startCell[1]];
    const freeOffset: [number, number] = [snap(this.app.hoverPoint.x - d.startPoint.x, this.app.snapStep(0.5)), snap(this.app.hoverPoint.z - d.startPoint.z, this.app.snapStep(0.5))];
    d.cellOffset = cellOffset;
    d.freeOffset = freeOffset;
    // Tiles and set pieces move cell by cell (their outlines show where they'd land, red where they can't).
    const byCell = this.app.selection.tiles.length > 0 || this.app.selPieces().length > 0;
    if (byCell) {
      const preview = moveCommand(this.app.doc, this.app.selection, cellOffset[0], cellOffset[1], 0);
      this.app.view.setOutlines(this.app.doc, this.app.selection.tiles, [cellOffset[0], cellOffset[1], 0], 'error' in preview, this.app.selectedPieceOutlines());
    }
    // Things follow the pointer as you drag (with tiles, cell by cell), so every kind previews where it lands.
    if (this.app.selection.entities.length) {
      const cs = this.app.doc.classicStructure.cellSize;
      const [ex, ez] = byCell ? [cellOffset[0] * cs, cellOffset[1] * cs] : freeOffset;
      const moved = applyCommand(this.app.viewDoc, moveEntitiesCommand(this.app.viewDoc, this.app.selection.entities, ex, 0, ez));
      this.app.view.setEntities(moved, this.app.level, this.app.showAll, new Set(this.app.selection.entities));
    }
  }

  endDrag(): void {
    const d = this.drag;
    this.drag = null;
    if (!d || !d.moved) return;
    if (this.app.selection.tiles.length || this.app.selPieces().length) {
      const [dx, dy] = d.cellOffset;
      if (dx || dy) this.app.run('Move', moveCommand(this.app.doc, this.app.selection, dx, dy, 0));
    } else {
      const [dx, dz] = d.freeOffset;
      if (dx || dz) this.app.run('Move', moveEntitiesCommand(this.app.doc, this.app.selection.entities, dx, 0, dz));
    }
    this.app.updateSelectionVisuals();
  }

  /** The box select's rectangle on screen (hidden while there is none, or it is still a click). */
  drawMarquee(): void {
    const el = $('ed-marquee');
    const m = this.marquee;
    el.hidden = !m?.moved;
    if (!m?.moved) return;
    const r = $('editor').getBoundingClientRect();
    el.style.left = `${Math.min(m.x0, m.x1) - r.left}px`;
    el.style.top = `${Math.min(m.y0, m.y1) - r.top}px`;
    el.style.width = `${Math.abs(m.x1 - m.x0)}px`;
    el.style.height = `${Math.abs(m.y1 - m.y0)}px`;
  }

  /**
   * Box select (Select tool, drag on empty ground): everything whose middle is inside the box on screen, on the level
   * being edited: tiles, set pieces (whole) and things (a moving build whole). Shift adds to the selection. A click
   * that didn't drag selects nothing.
   */
  endMarquee(): void {
    const m = this.marquee!;
    this.marquee = null;
    this.drawMarquee();
    if (!m.moved) {
      if (!m.add) this.app.setSelection(emptySelection());
      return;
    }
    const [x0, x1] = [Math.min(m.x0, m.x1), Math.max(m.x0, m.x1)];
    const [y0, y1] = [Math.min(m.y0, m.y1), Math.max(m.y0, m.y1)];
    const inside = (p: Vec3) => {
      const s = this.app.view.projectInView(p);
      return !!s && s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1;
    };
    const { cellSize, levelHeight } = this.app.doc.classicStructure;
    /** The middle of the cells on this level, a metre up. */
    const middle = (cells: readonly (readonly number[])[]): Vec3 | null => {
      const here = cells.filter((c) => c[2] === this.app.level);
      if (!here.length) return null;
      return { x: (here.reduce((s, c) => s + c[0]!, 0) / here.length) * cellSize, y: this.app.level * levelHeight + 1, z: (here.reduce((s, c) => s + c[1]!, 0) / here.length) * cellSize };
    };
    const tiles = this.app.doc.classicStructure.tiles.filter((t) => !this.app.outliner.blocked.has(t.id) && ((c) => !!c && inside(c))(middle(placementCells(t) ?? []))).map((t) => t.id);
    const pieces = [...this.app.expansion.footprints].filter(([id, cells]) => !this.app.outliner.blocked.has(id) && ((c) => !!c && inside(c))(middle(cells))).map(([id]) => id);
    const things = this.app.doc.entities.filter((e) => !this.app.outliner.blocked.has(e.id) && this.app.hover.reachable(e) && this.app.view.entityShown(e.id) && inside({ x: e.position[0], y: e.position[1] + 0.5, z: e.position[2] }));
    const entities = withMoverGroups(this.app.doc, things.map((e) => e.id));
    const union = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])];
    const setPieces = m.add ? union(this.app.selPieces(), pieces) : pieces;
    this.app.setSelection({ tiles: m.add ? union(this.app.selection.tiles, tiles) : tiles, entities: m.add ? union(this.app.selection.entities, entities) : entities, ...(setPieces.length ? { setPieces } : {}) });
    const n = this.app.selCount();
    this.app.toast(n ? `${n} selected · Save as set piece… (inspector) makes a piece of them` : `Nothing in the box on ${levelName(this.app.level)}`);
  }

  // ---------------------------------------------------------------- input

  bindInput(): void {
    const canvas = () => this.app.host.canvas;
    window.addEventListener('pointermove', (e) => {
      if (!this.app.active) return;
      if (this.app.looking) {
        const dx = e.movementX;
        const dy = e.movementY;
        // A right-click that wobbles a few pixels is still a click (secondaryClick), not a look.
        this.app.looking.travel += Math.abs(dx) + Math.abs(dy);
        if (this.app.looking.travel > 6) this.app.looking.moved = true;
        // The plan view: a drag pans (the ground follows the pointer).
        if (this.app.plan.on) this.app.plan.pan(dx, dy);
        else if (this.app.looking.button === 2) this.app.view.look(dx * LOOK_SENSITIVITY, -dy * LOOK_SENSITIVITY);
        else this.app.view.fly(0, -dx * 0.05, dy * 0.05);
        return;
      }
      if (this.app.ring.drag) {
        this.app.hover.updatePointer(e.clientX, e.clientY);
        this.app.ring.move({ x: e.clientX, y: e.clientY }, e.shiftKey);
        return this.app.hover.updateHover();
      }
      if (this.marquee) {
        const m = this.marquee;
        m.x1 = e.clientX;
        m.y1 = e.clientY;
        if (Math.hypot(m.x1 - m.x0, m.y1 - m.y0) > 4) m.moved = true;
        this.drawMarquee();
        return;
      }
      if (e.target !== canvas() && !this.drag) {
        // Off the view (over a panel): no hover card.
        if (this.app.pointerAt) {
          this.app.pointerAt = null;
          $('ed-tip').hidden = true;
        }
        return;
      }
      this.app.hover.updatePointer(e.clientX, e.clientY);
      if (this.app.paths.dragging) this.app.paths.pointerMove(this.app.hoverPoint);
      if (this.app.routes.dragging) this.app.routes.pointerMove(this.app.hoverPoint);
      if (this.brush && e.buttons & 1) this.brushAtHover(false);
      if (this.drag) {
        if (Math.hypot(e.clientX - this.drag.pointerX, e.clientY - this.drag.pointerY) > 4) this.drag.moved = true;
        if (this.drag.moved) this.updateDrag();
      }
    });
    window.addEventListener('pointerdown', (e) => {
      if (!this.app.active || e.target !== canvas()) return;
      (document.activeElement as HTMLElement | null)?.blur?.();
      this.app.hover.updatePointer(e.clientX, e.clientY);
      if (e.button === 2 || e.button === 1) {
        this.app.looking = { x: e.clientX, y: e.clientY, moved: false, travel: 0, button: e.button };
        canvas().setPointerCapture(e.pointerId);
        return;
      }
      if (e.button !== 0) return;
      if (this.app.tool.kind === 'paint' && e.altKey) return this.app.paint.pickStyleAtHover();
      if (this.app.tool.kind === 'terrain') return this.app.terrain.startStroke(e.shiftKey);
      // Paint, Walls, Scatter and Erase paint as you drag (one undo step); Shift does the opposite.
      if (this.app.tool.kind === 'paint' || this.app.tool.kind === 'edge' || this.app.tool.kind === 'envbrush' || this.app.tool.kind === 'erase') {
        this.app.history.beginStroke();
        this.brush = { invert: e.shiftKey, alt: e.altKey, key: null, at: null };
        this.brushAtHover(true);
        return;
      }
      if (this.app.tool.kind === 'path') return this.app.paths.pointerDown(this.app.hoverPoint, e.shiftKey);
      if (this.app.tool.kind === 'route') return this.app.routes.pointerDown(this.app.hoverPoint, e.shiftKey);
      if (this.app.tool.kind === 'measure') {
        if (this.app.measure.hover) this.app.measure.click(this.app.measure.hover);
        return this.app.hover.updateHover();
      }
      if (this.app.tool.kind === 'note') return this.app.notes.place(this.app.hoverPoint);
      if (this.app.tool.kind === 'bothint') return this.app.hints.place(this.app.placing.hintPointAtHover());
      if (this.app.tool.kind !== 'select') return this.app.placing.placeAtHover();
      // The rotate ring round the selection: a drag turns it.
      if (this.app.ring.begin({ x: e.clientX, y: e.clientY })) {
        canvas().setPointerCapture(e.pointerId);
        return this.app.hover.updateHover();
      }
      const hit = this.app.hover.pick();
      if (!hit) {
        // Empty ground: drag a box to select what's in it (Shift adds to the selection); a plain click selects nothing.
        this.marquee = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, add: e.shiftKey, moved: false };
        return;
      }
      const key = hit.kind === 'tile' ? 'tiles' : hit.kind === 'setpiece' ? 'setPieces' : 'entities';
      // A moving build (a mover and every block and prop it carries) is picked whole; Alt-click picks one part.
      // A set piece is picked whole too: any of its parts selects the placement.
      const ids = (hit.kind === 'entity' && !e.altKey && moverGroupOf(this.app.doc, hit.id)) || [hit.id];
      const now = this.app.selection[key] ?? [];
      const already = ids.every((id) => now.includes(id));
      // A group is picked whole too (Alt-click: one of it); Shift+click on a selected group's member takes the group out.
      const inGroup = !e.altKey && groupOf(this.app.doc, hit.id);
      if (e.shiftKey) {
        if (already && inGroup) {
          const out = new Set(inGroup.members);
          const keep = (list: readonly string[]) => list.filter((id) => !out.has(id));
          const pieces = keep(this.app.selPieces());
          this.app.setSelection({ tiles: keep(this.app.selection.tiles), entities: keep(this.app.selection.entities), ...(pieces.length ? { setPieces: pieces } : {}) }, true);
          return;
        }
        const next = { ...this.app.selection, [key]: already ? now.filter((id) => !ids.includes(id)) : [...new Set([...now, ...ids])] };
        this.app.setSelection(next, e.altKey);
        return;
      }
      if (!already) this.app.setSelection(hit.kind === 'tile' ? { tiles: [hit.id], entities: [] } : hit.kind === 'setpiece' ? { tiles: [], entities: [], setPieces: [hit.id] } : { tiles: [], entities: ids }, e.altKey);
      if (this.app.hoverPoint && this.app.hoverCell) {
        this.drag = { startCell: [this.app.hoverCell[0], this.app.hoverCell[1]], startPoint: { ...this.app.hoverPoint }, pointerX: e.clientX, pointerY: e.clientY, moved: false, cellOffset: [0, 0], freeOffset: [0, 0] };
      }
    });
    window.addEventListener('pointerup', (e) => {
      if (!this.app.active) return;
      if (this.app.looking && (e.button === 2 || e.button === 1)) {
        const wasClick = !this.app.looking.moved && e.button === 2;
        this.app.looking = null;
        if (wasClick) {
          this.app.hover.updatePointer(e.clientX, e.clientY);
          this.secondaryClick(e.clientX, e.clientY, e.altKey);
        }
        return;
      }
      if (e.button === 0) {
        if (this.app.ring.drag) {
          this.app.ring.end();
          return this.app.hover.updateHover();
        }
        if (this.brush) {
          this.brush = null;
          this.app.history.endStroke();
          this.app.env.strokeEnd();
        }
        if (this.marquee) this.endMarquee();
        this.app.terrain.endStroke();
        this.endDrag();
        this.app.paths.pointerUp();
        this.app.routes.pointerUp();
      }
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.app.active || e.target !== canvas()) return;
        e.preventDefault();
        // Mouse wheels send big steps, touchpads many small ones: move by how far it scrolled.
        const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        if (this.app.plan.on) this.app.plan.zoom(px * (e.shiftKey ? 3 : 1), e.clientX, e.clientY);
        else this.app.view.dolly(Math.max(-3, Math.min(3, -px * 0.03)) * (e.shiftKey ? 3 : 1));
        this.app.hover.updatePointer(e.clientX, e.clientY);
      },
      { passive: false },
    );
    window.addEventListener('contextmenu', (e) => {
      if (this.app.active && e.target === canvas()) e.preventDefault();
    });
    window.addEventListener('blur', () => {
      this.app.ring.cancel();
      this.app.keys.clear();
      this.app.looking = null;
      this.marquee = null;
      this.drawMarquee();
    });
    window.addEventListener('keyup', (e) => this.app.keys.delete(e.code));
    // Every key comes from the one key table (keymap.ts): it finds the binding, `keyActions` runs it. The `?` overlay
    // lists the same table.
    window.addEventListener('keydown', (e) => {
      if (!this.app.active) return;
      const b = matchEditorKey(e);
      if (b?.always) {
        e.preventDefault();
        this.keyActions[b.action](e);
        return;
      }
      if (isTyping() || document.querySelector('#editor dialog[open]')) return;
      this.app.keys.add(e.code);
      if (!b) return;
      this.keyActions[b.action](e);
      e.preventDefault();
    });
  }

  /** What each key in the table does (one handler per action: a Record, so none is left out). */
  readonly keyActions: Record<KeyAction, (e: KeyboardEvent) => void> = {
    test: () => this.app.test(),
    // MapMaker overhaul Phase 3 items 1 and 2.
    playFromHere: () => this.app.playFromHere(),
    planView: () => this.app.plan.toggle(),
    undo: () => this.app.undo(),
    redo: () => this.app.redo(),
    save: () => this.app.saving.save(),
    duplicate: () => this.app.edits.duplicate(),
    togglePalette: () => this.app.topBar.toggleSidebar('pal'),
    toggleSidePanel: () => this.app.topBar.toggleSidebar('right'),
    rotate: () => this.app.edits.rotate(false),
    rotateFine: () => this.app.edits.rotate(true),
    mirror: () => this.app.edits.mirror(),
    // MapMaker overhaul Phase 3 part B: Mirror…, groups, copy and paste, note pins.
    mirrorDialog: () => this.app.edits.mirrorDialog(),
    group: () => this.app.edits.group(),
    ungroup: () => this.app.edits.ungroup(),
    copy: () => this.app.edits.copy(),
    paste: () => this.app.edits.paste(),
    notes: () => this.app.setTool({ kind: 'note' }),
    // MapMaker overhaul Phase 4 item 3: bot hints (the last kind picked).
    botHints: () => this.app.setTool({ kind: 'bothint', hint: this.app.lastHint }),
    focus: () => this.app.focusSelection(),
    resetView: () => this.app.resetView(),
    logic: () => this.app.logic.toggle(),
    paint: () => this.app.setTool({ kind: 'paint' }),
    terrain: () => {
      const i = this.app.tool.kind === 'terrain' ? (TERRAIN_BRUSHES.indexOf(this.app.terrain.terrainBrush) + 1) % TERRAIN_BRUSHES.length : TERRAIN_BRUSHES.indexOf(this.app.terrain.terrainBrush);
      this.app.terrain.setTerrainBrush(TERRAIN_BRUSHES[i]!);
    },
    walls: () => this.app.paint.wallsTool(this.app.tool.kind === 'edge'),
    erase: () => this.app.setTool({ kind: 'erase' }),
    // U: the measure tool (MapMaker overhaul Phase 1 item 3).
    measure: () => this.app.setTool({ kind: 'measure' }),
    // G: Paths (Shift+G: Paths on the track, NPC traffic), N: the Environment brush (the Scatter Brush sets it replaced are retired).
    paths: () => this.app.setTool({ kind: 'path' }),
    raceTrack: () => {
      this.app.paths.preset('race');
      this.app.setTool({ kind: 'path' });
    },
    envBrush: () => this.app.setTool({ kind: 'envbrush' }),
    place: () => this.app.placeTool(),
    pickStyle: () => {
      if (this.app.tool.kind === 'paint') this.app.paint.pickStyleAtHover();
    },
    select: () => this.selectTool(),
    escape: () => {
      // Esc drops a turn by the ring mid-drag (nothing turns).
      if (this.app.ring.cancel()) return this.app.hover.updateHover();
      // Esc clears a measurement first (the measure tool stays in hand).
      if (this.app.measure.clear() && this.app.tool.kind === 'measure') return this.app.hover.updateHover();
      // Esc drops a jump link half placed, else lets the selected bot hint go.
      if (this.app.hints.escape()) return this.app.hover.updateHover();
      this.selectTool();
    },
    showAll: () => this.app.setShowAll(!this.app.showAll),
    search: () => {
      $<HTMLInputElement>('ed-search').focus();
      $<HTMLInputElement>('ed-search').select();
    },
    keys: () => this.app.keyOverlay.open(),
    delete: () => {
      if (this.app.tool.kind === 'path' && this.app.paths.deleteSelected()) return;
      if (this.app.tool.kind === 'route' && this.app.routes.deleteSelected()) return;
      if (!this.app.selCount() && this.app.hints.deleteSelected()) return;
      this.app.edits.deleteSelection();
    },
    // One meaning per key: PgUp/PgDn change the level (Shift: move the selection a level), [ ] the brush size.
    levelUp: () => this.app.setLevel(this.app.level + 1),
    levelDown: () => this.app.setLevel(this.app.level - 1),
    liftSelection: () => this.app.edits.nudge(0, 0, 1),
    lowerSelection: () => this.app.edits.nudge(0, 0, -1),
    brushBigger: () => {
      if (this.app.tool.kind === 'terrain' || this.app.tool.kind === 'envbrush') this.app.terrain.setBrushRadius(this.app.terrain.brushRadius + 2);
    },
    brushSmaller: () => {
      if (this.app.tool.kind === 'terrain' || this.app.tool.kind === 'envbrush') this.app.terrain.setBrushRadius(this.app.terrain.brushRadius - 2);
    },
    nudgeNorth: () => this.app.edits.nudge(0, 1, 0),
    nudgeSouth: () => this.app.edits.nudge(0, -1, 0),
    nudgeWest: () => this.app.edits.nudge(-1, 0, 0),
    nudgeEast: () => this.app.edits.nudge(1, 0, 0),
  };

  /** V (and Esc, once nothing else wants it): the Select tool; with Select in hand, select none. */
  selectTool(): void {
    if (this.app.tool.kind === 'select') this.app.setSelection(emptySelection());
    this.app.setTool({ kind: 'select' });
  }
}
