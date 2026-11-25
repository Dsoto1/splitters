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
const EIGHTHS = [0, 1, 2, 3].map((i) => Math.round(((i * Math.PI) / 4) * 1000) / 1000);
const r3 = (v) => Math.round(v * 1000) / 1000;
/**
 * The places from `from` to `to` (short of `to` by `margin`) on a beat of `every` m kept on the cell's lattice: half a
 * beat past a multiple of it (every is a whole fraction of the 8 m cell), so a joint, a set or a sleeper falls in the
 * same place in every piece and on across their joints (seamless tunnels), whichever arm or piece it is in.
 */
const beat = (from, to, every, margin = 0.05) => {
  const out = [];
  for (let z = Math.ceil((from - every / 2) / every - 1e-9) * every + every / 2; z < to - margin; z += every) out.push(r3(z));
  return out;
};

/** A seeded random number generator (mulberry32): the same rock for the same shape every build. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashOf = (text) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

/**
 * The passage's rock profile (a cave): a squircle from the floor at one wall over the crown to the other, so the
 * walls stand nearly upright to head height and the rock comes in no more than `depth` past them (a player walking
 * a body's width off the line never meets it). `segs` points along it, [x, y] each.
 */
function rockProfile(w, clear, segs) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const th = (i * Math.PI) / segs;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    pts.push([Math.sign(c) * w * Math.abs(c) ** (2 / 3), clear * Math.abs(sn) ** (2 / 3)]);
  }
  return pts;
}

/** A box [x0, y0, z0, x1, y1, z1] turned `turns` quarter turns clockwise seen from above (N to E), as tiles turn. */
function turnBox(b, turns) {
  let [x0, y0, z0, x1, y1, z1] = b;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) [x0, z0, x1, z1] = [z0, -x0, z1, -x1];
  return [r3(Math.min(x0, x1)), y0, r3(Math.min(z0, z1)), r3(Math.max(x0, x1)), y1, r3(Math.max(z0, z1))];
}

/**
 * A segmental arch spanning a passage `w` either side of its line, springing at `spring` and rising to the crown at
 * `crown`: the slabs that line it (`segs` voussoir slabs `t` thick, each a box centred `x`, `y` across the passage and
 * rolled to lie along the curve) and the stepped boxes that fill the corners over it to the shell (`spandrels`, from
 * x out to the wall), for a face where the arch ends.
 */
function archOf(w, { spring, t = 0.25, segs = 9, steps = 6 }, crown) {
  const rise = crown - spring;
  const R = (w * w + rise * rise) / (2 * rise);
  const yc = crown - R;
  const a0 = Math.acos(w / R);
  const span = Math.PI - 2 * a0;
  const slabs = [];
  for (let i = 0; i < segs; i++) {
    const am = a0 + ((i + 0.5) * span) / segs;
    const half = R * Math.sin(span / segs / 2) + 0.03;
    const rc = R * Math.cos(span / segs / 2) + t / 2;
    // `tex`: where the slab lies along the arch (its inner edge meets the next one's), so the brick runs on across the
    // slabs (map/faces.ts flatOf). A slab's own +x points back down the arch, hence the sign.
    const tex = r3(-(i - (segs - 1) / 2) * 2 * R * Math.sin(span / segs / 2));
    slabs.push({ x: rc * Math.cos(am), y: yc + rc * Math.sin(am), half, roll: am - Math.PI / 2, tex });
  }
  const spandrels = [];
  for (let j = 0; j < steps; j++) {
    const y0 = spring + (j * rise) / steps;
    const y1 = spring + ((j + 1) * rise) / steps;
    const ym = (y0 + y1) / 2;
    spandrels.push({ x: Math.sqrt(Math.max(0, R * R - (ym - yc) ** 2)), y0, y1 });
  }
  return { t, slabs, spandrels };
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
  // A box written in the north arm's frame and rolled about the passage's line (its +X side lifted by `roll`), turned
  // k quarter turns: its centre turns and a yaw carries the turn, as a turned tile's tilted boxes do (geometry.ts).
  const drawRolled = (k, [x0, y0, z0, x1, y1, z1], roll, material, tint, tex) => {
    const t = roll && tex !== undefined ? { tex } : {};
    if (!k) return trims.push({ box: [x0, y0, z0, x1, y1, z1].map(r3), kind: 'trim', ...(roll ? { roll: r3(roll) } : {}), ...t, ...surf(material, tint) });
    const [tx, , tz] = turnBox([(x0 + x1) / 2, 0, (z0 + z1) / 2, (x0 + x1) / 2, 0, (z0 + z1) / 2], k);
    const hx = (x1 - x0) / 2;
    const hz = (z1 - z0) / 2;
    trims.push({ box: [tx - hx, y0, tz - hz, tx + hx, y1, tz + hz].map(r3), kind: 'trim', yaw: r3((k * Math.PI) / 2), ...(roll ? { roll: r3(roll) } : {}), ...t, ...surf(material, tint) });
  };
  // The passage runs on one line, north–south (a straight, a dead end, a portal, a shaft): its lining runs through
  // the middle square too. At a junction or a curve each arm is lined from the middle square out.
  const line = !arms.has('E') && !arms.has('W');
  const arch = lining.arch ? archOf(w, lining.arch, clear) : null;

  // --- the shell: the four corner masses, a mass in each closed arm, the cap. The same for every family.
  for (let k = 0; k < 4; k++) solid(turnBox([w, 0, w, E, clear, E], k), m.wall);
  for (const [k, side] of SIDES.entries()) {
    if (arms.has(side) || side === mouth) continue;
    solid(turnBox([-w, 0, w, w, clear, E], k), m.wall);
  }

  // --- the lining and trim of a wall: the stretch of the wall at x = sx × half the width, from z = `from` to `to`,
  // in the north arm's frame turned k quarter turns.
  const wallTrim = (k, sx, from, to, arched = false) => {
    const put = (b, material, tint) => draw(turnBox(b, k), material, tint);
    const face = (d) => [Math.min(sx * w, sx * (w - d)), Math.max(sx * w, sx * (w - d))];
    // A plinth along the wall.
    if (trim.plinth) put([face(0.04)[0], 0, from, face(0.04)[1], trim.plinth, to], m.trim);
    // The cast downstand where wall meets soffit (a flat-soffit lining's haunch; an arched stretch has its arch).
    if (lining.haunch && !arched) put([face(lining.haunch)[0], clear - lining.haunch, from, face(lining.haunch)[1], clear, to], m.soffit);
    // A raised walkway along the wall (a road tunnel's), and a guardrail on the wall over it: posts every 2 m, a rail.
    if (trim.walkway) put([face(trim.walkway.width)[0], 0, from, face(trim.walkway.width)[1], trim.walkway.height, to], trim.walkway.material);
    if (trim.guardrail) {
      const g = trim.guardrail;
      put([face(0.12)[0], g.y - 0.15, from, face(0.12)[1], g.y, to], g.material, g.tint);
      for (let z = Math.ceil(from / 2) * 2 + 1; z < to - 0.1; z += 2) put([face(0.1)[0], trim.walkway?.height ?? 0, z - 0.05, face(0.1)[1], g.y - 0.15, z + 0.05], g.material, g.tint);
    }
    // Panel joints: a thin rib up the wall every `joints` metres.
    if (lining.joints) for (const z of beat(from, to, lining.joints)) put([face(0.015)[0], trim.plinth ?? 0, z - 0.02, face(0.015)[1], clear - (lining.haunch ?? 0), z + 0.02], m.trim);
  };
  // --- a round arch along the passage from z = `from` to `to` (north frame turned k): voussoir slabs on a segmental
  // arch from the springing on each wall to the crown, drawn inside the clear box (the collision is the shell's).
  // `rings`: the ends where the arch shows its face (a ring of the trim stone, the corners over it filled).
  const archRun = (k, from, to, rings = [from, to]) => {
    if (!arch || to - from < 0.05) return;
    for (const s of arch.slabs) drawRolled(k, [s.x - s.half, s.y - arch.t / 2, from, s.x + s.half, s.y + arch.t / 2, to], s.roll, m.soffit, undefined, s.tex);
    // No ring at the cell's edge: there the next piece's arch runs on (a ring each side made a band at every joint;
    // seamless tunnels). Rings stay where the arch shows its face: a junction's middle, a mouth, a joint piece.
    for (const z of rings) {
      if (Math.abs(Math.abs(z) - E) < 1e-6) continue;
      const [z0, z1] = z <= from + 1e-6 ? [from, Math.min(to, from + 0.3)] : [Math.max(from, to - 0.3), to];
      // The ring: the same slabs a little deeper, in the trim stone.
      for (const s of arch.slabs) drawRolled(k, [s.x - s.half, s.y - arch.t / 2 - 0.06, z0, s.x + s.half, s.y + arch.t / 2, z1], s.roll, m.trim, undefined, s.tex);
      // The corners over the arch filled to the shell, stepped (seen from a junction or the next family's piece).
      for (const b of arch.spandrels) for (const sx of [-1, 1]) draw(turnBox([Math.min(sx * b.x, sx * w), b.y0, z0, Math.max(sx * b.x, sx * w), b.y1, z1], k), m.wall);
    }
  };
  // --- timber sets (a mine): a post on each wall and a cap beam every `every` metres, lagging boards over the
  // soffit between them. Posts stand 0.12 m proud of the rock (closer than a player's body ever comes).
  const setsRun = (k, from, to) => {
    const st = lining.sets;
    if (!st) return;
    const put = (b, material, tint) => draw(turnBox(b, k), material, tint);
    for (let z = Math.ceil((from - st.every / 2) / st.every) * st.every + st.every / 2; z < to - 0.1; z += st.every) {
      if (z - st.post / 2 < from - 1e-6) continue;
      for (const sx of [-1, 1]) put([Math.min(sx * (w - 0.12), sx * (w + 0.1)), 0, z - st.post / 2, Math.max(sx * (w - 0.12), sx * (w + 0.1)), clear, z + st.post / 2], st.material);
      put([-w, clear - st.beam, z - st.post / 2 - 0.02, w, clear + 0.05, z + st.post / 2 + 0.02], st.material);
    }
    if (st.lagging) for (const x of [-1.4, -0.7, 0, 0.7, 1.4]) put([x - 0.17, clear - 0.04, from, x + 0.17, clear, to], st.lagging);
  };
  // --- the floor's line down an arm from the middle (z = 0) out to `to`: a drain, a water channel between kerbs with a
  // grate, or a narrow-gauge track. `kerbFrom`: where the kerbs start (clear of a crossing arm's channel).
  const floorRun = (k, to, kerbFrom = 0, drain = true, rails = true) => {
    const put = (b, material, tint) => draw(turnBox(b, k), material, tint);
    if (trim.drain && drain) put([-trim.drain.width / 2, 0, 0, trim.drain.width / 2, 0.02, to], trim.drain.material);
    if (trim.channel) {
      const c = trim.channel;
      const h = c.width / 2;
      // Drawn only: the walkways either side are the floor, and the water is a surface a hand over it (no liquid, so
      // nothing to wade in and no `tunnel.flooded`).
      put([-h, 0, 0, h, 0.025, to], c.water.material, c.water.tint);
      if (c.kerb) for (const sx of [-1, 1]) put([Math.min(sx * h, sx * (h + c.kerb.width)), 0, kerbFrom, Math.max(sx * h, sx * (h + c.kerb.width)), c.kerb.height, to], c.kerb.material);
      if (c.grate && to - 2 > 0.4) put([-h - 0.04, 0.025, 2 - 0.35, h + 0.04, 0.045, 2 + 0.35], c.grate.material, c.grate.tint);
    }
    // A carriageway's lines: a dashed centre line (a dash centred in each 4 m, so runs of pieces keep the beat) and
    // a solid edge line inside each walkway. Not across a junction's middle square.
    if (trim.lanes) {
      const ln = trim.lanes;
      const from = line ? 0 : w;
      const hw = ln.width / 2;
      for (let c = 2; c - ln.dash / 2 < to; c += 4) {
        const z0 = Math.max(from, c - ln.dash / 2);
        const z1 = Math.min(to, c + ln.dash / 2);
        if (z1 - z0 > 0.05) put([-hw, 0, z0, hw, 0.012, z1], ln.material, ln.tint);
      }
      const edge = w - (trim.walkway?.width ?? 0) - 0.3;
      for (const sx of [-1, 1]) put([sx * edge - hw, 0, from, sx * edge + hw, 0.012, to], ln.material, ln.edge ?? ln.tint);
    }
    if (trim.rails && rails) {
      const r = trim.rails;
      for (const z of beat(0, to, r.sleeperEvery, 0.1)) put([-r.gauge / 2 - 0.25, 0, z - 0.08, r.gauge / 2 + 0.25, 0.03, z + 0.08], r.sleeper);
      for (const sx of [-1, 1]) put([sx * r.gauge / 2 - 0.03, 0, 0, sx * r.gauge / 2 + 0.03, 0.06, to], r.material, r.tint);
    }
  };
  // An open arm: both its walls from the middle square out to the cell's edge, the joints carried across the soffit,
  // and the drain down the middle of the floor from the cell's centre.
  // (`kerbFrom`: on a line the kerbs run on through the middle; elsewhere they stop clear of the other arms' water.)
  const kerbFrom = line ? 0 : trim.channel ? r3(trim.channel.width / 2 + (trim.channel.kerb?.width ?? 0)) : 0;
  // A track that turns: a curve's track follows the bend from the south edge to the east (a quarter circle about the
  // cell's south-east corner), and a T's branch from the south turns into the east arm (a turnout), instead of each arm's
  // straight stub ending in the middle.
  const turns = trim.rails && arms.has('S') && arms.has('E') && !arms.has('N');
  // --- a rock shell (a cave): rings of broken rock slabs from `from` to `to` (north frame turned k), each slab set
  // in by a seeded amount and its ring a seeded length, so no two look alike; drawn only, inside the clear box.
  const rand = seeded((lining.rock?.seed ?? 1) + hashOf(shape.id));
  const rockRun = (k, from, to, depth = lining.rock?.depth ?? 0, material) => {
    const rk = lining.rock;
    if (!rk || to - from < 0.05) return;
    const prof = rockProfile(w, clear, rk.segs);
    for (let z = from; z < to - 0.05; z += rk.every) {
      const z0 = Math.max(from, z - rand() * 0.15);
      const z1 = Math.min(to, z + rk.every * (0.9 + rand() * 0.35));
      for (let i = 0; i < prof.length - 1; i++) {
        const [ax, ay] = prof[i];
        const [bx, by] = prof[i + 1];
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy);
        const nx = dy / len;
        const ny = -dx / len;
        const j = rand() * depth;
        const cx = (ax + bx) / 2 + nx * (rk.t / 2 - j);
        const cy = (ay + by) / 2 + ny * (rk.t / 2 - j);
        const half = len / 2 + 0.05 + rand() * 0.08;
        // (Not below the floor: the lowest slabs stand on it.)
        const lift = Math.max(0, rk.t / 2 - cy);
        drawRolled(k, [cx - half, cy + lift - rk.t / 2, z0, cx + half, cy + lift + rk.t / 2, z1], Math.atan2(dy, dx) + (rand() - 0.5) * 0.12, material ?? (rand() < 0.3 ? rk.accent : rk.material));
      }
    }
  };
  // --- rubble: low stones along the foot of each wall (under a step, so nothing to climb), drawn only.
  const rubbleRun = (k, from, to) => {
    const rb = trim.rubble;
    if (!rb) return;
    for (let z = from + rand() * rb.every; z < to - 0.2; z += rb.every * (0.7 + rand() * 0.6)) {
      for (const sx of [-1, 1]) {
        if (rand() < 0.3) continue;
        const half = 0.12 + rand() * 0.1;
        const x = sx * (w - 0.18 - rand() * 0.12);
        draw(turnBox([x - half, 0, z - half, x + half, rb.height * (0.5 + rand() * 0.5), z + half], k), rb.material);
      }
    }
  };
  const armTrim = (k, from, to, archFrom = from, rings = [archFrom, to]) => {
    rockRun(k, archFrom, to);
    rubbleRun(k, from, to);
    for (const sx of [-1, 1]) wallTrim(k, sx, from, to, !!arch);
    if (lining.joints) for (const z of beat(from, to, lining.joints)) draw(turnBox([-(w - (lining.haunch ?? 0)), clear - 0.015, z - 0.02, w - (lining.haunch ?? 0), clear, z + 0.02], k), m.trim);
    floorRun(k, to, kerbFrom, true, !(turns && (SIDES[k] === 'S' || (SIDES[k] === 'E' && !arms.has('W')))));
    archRun(k, archFrom, to, rings);
    setsRun(k, from, to);
  };
  if (turns) {
    const r = trim.rails;
    const segs = 12;
    const at = (rad, a) => [E - rad * Math.cos(a), -E + rad * Math.sin(a)];
    const yawed = (cx, cz, yaw, hx, hz, y1, material, tint) => trims.push({ box: [cx - hx, 0, cz - hz, cx + hx, y1, cz + hz].map(r3), kind: 'trim', yaw: r3(yaw), ...surf(material, tint) });
    for (const sx of [-1, 1]) {
      const rad = E + (sx * r.gauge) / 2;
      for (let i = 0; i < segs; i++) {
        const [x0, z0] = at(rad, (i * Math.PI) / 2 / segs);
        const [x1, z1] = at(rad, ((i + 1) * Math.PI) / 2 / segs);
        yawed((x0 + x1) / 2, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0), 0.03, Math.hypot(x1 - x0, z1 - z0) / 2 + 0.01, 0.06, r.material, r.tint);
      }
    }
    const n = Math.round(((Math.PI / 2) * E) / r.sleeperEvery);
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) * Math.PI) / 2 / n;
      const [x, z] = at(E, a);
      yawed(x, z, Math.atan2(Math.sin(a), Math.cos(a)), r.gauge / 2 + 0.25, 0.08, 0.03, r.sleeper);
    }
  }
  // On a line the arch and the sets run on through the middle square (the shaft's hatch leaves a gap in the arch).
  const lineArch = line && !mouth && arch;
  for (const [k, side] of SIDES.entries()) {
    if (!arms.has(side)) continue;
    if (lineArch && shape.hatch) armTrim(k, w, E, k === 0 ? shape.hatch[3] : -shape.hatch[1]);
    else if (lineArch) armTrim(k, w, E, 0, [E]);
    else armTrim(k, w, E);
  }
  // The middle square: a wall only on a closed side (the east side's wall is the north frame's east wall, and so on).
  if (!mouth) {
    const archedMiddle = !!lineArch && !shape.hatch;
    if (!arms.has('E')) wallTrim(0, 1, -w, w, line && archedMiddle);
    if (!arms.has('W')) wallTrim(0, -1, -w, w, line && archedMiddle);
    if (!arms.has('N')) wallTrim(1, -1, -w, w);
    if (!arms.has('S')) wallTrim(1, 1, -w, w);
    // A dead end's arch runs on to its end wall; a straight's two arms' arches meet at the middle (no ring there).
    if (lineArch && !arms.has('N')) archRun(2, -w, 0, []);
    if (line) setsRun(0, -w, w);
    // A cave's middle square: off a line, rock slabs on each closed side and broken rock over the soffit; a dead end's
    // shell runs on to its end wall.
    if (lining.rock) {
      if (line && !arms.has('N')) rockRun(2, -w, 0);
      if (!line) {
        const rk = lining.rock;
        for (const [k, side] of SIDES.entries()) {
          if (arms.has(side)) continue;
          for (let x = -w; x < w - 0.05; x += 0.9) {
            const j = rand() * rk.depth;
            const x1 = Math.min(w, x + 0.9 + rand() * 0.2);
            draw(turnBox([x, 0, w - 0.05 - j, x1, clear, w + 0.25 - j], k), rand() < 0.3 ? rk.accent : rk.material);
          }
        }
        for (let x = -w; x < w - 0.05; x += 1.2) for (let z = -w; z < w - 0.05; z += 1.2) draw([x, clear - 0.08 - rand() * 0.22, z, Math.min(w, x + 1.3), clear, Math.min(w, z + 1.3)], rand() < 0.3 ? rk.accent : rk.material);
      }
    }
  }

  // An eight-sided pipe from z = `from` to the cell's north edge: four slats, each as wide as the pipe and as thick as
  // one of its sides, turned an eighth apart about its run (their union is the regular octagon: no points stand out).
  function pipeRun(from) {
    const p = trim.pipe;
    const cx = -w + 0.05 + p.r;
    const side = p.r * Math.tan(Math.PI / 8);
    for (const roll of EIGHTHS) trims.push({ box: [cx - p.r, p.y - side, from, cx + p.r, p.y + side, E].map(r3), kind: 'trim', ...(roll ? { roll } : {}), ...surf(p.material, p.tint) });
  }

  // --- a pipe run on the west wall of a passage that runs straight through north to south (or to a dead end or a mouth).
  const through = arms.has('N') && !arms.has('E') && !arms.has('W');
  if (trim.pipe && through && !shape.hatch) {
    const p = trim.pipe;
    const z0 = arms.has('S') ? -E : mouth === 'S' ? shape.headwall.at + shape.headwall.t / 2 : -w;
    pipeRun(z0);
    for (let z = Math.ceil(z0) + 0.5; z < E; z += 2) draw([-w, p.y - p.r - 0.05, z - 0.05, -w + 0.07 + 2 * p.r, p.y + p.r + 0.05, z + 0.05], m.trim);
  }

  // --- the strip light at the crown, one a module: a housing and a glowing tube (a glowing material, not a light entity).
  // (A lantern instead: a lamp hung from the crown on a rod, the glass glowing.)
  const lantern = (x, z) => {
    const l = trim.light;
    const f = l.frame ?? m.trim;
    draw([x - 0.015, clear - 0.45, z - 0.015, x + 0.015, clear, z + 0.015], f);
    draw([x - 0.13, clear - 0.5, z - 0.13, x + 0.13, clear - 0.44, z + 0.13], f);
    draw([x - 0.09, clear - 0.76, z - 0.09, x + 0.09, clear - 0.5, z + 0.09], l.material, l.tint);
    draw([x - 0.11, clear - 0.8, z - 0.11, x + 0.11, clear - 0.76, z + 0.11], f);
  };
  if (trim.light?.style === 'lantern') {
    if (!mouth) lantern(0, 0);
  } else if (trim.light) {
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
    const dw = (shape.doorWidth ?? 1.1) / 2;
    const dh = shape.doorHeight ?? 2.07;
    draw(turnBox([-dw - 0.07, 0, w - 0.06, dw + 0.07, dh + 0.07, w], k), m.trim);
    draw(turnBox([-dw, 0, w - 0.09, dw, dh, w - 0.06], k), trim.door.material, trim.door.tint);
    draw(turnBox([-dw, 0.9, w - 0.11, dw, 1.12, w - 0.09], k), trim.hazard ?? trim.door.material);
    // A roll-up door's slats: a line every 0.3 m across it.
    if (shape.doorWidth) for (let y = 0.3; y < dh - 0.1; y += 0.3) if (y < 0.85 || y > 1.17) draw(turnBox([-dw, y - 0.015, w - 0.1, dw, y + 0.015, w - 0.09], k), m.trim);
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
    if (shape.collapse) {
      // A cave mouth: no masonry. The hill's broken rock either side of the opening (big blocks, set a little askew),
      // a slab of rock over it, and boulders tumbling down to the ends of the apron instead of wing walls. Its own
      // collision (a shape of its own, like the outfall).
      const yawed = (box, yaw, material = m.headwall) => solids.push({ box: box.map(r3), kind: 'wall', yaw: r3(yaw), ...surf(material) });
      for (const sx of [-1, 1]) {
        yawed([Math.min(sx * (w + 0.05), sx * (E - 0.1)), 0, front - 0.2, Math.max(sx * (w + 0.05), sx * (E - 0.1)), h.top - 0.2, back], sx * 0.04);
        yawed([Math.min(sx * (w + 0.3), sx * (E - 0.1)), 0, front - 0.9, Math.max(sx * (w + 0.3), sx * (E - 0.1)), clear, front + 0.2], -sx * 0.06, m.trim);
        // Boulders down the apron's sides, smaller towards the foot (turned a little, kept inside the cell).
        [[front - 1.5, 2.4, 0.75], [front - 2.6, 1.7, 0.65], [-E + 0.8, 1.1, 0.55]].forEach(([z, top, half], i) => {
          const x = sx * (E - half * 1.3);
          yawed([x - half, 0, z - half, x + half, top, z + half], (i + 1) * 0.2 * sx, i % 2 ? m.trim : m.headwall);
        });
      }
      solids.push({ box: [-w - 0.4, clear, front - 0.45, w + 0.4, h.top - 0.1, back].map(r3), kind: 'wall', pitch: 0.06, ...surf(m.headwall) });
      solid([-E, clear, front, E, h.top - 0.3, back], m.headwall);
      // Rock lumps on the faces, drawn: a ragged edge round the opening.
      for (let i = 0; i < 9; i++) {
        const a = (i / 8) * Math.PI;
        const x = Math.cos(a) * (w + 0.15);
        const y = Math.min(clear + 0.1, Math.sin(a) * (clear + 0.2));
        const r = 0.25 + rand() * 0.2;
        drawRolled(0, [x - r, y - r * 0.6, front - 0.3 - rand() * 0.2, x + r, y + r * 0.6, front + 0.1], a + (rand() - 0.5) * 0.6, rand() < 0.5 ? m.trim : m.headwall);
      }
      rockRun(0, front, back, 0.15);
      floorRun(2, E, 0, false);
      bore.cut = [
        [-E, -0.5, front, E, cap, E],
        [-E, -0.5, -E, E, 1000, front],
      ];
      bore.cover = [[-E, back, E, E, r3(cap + 0.1)]];
      bore.open = [[-E, 0, -E, E, 4, -E]];
      bore.out = 'S';
      bore.rim = [
        { line: [-E, front, E, front], y: [r3(h.top - 0.4), r3(h.top - 0.4)], mode: 'lower' },
        ...[-1, 1].flatMap((sx) => [
          { line: [sx * E, front, sx * E, g.foot], y: [r3(g.top - 0.6), r3(g.low - 0.4)], mode: 'both' },
          { line: [sx * E, g.foot, sx * E, -E], y: [r3(g.low - 0.4), r3(g.low - 0.4)], mode: 'both' },
        ]),
      ];
      solid(capBox, m.soffit);
      return { solids: [...solids, ...trims], floor: { box: [-E, -0.5, -E, E, 0, E], ...surf(m.floor) }, bore };
    }
    // The headwall: a pier either side of the opening, the lintel over it, a coping.
    for (const sx of [-1, 1]) solid([Math.min(sx * w, sx * E), 0, front, Math.max(sx * w, sx * E), h.top, back], m.headwall);
    solid([-w, clear, front, w, h.top, back], m.headwall);
    solid([-E, h.top, front - 0.12, E, h.top + 0.2, back + 0.12], m.trim);
    // A lintel band, and the hazard band on each jamb, on the headwall's face.
    draw([-w - 0.3, clear, front - 0.04, w + 0.3, clear + 0.4, front], m.trim);
    if (trim.hazard) for (const sx of [-1, 1]) draw([Math.min(sx * w, sx * (w + 0.9)), 0, front - 0.03, Math.max(sx * w, sx * (w + 0.9)), 1.0, front], trim.hazard);
    // The apron's drain runs out to the edge (a channel or a track too).
    if (trim.drain) draw([-trim.drain.width / 2, 0, -E, trim.drain.width / 2, 0.02, back], trim.drain.material);
    floorRun(2, E, 0, false);
    // A mine's mouth: a heavy timber frame on the headwall's face (posts either side of the opening and a lintel).
    if (trim.frame) {
      for (const sx of [-1, 1]) draw([Math.min(sx * (w - 0.1), sx * (w + 0.3)), 0, front - 0.25, Math.max(sx * (w - 0.1), sx * (w + 0.3)), clear, front + 0.05], trim.frame);
      draw([-w - 0.45, clear - 0.3, front - 0.3, w + 0.45, clear + 0.15, front + 0.05], trim.frame);
    }
    // Bars across the mouth (an outfall): iron that stops players and bots; shots pass between the bars.
    if (shape.bars) {
      const b = shape.bars;
      const bm = trim.bars ?? 'core.rusty_metal';
      const n = Math.floor((2 * w) / b.every);
      for (let i = 1; i < n; i++) {
        const x = -w + (i * 2 * w) / n;
        solid([x - b.r, 0, h.at - b.r, x + b.r, clear, h.at + b.r], bm);
      }
      for (const y of b.rails) solid([-w, y - 0.04, h.at - b.r - 0.02, w, y + 0.04, h.at + b.r + 0.02], bm);
    }
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
    // (An arch runs on through the headwall's opening, its ring on the headwall's face.)
    armTrim(0, from, E, arch ? shape.headwall.at - shape.headwall.t / 2 : from, arch ? [shape.headwall.at - shape.headwall.t / 2, E] : undefined);
    if (trim.pipe) {
      const p = trim.pipe;
      pipeRun(from);
    }
    if (trim.light?.style === 'lantern') lantern(0, 2.2);
    else if (trim.light) {
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
    const lidH = (hx1 - hx0) * 0.9;
    solids.push({ box: [hx1 + k, top, hz0, hx1 + k + 0.06, top + lidH, hz1].map(r3), kind: 'wall', ...surf((trim.door ?? {}).material ?? m.trim) });
    // The lid reads as a lid: a hazard band along its free edge, a grab handle on its inside face, two hinge knuckles
    // at its foot on the kerb.
    draw([hx1 + k - 0.005, top + lidH - 0.1, hz0, hx1 + k + 0.065, top + lidH, hz1], trim.hazard ?? m.trim);
    draw([hx1 + k - 0.05, top + lidH - 0.32, -0.22, hx1 + k, top + lidH - 0.27, 0.22], m.trim);
    for (const z of [hz0 + 0.25, hz1 - 0.25]) draw([hx1 + k - 0.03, top - 0.02, z - 0.1, hx1 + k + 0.09, top + 0.09, z + 0.1], m.trim);
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
 * A Stair Tunnel (`kind: 'stairway'`; seamless tunnels, owner 2026-11-18): the passage goes down a level over two
 * cells, the low end south, the high end north. A level landing 2 m long at each end, 16 steps of 0.25 m by 0.75 m
 * between (18.4 degrees, easier than the one-cell Stairs), the soffit running down with the floor at the passage's
 * clear height over the steps' line, so a body stands upright the whole way (map/headroom.ts STAIR_HEADROOM). The
 * lining and trim are the family's straight run's, laid along the flight: each drawn part is lifted by the floor's
 * rise under it, a long one tilted to follow the slope (split where the landings meet the steps), so the arch, the
 * timber sets, the rock or the panels run on into the level pieces at either end. Floor fittings (drain, channel,
 * track, lane lines, walkways, rubble) stay off the steps; lanterns hang over the landings, never over a step.
 */
function stairwayParts(profile, family, shape) {
  const { half: w, clear, cap } = profile;
  const m = family.materials;
  const trim = family.trim ?? {};
  const surf = (material, tint) => ({ surface: tint ? { material, tint } : { material } });
  const E = 4;
  const L = 4;
  const T = r3(cap - clear);
  const N = 3 * E; // the north edge of the second cell
  const zA = -E + 2; // the foot of the steps
  const zB = N - 2; // the head of the steps
  const steps = 16;
  const run = (zB - zA) / steps;
  const a = Math.atan2(L, zB - zA);
  const rise = (z) => (z <= zA ? 0 : z >= zB ? L : ((z - zA) * L) / (zB - zA));
  const solids = [];
  const trims = [];
  const solid = (box, material, kind = 'wall') => solids.push({ box: box.map(r3), kind, ...surf(material) });
  // A tilted box over (or under) the line from (z0, y0) to (z1, y1): `t` thick, x0..x1 across, its face on that line.
  const slab = (x0, x1, z0, y0, z1, y1, t, over = true) => {
    const l = Math.hypot(z1 - z0, y1 - y0);
    const tilt = Math.atan2(y1 - y0, z1 - z0);
    const side = over ? 1 : -1;
    const cz = (z0 + z1) / 2 - side * (t / 2) * Math.sin(tilt);
    const cy = (y0 + y1) / 2 + side * (t / 2) * Math.cos(tilt);
    return { box: [x0, cy - t / 2, cz - l / 2, x1, cy + t / 2, cz + l / 2].map(r3), pitch: r3(tilt) };
  };

  // --- the shell: the steps and the landings, the masses either side and the soffit, in 2 m stretches.
  solids.push({ flight: { axis: 'z', dir: 1, from: zA, across: [-w, w], steps, run: r3(run) }, ...surf(m.floor) });
  solid([-w, 0, zB, w, L, N], m.floor, 'solid');
  for (let z0 = -E; z0 < N - 1e-6; z0 += 2) {
    const top = Math.min(rise(z0 + 2) + cap, L + cap);
    for (const sx of [-1, 1]) solid([Math.min(sx * w, sx * E), 0, z0, Math.max(sx * w, sx * E), top, z0 + 2], m.wall);
  }
  solid([-E, clear, -E, E, cap, zA], m.soffit);
  solids.push({ ...slab(-E, E, zA, clear, zB, L + clear, T), kind: 'wall', ...surf(m.soffit) });
  // (The high landing's soffit reaches back over the slab's leaning end, hidden in it, so no slit shows at the bend.)
  solid([-E, L + clear, zB - 0.3, E, L + cap, N], m.soffit);

  // --- the family's lining: its straight's drawn parts over both cells, laid along the flight.
  const straight = moduleParts(profile, family, { id: `${shape.id}`, arms: ['N', 'S'] });
  const lanterns = [];
  const parts = [];
  for (const dz of [0, 2 * E]) {
    for (const p of straight.solids) {
      if (p.kind !== 'trim') continue;
      const b = p.box;
      // Floor fittings stay off the steps.
      if (b[4] <= 0.2) continue;
      // A hung lantern (small, on the line, low under the crown): moved over the landings.
      if (trim.light?.style === 'lantern' && Math.abs(b[0] + b[3]) < 0.05 && b[3] - b[0] < 0.3 && b[1] > clear - 0.9 && b[5] - b[2] < 0.3) {
        if (!dz) lanterns.push(p);
        continue;
      }
      // A half-turned part (the south arm's) as the same box unturned: its roll, and its place along a curve, change sign.
      let q = { ...p, box: [b[0], b[1], b[2] + dz, b[3], b[4], b[5] + dz] };
      if (q.yaw && Math.abs(Math.abs(q.yaw) - Math.PI) < 1e-3) {
        const { yaw, ...rest } = q;
        q = { ...rest, ...(q.roll ? { roll: -q.roll } : {}), ...(q.tex !== undefined ? { tex: -q.tex } : {}) };
      }
      if (q.yaw) throw new Error(`tunnel kit: ${shape.id}: a turned part in a straight run`);
      parts.push(q);
    }
  }
  for (const p of parts) {
    const [x0, y0, z0, x1, y1, z1] = p.box;
    const cuts = [z0, ...[zA, zB].filter((z) => z > z0 + 0.02 && z < z1 - 0.02), z1];
    for (let i = 0; i < cuts.length - 1; i++) {
      const [s0, s1] = [cuts[i], cuts[i + 1]];
      const zm = (s0 + s1) / 2;
      const sloped = s1 > zA + 1e-6 && s0 < zB - 1e-6;
      if (!sloped || s1 - s0 <= 0.6) {
        // Level, or short (a set, a rib, a bracket): lifted by the rise under its middle.
        const up = rise(zm);
        trims.push({ ...p, box: [x0, y0 + up, s0, x1, y1 + up, s1].map(r3) });
        continue;
      }
      // Long, on the steps: tilted to follow them, as high over the floor's line as it was over the floor. Where it
      // meets its level part at a bend, it runs on a little past the bend (its end leans with the slope, and would
      // leave a slit against the level part's square end).
      const h = (y1 - y0) * Math.cos(a);
      const ext = (h / 2) * Math.sin(a) + 0.03;
      const e0 = s0 - (i > 0 ? ext : 0);
      const e1 = s1 + (i < cuts.length - 2 ? ext : 0);
      const em = (e0 + e1) / 2;
      const l = (e1 - e0) / Math.cos(a);
      const cy = (y0 + y1) / 2 + ((em - zA) * L) / (zB - zA);
      trims.push({ ...p, box: [x0, cy - h / 2, em - l / 2, x1, cy + h / 2, em + l / 2].map(r3), pitch: r3(a) });
    }
  }
  for (const [dz, up] of [[-E + 1, 0], [N - 1, L]]) for (const p of lanterns) trims.push({ ...p, box: [p.box[0], p.box[1] + up, p.box[2] + dz, p.box[3], p.box[4] + up, p.box[5] + dz].map(r3) });
  // A handrail on each wall, following the steps.
  for (const sx of [-1, 1]) trims.push({ ...slab(sx * (w - 0.1) - 0.03, sx * (w - 0.1) + 0.03, zA - 0.3, 0.95, zB + 0.3, L + 0.95, 0.06), kind: 'trim', ...surf(m.trim) });

  // --- the ground: cut and kept in 2 m stretches climbing with the soffit (as the Stairs' and the Wide Ramp's).
  const bore = { cut: [], cover: [], plan: [[-w, -E, -w, N], [w, -E, w, N]] };
  for (let z0 = -E; z0 < N - 1e-6; z0 += 2) {
    const top = Math.min(rise(z0 + 2) + cap, L + cap);
    bore.cut.push([-E, r3(rise(z0) - 0.5), z0, E, r3(top), z0 + 2]);
    bore.cover.push([-E, z0, E, z0 + 2, r3(top + 0.1)]);
  }
  return {
    cells: [[0, 0, 0], [0, 1, 0], [0, 0, 1], [0, 1, 1]],
    ports: [{ side: 'S', level: 0 }, { side: 'N', level: 1, cell: [0, 1] }],
    solids: [...solids, ...trims],
    floors: [{ box: [-E, -0.5, -E, E, 0, E], ...surf(m.floor) }],
    bore,
  };
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
function specialParts(profile, family, shape, profiles = {}) {
  const { half: w, clear, cap } = profile;
  const m = family.materials;
  const lining = family.lining ?? {};
  const trim = family.trim ?? {};
  const surf = (material, tint) => ({ surface: tint ? { material, tint } : { material } });
  const solids = [];
  const trims = [];
  const solid = (box, material, kind = 'wall') => solids.push({ box: box.map(r3), kind, ...surf(material) });
  const draw = (box, material, tint) => trims.push({ box: box.map(r3), kind: 'trim', ...surf(material, tint) });
  const E = 4;
  const L = 4; // a level
  const T = r3(cap - clear);
  const cover = (y) => r3(y + 0.1);

  if (shape.kind === 'flight' || shape.kind === 'descent' || shape.kind === 'ramp') {
    const open = shape.kind === 'descent';
    // A ramp (the wide bore's, for wheels) climbs its level over two cells: 1 in 4. Flights and descents over one.
    const n = shape.kind === 'ramp' ? 2 : 1;
    const run = n * 2 * E;
    const Z = -E + run;
    const a = Math.atan2(L, run);
    const lean = Math.sin(a);
    // The flight's line: the floor's height at z (0 at the south edge, a level at the north).
    const rise = (z) => ((z + E) * L) / run;
    // A tilted box `t` thick whose face follows the flight from z0 to z1, `up` metres over the floor's line: lying over
    // that face (a soffit) or under it (a floor). Kept inside the cell: a tilted box's ends lean t x sin(a) past its face.
    const along = (x0, x1, z0, z1, up, t, over) => {
      const l = Math.hypot(z1 - z0, rise(z1) - rise(z0));
      const side = over ? 1 : -1;
      const cz = (z0 + z1) / 2 - side * (t / 2) * lean;
      const cy = (rise(z0) + rise(z1)) / 2 + up + side * (t / 2) * Math.cos(a);
      return { box: [x0, cy - t / 2, cz - l / 2, x1, cy + t / 2, cz + l / 2].map(r3), pitch: r3(a) };
    };
    // The floor: 16 steps of 0.25 m, or a slab at 1 in 2 with a short level landing at its head.
    if (shape.floor === 'ramp' || shape.kind === 'ramp') {
      const t = 0.5;
      const head = Z - t * lean - 0.01;
      solids.push({ ...along(-w, w, -E, head, 0, t, false), kind: 'solid', ...surf(m.floor) });
      solid([-w, L - t, head - 0.05, w, L, Z], m.floor, 'solid');
      // A road's lines up the ramp: the centre dashes and the edge lines, laid on the slab.
      if (trim.lanes) {
        const ln = trim.lanes;
        const hw = ln.width / 2;
        for (let c = -E + 2; c < head; c += 4) trims.push({ ...along(-hw, hw, Math.max(-E, c - ln.dash / 2), Math.min(head, c + ln.dash / 2), 0, 0.012, true), kind: 'trim', ...surf(ln.material, ln.tint) });
        const edge = w - (trim.walkway?.width ?? 0) - 0.3;
        for (const sx of [-1, 1]) trims.push({ ...along(sx * edge - hw, sx * edge + hw, -E, head, 0, 0.012, true), kind: 'trim', ...surf(ln.material, ln.edge ?? ln.tint) });
      }
    } else solids.push({ flight: { axis: 'z', dir: 1, from: -E, across: [-w, w], steps: 16 }, ...surf(m.floor) });
    // A handrail on each wall, following the flight. (Open to the sky it stops where it would stand over the low walls.)
    const railTo = shape.kind === 'descent' ? 2.6 : Z - 0.03;
    for (const sx of [-1, 1]) trims.push({ ...along(sx * (w - 0.1) - 0.03, sx * (w - 0.1) + 0.03, -E + 0.03, railTo, 0.95, 0.06, true), kind: 'trim', ...surf(m.trim) });
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
      const step = (2 * L) / run;
      for (let j = 0; j < 4 * n; j++) {
        const z0 = -E + 2 * j;
        const top = clear + (j + 1) * step + T;
        for (const sx of [-1, 1]) solid([Math.min(sx * w, sx * E), 0, z0, Math.max(sx * w, sx * E), Math.min(top, L + clear), z0 + 2], m.wall);
        bore.cut.push([-E, j * step - 0.5, z0, E, r3(Math.min(top, L + cap)), z0 + 2].map(r3));
        bore.cover.push([-E, z0, E, z0 + 2, cover(Math.min(top, L + cap))]);
      }
      // The soffit climbs with the floor: one slab, its underside from the low passage's soffit to the high one's, and
      // a level piece at each end where the slab's leaning end would leave a slit against the next piece's cap.
      const foot = -E + T * lean + 0.01;
      solids.push({ ...along(-E, E, foot, Z - 0.01, clear, T, true), kind: 'wall', ...surf(m.soffit) });
      solid([-E, clear, -E, E, clear + T + 0.25, foot + 0.05], m.soffit);
      solid([-E, L + clear, Z - 0.3, E, L + cap, Z], m.soffit);
      if (lining.haunch) for (const sx of [-1, 1]) trims.push({ ...along(Math.min(sx * w, sx * (w - lining.haunch)), Math.max(sx * w, sx * (w - lining.haunch)), foot + 0.05, Z - lining.haunch * lean - 0.02, clear - 0.02, lining.haunch, false), kind: 'trim', ...surf(m.soffit) });
      // One fixture a cell along the soffit (a flight's one, in the middle).
      const zc = -E + run / 2;
      for (const c of n === 1 ? [zc] : [zc - E, zc + E]) {
        if (!trim.light) break;
        const l = trim.light;
        trims.push({ ...along(-0.14, 0.14, c - l.length / 2 - 0.08, c + l.length / 2 + 0.08, clear - 0.02, 0.06, false), kind: 'trim', ...surf(m.trim) });
        trims.push({ ...along(-0.06, 0.06, c - l.length / 2, c + l.length / 2, clear - 0.08, 0.05, false), kind: 'trim', ...surf(l.material, l.tint) });
      }
    }
    bore.plan = [[-w, -E, -w, Z], [w, -E, w, Z]];
    const cells = n === 1 ? [[0, 0, 0], [0, 0, 1]] : [[0, 0, 0], [0, 1, 0], [0, 0, 1], [0, 1, 1]];
    const ports = n === 1 ? [{ side: 'S', level: 0 }, { side: 'N', level: 1 }] : [{ side: 'S', level: 0 }, { side: 'N', level: 1, cell: [0, 1] }];
    return { cells, ports, solids: [...solids, ...trims], floors: [{ box: [-E, -0.5, -E, E, 0, E], ...surf(m.floor) }], bore };
  }

  if (shape.kind === 'stairway') return stairwayParts(profile, family, shape);

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
    // A cave's chamber: stalactites hung from the soffit (seeded, each a few stacked tapering blocks, their tips over
    // head height), rubble along the walls' feet. Drawn only.
    if (trim.stalactites) {
      const st = trim.stalactites;
      const rand = seeded(hashOf(`${shape.id}:stalactites`));
      for (let i = 0; i < 26; i++) {
        const x = lo + wt + 0.4 + rand() * (hi - lo - 2 * wt - 0.8);
        const z = lo + wt + 0.4 + rand() * (hi - lo - 2 * wt - 0.8);
        if ((shape.columns ?? []).some(([cx, cz]) => Math.abs(cx - x) < 0.7 && Math.abs(cz - z) < 0.7)) continue;
        const len = st.length * (0.35 + rand() * 0.65);
        const r0 = 0.12 + rand() * 0.14;
        for (let j = 0; j < 3; j++) {
          const r = r0 * (1 - j * 0.3);
          draw([x - r, clear - (len * (j + 1)) / 3, z - r, x + r, clear - (len * j) / 3 + 0.02, z + r], st.material);
        }
      }
    }
    if (trim.rubble) {
      const rb = trim.rubble;
      const rand = seeded(hashOf(`${shape.id}:rubble`));
      for (let i = 0; i < 18; i++) {
        const along = lo + wt + rand() * (hi - lo - 2 * wt);
        const side = Math.floor(rand() * 4);
        const off = 0.15 + rand() * 0.2;
        const [x, z] = [[along, lo + wt + off], [along, hi - wt - off], [lo + wt + off, along], [hi - wt - off, along]][side];
        const r = 0.12 + rand() * 0.12;
        draw([x - r, 0, z - r, x + r, rb.height * (0.5 + rand() * 0.5), z + r], rb.material);
      }
    }
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
    if (trim.light?.style === 'lantern') {
      // A lantern at each fixture's place instead of a strip light (brick, mine), hung from the soffit.
      const l = trim.light;
      const f = l.frame ?? m.trim;
      for (const [x, z] of [[E, 0.5], [E, 2 * E - 0.5], [0.5, E], [2 * E - 0.5, E], [E, E]]) {
        draw([x - 0.015, clear - 0.45, z - 0.015, x + 0.015, clear, z + 0.015], f);
        draw([x - 0.13, clear - 0.5, z - 0.13, x + 0.13, clear - 0.44, z + 0.13], f);
        draw([x - 0.09, clear - 0.76, z - 0.09, x + 0.09, clear - 0.5, z + 0.09], l.material, l.tint);
        draw([x - 0.11, clear - 0.8, z - 0.11, x + 0.11, clear - 0.76, z + 0.11], f);
      }
    } else if (trim.light) {
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
  if (shape.kind === 'reducer') {
    // The wide bore (this shape's profile) to the south, the service passage (S) to the north: the walls step in at the
    // middle of the cell, the soffit steps down there. A hazard band on each step's face.
    const s = profiles.S;
    for (const sx of [-1, 1]) {
      solid([Math.min(sx * w, sx * E), 0, -E, Math.max(sx * w, sx * E), clear, 0], m.wall);
      solid([Math.min(sx * s.half, sx * E), 0, 0, Math.max(sx * s.half, sx * E), clear, E], m.wall);
      if (trim.plinth) {
        draw([Math.min(sx * w, sx * (w - 0.04)), 0, -E, Math.max(sx * w, sx * (w - 0.04)), trim.plinth, 0], m.trim);
        draw([Math.min(sx * s.half, sx * (s.half - 0.04)), 0, 0, Math.max(sx * s.half, sx * (s.half - 0.04)), trim.plinth, E], m.trim);
      }
      if (trim.walkway) draw([Math.min(sx * w, sx * (w - trim.walkway.width)), 0, -E, Math.max(sx * w, sx * (w - trim.walkway.width)), trim.walkway.height, -0.02], trim.walkway.material);
      if (trim.hazard) draw([Math.min(sx * s.half, sx * w), 0, -0.03, Math.max(sx * s.half, sx * w), 1.0, 0], trim.hazard);
    }
    solid([-E, s.clear, 0, E, clear, E], m.soffit);
    solid([-E, clear, -E, E, cap, E], m.soffit);
    if (lining.haunch) for (const sx of [-1, 1]) draw([Math.min(sx * w, sx * (w - lining.haunch)), clear - lining.haunch, -E, Math.max(sx * w, sx * (w - lining.haunch)), clear, 0], m.soffit);
    if (trim.light?.style === 'lantern') {
      const l = trim.light;
      const f = l.frame ?? m.trim;
      draw([-0.015, clear - 0.45, -2.015, 0.015, clear, -1.985], f);
      draw([-0.09, clear - 0.76, -2.09, 0.09, clear - 0.45, -1.91], l.material, l.tint);
    } else if (trim.light) {
      const l = trim.light;
      draw([-0.14, clear - 0.05, -2 - l.length / 4 - 0.08, 0.14, clear, -2 + l.length / 4 + 0.08], m.trim);
      draw([-0.06, clear - 0.1, -2 - l.length / 4, 0.06, clear - 0.05, -2 + l.length / 4], l.material, l.tint);
    }
    const bore = {
      cut: [[-E, -0.5, -E, E, cap, E]],
      cover: [[-E, -E, E, E, cover(cap)]],
      plan: [[-w, -E, -w, 0], [w, -E, w, 0], [-s.half, 0, -s.half, E], [s.half, 0, s.half, E], [-w, 0, -s.half, 0], [s.half, 0, w, 0]],
    };
    return { cells: [[0, 0, 0]], ports: [{ side: 'S', level: 0, bore: 'L' }, { side: 'N', level: 0 }], solids: [...solids, ...trims], floors: [{ box: [-E, -0.5, -E, E, 0, E], ...surf(m.floor) }], bore };
  }
  throw new Error(`tunnel kit: ${shape.id}: no kind ${shape.kind}`);
}

/** A box's z extent clipped to [z0, z1] (null when nothing is left): boxes along the passage, whose yaw is 0 or a half turn. */
function clipZ(part, z0, z1) {
  const b = part.box;
  const lo = Math.max(b[2], z0);
  const hi = Math.min(b[5], z1);
  if (hi - lo < 0.02) return null;
  return { ...part, box: [b[0], b[1], r3(lo), b[3], b[4], r3(hi)] };
}

/**
 * A transition (Tileset 04 step 7; `shape.joint`): one cell, the piece's own family `a` to the south and the joint's
 * family `b` to the north, the joint in the middle. Built from the two families' straights (their lining and trim cut
 * at z = 0; no fixtures: a light at the joint would be half of each) on one shell, the masses and cap split at the
 * joint so each half shows its own family, plus a joint part for the pair. A reducer joint (`to_road`): the wide bore
 * in `b` to the south, the passage in `a` to the north.
 */
function jointParts(data, a, b, aid, shape) {
  const bid = shape.joint;
  const S = data.profiles.S;
  const E = 4;
  const w = S.half;
  const clear = S.clear;
  const dark = (f) => ({ ...f, trim: { ...(f.trim ?? {}), light: undefined } });
  const straight = { id: `${shape.id}`, arms: ['N', 'S'] };
  const halves = (parts, z0, z1, fam) => parts.solids.flatMap((p) => {
    if (p.kind !== 'trim') return [];
    const c = clipZ(p, z0, z1);
    return c ? [c] : [];
  });
  const surf = (material, tint) => ({ surface: tint ? { material, tint } : { material } });
  const extra = [];
  const draw = (box, material, tint) => extra.push({ box: box.map(r3), kind: 'trim', ...surf(material, tint) });
  const drawRolled = (box, roll, material) => extra.push({ box: box.map(r3), kind: 'trim', ...(roll ? { roll: r3(roll) } : {}), ...surf(material) });
  // A frame round the opening at the joint, in a material: jambs and a head standing `t` in from the walls.
  const frame = (material, t = 0.15, d0 = -0.2, d1 = 0.2) => {
    for (const sx of [-1, 1]) draw([Math.min(sx * w, sx * (w - t)), 0, d0, Math.max(sx * w, sx * (w - t)), clear, d1], material);
    draw([-w, clear - t, d0, w, clear, d1], material);
  };
  if (shape.kind === 'reducer') {
    // The wide bore in the road family to the south, the mine's passage to the north, a roll-up door rolled up over
    // the narrow opening at the step.
    const L = data.profiles.L;
    const red = specialParts(L, dark(b), { ...shape, kind: 'reducer' }, data.profiles);
    const north = moduleParts(S, dark(a), straight);
    const solids = red.solids.filter((p) => p.kind !== 'trim').map((p) => ((p.box[2] + p.box[5]) / 2 > 0 ? { ...p, ...surf(p.box[1] >= S.clear - 1e-6 ? a.materials.soffit : a.materials.wall) } : p));
    const trims = [...red.solids.filter((p) => p.kind === 'trim').flatMap((p) => clipZ(p, -E, 0) ?? []), ...halves(north, 0, E)];
    const door = b.trim?.door?.material ?? 'core.pbr_rusted_plate';
    for (const sx of [-1, 1]) draw([Math.min(sx * (w + 0.02), sx * (w + 0.14)), 0, -0.14, Math.max(sx * (w + 0.02), sx * (w + 0.14)), clear, -0.02], b.materials.trim);
    draw([-w - 0.14, clear - 0.45, -0.5, w + 0.14, clear - 0.05, -0.02], door);
    for (let y = clear - 0.4; y < clear - 0.05; y += 0.1) draw([-w - 0.12, y - 0.01, -0.52, w + 0.12, y + 0.01, -0.5], b.materials.trim);
    if (b.trim?.hazard) draw([-w, clear - 0.48, -0.53, w, clear - 0.42, -0.5], b.trim.hazard);
    // The mine's last timber set hard against the bay.
    const st = a.lining?.sets;
    if (st) {
      for (const sx of [-1, 1]) draw([Math.min(sx * (w - 0.18), sx * (w + 0.05)), 0, 0.02, Math.max(sx * (w - 0.18), sx * (w + 0.05)), clear, 0.4], st.material);
      draw([-w, clear - 0.4, 0.02, w, clear, 0.4], st.material);
    }
    return { solids: [...solids, ...trims, ...extra], bore: red.bore, cells: red.cells, ports: red.ports.map((p) => (p.bore === 'L' ? { ...p, family: bid } : p)), floors: red.floors };
  }
  const south = moduleParts(S, dark(a), straight);
  const north = moduleParts(S, dark(b), straight);
  // The shell: the straight's, each mass in the family of the half it stands in; the cap split at the joint.
  const solids = [];
  for (const p of south.solids) {
    if (p.kind === 'trim') continue;
    const zc = (p.box[2] + p.box[5]) / 2;
    if (p.box[2] < -0.01 && p.box[5] > 0.01) {
      solids.push(clipZ(p, -E, 0));
      const twin = north.solids.find((q) => q.kind !== 'trim' && JSON.stringify(q.box) === JSON.stringify(p.box));
      solids.push(clipZ(twin ?? p, 0, E));
    } else solids.push(zc < 0 ? p : north.solids.find((q) => q.kind !== 'trim' && JSON.stringify(q.box) === JSON.stringify(p.box)) ?? p);
  }
  const trims = [...halves(south, -E, 0), ...halves(north, 0, E)];
  // The joint, by pair: into a cave a collar (cast from concrete, a ring of the sewer's stone from brick, a heavy
  // timber set from a mine) with rock breaking over its north edge; into concrete a cast frame with a grate across the
  // floor; otherwise a frame in the north family's trim. The south family's own end: its arch's ring, its last set.
  if (a.lining?.arch) {
    const arch = archOf(w, a.lining.arch, clear);
    for (const s of arch.slabs) drawRolled([s.x - s.half, s.y - arch.t / 2 - 0.06, -0.3, s.x + s.half, s.y + arch.t / 2, 0], s.roll, a.materials.trim);
    for (const sp of arch.spandrels) for (const sx of [-1, 1]) draw([Math.min(sx * sp.x, sx * w), sp.y0, -0.3, Math.max(sx * sp.x, sx * w), sp.y1, 0], a.materials.wall);
  }
  if (a.lining?.sets) {
    const st = a.lining.sets;
    for (const sx of [-1, 1]) draw([Math.min(sx * (w - 0.2), sx * (w + 0.05)), 0, -0.42, Math.max(sx * (w - 0.2), sx * (w + 0.05)), clear, -0.02], st.material);
    draw([-w, clear - 0.42, -0.42, w, clear, -0.02], st.material);
  }
  if (bid === 'cave') {
    if (!a.lining?.arch && !a.lining?.sets) frame(a.materials.trim, 0.2, -0.35, 0.05);
    // Rock breaking over the collar: a short ring of slabs set further in, straddling the joint.
    const rk = b.lining.rock;
    const rand = seeded(hashOf(`${aid}:${shape.id}`));
    const prof = rockProfile(w, clear, rk.segs);
    for (let i = 0; i < prof.length - 1; i++) {
      if (rand() < 0.35) continue;
      const [ax, ay] = prof[i];
      const [bx, by] = prof[i + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy);
      const j = 0.1 + rand() * 0.2;
      const cx = (ax + bx) / 2 + (dy / len) * (rk.t / 2 - j);
      const cy = Math.max(rk.t / 2, (ay + by) / 2 + (-dx / len) * (rk.t / 2 - j));
      drawRolled([cx - len / 2 - 0.1, cy - rk.t / 2, -0.1 - rand() * 0.2, cx + len / 2 + 0.1, cy + rk.t / 2, 0.5 + rand() * 0.3], Math.atan2(dy, dx) + (rand() - 0.5) * 0.3, rand() < 0.4 ? rk.accent : rk.material);
    }
  } else {
    frame(b.materials.trim, 0.15, -0.05, 0.3);
    if (bid === 'concrete') draw([-w + 0.15, 0, -0.45, w - 0.15, 0.03, 0.45], 'core.grate');
  }
  return { solids: [...solids, ...trims, ...extra], bore: south.bore, cells: [[0, 0, 0]], ports: [{ side: 'N', level: 0, family: bid }, { side: 'S', level: 0 }], floors: [south.floor] };
}

/** Every tunnel tile: one for each family and shape, as content/tiles/core.json's tiles (with `notes`). */
export function tunnelTiles(data) {
  const out = [];
  // The first family is the shapes' own (the tile MapMaker's palette shows); the others are reached by a placed
  // piece's `family` (map format v37), or by their own tile ids.
  // A shape comes in the families it names (the first its own), else in every family whose `profiles` take its
  // profile, in order. A port of an L shape says so (`bore: 'L'`); an S port says nothing.
  const familiesOf = (shape) => shape.families ?? Object.keys(data.families ?? {}).filter((f) => (data.families[f].profiles ?? Object.keys(data.profiles)).includes(shape.profile ?? 'S'));
  for (const [fid, family] of Object.entries(data.families ?? {})) {
    for (const shape of data.shapes ?? []) {
      const fams = familiesOf(shape);
      if (!fams.includes(fid)) continue;
      const first = fams[0];
      const pid = shape.profile ?? 'S';
      const profile = data.profiles?.[pid];
      if (!profile) throw new Error(`tunnel kit: ${shape.id}: no profile ${pid}`);
      const special = shape.joint ? null : shape.kind ? specialParts(profile, family, shape, data.profiles) : null;
      const joined = shape.joint ? jointParts(data, family, data.families[shape.joint], fid, shape) : null;
      const parts = joined ?? special ?? moduleParts(profile, family, shape);
      const ports = (joined?.ports ?? special?.ports ?? [...shape.arms, ...(shape.mouth ? [shape.mouth] : [])].map((side) => ({ side, level: 0 }))).map((p) => (pid !== 'S' && shape.kind !== 'reducer' ? { ...p, bore: pid } : p));
      out.push({
        id: `core.tunnel_${fid}_${shape.id}`,
        category: 'Tunnels',
        displayName: `${family.label} ${shape.name}`.trim(),
        blurb: `${shape.blurb} ${family.blurb}`,
        cells: joined?.cells ?? special?.cells ?? [[0, 0, 0]],
        floors: [],
        ports,
        edgeDefault: 'open',
        familyOf: { base: `core.tunnel_${first}_${shape.id}`, family: fid, label: `${family.label.replace(/ Tunnel$/, '')}${family.preview ? ' (preview)' : ''}` },
        extraFloors: joined?.floors ?? special?.floors ?? [parts.floor],
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
