import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FetchError, downloaded, fetchAll, fetchCharacter, readTask, rigByUrl, taskUrl } from '../fetch-meshy.mjs';

const GLB = Buffer.concat([Buffer.from('glTF'), Buffer.alloc(60)]);
const FBX = Buffer.concat([Buffer.from('Kaydara FBX Binary  \0'), Buffer.alloc(60)]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

const rigged = { id: 'meshy_test', source: { license: 'owned', meshy: { preview: 'p-1111-2222-3333-4444', refine: 'r-1111-2222-3333-4444', rig: 'g-1111-2222-3333-4444' } } };
const unrigged = { id: 'meshy_lump', source: { license: 'owned', meshy: { refine: 'r-1111-2222-3333-4444', remesh: 'm-1111-2222-3333-4444' }, file: '^nothing$' } };
const community = { id: 'meshy_found', source: { license: 'CC0', url: 'https://www.meshy.ai/posts/0000', community: { model: 'Found' }, file: '^Meshy_AI_Found_.*\\.fbx$' } };

/** A fetch that answers from a table of URL → response, and records every call. */
function mockFetch(table) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, auth: init.headers?.Authorization, ...(init.method ? { method: init.method, body: init.body } : {}) });
    let r = table[url];
    if (typeof r === 'function') r = r();
    if (!r) throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
    if (r instanceof Error) throw r;
    const body = r.body ?? Buffer.from(JSON.stringify(r.json ?? {}));
    return {
      ok: (r.status ?? 200) < 400,
      status: r.status ?? 200,
      json: async () => JSON.parse(body.toString()),
      text: async () => body.toString(),
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    };
  };
  return { fetch, calls };
}

const dirs = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'fetch-meshy-'));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const quiet = () => {};

describe('fetch-meshy', () => {
  it('reads each task kind from its documented endpoint', () => {
    expect(taskUrl('preview', 'a')).toBe('https://api.meshy.ai/openapi/v2/text-to-3d/a');
    expect(taskUrl('refine', 'a')).toBe('https://api.meshy.ai/openapi/v2/text-to-3d/a');
    expect(taskUrl('image', 'a')).toBe('https://api.meshy.ai/openapi/v1/image-to-3d/a');
    expect(taskUrl('remesh', 'a')).toBe('https://api.meshy.ai/openapi/v1/remesh/a');
    expect(taskUrl('rig', 'a')).toBe('https://api.meshy.ai/openapi/v1/rigging/a');
    expect(() => taskUrl('paint', 'a')).toThrow(FetchError);
  });

  it('downloads a rigged GLB from the rig task, with the key on the API call only', async () => {
    const dir = tmp();
    const asset = 'https://assets.meshy.ai/x/rigged.glb?Signature=abc';
    const { fetch, calls } = mockFetch({
      [taskUrl('rig', rigged.source.meshy.rig)]: { json: { id: rigged.source.meshy.rig, status: 'SUCCEEDED', result: { rigged_character_glb_url: asset, rigged_character_fbx_url: 'https://assets.meshy.ai/x/rigged.fbx' } } },
      [asset]: { body: GLB },
    });
    const saved = await fetchCharacter(rigged, dir, { fetch, apiKey: 'msy_test', log: quiet });
    expect(saved).toEqual([join(dir, 'meshy_test.glb')]);
    expect(readFileSync(join(dir, 'meshy_test.glb'))).toEqual(GLB);
    expect(calls).toEqual([
      { url: 'https://api.meshy.ai/openapi/v1/rigging/g-1111-2222-3333-4444', auth: 'Bearer msy_test' },
      { url: asset, auth: undefined },
    ]);
  });

  it('takes an unrigged model and its colour map from the latest stage named', async () => {
    const dir = tmp();
    const { fetch, calls } = mockFetch({
      [taskUrl('remesh', unrigged.source.meshy.remesh)]: { json: { status: 'SUCCEEDED', model_urls: { glb: 'https://assets.meshy.ai/m.glb', fbx: 'https://assets.meshy.ai/m.fbx' }, texture_urls: [{ base_color: 'https://assets.meshy.ai/m.png' }] } },
      'https://assets.meshy.ai/m.fbx': { body: FBX },
      'https://assets.meshy.ai/m.png': { body: PNG },
    });
    await fetchCharacter(unrigged, dir, { fetch, apiKey: 'k', log: quiet });
    expect(calls[0].url).toBe('https://api.meshy.ai/openapi/v1/remesh/m-1111-2222-3333-4444');
    expect(existsSync(join(dir, 'meshy_lump/meshy_lump_texture.fbx'))).toBe(true);
    expect(existsSync(join(dir, 'meshy_lump/meshy_lump_texture.png'))).toBe(true);
  });

  it('says what to do without a key', async () => {
    await expect(readTask('rig', 'x', { fetch: () => Promise.reject(new Error('no call expected')) })).rejects.toThrow(/MESHY_API_KEY is not set/);
  });

  it('says plainly when Meshy cannot be reached (DNS, or the proxy blocking it)', async () => {
    const { fetch } = mockFetch({});
    await expect(readTask('rig', 'x', { fetch, apiKey: 'k' })).rejects.toThrow(/could not reach api\.meshy\.ai \(ENOTFOUND\).*network policy/);
    const blocked = mockFetch({ [taskUrl('rig', 'x')]: { status: 403, body: Buffer.from('Host not allowed by policy') } });
    await expect(readTask('rig', 'x', { fetch: blocked.fetch, apiKey: 'k' })).rejects.toThrow(/could not reach api\.meshy\.ai/);
  });

  it('tells a refused key, a missing task and an unfinished task apart', async () => {
    const t = (status, json) => mockFetch({ [taskUrl('rig', 'x')]: { status, json } }).fetch;
    await expect(readTask('rig', 'x', { fetch: t(401, { message: 'Invalid API key' }), apiKey: 'k' })).rejects.toThrow(/refused MESHY_API_KEY/);
    await expect(readTask('rig', 'x', { fetch: t(404, {}), apiKey: 'k' })).rejects.toThrow(/has no rig task x/);
    await expect(readTask('rig', 'x', { fetch: t(429, {}), apiKey: 'k' })).rejects.toThrow(/rate limiting/);
    await expect(readTask('rig', 'x', { fetch: t(200, { status: 'IN_PROGRESS' }), apiKey: 'k' })).rejects.toThrow(/is IN_PROGRESS/);
    await expect(readTask('rig', 'x', { fetch: t(200, { status: 'FAILED', task_error: { message: 'bad mesh' } }), apiKey: 'k' })).rejects.toThrow(/FAILED: bad mesh/);
  });

  it('never saves an error page as a model', async () => {
    const dir = tmp();
    const asset = 'https://assets.meshy.ai/x.glb';
    const { fetch } = mockFetch({
      [taskUrl('rig', rigged.source.meshy.rig)]: { json: { status: 'SUCCEEDED', result: { rigged_character_glb_url: asset } } },
      [asset]: { body: Buffer.from('<html>expired</html>') },
    });
    await expect(fetchCharacter(rigged, dir, { fetch, apiKey: 'k', log: quiet })).rejects.toThrow(/not a GLB file/);
    expect(existsSync(join(dir, 'meshy_test.glb'))).toBe(false);
  });

  it('sends community models to a download by hand, and finds them by id or file pattern', async () => {
    const dir = tmp();
    await expect(fetchCharacter(community, dir, { apiKey: 'k', log: quiet })).rejects.toThrow(/downloaded by hand from https:\/\/www\.meshy\.ai\/posts\/0000: save its rigged GLB as .*meshy_found\.glb/);
    expect(downloaded(community, dir)).toBe(false);
    writeFileSync(join(dir, 'Meshy_AI_Found_2026_texture.fbx'), FBX);
    expect(downloaded(community, dir)).toBe(true);
    const other = tmp();
    writeFileSync(join(other, 'meshy_found.glb'), GLB);
    expect(downloaded(community, other)).toBe(true);
  });

  it('skips what is downloaded and reports what failed', async () => {
    const dir = tmp();
    writeFileSync(join(dir, 'meshy_test.glb'), GLB);
    const lines = [];
    const { fetch, calls } = mockFetch({});
    const failed = await fetchAll(dir, undefined, { fetch, apiKey: 'k', manifests: [rigged, unrigged], log: (l) => lines.push(l) });
    expect(failed).toEqual(['meshy_lump']);
    expect(calls.map((c) => c.url)).toEqual([taskUrl('remesh', unrigged.source.meshy.remesh)]);
    expect(lines[0]).toBe('meshy_test: already downloaded');
    await expect(fetchAll(dir, ['meshy_nobody'], { manifests: [rigged] })).rejects.toThrow(/no manifest/);
  });

  it('has Meshy rig a model at a public URL, waiting for the task, and saves the rigged GLB', async () => {
    const dir = tmp();
    const m = { id: 'meshy_found', source: { license: 'CC0', modelUrl: 'https://drive.usercontent.google.com/download?id=abc&export=download', community: { model: 'Found' } } };
    const states = ['PENDING', 'IN_PROGRESS', 'SUCCEEDED'];
    const asset = 'https://assets.meshy.ai/rigged.glb?Signature=x';
    const { fetch, calls } = mockFetch({
      'https://api.meshy.ai/openapi/v1/rigging': { json: { result: 'rig-1111-2222-3333-4444' } },
      [taskUrl('rig', 'rig-1111-2222-3333-4444')]: () => {
        const status = states.shift();
        return { json: { status, ...(status === 'SUCCEEDED' ? { result: { rigged_character_glb_url: asset } } : {}) } };
      },
      [asset]: { body: GLB },
    });
    const lines = [];
    const saved = await fetchCharacter(m, dir, { fetch, apiKey: 'k', log: (l) => lines.push(l), sleep: async () => {} });
    expect(saved).toEqual([join(dir, 'meshy_found.glb')]);
    expect(calls[0]).toMatchObject({ url: 'https://api.meshy.ai/openapi/v1/rigging', method: 'POST', auth: 'Bearer k' });
    expect(JSON.parse(calls[0].body)).toEqual({ model_url: m.source.modelUrl, height_meters: 1.8 });
    expect(calls.filter((c) => c.url.endsWith('rig-1111-2222-3333-4444'))).toHaveLength(3);
    expect(lines[0]).toMatch(/"rig": "rig-1111-2222-3333-4444"/);
    // Without a key the model is not rigged by Meshy (the in-house rig takes it from the download).
    await expect(rigByUrl(m, dir, { fetch })).rejects.toThrow(/MESHY_API_KEY/);
    await expect(fetchCharacter(m, dir, { log: () => {} })).rejects.toThrow(/downloaded by hand/);
  });
});
