#!/usr/bin/env node
// Summarise a performance recording (Pause → Settings → Record performance; docs/PERF_TOOLS.md), or compare two
// (before / after).
//
//   node tools/perf/compare.mjs recording.json
//   node tools/perf/compare.mjs before.json after.json
//   options: --json (machine-readable), --worst=N (worst places listed, default 8)
//
// Per system: the average a frame (weighted by frames) and the p95 frame (from the recording's histograms);
// frame times; hitches (count, per minute, the worst, and where they cluster: 10 m cells of the map); draws,
// shadow casters and the counts.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** p-quantile from a histogram (bucket edges `edges`, counts one longer: the last is "above the top edge"). */
export function histQuantile(edges, counts, q) {
  const total = counts.reduce((s, n) => s + n, 0);
  if (!total) return 0;
  const want = q * total;
  let seen = 0;
  for (let i = 0; i < counts.length; i++) {
    const n = counts[i];
    if (seen + n >= want && n > 0) {
      const lo = i === 0 ? 0 : edges[i - 1];
      const hi = i < edges.length ? edges[i] : edges[edges.length - 1] * 2;
      return lo + ((want - seen) / n) * (hi - lo);
    }
    seen += n;
  }
  return edges[edges.length - 1];
}

const SYSTEMS = [
  ['frame', 'frame time'],
  ['characters', 'characters (update + clips + skinning)'],
  ['charAnim', '  of which clips + aim'],
  ['charSkin', '  of which skinning'],
  ['effects', 'effects'],
  ['ragdolls', 'ragdolls + effects physics'],
  ['flames', 'prop flames'],
  ['hud', 'HUD'],
  ['net', 'net in'],
  ['game', 'other game JS'],
  ['renderScene', 'render: scene / meshes'],
  ['renderCull', '  of which mesh evaluation'],
  ['renderShadow', 'render: shadow + depth maps'],
  ['renderPost', 'render: post-processing'],
];

export function summarise(rec, worstN = 8) {
  if (rec.format !== 'tiletrigger-perf-recording') throw new Error('not a Tile Trigger performance recording');
  const f = rec.secondFields;
  const col = (name) => f.indexOf(name);
  const rows = rec.perSecond;
  const frames = rows.reduce((s, r) => s + r[col('frames')], 0) || 1;
  const wavg = (name) => {
    const i = col(name);
    if (i < 0) return null;
    let s = 0;
    let n = 0;
    for (const r of rows) {
      if (r[i] < 0) continue;
      s += r[i] * r[col('frames')];
      n += r[col('frames')];
    }
    return n ? s / n : null;
  };
  const systems = {};
  for (const [k] of SYSTEMS) {
    const h = rec.histograms[k];
    systems[k] = { avg: k === 'frame' ? wavg('frameAvg') : wavg(`${k}Avg`), p95: h ? histQuantile(rec.buckets, h, 0.95) : null };
  }
  const counts = {};
  for (const k of ['draws', 'meshes', 'casters', 'characters', 'effectsDrawn', 'animated', 'skinned', 'ragdolls', 'lasting', 'effects', 'built']) counts[k] = wavg(k);
  const shadersNew = rows.reduce((s, r) => s + Math.max(0, r[col('shadersNew')] ?? 0), 0);
  const serverTick = wavg('serverTickAvg');
  // Hitches: the worst, and where they cluster (10 m cells).
  const hitches = rec.hitches ?? [];
  const cells = new Map();
  for (const h of hitches) {
    if (!h.pos) continue;
    const key = `${Math.round(h.pos[0] / 10) * 10},${Math.round(h.pos[2] / 10) * 10}`;
    const c = cells.get(key) ?? { at: key, hitches: 0, worst: 0, sum: 0 };
    c.hitches++;
    c.worst = Math.max(c.worst, h.dt);
    c.sum += h.dt;
    cells.set(key, c);
  }
  const worst = [...hitches].sort((a, b) => b.dt - a.dt).slice(0, worstN).map((h) => {
    const top = Object.entries(h.split ?? {})
      .filter(([k]) => !['charAnim', 'charSkin', 'renderCull'].includes(k))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k} ${v.toFixed(1)}`);
    // Round 4's recordings say what the main thread did over the frame: long tasks, and the browser's long frames
    // (blocked time, the longest scripts). Outside time with neither: the main thread waited (the GPU, the compositor).
    const main = h.main ? { longTasks: h.main.longTasks, blocked: h.main.frames?.reduce((t, f) => t + (f.blocking ?? 0), 0) ?? 0, scripts: h.main.frames?.flatMap((f) => f.scripts ?? []).slice(0, 3) } : undefined;
    return { t: h.t, dt: h.dt, outside: h.outside, pos: h.pos, top: top.join(', '), inView: h.inView, shadersNew: h.shadersNew, server: h.server, ...(main ? { main } : {}) };
  });
  return {
    file: rec.match?.map,
    app: rec.app,
    machine: `${rec.machine?.gpu ?? '?'}; ${rec.machine?.cores ?? '?'} cores`,
    settings: `${rec.settings?.graphics}, render scale ${rec.settings?.renderScale}, cap ${rec.settings?.frameCap ?? 'none'}`,
    match: `${rec.match?.map}, ${rec.match?.mode}, ${rec.match?.players} players (${rec.match?.match})`,
    seconds: rec.seconds,
    frames: rec.frames,
    fps: rec.frames / Math.max(1, rec.seconds),
    systems,
    counts,
    shadersNew,
    serverTick,
    hitches: { count: rec.hitchCount, perMinute: (rec.hitchCount / Math.max(1, rec.seconds)) * 60, over100: hitches.filter((h) => h.dt > 100).length, over250: hitches.filter((h) => h.dt > 250).length, worst, places: [...cells.values()].sort((a, b) => b.sum - a.sum).slice(0, worstN) },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

function main() {
const args = process.argv.slice(2);
  const files = args.filter((a) => !a.startsWith('--'));
  const asJson = args.includes('--json');
  const worstN = Number(args.find((a) => a.startsWith('--worst='))?.slice(8) ?? 8);
  if (!files.length || files.length > 2) {
    console.error('usage: node tools/perf/compare.mjs <recording.json> [after.json] [--json] [--worst=N]');
    process.exit(2);
  }
  const fmt = (x, d = 1) => (x === null || x === undefined ? '–' : x.toFixed(d));
  const delta = (a, b) => {
    if (a === null || b === null || a === undefined || b === undefined) return '';
    if (!a) return b ? ' (new)' : '';
    const p = ((b - a) / a) * 100;
    return ` (${p >= 0 ? '+' : ''}${p.toFixed(0)} %)`;
  };

  const sums = files.map((p) => summarise(JSON.parse(readFileSync(p, 'utf8')), worstN));
  if (asJson) {
    console.log(JSON.stringify(sums.length === 1 ? sums[0] : { before: sums[0], after: sums[1] }, null, 2));
    return;
  }
  const [a, b] = sums;
  const head = (s, label) => console.log(`${label}${s.match}\n  ${s.app}; ${s.machine}; ${s.settings}\n  ${s.seconds.toFixed(0)} s, ${s.frames} frames, ${s.fps.toFixed(1)} fps`);
  head(a, b ? 'before: ' : '');
  if (b) head(b, 'after:  ');
  console.log('');
  console.log(`${'ms a frame'.padEnd(40)}${b ? 'avg before → after'.padEnd(34) + 'p95 before → after' : 'avg      p95'}`);
  for (const [k, label] of SYSTEMS) {
    const x = a.systems[k];
    if (!b) console.log(`${label.padEnd(40)}${fmt(x.avg, 2).padEnd(9)}${fmt(x.p95, 2)}`);
    else {
      const y = b.systems[k];
      console.log(`${label.padEnd(40)}${`${fmt(x.avg, 2)} → ${fmt(y.avg, 2)}${delta(x.avg, y.avg)}`.padEnd(34)}${fmt(x.p95, 2)} → ${fmt(y.p95, 2)}${delta(x.p95, y.p95)}`);
    }
  }
  console.log('');
  console.log('per frame (avg)');
  for (const k of Object.keys(a.counts)) console.log(`  ${k.padEnd(14)}${b ? `${fmt(a.counts[k])} → ${fmt(b.counts[k])}${delta(a.counts[k], b.counts[k])}` : fmt(a.counts[k])}`);
  console.log(`  ${'shaders built in play'.padEnd(14)} ${b ? `${a.shadersNew} → ${b.shadersNew}` : a.shadersNew}`);
  if (a.serverTick !== null || b?.serverTick) console.log(`  server tick ms ${b ? `${fmt(a.serverTick, 2)} → ${fmt(b.serverTick, 2)}` : fmt(a.serverTick, 2)}`);
  for (const [s, label] of b ? [[a, 'before'], [b, 'after']] : [[a, '']]) {
    console.log('');
    const h = s.hitches;
    console.log(`hitches ${label}: ${h.count} over 50 ms (${h.perMinute.toFixed(1)} a minute), ${h.over100} over 100 ms, ${h.over250} over 250 ms`);
    for (const w of h.worst) console.log(`  ${w.dt.toFixed(0).padStart(5)} ms at ${w.t.toFixed(0)} s, ${w.pos ? `(${w.pos.join(', ')})` : '?'}: ${w.top}${w.outside > w.dt / 2 ? `; ${w.outside.toFixed(0)} ms outside the frame` : ''}; in view ${w.inView.characters} characters, ${w.inView.draws} draws, ${w.inView.casters} casters, ${w.inView.effects} effects, ${w.inView.ragdolls} ragdolls${w.shadersNew ? `; ${w.shadersNew} shaders built` : ''}${w.server ? `; server tick ${w.server.tickAvg} / ${w.server.tickMax} ms` : ''}${w.main ? `; main thread: long tasks ${w.main.longTasks} ms, frames blocked ${w.main.blocked} ms${w.main.scripts?.length ? ` (${w.main.scripts.join('; ')})` : ''}` : ''}`);
    if (h.places.length) console.log(`  places (10 m cells, by hitch time): ${h.places.map((c) => `${c.at} ×${c.hitches} (worst ${c.worst.toFixed(0)})`).join('; ')}`);
  }
}
