// The tunnel kit (Tileset 04, Tunnel Systems; docs/map-briefs/tunnels/PLAN_2026-11-13.md): one structural shell a
// shape, and material families applied to it as data.
//
// content/tiles/tunnels.json says what there is: bore `profiles` (the clear opening every family keeps), `families`
// (materials, how the bore is lined, which trim it carries) and `shapes` (which sides of a cell the passage runs to).
// tunnelTiles() makes one kit tile for each family and shape, in the form of content/tiles/core.json's tiles, and
// tools/content/tiles.mjs checks and writes them with the rest of the kit (kitTiles.generated.ts).
//
// What is the same for every family (the structure): the cell, the ports, the collision (floor, the masses either
// side of the passage, the cap, a portal's headwall and wing walls) and the bore (map/groundBore.ts: what the piece
// cuts out of the ground, where it opens it, the rims and cover the earth is brought to). What a family changes: the
// materials on those parts, and the lining and trim drawn in the passage (`trim` parts: drawn, never collided with).
// So movement, shots and bots are the same in a concrete tunnel and, later, a brick sewer of the same shape.

const SIDES = ['N', 'E', 'S', 'W'];
const r3 = (v) => Math.round(v * 1000) / 1000;

/** A box [x0, y0, z0, x1, y1, z1] turned `turns` quarter turns clockwise seen from above (N to E), as tiles turn. */
function turnBox(b, turns) {
  let [x0, y0, z0, x1, y1, z1] = b;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) [x0, z0, x1, z1] = [z0, -x0, z1, -x1];
  return [r3(Math.min(x0, x1)), y0, r3(Math.min(z0, z1)), r3(Math.max(x0, x1)), y1, r3(Math.max(z0, z1))];
}

/**
 * The parts of one module. `arms`: the sides its passage runs to. `mouth`: the side a portal opens to the sky.
 * Everything is written for the north arm (z from the passage's half-width to the cell's edge) and turned to the
 * others, so every shape is the same cross-section.
 */
function moduleParts(profile, family, shape) {
  const { half: w, clear, cap } = profile;
  const m = family.materials;
  const lining = family.lining ?? {};
  const trim = family.trim ?? {};
  const surf = (material, tint) => ({ surface: tint ? { material, tint } : { material } });
  const solids = [];
  const trims = [];
  const solid = (box, material, kind = 'wall') => solids.push({ box: box.map(r3), kind, ...surf(material) });
  const draw = (box, material, tint) => trims.push({ box: box.map(r3), kind: 'trim', ...surf(material, tint) });
  const arms = new Set(shape.arms);
  const mouth = shape.mouth ?? null;
  const E = 4;

  // --- the shell: the four corner masses, a mass in each closed arm, the cap. The same for every family.
  for (let k = 0; k < 4; k++) solid(turnBox([w, 0, w, E, clear, E], k), m.wall);
  for (const [k, side] of SIDES.entries()) {
    if (arms.has(side) || side === mouth) continue;
    solid(turnBox([-w, 0, w, w, clear, E], k), m.wall);
  }

  // --- the lining and trim of a wall: the stretch of the wall at x = sx × half the width, from z = `from` to `to`,
  // in the north arm's frame turned k quarter turns.
  const wallTrim = (k, sx, from, to) => {
    const put = (b, material, tint) => draw(turnBox(b, k), material, tint);
    const face = (d) => [Math.min(sx * w, sx * (w - d)), Math.max(sx * w, sx * (w - d))];
    // A plinth along the wall.
    if (trim.plinth) put([face(0.04)[0], 0, from, face(0.04)[1], trim.plinth, to], m.trim);
    // The cast downstand where wall meets soffit (a flat-soffit lining's haunch).
    if (lining.haunch) put([face(lining.haunch)[0], clear - lining.haunch, from, face(lining.haunch)[1], clear, to], m.soffit);
    // Panel joints: a thin rib up the wall every `joints` metres.
    if (lining.joints) for (let z = from + lining.joints / 2; z < to - 0.05; z += lining.joints) put([face(0.015)[0], trim.plinth ?? 0, z - 0.02, face(0.015)[1], clear - (lining.haunch ?? 0), z + 0.02], m.trim);
  };
  // An open arm: both its walls from the middle square out to the cell's edge, the joints carried across the soffit,
  // and the drain down the middle of the floor from the cell's centre.
  const armTrim = (k, from, to) => {
    for (const sx of [-1, 1]) wallTrim(k, sx, from, to);
    if (lining.joints) for (let z = from + lining.joints / 2; z < to - 0.05; z += lining.joints) draw(turnBox([-(w - (lining.haunch ?? 0)), clear - 0.015, z - 0.02, w - (lining.haunch ?? 0), clear, z + 0.02], k), m.trim);
    if (trim.drain) draw(turnBox([-trim.drain.width / 2, 0, 0, trim.drain.width / 2, 0.02, to], k), trim.drain.material);
  };
  for (const [k, side] of SIDES.entries()) if (arms.has(side)) armTrim(k, w, E);
  // The middle square: a wall only on a closed side (the east side's wall is the north frame's east wall, and so on).
  if (!mouth) {
    if (!arms.has('E')) wallTrim(0, 1, -w, w);
    if (!arms.has('W')) wallTrim(0, -1, -w, w);
    if (!arms.has('N')) wallTrim(1, -1, -w, w);
    if (!arms.has('S')) wallTrim(1, 1, -w, w);
  }

  // --- a pipe run on the west wall of a passage that runs straight through north to south (or to a dead end or a mouth).
  const through = arms.has('N') && !arms.has('E') && !arms.has('W');
  if (trim.pipe && through) {
    const p = trim.pipe;
    const z0 = arms.has('S') ? -E : mouth === 'S' ? shape.headwall.at + shape.headwall.t / 2 : -w;
    draw([-w + 0.05, p.y - p.r, z0, -w + 0.05 + 2 * p.r, p.y + p.r, E], p.material, p.tint);
    for (let z = Math.ceil(z0) + 0.5; z < E; z += 2) draw([-w, p.y - p.r - 0.05, z - 0.05, -w + 0.07 + 2 * p.r, p.y + p.r + 0.05, z + 0.05], m.trim);
  }

  // --- the strip light at the crown, one a module: a housing and a glowing tube (a glowing material, not a light entity).
  if (trim.light) {
    const l = trim.light;
    const along = through || !arms.has('N') ? 0 : 1;
    const at = mouth === 'S' ? 2.2 : 0;
    const box = (hw, hl, y0, y1) => (along === 0 ? [-hw, y0, at - hl, hw, y1, at + hl] : [-hl, y0, at - hw, hl, y1, at + hw]);
    draw(box(0.14, l.length / 2 + 0.08, clear - 0.05, clear), m.trim);
    draw(box(0.06, l.length / 2, clear - 0.1, clear - 0.05), l.material, l.tint);
  }

  // --- a dead end's service door on its end wall (drawn only).
  if (shape.door && trim.door) {
    const k = SIDES.indexOf(shape.door);
    draw(turnBox([-0.62, 0, w - 0.06, 0.62, 2.14, w], k), m.trim);
    draw(turnBox([-0.55, 0, w - 0.09, 0.55, 2.07, w - 0.06], k), trim.door.material, trim.door.tint);
    draw(turnBox([-0.55, 0.9, w - 0.11, 0.55, 1.12, w - 0.09], k), trim.hazard ?? trim.door.material);
  }

  // (Cover: a hand of earth over the cap, 0.1 m: a level under new flat ground, which lies 0.15 m under a level, that is the ground as it is.)
  const bore = { cut: [[-E, -0.5, -E, E, cap, E]], cover: [[-E, -E, E, E, r3(cap + 0.1)]] };
  let capBox = [-E, clear, -E, E, cap, E];

  // --- a portal: the passage's last stretch, a headwall across the cell and an apron between wing walls.
  if (mouth) {
    if (mouth !== 'S' || !arms.has('N') || arms.size !== 1) throw new Error(`tunnel kit: ${shape.id}: a portal runs north and opens south`);
    const h = shape.headwall;
    const g = shape.wings;
    const front = h.at - h.t / 2;
    const back = h.at + h.t / 2;
    // The masses and cap stop at the headwall's back; the corner masses on the mouth's side go.
    solids.length = 0;
    for (const sx of [-1, 1]) solid([Math.min(sx * w, sx * E), 0, back, Math.max(sx * w, sx * E), clear, E], m.wall);
    capBox = [-E, clear, back, E, cap, E];
    // The lining of the stretch behind the headwall replaces the full north arm's.
    trims.length = 0;
    armTrimFrom(back);
    // The headwall: a pier either side of the opening, the lintel over it, a coping.
    for (const sx of [-1, 1]) solid([Math.min(sx * w, sx * E), 0, front, Math.max(sx * w, sx * E), h.top, back], m.headwall);
    solid([-w, clear, front, w, h.top, back], m.headwall);
    solid([-E, h.top, front - 0.12, E, h.top + 0.2, back + 0.12], m.trim);
    // A lintel band, and the hazard band on each jamb, on the headwall's face.
    draw([-w - 0.3, clear, front - 0.04, w + 0.3, clear + 0.4, front], m.trim);
    if (trim.hazard) for (const sx of [-1, 1]) draw([Math.min(sx * w, sx * (w + 0.9)), 0, front - 0.03, Math.max(sx * w, sx * (w + 0.9)), 1.0, front], trim.hazard);
    // The apron's drain runs out to the edge.
    if (trim.drain) draw([-trim.drain.width / 2, 0, -E, trim.drain.width / 2, 0.02, back], trim.drain.material);
    // The wing walls: a low wall and an end pier, stepped masonry hidden under a coping slab that slopes from the
    // headwall down to the pier (one tilted box: pitch lifts its +z end).
    const run = front - g.foot;
    const rise = g.top - g.low;
    const a = Math.atan2(rise, run);
    const len = Math.hypot(run, rise);
    const T = g.slab;
    // The slab's top runs from (z = front, y = top) to (z = foot, y = low + 0.05); its centre is half its thickness under the middle of that line.
    const cz = (front + g.foot) / 2 + (T / 2) * Math.sin(a);
    const cy = (g.top + g.low + 0.05) / 2 - (T / 2) * Math.cos(a);
    for (const sx of [-1, 1]) {
      const x0 = Math.min(sx * (E - g.t), sx * E);
      const x1 = Math.max(sx * (E - g.t), sx * E);
      solid([x0, 0, -E, x1, g.low, front], m.headwall);
      // Hidden steps under the slab, so no gap shows beneath it.
      const steps = 3;
      for (let i = 1; i <= steps; i++) {
        const zLow = front - (run * (steps + 1 - i)) / (steps + 1);
        const topAtLow = g.low + (rise * (zLow - g.foot)) / run;
        solid([x0, g.low, zLow, x1, topAtLow - 0.12, front], m.headwall);
      }
      solids.push({ box: [x0 - (sx < 0 ? 0 : 0.02), cy - T / 2, cz - len / 2, x1 + (sx < 0 ? 0.02 : 0), cy + T / 2, cz + len / 2].map(r3), kind: 'wall', pitch: r3(a), ...surf(m.headwall) });
    }
    bore.cut = [
      [-E, -0.5, front, E, cap, E],
      [-E, -0.5, -E, E, 1000, front],
    ];
    bore.cover = [[-E, back, E, E, r3(cap + 0.1)]];
    // (A line along the cell's south edge: the ground in front of it is the way in.)
    bore.open = [[-(E - g.t), 0, -E, E - g.t, 4, -E]];
    bore.out = 'S';
    bore.rim = [
      { line: [-E, front, E, front], y: [r3(h.top - 0.1), r3(h.top - 0.1)], mode: 'lower' },
      ...[-1, 1].flatMap((sx) => [
        { line: [sx * E, front, sx * E, g.foot], y: [r3(g.top - 0.15), r3(g.low - 0.1)], mode: 'both' },
        { line: [sx * E, g.foot, sx * E, -E], y: [r3(g.low - 0.1), r3(g.low - 0.1)], mode: 'both' },
      ]),
    ];
  }
  function armTrimFrom(from) {
    armTrim(0, from, E);
    if (trim.pipe) {
      const p = trim.pipe;
      draw([-w + 0.05, p.y - p.r, from, -w + 0.05 + 2 * p.r, p.y + p.r, E], p.material, p.tint);
    }
    if (trim.light) {
      const l = trim.light;
      draw([-0.14, clear - 0.05, 2.2 - l.length / 2 - 0.08, 0.14, clear, 2.2 + l.length / 2 + 0.08], m.trim);
      draw([-0.06, clear - 0.1, 2.2 - l.length / 2, 0.06, clear - 0.05, 2.2 + l.length / 2], l.material, l.tint);
    }
  }

  solid(capBox, m.soffit);
  return { solids: [...solids, ...trims], floor: { box: [-E, -0.5, -E, E, 0, E], ...surf(m.floor) }, bore };
}

/** Every tunnel tile: one for each family and shape, as content/tiles/core.json's tiles (with `notes`). */
export function tunnelTiles(data) {
  const out = [];
  for (const [fid, family] of Object.entries(data.families ?? {})) {
    for (const shape of data.shapes ?? []) {
      const profile = data.profiles?.[shape.profile ?? 'S'];
      if (!profile) throw new Error(`tunnel kit: ${shape.id}: no profile ${shape.profile ?? 'S'}`);
      const parts = moduleParts(profile, family, shape);
      const ports = [...shape.arms, ...(shape.mouth ? [shape.mouth] : [])].map((side) => ({ side, level: 0 }));
      out.push({
        id: `core.tunnel_${fid}_${shape.id}`,
        category: 'Tunnels',
        displayName: `${family.label} ${shape.name}`.trim(),
        blurb: `${shape.blurb} ${family.blurb}`,
        cells: [[0, 0, 0]],
        floors: [],
        ports,
        edgeDefault: 'open',
        extraFloors: [parts.floor],
        solids: parts.solids,
        bore: parts.bore,
        notes: {
          design: `Tileset 04, Tunnel Systems (docs/map-briefs/tunnels/PLAN_2026-11-13.md): generated by tools/content/kit/tunnel.mjs from content/tiles/tunnels.json, the ${shape.id} shape in the ${fid} family. The shell (floor, masses, cap${shape.mouth ? ', headwall, wing walls' : ''}), the ports and the bore are the shape's; the materials, lining and trim are the family's.`,
        },
      });
    }
  }
  return out;
}
