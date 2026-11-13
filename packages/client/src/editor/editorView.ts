import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import '@babylonjs/core/Rendering/edgesRenderer';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
// Side-effect import: registers scene.createPickingRay.
import { Ray } from '@babylonjs/core/Culling/ray';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { Material } from '@babylonjs/core/Materials/material';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import type { MapDocument, MapEntity, MapWeather, PropEntity, Rotation, Side, TerrainData, TilePlacement, Vec3, WorldBox } from '@tiletrigger/shared';
import { groundCutsKey, mapGroundBores, mapWeather, DESTRUCTIBLE_SPECS, MAX_TEAMS, placedMountDef, mountTint, PLAYER, buildMapDecor, buildMapGeometry, dynamicBlockIds, getProp, mapLiquids, terrainHeightAt, yawXZ, mapFactions, mapTeams, placementCells, viewDirection, terrainUnderFloors, withPathsLaid, hungPropLift, rebeddedY, visibleFaces, propFlushLifts } from '@tiletrigger/shared';
import { PROP_CONTACTS } from '@tiletrigger/shared/propContacts';
import { ScenarioVisuals, placeScenarioNode } from '../game/scenarioVisuals.ts';
import { applyWorldGrade } from '../game/graphicsSettings.ts';
import { MapStyler, boxVertexData } from '../mapMeshes.ts';
import { buildRoadMeshes, disposeRoadMeshes } from '../roadMeshes.ts';
import { buildGuideLines, buildPathMeshes, disposePathMeshes } from '../pathMeshes.ts';
import { BackdropVisuals } from '../backdrop.ts';
import { WeatherVisuals } from '../weatherVisuals.ts';
import { loadGraphicsQuality } from '../game/graphicsSettings.ts';
import { BorderVisuals } from '../borderVisuals.ts';
import { FoliageVisuals } from '../foliage.ts';
import { ModelLibrary } from '../content/models.ts';
import { PICKUP_HOVER, createPickupVisual } from '../game/pickupVisuals.ts';
import { createPropNode, disposePropNode, orientProp } from '../game/propVisuals.ts';
import { CityVisuals } from '../game/cityVisuals.ts';
import { createMountNode } from '../game/mountVisuals.ts';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { BuildAreaVisuals } from './buildAreaVisuals.ts';

/** A picture laid over the ground while editing (MapMaker → Terrain, owner): never part of the map. */
export interface TraceImage {
  url: string;
  /** World rectangle it covers (x east, z north). */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  opacity: number;
}

interface EntityMarker {
  key: string;
  node: TransformNode;
  /** Selection outline for pickups. */
  ring?: Mesh;
}

/** A set piece as MapMaker outlines it (placing or selected): the grid cells it claims and its ports. */
export interface PieceOutline {
  cells: readonly (readonly [number, number, number])[];
  ports: readonly { x: number; y: number; z: number; side: Side; kind: 'door' | 'opening'; closed: boolean; blocked: boolean }[];
}

/** Port marker colours: a doorway, an opening, one that faces a wall, and one the piece's own wall shuts. */
const PORT_COLOURS = { door: new Color4(0.31, 0.7, 1, 1), opening: new Color4(0.35, 0.84, 0.55, 1), blocked: new Color4(1, 0.35, 0.31, 1), closed: new Color4(0.55, 0.58, 0.62, 0.7) } as const;

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
  /** The map's weather, previewed as it plays (Map properties; weatherVisuals.ts). */
  readonly weather: WeatherVisuals;
  private weatherKey = '';
  /** The border along the boundary (live preview of the Border setting). */
  readonly border: BorderVisuals;
  private readonly foliage: FoliageVisuals;
  private foliageTerrain: MapDocument['terrain'] = null;
  private foliageKey = '';
  private faceHighlight?: Mesh;
  private brushRing?: LinesMesh;
  /** The level grid, the playable boundary and the build limit (buildAreaVisuals.ts). */
  readonly area: BuildAreaVisuals;
  private hover?: Mesh;
  private ghost?: Mesh;
  private ghostKey = '';
  private outlines: Mesh[] = [];
  private markers = new Map<string, EntityMarker>();
  private readonly models: ModelLibrary;
  private readonly city: CityVisuals;
  private readonly scenario: ScenarioVisuals;
  private readonly mat: Record<'ghostOk' | 'ghostBad' | 'outline' | 'outlineBad' | 'pieceOk' | 'hover' | 'spawn' | 'spawnSel' | 'visor' | 'face' | 'erase' | 'pick' | 'eraseFill' | 'pickFill', StandardMaterial>;
  /** Draws a set piece's ghost (its parts in their real materials, see-through). */
  private readonly pieceStyler: MapStyler;
  /** The set piece being placed: its parts under one node, built for a piece, turn, mirror and look, moved cell to cell. */
  private pieceGhost: { key: string; root: TransformNode; meshes: Mesh[]; nodes: TransformNode[] } | null = null;
  /** The ghost's footprint and ports (green or red), and what they were drawn for. */
  private pieceMarks: Mesh[] = [];
  private pieceMarksKey = '';
  /** Draws the levels other than the one being edited, ghosted. */
  private readonly dimStyler: MapStyler;
  /** Marker root node -> entity id, for picking entities by their meshes. */
  private readonly nodeEntity = new Map<TransformNode, string>();
  /** Hover highlight (erase: red, select: cyan) and what it was built for. */
  private pickBoxes: Mesh[] = [];
  private mapMeshes: Mesh[] = [];
  /** The race track's road, curbs and arches (rebuilt with the map). */
  private roadMeshes: Mesh[] = [];
  private dimMeshes: Mesh[] = [];
  /** What the meshes were last built from: an edit rebuilds only what it changed (a prop moved: no tile, terrain or road meshes). */
  private builtBoxes = '';
  private builtTheme = '';
  private drawnPaths: MapDocument['paths'] | null = null;
  private drawnTerrain: MapDocument['terrain'] | undefined = undefined;
  /** The cuts the drawn ground was built with (groundCutsKey). */
  private drawnCuts = '';
  /** The document's ground with its paths laid in (paths.ts), worked out again only when the ground or the paths change. */
  private laid: { from: MapDocument['terrain']; paths: MapDocument['paths']; terrain: MapDocument['terrain'] } | null = null;
  /** The ground as played (paths laid in, kept under every floor): what the terrain, plants and roads are drawn on. */
  private shownTerrain: MapDocument['terrain'] = null;
  /** The laid ground `shownTerrain` was kept under the floors from. */
  private shownLaid: MapDocument['terrain'] = null;
  /** What the props are re-bedded from (the document's own ground) and against (the map's geometry as made), with each prop's re-bedded base (settle.ts rebeddedY). */
  private groundMade: MapDocument['terrain'] = null;
  private groundBoxes: readonly WorldBox[] = [];
  private rebedCache = new WeakMap<PropEntity, number | null>();
  private pathMeshes: Mesh[] = [];
  /** Routes (paths not drawn in the game), dashed. */
  private guideLines: Mesh[] = [];
  private gizmo?: LinesMesh;
  private pickKey = '';

  constructor(engine: AbstractEngine) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.16, 0.18, 0.21, 1);
    applyWorldGrade(this.scene, { vignette: false });
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
    this.pieceStyler = new MapStyler(this.scene, this.styler);
    this.backdrop = new BackdropVisuals(this.scene, this.styler);
    this.weather = new WeatherVisuals(this.scene, loadGraphicsQuality());
    this.models = new ModelLibrary(this.scene);
    this.city = new CityVisuals(this.models, 'edcity');
    this.border = new BorderVisuals(this.scene, this.styler, this.models);
    this.foliage = new FoliageVisuals(this.scene, this.models);
    this.scene.onBeforeRenderObservable.add(() => this.foliage.update(this.camera.position));
    this.area = new BuildAreaVisuals(this.scene);
    this.scene.onBeforeRenderObservable.add(() => this.area.update(this.camera.position, viewDirection(this.yaw, this.pitch)));
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
      pieceOk: flat('pieceOk', '#58d68d', 1, true),
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

  /** Keep the camera out of the ground and within reach of the build area (touchpads zoom fast). */
  private clampCamera(): void {
    const p = this.camera.position;
    const reach = this.area.reach;
    p.y = Math.max(-12, Math.min(600, p.y));
    p.x = Math.max(-reach, Math.min(reach, p.x));
    p.z = Math.max(-reach, Math.min(reach, p.z));
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

  /** Like project, but null for a point behind the camera (it would land on screen mirrored). */
  projectInView(p: Vec3): { x: number; y: number } | null {
    const d = viewDirection(this.yaw, this.pitch);
    const c = this.camera.position;
    if ((p.x - c.x) * d.x + (p.y - c.y) * d.y + (p.z - c.z) * d.z <= this.camera.minZ) return null;
    return this.project(p);
  }

  // ---------- content ----------

  /**
   * Rebuild map meshes. Tiles above the active level are hidden unless showAll;
   * every level but the active one is drawn ghosted, so the floor being edited stands out.
   * `all`: the whole map's geometry (buildMapGeometry of `doc`), whose floors the ground is kept under.
   */
  /** The map's weather over its sky (again whenever the sky and haze were set afresh: the weather adds to the haze). */
  private showWeather(doc: MapDocument, force = false): void {
    const key = JSON.stringify([doc.weather ?? null, this.backdrop.revision]);
    if (key === this.weatherKey && !force) return;
    this.weatherKey = key;
    const t = doc.terrain;
    const ground = t ? t.baseY + [...t.heights].sort((a, b) => a - b)[Math.floor(t.heights.length * 0.2)]! / 100 : 0;
    this.weather.set(mapWeather(doc), this.backdrop.sky, ground);
  }

  /**
   * Map properties' live preview while a slider moves: the sky and light at a time of day (null: the sky's own look,
   * undefined: the map's own) and/or a weather, without an edit. The next setMap shows the map as it is again.
   */
  previewSky(doc: MapDocument, hours: number | null | undefined, weather?: MapWeather): void {
    if (hours !== undefined) this.backdrop.previewTime(doc, hours);
    this.showWeather(weather ? { ...doc, weather } : doc, true);
    this.weatherKey = '';
  }

  setMap(doc: MapDocument, level: number, showAll: boolean, all: readonly WorldBox[] = buildMapGeometry(doc)): WorldBox[] {
    const visibleTiles = showAll ? doc.classicStructure.tiles : doc.classicStructure.tiles.filter((t) => t.z <= level);
    const visible = { ...doc, classicStructure: { ...doc.classicStructure, tiles: visibleTiles } };
    const boxes = visibleTiles.length === doc.classicStructure.tiles.length ? [...all] : buildMapGeometry(visible);
    const drawn = [...boxes, ...buildMapDecor(visible)];
    const { levelHeight } = doc.classicStructure;
    // Which level a piece belongs to. A floor goes by its top (a level's floor slab hangs half a metre
    // below the level, and sunken floors lower still: going by the bottom put the ground floor on
    // level -1, so it was drawn ghosted with the terrain showing through it, and the next level's
    // floor on this one). Anything else goes by its middle; pieces of a tile never go below its level.
    const tileZ = new Map(doc.classicStructure.tiles.map((t) => [t.id, t.z]));
    const levelOf = (b: WorldBox) => {
      const y = b.kind === 'floor' ? b.max[1] - 0.05 : (b.min[1] + b.max[1]) / 2;
      const byHeight = b.kind === 'floor' ? Math.round(b.max[1] / levelHeight) : Math.floor(y / levelHeight);
      const z = tileZ.get(b.sourceId);
      return z === undefined ? byHeight : Math.max(z, byHeight);
    };
    const onLevel = (b: WorldBox) => levelOf(b) === level;
    // The level meshes, only when the boxes (or how they're styled) changed.
    const theme = JSON.stringify([doc.classicStructure.theme, doc.classicStructure.tiles.map((t) => t.surfaces ?? null), level]);
    const boxKey = `${boxesFingerprint(drawn)}|${theme}`;
    if (boxKey !== this.builtBoxes) {
      this.builtBoxes = boxKey;
      // Faces clipped against every level (a wall's top still gives way to the floor above it), then drawn in two sets.
      const faces = visibleFaces(drawn);
      this.mapMeshes = this.styler.buildBoxes(visible, drawn, 'edmap', faces.filter((f) => onLevel(drawn[f.box]!)));
      this.dimMeshes = this.dimStyler.buildBoxes(visible, drawn, 'edmapdim', faces.filter((f) => !onLevel(drawn[f.box]!)));
      for (const m of this.dimMeshes) m.visibility = 0.4;
      this.applyTileLayer();
    }
    // The ground as played (what loadMap plays, settle.ts withGroundAsPlayed): the paths laid in (paths.ts) and the
    // terrain kept under every floor (terrainUnderFloors), worked out after every edit from the document's own ground,
    // which only sculpting changes: a path or a floor that moves takes its dip with it, and the ground comes back.
    if (doc.terrain !== this.laid?.from || doc.paths !== this.laid.paths) this.laid = { from: doc.terrain, paths: doc.paths, terrain: withPathsLaid(doc).terrain };
    const laid = this.laid.terrain;
    const ground = laid ? terrainUnderFloors({ ...doc, terrain: laid }, all) : null;
    // The floors moved but the ground came out the same: it stays the same terrain (nothing to rebuild).
    const same = !!ground && ground !== laid && this.shownLaid === laid && !!this.shownTerrain && this.shownTerrain !== laid && sameHeights(ground, this.shownTerrain);
    if (!same) this.shownTerrain = ground;
    this.shownLaid = laid;
    // Props bedded on the document's ground are drawn re-bedded on this one, as the game plays them.
    if (doc.terrain !== this.groundMade || all !== this.groundBoxes || !same) this.rebedCache = new WeakMap();
    this.groundMade = doc.terrain;
    this.groundBoxes = all;
    const shown = this.shownTerrain === doc.terrain ? doc : { ...doc, terrain: this.shownTerrain };
    // Terrain, paths and the road, only when they changed (the terrain alone took most of an edit on big maps).
    // (A buried tunnel that moves under a hill changes no height, only what it cuts out of the ground: groundBore.ts.)
    const cutsKey = this.shownTerrain ? groundCutsKey(mapGroundBores(doc).cuts) : '';
    if (this.shownTerrain !== this.drawnTerrain || doc.classicStructure.theme !== this.builtTheme || cutsKey !== this.drawnCuts) {
      this.drawnCuts = cutsKey;
      this.drawnTerrain = this.shownTerrain;
      this.builtTheme = doc.classicStructure.theme;
      this.styler.buildTerrain(shown, 'edmap');
      this.drawnPaths = null;
    }
    if (doc.paths !== this.drawnPaths) {
      this.drawnPaths = doc.paths;
      disposeRoadMeshes(this.roadMeshes);
      disposePathMeshes(this.pathMeshes);
      this.roadMeshes = buildRoadMeshes(this.scene, shown, this.styler, 'edroad');
      this.pathMeshes = buildPathMeshes(this.scene, doc, this.shownTerrain, this.styler, 'edpath');
      for (const m of this.guideLines) m.dispose();
      this.guideLines = buildGuideLines(this.scene, doc, this.shownTerrain, 'edguide');
    }
    this.backdrop.build(doc, boxes);
    this.showWeather(doc);
    this.border.update(doc, boxes);
    void this.city.setMap(visible);
    // Regrow plants only when the ground or what stands on it changed.
    const water = mapLiquids(doc.entities).filter((l) => l.liquid === 'water' || l.liquid === 'swamp');
    const foliageKey = shown.terrain ? `${shown.terrain.heights.length}:${boxes.length}:${water.map((l) => `${l.min.x},${l.min.z},${l.max.x},${l.max.z},${l.max.y}`).join(';')}` : '';
    if (shown.terrain !== this.foliageTerrain || foliageKey !== this.foliageKey) {
      this.foliageTerrain = shown.terrain;
      this.foliageKey = foliageKey;
      void this.foliage.grow(shown.terrain, boxes, doc.metadata.id, water);
    }
    this.area.setMap(doc, level, this.shownTerrain);
    // Light fixtures and hung props are drawn fastened to the ceiling over them (settle.ts fixtureGap, hungPropLift).
    this.scenario.ceilings = boxes;
    this.setEntities(doc, level, showAll, new Set());
    // Glass in glazed windows (after the backdrop, whose sky it reflects).
    this.scenario.glass.build(visible, { windowsOnly: true });
    // Trim is pickable too, so it can be painted.
    return drawn;
  }

  /** The ground as drawn (paths laid in, kept under floors), or null on a map with no terrain. */
  get ground(): MapDocument['terrain'] {
    return this.shownTerrain;
  }

  /** Top bar Grid: show or hide the level grid (the boundary and build limit stay). */
  setGridVisible(on: boolean): void {
    this.area.setGridVisible(on);
  }

  /** Top bar Full grid: the grid over the whole build area instead of round where the camera looks. */
  setGridFull(on: boolean): void {
    this.area.setGridFull(on);
  }

  private overlaps?: Mesh;

  /**
   * Top bar Overlaps: highlight coplanar overlaps (faces of two pieces in the same plane, where only
   * one look draws) in magenta, lifted a little off the face and drawn over everything. Null hides it.
   */
  setOverlaps(spots: readonly { corners: readonly (readonly number[])[]; normal: readonly number[] }[] | null): void {
    this.overlaps?.dispose();
    this.overlaps = undefined;
    if (!spots) return;
    const positions: number[] = [];
    const indices: number[] = [];
    for (const s of spots) {
      const base = positions.length / 3;
      for (const c of s.corners) positions.push(c[0]! + s.normal[0]! * 0.02, c[1]! + s.normal[1]! * 0.02, c[2]! + s.normal[2]! * 0.02);
      for (let k = 1; k < s.corners.length - 1; k++) indices.push(base, base + k, base + k + 1);
    }
    const mesh = new Mesh('edOverlaps', this.scene);
    const vd = new VertexData();
    vd.positions = positions;
    vd.indices = indices;
    vd.applyToMesh(mesh);
    const mat = new StandardMaterial('edOverlapsMat', this.scene);
    mat.diffuseColor = Color3.Black();
    mat.emissiveColor = Color3.FromHexString('#ff2bd6');
    mat.specularColor = Color3.Black();
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mat.alpha = 0.6;
    mesh.material = mat;
    // Over the level, so a spot behind a wall still shows where it is.
    mesh.renderingGroupId = 1;
    mesh.isPickable = false;
    this.overlaps = mesh;
  }

  /** What photoMode hid, to bring back. */
  private photoHidden: TransformNode[] = [];

  /**
   * Hide the editing aids (grid, ghosts, outlines, highlights, gizmo, spawn
   * markers) for a clean picture of the map (MapMaker → Set thumbnail), or
   * bring them back.
   */
  photoMode(on: boolean): void {
    for (const n of this.photoHidden) n.setEnabled(true);
    this.photoHidden = [];
    if (!on) return;
    const aids: (TransformNode | undefined)[] = [this.trace?.mesh, this.area.root, this.overlaps, this.brushRing, this.gizmo, this.ring, this.hover, this.ghost, this.faceHighlight, this.propGhost?.node, this.pieceGhost?.root, ...this.pieceMarks, ...this.outlines, ...this.pickBoxes, this.scene.getMeshByName('measureLines') ?? undefined, ...this.scene.meshes.filter((m) => m.name.startsWith('edMapTest'))];
    for (const m of this.markers.values()) aids.push(m.ring, m.key === 'spawn' ? m.node : undefined);
    for (const n of aids) {
      if (!n || !n.isEnabled(false)) continue;
      n.setEnabled(false);
      this.photoHidden.push(n);
    }
  }

  private trace?: { mesh: Mesh; url: string };

  /**
   * The trace image (or none): a flat picture over everything at its world
   * rectangle, see-through at `opacity`, drawn on top so hills don't hide it.
   * Editor-only: it is never saved in the map.
   */
  setTrace(t: TraceImage | null): void {
    if (!t || this.trace?.url !== t.url) {
      this.trace?.mesh.material?.dispose(true, true);
      this.trace?.mesh.dispose();
      this.trace = undefined;
    }
    if (!t) return;
    if (!this.trace) {
      const mesh = CreateGround('traceImage', { width: 1, height: 1 }, this.scene);
      const mat = new StandardMaterial('traceImageMat', this.scene);
      const tex = new Texture(t.url, this.scene, false, true);
      mat.diffuseTexture = tex;
      mat.emissiveTexture = tex;
      mat.disableLighting = true;
      mat.specularColor = Color3.Black();
      mat.backFaceCulling = false;
      mesh.material = mat;
      mesh.isPickable = false;
      mesh.renderingGroupId = 1;
      this.trace = { mesh, url: t.url };
    }
    const m = this.trace.mesh;
    m.position.set((t.x0 + t.x1) / 2, 0.05, (t.z0 + t.z1) / 2);
    m.scaling.set(Math.abs(t.x1 - t.x0) || 1, 1, Math.abs(t.z1 - t.z0) || 1);
    (m.material as StandardMaterial).alpha = Math.max(0.05, Math.min(1, t.opacity));
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
  /** What the outliner hides (editor-only; a set piece's parts with their placement): not drawn, so not picked. */
  outlinerHidden: (id: string) => boolean = () => false;
  /** Entity kinds not drawn (the card shot: markers a match doesn't show, such as zones and hills). */
  readonly hiddenKinds = new Set<string>();

  /** Props drawn a hair apart where they lie flush on other props (propFlushLifts), worked out again when the props change. */
  private flush: { key: string; lifts: Map<string, [number, number, number]> } = { key: '', lifts: new Map() };

  private flushLifts(doc: MapDocument): Map<string, [number, number, number]> {
    const key = this.scenario.ceilings.length + JSON.stringify(doc.entities.filter((e) => e.kind === 'prop' || e.kind === 'mover').map((e) => (e.kind === 'prop' ? [e.id, e.model, e.position, e.yaw, e.scale] : [e.id, e.props ?? []])));
    if (key !== this.flush.key) this.flush = { key, lifts: propFlushLifts(doc, PROP_CONTACTS, this.scenario.ceilings) };
    return this.flush.lifts;
  }

  setEntities(doc: MapDocument, level: number, showAll: boolean, selected: ReadonlySet<string>): void {
    const { levelHeight } = doc.classicStructure;
    this.flushLifts(doc);
    const seen = new Set<string>();
    const factions = mapFactions(doc);
    const factionColor = (id: string) => factions.find((f) => f.id === id)?.color ?? '#888888';
    this.scenario.factionColor = factionColor;
    const flagTeams = mapTeams(doc, MAX_TEAMS);
    this.scenario.teamColor = (id) => flagTeams.find((t) => t.id === id)?.color ?? '#888888';
    this.scenario.surface = (m, t) => this.styler.surfaceMaterial(doc, m, t);
    const teams = mapTeams(doc, MAX_TEAMS);
    const dynamic = dynamicBlockIds(doc);
    this.scenario.dynamicBlocks = dynamic;
    for (const e of doc.entities) {
      if (!showAll && e.position[1] > level * levelHeight + levelHeight - 0.1) continue;
      if (this.outlinerHidden(e.id)) continue;
      seen.add(e.id);
      // Rebuild a marker when the entity changed kind, item or any scenario property.
      const key = e.kind === 'pickup' ? `pickup:${e.item}` : e.kind === 'spawn' ? 'spawn' : JSON.stringify({ ...e, position: null, name: null, color: e.kind === 'encounter' ? factionColor(e.faction) : e.kind === 'flag' ? this.scenario.teamColor(e.team) : null, driven: dynamic.has(e.id) });
      let m = this.markers.get(e.id);
      if (m && m.key !== key) {
        this.nodeEntity.delete(m.node);
        disposePropNode(m.node);
        m.ring?.dispose();
        m = undefined;
      }
      if (!m) {
        m = e.kind === 'spawn' ? this.createSpawnMarker(e.id) : { key, node: this.entityNode(e, e.id, teams) };
        m.key = key;
        this.markers.set(e.id, m);
        this.nodeEntity.set(m.node, e.id);
      }
      const layer = e.kind === 'prop' || e.kind === 'spawn' || e.kind === 'pickup' ? e.kind : e.kind === 'mount' ? 'prop' : 'logic';
      m.node.setEnabled(!this.hiddenLayers.has(layer) && !this.hiddenKinds.has(e.kind));
      if (e.kind === 'spawn') {
        m.node.position.set(e.position[0], e.position[1] + PLAYER.height / 2, e.position[2]);
        m.node.rotation.y = e.yaw;
        // Breakthrough spawn groups: the attackers' orange, the defenders' blue (the inspector says which sector).
        (m.node as Mesh).material = selected.has(e.id) ? this.mat.spawnSel : e.side ? this.teamMaterial(e.side === 'attack' ? '#ff8a3a' : '#5ab0ff') : e.faction ? this.teamMaterial(teams.find((t) => t.id === e.faction)?.color ?? '#888888') : this.mat.spawn;
      } else {
        this.placeEntityNode(m.node as TransformNode, e, doc);
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
        disposePropNode(m.node);
        m.ring?.dispose();
        this.markers.delete(id);
      }
    }
  }

  /** An entity's visual in MapMaker (spawns have their own marker). */
  private entityNode(e: MapEntity, id: string, teams: ReturnType<typeof mapTeams>): TransformNode {
    if (e.kind === 'pickup') return createPickupVisual(this.scene, this.models, e.item, `edpickup_${id}`);
    if (e.kind === 'prop') return createPropNode(this.scene, this.models, e, `edprop_${id}`, false);
    if (e.kind === 'mount') return createMountNode(this.scene, this.models, e.model, `edmount_${id}`, placedMountDef(e.model).kind === 'sentry' ? null : mountTint(e.skin, e.faction ? (teams.find((t) => t.id === e.faction)?.color ?? null) : null));
    return this.scenario.createNode(e as Parameters<ScenarioVisuals['createNode']>[0], `ed_${id}`);
  }

  /** Put an entity's visual (not a spawn's) where the entity is, facing its way. */
  private placeEntityNode(node: TransformNode, e: MapEntity, doc: MapDocument): void {
    node.position.set(e.position[0], e.position[1] + (e.kind === 'pickup' ? PICKUP_HOVER : 0), e.position[2]);
    if (e.kind === 'prop') {
      // Shown on the ground as played (paths laid in, kept under floors), as the game re-beds it (settle.ts
      // rebedProps), and leaning with that ground.
      const ground = doc.terrain && doc.terrain === this.groundMade ? this.shownTerrain : doc.terrain;
      const y = this.playedPropY(e, doc);
      const played = y === null ? e : { ...e, position: [e.position[0], y, e.position[2]] as [number, number, number] };
      node.position.y = played.position[1];
      orientProp(node, played, ground);
      node.position.y += hungPropLift(this.scenario.ceilings, e);
      // Flush on another prop: drawn a hair apart, as in the game (no flicker).
      const lift = this.flush.lifts.get(e.id);
      if (lift) node.position.addInPlaceFromFloats(lift[0], lift[1], lift[2]);
    } else if (e.kind === 'mount') node.rotation.y = e.yaw;
    else if (e.kind !== 'pickup') placeScenarioNode(node, e);
  }

  /** Where the game puts a prop bedded on the document's ground: re-bedded on the ground as played (null: it stays). */
  private playedPropY(e: PropEntity, doc: MapDocument): number | null {
    const made = doc.terrain;
    const ground = this.shownTerrain;
    if (!made || !ground || made !== this.groundMade || ground === made) return null;
    let y = this.rebedCache.get(e);
    if (y === undefined) this.rebedCache.set(e, (y = rebeddedY(made, ground, this.groundBoxes, e)));
    return y;
  }

  /** Previews of what the Scenario and NPC tools would place, by `key`: rebuilt only when it changes. */
  private entityGhost: { key: string; nodes: TransformNode[] } | null = null;

  /** The see-through preview of what an object tool would put down: these entities where they'd go (null hides it). */
  setEntityGhost(doc: MapDocument, key: string | null, entities: readonly MapEntity[], refused = false): void {
    if (!key) {
      for (const n of this.entityGhost?.nodes ?? []) n.setEnabled(false);
      return;
    }
    if (this.entityGhost?.key !== key) {
      for (const n of this.entityGhost?.nodes ?? []) disposePropNode(n);
      const teams = mapTeams(doc, MAX_TEAMS);
      const nodes = entities.map((e, i) => {
        const node = e.kind === 'spawn' ? this.createSpawnMarker(`ghost${i}`).node : this.entityNode(e, `ghost${i}`, teams);
        seeThrough(node);
        return node;
      });
      this.entityGhost = { key, nodes };
    }
    entities.forEach((e, i) => {
      const node = this.entityGhost!.nodes[i];
      if (!node) return;
      node.setEnabled(true);
      if (e.kind === 'spawn') node.position.set(e.position[0], e.position[1] + PLAYER.height / 2, e.position[2]);
      else this.placeEntityNode(node, e, doc);
      setGhostRefused(node, refused);
    });
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

  private ring?: LinesMesh;

  /**
   * The rotate ring round the selection gizmo (rotateRing.ts): a circle on the ground plane at the gizmo, brighter when
   * the pointer is on it or it is held; while dragging, spokes from the centre to where the drag started and to the
   * facing it has reached, and the arc between. Null hides it.
   */
  setRing(at: Vec3 | null, ring: { radius: number; hot: boolean; from?: number; to?: number } | null): void {
    this.ring?.dispose();
    this.ring = undefined;
    if (!at || !ring) return;
    const y = at.y + 0.06;
    const pt = (a: number, r: number) => new Vector3(at.x + Math.sin(a) * r, y, at.z + Math.cos(a) * r);
    const colour = ring.hot ? new Color4(1, 0.85, 0.25, 1) : new Color4(1, 0.85, 0.25, 0.55);
    const circle: Vector3[] = [];
    for (let i = 0; i <= 72; i++) circle.push(pt((i / 72) * Math.PI * 2, ring.radius));
    const lines: Vector3[][] = [circle];
    const colors: Color4[][] = [circle.map(() => colour)];
    if (ring.from !== undefined && ring.to !== undefined) {
      const o = new Vector3(at.x, y, at.z);
      const faint = new Color4(1, 1, 1, 0.5);
      const bright = new Color4(1, 1, 1, 1);
      lines.push([o, pt(ring.from, ring.radius)], [o, pt(ring.to, ring.radius)]);
      colors.push([faint, faint], [bright, bright]);
      const n = Math.max(2, Math.ceil((Math.abs(ring.to - ring.from) / Math.PI) * 36));
      const arc: Vector3[] = [];
      for (let i = 0; i <= n; i++) arc.push(pt(ring.from + ((ring.to - ring.from) * i) / n, ring.radius * 0.7));
      lines.push(arc);
      colors.push(arc.map(() => bright));
    }
    this.ring = CreateLineSystem('gizmoRing', { lines, colors, useVertexAlpha: true }, this.scene);
    this.ring.isPickable = false;
    this.ring.renderingGroupId = 1;
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
  setPickHighlight(doc: MapDocument, target: { kind: 'tile' | 'entity' | 'setpiece'; id: string } | null, style: 'erase' | 'pick', revision: number, pieceCells: readonly (readonly [number, number, number])[] = []): void {
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
    if (target.kind === 'tile' || target.kind === 'setpiece') {
      // A tile's cells, or a set piece's whole footprint (it selects as one).
      const t = target.kind === 'tile' ? doc.classicStructure.tiles.find((x) => x.id === target.id) : undefined;
      for (const [x, y, z] of target.kind === 'setpiece' ? pieceCells : ((t && placementCells(t)) ?? [])) {
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
  /** The see-through preview of what a placing tool would put down (props, vehicles, spawns, pickups). */
  setPropGhost(model: string | null, at: [number, number, number] | null, yaw: number, kind: 'prop' | 'mount' | 'spawn' | 'pickup' = 'prop', look: { scale: number; variant?: number } = { scale: 1 }, refused = false): void {
    if (!model || !at) {
      this.propGhost?.node.setEnabled(false);
      return;
    }
    // A prop's ghost shows its variant and size (the prop tool's Randomise: what you see is what you place).
    const key = `${kind}:${model}:${look.variant ?? ''}`;
    if (this.propGhost?.model !== key) {
      // Not its materials: they are the model's, shared with every placed copy of it.
      if (this.propGhost) disposePropNode(this.propGhost.node);
      let node: TransformNode;
      if (kind === 'mount') node = createMountNode(this.scene, this.models, model as Extract<MapEntity, { kind: 'mount' }>['model'], 'mountGhost', null);
      else if (kind === 'spawn') {
        const capsule = this.createSpawnMarker('ghost').node as Mesh;
        capsule.material = this.mat.spawn;
        node = capsule;
      }
      else if (kind === 'pickup') node = createPickupVisual(this.scene, this.models, model, 'pickupGhost');
      else {
        const e = { id: 'ghost', kind: 'prop', position: [0, 0, 0], model, yaw: 0, scale: 1, solid: false, tint: null, ...(look.variant !== undefined ? { variant: look.variant } : {}) } as unknown as PropEntity;
        node = createPropNode(this.scene, this.models, e, 'propGhost', false);
      }
      this.propGhost = { model: key, node };
      seeThrough(node);
    }
    const node = this.propGhost.node;
    node.setEnabled(true);
    const lift = kind === 'spawn' ? PLAYER.height / 2 : kind === 'pickup' ? PICKUP_HOVER : 0;
    // A prop bedded on the document's ground lands where it will be drawn: re-bedded on the ground as shown.
    const made = this.groundMade;
    const ground = this.shownTerrain;
    const y = kind === 'prop' && made && ground && ground !== made ? rebeddedY(made, ground, this.groundBoxes, { id: 'ghost', model, position: at, yaw, scale: look.scale }) : null;
    node.position.set(at[0], (y ?? at[1]) + lift, at[2]);
    node.rotation.y = yaw;
    if (kind === 'prop') node.scaling.setAll(look.scale);
    setGhostRefused(node, refused);
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

  /** Outline every cell of the given tiles and set pieces (a piece with its ports), optionally offset (drag preview). */
  setOutlines(doc: MapDocument, tileIds: readonly string[], offset: [number, number, number] = [0, 0, 0], bad = false, pieces: readonly PieceOutline[] = []): void {
    for (const o of this.outlines) o.dispose();
    this.outlines = [];
    const { cellSize, levelHeight } = doc.classicStructure;
    const ids = new Set(tileIds);
    const cells = doc.classicStructure.tiles.filter((t) => ids.has(t.id)).flatMap((t) => placementCells(t) ?? []);
    for (const p of pieces) cells.push(...p.cells.map((c) => [c[0], c[1], c[2]] as [number, number, number]));
    for (const [x, y, z] of cells) {
      const box = CreateBox('outline', { width: cellSize - 0.1, depth: cellSize - 0.1, height: levelHeight - 0.1 }, this.scene);
      box.position.set((x + offset[0]) * cellSize, (z + offset[2]) * levelHeight + levelHeight / 2, (y + offset[1]) * cellSize);
      box.material = bad ? this.mat.outlineBad : this.mat.outline;
      box.isPickable = false;
      this.outlines.push(box);
    }
    const ports = pieces.flatMap((p) => p.ports.map((q) => ({ ...q, x: q.x + offset[0], y: q.y + offset[1], z: q.z + offset[2] })));
    if (ports.length) this.outlines.push(this.portMarks(doc, ports, 'selPorts'));
  }

  /**
   * A set piece's ports as marks on its outline: a doorway's frame standing in the side (2 × 2.4 m) and an arrow on the
   * floor pointing out, blue for a door, green for an opening, red (crossed) where a wall stands in the way, grey where
   * the piece's own wall shuts it (nothing meets it there); drawn over the map.
   */
  private portMarks(doc: MapDocument, ports: PieceOutline['ports'], name: string): Mesh {
    const { cellSize, levelHeight } = doc.classicStructure;
    const lines: Vector3[][] = [];
    const colors: Color4[][] = [];
    const dirs: Record<Side, [number, number]> = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };
    for (const p of ports) {
      const [dx, dz] = dirs[p.side];
      // The side's middle, a hair outside the cell; `a` runs along the side.
      const cx = p.x * cellSize + (dx * cellSize) / 2;
      const cz = p.y * cellSize + (dz * cellSize) / 2;
      const y = p.z * levelHeight + 0.06;
      const ax = dz ? 1 : 0;
      const az = dx ? 1 : 0;
      const w = p.kind === 'door' ? 1 : 1.6;
      const at = (u: number, h: number, out = 0) => new Vector3(cx + ax * u + dx * out, y + h, cz + az * u + dz * out);
      const c = p.blocked ? PORT_COLOURS.blocked : p.closed ? PORT_COLOURS.closed : PORT_COLOURS[p.kind];
      const frame = [at(-w, 0), at(-w, 2.4), at(w, 2.4), at(w, 0)];
      const arrow = [
        [at(0, 0, -1.2), at(0, 0, 1.4)],
        [at(-0.6, 0, 0.8), at(0, 0, 1.4), at(0.6, 0, 0.8)],
      ];
      for (const l of [frame, ...arrow]) {
        lines.push(l);
        colors.push(l.map(() => c));
      }
      // A cross where it's blocked.
      if (p.blocked) for (const l of [[at(-0.7, 0.5, 0.3), at(0.7, 1.9, 0.3)], [at(0.7, 0.5, 0.3), at(-0.7, 1.9, 0.3)]]) {
        lines.push(l);
        colors.push(l.map(() => c));
      }
    }
    const mesh = CreateLineSystem(name, { lines, colors }, this.scene);
    mesh.isPickable = false;
    mesh.renderingGroupId = 1;
    return mesh;
  }

  /**
   * The set piece about to be placed, see-through in its real materials (its look: the pack picker re-themes it), at
   * anchor cell `at`, with its footprint and ports outlined green, or red when it can't go there. `key` names what the
   * parts were built for (piece, turn, mirror, look, theme): the parts are built once for it, at the grid's origin,
   * and moved with the pointer; `parts()` gives them (placed at anchor 0, 0, 0). Null `at` hides it.
   */
  setPieceGhost(doc: MapDocument, key: string | null, parts: () => { tiles: TilePlacement[]; entities: MapEntity[] }, at: readonly [number, number, number] | null, ok: boolean, outline: PieceOutline | null): void {
    if (!key || !at) {
      this.pieceGhost?.root.setEnabled(false);
      for (const m of this.pieceMarks) m.setEnabled(false);
      return;
    }
    const { cellSize, levelHeight } = doc.classicStructure;
    if (this.pieceGhost?.key !== key) {
      this.disposePieceGhost();
      const { tiles, entities } = parts();
      const ids = new Set([...tiles.map((t) => t.id), ...entities.map((e) => e.id)]);
      // Only the piece: its tiles and blocks on an empty map (no terrain, edges or anything else of the map's).
      const single: MapDocument = { ...doc, terrain: null, bounds: null, classicStructure: { ...doc.classicStructure, tiles }, entities: entities.filter((e) => e.kind === 'block') };
      const boxes = [...buildMapGeometry(single), ...buildMapDecor(single)].filter((b) => ids.has(b.sourceId));
      const root = new TransformNode('pieceGhost', this.scene);
      const meshes = this.pieceStyler.buildBoxes(single, boxes, 'edpiece');
      for (const m of meshes) {
        m.unfreezeWorldMatrix();
        m.parent = root;
        m.visibility = 0.6;
        m.isPickable = false;
      }
      const teams = mapTeams(doc, MAX_TEAMS);
      const nodes = entities
        .filter((e) => e.kind !== 'block')
        .map((e, i) => {
          const node = this.entityNode(e, `pieceGhost${i}`, teams);
          node.parent = root;
          this.placeEntityNode(node, e, single);
          seeThrough(node);
          return node;
        });
      this.pieceGhost = { key, root, meshes, nodes };
    }
    const g = this.pieceGhost!;
    g.root.setEnabled(true);
    g.root.position.set(at[0] * cellSize, at[2] * levelHeight, at[1] * cellSize);
    const marksKey = JSON.stringify([ok, outline]);
    if (marksKey !== this.pieceMarksKey) {
      this.pieceMarksKey = marksKey;
      for (const m of this.pieceMarks) m.dispose();
      this.pieceMarks = [];
      for (const [x, y, z] of outline?.cells ?? []) {
        const box = CreateBox('pieceCell', { width: cellSize - 0.1, depth: cellSize - 0.1, height: levelHeight - 0.1 }, this.scene);
        box.position.set(x * cellSize, z * levelHeight + levelHeight / 2, y * cellSize);
        box.material = ok ? this.mat.pieceOk : this.mat.outlineBad;
        box.isPickable = false;
        this.pieceMarks.push(box);
      }
      if (outline?.ports.length) this.pieceMarks.push(this.portMarks(doc, outline.ports, 'ghostPorts'));
    }
    for (const m of this.pieceMarks) m.setEnabled(true);
  }

  private disposePieceGhost(): void {
    const g = this.pieceGhost;
    if (!g) return;
    for (const n of g.nodes) disposePropNode(n);
    // The styler disposes its meshes itself, when it builds the next ghost.
    for (const m of g.meshes) {
      m.parent = null;
      m.setEnabled(false);
    }
    g.root.dispose();
    this.pieceGhost = null;
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
    // Built from a preview: the next setMap rebuilds it from the document.
    this.drawnTerrain = undefined;
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
    case 'objective':
      return e.radius * 2 + 0.4;
    case 'sector':
      return 4;
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

/** A quick fingerprint of a box list (positions, kinds, sources, materials): equal lists, equal strings. */
function boxesFingerprint(boxes: readonly WorldBox[]): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const mix = (n: number) => {
    const v = Math.round(n * 1000) | 0;
    h1 = Math.imul(h1 ^ v, 16777619);
    h2 = Math.imul(h2 + v, 2246822519) ^ (h2 >>> 13);
  };
  const str = (t: string) => {
    for (let i = 0; i < t.length; i++) mix(t.charCodeAt(i));
  };
  for (const b of boxes) {
    mix(b.min[0]);
    mix(b.min[1]);
    mix(b.min[2]);
    mix(b.max[0]);
    mix(b.max[1]);
    mix(b.max[2]);
    mix(b.yaw ?? 0);
    mix(b.pitch ?? 0);
    mix(b.roll ?? 0);
    str(b.kind);
    str(b.sourceId);
    if (b.surface) str(`${b.surface.material}${b.surface.tint ?? ''}`);
  }
  return `${boxes.length}:${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}

/** Two grounds with the same heights, vertex for vertex. */
function sameHeights(a: TerrainData, b: TerrainData): boolean {
  if (a.heights.length !== b.heights.length) return false;
  for (let i = 0; i < a.heights.length; i++) if (a.heights[i] !== b.heights[i]) return false;
  return true;
}

/** Placement previews refused where they are (ghostWhy.ts): seeThrough tints them red. */
const refusedGhosts = new WeakSet<TransformNode>();
const REFUSED_RED = Color3.FromHexString('#ff5a4f');

/** Mark a placement preview as refused (red) or not; seeThrough applies it on the next frame. */
function setGhostRefused(node: TransformNode, refused: boolean): void {
  if (refused) refusedGhosts.add(node);
  else refusedGhosts.delete(node);
}

/** See-through copies of materials that are forced opaque (glTF models), which ignore a mesh's visibility; by source. */
const ghostMaterials = new WeakMap<Material, Material>();

function ghostMaterial(mat: Material): Material {
  if (mat.transparencyMode !== Material.MATERIAL_OPAQUE && mat.transparencyMode !== Material.MATERIAL_ALPHATEST) return mat;
  let ghost = ghostMaterials.get(mat);
  if (!ghost) {
    ghost = mat.clone(`${mat.name}_ghost`)!;
    ghost.transparencyMode = Material.MATERIAL_ALPHABLEND;
    ghostMaterials.set(mat, ghost);
  }
  return ghost;
}

/**
 * A placement preview: every mesh see-through and unpickable, every frame (models load in after it's made).
 * Opaque-only materials are swapped for see-through copies: the originals are shared with every placed copy.
 */
function seeThrough(node: TransformNode): void {
  const fade = () => {
    const refused = refusedGhosts.has(node);
    for (const m of [node, ...node.getChildMeshes()]) {
      if (!('visibility' in m)) continue;
      const mesh = m as Mesh;
      mesh.visibility = 0.55;
      mesh.isPickable = false;
      if (mesh.material && mesh.getClassName() === 'Mesh') mesh.material = ghostMaterial(mesh.material);
      // Refused here (ghostWhy.ts): tinted red over its own look, as a refused tile's ghost is red.
      if (mesh.renderOverlay !== refused) {
        mesh.renderOverlay = refused;
        mesh.overlayColor = REFUSED_RED;
        mesh.overlayAlpha = 0.6;
      }
    }
  };
  fade();
  const scene = node.getScene();
  const each = scene.onBeforeRenderObservable.add(fade);
  node.onDisposeObservable.addOnce(() => scene.onBeforeRenderObservable.remove(each));
}
