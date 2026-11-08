import type { Vec3 } from '../math.ts';
import type { WorldBox } from '../map/geometry.ts';
import type { CardCamera, MapDocument } from '../map/schema.ts';
import type { TerrainData } from '../map/terrain.ts';
import type { EditCommand } from './commands.ts';
import { restUnder } from './surfaceSnap.ts';

/**
 * The card-shot camera (MapMaker overhaul Phase 3, item 8): the menu card's picture is taken from a camera pose
 * stored in the map (`metadata.cardCamera`, v30), set in MapMaker from the view, at eye level by default. The card
 * picture itself (maps/shots/<id>.jpg, 640×360) is rendered from it by tools/content/capture-map-shots.mjs, with the
 * same lens and frame as here.
 */

/** Eye level: the camera this far above what it stands over (a person's eye, about). */
export const CARD_EYE_HEIGHT = 1.7;
/** The card picture's vertical field of view (radians): capture-map-shots.mjs renders with the same. */
export const CARD_FOV = 0.9;
/** The card's frame: 16:9 (the picture is 640×360, map cards show it whole, `object-fit: cover` at 16 / 9). */
export const CARD_ASPECT = 16 / 9;
export const CARD_SIZE = { width: 640, height: 360 } as const;

const r2 = (v: number) => Math.round(v * 100) / 100 + 0;
const r4 = (v: number) => Math.round(v * 10000) / 10000 + 0;

/** A camera pose as stored: position to the centimetre, angles to a ten-thousandth of a radian, pitch within ±1.55. */
export function cardCamera(position: Vec3, yaw: number, pitch: number): CardCamera {
  let y = yaw % (Math.PI * 2);
  if (y > Math.PI) y -= Math.PI * 2;
  if (y <= -Math.PI) y += Math.PI * 2;
  return { position: [r2(position.x), r2(position.y), r2(position.z)], yaw: r4(y), pitch: r4(Math.max(-1.55, Math.min(1.55, pitch))) };
}

/** Kept at eye level, the camera climbs onto nothing higher than this over the floor it's on (a jump's height, about). */
export const CARD_EYE_CLIMB = 1.2;

/**
 * Eye level: the camera moved to CARD_EYE_HEIGHT above the floor, roof or ground under it (the highest one no higher
 * than the camera), its look unchanged. `kept`: the camera is at eye level already (moving with it): what's under it
 * counts only up to CARD_EYE_CLIMB over the floor it stands over, so a wall top or a crate just under the eye doesn't
 * lift it. Null over nothing at all (the caller keeps the camera as it is).
 */
export function eyeLevel(position: Vec3, boxes: readonly WorldBox[], ground: TerrainData | null, kept = false): Vec3 | null {
  const from = kept ? position.y - CARD_EYE_HEIGHT + CARD_EYE_CLIMB : position.y;
  const rest = restUnder(boxes, ground, position.x, position.z, from);
  if (!rest) return null;
  return { x: position.x, y: rest.y + CARD_EYE_HEIGHT, z: position.z };
}

/** Where a pose looks, `dist` metres ahead (the capture tooling's target, and ThumbnailCamera's). */
export function cardTarget(c: CardCamera, dist = 10): [number, number, number] {
  const [x, y, z] = c.position;
  const k = Math.cos(c.pitch);
  return [r2(x + Math.sin(c.yaw) * k * dist), r2(y + Math.sin(c.pitch) * dist), r2(z + Math.cos(c.yaw) * k * dist)];
}

/**
 * The editor camera's vertical field of view that shows the card's frame (a box `frameH` pixels high inside a view
 * `viewH` high) exactly as the card picture's CARD_FOV does.
 */
export function cardViewFov(frameH: number, viewH: number): number {
  return 2 * Math.atan(Math.tan(CARD_FOV / 2) * (viewH / Math.max(1, frameH)));
}

/** The largest card frame (16:9) inside a w × h view, `margin` pixels clear of its edges, centred. */
export function cardFrameIn(w: number, h: number, margin = 0): { x: number; y: number; w: number; h: number } {
  const fw = Math.max(16, Math.min(w - margin * 2, (h - margin * 2) * CARD_ASPECT));
  const fh = fw / CARD_ASPECT;
  return { x: (w - fw) / 2, y: (h - fh) / 2, w: fw, h: fh };
}

/** Set (or with null, clear) the card camera: one undo step. Null when it's already that. */
export function setCardCameraCommand(doc: MapDocument, camera: CardCamera | null): EditCommand | null {
  const before = doc.metadata.cardCamera;
  const after = camera ?? undefined;
  if (JSON.stringify(before ?? null) === JSON.stringify(after ?? null)) return null;
  return { kind: 'setMetadata', before: { cardCamera: before }, after: { cardCamera: after } };
}
