import { buildMapGeometry, type MapDocument } from '@tiletrigger/shared';
import { drawTerrainPlan, fillBox } from '../frontend/mapPlan.ts';

/** Pixels per metre on the minimap's backing image. */
const PX_PER_M = 5;
/** Metres from the centre to the minimap's edge. */
const RANGE_M = 26;

export interface MinimapBlip {
  x: number;
  z: number;
  color: string;
}

/**
 * Circular, player-centred minimap (reference board: top left of the HUD).
 * The map's ground floor is drawn once from its real geometry; each frame the
 * view is rotated so your facing points up, with you as an arrow and
 * teammates (and objectives) as dots.
 */
export class Minimap {
  private plan: HTMLCanvasElement | null = null;
  /** The plan as an image bitmap once made (immutable, kept on the GPU: drawing it is a texture draw, not a copy). */
  private planImage: ImageBitmap | null = null;
  /** What the last draw showed (redrawn only when it would differ). */
  private last = '';
  private origin = { x: 0, z: 0, h: 0 };
  private readonly g: CanvasRenderingContext2D | null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.g = canvas.getContext('2d');
  }

  setMap(map: MapDocument): void {
    const boxes = buildMapGeometry(map);
    let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const b of boxes) {
      x0 = Math.min(x0, b.min[0]);
      z0 = Math.min(z0, b.min[2]);
      x1 = Math.max(x1, b.max[0]);
      z1 = Math.max(z1, b.max[2]);
    }
    const plan = document.createElement('canvas');
    plan.width = Math.ceil((x1 - x0) * PX_PER_M);
    plan.height = Math.ceil((z1 - z0) * PX_PER_M);
    const g = plan.getContext('2d')!;
    const h = plan.height;
    const px = (x: number) => (x - x0) * PX_PER_M;
    const py = (z: number) => h - (z - z0) * PX_PER_M;
    if (map.terrain) {
      g.globalAlpha = 0.85;
      drawTerrainPlan(g, map.terrain, px, py, PX_PER_M);
      g.globalAlpha = 1;
    }
    g.fillStyle = 'rgba(42, 58, 85, 0.95)';
    for (const b of boxes) if (b.kind === 'floor' && b.max[1] < 1) fillBox(g, b, px, py);
    g.fillStyle = 'rgba(138, 106, 63, 0.9)';
    for (const b of boxes) if ((b.kind === 'solid' || b.kind === 'prop') && b.min[1] < 1) fillBox(g, b, px, py);
    g.fillStyle = '#9fb6d8';
    for (const b of boxes) if (b.kind === 'wall' && b.min[1] < 1) fillBox(g, b, px, py);
    this.plan = plan;
    this.planImage?.close();
    this.planImage = null;
    this.last = '';
    this.origin = { x: x0, z: z0, h };
    // A big open map's plan is a couple of million pixels (Shingle Point 1,210 × 1,470): drawn from a bitmap.
    if (typeof createImageBitmap === 'function') {
      void createImageBitmap(plan).then(
        (bmp) => {
          if (this.plan === plan) {
            this.planImage = bmp;
            this.last = '';
          } else bmp.close();
        },
        () => undefined,
      );
    }
  }

  update(x: number, z: number, yaw: number, blips: readonly MinimapBlip[]): void {
    const g = this.g;
    if (!g || !this.plan) return;
    // Nothing moved by a pixel (you stood still, so did the dots): the canvas already shows it.
    let key = `${Math.round(x * PX_PER_M)},${Math.round(z * PX_PER_M)},${Math.round(yaw * 200)}`;
    for (const b of blips) key += `|${Math.round(b.x * 2)},${Math.round(b.z * 2)},${b.color}`;
    if (key === this.last) return;
    this.last = key;
    const size = this.canvas.width;
    const r = size / 2;
    const scale = r / (RANGE_M * PX_PER_M);
    const toPlan = (wx: number, wz: number) => [(wx - this.origin.x) * PX_PER_M, this.origin.h - (wz - this.origin.z) * PX_PER_M] as const;
    g.clearRect(0, 0, size, size);
    g.save();
    g.beginPath();
    g.arc(r, r, r - 1, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = 'rgba(11, 15, 26, 0.82)';
    g.fillRect(0, 0, size, size);
    g.translate(r, r);
    g.rotate(-yaw);
    g.scale(scale, scale);
    const [px, py] = toPlan(x, z);
    g.translate(-px, -py);
    // Only the plan round you (the view's circle, turned any way), not the whole map's picture with a clip over it.
    const src = this.planImage ?? this.plan;
    const reach = Math.ceil(RANGE_M * PX_PER_M * Math.SQRT2) + 2;
    const sx = Math.max(0, Math.floor(px - reach));
    const sy = Math.max(0, Math.floor(py - reach));
    const sw = Math.min(src.width, Math.ceil(px + reach)) - sx;
    const sh = Math.min(src.height, Math.ceil(py + reach)) - sy;
    if (sw > 0 && sh > 0) g.drawImage(src, sx, sy, sw, sh, sx, sy, sw, sh);
    for (const b of blips) {
      const [bx, by] = toPlan(b.x, b.z);
      g.fillStyle = b.color;
      g.beginPath();
      g.arc(bx, by, 4.5 / scale, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    // You: an arrow pointing up (the view turns with you).
    g.fillStyle = '#00d1ff';
    g.beginPath();
    g.moveTo(r, r - 9);
    g.lineTo(r + 6, r + 7);
    g.lineTo(r, r + 3);
    g.lineTo(r - 6, r + 7);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(0, 209, 255, 0.55)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(r, r, r - 1.5, 0, Math.PI * 2);
    g.stroke();
  }
}
