import { describe, expect, it } from 'vitest';
import { CHARACTER_GROUP_ALIASES, CHARACTER_NEIGHBOURS, CHARACTER_BRANCHES, CHARACTER_COLLECTIONS, CHARACTER_GROUPS, CORE_LOOKS, EXPERIMENTAL_SECTION, characterSectionOf, characterTier, getLook, NPC_LOOKS, PICKABLE_LOOKS, PLAYER_NPC_LOOKS, RETIRED_LOOKS, validLookId, characterSections, lookVariants, pickableLooks, CHARACTER_GROUP_LABELS, encodeLook, isCharacterGroup, lookBranch, lookForBot, lookGroup } from '../src/index.ts';
// @ts-expect-error: a plain .mjs tool without types
import { BRANCHES, COLLECTIONS, GROUPS, readManifests } from '../../../tools/content/character-manifests.mjs';

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
    expect(branch('agency')).toEqual(expect.arrayContaining(['core.stealthop', 'core.resolvesoldier']));
    expect(branch('army')).toEqual(expect.arrayContaining(['core.paratrooper', 'core.usgrunt', 'core.vietnamsoldier', 'core.repguard']));
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
    expect(at('horror')).toEqual(expect.arrayContaining(['core.undeadsoldier', 'core.bonejack', 'core.anubis', 'core.gargoyle']));
    expect(at('animals')).toEqual(expect.arrayContaining(['core.bandit', 'core.koala', 'core.shiba']));
    // Owner, 2026-11-27: Legends keeps seven; the famous real people and the period characters are Historical's.
    expect(at('legends').sort()).toEqual(['core.abyssalhunter', 'core.basaltguardian', 'core.celestialknight', 'core.frostvalkyrie', 'core.magmajuggernaut', 'core.mystic', 'core.sunpriest']);
    // Owner, 2026-11-28: the pirates are Historical's too (their own row retired; `pirates` reads as `historical`).
    expect(at('historical')).toEqual(expect.arrayContaining(['core.piratecaptain', 'core.firstmate', 'core.femalepirate']));
    expect(CHARACTER_GROUP_ALIASES.pirates).toBe('historical');
    expect(at('historical')).toEqual(expect.arrayContaining(['core.abe', 'core.franklin', 'core.washington', 'core.roosevelt', 'core.shaka', 'core.khan', 'core.vikingm', 'core.caesar', 'core.templar', 'core.aztecjaguar', 'core.dustycolt']));
    expect(at('folk')).toEqual(expect.arrayContaining(['core.afropi', 'core.radishman', 'core.hazmat', 'core.bronzer', 'core.ansel', 'core.elder', 'core.grandpachains']));
    expect(at('space')).toEqual(expect.arrayContaining(['core.vanguard', 'core.knight']));
    // The mummies and Egyptian undead stay in Horror.
    expect(at('horror')).toEqual(expect.arrayContaining(['core.anubis', 'core.pharaoh', 'core.ankhmummy']));
    // Creatures merged into Horrors & Creatures, Agents & Spies into Soldiers & Spies (2026-11-17).
    expect(at('horror')).toEqual(expect.arrayContaining(['core.snikkit', 'core.gorgle', 'core.grizzelda']));
    expect(at('machines')).toEqual(expect.arrayContaining(['core.emeraldrobot', 'core.t350', 'core.botboy']));
    expect(at('space')).toEqual(expect.arrayContaining(['core.visitor', 'core.astronaut', 'core.spacemarine']));
    expect(at('soldiers')).toEqual(expect.arrayContaining(['core.stealthop', 'core.repguard']));
  });

  it("the owner's moves of 2026-11-17", () => {
    const group = (name: string) => CORE_LOOKS.find((l) => l.name === name)?.group;
    expect(group('Scary Larry')).toBe('horror');
    // Teddy moved again on 2026-11-26, to the Toys row (owner).
    expect(group('Teddy')).toBe('toys');
  });

  it('Character Select keeps the astronauts in Outer Space; Astronaut Explorer (2026-11-24) and Star Voyager (2026-11-26) are retired', () => {
    const roster = CORE_LOOKS.map((l) => ({ name: l.name, group: l.group ?? 'mine', sortAs: l.sortAs }));
    const space = characterSections(roster).find((s) => s.id === 'space')!.looks.map((l) => l.name);
    const at = (n: string) => space.indexOf(n);
    expect(at('Astronaut Explorer')).toBe(-1);
    expect(at('Star Voyager')).toBe(-1);
    expect(at('Spacewalker')).toBeGreaterThan(-1);
    expect(at('Starfarer')).toBeGreaterThan(-1);
  });

  it('Character Select lists the owner\'s neighbours side by side, in one list (CHARACTER_NEIGHBOURS)', () => {
    const roster = CORE_LOOKS.map((l) => ({ id: l.id, name: l.name, group: l.group ?? 'mine', sortAs: l.sortAs }));
    const sections = characterSections(roster);
    for (const list of CHARACTER_NEIGHBOURS) {
      const section = sections.find((s) => s.looks.some((l) => l.id === list[0]))!;
      const ids = section.looks.map((l) => l.id);
      const at = ids.indexOf(list[0]!);
      expect(ids.slice(at, at + list.length), list.join(' ')).toEqual([...list]);
    }
  });

  it("the owner's categories, in order (Roster Board, 2026-11-14/15; merged 2026-11-17)", () => {
    expect(CHARACTER_GROUPS.map((g) => `${g.id}:${g.label}`)).toEqual([
      'soldiers:Soldiers & Spies', 'folk:Everyday Folk', 'space:Outer Space', 'legends:Legends', 'historical:Historical',
      'animals:Animalia', 'toys:Toys', 'holiday:Holiday', 'machines:Machines', 'horror:Horrors & Creatures',
    ]);
    // Uncle Bao and the Rusty Mech are off the roster; a saved choice plays the nearest kept look.
    for (const id of ['core.unclebao', 'core.rustymech']) expect(CORE_LOOKS.some((l) => l.id === id), id).toBe(false);
    expect(RETIRED_LOOKS['core.unclebao']).toBe('core.elder');
    expect(RETIRED_LOOKS['core.rustymech']).toBe('core.crewdemolitions');
  });

  it('the Gas Mask Engineer is gone (owner, 2026-11-21): a saved choice or bot set plays Grunt \'68', () => {
    expect(CORE_LOOKS.some((l) => l.id === 'core.gasmaskengineer')).toBe(false);
    expect(RETIRED_LOOKS['core.gasmaskengineer']).toBe('core.vietnamsoldier');
    expect(validLookId('core.gasmaskengineer')).toBe('core.vietnamsoldier');
    expect(PICKABLE_LOOKS.some((l) => l.id === 'core.gasmaskengineer')).toBe(false);
  });

  it('the Chrono Crew (owner, 2026-11-22; 13 since 2026-11-25: the K9 in, Blix Orrin to Outer Space, the 14th place kept for the Inquisitor): a section of its own after Outer Space, whatever their tier; they stay in Outer Space for the rest', () => {
    // Owner, 2026-11-25: Clio Everwhen joins and leads it with Sarge Tobias Crane; Fuse Hollister leaves for Machines;
    // two new members (the alien recruit and the pilot).
    const crew = ['Clio Everwhen', 'Sarge Tobias Crane', 'Vesper Quill', 'Nova Kade', 'Dex Calloway', 'Gears Okafor', 'Doc Seraphine Vale', 'Flicker', 'Wren Halloway', 'Mags Petrov', 'Lyra Vantis', 'Juno Hartwell', 'Rocco Tickwell'];
    expect(crew).toHaveLength(13);
    expect(characterSectionOf(getLook('core.crewalien'))).toBe('space');
    const inCrew = CORE_LOOKS.filter((l) => l.collection === 'chrono');
    expect(inCrew.map((l) => l.name).sort()).toEqual([...crew].sort());
    for (const l of inCrew) expect(l.group, l.id).toBe('space');
    const roster = CORE_LOOKS.map((l) => ({ id: l.id, name: l.name, group: characterSectionOf(l) ?? 'mine', ...(l.sortAs ? { sortAs: l.sortAs } : {}) }));
    const sections = characterSections(roster);
    const ids = sections.map((s) => s.id);
    expect(ids.indexOf('chrono')).toBe(ids.indexOf('space') + 1);
    const chrono = sections.find((s) => s.id === 'chrono')!;
    expect(chrono.label).toBe('Chrono Crew');
    expect(chrono.looks.map((l) => l.name).sort()).toEqual([...crew].sort());
    // Clio and Sarge are #1 and #2: the first two tiles of the section's first row.
    expect(chrono.looks.slice(0, 2).map((l) => l.name)).toEqual(['Clio Everwhen', 'Sarge Tobias Crane']);
    expect(characterSectionOf(getLook('core.timetraveler'))).toBe('chrono');
    expect(getLook('core.timetraveler').group).toBe('space');
    // Fuse Hollister is a Machine now, out of the crew; Ignatius Slagg is in Legends.
    expect(characterSectionOf(getLook('core.crewdemolitions'))).toBe('machines');
    expect(getLook('core.magmajuggernaut').group).toBe('legends');
  });

  it('the chimp is one character with eleven variant looks (owner, 2026-11-26; Chester Knuckleby the eleventh that evening): the base first, the rest off automatic picks', () => {
    const v = lookVariants(CORE_LOOKS, 'core.chimp');
    expect(v).toHaveLength(11);
    expect(v[0]!.id).toBe('core.chimp');
    expect(new Set(v.map((l) => l.variant)).size).toBe(11);
    // From any of its looks, the same list; a look with none has none.
    expect(lookVariants(CORE_LOOKS, 'core.chimp_roman').map((l) => l.id)).toEqual(v.map((l) => l.id));
    expect(lookVariants(CORE_LOOKS, 'core.dale')).toEqual([]);
    for (const l of v.slice(1)) {
      expect(l.variantOf, l.id).toBe('core.chimp');
      expect(PICKABLE_LOOKS.some((p) => p.id === l.id), l.id).toBe(false);
      expect(validLookId(l.id), l.id).toBe(l.id);
    }
    expect(PICKABLE_LOOKS.some((p) => p.id === 'core.chimp')).toBe(true);
    expect(pickableLooks([{ id: 'a' }, { id: 'b', variantOf: 'a' }]).map((l) => l.id)).toEqual(['a']);
  });

  it('the Toys row (owner, 2026-11-26): the toy soldiers and the batch\'s toys, after Animalia', () => {
    const ids = characterSections(CORE_LOOKS.filter((l) => !l.variantOf).map((l) => ({ id: l.id, name: l.name, group: characterSectionOf(l) ?? 'mine' }))).map((s) => s.id);
    expect(ids.indexOf('toys')).toBe(ids.indexOf('animals') + 1);
    expect(CHARACTER_GROUP_LABELS.toys).toBe('Toys');
    const toys = CORE_LOOKS.filter((l) => l.group === 'toys');
    expect(toys.map((l) => l.id).sort()).toEqual(['core.brickman', 'core.cymbalmonkey', 'core.greenarmy', 'core.jackinthebox', 'core.ragdoll', 'core.teddy', 'core.toysoldier', 'core.windupbot']);
    for (const t of toys) expect(t.branch, t.id).toBeUndefined();
  });

  it('like histories sit side by side, the Historical row by period oldest first (owner, 2026-11-26 and 11-27)', () => {
    const sections = characterSections(CORE_LOOKS.filter((l) => !l.variantOf).map((l) => ({ id: l.id, name: l.name, group: characterSectionOf(l) ?? 'mine', ...(l.sortAs ? { sortAs: l.sortAs } : {}) })));
    for (const list of CHARACTER_NEIGHBOURS) {
      const sec = sections.find((s) => s.looks.some((l) => l.id === list[0]))!;
      for (const id of list) expect(getLook(id).id, id).toBe(id);
      for (const id of list) expect(sec.looks.some((l) => l.id === id), `${id} in ${sec.id}`).toBe(true);
      const at = sec.looks.findIndex((l) => l.id === list[0]);
      expect(sec.looks.slice(at, at + list.length).map((l) => l.id)).toEqual([...list]);
    }
    const historical = sections.find((s) => s.id === 'historical')!.looks.map((l) => l.id);
    const famous = ['core.caesar', 'core.khan', 'core.washington', 'core.franklin', 'core.abe', 'core.roosevelt', 'core.einstein'];
    expect(historical.slice(historical.indexOf(famous[0]!), historical.indexOf(famous[0]!) + famous.length)).toEqual(famous);
    // The age of sail: the pirates together after Mesoamerica, right before the famous real people (owner, 2026-11-28).
    expect(historical.slice(historical.indexOf('core.eagleclan') + 1, historical.indexOf('core.caesar'))).toEqual(['core.piratecaptain', 'core.firstmate', 'core.femalepirate']);
    // The famous real people by their real names, Julius Caesar and Genghis Khan with them (owner, 2026-11-28).
    expect(famous.map((id) => getLook(id).name)).toEqual(['Julius Caesar', 'Genghis Khan', 'George Washington', 'Benjamin Franklin', 'Abraham Lincoln', 'Theodore Roosevelt', 'Albert Einstein']);
    expect(getLook('core.shaka').name).toBe('Shaka Mpande');
    // Rome first, the Wild West last; every Historical character in the row's own list (none left to sort by name).
    expect(historical[0]).toBe('core.gladiatrix');
    expect(historical.at(-1)).toBe('core.thornweaver');
    expect(sections.findIndex((s) => s.id === 'historical')).toBe(sections.findIndex((s) => s.id === 'legends') + 1);
  });

  it("retired looks that aren't the owner's own models are gone entirely, and every removed one plays one of the owner's own (owner, 2026-11-25)", () => {
    const manifests = readManifests() as { look?: string; source: { license: string } }[];
    const byLook = new Map(manifests.filter((m) => m.look).map((m) => [m.look!, m]));
    for (const [old] of Object.entries(RETIRED_LOOKS)) {
      // A retired look still on disk is the owner's own model (a MapMaker Figure); the modular presets have no files.
      const m = byLook.get(old);
      if (m) expect(m.source.license, old).toBe('owned');
    }
    const removed = ['core.astroexplorer', 'core.neonninja', 'core.neonguardian', 'core.brasshare', 'core.bigbab', 'core.tortoise', 'core.giggles', 'core.rustwalker', 'core.slugger', 'core.vampire', 'core.dusttrooper', 'core.rotter', 'core.shade', 'core.tposesoldier1', 'core.tposesoldier2', 'core.panda', 'core.nova', 'core.unclebao', 'core.bill', 'core.hector', 'core.bogdan', 'core.otter', 'core.hollowvisitor', 'core.crimsonop', 'core.goblin', 'core.rustymech', 'core.saintnick', 'core.umpire'];
    for (const old of removed) {
      expect(byLook.has(old), old).toBe(false);
      const now = RETIRED_LOOKS[old]!;
      expect(byLook.get(now)?.source.license, `${old} plays ${now}`).toBe('owned');
      expect(CORE_LOOKS.some((l) => l.id === now), `${old} plays ${now}`).toBe(true);
      expect(validLookId(old)).toBe(now);
    }
  });

  it('eleven characters were removed (owner, 2026-11-25; Rourke back on 2026-11-26 with the owner\'s new model): a saved choice or bot set plays a near kept look', () => {
    expect(CORE_LOOKS.find((l) => l.id === 'core.rourke')?.name).toBe('Rourke');
    expect(validLookId('core.rourke')).toBe('core.rourke');
    const gone = ['core.bill', 'core.hector', 'core.bogdan', 'core.otter', 'core.hollowvisitor', 'core.crimsonop', 'core.goblin', 'core.rustymech', 'core.saintnick', 'core.umpire'];
    for (const id of gone) {
      expect(CORE_LOOKS.some((l) => l.id === id), id).toBe(false);
      expect(PICKABLE_LOOKS.some((l) => l.id === id), id).toBe(false);
      const now = validLookId(id);
      expect(now, id).not.toBe(id);
      expect(CORE_LOOKS.some((l) => l.id === now), `${id} plays ${now}`).toBe(true);
      expect(getLook(id).id, id).toBe(now);
    }
    expect(validLookId('core.saintnick')).toBe('core.elder');
    expect(validLookId('core.bogdan')).toBe('core.magmajuggernaut');
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

  it('Zero Ringtail is gone (owner, 2026-11-22): its model is Rascal McGraw\'s (Bandit\'s id)', () => {
    expect(CORE_LOOKS.some((l) => l.id === 'core.raccoonhacker')).toBe(false);
    expect(RETIRED_LOOKS['core.raccoonhacker']).toBe('core.bandit');
    expect(validLookId('core.raccoonhacker')).toBe('core.bandit');
    expect(getLook('core.bandit').name).toBe('Rascal McGraw');
    expect(characterTier(getLook('core.bandit'))).toBe('core');
  });

  it('nothing is Experimental now, and nine animals open Animalia in the owner\'s order (owner, 2026-11-24)', () => {
    expect(CORE_LOOKS.filter((l) => characterTier(l) === 'experimental').map((l) => l.id)).toEqual([]);
    const roster = CORE_LOOKS.map((l) => ({ id: l.id, name: l.name, group: characterSectionOf(l) ?? 'mine', ...(l.sortAs ? { sortAs: l.sortAs } : {}) }));
    const sections = characterSections(roster);
    expect(sections.map((s) => s.id)).not.toContain(EXPERIMENTAL_SECTION);
    expect(sections.find((s) => s.id === 'animals')!.looks.slice(0, 9).map((l) => l.name)).toEqual(['Pip Quickfoot', 'Rocket Nutley', 'Rowdy Gnashwell', 'Rufus Boomtown', 'Ollie Hootman', 'Barnaby Burrows', 'Rascal McGraw', 'Chester Knuckleby', 'Newt Calloway']);
    // Display names only: the ids are unchanged.
    expect(getLook('core.baboon').name).toBe('Rufus Boomtown');
    expect(getLook('core.warlord').name).toBe('Newt Calloway');
  });
});
