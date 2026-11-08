import { CARD_EYE_HEIGHT, cardCamera, cardFrameIn, cardViewFov, eyeLevel, setCardCameraCommand, type CardCamera, type EditCommand, type MapDocument, type TerrainData, type WorldBox } from '@tiletrigger/shared';
import type { EditorView } from './editorView.ts';

/**
 * The card-shot camera (MapMaker overhaul Phase 3, item 8; Map properties → Card shot): set the menu card's shot from
 * the view, at eye level by default (the camera snapped to CARD_EYE_HEIGHT above what it's over, and kept there as
 * you fly), seen through the card's frame (16:9, the card picture's own lens: shared editor/cardShot.ts). Saving
 * stores the camera pose in the map (`metadata.cardCamera`, one undo step); no picture is stored: the capture tooling
 * (tools/content/capture-map-shots.mjs) renders the card picture from it. Preview shows the saved shot in the frame.
 */
export interface CardShotHost {
  view(): EditorView;
  current(): MapDocument;
  /** What the camera can stand over (eye level): the map's boxes, blocks and solid props. */
  standOn(): readonly WorldBox[];
  ground(): TerrainData | null;
  run(label: string, cmd: EditCommand): boolean;
  /** Every level drawn (as the card picture shows the map), and back. */
  showAll(): boolean;
  setShowAll(on: boolean): void;
  /** Hide (or show again) the markers a match doesn't draw: zones, hills, objectives' areas, NPC squads' rings. */
  hideMarkers(on: boolean): void;
  /** Out of the plan view first (the card shot is a perspective view). */
  leavePlan(): void;
  toast(message: string, error?: boolean): void;
}

/** Map properties: the card shot's state, Set card shot, Preview and Clear. */
export function cardShotSection(host: CardShotHost): HTMLElement {
  const doc = host.current();
  const cam = doc.metadata.cardCamera;
  const wrap = document.createElement('div');
  wrap.className = 'ed-card-section';
  const head = document.createElement('div');
  head.className = 'sub-h';
  head.textContent = 'Card shot';
  const note = document.createElement('small');
  note.className = 'ed-note';
  note.id = 'ed-card-note';
  note.textContent = cam
    ? `The menu card's picture is taken from your camera (${cam.position.map((v) => v.toFixed(1)).join(', ')}).`
    : "No card camera: the card picture's camera is chosen automatically.";
  const set = document.createElement('button');
  set.id = 'ed-card-set';
  set.textContent = cam ? 'Retake card shot…' : 'Set card shot…';
  set.title = "Frame the menu card's shot from this view, at eye level (1.7 m) unless you turn that off";
  set.addEventListener('click', () => startCardFrame(host, 'set'));
  const preview = document.createElement('button');
  preview.id = 'ed-card-preview';
  preview.textContent = 'Preview';
  preview.title = "See the saved card shot in the card's frame";
  preview.disabled = !cam;
  preview.addEventListener('click', () => startCardFrame(host, 'preview'));
  const clear = document.createElement('button');
  clear.id = 'ed-card-clear';
  clear.textContent = 'Clear';
  clear.title = 'Back to the automatic camera';
  clear.disabled = !cam;
  clear.addEventListener('click', () => {
    const cmd = setCardCameraCommand(host.current(), null);
    if (cmd) host.run('Clear card shot', cmd);
  });
  const row = document.createElement('div');
  row.className = 'ed-thumb-actions';
  row.append(set, preview, clear);
  wrap.append(head, note, row);
  return wrap;
}

/** The card frame over the 3D view: centred on the view (the camera's own middle), clear of the panels. */
function cardRect(view: EditorView): { x: number; y: number; w: number; h: number } {
  const r = view.scene.getEngine().getRenderingCanvasClientRect();
  const W = r?.width ?? window.innerWidth;
  const H = r?.height ?? window.innerHeight;
  const L = r?.left ?? 0;
  const T = r?.top ?? 0;
  const box = (id: string) => {
    const b = document.getElementById(id)?.getBoundingClientRect();
    return b && b.width > 0 && b.height > 0 ? b : null;
  };
  // Half the free width either side of the middle (the frame stays on the camera's axis), and the free height.
  const cx = L + W / 2;
  let half = W / 2;
  // Clear of the palette (the level strip hides while the frame is up: editor.css).
  const pal = box('ed-palette');
  if (pal && pal.right < cx) half = Math.min(half, cx - pal.right);
  const side = box('ed-right');
  if (side && side.left > cx) half = Math.min(half, side.left - cx);
  const cy = T + H / 2;
  let halfH = H / 2;
  const bar = box('ed-top');
  if (bar && bar.bottom < cy) halfH = Math.min(halfH, cy - bar.bottom);
  const foot = box('ed-bottom');
  if (foot && foot.top > cy) halfH = Math.min(halfH, foot.top - cy);
  // Room above the frame for its bar and below it for the name (both page, not picture), the same both sides.
  const f = cardFrameIn(half * 2 - 48, halfH * 2 - 2 * CARD_FRAME_ROOM, 0);
  return { x: cx - f.w / 2, y: cy - f.h / 2, w: f.w, h: f.h };
}

/** Room above and below the card frame for its bar and the map's name (px). */
const CARD_FRAME_ROOM = 54;

let open: (() => void) | null = null;

/**
 * Set: frame the shot (eye level on by default; Enter saves, Esc cancels). Preview: the saved shot in the frame
 * (Enter retakes it from there, Esc goes back to where you were). Either way the camera's lens is the card's while
 * the frame is up, and back as it was after.
 */
export function startCardFrame(host: CardShotHost, mode: 'set' | 'preview'): void {
  open?.();
  host.leavePlan();
  const view = host.view();
  const cam = view.camera;
  const before = { x: cam.position.x, y: cam.position.y, z: cam.position.z, yaw: view.yaw, pitch: view.pitch, fov: cam.fov };
  const saved = host.current().metadata.cardCamera;
  if (mode === 'preview' && saved) {
    cam.position.set(saved.position[0], saved.position[1], saved.position[2]);
    view.yaw = saved.yaw;
    view.pitch = saved.pitch;
    view.applyCamera();
  }
  const overlay = document.createElement('div');
  overlay.id = 'ed-thumb-frame';
  overlay.className = `ed-card-frame ${mode}`;
  const frame = document.createElement('div');
  frame.className = 'ed-thumb-crop ed-card-crop';
  const name = document.createElement('div');
  name.className = 'ed-card-name';
  name.textContent = host.current().metadata.name;
  frame.append(name);
  const bar = document.createElement('div');
  bar.className = 'ed-thumb-bar';
  const hint = document.createElement('span');
  hint.textContent = mode === 'set' ? "Frame the menu card's shot: fly as usual. What's in the box is the card picture." : 'The card shot as saved, in the card’s frame.';
  const eye = document.createElement('label');
  eye.className = 'ed-card-eye';
  const eyeBox = document.createElement('input');
  eyeBox.type = 'checkbox';
  eyeBox.id = 'ed-card-eye';
  eyeBox.checked = mode === 'set';
  eye.append(eyeBox, ` Eye level (${CARD_EYE_HEIGHT} m)`);
  eye.title = `Keep the camera ${CARD_EYE_HEIGHT} m above the floor or ground under it, as a player sees the map`;
  const save = document.createElement('button');
  save.id = 'ed-card-save';
  save.className = 'primary';
  save.textContent = mode === 'set' ? 'Save (Enter)' : 'Retake from here (Enter)';
  const cancel = document.createElement('button');
  cancel.id = 'ed-card-cancel';
  cancel.textContent = mode === 'set' ? 'Cancel (Esc)' : 'Close (Esc)';
  if (mode === 'set') bar.append(hint, eye, save, cancel);
  else bar.append(hint, save, cancel);
  overlay.append(frame, bar);
  (document.getElementById('editor') ?? document.body).append(overlay);
  let rect = cardRect(view);
  const place = () => {
    rect = cardRect(view);
    Object.assign(frame.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
    // The bar sits just above the frame: nothing covers the picture.
    Object.assign(bar.style, { left: `${rect.x}px`, top: `${rect.y - 48}px`, width: `${rect.w}px` });
  };
  place();
  const viewH = () => view.scene.getEngine().getRenderingCanvasClientRect()?.height ?? window.innerHeight;
  // The shot as the card shows it: no grid, gizmo or markers, every level drawn whole (all back on close).
  view.photoMode(true);
  const allBefore = host.showAll();
  if (!allBefore) host.setShowAll(true);
  host.hideMarkers(true);
  // Each frame: the card's lens over the frame, and eye level kept while it's on.
  const tick = view.scene.onBeforeRenderObservable.add(() => {
    cam.fov = cardViewFov(rect.h, viewH());
    if (!eyeBox.checked) return;
    const at = eyeLevel({ x: cam.position.x, y: cam.position.y + 0.05, z: cam.position.z }, host.standOn(), host.ground());
    if (at && Math.abs(at.y - cam.position.y) > 1e-3) cam.position.y = at.y;
  });
  // Turning eye level on from high up: drop to it from where the camera is.
  eyeBox.addEventListener('change', () => eyeBox.blur());
  const close = (restore: boolean) => {
    view.scene.onBeforeRenderObservable.remove(tick);
    view.photoMode(false);
    if (!allBefore) host.setShowAll(false);
    host.hideMarkers(false);
    window.removeEventListener('resize', place);
    window.removeEventListener('keydown', keys, true);
    cam.fov = before.fov;
    if (restore) {
      cam.position.set(before.x, before.y, before.z);
      view.yaw = before.yaw;
      view.pitch = before.pitch;
      view.applyCamera();
    }
    overlay.remove();
    open = null;
  };
  const commit = () => {
    const pose: CardCamera = cardCamera({ x: cam.position.x, y: cam.position.y, z: cam.position.z }, view.yaw, view.pitch);
    const cmd = setCardCameraCommand(host.current(), pose);
    // A preview's retake leaves you where the shot is; a set leaves you where you framed it.
    close(false);
    if (!cmd) return host.toast('The card shot is already this view');
    host.run(saved ? 'Retake card shot' : 'Set card shot', cmd);
    host.toast('Card shot saved: the capture tool renders the card picture from it');
  };
  const keys = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== 'Escape') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.key === 'Enter') commit();
    else close(mode === 'preview');
  };
  window.addEventListener('resize', place);
  window.addEventListener('keydown', keys, true);
  save.addEventListener('click', commit);
  cancel.addEventListener('click', () => close(mode === 'preview'));
  open = () => close(true);
}
