// Kit props (docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6; docs/CONTENT_PIPELINE.md, "Kit props"): simple man-made
// props generated in code from seeds, the way the environment species are (tools/content/environment.mjs).
//
//   node tools/content/kitprops.mjs           build: GLBs in packages/client/public/kit/, the lock, the generated table
//   node tools/content/kitprops.mjs --check   rebuild in memory and check every output is byte-identical to what is shipped
//
// Reads content/kitprops.json (generator version, pack, budgets, aliases) and content/kitprops/<type>.json (families:
// id `kit.<type>.<name>`). A family is one catalogue prop: its size, collision (the box: every family fills its bounds),
// surface, breakable data and palette category; its variants share all of that and differ in structure (their seed
// and `set` settings) and look; a family that replaces a prop nothing collided with says `collide: "none"` (a traffic
// cone). A part of a larger build drawn where it belongs in it says `bounds: "within"` (the dome kit: a panel stands
// up on its drum, round the dome's axis): it stays inside its size and need not fill it, and it collides as its own
// boxes or not at all. Each variant is kit/<type>.<name>.<variant>.glb with its levels of detail. Writes
// content/kitprops.lock.json (sha, bytes, triangles per level, generator and asset versions) and
// packages/shared/src/content/kitProps.generated.ts (the families as PropDefinitions, their variants' files, the aliases).
// Deterministic: only seeded random numbers (env/rng.mjs), vertex data rounded before writing.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, shape, tsInline } from './weapons.mjs';
import { formatLock, readLock } from './lockfile.mjs';
import { surfaceTypeIds } from './surface-types.mjs';
import { loadPropManifest } from './props-manifest.mjs';
import { writeKitModel } from './kit/glb.mjs';
import { binMesh, crateMesh, framedCrateMesh } from './kit/crate.mjs';
import { drumMesh } from './kit/drum.mjs';
import { cartonMesh } from './kit/carton.mjs';
import { barrierMesh, fenceMesh, railingMesh, stoneWallMesh } from './kit/fence.mjs';
import { containerMesh } from './kit/container.mjs';
import { bookcaseMesh, officeChairMesh, roundTableMesh, seatMesh, tableMesh } from './kit/furniture.mjs';
import { counterMesh, shelfMesh, stallMesh, wasteBinMesh } from './kit/shop.mjs';
import { cornerSofaMesh, sofaMesh } from './kit/sofa.mjs';
import { bedMesh } from './kit/bed.mjs';
import { applianceMesh, cabinetMesh, freezerMesh } from './kit/cabinet.mjs';
import { conveyorMesh, signMesh, yokeCrateMesh } from './kit/factory.mjs';
import { bakeryMesh, bottleReturnMesh, cartMesh, checkoutMesh, chestFreezerMesh, produceMesh } from './kit/market.mjs';
import { consoleMesh, valveMesh } from './kit/plant.mjs';
import { cogMesh, hopperMesh, leverMesh, machineMesh, pistonMesh, scannerMesh, tallHopperMesh, windowMachineMesh } from './kit/machines.mjs';
import { anvilMesh, coneMesh, glassPipeMesh, pipeStubMesh, workbenchMesh } from './kit/yard.mjs';
import { coolantPipeMesh, pipeJunctionMesh } from './kit/pipes.mjs';
import { closetFrontMesh, closetMesh, deskHutchMesh, doorMesh } from './kit/academy.mjs';
import { domeArchMesh, domeCapMesh, domeDrumMesh, domeMesh, domePanelMesh, domeTrimMesh } from './kit/dome.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST = 'content/kitprops.json';
const TYPES = 'content/kitprops';
const LOCK = 'content/kitprops.lock.json';
const OUT = 'packages/client/public/kit';
const SHARED = 'packages/shared/src/content/kitProps.generated.ts';

/** Generator kinds and what makes each. */
export const KINDS = { crate: crateMesh, framed: framedCrateMesh, bin: binMesh, drum: drumMesh, carton: cartonMesh, fence: fenceMesh, railing: railingMesh, stonewall: stoneWallMesh, barrier: barrierMesh, container: containerMesh, table: tableMesh, seat: seatMesh, bookcase: bookcaseMesh, shelf: shelfMesh, stall: stallMesh, counter: counterMesh, wastebin: wasteBinMesh, sofa: sofaMesh, cabinet: cabinetMesh, appliance: applianceMesh, roundtable: roundTableMesh, officechair: officeChairMesh, bed: bedMesh, cornersofa: cornerSofaMesh, yokecrate: yokeCrateMesh, sign: signMesh, conveyor: conveyorMesh, freezer: freezerMesh, cart: cartMesh, bakery: bakeryMesh, checkout: checkoutMesh, chestfreezer: chestFreezerMesh, bottlereturn: bottleReturnMesh, produce: produceMesh, console: consoleMesh, valve: valveMesh, machine: machineMesh, windowmachine: windowMachineMesh, hopper: hopperMesh, tallhopper: tallHopperMesh, piston: pistonMesh, scanner: scannerMesh, lever: leverMesh, cog: cogMesh, glasspipe: glassPipeMesh, pipestub: pipeStubMesh, workbench: workbenchMesh, cone: coneMesh, anvil: anvilMesh, coolantpipe: coolantPipeMesh, pipejunction: pipeJunctionMesh, dome: domeMesh, domecap: domeCapMesh, domepanel: domePanelMesh, domedrum: domeDrumMesh, dometrim: domeTrimMesh, domearch: domeArchMesh, door: doorMesh, deskhutch: deskHutchMesh, closet: closetMesh, closetfront: closetFrontMesh };
const { num, int, str, en, tup, arr, obj, map } = shape;
const ID = /^kit\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;
const mm = (v) => Math.round(v * 1000) / 1000;
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

export function load(root = ROOT) {
  const manifest = readJson(root, MANIFEST);
  const types = readdirSync(join(root, TYPES)).filter((f) => f.endsWith('.json')).sort().map((f) => ({ file: `${TYPES}/${f}`, data: readJson(root, `${TYPES}/${f}`) }));
  return { manifest, types };
}

/** Check the content's shape and references: { problems, families }. */
export function validate(content, root = ROOT) {
  const problems = [];
  const surfaceTypes = new Set(surfaceTypeIds(root));
  const details = new Map(readJson(root, 'content/surfaces.json').surfaces.map((s) => [s.id, s]));
  const catalogue = loadPropManifest();
  const categories = new Set(catalogue.props.map((p) => p.category));
  const m = content.manifest;
  problems.push(...check(m, obj({ $comment: str, generatorVersion: int, pack: obj({ id: str, title: str, creator: str, url: str, license: str, licenseFile: str }), budgets: obj({ maxBytes: int, triangles: map(arr(int, 1)) }), aliases: map(obj({ model: str, variant: int, scale: num })) }), MANIFEST));
  for (const k of Object.keys(m.budgets?.triangles ?? {})) if (!KINDS[k]) problems.push(`${MANIFEST}: budgets.triangles.${k}: not a generator kind (${Object.keys(KINDS).join(', ')})`);
  const families = [];
  const ids = new Set();
  for (const { file, data } of content.types) {
    for (const k of Object.keys(data)) if (!['$comment', 'type', 'props'].includes(k)) problems.push(`${file}: unknown field "${k}"`);
    const spec = obj({
      id: str, displayName: str, category: str, assetVersion: int, notes: map(str), size: tup(3), 'bounds?': en(['within']), 'collide?': en(['none']), surface: str, detail: str,
      'breakable?': obj({ health: num, debris: str, 'blast?': obj({ radius: num, damage: num, edge: num }) }),
      generator: obj({ kind: en(Object.keys(KINDS)) }),
      lods: arr(obj({ distance: num }), 1),
      variants: arr(obj({ index: int, name: str, seed: int, look: map(str), 'set?': map(str) }), 1),
    });
    for (const [i, p] of (data.props ?? []).entries()) {
      const where = `${file}: props[${i}] (${p?.id})`;
      // Generator settings are the generator's own (checked by what it reads); the rest is strict.
      const bad = check({ ...p, generator: { kind: p?.generator?.kind }, variants: (p?.variants ?? []).map((v) => ({ index: v?.index, name: v?.name, seed: v?.seed, look: {}, ...(v?.set ? { set: {} } : {}) })) }, spec, where);
      problems.push(...bad);
      if (bad.length) continue;
      if (!ID.test(p.id) || p.id.split('.')[1] !== data.type) problems.push(`${where}: id must be kit.${data.type}.<name> (lower case, digits, _)`);
      if (ids.has(p.id)) problems.push(`${where}: id listed twice`);
      ids.add(p.id);
      if (!categories.has(p.category)) problems.push(`${where}: category ${p.category} is no prop category of content/props/*.json (the palette groups by them)`);
      if (!surfaceTypes.has(p.surface)) problems.push(`${where}: surface ${p.surface} is not a surface type (content/surface-types.json)`);
      if (!details.has(p.detail)) problems.push(`${where}: detail ${p.detail} is not a surface of content/surfaces.json`);
      if (!p.notes[String(p.assetVersion)]) problems.push(`${where}: notes has no entry for assetVersion ${p.assetVersion} (say what changed)`);
      if (p.size.some((v) => !(v > 0))) problems.push(`${where}: size must be above 0 on every axis`);
      if (p.bounds === 'within' && p.breakable) problems.push(`${where}: a part with bounds "within" cannot be breakable (its debris would be its whole box)`);
      if (p.breakable && !/^#[0-9a-f]{6}$/.test(p.breakable.debris)) problems.push(`${where}: breakable.debris must be #rrggbb`);
      const idx = p.variants.map((v) => v.index);
      if (new Set(idx).size !== idx.length || idx.some((v) => v < 0 || v > 255)) problems.push(`${where}: variant indices must be distinct, 0–255`);
      if (p.variants[0]?.index !== 0) problems.push(`${where}: the first variant must be index 0 (the default)`);
      const names = p.variants.map((v) => v.name);
      if (new Set(names).size !== names.length || names.some((n) => !/^[a-z][a-z0-9_]*$/.test(n))) problems.push(`${where}: variant names must be distinct lower-case words`);
      if (p.lods[0].distance !== 0 || p.lods.some((l, j) => j && l.distance <= p.lods[j - 1].distance)) problems.push(`${where}: lods must start at 0 m and increase`);
      families.push({ ...p, type: data.type, file, detailSpec: details.get(p.detail) });
    }
  }
  // Aliases: a catalogue prop (still there: its file stays until no map needs it) → a family and one of its variants.
  const byId = new Map(families.map((f) => [f.id, f]));
  const known = new Set(catalogue.props.map((p) => `prop.${p.id}`));
  for (const [from, a] of Object.entries(m.aliases ?? {})) {
    const f = byId.get(a.model);
    if (!known.has(from)) problems.push(`${MANIFEST}: aliases.${from}: no such catalogue prop`);
    if (!f) problems.push(`${MANIFEST}: aliases.${from}: no kit family ${a.model}`);
    else if (!f.variants.some((v) => v.index === a.variant)) problems.push(`${MANIFEST}: aliases.${from}: ${a.model} has no variant ${a.variant}`);
    if (!(a.scale >= 0.25 && a.scale <= 4)) problems.push(`${MANIFEST}: aliases.${from}: scale must be 0.25–4`);
  }
  return { problems, families };
}

/** Build every output in memory: { files, lock, lockFiles, shared, families, report }. */
export async function build(content, families) {
  const m = content.manifest;
  const files = new Map();
  const lockFiles = [];
  const report = [];
  const props = [];
  const render = [];
  for (const f of families) {
    const make = KINDS[f.generator.kind];
    const [, type, name] = f.id.split('.');
    const variants = [];
    let tris = null;
    // Finer collision (a generator's `boxes` on its mesh: a fence's posts and rails): the family's own, so every
    // variant must give the same, inside the family's bounds.
    let boxes;
    for (const v of f.variants) {
      const g = { ...f.generator, ...(v.set ?? {}) };
      const levels = f.lods.map((l, i) => ({ distance: l.distance, mesh: make(v.seed, f.size, g, v.look, i) }));
      const t = levels.map((l) => l.mesh.triangles);
      const own = levels[0].mesh.boxes?.length ? levels[0].mesh.boxes.map((b) => b.map(mm)) : null;
      if (own && f.collide === 'none') throw new Error(`${f.id}#${v.name}: gives collision boxes, but its family has no collision (collide: "none")`);
      if (f.bounds === 'within' && !own && f.collide !== 'none') throw new Error(`${f.id}#${v.name}: bounds "within" needs its own collision boxes (it does not fill its size), or collide: "none"`);
      if (v === f.variants[0]) boxes = own;
      else if (JSON.stringify(own) !== JSON.stringify(boxes)) throw new Error(`${f.id}#${v.name}: its collision boxes differ from the first variant's (a family has one collision: structure that changes it belongs in another family)`);
      for (const b of own ?? []) if (b.some((c, k) => Math.abs(c) > f.size[k % 3] / (k % 3 === 1 ? 1 : 2) + 0.001 || (k === 1 && c < 0))) throw new Error(`${f.id}#${v.name}: a collision box ${JSON.stringify(b)} lies outside the family's size`);
      tris ??= t.map(() => 0);
      t.forEach((n, i) => (tris[i] = Math.max(tris[i], n)));
      const file = `kit/${type}.${name}.${v.name}.glb`;
      const glb = await writeKitModel(`${type}_${name}_${v.name}`, levels, f.detailSpec);
      files.set(file, glb);
      lockFiles.push({ file, sha256: sha(glb), bytes: glb.length, triangles: t[0], lodTriangles: t, source: m.pack.id, src: `${f.id}#${v.name}`, generatorVersion: m.generatorVersion, assetVersion: f.assetVersion, bounds: boundsOf(levels[0].mesh) });
      variants.push({ index: v.index, name: v.name, file });
      report.push(`${f.id}#${v.name}: ${t.join(' / ')} triangles, ${glb.length} B`);
    }
    const size = f.size.map(mm);
    props.push({ id: f.id, file: variants[0].file, displayName: f.displayName, category: f.category, size, collision: f.collide === 'none' ? null : size, ...(boxes ? { boxes } : {}), ...(f.breakable ? { breakable: { health: f.breakable.health, ...(f.breakable.blast ? { blast: { radius: f.breakable.blast.radius, damage: f.breakable.blast.damage, edge: f.breakable.blast.edge } } : {}), debris: f.breakable.debris } } : {}) });
    render.push({ id: f.id, kind: f.generator.kind, assetVersion: f.assetVersion, surface: f.surface, lods: f.lods.map((l) => l.distance), triangles: tris, variants, ...(f.bounds === 'within' ? { within: true } : {}) });
  }
  lockFiles.sort((a, b) => (a.file < b.file ? -1 : 1));
  const aliases = Object.entries(m.aliases ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)).map(([from, a]) => ({ from, model: a.model, variant: a.variant, scale: a.scale }));
  const lock = formatLock({ $comment: 'Generated by tools/content/kitprops.mjs from content/kitprops.json and content/kitprops/*.json. Do not edit by hand.', generatorVersion: m.generatorVersion, files: lockFiles });
  const within = new Set(families.filter((f) => f.bounds === 'within').map((f) => f.id));
  return { files, lock, lockFiles, shared: renderShared(m, props, render, aliases), props, render, aliases, report, within };
}

/** Bounds [min, max] of a level's mesh (for the check that a piece fills its size). */
function boundsOf(mesh) {
  const [lo, hi] = mesh.bounds();
  return [...lo, ...hi].map(mm);
}

function renderShared(m, props, render, aliases) {
  const L = [];
  L.push('// Generated by tools/content/kitprops.mjs from content/kitprops.json and content/kitprops/*.json. Do not edit by hand:');
  L.push('// edit the JSON and run `node tools/content/kitprops.mjs`.');
  L.push("import type { PropDefinition } from './props.ts';");
  L.push("import type { KitAlias, KitFamilyData } from './kitProps.ts';");
  L.push('');
  L.push(`export const KIT_GENERATOR_VERSION = ${m.generatorVersion};`);
  L.push('');
  L.push('/** Every kit family as a catalogue prop: its size, collision box, palette category and breakable data (its first variant\'s file). */');
  L.push('export const KIT_PROPS: readonly PropDefinition[] = [');
  for (const p of props) L.push(`  ${tsInline(p)},`);
  L.push('];');
  L.push('');
  L.push('/** Per family: its generator, asset version, surface type, where each level of detail starts (m), the most triangles a variant has at each, and each variant\'s file. */');
  L.push('export const KIT_FAMILIES: readonly KitFamilyData[] = [');
  for (const r of render) L.push(`  ${tsInline(r)},`);
  L.push('];');
  L.push('');
  L.push('/** Retired catalogue props and the family and variant that take their place as played (`scale` multiplies the placement\'s). */');
  L.push('export const KIT_ALIASES: readonly KitAlias[] = [');
  for (const a of aliases) L.push(`  ${tsInline(a)},`);
  L.push('];');
  return `${L.join('\n')}\n`;
}

/**
 * Budgets: bytes per file, triangles per level by generator kind, and against what each alias replaces: from its
 * first lighter level on, a variant has no more triangles than the retired prop had (content/props.lock.json), and
 * the family's size × the alias's scale is the retired prop's (its collision is unchanged as played).
 */
export function budgetProblems(content, out, root = ROOT) {
  const problems = [];
  const b = content.manifest.budgets;
  for (const f of out.lockFiles) if (f.bytes > b.maxBytes) problems.push(`${f.file}: ${f.bytes} bytes, over the budget ${b.maxBytes}`);
  for (const r of out.render) {
    const caps = b.triangles[r.kind];
    if (!caps) {
      problems.push(`${r.id}: no triangle budget for generator ${r.kind} (content/kitprops.json budgets.triangles)`);
      continue;
    }
    if (caps.length !== r.triangles.length) problems.push(`${r.id}: ${r.triangles.length} levels of detail, the ${r.kind} budget lists ${caps.length}`);
    r.triangles.forEach((n, i) => caps[i] !== undefined && n > caps[i] && problems.push(`${r.id}: level ${i} has ${n} triangles, over the budget ${caps[i]}`));
  }
  // Every variant fills its family's size (collision is that box): within 2 mm on every side at level 0.
  const byFile = new Map(out.lockFiles.map((f) => [f.file, f]));
  for (const p of out.props) {
    const [w, h, d] = p.size;
    const want = [-w / 2, 0, -d / 2, w / 2, h, d / 2];
    for (const v of out.render.find((r) => r.id === p.id).variants) {
      const bb = byFile.get(v.file).bounds;
      // A part drawn where it belongs in a larger build (bounds: "within") stays inside its size instead.
      if (out.within?.has(p.id)) {
        if (bb.some((x, i) => (i < 3 ? x < want[i] - 0.002 : x > want[i] + 0.002))) problems.push(`${v.file}: bounds ${JSON.stringify(bb)} reach outside the family's size ${JSON.stringify(p.size)}`);
      } else if (bb.some((x, i) => Math.abs(x - want[i]) > 0.002)) problems.push(`${v.file}: bounds ${JSON.stringify(bb)} are not the family's size ${JSON.stringify(p.size)} (collision is that box)`);
    }
  }
  const old = readLock(join(root, 'content/props.lock.json'));
  const oldTris = new Map(old.files.map((f) => [f.file, f.triangles]));
  const catalogue = new Map(loadPropManifest().props.map((p) => [`prop.${p.id}`, p]));
  const sizes = sizesOf(root);
  for (const a of out.aliases) {
    const r = out.render.find((x) => x.id === a.model);
    const p = out.props.find((x) => x.id === a.model);
    if (!r || !p || !catalogue.has(a.from)) continue;
    const was = oldTris.get(`props/${a.from.slice(5)}.glb`);
    const v = r.variants.find((x) => x.index === a.variant);
    const t = byFile.get(v.file).lodTriangles;
    if (was !== undefined && t.length > 1 && t[1] > was) problems.push(`${a.from} → ${a.model}#${v.name}: ${t[1]} triangles from ${r.lods[1]} m, more than the ${was} of the prop it replaces`);
    const oldSize = sizes.get(a.from);
    if (oldSize && p.size.some((s, i) => Math.abs(s * a.scale - oldSize[i]) > 0.005)) problems.push(`${a.from} → ${a.model}: size ${JSON.stringify(p.size.map((s) => mm(s * a.scale)))} is not the retired prop's ${JSON.stringify(oldSize)} (its collision would change as played: list it, or match it)`);
  }
  return problems;
}

/** Catalogue props' sizes from props.generated.ts (as built). */
export function sizesOf(root = ROOT) {
  const src = readFileSync(join(root, 'packages/shared/src/content/props.generated.ts'), 'utf8');
  return new Map([...src.matchAll(/\{id: '([^']+)', file: '[^']+', displayName: '(?:[^'\\]|\\.)*', category: '[^']+', size: \[([^\]]+)\]/g)].map((x) => [x[1], x[2].split(',').map(Number)]));
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const content = load();
  const { problems, families } = validate(content);
  if (problems.length) {
    console.error(`kitprops: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  const out = await build(content, families);
  const bad = budgetProblems(content, out);
  const stale = [];
  const disk = (rel) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel)) : null);
  for (const [file, buf] of out.files) {
    const have = disk(join('packages/client/public', file));
    if (!have || !have.equals(buf)) stale.push(file);
  }
  const shipped = existsSync(join(ROOT, OUT)) ? readdirSync(join(ROOT, OUT)).map((f) => `kit/${f}`) : [];
  const extra = shipped.filter((f) => !out.files.has(f));
  for (const [rel, text] of [[LOCK, out.lock], [SHARED, out.shared]]) if (disk(rel)?.toString() !== text) stale.push(rel);
  if (checkOnly) {
    for (const f of extra) bad.push(`packages/client/public/${f}: not made by the generator (run node tools/content/kitprops.mjs)`);
    for (const f of stale) bad.push(`${f.startsWith('kit/') ? `packages/client/public/${f}` : f}: out of date (run node tools/content/kitprops.mjs)`);
    if (bad.length) {
      console.error(`kitprops: ${bad.length} problem(s)\n  ${bad.join('\n  ')}`);
      process.exit(1);
    }
    console.log(`kitprops OK: ${families.length} families, ${out.files.size} files, byte-identical`);
    return;
  }
  mkdirSync(join(ROOT, OUT), { recursive: true });
  for (const [file, buf] of out.files) if (stale.includes(file)) writeFileSync(join(ROOT, 'packages/client/public', file), buf);
  for (const f of extra) rmSync(join(ROOT, 'packages/client/public', f));
  writeFileSync(join(ROOT, LOCK), out.lock);
  writeFileSync(join(ROOT, SHARED), out.shared);
  for (const line of out.report) console.log(`  ${line}`);
  if (bad.length) {
    console.error(`kitprops: built, but ${bad.length} problem(s)\n  ${bad.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`kitprops: ${families.length} families, ${out.files.size} files (${stale.length} changed${extra.length ? `, ${extra.length} removed` : ''})`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
