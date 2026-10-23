// Page init script for headless WebGPU checks. Software WebGPU adapters
// (SwiftShader) render fine but cannot present to an on-screen canvas in
// headless Chromium (the device is lost on the first present). This shim
// renders each WebGPU canvas into an ordinary offscreen texture instead, and
// `window.__webgpuGrab()` copies the latest frame into a 2D canvas laid over
// the original, so screenshots and pixel reads see what WebGPU drew.
(() => {
  if (typeof GPUCanvasContext === 'undefined') return;
  const state = new WeakMap();
  const canvases = new Set();
  GPUCanvasContext.prototype.configure = function (config) {
    state.set(this, { config, texture: null });
    canvases.add(this);
  };
  GPUCanvasContext.prototype.unconfigure = function () {
    state.get(this)?.texture?.destroy();
    state.delete(this);
    canvases.delete(this);
  };
  GPUCanvasContext.prototype.getConfiguration = function () {
    return state.get(this)?.config ?? null;
  };
  GPUCanvasContext.prototype.getCurrentTexture = function () {
    const s = state.get(this);
    if (!s) throw new DOMException('context is not configured', 'InvalidStateError');
    const { width, height } = this.canvas;
    if (!s.texture || s.texture.width !== width || s.texture.height !== height) {
      s.texture?.destroy();
      const usage = (s.config.usage ?? GPUTextureUsage.RENDER_ATTACHMENT) | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT;
      s.texture = s.config.device.createTexture({ size: [width, height], format: s.config.format, usage, viewFormats: s.config.viewFormats ?? [] });
    }
    return s.texture;
  };

  /** Copy every WebGPU canvas's latest frame into a 2D overlay canvas. Returns how many were copied. */
  window.__webgpuGrab = async () => {
    let n = 0;
    for (const ctx of canvases) {
      const s = state.get(ctx);
      const canvas = ctx.canvas;
      if (!s?.texture || !canvas.isConnected) continue;
      const { device, format } = s.config;
      const { width, height } = s.texture;
      const bytesPerRow = Math.ceil((width * 4) / 256) * 256;
      const buffer = device.createBuffer({ size: bytesPerRow * height, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      const enc = device.createCommandEncoder();
      enc.copyTextureToBuffer({ texture: s.texture }, { buffer, bytesPerRow }, [width, height]);
      device.queue.submit([enc.finish()]);
      await buffer.mapAsync(GPUMapMode.READ);
      const src = new Uint8Array(buffer.getMappedRange());
      const img = new ImageData(width, height);
      const bgra = format.startsWith('bgra');
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * bytesPerRow + x * 4;
          const o = (y * width + x) * 4;
          img.data[o] = src[i + (bgra ? 2 : 0)];
          img.data[o + 1] = src[i + 1];
          img.data[o + 2] = src[i + (bgra ? 0 : 2)];
          img.data[o + 3] = 255;
        }
      }
      buffer.unmap();
      buffer.destroy();
      let overlay = canvas.__grabOverlay;
      if (!overlay) {
        overlay = canvas.__grabOverlay = document.createElement('canvas');
        overlay.style.pointerEvents = 'none';
        canvas.after(overlay);
      }
      const r = canvas.getBoundingClientRect();
      const cs = getComputedStyle(canvas);
      Object.assign(overlay.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, zIndex: cs.zIndex, display: cs.display === 'none' ? 'none' : 'block' });
      overlay.width = width;
      overlay.height = height;
      overlay.getContext('2d').putImageData(img, 0, 0);
      n++;
    }
    return n;
  };
  /** Remove the overlays again (so later frames show through for the next grab). */
  window.__webgpuUngrab = () => {
    for (const ctx of canvases) ctx.canvas.__grabOverlay?.remove(), (ctx.canvas.__grabOverlay = undefined);
  };
})();
