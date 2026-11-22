import { describe, expect, it } from 'vitest';
import { CHARACTER_BRANCHES, CHARACTER_COLLECTIONS, CHARACTER_GROUPS, CORE_LOOKS, EXPERIMENTAL_SECTION, characterSectionOf, getLook, NPC_LOOKS, PICKABLE_LOOKS, PLAYER_NPC_LOOKS, RETIRED_LOOKS, validLookId, characterSections, encodeLook, isCharacterGroup, lookBranch, lookForBot, lookGroup } from '../src/index.ts';
// @ts-expect-error: a plain .mjs tool without types
import { BRANCHES, COLLECTIONS, GROUPS } from '../../../tools/content/character-manifests.mjs';

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
    expect(COLLECTIONS).toEqual(CHARACTER_COLLECTIONS.map((c) => c.id));
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
    expect(branch('agency')).toEqual(expect.arrayContaining(['core.stealthop', 'core.zhao', 'core.resolvesoldier']));
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

  it('the Gas Mask Engineer is gone (owner, 2026-11-21): a saved choice or bot set plays Grunt \'68', () => {
    expect(CORE_LOOKS.some((l) => l.id === 'core.gasmaskengineer')).toBe(false);
    expect(RETIRED_LOOKS['core.gasmaskengineer']).toBe('core.grunt68');
    expect(validLookId('core.gasmaskengineer')).toBe('core.grunt68');
    expect(PICKABLE_LOOKS.some((l) => l.id === 'core.gasmaskengineer')).toBe(false);
  });

  it('the Chrono Crew (owner, 2026-11-22): a section of its own after Outer Space, whatever their tier; they stay in Outer Space for the rest', () => {
    const crew = ['Vesper Quill', 'Nova Kade', 'Fuse Hollister', 'Dex Calloway', 'Gears Okafor', 'Doc Seraphine Vale', 'Flicker', 'Wren Halloway', 'Sarge Tobias Crane', 'Mags Petrov', 'Lyra Vantis'];
    const inCrew = CORE_LOOKS.filter((l) => l.collection === 'chrono');
    expect(inCrew.map((l) => l.name).sort()).toEqual([...crew].sort());
    for (const l of inCrew) expect(l.group, l.id).toBe('space');
    const roster = CORE_LOOKS.map((l) => ({ id: l.id, name: l.name, group: characterSectionOf(l) ?? 'mine' }));
    const sections = characterSections(roster);
    const ids = sections.map((s) => s.id);
    expect(ids.indexOf('chrono')).toBe(ids.indexOf('space') + 1);
    expect(sections.find((s) => s.id === 'chrono')!.label).toBe('Chrono Crew');
    expect(sections.find((s) => s.id === 'chrono')!.looks.map((l) => l.name).sort()).toEqual([...crew].sort());
    // The Time Traveler stays with Outer Space (experimental for now, so under Experimental).
    expect(characterSectionOf(getLook('core.timetraveler'))).toBe(EXPERIMENTAL_SECTION);
    expect(getLook('core.timetraveler').group).toBe('space');
  });

  it('Santa is in Legends (owner, 2026-11-22)', () => {
    expect(getLook('core.saintnick').group).toBe('legends');
    expect(lookBranch('core.saintnick')).toBeFalsy();
  });

  it('Tinker Goblina and the Sunset Gunslinger are gone (owner, 2026-11-22): their models are Goblina\'s and Dusty Ranger\'s', () => {
    for (const [gone, kept] of [['core.goblinatinker', 'core.grizzelda'], ['core.sunsetgunslinger', 'core.dustycolt']] as const) {
      expect(CORE_LOOKS.some((l) => l.id === gone), gone).toBe(false);
      expect(RETIRED_LOOKS[gone]).toBe(kept);
      expect(validLookId(gone)).toBe(kept);
    }
    expect(getLook('core.grizzelda').name).toBe('Goblina');
    expect(getLook('core.dustycolt').name).toBe('Dusty Ranger');
  });
});
