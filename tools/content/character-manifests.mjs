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
/** Shared clip sets (tools/content/clip-set.mjs --build): content/clip-sets/<id>.json, and what was built from them. */
export const CLIP_SETS_DIR = join(ROOT, 'content/clip-sets');
export const CLIP_SETS_LOCK = join(ROOT, 'content/clip-sets.lock.json');

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
const FIXES = new Set(['triangles', 'surface', 'seamWeld', 'lean', 'cloth', 'tail', 'feet', 'scrubBlue', 'hands', 'armCloth', 'skinClean', 'handsShare', 'headShare', 'lod', 'normalSize', 'hold', 'grip', 'skin']);
/** How a character gets about: left out, it walks on the rig's clips; `roll`, it has no legs (a ball, a wheel) and rolls. */
const LOCOMOTION = new Set(['roll']);
/** The clips a clip set (`clipsFrom`, tools/content/clip-set.mjs) can hold, as the game asks for them (characterAnimator.ts). */
export const CLIP_SET_CLIPS = ['clip_walk', 'clip_run', 'clip_shoot_fwd', 'clip_shoot_run', 'clip_shoot_back'];
/** The clip set looks move with unless they name another or opt out: DEFAULT_CLIP_SET in packages/shared/src/content/looks.ts (a test keeps them equal). */
export const DEFAULT_CLIP_SET = 'shooter';
const LEAN_JOINTS = new Set(['Spine02', 'Spine01', 'Spine', 'neck', 'Head']);
const HEX = /^#[0-9a-f]{6}$/;
/** Character Select's groups (what a character is); the same list as CHARACTER_GROUPS in packages/shared/src/content/looks.ts (a test keeps them equal). */
export const GROUPS = ['soldiers', 'legends', 'folk', 'horror', 'animals', 'creatures'];
/** Bot name themes (what kind of creature: its bots' names); the same list as NAME_THEMES in packages/shared/src/content/botNames.ts (a test keeps them equal). */
export const NAME_THEMES = ['soldier', 'monkey', 'bear', 'wolf', 'dog', 'cat', 'raccoon', 'critter', 'frog', 'pirate', 'knight', 'ninja', 'wizard', 'barbarian', 'undead', 'spooky', 'robot', 'alien', 'goblin', 'cowboy', 'gangster', 'townsfolk', 'myth'];
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
  if (s.joints !== undefined) {
    // A rigged download whose joints carry no names we know (Bone_000, Bone_001, ...): each named onto Meshy's.
    const known = new Set([...SPINE_JOINTS, ...SIDE_JOINTS.flatMap((n) => [`Left${n}`, `Right${n}`])]);
    const to = Object.values(s.joints ?? {});
    need(s.joints && typeof s.joints === 'object' && to.every((n) => known.has(n)), `source.joints: { "<download's joint>": "<Meshy joint>" } (${[...known].join(', ')})`);
    need(new Set(to).size === to.length, 'source.joints: each Meshy joint once');
  }
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
  need(GROUPS.includes(m.group) || (m.group === undefined && !isPlayable(m)), `group: what the character is, for Character Select's tabs (${GROUPS.join(', ')}); a player look needs one`);
  need(m.nameTheme === undefined || NAME_THEMES.includes(m.nameTheme), `nameTheme: the kind of creature, for its bots' names (${NAME_THEMES.join(', ')}); left out: its group's (soldiers: soldier)`);
  need(m.body === 'male' || m.body === 'female', 'body: male or female');
  need(m.size === undefined || m.size === 'small' || m.size === 'large', 'size: small, large or left out');
  need(m.locomotion === undefined || LOCOMOTION.has(m.locomotion), `locomotion: ${[...LOCOMOTION].join(' or ')} (no legs to walk on: it rolls or glides on what it has), or left out (walks)`);
  if (m.clipsFrom !== undefined) {
    const e = Object.entries(m.clipsFrom ?? {});
    need(m.clipsFrom && typeof m.clipsFrom === 'object' && e.length > 0 && e.every(([k, v]) => CLIP_SET_CLIPS.includes(k) && typeof v === 'string' && v.length > 0), `clipsFrom: { "<clip>": "<the download's clip name>" } for clips ${CLIP_SET_CLIPS.join(', ')} (its download's authored clips, retargeted onto the rig as <id>_clips.glb)`);
    need(['clip_walk', 'clip_run'].every((k) => m.clipsFrom?.[k]), 'clipsFrom: clip_walk and clip_run at least (the legs the set walks and runs with)');
  }
  need(m.clips === undefined || m.clips === false || (typeof m.clips === 'string' && /^[a-z0-9_]+$/.test(m.clips)), `clips: the clip set this body moves with (a shared set in content/clip-sets, or a character manifest's own with clipsFrom), false (the rig's own gait), or left out (the default set, ${DEFAULT_CLIP_SET})`);
  need((m.clips === false) === (typeof m.clipsWhy === 'string' && m.clipsWhy.length > 0), 'clipsWhy: why the body keeps the rig\'s own gait, with clips: false (and only then)');
  need((m.kind ?? 'character') === 'character', 'kind creature: creatures have their own rigs (prepare-creatures.mjs) and are not built here; keep it queued');
  need(typeof s.author === 'string' && s.author.length > 0, 'source.author');
  need(typeof s.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date), 'source.date: YYYY-MM-DD');
  if (s.license === 'CC0') need(typeof s.community?.model === 'string', 'source.community.model: the community model\'s name as on its page');
  const f = m.finish ?? {};
  need([f.metallic, f.roughness].every((x) => typeof x === 'number' && x >= 0 && x <= 1), 'finish: metallic and roughness, 0–1');
  need(f.maps === undefined || typeof f.maps === 'boolean', 'finish.maps: true to keep the download\'s metal-roughness map');
  const fp = m.firstPerson ?? {};
  if (fp.arms === 'own' || fp.arms === undefined) need(fp.skin === undefined && fp.cloth === undefined && fp.trim === undefined, 'firstPerson: dyes only go with universal arms');
  else {
    need(typeof fp.arms === 'string' && /^(ranger|peasant)_arms_[mf]$/.test(fp.arms), 'firstPerson.arms: own (the character\'s own forearms and hands) or a universal arms part (ranger_arms_m, peasant_arms_f, …)');
    need([fp.skin, fp.cloth, fp.trim].every((c) => typeof c === 'string' && HEX.test(c)), 'firstPerson: universal arms take skin, cloth and trim as #rrggbb');
  }
  need(fp.body === undefined || fp.body === false, 'firstPerson.body: false (arms only in first person: the model fills the view from its own eyes) or left out');
  const x = m.fixes ?? {};
  for (const k of Object.keys(x)) need(FIXES.has(k), `fixes.${k}: unknown (${[...FIXES].join(', ')})`);
  need(x.triangles === undefined || (Number.isInteger(x.triangles) && x.triangles >= 2000 && x.triangles <= 18000), 'fixes.triangles: 2000–18000');
  if (x.lean) for (const [k, v] of Object.entries(x.lean)) need(LEAN_JOINTS.has(k) && typeof v === 'number' && Math.abs(v) <= 45, `fixes.lean.${k}: degrees (−45–45) on ${[...LEAN_JOINTS].join(', ')}`);
  need(x.tail === undefined || (Array.isArray(x.tail) && x.tail.length >= 2 && x.tail.every(isPoint)), 'fixes.tail: two or more points');
  need(x.scrubBlue === undefined || HEX.test(x.scrubBlue), 'fixes.scrubBlue: #rrggbb');
  need(x.headShare === undefined || (typeof x.headShare === 'number' && x.headShare > 0 && x.headShare <= 0.3), 'fixes.headShare: 0–0.3 (the share of the triangle budget the head keeps; 0.12 unless set)');
  need(x.handsShare === undefined || (typeof x.handsShare === 'number' && x.handsShare > 0 && x.handsShare <= 0.2), 'fixes.handsShare: 0–0.2 (the share of the triangle budget the hands keep)');
  need(x.surface === undefined || x.surface === 'rebake', 'fixes.surface: rebake (the cut mesh laid out afresh and its colour painted from the download) or left out');
  need(!(x.surface && x.seamWeld), 'fixes: surface rebake closes every seam itself; leave seamWeld out');
  need(x.lod === undefined || (typeof x.lod === 'number' && x.lod >= 0.15 && x.lod <= 0.6), 'fixes.lod: 0.15–0.6 (the share of the body\'s triangles its low-detail copy keeps; 0.3 unless set)');
  need(x.normalSize === undefined || x.normalSize === 512 || x.normalSize === 1024, 'fixes.normalSize: 512 or 1024 (the baked normal map, px)');
  if (x.hold !== undefined) {
    const h = x.hold;
    need(h && typeof h === 'object' && Object.keys(h).every((k) => k === 'forward' || k === 'down' || k === 'out'), 'fixes.hold: { forward, down, out } (metres at a 1.8 m body)');
    for (const k of ['forward', 'down', 'out']) need(h?.[k] === undefined || (typeof h[k] === 'number' && Math.abs(h[k]) <= 0.15), `fixes.hold.${k}: metres (−0.15–0.15)`);
  }
  if (x.grip !== undefined) {
    // This look's own hands and arms on a gun (GripTune in packages/shared/src/content/looks.ts).
    const g = x.grip;
    const NUM = { elbowOut: 0.4, elbowDown: 0.4, curlR: 1.6, curlL: 1.6, rollR: 1.6, rollL: 1.6 };
    const PTS = ['supportPistol', 'supportLong', 'gripLong'];
    need(g && typeof g === 'object' && Object.keys(g).every((k) => k in NUM || PTS.includes(k)), `fixes.grip: { ${[...Object.keys(NUM), ...PTS].join(', ')} }`);
    for (const k of ['elbowOut', 'elbowDown']) need(g?.[k] === undefined || (typeof g[k] === 'number' && Math.abs(g[k]) <= NUM[k]), `fixes.grip.${k}: metres (−${NUM[k]}–${NUM[k]})`);
    for (const k of ['rollR', 'rollL']) need(g?.[k] === undefined || (typeof g[k] === 'number' && Math.abs(g[k]) <= NUM[k]), `fixes.grip.${k}: radians (−${NUM[k]}–${NUM[k]})`);
    for (const k of ['curlR', 'curlL']) need(g?.[k] === undefined || (typeof g[k] === 'number' && g[k] >= 0 && g[k] <= NUM[k]), `fixes.grip.${k}: 0–${NUM[k]} (a share of the hand's measured curl)`);
    for (const k of PTS) need(g?.[k] === undefined || (isPoint(g[k]) && g[k].every((v) => Math.abs(v) <= 0.15)), `fixes.grip.${k}: [right, up, ahead] in the gun's frame (m, each −0.15–0.15)`);
  }
  for (const k of ['seamWeld', 'cloth', 'feet', 'armCloth', 'skinClean']) need(x[k] === undefined || typeof x[k] === 'boolean', `fixes.${k}: true or false`);
  if (x.hands !== undefined) {
    const h = x.hands;
    need(typeof h === 'object' && h !== null, 'fixes.hands: { palm, curl, scale }');
    for (const k of Object.keys(h ?? {})) need(['palm', 'curl', 'scale', 'wrist', 'mitten', 'l', 'r'].includes(k), `fixes.hands.${k}: unknown (palm, curl, scale, wrist, mitten; or l / r for one side)`);
    for (const side of [h, h?.l, h?.r].filter(Boolean)) {
      need(side.palm === undefined || isPoint(side.palm), 'fixes.hands.palm: [x, y, z] in the hand joint\'s space (m)');
      need(side.curl === undefined || (typeof side.curl === 'number' && side.curl >= 0 && side.curl <= 1.5), 'fixes.hands.curl: 0–1.5 (how far the fingers close)');
      need(side.mitten === undefined || typeof side.mitten === 'boolean', 'fixes.hands.mitten: true (the fingers bend together, as one) or left out');
      need(side.scale === undefined || (typeof side.scale === 'number' && side.scale > 0.3 && side.scale < 3), 'fixes.hands.scale: 0.3–3');
      need(side.wrist === undefined || typeof side.wrist === 'boolean', 'fixes.hands.wrist: true (the skin past the wrist rides the hand alone)');
    }
  }
  if (x.skin !== undefined) {
    // This look's own skin weights (tools/content/skinfix.mjs; docs/CHARACTERS.md, "A look's own skin weights").
    const k = x.skin;
    const FINGER = ['tips', 'knuckle', 'joints', 'lanes', 'fingers'];
    need(typeof k === 'object' && k !== null && Object.keys(k).every((q) => [...FINGER, 'hops', 'clamp', 'smooth', 'wrist', 'l', 'r'].includes(q)), `fixes.skin: { ${FINGER.join(', ')}, hops, clamp, smooth, wrist; or l / r for one hand's fingers }`);
    for (const side of [k, k?.l, k?.r].filter(Boolean)) {
      if (side !== k) need(Object.keys(side).every((q) => FINGER.includes(q)), `fixes.skin.l / r: { ${FINGER.join(', ')} }`);
      need(side.tips === undefined || (typeof side.tips === 'number' && side.tips > 0 && side.tips <= 0.5), 'fixes.skin.tips: 0–0.5 (strays past the knuckles up to this share of the hand past its tips are fingers)');
      need(side.knuckle === undefined || (typeof side.knuckle === 'number' && side.knuckle >= 0.02 && side.knuckle <= 0.3), 'fixes.skin.knuckle: 0.02–0.3 (the knuckle blend, a share of the hand)');
      need(side.joints === undefined || (typeof side.joints === 'number' && side.joints >= 0.02 && side.joints <= 0.3), 'fixes.skin.joints: 0.02–0.3 (the finger-joint blend, a share of the finger)');
      need(side.lanes === undefined || (typeof side.lanes === 'number' && side.lanes > 0 && side.lanes <= 1), 'fixes.skin.lanes: 0–1 (neighbouring fingers blended within this share of a finger\'s width of their boundary)');
      need(side.fingers === undefined || side.fingers === 'lanes', "fixes.skin.fingers: 'lanes' (fused fingers split evenly into four)");
    }
    need(k?.hops === undefined || (Number.isInteger(k.hops) && k.hops >= 1 && k.hops <= 4), 'fixes.skin.hops: 1–4 (joints further along the skeleton from a vertex\'s own are dropped)');
    need(k?.clamp === undefined || (typeof k.clamp === 'number' && k.clamp > 0 && k.clamp <= 0.3), 'fixes.skin.clamp: 0–0.3 (influences under it are dropped)');
    need(k?.wrist === undefined || (typeof k.wrist === 'object' && k.wrist !== null && Object.keys(k.wrist).every((q) => ['until', 'band'].includes(q)) && Object.values(k.wrist).every((x) => typeof x === 'number' && x >= 0 && x <= 0.4)), 'fixes.skin.wrist: { until, band } (shares of the hand\'s length past the wrist joint, 0–0.4)');
    if (k?.smooth !== undefined) {
      let ok = false;
      try {
        ok = typeof k.smooth.joints === 'string' && !!new RegExp(k.smooth.joints) && (k.smooth.passes === undefined || (Number.isInteger(k.smooth.passes) && k.smooth.passes >= 1 && k.smooth.passes <= 8));
      } catch {
        ok = false;
      }
      need(ok, 'fixes.skin.smooth: { joints: "<regex of joint names>", passes: 1–8 }');
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
  const sets = new Set(readClipSets().map((c) => c.id));
  if (!sets.has(DEFAULT_CLIP_SET)) problems.push(`content/clip-sets/${DEFAULT_CLIP_SET}.json: the default clip set (DEFAULT_CLIP_SET) is not defined`);
  for (const m of built) if (m.clips && !sets.has(m.clips) && !built.some((o) => o.id === m.clips && o.clipsFrom)) problems.push(`${m.id}.json: clips ${m.clips} names no clip set in content/clip-sets and no built character manifest with clipsFrom`);
  for (const m of built) if (m.clipsFrom && sets.has(m.id)) problems.push(`${m.id}.json: its clip set (clipsFrom) has the same id as content/clip-sets/${m.id}.json`);
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

/** Problems with one shared clip set definition (content/clip-sets/<id>.json; empty when it is fine). */
export function clipSetProblems(c, file = `${c?.id}.json`) {
  const out = [];
  const need = (ok, what) => {
    if (!ok) out.push(`clip-sets/${file}: ${what}`);
  };
  need(typeof c.id === 'string' && /^[a-z0-9_]+$/.test(c.id) && `${c.id}.json` === file, 'id: lower case letters, digits and _, the file name');
  const sources = c.sources && typeof c.sources === 'object' ? c.sources : {};
  need(Object.keys(sources).length > 0, 'sources: { "<key>": { license, author, community.model, date, file, rig } } (the downloads the clips come from)');
  for (const [k, s] of Object.entries(sources)) {
    need(s.license === 'CC0' || s.license === 'owned', `sources.${k}.license: CC0 (a Meshy community model) or owned`);
    need(typeof s.author === 'string' && s.author.length > 0, `sources.${k}.author`);
    need(typeof s.community?.model === 'string' && s.community.model.length > 0, `sources.${k}.community.model: the model's name as on the download`);
    need(typeof s.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date), `sources.${k}.date: YYYY-MM-DD`);
    need(s.rig === 'owner' || s.rig === 'meshy', `sources.${k}.rig: owner (rigged and animated on the owner's Meshy account) or meshy`);
    let ok = typeof s.file === 'string';
    try {
      new RegExp(s.file);
    } catch {
      ok = false;
    }
    need(ok, `sources.${k}.file: a regular expression for the download's file name`);
  }
  const clips = c.clips && typeof c.clips === 'object' ? c.clips : {};
  for (const [as, v] of Object.entries(clips)) {
    need(CLIP_SET_CLIPS.includes(as), `clips.${as}: not a clip set clip (${CLIP_SET_CLIPS.join(', ')})`);
    need(v && v.from in sources && typeof v.clip === 'string' && v.clip.length > 0, `clips.${as}: { from: "<a source key>", clip: "<the download's clip name>" }`);
  }
  need(['clip_walk', 'clip_run'].every((k) => clips[k]), 'clips: clip_walk and clip_run at least (the legs the set walks and runs with)');
  return out;
}

/** Every shared clip set definition (content/clip-sets/*.json), validated. */
export function readClipSets() {
  const files = existsSync(CLIP_SETS_DIR) ? readdirSync(CLIP_SETS_DIR).filter((f) => f.endsWith('.json')) : [];
  const problems = [];
  const list = files.map((file) => {
    const c = JSON.parse(readFileSync(join(CLIP_SETS_DIR, file), 'utf8'));
    problems.push(...clipSetProblems(c, file));
    return c;
  });
  if (problems.length) throw new Error(`clip sets:\n  ${problems.join('\n  ')}`);
  return list.sort((a, b) => a.id.localeCompare(b.id));
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
    rigJoints: m.source.joints,
    locomotion: m.locomotion,
    clipsFrom: m.clipsFrom,
    metallic: m.finish.metallic,
    roughness: m.finish.roughness,
    finishMaps: m.finish.maps === true,
    triangles: x.triangles,
    surface: x.surface,
    seamWeld: x.seamWeld,
    lean: x.lean,
    cloth: x.cloth,
    armCloth: x.armCloth,
    skinClean: x.skinClean,
    tail: x.tail,
    feet: x.feet,
    scrubBlue: x.scrubBlue,
    hands: x.hands,
    skin: x.skin,
    handsShare: x.handsShare,
    headShare: x.headShare,
    lod: x.lod,
    normalSize: x.normalSize,
    joints,
  };
}

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** One generated look. */
function lookLine(m) {
  const fp = m.firstPerson ?? {};
  const own = !fp.arms || fp.arms === 'own';
  const hold = m.fixes?.hold ? `, hold: { ${Object.entries(m.fixes.hold).map(([k, v]) => `${k}: ${v}`).join(', ')} }` : '';
  const grip = m.fixes?.grip ? `, grip: { ${Object.entries(m.fixes.grip).map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`).join(', ')} }` : '';
  const body = (fp.body === false ? ', body: false' : '') + hold + grip;
  const whole = own ? `whole: { arms: ${q(armsOf(m))}${body} }` : `whole: { arms: ${q(fp.arms)}, skin: ${q(fp.skin)}, cloth: ${q(fp.cloth)}, trim: ${q(fp.trim)}${body} }`;
  const parts = [`id: ${q(m.look)}`, `name: ${q(m.name)}`, `body: ${q(m.body)}`, "head: ''", `parts: [${q(m.id)}]`, 'hair: []', 'colorways: []', 'skin: null', 'hairColor: null', ...(m.size ? [`size: ${q(m.size)}`] : []), ...(m.locomotion ? [`locomotion: ${q(m.locomotion)}`] : []), ...(m.clips ? [`clips: ${q(m.clips)}`] : m.clips === false ? ['clips: false'] : []), whole, ...(m.group ? [`group: ${q(m.group)}`] : []), ...(m.nameTheme ? [`nameTheme: ${q(m.nameTheme)}`] : [])];
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
