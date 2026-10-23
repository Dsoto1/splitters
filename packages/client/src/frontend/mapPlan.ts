import { buildMapGeometry, mapTeams, type MapDocument } from '@chronosplit/shared';

/**
 * Draw a map's top-down plan from its real geometry (floors, walls, cover,
 * spawns and pickups) into a canvas, for map cards on the menus. Lit with a
 * simple height shade so ground floors, cover and upper storeys read apart.
 */
export function drawMapPlan(canvas: HTMLCanvasElement, map: MapDocument): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = (canvas.width = Math.round(canvas.clientWidth * dpr || 360 * dpr));
  const h = (canvas.height = Math.round(canvas.clientHeight * dpr || 170 * dpr));
  const g = canvas.getContext('2d');
  if (!g) return;
  const boxes = buildMapGeometry(map);
  let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const b of boxes) {
    x0 = Math.min(x0, b.min[0]);
    z0 = Math.min(z0, b.min[2]);
    x1 = Math.max(x1, b.max[0]);
    z1 = Math.max(z1, b.max[2]);
  }
  const pad = 10 * dpr;
  const s = Math.min((w - pad * 2) / (x1 - x0), (h - pad * 2) / (z1 - z0));
  const ox = (w - (x1 - x0) * s) / 2;
  const oy = (h - (z1 - z0) * s) / 2;
  const px = (x: number) => ox + (x - x0) * s;
  const py = (z: number) => h - (oy + (z - z0) * s);

  // Backdrop: deep space with a faint grid.
  g.fillStyle = '#0d1322';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(0, 209, 255, 0.06)';
  g.lineWidth = 1;
  for (let x = 0; x < w; x += 12 * dpr) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, h);
    g.stroke();
  }
  for (let y = 0; y < h; y += 12 * dpr) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }

  const rect = (b: { min: number[]; max: number[] }) => [px(b.min[0]!), py(b.max[2]!), (b.max[0]! - b.min[0]!) * s, (b.max[2]! - b.min[2]!) * s] as const;
  const floors = boxes.filter((b) => b.kind === 'floor').sort((a, b) => a.max[1] - b.max[1]);
  for (const b of floors) {
    const upper = b.max[1] > 1;
    g.fillStyle = upper ? 'rgba(79, 107, 255, 0.28)' : '#2a3a55';
    g.fillRect(...rect(b));
  }
  g.fillStyle = '#8a6a3f';
  for (const b of boxes) if (b.kind === 'solid' && b.min[1] < 1) g.fillRect(...rect(b));
  g.fillStyle = '#9fb6d8';
  for (const b of boxes) if (b.kind === 'wall' && b.min[1] < 1) g.fillRect(...rect(b));

  // Spawns in team colours (cyan when shared), pickups as small green squares.
  const teams = mapTeams(map);
  for (const e of map.entities) {
    const x = px(e.position[0]);
    const y = py(e.position[2]);
    if (e.kind === 'spawn') {
      g.fillStyle = teams.find((t) => t.id === e.faction)?.color ?? '#00d1ff';
      g.beginPath();
      g.arc(x, y, 2.6 * dpr, 0, Math.PI * 2);
      g.fill();
    } else if (e.kind === 'pickup') {
      g.fillStyle = '#2ecc71';
      g.fillRect(x - 1.6 * dpr, y - 1.6 * dpr, 3.2 * dpr, 3.2 * dpr);
    } else if (e.kind === 'encounter') {
      g.fillStyle = '#e74c3c';
      g.beginPath();
      g.arc(x, y, 3.2 * dpr, 0, Math.PI * 2);
      g.fill();
    }
  }
}
