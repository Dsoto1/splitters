import { describe, expect, it } from 'vitest';
import { CHARACTER_GROUPS, CORE_LOOKS, NPC_LOOKS, PLAYER_NPC_LOOKS, RETIRED_LOOKS, encodeLook, isCharacterGroup, lookForBot, lookGroup } from '../src/index.ts';
// @ts-expect-error: a plain .mjs tool without types
import { GROUPS } from '../../../tools/content/character-manifests.mjs';

describe("Character Select's groups", () => {
  it('every selectable look has exactly one valid group', () => {
    const selectable = [...CORE_LOOKS.map((l) => l.id), ...PLAYER_NPC_LOOKS.map((l) => l.id)];
    expect(new Set(selectable).size).toBe(selectable.length);
    const missing = selectable.filter((id) => !isCharacterGroup(lookGroup(id)));
    expect(missing).toEqual([]);
    // A preset's group is on the look itself (one field, one value).
    for (const l of CORE_LOOKS) expect(isCharacterGroup(l.group), l.id).toBe(true);
  });

  it('the manifest checker knows the same groups, in the same order', () => {
    expect(GROUPS).toEqual(CHARACTER_GROUPS.map((g) => g.id));
  });

  it('every group has someone in it, and the labels are unique', () => {
    const used = new Set([...CORE_LOOKS, ...PLAYER_NPC_LOOKS].map((l) => lookGroup(l.id)));
    for (const g of CHARACTER_GROUPS) expect(used.has(g.id), g.id).toBe(true);
    expect(new Set(CHARACTER_GROUPS.map((g) => g.label)).size).toBe(CHARACTER_GROUPS.length);
  });

  it('a retired preset sorts as its replacement; NPC skins not offered still sort; a design of yours has none', () => {
    for (const [old, now] of Object.entries(RETIRED_LOOKS)) expect(lookGroup(old)).toBe(lookGroup(now));
    for (const l of NPC_LOOKS) expect(isCharacterGroup(lookGroup(l.id)), l.id).toBe(true);
    expect(lookGroup('npc:trooper')).toBe('soldiers');
    expect(lookGroup('npc:imp')).toBe('creatures');
    const mine = encodeLook({ body: 'male', parts: ['ranger_torso_m', 'ranger_legs_m', 'ranger_feet_m'], hair: [], colorways: [], skin: null, hairColor: null });
    expect(lookGroup(mine)).toBeNull();
    expect(lookGroup(undefined)).toBeNull();
  });

  it("bots still get built-in looks", () => {
    for (let i = 0; i < CORE_LOOKS.length; i++) expect(isCharacterGroup(lookGroup(lookForBot(i)))).toBe(true);
  });

  it('sorts what each character is', () => {
    const at = (g: string) => CORE_LOOKS.filter((l) => l.group === g).map((l) => l.id);
    expect(at('horror')).toEqual(expect.arrayContaining(['core.shambler', 'core.rattles', 'core.bonejack', 'core.punkin']));
    expect(at('animals')).toEqual(expect.arrayContaining(['core.otter', 'core.biscuit', 'core.shiba', 'core.teddy']));
    expect(at('legends')).toEqual(expect.arrayContaining(['core.knight', 'core.aldric', 'core.merrow']));
    expect(at('creatures')).toEqual(expect.arrayContaining(['core.visitor', 'core.emeraldrobot', 'core.t350']));
  });
});
