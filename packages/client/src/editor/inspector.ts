import { breakWallPanel } from './breakWallPanel.ts';
import { perfOn } from '../game/perfSwitches.ts';
import {
  buildOccupancy,
  edgeKey,
  localSide,
  setBreakSideCommand,
  sideBreaks,
  CEILING_LABELS,
  CEILINGS,
  CORE_PROPS,
  coreCatalog,
  coreMaterials,
  CORNER_LABELS,
  CORNERS,
  DRESS_DENSITIES,
  dressRoom,
  dressSpace,
  EDGE_STYLE_LABELS,
  EDGE_STYLES,
  edgeChoiceAt,
  edgeGlassAt,
  ENV_SPECIES,
  FACADE_LABELS,
  FACADES,
  FLOOR_INSERT_LABELS,
  FLOOR_INSERTS,
  getProp,
  GLASS_EDGES,
  GLASS_KIND_LABELS,
  GLASS_KINDS,
  guessRoomType,
  levelName,
  modelBudget,
  moverGroupOf,
  paintCommand,
  piecesFor,
  PROP_CATEGORIES,
  replacePropsCommand,
  resolveSurface,
  ROOM_LAYOUT_LABELS,
  ROOM_LAYOUTS,
  ROOM_TYPE_LABELS,
  ROOM_TYPES,
  roomCells,
  seededRandom,
  setPieceMirrorRefusal,
  setUpperFloorsCommand,
  SIDES,
  SURFACE_SLOT_LABELS,
  SURFACE_SLOTS,
  takesGround,
  tileHasMetal,
  updateTileCommand,
  upperFloorLevels,
  type DressDensity,
  type EdgeStyle,
  type EditCommand,
  type GlassKind,
  type MapDocument,
  type MapEntity,
  type PaintScope,
  type ReplaceSize,
  type RoomOptions,
  type RoomType,
  type SurfaceSlot,
  type SurfaceStyle,
  type TilePlacement,
  getKitFamily,
} from '@tiletrigger/shared';
import type { EditorApp } from './editorApp.ts';
import { emptyLine, modeSection } from './modeInspector.ts';
import { $, button, fillWhenOpened, h2, numberInput, row, small, text, type ChoiceGroups } from './editorDom.ts';
import { dressable, dressTag } from './editorParts.ts';
import { groupSection, type GroupHost } from './groupPanel.ts';
import { rebuildKeepingEdit } from './inspectorKeep.ts';
import {
  REPLACEMENTS,
  RETIRED_PROPS
} from './paletteCatalog.ts';
import { quickFacings } from './quickFacings.ts';
import { groundFitSection } from './groundFitPanel.ts';
import { replaceTilePanel } from './retiredTiles.ts';
import { tileOptionPanel } from './tileOptionPanel.ts';
import { tunnelPanel } from './tunnelPanel.ts';

/** The right dock's Properties (the inspector): only what's selected (a tile, a set piece, an entity, a moving build, several things); with nothing selected one line that links to Map settings (mapSettingsView.ts, MapMaker UI spec Phase 1) and the tab's own section; the tile's walls, room options, upper floors, dressing and surfaces (split out of editorApp.ts, MapMaker overhaul Phase 2 item 5). */
export class Inspector {
  constructor(readonly app: EditorApp) {}

  /** What the inspector's group row (groupPanel.ts) needs. */
  readonly groupHost: GroupHost = {
    doc: () => this.app.doc,
    selection: () => this.app.selection,
    run: (label, cmd) => this.app.run(label, cmd),
    group: () => this.app.edits.group(),
    ungroup: () => this.app.edits.ungroup(),
  };

  /**
   * The inspector rebuilt, the field being typed in kept as it was (inspectorKeep.ts: a placement's rebuild dropped the
   * first edit). With nothing selected, the empty line and the tab's section, already shown, are left standing when
   * nothing they show has changed (`emptyStands`).
   */
  renderInspector(): void {
    if (this.emptyStands()) return;
    rebuildKeepingEdit($('ed-inspector'), () => this.buildInspector());
    this.builtFor = this.shownKey();
  }

  /**
   * After an edit (EditorApp.refresh): built again unless it already shows this very map and selection. An edit that
   * picks what it made (placing, pasting, duplicating) built it once in setSelection, and the frame's refresh built
   * it a second time (the owner's trace of 2026-11-24: a tile's inspector, about 1,400 nodes, twice within 70 ms).
   * `?perfoff=editoridle` builds it again every time, as before.
   */
  refreshInspector(): void {
    const k = this.builtFor;
    const now = this.shownKey();
    if (k && perfOn('editoridle') && k.doc === now.doc && k.rev === now.rev && k.sel === now.sel && k.ws === now.ws && k.hint === now.hint) return;
    this.renderInspector();
  }

  /** What a built inspector shows (refreshInspector). */
  private builtFor: ReturnType<Inspector['shownKey']> | null = null;

  private shownKey(): { doc: MapDocument; rev: number; sel: number; ws: string; hint: boolean } {
    return { doc: this.app.doc, rev: this.app.history.revision, sel: this.app.selectionRev, ws: this.app.paletteWs, hint: !!this.app.hints.selected() };
  }

  /** What the empty inspector (the line and the tab's section) was last built from, while it is what the inspector shows. */
  private built: { doc: MapDocument; ws: string; placed: string } | null = null;

  /**
   * The empty inspector as shown is still right: the same tab, and no change to the map's settings (every part of the
   * document but the things placed on it: the Sky pane is drawn from them too) or to the Gameplay tab's counts. The
   * Test tab's section lists the problems themselves: it is always built again.
   */
  private emptyStands(): boolean {
    const b = this.built;
    if (!b || this.app.selCount() !== 0 || this.app.hints.selected()) return false;
    const doc = this.app.doc;
    if (this.app.paletteWs !== b.ws || this.app.paletteWs === 'test') return false;
    if (doc === b.doc) return true;
    for (const k of new Set([...Object.keys(doc), ...Object.keys(b.doc)]) as Set<keyof MapDocument>) if (k !== 'entities' && doc[k] !== b.doc[k]) return false;
    return this.placedKey(doc) === b.placed;
  }

  /** What the Gameplay tab's section counts. */
  private placedKey(doc: MapDocument): string {
    if (this.app.paletteWs !== 'entities') return '';
    const count = (kinds: readonly string[]) => doc.entities.filter((e) => kinds.includes(e.kind)).length;
    return JSON.stringify([['spawn'], ['flag', 'hill', 'bombsite', 'hostage', 'rescue', 'sector', 'objective'], ['pickup'], ['encounter'], ['mount']].map(count));
  }

  buildInspector(): void {
    this.built = null;
    this.app.mapProps.renderSkyPane();
    const el = $('ed-inspector');
    el.replaceChildren();
    // A bot hint picked (botHintTool.ts): its own inspector.
    const hint = this.app.selCount() === 0 ? this.app.hints.inspector() : null;
    if (hint) return void el.append(hint);
    const { tiles, entities } = this.app.selection;
    const pieces = this.app.selPieces();
    const doc = this.app.doc;
    if (this.app.selCount() === 0) {
      // Only what's selected (MapMaker UI spec §3, the owner's answer 3): one line that opens Map settings, then the
      // tab's own section where it has one (modeInspector.ts).
      el.append(emptyLine(() => this.app.mapSettings.open()));
      const mode = modeSection(this.app);
      if (mode) el.append(mode);
      this.built = { doc, ws: this.app.paletteWs, placed: this.placedKey(doc) };
      return;
    }
    if (pieces.length === 1 && tiles.length + entities.length === 0) {
      this.app.pieces.pieceInspector(el, pieces[0]!);
      // A buried set piece (a Lit Tunnel Run): its Family (format v44) and a portal or a Dead End on each of its open ends, as for buried tiles.
      const parts = [...this.app.expansion.partOf].filter(([, piece]) => piece === pieces[0]).map(([id]) => id);
      const tunnel = parts.length ? tunnelPanel(doc, parts, (label, cmd) => this.app.run(label, cmd), pieces[0], () => this.app.doc) : null;
      if (tunnel) el.append(tunnel);
      const breakWalls = breakWallPanel(doc, [], pieces, (label, cmd) => this.app.run(label, cmd));
      if (breakWalls) el.append(breakWalls);
    } else if (tiles.length === 1 && entities.length === 0 && !pieces.length) {
      this.tileInspector(el, doc.classicStructure.tiles.find((x) => x.id === tiles[0])!);
    } else if (entities.length === 1 && tiles.length === 0 && !pieces.length) {
      this.app.entityPane.render(el, doc.entities.find((x) => x.id === entities[0])!);
    } else if (tiles.length === 0 && !pieces.length && this.wholeBuild(entities)) {
      // A moving build selected whole: its mover's settings; moving, rotating, duplicating or deleting takes every part.
      const group = this.wholeBuild(entities)!;
      el.append(small(`A moving build: the mover and the ${group.length - 1} parts it carries, selected together. Move, rotate (R), duplicate or delete it as one; Alt-click picks a single part.`));
      this.app.entityPane.render(el, doc.entities.find((x) => x.id === group[0])!);
    } else {
      el.append(h2(`${this.app.selCount()} selected`));
      el.append(text(`${tiles.length} tiles, ${entities.length} entities${pieces.length ? `, ${pieces.length} set piece${pieces.length === 1 ? '' : 's'}` : ''}`));
      if (pieces.length > 1) el.append(this.app.pieces.multiLookRow(pieces));
      const tileOpts = tiles.length ? tileOptionPanel(doc, tiles, (label, cmd) => this.app.run(label, cmd)) : null;
      if (tileOpts) el.append(tileOpts);
      const tunnel = tiles.length ? tunnelPanel(doc, tiles, (label, cmd) => this.app.run(label, cmd), undefined, () => this.app.doc) : null;
      if (tunnel) el.append(tunnel);
      const breakWalls = breakWallPanel(doc, tiles, pieces, (label, cmd) => this.app.run(label, cmd));
      if (breakWalls) el.append(breakWalls);
      // Groups (MapMaker overhaul Phase 3 item 3): its name and Ungroup, or Group.
      el.append(groupSection(this.groupHost));
      // Box-selected pieces can become a set piece of their own.
      const save = button('Save as set piece…', () => this.app.pieces.saveSelectionDialog());
      save.id = 'ed-insp-save-piece';
      save.title = 'Make a set piece of the selected tiles, blocks, props, doors, ladders and lights, for your library (set pieces count as their parts)';
      el.append(save);
    }
    const buttons = document.createElement('div');
    buttons.className = 'buttons';
    buttons.append(button('Rotate (R)', () => this.app.edits.rotate()));
    if (pieces.length) {
      const m = button('Mirror (M)', () => this.app.edits.mirror());
      m.id = 'ed-insp-mirror';
      const refused = pieces.map((id) => this.app.placementOf(id)).map((p) => p && this.app.pieceDef(p.piece)).find((d) => d && setPieceMirrorRefusal(d));
      if (refused) {
        m.disabled = true;
        m.title = setPieceMirrorRefusal(refused)!;
      }
      buttons.append(m);
    }
    const mirrorMore = button('Mirror… (Shift+M)', () => this.app.edits.mirrorDialog());
    mirrorMore.id = 'ed-insp-mirror-dialog';
    buttons.append(button('Duplicate', () => this.app.edits.duplicate()), mirrorMore, button('Delete', () => this.app.edits.deleteSelection()), button('Focus (F)', () => this.app.focusSelection()));
    el.append(buttons);
    if (doc.terrain && entities.some((id) => doc.entities.find((x) => x.id === id)?.kind === 'prop')) {
      const settle = button('Settle on ground', () => this.app.edits.settleProps(entities));
      settle.id = 'ed-settle';
      settle.title = 'Bed the selected props into the terrain under them (no floating corners on slopes)';
      el.append(settle);
    }
    // Fit ground to this / Settle onto the ground (groundFitPanel.ts).
    if (doc.terrain) el.append(groundFitSection(this.app));
  }

  /** One tile selected: its type, place, walls, room options, upper floors, dressing and surfaces. */
  tileInspector(el: HTMLElement, t: TilePlacement): void {
    const doc = this.app.doc;
      el.append(h2(coreCatalog.get(t.tile)?.displayName ?? t.tile));
    el.append(replaceTilePanel(doc, t.tile, [...piecesFor(doc, this.app.setPieceLib).values()], (tile, piece) => this.app.pieces.replaceTiles(tile, piece)));
    const type = document.createElement('select');
    for (const def of coreCatalog.all()) type.append(new Option(def.displayName, def.id, false, def.id === t.tile));
    type.addEventListener('change', () => this.app.run('Replace tile', updateTileCommand(doc, t, { ...t, tile: type.value })));
    el.append(row('Type', type), ...this.cellFields(t.id, [t.x, t.y, t.z], 'Move tile'), row('Rotation', text(`${t.rotation * 90}°`)), this.quickFacings(t.id, (t.rotation * Math.PI) / 2));
    const def = coreCatalog.get(t.tile);
    const wallsHead = document.createElement('h3');
    wallsHead.textContent = 'Walls';
    el.append(wallsHead);
    if (def && def.cells.length === 1) {
      for (const side of SIDES) {
        const target = { cell: [t.x, t.y, t.z] as [number, number, number], side };
        const sel = document.createElement('select');
        const now = edgeChoiceAt(doc, target);
        for (const style of EDGE_STYLES) sel.append(new Option(EDGE_STYLE_LABELS[style], style, false, style === now));
        // The same choices as the Walls tool: a style, and glass in a window.
        const glass = document.createElement('select');
        glass.title = 'Glass in this window';
        glass.append(new Option('No glass', ''), ...GLASS_KINDS.map((k) => new Option(GLASS_KIND_LABELS[k], k)));
        glass.value = edgeGlassAt(doc, target) ?? '';
        glass.hidden = !GLASS_EDGES.has(now as never);
        const apply = () => this.app.paint.setEdge(target, sel.value as EdgeStyle, (glass.value || null) as GlassKind | null);
        sel.addEventListener('change', () => {
          if (GLASS_EDGES.has(sel.value as never) && !edgeGlassAt(this.app.doc, target)) glass.value = this.app.paint.edgeGlass ?? '';
          apply();
        });
        glass.addEventListener('change', apply);
        // Breakable (format v54; sim/breakWalls.ts): a blast opens this wall.
        const key = edgeKey(def.cells[0]!, localSide(side, t.rotation));
        const breaks = document.createElement('input');
        breaks.type = 'checkbox';
        breaks.id = `ed-break-side-${side}`;
        breaks.title = 'Breakable: a blast opens this wall (Breakable walls below)';
        breaks.checked = sideBreaks(t, key);
        breaks.addEventListener('change', () => this.app.run(breaks.checked ? 'Make wall breakable' : 'Make wall solid', setBreakSideCommand(this.app.doc, t.id, key, breaks.checked)));
        const pair = document.createElement('span');
        pair.className = 'ed-wall-pick';
        pair.append(sel, glass, breaks);
        el.append(row({ N: 'North', E: 'East', S: 'South', W: 'West' }[side], pair));
      }
    } else el.append(small('Use the Walls & Openings tool (O) to change any side of this piece.'));
    if (def?.configurable) this.roomOptionsPanel(el, t);
    const tileOpts = tileOptionPanel(doc, [t.id], (label, cmd) => this.app.run(label, cmd));
    if (tileOpts) el.append(tileOpts);
    const tunnel = tunnelPanel(doc, [t.id], (label, cmd) => this.app.run(label, cmd), undefined, () => this.app.doc);
    if (tunnel) el.append(tunnel);
    const breakWalls = breakWallPanel(doc, [t.id], [], (label, cmd) => this.app.run(label, cmd));
    if (breakWalls) el.append(breakWalls);
    this.upperFloorsPanel(el, t);
    if (def && dressable(def)) this.dressPanel(el, t);
    const h3 = document.createElement('h3');
    h3.textContent = 'Surfaces';
    el.append(h3);
    // Structure paint's own "Apply to", shared: a change here is a change there.
    const scope = document.createElement('select');
    scope.id = 'ed-insp-scope';
    for (const [v, label] of [['surface', 'This surface'], ['sameType', 'Same piece type'], ['level', 'Whole level'], ['all', 'Whole map']] as const) scope.append(new Option(label, v, false, v === this.app.paint.paintScope));
    scope.addEventListener('change', () => {
      this.app.paint.paintScope = scope.value as PaintScope;
      $<HTMLSelectElement>('ed-scope').value = scope.value;
    });
    el.append(row('Apply to', scope));
    // The roof's top only where the room has a roof (room option Ceiling).
    const roofed = !!t.options?.ceiling && t.options.ceiling !== 'open';
    // Metal (bars, barred gates) only where the tile has some.
    const metal = !!t.surfaces?.metal || tileHasMetal(coreCatalog.get(t.tile), t);
    for (const slot of SURFACE_SLOTS) if ((slot !== 'roof' || roofed || t.surfaces?.roof) && (slot !== 'metal' || metal)) el.append(this.surfaceRow(t, slot));
    el.append(small(`ID ${t.id}`));
  }

  /**
   * "Replace all": every prop placed as `model` becomes another prop or an environment species' variant, keeping each
   * one's position, facing, name and tint, and its height (or its scale number); one undo step (replacePropsCommand).
   * A retired piece offers the species that replaced it first (REPLACEMENTS).
   */
  replaceAllSection(el: HTMLElement, model: string): void {
    const count = this.app.doc.entities.filter((x) => x.kind === 'prop' && x.model === model).length;
    const name = getProp(model)?.displayName ?? model;
    const head = document.createElement('h3');
    head.textContent = `Replace all ${count} ${name}`;
    el.append(head);
    const target = document.createElement('select');
    target.id = 'ed-replace-with';
    const suggested = REPLACEMENTS[model];
    // Every prop and every look of it, by group, in the list's order: [label, value] pairs.
    const groups: ChoiceGroups = [];
    const species: [string, string][] = [];
    for (const s of ENV_SPECIES)
      for (const v of s.variants) {
        const value = v.index ? `${s.id}#${v.index}` : s.id;
        if (value !== model) species.push([`${s.displayName} (${v.name})`, value]);
      }
    groups.push(['Our species', species]);
    for (const category of PROP_CATEGORIES) {
      const group: [string, string][] = [];
      for (const def of CORE_PROPS.filter((d) => d.category === category && d.id !== model && !RETIRED_PROPS.has(d.id))) {
        group.push([def.displayName, def.id]);
        // A kit family's other looks (content/kitProps.ts), each its own choice: a retired piece's replacement can
        // be one of them (the striped barrier, the blue container).
        for (const v of getKitFamily(def.id)?.variants ?? []) {
          if (v.index) group.push([`${def.displayName} (${v.name.replace(/_/g, ' ')})`, `${def.id}#${v.index}`]);
        }
      }
      if (group.length) groups.push([category, group]);
    }
    fillWhenOpened(target, groups, suggested);
    el.append(row('With', target));
    const size = document.createElement('select');
    size.id = 'ed-replace-size';
    size.append(new Option('Keep height', 'height', true, true), new Option('Keep scale', 'scale'), new Option('Keep length', 'length'));
    size.title = 'Keep length: the longest side across the ground stays as it was (rows of hedges or walls stay closed)';
    el.append(row('Size', size));
    const turn = document.createElement('select');
    turn.id = 'ed-replace-turn';
    turn.title = 'Turn every new piece by this much (for a piece modelled along the other axis)';
    turn.append(new Option('As placed', '0', true, true), new Option('+90°', '1'), new Option('180°', '2'), new Option('−90°', '3'));
    el.append(row('Turn', turn));
    const go = button(`Replace all ${count}`, () => {
      const cmd = replacePropsCommand(this.app.doc, model, target.value, size.value as ReplaceSize, Number(turn.value));
      const n = cmd.kind === 'updateEntities' ? cmd.after.length : 0;
      if (!n) return this.app.toast('Nothing to replace');
      const label = target.selectedOptions[0]?.textContent ?? target.value;
      if (this.app.run(`Replace all ${name}`, cmd)) this.app.toast(`Replaced ${n} ${name} with ${label}`);
    });
    go.id = 'ed-replace-all';
    go.title = 'Every one of this prop on the map, in one undo step';
    el.append(go);
  }

  /** "Draw route": edit a mover's or plane's points on the map with the Paths tool's hands (the Route tool). */
  drawRouteButton(id: string): HTMLButtonElement {
    const b = button('Draw route on the map', () => {
      this.app.routes.edit(id);
      this.app.setTool({ kind: 'route' });
    });
    b.id = 'ed-draw-route';
    b.title = 'Click to add points, drag them, Shift-click a stretch to insert, right-click or Del to remove (Esc when done)';
    return b;
  }

  /** The moving build `ids` make up exactly (its IDs, mover first), or null. */
  wholeBuild(ids: readonly string[]): string[] | null {
    const group = ids.length > 1 ? moverGroupOf(this.app.doc, ids[0]!) : null;
    return group && group.length === ids.length && group.every((id) => ids.includes(id)) ? group : null;
  }

  /** Inspector fields for one entity: position, facing and its kind's settings. */
  /**
   * A tile's or set piece's X, Y and Level (whole cells), through the shared transform command (MapMaker UI spec Phase
   * 2): the layout check and what is selected with it carried along, as a drag or the arrow keys.
   */
  cellFields(id: string, at: readonly [number, number, number], label: string): HTMLElement[] {
    return (['X', 'Y', 'Level'] as const).map((name, i) => {
      const f = numberInput(at[i]!, 1, (value) => this.app.transform(label, { set: { id, axis: i as 0 | 1 | 2, value } }));
      f.id = `ed-insp-${'xyz'[i]}`;
      f.title = `${name === 'Level' ? 'Level' : `${name} in cells`} (Enter: move · Esc: put back)`;
      return row(name, f);
    });
  }

  /** The inspector's quick facings for the thing `id` (the rest of the selection turns with it): 0°, 90°, 180°, 270° in one click (one undo step each). */
  quickFacings(id: string, facing: number): HTMLElement {
    return quickFacings(facing, (deg) => {
      this.app.transform(`Face ${deg}°`, { face: { id, deg } });
    });
  }

  /** Room type, density and re-roll count last used per room storey (by dressing tag). */
  readonly dressChoices = new Map<string, { type: RoomType; density: DressDensity; roll: number }>();

  /**
   * "Dress room as…": furnish the room for a room type (shared/map/dressing.ts).
   * The props are ordinary prop entities (IDs starting with the room's dressing
   * tag), added in one undoable step; dressing again or re-rolling replaces
   * them, so creators can dress, tweak and re-roll.
   */
  dressPanel(el: HTMLElement, t: TilePlacement): void {
    const def = coreCatalog.get(t.tile)!;
    const levels = [...new Set(def.cells.map((c) => c[2]))].sort((a, b) => a - b);
    const head = document.createElement('h3');
    head.textContent = 'Dress room';
    el.append(head);
    let level = levels[0] ?? 0;
    const tag = () => dressTag(t.id, level);
    const choice = () => this.dressChoices.get(tag());
    const type = document.createElement('select');
    type.id = 'ed-dress-type';
    for (const r of ROOM_TYPES) type.append(new Option(ROOM_TYPE_LABELS[r], r));
    const density = document.createElement('select');
    density.id = 'ed-dress-density';
    for (const d of DRESS_DENSITIES) density.append(new Option(d[0]!.toUpperCase() + d.slice(1), d));
    const dressed = () => this.app.doc.entities.filter((e) => e.kind === 'prop' && e.id.startsWith(`${tag()}_`));
    const clear = button('Clear', () => {
      const old = dressed();
      if (old.length) this.app.run('Clear room dressing', { kind: 'removeEntities', entities: old });
    });
    clear.id = 'ed-dress-clear';
    const sync = () => {
      const now = choice();
      type.value = now?.type ?? guessRoomType(dressSpace(this.app.doc, roomCells(this.app.doc, t.x, t.y, t.z + level)), this.app.doc.classicStructure.theme, seededRandom(tag())());
      density.value = now?.density ?? 'normal';
      clear.disabled = !dressed().length;
    };
    if (levels.length > 1) {
      const storey = document.createElement('select');
      storey.id = 'ed-dress-storey';
      for (const l of levels) storey.append(new Option(l === 0 ? 'Ground floor' : `Floor ${l + 1}`, String(l)));
      storey.addEventListener('change', () => {
        level = Number(storey.value);
        sync();
      });
      el.append(row('Storey', storey));
    }
    sync();
    el.append(row('Dress as', type), row('Density', density));
    const go = (roll: number) => this.dressRoomAt(t, level, type.value as RoomType, density.value as DressDensity, roll);
    const dress = button('Dress room', () => go(choice()?.roll ?? 0));
    dress.id = 'ed-dress';
    dress.title = 'Furnish the room as this room type (replaces what it was dressed with before)';
    const reroll = button('Re-roll', () => go((choice()?.roll ?? 0) + 1));
    reroll.id = 'ed-dress-reroll';
    reroll.title = 'Dress it again with another arrangement';
    const buttons = document.createElement('div');
    buttons.className = 'buttons';
    buttons.append(dress, reroll, clear);
    el.append(buttons, small('Furniture backs onto the walls, groups stand in the middle, plants and lamps in the corners; doorways, windows, spawns and pickups stay clear, with a lane between the doorways. The pieces are ordinary props: move or delete them as you like.'));
  }

  /** Dress (or re-dress) one storey of a room in a single undoable step. */
  dressRoomAt(t: TilePlacement, level: number, type: RoomType, density: DressDensity, roll: number): void {
    const tag = dressTag(t.id, level);
    const doc = this.app.doc;
    const old = doc.entities.filter((e) => e.kind === 'prop' && e.id.startsWith(`${tag}_`));
    const base: MapDocument = { ...doc, entities: doc.entities.filter((e) => !old.includes(e)) };
    const props = dressRoom(dressSpace(base, roomCells(base, t.x, t.y, t.z + level)), type, {
      seed: `${t.id}:${level}:${roll}`,
      density,
      models: modelBudget(base),
      max: Math.max(0, Math.min(48, 1500 - base.entities.filter((e) => e.kind === 'prop').length)),
    });
    this.dressChoices.set(tag, { type, density, roll });
    if (!props.length) {
      this.app.toast(`Nothing fits in this room as a ${ROOM_TYPE_LABELS[type].toLowerCase()}`, true);
      return;
    }
    const added = props.map((p, i) => ({ ...p, id: `${tag}_${i}` }) as MapEntity);
    const commands: EditCommand[] = [...(old.length ? [{ kind: 'removeEntities', entities: old } as EditCommand] : []), { kind: 'addEntities', entities: added }];
    if (this.app.run(`Dress room: ${ROOM_TYPE_LABELS[type]}`, { kind: 'batch', commands })) this.app.toast(`Dressed as a ${ROOM_TYPE_LABELS[type].toLowerCase()}: ${added.length} props`);
  }

  /** Dress every room storey with no props in it yet, as a type guessed from its size and the theme. */
  dressAllRooms(): void {
    let doc = this.app.doc;
    const { cells } = buildOccupancy(doc);
    const added: MapEntity[] = [];
    let rooms = 0;
    for (const t of doc.classicStructure.tiles) {
      const def = coreCatalog.get(t.tile);
      if (!dressable(def)) continue;
      for (const level of new Set(def!.cells.map((c) => c[2]))) {
        const here = roomCells(doc, t.x, t.y, t.z + level).filter((c) => cells.get(`${c[0]},${c[1]},${c[2]}`)?.placement.id === t.id);
        if (!here.length) continue;
        const space = dressSpace(doc, here);
        const taken = doc.entities.some((e) => e.kind === 'prop' && Math.abs(e.position[1] - space.y) < 1.5 && space.rects.some((r) => e.position[0] >= r.x0 && e.position[0] <= r.x1 && e.position[2] >= r.z0 && e.position[2] <= r.z1));
        if (taken) continue;
        const tag = dressTag(t.id, level);
        const type = guessRoomType(space, doc.classicStructure.theme, seededRandom(tag)());
        const props = dressRoom(space, type, { seed: `${t.id}:${level}:0`, models: modelBudget(doc), max: Math.max(0, Math.min(48, 1500 - doc.entities.filter((e) => e.kind === 'prop').length)) });
        if (!props.length) continue;
        const mine = props.map((p, i) => ({ ...p, id: `${tag}_${i}` }) as MapEntity);
        this.dressChoices.set(tag, { type, density: 'normal', roll: 0 });
        added.push(...mine);
        doc = { ...doc, entities: [...doc.entities, ...mine] };
        rooms++;
      }
    }
    if (!added.length) {
      this.app.toast('No bare rooms to dress');
      return;
    }
    if (this.app.run('Dress all rooms', { kind: 'addEntities', entities: added })) this.app.toast(`Dressed ${rooms} room${rooms > 1 ? 's' : ''} (${added.length} props)`);
  }

  /**
   * Floors in a tall piece's own upper storeys (`upperFloors`): one tick per storey that has none, over the whole
   * footprint. A cell holds one piece, so this is how a floor (the ceiling of the storey below) goes in over a piece
   * that stands more than one level tall; a Platform placed on such a cell ticks it for that cell alone.
   */
  upperFloorsPanel(el: HTMLElement, t: TilePlacement): void {
    const levels = upperFloorLevels(t);
    if (!levels.length) return;
    const head = document.createElement('h3');
    head.textContent = 'Upper floors';
    el.append(head);
    for (const { dz, keys, on } of levels) {
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.className = 'ed-upper-floor';
      box.dataset.level = String(t.z + dz);
      box.checked = on === keys.length;
      box.indeterminate = on > 0 && on < keys.length;
      const name = levelName(t.z + dz);
      box.addEventListener('change', () => this.app.run(`${box.checked ? 'Floor on' : 'No floor on'} ${name}`, setUpperFloorsCommand(this.app.doc, t, keys, box.checked)));
      el.append(row(`Floor on ${name}`, box));
    }
    el.append(small('A full floor across the piece at that level: the ceiling below and a floor to build on. Things that rise through it (columns, arches) still stand.'));
  }

  /** One surface slot in the tile inspector: material (or theme default) and tint. */
  /** Layout, floor, ceiling and corners of a room (absent = the room as designed). */
  roomOptionsPanel(el: HTMLElement, t: TilePlacement): void {
    const head = document.createElement('h3');
    head.textContent = 'Room';
    el.append(head);
    const now: RoomOptions = t.options ?? {};
    const pick = <K extends keyof RoomOptions>(label: string, key: K, values: readonly NonNullable<RoomOptions[K]>[], labels: Record<string, string>, unset: string) => {
      const sel = document.createElement('select');
      sel.append(new Option(unset, '', false, now[key] === undefined));
      for (const v of values) if (labels[v] !== unset) sel.append(new Option(labels[v]!, v, false, now[key] === v));
      sel.addEventListener('change', () => {
        const next: RoomOptions = { ...(t.options ?? {}) };
        if (sel.value) next[key] = sel.value as RoomOptions[K];
        else delete next[key];
        const { options: _old, ...rest } = t;
        this.app.run(`Room: ${label.toLowerCase()}`, updateTileCommand(this.app.doc, t, Object.keys(next).length ? { ...rest, options: next } : rest));
      });
      el.append(row(label, sel));
    };
    pick('Layout', 'layout', ROOM_LAYOUTS, ROOM_LAYOUT_LABELS, 'As built');
    pick('Floor', 'floor', FLOOR_INSERTS, FLOOR_INSERT_LABELS, FLOOR_INSERT_LABELS.standard);
    pick('Ceiling', 'ceiling', CEILINGS, CEILING_LABELS, CEILING_LABELS.open);
    pick('Corners', 'corners', CORNERS, CORNER_LABELS, CORNER_LABELS.square);
    pick('Facade', 'facade', FACADES, FACADE_LABELS, FACADE_LABELS.none);
    el.append(small('A roof is left off where something is built on top; a sunken centre needs nothing below it. A city facade dresses the outside walls (stack rooms for taller buildings).'));
  }

  surfaceRow(t: MapDocument['classicStructure']['tiles'][number], slot: SurfaceSlot): HTMLElement {
    const current = t.surfaces?.[slot];
    const mat = document.createElement('select');
    mat.append(new Option(slot === 'roof' ? 'Same as the floor' : `Theme (${resolveSurface({ ...this.app.doc }, undefined, slot).material.displayName})`, '', false, !current));
    // Ground materials go on floors and roofs only (painting plan, the owner's answer 2a).
    for (const def of coreMaterials.all()) if (def.category !== 'Ground' || takesGround(slot) || current?.material === def.id) mat.append(new Option(def.displayName, def.id, false, current?.material === def.id));
    const tint = document.createElement('input');
    tint.type = 'color';
    tint.value = current?.tint ?? '#ffffff';
    tint.disabled = !current;
    tint.title = 'Tint';
    const apply = (style: SurfaceStyle | null) => this.app.run(`Paint ${SURFACE_SLOT_LABELS[slot].toLowerCase()}`, paintCommand(this.app.doc, t.id, slot, style, this.app.paint.paintScope));
    mat.addEventListener('change', () => apply(mat.value ? { material: mat.value, tint: current?.tint ?? null } : null));
    tint.addEventListener('change', () => current && apply({ material: current.material, tint: tint.value.toLowerCase() }));
    const wrap = document.createElement('div');
    wrap.className = 'surface-row';
    // Structure paint's current brush, onto this surface.
    const brush = document.createElement('button');
    brush.type = 'button';
    brush.className = 'ed-use-brush';
    brush.textContent = 'Brush';
    const brushDef = coreMaterials.get(this.app.paint.paintStyle.material);
    brush.disabled = brushDef?.category === 'Ground' && !takesGround(slot);
    brush.title = brush.disabled ? `${brushDef!.displayName} is a ground: on buildings it goes on floors and roofs only` : `Paint it with Structure paint's brush (${brushDef?.displayName ?? this.app.paint.paintStyle.material})`;
    brush.addEventListener('click', () => apply(this.app.paint.paintStyle));
    wrap.append(text(SURFACE_SLOT_LABELS[slot]), mat, tint, brush);
    return wrap;
  }
}
