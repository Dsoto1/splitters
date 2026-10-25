import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import '@babylonjs/core/Rendering/edgesRenderer';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
// Side-effect import: registers scene.createPickingRay.
import { Ray } from '@babylonjs/core/Culling/ray';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import type { MapDocument, MapEntity, PropEntity, Rotation, TerrainData, Vec3, WorldBox } from '@tiletrigger/shared';
import { DESTRUCTIBLE_SPECS, MAX_TEAMS, PLAYER, buildMapDecor, buildMapGeometry, getProp, terrainHeightAt, yawXZ, mapFactions, mapTeams, placementCells, viewDirection } from '@tiletrigger/shared';
import { ScenarioVisuals } from '../game/scenarioVisuals.ts';
import { applyToneMapping } from '../game/atmosphere.ts';
import { MapStyler, boxVertexData } from '../mapMeshes.ts';
import { BackdropVisuals } from '../backdrop.ts';
import { FoliageVisuals } from '../foliage.ts';
import { ModelLibrary } from '../content/models.ts';
import { PICKUP_HOVER, createPickupVisual } from '../game/pickupVisuals.ts';
import { createPropNode, orientProp } from '../game/propVisuals.ts';
import { createMountNode } from '../game/mountVisuals.ts';
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
  private readonly backdrop: BackdropVisuals;
  private readonly foliage: FoliageVisuals;
  private foliageTerrain: MapDocument['terrain'] = null;
  private foliageKey = '';
  private faceHighlight?: Mesh;
  private brushRing?: LinesMesh;
  private grid?: LinesMesh;
  private hover?: Mesh;
  private ghost?: Mesh;
  private ghostKey = '';
  private outlines: Mesh[] = [];
  private markers = new Map<string, EntityMarker>();
  private readonly models: ModelLibrary;
  private readonly scenario: ScenarioVisuals;
  private readonly mat: Record<'ghostOk' | 'ghostBad' | 'outline' | 'outlineBad' | 'hover' | 'spawn' | 'spawnSel' | 'visor' | 'face' | 'erase' | 'pick' | 'eraseFill' | 'pickFill', StandardMaterial>;
  /** Draws the levels other than the one being edited, ghosted. */
  private readonly dimStyler: MapStyler;
  /** Marker root node -> entity id, for picking entities by their meshes. */
  private readonly nodeEntity = new Map<TransformNode, string>();
  /** Hover highlight (erase: red, select: cyan) and what it was built for. */
  private pickBoxes: Mesh[] = [];
  private mapMeshes: Mesh[] = [];
  private dimMeshes: Mesh[] = [];
  private gizmo?: LinesMesh;
  private pickKey = '';

  constructor(engine: AbstractEngine) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.16, 0.18, 0.21, 1);
    applyToneMapping(this.scene, { vignette: false });
    this.scene.skipPointerMovePicking = true;
    this.camera = new FreeCamera('editorCam', new Vector3(0, 22, -18), this.scene);
    this.camera.inputs.clear();
    this.camera.minZ = 0.1;
    this.camera.maxZ = 4000;
    this.camera.fov = 1.0;
    const hemi = new HemisphericLight('hemi', new Vector3(0.3, 1, 0.2), this.scene);
    hemi.intensity = 0.8;
    hemi.groundColor = new Color3(0.3, 0.3, 0.32);
    new DirectionalLight('sun', new Vector3(-0.4, -1, 0.3), this.scene).intensity = 0.5;
    this.styler = new MapStyler(this.scene);
    this.dimStyler = new MapStyler(this.scene, this.styler);
    this.backdrop = new BackdropVisuals(this.scene, this.styler);
    this.models = new ModelLibrary(this.scene);
    this.foliage = new FoliageVisuals(this.scene, this.models);
    this.scene.onBeforeRenderObservable.add(() => this.foliage.update(this.camera.position));
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
      // Light fill plus edge lines: big pieces (plazas, tall halls) shouldn't wall off the view.
      ghostOk: flat('ghostOk', '#58d68d', 0.18),
      ghostBad: flat('ghostBad', '#ff5a4f', 0.25),
      outline: flat('outline', '#ffb03b', 1, true),
      outlineBad: flat('outlineBad', '#ff5a4f', 1, true),
      hover: flat('hover', '#ffffff', 1, true),
      spawn: flat('spawn', '#4fb3ff'),
      spawnSel: flat('spawnSel', '#ffb03b'),
      visor: flat('visorMat', '#1c1f26'),
      face: flat('faceHi', '#ffb03b', 0.35),
      erase: flat('eraseHi', '#ff4d4d', 1, true),
      pick: flat('pickHi', '#00d1ff', 1, true),
      eraseFill: flat('eraseFill', '#ff4d4d', 0.22),
      pickFill: flat('pickFill', '#00d1ff', 0.12),
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
    this.clampCamera();
  }

  dolly(amount: number): void {
    const d = viewDirection(this.yaw, this.pitch);
    this.camera.position.addInPlace(new Vector3(d.x * amount, d.y * amount, d.z * amount));
    this.clampCamera();
  }

  /** Keep the camera out of the ground and within reach of the map (touchpads zoom fast). */
  private clampCamera(): void {
    const p = this.camera.position;
    p.y = Math.max(-12, Math.min(260, p.y));
    p.x = Math.max(-400, Math.min(400, p.x));
    p.z = Math.max(-400, Math.min(400, p.z));
  }

  /** Back to the starting view over `target`, looking north. */
  resetView(target: Vec3): void {
    this.yaw = 0;
    this.focus(target);
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

  /**
   * Rebuild map meshes. Tiles above the active level are hidden unless showAll;
   * every level but the active one is drawn ghosted, so the floor being edited stands out.
   */
  setMap(doc: MapDocument, level: number, showAll: boolean): WorldBox[] {
    const visibleTiles = showAll ? doc.classicStructure.tiles : doc.classicStructure.tiles.filter((t) => t.z <= level);
    const visible = { ...doc, classicStructure: { ...doc.classicStructure, tiles: visibleTiles } };
    const boxes = buildMapGeometry(visible);
    const drawn = [...boxes, ...buildMapDecor(visible)];
    const { levelHeight } = doc.classicStructure;
    const onLevel = (b: WorldBox) => Math.floor((b.min[1] + 0.3) / levelHeight) === level;
    this.mapMeshes = this.styler.buildBoxes(visible, drawn.filter(onLevel), 'edmap');
    this.styler.buildTerrain(doc, 'edmap');
    this.dimMeshes = this.dimStyler.buildBoxes(visible, drawn.filter((b) => !onLevel(b)), 'edmapdim');
    for (const m of this.dimMeshes) m.visibility = 0.4;
    this.applyTileLayer();
    this.backdrop.build(doc, boxes);
    // Regrow plants only when the ground or what stands on it changed.
    const foliageKey = doc.terrain ? `${doc.terrain.heights.length}:${boxes.length}` : '';
    if (doc.terrain !== this.foliageTerrain || foliageKey !== this.foliageKey) {
      this.foliageTerrain = doc.terrain;
      this.foliageKey = foliageKey;
      void this.foliage.grow(doc.terrain, boxes, doc.metadata.id);
    }
    this.setGrid(doc, level);
    this.setBoundsOutline(doc);
    this.setEntities(doc, level, showAll, new Set());
    // Trim is pickable too, so it can be painted.
    return drawn;
  }

  private boundsLine?: LinesMesh;

  /** The map boundary as an orange outline at floor and wall-top height. */
  private setBoundsOutline(doc: MapDocument): void {
    this.boundsLine?.dispose();
    this.boundsLine = undefined;
    const b = doc.bounds;
    if (!b) return;
    const loop = (y: number) => [new Vector3(b.min[0], y, b.min[1]), new Vector3(b.max[0], y, b.min[1]), new Vector3(b.max[0], y, b.max[1]), new Vector3(b.min[0], y, b.max[1]), new Vector3(b.min[0], y, b.min[1])];
    const posts = [[b.min[0], b.min[1]], [b.max[0], b.min[1]], [b.max[0], b.max[1]], [b.min[0], b.max[1]]].map(([x, z]) => [new Vector3(x, 0.05, z), new Vector3(x, 6, z)]);
    this.boundsLine = CreateLineSystem('bounds', { lines: [loop(0.08), loop(6), ...posts] }, this.scene);
    this.boundsLine.color = new Color3(1, 0.55, 0.1);
    this.boundsLine.isPickable = false;
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
    // The level being edited: its grid in the selection cyan.
    this.grid.color = Color3.FromHexString('#00d1ff');
    this.grid.alpha = 0.55;
    this.grid.isPickable = false;
    this.grid.setEnabled(this.gridVisible);
  }

  private gridVisible = true;

  /** Top bar Grid: show or hide the level grid. */
  setGridVisible(on: boolean): void {
    this.gridVisible = on;
    this.grid?.setEnabled(on);
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
    const flagTeams = mapTeams(doc, MAX_TEAMS);
    this.scenario.teamColor = (id) => flagTeams.find((t) => t.id === id)?.color ?? '#888888';
    this.scenario.surface = (m, t) => this.styler.surfaceMaterial(doc, m, t);
    const teams = mapTeams(doc, MAX_TEAMS);
    for (const e of doc.entities) {
      if (!showAll && e.position[1] > level * levelHeight + levelHeight - 0.1) continue;
      seen.add(e.id);
      // Rebuild a marker when the entity changed kind, item or any scenario property.
      const key = e.kind === 'pickup' ? `pickup:${e.item}` : e.kind === 'spawn' ? 'spawn' : JSON.stringify({ ...e, position: null, name: null, color: e.kind === 'encounter' ? factionColor(e.faction) : e.kind === 'flag' ? this.scenario.teamColor(e.team) : null });
      let m = this.markers.get(e.id);
      if (m && m.key !== key) {
        this.nodeEntity.delete(m.node);
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
                : e.kind === 'mount'
                  ? { key, node: createMountNode(this.scene, this.models, e.model, `edmount_${e.id}`) }
                  : { key, node: this.scenario.createNode(e, `ed_${e.id}`) };
        m.key = key;
        this.markers.set(e.id, m);
        this.nodeEntity.set(m.node, e.id);
      }
      const layer = e.kind === 'prop' || e.kind === 'spawn' || e.kind === 'pickup' ? e.kind : e.kind === 'mount' ? 'prop' : 'logic';
      m.node.setEnabled(!this.hiddenLayers.has(layer));
      if (e.kind === 'spawn') {
        m.node.position.set(e.position[0], e.position[1] + PLAYER.height / 2, e.position[2]);
        m.node.rotation.y = e.yaw;
        (m.node as Mesh).material = selected.has(e.id) ? this.mat.spawnSel : e.faction ? this.teamMaterial(teams.find((t) => t.id === e.faction)?.color ?? '#888888') : this.mat.spawn;
      } else {
        const scenario = e.kind !== 'pickup';
        m.node.position.set(e.position[0], e.position[1] + (scenario ? 0 : PICKUP_HOVER), e.position[2]);
        if (e.kind === 'prop') orientProp(m.node as TransformNode, e, doc.terrain);
        else if ('yaw' in e && scenario) m.node.rotation.y = e.yaw;
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
        this.nodeEntity.delete(m.node);
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

  /** Map layers: the Tiles box hides the built structure (not the terrain). */
  applyTileLayer(): void {
    const on = !this.hiddenLayers.has('tile');
    for (const m of [...this.mapMeshes, ...this.dimMeshes]) m.setEnabled(on);
  }

  /** Move gizmo at the selection: X red, Y green, Z blue, drawn over everything. Null hides it. */
  setGizmo(at: Vec3 | null): void {
    this.gizmo?.dispose();
    this.gizmo = undefined;
    if (!at) return;
    const o = new Vector3(at.x, at.y + 0.05, at.z);
    const arm = (d: Vector3) => {
      const tip = o.add(d.scale(3));
      const side = Math.abs(d.y) > 0.5 ? new Vector3(0.25, 0, 0) : new Vector3(0, 0.25, 0);
      const back = tip.subtract(d.scale(0.5));
      return [[o, tip], [tip, back.add(side)], [tip, back.subtract(side)]];
    };
    const axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];
    const colours = [new Color4(1, 0.3, 0.3, 1), new Color4(0.3, 1, 0.4, 1), new Color4(0.3, 0.55, 1, 1)];
    const lines: Vector3[][] = [];
    const colors: Color4[][] = [];
    axes.forEach((d, i) => {
      for (const seg of arm(d)) {
        lines.push(seg);
        colors.push([colours[i]!, colours[i]!]);
      }
    });
    this.gizmo = CreateLineSystem('gizmo', { lines, colors }, this.scene);
    this.gizmo.isPickable = false;
    this.gizmo.renderingGroupId = 1;
  }

  /** The entity is drawn right now (on a shown level and in a shown layer). */
  entityShown(id: string): boolean {
    return this.markers.get(id)?.node.isEnabled() ?? false;
  }

  /** Entity under a ray, by its drawn meshes: every visible entity hit, nearest first. */
  pickEntities(origin: Vec3, dir: Vec3): { id: string; distance: number }[] {
    const ray = new Ray(new Vector3(origin.x, origin.y, origin.z), new Vector3(dir.x, dir.y, dir.z), 10000);
    const owner = (mesh: { parent: unknown }): string | undefined => {
      for (let n = mesh.parent as TransformNode | null; n; n = n.parent as TransformNode | null) {
        const id = this.nodeEntity.get(n);
        if (id) return id;
      }
      return undefined;
    };
    const hits = this.scene.multiPickWithRay(ray, (m) => m.isEnabled() && m.isVisible && (this.nodeEntity.has(m as unknown as TransformNode) || owner(m) !== undefined)) ?? [];
    const best = new Map<string, number>();
    for (const h of hits) {
      if (!h.hit || !h.pickedMesh) continue;
      const id = this.nodeEntity.get(h.pickedMesh as unknown as TransformNode) ?? owner(h.pickedMesh);
      if (id && (best.get(id) ?? Infinity) > h.distance) best.set(id, h.distance);
    }
    return [...best].map(([id, distance]) => ({ id, distance })).sort((a, b) => a.distance - b.distance);
  }

  /**
   * Outline what the pointer would act on: red for the Erase tool, cyan for Select.
   * Tiles get a box per cell; entities a box round their drawn model.
   */
  setPickHighlight(doc: MapDocument, target: { kind: 'tile' | 'entity'; id: string } | null, style: 'erase' | 'pick', revision: number): void {
    const key = target ? `${target.kind}:${target.id}:${style}:${revision}` : '';
    if (key === this.pickKey) return;
    this.pickKey = key;
    for (const b of this.pickBoxes) b.dispose();
    this.pickBoxes = [];
    if (!target) return;
    const add = (min: Vector3, max: Vector3) => {
      const size = max.subtract(min);
      // A wire cage and a see-through fill, so the target reads at any distance.
      for (const mat of style === 'erase' ? [this.mat.erase, this.mat.eraseFill] : [this.mat.pick, this.mat.pickFill]) {
        const box = CreateBox('pickHi', { width: Math.max(0.2, size.x), height: Math.max(0.2, size.y), depth: Math.max(0.2, size.z) }, this.scene);
        box.position = min.add(max).scale(0.5);
        box.material = mat;
        box.isPickable = false;
        this.pickBoxes.push(box);
      }
    };
    const { cellSize, levelHeight } = doc.classicStructure;
    if (target.kind === 'tile') {
      const t = doc.classicStructure.tiles.find((x) => x.id === target.id);
      for (const [x, y, z] of (t && placementCells(t)) ?? []) {
        const c = new Vector3(x * cellSize, z * levelHeight + levelHeight / 2, y * cellSize);
        const h = new Vector3(cellSize / 2 - 0.05, levelHeight / 2 - 0.05, cellSize / 2 - 0.05);
        add(c.subtract(h), c.add(h));
      }
      return;
    }
    const e = doc.entities.find((x) => x.id === target.id);
    if (!e) return;
    const node = this.markers.get(e.id)?.node;
    const bounds = node?.getHierarchyBoundingVectors(true);
    if (bounds && Number.isFinite(bounds.min.x) && Number.isFinite(bounds.max.x)) {
      const pad = new Vector3(0.08, 0.08, 0.08);
      add(bounds.min.subtract(pad), bounds.max.add(pad));
    } else {
      const r = selectionSize(e) / 2;
      add(new Vector3(e.position[0] - r, e.position[1], e.position[2] - r), new Vector3(e.position[0] + r, e.position[1] + 1.2, e.position[2] + r));
    }
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
  private propGhost: { model: string; node: TransformNode } | null = null;

  /** A see-through preview of a prop where it would be placed (null hides it). */
  setPropGhost(model: string | null, at: [number, number, number] | null, yaw: number): void {
    if (!model || !at) {
      this.propGhost?.node.setEnabled(false);
      return;
    }
    if (this.propGhost?.model !== model) {
      this.propGhost?.node.dispose(false, true);
      const e = { id: 'ghost', kind: 'prop', position: [0, 0, 0], model, yaw: 0, scale: 1, solid: false, tint: null } as unknown as PropEntity;
      const node = createPropNode(this.scene, this.models, e, 'propGhost', false);
      this.propGhost = { model, node };
      // Fade every mesh as the model loads in.
      const fade = () => {
        for (const m of node.getChildMeshes()) {
          m.visibility = 0.55;
          m.isPickable = false;
        }
      };
      fade();
      node.onAfterWorldMatrixUpdateObservable.add(fade);
    }
    const node = this.propGhost.node;
    node.setEnabled(true);
    node.position.set(at[0], at[1], at[2]);
    node.rotation.y = yaw;
  }

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
      // Only the piece itself: the rest of the map's geometry (its boundary walls, terrain edge,
      // blocks and props) would otherwise come along as a huge green box following the pointer.
      boxVertexData(buildMapGeometry(single).filter((b) => b.sourceId === 'ghost')).applyToMesh(this.ghost);
      this.ghost.isPickable = false;
      this.ghost.enableEdgesRendering();
      this.ghost.edgesWidth = 3;
      this.ghost.edgesColor = new Color4(0.75, 1, 0.8, 0.9);
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

  /** Highlight one face of a box (paint hover); `normal` is in the box's own frame. Null hides it. */
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
    // Turned boxes: offset the highlight from the centre in the box's frame, then turn it.
    const [ox, oz] = yawXZ(pos[0]! - center[0]!, pos[2]! - center[2]!, box.yaw ?? 0);
    this.faceHighlight.position.set(center[0]! + ox, pos[1]!, center[2]! + oz);
    this.faceHighlight.rotation.y = box.yaw ?? 0;
  }

  /** Redraw only the terrain (live preview while a brush is dragged). */
  previewTerrain(doc: MapDocument): void {
    this.styler.buildTerrain(doc, 'edmap');
  }

  /** Terrain brush outline draped over the ground; null hides it. */
  setBrushRing(t: TerrainData | null, x: number, z: number, radius: number, color = '#ffd34d'): void {
    this.brushRing?.dispose();
    this.brushRing = undefined;
    if (!t) return;
    const ring = (rad: number) => {
      const pts: Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const px = x + Math.cos(a) * rad;
        const pz = z + Math.sin(a) * rad;
        pts.push(new Vector3(px, (terrainHeightAt(t, px, pz) ?? t.baseY) + 0.12, pz));
      }
      return pts;
    };
    const cy = (terrainHeightAt(t, x, z) ?? t.baseY) + 0.12;
    this.brushRing = CreateLineSystem('brushRing', { lines: [ring(radius), ring(radius * 0.5), [new Vector3(x, cy, z), new Vector3(x, cy + 1.2, z)]] }, this.scene);
    this.brushRing.color = Color3.FromHexString(color);
    this.brushRing.isPickable = false;
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
    case 'hill':
    case 'bombsite':
    case 'rescue':
      return e.radius * 2 + 0.4;
    case 'hostage':
      return 1.2;
    case 'flag':
      return 2.6;
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
