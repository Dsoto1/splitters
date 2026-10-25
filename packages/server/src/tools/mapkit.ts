/**
 * A small kit for map build scripts: the same edit commands MapMaker issues
 * (place tile, wall style, entities, theme, metadata, terrain, boundary),
 * wrapped so a map reads like a floor plan. Every script ends with `save()`,
 * which loads the result back through the schema, validates it (and its
 * navmesh) and writes maps/<id>.json.
 *
 * Grid: cell (x, y) is centred on world (x × 8, y × 8); level z is z × 4 m up.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  EditHistory,
  addSpawnCommand,
  blockBoxes,
  buildMapGeometry,
  propBoxes,
  fitBounds,
  initPhysics,
  PhysicsWorld,
  loadMap,
  mapPads,
  mapTeams,
  navLinks,
  padLandings,
  mapTerrainMesh,
  newMapDocument,
  placeTileCommand,
  serializeMap,
  applyCommand,
  settlePropsCommand,
  setEdgeCommand,
  setThemeCommand,
  validateMap,
  type BackdropGround,
  type BoundaryStyle,
  type SceneryId,
  type SkyId,
  type EdgeStyle,
  type GameMode,
  type MapDocument,
  type MapEntity,
  type MountModel,
  type Rotation,
  type ScenarioLogic,
  type Side,
  type TerrainData,
  type ValidationIssue,
} from '@chronosplit/shared';
import { NavWorld, initNavigation, validateNavigation } from '@chronosplit/shared/match';

type V3 = [number, number, number];
/** Any entity without its ID (one per kind, so object literals are checked against the right kind). */
type NewEntity = MapEntity extends infer E ? (E extends MapEntity ? Omit<E, 'id'> & { id?: string } : never) : never;

export class MapBuilder {
  readonly history: EditHistory;
  private counter = 0;
  private readonly pending: MapEntity[] = [];

  constructor(
    readonly id: string,
    name: string,
    base?: MapDocument,
    private readonly prefix = '',
  ) {
    const doc0 = base ?? newMapDocument(name, new Date('2026-10-23T00:00:00.000Z'));
    this.history = new EditHistory(base ? doc0 : { ...doc0, classicStructure: { ...doc0.classicStructure, tiles: [] }, entities: [] });
  }

  /**
   * Grow an existing (hand-made) map in place: everything it already has stays,
   * including its logic and IDs, and what the script adds gets IDs starting
   * with `g_`. Those are dropped before the script runs again, so rerunning
   * gives the same file.
   */
  static extend(id: string): MapBuilder {
    const path = fileURLToPath(new URL(`../../../../maps/${id}.json`, import.meta.url));
    const loaded = loadMap(readFileSync(path, 'utf8'));
    if (!loaded.ok) throw new Error(`${id}: map does not load`);
    const doc = loaded.map;
    const mine = (x: { id: string }) => x.id.startsWith('g_');
    const base: MapDocument = { ...doc, classicStructure: { ...doc.classicStructure, tiles: doc.classicStructure.tiles.filter((t) => !mine(t)) }, entities: doc.entities.filter((e) => !mine(e)) };
    return new MapBuilder(id, doc.metadata.name, base, 'g_');
  }

  get doc(): MapDocument {
    return this.history.doc;
  }

  /** Stable IDs, so rebuilding a map produces the same file. */
  newId(prefix: string): string {
    return `${this.prefix}${prefix}_${String(++this.counter).padStart(3, '0')}`;
  }

  private run(label: string, command: Parameters<EditHistory['execute']>[1]): void {
    this.history.execute(label, command);
  }

  /** Place a tile (`kind` without the `core.` prefix) at cell x, y on level z. */
  tile(kind: string, x: number, y: number, z = 0, rotation: Rotation = 0): this {
    const r = placeTileCommand(this.doc, `core.${kind}`, x, y, z, rotation);
    if ('error' in r) throw new Error(`${this.id}: ${kind} at ${x},${y},${z}: ${r.error}`);
    this.run('Place tile', { kind: 'addTiles', tiles: [{ ...r.placement, id: this.newId('tile') }] });
    return this;
  }

  /** Fill a rectangle of cells with one tile kind. */
  fill(kind: string, x0: number, y0: number, x1: number, y1: number, z = 0, rotation: Rotation = 0): this {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.tile(kind, x, y, z, rotation);
    return this;
  }

  /** Build one side of a cell in a wall style (door, window, arch, half, railing, open, high…). */
  edge(x: number, y: number, z: number, side: Side, style: EdgeStyle): this {
    const cmd = setEdgeCommand(this.doc, { cell: [x, y, z], side }, style);
    if ('error' in cmd) throw new Error(`${this.id}: edge ${x},${y},${z}:${side}: ${cmd.error}`);
    this.run('Wall', cmd);
    return this;
  }

  /** Queue an entity (added in one step at save, like a MapMaker paste). */
  add(e: NewEntity): this {
    this.pending.push({ ...e, id: e.id ?? this.newId(e.kind) } as MapEntity);
    return this;
  }

  spawn(at: V3, yaw: number, team: string | null = null): this {
    const { command } = addSpawnCommand(at, yaw);
    const spawn = (command as { entities: MapEntity[] }).entities[0]!;
    this.pending.push({ ...spawn, id: this.newId('spawn'), faction: team } as MapEntity);
    return this;
  }

  /** A pickup by item name (`core.` added), e.g. `weapon_railgun`, `health_large`. */
  pickup(item: string, at: V3, respawnSeconds: number | null = null): this {
    return this.add({ kind: 'pickup', item: `core.${item}`, position: at, respawnSeconds });
  }

  /** A prop by name (`prop.` added). */
  prop(model: string, at: V3, yaw = 0, scale = 1, solid = true): this {
    return this.add({ kind: 'prop', model: `prop.${model}`, position: at, yaw, scale, solid, tint: null });
  }

  breakable(model: 'crate' | 'barrel' | 'glass' | 'boards' | 'gas' | 'generator' | 'wall', at: V3, yaw = 0): this {
    return this.add({ kind: 'destructible', model, position: at, yaw, health: null, explosiveOnly: false });
  }

  mount(model: MountModel, at: V3, yaw = 0, team: string | null = null): this {
    return this.add({ kind: 'mount', model, position: at, yaw, faction: team, respawnSeconds: null });
  }

  /** Capture the Flag: `team`'s flag base, standing on the floor at `at`. */
  flag(team: string, at: V3, yaw = 0): this {
    return this.add({ kind: 'flag', position: at, yaw, team });
  }

  /** Hostage Rescue: a hostage's starting spot. */
  hostage(at: V3, yaw = 0): this {
    return this.add({ kind: 'hostage', position: at, yaw });
  }

  /** Hostage Rescue: where hostages are brought out. */
  rescue(at: V3, radius = 4): this {
    return this.add({ kind: 'rescue', position: at, radius });
  }

  /** King of the Hill: a hill spot (the hill moves between them in the order they are added). */
  hill(at: V3, radius = 5): this {
    return this.add({ kind: 'hill', position: at, radius });
  }

  /** A jump pad throwing you `power` m/s up and `push` m/s along `yaw`. */
  pad(at: V3, yaw: number, power = 14, push = 6): this {
    return this.add({ kind: 'pad', position: at, yaw, power, push });
  }

  /** A free block (`size` [x, thickness, z], base at `at`): solid, breakable, crumble or trapdoor. */
  block(at: V3, size: V3, behaviour: 'solid' | 'breakable' | 'crumble' | 'trapdoor' = 'solid', o: { material?: string; tint?: string; yaw?: number; delay?: number; respawn?: number | null; health?: number; trigger?: 'step' | 'logic'; id?: string } = {}): this {
    return this.add({
      kind: 'block',
      position: at,
      size,
      yaw: o.yaw ?? 0,
      material: o.material ? `core.${o.material}` : null,
      tint: o.tint ?? null,
      behaviour,
      trigger: o.trigger ?? 'step',
      delaySeconds: o.delay ?? (behaviour === 'trapdoor' ? 0.15 : 0.8),
      respawnSeconds: o.respawn === undefined ? 8 : o.respawn,
      health: o.health ?? 120,
      ...(o.id ? { id: o.id } : {}),
    });
  }

  /** A body of liquid with its floor at `at` and `size` [x, depth, z]. */
  water(at: V3, size: V3, liquid: 'water' | 'lava' | 'acid' | 'swamp' = 'water'): this {
    return this.add({ kind: 'water', position: at, size, liquid });
  }

  /** Scenario logic: variables, timers, objectives and WHEN -> IF -> DO rules (docs/SCENARIO.md). Replaces any set before. */
  logic(logic: ScenarioLogic): this {
    this.run('Logic', { kind: 'setLogic', before: this.doc.logic, after: logic });
    return this;
  }

  /** The map's NPC factions (replaces any set before). */
  factions(factions: MapDocument['factions']): this {
    this.run('Factions', { kind: 'setFactions', before: this.doc.factions, after: [...factions] });
    return this;
  }

  theme(theme: string): this {
    this.run('Change theme', setThemeCommand(this.doc, `core.${theme}`));
    return this;
  }

  terrain(t: TerrainData): this {
    this.run('Terrain', { kind: 'setTerrain', before: this.doc.terrain, after: t });
    return this;
  }

  /** Walls round the play area: fitted round everything built (`margin` m out), or an explicit rectangle. */
  bounds(style: BoundaryStyle, margin = 4, rect?: { min: [number, number]; max: [number, number] }, height = 8): this {
    this.flush();
    const fit = rect ?? fitBounds(this.doc, margin);
    if (!fit) throw new Error(`${this.id}: nothing to fit a boundary round`);
    this.run('Boundary', { kind: 'setBounds', before: this.doc.bounds, after: { min: fit.min, max: fit.max, style, height } });
    return this;
  }

  /** Sky, distant scenery, ground past the border and haze (otherwise the theme's). */
  backdrop(sky: SkyId, scenery: SceneryId, ground: BackdropGround, haze = 0.5): this {
    this.run('Backdrop', { kind: 'setBackdrop', before: this.doc.backdrop, after: { sky, scenery, ground, haze } });
    return this;
  }

  teams(sizes: number[]): this {
    this.run('Teams', { kind: 'setTeamSetup', before: this.doc.teamSetup, after: { sizes } });
    return this;
  }

  /** The map's team IDs (Embers, Tide, Verdant…) for team spawns. */
  teamIds(count = 2): string[] {
    return mapTeams(this.doc, count).map((t) => t.id);
  }

  meta(m: { description: string; modes: GameMode[]; players: [number, number]; author?: string }): this {
    this.run('Edit map', {
      kind: 'setMetadata',
      before: this.doc.metadata,
      after: { id: this.id, author: m.author ?? 'ChronoSplit', description: m.description, recommendedPlayers: { min: m.players[0], max: m.players[1] }, supportedModes: m.modes },
    });
    return this;
  }

  private flush(): void {
    if (!this.pending.length) return;
    this.run('Add entities', { kind: 'addEntities', entities: this.pending.splice(0) });
  }

  /**
   * Validate (schema, rules and the navmesh: every spawn and pickup reachable)
   * and write maps/<id>.json (or maps/<dir>/<id>.json). Warnings are printed;
   * errors stop the build, or with `exitOnError: false` skip the write and are
   * returned with the other issues.
   */
  async save(o: { dir?: string; exitOnError?: boolean; quiet?: boolean } = {}): Promise<ValidationIssue[]> {
    this.flush();
    // Props on the terrain are bedded into the slope under them (no floating corners).
    const settled = applyCommand(this.doc, settlePropsCommand(this.doc));
    const loaded = loadMap(JSON.parse(serializeMap(settled)));
    if (!loaded.ok) throw new Error(`${this.id}: map does not load: ${JSON.stringify(loaded.issues)}`);
    await Promise.all([initPhysics(), initNavigation()]);
    const geometry = buildMapGeometry(loaded.map);
    const physics = new PhysicsWorld(geometry, mapTerrainMesh(loaded.map));
    const nav = NavWorld.build([...geometry, ...propBoxes(loaded.map, true), ...blockBoxes(loaded.map, true)], mapTerrainMesh(loaded.map), navLinks(loaded.map.entities, physics));
    physics.free();
    const issues = [...validateMap(loaded.map), ...validateNavigation(loaded.map, nav)];
    nav.destroy();
    if (!o.quiet) for (const i of issues) console.log(`${this.id}: ${i.severity.padEnd(10)} ${i.code} ${i.message}`);
    if (issues.some((i) => i.severity === 'error')) {
      if (o.exitOnError === false) return issues;
      process.exit(1);
    }
    const out = fileURLToPath(new URL(`../../../../maps/${o.dir ? `${o.dir}/` : ''}${this.id}.json`, import.meta.url));
    writeFileSync(out, serializeMap(loaded.map));
    if (!o.quiet) console.log(`${this.id}: wrote ${out} (${this.doc.classicStructure.tiles.length} tiles, ${this.doc.entities.length} entities, ${issues.length} notes)`);
    return issues;
  }
}
