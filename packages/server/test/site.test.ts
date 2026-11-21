import { mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer, request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { siteHandler } from '../src/site.ts';

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const f of cleanup.splice(0)) f();
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'tt-site-'));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function build(root: string, name: string, page: string): string {
  const dir = join(root, 'releases', name);
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), page);
  writeFileSync(join(dir, 'assets', `app-${name}.js`), `console.log(${JSON.stringify(name)})`);
  return dir;
}

/** Points `current` at a build the way tiletrigger-update does (a new link renamed over the old one). */
function point(root: string, name: string): void {
  symlinkSync(join('releases', name), join(root, 'current.new'));
  renameSync(join(root, 'current.new'), join(root, 'current'));
}

async function serve(dir: string): Promise<{ host: string; port: number }> {
  const site = siteHandler(dir);
  const http: Server = createServer((req, res) => {
    void site(req, res, () => {
      res.statusCode = 404;
      res.end('not found');
    });
  });
  cleanup.push(() => http.close());
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', () => r()));
  return { host: '127.0.0.1', port: (http.address() as AddressInfo).port };
}

/** A raw GET (the path exactly as given, no URL clean-up by the client). */
function get(at: { host: string; port: number }, path: string, gzip = false): Promise<{ status: number; encoding?: string; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ ...at, path, headers: gzip ? { 'accept-encoding': 'gzip' } : {} }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        const encoding = res.headers['content-encoding'];
        resolve({ status: res.statusCode ?? 0, encoding, body: (encoding === 'gzip' ? gunzipSync(raw) : raw).toString() });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/** A raw GET with headers, answering the status and the response headers. */
function head(at: { host: string; port: number }, path: string, headers: Record<string, string> = {}): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; length: number }> {
  return new Promise((resolve, reject) => {
    const req = request({ ...at, path, headers }, (res) => {
      let length = 0;
      res.on('data', (c: Buffer) => (length += c.length));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, length }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('site', () => {
  it('sends cache headers for a CDN and the browser, and a 304 for a file that has not changed', async () => {
    const root = tempRoot();
    const dir = build(root, 'aaa', '<p>build aaa</p>');
    mkdirSync(join(dir, 'models'));
    writeFileSync(join(dir, 'models', 'crate.glb'), 'glb-1');
    point(root, 'aaa');
    const at = await serve(join(root, 'current'));

    const page = await head(at, '/');
    expect(page.headers['cache-control']).toBe('no-cache');
    const asset = await head(at, '/assets/app-aaa.js');
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(asset.headers.vary).toBe('Accept-Encoding');
    const model = await head(at, '/models/crate.glb');
    expect(model.headers['cache-control']).toBe('public, max-age=3600');
    const tag = String(model.headers.etag);
    expect(tag).toMatch(/^W\/"[\w-]{22}"$/);

    // Revalidation: unchanged → 304 without a body; the gzipped form has the same tag.
    expect(await head(at, '/models/crate.glb', { 'if-none-match': tag })).toMatchObject({ status: 304, length: 0 });
    expect(await head(at, '/models/crate.glb', { 'if-none-match': `"other", ${tag.slice(2)}` })).toMatchObject({ status: 304 });
    const zipped = await head(at, '/', { 'accept-encoding': 'gzip' });
    expect(zipped.headers.etag).toBe(page.headers.etag);
    expect(await head(at, '/', { 'accept-encoding': 'gzip', 'if-none-match': String(page.headers.etag) })).toMatchObject({ status: 304, length: 0 });

    // A new build with a changed model: a new tag, so the old one gets the file again.
    const next = build(root, 'bbb', '<p>build bbb</p>');
    mkdirSync(join(next, 'models'));
    writeFileSync(join(next, 'models', 'crate.glb'), 'glb-2');
    point(root, 'bbb');
    const changed = await head(at, '/models/crate.glb', { 'if-none-match': tag });
    expect(changed.status).toBe(200);
    expect(changed.headers.etag).not.toBe(tag);
    expect(changed.length).toBe(5);
  });

  it('follows the current-build link when an update switches it, without a hub restart', async () => {
    const root = tempRoot();
    build(root, 'aaa', '<p>build aaa</p>');
    build(root, 'bbb', '<p>build bbb</p>');
    point(root, 'aaa');
    const at = await serve(join(root, 'current'));

    expect((await get(at, '/')).body).toBe('<p>build aaa</p>');
    expect(await get(at, '/', true)).toMatchObject({ encoding: 'gzip', body: '<p>build aaa</p>' });
    expect((await get(at, '/assets/app-aaa.js')).status).toBe(200);

    point(root, 'bbb');
    // The gzipped copy of the old page is not served again.
    expect(await get(at, '/', true)).toMatchObject({ status: 200, encoding: 'gzip', body: '<p>build bbb</p>' });
    expect((await get(at, '/assets/app-bbb.js')).status).toBe(200);
    expect((await get(at, '/assets/app-aaa.js')).status).toBe(404);
  });

  it('serves nothing outside the build, not even a sibling folder whose name starts the same', async () => {
    const root = tempRoot();
    const dir = build(root, 'site', '<p>game</p>');
    mkdirSync(`${dir}-old`);
    writeFileSync(join(`${dir}-old`, 'secret.txt'), 'secret');
    const at = await serve(dir);
    for (const path of ['/..%2fsite-old/secret.txt', '/%2e%2e/site-old/secret.txt', '/..%2f..%2freleases%2fsite-old%2fsecret.txt', '/../site-old/secret.txt']) {
      expect((await get(at, path)).body, path).not.toContain('secret');
    }
    expect((await get(at, '/%E0%A4%A')).status).toBe(404);
  });

  it('answers 404 while the build link is missing, and serves the build once it appears', async () => {
    const root = tempRoot();
    const at = await serve(join(root, 'current'));
    expect((await get(at, '/')).status).toBe(404);
    build(root, 'ccc', '<p>build ccc</p>');
    point(root, 'ccc');
    expect((await get(at, '/')).body).toBe('<p>build ccc</p>');
  });
});
