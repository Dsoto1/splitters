// A small software rasteriser for build-time pictures of a mesh: orthographic,
// z-buffered, one sun and an ambient term, colours per vertex. Used for the
// far-away stand-in of trees (an impostor card, tools/content/nature.mjs) and
// for quick previews of imports. No GPU, no browser.

/**
 * Draw triangles seen from the side (`yaw` degrees round +Y, `pitch` degrees
 * down) into an RGBA image `width` × `height`. `positions` are xyz per corner
 * (three corners a triangle), `colors` linear rgb per corner. The view is fitted
 * to `frame` ([minX, minY, maxX, maxY] in view space) or to the mesh.
 * Returns { data: Uint8Array RGBA (sRGB, alpha 0 where empty), frame }.
 */
export function rasterize(positions, colors, { width, height, yaw = 0, pitch = 0, frame = null, sun = [0.45, 0.8, 0.4], ambient = 0.45, light = 0.7, background = null }) {
  const n = positions.length / 9;
  const cy = Math.cos((yaw * Math.PI) / 180);
  const sy = Math.sin((yaw * Math.PI) / 180);
  const cp = Math.cos((pitch * Math.PI) / 180);
  const sp = Math.sin((pitch * Math.PI) / 180);
  // View space: x right, y up, z toward the viewer.
  const view = (x, y, z) => {
    const x1 = cy * x - sy * z;
    const z1 = sy * x + cy * z;
    return [x1, cp * y - sp * z1, sp * y + cp * z1];
  };
  const V = new Float32Array(n * 9);
  for (let i = 0; i < n * 3; i++) V.set(view(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]), i * 3);
  if (!frame) {
    frame = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n * 3; i++) {
      frame[0] = Math.min(frame[0], V[i * 3]);
      frame[1] = Math.min(frame[1], V[i * 3 + 1]);
      frame[2] = Math.max(frame[2], V[i * 3]);
      frame[3] = Math.max(frame[3], V[i * 3 + 1]);
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
  for (let t = 0; t < n; t++) {
    const p = [0, 1, 2].map((k) => [ox + (V[t * 9 + k * 3] - fx0) * scale, height - (oy + (V[t * 9 + k * 3 + 1] - fy0) * scale), V[t * 9 + k * 3 + 2]]);
    // Face normal in view space; faces are lit from either side (thin leaves).
    const e1 = [0, 1, 2].map((k) => V[t * 9 + 3 + k] - V[t * 9 + k]);
    const e2 = [0, 1, 2].map((k) => V[t * 9 + 6 + k] - V[t * 9 + k]);
    let nx = e1[1] * e2[2] - e1[2] * e2[1];
    let ny = e1[2] * e2[0] - e1[0] * e2[2];
    let nz = e1[0] * e2[1] - e1[1] * e2[0];
    const nl = Math.hypot(nx, ny, nz) || 1;
    [nx, ny, nz] = [nx / nl, ny / nl, nz / nl];
    if (nz < 0) [nx, ny, nz] = [-nx, -ny, -nz];
    const shade = ambient + light * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    const minX = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0])));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
    const minY = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1])));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
    const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
    if (Math.abs(area) < 1e-9) continue;
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
        depth[i] = z;
        for (let k = 0; k < 3; k++) rgb[i * 3 + k] = (w0 * colors[t * 9 + k] + w1 * colors[t * 9 + 3 + k] + w2 * colors[t * 9 + 6 + k]) * shade;
      }
  }
  const data = new Uint8Array(width * height * 4);
  const srgb = (c) => Math.round(255 * Math.min(1, c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055));
  for (let i = 0; i < width * height; i++) {
    const hit = depth[i] > -Infinity;
    for (let k = 0; k < 3; k++) data[i * 4 + k] = hit ? srgb(rgb[i * 3 + k]) : background ? background[k] : 0;
    data[i * 4 + 3] = hit || background ? 255 : 0;
  }
  return { data, frame };
}

/**
 * Fill the empty pixels of an RGBA image with their nearest painted neighbour's
 * colour (alpha left at 0), so mipmaps and filtering of a cut-out don't bleed
 * black round its edges.
 */
export function dilate(data, width, height, passes = 8) {
  for (let pass = 0; pass < passes; pass++) {
    const src = data.slice();
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (src[i * 4 + 3] || src[i * 4] || src[i * 4 + 1] || src[i * 4 + 2]) continue;
        let sum = [0, 0, 0];
        let c = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          const j = yy * width + xx;
          if (!(src[j * 4 + 3] || src[j * 4] || src[j * 4 + 1] || src[j * 4 + 2])) continue;
          sum = sum.map((s, k) => s + src[j * 4 + k]);
          c++;
        }
        if (c) for (let k = 0; k < 3; k++) data[i * 4 + k] = Math.round(sum[k] / c);
      }
  }
  return data;
}
