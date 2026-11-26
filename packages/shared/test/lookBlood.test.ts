import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLOOD_KINDS, CORE_LOOKS, NPC_LOOKS, RETIRED_LOOKS, isBloodKind, lookBlood } from '../src/index.ts';
// @ts-expect-error: a plain .mjs tool without types
import { BLOOD, manifestProblems } from '../../../tools/content/character-manifests.mjs';

describe('blood by character', () => {
  it('the manifest checker knows the same kinds, in the same order', () => {
    expect(BLOOD).toEqual([...BLOOD_KINDS]);
  });

  it('every whole-body character names a kind; part-built presets follow the map', () => {
    for (const l of CORE_LOOKS.filter((x) => x.whole)) expect(isBloodKind(lookBlood(l.id)), l.id).toBe(true);
    for (const l of CORE_LOOKS.filter((x) => !x.whole)) expect(lookBlood(l.id), l.id).toBeNull();
  });

  it('a manifest without blood is refused', () => {
    const m = JSON.parse(readFileSync(new URL('../../../content/characters/meshy_alien.json', import.meta.url), 'utf8'));
    expect(manifestProblems(m)).toEqual([]);
    delete m.blood;
    expect(manifestProblems(m).some((p: string) => p.includes('blood:'))).toBe(true);
    expect(manifestProblems({ ...m, blood: 'purple' }).some((p: string) => p.includes('blood:'))).toBe(true);
  });

  it('by group, then by hand', () => {
    // Machines bleed oil; people red.
    for (const l of CORE_LOOKS.filter((x) => x.whole && x.group === 'machines')) expect(lookBlood(l.id), l.id).toBe('oil');
    for (const l of CORE_LOOKS.filter((x) => x.whole && (x.group === 'soldiers' || x.group === 'folk'))) expect(lookBlood(l.id), l.id).toBe('red');
    // Every alien is green or blue (the space people are red).
    for (const l of CORE_LOOKS.filter((x) => x.whole && x.nameTheme === 'alien')) expect(['green', 'blue'], l.id).toContain(lookBlood(l.id));
    expect(lookBlood('core.astronaut')).toBe('red');
    expect(lookBlood('core.rattles')).toBe('bone');
    expect(lookBlood('core.bonejack')).toBe('bone');
    expect(lookBlood('core.hollowpilgrim')).toBe('spirit');
    expect(lookBlood('core.crewdemolitions')).toBe('oil');
    expect(lookBlood('core.groaner')).toBe('red');
    // The owner's answers (2026-11-18).
    for (const id of ['core.alienbiker', 'core.potatomarshal', 'core.spacemarine']) expect(lookBlood(id), id).toBe('blue');
    expect(lookBlood('core.bronzer')).toBe('stone');
    // Retired looks bleed as the look they play (Rotter, removed, plays Dredge Marrow).
    expect(lookBlood('core.rotter')).toBe(lookBlood('core.abyssalhunter'));
    expect(lookBlood('core.visitor')).toBe('green');
  });

  it('NPC skins: the creatures by role, the soldier mannequins follow the map; retired and unknown looks resolve', () => {
    expect(lookBlood('npc:cyclops')).toBe('blue');
    expect(lookBlood('npc:scolitex')).toBe('green');
    expect(lookBlood('npc:trooper')).toBeNull();
    for (const l of NPC_LOOKS) expect(lookBlood(l.id) === null || isBloodKind(lookBlood(l.id)), l.id).toBe(true);
    const retired = Object.entries(RETIRED_LOOKS).find(([, to]) => lookBlood(to) !== null);
    if (retired) expect(lookBlood(retired[0])).toBe(lookBlood(retired[1]));
    expect(lookBlood('custom:whatever')).toBeNull();
    expect(lookBlood(undefined)).toBeNull();
  });
});
