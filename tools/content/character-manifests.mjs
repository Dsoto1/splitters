// Whole-body Meshy characters, one manifest each: content/characters/<id>.json (docs/CHARACTERS.md has
// the format and how to add one). The intake tools read them all, so a new character needs no code:
//   tools/content/fetch-meshy.mjs              downloads the owner's own Meshy models by task ID
//   tools/content/prepare-meshy-characters.mjs builds its game files (and the lock)
//   this file                                  the looks the game shows (characters.generated.ts)
//
//   node tools/content/character-manifests.mjs          write packages/shared/src/content/characters.generated.ts
//   node tools/content/character-manifests.mjs --check  fail if it is out of date (pnpm content:check does this too)
//   node tools/content/character-manifests.mjs --stubs [ids…]
//       a queued stub manifest for each character or creature in content/intake/meshy-queue.json that has none

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const MANIFEST_DIR = join(ROOT, 'content/characters');
export const LOOKS_FILE = join(ROOT, 'packages/shared/src/content/characters.generated.ts');
export const QUEUE_FILE = join(ROOT, 'content/intake/meshy-queue.json');

/** Meshy task kinds a manifest may name, and the API each one's result comes from (fetch-meshy.mjs). */
export const MESHY_TASKS = {
  preview: 'openapi/v2/text-to-3d',
  refine: 'openapi/v2/text-to-3d',
  image: 'openapi/v1/image-to-3d',
  multiImage: 'openapi/v1/multi-image-to-3d',
  remesh: 'openapi/v1/remesh',
  retexture: 'openapi/v1/retexture',
  rig: 'openapi/v1/rigging',
};

/** The provenance pack (content/models.json) for each licence. */
const PACK = { owned: 'meshy-owned', CC0: 'meshy-community-characters' };
const KINDS = new Set(['character', 'creature']);
const USES = new Set(['player', 'npc', 'player+npc', 'npc+player']);
const FIXES = new Set(['triangles', 'seamWeld', 'lean', 'cloth', 'tail', 'feet', 'scrubBlue', 'hands']);
const LEAN_JOINTS = new Set(['Spine02', 'Spine01', 'Spine', 'neck', 'Head']);
const HEX = /^#[0-9a-f]{6}$/;
const isPoint = (p) => Array.isArray(p) && p.length === 3 && p.every((x) => typeof x === 'number' && Number.isFinite(x));

/** Whether a manifest is waiting for its download and landmarks (a stub from the queue): not built, no look. */
export const isQueued = (m) => m.status === 'queued';
/** Whether a manifest becomes a player look (an NPC-only body gets one too, kept off the roster). */
export const isPlayable = (m) => /(^|\+)player($|\+)/.test(m.use ?? 'player');

/** Problems with one manifest (empty when it is fine). `file` is its file name. */
export function manifestProblems(m, file = `${m?.id}.json`) {
  const out = [];
  const need = (ok, what) => {
    if (!ok) out.push(`${file}: ${what}`);
  };
  need(typeof m.id === 'string' && /^[a-z0-9_]+$/.test(m.id), 'id must be lower case letters, digits and _');
  need(`${m.id}.json` === file, `id ${m.id} does not match the file name`);
  need(KINDS.has(m.kind ?? 'character'), 'kind: character or creature');
  need(USES.has(m.use ?? 'player'), 'use: player, npc or player+npc');
  need(m.status === undefined || m.status === 'queued', 'status: queued (a stub not ready to build) or left out');
  need(typeof m.name === 'string' && m.name.length > 0 && m.name.length <= 24, 'name: 1–24 characters');
  const s = m.source ?? {};
  need(s.license === 'owned' || s.license === 'CC0', 'source.license: owned (made on the owner\'s Meshy account) or CC0 (a Meshy community model)');
  need(s.url === undefined || s.url === null || (typeof s.url === 'string' && /^https:\/\//.test(s.url)), 'source.url: the community post or the owner\'s share link (https://…), or null');
  if (s.meshy) {
    for (const [k, v] of Object.entries(s.meshy)) {
      need(k in MESHY_TASKS, `source.meshy.${k}: not a task kind (${Object.keys(MESHY_TASKS).join(', ')})`);
      need(typeof v === 'string' && /^[0-9a-f-]{20,}$/i.test(v), `source.meshy.${k}: a Meshy task ID`);
    }
    // A community model can carry a rigging task the owner ran on it (rigByUrl), but no other task.
    need(s.license === 'owned' || Object.keys(s.meshy).every((k) => k === 'rig'), 'source.meshy: task IDs only fetch the owner\'s own models (a community model is downloaded by hand; only a "rig" task of the owner\'s may be named)');
  }
  need(s.modelUrl === undefined || s.modelUrl === 'upload' || (typeof s.modelUrl === 'string' && /^https:\/\//.test(s.modelUrl)), 'source.modelUrl: a public https download link of the unrigged model, or "upload" (the download itself, for Meshy\'s rigging API)');
  if (s.file !== undefined) {
    let ok = typeof s.file === 'string';
    try {
      new RegExp(s.file);
    } catch {
      ok = false;
    }
    need(ok, 'source.file: a regular expression for the download\'s file name (.glb or .fbx)');
  }
  // A queued stub only needs what the queue gives; everything below is for building it.
  if (isQueued(m)) return out;
  need(Number.isInteger(m.order) && m.order > 0, 'order must be a whole number from 1 (the roster position among these characters)');
  need(typeof m.look === 'string' && /^core\.[a-z0-9_]+$/.test(m.look), 'look must be core.<name>');
  need(typeof m.bio === 'string' && m.bio.length > 0, 'bio: one line for character select');
  need(m.body === 'male' || m.body === 'female', 'body: male or female');
  need(m.size === undefined || m.size === 'small' || m.size === 'large', 'size: small, large or left out');
  need((m.kind ?? 'character') === 'character', 'kind creature: creatures have their own rigs (prepare-creatures.mjs) and are not built here; keep it queued');
  need(typeof s.author === 'string' && s.author.length > 0, 'source.author');
  need(typeof s.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date), 'source.date: YYYY-MM-DD');
  if (s.license === 'CC0') need(typeof s.community?.model === 'string', 'source.community.model: the community model\'s name as on its page');
  const f = m.finish ?? {};
  need([f.metallic, f.roughness].every((x) => typeof x === 'number' && x >= 0 && x <= 1), 'finish: metallic and roughness, 0–1');
  const fp = m.firstPerson ?? {};
  if (fp.arms === 'own' || fp.arms === undefined) need(fp.skin === undefined && fp.cloth === undefined && fp.trim === undefined, 'firstPerson: dyes only go with universal arms');
  else {
    need(typeof fp.arms === 'string' && /^(ranger|peasant)_arms_[mf]$/.test(fp.arms), 'firstPerson.arms: own (the character\'s own forearms and hands) or a universal arms part (ranger_arms_m, peasant_arms_f, …)');
    need([fp.skin, fp.cloth, fp.trim].every((c) => typeof c === 'string' && HEX.test(c)), 'firstPerson: universal arms take skin, cloth and trim as #rrggbb');
  }
  const x = m.fixes ?? {};
  for (const k of Object.keys(x)) need(FIXES.has(k), `fixes.${k}: unknown (${[...FIXES].join(', ')})`);
  need(x.triangles === undefined || (Number.isInteger(x.triangles) && x.triangles >= 2000 && x.triangles <= 18000), 'fixes.triangles: 2000–18000');
  if (x.lean) for (const [k, v] of Object.entries(x.lean)) need(LEAN_JOINTS.has(k) && typeof v === 'number' && Math.abs(v) <= 45, `fixes.lean.${k}: degrees (−45–45) on ${[...LEAN_JOINTS].join(', ')}`);
  need(x.tail === undefined || (Array.isArray(x.tail) && x.tail.length >= 2 && x.tail.every(isPoint)), 'fixes.tail: two or more points');
  need(x.scrubBlue === undefined || HEX.test(x.scrubBlue), 'fixes.scrubBlue: #rrggbb');
  for (const k of ['seamWeld', 'cloth', 'feet']) need(x[k] === undefined || typeof x[k] === 'boolean', `fixes.${k}: true or false`);
  if (x.hands !== undefined) {
    const h = x.hands;
    need(typeof h === 'object' && h !== null, 'fixes.hands: { palm, curl, scale }');
    for (const k of Object.keys(h ?? {})) need(['palm', 'curl', 'scale', 'l', 'r'].includes(k), `fixes.hands.${k}: unknown (palm, curl, scale; or l / r for one side)`);
    for (const side of [h, h?.l, h?.r].filter(Boolean)) {
      need(side.palm === undefined || isPoint(side.palm), 'fixes.hands.palm: [x, y, z] in the hand joint\'s space (m)');
      need(side.curl === undefined || (typeof side.curl === 'number' && side.curl >= 0 && side.curl <= 1.5), 'fixes.hands.curl: 0–1.5 (how far the fingers close)');
      need(side.scale === undefined || (typeof side.scale === 'number' && side.scale > 0.3 && side.scale < 3), 'fixes.hands.scale: 0.3–3');
    }
  }
  // Landmarks are needed only to rig an unrigged (FBX) download; a rigged GLB brings its own joints.
  if (m.landmarks !== undefined) {
    const l = m.landmarks;
    need(Array.isArray(l.spine) && l.spine.length === 7 && l.spine.every(isPoint), 'landmarks.spine: 7 points (hips, three spine joints, neck, head, top of the head)');
    for (const k of ['L', 'R']) need(Array.isArray(l[k]) && l[k].length === 10 && l[k].every(isPoint), `landmarks.${k}: 10 points (clavicle, shoulder, elbow, wrist, hand tip, hip, knee, ankle, ball, toe tip)`);
  }
  return out;
}

/** Every manifest, validated, in roster order (queued stubs too, unless `ready`). */
export function readManifests({ ready = false } = {}) {
  const files = existsSync(MANIFEST_DIR) ? readdirSync(MANIFEST_DIR).filter((f) => f.endsWith('.json')) : [];
  const list = [];
  const problems = [];
  for (const file of files) {
    let m;
    try {
      m = JSON.parse(readFileSync(join(MANIFEST_DIR, file), 'utf8'));
    } catch (e) {
      problems.push(`${file}: ${e.message}`);
      continue;
    }
    problems.push(...manifestProblems(m, file));
    list.push(m);
  }
  const built = list.filter((m) => !isQueued(m));
  for (const key of ['look', 'name', 'order']) {
    const seen = new Map();
    for (const m of built) {
      if (seen.has(m[key])) problems.push(`${m.id}.json: ${key} ${m[key]} is also ${seen.get(m[key])}'s`);
      seen.set(m[key], m.id);
    }
  }
  if (problems.length) throw new Error(`character manifests:\n  ${problems.join('\n  ')}`);
  return (ready ? built : list).sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.id.localeCompare(b.id));
}

/** The provenance pack a character's files are recorded under. */
export const packOf = (m) => PACK[m.source.license];
/** The part a look wears in first person: its own forearms (<id>_fparms) or a universal arms part. */
export const armsOf = (m) => (!m.firstPerson?.arms || m.firstPerson.arms === 'own' ? `${m.id}_fparms` : m.firstPerson.arms);

const SIDE_JOINTS = ['Shoulder', 'Arm', 'ForeArm', 'Hand', 'HandTip', 'UpLeg', 'Leg', 'Foot', 'ToeBase', 'ToeTip'];
const SPINE_JOINTS = ['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head', 'head_end'];

/**
 * What prepare-meshy-characters.mjs builds from a manifest: the landmarks in
 * model space, in units of the model's height with the feet at y = 0 (+x is the
 * character's left, +z its front), keyed by Meshy's joint names (so its
 * JOINT_MAP and REPOSE apply), plus the ends of the head, hands and toes.
 */
/** Landmarks in the manifest's form ({ spine, L, R }) keyed by Meshy's joint names. */
export const jointsFromLandmarks = (l) => Object.fromEntries([...SPINE_JOINTS.map((n, i) => [n, l.spine[i]]), ...SIDE_JOINTS.flatMap((n, i) => [[`Left${n}`, l.L[i]], [`Right${n}`, l.R[i]]])]);

export function buildSpec(m) {
  const x = m.fixes ?? {};
  const joints = m.landmarks ? jointsFromLandmarks(m.landmarks) : undefined;
  return {
    id: m.id,
    meshy: m.source.meshy,
    pack: packOf(m),
    community: m.source.license === 'CC0' ? { model: m.source.community.model, date: m.source.date } : undefined,
    file: m.source.file ? new RegExp(m.source.file) : null,
    metallic: m.finish.metallic,
    roughness: m.finish.roughness,
    triangles: x.triangles,
    seamWeld: x.seamWeld,
    lean: x.lean,
    cloth: x.cloth,
    tail: x.tail,
    feet: x.feet,
    scrubBlue: x.scrubBlue,
    hands: x.hands,
    joints,
  };
}

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** One generated look. */
function lookLine(m) {
  const fp = m.firstPerson ?? {};
  const own = !fp.arms || fp.arms === 'own';
  const whole = own ? `whole: { arms: ${q(armsOf(m))} }` : `whole: { arms: ${q(fp.arms)}, skin: ${q(fp.skin)}, cloth: ${q(fp.cloth)}, trim: ${q(fp.trim)} }`;
  const parts = [`id: ${q(m.look)}`, `name: ${q(m.name)}`, `body: ${q(m.body)}`, "head: ''", `parts: [${q(m.id)}]`, 'hair: []', 'colorways: []', 'skin: null', 'hairColor: null', ...(m.size ? [`size: ${q(m.size)}`] : []), whole];
  return `  { ${parts.join(', ')} },`;
}

/** The generated TypeScript the shared looks read: one look and one bio per built manifest. */
export function looksSource(list) {
  const ready = list.filter((m) => !isQueued(m));
  const players = ready.filter(isPlayable);
  const npcs = ready.filter((m) => !isPlayable(m));
  const bios = players.map((m) => `  ${q(m.look)}: ${q(m.bio)},`);
  return `// Generated by tools/content/character-manifests.mjs from content/characters/*.json. Do not edit by hand:
// change a manifest and run \`node tools/content/character-manifests.mjs\` (pnpm content:check fails until you do).
import type { CharacterLook } from './looks.ts';

/** Whole-body characters (Meshy models rigged onto the game rig by tools/content/prepare-meshy-characters.mjs), in roster order. */
export const WHOLE_BODY_LOOKS: readonly CharacterLook[] = [
${players.map(lookLine).join('\n')}
];

/** Whole-body characters made for NPCs only (\`use: npc\`): not on the roster; NPC_ROLE_SPECS can name them. */
export const WHOLE_BODY_NPC_LOOKS: readonly CharacterLook[] = [${npcs.length ? `\n${npcs.map(lookLine).join('\n')}\n` : ''}];

/** Their one-line bios (character select). */
export const WHOLE_BODY_BIOS: Readonly<Record<string, string>> = {
${bios.join('\n')}
};
`;
}

/** Problems with the generated looks file (empty when it matches the manifests). */
export function looksProblems(list = readManifests()) {
  const want = looksSource(list);
  if (!existsSync(LOOKS_FILE) || readFileSync(LOOKS_FILE, 'utf8') !== want) return ['packages/shared/src/content/characters.generated.ts is out of date with content/characters (run node tools/content/character-manifests.mjs)'];
  return [];
}

/** A queued stub manifest for one entry of content/intake/meshy-queue.json (a character or creature). */
export function stubFromQueue(e) {
  const owned = /^owned/i.test(e.license ?? '');
  return {
    id: e.id,
    kind: e.kind,
    use: e.use,
    status: 'queued',
    name: e.name,
    ...(e.note ? { notes: e.note } : {}),
    source: {
      license: owned ? 'owned' : 'CC0',
      url: e.url ?? null,
      ...(owned ? {} : { community: { model: e.name } }),
    },
  };
}

/** Manifest JSON as the repo keeps it (points on one line). */
export const formatManifest = (m) => `${JSON.stringify(m, null, 2).replace(/\[\s+(-?[\d.e-]+(?:,\s+-?[\d.e-]+)*)\s+\]/g, (_, xs) => `[${xs.split(/,\s+/).join(', ')}]`)}\n`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const list = readManifests();
  if (process.argv.includes('--stubs')) {
    const ids = process.argv.slice(process.argv.indexOf('--stubs') + 1);
    const queue = JSON.parse(readFileSync(QUEUE_FILE, 'utf8')).queue.filter((e) => KINDS.has(e.kind) && (!ids.length || ids.includes(e.id)));
    let made = 0;
    for (const e of queue) {
      if (list.some((m) => m.id === e.id)) continue;
      writeFileSync(join(MANIFEST_DIR, `${e.id}.json`), formatManifest(stubFromQueue(e)));
      made++;
    }
    console.log(`wrote ${made} queued stub manifests to content/characters (fill in each one's look, body, finish and, for an FBX download, landmarks; then drop its "status")`);
  } else if (process.argv.includes('--check')) {
    const p = looksProblems(list);
    for (const x of p) console.error(`ERROR ${x}`);
    if (p.length) process.exit(1);
    console.log(`checked ${list.length} character manifests and their looks`);
  } else {
    writeFileSync(LOOKS_FILE, looksSource(list));
    console.log(`wrote the looks of ${list.filter((m) => !isQueued(m)).length} characters to packages/shared/src/content/characters.generated.ts`);
  }
}
