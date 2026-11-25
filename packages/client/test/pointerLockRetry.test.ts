import { describe, expect, it, vi } from 'vitest';

// Crash report 1d50cff7: the plain pointer-lock retry's refusal went unhandled (WrongDocumentError on Chrome when the
// canvas's page isn't active). requestMouse catches every refusal and doesn't retry on WrongDocumentError.
vi.stubGlobal('document', { pointerLockElement: null, exitPointerLock: () => undefined });
const { requestMouse, releasePointer } = await import('../src/fullscreen.ts');

const refuse = (name: string) => Promise.reject(Object.assign(new Error(name), { name }));
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('requestMouse (pointer-lock retry)', () => {
  it('retries plainly when raw movement is refused, and catches the retry being refused too', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    const calls: unknown[] = [];
    requestMouse({ requestPointerLock: (o) => (calls.push(o), refuse(o ? 'NotSupportedError' : 'SecurityError')) });
    await settle();
    await settle();
    process.off('unhandledRejection', onUnhandled);
    expect(calls).toEqual([{ unadjustedMovement: true }, undefined]);
    expect(unhandled).toEqual([]);
  });

  it("doesn't retry on WrongDocumentError (the next click asks again)", async () => {
    const calls: unknown[] = [];
    requestMouse({ requestPointerLock: (o) => (calls.push(o), refuse('WrongDocumentError')) });
    await settle();
    expect(calls).toEqual([{ unadjustedMovement: true }]);
  });

  it("doesn't retry once the page has let the mouse go since", async () => {
    const calls: unknown[] = [];
    let reject!: (e: unknown) => void;
    requestMouse({ requestPointerLock: (o) => (calls.push(o), o ? new Promise<void>((_, rj) => (reject = rj)) : undefined) });
    releasePointer();
    reject(Object.assign(new Error('x'), { name: 'NotSupportedError' }));
    await settle();
    expect(calls).toEqual([{ unadjustedMovement: true }]);
  });

  it('copes with old browsers: no promise, or a throw', () => {
    expect(() => requestMouse({ requestPointerLock: () => undefined })).not.toThrow();
    expect(() =>
      requestMouse({
        requestPointerLock: () => {
          throw new Error('old');
        },
      }),
    ).not.toThrow();
  });
});
