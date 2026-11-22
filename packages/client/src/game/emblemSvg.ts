/**
 * A player's emblem as inline SVG (shared content/emblems.ts has the shapes and colours; Phase 2 of player profiles):
 * beside the name on the scoreboard and in the kill feed, on profile cards and on Profile's picker. A dark round plate
 * rimmed in the emblem's colour, the shape filled with it, and the shape's cuts in the plate's colour.
 */
import { EMBLEM_COLORS, EMBLEM_CUTS, EMBLEM_LABELS, EMBLEM_SHAPES, readEmblem, type EmblemPolygon } from '@tiletrigger/shared';

const PLATE = 'rgba(10,13,22,0.92)';
const cache = new Map<string, string>();
const draw = (list: readonly EmblemPolygon[]) => list.map((p) => `<polygon points="${p.map(([x, y]) => `${x},${-y}`).join(' ')}"/>`).join('');

/** The emblem's markup (class `emb`), or '' for a code that names none. */
export function emblemSvg(code: string | null | undefined): string {
  if (!code) return '';
  let s = cache.get(code);
  if (s === undefined) {
    const e = readEmblem(code);
    if (!e) s = '';
    else {
      const color = EMBLEM_COLORS[e.color];
      const label = EMBLEM_LABELS[e.id];
      const cuts = EMBLEM_CUTS[e.id].length ? `<g fill="${PLATE}">${draw(EMBLEM_CUTS[e.id])}</g>` : '';
      s = `<svg class="emb emb-${e.id}" viewBox="-1.45 -1.45 2.9 2.9" role="img" aria-label="${label} emblem"><title>${label} emblem</title><circle r="1.36" fill="${PLATE}" stroke="${color}" stroke-width="0.13"/><g transform="scale(0.78)" fill="${color}">${draw(EMBLEM_SHAPES[e.id])}${cuts}</g></svg>`;
    }
    cache.set(code, s);
  }
  return s;
}
