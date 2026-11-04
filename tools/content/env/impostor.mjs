// Build-time pictures of a generated model: an orthographic, z-buffered software rasteriser that samples the
// shared pictures (bark, rock, leaves; leaf cards alpha-tested), lit by one sun and an ambient term. Used for the
// far-away stand-in (two crossed cards, each the model seen from one side) and for quick previews of the
// generator's output. No GPU, no browser.

import { Mesh } from './mesh.mjs';

const srgb = (c) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)));
const lin = (c) => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};

/** A picture to sample: { data, width, height, channels } (sRGB bytes). Returns linear rgb and alpha at (u, v). */
function sampler(tex) {
  if (!tex) return () => [1, 1, 1, 1];
  const { data, width, height, channels } = tex;
  return (u, v) => {
    const x = ((Math.floor(u * width) % width) + width) % width;
    const y = ((Math.floor(v * height) % height) + height) % height;
    const i = (y * width + x) * channels;
    return [lin(data[i]), lin(data[i + 1]), lin(data[i + 2]), channels === 4 ? data[i + 3] / 255 : 1];
  };
}

/**
 * Draw `parts` ([{ mesh, texture, alphaTest }]) seen from `yaw` degrees round +Y (0: looking along -Z at the model's
 * front... i.e. from +Z) into width × height RGBA, fitted to `frame` [x0, y0, x1, y1] in view space (or the
 * meshes' bounds). `background` fills empty pixels (else alpha 0).
 */
export function render(parts, { width, height, yaw = 0, pitch = 0, frame = null, sun = [0.4, 0.8, 0.45], ambient = 0.5, light = 0.65, background = null }) {
  const cy = Math.cos((yaw * Math.PI) / 180);
  const sy = Math.sin((yaw * Math.PI) / 180);
  const cp = Math.cos((pitch * Math.PI) / 180);
  const sp = Math.sin((pitch * Math.PI) / 180);
  // The viewer stands at (sin yaw, 0, cos yaw) looking back at the model, as a Babylon (left-handed) camera sees it:
  // screen x runs along (-cos yaw, 0, sin yaw), so seen from +Z, +x is on the left.
  const view = (x, y, z) => {
    const x1 = -cy * x + sy * z;
    const z1 = sy * x + cy * z;
    return [x1, cp * y - sp * z1, sp * y + cp * z1];
  };
  if (!frame) {
    frame = [Infinity, Infinity, -Infinity, -Infinity];
    for (const { mesh } of parts)
      for (let i = 0; i < mesh.P.length; i += 3) {
        const v = view(mesh.P[i], mesh.P[i + 1], mesh.P[i + 2]);
        frame[0] = Math.min(frame[0], v[0]);
        frame[1] = Math.min(frame[1], v[1]);
        frame[2] = Math.max(frame[2], v[0]);
        frame[3] = Math.max(frame[3], v[1]);
      }
  }
  const [fx0, fy0, fx1, fy1] = frame;
  const scale = Math.min(width / (fx1 - fx0), height / (fy1 - fy0));
  const ox = (width - (fx1 - fx0) * scale) / 2;
  const oy = (height - (fy1 - fy0) * scale) / 2;
  const depth = new Float32Array(width * height).fill(-Infinity);
  const rgb = new Float32Array(width * height * 3);
  const sl = Math.hypot(...sun);
  const L = view(sun[0] / sl, sun[1] / sl, sun[2] / sl);
  for (const { mesh, texture, alphaTest } of parts) {
    const tex = sampler(texture);
    const V = [];
    const Nv = [];
    for (let i = 0; i < mesh.P.length; i += 3) {
      V.push(view(mesh.P[i], mesh.P[i + 1], mesh.P[i + 2]));
      Nv.push(view(mesh.N[i], mesh.N[i + 1], mesh.N[i + 2]));
    }
    for (let t = 0; t < mesh.I.length; t += 3) {
      const ids = [mesh.I[t], mesh.I[t + 1], mesh.I[t + 2]];
      const p = ids.map((k) => [ox + (V[k][0] - fx0) * scale, height - (oy + (V[k][1] - fy0) * scale), V[k][2]]);
      const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
      if (Math.abs(area) < 1e-9) continue;
      const minX = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0])));
      const maxX = Math.min(width - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
      const minY = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1])));
      const maxY = Math.min(height - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
      for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          const w0 = ((p[1][0] - px) * (p[2][1] - py) - (p[2][0] - px) * (p[1][1] - py)) / area;
          const w1 = ((p[2][0] - px) * (p[0][1] - py) - (p[0][0] - px) * (p[2][1] - py)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * p[0][2] + w1 * p[1][2] + w2 * p[2][2];
          const i = y * width + x;
          if (z <= depth[i]) continue;
          const w = [w0, w1, w2];
          const at = (arr, k, n) => w.reduce((s, ww, j) => s + ww * arr[ids[j] * n + k], 0);
          const s = tex(at(mesh.UV, 0, 2), at(mesh.UV, 1, 2));
          if (alphaTest && s[3] < 0.5) continue;
          depth[i] = z;
          let nx = w.reduce((a, ww, j) => a + ww * Nv[ids[j]][0], 0);
          let ny = w.reduce((a, ww, j) => a + ww * Nv[ids[j]][1], 0);
          let nz = w.reduce((a, ww, j) => a + ww * Nv[ids[j]][2], 0);
          const nl = Math.hypot(nx, ny, nz) || 1;
          [nx, ny, nz] = [nx / nl, ny / nl, nz / nl];
          const shade = ambient + light * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
          for (let k = 0; k < 3; k++) rgb[i * 3 + k] = at(mesh.C, k, 3) * s[k] * shade;
        }
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const hit = depth[i] > -Infinity;
    for (let k = 0; k < 3; k++) data[i * 4 + k] = hit ? srgb(rgb[i * 3 + k]) : background ? background[k] : 0;
    data[i * 4 + 3] = hit || background ? 255 : 0;
  }
  return { data, frame };
}

/**
 * The far stand-in: two crossed upright cards (one along x, one along z), each a picture of the model from that
 * side, packed side by side into one RGBA picture. Returns { mesh (4 triangles, uv into the picture), picture:
 * { data, width, height } }. `size` is one card's picture height in pixels (width half that).
 */
export function crossedImpostor(parts, size, colour = [1, 1, 1]) {
  // One frame for both views (so the cards are the same size): the model's radius round its axis and height.
  let rad = 0;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const { mesh } of parts)
    for (let i = 0; i < mesh.P.length; i += 3) {
      rad = Math.max(rad, Math.abs(mesh.P[i]), Math.abs(mesh.P[i + 2]));
      y0 = Math.min(y0, mesh.P[i + 1]);
      y1 = Math.max(y1, mesh.P[i + 1]);
    }
  const half = rad;
  const w = Math.round(size * Math.min(1, (2 * half) / (y1 - y0)));
  const W = Math.max(8, w - (w % 4));
  const frame = [-half, y0, half, y1];
  const views = [0, 90].map((yaw) => render(parts, { width: W, height: size, yaw, frame }).data);
  const pic = new Uint8Array(W * 2 * size * 4);
  for (let y = 0; y < size; y++)
    for (let v = 0; v < 2; v++)
      for (let x = 0; x < W; x++) {
        const s = (y * W + x) * 4;
        const d = (y * W * 2 + v * W + x) * 4;
        for (let k = 0; k < 4; k++) pic[d + k] = views[v][s + k];
      }
  const mesh = new Mesh();
  const n = [0, 1, 0];
  // Card A faces +Z (seen from yaw 0: from +Z), card B faces +X (yaw 90). glTF uv: v down from the top.
  const quad = (p0, p1, uv0, uv1) => {
    const a = mesh.vertex([p0[0], y0, p0[1]], n, [uv0, 1], colour, [0.3, 0]);
    const b = mesh.vertex([p1[0], y0, p1[1]], n, [uv1, 1], colour, [0.3, 0]);
    const c = mesh.vertex([p1[0], y1, p1[1]], n, [uv1, 0], colour, [0.3, 0]);
    const d = mesh.vertex([p0[0], y1, p0[1]], n, [uv0, 0], colour, [0.3, 0]);
    mesh.quad(a, b, c, d);
  };
  // Seen from +Z, +x is the picture's left; seen from +X, -z is.
  quad([half, 0], [-half, 0], 0, 0.5);
  quad([0, -half], [0, half], 0.5, 1);
  return { mesh, picture: { data: pic, width: W * 2, height: size } };
}
