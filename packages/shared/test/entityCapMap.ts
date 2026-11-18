import { MAP_FORMAT_VERSION, type MapDocument, type MapEntity } from '../src/index.ts';

/**
 * A made-up map with `count` entities, for the entity cap (8,192 since map format v48): its unit test and the perf
 * measurement of a near-cap map against a 4,096 one (docs/MAP_BUDGETS.md, "Entity cap"). Not a shipped map, and never
 * written to maps/: it is built here, the same for any count, so two counts compare on the same ground.
 *
 * The mix is St. John's (the map nearest the old cap): about two thirds blocks, a quarter props, the rest lights,
 * doors, pickups and spawns. A 160 m square of courtyard tiles; every entity on the ground in a grid that fills it, so a
 * bigger count is a denser map, not a bigger one (the playable footprint stays in its budget).
 */
const MODELS = ['prop.hm_dresser', 'prop.hm_bunk_bed', 'prop.hm_chair_wood', 'prop.flag', 'prop.gravestone_round', 'prop.dg_table_long', 'prop.barrel', 'prop.metal_crate'];
const MATERIALS = ['core.cobble', 'core.stone_trim', 'core.pbr_flagstone', 'core.oak_planks'];
export const CAP_MAP_SIDE = 20;
const CELL = 8;

export function entityCapMap(count: number, id = `entity_cap_${count}`): MapDocument {
  const half = (CAP_MAP_SIDE * CELL) / 2;
  const tiles = Array.from({ length: CAP_MAP_SIDE * CAP_MAP_SIDE }, (_, i) => ({ id: `tile_${i}`, tile: 'core.yard', x: (i % CAP_MAP_SIDE) - CAP_MAP_SIDE / 2, y: Math.floor(i / CAP_MAP_SIDE) - CAP_MAP_SIDE / 2, z: 0, rotation: 0 as const }));
  const spawns = 16;
  const lights = Math.min(200, Math.round(count * 0.02));
  const doors = 32;
  const pickups = 32;
  const rest = count - spawns - lights - doors - pickups;
  const props = Math.round(rest * 0.27);
  const blocks = rest - props;
  // One grid point a thing, spread over the square (a little in from its edge).
  const side = Math.ceil(Math.sqrt(count));
  const step = (2 * half - 8) / side;
  const at = (i: number, y = 0): [number, number, number] => {
    const r4 = (v: number) => Math.round(v * 1000) / 1000;
    return [r4(-half + 4 - CELL / 2 + (i % side) * step + step / 2), y, r4(-half + 4 - CELL / 2 + Math.floor(i / side) * step + step / 2)];
  };
  const entities: MapEntity[] = [];
  let n = 0;
  for (let i = 0; i < spawns; i++) entities.push({ id: `spawn_${i}`, kind: 'spawn', position: at(n++), yaw: 0, faction: null } as MapEntity);
  for (let i = 0; i < blocks; i++) {
    const tall = i % 7 === 0;
    entities.push({ id: `block_${i}`, kind: 'block', position: at(n++), size: [0.6, tall ? 2.4 : 0.9, 0.6], yaw: (i % 4) * 0.39270, material: MATERIALS[i % MATERIALS.length], tint: null, behaviour: 'solid' } as MapEntity);
  }
  for (let i = 0; i < props; i++) entities.push({ id: `prop_${i}`, kind: 'prop', position: at(n++), model: MODELS[i % MODELS.length], yaw: (i % 8) * 0.7854, scale: 1, solid: true, tint: null } as MapEntity);
  for (let i = 0; i < lights; i++) entities.push({ id: `light_${i}`, kind: 'light', position: at(n++, 3), yaw: 0, color: '#ffe9c4', intensity: 0.8, range: 8, fixture: 'none' } as MapEntity);
  for (let i = 0; i < pickups; i++) entities.push({ id: `pickup_${i}`, kind: 'pickup', position: at(n++), item: 'core.ammo', respawnSeconds: null } as MapEntity);
  // The doors last: their indices are the map's highest, so the snapshot's entity states name them.
  for (let i = 0; i < doors; i++) entities.push({ id: `door_${i}`, kind: 'door', position: at(n++), yaw: 0, startOpen: false, locked: false, auto: true } as MapEntity);
  return {
    format: 'tiletrigger.map',
    formatVersion: MAP_FORMAT_VERSION,
    metadata: {
      id,
      name: `Entity cap ${count}`,
      author: '',
      description: `A made-up map with ${count} entities (packages/shared/test/entityCapMap.ts).`,
      createdAt: '2026-11-18T00:00:00.000Z',
      updatedAt: '2026-11-18T00:00:00.000Z',
      parentId: null,
      recommendedPlayers: { min: 2, max: 16 },
      supportedModes: ['core.deathmatch', 'core.tdm'],
    },
    classicStructure: { cellSize: CELL, levelHeight: 4, theme: 'core.prototype', tiles },
    entities,
    factions: [],
    logic: { variables: [], timers: [], objectives: [], rules: [] },
    terrain: null,
    bounds: null,
    teamSetup: null,
    backdrop: null,
    blood: null,
    physics: null,
    dependencies: [],
  };
}
