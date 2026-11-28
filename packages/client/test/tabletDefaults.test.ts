// Lighter defaults by device (game/graphicsSettings.ts, touchDevice.ts): phones start on Low graphics
// and the 75 % render scale; tablets (a touch screen whose short side is at least 600 CSS px) on
// Medium and Auto, like a computer (owner, 2026-11-28, on an iPad: "medium with auto looks and plays
// much better").
import { afterEach, describe, expect, it, vi } from 'vitest';

async function defaultsFor(search: string, screen: { width: number; height: number }) {
  vi.resetModules();
  const store = new Map<string, string>();
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = Object.assign(new EventTarget(), { location: { search }, screen, innerWidth: screen.width, innerHeight: screen.height, matchMedia: () => ({ matches: false }) });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  });
  const touch = await import('../src/touchDevice.ts');
  const gfx = await import('../src/game/graphicsSettings.ts');
  return { tablet: touch.isTablet(), quality: gfx.loadGraphicsQuality(), scale: gfx.loadRenderScale() };
}

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>).window;
});

describe('device defaults', { timeout: 60_000 }, () => {
  it('a phone starts on Low and Performance (75 %)', async () => {
    expect(await defaultsFor('?touch=1', { width: 390, height: 844 })).toEqual({ tablet: false, quality: 'low', scale: 'performance' });
  });
  it('an iPad starts on Medium and Auto', async () => {
    expect(await defaultsFor('?touch=1', { width: 1024, height: 1366 })).toEqual({ tablet: true, quality: 'medium', scale: 'auto' });
  });
  it('a computer starts on Medium and Auto, and is never a tablet', async () => {
    expect(await defaultsFor('?touch=0', { width: 1920, height: 1080 })).toEqual({ tablet: false, quality: 'medium', scale: 'auto' });
  });
  it('?tablet= forces it either way on a touch device', async () => {
    expect((await defaultsFor('?touch=1&tablet=1', { width: 390, height: 844 })).tablet).toBe(true);
    expect((await defaultsFor('?touch=1&tablet=0', { width: 1024, height: 1366 })).quality).toBe('low');
  });
});
