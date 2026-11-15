const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/pass.fragment-M-yNCXt5.js","assets/babylon-PnzH6wcM.js"])))=>i.map(i=>d[i]);
import { a4 as Clamp, a5 as Tools, L as Logger, a6 as EncodeArrayBufferToBase64, a7 as __esDecorate, a8 as __runInitializers, I as EngineStore, a9 as __vitePreload, aa as EffectRenderer, ab as EffectWrapper, ac as nativeOverride } from "./babylon-PnzH6wcM.js";
let ResourcesPromise = null;
async function _CreateDumpResourcesAsync() {
  const canvas = EngineStore.LastCreatedEngine?.createCanvas(100, 100) ?? new OffscreenCanvas(100, 100);
  if (canvas instanceof OffscreenCanvas) {
    Logger.Warn("DumpData: OffscreenCanvas will be used for dumping data. This may result in lossy alpha values.");
  }
  const { ThinEngine: thinEngineClass } = await __vitePreload(async () => {
    const { ThinEngine: thinEngineClass2 } = await import("./babylon-PnzH6wcM.js").then((n) => n.eA);
    return { ThinEngine: thinEngineClass2 };
  }, true ? [] : void 0);
  if (!thinEngineClass.IsSupported) {
    throw new Error("DumpData: No WebGL context available. Cannot dump data.");
  }
  const options = {
    preserveDrawingBuffer: true,
    depth: false,
    stencil: false,
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    failIfMajorPerformanceCaveat: false
  };
  const engine = new thinEngineClass(canvas, false, options);
  EngineStore.Instances.pop();
  EngineStore.OnEnginesDisposedObservable.add((e) => {
    if (engine && e !== engine && !engine.isDisposed && EngineStore.Instances.length === 0) {
      Dispose();
    }
  });
  engine.getCaps().parallelShaderCompile = void 0;
  const renderer = new EffectRenderer(engine);
  const { passPixelShader } = await __vitePreload(async () => {
    const { passPixelShader: passPixelShader2 } = await import("./pass.fragment-M-yNCXt5.js");
    return { passPixelShader: passPixelShader2 };
  }, true ? __vite__mapDeps([0,1]) : void 0);
  const wrapper = new EffectWrapper({
    engine,
    name: passPixelShader.name,
    fragmentShader: passPixelShader.shader,
    samplerNames: ["textureSampler"]
  });
  return {
    canvas,
    dumpEngine: { engine, renderer, wrapper }
  };
}
async function _GetDumpResourcesAsync() {
  if (!ResourcesPromise) {
    ResourcesPromise = _CreateDumpResourcesAsync();
  }
  return await ResourcesPromise;
}
let EncodingHelper = (() => {
  var _a;
  let _staticExtraInitializers = [];
  let _static_EncodeImageAsync_decorators;
  return _a = class EncodingHelper {
    /**
     * Encodes image data to the given mime type.
     * This is put into a helper class so we can apply the nativeOverride decorator to it.
     * @internal
     */
    static async EncodeImageAsync(pixelData, width, height, mimeType, invertY, quality) {
      const resources = await _GetDumpResourcesAsync();
      const dumpEngine = resources.dumpEngine;
      dumpEngine.engine.setSize(width, height, true);
      const texture = dumpEngine.engine.createRawTexture(pixelData, width, height, 5, false, !invertY, 1);
      dumpEngine.renderer.setViewport();
      dumpEngine.renderer.applyEffectWrapper(dumpEngine.wrapper);
      dumpEngine.wrapper.effect._bindTexture("textureSampler", texture);
      dumpEngine.renderer.draw();
      texture.dispose();
      return await new Promise((resolve, reject) => {
        Tools.ToBlob(resources.canvas, (blob) => {
          if (!blob) {
            reject(new Error("EncodeImageAsync: Failed to convert canvas to blob."));
          } else {
            resolve(blob);
          }
        }, mimeType, quality);
      });
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? /* @__PURE__ */ Object.create(null) : void 0;
    _static_EncodeImageAsync_decorators = [nativeOverride];
    __esDecorate(_a, null, _static_EncodeImageAsync_decorators, { kind: "method", name: "EncodeImageAsync", static: true, private: false, access: { has: (obj) => "EncodeImageAsync" in obj, get: (obj) => obj.EncodeImageAsync }, metadata: _metadata }, null, _staticExtraInitializers);
    if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
    __runInitializers(_a, _staticExtraInitializers);
  })(), _a;
})();
const EncodeImageAsync = EncodingHelper.EncodeImageAsync;
async function DumpFramebuffer(width, height, engine, successCallback, mimeType = "image/png", fileName, quality) {
  const bufferView = await engine.readPixels(0, 0, width, height);
  const data = new Uint8Array(bufferView.buffer);
  DumpData(width, height, data, successCallback, mimeType, fileName, true, void 0, quality);
}
async function DumpDataAsync(width, height, data, mimeType = "image/png", fileName, invertY = false, toArrayBuffer = false, quality) {
  if (data instanceof Float32Array) {
    const data2 = new Uint8Array(data.length);
    let n = data.length;
    while (n--) {
      const v = data[n];
      data2[n] = Math.round(Clamp(v) * 255);
    }
    data = data2;
  }
  const blob = await EncodingHelper.EncodeImageAsync(data, width, height, mimeType, invertY, quality);
  if (fileName !== void 0) {
    Tools.DownloadBlob(blob, fileName);
  }
  if (blob.type !== mimeType) {
    Logger.Warn(`DumpData: The requested mimeType '${mimeType}' is not supported. The result has mimeType '${blob.type}' instead.`);
  }
  const buffer = await blob.arrayBuffer();
  if (toArrayBuffer) {
    return buffer;
  }
  return `data:${mimeType};base64,${EncodeArrayBufferToBase64(buffer)}`;
}
function DumpData(width, height, data, successCallback, mimeType = "image/png", fileName, invertY = false, toArrayBuffer = false, quality) {
  if (fileName === void 0 && !successCallback) {
    fileName = "";
  }
  DumpDataAsync(width, height, data, mimeType, fileName, invertY, toArrayBuffer, quality).then((result) => {
    if (successCallback) {
      successCallback(result);
    }
  });
}
function Dispose() {
  if (!ResourcesPromise) {
    return;
  }
  ResourcesPromise?.then((resources) => {
    if (resources.canvas instanceof HTMLCanvasElement) {
      resources.canvas.remove();
    }
    if (resources.dumpEngine) {
      resources.dumpEngine.engine.dispose();
      resources.dumpEngine.renderer.dispose();
      resources.dumpEngine.wrapper.dispose();
    }
  });
  ResourcesPromise = null;
}
const DumpTools = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  DumpData,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  DumpDataAsync,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  DumpFramebuffer,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Dispose
};
let _Registered = false;
function RegisterDumpTools() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  const InitSideEffects = () => {
    Tools.DumpData = DumpData;
    Tools.DumpDataAsync = DumpDataAsync;
    Tools.DumpFramebuffer = DumpFramebuffer;
  };
  InitSideEffects();
}
export {
  Dispose,
  DumpData,
  DumpDataAsync,
  DumpFramebuffer,
  DumpTools,
  EncodeImageAsync,
  RegisterDumpTools
};
