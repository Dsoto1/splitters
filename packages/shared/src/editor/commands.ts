import type { ScenarioLogic } from '../map/logic.ts';
import type { BloodSettings, BotHint, EditorNote, Faction, GlassSettings, MapBotSet, MapPath, MapPhysics, MapBounds, MapDocument, MapEntity, MapGroup, SetPieceDefinition, SetPiecePlacement, TeamSetup, TilePlacement } from '../map/schema.ts';
import type { TerrainData } from '../map/terrain.ts';
import type { Backdrop } from '../map/backdrop.ts';
import type { MapWeather } from '../map/weather.ts';

/**
 * Editor mutations as invertible commands (v1 spec §8.9). Commands carry the
 * full before/after items, so inverting never needs to look at the document,
 * and a multi-object operation is a single `batch` = one undo step.
 */
export type EditCommand =
  | { kind: 'addTiles'; tiles: TilePlacement[] }
  | { kind: 'removeTiles'; tiles: TilePlacement[] }
  | { kind: 'updateTiles'; before: TilePlacement[]; after: TilePlacement[] }
  | { kind: 'addEntities'; entities: MapEntity[] }
  | { kind: 'removeEntities'; entities: MapEntity[] }
  | { kind: 'updateEntities'; before: MapEntity[]; after: MapEntity[] }
  | { kind: 'setMetadata'; before: Partial<MapDocument['metadata']>; after: Partial<MapDocument['metadata']> }
  | { kind: 'setTheme'; before: string; after: string }
  /** Scenario logic is edited as a whole block: it is small, and whole-block undo keeps rule edits exact. */
  | { kind: 'setLogic'; before: ScenarioLogic; after: ScenarioLogic }
  | { kind: 'setFactions'; before: Faction[]; after: Faction[] }
  /** Terrain is replaced whole: one brush stroke = one undo step. */
  | { kind: 'setTerrain'; before: TerrainData | null; after: TerrainData | null }
  | { kind: 'setBounds'; before: MapBounds | null; after: MapBounds | null }
  | { kind: 'setTeamSetup'; before: TeamSetup | null; after: TeamSetup | null }
  | { kind: 'setMapBots'; before: MapBotSet | null; after: MapBotSet | null }
  /** Which looks random bots wear (MapDocument.botCast); null or empty: every look (the document then has no `botCast` key). */
  | { kind: 'setBotCast'; before: string[] | null; after: string[] | null }
  /** The map's default weapon set (MapDocument.weaponSet); null: Standard (the document then has no `weaponSet` key). */
  | { kind: 'setWeaponSet'; before: string | null; after: string | null }
  | { kind: 'setBackdrop'; before: Backdrop | null; after: Backdrop | null }
  | { kind: 'setBlood'; before: BloodSettings | null; after: BloodSettings | null }
  | { kind: 'setPhysics'; before: MapPhysics | null; after: MapPhysics | null }
  /** Map-wide glass settings (null: defaults; the document then has no `glass` key). */
  | { kind: 'setGlass'; before: GlassSettings | null; after: GlassSettings | null }
  /** Paths are replaced as a list: one point placed, moved or deleted = one undo step. Null: none. */
  | { kind: 'setPaths'; before: MapPath[] | null; after: MapPath[] | null }
  /** Set-piece placements (v27; the document has no `setPieces` key once the last one goes). */
  | { kind: 'addSetPieces'; setPieces: SetPiecePlacement[] }
  | { kind: 'removeSetPieces'; setPieces: SetPiecePlacement[] }
  | { kind: 'updateSetPieces'; before: SetPiecePlacement[]; after: SetPiecePlacement[] }
  /** The map's own set-piece definitions, replaced as a list (null: none, and no `setPieceDefs` key). */
  | { kind: 'setSetPieceDefs'; before: SetPieceDefinition[] | null; after: SetPieceDefinition[] | null }
  /** MapMaker's groups (v31), replaced as a list (null or empty: none, and no `groups` key). */
  | { kind: 'setGroups'; before: MapGroup[] | null; after: MapGroup[] | null }
  /** Note pins (v31), replaced as a list: one added, edited, moved or deleted = one undo step (null or empty: none, and no `editorNotes` key). */
  | { kind: 'setNotes'; before: EditorNote[] | null; after: EditorNote[] | null }
  /** Bot hints (v33), replaced as a list: one added, edited, moved or deleted = one undo step (null or empty: none, and no `botHints` key). */
  | { kind: 'setBotHints'; before: BotHint[] | null; after: BotHint[] | null }
  /** The time of day (v34, hours 0-24; null: the sky's own look, and no `timeOfDay` key). */
  | { kind: 'setTimeOfDay'; before: number | null; after: number | null }
  /** Weather (v34; null: clear, and no `weather` key). */
  | { kind: 'setWeather'; before: MapWeather | null; after: MapWeather | null }
  | { kind: 'batch'; commands: EditCommand[] };

export class CommandError extends Error {}

function replaceById<T extends { id: string }>(list: readonly T[], items: readonly T[]): T[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  let found = 0;
  const out = list.map((x) => {
    const r = byId.get(x.id);
    if (r) found++;
    return r ?? x;
  });
  if (found !== items.length) throw new CommandError('update refers to a missing item');
  return out;
}

function removeById<T extends { id: string }>(list: readonly T[], items: readonly T[]): T[] {
  const ids = new Set(items.map((i) => i.id));
  const out = list.filter((x) => !ids.has(x.id));
  if (list.length - out.length !== ids.size) throw new CommandError('remove refers to a missing item');
  return out;
}

function addUnique<T extends { id: string }>(list: readonly T[], items: readonly T[]): T[] {
  const ids = new Set(list.map((x) => x.id));
  for (const i of items) if (ids.has(i.id)) throw new CommandError(`ID ${i.id} already exists`);
  return [...list, ...items];
}

/** Apply a command, returning a new document. The input document is never mutated. */
export function applyCommand(doc: MapDocument, cmd: EditCommand): MapDocument {
  const cs = doc.classicStructure;
  switch (cmd.kind) {
    case 'addTiles':
      return { ...doc, classicStructure: { ...cs, tiles: addUnique(cs.tiles, cmd.tiles) } };
    case 'removeTiles':
      return { ...doc, classicStructure: { ...cs, tiles: removeById(cs.tiles, cmd.tiles) } };
    case 'updateTiles':
      return { ...doc, classicStructure: { ...cs, tiles: replaceById(cs.tiles, cmd.after) } };
    case 'addEntities':
      return { ...doc, entities: addUnique(doc.entities, cmd.entities) };
    case 'removeEntities':
      return { ...doc, entities: removeById(doc.entities, cmd.entities) };
    case 'updateEntities':
      return { ...doc, entities: replaceById(doc.entities, cmd.after) };
    case 'setMetadata':
      return { ...doc, metadata: { ...doc.metadata, ...cmd.after } };
    case 'setTheme':
      return { ...doc, classicStructure: { ...cs, theme: cmd.after } };
    case 'setLogic':
      return { ...doc, logic: cmd.after };
    case 'setFactions':
      return { ...doc, factions: cmd.after };
    case 'setTerrain':
      return { ...doc, terrain: cmd.after };
    case 'setBounds':
      return { ...doc, bounds: cmd.after };
    case 'setTeamSetup':
      return { ...doc, teamSetup: cmd.after };
    case 'setBackdrop':
      return { ...doc, backdrop: cmd.after };
    case 'setBlood':
      return { ...doc, blood: cmd.after };
    case 'setPhysics':
      return { ...doc, physics: cmd.after };
    case 'setGlass': {
      const { glass: _old, ...rest } = doc;
      return cmd.after ? { ...rest, glass: cmd.after } : rest;
    }
    case 'setMapBots': {
      const { bots: _old, ...rest } = doc;
      return cmd.after ? { ...rest, bots: cmd.after } : rest;
    }
    case 'setBotCast': {
      const { botCast: _old, ...rest } = doc;
      return cmd.after?.length ? { ...rest, botCast: [...cmd.after] } : rest;
    }
    case 'setWeaponSet': {
      const { weaponSet: _old, ...rest } = doc;
      return cmd.after ? { ...rest, weaponSet: cmd.after } : rest;
    }
    case 'setPaths': {
      const { paths: _old, ...rest } = doc;
      return cmd.after?.length ? { ...rest, paths: cmd.after } : rest;
    }
    case 'addSetPieces':
      return withSetPieces(doc, addUnique(doc.setPieces ?? [], cmd.setPieces));
    case 'removeSetPieces':
      return withSetPieces(doc, removeById(doc.setPieces ?? [], cmd.setPieces));
    case 'updateSetPieces':
      return withSetPieces(doc, replaceById(doc.setPieces ?? [], cmd.after));
    case 'setSetPieceDefs': {
      const { setPieceDefs: _old, ...rest } = doc;
      return cmd.after?.length ? { ...rest, setPieceDefs: cmd.after } : rest;
    }
    case 'setGroups': {
      const { groups: _old, ...rest } = doc;
      return cmd.after?.length ? { ...rest, groups: cmd.after } : rest;
    }
    case 'setNotes': {
      const { editorNotes: _old, ...rest } = doc;
      return cmd.after?.length ? { ...rest, editorNotes: cmd.after } : rest;
    }
    case 'setTimeOfDay': {
      const { timeOfDay: _old, ...rest } = doc;
      return cmd.after === null ? rest : { ...rest, timeOfDay: cmd.after };
    }
    case 'setWeather': {
      const { weather: _old, ...rest } = doc;
      return cmd.after ? { ...rest, weather: { ...cmd.after } } : rest;
    }
    case 'setBotHints': {
      const { botHints: _old, ...rest } = doc;
      return cmd.after?.length ? { ...rest, botHints: cmd.after } : rest;
    }
    case 'batch':
      return cmd.commands.reduce(applyCommand, doc);
  }
}

/** The document with these placements (none: no `setPieces` key, so a map without set pieces saves as before). */
function withSetPieces(doc: MapDocument, list: SetPiecePlacement[]): MapDocument {
  const { setPieces: _old, ...rest } = doc;
  return list.length ? { ...rest, setPieces: list } : rest;
}

export function invertCommand(cmd: EditCommand): EditCommand {
  switch (cmd.kind) {
    case 'addTiles':
      return { kind: 'removeTiles', tiles: cmd.tiles };
    case 'removeTiles':
      return { kind: 'addTiles', tiles: cmd.tiles };
    case 'updateTiles':
      return { kind: 'updateTiles', before: cmd.after, after: cmd.before };
    case 'addEntities':
      return { kind: 'removeEntities', entities: cmd.entities };
    case 'removeEntities':
      return { kind: 'addEntities', entities: cmd.entities };
    case 'updateEntities':
      return { kind: 'updateEntities', before: cmd.after, after: cmd.before };
    case 'setMetadata':
      return { kind: 'setMetadata', before: cmd.after, after: cmd.before };
    case 'setTheme':
      return { kind: 'setTheme', before: cmd.after, after: cmd.before };
    case 'setLogic':
      return { kind: 'setLogic', before: cmd.after, after: cmd.before };
    case 'setFactions':
      return { kind: 'setFactions', before: cmd.after, after: cmd.before };
    case 'setTerrain':
      return { kind: 'setTerrain', before: cmd.after, after: cmd.before };
    case 'setBounds':
      return { kind: 'setBounds', before: cmd.after, after: cmd.before };
    case 'setTeamSetup':
      return { kind: 'setTeamSetup', before: cmd.after, after: cmd.before };
    case 'setBackdrop':
      return { kind: 'setBackdrop', before: cmd.after, after: cmd.before };
    case 'setBlood':
      return { kind: 'setBlood', before: cmd.after, after: cmd.before };
    case 'setPhysics':
      return { kind: 'setPhysics', before: cmd.after, after: cmd.before };
    case 'setGlass':
      return { kind: 'setGlass', before: cmd.after, after: cmd.before };
    case 'setMapBots':
      return { kind: 'setMapBots', before: cmd.after, after: cmd.before };
    case 'setPaths':
      return { kind: 'setPaths', before: cmd.after, after: cmd.before };
    case 'setBotCast':
      return { kind: 'setBotCast', before: cmd.after, after: cmd.before };
    case 'setWeaponSet':
      return { kind: 'setWeaponSet', before: cmd.after, after: cmd.before };
    case 'addSetPieces':
      return { kind: 'removeSetPieces', setPieces: cmd.setPieces };
    case 'removeSetPieces':
      return { kind: 'addSetPieces', setPieces: cmd.setPieces };
    case 'updateSetPieces':
      return { kind: 'updateSetPieces', before: cmd.after, after: cmd.before };
    case 'setSetPieceDefs':
      return { kind: 'setSetPieceDefs', before: cmd.after, after: cmd.before };
    case 'setGroups':
      return { kind: 'setGroups', before: cmd.after, after: cmd.before };
    case 'setNotes':
      return { kind: 'setNotes', before: cmd.after, after: cmd.before };
    case 'setBotHints':
      return { kind: 'setBotHints', before: cmd.after, after: cmd.before };
    case 'setTimeOfDay':
      return { kind: 'setTimeOfDay', before: cmd.after, after: cmd.before };
    case 'setWeather':
      return { kind: 'setWeather', before: cmd.after, after: cmd.before };
    case 'batch':
      return { kind: 'batch', commands: cmd.commands.map(invertCommand).reverse() };
  }
}

export function isEmptyCommand(cmd: EditCommand): boolean {
  switch (cmd.kind) {
    case 'addTiles':
    case 'removeTiles':
      return cmd.tiles.length === 0;
    case 'addEntities':
    case 'removeEntities':
      return cmd.entities.length === 0;
    case 'addSetPieces':
    case 'removeSetPieces':
      return cmd.setPieces.length === 0;
    case 'updateTiles':
    case 'updateEntities':
    case 'updateSetPieces':
      return cmd.after.length === 0;
    case 'setMetadata':
      return Object.keys(cmd.after).length === 0;
    case 'setTheme':
    case 'setTerrain':
      return cmd.before === cmd.after;
    case 'setLogic':
    case 'setFactions':
    case 'setBounds':
    case 'setTeamSetup':
    case 'setBackdrop':
    case 'setBlood':
    case 'setPhysics':
    case 'setGlass':
    case 'setMapBots':
    case 'setBotCast':
    case 'setWeaponSet':
    case 'setPaths':
    case 'setSetPieceDefs':
    case 'setGroups':
    case 'setNotes':
    case 'setBotHints':
    case 'setTimeOfDay':
    case 'setWeather':
      return JSON.stringify(cmd.before) === JSON.stringify(cmd.after);
    case 'batch':
      return cmd.commands.every(isEmptyCommand);
  }
}

interface HistoryEntry {
  label: string;
  command: EditCommand;
  /** Exact documents on either side. Documents are immutable and share structure, so this is cheap and makes undo restore item order exactly. */
  before: MapDocument;
  after: MapDocument;
}

/** What EditHistory tells its `onChange`: a command and the document it gave, or a document put in wholesale. */
export type HistoryChange = { command: EditCommand; doc: MapDocument; reset?: undefined } | { reset: MapDocument; command?: undefined };

/** Undo/redo history over an immutable MapDocument. */
export class EditHistory {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  /** Increments on every change, so views can cheaply detect staleness. */
  revision = 0;
  /**
   * Told of every change: the command applied and the document it gave (undo: the inverse of the step's command; a
   * stroke: each edit as it joins), or the document replaced (`reset`). MapMaker's budget bar counts from it.
   */
  onChange: ((change: HistoryChange) => void) | null = null;

  constructor(
    private current: MapDocument,
    private readonly limit = 500,
  ) {}

  get doc(): MapDocument {
    return this.current;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoLabel(): string | undefined {
    return this.undoStack[this.undoStack.length - 1]?.label;
  }

  get redoLabel(): string | undefined {
    return this.redoStack[this.redoStack.length - 1]?.label;
  }

  /** While a stroke is open (beginStroke … endStroke), its edits join one undo step. */
  private stroke: { open: boolean; entry: HistoryEntry | null } = { open: false, entry: null };

  /** Start a stroke: drag-painting, drag-erasing and the like undo in one step. */
  beginStroke(): void {
    this.stroke = { open: true, entry: null };
  }

  endStroke(): void {
    this.stroke = { open: false, entry: null };
  }

  /** Apply and record a command. Throws CommandError (leaving history untouched) if it does not apply. */
  execute(label: string, command: EditCommand): void {
    if (isEmptyCommand(command)) return;
    const before = this.current;
    const after = applyCommand(before, command);
    this.current = after;
    const top = this.undoStack[this.undoStack.length - 1];
    if (this.stroke.open && this.stroke.entry && top === this.stroke.entry) {
      top.command = { kind: 'batch', commands: [top.command, command] };
      top.after = after;
      this.redoStack = [];
      this.revision++;
      this.onChange?.({ command, doc: after });
      return;
    }
    const entry = { label, command, before, after };
    if (this.stroke.open) this.stroke.entry = entry;
    this.undoStack.push(entry);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    this.revision++;
    this.onChange?.({ command, doc: after });
  }

  undo(): string | undefined {
    this.endStroke();
    const entry = this.undoStack.pop();
    if (!entry) return undefined;
    this.current = entry.before;
    this.redoStack.push(entry);
    this.revision++;
    this.onChange?.({ command: invertCommand(entry.command), doc: entry.before });
    return entry.label;
  }

  redo(): string | undefined {
    this.endStroke();
    const entry = this.redoStack.pop();
    if (!entry) return undefined;
    this.current = entry.after;
    this.undoStack.push(entry);
    this.revision++;
    this.onChange?.({ command: entry.command, doc: entry.after });
    return entry.label;
  }

  /** Replace the document wholesale (open/new). Clears history. */
  reset(doc: MapDocument): void {
    this.current = doc;
    this.undoStack = [];
    this.redoStack = [];
    this.revision++;
    this.onChange?.({ reset: doc });
  }
}

let idRandom: () => number = Math.random;
/** Where new ids come from (the browser's test mode sets a seeded generator, so the same edits give the same ids). */
export function setIdRandom(rand: () => number): void {
  idRandom = rand;
}

/** Short random stable ID with a readable prefix, e.g. `tile_k3v9x2ma`. */
export function newId(prefix: string, rand: () => number = idRandom): string {
  let s = '';
  for (let i = 0; i < 10; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(rand() * 36)];
  return `${prefix}_${s}`;
}
