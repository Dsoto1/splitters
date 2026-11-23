/**
 * Checks on a set piece's definition beyond its schema (SetPieceDefinition in schema.ts): what it names exists (tiles,
 * props, materials, role packs), its footprint covers every part, its ports are on its outside, its markers name its
 * parts, and a piece placed mirrored is a mirror image. The content pipeline runs it on content/setpieces/
 * (tools/content/setpieces.mjs); MapMaker runs it on a piece saved from a selection or imported.
 */
import { getProp } from '../content/props.ts';
import { SIDE_DIRS, coreCatalog, type Side, type TileCatalog } from './catalog.ts';
import { rotateXZ, yawXZ } from './geometry.ts';
import { coreMaterials } from './materials.ts';
import type { SetPieceDefinition } from './schema.ts';
import { SET_PIECE_GRID, setPieceMirrorProblem, type SetPieceRolePack } from './setPieces.ts';

/** Room to spare at the footprint's edge (a door's leaves sit on the cell boundary). */
const EDGE = 1e-6;
/**
 * How far past the footprint's edge a prop that collides as nothing may stand: one drawn on an outer wall's face (a
 * stained-glass window drawn on both faces of the wall it is set in, its outer face a hair proud of the wall's).
 */
const FACE = 0.05;
/**
 * How far under its lowest level's floor a part may reach: a sunk floor's footings, steps and furniture (the Sunk
 * Room's slab is half a metre down, `core.room_sunk`; St. John's step 7d).
 */
const SUNK = 1;
/**
 * How far a roof's eaves may reach out of the footprint: a prop that collides as nothing and stands a storey or more over the piece's lowest
 * floor (a roof bay on its walls' top, a spire) may overhang the footprint by this much. Nobody walks there, and a
 * neighbour's own walls stop at the cell's edge under it.
 */
const EAVE = 0.75;

/** What is wrong with a definition (empty: nothing). `packs`: the role packs it may name. */
export function checkSetPieceDefinition(def: SetPieceDefinition, opts: { packs?: ReadonlyMap<string, SetPieceRolePack>; catalog?: TileCatalog } = {}): string[] {
  const catalog = opts.catalog ?? coreCatalog;
  const out: string[] = [];
  const { cellSize, levelHeight } = SET_PIECE_GRID;
  const cells = new Set(def.footprint.cells.map(([x, y]) => `${x},${y}`));
  if (cells.size !== def.footprint.cells.length) out.push('footprint: a cell is listed twice');
  const [l0, l1] = def.footprint.levels;
  if (l0 > l1) out.push(`footprint: levels [${l0}, ${l1}] go from the lowest to the highest`);
  const inCell = (x: number, y: number, z: number) => cells.has(`${x},${y}`) && z >= l0 && z <= l1;
  /** Whether a point in metres (piece frame) is over the footprint, within its levels. */
  const inside = (px: number, py: number, pz: number, edge = EDGE) => {
    if (py < l0 * levelHeight - SUNK - EDGE || py > (l1 + 1) * levelHeight + EDGE) return false;
    const near = (v: number) => [Math.floor((v + cellSize / 2 + edge) / cellSize), Math.floor((v + cellSize / 2 - edge) / cellSize)];
    return near(px).some((cx) => near(pz).some((cy) => cells.has(`${cx},${cy}`)));
  };
  for (const pack of def.packs) if (opts.packs && !opts.packs.has(pack)) out.push(`packs: ${pack} is not a role pack (content/setpieces/roles.json)`);
  const material = (m: string, where: string) => {
    if (!coreMaterials.get(m)) out.push(`${where}: ${m} is not a material (content/materials.json)`);
  };
  for (const [role, v] of Object.entries(def.roles ?? {})) if (v && typeof v === 'object') material(v.material, `roles.${role}`);

  def.parts.forEach((part, i) => {
    const where = `parts[${i}] (${part.kind})`;
    if (part.kind === 'tile') {
      const t = catalog.get(part.tile);
      if (!t) {
        out.push(`${where}: ${part.tile} is not a tile`);
        return;
      }
      const own = new Set(t.cells.map((c) => `${c[0]},${c[1]},${c[2]}`));
      for (const [dx, dy, dz] of t.cells) {
        const [rx, ry] = rotateXZ(dx, dy, part.rotation);
        if (!inCell(part.x + rx, part.y + ry, part.z + dz)) out.push(`${where}: ${t.id}'s cell [${dx}, ${dy}, ${dz}] lands at [${part.x + rx}, ${part.y + ry}, ${part.z + dz}], outside the footprint`);
      }
      const keys = [...Object.keys(part.edges ?? {}), ...Object.keys(part.glass ?? {})].map((k) => k.split(':')[0]!);
      for (const k of [...keys, ...(part.upperFloors ?? [])]) if (!own.has(k)) out.push(`${where}: ${k} is not one of ${t.id}'s own cells (edge, glass and floor keys are in the tile's frame)`);
      for (const [slot, s] of Object.entries(part.surfaces ?? {})) if (s && 'material' in s) material(s.material, `${where}.surfaces.${slot}`);
      // A facade dresses the outer walls of any tile's cells (map/geometry.ts packFacadeBoxes): a stairwell in a hall's
      // front wears the hall's stone. Layouts, floor inserts, ceilings and corners are a Room's alone.
      if (part.options && !t.configurable && Object.keys(part.options).some((k) => k !== 'facade')) out.push(`${where}: ${t.id} takes no room options (a facade only)`);
      return;
    }
    const [px, py, pz] = part.position;
    if (part.kind === 'block') {
      if (typeof part.material === 'string') material(part.material, `${where}.material`);
      // Its four corners (turned) and its top.
      const [w, h, d] = part.size;
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        const [ox, oz] = yawXZ((sx * w) / 2, (sz * d) / 2, part.yaw);
        if (!inside(px + ox, py, pz + oz) || !inside(px + ox, py + h, pz + oz)) {
          out.push(`${where}: its corner at [${(px + ox).toFixed(2)}, ${(pz + oz).toFixed(2)}] (up to ${(py + h).toFixed(2)} m) is outside the footprint`);
          break;
        }
      }
      return;
    }
    if (part.kind === 'prop') {
      const prop = getProp(part.model);
      if (!prop) out.push(`${where}: ${part.model} is not a prop`);
      else {
        // Its own box, turned as it stands (a bed against the wall at the footprint's edge is inside it).
        const [w, h, d] = prop.size.map((v) => v * part.scale) as [number, number, number];
        const corners = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sz]) => yawXZ((sx * w) / 2, (sz * d) / 2, part.yaw));
        const edge = prop.collision === null && !prop.boxes?.length ? (py >= (l0 + 1) * levelHeight - EDGE ? EAVE : FACE) : EDGE;
        if (!corners.every(([ox, oz]) => inside(px + ox, py, pz + oz, edge) && inside(px + ox, py + h, pz + oz, edge))) out.push(`${where}: ${part.model} reaches outside the footprint`);
      }
      return;
    }
    if (!inside(px, py, pz)) out.push(`${where}: at [${px}, ${py}, ${pz}], outside the footprint`);
  });

  // Ports: on a footprint cell and level, facing a cell outside it.
  def.ports.forEach((p, i) => {
    const [x, y] = p.cell;
    if (!inCell(x, y, p.level)) out.push(`ports[${i}]: cell [${x}, ${y}] on level ${p.level} is not in the footprint`);
    const [dx, dy] = SIDE_DIRS[p.side as Side];
    if (inCell(x + dx, y + dy, p.level)) out.push(`ports[${i}]: side ${p.side} of [${x}, ${y}] faces the piece's own cell [${x + dx}, ${y + dy}], not its outside`);
  });
  // Options: names once each, values once each; a part's `when` names an option and one of its choices.
  const choiceSets = new Map<string, Set<string>>();
  for (const o of def.options ?? []) {
    if (choiceSets.has(o.name)) out.push(`options: ${o.name} is listed twice`);
    const values = new Set(o.choices.map((c) => c.value));
    if (values.size !== o.choices.length) out.push(`options.${o.name}: a choice is listed twice`);
    choiceSets.set(o.name, values);
  }
  def.parts.forEach((part, i) => {
    for (const [k, v] of Object.entries(part.when ?? {})) {
      if (!choiceSets.has(k)) out.push(`parts[${i}].when: ${k} is not one of the piece's options`);
      else for (const one of typeof v === 'string' ? [v] : v) if (!choiceSets.get(k)!.has(one)) out.push(`parts[${i}].when: ${k} has no choice "${one}"`);
    }
  });
  for (const m of def.markers ?? []) {
    for (const i of m.parts) if (i >= def.parts.length) out.push(`markers.${m.name}: part ${i} doesn't exist`);
    if (m.kind === 'doorPair' && (m.parts.length !== 2 || m.parts.some((i) => def.parts[i]?.kind !== 'door'))) out.push(`markers.${m.name}: a door pair is two doors`);
  }
  if (def.mirror === 'free') {
    const why = setPieceMirrorProblem(def, catalog);
    if (why) out.push(`mirror: "free", but ${why}: say "none"`);
  }
  return out;
}
