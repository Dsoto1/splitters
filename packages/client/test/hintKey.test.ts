import { describe, expect, it, vi } from 'vitest';

describe('hintKey', () => {
  it('shows the key with the keyboard and mouse, the controller button after a controller', async () => {
    let mode = 'kbm';
    vi.doMock('../src/inputMode.ts', () => ({ inputMode: () => mode }));
    const { hintKey } = await import('../src/game/keyBindings.ts');
    expect(hintKey('use')).toBe('F');
    mode = 'pad';
    expect(hintKey('use')).toBe('RB');
    expect(hintKey('jump')).toBe('A');
    // No button for it: the key.
    expect(hintKey('fireMode')).toBe('U');
  });
});
