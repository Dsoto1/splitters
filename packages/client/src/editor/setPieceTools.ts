import {
  addSetPieceDefCommand,
  applyCommand,
  applyLookCommand,
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
  isMyLook,
  lookAsPack,
  lookIdFor,
  lookUses,
  renameLookCommand,
  saveLookCommand,
  GLASS_KIND_LABELS,
  GLASS_KINDS,
  levelName,
  mirrorSetPieceCommand,
  placementCells,
  placementPack,
  placementOptions,
  partInPlay,
  placeSetPieceCommand,
  replaceTilesWithSetPieceCommand,
  SET_PIECE_MATERIAL_ROLES,
  roleTakesGround,
  setPieceFootprint,
  setPieceFromSelection,
  setPieceMirrorRefusal,
  setPieceParts,
  setPiecePortStates,
  updateSetPieceCommand,
  withMapLooks,
  type DoorStyle,
  type GlassKind,
  type MapDocument,
  type Selection,
  type SetPieceDefinition,
  type SetPieceLibrary,
  type SetPieceLookDef,
  type SetPiecePlacement,
  type SetPieceRolePack,
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
  setPieceFamilyOrder,
  themeStylePacks
} from './paletteCatalog.ts';
import {
  deleteLook,
  deleteSetPiece,
  exportSetPiece,
  importSetPieceFile,
  listLooks,
  listSetPieces,
  renameLook,
  saveLook,
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

  /** Your own looks (your library in this browser, storage.ts; painting Phase 5), by id; `myLooksRev` counts changes. */
  myLooks = new Map<string, SetPieceLookDef>();
  myLooksRev = 0;

  /** The looks the map's pieces are drawn in: the shipped role packs and the map's own looks (`lookDefs`). */
  get lookLib(): SetPieceLibrary {
    return withMapLooks(this.app.doc, this.app.setPieceLib);
  }

  /**
   * The looks MapMaker offers: the shipped ones, your library's (as you saved them: a piece put in one carries that
   * copy into the map) and the map's own that aren't in your library.
   */
  get pickLib(): SetPieceLibrary {
    const looks = this.app.doc.lookDefs;
    if (this.pickLibCache?.rev !== this.myLooksRev || this.pickLibCache.looks !== looks) {
      const packs = new Map<string, SetPieceRolePack>(this.app.setPieceLib.packs);
      for (const l of this.myLooks.values()) if (!packs.has(l.id)) packs.set(l.id, lookAsPack(l));
      for (const l of looks ?? []) if (!packs.has(l.id)) packs.set(l.id, lookAsPack(l));
      this.pickLibCache = { rev: this.myLooksRev, looks, lib: { pieces: this.app.setPieceLib.pieces, packs } };
    }
    return this.pickLibCache.lib;
  }
  pickLibCache: { rev: number; looks: readonly SetPieceLookDef[] | undefined; lib: SetPieceLibrary } | null = null;

  /** A look of yours by id: your library's copy, else the map's. */
  myLook(id: string): SetPieceLookDef | undefined {
    return this.myLooks.get(id) ?? this.app.doc.lookDefs?.find((l) => l.id === id);
  }

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
    const parts = setPieceParts(p, def, view.classicStructure.theme, this.pickLib);
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
    const pack = placementPack(p, theme, this.pickLib);
    const look = pack ? `${pack.displayName}${p.pack ? (isMyLook(p.pack) ? ' (your look)' : '') : " (the map theme's)"}` : `${coreThemes.get(theme)?.displayName ?? theme} (theme)`;
    return [`${span(0)} × ${span(1)} cells · ${levels} level${levels === 1 ? '' : 's'}`, `Look: ${look}`, `Turned ${p.rotation * 90}°${p.mirror ? ' · mirrored' : ''} · ${def.ports.length} port${def.ports.length === 1 ? '' : 's'}`];
  }

  /** The look a set piece is placed in: the tool's (a role pack), or none (the map theme's). */
  lookFor(): string {
    return this.pieceLook && this.pickLib.packs.has(this.pieceLook) ? this.pieceLook : '';
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
    // A look of your own goes into the map with it (your library's copy), as the piece's definition does.
    const lookCmd = isMyLook(look) ? applyLookCommand(applyCommand(this.app.doc, r.command), [r.placement.id], look, { look: this.myLooks.get(look), library: this.app.setPieceLib }) : null;
    if (lookCmd && 'error' in lookCmd) return this.app.toast(lookCmd.error, true);
    const commands = [...(defCmd ? [defCmd] : []), r.command, ...(lookCmd ? [lookCmd] : [])];
    if (this.app.run(`Place ${def.displayName}`, commands.length > 1 ? { kind: 'batch', commands } : r.command)) {
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
    const key = `${t.piece}:${this.app.rotation}:${this.app.pieceMirror}:${look}:${theme}:${this.myPiecesRev}:${this.myLooksRev}`;
    const atOrigin = { ...placement, x: 0, y: 0, z: 0 };
    this.app.view.setPieceGhost(this.app.doc, key, () => setPieceParts(atOrigin, def, theme, this.pickLib), [cell[0], cell[1], this.app.level], check.ok, {
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
    this.looksGrid = this.app.palette.group(pane, 'setpieces:looks', 'My looks', {
      grid: 'ed-look-list',
      note: "Looks you saved (Save as my look… in a set piece's inspector), kept in this browser. Apply puts the selected set pieces in one; maps carry the looks their pieces wear.",
    });
    this.looksGrid.id = 'ed-my-looks';
    $<HTMLInputElement>('ed-sp-import-file').addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = '';
      if (file) void this.importSetPieces(file);
    });
    this.loadMyPieces();
    this.loadMyLooks();
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
    this.renderMyLooks();
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

  /**
   * A look picker (painting plan, "Saved looks"): the map theme's, then three groups: This map's themes (the looks of
   * the packs that use the map's Structure theme), My looks (your library's and the map's own), All looks (the rest,
   * those made for the piece first). `def` null: for several pieces at once ('' value: the map theme's; `mixed`: they differ).
   */
  lookSelect(def: SetPieceDefinition | null, value: string, onChange: (v: string) => void, mixed = false): HTMLSelectElement {
    const sel = document.createElement('select');
    const theme = this.app.doc.classicStructure.theme;
    const lib = this.pickLib;
    const themed = placementPack({}, theme, lib);
    if (mixed) {
      const o = new Option('Mixed: pick one for all', '__mixed', true, true);
      o.disabled = true;
      sel.append(o);
    }
    sel.append(new Option(`Map theme's (${themed?.displayName ?? coreThemes.get(theme)?.displayName ?? theme})`, '', false, !mixed && !value));
    const group = (label: string, key: string, packs: SetPieceRolePack[]) => {
      if (!packs.length) return;
      const g = document.createElement('optgroup');
      g.label = label;
      g.dataset.group = key;
      for (const pack of packs) {
        const made = def?.packs.includes(pack.id) && !isMyLook(pack.id);
        g.append(new Option(`${pack.displayName}${made ? ' · made for it' : ''}`, pack.id, false, !mixed && pack.id === value));
      }
      sel.append(g);
    };
    const stylePacks = new Set(themeStylePacks(theme).map((p) => p.id));
    const all = [...lib.packs.values()];
    const mine = all.filter((p) => isMyLook(p.id));
    const ofTheme = all.filter((p) => !isMyLook(p.id) && (p.themes.includes(theme) || (!!p.stylePack && stylePacks.has(p.stylePack)) || stylePacks.has(p.id)));
    const rest = all.filter((p) => !isMyLook(p.id) && !ofTheme.includes(p));
    const madeFirst = (list: SetPieceRolePack[]) => (def ? [...list.filter((p) => def.packs.includes(p.id)), ...list.filter((p) => !def.packs.includes(p.id))] : list);
    group("This map's themes", 'themes', madeFirst(ofTheme));
    group('My looks', 'mine', mine);
    group('All looks', 'all', madeFirst(rest));
    sel.title = "The look that themes it: the stone, trim, floors, roofs, facade, doors and glass it's built in. Your paint sits on top of it";
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  }

  /** Several set pieces selected: one Look for them all (the inspector's, for a mixed selection). */
  multiLookRow(ids: readonly string[]): HTMLElement {
    const packs = new Set(ids.map((id) => this.app.placementOf(id)?.pack ?? ''));
    const only = packs.size === 1 ? [...packs][0]! : '';
    const sel = this.lookSelect(null, only, (v) => this.applyLook(ids, v), packs.size > 1);
    sel.id = 'ed-insp-pieces-look';
    sel.title = `The look of all ${ids.length} selected set pieces (their paint stays on top)`;
    return row('Look', sel);
  }

  /** Put placements in a look (the inspector's Look, My looks' Apply): one undo step; your look goes into the map with them. */
  applyLook(ids: readonly string[], pack: string): boolean {
    const look = isMyLook(pack) ? this.myLook(pack) : undefined;
    const r = applyLookCommand(this.app.doc, ids, pack, { look, library: this.app.setPieceLib });
    if ('error' in r) {
      this.app.toast(`Can't change the look: ${r.error}`, true);
      return false;
    }
    const inMap = this.app.doc.lookDefs?.find((l) => l.id === pack);
    const name = pack ? (this.pickLib.packs.get(pack)?.displayName ?? pack) : "the map theme's";
    if (!this.app.run(ids.length === 1 ? 'Set piece look' : `Look of ${ids.length} set pieces`, r)) return false;
    if (inMap && look && JSON.stringify(inMap) !== JSON.stringify(look)) this.app.toast(`${ids.length === 1 ? 'It wears' : `${ids.length} set pieces wear`} ${name}; this map's copy of it now matches your library's`);
    return true;
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
      this.renderMyLooks();
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

  // ---------------------------------------------------------------- looks of your own (painting Phase 5)

  /** The My looks list in the Set pieces tab, and what it was drawn for. */
  looksGrid?: HTMLElement;
  looksKey = '';

  /** Read your looks (storage.ts) and redraw My looks. */
  loadMyLooks(): void {
    this.myLooks = new Map(listLooks().map((s) => [s.look.id, s.look]));
    this.myLooksRev++;
    this.renderMyLooks(true);
  }

  /** A look's materials as little colour chips (stone, trim, floor…), for the lists and the dialog. */
  lookSwatches(roles: SetPieceLookDef['roles']): HTMLElement {
    const box = document.createElement('span');
    box.className = 'ed-look-sw';
    for (const role of SET_PIECE_MATERIAL_ROLES) {
      const v = roles[role];
      if (!v) continue;
      const m = coreMaterials.get(v.material);
      const chip = document.createElement('i');
      chip.style.background = v.tint ?? m?.base ?? '#888';
      chip.title = `${ROLE_LABELS[role]}: ${m?.displayName ?? v.material}`;
      box.append(chip);
    }
    if (!box.children.length) box.append(small("the theme's"));
    return box;
  }

  /**
   * My looks: your library's looks, then the map's own that aren't in it, each with how many pieces here wear it and
   * Apply (to the selected set pieces; with none selected, to the pieces you place next), Rename and Delete (or Save
   * to my looks, for one that came with the map).
   */
  renderMyLooks(force = false): void {
    const grid = this.looksGrid;
    if (!grid) return;
    const inMap = (this.app.doc.lookDefs ?? []).filter((l) => !this.myLooks.has(l.id));
    const sel = this.app.selPieces();
    const uses = [...this.myLooks.keys(), ...inMap.map((l) => l.id)].map((id) => `${id}:${lookUses(this.app.doc, id)}`).join(',');
    const key = `${this.myLooksRev}|${JSON.stringify(this.app.doc.lookDefs ?? null).length}|${inMap.map((l) => l.id).join(',')}|${uses}|${sel.length}|${this.pieceLook}`;
    if (!force && key === this.looksKey) return;
    this.looksKey = key;
    grid.replaceChildren();
    const list = [...[...this.myLooks.values()].map((look) => ({ look, mine: true })), ...inMap.map((look) => ({ look, mine: false }))];
    if (!list.length) grid.append(small('No looks yet. Select a set piece, paint it or pick its materials, then Save as my look… in its inspector.'));
    for (const { look, mine } of list) {
      const item = document.createElement('div');
      item.className = 'ed-look-item';
      item.dataset.look = look.id;
      const name = document.createElement('b');
      name.textContent = look.displayName;
      const n = lookUses(this.app.doc, look.id);
      const where = small(`${n ? `${n} here` : 'not used here'}${mine ? '' : " · this map's own (not in your library)"}${this.pieceLook === look.id ? ' · placing in it' : ''}`);
      const head = document.createElement('div');
      head.className = 'ed-look-head';
      head.append(this.lookSwatches(look.roles), name);
      const acts = document.createElement('div');
      acts.className = 'buttons';
      const apply = button(sel.length ? `Apply to ${sel.length === 1 ? 'selected piece' : `${sel.length} selected`}` : 'Place in it', () => {
        if (this.app.selPieces().length) return void this.applyLook(this.app.selPieces(), look.id);
        this.pieceLook = look.id;
        this.renderPieceInfo();
        this.renderMyLooks(true);
        this.app.toast(`Set pieces you place now wear ${look.displayName} (the Look in the panel above)`);
      });
      apply.dataset.act = 'apply';
      apply.title = sel.length ? 'Put the selected set pieces in this look (their paint stays on top)' : 'Place the next set pieces in this look (or select set pieces first to put them in it)';
      acts.append(apply);
      if (mine) {
        const ren = button('Rename…', () => this.lookNameDialog(look.id));
        ren.dataset.act = 'rename';
        const del = button('Delete', () => {
          if (!confirm(`Delete your look "${look.displayName}" from this browser? Maps whose pieces wear it keep their copy.`)) return;
          deleteLook(look.id);
          if (this.pieceLook === look.id && !this.app.doc.lookDefs?.some((l) => l.id === look.id)) this.pieceLook = '';
          this.loadMyLooks();
          this.app.toast(`Deleted "${look.displayName}" from your looks${n ? `; this map keeps its copy (${n} piece${n === 1 ? '' : 's'} wear it)` : ''}`);
        });
        del.dataset.act = 'delete';
        acts.append(ren, del);
      } else {
        const keep = button('Save to my looks', () => {
          if (!saveLook(look)) return this.app.toast('Could not save to browser storage', true);
          this.loadMyLooks();
          this.app.toast(`"${look.displayName}" is in your looks now`);
        });
        keep.dataset.act = 'keep';
        acts.append(keep);
      }
      item.append(head, where, acts);
      grid.append(item);
    }
  }

  /** The look dialog's parts. */
  private lookDialogParts() {
    return {
      dialog: $<HTMLDialogElement>('ed-look-dialog'),
      title: $('ed-look-title'),
      note: $('ed-look-note'),
      name: $<HTMLInputElement>('ed-look-name'),
      swatches: $('ed-look-swatches'),
      updateRow: $('ed-look-update-row'),
      update: $<HTMLInputElement>('ed-look-update'),
      ok: $<HTMLButtonElement>('ed-look-ok'),
      cancel: $<HTMLButtonElement>('ed-look-cancel'),
    };
  }

  /**
   * Save as my look… (painting plan, "Saved looks"): the piece's look as it shows, named; kept in your looks and worn
   * by the piece (its paint across the piece folded in, so nothing changes on screen). When it wears a look of yours
   * already, Update it is offered: every piece wearing it changes with it.
   */
  saveLookDialog(id: string): void {
    const p = this.app.placementOf(id);
    const def = p && this.app.pieceDef(p.piece);
    if (!p || !def) return;
    const d = this.lookDialogParts();
    const current = isMyLook(p.pack) ? this.myLook(p.pack!) : undefined;
    const pack = placementPack(p, this.app.doc.classicStructure.theme, this.lookLib);
    d.title.textContent = 'Save as my look';
    d.note.textContent = `The look ${def.displayName} shows now (${pack ? pack.displayName : "the theme's"}${p.overrides?.roles ? ', with your paint across it' : ''}), kept in this browser under My looks. It fits any set piece; paint on single parts stays with this piece. Roles the look leaves to the theme keep following it.`;
    const take = (lookId: string) => saveLookCommand(this.app.doc, id, d.name.value, lookId, this.app.setPieceLib);
    d.name.value = current ? current.displayName : `${pack?.displayName ?? def.displayName} (mine)`;
    const preview = take(current?.id ?? 'my_preview');
    d.swatches.replaceChildren('error' in preview ? small(preview.error) : this.lookSwatches(preview.look.roles));
    d.updateRow.hidden = !current;
    d.update.checked = false;
    if (current) {
      const n = lookUses(this.app.doc, current.id);
      d.updateRow.querySelector('span')!.textContent = `Update "${current.displayName}" instead of saving a new look${n > 1 ? ` (${n} pieces here wear it and change with it)` : ''}`;
    }
    const sync = () => {
      d.ok.textContent = d.update.checked ? 'Update look' : 'Save to my looks';
      d.ok.disabled = !d.name.value.trim();
    };
    d.update.onchange = sync;
    d.name.oninput = sync;
    sync();
    d.ok.onclick = () => {
      const lookId = d.update.checked && current ? current.id : lookIdFor(d.name.value, (x) => this.myLooks.has(x) || !!this.app.doc.lookDefs?.some((l) => l.id === x) || this.app.setPieceLib.packs.has(x));
      const r = take(lookId);
      if ('error' in r) return this.app.toast(r.error, true);
      if (!saveLook(r.look)) return this.app.toast('Could not save to browser storage: free some space, or Export your maps', true);
      d.dialog.close();
      this.loadMyLooks();
      this.app.run(d.update.checked ? `Update look ${r.look.displayName}` : `Save look ${r.look.displayName}`, r.command);
      this.app.toast(d.update.checked ? `Updated "${r.look.displayName}": every piece here wearing it shows it` : `Saved "${r.look.displayName}" to My looks: pick it in any set piece's Look, here or in another map`);
    };
    d.cancel.onclick = () => d.dialog.close();
    d.dialog.showModal();
    d.name.select();
  }

  /** Rename one of your looks: in your library, and in this map's copy (one undo step) when it has one. */
  lookNameDialog(id: string): void {
    const look = this.myLook(id);
    if (!look) return;
    const d = this.lookDialogParts();
    d.title.textContent = 'Rename look';
    d.note.textContent = 'Pieces wearing it keep it: only its name changes, in your library and in this map.';
    d.swatches.replaceChildren(this.lookSwatches(look.roles));
    d.updateRow.hidden = true;
    d.name.value = look.displayName;
    d.ok.textContent = 'Rename';
    d.ok.disabled = false;
    d.name.oninput = () => (d.ok.disabled = !d.name.value.trim());
    d.update.onchange = null;
    d.ok.onclick = () => {
      const name = d.name.value.replace(/\s+/g, ' ').trim().slice(0, 48);
      if (!name) return;
      d.dialog.close();
      if (this.myLooks.has(id)) renameLook(id, name);
      const cmd = renameLookCommand(this.app.doc, id, name);
      if (cmd) this.app.run('Rename look', cmd);
      this.loadMyLooks();
      this.renderPieceInfo();
      this.app.toast(`Renamed to "${name}"`);
    };
    d.cancel.onclick = () => d.dialog.close();
    d.dialog.showModal();
    d.name.select();
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
    const look = this.lookSelect(def, p.pack ?? '', (v) => this.applyLook([p.id], v));
    look.id = 'ed-sp-insp-look';
    el.append(row('Look', look));
    const saveLook = button('Save as my look…', () => this.saveLookDialog(p.id));
    saveLook.id = 'ed-sp-save-look';
    saveLook.title = 'Name this look as it shows (its look with your paint across the piece) and keep it in your looks, for other pieces and maps';
    el.append(saveLook);
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
      ...this.app.inspector.cellFields(p.id, [p.x, p.y, p.z], 'Move set piece'),
      row('Rotation', text(`${p.rotation * 90}° (R turns it)`)),
      this.app.inspector.quickFacings(p.id, (p.rotation * Math.PI) / 2),
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
      el.append(head, small('Each comes from its look (or the theme); pick another here for this piece only: your paint, over the look.'));
      for (const role of roles) el.append(row(ROLE_LABELS[role], this.roleSelect(p, def, role, update)));
    }
    // Options (format v42): a choice that swaps some of its parts (a dorm bay's room doors, wide or slim).
    if (def.options?.length) {
      const head = document.createElement('h3');
      head.textContent = 'Options';
      el.append(head);
      const now = placementOptions(p, def);
      for (const o of def.options) {
        const sel = document.createElement('select');
        sel.dataset.option = o.name;
        sel.id = `ed-sp-insp-opt-${o.name}`;
        for (const c of o.choices) sel.append(new Option(c.label, c.value, false, c.value === now[o.name]));
        const blurb = () => o.choices.find((c) => c.value === sel.value)?.blurb ?? '';
        sel.title = blurb();
        sel.addEventListener('change', () => {
          const options: Record<string, string> = { ...(p.overrides?.options ?? {}) };
          // The first choice is the default: left unset, as every placement made before the option.
          if (sel.value === o.choices[0]!.value) delete options[o.name];
          else options[o.name] = sel.value;
          const overrides: NonNullable<SetPiecePlacement['overrides']> = { ...(p.overrides ?? {}) };
          if (Object.keys(options).length) overrides.options = options;
          else delete overrides.options;
          const { overrides: _old, ...rest } = p;
          void _old;
          update(`Set piece ${o.label.toLowerCase()}`, Object.keys(overrides).length ? { ...rest, overrides } : rest);
        });
        el.append(row(o.label, sel));
        const b = blurb();
        if (b) el.append(small(b));
      }
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
      // A part only one choice of an option has: named with it, and greyed while that choice is off.
      const when = Object.entries(part.when ?? {}).map(([k, v]) => {
        const o = def.options?.find((x) => x.name === k);
        return `${o?.label ?? k}: ${o?.choices.find((c) => c.value === v)?.label ?? v}`;
      });
      const live = partInPlay(part, placementOptions(p, def));
      if (!live) lab.className = 'off';
      lab.append(box, document.createTextNode(`${this.partLabel(part)}${when.length ? ` (${when.join(', ')})` : ''}`));
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
    const pack = placementPack(p, this.app.doc.classicStructure.theme, this.lookLib);
    const fromLook = pack?.roles[role] ?? def.roles?.[role];
    const label = (v: unknown): string => {
      if (v && typeof v === 'object' && 'material' in v) return coreMaterials.get((v as SurfaceStyle).material)?.displayName ?? (v as SurfaceStyle).material;
      if (typeof v === 'string') return role === 'facade' ? (FACADE_LABELS[v as keyof typeof FACADE_LABELS] ?? v) : role === 'door' ? (DOOR_STYLE_LABELS[v as DoorStyle] ?? v) : role === 'glass' ? (v === 'none' ? 'No glass' : (GLASS_KIND_LABELS[v as GlassKind] ?? v)) : v;
      return "the theme's";
    };
    const now = p.overrides?.roles?.[role];
    // Which layer it shows (painting plan, "Saved looks"): your paint, else the look, else the theme.
    sel.dataset.layer = now !== undefined ? 'paint' : fromLook !== undefined ? 'look' : 'theme';
    sel.classList.add(`layer-${sel.dataset.layer}`);
    sel.title = now !== undefined ? 'Your paint on this piece (over its look)' : fromLook !== undefined ? 'From its look' : "From the map's Structure theme";
    sel.append(new Option(`From the ${fromLook === undefined ? 'theme' : 'look'} (${label(fromLook)})`, '', false, now === undefined));
    const nowKey = now === undefined ? '' : typeof now === 'object' ? (now as SurfaceStyle).material : String(now);
    if ((SET_PIECE_MATERIAL_ROLES as readonly string[]).includes(role)) {
      let group: HTMLOptGroupElement | null = null;
      for (const m of coreMaterials.all()) {
        // Ground materials on the floor, paving and roof roles only (painting plan, 2a).
        if (m.category === 'Ground' && !roleTakesGround(role) && m.id !== nowKey) continue;
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
