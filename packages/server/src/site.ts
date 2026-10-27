import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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
const TEXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.gltf', '.wasm', '.txt']);

/**
 * Serves the built game (packages/client/dist) from the hub, so one address
 * is the whole site: pages, assets, broker and game browser. Text files are
 * gzipped once and kept in memory; Vite's hashed files are cached for a year.
 */
export function siteHandler(dir: string) {
  const root = resolve(dir);
  const zipped = new Map<string, Buffer>();
  return async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://site').pathname);
    let file = normalize(join(root, path));
    if (!file.startsWith(root)) return next();
    // A folder with its own page (/privacy, /privacy/) gets that page.
    if (existsSync(file) && statSync(file).isDirectory() && file !== root && existsSync(join(file, 'index.html'))) file = join(file, 'index.html');
    if (!existsSync(file) || statSync(file).isDirectory()) {
      // Pages without a file of their own (and the root) get the game.
      if (extname(path)) return next();
      file = join(root, 'index.html');
    }
    const ext = extname(file).toLowerCase();
    res.setHeader('Content-Type', TYPES[ext] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', /\/assets\//.test(path) ? 'public, max-age=31536000, immutable' : ext === '.html' ? 'no-cache' : 'public, max-age=3600');
    if (TEXT.has(ext) && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) {
      let body = zipped.get(file);
      if (!body) zipped.set(file, (body = gzipSync(await readFile(file), { level: 6 })));
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('Content-Length', body.length);
      return void res.end(req.method === 'HEAD' ? undefined : body);
    }
    res.setHeader('Content-Length', statSync(file).size);
    if (req.method === 'HEAD') return void res.end();
    createReadStream(file).pipe(res);
  };
}
