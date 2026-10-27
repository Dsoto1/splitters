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
  resolveBackdrop,
  type LightFixture,
  AIR_PUSH_DECAY,
  PLAYER,
  TICK_DT,
  CORE_PROPS,
  EditHistory,
  addSpawnCommand,
  blockBoxes,
  buildOccupancy,
  rotateXZ,
  buildMapGeometry,
  propBoxes,
  fitBounds,
  initPhysics,
  PhysicsWorld,
  loadMap,
  mapPads,
  mapTeams,
  navLinks,
  liftLinks,
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
  type BorderSides,
  type BorderStyle,
  type EdgeStyle,
  type GameMode,
  type MapDocument,
  type MapEntity,
  type MountModel,
  type Rotation,
  type RoomOptions,
  type ScenarioLogic,
  type Side,
  type TerrainData,
  type ValidationIssue,
  Track,
  conformTerrainToTrack,
  dressRoom,
  dressSpace,
  modelBudget,
  roomCells,
  type DressOptions,
  type DressSpace,
  type RoomType,
} from '@tiletrigger/shared';
import { NavWorld, initNavigation, validateNavigation } from '@tiletrigger/shared/match';

type V3 = [number, number, number];
/** Any entity without its ID (one per kind, so object literals are checked against the right kind). */
type NewEntity = MapEntity extends infer E ? (E extends MapEntity ? Omit<E, 'id'> & { id?: string } : never) : never;

/** What a room is furnished as: four corner pieces per room, the sets taken in turn. */
export type FurnishStyle = 'home' | 'office' | 'barracks' | 'tavern' | 'store';
const FURNISH: Record<FurnishStyle, string[][]> = {
  home: [
    ['fridge', 'kitchen_cabinet', 'stove', 'table'],
    ['sofa', 'bookcase', 'armchair', 'tv_cabinet'],
    ['bed', 'coat_rack', 'side_table', 'floor_lamp'],
  ],
  office: [
    ['desk', 'bookcase', 'desk', 'potted_plant'],
    ['bookcase_wide', 'desk', 'floor_lamp', 'desk'],
    ['shelf_boxes', 'metal_crate', 'desk', 'bookcase'],
  ],
  barracks: [
    ['bunk_bed', 'metal_crate', 'bunk_bed', 'shelf_bags'],
    ['table', 'crate_large', 'shelf_boxes', 'barrel'],
  ],
  tavern: [
    ['table', 'barrel', 'bench', 'dungeon_barrel'],
    ['bookcase', 'table_cloth', 'crate_small', 'barrel'],
    ['bed', 'side_table', 'coat_rack', 'dungeon_barrel'],
  ],
  store: [
    ['shelf_boxes', 'crate_large', 'shelf_bags', 'barrel'],
    ['metal_crate', 'shelf_boxes', 'crate_small', 'shelf_bags'],
  ],
};
const THEME_FURNISH: Record<string, FurnishStyle> = {
  city: 'home', manor: 'home', saloon: 'home', garden: 'home', harbour: 'home',
  lab: 'office', station: 'office', neon: 'office',
  bunker: 'barracks', arctic: 'barracks', canyon: 'barracks', forest: 'barracks',
  castle: 'tavern', desert: 'tavern', tomb: 'tavern', ruins: 'tavern', temple: 'tavern',
  factory: 'store', prototype: 'store', volcano: 'store',
};

/** Buildings with a roof of their own, for `lightRooms`: lit on every storey, or under the roof only. */
const ROOFED: Record<string, 'all' | 'top'> = { house: 'all', shop: 'all', bunker: 'all', warehouse: 'top' };

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

  /** Place a tile (a core tile without its `core.` prefix, or a full id like `city.street`) at cell x, y on level z. */
  tile(kind: string, x: number, y: number, z = 0, rotation: Rotation = 0, options?: RoomOptions): this {
    const r = placeTileCommand(this.doc, kind.includes('.') ? kind : `core.${kind}`, x, y, z, rotation);
    if ('error' in r) throw new Error(`${this.id}: ${kind} at ${x},${y},${z}: ${r.error}`);
    this.run('Place tile', { kind: 'addTiles', tiles: [{ ...r.placement, id: this.newId('tile'), ...(options ? { options } : {}) }] });
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

  /** A turret or vehicle; `onWater` vehicles ride on water instead of sinking (boats, jet skis). */
  mount(model: MountModel, at: V3, yaw = 0, team: string | null = null, opts: { onWater?: boolean } = {}): this {
    return this.add({ kind: 'mount', model, position: at, yaw, faction: team, respawnSeconds: null, ...(opts.onWater ? { onWater: true } : {}) });
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

  /**
   * A jump pad at `from` aimed to land you at `to` (both feet positions), with
   * `power` m/s of lift: the push is solved by flying the launch tick by tick
   * as movement does (gravity, and the push fading in the air).
   */
  padTo(from: V3, to: V3, power: number): this {
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    const want = Math.hypot(dx, dz);
    const flight = (push: number): number | null => {
      let y = from[1];
      let vy = power;
      let v = push;
      let d = 0;
      for (let t = 0; t < 8; t += TICK_DT) {
        d += v * TICK_DT;
        y += vy * TICK_DT;
        vy -= PLAYER.gravity * TICK_DT;
        v *= AIR_PUSH_DECAY;
        if (vy < 0 && y <= to[1]) return d;
      }
      return null;
    };
    if (flight(0) === null) throw new Error(`${this.id}: a pad with ${power} m/s of lift never comes down to ${to[1]} m`);
    let lo = 0;
    let hi = 80;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if ((flight(mid) ?? Infinity) < want) lo = mid;
      else hi = mid;
    }
    if (lo > 40) throw new Error(`${this.id}: the pad at ${from} needs ${lo.toFixed(1)} m/s of push (40 at most): give it more lift`);
    return this.pad(from, +Math.atan2(dx, dz).toFixed(4), power, +lo.toFixed(2));
  }

  /** A light at `at` (fixture defaults to a ceiling panel; colour a warm white). */
  light(at: V3, o: { fixture?: LightFixture; color?: string; intensity?: number; range?: number; yaw?: number; id?: string; off?: boolean; blink?: number; text?: string; size?: [number, number] } = {}): this {
    return this.add({
      kind: 'light',
      position: at,
      yaw: o.yaw ?? 0,
      color: o.color ?? '#fff1d6',
      intensity: o.intensity ?? 1,
      range: o.range ?? 9,
      fixture: o.fixture ?? 'ceiling',
      // v20: logic can switch lights by ID; they can start off or blinking.
      ...(o.off ? { off: true } : {}),
      ...(o.blink ? { blink: o.blink } : {}),
      // Style Packs: the words and size of a neon sign or holographic billboard.
      ...(o.text ? { text: o.text } : {}),
      ...(o.size ? { size: o.size } : {}),
      ...(o.id ? { id: o.id } : {}),
    });
  }

  /**
   * A ceiling light in every roofed room: each single-cell room, corridor or
   * stairwell with a floor straight above it gets a panel just under that
   * floor, and so does every cell of a building with a roof of its own (house,
   * shop, bunker; a warehouse under its roof only). `skip` leaves cells out
   * (open-plan halls, outdoor-feeling spaces).
   */
  lightRooms(o: { color?: string; intensity?: number; range?: number; fixture?: LightFixture; skip?: (x: number, y: number, z: number) => boolean } = {}): this {
    this.flush();
    const cell = this.doc.classicStructure.cellSize;
    const level = this.doc.classicStructure.levelHeight;
    const tiles = this.doc.classicStructure.tiles;
    const above = new Set(tiles.map((t) => `${t.x},${t.y},${t.z}`));
    for (const t of tiles) {
      if (!/^core\.(room|room_pillar|room_columns|room_cover|corridor)$/.test(t.tile)) continue;
      if (!above.has(`${t.x},${t.y},${t.z + 1}`) || o.skip?.(t.x, t.y, t.z)) continue;
      this.light([t.x * cell, t.z * level + level - 0.55, t.y * cell], o);
    }
    for (const occ of buildOccupancy(this.doc).cells.values()) {
      const roofed = ROOFED[occ.def.id.replace(/^core\./, '')];
      if (!roofed || (roofed === 'top' && occ.level !== Math.max(...occ.def.cells.map((c) => c[2])))) continue;
      const [rx, ry] = rotateXZ(occ.local[0], occ.local[1], occ.placement.rotation);
      const [x, y, z] = [occ.placement.x + rx, occ.placement.y + ry, occ.placement.z + occ.level];
      if (o.skip?.(x, y, z)) continue;
      // A warehouse light hangs below the trusses, with a whole hall to fill.
      if (roofed === 'top') this.light([x * cell, z * level + level - 0.9, y * cell], { ...o, fixture: 'bulb', range: Math.max(o.range ?? 9, 14) });
      else this.light([x * cell, z * level + level - 0.55, y * cell], o);
    }
    return this;
  }

  /** A jump pad throwing you `power` m/s up and `push` m/s along `yaw`. */
  pad(at: V3, yaw: number, power = 14, push = 6): this {
    return this.add({ kind: 'pad', position: at, yaw, power, push });
  }

  /** A free block (`size` [x, thickness, z], base at `at`): solid, breakable, crumble or trapdoor. */
  block(at: V3, size: V3, behaviour: 'solid' | 'breakable' | 'crumble' | 'trapdoor' = 'solid', o: { material?: string; tint?: string; yaw?: number; delay?: number; respawn?: number | null; health?: number; trigger?: 'step' | 'logic'; id?: string; pitch?: number; roll?: number; hidden?: boolean; field?: boolean } = {}): this {
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
      // v20: tilt (radians, ±45°: ramps, roofs, wrecks; pitch lifts the +Z end) and starting hidden (logic rebuilds it).
      ...(o.pitch ? { pitch: o.pitch } : {}),
      ...(o.roll ? { roll: o.roll } : {}),
      ...(o.hidden ? { startHidden: true } : {}),
      // Style Packs: a force field (blocks players and vehicles, not shots; logic switches it).
      ...(o.field ? { field: true } : {}),
      ...(o.id ? { id: o.id } : {}),
    });
  }

  /** A force field across `width` m, `height` m tall, centred at `at` and turned by `yaw` (logic switches it by `id`). */
  field(at: V3, width: number, height: number, o: { yaw?: number; id?: string; tint?: string; hidden?: boolean } = {}): this {
    return this.block(at, [width, height, 0.2], 'solid', { yaw: o.yaw ?? 0, tint: o.tint ?? '#5ad8ff', trigger: 'logic', respawn: null, field: true, ...(o.id ? { id: o.id } : {}), ...(o.hidden ? { hidden: true } : {}) });
  }

  /** A zone whose gravity is `gravity` × the map's (Style Packs): floor centre `at`, `size` [x, height, z]. */
  gravityZone(at: V3, size: V3, gravity: number, name = 'Low gravity'): this {
    return this.add({ kind: 'zone', position: at, size, who: 'any', count: 1, startEnabled: true, gravity, name });
  }

  /** A body of liquid with its floor at `at` and `size` [x, depth, z]; `tint` recolours it (v20: green acid, murky sewer water). */
  water(at: V3, size: V3, liquid: 'water' | 'lava' | 'acid' | 'swamp' = 'water', tint?: string): this {
    return this.add({ kind: 'water', position: at, size, liquid, ...(tint ? { tint } : {}) });
  }

  /**
   * A mover (v20): carries the blocks `blocks` (IDs) between `points`
   * (offsets from where the blocks are placed; [0, 0, 0] first), turning them
   * by `angles` (radians, per point) about a level hinge through `at`, square
   * to `yaw` (drawbridges). `loop`/`pingpong` run by themselves; `trigger`
   * waits for logic ("mover_go", "mover_to"). See docs/BUILDING_KIT.md.
   */
  mover(id: string, at: V3, blocks: string[], points: V3[], o: { mode?: 'loop' | 'pingpong' | 'trigger'; speed?: number; turnSpeed?: number; wait?: number; yaw?: number; angles?: number[]; startActive?: boolean; name?: string; props?: string[] } = {}): this {
    return this.add({
      kind: 'mover',
      id,
      position: at,
      yaw: o.yaw ?? 0,
      blocks,
      ...(o.props?.length ? { props: o.props } : {}),
      points,
      ...(o.angles ? { angles: o.angles } : {}),
      mode: o.mode ?? 'pingpong',
      speed: o.speed ?? 3,
      turnSpeed: o.turnSpeed ?? 45,
      wait: o.wait ?? 2,
      startActive: o.startActive ?? true,
      ...(o.name ? { name: o.name } : {}),
    });
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

  /**
   * A race track through `points` (see map/track.ts); `layIn` also lays the
   * road into the terrain (flat under it, shoulders blended).
   */
  track(t: Partial<Track> & { points: [number, number, number][] }, layIn = true): this {
    const track = Track.parse(t);
    this.run('Track', { kind: 'setTrack', before: this.doc.track, after: track });
    if (layIn && this.doc.terrain) this.terrain(conformTerrainToTrack(this.doc.terrain, track));
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
  backdrop(sky: SkyId, scenery: SceneryId, ground: BackdropGround, haze = 0.5, mist = 0): this {
    // A border set earlier stays.
    const { border, borderSides } = this.doc.backdrop ?? {};
    this.run('Backdrop', { kind: 'setBackdrop', before: this.doc.backdrop, after: { sky, scenery, ground, haze, ...(mist ? { mist } : {}), ...(border ? { border } : {}), ...(borderSides ? { borderSides } : {}) } });
    return this;
  }

  /**
   * A border along the boundary (see shared map/border.ts): one style all
   * round, optionally overridden per side. Keeps the backdrop (the theme's,
   * if the map has none of its own yet).
   */
  border(style: BorderStyle, sides?: BorderSides): this {
    const { border: _b, borderSides: _s, ...rest } = resolveBackdrop(this.doc);
    this.run('Border', { kind: 'setBackdrop', before: this.doc.backdrop, after: { ...rest, ...(style !== 'none' ? { border: style } : {}), ...(sides && Object.keys(sides).length ? { borderSides: sides } : {}) } });
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
      after: { id: this.id, author: m.author ?? 'Tile Trigger', description: m.description, recommendedPlayers: { min: m.players[0], max: m.players[1] }, supportedModes: m.modes },
    });
    return this;
  }

  /**
   * Where the map's picture is taken from (`metadata.thumbnailCamera`): the
   * camera position and the point it looks at. Only for maps where the
   * automatic camera choice (tools/content/capture-map-shots.mjs) frames a
   * poor view; without it the tool picks the camera itself.
   */
  thumbnailCamera(position: V3, target: V3): this {
    this.run('Set thumbnail camera', { kind: 'setMetadata', before: { thumbnailCamera: this.doc.metadata.thumbnailCamera }, after: { thumbnailCamera: { position, target } } });
    return this;
  }

  private flush(): void {
    if (!this.pending.length) return;
    this.run('Add entities', { kind: 'addEntities', entities: this.pending.splice(0) });
  }


  /** The map as it stands, loaded, with its navmesh (destroy it when done). */
  private async navigate(): Promise<{ loaded: { ok: true; map: MapDocument }; nav: NavWorld }> {
    this.flush();
    // Props on the terrain are bedded into the slope under them (no floating corners).
    const settled = applyCommand(this.doc, settlePropsCommand(this.doc));
    const loaded = loadMap(JSON.parse(serializeMap(settled)));
    if (!loaded.ok) throw new Error(`${this.id}: map does not load: ${JSON.stringify(loaded.issues)}`);
    await Promise.all([initPhysics(), initNavigation()]);
    const geometry = buildMapGeometry(loaded.map);
    const physics = new PhysicsWorld(geometry, mapTerrainMesh(loaded.map));
    const nav = NavWorld.build([...geometry, ...propBoxes(loaded.map, true), ...blockBoxes(loaded.map, true)], mapTerrainMesh(loaded.map), [...navLinks(loaded.map.entities, physics), ...liftLinks(loaded.map)]);
    physics.free();
    return { loaded: loaded as { ok: true; map: MapDocument }, nav };
  }

  /**
   * Team bases for a map built for free-for-all: two teams of `perTeam`, each
   * with a cluster of spawns at its own end of the map's long axis (facing the
   * middle), a flag at the back of the cluster for Capture the Flag, and
   * `hills` King of the Hill spots spread along the middle. Spots come from
   * the navmesh, so they are walkable and reachable from the existing spawns.
   * The shared spawns stay for free-for-all.
   */
  async teamBases(perTeam: number, o: { hills?: number; flags?: boolean; spacing?: number; minY?: number } = {}): Promise<this> {
    this.teams([perTeam, perTeam]);
    const [a, b] = this.teamIds(2) as [string, string];
    const { nav } = await this.navigate();
    const spawns = this.doc.entities.filter((e) => e.kind === 'spawn');
    const from = spawns[0]?.position;
    if (!from) throw new Error(`${this.id}: teamBases needs a spawn to start from`);
    const start = { x: from[0], y: from[1], z: from[2] };
    const taken = this.doc.entities.filter((e) => e.kind === 'pickup' || e.kind === 'spawn' || e.kind === 'mount' || e.kind === 'pad').map((e) => e.position);
    const places = nav
      .places()
      .filter((p) => p.y >= (o.minY ?? -Infinity) && nav.findPath(start, p) && nav.findPath(p, start) && !taken.some((t) => Math.hypot(t[0] - p.x, t[2] - p.z) < 1.5 && Math.abs(t[1] - p.y) < 2));
    nav.destroy();
    if (places.length < perTeam * 3) throw new Error(`${this.id}: only ${places.length} walkable places for team bases`);
    // The long axis: whichever of x and z the walkable area spans further.
    const span = (k: 'x' | 'z') => Math.max(...places.map((p) => p[k])) - Math.min(...places.map((p) => p[k]));
    const k: 'x' | 'z' = span('x') >= span('z') ? 'x' : 'z';
    const mid = (Math.max(...places.map((p) => p[k])) + Math.min(...places.map((p) => p[k]))) / 2;
    const cx = places.reduce((s, p) => s + p.x, 0) / places.length;
    const cz = places.reduce((s, p) => s + p.z, 0) / places.length;
    const spacing = o.spacing ?? 3;
    const pick = (sign: 1 | -1) => {
      const sorted = [...places].sort((p, q) => sign * (q[k] - p[k]));
      const out: typeof places = [];
      for (const p of sorted) {
        if (out.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < spacing && Math.abs(q.y - p.y) < 2)) continue;
        out.push(p);
        if (out.length === perTeam + 1) break;
      }
      return out;
    };
    const r = (n: number) => +n.toFixed(2);
    for (const [team, sign] of [[a, -1], [b, 1]] as const) {
      const spots = pick(sign);
      // The spot deepest in the base holds the flag; the rest are spawns facing the middle.
      const [deepest, ...rest] = spots;
      for (const p of rest) this.spawn([r(p.x), r(p.y), r(p.z)], r(Math.atan2(cx - p.x, cz - p.z)), team);
      if (o.flags !== false && deepest) this.flag(team, [r(deepest.x), r(deepest.y), r(deepest.z)], r(Math.atan2(cx - deepest.x, cz - deepest.z)));
    }
    // Hills: spread across the middle third, the most central first.
    const middle = places.filter((p) => Math.abs(p[k] - mid) < span(k) / 6).sort((p, q) => Math.hypot(p.x - cx, p.z - cz) - Math.hypot(q.x - cx, q.z - cz));
    const hills: typeof places = [];
    for (const p of middle) {
      if (hills.length >= (o.hills ?? 3)) break;
      if (hills.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 12)) continue;
      hills.push(p);
    }
    for (const p of hills) this.hill([r(p.x), r(p.y), r(p.z)], 5);
    return this;
  }


  /**
   * Top each team up to `perTeam` spawns: walkable spots nearest the team's
   * own spawns (at least 3 m from any spawn), facing the same way as the
   * spawn they join.
   */
  async fillTeamSpawns(perTeam: number): Promise<this> {
    const { nav } = await this.navigate();
    const spawns = () => this.doc.entities.filter((e) => e.kind === 'spawn') as Extract<MapEntity, { kind: 'spawn' }>[];
    const first = spawns()[0]!.position;
    const start = { x: first[0], y: first[1], z: first[2] };
    const places = nav.places().filter((p) => nav.findPath(start, p) && nav.findPath(p, start));
    nav.destroy();
    const r = (n: number) => +n.toFixed(2);
    for (const team of new Set(spawns().map((s) => s.faction).filter((f): f is string => !!f))) {
      const own = spawns().filter((s) => s.faction === team);
      for (let n = own.length; n < perTeam; n++) {
        const all = [...spawns(), ...this.pending.filter((e) => e.kind === 'spawn')].map((s) => s.position);
        const free = places.filter((p) => !all.some((q) => Math.hypot(q[0] - p.x, q[2] - p.z) < 3 && Math.abs(q[1] - p.y) < 2));
        const near = (p: (typeof places)[number]) => Math.min(...own.map((s) => Math.hypot(s.position[0] - p.x, s.position[2] - p.z) + Math.abs(s.position[1] - p.y) * 3));
        const best = free.sort((a, b) => near(a) - near(b))[0];
        if (!best) break;
        const mate = own.reduce((m, s) => (Math.hypot(s.position[0] - best.x, s.position[2] - best.z) < Math.hypot(m.position[0] - best.x, m.position[2] - best.z) ? s : m));
        this.spawn([r(best.x), r(best.y), r(best.z)], mate.yaw, team);
        this.flush();
      }
    }
    return this;
  }


  /**
   * Furnish the map's bare rooms (plain, pillar, column and low-cover rooms
   * with no props in them yet) for what they'd be in this theme: kitchens,
   * living rooms and bedrooms in homes; offices and stores in factories and
   * labs; bunks and kit in bunkers and camps; tables and barrels in castles
   * and towns. Pieces stand in the corners, backs to the wall, so doorways
   * and the middle of the room stay clear; corners near spawns, pickups and
   * other set pieces are left empty, and so are the cells `skip` names
   * (corridors and halls built from room tiles).
   */
  furnish(style?: FurnishStyle, skip: (x: number, y: number, z: number) => boolean = () => false): this {
    this.flush();
    const theme = this.doc.classicStructure.theme.replace(/^core\./, '');
    const sets = FURNISH[style ?? THEME_FURNISH[theme] ?? 'store'];
    const cell = this.doc.classicStructure.cellSize;
    const level = this.doc.classicStructure.levelHeight;
    const props = this.doc.entities.filter((e) => e.kind === 'prop');
    const marks = this.doc.entities.filter((e) => e.kind !== 'prop').map((e) => e.position);
    const rooms = this.doc.classicStructure.tiles.filter((t) => /^core\.room(_pillar|_columns|_cover)?$/.test(t.tile));
    let n = 0;
    for (const t of rooms) {
      if (skip(t.x, t.y, t.z)) continue;
      const [cx, y, cz] = [t.x * cell, t.z * level, t.y * cell];
      if (props.some((p) => Math.abs(p.position[0] - cx) < cell / 2 && Math.abs(p.position[2] - cz) < cell / 2 && Math.abs(p.position[1] - y) < level / 2)) continue;
      const set = sets[n++ % sets.length]!;
      set.forEach((model, i) => {
        // Corners round the room; even ones back onto the north/south wall, odd ones the east/west.
        const sx = i === 1 || i === 2 ? 1 : -1;
        const sz = i >= 2 ? 1 : -1;
        const def = CORE_PROPS.find((p) => p.id === `prop.${model}`);
        if (!def) throw new Error(`furnish: no prop ${model}`);
        const [w, , d] = def.size;
        const alongZ = i % 2 === 0; // backs onto a z wall (north/south)
        const [fx, fz] = alongZ ? [w, d] : [d, w];
        const inner = cell / 2 - 0.55; // inside face of the wall, with a hand's gap
        const px = cx + sx * (inner - fx / 2);
        const pz = cz + sz * (inner - fz / 2);
        if (marks.some((m) => Math.hypot(m[0] - px, m[2] - pz) < 1.6 + Math.max(fx, fz) / 2 && Math.abs(m[1] - y) < 2)) return;
        const yaw = alongZ ? (sz > 0 ? Math.PI : 0) : sx > 0 ? -Math.PI / 2 : Math.PI / 2;
        this.prop(model, [+px.toFixed(2), y, +pz.toFixed(2)], +yaw.toFixed(4));
      });
    }
    return this;
  }

  /**
   * Dress a room for what it is (shared/map/dressing.ts): wall pieces backed
   * onto its walls, centre groups, corner pieces and wall decor from the room
   * type's recipe, keeping its doorways, windows, spawns and pickups clear and
   * a lane between its doorways. `room` is a cell (the whole room tile covering
   * it, on that level), a rectangle of cells on one level (walls built between
   * them count as obstacles), or a `DressSpace`. Seeded by the map and the
   * room, so rebuilding gives the same file; it stays within the map's prop
   * budgets (1,500 props, 80 different models). Dress after placing spawns and
   * pickups, so the furniture keeps clear of them.
   */
  dress(room: V3 | { x0: number; y0: number; x1: number; y1: number; z?: number } | DressSpace, type: RoomType, o: DressOptions = {}): this {
    this.flush();
    let space: DressSpace;
    let key: string;
    if (Array.isArray(room)) {
      const cells = roomCells(this.doc, room[0], room[1], room[2]);
      if (!cells.length) throw new Error(`${this.id}: dress: no room at ${room.join(',')}`);
      space = dressSpace(this.doc, cells);
      key = room.join(',');
    } else if ('rects' in room) {
      space = room;
      key = room.rects.map((r) => `${r.x0},${r.z0}`).join(';');
    } else {
      const z = room.z ?? 0;
      const cells: V3[] = [];
      for (let x = Math.min(room.x0, room.x1); x <= Math.max(room.x0, room.x1); x++) for (let y = Math.min(room.y0, room.y1); y <= Math.max(room.y0, room.y1); y++) cells.push([x, y, z]);
      space = dressSpace(this.doc, cells);
      key = `${room.x0},${room.y0},${room.x1},${room.y1},${z}`;
    }
    const props = this.doc.entities.filter((e) => e.kind === 'prop').length;
    const placed = dressRoom(space, type, { seed: `${this.id}:${key}`, models: modelBudget(this.doc), max: Math.max(0, Math.min(48, 1500 - props)), ...o });
    for (const p of placed) this.add(p);
    this.flush();
    return this;
  }

  /**
   * Validate (schema, rules and the navmesh: every spawn and pickup reachable)
   * and write maps/<id>.json (or maps/<dir>/<id>.json). Warnings are printed;
   * errors stop the build, or with `exitOnError: false` skip the write and are
   * returned with the other issues.
   */
  async save(o: { dir?: string; exitOnError?: boolean; quiet?: boolean } = {}): Promise<ValidationIssue[]> {
    const { loaded, nav } = await this.navigate();
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
