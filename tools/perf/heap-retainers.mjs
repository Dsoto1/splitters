// What keeps an object alive in a Chrome heap snapshot: the shortest retaining paths from the roots to the objects
// matching a test, and the constructors that grew between two snapshots (docs/PERF_EDITOR_IDLE_2026-11-24.md).
//
//   node tools/perf/heap-retainers.mjs <snapshot> [--match=<name>] [--paths=3] [--diff=<older snapshot>]
//
// It reads the file as a stream (a snapshot of a big tab is larger than one JavaScript string can hold).
//   --match=LeakedScene objects whose constructor (node name) is this; the memory probe hangs a `LeakedScene` on every
//                       disposed scene still in the heap before its snapshot (PROBE_HEAP), so their paths show
//   --diff=<file>       also the constructors whose count and self size grew most since that snapshot
import { createReadStream } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(3).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
const file = process.argv[2];
if (!file) {
  console.error('usage: node tools/perf/heap-retainers.mjs <snapshot> [--match=LeakedScene] [--paths=3] [--diff=<older>]');
  process.exit(2);
}

/** Read a snapshot: its meta, nodes and edges as typed arrays, and its strings. */
async function readSnapshot(path) {
  const stream = createReadStream(path, { encoding: 'utf8', highWaterMark: 1 << 22 });
  let head = '';
  let section = null; // 'nodes' | 'edges' | 'strings' | null
  let nums = new Uint32Array(1 << 20);
  let n = 0;
  let num = -1;
  const arrays = {};
  const strings = [];
  let inStr = false;
  let esc = false;
  let cur = '';
  let depth = 0;
  const push = (v) => {
    if (n === nums.length) {
      const g = new Uint32Array(nums.length * 2);
      g.set(nums);
      nums = g;
    }
    nums[n++] = v;
  };
  let meta = null;
  for await (const chunk of stream) {
    let i = 0;
    while (i < chunk.length) {
      if (section === null) {
        // Up to the next array we care about (in steps: the sections between are long).
        const q = chunk.indexOf('[', i);
        const end = q < 0 ? chunk.length : q + 1;
        head += chunk.slice(i, end);
        i = end;
        const m = /"(nodes|edges|strings)":\[$/.exec(head.slice(-12));
        if (m) {
          if (!meta) meta = JSON.parse(`${head.slice(0, head.lastIndexOf('"nodes"')).trim().replace(/,$/, '')}}`).snapshot.meta;
          section = m[1];
          head = '';
          n = 0;
          num = -1;
          depth = 1;
        }
        if (head.length > 1 << 20) head = head.slice(-64);
        continue;
      }
      if (section === 'strings') {
        const c = chunk[i++];
        if (inStr) {
          if (esc) {
            cur += '\\' + c;
            esc = false;
          } else if (c === '\\') esc = true;
          else if (c === '"') {
            inStr = false;
            strings.push(cur.includes('\\') ? JSON.parse(`"${cur}"`) : cur);
            cur = '';
          } else cur += c;
        } else if (c === '"') inStr = true;
        else if (c === ']') section = null;
        continue;
      }
      const c = chunk.charCodeAt(i++);
      if (c >= 48 && c <= 57) num = (num < 0 ? 0 : num * 10) + (c - 48);
      else {
        if (num >= 0) push(num);
        num = -1;
        if (c === 93) {
          arrays[section] = nums.slice(0, n);
          section = null;
          void depth;
        }
      }
    }
  }
  return { meta, nodes: arrays.nodes, edges: arrays.edges, strings };
}

function index(s) {
  const nf = s.meta.node_fields;
  const ef = s.meta.edge_fields;
  const NF = nf.length;
  const EF = ef.length;
  const nodeTypes = s.meta.node_types[nf.indexOf('type')];
  const edgeTypes = s.meta.edge_types[ef.indexOf('type')];
  const count = s.nodes.length / NF;
  const firstEdge = new Uint32Array(count + 1);
  const ec = nf.indexOf('edge_count');
  for (let i = 0, e = 0; i < count; i++) {
    firstEdge[i] = e;
    e += s.nodes[i * NF + ec] * EF;
    firstEdge[i + 1] = e;
  }
  return { NF, EF, count, firstEdge, nodeTypes, edgeTypes, o: { type: nf.indexOf('type'), name: nf.indexOf('name'), id: nf.indexOf('id'), size: nf.indexOf('self_size'), etype: ef.indexOf('type'), ename: ef.indexOf('name_or_index'), eto: ef.indexOf('to_node') } };
}

const s = await readSnapshot(file);
const x = index(s);
const name = (i) => s.strings[s.nodes[i * x.NF + x.o.name]];
const type = (i) => x.nodeTypes[s.nodes[i * x.NF + x.o.type]];
console.log(`${file}: ${x.count} objects (${Math.round(performance.now() / 1000)} s)`);

function byConstructor(snap, ix) {
  const m = new Map();
  for (let i = 0; i < ix.count; i++) {
    const t = ix.nodeTypes[snap.nodes[i * ix.NF + ix.o.type]];
    if (t !== 'object' && t !== 'closure' && t !== 'native' && t !== 'array') continue;
    const k = `${t === 'object' ? '' : `(${t}) `}${snap.strings[snap.nodes[i * ix.NF + ix.o.name]]}`;
    const r = m.get(k) ?? { n: 0, size: 0 };
    r.n++;
    r.size += snap.nodes[i * ix.NF + ix.o.size];
    m.set(k, r);
  }
  return m;
}

if (args.diff) {
  const older = await readSnapshot(args.diff);
  const ox = index(older);
  const a = byConstructor(older, ox);
  const b = byConstructor(s, x);
  const rows = [...b].map(([k, v]) => ({ k, dn: v.n - (a.get(k)?.n ?? 0), dsize: v.size - (a.get(k)?.size ?? 0), n: v.n })).filter((r) => r.dn > 0 || r.dsize > 0);
  rows.sort((p, q) => q.dsize - p.dsize);
  console.log(`\nGrew most since ${args.diff} (by self size):`);
  for (const r of rows.slice(0, 25)) console.log(`  ${(r.dsize / 1048576).toFixed(2).padStart(8)} MB  +${String(r.dn).padStart(7)}  (${r.n})  ${r.k.slice(0, 90)}`);
}

if (args.match) {
  // Reverse edges (strong ones) for the paths back to the roots.
  const retainers = new Map();
  const isWeak = (et) => et === 'weak' || et === 'shortcut';
  for (let i = 0; i < x.count; i++) {
    for (let e = x.firstEdge[i]; e < x.firstEdge[i + 1]; e += x.EF) {
      const et = x.edgeTypes[s.edges[e + x.o.etype]];
      if (isWeak(et)) continue;
      const to = s.edges[e + x.o.eto] / x.NF;
      let r = retainers.get(to);
      if (!r) retainers.set(to, (r = []));
      r.push([i, e]);
    }
  }
  const edgeName = (e) => {
    const et = x.edgeTypes[s.edges[e + x.o.etype]];
    const v = s.edges[e + x.o.ename];
    return et === 'element' || et === 'hidden' ? `[${v}]` : et === 'context' ? `(context ${s.strings[v]})` : `.${s.strings[v]}`;
  };
  const targets = [];
  for (let i = 0; i < x.count; i++) {
    if (type(i) !== 'object' || name(i) !== args.match) continue;
    targets.push(i);
  }
  console.log(`\n${targets.length} × ${args.match}`);
  const PATHS = Number(args.paths ?? 3);
  for (const t of targets.slice(0, 3)) {
    // Breadth first from the object back towards a root, skipping what other paths already used (distinct paths).
    const used = new Set();
    for (let p = 0; p < PATHS; p++) {
      const prev = new Map([[t, null]]);
      const q = [t];
      let qi = 0;
      let root = -1;
      while (qi < q.length && root < 0) {
        const cur = q[qi++];
        for (const [from, e] of retainers.get(cur) ?? []) {
          if (prev.has(from) || used.has(from)) continue;
          prev.set(from, [cur, e]);
          const tn = type(from);
          if (tn === 'synthetic' || name(from).startsWith('Window') || name(from) === '(GC roots)') {
            root = from;
            break;
          }
          q.push(from);
        }
      }
      if (root < 0) {
        console.log(`  path ${p + 1}: none left`);
        break;
      }
      const steps = [];
      for (let at = root; at !== t; ) {
        const [next, e] = prev.get(at);
        steps.push(`${name(at).slice(0, 40)} ${edgeName(e)}`);
        if (next !== t && type(next) !== 'synthetic') used.add(next);
        at = next;
      }
      console.log(`  path ${p + 1}: ${steps.join(' → ')} → ${args.match}`);
    }
  }
}
