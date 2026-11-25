// Apply the owner's Weapon Manager change set (docs/FEATURES.md, "Weapon Manager"; the format:
// tools/content/weapon-edits-format.mjs) to the weapon content data:
//
//   node tools/content/apply-weapon-edits.mjs <change-set.json>            check it, write it, rebuild the weapon tables
//   node tools/content/apply-weapon-edits.mjs <change-set.json> --check    check it only; nothing is written
//   node tools/content/apply-weapon-edits.mjs <change-set.json> --no-build write the data, skip the generators
//
// The file may be the page's download or what its Copy put on the clipboard (a ```json fence around it is fine).
// Checks the whole set first (known weapon and sound ids, stats in range, the version; tools/content/weapons.mjs's
// rules for hiding) and writes nothing if anything is wrong. Then it writes:
//   content/weapons/<name>.json   name, hidden, category, description (notes.description), sounds, stats
//   content/throwables.json       a throwable's explosion sound
//   content/weapon-sets.json      the sets' lists
//   docs/QUEUE.md                 each note as a line under "Weapon notes from the owner"
// keeping every untouched line of those files as it was, runs the weapon, pickup, weapon-set and Roulette generators
// (the tables the game reads), and prints a summary. `pnpm content:rebuild` then checks everything before the branch
// goes to a check run, like any other change; a session lands it.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keepFormat } from './json-keep-format.mjs';
import { CHANGE_SET_FORMAT, NO_SOUND, SOUND_KEYS, blowsUp, getPath, statField, validateChangeSet, weaponInfo } from './weapon-edits-format.mjs';
import { ROOT, hideBlockers } from './weapons.mjs';

const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const NOTES_HEADING = '## Weapon notes from the owner';

/** A change set from a file's text: plain JSON, or JSON inside a ``` fence (pasted from chat). */
export function parseChangeSet(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('no JSON object in the file');
  return JSON.parse(body.slice(start, end + 1));
}

/** Everything the check and the writer read from the repo. */
export function loadRepo(root = ROOT) {
  const families = readJson(root, 'content/weapons/families.json');
  const weapons = new Map();
  for (const f of readdirSync(join(root, 'content/weapons')).filter((x) => x.endsWith('.json') && x !== 'families.json').sort()) {
    const rel = `content/weapons/${f}`;
    const text = readFileSync(join(root, rel), 'utf8');
    const file = JSON.parse(text);
    weapons.set(file.id, { rel, text, file });
  }
  const setsText = readFileSync(join(root, 'content/weapon-sets.json'), 'utf8');
  const throwablesText = readFileSync(join(root, 'content/throwables.json'), 'utf8');
  const pickups = readJson(root, 'content/pickups.json').pickups;
  const weaponsTs = readFileSync(join(root, 'packages/shared/src/sim/weapons.ts'), 'utf8');
  const categories = [...(weaponsTs.match(/export const WEAPON_CATEGORIES\s*=\s*\[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
  return {
    root,
    families,
    weapons,
    setsText,
    sets: JSON.parse(setsText),
    throwablesText,
    throwables: JSON.parse(throwablesText),
    sounds: new Set(Object.keys(readJson(root, 'content/sounds.json').sounds)),
    pickupWeapons: new Set(pickups.filter((p) => p.effect?.kind === 'weapon').map((p) => p.effect.weapon)),
    categories,
  };
}

/** A weapon file over the families' defaults (the top-level values the generator fills in). */
const resolved = (repo, file) => ({ ...repo.families.defaults, ...file });

/** A stat's value in the game now: the weapon's own, else its family's (falloff, accuracy, kick, ballistic, handling). */
function currentStat(repo, file, path) {
  const own = getPath(file, path);
  if (own !== undefined) return own;
  const def = resolved(repo, file);
  if (getPath(def, path) !== undefined) return getPath(def, path);
  const fam = file.family ? repo.families.families[file.family] : null;
  if (!fam) return undefined;
  if (path === 'headshot') return fam.head;
  return getPath(fam, path);
}

/** The check's view of the repo (validateChangeSet's ctx). */
export function context(repo) {
  const weapons = new Map();
  for (const [id, { file }] of repo.weapons) {
    const fam = file.family ? repo.families.families[file.family] : null;
    weapons.set(id, { name: file.displayName, info: weaponInfo(resolved(repo, file), fam), current: (path) => currentStat(repo, file, path) });
  }
  return {
    weapons,
    sounds: repo.sounds,
    sets: repo.sets.sets,
    categories: repo.categories,
    blockers: (id) => hideBlockers(id, repo.root),
    throwables: new Map(repo.throwables.throwables.map((t) => [t.kind, { name: t.displayName, blowsUp: blowsUp(t.projectile) }])),
    canJoinSet: (id) => {
      const f = repo.weapons.get(id)?.file;
      if (!f?.category) return 'it has no category (tools, mode-only weapons and mounted guns are never in a set)';
      if (!(f.slot >= 1)) return 'a mounted gun (slot 0) is never in a set';
      if (!repo.pickupWeapons.has(id)) return `it has no pickup (core.weapon_${id.replace(/^core\./, '')} in content/pickups.json), so a set's pickups couldn't hold it`;
      return null;
    },
  };
}

/** Put `key` into an object before `before` (or at the end), keeping the other keys' order. */
function withKey(o, key, value, before) {
  if (key in o) return { ...o, [key]: value };
  const out = {};
  let put = false;
  for (const [k, v] of Object.entries(o)) {
    if (!put && before.includes(k)) {
      out[key] = value;
      put = true;
    }
    out[k] = v;
  }
  if (!put) out[key] = value;
  return out;
}

/** One weapon file with an edit applied (a new object; the file's key order kept, new keys where they belong). */
export function applyToWeapon(repo, file, e) {
  let f = structuredClone(file);
  const lines = [];
  if (e.name !== undefined && e.name.trim() !== f.displayName) {
    lines.push(`name "${f.displayName}" → "${e.name.trim()}"`);
    f.displayName = e.name.trim();
  }
  if (e.hidden === true && !f.hidden) {
    f = withKey(f, 'hidden', true, ['kind']);
    lines.push('hidden');
  } else if (e.hidden === false && f.hidden) {
    delete f.hidden;
    lines.push('shown again');
  }
  if (e.category !== undefined && e.category !== f.category) {
    lines.push(`category ${f.category} → ${e.category}`);
    f.category = e.category;
  }
  if (e.description !== undefined) {
    const d = e.description.trim();
    const was = f.notes?.description;
    if (d && d !== was) {
      f = withKey(f, 'notes', { ...(f.notes ?? {}), description: d }, []);
      lines.push('description');
    } else if (!d && was !== undefined) {
      delete f.notes.description;
      if (!Object.keys(f.notes).length) delete f.notes;
      lines.push('description removed');
    }
  }
  for (const [slot, sid] of Object.entries(e.sounds ?? {})) {
    const name = f.id.replace(/^core\./, '');
    if (slot === 'fire') {
      const was = f.view.sound ?? `fire.${name}`;
      if (sid !== was) {
        f.view = sid === `fire.${name}` ? (({ sound: _s, ...v }) => v)(f.view) : withKey(f.view, 'sound', sid, ['beam', 'muzzle', 'muzzleAt', 'altShot', 'optic']);
        lines.push(`fire sound ${was} → ${sid}`);
      }
    } else if (slot === 'alt') {
      if (sid !== f.view.altShot.sound) {
        lines.push(`alt-fire sound ${f.view.altShot.sound} → ${sid}`);
        f.view.altShot = { ...f.view.altShot, sound: sid };
      }
    } else if (slot in SOUND_KEYS) {
      // Explosion and impact: none until picked ("none" takes the weapon's own away again).
      const key = SOUND_KEYS[slot];
      const was = f.view[key];
      const to = sid === NO_SOUND ? undefined : sid;
      if (to !== was) {
        f.view = to === undefined ? (({ [key]: _s, ...v }) => v)(f.view) : withKey(f.view, key, to, ['beam', 'muzzle', 'muzzleAt', 'altShot', 'optic']);
        lines.push(`${slot} sound ${was ?? 'none'} → ${to ?? 'none'}`);
      }
    } else if (slot === 'reload') {
      const was = f.view.reloadSound ?? 'reload.start';
      if (sid !== was) {
        f.view = sid === 'reload.start' ? (({ reloadSound: _s, ...v }) => v)(f.view) : withKey(f.view, 'reloadSound', sid, ['beam', 'muzzle', 'muzzleAt', 'altShot', 'optic']);
        lines.push(`reload sound ${was} → ${sid}`);
      }
    }
  }
  for (const [path, v] of Object.entries(e.stats ?? {})) {
    const before = currentStat(repo, file, path);
    if (JSON.stringify(before) === JSON.stringify(v)) continue;
    const [head, leaf] = path.split('.');
    if (!leaf) {
      if (head in f) f[head] = v;
      else f = withKey(f, head, v, ['view', 'notes']);
    } else {
      // Falloff is all or nothing in a weapon file: start from the family's when the weapon leaves it out.
      const fam = file.family ? repo.families.families[file.family] : null;
      const base = f[head] ?? (head === 'falloff' ? { ...fam?.falloff } : {});
      const obj = { ...base, [leaf]: v };
      if (head in f) f[head] = obj;
      else f = withKey(f, head, obj, ['view', 'notes']);
      // The plain reload time follows the empty reload (readers that know no stages see it).
      if (path === 'reload.empty' && file.reloadTicks === file.reload?.empty) f.reloadTicks = v;
    }
    const field = statField(path);
    const show = (x) => (Array.isArray(x) ? `[${x.map((y) => +(y * (field.scale ?? 1)).toFixed(3)).join(', ')}]` : `${+(x * (field.scale ?? 1)).toFixed(3)}`);
    lines.push(`${field.label} ${before === undefined ? '–' : show(before)} → ${show(v)} ${field.unit}`.trim());
  }
  return { file: f, lines };
}

/** throwables.json with the change set's throwable edits (a new object), and what changed. */
export function applyToThrowables(doc, cs) {
  const out = structuredClone(doc);
  const lines = [];
  for (const [kind, e] of Object.entries(cs.throwables ?? {})) {
    const i = out.throwables.findIndex((t) => t.kind === kind);
    for (const [slot, sid] of Object.entries(e.sounds ?? {})) {
      const key = SOUND_KEYS[slot];
      const t = out.throwables[i];
      const was = t[key];
      const to = sid === NO_SOUND ? undefined : sid;
      if (to === was) continue;
      out.throwables[i] = to === undefined ? (({ [key]: _s, ...rest }) => rest)(t) : withKey(t, key, to, ['view', 'notes']);
      lines.push(`${kind}: ${slot} sound ${was ?? 'none'} → ${to ?? 'none'}`);
    }
  }
  return { doc: out, lines };
}

/** weapon-sets.json with the change set's set edits (a new object), and what changed. */
export function applyToSets(sets, cs) {
  const out = structuredClone(sets);
  const lines = [];
  for (const [id, e] of Object.entries(cs.weapons)) {
    for (const [sid, inSet] of Object.entries(e.sets ?? {})) {
      const set = out.sets.find((s) => s.id === sid);
      const has = set.weapons.includes(id);
      if (inSet && !has) {
        set.weapons.push(id);
        lines.push(`${id} joins ${sid}`);
      } else if (!inSet && has) {
        set.weapons = set.weapons.filter((w) => w !== id);
        lines.push(`${id} leaves ${sid}`);
      }
    }
  }
  return { sets: out, lines };
}

/** docs/QUEUE.md with the notes added under "Weapon notes from the owner" (before "Waiting on the owner"); a note already there isn't added again. */
export function addNotesToQueue(queue, cs, names, day) {
  const notes = [...Object.entries(cs.weapons), ...Object.entries(cs.throwables ?? {}).map(([k, e]) => [`throw:${k}`, e])].filter(([, e]) => typeof e.note === 'string' && e.note.trim());
  if (!notes.length) return { queue, added: [] };
  const added = [];
  const lines = notes
    .map(([id, e]) => {
      const text = e.note.trim().replace(/\s+/g, ' ').replace(/"/g, '”');
      return `- S · B · Weapon note, **${names.get(id) ?? id}** (\`${id}\`; owner, ${day}, Weapon Manager): "${text}"`;
    })
    .filter((l) => {
      const key = l.slice(l.indexOf('):') + 2);
      const dup = queue.includes(key) && queue.includes(l.slice(0, l.indexOf(';')));
      if (!dup) added.push(l);
      return !dup;
    });
  if (!lines.length) return { queue, added };
  let q = queue;
  if (!q.includes(`${NOTES_HEADING}\n`)) {
    const at = q.indexOf('\n## Waiting on the owner');
    const block = `\n${NOTES_HEADING}\n(From the owner's Weapon Manager, \`?mode=weapons\` → Manage → Send changes; \`tools/content/apply-weapon-edits.mjs\` adds them. Take one like any Feature: claim it in HANDOFF first.)\n`;
    q = at >= 0 ? `${q.slice(0, at)}${block}${q.slice(at)}` : `${q.trimEnd()}\n${block}`;
  }
  const h = q.indexOf(`${NOTES_HEADING}\n`);
  const next = q.indexOf('\n## ', h + NOTES_HEADING.length);
  const end = next < 0 ? q.length : next;
  const section = q.slice(h, end).trimEnd();
  q = `${q.slice(0, h)}${section}\n${lines.join('\n')}\n${q.slice(end)}`;
  return { queue: q, added };
}

/**
 * Check and apply a change set to the repo at `root`. Returns { problems, warnings, written, summary }; with
 * problems nothing is written. `write: false` checks only.
 */
export function applyChangeSet(cs, { root = ROOT, write = true, day = new Date().toISOString().slice(0, 10) } = {}) {
  const repo = loadRepo(root);
  const { problems, warnings } = validateChangeSet(cs, context(repo));
  if (problems.length) return { problems, warnings, written: [], summary: [] };
  const summary = [];
  const files = [];
  const names = new Map([...repo.weapons].map(([id, w]) => [id, w.file.displayName]));
  for (const [id, e] of Object.entries(cs.weapons)) {
    const w = repo.weapons.get(id);
    const { file, lines } = applyToWeapon(repo, w.file, e);
    names.set(id, file.displayName);
    if (lines.length) {
      files.push([w.rel, keepFormat(file, w.text)]);
      summary.push(`${id} (${file.displayName}): ${lines.join('; ')}`);
    }
  }
  const { sets, lines: setLines } = applyToSets(repo.sets, cs);
  if (setLines.length) {
    files.push(['content/weapon-sets.json', keepFormat(sets, repo.setsText)]);
    summary.push(`weapon sets: ${setLines.join('; ')}`);
  }
  const { doc: thrown, lines: throwLines } = applyToThrowables(repo.throwables, cs);
  if (throwLines.length) {
    files.push(['content/throwables.json', keepFormat(thrown, repo.throwablesText)]);
    summary.push(`throwables: ${throwLines.join('; ')}`);
  }
  for (const [kind, t] of repo.throwables.throwables.map((x) => [x.kind, x])) names.set(`throw:${kind}`, t.displayName);
  const queuePath = 'docs/QUEUE.md';
  if (existsSync(join(root, queuePath))) {
    const { queue, added } = addNotesToQueue(readFileSync(join(root, queuePath), 'utf8'), cs, names, day);
    if (added.length) {
      files.push([queuePath, queue]);
      summary.push(`notes: ${added.length} added to ${queuePath} ("${NOTES_HEADING.slice(3)}")`);
    }
  }
  if (write) for (const [rel, text] of files) writeFileSync(join(root, rel), text);
  return { problems, warnings, written: files.map(([rel]) => rel), summary };
}

function main() {
  const args = process.argv.slice(2);
  const path = args.find((a) => !a.startsWith('--'));
  if (!path) {
    console.error('usage: node tools/content/apply-weapon-edits.mjs <change-set.json> [--check] [--no-build]');
    process.exit(2);
  }
  let cs;
  try {
    cs = parseChangeSet(readFileSync(resolve(path), 'utf8'));
  } catch (e) {
    console.error(`apply-weapon-edits: ${path} is not a change set (${e.message}); expected the Weapon Manager's JSON ("format": "${CHANGE_SET_FORMAT}")`);
    process.exit(1);
  }
  const check = args.includes('--check');
  const r = applyChangeSet(cs, { write: !check });
  for (const w of r.warnings) console.warn(`warning: ${w}`);
  if (r.problems.length) {
    console.error(`apply-weapon-edits: ${r.problems.length} problem(s); nothing written\n  ${r.problems.join('\n  ')}`);
    process.exit(1);
  }
  const n = Object.keys(cs.weapons).length;
  console.log(`apply-weapon-edits: ${n} weapon${n === 1 ? '' : 's'} in the change set (${cs.created ?? 'undated'})${check ? '; checked, nothing written' : ''}`);
  for (const l of r.summary) console.log(`  ${l}`);
  if (!r.summary.length) console.log('  nothing to change: the repo already matches');
  if (check || !r.written.length) return;
  console.log(`wrote ${r.written.join(', ')}`);
  if (args.includes('--no-build')) {
    console.log('next: pnpm content:rebuild (the weapon tables), the resolved-weapons fixture (UPDATE_WEAPON_FIXTURE=1 pnpm vitest run packages/shared/test/weaponsData.test.ts), then check and land it like any change');
    return;
  }
  for (const gen of ['weapons', 'pickups', 'weapon-sets', 'roulette']) execFileSync(process.execPath, [join(ROOT, 'tools/content', `${gen}.mjs`)], { cwd: ROOT, stdio: 'inherit' });
  console.log('next: pnpm content:rebuild (checks everything); a stat or name change also moves the resolved-weapons fixture:');
  console.log('  UPDATE_WEAPON_FIXTURE=1 pnpm vitest run packages/shared/test/weaponsData.test.ts (read its diff: only these weapons move)');
  console.log('then `pnpm prepush` and a check run, like any change; a session lands it');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

