import type { MapDocument } from '@tiletrigger/shared';
import { loadMapContent, mapContentNow } from '../mapContentLoader.ts';

/** A map that may not have loaded yet (a built-in map: mapIndex.ts): its metadata now, the whole map on demand. */
export interface MapSource {
  readonly metadata: Pick<MapDocument['metadata'], 'id' | 'name' | 'thumbnail'>;
  /** The whole map, once loaded. */
  readonly map?: MapDocument;
  /** Load the whole map (and keep it as `map`). */
  load(): Promise<MapDocument>;
}

/**
 * A map's two thumbnails, always separate elements, never composited into one image:
 * - the picture: the maker's own (MapMaker → Set thumbnail, stored in the map
 *   as `metadata.thumbnail`) or, for built-in maps, the automatic one
 *   (tools/content/capture-map-shots.mjs → public/maps/shots/<id>.jpg);
 * - the plan: the flat top-down MapMaker schematic, drawn live from the map (mapPlan.ts).
 * Each place lays them out itself: map cards put the plan beside the name under
 * the picture, the setup panel, MapMaker and the game browser side by side (`pair`).
 */
export interface MapThumbs {
  /** The picture (an <img>, or a "No picture" placeholder for maps without one). */
  pic: HTMLElement;
  /** The plan (a <canvas>, drawn by draw()). */
  plan: HTMLElement;
  /** Draw the plan once it is laid out (cheap to repeat: draws once). */
  draw: () => void;
}

/** The automatic picture shipped with a built-in map (640 × 360 JPEG: the setup panel's banner). */
export function shippedPicture(id: string): string {
  return `${import.meta.env.BASE_URL}maps/shots/${id}.jpg`;
}

/**
 * The map card's copy of it: 480 × 270 WebP, about 10 KB (tools/content/map-cards.mjs makes it from the shot; the
 * content check fails when a shipped map has none), so a list of 90 cards fetches about a tenth as much.
 */
export function shippedCardPicture(id: string): string {
  return `${import.meta.env.BASE_URL}maps/cards/${id}.webp`;
}

/** The picture a map shows: its own, else (built-in maps) the automatic one (`card`: its small copy), else none. */
export function pictureSource(map: Pick<MapDocument, 'metadata'> | MapSource, shipped: boolean, card = false): string | null {
  return map.metadata.thumbnail ?? (shipped ? (card ? shippedCardPicture : shippedPicture)(map.metadata.id) : null);
}

function box(cls: string, label: string, title: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = `map-thumb ${cls}`;
  d.dataset.label = label;
  d.title = title;
  return d;
}

/**
 * `shipped`: a built-in map, which has an automatic picture when its maker set none. A map still to load draws its plan
 * once it has. `card`: a map card's (the small picture, fetched once the card nears the view).
 */
export function mapThumbs(map: MapDocument | MapSource, shipped: boolean, opts: { card?: boolean } = {}): MapThumbs {
  const pic = box('pic', 'Picture', `${map.metadata.name}: a look at the map`);
  const plan = box('plan', 'Plan', `${map.metadata.name}: top-down plan (layout, spawns, pickups)`);
  const canvas = document.createElement('canvas');
  plan.append(canvas);
  // The placeholder's words are drawn by CSS (::after), so lists' text stays the maps' own.
  const none = () => {
    pic.classList.add('none');
    pic.replaceChildren();
  };
  const src = pictureSource(map, shipped, opts.card);
  if (src) {
    const img = document.createElement('img');
    img.alt = '';
    if (opts.card) {
      // A long list fetches only the cards near the view; the box keeps its size meanwhile.
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = 480;
      img.height = 270;
    }
    // Elsewhere decoded with the frame that shows it: a screen rebuilt around a cached picture never flashes without it.
    else img.decoding = 'sync';
    img.addEventListener('error', none);
    img.src = src;
    pic.append(img);
  } else none();
  let drawn = false;
  let loading = false;
  const draw = () => {
    if (drawn || loading || !canvas.isConnected || !canvas.clientWidth) return;
    const doc = 'load' in map ? map.map : map;
    if (!doc) {
      loading = true;
      void (map as MapSource).load().then(
        () => ((loading = false), draw()),
        () => (loading = false),
      );
      return;
    }
    // The plan reads the tile and prop tables (mapContent.ts): they normally come in with the map.
    const content = mapContentNow();
    if (!content) {
      loading = true;
      void loadMapContent().then(
        () => ((loading = false), draw()),
        () => (loading = false),
      );
      return;
    }
    drawn = true;
    content.drawMapPlan(canvas, doc);
  };
  return { pic, plan, draw };
}

/** The picture and the plan side by side, in a wrapper with class `cls`. */
export function thumbPair(t: MapThumbs, cls = ''): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = `map-thumbs${cls ? ` ${cls}` : ''}`;
  wrap.append(t.pic, t.plan);
  return wrap;
}
