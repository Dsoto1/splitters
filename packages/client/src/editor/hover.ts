import {
  checkNote,
  coreCatalog,
  coreMaterials,
  coreThemes,
  EDGE_STYLE_LABELS,
  edgeChoiceAt,
  edgeTargetAt,
  entityGhostNote,
  entityLabel,
  FOLIAGE_LEVELS,
  getItem,
  getProp,
  ghostRefuses,
  levelName,
  mapFactions,
  MOUNT_DEFS,
  NPC_PALETTE,
  placementCells,
  resolveSurface,
  rosterSize,
  SCENARIO_PALETTE,
  SURFACE_SLOT_LABELS,
  TERRAIN_MATERIAL_LABELS,
  TERRAIN_SURFACES,
  terrainHeightAt,
  terrainMaterialFor,
  terrainRaycast,
  tileAt,
  tileGhostCheck,
  turnLabel,
  zoneNote as zoneGhostNote,
  type GhostEntityKind,
  type GhostNote,
  type MapEntity,
  type PlacementCheck,
  type TerrainBrush,
  type TileDefinition,
  type Vec3,
  type WorldBox
} from '@tiletrigger/shared';
import type { EditorApp } from './editorApp.ts';
import { $, escapeHtml } from './editorDom.ts';
import { pickRadius, type Hit } from './editorParts.ts';
import { raycastBoxes } from './raycast.ts';

/** What's under the pointer: the pointer's ray onto the level, the ground and surfaces, picking, the hover card and status line, and the placing ghosts with why one is refused (split out of editorApp.ts, MapMaker overhaul Phase 2 item 5). */
export class Hover {
  constructor(readonly app: EditorApp) {}

  /** The boxes Paint and Walls can point at: everything drawn but the invisible barriers (map edge, ground fence). */
  paintable: { from: WorldBox[]; boxes: WorldBox[]; tiles: WorldBox[] } = { from: [], boxes: [], tiles: [] };

  /** The level an entity stands on (things a little below a floor, like props bedded into ground, count as on it). */
  entityLevel(e: MapEntity): number {
    return Math.floor((e.position[1] + 0.5) / this.app.doc.classicStructure.levelHeight);
  }

  /** Standing on the terrain rather than a floor: reachable from any level. */
  onTerrain(e: MapEntity): boolean {
    const t = this.app.shownGround;
    if (!t) return false;
    const y = terrainHeightAt(t, e.position[0], e.position[2]);
    return y !== null && Math.abs(e.position[1] - y) < 1;
  }

  /** Whether the pointer may act on this entity from the current level. */
  reachable(e: MapEntity): boolean {
    if (this.app.showAll || this.onTerrain(e)) return true;
    const h = this.app.doc.classicStructure.levelHeight;
    const bottom = e.position[1];
    const top = bottom + ('size' in e && Array.isArray(e.size) ? e.size[1] : e.kind === 'prop' ? (getProp(e.model)?.size[1] ?? 1) * e.scale : 2);
    return top >= this.app.level * h - 0.5 && bottom < (this.app.level + 1) * h - 0.1;
  }

  /** Display name of a pick target. */
  targetName(hit: Hit): string {
    if (hit.kind === 'setpiece') {
      const p = this.app.placementOf(hit.id);
      return (p && this.app.pieceDef(p.piece)?.displayName) ?? 'set piece';
    }
    if (hit.kind === 'tile') {
      const t = this.app.doc.classicStructure.tiles.find((x) => x.id === hit.id);
      return coreCatalog.get(t?.tile ?? '')?.displayName ?? 'tile';
    }
    const e = this.app.doc.entities.find((x) => x.id === hit.id);
    if (!e) return 'item';
    return e.kind === 'spawn' ? 'Player Spawn' : e.kind === 'pickup' ? (getItem(e.item)?.displayName ?? 'pickup') : entityLabel(this.app.doc, e);
  }

  /**
   * What is under the cursor, for Select and Erase. The nearest thing the
   * pointer ray actually hits wins: an entity's drawn model, a free block or
   * water, or a tile's walls and floors. Tiles must be on the current level;
   * entities on it, or standing on the terrain (any level). Failing a hit, an
   * entity near the pointer, then the tile in the hovered cell.
   */
  pick(): Hit | null {
    // The map as drawn: a set piece's parts (tiles and entities of the expansion) pick their placement, as one.
    const view = this.app.viewDoc;
    const partOf = this.app.expansion.partOf;
    const whole = (h: { kind: 'tile' | 'entity'; id: string }): Hit => {
      const placement = partOf.get(h.id);
      return placement ? { kind: 'setpiece', id: placement } : { kind: h.kind, id: h.id };
    };
    const byId = new Map(view.entities.map((e) => [e.id, e]));
    // What the outliner hides or locks (editor-only) can't be picked: a set piece's parts follow their placement.
    const blocked = this.app.outliner.blocked;
    const free = (id: string) => !blocked.size || !(blocked.has(id) || blocked.has(partOf.get(id) ?? ''));
    const ok = (e: MapEntity | undefined): e is MapEntity => !!e && free(e.id) && this.reachable(e) && this.app.view.entityShown(e.id);
    const tilesHere = new Set(view.classicStructure.tiles.filter((t) => free(t.id) && (placementCells(t) ?? []).some((c) => c[2] === this.app.level)).map((t) => t.id));
    let best: { kind: 'tile' | 'entity'; id: string; d: number } | null = null;
    const ray = this.app.ray;
    if (ray) {
      const ent = this.app.view.pickEntities(ray.origin, ray.dir).find((h) => ok(byId.get(h.id)));
      if (ent) best = { kind: 'entity', id: ent.id, d: ent.distance };
      const boxes = this.app.visibleBoxes.filter((b) => b.kind !== 'barrier' && (tilesHere.has(b.sourceId) || ok(byId.get(b.sourceId))));
      const hit = raycastBoxes(ray.origin, ray.dir, boxes);
      // A model a hair behind the box it stands in still counts (crates in a doorway, props on a floor).
      if (hit && (!best || hit.distance < best.d - 0.05)) best = { kind: tilesHere.has(hit.box.sourceId) ? 'tile' : 'entity', id: hit.box.sourceId, d: hit.distance };
    }
    if (best?.kind === 'entity') return whole(best);
    const p = this.app.hoverPoint;
    if (p) {
      let near: { id: string; d: number } | null = null;
      for (const e of view.entities) {
        if (!ok(e)) continue;
        const d = Math.hypot(e.position[0] - p.x, e.position[2] - p.z);
        if (d < pickRadius(e) && (!near || d < near.d)) near = { id: e.id, d };
      }
      // Flat markers (zones, squads, pads) on the floor under the pointer win over the floor itself.
      if (near && (!best || best.kind === 'tile')) return whole({ kind: 'entity', id: near.id });
    }
    if (best) return whole(best);
    const cell = this.app.hoverCell;
    if (!cell) return null;
    const tile = tileAt(view, cell[0], cell[1], this.app.level);
    if (tile && free(tile.id)) return whole({ kind: 'tile', id: tile.id });
    // A cell a set piece claims (its footprint holds every level of it), even where none of its parts stands.
    const held = this.app.expansion.footprints;
    for (const [id, cells] of held) if (free(id) && cells.some((c) => c[0] === cell[0] && c[1] === cell[1] && c[2] === this.app.level)) return { kind: 'setpiece', id };
    // Under the ground (Select only: Erase takes what is seen): the pointer is on the ground over a buried piece, a
    // tunnel a level or more down, with nothing of this level there. The piece nearest under the ground wins.
    const under = this.app.tool.kind === 'select' ? this.buriedUnderPointer(free) : null;
    return under ? whole({ kind: 'tile', id: under }) : null;
  }

  /** The buried piece (a tile with a bore: map/groundBore.ts) under the place on the ground the pointer is on, if any. */
  private buriedUnderPointer(free: (id: string) => boolean): string | null {
    const ray = this.app.ray;
    const ground = this.app.shownGround;
    const at = ray && ground ? terrainRaycast(ground, ray.origin, ray.dir) : null;
    if (!at) return null;
    const view = this.app.viewDoc;
    const { cellSize, levelHeight } = view.classicStructure;
    const cx = Math.round(at.x / cellSize);
    const cy = Math.round(at.z / cellSize);
    let best: { id: string; level: number } | null = null;
    for (const t of view.classicStructure.tiles) {
      if (!coreCatalog.get(t.tile)?.bore || !free(t.id)) continue;
      for (const c of placementCells(t) ?? []) {
        // Its floor under the ground there, and the highest such.
        if (c[0] !== cx || c[1] !== cy || c[2] * levelHeight > at.y || (best && best.level >= c[2])) continue;
        best = { id: t.id, level: c[2] };
      }
    }
    return best?.id ?? null;
  }

  // ---------------------------------------------------------------- hover / drag

  updatePointer(clientX: number, clientY: number): void {
    const { cellSize, levelHeight } = this.app.doc.classicStructure;
    this.app.ray = this.app.view.pointerRay(clientX, clientY);
    this.app.pointerAt = { x: clientX, y: clientY };
    this.app.hoverPoint = this.app.view.pickPlane(clientX, clientY, this.app.level * levelHeight);
    // The ground as shown (kept under the floors), not the document's own: under a floor that stands on a hill, the
    // ground as made is inside the floor, out of sight.
    const t = this.app.shownGround;
    this.app.terrain.terrainHover = null;
    this.app.hoverOnTerrain = false;
    let ground: { at: Vec3; distance: number } | null = null;
    if (t) {
      const ray = this.app.view.pointerRay(clientX, clientY);
      const hit = ray ? terrainRaycast(t, ray.origin, ray.dir) : null;
      if (hit && ray) ground = { at: hit, distance: Math.hypot(hit.x - ray.origin.x, hit.y - ray.origin.y, hit.z - ray.origin.z) };
      if (hit && this.app.tool.kind === 'terrain') this.app.terrain.terrainHover = hit;
      // Spawns, pickups and props stand on the ground where it is nearer than the level plane.
      // (Tiles and set pieces go on the grid: the level being edited, not the ground.)
      if (hit && ray && this.app.tool.kind !== 'tile' && this.app.tool.kind !== 'setpiece' && this.app.tool.kind !== 'terrain') {
        const dist = (p: Vec3) => Math.hypot(p.x - ray.origin.x, p.y - ray.origin.y, p.z - ray.origin.z);
        if (!this.app.hoverPoint || dist(hit) < dist(this.app.hoverPoint)) {
          this.app.hoverPoint = hit;
          this.app.hoverOnTerrain = true;
        }
      }
    }
    this.app.hoverCell = this.app.hoverPoint ? [Math.round(this.app.hoverPoint.x / cellSize), Math.round(this.app.hoverPoint.z / cellSize), this.app.level] : null;
    if (this.app.tool.kind === 'path') this.app.paths.hover(this.app.hoverPoint);
    if (this.app.tool.kind === 'measure') this.app.measure.setHover(this.app.placing.measurePointAtHover());
    this.app.paintGround = null;
    if (this.app.tool.kind === 'paint' || this.app.tool.kind === 'edge') {
      const ray = this.app.view.pointerRay(clientX, clientY);
      // Only what is drawn: the invisible walls round the map (60 m high) would catch the ray first from far out.
      if (this.paintable.from !== this.app.visibleBoxes) {
        const boxes = this.app.visibleBoxes.filter((b) => b.kind !== 'barrier');
        const tiles = new Set(this.app.doc.classicStructure.tiles.map((t) => t.id));
        this.paintable = { from: this.app.visibleBoxes, boxes, tiles: boxes.filter((b) => tiles.has(b.sourceId)) };
      }
      // Paint paints tiles' surfaces (a rock or crate in the way is not one: the ground under it is what it paints).
      const face = ray ? raycastBoxes(ray.origin, ray.dir, this.app.tool.kind === 'paint' ? this.paintable.tiles : this.paintable.boxes) : null;
      // The ground in front of a surface hides it; with nothing nearer, the ground is what Paint paints.
      this.app.hoverFace = face && (!ground || face.distance < ground.distance) ? face : null;
      if (this.app.tool.kind === 'paint' && !this.app.hoverFace && ground) this.app.paintGround = ground.at;
    } else this.app.hoverFace = null;
    this.app.paint.hoverEdge = null;
    if (this.app.tool.kind === 'edge' && this.app.hoverFace) {
      const ray = this.app.view.pointerRay(clientX, clientY)!;
      const d = this.app.hoverFace.distance;
      const point: [number, number, number] = [ray.origin.x + ray.dir.x * d, ray.origin.y + ray.dir.y * d, ray.origin.z + ray.dir.z * d];
      this.app.paint.hoverEdge = edgeTargetAt(this.app.doc, point, this.app.hoverFace.normal);
    }
    this.updateHover();
  }

  updateHover(): void {
    this.updateHoverTarget();
    this.updateHoverCard();
  }

  /**
   * Hover card next to the pointer (reference board): the piece about to be
   * placed, or what Select / Erase would act on, with its size, theme and connectors.
   */
  updateHoverCard(): void {
    const tip = $('ed-tip');
    const at = this.app.pointerAt;
    const lines: string[] = [];
    /** Lines in red (why it can't be placed) or amber (a warning), by index in `lines`. */
    const marks = new Map<number, 'bad' | 'warn' | 'note'>();
    let title = '';
    let tone = '';
    const themeName = coreThemes.get(this.app.doc.classicStructure.theme)?.displayName ?? this.app.doc.classicStructure.theme;
    const tileLines = (def: TileDefinition, rotation: number) => {
      const span = (i: 0 | 1 | 2) => Math.max(...def.cells.map((c) => c[i])) - Math.min(...def.cells.map((c) => c[i])) + 1;
      return [`Size: ${span(0)} × ${span(1)} × ${span(2)}`, `Theme: ${themeName}`, `Connectors: ${def.ports.length}`, `Rotation: ${rotation * 90}°`];
    };
    if (at && !this.app.input.drag && !this.app.looking) {
      const g = this.app.pieceHover;
      if (this.app.tool.kind === 'setpiece' && this.app.hoverCell && g) {
        // The set piece about to be placed: what it is, how it's turned and themed, and whether it fits (and why not).
        title = g.def.displayName;
        tone = g.ok ? 'place' : 'bad';
        lines.push(...this.app.pieces.pieceLines(g.def, g.placement), `${levelName(this.app.level)} · cell ${this.app.hoverCell[0]}, ${this.app.hoverCell[1]}`);
        // The ghost says why (ghostWhy.ts): a few words here, the whole reason on the status line.
        if (!g.ok) marks.set(lines.push(`✗ ${g.short}`) - 1, 'bad');
        else if (g.blocked) marks.set(lines.push(`⚠ ${g.blocked} of its ports face${g.blocked === 1 ? 's' : ''} a wall (red): open the wall there, or place it elsewhere`) - 1, 'warn');
        else {
          const zone = this.app.hoverPoint && zoneGhostNote(this.app.doc, g.placement.x * this.app.doc.classicStructure.cellSize, g.placement.y * this.app.doc.classicStructure.cellSize);
          if (zone) marks.set(lines.push(`ℹ ${zone.text}`) - 1, 'note');
          lines.push('Click to place');
        }
      } else if (this.app.tool.kind === 'tile' && this.app.hoverCell) {
        const def = coreCatalog.get(this.app.tool.tile);
        if (def) {
          title = def.displayName;
          lines.push(...tileLines(def, this.app.rotation), `${levelName(this.app.level)} · cell ${this.app.hoverCell[0]}, ${this.app.hoverCell[1]}`);
          const check = this.tileGhost(this.app.tool.tile, [this.app.hoverCell[0], this.app.hoverCell[1], this.app.level]);
          const why = checkNote(check) ?? zoneGhostNote(this.app.doc, this.app.hoverCell[0] * this.app.doc.classicStructure.cellSize, this.app.hoverCell[1] * this.app.doc.classicStructure.cellSize);
          if (why) marks.set(lines.push(`${why.tone === 'bad' ? '✗' : 'ℹ'} ${why.text}`) - 1, why.tone === 'bad' ? 'bad' : 'note');
          tone = check.ok ? 'place' : 'bad';
        }
      } else if (this.entityGhost()) {
        // Spawns, pickups, props, vehicles, NPCs and objects: shown only when there is something to say.
        const g = this.entityGhost()!;
        title = g.title;
        tone = g.note.tone === 'note' ? 'place' : g.note.tone;
        marks.set(lines.push(`${g.note.tone === 'bad' ? '✗' : g.note.tone === 'warn' ? '⚠' : 'ℹ'} ${g.note.text}`) - 1, g.note.tone);
        lines.push(g.note.tone === 'bad' ? "Can't be placed here" : 'Click to place');
      } else if (this.app.tool.kind === 'select' || this.app.tool.kind === 'erase') {
        const hit = this.pick();
        if (hit) {
          title = this.targetName(hit);
          tone = this.app.tool.kind === 'erase' ? 'erase' : 'pick';
          const below = hit.kind === 'tile' ? this.app.viewDoc.classicStructure.tiles.find((t) => t.id === hit.id) : undefined;
          if (below && !(placementCells(below) ?? []).some((c) => c[2] === this.app.level)) lines.push(`Under the ground, on ${levelName(below.z)}`);
          const placement = hit.kind === 'setpiece' ? this.app.placementOf(hit.id) : undefined;
          const def = placement && this.app.pieceDef(placement.piece);
          if (placement && def) lines.push('Set piece (selects as one)', ...this.app.pieces.pieceLines(def, placement));
          else if (hit.kind === 'tile') {
            const t = this.app.doc.classicStructure.tiles.find((x) => x.id === hit.id);
            const def = t && coreCatalog.get(t.tile);
            if (t && def) lines.push(...tileLines(def, t.rotation), levelName(t.z));
          } else {
            const e = this.app.doc.entities.find((x) => x.id === hit.id);
            if (e?.kind === 'encounter') lines.push(`${rosterSize(e.roster)} NPCs · ${mapFactions(this.app.doc).find((f) => f.id === e.faction)?.name ?? e.faction}`, `Order: ${e.order}`);
            else if (e?.kind === 'prop') lines.push(`Prop · scale ${e.scale}×`, (getProp(e.model)?.size ?? [1, 1, 1]).map((v) => (v * e.scale).toFixed(1)).join(' × ') + ' m');
            if (e) lines.push(`Height ${e.position[1].toFixed(1)} m`);
          }
          lines.push(this.app.tool.kind === 'erase' ? 'Click to erase' : 'Click to select');
        }
      }
    }
    tip.hidden = !title;
    if (!title || !at) return;
    tip.className = `tone-${tone}`;
    tip.innerHTML = `<b>${escapeHtml(title)}</b>${lines.map((l, i) => `<span${marks.has(i) ? ` class="${marks.get(i)}"` : ''}>${escapeHtml(l)}</span>`).join('')}`;
    // Beside the pointer, kept inside the window.
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const viewRight = $('ed-right').offsetParent ? $('ed-right').getBoundingClientRect().left : window.innerWidth;
    tip.style.left = `${at.x + 18 + w > viewRight - 8 ? Math.max(0, at.x - 18 - w) : at.x + 18}px`;
    tip.style.top = `${Math.min(window.innerHeight - h - 44, at.y + 18)}px`;
  }

  updateHoverTarget(): void {
    // Placing tools show what they'd put down, see-through, before you click (first: every other tool hides them).
    // One ghost for every kind that has a model: where it would land, facing the way it would face.
    const t = this.app.tool;
    const ghost: { kind: 'prop' | 'mount' | 'spawn' | 'pickup'; model: string; at: [number, number, number] | null; yaw: number; scale?: number; variant?: number } | null =
      this.app.looking ? null
      : t.kind === 'prop' ? { kind: 'prop', model: t.model, ...this.app.placing.propPlacement(t.model) }
      : t.kind === 'mount' ? { kind: 'mount', model: t.model, at: this.app.placing.placeSpot(), yaw: this.app.propYaw }
      : t.kind === 'spawn' ? { kind: 'spawn', model: 'spawn', at: this.app.placing.placeSpot(), yaw: this.app.spawnYaw }
      : t.kind === 'pickup' ? { kind: 'pickup', model: t.item, at: this.app.placing.placeSpot(), yaw: 0 }
      : null;
    // Red where the click is refused (over nothing, outside the boundary: ghostWhy.ts).
    const refused = !this.app.looking && ghostRefuses(this.entityGhost()?.note);
    this.app.view.setPropGhost(ghost?.model ?? null, ghost?.at ?? null, ghost?.yaw ?? 0, ghost?.kind ?? 'prop', ghost?.scale !== undefined ? { scale: ghost.scale, ...(ghost.variant !== undefined ? { variant: ghost.variant } : {}) } : undefined, refused);
    const objects = this.app.looking ? null : this.app.placing.objectGhost();
    this.app.view.setEntityGhost(this.app.doc, objects?.key ?? null, objects?.entities ?? [], refused);
    this.app.pieces.updatePieceGhost();
    if (this.app.tool.kind === 'select' || this.app.tool.kind === 'erase') {
      // Select: the rotate ring round the selection lights under the pointer (and, held, turns it).
      const onRing = this.app.tool.kind === 'select' && !this.app.input.drag && !this.app.looking && !this.app.input.marquee && (!!this.app.ring.drag || this.app.ring.hover(this.app.pointerAt));
      if (onRing) {
        this.app.view.setPickHighlight(this.app.doc, null, 'pick', this.app.history.revision);
        $('ed-target').textContent = this.app.ring.drag ? `Turning ${turnLabel(this.app.ring.drag.turn)} · Shift: finer · Esc cancels` : 'Drag the ring to turn the selection (Shift: a finer step)';
        this.app.view.setFaceHighlight(null, null);
        this.app.view.setHoverCell(this.app.doc, null);
        this.app.view.setGhost(this.app.doc, null, null, 0, true);
        return;
      }
      if (this.app.tool.kind === 'erase' || this.app.input.drag || this.app.looking || this.app.input.marquee) this.app.ring.hover(null);
      const target = this.app.input.drag || this.app.looking || this.app.input.marquee ? null : this.pick();
      const cells = target?.kind === 'setpiece' ? (this.app.expansion.footprints.get(target.id) ?? []) : [];
      this.app.view.setPickHighlight(this.app.doc, target, this.app.tool.kind === 'erase' ? 'erase' : 'pick', this.app.history.revision, cells);
      $('ed-target').textContent = target ? `${this.app.tool.kind === 'erase' ? 'Erase' : 'Select'}: ${this.targetName(target)}` : this.app.placing.zoneNote();
      this.app.view.setFaceHighlight(null, null);
      this.app.view.setHoverCell(this.app.doc, null);
      this.app.view.setGhost(this.app.doc, null, null, 0, true);
      return;
    }
    this.app.view.setPickHighlight(this.app.doc, null, 'pick', 0);
    if (this.app.tool.kind === 'measure') {
      $('ed-target').textContent = this.app.measure.summary();
      this.app.view.setFaceHighlight(null, null);
      this.app.view.setHoverCell(this.app.doc, null);
      this.app.view.setGhost(this.app.doc, null, null, 0, true);
      return;
    }
    if (this.app.tool.kind === 'envbrush') {
      const p = this.app.hoverPoint;
      const env = this.app.tool.kind === 'envbrush';
      this.app.view.setBrushRing(p ? this.app.shownGround : null, p?.x ?? 0, p?.z ?? 0, this.app.terrain.brushRadius, env && this.app.env.mode === 'erase' ? '#ff7a4d' : '#6fdc6a');
      $('ed-target').textContent = !p ? '' : this.app.env.hoverLabel();
      this.app.view.setFaceHighlight(null, null);
      this.app.view.setHoverCell(this.app.doc, null);
      this.app.view.setGhost(this.app.doc, null, null, 0, true);
      return;
    }
    if (this.app.tool.kind === 'terrain') {
      const h = this.app.terrain.terrainHover;
      const t = this.app.shownGround;
      const colors: Record<TerrainBrush, string> = { raise: '#ffd34d', lower: '#ff7a4d', smooth: '#7fd8ff', flatten: '#c7a6ff', roughen: '#b8e07a', paint: '#ffffff', foliage: '#6fdc6a' };
      this.app.view.setBrushRing(h ? t : null, h?.x ?? 0, h?.z ?? 0, this.app.terrain.brushRadius, colors[this.app.terrain.terrainBrush]);
      $('ed-target').textContent = !t ? 'No terrain yet: create one in the Terrain tab' : h ? `${this.app.terrain.terrainBrush === 'paint' ? `Paint ${TERRAIN_MATERIAL_LABELS[this.app.terrain.terrainMaterial]}` : this.app.terrain.terrainBrush === 'foliage' ? `Plants: ${FOLIAGE_LEVELS[this.app.terrain.foliageLevel]}` : this.app.terrain.terrainBrush} · height ${h.y.toFixed(1)} m · radius ${this.app.terrain.brushRadius} m` : '';
      this.app.view.setFaceHighlight(null, null);
      this.app.view.setHoverCell(this.app.doc, null);
      this.app.view.setGhost(this.app.doc, null, null, 0, true);
      return;
    }
    if (this.app.tool.kind === 'edge') {
      const e = this.app.paint.hoverEdge;
      if (e) {
        const { cellSize, levelHeight } = this.app.doc.classicStructure;
        const [gx, gy, gz] = e.cell;
        const [dx, dz] = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] }[e.side] as [number, number];
        const h = cellSize / 2;
        const cx = gx * cellSize + dx * (h - 0.25);
        const cz = gy * cellSize + dz * (h - 0.25);
        const box = { min: [cx - (dx ? 0.25 : h), gz * levelHeight, cz - (dz ? 0.25 : h)], max: [cx + (dx ? 0.25 : h), (gz + 1) * levelHeight, cz + (dz ? 0.25 : h)], kind: 'wall', sourceId: '' } as WorldBox;
        this.app.view.setFaceHighlight(box, [-dx, 0, -dz]);
        const tileName = coreCatalog.get(tileAt(this.app.doc, gx, gy, gz)?.tile ?? '')?.displayName ?? '';
        const sideName = { N: 'North', E: 'East', S: 'South', W: 'West' }[e.side];
        $('ed-target').textContent = `${sideName} side · ${tileName} · now ${EDGE_STYLE_LABELS[edgeChoiceAt(this.app.doc, e)]} → ${EDGE_STYLE_LABELS[this.app.tool.style]}`;
      } else {
        this.app.view.setFaceHighlight(null, null);
        $('ed-target').textContent = '';
      }
      this.app.view.setHoverCell(this.app.doc, null);
      this.app.view.setGhost(this.app.doc, null, null, 0, true);
      return;
    }
    // Paint lights only a surface it can paint (a tile's), never a prop or block it would leave as it is.
    const face = this.app.tool.kind === 'paint' && !this.app.paint.paintTarget() ? null : this.app.hoverFace;
    this.app.view.setFaceHighlight(face?.box ?? null, face?.localNormal ?? null);
    if (this.app.tool.kind === 'paint') {
      const target = this.app.paint.paintTarget();
      const g = this.app.paintGround;
      // On the ground: the ring it paints, as the Terrain tab's Paint brush shows it.
      this.app.view.setBrushRing(g ? this.app.shownGround : null, g?.x ?? 0, g?.z ?? 0, this.app.terrain.brushRadius, '#ffb03b');
      $('ed-target').textContent = target
        ? `${SURFACE_SLOT_LABELS[target.slot]} · ${coreCatalog.get(target.tile.tile)?.displayName ?? target.tile.tile} · ${resolveSurface(this.app.doc, target.tile, target.slot).material.displayName}`
        : g
          ? `Ground · paint ${TERRAIN_MATERIAL_LABELS[this.app.paint.groundPaint]}${TERRAIN_SURFACES[this.app.paint.groundPaint] === this.app.paint.paintStyle.material || !terrainMaterialFor(this.app.paint.paintStyle.material) ? '' : ` (${coreMaterials.get(this.app.paint.paintStyle.material)?.displayName ?? 'swatch'})`} · radius ${this.app.terrain.brushRadius} m`
          : '';
    } else if (this.app.tool.kind === 'path') {
      const over = this.app.paths.hovering;
      $('ed-target').textContent = this.app.paths.dragging ? 'Moving the point' : over === 'point' ? (this.app.paths.joining ? 'Click to join the ends (a loop) · drag to move this point' : 'Drag to move this point · right-click removes it') : over === 'path' ? 'Click to edit this path · Shift-click puts a point here' : '';
    } else if (this.app.tool.kind === 'setpiece' && this.app.pieceHover) {
      const g = this.app.pieceHover;
      $('ed-target').textContent = `${g.def.displayName}: ${g.ok ? (g.blocked ? `fits; ${g.blocked} port${g.blocked === 1 ? '' : 's'} face${g.blocked === 1 ? 's' : ''} a wall` : 'fits here') : `can't go here: ${g.reason}`}`;
    } else if (refused) {
      const g = this.entityGhost()!;
      $('ed-target').textContent = `${g.title} can't be placed here: ${g.note.text.charAt(0).toLowerCase()}${g.note.text.slice(1)}`;
    } else $('ed-target').textContent = this.app.placing.zoneNote();
    const cell = this.app.hoverCell ? ([this.app.hoverCell[0], this.app.hoverCell[1], this.app.level] as [number, number, number]) : null;
    this.app.view.setHoverCell(this.app.doc, this.app.tool.kind === 'tile' || this.app.tool.kind === 'setpiece' || this.app.tool.kind === 'spawn' || this.app.tool.kind === 'pickup' || this.app.tool.kind === 'scenario' || this.app.tool.kind === 'npc' ? cell : null);
    if (this.app.tool.kind === 'tile' && cell) {
      const check = this.tileGhost(this.app.tool.tile, cell);
      // The whole reason on the status line (the note beside the pointer has it in a few words).
      if (!check.ok) $('ed-target').textContent = check.reason.charAt(0).toUpperCase() + check.reason.slice(1);
      this.app.view.setGhost(this.app.doc, this.app.tool.tile, cell, this.app.rotation, check.ok);
    } else {
      this.app.view.setGhost(this.app.doc, null, null, 0, true);
    }
  }

  /**
   * Whether the tile tool's ghost fits, and why not (ghostWhy.ts): worked out once per tile, cell, turn and document
   * version, so moving within a cell costs nothing.
   */
  tileGhost(tile: string, cell: [number, number, number]): PlacementCheck {
    const at = `${tile}:${cell.join(',')}:${this.app.rotation}:${this.app.history.revision}`;
    if (this.tileGhostAt?.at !== at) this.tileGhostAt = { at, check: tileGhostCheck(this.app.doc, tile, cell[0], cell[1], cell[2], this.app.rotation) };
    return this.tileGhostAt.check;
  }
  tileGhostAt: { at: string; check: PlacementCheck } | null = null;

  /**
   * The note beside the pointer for the entity tools (spawns, pickups, props, vehicles, NPCs, objects): nothing under
   * it, outside the boundary, the scenery zone (ghostWhy.ts). Once per spot and document version.
   */
  entityGhost(): { title: string; note: GhostNote } | null {
    const t = this.app.tool;
    let kind: GhostEntityKind;
    let at: [number, number, number] | null;
    let title: string;
    let model = '';
    if (t.kind === 'spawn') [kind, at, title] = ['spawn', this.app.placing.placeSpot(), 'Spawn point'];
    else if (t.kind === 'pickup') [kind, at, title] = ['pickup', this.app.placing.placeSpot(), getItem(t.item)?.displayName ?? 'Pickup'];
    else if (t.kind === 'prop') [kind, at, title, model] = ['prop', this.app.placing.propSpot(t.model), getProp(t.model)?.displayName ?? 'Prop', t.model];
    else if (t.kind === 'mount') [kind, at, title] = ['mount', this.app.placing.placeSpot(), MOUNT_DEFS[t.model].displayName];
    else if (t.kind === 'npc') [kind, at, title] = ['npc', this.app.placing.placeSpot(), NPC_PALETTE.find((x) => x.key === t.key)?.label ?? 'NPC'];
    else if (t.kind === 'scenario') [kind, at, title] = [t.key.startsWith('spawn:') ? 'spawn' : 'object', this.app.placing.scenarioSpot(t.key)?.p ?? null, SCENARIO_PALETTE.find((x) => x.key === t.key)?.label ?? 'Object'];
    else return null;
    if (!at) return null;
    const key = `${t.kind}:${title}:${at.join(',')}:${this.app.history.revision}:${this.app.level}:${this.app.showAll}`;
    if (this.entityGhostAt?.key !== key) {
      // What it would stand on: the map as drawn with its blocks and solid props (surfaceBoxes), the ground as shown, liquids.
      const liquids = this.app.viewDoc.entities.filter((e) => e.kind === 'water');
      const note = entityGhostNote(this.app.doc, kind, at, { boxes: this.app.placing.surfaceBoxes(), terrain: this.app.shownGround, liquids }, model);
      this.entityGhostAt = { key, value: note && { title, note } };
    }
    return this.entityGhostAt.value;
  }
  entityGhostAt: { key: string; value: { title: string; note: GhostNote } | null } | null = null;
}
