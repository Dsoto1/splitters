// A small reader for Godot 4 text scenes and resources (.tscn, .tres): enough to take effect packs
// apart (tools/content/prepare-vfx.mjs). Sections become { kind, attrs, props }; values become plain
// data: numbers, strings, booleans, arrays, dictionaries, and constructors as { '@Name': [args] }
// (Color, Vector2, Transform3D…) or { ExtResource: id } / { SubResource: id }.
import { readFileSync } from 'node:fs';

/** Split `s` on top-level commas (not inside brackets or quotes). */
function splitTop(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  let quoted = false;
  for (const ch of s) {
    if (ch === '"') quoted = !quoted;
    if (!quoted) {
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) depth--;
      else if (ch === ',' && depth === 0) {
        out.push(cur.trim());
        cur = '';
        continue;
      }
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function value(text) {
  const v = text.trim();
  if (v === 'true' || v === 'false') return v === 'true';
  if (v.startsWith('&"')) return v.slice(2, -1);
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1);
  if (/^-?\d+$/.test(v)) return Number(v);
  if (/^-?[\d.]+(e-?\d+)?$/.test(v)) return Number(v);
  const call = /^(\w+)\(([\s\S]*)\)$/.exec(v);
  if (call) {
    const [, name, inner] = call;
    if (name === 'ExtResource' || name === 'SubResource') return { [name]: value(inner) };
    return { [`@${name}`]: inner.trim() ? splitTop(inner).map(value) : [] };
  }
  if (v.startsWith('[')) return splitTop(v.slice(1, -1)).map(value);
  if (v.startsWith('{')) {
    const d = {};
    for (const item of splitTop(v.slice(1, -1))) {
      const i = item.indexOf(':');
      d[value(item.slice(0, i))] = value(item.slice(i + 1));
    }
    return d;
  }
  return v;
}

const count = (s, c) => s.split(c).length - 1;

/** The sections of a .tscn or .tres file. */
export function parseGodot(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const sections = [];
  let cur = null;
  for (let i = 0; i < lines.length; ) {
    const line = lines[i++];
    if (line.startsWith('[')) {
      const m = /^\[(\w+)(.*)\]$/.exec(line);
      const attrs = {};
      for (const a of m[2].matchAll(/(\w+)=("[^"]*"|\S+?)(?=\s|$)/g)) attrs[a[1]] = value(a[2]);
      cur = { kind: m[1], attrs, props: {} };
      sections.push(cur);
      continue;
    }
    const eq = line.indexOf(' = ');
    if (eq > 0 && cur && !line.startsWith(' ')) {
      let v = line.slice(eq + 3);
      while ((count(v, '{') > count(v, '}') || count(v, '[') > count(v, ']')) && i < lines.length) v += `\n${lines[i++]}`;
      cur.props[line.slice(0, eq).trim()] = value(v);
    }
  }
  return sections;
}

/** External and sub resources of a parsed file, by id. */
export function resources(sections) {
  return {
    ext: Object.fromEntries(sections.filter((s) => s.kind === 'ext_resource').map((s) => [s.attrs.id, s.attrs.path])),
    sub: Object.fromEntries(sections.filter((s) => s.kind === 'sub_resource').map((s) => [s.attrs.id, s])),
  };
}

/** A Godot Curve's points: [x, y, left tangent, right tangent]. */
export function curvePoints(curve) {
  const d = curve.props._data ?? [];
  const out = [];
  for (let i = 0; i + 2 < d.length; i += 5) {
    const [x, y] = d[i]['@Vector2'];
    out.push([x, y, d[i + 1], d[i + 2]].map((n) => Math.round(n * 10000) / 10000));
  }
  return out;
}

export const rgb = (c) => (c && c['@Color'] ? c['@Color'].slice(0, 3).map((n) => Math.round(n * 10000) / 10000) : null);
export const vec = (v) => (v && (v['@Vector2'] || v['@Vector3']) ? (v['@Vector2'] || v['@Vector3']).map((n) => Math.round(n * 10000) / 10000) : null);
