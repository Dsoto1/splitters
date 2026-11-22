import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addNotesToQueue, applyChangeSet, context, loadRepo, parseChangeSet } from '../apply-weapon-edits.mjs';
import { keepFormat } from '../json-keep-format.mjs';
import { CHANGE_SET_FORMAT, CHANGE_SET_VERSION, STAT_FIELDS, buildChangeSet, statProblems, validateChangeSet } from '../weapon-edits-format.mjs';
import { ROOT, build, load } from '../weapons.mjs';

/** The Weapon Manager's change set (docs/FEATURES.md, "Weapon Manager") and the repo tool that applies it. */

const FILES = ['content/weapons', 'content/weapon-sets.json', 'content/pickups.json', 'content/sounds.json', 'content/throwables.json', 'content/classes.json', 'content/abilities.json', 'content/codes.lock.json', 'packages/shared/src/sim/weapons.ts', 'packages/shared/src/sim/rules.ts', 'packages/client/src/content/models.ts', 'docs/QUEUE.md'];

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'weapon-edits-'));
  for (const f of FILES) {
    mkdirSync(dirname(join(root, f)), { recursive: true });
    cpSync(join(ROOT, f), join(root, f), { recursive: true });
  }
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const cs = (weapons) => ({ format: CHANGE_SET_FORMAT, version: CHANGE_SET_VERSION, created: '2026-11-22T10:00:00Z', from: 'test', weapons });
const weapon = (name) => JSON.parse(readFileSync(join(root, `content/weapons/${name}.json`), 'utf8'));
const sets = () => JSON.parse(readFileSync(join(root, 'content/weapon-sets.json'), 'utf8')).sets;
/** The weapon generator's problems in the copy (the models aren't copied: their checks are left out). */
const generatorProblems = () => build(load(root), root).problems.filter((p) => !/model .* not found/.test(p));
const problemsOf = (weapons) => validateChangeSet(cs(weapons), context(loadRepo(root))).problems;

describe('weapon change sets: the format', () => {
  it('a change set from the page is versioned and leaves out empty edits', () => {
    const set = buildChangeSet({ 'core.smg': { name: 'Buzzsaw', stats: {} }, 'core.rifle': {}, 'core.sniper': { note: '  ' } }, { created: 'now' });
    expect(set).toEqual({ format: CHANGE_SET_FORMAT, version: 1, created: 'now', from: 'Weapon Manager', weapons: { 'core.smg': { name: 'Buzzsaw' } } });
  });

  it('refuses a wrong format, an unknown or newer version and unknown fields', () => {
    const ctx = context(loadRepo(root));
    expect(validateChangeSet({ ...cs({}), format: 'x' }, ctx).problems.join()).toMatch(/format/);
    expect(validateChangeSet({ ...cs({}), version: 2 }, ctx).problems.join()).toMatch(/newer than this tool reads/);
    expect(validateChangeSet({ ...cs({}), version: 0 }, ctx).problems.join()).toMatch(/"version" must be 1/);
    expect(validateChangeSet('nope', ctx).problems).toHaveLength(1);
    expect(problemsOf({ 'core.smg': { colour: 'red' } }).join()).toMatch(/unknown field "colour"/);
    expect(validateChangeSet(cs({}), ctx).problems).toEqual([]);
  });

  it('knows the weapons and the sounds', () => {
    expect(problemsOf({ 'core.nope': { name: 'X' } }).join()).toMatch(/core.nope: no weapon has this id/);
    expect(problemsOf({ 'core.smg': { sounds: { fire: 'fire.kazoo' } } }).join()).toMatch(/not a sound in the game/);
    expect(problemsOf({ 'core.smg': { sounds: { horn: 'fire.rifle' } } }).join()).toMatch(/the slots are/);
    expect(problemsOf({ 'core.smg': { sounds: { alt: 'fire.rifle' } } }).join()).toMatch(/no second-trigger shot/);
    expect(problemsOf({ 'core.smg': { sounds: { fire: 'fire.rifle', reload: 'reload.end' } } })).toEqual([]);
  });

  it('names: some text, not too long, never another weapon\'s', () => {
    expect(problemsOf({ 'core.smg': { name: '  ' } }).join()).toMatch(/name must be some text/);
    expect(problemsOf({ 'core.smg': { name: 'x'.repeat(41) } }).join()).toMatch(/longer than 40/);
    expect(problemsOf({ 'core.smg': { name: 'assault  rifle' } }).join()).toMatch(/also core.rifle's/);
    // Two weapons swapping names is fine; two given the same is not.
    const rifle = weapon('rifle').displayName;
    const smg = weapon('smg').displayName;
    expect(problemsOf({ 'core.smg': { name: rifle }, 'core.rifle': { name: smg } })).toEqual([]);
    expect(problemsOf({ 'core.smg': { name: 'Same' }, 'core.rifle': { name: 'same' } }).join()).toMatch(/also/);
  });

  it('stats: known paths, for weapons that have them, within their ranges', () => {
    for (const f of STAT_FIELDS) {
      expect(statProblems(f.path, f.list ? [f.min, f.max] : f.min)).toEqual([]);
      expect(statProblems(f.path, f.list ? [f.max + 1] : f.max + 1).join()).toMatch(/outside/);
    }
    expect(statProblems('magazine', 30.5).join()).toMatch(/whole number/);
    expect(statProblems('damage', 'lots').join()).toMatch(/must be a number/);
    expect(statProblems('view.model', 1).join()).toMatch(/not a stat/);
    expect(problemsOf({ 'core.smg': { stats: { 'handling.move': 1.5 } } }).join()).toMatch(/outside 0.85-1.1/);
    expect(problemsOf({ 'core.smg': { stats: { 'projectile.speed': 50 } } }).join()).toMatch(/doesn't apply/);
    expect(problemsOf({ 'core.smg': { stats: { 'falloff.end': 5 } } }).join()).toMatch(/falloff ends \(5 m\) before it starts/);
    expect(problemsOf({ 'core.smg': { stats: { damage: 18, 'falloff.start': 10, 'kick.pitch': [0.01, 0.02] } } })).toEqual([]);
  });

  it('hiding: refused for the base kit (starting weapons, a set\'s spawn and sniper gun, the rifle)', () => {
    expect(problemsOf({ 'core.pistol': { hidden: true } }).join()).toMatch(/starting weapon/);
    expect(problemsOf({ 'core.marksman': { hidden: true } }).join()).toMatch(/military's sniper gun/);
    expect(problemsOf({ 'core.plasma': { hidden: true } }).join()).toMatch(/scifi spawns with it/);
    expect(problemsOf({ 'core.smg': { hidden: true } })).toEqual([]);
  });

  it('sets: only lists can be edited, a spawn or sniper gun stays, only pickup weapons join', () => {
    expect(problemsOf({ 'core.smg': { sets: { mixed: false } } }).join()).toMatch(/no list to edit/);
    expect(problemsOf({ 'core.smg': { sets: { nope: true } } }).join()).toMatch(/no weapon set has this id/);
    expect(problemsOf({ 'core.marksman': { sets: { military: false } } }).join()).toMatch(/can't leave/);
    expect(problemsOf({ 'core.knife': { sets: { scifi: true } } }).join()).toMatch(/no pickup/);
    expect(problemsOf({ 'core.smg': { sets: { scifi: true, military: false } } })).toEqual([]);
  });
});

describe('apply-weapon-edits', () => {
  it('parses the download and a pasted copy (with a ```json fence)', () => {
    const text = JSON.stringify(cs({ 'core.smg': { name: 'Buzzsaw' } }));
    expect(parseChangeSet(text).weapons['core.smg'].name).toBe('Buzzsaw');
    expect(parseChangeSet(`Here it is:\n\`\`\`json\n${text}\n\`\`\`\nthanks`).weapons['core.smg'].name).toBe('Buzzsaw');
    expect(() => parseChangeSet('no json here')).toThrow();
  });

  it('writes nothing when anything is wrong', () => {
    const before = readFileSync(join(root, 'content/weapons/smg.json'), 'utf8');
    const r = applyChangeSet(cs({ 'core.smg': { name: 'Buzzsaw' }, 'core.pistol': { hidden: true } }), { root });
    expect(r.problems.length).toBeGreaterThan(0);
    expect(r.written).toEqual([]);
    expect(readFileSync(join(root, 'content/weapons/smg.json'), 'utf8')).toBe(before);
  });

  it('writes name, hide, category, description, sounds and stats into the weapon file, keeping its layout', () => {
    const before = readFileSync(join(root, 'content/weapons/smg.json'), 'utf8');
    const r = applyChangeSet(
      cs({ 'core.smg': { name: ' Buzzsaw ', hidden: true, category: 'rifle', description: 'Close-range spray.', sounds: { fire: 'fire.rifle', reload: 'reload.end' }, stats: { damage: 18, 'falloff.start': 20, 'reload.empty': 80, 'kick.pitch': [0.01, 0.012] }, was: { name: 'Submachine Gun' } } }),
      { root, day: '2026-11-22' },
    );
    expect(r.problems).toEqual([]);
    expect(r.written).toEqual(['content/weapons/smg.json']);
    const w = weapon('smg');
    expect(w).toMatchObject({ displayName: 'Buzzsaw', hidden: true, category: 'rifle', damage: 18, reloadTicks: 80, kick: { pitch: [0.01, 0.012] } });
    expect(w.reload.empty).toBe(80);
    // Falloff is whole in a file: the family's, with the start changed.
    expect(w.falloff).toMatchObject({ start: 20, curve: expect.any(String) });
    expect(Object.keys(w.falloff)).toEqual(['start', 'end', 'min', 'curve']);
    expect(w.view).toMatchObject({ sound: 'fire.rifle', reloadSound: 'reload.end' });
    expect(w.notes.description).toBe('Close-range spray.');
    // New keys where they belong (hidden after the category, stats before the view); untouched lines byte for byte.
    const keys = Object.keys(w);
    expect(keys.indexOf('hidden')).toBe(keys.indexOf('category') + 1);
    expect(keys.indexOf('kick')).toBeLessThan(keys.indexOf('view'));
    const after = readFileSync(join(root, 'content/weapons/smg.json'), 'utf8');
    for (const line of before.split('\n').filter((l) => /"(id|code|ammo|botRange|model|hold|muzzleAt)"/.test(l))) expect(after).toContain(line);
    expect(r.summary.join()).toMatch(/Buzzsaw.*Damage 15 → 18/);
    // The result passes the weapon generator.
    expect(generatorProblems()).toEqual([]);
  });

  it('round trip: back to the game\'s values gives the original file', () => {
    const before = readFileSync(join(root, 'content/weapons/shotgun.json'), 'utf8');
    const was = JSON.parse(before);
    applyChangeSet(cs({ 'core.shotgun': { name: 'Boomstick', stats: { damage: was.damage + 2 } } }), { root });
    expect(readFileSync(join(root, 'content/weapons/shotgun.json'), 'utf8')).not.toBe(before);
    applyChangeSet(cs({ 'core.shotgun': { name: was.displayName, stats: { damage: was.damage } } }), { root });
    expect(readFileSync(join(root, 'content/weapons/shotgun.json'), 'utf8')).toBe(before);
    // Hide, then unhide: the file as it was.
    applyChangeSet(cs({ 'core.shotgun': { hidden: true } }), { root });
    expect(weapon('shotgun').hidden).toBe(true);
    applyChangeSet(cs({ 'core.shotgun': { hidden: false } }), { root });
    expect(readFileSync(join(root, 'content/weapons/shotgun.json'), 'utf8')).toBe(before);
  });

  it('a fire sound back to the weapon\'s own leaves the field out', () => {
    applyChangeSet(cs({ 'core.shotgun': { sounds: { fire: 'fire.rifle' } } }), { root });
    expect(weapon('shotgun').view.sound).toBe('fire.rifle');
    applyChangeSet(cs({ 'core.shotgun': { sounds: { fire: 'fire.shotgun' } } }), { root });
    expect(weapon('shotgun').view.sound).toBeUndefined();
  });

  it('edits the weapon sets\' lists, keeping the file\'s layout', () => {
    const before = readFileSync(join(root, 'content/weapon-sets.json'), 'utf8');
    const r = applyChangeSet(cs({ 'core.smg': { sets: { military: false, scifi: true } } }), { root });
    expect(r.written).toEqual(['content/weapon-sets.json']);
    const s = sets();
    expect(s.find((x) => x.id === 'military').weapons).not.toContain('core.smg');
    expect(s.find((x) => x.id === 'scifi').weapons).toContain('core.smg');
    const after = readFileSync(join(root, 'content/weapon-sets.json'), 'utf8');
    expect(after.split('\n').length).toBe(before.split('\n').length);
    applyChangeSet(cs({ 'core.smg': { sets: { military: true, scifi: false } } }), { root });
    expect(sets().find((x) => x.id === 'scifi').weapons).not.toContain('core.smg');
  });

  it('notes go to QUEUE under "Weapon notes from the owner", once', () => {
    const r = applyChangeSet(cs({ 'core.smg': { name: 'Buzzsaw', note: 'make this\nlouder' }, 'core.sniper': { note: 'needs a "scope"' } }), { root, day: '2026-11-22' });
    expect(r.written).toContain('docs/QUEUE.md');
    const q = readFileSync(join(root, 'docs/QUEUE.md'), 'utf8');
    const at = q.indexOf('## Weapon notes from the owner\n');
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(q.indexOf('## Waiting on the owner'));
    expect(q).toContain('- S · B · Weapon note, **Buzzsaw** (`core.smg`; owner, 2026-11-22, Weapon Manager): "make this louder"');
    expect(q).toMatch(/\*\*[^*]+\*\* \(`core\.sniper`; owner, 2026-11-22, Weapon Manager\): "needs a .scope."/);
    // The same notes again add nothing; a new one goes under the same heading.
    const again = addNotesToQueue(q, cs({ 'core.smg': { note: 'make this louder' } }), new Map([['core.smg', 'Buzzsaw']]), '2026-11-22');
    expect(again.added).toEqual([]);
    const more = addNotesToQueue(q, cs({ 'core.rifle': { note: 'more kick' } }), new Map([['core.rifle', 'Assault Rifle']]), '2026-11-23');
    expect(more.queue.match(/## Weapon notes from the owner/g)).toHaveLength(1);
    expect(more.queue.indexOf('more kick')).toBeLessThan(more.queue.indexOf('## Waiting on the owner'));
  });

  it('--check (write: false) writes nothing', () => {
    const r = applyChangeSet(cs({ 'core.smg': { name: 'Buzzsaw', note: 'x' } }), { root, write: false });
    expect(r.problems).toEqual([]);
    expect(r.written.length).toBe(2);
    expect(weapon('smg').displayName).not.toBe('Buzzsaw');
  });

  it('the weapon generator refuses hiding the base kit, and a reload sound that isn\'t in the game', () => {
    const p = join(root, 'content/weapons/pistol.json');
    writeFileSync(p, JSON.stringify({ ...JSON.parse(readFileSync(p, 'utf8')), hidden: true }));
    const s = join(root, 'content/weapons/smg.json');
    const smg = JSON.parse(readFileSync(s, 'utf8'));
    writeFileSync(s, JSON.stringify({ ...smg, view: { ...smg.view, reloadSound: 'reload.kazoo' } }));
    const problems = generatorProblems().join('\n');
    expect(problems).toMatch(/pistol.json: can't be hidden: a mode's starting weapon/);
    expect(problems).toMatch(/smg.json: sound reload.kazoo is not in content\/sounds.json/);
  });
});

describe('keepFormat', () => {
  it('rewrites every weapon file and weapon-sets.json byte for byte when nothing changed', () => {
    for (const f of [...readdirNames(join(ROOT, 'content/weapons')).map((n) => `content/weapons/${n}`), 'content/weapon-sets.json']) {
      const t = readFileSync(join(ROOT, f), 'utf8');
      expect(keepFormat(JSON.parse(t), t), f).toBe(t);
    }
  });
});

function readdirNames(dir) {
  return readdirSync(dir).filter((n) => n.endsWith('.json'));
}
