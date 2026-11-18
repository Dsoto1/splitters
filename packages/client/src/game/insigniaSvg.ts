/**
 * A soldier's rank badge as inline SVG (shared content/insignia.ts has the shapes): before their name in the kill feed
 * and on the scoreboard. Filled with the text colour around it (the name's team colour), outlined dark so it reads on
 * any colour and background (the outline drawn under every piece first, so joined pieces show no seam).
 */
import { INSIGNIA_LABELS, INSIGNIA_SHAPES, type InsigniaId } from '@tiletrigger/shared';

const cache = new Map<InsigniaId, string>();

/** The badge's markup (class `ins`). */
export function insigniaSvg(id: InsigniaId): string {
  let s = cache.get(id);
  if (!s) {
    const polys = INSIGNIA_SHAPES[id].map((p) => `<polygon points="${p.map(([x, y]) => `${x},${-y}`).join(' ')}"/>`).join('');
    const label = INSIGNIA_LABELS[id];
    s = `<svg class="ins ins-${id}" viewBox="-1.2 -1.2 2.4 2.4" role="img" aria-label="${label}"><title>${label}</title><g fill="rgba(6,9,16,0.85)" stroke="rgba(6,9,16,0.85)" stroke-width="0.2" stroke-linejoin="round">${polys}</g><g fill="currentColor">${polys}</g></svg>`;
    cache.set(id, s);
  }
  return s;
}
