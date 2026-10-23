import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
// Side-effect import: registers scene.createPickingRay.
import '@babylonjs/core/Culling/ray';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import type { MapDocument, MapEntity, Rotation, Vec3, WorldBox } from '@chronosplit/shared';
import { DESTRUCTIBLE_SPECS, PLAYER, buildMapDecor, buildMapGeometry, getProp, mapFactions, mapTeams, placementCells, viewDirection } from '@chronosplit/shared';
import { ScenarioVisuals } from '../game/scenarioVisuals.ts';
import { MapStyler, boxVertexData } from '../mapMeshes.ts';
import { ModelLibrary } from '../content/models.ts';
import { PICKUP_HOVER, createPickupVisual } from '../game/pickupVisuals.ts';
import { createPropNode } from '../game/propVisuals.ts';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';

interface EntityMarker {
  key: string;
  node: TransformNode;
  /** Selection outline for pickups. */
  ring?: Mesh;
}

const GRID_EXTENT = 12;

/**
 * Editor scene: the map (with floor isolation), active-level grid, ghost
 * preview, selection/hover outlines, spawn and pickup markers, and a free-fly camera.
 * Pure presentation: it never changes the document.
 */
export class EditorView {
  readonly scene: Scene;
  readonly camera: FreeCamera;
  yaw = 0;
  pitch = -0.9;
  private readonly styler: MapStyler;
  private faceHighlight?: Mesh;
  private grid?: LinesMesh;
  private hover?: Mesh;
  private ghost?: Mesh;
  private ghostKey = '';
  private outlines: Mesh[] = [];
  private markers = new Map<string, EntityMarker>();
  private readonly models: ModelLibrary;
  private readonly scenario: ScenarioVisuals;
  private readonly mat: Record<'ghostOk' | 'ghostBad' | 'outline' | 'outlineBad' | 'hover' | 'spawn' | 'spawnSel' | 'visor' | 'face', StandardMaterial>;

  constructor(engine: AbstractEngine) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.16, 0.18, 0.21, 1);
    this.scene.skipPointerMovePicking = true;
    this.camera = new FreeCamera('editorCam', new Vector3(0, 22, -18), this.scene);
    this.camera.inputs.clear();
    this.camera.minZ = 0.1;
    this.camera.maxZ = 2000;
    this.camera.fov = 1.0;
    const hemi = new HemisphericLight('hemi', new Vector3(0.3, 1, 0.2), this.scene);
    hemi.intensity = 0.8;
    hemi.groundColor = new Color3(0.3, 0.3, 0.32);
    new DirectionalLight('sun', new Vector3(-0.4, -1, 0.3), this.scene).intensity = 0.5;
    this.styler = new MapStyler(this.scene);
    this.models = new ModelLibrary(this.scene);
    this.scenario = new ScenarioVisuals(this.scene, { editor: true });

    const flat = (name: string, hex: string, alpha = 1, wire = false) => {
      const m = new StandardMaterial(name, this.scene);
      m.diffuseColor = Color3.FromHexString(hex);
      m.emissiveColor = Color3.FromHexString(hex).scale(wire ? 1 : 0.35);
      m.specularColor = Color3.Black();
      m.alpha = alpha;
      m.wireframe = wire;
      m.disableLighting = wire;
      return m;
    };
    this.mat = {
      ghostOk: flat('ghostOk', '#58d68d', 0.45),
      ghostBad: flat('ghostBad', '#ff5a4f', 0.45),
      outline: flat('outline', '#ffb03b', 1, true),
      outlineBad: flat('outlineBad', '#ff5a4f', 1, true),
      hover: flat('hover', '#ffffff', 1, true),
      spawn: flat('spawn', '#4fb3ff'),
      spawnSel: flat('spawnSel', '#ffb03b'),
      visor: flat('visorMat', '#1c1f26'),
      face: flat('faceHi', '#ffb03b', 0.35),
    };
    this.applyCamera();
  }

  // ---------- camera ----------

  applyCamera(): void {
    this.camera.rotation.set(-this.pitch, this.yaw, 0);
  }

  /** Move relative to the view: forward along yaw, right, and world up. */
  fly(forward: number, right: number, up: number): void {
    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    this.camera.position.x += s * forward + c * right;
    this.camera.position.z += c * forward - s * right;
    this.camera.position.y += up;
  }

  dolly(amount: number): void {
    const d = viewDirection(this.yaw, this.pitch);
    this.camera.position.addInPlace(new Vector3(d.x * amount, d.y * amount, d.z * amount));
  }

  look(dYaw: number, dPitch: number): void {
    this.yaw += dYaw;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch + dPitch));
    this.applyCamera();
  }

  focus(target: Vec3): void {
    this.pitch = -0.85;
    this.applyCamera();
    const d = viewDirection(this.yaw, this.pitch);
    const dist = 22;
    this.camera.position.set(target.x - d.x * dist, target.y - d.y * dist, target.z - d.z * dist);
  }

  /** World-space ray under the pointer. */
  pointerRay(clientX: number, clientY: number): { origin: Vec3; dir: Vec3 } | null {
    const rect = this.scene.getEngine().getRenderingCanvasClientRect();
    if (!rect) return null;
    const ray = this.scene.createPickingRay(clientX - rect.left, clientY - rect.top, null, this.camera);
    return { origin: { x: ray.origin.x, y: ray.origin.y, z: ray.origin.z }, dir: { x: ray.direction.x, y: ray.direction.y, z: ray.direction.z } };
  }

  /** Intersect the pointer ray with the horizontal plane y = planeY. */
  pickPlane(clientX: number, clientY: number, planeY: number): Vec3 | null {
    const rect = this.scene.getEngine().getRenderingCanvasClientRect();
    if (!rect) return null;
    const ray = this.scene.createPickingRay(clientX - rect.left, clientY - rect.top, null, this.camera);
    if (Math.abs(ray.direction.y) < 1e-6) return null;
    const t = (planeY - ray.origin.y) / ray.direction.y;
    if (t <= 0) return null;
    return { x: ray.origin.x + ray.direction.x * t, y: planeY, z: ray.origin.z + ray.direction.z * t };
  }

  /** Screen (client) coordinates of a world point; used by automation and future tooltips. */
  project(p: Vec3): { x: number; y: number } {
    const engine = this.scene.getEngine();
    const rect = engine.getRenderingCanvasClientRect()!;
    const v = Vector3.Project(new Vector3(p.x, p.y, p.z), Matrix.Identity(), this.scene.getTransformMatrix(), this.camera.viewport.toGlobal(rect.width, rect.height));
    return { x: rect.left + v.x, y: rect.top + v.y };
  }

  // ---------- content ----------

  /** Rebuild map meshes. Tiles above the active level are hidden unless showAll. */
  setMap(doc: MapDocument, level: number, showAll: boolean): WorldBox[] {
    const visibleTiles = showAll ? doc.classicStructure.tiles : doc.classicStructure.tiles.filter((t) => t.z <= level);
    const visible = { ...doc, classicStructure: { ...doc.classicStructure, tiles: visibleTiles } };
    const boxes = buildMapGeometry(visible);
    this.styler.build(visible, boxes, 'edmap');
    const sky = MapStyler.skyColor(doc).scale(0.45);
    this.scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
    this.setGrid(doc, level);
    this.setEntities(doc, level, showAll, new Set());
    // Trim is pickable too, so it can be painted.
    return [...boxes, ...buildMapDecor(visible)];
  }

  private setGrid(doc: MapDocument, level: number): void {
    this.grid?.dispose();
    const { cellSize, levelHeight } = doc.classicStructure;
    const y = level * levelHeight + 0.03;
    const lines: Vector3[][] = [];
    const lo = (-GRID_EXTENT - 0.5) * cellSize;
    const hi = (GRID_EXTENT + 0.5) * cellSize;
    for (let i = -GRID_EXTENT; i <= GRID_EXTENT + 1; i++) {
      const v = (i - 0.5) * cellSize;
      lines.push([new Vector3(v, y, lo), new Vector3(v, y, hi)], [new Vector3(lo, y, v), new Vector3(hi, y, v)]);
    }
    this.grid = CreateLineSystem('grid', { lines }, this.scene);
    this.grid.color = new Color3(0.45, 0.5, 0.58);
    this.grid.alpha = 0.6;
    this.grid.isPickable = false;
  }

  /** Spawn markers and pickup previews for entities on visible levels; selected ones are highlighted. */
  private readonly teamMats = new Map<string, StandardMaterial>();

  /** Spawn marker material in a team's colour. */
  private teamMaterial(color: string): StandardMaterial {
    let m = this.teamMats.get(color);
    if (!m) {
      m = new StandardMaterial(`spawnteam_${color}`, this.scene);
      m.diffuseColor = Color3.FromHexString(color);
      m.emissiveColor = Color3.FromHexString(color).scale(0.35);
      this.teamMats.set(color, m);
    }
    return m;
  }

  /** Map layers switched off in the inspector: 'prop', 'spawn', 'pickup', 'logic'. */
  readonly hiddenLayers = new Set<string>();

  setEntities(doc: MapDocument, level: number, showAll: boolean, selected: ReadonlySet<string>): void {
    const { levelHeight } = doc.classicStructure;
    const seen = new Set<string>();
    const factions = mapFactions(doc);
    const factionColor = (id: string) => factions.find((f) => f.id === id)?.color ?? '#888888';
    this.scenario.factionColor = factionColor;
    const teams = mapTeams(doc);
    for (const e of doc.entities) {
      if (!showAll && e.position[1] > level * levelHeight + levelHeight - 0.1) continue;
      seen.add(e.id);
      // Rebuild a marker when the entity changed kind, item or any scenario property.
      const key = e.kind === 'pickup' ? `pickup:${e.item}` : e.kind === 'spawn' ? 'spawn' : JSON.stringify({ ...e, position: null, name: null, color: e.kind === 'encounter' ? factionColor(e.faction) : null });
      let m = this.markers.get(e.id);
      if (m && m.key !== key) {
        m.node.dispose(false, false);
        m.ring?.dispose();
        m = undefined;
      }
      if (!m) {
        m =
          e.kind === 'spawn'
            ? this.createSpawnMarker(e.id)
            : e.kind === 'pickup'
              ? { key, node: createPickupVisual(this.scene, this.models, e.item, `edpickup_${e.id}`) }
              : e.kind === 'prop'
                ? { key, node: createPropNode(this.scene, this.models, e, `edprop_${e.id}`, false) }
                : { key, node: this.scenario.createNode(e, `ed_${e.id}`) };
        m.key = key;
        this.markers.set(e.id, m);
      }
      const layer = e.kind === 'prop' || e.kind === 'spawn' || e.kind === 'pickup' ? e.kind : 'logic';
      m.node.setEnabled(!this.hiddenLayers.has(layer));
      if (e.kind === 'spawn') {
        m.node.position.set(e.position[0], e.position[1] + PLAYER.height / 2, e.position[2]);
        m.node.rotation.y = e.yaw;
        (m.node as Mesh).material = selected.has(e.id) ? this.mat.spawnSel : e.faction ? this.teamMaterial(teams.find((t) => t.id === e.faction)?.color ?? '#888888') : this.mat.spawn;
      } else {
        const scenario = e.kind !== 'pickup';
        m.node.position.set(e.position[0], e.position[1] + (scenario ? 0 : PICKUP_HOVER), e.position[2]);
        if ('yaw' in e && scenario) m.node.rotation.y = e.yaw;
        if (selected.has(e.id) && !m.ring) {
          m.ring = CreateCylinder(`edsel_${e.id}`, { diameter: selectionSize(e), height: 1.2, tessellation: 24 }, this.scene);
          m.ring.material = this.mat.outline;
          m.ring.isPickable = false;
        } else if (!selected.has(e.id) && m.ring) {
          m.ring.dispose();
          m.ring = undefined;
        }
        m.ring?.position.set(e.position[0], e.position[1] + 0.6, e.position[2]);
      }
    }
    for (const [id, m] of this.markers) {
      if (!seen.has(id)) {
        m.node.dispose(false, false);
        m.ring?.dispose();
        this.markers.delete(id);
      }
    }
  }

  private createSpawnMarker(id: string): EntityMarker {
    const m = CreateCapsule(`spawn_${id}`, { height: PLAYER.height, radius: PLAYER.radius, tessellation: 10 }, this.scene);
    const visor = CreateBox(`spawnvisor_${id}`, { width: 0.5, height: 0.14, depth: 0.5 }, this.scene);
    visor.parent = m;
    visor.position = new Vector3(0, PLAYER.eyeHeight - PLAYER.height / 2, PLAYER.radius);
    visor.material = this.mat.visor;
    m.isPickable = false;
    return { key: 'spawn', node: m };
  }

  setHoverCell(doc: MapDocument, cell: [number, number, number] | null): void {
    if (!cell) {
      this.hover?.setEnabled(false);
      return;
    }
    const { cellSize, levelHeight } = doc.classicStructure;
    if (!this.hover) {
      this.hover = CreateBox('hover', { size: 1 }, this.scene);
      this.hover.material = this.mat.hover;
      this.hover.isPickable = false;
    }
    this.hover.setEnabled(true);
    this.hover.scaling.set(cellSize, 0.05, cellSize);
    this.hover.position.set(cell[0] * cellSize, cell[2] * levelHeight + 0.05, cell[1] * cellSize);
  }

  /** Translucent preview of a tile about to be placed. */
  setGhost(doc: MapDocument, tile: string | null, cell: [number, number, number] | null, rotation: Rotation, ok: boolean): void {
    if (!tile || !cell) {
      this.ghost?.setEnabled(false);
      return;
    }
    const key = `${tile}:${rotation}`;
    if (key !== this.ghostKey) {
      this.ghost?.dispose();
      const single: MapDocument = { ...doc, classicStructure: { ...doc.classicStructure, tiles: [{ id: 'ghost', tile, x: 0, y: 0, z: 0, rotation }] } };
      this.ghost = new Mesh('ghost', this.scene);
      boxVertexData(buildMapGeometry(single)).applyToMesh(this.ghost);
      this.ghost.isPickable = false;
      this.ghostKey = key;
    }
    const { cellSize, levelHeight } = doc.classicStructure;
    this.ghost!.setEnabled(true);
    this.ghost!.material = ok ? this.mat.ghostOk : this.mat.ghostBad;
    this.ghost!.position.set(cell[0] * cellSize, cell[2] * levelHeight + 0.01, cell[1] * cellSize);
  }

  /** Outline every cell of the given tiles, optionally offset (drag preview). */
  setOutlines(doc: MapDocument, tileIds: readonly string[], offset: [number, number, number] = [0, 0, 0], bad = false): void {
    for (const o of this.outlines) o.dispose();
    this.outlines = [];
    const { cellSize, levelHeight } = doc.classicStructure;
    const ids = new Set(tileIds);
    for (const t of doc.classicStructure.tiles) {
      if (!ids.has(t.id)) continue;
      for (const [x, y, z] of placementCells(t) ?? []) {
        const box = CreateBox('outline', { width: cellSize - 0.1, depth: cellSize - 0.1, height: levelHeight - 0.1 }, this.scene);
        box.position.set((x + offset[0]) * cellSize, (z + offset[2]) * levelHeight + levelHeight / 2, (y + offset[1]) * cellSize);
        box.material = bad ? this.mat.outlineBad : this.mat.outline;
        box.isPickable = false;
        this.outlines.push(box);
      }
    }
  }

  /** Highlight one face of a box (paint hover); null hides it. */
  setFaceHighlight(box: WorldBox | null, normal: readonly [number, number, number] | null): void {
    if (!box || !normal) {
      this.faceHighlight?.setEnabled(false);
      return;
    }
    if (!this.faceHighlight) {
      this.faceHighlight = CreateBox('faceHi', { size: 1 }, this.scene);
      this.faceHighlight.material = this.mat.face;
      this.faceHighlight.isPickable = false;
    }
    const size = [box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]];
    const center = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2];
    const axis = normal.findIndex((v) => v !== 0);
    const pad = 0.02;
    const scale = size.map((v, i) => (i === axis ? pad : v + pad));
    const pos = center.map((c, i) => (i === axis ? c + (normal[i]! * size[i]!) / 2 : c));
    this.faceHighlight.setEnabled(true);
    this.faceHighlight.scaling.set(scale[0]!, scale[1]!, scale[2]!);
    this.faceHighlight.position.set(pos[0]!, pos[1]!, pos[2]!);
  }

  render(): void {
    this.scene.render();
  }
}

/** Diameter of the selection outline around an entity. */
function selectionSize(e: MapEntity): number {
  switch (e.kind) {
    case 'door':
      return 3.4;
    case 'zone':
      return Math.max(e.size[0], e.size[2]) * 1.2;
    case 'encounter':
      return e.radius * 2 + 0.4;
    case 'trap':
      return e.trap === 'mine' ? 1.1 : e.trap === 'flames' ? 1.4 : 3.6;
    case 'destructible':
      return Math.max(DESTRUCTIBLE_SPECS[e.model].half.x, DESTRUCTIBLE_SPECS[e.model].half.z) * 2.4;
    case 'prop': {
      const size = getProp(e.model)?.size ?? [1, 1, 1];
      return Math.max(size[0], size[2]) * e.scale * 1.25 + 0.2;
    }
    default:
      return 1.1;
  }
}
