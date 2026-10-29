// Downloads characters' Meshy files through the Meshy API into a downloads dir outside the repo (raw
// downloads are never committed), where prepare-meshy-characters.mjs reads them:
//
//   MESHY_API_KEY=… node tools/content/fetch-meshy.mjs <downloads dir> [ids…]
//
// Which characters: the ids given (or ONLY=<ids>), else every manifest in content/characters whose
// download isn't in the dir yet. What it fetches, from the manifest's `source.meshy` task IDs:
// - with a `rig` task: the rigged GLB (GET /openapi/v1/rigging/{id}, result.rigged_character_glb_url),
//   saved as <dir>/<id>.glb;
// - without one: the textured FBX and its base colour map from the latest stage it names
//   (retexture, remesh, refine, image, multiImage, preview: the text-to-3d, image-to-3d, remesh and
//   retexture task results' model_urls.fbx and texture_urls[0].base_color), saved as
//   <dir>/<id>/<id>_texture.fbx and .png, rigged later from the manifest's landmarks.
// Meshy's API only serves tasks in the key holder's own account, so only the owner's own models (their
// meshy.ai/s/… share links: the manifest names the task IDs) come through here. A community (CC0) model
// is downloaded by hand from its page: its rigged GLB saved as <dir>/<id>.glb, or its textured FBX
// folder unzipped anywhere under <dir> (found by the manifest's `source.file` pattern).
// FORCE=1 fetches again what is already there. Meshy's file links are signed and expire, so each is
// downloaded right after its task is read.

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MESHY_TASKS, readManifests } from './character-manifests.mjs';

export const API = 'https://api.meshy.ai';

/** The stages an unrigged character's model may come from, latest first. */
const MODEL_STAGES = ['retexture', 'remesh', 'refine', 'image', 'multiImage', 'preview'];

/** A failure with a message meant for the person running the tool (no stack needed). */
export class FetchError extends Error {}

/** Where a task's result is read. */
export const taskUrl = (kind, id) => {
  if (!(kind in MESHY_TASKS)) throw new FetchError(`unknown Meshy task kind ${kind}`);
  return `${API}/${MESHY_TASKS[kind]}/${encodeURIComponent(id)}`;
};

/** Why a request never got an answer, in words (the sandbox's network policy blocks Meshy, for one). */
function unreachable(url, e) {
  const host = new URL(url).host;
  const cause = e?.cause?.code ?? e?.cause?.message ?? e?.message ?? String(e);
  return new FetchError(`could not reach ${host} (${cause}). If this machine's network policy blocks ${host}, run the fetch where Meshy is reachable, or download the files by hand into the downloads dir (docs/CHARACTERS.md).`);
}

/** A Meshy task's result (it must have finished). */
export async function readTask(kind, id, { fetch = globalThis.fetch, apiKey } = {}) {
  if (!apiKey) throw new FetchError('MESHY_API_KEY is not set: the Meshy API needs your API key (Meshy → Settings → API keys), e.g. MESHY_API_KEY=msy_… node tools/content/fetch-meshy.mjs <dir>');
  const url = taskUrl(kind, id);
  let res;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } });
  } catch (e) {
    throw unreachable(url, e);
  }
  if (res.status === 401 || res.status === 403) {
    // The sandbox's proxy answers 403 for hosts it blocks; Meshy answers 401 for a bad key.
    const body = await res.text().catch(() => '');
    if (res.status === 403 && !/meshy/i.test(body)) throw unreachable(url, new Error(`HTTP 403 ${body.slice(0, 120)}`.trim()));
    throw new FetchError(`Meshy refused MESHY_API_KEY for ${kind} task ${id} (HTTP ${res.status}): check the key, and that it belongs to the account that made the task.`);
  }
  if (res.status === 404) throw new FetchError(`Meshy has no ${kind} task ${id} (HTTP 404): check the task ID in the manifest, and that it is a ${MESHY_TASKS[kind]} task.`);
  if (res.status === 429) throw new FetchError(`Meshy is rate limiting this key (HTTP 429): wait a minute and run the fetch again.`);
  if (!res.ok) throw new FetchError(`Meshy answered HTTP ${res.status} for ${kind} task ${id}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  let task;
  try {
    task = await res.json();
  } catch {
    throw new FetchError(`Meshy's answer for ${kind} task ${id} is not JSON`);
  }
  if (task.status !== 'SUCCEEDED') {
    const why = task.task_error?.message ? `: ${task.task_error.message}` : '';
    throw new FetchError(`${kind} task ${id} is ${task.status ?? 'in an unknown state'}${why} (only a SUCCEEDED task has files to download)`);
  }
  return task;
}

/** The first bytes each kind of file starts with, so an error page is never saved as a model. */
const MAGIC = {
  glb: (b) => b.subarray(0, 4).toString('latin1') === 'glTF',
  fbx: (b) => b.subarray(0, 18).toString('latin1') === 'Kaydara FBX Binary' || /^; FBX/.test(b.subarray(0, 5).toString('latin1')),
  png: (b) => b.subarray(1, 4).toString('latin1') === 'PNG',
};

/** Download one file to `path` (signed asset links need no key). */
export async function download(url, path, kind, { fetch = globalThis.fetch } = {}) {
  if (typeof url !== 'string' || !/^https:\/\//.test(url)) throw new FetchError(`no ${kind} link to download for ${basename(path)}`);
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw unreachable(url, e);
  }
  if (res.status === 403 || res.status === 404) throw new FetchError(`${new URL(url).host} refused ${basename(path)} (HTTP ${res.status}): Meshy's links expire, so run the fetch again (or the proxy blocks the host).`);
  if (!res.ok) throw new FetchError(`downloading ${basename(path)} failed: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!MAGIC[kind](bytes)) throw new FetchError(`${basename(path)}: the download is not a ${kind.toUpperCase()} file (${bytes.length} bytes starting ${JSON.stringify(bytes.subarray(0, 16).toString('latin1'))})`);
  writeFileSync(path, bytes);
  return bytes.length;
}

/** The file(s) a character's download is saved as, relative to the downloads dir. */
export const downloadFiles = (m) => (m.source.meshy?.rig ? [`${m.id}.glb`] : [`${m.id}/${m.id}_texture.fbx`, `${m.id}/${m.id}_texture.png`]);

/** Whether a character's download is already in the dir (an unrigged one by its own name or the manifest's pattern). */
export function downloaded(m, dir) {
  if (downloadFiles(m).every((f) => existsSync(join(dir, f)))) return true;
  if (existsSync(join(dir, `${m.id}.glb`))) return true;
  if (!m.source.file || !existsSync(dir)) return false;
  const re = new RegExp(m.source.file);
  return readdirSync(dir, { recursive: true }).some((f) => re.test(basename(String(f))));
}

/** Fetch one character's download into `dir`. Returns what it saved. */
export async function fetchCharacter(m, dir, opts = {}) {
  const log = opts.log ?? console.log;
  const tasks = m.source.meshy ?? {};
  if (tasks.rig) {
    const task = await readTask('rig', tasks.rig, opts);
    const url = task.result?.rigged_character_glb_url;
    if (!url) throw new FetchError(`rig task ${tasks.rig} has no rigged GLB (result.rigged_character_glb_url)`);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${m.id}.glb`);
    const bytes = await download(url, path, 'glb', opts);
    log(`${m.id}: rigged GLB, ${(bytes / 1048576).toFixed(1)} MB → ${path}`);
    return [path];
  }
  const stage = MODEL_STAGES.find((k) => tasks[k]);
  if (!stage) throw new FetchError(`${m.id} has no Meshy task to fetch. Meshy's API only serves the key holder's own tasks, so a community model is downloaded by hand${m.source.url ? ` from ${m.source.url}` : ''}: save its rigged GLB as ${join(dir, `${m.id}.glb`)}, or unzip its textured FBX folder into ${dir} (found by the manifest's source.file pattern).`);
  const task = await readTask(stage, tasks[stage], opts);
  const fbx = task.model_urls?.fbx;
  const color = task.texture_urls?.[0]?.base_color;
  if (!fbx) throw new FetchError(`${stage} task ${tasks[stage]} has no FBX model (model_urls.fbx)`);
  if (!color) throw new FetchError(`${stage} task ${tasks[stage]} has no base colour map (texture_urls[0].base_color): name the textured stage's task in the manifest, or download Meshy's textured FBX by hand`);
  const folder = join(dir, m.id);
  mkdirSync(folder, { recursive: true });
  const fbxPath = join(folder, `${m.id}_texture.fbx`);
  const pngPath = join(folder, `${m.id}_texture.png`);
  const a = await download(fbx, fbxPath, 'fbx', opts);
  const b = await download(color, pngPath, 'png', opts);
  log(`${m.id}: ${stage} FBX ${(a / 1048576).toFixed(1)} MB and base colour ${(b / 1048576).toFixed(1)} MB → ${folder}`);
  return [fbxPath, pngPath];
}

/** Fetch the given characters (or every one not downloaded yet); returns the ids that failed. */
export async function fetchAll(dir, ids, opts = {}) {
  const log = opts.log ?? console.log;
  const all = opts.manifests ?? readManifests().filter((m) => m.kind !== 'creature');
  for (const id of ids ?? []) if (!all.some((m) => m.id === id)) throw new FetchError(`no manifest content/characters/${id}.json`);
  const list = ids?.length ? all.filter((m) => ids.includes(m.id)) : all;
  const failed = [];
  for (const m of list) {
    if (!opts.force && downloaded(m, dir)) {
      log(`${m.id}: already downloaded`);
      continue;
    }
    try {
      await fetchCharacter(m, dir, opts);
    } catch (e) {
      if (!(e instanceof FetchError)) throw e;
      log(`${m.id}: ${e.message}`);
      failed.push(m.id);
    }
  }
  return failed;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Node's fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY is set when it starts: behind a proxy, run again with it.
  if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync(process.execPath, ['--disable-warning=UNDICI-EHPA', ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
    process.exit(r.status ?? 1);
  }
  const [dir, ...rest] = process.argv.slice(2);
  if (!dir) {
    console.error('usage: MESHY_API_KEY=… node tools/content/fetch-meshy.mjs <downloads dir> [ids…]');
    process.exit(2);
  }
  const ids = rest.length ? rest : process.env.ONLY?.split(',').filter(Boolean);
  try {
    const failed = await fetchAll(resolve(dir), ids, { apiKey: process.env.MESHY_API_KEY, force: process.env.FORCE === '1' });
    if (failed.length) {
      console.error(`could not fetch: ${failed.join(', ')}`);
      process.exit(1);
    }
  } catch (e) {
    if (!(e instanceof FetchError)) throw e;
    console.error(e.message);
    process.exit(1);
  }
}
