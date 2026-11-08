import { coreCatalog, type TileCatalog } from '../map/catalog.ts';
import { RESOURCE_BUDGETS, utf8Length } from '../map/budgets.ts';
import { MAP_BUDGETS, serializeMap } from '../map/validate.ts';
import { expandSetPieces, type SetPieceLibrary } from '../map/setPieces.ts';
import { builtInSetPieces } from '../map/setPieceLibrary.ts';
import { getEnvSpecies, isEnvModel } from '../content/environment.ts';
import type { MapDocument, MapEntity } from '../map/schema.ts';
import type { EditCommand } from './commands.ts';

/**
 * MapMaker's live budget bar (docs/MAPMAKER_OVERHAUL_PLAN.md, Phase 1 item 2): how near the map is to each budget
 * (RESOURCE_BUDGETS, the load limits a map is refused past; MAP_BUDGETS, the soft ones it is warned about;
 * docs/MAP_BUDGETS.md). Counted as played (set pieces expanded), except the file's own entity cap and its size, which
 * are the document's. `BudgetTracker` keeps them up to date from each edit's command (cheap: only what the edit
 * touches), never a full validation; `countBudgets` counts from scratch (the tests hold the two equal).
 */
export type BudgetId = 'entities' | 'destructibles' | 'vehicles' | 'lights' | 'props' | 'models' | 'draws' | 'env' | 'envColliding' | 'envCliffs' | 'envVariants' | 'size';

export interface BudgetRow {
  id: BudgetId;
  /** Short name on the bar. */
  label: string;
  /** What it counts, for the tooltip. */
  what: string;
  max: number;
  /** A load limit (the map is refused past it) rather than a soft budget (warned about). */
  hard: boolean;
  /** Bytes are shown in KB / MB. */
  bytes?: boolean;
}

/**
 * The draw estimate (owner's call: see HANDOFF, "MapMaker Phase 1A"): a draw call per different untinted prop model
 * (instanced), per tinted prop (each its own), per environment species variant and per body of liquid. Its budget is
 * the sum of the budgets behind those rows (80 prop models, 24 species variants, 32 liquids).
 */
export const DRAW_ESTIMATE_BUDGET = MAP_BUDGETS.propModels + MAP_BUDGETS.env.variants + MAP_BUDGETS.liquids;

export const BUDGET_ROWS: readonly BudgetRow[] = [
  { id: 'entities', label: 'Entities', what: 'everything placed but tiles (the file holds at most this many)', max: RESOURCE_BUDGETS.entities, hard: true },
  { id: 'props', label: 'Props', what: 'props (not trees and plants)', max: MAP_BUDGETS.props, hard: false },
  { id: 'models', label: 'Models', what: 'different prop models (each is a download and its own draw calls)', max: MAP_BUDGETS.propModels, hard: false },
  { id: 'draws', label: 'Draws', what: 'draw calls, estimated: a different prop model, a tinted prop, a species variant or a liquid each', max: DRAW_ESTIMATE_BUDGET, hard: false },
  { id: 'lights', label: 'Lights', what: 'lights', max: MAP_BUDGETS.lights, hard: false },
  { id: 'destructibles', label: 'Destructibles', what: 'destructibles and blocks that break, crumble, drop or are glass', max: RESOURCE_BUDGETS.destructibles, hard: true },
  { id: 'vehicles', label: 'Vehicles', what: 'vehicles, mounted guns and airplanes', max: RESOURCE_BUDGETS.vehicles, hard: true },
  { id: 'env', label: 'Plants', what: 'environment species placed (trees, plants, rocks, cliffs)', max: MAP_BUDGETS.env.placements, hard: false },
  { id: 'envColliding', label: 'Colliding', what: 'trees, boulders and cliffs (environment species that collide)', max: MAP_BUDGETS.env.colliding, hard: false },
  { id: 'envCliffs', label: 'Cliffs', what: 'cliff panels', max: MAP_BUDGETS.env.cliffs, hard: false },
  { id: 'envVariants', label: 'Variants', what: 'different environment species variants', max: MAP_BUDGETS.env.variants, hard: false },
  { id: 'size', label: 'Size', what: 'the map file', max: RESOURCE_BUDGETS.mapBytes, hard: true, bytes: true },
];

export type BudgetCounts = Record<BudgetId, number>;

/** Green, amber or red: under 80 % of the budget, from 80 % up to it, past it. */
export type BudgetLevel = 'ok' | 'near' | 'over';
export const BUDGET_NEAR = 0.8;
export function budgetLevel(n: number, max: number): BudgetLevel {
  return n > max ? 'over' : n >= max * BUDGET_NEAR ? 'near' : 'ok';
}

/** A count as the bar shows it: bytes in KB or MB, anything else as a number. */
export function budgetValue(row: Pick<BudgetRow, 'bytes'>, n: number): string {
  if (!row.bytes) return n.toLocaleString('en');
  return n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

const isDestructible = (e: MapEntity) => e.kind === 'destructible' || (e.kind === 'block' && (e.behaviour !== 'solid' || !!e.glass));
const isVehicle = (e: MapEntity) => e.kind === 'mount' || e.kind === 'airplane';

/** The things a budget row counts, for the bar's "select them" (entities of the document: a set piece's parts can't be). */
export function budgetCulprits(doc: MapDocument, id: BudgetId): string[] {
  const pick = (f: (e: MapEntity) => boolean) => doc.entities.filter(f).map((e) => e.id);
  const env = (f: (s: NonNullable<ReturnType<typeof getEnvSpecies>>) => boolean) => pick((e) => e.kind === 'prop' && isEnvModel(e.model) && ((s) => !!s && f(s))(getEnvSpecies(e.model)));
  switch (id) {
    case 'props':
    case 'models':
    case 'draws':
      return pick((e) => e.kind === 'prop' && !isEnvModel(e.model));
    case 'lights':
      return pick((e) => e.kind === 'light');
    case 'destructibles':
      return pick(isDestructible);
    case 'vehicles':
      return pick(isVehicle);
    case 'env':
    case 'envVariants':
      return env(() => true);
    case 'envColliding':
      return env((s) => s.nav !== 'none');
    case 'envCliffs':
      return env((s) => s.category === 'cliff');
    case 'entities':
    case 'size':
      return [];
  }
}

/** Counts that grow and shrink with each entity (and the multisets behind the "different" ones). */
class Tally {
  props = 0;
  tinted = 0;
  lights = 0;
  destructibles = 0;
  vehicles = 0;
  liquids = 0;
  env = 0;
  envColliding = 0;
  envCliffs = 0;
  /** Untinted props by model (one instanced draw each), and tinted ones (each its own draw; still a download). */
  readonly models = new Map<string, number>();
  readonly tintedModels = new Map<string, number>();
  readonly variants = new Map<string, number>();

  add(e: MapEntity, sign: 1 | -1): void {
    if (e.kind === 'prop') {
      if (isEnvModel(e.model)) {
        this.env += sign;
        const s = getEnvSpecies(e.model);
        if (s && s.nav !== 'none') this.envColliding += sign;
        if (s?.category === 'cliff') this.envCliffs += sign;
        bump(this.variants, `${e.model}#${e.variant ?? 0}`, sign);
      } else {
        this.props += sign;
        if (e.tint) {
          this.tinted += sign;
          bump(this.tintedModels, e.model, sign);
        } else bump(this.models, e.model, sign);
      }
    } else if (e.kind === 'light') this.lights += sign;
    else if (e.kind === 'water') this.liquids += sign;
    if (isDestructible(e)) this.destructibles += sign;
    if (isVehicle(e)) this.vehicles += sign;
  }
}

function bump(m: Map<string, number>, key: string, sign: 1 | -1): void {
  const n = (m.get(key) ?? 0) + sign;
  if (n > 0) m.set(key, n);
  else m.delete(key);
}

/** Bytes a pretty-printed item adds inside an array nested `depth` deep in the saved file (serializeMap's 2-space indent). */
const itemBytes = new WeakMap<object, readonly [bytes: number, lines: number]>();
function prettyItem(item: object, depth: number): number {
  let m = itemBytes.get(item);
  if (!m) {
    const s = JSON.stringify(item, null, 2);
    let lines = 1;
    for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) lines++;
    // Kept as the length and the line count: the indent each line gets depends on where the item sits.
    m = [utf8Length(s), lines];
    itemBytes.set(item, m);
  }
  return m[0] + m[1] * depth * 2;
}

/** A pretty-printed array's own bytes beyond "[]": its brackets' lines and the commas between items. */
const arrayBytes = (count: number, depth: number) => (count ? 2 + 2 * (depth - 1) + 2 * (count - 1) : 0);
// Depths: the document is 0, so its entities and set pieces are items at depth 2, its tiles (in classicStructure) at 3.
const ENTITY_DEPTH = 2;
const TILE_DEPTH = 3;

/** The saved file without its tiles, entities and set pieces (those are counted item by item). */
function skeletonBytes(doc: MapDocument): number {
  const skeleton: MapDocument = { ...doc, entities: [], classicStructure: { ...doc.classicStructure, tiles: [] }, ...(doc.setPieces ? { setPieces: [] } : {}) };
  return utf8Length(serializeMap(skeleton));
}

function itemsBytes(items: readonly object[], depth: number): number {
  let n = 0;
  for (const i of items) n += prettyItem(i, depth);
  return n;
}

/** Every count from scratch: the map as played (set pieces expanded), and the file as saved. */
export function countBudgets(doc: MapDocument, library: SetPieceLibrary = builtInSetPieces(), catalog: TileCatalog = coreCatalog): BudgetCounts {
  const t = new Tally();
  for (const e of expandSetPieces(doc, library, catalog).map.entities) t.add(e, 1);
  return countsOf(t, doc.entities.length, utf8Length(serializeMap(doc)));
}

function countsOf(t: Tally, entities: number, size: number): BudgetCounts {
  return {
    entities,
    props: t.props,
    models: t.models.size + [...t.tintedModels.keys()].filter((m) => !t.models.has(m)).length,
    draws: t.models.size + t.tinted + t.variants.size + t.liquids,
    lights: t.lights,
    destructibles: t.destructibles,
    vehicles: t.vehicles,
    env: t.env,
    envColliding: t.envColliding,
    envCliffs: t.envCliffs,
    envVariants: t.variants.size,
    size,
  };
}

/**
 * The budget bar's counters, kept from each edit: the history tells it the command it applied (EditHistory's
 * `onChange`; undo and redo give the command they apply), and only what that command adds, removes or changes is
 * counted again. A set piece edit (or the theme, or the map's own pieces) counts the set pieces' parts again; an edit
 * to the map's settings (terrain, logic, sky…) measures the file without its items again.
 */
export class BudgetTracker {
  private tally = new Tally();
  /** The set pieces' parts (entities), as counted into `tally`. */
  private parts: readonly MapEntity[] = [];
  private entities = 0;
  private tiles = 0;
  private pieces = 0;
  private itemBytes = 0;
  private skeleton = 0;
  private doc!: MapDocument;

  constructor(
    doc: MapDocument,
    private readonly library: SetPieceLibrary = builtInSetPieces(),
    private readonly catalog: TileCatalog = coreCatalog,
  ) {
    this.reset(doc);
  }

  get counts(): BudgetCounts {
    const size = this.skeleton + this.itemBytes + arrayBytes(this.entities, ENTITY_DEPTH) + arrayBytes(this.tiles, TILE_DEPTH) + arrayBytes(this.pieces, ENTITY_DEPTH);
    return countsOf(this.tally, this.entities, size);
  }

  /** Count a document from scratch (opened, or a new map). */
  reset(doc: MapDocument): void {
    this.doc = doc;
    this.tally = new Tally();
    for (const e of doc.entities) this.tally.add(e, 1);
    this.entities = doc.entities.length;
    this.tiles = doc.classicStructure.tiles.length;
    this.pieces = doc.setPieces?.length ?? 0;
    this.itemBytes = itemsBytes(doc.entities, ENTITY_DEPTH) + itemsBytes(doc.classicStructure.tiles, TILE_DEPTH) + itemsBytes(doc.setPieces ?? [], ENTITY_DEPTH);
    this.skeleton = skeletonBytes(doc);
    this.parts = [];
    this.countParts(doc);
  }

  /** An edit: `command` took the document to `doc`. */
  apply(command: EditCommand, doc: MapDocument): void {
    const touched = { pieces: false, settings: false };
    this.step(command, touched);
    this.doc = doc;
    if (touched.pieces) this.countParts(doc);
    // The file's settings (and its keys' order: set pieces come and go at the end) are measured again.
    if (touched.settings || touched.pieces) this.skeleton = skeletonBytes(doc);
  }

  private step(c: EditCommand, touched: { pieces: boolean; settings: boolean }): void {
    switch (c.kind) {
      case 'addEntities':
      case 'removeEntities': {
        const sign = c.kind === 'addEntities' ? 1 : -1;
        for (const e of c.entities) this.tally.add(e, sign);
        this.entities += sign * c.entities.length;
        this.itemBytes += sign * itemsBytes(c.entities, ENTITY_DEPTH);
        return;
      }
      case 'updateEntities':
        for (const e of c.before) this.tally.add(e, -1);
        for (const e of c.after) this.tally.add(e, 1);
        this.itemBytes += itemsBytes(c.after, ENTITY_DEPTH) - itemsBytes(c.before, ENTITY_DEPTH);
        return;
      case 'addTiles':
      case 'removeTiles': {
        const sign = c.kind === 'addTiles' ? 1 : -1;
        this.tiles += sign * c.tiles.length;
        this.itemBytes += sign * itemsBytes(c.tiles, TILE_DEPTH);
        return;
      }
      case 'updateTiles':
        this.itemBytes += itemsBytes(c.after, TILE_DEPTH) - itemsBytes(c.before, TILE_DEPTH);
        return;
      case 'addSetPieces':
      case 'removeSetPieces': {
        const sign = c.kind === 'addSetPieces' ? 1 : -1;
        this.pieces += sign * c.setPieces.length;
        this.itemBytes += sign * itemsBytes(c.setPieces, ENTITY_DEPTH);
        touched.pieces = true;
        return;
      }
      case 'updateSetPieces':
        this.itemBytes += itemsBytes(c.after, ENTITY_DEPTH) - itemsBytes(c.before, ENTITY_DEPTH);
        touched.pieces = true;
        return;
      case 'setTheme':
      case 'setSetPieceDefs':
        touched.pieces = true;
        touched.settings = true;
        return;
      case 'batch':
        for (const x of c.commands) this.step(x, touched);
        return;
      default:
        touched.settings = true;
    }
  }

  /** The set pieces' parts, counted again (MapMaker expands them on every edit anyway: expandSetPieces caches it). */
  private countParts(doc: MapDocument): void {
    for (const e of this.parts) this.tally.add(e, -1);
    this.parts = doc.setPieces?.length ? expandSetPieces(doc, this.library, this.catalog).map.entities.slice(doc.entities.length) : [];
    for (const e of this.parts) this.tally.add(e, 1);
  }
}
