import { buildMapGeometry, newMapDocument, type TileDefinition } from '@chronosplit/shared';

const FILL = { floor: '#5b616b', wall: '#d9d6cf', solid: '#d98b3a' } as const;

/** Top-down SVG thumbnail generated from the tile's real geometry, so icons never drift from the catalog. */
export function tileIcon(def: TileDefinition): string {
  const base = newMapDocument('icon');
  const doc = { ...base, classicStructure: { ...base.classicStructure, tiles: [{ id: 'icon_tile', tile: def.id, x: 0, y: 0, z: 0, rotation: 0 as const }] } };
  const boxes = buildMapGeometry(doc)
    .filter((b) => b.min[1] < 3.9) // ground level only; upper-level walls would hide the steps
    .sort((a, b) => (a.kind === 'floor' ? -1 : 0) - (b.kind === 'floor' ? -1 : 0) || a.max[1] - b.max[1]);
  const s = 56 / 8;
  const rects = boxes
    .map((b) => {
      const x = (b.min[0] + 4) * s;
      const y = (4 - b.max[2]) * s; // north up
      const w = (b.max[0] - b.min[0]) * s;
      const h = (b.max[2] - b.min[2]) * s;
      const opacity = b.kind === 'solid' ? 0.45 + Math.min(1, b.max[1] / 4) * 0.55 : 1;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${FILL[b.kind]}" fill-opacity="${opacity.toFixed(2)}"/>`;
    })
    .join('');
  return `<svg viewBox="0 0 56 56" aria-hidden="true">${rects}</svg>`;
}
