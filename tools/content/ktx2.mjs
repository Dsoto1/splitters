// GPU-compressed textures: KTX2 with Basis Universal (KHR_texture_basisu), the format character maps ship in (owner,
// 2026-11-25: 2048 px colour maps affordable in GPU memory). A KTX2 texture stays compressed on the GPU (BC7 or ASTC
// on most hardware, 1 byte a texel, against 4 for a decoded JPEG or PNG), with its mipmaps made here, ahead of time.
//
// The encoder is KTX-Software's `ktx` tool (Khronos, Apache-2.0): `KTX_BIN=<path to ktx>`, else `ktx` on the PATH,
// else the pinned release, fetched once into ~/.cache/tiletrigger (checked against its SHA-256). Encoding happens
// when content is built on a workstation; CI and the game only read the files (the game through Babylon's KTX2
// decoder, its transcoder served from packages/client/public/ktx2/).
//
//   encodeKtx2(png, { kind })   a PNG/JPEG (any image sharp reads) to KTX2 bytes, with mipmaps
//   decodeKtx2(ktx2)            KTX2 bytes back to a PNG (RGBA), for tools that read a built model's pictures
//   readPicture(texture)        a glTF-Transform texture's picture as sharp input (decoded when it is KTX2)
//   texturesToKtx2(doc, kinds)  every texture of a document to KTX2 (KHR_texture_basisu, required)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { KHRTextureBasisu } from '@gltf-transform/extensions';
import sharp from 'sharp';

const RELEASE = {
  version: '4.4.2',
  url: 'https://github.com/KhronosGroup/KTX-Software/releases/download/v4.4.2/KTX-Software-4.4.2-Linux-x86_64.tar.bz2',
  sha256: 'a8781bad05f9624edbf910b7f258cd0a4ba7d3e63b49ecc0a0ab440bf6a0a245',
  bin: 'KTX-Software-4.4.2-Linux-x86_64/bin/ktx',
};

/**
 * How each kind of map is encoded (measured on Talon Skycrest's 2048 px colour map and 1024 px normal map,
 * docs/CONTENT_PIPELINE.md, "GPU-compressed textures"):
 * - colour: ETC1S (BasisLZ) at its best quality: 0.87 MB for a 2048 map, 33.1 dB against the lossless map (the
 *   1024 px JPEG it replaces, scaled up, is 29.4 dB). UASTC kept 42-52 dB but took 3.3-4.0 MB a map even with
 *   rate-distortion optimisation and Zstandard (Meshy's noisy paint barely compresses), over twice the old budget
 *   for every character.
 * - normal: UASTC (RDO, Zstandard): 0.5° mean error, where ETC1S bent normals 6° on average (a JPEG 4.7°).
 * - data (metal-roughness): ETC1S.
 * Both transcode to BC7 on desktop GPUs, ASTC or ETC on phones (Babylon's KTX2 decoder): 1 byte a texel or less.
 */
export const KTX2_KINDS = {
  colour: ['--encode', 'basis-lz', '--clevel', '4', '--qlevel', '255', '--assign-tf', 'srgb', '--format', 'R8G8B8_SRGB'],
  normal: ['--encode', 'uastc', '--uastc-quality', '2', '--uastc-rdo', '--uastc-rdo-l', '4', '--zstd', '22', '--assign-tf', 'linear', '--format', 'R8G8B8_UNORM'],
  data: ['--encode', 'basis-lz', '--clevel', '4', '--qlevel', '255', '--assign-tf', 'linear', '--format', 'R8G8B8_UNORM'],
};

let found = null;
/** The `ktx` tool (see the header). */
export function ktxBin() {
  if (found) return found;
  if (process.env.KTX_BIN) return (found = process.env.KTX_BIN);
  try {
    execFileSync('ktx', ['--version'], { stdio: 'ignore' });
    return (found = 'ktx');
  } catch {
    // not on the PATH: the pinned release
  }
  const dir = join(homedir(), '.cache/tiletrigger', `ktx-${RELEASE.version}`);
  const bin = join(dir, RELEASE.bin);
  if (!existsSync(bin)) {
    mkdirSync(dir, { recursive: true });
    const archive = join(dir, 'ktx.tar.bz2');
    execFileSync('curl', ['-sSfL', '-o', archive, RELEASE.url], { stdio: 'inherit' });
    const sum = createHash('sha256').update(readFileSync(archive)).digest('hex');
    if (sum !== RELEASE.sha256) throw new Error(`KTX-Software download's SHA-256 is ${sum}, expected ${RELEASE.sha256}`);
    execFileSync('tar', ['-xjf', archive, '-C', dir]);
    rmSync(archive);
  }
  return (found = bin);
}

function inTemp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'ktx2-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** An image (anything sharp reads) to KTX2 bytes with a full mip chain, encoded as `kind` (KTX2_KINDS). */
export async function encodeKtx2(image, { kind = 'colour' } = {}) {
  const args = KTX2_KINDS[kind];
  if (!args) throw new Error(`encodeKtx2: unknown kind ${kind}`);
  const png = await sharp(Buffer.from(image)).removeAlpha().png({ compressionLevel: 1 }).toBuffer();
  return inTemp((dir) => {
    const [src, out] = [join(dir, 'in.png'), join(dir, 'out.ktx2')];
    writeFileSync(src, png);
    // --testrun: no tool version or date in the file, so the same picture always makes the same bytes.
    execFileSync(ktxBin(), ['create', '--testrun', '--generate-mipmap', ...args, src, out], { stdio: ['ignore', 'ignore', 'inherit'] });
    return new Uint8Array(readFileSync(out));
  });
}

/** KTX2 bytes back to a PNG (its top level, RGBA). */
export function decodeKtx2(ktx2) {
  return inTemp((dir) => {
    const [src, out] = [join(dir, 'in.ktx2'), join(dir, 'out.png')];
    writeFileSync(src, ktx2);
    execFileSync(ktxBin(), ['extract', '--transcode', 'rgba8', src, out], { stdio: ['ignore', 'ignore', 'inherit'] });
    return readFileSync(out);
  });
}

/** A texture's picture as sharp can read it (a KTX2 one decoded first). */
export function readPicture(texture) {
  const img = texture.getImage();
  if (!img) return null;
  return texture.getMimeType() === 'image/ktx2' ? decodeKtx2(img) : Buffer.from(img);
}

/**
 * Every texture of `doc` that isn't KTX2 yet to KTX2 (KHR_texture_basisu, required: the game always has the decoder).
 * `kindOf(texture)` names its kind (KTX2_KINDS); by default the material slot decides: base colour `colour`, normal
 * map `normal`, anything else `data`.
 */
export async function texturesToKtx2(doc, kindOf = null) {
  const slot = new Map();
  for (const m of doc.getRoot().listMaterials()) {
    if (m.getBaseColorTexture()) slot.set(m.getBaseColorTexture(), 'colour');
    if (m.getNormalTexture()) slot.set(m.getNormalTexture(), 'normal');
  }
  let any = false;
  for (const t of doc.getRoot().listTextures()) {
    if (t.getMimeType() === 'image/ktx2' || !t.getImage()) continue;
    const kind = kindOf?.(t) ?? slot.get(t) ?? 'data';
    t.setImage(await encodeKtx2(t.getImage(), { kind })).setMimeType('image/ktx2');
    if (t.getURI()) t.setURI(t.getURI().replace(/\.(png|jpe?g)$/i, '.ktx2'));
    any = true;
  }
  if (any) doc.createExtension(KHRTextureBasisu).setRequired(true);
  return doc;
}

/**
 * The GPU memory a texture takes once loaded (bytes, its mip chain included): `compressed` 1 byte a texel (BC7/ASTC
 * 4x4, what UASTC transcodes to; ETC1S's BC1/ETC1 would be half), else 4 (RGBA8, how a JPEG or PNG is uploaded).
 */
export function gpuBytes(width, height, compressed) {
  let [w, h, sum] = [width, height, 0];
  for (;;) {
    sum += compressed ? Math.ceil(w / 4) * Math.ceil(h / 4) * 16 : w * h * 4;
    if (w === 1 && h === 1) break;
    [w, h] = [Math.max(1, w >> 1), Math.max(1, h >> 1)];
  }
  return sum;
}
