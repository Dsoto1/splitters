#!/usr/bin/env node
// The owner's own music and announcer lines (content/owner-audio.json; docs/AUDIO_MUSIC_ANNOUNCER_PLAN.md):
//   node tools/content/owner-audio.mjs <folder with the owner's files>
// Each source (the file whose name starts with an entry's `source`) has its silence trimmed at both ends, its
// loudness evened out (two-pass EBU R128 to the manifest's LUFS) and is encoded to Ogg Opus:
// packages/client/public/music/<id>.ogg and packages/client/public/voice/<id>.ogg. content/owner-audio.lock.json
// records what was written; `pnpm content:build` reads it for content/provenance.json and `pnpm content:check`
// holds the shipped files to it. The owner's originals stay outside the repo (never commit them).
// Needs ffmpeg with libopus. ONLY=<id,id> rebuilds just those entries.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLock, writeLock } from './lockfile.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST = join(ROOT, 'content/owner-audio.json');
const LOCK = join(ROOT, 'content/owner-audio.lock.json');
const OUT = { music: join(ROOT, 'packages/client/public/music'), voice: join(ROOT, 'packages/client/public/voice') };

/** Every entry of the manifest: its kind (music or voice), id, source prefix and output path (relative to public/). */
export function ownerAudioEntries(manifest) {
  const out = [];
  for (const [set, tracks] of Object.entries(manifest.music)) for (const t of tracks) out.push({ kind: 'music', set, id: t.id, source: t.source, file: `music/${t.id}.ogg` });
  for (const [id, line] of Object.entries(manifest.announcer)) out.push({ kind: 'voice', set: 'announcer', id, source: line.source, file: `voice/${id}.ogg` });
  return out;
}

/** The source file for a prefix: its name starts with the prefix, then `_`, `-`, `.` or a space (so `Arena_Music_1` isn't `Arena_Music_10`). */
export function findSource(names, prefix) {
  const hits = names.filter((n) => n.startsWith(prefix) && /^[_\-. ]/.test(n.slice(prefix.length)) && /\.(mp3|wav|flac|ogg|m4a)$/i.test(n));
  if (hits.length > 1) throw new Error(`${prefix}: more than one source (${hits.join(', ')})`);
  return hits[0] ?? null;
}

function trimFilter(kind) {
  const keep = kind === 'music' ? 0.25 : 0.03;
  const th = kind === 'music' ? '-60dB' : '-50dB';
  return `silenceremove=start_periods=1:start_threshold=${th}:start_silence=${keep},areverse,silenceremove=start_periods=1:start_threshold=${th}:start_silence=${keep},areverse`;
}

function run(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr.slice(-600)}`);
  return r.stderr;
}

function encode(src, out, kind, enc) {
  const first = run(['-i', src, '-af', `${trimFilter(kind)},loudnorm=I=${enc.lufs}:TP=${enc.truePeak}:LRA=11:print_format=json`, '-f', 'null', '-']);
  const json = JSON.parse(first.slice(first.lastIndexOf('{'), first.lastIndexOf('}') + 1));
  const norm = `loudnorm=I=${enc.lufs}:TP=${enc.truePeak}:LRA=11:measured_I=${json.input_i}:measured_TP=${json.input_tp}:measured_LRA=${json.input_lra}:measured_thresh=${json.input_thresh}:offset=${json.target_offset}:linear=true`;
  // A short fade at the music's end so a trimmed tail never clicks.
  const tail = kind === 'music' ? ',areverse,afade=t=in:d=0.6,areverse' : '';
  run(['-y', '-fflags', '+bitexact', '-i', src, '-af', `${trimFilter(kind)},${norm}${tail}`, '-ar', '48000', '-ac', String(enc.channels), '-c:a', 'libopus', '-b:a', `${enc.kbps}k`, '-vbr', 'on', '-application', kind === 'music' ? 'audio' : 'voip', '-map_metadata', '-1', '-flags:a', '+bitexact', out]);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], { encoding: 'utf8' });
  return { duration: Math.round(Number(probe.stdout.trim()) * 100) / 100, inputLufs: Math.round(Number(json.input_i) * 10) / 10 };
}

function main() {
  const dir = process.argv[2];
  if (!dir || !existsSync(dir)) {
    console.error('usage: node tools/content/owner-audio.mjs <folder with the owner\'s files>');
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
  const lock = existsSync(LOCK) ? readLock(LOCK) : { files: [] };
  const names = readdirSync(dir);
  const entries = ownerAudioEntries(manifest);
  for (const d of Object.values(OUT)) mkdirSync(d, { recursive: true });
  const files = [];
  for (const e of entries) {
    if (only && !only.has(e.id)) {
      const kept = lock.files.find((f) => f.id === e.id);
      if (kept) files.push(kept);
      continue;
    }
    const name = findSource(names, e.source);
    if (!name) throw new Error(`${e.id}: no file starting with ${e.source} in ${dir}`);
    const out = join(ROOT, 'packages/client/public', e.file);
    const enc = manifest.encode[e.kind];
    const { duration, inputLufs } = encode(join(dir, name), out, e.kind, enc);
    const data = readFileSync(out);
    files.push({
      id: e.id,
      kind: e.kind,
      set: e.set,
      file: e.file,
      source: name.replace(/\.[a-z0-9]+$/i, ''),
      sha256: createHash('sha256').update(data).digest('hex').slice(0, 16),
      bytes: data.byteLength,
      duration,
      inputLufs,
    });
    console.log(`built ${e.file.padEnd(30)} ${String(data.byteLength).padStart(8)} B ${String(duration).padStart(7)} s (was ${inputLufs} LUFS)`);
  }
  // Files no entry writes any more.
  const wanted = new Set(entries.map((e) => e.file));
  for (const [kind, d] of Object.entries(OUT)) for (const f of readdirSync(d)) if (!wanted.has(`${kind}/${f}`)) rmSync(join(d, f));
  writeLock(LOCK, { $comment: 'Written by tools/content/owner-audio.mjs. Do not edit by hand.', files });
  const music = files.filter((f) => f.kind === 'music').reduce((s, f) => s + f.bytes, 0);
  const voice = files.filter((f) => f.kind === 'voice').reduce((s, f) => s + f.bytes, 0);
  console.log(`music ${(music / 1e6).toFixed(2)} MB, voice ${(voice / 1e3).toFixed(0)} KB`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
