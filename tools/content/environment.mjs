// The procedural environment (docs/PROCEDURAL_ENVIRONMENT_AUDIT.md §9.2, §10): species generated from seeds.
//
//   node tools/content/environment.mjs           build: GLBs and pictures in packages/client/public/env/, the lock, the generated tables
//   node tools/content/environment.mjs --check   rebuild in memory and check every output is byte-identical to what is shipped
//
// Reads content/environment.json (generator version, pack, picture seeds, budgets) and content/environment/<family>.json
// (species). For each species: its structure from its seed, each level of detail and a crossed-card stand-in, once per
// material variant, as env/<family>.<species>.<variant>.glb; its collision shapes and size (shared by the variants).
// Writes content/environment.lock.json (sha, bytes, triangles per level, generator and asset versions),
// packages/shared/src/content/environment.generated.ts (gameplay data only: no files, no pictures) and
// packages/client/src/content/environment.generated.ts (files, levels of detail, pictures).
// Deterministic: only seeded random numbers (tools/content/env/rng.mjs), vertex data rounded before writing.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, shape, sq, tsInline } from './weapons.mjs';
import { formatLock } from './lockfile.mjs';
import { surfaceTypeIds } from './surface-types.mjs';
import { barkTextures, leafAtlas, png, rockTextures } from './env/textures.mjs';
import { writeModel } from './env/mesh.mjs';
import { crossedImpostor } from './env/impostor.mjs';
import { broadleafMesh, broadleafShapes, broadleafSkeleton } from './env/tree.mjs';
import { coniferMesh, coniferShapes, coniferSkeleton } from './env/conifer.mjs';
import { grassMesh, shrubMesh, shrubSkeleton } from './env/plants.mjs';
import { boulderHull, boulderMesh, boulderShapes, boulderSurface, cliffMesh, cliffShapes } from './env/rock.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST = 'content/environment.json';
const FAMILIES = 'content/environment';
const LOCK = 'content/environment.lock.json';
const OUT = 'packages/client/public/env';
const SHARED = 'packages/shared/src/content/environment.generated.ts';
const CLIENT = 'packages/client/src/content/environment.generated.ts';

export const CATEGORIES = ['tree', 'plant', 'groundcover', 'rock', 'boulder', 'cliff'];
const KINDS = { broadleaf: 'tree', conifer: 'tree', shrub: 'plant', grass: 'groundcover', boulder: 'boulder', cliff: 'cliff' };
const { num, int, str, bool, en, tup, arr, obj, map } = shape;
const ID = /^env\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;
const mm = (v) => Math.round(v * 1000) / 1000;
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);

const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

export function load(root = ROOT) {
  const manifest = readJson(root, MANIFEST);
  const families = readdirSync(join(root, FAMILIES)).filter((f) => f.endsWith('.json')).sort().map((f) => ({ file: `${FAMILIES}/${f}`, data: readJson(root, `${FAMILIES}/${f}`) }));
  return { manifest, families };
}

/** Check the content's shape and references: { problems, species }. */
export function validate(content, root = ROOT) {
  const problems = [];
  const surfaces = new Set(surfaceTypeIds(root));
  const m = content.manifest;
  problems.push(...check(m, obj({ $comment: str, generatorVersion: int, pack: obj({ id: str, title: str, creator: str, url: str, license: str, licenseFile: str }), textures: obj({ seed: int, barkSeed: int, rockSeed: int, leavesSeed: int, minCoverage: num }), budgets: obj({ maxBytes: int, textureMaxBytes: int, triangles: map(arr(int, 1)) }) }), MANIFEST));
  for (const k of Object.keys(m.budgets?.triangles ?? {})) if (!CATEGORIES.includes(k)) problems.push(`${MANIFEST}: budgets.triangles.${k}: not a category (${CATEGORIES.join(', ')})`);
  const species = [];
  const ids = new Set();
  for (const { file, data } of content.families) {
    for (const k of Object.keys(data)) if (!['$comment', 'family', 'species'].includes(k)) problems.push(`${file}: unknown field "${k}"`);
    const spec = obj({
      id: str, displayName: str, category: en(CATEGORIES), assetVersion: int, notes: map(str), nominalHeight: num,
      nav: en(['none', 'obstacle', 'boundary']), role: en(['decorative', 'cover', 'blocking']), 'conceals?': bool,
      placement: obj({ maxSlopeDegrees: num, minSpacing: num, scale: tup(2) }),
      generator: obj({ kind: en(Object.keys(KINDS)), seed: int }),
      lods: arr(obj({ distance: num }), 1),
      'impostor?': obj({ distance: num, size: int }),
      variants: arr(obj({ index: int, name: str, look: map(num) }), 1),
    });
    for (const [i, s] of (data.species ?? []).entries()) {
      const where = `${file}: species[${i}] (${s?.id})`;
      // Generator and level parameters are the generator's own (checked by what it reads); the rest is strict.
      const bad = check({ ...s, generator: { kind: s?.generator?.kind, seed: s?.generator?.seed }, lods: (s?.lods ?? []).map((l) => ({ distance: l?.distance })), variants: (s?.variants ?? []).map((v) => ({ index: v?.index, name: v?.name, look: {} })) }, spec, where);
      problems.push(...bad);
      if (bad.length) continue;
      if (!ID.test(s.id) || s.id.split('.')[1] !== data.family) problems.push(`${where}: id must be env.${data.family}.<species> (lower case, digits, _)`);
      if (ids.has(s.id)) problems.push(`${where}: id listed twice`);
      ids.add(s.id);
      if (KINDS[s.generator.kind] !== s.category) problems.push(`${where}: a ${s.generator.kind} generator makes a ${KINDS[s.generator.kind]}, not a ${s.category}`);
      if (!s.notes[String(s.assetVersion)]) problems.push(`${where}: notes has no entry for assetVersion ${s.assetVersion} (say what changed)`);
      const idx = s.variants.map((v) => v.index);
      if (new Set(idx).size !== idx.length || idx.some((v) => v < 0 || v > 255)) problems.push(`${where}: variant indices must be distinct, 0–255`);
      if (s.variants[0]?.index !== 0) problems.push(`${where}: the first variant must be index 0 (the default)`);
      const names = s.variants.map((v) => v.name);
      if (new Set(names).size !== names.length || names.some((n) => !/^[a-z][a-z0-9_]*$/.test(n))) problems.push(`${where}: variant names must be distinct lower-case words`);
      if (s.lods[0].distance !== 0 || s.lods.some((l, j) => j && l.distance <= s.lods[j - 1].distance)) problems.push(`${where}: lods must start at 0 m and increase`);
      if (s.impostor && s.impostor.distance <= s.lods[s.lods.length - 1].distance) problems.push(`${where}: impostor must start beyond the last level`);
      if (s.category === 'groundcover' && (s.role !== 'decorative' || s.nav !== 'none' || s.conceals)) problems.push(`${where}: ground cover is decorative only (role decorative, nav none, no conceals)`);
      species.push({ ...s, family: data.family, file });
    }
  }
  for (const sv of ['bark', 'rock', 'foliage']) if (!surfaces.has(sv)) problems.push(`content/surface-types.json: the environment needs surface type ${sv}`);
  return { problems, species };
}

/** Build every output in memory: { files: Map(path → Buffer), lock, shared, client, report }. */
export async function build(content, species) {
  const m = content.manifest;
  const files = new Map();
  const lockFiles = [];
  const report = [];
  const t = m.textures;
  const bark = await barkTextures(t.barkSeed);
  const rock = await rockTextures(t.rockSeed);
  const atlas = await leafAtlas(t.leavesSeed);
  const pics = { 'env/bark.webp': bark.color, 'env/bark_n.webp': bark.normal, 'env/rock.webp': rock.color, 'env/rock_n.webp': rock.normal, 'env/leaves.webp': atlas.webp };
  for (const [file, buf] of Object.entries(pics)) {
    files.set(file, buf);
    lockFiles.push({ file, sha256: sha(buf), bytes: buf.length, source: m.pack.id, src: file.slice(4).replace(/\.webp$/, ''), generatorVersion: m.generatorVersion });
  }
  const materials = {
    'env.bark': { roughness: 0.92 },
    'env.leaf': { alpha: 'MASK', cutoff: 0.5, doubleSided: true, roughness: 0.8 },
    'env.rock': { roughness: 0.88 },
    'env.grass': { doubleSided: true, roughness: 0.85 },
  };
  const sharedSpecies = [];
  const clientSpecies = [];
  for (const s of species) {
    const g = s.generator;
    let structure;
    let shapes = [];
    // Each variant: its levels as [{ distance, parts: [{ material, mesh }] }].
    const levelsFor = (look) => {
      switch (g.kind) {
        case 'broadleaf':
          return s.lods.map((l) => {
            const mesh = broadleafMesh(g.seed, structure, g, l, look, atlas);
            return { distance: l.distance, parts: [{ material: 'env.bark', mesh: mesh.bark }, { material: 'env.leaf', mesh: mesh.leaf }] };
          });
        case 'conifer':
          return s.lods.map((l) => {
            const mesh = coniferMesh(g.seed, structure, g, l, look, atlas);
            return { distance: l.distance, parts: [{ material: 'env.bark', mesh: mesh.bark }, { material: 'env.leaf', mesh: mesh.leaf }] };
          });
        case 'shrub':
          return s.lods.map((l) => {
            const mesh = shrubMesh(g.seed, structure, g, l, look, atlas);
            return { distance: l.distance, parts: [{ material: 'env.bark', mesh: mesh.bark }, { material: 'env.leaf', mesh: mesh.leaf }] };
          });
        case 'grass':
          return [{ distance: 0, parts: [{ material: 'env.grass', mesh: grassMesh(g.seed, g, look).grass }] }];
        case 'boulder':
          return s.lods.map((l) => ({ distance: l.distance, parts: [{ material: 'env.rock', mesh: boulderMesh(g.seed, g, structure.surface, l.triangles, look).rock }] }));
        case 'cliff':
          return s.lods.map((l) => ({ distance: l.distance, parts: [{ material: 'env.rock', mesh: cliffMesh(g.familySeed, g.seed, g, l, look).rock }] }));
        default:
          throw new Error(`unknown generator ${g.kind}`);
      }
    };
    if (g.kind === 'broadleaf') {
      structure = broadleafSkeleton(g.seed, g);
      shapes = broadleafShapes(structure, g);
    } else if (g.kind === 'conifer') {
      structure = coniferSkeleton(g.seed, g);
      shapes = coniferShapes(structure, g);
    } else if (g.kind === 'shrub') structure = shrubSkeleton(g.seed, g);
    else if (g.kind === 'boulder') {
      const hull = boulderHull(g.seed, g);
      structure = { hull, surface: boulderSurface(g.seed, g, hull) };
      shapes = boulderShapes(hull);
    }
    const [, family, name] = s.id.split('.');
    const variants = [];
    let size = null;
    let lodTris = null;
    for (const v of s.variants) {
      const levels = levelsFor(v.look);
      if (g.kind === 'cliff' && !shapes.length) shapes = cliffShapes(levels[levels.length - 1].parts[0].mesh);
      if (s.impostor) {
        // The far stand-in: two crossed cards with pictures of the middle level (light, the same outline).
        const src = levels[Math.min(1, levels.length - 1)].parts.map(({ material, mesh }) => ({ mesh, texture: material === 'env.leaf' ? atlas.raw : material === 'env.rock' ? rock.raw : bark.raw, alphaTest: material === 'env.leaf' }));
        const imp = crossedImpostor(src, s.impostor.size);
        materials[`env.impostor.${family}.${name}.${v.name}`] = { alpha: 'MASK', cutoff: 0.5, doubleSided: true, roughness: 1, texture: png(imp.picture.data, imp.picture.width, imp.picture.height) };
        levels.push({ distance: s.impostor.distance, billboard: true, parts: [{ material: `env.impostor.${family}.${name}.${v.name}`, mesh: imp.mesh }] });
      }
      const tris = levels.map((l) => l.parts.reduce((n, p) => n + p.mesh.triangles, 0));
      if (!lodTris) lodTris = tris;
      if (!size) {
        // Bounds at scale 1 from level 0, as a footprint centred on the placement: [width x, height, depth z].
        let ax = 0;
        let az = 0;
        let top = 0;
        for (const { mesh } of levels[0].parts)
          for (let i = 0; i < mesh.P.length; i += 3) {
            ax = Math.max(ax, Math.abs(mesh.P[i]));
            top = Math.max(top, mesh.P[i + 1]);
            az = Math.max(az, Math.abs(mesh.P[i + 2]));
          }
        size = [mm(ax * 2), mm(top), mm(az * 2)];
      }
      const file = `env/${family}.${name}.${v.name}.glb`;
      const glb = await writeModel(`${family}_${name}_${v.name}`, levels, materials);
      files.set(file, glb);
      lockFiles.push({ file, sha256: sha(glb), bytes: glb.length, triangles: tris[0], lodTriangles: tris, source: m.pack.id, src: `${s.id}#${v.name}`, generatorVersion: m.generatorVersion, assetVersion: s.assetVersion });
      variants.push({ index: v.index, name: v.name, file });
      report.push(`${s.id}#${v.name}: ${tris.join(' / ')} triangles, ${glb.length} B`);
    }
    const round = (sh) => {
      if (sh.kind === 'capsule') return { kind: 'capsule', a: sh.a.map(mm), b: sh.b.map(mm), r: mm(sh.r), blocks: sh.blocks, surface: sh.surface };
      if (sh.kind === 'hull') return { kind: 'hull', points: sh.points.map((p) => p.map(mm)), blocks: sh.blocks, surface: sh.surface };
      return sh;
    };
    const conceals = s.conceals ? { radius: mm(Math.min(size[0], size[2]) / 2), height: size[1] } : null;
    sharedSpecies.push({
      id: s.id, assetVersion: s.assetVersion, family, category: s.category, displayName: s.displayName, nominalHeight: s.nominalHeight,
      surface: s.category === 'tree' ? 'bark' : s.category === 'plant' || s.category === 'groundcover' ? 'foliage' : 'rock',
      nav: s.nav, role: s.role, conceals,
      placement: s.placement,
      variants: s.variants.map((v) => ({ index: v.index, name: v.name, seed: g.seed, size, shapes: shapes.map(round) })),
    });
    clientSpecies.push({ id: s.id, category: s.category, role: s.role, lods: [...s.lods.map((l) => l.distance), ...(s.impostor ? [s.impostor.distance] : [])], triangles: lodTris, variants });
  }
  lockFiles.sort((a, b) => (a.file < b.file ? -1 : 1));
  const lock = formatLock({ $comment: 'Generated by tools/content/environment.mjs from content/environment.json and content/environment/*.json. Do not edit by hand.', generatorVersion: m.generatorVersion, coverage: Object.fromEntries(Object.entries(atlas.cards).map(([k, c]) => [k, c.coverage])), files: lockFiles });
  return { files, lock, lockFiles, shared: renderShared(m, sharedSpecies), client: renderClient(clientSpecies), sharedSpecies, clientSpecies, atlas, report };
}

function renderShared(m, list) {
  const L = [];
  L.push('// Generated by tools/content/environment.mjs from content/environment.json and content/environment/*.json. Do not edit by');
  L.push('// hand: edit the JSON and run `node tools/content/environment.mjs`. Gameplay data only (no files, no pictures).');
  L.push("import type { EnvSpeciesData } from './environment.ts';");
  L.push('');
  L.push(`export const ENV_GENERATOR_VERSION = ${m.generatorVersion};`);
  L.push('');
  L.push('/** Every environment species: sizes, collision shapes (game space, scale 1), surface, nav, concealment, placement. */');
  L.push('export const ENV_SPECIES: readonly EnvSpeciesData[] = [');
  for (const s of list) L.push(`  ${tsInline(s)},`);
  L.push('];');
  return `${L.join('\n')}\n`;
}

function renderClient(list) {
  const L = [];
  L.push('// Generated by tools/content/environment.mjs from content/environment.json and content/environment/*.json. Do not edit by');
  L.push('// hand: edit the JSON and run `node tools/content/environment.mjs`.');
  L.push('');
  L.push('/** The shared pictures, relative to the client\'s public folder. */');
  L.push(`export const ENV_TEXTURES = { bark: 'env/bark.webp', barkNormal: 'env/bark_n.webp', rock: 'env/rock.webp', rockNormal: 'env/rock_n.webp', leaves: 'env/leaves.webp' } as const;`);
  L.push('');
  L.push('/** Per species: where each level of detail starts (m, the last one the crossed-card stand-in when there is one), its triangles, and each variant\'s file. */');
  L.push('export const ENV_RENDER: readonly { id: string; category: string; role: string; lods: readonly number[]; triangles: readonly number[]; variants: readonly { index: number; name: string; file: string }[] }[] = [');
  for (const s of list) L.push(`  ${tsInline(s)},`);
  L.push('];');
  return `${L.join('\n')}\n`;
}

/** Budgets and coverage: problems. */
export function budgetProblems(content, out) {
  const problems = [];
  const b = content.manifest.budgets;
  for (const f of out.lockFiles) {
    const max = f.file.endsWith('.glb') ? b.maxBytes : b.textureMaxBytes;
    if (f.bytes > max) problems.push(`${f.file}: ${f.bytes} bytes, over the budget ${max}`);
  }
  for (const s of out.clientSpecies) {
    const caps = b.triangles[s.category];
    if (!caps) {
      problems.push(`${s.id}: no triangle budget for category ${s.category} (content/environment.json budgets.triangles)`);
      continue;
    }
    if (caps.length !== s.triangles.length) problems.push(`${s.id}: ${s.triangles.length} levels of detail, the ${s.category} budget lists ${caps.length}`);
    s.triangles.forEach((n, i) => caps[i] !== undefined && n > caps[i] && problems.push(`${s.id}: level ${i} has ${n} triangles, over the budget ${caps[i]}`));
  }
  for (const [k, c] of Object.entries(out.atlas.cards)) if (c.coverage < content.manifest.textures.minCoverage) problems.push(`env/leaves.webp: card ${k} covers ${c.coverage} of its rectangle, under ${content.manifest.textures.minCoverage}`);
  return problems;
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const content = load();
  const { problems, species } = validate(content);
  if (problems.length) {
    console.error(`environment: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  const out = await build(content, species);
  const bad = budgetProblems(content, out);
  const stale = [];
  const disk = (rel) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel)) : null);
  for (const [file, buf] of out.files) {
    const have = disk(join(OUT, '..', file));
    if (!have || !have.equals(buf)) stale.push(file);
  }
  const shipped = existsSync(join(ROOT, OUT)) ? readdirSync(join(ROOT, OUT)).map((f) => `env/${f}`) : [];
  const extra = shipped.filter((f) => !out.files.has(f));
  for (const [rel, text] of [[LOCK, out.lock], [SHARED, out.shared], [CLIENT, out.client]]) if (disk(rel)?.toString() !== text) stale.push(rel);
  if (checkOnly) {
    for (const f of extra) bad.push(`packages/client/public/${f}: not made by the generator (run node tools/content/environment.mjs)`);
    for (const f of stale) bad.push(`${f.startsWith('env/') ? `packages/client/public/${f}` : f}: out of date (run node tools/content/environment.mjs)`);
    if (bad.length) {
      console.error(`environment: ${bad.length} problem(s)\n  ${bad.join('\n  ')}`);
      process.exit(1);
    }
    console.log(`environment OK: ${species.length} species, ${out.files.size} files, byte-identical`);
    return;
  }
  mkdirSync(join(ROOT, OUT), { recursive: true });
  for (const [file, buf] of out.files) if (stale.includes(file)) writeFileSync(join(ROOT, 'packages/client/public', file), buf);
  for (const f of extra) rmSync(join(ROOT, 'packages/client/public', f));
  writeFileSync(join(ROOT, LOCK), out.lock);
  writeFileSync(join(ROOT, SHARED), out.shared);
  writeFileSync(join(ROOT, CLIENT), out.client);
  for (const line of out.report) console.log(`  ${line}`);
  if (bad.length) {
    console.error(`environment: built, but ${bad.length} problem(s)\n  ${bad.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`environment: ${species.length} species, ${out.files.size} files (${stale.length} changed${extra.length ? `, ${extra.length} removed` : ''})`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
export { sq };
