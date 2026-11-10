import {
  addSetPieceDefCommand,
  buildMapGeometry,
  checkSetPieceDefinition,
  checkSetPiecePlacement,
  coreCatalog,
  coreMaterials,
  coreThemes,
  DOOR_STYLE_LABELS,
  DOOR_STYLES,
  entityLabel,
  explodeSetPieceCommand,
  FACADE_LABELS,
  FACADES,
  getProp,
  GLASS_KIND_LABELS,
  GLASS_KINDS,
  levelName,
  mirrorSetPieceCommand,
  placementCells,
  placementPack,
  placeSetPieceCommand,
  replaceTilesWithSetPieceCommand,
  SET_PIECE_MATERIAL_ROLES,
  setPieceFootprint,
  setPieceFromSelection,
  setPieceMirrorRefusal,
  setPieceParts,
  setPiecePortStates,
  updateSetPieceCommand,
  type DoorStyle,
  type GlassKind,
  type MapDocument,
  type Selection,
  type SetPieceDefinition,
  type SetPieceLibrary,
  type SetPiecePlacement,
  type SetPieceRole,
  type SurfaceStyle,
  type WorldBox
} from '@tiletrigger/shared';
import type { EditorApp } from './editorApp.ts';
import { $, button, h2, numberInput, row, small, text } from './editorDom.ts';
import { PIECE_PART_KINDS, ROLE_LABELS, rolesUsed } from './editorParts.ts';
import { type PieceOutline } from './editorView.ts';
import {
  setPieceFamilyLabel,
  setPieceFamilyOrder
} from './paletteCatalog.ts';
import {
  deleteSetPiece,
  exportSetPiece,
  importSetPieceFile,
  listSetPieces,
  saveSetPiece
} from './storage.ts';

/** Set pieces: placing them (the ghost, its ports, the look), the Set pieces palette and the player's own pieces, saving a selection as a piece, exploding one and the set piece inspector (split out of editorApp.ts, MapMaker overhaul Phase 2 item 5). */
export class SetPieceTools {
  constructor(readonly app: EditorApp) {}

  /** The player's own set pieces (their library in this browser, storage.ts), by id; `myPiecesRev` counts changes. */
  myPieces = new Map<string, SetPieceDefinition>();
  myPiecesRev = 0;
  /** The look the set piece tool places in (a role pack id; '' the map theme's). */
  pieceLook = '';

  /** The pieces MapMaker can place: the shipped ones and the player's own (their library), with the role packs. */
  placeLibCache: { rev: number; lib: SetPieceLibrary } | null = null;

  /** Replace all of a tile with a set piece (a retired tile's own replacement, or any), one undo step, and select them. */
  replaceTiles(tile: string, piece: string): void {
    const r = replaceTilesWithSetPieceCommand(this.app.doc, tile, piece, coreCatalog, this.app.setPieceLib);
    if (!this.app.run('Replace all', 'error' in r ? r : r.command) || 'error' in r) return;
    this.app.setSelection({ tiles: [], entities: [], setPieces: r.placements.map((p) => p.id) });
    this.app.toast(`Replaced ${r.placements.length} ${coreCatalog.get(tile)?.displayName ?? tile} with ${this.app.pieceDef(r.placements[0]!.piece)?.displayName ?? r.placements[0]!.piece}`);
  }

  /** A placement as MapMaker outlines it: its footprint, and its ports, each flagged when a wall stands in it. */
  pieceOutline(p: SetPiecePlacement): PieceOutline | null {
    const def = this.app.pieceDef(p.piece);
    if (!def) return null;
    const ports = setPiecePortStates(p, def, this.app.mapBoxes()).map((s) => ({ x: s.x, y: s.y, z: s.z, side: s.side, kind: s.kind, closed: s.closed, blocked: !!s.blockedBy }));
    return { cells: setPieceFootprint(p, def), ports };
  }

  /**
   * A placement's own collision as it would be built where it stands (its sides resolved against the tiles round it:
   * a port that meets one becomes a doorway), for the ghost's ports: the piece and its neighbours alone, not the map.
   */
  ownBoxes(p: SetPiecePlacement, def: SetPieceDefinition): WorldBox[] {
    const view = this.app.viewDoc;
    const parts = setPieceParts(p, def, view.classicStructure.theme, this.app.setPieceLib);
    const near = new Set<string>();
    for (const [x, y, z] of setPieceFootprint(p, def)) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) near.add(`${x + dx},${y + dy},${z}`);
    const neighbours = view.classicStructure.tiles.filter((t) => (placementCells(t) ?? []).some(([x, y, z]) => near.has(`${x},${y},${z}`)));
    const alone: MapDocument = { ...view, terrain: null, bounds: null, classicStructure: { ...view.classicStructure, tiles: [...parts.tiles, ...neighbours] }, entities: parts.entities.filter((e) => e.kind === 'block') };
    const mine = new Set([...parts.tiles.map((t) => t.id), ...parts.entities.map((e) => e.id)]);
    return buildMapGeometry(alone).filter((b) => mine.has(b.sourceId));
  }

  /** What blocks a port, in words (a tile's wall, a block, another set piece). */
  blockerName(sourceId: string): string {
    const placement = this.app.expansion.partOf.get(sourceId);
    if (placement) {
      const p = this.app.placementOf(placement);
      return `the ${(p && this.app.pieceDef(p.piece)?.displayName) ?? 'set piece'}`;
    }
    const tile = this.app.doc.classicStructure.tiles.find((t) => t.id === sourceId);
    if (tile) return `the ${coreCatalog.get(tile.tile)?.displayName ?? 'tile'}'s wall`;
    const e = this.app.doc.entities.find((x) => x.id === sourceId);
    if (e?.kind === 'block') return `a block (${(e.material && coreMaterials.get(e.material)?.displayName) ?? 'theme'}${e.name ? `, ${e.name}` : ''})`;
    return e ? entityLabel(this.app.doc, e) : 'something';
  }

  /** A port in words: "the door on the east side (Level 1)". */
  portName(s: { side: string; z: number; kind: string }): string {
    const side = ({ N: 'north', E: 'east', S: 'south', W: 'west' } as Record<string, string>)[s.side];
    return `the ${s.kind === 'door' ? 'door' : 'opening'} on the ${side} side (${levelName(s.z)})`;
  }

  /** A set piece in a few words (hover card, inspector): its size and levels, its look, its turn and mirror, its ports. */
  pieceLines(def: SetPieceDefinition, p: Pick<SetPiecePlacement, 'rotation' | 'mirror' | 'pack'>): string[] {
    const span = (i: 0 | 1) => Math.max(...def.footprint.cells.map((c) => c[i])) - Math.min(...def.footprint.cells.map((c) => c[i])) + 1;
    const levels = def.footprint.levels[1] - def.footprint.levels[0] + 1;
    const theme = this.app.doc.classicStructure.theme;
    const pack = placementPack(p, theme, this.app.setPieceLib);
    const look = pack ? `${pack.displayName}${p.pack ? '' : " (the map theme's)"}` : `${coreThemes.get(theme)?.displayName ?? theme} (theme)`;
    return [`${span(0)} × ${span(1)} cells · ${levels} level${levels === 1 ? '' : 's'}`, `Look: ${look}`, `Turned ${p.rotation * 90}°${p.mirror ? ' · mirrored' : ''} · ${def.ports.length} port${def.ports.length === 1 ? '' : 's'}`];
  }

  /** The look a set piece is placed in: the tool's (a role pack), or none (the map theme's). */
  lookFor(): string {
    return this.pieceLook && this.app.setPieceLib.packs.has(this.pieceLook) ? this.pieceLook : '';
  }

  /** Place a set piece as one, at anchor cell (x, y) on level z, turned (R), mirrored (M) and in the tool's look. */
  placeSetPiece(piece: string, x: number, y: number, z: number): void {
    const def = this.app.pieceDef(piece);
    if (!def) return this.app.toast(`Unknown set piece ${piece}`, true);
    const look = this.lookFor();
    const r = placeSetPieceCommand(this.app.doc, piece, x, y, z, this.app.rotation, { mirror: this.app.pieceMirror, ...(look ? { pack: look } : {}), library: this.app.placeLib });
    if ('error' in r) return this.app.toast(`Can't place ${def.displayName}: ${r.error}`, true);
    // A piece of the player's own goes into the map with it: the map carries its definition, so it plays anywhere.
    const own = this.myPieces.get(piece);
    const inMap = this.app.doc.setPieceDefs?.find((d) => d.id === piece);
    const defCmd = own && JSON.stringify(inMap ?? null) !== JSON.stringify(own) ? addSetPieceDefCommand(this.app.doc, own) : null;
    if (defCmd && 'error' in defCmd) return this.app.toast(defCmd.error, true);
    if (this.app.run(`Place ${def.displayName}`, defCmd ? { kind: 'batch', commands: [defCmd, r.command] } : r.command)) {
      this.app.setSelection({ tiles: [], entities: [], setPieces: [r.placement.id] });
      if (inMap && defCmd) this.app.toast(`Placed ${def.displayName}; this map's copy of it now matches your library's`);
    }
  }

  /** Explode to tiles: the placement becomes its parts, ordinary pieces to edit (one undo step), and they are selected. */
  explode(id: string): void {
    const p = this.app.placementOf(id);
    const name = (p && this.app.pieceDef(p.piece)?.displayName) ?? 'set piece';
    const r = explodeSetPieceCommand(this.app.doc, id);
    if ('error' in r) return this.app.toast(`Can't explode: ${r.error}`, true);
    if (!this.app.run(`Explode ${name}`, r.command)) return;
    this.app.setSelection(r.selection);
    this.app.toast(`${name} exploded into ${r.selection.tiles.length + r.selection.entities.length} ordinary parts · Ctrl+Z puts it back`);
  }

  /**
   * The set piece tool's ghost: the whole piece at the hovered cell in its look, its footprint and ports outlined green
   * where it fits and red where it doesn't (the hover card and status line say why: checkSetPiecePlacement), and any
   * port a wall stands in red.
   */
  updatePieceGhost(): void {
    const t = this.app.tool;
    const cell = this.app.hoverCell;
    const def = t.kind === 'setpiece' ? this.app.pieceDef(t.piece) : undefined;
    if (this.app.looking || !cell || !def || t.kind !== 'setpiece') {
      this.app.pieceHover = null;
      this.app.view.setPieceGhost(this.app.doc, null, () => ({ tiles: [], entities: [] }), null, true, null);
      return;
    }
    const look = this.lookFor();
    const placement: SetPiecePlacement = { id: 'ghost_piece', piece: t.piece, x: cell[0], y: cell[1], z: this.app.level, rotation: this.app.rotation, mirror: this.app.pieceMirror, ...(look ? { pack: look } : {}) };
    const check = checkSetPiecePlacement(this.app.doc, [placement], [], coreCatalog, this.app.placeLib);
    // Its ports against the map, and against its own walls as they'd be built here (worked out once per cell).
    const at = `${t.piece}:${this.app.rotation}:${this.app.pieceMirror}:${cell.join(',')}:${this.app.history.revision}:${this.myPiecesRev}`;
    if (this.ghostPorts?.at !== at) this.ghostPorts = { at, states: setPiecePortStates(placement, def, [...this.app.mapBoxes(), ...this.ownBoxes(placement, def)]) };
    const ports = this.ghostPorts.states;
    this.app.pieceHover = { def, placement, ok: check.ok, reason: check.ok ? '' : check.reason, short: check.ok ? '' : check.short, blocked: ports.filter((s) => s.blockedBy).length };
    const theme = this.app.doc.classicStructure.theme;
    // Built once per piece, turn, mirror and look (at the grid's origin) and moved with the pointer.
    const key = `${t.piece}:${this.app.rotation}:${this.app.pieceMirror}:${look}:${theme}:${this.myPiecesRev}`;
    const atOrigin = { ...placement, x: 0, y: 0, z: 0 };
    this.app.view.setPieceGhost(this.app.doc, key, () => setPieceParts(atOrigin, def, theme, this.app.setPieceLib), [cell[0], cell[1], this.app.level], check.ok, {
      cells: setPieceFootprint(placement, def),
      ports: ports.map((s) => ({ x: s.x, y: s.y, z: s.z, side: s.side, kind: s.kind, closed: s.closed, blocked: !!s.blockedBy })),
    });
  }

  /** The ghost's ports, and the cell, turn and document version they were worked out for. */
  ghostPorts: { at: string; states: ReturnType<typeof setPiecePortStates> } | null = null;

  // ---------------------------------------------------------------- set pieces: the palette tab and your library

  /** "My set pieces": the grid, the palette keys of its cards, and what it was drawn for. */
  mineGrid?: HTMLElement;
  mineKeys: string[] = [];
  mineKey = '';

  /**
   * The Set pieces tab: a panel for the piece being placed (its look, turn and mirror; your own piece's Export and
   * Delete), the shipped pieces by family (their pictures from the palette atlas), then your own (this browser's
   * library) and the map's own, with Save selection as set piece and Import.
   */
  buildSetPiecePalette(): void {
    const pane = $('ed-setpieces');
    const info = document.createElement('div');
    info.id = 'ed-sp-info';
    info.className = 'ed-sp-info';
    pane.append(info);
    const families = new Map<string, SetPieceDefinition[]>();
    for (const def of this.app.setPieceLib.pieces.values()) families.set(def.family, [...(families.get(def.family) ?? []), def]);
    const order = [...families].sort(([a], [b]) => setPieceFamilyOrder(a) - setPieceFamilyOrder(b) || (a < b ? -1 : a > b ? 1 : 0));
    order.forEach(([family, defs], i) => {
      const grid = this.app.palette.group(pane, `setpieces:${family}`, setPieceFamilyLabel(family), { open: i < 2 });
      for (const def of defs) this.setPieceButton(grid, def);
    });
    this.mineGrid = this.app.palette.group(pane, 'setpieces:custom', setPieceFamilyLabel('custom'), {
      note: 'Your own pieces, kept in this browser next to your maps. Make one: drag a box over tiles, blocks and props with Select (on empty ground), then Save as set piece…',
    });
    const actions = document.createElement('div');
    actions.className = 'ed-row ed-sp-actions';
    const save = button('Save selection as set piece…', () => this.saveSelectionDialog());
    save.id = 'ed-sp-save';
    save.title = 'Make a set piece of what is selected (tiles, blocks, props, doors, ladders and lights), for your library';
    save.disabled = true;
    const imp = button('Import…', () => $('ed-sp-import-file').click());
    imp.id = 'ed-sp-import';
    imp.title = 'Add set pieces from a file someone exported (a .setpiece.json file): checked before they go in';
    actions.append(save, imp);
    this.mineGrid.after(actions);
    $<HTMLInputElement>('ed-sp-import-file').addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = '';
      if (file) void this.importSetPieces(file);
    });
    this.loadMyPieces();
    this.renderPieceInfo();
  }

  /** A set piece's card: its picture (the palette atlas; runtime for your own), its name, what it is on hover. */
  setPieceButton(grid: HTMLElement, def: SetPieceDefinition, where: 'shipped' | 'mine' | 'map' = 'shipped'): HTMLElement {
    const b = document.createElement('button');
    b.className = 'tile-btn sp-btn';
    b.dataset.tool = `setpiece:${def.id}`;
    const span = (i: 0 | 1) => Math.max(...def.footprint.cells.map((c) => c[i])) - Math.min(...def.footprint.cells.map((c) => c[i])) + 1;
    const levels = def.footprint.levels[1] - def.footprint.levels[0] + 1;
    const looks = def.packs.map((id) => this.app.setPieceLib.packs.get(id)?.displayName ?? id);
    const whose = where === 'mine' ? '\nYours (this browser)' : where === 'map' ? "\nThis map's own (not in your library)" : '';
    b.title = `${def.displayName}\n${def.blurb ?? ''}\n${span(0)} × ${span(1)} cells · ${levels} level${levels === 1 ? '' : 's'} · ${def.ports.length} ports${def.mirror === 'none' ? ' · turns, no mirror' : ''}${looks.length ? `\nLooks: ${looks.join(', ')}` : ''}${whose}`.replace(/\n+/g, '\n').trim();
    b.append(document.createTextNode(def.displayName));
    b.addEventListener('click', () => this.app.setTool({ kind: 'setpiece', piece: def.id }));
    grid.append(b);
    this.app.palette.register(b, {
      key: b.dataset.tool,
      name: def.displayName,
      tags: `set piece setpiece ${def.family} ${def.category} ${def.blurb ?? ''} ${looks.join(' ')} ${where === 'shipped' ? '' : 'my own custom saved'}`,
      picture: true,
    });
    return b;
  }

  /** Read the player's library (storage.ts) and redraw "My set pieces". */
  loadMyPieces(): void {
    this.myPieces = new Map(listSetPieces().map((s) => [s.def.id, s.def]));
    this.myPiecesRev++;
    this.renderMyPieces(true);
  }

  /** "My set pieces": your library, then the map's own pieces that aren't in it (they came with the map). */
  renderMyPieces(force = false): void {
    const grid = this.mineGrid;
    if (!grid) return;
    const inMap = (this.app.doc.setPieceDefs ?? []).filter((d) => !this.myPieces.has(d.id));
    const key = `${this.myPiecesRev}|${inMap.map((d) => `${d.id}:${JSON.stringify(d).length}`).join(',')}`;
    if (!force && key === this.mineKey) return;
    this.mineKey = key;
    for (const k of this.mineKeys) this.app.palette.unregister(k);
    grid.replaceChildren();
    this.mineKeys = [...this.myPieces.values()].map((def) => this.setPieceButton(grid, def, 'mine').dataset.key!);
    for (const def of inMap) {
      const b = this.setPieceButton(grid, def, 'map');
      b.classList.add('in-map');
      this.mineKeys.push(b.dataset.key!);
    }
    for (const b of grid.querySelectorAll<HTMLElement>('[data-tool]')) b.classList.toggle('active', this.app.tool.kind === 'setpiece' && b.dataset.tool === `setpiece:${this.app.tool.piece}`);
    this.app.palette.refresh();
    if (this.app.palettes.stylePack) this.app.palettes.filterPalette();
  }

  /** A look picker: the map theme's, the looks the piece suits, then every other look. */
  lookSelect(def: SetPieceDefinition, value: string, onChange: (v: string) => void): HTMLSelectElement {
    const sel = document.createElement('select');
    const theme = this.app.doc.classicStructure.theme;
    const themed = placementPack({}, theme, this.app.setPieceLib);
    sel.append(new Option(`Map theme's (${themed?.displayName ?? coreThemes.get(theme)?.displayName ?? theme})`, '', false, !value));
    const suits = document.createElement('optgroup');
    suits.label = 'Made for it';
    const others = document.createElement('optgroup');
    others.label = 'Other looks';
    for (const pack of this.app.setPieceLib.packs.values()) (def.packs.includes(pack.id) ? suits : others).append(new Option(pack.displayName, pack.id, false, pack.id === value));
    if (suits.children.length) sel.append(suits);
    sel.append(others);
    sel.title = "The look (role pack) that themes it: the stone, trim, floors, roofs, facade, doors and glass it's built in";
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  }

  /** The panel over the Set pieces tab: the piece being placed, its look, turn and mirror; your own piece's actions. */
  renderPieceInfo(): void {
    const el = document.getElementById('ed-sp-info');
    if (!el) return;
    el.replaceChildren();
    const t = this.app.tool;
    const def = t.kind === 'setpiece' ? this.app.pieceDef(t.piece) : undefined;
    if (!def) {
      el.append(small('Pick a set piece, then click the map: a ghost of the whole piece shows where it goes, green where it fits, red (and why) where not. R turns it, M mirrors it.'));
      return;
    }
    const head = document.createElement('div');
    head.className = 'ed-sp-head';
    head.innerHTML = '<b></b><small></small>';
    head.querySelector('b')!.textContent = def.displayName;
    head.querySelector('small')!.textContent = `${setPieceFamilyLabel(def.family)} · ${def.category}`;
    el.append(head);
    const look = this.lookFor();
    for (const l of this.pieceLines(def, { rotation: this.app.rotation, mirror: this.app.pieceMirror, ...(look ? { pack: look } : {}) })) el.append(small(l));
    const lookSel = this.lookSelect(def, look, (v) => {
      this.pieceLook = v;
      this.renderPieceInfo();
      this.app.hover.updateHover();
    });
    lookSel.id = 'ed-sp-look';
    el.append(row('Look', lookSel));
    const turn = button(`Turn (R) · ${this.app.rotation * 90}°`, () => this.app.edits.rotate());
    turn.id = 'ed-sp-turn';
    const mirror = button(this.app.pieceMirror ? 'Mirrored (M)' : 'Mirror (M)', () => this.app.edits.mirror());
    mirror.id = 'ed-sp-mirror';
    const why = setPieceMirrorRefusal(def);
    mirror.disabled = !!why;
    mirror.classList.toggle('on', this.app.pieceMirror);
    mirror.setAttribute('aria-pressed', String(this.app.pieceMirror));
    mirror.title = why ?? 'Mirror it: east and west swapped, over the same cells (M)';
    const bar = document.createElement('div');
    bar.className = 'buttons';
    bar.append(turn, mirror);
    el.append(bar);
    if (why) {
      const note = small(why);
      note.id = 'ed-sp-mirror-why';
      el.append(note);
    }
    const mine = this.myPieces.has(def.id);
    if (def.id.startsWith('local.')) {
      const acts = document.createElement('div');
      acts.className = 'buttons';
      const exp = button('Export…', () => exportSetPiece(def));
      exp.id = 'ed-sp-export';
      exp.title = 'Download it as a .setpiece.json file (Import adds it in another browser)';
      acts.append(exp);
      if (mine) {
        const del = button('Delete from my pieces', () => {
          if (!confirm(`Delete "${def.displayName}" from your set pieces in this browser? Maps that place it keep their copy.`)) return;
          deleteSetPiece(def.id);
          this.loadMyPieces();
          if (!this.app.pieceDef(def.id)) this.app.setTool({ kind: 'select' });
          this.app.toast(`Deleted "${def.displayName}" from your set pieces`);
        });
        del.id = 'ed-sp-delete';
        acts.append(del);
      } else {
        const keep = button('Save to my pieces', () => {
          if (!saveSetPiece(def)) return this.app.toast('Could not save to browser storage: Export it to keep a copy', true);
          this.loadMyPieces();
          this.app.toast(`"${def.displayName}" is in your set pieces now`);
        });
        keep.id = 'ed-sp-keep';
        acts.append(keep);
      }
      el.append(acts);
      // The owner ships a piece the way official maps are files: a family file for content/setpieces/.
      const official = document.createElement('div');
      official.className = 'ed-row ed-owner-only';
      official.hidden = !this.app.owner;
      const family = document.createElement('input');
      family.id = 'ed-sp-family';
      family.value = def.family;
      family.title = 'The family file it goes in: content/setpieces/<family>.json';
      family.maxLength = 32;
      const ship = button('Export for content/setpieces/', () => {
        const f = family.value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_') || 'custom';
        exportSetPiece(def, { family: f });
        this.app.toast(`Exported ${f}.json: put it (or its piece) in content/setpieces/, then run pnpm content:rebuild (docs/CONTENT_PIPELINE.md, "Set pieces")`);
      });
      ship.id = 'ed-sp-export-official';
      official.append(family, ship);
      el.append(official);
    }
  }

  /** Add set pieces from a file (Import): each checked first; one naming tiles, props or materials the game hasn't got is refused. */
  async importSetPieces(file: File): Promise<void> {
    const r = await importSetPieceFile(file);
    const problems = [...r.problems];
    let saved = 0;
    for (const def of r.defs) {
      const found = checkSetPieceDefinition(def, { packs: this.app.setPieceLib.packs });
      const missing = found.filter((p) => / is not a /.test(p));
      if (missing.length) {
        problems.push(`${def.displayName}: ${missing[0]}`);
        continue;
      }
      if (saveSetPiece(def)) saved++;
      else problems.push(`${def.displayName}: browser storage refused it`);
    }
    this.loadMyPieces();
    if (saved) this.app.toast(`Imported ${saved} set piece${saved === 1 ? '' : 's'} into My set pieces${problems.length ? ` (${problems.length} refused: ${problems[0]})` : ''}`);
    else this.app.toast(`Import failed: ${problems[0] ?? 'no set pieces in the file'}`, true);
  }

  /** The cell a piece saved from a selection is anchored at: the selection's south-west corner, on its lowest level. */
  selectionAnchor(sel: Selection): [number, number, number] {
    const { cellSize, levelHeight } = this.app.doc.classicStructure;
    const cells: (readonly number[])[] = [];
    for (const t of this.app.doc.classicStructure.tiles) if (sel.tiles.includes(t.id)) cells.push(...(placementCells(t) ?? []));
    for (const id of sel.setPieces ?? []) cells.push(...(this.app.expansion.footprints.get(id) ?? []));
    for (const e of this.app.doc.entities) if (sel.entities.includes(e.id)) cells.push([Math.round(e.position[0] / cellSize), Math.round(e.position[2] / cellSize), Math.floor((e.position[1] + 0.01) / levelHeight)]);
    if (!cells.length) return [0, 0, this.app.level];
    return [Math.min(...cells.map((c) => c[0]!)), Math.min(...cells.map((c) => c[1]!)), Math.min(...cells.map((c) => c[2]!))];
  }

  /** `local.<name>` free in your library and the map (a name taken already gets _2, _3…). */
  freeLocalId(id: string): string {
    const taken = (x: string) => this.myPieces.has(x) || !!this.app.doc.setPieceDefs?.some((d) => d.id === x);
    if (!taken(id)) return id;
    const name = id.slice('local.'.length);
    for (let i = 2; ; i++) {
      const next = `local.${name.slice(0, 40 - String(i).length - 1)}_${i}`;
      if (!taken(next)) return next;
    }
  }

  /**
   * Save selection as set piece: the selected tiles, blocks, props, doors, ladders and lights (set pieces as their
   * parts) become a piece (setPieceFromSelection: footprint, ports, mirror, materials as roles where a look matches),
   * named here, kept in your library (this browser) and placeable in any map.
   */
  saveSelectionDialog(): void {
    if (!this.app.selCount()) return this.app.toast('Select what the piece is made of first: drag a box over it with Select (on empty ground), Shift+click adds', true);
    const leftOut = this.app.doc.entities.filter((e) => this.app.selection.entities.includes(e.id) && !PIECE_PART_KINDS.has(e.kind));
    const sel: Selection = { tiles: this.app.selection.tiles, entities: this.app.selection.entities.filter((id) => !leftOut.some((e) => e.id === id)), ...(this.app.selPieces().length ? { setPieces: this.app.selPieces() } : {}) };
    const anchor = this.selectionAnchor(sel);
    const dialog = $<HTMLDialogElement>('ed-sp-save-dialog');
    const name = $<HTMLInputElement>('ed-sp-save-name');
    const summary = $('ed-sp-save-summary');
    const problems = $('ed-sp-save-problems');
    const ok = $<HTMLButtonElement>('ed-sp-save-ok');
    if (!name.value.trim()) name.value = 'My set piece';
    const make = () => setPieceFromSelection(this.app.doc, sel, anchor, { displayName: name.value.trim() || 'My set piece', library: this.app.placeLib });
    const show = () => {
      const r = make();
      problems.replaceChildren();
      if ('error' in r) {
        summary.textContent = '';
        const li = document.createElement('li');
        li.className = 'error';
        li.textContent = r.error;
        problems.append(li);
        ok.disabled = true;
        return;
      }
      const d = r.definition;
      const count = (k: string) => d.parts.filter((p) => p.kind === k).length;
      const parts = (['tile', 'block', 'prop', 'door', 'ladder', 'light'] as const).map((k) => [k, count(k)] as const).filter(([, n]) => n).map(([k, n]) => `${n} ${k}${n === 1 ? '' : 's'}`);
      const span = (i: 0 | 1) => Math.max(...d.footprint.cells.map((c) => c[i])) - Math.min(...d.footprint.cells.map((c) => c[i])) + 1;
      const look = r.pack ? (this.app.setPieceLib.packs.get(r.pack)?.displayName ?? r.pack) : null;
      summary.textContent = `${parts.join(', ')} · ${span(0)} × ${span(1)} cells, ${d.footprint.levels[1] - d.footprint.levels[0] + 1} level(s) · ${d.ports.length} ports · ${d.mirror === 'free' ? 'mirrors' : 'turns only'}${look ? ` · materials of the ${look} look become roles, so it re-themes` : ' · its materials stay as they are'}${leftOut.length ? ` · left out: ${[...new Set(leftOut.map((e) => e.kind))].join(', ')} (a set piece holds tiles, blocks, props, doors, ladders and lights)` : ''}`;
      for (const p of r.problems.slice(0, 6)) {
        const li = document.createElement('li');
        li.className = 'warning';
        li.textContent = p;
        problems.append(li);
      }
      ok.disabled = false;
    };
    name.oninput = show;
    show();
    ok.onclick = () => {
      const r = make();
      if ('error' in r) return;
      const def = { ...r.definition, id: this.freeLocalId(r.definition.id) };
      if (!saveSetPiece(def)) return this.app.toast('Could not save to browser storage: free some space, or Export your maps', true);
      dialog.close();
      this.loadMyPieces();
      this.app.showPane('setpieces');
      const card = document.querySelector<HTMLElement>(`#ed-setpieces [data-tool="${CSS.escape(`setpiece:${def.id}`)}"]`);
      if (card) this.app.palette.reveal(card);
      this.app.toast(`Saved "${def.displayName}" to My set pieces: pick it there to place it in any map`);
    };
    $('ed-sp-save-cancel').onclick = () => dialog.close();
    dialog.showModal();
    name.select();
  }

  /** The inspector for one set piece: what it is, its look, mirror, place and turn, its ports, the overrides, Explode. */
  pieceInspector(el: HTMLElement, id: string): void {
    const p = this.app.placementOf(id)!;
    const def = this.app.pieceDef(p.piece);
    el.append(h2(def?.displayName ?? p.piece));
    if (!def) {
      el.append(small(`This map places a set piece MapMaker doesn't know (${p.piece}): it can't be drawn or played. Delete it.`));
      return;
    }
    if (def.blurb) el.append(small(def.blurb));
    const update = (label: string, after: SetPiecePlacement) => this.app.run(label, updateSetPieceCommand(this.app.doc, p, after, coreCatalog, this.app.placeLib));
    el.append(row('Piece', text(`${setPieceFamilyLabel(def.family)} · ${def.id.startsWith('local.') ? 'your own' : 'shipped'}`)));
    const look = this.lookSelect(def, p.pack ?? '', (v) => {
      const { pack: _old, ...rest } = p;
      void _old;
      update('Set piece look', v ? { ...rest, pack: v } : rest);
    });
    look.id = 'ed-sp-insp-look';
    el.append(row('Look', look));
    const mirror = document.createElement('input');
    mirror.type = 'checkbox';
    mirror.id = 'ed-sp-insp-mirror';
    mirror.checked = p.mirror;
    const why = setPieceMirrorRefusal(def);
    mirror.disabled = !!why && !p.mirror;
    mirror.title = why ?? 'East and west swapped, over the same cells (M)';
    mirror.addEventListener('change', () => this.app.run('Mirror', mirrorSetPieceCommand(this.app.doc, p.id, coreCatalog, this.app.placeLib)));
    el.append(row('Mirror', mirror));
    if (why) el.append(small(why));
    el.append(
      row('X', numberInput(p.x, 1, (v) => update('Move set piece', { ...p, x: v }))),
      row('Y', numberInput(p.y, 1, (v) => update('Move set piece', { ...p, y: v }))),
      row('Level', numberInput(p.z, 1, (v) => update('Move set piece', { ...p, z: v }))),
      row('Rotation', text(`${p.rotation * 90}° (R turns it)`)),
      this.app.inspector.quickFacings({ tiles: [], entities: [], setPieces: [p.id] }, (p.rotation * Math.PI) / 2),
    );
    // Ports: where it meets what's round it; one a wall stands in is a warning (and red on its outline).
    const states = setPiecePortStates(p, def, this.app.mapBoxes());
    const portsHead = document.createElement('h3');
    portsHead.textContent = `Ports (${states.length})`;
    el.append(portsHead);
    const list = document.createElement('ul');
    list.className = 'ed-sp-ports';
    for (const s of states) {
      const li = document.createElement('li');
      li.className = s.blockedBy ? 'warning' : s.closed ? 'closed' : 'ok';
      const name = this.portName(s);
      const Name = `${name[0]!.toUpperCase()}${name.slice(1)}`;
      li.textContent = s.blockedBy
        ? `⚠ ${Name} faces a wall: ${this.blockerName(s.blockedBy)}. Open it (Walls tool, or cut the block), or move the piece`
        : s.closed
          ? `${Name}: walled (nothing meets it; a room built against it with a doorway opens it)`
          : `${Name}: clear`;
      list.append(li);
    }
    if (states.length) el.append(list);
    else el.append(small('No ports: it meets nothing round it.'));
    // Overrides: a role's value for this piece only, and parts left out.
    const roles = rolesUsed(def);
    if (roles.length) {
      const head = document.createElement('h3');
      head.textContent = 'Materials';
      el.append(head, small("Each comes from its look; pick another here for this piece only."));
      for (const role of roles) el.append(row(ROLE_LABELS[role], this.roleSelect(p, def, role, update)));
    }
    const partsHead = document.createElement('h3');
    partsHead.textContent = `Parts (${def.parts.length})`;
    el.append(partsHead, small('Untick a part to leave it out of this piece only. Explode to tiles to edit the parts one by one.'));
    const hidden = new Set(p.overrides?.hide ?? []);
    const parts = document.createElement('div');
    parts.className = 'ed-sp-parts';
    def.parts.forEach((part, i) => {
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = !hidden.has(i);
      box.dataset.part = String(i);
      box.addEventListener('change', () => {
        const hide = new Set(p.overrides?.hide ?? []);
        if (box.checked) hide.delete(i);
        else hide.add(i);
        const overrides = { ...(p.overrides ?? {}), hide: [...hide].sort((a, b) => a - b) };
        if (!overrides.hide.length) delete (overrides as { hide?: number[] }).hide;
        const { overrides: _old, ...rest } = p;
        void _old;
        update(box.checked ? 'Show set piece part' : 'Hide set piece part', Object.keys(overrides).length ? { ...rest, overrides } : rest);
      });
      const lab = document.createElement('label');
      lab.append(box, document.createTextNode(this.partLabel(part)));
      parts.append(lab);
    });
    el.append(parts);
    const acts = document.createElement('div');
    acts.className = 'buttons';
    const explode = button('Explode to tiles', () => this.explode(p.id));
    explode.id = 'ed-sp-explode';
    explode.title = 'Turn it into its parts: ordinary tiles, blocks and props to edit one by one (one undo step puts the set piece back)';
    const saveAs = button('Save as set piece…', () => this.saveSelectionDialog());
    saveAs.title = 'Save a copy of it (with its look and overrides) in your set pieces';
    acts.append(explode, saveAs);
    el.append(acts);
    el.append(small(`ID ${p.id} · ${def.id}`));
  }

  /** A role's value for one placement: the look's (the default), or one of the game's materials, facades, door styles or glass. */
  roleSelect(p: SetPiecePlacement, def: SetPieceDefinition, role: SetPieceRole, update: (label: string, after: SetPiecePlacement) => void): HTMLSelectElement {
    const sel = document.createElement('select');
    sel.dataset.role = role;
    const pack = placementPack(p, this.app.doc.classicStructure.theme, this.app.setPieceLib);
    const fromLook = pack?.roles[role] ?? def.roles?.[role];
    const label = (v: unknown): string => {
      if (v && typeof v === 'object' && 'material' in v) return coreMaterials.get((v as SurfaceStyle).material)?.displayName ?? (v as SurfaceStyle).material;
      if (typeof v === 'string') return role === 'facade' ? (FACADE_LABELS[v as keyof typeof FACADE_LABELS] ?? v) : role === 'door' ? (DOOR_STYLE_LABELS[v as DoorStyle] ?? v) : role === 'glass' ? (v === 'none' ? 'No glass' : (GLASS_KIND_LABELS[v as GlassKind] ?? v)) : v;
      return "the theme's";
    };
    const now = p.overrides?.roles?.[role];
    sel.append(new Option(`From the look (${label(fromLook)})`, '', false, now === undefined));
    const nowKey = now === undefined ? '' : typeof now === 'object' ? (now as SurfaceStyle).material : String(now);
    if ((SET_PIECE_MATERIAL_ROLES as readonly string[]).includes(role)) {
      let group: HTMLOptGroupElement | null = null;
      for (const m of coreMaterials.all()) {
        if (group?.label !== m.category) {
          group = document.createElement('optgroup');
          group.label = m.category;
          sel.append(group);
        }
        group.append(new Option(m.displayName, m.id, false, m.id === nowKey));
      }
    } else {
      const values: readonly string[] = role === 'facade' ? FACADES : role === 'door' ? DOOR_STYLES : [...GLASS_KINDS, 'none'];
      for (const v of values) sel.append(new Option(label(v), v, false, v === nowKey));
    }
    sel.addEventListener('change', () => {
      const roles: Record<string, unknown> = { ...(p.overrides?.roles ?? {}) };
      if (!sel.value) delete roles[role];
      else roles[role] = (SET_PIECE_MATERIAL_ROLES as readonly string[]).includes(role) ? { material: sel.value, tint: null } : sel.value;
      const overrides: NonNullable<SetPiecePlacement['overrides']> = { ...(p.overrides ?? {}) };
      if (Object.keys(roles).length) overrides.roles = roles as NonNullable<SetPiecePlacement['overrides']>['roles'];
      else delete overrides.roles;
      const { overrides: _old, ...rest } = p;
      void _old;
      update(`Set piece ${ROLE_LABELS[role].toLowerCase()}`, Object.keys(overrides).length ? { ...rest, overrides } : rest);
    });
    return sel;
  }

  /** One of a set piece's parts, in words (the inspector's parts list). */
  partLabel(part: SetPieceDefinition['parts'][number]): string {
    switch (part.kind) {
      case 'tile':
        return `${coreCatalog.get(part.tile)?.displayName ?? part.tile} · ${levelName(part.z)}`;
      case 'block':
        return `Block ${part.size.map((v) => +v.toFixed(2)).join(' × ')} m`;
      case 'prop':
        return getProp(part.model)?.displayName ?? part.model;
      case 'door':
        return 'Door';
      case 'ladder':
        return 'Ladder';
      default:
        return 'Light';
    }
  }
}
