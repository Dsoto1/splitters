import { describe, expect, it } from 'vitest';
import { installGlStateCache } from '../src/glStateCache.ts';

/** A WebGL2 context stand-in that records the calls that reach it (the methods live on its prototype, as in a browser). */
function fakeGl() {
  const sent: string[] = [];
  class Ctx {
    FRAMEBUFFER = 0x8d40;
    DRAW_FRAMEBUFFER = 0x8ca9;
    READ_FRAMEBUFFER = 0x8ca8;
    canvas = undefined;
    getUniformLocation(program: object, name: string) {
      return { program, name };
    }
    linkProgram(_p: object) {
      sent.push('link');
    }
    uniform1f(_l: unknown, x: number) {
      sent.push(`1f ${x}`);
    }
    uniform3fv(_l: unknown, v: ArrayLike<number>) {
      sent.push(`3fv ${Array.from(v)}`);
    }
    uniformMatrix4fv(_l: unknown, t: boolean, v: ArrayLike<number>, off?: number) {
      sent.push(`m4 ${t} ${v[0]}${off !== undefined ? ` @${off}` : ''}`);
    }
    drawBuffers(list: number[]) {
      sent.push(`db ${list}`);
    }
    bindFramebuffer(target: number, fb: object | null) {
      sent.push(`bind ${target} ${fb ? (fb as { id: string }).id : 'default'}`);
    }
    deleteFramebuffer(_fb: object) {
      sent.push('delete');
    }
    drawElements() {
      sent.push('draw');
    }
    clear() {
      sent.push('clear');
    }
  }
  const gl = new Ctx();
  return { gl, sent };
}

describe('glStateCache (redundant WebGL calls dropped)', () => {
  it('drops a uniform set to the value its program already holds, keyed by program and name', () => {
    const { gl, sent } = fakeGl();
    const { stats } = installGlStateCache(gl as unknown as WebGL2RenderingContext);
    const p = {};
    const a = gl.getUniformLocation(p, 'lightMatrix0');
    const b = gl.getUniformLocation(p, 'lightMatrix0');
    const other = gl.getUniformLocation({}, 'lightMatrix0');
    const m = new Float32Array(48).fill(2);
    gl.uniformMatrix4fv(a, false, m);
    gl.uniformMatrix4fv(a, false, m);
    // Another lookup of the same uniform: the same value is held, so it is dropped too.
    gl.uniformMatrix4fv(b, false, new Float32Array(48).fill(2));
    // Another program's uniform of the same name is its own.
    gl.uniformMatrix4fv(other, false, m);
    expect(sent).toEqual(['m4 false 2', 'm4 false 2']);
    // A change goes through, and so does going back.
    gl.uniformMatrix4fv(b, false, new Float32Array(48).fill(3));
    gl.uniformMatrix4fv(a, false, m);
    expect(sent.slice(2)).toEqual(['m4 false 3', 'm4 false 2']);
    expect(stats.uniformsSkipped).toBe(2);
  });

  it('compares the values as passed, scalars and arrays alike', () => {
    const { gl, sent } = fakeGl();
    installGlStateCache(gl as unknown as WebGL2RenderingContext);
    const p = {};
    const f = gl.getUniformLocation(p, 'cascadeBlendFactor0');
    const v = gl.getUniformLocation(p, 'viewFrustumZ0');
    gl.uniform1f(f, 0.5);
    gl.uniform1f(f, 0.5);
    gl.uniform1f(f, 0.25);
    gl.uniform3fv(v, [1, 2, 3]);
    gl.uniform3fv(v, new Float32Array([1, 2, 3]));
    gl.uniform3fv(v, [1, 2, 4]);
    expect(sent).toEqual(['1f 0.5', '1f 0.25', '3fv 1,2,3', '3fv 1,2,4']);
  });

  it('sends a sub-range, a transposed matrix or a long list as it is, and forgets the cached value', () => {
    const { gl, sent } = fakeGl();
    installGlStateCache(gl as unknown as WebGL2RenderingContext);
    const l = gl.getUniformLocation({}, 'm');
    const m = new Float32Array(16).fill(1);
    gl.uniformMatrix4fv(l, false, m);
    gl.uniformMatrix4fv(l, false, new Float32Array(32).fill(5), 16);
    gl.uniformMatrix4fv(l, false, m);
    gl.uniformMatrix4fv(l, true, m);
    gl.uniformMatrix4fv(l, false, m);
    const bones = gl.getUniformLocation({}, 'mBones');
    gl.uniformMatrix4fv(bones, false, new Float32Array(16 * 40));
    gl.uniformMatrix4fv(bones, false, new Float32Array(16 * 40));
    expect(sent).toEqual(['m4 false 1', 'm4 false 5 @16', 'm4 false 1', 'm4 true 1', 'm4 false 1', 'm4 false 0', 'm4 false 0']);
  });

  it('starts a program\'s values again when it is linked again', () => {
    const { gl, sent } = fakeGl();
    installGlStateCache(gl as unknown as WebGL2RenderingContext);
    const p = {};
    gl.uniform1f(gl.getUniformLocation(p, 'x'), 1);
    gl.linkProgram(p);
    gl.uniform1f(gl.getUniformLocation(p, 'x'), 1);
    expect(sent).toEqual(['1f 1', 'link', '1f 1']);
  });

  it('holds draw buffers until a draw, and sends only a change for that framebuffer', () => {
    const { gl, sent } = fakeGl();
    const { stats } = installGlStateCache(gl as unknown as WebGL2RenderingContext);
    const scene = { id: 'scene' };
    const MRT = [0x8ce0, 0x8ce1, 0x8ce2];
    const ONE = [0x8ce0, 0, 0];
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene);
    // The pre-pass renderer: its targets before each draw, back to one after it.
    for (let i = 0; i < 3; i++) {
      gl.drawBuffers(MRT);
      gl.drawElements();
      gl.drawBuffers(ONE);
    }
    expect(sent).toEqual([`bind ${gl.FRAMEBUFFER} scene`, `db ${MRT}`, 'draw', 'draw', 'draw']);
    // A mesh that draws to one target: the held change goes out before its draw.
    gl.drawElements();
    expect(sent.slice(5)).toEqual([`db ${ONE}`, 'draw']);
    expect(stats.drawBuffers).toBe(6);
    expect(stats.drawBuffersSent).toBe(2);
  });

  it('keeps draw buffers per framebuffer and sends a held change before switching away', () => {
    const { gl, sent } = fakeGl();
    installGlStateCache(gl as unknown as WebGL2RenderingContext);
    const a = { id: 'a' };
    const b = { id: 'b' };
    gl.bindFramebuffer(gl.FRAMEBUFFER, a);
    gl.drawBuffers([1, 2]);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, b);
    gl.drawBuffers([1, 2]);
    gl.clear();
    gl.bindFramebuffer(gl.FRAMEBUFFER, a);
    gl.drawBuffers([1, 2]);
    gl.drawElements();
    // Reading framebuffers do not change where draws go.
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, b);
    gl.drawBuffers([1]);
    gl.drawElements();
    expect(sent).toEqual([
      `bind ${gl.FRAMEBUFFER} a`,
      'db 1,2',
      `bind ${gl.DRAW_FRAMEBUFFER} b`,
      'db 1,2',
      'clear',
      `bind ${gl.FRAMEBUFFER} a`,
      'draw',
      `bind ${gl.READ_FRAMEBUFFER} b`,
      'db 1',
      'draw',
    ]);
  });

  it('forgets a deleted bound framebuffer\'s held change, and comes off cleanly', () => {
    const { gl, sent } = fakeGl();
    const { remove } = installGlStateCache(gl as unknown as WebGL2RenderingContext);
    const a = { id: 'a' };
    gl.bindFramebuffer(gl.FRAMEBUFFER, a);
    gl.drawBuffers([1]);
    gl.deleteFramebuffer(a);
    gl.drawElements();
    expect(sent).toEqual([`bind ${gl.FRAMEBUFFER} a`, 'delete', 'draw']);
    remove();
    const l = gl.getUniformLocation({}, 'x');
    gl.uniform1f(l, 1);
    gl.uniform1f(l, 1);
    expect(sent.slice(3)).toEqual(['1f 1', '1f 1']);
    expect(Object.prototype.hasOwnProperty.call(gl, 'uniform1f')).toBe(false);
  });
});
