import { b as buildMapGeometry, f as fitBounds, m as mapGroundBores, h as boxFootprint, i as buriedPassageLines } from "./settle-BDJE4VMF.js";
import { X as mapTeams, Y as MAX_TEAMS, Z as vertexY, _ as TERRAIN_MATERIALS } from "./index-BAsW2uYW.js";
function fillBox(g, b, px, py) {
  if (!b.yaw) {
    g.fillRect(px(b.min[0]), py(b.max[2]), px(b.max[0]) - px(b.min[0]), py(b.min[2]) - py(b.max[2]));
    return;
  }
  g.beginPath();
  for (const [x, z] of boxFootprint(b)) g.lineTo(px(x), py(z));
  g.closePath();
  g.fill();
}
function drawBuriedPassages(g, map, px, py, lineWidth, color = "rgba(190, 215, 255, 0.9)") {
  const lines = buriedPassageLines(map);
  if (!lines.length) return;
  g.save();
  g.lineWidth = lineWidth;
  g.strokeStyle = color;
  g.setLineDash([lineWidth * 3, lineWidth * 2]);
  g.beginPath();
  for (const l of lines) {
    g.moveTo(px(l.a[0]), py(l.a[1]));
    g.lineTo(px(l.b[0]), py(l.b[1]));
  }
  g.stroke();
  g.restore();
}
const buriedTiles = (map) => mapGroundBores(map).tiles;
function strokeBox(g, b, px, py) {
  g.beginPath();
  if (!b.yaw) g.rect(px(b.min[0]), py(b.max[2]), px(b.max[0]) - px(b.min[0]), py(b.min[2]) - py(b.max[2]));
  else {
    for (const [x, z] of boxFootprint(b)) g.lineTo(px(x), py(z));
    g.closePath();
  }
  g.stroke();
}
const GROUND_COLORS = {
  grass: [79, 110, 58],
  dirt: [122, 92, 59],
  stone: [109, 109, 106],
  sand: [180, 154, 104],
  gravel: [119, 115, 106],
  snow: [216, 221, 227],
  moss: [77, 107, 63],
  mud: [77, 61, 44]
};
function drawTerrainPlan(g, t, px, py, s) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const h of t.heights) {
    lo = Math.min(lo, h);
    hi = Math.max(hi, h);
  }
  const range = Math.max(1, hi - lo);
  const size = t.spacing * s + 0.75;
  for (let r = 0; r < t.rows - 1; r++) {
    for (let c = 0; c < t.cols - 1; c++) {
      const base = GROUND_COLORS[TERRAIN_MATERIALS[t.materials[r * (t.cols - 1) + c]] ?? "grass"];
      const y = (vertexY(t, c, r) + vertexY(t, c + 1, r + 1) - 2 * t.baseY) * 50;
      const k = 0.55 + 0.6 * ((y - lo) / range);
      g.fillStyle = `rgb(${Math.min(255, base[0] * k) | 0}, ${Math.min(255, base[1] * k) | 0}, ${Math.min(255, base[2] * k) | 0})`;
      const x = t.origin[0] + c * t.spacing;
      const z = t.origin[1] + (r + 1) * t.spacing;
      g.fillRect(px(x), py(z), size, size);
    }
  }
}
function drawTerrainContours(g, t, px, py, s) {
  const cols = t.cols - 1;
  const rows = t.rows - 1;
  const mean = new Float32Array(cols * rows);
  let lo = Infinity;
  let hi = -Infinity;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const y = (vertexY(t, c, r) + vertexY(t, c + 1, r) + vertexY(t, c, r + 1) + vertexY(t, c + 1, r + 1)) / 4;
      mean[r * cols + c] = y;
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
  }
  if (!Number.isFinite(lo)) return;
  const step = Math.max(1.5, (hi - lo) / 8);
  const band = (i) => Math.floor((mean[i] - lo) / step);
  const top = Math.max(1, Math.floor((hi - lo) / step));
  const size = t.spacing * s + 0.75;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = band(r * cols + c) / top;
      g.fillStyle = `rgb(${20 + 22 * k | 0}, ${30 + 28 * k | 0}, ${46 + 34 * k | 0})`;
      g.fillRect(px(t.origin[0] + c * t.spacing), py(t.origin[1] + (r + 1) * t.spacing), size, size);
    }
  }
  g.strokeStyle = "rgba(120, 200, 230, 0.35)";
  g.lineWidth = 1;
  g.beginPath();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const b = band(r * cols + c);
      const x = t.origin[0] + (c + 1) * t.spacing;
      const z = t.origin[1] + (r + 1) * t.spacing;
      if (c + 1 < cols && band(r * cols + c + 1) !== b) {
        g.moveTo(px(x), py(z - t.spacing));
        g.lineTo(px(x), py(z));
      }
      if (r + 1 < rows && band((r + 1) * cols + c) !== b) {
        g.moveTo(px(x - t.spacing), py(z));
        g.lineTo(px(x), py(z));
      }
    }
  }
  g.stroke();
}
function drawMapPlan(canvas, map) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.width = Math.round(canvas.clientWidth * dpr || 360 * dpr);
  const h = canvas.height = Math.round(canvas.clientHeight * dpr || 170 * dpr);
  const g = canvas.getContext("2d");
  if (!g) return;
  const buried = buriedTiles(map);
  const boxes = buildMapGeometry(map).filter((b) => !buried.has(b.sourceId));
  const area = map.bounds ? { min: map.bounds.min, max: map.bounds.max } : fitBounds(map, 2);
  let [x0, z0, x1, z1] = area ? [area.min[0], area.min[1], area.max[0], area.max[1]] : [Infinity, Infinity, -Infinity, -Infinity];
  if (!area) {
    for (const b of boxes) {
      x0 = Math.min(x0, b.min[0]);
      z0 = Math.min(z0, b.min[2]);
      x1 = Math.max(x1, b.max[0]);
      z1 = Math.max(z1, b.max[2]);
    }
  }
  {
    let [bx0, bz0, bx1, bz1] = [Infinity, Infinity, -Infinity, -Infinity];
    const grow = (x, z) => {
      bx0 = Math.min(bx0, x);
      bz0 = Math.min(bz0, z);
      bx1 = Math.max(bx1, x);
      bz1 = Math.max(bz1, z);
    };
    for (const b of boxes) {
      if (b.kind === "barrier" || b.kind === "prop") continue;
      grow(b.min[0], b.min[2]);
      grow(b.max[0], b.max[2]);
    }
    for (const e of map.entities) if (e.kind === "spawn" || e.kind === "pickup" || e.kind === "flag" || e.kind === "hill" || e.kind === "encounter") grow(e.position[0], e.position[2]);
    [bx0, bz0, bx1, bz1] = [Math.max(x0, bx0 - 3), Math.max(z0, bz0 - 3), Math.min(x1, bx1 + 3), Math.min(z1, bz1 + 3)];
    if (bx1 - bx0 > 8 && bz1 - bz0 > 8 && (bx1 - bx0) * (bz1 - bz0) < 0.85 * (x1 - x0) * (z1 - z0)) [x0, z0, x1, z1] = [bx0, bz0, bx1, bz1];
  }
  if (!Number.isFinite(x0) || x1 - x0 < 1 || z1 - z0 < 1) [x0, z0, x1, z1] = [-8, -8, 8, 8];
  const u = Math.max(0.7, Math.min(1.5, Math.min(w, h) / (150 * dpr))) * dpr;
  const pad = 6 * u;
  const s = Math.min((w - pad * 2) / (x1 - x0), (h - pad * 2) / (z1 - z0));
  const ox = (w - (x1 - x0) * s) / 2;
  const oy = (h - (z1 - z0) * s) / 2;
  const px = (x) => ox + (x - x0) * s;
  const py = (z) => h - (oy + (z - z0) * s);
  g.fillStyle = "#0d1322";
  g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(0, 209, 255, 0.06)";
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 0; x < w; x += 12 * dpr) {
    g.moveTo(x, 0);
    g.lineTo(x, h);
  }
  for (let y = 0; y < h; y += 12 * dpr) {
    g.moveTo(0, y);
    g.lineTo(w, y);
  }
  g.stroke();
  g.save();
  g.beginPath();
  g.rect(px(x0), py(z1), (x1 - x0) * s, (z1 - z0) * s);
  g.clip();
  if (map.terrain) drawTerrainContours(g, map.terrain, px, py, s);
  const floors = boxes.filter((b) => b.kind === "floor").sort((a, b) => a.max[1] - b.max[1]);
  g.lineWidth = Math.max(1, 0.6 * dpr);
  for (const b of floors) {
    const upper = b.max[1] > 1;
    g.fillStyle = upper ? "rgba(79, 107, 255, 0.22)" : "#22314c";
    fillBox(g, b, px, py);
    g.strokeStyle = upper ? "rgba(130, 150, 255, 0.55)" : "rgba(120, 160, 215, 0.45)";
    strokeBox(g, b, px, py);
  }
  for (const e of map.entities) {
    if (e.kind !== "water") continue;
    g.fillStyle = e.liquid === "water" ? "rgba(52, 130, 220, 0.5)" : "rgba(120, 200, 80, 0.45)";
    const [hx, hz] = [e.size[0] / 2, e.size[2] / 2];
    g.fillRect(px(e.position[0] - hx), py(e.position[2] + hz), 2 * hx * s, 2 * hz * s);
  }
  for (const b of boxes) {
    if (b.kind !== "solid" && b.kind !== "prop" || b.min[1] > 1.5) continue;
    g.fillStyle = b.kind === "prop" ? "#5e4a30" : "#7a5d37";
    fillBox(g, b, px, py);
    g.strokeStyle = "#c29a62";
    strokeBox(g, b, px, py);
  }
  g.fillStyle = "#a9c0e0";
  for (const b of boxes) if (b.kind === "wall" && b.min[1] < 1) fillBox(g, b, px, py);
  drawBuriedPassages(g, map, px, py, Math.max(1, 0.9 * dpr));
  const teams = mapTeams(map, MAX_TEAMS);
  const teamColor = (id) => teams.find((t) => t.id === id)?.color ?? "#00d1ff";
  const dot = (x, y, r, fill) => {
    g.beginPath();
    g.arc(x, y, r * u, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 0.8 * u;
    g.strokeStyle = "rgba(5, 8, 16, 0.85)";
    g.stroke();
  };
  const ring = (x, y, radius, color) => {
    g.beginPath();
    g.arc(x, y, Math.max(3 * u, radius * s), 0, Math.PI * 2);
    g.lineWidth = 1.2 * u;
    g.strokeStyle = color;
    g.stroke();
  };
  for (const e of map.entities) {
    const x = px(e.position[0]);
    const y = py(e.position[2]);
    if (e.kind === "hill") ring(x, y, e.radius, "#ffd166");
    else if (e.kind === "rescue") ring(x, y, e.radius, "#2ecc71");
    else if (e.kind === "bombsite" || e.kind === "objective") {
      const color = e.kind === "bombsite" ? "#ff9f43" : e.objective === "target" ? "#ff5a3a" : e.objective === "final" ? "#c38bff" : "#f2c14e";
      ring(x, y, e.radius, color);
      g.fillStyle = color;
      g.font = `700 ${Math.round(8 * u)}px sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(e.label, x, y);
    }
  }
  for (const e of map.entities) {
    const x = px(e.position[0]);
    const y = py(e.position[2]);
    switch (e.kind) {
      case "spawn":
        dot(x, y, 2.4, teamColor(e.faction));
        break;
      case "pickup":
        g.fillStyle = "#2ecc71";
        g.fillRect(x - 1.7 * u, y - 1.7 * u, 3.4 * u, 3.4 * u);
        break;
      case "encounter":
        dot(x, y, 3, "#e74c3c");
        break;
      case "hostage":
        dot(x, y, 2.2, "#f5f5f5");
        break;
      case "portal":
        dot(x, y, 2, e.color ?? "#b06cff");
        break;
      case "mount":
        g.fillStyle = "#d0d6e0";
        g.beginPath();
        g.moveTo(x, y - 3 * u);
        g.lineTo(x + 2.6 * u, y + 2 * u);
        g.lineTo(x - 2.6 * u, y + 2 * u);
        g.closePath();
        g.fill();
        break;
      case "flag":
        g.lineWidth = u;
        g.strokeStyle = "#f5f5f5";
        g.beginPath();
        g.moveTo(x, y + 3.5 * u);
        g.lineTo(x, y - 4 * u);
        g.stroke();
        g.fillStyle = teamColor(e.team);
        g.beginPath();
        g.moveTo(x, y - 4 * u);
        g.lineTo(x + 5 * u, y - 2.2 * u);
        g.lineTo(x, y - 0.4 * u);
        g.closePath();
        g.fill();
        break;
    }
  }
  g.restore();
}
export {
  drawTerrainPlan as a,
  buriedTiles as b,
  drawBuriedPassages as c,
  drawMapPlan as d,
  fillBox as f
};
