import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import {
  EditHistory,
  addSpawnCommand,
  buildMapGeometry,
  checkPlacement,
  coreCatalog,
  deleteCommand,
  duplicateCommand,
  emptySelection,
  loadMap,
  moveCommand,
  moveEntitiesCommand,
  settlePropsCommand,
  settledPropY,
  newId,
  newMapDocument,
  normalizeYaw,
  paintCommand,
  resolveSurface,
  faceSlot,
  rotateCommand,
  setThemeCommand,
  coreMaterials,
  coreThemes,
  CORE_ITEMS,
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
  playableModes,
  isTeamMode,
  MODE_LABELS,
  SCENARIO_PALETTE,
  TRAP_ACTIVATIONS,
  TRAP_KINDS,
  TRAP_SPECS,
  entityLabel,
  newScenarioEntity,
  snapToDoorway,
  snapsToDoorway,
  getItem,
  SURFACE_SLOTS,
  SURFACE_SLOT_LABELS,
  TINT_SWATCHES,
  tileAt,
  updateTileCommand,
  validateMap,
  type EditCommand,
  type MapDocument,
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
  SIDES,
  TILE_CATEGORIES,
  edgeChoiceAt,
  edgeSegments,
  edgeTargetAt,
  setEdgeCommand,
  type EdgeStyle,
  type EdgeTarget,
  CORE_PROPS,
  PROP_CATEGORIES,
  getProp,
  placementCells,
  TERRAIN_BRUSHES,
  BLOCK_BEHAVIOURS,
  LIQUIDS,
  LIQUID_SPECS,
  SCATTER_SETS,
  SCATTER_SET_IDS,
  scatterProps,
  type ScatterSetId,
  BACKDROP_GROUNDS,
  SCENERY_IDS,
  SCENERY_LABELS,
  SKIES,
  SKY_IDS,
  resolveBackdrop,
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
  applyBrush,
  PhysicsWorld,
  initPhysics,
  mapPads,
  navLinks,
  padLandings,
  fitBounds,
  CORE_WEAPONS,
  MOUNT_DEFS,
  MOUNT_MODELS,
  type MountModel,
  MAX_TEAMS,
  TEAM_PRESETS,
  teamLayoutLabel,
  mapTerrainMesh,
  type BoundaryStyle,
  newTerrain,
  paintSlopes,
  terrainHeightAt,
  terrainRaycast,
  type TerrainBrush,
  type TerrainData,
  type TerrainMaterial,
  NPC_PALETTE,
  placeNpcCommand,
  type LightFixture,
} from '@tiletrigger/shared';
import arenaTemplate from '../../../../maps/phase0_arena.json';
import vaultTemplate from '../../../../maps/m3_vault.json';
import outpostTemplate from '../../../../maps/m4_outpost.json';
import sandgateTemplate from '../../../../maps/sandgate.json';
import citadelTemplate from '../../../../maps/citadel.json';
import canyonTemplate from '../../../../maps/canyon.json';

/** Every map file shipped in maps/. */
const SHIPPED_MAPS = import.meta.glob<unknown>('../../../../maps/*.json', { eager: true, import: 'default' });
import { EditorView } from './editorView.ts';
import { deleteFromLibrary, exportMap, importMapFile, listLibrary, openFromLibrary, readAutosave, saveToLibrary, writeAutosave } from './storage.ts';
import { tileIcon } from './tileIcon.ts';
import { raycastBoxes, type BoxHit } from './raycast.ts';
import { materialThumbnail } from '../materials/patterns.ts';
import { itemColor } from '../game/pickupVisuals.ts';
import { LogicPanel } from './logicPanel.ts';
import { ModelThumbnails } from '../frontend/modelThumbs.ts';
import { drawMapPlan } from '../frontend/mapPlan.ts';

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

type Tool = { kind: 'select' } | { kind: 'erase' } | { kind: 'npc'; key: string } | { kind: 'tile'; tile: string } | { kind: 'spawn' } | { kind: 'pickup'; item: string } | { kind: 'scenario'; key: ScenarioPaletteKey } | { kind: 'paint' } | { kind: 'edge'; style: EdgeStyle } | { kind: 'prop'; model: string } | { kind: 'terrain' } | { kind: 'mount'; model: MountModel } | { kind: 'scatter'; set: ScatterSetId };

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
  hill: '<ellipse cx="28" cy="38" rx="22" ry="9" fill="#f2f2f2" fill-opacity=".2" stroke="#f2f2f2" stroke-width="2"/><path d="M14 38V26M42 38V26M28 47V35M28 29V17" stroke="#f2f2f2" stroke-width="2"/><path d="M22 14l6-8 6 8z" fill="#f2c14e"/>',
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
  'block:solid': '<path d="M8 26l20-10 20 10-20 10z" fill="#c9ccd2"/><path d="M8 26v6l20 10v-6z" fill="#8a8f98"/><path d="M48 26v6L28 42v-6z" fill="#6c7076"/><path d="M14 12q4-4 8 0M34 8q4-4 8 0" stroke="#7fd8ff" stroke-width="2" fill="none"/>',
  'block:crumble': '<path d="M8 22l20-10 20 10-20 10z" fill="#c9a36b"/><path d="M8 22v6l20 10v-6z" fill="#8a6a3f"/><path d="M48 22v6L28 38v-6z" fill="#6e5230"/><path d="M18 20l6 4-3 5M34 16l-4 6 5 3" stroke="#ffb03b" stroke-width="2" fill="none"/><rect x="14" y="44" width="5" height="5" fill="#8a6a3f"/><rect x="30" y="47" width="4" height="4" fill="#8a6a3f"/>',
  'block:trapdoor': '<rect x="6" y="20" width="44" height="6" fill="#6c7076"/><path d="M14 26l2 22h6l-2-22z" fill="#9a6b3d"/><rect x="22" y="20" width="20" height="6" fill="#1c1f26"/><path d="M28 32v10m-5-5l5 5 5-5" stroke="#ff5a4f" stroke-width="3" fill="none"/>',
  'block:breakable': '<path d="M8 26l20-10 20 10-20 10z" fill="#b9bec6"/><path d="M8 26v6l20 10v-6z" fill="#7c828a"/><path d="M48 26v6L28 42v-6z" fill="#5e636b"/><path d="M20 22l8 3 6-5M28 25v8" stroke="#2a2d33" stroke-width="2" fill="none"/>',
  'water:water': '<rect x="6" y="24" width="44" height="22" fill="#3f8fb0" fill-opacity=".8"/><path d="M6 24q5-4 11 0t11 0 11 0 11 0" stroke="#bfe6f5" stroke-width="2" fill="none"/>',
  'water:lava': '<rect x="6" y="24" width="44" height="22" fill="#ff5a1a"/><path d="M6 24q5-4 11 0t11 0 11 0 11 0" stroke="#ffd34d" stroke-width="2" fill="none"/><circle cx="20" cy="34" r="3" fill="#ffd34d"/>',
  'water:acid': '<rect x="6" y="24" width="44" height="22" fill="#8aff3a" fill-opacity=".85"/><circle cx="18" cy="32" r="3" fill="#d8ffb0"/><circle cx="34" cy="38" r="2" fill="#d8ffb0"/><path d="M6 24q5-4 11 0t11 0 11 0 11 0" stroke="#d8ffb0" stroke-width="2" fill="none"/>',
  'water:swamp': '<rect x="6" y="24" width="44" height="22" fill="#5a6a32"/><path d="M14 24q2-10 4-14M38 24q-1-9 2-13" stroke="#6fbf4a" stroke-width="2" fill="none"/>',
};

/** Scenario palette entries shown under Entities → Gameplay (game-mode objects) rather than Scenario. */
const GAMEPLAY_OBJECTS: ReadonlySet<string> = new Set(['flag', 'hill', 'bombsite', 'hostage', 'rescue']);

/** Tools that put something new into the map (the toolbar's Place button lights up for them). */
const PLACING: ReadonlySet<Tool['kind']> = new Set(['tile', 'spawn', 'pickup', 'scenario', 'prop', 'mount', 'scatter', 'npc']);

/** Display name of a level: Ground, Level 1, Basement… */
export function levelName(level: number): string {
  if (level === 0) return 'Ground';
  if (level > 0) return `Level ${level}`;
  return level === -1 ? 'Basement' : `Basement ${-level}`;
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
      return e.trap === 'mine' ? 0.7 : 1.5;
    case 'destructible':
      return e.model === 'wall' ? 1.5 : 0.9;
    case 'encounter':
      return Math.max(1.2, Math.min(3, e.radius));
    case 'hill':
    case 'bombsite':
    case 'rescue':
      return Math.max(1.2, Math.min(4, e.radius));
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
 * undoable, autosaved and revalidated.
 */
export class EditorApp {
  readonly view: EditorView;
  readonly history: EditHistory;
  private tool: Tool = { kind: 'select' };
  private rotation: Rotation = 0;
  /** Facing for the next prop placed. */
  private propYaw = 0;
  private readonly thumbs: ModelThumbnails;
  private showPane: (pane: string) => void = () => {};
  /** Palette workspace: build, entities or environment. */
  private paletteWs = 'build';
  private spawnYaw = 0;
  private scenarioYaw = 0;
  readonly logic: LogicPanel;
  private level = 0;
  private showAll = false;
  /** The last placing tool, so the toolbar's Place button can pick it up again. */
  private lastPlace: Tool | null = null;
  /** Style the Walls tool builds with. */
  private edgeStyle: EdgeStyle = 'window';
  /** Top bar Snap: 'normal' keeps each tool's own step (50 cm, props 25 cm). */
  private snapMode: 'fine' | 'normal' | 'coarse' | 'off' = 'normal';
  private snapStep(normal: number): number {
    return { fine: 0.25, normal, coarse: 1, off: 0.01 }[this.snapMode];
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
  private navToken = 0;
  private toastTimer?: number;
  private active = false;
  /** Boxes currently shown (respecting floor isolation), for surface picking. */
  private visibleBoxes: WorldBox[] = [];
  private hoverFace: BoxHit | null = null;
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
  /** Live sculpt: the terrain before the stroke and as it is now (committed as one undo step on release). */
  private stroke: { before: TerrainData; now: TerrainData; target: number; seed: number } | null = null;

  constructor(private readonly host: EditorHost) {
    this.view = new EditorView(host.engine);
    this.thumbs = new ModelThumbnails(host.engine);
    const restored = readAutosave();
    this.history = new EditHistory(restored?.map ?? newMapDocument('Untitled Map'));
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
    if (restored) this.toast(`Restored your last session (${new Date(restored.savedAt).toLocaleString()})`);
  }

  get doc(): MapDocument {
    return this.history.doc;
  }

  show(): void {
    this.active = true;
    $('editor').hidden = false;
    this.refresh(true);
  }

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
    this.view.render();
  }

  /** Bring meshes and panels up to date with the document and view settings. */
  private refresh(force: boolean): void {
    const rev = this.history.revision;
    const docChanged = force || rev !== this.renderedRevision;
    const viewChanged = this.level !== this.renderedLevel || this.showAll !== this.renderedShowAll;
    if (docChanged || viewChanged) {
      this.visibleBoxes = this.view.setMap(this.doc, this.level, this.showAll);
      this.renderedLevel = this.level;
      this.renderedShowAll = this.showAll;
      this.updateSelectionVisuals();
      this.updateCounts();
      this.renderLevels();
    }
    if (docChanged) {
      this.renderedRevision = rev;
      this.selection = {
        tiles: this.selection.tiles.filter((id) => this.doc.classicStructure.tiles.some((t) => t.id === id)),
        entities: this.selection.entities.filter((id) => this.doc.entities.some((e) => e.id === id)),
      };
      this.updateSelectionVisuals();
      this.syncToolbar();
      this.validate();
      this.renderInspector();
      this.updateTopBar();
      this.updateHover();
      this.logic.render();
      this.syncTerrainUi();
      if (!force) this.scheduleAutosave();
    }
  }

  // ---------------------------------------------------------------- editing

  private run(label: string, cmd: EditCommand | { error: string }): boolean {
    if ('error' in cmd) {
      this.toast(`Can't ${label.toLowerCase()}: ${cmd.error}`, true);
      return false;
    }
    try {
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
    if (PLACING.has(tool.kind)) this.lastPlace = tool;
    if (tool.kind === 'edge') this.edgeStyle = tool.style;
    const pane: Partial<Record<Tool['kind'], string>> = { npc: 'npcs', paint: 'paint', edge: 'advanced', tile: 'tiles', prop: 'props', scatter: 'plants', terrain: 'terrain', spawn: 'entities', pickup: 'entities', scenario: 'scenario', mount: 'vehicles' };
    if (tool.kind === 'scenario' && GAMEPLAY_OBJECTS.has(tool.key)) this.showPane('entities');
    else if (pane[tool.kind]) this.showPane(pane[tool.kind]!);
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
    $('ed-tb-place-what').textContent = this.lastPlace ? this.toolName(this.lastPlace) : '';
    const hints: Record<Tool['kind'], [string, string]> = {
      select: ['Select', 'Left-click picks what is outlined in cyan · Shift+click adds · drag moves · Del deletes · R rotates · Ctrl+D duplicates'],
      erase: ['Erase', 'Left-click deletes what is outlined in red: tiles on this level, props, NPCs, items, doors, traps, blocks, water… · Ctrl+Z brings it back'],
      tile: ['Place', 'Left-click places the green piece · R rotates it · right-click erases · PgUp/PgDn changes level'],
      spawn: ['Place', 'Left-click places a player spawn · R turns it 45° · right-click erases'],
      pickup: ['Place', 'Left-click places the pickup · right-click erases'],
      scenario: ['Place', 'Left-click places it (doors, walls and lasers snap to doorways) · R turns it 90° · right-click erases · L opens Logic'],
      npc: ['Place', 'Left-click drops the NPCs here · R turns them · edit soldiers, faction and orders in the inspector · right-click erases'],
      paint: ['Paint', 'Left-click paints a surface · right-click resets it to the theme · Alt-click or I picks a style up'],
      edge: ['Walls', 'Left-click a wall or floor edge to build it this way · right-click resets it · O cycles the style'],
      prop: ['Place', 'Left-click places the prop (25 cm snap, Shift for free) · R turns it 15° · right-click erases'],
      mount: ['Place', 'Left-click places it · R turns it 15° · right-click erases · players get in and out with E'],
      terrain: ['Terrain', 'Hold left to sculpt or paint · [ ] brush size · Shift inverts raise/lower · T cycles brushes'],
      scatter: ['Place', 'Left-click plants a patch · Alt-click clears that kind of plant · [ ] brush size · right-click erases one'],
    };
    const [name, hint] = hints[tool.kind];
    const what = PLACING.has(tool.kind) ? `: ${this.toolName(tool)}` : tool.kind === 'edge' ? `: ${EDGE_STYLE_LABELS[tool.style]}` : '';
    const hintEl = $('ed-toolhint');
    hintEl.className = `tool-${tool.kind === 'erase' ? 'erase' : PLACING.has(tool.kind) ? 'place' : 'other'}`;
    hintEl.innerHTML = `<b>${escapeHtml(name + what)}</b> ${escapeHtml(hint)}`;
    $('ed-hint').textContent = 'Right-drag look · WASD/QE fly · wheel zoom · Esc: Select tool';
    this.updateHover();
  }

  /** What a placing tool puts down, for the toolbar and hints. */
  private toolName(tool: Tool): string {
    switch (tool.kind) {
      case 'tile':
        return coreCatalog.get(tool.tile)?.displayName ?? tool.tile;
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
    this.view.setOutlines(this.doc, this.selection.tiles, offset, bad);
    this.view.setEntities(this.doc, this.level, this.showAll, new Set(this.selection.entities));
    this.view.setGizmo(offset ? null : this.selectionCenter());
  }

  private setLevel(level: number, quiet = false): void {
    const next = Math.max(-16, Math.min(16, level));
    if (next === this.level) {
      if (!quiet && next !== level) this.toast(`${levelName(next)} is as far as levels go`);
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
    const t = this.doc.terrain;
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

  private placeAtHover(): void {
    if (this.tool.kind === 'tile' && this.hoverCell) {
      const [x, y, z] = this.hoverCell;
      const placement = { id: newId('tile'), tile: this.tool.tile, x, y, z, rotation: this.rotation };
      const check = checkPlacement(this.doc, [placement]);
      if (!check.ok) return this.toast(`Can't place: ${check.reason}`, true);
      const name = coreCatalog.get(this.tool.tile)?.displayName ?? this.tool.tile;
      this.run(`Place ${name}`, { kind: 'addTiles', tiles: [placement] });
    } else if (this.tool.kind === 'spawn' && this.hoverPoint) {
      const p: [number, number, number] = [snap(this.hoverPoint.x, this.snapStep(0.5)), this.level * this.doc.classicStructure.levelHeight, snap(this.hoverPoint.z, this.snapStep(0.5))];
      const { command, id } = addSpawnCommand(p, this.spawnYaw);
      if (this.run('Place spawn', command)) this.setSelection({ tiles: [], entities: [id] });
    } else if (this.tool.kind === 'pickup' && this.hoverPoint) {
      const p: [number, number, number] = [snap(this.hoverPoint.x, this.snapStep(0.5)), this.level * this.doc.classicStructure.levelHeight, snap(this.hoverPoint.z, this.snapStep(0.5))];
      const id = newId('pickup');
      const name = getItem(this.tool.item)?.displayName ?? 'pickup';
      if (this.run(`Place ${name}`, { kind: 'addEntities', entities: [{ id, kind: 'pickup', position: p, item: this.tool.item, respawnSeconds: null }] })) this.setSelection({ tiles: [], entities: [id] });
    } else if (this.tool.kind === 'prop' && this.hoverPoint) {
      const p = this.propSpot(this.tool.model)!;
      const id = newId('prop');
      const name = getProp(this.tool.model)?.displayName ?? 'prop';
      if (this.run(`Place ${name}`, { kind: 'addEntities', entities: [{ id, kind: 'prop', position: p, model: this.tool.model, yaw: this.propYaw, scale: 1, solid: true, tint: null }] })) this.setSelection({ tiles: [], entities: [id] });
    } else if (this.tool.kind === 'mount' && this.hoverPoint) {
      const p: [number, number, number] = [snap(this.hoverPoint.x, this.snapStep(0.5)), this.hoverPoint.y, snap(this.hoverPoint.z, this.snapStep(0.5))];
      const id = newId('mount');
      const def = MOUNT_DEFS[this.tool.model];
      if (this.run(`Place ${def.displayName}`, { kind: 'addEntities', entities: [{ id, kind: 'mount', position: p, model: this.tool.model, yaw: this.propYaw, faction: null, respawnSeconds: null }] })) this.setSelection({ tiles: [], entities: [id] });
    } else if (this.tool.kind === 'scenario' && this.hoverPoint) {
      const y = this.level * this.doc.classicStructure.levelHeight;
      let p: [number, number, number] = [snap(this.hoverPoint.x, this.snapStep(0.5)), y, snap(this.hoverPoint.z, this.snapStep(0.5))];
      let yaw = this.scenarioYaw;
      if (snapsToDoorway(this.tool.key)) {
        const d = snapToDoorway(this.hoverPoint.x, this.hoverPoint.z, this.doc.classicStructure.cellSize);
        p = [d.x, y, d.z];
        yaw = d.yaw;
      }
      const entity = newScenarioEntity(this.tool.key, p, yaw, this.doc);
      const label = SCENARIO_PALETTE.find((x) => x.key === (this.tool as { key: string }).key)?.label ?? 'object';
      if (this.run(`Place ${label}`, { kind: 'addEntities', entities: [entity] })) this.setSelection({ tiles: [], entities: [entity.id] });
    } else if (this.tool.kind === 'npc' && this.hoverPoint) {
      const y = this.hoverOnTerrain ? Math.round(this.hoverPoint.y * 100) / 100 : this.level * this.doc.classicStructure.levelHeight;
      const r = placeNpcCommand(this.doc, this.tool.key, [snap(this.hoverPoint.x, this.snapStep(0.5)), y, snap(this.hoverPoint.z, this.snapStep(0.5))], this.scenarioYaw);
      if ('error' in r) return this.toast(r.error, true);
      if (this.run(`Place ${r.label}`, r.command)) this.setSelection({ tiles: [], entities: [r.id] });
    }
  }

  private eraseAtHover(): void {
    const hit = this.pick();
    if (!hit) return this.toast(`Nothing to erase here on ${levelName(this.level)}`, true);
    const sel = hit.kind === 'tile' ? { tiles: [hit.id], entities: [] } : { tiles: [], entities: [hit.id] };
    const name = this.targetName(hit);
    if (this.run(`Erase ${name}`, deleteCommand(this.doc, sel))) this.toast(`Erased ${name} · Ctrl+Z to undo`);
  }

  /** Display name of a pick target. */
  private targetName(hit: { kind: 'tile' | 'entity'; id: string }): string {
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

  private paintAtHover(clear: boolean): void {
    const target = this.paintTarget();
    if (!target) return;
    const scopeLabel: Record<PaintScope, string> = { surface: '', sameType: ' (all of this piece)', level: ' (whole level)', all: ' (whole map)' };
    const label = `${clear ? 'Reset' : 'Paint'} ${SURFACE_SLOT_LABELS[target.slot].toLowerCase()}${scopeLabel[this.paintScope]}`;
    this.run(label, paintCommand(this.doc, target.tile.id, target.slot, clear ? null : this.paintStyle, this.paintScope));
  }

  /** Wall tool: build the hovered cell side in the given style. */
  private edgeAtHover(style: EdgeStyle): void {
    const target = this.hoverEdge;
    if (!target) return;
    const cmd = setEdgeCommand(this.doc, target, style);
    if ('error' in cmd) return this.toast(cmd.error, true);
    this.run(style === 'auto' ? 'Reset wall' : `Wall: ${EDGE_STYLE_LABELS[style]}`, cmd);
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
  private pick(): { kind: 'tile' | 'entity'; id: string } | null {
    const byId = new Map(this.doc.entities.map((e) => [e.id, e]));
    const ok = (e: MapEntity | undefined): e is MapEntity => !!e && this.reachable(e) && this.view.entityShown(e.id);
    const tilesHere = new Set(this.doc.classicStructure.tiles.filter((t) => (placementCells(t) ?? []).some((c) => c[2] === this.level)).map((t) => t.id));
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
    if (best?.kind === 'entity') return best;
    const p = this.hoverPoint;
    if (p) {
      let near: { id: string; d: number } | null = null;
      for (const e of this.doc.entities) {
        if (!ok(e)) continue;
        const d = Math.hypot(e.position[0] - p.x, e.position[2] - p.z);
        if (d < pickRadius(e) && (!near || d < near.d)) near = { id: e.id, d };
      }
      // Flat markers (zones, squads, pads) on the floor under the pointer win over the floor itself.
      if (near && (!best || best.kind === 'tile')) return { kind: 'entity', id: near.id };
    }
    if (best) return best;
    const cell = this.hoverCell;
    const tile = cell && tileAt(this.doc, cell[0], cell[1], this.level);
    return tile ? { kind: 'tile', id: tile.id } : null;
  }

  private rotate(): void {
    if (this.tool.kind === 'tile') {
      this.rotation = ((this.rotation + 1) % 4) as Rotation;
      this.toast(`${this.toolName(this.tool)} turned to ${this.rotation * 90}°`);
      this.updateHover();
    } else if (this.tool.kind === 'spawn') {
      this.spawnYaw = normalizeYaw(this.spawnYaw + Math.PI / 4);
      this.toast(`Facing ${Math.round((this.spawnYaw * 180) / Math.PI)}°`);
    } else if (this.tool.kind === 'npc') {
      this.scenarioYaw = normalizeYaw(this.scenarioYaw + Math.PI / 2);
      this.toast(`Facing ${Math.round((this.scenarioYaw * 180) / Math.PI)}°`);
    } else if (this.tool.kind === 'prop' || this.tool.kind === 'mount') {
      this.propYaw = normalizeYaw(this.propYaw + Math.PI / 12);
      this.toast(`Facing ${Math.round((this.propYaw * 180) / Math.PI)}°`);
    } else if (this.tool.kind === 'scenario') {
      this.scenarioYaw = normalizeYaw(this.scenarioYaw + Math.PI / 2);
      this.toast(`Facing ${Math.round((this.scenarioYaw * 180) / Math.PI)}°`);
    } else if (this.selection.tiles.length || this.selection.entities.length) {
      this.run('Rotate', rotateCommand(this.doc, this.selection));
    } else {
      this.toast('Rotate turns the selection, or the piece you are placing: select something first', true);
    }
  }

  private nudge(dx: number, dy: number, dz: number): void {
    if (!this.selection.tiles.length && !this.selection.entities.length) return;
    if (this.selection.tiles.length || dz !== 0) {
      this.run('Move', moveCommand(this.doc, this.selection, dx, dy, dz));
      if (dz) this.setLevel(this.level + dz);
    } else {
      this.run('Move', moveEntitiesCommand(this.doc, this.selection.entities, dx * 0.5, 0, dy * 0.5));
    }
  }

  private deleteSelection(): void {
    if (!this.selection.tiles.length && !this.selection.entities.length) return this.toast('Nothing selected: click something with Select (V) first, or use Erase (X)', true);
    const n = this.selection.tiles.length + this.selection.entities.length;
    if (this.run(n > 1 ? `Delete ${n} items` : 'Delete', deleteCommand(this.doc, this.selection))) this.setSelection(emptySelection());
  }

  private duplicate(): void {
    const r = duplicateCommand(this.doc, this.selection);
    if ('error' in r) return this.toast(`Can't duplicate: ${r.error}`, true);
    if (this.run('Duplicate', r.command)) this.setSelection(r.selection);
  }

  /** Where a prop of `model` goes under the pointer (snapped; Shift for free placement; bedded into terrain). */
  private propSpot(model: string): [number, number, number] | null {
    if (!this.hoverPoint) return null;
    const free = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const p: [number, number, number] = [free ? Math.round(this.hoverPoint.x * 100) / 100 : snap(this.hoverPoint.x, this.snapStep(0.25)), this.level * this.doc.classicStructure.levelHeight, free ? Math.round(this.hoverPoint.z * 100) / 100 : snap(this.hoverPoint.z, this.snapStep(0.25))];
    if (this.hoverOnTerrain && this.doc.terrain) p[1] = settledPropY(this.doc.terrain, { model, position: p, yaw: this.propYaw, scale: 1 }) ?? p[1];
    return p;
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
    const { logic } = this.doc;
    if (!tile && !entity && [...logic.rules, ...logic.objectives, ...logic.variables, ...logic.timers].some((x) => x.id === issue.targetId)) {
      this.logic.open(issue.targetId);
      return;
    }
    if (tile) {
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
    const t = this.stroke?.now ?? this.doc.terrain;
    this.terrainHover = null;
    this.hoverOnTerrain = false;
    if (t) {
      const ray = this.view.pointerRay(clientX, clientY);
      const hit = ray ? terrainRaycast(t, ray.origin, ray.dir) : null;
      if (hit && this.tool.kind === 'terrain') this.terrainHover = hit;
      // Spawns, pickups and props stand on the ground where it is nearer than the level plane.
      if (hit && ray && this.tool.kind !== 'tile' && this.tool.kind !== 'terrain') {
        const dist = (p: Vec3) => Math.hypot(p.x - ray.origin.x, p.y - ray.origin.y, p.z - ray.origin.z);
        if (!this.hoverPoint || dist(hit) < dist(this.hoverPoint)) {
          this.hoverPoint = hit;
          this.hoverOnTerrain = true;
        }
      }
    }
    this.hoverCell = this.hoverPoint ? [Math.round(this.hoverPoint.x / cellSize), Math.round(this.hoverPoint.z / cellSize), this.level] : null;
    if (this.tool.kind === 'paint' || this.tool.kind === 'edge') {
      const ray = this.view.pointerRay(clientX, clientY);
      this.hoverFace = ray ? raycastBoxes(ray.origin, ray.dir, this.visibleBoxes) : null;
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
    let title = '';
    let tone = '';
    const themeName = coreThemes.get(this.doc.classicStructure.theme)?.displayName ?? this.doc.classicStructure.theme;
    const tileLines = (def: TileDefinition, rotation: number) => {
      const span = (i: 0 | 1 | 2) => Math.max(...def.cells.map((c) => c[i])) - Math.min(...def.cells.map((c) => c[i])) + 1;
      return [`Size: ${span(0)} × ${span(1)} × ${span(2)}`, `Theme: ${themeName}`, `Connectors: ${def.ports.length}`, `Rotation: ${rotation * 90}°`];
    };
    if (at && !this.drag && !this.looking) {
      if (this.tool.kind === 'tile' && this.hoverCell) {
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
          if (hit.kind === 'tile') {
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
    tip.innerHTML = `<b>${escapeHtml(title)}</b>${lines.map((l) => `<span>${escapeHtml(l)}</span>`).join('')}`;
    // Beside the pointer, kept inside the window.
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const viewRight = $('ed-right').offsetParent ? $('ed-right').getBoundingClientRect().left : window.innerWidth;
    tip.style.left = `${at.x + 18 + w > viewRight - 8 ? Math.max(0, at.x - 18 - w) : at.x + 18}px`;
    tip.style.top = `${Math.min(window.innerHeight - h - 44, at.y + 18)}px`;
  }

  private updateHoverTarget(): void {
    if (this.tool.kind === 'select' || this.tool.kind === 'erase') {
      const target = this.drag || this.looking ? null : this.pick();
      this.view.setPickHighlight(this.doc, target, this.tool.kind === 'erase' ? 'erase' : 'pick', this.history.revision);
      $('ed-target').textContent = target ? `${this.tool.kind === 'erase' ? 'Erase' : 'Select'}: ${this.targetName(target)}` : '';
      this.view.setFaceHighlight(null, null);
      this.view.setHoverCell(this.doc, null);
      this.view.setGhost(this.doc, null, null, 0, true);
      return;
    }
    this.view.setPickHighlight(this.doc, null, 'pick', 0);
    if (this.tool.kind === 'scatter') {
      const p = this.hoverPoint;
      this.view.setBrushRing(p ? this.doc.terrain : null, p?.x ?? 0, p?.z ?? 0, this.brushRadius, '#6fdc6a');
      $('ed-target').textContent = p ? `${SCATTER_SETS[this.tool.set].label} · radius ${this.brushRadius} m` : '';
      this.view.setFaceHighlight(null, null);
      this.view.setHoverCell(this.doc, null);
      this.view.setGhost(this.doc, null, null, 0, true);
      return;
    }
    if (this.tool.kind === 'terrain') {
      const h = this.terrainHover;
      const t = this.stroke?.now ?? this.doc.terrain;
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
    this.view.setFaceHighlight(this.hoverFace?.box ?? null, this.hoverFace?.localNormal ?? null);
    if (this.tool.kind === 'paint') {
      const target = this.paintTarget();
      $('ed-target').textContent = target ? `${SURFACE_SLOT_LABELS[target.slot]} · ${coreCatalog.get(target.tile.tile)?.displayName ?? target.tile.tile} · ${resolveSurface(this.doc, target.tile, target.slot).material.displayName}` : '';
    } else $('ed-target').textContent = '';
    const cell = this.hoverCell ? ([this.hoverCell[0], this.hoverCell[1], this.level] as [number, number, number]) : null;
    this.view.setHoverCell(this.doc, this.tool.kind === 'tile' || this.tool.kind === 'spawn' || this.tool.kind === 'pickup' || this.tool.kind === 'scenario' || this.tool.kind === 'npc' ? cell : null);
    // Props show their real model where they'd land, see-through, before you click.
    this.view.setPropGhost(this.tool.kind === 'prop' && !this.looking ? this.tool.model : null, this.tool.kind === 'prop' ? this.propSpot(this.tool.model) : null, this.propYaw);
    if (this.tool.kind === 'tile' && cell) {
      const ok = checkPlacement(this.doc, [{ id: '__ghost', tile: this.tool.tile, x: cell[0], y: cell[1], z: cell[2], rotation: this.rotation }]).ok;
      this.view.setGhost(this.doc, this.tool.tile, cell, this.rotation, ok);
    } else {
      this.view.setGhost(this.doc, null, null, 0, true);
    }
  }

  private updateDrag(): void {
    const d = this.drag;
    if (!d || !this.hoverPoint || !this.hoverCell) return;
    const cellOffset: [number, number] = [this.hoverCell[0] - d.startCell[0], this.hoverCell[1] - d.startCell[1]];
    const freeOffset: [number, number] = [snap(this.hoverPoint.x - d.startPoint.x, this.snapStep(0.5)), snap(this.hoverPoint.z - d.startPoint.z, this.snapStep(0.5))];
    d.cellOffset = cellOffset;
    d.freeOffset = freeOffset;
    if (this.selection.tiles.length) {
      const preview = moveCommand(this.doc, this.selection, cellOffset[0], cellOffset[1], 0);
      this.view.setOutlines(this.doc, this.selection.tiles, [cellOffset[0], cellOffset[1], 0], 'error' in preview);
    }
  }

  private endDrag(): void {
    const d = this.drag;
    this.drag = null;
    if (!d || !d.moved) return;
    if (this.selection.tiles.length) {
      const [dx, dy] = d.cellOffset;
      if (dx || dy) this.run('Move', moveCommand(this.doc, this.selection, dx, dy, 0));
    } else {
      const [dx, dz] = d.freeOffset;
      if (dx || dz) this.run('Move', moveEntitiesCommand(this.doc, this.selection.entities, dx, 0, dz));
    }
    this.updateSelectionVisuals();
  }

  // ---------------------------------------------------------------- input

  private bindInput(): void {
    const canvas = () => this.host.canvas;
    window.addEventListener('pointermove', (e) => {
      if (!this.active) return;
      if (this.looking) {
        const dx = e.movementX;
        const dy = e.movementY;
        // A right-click that wobbles a few pixels is still a click (erase), not a look.
        this.looking.travel += Math.abs(dx) + Math.abs(dy);
        if (this.looking.travel > 6) this.looking.moved = true;
        if (this.looking.button === 2) this.view.look(dx * LOOK_SENSITIVITY, -dy * LOOK_SENSITIVITY);
        else this.view.fly(0, -dx * 0.05, dy * 0.05);
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
      if (this.tool.kind === 'paint') return e.altKey ? this.pickStyleAtHover() : this.paintAtHover(false);
      if (this.tool.kind === 'edge') return this.edgeAtHover(this.tool.style);
      if (this.tool.kind === 'terrain') return this.startStroke(e.shiftKey);
      if (this.tool.kind === 'scatter') return this.scatterAtHover(this.tool.set, e.altKey);
      if (this.tool.kind === 'erase') return this.eraseAtHover();
      if (this.tool.kind !== 'select') return this.placeAtHover();
      const hit = this.pick();
      if (!hit) {
        if (!e.shiftKey) this.setSelection(emptySelection());
        return;
      }
      const key = hit.kind === 'tile' ? 'tiles' : 'entities';
      const already = this.selection[key].includes(hit.id);
      if (e.shiftKey) {
        const next = { ...this.selection, [key]: already ? this.selection[key].filter((id) => id !== hit.id) : [...this.selection[key], hit.id] };
        this.setSelection(next);
        return;
      }
      if (!already) this.setSelection(hit.kind === 'tile' ? { tiles: [hit.id], entities: [] } : { tiles: [], entities: [hit.id] });
      if (this.hoverPoint && this.hoverCell) {
        this.drag = { startCell: [this.hoverCell[0], this.hoverCell[1]], startPoint: { ...this.hoverPoint }, pointerX: e.clientX, pointerY: e.clientY, moved: false, cellOffset: [0, 0], freeOffset: [0, 0] };
      }
    });
    window.addEventListener('pointerup', (e) => {
      if (!this.active) return;
      if (this.looking && (e.button === 2 || e.button === 1)) {
        const wasClick = !this.looking.moved && e.button === 2;
        this.looking = null;
        if (wasClick && this.tool.kind === 'paint') {
          this.updatePointer(e.clientX, e.clientY);
          this.paintAtHover(true);
        } else if (wasClick && this.tool.kind === 'edge') {
          this.updatePointer(e.clientX, e.clientY);
          this.edgeAtHover('auto');
        } else if (wasClick && this.tool.kind !== 'select' && this.tool.kind !== 'terrain' && this.tool.kind !== 'erase') {
          this.updatePointer(e.clientX, e.clientY);
          this.eraseAtHover();
        }
        return;
      }
      if (e.button === 0) {
        this.endStroke();
        this.endDrag();
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
      this.keys.clear();
      this.looking = null;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.code === 'F5') {
        e.preventDefault();
        this.test();
        return;
      }
      if (isTyping()) return;
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
      switch (e.code) {
        case 'KeyR':
          this.rotate();
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
        case 'KeyP':
          this.placeTool();
          break;
        case 'KeyI':
          if (this.tool.kind === 'paint') this.pickStyleAtHover();
          break;
        case 'KeyV':
        case 'Escape':
          if (this.tool.kind === 'select') this.setSelection(emptySelection());
          this.setTool({ kind: 'select' });
          break;
        case 'KeyH':
          this.setShowAll(!this.showAll);
          break;
        case 'Delete':
        case 'Backspace':
          this.deleteSelection();
          break;
        case 'PageUp':
        case 'BracketRight':
          if ((this.tool.kind === 'terrain' || this.tool.kind === 'scatter') && e.code === 'BracketRight') this.setBrushRadius(this.brushRadius + 2);
          else if (e.shiftKey) this.nudge(0, 0, 1);
          else this.setLevel(this.level + 1);
          break;
        case 'PageDown':
        case 'BracketLeft':
          if ((this.tool.kind === 'terrain' || this.tool.kind === 'scatter') && e.code === 'BracketLeft') this.setBrushRadius(this.brushRadius - 2);
          else if (e.shiftKey) this.nudge(0, 0, -1);
          else this.setLevel(this.level - 1);
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
    const sep = document.createElement('span');
    sep.className = 'tb-sep';
    bar.append(sep);
    add('ed-tb-rotate', 'rotate', 'Rotate', 'R', 'Rotate the selection, or the piece you are placing', () => this.rotate());
    add('ed-tb-delete', 'delete', 'Delete', 'Del', 'Delete the selection', () => this.deleteSelection());
    this.syncToolbar();
  }

  /** Selection actions are only live with something selected. */
  private syncToolbar(): void {
    const has = this.selection.tiles.length + this.selection.entities.length > 0;
    $<HTMLButtonElement>('ed-tb-delete').disabled = !has;
  }

  /** NPCs tab: lone soldiers and squads, each a preconfigured encounter. */
  private buildNpcPalette(): void {
    const box = $('ed-npcs');
    for (const entry of NPC_PALETTE) {
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = `npc:${entry.key}`;
      b.dataset.search = `${entry.label} ${entry.search}`.toLowerCase();
      b.title = `${entry.label}: ${entry.blurb}`;
      b.innerHTML = `${npcIcon(entry.key)}${escapeHtml(entry.label)}`;
      b.addEventListener('click', () => this.setTool({ kind: 'npc', key: entry.key }));
      box.append(b);
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
    const first: Record<string, string> = { build: 'tiles', entities: 'npcs', environment: 'paint' };
    this.paletteWs = ws;
    this.showPane(first[ws] ?? 'tiles');
    if (ws === 'environment' && (this.selection.tiles.length || this.selection.entities.length)) this.setSelection(emptySelection());
    if (ws === 'environment') document.getElementById('ed-backdrop-head')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /** Light the top bar's workspace tab: Logic while its panel is open, else the palette's workspace. */
  private syncWorkspaceTabs(): void {
    const on = this.logic?.isOpen ? 'logic' : this.paletteWs;
    for (const b of document.querySelectorAll<HTMLElement>('#ed-modes .tab')) b.classList.toggle('on', b.dataset.ws === on);
  }

  private buildPalette(): void {
    this.buildToolbar();
    this.buildNpcPalette();
    this.buildPaintPalette();

    const tiles = $('ed-tiles');
    for (const category of TILE_CATEGORIES) {
      const head = document.createElement('div');
      head.className = 'tile-cat';
      head.textContent = category;
      tiles.append(head, ...coreCatalog.all().filter((d) => d.category === category).map((d) => this.paletteButton(d)));
    }
    const edges = $('ed-edges');
    for (const style of EDGE_STYLES) {
      const b = document.createElement('button');
      b.className = 'tile-btn edge-btn';
      b.dataset.tool = `edge:${style}`;
      b.dataset.search = `${EDGE_STYLE_LABELS[style]} wall side opening`.toLowerCase();
      b.innerHTML = `${edgeIcon(style)}${escapeHtml(EDGE_STYLE_LABELS[style])}`;
      b.title = style === 'auto' ? 'Back to the automatic wall or doorway' : `Build a side as: ${EDGE_STYLE_LABELS[style]}`;
      b.addEventListener('click', () => this.setTool({ kind: 'edge', style }));
      edges.append(b);
    }
    const spawnBtn = document.createElement('button');
    spawnBtn.className = 'tile-btn';
    spawnBtn.dataset.tool = 'spawn';
    spawnBtn.dataset.search = 'spawn player start';
    spawnBtn.innerHTML = `<svg viewBox="0 0 56 56"><circle cx="28" cy="30" r="12" fill="#4fb3ff"/><rect x="22" y="14" width="12" height="6" rx="2" fill="#1c1f26"/></svg>Player Spawn`;
    spawnBtn.addEventListener('click', () => this.setTool({ kind: 'spawn' }));
    $('ed-entities').append(spawnBtn);
    for (const entry of SCENARIO_PALETTE) {
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = `scenario:${entry.key}`;
      b.dataset.search = `${entry.label} ${entry.search}`.toLowerCase();
      b.innerHTML = `<svg viewBox="0 0 56 56">${SCENARIO_ICONS[entry.key]}</svg>${escapeHtml(entry.label)}`;
      b.addEventListener('click', () => this.setTool({ kind: 'scenario', key: entry.key }));
      // Game-mode objects sit with the spawns and pickups; the rest are scenario pieces.
      $(GAMEPLAY_OBJECTS.has(entry.key) ? 'ed-entities' : 'ed-scenario').append(b);
    }
    for (const item of CORE_ITEMS) {
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = `pickup:${item.id}`;
      b.dataset.search = `${item.displayName} ${item.id} pickup ${item.effect.kind}`.toLowerCase();
      b.innerHTML = `${itemIcon(item.id)}${escapeHtml(item.displayName)}`;
      b.addEventListener('click', () => this.setTool({ kind: 'pickup', item: item.id }));
      $('ed-entities').append(b);
    }

    this.buildScatterPalette();
    this.buildPropPalette();
    this.buildMountPalette();
    this.buildTerrainPalette();

    // Palette (after the reference board): the top bar's workspace picks a row of sub-tabs, a sub-tab one pane;
    // search looks across all of them.
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
      }
      for (const p of document.querySelectorAll<HTMLElement>('#ed-palette .ed-pane')) p.hidden = p.dataset.pane !== pane;
      this.syncWorkspaceTabs();
    };
    this.showPane = showPane;
    tabs.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.tab');
      if (!b?.dataset.pane) return;
      this.paletteWs = b.dataset.ws!;
      showPane(b.dataset.pane);
    });
    $('ed-modes').addEventListener('click', (e) => {
      const ws = (e.target as HTMLElement).closest<HTMLElement>('.tab')?.dataset.ws;
      if (ws) this.setWorkspace(ws);
    });

    $<HTMLInputElement>('ed-search').addEventListener('input', (e) => {
      const q = (e.target as HTMLInputElement).value.trim().toLowerCase();
      // While searching, every group is shown so matches anywhere turn up.
      for (const p of document.querySelectorAll<HTMLElement>('#ed-palette .ed-pane')) p.hidden = q ? false : p.dataset.pane !== ($('ed-pal-tabs').querySelector<HTMLElement>('.tab.on')?.dataset.pane ?? 'tiles');
      for (const b of document.querySelectorAll<HTMLElement>('#ed-palette .tile-btn, #ed-palette .mat-btn')) b.hidden = !!q && !(b.dataset.search ?? '').includes(q);
    });
    this.setTool({ kind: 'select' });
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
      const input = numberInput(sizes[i] ?? 1, 1, (v) => set('Set team size', sizes.map((s, j) => (j === i ? Math.max(1, Math.min(16, Math.round(v))) : s))));
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
    if (own) el.append(button('Use the theme\'s backdrop', () => set('Theme backdrop', null)));
    el.append(small(own ? 'Drawn only: nothing out there blocks players or shots.' : "Following the theme. Change anything to give this map its own."));
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
    this.stroke = { before: t, now: t, target: this.terrainHover.y, seed: (Math.random() * 1e9) | 0 };
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
    this.view.previewTerrain({ ...this.doc, terrain: s.now });
    if (this.terrainBrush !== 'paint' && this.terrainBrush !== 'foliage') {
      const y = terrainHeightAt(s.now, h.x, h.z);
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

  private syncTerrainUi(): void {
    const t = this.doc.terrain;
    $('ed-tr-create').hidden = !!t;
    $('ed-tr-edit').hidden = !t;
    if (t) {
      $<HTMLInputElement>('ed-tr-boundary').checked = t.boundary;
      $('ed-tr-size').textContent = `${((t.cols - 1) * t.spacing).toFixed(0)} × ${((t.rows - 1) * t.spacing).toFixed(0)} m · ${t.spacing} m grid`;
    }
  }

  private buildTerrainPalette(): void {
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
      b.dataset.search = `terrain ${brush} ground sculpt`;
      b.innerHTML = `<svg viewBox="0 0 56 56">${icons[brush]}</svg>${brush[0]!.toUpperCase()}${brush.slice(1)}`;
      b.addEventListener('click', () => this.setTerrainBrush(brush));
      brushes.append(b);
    }
    const grounds = $('ed-tr-materials');
    for (const m of TERRAIN_MATERIALS) {
      const def = coreMaterials.get(TERRAIN_SURFACES[m]);
      const b = document.createElement('button');
      b.className = 'mat-btn';
      b.dataset.ground = m;
      b.dataset.search = `${TERRAIN_MATERIAL_LABELS[m]} ground terrain paint`.toLowerCase();
      b.title = `Paint ${TERRAIN_MATERIAL_LABELS[m]}`;
      b.innerHTML = `${def ? `<img alt="" src="${materialThumbnail(def)}">` : ''}<span>${TERRAIN_MATERIAL_LABELS[m]}</span>`;
      b.addEventListener('click', () => {
        this.terrainMaterial = m;
        this.setTerrainBrush('paint');
      });
      grounds.append(b);
    }
    const levels = $('ed-tr-foliage');
    FOLIAGE_LEVELS.forEach((label, level) => {
      const b = document.createElement('button');
      b.dataset.foliage = String(level);
      b.dataset.search = `plants foliage grass flowers bushes ${label}`.toLowerCase();
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
      // Just under ground-floor tiles, so the two never fight for the same pixels.
      this.setTerrain('Create terrain', { ...newTerrain(size, 2, [0, 0], ground), baseY: -0.15 });
    });
    for (const m of TERRAIN_MATERIALS) $<HTMLSelectElement>('ed-tr-new-ground').append(new Option(TERRAIN_MATERIAL_LABELS[m], m, m === 'grass', m === 'grass'));
    $('ed-tr-remove').addEventListener('click', () => {
      if (confirm('Remove the terrain from this map?')) this.setTerrain('Remove terrain', null);
    });
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

  /** Vehicles and turrets in the Entities tab, with thumbnails from their models. */
  private buildMountPalette(): void {
    const box = $('ed-mounts');
    for (const id of MOUNT_MODELS) {
      const def = MOUNT_DEFS[id];
      const b = document.createElement('button');
      b.className = 'tile-btn prop-btn';
      b.dataset.tool = `mount:${id}`;
      b.dataset.search = `${def.displayName} ${def.kind} vehicle turret mount seats`.toLowerCase();
      b.title = `${def.displayName}: ${def.blurb}\n${def.seats.length} seat${def.seats.length === 1 ? '' : 's'}`;
      const img = document.createElement('img');
      img.alt = '';
      void this.thumbs.get(def.model).then((src) => (img.src = src), () => undefined);
      b.append(img, document.createTextNode(`${def.displayName}${def.seats.length ? ` · ${def.seats.length}` : ''}`));
      b.addEventListener('click', () => this.setTool({ kind: 'mount', model: id }));
      box.append(b);
    }
  }

  /** Props by category; thumbnails render from the real models as they scroll into view. */
  /** Plant a patch of the set round the pointer, or (clear) remove that set's props there. One undo step either way. */
  private scatterAtHover(set: ScatterSetId, clear: boolean): void {
    const p = this.hoverPoint;
    if (!p) return;
    const r = this.brushRadius;
    const label = SCATTER_SETS[set].label;
    if (clear) {
      const models = new Set<string>(SCATTER_SETS[set].models.map(([m]) => m));
      const gone = this.doc.entities.filter((e) => e.kind === 'prop' && models.has(e.model) && Math.hypot(e.position[0] - p.x, e.position[2] - p.z) <= r);
      if (gone.length) this.run(`Clear ${label}`, { kind: 'removeEntities', entities: gone });
      return;
    }
    const plants = scatterProps(this.doc, set, p.x, p.z, r, this.level * this.doc.classicStructure.levelHeight, (Math.random() * 2 ** 31) | 0);
    if (!plants.length) return this.toast('No room here: the patch is already full', true);
    this.run(`Scatter ${label}`, { kind: 'addEntities', entities: plants.map((e) => ({ ...e, id: newId('prop') })) });
  }

  private buildScatterPalette(): void {
    const box = $('ed-scatter');
    const icons: Record<ScatterSetId, string> = {
      forest: '<path d="M14 46 L22 14 L30 46Z M28 46 L36 8 L44 46Z" fill="#3f6b3a"/>',
      woods: '<circle cx="20" cy="22" r="11" fill="#5f9a46"/><circle cx="37" cy="26" r="10" fill="#4f8a3c"/><rect x="18" y="30" width="4" height="16" fill="#7a5232"/><rect x="35" y="32" width="4" height="14" fill="#7a5232"/>',
      autumn: '<circle cx="20" cy="22" r="11" fill="#d98a2f"/><circle cx="37" cy="26" r="10" fill="#c9562c"/><rect x="18" y="30" width="4" height="16" fill="#7a5232"/><rect x="35" y="32" width="4" height="14" fill="#7a5232"/>',
      jungle: '<path d="M28 46 Q27 26 30 14" stroke="#7a5232" stroke-width="3" fill="none"/><path d="M30 14 Q16 10 10 22 M30 14 Q44 8 48 22 M30 14 Q24 2 14 6 M30 14 Q38 2 46 8" stroke="#3f8a3c" stroke-width="4" fill="none"/>',
      bushes: '<circle cx="18" cy="36" r="9" fill="#5f9a46"/><circle cx="32" cy="32" r="12" fill="#4f8a3c"/><circle cx="44" cy="38" r="7" fill="#6aa84f"/>',
      meadow: '<path d="M10 46 Q12 32 14 26 M20 46 Q22 30 26 22 M34 46 Q34 34 38 26 M44 46 Q46 34 48 30" stroke="#6fbf4a" stroke-width="3" fill="none"/><circle cx="14" cy="24" r="4" fill="#ff6a8a"/><circle cx="26" cy="20" r="4" fill="#ffd34d"/><circle cx="38" cy="24" r="4" fill="#b98aff"/>',
      desert: '<path d="M26 46V14a4 4 0 0 1 8 0V46Z M26 30h-6V20a3 3 0 0 1 6 0 M34 26h6V16a3 3 0 0 0-6 0" fill="#5e8f4a"/><rect x="6" y="44" width="44" height="4" fill="#d9b77a"/>',
      rocks: '<path d="M8 46 L14 32 L26 28 L32 36 L30 46Z" fill="#8a8d92"/><path d="M30 46 L36 30 L46 32 L50 46Z" fill="#6c7076"/>',
    };
    for (const id of SCATTER_SET_IDS) {
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = `scatter:${id}`;
      b.dataset.search = `${SCATTER_SETS[id].label} scatter plants trees vegetation brush`.toLowerCase();
      b.innerHTML = `<svg viewBox="0 0 56 56">${icons[id]}</svg>${SCATTER_SETS[id].label}`;
      b.addEventListener('click', () => this.setTool({ kind: 'scatter', set: id }));
      box.append(b);
    }
    $<HTMLInputElement>('ed-sc-radius').addEventListener('input', (e) => this.setBrushRadius(Number((e.target as HTMLInputElement).value)));
  }

  private buildPropPalette(): void {
    const box = $('ed-props');
    const seen = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const img = entry.target as HTMLImageElement;
        seen.unobserve(img);
        void this.thumbs.get(img.dataset.file!).then((src) => (img.src = src), () => undefined);
      }
    });
    for (const category of PROP_CATEGORIES) {
      const head = document.createElement('div');
      head.className = 'tile-cat';
      head.textContent = category;
      box.append(head);
      for (const def of CORE_PROPS.filter((d) => d.category === category)) {
        const b = document.createElement('button');
        b.className = 'tile-btn prop-btn';
        b.dataset.tool = `prop:${def.id}`;
        b.dataset.search = `${def.displayName} ${def.category} prop`.toLowerCase();
        b.title = `${def.displayName}\n${def.size.map((v) => v.toFixed(1)).join(' × ')} m${def.collision ? '' : ' · walk-through'}`;
        const img = document.createElement('img');
        img.alt = '';
        img.dataset.file = def.file;
        b.append(img, document.createTextNode(def.displayName));
        b.addEventListener('click', () => this.setTool({ kind: 'prop', model: def.id }));
        box.append(b);
        seen.observe(img);
      }
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
      b.dataset.search = `${def.displayName} ${def.category} ${def.id}`.toLowerCase();
      b.title = def.displayName;
      b.innerHTML = `<img alt="" src="${materialThumbnail(def)}"><span>${def.displayName}</span>`;
      b.addEventListener('click', () => {
        this.paintStyle = { ...this.paintStyle, material: def.id };
        this.setTool({ kind: 'paint' });
        this.syncPaintUi();
      });
      mats.append(b);
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

  private thumbObserver?: IntersectionObserver;
  private readonly thumbLoaders = new WeakMap<Element, () => Promise<string>>();

  /** Render a palette thumbnail the first time its card scrolls into view. */
  private lazyThumb(slot: HTMLElement, load: () => Promise<string>): void {
    this.thumbObserver ??= new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        this.thumbObserver!.unobserve(entry.target);
        const loader = this.thumbLoaders.get(entry.target);
        void loader?.().then(
          (src) => {
            const img = document.createElement('img');
            img.alt = '';
            img.src = src;
            entry.target.replaceChildren(img);
          },
          () => undefined,
        );
      }
    });
    this.thumbLoaders.set(slot, load);
    this.thumbObserver.observe(slot);
  }

  private paletteButton(def: TileDefinition): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'tile-btn';
    b.dataset.tool = `tile:${def.id}`;
    b.dataset.search = `${def.displayName} ${def.id} ${def.category} ${def.blurb ?? ''}`.toLowerCase();
    // The top-down icon stands in until the 3D thumbnail of the real piece has rendered.
    b.innerHTML = `<span class="thumb">${tileIcon(def)}</span><span class="lbl">${escapeHtml(def.displayName)}</span>`;
    this.lazyThumb(b.querySelector<HTMLElement>('.thumb')!, () => this.thumbs.getTile(def));
    const size = (() => {
      const span = (i: 0 | 1 | 2) => Math.max(...def.cells.map((c) => c[i])) - Math.min(...def.cells.map((c) => c[i])) + 1;
      return `${span(0)} × ${span(1)} × ${span(2)}`;
    })();
    b.title = `${def.displayName}\n${def.blurb ?? ''}\nSize ${size} cells · ${def.ports.length} connectors`.trim();
    b.addEventListener('click', () => this.setTool({ kind: 'tile', tile: def.id }));
    return b;
  }

  private bindUi(): void {
    $('ed-home').addEventListener('click', () => this.host.goHome());
    $('ed-undo').addEventListener('click', () => this.undo());
    $('ed-redo').addEventListener('click', () => this.redo());
    $('ed-save').addEventListener('click', () => this.save());
    $('ed-export').addEventListener('click', () => exportMap(this.doc));
    $('ed-new').addEventListener('click', () => {
      if (this.isDirty() && !confirm('Discard unsaved changes and start a new map?')) return;
      this.replaceDocument(newMapDocument('Untitled Map'));
    });
    $('ed-open').addEventListener('click', () => this.openDialog());
    $('ed-import').addEventListener('click', () => $('ed-import-file').click());
    $<HTMLInputElement>('ed-import-file').addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      (e.target as HTMLInputElement).value = '';
      if (!file) return;
      const r = await importMapFile(file);
      if (!('map' in r)) return this.toast(`Import failed: ${r.issues[0]?.message ?? 'unknown error'}`, true);
      this.replaceDocument(r.map);
      this.toast(`Imported ${r.map.metadata.name}`);
    });
    $('ed-test').addEventListener('click', () => this.test());
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
    });
    $<HTMLSelectElement>('ed-snap').addEventListener('change', (e) => (this.snapMode = (e.target as HTMLSelectElement).value as typeof this.snapMode));
    const theme = $<HTMLSelectElement>('ed-theme');
    for (const t of coreThemes.all()) theme.append(new Option(t.displayName, t.id));
    theme.addEventListener('change', () => this.run('Change theme', setThemeCommand(this.doc, theme.value)));
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
    const boxes = buildMapGeometry(this.doc).length;
    $('ed-counts').textContent = `${tiles} tiles · ${spawns} spawns · ${pickups} pickups · ${scenario} scenario objects · ${npcs} NPC squads · ${rules} rules · ${boxes} collision boxes`;
  }

  private renderInspector(): void {
    const el = $('ed-inspector');
    el.replaceChildren();
    const { tiles, entities } = this.selection;
    const doc = this.doc;
    if (tiles.length + entities.length === 0) {
      el.append(h2('Map properties'));
      // Plan preview and size (reference board: map properties).
      const plan = document.createElement('canvas');
      plan.className = 'ed-map-plan';
      plan.width = 236;
      plan.height = 148;
      drawMapPlan(plan, doc);
      el.append(plan);
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
      const occupied = doc.classicStructure.tiles.flatMap((t) => placementCells(t) ?? []);
      if (occupied.length) {
        const span = (i: 0 | 1 | 2) => Math.max(...occupied.map((c) => c[i])) - Math.min(...occupied.map((c) => c[i])) + 1;
        el.append(row('Size', text(`${span(0)} × ${span(1)} cells · ${span(2)} level${span(2) === 1 ? '' : 's'}`)));
      }
      const rp = doc.metadata.recommendedPlayers;
      const setPlayers = (min: number, max: number) =>
        this.run('Set player count', { kind: 'setMetadata', before: { recommendedPlayers: rp }, after: { recommendedPlayers: { min: Math.max(1, Math.min(32, min)), max: Math.max(1, Math.min(32, max)) } } });
      el.append(row('Min players', numberInput(rp.min, 1, (v) => setPlayers(v, rp.max))), row('Max players', numberInput(rp.max, 1, (v) => setPlayers(rp.min, v))));
      const mode = document.createElement('select');
      const current = doc.metadata.supportedModes[0] ?? 'core.deathmatch';
      for (const [id, label] of [['core.deathmatch', 'Deathmatch'], ['core.tdm', 'Team Deathmatch'], ['core.ctf', 'Capture the Flag'], ['core.koth', 'King of the Hill'], ['core.elim', 'Elimination'], ['core.coop', 'Co-op mission']] as const) mode.append(new Option(label, id, false, id === current));
      mode.addEventListener('change', () => this.run('Change mode', { kind: 'setMetadata', before: { supportedModes: doc.metadata.supportedModes }, after: { supportedModes: [mode.value] } }));
      const teams = mapTeams(doc);
      const help: Record<string, string> = {
        'core.coop': 'Co-op: all players (and bots) team up against the NPC squads. Logic ends the mission with "players win" or "players lose".',
        'core.tdm': `Team Deathmatch: ${teams.map((t) => t.name).join(' against ')}. Give spawns a team in their inspector; teams without spawns of their own use the shared ones.`,
        'core.deathmatch': 'Deathmatch: everyone for themselves. NPC squads fight everyone.',
        'core.ctf': `Capture the Flag: ${teams.slice(0, 2).map((t) => t.name).join(' against ')}. Place a Flag Base (Entities tab) for each team; bring the enemy flag to yours while yours is home. Other modes ignore flag bases.`,
        'core.hostage': 'Hostage Rescue: place Hostages and at least one Rescue Zone; the first team rescues.',
        'core.bomb': 'Bomb: place Bomb Sites (A and B) away from both team spawns; the first team attacks.',
        'core.koth': 'King of the Hill: place one or more Hills (Entities tab). The hill moves to the next one every minute; a team scores while it alone stands on it.',
        'core.elim': 'Elimination: round-based Team Deathmatch. No respawns until the next round; the last team standing wins it.',
      };
      // Maps with flag bases or hills also offer those modes in the Arcade, whatever the main mode is.
      const extra = playableModes(doc).filter((m) => m !== current && m !== 'core.elim');
      if (extra.length) help[mode.value] = `${help[mode.value] ?? ''} Also playable here: ${extra.map((m) => MODE_LABELS[m]).join(', ')}.`;
      el.append(row('Mode', mode), small(help[mode.value] ?? ''));
      if (current === 'core.tdm' || current === 'core.koth' || current === 'core.elim') this.renderTeamSetup(el);
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

      this.renderBackdropPanel(el);
      this.renderBloodPanel(el);
      this.renderPhysicsPanel(el);
      if (doc.terrain && doc.entities.some((e) => e.kind === 'prop')) {
        const settle = button('Settle all props on ground', () => this.settleProps());
        settle.id = 'ed-settle-all';
        el.append(settle, small('Beds every prop standing on the terrain into the slope under it; props on floors and blocks stay put.'));
      }
      this.renderBoundsPanel(el);
      return;
    }
    if (tiles.length === 1 && entities.length === 0) {
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
          sel.addEventListener('change', () => {
            const cmd = setEdgeCommand(this.doc, target, sel.value as EdgeStyle);
            if ('error' in cmd) this.toast(cmd.error, true);
            else this.run(`Wall: ${EDGE_STYLE_LABELS[sel.value as EdgeStyle]}`, cmd);
          });
          el.append(row({ N: 'North', E: 'East', S: 'South', W: 'West' }[side], sel));
        }
      } else el.append(small('Use the Walls & Openings tool (O) to change any side of this piece.'));
      const h3 = document.createElement('h3');
      h3.textContent = 'Surfaces';
      el.append(h3);
      for (const slot of SURFACE_SLOTS) el.append(this.surfaceRow(t, slot));
      el.append(small(`ID ${t.id}`));
    } else if (entities.length === 1 && tiles.length === 0) {
      this.entityInspector(el, doc.entities.find((x) => x.id === entities[0])!);
    } else {
      el.append(h2(`${tiles.length + entities.length} selected`));
      el.append(text(`${tiles.length} tiles, ${entities.length} entities`));
    }
    const buttons = document.createElement('div');
    buttons.className = 'buttons';
    buttons.append(button('Rotate (R)', () => this.run('Rotate', rotateCommand(this.doc, this.selection))), button('Duplicate', () => this.duplicate()), button('Delete', () => this.deleteSelection()), button('Focus (F)', () => this.focusSelection()));
    el.append(buttons);
    if (doc.terrain && entities.some((id) => doc.entities.find((x) => x.id === id)?.kind === 'prop')) {
      const settle = button('Settle on ground', () => this.settleProps(entities));
      settle.id = 'ed-settle';
      settle.title = 'Bed the selected props into the terrain under them (no floating corners on slopes)';
      el.append(settle);
    }
  }

  /** Inspector fields for one entity: position, facing and its kind's settings. */
  private entityInspector(el: HTMLElement, e: MapEntity): void {
    const doc = this.doc;
    const update = (label: string, patch: Partial<MapEntity>) => this.run(label, { kind: 'updateEntities', before: [e], after: [{ ...e, ...patch } as MapEntity] });
    el.append(h2(e.kind === 'spawn' ? 'Player Spawn' : e.kind === 'pickup' ? (getItem(e.item)?.displayName ?? e.item) : entityLabel(doc, e)));
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
    if ('yaw' in e) el.append(row('Facing °', numberInput(Math.round((e.yaw * 180) / Math.PI), e.kind === 'spawn' || e.kind === 'prop' ? 15 : 90, (deg) => update('Turn', { yaw: normalizeYaw((deg * Math.PI) / 180) }))));

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

    switch (e.kind) {
      case 'prop': {
        const model = document.createElement('select');
        for (const category of PROP_CATEGORIES) {
          const group = document.createElement('optgroup');
          group.label = category;
          for (const def of CORE_PROPS.filter((d) => d.category === category)) group.append(new Option(def.displayName, def.id, false, def.id === e.model));
          model.append(group);
        }
        model.addEventListener('change', () => update('Change prop', { model: model.value }));
        el.append(row('Model', model));
        number('Scale', e.scale, 0.25, (v) => ({ scale: Math.max(0.25, Math.min(4, v)) }));
        toggle('Solid', e.solid, (v) => ({ solid: v }));
        const tint = document.createElement('input');
        tint.type = 'color';
        tint.value = e.tint ?? '#ffffff';
        tint.addEventListener('change', () => update('Tint prop', { tint: tint.value.toLowerCase() === '#ffffff' ? null : tint.value.toLowerCase() }));
        el.append(row('Tint', tint));
        if (!getProp(e.model)?.collision) el.append(small('This prop never blocks (decoration).'));
        break;
      }
      case 'pickup': {
        choose('Item', CORE_ITEMS.map((it) => [it.id, it.displayName] as const), e.item, (v) => ({ item: v }));
        const def = getItem(e.item)?.respawnSeconds ?? 0;
        number('Respawn (s)', e.respawnSeconds ?? def, 5, (v) => ({ respawnSeconds: v === def ? null : clamp(v, 1, 600) }));
        el.append(small(e.respawnSeconds === null ? `Item default (${def}s)` : 'Custom respawn time'));
        break;
      }
      case 'door':
        toggle('Opens by itself', e.auto, (v) => ({ auto: v }));
        toggle('Locked', e.locked, (v) => ({ locked: v }));
        toggle('Starts open', e.startOpen, (v) => ({ startOpen: v }));
        el.append(small(e.auto ? 'Slides open when a player comes close (unless locked).' : 'Players press E to open it, or logic opens it.'));
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
        number('Width (X)', e.size[0], 0.5, (v) => ({ size: [clamp(v, 0.2, 64), e.size[1], e.size[2]] }));
        number('Thickness', e.size[1], 0.25, (v) => ({ size: [e.size[0], clamp(v, 0.1, 32), e.size[2]] }));
        number('Depth (Z)', e.size[2], 0.5, (v) => ({ size: [e.size[0], e.size[1], clamp(v, 0.2, 64)] }));
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
        el.append(small(e.behaviour === 'solid' ? 'Part of the level: walk on it anywhere, at any height.' : 'Drawn with a coloured lip so players can learn what it does.'));
        break;
      }
      case 'water':
        number('Width (X)', e.size[0], 1, (v) => ({ size: [clamp(v, 0.5, 512), e.size[1], e.size[2]] }));
        number('Depth (deep)', e.size[1], 0.25, (v) => ({ size: [e.size[0], clamp(v, 0.2, 64), e.size[2]] }));
        number('Length (Z)', e.size[2], 1, (v) => ({ size: [e.size[0], e.size[1], clamp(v, 0.5, 512)] }));
        choose('Liquid', LIQUIDS.map((l) => [l, LIQUID_SPECS[l].label] as const), e.liquid, (v) => ({ liquid: v as typeof e.liquid }));
        el.append(small(e.liquid === 'water' ? 'Deeper than 1 m you swim (hold jump to rise). Stay under 15 s and you start drowning.' : e.liquid === 'swamp' ? 'Slows everyone right down.' : `Hurts ${LIQUID_SPECS[e.liquid].dps} a second while you stand in it.`));
        el.append(small('Its surface is at Height + Depth: sink it into a pit or a dip in the terrain.'));
        break;
      case 'zone':
        number('Width (X)', e.size[0], 0.5, (v) => ({ size: [clamp(v, 0.5, 64), e.size[1], e.size[2]] }));
        number('Height', e.size[1], 0.5, (v) => ({ size: [e.size[0], clamp(v, 0.5, 32), e.size[2]] }));
        number('Depth (Z)', e.size[2], 0.5, (v) => ({ size: [e.size[0], e.size[1], clamp(v, 0.5, 64)] }));
        choose('Fires when', [['any', 'any player enters'], ['count', 'enough players are in'], ['all', 'every living player is in']], e.who, (v) => ({ who: v as typeof e.who }));
        if (e.who === 'count') number('Players needed', e.count, 1, (v) => ({ count: clamp(Math.round(v), 1, 32) }));
        toggle('Starts enabled', e.startEnabled, (v) => ({ startEnabled: v }));
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
        choose('Arrives by', ENCOUNTER_ENTRANCES.map((k) => [k, entranceLabels[k]] as const), e.entrance, (v) => ({ entrance: v as EncounterEntrance }));
        if (e.entrance === 'none') number('Spawn radius (m)', e.radius, 0.5, (v) => ({ radius: clamp(v, 1, 16) }));
        if (e.entrance === 'vent') number('Vent height (m)', e.ventHeight, 0.25, (v) => ({ ventHeight: clamp(v, 2, 12) }));
        if (e.entrance !== 'none') number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        const orderLabels: Record<(typeof SQUAD_ORDERS)[number], string> = { hold: 'hold here', attack: 'hunt the enemy', defend: 'defend the target', patrol: 'patrol to the target and back', follow: 'follow the players (allies)', roam: 'roam the whole map (wildlife, monsters)' };
        choose('Order', SQUAD_ORDERS.map((o) => [o, orderLabels[o]] as const), e.order, (v) => ({ order: v as typeof e.order }));
        if (e.order === 'defend' || e.order === 'patrol') {
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
        if (e.entrance !== 'none') el.append(small(e.entrance === 'vent' ? 'They come one at a time, dropping from the vent: put the point under a ceiling and set the vent height to it (3.5 m under a standard floor).' : e.entrance === 'breach' ? 'They come one at a time through the hole: put the point right against a wall, facing into the room.' : 'They come one at a time, climbing out of it.'));
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
        choose('Fixture', [['ceiling', 'Ceiling panel'], ['wall', 'Wall lamp'], ['bulb', 'Hanging bulb'], ['strip', 'Strip light'], ['none', 'Hidden (light only)']] as const, e.fixture, (v) => ({ fixture: v as LightFixture }));
        const color = document.createElement('input');
        color.type = 'color';
        color.value = e.color;
        color.addEventListener('change', () => update('Colour light', { color: color.value.toLowerCase() }));
        el.append(row('Colour', color));
        number('Brightness', e.intensity, 0.1, (v) => ({ intensity: clamp(v, 0.1, 5) }));
        number('Reach (m)', e.range, 1, (v) => ({ range: clamp(v, 1, 30) }));
        number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        el.append(small('Lights the area round it out to its reach (lighting only). Ceiling panels and strips go just under a ceiling, wall lamps on a wall facing into the room. Hundreds are fine on most GPUs.'));
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
      case 'ladder':
        number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        number('Height (m)', e.height, 0.5, (v) => ({ height: Math.max(1, Math.min(24, v)) }));
        number('Width (m)', e.width, 0.1, (v) => ({ width: Math.max(0.5, Math.min(3, v)) }));
        el.append(small('Put its foot against a wall, facing out (R turns it). Players and bots walk into it to climb and jump to let go. 4 m reaches the next level.'));
        break;
      case 'pad':
        number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        number('Launch up (m/s)', e.power, 1, (v) => ({ power: Math.max(2, Math.min(40, v)) }));
        number('Push forward (m/s)', e.push, 1, (v) => ({ push: Math.max(0, Math.min(40, v)) }));
        el.append(small(`About ${((e.power * e.power) / (2 * 20)).toFixed(1)} m high and ${((e.push * 2 * e.power) / 20).toFixed(0)} m along, landing level. The arrows point the way it throws you.`));
        break;
      case 'mount': {
        const def = MOUNT_DEFS[e.model];
        choose('Type', MOUNT_MODELS.map((m) => [m, MOUNT_DEFS[m].displayName] as const), e.model, (v) => ({ model: v as MountModel }));
        number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        if (def.kind === 'sentry') {
          const teams = mapTeams(doc, MAX_TEAMS);
          choose('Team', [['', 'Nobody (shoots everyone)'] as const, ...teams.map((t) => [t.id, t.name] as const)], e.faction ?? '', (v) => ({ faction: v || null }));
        }
        number('Respawn (s)', e.respawnSeconds ?? def.respawnSeconds, 5, (v) => ({ respawnSeconds: Math.max(5, Math.min(600, v)) }));
        const seats = def.seats.length ? def.seats.map((s) => `${s.label}${s.weapon ? ` (${CORE_WEAPONS[s.weapon]?.displayName})` : ''}`).join(', ') : 'none: it fires on its own';
        el.append(small(`${def.blurb}. Seats: ${seats}. Health ${def.health}. Players get in and out with E.`));
        break;
      }
      case 'spawn': {
        const teams = mapTeams(doc, MAX_TEAMS);
        choose('Team', [['', 'Any (shared)'] as const, ...teams.map((t) => [t.id, t.name] as const)], e.faction ?? '', (v) => ({ faction: v || null }));
        el.append(small(isTeamMode(doc.metadata.supportedModes[0] ?? '') ? 'In team modes a team spawns on its own points; shared points are used when a team has none.' : 'Teams only matter in team modes (Team Deathmatch, Capture the Flag, King of the Hill, Elimination).'));
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

  /** One surface slot in the tile inspector: material (or theme default) and tint. */
  private surfaceRow(t: MapDocument['classicStructure']['tiles'][number], slot: SurfaceSlot): HTMLElement {
    const current = t.surfaces?.[slot];
    const mat = document.createElement('select');
    mat.append(new Option(`Theme (${resolveSurface({ ...this.doc }, undefined, slot).material.displayName})`, '', false, !current));
    for (const def of coreMaterials.all()) mat.append(new Option(def.displayName, def.id, false, current?.material === def.id));
    const tint = document.createElement('input');
    tint.type = 'color';
    tint.value = current?.tint ?? '#ffffff';
    tint.disabled = !current;
    tint.title = 'Tint';
    const apply = (style: SurfaceStyle | null) => this.run(`Paint ${SURFACE_SLOT_LABELS[slot].toLowerCase()}`, paintCommand(this.doc, t.id, slot, style));
    mat.addEventListener('change', () => apply(mat.value ? { material: mat.value, tint: current?.tint ?? null } : null));
    tint.addEventListener('change', () => current && apply({ material: current.material, tint: tint.value.toLowerCase() }));
    const wrap = document.createElement('div');
    wrap.className = 'surface-row';
    wrap.append(text(SURFACE_SLOT_LABELS[slot]), mat, tint);
    return wrap;
  }

  // ---------------------------------------------------------------- validation

  private validate(): void {
    this.issues = validateMap(this.doc);
    this.renderIssues();
    clearTimeout(this.navTimer);
    const token = ++this.navToken;
    const doc = this.doc;
    if (this.issues.some((i) => i.severity === 'error')) {
      this.navIssues = [];
      this.renderIssues();
      return;
    }
    this.navTimer = window.setTimeout(async () => {
      const { NavWorld, initNavigation, validateNavigation } = await import('@tiletrigger/shared/match');
      await initNavigation();
      if (token !== this.navToken) return;
      try {
        const geometry = buildMapGeometry(doc);
        await initPhysics();
        const physics = new PhysicsWorld(geometry, mapTerrainMesh(doc));
        const nav = NavWorld.build(geometry, mapTerrainMesh(doc), navLinks(doc.entities, physics));
        physics.free();
        this.navIssues = validateNavigation(doc, nav);
        nav.destroy();
      } catch (e) {
        this.navIssues = [{ severity: 'warning', code: 'nav.failed', message: `navigation could not be generated: ${(e as Error).message}` }];
      }
      this.renderIssues();
    }, 400);
  }

  private allIssues(): ValidationIssue[] {
    const order = { error: 0, warning: 1, suggestion: 2 } as const;
    return [...this.issues, ...this.navIssues].sort((a, b) => order[a.severity] - order[b.severity]);
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
    this.autosaveTimer = window.setTimeout(() => writeAutosave(this.doc), 400);
  }

  private save(): void {
    const stored = saveToLibrary(this.doc);
    if (!stored) return this.toast('Could not save to browser storage — use Export to keep a copy', true);
    this.savedRevision = this.history.revision;
    this.updateTopBar();
    this.toast(`Saved "${stored.metadata.name}"`);
  }

  private replaceDocument(doc: MapDocument): void {
    this.history.reset(doc);
    this.savedRevision = this.history.revision;
    this.selection = emptySelection();
    this.setLevel(0, true);
    this.view.focus({ x: 0, y: 0, z: 0 });
    this.refresh(true);
    writeAutosave(doc);
  }

  private openDialog(): void {
    const dialog = $<HTMLDialogElement>('ed-open-dialog');
    const list = $('ed-library');
    list.replaceChildren();
    const add = (label: string, sub: string, open: () => void, remove?: () => void) => {
      const li = document.createElement('li');
      const b = button('', () => {
        if (this.isDirty() && !confirm('Discard unsaved changes?')) return;
        dialog.close();
        open();
      });
      b.innerHTML = `${escapeHtml(label)}<br><small>${escapeHtml(sub)}</small>`;
      li.append(b);
      if (remove) li.append(button('Delete', () => confirm(`Delete "${label}" from this browser?`) && (remove(), this.openDialog())));
      list.append(li);
    };
    add('Phase 0 Arena', 'Template', () => {
      const r = loadMap(arenaTemplate);
      if (r.ok) this.replaceDocument({ ...r.map, metadata: { ...r.map.metadata, id: newId('map'), name: 'Arena Remix', parentId: r.map.metadata.id } });
    });
    add('The Vault', 'Template · scenario with doors, traps and logic', () => {
      const r = loadMap(vaultTemplate);
      if (r.ok) this.replaceDocument({ ...r.map, metadata: { ...r.map.metadata, id: newId('map'), name: 'Vault Remix', parentId: r.map.metadata.id } });
    });
    add('Outpost Siege', 'Template · co-op mission with NPC squads and factions', () => {
      const r = loadMap(outpostTemplate);
      if (r.ok) this.replaceDocument({ ...r.map, metadata: { ...r.map.metadata, id: newId('map'), name: 'Outpost Remix', parentId: r.map.metadata.id } });
    });
    add('Sandgate', 'Template · desert town for Team Deathmatch, with open courtyards', () => {
      const r = loadMap(sandgateTemplate);
      if (r.ok) this.replaceDocument({ ...r.map, metadata: { ...r.map.metadata, id: newId('map'), name: 'Sandgate Remix', parentId: r.map.metadata.id } });
    });
    add('Citadel', 'Template · castle keep with a two-storey atrium, roof terraces, props and breakables', () => {
      const r = loadMap(citadelTemplate);
      if (r.ok) this.replaceDocument({ ...r.map, metadata: { ...r.map.metadata, id: newId('map'), name: 'Citadel Remix', parentId: r.map.metadata.id } });
    });
    add('Rockfall Canyon', 'Template · sculpted terrain canyon with two bases, boulders and a ridge ledge', () => {
      const r = loadMap(canyonTemplate);
      if (r.ok) this.replaceDocument({ ...r.map, metadata: { ...r.map.metadata, id: newId('map'), name: 'Canyon Remix', parentId: r.map.metadata.id } });
    });
    // Every other shipped map (the homage maps and later additions) is a template too.
    const known = new Set(['phase0_arena', 'm3_vault', 'm4_outpost', 'sandgate', 'citadel', 'canyon']);
    for (const [path, json] of Object.entries(SHIPPED_MAPS)) {
      if (known.has(path.replace(/^.*\/|\.json$/g, ''))) continue;
      const r = loadMap(json);
      if (!r.ok) continue;
      add(r.map.metadata.name, `Template · ${r.map.metadata.description.split(/(?<=\.)\s/)[0] ?? ''}`, () => {
        this.replaceDocument({ ...r.map, metadata: { ...r.map.metadata, id: newId('map'), name: `${r.map.metadata.name} Remix`, parentId: r.map.metadata.id } });
      });
    }
    for (const entry of listLibrary()) {
      add(entry.name, `Saved ${new Date(entry.updatedAt).toLocaleString()}`, () => {
        const r = openFromLibrary(entry.id);
        if ('map' in r) {
          this.replaceDocument(r.map);
          this.toast(`Opened "${r.map.metadata.name}"`);
        } else this.toast(`Could not open: ${r.issues[0]?.message}`, true);
      }, () => deleteFromLibrary(entry.id));
    }
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
    this.host.startTest({ map: this.doc, botFill: fill, difficulty });
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
