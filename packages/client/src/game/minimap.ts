import { buildMapGeometry, type MapDocument } from '@chronosplit/shared';

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
    const rect = (b: { min: number[]; max: number[] }) => [(b.min[0]! - x0) * PX_PER_M, h - (b.max[2]! - z0) * PX_PER_M, (b.max[0]! - b.min[0]!) * PX_PER_M, (b.max[2]! - b.min[2]!) * PX_PER_M] as const;
    g.fillStyle = 'rgba(42, 58, 85, 0.95)';
    for (const b of boxes) if (b.kind === 'floor' && b.max[1] < 1) g.fillRect(...rect(b));
    g.fillStyle = 'rgba(138, 106, 63, 0.9)';
    for (const b of boxes) if ((b.kind === 'solid' || b.kind === 'prop') && b.min[1] < 1) g.fillRect(...rect(b));
    g.fillStyle = '#9fb6d8';
    for (const b of boxes) if (b.kind === 'wall' && b.min[1] < 1) g.fillRect(...rect(b));
    this.plan = plan;
    this.origin = { x: x0, z: z0, h };
  }

  update(x: number, z: number, yaw: number, blips: readonly MinimapBlip[]): void {
    const g = this.g;
    if (!g || !this.plan) return;
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
    g.drawImage(this.plan, 0, 0);
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
