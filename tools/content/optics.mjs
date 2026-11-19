// Optics by gun (owner, 2026-11-18, "Sights and scopes pass" (2): real optics by gun: red dot or holographic for close
// range, 2-3x for rifles and carbines, a full scope for snipers, each with its own reticle). content/optics.json says
// what each kind of optic is and which gun carries which; this tool checks it against the weapons and the sight fit
// and writes the table the client reads:
//   - every hand-held gun has an entry (`weapons`) or a reason for none (`none`); mounted guns, melee and tools have
//     neither;
//   - `irons` needs a sight fit (tools/content/sight-fit.mjs); a `model` housing needs the weapon's `view.optic`, an
//     `overlay` its `view.zoomFov`; a weapon's own zoom lies inside its kind's range (a zoom is a balance number: it
//     stays in the weapon file, and nothing here changes it);
//   - a `tube` or `frame` housing is built in code on the gun's top: the tool measures where from the model (the
//     mount: the rearmost flat stretch of the top, between the hand and the middle of the gun, that the rest of the gun
//     does not stand in front of), sizes it to the gun, and tests that the line from the eye through the glass is clear.
//
//   node tools/content/optics.mjs            write packages/shared/src/content/optics.generated.ts
//   node tools/content/optics.mjs --check    fail when it is out of date or the data is wrong
//   node tools/content/optics.mjs --report   the table: per weapon its optic, zoom and mount
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { aimDepth, boundsOf, firstHit, fitAll, modelTriangles, readWeapons } from './sight-fit.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MODELS = join(ROOT, 'packages/client/public/models');
export const OPTICS_FILE = join(ROOT, 'content/optics.json');
export const OPTICS_TS = join(ROOT, 'packages/shared/src/content/optics.generated.ts');

/** The hip's vertical field of view (radians): the client's DEFAULT_FOV (view.ts; the client's optics test holds them equal). */
export const HIP_FOV = 1.35;
export const RETICLES = ['none', 'dot', 'ring', 'chevron', 'fine'];
export const HOUSINGS = ['none', 'tube', 'frame', 'model', 'overlay'];
/** A gun this long (m) carries a housing at scale 1; shorter and longer guns scale theirs, within SCALE. */
const SCALE_LENGTH = 0.75;
const SCALE = [0.85, 1.2];
/** The top under a housing's foot may vary this much (m): rails, ribs and seams. */
const FLAT = 0.006;
/** Cell of the top profile (m). */
const CELL = 0.002;

const round = (v, k = 1e5) => Math.round(v * k) / k || 0;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Magnification over the hip view of a vertical field of view (radians). */
export const magOf = (fov) => Math.tan(HIP_FOV / 2) / Math.tan(fov / 2);

/** Why a weapon needs no optic entry by its own nature (null: it is aimed in the hand). */
export function byNature(w) {
  if (w.slot === 0) return 'mounted: never held in the hand';
  if (w.kind === 'melee') return 'melee or a tool: no aiming down sights';
  return null;
}

/**
 * The top of the gun along its length, within `half` of the plane x = `cx`: per cell of z, the highest point.
 * Returns { top: Float64Array, zOf(i), n }.
 */
function topProfile(tris, cx, half, min, max) {
  const n = Math.max(2, Math.ceil((max[2] - min[2]) / CELL) + 1);
  const top = new Float64Array(n).fill(-Infinity);
  for (const [A, B, C] of tris) {
    if (Math.max(A[0], B[0], C[0]) < cx - half || Math.min(A[0], B[0], C[0]) > cx + half) continue;
    const L = Math.max(Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), Math.hypot(C[0] - A[0], C[1] - A[1], C[2] - A[2]), Math.hypot(C[0] - B[0], C[1] - B[1], C[2] - B[2]));
    const k = Math.min(600, Math.max(1, Math.ceil(L / (CELL / 2))));
    for (let i = 0; i <= k; i++) {
      for (let j = 0; j <= k - i; j++) {
        const [u, v] = [i / k, j / k];
        const x = A[0] + (B[0] - A[0]) * u + (C[0] - A[0]) * v;
        if (x < cx - half || x > cx + half) continue;
        const y = A[1] + (B[1] - A[1]) * u + (C[1] - A[1]) * v;
        const z = A[2] + (B[2] - A[2]) * u + (C[2] - A[2]) * v;
        const c = Math.round((z - min[2]) / CELL);
        if (y > top[c]) top[c] = y;
      }
    }
  }
  return { top, n, zOf: (i) => min[2] + i * CELL };
}

/**
 * Where a code-built housing stands on a gun: `at` (model space as `view.muzzleAt`: the middle of its foot, on the
 * gun's top) and `scale`. The foot wants a flat stretch of the top; of those between the hand and the middle of
 * the gun, the rearmost (nearest the eye: the biggest window) whose window nothing ahead of it stands in.
 * `glass`: the kind's { rise, half, length } at scale 1. Null when the gun has no such stretch.
 */
export function fitMount(tris, { grip, muzzle, glass }) {
  const [min, max] = boundsOf(tris);
  const scale = round(clamp((max[2] - min[2]) / SCALE_LENGTH, SCALE[0], SCALE[1]), 100);
  const cx = 0;
  const foot = glass.length * scale;
  const { top, n, zOf } = topProfile(tris, cx, glass.half[0] * scale * 0.6, min, max);
  // The highest and lowest of the top over a stretch (`whole`: null when part of it has no gun under it).
  const span = (z0, z1, whole = true) => {
    let hi = -Infinity;
    let lo = Infinity;
    for (let i = Math.max(0, Math.floor((z0 - min[2]) / CELL)); i <= Math.min(n - 1, Math.ceil((z1 - min[2]) / CELL)); i++) {
      if (top[i] === -Infinity) {
        if (whole) return null;
        continue;
      }
      hi = Math.max(hi, top[i]);
      lo = Math.min(lo, top[i]);
    }
    return hi === -Infinity ? null : { hi, lo };
  };
  const from = Math.max(min[2] + foot / 2, grip[2]);
  const to = Math.min(max[2] - foot / 2, (grip[2] + muzzle[2]) / 2 + 0.06);
  let best = null;
  for (let z = from; z <= to; z += CELL) {
    const s = span(z - foot / 2, z + foot / 2);
    if (!s || s.hi - s.lo > FLAT) continue;
    // Nothing ahead may stand in the lower half of the window (the glass's middle and up stay clear of the gun).
    const ahead = span(z + foot / 2, max[2], false);
    const sill = s.hi + (glass.rise - glass.half[1] * 0.5) * scale;
    const clear = !ahead || ahead.hi <= sill;
    if (clear) return { at: [cx, round(s.hi), round(z)], scale };
    if (!best || s.hi > best.at[1]) best = { at: [cx, round(s.hi), round(z)], scale, blocked: true };
  }
  return best;
}

/** The eye point and the glass's middle of a mounted optic (model space), as the client places them (game/optics.ts). */
export function mountedLine(w, min, mount, glass) {
  const y = mount.at[1] + glass.rise * mount.scale;
  return { eye: [mount.at[0], y, -aimDepth(w.view.viewOffset[2], min[2])], glass: [mount.at[0], y, mount.at[2]] };
}

export function readOpticsFile() {
  return JSON.parse(readFileSync(OPTICS_FILE, 'utf8'));
}

/** Every weapon's optics from content/optics.json, checked; `problems` says what is wrong. */
export async function buildOptics() {
  const file = readOpticsFile();
  const problems = [];
  const weapons = readWeapons();
  const { fits } = await fitAll();
  const kinds = file.kinds ?? {};
  for (const [id, k] of Object.entries(kinds)) {
    const at = `content/optics.json: kind ${id}`;
    if (typeof k.name !== 'string' || !k.name) problems.push(`${at} needs a name`);
    if (!RETICLES.includes(k.reticle)) problems.push(`${at}: reticle ${k.reticle} is not one of ${RETICLES.join(', ')}`);
    if (!HOUSINGS.includes(k.housing)) problems.push(`${at}: housing ${k.housing} is not one of ${HOUSINGS.join(', ')}`);
    const built = k.housing === 'tube' || k.housing === 'frame';
    const magnified = k.housing === 'model' || k.housing === 'overlay';
    if (magnified ? !(Array.isArray(k.mag) && k.mag.length === 2 && k.mag[0] >= 1 && k.mag[1] > k.mag[0]) || k.adsFov !== undefined : !(k.adsFov > 0.3 && k.adsFov <= 1) || k.mag !== undefined)
      problems.push(`${at}: ${magnified ? 'a magnified optic gives `mag` [least, most]' : 'sights at 1x give `adsFov` (a share of the hip field of view)'}, and only that`);
    if (built && !(k.glass && k.glass.rise > 0 && Array.isArray(k.glass.half) && k.glass.half[0] > 0 && k.glass.half[1] > 0 && k.glass.length > 0 && k.glass.rise > k.glass.half[1])) problems.push(`${at}: a housing built in code needs glass { rise, half: [w, h], length }, the window clear of its foot`);
    if (built && !(k.mark && k.mark.dot > 0 && k.mark.dot < 0.006 && (k.reticle !== 'ring' || (k.mark.ring > k.mark.dot && k.mark.ring < 0.05)))) problems.push(`${at}: its reticle needs mark { dot${k.reticle === 'ring' ? ', ring' : ''} } (tangents of the angle at the eye; a dot under 0.006)`);
    if (!built && (k.glass || k.mark)) problems.push(`${at}: only a housing built in code has glass and a mark`);
  }
  const out = {};
  const none = {};
  const report = [];
  for (const w of weapons) {
    const own = byNature(w);
    const entry = file.weapons?.[w.id];
    const reason = file.none?.[w.id];
    if (own) {
      none[w.id] = own;
      if (entry || reason) problems.push(`content/optics.json: ${w.id} needs no entry (${own})`);
      continue;
    }
    if (entry && reason) problems.push(`content/optics.json: ${w.id} has both an optic and a reason for none`);
    if (!entry) {
      if (typeof reason !== 'string' || reason.length < 12)
        problems.push(`${w.id} (${w.displayName}) has no optic: give it one in content/optics.json \`weapons\` ({ "default": kind, "allowed": [kinds] }) or a reason under \`none\`, then run node tools/content/optics.mjs and look at it on the sight sheet (?mode=sights; docs/GUNPLAY_SPEC.md §15, "Optics by gun")`);
      else none[w.id] = reason;
      if (reason && (w.view?.zoomFov || w.view?.optic)) problems.push(`content/optics.json: ${w.id} has a scope or an optic of its own (its weapon file), so it cannot be under \`none\``);
      continue;
    }
    const at = `content/optics.json: ${w.id}`;
    const allowed = entry.allowed;
    if (!Array.isArray(allowed) || !allowed.length || new Set(allowed).size !== allowed.length) {
      problems.push(`${at} needs \`allowed\`: the kinds it may carry, each once`);
      continue;
    }
    if (!allowed.includes(entry.default)) problems.push(`${at}: its default (${entry.default}) is not among its allowed optics`);
    const row = { default: entry.default, allowed: [...allowed] };
    let tris = null;
    let bounds = null;
    for (const id of allowed) {
      const k = kinds[id];
      if (!k) {
        problems.push(`${at}: no optic kind ${id}`);
        continue;
      }
      if (k.housing === 'none' && !fits[w.id]) problems.push(`${at}: iron sights need a sight fit, and this gun has none (content/sight-fit.json)`);
      if (k.housing !== 'none' && k.housing !== 'model' && k.housing !== 'overlay' && (w.view?.zoomFov || w.view?.optic)) problems.push(`${at}: it has a scope or an optic of its own in its weapon file, so it cannot also carry a ${id}`);
      if (k.housing === 'model' || k.housing === 'overlay') {
        const own = w.view?.zoomFov ? magOf(w.view.zoomFov) : w.view?.optic?.mag;
        if (!own) problems.push(`${at}: a ${id} needs the weapon's own zoom (\`view.zoomFov\`, or \`view.optic\` for the model's own tube)`);
        else {
          if (own < k.mag[0] || own > k.mag[1]) problems.push(`${at}: its zoom (${own.toFixed(2)}x) is outside a ${id}'s (${k.mag[0]}-${k.mag[1]}x): choose the kind that matches the zoom the gun has (a zoom change is a balance change: content/weapons)`);
          if (allowed.length > 1) problems.push(`${at}: a gun with a zoom of its own carries that optic only, for now`);
          row.mag = round(own, 100);
          if (w.view?.optic && (w.view.optic.reticle ?? 'duplex') !== k.reticle) problems.push(`${at}: its weapon file's view.optic.reticle (${w.view.optic.reticle ?? 'duplex'}) is not the ${id}'s (${k.reticle})`);
        }
      }
      if ((k.housing === 'tube' || k.housing === 'frame') && k.glass && /\.glb$/.test(w.view?.model ?? '')) {
        tris ??= await modelTriangles(join(MODELS, w.view.model));
        bounds ??= boundsOf(tris);
        const [min, max] = bounds;
        const hand = entry.mount;
        if (hand && (typeof hand.reason !== 'string' || hand.reason.length < 8 || !Array.isArray(hand.at) || hand.at.length !== 3)) problems.push(`${at}: a hand-set mount needs \`at\` [x, y, z] and its reason`);
        const mount = hand?.at ? { at: hand.at, scale: hand.scale ?? round(clamp((max[2] - min[2]) / SCALE_LENGTH, SCALE[0], SCALE[1]), 100) } : fitMount(tris, { grip: w.view.hold?.grip ?? [0, 0, min[2] + (max[2] - min[2]) * 0.3], muzzle: w.view.muzzleAt ?? [0, 0, max[2]], glass: k.glass });
        if (!mount) {
          problems.push(`${at}: no flat stretch on its top to stand a ${id} on: give it a \`mount\` ({ at, reason }) read off the model, or another optic`);
          continue;
        }
        if (mount.blocked) problems.push(`${at}: the gun stands in a ${id}'s window wherever it is mounted (best: ${JSON.stringify(mount.at)}): give it a \`mount\` ({ at, reason }) read off the model, or another optic`);
        const line = mountedLine(w, min, mount, k.glass);
        if (firstHit(tris, line.eye, [line.glass[0], line.glass[1], max[2] + 1]) !== null) problems.push(`${at}: the gun stands in the line from the eye through a ${id}'s glass (mount ${JSON.stringify(mount.at)}): give it a \`mount\` ({ at, reason }) read off the model`);
        // One mount serves every housing the gun may carry: the default's.
        if (id === entry.default || !row.mount) row.mount = { at: mount.at.map((v) => round(v)), scale: mount.scale, ...(hand?.at ? { set: true } : {}) };
      }
    }
    out[w.id] = row;
    const k = kinds[row.default];
    report.push(`| ${w.id} | ${k?.name ?? row.default} | ${row.mag ? `${row.mag.toFixed(2)}x` : k?.adsFov ? `${magOf(HIP_FOV * k.adsFov).toFixed(2)}x (sights)` : ''} | ${row.allowed.join(', ')} | ${row.mount ? `${JSON.stringify(row.mount.at)} x${row.mount.scale}${row.mount.set ? ' (set by hand)' : ''}` : '-'} |`);
  }
  for (const id of [...Object.keys(file.weapons ?? {}), ...Object.keys(file.none ?? {})]) if (!weapons.some((w) => w.id === id)) problems.push(`content/optics.json: no weapon ${id}`);
  return { kinds, weapons: out, none, problems, report };
}

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const list = (a) => `[${a.join(', ')}]`;

/** The generated table's TypeScript. */
export function opticsSource({ kinds, weapons, none }) {
  const kindLines = Object.entries(kinds).map(([id, k]) => {
    const parts = [`name: ${q(k.name)}`, `reticle: ${q(k.reticle)}`, `housing: ${q(k.housing)}`];
    if (k.adsFov !== undefined) parts.push(`adsFov: ${k.adsFov}`);
    if (k.mag) parts.push(`mag: ${list(k.mag)}`);
    if (k.glass) parts.push(`glass: { rise: ${k.glass.rise}, half: ${list(k.glass.half)}, length: ${k.glass.length} }`);
    if (k.mark) parts.push(`mark: { dot: ${k.mark.dot}${k.mark.ring ? `, ring: ${k.mark.ring}` : ''} }`);
    return `  ${id}: { ${parts.join(', ')} },`;
  });
  const weaponLines = Object.keys(weapons)
    .sort()
    .map((id) => {
      const w = weapons[id];
      const parts = [`default: ${q(w.default)}`, `allowed: ${list(w.allowed.map(q))}`];
      if (w.mag) parts.push(`mag: ${w.mag}`);
      if (w.mount) parts.push(`mount: { at: ${list(w.mount.at)}, scale: ${w.mount.scale} }`);
      return `  ${q(id)}: { ${parts.join(', ')} },`;
    });
  const noneLines = Object.keys(none)
    .sort()
    .map((id) => `  ${q(id)}: ${q(none[id])},`);
  return `// Generated by tools/content/optics.mjs from content/optics.json, the weapons and the gun models. Do not edit by hand:
// run \`node tools/content/optics.mjs\` (pnpm content:check fails until you do). Loaded with the first weapon drawn in
// first person, not with the menu.

/** The optic kinds (content/optics.json \`kinds\`). */
export type OpticKindId = ${Object.keys(kinds).map(q).join(' | ')};
/** What an optic's aim mark is: none (iron sights), a dot or a ring and dot on its glass, a chevron or a fine crosshair with holdover marks. */
export type OpticReticle = ${RETICLES.map(q).join(' | ')};
/** How it is drawn: the gun's own sights, a housing built in code (a tube, a frame), the model's own scope tube, or the full-screen scope. */
export type OpticHousing = ${HOUSINGS.map(q).join(' | ')};

export interface OpticKind {
  name: string;
  reticle: OpticReticle;
  housing: OpticHousing;
  /** Sights at 1x: the aimed field of view as a share of the hip's. */
  adsFov?: number;
  /** A magnified optic: the least and most magnification over the hip view it covers (each weapon's own is \`WeaponOptics.mag\`). */
  mag?: readonly [number, number];
  /** A housing built in code (metres at scale 1): the window's middle over the mount, its half width and height, the housing's length. */
  glass?: { rise: number; half: readonly [number, number]; length: number };
  /** Its mark's sizes: tangents of the angle at the eye. */
  mark?: { dot: number; ring?: number };
}

export const OPTIC_KINDS: Readonly<Record<OpticKindId, OpticKind>> = {
${kindLines.join('\n')}
};

/**
 * A weapon's optics: the one it carries and those it may carry (the loadout's choice comes later). \`mag\`: its own
 * magnification over the hip view (from its weapon file's \`view.zoomFov\` or \`view.optic\`). \`mount\`: where a
 * housing built in code stands (model space as \`view.muzzleAt\`: the middle of its foot on the gun's top) and its size.
 */
export interface WeaponOptics {
  default: OpticKindId;
  allowed: readonly OpticKindId[];
  mag?: number;
  mount?: { at: readonly [number, number, number]; scale: number };
}

/** Per hand-held gun that carries an optic (iron sights included). */
export const WEAPON_OPTICS: Readonly<Record<string, WeaponOptics>> = {
${weaponLines.join('\n')}
};

/** The weapons without one, and why: they keep the aim they had (or never aim: mounted, melee, tools). */
export const OPTIC_NONE: Readonly<Record<string, string>> = {
${noneLines.join('\n')}
};
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await buildOptics();
  if (process.argv.includes('--report')) console.log(['| Weapon | Optic | Zoom | Allowed | Mount |', '|---|---|---|---|---|', ...result.report, '', 'None:', ...Object.keys(result.none).sort().map((id) => `- ${id}: ${result.none[id]}`)].join('\n'));
  const text = opticsSource(result);
  const problems = [...result.problems];
  if (process.argv.includes('--check')) {
    if (!existsSync(OPTICS_TS) || readFileSync(OPTICS_TS, 'utf8') !== text) problems.push('packages/shared/src/content/optics.generated.ts is out of date (run node tools/content/optics.mjs)');
  } else if (!problems.length && !process.argv.includes('--report')) writeFileSync(OPTICS_TS, text);
  for (const p of problems) console.error(p);
  if (problems.length) process.exit(1);
  console.log(`optics: ${Object.keys(result.weapons).length} weapons with an optic, ${Object.keys(result.none).length} without`);
}
