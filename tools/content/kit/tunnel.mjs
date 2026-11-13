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
const TWELFTHS = [Math.round((Math.PI / 6) * 1000) / 1000, Math.round((Math.PI / 3) * 1000) / 1000];
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
  if (trim.pipe && through && !shape.hatch) {
    const p = trim.pipe;
    const z0 = arms.has('S') ? -E : mouth === 'S' ? shape.headwall.at + shape.headwall.t / 2 : -w;
    draw([-w + 0.05, p.y - p.r, z0, -w + 0.05 + 2 * p.r, p.y + p.r, E], p.material, p.tint);
    // The same bar turned a twelfth and a sixth about its run: twelve sides, which reads as round at this size.
    for (const roll of TWELFTHS) trims.push({ box: [-w + 0.05, p.y - p.r, z0, -w + 0.05 + 2 * p.r, p.y + p.r, E].map(r3), kind: 'trim', roll, ...surf(p.material, p.tint) });
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
    // (A line along the cell's south edge, the cell's whole width: the ground in front of it is the way in. Between
    // the wing walls' ends too: earth standing there would end in a cut edge at the apron, open to the underside.)
    bore.open = [[-E, 0, -E, E, 4, -E]];
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
      for (const roll of TWELFTHS) trims.push({ box: [-w + 0.05, p.y - p.r, from, -w + 0.05 + 2 * p.r, p.y + p.r, E].map(r3), kind: 'trim', roll, ...surf(p.material, p.tint) });
    }
    if (trim.light) {
      const l = trim.light;
      draw([-0.14, clear - 0.05, 2.2 - l.length / 2 - 0.08, 0.14, clear, 2.2 + l.length / 2 + 0.08], m.trim);
      draw([-0.06, clear - 0.1, 2.2 - l.length / 2, 0.06, clear - 0.05, 2.2 + l.length / 2], l.material, l.tint);
    }
  }

  // --- a shaft: a hatch in the cap against the west wall (a ladder stands on that wall: the set piece's), a kerb on
  // its other three sides, its lid standing open, and the ground brought level to it.
  if (shape.hatch) {
    const [hx0, hz0, hx1, hz1] = shape.hatch;
    const top = r3(cap + 0.1);
    solid([-E, clear, -E, E, cap, hz0], m.soffit);
    solid([-E, clear, hz1, E, cap, E], m.soffit);
    solid([-E, clear, hz0, hx0, cap, hz1], m.soffit);
    solid([hx1, clear, hz0, E, cap, hz1], m.soffit);
    const k = 0.15;
    solid([hx0, cap, hz0 - k, hx1 + k, top + 0.2, hz0], m.trim);
    solid([hx0, cap, hz1, hx1 + k, top + 0.2, hz1 + k], m.trim);
    solid([hx1, cap, hz0, hx1 + k, top + 0.2, hz1], m.trim);
    solids.push({ box: [hx1 + k, top, hz0, hx1 + k + 0.06, top + (hx1 - hx0) * 0.9, hz1].map(r3), kind: 'wall', ...surf((trim.door ?? {}).material ?? m.trim) });
    // Rungs' backing down the west wall, so the ladder reads as fixed to something.
    draw([hx0, 0, hz0 + 0.2, hx0 + 0.03, cap, hz1 - 0.2], m.trim);
    bore.cut.push([hx0, cap, hz0, hx1, 1000, hz1]);
    bore.rim = [
      { line: [hx0, hz0 - k, hx1 + k, hz0 - k], y: [top, top], mode: 'both' },
      { line: [hx0, hz1 + k, hx1 + k, hz1 + k], y: [top, top], mode: 'both' },
      { line: [hx0, hz0 - k, hx0, hz1 + k], y: [top, top], mode: 'both' },
      { line: [hx1 + k, hz0 - k, hx1 + k, hz1 + k], y: [top, top], mode: 'both' },
    ];
  } else solid(capBox, m.soffit);
  return { solids: [...solids, ...trims], floor: { box: [-E, -0.5, -E, E, 0, E], ...surf(m.floor) }, bore };
}

/**
 * The pieces that are more than one cell or level: `kind` says which.
 *  - flight: the passage climbs one level over the cell, south (low) to north (a level up), on steps or a ramp
 *    (`floor`); the soffit climbs with it, and so do the cut and the cover (the bore follows the floor).
 *  - descent: the same flight open to the sky between low walls: the way down from flat ground to a tunnel a level
 *    under it. The ground is brought level to its walls and to its top step.
 *  - riser: a well joining a passage (south) to one a level up (north). A ladder stands on the well's north wall
 *    (the set piece's).
 *  - chamber: a room of 2 x 2 cells, an opening the size of the passage on each side.
 * Returns the tile's cells and ports too.
 */
function specialParts(profile, family, shape) {
  const { half: w, clear, cap } = profile;
  const m = family.materials;
  const lining = family.lining ?? {};
  const trim = family.trim ?? {};
  const surf = (material, tint) => ({ surface: tint ? { material, tint } : { material } });
  const solids = [];
  const trims = [];
  const solid = (box, material, kind = 'wall') => solids.push({ box: box.map(r3), kind, ...surf(material) });
  const draw = (box, material, tint, tilt = {}) => trims.push({ box: box.map(r3), kind: 'trim', ...tilt, ...surf(material, tint) });
  const E = 4;
  const L = 4; // a level
  const T = r3(cap - clear);
  const cover = (y) => r3(y + 0.1);

  if (shape.kind === 'flight' || shape.kind === 'descent') {
    const open = shape.kind === 'descent';
    const a = Math.atan2(L, 2 * E);
    const len = Math.hypot(2 * E, L);
    const tilt = { pitch: r3(a) };
    // The floor: 16 steps of 0.25 m, or a slab at 1 in 2.
    if (shape.floor === 'ramp') {
      const t = 0.5;
      solids.push({ box: [-w, L / 2 - (t / 2) * Math.cos(a) - t / 2, (t / 2) * Math.sin(a) - len / 2, w, L / 2 - (t / 2) * Math.cos(a) + t / 2, (t / 2) * Math.sin(a) + len / 2].map(r3), kind: 'solid', ...tilt, ...surf(m.floor) });
      // (Its low end comes to a point over the floor; the tile's floor is under it.)
    } else solids.push({ flight: { axis: 'z', dir: 1, from: -E, across: [-w, w], steps: 16 }, ...surf(m.floor) });
    // A handrail on each wall, following the flight.
    for (const sx of [-1, 1]) draw([sx * (w - 0.1) - 0.03, L / 2 + 0.95, -len / 2, sx * (w - 0.1) + 0.03, L / 2 + 1.01, len / 2], m.trim, undefined, tilt);
    const bore = {};
    if (open) {
      // Low walls either side, a parapet over the ground; a lintel over the way into the tunnel.
      const wt = 0.4;
      const ground = cover(cap);
      const top = r3(L + 0.45);
      for (const sx of [-1, 1]) solid([Math.min(sx * w, sx * (w + wt)), 0, -E, Math.max(sx * w, sx * (w + wt)), top, E], m.headwall);
      solid([-w, clear, -E, w, top, -E + wt], m.headwall);
      draw([-w, clear, -E + wt, w, clear + 0.4, -E + wt + 0.04], m.trim);
      if (trim.hazard) for (const sx of [-1, 1]) draw([Math.min(sx * w, sx * (w - 0.03)), 0, -E + wt, Math.max(sx * w, sx * (w - 0.03)), 1.0, -E + wt + 0.9], trim.hazard);
      bore.sky = true;
      bore.cut = [[-(w + wt), -0.5, -E, w + wt, 1000, E]];
      bore.rim = [
        { line: [-(w + wt), -E, -(w + wt), E], y: [ground, ground], mode: 'both' },
        { line: [w + wt, -E, w + wt, E], y: [ground, ground], mode: 'both' },
        { line: [-(w + wt), -E, w + wt, -E], y: [ground, ground], mode: 'both' },
        { line: [-w, E, w, E], y: [r3(L - 0.05), r3(L - 0.05)], mode: 'both' },
      ];
    } else {
      // The walls and the earth cut and kept in four stretches, each as high as the soffit at its upper end.
      bore.cut = [];
      bore.cover = [];
      for (let j = 0; j < 4; j++) {
        const z0 = -E + 2 * j;
        const top = clear + (j + 1) + T;
        for (const sx of [-1, 1]) solid([Math.min(sx * w, sx * E), 0, z0, Math.max(sx * w, sx * E), Math.min(top, L + clear), z0 + 2], m.wall);
        bore.cut.push([-E, j - 0.5, z0, E, r3(Math.min(top, L + cap)), z0 + 2].map(r3));
        bore.cover.push([-E, z0, E, z0 + 2, cover(Math.min(top, L + cap))]);
      }
      // The soffit climbs with the floor: one slab, its underside from the low passage's soffit to the high one's.
      const cy = L / 2 + clear + (T / 2) * Math.cos(a);
      const cz = -(T / 2) * Math.sin(a);
      solids.push({ box: [-E, cy - T / 2, cz - len / 2, E, cy + T / 2, cz + len / 2].map(r3), kind: 'wall', ...tilt, ...surf(m.soffit) });
      if (lining.haunch) for (const sx of [-1, 1]) draw([Math.min(sx * w, sx * (w - lining.haunch)), L / 2 + clear - lining.haunch - 0.02, -len / 2, Math.max(sx * w, sx * (w - lining.haunch)), L / 2 + clear - 0.02, len / 2], m.soffit, undefined, tilt);
      if (trim.light) {
        const l = trim.light;
        draw([-0.14, L / 2 + clear - 0.09, -l.length / 2 - 0.08, 0.14, L / 2 + clear - 0.03, l.length / 2 + 0.08], m.trim, undefined, tilt);
        draw([-0.06, L / 2 + clear - 0.14, -l.length / 2, 0.06, L / 2 + clear - 0.09, l.length / 2], l.material, l.tint, tilt);
      }
    }
    bore.plan = [[-w, -E, -w, E], [w, -E, w, E]];
    return { cells: [[0, 0, 0], [0, 0, 1]], ports: [{ side: 'S', level: 0 }, { side: 'N', level: 1 }], solids: [...solids, ...trims], floors: [{ box: [-E, -0.5, -E, E, 0, E], ...surf(m.floor) }], bore };
  }

  if (shape.kind === 'riser') {
    const top = L + clear;
    for (const sx of [-1, 1]) solid([Math.min(sx * w, sx * E), 0, -E, Math.max(sx * w, sx * E), top, E], m.wall);
    // Over the low passage, and under the high one.
    solid([-w, clear, -E, w, top, -w], m.wall);
    solid([-w, 0, w, w, L - 0.5, E], m.wall);
    solid([-E, top, -E, E, top + T, E], m.soffit);
    for (const sx of [-1, 1]) {
      if (trim.plinth) draw([Math.min(sx * w, sx * (w - 0.04)), 0, -E, Math.max(sx * w, sx * (w - 0.04)), trim.plinth, w], m.trim);
      if (trim.plinth) draw([Math.min(sx * w, sx * (w - 0.04)), L, w, Math.max(sx * w, sx * (w - 0.04)), L + trim.plinth, E], m.trim);
      if (lining.haunch) draw([Math.min(sx * w, sx * (w - lining.haunch)), top - lining.haunch, -w, Math.max(sx * w, sx * (w - lining.haunch)), top, E], m.soffit);
    }
    // The ladder's backing up the well's north wall, and a kerb's line at the upper floor's edge.
    draw([-0.5, 0, w - 0.03, 0.5, L, w], m.trim);
    if (trim.hazard) draw([-w, L, w, w, L + 0.02, w + 0.3], trim.hazard);
    if (trim.light) {
      const l = trim.light;
      draw([-0.14, top - 0.05, -l.length / 2 - 0.08, 0.14, top, l.length / 2 + 0.08], m.trim);
      draw([-0.06, top - 0.1, -l.length / 2, 0.06, top - 0.05, l.length / 2], l.material, l.tint);
      draw([-0.14, clear - 0.05, -3 - l.length / 4, 0.14, clear, -3 + l.length / 4], m.trim);
      draw([-0.06, clear - 0.1, -3 - l.length / 4 + 0.05, 0.06, clear - 0.05, -3 + l.length / 4 - 0.05], l.material, l.tint);
    }
    const bore = { cut: [[-E, -0.5, -E, E, r3(top + T), E]], cover: [[-E, -E, E, E, cover(top + T)]], plan: [[-w, -E, -w, E], [w, -E, w, E], [-w, w, w, w], [-w, -w, w, -w]] };
    return {
      cells: [[0, 0, 0], [0, 0, 1]],
      ports: [{ side: 'S', level: 0 }, { side: 'N', level: 1 }],
      solids: [...solids, ...trims],
      floors: [{ box: [-E, -0.5, -E, E, 0, E], ...surf(m.floor) }, { box: [-w, L - 0.5, w, w, L, E], ...surf(m.floor) }],
      bore,
    };
  }

  if (shape.kind === 'chamber') {
    const wt = shape.wall ?? 1;
    const lo = -E;
    const hi = 3 * E;
    // The four sides, each with the passage's opening in the middle of one cell's edge: south and west in cell (0, 0),
    // north in (0, 1), east in (1, 0), so a passage runs straight through along the room's south and west sides.
    const gaps = { S: 0, N: 0, W: 0, E: 0 };
    const plan = [];
    const side = (name, along) => {
      const g = gaps[name];
      const outer = name === 'S' || name === 'W' ? lo : hi;
      const inner = name === 'S' || name === 'W' ? lo + wt : hi - wt;
      const [d0, d1] = [Math.min(outer, inner), Math.max(outer, inner)];
      for (const [a0, a1] of [[lo, g - w], [g + w, hi]]) {
        solid(along === 'x' ? [a0, 0, d0, a1, clear, d1] : [d0, 0, a0, d1, clear, a1], m.wall);
        const [t0, t1] = [Math.max(a0, lo + wt), Math.min(a1, hi - wt)];
        const f = name === 'S' || name === 'W' ? [inner, inner + 0.04] : [inner - 0.04, inner];
        const h = name === 'S' || name === 'W' ? [inner, inner + (lining.haunch ?? 0)] : [inner - (lining.haunch ?? 0), inner];
        if (trim.plinth) draw(along === 'x' ? [t0, 0, f[0], t1, trim.plinth, f[1]] : [f[0], 0, t0, f[1], trim.plinth, t1], m.trim);
        if (lining.haunch) draw(along === 'x' ? [t0, clear - lining.haunch, h[0], t1, clear, h[1]] : [h[0], clear - lining.haunch, t0, h[1], clear, t1], m.soffit);
        plan.push(along === 'x' ? [t0, inner, t1, inner] : [inner, t0, inner, t1]);
      }
      for (const s of [-1, 1]) plan.push(along === 'x' ? [g + s * w, outer, g + s * w, inner] : [outer, g + s * w, inner, g + s * w]);
    };
    side('S', 'x');
    side('N', 'x');
    side('W', 'z');
    side('E', 'z');
    for (const [cx, cz] of shape.columns ?? []) {
      solid([cx - 0.4, 0, cz - 0.4, cx + 0.4, clear, cz + 0.4], m.wall);
      draw([cx - 0.5, 0, cz - 0.5, cx + 0.5, trim.plinth ?? 0.3, cz + 0.5], m.trim);
      draw([cx - 0.5, clear - 0.25, cz - 0.5, cx + 0.5, clear, cz + 0.5], m.trim);
    }
    solid([lo, clear, lo, hi, cap, hi], m.soffit);
    if (trim.drain) {
      const d = trim.drain.width / 2;
      draw([-d, 0, lo, d, 0.02, hi], trim.drain.material);
      draw([lo, 0, -d, hi, 0.02, d], trim.drain.material);
    }
    if (trim.light) {
      const l = trim.light;
      for (const [x, z] of [[E, 0.5], [E, 2 * E - 0.5], [0.5, E], [2 * E - 0.5, E], [E, E]]) {
        draw([x - 0.14, clear - 0.05, z - l.length / 2 - 0.08, x + 0.14, clear, z + l.length / 2 + 0.08], m.trim);
        draw([x - 0.06, clear - 0.1, z - l.length / 2, x + 0.06, clear - 0.05, z + l.length / 2], l.material, l.tint);
      }
    }
    const bore = { cut: [[lo, -0.5, lo, hi, cap, hi]], cover: [[lo, lo, hi, hi, cover(cap)]], plan: plan.map((q) => q.map(r3)) };
    return {
      cells: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
      ports: [{ side: 'S', level: 0, cell: [0, 0] }, { side: 'W', level: 0, cell: [0, 0] }, { side: 'N', level: 0, cell: [0, 1] }, { side: 'E', level: 0, cell: [1, 0] }],
      solids: [...solids, ...trims],
      floors: [{ box: [lo, -0.5, lo, hi, 0, hi], ...surf(m.floor) }],
      bore,
    };
  }
  throw new Error(`tunnel kit: ${shape.id}: no kind ${shape.kind}`);
}

/** Every tunnel tile: one for each family and shape, as content/tiles/core.json's tiles (with `notes`). */
export function tunnelTiles(data) {
  const out = [];
  // The first family is the shapes' own (the tile MapMaker's palette shows); the others are reached by a placed
  // piece's `family` (map format v37), or by their own tile ids.
  const first = Object.keys(data.families ?? {})[0];
  for (const [fid, family] of Object.entries(data.families ?? {})) {
    for (const shape of data.shapes ?? []) {
      const profile = data.profiles?.[shape.profile ?? 'S'];
      if (!profile) throw new Error(`tunnel kit: ${shape.id}: no profile ${shape.profile ?? 'S'}`);
      const special = shape.kind ? specialParts(profile, family, shape) : null;
      const parts = special ?? moduleParts(profile, family, shape);
      const ports = special?.ports ?? [...shape.arms, ...(shape.mouth ? [shape.mouth] : [])].map((side) => ({ side, level: 0 }));
      out.push({
        id: `core.tunnel_${fid}_${shape.id}`,
        category: 'Tunnels',
        displayName: `${family.label} ${shape.name}`.trim(),
        blurb: `${shape.blurb} ${family.blurb}`,
        cells: special?.cells ?? [[0, 0, 0]],
        floors: [],
        ports,
        edgeDefault: 'open',
        familyOf: { base: `core.tunnel_${first}_${shape.id}`, family: fid, label: `${family.label.replace(/ Tunnel$/, '')}${family.preview ? ' (preview)' : ''}` },
        extraFloors: special?.floors ?? [parts.floor],
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
