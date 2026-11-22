#!/usr/bin/env node
// Sound effects from the Sonniss GDC Game Audio Bundles (docs/AUDIO.md, "Recorded sounds from the Sonniss bundles"):
//   node tools/content/sonniss-audio.mjs <folder holding the owner's Drive `sfx` folder: GDC 2016/, GDC 2017/, ...>
// Every variant in content/sounds.json whose pack is `processed` (a Sonniss bundle) names its original file
// (`file`, under the pack's `drive` folder) and the part to keep (`start` and `length` in seconds). That part is cut out,
// folded to mono (`stereo: true` keeps two channels), compressed when `punch` is set, faded in over 3 ms and out over `fade` seconds
// (`window: true`: a sine-squared fade over each half, for weather beds), its peak set to
// the manifest's level (plus the variant's `level`, in dB) and encoded to Ogg Opus at
// packages/client/public/sounds/<id>_<n>.ogg. content/sonniss.lock.json records what was written; `pnpm content:build`
// reads it for content/provenance.json and `pnpm content:check` holds the shipped files to it and to the manifest.
// The bundles' own files never go in the repo (the licence forbids passing them on). Needs ffmpeg with libopus.
// ONLY=<id,id> rebuilds just those sounds.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLock, writeLock } from './lockfile.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST = join(ROOT, 'content/sounds.json');
export const SONNISS_LOCK = join(ROOT, 'content/sonniss.lock.json');
const OUT = join(ROOT, 'packages/client/public/sounds');

/** Every processed variant of the manifest: its sound, index, output file (under public/), pack and the spec it is cut to. */
export function processedVariants(manifest) {
  const out = [];
  for (const [id, sound] of Object.entries(manifest.sounds)) {
    if (sound.synth) continue;
    sound.variants.forEach((v, i) => {
      const pack = manifest.packs[v.pack];
      if (!pack?.processed) return;
      out.push({ id, index: i, file: `sounds/${id}_${i}.ogg`, pack: v.pack, source: `${pack.drive}/${v.file}`, spec: specOf(v, manifest.processing) });
    });
  }
  return out;
}

/** What a variant is cut and encoded to (a change to any of it needs a rebuild). */
export function specOf(v, processing) {
  const length = v.length;
  return {
    start: v.start ?? 0,
    length,
    fade: v.window ? length / 2 : (v.fade ?? Math.min(0.06, length / 4)),
    ...(v.window ? { window: true } : {}),
    peak: processing.peakDb + (v.level ?? 0),
    channels: v.stereo ? 2 : 1,
    ...(v.punch ? { punch: true } : {}),
    kbps: v.stereo ? processing.stereoKbps : processing.monoKbps,
  };
}

/** A short hash of a spec, kept in the lock so the check sees a manifest change that was never rebuilt. */
export const specHash = (spec) => createHash('sha256').update(JSON.stringify(spec)).digest('hex').slice(0, 12);

/** The studio that made a bundle file: the folder name before " - " (`Pole Position Production - Glock 18c` → Pole Position Production). */
export function studioOf(file) {
  const parts = file.split('/');
  for (const p of parts.slice(0, -1).reverse()) {
    const m = /^(.+?)\s+[-–]\s+/.exec(p);
    if (m) return m[1].trim();
  }
  return null;
}

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr.slice(-600)}`);
  return r.stderr;
}

/** `punch`: a fast compressor that brings a recording's body up to its peak (gunshots and blasts read as loud as the synthesiser's). */
export const PUNCH = 'acompressor=threshold=-26dB:ratio=6:attack=0.3:release=90:makeup=1';

function encode(src, out, spec) {
  const cut = `atrim=start=${spec.start}:duration=${spec.length},asetpts=N/SR/TB`;
  const mix = spec.channels === 1 ? ',pan=mono|c0=0.5*c0+0.5*c1' : '';
  // `window`: a sine-squared fade over each half (a bed's copies, laid every half length, add up to a steady level).
  const fades = spec.window ? `,afade=t=in:d=${spec.fade}:curve=hsin,areverse,afade=t=in:d=${spec.fade}:curve=hsin,areverse` : `,afade=t=in:d=0.003,areverse,afade=t=in:d=${spec.fade},areverse`;
  // Mono sources have no c1: fold only what has two channels.
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels', '-of', 'csv=p=0', src], { encoding: 'utf8' });
  const srcChannels = Number(probe.stdout.trim()) || 1;
  const chain = `${cut}${srcChannels > 1 ? mix : ''}${spec.punch ? `,${PUNCH}` : ''}${fades}`;
  const stats = ffmpeg(['-i', src, '-af', `${chain},volumedetect`, '-f', 'null', '-']);
  const max = Number(/max_volume:\s*(-?[\d.]+) dB/.exec(stats)?.[1] ?? 0);
  const gain = Math.round((spec.peak - max) * 100) / 100;
  ffmpeg(['-y', '-fflags', '+bitexact', '-i', src, '-map', '0:a:0', '-vn', '-af', `${chain},volume=${gain}dB`, '-ar', '48000', '-ac', String(spec.channels), '-c:a', 'libopus', '-b:a', `${spec.kbps}k`, '-vbr', 'on', '-application', 'audio', '-map_metadata', '-1', '-flags:a', '+bitexact', out]);
  const d = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], { encoding: 'utf8' });
  return { duration: Math.round(Number(d.stdout.trim()) * 1000) / 1000, gain };
}

function main() {
  const dir = process.argv[2];
  if (!dir || !existsSync(dir)) {
    console.error("usage: node tools/content/sonniss-audio.mjs <folder holding the Drive's sfx folder (GDC 2016/, ...)>");
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
  const lock = existsSync(SONNISS_LOCK) ? readLock(SONNISS_LOCK) : { files: [] };
  const variants = processedVariants(manifest);
  mkdirSync(OUT, { recursive: true });
  const files = [];
  let bytes = 0;
  for (const v of variants) {
    const kept = lock.files.find((f) => f.file === v.file);
    const hash = specHash(v.spec);
    if ((only && !only.has(v.id)) || (kept && kept.source === v.source && kept.spec === hash && existsSync(join(ROOT, 'packages/client/public', v.file)))) {
      if (kept) {
        files.push(kept);
        bytes += kept.bytes;
      }
      continue;
    }
    const src = join(dir, v.source);
    if (!existsSync(src)) throw new Error(`${v.file}: ${v.source} is not in ${dir}`);
    const out = join(ROOT, 'packages/client/public', v.file);
    const { duration, gain } = encode(src, out, v.spec);
    const data = readFileSync(out);
    bytes += data.byteLength;
    files.push({ file: v.file, pack: v.pack, source: v.source, spec: hash, sha256: createHash('sha256').update(data).digest('hex').slice(0, 16), bytes: data.byteLength, duration, gainDb: gain });
    console.log(`built ${v.file.padEnd(34)} ${String(data.byteLength).padStart(7)} B ${String(duration).padStart(6)} s  ${v.source.split('/').pop()}`);
  }
  // Files of processed variants no longer in the manifest (the build removes their .ogg as for any sound).
  for (const f of lock.files) if (!variants.some((v) => v.file === f.file)) rmSync(join(ROOT, 'packages/client/public', f.file), { force: true });
  writeLock(SONNISS_LOCK, { $comment: 'Written by tools/content/sonniss-audio.mjs. Do not edit by hand.', files });
  console.log(`${files.length} Sonniss files, ${(bytes / 1024).toFixed(0)} KB`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
