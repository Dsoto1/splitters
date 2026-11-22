import { describe, expect, it } from 'vitest';
import { emptyCareer, type PublicCard } from '@tiletrigger/shared';
import { playerCardLines, type PlayerCardSubject } from '../src/game/playerCard.ts';
import { cardLines } from '../src/game/profileCard.ts';

const subject = (o: Partial<PlayerCardSubject> = {}): PlayerCardSubject => ({ slot: 2, name: 'Toshi_92', username: 'Toshi_92', kind: 'acct', character: 'Ranger', emblem: 'bolt.3', title: null, cls: '', kills: 4, deaths: 2, ...o });

describe("other players' cards (player profiles, Phase 2)", () => {
  it("a signed-in player's card: the match's line, then the hub's career", () => {
    expect(playerCardLines(subject(), undefined)).toMatchObject({ tag: '✓', match: 'This match: 4 K · 2 D', career: 'Career: loading…' });
    const hub: PublicCard = { username: 'Toshi_92', emblem: 'star.1', title: 'veteran', favClass: 'medic', career: { ...emptyCareer(), matches: 120, wins: 60, kills: 900, deaths: 450, shots: 10_000, hits: 3000, weaponKills: { 'core.rifle': 500 } }, vouched: { matches: 3, wins: 2, kills: 20, deaths: 10, seconds: 900 } };
    const l = playerCardLines(subject(), hub);
    expect(l.sub).toBe('Veteran · Ranger · ★ Medic');
    expect(l.career).toMatch(/^Career: 120 matches · 60 wins \(50%\) · K\/D 2\.00 · 30% accuracy · /);
    expect(l.vouched).toBe('Counted by other hosts: 3 matches · 2 wins · K/D 2.00');
    // No hub (an older one, offline): the match's card only.
    expect(playerCardLines(subject(), null).career).toBe('Career: not available right now');
  });

  it("a guest's and a bot's card say why there's no career", () => {
    expect(playerCardLines(subject({ kind: 'guest', username: null, title: 'recruit' }), null)).toMatchObject({ tag: 'GUEST', sub: 'Recruit · Ranger', career: /own browser/ as unknown as string });
    expect(playerCardLines(subject({ kind: 'bot', username: null, emblem: null, cls: 'Medic' }), null)).toMatchObject({ tag: 'BOT', sub: 'Ranger · Medic', career: 'A bot: no career' });
  });

  it('your own card wears your title', () => {
    const l = cardLines({ name: 'Me', verified: false, character: 'Ranger', favClass: null, career: emptyCareer(), where: 'browser', emblem: 'moon.0', title: 'recruit' }, null, false);
    expect(l.sub).toBe('Recruit · Ranger');
  });
});
