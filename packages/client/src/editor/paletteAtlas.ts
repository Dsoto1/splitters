import { versioned } from '../assetUrl.ts';

/**
 * The palette's picture atlases (`public/thumbs/`, written by
 * tools/content/build-palette-atlas.mjs): every shipped tile, prop and
 * vehicle pre-rendered into a few sprite sheets, one per palette group, so
 * MapMaker shows pictures without rendering 3D thumbnails at runtime.
 */
export interface AtlasManifest {
  version: 1;
  /** Cell size in pixels (square) and cells per row. */
  cell: number;
  cols: number;
  atlases: Record<string, { file: string; count: number; rows: number; bytes: number }>;
  /** Palette key (`tile:core.room`, `prop:prop.barrel`, `mount:tank`) → [atlas, cell index, source hash, pack index]. */
  items: Record<string, [string, number, string, number?]>;
  /** Pack names (the content pack each prop comes from), for search. */
  packs: string[];
}

export const ATLAS_BASE = `${import.meta.env.BASE_URL}thumbs/`;

export class PaletteAtlas {
  readonly manifest: Promise<AtlasManifest | null>;
  private readonly images = new Map<string, Promise<string | null>>();
  /** Atlas groups requested so far (each loads once, the first time one of its pictures is shown). */
  readonly loaded = new Set<string>();

  constructor(fetchManifest: () => Promise<AtlasManifest | null> = () => fetch(versioned(`${ATLAS_BASE}palette.json`)).then((r) => (r.ok ? (r.json() as Promise<AtlasManifest>) : null))) {
    this.manifest = fetchManifest().catch(() => null);
  }

  /** The pack a piece comes from, if the atlas knows it. */
  async pack(key: string): Promise<string | undefined> {
    const m = await this.manifest;
    const p = m?.items[key]?.[3];
    return p === undefined ? undefined : m!.packs[p];
  }

  /** Paint the piece's picture into `slot` as a sprite from its atlas; false when the atlas hasn't got it. */
  async paint(slot: HTMLElement, key: string): Promise<boolean> {
    const m = await this.manifest;
    const item = m?.items[key];
    const atlas = item && m.atlases[item[0]];
    if (!item || !atlas) return false;
    const url = await this.image(item[0], atlas.file);
    if (!url) return false;
    const col = item[1] % m.cols;
    const row = Math.floor(item[1] / m.cols);
    // A sprite inside the slot (the slot keeps its own backdrop; any stand-in icon goes).
    const spr = document.createElement('i');
    spr.className = 'spr';
    spr.style.backgroundImage = `url("${url}")`;
    spr.style.backgroundSize = `${m.cols * 100}% ${atlas.rows * 100}%`;
    spr.style.backgroundPosition = `${m.cols > 1 ? (col / (m.cols - 1)) * 100 : 0}% ${atlas.rows > 1 ? (row / (atlas.rows - 1)) * 100 : 0}%`;
    slot.replaceChildren(spr);
    slot.dataset.atlas = item[0];
    slot.classList.add('atlas');
    return true;
  }

  /** Load an atlas image once (decoded, so the sprites appear together). */
  private image(group: string, file: string): Promise<string | null> {
    let p = this.images.get(group);
    if (!p) {
      this.loaded.add(group);
      const url = `${ATLAS_BASE}${file}`;
      const img = new Image();
      img.src = url;
      p = img.decode().then(
        () => url,
        () => null,
      );
      this.images.set(group, p);
    }
    return p;
  }
}
