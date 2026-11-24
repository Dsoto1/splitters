import { describe, expect, it } from 'vitest';
import { DirRepeat, nextInDirection, scrollStep, stickDir, type Box } from '../src/frontend/padNav.ts';

/** A grid of `n` cards, `cols` across, 200 × 150 with 10 px gaps (Match Setup's map grid). */
const grid = (n: number, cols: number): Box[] => Array.from({ length: n }, (_, i) => ({ left: (i % cols) * 210, top: Math.floor(i / cols) * 160, width: 200, height: 150 }));

describe('controller focus: the spatial move', () => {
  const g = grid(10, 3); // rows: 0 1 2 / 3 4 5 / 6 7 8 / 9
  const move = (i: number, dir: Parameters<typeof nextInDirection>[2]) => nextInDirection(g[i]!, g, dir);
  it('left and right stay in the row', () => {
    expect(move(0, 'right')).toBe(1);
    expect(move(1, 'right')).toBe(2);
    expect(move(4, 'left')).toBe(3);
  });
  it("the row's ends have nothing further (the screen moves on to the panel, or back to the grid)", () => {
    expect(move(2, 'right')).toBeNull();
    expect(move(5, 'right')).toBeNull();
    expect(move(3, 'left')).toBeNull();
  });
  it('up and down keep the column', () => {
    expect(move(1, 'down')).toBe(4);
    expect(move(4, 'down')).toBe(7);
    expect(move(7, 'up')).toBe(4);
    expect(move(0, 'up')).toBeNull();
  });
  it('a shorter last row: down goes to the nearest card in it', () => {
    expect(move(8, 'down')).toBe(9);
    expect(move(6, 'down')).toBe(9);
    expect(move(9, 'down')).toBeNull();
    expect(move(9, 'up')).toBe(6);
  });
  it('a panel of controls of different sizes: the one lined up, else the nearest ahead', () => {
    const panel: Box[] = [
      { left: 0, top: 0, width: 400, height: 40 }, // a row of tabs as one wide box
      { left: 0, top: 60, width: 80, height: 30 }, // chips
      { left: 90, top: 60, width: 80, height: 30 },
      { left: 180, top: 60, width: 80, height: 30 },
      { left: 0, top: 110, width: 300, height: 30 }, // a wide control under them
    ];
    expect(nextInDirection(panel[0]!, panel, 'down')).toBe(3); // the chip most lined up with its middle
    expect(nextInDirection(panel[2]!, panel, 'right')).toBe(3);
    expect(nextInDirection(panel[3]!, panel, 'down')).toBe(4);
    expect(nextInDirection(panel[4]!, panel, 'up')).toBe(2);
    expect(nextInDirection(panel[1]!, panel, 'left')).toBeNull();
    // Left from the tabs never drops to a control on a row below.
    expect(nextInDirection({ left: 300, top: 0, width: 100, height: 40 }, panel.slice(1), 'left')).toBeNull();
  });
});

describe('controller focus: holding a direction', () => {
  it('moves at once, again after the delay, then at a steady rate', () => {
    const r = new DirRepeat(380, 110);
    const moves: number[] = [];
    for (let t = 0; t <= 1000; t += 10) if (r.update('down', t)) moves.push(t);
    expect(moves).toEqual([0, 380, 490, 600, 710, 820, 930]);
  });
  it('letting go and pressing again, or another direction, starts over', () => {
    const r = new DirRepeat(380, 110);
    expect(r.update('down', 0)).toBe('down');
    expect(r.update('down', 100)).toBeNull();
    expect(r.update(null, 120)).toBeNull();
    expect(r.update('down', 130)).toBe('down');
    expect(r.update('right', 140)).toBe('right');
    expect(r.update('right', 200)).toBeNull();
  });
  it('a long frame moves once, not a burst', () => {
    const r = new DirRepeat(380, 110);
    r.update('up', 0);
    expect(r.update('up', 2000)).toBe('up');
    expect(r.update('up', 2010)).toBeNull();
    expect(r.update('up', 2110)).toBe('up');
  });
});

describe('controller sticks', () => {
  it('the left stick leans one way past its dead zone', () => {
    expect(stickDir(0.2, 0.3)).toBeNull();
    expect(stickDir(0.9, 0.2)).toBe('right');
    expect(stickDir(-0.1, -0.8)).toBe('up');
    expect(stickDir(0.6, 0.7)).toBe('down');
  });
  it('the right stick scrolls smoothly, faster the further it leans', () => {
    expect(scrollStep(0.1, 1 / 60)).toBe(0);
    const half = scrollStep(0.6, 1 / 60);
    const full = scrollStep(1, 1 / 60);
    expect(half).toBeGreaterThan(0);
    expect(full).toBeCloseTo(1400 / 60);
    expect(full).toBeGreaterThan(half);
    expect(scrollStep(-1, 0.5)).toBeCloseTo(-700);
  });
});
