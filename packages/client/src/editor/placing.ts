import {
  addSpawnCommand,
  buildZone,
  coreCatalog,
  deleteCommand,
  FREE_MEASURE_KEYS,
  getItem,
  getProp,
  ghostRefuses,
  levelName,
  MOUNT_DEFS,
  moverGroupOf,
  newId,
  newScenarioEntities,
  placeNpcCommand,
  placeTileCommand,
  propDrop,
  SCENARIO_PALETTE,
  settledPropY,
  snapMeasurePoint,
  snapsToDoorway,
  snapToDoorway,
  surfaceHit,
  type MapEntity,
  type MeasurePoint,
  type ScenarioPaletteKey,
  type Selection,
  type Vec3,
  type WorldBox
} from '@tiletrigger/shared';
import type { EditorApp } from './editorApp.ts';
import { addedEntities, snap } from './editorParts.ts';

/** Placing and erasing: where each kind of thing lands under the pointer (snapped, on the ground, in a doorway, on a surface), what the placing tools' ghosts show, and Erase (split out of editorApp.ts, MapMaker overhaul Phase 2 item 5). */
export class Placing {
  constructor(readonly app: EditorApp) {}

  /** Where the pointer is, outside the play area: the scenery zone (building is fine) or past the build limit. */
  zoneNote(): string {
    const p = this.app.hoverPoint;
    if (!p) return '';
    const zone = buildZone(this.app.doc, p.x, p.z);
    if (zone === 'scenery') return 'Scenery zone, outside the playable boundary: building here is fine';
    if (zone === 'beyond') return 'Past the build limit: no tiles can be placed here';
    return '';
  }

  placeAtHover(): void {
    // Spawns, pickups, props, vehicles and NPCs over nothing or outside the boundary: the ghost is red and says why, and the click places nothing (ghostWhy.ts).
    if (ghostRefuses(this.app.entityGhost()?.note)) return;
    if (this.app.tool.kind === 'setpiece' && this.app.hoverCell) {
      const [x, y, z] = this.app.hoverCell;
      this.app.pieces.placeSetPiece(this.app.tool.piece, x, y, z);
    } else if (this.app.tool.kind === 'tile' && this.app.hoverCell) {
      const [x, y, z] = this.app.hoverCell;
      const placed = placeTileCommand(this.app.doc, this.app.tool.tile, x, y, z, this.app.rotation);
      if ('error' in placed) return this.app.toast(`Can't place: ${placed.error}`, true);
      if (placed.floorOf) {
        // A Platform on another piece's empty upper storey: that piece's own floor there (one cell, one piece).
        const host = coreCatalog.get(placed.floorOf.tile)?.displayName ?? placed.floorOf.tile;
        if (this.app.run(`Floor on ${levelName(z)} of ${host}`, placed.command)) this.app.toast(`${host}: a floor on ${levelName(z)} here (part of the ${host}: untick “Floor on ${levelName(z)}” in its inspector to take it out)`);
        return;
      }
      const name = coreCatalog.get(this.app.tool.tile)?.displayName ?? this.app.tool.tile;
      this.app.run(`Place ${name}`, placed.command);
    } else if (this.app.tool.kind === 'spawn' && this.app.hoverPoint) {
      const p = this.placeSpot()!;
      const { command, id } = addSpawnCommand(p, this.app.spawnYaw);
      if (this.app.run('Place spawn', command)) this.app.setSelection({ tiles: [], entities: [id] });
    } else if (this.app.tool.kind === 'pickup' && this.app.hoverPoint) {
      const p = this.placeSpot()!;
      const id = newId('pickup');
      const name = getItem(this.app.tool.item)?.displayName ?? 'pickup';
      if (this.app.run(`Place ${name}`, { kind: 'addEntities', entities: [{ id, kind: 'pickup', position: p, item: this.app.tool.item, respawnSeconds: null }] })) this.app.setSelection({ tiles: [], entities: [id] });
    } else if (this.app.tool.kind === 'prop' && this.app.hoverPoint) {
      // Where the ghost shows it: on the surface under the pointer, with Randomise's next turn, size and variant.
      const { at: p, yaw, scale, variant } = this.propPlacement(this.app.tool.model);
      const id = newId('prop');
      const name = getProp(this.app.tool.model)?.displayName ?? 'prop';
      if (!this.app.env.confirmPlace(this.app.tool.model, p!, scale, variant)) return;
      if (this.app.run(`Place ${name}`, { kind: 'addEntities', entities: [{ id, kind: 'prop', position: p!, model: this.app.tool.model, yaw, scale, solid: true, tint: null, ...(variant !== undefined ? { variant } : {}) }] })) {
        this.app.propOpts.placed();
        this.app.setSelection({ tiles: [], entities: [id] });
      }
    } else if (this.app.tool.kind === 'mount' && this.app.hoverPoint) {
      const p = this.placeSpot()!;
      const id = newId('mount');
      const def = MOUNT_DEFS[this.app.tool.model];
      if (this.app.run(`Place ${def.displayName}`, { kind: 'addEntities', entities: [{ id, kind: 'mount', position: p, model: this.app.tool.model, yaw: this.app.propYaw, faction: null, respawnSeconds: null }] })) this.app.setSelection({ tiles: [], entities: [id] });
    } else if (this.app.tool.kind === 'scenario' && this.app.hoverPoint) {
      const { p, yaw } = this.scenarioSpot(this.app.tool.key)!;
      const placed = newScenarioEntities(this.app.tool.key, p, yaw, this.app.doc);
      const entity = placed[placed.length - 1]!;
      const label = SCENARIO_PALETTE.find((x) => x.key === (this.app.tool as { key: string }).key)?.label ?? 'object';
      if (this.app.run(`Place ${label}`, { kind: 'addEntities', entities: placed })) this.app.setSelection({ tiles: [], entities: [entity.id] });
    } else if (this.app.tool.kind === 'npc' && this.app.hoverPoint) {
      const r = placeNpcCommand(this.app.doc, this.app.tool.key, this.placeSpot()!, this.app.scenarioYaw);
      if ('error' in r) return this.app.toast(r.error, true);
      if (this.app.run(`Place ${r.label}`, r.command)) this.app.setSelection({ tiles: [], entities: [r.id] });
    }
  }

  /** Where the Scenario tool puts an object, and its facing: on the level's floor, or in the doorway for doors and the like. */
  scenarioSpot(key: ScenarioPaletteKey): { p: [number, number, number]; yaw: number } | null {
    if (!this.app.hoverPoint) return null;
    // Game modes' markers stand on the ground under the pointer, like spawns and pickups (a Breakthrough spawn group on a
    // hill went in at the level's height, under the hill); the rest go on the level being edited.
    const onGround = this.app.hoverOnTerrain && /^(spawn:|objective:|sector$|flag$|hill$|bombsite$|hostage$|rescue$)/.test(key);
    const y = onGround ? Math.round(this.app.hoverPoint.y * 100) / 100 : this.app.level * this.app.doc.classicStructure.levelHeight;
    if (snapsToDoorway(key)) {
      const d = snapToDoorway(this.app.hoverPoint.x, this.app.hoverPoint.z, this.app.doc.classicStructure.cellSize);
      return { p: [d.x, y, d.z], yaw: d.yaw };
    }
    return { p: [snap(this.app.hoverPoint.x, this.app.snapStep(0.5)), y, snap(this.app.hoverPoint.z, this.app.snapStep(0.5))], yaw: this.app.scenarioYaw };
  }

  /** What the Scenario or NPC tool would place: made once per object, facing and edit (factions, sizes), then moved with the pointer. */
  objectGhostCache: { key: string; at: [number, number, number]; entities: MapEntity[] } | null = null;

  objectGhost(): { key: string; entities: MapEntity[] } | null {
    const t = this.app.tool;
    const spot = t.kind === 'scenario' ? this.scenarioSpot(t.key) : t.kind === 'npc' && this.app.hoverPoint ? { p: this.placeSpot()!, yaw: this.app.scenarioYaw } : null;
    if (!spot || (t.kind !== 'scenario' && t.kind !== 'npc')) return null;
    const key = `${t.kind}:${t.key}:${spot.yaw}:${this.app.history.revision}`;
    let c = this.objectGhostCache;
    if (c?.key !== key) {
      const entities = t.kind === 'scenario' ? newScenarioEntities(t.key, spot.p, spot.yaw, this.app.doc) : addedEntities(placeNpcCommand(this.app.doc, t.key, spot.p, spot.yaw));
      c = this.objectGhostCache = { key, at: spot.p, entities };
    }
    const [dx, dy, dz] = [spot.p[0] - c.at[0], spot.p[1] - c.at[1], spot.p[2] - c.at[2]];
    return { key, entities: c.entities.map((e) => ({ ...e, position: [e.position[0] + dx, e.position[1] + dy, e.position[2] + dz] }) as MapEntity) };
  }

  /** Erase what's under the pointer, picked the way Select picks it: a whole moving build (Alt: just that piece). */
  eraseAtHover(single = false): void {
    const hit = this.app.pick();
    if (!hit) return this.app.toast(`Nothing to erase here on ${levelName(this.app.level)}`, true);
    const group = hit.kind === 'entity' && !single ? moverGroupOf(this.app.doc, hit.id) : null;
    const sel: Selection = hit.kind === 'tile' ? { tiles: [hit.id], entities: [] } : hit.kind === 'setpiece' ? { tiles: [], entities: [], setPieces: [hit.id] } : { tiles: [], entities: group ?? [hit.id] };
    const name = group && group.length > 1 ? 'moving build' : this.app.targetName(hit);
    if (this.app.run(`Erase ${name}`, deleteCommand(this.app.doc, sel))) this.app.toast(`Erased ${name} · Ctrl+Z to undo`);
  }

  /**
   * One placement rule for spawns, pickups, vehicles and NPCs: on the terrain where the pointer
   * meets it, else on the floor of the level being edited; snapped to the snap setting (Ctrl or
   * Shift: free).
   */
  placeSpot(step = 0.5): [number, number, number] | null {
    const h = this.app.hoverPoint;
    if (!h) return null;
    const y = this.app.hoverOnTerrain ? Math.round(h.y * 100) / 100 : this.app.level * this.app.doc.classicStructure.levelHeight;
    return [snap(h.x, this.app.snapStep(step)), y, snap(h.z, this.app.snapStep(step))];
  }

  /** The prop tool's next placement of `model`: where (propSpot) and, with Randomise, its turn, size and variant. */
  propPlacement(model: string): { at: [number, number, number] | null; yaw: number; scale: number; variant?: number } {
    const roll = this.app.propOpts.next(model, this.app.propYaw);
    return { at: this.propSpot(model, roll.yaw, roll.scale), yaw: roll.yaw, scale: roll.scale, ...(roll.variant !== undefined ? { variant: roll.variant } : {}) };
  }

  /**
   * Where a prop of `model` goes under the pointer: on whatever the pointer is over (a tabletop, a roof, a ledge, the
   * ground: surfaceSnap's propDrop against the map as drawn and the ground as shown), its x and z snapped (Ctrl or
   * Shift: free). On the ground it is bedded into the document's own ground (the view re-beds it on the ground as
   * shown). Over nothing, on the level being edited, as before.
   */
  propSpot(model: string, yaw = this.app.propYaw, scale = 1): [number, number, number] | null {
    if (!this.app.hoverPoint) return null;
    const free = this.app.freePlacing();
    const step = this.app.snapStep(0.25);
    const snapXZ = (v: number) => (free ? Math.round(v * 100) / 100 : snap(v, step));
    const ray = this.app.ray;
    const def = getProp(model);
    const drop = ray ? propDrop(ray.origin, ray.dir, this.surfaceBoxes(), this.app.shownGround, { model, yaw, scale, ...(def ? { size: def.size } : {}) }, snapXZ) : null;
    // On an upper level, the level's own plane where it is nearer (placing over open air up there, as before).
    const plane = this.app.level > 0 && !this.app.hoverOnTerrain && ray ? Math.hypot(this.app.hoverPoint.x - ray.origin.x, this.app.hoverPoint.y - ray.origin.y, this.app.hoverPoint.z - ray.origin.z) : Infinity;
    if (drop && drop.hit.distance <= plane) {
      const p = drop.position;
      if (drop.on === 'ground' && this.app.doc.terrain) p[1] = settledPropY(this.app.doc.terrain, { model, position: p, yaw, scale }) ?? p[1];
      return p;
    }
    const p: [number, number, number] = [snapXZ(this.app.hoverPoint.x), this.app.level * this.app.doc.classicStructure.levelHeight, snapXZ(this.app.hoverPoint.z)];
    if (this.app.hoverOnTerrain && this.app.doc.terrain) p[1] = settledPropY(this.app.doc.terrain, { model, position: p, yaw, scale }) ?? p[1];
    return p;
  }

  /** What props and the measure tool land on: the map as drawn, with its blocks and solid props. */
  surfaceBoxes(): WorldBox[] {
    return this.app.surfaces.get(this.app.viewDoc, this.app.visibleBoxes, this.app.level, this.app.showAll);
  }

  /** The measure tool's point under the pointer: snapped to the grid, surfaces and objects' tops (Ctrl or Alt: free). */
  /** Where a bot hint goes under the pointer: the top of what is there (a roof, a ledge, the ground), else the level's plane. */
  hintPointAtHover(): Vec3 | null {
    const ray = this.app.ray;
    const hit = ray ? surfaceHit(ray.origin, ray.dir, this.surfaceBoxes(), this.app.shownGround) : null;
    const p = hit && hit.on !== 'side' ? hit.point : this.app.hoverPoint;
    return p && { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, z: Math.round(p.z * 100) / 100 };
  }

  measurePointAtHover(): MeasurePoint | null {
    const ray = this.app.ray;
    if (!ray) return null;
    const boxes = this.surfaceBoxes();
    const hit = surfaceHit(ray.origin, ray.dir, boxes, this.app.shownGround);
    const free = FREE_MEASURE_KEYS.some((k) => this.app.keys.has(k));
    if (!hit) {
      const p = this.app.hoverPoint;
      return p ? { at: { x: p.x, y: p.y, z: p.z }, snapped: 'free' } : null;
    }
    return snapMeasurePoint(hit, boxes, this.app.shownGround, this.app.snapStep(0.5), free, (id) => this.app.surfaces.objects.has(id));
  }
}
