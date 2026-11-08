import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import {
  EditHistory,
  BOT_CAST_CHOICES,
  BOT_CAST_MAX,
  CHARACTER_GROUPS,
  botCastLabel,
  castLooks,
  validBotCast,
  mapWeaponSet,
  weaponSetList,
  getWeaponSet,
  terrainUnderFloors,
  withPathsLaid,
  addSpawnCommand,
  buildMapGeometry,
  checkPlacement,
  BUILD_LEVELS,
  buildZone,
  levelName,
  placeTileCommand,
  setUpperFloorsCommand,
  upperFloorLevels,
  upperFloorAt,
  isBareFloor,
  coreCatalog,
  deleteCommand,
  duplicateCommand,
  emptySelection,
  loadMap,
  moveCommand,
  moveEntitiesCommand,
  settlePropsCommand,
  replacePropsCommand,
  type ReplaceSize,
  settledPropY,
  newId,
  newMapDocument,
  normalizeYaw,
  paintCommand,
  resolveSurface,
  faceSlot,
  rotateCommand,
  yawStep,
  setThemeCommand,
  coreMaterials,
  coreThemes,
  CORE_ITEMS,
  WEAPON_CATEGORIES,
  WEAPON_CATEGORY_LABELS,
  categoryItems,
  isWeaponCategory,
  itemCategory,
  DESTRUCTIBLE_MODELS,
  DESTRUCTIBLE_SPECS,
  NPC_ROLES,
  NPC_ROLE_SPECS,
  rosterSize,
  SQUAD_ORDERS,
  ENCOUNTER_ENTRANCES,
  type EncounterEntrance,
  mapFactions,
  mapTeams,
  botSetLabel,
  mapBotSet,
  type MapBotSet,
  playableModes,
  setupFamily,
  mapPlayerCaps,
  autoPlayerCaps,
  isTeamMode,
  MODE_LABELS,
  SCENARIO_PALETTE,
  STYLE_PACKS,
  getStylePack,
  stylePackHas,
  type StylePack,
  DOOR_STYLES,
  DOOR_STYLE_LABELS,
  LADDER_STYLES,
  LADDER_STYLE_LABELS,
  type LadderStyle,
  type DoorStyle,
  TRAP_ACTIVATIONS,
  TRAP_KINDS,
  TRAP_SPECS,
  entityLabel,
  BREAKTHROUGH_MAX_SECTORS,
  BREAKTHROUGH_OBJECTIVES,
  BREAKTHROUGH_OBJECTIVE_LABELS,
  sectorOrders,
  type ObjectiveEntity,
  newScenarioEntities,
  MOVER_MODES,
  type MoverMode,
  snapToDoorway,
  snapsToDoorway,
  getItem,
  SURFACE_SLOTS,
  SURFACE_SLOT_LABELS,
  TINT_SWATCHES,
  tileAt,
  updateTileCommand,
  validateMap,
  coplanarIssues,
  coplanarSpots,
  type CoplanarSpot,
  type EditCommand,
  type MapDocument,
  type TilePlacement,
  type MapEntity,
  type ScenarioPaletteKey,
  type PaintScope,
  type SurfaceSlot,
  type SurfaceStyle,
  type WorldBox,
  type Rotation,
  type Selection,
  type TileDefinition,
  type ValidationIssue,
  type Vec3,
  EDGE_STYLES,
  EDGE_STYLE_LABELS,
  CEILINGS,
  CEILING_LABELS,
  CORNERS,
  CORNER_LABELS,
  FACADES,
  FACADE_LABELS,
  FLOOR_INSERTS,
  FLOOR_INSERT_LABELS,
  ROOM_LAYOUTS,
  ROOM_LAYOUT_LABELS,
  type RoomOptions,
  DRESS_DENSITIES,
  ROOM_TYPES,
  ROOM_TYPE_LABELS,
  buildOccupancy,
  dressRoom,
  dressSpace,
  guessRoomType,
  modelBudget,
  roomCells,
  seededRandom,
  type DressDensity,
  type RoomType,
  SIDES,
  TILE_CATEGORIES,
  edgeChoiceAt,
  edgeSegments,
  edgeTargetAt,
  setEdgeCommand,
  setEdgeGlassCommand,
  applyCommand,
  edgeGlassAt,
  GLASS_EDGES,
  GLASS_KINDS,
  GLASS_KIND_LABELS,
  type GlassKind,
  type EdgeStyle,
  type EdgeTarget,
  CORE_PROPS,
  type PropDefinition,
  PROP_CATEGORIES,
  getProp,
  placementCells,
  TERRAIN_BRUSHES,
  BLOCK_BEHAVIOURS,
  LIQUIDS,
  LIQUID_SPECS,
  SCATTER_SETS,
  ENV_SPECIES,
  getEnvSpecies,
  SCATTER_SET_IDS,
  scatterProps,
  type ScatterSetId,
  BACKDROP_GROUNDS,
  SCENERY_IDS,
  SCENERY_LABELS,
  SKIES,
  SKY_IDS,
  resolveBackdrop,
  BORDER_LABELS,
  BORDER_SIDES,
  BORDER_STYLES,
  ELECTRIC_FENCE,
  borderRect,
  hasBorder,
  type BorderStyle,
  type Backdrop,
  BLOOD_AMOUNTS,
  DEFAULT_BLOOD,
  type BloodSettings,
  type MapPhysics,
  type BackdropGround,
  type SceneryId,
  type SkyId,
  FOLIAGE_LEVELS,
  TERRAIN_MATERIALS,
  TERRAIN_MATERIAL_LABELS,
  TERRAIN_SURFACES,
  terrainMaterialFor,
  applyBrush,
  initPhysics,
  mapPads,
  padLandings,
  fitBounds,
  CORE_WEAPONS,
  MOUNT_DEFS,
  MOUNT_MODELS,
  type MountModel,
  MOUNT_SKINS,
  FLOAT,
  MOUNT_SKIN_LABELS,
  type MountSkin,
  AIRDROP_MODES,
  AIR_CRAFTS,
  AIR_CRAFT_LABELS,
  type AirCraft,
  type AirdropMode,
  MAX_TEAMS,
  PLAYER,
  TEAM_PRESETS,
  teamLayoutLabel,
  type BoundaryStyle,
  newTerrain,
  terrainSpacingFor,
  paintSlopes,
  blockBox,
  boxFootprint,
  smoothTerrain,
  terrainHoldMask,
  terrainHeightAt,
  terrainRaycast,
  type TerrainBrush,
  type TerrainData,
  type TerrainMaterial,
  NPC_PALETTE,
  placeNpcCommand,
  type LightFixture,
  isRetiredMap,
  moverGroupOf,
  withMoverGroups,
  addSetPieceDefCommand,
  builtInSetPieces,
  checkSetPieceDefinition,
  checkSetPiecePlacement,
  envModelFile,
  expandSetPieces,
  explodeSetPieceCommand,
  mirrorSetPieceCommand,
  piecesFor,
  placeSetPieceCommand,
  placementPack,
  setPieceFootprint,
  setPieceFromSelection,
  setPieceMirrorRefusal,
  setPieceParts,
  setPiecePortStates,
  updateSetPieceCommand,
  SET_PIECE_MATERIAL_ROLES,
  type SetPieceDefinition,
  type SetPieceLibrary,
  type SetPiecePlacement,
  type SetPieceRole,
  type SetPieceExpansion,
  propDrop,
  ringStep,
  setFacingCommand,
  snapMeasurePoint,
  turnByCommand,
  turnLabel,
  type MeasurePoint,
  surfaceHit,
} from '@tiletrigger/shared';
import { MAP_INDEX, isBuiltInMap, loadBuiltInMap } from '../mapIndex.ts';

/** IDs of the built-in maps (they have automatic pictures): the files in maps/, which load on demand (mapIndex.ts). */
const SHIPPED_IDS = { has: isBuiltInMap };
import { EditorView, type PieceOutline, type TraceImage } from './editorView.ts';
import { LIQUID_LOOKS } from '../game/scenarioVisuals.ts';
import {
  clearDraft,
  deleteFromLibrary,
  deleteSetPiece,
  exportMap,
  exportSetPiece,
  importMapFile,
  importSetPieceFile,
  inLibrary,
  listDrafts,
  listLibrary,
  listSetPieces,
  openFromLibrary,
  saveSetPiece,
  saveToLibrary,
  writeDraft,
} from './storage.ts';
import { tileIcon } from './tileIcon.ts';
import { raycastBoxes, type BoxHit } from './raycast.ts';
import { MeasureTool } from './measureTool.ts';
import { RotateRing } from './rotateRing.ts';
import { quickFacings } from './quickFacings.ts';
import { PropPlaceOptions } from './propPlaceOptions.ts';
import { SurfaceBoxes } from './surfaceBoxes.ts';
import { testMode } from '../testMode.ts';
import { materialThumbnail } from '../materials/patterns.ts';
import { itemColor } from '../game/pickupVisuals.ts';
import { LogicPanel } from './logicPanel.ts';
import { PathTool, pathLabel, type PathKind } from './pathTool.ts';
import { RouteTool } from './routeTool.ts';
import { ModelThumbnails } from '../frontend/modelThumbs.ts';
import { Palette } from './palette.ts';
import { PaletteAtlas } from './paletteAtlas.ts';
import {
  GROUND_COVER_IDS,
  GROUND_COVER_SPECIES,
  NATURE_PROP_CATEGORIES,
  PROP_GROUPS,
  REPLACEMENTS,
  RETIRED_PROPS,
  propGroup,
  scenarioGroup,
  setPieceFamilyLabel,
  setPieceFamilyOrder,
  setPieceSuitsStylePack,
  stylePackRoles,
} from './paletteCatalog.ts';
import { envRendererOn } from '../environment/envFlag.ts';
import { thumbnailSection, type ThumbHost } from './makerThumb.ts';
import { libraryThumb } from './libraryThumbs.ts';
import { isOwner, openPublishDialog } from './ownerPublish.ts';
import { DEFAULT_HEIGHT_GRID_SMOOTHING, HEIGHT_GRID_SMOOTHING, MAX_HEIGHT_GRID_BYTES, parseAsciiGrid, terrainFromHeightGrid } from './heightGrid.ts';
import { publishedMaps } from '../publishedMaps.ts';
import { botManager } from '../frontend/botManager.ts';
import { BOT_SET_PRESETS } from '../playlists.ts';

/** Small palette icon for a pickup item, coloured by item type. */
function itemIcon(itemId: string): string {
  const c = itemColor(itemId);
  return `<svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="15" fill="${c}" fill-opacity=".25" stroke="${c}" stroke-width="3"/><circle cx="28" cy="28" r="6" fill="${c}"/></svg>`;
}

export interface TestRequest {
  map: MapDocument;
  botFill: number;
  difficulty: 'easy' | 'normal' | 'hard';
}

export interface EditorHost {
  engine: AbstractEngine;
  canvas: HTMLCanvasElement;
  startTest(req: TestRequest): void;
  goHome(): void;
}

/** A new map starts on open ground this size (m); New offers the others, and the sky (0: no terrain). */
const STARTER_TERRAIN = 160;
const NEW_MAP_SIZES: readonly [number, string, string][] = [
  [96, 'Skirmish', '96 m · a few players'],
  [160, 'Medium', '160 m · most modes'],
  [240, 'Large', '240 m · vehicles'],
  [320, 'Huge', '320 m · big battles'],
  [0, 'Sky map', 'No terrain · floating'],
];

/** The material most of the terrain is (its index in TERRAIN_MATERIALS). */
function mainGround(t: TerrainData): number {
  const counts = new Map<number, number>();
  for (const m of t.materials) counts.set(m, (counts.get(m) ?? 0) + 1);
  let best = 0;
  let most = -1;
  for (const [m, n] of counts) if (n > most) (best = m), (most = n);
  return best;
}

/** The top bar's compact layouts (editor.css, fit-1..4): the fewest that make its contents fit its width. */
function fitTopBar(top: HTMLElement): void {
  if (top.offsetParent === null) return;
  const levels = ['fit-1', 'fit-2', 'fit-3', 'fit-4'];
  top.classList.remove(...levels);
  for (const c of levels) {
    if (top.scrollWidth <= top.clientWidth + 1) break;
    top.classList.add(c);
  }
}

/** A blank map: the starter room and spawn, on open ground of `size` metres (just under the floors) or none. */
function starterMap(size: number | null, ground: TerrainMaterial): MapDocument {
  const doc = newMapDocument('Untitled Map');
  return size ? { ...doc, terrain: { ...newTerrain(size, 2, [0, 0], ground), baseY: -0.15 } } : doc;
}

type Tool = { kind: 'select' } | { kind: 'erase' } | { kind: 'npc'; key: string } | { kind: 'tile'; tile: string } | { kind: 'setpiece'; piece: string } | { kind: 'spawn' } | { kind: 'pickup'; item: string } | { kind: 'scenario'; key: ScenarioPaletteKey } | { kind: 'paint' } | { kind: 'edge'; style: EdgeStyle } | { kind: 'prop'; model: string } | { kind: 'terrain' } | { kind: 'mount'; model: MountModel } | { kind: 'scatter'; set: ScatterSetId } | { kind: 'path' } | { kind: 'route' } | { kind: 'measure' };

/** What the pointer can pick: a tile, an entity, or a set piece (any of its parts picks the whole placement). */
type Hit = { kind: 'tile' | 'entity' | 'setpiece'; id: string };

/** The kinds of entity a set piece is made of (setPieceFromSelection takes these). */
const PIECE_PART_KINDS: ReadonlySet<string> = new Set(['block', 'prop', 'door', 'ladder', 'light']);

/** A set piece's role, in the inspector's overrides. */
const ROLE_LABELS: Record<SetPieceRole, string> = { stone: 'Stone', trim: 'Trim', floor: 'Floor', paving: 'Paving', roof: 'Roof', wood: 'Wood', metal: 'Metal', facade: 'Facade', door: 'Doors', glass: 'Glass' };

/** The roles a piece's parts take from its look (the inspector offers an override for each). */
function rolesUsed(def: SetPieceDefinition): SetPieceRole[] {
  const used = new Set<SetPieceRole>();
  const ref = (v: unknown) => {
    if (v && typeof v === 'object' && 'role' in v) used.add((v as { role: SetPieceRole }).role);
  };
  for (const part of def.parts) {
    if (part.kind === 'tile') {
      for (const s of Object.values(part.surfaces ?? {})) ref(s);
      for (const g of Object.values(part.glass ?? {})) ref(g);
      ref(part.options?.facade);
    } else if (part.kind === 'block') {
      ref(part.material);
      ref(part.glass);
    } else if (part.kind === 'door') ref(part.style);
  }
  const order: readonly SetPieceRole[] = [...SET_PIECE_MATERIAL_ROLES, 'facade', 'door', 'glass'];
  return order.filter((r) => used.has(r));
}

/** Palette icons for scenario objects (simple SVG glyphs). */
const SCENARIO_ICONS: Record<ScenarioPaletteKey, string> = {
  'encounter:vent': '<rect x="6" y="6" width="44" height="6" fill="#3a3f48"/><rect x="16" y="12" width="24" height="4" fill="#07080a"/><path d="M16 16l-4 14M22 16l-4 14M28 16l-4 14" stroke="#8a929c" stroke-width="2"/><circle cx="34" cy="34" r="5" fill="#d04a3a"/><rect x="30" y="39" width="8" height="12" rx="2" fill="#d04a3a"/>',
  'encounter:hatch': '<rect x="10" y="38" width="36" height="6" fill="#5d646d"/><rect x="16" y="38" width="24" height="4" fill="#07080a"/><path d="M16 38L10 14" stroke="#5d646d" stroke-width="5"/><circle cx="28" cy="26" r="5" fill="#d04a3a"/><rect x="24" y="31" width="8" height="9" rx="2" fill="#d04a3a"/>',
  'encounter:burrow': '<ellipse cx="28" cy="42" rx="20" ry="6" fill="#5a4330"/><ellipse cx="28" cy="42" rx="12" ry="3.5" fill="#120c08"/><circle cx="12" cy="38" r="4" fill="#6e5440"/><circle cx="45" cy="37" r="5" fill="#6e5440"/><path d="M22 36q6-16 12 0" fill="#7a3fb0"/><circle cx="25" cy="30" r="1.6" fill="#fff"/><circle cx="31" cy="30" r="1.6" fill="#fff"/>',
  'encounter:breach': '<rect x="6" y="6" width="44" height="40" fill="#9a958c"/><path d="M18 46V22l5-6 6 3 6-4 4 8v23z" fill="#07080a"/><rect x="10" y="44" width="7" height="5" fill="#b0aaa0"/><rect x="38" y="45" width="9" height="4" fill="#b0aaa0"/><rect x="24" y="47" width="6" height="4" fill="#b0aaa0"/>',
  'light:ceiling': '<rect x="10" y="8" width="36" height="6" fill="#c9ccd2"/><rect x="14" y="14" width="28" height="4" fill="#fff1c4"/><path d="M16 22l-6 18M28 22v22M40 22l6 18" stroke="#ffe08a" stroke-width="2" stroke-opacity=".7"/>',
  'light:wall': '<rect x="8" y="8" width="5" height="40" fill="#6f7884"/><path d="M13 22h10l6 8H13z" fill="#fff1c4"/><path d="M30 26l14-8M31 32l15 2M30 38l13 9" stroke="#ffe08a" stroke-width="2" stroke-opacity=".7"/>',
  'light:bulb': '<path d="M28 6v12" stroke="#3a3f48" stroke-width="2"/><circle cx="28" cy="26" r="8" fill="#fff1c4"/><path d="M14 34l-4 6M28 38v8M42 34l4 6" stroke="#ffe08a" stroke-width="2" stroke-opacity=".7"/>',
  'light:strip': '<rect x="6" y="10" width="44" height="5" rx="2" fill="#e8f4ff"/><path d="M10 20l-3 16M20 20l-1 20M36 20l1 20M46 20l3 16" stroke="#bfe6f5" stroke-width="2" stroke-opacity=".7"/>',
  'light:none': '<circle cx="28" cy="28" r="18" fill="#ffe08a" fill-opacity=".25"/><circle cx="28" cy="28" r="8" fill="#ffe08a" fill-opacity=".6"/>',
  glass: '<rect x="8" y="14" width="40" height="26" fill="#bfe6f5" fill-opacity="0.55" stroke="#9fb6d8" stroke-width="2"/><path d="M14 18l8 8M30 18l10 14" stroke="#ffffff" stroke-width="1.5"/>',
  boards: '<rect x="10" y="8" width="36" height="42" fill="none" stroke="#5a4030" stroke-width="2"/><rect x="8" y="14" width="40" height="7" fill="#9a6b3d" transform="rotate(-6 28 17)"/><rect x="8" y="27" width="40" height="7" fill="#8a5d33" transform="rotate(5 28 30)"/><rect x="8" y="40" width="40" height="7" fill="#9a6b3d" transform="rotate(-4 28 43)"/>',
  gas: '<rect x="20" y="14" width="16" height="34" rx="7" fill="#d8d8d0"/><rect x="25" y="8" width="6" height="7" fill="#5a6066"/><rect x="20" y="26" width="16" height="5" fill="#d8483a"/>',
  generator: '<rect x="8" y="20" width="40" height="26" rx="2" fill="#5a6066"/><rect x="12" y="24" width="14" height="10" fill="#e3b021"/><circle cx="37" cy="33" r="6" fill="#3a3f48"/><rect x="14" y="12" width="6" height="8" fill="#5a6066"/>',
  door: '<rect x="12" y="10" width="15" height="38" fill="#6f7884"/><rect x="29" y="10" width="15" height="38" fill="#6f7884"/><rect x="12" y="28" width="32" height="4" fill="#e3b021"/><circle cx="28" cy="6" r="3" fill="#3fd26b"/>',
  door_locked: '<rect x="12" y="10" width="15" height="38" fill="#6f7884"/><rect x="29" y="10" width="15" height="38" fill="#6f7884"/><rect x="12" y="28" width="32" height="4" fill="#e3b021"/><circle cx="28" cy="6" r="3" fill="#e0412f"/><rect x="23" y="34" width="10" height="9" rx="1" fill="#e0412f"/><path d="M25 34v-3a3 3 0 0 1 6 0v3" stroke="#e0412f" stroke-width="2" fill="none"/>',
  flag: '<ellipse cx="28" cy="48" rx="16" ry="5" fill="#2a2f3a" stroke="#e2703a" stroke-width="2"/><rect x="18" y="8" width="3" height="40" fill="#c9ccd2"/><path d="M21 10h22l-5 8 5 8H21z" fill="#e2703a"/>',
  hostage: '<circle cx="28" cy="16" r="7" fill="#e8d8a0"/><path d="M18 46V30q0-6 10-6t10 6v16" fill="#e8d8a0"/><path d="M14 34h28" stroke="#3ddc84" stroke-width="3"/>',
  rescue: '<ellipse cx="28" cy="40" rx="22" ry="9" fill="#3ddc84" fill-opacity=".25" stroke="#3ddc84" stroke-width="2"/><path d="M20 30l8-12 8 12M28 18v18" stroke="#3ddc84" stroke-width="3" fill="none"/>',
  bombsite: '<ellipse cx="28" cy="40" rx="22" ry="9" fill="#ff7a2a" fill-opacity=".25" stroke="#ff7a2a" stroke-width="2"/><text x="28" y="32" font-size="26" font-weight="bold" text-anchor="middle" fill="#ff7a2a">A</text>',
  sector: '<path d="M4 34h48" stroke="#ffd24a" stroke-width="3" stroke-dasharray="6 4"/><path d="M18 26l10-12 10 12M18 18l10-12 10 12" stroke="#ffd24a" stroke-width="3" fill="none"/><text x="28" y="52" font-size="14" font-weight="bold" text-anchor="middle" fill="#ffd24a">1 · 2 · 3</text>',
  'objective:zone': '<ellipse cx="28" cy="40" rx="22" ry="9" fill="#f2c14e" fill-opacity=".25" stroke="#f2c14e" stroke-width="2"/><path d="M28 34V8" stroke="#c9ccd2" stroke-width="2"/><path d="M28 9h16l-4 6 4 6H28z" fill="#f2c14e"/><text x="14" y="30" font-size="13" font-weight="bold" fill="#f2c14e">A1</text>',
  'objective:target': '<ellipse cx="28" cy="42" rx="20" ry="7" fill="#ff5a3a" fill-opacity=".25" stroke="#ff5a3a" stroke-width="2"/><rect x="25" y="14" width="6" height="26" fill="#d8b41a"/><path d="M25 20h6M25 28h6M25 36h6" stroke="#1e1e1e" stroke-width="3"/><circle cx="28" cy="11" r="4" fill="#ff5a3a"/><path d="M38 12l8-6M40 18l9 0" stroke="#ff5a3a" stroke-width="2"/>',
  'objective:final': '<ellipse cx="28" cy="40" rx="22" ry="9" fill="#c38bff" fill-opacity=".25" stroke="#c38bff" stroke-width="2"/><path d="M14 36V22l14-12 14 12v14z" fill="#c38bff" fill-opacity=".6"/><rect x="24" y="26" width="8" height="10" fill="#2a2140"/>',
  'spawn:attack': '<circle cx="28" cy="18" r="7" fill="#ff8a3a"/><path d="M16 46V32q0-6 12-6t12 6v14" fill="#ff8a3a"/><path d="M40 20l10-6v12z" fill="#ff8a3a"/>',
  'spawn:defend': '<circle cx="28" cy="18" r="7" fill="#5ab0ff"/><path d="M16 46V32q0-6 12-6t12 6v14" fill="#5ab0ff"/><path d="M42 12l8 3v6q0 6-8 9-8-3-8-9v-6z" fill="#5ab0ff"/>',
  hill: '<ellipse cx="28" cy="38" rx="22" ry="9" fill="#f2f2f2" fill-opacity=".2" stroke="#f2f2f2" stroke-width="2"/><path d="M14 38V26M42 38V26M28 47V35M28 29V17" stroke="#f2f2f2" stroke-width="2"/><path d="M22 14l6-8 6 8z" fill="#f2c14e"/>',
  zipline: '<rect x="7" y="14" width="4" height="38" fill="#7a5532"/><rect x="45" y="30" width="4" height="22" fill="#7a5532"/><path d="M9 16Q28 30 47 32" stroke="#c9ccd0" stroke-width="2" fill="none"/><rect x="24" y="20" width="8" height="5" fill="#3a3f46"/><path d="M28 25v6M23 31h10" stroke="#3a3f46" stroke-width="2.5"/>',
  ladder: '<rect x="17" y="6" width="4" height="44" fill="#9a6b3d"/><rect x="35" y="6" width="4" height="44" fill="#9a6b3d"/><path d="M19 12h18M19 20h18M19 28h18M19 36h18M19 44h18" stroke="#c79a5e" stroke-width="3"/>',
  pad: '<ellipse cx="28" cy="42" rx="20" ry="7" fill="#2a2f3a"/><ellipse cx="28" cy="41" rx="15" ry="5" fill="#36d6ff"/><path d="M20 30l8-10 8 10M20 22l8-10 8 10" stroke="#36d6ff" stroke-width="3" fill="none"/>',
  button: '<rect x="24" y="24" width="8" height="26" fill="#3a3f48"/><rect x="17" y="12" width="22" height="16" rx="2" fill="#c9ccd2"/><circle cx="28" cy="20" r="5" fill="#3fd26b"/>',
  crate: '<rect x="12" y="14" width="32" height="32" fill="#9a6b3d"/><path d="M12 14L44 46M12 18h32M12 42h32" stroke="#6e4a28" stroke-width="3"/>',
  barrel: '<rect x="16" y="10" width="24" height="38" rx="5" fill="#c23b2a"/><rect x="16" y="16" width="24" height="4" fill="#f2c14e"/><rect x="16" y="38" width="24" height="4" fill="#f2c14e"/>',
  wall: '<rect x="8" y="10" width="40" height="38" fill="#9b9a94"/><path d="M18 14l6 12-4 8 8 10M36 18l-5 9 6 7" stroke="#44433f" stroke-width="2" fill="none"/>',
  zone: '<rect x="10" y="12" width="36" height="34" fill="#36d6ff" fill-opacity=".18" stroke="#36d6ff" stroke-width="2" stroke-dasharray="4 3"/>',
  'trap:spikes': '<rect x="8" y="42" width="40" height="5" fill="#3d4249"/><path d="M11 42l4-16 4 16M21 42l4-16 4 16M31 42l4-16 4 16M41 42l3-12 3 12" fill="#b9bec6"/>',
  'trap:flames': '<rect x="6" y="24" width="10" height="12" fill="#3a3f48"/><path d="M16 30c8-10 18-8 32-4-12 2-16 8-32 4z" fill="#ff8a2a"/><path d="M16 30c6-5 12-4 22-2-8 1-12 4-22 2z" fill="#ffe08a"/>',
  'trap:crusher': '<rect x="10" y="8" width="36" height="12" fill="#5e636b"/><rect x="8" y="6" width="3" height="42" fill="#4b525c"/><rect x="45" y="6" width="3" height="42" fill="#4b525c"/><path d="M28 24v12m-5-5l5 5 5-5" stroke="#e3b021" stroke-width="3" fill="none"/><rect x="10" y="46" width="36" height="3" fill="#e3b021"/>',
  'trap:mine': '<ellipse cx="28" cy="38" rx="14" ry="5" fill="#3b4033"/><circle cx="28" cy="34" r="3" fill="#ff2a2a"/>',
  encounter: '<ellipse cx="28" cy="44" rx="20" ry="6" fill="#d04a3a" fill-opacity=".25" stroke="#d04a3a" stroke-width="2"/><rect x="26" y="6" width="2.5" height="36" fill="#3a3f48"/><rect x="28.5" y="6" width="12" height="8" fill="#d04a3a"/><circle cx="17" cy="30" r="5" fill="#d04a3a"/><rect x="13" y="34" width="8" height="10" rx="3" fill="#d04a3a"/><circle cx="38" cy="30" r="5" fill="#d04a3a"/><rect x="34" y="34" width="8" height="10" rx="3" fill="#d04a3a"/>',
  'trap:laser': '<rect x="8" y="10" width="4" height="38" fill="#2a2d33"/><rect x="44" y="10" width="4" height="38" fill="#2a2d33"/><path d="M12 18h32M12 26h32M12 34h32M12 42h32" stroke="#ff2040" stroke-width="2"/>',
  'trap:shock': '<path d="M4 48h48" stroke="#5a5f55" stroke-width="2"/><rect x="7" y="12" width="4" height="36" fill="#3d4440"/><rect x="26" y="12" width="4" height="36" fill="#3d4440"/><rect x="45" y="12" width="4" height="36" fill="#3d4440"/><path d="M11 18h34M11 26h34M11 34h34M11 42h34" stroke="#ffe25a" stroke-width="1.6"/><path d="M33 4l-6 9h5l-4 8 9-11h-5l4-6z" fill="#ffe25a"/><rect x="12" y="28" width="10" height="7" fill="#f2c200"/>',
  'block:solid': '<path d="M8 26l20-10 20 10-20 10z" fill="#c9ccd2"/><path d="M8 26v6l20 10v-6z" fill="#8a8f98"/><path d="M48 26v6L28 42v-6z" fill="#6c7076"/><path d="M14 12q4-4 8 0M34 8q4-4 8 0" stroke="#7fd8ff" stroke-width="2" fill="none"/>',
  'block:crumble': '<path d="M8 22l20-10 20 10-20 10z" fill="#c9a36b"/><path d="M8 22v6l20 10v-6z" fill="#8a6a3f"/><path d="M48 22v6L28 38v-6z" fill="#6e5230"/><path d="M18 20l6 4-3 5M34 16l-4 6 5 3" stroke="#ffb03b" stroke-width="2" fill="none"/><rect x="14" y="44" width="5" height="5" fill="#8a6a3f"/><rect x="30" y="47" width="4" height="4" fill="#8a6a3f"/>',
  'block:trapdoor': '<rect x="6" y="20" width="44" height="6" fill="#6c7076"/><path d="M14 26l2 22h6l-2-22z" fill="#9a6b3d"/><rect x="22" y="20" width="20" height="6" fill="#1c1f26"/><path d="M28 32v10m-5-5l5 5 5-5" stroke="#ff5a4f" stroke-width="3" fill="none"/>',
  'block:breakable': '<path d="M8 26l20-10 20 10-20 10z" fill="#b9bec6"/><path d="M8 26v6l20 10v-6z" fill="#7c828a"/><path d="M48 26v6L28 42v-6z" fill="#5e636b"/><path d="M20 22l8 3 6-5M28 25v8" stroke="#2a2d33" stroke-width="2" fill="none"/>',
  'water:water': '<rect x="6" y="24" width="44" height="22" fill="#3f8fb0" fill-opacity=".8"/><path d="M6 24q5-4 11 0t11 0 11 0 11 0" stroke="#bfe6f5" stroke-width="2" fill="none"/>',
  'water:lava': '<rect x="6" y="24" width="44" height="22" fill="#ff5a1a"/><path d="M6 24q5-4 11 0t11 0 11 0 11 0" stroke="#ffd34d" stroke-width="2" fill="none"/><circle cx="20" cy="34" r="3" fill="#ffd34d"/>',
  'water:acid': '<rect x="6" y="24" width="44" height="22" fill="#8aff3a" fill-opacity=".85"/><circle cx="18" cy="32" r="3" fill="#d8ffb0"/><circle cx="34" cy="38" r="2" fill="#d8ffb0"/><path d="M6 24q5-4 11 0t11 0 11 0 11 0" stroke="#d8ffb0" stroke-width="2" fill="none"/>',
  airplane: '<path d="M28 6l4 10v8l16 8v4l-16-4v10l5 4v3l-9-2-9 2v-3l5-4V32L8 36v-4l16-8v-8z" fill="#e2703a"/><path d="M10 50h36" stroke="#e2703a" stroke-width="2" stroke-dasharray="4 3"/>',
  'airplane:dropship': '<path d="M14 22h28l8 8-8 8H14l-6-8z" fill="#5a6b7a"/><rect x="18" y="26" width="16" height="8" fill="#9fb3c4"/><path d="M24 22l-6-10h6l6 10M24 38l-6 10h6l6-10" fill="#7a8a98"/><path d="M4 52h48" stroke="#e2703a" stroke-width="2" stroke-dasharray="4 3"/>',
  'mover:lift': '<rect x="14" y="8" width="4" height="40" fill="#5a5f68"/><rect x="38" y="8" width="4" height="40" fill="#5a5f68"/><rect x="16" y="30" width="24" height="5" fill="#2ec4b6"/><path d="M28 12v12M23 17l5-5 5 5" stroke="#2ec4b6" stroke-width="2.5" fill="none"/>',
  'mover:slider': '<rect x="10" y="12" width="20" height="32" fill="#8a8f98"/><path d="M34 28h14M43 23l5 5-5 5" stroke="#2ec4b6" stroke-width="2.5" fill="none"/>',
  'mover:drawbridge': '<rect x="6" y="40" width="10" height="10" fill="#5a5f68"/><path d="M16 42L44 18" stroke="#8a6a42" stroke-width="5"/><path d="M40 44a20 20 0 0 0-6-18" stroke="#2ec4b6" stroke-width="2" fill="none"/>',
  'door:blast': '<rect x="6" y="6" width="44" height="44" fill="#3a3f45"/><rect x="10" y="10" width="17" height="40" fill="#4c535b"/><rect x="29" y="10" width="17" height="40" fill="#4c535b"/><path d="M10 14h36v6H10zM10 40h36v6H10z" fill="#e3b021"/><path d="M14 14l4 6M22 14l4 6M30 14l4 6M38 14l4 6M14 40l4 6M22 40l4 6M30 40l4 6M38 40l4 6" stroke="#2a2d33" stroke-width="2"/>',
  'door:saloon': '<rect x="8" y="16" width="19" height="22" fill="#8a5a32"/><rect x="29" y="16" width="19" height="22" fill="#8a5a32"/><path d="M11 21h13M11 26h13M11 31h13M32 21h13M32 26h13M32 31h13" stroke="#5e3c20" stroke-width="2"/><path d="M8 50V8M48 50V8" stroke="#5e3c20" stroke-width="3"/>',
  'door:vault': '<rect x="6" y="6" width="44" height="44" fill="#41464c"/><circle cx="28" cy="28" r="19" fill="#8c939b"/><circle cx="28" cy="28" r="11" fill="#41464c"/><path d="M17 28h22M28 17v22M20 20l16 16M36 20L20 36" stroke="#b08d3a" stroke-width="2.5"/>',
  'light:alarm': '<rect x="18" y="38" width="20" height="8" fill="#3a3f48"/><path d="M20 38v-12a8 8 0 0 1 16 0v12z" fill="#ff3020"/><path d="M10 18l6 4M46 18l-6 4M28 8v6" stroke="#ff7a5a" stroke-width="3"/>',
  'block:barrier': '<path d="M6 44h44l-6-18H12z" fill="#9c9a94"/><path d="M12 26h32" stroke="#7c7a74" stroke-width="2"/><path d="M20 34l6 4 4-6M34 30l-3 6" stroke="#2a2d33" stroke-width="2" fill="none"/>',
  'block:planks': '<rect x="8" y="8" width="40" height="40" fill="#b49467"/><path d="M8 18h40M8 28h40M8 38h40" stroke="#7a5a3a" stroke-width="2"/><path d="M22 20l6 6-4 6 6 6" stroke="#2a2d33" stroke-width="2" fill="none"/>',
  'mover:minecart': '<path d="M6 48h44" stroke="#5a5f68" stroke-width="2"/><path d="M12 22h32l-4 18H16z" fill="#7a4a2e"/><circle cx="20" cy="42" r="4" fill="#3c3a38"/><circle cx="36" cy="42" r="4" fill="#3c3a38"/><path d="M16 20q6-6 10 0t10 0" fill="#6e6258"/><path d="M44 12h8M48 8l4 4-4 4" stroke="#2ec4b6" stroke-width="2.5" fill="none"/>',
  'mover:train': '<path d="M4 48h48" stroke="#5a5f68" stroke-width="2"/><rect x="26" y="18" width="16" height="22" fill="#b3261e"/><rect x="8" y="26" width="20" height="14" fill="#3a3a3a"/><rect x="12" y="16" width="5" height="10" fill="#3a3a3a"/><path d="M8 40l-4 6h8z" fill="#3a3a3a"/><circle cx="16" cy="43" r="4" fill="#2a2a2a"/><circle cx="34" cy="43" r="4" fill="#2a2a2a"/><path d="M14 12q-4-6 2-8" stroke="#c9ccd2" stroke-width="3" fill="none"/>',
  // 05 Gothic Estate, 06 Jungle Ruins, 08 Suburban Chaos.
  'mover:bookcase': '<rect x="8" y="6" width="30" height="44" fill="#4a2e1c"/><path d="M10 16h26M10 26h26M10 36h26" stroke="#2e1c12" stroke-width="2"/><path d="M12 8v7M15 9v6M19 8v7M24 18v7M28 17v8M13 28v7M30 27v8" stroke="#a03030" stroke-width="2.5"/><path d="M42 28h10M48 24l4 4-4 4" stroke="#2ec4b6" stroke-width="2.5" fill="none"/>',
  'mover:shelf': '<rect x="16" y="8" width="24" height="40" fill="#4a2e1c"/><path d="M18 18h20M18 28h20M18 38h20" stroke="#2e1c12" stroke-width="2"/><path d="M20 10v7M24 11v6M30 20v7M34 30v7" stroke="#24502e" stroke-width="2.5"/><path d="M4 28h8M8 24l-4 4 4 4M44 28h8M48 24l4 4-4 4" stroke="#2ec4b6" stroke-width="2" fill="none"/>',
  'block:rotten': '<rect x="6" y="22" width="44" height="12" fill="#6a5040"/><path d="M14 22v12M24 22v12M34 22v12M44 22v12" stroke="#3a2a20" stroke-width="1.5"/><path d="M20 30l4 8 4-6 4 10" stroke="#1a1410" stroke-width="2.5" fill="none"/><path d="M28 44v6M24 48l4 3 4-3" stroke="#e3b021" stroke-width="2" fill="none"/>',
  'light:candle': '<path d="M28 50V24M16 50h24M14 30h28" stroke="#3a3c40" stroke-width="3"/><rect x="12" y="20" width="4" height="10" fill="#efe6cf"/><rect x="26" y="16" width="4" height="10" fill="#efe6cf"/><rect x="40" y="20" width="4" height="10" fill="#efe6cf"/><path d="M14 18q-2-4 0-7q2 3 0 7M28 14q-2-4 0-7q2 3 0 7M42 18q-2-4 0-7q2 3 0 7" fill="#ffb040"/>',
  'light:chandelier': '<path d="M28 4v16" stroke="#b08d3a" stroke-width="2"/><ellipse cx="28" cy="32" rx="20" ry="5" fill="none" stroke="#b08d3a" stroke-width="3"/><path d="M28 20L10 31M28 20l18 11" stroke="#b08d3a" stroke-width="2"/><rect x="7" y="22" width="3" height="8" fill="#efe6cf"/><rect x="27" y="24" width="3" height="8" fill="#efe6cf"/><rect x="46" y="22" width="3" height="8" fill="#efe6cf"/><circle cx="8.5" cy="19" r="2" fill="#ffb040"/><circle cx="28.5" cy="21" r="2" fill="#ffb040"/><circle cx="47.5" cy="19" r="2" fill="#ffb040"/>',
  'block:rope_bridge': '<path d="M4 18q24 16 48 0M4 26q24 16 48 0" stroke="#a08a5a" stroke-width="2" fill="none"/><path d="M8 30l4 2M14 33l4 2M22 35l4 1M30 36l4-1M38 34l4-2M44 31l4-2" stroke="#7a5a3a" stroke-width="4"/><rect x="2" y="16" width="4" height="22" fill="#5a4630"/><rect x="50" y="16" width="4" height="22" fill="#5a4630"/>',
  'block:old_planks': '<rect x="6" y="24" width="44" height="8" fill="#8a7a68"/><path d="M18 24v8M30 24v8M42 24v8" stroke="#5a4a38" stroke-width="1.5"/><path d="M22 34l3 8M34 34l-2 10M14 34l-1 6" stroke="#5a4a38" stroke-width="3"/>',
  'ladder:vines': '<path d="M18 4q-6 12 0 24t0 24M30 4q6 12 0 24t0 24M40 6q-5 12 0 22" stroke="#2e5a1a" stroke-width="3" fill="none"/><path d="M14 12l-5 2 5 2M22 22l5 2-5 2M26 34l-5 2 5 2M34 14l5 2-5 2M36 40l5 2-5 2" fill="#5a9a30" stroke="#3c7a24"/>',
  'trap:rockfall': '<circle cx="18" cy="14" r="8" fill="#767261"/><circle cx="34" cy="12" r="7" fill="#8a8a7a"/><circle cx="27" cy="22" r="6" fill="#5e5e48"/><path d="M18 30v10M28 32v10M38 30v10" stroke="#e3b021" stroke-width="2.5" stroke-dasharray="3 2"/><rect x="8" y="46" width="40" height="4" fill="#e3b021"/>',
  'mover:garage_door': '<path d="M8 50V18l20-12 20 12v32" fill="#cac19c"/><rect x="14" y="26" width="28" height="24" fill="#3a3c40"/><rect x="14" y="26" width="28" height="12" fill="#f0eee8"/><path d="M14 30h28M14 34h28" stroke="#b8b4ac"/><path d="M28 46v-6M24 43l4-4 4 4" stroke="#2ec4b6" stroke-width="2.5" fill="none"/>',
  'block:fence': '<path d="M8 22l4-6 4 6v24H8zM20 22l4-6 4 6v24h-8zM32 22l4-6 4 6v24h-8zM44 22l4-6 4 6v24h-8z" fill="#f2f0ea" stroke="#b8b4ac"/><path d="M6 28h48M6 40h48" stroke="#d8d4cc" stroke-width="3"/><path d="M26 30l4 4-3 4 4 4" stroke="#2a2d33" stroke-width="2" fill="none"/>',
  'block:roof': '<path d="M4 34L28 12l24 22" fill="none" stroke="#3e403d" stroke-width="7"/><rect x="12" y="34" width="32" height="16" fill="#cac19c"/><rect x="24" y="40" width="8" height="10" fill="#5a3a24"/>',
  'water:pool': '<rect x="6" y="18" width="44" height="28" fill="#f0ece4"/><rect x="10" y="22" width="36" height="20" fill="#3fc8e8"/><path d="M14 30q4-3 8 0t8 0t8 0" stroke="#d8f6ff" stroke-width="2" fill="none"/><path d="M40 10v14M44 10v14M40 14h4M40 19h4" stroke="#8c9298" stroke-width="2"/>',
  'water:swamp': '<rect x="6" y="24" width="44" height="22" fill="#5a6a32"/><path d="M14 24q2-10 4-14M38 24q-1-9 2-13" stroke="#6fbf4a" stroke-width="2" fill="none"/>',
  'block:glass': '<rect x="8" y="8" width="40" height="40" fill="#bfe3e8" fill-opacity=".45" stroke="#8aa8b0" stroke-width="3"/><path d="M16 38l12-24M26 40l10-20" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>',
  'block:glass_reinforced': '<rect x="8" y="8" width="40" height="40" fill="#9cc4cc" fill-opacity=".55" stroke="#5a6a70" stroke-width="5"/><path d="M28 28l-9-7M28 28l10-5M28 28l-3 12M28 28l8 9" stroke="#fff" stroke-width="1.6"/>',
  'block:field': '<rect x="6" y="8" width="5" height="40" fill="#2a2f3a"/><rect x="45" y="8" width="5" height="40" fill="#2a2f3a"/><rect x="11" y="10" width="34" height="36" fill="#5ad8ff" fill-opacity=".35"/><path d="M11 16h34M11 24h34M11 32h34M11 40h34" stroke="#5ad8ff" stroke-width="2"/>',
  'zone:lowgrav': '<rect x="10" y="10" width="36" height="38" fill="#8f7bff" fill-opacity=".15" stroke="#8f7bff" stroke-width="2" stroke-dasharray="4 3"/><circle cx="28" cy="24" r="6" fill="#d8e6ff"/><path d="M20 44v-8M28 44v-10M36 44v-8" stroke="#8fc4ff" stroke-width="2"/><path d="M17 38l3-4 3 4M25 36l3-4 3 4M33 38l3-4 3 4" stroke="#8fc4ff" stroke-width="2" fill="none"/>',
  'light:sign': '<rect x="6" y="16" width="44" height="22" rx="2" fill="#15101e" stroke="#ff4fd8" stroke-width="2.5"/><text x="28" y="32" font-size="12" font-weight="bold" text-anchor="middle" fill="#ff4fd8">OPEN</text>',
  'light:billboard': '<rect x="4" y="8" width="48" height="28" fill="#4fe0ff" fill-opacity=".3" stroke="#4fe0ff" stroke-width="2"/><path d="M6 14h44M6 20h44M6 26h44M6 32h44" stroke="#4fe0ff" stroke-opacity=".45"/><rect x="25" y="36" width="6" height="14" fill="#3a3f48"/>',
  'mover:elevator': '<rect x="12" y="6" width="4" height="44" fill="#5a5f68"/><rect x="40" y="6" width="4" height="44" fill="#5a5f68"/><rect x="16" y="20" width="24" height="18" fill="#bfe6f5" fill-opacity=".35" stroke="#2ec4b6" stroke-width="2"/><path d="M28 10v8M24 14l4-4 4 4M28 48v-8M24 44l4 4 4-4" stroke="#2ec4b6" stroke-width="2" fill="none"/>',
  portal: '<ellipse cx="17" cy="28" rx="9" ry="18" fill="#3aa8ff" fill-opacity=".35" stroke="#3aa8ff" stroke-width="3"/><ellipse cx="39" cy="28" rx="9" ry="18" fill="#ff8a2a" fill-opacity=".35" stroke="#ff8a2a" stroke-width="3"/><path d="M14 28q3-6 6 0t-3 4M36 28q3-6 6 0t-3 4" stroke="#fff" stroke-width="1.5" fill="none"/>',
  'door:oak': '<path d="M10 50V14a18 10 0 0 1 36 0v36z" fill="#7a5232" stroke="#4e3420" stroke-width="2"/><path d="M19 50V10M28 50V8M37 50V10" stroke="#5e3c20" stroke-width="2"/><path d="M10 22h36M10 40h36" stroke="#3a3634" stroke-width="4"/><circle cx="40" cy="31" r="2.5" fill="#3a3634"/>',
  'water:harbour': '<rect x="4" y="22" width="48" height="28" fill="#2e5a66"/><path d="M4 26q6-4 12 0t12 0t12 0t12 0" stroke="#a8d8e0" stroke-width="2.5" fill="none"/><rect x="4" y="12" width="14" height="12" fill="#8e9090"/><rect x="38" y="16" width="14" height="4" fill="#a8977c"/><path d="M41 20v18M49 20v18" stroke="#5a5048" stroke-width="2.5"/>',
  'block:lattice': '<rect x="8" y="6" width="40" height="44" fill="#1a120c" stroke="#6e4628" stroke-width="3"/><path d="M8 16l30 30M8 30l16 16M8 44l4 4M18 6l30 30M32 6l16 16M8 36l30-30M8 22l16-16M18 50l30-30M32 50l16-16" stroke="#a07040" stroke-width="2.5"/>',
  'block:wattle': '<path d="M10 12v36M20 12v36M30 12v36M40 12v36M50 12v36" stroke="#4e3420" stroke-width="3"/><path d="M6 18q5 4 10 0t10 0t10 0t10 0t8 0M6 26q5 -4 10 0t10 0t10 0t10 0t8 0M6 34q5 4 10 0t10 0t10 0t10 0t8 0M6 42q5 -4 10 0t10 0t10 0t10 0t8 0" stroke="#a08058" stroke-width="3" fill="none"/>',
  'mover:rollup_door': '<rect x="4" y="6" width="48" height="6" fill="#5a6068"/><rect x="8" y="12" width="40" height="22" fill="#c8ccd0" stroke="#6a7078" stroke-width="2"/><path d="M8 18h40M8 24h40M8 30h40" stroke="#8a9098" stroke-width="1.5"/><path d="M28 50V38M23 43l5-5 5 5" stroke="#2ec4b6" stroke-width="2.5" fill="none"/>',
  'block:ice': '<path d="M8 44l6-26 14-8 16 6 4 26-12 6H18z" fill="#9cd2e8" stroke="#e8f8ff" stroke-width="2"/><path d="M14 18l10 14 16-14M24 32l-4 18M24 32l20 8" stroke="#f4fbff" stroke-width="1.5" fill="none"/>',
  'block:thin_ice': '<rect x="4" y="22" width="48" height="10" fill="#c8e4f0" stroke="#e8f8ff" stroke-width="2"/><path d="M20 22l4 5-3 5M30 22l-2 4 4 6M36 27l8 2" stroke="#4f8eaa" stroke-width="1.5" fill="none"/><path d="M8 42q10 6 20 0t20 0" stroke="#2a5a7a" stroke-width="3" fill="none"/>',
  'door:portcullis': '<rect x="6" y="6" width="44" height="6" fill="#6a6058"/><path d="M12 12v34M20 12v34M28 12v34M36 12v34M44 12v34" stroke="#4a4440" stroke-width="3"/><path d="M8 22h40M8 34h40" stroke="#4a4440" stroke-width="3"/><path d="M12 46l-1 4M20 46l-1 4M28 46l-1 4M36 46l-1 4M44 46l-1 4" stroke="#8a8078" stroke-width="2"/>',
  'mover:portcullis': '<rect x="4" y="4" width="6" height="48" fill="#c8b48a"/><rect x="46" y="4" width="6" height="48" fill="#c8b48a"/><path d="M14 8v28M21 8v28M28 8v28M35 8v28M42 8v28M10 16h36M10 28h36" stroke="#4a4440" stroke-width="3"/><path d="M28 50V40M23 45l5-5 5 5" stroke="#2ec4b6" stroke-width="2.5" fill="none"/>',
  'mover:cage': '<rect x="6" y="32" width="44" height="4" fill="#d6bc84"/><rect x="16" y="14" width="24" height="3" fill="#d6bc84"/><path d="M18 17v30M24 17v30M30 17v30M36 17v30" stroke="#4a4440" stroke-width="2.5"/><rect x="16" y="46" width="24" height="3" fill="#8a6a42"/><path d="M46 46V38M42 42l4-4 4 4" stroke="#2ec4b6" stroke-width="2.5" fill="none"/>',
  'light:brazier': '<path d="M16 30h24l-4 8H20z" fill="#5a4a3a"/><path d="M26 38v10M20 50h16" stroke="#5a4a3a" stroke-width="3"/><path d="M20 30q-2-10 6-16-1 6 4 8 2-6 0-10 10 8 6 18z" fill="#ff8a2a"/><path d="M24 30q0-6 4-9 0 4 3 5 1-3 1-5 4 5 2 9z" fill="#ffe08a"/>',
  'mover:tram': '<path d="M4 14h48" stroke="#5a5f68" stroke-width="3"/><rect x="10" y="18" width="34" height="18" rx="3" fill="#e0412f"/><rect x="14" y="22" width="8" height="7" fill="#bfe6f5"/><rect x="25" y="22" width="8" height="7" fill="#bfe6f5"/><rect x="36" y="22" width="5" height="7" fill="#bfe6f5"/><path d="M14 44h28M37 40l5 4-5 4" stroke="#2ec4b6" stroke-width="2.5" fill="none"/>',
};

/** Tools that put something new into the map (the toolbar's Place button lights up for them). */
const PLACING: ReadonlySet<Tool['kind']> = new Set(['tile', 'setpiece', 'spawn', 'pickup', 'scenario', 'prop', 'mount', 'scatter', 'npc']);

/** A tool's palette key, as its card's `data-tool` (`tile:core.room`, `prop:prop.barrel`, `spawn`…). */
function toolKey(tool: Tool): string {
  switch (tool.kind) {
    case 'tile':
      return `tile:${tool.tile}`;
    case 'setpiece':
      return `setpiece:${tool.piece}`;
    case 'pickup':
      return `pickup:${tool.item}`;
    case 'scenario':
      return `scenario:${tool.key}`;
    case 'edge':
      return `edge:${tool.style}`;
    case 'prop':
      return `prop:${tool.model}`;
    case 'mount':
      return `mount:${tool.model}`;
    case 'scatter':
      return `scatter:${tool.set}`;
    case 'npc':
      return `npc:${tool.key}`;
    default:
      return tool.kind;
  }
}

/** Toolbar icons (24×24, drawn in the button's text colour). */
const TOOL_ICONS: Record<string, string> = {
  select: '<path d="M6 3l13 7-5.6 1.6L16.5 19l-2.6 1.2-3.1-7.3L6 17z" fill="currentColor"/>',
  place: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5v9M7.5 12h9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  erase: '<path d="M14.5 4.2l5.3 5.3a1.5 1.5 0 0 1 0 2.1L12 19.4H7.6l-3.4-3.4a1.5 1.5 0 0 1 0-2.1l8.2-8.2a1.5 1.5 0 0 1 2.1 0z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.8 9.8l5.4 5.4" stroke="currentColor" stroke-width="2"/><path d="M12 19.4h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  rotate: '<path d="M19 12a7 7 0 1 1-2.1-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M19.5 3.5v5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  paint: '<path d="M4 15.5l8.5-8.5 5 5-8.5 8.5H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M13.5 6l2.5-2.5 5 5L18.5 11" fill="none" stroke="currentColor" stroke-width="2"/>',
  edge: '<path d="M3 5h18v14H3zM3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  terrain: '<path d="M2.5 19l6-10 4 6 2.5-3.5 6.5 7.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="17" cy="6" r="2" fill="currentColor"/>',
  measure: '<path d="M3.5 15.5l12-12 5 5-12 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7.5 11.5l2 2M10 9l1.5 1.5M12.5 6.5l2 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  delete: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10.5 10.5v6M13.5 10.5v6" stroke="currentColor" stroke-width="1.6"/>',
};

/** Palette thumbnails for the NPC entries: soldiers drawn with their weapon. */
function npcIcon(key: string): string {
  const soldier = (x: number, y: number, s: number, color: string, gun: 'rifle' | 'shotgun' | 'launcher') => {
    const g = gun === 'rifle' ? `<rect x="${x + 4 * s}" y="${y + 9 * s}" width="${13 * s}" height="${2 * s}" fill="#2a2f3a"/>` : gun === 'shotgun' ? `<rect x="${x + 4 * s}" y="${y + 8.5 * s}" width="${9 * s}" height="${3.4 * s}" rx="${s}" fill="#5a4030"/>` : `<rect x="${x + 2 * s}" y="${y + 7 * s}" width="${13 * s}" height="${5 * s}" rx="${2 * s}" fill="#3a3f48"/>`;
    return `<circle cx="${x}" cy="${y}" r="${4 * s}" fill="${color}"/><rect x="${x - 5 * s}" y="${y + 4.5 * s}" width="${10 * s}" height="${13 * s}" rx="${3 * s}" fill="${color}"/><rect x="${x - 3 * s}" y="${y - 2 * s}" width="${6 * s}" height="${2 * s}" fill="#1c1f26"/>${g}`;
  };
  const red = '#d04a3a';
  const body: Record<string, string> = {
    trooper: soldier(24, 14, 1.6, red, 'rifle'),
    gunner: soldier(24, 14, 1.6, '#c9612f', 'shotgun'),
    heavy: soldier(24, 13, 1.9, '#9b3428', 'launcher'),
    squad: soldier(14, 20, 1.1, red, 'rifle') + soldier(40, 20, 1.1, '#c9612f', 'shotgun') + soldier(27, 14, 1.25, red, 'rifle'),
    hunters: soldier(13, 20, 1.05, red, 'rifle') + soldier(41, 20, 1.05, '#9b3428', 'launcher') + soldier(27, 13, 1.2, red, 'rifle') + '<path d="M44 6l6 6-6 6" stroke="#ffb347" stroke-width="3" fill="none"/>',
    waves: soldier(17, 20, 1.1, red, 'rifle') + soldier(35, 20, 1.1, red, 'rifle') + '<path d="M44 30a8 8 0 1 0 2-10" stroke="#ffb347" stroke-width="2.5" fill="none"/><path d="M47 14v6h-6" stroke="#ffb347" stroke-width="2.5" fill="none"/>',
    militia: soldier(16, 20, 1.1, '#5cc77a', 'rifle') + soldier(38, 20, 1.1, '#5cc77a', 'shotgun') + '<path d="M27 4l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V7z" fill="#00d1ff" fill-opacity=".85"/>',
  };
  return `<svg viewBox="0 0 56 56"><ellipse cx="28" cy="50" rx="20" ry="4" fill="#000" fill-opacity=".25"/>${body[key] ?? body.trooper}</svg>`;
}

/** How close (m) a click must be to an entity's position to select it. */
function pickRadius(e: MapEntity): number {
  switch (e.kind) {
    case 'door':
      return 1.6;
    case 'zone':
      return Math.max(0.9, Math.min(e.size[0], e.size[2]) / 2);
    case 'trap':
      return e.trap === 'mine' ? 0.7 : e.trap === 'shock' ? 1.2 : 1.5;
    case 'destructible':
      return e.model === 'wall' ? 1.5 : 0.9;
    case 'encounter':
      return Math.max(1.2, Math.min(3, e.radius));
    case 'hill':
    case 'bombsite':
    case 'rescue':
    case 'objective':
      return Math.max(1.2, Math.min(4, e.radius));
    case 'sector':
      return 2.5;
    case 'hostage':
      return 0.8;
    case 'flag':
      return 1.1;
    case 'prop': {
      const size = getProp(e.model)?.size ?? [1, 1, 1];
      return Math.max(0.5, (Math.min(size[0], size[2]) * e.scale) / 2 + 0.2);
    }
    case 'mount': {
      const half = MOUNT_DEFS[e.model].half;
      return Math.max(0.8, Math.min(half[0], half[2]) + 0.2);
    }
    case 'block':
    case 'water':
      return Math.max(0.8, Math.min(e.size[0], e.size[2]) / 2);
    default:
      return 0.9;
  }
}

interface DragState {
  startCell: [number, number];
  startPoint: Vec3;
  pointerX: number;
  pointerY: number;
  moved: boolean;
  /** Tiles move by whole cells; entity-only selections move freely (0.5 m snap). */
  cellOffset: [number, number];
  freeOffset: [number, number];
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const FLY_SPEED = 18;
const LOOK_SENSITIVITY = 0.004;
const snap = (v: number, step: number) => Math.round(v / step) * step;

/**
 * MapMaker controller: owns the edit history, tools, selection and the
 * editor UI. Every document change goes through EditHistory, so it is
 * undoable, kept as a draft while unsaved, and revalidated. MapMaker always
 * opens on a blank starter map (startFresh); saved maps, drafts and
 * templates are loaded on purpose from Open….
 */
export class EditorApp {
  readonly view: EditorView;
  readonly history: EditHistory;
  private tool: Tool = { kind: 'select' };
  private rotation: Rotation = 0;
  /** The shipped set pieces and role packs. MapMaker's document keeps placements; it draws them expanded (viewDoc). */
  private readonly setPieceLib: SetPieceLibrary = builtInSetPieces();
  /** The player's own set pieces (their library in this browser, storage.ts), by id; `myPiecesRev` counts changes. */
  private myPieces = new Map<string, SetPieceDefinition>();
  private myPiecesRev = 0;
  /** The set piece tool: mirrored (M), and the look it places in (a role pack id; '' the map theme's). */
  private pieceMirror = false;
  private pieceLook = '';
  /** What the set piece tool's ghost shows now: the placement it would make, whether it fits (and why not), its ports. */
  private pieceHover: { def: SetPieceDefinition; placement: SetPiecePlacement; ok: boolean; reason: string; blocked: number } | null = null;
  /** Box select (Select tool, drag on empty ground): the rectangle on screen. */
  private marquee: { x0: number; y0: number; x1: number; y1: number; add: boolean; moved: boolean } | null = null;
  /** Facing for the next prop placed. */
  private propYaw = 0;
  /** The scatter set N picks up again. */
  private lastScatter: ScatterSetId = 'forest';
  private readonly thumbs: ModelThumbnails;
  /** The palette's prebuilt pictures (public/thumbs) and its behaviour (groups, search, favourites, keys). */
  readonly paletteAtlas = new PaletteAtlas();
  palette!: Palette;
  private showPane: (pane: string) => void = () => {};
  /** Palette workspace: build, entities or environment. */
  private paletteWs = 'build';
  private spawnYaw = 0;
  private scenarioYaw = 0;
  readonly logic: LogicPanel;
  /** The Road tool (race tracks). */
  private readonly paths: PathTool;
  /** Mover and plane routes, drawn on the map with the Paths tool's hands. */
  private readonly routes: RouteTool;
  /** The measure tool (U): its points and labels, editor-only. */
  private readonly measure: MeasureTool;
  /** The prop tool's placing options: Randomise. */
  private readonly propOpts: PropPlaceOptions;
  /** What props and the measure tool land on, per document version and view. */
  private readonly surfaces = new SurfaceBoxes();
  /** The rotate ring on the selection gizmo: drag to turn (MapMaker overhaul Phase 3 item 9). */
  private readonly ring: RotateRing;
  private level = 0;
  private showAll = false;
  /** The last placing tool, so the toolbar's Place button can pick it up again. */
  private lastPlace: Tool | null = null;
  /** Style the Walls tool builds with. */
  private edgeStyle: EdgeStyle = 'window';
  /** Top bar Snap: 'normal' keeps each tool's own step (50 cm, props 25 cm). */
  private snapMode: 'fine' | 'normal' | 'coarse' | 'off' = 'normal';
  private snapStep(normal: number): number {
    if (this.freePlacing()) return 0.01;
    return { fine: 0.25, normal, coarse: 1, off: 0.01 }[this.snapMode];
  }

  /** One placement rule for every kind: hold Ctrl (or Shift) to place without snapping. */
  private freePlacing(): boolean {
    return ['ControlLeft', 'ControlRight', 'MetaLeft', 'ShiftLeft', 'ShiftRight'].some((k) => this.keys.has(k));
  }
  /** Last pointer position over the view, for the hover card. */
  private pointerAt: { x: number; y: number } | null = null;
  /** Pointer ray, for picking what is under the cursor. */
  private ray: { origin: Vec3; dir: Vec3 } | null = null;
  private selection: Selection = emptySelection();
  private hoverPoint: Vec3 | null = null;
  /** The hover point is on the terrain (nearer than the level plane). */
  private hoverOnTerrain = false;
  private hoverCell: [number, number, number] | null = null;
  private drag: DragState | null = null;
  private looking: { x: number; y: number; moved: boolean; travel: number; button: number } | null = null;
  private keys = new Set<string>();
  private issues: ValidationIssue[] = [];
  private navIssues: ValidationIssue[] = [];
  private renderedRevision = -1;
  private renderedLevel = -1;
  private renderedShowAll = false;
  private savedRevision = 0;
  private autosaveTimer?: number;
  private navTimer?: number;
  /** Coplanar overlaps (geometry.coplanar), worked out a moment after each edit like navigation. */
  private zIssues: ValidationIssue[] = [];
  private zSpots: CoplanarSpot[] = [];
  private zTimer?: number;
  private overlapsOn = false;
  private navToken = 0;
  private toastTimer?: number;
  private active = false;
  /** Boxes currently shown (respecting floor isolation), for surface picking. */
  private visibleBoxes: WorldBox[] = [];
  private hoverFace: BoxHit | null = null;
  /** Paint tool: the terrain under the pointer when it, not a surface, is what a click paints. */
  private paintGround: Vec3 | null = null;
  /** The boxes Paint and Walls can point at: everything drawn but the invisible barriers (map edge, ground fence). */
  private paintable: { from: WorldBox[]; boxes: WorldBox[]; tiles: WorldBox[] } = { from: [], boxes: [], tiles: [] };
  /** Cell side under the pointer for the wall tool. */
  private hoverEdge: EdgeTarget | null = null;
  private paintStyle: SurfaceStyle = { material: 'core.red_brick', tint: null };
  private paintScope: PaintScope = 'surface';
  private terrainBrush: TerrainBrush = 'raise';
  private terrainMaterial: TerrainMaterial = 'dirt';
  private foliageLevel = 3;
  private brushRadius = 8;
  private brushStrength = 0.5;
  /** Ground point under the pointer for the terrain tool. */
  private terrainHover: Vec3 | null = null;
  /**
   * Live sculpt: the document's ground before the stroke and as it is now (committed as one undo step on release),
   * and that ground kept under the floors (what the view shows and the pointer meets while the brush is dragged).
   */
  private stroke: { before: TerrainData; now: TerrainData; shown: TerrainData; target: number; seed: number } | null = null;

  constructor(private readonly host: EditorHost) {
    this.view = new EditorView(host.engine);
    this.thumbs = new ModelThumbnails(host.engine);
    this.paths = new PathTool({
      doc: () => this.doc,
      run: (label, cmd) => this.run(label, cmd),
      toast: (t, bad) => this.toast(t, bad),
      scene: this.view.scene,
      ground: () => this.view.ground,
      screen: (p) => this.view.projectInView(p),
      pointer: () => this.pointerAt,
    });
    this.routes = new RouteTool({ doc: () => this.doc, run: (label, cmd) => this.run(label, cmd), toast: (t, bad) => this.toast(t, bad), scene: this.view.scene });
    this.measure = new MeasureTool({ scene: this.view.scene, project: (p) => this.view.projectInView(p), overlay: $('editor') });
    this.ring = new RotateRing(
      {
        center: () => (this.selCount() ? this.selectionCenter() : null),
        radius: () => this.ringRadius(),
        step: (fine) => ringStep(this.doc, this.selection, fine),
        project: (p) => this.view.projectInView(p),
        onPlane: (y) => (this.pointerAt ? this.view.pickPlane(this.pointerAt.x, this.pointerAt.y, y) : null),
        preview: (turn) => this.previewTurn(turn),
        commit: (turn) => this.run(`Turn ${turnLabel(turn)}`, turnByCommand(this.doc, this.selection, turn, coreCatalog, this.placeLib)),
        draw: (r) => this.view.setRing(r ? this.selectionCenter() : null, r),
      },
      $('editor'),
    );
    this.propOpts = new PropPlaceOptions(testMode()?.seed ?? Math.floor(Math.random() * 2 ** 31), () => this.updateHover());
    // The top bar steps through its compact layouts until it fits, whenever its width or contents change.
    const top = $('ed-top');
    new ResizeObserver(() => fitTopBar(top)).observe(top);
    new MutationObserver(() => fitTopBar(top)).observe($('ed-status'), { childList: true, characterData: true, subtree: true });
    void document.fonts?.ready.then(() => fitTopBar(top));
    this.history = new EditHistory(starterMap(STARTER_TERRAIN, 'grass'));
    this.logic = new LogicPanel({
      doc: () => this.doc,
      commit: (label, after) => this.run(label, { kind: 'setLogic', before: this.doc.logic, after }),
      commitFactions: (label, after) => this.run(label, { kind: 'setFactions', before: this.doc.factions, after }),
      focusEntity: (id) => this.focusEntity(id),
      openChanged: () => this.syncWorkspaceTabs(),
    });
    this.buildPalette();
    this.bindUi();
    this.bindInput();
    this.view.focus({ x: 0, y: 0, z: 0 });
    $('ed-reset-view').addEventListener('click', () => this.resetView());
    // Closing the tab mid-edit: keep the pending draft.
    window.addEventListener('pagehide', () => this.autosaveTimer !== undefined && this.flushDraft());
  }

  /**
   * Entering MapMaker from the menu: a blank starter map, like New. Unsaved
   * work from before stays in Open… as a draft rather than being restored.
   */
  startFresh(): void {
    if (this.autosaveTimer !== undefined) this.flushDraft();
    this.replaceDocument(starterMap(STARTER_TERRAIN, 'grass'));
    const drafts = listDrafts().length;
    this.toast(drafts ? `New blank map · ${drafts} unsaved draft${drafts > 1 ? 's' : ''} in Open…` : 'New blank map · Open… loads a saved map or template');
  }

  get doc(): MapDocument {
    return this.history.doc;
  }

  // ---------------------------------------------------------------- set pieces: the document as drawn

  /** The document's set pieces expanded into their parts (pure, cached per document version: map/setPieces.ts). */
  private get expansion(): SetPieceExpansion {
    return expandSetPieces(this.doc, this.setPieceLib);
  }

  /** The document as MapMaker draws, picks and checks it: its set pieces expanded (the document keeps the placements). */
  get viewDoc(): MapDocument {
    return this.expansion.map;
  }

  /** The map's collision boxes as played (set pieces expanded), worked out once per document version. */
  private boxesFor: { doc: MapDocument; boxes: WorldBox[] } | null = null;

  private mapBoxes(): WorldBox[] {
    const doc = this.viewDoc;
    if (this.boxesFor?.doc !== doc) this.boxesFor = { doc, boxes: buildMapGeometry(doc) };
    return this.boxesFor.boxes;
  }

  /**
   * The ground as MapMaker shows it and the pointer meets it: the document's own ground (which MapMaker changes only
   * by sculpting) with the paths laid in and kept under every floor (EditorView.setMap, as loading plays it), or a
   * brush stroke's while one is dragged.
   */
  private get shownGround(): TerrainData | null {
    return this.stroke?.shown ?? this.view.ground;
  }

  /** `terrain` as it would be shown: kept under the map's floors, with the paths laid in first unless `laid` is false (a brush's live preview). */
  private groundShownFor(terrain: TerrainData, laid = true): TerrainData {
    const doc = { ...this.viewDoc, terrain };
    return terrainUnderFloors(laid ? withPathsLaid(doc) : doc, this.mapBoxes())!;
  }

  /** The pieces MapMaker can place: the shipped ones and the player's own (their library), with the role packs. */
  private placeLibCache: { rev: number; lib: SetPieceLibrary } | null = null;

  private get placeLib(): SetPieceLibrary {
    if (!this.myPieces.size) return this.setPieceLib;
    if (this.placeLibCache?.rev !== this.myPiecesRev) this.placeLibCache = { rev: this.myPiecesRev, lib: { pieces: new Map([...this.setPieceLib.pieces, ...this.myPieces]), packs: this.setPieceLib.packs } };
    return this.placeLibCache.lib;
  }

  /** A set piece's definition: shipped, the map's own, or the player's. */
  private pieceDef(id: string): SetPieceDefinition | undefined {
    return piecesFor(this.doc, this.setPieceLib).get(id) ?? this.myPieces.get(id);
  }

  private placementOf(id: string): SetPiecePlacement | undefined {
    return this.doc.setPieces?.find((p) => p.id === id);
  }

  /** A placement as MapMaker outlines it: its footprint, and its ports, each flagged when a wall stands in it. */
  private pieceOutline(p: SetPiecePlacement): PieceOutline | null {
    const def = this.pieceDef(p.piece);
    if (!def) return null;
    const ports = setPiecePortStates(p, def, this.mapBoxes()).map((s) => ({ x: s.x, y: s.y, z: s.z, side: s.side, kind: s.kind, closed: s.closed, blocked: !!s.blockedBy }));
    return { cells: setPieceFootprint(p, def), ports };
  }

  /**
   * A placement's own collision as it would be built where it stands (its sides resolved against the tiles round it:
   * a port that meets one becomes a doorway), for the ghost's ports: the piece and its neighbours alone, not the map.
   */
  private ownBoxes(p: SetPiecePlacement, def: SetPieceDefinition): WorldBox[] {
    const view = this.viewDoc;
    const parts = setPieceParts(p, def, view.classicStructure.theme, this.setPieceLib);
    const near = new Set<string>();
    for (const [x, y, z] of setPieceFootprint(p, def)) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) near.add(`${x + dx},${y + dy},${z}`);
    const neighbours = view.classicStructure.tiles.filter((t) => (placementCells(t) ?? []).some(([x, y, z]) => near.has(`${x},${y},${z}`)));
    const alone: MapDocument = { ...view, terrain: null, bounds: null, classicStructure: { ...view.classicStructure, tiles: [...parts.tiles, ...neighbours] }, entities: parts.entities.filter((e) => e.kind === 'block') };
    const mine = new Set([...parts.tiles.map((t) => t.id), ...parts.entities.map((e) => e.id)]);
    return buildMapGeometry(alone).filter((b) => mine.has(b.sourceId));
  }

  private selPieces(): string[] {
    return this.selection.setPieces ?? [];
  }

  /** Everything selected: tiles, entities and set pieces. */
  private selCount(): number {
    return this.selection.tiles.length + this.selection.entities.length + this.selPieces().length;
  }

  /** What blocks a port, in words (a tile's wall, a block, another set piece). */
  private blockerName(sourceId: string): string {
    const placement = this.expansion.partOf.get(sourceId);
    if (placement) {
      const p = this.placementOf(placement);
      return `the ${(p && this.pieceDef(p.piece)?.displayName) ?? 'set piece'}`;
    }
    const tile = this.doc.classicStructure.tiles.find((t) => t.id === sourceId);
    if (tile) return `the ${coreCatalog.get(tile.tile)?.displayName ?? 'tile'}'s wall`;
    const e = this.doc.entities.find((x) => x.id === sourceId);
    if (e?.kind === 'block') return `a block (${(e.material && coreMaterials.get(e.material)?.displayName) ?? 'theme'}${e.name ? `, ${e.name}` : ''})`;
    return e ? entityLabel(this.doc, e) : 'something';
  }

  /** A port in words: "the door on the east side (Level 1)". */
  private portName(s: { side: string; z: number; kind: string }): string {
    const side = ({ N: 'north', E: 'east', S: 'south', W: 'west' } as Record<string, string>)[s.side];
    return `the ${s.kind === 'door' ? 'door' : 'opening'} on the ${side} side (${levelName(s.z)})`;
  }

  /** What Set thumbnail (makerThumb.ts) needs from the editor. */
  private readonly thumbHost: ThumbHost = {
    view: () => this.view,
    current: () => this.doc,
    shipped: () => SHIPPED_IDS.has(this.doc.metadata.id),
    setThumbnail: (thumbnail, camera) => {
      const m = this.doc.metadata;
      if (thumbnail === m.thumbnail) return;
      this.run(thumbnail ? 'Set thumbnail' : 'Clear thumbnail', { kind: 'setMetadata', before: { thumbnail: m.thumbnail, thumbnailCamera: m.thumbnailCamera }, after: { thumbnail, thumbnailCamera: thumbnail ? camera : undefined } });
    },
    toast: (message, error) => this.toast(message, error),
  };

  show(): void {
    this.active = true;
    $('editor').hidden = false;
    this.refresh(true);
    // The owner (signed in, and listed on the hub) edits our maps as they are and publishes them.
    void isOwner().then((owner) => this.setOwner(owner));
  }

  /** Show or hide the owner's tools: Publish, and Terrain → Real places (height grid files, trace image). */
  setOwner(owner: boolean): void {
    this.owner = owner;
    $('ed-publish').hidden = !owner;
    for (const el of document.querySelectorAll<HTMLElement>('.ed-owner-only')) el.hidden = !owner;
    if (!owner) this.setTrace(null);
  }

  /** Signed in as an owner of the game (ownerPublish.ts): official maps open as they are, and Publish shows. */
  private owner = false;

  hide(): void {
    this.active = false;
    this.keys.clear();
    this.drag = null;
    this.looking = null;
    $('editor').hidden = true;
  }

  // ---------------------------------------------------------------- frame

  frame(dt: number): void {
    if (!this.active) return;
    const typing = isTyping();
    if (!typing && !this.keys.has('ControlLeft') && !this.keys.has('ControlRight') && !this.keys.has('MetaLeft')) {
      const k = (c: string) => (this.keys.has(c) ? 1 : 0);
      const speed = FLY_SPEED * (this.keys.has('ShiftLeft') ? 3 : 1) * dt;
      const f = k('KeyW') - k('KeyS');
      const r = k('KeyD') - k('KeyA');
      const u = k('KeyE') - k('KeyQ');
      if (f || r || u) this.view.fly(f * speed, r * speed, u * speed);
    }
    if (this.stroke) this.strokeStep(dt);
    this.refresh(false);
    this.measure.frame();
    this.view.render();
  }

  /** Bring meshes and panels up to date with the document and view settings. */
  private refresh(force: boolean): void {
    const rev = this.history.revision;
    const docChanged = force || rev !== this.renderedRevision;
    const viewChanged = this.level !== this.renderedLevel || this.showAll !== this.renderedShowAll;
    if (docChanged || viewChanged) {
      // Set pieces drawn as their parts (the document keeps the placements).
      this.visibleBoxes = this.view.setMap(this.viewDoc, this.level, this.showAll, this.mapBoxes());
      this.renderedLevel = this.level;
      this.renderedShowAll = this.showAll;
      this.updateSelectionVisuals();
      this.updateCounts();
      this.renderLevels();
    }
    if (docChanged) {
      this.renderedRevision = rev;
      const pieces = this.selPieces().filter((id) => !!this.placementOf(id));
      this.selection = {
        tiles: this.selection.tiles.filter((id) => this.doc.classicStructure.tiles.some((t) => t.id === id)),
        entities: this.selection.entities.filter((id) => this.doc.entities.some((e) => e.id === id)),
        ...(pieces.length ? { setPieces: pieces } : {}),
      };
      this.renderMyPieces();
      this.updateSelectionVisuals();
      this.syncToolbar();
      this.validate();
      this.renderInspector();
      this.updateTopBar();
      this.updateHover();
      this.logic.render();
      this.syncTerrainUi();
      this.paths.refresh();
      this.routes.refresh();
      this.paths.renderPane($('ed-paths'));
      if (!force) this.scheduleAutosave();
    }
  }

  // ---------------------------------------------------------------- sidebars

  /** Fold the palette or the side panel away (and back): their tabs, Backslash and Shift+Backslash; remembered in this browser. */
  private setupSidebars(): void {
    const root = $('editor');
    const key = 'tiletrigger.editor.sidebars';
    let saved: { pal?: boolean; right?: boolean } = {};
    try {
      saved = JSON.parse(localStorage.getItem(key) ?? '{}') as typeof saved;
    } catch {
      // Storage blocked: both open.
    }
    const apply = (side: 'pal' | 'right', collapsed: boolean) => {
      root.classList.toggle(`${side}-collapsed`, collapsed);
      const btn = $(side === 'pal' ? 'ed-pal-toggle' : 'ed-right-toggle');
      const name = side === 'pal' ? 'the palette' : 'the side panel';
      btn.textContent = (side === 'pal') === collapsed ? '›' : '‹';
      btn.title = `${collapsed ? 'Show' : 'Hide'} ${name} (${side === 'pal' ? '\\' : 'Shift+\\'})`;
      btn.setAttribute('aria-label', `${collapsed ? 'Show' : 'Hide'} ${name}`);
      btn.setAttribute('aria-expanded', String(!collapsed));
    };
    this.toggleSidebar = (side) => {
      const collapsed = !root.classList.contains(`${side}-collapsed`);
      apply(side, collapsed);
      saved[side] = collapsed;
      try {
        localStorage.setItem(key, JSON.stringify(saved));
      } catch {
        // This page only.
      }
    };
    apply('pal', !!saved.pal);
    apply('right', !!saved.right);
    $('ed-pal-toggle').addEventListener('click', () => this.toggleSidebar('pal'));
    $('ed-right-toggle').addEventListener('click', () => this.toggleSidebar('right'));
  }
  private toggleSidebar: (side: 'pal' | 'right') => void = () => undefined;
  private countedDoc: MapDocument | null = null;
  private countedBoxes = 0;

  // ---------------------------------------------------------------- editing

  private run(label: string, cmd: EditCommand | { error: string }): boolean {
    if ('error' in cmd) {
      this.toast(`Can't ${label.toLowerCase()}: ${cmd.error}`, true);
      return false;
    }
    try {
      // The document keeps its own ground: MapMaker draws it kept under the floors (EditorView.setMap), as loading
      // plays it, so a floor an edit moves or deletes gives the ground under it back.
      this.history.execute(label, cmd);
      return true;
    } catch (e) {
      this.toast(`Can't ${label.toLowerCase()}: ${(e as Error).message}`, true);
      return false;
    }
  }

  private undo(): void {
    const label = this.history.undo();
    this.toast(label ? `Undo: ${label}` : 'Nothing to undo');
  }

  private redo(): void {
    const label = this.history.redo();
    this.toast(label ? `Redo: ${label}` : 'Nothing to redo');
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    if (tool.kind === 'setpiece') {
      // A piece that can't be mirrored is placed unmirrored (M says why).
      const def = this.pieceDef(tool.piece);
      if (this.pieceMirror && def && setPieceMirrorRefusal(def)) this.pieceMirror = false;
    }
    this.renderPieceInfo();
    if (PLACING.has(tool.kind)) this.lastPlace = tool;
    if (tool.kind === 'scatter') this.lastScatter = tool.set;
    if (tool.kind === 'edge') this.edgeStyle = tool.style;
    const pane: Partial<Record<Tool['kind'], string>> = { paint: 'paint', edge: 'advanced', terrain: 'terrain' };
    this.paths.setActive(tool.kind === 'path');
    this.routes.setActive(tool.kind === 'route');
    this.measure.setActive(tool.kind === 'measure');
    // The pane holding the tool's card (props sit in Props, Nature or Vehicles; scenario pieces in several tabs).
    const card = document.querySelector<HTMLElement>(`#ed-palette .ed-pane [data-tool="${CSS.escape(toolKey(tool))}"]`);
    const at = card?.closest<HTMLElement>('.ed-pane')?.dataset.pane ?? pane[tool.kind];
    if (at) this.showPane(at);
    if (tool.kind === 'prop') this.propOpts.mount(card?.closest('.ed-pane') ?? null);
    if (tool.kind !== 'terrain') {
      this.terrainHover = null;
      this.view.setBrushRing(null, 0, 0, 0);
    }
    if (tool.kind !== 'paint' && tool.kind !== 'edge') this.hoverFace = null;
    if (tool.kind !== 'edge') this.hoverEdge = null;
    for (const b of document.querySelectorAll<HTMLElement>('[data-tool]')) {
      const t = b.dataset.tool;
      b.classList.toggle(
        'active',
        (tool.kind === 'tile' && t === `tile:${tool.tile}`) ||
          (tool.kind === 'setpiece' && t === `setpiece:${tool.piece}`) ||
          (tool.kind === 'pickup' && t === `pickup:${tool.item}`) ||
          (tool.kind === 'scenario' && t === `scenario:${tool.key}`) ||
          (tool.kind === 'edge' && t === `edge:${tool.style}`) ||
          (tool.kind === 'prop' && t === `prop:${tool.model}`) ||
          (tool.kind === 'mount' && t === `mount:${tool.model}`) ||
          (tool.kind === 'scatter' && t === `scatter:${tool.set}`) ||
          (tool.kind === 'terrain' && t === `terrain:${this.terrainBrush}`) ||
          (tool.kind === 'npc' && t === `npc:${tool.key}`) ||
          (t === 'place' && PLACING.has(tool.kind)) ||
          t === tool.kind,
      );
    }
    this.palette?.syncActive();
    $('ed-tb-place-what').textContent = this.lastPlace ? this.toolName(this.lastPlace) : '';
    const hints: Record<Tool['kind'], [string, string]> = {
      // One line per tool, in the same order: left-click · right-click (takes back what the tool does) · R · modifiers.
      select: ['Select', 'Click picks · right-click: menu · drag moves · R turns (Shift+R a little), or drag the ring round it · Shift+click adds · Alt+click one piece of a build · Del deletes'],
      erase: ['Erase', 'Click or drag deletes what is outlined in red (a whole moving build; Alt: one piece) · Ctrl+Z brings it back'],
      tile: ['Place', 'Click places the green piece · right-click removes a tile · R turns it 90° · PgUp/PgDn level'],
      setpiece: ['Place', 'Click places the set piece where it shows green (red says why not) · right-click removes a set piece · R turns it 90° · M mirrors it · PgUp/PgDn level'],
      spawn: ['Place', 'Click places a player spawn · right-click removes a spawn · R turns it 45° (Shift+R 15°)'],
      pickup: ['Place', 'Click places the pickup · right-click removes a pickup'],
      scenario: ['Place', 'Click places it (doors, walls and lasers snap to doorways) · right-click removes an object · R turns it 90° (Shift+R 15°) · L opens Logic'],
      npc: ['Place', 'Click drops the NPCs here · right-click removes them · R turns them 90° (Shift+R 15°) · soldiers, faction and orders in the inspector'],
      paint: ['Paint', 'Click or drag paints surfaces and the ground (terrain) · right-click (Shift+drag) resets them to the theme · Alt+click or I picks a style up'],
      edge: ['Walls', 'Click or drag along wall and floor edges to build them this way · right-click (Shift+drag) resets them · O cycles the style'],
      prop: ['Place', 'Click places the prop on what is under the pointer: a tabletop, a roof, the ground (Ctrl: no snap) · right-click removes a prop · R turns it 15° (Shift+R 5°) · Randomise in the Props tab'],
      mount: ['Place', 'Click places it · right-click removes a vehicle · R turns it 15° (Shift+R 5°) · players get in and out with E'],
      terrain: ['Terrain', 'Hold to sculpt or paint · Shift: the opposite (lower / raise) · [ ] brush size · T cycles brushes'],
      scatter: ['Place', 'Click or drag plants patches · right-click (Shift+drag) clears that kind of plant · [ ] brush size'],
      path: ['Paths', 'Click adds a point after the selected one (two clicks start a path) · click the first point with the last selected to join the ends · right-click or Del removes one · drag a point to move it · Shift+click a path inserts one · click another path to edit it'],
      route: ['Route', 'Click adds a point after the selected one · right-click or Del removes one · drag a point to move it · Shift+click a stretch inserts one · Esc when done'],
      measure: ['Measure', "Click two points: distance, height and slope · a third click chains a path with its total · snaps to the grid, surfaces and objects' tops (Ctrl or Alt: no snap) · right-click takes a point back · Esc clears"],
    };
    // A zipline's ends go where you click (the Route tool's hands, two points only).
    if (tool.kind === 'route' && this.routes.label === 'zipline end') hints.route = ['Zipline ends', 'Click the ground or a platform to put the far end there (click the start first to move that) · drag either end · Esc when done'];
    const [name, hint] = hints[tool.kind];
    const what = PLACING.has(tool.kind) ? `: ${this.toolName(tool)}` : tool.kind === 'edge' ? `: ${EDGE_STYLE_LABELS[tool.style]}` : '';
    const hintEl = $('ed-toolhint');
    hintEl.className = `tool-${tool.kind === 'erase' ? 'erase' : PLACING.has(tool.kind) ? 'place' : 'other'}`;
    hintEl.innerHTML = `<b>${escapeHtml(name + what)}</b> ${escapeHtml(hint)}`;
    $('ed-hint').textContent = 'Right-drag look · WASD/QE fly · wheel zoom · V select · P place · X erase · B paint · O walls · T terrain · N scatter · G paths · U measure · Esc: Select tool';
    this.updateHover();
  }

  /** What a placing tool puts down, for the toolbar and hints. */
  private toolName(tool: Tool): string {
    switch (tool.kind) {
      case 'tile':
        return coreCatalog.get(tool.tile)?.displayName ?? tool.tile;
      case 'setpiece':
        return this.pieceDef(tool.piece)?.displayName ?? tool.piece;
      case 'spawn':
        return 'Player Spawn';
      case 'pickup':
        return getItem(tool.item)?.displayName ?? 'Pickup';
      case 'scenario':
        return SCENARIO_PALETTE.find((x) => x.key === tool.key)?.label ?? 'Object';
      case 'prop':
        return getProp(tool.model)?.displayName ?? 'Prop';
      case 'mount':
        return MOUNT_DEFS[tool.model].displayName;
      case 'scatter':
        return SCATTER_SETS[tool.set].label;
      case 'npc':
        return NPC_PALETTE.find((x) => x.key === tool.key)?.label ?? 'NPC';
      default:
        return '';
    }
  }

  private setSelection(sel: Selection): void {
    this.selection = sel;
    this.updateSelectionVisuals();
    this.renderInspector();
    this.syncToolbar();
  }

  private updateSelectionVisuals(offset?: [number, number, number], bad = false): void {
    this.view.setOutlines(this.doc, this.selection.tiles, offset, bad, this.selectedPieceOutlines());
    this.view.setEntities(this.viewDoc, this.level, this.showAll, new Set(this.selection.entities));
    this.view.setGizmo(offset ? null : this.selectionCenter());
    if (offset) this.view.setRing(null, null);
    else this.ring.redraw();
  }

  /** The rotate ring's radius: clear of what is selected (its cells, the props' size), never under 2.2 m. */
  private ringRadius(): number {
    const c = this.selectionCenter();
    if (!c) return 2.2;
    const { cellSize } = this.doc.classicStructure;
    let r = 0;
    const reach = (x: number, z: number, half: number) => (r = Math.max(r, Math.hypot(x - c.x, z - c.z) + half));
    const tiles = new Set(this.selection.tiles);
    const ents = new Set(this.selection.entities);
    for (const t of this.doc.classicStructure.tiles) if (tiles.has(t.id)) reach(t.x * cellSize, t.y * cellSize, cellSize * 0.71);
    for (const e of this.doc.entities) {
      if (!ents.has(e.id)) continue;
      const size = e.kind === 'prop' ? (getProp(e.model)?.size ?? [1, 1, 1]).map((v) => v * e.scale) : 'size' in e && Array.isArray(e.size) ? e.size : [1, 1, 1];
      reach(e.position[0], e.position[2], Math.hypot(size[0]!, size[2]!) / 2);
    }
    for (const id of this.selPieces()) {
      const p = this.placementOf(id);
      const def = p && this.pieceDef(p.piece);
      if (p && def) for (const cell of setPieceFootprint(p, def)) reach(cell[0] * cellSize, cell[1] * cellSize, cellSize * 0.71);
    }
    return Math.max(2.2, r + 0.6);
  }

  /** The rotate ring's drag: the selection shown turned by `turn` (tiles and set pieces outlined where they'd land, red where they can't), or as it is. */
  private previewTurn(turn: number | null): void {
    if (turn === null) {
      this.view.setOutlines(this.doc, this.selection.tiles, undefined, false, this.selectedPieceOutlines());
      this.view.setEntities(this.viewDoc, this.level, this.showAll, new Set(this.selection.entities));
      return;
    }
    const cmd = turnByCommand(this.doc, this.selection, turn, coreCatalog, this.placeLib);
    if ('error' in cmd) {
      this.view.setOutlines(this.doc, this.selection.tiles, undefined, true, this.selectedPieceOutlines());
      return;
    }
    const after = applyCommand(this.doc, cmd);
    const pieces = this.selPieces().flatMap((id) => {
      const p = (after.setPieces ?? []).find((x) => x.id === id);
      const o = p && this.pieceOutline(p);
      return o ? [o] : [];
    });
    this.view.setOutlines(after, this.selection.tiles, undefined, false, pieces);
    const ents = cmd.kind === 'batch' ? cmd.commands.find((c) => c.kind === 'updateEntities') : cmd.kind === 'updateEntities' ? cmd : undefined;
    if (ents && this.selection.entities.length) this.view.setEntities(applyCommand(this.viewDoc, ents), this.level, this.showAll, new Set(this.selection.entities));
  }

  /** The selected set pieces' footprints and ports (a port facing a wall flagged). */
  private selectedPieceOutlines(): PieceOutline[] {
    return this.selPieces().flatMap((id) => {
      const p = this.placementOf(id);
      const o = p && this.pieceOutline(p);
      return o ? [o] : [];
    });
  }

  private setLevel(level: number, quiet = false): void {
    const next = Math.max(-16, Math.min(16, level));
    if (next === this.level) {
      if (!quiet && next !== level) this.toast(`${levelName(next)} is the build limit: levels go ${BUILD_LEVELS.max} up and ${-BUILD_LEVELS.min} down`);
      return;
    }
    this.level = next;
    if (!quiet) this.toast(`Now editing ${levelName(next)} (${next * this.doc.classicStructure.levelHeight} m)`);
    this.renderLevels();
    this.updateHover();
  }

  /** Levels with something on them: tiles occupying them and entities standing on them. */
  private levelContents(): Map<number, number> {
    const counts = new Map<number, number>();
    const bump = (l: number) => counts.set(l, (counts.get(l) ?? 0) + 1);
    for (const t of this.doc.classicStructure.tiles) for (const l of new Set((placementCells(t) ?? [[0, 0, t.z]]).map((c) => c[2]))) bump(l);
    for (const e of this.doc.entities) if (!this.onTerrain(e)) bump(this.entityLevel(e));
    for (const p of this.doc.setPieces ?? []) {
      const def = this.pieceDef(p.piece);
      for (const l of new Set(def ? setPieceFootprint(p, def).map((c) => c[2]) : [p.z])) bump(l);
    }
    return counts;
  }

  /** The level strip: every level in use plus the ones either side of the current one, top first. */
  private renderLevels(): void {
    const counts = this.levelContents();
    const used = [...counts.keys(), this.level - 1, this.level, this.level + 1, 0];
    const hi = Math.min(16, Math.max(...used));
    const lo = Math.max(-16, Math.min(...used));
    const list = $('ed-level-list');
    list.replaceChildren();
    for (let l = hi; l >= lo; l--) {
      const b = document.createElement('button');
      b.className = `lv-btn${l === this.level ? ' on' : ''}${counts.has(l) ? ' used' : ''}`;
      b.dataset.level = String(l);
      b.title = `${levelName(l)}: ${l * this.doc.classicStructure.levelHeight} m · ${counts.get(l) ?? 0} things on it`;
      b.innerHTML = `<span>${escapeHtml(levelName(l))}</span><small>${counts.get(l) ?? ''}</small>`;
      b.addEventListener('click', () => this.setLevel(l));
      list.append(b);
    }
    $('ed-level').textContent = levelName(this.level);
    $<HTMLButtonElement>('ed-level-up').disabled = this.level >= 16;
    $<HTMLButtonElement>('ed-level-down').disabled = this.level <= -16;
    $('ed-level-name-bottom').textContent = `${levelName(this.level)} · ${this.level * this.doc.classicStructure.levelHeight} m`;
  }

  /** The level an entity stands on (things a little below a floor, like props bedded into ground, count as on it). */
  private entityLevel(e: MapEntity): number {
    return Math.floor((e.position[1] + 0.5) / this.doc.classicStructure.levelHeight);
  }

  /** Standing on the terrain rather than a floor: reachable from any level. */
  private onTerrain(e: MapEntity): boolean {
    const t = this.shownGround;
    if (!t) return false;
    const y = terrainHeightAt(t, e.position[0], e.position[2]);
    return y !== null && Math.abs(e.position[1] - y) < 1;
  }

  /** Whether the pointer may act on this entity from the current level. */
  private reachable(e: MapEntity): boolean {
    if (this.showAll || this.onTerrain(e)) return true;
    const h = this.doc.classicStructure.levelHeight;
    const bottom = e.position[1];
    const top = bottom + ('size' in e && Array.isArray(e.size) ? e.size[1] : e.kind === 'prop' ? (getProp(e.model)?.size[1] ?? 1) * e.scale : 2);
    return top >= this.level * h - 0.5 && bottom < (this.level + 1) * h - 0.1;
  }

  /** Where the pointer is, outside the play area: the scenery zone (building is fine) or past the build limit. */
  private zoneNote(): string {
    const p = this.hoverPoint;
    if (!p) return '';
    const zone = buildZone(this.doc, p.x, p.z);
    if (zone === 'scenery') return 'Scenery zone, outside the playable boundary: building here is fine';
    if (zone === 'beyond') return 'Past the build limit: no tiles can be placed here';
    return '';
  }

  private placeAtHover(): void {
    if (this.tool.kind === 'setpiece' && this.hoverCell) {
      const [x, y, z] = this.hoverCell;
      this.placeSetPiece(this.tool.piece, x, y, z);
    } else if (this.tool.kind === 'tile' && this.hoverCell) {
      const [x, y, z] = this.hoverCell;
      const placed = placeTileCommand(this.doc, this.tool.tile, x, y, z, this.rotation);
      if ('error' in placed) return this.toast(`Can't place: ${placed.error}`, true);
      if (placed.floorOf) {
        // A Platform on another piece's empty upper storey: that piece's own floor there (one cell, one piece).
        const host = coreCatalog.get(placed.floorOf.tile)?.displayName ?? placed.floorOf.tile;
        if (this.run(`Floor on ${levelName(z)} of ${host}`, placed.command)) this.toast(`${host}: a floor on ${levelName(z)} here (part of the ${host}: untick “Floor on ${levelName(z)}” in its inspector to take it out)`);
        return;
      }
      const name = coreCatalog.get(this.tool.tile)?.displayName ?? this.tool.tile;
      this.run(`Place ${name}`, placed.command);
    } else if (this.tool.kind === 'spawn' && this.hoverPoint) {
      const p = this.placeSpot()!;
      const { command, id } = addSpawnCommand(p, this.spawnYaw);
      if (this.run('Place spawn', command)) this.setSelection({ tiles: [], entities: [id] });
    } else if (this.tool.kind === 'pickup' && this.hoverPoint) {
      const p = this.placeSpot()!;
      const id = newId('pickup');
      const name = getItem(this.tool.item)?.displayName ?? 'pickup';
      if (this.run(`Place ${name}`, { kind: 'addEntities', entities: [{ id, kind: 'pickup', position: p, item: this.tool.item, respawnSeconds: null }] })) this.setSelection({ tiles: [], entities: [id] });
    } else if (this.tool.kind === 'prop' && this.hoverPoint) {
      // Where the ghost shows it: on the surface under the pointer, with Randomise's next turn, size and variant.
      const { at: p, yaw, scale, variant } = this.propPlacement(this.tool.model);
      const id = newId('prop');
      const name = getProp(this.tool.model)?.displayName ?? 'prop';
      if (this.run(`Place ${name}`, { kind: 'addEntities', entities: [{ id, kind: 'prop', position: p!, model: this.tool.model, yaw, scale, solid: true, tint: null, ...(variant !== undefined ? { variant } : {}) }] })) {
        this.propOpts.placed();
        this.setSelection({ tiles: [], entities: [id] });
      }
    } else if (this.tool.kind === 'mount' && this.hoverPoint) {
      const p = this.placeSpot()!;
      const id = newId('mount');
      const def = MOUNT_DEFS[this.tool.model];
      if (this.run(`Place ${def.displayName}`, { kind: 'addEntities', entities: [{ id, kind: 'mount', position: p, model: this.tool.model, yaw: this.propYaw, faction: null, respawnSeconds: null }] })) this.setSelection({ tiles: [], entities: [id] });
    } else if (this.tool.kind === 'scenario' && this.hoverPoint) {
      const { p, yaw } = this.scenarioSpot(this.tool.key)!;
      const placed = newScenarioEntities(this.tool.key, p, yaw, this.doc);
      const entity = placed[placed.length - 1]!;
      const label = SCENARIO_PALETTE.find((x) => x.key === (this.tool as { key: string }).key)?.label ?? 'object';
      if (this.run(`Place ${label}`, { kind: 'addEntities', entities: placed })) this.setSelection({ tiles: [], entities: [entity.id] });
    } else if (this.tool.kind === 'npc' && this.hoverPoint) {
      const r = placeNpcCommand(this.doc, this.tool.key, this.placeSpot()!, this.scenarioYaw);
      if ('error' in r) return this.toast(r.error, true);
      if (this.run(`Place ${r.label}`, r.command)) this.setSelection({ tiles: [], entities: [r.id] });
    }
  }

  /** A set piece in a few words (hover card, inspector): its size and levels, its look, its turn and mirror, its ports. */
  private pieceLines(def: SetPieceDefinition, p: Pick<SetPiecePlacement, 'rotation' | 'mirror' | 'pack'>): string[] {
    const span = (i: 0 | 1) => Math.max(...def.footprint.cells.map((c) => c[i])) - Math.min(...def.footprint.cells.map((c) => c[i])) + 1;
    const levels = def.footprint.levels[1] - def.footprint.levels[0] + 1;
    const theme = this.doc.classicStructure.theme;
    const pack = placementPack(p, theme, this.setPieceLib);
    const look = pack ? `${pack.displayName}${p.pack ? '' : " (the map theme's)"}` : `${coreThemes.get(theme)?.displayName ?? theme} (theme)`;
    return [`${span(0)} × ${span(1)} cells · ${levels} level${levels === 1 ? '' : 's'}`, `Look: ${look}`, `Turned ${p.rotation * 90}°${p.mirror ? ' · mirrored' : ''} · ${def.ports.length} port${def.ports.length === 1 ? '' : 's'}`];
  }

  /** The look a set piece is placed in: the tool's (a role pack), or none (the map theme's). */
  private lookFor(): string {
    return this.pieceLook && this.setPieceLib.packs.has(this.pieceLook) ? this.pieceLook : '';
  }

  /** Place a set piece as one, at anchor cell (x, y) on level z, turned (R), mirrored (M) and in the tool's look. */
  private placeSetPiece(piece: string, x: number, y: number, z: number): void {
    const def = this.pieceDef(piece);
    if (!def) return this.toast(`Unknown set piece ${piece}`, true);
    const look = this.lookFor();
    const r = placeSetPieceCommand(this.doc, piece, x, y, z, this.rotation, { mirror: this.pieceMirror, ...(look ? { pack: look } : {}), library: this.placeLib });
    if ('error' in r) return this.toast(`Can't place ${def.displayName}: ${r.error}`, true);
    // A piece of the player's own goes into the map with it: the map carries its definition, so it plays anywhere.
    const own = this.myPieces.get(piece);
    const inMap = this.doc.setPieceDefs?.find((d) => d.id === piece);
    const defCmd = own && JSON.stringify(inMap ?? null) !== JSON.stringify(own) ? addSetPieceDefCommand(this.doc, own) : null;
    if (defCmd && 'error' in defCmd) return this.toast(defCmd.error, true);
    if (this.run(`Place ${def.displayName}`, defCmd ? { kind: 'batch', commands: [defCmd, r.command] } : r.command)) {
      this.setSelection({ tiles: [], entities: [], setPieces: [r.placement.id] });
      if (inMap && defCmd) this.toast(`Placed ${def.displayName}; this map's copy of it now matches your library's`);
    }
  }

  /** M: mirror the set piece being placed, or the selected set pieces (one undo step). A piece that can't be says why. */
  private mirror(): void {
    if (this.tool.kind === 'setpiece') {
      const def = this.pieceDef(this.tool.piece);
      if (!def) return;
      const why = setPieceMirrorRefusal(def);
      if (why) return this.toast(why, true);
      this.pieceMirror = !this.pieceMirror;
      this.toast(`${def.displayName} ${this.pieceMirror ? 'mirrored (east and west swapped)' : 'not mirrored'}`);
      this.renderPieceInfo();
      this.updateHover();
      return;
    }
    const ids = this.selPieces();
    if (!ids.length) return this.toast('M mirrors a set piece: select one, or pick one in the Set pieces tab', true);
    let doc = this.doc;
    const commands: EditCommand[] = [];
    for (const id of ids) {
      const p = doc.setPieces?.find((x) => x.id === id);
      const def = p && this.pieceDef(p.piece);
      if (!p || !def) continue;
      const why = setPieceMirrorRefusal(def);
      if (why) return this.toast(why, true);
      const cmd = mirrorSetPieceCommand(doc, id);
      if ('error' in cmd) return this.toast(`Can't mirror: ${cmd.error}`, true);
      commands.push(cmd);
      doc = applyCommand(doc, cmd);
    }
    this.run(commands.length > 1 ? `Mirror ${commands.length} set pieces` : 'Mirror', { kind: 'batch', commands });
  }

  /** Explode to tiles: the placement becomes its parts, ordinary pieces to edit (one undo step), and they are selected. */
  private explode(id: string): void {
    const p = this.placementOf(id);
    const name = (p && this.pieceDef(p.piece)?.displayName) ?? 'set piece';
    const r = explodeSetPieceCommand(this.doc, id);
    if ('error' in r) return this.toast(`Can't explode: ${r.error}`, true);
    if (!this.run(`Explode ${name}`, r.command)) return;
    this.setSelection(r.selection);
    this.toast(`${name} exploded into ${r.selection.tiles.length + r.selection.entities.length} ordinary parts · Ctrl+Z puts it back`);
  }

  /** Where the Scenario tool puts an object, and its facing: on the level's floor, or in the doorway for doors and the like. */
  private scenarioSpot(key: ScenarioPaletteKey): { p: [number, number, number]; yaw: number } | null {
    if (!this.hoverPoint) return null;
    // Game modes' markers stand on the ground under the pointer, like spawns and pickups (a Breakthrough spawn group on a
    // hill went in at the level's height, under the hill); the rest go on the level being edited.
    const onGround = this.hoverOnTerrain && /^(spawn:|objective:|sector$|flag$|hill$|bombsite$|hostage$|rescue$)/.test(key);
    const y = onGround ? Math.round(this.hoverPoint.y * 100) / 100 : this.level * this.doc.classicStructure.levelHeight;
    if (snapsToDoorway(key)) {
      const d = snapToDoorway(this.hoverPoint.x, this.hoverPoint.z, this.doc.classicStructure.cellSize);
      return { p: [d.x, y, d.z], yaw: d.yaw };
    }
    return { p: [snap(this.hoverPoint.x, this.snapStep(0.5)), y, snap(this.hoverPoint.z, this.snapStep(0.5))], yaw: this.scenarioYaw };
  }

  /** What the Scenario or NPC tool would place: made once per object, facing and edit (factions, sizes), then moved with the pointer. */
  private objectGhostCache: { key: string; at: [number, number, number]; entities: MapEntity[] } | null = null;

  private objectGhost(): { key: string; entities: MapEntity[] } | null {
    const t = this.tool;
    const spot = t.kind === 'scenario' ? this.scenarioSpot(t.key) : t.kind === 'npc' && this.hoverPoint ? { p: this.placeSpot()!, yaw: this.scenarioYaw } : null;
    if (!spot || (t.kind !== 'scenario' && t.kind !== 'npc')) return null;
    const key = `${t.kind}:${t.key}:${spot.yaw}:${this.history.revision}`;
    let c = this.objectGhostCache;
    if (c?.key !== key) {
      const entities = t.kind === 'scenario' ? newScenarioEntities(t.key, spot.p, spot.yaw, this.doc) : addedEntities(placeNpcCommand(this.doc, t.key, spot.p, spot.yaw));
      c = this.objectGhostCache = { key, at: spot.p, entities };
    }
    const [dx, dy, dz] = [spot.p[0] - c.at[0], spot.p[1] - c.at[1], spot.p[2] - c.at[2]];
    return { key, entities: c.entities.map((e) => ({ ...e, position: [e.position[0] + dx, e.position[1] + dy, e.position[2] + dz] }) as MapEntity) };
  }

  /** Erase what's under the pointer, picked the way Select picks it: a whole moving build (Alt: just that piece). */
  private eraseAtHover(single = false): void {
    const hit = this.pick();
    if (!hit) return this.toast(`Nothing to erase here on ${levelName(this.level)}`, true);
    const group = hit.kind === 'entity' && !single ? moverGroupOf(this.doc, hit.id) : null;
    const sel: Selection = hit.kind === 'tile' ? { tiles: [hit.id], entities: [] } : hit.kind === 'setpiece' ? { tiles: [], entities: [], setPieces: [hit.id] } : { tiles: [], entities: group ?? [hit.id] };
    const name = group && group.length > 1 ? 'moving build' : this.targetName(hit);
    if (this.run(`Erase ${name}`, deleteCommand(this.doc, sel))) this.toast(`Erased ${name} · Ctrl+Z to undo`);
  }

  /**
   * Right-click, one rule for every tool: it takes back what that tool does, where you click.
   * Paint resets the surface, Walls resets the wall, Scatter clears its plants, Road and Paths remove
   * a point or path, and a placing tool removes a thing of its own kind (Erase removes anything).
   * With Select it opens the selection menu.
   */
  private secondaryClick(x: number, y: number, alt: boolean): void {
    const tool = this.tool;
    switch (tool.kind) {
      case 'select':
        return this.openContextMenu(x, y);
      case 'paint':
        return this.paintAtHover(true);
      case 'edge':
        return this.edgeAtHover('auto');
      case 'scatter':
        return this.scatterAtHover(tool.set, true);
      case 'path':
        return this.paths.erase(this.hoverPoint);
      case 'route':
        return this.routes.erase(this.hoverPoint);
      case 'measure':
        this.measure.back();
        return this.updateHover();
      case 'terrain':
        return this.toast('Terrain: Shift-drag does the opposite (lower, or raise)');
      case 'erase':
        return;
    }
    const hit = this.pick();
    const e = hit?.kind === 'entity' ? this.doc.entities.find((x) => x.id === hit.id) : undefined;
    const mine =
      !!hit &&
      (tool.kind === 'tile'
        ? hit.kind === 'tile'
        : tool.kind === 'setpiece'
          ? hit.kind === 'setpiece'
          : tool.kind === 'spawn' || tool.kind === 'pickup' || tool.kind === 'prop' || tool.kind === 'mount'
            ? e?.kind === tool.kind
            : hit.kind === 'entity');
    if (!hit) return this.toast(`Nothing to remove here on ${levelName(this.level)}`, true);
    if (!mine) return this.toast(`Right-click removes what this tool places; ${this.targetName(hit)} is something else (Erase, X, removes anything)`, true);
    this.eraseAtHover(alt);
  }

  /** The selection menu (right-click with Select): picks what is under the pointer first if it isn't selected. */
  private openContextMenu(x: number, y: number): void {
    const hit = this.pick();
    if (hit) {
      const ids = (hit.kind === 'entity' && moverGroupOf(this.doc, hit.id)) || [hit.id];
      const now = hit.kind === 'tile' ? this.selection.tiles : hit.kind === 'setpiece' ? this.selPieces() : this.selection.entities;
      if (!ids.every((id) => now.includes(id))) this.setSelection(hit.kind === 'tile' ? { tiles: [hit.id], entities: [] } : hit.kind === 'setpiece' ? { tiles: [], entities: [], setPieces: [hit.id] } : { tiles: [], entities: ids });
    }
    const has = this.selCount() > 0;
    const pieces = this.selPieces();
    document.getElementById('ed-ctx')?.remove();
    const menu = document.createElement('div');
    menu.id = 'ed-ctx';
    menu.className = 'ed-ctx';
    menu.setAttribute('role', 'menu');
    const item = (label: string, keys: string, run: () => void, enabled = has) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.disabled = !enabled;
      b.innerHTML = `<span>${escapeHtml(label)}</span><kbd>${escapeHtml(keys)}</kbd>`;
      b.addEventListener('click', () => {
        close();
        run();
      });
      menu.append(b);
    };
    const close = () => {
      menu.remove();
      window.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('keydown', onKey, true);
    };
    const outside = (ev: PointerEvent) => {
      if (!menu.contains(ev.target as Node)) close();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        close();
      }
    };
    item('Rotate', 'R', () => this.rotate());
    item('Rotate a little', 'Shift+R', () => this.rotate(true));
    if (pieces.length) item('Mirror', 'M', () => this.mirror());
    item('Duplicate', 'Ctrl+D', () => this.duplicate());
    item('Focus', 'F', () => this.focusSelection());
    item('Delete', 'Del', () => this.deleteSelection());
    if (pieces.length === 1 && this.selCount() === 1) item('Explode to tiles', '', () => this.explode(pieces[0]!));
    item('Save as set piece…', '', () => this.saveSelectionDialog());
    item('Select none', 'Esc', () => this.setSelection(emptySelection()));
    $('editor').append(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = `${Math.min(x, innerWidth - r.width - 8)}px`;
    menu.style.top = `${Math.min(y, innerHeight - r.height - 8)}px`;
    window.addEventListener('pointerdown', outside, true);
    window.addEventListener('keydown', onKey, true);
    (menu.querySelector('button:not([disabled])') as HTMLButtonElement | null)?.focus();
  }

  /** A drag with Paint, Walls, Scatter or Erase: what it last touched, so each surface, wall or thing is done once. */
  private brush: { invert: boolean; alt: boolean; key: string | null; at: { x: number; z: number } | null } | null = null;

  /** Apply the brush tool under the pointer if it has moved onto something new (always on the first press). */
  private brushAtHover(first: boolean): void {
    const b = this.brush;
    const tool = this.tool;
    if (!b) return;
    if (tool.kind === 'paint' && this.paintGround && !this.hoverFace) {
      const p = this.paintGround;
      if (b.at && Math.hypot(p.x - b.at.x, p.z - b.at.z) < this.brushRadius * 0.5) return;
      b.at = { x: p.x, z: p.z };
      b.key = null;
      if (!b.invert) this.paintGroundAtHover();
      return;
    }
    if (tool.kind === 'paint') {
      const t = this.paintTarget();
      const key = t ? `${t.tile.id}:${t.slot}` : null;
      if (!key || key === b.key) return;
      b.key = key;
      return this.paintAtHover(b.invert);
    }
    if (tool.kind === 'edge') {
      const key = this.hoverEdge ? JSON.stringify(this.hoverEdge) : null;
      if (!key || key === b.key) return;
      b.key = key;
      return this.edgeAtHover(b.invert ? 'auto' : tool.style);
    }
    if (tool.kind === 'scatter') {
      const p = this.hoverPoint;
      if (!p || (b.at && Math.hypot(p.x - b.at.x, p.z - b.at.z) < this.brushRadius * 0.8)) return;
      b.at = { x: p.x, z: p.z };
      return this.scatterAtHover(tool.set, b.invert || b.alt, !first);
    }
    if (tool.kind === 'erase') {
      const hit = this.pick();
      if (!hit && !first) return;
      if (hit && hit.id === b.key) return;
      b.key = hit?.id ?? null;
      this.eraseAtHover(b.alt);
    }
  }

  /** Display name of a pick target. */
  private targetName(hit: Hit): string {
    if (hit.kind === 'setpiece') {
      const p = this.placementOf(hit.id);
      return (p && this.pieceDef(p.piece)?.displayName) ?? 'set piece';
    }
    if (hit.kind === 'tile') {
      const t = this.doc.classicStructure.tiles.find((x) => x.id === hit.id);
      return coreCatalog.get(t?.tile ?? '')?.displayName ?? 'tile';
    }
    const e = this.doc.entities.find((x) => x.id === hit.id);
    if (!e) return 'item';
    return e.kind === 'spawn' ? 'Player Spawn' : e.kind === 'pickup' ? (getItem(e.item)?.displayName ?? 'pickup') : entityLabel(this.doc, e);
  }

  /** Tile and surface slot under the cursor in paint mode. */
  private paintTarget(): { tile: MapDocument['classicStructure']['tiles'][number]; slot: SurfaceSlot } | null {
    const hit = this.hoverFace;
    if (!hit) return null;
    const tile = this.doc.classicStructure.tiles.find((t) => t.id === hit.box.sourceId);
    return tile ? { tile, slot: faceSlot(hit.box, hit.normal) } : null;
  }

  /**
   * The ground Paint lays on the terrain: the terrain layer closest to the brush's material (a style pack's Packed
   * Snow paints snow, Shingle gravel: terrainMaterialFor), else the Terrain tab's ground. It used to fall back to
   * the Terrain tab's ground for every pack ground, so painting Packed Snow laid dirt or grass.
   */
  private get groundPaint(): TerrainMaterial {
    return terrainMaterialFor(this.paintStyle.material) ?? this.terrainMaterial;
  }

  /** Paint the terrain under the pointer (a brush of the Terrain tab's radius). */
  private paintGroundAtHover(): void {
    const t = this.doc.terrain;
    const p = this.paintGround;
    if (!t || !p) return;
    const m = this.groundPaint;
    const after = applyBrush(t, { brush: 'paint', x: p.x, z: p.z, radius: this.brushRadius, strength: 1, material: m });
    if (after.materials.every((v, i) => v === t.materials[i])) return;
    this.run(`Paint ${TERRAIN_MATERIAL_LABELS[m].toLowerCase()} ground`, { kind: 'setTerrain', before: t, after });
  }

  private paintAtHover(clear: boolean): void {
    const target = this.paintTarget();
    if (!target) return;
    const scopeLabel: Record<PaintScope, string> = { surface: '', sameType: ' (all of this piece)', level: ' (whole level)', all: ' (whole map)' };
    const label = `${clear ? 'Reset' : 'Paint'} ${SURFACE_SLOT_LABELS[target.slot].toLowerCase()}${scopeLabel[this.paintScope]}`;
    this.run(label, paintCommand(this.doc, target.tile.id, target.slot, clear ? null : this.paintStyle, this.paintScope));
  }

  /** Glass the wall tool puts in windows, twin windows and firing slits (none, breakable or reinforced). */
  private edgeGlass: GlassKind | null = null;

  /** Wall tool: build the hovered cell side in the given style (windows get the chosen glass, or none). */
  private edgeAtHover(style: EdgeStyle): void {
    const target = this.hoverEdge;
    if (!target) return;
    this.setEdge(target, style, this.edgeGlass);
  }

  /** Build a side in `style`, with `glass` in its window (the Walls tool and the inspector alike). */
  private setEdge(target: EdgeTarget, style: EdgeStyle, glass: GlassKind | null): void {
    const cmd = setEdgeCommand(this.doc, target, style);
    if ('error' in cmd) return this.toast(cmd.error, true);
    // Glass goes with the window: set (or clear) it in the same undo step.
    const glazed = GLASS_EDGES.has(style as never) ? glass : null;
    const glassCmd = setEdgeGlassCommand(applyCommand(this.doc, cmd), target, glazed);
    const label = style === 'auto' ? 'Reset wall' : `Wall: ${EDGE_STYLE_LABELS[style]}${glazed ? ` (${GLASS_KIND_LABELS[glazed].toLowerCase()} glass)` : ''}`;
    const had = edgeGlassAt(this.doc, target);
    this.run(label, 'error' in glassCmd || (!glazed && !had) ? cmd : { kind: 'batch', commands: [cmd, glassCmd] });
  }

  /** Eyedropper: copy the hovered surface's effective style into the brush. */
  private pickStyleAtHover(): void {
    const target = this.paintTarget();
    if (!target) return;
    const s = resolveSurface(this.doc, target.tile, target.slot);
    this.paintStyle = { material: s.material.id, tint: s.tint };
    this.syncPaintUi();
    this.toast(`Picked ${s.material.displayName}${s.tint ? ` tinted ${s.tint}` : ''}`);
  }

  /**
   * What is under the cursor, for Select and Erase. The nearest thing the
   * pointer ray actually hits wins: an entity's drawn model, a free block or
   * water, or a tile's walls and floors. Tiles must be on the current level;
   * entities on it, or standing on the terrain (any level). Failing a hit, an
   * entity near the pointer, then the tile in the hovered cell.
   */
  private pick(): Hit | null {
    // The map as drawn: a set piece's parts (tiles and entities of the expansion) pick their placement, as one.
    const view = this.viewDoc;
    const partOf = this.expansion.partOf;
    const whole = (h: { kind: 'tile' | 'entity'; id: string }): Hit => {
      const placement = partOf.get(h.id);
      return placement ? { kind: 'setpiece', id: placement } : { kind: h.kind, id: h.id };
    };
    const byId = new Map(view.entities.map((e) => [e.id, e]));
    const ok = (e: MapEntity | undefined): e is MapEntity => !!e && this.reachable(e) && this.view.entityShown(e.id);
    const tilesHere = new Set(view.classicStructure.tiles.filter((t) => (placementCells(t) ?? []).some((c) => c[2] === this.level)).map((t) => t.id));
    let best: { kind: 'tile' | 'entity'; id: string; d: number } | null = null;
    const ray = this.ray;
    if (ray) {
      const ent = this.view.pickEntities(ray.origin, ray.dir).find((h) => ok(byId.get(h.id)));
      if (ent) best = { kind: 'entity', id: ent.id, d: ent.distance };
      const boxes = this.visibleBoxes.filter((b) => b.kind !== 'barrier' && (tilesHere.has(b.sourceId) || ok(byId.get(b.sourceId))));
      const hit = raycastBoxes(ray.origin, ray.dir, boxes);
      // A model a hair behind the box it stands in still counts (crates in a doorway, props on a floor).
      if (hit && (!best || hit.distance < best.d - 0.05)) best = { kind: tilesHere.has(hit.box.sourceId) ? 'tile' : 'entity', id: hit.box.sourceId, d: hit.distance };
    }
    if (best?.kind === 'entity') return whole(best);
    const p = this.hoverPoint;
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
    const cell = this.hoverCell;
    if (!cell) return null;
    const tile = tileAt(view, cell[0], cell[1], this.level);
    if (tile) return whole({ kind: 'tile', id: tile.id });
    // A cell a set piece claims (its footprint holds every level of it), even where none of its parts stands.
    const held = this.expansion.footprints;
    for (const [id, cells] of held) if (cells.some((c) => c[0] === cell[0] && c[1] === cell[1] && c[2] === this.level)) return { kind: 'setpiece', id };
    return null;
  }

  /** R turns what you are placing, or the selection, by that kind's step (yawStep); Shift+R by the finer step. */
  private rotate(fine = false): void {
    const deg = (yaw: number) => `Facing ${Math.round((yaw * 180) / Math.PI)}°`;
    if (this.tool.kind === 'tile' || this.tool.kind === 'setpiece') {
      if (fine) this.toast(`${this.tool.kind === 'tile' ? 'Tiles' : 'Set pieces'} turn in quarter turns`);
      this.rotation = ((this.rotation + 1) % 4) as Rotation;
      this.toast(`${this.toolName(this.tool)} turned to ${this.rotation * 90}°`);
      this.renderPieceInfo();
      this.updateHover();
    } else if (this.tool.kind === 'spawn') {
      this.spawnYaw = normalizeYaw(this.spawnYaw + yawStep('spawn', fine));
      this.toast(deg(this.spawnYaw));
    } else if (this.tool.kind === 'prop' || this.tool.kind === 'mount') {
      this.propYaw = normalizeYaw(this.propYaw + yawStep(this.tool.kind, fine));
      this.toast(deg(this.propYaw));
    } else if (this.tool.kind === 'npc' || this.tool.kind === 'scenario') {
      // Doors, traps, pads, ladders, NPCs and the rest: quarter turns, Shift 15°.
      this.scenarioYaw = normalizeYaw(this.scenarioYaw + yawStep('door', fine));
      this.toast(deg(this.scenarioYaw));
    } else if (this.selCount()) {
      this.run(fine ? 'Rotate a little' : 'Rotate', rotateCommand(this.doc, this.selection, undefined, { fine }));
    } else {
      this.toast('R turns the selection, or the piece you are placing (Shift+R: a finer step): select something first', true);
    }
  }

  private nudge(dx: number, dy: number, dz: number): void {
    if (!this.selCount()) return;
    // Tiles and set pieces move by whole cells (and things with them); things alone by half a metre.
    if (this.selection.tiles.length || this.selPieces().length || dz !== 0) {
      this.run('Move', moveCommand(this.doc, this.selection, dx, dy, dz));
      if (dz) this.setLevel(this.level + dz);
    } else {
      this.run('Move', moveEntitiesCommand(this.doc, this.selection.entities, dx * 0.5, 0, dy * 0.5));
    }
  }

  private deleteSelection(): void {
    const n = this.selCount();
    if (!n) return this.toast('Nothing selected: click something with Select (V) first, or use Erase (X)', true);
    if (this.run(n > 1 ? `Delete ${n} items` : 'Delete', deleteCommand(this.doc, this.selection))) this.setSelection(emptySelection());
  }

  private duplicate(): void {
    const r = duplicateCommand(this.doc, this.selection);
    if ('error' in r) return this.toast(`Can't duplicate: ${r.error}`, true);
    if (this.run('Duplicate', r.command)) this.setSelection(r.selection);
  }

  /**
   * One placement rule for spawns, pickups, vehicles and NPCs: on the terrain where the pointer
   * meets it, else on the floor of the level being edited; snapped to the snap setting (Ctrl or
   * Shift: free).
   */
  private placeSpot(step = 0.5): [number, number, number] | null {
    const h = this.hoverPoint;
    if (!h) return null;
    const y = this.hoverOnTerrain ? Math.round(h.y * 100) / 100 : this.level * this.doc.classicStructure.levelHeight;
    return [snap(h.x, this.snapStep(step)), y, snap(h.z, this.snapStep(step))];
  }

  /** The prop tool's next placement of `model`: where (propSpot) and, with Randomise, its turn, size and variant. */
  private propPlacement(model: string): { at: [number, number, number] | null; yaw: number; scale: number; variant?: number } {
    const roll = this.propOpts.next(model, this.propYaw);
    return { at: this.propSpot(model, roll.yaw, roll.scale), yaw: roll.yaw, scale: roll.scale, ...(roll.variant !== undefined ? { variant: roll.variant } : {}) };
  }

  /**
   * Where a prop of `model` goes under the pointer: on whatever the pointer is over (a tabletop, a roof, a ledge, the
   * ground: surfaceSnap's propDrop against the map as drawn and the ground as shown), its x and z snapped (Ctrl or
   * Shift: free). On the ground it is bedded into the document's own ground (the view re-beds it on the ground as
   * shown). Over nothing, on the level being edited, as before.
   */
  private propSpot(model: string, yaw = this.propYaw, scale = 1): [number, number, number] | null {
    if (!this.hoverPoint) return null;
    const free = this.freePlacing();
    const step = this.snapStep(0.25);
    const snapXZ = (v: number) => (free ? Math.round(v * 100) / 100 : snap(v, step));
    const ray = this.ray;
    const def = getProp(model);
    const drop = ray ? propDrop(ray.origin, ray.dir, this.surfaceBoxes(), this.shownGround, { model, yaw, scale, ...(def ? { size: def.size } : {}) }, snapXZ) : null;
    // On an upper level, the level's own plane where it is nearer (placing over open air up there, as before).
    const plane = this.level > 0 && !this.hoverOnTerrain && ray ? Math.hypot(this.hoverPoint.x - ray.origin.x, this.hoverPoint.y - ray.origin.y, this.hoverPoint.z - ray.origin.z) : Infinity;
    if (drop && drop.hit.distance <= plane) {
      const p = drop.position;
      if (drop.on === 'ground' && this.doc.terrain) p[1] = settledPropY(this.doc.terrain, { model, position: p, yaw, scale }) ?? p[1];
      return p;
    }
    const p: [number, number, number] = [snapXZ(this.hoverPoint.x), this.level * this.doc.classicStructure.levelHeight, snapXZ(this.hoverPoint.z)];
    if (this.hoverOnTerrain && this.doc.terrain) p[1] = settledPropY(this.doc.terrain, { model, position: p, yaw, scale }) ?? p[1];
    return p;
  }

  /** What props and the measure tool land on: the map as drawn, with its blocks and solid props. */
  private surfaceBoxes(): WorldBox[] {
    return this.surfaces.get(this.viewDoc, this.visibleBoxes, this.level, this.showAll);
  }

  /** The measure tool's point under the pointer: snapped to the grid, surfaces and objects' tops (Ctrl or Alt: free). */
  private measurePointAtHover(): MeasurePoint | null {
    const ray = this.ray;
    if (!ray) return null;
    const boxes = this.surfaceBoxes();
    const hit = surfaceHit(ray.origin, ray.dir, boxes, this.shownGround);
    const free = ['ControlLeft', 'ControlRight', 'MetaLeft', 'AltLeft', 'AltRight'].some((k) => this.keys.has(k));
    if (!hit) {
      const p = this.hoverPoint;
      return p ? { at: { x: p.x, y: p.y, z: p.z }, snapped: 'free' } : null;
    }
    return snapMeasurePoint(hit, boxes, this.shownGround, this.snapStep(0.5), free, (id) => this.surfaces.objects.has(id));
  }

  /** Home: the starting overview of the level being edited. */
  private resetView(): void {
    this.view.resetView({ x: 0, y: this.level * this.doc.classicStructure.levelHeight, z: 0 });
    this.toast('View reset (Home)');
  }

  private focusSelection(): void {
    const target = this.selectionCenter();
    if (target) this.view.focus(target);
  }

  private selectionCenter(): Vec3 | null {
    const { cellSize, levelHeight } = this.doc.classicStructure;
    const pts: Vec3[] = [];
    for (const t of this.doc.classicStructure.tiles) if (this.selection.tiles.includes(t.id)) pts.push({ x: t.x * cellSize, y: t.z * levelHeight, z: t.y * cellSize });
    for (const e of this.doc.entities) if (this.selection.entities.includes(e.id)) pts.push({ x: e.position[0], y: e.position[1], z: e.position[2] });
    // A set piece: the middle of its footprint, on its lowest level.
    for (const id of this.selPieces()) {
      const p = this.placementOf(id);
      const def = p && this.pieceDef(p.piece);
      if (!p || !def) continue;
      const cells = setPieceFootprint(p, def);
      const n = cells.length;
      pts.push({ x: (cells.reduce((s, c) => s + c[0], 0) / n) * cellSize, y: Math.min(...cells.map((c) => c[2])) * levelHeight, z: (cells.reduce((s, c) => s + c[1], 0) / n) * cellSize });
    }
    if (!pts.length) return null;
    const n = pts.length;
    return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n, z: pts.reduce((s, p) => s + p.z, 0) / n };
  }

  private focusEntity(id: string): void {
    this.focusIssue({ severity: 'suggestion', code: 'focus', message: '', targetId: id });
  }

  /** Select and frame the object a validation issue points at (or open the logic item). */
  private focusIssue(issue: ValidationIssue): void {
    if (!issue.targetId) return;
    const tile = this.doc.classicStructure.tiles.find((t) => t.id === issue.targetId);
    const entity = this.doc.entities.find((e) => e.id === issue.targetId);
    // A set piece, or one of its parts (the overlaps check names parts): the placement.
    const piece = this.placementOf(this.expansion.partOf.get(issue.targetId) ?? issue.targetId);
    const { logic } = this.doc;
    if (!tile && !entity && !piece && [...logic.rules, ...logic.objectives, ...logic.variables, ...logic.timers].some((x) => x.id === issue.targetId)) {
      this.logic.open(issue.targetId);
      return;
    }
    if (piece) {
      this.setLevel(piece.z);
      this.setSelection({ tiles: [], entities: [], setPieces: [piece.id] });
    } else if (tile) {
      this.setLevel(tile.z);
      this.setSelection({ tiles: [tile.id], entities: [] });
    } else if (entity) {
      this.setLevel(Math.floor((entity.position[1] + 0.01) / this.doc.classicStructure.levelHeight));
      this.setSelection({ tiles: [], entities: [entity.id] });
    } else return;
    this.setTool({ kind: 'select' });
    this.focusSelection();
  }

  // ---------------------------------------------------------------- hover / drag

  private updatePointer(clientX: number, clientY: number): void {
    const { cellSize, levelHeight } = this.doc.classicStructure;
    this.ray = this.view.pointerRay(clientX, clientY);
    this.pointerAt = { x: clientX, y: clientY };
    this.hoverPoint = this.view.pickPlane(clientX, clientY, this.level * levelHeight);
    // The ground as shown (kept under the floors), not the document's own: under a floor that stands on a hill, the
    // ground as made is inside the floor, out of sight.
    const t = this.shownGround;
    this.terrainHover = null;
    this.hoverOnTerrain = false;
    let ground: { at: Vec3; distance: number } | null = null;
    if (t) {
      const ray = this.view.pointerRay(clientX, clientY);
      const hit = ray ? terrainRaycast(t, ray.origin, ray.dir) : null;
      if (hit && ray) ground = { at: hit, distance: Math.hypot(hit.x - ray.origin.x, hit.y - ray.origin.y, hit.z - ray.origin.z) };
      if (hit && this.tool.kind === 'terrain') this.terrainHover = hit;
      // Spawns, pickups and props stand on the ground where it is nearer than the level plane.
      // (Tiles and set pieces go on the grid: the level being edited, not the ground.)
      if (hit && ray && this.tool.kind !== 'tile' && this.tool.kind !== 'setpiece' && this.tool.kind !== 'terrain') {
        const dist = (p: Vec3) => Math.hypot(p.x - ray.origin.x, p.y - ray.origin.y, p.z - ray.origin.z);
        if (!this.hoverPoint || dist(hit) < dist(this.hoverPoint)) {
          this.hoverPoint = hit;
          this.hoverOnTerrain = true;
        }
      }
    }
    this.hoverCell = this.hoverPoint ? [Math.round(this.hoverPoint.x / cellSize), Math.round(this.hoverPoint.z / cellSize), this.level] : null;
    if (this.tool.kind === 'path') this.paths.hover(this.hoverPoint);
    if (this.tool.kind === 'measure') this.measure.setHover(this.measurePointAtHover());
    this.paintGround = null;
    if (this.tool.kind === 'paint' || this.tool.kind === 'edge') {
      const ray = this.view.pointerRay(clientX, clientY);
      // Only what is drawn: the invisible walls round the map (60 m high) would catch the ray first from far out.
      if (this.paintable.from !== this.visibleBoxes) {
        const boxes = this.visibleBoxes.filter((b) => b.kind !== 'barrier');
        const tiles = new Set(this.doc.classicStructure.tiles.map((t) => t.id));
        this.paintable = { from: this.visibleBoxes, boxes, tiles: boxes.filter((b) => tiles.has(b.sourceId)) };
      }
      // Paint paints tiles' surfaces (a rock or crate in the way is not one: the ground under it is what it paints).
      const face = ray ? raycastBoxes(ray.origin, ray.dir, this.tool.kind === 'paint' ? this.paintable.tiles : this.paintable.boxes) : null;
      // The ground in front of a surface hides it; with nothing nearer, the ground is what Paint paints.
      this.hoverFace = face && (!ground || face.distance < ground.distance) ? face : null;
      if (this.tool.kind === 'paint' && !this.hoverFace && ground) this.paintGround = ground.at;
    } else this.hoverFace = null;
    this.hoverEdge = null;
    if (this.tool.kind === 'edge' && this.hoverFace) {
      const ray = this.view.pointerRay(clientX, clientY)!;
      const d = this.hoverFace.distance;
      const point: [number, number, number] = [ray.origin.x + ray.dir.x * d, ray.origin.y + ray.dir.y * d, ray.origin.z + ray.dir.z * d];
      this.hoverEdge = edgeTargetAt(this.doc, point, this.hoverFace.normal);
    }
    this.updateHover();
  }

  private updateHover(): void {
    this.updateHoverTarget();
    this.updateHoverCard();
  }

  /**
   * Hover card next to the pointer (reference board): the piece about to be
   * placed, or what Select / Erase would act on, with its size, theme and connectors.
   */
  private updateHoverCard(): void {
    const tip = $('ed-tip');
    const at = this.pointerAt;
    const lines: string[] = [];
    /** Lines in red (why it can't be placed) or amber (a warning), by index in `lines`. */
    const marks = new Map<number, 'bad' | 'warn'>();
    let title = '';
    let tone = '';
    const themeName = coreThemes.get(this.doc.classicStructure.theme)?.displayName ?? this.doc.classicStructure.theme;
    const tileLines = (def: TileDefinition, rotation: number) => {
      const span = (i: 0 | 1 | 2) => Math.max(...def.cells.map((c) => c[i])) - Math.min(...def.cells.map((c) => c[i])) + 1;
      return [`Size: ${span(0)} × ${span(1)} × ${span(2)}`, `Theme: ${themeName}`, `Connectors: ${def.ports.length}`, `Rotation: ${rotation * 90}°`];
    };
    if (at && !this.drag && !this.looking) {
      const g = this.pieceHover;
      if (this.tool.kind === 'setpiece' && this.hoverCell && g) {
        // The set piece about to be placed: what it is, how it's turned and themed, and whether it fits (and why not).
        title = g.def.displayName;
        tone = g.ok ? 'place' : 'bad';
        lines.push(...this.pieceLines(g.def, g.placement), `${levelName(this.level)} · cell ${this.hoverCell[0]}, ${this.hoverCell[1]}`);
        if (!g.ok) marks.set(lines.push(`✗ ${g.reason}`) - 1, 'bad');
        else if (g.blocked) marks.set(lines.push(`⚠ ${g.blocked} of its ports face${g.blocked === 1 ? 's' : ''} a wall (red): open the wall there, or place it elsewhere`) - 1, 'warn');
        else lines.push('Click to place');
      } else if (this.tool.kind === 'tile' && this.hoverCell) {
        const def = coreCatalog.get(this.tool.tile);
        if (def) {
          title = def.displayName;
          lines.push(...tileLines(def, this.rotation), `${levelName(this.level)} · cell ${this.hoverCell[0]}, ${this.hoverCell[1]}`);
          tone = 'place';
        }
      } else if (this.tool.kind === 'select' || this.tool.kind === 'erase') {
        const hit = this.pick();
        if (hit) {
          title = this.targetName(hit);
          tone = this.tool.kind === 'erase' ? 'erase' : 'pick';
          const placement = hit.kind === 'setpiece' ? this.placementOf(hit.id) : undefined;
          const def = placement && this.pieceDef(placement.piece);
          if (placement && def) lines.push('Set piece (selects as one)', ...this.pieceLines(def, placement));
          else if (hit.kind === 'tile') {
            const t = this.doc.classicStructure.tiles.find((x) => x.id === hit.id);
            const def = t && coreCatalog.get(t.tile);
            if (t && def) lines.push(...tileLines(def, t.rotation), levelName(t.z));
          } else {
            const e = this.doc.entities.find((x) => x.id === hit.id);
            if (e?.kind === 'encounter') lines.push(`${rosterSize(e.roster)} NPCs · ${mapFactions(this.doc).find((f) => f.id === e.faction)?.name ?? e.faction}`, `Order: ${e.order}`);
            else if (e?.kind === 'prop') lines.push(`Prop · scale ${e.scale}×`, (getProp(e.model)?.size ?? [1, 1, 1]).map((v) => (v * e.scale).toFixed(1)).join(' × ') + ' m');
            if (e) lines.push(`Height ${e.position[1].toFixed(1)} m`);
          }
          lines.push(this.tool.kind === 'erase' ? 'Click to erase' : 'Click to select');
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

  private updateHoverTarget(): void {
    // Placing tools show what they'd put down, see-through, before you click (first: every other tool hides them).
    // One ghost for every kind that has a model: where it would land, facing the way it would face.
    const t = this.tool;
    const ghost: { kind: 'prop' | 'mount' | 'spawn' | 'pickup'; model: string; at: [number, number, number] | null; yaw: number; scale?: number; variant?: number } | null =
      this.looking ? null
      : t.kind === 'prop' ? { kind: 'prop', model: t.model, ...this.propPlacement(t.model) }
      : t.kind === 'mount' ? { kind: 'mount', model: t.model, at: this.placeSpot(), yaw: this.propYaw }
      : t.kind === 'spawn' ? { kind: 'spawn', model: 'spawn', at: this.placeSpot(), yaw: this.spawnYaw }
      : t.kind === 'pickup' ? { kind: 'pickup', model: t.item, at: this.placeSpot(), yaw: 0 }
      : null;
    this.view.setPropGhost(ghost?.model ?? null, ghost?.at ?? null, ghost?.yaw ?? 0, ghost?.kind ?? 'prop', ghost?.scale !== undefined ? { scale: ghost.scale, ...(ghost.variant !== undefined ? { variant: ghost.variant } : {}) } : undefined);
    const objects = this.looking ? null : this.objectGhost();
    this.view.setEntityGhost(this.doc, objects?.key ?? null, objects?.entities ?? []);
    this.updatePieceGhost();
    if (this.tool.kind === 'select' || this.tool.kind === 'erase') {
      // Select: the rotate ring round the selection lights under the pointer (and, held, turns it).
      const onRing = this.tool.kind === 'select' && !this.drag && !this.looking && !this.marquee && (!!this.ring.drag || this.ring.hover(this.pointerAt));
      if (onRing) {
        this.view.setPickHighlight(this.doc, null, 'pick', this.history.revision);
        $('ed-target').textContent = this.ring.drag ? `Turning ${turnLabel(this.ring.drag.turn)} · Shift: finer · Esc cancels` : 'Drag the ring to turn the selection (Shift: a finer step)';
        this.view.setFaceHighlight(null, null);
        this.view.setHoverCell(this.doc, null);
        this.view.setGhost(this.doc, null, null, 0, true);
        return;
      }
      if (this.tool.kind === 'erase' || this.drag || this.looking || this.marquee) this.ring.hover(null);
      const target = this.drag || this.looking || this.marquee ? null : this.pick();
      const cells = target?.kind === 'setpiece' ? (this.expansion.footprints.get(target.id) ?? []) : [];
      this.view.setPickHighlight(this.doc, target, this.tool.kind === 'erase' ? 'erase' : 'pick', this.history.revision, cells);
      $('ed-target').textContent = target ? `${this.tool.kind === 'erase' ? 'Erase' : 'Select'}: ${this.targetName(target)}` : this.zoneNote();
      this.view.setFaceHighlight(null, null);
      this.view.setHoverCell(this.doc, null);
      this.view.setGhost(this.doc, null, null, 0, true);
      return;
    }
    this.view.setPickHighlight(this.doc, null, 'pick', 0);
    if (this.tool.kind === 'measure') {
      $('ed-target').textContent = this.measure.summary();
      this.view.setFaceHighlight(null, null);
      this.view.setHoverCell(this.doc, null);
      this.view.setGhost(this.doc, null, null, 0, true);
      return;
    }
    if (this.tool.kind === 'scatter') {
      const p = this.hoverPoint;
      this.view.setBrushRing(p ? this.shownGround : null, p?.x ?? 0, p?.z ?? 0, this.brushRadius, '#6fdc6a');
      $('ed-target').textContent = p ? `${SCATTER_SETS[this.tool.set].label} · radius ${this.brushRadius} m` : '';
      this.view.setFaceHighlight(null, null);
      this.view.setHoverCell(this.doc, null);
      this.view.setGhost(this.doc, null, null, 0, true);
      return;
    }
    if (this.tool.kind === 'terrain') {
      const h = this.terrainHover;
      const t = this.shownGround;
      const colors: Record<TerrainBrush, string> = { raise: '#ffd34d', lower: '#ff7a4d', smooth: '#7fd8ff', flatten: '#c7a6ff', roughen: '#b8e07a', paint: '#ffffff', foliage: '#6fdc6a' };
      this.view.setBrushRing(h ? t : null, h?.x ?? 0, h?.z ?? 0, this.brushRadius, colors[this.terrainBrush]);
      $('ed-target').textContent = !t ? 'No terrain yet: create one in the Terrain tab' : h ? `${this.terrainBrush === 'paint' ? `Paint ${TERRAIN_MATERIAL_LABELS[this.terrainMaterial]}` : this.terrainBrush === 'foliage' ? `Plants: ${FOLIAGE_LEVELS[this.foliageLevel]}` : this.terrainBrush} · height ${h.y.toFixed(1)} m · radius ${this.brushRadius} m` : '';
      this.view.setFaceHighlight(null, null);
      this.view.setHoverCell(this.doc, null);
      this.view.setGhost(this.doc, null, null, 0, true);
      return;
    }
    if (this.tool.kind === 'edge') {
      const e = this.hoverEdge;
      if (e) {
        const { cellSize, levelHeight } = this.doc.classicStructure;
        const [gx, gy, gz] = e.cell;
        const [dx, dz] = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] }[e.side] as [number, number];
        const h = cellSize / 2;
        const cx = gx * cellSize + dx * (h - 0.25);
        const cz = gy * cellSize + dz * (h - 0.25);
        const box = { min: [cx - (dx ? 0.25 : h), gz * levelHeight, cz - (dz ? 0.25 : h)], max: [cx + (dx ? 0.25 : h), (gz + 1) * levelHeight, cz + (dz ? 0.25 : h)], kind: 'wall', sourceId: '' } as WorldBox;
        this.view.setFaceHighlight(box, [-dx, 0, -dz]);
        const tileName = coreCatalog.get(tileAt(this.doc, gx, gy, gz)?.tile ?? '')?.displayName ?? '';
        const sideName = { N: 'North', E: 'East', S: 'South', W: 'West' }[e.side];
        $('ed-target').textContent = `${sideName} side · ${tileName} · now ${EDGE_STYLE_LABELS[edgeChoiceAt(this.doc, e)]} → ${EDGE_STYLE_LABELS[this.tool.style]}`;
      } else {
        this.view.setFaceHighlight(null, null);
        $('ed-target').textContent = '';
      }
      this.view.setHoverCell(this.doc, null);
      this.view.setGhost(this.doc, null, null, 0, true);
      return;
    }
    // Paint lights only a surface it can paint (a tile's), never a prop or block it would leave as it is.
    const face = this.tool.kind === 'paint' && !this.paintTarget() ? null : this.hoverFace;
    this.view.setFaceHighlight(face?.box ?? null, face?.localNormal ?? null);
    if (this.tool.kind === 'paint') {
      const target = this.paintTarget();
      const g = this.paintGround;
      // On the ground: the ring it paints, as the Terrain tab's Paint brush shows it.
      this.view.setBrushRing(g ? this.shownGround : null, g?.x ?? 0, g?.z ?? 0, this.brushRadius, '#ffb03b');
      $('ed-target').textContent = target
        ? `${SURFACE_SLOT_LABELS[target.slot]} · ${coreCatalog.get(target.tile.tile)?.displayName ?? target.tile.tile} · ${resolveSurface(this.doc, target.tile, target.slot).material.displayName}`
        : g
          ? `Ground · paint ${TERRAIN_MATERIAL_LABELS[this.groundPaint]}${TERRAIN_SURFACES[this.groundPaint] === this.paintStyle.material || !terrainMaterialFor(this.paintStyle.material) ? '' : ` (${coreMaterials.get(this.paintStyle.material)?.displayName ?? 'swatch'})`} · radius ${this.brushRadius} m`
          : '';
    } else if (this.tool.kind === 'path') {
      const over = this.paths.hovering;
      $('ed-target').textContent = this.paths.dragging ? 'Moving the point' : over === 'point' ? (this.paths.joining ? 'Click to join the ends (a loop) · drag to move this point' : 'Drag to move this point · right-click removes it') : over === 'path' ? 'Click to edit this path · Shift-click puts a point here' : '';
    } else if (this.tool.kind === 'setpiece' && this.pieceHover) {
      const g = this.pieceHover;
      $('ed-target').textContent = `${g.def.displayName}: ${g.ok ? (g.blocked ? `fits; ${g.blocked} port${g.blocked === 1 ? '' : 's'} face${g.blocked === 1 ? 's' : ''} a wall` : 'fits here') : `can't go here: ${g.reason}`}`;
    } else $('ed-target').textContent = this.zoneNote();
    const cell = this.hoverCell ? ([this.hoverCell[0], this.hoverCell[1], this.level] as [number, number, number]) : null;
    this.view.setHoverCell(this.doc, this.tool.kind === 'tile' || this.tool.kind === 'setpiece' || this.tool.kind === 'spawn' || this.tool.kind === 'pickup' || this.tool.kind === 'scenario' || this.tool.kind === 'npc' ? cell : null);
    if (this.tool.kind === 'tile' && cell) {
      // A Platform over another piece's empty upper storey becomes its floor: that's fine too.
      const ok =
        checkPlacement(this.doc, [{ id: '__ghost', tile: this.tool.tile, x: cell[0], y: cell[1], z: cell[2], rotation: this.rotation }]).ok ||
        (isBareFloor(coreCatalog.get(this.tool.tile)) && upperFloorAt(this.doc, cell[0], cell[1], cell[2])?.has === false);
      this.view.setGhost(this.doc, this.tool.tile, cell, this.rotation, ok);
    } else {
      this.view.setGhost(this.doc, null, null, 0, true);
    }
  }

  /**
   * The set piece tool's ghost: the whole piece at the hovered cell in its look, its footprint and ports outlined green
   * where it fits and red where it doesn't (the hover card and status line say why: checkSetPiecePlacement), and any
   * port a wall stands in red.
   */
  private updatePieceGhost(): void {
    const t = this.tool;
    const cell = this.hoverCell;
    const def = t.kind === 'setpiece' ? this.pieceDef(t.piece) : undefined;
    if (this.looking || !cell || !def || t.kind !== 'setpiece') {
      this.pieceHover = null;
      this.view.setPieceGhost(this.doc, null, () => ({ tiles: [], entities: [] }), null, true, null);
      return;
    }
    const look = this.lookFor();
    const placement: SetPiecePlacement = { id: 'ghost_piece', piece: t.piece, x: cell[0], y: cell[1], z: this.level, rotation: this.rotation, mirror: this.pieceMirror, ...(look ? { pack: look } : {}) };
    const check = checkSetPiecePlacement(this.doc, [placement], [], coreCatalog, this.placeLib);
    // Its ports against the map, and against its own walls as they'd be built here (worked out once per cell).
    const at = `${t.piece}:${this.rotation}:${this.pieceMirror}:${cell.join(',')}:${this.history.revision}:${this.myPiecesRev}`;
    if (this.ghostPorts?.at !== at) this.ghostPorts = { at, states: setPiecePortStates(placement, def, [...this.mapBoxes(), ...this.ownBoxes(placement, def)]) };
    const ports = this.ghostPorts.states;
    this.pieceHover = { def, placement, ok: check.ok, reason: check.ok ? '' : check.reason, blocked: ports.filter((s) => s.blockedBy).length };
    const theme = this.doc.classicStructure.theme;
    // Built once per piece, turn, mirror and look (at the grid's origin) and moved with the pointer.
    const key = `${t.piece}:${this.rotation}:${this.pieceMirror}:${look}:${theme}:${this.myPiecesRev}`;
    const atOrigin = { ...placement, x: 0, y: 0, z: 0 };
    this.view.setPieceGhost(this.doc, key, () => setPieceParts(atOrigin, def, theme, this.setPieceLib), [cell[0], cell[1], this.level], check.ok, {
      cells: setPieceFootprint(placement, def),
      ports: ports.map((s) => ({ x: s.x, y: s.y, z: s.z, side: s.side, kind: s.kind, closed: s.closed, blocked: !!s.blockedBy })),
    });
  }

  /** The ghost's ports, and the cell, turn and document version they were worked out for. */
  private ghostPorts: { at: string; states: ReturnType<typeof setPiecePortStates> } | null = null;

  private updateDrag(): void {
    const d = this.drag;
    if (!d || !this.hoverPoint || !this.hoverCell) return;
    const cellOffset: [number, number] = [this.hoverCell[0] - d.startCell[0], this.hoverCell[1] - d.startCell[1]];
    const freeOffset: [number, number] = [snap(this.hoverPoint.x - d.startPoint.x, this.snapStep(0.5)), snap(this.hoverPoint.z - d.startPoint.z, this.snapStep(0.5))];
    d.cellOffset = cellOffset;
    d.freeOffset = freeOffset;
    // Tiles and set pieces move cell by cell (their outlines show where they'd land, red where they can't).
    const byCell = this.selection.tiles.length > 0 || this.selPieces().length > 0;
    if (byCell) {
      const preview = moveCommand(this.doc, this.selection, cellOffset[0], cellOffset[1], 0);
      this.view.setOutlines(this.doc, this.selection.tiles, [cellOffset[0], cellOffset[1], 0], 'error' in preview, this.selectedPieceOutlines());
    }
    // Things follow the pointer as you drag (with tiles, cell by cell), so every kind previews where it lands.
    if (this.selection.entities.length) {
      const cs = this.doc.classicStructure.cellSize;
      const [ex, ez] = byCell ? [cellOffset[0] * cs, cellOffset[1] * cs] : freeOffset;
      const moved = applyCommand(this.viewDoc, moveEntitiesCommand(this.viewDoc, this.selection.entities, ex, 0, ez));
      this.view.setEntities(moved, this.level, this.showAll, new Set(this.selection.entities));
    }
  }

  private endDrag(): void {
    const d = this.drag;
    this.drag = null;
    if (!d || !d.moved) return;
    if (this.selection.tiles.length || this.selPieces().length) {
      const [dx, dy] = d.cellOffset;
      if (dx || dy) this.run('Move', moveCommand(this.doc, this.selection, dx, dy, 0));
    } else {
      const [dx, dz] = d.freeOffset;
      if (dx || dz) this.run('Move', moveEntitiesCommand(this.doc, this.selection.entities, dx, 0, dz));
    }
    this.updateSelectionVisuals();
  }

  /** The box select's rectangle on screen (hidden while there is none, or it is still a click). */
  private drawMarquee(): void {
    const el = $('ed-marquee');
    const m = this.marquee;
    el.hidden = !m?.moved;
    if (!m?.moved) return;
    const r = $('editor').getBoundingClientRect();
    el.style.left = `${Math.min(m.x0, m.x1) - r.left}px`;
    el.style.top = `${Math.min(m.y0, m.y1) - r.top}px`;
    el.style.width = `${Math.abs(m.x1 - m.x0)}px`;
    el.style.height = `${Math.abs(m.y1 - m.y0)}px`;
  }

  /**
   * Box select (Select tool, drag on empty ground): everything whose middle is inside the box on screen, on the level
   * being edited: tiles, set pieces (whole) and things (a moving build whole). Shift adds to the selection. A click
   * that didn't drag selects nothing.
   */
  private endMarquee(): void {
    const m = this.marquee!;
    this.marquee = null;
    this.drawMarquee();
    if (!m.moved) {
      if (!m.add) this.setSelection(emptySelection());
      return;
    }
    const [x0, x1] = [Math.min(m.x0, m.x1), Math.max(m.x0, m.x1)];
    const [y0, y1] = [Math.min(m.y0, m.y1), Math.max(m.y0, m.y1)];
    const inside = (p: Vec3) => {
      const s = this.view.projectInView(p);
      return !!s && s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1;
    };
    const { cellSize, levelHeight } = this.doc.classicStructure;
    /** The middle of the cells on this level, a metre up. */
    const middle = (cells: readonly (readonly number[])[]): Vec3 | null => {
      const here = cells.filter((c) => c[2] === this.level);
      if (!here.length) return null;
      return { x: (here.reduce((s, c) => s + c[0]!, 0) / here.length) * cellSize, y: this.level * levelHeight + 1, z: (here.reduce((s, c) => s + c[1]!, 0) / here.length) * cellSize };
    };
    const tiles = this.doc.classicStructure.tiles.filter((t) => ((c) => !!c && inside(c))(middle(placementCells(t) ?? []))).map((t) => t.id);
    const pieces = [...this.expansion.footprints].filter(([, cells]) => ((c) => !!c && inside(c))(middle(cells))).map(([id]) => id);
    const things = this.doc.entities.filter((e) => this.reachable(e) && this.view.entityShown(e.id) && inside({ x: e.position[0], y: e.position[1] + 0.5, z: e.position[2] }));
    const entities = withMoverGroups(this.doc, things.map((e) => e.id));
    const union = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])];
    const setPieces = m.add ? union(this.selPieces(), pieces) : pieces;
    this.setSelection({ tiles: m.add ? union(this.selection.tiles, tiles) : tiles, entities: m.add ? union(this.selection.entities, entities) : entities, ...(setPieces.length ? { setPieces } : {}) });
    const n = this.selCount();
    this.toast(n ? `${n} selected · Save as set piece… (inspector) makes a piece of them` : `Nothing in the box on ${levelName(this.level)}`);
  }

  // ---------------------------------------------------------------- input

  private bindInput(): void {
    const canvas = () => this.host.canvas;
    window.addEventListener('pointermove', (e) => {
      if (!this.active) return;
      if (this.looking) {
        const dx = e.movementX;
        const dy = e.movementY;
        // A right-click that wobbles a few pixels is still a click (secondaryClick), not a look.
        this.looking.travel += Math.abs(dx) + Math.abs(dy);
        if (this.looking.travel > 6) this.looking.moved = true;
        if (this.looking.button === 2) this.view.look(dx * LOOK_SENSITIVITY, -dy * LOOK_SENSITIVITY);
        else this.view.fly(0, -dx * 0.05, dy * 0.05);
        return;
      }
      if (this.ring.drag) {
        this.updatePointer(e.clientX, e.clientY);
        this.ring.move({ x: e.clientX, y: e.clientY }, e.shiftKey);
        return this.updateHover();
      }
      if (this.marquee) {
        const m = this.marquee;
        m.x1 = e.clientX;
        m.y1 = e.clientY;
        if (Math.hypot(m.x1 - m.x0, m.y1 - m.y0) > 4) m.moved = true;
        this.drawMarquee();
        return;
      }
      if (e.target !== canvas() && !this.drag) {
        // Off the view (over a panel): no hover card.
        if (this.pointerAt) {
          this.pointerAt = null;
          $('ed-tip').hidden = true;
        }
        return;
      }
      this.updatePointer(e.clientX, e.clientY);
      if (this.paths.dragging) this.paths.pointerMove(this.hoverPoint);
      if (this.routes.dragging) this.routes.pointerMove(this.hoverPoint);
      if (this.brush && e.buttons & 1) this.brushAtHover(false);
      if (this.drag) {
        if (Math.hypot(e.clientX - this.drag.pointerX, e.clientY - this.drag.pointerY) > 4) this.drag.moved = true;
        if (this.drag.moved) this.updateDrag();
      }
    });
    window.addEventListener('pointerdown', (e) => {
      if (!this.active || e.target !== canvas()) return;
      (document.activeElement as HTMLElement | null)?.blur?.();
      this.updatePointer(e.clientX, e.clientY);
      if (e.button === 2 || e.button === 1) {
        this.looking = { x: e.clientX, y: e.clientY, moved: false, travel: 0, button: e.button };
        canvas().setPointerCapture(e.pointerId);
        return;
      }
      if (e.button !== 0) return;
      if (this.tool.kind === 'paint' && e.altKey) return this.pickStyleAtHover();
      if (this.tool.kind === 'terrain') return this.startStroke(e.shiftKey);
      // Paint, Walls, Scatter and Erase paint as you drag (one undo step); Shift does the opposite.
      if (this.tool.kind === 'paint' || this.tool.kind === 'edge' || this.tool.kind === 'scatter' || this.tool.kind === 'erase') {
        this.history.beginStroke();
        this.brush = { invert: e.shiftKey, alt: e.altKey, key: null, at: null };
        this.brushAtHover(true);
        return;
      }
      if (this.tool.kind === 'path') return this.paths.pointerDown(this.hoverPoint, e.shiftKey);
      if (this.tool.kind === 'route') return this.routes.pointerDown(this.hoverPoint, e.shiftKey);
      if (this.tool.kind === 'measure') {
        if (this.measure.hover) this.measure.click(this.measure.hover);
        return this.updateHover();
      }
      if (this.tool.kind !== 'select') return this.placeAtHover();
      // The rotate ring round the selection: a drag turns it.
      if (this.ring.begin({ x: e.clientX, y: e.clientY })) {
        canvas().setPointerCapture(e.pointerId);
        return this.updateHover();
      }
      const hit = this.pick();
      if (!hit) {
        // Empty ground: drag a box to select what's in it (Shift adds to the selection); a plain click selects nothing.
        this.marquee = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, add: e.shiftKey, moved: false };
        return;
      }
      const key = hit.kind === 'tile' ? 'tiles' : hit.kind === 'setpiece' ? 'setPieces' : 'entities';
      // A moving build (a mover and every block and prop it carries) is picked whole; Alt-click picks one part.
      // A set piece is picked whole too: any of its parts selects the placement.
      const ids = (hit.kind === 'entity' && !e.altKey && moverGroupOf(this.doc, hit.id)) || [hit.id];
      const now = this.selection[key] ?? [];
      const already = ids.every((id) => now.includes(id));
      if (e.shiftKey) {
        const next = { ...this.selection, [key]: already ? now.filter((id) => !ids.includes(id)) : [...new Set([...now, ...ids])] };
        this.setSelection(next);
        return;
      }
      if (!already) this.setSelection(hit.kind === 'tile' ? { tiles: [hit.id], entities: [] } : hit.kind === 'setpiece' ? { tiles: [], entities: [], setPieces: [hit.id] } : { tiles: [], entities: ids });
      if (this.hoverPoint && this.hoverCell) {
        this.drag = { startCell: [this.hoverCell[0], this.hoverCell[1]], startPoint: { ...this.hoverPoint }, pointerX: e.clientX, pointerY: e.clientY, moved: false, cellOffset: [0, 0], freeOffset: [0, 0] };
      }
    });
    window.addEventListener('pointerup', (e) => {
      if (!this.active) return;
      if (this.looking && (e.button === 2 || e.button === 1)) {
        const wasClick = !this.looking.moved && e.button === 2;
        this.looking = null;
        if (wasClick) {
          this.updatePointer(e.clientX, e.clientY);
          this.secondaryClick(e.clientX, e.clientY, e.altKey);
        }
        return;
      }
      if (e.button === 0) {
        if (this.ring.drag) {
          this.ring.end();
          return this.updateHover();
        }
        if (this.brush) {
          this.brush = null;
          this.history.endStroke();
        }
        if (this.marquee) this.endMarquee();
        this.endStroke();
        this.endDrag();
        this.paths.pointerUp();
        this.routes.pointerUp();
      }
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.active || e.target !== canvas()) return;
        e.preventDefault();
        // Mouse wheels send big steps, touchpads many small ones: move by how far it scrolled.
        const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        this.view.dolly(Math.max(-3, Math.min(3, -px * 0.03)) * (e.shiftKey ? 3 : 1));
        this.updatePointer(e.clientX, e.clientY);
      },
      { passive: false },
    );
    window.addEventListener('contextmenu', (e) => {
      if (this.active && e.target === canvas()) e.preventDefault();
    });
    window.addEventListener('blur', () => {
      this.ring.cancel();
      this.keys.clear();
      this.looking = null;
      this.marquee = null;
      this.drawMarquee();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.code === 'F5') {
        e.preventDefault();
        this.test();
        return;
      }
      if (isTyping() || document.querySelector('#editor dialog[open]')) return;
      this.keys.add(e.code);
      const mod = e.ctrlKey || e.metaKey;
      if (mod) {
        const k = e.code;
        if (k === 'KeyZ' && e.shiftKey) this.redo();
        else if (k === 'KeyZ') this.undo();
        else if (k === 'KeyY') this.redo();
        else if (k === 'KeyS') this.save();
        else if (k === 'KeyD') this.duplicate();
        else return;
        e.preventDefault();
        return;
      }
      // \ folds the palette away (and back), Shift+\ the side panel.
      if (e.code === 'Backslash') {
        this.toggleSidebar(e.shiftKey ? 'right' : 'pal');
        e.preventDefault();
        return;
      }
      switch (e.code) {
        case 'KeyR':
          this.rotate(e.shiftKey);
          break;
        case 'KeyM':
          this.mirror();
          break;
        case 'KeyF':
          this.focusSelection();
          break;
        case 'Home':
          this.resetView();
          break;
        case 'KeyL':
          this.logic.toggle();
          break;
        case 'KeyB':
          this.setTool({ kind: 'paint' });
          break;
        case 'KeyT': {
          const i = this.tool.kind === 'terrain' ? (TERRAIN_BRUSHES.indexOf(this.terrainBrush) + 1) % TERRAIN_BRUSHES.length : TERRAIN_BRUSHES.indexOf(this.terrainBrush);
          this.setTerrainBrush(TERRAIN_BRUSHES[i]!);
          break;
        }
        case 'KeyO':
          this.wallsTool(this.tool.kind === 'edge');
          break;
        case 'KeyX':
          this.setTool({ kind: 'erase' });
          break;
        // U: the measure tool (MapMaker overhaul Phase 1 item 3).
        case 'KeyU':
          this.setTool({ kind: 'measure' });
          break;
        // G: Paths (Shift+G: Paths on the race track), N: Scatter (the last set you used).
        case 'KeyG':
          if (e.shiftKey) this.paths.preset('race');
          this.setTool({ kind: 'path' });
          break;
        case 'KeyN':
          this.setTool({ kind: 'scatter', set: this.lastScatter });
          break;
        case 'KeyP':
          this.placeTool();
          break;
        case 'KeyI':
          if (this.tool.kind === 'paint') this.pickStyleAtHover();
          break;
        case 'KeyV':
        case 'Escape':
          // Esc drops a turn by the ring mid-drag (nothing turns).
          if (e.code === 'Escape' && this.ring.cancel()) {
            this.updateHover();
            break;
          }
          // Esc clears a measurement first (the measure tool stays in hand).
          if (e.code === 'Escape' && this.measure.clear() && this.tool.kind === 'measure') {
            this.updateHover();
            break;
          }
          if (this.tool.kind === 'select') this.setSelection(emptySelection());
          this.setTool({ kind: 'select' });
          break;
        case 'KeyH':
          this.setShowAll(!this.showAll);
          break;
        case 'Slash':
          // Search the palette.
          $<HTMLInputElement>('ed-search').focus();
          $<HTMLInputElement>('ed-search').select();
          break;
        case 'Delete':
        case 'Backspace':
          if (this.tool.kind === 'path' && this.paths.deleteSelected()) break;
          if (this.tool.kind === 'route' && this.routes.deleteSelected()) break;
          this.deleteSelection();
          break;
        // One meaning per key: PgUp/PgDn change the level (Shift: move the selection a level), [ ] the brush size.
        case 'PageUp':
          if (e.shiftKey) this.nudge(0, 0, 1);
          else this.setLevel(this.level + 1);
          break;
        case 'PageDown':
          if (e.shiftKey) this.nudge(0, 0, -1);
          else this.setLevel(this.level - 1);
          break;
        case 'BracketRight':
          if (this.tool.kind === 'terrain' || this.tool.kind === 'scatter') this.setBrushRadius(this.brushRadius + 2);
          break;
        case 'BracketLeft':
          if (this.tool.kind === 'terrain' || this.tool.kind === 'scatter') this.setBrushRadius(this.brushRadius - 2);
          break;
        case 'ArrowUp':
          this.nudge(0, 1, 0);
          break;
        case 'ArrowDown':
          this.nudge(0, -1, 0);
          break;
        case 'ArrowLeft':
          this.nudge(-1, 0, 0);
          break;
        case 'ArrowRight':
          this.nudge(1, 0, 0);
          break;
        default:
          return;
      }
      e.preventDefault();
    });
  }

  // ---------------------------------------------------------------- UI

  /** Walls & Openings tool; `cycle` moves on to the next style. */
  private wallsTool(cycle: boolean): void {
    const styles = EDGE_STYLES.filter((x) => x !== 'auto');
    const now = this.tool.kind === 'edge' ? this.tool.style : this.edgeStyle;
    const next = cycle ? styles[(styles.indexOf(now as (typeof styles)[number]) + 1) % styles.length]! : now;
    this.setTool({ kind: 'edge', style: next });
  }

  /** Pick the last placed piece up again, or point at the palette. */
  private placeTool(): void {
    if (this.lastPlace) return this.setTool(this.lastPlace);
    this.showPane('tiles');
    this.toast('Pick a piece, prop, item or NPC from the palette on the left to place it');
  }

  private setShowAll(on: boolean): void {
    this.showAll = on;
    $<HTMLInputElement>('ed-showall').checked = on;
    this.toast(on ? 'Showing every level (the others ghosted)' : `Showing ${levelName(this.level)} and below`);
  }

  /** The always-visible tool bar over the view: modes, then actions, each with its key. */
  private buildToolbar(): void {
    const bar = $('ed-toolbar');
    const add = (id: string, icon: string, label: string, key: string, title: string, onClick: () => void, tool?: string) => {
      const b = document.createElement('button');
      b.id = id;
      b.className = 'tb-btn';
      if (tool) b.dataset.tool = tool;
      b.title = `${title} (${key})`;
      b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${TOOL_ICONS[icon]}</svg><span class="tb-label">${label}</span>${id === 'ed-tb-place' ? '<small id="ed-tb-place-what"></small>' : ''}<kbd>${key}</kbd>`;
      b.addEventListener('click', () => {
        onClick();
        b.blur();
      });
      bar.append(b);
      return b;
    };
    add('ed-tb-select', 'select', 'Select', 'V', 'Select, move and edit things', () => this.setTool({ kind: 'select' }), 'select');
    add('ed-tb-place', 'place', 'Place', 'P', 'Place the last piece you picked from the palette', () => this.placeTool(), 'place');
    add('ed-tb-erase', 'erase', 'Erase', 'X', 'Erase: click anything to delete it', () => this.setTool({ kind: 'erase' }), 'erase');
    add('ed-tb-paint', 'paint', 'Paint', 'B', 'Paint surfaces', () => this.setTool({ kind: 'paint' }), 'paint');
    add('ed-tb-walls', 'edge', 'Walls', 'O', 'Walls & openings: doors, windows, arches on any side', () => this.wallsTool(false), 'edge');
    add('ed-tb-terrain', 'terrain', 'Terrain', 'T', 'Sculpt and paint the terrain', () => this.setTerrainBrush(this.terrainBrush), 'terrain');
    add('ed-tb-measure', 'measure', 'Measure', 'U', 'Measure: distance, height difference and slope between points', () => this.setTool({ kind: 'measure' }), 'measure');
    const sep = document.createElement('span');
    sep.className = 'tb-sep';
    bar.append(sep);
    add('ed-tb-rotate', 'rotate', 'Rotate', 'R', 'Rotate the selection, or the piece you are placing (Shift+R: a finer step)', () => this.rotate());
    add('ed-tb-delete', 'delete', 'Delete', 'Del', 'Delete the selection', () => this.deleteSelection());
    this.syncToolbar();
  }

  /** Selection actions are only live with something selected. */
  private syncToolbar(): void {
    $<HTMLButtonElement>('ed-tb-delete').disabled = !this.selCount();
    const save = document.getElementById('ed-sp-save') as HTMLButtonElement | null;
    if (save) save.disabled = !this.selCount();
  }

  /** NPCs tab: lone soldiers and squads, each a preconfigured encounter. */
  private buildNpcPalette(): void {
    const box = this.palette.group($('ed-npcs'), 'npcs:squads', 'Soldiers & Squads', {
      note: 'Click one, then click the map to drop it there. Each is an NPC squad marker: change its soldiers, faction, orders and skill in the inspector.',
    });
    for (const entry of NPC_PALETTE) {
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = `npc:${entry.key}`;
      b.title = `${entry.label}: ${entry.blurb}`;
      b.innerHTML = `${npcIcon(entry.key)}${escapeHtml(entry.label)}`;
      b.addEventListener('click', () => this.setTool({ kind: 'npc', key: entry.key }));
      box.append(b);
      this.palette.register(b, { key: b.dataset.tool, name: entry.label, tags: `${entry.search} npc enemy ai` });
    }
  }

  /**
   * Top-bar workspaces (reference board): Build, Entities and Environment
   * pick the palette's sub-tabs; Logic opens the rules panel; Test plays the map.
   */
  private setWorkspace(ws: string): void {
    if (ws === 'test') return this.test();
    if (ws === 'logic') {
      if (!this.logic.isOpen) this.logic.open();
      return;
    }
    if (this.logic.isOpen) this.logic.close();
    const first: Record<string, string> = { build: 'tiles', entities: 'entities', environment: 'paint' };
    this.paletteWs = ws;
    this.showPane(first[ws] ?? 'tiles');
    if (ws === 'environment' && this.selCount()) this.setSelection(emptySelection());
  }

  /** Light the top bar's workspace tab: Logic while its panel is open, else the palette's workspace. */
  private syncWorkspaceTabs(): void {
    const on = this.logic?.isOpen ? 'logic' : this.paletteWs;
    for (const b of document.querySelectorAll<HTMLElement>('#ed-modes .tab')) b.classList.toggle('on', b.dataset.ws === on);
  }

  private buildPalette(): void {
    this.buildToolbar();
    this.palette = new Palette($('ed-palette'), $<HTMLInputElement>('ed-search'), this.paletteAtlas, (key) => this.thumbFor(key));
    this.buildNpcPalette();
    this.buildPaintPalette();

    // Structure: tiles by kind of piece.
    const tilePack = (id: string) => STYLE_PACKS.find((p) => id.startsWith(`${p.id}.`) || p.tiles.includes(id));
    for (const category of TILE_CATEGORIES) {
      const grid = this.palette.group($('ed-tiles'), `tiles:${category}`, category);
      for (const def of coreCatalog.all().filter((d) => d.category === category)) this.paletteButton(grid, def, tilePack(def.id));
    }
    this.buildSetPiecePalette();
    const edges = this.palette.group($('ed-edges'), 'walls', 'Walls & Openings', { note: 'Pick a style, then click any side of a room or corridor to build it that way (O cycles styles, right-click resets).' });
    for (const style of EDGE_STYLES) {
      const b = document.createElement('button');
      b.className = 'tile-btn edge-btn';
      b.dataset.tool = `edge:${style}`;
      b.innerHTML = `${edgeIcon(style)}${escapeHtml(EDGE_STYLE_LABELS[style])}`;
      b.title = style === 'auto' ? 'Back to the automatic wall or doorway' : `Build a side as: ${EDGE_STYLE_LABELS[style]}`;
      b.addEventListener('click', () => this.setTool({ kind: 'edge', style }));
      edges.append(b);
      this.palette.register(b, { key: b.dataset.tool, name: EDGE_STYLE_LABELS[style], tags: 'wall side opening window door' });
    }
    // Glass for the windows the wall tool builds.
    const glass = document.createElement('select');
    glass.id = 'ed-edge-glass';
    glass.title = 'Glass the Window, Twin windows and Firing slit styles put in: breakable panes shatter when shot, reinforced (bulletproof) panes stop shots and crack. Both stop players; everyone sees through.';
    glass.append(new Option('Glass: none', ''), ...GLASS_KINDS.map((k) => new Option(`Glass: ${GLASS_KIND_LABELS[k].toLowerCase()}`, k)));
    glass.addEventListener('change', () => (this.edgeGlass = (glass.value || null) as GlassKind | null));
    const glassRow = document.createElement('div');
    glassRow.className = 'ed-row';
    glassRow.append(glass);
    edges.after(glassRow);

    // Gameplay: spawns and game-mode objectives, then pickups by kind.
    const objectives = this.palette.group($('ed-entities'), 'gameplay:objectives', 'Spawns & Objectives');
    const spawnBtn = document.createElement('button');
    spawnBtn.className = 'tile-btn';
    spawnBtn.dataset.tool = 'spawn';
    spawnBtn.innerHTML = `<svg viewBox="0 0 56 56"><circle cx="28" cy="30" r="12" fill="#4fb3ff"/><rect x="22" y="14" width="12" height="6" rx="2" fill="#1c1f26"/></svg>Player Spawn`;
    spawnBtn.title = 'Player Spawn: where players start and come back in';
    spawnBtn.addEventListener('click', () => this.setTool({ kind: 'spawn' }));
    objectives.append(spawnBtn);
    this.palette.register(spawnBtn, { key: 'spawn', name: 'Player Spawn', tags: 'spawn player start respawn team' });
    const scenarioGrids = new Map<string, HTMLElement>();
    const scenarioGrid = (pane: string, group: string) => {
      const id = `${pane}:${group}`;
      let grid = scenarioGrids.get(id);
      if (!grid) {
        const box = ({ entities: 'ed-entities', scenario: 'ed-scenario', lights: 'ed-lights', npcs: 'ed-npcs' } as Record<string, string>)[pane]!;
        grid = pane === 'entities' ? objectives : this.palette.group($(box), id, group);
        scenarioGrids.set(id, grid);
      }
      return grid;
    };
    // Objects tab order: doors first, then logic, movers, platforms, destructibles, traps.
    for (const g of ['Doors & Gates', 'Logic & Triggers', 'Lifts & Movers', 'Platforms & Climbing', 'Destructibles', 'Traps & Hazards']) scenarioGrid('scenario', g);
    for (const g of ['Lights', 'Liquids']) scenarioGrid('lights', g);
    const pickups = new Map<string, HTMLElement>();
    const pickupGroup = (kind: string) => (kind === 'weapon' ? 'Weapons' : kind === 'ammo' || kind === 'throwable' ? 'Ammo & Grenades' : kind === 'health' || kind === 'armor' ? 'Health & Armour' : 'Power-ups & Gear');
    for (const g of ['Health & Armour', 'Weapons', 'Ammo & Grenades', 'Power-ups & Gear']) pickups.set(g, this.palette.group($('ed-entities'), `gameplay:${g}`, g));
    for (const entry of SCENARIO_PALETTE) {
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = `scenario:${entry.key}`;
      b.innerHTML = `<svg viewBox="0 0 56 56">${SCENARIO_ICONS[entry.key]}</svg>${escapeHtml(entry.label)}`;
      b.addEventListener('click', () => this.setTool({ kind: 'scenario', key: entry.key }));
      const { pane, group } = scenarioGroup(entry.key);
      scenarioGrid(pane, group).append(b);
      this.palette.register(b, { key: b.dataset.tool, name: entry.label, tags: entry.search });
    }
    for (const item of CORE_ITEMS) {
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = `pickup:${item.id}`;
      b.innerHTML = `${itemIcon(item.id)}${escapeHtml(item.displayName)}`;
      b.addEventListener('click', () => this.setTool({ kind: 'pickup', item: item.id }));
      pickups.get(pickupGroup(item.effect.kind))!.append(b);
      this.palette.register(b, { key: b.dataset.tool, name: item.displayName, tags: `${item.id} pickup item ${item.effect.kind}` });
    }

    this.buildScatterPalette();
    this.buildPropPalette();
    this.buildMountPalette();
    this.buildTerrainPalette();
    // Paths: one tool for roads, streets, trails and walkways, the race track and AI routes, in the Terrain pane
    // (roads lie on the ground and shape it). The race track and route cards open it on that kind of path.
    const pathGroup = this.palette.group($('ed-terrain-paths'), 'terrain:paths', 'Paths, Roads & Routes');
    const pathCard = (tool: string, kind: PathKind, svg: string, label: string, title: string, tags: string) => {
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = tool;
      b.innerHTML = `<svg viewBox="0 0 56 56">${svg}</svg>${label}`;
      b.title = title;
      b.addEventListener('click', () => {
        this.paths.preset(kind);
        this.setTool({ kind: 'path' });
      });
      this.palette.register(b, { key: tool, name: label, tags });
      return b;
    };
    const dropCard = (tool: string, key: ScenarioPaletteKey, svg: string, label: string, title: string, tags: string) => {
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = tool;
      b.innerHTML = `<svg viewBox="0 0 56 56">${svg}</svg>${label}`;
      b.title = title;
      b.addEventListener('click', () => this.setTool({ kind: 'scenario', key }));
      this.palette.register(b, { key: tool, name: label, tags });
      return b;
    };
    pathGroup.append(
      pathCard('path', 'road', '<rect x="4" y="4" width="48" height="48" rx="4" fill="#5c7a3a"/><path d="M6 46 C18 40 20 18 34 16 S50 10 52 6" stroke="#c9a36b" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M6 46 C18 40 20 18 34 16 S50 10 52 6" stroke="#e3c48f" stroke-width="2" stroke-dasharray="3 4" fill="none"/>', 'Paths', 'Paths (G): roads, streets, trails and walkways, the race track and AI routes: click points; join the ends for a loop; uses and settings in the pane', 'path road street trail walkway sidewalk pavement asphalt cobble dirt gravel boardwalk loop'),
      pathCard('path-route', 'route', '<rect x="4" y="4" width="48" height="48" rx="4" fill="#4a5a3a"/><path d="M8 46 C20 40 18 18 32 18 S48 12 50 8" stroke="#c58bff" stroke-width="3" stroke-dasharray="5 4" fill="none"/><path d="M44 6l6 2-3 6" stroke="#c58bff" stroke-width="3" fill="none"/>', 'Route', 'A route for the AI (never drawn in the game): bots driving vehicles follow it, NPC squads patrol it', 'route patrol waypoint npc guide ai vehicle follow'),
      // Drop routes (air drop): the transport plane's or a dropship's flight path. They are entities with a route
      // (placed like any marker, then "Draw route on the map"), drawn in and out of the map's boundary as you like.
      dropCard('path-drop-plane', 'airplane', '<rect x="4" y="4" width="48" height="48" rx="4" fill="#3a4a5a"/><path d="M4 40 C20 34 30 22 52 14" stroke="#e2703a" stroke-width="2.5" stroke-dasharray="5 4" fill="none"/><path d="M30 14l3 7v6l11 6v3l-11-3v7l4 3v2l-7-1-7 1v-2l4-3v-7l-11 3v-3l11-6v-6z" fill="#e2703a"/>', 'Plane Drop Route', 'A transport plane flying a route (battle-royale drop): place it, then Draw route; riders jump out over the map and parachute down', 'path route plane airplane drop air drop parachute battle royale fly'),
      dropCard('path-drop-dropship', 'airplane:dropship', '<rect x="4" y="4" width="48" height="48" rx="4" fill="#3a4a5a"/><path d="M4 40 C20 34 30 22 52 14" stroke="#e2703a" stroke-width="2.5" stroke-dasharray="5 4" fill="none"/><path d="M18 22h22l6 6-6 6H18l-5-6z" fill="#9fb3c4"/><rect x="22" y="25" width="12" height="6" fill="#5a6b7a"/>', 'Dropship Drop Route', 'A dropship flying a route in from off the map (drop ship): place it, then Draw route in and out of bounds; riders can only jump out over the map', 'path route dropship drop ship air drop parachute battle royale fly gunship'),
    );
    const pathPane = document.createElement('div');
    pathPane.id = 'ed-paths';
    pathGroup.after(pathPane);
    this.paths.renderPane(pathPane);
    const track = this.palette.group($('ed-mounts'), 'vehicles:track', 'Race Track');
    track.append(
      pathCard('path-race', 'race', '<path d="M8 50 C8 20 48 36 48 6" stroke="#3a3f48" stroke-width="12" fill="none"/><path d="M8 50 C8 20 48 36 48 6" stroke="#f2f2f2" stroke-width="1.5" stroke-dasharray="4 4" fill="none"/><path d="M40 4h12v4H40zM40 8h4v4h-4zM48 8h4v4h-4z" fill="#f2f2f2"/>', 'Race Track', 'Race track (Shift+G): a path used as the race track: click its points (a circuit at once), then set laps and the start grid in the Paths pane', 'road track race circuit lap checkpoint'),
    );

    // Palette (after the reference board): the top bar's workspace picks a row of sub-tabs, a sub-tab one pane;
    // search shows ranked matches from all of them instead.
    const tabs = $('ed-pal-tabs');
    const showPane = (pane: string) => {
      // Stay in the current workspace if it has this pane, else move to the first one that does.
      const all = [...tabs.querySelectorAll<HTMLElement>('.tab')];
      const btn = all.find((b) => b.dataset.pane === pane && b.dataset.ws === this.paletteWs) ?? all.find((b) => b.dataset.pane === pane);
      if (!btn) return;
      this.paletteWs = btn.dataset.ws!;
      for (const b of all) {
        b.hidden = b.dataset.ws !== this.paletteWs;
        b.classList.toggle('on', b === btn);
        b.setAttribute('aria-selected', String(b === btn));
      }
      for (const p of document.querySelectorAll<HTMLElement>('#ed-palette .ed-pane')) p.hidden = p.dataset.pane !== pane;
      $('ed-palette').dataset.cat = btn.dataset.cat ?? '';
      this.syncWorkspaceTabs();
    };
    this.showPane = showPane;
    tabs.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.tab');
      if (!b?.dataset.pane) return;
      this.paletteWs = b.dataset.ws!;
      // Picking a tab while searching goes back to browsing.
      const search = $<HTMLInputElement>('ed-search');
      if (search.value) {
        search.value = '';
        search.dispatchEvent(new Event('input'));
      }
      showPane(b.dataset.pane);
    });
    $('ed-modes').addEventListener('click', (e) => {
      const ws = (e.target as HTMLElement).closest<HTMLElement>('.tab')?.dataset.ws;
      if (ws) this.setWorkspace(ws);
    });
    this.buildPackPicker();
    this.palette.refresh();
    this.setTool({ kind: 'select' });
  }

  // ---------------------------------------------------------------- style packs

  /** The Style Pack the palette is narrowed to (null: every piece). */
  private stylePack: StylePack | null = null;

  /** The palette's Style Pack picker: each pack narrows tiles, props, gameplay pieces, vehicles and pickups to its own. */
  private buildPackPicker(): void {
    const sel = $<HTMLSelectElement>('ed-pack');
    for (const p of STYLE_PACKS) sel.append(new Option(`${p.number} ${p.displayName} (${p.style})`, p.id));
    const themeBtn = $<HTMLButtonElement>('ed-pack-theme');
    sel.addEventListener('change', () => {
      this.stylePack = getStylePack(sel.value) ?? null;
      themeBtn.hidden = !this.stylePack;
      const pack = this.stylePack;
      const note = $('ed-pack-note');
      note.hidden = !pack;
      note.textContent = pack ? `${pack.style}. ${pack.blurb} Dress rooms with the ${pack.facades.map((f) => FACADE_LABELS[f]).join(' or ')} facade in the tile inspector; demo map: ${pack.demo}.` : '';
      themeBtn.textContent = pack ? `Use theme (${coreThemes.get(pack.themes[0]!)?.displayName ?? pack.themes[0]})` : 'Use theme';
      // Gameplay pieces say what they are for in this pack.
      for (const b of document.querySelectorAll<HTMLElement>('#ed-palette .tile-btn[data-tool^="scenario:"]')) {
        if (b.dataset.baseTip === undefined) b.dataset.baseTip = b.dataset.tip ?? '';
        const why = pack?.gameplayNotes?.[b.dataset.tool!.slice('scenario:'.length) as ScenarioPaletteKey];
        this.palette.setTip(b, why ?? b.dataset.baseTip);
      }
      // Set pieces take the pack's look (its role pack), so their ghost re-themes; All pieces: the map theme's.
      this.pieceLook = pack ? (stylePackRoles(pack.id, this.setPieceLib.packs) ?? '') : '';
      this.renderPieceInfo();
      this.updateHover();
      this.filterPalette();
    });
    themeBtn.addEventListener('click', () => {
      const theme = this.stylePack?.themes[0];
      if (!theme || theme === this.doc.classicStructure.theme) return;
      this.run('Set theme', setThemeCommand(this.doc, theme));
      const picker = document.getElementById('ed-theme') as HTMLSelectElement | null;
      if (picker) picker.value = theme;
      this.toast(`Theme: ${coreThemes.get(theme)?.displayName ?? theme}`);
    });
  }

  /** Narrow the palette to the chosen Style Pack's pieces (search, favourites and recent follow it). */
  private filterPalette(): void {
    const pack = this.stylePack;
    const suits = (tool: string) => {
      // Set pieces go with a pack when one of the looks they suit is the pack's (roles.json); the rest by stylePackHas.
      if (!tool.startsWith('setpiece:')) return stylePackHas(pack!, tool);
      const def = this.pieceDef(tool.slice('setpiece:'.length));
      return !def || setPieceSuitsStylePack(def, pack!.id, this.setPieceLib.packs);
    };
    this.palette.filter(pack ? (b) => !b.dataset.tool || suits(b.dataset.tool) : null);
  }

  // ---------------------------------------------------------------- the map's own bots

  /**
   * The map's own bots (MapDocument.bots): names, looks, skills, styles, teams and squads for its PvP bots
   * or, in co-op, the players' side. They play unless the host picks a set of their own. The Bots window
   * (the one match setup and the pause menu use) edits them; one undo step per Apply.
   */
  /** Whether the Bot characters list is open (kept across re-renders). */
  private castOpen = false;

  private renderMapBots(el: HTMLElement): void {
    const doc = this.doc;
    const head = document.createElement('h3');
    head.textContent = 'Bots';
    const sum = text(doc.bots?.entries.length ? botSetLabel(mapBotSet(doc)) : 'Random bots');
    sum.id = 'ed-bots-sum';
    const open = button(doc.bots ? 'Edit bots…' : 'Name the bots…', () => {
      if (document.getElementById('bot-manager')) return;
      const main = doc.metadata.supportedModes[0] ?? 'core.deathmatch';
      const teams = isTeamMode(main) ? mapTeams(doc, main === 'core.ctf' ? 2 : (doc.teamSetup?.sizes.length ?? 2)) : [];
      const win = botManager({
        set: mapBotSet(doc),
        teams: teams.map((t) => ({ name: t.name, color: t.color })),
        presets: BOT_SET_PRESETS,
        applyLabel: 'Use for this map',
        note: "This map's own bots: they play unless the host picks a set of their own (Play → Match setup → Bots, or the pause menu).",
        onApply: (set) => {
          const after: MapBotSet | null = set ? { name: set.name, fill: set.fill, entries: set.entries.map((e) => ({ ...e })) } : null;
          this.run('Map bots', { kind: 'setMapBots', before: this.doc.bots ?? null, after });
        },
        onClose: () => document.getElementById('ed-bots-edit')?.focus(),
      });
      document.body.append(win);
    });
    open.id = 'ed-bots-edit';
    el.append(head, row('Bots', sum), row('', open), small('Name your bots, pick their looks, skill, style, team and squad: a scenario\'s cast, or the players\' squad in co-op.'));
    this.renderBotCast(el);
  }

  /**
   * Map properties: the map's default weapon set (MapDocument.weaponSet; sim/weaponSets.ts): what a match here spawns
   * with, what its weapon and grenade pickups hold and what drops, unless the host picks another. Standard (the
   * mode's own loadout, pickups as placed) leaves no `weaponSet` in the file.
   */
  private renderWeaponSet(el: HTMLElement): void {
    const now = mapWeaponSet(this.doc);
    const pick = document.createElement('select');
    pick.id = 'ed-prop-weapons';
    for (const s of weaponSetList()) {
      const o = new Option(s.name, s.id, false, s.id === now);
      o.title = s.blurb;
      pick.append(o);
    }
    pick.title = getWeaponSet(now).blurb;
    pick.addEventListener('change', () => {
      const after = pick.value === 'standard' ? null : pick.value;
      if (after !== (this.doc.weaponSet ?? null)) this.run('Weapon set', { kind: 'setWeaponSet', before: this.doc.weaponSet ?? null, after });
    });
    const hint = small(`${getWeaponSet(now).blurb} Hosts can pick another set (Play → Match setup → Weapons, the pause menu's Host tab).`);
    hint.id = 'ed-prop-weapons-hint';
    el.append(row('Weapon set', pick), hint);
  }

  /**
   * Bot characters (MapDocument.botCast): which looks the map's random bots wear, and so their names (a D-Day map:
   * soldiers only, named "Sgt. Dunmore"). Groups and/or name themes; none ticked: every look. Hosts can change it.
   */
  private renderBotCast(el: HTMLElement): void {
    const cast = validBotCast(this.doc.botCast);
    const set = (next: string[]) => this.run('Bot characters', { kind: 'setBotCast', before: this.doc.botCast ?? null, after: next.length ? next : null });
    const sum = text(botCastLabel(cast));
    sum.id = 'ed-cast-sum';
    const box = document.createElement('details');
    box.id = 'ed-cast';
    box.open = this.castOpen;
    box.addEventListener('toggle', () => (this.castOpen = box.open));
    const title = document.createElement('summary');
    title.textContent = 'Choose characters…';
    box.append(title);
    const group = (label: string, ids: readonly { id: string; label: string }[]) => {
      const h = document.createElement('small');
      h.textContent = label;
      h.style.display = 'block';
      h.style.marginTop = '4px';
      box.append(h);
      for (const c of ids) {
        const lab = document.createElement('label');
        lab.className = 'ed-cast-pick';
        lab.style.display = 'inline-flex';
        lab.style.gap = '4px';
        lab.style.marginRight = '10px';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.cast = c.id;
        cb.checked = cast.includes(c.id);
        cb.disabled = !cb.checked && cast.length >= BOT_CAST_MAX;
        cb.addEventListener('change', () => set(cb.checked ? [...cast, c.id] : cast.filter((x) => x !== c.id)));
        lab.append(cb, text(c.label));
        box.append(lab);
      }
    };
    group('Characters', BOT_CAST_CHOICES.filter((c) => CHARACTER_GROUPS.some((g) => g.id === c.id)));
    group('Named as', BOT_CAST_CHOICES.filter((c) => !CHARACTER_GROUPS.some((g) => g.id === c.id)));
    const all = button('All characters', () => set([]));
    all.id = 'ed-cast-all';
    all.disabled = !cast.length;
    el.append(row('Bot characters', sum), box, row('', all), small(`Random bots wear only these characters and take their names (${castLooks(cast).length} looks). None ticked: everyone. Hosts can change it (Match setup, pause menu, server rules).`));
  }

  // ---------------------------------------------------------------- teams

  /** Map properties in team modes: how many teams and how many players on each (2–8 teams of 1–16). */
  private renderTeamSetup(el: HTMLElement): void {
    const doc = this.doc;
    const sizes = doc.teamSetup?.sizes ?? [4, 4];
    const set = (label: string, next: number[]) => this.run(label, { kind: 'setTeamSetup', before: doc.teamSetup, after: { sizes: next } });
    const head = document.createElement('h3');
    head.textContent = `Teams · ${teamLayoutLabel(sizes)}`;
    el.append(head);
    const presets = document.createElement('select');
    presets.id = 'ed-team-preset';
    presets.append(new Option('Presets…', ''));
    for (const p of TEAM_PRESETS) presets.append(new Option(`${teamLayoutLabel(p)} (${p.reduce((a, b) => a + b, 0)} players)`, p.join(',')));
    presets.addEventListener('change', () => presets.value && set('Set teams', presets.value.split(',').map(Number)));
    el.append(row('Layout', presets));
    const teams = mapTeams(doc, sizes.length);
    teams.forEach((t, i) => {
      const input = numberInput(sizes[i] ?? 1, 1, (v) => set('Set team size', sizes.map((s, j) => (j === i ? Math.max(1, Math.min(48, Math.round(v))) : s))));
      input.dataset.team = t.id;
      const label = document.createElement('span');
      label.innerHTML = `<span style="color:${t.color}">●</span> ${escapeHtml(t.name)}`;
      const r = row('', input);
      r.firstElementChild?.replaceWith(label);
      el.append(r);
    });
    const buttons = document.createElement('div');
    buttons.className = 'ed-row-buttons';
    const add = button('+ Team', () => set('Add team', [...sizes, sizes[sizes.length - 1] ?? 2]));
    add.id = 'ed-team-add';
    add.disabled = sizes.length >= MAX_TEAMS;
    const remove = button('− Team', () => set('Remove team', sizes.slice(0, -1)));
    remove.disabled = sizes.length <= 2;
    buttons.append(add, remove);
    const total = sizes.reduce((a, b) => a + b, 0);
    el.append(buttons, small(`${total} players in all${total > 32 ? ' (a match holds 32: the biggest teams will be short)' : ''}. Bots fill every team to its size in TEST and the Arcade.`));
  }

  // ---------------------------------------------------------------- backdrop

  /** What surrounds the map: sky, distant scenery, ground past the border and haze (the theme's unless set). */
  private renderBackdropPanel(el: HTMLElement): void {
    const head = document.createElement('h3');
    head.id = 'ed-backdrop-head';
    head.textContent = 'Backdrop';
    el.append(head);
    const own = this.doc.backdrop;
    const b = resolveBackdrop(this.doc);
    const set = (label: string, after: Backdrop | null) => this.run(label, { kind: 'setBackdrop', before: this.doc.backdrop, after });
    const patch = (p: Partial<Backdrop>) => set('Change backdrop', { ...b, ...p });
    const select = (id: string, options: readonly (readonly [string, string])[], value: string, change: (v: string) => void) => {
      const sel = document.createElement('select');
      sel.id = id;
      for (const [v, label] of options) sel.append(new Option(label, v, false, v === value));
      sel.addEventListener('change', () => change(sel.value));
      return sel;
    };
    el.append(
      row('Sky', select('ed-bd-sky', SKY_IDS.map((id) => [id, SKIES.get(id)?.name ?? id] as const), b.sky, (v) => patch({ sky: v as SkyId }))),
      row('Scenery', select('ed-bd-scenery', SCENERY_IDS.map((id) => [id, SCENERY_LABELS[id]] as const), b.scenery, (v) => patch({ scenery: v as SceneryId }))),
      row(
        'Ground beyond',
        select('ed-bd-ground', BACKDROP_GROUNDS.map((g) => [g, g === 'water' ? 'Water' : g === 'none' ? 'None (open sky)' : TERRAIN_MATERIAL_LABELS[g]] as const), b.ground, (v) => patch({ ground: v as BackdropGround })),
      ),
    );
    const haze = document.createElement('input');
    haze.type = 'range';
    haze.min = '0';
    haze.max = '100';
    haze.step = '5';
    haze.value = String(Math.round(b.haze * 100));
    haze.id = 'ed-bd-haze';
    haze.addEventListener('change', () => patch({ haze: Number(haze.value) / 100 }));
    el.append(row('Haze', haze));
    const mist = document.createElement('input');
    mist.type = 'range';
    mist.min = '0';
    mist.max = '100';
    mist.step = '5';
    mist.value = String(Math.round((b.mist ?? 0) * 100));
    mist.id = 'ed-bd-mist';
    mist.title = 'Fog that pools in low ground (valleys, ditches, the canyon floor) and thins with height. Medium and high graphics.';
    mist.addEventListener('change', () => patch({ mist: Number(mist.value) / 100 }));
    el.append(row('Ground mist', mist));
    // Border: what stands just outside the boundary (one style, or one per side).
    const borderOptions = BORDER_STYLES.map((st) => [st, BORDER_LABELS[st]] as const);
    el.append(
      row(
        'Border',
        select('ed-bd-border', borderOptions, b.border ?? 'none', (v) => {
          const { border: _border, borderSides: _sides, ...rest } = b;
          set('Change border', v === 'none' ? rest : { ...rest, border: v as BorderStyle });
        }),
      ),
    );
    const sides = document.createElement('details');
    sides.id = 'ed-bd-border-sides';
    sides.open = !!b.borderSides && Object.keys(b.borderSides).length > 0;
    const summary = document.createElement('summary');
    summary.textContent = 'Per side';
    sides.append(summary);
    for (const side of BORDER_SIDES) {
      const label = side[0]!.toUpperCase() + side.slice(1);
      const value = b.borderSides?.[side];
      sides.append(
        row(
          label,
          select(`ed-bd-border-${side}`, [['', 'Same as border'], ...borderOptions], value ?? '', (v) => {
            const next = { ...(b.borderSides ?? {}) };
            if (v) next[side] = v as BorderStyle;
            else delete next[side];
            const { borderSides: _sides, ...rest } = b;
            set('Change border', Object.keys(next).length ? { ...rest, borderSides: next } : rest);
          }),
        ),
      );
    }
    el.append(sides);
    if (hasBorder(this.doc) && !borderRect(this.doc)) el.append(small('A border stands along the map boundary: set one with the Boundary tool.'));
    if (own) el.append(button('Use the theme\'s backdrop', () => set('Theme backdrop', null)));
    el.append(small(own ? (hasBorder(this.doc) ? 'The border is solid (the fence zaps); the rest is drawn only.' : 'Drawn only: nothing out there blocks players or shots.') : "Following the theme. Change anything to give this map its own."));
  }

  private settleProps(ids?: readonly string[]): void {
    const cmd = settlePropsCommand(this.doc, ids);
    if (cmd.kind === 'updateEntities' && cmd.after.length === 0) return this.toast('Already on the ground');
    if (this.run('Settle props', cmd)) this.toast(`Settled ${cmd.kind === 'updateEntities' ? cmd.after.length : 0} props`);
  }

  // ---------------------------------------------------------------- blood

  /** Blood colour and amount for this map (red and light unless set): green for aliens, black oil for robots, or none. */
  private renderBloodPanel(el: HTMLElement): void {
    const head = document.createElement('h3');
    head.textContent = 'Blood';
    el.append(head);
    const b: BloodSettings = this.doc.blood ?? { ...DEFAULT_BLOOD };
    const set = (after: BloodSettings | null) => this.run('Change blood', { kind: 'setBlood', before: this.doc.blood, after });
    const color = document.createElement('input');
    color.type = 'color';
    color.id = 'ed-blood-color';
    color.value = b.color;
    color.addEventListener('change', () => set({ ...b, color: color.value }));
    const amount = document.createElement('select');
    amount.id = 'ed-blood-amount';
    const labels: Record<(typeof BLOOD_AMOUNTS)[number], string> = { off: 'None', light: 'Light', heavy: 'Heavy' };
    for (const a of BLOOD_AMOUNTS) amount.append(new Option(labels[a], a, false, a === b.amount));
    amount.addEventListener('change', () => set({ ...b, amount: amount.value as BloodSettings['amount'] }));
    el.append(row('Colour', color), row('Amount', amount));
    const swatches = document.createElement('div');
    swatches.className = 'ed-row-buttons';
    for (const [label, hex] of [['Red', '#8a0b0b'], ['Alien', '#3f9b1f'], ['Oil', '#1b1b1f'], ['Ichor', '#d7b21a'], ['Coolant', '#2a7fd0']] as const) {
      const sw = button(label, () => set({ ...b, color: hex }));
      sw.style.borderLeft = `10px solid ${hex}`;
      swatches.append(sw);
    }
    el.append(swatches);
    if (this.doc.blood) el.append(button('Default blood', () => set(null)));
    el.append(small('Hit sprays, splats and pools. Players can still switch blood off in the pause menu.'));
  }

  // ---------------------------------------------------------------- gravity and falls

  /** Map physics: gravity (moon to heavy) and fall damage; arcade and servers can override both. */
  private renderPhysicsPanel(el: HTMLElement): void {
    const head = document.createElement('h3');
    head.textContent = 'Gravity & falls';
    el.append(head);
    const p: MapPhysics = this.doc.physics ?? { gravity: 1, fallDamage: false };
    const set = (after: MapPhysics) => this.run('Change physics', { kind: 'setPhysics', before: this.doc.physics, after: after.gravity === 1 && !after.fallDamage ? null : after });
    const gravity = document.createElement('select');
    gravity.id = 'ed-gravity';
    for (const [v, label] of [[0.25, 'Moon (¼)'], [0.5, 'Low (½)'], [0.75, 'Light (¾)'], [1, 'Normal'], [1.5, 'Heavy (1½×)'], [2, 'Crushing (2×)']] as const) gravity.append(new Option(label, String(v), false, Math.abs(p.gravity - v) < 0.01));
    gravity.addEventListener('change', () => set({ ...p, gravity: Number(gravity.value) }));
    const fall = document.createElement('select');
    fall.id = 'ed-fall-damage';
    fall.append(new Option('Off', 'off', false, !p.fallDamage), new Option('On', 'on', false, p.fallDamage));
    fall.addEventListener('change', () => set({ ...p, fallDamage: fall.value === 'on' }));
    el.append(row('Gravity', gravity), row('Fall damage', fall));
    el.append(small('Gravity changes jumps, falls and jump-pad arcs. With fall damage on, drops past about 5 m hurt and about 16 m kill (jump pads, ladders and water are safe). Match settings can override both.'));
    // Glass: when shattered panes come back.
    const back = document.createElement('select');
    back.id = 'ed-glass-respawn';
    const now = this.doc.glass?.respawnSeconds ?? null;
    for (const [v, label] of [[null, 'Next round'], [15, 'After 15 s'], [30, 'After 30 s'], [60, 'After 1 min'], [120, 'After 2 min']] as const) back.append(new Option(label, v === null ? '' : String(v), false, now === v));
    back.addEventListener('change', () => this.run('Glass respawn', { kind: 'setGlass', before: this.doc.glass ?? null, after: back.value ? { respawnSeconds: Number(back.value) } : null }));
    el.append(row('Broken glass returns', back));
  }

  // ---------------------------------------------------------------- boundary

  /** Map properties: walls round the play area, fitted to the map in one click. */
  private renderBoundsPanel(el: HTMLElement): void {
    const doc = this.doc;
    const head = document.createElement('h3');
    head.textContent = 'Boundary';
    el.append(head);
    const b = doc.bounds;
    const style = document.createElement('select');
    style.id = 'ed-bounds-style';
    for (const [v, label] of [['', 'None'], ['invisible', 'Invisible walls'], ['wall', 'Solid walls'], ['fence', 'Tall fence']] as const) style.append(new Option(label, v, false, (b?.style ?? '') === v));
    const set = (label: string, after: MapDocument['bounds']) => this.run(label, { kind: 'setBounds', before: this.doc.bounds, after });
    style.addEventListener('change', () => {
      if (!style.value) return set('Remove boundary', null);
      const fit = b ?? fitBounds(this.doc, 4);
      if (!fit) return this.toast('Build something first: the boundary fits round the map', true);
      set('Set boundary', { min: fit.min, max: fit.max, style: style.value as BoundaryStyle, height: b?.height ?? 8 });
    });
    el.append(row('Walls', style));
    if (b) {
      const fitBtn = button('Fit to map', () => {
        const fit = fitBounds(this.doc, 4);
        if (fit) set('Fit boundary', { ...b, ...fit });
      });
      fitBtn.id = 'ed-bounds-fit';
      const edge = (label: string, v: number, patch: (v: number) => Partial<NonNullable<MapDocument['bounds']>>) => row(label, numberInput(v, 1, (n) => set('Move boundary', { ...b, ...patch(n) })));
      el.append(
        edge('West (X)', b.min[0], (v) => ({ min: [Math.min(v, b.max[0] - 4), b.min[1]] })),
        edge('East (X)', b.max[0], (v) => ({ max: [Math.max(v, b.min[0] + 4), b.max[1]] })),
        edge('South (Z)', b.min[1], (v) => ({ min: [b.min[0], Math.min(v, b.max[1] - 4)] })),
        edge('North (Z)', b.max[1], (v) => ({ max: [b.max[0], Math.max(v, b.min[1] + 4)] })),
      );
      if (b.style !== 'invisible') el.append(edge('Height (m)', b.height, (v) => ({ height: Math.max(1, Math.min(60, v)) })));
      el.append(fitBtn, small('Nothing gets past the boundary: players, bots, shots or grenades. The orange outline shows it in MapMaker.'));
    } else el.append(small('Fence the map in: pick a style and the boundary fits round everything you have built.'));
  }

  // ---------------------------------------------------------------- terrain

  private setTerrainBrush(brush: TerrainBrush): void {
    this.terrainBrush = brush;
    this.setTool({ kind: 'terrain' });
    for (const b of document.querySelectorAll<HTMLElement>('[data-ground]')) b.classList.toggle('active', brush === 'paint' && b.dataset.ground === this.terrainMaterial);
    for (const b of document.querySelectorAll<HTMLElement>('[data-foliage]')) b.classList.toggle('active', brush === 'foliage' && Number(b.dataset.foliage) === this.foliageLevel);
  }

  private setBrushRadius(r: number): void {
    this.brushRadius = Math.max(2, Math.min(40, r));
    for (const id of ['ed-tr-radius', 'ed-sc-radius']) {
      $<HTMLInputElement>(id).value = String(this.brushRadius);
      $(`${id}-v`).textContent = `${this.brushRadius} m`;
    }
    this.updateHover();
  }

  private startStroke(invert: boolean): void {
    const t = this.doc.terrain;
    if (!t || !this.terrainHover) return;
    if (invert && (this.terrainBrush === 'raise' || this.terrainBrush === 'lower')) this.terrainBrush = this.terrainBrush === 'raise' ? 'lower' : 'raise';
    // The brush works on the document's own ground; Flatten levels it to the height under the pointer as shown.
    // Flatten to the height typed in the Terrain tab, else to the height where the stroke starts.
    const typed = $<HTMLInputElement>('ed-tr-flatten-y').value.trim();
    const target = typed !== '' && Number.isFinite(Number(typed)) ? Number(typed) : this.terrainHover.y;
    this.stroke = { before: t, now: t, shown: this.view.ground ?? t, target, seed: (Math.random() * 1e9) | 0 };
    this.strokeStep(1 / 30);
  }

  /** Apply the brush for one frame; heights change at a steady rate however fast the pointer moves. */
  private strokeStep(dt: number): void {
    const s = this.stroke!;
    const h = this.terrainHover;
    if (!h) return;
    const rate = this.brushStrength;
    const strength = this.terrainBrush === 'raise' || this.terrainBrush === 'lower' ? rate * 6 * dt : this.terrainBrush === 'roughen' ? rate * 1.5 * dt : Math.min(1, rate * 8 * dt);
    s.now = applyBrush(s.now, { brush: this.terrainBrush, x: h.x, z: h.z, radius: this.brushRadius, strength, target: s.target, material: this.terrainMaterial, level: this.foliageLevel, seed: s.seed });
    // Shown kept under the floors as it is sculpted (the paths are laid in again on release).
    s.shown = this.groundShownFor(s.now, false);
    this.view.previewTerrain({ ...this.viewDoc, terrain: s.shown });
    if (this.terrainBrush !== 'paint' && this.terrainBrush !== 'foliage') {
      const y = terrainHeightAt(s.shown, h.x, h.z);
      if (y !== null) this.terrainHover = { ...h, y };
    }
    this.updateHover();
  }

  private endStroke(): void {
    const s = this.stroke;
    if (!s) return;
    this.stroke = null;
    const label = this.terrainBrush === 'paint' ? `Paint ${TERRAIN_MATERIAL_LABELS[this.terrainMaterial]}` : this.terrainBrush === 'foliage' ? `Plants: ${FOLIAGE_LEVELS[this.foliageLevel]}` : `Terrain ${this.terrainBrush}`;
    if (s.now !== s.before) this.run(label, { kind: 'setTerrain', before: s.before, after: s.now });
  }

  private setTerrain(label: string, after: TerrainData | null): void {
    this.run(label, { kind: 'setTerrain', before: this.doc.terrain, after });
    this.setTerrainBrush(this.terrainBrush);
  }

  /**
   * Terrain → Smooth all: the whole ground smoothed in one undo step (a Gaussian of `sigma` metres: bumps and
   * pits go, slopes and hills keep their shape). With `keepUnderBlocks`, the ground under every block that
   * stands on it (bottom within 0.5 m of the ground, or below it) and 1.5 m round stays as it is, so halls on
   * levelled pads, walls and kerbs neither float nor sink; the smoothed ground meets it without a step.
   * Spawns, pickups, flags, hills, vehicles and props standing on the ground (within 30 cm over it or 1.5 m
   * into it) move up or down with it, in the same undo step.
   */
  private smoothAllTerrain(sigma: number, keepUnderBlocks: boolean): void {
    const t = this.doc.terrain;
    if (!t || !(sigma > 0)) return;
    let hold: Uint8Array | undefined;
    if (keepUnderBlocks) {
      const feet: [number, number][][] = [];
      for (const e of this.doc.entities) {
        if (e.kind !== 'block') continue;
        const ground = terrainHeightAt(t, e.position[0], e.position[2]);
        if (ground === null || e.position[1] > ground + 0.5) continue;
        feet.push(boxFootprint(blockBox(e)));
      }
      hold = terrainHoldMask(t, feet, 1.5);
    }
    const after = smoothTerrain(t, sigma, hold);
    let moved = 0;
    for (let i = 0; i < t.heights.length; i++) if (after.heights[i] !== t.heights[i]) moved++;
    if (!moved) return this.toast('The ground is already smooth');
    const carried = new Set<MapEntity['kind']>(['spawn', 'pickup', 'prop', 'mount', 'flag', 'hill']);
    const before: MapEntity[] = [];
    const moves: MapEntity[] = [];
    // Props are bedded on the document's own ground (and drawn and played re-bedded on the ground as shown); the
    // rest stand on the ground as shown, kept under the floors, so they move as that does.
    const shownBefore = this.view.ground ?? t;
    const shownAfter = this.groundShownFor(after);
    for (const e of this.doc.entities) {
      if (!carried.has(e.kind)) continue;
      const was = terrainHeightAt(e.kind === 'prop' ? t : shownBefore, e.position[0], e.position[2]);
      const now = terrainHeightAt(e.kind === 'prop' ? after : shownAfter, e.position[0], e.position[2]);
      if (was === null || now === null || Math.abs(now - was) < 0.005) continue;
      const above = e.position[1] - was;
      if (above > 0.3 || above < -1.5) continue;
      before.push(e);
      moves.push({ ...e, position: [e.position[0], Math.round((e.position[1] + now - was) * 1000) / 1000, e.position[2]] } as MapEntity);
    }
    const terrainCmd: EditCommand = { kind: 'setTerrain', before: t, after };
    this.run('Smooth all terrain', moves.length ? { kind: 'batch', commands: [terrainCmd, { kind: 'updateEntities', before, after: moves }] } : terrainCmd);
    this.setTerrainBrush(this.terrainBrush);
    this.toast(`Smoothed the terrain${hold ? ' (ground under blocks kept)' : ''}${moves.length ? `; ${moves.length} things on the ground moved with it` : ''} · Ctrl+Z undoes it`);
  }

  private syncTerrainUi(): void {
    const t = this.doc.terrain;
    $('ed-tr-create').hidden = !!t;
    $('ed-tr-edit').hidden = !t;
    if (t) {
      $<HTMLInputElement>('ed-tr-boundary').checked = t.boundary;
      $('ed-tr-size').textContent = `${((t.cols - 1) * t.spacing).toFixed(0)} × ${((t.rows - 1) * t.spacing).toFixed(0)} m · ${t.spacing} m grid`;
      $<HTMLSelectElement>('ed-tr-base').value = TERRAIN_MATERIALS[mainGround(t)] ?? 'grass';
    }
  }

  /** The trace image laid over the ground (owner, editor-only, never saved). */
  private trace: TraceImage | null = null;

  private setTrace(t: TraceImage | null): void {
    if (this.trace && this.trace.url !== t?.url) URL.revokeObjectURL(this.trace.url);
    this.trace = t;
    this.view.setTrace(t);
    const box = document.getElementById('ed-trace-place');
    if (box) box.hidden = !t;
  }

  /**
   * Terrain → Real places (owner only, like Publish: players never bring files into a map). Heights from a
   * height grid file (an ESRI ASCII grid in map metres: heightGrid.ts) become the terrain in one undo step; a
   * trace image (a plan or survey drawing of the place) lies over the ground to build on, and is never saved.
   */
  private buildRealPlaceTools(): void {
    const pane = document.querySelector<HTMLElement>('.ed-pane[data-pane="terrain"]');
    if (!pane) return;
    const box = document.createElement('div');
    box.id = 'ed-tr-real';
    box.className = 'ed-owner-only';
    box.hidden = !this.owner;
    const num = (id: string, label: string, title: string) => {
      const l = document.createElement('label');
      l.className = 'stack';
      l.title = title;
      const i = document.createElement('input');
      i.id = id;
      i.type = 'number';
      i.step = 'any';
      l.append(label, i);
      return { l, i };
    };
    const file = (id: string, accept: string) => {
      const i = document.createElement('input');
      i.id = id;
      i.type = 'file';
      i.accept = accept;
      i.hidden = true;
      return i;
    };
    const button = (id: string, text: string, title: string) => {
      const b = document.createElement('button');
      b.id = id;
      b.textContent = text;
      b.title = title;
      return b;
    };
    const head = document.createElement('div');
    head.className = 'sub-h';
    head.textContent = 'Real places (owner)';
    const note = small('Build a real place to scale: its ground from a height grid file (ESRI ASCII .asc in metres, x east, y north, in map metres), and a plan or map of it laid over the ground to trace. Neither file is kept in the map.');
    const datum = num('ed-tr-datum', 'Ground level: file height at y 0 (m)', 'Blank: the height at the centre point (0, 0)');
    datum.i.placeholder = 'auto';
    const smoothing = document.createElement('select');
    smoothing.id = 'ed-tr-heights-smooth';
    for (const s of HEIGHT_GRID_SMOOTHING) smoothing.append(new Option(s.label, String(s.sigma), false, s.sigma === DEFAULT_HEIGHT_GRID_SMOOTHING));
    const smoothLabel = document.createElement('label');
    smoothLabel.className = 'stack';
    smoothLabel.title = 'Survey grids (lidar) carry small bumps: kerbs, hedges, cars, building edges. Smoothing averages them away over about this distance; banks, bluffs and knolls keep their shape. Off: the file as it is';
    smoothLabel.append('Smoothing', smoothing);
    const heightsFile = file('ed-tr-heights-file', '.asc,.txt');
    const heights = button('ed-tr-heights', 'Heights from a height grid file…', 'Replace the terrain with the heights in an ESRI ASCII grid (.asc); ground paint and plants are kept where the old terrain reached');
    heights.addEventListener('click', () => heightsFile.click());
    heightsFile.addEventListener('change', async () => {
      const f = heightsFile.files?.[0];
      heightsFile.value = '';
      if (!f) return;
      if (f.size > MAX_HEIGHT_GRID_BYTES) return this.toast('Height grid: the file is larger than 32 MB', true);
      const grid = parseAsciiGrid(await f.text());
      if ('error' in grid) return this.toast(`Height grid: ${grid.error}`, true);
      const typed = datum.i.value.trim() === '' ? null : Number(datum.i.value);
      const r = terrainFromHeightGrid(grid, { current: this.doc.terrain, datum: typed !== null && Number.isFinite(typed) ? typed : null, smoothing: Number(smoothing.value) });
      this.setTerrain(`Heights from ${f.name}`, r.terrain);
      if (typed === null) datum.i.value = String(Math.round(r.datum * 100) / 100);
      const t = r.terrain;
      this.toast(`Heights from ${f.name}: ${((t.cols - 1) * t.spacing).toFixed(0)} × ${((t.rows - 1) * t.spacing).toFixed(0)} m, ${t.spacing} m grid${r.resampled ? ' (averaged to fit)' : ''}${Number(smoothing.value) ? `, smoothed over ${smoothing.value} m` : ''}; y 0 is ${r.datum.toFixed(2)} m`);
    });
    const traceHead = document.createElement('div');
    traceHead.className = 'sub-h';
    traceHead.textContent = 'Trace image';
    // The picture is chosen through a file box that is never part of the page (MapMaker has no image upload:
    // the picture stays in this browser tab, is never saved into the map and never sent anywhere).
    const traceFile = document.createElement('input');
    traceFile.type = 'file';
    traceFile.accept = 'image/png,image/jpeg,image/webp';
    const trace = button('ed-trace', 'Trace image…', 'Lay a picture (a plan or map of the place, north up) over the ground to build on; editing only, never saved');
    trace.addEventListener('click', () => traceFile.click());
    const place = document.createElement('div');
    place.id = 'ed-trace-place';
    place.hidden = true;
    const west = num('ed-trace-x0', 'West edge x', 'Map x of the picture\'s left edge');
    const east = num('ed-trace-x1', 'East edge x', 'Map x of the picture\'s right edge');
    const south = num('ed-trace-z0', 'South edge z', 'Map z of the picture\'s bottom edge');
    const north = num('ed-trace-z1', 'North edge z', 'Map z of the picture\'s top edge');
    const opacity = document.createElement('input');
    opacity.id = 'ed-trace-opacity';
    opacity.type = 'range';
    opacity.min = '10';
    opacity.max = '100';
    opacity.value = '60';
    const opLabel = document.createElement('label');
    opLabel.className = 'stack';
    opLabel.append('Opacity', opacity);
    const clear = button('ed-trace-clear', 'Remove trace image', 'Take the picture away (it was never part of the map)');
    clear.addEventListener('click', () => this.setTrace(null));
    const apply = () => {
      if (!this.trace) return;
      const v = (i: HTMLInputElement, d: number) => (i.value.trim() !== '' && Number.isFinite(Number(i.value)) ? Number(i.value) : d);
      this.setTrace({ ...this.trace, x0: v(west.i, this.trace.x0), x1: v(east.i, this.trace.x1), z0: v(south.i, this.trace.z0), z1: v(north.i, this.trace.z1), opacity: Number(opacity.value) / 100 });
    };
    for (const i of [west.i, east.i, south.i, north.i, opacity]) i.addEventListener('input', apply);
    traceFile.addEventListener('change', () => {
      const f = traceFile.files?.[0];
      traceFile.value = '';
      if (!f) return;
      if (!f.type.startsWith('image/')) return this.toast('Trace image: choose a PNG, JPEG or WebP picture', true);
      // At first it covers the terrain (or 100 m round the centre); type the real edges in to place it.
      const t = this.doc.terrain;
      const rect = t ? { x0: t.origin[0], z0: t.origin[1], x1: t.origin[0] + (t.cols - 1) * t.spacing, z1: t.origin[1] + (t.rows - 1) * t.spacing } : { x0: -50, z0: -50, x1: 50, z1: 50 };
      const keep = this.trace;
      this.setTrace({ url: URL.createObjectURL(f), ...(keep ? { x0: keep.x0, z0: keep.z0, x1: keep.x1, z1: keep.z1 } : rect), opacity: Number(opacity.value) / 100 });
      const r = this.trace!;
      west.i.value = String(r.x0);
      east.i.value = String(r.x1);
      south.i.value = String(r.z0);
      north.i.value = String(r.z1);
      this.toast(`Trace image ${f.name}: type its edges in (map metres) to line it up; it is never saved`);
    });
    place.append(west.l, east.l, south.l, north.l, opLabel, clear);
    box.append(head, note, datum.l, smoothLabel, heights, heightsFile, traceHead, trace, place);
    pane.append(box);
  }

  private buildTerrainPalette(): void {
    this.buildRealPlaceTools();
    const icons: Record<TerrainBrush, string> = {
      raise: '<path d="M6 46 Q28 6 50 46Z" fill="#8fbf5a"/><path d="M28 12v-6m-5 5l5-5 5 5" stroke="#ffd34d" stroke-width="3" fill="none"/>',
      lower: '<path d="M6 20 Q28 56 50 20V50H6Z" fill="#8a6a3f"/><path d="M28 8v10m-5-5l5 5 5-5" stroke="#ff7a4d" stroke-width="3" fill="none"/>',
      smooth: '<path d="M6 40 Q18 30 28 34 T50 32V50H6Z" fill="#8fbf5a"/><path d="M8 18 Q18 12 28 18 T48 18" stroke="#7fd8ff" stroke-width="3" fill="none"/>',
      flatten: '<path d="M6 36 L18 30 L38 30 L50 38V50H6Z" fill="#8fbf5a"/><path d="M12 22h32" stroke="#c7a6ff" stroke-width="3"/>',
      roughen: '<path d="M6 40 L12 32 L17 38 L23 26 L29 36 L35 28 L41 37 L50 30V50H6Z" fill="#7d8a5a"/>',
      paint: '<rect x="8" y="30" width="40" height="18" fill="#c9a36b"/><path d="M34 8l10 10-14 14-10-10z" fill="#dfe6ee"/><path d="M20 22l10 10-6 4-8-8z" fill="#8fbf5a"/>',
      foliage: '<rect x="6" y="40" width="44" height="10" fill="#8a6a3f"/><path d="M12 42 Q14 26 18 18 Q18 30 20 42Z M22 42 Q26 22 30 12 Q30 28 31 42Z M33 42 Q37 28 44 22 Q40 32 40 42Z" fill="#6fbf4a"/><circle cx="18" cy="16" r="3" fill="#ff6a8a"/>',
    };
    const brushes = $('ed-tr-brushes');
    for (const brush of TERRAIN_BRUSHES) {
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = `terrain:${brush}`;
      const label = `${brush[0]!.toUpperCase()}${brush.slice(1)}`;
      b.innerHTML = `<svg viewBox="0 0 56 56">${icons[brush]}</svg>${label}`;
      b.addEventListener('click', () => this.setTerrainBrush(brush));
      brushes.append(b);
      this.palette.register(b, { key: b.dataset.tool, name: `${label} terrain`, tags: 'terrain ground sculpt brush' });
    }
    const grounds = $('ed-tr-materials');
    for (const m of TERRAIN_MATERIALS) {
      const def = coreMaterials.get(TERRAIN_SURFACES[m]);
      const b = document.createElement('button');
      b.className = 'mat-btn';
      b.dataset.ground = m;
      b.title = `Paint the ground with ${TERRAIN_MATERIAL_LABELS[m]}`;
      b.innerHTML = `${def ? `<img alt="" src="${materialThumbnail(def)}">` : ''}<span class="lbl">${TERRAIN_MATERIAL_LABELS[m]}</span>`;
      b.addEventListener('click', () => {
        this.terrainMaterial = m;
        this.setTerrainBrush('paint');
      });
      grounds.append(b);
      this.palette.register(b, { key: `ground:${m}`, name: `${TERRAIN_MATERIAL_LABELS[m]} ground`, tags: 'ground terrain paint material' });
    }
    const levels = $('ed-tr-foliage');
    FOLIAGE_LEVELS.forEach((label, level) => {
      const b = document.createElement('button');
      b.dataset.foliage = String(level);
      b.textContent = label;
      b.title = ['No plants', 'A few tufts of grass', 'Grass and the odd flower', 'Thick grass, flowers and shrubs', 'Long grass, flowers and bushes'][level]!;
      b.addEventListener('click', () => {
        this.foliageLevel = level;
        this.setTerrainBrush('foliage');
      });
      levels.append(b);
    });
    $('ed-tr-foliage-auto').addEventListener('click', () => {
      if (this.doc.terrain?.foliage.length) this.setTerrain('Plants follow the ground', { ...this.doc.terrain, foliage: [] });
    });
    $('ed-tr-new').addEventListener('click', () => {
      const size = Number($<HTMLSelectElement>('ed-tr-new-size').value);
      const ground = $<HTMLSelectElement>('ed-tr-new-ground').value as TerrainMaterial;
      // Width and depth, when typed, make an oblong terrain (32-400 m each way); the grid widens past 320 m.
      const side = (id: string) => {
        const v = Number($<HTMLInputElement>(id).value);
        return $<HTMLInputElement>(id).value.trim() !== '' && Number.isFinite(v) ? Math.max(32, Math.min(400, v)) : size;
      };
      const width = side('ed-tr-new-w');
      const depth = side('ed-tr-new-d');
      // Just under ground-floor tiles, so the two never fight for the same pixels.
      this.setTerrain('Create terrain', { ...newTerrain(width, terrainSpacingFor(width, depth), [0, 0], ground, depth), baseY: -0.15 });
    });
    for (const m of TERRAIN_MATERIALS) $<HTMLSelectElement>('ed-tr-new-ground').append(new Option(TERRAIN_MATERIAL_LABELS[m], m, m === 'grass', m === 'grass'));
    $('ed-tr-remove').addEventListener('click', () => {
      // Undoable like every edit (Ctrl+Z), so no question first.
      this.setTerrain('Remove terrain', null);
      this.toast('Terrain removed · Ctrl+Z brings it back');
    });
    for (const m of TERRAIN_MATERIALS) $<HTMLSelectElement>('ed-tr-base').append(new Option(TERRAIN_MATERIAL_LABELS[m], m));
    $('ed-tr-base-set').addEventListener('click', () => {
      const t = this.doc.terrain;
      if (!t) return;
      const to = TERRAIN_MATERIALS.indexOf($<HTMLSelectElement>('ed-tr-base').value as TerrainMaterial);
      const from = mainGround(t);
      if (to < 0 || to === from) return;
      // Undoable, one step: the main ground becomes the new one; cells painted another material keep it.
      this.setTerrain(`Main ground: ${TERRAIN_MATERIAL_LABELS[TERRAIN_MATERIALS[to]!]}`, { ...t, materials: t.materials.map((m) => (m === from ? to : m)) });
    });
    $('ed-tr-smooth-all').addEventListener('click', () => this.smoothAllTerrain(Number($<HTMLSelectElement>('ed-tr-smooth-all-amount').value), $<HTMLInputElement>('ed-tr-smooth-hold').checked));
    $('ed-tr-cliffs').addEventListener('click', () => {
      if (this.doc.terrain) this.setTerrain('Paint cliffs as stone', paintSlopes(this.doc.terrain, 35, 'stone'));
    });
    $<HTMLInputElement>('ed-tr-boundary').addEventListener('change', (e) => {
      if (this.doc.terrain) this.setTerrain('Terrain boundary', { ...this.doc.terrain, boundary: (e.target as HTMLInputElement).checked });
    });
    $<HTMLInputElement>('ed-tr-radius').addEventListener('input', (e) => this.setBrushRadius(Number((e.target as HTMLInputElement).value)));
    $<HTMLInputElement>('ed-tr-strength').addEventListener('input', (e) => {
      this.brushStrength = Number((e.target as HTMLInputElement).value) / 100;
      $('ed-tr-strength-v').textContent = `${Math.round(this.brushStrength * 100)}%`;
    });
    this.syncTerrainUi();
  }

  /** Vehicles and turrets in the Entities tab (pictures from the atlas), then parked vehicles (props). */
  private buildMountPalette(): void {
    const groups = {
      vehicle: this.palette.group($('ed-mounts'), 'vehicles:drive', 'Vehicles', { note: 'Players get in and out with E. Seats, team and paint in the inspector.' }),
      turret: this.palette.group($('ed-mounts'), 'vehicles:turrets', 'Turrets & Sentries'),
    };
    for (const id of MOUNT_MODELS) {
      const def = MOUNT_DEFS[id];
      const b = document.createElement('button');
      b.className = 'tile-btn prop-btn';
      b.dataset.tool = `mount:${id}`;
      b.title = `${def.displayName}: ${def.blurb}\n${def.seats.length} seat${def.seats.length === 1 ? '' : 's'}`;
      b.append(document.createTextNode(`${def.displayName}${def.seats.length ? ` · ${def.seats.length}` : ''}`));
      b.addEventListener('click', () => this.setTool({ kind: 'mount', model: id }));
      groups[def.kind === 'vehicle' ? 'vehicle' : 'turret'].append(b);
      this.palette.register(b, { key: b.dataset.tool, name: def.displayName, tags: `${def.kind} vehicle turret mount seats drive`, picture: true });
    }
    const parked = this.palette.group($('ed-mounts'), 'vehicles:parked', 'Parked Vehicles (scenery)', { open: false });
    for (const def of CORE_PROPS.filter((d) => propGroup(d) === 'vehicles')) this.propButton(parked, def, 'parked car vehicle wreck');
  }

  /** Plant a patch of the set round the pointer, or (clear) remove that set's props there. One undo step either way. */
  private scatterAtHover(set: ScatterSetId, clear: boolean, quiet = false): void {
    const p = this.hoverPoint;
    if (!p) return;
    const r = this.brushRadius;
    const label = SCATTER_SETS[set].label;
    if (clear) {
      const models = new Set<string>(SCATTER_SETS[set].models.map(([m]) => m.split('#')[0]!));
      const gone = this.doc.entities.filter((e) => e.kind === 'prop' && models.has(e.model) && Math.hypot(e.position[0] - p.x, e.position[2] - p.z) <= r);
      if (gone.length) this.run(`Clear ${label}`, { kind: 'removeEntities', entities: gone });
      return;
    }
    const plants = scatterProps(this.doc, set, p.x, p.z, r, this.level * this.doc.classicStructure.levelHeight, (Math.random() * 2 ** 31) | 0);
    if (!plants.length) return quiet ? undefined : this.toast('No room here: the patch is already full', true);
    this.run(`Scatter ${label}`, { kind: 'addEntities', entities: plants.map((e) => ({ ...e, id: newId('prop') })) });
  }

  private buildScatterPalette(): void {
    const box = this.palette.group($('ed-nature'), 'nature:scatter', 'Scatter Brush', { note: 'Click to plant a patch · Alt-click clears that kind of plant · [ ] resize' });
    const icons: Record<ScatterSetId, string> = {
      forest: '<path d="M14 46 L22 14 L30 46Z M28 46 L36 8 L44 46Z" fill="#3f6b3a"/>',
      woods: '<circle cx="20" cy="22" r="11" fill="#5f9a46"/><circle cx="37" cy="26" r="10" fill="#4f8a3c"/><rect x="18" y="30" width="4" height="16" fill="#7a5232"/><rect x="35" y="32" width="4" height="14" fill="#7a5232"/>',
      autumn: '<circle cx="20" cy="22" r="11" fill="#d98a2f"/><circle cx="37" cy="26" r="10" fill="#c9562c"/><rect x="18" y="30" width="4" height="16" fill="#7a5232"/><rect x="35" y="32" width="4" height="14" fill="#7a5232"/>',
      mixed: '<path d="M10 46 L19 10 L28 46Z" fill="#2f5a34"/><rect x="36" y="22" width="3" height="24" fill="#e8e4da"/><circle cx="37" cy="20" r="9" fill="#9cc15a"/>',
      undergrowth: '<path d="M14 46 Q8 34 6 28 M14 46 Q14 30 18 22 M14 46 Q20 34 26 30" stroke="#4f8a3c" stroke-width="3" fill="none"/><circle cx="38" cy="38" r="10" fill="#5c7a44"/>',
      water: '<rect x="4" y="34" width="48" height="14" fill="#5b8fb0"/><path d="M20 48 Q18 30 14 12 M26 48 Q28 28 32 10 M32 48 Q36 32 42 20" stroke="#7fb84a" stroke-width="3" fill="none"/>',
      jungle: '<path d="M28 46 Q27 26 30 14" stroke="#7a5232" stroke-width="3" fill="none"/><path d="M30 14 Q16 10 10 22 M30 14 Q44 8 48 22 M30 14 Q24 2 14 6 M30 14 Q38 2 46 8" stroke="#3f8a3c" stroke-width="4" fill="none"/>',
      bushes: '<circle cx="18" cy="36" r="9" fill="#5f9a46"/><circle cx="32" cy="32" r="12" fill="#4f8a3c"/><circle cx="44" cy="38" r="7" fill="#6aa84f"/>',
      meadow: '<path d="M10 46 Q12 32 14 26 M20 46 Q22 30 26 22 M34 46 Q34 34 38 26 M44 46 Q46 34 48 30" stroke="#6fbf4a" stroke-width="3" fill="none"/><circle cx="14" cy="24" r="4" fill="#ff6a8a"/><circle cx="26" cy="20" r="4" fill="#ffd34d"/><circle cx="38" cy="24" r="4" fill="#b98aff"/>',
      desert: '<path d="M26 46V14a4 4 0 0 1 8 0V46Z M26 30h-6V20a3 3 0 0 1 6 0 M34 26h6V16a3 3 0 0 0-6 0" fill="#5e8f4a"/><rect x="6" y="44" width="44" height="4" fill="#d9b77a"/>',
      rocks: '<path d="M8 46 L14 32 L26 28 L32 36 L30 46Z" fill="#8a8d92"/><path d="M30 46 L36 30 L46 32 L50 46Z" fill="#6c7076"/>',
      envForest: '<path d="M10 46 L18 16 L26 46Z" fill="#355b34"/><circle cx="38" cy="22" r="11" fill="#55803c"/><path d="M36 30 L37 46 L39 46 L40 30Z" fill="#6a4a30"/><text x="28" y="54" font-size="9" fill="#cde" text-anchor="middle">NEW</text>',
      envShrubs: '<circle cx="20" cy="34" r="10" fill="#4d6b2e"/><circle cx="36" cy="32" r="12" fill="#a5582a"/><text x="28" y="54" font-size="9" fill="#cde" text-anchor="middle">NEW</text>',
      envRocks: '<path d="M8 44 L16 26 L30 22 L36 32 L32 44Z" fill="#86827a"/><path d="M16 26 L30 22 L26 30Z" fill="#4e6a2c"/><text x="28" y="54" font-size="9" fill="#cde" text-anchor="middle">NEW</text>',
    };
    box.id = 'ed-scatter';
    for (const id of SCATTER_SET_IDS) {
      // The procedural environment's preview sets, with ?env=1 only.
      if ((SCATTER_SETS[id] as { preview?: true }).preview && !envRendererOn()) continue;
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = `scatter:${id}`;
      b.innerHTML = `<svg viewBox="0 0 56 56">${icons[id]}</svg>${SCATTER_SETS[id].label}`;
      b.addEventListener('click', () => this.setTool({ kind: 'scatter', set: id }));
      box.append(b);
      this.palette.register(b, { key: b.dataset.tool, name: SCATTER_SETS[id].label, tags: 'scatter plants trees vegetation brush patch' });
    }
    const radius = document.createElement('label');
    radius.className = 'stack';
    radius.innerHTML = 'Brush size <span id="ed-sc-radius-v">8 m</span><input id="ed-sc-radius" type="range" min="2" max="40" step="1" value="8" />';
    box.after(radius);
    $<HTMLInputElement>('ed-sc-radius').addEventListener('input', (e) => this.setBrushRadius(Number((e.target as HTMLInputElement).value)));
  }

  /** A prop card; its picture comes from the atlas as it scrolls into view. */
  private propButton(grid: HTMLElement, def: PropDefinition, tags = '', picture = true): void {
    const b = document.createElement('button');
    b.className = 'tile-btn prop-btn';
    b.dataset.tool = `prop:${def.id}`;
    b.title = `${def.displayName}\n${def.size.map((v) => v.toFixed(1)).join(' × ')} m${def.collision ? '' : ' · walk-through'}${def.breakable ? ' · breakable' : ''}`;
    b.append(document.createTextNode(def.displayName));
    b.addEventListener('click', () => this.setTool({ kind: 'prop', model: def.id }));
    grid.append(b);
    const packs = STYLE_PACKS.filter((p) => p.props.includes(def.id)).map((p) => p.displayName);
    this.palette.register(b, {
      key: b.dataset.tool,
      name: def.displayName,
      tags: `${def.category} prop ${tags} ${packs.join(' ')} ${def.breakable ? 'breakable destructible' : ''} ${def.collision ? '' : 'walk-through decoration'}`,
      picture,
    });
  }

  /** Props by theme group (each one atlas), then by their own category; Nature and parked vehicles have their own tabs. */
  private buildPropPalette(): void {
    const byCategory = (cats: readonly string[]) => cats.map((c) => [c, CORE_PROPS.filter((d) => d.category === c)] as const).filter(([, list]) => list.length);
    PROP_GROUPS.forEach((g, i) => {
      const grid = this.palette.group($('ed-props'), `props:${g.id}`, g.label, { open: i === 0 });
      for (const [cat, list] of byCategory(g.categories)) {
        this.palette.heading(grid, cat);
        for (const def of list) this.propButton(grid, def, g.label);
      }
    });
    // Props in a category no theme group lists yet still show, at the end.
    const other = CORE_PROPS.filter((d) => propGroup(d) === 'other');
    if (other.length) {
      const grid = this.palette.group($('ed-props'), 'props:other', 'More Props', { open: false });
      for (const def of other) this.propButton(grid, def);
    }
    for (const cat of NATURE_PROP_CATEGORIES) {
      const grid = this.palette.group($('ed-nature'), `nature:${cat}`, cat);
      for (const def of CORE_PROPS.filter((d) => d.category === cat && !RETIRED_PROPS.has(d.id))) this.propButton(grid, def, 'nature');
      // Our own species (the plants brush's grass, flowers, fern, shrub, eelgrass and pebbles) in place of the retired pieces, pictured from their first variant.
      for (const id of GROUND_COVER_SPECIES[cat] ?? []) this.propButton(grid, getProp(id)!, 'nature environment procedural grass flowers fern shrub bush eelgrass pebbles stones ground cover');
    }
    // The procedural environment's species (Phase 1 preview, docs/PROCEDURAL_ENVIRONMENT_AUDIT.md §10): with ?env=1 only,
    // no palette picture yet (their pictures join the atlas when they ship).
    if (envRendererOn()) {
      const grid = this.palette.group($('ed-nature'), 'nature:environment', 'Environment (preview)', { note: 'Procedural species: trees, shrub, grass, boulder, cliff · variants in the inspector' });
      for (const s of ENV_SPECIES) if (!GROUND_COVER_IDS.includes(s.id)) this.propButton(grid, getProp(s.id)!, 'nature environment procedural preview', false);
    }
  }


  private buildPaintPalette(): void {
    const mats = $('ed-materials');
    let category = '';
    for (const def of coreMaterials.all()) {
      if (def.category !== category) {
        category = def.category;
        const h = document.createElement('div');
        h.className = 'mat-cat';
        h.textContent = category;
        mats.append(h);
      }
      const b = document.createElement('button');
      b.className = 'mat-btn';
      b.dataset.material = def.id;
      b.innerHTML = `<img alt="" src="${materialThumbnail(def)}"><span class="lbl">${escapeHtml(def.displayName)}</span>`;
      b.addEventListener('click', () => {
        this.paintStyle = { ...this.paintStyle, material: def.id };
        this.setTool({ kind: 'paint' });
        this.syncPaintUi();
      });
      mats.append(b);
      this.palette.register(b, { key: `material:${def.id}`, name: def.displayName, tags: `${def.category} material paint surface ${def.id}` });
    }
    const tints = $('ed-tints');
    const none = document.createElement('button');
    none.className = 'swatch none';
    none.title = 'No tint';
    none.dataset.tint = '';
    tints.append(none);
    for (const t of TINT_SWATCHES) {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = t;
      b.title = t;
      b.dataset.tint = t;
      tints.append(b);
    }
    tints.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).dataset.tint;
      if (t === undefined) return;
      this.paintStyle = { ...this.paintStyle, tint: t || null };
      this.setTool({ kind: 'paint' });
      this.syncPaintUi();
    });
    $<HTMLInputElement>('ed-tint-custom').addEventListener('input', (e) => {
      this.paintStyle = { ...this.paintStyle, tint: (e.target as HTMLInputElement).value.toLowerCase() };
      this.setTool({ kind: 'paint' });
      this.syncPaintUi();
    });
    $<HTMLSelectElement>('ed-scope').addEventListener('change', (e) => (this.paintScope = (e.target as HTMLSelectElement).value as PaintScope));
    this.syncPaintUi();
  }

  /** Reflect the current brush in the palette. */
  private syncPaintUi(): void {
    for (const b of document.querySelectorAll<HTMLElement>('.mat-btn')) b.classList.toggle('active', b.dataset.material === this.paintStyle.material);
    for (const b of document.querySelectorAll<HTMLElement>('#ed-tints .swatch')) b.classList.toggle('active', (b.dataset.tint || null) === (this.paintStyle.tint ?? null));
    const def = coreMaterials.get(this.paintStyle.material);
    const brush = $<HTMLImageElement>('ed-brush');
    if (def) brush.src = materialThumbnail(def, this.paintStyle.tint ?? null, 40);
    $('ed-brush-label').textContent = `${def?.displayName ?? this.paintStyle.material}${this.paintStyle.tint ? ` · ${this.paintStyle.tint}` : ''}`;
    if (this.paintStyle.tint) $<HTMLInputElement>('ed-tint-custom').value = this.paintStyle.tint;
  }

  /**
   * A palette picture rendered now from the real model (PNG data URL): for pieces the prebuilt atlas
   * hasn't got, and for tools/content/build-palette-atlas.mjs, which renders every piece through this.
   * Keys are the palette's: `tile:<id>`, `prop:<id>`, `mount:<id>`.
   */
  thumbFor(key: string, size?: number): Promise<string> | null {
    const at = key.indexOf(':');
    const kind = key.slice(0, at);
    const id = key.slice(at + 1);
    if (kind === 'tile') {
      const def = coreCatalog.get(id);
      return def ? this.thumbs.getTile(def, size) : null;
    }
    if (kind === 'prop') {
      const def = getProp(id);
      return def ? this.thumbs.get(def.file, 'three-quarter', size) : null;
    }
    if (kind === 'mount') {
      const def = MOUNT_DEFS[id as MountModel];
      return def ? this.thumbs.get(def.model, 'three-quarter', size) : null;
    }
    if (kind === 'setpiece') {
      const def = this.pieceDef(id);
      if (!def) return null;
      const { doc, models } = this.setPieceThumbDoc(def);
      // The player's pieces change as they save over them: the picture is keyed by their content.
      return this.thumbs.getMap(id.startsWith('local.') ? `${id}:${JSON.stringify(def).length}:${this.myPiecesRev}` : id, doc, models, size);
    }
    return null;
  }

  /**
   * What a set piece's palette picture is drawn from: the piece alone on an empty map, in its first look (the theme that
   * look is for), unturned; its props as models (tools/content/palette-items.ts hashes the same inputs).
   */
  private setPieceThumbDoc(def: SetPieceDefinition): { doc: MapDocument; models: { file: string; position: [number, number, number]; yaw: number; scale: number }[] } {
    const pack = def.packs[0] ? this.setPieceLib.packs.get(def.packs[0]) : undefined;
    const theme = pack?.themes[0] ?? this.doc.classicStructure.theme;
    const placement: SetPiecePlacement = { id: 'thumb', piece: def.id, x: 0, y: 0, z: 0, rotation: 0, mirror: false, ...(pack ? { pack: pack.id } : {}) };
    const { tiles, entities } = setPieceParts(placement, def, theme, this.setPieceLib);
    const base = newMapDocument('thumb');
    const doc: MapDocument = { ...base, terrain: null, classicStructure: { ...base.classicStructure, theme, tiles }, entities: entities.filter((e) => e.kind === 'block') };
    const models = entities.flatMap((e) => {
      if (e.kind !== 'prop') return [];
      const file = envModelFile(e.model, e.variant) ?? getProp(e.model)?.file;
      return file ? [{ file, position: e.position, yaw: e.yaw, scale: e.scale }] : [];
    });
    return { doc, models };
  }

  private paletteButton(grid: HTMLElement, def: TileDefinition, pack?: StylePack): void {
    const b = document.createElement('button');
    b.className = 'tile-btn';
    b.dataset.tool = `tile:${def.id}`;
    // The top-down icon stands in until the picture from the atlas has loaded.
    b.innerHTML = `<span class="thumb">${tileIcon(def)}</span><span class="lbl">${escapeHtml(def.displayName)}</span>`;
    const size = (() => {
      const span = (i: 0 | 1 | 2) => Math.max(...def.cells.map((c) => c[i])) - Math.min(...def.cells.map((c) => c[i])) + 1;
      return `${span(0)} × ${span(1)} × ${span(2)}`;
    })();
    b.title = `${def.displayName}\n${def.blurb ?? ''}\nSize ${size} cells · ${def.ports.length} connectors`.trim();
    b.addEventListener('click', () => this.setTool({ kind: 'tile', tile: def.id }));
    grid.append(b);
    this.palette.register(b, {
      key: b.dataset.tool,
      name: def.displayName,
      tags: `${def.id} ${def.category} tile structure ${def.blurb ?? ''} ${pack ? pack.style : ''}`,
      pack: pack?.displayName,
      picture: true,
    });
  }

  // ---------------------------------------------------------------- set pieces: the palette tab and your library

  /** "My set pieces": the grid, the palette keys of its cards, and what it was drawn for. */
  private mineGrid?: HTMLElement;
  private mineKeys: string[] = [];
  private mineKey = '';

  /**
   * The Set pieces tab: a panel for the piece being placed (its look, turn and mirror; your own piece's Export and
   * Delete), the shipped pieces by family (their pictures from the palette atlas), then your own (this browser's
   * library) and the map's own, with Save selection as set piece and Import.
   */
  private buildSetPiecePalette(): void {
    const pane = $('ed-setpieces');
    const info = document.createElement('div');
    info.id = 'ed-sp-info';
    info.className = 'ed-sp-info';
    pane.append(info);
    const families = new Map<string, SetPieceDefinition[]>();
    for (const def of this.setPieceLib.pieces.values()) families.set(def.family, [...(families.get(def.family) ?? []), def]);
    const order = [...families].sort(([a], [b]) => setPieceFamilyOrder(a) - setPieceFamilyOrder(b) || (a < b ? -1 : a > b ? 1 : 0));
    order.forEach(([family, defs], i) => {
      const grid = this.palette.group(pane, `setpieces:${family}`, setPieceFamilyLabel(family), { open: i < 2 });
      for (const def of defs) this.setPieceButton(grid, def);
    });
    this.mineGrid = this.palette.group(pane, 'setpieces:custom', setPieceFamilyLabel('custom'), {
      note: 'Your own pieces, kept in this browser next to your maps. Make one: drag a box over tiles, blocks and props with Select (on empty ground), then Save as set piece…',
    });
    const actions = document.createElement('div');
    actions.className = 'ed-row ed-sp-actions';
    const save = button('Save selection as set piece…', () => this.saveSelectionDialog());
    save.id = 'ed-sp-save';
    save.title = 'Make a set piece of what is selected (tiles, blocks, props, doors, ladders and lights), for your library';
    save.disabled = true;
    const imp = button('Import…', () => $('ed-sp-import-file').click());
    imp.id = 'ed-sp-import';
    imp.title = 'Add set pieces from a file someone exported (a .setpiece.json file): checked before they go in';
    actions.append(save, imp);
    this.mineGrid.after(actions);
    $<HTMLInputElement>('ed-sp-import-file').addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = '';
      if (file) void this.importSetPieces(file);
    });
    this.loadMyPieces();
    this.renderPieceInfo();
  }

  /** A set piece's card: its picture (the palette atlas; runtime for your own), its name, what it is on hover. */
  private setPieceButton(grid: HTMLElement, def: SetPieceDefinition, where: 'shipped' | 'mine' | 'map' = 'shipped'): HTMLElement {
    const b = document.createElement('button');
    b.className = 'tile-btn sp-btn';
    b.dataset.tool = `setpiece:${def.id}`;
    const span = (i: 0 | 1) => Math.max(...def.footprint.cells.map((c) => c[i])) - Math.min(...def.footprint.cells.map((c) => c[i])) + 1;
    const levels = def.footprint.levels[1] - def.footprint.levels[0] + 1;
    const looks = def.packs.map((id) => this.setPieceLib.packs.get(id)?.displayName ?? id);
    const whose = where === 'mine' ? '\nYours (this browser)' : where === 'map' ? "\nThis map's own (not in your library)" : '';
    b.title = `${def.displayName}\n${def.blurb ?? ''}\n${span(0)} × ${span(1)} cells · ${levels} level${levels === 1 ? '' : 's'} · ${def.ports.length} ports${def.mirror === 'none' ? ' · turns, no mirror' : ''}${looks.length ? `\nLooks: ${looks.join(', ')}` : ''}${whose}`.replace(/\n+/g, '\n').trim();
    b.append(document.createTextNode(def.displayName));
    b.addEventListener('click', () => this.setTool({ kind: 'setpiece', piece: def.id }));
    grid.append(b);
    this.palette.register(b, {
      key: b.dataset.tool,
      name: def.displayName,
      tags: `set piece setpiece ${def.family} ${def.category} ${def.blurb ?? ''} ${looks.join(' ')} ${where === 'shipped' ? '' : 'my own custom saved'}`,
      picture: true,
    });
    return b;
  }

  /** Read the player's library (storage.ts) and redraw "My set pieces". */
  private loadMyPieces(): void {
    this.myPieces = new Map(listSetPieces().map((s) => [s.def.id, s.def]));
    this.myPiecesRev++;
    this.renderMyPieces(true);
  }

  /** "My set pieces": your library, then the map's own pieces that aren't in it (they came with the map). */
  private renderMyPieces(force = false): void {
    const grid = this.mineGrid;
    if (!grid) return;
    const inMap = (this.doc.setPieceDefs ?? []).filter((d) => !this.myPieces.has(d.id));
    const key = `${this.myPiecesRev}|${inMap.map((d) => `${d.id}:${JSON.stringify(d).length}`).join(',')}`;
    if (!force && key === this.mineKey) return;
    this.mineKey = key;
    for (const k of this.mineKeys) this.palette.unregister(k);
    grid.replaceChildren();
    this.mineKeys = [...this.myPieces.values()].map((def) => this.setPieceButton(grid, def, 'mine').dataset.key!);
    for (const def of inMap) {
      const b = this.setPieceButton(grid, def, 'map');
      b.classList.add('in-map');
      this.mineKeys.push(b.dataset.key!);
    }
    for (const b of grid.querySelectorAll<HTMLElement>('[data-tool]')) b.classList.toggle('active', this.tool.kind === 'setpiece' && b.dataset.tool === `setpiece:${this.tool.piece}`);
    this.palette.refresh();
    if (this.stylePack) this.filterPalette();
  }

  /** A look picker: the map theme's, the looks the piece suits, then every other look. */
  private lookSelect(def: SetPieceDefinition, value: string, onChange: (v: string) => void): HTMLSelectElement {
    const sel = document.createElement('select');
    const theme = this.doc.classicStructure.theme;
    const themed = placementPack({}, theme, this.setPieceLib);
    sel.append(new Option(`Map theme's (${themed?.displayName ?? coreThemes.get(theme)?.displayName ?? theme})`, '', false, !value));
    const suits = document.createElement('optgroup');
    suits.label = 'Made for it';
    const others = document.createElement('optgroup');
    others.label = 'Other looks';
    for (const pack of this.setPieceLib.packs.values()) (def.packs.includes(pack.id) ? suits : others).append(new Option(pack.displayName, pack.id, false, pack.id === value));
    if (suits.children.length) sel.append(suits);
    sel.append(others);
    sel.title = "The look (role pack) that themes it: the stone, trim, floors, roofs, facade, doors and glass it's built in";
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  }

  /** The panel over the Set pieces tab: the piece being placed, its look, turn and mirror; your own piece's actions. */
  private renderPieceInfo(): void {
    const el = document.getElementById('ed-sp-info');
    if (!el) return;
    el.replaceChildren();
    const t = this.tool;
    const def = t.kind === 'setpiece' ? this.pieceDef(t.piece) : undefined;
    if (!def) {
      el.append(small('Pick a set piece, then click the map: a ghost of the whole piece shows where it goes, green where it fits, red (and why) where not. R turns it, M mirrors it.'));
      return;
    }
    const head = document.createElement('div');
    head.className = 'ed-sp-head';
    head.innerHTML = '<b></b><small></small>';
    head.querySelector('b')!.textContent = def.displayName;
    head.querySelector('small')!.textContent = `${setPieceFamilyLabel(def.family)} · ${def.category}`;
    el.append(head);
    const look = this.lookFor();
    for (const l of this.pieceLines(def, { rotation: this.rotation, mirror: this.pieceMirror, ...(look ? { pack: look } : {}) })) el.append(small(l));
    const lookSel = this.lookSelect(def, look, (v) => {
      this.pieceLook = v;
      this.renderPieceInfo();
      this.updateHover();
    });
    lookSel.id = 'ed-sp-look';
    el.append(row('Look', lookSel));
    const turn = button(`Turn (R) · ${this.rotation * 90}°`, () => this.rotate());
    turn.id = 'ed-sp-turn';
    const mirror = button(this.pieceMirror ? 'Mirrored (M)' : 'Mirror (M)', () => this.mirror());
    mirror.id = 'ed-sp-mirror';
    const why = setPieceMirrorRefusal(def);
    mirror.disabled = !!why;
    mirror.classList.toggle('on', this.pieceMirror);
    mirror.setAttribute('aria-pressed', String(this.pieceMirror));
    mirror.title = why ?? 'Mirror it: east and west swapped, over the same cells (M)';
    const bar = document.createElement('div');
    bar.className = 'buttons';
    bar.append(turn, mirror);
    el.append(bar);
    if (why) {
      const note = small(why);
      note.id = 'ed-sp-mirror-why';
      el.append(note);
    }
    const mine = this.myPieces.has(def.id);
    if (def.id.startsWith('local.')) {
      const acts = document.createElement('div');
      acts.className = 'buttons';
      const exp = button('Export…', () => exportSetPiece(def));
      exp.id = 'ed-sp-export';
      exp.title = 'Download it as a .setpiece.json file (Import adds it in another browser)';
      acts.append(exp);
      if (mine) {
        const del = button('Delete from my pieces', () => {
          if (!confirm(`Delete "${def.displayName}" from your set pieces in this browser? Maps that place it keep their copy.`)) return;
          deleteSetPiece(def.id);
          this.loadMyPieces();
          if (!this.pieceDef(def.id)) this.setTool({ kind: 'select' });
          this.toast(`Deleted "${def.displayName}" from your set pieces`);
        });
        del.id = 'ed-sp-delete';
        acts.append(del);
      } else {
        const keep = button('Save to my pieces', () => {
          if (!saveSetPiece(def)) return this.toast('Could not save to browser storage: Export it to keep a copy', true);
          this.loadMyPieces();
          this.toast(`"${def.displayName}" is in your set pieces now`);
        });
        keep.id = 'ed-sp-keep';
        acts.append(keep);
      }
      el.append(acts);
      // The owner ships a piece the way official maps are files: a family file for content/setpieces/.
      const official = document.createElement('div');
      official.className = 'ed-row ed-owner-only';
      official.hidden = !this.owner;
      const family = document.createElement('input');
      family.id = 'ed-sp-family';
      family.value = def.family;
      family.title = 'The family file it goes in: content/setpieces/<family>.json';
      family.maxLength = 32;
      const ship = button('Export for content/setpieces/', () => {
        const f = family.value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_') || 'custom';
        exportSetPiece(def, { family: f });
        this.toast(`Exported ${f}.json: put it (or its piece) in content/setpieces/, then run pnpm content:rebuild (docs/CONTENT_PIPELINE.md, "Set pieces")`);
      });
      ship.id = 'ed-sp-export-official';
      official.append(family, ship);
      el.append(official);
    }
  }

  /** Add set pieces from a file (Import): each checked first; one naming tiles, props or materials the game hasn't got is refused. */
  private async importSetPieces(file: File): Promise<void> {
    const r = await importSetPieceFile(file);
    const problems = [...r.problems];
    let saved = 0;
    for (const def of r.defs) {
      const found = checkSetPieceDefinition(def, { packs: this.setPieceLib.packs });
      const missing = found.filter((p) => / is not a /.test(p));
      if (missing.length) {
        problems.push(`${def.displayName}: ${missing[0]}`);
        continue;
      }
      if (saveSetPiece(def)) saved++;
      else problems.push(`${def.displayName}: browser storage refused it`);
    }
    this.loadMyPieces();
    if (saved) this.toast(`Imported ${saved} set piece${saved === 1 ? '' : 's'} into My set pieces${problems.length ? ` (${problems.length} refused: ${problems[0]})` : ''}`);
    else this.toast(`Import failed: ${problems[0] ?? 'no set pieces in the file'}`, true);
  }

  /** The cell a piece saved from a selection is anchored at: the selection's south-west corner, on its lowest level. */
  private selectionAnchor(sel: Selection): [number, number, number] {
    const { cellSize, levelHeight } = this.doc.classicStructure;
    const cells: (readonly number[])[] = [];
    for (const t of this.doc.classicStructure.tiles) if (sel.tiles.includes(t.id)) cells.push(...(placementCells(t) ?? []));
    for (const id of sel.setPieces ?? []) cells.push(...(this.expansion.footprints.get(id) ?? []));
    for (const e of this.doc.entities) if (sel.entities.includes(e.id)) cells.push([Math.round(e.position[0] / cellSize), Math.round(e.position[2] / cellSize), Math.floor((e.position[1] + 0.01) / levelHeight)]);
    if (!cells.length) return [0, 0, this.level];
    return [Math.min(...cells.map((c) => c[0]!)), Math.min(...cells.map((c) => c[1]!)), Math.min(...cells.map((c) => c[2]!))];
  }

  /** `local.<name>` free in your library and the map (a name taken already gets _2, _3…). */
  private freeLocalId(id: string): string {
    const taken = (x: string) => this.myPieces.has(x) || !!this.doc.setPieceDefs?.some((d) => d.id === x);
    if (!taken(id)) return id;
    const name = id.slice('local.'.length);
    for (let i = 2; ; i++) {
      const next = `local.${name.slice(0, 40 - String(i).length - 1)}_${i}`;
      if (!taken(next)) return next;
    }
  }

  /**
   * Save selection as set piece: the selected tiles, blocks, props, doors, ladders and lights (set pieces as their
   * parts) become a piece (setPieceFromSelection: footprint, ports, mirror, materials as roles where a look matches),
   * named here, kept in your library (this browser) and placeable in any map.
   */
  private saveSelectionDialog(): void {
    if (!this.selCount()) return this.toast('Select what the piece is made of first: drag a box over it with Select (on empty ground), Shift+click adds', true);
    const leftOut = this.doc.entities.filter((e) => this.selection.entities.includes(e.id) && !PIECE_PART_KINDS.has(e.kind));
    const sel: Selection = { tiles: this.selection.tiles, entities: this.selection.entities.filter((id) => !leftOut.some((e) => e.id === id)), ...(this.selPieces().length ? { setPieces: this.selPieces() } : {}) };
    const anchor = this.selectionAnchor(sel);
    const dialog = $<HTMLDialogElement>('ed-sp-save-dialog');
    const name = $<HTMLInputElement>('ed-sp-save-name');
    const summary = $('ed-sp-save-summary');
    const problems = $('ed-sp-save-problems');
    const ok = $<HTMLButtonElement>('ed-sp-save-ok');
    if (!name.value.trim()) name.value = 'My set piece';
    const make = () => setPieceFromSelection(this.doc, sel, anchor, { displayName: name.value.trim() || 'My set piece', library: this.placeLib });
    const show = () => {
      const r = make();
      problems.replaceChildren();
      if ('error' in r) {
        summary.textContent = '';
        const li = document.createElement('li');
        li.className = 'error';
        li.textContent = r.error;
        problems.append(li);
        ok.disabled = true;
        return;
      }
      const d = r.definition;
      const count = (k: string) => d.parts.filter((p) => p.kind === k).length;
      const parts = (['tile', 'block', 'prop', 'door', 'ladder', 'light'] as const).map((k) => [k, count(k)] as const).filter(([, n]) => n).map(([k, n]) => `${n} ${k}${n === 1 ? '' : 's'}`);
      const span = (i: 0 | 1) => Math.max(...d.footprint.cells.map((c) => c[i])) - Math.min(...d.footprint.cells.map((c) => c[i])) + 1;
      const look = r.pack ? (this.setPieceLib.packs.get(r.pack)?.displayName ?? r.pack) : null;
      summary.textContent = `${parts.join(', ')} · ${span(0)} × ${span(1)} cells, ${d.footprint.levels[1] - d.footprint.levels[0] + 1} level(s) · ${d.ports.length} ports · ${d.mirror === 'free' ? 'mirrors' : 'turns only'}${look ? ` · materials of the ${look} look become roles, so it re-themes` : ' · its materials stay as they are'}${leftOut.length ? ` · left out: ${[...new Set(leftOut.map((e) => e.kind))].join(', ')} (a set piece holds tiles, blocks, props, doors, ladders and lights)` : ''}`;
      for (const p of r.problems.slice(0, 6)) {
        const li = document.createElement('li');
        li.className = 'warning';
        li.textContent = p;
        problems.append(li);
      }
      ok.disabled = false;
    };
    name.oninput = show;
    show();
    ok.onclick = () => {
      const r = make();
      if ('error' in r) return;
      const def = { ...r.definition, id: this.freeLocalId(r.definition.id) };
      if (!saveSetPiece(def)) return this.toast('Could not save to browser storage: free some space, or Export your maps', true);
      dialog.close();
      this.loadMyPieces();
      this.showPane('setpieces');
      const card = document.querySelector<HTMLElement>(`#ed-setpieces [data-tool="${CSS.escape(`setpiece:${def.id}`)}"]`);
      if (card) this.palette.reveal(card);
      this.toast(`Saved "${def.displayName}" to My set pieces: pick it there to place it in any map`);
    };
    $('ed-sp-save-cancel').onclick = () => dialog.close();
    dialog.showModal();
    name.select();
  }

  /** The inspector for one set piece: what it is, its look, mirror, place and turn, its ports, the overrides, Explode. */
  private pieceInspector(el: HTMLElement, id: string): void {
    const p = this.placementOf(id)!;
    const def = this.pieceDef(p.piece);
    el.append(h2(def?.displayName ?? p.piece));
    if (!def) {
      el.append(small(`This map places a set piece MapMaker doesn't know (${p.piece}): it can't be drawn or played. Delete it.`));
      return;
    }
    if (def.blurb) el.append(small(def.blurb));
    const update = (label: string, after: SetPiecePlacement) => this.run(label, updateSetPieceCommand(this.doc, p, after, coreCatalog, this.placeLib));
    el.append(row('Piece', text(`${setPieceFamilyLabel(def.family)} · ${def.id.startsWith('local.') ? 'your own' : 'shipped'}`)));
    const look = this.lookSelect(def, p.pack ?? '', (v) => {
      const { pack: _old, ...rest } = p;
      void _old;
      update('Set piece look', v ? { ...rest, pack: v } : rest);
    });
    look.id = 'ed-sp-insp-look';
    el.append(row('Look', look));
    const mirror = document.createElement('input');
    mirror.type = 'checkbox';
    mirror.id = 'ed-sp-insp-mirror';
    mirror.checked = p.mirror;
    const why = setPieceMirrorRefusal(def);
    mirror.disabled = !!why && !p.mirror;
    mirror.title = why ?? 'East and west swapped, over the same cells (M)';
    mirror.addEventListener('change', () => this.run('Mirror', mirrorSetPieceCommand(this.doc, p.id, coreCatalog, this.placeLib)));
    el.append(row('Mirror', mirror));
    if (why) el.append(small(why));
    el.append(
      row('X', numberInput(p.x, 1, (v) => update('Move set piece', { ...p, x: v }))),
      row('Y', numberInput(p.y, 1, (v) => update('Move set piece', { ...p, y: v }))),
      row('Level', numberInput(p.z, 1, (v) => update('Move set piece', { ...p, z: v }))),
      row('Rotation', text(`${p.rotation * 90}° (R turns it)`)),
      this.quickFacings({ tiles: [], entities: [], setPieces: [p.id] }, (p.rotation * Math.PI) / 2),
    );
    // Ports: where it meets what's round it; one a wall stands in is a warning (and red on its outline).
    const states = setPiecePortStates(p, def, this.mapBoxes());
    const portsHead = document.createElement('h3');
    portsHead.textContent = `Ports (${states.length})`;
    el.append(portsHead);
    const list = document.createElement('ul');
    list.className = 'ed-sp-ports';
    for (const s of states) {
      const li = document.createElement('li');
      li.className = s.blockedBy ? 'warning' : s.closed ? 'closed' : 'ok';
      const name = this.portName(s);
      const Name = `${name[0]!.toUpperCase()}${name.slice(1)}`;
      li.textContent = s.blockedBy
        ? `⚠ ${Name} faces a wall: ${this.blockerName(s.blockedBy)}. Open it (Walls tool, or cut the block), or move the piece`
        : s.closed
          ? `${Name}: walled (nothing meets it; a room built against it with a doorway opens it)`
          : `${Name}: clear`;
      list.append(li);
    }
    if (states.length) el.append(list);
    else el.append(small('No ports: it meets nothing round it.'));
    // Overrides: a role's value for this piece only, and parts left out.
    const roles = rolesUsed(def);
    if (roles.length) {
      const head = document.createElement('h3');
      head.textContent = 'Materials';
      el.append(head, small("Each comes from its look; pick another here for this piece only."));
      for (const role of roles) el.append(row(ROLE_LABELS[role], this.roleSelect(p, def, role, update)));
    }
    const partsHead = document.createElement('h3');
    partsHead.textContent = `Parts (${def.parts.length})`;
    el.append(partsHead, small('Untick a part to leave it out of this piece only. Explode to tiles to edit the parts one by one.'));
    const hidden = new Set(p.overrides?.hide ?? []);
    const parts = document.createElement('div');
    parts.className = 'ed-sp-parts';
    def.parts.forEach((part, i) => {
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = !hidden.has(i);
      box.dataset.part = String(i);
      box.addEventListener('change', () => {
        const hide = new Set(p.overrides?.hide ?? []);
        if (box.checked) hide.delete(i);
        else hide.add(i);
        const overrides = { ...(p.overrides ?? {}), hide: [...hide].sort((a, b) => a - b) };
        if (!overrides.hide.length) delete (overrides as { hide?: number[] }).hide;
        const { overrides: _old, ...rest } = p;
        void _old;
        update(box.checked ? 'Show set piece part' : 'Hide set piece part', Object.keys(overrides).length ? { ...rest, overrides } : rest);
      });
      const lab = document.createElement('label');
      lab.append(box, document.createTextNode(this.partLabel(part)));
      parts.append(lab);
    });
    el.append(parts);
    const acts = document.createElement('div');
    acts.className = 'buttons';
    const explode = button('Explode to tiles', () => this.explode(p.id));
    explode.id = 'ed-sp-explode';
    explode.title = 'Turn it into its parts: ordinary tiles, blocks and props to edit one by one (one undo step puts the set piece back)';
    const saveAs = button('Save as set piece…', () => this.saveSelectionDialog());
    saveAs.title = 'Save a copy of it (with its look and overrides) in your set pieces';
    acts.append(explode, saveAs);
    el.append(acts);
    el.append(small(`ID ${p.id} · ${def.id}`));
  }

  /** A role's value for one placement: the look's (the default), or one of the game's materials, facades, door styles or glass. */
  private roleSelect(p: SetPiecePlacement, def: SetPieceDefinition, role: SetPieceRole, update: (label: string, after: SetPiecePlacement) => void): HTMLSelectElement {
    const sel = document.createElement('select');
    sel.dataset.role = role;
    const pack = placementPack(p, this.doc.classicStructure.theme, this.setPieceLib);
    const fromLook = pack?.roles[role] ?? def.roles?.[role];
    const label = (v: unknown): string => {
      if (v && typeof v === 'object' && 'material' in v) return coreMaterials.get((v as SurfaceStyle).material)?.displayName ?? (v as SurfaceStyle).material;
      if (typeof v === 'string') return role === 'facade' ? (FACADE_LABELS[v as keyof typeof FACADE_LABELS] ?? v) : role === 'door' ? (DOOR_STYLE_LABELS[v as DoorStyle] ?? v) : role === 'glass' ? (v === 'none' ? 'No glass' : (GLASS_KIND_LABELS[v as GlassKind] ?? v)) : v;
      return "the theme's";
    };
    const now = p.overrides?.roles?.[role];
    sel.append(new Option(`From the look (${label(fromLook)})`, '', false, now === undefined));
    const nowKey = now === undefined ? '' : typeof now === 'object' ? (now as SurfaceStyle).material : String(now);
    if ((SET_PIECE_MATERIAL_ROLES as readonly string[]).includes(role)) {
      let group: HTMLOptGroupElement | null = null;
      for (const m of coreMaterials.all()) {
        if (group?.label !== m.category) {
          group = document.createElement('optgroup');
          group.label = m.category;
          sel.append(group);
        }
        group.append(new Option(m.displayName, m.id, false, m.id === nowKey));
      }
    } else {
      const values: readonly string[] = role === 'facade' ? FACADES : role === 'door' ? DOOR_STYLES : [...GLASS_KINDS, 'none'];
      for (const v of values) sel.append(new Option(label(v), v, false, v === nowKey));
    }
    sel.addEventListener('change', () => {
      const roles: Record<string, unknown> = { ...(p.overrides?.roles ?? {}) };
      if (!sel.value) delete roles[role];
      else roles[role] = (SET_PIECE_MATERIAL_ROLES as readonly string[]).includes(role) ? { material: sel.value, tint: null } : sel.value;
      const overrides: NonNullable<SetPiecePlacement['overrides']> = { ...(p.overrides ?? {}) };
      if (Object.keys(roles).length) overrides.roles = roles as NonNullable<SetPiecePlacement['overrides']>['roles'];
      else delete overrides.roles;
      const { overrides: _old, ...rest } = p;
      void _old;
      update(`Set piece ${ROLE_LABELS[role].toLowerCase()}`, Object.keys(overrides).length ? { ...rest, overrides } : rest);
    });
    return sel;
  }

  /** One of a set piece's parts, in words (the inspector's parts list). */
  private partLabel(part: SetPieceDefinition['parts'][number]): string {
    switch (part.kind) {
      case 'tile':
        return `${coreCatalog.get(part.tile)?.displayName ?? part.tile} · ${levelName(part.z)}`;
      case 'block':
        return `Block ${part.size.map((v) => +v.toFixed(2)).join(' × ')} m`;
      case 'prop':
        return getProp(part.model)?.displayName ?? part.model;
      case 'door':
        return 'Door';
      case 'ladder':
        return 'Ladder';
      default:
        return 'Light';
    }
  }

  private bindUi(): void {
    $('ed-home').addEventListener('click', () => this.quit());
    $('ed-undo').addEventListener('click', () => this.undo());
    $('ed-redo').addEventListener('click', () => this.redo());
    $('ed-save').addEventListener('click', () => this.save());
    $('ed-export').addEventListener('click', () => {
      // Keep the identity the export stamped (map ID, version, hash), so the next export continues it.
      const release = exportMap(this.doc).metadata.release;
      if (release) this.doc.metadata.release = release;
    });
    $('ed-new').addEventListener('click', () => this.newMapDialog());
    $('ed-open').addEventListener('click', () => this.openDialog());
    $('ed-import').addEventListener('click', () => $('ed-import-file').click());
    $('ed-publish').addEventListener('click', () => {
      void openPublishDialog($<HTMLDialogElement>('ed-publish-dialog'), { doc: () => this.doc, builtIn: isBuiltInMap, toast: (t, err) => this.toast(t, err) });
    });
    $<HTMLInputElement>('ed-import-file').addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      (e.target as HTMLInputElement).value = '';
      if (!file) return;
      const r = await importMapFile(file);
      if (!('map' in r)) return this.toast(`Import failed: ${r.issues[0]?.message ?? 'unknown error'}`, true);
      this.keepDraft();
      this.replaceDocument(r.map);
      const errors = r.issues.filter((i) => i.severity === 'error').length;
      this.toast(`Imported ${r.map.metadata.name}${errors ? ` (${errors} problem${errors === 1 ? '' : 's'} to fix before it plays: see the list)` : ''}`);
    });
    $('ed-test').addEventListener('click', () => this.test());
    this.setupSidebars();
    $('ed-status').addEventListener('click', () => $('ed-issues').scrollIntoView({ behavior: 'smooth' }));
    $('ed-level-up').addEventListener('click', () => this.setLevel(this.level + 1));
    $('ed-level-down').addEventListener('click', () => this.setLevel(this.level - 1));
    $<HTMLInputElement>('ed-showall').addEventListener('change', (e) => this.setShowAll((e.target as HTMLInputElement).checked));

    const name = $<HTMLInputElement>('ed-name');
    name.addEventListener('change', () => {
      const v = name.value.trim().slice(0, 80) || 'Untitled Map';
      if (v !== this.doc.metadata.name) this.run('Rename map', { kind: 'setMetadata', before: { name: this.doc.metadata.name }, after: { name: v } });
    });
    name.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') name.blur();
    });

    const bots = $<HTMLSelectElement>('ed-bots');
    for (let i = 0; i <= 15; i++) bots.append(new Option(`${i} bot${i === 1 ? "" : "s"}`, String(i), i === 3, i === 3));

    $('ed-grid').addEventListener('click', () => {
      const on = !$('ed-grid').classList.contains('on');
      $('ed-grid').classList.toggle('on', on);
      $('ed-grid').setAttribute('aria-pressed', String(on));
      this.view.setGridVisible(on);
      // Off also leaves the full grid.
      if (!on && this.view.area.gridFull) this.setGridFull(false);
    });
    // Full grid: over the whole build area, out to the build limit (owner, 2026-11-05); turns Grid on.
    $('ed-grid-full').addEventListener('click', () => this.setGridFull(!this.view.area.gridFull));
    // Overlaps: highlight where two pieces' faces share a plane (the geometry.coplanar warning's places).
    $('ed-overlaps').addEventListener('click', () => {
      this.overlapsOn = !this.overlapsOn;
      $('ed-overlaps').classList.toggle('on', this.overlapsOn);
      $('ed-overlaps').setAttribute('aria-pressed', String(this.overlapsOn));
      this.view.setOverlaps(this.overlapsOn ? this.zSpots : null);
    });
    $<HTMLSelectElement>('ed-snap').addEventListener('change', (e) => (this.snapMode = (e.target as HTMLSelectElement).value as typeof this.snapMode));
    const theme = $<HTMLSelectElement>('ed-theme');
    for (const t of coreThemes.all()) theme.append(new Option(t.displayName, t.id));
    theme.addEventListener('change', () => this.run('Change theme', setThemeCommand(this.doc, theme.value)));
  }

  private setGridFull(on: boolean): void {
    this.view.setGridFull(on);
    $('ed-grid-full').classList.toggle('on', on);
    $('ed-grid-full').setAttribute('aria-pressed', String(on));
    if (on && !$('ed-grid').classList.contains('on')) $('ed-grid').click();
  }

  private updateTopBar(): void {
    $<HTMLSelectElement>('ed-theme').value = this.doc.classicStructure.theme;
    const name = $<HTMLInputElement>('ed-name');
    if (document.activeElement !== name) name.value = this.doc.metadata.name;
    $('ed-dirty').classList.toggle('on', this.isDirty());
    $<HTMLButtonElement>('ed-undo').disabled = !this.history.canUndo;
    $<HTMLButtonElement>('ed-redo').disabled = !this.history.canRedo;
    $('ed-undo').title = this.history.undoLabel ? `Undo ${this.history.undoLabel} (Ctrl+Z)` : 'Undo (Ctrl+Z)';
    $('ed-redo').title = this.history.redoLabel ? `Redo ${this.history.redoLabel} (Ctrl+Y)` : 'Redo (Ctrl+Y)';
  }

  private updateCounts(): void {
    const tiles = this.doc.classicStructure.tiles.length;
    const spawns = this.doc.entities.filter((e) => e.kind === 'spawn').length;
    const pickups = this.doc.entities.filter((e) => e.kind === 'pickup').length;
    const npcs = this.doc.entities.filter((e) => e.kind === 'encounter').length;
    const scenario = this.doc.entities.length - spawns - pickups - npcs;
    const rules = this.doc.logic.rules.length;
    const pieces = this.doc.setPieces?.length ?? 0;
    // Counted once per version of the document (refresh runs this on every edit and level change), set pieces expanded.
    if (this.countedDoc !== this.doc) {
      this.countedDoc = this.doc;
      this.countedBoxes = this.mapBoxes().length;
    }
    const boxes = this.countedBoxes;
    $('ed-counts').textContent = `${tiles} tiles${pieces ? ` · ${pieces} set piece${pieces === 1 ? '' : 's'}` : ''} · ${spawns} spawns · ${pickups} pickups · ${scenario} scenario objects · ${npcs} NPC squads · ${rules} rules · ${boxes} collision boxes`;
  }

  /** Environment → Sky: the backdrop's one home, kept in step with the map. */
  private renderSkyPane(): void {
    const el = document.getElementById('ed-sky');
    if (!el) return;
    el.replaceChildren();
    this.renderBackdropPanel(el);
  }

  /**
   * Players by mode (the map's player caps, metadata.playerCaps): for each mode the map plays (squads and races keep
   * their own sizes), the recommended and most players. Empty fields show the automatic caps (worked out from the
   * map's size and spawn points: sim/matchSetup.ts autoPlayerCaps); typing one sets the mode's own, Auto goes back.
   */
  private renderPlayerCaps(el: HTMLElement): void {
    const doc = this.doc;
    const modes = playableModes(doc).filter((m) => setupFamily(m) === 'ffa' || setupFamily(m) === 'teams');
    if (!modes.length) return;
    const head = document.createElement('h3');
    head.textContent = 'Players by mode';
    head.title = 'What Match Setup recommends for each mode and the most it takes here; rotations and map changes keep matches within the most';
    const box = document.createElement('div');
    box.id = 'ed-player-caps';
    box.className = 'ed-caps';
    for (const mode of modes) {
      const caps = mapPlayerCaps(doc, mode);
      const auto = autoPlayerCaps(doc, mode);
      const set = (recommended: number, max: number) => {
        const before = doc.metadata.playerCaps;
        const r = Math.max(1, Math.min(128, Math.round(recommended)));
        const m = Math.max(r, Math.min(128, Math.round(max)));
        this.run(`Set ${MODE_LABELS[mode]} players`, { kind: 'setMetadata', before: { playerCaps: before }, after: { playerCaps: { ...(before ?? {}), [mode]: { recommended: r, max: m } } } });
      };
      const rec = numberInput(caps.recommended, 1, (v) => set(v, Math.max(v, caps.max)));
      rec.dataset.mode = mode;
      rec.dataset.cap = 'recommended';
      rec.title = `Recommended (automatic: ${auto.recommended})`;
      const max = numberInput(caps.max, 1, (v) => set(Math.min(caps.recommended, v), v));
      max.dataset.mode = mode;
      max.dataset.cap = 'max';
      max.title = `Most (automatic: ${auto.max})`;
      const line = document.createElement('div');
      line.className = 'ed-cap-row';
      line.append(rec, document.createTextNode(' best, up to '), max);
      if (caps.auto) line.append(small(' (automatic)'));
      else {
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'ed-cap-auto';
        back.textContent = 'Auto';
        back.title = `Back to the automatic caps (${auto.recommended} best, up to ${auto.max})`;
        back.addEventListener('click', () => {
          const before = doc.metadata.playerCaps;
          const { [mode]: _gone, ...rest } = before ?? {};
          this.run(`${MODE_LABELS[mode]} players: automatic`, { kind: 'setMetadata', before: { playerCaps: before }, after: { playerCaps: Object.keys(rest).length ? rest : undefined } });
        });
        line.append(back);
      }
      box.append(row(MODE_LABELS[mode], line));
    }
    el.append(head, box);
  }

  private renderInspector(): void {
    this.renderSkyPane();
    const el = $('ed-inspector');
    el.replaceChildren();
    const { tiles, entities } = this.selection;
    const pieces = this.selPieces();
    const doc = this.doc;
    if (this.selCount() === 0) {
      el.append(h2('Map properties'));
      // The map's picture (Set thumbnail) and plan (reference board: map properties).
      el.append(thumbnailSection(this.thumbHost));
      const name = document.createElement('input');
      name.type = 'text';
      name.id = 'ed-prop-name';
      name.value = doc.metadata.name;
      name.maxLength = 80;
      name.addEventListener('change', () => {
        const v = name.value.trim().slice(0, 80) || 'Untitled Map';
        if (v !== this.doc.metadata.name) this.run('Rename map', { kind: 'setMetadata', before: { name: this.doc.metadata.name }, after: { name: v } });
      });
      el.append(row('Name', name));
      const theme = document.createElement('select');
      for (const t of coreThemes.all()) theme.append(new Option(t.displayName, t.id, false, t.id === doc.classicStructure.theme));
      theme.addEventListener('change', () => this.run('Change theme', setThemeCommand(this.doc, theme.value)));
      el.append(row('Theme', theme));
      const occupied = [...doc.classicStructure.tiles.flatMap((t) => placementCells(t) ?? []), ...[...this.expansion.footprints.values()].flat()];
      if (occupied.length) {
        const span = (i: 0 | 1 | 2) => Math.max(...occupied.map((c) => c[i])) - Math.min(...occupied.map((c) => c[i])) + 1;
        el.append(row('Size', text(`${span(0)} × ${span(1)} cells · ${span(2)} level${span(2) === 1 ? '' : 's'}`)));
      }
      const rp = doc.metadata.recommendedPlayers;
      const setPlayers = (min: number, max: number) =>
        this.run('Set player count', { kind: 'setMetadata', before: { recommendedPlayers: rp }, after: { recommendedPlayers: { min: Math.max(1, Math.min(96, min)), max: Math.max(1, Math.min(96, max)) } } });
      el.append(row('Min players', numberInput(rp.min, 1, (v) => setPlayers(v, rp.max))), row('Max players', numberInput(rp.max, 1, (v) => setPlayers(rp.min, v))));
      const mode = document.createElement('select');
      const current = doc.metadata.supportedModes[0] ?? 'core.deathmatch';
      for (const [id, label] of [['core.deathmatch', 'Deathmatch'], ['core.tdm', 'Team Deathmatch'], ['core.ctf', 'Capture the Flag'], ['core.koth', 'King of the Hill'], ['core.elim', 'Elimination'], ['core.breakthrough', 'Breakthrough'], ['core.coop', 'Co-op mission'], ['core.zombies', 'Zombies'], ['core.discs', 'Disc Arena'], ['core.race', 'Race']] as const) mode.append(new Option(label, id, false, id === current));
      // The main mode (the map's pick, what TEST plays) changes; the modes it also offers stay.
      mode.addEventListener('change', () => this.run('Change mode', { kind: 'setMetadata', before: { supportedModes: doc.metadata.supportedModes }, after: { supportedModes: [mode.value, ...doc.metadata.supportedModes.slice(1).filter((m) => m !== mode.value)] } }));
      const teams = mapTeams(doc);
      const help: Record<string, string> = {
        'core.coop': 'Co-op: all players (and bots) team up against the NPC squads. Logic ends the mission with "players win" or "players lose".',
        'core.zombies': 'Zombies: everyone holds out against endless waves. Zombies rise from your NPC spawners (vents, hatches, burrows) first, then out-of-sight spawn points and open floor. Every map can be played this way.',
        'core.tdm': `Team Deathmatch: ${teams.map((t) => t.name).join(' against ')}. Give spawns a team in their inspector; teams without spawns of their own use the shared ones.`,
        'core.deathmatch': 'Deathmatch: everyone for themselves. NPC squads fight everyone.',
        'core.ctf': `Capture the Flag: ${teams.slice(0, 2).map((t) => t.name).join(' against ')}. Place a Flag Base (Entities tab) for each team; bring the enemy flag to yours while yours is home. Other modes ignore flag bases.`,
        'core.hostage': 'Hostage Rescue: place Hostages and at least one Rescue Zone; the first team rescues.',
        'core.breakthrough': 'Breakthrough: the first team attacks through the sectors in order, the second holds each line in turn. Entities tab (Spawns & Objectives): place a Sector for each line (1, 2, 3…, facing the way the attackers push), its objectives (Capture Zones, Destroy Targets, a Final Hold in the last) and an Attackers\' and a Defenders\' Spawn group for each sector.',
        'core.discs': 'Disc Arena: everyone throws bouncing discs that knock players about; knocking someone into the void scores. Build decks over nothing (free blocks), join them with jump pads, add walls to bank discs off, and place power disc pickups.',
        'core.bomb': 'Bomb: place Bomb Sites (A and B) away from both team spawns; the first team attacks.',
        'core.koth': 'King of the Hill: place one or more Hills (Entities tab). The hill moves to the next one every minute; a team scores while it alone stands on it.',
        'core.elim': 'Elimination: round-based Team Deathmatch. No respawns until the next round; the last team standing wins it.',
        'core.race': 'Race: draw the track with the Paths tool (Shift+G, or Vehicles → Race Track) and tick Race track. Everyone starts on the grid behind its green first point in the track\'s vehicle; checkpoints are spaced along it in point order (laps on a loop, one run on an open path). Spawn points are only used before the race puts you in your car.',
      };
      // Maps with flag bases or hills also offer those modes in the Arcade, whatever the main mode is.
      const extra = playableModes(doc).filter((m) => m !== current && m !== 'core.elim');
      if (extra.length) help[mode.value] = `${help[mode.value] ?? ''} Also playable here: ${extra.map((m) => MODE_LABELS[m]).join(', ')}.`;
      el.append(row('Mode', mode), small(help[mode.value] ?? ''));
      // Modes the map offers besides its main one (the rest follow from its pieces: flag bases, hills, sectors...).
      const also = document.createElement('div');
      also.id = 'ed-prop-also';
      also.className = 'ed-layers';
      for (const [id, label] of [['core.deathmatch', 'Deathmatch'], ['core.tdm', 'Team Deathmatch'], ['core.coop', 'Co-op mission']] as const) {
        if (id === current) continue;
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.dataset.mode = id;
        box.checked = doc.metadata.supportedModes.includes(id);
        box.addEventListener('change', () => {
          const now = this.doc.metadata.supportedModes;
          const next = box.checked ? [...now.filter((m) => m !== id), id] : now.filter((m) => m !== id);
          this.run(box.checked ? `Also offer ${label}` : `Stop offering ${label}`, { kind: 'setMetadata', before: { supportedModes: now }, after: { supportedModes: next.length ? next : [current] } });
        });
        const lab = document.createElement('label');
        lab.append(box, document.createTextNode(label));
        also.append(lab);
      }
      const alsoRow = row('Also offered', also);
      alsoRow.title = 'Other modes Match Setup offers on this map; the Mode above is its own pick and what TEST plays';
      el.append(alsoRow);
      if (current === 'core.tdm' || current === 'core.koth' || current === 'core.elim' || current === 'core.breakthrough') this.renderTeamSetup(el);
      this.renderWeaponSet(el);
      this.renderMapBots(el);
      this.renderPlayerCaps(el);
      const layersHead = document.createElement('h3');
      layersHead.id = 'ed-layers-head';
      layersHead.textContent = 'Map layers';
      const layers = document.createElement('div');
      layers.className = 'ed-layers';
      for (const [key, label] of [['tile', 'Tiles'], ['prop', 'Props'], ['pickup', 'Pickups'], ['logic', 'Logic & traps'], ['spawn', 'Spawn points']] as const) {
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.dataset.layer = key;
        box.checked = !this.view.hiddenLayers.has(key);
        box.addEventListener('change', () => {
          if (box.checked) this.view.hiddenLayers.delete(key);
          else this.view.hiddenLayers.add(key);
          this.view.applyTileLayer();
          this.updateSelectionVisuals();
        });
        const lab = document.createElement('label');
        lab.append(box, document.createTextNode(label));
        layers.append(lab);
      }
      el.append(layersHead, layers);
      const desc = document.createElement('textarea');
      desc.rows = 3;
      desc.value = doc.metadata.description;
      desc.placeholder = 'Description';
      desc.addEventListener('change', () => this.run('Edit description', { kind: 'setMetadata', before: { description: doc.metadata.description }, after: { description: desc.value.slice(0, 2000) } }));
      el.append(desc);
      // A map for the tests (maps/test_coverage.json): no map list, template list, rotation or host picker offers it.
      const testOnly = document.createElement('input');
      testOnly.type = 'checkbox';
      testOnly.id = 'ed-prop-testonly';
      testOnly.checked = !!doc.metadata.testOnly;
      testOnly.addEventListener('change', () => this.run(testOnly.checked ? 'Mark as test map' : 'Unmark test map', { kind: 'setMetadata', before: { testOnly: doc.metadata.testOnly }, after: { testOnly: testOnly.checked || undefined } }));
      const testRow = row('Test map', testOnly);
      testRow.title = 'A map for the automated tests: hidden from the map lists, templates, rotations and the host picker';
      el.append(testRow);
      // The map's ID (its file name in maps/: `iron_coast` is maps/iron_coast.json), for a new official or test map.
      const mapId = document.createElement('input');
      mapId.type = 'text';
      mapId.id = 'ed-prop-id';
      mapId.value = doc.metadata.id;
      mapId.maxLength = 64;
      mapId.pattern = '[a-z0-9_]{4,64}';
      mapId.addEventListener('change', () => {
        const v = mapId.value.trim();
        if (!/^[a-z0-9_]{4,64}$/.test(v)) {
          mapId.value = doc.metadata.id;
          return this.toast('A map ID is 4 to 64 lowercase letters, digits and underscores (its file name in maps/)', true);
        }
        if (v !== this.doc.metadata.id) this.run('Change map ID', { kind: 'setMetadata', before: { id: this.doc.metadata.id }, after: { id: v } });
      });
      const idRow = row('Map ID', mapId);
      idRow.title = "The map's ID: lowercase letters, digits and underscores; an official map's file is maps/<ID>.json. Set it once, before the map is shared: a published or exported map keeps its ID.";
      el.append(idRow);

      const sky = button('Sky, scenery & border…', () => {
        this.setWorkspace('environment');
        this.showPane('sky');
      });
      sky.title = 'The sky, distant scenery, haze and the border live in Environment → Sky';
      el.append(sky);
      this.renderBloodPanel(el);
      this.renderPhysicsPanel(el);
      if (doc.classicStructure.tiles.some((t) => dressable(coreCatalog.get(t.tile)))) {
        const all = button('Dress all bare rooms', () => this.dressAllRooms());
        all.id = 'ed-dress-all';
        all.title = 'Furnish every room with no props in it, as a room type guessed from its size and the theme (undo takes it back)';
        el.append(all);
      }
      if (doc.terrain && doc.entities.some((e) => e.kind === 'prop')) {
        const settle = button('Settle all props on ground', () => this.settleProps());
        settle.id = 'ed-settle-all';
        el.append(settle, small('Beds every prop standing on the terrain into the slope under it; props on floors and blocks stay put.'));
      }
      this.renderBoundsPanel(el);
      return;
    }
    if (pieces.length === 1 && tiles.length + entities.length === 0) {
      this.pieceInspector(el, pieces[0]!);
    } else if (tiles.length === 1 && entities.length === 0 && !pieces.length) {
      const t = doc.classicStructure.tiles.find((x) => x.id === tiles[0])!;
      el.append(h2(coreCatalog.get(t.tile)?.displayName ?? t.tile));
      const type = document.createElement('select');
      for (const def of coreCatalog.all()) type.append(new Option(def.displayName, def.id, false, def.id === t.tile));
      type.addEventListener('change', () => this.run('Replace tile', updateTileCommand(doc, t, { ...t, tile: type.value })));
      const set = (patch: Partial<typeof t>) => this.run('Edit tile', updateTileCommand(doc, t, { ...t, ...patch }));
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
          const apply = () => this.setEdge(target, sel.value as EdgeStyle, (glass.value || null) as GlassKind | null);
          sel.addEventListener('change', () => {
            if (GLASS_EDGES.has(sel.value as never) && !edgeGlassAt(this.doc, target)) glass.value = this.edgeGlass ?? '';
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
      this.upperFloorsPanel(el, t);
      if (def && dressable(def)) this.dressPanel(el, t);
      const h3 = document.createElement('h3');
      h3.textContent = 'Surfaces';
      el.append(h3);
      // The Paint tool's own "Apply to", shared: a change here is a change there.
      const scope = document.createElement('select');
      scope.id = 'ed-insp-scope';
      for (const [v, label] of [['surface', 'This surface'], ['sameType', 'Same piece type'], ['level', 'Whole level'], ['all', 'Whole map']] as const) scope.append(new Option(label, v, false, v === this.paintScope));
      scope.addEventListener('change', () => {
        this.paintScope = scope.value as PaintScope;
        $<HTMLSelectElement>('ed-scope').value = scope.value;
      });
      el.append(row('Apply to', scope));
      // The roof's top only where the room has a roof (room option Ceiling).
      const roofed = !!t.options?.ceiling && t.options.ceiling !== 'open';
      for (const slot of SURFACE_SLOTS) if (slot !== 'roof' || roofed || t.surfaces?.roof) el.append(this.surfaceRow(t, slot));
      el.append(small(`ID ${t.id}`));
    } else if (entities.length === 1 && tiles.length === 0 && !pieces.length) {
      this.entityInspector(el, doc.entities.find((x) => x.id === entities[0])!);
    } else if (tiles.length === 0 && !pieces.length && this.wholeBuild(entities)) {
      // A moving build selected whole: its mover's settings; moving, rotating, duplicating or deleting takes every part.
      const group = this.wholeBuild(entities)!;
      el.append(small(`A moving build: the mover and the ${group.length - 1} parts it carries, selected together. Move, rotate (R), duplicate or delete it as one; Alt-click picks a single part.`));
      this.entityInspector(el, doc.entities.find((x) => x.id === group[0])!);
    } else {
      el.append(h2(`${this.selCount()} selected`));
      el.append(text(`${tiles.length} tiles, ${entities.length} entities${pieces.length ? `, ${pieces.length} set piece${pieces.length === 1 ? '' : 's'}` : ''}`));
      // Box-selected pieces can become a set piece of their own.
      const save = button('Save as set piece…', () => this.saveSelectionDialog());
      save.id = 'ed-insp-save-piece';
      save.title = 'Make a set piece of the selected tiles, blocks, props, doors, ladders and lights, for your library (set pieces count as their parts)';
      el.append(save);
    }
    const buttons = document.createElement('div');
    buttons.className = 'buttons';
    buttons.append(button('Rotate (R)', () => this.rotate()));
    if (pieces.length) {
      const m = button('Mirror (M)', () => this.mirror());
      m.id = 'ed-insp-mirror';
      const refused = pieces.map((id) => this.placementOf(id)).map((p) => p && this.pieceDef(p.piece)).find((d) => d && setPieceMirrorRefusal(d));
      if (refused) {
        m.disabled = true;
        m.title = setPieceMirrorRefusal(refused)!;
      }
      buttons.append(m);
    }
    buttons.append(button('Duplicate', () => this.duplicate()), button('Delete', () => this.deleteSelection()), button('Focus (F)', () => this.focusSelection()));
    el.append(buttons);
    if (doc.terrain && entities.some((id) => doc.entities.find((x) => x.id === id)?.kind === 'prop')) {
      const settle = button('Settle on ground', () => this.settleProps(entities));
      settle.id = 'ed-settle';
      settle.title = 'Bed the selected props into the terrain under them (no floating corners on slopes)';
      el.append(settle);
    }
  }

  /**
   * "Replace all": every prop placed as `model` becomes another prop or an environment species' variant, keeping each
   * one's position, facing, name and tint, and its height (or its scale number); one undo step (replacePropsCommand).
   * A retired piece offers the species that replaced it first (REPLACEMENTS).
   */
  private replaceAllSection(el: HTMLElement, model: string): void {
    const count = this.doc.entities.filter((x) => x.kind === 'prop' && x.model === model).length;
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
      const cmd = replacePropsCommand(this.doc, model, target.value, size.value as ReplaceSize, Number(turn.value));
      const n = cmd.kind === 'updateEntities' ? cmd.after.length : 0;
      if (!n) return this.toast('Nothing to replace');
      const label = target.selectedOptions[0]?.textContent ?? target.value;
      if (this.run(`Replace all ${name}`, cmd)) this.toast(`Replaced ${n} ${name} with ${label}`);
    });
    go.id = 'ed-replace-all';
    go.title = 'Every one of this prop on the map, in one undo step';
    el.append(go);
  }

  /** "Draw route": edit a mover's or plane's points on the map with the Paths tool's hands (the Route tool). */
  private drawRouteButton(id: string): HTMLButtonElement {
    const b = button('Draw route on the map', () => {
      this.routes.edit(id);
      this.setTool({ kind: 'route' });
    });
    b.id = 'ed-draw-route';
    b.title = 'Click to add points, drag them, Shift-click a stretch to insert, right-click or Del to remove (Esc when done)';
    return b;
  }

  /** The moving build `ids` make up exactly (its IDs, mover first), or null. */
  private wholeBuild(ids: readonly string[]): string[] | null {
    const group = ids.length > 1 ? moverGroupOf(this.doc, ids[0]!) : null;
    return group && group.length === ids.length && group.every((id) => ids.includes(id)) ? group : null;
  }

  /** Inspector fields for one entity: position, facing and its kind's settings. */
  /** The inspector's quick facings for one thing: 0°, 90°, 180°, 270° in one click (one undo step each). */
  private quickFacings(sel: Selection, facing: number): HTMLElement {
    return quickFacings(facing, (deg) => {
      this.run(`Face ${deg}°`, setFacingCommand(this.doc, sel, deg, coreCatalog, this.placeLib));
    });
  }

  private entityInspector(el: HTMLElement, e: MapEntity): void {
    const doc = this.doc;
    const update = (label: string, patch: Partial<MapEntity>) => this.run(label, { kind: 'updateEntities', before: [e], after: [{ ...e, ...patch } as MapEntity] });
    el.append(h2(e.kind === 'spawn' ? 'Player Spawn' : e.kind === 'pickup' ? (e.random ? `Random ${WEAPON_CATEGORY_LABELS[e.random]}` : (getItem(e.item)?.displayName ?? e.item)) : entityLabel(doc, e)));
    if (e.kind !== 'spawn' && e.kind !== 'pickup') {
      const name = document.createElement('input');
      name.type = 'text';
      name.value = e.name ?? '';
      name.placeholder = entityLabel(doc, { ...e, name: undefined });
      name.maxLength = 40;
      name.addEventListener('change', () => update('Rename', { name: name.value.trim() || undefined }));
      el.append(row('Name', name));
    }
    const setPos = (i: number, v: number) => {
      const position = [...e.position] as [number, number, number];
      position[i] = v;
      update(`Move ${e.kind}`, { position });
    };
    el.append(
      row('X', numberInput(e.position[0], 0.5, (v) => setPos(0, v))),
      row('Height', numberInput(e.position[1], 0.25, (v) => setPos(1, v))),
      row('Z', numberInput(e.position[2], 0.5, (v) => setPos(2, v))),
    );
    if ('yaw' in e) el.append(row('Facing °', numberInput(Math.round((e.yaw * 180) / Math.PI), Math.round((yawStep(e.kind) * 180) / Math.PI), (deg) => update('Turn', { yaw: normalizeYaw((deg * Math.PI) / 180) }))), this.quickFacings({ tiles: [], entities: [e.id] }, e.yaw));

    const toggle = (label: string, value: boolean, patch: (v: boolean) => Partial<MapEntity>) => {
      const c = document.createElement('input');
      c.type = 'checkbox';
      c.checked = value;
      c.addEventListener('change', () => update(`Set ${label.toLowerCase()}`, patch(c.checked)));
      el.append(row(label, c));
    };
    const choose = (label: string, options: readonly (readonly [string, string])[], value: string, patch: (v: string) => Partial<MapEntity>) => {
      const sel = document.createElement('select');
      for (const [v, l] of options) sel.append(new Option(l, v, false, v === value));
      sel.addEventListener('change', () => update(`Set ${label.toLowerCase()}`, patch(sel.value)));
      el.append(row(label, sel));
    };
    const number = (label: string, value: number, step: number, patch: (v: number) => Partial<MapEntity>) => el.append(row(label, numberInput(value, step, (v) => update(`Set ${label.toLowerCase()}`, patch(v)))));
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    // Team-only buttons, doors and zones (any team of the map, or an NPC faction).
    const teamFilter = (value: string | undefined, what: string) => {
      const sides = [...mapTeams(doc, MAX_TEAMS).map((t) => [t.id, t.name] as const), ...mapFactions(doc).map((f) => [f.id, `${f.name} (NPCs)`] as const), ['players', 'Players (co-op)'] as const];
      choose('Team only', [['', 'Everyone'] as const, ...sides], value ?? '', (v) => ({ team: v || undefined }) as Partial<MapEntity>);
      if (value) el.append(small(`Only that team ${what}.`));
    };

    switch (e.kind) {
      case 'prop': {
        const model = document.createElement('select');
        for (const category of PROP_CATEGORIES) {
          const group = document.createElement('optgroup');
          group.label = category;
          for (const def of CORE_PROPS.filter((d) => d.category === category)) group.append(new Option(def.displayName, def.id, false, def.id === e.model));
          model.append(group);
        }
        // Environment species (the procedural environment's preview): listed when the map has one or with ?env=1.
        const species = getEnvSpecies(e.model);
        if (species || envRendererOn()) {
          const group = document.createElement('optgroup');
          group.label = 'Environment (preview)';
          for (const s of ENV_SPECIES) group.append(new Option(s.displayName, s.id, false, s.id === e.model));
          model.append(group);
        }
        // A species' variant is kept only while it stays an environment species.
        model.addEventListener('change', () => update('Change prop', { model: model.value, variant: getEnvSpecies(model.value) ? e.variant : undefined }));
        el.append(row('Model', model));
        if (species) {
          choose('Variant', species.variants.map((v) => [String(v.index), v.name[0]!.toUpperCase() + v.name.slice(1)] as const), String(e.variant ?? 0), (v) => ({ variant: v === '0' ? undefined : Number(v) }));
          el.append(small(`${species.displayName}: ${species.role === 'decorative' ? 'decoration only' : species.nav === 'none' ? 'walk-through cover (conceals)' : 'solid: its trunk or rock stops movement, shots and bots'}.`));
        }
        number('Scale', e.scale, 0.25, (v) => ({ scale: Math.max(0.25, Math.min(4, v)) }));
        toggle('Solid', e.solid, (v) => ({ solid: v }));
        const tint = document.createElement('input');
        tint.type = 'color';
        tint.value = e.tint ?? '#ffffff';
        tint.addEventListener('change', () => update('Tint prop', { tint: tint.value.toLowerCase() === '#ffffff' ? null : tint.value.toLowerCase() }));
        el.append(row('Tint', tint));
        if (!getProp(e.model)?.collision && !species) el.append(small('This prop never blocks (decoration).'));
        this.replaceAllSection(el, e.model);
        break;
      }
      case 'pickup': {
        choose('Item', CORE_ITEMS.map((it) => [it.id, it.displayName] as const), e.item, (v) => ({ item: v, ...(e.random && itemCategory(getItem(v)) !== e.random ? { random: undefined } : {}) }));
        // Weapon pickups: a fixed weapon, or a random one of a category rolled each time it comes back.
        if (itemCategory(getItem(e.item)) || e.random) {
          const mode = document.createElement('select');
          mode.id = 'ed-pickup-weapon';
          mode.append(new Option('Fixed: this weapon', '', false, !e.random));
          for (const c of WEAPON_CATEGORIES) mode.append(new Option(`Random from category: ${WEAPON_CATEGORY_LABELS[c]}`, c, false, c === e.random));
          mode.addEventListener('change', () => {
            const c = isWeaponCategory(mode.value) ? mode.value : null;
            // A random pickup shows a weapon of its category here (the first, unless it already holds one).
            const item = c && itemCategory(getItem(e.item)) !== c ? categoryItems(c)[0]?.id : undefined;
            update(c ? 'Random weapon pickup' : 'Fixed weapon pickup', { random: c ?? undefined, ...(item ? { item } : {}), ...(c ? { keepFixed: undefined } : {}) });
          });
          el.append(row('Weapon', mode));
          if (e.random) el.append(small(`Rolls one of ${categoryItems(e.random).map((i) => i.displayName).join(', ')} each time it comes back.`));
          else {
            const keep = document.createElement('input');
            keep.type = 'checkbox';
            keep.id = 'ed-pickup-keep';
            keep.checked = !!e.keepFixed;
            keep.addEventListener('change', () => update('Set keep fixed', { keepFixed: keep.checked || undefined }));
            el.append(row('Keep fixed', keep));
            el.append(small(e.keepFixed ? 'Stays this weapon when the host mixes up weapon pickups.' : 'The host\'s "Mix up weapon pickups" swaps it for another weapon of its kind; tick to keep it.'));
          }
        }
        const def = getItem(e.item)?.respawnSeconds ?? 0;
        number('Respawn (s)', e.respawnSeconds ?? def, 5, (v) => ({ respawnSeconds: v === def ? null : clamp(v, 1, 600) }));
        el.append(small(e.respawnSeconds === null ? `Item default (${def}s)` : 'Custom respawn time'));
        break;
      }
      case 'door':
        choose('Look', DOOR_STYLES.map((s) => [s, DOOR_STYLE_LABELS[s]] as const), e.style ?? 'sliding', (v) => ({ style: v === 'sliding' ? undefined : (v as DoorStyle) }));
        toggle('Opens by itself', e.auto, (v) => ({ auto: v }));
        toggle('Locked', e.locked, (v) => ({ locked: v }));
        toggle('Starts open', e.startOpen, (v) => ({ startOpen: v }));
        el.append(small(e.auto ? 'Slides open when a player comes close (unless locked).' : 'Players press E to open it, or logic opens it.'));
        teamFilter(e.team, 'opens it by walking up or pressing E (logic still opens it for everyone); bots of other teams path round it');
        break;
      case 'button':
        {
          const label = document.createElement('input');
          label.type = 'text';
          label.value = e.label;
          label.maxLength = 40;
          label.addEventListener('change', () => update('Set prompt', { label: label.value.trim() || 'Press' }));
          el.append(row('Prompt', label));
        }
        toggle('Single use', e.once, (v) => ({ once: v }));
        number('Cooldown (s)', e.cooldownSeconds, 0.5, (v) => ({ cooldownSeconds: clamp(v, 0.2, 60) }));
        toggle('Starts enabled', e.startEnabled, (v) => ({ startEnabled: v }));
        teamFilter(e.team, 'can press it');
        break;
      case 'destructible': {
        const spec = DESTRUCTIBLE_SPECS[e.model];
        choose('Model', DESTRUCTIBLE_MODELS.map((m) => [m, DESTRUCTIBLE_SPECS[m].label] as const), e.model, (v) => ({ model: v as typeof e.model, health: null }));
        number('Health', e.health ?? spec.health, 10, (v) => ({ health: v === spec.health ? null : clamp(v, 1, 5000) }));
        toggle('Explosives only', e.explosiveOnly, (v) => ({ explosiveOnly: v }));
        if (spec.blast) el.append(small('Explodes when destroyed.'));
        break;
      }
      case 'block': {
        number('Width (X)', e.size[0], 0.5, (v) => ({ size: [clamp(v, e.glass ? 0.05 : 0.2, 64), e.size[1], e.size[2]] }));
        number('Thickness', e.size[1], 0.25, (v) => ({ size: [e.size[0], clamp(v, 0.1, 32), e.size[2]] }));
        number('Depth (Z)', e.size[2], 0.5, (v) => ({ size: [e.size[0], e.size[1], clamp(v, e.glass ? 0.05 : 0.2, 64)] }));
        const labels: Record<(typeof BLOCK_BEHAVIOURS)[number], string> = { solid: 'Solid (sky block)', breakable: 'Breakable (shoot it)', crumble: 'Crumbles when stood on', trapdoor: 'Trapdoor (drops away)' };
        choose('Behaviour', BLOCK_BEHAVIOURS.map((b) => [b, labels[b]] as const), e.behaviour, (v) => ({ behaviour: v as typeof e.behaviour }));
        const mats = document.createElement('select');
        mats.append(new Option("Theme's solid material", '', false, e.material === null));
        for (const m of coreMaterials.all()) mats.append(new Option(m.displayName, m.id, false, m.id === e.material));
        mats.addEventListener('change', () => update('Block material', { material: mats.value || null }));
        el.append(row('Material', mats));
        if (e.behaviour === 'crumble' || e.behaviour === 'trapdoor') {
          choose('Set off by', [['step', 'someone standing on it'], ['logic', 'logic only (destroy action)']], e.trigger, (v) => ({ trigger: v as typeof e.trigger }));
          number('Delay (s)', e.delaySeconds, 0.1, (v) => ({ delaySeconds: clamp(v, 0, 10) }));
        }
        if (e.behaviour === 'breakable') number('Health', e.health, 10, (v) => ({ health: clamp(v, 1, 5000) }));
        if (e.behaviour !== 'solid') {
          toggle('Comes back', e.respawnSeconds !== null, (v) => ({ respawnSeconds: v ? 8 : null }));
          if (e.respawnSeconds !== null) number('Back after (s)', e.respawnSeconds, 1, (v) => ({ respawnSeconds: clamp(v, 1, 600) }));
        }
        // Tilt: ramps, roofs, toppled wrecks (±45°, about the block's centre).
        const deg = (r: number | undefined) => Math.round(((r ?? 0) * 180) / Math.PI);
        const rad = (d: number) => {
          const r = (clamp(Math.round(d), -45, 45) * Math.PI) / 180;
          return r === 0 ? undefined : r;
        };
        number('Pitch ° (±45)', deg(e.pitch), 5, (v) => ({ pitch: rad(v) }));
        number('Roll ° (±45)', deg(e.roll), 5, (v) => ({ roll: rad(v) }));
        if (e.pitch || e.roll) el.append(small(`Pitch lifts its far (+Z) end, roll its +X side. Players walk up slopes of ${PLAYER.maxSlopeDegrees}° or less; steeper ones are slides and walls (bots treat them so too).`));
        toggle('Starts hidden', !!e.startHidden, (v) => ({ startHidden: v || undefined }));
        if (e.startHidden) el.append(small('Appears when a rule rebuilds or enables it (a bridge that extends).'));
        if (e.behaviour === 'solid' && !e.field) {
          // Glass as the block's material: see-through, stops players; breakable shatters, reinforced cracks.
          choose('Glass', [['', 'None'], ...GLASS_KINDS.map((k) => [k, GLASS_KIND_LABELS[k]] as const)], e.glass ?? '', (v) => ({ glass: (v || undefined) as GlassKind | undefined }));
          if (e.glass) el.append(small(e.glass === 'breakable' ? 'A glass panel: players can\'t pass, everyone sees through, and the first shot or blast shatters it (shots carry on through). It comes back next round, or after the map\'s glass time (Map settings).' : 'Bulletproof glass: players can\'t pass and shots stop at it, but everyone sees through. Hits crack and frost it; it never breaks.'));
        }
        if (e.behaviour === 'solid' && !e.glass) {
          toggle('Force field', !!e.field, (v) => ({ field: v || undefined, ...(v && !e.tint ? { tint: '#5ad8ff' } : {}) }));
          if (e.field) {
            const glow = document.createElement('input');
            glow.type = 'color';
            glow.value = e.tint ?? '#5ad8ff';
            glow.addEventListener('change', () => update('Colour field', { tint: glow.value.toLowerCase() }));
            el.append(row('Field colour', glow));
            el.append(small('A humming energy barrier: players and vehicles can\'t pass, but shots, grenades and sight go straight through. Switch it with logic: Drop block or Disable turns it off, Rebuild block or Enable back on (a team button that drops the enemy\'s shield).'));
          }
        }
        el.append(small(e.behaviour === 'solid' ? 'Part of the level: walk on it anywhere, at any height. Logic can drop it (Drop block), bring it back (Rebuild block) or carry it on a mover.' : 'Drawn with a coloured lip so players can learn what it does. Logic can drop it at any time (Drop block) and rebuild it.'));
        break;
      }
      case 'water':
        number('Width (X)', e.size[0], 1, (v) => ({ size: [clamp(v, 0.5, 512), e.size[1], e.size[2]] }));
        number('Depth (deep)', e.size[1], 0.25, (v) => ({ size: [e.size[0], clamp(v, 0.2, 64), e.size[2]] }));
        number('Length (Z)', e.size[2], 1, (v) => ({ size: [e.size[0], e.size[1], clamp(v, 0.5, 512)] }));
        choose('Liquid', LIQUIDS.map((l) => [l, LIQUID_SPECS[l].label] as const), e.liquid, (v) => ({ liquid: v as typeof e.liquid }));
        el.append(small(e.liquid === 'water' ? 'Deeper than 1 m you swim (hold jump to rise). Stay under 15 s and you start drowning.' : e.liquid === 'swamp' ? 'Slows everyone right down.' : `Hurts ${LIQUID_SPECS[e.liquid].dps} a second while you stand in it.`));
        {
          const tint = document.createElement('input');
          tint.type = 'color';
          tint.value = e.tint ?? LIQUID_LOOKS[e.liquid].color;
          tint.addEventListener('change', () => update('Tint liquid', { tint: tint.value.toLowerCase() }));
          el.append(row('Colour', tint));
          if (e.tint) el.append(button('Default colour', () => update('Tint liquid', { tint: undefined })));
        }
        el.append(small('Its surface is at Height + Depth: sink it into a pit or a dip in the terrain. Colour only changes the look (green acid, murky sewer water).'));
        break;
      case 'zone':
        number('Width (X)', e.size[0], 0.5, (v) => ({ size: [clamp(v, 0.5, 64), e.size[1], e.size[2]] }));
        number('Height', e.size[1], 0.5, (v) => ({ size: [e.size[0], clamp(v, 0.5, 32), e.size[2]] }));
        number('Depth (Z)', e.size[2], 0.5, (v) => ({ size: [e.size[0], e.size[1], clamp(v, 0.5, 64)] }));
        choose('Fires when', [['any', 'any player enters'], ['count', 'enough players are in'], ['all', 'every living player is in']], e.who, (v) => ({ who: v as typeof e.who }));
        if (e.who === 'count') number('Players needed', e.count, 1, (v) => ({ count: clamp(Math.round(v), 1, 32) }));
        toggle('Starts enabled', e.startEnabled, (v) => ({ startEnabled: v }));
        teamFilter(e.team, 'counts in it ("every living player" means all of that team)');
        number('Gravity (× map, 1 = none)', e.gravity ?? 1, 0.05, (v) => {
          const g = Math.round(clamp(v, 0.1, 3) * 100) / 100;
          return { gravity: g === 1 ? undefined : g };
        });
        if (e.gravity !== undefined) el.append(small(`Gravity inside is ${Math.round(e.gravity * 100)}% of the map's: jumps go ${e.gravity < 1 ? 'higher and float down slowly' : 'lower and drop fast'}, and so do jump-pad flights. Always on, whatever logic does to the zone.`));
        break;
      case 'trap': {
        const spec = TRAP_SPECS[e.trap];
        choose('Trap', TRAP_KINDS.map((k) => [k, TRAP_SPECS[k].label] as const), e.trap, (v) => {
          const d = TRAP_SPECS[v as typeof e.trap].defaults;
          return { trap: v as typeof e.trap, activation: d.activation, onSeconds: d.onSeconds, offSeconds: d.offSeconds, damage: null };
        });
        const labels: Record<(typeof TRAP_ACTIVATIONS)[number], string> = { always: 'always on', cycle: 'on a cycle', proximity: 'when stepped on', logic: 'only from logic' };
        if (e.trap !== 'mine') choose('Fires', TRAP_ACTIVATIONS.map((a) => [a, labels[a]] as const), e.activation, (v) => ({ activation: v as typeof e.activation }));
        if (e.activation !== 'always' || e.trap === 'mine') number(e.trap === 'mine' ? 'Rearm (s)' : 'Off (s)', e.offSeconds, 0.5, (v) => ({ offSeconds: clamp(v, 0.2, 600) }));
        if (e.trap !== 'mine' && e.activation !== 'always') number('On (s)', e.onSeconds, 0.5, (v) => ({ onSeconds: clamp(v, 0.2, 60) }));
        if (e.activation === 'cycle' && e.trap !== 'mine') number('Offset (s)', e.offsetSeconds, 0.25, (v) => ({ offsetSeconds: clamp(v, 0, 60) }));
        if (e.trap === 'shock') number('Length (m)', e.length ?? ELECTRIC_FENCE.defaultLength, 2, (v) => ({ length: clamp(v, 2, 96) }));
        if (e.trap === 'crusher') choose('Look', [['press', 'Steel press'], ['rockfall', 'Falling rocks']] as const, e.style ?? 'press', (v) => ({ style: v === 'rockfall' ? 'rockfall' : undefined }));
        number('Damage', e.damage ?? spec.blast?.damage ?? spec.damage, 5, (v) => ({ damage: v === (spec.blast?.damage ?? spec.damage) ? null : clamp(v, 1, 1000) }));
        toggle('Starts enabled', e.startEnabled, (v) => ({ startEnabled: v }));
        break;
      }
      case 'encounter': {
        const factions = mapFactions(doc);
        choose('Faction', factions.map((f) => [f.id, f.name] as const), e.faction, (v) => ({ faction: v }));
        for (const role of NPC_ROLES) number(NPC_ROLE_SPECS[role].label.endsWith('s') ? NPC_ROLE_SPECS[role].label : `${NPC_ROLE_SPECS[role].label}s`, e.roster[role] ?? 0, 1, (v) => ({ roster: { ...e.roster, [role]: clamp(Math.round(v), 0, 16) } }));
        number('Max alive', e.activeCap, 1, (v) => ({ activeCap: clamp(Math.round(v), 1, 32) }));
        number('Reinforcements', e.reinforcements, 1, (v) => ({ reinforcements: clamp(Math.round(v), 0, 500) }));
        number('+ per extra player', e.perPlayer, 1, (v) => ({ perPlayer: clamp(Math.round(v), 0, 16) }));
        number('Reinforce every (s)', e.respawnSeconds, 1, (v) => ({ respawnSeconds: clamp(v, 0.5, 120) }));
        const entranceLabels: Record<EncounterEntrance, string> = { none: 'spread round the point', vent: 'drop from a ceiling vent', hatch: 'climb out of a floor hatch', burrow: 'dig out of a burrow', breach: 'step through a breach in the wall behind' };
        choose('Arrives by', ENCOUNTER_ENTRANCES.map((k) => [k, entranceLabels[k]] as const), e.entrance ?? 'none', (v) => ({ entrance: v as EncounterEntrance }));
        if ((e.entrance ?? 'none') === 'none') number('Spawn radius (m)', e.radius, 0.5, (v) => ({ radius: clamp(v, 1, 16) }));
        if (e.entrance === 'vent') number('Vent height (m)', e.ventHeight ?? 3.5, 0.25, (v) => ({ ventHeight: clamp(v, 2, 12) }));
        if ((e.entrance ?? 'none') !== 'none') number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        const orderLabels: Record<(typeof SQUAD_ORDERS)[number], string> = { hold: 'hold here', attack: 'hunt the enemy', defend: 'defend the target', patrol: 'patrol a route (or to the target and back)', follow: 'follow the players (allies)', roam: 'roam the whole map (wildlife, monsters)' };
        choose('Order', SQUAD_ORDERS.map((o) => [o, orderLabels[o]] as const), e.order, (v) => ({ order: v as typeof e.order }));
        if (e.order === 'patrol') {
          // Routes (and roads) drawn with the Paths tool: the squad walks one, round a loop or there and back.
          const routes = (doc.paths ?? []).map((p, i) => [p, i] as const).filter(([p]) => p.uses.includes('route') || p.uses.includes('road'));
          choose('Route', [['', '— none: to the target and back —'] as const, ...routes.map(([p, i]) => [p.id, pathLabel(p, i)] as const)], e.route ?? '', (v) => ({ route: v || undefined }));
          if (e.route) {
            el.append(
              button('Edit the route on the map', () => {
                this.setTool({ kind: 'path' });
                this.paths.edit(e.route!);
              }),
            );
          } else {
            el.append(
              button('Draw a new route', () => {
                this.paths.preset('route');
                this.setTool({ kind: 'path' });
                this.toast('Click the ground to draw the route (join the ends for a loop), then pick it in this squad\'s Route');
              }),
            );
          }
        }
        if (e.order === 'defend' || (e.order === 'patrol' && !e.route)) {
          choose('Target', [['', '— choose —'] as const, ...doc.entities.filter((o) => o.id !== e.id && o.kind !== 'spawn').map((o) => [o.id, entityLabel(doc, o)] as const)], e.orderTarget ?? '', (v) => ({ orderTarget: v || null }));
        }
        choose('Skill', [['easy', 'easy'], ['normal', 'normal'], ['hard', 'hard']], e.difficulty, (v) => ({ difficulty: v as typeof e.difficulty }));
        toggle('Active at start', e.startActive, (v) => ({ startActive: v }));
        // Per-encounter tuning as percentages of the roles' own numbers (100 = unchanged).
        const pct = (x: number | undefined) => Math.round((x ?? 1) * 100);
        const ratio = (v: number, lo: number, hi: number) => {
          const r = clamp(Math.round(v) / 100, lo, hi);
          return r === 1 ? undefined : r;
        };
        number('Health (%)', pct(e.health), 25, (v) => ({ health: ratio(v, 0.25, 10) }));
        number('Damage (%)', pct(e.damage), 25, (v) => ({ damage: ratio(v, 0, 5) }));
        number('Size (%)', pct(e.size), 10, (v) => ({ size: ratio(v, 0.5, 2.5) }));
        el.append(small(`${rosterSize(e.roster)} in the first wave, then ${e.reinforcements} reinforcements (+${e.perPlayer} per extra player). Factions are edited in the Logic panel (L).`));
        if ((e.entrance ?? 'none') !== 'none') el.append(small(e.entrance === 'vent' ? 'They come one at a time, dropping from the vent: put the point under a ceiling and set the vent height to it (3.5 m under a standard floor).' : e.entrance === 'breach' ? 'They come one at a time through the hole: put the point right against a wall, facing into the room.' : 'They come one at a time, climbing out of it.'));
        break;
      }
      case 'flag': {
        const teams = mapTeams(doc, 2);
        choose('Team', teams.map((t) => [t.id, t.name] as const), e.team, (v) => ({ team: v }));
        number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        el.append(small('Capture the Flag: this team\'s flag stands here. Players bring the enemy flag to it to score, while their own flag is home. One base per team; put it somewhere the team can defend, off its spawn points.'));
        break;
      }
      case 'light': {
        choose('Fixture', [['ceiling', 'Ceiling panel'], ['wall', 'Wall lamp'], ['bulb', 'Hanging bulb'], ['strip', 'Strip light'], ['sign', 'Neon sign'], ['billboard', 'Holo billboard'], ['candle', 'Candelabra (flickers)'], ['chandelier', 'Chandelier (flickers)'], ['none', 'Hidden (light only)']] as const, e.fixture, (v) => ({ fixture: v as LightFixture }));
        if (e.fixture === 'candle' || e.fixture === 'chandelier') el.append(small('Candles flicker by themselves; blinking (here or from logic) makes them gutter and flare.'));
        if (e.fixture === 'sign' || e.fixture === 'billboard') {
          const words = document.createElement('input');
          words.type = 'text';
          words.maxLength = 24;
          words.value = e.text ?? '';
          words.placeholder = e.fixture === 'sign' ? 'OPEN' : 'TILE TRIGGER';
          words.addEventListener('change', () => update('Sign text', { text: words.value.trim() || undefined }));
          el.append(row('Words', words));
          const [sw, sh] = e.size ?? (e.fixture === 'billboard' ? [6, 3.4] : [2.4, 0.8]);
          number('Sign width (m)', sw, 0.2, (v) => ({ size: [clamp(v, 0.4, 24), sh] }));
          number('Sign height (m)', sh, 0.1, (v) => ({ size: [sw, clamp(v, 0.3, 16)] }));
        }
        const color = document.createElement('input');
        color.type = 'color';
        color.value = e.color;
        color.addEventListener('change', () => update('Colour light', { color: color.value.toLowerCase() }));
        el.append(row('Colour', color));
        number('Brightness', e.intensity, 0.1, (v) => ({ intensity: clamp(v, 0.1, 5) }));
        number('Reach (m)', e.range, 1, (v) => ({ range: clamp(v, 1, 30) }));
        number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        toggle('Starts off', !!e.off, (v) => ({ off: v || undefined }));
        number('Blinks per s (0 steady)', e.blink ?? 0, 0.5, (v) => ({ blink: v <= 0 ? undefined : clamp(v, 0.2, 10) }));
        el.append(small('Logic can switch it on and off, change its colour, flash it or make it blink (alarms, trap tells, a cinema dimming).'));
        el.append(small('Lights the area round it out to its reach (lighting only). Ceiling panels and strips go just under a ceiling (within 1.5 m they are drawn fastened to it; a bulb\'s cord and a chandelier\'s chain reach up to it), wall lamps on a wall facing into the room. Hundreds are fine on most GPUs.'));
        break;
      }
      case 'hostage':
        number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        el.append(small('Hostage Rescue: a hostage waits here each round. Rescuers (the first team) press E beside it and lead it to a Rescue Zone; rescuing half of them wins the round.'));
        break;
      case 'rescue':
        number('Radius (m)', e.radius, 0.5, (v) => ({ radius: clamp(v, 2, 12) }));
        el.append(small('Hostage Rescue: hostages led in here are rescued. Usually near the rescuers\' spawn, away from the hostages.'));
        break;
      case 'bombsite':
        choose('Site', ['A', 'B', 'C', 'D', 'E'].map((l) => [l, l] as const), e.label, (v) => ({ label: v }));
        number('Radius (m)', e.radius, 0.5, (v) => ({ radius: clamp(v, 2, 12) }));
        el.append(small('Bomb mode: attackers (the first team) plant the bomb inside a site (E, then hold still 3 s); defenders defuse it (E at the bomb, hold still 5 s). Place two, A and B, away from both spawns.'));
        break;
      case 'hill':
        number('Radius (m)', e.radius, 0.5, (v) => ({ radius: clamp(v, 2, 20) }));
        el.append(small('King of the Hill: the hill moves between hills in the order they were placed, every minute. A team scores a point per second while it alone stands inside.'));
        break;
      case 'zipline': {
        // The far post, in world terms (the map keeps it as an offset from the start post).
        const far = (i: number, v: number) => {
          const end = [...e.end] as [number, number, number];
          end[i] = clamp(v - e.position[i]!, i === 1 ? -200 : -400, i === 1 ? 200 : 400);
          update('Move zipline end', { end });
        };
        el.append(
          row('Far end X', numberInput(e.position[0] + e.end[0], 0.5, (v) => far(0, v))),
          row('Far end height', numberInput(e.position[1] + e.end[1], 0.25, (v) => far(1, v))),
          row('Far end Z', numberInput(e.position[2] + e.end[2], 0.5, (v) => far(2, v))),
        );
        const place = button('Place ends on the map', () => {
          this.routes.edit(e.id);
          this.setTool({ kind: 'route' });
        });
        place.id = 'ed-zip-ends';
        place.title = 'Click the ground (or a platform) to put the far end there; drag either end to move it (Esc when done)';
        el.append(place);
        number('Post height (m)', e.height, 0.1, (v) => ({ height: clamp(v, 2.5, 8) }));
        number('Speed (m/s)', e.speed, 1, (v) => ({ speed: clamp(v, 3, 30) }));
        toggle('Both ways', e.twoWay, (v) => ({ twoWay: v }));
        teamFilter(e.team, 'can ride it');
        number('Droop (%)', Math.round(e.sag * 100), 1, (v) => ({ sag: clamp(v, 0, 10) / 100 }));
        const run = Math.hypot(e.end[0], e.end[2]);
        const len = Math.hypot(e.end[0], e.end[1], e.end[2]);
        const slope = Math.round((Math.atan2(e.end[1], run) * 180) / Math.PI);
        el.append(small(`${len.toFixed(1)} m, ${slope === 0 ? 'level' : slope < 0 ? `${-slope}° downhill` : `${slope}° uphill`}, about ${Math.max(1, Math.round(len / e.speed))} s a ride. Players press E under either post (or the cable) to grab it, ride to the far end${e.twoWay ? ' (or back)' : ''}, and jump or E to let go. Sidearms and blades fire on the way; bots use it as a shortcut.`));
        break;
      }
      case 'ladder':
        number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        number('Height (m)', e.height, 0.5, (v) => ({ height: Math.max(1, Math.min(24, v)) }));
        number('Width (m)', e.width, 0.1, (v) => ({ width: Math.max(0.5, Math.min(3, v)) }));
        choose('Look', LADDER_STYLES.map((st) => [st, LADDER_STYLE_LABELS[st]] as const), e.style ?? 'rungs', (v) => ({ style: v === 'rungs' ? undefined : (v as LadderStyle) }));
        el.append(small('Put its foot against a wall, facing out (R turns it). Players and bots walk into it to climb and jump to let go. 4 m reaches the next level.'));
        break;
      case 'pad':
        number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        number('Launch up (m/s)', e.power, 1, (v) => ({ power: Math.max(2, Math.min(40, v)) }));
        number('Push forward (m/s)', e.push, 1, (v) => ({ push: Math.max(0, Math.min(40, v)) }));
        el.append(small(`About ${((e.power * e.power) / (2 * 20)).toFixed(1)} m high and ${((e.push * 2 * e.power) / 20).toFixed(0)} m along, landing level. The arrows point the way it throws you.`));
        break;
      case 'portal': {
        const partner = doc.entities.find((o) => o.kind === 'portal' && o.pair === e.pair && o.id !== e.id);
        const crowd = doc.entities.filter((o) => o.kind === 'portal' && o.pair === e.pair).length;
        number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        number('Width (m)', e.size[0], 0.2, (v) => ({ size: [clamp(v, 1.2, 8), e.size[1]] }));
        number('Height (m)', e.size[1], 0.2, (v) => ({ size: [e.size[0], clamp(v, 2.2, 8)] }));
        {
          const pair = document.createElement('input');
          pair.type = 'text';
          pair.maxLength = 32;
          pair.value = e.pair;
          pair.addEventListener('change', () => {
            const v = pair.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
            if (v) update('Pair portal', { pair: v });
          });
          el.append(row('Pair', pair));
          const glow = document.createElement('input');
          glow.type = 'color';
          glow.value = e.color ?? '#3aa8ff';
          glow.addEventListener('change', () => update('Colour portal', { color: glow.value.toLowerCase() }));
          el.append(row('Colour', glow));
        }
        toggle('Starts on', e.startEnabled, (v) => ({ startEnabled: v }));
        el.append(small(partner ? `Leads to ${entityLabel(doc, partner)}: walk (or shoot) into its front and you come out of the other, moving the same way relative to it. Turning one portal turns where you face coming out.` : crowd > 2 ? `Pair "${e.pair}" has ${crowd} portals: a pair links exactly two.` : `No other end yet: give a second portal the pair "${e.pair}" (the Portal Pair tool places both).`));
        el.append(small('Logic switches portals on and off (Enable / Disable): a pair works only while both are on. Bots take portals as shortcuts. Leave room to stand in front of both.'));
        break;
      }
      case 'mount': {
        const def = MOUNT_DEFS[e.model];
        choose('Type', MOUNT_MODELS.map((m) => [m, MOUNT_DEFS[m].displayName] as const), e.model, (v) => ({ model: v as MountModel }));
        number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        const teams = mapTeams(doc, MAX_TEAMS);
        if (def.kind === 'sentry') choose('Team', [['', 'Nobody (shoots everyone)'] as const, ...teams.map((t) => [t.id, t.name] as const)], e.faction ?? '', (v) => ({ faction: v || null }));
        else {
          choose('Team', [['', 'Nobody (anyone\'s)'] as const, ...teams.map((t) => [t.id, t.name] as const)], e.faction ?? '', (v) => ({ faction: v || null }));
          choose('Paint', MOUNT_SKINS.map((k) => [k, MOUNT_SKIN_LABELS[k]] as const), e.skin ?? 'auto', (v) => ({ skin: v === 'auto' ? undefined : (v as MountSkin) }));
        }
        if (def.kind === 'vehicle' && !def.vehicle?.fly) {
          toggle('Rides on water', !!e.onWater, (v) => ({ onWater: v ? true : undefined }));
          el.append(small(e.onWater ? `Floats on water and swamp, ${def.vehicle?.draft ?? FLOAT.draft} m deep in it: a bit slower and slidier there, and it drives up the shore. Lava and acid still take it.` : 'Sinks to the bottom in water (tick Rides on water for a boat or jet ski).'));
        }
        number('Respawn (s)', e.respawnSeconds ?? def.respawnSeconds, 5, (v) => ({ respawnSeconds: Math.max(5, Math.min(600, v)) }));
        const seats = def.seats.length ? def.seats.map((s) => `${s.label}${s.weapon ? ` (${CORE_WEAPONS[s.weapon]?.displayName})` : ''}`).join(', ') : 'none: it fires on its own';
        el.append(small(`${def.blurb}. Seats: ${seats}. Health ${def.health}. Players get in and out with E.`));
        break;
      }
      case 'airplane': {
        // What flies it: the transport plane or a dropship (looks and benches; the same route and drop rules).
        choose('Aircraft', AIR_CRAFTS.map((c) => [c, AIR_CRAFT_LABELS[c]] as const), e.craft ?? 'plane', (v) => ({ craft: v as AirCraft }));
        // The route as a point list: [x, z] offsets from the plane's anchor, flown in order.
        number('Altitude (m)', e.altitude, 5, (v) => ({ altitude: clamp(v, 15, 400) }));
        number('Lap time (s)', e.loopSeconds, 5, (v) => ({ loopSeconds: clamp(v, 10, 600) }));
        toggle('Loops round', e.closed, (v) => ({ closed: v }));
        const dropLabels: Record<AirdropMode, string> = { off: 'Off (it just flies over)', start: 'Round start (everyone starts aboard)', always: 'Every spawn' };
        choose('Air drop', AIRDROP_MODES.map((m) => [m, dropLabels[m]] as const), e.airdrop, (v) => ({ airdrop: v as AirdropMode }));
        const h3 = document.createElement('h3');
        h3.textContent = 'Route';
        el.append(h3);
        e.route.forEach(([x, z], i) => {
          const set = (j: 0 | 1, v: number) => {
            const route = e.route.map((p) => [...p] as [number, number]);
            route[i]![j] = clamp(v, -2000, 2000);
            return { route };
          };
          const xIn = numberInput(x, 5, (v) => update('Move route point', set(0, v)));
          const zIn = numberInput(z, 5, (v) => update('Move route point', set(1, v)));
          const del = button('✕', () => update('Remove route point', { route: e.route.filter((_, j) => j !== i) }));
          del.disabled = e.route.length <= 2;
          del.title = 'Remove this point';
          const wrap = document.createElement('span');
          wrap.className = 'route-point';
          wrap.append(xIn, zIn, del);
          el.append(row(`${i + 1}. X, Z`, wrap));
        });
        el.append(button('+ Add point', () => {
          const [lx, lz] = e.route[e.route.length - 1]!;
          const [fx, fz] = e.route[0]!;
          // Half-way back to the start (or 40 m on) so the new point is easy to find.
          const next: [number, number] = e.closed ? [(lx + fx) / 2 + 20, (lz + fz) / 2 + 20] : [lx + 40, lz];
          if (e.route.length < 32) update('Add route point', { route: [...e.route, next] });
        }));
        const length = e.route.reduce((sum, p, i) => (i ? sum + Math.hypot(p[0] - e.route[i - 1]![0], p[1] - e.route[i - 1]![1]) : 0), 0) + (e.closed ? Math.hypot(e.route[0]![0] - e.route[e.route.length - 1]![0], e.route[0]![1] - e.route[e.route.length - 1]![1]) : 0);
        el.append(this.drawRouteButton(e.id));
        el.append(small(`Points are metres from the marker (moving it moves the whole route). ${Math.round(length)} m a lap at ${Math.round(length / e.loopSeconds)} m/s. Draw it in and out of the map's boundary as you like: riders (players and bots) can only jump out while it is over the play area, above ground they can land on (not the void, lava or acid); anyone still aboard when it leaves that stretch is dropped at its last good point. Bots jump where they land nearest their objective.`));
        break;
      }
      case 'mover': {
        const modeLabels: Record<MoverMode, string> = { loop: 'round its points, over and over', pingpong: 'there and back, over and over', trigger: 'only when logic sends it' };
        choose('Moves', MOVER_MODES.map((m) => [m, modeLabels[m]] as const), e.mode, (v) => ({ mode: v as MoverMode }));
        number('Speed (m/s)', e.speed, 0.5, (v) => ({ speed: clamp(v, 0.2, 40) }));
        number('Turn speed (°/s)', e.turnSpeed, 5, (v) => ({ turnSpeed: clamp(v, 5, 360) }));
        number('Wait at points (s)', e.wait, 0.5, (v) => ({ wait: clamp(v, 0, 120) }));
        if (e.mode !== 'trigger') toggle('Runs from the start', e.startActive, (v) => ({ startActive: v }));
        const h3 = document.createElement('h3');
        h3.textContent = 'Points';
        el.append(h3);
        e.points.forEach((p, i) => {
          const set = (j: 0 | 1 | 2, v: number) => {
            const points = e.points.map((q) => [...q] as [number, number, number]);
            points[i]![j] = clamp(v, -500, 500);
            return { points };
          };
          const angle = numberInput(Math.round(((e.angles?.[i] ?? 0) * 180) / Math.PI), 15, (v) => {
            const angles = e.points.map((_, k) => e.angles?.[k] ?? 0);
            angles[i] = (clamp(Math.round(v), -180, 180) * Math.PI) / 180;
            update('Turn mover point', { angles: angles.some((a) => a !== 0) ? angles : undefined });
          });
          angle.title = 'Hinge angle (°): turns the blocks about a level hinge through the marker, square to its facing (drawbridges)';
          const wrap = document.createElement('span');
          wrap.className = 'route-point';
          const del = button('✕', () => update('Remove mover point', { points: e.points.filter((_, j) => j !== i), ...(e.angles ? { angles: e.angles.filter((_, j) => j !== i) } : {}) }));
          del.disabled = e.points.length <= 2;
          wrap.append(numberInput(p[0], 0.5, (v) => update('Move mover point', set(0, v))), numberInput(p[1], 0.5, (v) => update('Move mover point', set(1, v))), numberInput(p[2], 0.5, (v) => update('Move mover point', set(2, v))), angle, del);
          el.append(row(`${i + 1}. X, Y, Z, °`, wrap));
        });
        el.append(button('+ Add point', () => {
          const last = e.points[e.points.length - 1]!;
          if (e.points.length < 16) update('Add mover point', { points: [...e.points, [last[0], last[1] + 2, last[2]]], ...(e.angles ? { angles: [...e.angles, e.angles[e.angles.length - 1] ?? 0] } : {}) });
        }), this.drawRouteButton(e.id));
        const h3b = document.createElement('h3');
        h3b.textContent = 'Carries';
        el.append(h3b);
        // Every block it carries, then free blocks near the marker (not another mover's) to tick.
        const elsewhere = new Set(doc.entities.flatMap((o) => (o.kind === 'mover' && o.id !== e.id ? o.blocks : [])));
        const dist = (o: MapEntity) => Math.hypot(o.position[0] - e.position[0], o.position[2] - e.position[2]);
        const blocks = doc.entities.filter((o): o is Extract<MapEntity, { kind: 'block' }> => o.kind === 'block');
        const near = [
          ...blocks.filter((o) => e.blocks.includes(o.id)),
          ...blocks.filter((o) => !e.blocks.includes(o.id) && !elsewhere.has(o.id) && dist(o) < 24).sort((a, b) => dist(a) - dist(b)).slice(0, 12),
        ];
        for (const b of near) {
          const c = document.createElement('input');
          c.type = 'checkbox';
          c.checked = e.blocks.includes(b.id);
          c.addEventListener('change', () => {
            const blocks = c.checked ? [...e.blocks, b.id] : e.blocks.filter((id) => id !== b.id);
            if (blocks.length) update('Carry blocks', { blocks });
            else c.checked = true;
          });
          el.append(row(entityLabel(doc, b), c));
        }
        // Props riding along (a locomotive, a mine cart): drawn only, so ticking one makes it walk-through.
        const nearProps = doc.entities
          .filter((o): o is Extract<MapEntity, { kind: 'prop' }> => o.kind === 'prop' && ((e.props ?? []).includes(o.id) || Math.hypot(o.position[0] - e.position[0], o.position[2] - e.position[2]) < 24))
          .sort((a, b) => Math.hypot(a.position[0] - e.position[0], a.position[2] - e.position[2]) - Math.hypot(b.position[0] - e.position[0], b.position[2] - e.position[2]))
          .slice(0, 16);
        if (nearProps.length) {
          const h3c = document.createElement('h3');
          h3c.textContent = 'Props riding along';
          el.append(h3c);
          for (const pr of nearProps) {
            const c = document.createElement('input');
            c.type = 'checkbox';
            c.checked = (e.props ?? []).includes(pr.id);
            c.addEventListener('change', () => {
              const list = c.checked ? [...(e.props ?? []), pr.id] : (e.props ?? []).filter((id) => id !== pr.id);
              const after = [{ ...e, props: list.length ? list : undefined } as MapEntity];
              const before: MapEntity[] = [e];
              if (c.checked && pr.solid) {
                before.push(pr);
                after.push({ ...pr, solid: false });
              }
              this.run('Carry props', { kind: 'updateEntities', before, after });
            });
            el.append(row(`${getProp(pr.model)?.displayName ?? pr.model} (${pr.id})`, c));
          }
        }
        el.append(small('Points are metres from where the blocks are placed (point 1 is usually 0, 0, 0). Players standing on a carried block ride it; bots ride lifts that run by themselves. Props riding along are drawn only (their blocks collide); blocks moving faster than 4 m/s run over whoever is in the way. Logic: "Send mover", "Move mover to point", Enable/Disable (start, park), and the "Mover arrives" event.'));
        break;
      }
      case 'spawn': {
        const teams = mapTeams(doc, MAX_TEAMS);
        choose('Team', [['', 'Any (shared)'] as const, ...teams.map((t) => [t.id, t.name] as const)], e.faction ?? '', (v) => ({ faction: v || null }));
        el.append(small(isTeamMode(doc.metadata.supportedModes[0] ?? '') ? 'In team modes a team spawns on its own points; shared points are used when a team has none.' : 'Teams only matter in team modes (Team Deathmatch, Capture the Flag, King of the Hill, Elimination).'));
        // Breakthrough: a spawn group (a sector and a side), or none.
        const orders = sectorOrders(doc);
        const group = document.createElement('select');
        group.id = 'ed-spawn-group';
        group.append(new Option('None', '', false, e.sector === undefined));
        for (const n of orders.length ? orders : [1]) {
          for (const side of ['attack', 'defend'] as const) group.append(new Option(`Sector ${n}: ${side === 'attack' ? 'attackers' : 'defenders'}`, `${n}:${side}`, false, e.sector === n && e.side === side));
        }
        group.addEventListener('change', () => {
          const [n, side] = group.value.split(':');
          update('Set spawn group', group.value ? { sector: Number(n), side: side as 'attack' | 'defend' } : { sector: undefined, side: undefined });
        });
        el.append(row('Breakthrough group', group));
        el.append(small('Breakthrough: each side spawns at its group for the sector in play, and moves up (attackers) or falls back (defenders) as sectors fall. Other modes use it like any spawn point.'));
        break;
      }
      case 'sector': {
        const order = numberInput(e.order, 1, (v) => update('Set sector order', { order: Math.round(clamp(v, 1, BREAKTHROUGH_MAX_SECTORS)) }));
        order.id = 'ed-bt-order';
        el.append(row('Order', order));
        const targets = doc.entities.filter((o) => o.kind === 'objective' && o.sector === e.order && o.objective === 'target').length;
        // Kept whatever its targets are so far (set it before placing them); more than there are warns, and plays as all.
        const need = numberInput(e.need ?? targets, 1, (v) => update('Set targets needed', { need: v < 1 ? undefined : Math.round(clamp(v, 1, 32)) }));
        need.id = 'ed-bt-need';
        el.append(row('Targets to destroy', need));
        const secs = numberInput(e.seconds ?? 0, 30, (v) => update('Set sector time', { seconds: v < 30 ? undefined : Math.round(clamp(v, 30, 1800)) }));
        secs.id = 'ed-bt-seconds';
        el.append(row('Time (s, 0: the match\'s)', secs));
        const own = doc.entities.filter((o) => o.kind === 'objective' && o.sector === e.order).length;
        const groups = (['attack', 'defend'] as const).map((side) => doc.entities.filter((o) => o.kind === 'spawn' && o.sector === e.order && o.side === side).length);
        el.append(small(`Breakthrough: the attackers take the sectors in order (1, 2, 3…). The line runs across the map through this marker, square to its facing (the arrows: the way the attackers push); once the sector before falls, defenders left on the attackers' side of it have 10 s to fall back. It falls when its zones are captured and enough of its targets destroyed (${targets ? `${e.need ?? targets} of ${targets}` : 'none here'}). In it: ${own} objective${own === 1 ? '' : 's'}; ${groups[0]} attackers' and ${groups[1]} defenders' spawn point${groups[1] === 1 ? '' : 's'}.`));
        break;
      }
      case 'objective': {
        const kind = document.createElement('select');
        kind.id = 'ed-bt-kind';
        for (const k of BREAKTHROUGH_OBJECTIVES) kind.append(new Option(BREAKTHROUGH_OBJECTIVE_LABELS[k], k, false, k === e.objective));
        kind.addEventListener('change', () => update('Set objective kind', { objective: kind.value as ObjectiveEntity['objective'] }));
        el.append(row('Kind', kind));
        const orders = sectorOrders(doc);
        const sector = document.createElement('select');
        sector.id = 'ed-bt-sector';
        for (const n of orders.includes(e.sector) ? orders : [...orders, e.sector].sort((a, b) => a - b)) sector.append(new Option(`Sector ${n}`, String(n), false, n === e.sector));
        sector.addEventListener('change', () => update('Set objective sector', { sector: Number(sector.value) }));
        el.append(row('Sector', sector));
        const label = document.createElement('input');
        label.type = 'text';
        label.id = 'ed-bt-label';
        label.maxLength = 3;
        label.value = e.label;
        label.addEventListener('change', () => update('Set objective label', { label: label.value.trim().slice(0, 3) || e.label }));
        el.append(row('Label', label));
        number(e.objective === 'target' ? 'Reach (m)' : 'Radius (m)', e.radius, 0.5, (v) => ({ radius: clamp(v, 1, 20) }));
        if (e.objective !== 'target') number('Capture time (s)', e.seconds ?? (e.objective === 'final' ? 40 : 20), 5, (v) => ({ seconds: Math.round(clamp(v, 5, 300)) }));
        el.append(
          small(
            e.objective === 'target'
              ? 'Breakthrough: attackers plant a charge here (E within reach, then hold still 3 s); it goes off 20 s later unless a defender defuses it (E, hold still 5 s). The sector says how many of its targets must go.'
              : e.objective === 'final'
                ? 'Breakthrough: the last stand. A capture zone in the last sector: capturing it ends the round, the attackers winning.'
                : 'Breakthrough: attackers standing in it alone capture it (more of them quicker); a defender in it holds it (contested), and defenders alone push it back. Once captured it stays so.',
          ),
        );
        break;
      }
    }

    // Rules that mention this entity, and a shortcut to add one.
    if (e.kind !== 'spawn') {
      const rules = doc.logic.rules.filter((r) => r.when.target === e.id || r.if.some((c) => c.target === e.id) || r.do.some((a) => a.target === e.id));
      const h3 = document.createElement('h3');
      h3.textContent = 'Logic';
      el.append(h3);
      for (const r of rules) {
        const b = button(`⚙ ${r.name || r.id}`, () => this.logic.open(r.id));
        b.className = 'rule-link';
        el.append(b);
      }
      if (!rules.length) el.append(small('No rules use this yet.'));
      el.append(button('+ Add rule for this', () => this.logic.addRuleFor(e)));
    }
    el.append(small(`ID ${e.id}`));
  }

  /** Room type, density and re-roll count last used per room storey (by dressing tag). */
  private readonly dressChoices = new Map<string, { type: RoomType; density: DressDensity; roll: number }>();

  /**
   * "Dress room as…": furnish the room for a room type (shared/map/dressing.ts).
   * The props are ordinary prop entities (IDs starting with the room's dressing
   * tag), added in one undoable step; dressing again or re-rolling replaces
   * them, so creators can dress, tweak and re-roll.
   */
  private dressPanel(el: HTMLElement, t: TilePlacement): void {
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
    const dressed = () => this.doc.entities.filter((e) => e.kind === 'prop' && e.id.startsWith(`${tag()}_`));
    const clear = button('Clear', () => {
      const old = dressed();
      if (old.length) this.run('Clear room dressing', { kind: 'removeEntities', entities: old });
    });
    clear.id = 'ed-dress-clear';
    const sync = () => {
      const now = choice();
      type.value = now?.type ?? guessRoomType(dressSpace(this.doc, roomCells(this.doc, t.x, t.y, t.z + level)), this.doc.classicStructure.theme, seededRandom(tag())());
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
  private dressRoomAt(t: TilePlacement, level: number, type: RoomType, density: DressDensity, roll: number): void {
    const tag = dressTag(t.id, level);
    const doc = this.doc;
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
      this.toast(`Nothing fits in this room as a ${ROOM_TYPE_LABELS[type].toLowerCase()}`, true);
      return;
    }
    const added = props.map((p, i) => ({ ...p, id: `${tag}_${i}` }) as MapEntity);
    const commands: EditCommand[] = [...(old.length ? [{ kind: 'removeEntities', entities: old } as EditCommand] : []), { kind: 'addEntities', entities: added }];
    if (this.run(`Dress room: ${ROOM_TYPE_LABELS[type]}`, { kind: 'batch', commands })) this.toast(`Dressed as a ${ROOM_TYPE_LABELS[type].toLowerCase()}: ${added.length} props`);
  }

  /** Dress every room storey with no props in it yet, as a type guessed from its size and the theme. */
  private dressAllRooms(): void {
    let doc = this.doc;
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
      this.toast('No bare rooms to dress');
      return;
    }
    if (this.run('Dress all rooms', { kind: 'addEntities', entities: added })) this.toast(`Dressed ${rooms} room${rooms > 1 ? 's' : ''} (${added.length} props)`);
  }

  /**
   * Floors in a tall piece's own upper storeys (`upperFloors`): one tick per storey that has none, over the whole
   * footprint. A cell holds one piece, so this is how a floor (the ceiling of the storey below) goes in over a piece
   * that stands more than one level tall; a Platform placed on such a cell ticks it for that cell alone.
   */
  private upperFloorsPanel(el: HTMLElement, t: TilePlacement): void {
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
      box.addEventListener('change', () => this.run(`${box.checked ? 'Floor on' : 'No floor on'} ${name}`, setUpperFloorsCommand(this.doc, t, keys, box.checked)));
      el.append(row(`Floor on ${name}`, box));
    }
    el.append(small('A full floor across the piece at that level: the ceiling below and a floor to build on. Things that rise through it (columns, arches) still stand.'));
  }

  /** One surface slot in the tile inspector: material (or theme default) and tint. */
  /** Layout, floor, ceiling and corners of a room (absent = the room as designed). */
  private roomOptionsPanel(el: HTMLElement, t: TilePlacement): void {
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
        this.run(`Room: ${label.toLowerCase()}`, updateTileCommand(this.doc, t, Object.keys(next).length ? { ...rest, options: next } : rest));
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

  private surfaceRow(t: MapDocument['classicStructure']['tiles'][number], slot: SurfaceSlot): HTMLElement {
    const current = t.surfaces?.[slot];
    const mat = document.createElement('select');
    mat.append(new Option(slot === 'roof' ? 'Same as the floor' : `Theme (${resolveSurface({ ...this.doc }, undefined, slot).material.displayName})`, '', false, !current));
    for (const def of coreMaterials.all()) mat.append(new Option(def.displayName, def.id, false, current?.material === def.id));
    const tint = document.createElement('input');
    tint.type = 'color';
    tint.value = current?.tint ?? '#ffffff';
    tint.disabled = !current;
    tint.title = 'Tint';
    const apply = (style: SurfaceStyle | null) => this.run(`Paint ${SURFACE_SLOT_LABELS[slot].toLowerCase()}`, paintCommand(this.doc, t.id, slot, style, this.paintScope));
    mat.addEventListener('change', () => apply(mat.value ? { material: mat.value, tint: current?.tint ?? null } : null));
    tint.addEventListener('change', () => current && apply({ material: current.material, tint: tint.value.toLowerCase() }));
    const wrap = document.createElement('div');
    wrap.className = 'surface-row';
    // The Paint tool's current brush, onto this surface.
    const brush = document.createElement('button');
    brush.type = 'button';
    brush.className = 'ed-use-brush';
    brush.textContent = 'Brush';
    brush.title = `Paint it with the Paint tool's brush (${coreMaterials.get(this.paintStyle.material)?.displayName ?? this.paintStyle.material})`;
    brush.addEventListener('click', () => apply(this.paintStyle));
    wrap.append(text(SURFACE_SLOT_LABELS[slot]), mat, tint, brush);
    return wrap;
  }

  // ---------------------------------------------------------------- validation

  private validate(): void {
    this.issues = [...validateMap(this.doc), ...this.portIssues()];
    this.renderIssues();
    clearTimeout(this.navTimer);
    const token = ++this.navToken;
    // Navigation and overlaps as played: set pieces expanded into their parts, on the ground as shown (paths laid in,
    // kept under the floors).
    const ground = this.view.ground;
    const doc = ground && ground !== this.viewDoc.terrain ? { ...this.viewDoc, terrain: ground } : this.viewDoc;
    if (this.issues.some((i) => i.severity === 'error')) {
      this.navIssues = [];
      this.renderIssues();
      return;
    }
    this.scheduleOverlaps();
    this.navTimer = window.setTimeout(async () => {
      const { initNavigation, validateMapNavigation } = await import('@tiletrigger/shared/match');
      await initNavigation();
      if (token !== this.navToken) return;
      try {
        await initPhysics();
        // The navmesh as the match builds it, and the navigation audit (traps, spawn points, objectives and pickups
        // cut off): warnings for creators (errors only on the official maps' own checks).
        this.navIssues = validateMapNavigation(doc, false).issues;
      } catch (e) {
        this.navIssues = [{ severity: 'warning', code: 'nav.failed', message: `navigation could not be generated: ${(e as Error).message}` }];
      }
      this.renderIssues();
    }, 400);
  }

  /** A set piece's port with a wall in it (MapMaker's warning; the outline shows it red): one per port. */
  private portIssues(): ValidationIssue[] {
    const out: ValidationIssue[] = [];
    for (const p of this.doc.setPieces ?? []) {
      const def = this.pieceDef(p.piece);
      if (!def) continue;
      for (const s of setPiecePortStates(p, def, this.mapBoxes())) {
        if (!s.blockedBy) continue;
        out.push({ severity: 'warning', code: 'setpiece.port', message: `${def.displayName}: ${this.portName(s)} faces a wall (${this.blockerName(s.blockedBy)}): open it, or move the piece`, targetId: p.id });
      }
    }
    return out;
  }

  /** Coplanar overlaps of the map as it is now (its warning and the Overlaps highlight), a moment after the last edit. */
  private scheduleOverlaps(): void {
    clearTimeout(this.zTimer);
    const { map: doc, partOf } = this.expansion;
    this.zTimer = window.setTimeout(() => {
      if (doc !== this.viewDoc) return;
      try {
        // A set piece's parts against each other are the piece's own business (the author can't move a part).
        this.zSpots = coplanarSpots(doc, undefined, partOf);
      } catch {
        this.zSpots = [];
      }
      this.zIssues = coplanarIssues(doc, this.zSpots);
      if (this.overlapsOn) this.view.setOverlaps(this.zSpots);
      this.renderIssues();
    }, 450);
  }

  private allIssues(): ValidationIssue[] {
    const order = { error: 0, warning: 1, suggestion: 2 } as const;
    return [...this.issues, ...this.navIssues, ...this.zIssues].sort((a, b) => order[a.severity] - order[b.severity]);
  }

  private renderIssues(): void {
    const issues = this.allIssues();
    const list = $('ed-issues');
    list.replaceChildren();
    if (!issues.length) {
      const li = document.createElement('li');
      li.className = 'none';
      li.textContent = 'No problems found. Ready to test.';
      list.append(li);
    }
    for (const issue of issues) {
      const li = document.createElement('li');
      li.className = issue.severity;
      li.textContent = issue.message;
      li.title = issue.code;
      li.addEventListener('click', () => this.focusIssue(issue));
      list.append(li);
    }
    const errors = issues.filter((i) => i.severity === 'error').length;
    const warnings = issues.filter((i) => i.severity === 'warning').length;
    const pill = $('ed-status');
    pill.className = `pill ${errors ? 'err' : warnings ? 'warn' : 'ok'}`;
    pill.textContent = errors ? `${errors} error${errors > 1 ? 's' : ''}` : warnings ? `${warnings} warning${warnings > 1 ? 's' : ''}` : '✓ Ready';
  }

  // ---------------------------------------------------------------- persistence / test

  private isDirty(): boolean {
    return this.history.revision !== this.savedRevision;
  }

  private scheduleAutosave(): void {
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = window.setTimeout(() => this.flushDraft(), 400);
  }

  /** Write the draft now: unsaved changes are kept, a clean map has none. */
  private flushDraft(): void {
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = undefined;
    if (this.isDirty()) writeDraft(this.doc);
    else clearDraft(this.doc.metadata.id);
  }

  /** Before switching maps: unsaved changes stay in Open… as a draft. */
  private keepDraft(): void {
    if (!this.isDirty()) return;
    this.flushDraft();
    this.toast(`Unsaved changes to "${this.doc.metadata.name}" kept as a draft in Open…`);
  }

  private save(): boolean {
    const stored = saveToLibrary(this.doc);
    if (!stored) {
      this.toast('Could not save to browser storage — use Export to keep a copy', true);
      return false;
    }
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = undefined;
    clearDraft(stored.metadata.id);
    this.savedRevision = this.history.revision;
    this.updateTopBar();
    this.toast(`Saved "${stored.metadata.name}"`);
    return true;
  }

  /**
   * Quit to the main menu. With unsaved changes it asks first: Save & quit
   * (naming a map that was never saved), Quit without saving, or Cancel.
   */
  private quit(): void {
    if (!this.isDirty()) return this.host.goHome();
    const dialog = $<HTMLDialogElement>('ed-quit-dialog');
    const saved = inLibrary(this.doc.metadata.id);
    const name = $<HTMLInputElement>('ed-quit-name');
    $('ed-quit-msg').textContent = saved ? `"${this.doc.metadata.name}" has changes that are not saved.` : 'This map has never been saved. Name it to keep it in Open….';
    $('ed-quit-name-row').hidden = saved;
    name.value = this.doc.metadata.name;
    $('ed-quit-save').onclick = () => {
      const v = name.value.trim().slice(0, 80) || 'Untitled Map';
      if (!saved && v !== this.doc.metadata.name) this.run('Rename map', { kind: 'setMetadata', before: { name: this.doc.metadata.name }, after: { name: v } });
      if (!this.save()) return;
      dialog.close();
      this.host.goHome();
    };
    $('ed-quit-discard').onclick = () => {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = undefined;
      clearDraft(this.doc.metadata.id);
      dialog.close();
      this.host.goHome();
    };
    $('ed-quit-cancel').onclick = () => dialog.close();
    dialog.showModal();
    if (!saved) name.select();
  }

  private replaceDocument(doc: MapDocument): void {
    this.history.reset(doc);
    this.savedRevision = this.history.revision;
    this.selection = emptySelection();
    this.setLevel(0, true);
    this.view.focus({ x: 0, y: 0, z: 0 });
    this.refresh(true);
  }

  /** New: pick a size of open ground (or the sky, with no terrain) and a ground material. */
  private newMapDialog(): void {
    const dialog = $<HTMLDialogElement>('ed-new-dialog');
    const sizes = $('ed-new-sizes');
    let size = STARTER_TERRAIN;
    const pick = (v: number) => {
      size = v;
      for (const b of sizes.querySelectorAll('button')) b.classList.toggle('on', Number((b as HTMLElement).dataset.size) === v);
      $<HTMLSelectElement>('ed-new-ground').disabled = v === 0;
    };
    sizes.replaceChildren(
      ...NEW_MAP_SIZES.map(([v, label, note]) => {
        const b = document.createElement('button');
        b.dataset.size = String(v);
        b.setAttribute('role', 'radio');
        b.innerHTML = `<b>${label}</b><small>${note}</small>`;
        b.addEventListener('click', () => pick(v));
        b.addEventListener('dblclick', () => $('ed-new-create').click());
        return b;
      }),
    );
    const ground = $<HTMLSelectElement>('ed-new-ground');
    if (!ground.options.length) for (const m of TERRAIN_MATERIALS) ground.append(new Option(TERRAIN_MATERIAL_LABELS[m], m, m === 'grass', m === 'grass'));
    pick(STARTER_TERRAIN);
    $('ed-new-create').onclick = () => {
      dialog.close();
      this.keepDraft();
      this.replaceDocument(starterMap(size || null, ground.value as TerrainMaterial));
    };
    $('ed-new-cancel').onclick = () => dialog.close();
    dialog.showModal();
    (sizes.querySelector('button.on') as HTMLButtonElement | null)?.focus();
  }

  private openDialog(): void {
    const dialog = $<HTMLDialogElement>('ed-open-dialog');
    const list = $('ed-library');
    list.replaceChildren();
    // Each row shows the map's picture and plan (loaded and drawn as it scrolls into view).
    // Templates are built-in maps: each loads (its own chunk) when its row is seen or opened.
    const tpl = (id: string) => ({ load: () => loadBuiltInMap(id, { forEditing: true }), shipped: true });
    const remix = (id: string, name: (m: MapDocument) => string) => () =>
      void loadBuiltInMap(id, { forEditing: true }).then((m) => m && this.replaceDocument({ ...m, metadata: { ...m.metadata, id: newId('map'), name: name(m), parentId: m.metadata.id } }));
    // The owner opens our maps as they are (same ID), to fix them and Publish; everyone else gets a remix to make their own.
    const edit = (id: string) => () =>
      void loadBuiltInMap(id, { forEditing: true }).then((m) => {
        if (!m) return this.toast(`Couldn't open ${id}`, true);
        this.replaceDocument(m);
        this.toast(`Editing the official ${m.metadata.name}: Publish puts your changes live for everyone`);
      });
    const template = (id: string, name: (m: MapDocument) => string) => (this.owner ? edit(id) : remix(id, name));
    const kind = this.owner ? 'Official map' : 'Template';
    const cls = this.owner ? 'official' : '';
    const add = (label: string, sub: string, open: () => void, remove?: () => void, cls = '', preview?: { load: () => MapDocument | null | Promise<MapDocument | null>; shipped: boolean }) => {
      const li = document.createElement('li');
      if (cls) li.className = cls;
      if (preview) li.append(libraryThumb(preview.load, preview.shipped));
      const b = button('', () => {
        dialog.close();
        this.keepDraft();
        open();
      });
      b.innerHTML = `${escapeHtml(label)}<br><small>${escapeHtml(sub)}</small>`;
      li.append(b);
      if (remove) li.append(button('Delete', () => confirm(`Delete "${label}" from this browser?`) && (remove(), this.openDialog())));
      list.append(li);
    };
    // Unsaved drafts first (not the map being edited), then saved maps, then templates.
    for (const draft of listDrafts()) {
      if (draft.map.metadata.id === this.doc.metadata.id) continue;
      const when = new Date(draft.savedAt).toLocaleString();
      add(`Unsaved draft (${draft.map.metadata.name}, ${when})`, inLibrary(draft.map.metadata.id) ? 'Changes not saved to your saved copy' : 'Never saved', () => {
        this.replaceDocument(draft.map);
        // Still unsaved: the dirty dot stays on and Quit asks to save.
        this.savedRevision = -1;
        this.updateTopBar();
        this.toast(`Opened the unsaved draft of "${draft.map.metadata.name}"`);
      }, () => clearDraft(draft.map.metadata.id), 'draft', { load: () => draft.map, shipped: SHIPPED_IDS.has(draft.map.metadata.id) });
    }
    for (const entry of listLibrary()) {
      add(entry.name, `Saved ${new Date(entry.updatedAt).toLocaleString()}`, () => {
        const r = openFromLibrary(entry.id, true);
        if ('map' in r) {
          this.replaceDocument(r.map);
          this.toast(`Opened "${r.map.metadata.name}"`);
        } else this.toast(`Could not open: ${r.issues[0]?.message}`, true);
      }, () => deleteFromLibrary(entry.id), '', { load: () => ((r) => ('map' in r ? r.map : null))(openFromLibrary(entry.id, true)), shipped: SHIPPED_IDS.has(entry.id) });
    }
    add('Sandgate', `${kind} · desert town for Team Deathmatch, with open courtyards`, template('sandgate', () => 'Sandgate Remix'), undefined, cls, tpl('sandgate'));
    add('Citadel', `${kind} · castle keep with a two-storey atrium, roof terraces, props and breakables`, template('citadel', () => 'Citadel Remix'), undefined, cls, tpl('citadel'));
    add('Rockfall Canyon', `${kind} · sculpted terrain canyon with two bases, boulders and a ridge ledge`, template('canyon', () => 'Canyon Remix'), undefined, cls, tpl('canyon'));
    // Every other shipped map (the homage maps and later additions) is a template too (listed from the index: the maps that load).
    const known = new Set(['phase0_arena', 'm3_vault', 'm4_outpost', 'sandgate', 'citadel', 'canyon']);
    for (const { key: id, metadata } of MAP_INDEX) {
      if (known.has(id) || isRetiredMap(id)) continue;
      add(metadata.name, `${kind} · ${metadata.description.split(/(?<=\.)\s/)[0] ?? ''}`, template(id, (m) => `${m.metadata.name} Remix`), undefined, cls, tpl(id));
    }
    // Official maps added by publishing (not built into the site) join the list once the hub answers.
    void publishedMaps().then((p) => {
      for (const e of p.values()) if (e.added && dialog.open) add(e.name, `${kind} · ${e.description.split(/(?<=\.)\s/)[0] ?? ''}`, template(e.id, (m) => `${m.metadata.name} Remix`), undefined, cls, tpl(e.id));
    });
    dialog.showModal();
  }

  test(): void {
    const errors = this.allIssues().filter((i) => i.severity === 'error');
    if (errors.length) {
      this.toast(`Fix ${errors.length} error${errors.length > 1 ? 's' : ''} before testing: ${errors[0]!.message}`, true);
      return;
    }
    const botCount = Number($<HTMLSelectElement>('ed-bots').value);
    const difficulty = $<HTMLSelectElement>('ed-skill').value as TestRequest['difficulty'];
    // Team maps fill every team to its size; otherwise the bots chosen in the top bar.
    const main = this.doc.metadata.supportedModes[0] ?? '';
    const teams = isTeamMode(main) ? (main === 'core.ctf' ? (this.doc.teamSetup?.sizes.slice(0, 2) ?? [4, 4]) : this.doc.teamSetup?.sizes) : undefined;
    const fill = teams ? Math.min(32, teams.reduce((a, b) => a + b, 0)) : botCount + 1;
    // As played: paths laid into the ground, terrain under the floors (what loadMap gives every match).
    const played = loadMap(this.doc);
    this.host.startTest({ map: played.ok ? played.map : this.doc, botFill: fill, difficulty });
  }

  toast(message: string, error = false): void {
    const el = $('ed-toast');
    el.textContent = message;
    el.classList.toggle('err', error);
    el.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('on'), error ? 3500 : 2000);
  }
}

// ---------------------------------------------------------------- tiny DOM helpers

function isTyping(): boolean {
  const el = document.activeElement;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') && (el as HTMLInputElement).type !== 'checkbox';
}

/** Rooms you can dress: enclosed room, hall and building tiles (not open yards, streets or model buildings). */
function dressable(def: { open?: boolean; model?: unknown; category: string } | undefined): boolean {
  return !!def && !def.open && !def.model && (def.category === 'Rooms' || def.category === 'Large' || def.category === 'Buildings');
}

/** Prefix of the IDs of the props a room storey is dressed with (short and stable, from the placement's ID). */
function dressTag(placementId: string, level: number): string {
  let h = 2166136261;
  for (const ch of `${placementId}:${level}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return `dr_${(h >>> 0).toString(36)}`;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function h2(t: string): HTMLElement {
  const e = document.createElement('h2');
  e.textContent = t;
  return e;
}

function text(t: string): HTMLElement {
  const e = document.createElement('span');
  e.textContent = t;
  return e;
}

function small(t: string): HTMLElement {
  const e = document.createElement('small');
  e.style.color = 'var(--muted)';
  e.textContent = t;
  return e;
}

function row(label: string, control: HTMLElement): HTMLElement {
  const r = document.createElement('div');
  r.className = 'row';
  r.append(text(label), control);
  return r;
}

function numberInput(value: number, step: number, onCommit: (v: number) => void): HTMLInputElement {
  const i = document.createElement('input');
  i.type = 'number';
  i.step = String(step);
  i.value = String(value);
  i.addEventListener('change', () => {
    const v = Number(i.value);
    if (Number.isFinite(v)) onCommit(v);
  });
  return i;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Front-view thumbnail of an edge style, drawn from the same wall pieces the map builds. */
function edgeIcon(style: EdgeStyle): string {
  if (style === 'auto') return '<svg viewBox="0 0 56 56"><rect x="4" y="14" width="48" height="30" fill="none" stroke="#8ea2c0" stroke-dasharray="3 3"/><text x="28" y="34" text-anchor="middle" font-size="12" fill="#8ea2c0">AUTO</text></svg>';
  const pieces = style === 'open' ? [] : edgeSegments(style, 4, 4);
  // Tall styles are drawn squeezed so the whole height fits.
  const k = 34 / Math.max(4, ...pieces.map((p) => p[3]));
  const rects = pieces.map(([u0, u1, y0, y1, t]) => `<rect x="${(4 + (u0 + 4) * 6).toFixed(1)}" y="${(48 - y1 * k).toFixed(1)}" width="${((u1 - u0) * 6).toFixed(1)}" height="${((y1 - y0) * k).toFixed(1)}" fill="${t < 0.3 ? '#8ea2c0' : '#d9d6cf'}"/>`);
  return `<svg viewBox="0 0 56 56" aria-hidden="true"><rect x="4" y="48" width="48" height="3" fill="#5b616b"/>${rects.join('')}</svg>`;
}

/** The entities a command adds (an NPC placement may also add a faction first). */
function addedEntities(r: { command: EditCommand } | { error: string }): MapEntity[] {
  if ('error' in r) return [];
  const walk = (c: EditCommand): MapEntity[] => (c.kind === 'addEntities' ? [...c.entities] : c.kind === 'batch' ? c.commands.flatMap(walk) : []);
  return walk(r.command);
}
