import { describe, expect, it } from 'vitest';
import { CORE_WEAPONS, getWeapon, gunplayOf } from '@tiletrigger/shared';
import { STAT_FIELDS, statProblems } from '../../../tools/content/weapon-edits-format.mjs';
import { hideBlockers as repoBlockers } from '../../../tools/content/weapons.mjs';
import { applicableStats, changeSet, currentSound, currentStat, editedDef, hideBlockers, infoOf, loadEdits, saveEdits, setsOf, soundGroups, STORAGE_KEY, tidy } from '../src/tools/weaponManagerData.ts';
import { damageAt, recoilPath } from '../src/tools/weaponTuningData.ts';

/** The Weapon Manager's state (tools/weaponManagerData.ts; docs/FEATURES.md, "Weapon Manager"). */
describe('weapon manager data', () => {
  const smg = getWeapon('core.smg');

  it('every weapon\'s current stats are in range, so the page never starts out of bounds', () => {
    const bad: string[] = [];
    for (const def of Object.values(CORE_WEAPONS)) {
      for (const f of applicableStats(infoOf(def))) {
        const v = currentStat(def, f.path);
        if (v === undefined) bad.push(`${def.id} ${f.path}: none`);
        else bad.push(...statProblems(f.path, v, infoOf(def)).map((p) => `${def.id}: ${p}`));
      }
    }
    expect(bad).toEqual([]);
    expect(STAT_FIELDS.length).toBeGreaterThan(20);
  });

  it('an edited copy changes what the comparisons draw; the game\'s weapon is untouched', () => {
    const e = { stats: { damage: 30, 'kick.pitch': (currentStat(smg, 'kick.pitch') as number[]).map((x) => x * 2), 'falloff.start': 40 } };
    const d = editedDef(smg, e);
    expect(d).not.toBe(smg);
    expect(d.damage).toBe(30);
    expect(smg.damage).toBe(15);
    expect(gunplayOf(d).falloff!.start).toBe(40);
    expect(gunplayOf(d).falloff!.curve).toBe(gunplayOf(smg).falloff!.curve);
    expect(damageAt(d, 1, 'arcade')).toBeGreaterThan(damageAt(smg, 1, 'arcade'));
    expect(recoilPath(d, 0, 10)[9]!.pitch).toBeGreaterThan(recoilPath(smg, 0, 10)[9]!.pitch * 1.5);
    expect(editedDef(smg, undefined)).toBe(smg);
    expect(editedDef(smg, { name: 'Buzzsaw', hidden: true, sounds: { fire: 'fire.rifle', reload: 'reload.end' } })).toMatchObject({ displayName: 'Buzzsaw', hidden: true, view: { sound: 'fire.rifle', reloadSound: 'reload.end' } });
  });

  it('tidy drops what equals the game, so "edited" means different', () => {
    expect(tidy(smg, { name: smg.displayName, stats: { damage: 15 }, sounds: { fire: currentSound(smg, 'fire')! }, hidden: false, note: '  ' })).toBeUndefined();
    expect(tidy(smg, { name: 'Buzzsaw', stats: { damage: 15, range: 90 } })).toEqual({ name: 'Buzzsaw', stats: { range: 90 } });
    const military = setsOf(smg, undefined).find((m) => m.id === 'military')!;
    expect(tidy(smg, { sets: { military: military.member } })).toBeUndefined();
  });

  it('sets: lists are editable, a spawn gun is locked, Standard and Mixed bag aren\'t lists', () => {
    const m = setsOf(getWeapon('core.marksman'), undefined);
    expect(m.find((s) => s.id === 'military')).toMatchObject({ member: true, editable: false, locked: expect.any(String) });
    expect(m.find((s) => s.id === 'standard')!.editable).toBe(false);
    expect(m.find((s) => s.id === 'mixed')!.editable).toBe(false);
    expect(setsOf(smg, { sets: { scifi: true } }).find((s) => s.id === 'scifi')!.member).toBe(true);
  });

  it('who can be hidden: the same rules as the repo tool', () => {
    for (const id of Object.keys(CORE_WEAPONS)) expect(hideBlockers(id).length > 0, id).toBe(repoBlockers(id).length > 0);
    expect(hideBlockers('core.smg')).toEqual([]);
    expect(hideBlockers('core.pistol').length).toBeGreaterThan(0);
  });

  it('the change set: versioned, with what the page saw, checked like the repo checks it', () => {
    const { set, problems } = changeSet({ 'core.smg': { name: 'Buzzsaw', hidden: true, stats: { damage: 19 }, note: 'louder' } }, 'now');
    expect(problems).toEqual([]);
    expect(set).toMatchObject({ format: 'tiletrigger.weapon-edits', version: 1, created: 'now' });
    expect(set.weapons['core.smg']).toMatchObject({ name: 'Buzzsaw', hidden: true, stats: { damage: 19 }, note: 'louder', was: { name: 'Submachine Gun', hidden: false, stats: { damage: 15 } } });
    expect(changeSet({ 'core.pistol': { hidden: true } }).problems.join()).toMatch(/can't be hidden/);
    expect(changeSet({ 'core.smg': { stats: { damage: 5000 } } }).problems.join()).toMatch(/outside/);
  });

  it('the sound picker offers the whole library, weapon fire first', () => {
    const g = soundGroups();
    expect(g[0]!.label).toBe('Weapon fire');
    expect(g[0]!.ids).toContain('fire.rifle');
    expect(g.flatMap((x) => x.ids)).toContain('reload.start');
  });

  it('edits are kept in storage, and broken or blocked storage is survived', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    saveEdits({ 'core.smg': { name: 'Buzzsaw' } }, store);
    expect(loadEdits(store)).toEqual({ 'core.smg': { name: 'Buzzsaw' } });
    mem.set(STORAGE_KEY, JSON.stringify({ 'core.nope': { name: 'x' }, 'core.smg': { name: 'Y' } }));
    expect(loadEdits(store)).toEqual({ 'core.smg': { name: 'Y' } });
    mem.set(STORAGE_KEY, '{not json');
    expect(loadEdits(store)).toEqual({});
    saveEdits({}, store);
    expect(mem.has(STORAGE_KEY)).toBe(false);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(loadEdits(broken)).toEqual({});
    expect(() => saveEdits({ 'core.smg': { name: 'Z' } }, broken)).not.toThrow();
  });
});
