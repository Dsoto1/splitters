import {
  buildOccupancy,
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
  setFacingCommand,
  setPieceMirrorRefusal,
  setUpperFloorsCommand,
  SIDES,
  SURFACE_SLOT_LABELS,
  SURFACE_SLOTS,
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
  type Selection,
  type SurfaceSlot,
  type SurfaceStyle,
  type TilePlacement
} from '@tiletrigger/shared';
import type { EditorApp } from './editorApp.ts';
import { $, button, h2, numberInput, row, small, text } from './editorDom.ts';
import { dressable, dressTag } from './editorParts.ts';
import { groupSection, type GroupHost } from './groupPanel.ts';
import { rebuildKeepingEdit } from './inspectorKeep.ts';
import {
  REPLACEMENTS,
  RETIRED_PROPS
} from './paletteCatalog.ts';
import { quickFacings } from './quickFacings.ts';
import { replaceTilePanel } from './retiredTiles.ts';
import { tileOptionPanel } from './tileOptionPanel.ts';

/** The side panel's inspector: what's selected (a tile, a set piece, an entity, a moving build, several things) or Map properties with nothing selected; the tile's walls, room options, upper floors, dressing and surfaces (split out of editorApp.ts, MapMaker overhaul Phase 2 item 5). */
export class Inspector {
  constructor(readonly app: EditorApp) {}

  /** What the inspector's group row (groupPanel.ts) needs. */
  readonly groupHost: GroupHost = {
    doc: () => this.app.doc,
    selection: () => this.app.selection,
    run: (label, cmd) => this.app.run(label, cmd),
    group: () => this.app.group(),
    ungroup: () => this.app.ungroup(),
  };

  /** The inspector rebuilt, the field being typed in kept as it was (inspectorKeep.ts: a placement's rebuild dropped the first edit). */
  renderInspector(): void {
    rebuildKeepingEdit($('ed-inspector'), () => this.buildInspector());
  }

  buildInspector(): void {
    this.app.mapProps.renderSkyPane();
    const el = $('ed-inspector');
    el.replaceChildren();
    // A bot hint picked (botHintTool.ts): its own inspector.
    const hint = this.app.selCount() === 0 ? this.app.hints.inspector() : null;
    if (hint) return void el.append(hint);
    const { tiles, entities } = this.app.selection;
    const pieces = this.app.selPieces();
    const doc = this.app.doc;
    if (this.app.selCount() === 0) return this.app.mapProps.renderMapProperties(el);
    if (pieces.length === 1 && tiles.length + entities.length === 0) {
      this.app.pieces.pieceInspector(el, pieces[0]!);
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
      const tileOpts = tiles.length ? tileOptionPanel(doc, tiles, (label, cmd) => this.app.run(label, cmd)) : null;
      if (tileOpts) el.append(tileOpts);
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
    buttons.append(button('Rotate (R)', () => this.app.rotate()));
    if (pieces.length) {
      const m = button('Mirror (M)', () => this.app.mirror());
      m.id = 'ed-insp-mirror';
      const refused = pieces.map((id) => this.app.placementOf(id)).map((p) => p && this.app.pieceDef(p.piece)).find((d) => d && setPieceMirrorRefusal(d));
      if (refused) {
        m.disabled = true;
        m.title = setPieceMirrorRefusal(refused)!;
      }
      buttons.append(m);
    }
    const mirrorMore = button('Mirror… (Shift+M)', () => this.app.mirrorDialog());
    mirrorMore.id = 'ed-insp-mirror-dialog';
    buttons.append(button('Duplicate', () => this.app.duplicate()), mirrorMore, button('Delete', () => this.app.deleteSelection()), button('Focus (F)', () => this.app.focusSelection()));
    el.append(buttons);
    if (doc.terrain && entities.some((id) => doc.entities.find((x) => x.id === id)?.kind === 'prop')) {
      const settle = button('Settle on ground', () => this.app.settleProps(entities));
      settle.id = 'ed-settle';
      settle.title = 'Bed the selected props into the terrain under them (no floating corners on slopes)';
      el.append(settle);
    }
  }

  /** One tile selected: its type, place, walls, room options, upper floors, dressing and surfaces. */
  tileInspector(el: HTMLElement, t: TilePlacement): void {
    const doc = this.app.doc;
      el.append(h2(coreCatalog.get(t.tile)?.displayName ?? t.tile));
    el.append(replaceTilePanel(doc, t.tile, [...piecesFor(doc, this.app.setPieceLib).values()], (tile, piece) => this.app.pieces.replaceTiles(tile, piece)));
    const type = document.createElement('select');
    for (const def of coreCatalog.all()) type.append(new Option(def.displayName, def.id, false, def.id === t.tile));
    type.addEventListener('change', () => this.app.run('Replace tile', updateTileCommand(doc, t, { ...t, tile: type.value })));
    const set = (patch: Partial<typeof t>) => this.app.run('Edit tile', updateTileCommand(doc, t, { ...t, ...patch }));
    el.append(
      row('Type', type),
      row('X', numberInput(t.x, 1, (v) => set({ x: v }))),
      row('Y', numberInput(t.y, 1, (v) => set({ y: v }))),
      row('Level', numberInput(t.z, 1, (v) => set({ z: v }))),
      row('Rotation', text(`${t.rotation * 90}°`)),
      this.quickFacings({ tiles: [t.id], entities: [] }, (t.rotation * Math.PI) / 2),
    );
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
        const apply = () => this.app.setEdge(target, sel.value as EdgeStyle, (glass.value || null) as GlassKind | null);
        sel.addEventListener('change', () => {
          if (GLASS_EDGES.has(sel.value as never) && !edgeGlassAt(this.app.doc, target)) glass.value = this.app.edgeGlass ?? '';
          apply();
        });
        glass.addEventListener('change', apply);
        const pair = document.createElement('span');
        pair.className = 'ed-wall-pick';
        pair.append(sel, glass);
        el.append(row({ N: 'North', E: 'East', S: 'South', W: 'West' }[side], pair));
      }
    } else el.append(small('Use the Walls & Openings tool (O) to change any side of this piece.'));
    if (def?.configurable) this.roomOptionsPanel(el, t);
    const tileOpts = tileOptionPanel(doc, [t.id], (label, cmd) => this.app.run(label, cmd));
    if (tileOpts) el.append(tileOpts);
    this.upperFloorsPanel(el, t);
    if (def && dressable(def)) this.dressPanel(el, t);
    const h3 = document.createElement('h3');
    h3.textContent = 'Surfaces';
    el.append(h3);
    // The Paint tool's own "Apply to", shared: a change here is a change there.
    const scope = document.createElement('select');
    scope.id = 'ed-insp-scope';
    for (const [v, label] of [['surface', 'This surface'], ['sameType', 'Same piece type'], ['level', 'Whole level'], ['all', 'Whole map']] as const) scope.append(new Option(label, v, false, v === this.app.paintScope));
    scope.addEventListener('change', () => {
      this.app.paintScope = scope.value as PaintScope;
      $<HTMLSelectElement>('ed-scope').value = scope.value;
    });
    el.append(row('Apply to', scope));
    // The roof's top only where the room has a roof (room option Ceiling).
    const roofed = !!t.options?.ceiling && t.options.ceiling !== 'open';
    for (const slot of SURFACE_SLOTS) if (slot !== 'roof' || roofed || t.surfaces?.roof) el.append(this.surfaceRow(t, slot));
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
    const species = document.createElement('optgroup');
    species.label = 'Our species';
    for (const s of ENV_SPECIES)
      for (const v of s.variants) {
        const value = v.index ? `${s.id}#${v.index}` : s.id;
        if (value !== model) species.append(new Option(`${s.displayName} (${v.name})`, value, false, value === suggested));
      }
    target.append(species);
    for (const category of PROP_CATEGORIES) {
      const group = document.createElement('optgroup');
      group.label = category;
      for (const def of CORE_PROPS.filter((d) => d.category === category && d.id !== model && !RETIRED_PROPS.has(d.id))) group.append(new Option(def.displayName, def.id, false, def.id === suggested));
      if (group.children.length) target.append(group);
    }
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
  /** The inspector's quick facings for one thing: 0°, 90°, 180°, 270° in one click (one undo step each). */
  quickFacings(sel: Selection, facing: number): HTMLElement {
    return quickFacings(facing, (deg) => {
      this.app.run(`Face ${deg}°`, setFacingCommand(this.app.doc, sel, deg, coreCatalog, this.app.placeLib));
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
    for (const def of coreMaterials.all()) mat.append(new Option(def.displayName, def.id, false, current?.material === def.id));
    const tint = document.createElement('input');
    tint.type = 'color';
    tint.value = current?.tint ?? '#ffffff';
    tint.disabled = !current;
    tint.title = 'Tint';
    const apply = (style: SurfaceStyle | null) => this.app.run(`Paint ${SURFACE_SLOT_LABELS[slot].toLowerCase()}`, paintCommand(this.app.doc, t.id, slot, style, this.app.paintScope));
    mat.addEventListener('change', () => apply(mat.value ? { material: mat.value, tint: current?.tint ?? null } : null));
    tint.addEventListener('change', () => current && apply({ material: current.material, tint: tint.value.toLowerCase() }));
    const wrap = document.createElement('div');
    wrap.className = 'surface-row';
    // The Paint tool's current brush, onto this surface.
    const brush = document.createElement('button');
    brush.type = 'button';
    brush.className = 'ed-use-brush';
    brush.textContent = 'Brush';
    brush.title = `Paint it with the Paint tool's brush (${coreMaterials.get(this.app.paintStyle.material)?.displayName ?? this.app.paintStyle.material})`;
    brush.addEventListener('click', () => apply(this.app.paintStyle));
    wrap.append(text(SURFACE_SLOT_LABELS[slot]), mat, tint, brush);
    return wrap;
  }
}
