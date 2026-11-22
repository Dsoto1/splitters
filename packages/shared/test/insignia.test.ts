import { describe, expect, it } from 'vitest';
import { CORE_LOOKS, INSIGNIA_IDS, INSIGNIA_SHAPES, SOLDIER_RANKS, nameRank, rankGroup, soldierInsignia } from '../src/index.ts';
import { NAME_THEMES, botNameFor } from '../src/match.ts';
import { WHOLE_BODY_LOOKS } from '../src/content/characters.generated.ts';

const army = CORE_LOOKS.find((l) => l.branch === 'army' && !l.id.startsWith('npc:'))!.id;
const agency = CORE_LOOKS.find((l) => l.branch === 'agency')!.id;
const civilian = CORE_LOOKS.find((l) => l.group && l.group !== 'soldiers')!.id;

describe('rank insignia (soldiers only)', () => {
  it('reads the rank a soldier name starts with', () => {
    expect(nameRank('Sgt. Dunmore')).toBe('Sgt.');
    expect(nameRank('SSgt. Okafor')).toBe('SSgt.');
    expect(nameRank('Sergeant Gravy')).toBeNull();
    expect(nameRank('Capt.Pell')).toBeNull();
    expect(nameRank(undefined)).toBeNull();
    expect(nameRank('Flt. Lt. Ember')).toBe('Capt.');
  });

  it('gives an Army soldier their rank, Agency the Agency mark, everyone else none', () => {
    expect(soldierInsignia(army, 'Sgt. Dunmore')).toBe('sgt');
    expect(soldierInsignia(army, 'Col. Stroud')).toBe('col');
    expect(soldierInsignia(army, 'Dunmore')).toBeNull();
    expect(soldierInsignia(agency, 'Sgt. Dunmore')).toBe('agency1');
    expect(soldierInsignia(agency, 'Anyone')).toBe('agency1');
    expect(soldierInsignia(civilian, 'Sgt. Dunmore')).toBeNull();
    expect(soldierInsignia('npc:gunner', 'Pvt. Haskett')).toBe('pvt');
    expect(soldierInsignia('npc:trooper', 'Pvt. Haskett')).toBe('agency1');
    expect(soldierInsignia(undefined, 'Sgt. Dunmore')).toBeNull();
  });

  it('has a badge for every rank the soldier names give', () => {
    const ranks = new Set(NAME_THEMES.find((t) => t.id === 'soldier')!.names.map(nameRank));
    expect(ranks.has(null)).toBe(false);
    for (const r of SOLDIER_RANKS) expect(ranks.has(r)).toBe(true);
  });

  it('draws every badge inside its box, each polygon star-shaped about its centroid', () => {
    for (const id of INSIGNIA_IDS) {
      const polys = INSIGNIA_SHAPES[id];
      expect(polys.length).toBeGreaterThan(0);
      for (const p of polys) {
        expect(p.length).toBeGreaterThanOrEqual(3);
        for (const [x, y] of p) {
          expect(Math.abs(x)).toBeLessThanOrEqual(1.0005);
          expect(Math.abs(y)).toBeLessThanOrEqual(1.0005);
        }
        // Fanned from the centroid, every triangle turns the same way (no fold-over).
        const cx = p.reduce((s, q) => s + q[0], 0) / p.length;
        const cy = p.reduce((s, q) => s + q[1], 0) / p.length;
        const signs = p.map((a, i) => {
          const b = p[(i + 1) % p.length]!;
          return Math.sign((a[0] - cx) * (b[1] - cy) - (a[1] - cy) * (b[0] - cx));
        });
        expect(new Set(signs.filter((v) => v !== 0)).size).toBe(1);
      }
    }
  });
});

describe('Army bots go by rank', () => {
  it('names an Army bot by rank and surname, Agency and everyone else by their own name first', () => {
    const none = () => false;
    expect(nameRank(botNameFor('core.tacticalsoldier', none))).not.toBeNull();
    expect(botNameFor('core.ember', none)).toBe('Flt. Lt. Ember');
    expect(botNameFor('core.stealthop', none)).toBe('Stealth Operative');
    expect(botNameFor('core.scamp', none)).toBe('Scamp');
  });
});

describe('Soldiers & Spies branches (owner, 2026-11-17)', () => {
  it('makes the Operatives Agency; Santa, Agency until 2026-11-22, is in Legends now (owner) and wears its mark', () => {
    const santa = CORE_LOOKS.find((l) => l.name === 'Santa')!;
    expect(santa.group).toBe('legends');
    expect(santa.branch).toBeUndefined();
    expect(rankGroup(santa.id)).toBe('legends');
    // Crimson Operative (held back for now, playing as Stealth Operative) is Agency too; the retired Operative preset's
    // own entry (looks.ts) says so, though it plays as Grunt '68.
    expect(WHOLE_BODY_LOOKS.find((l) => l.id === 'core.crimsonop')!.branch).toBe('agency');
  });
});
