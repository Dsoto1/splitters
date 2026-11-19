/**
 * A rank badge as inline SVG (shared content/insignia.ts has the shapes; Options → Ranks & badges): before a name in
 * the kill feed and on the scoreboards. Filled with the text colour around it (the name's team colour), outlined dark so it reads on
 * any colour and background (the outline drawn under every piece first, so joined pieces show no seam).
 */
import { INSIGNIA_CUTS, INSIGNIA_LABELS, INSIGNIA_SHAPES, type InsigniaId, type InsigniaPolygon } from '@tiletrigger/shared';

const cache = new Map<InsigniaId, string>();

/** The badge's markup (class `ins`). */
export function insigniaSvg(id: InsigniaId): string {
  let s = cache.get(id);
  if (!s) {
    const draw = (list: readonly InsigniaPolygon[]) => list.map((p) => `<polygon points="${p.map(([x, y]) => `${x},${-y}`).join(' ')}"/>`).join('');
    const polys = draw(INSIGNIA_SHAPES[id]);
    // Cuts (a skull's eyes, a gear's hole) over it in the outline's dark colour.
    const cuts = INSIGNIA_CUTS[id].length ? `<g fill="rgba(6,9,16,0.9)">${draw(INSIGNIA_CUTS[id])}</g>` : '';
    const label = INSIGNIA_LABELS[id];
    s = `<svg class="ins ins-${id}" viewBox="-1.2 -1.2 2.4 2.4" role="img" aria-label="${label}"><title>${label}</title><g fill="rgba(6,9,16,0.85)" stroke="rgba(6,9,16,0.85)" stroke-width="0.2" stroke-linejoin="round">${polys}</g><g fill="currentColor" stroke="currentColor" stroke-width="0.03">${polys}</g>${cuts}</svg>`;
    cache.set(id, s);
  }
  return s;
}
