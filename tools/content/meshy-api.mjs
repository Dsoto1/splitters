// The owner's Meshy account through its API (https://docs.meshy.ai), for
// fetching the raw downloads the content scripts build from. Needs
// MESHY_API_KEY in the environment (the cloud environment has it; never commit
// it). Downloads stay out of the repo: point <dir> outside it (or at a
// gitignored folder) and pass that dir to prepare-meshy-characters.mjs,
// prepare-props.mjs or prepare-guns.mjs.
//
//   node tools/content/meshy-api.mjs balance
//   node tools/content/meshy-api.mjs list [kind]           kinds below; all when left out
//   node tools/content/meshy-api.mjs get <kind> <task id>
//   node tools/content/meshy-api.mjs download <kind> <task id> <dir> [glb,fbx,…]
//
// The API sees only tasks made through the API. Models made on meshy.ai's
// site, and community downloads, aren't reachable here: download those from
// the site by hand.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const API = 'https://api.meshy.ai/openapi';
const KINDS = {
  'text-to-3d': 'v2/text-to-3d',
  'image-to-3d': 'v1/image-to-3d',
  'multi-image-to-3d': 'v1/multi-image-to-3d',
  rigging: 'v1/rigging',
  remesh: 'v1/remesh',
  retexture: 'v1/retexture',
};

const key = process.env.MESHY_API_KEY;
if (!key) {
  console.error('MESHY_API_KEY is not set.');
  process.exit(1);
}

async function call(path) {
  const res = await fetch(`${API}/${path}`, { headers: { Authorization: `Bearer ${key}` } });
  const body = await res.text();
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${body.slice(0, 200)}`);
  return JSON.parse(body);
}

function endpoint(kind) {
  const path = KINDS[kind];
  if (!path) throw new Error(`unknown kind "${kind}"; one of ${Object.keys(KINDS).join(', ')}`);
  return path;
}

async function listAll(kind) {
  const tasks = [];
  for (let page = 1; ; page++) {
    const batch = await call(`${endpoint(kind)}?page_num=${page}&page_size=50&sort_by=-created_at`);
    tasks.push(...batch);
    if (batch.length < 50) return tasks;
  }
}

// Every file URL a task carries: model_urls (glb, fbx, obj, usdz, …), the
// rigging result's rigged and animation files, texture maps, the thumbnail.
function fileUrls(task) {
  const out = [];
  for (const [format, url] of Object.entries(task.model_urls ?? {})) if (url) out.push({ name: `model.${format}`, url });
  const rig = task.result ?? {};
  if (rig.rigged_character_glb_url) out.push({ name: 'rigged.glb', url: rig.rigged_character_glb_url });
  if (rig.rigged_character_fbx_url) out.push({ name: 'rigged.fbx', url: rig.rigged_character_fbx_url });
  for (const [clip, urls] of Object.entries(rig.basic_animations ?? {})) {
    if (typeof urls === 'string' && urls.startsWith('http')) out.push({ name: `${clip}${urls.match(/\.\w+(?=\?|$)/)?.[0] ?? ''}`, url: urls });
  }
  (task.texture_urls ?? []).forEach((maps, i) => {
    for (const [map, url] of Object.entries(maps)) if (url) out.push({ name: `texture${i || ''}_${map}.png`, url });
  });
  if (task.thumbnail_url) out.push({ name: 'thumbnail.png', url: task.thumbnail_url });
  return out;
}

const [cmd, ...args] = process.argv.slice(2);
try {
  if (cmd === 'balance') {
    console.log(await call('v1/balance'));
  } else if (cmd === 'list') {
    for (const kind of args.length ? args : Object.keys(KINDS)) {
      const tasks = await listAll(kind);
      console.log(`${kind}: ${tasks.length} task(s)`);
      for (const t of tasks) {
        const when = new Date(t.created_at).toISOString().slice(0, 10);
        console.log(`  ${t.id}  ${when}  ${t.status}  ${t.prompt ?? t.name ?? ''}`.trimEnd());
      }
    }
  } else if (cmd === 'get' && args.length === 2) {
    console.log(JSON.stringify(await call(`${endpoint(args[0])}/${args[1]}`), null, 2));
  } else if (cmd === 'download' && args.length >= 3) {
    const [kind, id, dir, formats] = args;
    const task = await call(`${endpoint(kind)}/${id}`);
    if (task.status !== 'SUCCEEDED') throw new Error(`task ${id} is ${task.status}`);
    const want = formats?.split(',');
    const files = fileUrls(task).filter((f) => !want || want.some((w) => f.name.endsWith(`.${w}`)));
    const out = join(dir, `${kind}_${id}`);
    await mkdir(out, { recursive: true });
    await writeFile(join(out, 'task.json'), JSON.stringify(task, null, 2));
    for (const f of files) {
      const res = await fetch(f.url);
      if (!res.ok) throw new Error(`${f.name}: HTTP ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      await writeFile(join(out, f.name), bytes);
      console.log(`${join(out, f.name)}  ${(bytes.length / 1e6).toFixed(1)} MB`);
    }
  } else {
    console.error('usage: meshy-api.mjs balance | list [kind] | get <kind> <id> | download <kind> <id> <dir> [formats]');
    process.exit(2);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
