import { describe, expect, it } from 'vitest';
import { CHARACTER_BRANCHES, CHARACTER_GROUPS, CORE_LOOKS, NPC_LOOKS, PLAYER_NPC_LOOKS, RETIRED_LOOKS, characterSections, encodeLook, isCharacterGroup, lookBranch, lookForBot, lookGroup } from '../src/index.ts';
// @ts-expect-error: a plain .mjs tool without types
import { BRANCHES, GROUPS } from '../../../tools/content/character-manifests.mjs';

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
    expect(BRANCHES).toEqual(Object.fromEntries(CHARACTER_BRANCHES.map((b) => [b.id, b.group])));
  });

  it('every look in Soldiers & Spies is Army or Agency, and no other look has a branch', () => {
    for (const id of [...CORE_LOOKS, ...NPC_LOOKS].map((l) => l.id)) {
      const g = lookGroup(id);
      const b = lookBranch(id);
      if (g === 'soldiers') expect(['army', 'agency'], id).toContain(b);
      else expect(b, id).toBeNull();
    }
    const branch = (b: string) => CORE_LOOKS.filter((l) => l.branch === b).map((l) => l.id);
    // Agents & Spies became Agency (2026-11-17); the soldiers Army.
    expect(branch('agency')).toEqual(expect.arrayContaining(['core.stealthop', 'core.zhao', 'core.resolvesoldier', 'core.saintnick']));
    expect(branch('army')).toEqual(expect.arrayContaining(['core.grunt68', 'core.wwiisoldier', 'core.warriorsentinel', 'core.tacticalsoldier']));
    expect(lookBranch('npc:trooper')).toBe('agency');
    expect(lookBranch('npc:gunner')).toBe('army');
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
    expect(lookGroup('npc:gunner')).toBe('soldiers');
    expect(lookGroup('npc:imp')).toBe('horror');
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
    expect(at('animals')).toEqual(expect.arrayContaining(['core.bandit', 'core.biscuit', 'core.shiba']));
    expect(at('legends')).toEqual(expect.arrayContaining(['core.knight', 'core.abe', 'core.anubis']));
    expect(at('folk')).toEqual(expect.arrayContaining(['core.aldric', 'core.merrow', 'core.hazmat']));
    // Creatures merged into Horrors & Creatures, Agents & Spies into Soldiers & Spies (2026-11-17).
    expect(at('horror')).toEqual(expect.arrayContaining(['core.snikkit', 'core.trex', 'core.grizzelda']));
    expect(at('machines')).toEqual(expect.arrayContaining(['core.emeraldrobot', 'core.t350', 'core.botboy']));
    expect(at('space')).toEqual(expect.arrayContaining(['core.visitor', 'core.astronaut', 'core.spacemarine']));
    expect(at('soldiers')).toEqual(expect.arrayContaining(['core.stealthop', 'core.zhao']));
  });

  it("the owner's moves of 2026-11-17", () => {
    const group = (name: string) => CORE_LOOKS.find((l) => l.name === name)?.group;
    expect(group('Steel Guardian')).toBe('machines');
    expect(group('Shadow Enforcer')).toBe('space');
    for (const n of ['Teddy', 'The Hollow Pilgrim', 'Scary Larry']) expect(group(n), n).toBe('horror');
  });

  it('Character Select lists the astronauts together (Spud Marshal and Astronaut Explorer swapped)', () => {
    const roster = CORE_LOOKS.map((l) => ({ name: l.name, group: l.group ?? 'mine', sortAs: l.sortAs }));
    const space = characterSections(roster).find((s) => s.id === 'space')!.looks.map((l) => l.name);
    const at = (n: string) => space.indexOf(n);
    expect(at('Astronaut Explorer')).toBe(at('Spacewalker') + 1);
    expect(at('Spud Marshal')).toBeLessThan(at('Beanie Alien'));
  });

  it("the owner's categories, in order (Roster Board, 2026-11-14/15; merged 2026-11-17)", () => {
    expect(CHARACTER_GROUPS.map((g) => `${g.id}:${g.label}`)).toEqual([
      'soldiers:Soldiers & Spies', 'folk:Everyday Folk', 'space:Outer Space', 'legends:Legends',
      'animals:Animalia', 'machines:Machines', 'horror:Horrors & Creatures',
    ]);
    // Uncle Bao and the Rusty Mech are off the roster; a saved choice plays the nearest kept look.
    for (const id of ['core.unclebao', 'core.rustymech']) expect(CORE_LOOKS.some((l) => l.id === id), id).toBe(false);
    expect(RETIRED_LOOKS['core.unclebao']).toBe('core.oldtimer');
    expect(RETIRED_LOOKS['core.rustymech']).toBe('core.t350');
  });
});
