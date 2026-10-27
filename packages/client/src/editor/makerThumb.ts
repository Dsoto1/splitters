import { MAX_THUMBNAIL_CHARS, MapThumbnail, THUMBNAIL_SIZE, type MapDocument } from '@tiletrigger/shared';
import { mapThumbs, thumbPair } from '../frontend/mapThumbs.ts';
import type { EditorView } from './editorView.ts';

/**
 * MapMaker → Set thumbnail: the maker frames a view with the editor camera
 * (a 16:9 crop shown over the viewport) and captures it as the map's
 * picture, stored in the map (metadata.thumbnail, with the camera in
 * metadata.thumbnailCamera) as a small JPEG. In-engine
 * capture only: there is no way to pick an image file (content rules: players
 * can't upload assets). Kept apart from editorApp so it stays self-contained.
 */
export interface ThumbHost {
  view(): EditorView;
  /** The document being edited. */
  current(): MapDocument;
  /** Is this one of the built-in maps (which has an automatic picture)? */
  shipped(): boolean;
  /** Set (or with undefined, clear) the maker's picture and the camera it was taken from, as one undoable step. */
  setThumbnail(thumbnail: string | undefined, camera?: MapDocument['metadata']['thumbnailCamera']): void;
  toast(message: string, error?: boolean): void;
}

/** Map properties: the map's picture and plan side by side, with Set thumbnail and Clear. */
export function thumbnailSection(host: ThumbHost): HTMLElement {
  const doc = host.current();
  const wrap = document.createElement('div');
  wrap.className = 'ed-thumb-section';
  const thumbs = mapThumbs(doc, host.shipped());
  requestAnimationFrame(thumbs.draw);
  const note = document.createElement('small');
  note.className = 'ed-note';
  note.textContent = doc.metadata.thumbnail
    ? 'Your picture shows on map cards, beside the plan.'
    : 'No picture of your own yet: frame a good view and set one.';
  const set = document.createElement('button');
  set.id = 'ed-thumb-set';
  set.textContent = doc.metadata.thumbnail ? 'Retake thumbnail' : 'Set thumbnail';
  set.title = "Frame the map's picture with the camera, then capture it";
  set.addEventListener('click', () => startFraming(host));
  const clear = document.createElement('button');
  clear.id = 'ed-thumb-clear';
  clear.textContent = 'Clear';
  clear.title = 'Remove your picture';
  clear.disabled = !doc.metadata.thumbnail;
  clear.addEventListener('click', () => host.setThumbnail(undefined));
  const row = document.createElement('div');
  row.className = 'ed-thumb-actions';
  row.append(set, clear);
  wrap.append(thumbPair(thumbs, 'ed-map-thumbs'), note, row);
  return wrap;
}

/** Where the 3D view shows between the editor's panels, and the largest 16:9 frame inside it. */
function frameRect(): { x: number; y: number; w: number; h: number } {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const box = (id: string) => {
    const r = document.getElementById(id)?.getBoundingClientRect();
    return r && r.width > 0 && r.height > 0 ? r : null;
  };
  let [left, right, top, bottom] = [0, W, 0, H];
  const bar = box('ed-top');
  if (bar && bar.bottom < H / 3) top = bar.bottom;
  const foot = box('ed-bottom');
  if (foot && foot.top > (H * 2) / 3) bottom = foot.top;
  const pal = box('ed-palette');
  if (pal && pal.right < W / 2) left = pal.right;
  const side = box('ed-right');
  if (side && side.left > W / 2) right = side.left;
  const m = 28;
  const w = Math.max(160, Math.min(right - left - m * 2, ((bottom - top - m * 2) * 16) / 9));
  const h = (w * 9) / 16;
  return { x: left + (right - left - w) / 2, y: top + (bottom - top - h) / 2, w, h };
}

/** The capture as a JPEG data URL within the size cap: smaller quality first, then a smaller size. */
function encode(src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number): string | null {
  const out = document.createElement('canvas');
  for (const scale of [1, 0.8]) {
    out.width = Math.round(THUMBNAIL_SIZE.width * scale);
    out.height = Math.round(THUMBNAIL_SIZE.height * scale);
    const g = out.getContext('2d');
    if (!g) return null;
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, sx, sy, sw, sh, 0, 0, out.width, out.height);
    for (const q of [0.8, 0.7, 0.6, 0.5, 0.4]) {
      const url = out.toDataURL('image/jpeg', q);
      if (url.length <= MAX_THUMBNAIL_CHARS && MapThumbnail.safeParse(url).success) return url;
    }
  }
  return null;
}

/**
 * Copy the framed part of the next frame drawn without the editing aids.
 * Read at the end of a frame the scene rendered in (as Babylon's own
 * screenshots do), before the browser clears the drawing buffer.
 */
function capture(view: EditorView, frame: { x: number; y: number; w: number; h: number }): Promise<string | null> {
  const engine = view.scene.getEngine();
  const canvas = engine.getRenderingCanvas();
  if (!canvas) return Promise.resolve(null);
  view.photoMode(true);
  return new Promise<string | null>((resolve) => {
    let rendered = false;
    const after = view.scene.onAfterRenderObservable.add(() => (rendered = true));
    const done = (v: string | null) => {
      clearTimeout(timer);
      view.scene.onAfterRenderObservable.remove(after);
      engine.onEndFrameObservable.remove(end);
      view.photoMode(false);
      resolve(v);
    };
    const end = engine.onEndFrameObservable.add(() => {
      if (!rendered) return;
      const r = canvas.getBoundingClientRect();
      const k = canvas.width / Math.max(1, r.width);
      try {
        done(encode(canvas, (frame.x - r.left) * k, (frame.y - r.top) * k, frame.w * k, frame.h * k));
      } catch {
        done(null);
      }
    });
    const timer = window.setTimeout(() => done(null), 5000);
  });
}

let framing: (() => void) | null = null;

/** Show the 16:9 framing guide over the 3D view; Capture (Enter) takes the picture, Cancel (Esc) leaves. */
export function startFraming(host: ThumbHost): void {
  framing?.();
  const overlay = document.createElement('div');
  overlay.id = 'ed-thumb-frame';
  const frame = document.createElement('div');
  frame.className = 'ed-thumb-crop';
  const bar = document.createElement('div');
  bar.className = 'ed-thumb-bar';
  const hint = document.createElement('span');
  hint.textContent = 'Frame the map picture: move the camera as usual. Only what is inside the box is kept.';
  const shoot = document.createElement('button');
  shoot.id = 'ed-thumb-capture';
  shoot.className = 'primary';
  shoot.textContent = 'Capture (Enter)';
  const cancel = document.createElement('button');
  cancel.id = 'ed-thumb-cancel';
  cancel.textContent = 'Cancel (Esc)';
  bar.append(hint, shoot, cancel);
  overlay.append(frame, bar);
  (document.getElementById('editor') ?? document.body).append(overlay);
  const place = () => {
    const f = frameRect();
    Object.assign(frame.style, { left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px` });
    // The bar sits inside the top of the frame (it is page, not picture: it isn't captured).
    Object.assign(bar.style, { left: `${f.x + 8}px`, top: `${f.y + 8}px`, width: `${f.w - 16}px` });
  };
  place();
  const close = () => {
    window.removeEventListener('resize', place);
    window.removeEventListener('keydown', keys, true);
    overlay.remove();
    framing = null;
  };
  const take = async () => {
    shoot.disabled = true;
    overlay.classList.add('shooting');
    const view = host.view();
    const cam = view.camera;
    const ahead = cam.getForwardRay(10).direction;
    const r = (v: number) => Math.round(v * 100) / 100;
    const camera = {
      position: [r(cam.position.x), r(cam.position.y), r(cam.position.z)] as [number, number, number],
      target: [r(cam.position.x + ahead.x * 10), r(cam.position.y + ahead.y * 10), r(cam.position.z + ahead.z * 10)] as [number, number, number],
    };
    const url = await capture(view, frameRect());
    close();
    if (!url) return host.toast("Couldn't capture the picture: try again", true);
    host.setThumbnail(url, camera);
    host.toast('Map picture set');
  };
  const keys = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== 'Escape') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.key === 'Enter') void take();
    else close();
  };
  window.addEventListener('resize', place);
  window.addEventListener('keydown', keys, true);
  shoot.addEventListener('click', () => void take());
  cancel.addEventListener('click', close);
  framing = close;
}
