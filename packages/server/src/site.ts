import { createHash } from 'node:crypto';
import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ktx2': 'image/ktx2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.env': 'application/octet-stream',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};
/** Worth compressing on the way out (models and images already are). */
const TEXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.gltf', '.wasm', '.txt']);

/** A content hash of a file, as a weak ETag (the same for its gzipped and plain forms). */
function hashFile(file: string): Promise<string> {
  return new Promise((ok, fail) => {
    const h = createHash('sha256');
    createReadStream(file)
      .on('data', (c) => h.update(c))
      .on('error', fail)
      .on('end', () => ok(`W/"${h.digest('base64url').slice(0, 22)}"`));
  });
}

/** Whether an If-None-Match header names this ETag (weak comparison, as RFC 9110 has it for GET). */
function matches(header: string | string[] | undefined, etag: string): boolean {
  if (!header) return false;
  const tags = (Array.isArray(header) ? header.join(',') : header).split(',').map((t) => t.trim().replace(/^W\//, ''));
  return tags.includes('*') || tags.includes(etag.replace(/^W\//, ''));
}

/** Cache-Control for a site path: Vite's hashed files a year, pages revalidated every time, the rest (models,
 * textures and sounds under their own names) an hour, then revalidated by ETag (a 304 when unchanged). A CDN in
 * front (CloudFront, docs/HOSTING.md) follows the same headers. */
export function cacheControl(path: string, ext: string): string {
  return /\/assets\//.test(path) ? 'public, max-age=31536000, immutable' : ext === '.html' ? 'no-cache' : 'public, max-age=3600';
}

/**
 * Serves the built game (packages/client/dist) from the hub, so one address
 * is the whole site: pages, assets, broker and game browser. Text files are
 * gzipped once and kept in memory; Vite's hashed files are cached for a year;
 * every file carries an ETag (its content hash), so a browser or CDN whose copy
 * has expired gets a 304 instead of the file again when it hasn't changed.
 * `dir` may be a symlink that an update switches to another build while the
 * hub runs (infra/host-setup.sh, tiletrigger-update): it is resolved on every
 * request, so a request is served from one build, and the gzipped copies of
 * the build before are dropped.
 */
export function siteHandler(dir: string) {
  const root = resolve(dir);
  const zipped = new Map<string, Buffer>();
  const etags = new Map<string, Promise<string>>();
  let served = '';
  return async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    let base: string;
    try {
      base = realpathSync(root);
    } catch {
      return next();
    }
    if (base !== served) {
      zipped.clear();
      etags.clear();
      served = base;
    }
    let path: string;
    try {
      path = decodeURIComponent(new URL(req.url ?? '/', 'http://site').pathname);
    } catch {
      return next();
    }
    let file = normalize(join(base, path));
    // Inside the build only (not a sibling folder whose name starts the same).
    if (file !== base && !file.startsWith(base + sep)) return next();
    // A folder with its own page (/privacy, /privacy/) gets that page.
    if (existsSync(file) && statSync(file).isDirectory() && file !== base && existsSync(join(file, 'index.html'))) file = join(file, 'index.html');
    if (!existsSync(file) || statSync(file).isDirectory()) {
      // Pages without a file of their own (and the root) get the game.
      if (extname(path)) return next();
      file = join(base, 'index.html');
    }
    const ext = extname(file).toLowerCase();
    res.setHeader('Content-Type', TYPES[ext] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', cacheControl(path, ext));
    let etag = etags.get(file);
    if (!etag) etags.set(file, (etag = hashFile(file)));
    let tag: string;
    try {
      tag = await etag;
    } catch {
      etags.delete(file);
      return next();
    }
    res.setHeader('ETag', tag);
    if (TEXT.has(ext)) res.setHeader('Vary', 'Accept-Encoding');
    if (matches(req.headers['if-none-match'], tag)) {
      res.statusCode = 304;
      return void res.end();
    }
    if (TEXT.has(ext) && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) {
      let body = zipped.get(file);
      if (!body) zipped.set(file, (body = gzipSync(await readFile(file), { level: 6 })));
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', body.length);
      return void res.end(req.method === 'HEAD' ? undefined : body);
    }
    res.setHeader('Content-Length', statSync(file).size);
    if (req.method === 'HEAD') return void res.end();
    createReadStream(file).pipe(res);
  };
}
