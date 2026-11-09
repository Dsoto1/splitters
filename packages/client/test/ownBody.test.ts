import { describe, expect, it } from 'vitest';
import { ownBodyDrawn } from '../src/game/ownBody.ts';

const base = { alive: true, seated: false, rideView: null, thirdPerson: false, tpClose: false } as const;

describe('ownBodyDrawn', () => {
  it('on foot: drawn in third person only, and not with the camera squeezed against a wall', () => {
    expect(ownBodyDrawn(base)).toBe(false);
    expect(ownBodyDrawn({ ...base, thirdPerson: true })).toBe(true);
    expect(ownBodyDrawn({ ...base, thirdPerson: true, tpClose: true })).toBe(false);
  });

  it('in a seat: drawn in the chase view, whatever the on-foot view', () => {
    for (const thirdPerson of [false, true]) {
      expect(ownBodyDrawn({ ...base, seated: true, rideView: 'chase', thirdPerson })).toBe(true);
      // tpClose is the on-foot camera's (left over from before you got in): it doesn't hide a rider.
      expect(ownBodyDrawn({ ...base, seated: true, rideView: 'chase', thirdPerson, tpClose: true })).toBe(true);
    }
  });

  it('in a seat: hidden in the cockpit and the seat views (your own eyes), even with third person on', () => {
    for (const rideView of ['cockpit', 'seat'] as const) {
      expect(ownBodyDrawn({ ...base, seated: true, rideView })).toBe(false);
      expect(ownBodyDrawn({ ...base, seated: true, rideView, thirdPerson: true })).toBe(false);
    }
    // Just got in, before the vehicle camera has set its view.
    expect(ownBodyDrawn({ ...base, seated: true, rideView: null, thirdPerson: true })).toBe(false);
  });

  it('dead: never drawn, seated or not, in any view (the kill cam and spectating watch others)', () => {
    for (const seated of [false, true])
      for (const rideView of ['cockpit', 'chase', 'seat', null] as const) expect(ownBodyDrawn({ ...base, alive: false, seated, rideView, thirdPerson: true })).toBe(false);
  });
});
