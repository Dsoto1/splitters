import { afterEach, describe, expect, it } from 'vitest';
import { DamageNumbers, autoReloadOn, damageNumbersOn, saveAutoReload, saveDamageNumbers, saveSprayReadout, sprayReadoutOn } from '../src/game/combatReadouts.ts';

const g = globalThis as { localStorage?: Storage };

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage;
}

describe('gunplay readout options', () => {
  afterEach(() => delete g.localStorage);

  it('auto-reload is on by default; damage numbers and the spray pattern are off (also with no storage at all)', () => {
    expect(autoReloadOn()).toBe(true);
    expect(damageNumbersOn()).toBe(false);
    expect(sprayReadoutOn()).toBe(false);
    g.localStorage = fakeStorage();
    expect(autoReloadOn()).toBe(true);
    expect(damageNumbersOn()).toBe(false);
  });

  it('each is saved and read back', () => {
    g.localStorage = fakeStorage();
    saveAutoReload(false);
    saveDamageNumbers(true);
    saveSprayReadout(true);
    expect(autoReloadOn()).toBe(false);
    expect(damageNumbersOn()).toBe(true);
    expect(sprayReadoutOn()).toBe(true);
  });
});

/** Just enough DOM for DamageNumbers: elements with a style, classes and a parent. */
function fakeDom(): { root: HTMLElement; restore(): void } {
  const made = () => {
    const props = new Map<string, string>();
    const el = {
      className: '',
      textContent: '',
      style: { visibility: '', transform: '', setProperty: (k: string, v: string) => void props.set(k, v) },
      classList: { add: () => undefined, contains: () => false },
      children: [] as unknown[],
      parent: null as { children: unknown[] } | null,
      append(c: { parent: unknown }) {
        this.children.push(c);
        c.parent = this;
      },
      remove() {
        if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
      },
    };
    return el;
  };
  const d = globalThis as { document?: unknown };
  const before = d.document;
  d.document = { createElement: made };
  return { root: made() as unknown as HTMLElement, restore: () => void (d.document = before) };
}

describe('damage numbers on a slow page', () => {
  afterEach(() => delete g.localStorage);

  it('a number is drawn at least once, even when the next frame comes after its longest life', () => {
    g.localStorage = fakeStorage();
    saveDamageNumbers(true);
    const dom = fakeDom();
    try {
      const nums = new DamageNumbers(dom.root);
      nums.take([[10, 24, 0, 0, 1, 0]], 0);
      expect(nums.shown()).toEqual(['24']);
      // A page drawing a frame every 5 s (longer than the 3.6 s a number can last): the first frame draws it...
      const drawn: string[] = [];
      const project = () => ({ x: 100, y: 100 });
      nums.update(project, 5000);
      for (const c of (dom.root as unknown as { children: { style: { visibility: string }; textContent: string }[] }).children) if (c.style.visibility !== 'hidden') drawn.push(c.textContent);
      expect(drawn).toEqual(['24']);
      // ...and the next takes it away.
      nums.update(project, 10000);
      expect(nums.shown()).toEqual([]);
    } finally {
      dom.restore();
    }
  });
});
