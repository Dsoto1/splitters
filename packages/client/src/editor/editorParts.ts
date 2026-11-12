import {
  edgeSegments,
  getProp,
  placedMountDef,
  newMapDocument,
  newTerrain,
  SET_PIECE_MATERIAL_ROLES,
  type BotHintKind,
  type EdgeStyle,
  type EditCommand,
  type MapDocument,
  type MapEntity,
  type MountModel,
  type ScenarioPaletteKey,
  type SetPieceDefinition,
  type SetPieceRole,
  type TerrainData,
  type TerrainMaterial,
  type Vec3
} from '@tiletrigger/shared';
import { itemColor } from '../game/pickupVisuals.ts';
import { isBuiltInMap } from '../mapIndex.ts';

/** MapMaker's shared pieces: the tool type, palette icons, constants and small helpers (split out of editorApp.ts, MapMaker overhaul Phase 2 item 5). */

/** IDs of the built-in maps (they have automatic pictures): the files in maps/, which load on demand (mapIndex.ts). */
export const SHIPPED_IDS = { has: isBuiltInMap };

/** Small palette icon for a pickup item, coloured by item type. */
export function itemIcon(itemId: string): string {
  const c = itemColor(itemId);
  return `<svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="15" fill="${c}" fill-opacity=".25" stroke="${c}" stroke-width="3"/><circle cx="28" cy="28" r="6" fill="${c}"/></svg>`;
}

/** What the card shot leaves out: editor markers a match doesn't draw (zones, hills, sites, objectives, squads, routes). */
export const CARD_HIDDEN_KINDS = ['zone', 'hill', 'rescue', 'sector', 'objective', 'encounter', 'spawn', 'airplane'] as const;

/** A new map starts on open ground this size (m); New offers the others, and the sky (0: no terrain). */
export const STARTER_TERRAIN = 160;

export const NEW_MAP_SIZES: readonly [number, string, string][] = [
  [96, 'Skirmish', '96 m · a few players'],
  [160, 'Medium', '160 m · most modes'],
  [240, 'Large', '240 m · vehicles'],
  [320, 'Huge', '320 m · big battles'],
  [0, 'Sky map', 'No terrain · floating'],
];

/** The material most of the terrain is (its index in TERRAIN_MATERIALS). */
export function mainGround(t: TerrainData): number {
  const counts = new Map<number, number>();
  for (const m of t.materials) counts.set(m, (counts.get(m) ?? 0) + 1);
  let best = 0;
  let most = -1;
  for (const [m, n] of counts) if (n > most) (best = m), (most = n);
  return best;
}

/** The top bar's compact layouts (editor.css, fit-1..5): the fewest that make its contents fit its width. */
export function fitTopBar(top: HTMLElement): void {
  if (top.offsetParent === null) return;
  const levels = ['fit-1', 'fit-2', 'fit-3', 'fit-4', 'fit-5'];
  top.classList.remove(...levels);
  for (const c of levels) {
    if (top.scrollWidth <= top.clientWidth + 1) break;
    top.classList.add(c);
  }
}

/** A blank map: the starter room and spawn, on open ground of `size` metres (just under the floors) or none. */
export function starterMap(size: number | null, ground: TerrainMaterial): MapDocument {
  const doc = newMapDocument('Untitled Map');
  return size ? { ...doc, terrain: { ...newTerrain(size, 2, [0, 0], ground), baseY: -0.15 } } : doc;
}

export type Tool = { kind: 'select' } | { kind: 'erase' } | { kind: 'npc'; key: string } | { kind: 'tile'; tile: string } | { kind: 'setpiece'; piece: string } | { kind: 'spawn' } | { kind: 'pickup'; item: string } | { kind: 'scenario'; key: ScenarioPaletteKey } | { kind: 'paint' } | { kind: 'edge'; style: EdgeStyle } | { kind: 'prop'; model: string } | { kind: 'terrain' } | { kind: 'mount'; model: MountModel } | { kind: 'path' } | { kind: 'route' } | { kind: 'measure' } | { kind: 'note' } | { kind: 'bothint'; hint: BotHintKind } | { kind: 'envbrush' };

/** What the pointer can pick: a tile, an entity, or a set piece (any of its parts picks the whole placement). */
export type Hit = { kind: 'tile' | 'entity' | 'setpiece'; id: string };

/** The kinds of entity a set piece is made of (setPieceFromSelection takes these). */
export const PIECE_PART_KINDS: ReadonlySet<string> = new Set(['block', 'prop', 'door', 'ladder', 'light']);

/** A set piece's role, in the inspector's overrides. */
export const ROLE_LABELS: Record<SetPieceRole, string> = { stone: 'Stone', trim: 'Trim', floor: 'Floor', paving: 'Paving', roof: 'Roof', wood: 'Wood', metal: 'Metal', facade: 'Facade', door: 'Doors', glass: 'Glass' };

/** The roles a piece's parts take from its look (the inspector offers an override for each). */
export function rolesUsed(def: SetPieceDefinition): SetPieceRole[] {
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
export const SCENARIO_ICONS: Record<ScenarioPaletteKey, string> = {
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
export const PLACING: ReadonlySet<Tool['kind']> = new Set(['tile', 'setpiece', 'spawn', 'pickup', 'scenario', 'prop', 'mount', 'npc']);

/** A tool's palette key, as its card's `data-tool` (`tile:core.room`, `prop:prop.barrel`, `spawn`…). */
export function toolKey(tool: Tool): string {
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
    case 'npc':
      return `npc:${tool.key}`;
    case 'bothint':
      return `bothint:${tool.hint}`;
    default:
      return tool.kind;
  }
}

/** Toolbar icons (24×24, drawn in the button's text colour). */
export const TOOL_ICONS: Record<string, string> = {
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
export function npcIcon(key: string): string {
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
export function pickRadius(e: MapEntity): number {
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
      const half = placedMountDef(e.model).half;
      return Math.max(0.8, Math.min(half[0], half[2]) + 0.2);
    }
    case 'block':
    case 'water':
      return Math.max(0.8, Math.min(e.size[0], e.size[2]) / 2);
    default:
      return 0.9;
  }
}

export interface DragState {
  startCell: [number, number];
  startPoint: Vec3;
  pointerX: number;
  pointerY: number;
  moved: boolean;
  /** Tiles move by whole cells; entity-only selections move freely (0.5 m snap). */
  cellOffset: [number, number];
  freeOffset: [number, number];
}

export const FLY_SPEED = 18;

export const LOOK_SENSITIVITY = 0.004;

export const snap = (v: number, step: number) => Math.round(v / step) * step;

/** Rooms you can dress: enclosed room, hall and building tiles (not open yards, streets or model buildings). */
export function dressable(def: { open?: boolean; model?: unknown; category: string } | undefined): boolean {
  return !!def && !def.open && !def.model && (def.category === 'Rooms' || def.category === 'Large' || def.category === 'Buildings');
}

/** Prefix of the IDs of the props a room storey is dressed with (short and stable, from the placement's ID). */
export function dressTag(placementId: string, level: number): string {
  let h = 2166136261;
  for (const ch of `${placementId}:${level}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return `dr_${(h >>> 0).toString(36)}`;
}

/** Front-view thumbnail of an edge style, drawn from the same wall pieces the map builds. */
export function edgeIcon(style: EdgeStyle): string {
  if (style === 'auto') return '<svg viewBox="0 0 56 56"><rect x="4" y="14" width="48" height="30" fill="none" stroke="#8ea2c0" stroke-dasharray="3 3"/><text x="28" y="34" text-anchor="middle" font-size="12" fill="#8ea2c0">AUTO</text></svg>';
  const pieces = style === 'open' ? [] : edgeSegments(style, 4, 4);
  // Tall styles are drawn squeezed so the whole height fits.
  const k = 34 / Math.max(4, ...pieces.map((p) => p[3]));
  const rects = pieces.map(([u0, u1, y0, y1, t]) => `<rect x="${(4 + (u0 + 4) * 6).toFixed(1)}" y="${(48 - y1 * k).toFixed(1)}" width="${((u1 - u0) * 6).toFixed(1)}" height="${((y1 - y0) * k).toFixed(1)}" fill="${t < 0.3 ? '#8ea2c0' : '#d9d6cf'}"/>`);
  return `<svg viewBox="0 0 56 56" aria-hidden="true"><rect x="4" y="48" width="48" height="3" fill="#5b616b"/>${rects.join('')}</svg>`;
}

/** The entities a command adds (an NPC placement may also add a faction first). */
export function addedEntities(r: { command: EditCommand } | { error: string }): MapEntity[] {
  if ('error' in r) return [];
  const walk = (c: EditCommand): MapEntity[] => (c.kind === 'addEntities' ? [...c.entities] : c.kind === 'batch' ? c.commands.flatMap(walk) : []);
  return walk(r.command);
}
