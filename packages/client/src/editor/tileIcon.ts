import { buildMapGeometry, newMapDocument, type TileDefinition } from '@chronosplit/shared';

const FILL = { floor: '#5b616b', wall: '#d9d6cf', solid: '#d98b3a', trim: '#d9d6cf' } as const;

/** Top-down SVG thumbnail generated from the tile's real geometry, so icons never drift from the catalog. */
export function tileIcon(def: TileDefinition): string {
  const base = newMapDocument('icon');
  const doc = { ...base, classicStructure: { ...base.classicStructure, tiles: [{ id: 'icon_tile', tile: def.id, x: 0, y: 0, z: 0, rotation: 0 as const }] } };
  const boxes = buildMapGeometry(doc)
    .filter((b) => b.min[1] < 3.9) // ground level only; upper-level walls would hide the steps
    .sort((a, b) => (a.kind === 'floor' ? -1 : 0) - (b.kind === 'floor' ? -1 : 0) || a.max[1] - b.max[1]);
  // Fit the whole footprint (multi-cell pieces too) into the icon.
  const xs = def.cells.map((c) => c[0]);
  const zs = def.cells.map((c) => c[1]);
  const x0 = Math.min(...xs) * 8 - 4;
  const z1 = Math.max(...zs) * 8 + 4;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) * 8 + 8;
  const s = 56 / span;
  const rects = boxes
    .map((b) => {
      const x = (b.min[0] - x0) * s;
      const y = (z1 - b.max[2]) * s; // north up
      const w = (b.max[0] - b.min[0]) * s;
      const h = (b.max[2] - b.min[2]) * s;
      const opacity = b.kind === 'solid' ? 0.45 + Math.min(1, b.max[1] / 4) * 0.55 : b.kind === 'floor' ? Math.min(1, 0.55 + Math.max(0, b.max[1] + 0.5) / 8) : 1;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0.6, w).toFixed(1)}" height="${Math.max(0.6, h).toFixed(1)}" fill="${FILL[b.kind]}" fill-opacity="${opacity.toFixed(2)}"/>`;
    })
    .join('');
  return `<svg viewBox="0 0 56 56" aria-hidden="true">${rects}</svg>`;
}
