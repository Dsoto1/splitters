import { describe, expect, it } from 'vitest';
import { Fireteams, squadSnapshot } from '@tiletrigger/shared';
import { SQUAD_COLOR, SquadHud } from '../src/game/squadHud.ts';

/** The squad HUD's reading of the snapshot (no DOM here: the panel itself is the e2e flow `fireteams`'). */
describe('Fireteams squad HUD (Part 2)', () => {
  const ft = new Fireteams(4);
  const at = (slot: number) => ({ slot, team: 'a', human: slot === 0, lead: slot, pos: { x: slot, y: 0, z: 0 } });
  ft.sync([0, 1, 2, 3, 4, 5, 6, 7].map(at), 0);
  const mine = ft.squadOf(0)!;
  const other = ft.squads.find((s) => s !== mine)!;
  const fs = ft.squads.map((s) => squadSnapshot(s, 0));

  it('finds your squad in the snapshot, and only its members are your squadmates', () => {
    const hud = new SquadHud({} as HTMLElement);
    const v = hud.read(fs, 0)!;
    expect(v.leader).toBe(0);
    expect(v.members).toEqual(mine.members);
    for (const m of mine.members) expect(hud.isMate(m, 0)).toBe(m !== 0);
    for (const m of other.members) expect(hud.isMate(m, 0)).toBe(false);
    expect(hud.read(undefined, 0)).toBeNull();
    expect(hud.isMate(mine.members[1]!, 0)).toBe(false);
  });

  it('minimap markers: squadmates alive as ringed dots in the squad colour, and the order\'s place labelled', () => {
    const hud = new SquadHud({} as HTMLElement);
    hud.read(fs, 0);
    const pos = (slot: number) => ({ x: slot * 10, z: 5, alive: slot !== mine.members[1] });
    const blips = hud.blips(0, pos);
    expect(blips.every((b) => b.color === SQUAD_COLOR)).toBe(true);
    expect(blips.filter((b) => b.ring)).toHaveLength(mine.members.length - 2);
    expect(blips.some((b) => b.label !== undefined)).toBe(false);
    ft.order(mine, 'hold', { x: 40, y: 0, z: -12 }, null, 5);
    hud.read(ft.squads.map((s) => squadSnapshot(s, 0)), 0);
    expect(hud.blips(0, pos)).toContainEqual({ x: 40, z: -12, color: SQUAD_COLOR, label: 'H' });
  });

  it("the squad's role in the mode (CTF's Defend / Attack, follow-ups) rides along; none outside such a mode", () => {
    const hud = new SquadHud({} as HTMLElement);
    expect(hud.read(ft.squads.map((s) => squadSnapshot(s, 0, 0, 'defend')), 0)).toMatchObject({ role: 'defend', members: mine.members });
    expect(hud.read(ft.squads.map((s) => squadSnapshot(s, 0, 12, 'attack')), 0)).toMatchObject({ role: 'attack', points: 12 });
    expect(hud.read(fs, 0)!.role).toBeNull();
  });
});
