import { readFileSync } from 'node:fs';
import { deserialize, serialize } from 'node:v8';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, SNAPSHOT_INTERVAL_TICKS, SnapshotBinaryDecoder, SnapshotBinaryEncoder, SnapshotStream, TICK_RATE, encodeSnapshots, initPhysics, isGameMode, loadMap, rulesForMode, type GameEvent, type SnapshotMessage } from '@tiletrigger/shared';
import { Match, initNavigation } from '@tiletrigger/shared/match';

/**
 * What a snapshot costs to hand from the match to its own page, as objects (a structured clone, what
 * `postMessage` does: V8's serialiser here) and as the binary message (shared/net/snapshotBinary.ts), and what a
 * networked player is sent (delta JSON, deflated), for comparison. A bot match, headless.
 *
 *   pnpm --filter @tiletrigger/server snapshot-bench [map=sandfall_colosseum] [bots=64] [seconds=30] [mode=core.tdm]
 *
 * Run with `node --expose-gc` (the script does) for the heap figures: bytes of heap a snapshot's objects take
 * on the reading side, counted with collections held off (a young generation large enough for the whole run).
 * docs/PERF_FLAVIUS_MEMORY_2026-11-16.md, "Snapshot format", has the numbers.
 */
const [mapId = 'sandfall_colosseum', botsArg = '64', secondsArg = '30', modeArg = 'core.tdm'] = process.argv.slice(2);
const bots = Number(botsArg);
const seconds = Number(secondsArg);
if (!isGameMode(modeArg)) throw new Error(`unknown mode ${modeArg}`);
await Promise.all([initPhysics(), initNavigation()]);
const loaded = loadMap(readFileSync(fileURLToPath(new URL(`../../../../maps/${mapId}.json`, import.meta.url)), 'utf8'));
if (!loaded.ok) throw new Error(`${mapId} failed validation`);
const rules = { ...rulesForMode(loaded.map, modeArg), scoreLimit: 0, timeLimitSeconds: 0 };
if (rules.teamSizes?.length === 2) rules.teamSizes = [Math.ceil(bots / 2), Math.floor(bots / 2)];
const match = new Match(loaded.map, rules, 42);
for (let i = 0; i < bots; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal);
match.watchers.add(0);
for (let i = 0; i < 20 * TICK_RATE; i++) match.step();

const snaps: SnapshotMessage[] = [];
const stream = new SnapshotStream();
let lastText = '';
let lastBin = new Uint8Array(0);
const wire = { raw: 0, zipped: 0, binZipped: 0 };
const binForWire = new SnapshotBinaryEncoder();
let pending: GameEvent[] = [];
for (let i = 0; i < seconds * TICK_RATE; i++) {
  pending.push(...match.step());
  if (match.tick % SNAPSHOT_INTERVAL_TICKS) continue;
  const body = match.snapshot(pending);
  pending = [];
  const me = match.privateState(0);
  const msg: SnapshotMessage = { t: 'snapshot', ack: match.slots[0]?.lastSeq ?? 0, ...(me ? { me } : {}), ...body };
  snaps.push(msg);
  // A networked player's copy: delta JSON on its stream, then the link's deflate (its window: the last 32 KB sent).
  const [text] = encodeSnapshots(body, [{ slot: 0, ack: msg.ack, ...(me ? { me } : {}), stream }]);
  wire.raw += text!.length;
  wire.zipped += deflateRawSync(text!, { level: 6, ...(lastText ? { dictionary: Buffer.from(lastText) } : {}) }).length;
  lastText = text!.slice(-32768);
  // The binary message on the same link, for comparison (it has no deltas).
  const buf = binForWire.encode(msg)!;
  const bin = new Uint8Array(buf, 0, new DataView(buf).getUint32(8, true)).slice();
  wire.binZipped += deflateRawSync(bin, { level: 6, ...(lastBin.length ? { dictionary: lastBin } : {}) }).length;
  lastBin = bin.slice(-32768);
  binForWire.recycle(buf);
}

const n = snaps.length;
const perSec = TICK_RATE / SNAPSHOT_INTERVAL_TICKS;
const gc = (globalThis as { gc?: () => void }).gc;
const heap = () => process.memoryUsage().heapUsed;
const quant = (list: number[], q: number) => [...list].sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor(list.length * q))]!;
const ms = (list: number[]) => `median ${quant(list, 0.5).toFixed(3)} ms, p95 ${quant(list, 0.95).toFixed(3)} ms`;
const rate = (bytes: number) => `${(bytes / n).toFixed(0)} B a snapshot, ${(((bytes / n) * perSec) / 1048576).toFixed(2)} MB/s`;
/** Times each step of `work` (after a warm-up pass), then runs it once more counting the heap it leaves. */
function measure<T>(work: (i: number) => T): { times: number[]; heap: number } {
  // (Several passes first: the figures are for code the engine has optimised, as in a match that has run a minute.)
  for (let pass = 0; pass < 6; pass++) for (let i = 0; i < n; i++) work(i);
  const times: number[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    work(i);
    times.push(performance.now() - t0);
  }
  gc?.();
  const h0 = heap();
  for (let i = 0; i < n; i++) work(i);
  return { times, heap: heap() - h0 };
}

console.log(`${mapId}, ${modeArg}, ${bots} bots: ${n} snapshots at ${perSec} a second`);
// Objects: the worker serialises (structured clone), the page deserialises.
const clones = snaps.map((s) => serialize(s));
const cloneBytes = clones.reduce((a, b) => a + b.length, 0);
const ser = measure((i) => serialize(snaps[i]));
const de = measure((i) => deserialize(clones[i]!));
console.log(`objects (structured clone): ${(cloneBytes / n).toFixed(0)} B a snapshot (JSON ${(snaps.reduce((a, s) => a + JSON.stringify(s).length, 0) / n).toFixed(0)} B)`);
console.log(`  write: ${ms(ser.times)}`);
console.log(`  read:  ${ms(de.times)}; heap ${rate(de.heap)}`);

// Binary: the worker encodes into a pooled buffer and transfers it, the page decodes into its ring and hands the buffer back.
const enc = new SnapshotBinaryEncoder();
const bufs = snaps.map((s) => {
  const b = enc.encode(s);
  if (!b) throw new Error(`not encodable: ${enc.failed}`);
  return b.slice(0, new DataView(b).getUint32(8, true));
});
const binBytes = bufs.reduce((a, b) => a + b.byteLength, 0);
const enc2 = new SnapshotBinaryEncoder();
const write = measure((i) => enc2.recycle(enc2.encode(snaps[i]!)!));
const ring = new SnapshotBinaryDecoder({ ring: 72 });
const read = measure((i) => {
  const m = ring.decode(bufs[i]!);
  ring.commit();
  return m;
});
const plain = new SnapshotBinaryDecoder();
const readFresh = measure((i) => plain.decode(bufs[i]!));
console.log(`binary v1: ${(binBytes / n).toFixed(0)} B a snapshot`);
console.log(`  write: ${ms(write.times)}; heap ${rate(write.heap)}`);
console.log(`  read into the ring: ${ms(read.times)}; heap ${rate(read.heap)}`);
console.log(`  read into new objects: ${ms(readFresh.times)}; heap ${rate(readFresh.heap)}`);
console.log(`networked player's link: delta JSON ${(wire.raw / n).toFixed(0)} B, deflated ${(wire.zipped / n).toFixed(0)} B a snapshot = ${(((wire.zipped / n) * perSec) / 1024).toFixed(1)} KB/s`);
console.log(`  the binary message deflated on that link would be ${(wire.binZipped / n).toFixed(0)} B a snapshot = ${(((wire.binZipped / n) * perSec) / 1024).toFixed(1)} KB/s`);
