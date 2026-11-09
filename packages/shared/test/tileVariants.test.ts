import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  buildMapGeometry,
  coreCatalog,
  invertCommand,
  isTileOptionTwin,
  newMapDocument,
  newTerrain,
  setTileOptionCommand,
  terrainHeightAt,
  tileOptionsOf,
  vertexY,
  withGroundAsPlayed,
  type MapDocument,
  type Rotation,
  type TerrainData,
} from '../src/index.ts';

/** The vaulted tunnels and their Side Walls twins (content/tiles/core.json `optionOf`). */
const TUNNELS = ['core.tunnel_vault', 'core.tunnel_vault_bend', 'core.tunnel_vault_t', 'core.tunnel_vault_cross'];

/**
 * One tunnel tile on level -1 under ground at -0.1 m, flattened to -1.5 m (within reach of its floor) as a map maker does
 * over a tunnel: `cell` its whole cell, edges included; `strip` a strip along x = 0 inside the cell's east and west edges.
 */
function tunnelMap(tile: string, rotation: Rotation, flat: 'cell' | 'strip' = 'cell'): MapDocument {
  const ground = -0.1;
  const centre = -1.5;
  const doc = newMapDocument('Tunnel');
  const t = newTerrain(40);
  for (let r = 0; r < t.rows; r++) {
    for (let c = 0; c < t.cols; c++) {
      const x = t.origin[0] + c * t.spacing;
      const z = t.origin[1] + r * t.spacing;
      // Flatten the cell's inside (not its edges) as a map maker does over a tunnel.
      const low = flat === 'cell' ? Math.abs(x) <= 4.01 && Math.abs(z) <= 4.01 : Math.abs(x) < 3.9;
      t.heights[r * t.cols + c] = Math.round((low ? centre : ground) * 100);
    }
  }
  return { ...doc, terrain: t, entities: [], classicStructure: { ...doc.classicStructure, tiles: [{ id: 'tile_t', tile, x: 0, y: 0, z: -1, rotation }] } };
}

const groundOf = (doc: MapDocument): TerrainData => withGroundAsPlayed(doc).terrain!;

/** Points of the tunnel's own cell where the passage is (no wall at knee height), a 0.1 m grid. */
function passagePoints(doc: MapDocument): [number, number][] {
  const walls = buildMapGeometry(doc).filter((b) => b.kind === 'wall' && b.min[1] <= -3.5 && b.max[1] >= -3.5);
  const out: [number, number][] = [];
  for (let x = -3.95; x <= 3.95; x += 0.1) {
    for (let z = -3.95; z <= 3.95; z += 0.1) {
      if (!walls.some((b) => x >= b.min[0] - 0.05 && x <= b.max[0] + 0.05 && z >= b.min[2] - 0.05 && z <= b.max[2] + 0.05)) out.push([x, z]);
    }
  }
  return out;
}

describe('tile options as tiles of their own: the Vaulted Tunnel side walls', () => {
  it('every vaulted tunnel has a Side Walls twin with its cells and ports, kept out of the palette', () => {
    for (const id of TUNNELS) {
      const [opt] = tileOptionsOf(id);
      expect(opt, id).toMatchObject({ option: 'sideWalls', label: 'Side walls', on: false, off: id });
      const twin = coreCatalog.get(opt!.onTile)!;
      expect(twin.optionOf).toEqual({ tile: id, option: 'sideWalls' });
      expect(isTileOptionTwin(twin)).toBe(true);
      expect(isTileOptionTwin(coreCatalog.get(id))).toBe(false);
      expect(twin.cells).toEqual(coreCatalog.get(id)!.cells);
      expect(twin.ports).toEqual(coreCatalog.get(id)!.ports);
      expect(tileOptionsOf(twin.id)).toEqual([{ ...opt, on: true }]);
    }
    expect(tileOptionsOf('core.room')).toEqual([]);
  });

  it('the checkbox swaps the tile and keeps its place, turn, paint and walls; undo swaps it back; nothing to change is refused', () => {
    const doc = tunnelMap('core.tunnel_vault', 1);
    const painted: MapDocument = { ...doc, classicStructure: { ...doc.classicStructure, tiles: [{ ...doc.classicStructure.tiles[0]!, edges: { '0,0,0:E': 'wall' }, surfaces: { walls: { material: 'core.pbr_limestone', tint: null } } }] } };
    const cmd = setTileOptionCommand(painted, ['tile_t'], 'sideWalls', true);
    if ('error' in cmd) throw new Error(cmd.error);
    const on = applyCommand(painted, cmd);
    const t = on.classicStructure.tiles[0]!;
    expect(t).toEqual({ ...painted.classicStructure.tiles[0], tile: 'core.tunnel_vault_walled' });
    expect('error' in setTileOptionCommand(on, ['tile_t'], 'sideWalls', true)).toBe(true);
    expect(applyCommand(on, invertCommand(cmd)).classicStructure.tiles[0]).toEqual(painted.classicStructure.tiles[0]);
    const off = setTileOptionCommand(on, ['tile_t'], 'sideWalls', false);
    if ('error' in off) throw new Error(off.error);
    expect(applyCommand(on, off).classicStructure.tiles[0]!.tile).toBe('core.tunnel_vault');
  });

  it('several tiles at once: those with the option change in one step, others are left alone', () => {
    const doc = tunnelMap('core.tunnel_vault', 0);
    const tiles = [
      doc.classicStructure.tiles[0]!,
      { id: 'tile_b', tile: 'core.tunnel_vault_t', x: 0, y: 1, z: -1, rotation: 0 as Rotation },
      { id: 'tile_c', tile: 'core.room', x: 3, y: 0, z: 0, rotation: 0 as Rotation },
    ];
    const many: MapDocument = { ...doc, classicStructure: { ...doc.classicStructure, tiles } };
    const cmd = setTileOptionCommand(many, ['tile_t', 'tile_b', 'tile_c'], 'sideWalls', true);
    if ('error' in cmd) throw new Error(cmd.error);
    expect(cmd).toMatchObject({ kind: 'updateTiles' });
    expect(applyCommand(many, cmd).classicStructure.tiles.map((t) => t.tile)).toEqual(['core.tunnel_vault_walled', 'core.tunnel_vault_t_walled', 'core.room']);
  });

  it('with side walls the ground on the closed sides stays at the kerb (no bank down to the passage); without, it is pulled down', () => {
    const plain = groundOf(tunnelMap('core.tunnel_vault', 0));
    const walled = groundOf(tunnelMap('core.tunnel_vault_walled', 0));
    const kerb = groundOf(tunnelMap('core.tunnel_vault_walled', 0, 'strip'));
    const at = (t: TerrainData, x: number, z: number) => vertexY(t, Math.round((x - t.origin[0]) / t.spacing), Math.round((z - t.origin[1]) / t.spacing));
    for (const z of [-4, -2, 0, 2, 4]) {
      for (const x of [-4, 4]) {
        // Plain: the cell's edges go down to the passage's floor (the bank outside slopes down to them).
        expect(at(plain, x, z), `plain ${x},${z}`).toBeLessThan(-4);
        // Side walls: the closed sides' edges keep the ground as it was...
        expect(at(walled, x, z), `walled ${x},${z}`).toBeCloseTo(-1.5, 5);
        // ...and ground over the kerb is pulled just under its top (0.25 m under the level above).
        expect(at(kerb, x, z), `kerb ${x},${z}`).toBeCloseTo(-0.3, 5);
      }
      // A step out the ground is untouched.
      expect(at(kerb, -6, z)).toBeCloseTo(-0.1, 5);
    }
    // The kerb: floors (painted like floors) on the wall tops, 0.25 m under ground level.
    const kerbs = buildMapGeometry(tunnelMap('core.tunnel_vault_walled', 0)).filter((b) => b.kind === 'floor' && b.max[1] === -0.25);
    expect(kerbs.length).toBe(2);
  });

  it('no earth shows in the passage of any side-walled tunnel, in any turn', () => {
    for (const base of TUNNELS) {
      for (const rotation of [0, 1, 2, 3] as Rotation[]) {
        const doc = tunnelMap(`${base}_walled`, rotation);
        const t = groundOf(doc);
        const pts = passagePoints(doc);
        expect(pts.length, base).toBeGreaterThan(500);
        let worst = -Infinity;
        for (const [x, z] of pts) worst = Math.max(worst, terrainHeightAt(t, x, z)!);
        // The passage's floor top is at -4 m: the ground stays under it.
        expect(worst, `${base} r${rotation}`).toBeLessThanOrEqual(-4 + 1e-6);
      }
    }
  });
});
