import { MAP_FORMAT_VERSION, type MapDocument, type MapRelease } from './schema.ts';

/**
 * Map identity (direction §9, MULTIPLAYER_REVIEW.md 5.5): a map that leaves
 * MapMaker (export now, publish later) carries
 *   mapId       immutable, assigned the first time ("m_" + 16 base32 chars),
 *   versionId   immutable per distinct content ("v_" + 16 base32 chars),
 *   revision    1, 2, 3… for display,
 *   contentHash "sha256:<hex>" of the canonical JSON (keys sorted, no
 *               whitespace, picture and the release block itself left out),
 * in `metadata.release`. Names are never identifiers. Maps without a release
 * block (every map made before this) still load; their identity is derived
 * from their content when they are hosted (`mapIdentity`).
 */

export const PUBLISHED_MAP_ID_RE = /^m_[a-z2-7]{16}$/;
export const VERSION_ID_RE = /^v_[a-z2-7]{16}$/;
export const CONTENT_HASH_RE = /^sha256:[0-9a-f]{64}$/;

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

/** `n` base32 characters from a CSPRNG. */
export function randomBase32(n: number): string {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => BASE32[b & 31]).join('');
}

/** JSON with object keys sorted and no whitespace (undefined fields dropped, as JSON.stringify does). */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : canonicalJson(v))).join(',')}]`;
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o)
    .filter((k) => o[k] !== undefined && typeof o[k] !== 'function')
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
}

/** The map's content as hashed: everything but its picture, picture camera and release block. */
export function canonicalMapJson(map: MapDocument): string {
  const { thumbnail: _t, thumbnailCamera: _c, release: _r, ...metadata } = map.metadata;
  return canonicalJson({ ...map, metadata });
}

/** "sha256:<hex>" of the map's canonical JSON. */
export function mapContentHash(map: MapDocument): string {
  return `sha256:${sha256Hex(new TextEncoder().encode(canonicalMapJson(map)))}`;
}

/** A versionId derived from a content hash, for maps hosted without a release block (same content, same ID). */
export const derivedVersionId = (hash: string): string => `v_${hexToBase32(hash.replace(/^sha256:/, '')).slice(0, 16)}`;

/**
 * Stamp a map for export/publish: keeps its mapId (or assigns one), keeps
 * its versionId while the content is unchanged, otherwise a new versionId
 * and the next revision. Returns a new document; the input is untouched.
 */
export function stampMapRelease(map: MapDocument, now: Date = new Date()): MapDocument {
  const contentHash = mapContentHash(map);
  const prev = map.metadata.release;
  if (prev && prev.contentHash === contentHash) return map;
  const release: MapRelease = {
    mapId: prev?.mapId ?? `m_${randomBase32(16)}`,
    versionId: `v_${randomBase32(16)}`,
    revision: (prev?.revision ?? 0) + 1,
    contentHash,
    schemaVersion: MAP_FORMAT_VERSION,
    releasedAt: now.toISOString(),
  };
  return { ...map, metadata: { ...map.metadata, release } };
}

/** What a host announces about the map it runs: from its release block, else derived from its content. */
export function mapIdentity(map: MapDocument): { mapId: string; versionId: string; contentHash: string; stamped: boolean } {
  const contentHash = mapContentHash(map);
  const r = map.metadata.release;
  if (r && r.contentHash === contentHash) return { mapId: r.mapId, versionId: r.versionId, contentHash, stamped: true };
  return { mapId: r?.mapId ?? map.metadata.id, versionId: derivedVersionId(contentHash), contentHash, stamped: false };
}

function hexToBase32(hex: string): string {
  let bits = '';
  for (const c of hex) bits += parseInt(c, 16).toString(2).padStart(4, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += BASE32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

// ---------------------------------------------------------------- SHA-256 (synchronous, same everywhere)

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** SHA-256 of `data` as lowercase hex. */
export function sha256Hex(data: Uint8Array): string {
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const len = data.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(data);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(len / 0x20000000));
  view.setUint32(padded.length - 4, (len << 3) >>> 0);
  const w = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15]!;
      const b = w[i - 2]!;
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let a = h[0]!, b = h[1]!, c = h[2]!, d = h[3]!, e = h[4]!, f = h[5]!, g = h[6]!, hh = h[7]!;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i]! + w[i]!) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0]! + a) >>> 0;
    h[1] = (h[1]! + b) >>> 0;
    h[2] = (h[2]! + c) >>> 0;
    h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0;
    h[5] = (h[5]! + f) >>> 0;
    h[6] = (h[6]! + g) >>> 0;
    h[7] = (h[7]! + hh) >>> 0;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, '0')).join('');
}
