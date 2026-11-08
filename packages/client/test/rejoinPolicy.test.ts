import { describe, expect, it } from 'vitest';
import { FOLLOW_TRAVEL_MS, RECONNECT_FOR_MS, afterLinkEnds } from '../src/game/rejoinPolicy.ts';

describe('what an online page does when its link ends', () => {
  const gone = 'no game open with code ABC234 — check the code, and that the host still has the match open (Esc → Host game)';

  it('follows the host to its next map through every failed try (a vote, the rotation): the party arrives together', () => {
    // The e2e party flow on a loaded runner: the friend got `travel`, its one rejoin came while the host was still
    // loading the next map, failed, and the friend was left on the menu while the party played on.
    for (const reason of [gone, "found the game but couldn't connect to it", 'lost the connection to the host', 'no answer within 30 s']) {
      expect(afterLinkEnds({ reason, how: undefined, rejoining: true, following: true })).toBe('retry');
      expect(afterLinkEnds({ reason, how: 'lost', rejoining: true, following: true })).toBe('retry');
    }
    expect(FOLLOW_TRAVEL_MS).toBeGreaterThan(RECONNECT_FOR_MS);
  });

  it('still stops on a refusal or on leaving, even while following', () => {
    expect(afterLinkEnds({ reason: 'the match is full', how: 'rejected', rejoining: true, following: true })).toBe('menu');
    expect(afterLinkEnds({ reason: undefined, how: undefined, rejoining: true, following: true })).toBe('menu');
  });

  it('reconnects after a lost link, and keeps trying while reconnecting; a game that is gone ends it', () => {
    expect(afterLinkEnds({ reason: 'lost the connection to the host', how: 'lost', rejoining: false, following: false })).toBe('retry');
    expect(afterLinkEnds({ reason: "found the game but couldn't connect to it", how: undefined, rejoining: true, following: false })).toBe('retry');
    expect(afterLinkEnds({ reason: gone, how: undefined, rejoining: true, following: false })).toBe('menu');
  });

  it('a first join that fails goes back to the menu and says why', () => {
    expect(afterLinkEnds({ reason: gone, how: undefined, rejoining: false, following: false })).toBe('menu');
    expect(afterLinkEnds({ reason: "found the game but couldn't connect to it", how: undefined, rejoining: false, following: false })).toBe('menu');
  });
});
