/**
 * Classic Grid tile catalog (graybox "core" pack).
 *
 * Tiles are data: occupied cells, connection ports, and extra solids, all in
 * the tile's local frame before rotation. Walls and floors are derived by the
 * geometry builder, which keeps tile definitions small and lets unconnected
 * ports auto-cap into solid walls.
 */

/** Sides in clockwise order; rotating a tile by k quarter turns maps side i to (i + k) % 4. */
export const SIDES = ['N', 'E', 'S', 'W'] as const;
export type Side = (typeof SIDES)[number];

/** Grid direction for each side. Grid +Y is world +Z (north), grid +X is world +X (east). */
export const SIDE_DIRS: Record<Side, readonly [number, number]> = {
  N: [0, 1],
  E: [1, 0],
  S: [0, -1],
  W: [-1, 0],
};

export interface TilePort {
  side: Side;
  /** Which of the tile's occupied levels (local dz) this port sits on. */
  level: number;
}

/** Axis-aligned box in tile-local metres: X/Z relative to the cell centre, Y relative to the tile's base floor. */
export interface LocalBox {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}

export interface TileDefinition {
  id: string;
  displayName: string;
  /** Occupied cells relative to the placement, local frame: [dx, dy, dz]. */
  cells: readonly (readonly [number, number, number])[];
  /** Local dz levels that get a floor slab. */
  floors: readonly number[];
  ports: readonly TilePort[];
  solids?: readonly LocalBox[];
}

/** Shared tile dimensions (metres). Tiles assume the default 8 m cell / 4 m level. */
export const TILE_DIMENSIONS = {
  wallThickness: 0.5,
  floorThickness: 0.5,
  doorWidth: 3,
  doorHeight: 3,
} as const;

function stairSteps(): LocalBox[] {
  // 16 steps of 0.25 m rise and 0.5 m run climb one 4 m level across one 8 m cell,
  // rising from the local west (low) side to the local east (high) side.
  const steps: LocalBox[] = [];
  const inner = 4 - TILE_DIMENSIONS.wallThickness;
  for (let i = 0; i < 16; i++) {
    steps.push({ min: [-4 + i * 0.5, 0, -inner], max: [-4 + (i + 1) * 0.5, (i + 1) * 0.25, inner] });
  }
  return steps;
}

const ALL_SIDES: TilePort[] = SIDES.map((side) => ({ side, level: 0 }));

export const CORE_TILES: readonly TileDefinition[] = [
  { id: 'core.room', displayName: 'Room', cells: [[0, 0, 0]], floors: [0], ports: ALL_SIDES },
  {
    id: 'core.room_pillar',
    displayName: 'Room (Pillar)',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL_SIDES,
    solids: [{ min: [-1, 0, -1], max: [1, 4, 1] }],
  },
  {
    id: 'core.corridor',
    displayName: 'Corridor',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: [
      { side: 'N', level: 0 },
      { side: 'S', level: 0 },
    ],
    // Low cover block off-centre so corridors are not pure sightlines.
    solids: [{ min: [-3.5, 0, -0.75], max: [-1.5, 1.1, 0.75] }],
  },
  {
    id: 'core.corner',
    displayName: 'Corner',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: [
      { side: 'N', level: 0 },
      { side: 'E', level: 0 },
    ],
  },
  {
    id: 'core.junction_t',
    displayName: 'T-Junction',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: [
      { side: 'N', level: 0 },
      { side: 'E', level: 0 },
      { side: 'W', level: 0 },
    ],
  },
  {
    id: 'core.dead_end',
    displayName: 'Dead End',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: [{ side: 'N', level: 0 }],
    solids: [{ min: [-1.5, 0, -3.5], max: [1.5, 1.1, -2.5] }],
  },
  {
    id: 'core.junction_x',
    displayName: 'Crossroads',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL_SIDES,
    // Corner pillars narrow the sightlines through the crossing.
    solids: [
      { min: [-3.5, 0, -3.5], max: [-2.5, 4, -2.5] },
      { min: [2.5, 0, -3.5], max: [3.5, 4, -2.5] },
      { min: [-3.5, 0, 2.5], max: [-2.5, 4, 3.5] },
      { min: [2.5, 0, 2.5], max: [3.5, 4, 3.5] },
    ],
  },
  {
    id: 'core.room_columns',
    displayName: 'Room (Columns)',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL_SIDES,
    solids: [
      { min: [-2.4, 0, -2.4], max: [-1.6, 4, -1.6] },
      { min: [1.6, 0, -2.4], max: [2.4, 4, -1.6] },
      { min: [-2.4, 0, 1.6], max: [-1.6, 4, 2.4] },
      { min: [1.6, 0, 1.6], max: [2.4, 4, 2.4] },
    ],
  },
  {
    id: 'core.room_cover',
    displayName: 'Room (Low Cover)',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL_SIDES,
    solids: [
      { min: [-2.5, 0, -0.5], max: [-0.5, 1.1, 0.5] },
      { min: [0.5, 0, 1.5], max: [1.5, 1.1, 3] },
      { min: [1, 0, -2.5], max: [2.5, 1.1, -1.5] },
    ],
  },
  {
    id: 'core.room_dais',
    displayName: 'Room (Dais)',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL_SIDES,
    // Raised 0.75 m platform with three 0.25 m steps on its south side.
    solids: [
      { min: [-2, 0, -1], max: [2, 0.75, 2] },
      { min: [-1, 0, -1.5], max: [1, 0.5, -1] },
      { min: [-1, 0, -2], max: [1, 0.25, -1.5] },
    ],
  },
  {
    id: 'core.stairs',
    displayName: 'Stairs',
    cells: [
      [0, 0, 0],
      [0, 0, 1],
    ],
    floors: [0],
    ports: [
      { side: 'W', level: 0 },
      { side: 'E', level: 1 },
    ],
    solids: stairSteps(),
  },
];

export class TileCatalog {
  private readonly byId = new Map<string, TileDefinition>();

  constructor(tiles: readonly TileDefinition[] = CORE_TILES) {
    for (const t of tiles) {
      if (this.byId.has(t.id)) throw new Error(`duplicate tile id ${t.id}`);
      this.byId.set(t.id, t);
    }
  }

  get(id: string): TileDefinition | undefined {
    return this.byId.get(id);
  }

  all(): TileDefinition[] {
    return [...this.byId.values()];
  }
}

export const coreCatalog = new TileCatalog();
