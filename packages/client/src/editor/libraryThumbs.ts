import type { MapDocument } from '@tiletrigger/shared';
import { mapThumbs, thumbPair } from '../frontend/mapThumbs.ts';

/**
 * A map's picture and plan for a row of MapMaker's Open list. The map is only
 * loaded and its plan drawn once the row scrolls into view (the list holds
 * every template and saved map).
 */
export function libraryThumb(load: () => MapDocument | null, shipped: boolean): HTMLElement {
  const slot = document.createElement('span');
  slot.className = 'ed-lib-thumb';
  const fill = () => {
    const map = load();
    if (!map) return;
    const t = mapThumbs(map, shipped);
    slot.replaceChildren(thumbPair(t, 'ed-lib-thumbs'));
    requestAnimationFrame(t.draw);
  };
  if (typeof IntersectionObserver === 'undefined') {
    requestAnimationFrame(fill);
    return slot;
  }
  const seen = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    seen.disconnect();
    fill();
  });
  seen.observe(slot);
  return slot;
}
