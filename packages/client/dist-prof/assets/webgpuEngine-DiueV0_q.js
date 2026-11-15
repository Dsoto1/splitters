const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/webAudioBus-JXKslokA.js","assets/abstractAudioBus-16cPxZ1a.js","assets/webAudioBaseSubGraph-BCodVyiC.js","assets/abstractAudioNode-CyGHAvf_.js","assets/babylon-PnzH6wcM.js","assets/spatialWebAudio-DNn_yFfx.js","assets/webAudioMainBus-BlEs7RqL.js","assets/webAudioStaticSound-B3zBHiUS.js","assets/abstractSoundInstance-D1fiMt1i.js","assets/abstractSoundSource-BROm-ocX.js","assets/webAudioSoundSource-DNwA1I76.js","assets/webAudioStreamingSound-DwzrwDYj.js"])))=>i.map(i=>d[i]);
import { ag as ILog2, dd as PerfCounter, U as AbstractEngine, L as Logger, cx as UniformBuffer, d2 as Initialize, dw as Process, d4 as Finalize, dg as DataBuffer, al as FromHalfFloat, eg as allocateAndCopyTypedBuffer, j as VertexBuffer, eh as VertexBufferDeduceStride, ei as StencilStateComposer, ej as DepthCullingState, ae as InternalTexture, a9 as __vitePreload, a5 as Tools, ek as GetFontOffset, el as RegisterAbstractEngineDom, em as RegisterAbstractEngineRenderPass, en as PerformanceMonitor, eo as AlphaState, C as Color4, ep as _CommonInit, eq as ResizeImageBitmap, er as CreateImageBitmapFromSource, es as RequestFullscreen, et as ExitFullscreen, eu as RequestPointerlock, ev as ExitPointerlock, aF as IsIntegerTextureFormat, bM as Effect, ew as IsWrapper, ex as resetCachedPipeline, aG as IsUnsignedIntegerTextureType, ey as _CommonDispose, I as EngineStore, ad as SphericalPolynomial, K as ShaderStore, ez as GetTypeByteLength, B as Buffer, O as Observable, Q as Quaternion, V as Vector3, M as Matrix, da as RenderTargetWrapper, di as GetTypeForDepthTexture, df as HasStencilAspect, aD as GetExponentOfTwo } from "./babylon-PnzH6wcM.js";
import "./instancesVertex-23t-Q1Uk.js";
import "./instancesDeclaration-DL63iftc.js";
import "./helperFunctions-vFx73x84.js";
import "./fresnelFunction-TxuVXtkW.js";
import "./meshUboDeclaration-w24jovMr.js";
import "./sceneUboDeclaration-CzhdE5li.js";
import "./decalFragment-C4yBxeHS.js";
import { e as _SpatialAudioAttacherComponent, d as _WebAudioParameterComponent, f as _SpatialWebAudioUpdaterComponent, A as AbstractAudioNode } from "./abstractAudioNode-CyGHAvf_.js";
class WebGPUTextureHelper {
  static ComputeNumMipmapLevels(width, height, depth = 1) {
    return ILog2(Math.max(width, height, depth)) + 1;
  }
  static GetTextureTypeFromFormat(format) {
    switch (format) {
      // One Component = 8 bits unsigned
      case "r8unorm":
      case "r8uint":
      case "rg8unorm":
      case "rg8uint":
      case "rgba8unorm":
      case "rgba8unorm-srgb":
      case "rgba8uint":
      case "bgra8unorm":
      case "bgra8unorm-srgb":
      case "rgb10a2uint":
      // composite format - let's say it's byte...
      case "rgb10a2unorm":
      // composite format - let's say it's byte...
      case "rgb9e5ufloat":
      // composite format - let's say it's byte...
      case "rg11b10ufloat":
      // composite format - let's say it's byte...
      case "bc7-rgba-unorm":
      case "bc7-rgba-unorm-srgb":
      case "bc6h-rgb-ufloat":
      case "bc5-rg-unorm":
      case "bc3-rgba-unorm":
      case "bc3-rgba-unorm-srgb":
      case "bc2-rgba-unorm":
      case "bc2-rgba-unorm-srgb":
      case "bc4-r-unorm":
      case "bc1-rgba-unorm":
      case "bc1-rgba-unorm-srgb":
      case "etc2-rgb8unorm":
      case "etc2-rgb8unorm-srgb":
      case "etc2-rgb8a1unorm":
      case "etc2-rgb8a1unorm-srgb":
      case "etc2-rgba8unorm":
      case "etc2-rgba8unorm-srgb":
      case "eac-r11unorm":
      case "eac-rg11unorm":
      case "astc-4x4-unorm":
      case "astc-4x4-unorm-srgb":
      case "astc-5x4-unorm":
      case "astc-5x4-unorm-srgb":
      case "astc-5x5-unorm":
      case "astc-5x5-unorm-srgb":
      case "astc-6x5-unorm":
      case "astc-6x5-unorm-srgb":
      case "astc-6x6-unorm":
      case "astc-6x6-unorm-srgb":
      case "astc-8x5-unorm":
      case "astc-8x5-unorm-srgb":
      case "astc-8x6-unorm":
      case "astc-8x6-unorm-srgb":
      case "astc-8x8-unorm":
      case "astc-8x8-unorm-srgb":
      case "astc-10x5-unorm":
      case "astc-10x5-unorm-srgb":
      case "astc-10x6-unorm":
      case "astc-10x6-unorm-srgb":
      case "astc-10x8-unorm":
      case "astc-10x8-unorm-srgb":
      case "astc-10x10-unorm":
      case "astc-10x10-unorm-srgb":
      case "astc-12x10-unorm":
      case "astc-12x10-unorm-srgb":
      case "astc-12x12-unorm":
      case "astc-12x12-unorm-srgb":
      case "stencil8":
        return 0;
      // One Component = 8 bits signed
      case "r8snorm":
      case "r8sint":
      case "rg8snorm":
      case "rg8sint":
      case "rgba8snorm":
      case "rgba8sint":
      case "bc6h-rgb-float":
      case "bc5-rg-snorm":
      case "bc4-r-snorm":
      case "eac-r11snorm":
      case "eac-rg11snorm":
        return 3;
      // One component = 16 bits unsigned
      case "r16uint":
      case "r16unorm":
      case "rg16unorm":
      case "rgba16unorm":
      case "rg16uint":
      case "rgba16uint":
      case "depth16unorm":
        return 5;
      // One component = 16 bits signed
      case "r16sint":
      case "r16snorm":
      case "rg16snorm":
      case "rgba16snorm":
      case "rg16sint":
      case "rgba16sint":
        return 4;
      case "r16float":
      case "rg16float":
      case "rgba16float":
        return 2;
      // One component = 32 bits unsigned
      case "r32uint":
      case "rg32uint":
      case "rgba32uint":
        return 7;
      // One component = 32 bits signed
      case "r32sint":
      case "rg32sint":
      case "rgba32sint":
        return 7;
      case "r32float":
      case "rg32float":
      case "rgba32float":
      case "depth32float":
      case "depth32float-stencil8":
      case "depth24plus":
      case "depth24plus-stencil8":
        return 1;
    }
    return 0;
  }
  static GetBlockInformationFromFormat(format) {
    switch (format) {
      // 8 bits formats
      case "r8unorm":
      case "r8snorm":
      case "r8uint":
      case "r8sint":
        return { width: 1, height: 1, length: 1 };
      // 16 bits formats
      case "r16uint":
      case "r16sint":
      case "r16unorm":
      case "r16snorm":
      case "r16float":
      case "rg8unorm":
      case "rg8snorm":
      case "rg8uint":
      case "rg8sint":
        return { width: 1, height: 1, length: 2 };
      // 32 bits formats
      case "r32uint":
      case "r32sint":
      case "r32float":
      case "rg16uint":
      case "rg16sint":
      case "rg16float":
      case "rg16unorm":
      case "rg16snorm":
      case "rgba8unorm":
      case "rgba8unorm-srgb":
      case "rgba8snorm":
      case "rgba8uint":
      case "rgba8sint":
      case "bgra8unorm":
      case "bgra8unorm-srgb":
      case "rgb9e5ufloat":
      case "rgb10a2uint":
      case "rgb10a2unorm":
      case "rg11b10ufloat":
        return { width: 1, height: 1, length: 4 };
      // 64 bits formats
      case "rg32uint":
      case "rg32sint":
      case "rg32float":
      case "rgba16uint":
      case "rgba16sint":
      case "rgba16float":
      case "rgba16unorm":
      case "rgba16snorm":
        return { width: 1, height: 1, length: 8 };
      // 128 bits formats
      case "rgba32uint":
      case "rgba32sint":
      case "rgba32float":
        return { width: 1, height: 1, length: 16 };
      // Depth and stencil formats
      case "stencil8":
        throw "No fixed size for Stencil8 format!";
      case "depth16unorm":
        return { width: 1, height: 1, length: 2 };
      case "depth24plus":
        throw "No fixed size for Depth24Plus format!";
      case "depth24plus-stencil8":
        throw "No fixed size for Depth24PlusStencil8 format!";
      case "depth32float":
        return { width: 1, height: 1, length: 4 };
      case "depth32float-stencil8":
        return { width: 1, height: 1, length: 5 };
      // BC compressed formats usable if "texture-compression-bc" is both
      // supported by the device/user agent and enabled in requestDevice.
      case "bc7-rgba-unorm":
      case "bc7-rgba-unorm-srgb":
      case "bc6h-rgb-ufloat":
      case "bc6h-rgb-float":
      case "bc5-rg-unorm":
      case "bc5-rg-snorm":
      case "bc3-rgba-unorm":
      case "bc3-rgba-unorm-srgb":
      case "bc2-rgba-unorm":
      case "bc2-rgba-unorm-srgb":
        return { width: 4, height: 4, length: 16 };
      case "bc4-r-unorm":
      case "bc4-r-snorm":
      case "bc1-rgba-unorm":
      case "bc1-rgba-unorm-srgb":
        return { width: 4, height: 4, length: 8 };
      // ETC2 compressed formats usable if "texture-compression-etc2" is both
      // supported by the device/user agent and enabled in requestDevice.
      case "etc2-rgb8unorm":
      case "etc2-rgb8unorm-srgb":
      case "etc2-rgb8a1unorm":
      case "etc2-rgb8a1unorm-srgb":
      case "eac-r11unorm":
      case "eac-r11snorm":
        return { width: 4, height: 4, length: 8 };
      case "etc2-rgba8unorm":
      case "etc2-rgba8unorm-srgb":
      case "eac-rg11unorm":
      case "eac-rg11snorm":
        return { width: 4, height: 4, length: 16 };
      // ASTC compressed formats usable if "texture-compression-astc" is both
      // supported by the device/user agent and enabled in requestDevice.
      case "astc-4x4-unorm":
      case "astc-4x4-unorm-srgb":
        return { width: 4, height: 4, length: 16 };
      case "astc-5x4-unorm":
      case "astc-5x4-unorm-srgb":
        return { width: 5, height: 4, length: 16 };
      case "astc-5x5-unorm":
      case "astc-5x5-unorm-srgb":
        return { width: 5, height: 5, length: 16 };
      case "astc-6x5-unorm":
      case "astc-6x5-unorm-srgb":
        return { width: 6, height: 5, length: 16 };
      case "astc-6x6-unorm":
      case "astc-6x6-unorm-srgb":
        return { width: 6, height: 6, length: 16 };
      case "astc-8x5-unorm":
      case "astc-8x5-unorm-srgb":
        return { width: 8, height: 5, length: 16 };
      case "astc-8x6-unorm":
      case "astc-8x6-unorm-srgb":
        return { width: 8, height: 6, length: 16 };
      case "astc-8x8-unorm":
      case "astc-8x8-unorm-srgb":
        return { width: 8, height: 8, length: 16 };
      case "astc-10x5-unorm":
      case "astc-10x5-unorm-srgb":
        return { width: 10, height: 5, length: 16 };
      case "astc-10x6-unorm":
      case "astc-10x6-unorm-srgb":
        return { width: 10, height: 6, length: 16 };
      case "astc-10x8-unorm":
      case "astc-10x8-unorm-srgb":
        return { width: 10, height: 8, length: 16 };
      case "astc-10x10-unorm":
      case "astc-10x10-unorm-srgb":
        return { width: 10, height: 10, length: 16 };
      case "astc-12x10-unorm":
      case "astc-12x10-unorm-srgb":
        return { width: 12, height: 10, length: 16 };
      case "astc-12x12-unorm":
      case "astc-12x12-unorm-srgb":
        return { width: 12, height: 12, length: 16 };
    }
    return { width: 1, height: 1, length: 4 };
  }
  static IsHardwareTexture(texture) {
    return !!texture.release;
  }
  static IsInternalTexture(texture) {
    return !!texture.dispose;
  }
  static IsImageBitmap(imageBitmap) {
    return imageBitmap.close !== void 0;
  }
  static IsImageBitmapArray(imageBitmap) {
    return Array.isArray(imageBitmap) && imageBitmap[0].close !== void 0;
  }
  static IsCompressedFormat(format) {
    switch (format) {
      case "bc7-rgba-unorm-srgb":
      case "bc7-rgba-unorm":
      case "bc6h-rgb-float":
      case "bc6h-rgb-ufloat":
      case "bc5-rg-snorm":
      case "bc5-rg-unorm":
      case "bc4-r-snorm":
      case "bc4-r-unorm":
      case "bc3-rgba-unorm-srgb":
      case "bc3-rgba-unorm":
      case "bc2-rgba-unorm-srgb":
      case "bc2-rgba-unorm":
      case "bc1-rgba-unorm-srgb":
      case "bc1-rgba-unorm":
      case "etc2-rgb8unorm":
      case "etc2-rgb8unorm-srgb":
      case "etc2-rgb8a1unorm":
      case "etc2-rgb8a1unorm-srgb":
      case "etc2-rgba8unorm":
      case "etc2-rgba8unorm-srgb":
      case "eac-r11unorm":
      case "eac-r11snorm":
      case "eac-rg11unorm":
      case "eac-rg11snorm":
      case "astc-4x4-unorm":
      case "astc-4x4-unorm-srgb":
      case "astc-5x4-unorm":
      case "astc-5x4-unorm-srgb":
      case "astc-5x5-unorm":
      case "astc-5x5-unorm-srgb":
      case "astc-6x5-unorm":
      case "astc-6x5-unorm-srgb":
      case "astc-6x6-unorm":
      case "astc-6x6-unorm-srgb":
      case "astc-8x5-unorm":
      case "astc-8x5-unorm-srgb":
      case "astc-8x6-unorm":
      case "astc-8x6-unorm-srgb":
      case "astc-8x8-unorm":
      case "astc-8x8-unorm-srgb":
      case "astc-10x5-unorm":
      case "astc-10x5-unorm-srgb":
      case "astc-10x6-unorm":
      case "astc-10x6-unorm-srgb":
      case "astc-10x8-unorm":
      case "astc-10x8-unorm-srgb":
      case "astc-10x10-unorm":
      case "astc-10x10-unorm-srgb":
      case "astc-12x10-unorm":
      case "astc-12x10-unorm-srgb":
      case "astc-12x12-unorm":
      case "astc-12x12-unorm-srgb":
        return true;
    }
    return false;
  }
  static GetWebGPUTextureFormat(type, format, useSRGBBuffer = false) {
    switch (format) {
      case 15:
        return "depth16unorm";
      case 16:
        return "depth24plus";
      case 13:
        return "depth24plus-stencil8";
      case 14:
        return "depth32float";
      case 18:
        return "depth32float-stencil8";
      case 19:
        return "stencil8";
      case 36492:
        return useSRGBBuffer ? "bc7-rgba-unorm-srgb" : "bc7-rgba-unorm";
      case 36495:
        return "bc6h-rgb-ufloat";
      case 36494:
        return "bc6h-rgb-float";
      case 33779:
        return useSRGBBuffer ? "bc3-rgba-unorm-srgb" : "bc3-rgba-unorm";
      case 33778:
        return useSRGBBuffer ? "bc2-rgba-unorm-srgb" : "bc2-rgba-unorm";
      case 33777:
      case 33776:
        return useSRGBBuffer ? "bc1-rgba-unorm-srgb" : "bc1-rgba-unorm";
      case 37808:
        return useSRGBBuffer ? "astc-4x4-unorm-srgb" : "astc-4x4-unorm";
      case 37809:
        return useSRGBBuffer ? "astc-5x4-unorm-srgb" : "astc-5x4-unorm";
      case 37810:
        return useSRGBBuffer ? "astc-5x5-unorm-srgb" : "astc-5x5-unorm";
      case 37811:
        return useSRGBBuffer ? "astc-6x5-unorm-srgb" : "astc-6x5-unorm";
      case 37812:
        return useSRGBBuffer ? "astc-6x6-unorm-srgb" : "astc-6x6-unorm";
      case 37813:
        return useSRGBBuffer ? "astc-8x5-unorm-srgb" : "astc-8x5-unorm";
      case 37814:
        return useSRGBBuffer ? "astc-8x6-unorm-srgb" : "astc-8x6-unorm";
      case 37815:
        return useSRGBBuffer ? "astc-8x8-unorm-srgb" : "astc-8x8-unorm";
      case 37816:
        return useSRGBBuffer ? "astc-10x5-unorm-srgb" : "astc-10x5-unorm";
      case 37817:
        return useSRGBBuffer ? "astc-10x6-unorm-srgb" : "astc-10x6-unorm";
      case 37818:
        return useSRGBBuffer ? "astc-10x8-unorm-srgb" : "astc-10x8-unorm";
      case 37819:
        return useSRGBBuffer ? "astc-10x10-unorm-srgb" : "astc-10x10-unorm";
      case 37820:
        return useSRGBBuffer ? "astc-12x10-unorm-srgb" : "astc-12x10-unorm";
      case 37821:
        return useSRGBBuffer ? "astc-12x12-unorm-srgb" : "astc-12x12-unorm";
      case 36196:
      case 37492:
        return useSRGBBuffer ? "etc2-rgb8unorm-srgb" : "etc2-rgb8unorm";
      case 37496:
        return useSRGBBuffer ? "etc2-rgba8unorm-srgb" : "etc2-rgba8unorm";
    }
    switch (type) {
      case 3:
        switch (format) {
          case 6:
            return "r8snorm";
          case 7:
            return "rg8snorm";
          case 4:
            throw "RGB format not supported in WebGPU";
          case 8:
            return "r8sint";
          case 9:
            return "rg8sint";
          case 10:
            throw "RGB_INTEGER format not supported in WebGPU";
          case 11:
            return "rgba8sint";
          default:
            return "rgba8snorm";
        }
      case 0:
        switch (format) {
          case 6:
            return "r8unorm";
          case 7:
            return "rg8unorm";
          case 4:
            throw "TEXTUREFORMAT_RGB format not supported in WebGPU";
          case 5:
            return useSRGBBuffer ? "rgba8unorm-srgb" : "rgba8unorm";
          case 12:
            return useSRGBBuffer ? "bgra8unorm-srgb" : "bgra8unorm";
          case 8:
            return "r8uint";
          case 9:
            return "rg8uint";
          case 10:
            throw "RGB_INTEGER format not supported in WebGPU";
          case 11:
            return "rgba8uint";
          case 0:
            throw "TEXTUREFORMAT_ALPHA format not supported in WebGPU";
          case 1:
            throw "TEXTUREFORMAT_LUMINANCE format not supported in WebGPU";
          case 2:
            throw "TEXTUREFORMAT_LUMINANCE_ALPHA format not supported in WebGPU";
          default:
            return "rgba8unorm";
        }
      case 4:
        switch (format) {
          case 8:
            return "r16sint";
          case 9:
            return "rg16sint";
          case 10:
            throw "TEXTUREFORMAT_RGB_INTEGER format not supported in WebGPU";
          case 11:
            return "rgba16sint";
          default:
            return "rgba16sint";
        }
      case 5:
        switch (format) {
          case 8:
            return "r16uint";
          case 9:
            return "rg16uint";
          case 10:
            throw "TEXTUREFORMAT_RGB_INTEGER format not supported in WebGPU";
          case 11:
            return "rgba16uint";
          default:
            return "rgba16uint";
        }
      case 6:
        switch (format) {
          case 8:
            return "r32sint";
          case 9:
            return "rg32sint";
          case 10:
            throw "TEXTUREFORMAT_RGB_INTEGER format not supported in WebGPU";
          case 11:
            return "rgba32sint";
          default:
            return "rgba32sint";
        }
      case 7:
        switch (format) {
          case 8:
            return "r32uint";
          case 9:
            return "rg32uint";
          case 10:
            throw "TEXTUREFORMAT_RGB_INTEGER format not supported in WebGPU";
          case 11:
            return "rgba32uint";
          default:
            return "rgba32uint";
        }
      case 1:
        switch (format) {
          case 6:
            return "r32float";
          // By default. Other possibility is R16Float.
          case 7:
            return "rg32float";
          // By default. Other possibility is RG16Float.
          case 4:
            throw "TEXTUREFORMAT_RGB format not supported in WebGPU";
          case 5:
            return "rgba32float";
          // By default. Other possibility is RGBA16Float.
          default:
            return "rgba32float";
        }
      case 2:
        switch (format) {
          case 6:
            return "r16float";
          case 7:
            return "rg16float";
          case 4:
            throw "TEXTUREFORMAT_RGB format not supported in WebGPU";
          case 5:
            return "rgba16float";
          default:
            return "rgba16float";
        }
      case 10:
        throw "TEXTURETYPE_UNSIGNED_SHORT_5_6_5 format not supported in WebGPU";
      case 13:
        switch (format) {
          case 5:
            return "rg11b10ufloat";
          case 11:
            throw "TEXTUREFORMAT_RGBA_INTEGER format not supported in WebGPU when type is TEXTURETYPE_UNSIGNED_INT_10F_11F_11F_REV";
          default:
            return "rg11b10ufloat";
        }
      case 14:
        switch (format) {
          case 5:
            return "rgb9e5ufloat";
          case 11:
            throw "TEXTUREFORMAT_RGBA_INTEGER format not supported in WebGPU when type is TEXTURETYPE_UNSIGNED_INT_5_9_9_9_REV";
          default:
            return "rgb9e5ufloat";
        }
      case 8:
        throw "TEXTURETYPE_UNSIGNED_SHORT_4_4_4_4 format not supported in WebGPU";
      case 9:
        throw "TEXTURETYPE_UNSIGNED_SHORT_5_5_5_1 format not supported in WebGPU";
      case 11:
        switch (format) {
          case 5:
            return "rgb10a2unorm";
          case 11:
            return "rgb10a2uint";
          default:
            return "rgb10a2unorm";
        }
    }
    return useSRGBBuffer ? "rgba8unorm-srgb" : "rgba8unorm";
  }
  static GetNumChannelsFromWebGPUTextureFormat(format) {
    switch (format) {
      case "r8unorm":
      case "r8snorm":
      case "r8uint":
      case "r8sint":
      case "bc4-r-unorm":
      case "bc4-r-snorm":
      case "r16uint":
      case "r16sint":
      case "depth16unorm":
      case "r16float":
      case "r16unorm":
      case "r16snorm":
      case "r32uint":
      case "r32sint":
      case "r32float":
      case "depth32float":
      case "stencil8":
      case "depth24plus":
      case "eac-r11unorm":
      case "eac-r11snorm":
        return 1;
      case "rg8unorm":
      case "rg8snorm":
      case "rg8uint":
      case "rg8sint":
      case "depth32float-stencil8":
      case "bc5-rg-unorm":
      case "bc5-rg-snorm":
      case "rg16uint":
      case "rg16sint":
      case "rg16float":
      case "rg16unorm":
      case "rg16snorm":
      case "rg32uint":
      case "rg32sint":
      case "rg32float":
      case "depth24plus-stencil8":
      case "eac-rg11unorm":
      case "eac-rg11snorm":
        return 2;
      case "rgb9e5ufloat":
      case "rg11b10ufloat":
      case "bc6h-rgb-ufloat":
      case "bc6h-rgb-float":
      case "etc2-rgb8unorm":
      case "etc2-rgb8unorm-srgb":
        return 3;
      case "rgba8unorm":
      case "rgba8unorm-srgb":
      case "rgba8snorm":
      case "rgba8uint":
      case "rgba8sint":
      case "bgra8unorm":
      case "bgra8unorm-srgb":
      case "rgba16unorm":
      case "rgba16snorm":
      case "rgb10a2uint":
      case "rgb10a2unorm":
      case "bc7-rgba-unorm":
      case "bc7-rgba-unorm-srgb":
      case "bc3-rgba-unorm":
      case "bc3-rgba-unorm-srgb":
      case "bc2-rgba-unorm":
      case "bc2-rgba-unorm-srgb":
      case "bc1-rgba-unorm":
      case "bc1-rgba-unorm-srgb":
      case "rgba16uint":
      case "rgba16sint":
      case "rgba16float":
      case "rgba32uint":
      case "rgba32sint":
      case "rgba32float":
      case "etc2-rgb8a1unorm":
      case "etc2-rgb8a1unorm-srgb":
      case "etc2-rgba8unorm":
      case "etc2-rgba8unorm-srgb":
      case "astc-4x4-unorm":
      case "astc-4x4-unorm-srgb":
      case "astc-5x4-unorm":
      case "astc-5x4-unorm-srgb":
      case "astc-5x5-unorm":
      case "astc-5x5-unorm-srgb":
      case "astc-6x5-unorm":
      case "astc-6x5-unorm-srgb":
      case "astc-6x6-unorm":
      case "astc-6x6-unorm-srgb":
      case "astc-8x5-unorm":
      case "astc-8x5-unorm-srgb":
      case "astc-8x6-unorm":
      case "astc-8x6-unorm-srgb":
      case "astc-8x8-unorm":
      case "astc-8x8-unorm-srgb":
      case "astc-10x5-unorm":
      case "astc-10x5-unorm-srgb":
      case "astc-10x6-unorm":
      case "astc-10x6-unorm-srgb":
      case "astc-10x8-unorm":
      case "astc-10x8-unorm-srgb":
      case "astc-10x10-unorm":
      case "astc-10x10-unorm-srgb":
      case "astc-12x10-unorm":
      case "astc-12x10-unorm-srgb":
      case "astc-12x12-unorm":
      case "astc-12x12-unorm-srgb":
        return 4;
    }
    throw `Unknown format ${format}!`;
  }
  static HasStencilAspect(format) {
    switch (format) {
      case "stencil8":
      case "depth32float-stencil8":
      case "depth24plus-stencil8":
        return true;
    }
    return false;
  }
  static HasDepthAspect(format) {
    switch (format) {
      case "depth16unorm":
      case "depth24plus":
      case "depth24plus-stencil8":
      case "depth32float":
      case "depth32float-stencil8":
        return true;
    }
    return false;
  }
  static HasDepthAndStencilAspects(format) {
    switch (format) {
      case "depth32float-stencil8":
      case "depth24plus-stencil8":
        return true;
    }
    return false;
  }
  static GetDepthFormatOnly(format) {
    switch (format) {
      case "depth16unorm":
        return "depth16unorm";
      case "depth24plus":
        return "depth24plus";
      case "depth24plus-stencil8":
        return "depth24plus";
      case "depth32float":
        return "depth32float";
      case "depth32float-stencil8":
        return "depth32float";
    }
    return format;
  }
  static GetSample(sampleCount) {
    return sampleCount > 1 ? 4 : 1;
  }
}
class WebGPUPerfCounter {
  constructor() {
    this._gpuTimeInFrameId = -1;
    this.counter = new PerfCounter();
  }
  /**
   * @internal
   */
  _addDuration(currentFrameId, duration) {
    if (currentFrameId < this._gpuTimeInFrameId) {
      return;
    }
    if (this._gpuTimeInFrameId !== currentFrameId) {
      this.counter._fetchResult();
      this.counter.fetchNewFrame();
      this.counter.addCount(duration, false);
      this._gpuTimeInFrameId = currentFrameId;
    } else {
      this.counter.addCount(duration, false);
    }
  }
}
class ThinWebGPUEngine extends AbstractEngine {
  constructor() {
    super(...arguments);
    this.dbgShowShaderCode = false;
    this.dbgSanityChecks = true;
    this.dbgLogIfNotDrawWrapper = true;
    this.dbgShowEmptyEnableEffectCalls = true;
    this._occlusionQueryActive = false;
    this._currentRenderPass = null;
    this._snapshotRenderingMode = 0;
    this._timestampIndex = 0;
    this._showGPUDebugMarkersLog = false;
    this._debugMarkersEncoderGroups = [];
    this._debugMarkersPassGroups = [];
    this._debugMarkersPendingEncoderPops = 0;
  }
  /** @internal */
  _getCurrentRenderPass() {
    return this._currentRenderPass;
  }
  /**
   * Enables or disables GPU timing measurements.
   * Note that this is only supported if the "timestamp-query" extension is enabled in the options.
   */
  get enableGPUTimingMeasurements() {
    return this._timestampQuery.enable;
  }
  set enableGPUTimingMeasurements(enable) {
    if (this._timestampQuery.enable === enable) {
      return;
    }
    this.gpuTimeInFrameForMainPass = enable ? new WebGPUPerfCounter() : void 0;
    this._timestampQuery.enable = enable;
  }
  _currentPassIsMainPass() {
    return this._currentRenderTarget === null;
  }
  /** @internal */
  _endCurrentRenderPass() {
    if (!this._currentRenderPass) {
      return 0;
    }
    this._debugPopBeforeEndOfEncoder();
    const currentPassIndex = this._currentPassIsMainPass() ? 2 : 1;
    if (!this._snapshotRendering.endRenderPass(this._currentRenderPass) && !this.compatibilityMode) {
      this._bundleList.run(this._currentRenderPass);
      this._bundleList.reset();
    }
    this._currentRenderPass.end();
    this._timestampQuery.endPass(this._timestampIndex, this._currentRenderTarget && this._currentRenderTarget.gpuTimeInFrame ? this._currentRenderTarget.gpuTimeInFrame : this.gpuTimeInFrameForMainPass);
    this._timestampIndex += 2;
    this._debugPendingPop(this._currentRenderPass);
    this._currentRenderPass = null;
    return currentPassIndex;
  }
  /**
   * @internal
   */
  _generateMipmaps(texture, commandEncoder) {
    commandEncoder = commandEncoder ?? this._renderEncoder;
    const gpuHardwareTexture = texture._hardwareTexture;
    if (!gpuHardwareTexture) {
      return;
    }
    if (commandEncoder === this._renderEncoder) {
      this._endCurrentRenderPass();
    }
    const mipmapCount = WebGPUTextureHelper.ComputeNumMipmapLevels(texture.width, texture.height, texture.is3D ? texture.depth : 1);
    if (texture.isCube) {
      this._textureHelper.generateCubeMipmaps(gpuHardwareTexture, mipmapCount, commandEncoder);
    } else if (texture.is3D) {
      this._textureHelper.generate3DMipmaps(gpuHardwareTexture, gpuHardwareTexture.underlyingResource?.mipLevelCount ?? mipmapCount, commandEncoder);
    } else if (texture._source === 11) {
      for (let layer = 0; layer < texture.depth; ++layer) {
        this._textureHelper.generateMipmaps(gpuHardwareTexture, texture.mipLevelCount, layer, commandEncoder);
      }
    } else if (texture._source === 3) {
      this._textureHelper.generateMipmaps(gpuHardwareTexture, texture.mipLevelCount, 0, commandEncoder);
    } else {
      this._textureHelper.generateMipmaps(gpuHardwareTexture, mipmapCount, 0, commandEncoder);
    }
  }
  _debugPopBeforeEndOfEncoder() {
    if (!this._enableGPUDebugMarkers) {
      return;
    }
    const groups = this._currentRenderPass ? this._debugMarkersPassGroups : this._debugMarkersEncoderGroups;
    const target = this._currentRenderPass ?? this._renderEncoder;
    for (let i = groups.length - 1; i >= 0; --i) {
      if (this._showGPUDebugMarkersLog) {
        Logger.Log(`[${this.frameId}] [E${this._debugMarkersEncoderGroups.length}|P${this._debugMarkersPassGroups.length}] [automatic] Popping debug group '${groups[i]}' on '${target.label}'.`);
      }
      target.popDebugGroup();
    }
  }
  _debugPushAfterStartOfEncoder() {
    if (!this._enableGPUDebugMarkers) {
      return;
    }
    const groups = this._currentRenderPass ? this._debugMarkersPassGroups : this._debugMarkersEncoderGroups;
    const target = this._currentRenderPass ?? this._renderEncoder;
    for (const groupName of groups) {
      if (this._showGPUDebugMarkersLog) {
        Logger.Log(`[${this.frameId}] [E${this._debugMarkersEncoderGroups.length}|P${this._debugMarkersPassGroups.length}] [automatic] Pushing debug group '${groupName}' on '${target.label}'.`);
      }
      target.pushDebugGroup(groupName);
    }
  }
  _debugPendingPop(currentRenderPass) {
    if (!this._enableGPUDebugMarkers) {
      return;
    }
    while (this._debugMarkersPendingEncoderPops-- > 0) {
      const groupName = this._debugMarkersEncoderGroups.pop();
      if (this._showGPUDebugMarkersLog) {
        Logger.Log(`[${this.frameId}] [E${this._debugMarkersEncoderGroups.length}|P${this._debugMarkersPassGroups.length}] [automatic] Popping debug group '${groupName}' on render encoder '${this._renderEncoder.label}' after the end of render pass '${currentRenderPass.label}'.`);
      }
      this._renderEncoder.popDebugGroup();
    }
    this._debugMarkersPendingEncoderPops = 0;
  }
}
var PowerPreference;
(function(PowerPreference2) {
  PowerPreference2["LowPower"] = "low-power";
  PowerPreference2["HighPerformance"] = "high-performance";
})(PowerPreference || (PowerPreference = {}));
var FeatureName;
(function(FeatureName2) {
  FeatureName2["CoreFeaturesAndLimits"] = "core-features-and-limits";
  FeatureName2["DepthClipControl"] = "depth-clip-control";
  FeatureName2["Depth32FloatStencil8"] = "depth32float-stencil8";
  FeatureName2["TextureCompressionBC"] = "texture-compression-bc";
  FeatureName2["TextureCompressionBCSliced3D"] = "texture-compression-bc-sliced-3d";
  FeatureName2["TextureCompressionETC2"] = "texture-compression-etc2";
  FeatureName2["TextureCompressionASTC"] = "texture-compression-astc";
  FeatureName2["TextureCompressionASTCSliced3D"] = "texture-compression-astc-sliced-3d";
  FeatureName2["TimestampQuery"] = "timestamp-query";
  FeatureName2["IndirectFirstInstance"] = "indirect-first-instance";
  FeatureName2["ShaderF16"] = "shader-f16";
  FeatureName2["RG11B10UFloatRenderable"] = "rg11b10ufloat-renderable";
  FeatureName2["BGRA8UnormStorage"] = "bgra8unorm-storage";
  FeatureName2["Float32Filterable"] = "float32-filterable";
  FeatureName2["Float32Blendable"] = "float32-blendable";
  FeatureName2["ClipDistances"] = "clip-distances";
  FeatureName2["DualSourceBlending"] = "dual-source-blending";
  FeatureName2["Subgroups"] = "subgroups";
  FeatureName2["TextureFormatsTier1"] = "texture-formats-tier1";
  FeatureName2["TextureFormatsTier2"] = "texture-formats-tier2";
  FeatureName2["PrimitiveIndex"] = "primitive-index";
  FeatureName2["TextureComponentSwizzle"] = "texture-component-swizzle";
})(FeatureName || (FeatureName = {}));
var BufferMapState;
(function(BufferMapState2) {
  BufferMapState2["Unmapped"] = "unmapped";
  BufferMapState2["Pending"] = "pending";
  BufferMapState2["Mapped"] = "mapped";
})(BufferMapState || (BufferMapState = {}));
var BufferUsage;
(function(BufferUsage2) {
  BufferUsage2[BufferUsage2["MapRead"] = 1] = "MapRead";
  BufferUsage2[BufferUsage2["MapWrite"] = 2] = "MapWrite";
  BufferUsage2[BufferUsage2["CopySrc"] = 4] = "CopySrc";
  BufferUsage2[BufferUsage2["CopyDst"] = 8] = "CopyDst";
  BufferUsage2[BufferUsage2["Index"] = 16] = "Index";
  BufferUsage2[BufferUsage2["Vertex"] = 32] = "Vertex";
  BufferUsage2[BufferUsage2["Uniform"] = 64] = "Uniform";
  BufferUsage2[BufferUsage2["Storage"] = 128] = "Storage";
  BufferUsage2[BufferUsage2["Indirect"] = 256] = "Indirect";
  BufferUsage2[BufferUsage2["QueryResolve"] = 512] = "QueryResolve";
})(BufferUsage || (BufferUsage = {}));
var MapMode;
(function(MapMode2) {
  MapMode2[MapMode2["Read"] = 1] = "Read";
  MapMode2[MapMode2["Write"] = 2] = "Write";
})(MapMode || (MapMode = {}));
var TextureDimension;
(function(TextureDimension2) {
  TextureDimension2["E1d"] = "1d";
  TextureDimension2["E2d"] = "2d";
  TextureDimension2["E3d"] = "3d";
})(TextureDimension || (TextureDimension = {}));
var TextureUsage;
(function(TextureUsage2) {
  TextureUsage2[TextureUsage2["CopySrc"] = 1] = "CopySrc";
  TextureUsage2[TextureUsage2["CopyDst"] = 2] = "CopyDst";
  TextureUsage2[TextureUsage2["TextureBinding"] = 4] = "TextureBinding";
  TextureUsage2[TextureUsage2["StorageBinding"] = 8] = "StorageBinding";
  TextureUsage2[TextureUsage2["RenderAttachment"] = 16] = "RenderAttachment";
  TextureUsage2[TextureUsage2["TransientAttachment"] = 32] = "TransientAttachment";
})(TextureUsage || (TextureUsage = {}));
var TextureViewDimension;
(function(TextureViewDimension2) {
  TextureViewDimension2["E1d"] = "1d";
  TextureViewDimension2["E2d"] = "2d";
  TextureViewDimension2["E2dArray"] = "2d-array";
  TextureViewDimension2["Cube"] = "cube";
  TextureViewDimension2["CubeArray"] = "cube-array";
  TextureViewDimension2["E3d"] = "3d";
})(TextureViewDimension || (TextureViewDimension = {}));
var TextureAspect;
(function(TextureAspect2) {
  TextureAspect2["All"] = "all";
  TextureAspect2["StencilOnly"] = "stencil-only";
  TextureAspect2["DepthOnly"] = "depth-only";
})(TextureAspect || (TextureAspect = {}));
var TextureFormat;
(function(TextureFormat2) {
  TextureFormat2["R8Unorm"] = "r8unorm";
  TextureFormat2["R8Snorm"] = "r8snorm";
  TextureFormat2["R8Uint"] = "r8uint";
  TextureFormat2["R8Sint"] = "r8sint";
  TextureFormat2["R16Uint"] = "r16uint";
  TextureFormat2["R16Sint"] = "r16sint";
  TextureFormat2["R16Float"] = "r16float";
  TextureFormat2["RG8Unorm"] = "rg8unorm";
  TextureFormat2["RG8Snorm"] = "rg8snorm";
  TextureFormat2["RG8Uint"] = "rg8uint";
  TextureFormat2["RG8Sint"] = "rg8sint";
  TextureFormat2["R16Unorm"] = "r16unorm";
  TextureFormat2["R16Snorm"] = "r16snorm";
  TextureFormat2["R32Uint"] = "r32uint";
  TextureFormat2["R32Sint"] = "r32sint";
  TextureFormat2["R32Float"] = "r32float";
  TextureFormat2["RG16Uint"] = "rg16uint";
  TextureFormat2["RG16Sint"] = "rg16sint";
  TextureFormat2["RG16Float"] = "rg16float";
  TextureFormat2["RGBA8Unorm"] = "rgba8unorm";
  TextureFormat2["RGBA8UnormSRGB"] = "rgba8unorm-srgb";
  TextureFormat2["RGBA8Snorm"] = "rgba8snorm";
  TextureFormat2["RGBA8Uint"] = "rgba8uint";
  TextureFormat2["RGBA8Sint"] = "rgba8sint";
  TextureFormat2["BGRA8Unorm"] = "bgra8unorm";
  TextureFormat2["BGRA8UnormSRGB"] = "bgra8unorm-srgb";
  TextureFormat2["RG16Unorm"] = "rg16unorm";
  TextureFormat2["RG16Snorm"] = "rg16snorm";
  TextureFormat2["RGB9E5UFloat"] = "rgb9e5ufloat";
  TextureFormat2["RGB10A2UINT"] = "rgb10a2uint";
  TextureFormat2["RGB10A2Unorm"] = "rgb10a2unorm";
  TextureFormat2["RG11B10UFloat"] = "rg11b10ufloat";
  TextureFormat2["RG32Uint"] = "rg32uint";
  TextureFormat2["RG32Sint"] = "rg32sint";
  TextureFormat2["RG32Float"] = "rg32float";
  TextureFormat2["RGBA16Uint"] = "rgba16uint";
  TextureFormat2["RGBA16Sint"] = "rgba16sint";
  TextureFormat2["RGBA16Float"] = "rgba16float";
  TextureFormat2["RGBA16Unorm"] = "rgba16unorm";
  TextureFormat2["RGBA16Snorm"] = "rgba16snorm";
  TextureFormat2["RGBA32Uint"] = "rgba32uint";
  TextureFormat2["RGBA32Sint"] = "rgba32sint";
  TextureFormat2["RGBA32Float"] = "rgba32float";
  TextureFormat2["Stencil8"] = "stencil8";
  TextureFormat2["Depth16Unorm"] = "depth16unorm";
  TextureFormat2["Depth24Plus"] = "depth24plus";
  TextureFormat2["Depth24PlusStencil8"] = "depth24plus-stencil8";
  TextureFormat2["Depth32Float"] = "depth32float";
  TextureFormat2["BC1RGBAUnorm"] = "bc1-rgba-unorm";
  TextureFormat2["BC1RGBAUnormSRGB"] = "bc1-rgba-unorm-srgb";
  TextureFormat2["BC2RGBAUnorm"] = "bc2-rgba-unorm";
  TextureFormat2["BC2RGBAUnormSRGB"] = "bc2-rgba-unorm-srgb";
  TextureFormat2["BC3RGBAUnorm"] = "bc3-rgba-unorm";
  TextureFormat2["BC3RGBAUnormSRGB"] = "bc3-rgba-unorm-srgb";
  TextureFormat2["BC4RUnorm"] = "bc4-r-unorm";
  TextureFormat2["BC4RSnorm"] = "bc4-r-snorm";
  TextureFormat2["BC5RGUnorm"] = "bc5-rg-unorm";
  TextureFormat2["BC5RGSnorm"] = "bc5-rg-snorm";
  TextureFormat2["BC6HRGBUFloat"] = "bc6h-rgb-ufloat";
  TextureFormat2["BC6HRGBFloat"] = "bc6h-rgb-float";
  TextureFormat2["BC7RGBAUnorm"] = "bc7-rgba-unorm";
  TextureFormat2["BC7RGBAUnormSRGB"] = "bc7-rgba-unorm-srgb";
  TextureFormat2["ETC2RGB8Unorm"] = "etc2-rgb8unorm";
  TextureFormat2["ETC2RGB8UnormSRGB"] = "etc2-rgb8unorm-srgb";
  TextureFormat2["ETC2RGB8A1Unorm"] = "etc2-rgb8a1unorm";
  TextureFormat2["ETC2RGB8A1UnormSRGB"] = "etc2-rgb8a1unorm-srgb";
  TextureFormat2["ETC2RGBA8Unorm"] = "etc2-rgba8unorm";
  TextureFormat2["ETC2RGBA8UnormSRGB"] = "etc2-rgba8unorm-srgb";
  TextureFormat2["EACR11Unorm"] = "eac-r11unorm";
  TextureFormat2["EACR11Snorm"] = "eac-r11snorm";
  TextureFormat2["EACRG11Unorm"] = "eac-rg11unorm";
  TextureFormat2["EACRG11Snorm"] = "eac-rg11snorm";
  TextureFormat2["ASTC4x4Unorm"] = "astc-4x4-unorm";
  TextureFormat2["ASTC4x4UnormSRGB"] = "astc-4x4-unorm-srgb";
  TextureFormat2["ASTC5x4Unorm"] = "astc-5x4-unorm";
  TextureFormat2["ASTC5x4UnormSRGB"] = "astc-5x4-unorm-srgb";
  TextureFormat2["ASTC5x5Unorm"] = "astc-5x5-unorm";
  TextureFormat2["ASTC5x5UnormSRGB"] = "astc-5x5-unorm-srgb";
  TextureFormat2["ASTC6x5Unorm"] = "astc-6x5-unorm";
  TextureFormat2["ASTC6x5UnormSRGB"] = "astc-6x5-unorm-srgb";
  TextureFormat2["ASTC6x6Unorm"] = "astc-6x6-unorm";
  TextureFormat2["ASTC6x6UnormSRGB"] = "astc-6x6-unorm-srgb";
  TextureFormat2["ASTC8x5Unorm"] = "astc-8x5-unorm";
  TextureFormat2["ASTC8x5UnormSRGB"] = "astc-8x5-unorm-srgb";
  TextureFormat2["ASTC8x6Unorm"] = "astc-8x6-unorm";
  TextureFormat2["ASTC8x6UnormSRGB"] = "astc-8x6-unorm-srgb";
  TextureFormat2["ASTC8x8Unorm"] = "astc-8x8-unorm";
  TextureFormat2["ASTC8x8UnormSRGB"] = "astc-8x8-unorm-srgb";
  TextureFormat2["ASTC10x5Unorm"] = "astc-10x5-unorm";
  TextureFormat2["ASTC10x5UnormSRGB"] = "astc-10x5-unorm-srgb";
  TextureFormat2["ASTC10x6Unorm"] = "astc-10x6-unorm";
  TextureFormat2["ASTC10x6UnormSRGB"] = "astc-10x6-unorm-srgb";
  TextureFormat2["ASTC10x8Unorm"] = "astc-10x8-unorm";
  TextureFormat2["ASTC10x8UnormSRGB"] = "astc-10x8-unorm-srgb";
  TextureFormat2["ASTC10x10Unorm"] = "astc-10x10-unorm";
  TextureFormat2["ASTC10x10UnormSRGB"] = "astc-10x10-unorm-srgb";
  TextureFormat2["ASTC12x10Unorm"] = "astc-12x10-unorm";
  TextureFormat2["ASTC12x10UnormSRGB"] = "astc-12x10-unorm-srgb";
  TextureFormat2["ASTC12x12Unorm"] = "astc-12x12-unorm";
  TextureFormat2["ASTC12x12UnormSRGB"] = "astc-12x12-unorm-srgb";
  TextureFormat2["Depth32FloatStencil8"] = "depth32float-stencil8";
})(TextureFormat || (TextureFormat = {}));
var AddressMode;
(function(AddressMode2) {
  AddressMode2["ClampToEdge"] = "clamp-to-edge";
  AddressMode2["Repeat"] = "repeat";
  AddressMode2["MirrorRepeat"] = "mirror-repeat";
})(AddressMode || (AddressMode = {}));
var FilterMode;
(function(FilterMode2) {
  FilterMode2["Nearest"] = "nearest";
  FilterMode2["Linear"] = "linear";
})(FilterMode || (FilterMode = {}));
var MipmapFilterMode;
(function(MipmapFilterMode2) {
  MipmapFilterMode2["Nearest"] = "nearest";
  MipmapFilterMode2["Linear"] = "linear";
})(MipmapFilterMode || (MipmapFilterMode = {}));
var CompareFunction;
(function(CompareFunction2) {
  CompareFunction2["Never"] = "never";
  CompareFunction2["Less"] = "less";
  CompareFunction2["Equal"] = "equal";
  CompareFunction2["LessEqual"] = "less-equal";
  CompareFunction2["Greater"] = "greater";
  CompareFunction2["NotEqual"] = "not-equal";
  CompareFunction2["GreaterEqual"] = "greater-equal";
  CompareFunction2["Always"] = "always";
})(CompareFunction || (CompareFunction = {}));
var ShaderStage;
(function(ShaderStage2) {
  ShaderStage2[ShaderStage2["Vertex"] = 1] = "Vertex";
  ShaderStage2[ShaderStage2["Fragment"] = 2] = "Fragment";
  ShaderStage2[ShaderStage2["Compute"] = 4] = "Compute";
})(ShaderStage || (ShaderStage = {}));
var BufferBindingType;
(function(BufferBindingType2) {
  BufferBindingType2["Uniform"] = "uniform";
  BufferBindingType2["Storage"] = "storage";
  BufferBindingType2["ReadOnlyStorage"] = "read-only-storage";
})(BufferBindingType || (BufferBindingType = {}));
var SamplerBindingType;
(function(SamplerBindingType2) {
  SamplerBindingType2["Filtering"] = "filtering";
  SamplerBindingType2["NonFiltering"] = "non-filtering";
  SamplerBindingType2["Comparison"] = "comparison";
})(SamplerBindingType || (SamplerBindingType = {}));
var TextureSampleType;
(function(TextureSampleType2) {
  TextureSampleType2["Float"] = "float";
  TextureSampleType2["UnfilterableFloat"] = "unfilterable-float";
  TextureSampleType2["Depth"] = "depth";
  TextureSampleType2["Sint"] = "sint";
  TextureSampleType2["Uint"] = "uint";
})(TextureSampleType || (TextureSampleType = {}));
var StorageTextureAccess;
(function(StorageTextureAccess2) {
  StorageTextureAccess2["WriteOnly"] = "write-only";
  StorageTextureAccess2["ReadOnly"] = "read-only";
  StorageTextureAccess2["ReadWrite"] = "read-write";
})(StorageTextureAccess || (StorageTextureAccess = {}));
var CompilationMessageType;
(function(CompilationMessageType2) {
  CompilationMessageType2["Error"] = "error";
  CompilationMessageType2["Warning"] = "warning";
  CompilationMessageType2["Info"] = "info";
})(CompilationMessageType || (CompilationMessageType = {}));
var PipelineErrorReason;
(function(PipelineErrorReason2) {
  PipelineErrorReason2["Validation"] = "validation";
  PipelineErrorReason2["Internal"] = "internal";
})(PipelineErrorReason || (PipelineErrorReason = {}));
var AutoLayoutMode;
(function(AutoLayoutMode2) {
  AutoLayoutMode2["Auto"] = "auto";
})(AutoLayoutMode || (AutoLayoutMode = {}));
var PrimitiveTopology;
(function(PrimitiveTopology2) {
  PrimitiveTopology2["PointList"] = "point-list";
  PrimitiveTopology2["LineList"] = "line-list";
  PrimitiveTopology2["LineStrip"] = "line-strip";
  PrimitiveTopology2["TriangleList"] = "triangle-list";
  PrimitiveTopology2["TriangleStrip"] = "triangle-strip";
})(PrimitiveTopology || (PrimitiveTopology = {}));
var FrontFace;
(function(FrontFace2) {
  FrontFace2["CCW"] = "ccw";
  FrontFace2["CW"] = "cw";
})(FrontFace || (FrontFace = {}));
var CullMode;
(function(CullMode2) {
  CullMode2["None"] = "none";
  CullMode2["Front"] = "front";
  CullMode2["Back"] = "back";
})(CullMode || (CullMode = {}));
var ColorWrite;
(function(ColorWrite2) {
  ColorWrite2[ColorWrite2["Red"] = 1] = "Red";
  ColorWrite2[ColorWrite2["Green"] = 2] = "Green";
  ColorWrite2[ColorWrite2["Blue"] = 4] = "Blue";
  ColorWrite2[ColorWrite2["Alpha"] = 8] = "Alpha";
  ColorWrite2[ColorWrite2["All"] = 15] = "All";
})(ColorWrite || (ColorWrite = {}));
var BlendFactor;
(function(BlendFactor2) {
  BlendFactor2["Zero"] = "zero";
  BlendFactor2["One"] = "one";
  BlendFactor2["Src"] = "src";
  BlendFactor2["OneMinusSrc"] = "one-minus-src";
  BlendFactor2["SrcAlpha"] = "src-alpha";
  BlendFactor2["OneMinusSrcAlpha"] = "one-minus-src-alpha";
  BlendFactor2["Dst"] = "dst";
  BlendFactor2["OneMinusDst"] = "one-minus-dst";
  BlendFactor2["DstAlpha"] = "dst-alpha";
  BlendFactor2["OneMinusDstAlpha"] = "one-minus-dst-alpha";
  BlendFactor2["SrcAlphaSaturated"] = "src-alpha-saturated";
  BlendFactor2["Constant"] = "constant";
  BlendFactor2["OneMinusConstant"] = "one-minus-constant";
  BlendFactor2["Src1"] = "src1";
  BlendFactor2["OneMinusSrc1"] = "one-minus-src1";
  BlendFactor2["Src1Alpha"] = "src1-alpha";
  BlendFactor2["OneMinusSrc1Alpha"] = "one-minus-src1-alpha";
})(BlendFactor || (BlendFactor = {}));
var BlendOperation;
(function(BlendOperation2) {
  BlendOperation2["Add"] = "add";
  BlendOperation2["Subtract"] = "subtract";
  BlendOperation2["ReverseSubtract"] = "reverse-subtract";
  BlendOperation2["Min"] = "min";
  BlendOperation2["Max"] = "max";
})(BlendOperation || (BlendOperation = {}));
var StencilOperation;
(function(StencilOperation2) {
  StencilOperation2["Keep"] = "keep";
  StencilOperation2["Zero"] = "zero";
  StencilOperation2["Replace"] = "replace";
  StencilOperation2["Invert"] = "invert";
  StencilOperation2["IncrementClamp"] = "increment-clamp";
  StencilOperation2["DecrementClamp"] = "decrement-clamp";
  StencilOperation2["IncrementWrap"] = "increment-wrap";
  StencilOperation2["DecrementWrap"] = "decrement-wrap";
})(StencilOperation || (StencilOperation = {}));
var IndexFormat;
(function(IndexFormat2) {
  IndexFormat2["Uint16"] = "uint16";
  IndexFormat2["Uint32"] = "uint32";
})(IndexFormat || (IndexFormat = {}));
var VertexFormat;
(function(VertexFormat2) {
  VertexFormat2["Uint8"] = "uint8";
  VertexFormat2["Uint8x2"] = "uint8x2";
  VertexFormat2["Uint8x4"] = "uint8x4";
  VertexFormat2["Sint8"] = "sint8";
  VertexFormat2["Sint8x2"] = "sint8x2";
  VertexFormat2["Sint8x4"] = "sint8x4";
  VertexFormat2["Unorm8"] = "unorm8";
  VertexFormat2["Unorm8x2"] = "unorm8x2";
  VertexFormat2["Unorm8x4"] = "unorm8x4";
  VertexFormat2["Snorm8"] = "snorm8";
  VertexFormat2["Snorm8x2"] = "snorm8x2";
  VertexFormat2["Snorm8x4"] = "snorm8x4";
  VertexFormat2["Uint16"] = "uint16";
  VertexFormat2["Uint16x2"] = "uint16x2";
  VertexFormat2["Uint16x4"] = "uint16x4";
  VertexFormat2["Sint16"] = "sint16";
  VertexFormat2["Sint16x2"] = "sint16x2";
  VertexFormat2["Sint16x4"] = "sint16x4";
  VertexFormat2["Unorm16"] = "unorm16";
  VertexFormat2["Unorm16x2"] = "unorm16x2";
  VertexFormat2["Unorm16x4"] = "unorm16x4";
  VertexFormat2["Snorm16"] = "snorm16";
  VertexFormat2["Snorm16x2"] = "snorm16x2";
  VertexFormat2["Snorm16x4"] = "snorm16x4";
  VertexFormat2["Float16"] = "float16";
  VertexFormat2["Float16x2"] = "float16x2";
  VertexFormat2["Float16x4"] = "float16x4";
  VertexFormat2["Float32"] = "float32";
  VertexFormat2["Float32x2"] = "float32x2";
  VertexFormat2["Float32x3"] = "float32x3";
  VertexFormat2["Float32x4"] = "float32x4";
  VertexFormat2["Uint32"] = "uint32";
  VertexFormat2["Uint32x2"] = "uint32x2";
  VertexFormat2["Uint32x3"] = "uint32x3";
  VertexFormat2["Uint32x4"] = "uint32x4";
  VertexFormat2["Sint32"] = "sint32";
  VertexFormat2["Sint32x2"] = "sint32x2";
  VertexFormat2["Sint32x3"] = "sint32x3";
  VertexFormat2["Sint32x4"] = "sint32x4";
  VertexFormat2["UNORM10x10x10x2"] = "unorm10-10-10-2";
  VertexFormat2["UNORM8x4BGRA"] = "unorm8x4-bgra";
})(VertexFormat || (VertexFormat = {}));
var VertexStepMode;
(function(VertexStepMode2) {
  VertexStepMode2["Vertex"] = "vertex";
  VertexStepMode2["Instance"] = "instance";
})(VertexStepMode || (VertexStepMode = {}));
var ComputePassTimestampLocation;
(function(ComputePassTimestampLocation2) {
  ComputePassTimestampLocation2["Beginning"] = "beginning";
  ComputePassTimestampLocation2["End"] = "end";
})(ComputePassTimestampLocation || (ComputePassTimestampLocation = {}));
var RenderPassTimestampLocation;
(function(RenderPassTimestampLocation2) {
  RenderPassTimestampLocation2["Beginning"] = "beginning";
  RenderPassTimestampLocation2["End"] = "end";
})(RenderPassTimestampLocation || (RenderPassTimestampLocation = {}));
var LoadOp;
(function(LoadOp2) {
  LoadOp2["Load"] = "load";
  LoadOp2["Clear"] = "clear";
})(LoadOp || (LoadOp = {}));
var StoreOp;
(function(StoreOp2) {
  StoreOp2["Store"] = "store";
  StoreOp2["Discard"] = "discard";
})(StoreOp || (StoreOp = {}));
var QueryType;
(function(QueryType2) {
  QueryType2["Occlusion"] = "occlusion";
  QueryType2["Timestamp"] = "timestamp";
})(QueryType || (QueryType = {}));
var CanvasAlphaMode;
(function(CanvasAlphaMode2) {
  CanvasAlphaMode2["Opaque"] = "opaque";
  CanvasAlphaMode2["Premultiplied"] = "premultiplied";
})(CanvasAlphaMode || (CanvasAlphaMode = {}));
var CanvasToneMappingMode;
(function(CanvasToneMappingMode2) {
  CanvasToneMappingMode2["Standard"] = "standard";
  CanvasToneMappingMode2["Extended"] = "extended";
})(CanvasToneMappingMode || (CanvasToneMappingMode = {}));
var DeviceLostReason;
(function(DeviceLostReason2) {
  DeviceLostReason2["Unknown"] = "unknown";
  DeviceLostReason2["Destroyed"] = "destroyed";
})(DeviceLostReason || (DeviceLostReason = {}));
var ErrorFilter;
(function(ErrorFilter2) {
  ErrorFilter2["Validation"] = "validation";
  ErrorFilter2["OutOfMemory"] = "out-of-memory";
  ErrorFilter2["Internal"] = "internal";
})(ErrorFilter || (ErrorFilter = {}));
class WebGPUShaderProcessor {
  constructor() {
    this.shaderLanguage = 0;
  }
  _addUniformToLeftOverUBO(name2, uniformType, preProcessors) {
    let length;
    [name2, uniformType, length] = this._getArraySize(name2, uniformType, preProcessors);
    for (let i = 0; i < this._webgpuProcessingContext.leftOverUniforms.length; i++) {
      if (this._webgpuProcessingContext.leftOverUniforms[i].name === name2) {
        return;
      }
    }
    this._webgpuProcessingContext.leftOverUniforms.push({
      name: name2,
      type: uniformType,
      length
    });
  }
  _buildLeftOverUBO() {
    if (!this._webgpuProcessingContext.leftOverUniforms.length) {
      return "";
    }
    const name2 = WebGPUShaderProcessor.LeftOvertUBOName;
    let availableUBO = this._webgpuProcessingContext.availableBuffers[name2];
    if (!availableUBO) {
      availableUBO = {
        binding: this._webgpuProcessingContext.getNextFreeUBOBinding()
      };
      this._webgpuProcessingContext.availableBuffers[name2] = availableUBO;
      this._addBufferBindingDescription(name2, availableUBO, "uniform", true);
      this._addBufferBindingDescription(name2, availableUBO, "uniform", false);
    }
    return this._generateLeftOverUBOCode(name2, availableUBO);
  }
  _collectBindingNames() {
    for (let i = 0; i < this._webgpuProcessingContext.bindGroupLayoutEntries.length; i++) {
      const setDefinition = this._webgpuProcessingContext.bindGroupLayoutEntries[i];
      if (setDefinition === void 0) {
        this._webgpuProcessingContext.bindGroupLayoutEntries[i] = [];
        continue;
      }
      for (let j = 0; j < setDefinition.length; j++) {
        const entry = this._webgpuProcessingContext.bindGroupLayoutEntries[i][j];
        const name2 = this._webgpuProcessingContext.bindGroupLayoutEntryInfo[i][entry.binding].name;
        const nameInArrayOfTexture = this._webgpuProcessingContext.bindGroupLayoutEntryInfo[i][entry.binding].nameInArrayOfTexture;
        if (entry) {
          if (entry.texture || entry.externalTexture || entry.storageTexture) {
            this._webgpuProcessingContext.textureNames.push(nameInArrayOfTexture);
          } else if (entry.sampler) {
            this._webgpuProcessingContext.samplerNames.push(name2);
          } else if (entry.buffer) {
            this._webgpuProcessingContext.bufferNames.push(name2);
          }
        }
      }
    }
  }
  _preCreateBindGroupEntries() {
    const bindGroupEntries = this._webgpuProcessingContext.bindGroupEntries;
    for (let i = 0; i < this._webgpuProcessingContext.bindGroupLayoutEntries.length; i++) {
      const setDefinition = this._webgpuProcessingContext.bindGroupLayoutEntries[i];
      const entries = [];
      for (let j = 0; j < setDefinition.length; j++) {
        const entry = this._webgpuProcessingContext.bindGroupLayoutEntries[i][j];
        if (entry.sampler || entry.texture || entry.storageTexture || entry.externalTexture) {
          entries.push({
            binding: entry.binding,
            resource: void 0
          });
        } else if (entry.buffer) {
          entries.push({
            binding: entry.binding,
            resource: {
              buffer: void 0,
              offset: 0,
              size: 0
            }
          });
        }
      }
      bindGroupEntries[i] = entries;
    }
  }
  _addTextureBindingDescription(name2, textureInfo, textureIndex, dimension, format, isVertex, storageTextureAccess = "write-only") {
    let { groupIndex, bindingIndex } = textureInfo.textures[textureIndex];
    if (!this._webgpuProcessingContext.bindGroupLayoutEntries[groupIndex]) {
      this._webgpuProcessingContext.bindGroupLayoutEntries[groupIndex] = [];
      this._webgpuProcessingContext.bindGroupLayoutEntryInfo[groupIndex] = [];
    }
    if (!this._webgpuProcessingContext.bindGroupLayoutEntryInfo[groupIndex][bindingIndex]) {
      let len;
      if (dimension === null) {
        len = this._webgpuProcessingContext.bindGroupLayoutEntries[groupIndex].push({
          binding: bindingIndex,
          visibility: 0,
          externalTexture: {}
        });
      } else if (format) {
        len = this._webgpuProcessingContext.bindGroupLayoutEntries[groupIndex].push({
          binding: bindingIndex,
          visibility: 0,
          storageTexture: {
            access: storageTextureAccess,
            format,
            viewDimension: dimension
          }
        });
      } else {
        len = this._webgpuProcessingContext.bindGroupLayoutEntries[groupIndex].push({
          binding: bindingIndex,
          visibility: 0,
          texture: {
            sampleType: textureInfo.sampleType,
            viewDimension: dimension,
            multisampled: false
          }
        });
      }
      const textureName = textureInfo.isTextureArray ? name2 + textureIndex : name2;
      this._webgpuProcessingContext.bindGroupLayoutEntryInfo[groupIndex][bindingIndex] = { name: name2, index: len - 1, nameInArrayOfTexture: textureName };
    }
    bindingIndex = this._webgpuProcessingContext.bindGroupLayoutEntryInfo[groupIndex][bindingIndex].index;
    if (isVertex) {
      this._webgpuProcessingContext.bindGroupLayoutEntries[groupIndex][bindingIndex].visibility |= 1;
    } else {
      this._webgpuProcessingContext.bindGroupLayoutEntries[groupIndex][bindingIndex].visibility |= 2;
    }
  }
  _addSamplerBindingDescription(name2, samplerInfo, isVertex) {
    let { groupIndex, bindingIndex } = samplerInfo.binding;
    if (!this._webgpuProcessingContext.bindGroupLayoutEntries[groupIndex]) {
      this._webgpuProcessingContext.bindGroupLayoutEntries[groupIndex] = [];
      this._webgpuProcessingContext.bindGroupLayoutEntryInfo[groupIndex] = [];
    }
    if (!this._webgpuProcessingContext.bindGroupLayoutEntryInfo[groupIndex][bindingIndex]) {
      const len = this._webgpuProcessingContext.bindGroupLayoutEntries[groupIndex].push({
        binding: bindingIndex,
        visibility: 0,
        sampler: {
          type: samplerInfo.type
        }
      });
      this._webgpuProcessingContext.bindGroupLayoutEntryInfo[groupIndex][bindingIndex] = { name: name2, index: len - 1 };
    }
    bindingIndex = this._webgpuProcessingContext.bindGroupLayoutEntryInfo[groupIndex][bindingIndex].index;
    if (isVertex) {
      this._webgpuProcessingContext.bindGroupLayoutEntries[groupIndex][bindingIndex].visibility |= 1;
    } else {
      this._webgpuProcessingContext.bindGroupLayoutEntries[groupIndex][bindingIndex].visibility |= 2;
    }
  }
  _addBufferBindingDescription(name2, uniformBufferInfo, bufferType, isVertex) {
    let { groupIndex, bindingIndex } = uniformBufferInfo.binding;
    if (!this._webgpuProcessingContext.bindGroupLayoutEntries[groupIndex]) {
      this._webgpuProcessingContext.bindGroupLayoutEntries[groupIndex] = [];
      this._webgpuProcessingContext.bindGroupLayoutEntryInfo[groupIndex] = [];
    }
    if (!this._webgpuProcessingContext.bindGroupLayoutEntryInfo[groupIndex][bindingIndex]) {
      const len = this._webgpuProcessingContext.bindGroupLayoutEntries[groupIndex].push({
        binding: bindingIndex,
        visibility: 0,
        buffer: {
          type: bufferType
        }
      });
      this._webgpuProcessingContext.bindGroupLayoutEntryInfo[groupIndex][bindingIndex] = { name: name2, index: len - 1 };
    }
    bindingIndex = this._webgpuProcessingContext.bindGroupLayoutEntryInfo[groupIndex][bindingIndex].index;
    if (isVertex) {
      this._webgpuProcessingContext.bindGroupLayoutEntries[groupIndex][bindingIndex].visibility |= 1;
    } else {
      this._webgpuProcessingContext.bindGroupLayoutEntries[groupIndex][bindingIndex].visibility |= 2;
    }
  }
}
WebGPUShaderProcessor.LeftOvertUBOName = "LeftOver";
WebGPUShaderProcessor.InternalsUBOName = "Internals";
WebGPUShaderProcessor.UniformSizes = {
  // GLSL types
  bool: 1,
  int: 1,
  float: 1,
  vec2: 2,
  ivec2: 2,
  uvec2: 2,
  vec3: 3,
  ivec3: 3,
  uvec3: 3,
  vec4: 4,
  ivec4: 4,
  uvec4: 4,
  mat2: 4,
  mat3: 12,
  mat4: 16,
  // WGSL types
  i32: 1,
  u32: 1,
  f32: 1,
  mat2x2: 4,
  mat3x3: 12,
  mat4x4: 16,
  mat2x2f: 4,
  mat3x3f: 12,
  mat4x4f: 16,
  vec2i: 2,
  vec3i: 3,
  vec4i: 4,
  vec2u: 2,
  vec3u: 3,
  vec4u: 4,
  vec2f: 2,
  vec3f: 3,
  vec4f: 4,
  vec2h: 1,
  vec3h: 2,
  vec4h: 2
};
WebGPUShaderProcessor._SamplerFunctionByWebGLSamplerType = {
  sampler2D: "sampler2D",
  sampler2DArray: "sampler2DArray",
  sampler2DShadow: "sampler2DShadow",
  sampler2DArrayShadow: "sampler2DArrayShadow",
  samplerCube: "samplerCube",
  sampler3D: "sampler3D"
};
WebGPUShaderProcessor._TextureTypeByWebGLSamplerType = {
  sampler2D: "texture2D",
  sampler2DArray: "texture2DArray",
  sampler2DShadow: "texture2D",
  sampler2DArrayShadow: "texture2DArray",
  samplerCube: "textureCube",
  samplerCubeArray: "textureCubeArray",
  sampler3D: "texture3D"
};
WebGPUShaderProcessor._GpuTextureViewDimensionByWebGPUTextureType = {
  textureCube: "cube",
  textureCubeArray: "cube-array",
  texture2D: "2d",
  texture2DArray: "2d-array",
  texture3D: "3d"
};
WebGPUShaderProcessor._SamplerTypeByWebGLSamplerType = {
  sampler2DShadow: "samplerShadow",
  sampler2DArrayShadow: "samplerShadow"
};
WebGPUShaderProcessor._IsComparisonSamplerByWebGPUSamplerType = {
  samplerShadow: true,
  samplerArrayShadow: true,
  sampler: false
};
class WebGPUPipelineContext {
  // eslint-disable-next-line no-restricted-syntax
  get isAsync() {
    return false;
  }
  get isReady() {
    if (this.stages) {
      return true;
    }
    return false;
  }
  constructor(shaderProcessingContext, engine) {
    this.bindGroupLayouts = {};
    this._name = "unnamed";
    this.shaderProcessingContext = shaderProcessingContext;
    this._leftOverUniformsByName = {};
    this.engine = engine;
    this.vertexBufferKindToType = {};
  }
  _handlesSpectorRebuildCallback() {
  }
  _fillEffectInformation(effect, uniformBuffersNames, uniformsNames, uniforms, samplerList, samplers, attributesNames, attributes) {
    const engine = this.engine;
    if (engine._doNotHandleContextLost) {
      effect._fragmentSourceCode = "";
      effect._vertexSourceCode = "";
    }
    const foundSamplers = this.shaderProcessingContext.availableTextures;
    let index;
    for (index = 0; index < samplerList.length; index++) {
      const name2 = samplerList[index];
      const sampler = foundSamplers[samplerList[index]];
      if (sampler == null || sampler == void 0) {
        samplerList.splice(index, 1);
        index--;
      } else {
        samplers[name2] = index;
      }
    }
    for (const attr of engine.getAttributes(this, attributesNames)) {
      attributes.push(attr);
    }
    this.buildUniformLayout();
    const attributeNamesFromEffect = [];
    const attributeLocationsFromEffect = [];
    for (index = 0; index < attributesNames.length; index++) {
      const location = attributes[index];
      if (location >= 0) {
        attributeNamesFromEffect.push(attributesNames[index]);
        attributeLocationsFromEffect.push(location);
      }
    }
    this.shaderProcessingContext.attributeNamesFromEffect = attributeNamesFromEffect;
    this.shaderProcessingContext.attributeLocationsFromEffect = attributeLocationsFromEffect;
  }
  /** @internal */
  /**
   * Build the uniform buffer used in the material.
   */
  buildUniformLayout() {
    if (!this.shaderProcessingContext.leftOverUniforms.length) {
      return;
    }
    this.uniformBuffer?.dispose();
    this.uniformBuffer = new UniformBuffer(this.engine, void 0, void 0, "leftOver-" + this._name);
    for (const leftOverUniform of this.shaderProcessingContext.leftOverUniforms) {
      const type = leftOverUniform.type.replace(/^(.*?)(<.*>)?$/, "$1");
      const size = WebGPUShaderProcessor.UniformSizes[type];
      this.uniformBuffer.addUniform(leftOverUniform.name, size, leftOverUniform.length);
      this._leftOverUniformsByName[leftOverUniform.name] = leftOverUniform.type;
    }
    this.uniformBuffer.create();
  }
  setEngine(engine) {
    this.engine = engine;
  }
  /**
   * Release all associated resources.
   **/
  dispose() {
    if (this.uniformBuffer) {
      this.uniformBuffer.dispose();
    }
  }
  /**
   * Sets an integer value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param value Value to be set.
   */
  setInt(uniformName, value) {
    if (!this.uniformBuffer || !this._leftOverUniformsByName[uniformName]) {
      return;
    }
    this.uniformBuffer.updateInt(uniformName, value);
  }
  /**
   * Sets an int2 value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First int in int2.
   * @param y Second int in int2.
   */
  setInt2(uniformName, x, y) {
    if (!this.uniformBuffer || !this._leftOverUniformsByName[uniformName]) {
      return;
    }
    this.uniformBuffer.updateInt2(uniformName, x, y);
  }
  /**
   * Sets an int3 value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First int in int3.
   * @param y Second int in int3.
   * @param z Third int in int3.
   */
  setInt3(uniformName, x, y, z) {
    if (!this.uniformBuffer || !this._leftOverUniformsByName[uniformName]) {
      return;
    }
    this.uniformBuffer.updateInt3(uniformName, x, y, z);
  }
  /**
   * Sets an int4 value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First int in int4.
   * @param y Second int in int4.
   * @param z Third int in int4.
   * @param w Fourth int in int4.
   */
  setInt4(uniformName, x, y, z, w) {
    if (!this.uniformBuffer || !this._leftOverUniformsByName[uniformName]) {
      return;
    }
    this.uniformBuffer.updateInt4(uniformName, x, y, z, w);
  }
  /**
   * Sets an int array on a uniform variable.
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setIntArray(uniformName, array) {
    if (!this.uniformBuffer || !this._leftOverUniformsByName[uniformName]) {
      return;
    }
    this.uniformBuffer.updateIntArray(uniformName, array);
  }
  /**
   * Sets an int array 2 on a uniform variable. (Array is specified as single array eg. [1,2,3,4] will result in [[1,2],[3,4]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setIntArray2(uniformName, array) {
    this.setIntArray(uniformName, array);
  }
  /**
   * Sets an int array 3 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6] will result in [[1,2,3],[4,5,6]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setIntArray3(uniformName, array) {
    this.setIntArray(uniformName, array);
  }
  /**
   * Sets an int array 4 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6,7,8] will result in [[1,2,3,4],[5,6,7,8]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setIntArray4(uniformName, array) {
    this.setIntArray(uniformName, array);
  }
  /**
   * Sets an unsigned integer value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param value Value to be set.
   */
  setUInt(uniformName, value) {
    if (!this.uniformBuffer || !this._leftOverUniformsByName[uniformName]) {
      return;
    }
    this.uniformBuffer.updateUInt(uniformName, value);
  }
  /**
   * Sets an unsigned int2 value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First unsigned int in uint2.
   * @param y Second unsigned int in uint2.
   */
  setUInt2(uniformName, x, y) {
    if (!this.uniformBuffer || !this._leftOverUniformsByName[uniformName]) {
      return;
    }
    this.uniformBuffer.updateUInt2(uniformName, x, y);
  }
  /**
   * Sets an unsigned int3 value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First unsigned int in uint3.
   * @param y Second unsigned int in uint3.
   * @param z Third unsigned int in uint3.
   */
  setUInt3(uniformName, x, y, z) {
    if (!this.uniformBuffer || !this._leftOverUniformsByName[uniformName]) {
      return;
    }
    this.uniformBuffer.updateUInt3(uniformName, x, y, z);
  }
  /**
   * Sets an unsigned int4 value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First unsigned int in uint4.
   * @param y Second unsigned int in uint4.
   * @param z Third unsigned int in uint4.
   * @param w Fourth unsigned int in uint4.
   */
  setUInt4(uniformName, x, y, z, w) {
    if (!this.uniformBuffer || !this._leftOverUniformsByName[uniformName]) {
      return;
    }
    this.uniformBuffer.updateUInt4(uniformName, x, y, z, w);
  }
  /**
   * Sets an unsigned int array on a uniform variable.
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setUIntArray(uniformName, array) {
    if (!this.uniformBuffer || !this._leftOverUniformsByName[uniformName]) {
      return;
    }
    this.uniformBuffer.updateUIntArray(uniformName, array);
  }
  /**
   * Sets an unsigned int array 2 on a uniform variable. (Array is specified as single array eg. [1,2,3,4] will result in [[1,2],[3,4]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setUIntArray2(uniformName, array) {
    this.setUIntArray(uniformName, array);
  }
  /**
   * Sets an unsigned int array 3 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6] will result in [[1,2,3],[4,5,6]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setUIntArray3(uniformName, array) {
    this.setUIntArray(uniformName, array);
  }
  /**
   * Sets an unsigned int array 4 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6,7,8] will result in [[1,2,3,4],[5,6,7,8]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setUIntArray4(uniformName, array) {
    this.setUIntArray(uniformName, array);
  }
  /**
   * Sets an array on a uniform variable.
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setArray(uniformName, array) {
    if (!this.uniformBuffer || !this._leftOverUniformsByName[uniformName]) {
      return;
    }
    this.uniformBuffer.updateArray(uniformName, array);
  }
  /**
   * Sets an array 2 on a uniform variable. (Array is specified as single array eg. [1,2,3,4] will result in [[1,2],[3,4]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setArray2(uniformName, array) {
    this.setArray(uniformName, array);
  }
  /**
   * Sets an array 3 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6] will result in [[1,2,3],[4,5,6]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setArray3(uniformName, array) {
    this.setArray(uniformName, array);
  }
  /**
   * Sets an array 4 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6,7,8] will result in [[1,2,3,4],[5,6,7,8]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setArray4(uniformName, array) {
    this.setArray(uniformName, array);
  }
  /**
   * Sets matrices on a uniform variable.
   * @param uniformName Name of the variable.
   * @param matrices matrices to be set.
   */
  setMatrices(uniformName, matrices) {
    if (!this.uniformBuffer || !this._leftOverUniformsByName[uniformName]) {
      return;
    }
    this.uniformBuffer.updateMatrices(uniformName, matrices);
  }
  /**
   * Sets matrix on a uniform variable.
   * @param uniformName Name of the variable.
   * @param matrix matrix to be set.
   */
  setMatrix(uniformName, matrix) {
    if (!this.uniformBuffer || !this._leftOverUniformsByName[uniformName]) {
      return;
    }
    this.uniformBuffer.updateMatrix(uniformName, matrix);
  }
  /**
   * Sets a 3x3 matrix on a uniform variable. (Specified as [1,2,3,4,5,6,7,8,9] will result in [1,2,3][4,5,6][7,8,9] matrix)
   * @param uniformName Name of the variable.
   * @param matrix matrix to be set.
   */
  setMatrix3x3(uniformName, matrix) {
    if (!this.uniformBuffer || !this._leftOverUniformsByName[uniformName]) {
      return;
    }
    this.uniformBuffer.updateMatrix3x3(uniformName, matrix);
  }
  /**
   * Sets a 2x2 matrix on a uniform variable. (Specified as [1,2,3,4] will result in [1,2][3,4] matrix)
   * @param uniformName Name of the variable.
   * @param matrix matrix to be set.
   */
  setMatrix2x2(uniformName, matrix) {
    if (!this.uniformBuffer || !this._leftOverUniformsByName[uniformName]) {
      return;
    }
    this.uniformBuffer.updateMatrix2x2(uniformName, matrix);
  }
  /**
   * Sets a float on a uniform variable.
   * @param uniformName Name of the variable.
   * @param value value to be set.
   */
  setFloat(uniformName, value) {
    if (!this.uniformBuffer || !this._leftOverUniformsByName[uniformName]) {
      return;
    }
    this.uniformBuffer.updateFloat(uniformName, value);
  }
  /**
   * Sets a Vector2 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param vector2 vector2 to be set.
   */
  setVector2(uniformName, vector2) {
    this.setFloat2(uniformName, vector2.x, vector2.y);
  }
  /**
   * Sets a float2 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First float in float2.
   * @param y Second float in float2.
   */
  setFloat2(uniformName, x, y) {
    if (!this.uniformBuffer || !this._leftOverUniformsByName[uniformName]) {
      return;
    }
    this.uniformBuffer.updateFloat2(uniformName, x, y);
  }
  /**
   * Sets a Vector3 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param vector3 Value to be set.
   */
  setVector3(uniformName, vector3) {
    this.setFloat3(uniformName, vector3.x, vector3.y, vector3.z);
  }
  /**
   * Sets a float3 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First float in float3.
   * @param y Second float in float3.
   * @param z Third float in float3.
   */
  setFloat3(uniformName, x, y, z) {
    if (!this.uniformBuffer || !this._leftOverUniformsByName[uniformName]) {
      return;
    }
    this.uniformBuffer.updateFloat3(uniformName, x, y, z);
  }
  /**
   * Sets a Vector4 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param vector4 Value to be set.
   */
  setVector4(uniformName, vector4) {
    this.setFloat4(uniformName, vector4.x, vector4.y, vector4.z, vector4.w);
  }
  /**
   * Sets a Quaternion on a uniform variable.
   * @param uniformName Name of the variable.
   * @param quaternion Value to be set.
   */
  setQuaternion(uniformName, quaternion) {
    this.setFloat4(uniformName, quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  }
  /**
   * Sets a float4 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First float in float4.
   * @param y Second float in float4.
   * @param z Third float in float4.
   * @param w Fourth float in float4.
   */
  setFloat4(uniformName, x, y, z, w) {
    if (!this.uniformBuffer || !this._leftOverUniformsByName[uniformName]) {
      return;
    }
    this.uniformBuffer.updateFloat4(uniformName, x, y, z, w);
  }
  /**
   * Sets a Color3 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param color3 Value to be set.
   */
  setColor3(uniformName, color3) {
    this.setFloat3(uniformName, color3.r, color3.g, color3.b);
  }
  /**
   * Sets a Color4 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param color3 Value to be set.
   * @param alpha Alpha value to be set.
   */
  setColor4(uniformName, color3, alpha) {
    this.setFloat4(uniformName, color3.r, color3.g, color3.b, alpha);
  }
  /**
   * Sets a Color4 on a uniform variable
   * @param uniformName defines the name of the variable
   * @param color4 defines the value to be set
   */
  setDirectColor4(uniformName, color4) {
    this.setFloat4(uniformName, color4.r, color4.g, color4.b, color4.a);
  }
  _getVertexShaderCode() {
    return this.sources?.vertex;
  }
  _getFragmentShaderCode() {
    return this.sources?.fragment;
  }
}
const MaxGroups = 4;
const MaxBindingsPerGroup = 1 << 16;
const TypeToLocationSize = {
  // GLSL types
  mat2: 2,
  mat3: 3,
  mat4: 4,
  // WGSL types
  mat2x2: 2,
  mat3x3: 3,
  mat4x4: 4
};
class WebGPUShaderProcessingContext {
  static get KnownUBOs() {
    return WebGPUShaderProcessingContext._SimplifiedKnownBindings ? WebGPUShaderProcessingContext._SimplifiedKnownUBOs : WebGPUShaderProcessingContext._KnownUBOs;
  }
  constructor(shaderLanguage, pureMode = false) {
    this.vertexBufferKindToNumberOfComponents = {};
    this.shaderLanguage = shaderLanguage;
    this._attributeNextLocation = 0;
    this._varyingNextLocation = 0;
    this.freeGroupIndex = 0;
    this.freeBindingIndex = 0;
    this.availableVaryings = {};
    this.availableAttributes = {};
    this.availableBuffers = {};
    this.availableTextures = {};
    this.availableSamplers = {};
    this.orderedAttributes = [];
    this.bindGroupLayoutEntries = [];
    this.bindGroupLayoutEntryInfo = [];
    this.bindGroupEntries = [];
    this.bufferNames = [];
    this.textureNames = [];
    this.samplerNames = [];
    this.leftOverUniforms = [];
    if (!pureMode) {
      this._findStartingGroupBinding();
    }
  }
  _findStartingGroupBinding() {
    const knownUBOs = WebGPUShaderProcessingContext.KnownUBOs;
    const groups = [];
    for (const name2 in knownUBOs) {
      const binding = knownUBOs[name2].binding;
      if (binding.groupIndex === -1) {
        continue;
      }
      if (groups[binding.groupIndex] === void 0) {
        groups[binding.groupIndex] = binding.bindingIndex;
      } else {
        groups[binding.groupIndex] = Math.max(groups[binding.groupIndex], binding.bindingIndex);
      }
    }
    this.freeGroupIndex = groups.length - 1;
    if (this.freeGroupIndex === 0) {
      this.freeGroupIndex++;
      this.freeBindingIndex = 0;
    } else {
      this.freeBindingIndex = groups[groups.length - 1] + 1;
    }
  }
  getAttributeNextLocation(dataType, arrayLength = 0) {
    const index = this._attributeNextLocation;
    this._attributeNextLocation += (TypeToLocationSize[dataType] ?? 1) * (arrayLength || 1);
    return index;
  }
  getVaryingNextLocation(dataType, arrayLength = 0) {
    const index = this._varyingNextLocation;
    this._varyingNextLocation += (TypeToLocationSize[dataType] ?? 1) * (arrayLength || 1);
    return index;
  }
  getNextFreeUBOBinding() {
    return this._getNextFreeBinding(1);
  }
  _getNextFreeBinding(bindingCount) {
    if (this.freeBindingIndex > MaxBindingsPerGroup - bindingCount) {
      this.freeGroupIndex++;
      this.freeBindingIndex = 0;
    }
    if (this.freeGroupIndex === MaxGroups) {
      throw "Too many textures or UBOs have been declared and it is not supported in WebGPU.";
    }
    const returnValue = {
      groupIndex: this.freeGroupIndex,
      bindingIndex: this.freeBindingIndex
    };
    this.freeBindingIndex += bindingCount;
    return returnValue;
  }
}
WebGPUShaderProcessingContext._SimplifiedKnownBindings = true;
WebGPUShaderProcessingContext._SimplifiedKnownUBOs = {
  Scene: { binding: { groupIndex: 0, bindingIndex: 0 } },
  Light0: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light1: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light2: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light3: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light4: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light5: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light6: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light7: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light8: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light9: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light10: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light11: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light12: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light13: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light14: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light15: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light16: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light17: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light18: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light19: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light20: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light21: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light22: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light23: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light24: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light25: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light26: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light27: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light28: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light29: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light30: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Light31: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Material: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Mesh: { binding: { groupIndex: -1, bindingIndex: -1 } },
  Internals: { binding: { groupIndex: -1, bindingIndex: -1 } }
};
WebGPUShaderProcessingContext._KnownUBOs = {
  Scene: { binding: { groupIndex: 0, bindingIndex: 0 } },
  Light0: { binding: { groupIndex: 1, bindingIndex: 0 } },
  Light1: { binding: { groupIndex: 1, bindingIndex: 1 } },
  Light2: { binding: { groupIndex: 1, bindingIndex: 2 } },
  Light3: { binding: { groupIndex: 1, bindingIndex: 3 } },
  Light4: { binding: { groupIndex: 1, bindingIndex: 4 } },
  Light5: { binding: { groupIndex: 1, bindingIndex: 5 } },
  Light6: { binding: { groupIndex: 1, bindingIndex: 6 } },
  Light7: { binding: { groupIndex: 1, bindingIndex: 7 } },
  Light8: { binding: { groupIndex: 1, bindingIndex: 8 } },
  Light9: { binding: { groupIndex: 1, bindingIndex: 9 } },
  Light10: { binding: { groupIndex: 1, bindingIndex: 10 } },
  Light11: { binding: { groupIndex: 1, bindingIndex: 11 } },
  Light12: { binding: { groupIndex: 1, bindingIndex: 12 } },
  Light13: { binding: { groupIndex: 1, bindingIndex: 13 } },
  Light14: { binding: { groupIndex: 1, bindingIndex: 14 } },
  Light15: { binding: { groupIndex: 1, bindingIndex: 15 } },
  Light16: { binding: { groupIndex: 1, bindingIndex: 16 } },
  Light17: { binding: { groupIndex: 1, bindingIndex: 17 } },
  Light18: { binding: { groupIndex: 1, bindingIndex: 18 } },
  Light19: { binding: { groupIndex: 1, bindingIndex: 19 } },
  Light20: { binding: { groupIndex: 1, bindingIndex: 20 } },
  Light21: { binding: { groupIndex: 1, bindingIndex: 21 } },
  Light22: { binding: { groupIndex: 1, bindingIndex: 22 } },
  Light23: { binding: { groupIndex: 1, bindingIndex: 23 } },
  Light24: { binding: { groupIndex: 1, bindingIndex: 24 } },
  Light25: { binding: { groupIndex: 1, bindingIndex: 25 } },
  Light26: { binding: { groupIndex: 1, bindingIndex: 26 } },
  Light27: { binding: { groupIndex: 1, bindingIndex: 27 } },
  Light28: { binding: { groupIndex: 1, bindingIndex: 28 } },
  Light29: { binding: { groupIndex: 1, bindingIndex: 29 } },
  Light30: { binding: { groupIndex: 1, bindingIndex: 30 } },
  Light31: { binding: { groupIndex: 1, bindingIndex: 31 } },
  Material: { binding: { groupIndex: 2, bindingIndex: 0 } },
  Mesh: { binding: { groupIndex: 2, bindingIndex: 1 } },
  Internals: { binding: { groupIndex: 2, bindingIndex: 2 } }
};
function ExtractBetweenMarkers(markerOpen, markerClose, block, startIndex) {
  let currPos = startIndex, openMarkers = 0, waitForChar = "";
  while (currPos < block.length) {
    const currChar = block.charAt(currPos);
    if (!waitForChar) {
      switch (currChar) {
        case markerOpen:
          openMarkers++;
          break;
        case markerClose:
          openMarkers--;
          break;
        case '"':
        case "'":
        case "`":
          waitForChar = currChar;
          break;
        case "/":
          if (currPos + 1 < block.length) {
            const nextChar = block.charAt(currPos + 1);
            if (nextChar === "/") {
              waitForChar = "\n";
            } else if (nextChar === "*") {
              waitForChar = "*/";
            }
          }
          break;
      }
    } else {
      if (currChar === waitForChar) {
        if (waitForChar === '"' || waitForChar === "'") {
          block.charAt(currPos - 1) !== "\\" && (waitForChar = "");
        } else {
          waitForChar = "";
        }
      } else if (waitForChar === "*/" && currChar === "*" && currPos + 1 < block.length) {
        block.charAt(currPos + 1) === "/" && (waitForChar = "");
        if (waitForChar === "") {
          currPos++;
        }
      }
    }
    currPos++;
    if (openMarkers === 0) {
      break;
    }
  }
  return openMarkers === 0 ? currPos - 1 : -1;
}
function SkipWhitespaces(s, index) {
  while (index < s.length) {
    const c = s[index];
    if (c !== " " && c !== "\n" && c !== "\r" && c !== "	" && c !== "\n" && c !== " ") {
      break;
    }
    index++;
  }
  return index;
}
function IsIdentifierChar(c) {
  const v = c.charCodeAt(0);
  return v >= 48 && v <= 57 || // 0-9
  v >= 65 && v <= 90 || // A-Z
  v >= 97 && v <= 122 || // a-z
  v == 95;
}
function RemoveComments(block) {
  let currPos = 0, waitForChar = "", inComments = false;
  const s = [];
  while (currPos < block.length) {
    const currChar = block.charAt(currPos);
    if (!waitForChar) {
      switch (currChar) {
        case '"':
        case "'":
        case "`":
          waitForChar = currChar;
          break;
        case "/":
          if (currPos + 1 < block.length) {
            const nextChar = block.charAt(currPos + 1);
            if (nextChar === "/") {
              waitForChar = "\n";
              inComments = true;
            } else if (nextChar === "*") {
              waitForChar = "*/";
              inComments = true;
            }
          }
          break;
      }
      if (!inComments) {
        s.push(currChar);
      }
    } else {
      if (currChar === waitForChar) {
        if (waitForChar === '"' || waitForChar === "'") {
          block.charAt(currPos - 1) !== "\\" && (waitForChar = "");
          s.push(currChar);
        } else {
          waitForChar = "";
          inComments = false;
        }
      } else if (waitForChar === "*/" && currChar === "*" && currPos + 1 < block.length) {
        block.charAt(currPos + 1) === "/" && (waitForChar = "");
        if (waitForChar === "") {
          inComments = false;
          currPos++;
        }
      } else {
        if (!inComments) {
          s.push(currChar);
        }
      }
    }
    currPos++;
  }
  return s.join("");
}
function FindBackward(s, index, c, c2) {
  while (index >= 0 && s.charAt(index) !== c && s.charAt(index) !== c2) {
    index--;
  }
  return index;
}
function EscapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function InjectStartingAndEndingCode(code, mainFuncDecl, startingCode, endingCode) {
  let idx = code.indexOf(mainFuncDecl);
  if (idx < 0) {
    return code;
  }
  if (startingCode) {
    while (idx++ < code.length && code.charAt(idx) != "{") {
    }
    if (idx < code.length) {
      const part1 = code.substring(0, idx + 1);
      const part2 = code.substring(idx + 1);
      code = part1 + startingCode + part2;
    }
  }
  if (endingCode) {
    const lastClosingCurly = code.lastIndexOf("}");
    code = code.substring(0, lastClosingCurly);
    code += endingCode + "\n}";
  }
  return code;
}
class WebGPUShaderProcessorGLSL extends WebGPUShaderProcessor {
  constructor() {
    super(...arguments);
    this._missingVaryings = [];
    this._textureArrayProcessing = [];
    this._vertexIsGLES3 = false;
    this._fragmentIsGLES3 = false;
    this.shaderLanguage = 0;
    this.parseGLES3 = true;
  }
  _getArraySize(name2, type, preProcessors) {
    let length = 0;
    const startArray = name2.indexOf("[");
    const endArray = name2.indexOf("]");
    if (startArray > 0 && endArray > 0) {
      const lengthInString = name2.substring(startArray + 1, endArray);
      length = +lengthInString;
      if (isNaN(length)) {
        length = +preProcessors[lengthInString.trim()];
      }
      name2 = name2.substring(0, startArray);
    }
    return [name2, type, length];
  }
  initializeShaders(processingContext) {
    this._webgpuProcessingContext = processingContext;
    this._missingVaryings.length = 0;
    this._textureArrayProcessing.length = 0;
    this.attributeKeywordName = void 0;
    this.varyingVertexKeywordName = void 0;
    this.varyingFragmentKeywordName = void 0;
  }
  preProcessShaderCode(code, isFragment) {
    const ubDeclaration = `// Internals UBO
uniform ${WebGPUShaderProcessor.InternalsUBOName} {
float yFactor_;
float textureOutputHeight_;
};
`;
    const alreadyInjected = code.indexOf("// Internals UBO") !== -1;
    if (isFragment) {
      this._fragmentIsGLES3 = code.indexOf("#version 3") !== -1;
      if (this._fragmentIsGLES3) {
        this.varyingFragmentKeywordName = "in";
      }
      return alreadyInjected ? code : ubDeclaration + "##INJECTCODE##\n" + code;
    }
    this._vertexIsGLES3 = code.indexOf("#version 3") !== -1;
    if (this._vertexIsGLES3) {
      this.attributeKeywordName = "in";
      this.varyingVertexKeywordName = "out";
    }
    return alreadyInjected ? code : ubDeclaration + code;
  }
  varyingCheck(varying, isFragment) {
    const outRegex = /(flat\s)?\s*\bout\b/;
    const inRegex = /(flat\s)?\s*\bin\b/;
    const varyingRegex = /(flat\s)?\s*\bvarying\b/;
    const regex = isFragment && this._fragmentIsGLES3 ? inRegex : !isFragment && this._vertexIsGLES3 ? outRegex : varyingRegex;
    return regex.test(varying);
  }
  varyingProcessor(varying, isFragment, preProcessors) {
    this._preProcessors = preProcessors;
    const outRegex = /\s*(flat)?\s*out\s+(?:(?:highp)?|(?:lowp)?)\s*(\S+)\s+(\S+)\s*;/gm;
    const inRegex = /\s*(flat)?\s*in\s+(?:(?:highp)?|(?:lowp)?)\s*(\S+)\s+(\S+)\s*;/gm;
    const varyingRegex = /\s*(flat)?\s*varying\s+(?:(?:highp)?|(?:lowp)?)\s*(\S+)\s+(\S+)\s*;/gm;
    const regex = isFragment && this._fragmentIsGLES3 ? inRegex : !isFragment && this._vertexIsGLES3 ? outRegex : varyingRegex;
    const match = regex.exec(varying);
    if (match !== null) {
      const interpolationQualifier = match[1] ?? "";
      const varyingType = match[2];
      const name2 = match[3];
      let location;
      if (isFragment) {
        location = this._webgpuProcessingContext.availableVaryings[name2];
        this._missingVaryings[location] = "";
        if (location === void 0) {
          Logger.Warn(`Invalid fragment shader: The varying named "${name2}" is not declared in the vertex shader! This declaration will be ignored.`);
        }
      } else {
        location = this._webgpuProcessingContext.getVaryingNextLocation(varyingType, this._getArraySize(name2, varyingType, preProcessors)[2]);
        this._webgpuProcessingContext.availableVaryings[name2] = location;
        this._missingVaryings[location] = `layout(location = ${location}) ${interpolationQualifier} in ${varyingType} ${name2};`;
      }
      varying = varying.replace(match[0], location === void 0 ? "" : `layout(location = ${location}) ${interpolationQualifier} ${isFragment ? "in" : "out"} ${varyingType} ${name2};`);
    }
    return varying;
  }
  attributeProcessor(attribute, preProcessors) {
    this._preProcessors = preProcessors;
    const inRegex = /\s*in\s+(\S+)\s+(\S+)\s*;/gm;
    const attribRegex = /\s*attribute\s+(\S+)\s+(\S+)\s*;/gm;
    const regex = this._vertexIsGLES3 ? inRegex : attribRegex;
    const match = regex.exec(attribute);
    if (match !== null) {
      const attributeType = match[1];
      const name2 = match[2];
      const location = this._webgpuProcessingContext.getAttributeNextLocation(attributeType, this._getArraySize(name2, attributeType, preProcessors)[2]);
      this._webgpuProcessingContext.availableAttributes[name2] = location;
      this._webgpuProcessingContext.orderedAttributes[location] = name2;
      const numComponents = this._webgpuProcessingContext.vertexBufferKindToNumberOfComponents[name2];
      if (numComponents !== void 0) {
        const newType = numComponents < 0 ? numComponents === -1 ? "int" : "ivec" + -numComponents : numComponents === 1 ? "uint" : "uvec" + numComponents;
        const newName = `_int_${name2}_`;
        attribute = attribute.replace(match[0], `layout(location = ${location}) in ${newType} ${newName}; ${attributeType} ${name2} = ${attributeType}(${newName});`);
      } else {
        attribute = attribute.replace(match[0], `layout(location = ${location}) in ${attributeType} ${name2};`);
      }
    }
    return attribute;
  }
  uniformProcessor(uniform, isFragment, preProcessors) {
    this._preProcessors = preProcessors;
    const uniformRegex = /\s*uniform\s+(?:(?:highp)?|(?:lowp)?)\s*(\S+)\s+(\S+)\s*;/gm;
    const match = uniformRegex.exec(uniform);
    if (match !== null) {
      let uniformType = match[1];
      let name2 = match[2];
      if (uniformType.indexOf("sampler") === 0 || uniformType.indexOf("sampler") === 1) {
        let arraySize;
        [name2, uniformType, arraySize] = this._getArraySize(name2, uniformType, preProcessors);
        let textureInfo = this._webgpuProcessingContext.availableTextures[name2];
        if (!textureInfo) {
          textureInfo = {
            autoBindSampler: true,
            isTextureArray: arraySize > 0,
            isStorageTexture: false,
            textures: [],
            sampleType: "float"
          };
          for (let i = 0; i < (arraySize || 1); ++i) {
            textureInfo.textures.push(this._webgpuProcessingContext.getNextFreeUBOBinding());
          }
        }
        const samplerType = WebGPUShaderProcessor._SamplerTypeByWebGLSamplerType[uniformType] ?? "sampler";
        const isComparisonSampler = !!WebGPUShaderProcessor._IsComparisonSamplerByWebGPUSamplerType[samplerType];
        const samplerBindingType = isComparisonSampler ? "comparison" : "filtering";
        const samplerName = name2 + `Sampler`;
        let samplerInfo = this._webgpuProcessingContext.availableSamplers[samplerName];
        if (!samplerInfo) {
          samplerInfo = {
            binding: this._webgpuProcessingContext.getNextFreeUBOBinding(),
            type: samplerBindingType
          };
        }
        const componentType = uniformType.charAt(0) === "u" ? "u" : uniformType.charAt(0) === "i" ? "i" : "";
        if (componentType) {
          uniformType = uniformType.substring(1);
        }
        const sampleType = isComparisonSampler ? "depth" : componentType === "u" ? "uint" : componentType === "i" ? "sint" : "float";
        textureInfo.sampleType = sampleType;
        const isTextureArray = arraySize > 0;
        const samplerGroupIndex = samplerInfo.binding.groupIndex;
        const samplerBindingIndex = samplerInfo.binding.bindingIndex;
        const samplerFunction = WebGPUShaderProcessor._SamplerFunctionByWebGLSamplerType[uniformType];
        const textureType = WebGPUShaderProcessor._TextureTypeByWebGLSamplerType[uniformType];
        const textureDimension = WebGPUShaderProcessor._GpuTextureViewDimensionByWebGPUTextureType[textureType];
        if (!isTextureArray) {
          arraySize = 1;
          uniform = `layout(set = ${samplerGroupIndex}, binding = ${samplerBindingIndex}) uniform ${samplerType} ${samplerName};
                        layout(set = ${textureInfo.textures[0].groupIndex}, binding = ${textureInfo.textures[0].bindingIndex}) uniform ${componentType}${textureType} ${name2}Texture;
                        #define ${name2} ${componentType}${samplerFunction}(${name2}Texture, ${samplerName})`;
        } else {
          const layouts = [];
          layouts.push(`layout(set = ${samplerGroupIndex}, binding = ${samplerBindingIndex}) uniform ${componentType}${samplerType} ${samplerName};`);
          uniform = `
`;
          for (let i = 0; i < arraySize; ++i) {
            const textureSetIndex = textureInfo.textures[i].groupIndex;
            const textureBindingIndex = textureInfo.textures[i].bindingIndex;
            layouts.push(`layout(set = ${textureSetIndex}, binding = ${textureBindingIndex}) uniform ${textureType} ${name2}Texture${i};`);
            uniform += `${i > 0 ? "\n" : ""}#define ${name2}${i} ${componentType}${samplerFunction}(${name2}Texture${i}, ${samplerName})`;
          }
          uniform = layouts.join("\n") + uniform;
          this._textureArrayProcessing.push(name2);
        }
        this._webgpuProcessingContext.availableTextures[name2] = textureInfo;
        this._webgpuProcessingContext.availableSamplers[samplerName] = samplerInfo;
        this._addSamplerBindingDescription(samplerName, samplerInfo, !isFragment);
        for (let i = 0; i < arraySize; ++i) {
          this._addTextureBindingDescription(name2, textureInfo, i, textureDimension, null, !isFragment);
        }
      } else {
        this._addUniformToLeftOverUBO(name2, uniformType, preProcessors);
        uniform = "";
      }
    }
    return uniform;
  }
  uniformBufferProcessor(uniformBuffer, isFragment) {
    const uboRegex = /uniform\s+(\w+)/gm;
    const match = uboRegex.exec(uniformBuffer);
    if (match !== null) {
      const name2 = match[1];
      let uniformBufferInfo = this._webgpuProcessingContext.availableBuffers[name2];
      if (!uniformBufferInfo) {
        const knownUBO = WebGPUShaderProcessingContext.KnownUBOs[name2];
        let binding;
        if (knownUBO && knownUBO.binding.groupIndex !== -1) {
          binding = knownUBO.binding;
        } else {
          binding = this._webgpuProcessingContext.getNextFreeUBOBinding();
        }
        uniformBufferInfo = { binding };
        this._webgpuProcessingContext.availableBuffers[name2] = uniformBufferInfo;
      }
      this._addBufferBindingDescription(name2, uniformBufferInfo, "uniform", !isFragment);
      uniformBuffer = uniformBuffer.replace("uniform", `layout(set = ${uniformBufferInfo.binding.groupIndex}, binding = ${uniformBufferInfo.binding.bindingIndex}) uniform`);
    }
    return uniformBuffer;
  }
  postProcessor(code, defines, isFragment, _processingContext, _parameters, preProcessors) {
    const hasDrawBuffersExtension = code.search(/#extension.+GL_EXT_draw_buffers.+require/) !== -1;
    const regex = /#extension.+(GL_OVR_multiview2|GL_OES_standard_derivatives|GL_EXT_shader_texture_lod|GL_EXT_frag_depth|GL_EXT_draw_buffers).+(enable|require)/g;
    code = code.replace(regex, "");
    code = code.replace(/texture2D\s*\(/g, "texture(");
    if (isFragment) {
      const hasFragCoord = code.indexOf("gl_FragCoord") >= 0;
      const fragCoordCode = `
                glFragCoord_ = gl_FragCoord;
                if (yFactor_ == 1.) {
                    glFragCoord_.y = textureOutputHeight_ - glFragCoord_.y;
                }
            `;
      const injectCode = hasFragCoord ? "vec4 glFragCoord_;\n" : "";
      const hasOutput = code.search(/layout *\(location *= *0\) *out/g) !== -1;
      code = code.replace(/texture2DLodEXT\s*\(/g, "textureLod(");
      code = code.replace(/textureCubeLodEXT\s*\(/g, "textureLod(");
      code = code.replace(/textureCube\s*\(/g, "texture(");
      code = code.replace(/gl_FragDepthEXT/g, "gl_FragDepth");
      code = code.replace(/gl_FragColor/g, "glFragColor");
      code = code.replace(/gl_FragData/g, "glFragData");
      code = code.replace(/gl_FragCoord/g, "glFragCoord_");
      if (!this._fragmentIsGLES3) {
        code = code.replace(/void\s+?main\s*\(/g, (hasDrawBuffersExtension || hasOutput ? "" : "layout(location = 0) out vec4 glFragColor;\n") + "void main(");
      } else {
        const match = /^\s*out\s+\S+\s+\S+\s*;/gm.exec(code);
        if (match !== null) {
          code = code.substring(0, match.index) + "layout(location = 0) " + code.substring(match.index);
        }
      }
      code = code.replace(/dFdy/g, "(-yFactor_)*dFdy");
      code = code.replace("##INJECTCODE##", injectCode);
      if (hasFragCoord) {
        code = InjectStartingAndEndingCode(code, "void main", fragCoordCode);
      }
    } else {
      if ("VERTEXOUTPUT_INVARIANT" in preProcessors) {
        code = "invariant gl_Position;\n" + code;
      }
      code = code.replace(/gl_InstanceID/g, "gl_InstanceIndex");
      code = code.replace(/gl_VertexID/g, "gl_VertexIndex");
      const hasMultiviewExtension = defines.indexOf("#define MULTIVIEW") !== -1;
      if (hasMultiviewExtension) {
        return "#extension GL_OVR_multiview2 : require\nlayout (num_views = 2) in;\n" + code;
      }
    }
    if (!isFragment) {
      const lastClosingCurly = code.lastIndexOf("}");
      code = code.substring(0, lastClosingCurly);
      code += "gl_Position.y *= yFactor_;\n";
      code += "}";
    }
    return code;
  }
  _applyTextureArrayProcessing(code, name2) {
    const regex = new RegExp(name2 + "\\s*\\[(.+)?\\]", "gm");
    let match = regex.exec(code);
    while (match !== null) {
      const index = match[1];
      let iindex = +index;
      if (this._preProcessors && isNaN(iindex)) {
        iindex = +this._preProcessors[index.trim()];
      }
      code = code.replace(match[0], name2 + iindex);
      match = regex.exec(code);
    }
    return code;
  }
  _generateLeftOverUBOCode(name2, uniformBufferDescription) {
    let ubo = `layout(set = ${uniformBufferDescription.binding.groupIndex}, binding = ${uniformBufferDescription.binding.bindingIndex}) uniform ${name2} {
    `;
    for (const leftOverUniform of this._webgpuProcessingContext.leftOverUniforms) {
      if (leftOverUniform.length > 0) {
        ubo += `    ${leftOverUniform.type} ${leftOverUniform.name}[${leftOverUniform.length}];
`;
      } else {
        ubo += `    ${leftOverUniform.type} ${leftOverUniform.name};
`;
      }
    }
    ubo += "};\n\n";
    return ubo;
  }
  finalizeShaders(vertexCode, fragmentCode) {
    for (let i = 0; i < this._textureArrayProcessing.length; ++i) {
      const name2 = this._textureArrayProcessing[i];
      vertexCode = this._applyTextureArrayProcessing(vertexCode, name2);
      fragmentCode = this._applyTextureArrayProcessing(fragmentCode, name2);
    }
    for (let i = 0; i < this._missingVaryings.length; ++i) {
      const decl = this._missingVaryings[i];
      if (decl && decl.length > 0) {
        fragmentCode = decl + "\n" + fragmentCode;
      }
    }
    const leftOverUBO = this._buildLeftOverUBO();
    vertexCode = leftOverUBO + vertexCode;
    fragmentCode = leftOverUBO + fragmentCode;
    this._collectBindingNames();
    this._preCreateBindGroupEntries();
    this._preProcessors = null;
    this._webgpuProcessingContext.vertexBufferKindToNumberOfComponents = {};
    return { vertexCode, fragmentCode };
  }
}
const builtInName_frag_depth = "fragmentOutputs.fragDepth";
const leftOverVarName = "uniforms";
const internalsVarName = "internals";
const gpuTextureViewDimensionByWebGPUTextureFunction = {
  texture_1d: "1d",
  texture_2d: "2d",
  texture_2d_array: "2d-array",
  texture_3d: "3d",
  texture_cube: "cube",
  texture_cube_array: "cube-array",
  texture_multisampled_2d: "2d",
  texture_depth_2d: "2d",
  texture_depth_2d_array: "2d-array",
  texture_depth_cube: "cube",
  texture_depth_cube_array: "cube-array",
  texture_depth_multisampled_2d: "2d",
  texture_storage_1d: "1d",
  texture_storage_2d: "2d",
  texture_storage_2d_array: "2d-array",
  texture_storage_3d: "3d",
  texture_external: null
};
class WebGPUShaderProcessorWGSL extends WebGPUShaderProcessor {
  constructor() {
    super(...arguments);
    this.shaderLanguage = 1;
    this.uniformRegexp = /uniform\s+(\w+)\s*:\s*(.+)\s*;/;
    this.textureRegexp = /var\s+(\w+)\s*:\s*((array<\s*)?(texture_\w+)\s*(<\s*(.+)\s*>)?\s*(,\s*\w+\s*>\s*)?);/;
    this.noPrecision = true;
    this.pureMode = false;
  }
  _getArraySize(name2, uniformType, preProcessors) {
    let length = 0;
    const endArray = uniformType.lastIndexOf(">");
    if (uniformType.indexOf("array") >= 0 && endArray > 0) {
      let startArray = endArray;
      while (startArray > 0 && uniformType.charAt(startArray) !== " " && uniformType.charAt(startArray) !== ",") {
        startArray--;
      }
      const lengthInString = uniformType.substring(startArray + 1, endArray);
      length = +lengthInString;
      if (isNaN(length)) {
        length = +preProcessors[lengthInString.trim()];
      }
      while (startArray > 0 && (uniformType.charAt(startArray) === " " || uniformType.charAt(startArray) === ",")) {
        startArray--;
      }
      uniformType = uniformType.substring(uniformType.indexOf("<") + 1, startArray + 1);
    }
    return [name2, uniformType, length];
  }
  initializeShaders(processingContext) {
    this._webgpuProcessingContext = processingContext;
    this._attributesInputWGSL = [];
    this._attributesWGSL = [];
    this._attributesConversionCodeWGSL = [];
    this._hasNonFloatAttribute = false;
    this._varyingsWGSL = [];
    this._varyingNamesWGSL = [];
    this._stridedUniformArrays = [];
  }
  preProcessShaderCode(code) {
    const ubDeclaration = this.pureMode ? "" : `struct ${WebGPUShaderProcessor.InternalsUBOName} {
  yFactor_: f32,
  textureOutputHeight_: f32,
};
var<uniform> ${internalsVarName} : ${WebGPUShaderProcessor.InternalsUBOName};
`;
    const alreadyInjected = code.indexOf(ubDeclaration) !== -1;
    return alreadyInjected ? code : ubDeclaration + RemoveComments(code);
  }
  varyingCheck(varying) {
    const regex = /(flat|linear|perspective)?\s*(center|centroid|sample)?\s*\bvarying\b/;
    return regex.test(varying);
  }
  varyingProcessor(varying, isFragment, preProcessors) {
    const varyingRegex = /\s*(flat|linear|perspective)?\s*(center|centroid|sample)?\s*varying\s+(?:(?:highp)?|(?:lowp)?)\s*(\S+)\s*:\s*(.+)\s*;/gm;
    const match = varyingRegex.exec(varying);
    if (match !== null) {
      const interpolationType = match[1] ?? "perspective";
      const interpolationSampling = match[2] ?? "center";
      const varyingType = match[4];
      const name2 = match[3];
      const interpolation = interpolationType === "flat" ? `@interpolate(${interpolationType})` : `@interpolate(${interpolationType}, ${interpolationSampling})`;
      let location;
      if (isFragment) {
        location = this._webgpuProcessingContext.availableVaryings[name2];
        if (location === void 0) {
          Logger.Warn(`Invalid fragment shader: The varying named "${name2}" is not declared in the vertex shader! This declaration will be ignored.`);
        }
      } else {
        location = this._webgpuProcessingContext.getVaryingNextLocation(varyingType, this._getArraySize(name2, varyingType, preProcessors)[2]);
        this._webgpuProcessingContext.availableVaryings[name2] = location;
        this._varyingsWGSL.push(`  @location(${location}) ${interpolation} ${name2} : ${varyingType},`);
        this._varyingNamesWGSL.push(name2);
      }
      varying = "";
    }
    return varying;
  }
  attributeProcessor(attribute, preProcessors) {
    const attribRegex = /\s*attribute\s+(\S+)\s*:\s*(.+)\s*;/gm;
    const match = attribRegex.exec(attribute);
    if (match !== null) {
      const attributeType = match[2];
      const name2 = match[1];
      const location = this._webgpuProcessingContext.getAttributeNextLocation(attributeType, this._getArraySize(name2, attributeType, preProcessors)[2]);
      this._webgpuProcessingContext.availableAttributes[name2] = location;
      this._webgpuProcessingContext.orderedAttributes[location] = name2;
      const numComponents = this._webgpuProcessingContext.vertexBufferKindToNumberOfComponents[name2];
      if (numComponents !== void 0) {
        const newType = numComponents < 0 ? numComponents === -1 ? "i32" : "vec" + -numComponents + "<i32>" : numComponents === 1 ? "u32" : "vec" + numComponents + "<u32>";
        const newName = `_int_${name2}_`;
        this._attributesInputWGSL.push(`@location(${location}) ${newName} : ${newType},`);
        this._attributesWGSL.push(`${name2} : ${attributeType},`);
        this._attributesConversionCodeWGSL.push(`vertexInputs.${name2} = ${attributeType}(vertexInputs_.${newName});`);
        this._hasNonFloatAttribute = true;
      } else {
        this._attributesInputWGSL.push(`@location(${location}) ${name2} : ${attributeType},`);
        this._attributesWGSL.push(`${name2} : ${attributeType},`);
        this._attributesConversionCodeWGSL.push(`vertexInputs.${name2} = vertexInputs_.${name2};`);
      }
      attribute = "";
    }
    return attribute;
  }
  uniformProcessor(uniform, isFragment, preProcessors) {
    const match = this.uniformRegexp.exec(uniform);
    if (match !== null) {
      const uniformType = match[2];
      const name2 = match[1];
      this._addUniformToLeftOverUBO(name2, uniformType, preProcessors);
      uniform = "";
    }
    return uniform;
  }
  textureProcessor(texture, isFragment, preProcessors) {
    const match = this.textureRegexp.exec(texture);
    if (match !== null) {
      const name2 = match[1];
      const type = match[2];
      const isArrayOfTexture = !!match[3];
      const textureFunc = match[4];
      const isStorageTexture = textureFunc.indexOf("storage") > 0;
      const componentType = match[6];
      let storageTextureFormat = null;
      let storageTextureAccess = "write-only";
      if (isStorageTexture) {
        const commaIndex = componentType.indexOf(",");
        storageTextureFormat = componentType.substring(0, commaIndex).trim();
        const accessMode = componentType.substring(commaIndex + 1).trim();
        switch (accessMode) {
          case "read":
            storageTextureAccess = "read-only";
            break;
          case "read_write":
            storageTextureAccess = "read-write";
            break;
          default:
            storageTextureAccess = "write-only";
            break;
        }
      }
      let arraySize = isArrayOfTexture ? this._getArraySize(name2, type, preProcessors)[2] : 0;
      let textureInfo = this._webgpuProcessingContext.availableTextures[name2];
      if (!textureInfo) {
        textureInfo = {
          isTextureArray: arraySize > 0,
          isStorageTexture,
          storageTextureAccess: isStorageTexture ? storageTextureAccess : void 0,
          textures: [],
          sampleType: "float"
        };
        arraySize = arraySize || 1;
        for (let i = 0; i < arraySize; ++i) {
          textureInfo.textures.push(this._webgpuProcessingContext.getNextFreeUBOBinding());
        }
      } else {
        arraySize = textureInfo.textures.length;
      }
      this._webgpuProcessingContext.availableTextures[name2] = textureInfo;
      const isDepthTexture = textureFunc.indexOf("depth") > 0;
      const textureDimension = gpuTextureViewDimensionByWebGPUTextureFunction[textureFunc];
      const sampleType = isDepthTexture ? "depth" : componentType === "u32" ? "uint" : componentType === "i32" ? "sint" : "float";
      textureInfo.sampleType = sampleType;
      if (textureDimension === void 0) {
        throw `Can't get the texture dimension corresponding to the texture function "${textureFunc}"!`;
      }
      for (let i = 0; i < arraySize; ++i) {
        const { groupIndex, bindingIndex } = textureInfo.textures[i];
        if (i === 0) {
          texture = `@group(${groupIndex}) @binding(${bindingIndex}) ${texture}`;
        }
        this._addTextureBindingDescription(name2, textureInfo, i, textureDimension, storageTextureFormat, !isFragment, storageTextureAccess);
      }
    }
    return texture;
  }
  _convertDefinesToConst(preProcessors) {
    let code = "";
    for (const key in preProcessors) {
      const value = preProcessors[key];
      if (key.startsWith("__")) {
        continue;
      }
      if (!isNaN(parseInt(value)) || !isNaN(parseFloat(value))) {
        code += `const ${key} = ${value};
`;
      } else if (key && value === "") {
        code += `const ${key} = true;
`;
      }
    }
    return code;
  }
  postProcessor(code, _defines, _isFragment, _processingContext, _parameters, preProcessors, preProcessorsFromCode) {
    const defineList = [];
    for (const key in preProcessorsFromCode) {
      const value = preProcessorsFromCode[key];
      if (value !== "true") {
        defineList.push(key);
      }
    }
    defineList.sort((a, b) => a.length - b.length > 0 ? -1 : a.length === b.length ? 0 : 1);
    for (const name2 of defineList) {
      const i0 = code.indexOf("#define " + name2);
      let i1 = code.indexOf("\n", i0);
      if (i1 === -1) {
        i1 = code.length;
      }
      const value = code.substring(i0 + 8 + name2.length + 1, i1);
      code = code.replace(new RegExp(name2, "g"), value);
    }
    code = this._convertDefinesToConst(preProcessors) + code;
    if ("VERTEXOUTPUT_INVARIANT" in preProcessors) {
      code = "#define VERTEXOUTPUT_INVARIANT\n" + code;
    }
    return code;
  }
  finalizeShaders(vertexCode, fragmentCode) {
    const enabledExtensions = [];
    const fragCoordCode = fragmentCode.indexOf("fragmentInputs.position") >= 0 && !this.pureMode ? `
            if (internals.yFactor_ == 1.) {
                fragmentInputs.position.y = internals.textureOutputHeight_ - fragmentInputs.position.y;
            }
        ` : "";
    vertexCode = this._processSamplers(vertexCode, true);
    fragmentCode = this._processSamplers(fragmentCode, false);
    vertexCode = this._processCustomBuffers(vertexCode, true);
    fragmentCode = this._processCustomBuffers(fragmentCode, false);
    const leftOverUBO = this._buildLeftOverUBO();
    vertexCode = leftOverUBO + vertexCode;
    fragmentCode = leftOverUBO + fragmentCode;
    vertexCode = vertexCode.replace(/#define /g, "//#define ");
    vertexCode = this._processStridedUniformArrays(vertexCode);
    let vertexInputs = "struct VertexInputs {\n  @builtin(vertex_index) vertexIndex : u32,\n  @builtin(instance_index) instanceIndex : u32,\n";
    if (this._attributesInputWGSL.length > 0) {
      vertexInputs += this._attributesInputWGSL.join("\n");
    }
    vertexInputs += "\n};\nvar<private> vertexInputs" + (this._hasNonFloatAttribute ? "_" : "") + " : VertexInputs;\n";
    if (this._hasNonFloatAttribute) {
      vertexInputs += "struct VertexInputs_ {\n  vertexIndex : u32, instanceIndex : u32,\n";
      vertexInputs += this._attributesWGSL.join("\n");
      vertexInputs += "\n};\nvar<private> vertexInputs : VertexInputs_;\n";
    }
    let vertexOutputs = "struct FragmentInputs {\n  @builtin(position)" + (vertexCode.indexOf("#define VERTEXOUTPUT_INVARIANT") >= 0 ? " @invariant" : "") + " position : vec4<f32>,\n";
    if (this._varyingsWGSL.length > 0) {
      vertexOutputs += this._varyingsWGSL.join("\n");
    }
    vertexOutputs += "\n};\nvar<private> vertexOutputs : FragmentInputs;\n";
    vertexCode = vertexInputs + vertexOutputs + vertexCode;
    let vertexMainStartingCode = `
  vertexInputs${this._hasNonFloatAttribute ? "_" : ""} = input;
`;
    if (this._hasNonFloatAttribute) {
      vertexMainStartingCode += "vertexInputs.vertexIndex = vertexInputs_.vertexIndex;\nvertexInputs.instanceIndex = vertexInputs_.instanceIndex;\n";
      vertexMainStartingCode += this._attributesConversionCodeWGSL.join("\n");
      vertexMainStartingCode += "\n";
    }
    const vertexMainEndingCode = this.pureMode ? `  return vertexOutputs;` : `  vertexOutputs.position.y = vertexOutputs.position.y * internals.yFactor_;
  return vertexOutputs;`;
    let needDiagnosticOff = vertexCode.indexOf(`#define DISABLE_UNIFORMITY_ANALYSIS`) !== -1;
    vertexCode = (needDiagnosticOff ? "diagnostic(off, derivative_uniformity);\n" : "") + "diagnostic(off, chromium.unreachable_code);\n" + InjectStartingAndEndingCode(vertexCode, "fn main", vertexMainStartingCode, vertexMainEndingCode);
    fragmentCode = fragmentCode.replace(/#define /g, "//#define ");
    fragmentCode = this._processStridedUniformArrays(fragmentCode);
    if (!this.pureMode) {
      fragmentCode = fragmentCode.replace(/dpdy/g, "(-internals.yFactor_)*dpdy");
    }
    let fragmentInputs = "struct FragmentInputs {\n  @builtin(position) position : vec4<f32>,\n  @builtin(front_facing) frontFacing : bool,\n";
    if (this._varyingsWGSL.length > 0) {
      fragmentInputs += this._varyingsWGSL.join("\n");
    }
    fragmentInputs += "\n};\nvar<private> fragmentInputs : FragmentInputs;\n";
    let fragmentOutputs = "struct FragmentOutputs {\n";
    const scanCode = fragmentCode.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    const mainBodyStart = scanCode.search(/\bfn\s+main\s*\(/);
    const detectIntVec = (expr) => {
      if (/^\s*(vec4<u32>|vec4u\s*\()/.test(expr)) {
        return "vec4<u32>";
      }
      if (/^\s*(vec4<i32>|vec4i\s*\()/.test(expr)) {
        return "vec4<i32>";
      }
      return null;
    };
    const fragDataOutputType = (index) => {
      const assign = scanCode.match(new RegExp(`fragmentOutputs\\.fragData${index}\\s*=\\s*([^;]+);`));
      if (!assign) {
        return "vec4<f32>";
      }
      const rhs = assign[1].trim();
      const direct = detectIntVec(rhs);
      if (direct) {
        return direct;
      }
      const id = rhs.match(/^([A-Za-z_]\w*)$/);
      if (id && mainBodyStart >= 0) {
        const declScope = scanCode.slice(mainBodyStart, assign.index ?? scanCode.length);
        const typed = declScope.match(new RegExp(`(?:var|let)\\s+${id[1]}\\s*:\\s*(vec4<u32>|vec4<i32>)`));
        if (typed) {
          return typed[1];
        }
        const inited = declScope.match(new RegExp(`(?:var|let)\\s+${id[1]}\\s*=\\s*([^;]+);`));
        if (inited) {
          const t = detectIntVec(inited[1].trim());
          if (t) {
            return t;
          }
        }
      }
      return "vec4<f32>";
    };
    const regexRoot = "fragmentOutputs\\.fragData";
    let match = scanCode.match(new RegExp(regexRoot + "0", "g"));
    let indexLocation = 0;
    if (match) {
      fragmentOutputs += ` @location(${indexLocation}) fragData0 : ${fragDataOutputType(0)},
`;
      indexLocation++;
      for (let index = 1; index < 8; index++) {
        match = scanCode.match(new RegExp(regexRoot + index, "g"));
        if (match) {
          fragmentOutputs += ` @location(${indexLocation}) fragData${indexLocation} : ${fragDataOutputType(index)},
`;
          indexLocation++;
        }
      }
      if (fragmentCode.indexOf("MRT_AND_COLOR") !== -1) {
        fragmentOutputs += `  @location(${indexLocation}) color : vec4<f32>,
`;
        indexLocation++;
      }
    }
    const regex = /oitDepthSampler/;
    match = fragmentCode.match(regex);
    if (match) {
      fragmentOutputs += ` @location(${indexLocation++}) depth : vec2<f32>,
`;
      fragmentOutputs += ` @location(${indexLocation++}) frontColor : vec4<f32>,
`;
      fragmentOutputs += ` @location(${indexLocation++}) backColor : vec4<f32>,
`;
    }
    if (indexLocation === 0) {
      const useDualSourceBlending = fragmentCode.indexOf("DUAL_SOURCE_BLENDING") !== -1;
      if (useDualSourceBlending) {
        enabledExtensions.push("dual_source_blending");
        fragmentOutputs += "  @location(0) @blend_src(0) color : vec4<f32>,\n";
        fragmentOutputs += "  @location(0) @blend_src(1) color2 : vec4<f32>,\n";
      } else {
        fragmentOutputs += "  @location(0) color : vec4<f32>,\n";
      }
    }
    let hasFragDepth = false;
    let idx = 0;
    while (!hasFragDepth) {
      idx = fragmentCode.indexOf(builtInName_frag_depth, idx);
      if (idx < 0) {
        break;
      }
      const saveIndex = idx;
      hasFragDepth = true;
      while (idx > 1 && fragmentCode.charAt(idx) !== "\n") {
        if (fragmentCode.charAt(idx) === "/" && fragmentCode.charAt(idx - 1) === "/") {
          hasFragDepth = false;
          break;
        }
        idx--;
      }
      idx = saveIndex + builtInName_frag_depth.length;
    }
    if (hasFragDepth) {
      fragmentOutputs += "  @builtin(frag_depth) fragDepth: f32,\n";
    }
    fragmentOutputs += "};\nvar<private> fragmentOutputs : FragmentOutputs;\n";
    fragmentCode = fragmentInputs + fragmentOutputs + fragmentCode;
    const fragmentStartingCode = "  fragmentInputs = input;\n  " + fragCoordCode;
    const fragmentEndingCode = "  return fragmentOutputs;";
    needDiagnosticOff = fragmentCode.indexOf(`#define DISABLE_UNIFORMITY_ANALYSIS`) !== -1;
    if (enabledExtensions.length > 0) {
      fragmentCode = "enable " + enabledExtensions.join(";\nenable ") + ";\n" + fragmentCode;
    }
    fragmentCode = (needDiagnosticOff ? "diagnostic(off, derivative_uniformity);\n" : "") + "diagnostic(off, chromium.unreachable_code);\n" + InjectStartingAndEndingCode(fragmentCode, "fn main", fragmentStartingCode, fragmentEndingCode);
    this._collectBindingNames();
    this._preCreateBindGroupEntries();
    this._webgpuProcessingContext.vertexBufferKindToNumberOfComponents = {};
    return { vertexCode, fragmentCode };
  }
  _generateLeftOverUBOCode(name2, uniformBufferDescription) {
    let stridedArrays = "";
    let ubo = `struct ${name2} {
`;
    for (const leftOverUniform of this._webgpuProcessingContext.leftOverUniforms) {
      const type = leftOverUniform.type.replace(/^(.*?)(<.*>)?$/, "$1");
      const size = WebGPUShaderProcessor.UniformSizes[type];
      if (leftOverUniform.length > 0) {
        if (size <= 2) {
          const stridedArrayType = `${name2}_${this._stridedUniformArrays.length}_strided_arr`;
          stridedArrays += `struct ${stridedArrayType} {
                        @size(16)
                        el: ${type},
                    }`;
          this._stridedUniformArrays.push(leftOverUniform.name);
          ubo += ` @align(16) ${leftOverUniform.name} : array<${stridedArrayType}, ${leftOverUniform.length}>,
`;
        } else {
          ubo += ` ${leftOverUniform.name} : array<${leftOverUniform.type}, ${leftOverUniform.length}>,
`;
        }
      } else {
        ubo += `  ${leftOverUniform.name} : ${leftOverUniform.type},
`;
      }
    }
    ubo += "};\n";
    ubo = `${stridedArrays}
${ubo}`;
    ubo += `@group(${uniformBufferDescription.binding.groupIndex}) @binding(${uniformBufferDescription.binding.bindingIndex}) var<uniform> ${leftOverVarName} : ${name2};
`;
    return ubo;
  }
  _processSamplers(code, isVertex) {
    const samplerRegexp = /var\s+(\w+Sampler)\s*:\s*(sampler|sampler_comparison)\s*;/gm;
    while (true) {
      const match = samplerRegexp.exec(code);
      if (match === null) {
        break;
      }
      const name2 = match[1];
      const samplerType = match[2];
      const suffixLessLength = name2.length - `Sampler`.length;
      const textureName = name2.lastIndexOf(`Sampler`) === suffixLessLength ? name2.substring(0, suffixLessLength) : null;
      const samplerBindingType = samplerType === "sampler_comparison" ? "comparison" : "filtering";
      if (textureName) {
        const textureInfo = this._webgpuProcessingContext.availableTextures[textureName];
        if (textureInfo) {
          textureInfo.autoBindSampler = true;
        }
      }
      let samplerInfo = this._webgpuProcessingContext.availableSamplers[name2];
      if (!samplerInfo) {
        samplerInfo = {
          binding: this._webgpuProcessingContext.getNextFreeUBOBinding(),
          type: samplerBindingType
        };
        this._webgpuProcessingContext.availableSamplers[name2] = samplerInfo;
      }
      this._addSamplerBindingDescription(name2, samplerInfo, isVertex);
      const part1 = code.substring(0, match.index);
      const insertPart = `@group(${samplerInfo.binding.groupIndex}) @binding(${samplerInfo.binding.bindingIndex}) `;
      const part2 = code.substring(match.index);
      code = part1 + insertPart + part2;
      samplerRegexp.lastIndex += insertPart.length;
    }
    return code;
  }
  _processCustomBuffers(code, isVertex) {
    const instantiateBufferRegexp = /var<\s*(uniform|storage)\s*(,\s*(read|read_write)\s*)?>\s+(\S+)\s*:\s*(\S+)\s*;/gm;
    while (true) {
      const match = instantiateBufferRegexp.exec(code);
      if (match === null) {
        break;
      }
      const type = match[1];
      const decoration = match[3];
      let name2 = match[4];
      const structName = match[5];
      let bufferInfo = this._webgpuProcessingContext.availableBuffers[name2];
      if (!bufferInfo) {
        const knownUBO = type === "uniform" ? WebGPUShaderProcessingContext.KnownUBOs[structName] : null;
        let binding;
        if (knownUBO) {
          name2 = structName;
          binding = knownUBO.binding;
          if (binding.groupIndex === -1) {
            binding = this._webgpuProcessingContext.availableBuffers[name2]?.binding;
            if (!binding) {
              binding = this._webgpuProcessingContext.getNextFreeUBOBinding();
            }
          }
        } else {
          binding = this._webgpuProcessingContext.getNextFreeUBOBinding();
        }
        bufferInfo = { binding };
        this._webgpuProcessingContext.availableBuffers[name2] = bufferInfo;
      }
      this._addBufferBindingDescription(name2, this._webgpuProcessingContext.availableBuffers[name2], decoration === "read_write" ? "storage" : type === "storage" ? "read-only-storage" : "uniform", isVertex);
      const groupIndex = bufferInfo.binding.groupIndex;
      const bindingIndex = bufferInfo.binding.bindingIndex;
      const part1 = code.substring(0, match.index);
      const insertPart = `@group(${groupIndex}) @binding(${bindingIndex}) `;
      const part2 = code.substring(match.index);
      code = part1 + insertPart + part2;
      instantiateBufferRegexp.lastIndex += insertPart.length;
    }
    return code;
  }
  _processStridedUniformArrays(code) {
    for (const uniformArrayName of this._stridedUniformArrays) {
      code = code.replace(new RegExp(`${uniformArrayName}\\s*\\[(.*?)\\]`, "g"), `${uniformArrayName}[$1].el`);
    }
    return code;
  }
}
class WebGPUHardwareTexture {
  get underlyingResource() {
    return this._webgpuTexture;
  }
  // index is the index of the layer for a 2DArrayTexture / 3DTexture, the face index for a cube texture or the layer * 6 + face index for a cube array texture.
  // In single render target case, index is 0.
  getMSAATexture(sampleCount, index = 0) {
    const texture = this._webgpuMSAATexture[index];
    if (!texture) {
      this._createMSAATexture(sampleCount, index);
    }
    return this._webgpuMSAATexture[index];
  }
  releaseMSAATextures() {
    for (const texture of this._webgpuMSAATexture) {
      if (texture) {
        this._engine._textureHelper.releaseTexture(texture);
      }
    }
    this._webgpuMSAATexture.length = 0;
  }
  constructor(_engine, existingTexture = null) {
    this._engine = _engine;
    this._originalFormatIsRGB = false;
    this.format = "rgba8unorm";
    this.originalFormat = "rgba8unorm";
    this.textureUsages = 0;
    this.textureAdditionalUsages = 0;
    this._webgpuTexture = existingTexture;
    this._webgpuMSAATexture = [];
    this.view = null;
    this.viewForWriting = null;
  }
  set(hardwareTexture) {
    this._webgpuTexture = hardwareTexture;
    this._mipmapGenRenderPassDescr = [];
    this._mipmapGenBindGroup = [];
  }
  setUsage(_textureSource, generateMipMaps, is2DArray, isCube, is3D, width, height, depth) {
    let viewDimension = "2d";
    let arrayLayerCount = 1;
    if (isCube) {
      viewDimension = is2DArray ? "cube-array" : "cube";
      arrayLayerCount = 6 * (depth || 1);
    } else if (is3D) {
      viewDimension = "3d";
      arrayLayerCount = 1;
    } else if (is2DArray) {
      viewDimension = "2d-array";
      arrayLayerCount = depth;
    }
    const format = WebGPUTextureHelper.GetDepthFormatOnly(this.format);
    const aspect = WebGPUTextureHelper.HasDepthAndStencilAspects(this.format) ? "depth-only" : "all";
    this.createView({
      label: `TextureView${is3D ? "3D" : isCube ? "Cube" : "2D"}${is2DArray ? "_Array" + arrayLayerCount : ""}_${width}x${height}_${generateMipMaps ? "wmips" : "womips"}_${this.format}_${viewDimension}`,
      format,
      dimension: viewDimension,
      mipLevelCount: generateMipMaps ? ILog2(Math.max(width, height, is3D ? depth : 1)) + 1 : 1,
      baseArrayLayer: 0,
      baseMipLevel: 0,
      arrayLayerCount,
      aspect
    });
  }
  createView(descriptor, createViewForWriting = false) {
    this.view = this._webgpuTexture.createView(descriptor);
    if (createViewForWriting && descriptor) {
      const saveNumMipMaps = descriptor.mipLevelCount;
      descriptor.mipLevelCount = 1;
      this.viewForWriting = this._webgpuTexture.createView(descriptor);
      descriptor.mipLevelCount = saveNumMipMaps;
    }
  }
  reset() {
    this._webgpuTexture = null;
    this._webgpuMSAATexture.length = 0;
    this.view = null;
    this.viewForWriting = null;
  }
  release() {
    this._webgpuTexture?.destroy();
    this.releaseMSAATextures();
    this._copyInvertYTempTexture?.destroy();
    this.reset();
  }
  _createMSAATexture(samples, index) {
    if (!this._webgpuTexture) {
      throw new Error("Cannot create GPU MSAA texture because underlying GPU texture is not created yet.");
    }
    if (!this._webgpuMSAATexture) {
      this._webgpuMSAATexture = [];
    }
    this._webgpuMSAATexture[index] = this._engine._textureHelper.createMSAATexture(this._webgpuTexture, this.originalFormat, samples);
  }
}
const mipmapVertexSource = `
    const pos = array<vec2<f32>, 4>( vec2f(-1.0f, 1.0f),  vec2f(1.0f, 1.0f),  vec2f(-1.0f, -1.0f),  vec2f(1.0f, -1.0f));
    const tex = array<vec2<f32>, 4>( vec2f(0.0f, 0.0f),  vec2f(1.0f, 0.0f),  vec2f(0.0f, 1.0f),  vec2f(1.0f, 1.0f));

    varying vTex: vec2f;

    @vertex
    fn main(input : VertexInputs) -> FragmentInputs {
        vertexOutputs.vTex = tex[input.vertexIndex];
        vertexOutputs.position = vec4f(pos[input.vertexIndex], 0.0, 1.0);
    }
    `;
const mipmap3DVertexSource = `
    const pos = array<vec2<f32>, 4>( vec2f(-1.0f, 1.0f),  vec2f(1.0f, 1.0f),  vec2f(-1.0f, -1.0f),  vec2f(1.0f, -1.0f));
    const tex = array<vec2<f32>, 4>( vec2f(0.0f, 0.0f),  vec2f(1.0f, 0.0f),  vec2f(0.0f, 1.0f),  vec2f(1.0f, 1.0f));

    varying vTex: vec2f;
    varying vSlice: f32;

    @vertex
    fn main(input : VertexInputs) -> FragmentInputs {
        vertexOutputs.vTex = tex[input.vertexIndex];
        vertexOutputs.vSlice = f32(input.instanceIndex);
        vertexOutputs.position = vec4f(pos[input.vertexIndex], 0.0, 1.0);
    }
    `;
const mipmap3DFragmentSource = `
    var imgSampler: sampler;
    var img: texture_3d<f32>;

    varying vTex: vec2f;
    varying vSlice: f32;

    @fragment
    fn main(input: FragmentInputs) -> FragmentOutputs {
        let depth = max(1u, textureDimensions(img, 0).z / 2u);
        fragmentOutputs.color = textureSample(img, imgSampler, vec3f(input.vTex, (input.vSlice + 0.5) / f32(depth)));
    }
    `;
const mipmap3DLoadFragmentSource = (sampleType) => {
  const integerHelpers = sampleType === "f32" ? "" : `
    ${sampleType === "i32" ? `fn finishSignedDivision(quotient: vec4i, remainder: vec4i, divisor: i32) -> vec4i {
        var result = quotient + remainder / divisor;
        let residual = remainder % divisor;
        for (var channel = 0; channel < 4; channel++) {
            if (result[channel] < 0 && residual[channel] > 0) {
                result[channel] += 1;
            } else if (result[channel] > 0 && residual[channel] < 0) {
                result[channel] -= 1;
            }
        }
        return result;
    }` : ""}

    // Carry the exact fractional remainder through X, Y and Z before truncating the result.
    struct Wide {
        low: vec4u,
        high: vec4u,
    };

    struct IntegerValue {
        whole: vec4<${sampleType}>,
        remainder: Wide,
    };

    fn addWide(a: Wide, b: Wide) -> Wide {
        let low = a.low + b.low;
        return Wide(low, a.high + b.high + select(vec4u(0), vec4u(1), low < a.low));
    }

    fn multiplyWide(a: Wide, factor: vec4u) -> Wide {
        let lowFactor = factor & vec4u(65535u);
        let highFactor = factor >> vec4u(16u);
        let lowPart = (a.low & vec4u(65535u)) * lowFactor;
        let middle = (a.low >> vec4u(16u)) * lowFactor;
        let upper = (a.low & vec4u(65535u)) * highFactor;
        let middleSum = (lowPart >> vec4u(16u)) + (middle & vec4u(65535u)) + (upper & vec4u(65535u));
        let low = (middleSum << vec4u(16u)) | (lowPart & vec4u(65535u));
        let high = a.high * factor + (a.low >> vec4u(16u)) * highFactor + (middle >> vec4u(16u)) + (upper >> vec4u(16u)) + (middleSum >> vec4u(16u));
        return Wide(low, high);
    }

    fn interpolateInteger(a: IntegerValue, b: IntegerValue, numerator: i32, divisor: i32, previousDivisor: Wide) -> IntegerValue {
        let n = ${sampleType}(numerator);
        let d = ${sampleType}(divisor);
        let aRemainder = a.whole % d;
        let bRemainder = b.whole % d;
        let weightedRemainder = aRemainder * (d - n) + bRemainder * n;
        let residual = weightedRemainder % d;
        var whole = (a.whole / d) * (d - n) + (b.whole / d) * n + weightedRemainder / d ${sampleType === "i32" ? "- select(vec4i(0), vec4i(1), residual < vec4i(0))" : ""};
        let integerResidual = vec4u(residual ${sampleType === "i32" ? "+ select(vec4i(0), vec4i(d), residual < vec4i(0))" : ""});
        var remainder = addWide(
            addWide(multiplyWide(a.remainder, vec4u(u32(d - n))), multiplyWide(b.remainder, vec4u(u32(n)))),
            multiplyWide(previousDivisor, integerResidual)
        );
        let nextDivisor = multiplyWide(previousDivisor, vec4u(u32(d)));
        for (var channel = 0; channel < 4; channel++) {
            if (remainder.high[channel] > nextDivisor.high[channel] ||
                (remainder.high[channel] == nextDivisor.high[channel] && remainder.low[channel] >= nextDivisor.low[channel])) {
                let borrow = u32(remainder.low[channel] < nextDivisor.low[channel]);
                remainder.low[channel] -= nextDivisor.low[channel];
                remainder.high[channel] -= nextDivisor.high[channel] + borrow;
                whole[channel] += 1;
            }
        }
        return IntegerValue(whole, remainder);
    }
    `;
  const reduction = sampleType === "f32" ? `
        let weight = vec3f(fraction) / vec3f(divisor);
        var color = vec4f(0.0);
        for (var z = 0; z < 2; z++) {
            for (var y = 0; y < 2; y++) {
                for (var x = 0; x < 2; x++) {
                    let texel = textureLoad(img, min(origin + vec3i(x, y, z), sourceSize - 1), 0);
                    let weighted = select(1.0 - weight.x, weight.x, x == 1) * select(1.0 - weight.y, weight.y, y == 1) * select(1.0 - weight.z, weight.z, z == 1);
                    color += texel * weighted;
                }
            }
        }
        fragmentOutputs.color = color;` : `
        var color: vec4<${sampleType}>;
        if ((sourceSize.x % 2 == 0 || sourceSize.x == 1) && (sourceSize.y % 2 == 0 || sourceSize.y == 1) && (sourceSize.z % 2 == 0 || sourceSize.z == 1)) {
            var quotient = vec4<${sampleType}>(0);
            var remainder = vec4<${sampleType}>(0);
            for (var z = 0; z < 2; z++) {
                for (var y = 0; y < 2; y++) {
                    for (var x = 0; x < 2; x++) {
                        let texel = textureLoad(img, min(origin + vec3i(x, y, z), sourceSize - 1), 0);
                        quotient += texel / 8;
                        remainder += texel % 8;
                    }
                }
            }
            color = ${sampleType === "i32" ? "finishSignedDivision(quotient, remainder, 8)" : "quotient + remainder / 8"};
        } else {
            let unitDivisor = Wide(vec4u(1), vec4u(0));
            let rowDivisor = multiplyWide(unitDivisor, vec4u(u32(divisor.x)));
            let planeDivisor = multiplyWide(rowDivisor, vec4u(u32(divisor.y)));
            var planes: array<IntegerValue, 2>;
            for (var z = 0; z < 2; z++) {
                var rows: array<IntegerValue, 2>;
                for (var y = 0; y < 2; y++) {
                    let first = textureLoad(img, min(origin + vec3i(0, y, z), sourceSize - 1), 0);
                    let second = textureLoad(img, min(origin + vec3i(1, y, z), sourceSize - 1), 0);
                    rows[y] = interpolateInteger(IntegerValue(first, Wide(vec4u(0), vec4u(0))), IntegerValue(second, Wide(vec4u(0), vec4u(0))), fraction.x, divisor.x, unitDivisor);
                }
                planes[z] = interpolateInteger(rows[0], rows[1], fraction.y, divisor.y, rowDivisor);
            }
            let reduced = interpolateInteger(planes[0], planes[1], fraction.z, divisor.z, planeDivisor);
            color = reduced.whole;
            ${sampleType === "i32" ? `for (var channel = 0; channel < 4; channel++) {
                if (color[channel] < 0 && (reduced.remainder.high[channel] != 0u || reduced.remainder.low[channel] != 0u)) {
                    color[channel] += 1;
                }
            }` : ""}
        }
        fragmentOutputs.fragData0 = vec4<${sampleType}>(color);`;
  return `
    var img: texture_3d<${sampleType}>;

    varying vSlice: f32;

    ${integerHelpers}

    @fragment
    fn main(input: FragmentInputs) -> FragmentOutputs {
        let sourceSize = vec3i(textureDimensions(img, 0));
        let destinationSize = max(sourceSize / 2, vec3i(1));
        let destination = vec3i(vec2i(input.position.xy), i32(input.vSlice));
        let divisor = destinationSize * 2;
        let sourcePosition = (destination * 2 + 1) * sourceSize - destinationSize;
        let origin = sourcePosition / divisor;
        let fraction = sourcePosition % divisor;
        ${reduction}
    }
    `;
};
const mipmapFragmentSource = `
    var imgSampler: sampler;
    var img: texture_2d<f32>;

    varying vTex: vec2f;

    @fragment
    fn main(input: FragmentInputs) -> FragmentOutputs {
        fragmentOutputs.color = textureSample(img, imgSampler, input.vTex);
    }
    `;
const invertYPreMultiplyAlphaVertexSource = `
    const pos = array<vec2<f32>, 4>( vec2f(-1.0f, 1.0f),  vec2f(1.0f, 1.0f),  vec2f(-1.0f, -1.0f),  vec2f(1.0f, -1.0f));
    const tex = array<vec2<f32>, 4>( vec2f(0.0f, 0.0f),  vec2f(1.0f, 0.0f),  vec2f(0.0f, 1.0f),  vec2f(1.0f, 1.0f));

    var img: texture_2d<f32>;

    #ifdef INVERTY
        varying vTextureSize: vec2f;
    #endif

    @vertex
    fn main(input : VertexInputs) -> FragmentInputs {
        #ifdef INVERTY
            vertexOutputs.vTextureSize = vec2f(textureDimensions(img, 0));
        #endif
        vertexOutputs.position =  vec4f(pos[input.vertexIndex], 0.0, 1.0);
    }
    `;
const invertYPreMultiplyAlphaFragmentSource = `
    var img: texture_2d<f32>;

    #ifdef INVERTY
        varying vTextureSize: vec2f;
    #endif

    @fragment
    fn main(input: FragmentInputs) -> FragmentOutputs {
    #ifdef INVERTY
        var color: vec4f = textureLoad(img, vec2i(i32(input.position.x), i32(input.vTextureSize.y - input.position.y)), 0);
    #else
        var color: vec4f = textureLoad(img, vec2i(input.position.xy), 0);
    #endif
    #ifdef PREMULTIPLYALPHA
        color = vec4f(color.rgb * color.a, color.a);
    #endif
        fragmentOutputs.color = color;
    }
    `;
const invertYPreMultiplyAlphaWithOfstVertexSource = invertYPreMultiplyAlphaVertexSource;
const invertYPreMultiplyAlphaWithOfstFragmentSource = `
    var img: texture_2d<f32>;
    uniform ofstX: f32;
    uniform ofstY: f32;
    uniform width: f32;
    uniform height: f32;

    #ifdef INVERTY
        varying vTextureSize: vec2f;
    #endif

    @fragment
    fn main(input: FragmentInputs) -> FragmentOutputs {
        if (input.position.x < uniforms.ofstX || input.position.x >= uniforms.ofstX + uniforms.width) {
            discard;
        }
        if (input.position.y < uniforms.ofstY || input.position.y >= uniforms.ofstY + uniforms.height) {
            discard;
        }
    #ifdef INVERTY
        var color: vec4f = textureLoad(img, vec2i(i32(input.position.x), i32(uniforms.ofstY + uniforms.height - (input.position.y - uniforms.ofstY))), 0);
    #else
        var color: vec4f = textureLoad(img, vec2i(input.position.xy), 0);
    #endif
    #ifdef PREMULTIPLYALPHA
        color = vec4f(color.rgb * color.a, color.a);
    #endif
        fragmentOutputs.color = color;
    }
    `;
const clearVertexSource = `
    const pos = array<vec2<f32>, 4>( vec2f(-1.0f, 1.0f),  vec2f(1.0f, 1.0f),  vec2f(-1.0f, -1.0f),  vec2f(1.0f, -1.0f));

    @vertex
    fn main(input : VertexInputs) -> FragmentInputs {
        vertexOutputs.position =  vec4f(pos[input.vertexIndex], 0.0, 1.0);
    }
    `;
const clearFragmentSource = `
    uniform color: vec4f;

    @fragment
    fn main(input: FragmentInputs) -> FragmentOutputs {
        fragmentOutputs.color = uniforms.color;
    }
    `;
const copyVideoToTextureVertexSource = `
    struct VertexOutput {
        @builtin(position) Position : vec4<f32>,
        @location(0) fragUV : vec2<f32>
    }

    @vertex
    fn main(
        @builtin(vertex_index) VertexIndex : u32
    ) -> VertexOutput {
        var pos = array<vec2<f32>, 4>(
            vec2(-1.0,  1.0),
            vec2( 1.0,  1.0),
            vec2(-1.0, -1.0),
            vec2( 1.0, -1.0)
        );
        var tex = array<vec2<f32>, 4>(
            vec2(0.0, 0.0),
            vec2(1.0, 0.0),
            vec2(0.0, 1.0),
            vec2(1.0, 1.0)
        );

        var output: VertexOutput;

        output.Position = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
        output.fragUV = tex[VertexIndex];

        return output;
    }
    `;
const copyVideoToTextureFragmentSource = `
    @group(0) @binding(0) var videoSampler: sampler;
    @group(0) @binding(1) var videoTexture: texture_external;

    @fragment
    fn main(
        @location(0) fragUV: vec2<f32>
    ) -> @location(0) vec4<f32> {
        return textureSampleBaseClampToEdge(videoTexture, videoSampler, fragUV);
    }
    `;
const copyVideoToTextureInvertYFragmentSource = `
    @group(0) @binding(0) var videoSampler: sampler;
    @group(0) @binding(1) var videoTexture: texture_external;

    @fragment
    fn main(
        @location(0) fragUV: vec2<f32>
    ) -> @location(0) vec4<f32> {
        return textureSampleBaseClampToEdge(videoTexture, videoSampler, vec2<f32>(fragUV.x, 1.0 - fragUV.y));
    }
    `;
const resolveDepthVertexSource = `
    const pos = array<vec2<f32>, 4>( vec2f(-1.0f, 1.0f),  vec2f(1.0f, 1.0f),  vec2f(-1.0f, -1.0f),  vec2f(1.0f, -1.0f));

    @vertex
    fn main(input : VertexInputs) -> FragmentInputs {
        vertexOutputs.position = vec4f(pos[input.vertexIndex], 0.0, 1.0);
    }
    `;
const resolveDepthFragmentSource = `
    var msaaDepthTexture: texture_depth_multisampled_2d;

    @fragment
    fn main(input: FragmentInputs) -> FragmentOutputs {
    #ifdef USE_MIN
        let numSamples = textureNumSamples(msaaDepthTexture);
        var depth = 1.0;

        for (var i = 0u; i < numSamples; i = i + 1u) {
            depth = min(depth, textureLoad(msaaDepthTexture, vec2u(input.position.xy), i));
        }

        fragmentOutputs.color = vec4f(depth);
    #else
        fragmentOutputs.color = vec4f(textureLoad(msaaDepthTexture, vec2u(input.position.xy), 0)); // do like WebGL, take the first sample
    #endif
    }
    `;
var PipelineType;
(function(PipelineType2) {
  PipelineType2[PipelineType2["MipMap"] = 0] = "MipMap";
  PipelineType2[PipelineType2["InvertYPremultiplyAlpha"] = 1] = "InvertYPremultiplyAlpha";
  PipelineType2[PipelineType2["Clear"] = 2] = "Clear";
  PipelineType2[PipelineType2["InvertYPremultiplyAlphaWithOfst"] = 3] = "InvertYPremultiplyAlphaWithOfst";
  PipelineType2[PipelineType2["ResolveDepth"] = 4] = "ResolveDepth";
  PipelineType2[PipelineType2["MipMap3D"] = 5] = "MipMap3D";
  PipelineType2[PipelineType2["MipMap3DFloat32"] = 6] = "MipMap3DFloat32";
  PipelineType2[PipelineType2["MipMap3DSint"] = 7] = "MipMap3DSint";
  PipelineType2[PipelineType2["MipMap3DUint"] = 8] = "MipMap3DUint";
})(PipelineType || (PipelineType = {}));
var VideoPipelineType;
(function(VideoPipelineType2) {
  VideoPipelineType2[VideoPipelineType2["DontInvertY"] = 0] = "DontInvertY";
  VideoPipelineType2[VideoPipelineType2["InvertY"] = 1] = "InvertY";
})(VideoPipelineType || (VideoPipelineType = {}));
const shadersForPipelineType = [
  { vertex: mipmapVertexSource, fragment: mipmapFragmentSource },
  { vertex: invertYPreMultiplyAlphaVertexSource, fragment: invertYPreMultiplyAlphaFragmentSource },
  { vertex: clearVertexSource, fragment: clearFragmentSource },
  { vertex: invertYPreMultiplyAlphaWithOfstVertexSource, fragment: invertYPreMultiplyAlphaWithOfstFragmentSource },
  { vertex: resolveDepthVertexSource, fragment: resolveDepthFragmentSource },
  { vertex: mipmap3DVertexSource, fragment: mipmap3DFragmentSource },
  { vertex: mipmap3DVertexSource, fragment: mipmap3DLoadFragmentSource("f32") },
  { vertex: mipmap3DVertexSource, fragment: mipmap3DLoadFragmentSource("i32") },
  { vertex: mipmap3DVertexSource, fragment: mipmap3DLoadFragmentSource("u32") }
];
const renderableTextureFormatToIndex = {
  "": 0,
  r8unorm: 1,
  r8uint: 2,
  r8sint: 3,
  r16uint: 4,
  r16sint: 5,
  r16float: 6,
  rg8unorm: 7,
  rg8uint: 8,
  rg8sint: 9,
  r32uint: 10,
  r32sint: 11,
  r32float: 12,
  rg16uint: 13,
  rg16sint: 14,
  rg16float: 15,
  rgba8unorm: 16,
  "rgba8unorm-srgb": 17,
  rgba8uint: 18,
  rgba8sint: 19,
  bgra8unorm: 20,
  "bgra8unorm-srgb": 21,
  rgb10a2uint: 22,
  rgb10a2unorm: 23,
  /* rg11b10ufloat: this entry is dynamically added if the "RG11B10UFloatRenderable" extension is supported */
  rg32uint: 24,
  rg32sint: 25,
  rg32float: 26,
  rgba16uint: 27,
  rgba16sint: 28,
  rgba16float: 29,
  rgba32uint: 30,
  rgba32sint: 31,
  rgba32float: 32,
  stencil8: 33,
  depth16unorm: 34,
  depth24plus: 35,
  "depth24plus-stencil8": 36,
  depth32float: 37,
  "depth32float-stencil8": 38,
  r16unorm: 39,
  rg16unorm: 40,
  rgba16unorm: 41,
  r16snorm: 42,
  rg16snorm: 43,
  rgba16snorm: 44
};
class WebGPUTextureManager {
  //------------------------------------------------------------------------------
  //                         Initialization / Helpers
  //------------------------------------------------------------------------------
  constructor(engine, device, bufferManager, enabledExtensions) {
    this._pipelines = {};
    this._compiledShaders = [];
    this._videoPipelines = {};
    this._videoCompiledShaders = [];
    this._deferredReleaseTextures = [];
    this._engine = engine;
    this._device = device;
    this._bufferManager = bufferManager;
    if (enabledExtensions.indexOf(
      "rg11b10ufloat-renderable"
      /* WebGPUConstants.FeatureName.RG11B10UFloatRenderable */
    ) !== -1) {
      const keys = Object.keys(renderableTextureFormatToIndex);
      renderableTextureFormatToIndex[
        "rg11b10ufloat"
        /* WebGPUConstants.TextureFormat.RG11B10UFloat */
      ] = renderableTextureFormatToIndex[keys[keys.length - 1]] + 1;
    }
    this._mipmapSampler = device.createSampler({
      minFilter: "linear"
      /* WebGPUConstants.FilterMode.Linear */
    });
    this._mipmap3DSampler = device.createSampler({
      minFilter: "linear",
      magFilter: "linear"
      /* WebGPUConstants.FilterMode.Linear */
    });
    this._videoSampler = device.createSampler({
      minFilter: "linear"
      /* WebGPUConstants.FilterMode.Linear */
    });
    this._ubCopyWithOfst = this._bufferManager.createBuffer(4 * 4, BufferUsage.Uniform | BufferUsage.CopyDst, "UBCopyWithOffset").underlyingResource;
    this._getPipeline(
      "rgba8unorm"
      /* WebGPUConstants.TextureFormat.RGBA8Unorm */
    );
    this._getVideoPipeline(
      "rgba8unorm"
      /* WebGPUConstants.TextureFormat.RGBA8Unorm */
    );
  }
  _getPipeline(format, type = PipelineType.MipMap, params) {
    const index = type === PipelineType.MipMap ? 1 << 0 : type === PipelineType.MipMap3D ? 1 << 7 : type === PipelineType.MipMap3DFloat32 ? 1 << 8 : type === PipelineType.MipMap3DSint ? 1 << 9 : type === PipelineType.MipMap3DUint ? 1 << 10 : type === PipelineType.InvertYPremultiplyAlpha ? ((params.invertY ? 1 : 0) << 1) + ((params.premultiplyAlpha ? 1 : 0) << 2) : type === PipelineType.Clear ? 1 << 3 : type === PipelineType.InvertYPremultiplyAlphaWithOfst ? ((params.invertY ? 1 : 0) << 4) + ((params.premultiplyAlpha ? 1 : 0) << 5) : type === PipelineType.ResolveDepth ? 1 << 6 : 0;
    if (!this._pipelines[format]) {
      this._pipelines[format] = [];
    }
    let pipelineAndBGL = this._pipelines[format][index];
    if (!pipelineAndBGL) {
      let defines = "";
      if (type === PipelineType.InvertYPremultiplyAlpha || type === PipelineType.InvertYPremultiplyAlphaWithOfst) {
        if (params.invertY) {
          defines += "#define INVERTY\n";
        }
        if (params.premultiplyAlpha) {
          defines += "#define PREMULTIPLYALPHA\n";
        }
      }
      let modules = this._compiledShaders[index];
      if (!modules) {
        let vertexCode = shadersForPipelineType[type].vertex;
        let fragmentCode = shadersForPipelineType[type].fragment;
        const processorOptions = {
          defines: defines.split("\n"),
          indexParameters: null,
          isFragment: false,
          shouldUseHighPrecisionShader: true,
          processor: this._engine._getShaderProcessor(
            1
            /* ShaderLanguage.WGSL */
          ),
          supportsUniformBuffers: true,
          shadersRepository: "",
          includesShadersStore: {},
          version: (this._engine.version * 100).toString(),
          platformName: this._engine.shaderPlatformName,
          processingContext: this._engine._getShaderProcessingContext(1, true),
          isNDCHalfZRange: this._engine.isNDCHalfZRange,
          useReverseDepthBuffer: this._engine.useReverseDepthBuffer
        };
        Initialize(processorOptions);
        processorOptions.processor.pureMode = true;
        Process(vertexCode, processorOptions, (migratedVertexCode) => {
          vertexCode = migratedVertexCode;
        }, this._engine);
        processorOptions.isFragment = true;
        Process(fragmentCode, processorOptions, (migratedFragmentCode) => {
          fragmentCode = migratedFragmentCode;
        }, this._engine);
        const final = Finalize(vertexCode, fragmentCode, processorOptions);
        processorOptions.processor.pureMode = false;
        const vertexModule = this._device.createShaderModule({
          label: `BabylonWebGPUDevice${this._engine.uniqueId}_InternalVertexShader_${index}`,
          code: final.vertexCode
        });
        const fragmentModule = this._device.createShaderModule({
          label: `BabylonWebGPUDevice${this._engine.uniqueId}_InternalFragmentShader_${index}`,
          code: final.fragmentCode
        });
        modules = this._compiledShaders[index] = [vertexModule, fragmentModule];
      }
      const pipeline = this._device.createRenderPipeline({
        label: `BabylonWebGPUDevice${this._engine.uniqueId}_InternalPipeline_${format}_${index}`,
        layout: "auto",
        vertex: {
          module: modules[0],
          entryPoint: "main"
        },
        fragment: {
          module: modules[1],
          entryPoint: "main",
          targets: [
            {
              format
            }
          ]
        },
        primitive: {
          topology: "triangle-strip",
          stripIndexFormat: "uint16"
        }
      });
      pipelineAndBGL = this._pipelines[format][index] = [pipeline, pipeline.getBindGroupLayout(0)];
    }
    return pipelineAndBGL;
  }
  _getVideoPipeline(format, type = VideoPipelineType.DontInvertY) {
    const index = type === VideoPipelineType.InvertY ? 1 << 0 : 0;
    if (!this._videoPipelines[format]) {
      this._videoPipelines[format] = [];
    }
    let pipelineAndBGL = this._videoPipelines[format][index];
    if (!pipelineAndBGL) {
      let modules = this._videoCompiledShaders[index];
      if (!modules) {
        const vertexModule = this._device.createShaderModule({
          code: copyVideoToTextureVertexSource,
          label: `BabylonWebGPUDevice${this._engine.uniqueId}_CopyVideoToTexture_VertexShader`
        });
        const fragmentModule = this._device.createShaderModule({
          code: index === 0 ? copyVideoToTextureFragmentSource : copyVideoToTextureInvertYFragmentSource,
          label: `BabylonWebGPUDevice${this._engine.uniqueId}_CopyVideoToTexture_FragmentShader_${index === 0 ? "DontInvertY" : "InvertY"}`
        });
        modules = this._videoCompiledShaders[index] = [vertexModule, fragmentModule];
      }
      const pipeline = this._device.createRenderPipeline({
        label: `BabylonWebGPUDevice${this._engine.uniqueId}_InternalVideoPipeline_${format}_${index === 0 ? "DontInvertY" : "InvertY"}`,
        layout: "auto",
        vertex: {
          module: modules[0],
          entryPoint: "main"
        },
        fragment: {
          module: modules[1],
          entryPoint: "main",
          targets: [
            {
              format
            }
          ]
        },
        primitive: {
          topology: "triangle-strip",
          stripIndexFormat: "uint16"
        }
      });
      pipelineAndBGL = this._videoPipelines[format][index] = [pipeline, pipeline.getBindGroupLayout(0)];
    }
    return pipelineAndBGL;
  }
  setCommandEncoder(encoder) {
    this._commandEncoderForCreation = encoder;
  }
  copyVideoToTexture(video, texture, format, invertY = false, commandEncoder) {
    const useOwnCommandEncoder = commandEncoder === void 0;
    const [pipeline, bindGroupLayout] = this._getVideoPipeline(format, invertY ? VideoPipelineType.InvertY : VideoPipelineType.DontInvertY);
    if (useOwnCommandEncoder) {
      commandEncoder = this._device.createCommandEncoder({});
    }
    commandEncoder.pushDebugGroup(`copy video to texture (invertY=${invertY})`);
    const webgpuHardwareTexture = texture._hardwareTexture;
    const renderPassDescriptor = {
      label: `BabylonWebGPUDevice${this._engine.uniqueId}_copyVideoToTexture_${format}_${invertY ? "InvertY" : "DontInvertY"}${texture.label ? "_" + texture.label : ""}`,
      colorAttachments: [
        {
          view: webgpuHardwareTexture.underlyingResource.createView({
            format,
            dimension: "2d",
            mipLevelCount: 1,
            baseArrayLayer: 0,
            baseMipLevel: 0,
            arrayLayerCount: 1,
            aspect: "all"
          }),
          loadOp: "load",
          storeOp: "store"
        }
      ]
    };
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    const descriptor = {
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: this._videoSampler
        },
        {
          binding: 1,
          resource: this._device.importExternalTexture({
            source: video.underlyingResource
          })
        }
      ]
    };
    const bindGroup = this._device.createBindGroup(descriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.draw(4, 1, 0, 0);
    passEncoder.end();
    commandEncoder.popDebugGroup();
    if (useOwnCommandEncoder) {
      this._device.queue.submit([commandEncoder.finish()]);
      commandEncoder = null;
    }
  }
  invertYPreMultiplyAlpha(gpuOrHdwTexture, width, height, format, invertY = false, premultiplyAlpha = false, faceIndex = 0, mipLevel = 0, layers = 1, ofstX = 0, ofstY = 0, rectWidth = 0, rectHeight = 0, commandEncoder, allowGPUOptimization) {
    const useRect = rectWidth !== 0;
    const useOwnCommandEncoder = commandEncoder === void 0;
    const [pipeline, bindGroupLayout] = this._getPipeline(format, useRect ? PipelineType.InvertYPremultiplyAlphaWithOfst : PipelineType.InvertYPremultiplyAlpha, {
      invertY,
      premultiplyAlpha
    });
    faceIndex = Math.max(faceIndex, 0);
    if (useOwnCommandEncoder) {
      commandEncoder = this._device.createCommandEncoder({});
    }
    let gpuTexture;
    if (WebGPUTextureHelper.IsHardwareTexture(gpuOrHdwTexture)) {
      gpuTexture = gpuOrHdwTexture.underlyingResource;
      if (!(invertY && !premultiplyAlpha && layers === 1 && faceIndex === 0)) {
        gpuOrHdwTexture = void 0;
      }
    } else {
      gpuTexture = gpuOrHdwTexture;
      gpuOrHdwTexture = void 0;
    }
    if (!gpuTexture) {
      return;
    }
    commandEncoder.pushDebugGroup(`internal process texture "${gpuTexture.label}" (invertY=${invertY} premultiplyAlpha=${premultiplyAlpha})`);
    if (useRect) {
      this._bufferManager.setRawData(this._ubCopyWithOfst, 0, new Float32Array([ofstX, ofstY, rectWidth, rectHeight]), 0, 4 * 4);
    }
    const webgpuHardwareTexture = gpuOrHdwTexture;
    const outputTexture = webgpuHardwareTexture?._copyInvertYTempTexture ?? this.createTexture({ width, height, layers: 1 }, false, false, false, false, false, format, 1, commandEncoder, 1 | 16 | 4, void 0, "TempTextureForCopyWithInvertY");
    const renderPassDescriptor = webgpuHardwareTexture?._copyInvertYRenderPassDescr ?? {
      label: `BabylonWebGPUDevice${this._engine.uniqueId}_invertYPreMultiplyAlpha_${format}_${invertY ? "InvertY" : "DontInvertY"}_${premultiplyAlpha ? "PremultiplyAlpha" : "DontPremultiplyAlpha"}`,
      colorAttachments: [
        {
          view: outputTexture.createView({
            format,
            dimension: "2d",
            baseMipLevel: 0,
            mipLevelCount: 1,
            arrayLayerCount: 1,
            baseArrayLayer: 0
          }),
          loadOp: "load",
          storeOp: "store"
        }
      ]
    };
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    let bindGroup = useRect ? webgpuHardwareTexture?._copyInvertYBindGroupWithOfst : webgpuHardwareTexture?._copyInvertYBindGroup;
    if (!bindGroup) {
      const descriptor = {
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: gpuTexture.createView({
              format,
              dimension: "2d",
              baseMipLevel: mipLevel,
              mipLevelCount: 1,
              arrayLayerCount: layers,
              baseArrayLayer: faceIndex
            })
          }
        ]
      };
      if (useRect) {
        descriptor.entries.push({
          binding: 1,
          resource: {
            buffer: this._ubCopyWithOfst
          }
        });
      }
      bindGroup = this._device.createBindGroup(descriptor);
    }
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.draw(4, 1, 0, 0);
    passEncoder.end();
    commandEncoder.copyTextureToTexture({
      texture: outputTexture
    }, {
      texture: gpuTexture,
      mipLevel,
      origin: {
        x: 0,
        y: 0,
        z: faceIndex
      }
    }, {
      width: rectWidth || width,
      height: rectHeight || height,
      depthOrArrayLayers: 1
    });
    if (webgpuHardwareTexture) {
      webgpuHardwareTexture._copyInvertYTempTexture = outputTexture;
      webgpuHardwareTexture._copyInvertYRenderPassDescr = renderPassDescriptor;
      if (useRect) {
        webgpuHardwareTexture._copyInvertYBindGroupWithOfst = bindGroup;
      } else {
        webgpuHardwareTexture._copyInvertYBindGroup = bindGroup;
      }
    } else {
      this._deferredReleaseTextures.push([outputTexture, null]);
    }
    commandEncoder.popDebugGroup();
    if (useOwnCommandEncoder) {
      this._device.queue.submit([commandEncoder.finish()]);
      commandEncoder = null;
    }
  }
  //------------------------------------------------------------------------------
  //                               Creation
  //------------------------------------------------------------------------------
  createTexture(imageBitmap, hasMipmaps = false, generateMipmaps = false, invertY = false, premultiplyAlpha = false, is3D = false, format = "rgba8unorm", sampleCount = 1, commandEncoder, usage = -1, additionalUsages = 0, label, mipLevelCount) {
    sampleCount = WebGPUTextureHelper.GetSample(sampleCount);
    if (is3D && WebGPUTextureHelper.IsImageBitmap(imageBitmap)) {
      throw new Error("Uploading an ImageBitmap to a WebGPU 3D texture is not supported.");
    }
    const layerCount = imageBitmap.layers || 1;
    const textureSize = {
      width: imageBitmap.width,
      height: imageBitmap.height,
      depthOrArrayLayers: layerCount
    };
    const renderAttachmentFlag = renderableTextureFormatToIndex[format] ? 16 : 0;
    const isCompressedFormat = WebGPUTextureHelper.IsCompressedFormat(format);
    const maxNumMipLevels = WebGPUTextureHelper.ComputeNumMipmapLevels(imageBitmap.width, imageBitmap.height, is3D ? layerCount : 1);
    const effectiveMipLevelCount = hasMipmaps ? Math.min(mipLevelCount ?? maxNumMipLevels, maxNumMipLevels) : 1;
    const usages = usage >= 0 ? usage : 1 | 2 | 4;
    additionalUsages |= hasMipmaps && !isCompressedFormat ? 1 | renderAttachmentFlag : 0;
    if (!isCompressedFormat && !is3D) {
      additionalUsages |= renderAttachmentFlag | 2;
    }
    const gpuTexture = this._device.createTexture({
      label: `BabylonWebGPUDevice${this._engine.uniqueId}_Texture${is3D ? "3D" : "2D"}_${label ? label + "_" : ""}${textureSize.width}x${textureSize.height}x${textureSize.depthOrArrayLayers}_${hasMipmaps ? "wmips" : "womips"}_${format}_samples${sampleCount}`,
      size: textureSize,
      dimension: is3D ? "3d" : "2d",
      format,
      usage: usages | additionalUsages,
      sampleCount,
      mipLevelCount: effectiveMipLevelCount
    });
    if (WebGPUTextureHelper.IsImageBitmap(imageBitmap)) {
      this.updateTexture(imageBitmap, gpuTexture, imageBitmap.width, imageBitmap.height, layerCount, format, 0, 0, invertY, premultiplyAlpha, 0, 0);
      if (hasMipmaps && generateMipmaps) {
        this.generateMipmaps(gpuTexture, effectiveMipLevelCount, 0, commandEncoder);
      }
    }
    return gpuTexture;
  }
  createCubeTexture(imageBitmaps, hasMipmaps = false, generateMipmaps = false, invertY = false, premultiplyAlpha = false, format = "rgba8unorm", sampleCount = 1, commandEncoder, usage = -1, additionalUsages = 0, label) {
    sampleCount = WebGPUTextureHelper.GetSample(sampleCount);
    const width = WebGPUTextureHelper.IsImageBitmapArray(imageBitmaps) ? imageBitmaps[0].width : imageBitmaps.width;
    const height = WebGPUTextureHelper.IsImageBitmapArray(imageBitmaps) ? imageBitmaps[0].height : imageBitmaps.height;
    const layerCount = WebGPUTextureHelper.IsImageBitmapArray(imageBitmaps) ? 1 : imageBitmaps.layers;
    const renderAttachmentFlag = renderableTextureFormatToIndex[format] ? 16 : 0;
    const isCompressedFormat = WebGPUTextureHelper.IsCompressedFormat(format);
    const mipLevelCount = hasMipmaps ? WebGPUTextureHelper.ComputeNumMipmapLevels(width, height) : 1;
    const usages = usage >= 0 ? usage : 1 | 2 | 4;
    additionalUsages |= hasMipmaps && !isCompressedFormat ? 1 | renderAttachmentFlag : 0;
    if (!isCompressedFormat) {
      additionalUsages |= renderAttachmentFlag | 2;
    }
    const gpuTexture = this._device.createTexture({
      label: `BabylonWebGPUDevice${this._engine.uniqueId}_TextureCube_${label ? label + "_" : ""}${width}x${height}x${layerCount}_${hasMipmaps ? "wmips" : "womips"}_${format}_samples${sampleCount}`,
      size: {
        width,
        height,
        depthOrArrayLayers: 6 * layerCount
      },
      dimension: "2d",
      format,
      usage: usages | additionalUsages,
      sampleCount,
      mipLevelCount
    });
    if (WebGPUTextureHelper.IsImageBitmapArray(imageBitmaps)) {
      this.updateCubeTextures(imageBitmaps, gpuTexture, width, height, format, invertY, premultiplyAlpha, 0, 0);
      if (hasMipmaps && generateMipmaps) {
        this.generateCubeMipmaps(gpuTexture, mipLevelCount, commandEncoder);
      }
    }
    return gpuTexture;
  }
  generateCubeMipmaps(gpuOrHdwTexture, mipLevelCount, commandEncoder) {
    const useOwnCommandEncoder = commandEncoder === void 0;
    const gpuTexture = WebGPUTextureHelper.IsHardwareTexture(gpuOrHdwTexture) ? gpuOrHdwTexture.underlyingResource : gpuOrHdwTexture;
    if (useOwnCommandEncoder) {
      commandEncoder = this._device.createCommandEncoder({});
    }
    commandEncoder.pushDebugGroup(`create cube mipmaps for "${gpuTexture.label}" (${mipLevelCount} levels)`);
    for (let f = 0; f < gpuTexture.depthOrArrayLayers; ++f) {
      this.generateMipmaps(gpuOrHdwTexture, mipLevelCount, f, commandEncoder);
    }
    commandEncoder.popDebugGroup();
    if (useOwnCommandEncoder) {
      this._device.queue.submit([commandEncoder.finish()]);
      commandEncoder = null;
    }
  }
  generateMipmaps(gpuOrHdwTexture, mipLevelCount, faceIndex = 0, commandEncoder) {
    const useOwnCommandEncoder = commandEncoder === void 0;
    faceIndex = Math.max(faceIndex, 0);
    if (useOwnCommandEncoder) {
      commandEncoder = this._device.createCommandEncoder({});
    }
    let gpuTexture;
    if (WebGPUTextureHelper.IsHardwareTexture(gpuOrHdwTexture)) {
      gpuTexture = gpuOrHdwTexture.underlyingResource;
      gpuOrHdwTexture._mipmapGenRenderPassDescr = gpuOrHdwTexture._mipmapGenRenderPassDescr || [];
      gpuOrHdwTexture._mipmapGenBindGroup = gpuOrHdwTexture._mipmapGenBindGroup || [];
    } else {
      gpuTexture = gpuOrHdwTexture;
      gpuOrHdwTexture = void 0;
    }
    if (!gpuTexture) {
      return;
    }
    commandEncoder.pushDebugGroup(`create mipmaps for "${gpuTexture.label}" (face #${faceIndex} - ${mipLevelCount} levels)`);
    const format = gpuTexture.format;
    const [pipeline, bindGroupLayout] = this._getPipeline(format);
    const is3D = gpuTexture.dimension === "3d";
    const webgpuHardwareTexture = gpuOrHdwTexture;
    for (let i = 1; i < mipLevelCount; ++i) {
      const renderPassDescriptor = webgpuHardwareTexture?._mipmapGenRenderPassDescr[faceIndex]?.[i - 1] ?? {
        label: `BabylonWebGPUDevice${this._engine.uniqueId}_generateMipmaps_${format}_faceIndex${faceIndex}_level${i}`,
        colorAttachments: [
          {
            view: gpuTexture.createView({
              format,
              dimension: is3D ? "3d" : "2d",
              baseMipLevel: i,
              mipLevelCount: 1,
              arrayLayerCount: 1,
              baseArrayLayer: faceIndex
            }),
            loadOp: "load",
            storeOp: "store"
          }
        ]
      };
      if (webgpuHardwareTexture) {
        webgpuHardwareTexture._mipmapGenRenderPassDescr[faceIndex] = webgpuHardwareTexture._mipmapGenRenderPassDescr[faceIndex] || [];
        webgpuHardwareTexture._mipmapGenRenderPassDescr[faceIndex][i - 1] = renderPassDescriptor;
      }
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      const bindGroup = webgpuHardwareTexture?._mipmapGenBindGroup[faceIndex]?.[i - 1] ?? this._device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: gpuTexture.createView({
              format,
              dimension: is3D ? "3d" : "2d",
              baseMipLevel: i - 1,
              mipLevelCount: 1,
              arrayLayerCount: 1,
              baseArrayLayer: faceIndex
            })
          },
          {
            binding: 1,
            resource: this._mipmapSampler
          }
        ]
      });
      if (webgpuHardwareTexture) {
        webgpuHardwareTexture._mipmapGenBindGroup[faceIndex] = webgpuHardwareTexture._mipmapGenBindGroup[faceIndex] || [];
        webgpuHardwareTexture._mipmapGenBindGroup[faceIndex][i - 1] = bindGroup;
      }
      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.draw(4, 1, 0, 0);
      passEncoder.end();
    }
    commandEncoder.popDebugGroup();
    if (useOwnCommandEncoder) {
      this._device.queue.submit([commandEncoder.finish()]);
      commandEncoder = null;
    }
  }
  generate3DMipmaps(gpuOrHdwTexture, mipLevelCount, commandEncoder) {
    const useOwnCommandEncoder = commandEncoder === void 0;
    const hardwareTexture = WebGPUTextureHelper.IsHardwareTexture(gpuOrHdwTexture) ? gpuOrHdwTexture : null;
    const gpuTexture = hardwareTexture ? hardwareTexture.underlyingResource : gpuOrHdwTexture;
    if (!gpuTexture || mipLevelCount <= 1) {
      return;
    }
    if (useOwnCommandEncoder) {
      commandEncoder = this._device.createCommandEncoder({});
    }
    commandEncoder.pushDebugGroup(`create 3D mipmaps for "${gpuTexture.label}" (${mipLevelCount} levels)`);
    const format = gpuTexture.format;
    const pipelineType = format.endsWith("uint") ? PipelineType.MipMap3DUint : format.endsWith("sint") ? PipelineType.MipMap3DSint : format === "r32float" || format === "rg32float" || format === "rgba32float" ? PipelineType.MipMap3DFloat32 : PipelineType.MipMap3D;
    const [pipeline, bindGroupLayout] = this._getPipeline(format, pipelineType);
    for (let i = 1; i < mipLevelCount; ++i) {
      const bindGroup = hardwareTexture?._mipmapGenBindGroup?.[0]?.[i - 1] ?? this._device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: gpuTexture.createView({
              format,
              dimension: "3d",
              baseMipLevel: i - 1,
              mipLevelCount: 1,
              arrayLayerCount: 1
            })
          },
          ...pipelineType === PipelineType.MipMap3D ? [{ binding: 1, resource: this._mipmap3DSampler }] : []
        ]
      });
      if (hardwareTexture) {
        hardwareTexture._mipmapGenBindGroup = hardwareTexture._mipmapGenBindGroup || [];
        hardwareTexture._mipmapGenBindGroup[0] = hardwareTexture._mipmapGenBindGroup[0] || [];
        hardwareTexture._mipmapGenBindGroup[0][i - 1] = bindGroup;
      }
      const renderPassDescriptor = {
        label: `BabylonWebGPUDevice${this._engine.uniqueId}_generate3DMipmaps_${format}_level${i}`,
        colorAttachments: [
          {
            view: gpuTexture.createView({
              format,
              dimension: "3d",
              baseMipLevel: i,
              mipLevelCount: 1,
              arrayLayerCount: 1
            }),
            depthSlice: 0,
            loadOp: "load",
            storeOp: "store"
          }
        ]
      };
      const depth = Math.max(1, gpuTexture.depthOrArrayLayers >> i);
      for (let slice = 0; slice < depth; ++slice) {
        renderPassDescriptor.colorAttachments[0].depthSlice = slice;
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.draw(4, 1, 0, slice);
        passEncoder.end();
      }
    }
    commandEncoder.popDebugGroup();
    if (useOwnCommandEncoder) {
      this._device.queue.submit([commandEncoder.finish()]);
    }
  }
  createGPUTextureForInternalTexture(texture, width, height, depth, creationFlags) {
    if (!texture._hardwareTexture) {
      texture._hardwareTexture = new WebGPUHardwareTexture(this._engine);
    }
    if (width === void 0) {
      width = texture.width;
    }
    if (height === void 0) {
      height = texture.height;
    }
    if (depth === void 0) {
      depth = texture.depth;
    }
    texture.width = texture.baseWidth = width;
    texture.height = texture.baseHeight = height;
    texture.depth = texture.baseDepth = depth;
    const gpuTextureWrapper = texture._hardwareTexture;
    const isStorageTexture = ((creationFlags ?? 0) & 1) !== 0;
    const label = texture.label ? texture.label + "_InternalUniqueId" + texture.uniqueId : "InternalUniqueId" + texture.uniqueId;
    gpuTextureWrapper.format = gpuTextureWrapper.originalFormat = WebGPUTextureHelper.GetWebGPUTextureFormat(texture.type, texture.format, texture._useSRGBBuffer);
    if (texture.samples > 1) {
      switch (gpuTextureWrapper.format) {
        case "depth16unorm":
          gpuTextureWrapper.format = "r16unorm";
          break;
        case "depth24plus":
        case "depth24plus-stencil8":
        case "depth32float":
        case "depth32float-stencil8":
          gpuTextureWrapper.format = "r32float";
          break;
      }
    }
    gpuTextureWrapper.textureUsages = texture._source === 5 || texture.source === 6 ? 4 | 1 | 16 : texture._source === 12 ? 4 | 16 : -1;
    gpuTextureWrapper.textureAdditionalUsages = isStorageTexture ? 8 : 0;
    const hasMipMaps = texture.generateMipMaps;
    const layerCount = depth || 1;
    let mipmapCount;
    if (texture._maxLodLevel !== null) {
      mipmapCount = texture._maxLodLevel;
    } else {
      mipmapCount = hasMipMaps ? WebGPUTextureHelper.ComputeNumMipmapLevels(width, height, texture.is3D ? layerCount : 1) : 1;
    }
    if (texture.is3D) {
      mipmapCount = hasMipMaps ? Math.min(Math.max(1, mipmapCount), WebGPUTextureHelper.ComputeNumMipmapLevels(width, height, layerCount)) : 1;
      texture.mipLevelCount = mipmapCount;
    }
    if (texture.isCube) {
      const gpuTexture = this.createCubeTexture({ width, height, layers: layerCount }, texture.generateMipMaps, texture.generateMipMaps, texture.invertY, false, gpuTextureWrapper.format, 1, this._commandEncoderForCreation, gpuTextureWrapper.textureUsages, gpuTextureWrapper.textureAdditionalUsages, label);
      gpuTextureWrapper.set(gpuTexture);
      const format = WebGPUTextureHelper.GetDepthFormatOnly(gpuTextureWrapper.format);
      const aspect = WebGPUTextureHelper.HasDepthAndStencilAspects(gpuTextureWrapper.format) ? "depth-only" : "all";
      const dimension = texture.is2DArray ? "cube-array" : "cube";
      gpuTextureWrapper.createView({
        label: `BabylonWebGPUDevice${this._engine.uniqueId}_TextureViewCube${texture.is2DArray ? "_Array" + layerCount : ""}_${width}x${height}_${hasMipMaps ? "wmips" : "womips"}_${format}_${dimension}_${aspect}_${label}`,
        format,
        dimension,
        mipLevelCount: mipmapCount,
        baseArrayLayer: 0,
        baseMipLevel: 0,
        arrayLayerCount: 6 * layerCount,
        aspect
      }, isStorageTexture);
    } else {
      const gpuTexture = this.createTexture({ width, height, layers: layerCount }, hasMipMaps, texture.generateMipMaps, texture.invertY, false, texture.is3D, gpuTextureWrapper.format, 1, this._commandEncoderForCreation, gpuTextureWrapper.textureUsages, gpuTextureWrapper.textureAdditionalUsages, label, texture.is3D ? mipmapCount : void 0);
      gpuTextureWrapper.set(gpuTexture);
      const arrayLayerCount = texture.is3D ? 1 : layerCount;
      const format = WebGPUTextureHelper.GetDepthFormatOnly(gpuTextureWrapper.format);
      const aspect = WebGPUTextureHelper.HasDepthAndStencilAspects(gpuTextureWrapper.format) ? "depth-only" : "all";
      const dimension = texture.is2DArray ? "2d-array" : texture.is3D ? "3d" : "2d";
      gpuTextureWrapper.createView({
        label: `BabylonWebGPUDevice${this._engine.uniqueId}_TextureView${texture.is3D ? "3D" : "2D"}${texture.is2DArray ? "_Array" + arrayLayerCount : ""}_${width}x${height}${texture.is3D ? "x" + layerCount : ""}_${hasMipMaps ? "wmips" : "womips"}_${format}_${dimension}_${aspect}_${label}`,
        format,
        dimension,
        mipLevelCount: mipmapCount,
        baseArrayLayer: 0,
        baseMipLevel: 0,
        arrayLayerCount,
        aspect
      }, isStorageTexture);
    }
    return gpuTextureWrapper;
  }
  createMSAATexture(gpuTexture, format, samples) {
    return this.createTexture({ width: gpuTexture.width, height: gpuTexture.height, layers: 1 }, false, false, false, false, false, format, samples, this._commandEncoderForCreation, 16 | 4, 0, gpuTexture.label ? gpuTexture.label + " (MSAA)" : "MSAA");
  }
  resolveMSAADepthTexture(msaaTexture, outputTexture, commandEncoder) {
    const format = outputTexture.format;
    const useOwnCommandEncoder = commandEncoder === void 0;
    const [pipeline, bindGroupLayout] = this._getPipeline(format, PipelineType.ResolveDepth);
    if (useOwnCommandEncoder) {
      commandEncoder = this._device.createCommandEncoder({});
    }
    commandEncoder.pushDebugGroup(`resolve MSAA Depth texture "${msaaTexture.label}" to "${outputTexture.label}"`);
    const renderPassDescriptor = {
      label: `BabylonWebGPUDevice${this._engine.uniqueId}_resolveMSAADepthTexture${msaaTexture.label ? "_" + msaaTexture.label : ""}`,
      colorAttachments: [
        {
          // Note: the WebGPU spec allows passing a GPUTexture directly as the view, but Safari rejects it (non-compliant).
          // We explicitly create a GPUTextureView to work around this Safari bug.
          view: outputTexture.createView({
            format,
            dimension: "2d",
            baseMipLevel: 0,
            mipLevelCount: 1,
            arrayLayerCount: 1,
            baseArrayLayer: 0
          }),
          loadOp: "load",
          storeOp: "store"
        }
      ]
    };
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    const descriptor = {
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: msaaTexture.createView({
            format: WebGPUTextureHelper.GetDepthFormatOnly(msaaTexture.format),
            dimension: "2d",
            mipLevelCount: 1,
            baseArrayLayer: 0,
            baseMipLevel: 0,
            arrayLayerCount: 1,
            aspect: "depth-only"
          })
        }
      ]
    };
    const bindGroup = this._device.createBindGroup(descriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.draw(4, 1, 0, 0);
    passEncoder.end();
    commandEncoder.popDebugGroup();
    if (useOwnCommandEncoder) {
      this._device.queue.submit([commandEncoder.finish()]);
      commandEncoder = null;
    }
  }
  //------------------------------------------------------------------------------
  //                                  Update
  //------------------------------------------------------------------------------
  updateCubeTextures(imageBitmaps, texture, width, height, format, invertY = false, premultiplyAlpha = false, offsetX = 0, offsetY = 0) {
    const faces = [0, 3, 1, 4, 2, 5];
    for (let f = 0; f < faces.length; ++f) {
      const imageBitmap = imageBitmaps[faces[f]];
      this.updateTexture(imageBitmap, texture, width, height, 1, format, f, 0, invertY, premultiplyAlpha, offsetX, offsetY);
    }
  }
  // TODO WEBGPU handle data source not being in the same format than the destination texture?
  updateTexture(imageBitmap, texture, width, height, layers, format, faceIndex = 0, mipLevel = 0, invertY = false, premultiplyAlpha = false, offsetX = 0, offsetY = 0, allowGPUOptimization) {
    const gpuTexture = WebGPUTextureHelper.IsInternalTexture(texture) ? texture._hardwareTexture.underlyingResource : texture;
    const blockInformation = WebGPUTextureHelper.GetBlockInformationFromFormat(format);
    const gpuOrHdwTexture = WebGPUTextureHelper.IsInternalTexture(texture) ? texture._hardwareTexture : texture;
    const textureCopyView = {
      texture: gpuTexture,
      origin: {
        x: offsetX,
        y: offsetY,
        z: Math.max(faceIndex, 0)
      },
      mipLevel,
      premultipliedAlpha: premultiplyAlpha
    };
    const textureExtent = {
      width: Math.ceil(width / blockInformation.width) * blockInformation.width,
      height: Math.ceil(height / blockInformation.height) * blockInformation.height,
      depthOrArrayLayers: layers || 1
    };
    if (imageBitmap.byteLength !== void 0) {
      imageBitmap = imageBitmap;
      const bytesPerRow = Math.ceil(width / blockInformation.width) * blockInformation.length;
      const aligned = Math.ceil(bytesPerRow / 256) * 256 === bytesPerRow;
      if (aligned) {
        const commandEncoder = this._device.createCommandEncoder({});
        const buffer = this._bufferManager.createRawBuffer(imageBitmap.byteLength, BufferUsage.MapWrite | BufferUsage.CopySrc, true, "TempBufferForUpdateTexture" + (gpuTexture ? "_" + gpuTexture.label : ""));
        const arrayBuffer = buffer.getMappedRange();
        new Uint8Array(arrayBuffer).set(imageBitmap);
        buffer.unmap();
        commandEncoder.copyBufferToTexture({
          buffer,
          offset: 0,
          bytesPerRow,
          rowsPerImage: textureExtent.height / blockInformation.height
        }, textureCopyView, textureExtent);
        this._device.queue.submit([commandEncoder.finish()]);
        this._bufferManager.releaseBuffer(buffer);
      } else {
        this._device.queue.writeTexture(textureCopyView, imageBitmap, {
          offset: 0,
          bytesPerRow,
          rowsPerImage: textureExtent.height / blockInformation.height
        }, textureExtent);
      }
      if (invertY || premultiplyAlpha) {
        if (WebGPUTextureHelper.IsInternalTexture(texture)) {
          const dontUseRect = offsetX === 0 && offsetY === 0 && width === texture.width && height === texture.height;
          this.invertYPreMultiplyAlpha(gpuOrHdwTexture, texture.width, texture.height, format, invertY, premultiplyAlpha, faceIndex, mipLevel, layers || 1, offsetX, offsetY, dontUseRect ? 0 : width, dontUseRect ? 0 : height, void 0, allowGPUOptimization);
        } else {
          throw "updateTexture: Can't process the texture data because a GPUTexture was provided instead of an InternalTexture!";
        }
      }
    } else {
      imageBitmap = imageBitmap;
      this._device.queue.copyExternalImageToTexture({ source: imageBitmap, flipY: invertY }, textureCopyView, textureExtent);
    }
  }
  updateMipLevelCountForInternalTexture(texture, mipLevelCount) {
    const maxNumMipLevels = WebGPUTextureHelper.ComputeNumMipmapLevels(texture.width, texture.height, texture.is3D ? texture.depth : 1);
    if (mipLevelCount !== void 0) {
      texture.mipLevelCount = Math.min(Math.max(1, mipLevelCount), maxNumMipLevels);
    } else if (texture.generateMipMaps) {
      texture.mipLevelCount = maxNumMipLevels;
    } else {
      texture.mipLevelCount = 1;
    }
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  readPixels(texture, x, y, width, height, format, faceIndex = 0, mipLevel = 0, buffer = null, noDataConversion = false) {
    const blockInformation = WebGPUTextureHelper.GetBlockInformationFromFormat(format);
    const bytesPerRow = Math.ceil(width / blockInformation.width) * blockInformation.length;
    const bytesPerRowAligned = Math.ceil(bytesPerRow / 256) * 256;
    const size = bytesPerRowAligned * height;
    const gpuBuffer = this._bufferManager.createRawBuffer(size, BufferUsage.MapRead | BufferUsage.CopyDst, void 0, "TempBufferForReadPixels" + (texture.label ? "_" + texture.label : ""));
    const commandEncoder = this._device.createCommandEncoder({});
    commandEncoder.copyTextureToBuffer({
      texture,
      mipLevel,
      origin: {
        x,
        y,
        z: Math.max(faceIndex, 0)
      }
    }, {
      buffer: gpuBuffer,
      offset: 0,
      bytesPerRow: bytesPerRowAligned
    }, {
      width,
      height,
      depthOrArrayLayers: 1
    });
    this._device.queue.submit([commandEncoder.finish()]);
    return this._bufferManager.readDataFromBuffer(gpuBuffer, size, width, height, bytesPerRow, bytesPerRowAligned, WebGPUTextureHelper.GetTextureTypeFromFormat(format), 0, buffer, true, noDataConversion);
  }
  //------------------------------------------------------------------------------
  //                              Dispose
  //------------------------------------------------------------------------------
  releaseTexture(texture) {
    if (WebGPUTextureHelper.IsInternalTexture(texture)) {
      const hardwareTexture = texture._hardwareTexture;
      const irradianceTexture = texture._irradianceTexture;
      this._deferredReleaseTextures.push([hardwareTexture, irradianceTexture]);
    } else {
      this._deferredReleaseTextures.push([texture, null]);
    }
  }
  destroyDeferredTextures() {
    for (let i = 0; i < this._deferredReleaseTextures.length; ++i) {
      const [hardwareTexture, irradianceTexture] = this._deferredReleaseTextures[i];
      if (hardwareTexture) {
        if (WebGPUTextureHelper.IsHardwareTexture(hardwareTexture)) {
          hardwareTexture.release();
        } else {
          hardwareTexture.destroy();
        }
      }
      irradianceTexture?.dispose();
    }
    this._deferredReleaseTextures.length = 0;
  }
}
class WebGPUDataBuffer extends DataBuffer {
  /** @internal */
  set buffer(buffer) {
    this._buffer = buffer;
  }
  /** @internal */
  constructor(resource, capacity = 0) {
    super();
    this.engineId = -1;
    this.capacity = capacity;
    if (resource) {
      this._buffer = resource;
    }
  }
  /** @internal */
  get underlyingResource() {
    return this._buffer;
  }
}
class WebGPUBufferManager {
  static _IsGPUBuffer(buffer) {
    return buffer.underlyingResource === void 0;
  }
  static _FlagsToString(flags, suffix = "") {
    let result = suffix;
    for (let i = 0; i <= 9; ++i) {
      if (flags & 1 << i) {
        if (result) {
          result += "_";
        }
        result += BufferUsage[1 << i];
      }
    }
    return result;
  }
  constructor(engine, device) {
    this._deferredReleaseBuffers = [];
    this._engine = engine;
    this._device = device;
  }
  createRawBuffer(viewOrSize, flags, mappedAtCreation = false, label) {
    const alignedLength = viewOrSize.byteLength !== void 0 ? viewOrSize.byteLength + 3 & -4 : viewOrSize + 3 & -4;
    const verticesBufferDescriptor = {
      label: "BabylonWebGPUDevice" + this._engine.uniqueId + "_" + WebGPUBufferManager._FlagsToString(flags, label ?? "Buffer") + "_size" + alignedLength,
      mappedAtCreation,
      size: alignedLength,
      usage: flags
    };
    return this._device.createBuffer(verticesBufferDescriptor);
  }
  createBuffer(viewOrSize, flags, label) {
    const isView = viewOrSize.byteLength !== void 0;
    const dataBuffer = new WebGPUDataBuffer();
    const labelId = "DataBufferUniqueId=" + dataBuffer.uniqueId;
    dataBuffer.buffer = this.createRawBuffer(viewOrSize, flags, void 0, label ? labelId + "-" + label : labelId);
    dataBuffer.references = 1;
    dataBuffer.capacity = viewOrSize.byteLength !== void 0 ? viewOrSize.byteLength + 3 & -4 : viewOrSize + 3 & -4;
    dataBuffer.engineId = this._engine.uniqueId;
    if (isView) {
      this.setSubData(dataBuffer, 0, viewOrSize);
    }
    return dataBuffer;
  }
  // This calls GPUBuffer.writeBuffer() with no alignment corrections
  // dstByteOffset and byteLength must both be aligned to 4 bytes and bytes moved must be within src and dst arrays
  setRawData(buffer, dstByteOffset, src, srcByteOffset, byteLength) {
    srcByteOffset += src.byteOffset;
    this._device.queue.writeBuffer(buffer, dstByteOffset, src.buffer, srcByteOffset, byteLength);
  }
  // This calls GPUBuffer.writeBuffer() with alignment corrections (dstByteOffset and byteLength will be aligned to 4 byte boundaries)
  // If alignment is needed, src must be a full copy of dataBuffer, or at least should be large enough to cope with the additional bytes copied because of alignment!
  setSubData(dataBuffer, dstByteOffset, src, srcByteOffset = 0, byteLength = 0) {
    const buffer = dataBuffer.underlyingResource;
    byteLength = byteLength || src.byteLength - srcByteOffset;
    const startPre = dstByteOffset & 3;
    srcByteOffset -= startPre;
    dstByteOffset -= startPre;
    const originalByteLength = byteLength;
    byteLength = byteLength + startPre + 3 & -4;
    const backingBufferSize = src.buffer.byteLength - src.byteOffset;
    if (backingBufferSize < byteLength) {
      const tmpBuffer = new Uint8Array(byteLength);
      tmpBuffer.set(new Uint8Array(src.buffer, src.byteOffset + srcByteOffset, originalByteLength));
      src = tmpBuffer;
      srcByteOffset = 0;
    }
    this.setRawData(buffer, dstByteOffset, src, srcByteOffset, byteLength);
  }
  _getHalfFloatAsFloatRGBAArrayBuffer(dataLength, arrayBuffer, destArray) {
    if (!destArray) {
      destArray = new Float32Array(dataLength);
    } else {
      dataLength = Math.min(dataLength, destArray.length);
    }
    const srcData = new Uint16Array(arrayBuffer);
    while (dataLength--) {
      destArray[dataLength] = FromHalfFloat(srcData[dataLength]);
    }
    return destArray;
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/promise-function-async
  readDataFromBuffer(gpuBuffer, size, width, height, bytesPerRow, bytesPerRowAligned, type = 0, offset = 0, buffer = null, destroyBuffer = true, noDataConversion = false) {
    const floatFormat = type === 1 ? 2 : type === 2 ? 1 : 0;
    const engineId = this._engine.uniqueId;
    return new Promise((resolve, reject) => {
      gpuBuffer.mapAsync(1, offset, size).then(() => {
        const copyArrayBuffer = gpuBuffer.getMappedRange(offset, size);
        let data = buffer;
        if (noDataConversion) {
          if (data === null) {
            data = allocateAndCopyTypedBuffer(type, size, true, copyArrayBuffer);
          } else {
            data = allocateAndCopyTypedBuffer(type, data.buffer, void 0, copyArrayBuffer);
          }
        } else {
          if (data === null) {
            switch (floatFormat) {
              case 0:
                data = new Uint8Array(size);
                data.set(new Uint8Array(copyArrayBuffer));
                break;
              case 1:
                data = this._getHalfFloatAsFloatRGBAArrayBuffer(size / 2, copyArrayBuffer);
                break;
              case 2:
                data = new Float32Array(size / 4);
                data.set(new Float32Array(copyArrayBuffer));
                break;
            }
          } else {
            switch (floatFormat) {
              case 0:
                data = new Uint8Array(data.buffer);
                data.set(new Uint8Array(copyArrayBuffer, 0, Math.min(data.byteLength, size)));
                break;
              case 1:
                data = this._getHalfFloatAsFloatRGBAArrayBuffer(size / 2, copyArrayBuffer, buffer);
                break;
              case 2:
                data = new Float32Array(data.buffer);
                data.set(new Float32Array(copyArrayBuffer, 0, data.byteLength / 4));
                break;
            }
          }
        }
        if (bytesPerRow !== bytesPerRowAligned) {
          if (floatFormat === 1 && !noDataConversion) {
            bytesPerRow *= 2;
            bytesPerRowAligned *= 2;
          }
          const data2 = new Uint8Array(data.buffer);
          let offset2 = bytesPerRow, offset22;
          for (let y = 1; y < height; ++y) {
            offset22 = y * bytesPerRowAligned;
            for (let x = 0; x < bytesPerRow; ++x) {
              data2[offset2++] = data2[offset22++];
            }
          }
          if (floatFormat !== 0 && !noDataConversion) {
            data = new Float32Array(data2.buffer, 0, offset2 / 4);
          } else {
            data = new Uint8Array(data2.buffer, 0, offset2);
          }
        }
        gpuBuffer.unmap();
        if (destroyBuffer) {
          this.releaseBuffer(gpuBuffer);
        }
        resolve(data);
      }, (reason) => {
        if (this._engine.isDisposed || this._engine.uniqueId !== engineId) {
          resolve(new Uint8Array());
        } else {
          reject(reason);
        }
      });
    });
  }
  releaseBuffer(buffer) {
    if (WebGPUBufferManager._IsGPUBuffer(buffer)) {
      this._deferredReleaseBuffers.push(buffer);
      return true;
    }
    buffer.references--;
    if (buffer.references === 0) {
      this._deferredReleaseBuffers.push(buffer.underlyingResource);
      return true;
    }
    return false;
  }
  destroyDeferredBuffers() {
    for (let i = 0; i < this._deferredReleaseBuffers.length; ++i) {
      this._deferredReleaseBuffers[i].destroy();
    }
    this._deferredReleaseBuffers.length = 0;
  }
}
const FilterToBits = [
  0 | 0 << 1 | 0 << 2,
  // not used
  0 | 0 << 1 | 0 << 2,
  // TEXTURE_NEAREST_SAMPLINGMODE / TEXTURE_NEAREST_NEAREST
  1 | 1 << 1 | 0 << 2,
  // TEXTURE_BILINEAR_SAMPLINGMODE / TEXTURE_LINEAR_LINEAR
  1 | 1 << 1 | 1 << 2,
  // TEXTURE_TRILINEAR_SAMPLINGMODE / TEXTURE_LINEAR_LINEAR_MIPLINEAR
  0 | 0 << 1 | 0 << 2,
  // TEXTURE_NEAREST_NEAREST_MIPNEAREST
  0 | 1 << 1 | 0 << 2,
  // TEXTURE_NEAREST_LINEAR_MIPNEAREST
  0 | 1 << 1 | 1 << 2,
  // TEXTURE_NEAREST_LINEAR_MIPLINEAR
  0 | 1 << 1 | 0 << 2,
  // TEXTURE_NEAREST_LINEAR
  0 | 0 << 1 | 1 << 2,
  // TEXTURE_NEAREST_NEAREST_MIPLINEAR
  1 | 0 << 1 | 0 << 2,
  // TEXTURE_LINEAR_NEAREST_MIPNEAREST
  1 | 0 << 1 | 1 << 2,
  // TEXTURE_LINEAR_NEAREST_MIPLINEAR
  1 | 1 << 1 | 0 << 2,
  // TEXTURE_LINEAR_LINEAR_MIPNEAREST
  1 | 0 << 1 | 0 << 2
  // TEXTURE_LINEAR_NEAREST
];
const ComparisonFunctionToBits = [
  0 << 3 | 0 << 4 | 0 << 5 | 0 << 6,
  // undefined
  0 << 3 | 0 << 4 | 0 << 5 | 1 << 6,
  // NEVER
  0 << 3 | 0 << 4 | 1 << 5 | 0 << 6,
  // LESS
  0 << 3 | 0 << 4 | 1 << 5 | 1 << 6,
  // EQUAL
  0 << 3 | 1 << 4 | 0 << 5 | 0 << 6,
  // LEQUAL
  0 << 3 | 1 << 4 | 0 << 5 | 1 << 6,
  // GREATER
  0 << 3 | 1 << 4 | 1 << 5 | 0 << 6,
  // NOTEQUAL
  0 << 3 | 1 << 4 | 1 << 5 | 1 << 6,
  // GEQUAL
  1 << 3 | 0 << 4 | 0 << 5 | 0 << 6
  // ALWAYS
];
const FilterNoMipToBits = [
  0 << 7,
  // not used
  1 << 7,
  // TEXTURE_NEAREST_SAMPLINGMODE / TEXTURE_NEAREST_NEAREST
  1 << 7,
  // TEXTURE_BILINEAR_SAMPLINGMODE / TEXTURE_LINEAR_LINEAR
  0 << 7,
  // TEXTURE_TRILINEAR_SAMPLINGMODE / TEXTURE_LINEAR_LINEAR_MIPLINEAR
  0 << 7,
  // TEXTURE_NEAREST_NEAREST_MIPNEAREST
  0 << 7,
  // TEXTURE_NEAREST_LINEAR_MIPNEAREST
  0 << 7,
  // TEXTURE_NEAREST_LINEAR_MIPLINEAR
  1 << 7,
  // TEXTURE_NEAREST_LINEAR
  0 << 7,
  // TEXTURE_NEAREST_NEAREST_MIPLINEAR
  0 << 7,
  // TEXTURE_LINEAR_NEAREST_MIPNEAREST
  0 << 7,
  // TEXTURE_LINEAR_NEAREST_MIPLINEAR
  0 << 7,
  // TEXTURE_LINEAR_LINEAR_MIPNEAREST
  1 << 7
  // TEXTURE_LINEAR_NEAREST
];
class WebGPUCacheSampler {
  constructor(device) {
    this._samplers = {};
    this._device = device;
    this.disabled = false;
  }
  static GetSamplerHashCode(sampler) {
    const anisotropy = sampler._cachedAnisotropicFilteringLevel ? sampler._cachedAnisotropicFilteringLevel : 1;
    const code = FilterToBits[sampler.samplingMode] + ComparisonFunctionToBits[(sampler._comparisonFunction || 514) - 512 + 1] + FilterNoMipToBits[sampler.samplingMode] + // handle the lodMinClamp = lodMaxClamp = 0 case when no filter used for mip mapping
    ((sampler._cachedWrapU ?? 1) << 8) + ((sampler._cachedWrapV ?? 1) << 10) + ((sampler._cachedWrapR ?? 1) << 12) + ((sampler.useMipMaps ? 1 : 0) << 14) + // need to factor this in because _getSamplerFilterDescriptor depends on samplingMode AND useMipMaps!
    (anisotropy << 15);
    return code;
  }
  static _GetSamplerFilterDescriptor(sampler, anisotropy) {
    let magFilter, minFilter, mipmapFilter, lodMinClamp, lodMaxClamp;
    const useMipMaps = sampler.useMipMaps;
    switch (sampler.samplingMode) {
      case 11:
        magFilter = "linear";
        minFilter = "linear";
        mipmapFilter = "nearest";
        if (!useMipMaps) {
          lodMinClamp = lodMaxClamp = 0;
        }
        break;
      /* case 3: */
      // same value as below
      case 3:
        magFilter = "linear";
        minFilter = "linear";
        if (!useMipMaps) {
          mipmapFilter = "nearest";
          lodMinClamp = lodMaxClamp = 0;
        } else {
          mipmapFilter = "linear";
        }
        break;
      case 8:
        magFilter = "nearest";
        minFilter = "nearest";
        if (!useMipMaps) {
          mipmapFilter = "nearest";
          lodMinClamp = lodMaxClamp = 0;
        } else {
          mipmapFilter = "linear";
        }
        break;
      case 4:
        magFilter = "nearest";
        minFilter = "nearest";
        mipmapFilter = "nearest";
        if (!useMipMaps) {
          lodMinClamp = lodMaxClamp = 0;
        }
        break;
      case 5:
        magFilter = "nearest";
        minFilter = "linear";
        mipmapFilter = "nearest";
        if (!useMipMaps) {
          lodMinClamp = lodMaxClamp = 0;
        }
        break;
      case 6:
        magFilter = "nearest";
        minFilter = "linear";
        if (!useMipMaps) {
          mipmapFilter = "nearest";
          lodMinClamp = lodMaxClamp = 0;
        } else {
          mipmapFilter = "linear";
        }
        break;
      case 7:
        magFilter = "nearest";
        minFilter = "linear";
        mipmapFilter = "nearest";
        lodMinClamp = lodMaxClamp = 0;
        break;
      /* case 1: */
      // same value as below
      case 1:
        magFilter = "nearest";
        minFilter = "nearest";
        mipmapFilter = "nearest";
        lodMinClamp = lodMaxClamp = 0;
        break;
      case 9:
        magFilter = "linear";
        minFilter = "nearest";
        mipmapFilter = "nearest";
        if (!useMipMaps) {
          lodMinClamp = lodMaxClamp = 0;
        }
        break;
      case 10:
        magFilter = "linear";
        minFilter = "nearest";
        if (!useMipMaps) {
          mipmapFilter = "nearest";
          lodMinClamp = lodMaxClamp = 0;
        } else {
          mipmapFilter = "linear";
        }
        break;
      /* case 2: */
      // same value as below
      case 2:
        magFilter = "linear";
        minFilter = "linear";
        if (anisotropy > 1) {
          mipmapFilter = "linear";
        } else {
          mipmapFilter = "nearest";
          lodMinClamp = lodMaxClamp = 0;
        }
        break;
      case 12:
        magFilter = "linear";
        minFilter = "nearest";
        mipmapFilter = "nearest";
        lodMinClamp = lodMaxClamp = 0;
        break;
      default:
        magFilter = "nearest";
        minFilter = "nearest";
        mipmapFilter = "nearest";
        lodMinClamp = lodMaxClamp = 0;
        break;
    }
    if (anisotropy > 1 && (lodMinClamp !== 0 || lodMaxClamp !== 0)) {
      return {
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
        anisotropyEnabled: true
      };
    }
    return {
      magFilter,
      minFilter,
      mipmapFilter,
      lodMinClamp,
      lodMaxClamp
    };
  }
  static _GetWrappingMode(mode) {
    switch (mode) {
      case 1:
        return "repeat";
      case 0:
        return "clamp-to-edge";
      case 2:
        return "mirror-repeat";
    }
    return "repeat";
  }
  static _GetSamplerWrappingDescriptor(sampler) {
    return {
      addressModeU: this._GetWrappingMode(sampler._cachedWrapU),
      addressModeV: this._GetWrappingMode(sampler._cachedWrapV),
      addressModeW: this._GetWrappingMode(sampler._cachedWrapR)
    };
  }
  static _GetSamplerDescriptor(sampler, label) {
    let anisotropy = (sampler.useMipMaps || sampler.samplingMode === 2) && sampler._cachedAnisotropicFilteringLevel ? sampler._cachedAnisotropicFilteringLevel : 1;
    if (sampler.samplingMode !== 11 && sampler.samplingMode !== 3 && sampler.samplingMode !== 2) {
      anisotropy = 1;
    }
    const filterDescriptor = this._GetSamplerFilterDescriptor(sampler, anisotropy);
    return {
      label,
      ...filterDescriptor,
      ...this._GetSamplerWrappingDescriptor(sampler),
      compare: sampler._comparisonFunction ? WebGPUCacheSampler.GetCompareFunction(sampler._comparisonFunction) : void 0,
      maxAnisotropy: filterDescriptor.anisotropyEnabled ? anisotropy : 1
    };
  }
  static GetCompareFunction(compareFunction) {
    switch (compareFunction) {
      case 519:
        return "always";
      case 514:
        return "equal";
      case 516:
        return "greater";
      case 518:
        return "greater-equal";
      case 513:
        return "less";
      case 515:
        return "less-equal";
      case 512:
        return "never";
      case 517:
        return "not-equal";
      default:
        return "less";
    }
  }
  getSampler(sampler, bypassCache = false, hash = 0, label) {
    if (this.disabled) {
      return this._device.createSampler(WebGPUCacheSampler._GetSamplerDescriptor(sampler, label));
    }
    if (bypassCache) {
      hash = 0;
    } else if (hash === 0) {
      hash = WebGPUCacheSampler.GetSamplerHashCode(sampler);
    }
    let gpuSampler = bypassCache ? void 0 : this._samplers[hash];
    if (!gpuSampler) {
      gpuSampler = this._device.createSampler(WebGPUCacheSampler._GetSamplerDescriptor(sampler, label));
      if (!bypassCache) {
        this._samplers[hash] = gpuSampler;
      }
    }
    return gpuSampler;
  }
}
const VertexBufferKindForNonFloatProcessing = {
  [VertexBuffer.PositionKind]: true,
  [VertexBuffer.NormalKind]: true,
  [VertexBuffer.TangentKind]: true,
  [VertexBuffer.UVKind]: true,
  [VertexBuffer.UV2Kind]: true,
  [VertexBuffer.UV3Kind]: true,
  [VertexBuffer.UV4Kind]: true,
  [VertexBuffer.UV5Kind]: true,
  [VertexBuffer.UV6Kind]: true,
  [VertexBuffer.ColorKind]: true,
  [VertexBuffer.ColorInstanceKind]: true,
  [VertexBuffer.MatricesIndicesKind]: true,
  [VertexBuffer.MatricesWeightsKind]: true,
  [VertexBuffer.MatricesIndicesExtraKind]: true,
  [VertexBuffer.MatricesWeightsExtraKind]: true
};
function IsSignedType(type) {
  switch (type) {
    case VertexBuffer.BYTE:
    case VertexBuffer.SHORT:
    case VertexBuffer.INT:
    case VertexBuffer.FLOAT:
    case VertexBuffer.HALF_FLOAT:
      return true;
    case VertexBuffer.UNSIGNED_BYTE:
    case VertexBuffer.UNSIGNED_SHORT:
    case VertexBuffer.UNSIGNED_INT:
      return false;
    default:
      throw new Error(`Invalid type '${type}'`);
  }
}
function checkNonFloatVertexBuffers(vertexBuffers, effect) {
  const engine = effect.getEngine();
  const pipelineContext = effect._pipelineContext;
  if (!pipelineContext?.vertexBufferKindToType) {
    return;
  }
  let shaderProcessingContext = null;
  for (const kind in vertexBuffers) {
    const currentVertexBuffer = vertexBuffers[kind];
    if (!currentVertexBuffer || !VertexBufferKindForNonFloatProcessing[kind]) {
      continue;
    }
    const currentVertexBufferType = currentVertexBuffer.normalized || currentVertexBuffer.type === VertexBuffer.HALF_FLOAT ? VertexBuffer.FLOAT : currentVertexBuffer.type;
    const vertexBufferType = pipelineContext.vertexBufferKindToType[kind];
    if (currentVertexBufferType !== VertexBuffer.FLOAT && vertexBufferType === void 0 || vertexBufferType !== void 0 && vertexBufferType !== currentVertexBufferType) {
      if (!shaderProcessingContext) {
        shaderProcessingContext = engine._getShaderProcessingContext(effect.shaderLanguage, false);
      }
      pipelineContext.vertexBufferKindToType[kind] = currentVertexBufferType;
      if (currentVertexBufferType !== VertexBuffer.FLOAT) {
        shaderProcessingContext.vertexBufferKindToNumberOfComponents[kind] = VertexBufferDeduceStride(kind);
        if (IsSignedType(currentVertexBufferType)) {
          shaderProcessingContext.vertexBufferKindToNumberOfComponents[kind] *= -1;
        }
      }
    }
  }
  if (shaderProcessingContext) {
    const parallelShaderCompile = engine._caps.parallelShaderCompile;
    engine._caps.parallelShaderCompile = void 0;
    effect._processShaderCodeAsync(null, engine._features._checkNonFloatVertexBuffersDontRecreatePipelineContext, shaderProcessingContext);
    engine._caps.parallelShaderCompile = parallelShaderCompile;
  }
}
var StatePosition;
(function(StatePosition2) {
  StatePosition2[StatePosition2["StencilReadMask"] = 0] = "StencilReadMask";
  StatePosition2[StatePosition2["StencilWriteMask"] = 1] = "StencilWriteMask";
  StatePosition2[StatePosition2["DepthBias"] = 2] = "DepthBias";
  StatePosition2[StatePosition2["DepthBiasSlopeScale"] = 3] = "DepthBiasSlopeScale";
  StatePosition2[StatePosition2["DepthStencilState"] = 4] = "DepthStencilState";
  StatePosition2[StatePosition2["MRTAttachments"] = 5] = "MRTAttachments";
  StatePosition2[StatePosition2["RasterizationState"] = 6] = "RasterizationState";
  StatePosition2[StatePosition2["ColorStates1"] = 7] = "ColorStates1";
  StatePosition2[StatePosition2["ColorStates2"] = 8] = "ColorStates2";
  StatePosition2[StatePosition2["ColorStates3"] = 9] = "ColorStates3";
  StatePosition2[StatePosition2["ColorStates4"] = 10] = "ColorStates4";
  StatePosition2[StatePosition2["ShaderStage"] = 11] = "ShaderStage";
  StatePosition2[StatePosition2["TextureStage"] = 12] = "TextureStage";
  StatePosition2[StatePosition2["VertexState"] = 13] = "VertexState";
  StatePosition2[StatePosition2["NumStates"] = 14] = "NumStates";
})(StatePosition || (StatePosition = {}));
const alphaBlendFactorToIndex = {
  0: 1,
  // Zero
  1: 2,
  // One
  768: 3,
  // SrcColor
  769: 4,
  // OneMinusSrcColor
  770: 5,
  // SrcAlpha
  771: 6,
  // OneMinusSrcAlpha
  772: 7,
  // DstAlpha
  773: 8,
  // OneMinusDstAlpha
  774: 9,
  // DstColor
  775: 10,
  // OneMinusDstColor
  776: 11,
  // SrcAlphaSaturated
  32769: 12,
  // BlendColor
  32770: 13,
  // OneMinusBlendColor
  32771: 14,
  // BlendColor (alpha)
  32772: 15,
  // OneMinusBlendColor (alpha)
  35065: 16,
  // Src1Color
  35066: 17,
  // OneMinusSrc1Color
  34185: 18,
  // Src1Alpha
  35067: 19
  // OneMinusSrc1Alpha
};
const alphaBlendEquationToIndex = {
  32774: 0,
  // Add
  32775: 1,
  // Min
  32776: 2,
  // Max
  32778: 3,
  // Subtract
  32779: 4
  // ReverseSubtract
};
const stencilOpToIndex = {
  0: 0,
  // ZERO
  7680: 1,
  // KEEP
  7681: 2,
  // REPLACE
  7682: 3,
  // INCR
  7683: 4,
  // DECR
  5386: 5,
  // INVERT
  34055: 6,
  // INCR_WRAP
  34056: 7
  // DECR_WRAP
};
const colorStates = [0, 0, 0, 0];
const vertexBufferLayoutContinuation = 1 << 26;
class WebGPUCacheRenderPipeline {
  constructor(device, emptyVertexBuffer) {
    this._depthBiasClamp = 0;
    this.mrtTextureCount = 0;
    this._device = device;
    this._useTextureStage = true;
    this._states = new Array(StatePosition.VertexState + 2 * (device.limits.maxVertexAttributes || 16));
    this._statesLength = 0;
    this._stateDirtyLowestIndex = 0;
    this._emptyVertexBuffer = emptyVertexBuffer;
    this._mrtFormats = [];
    this._parameter = { token: void 0, pipeline: null };
    this.disabled = false;
    this.vertexBuffers = [];
    this._kMaxVertexBufferStride = device.limits.maxVertexBufferArrayStride || 2048;
    this.reset();
  }
  reset() {
    this._isDirty = true;
    this.vertexBuffers.length = 0;
    this.setAlphaToCoverage(false);
    this.resetDepthCullingState();
    this.setClampDepth(false);
    this.setDepthBias(0);
    this._webgpuColorFormat = [
      "bgra8unorm"
      /* WebGPUConstants.TextureFormat.BGRA8Unorm */
    ];
    this.setColorFormat(
      "bgra8unorm"
      /* WebGPUConstants.TextureFormat.BGRA8Unorm */
    );
    this.setMRT([]);
    this.setAlphaBlendEnabled([false], 1);
    this.setAlphaBlendFactors([null, null, null, null], [null, null]);
    this.setWriteMask(15);
    this.setDepthStencilFormat(
      "depth24plus-stencil8"
      /* WebGPUConstants.TextureFormat.Depth24PlusStencil8 */
    );
    this.setStencilEnabled(false);
    this.resetStencilState();
    this.setBuffers(null, null, null);
    this._setTextureState(0);
  }
  get colorFormats() {
    return this._mrtAttachments > 0 ? this._mrtFormats : this._webgpuColorFormat;
  }
  /**
   * Performs the cache state setup and lookup for a render pipeline.
   * @param fillMode defines the fill mode used to configure the rasterization state
   * @param effect defines the effect containing the shader and vertex input layout
   * @param sampleCount defines the number of samples to use for MSAA
   * @param textureState defines the encoded texture state used for the pipeline cache key
   * @returns the cached pipeline on hit, or null on miss (with cache state ready for creation)
   */
  _lookupRenderPipeline(fillMode, effect, sampleCount, textureState) {
    this._setShaderStage(effect.uniqueId);
    this._setRasterizationState(fillMode, sampleCount);
    this._setColorStates();
    this._setDepthStencilState();
    this._setVertexState(effect);
    this._setTextureState(textureState);
    this.lastStateDirtyLowestIndex = this._stateDirtyLowestIndex;
    if (!this._isDirty && this._parameter.pipeline) {
      this._stateDirtyLowestIndex = this._statesLength;
      WebGPUCacheRenderPipeline.NumCacheHitWithoutHash++;
      return this._parameter.pipeline;
    }
    this._getRenderPipeline(this._parameter);
    this._isDirty = false;
    this._stateDirtyLowestIndex = this._statesLength;
    if (this._parameter.pipeline) {
      WebGPUCacheRenderPipeline.NumCacheHitWithHash++;
      return this._parameter.pipeline;
    }
    return null;
  }
  getRenderPipeline(fillMode, effect, sampleCount, textureState = 0) {
    sampleCount = WebGPUTextureHelper.GetSample(sampleCount);
    if (this.disabled) {
      const topology2 = WebGPUCacheRenderPipeline._GetTopology(fillMode);
      this._setVertexState(effect);
      this._setTextureState(textureState);
      this._parameter.pipeline = this._createRenderPipeline(effect, topology2, sampleCount);
      WebGPUCacheRenderPipeline.NumCacheMiss++;
      WebGPUCacheRenderPipeline._NumPipelineCreationCurrentFrame++;
      return this._parameter.pipeline;
    }
    const cached = this._lookupRenderPipeline(fillMode, effect, sampleCount, textureState);
    if (cached) {
      return cached;
    }
    const topology = WebGPUCacheRenderPipeline._GetTopology(fillMode);
    this._parameter.pipeline = this._createRenderPipeline(effect, topology, sampleCount);
    this._setRenderPipeline(this._parameter);
    WebGPUCacheRenderPipeline.NumCacheMiss++;
    WebGPUCacheRenderPipeline._NumPipelineCreationCurrentFrame++;
    return this._parameter.pipeline;
  }
  endFrame() {
    WebGPUCacheRenderPipeline.NumPipelineCreationLastFrame = WebGPUCacheRenderPipeline._NumPipelineCreationCurrentFrame;
    WebGPUCacheRenderPipeline._NumPipelineCreationCurrentFrame = 0;
  }
  setAlphaToCoverage(enabled) {
    this._alphaToCoverageEnabled = enabled;
  }
  setFrontFace(frontFace) {
    this._frontFace = frontFace;
  }
  setCullEnabled(enabled) {
    this._cullEnabled = enabled;
  }
  setCullFace(cullFace) {
    this._cullFace = cullFace;
  }
  setClampDepth(clampDepth) {
    this._clampDepth = clampDepth;
  }
  resetDepthCullingState() {
    this.setDepthCullingState(false, 2, 1, 0, 0, true, true, 519);
  }
  setDepthCullingState(cullEnabled, frontFace, cullFace, zOffset, zOffsetUnits, depthTestEnabled, depthWriteEnabled, depthCompare) {
    this._depthWriteEnabled = depthWriteEnabled;
    this._depthTestEnabled = depthTestEnabled;
    this._depthCompare = (depthCompare ?? 519) - 512;
    this._cullFace = cullFace;
    this._cullEnabled = cullEnabled;
    this._frontFace = frontFace;
    this.setDepthBiasSlopeScale(zOffset);
    this.setDepthBias(zOffsetUnits);
  }
  setDepthBias(depthBias) {
    if (this._depthBias !== depthBias) {
      this._depthBias = depthBias;
      this._states[StatePosition.DepthBias] = depthBias;
      this._isDirty = true;
      this._stateDirtyLowestIndex = Math.min(this._stateDirtyLowestIndex, StatePosition.DepthBias);
    }
  }
  /*public setDepthBiasClamp(depthBiasClamp: number): void {
      if (this._depthBiasClamp !== depthBiasClamp) {
          this._depthBiasClamp = depthBiasClamp;
          this._states[StatePosition.DepthBiasClamp] = depthBiasClamp.toString();
          this._isDirty = true;
      }
  }*/
  setDepthBiasSlopeScale(depthBiasSlopeScale) {
    if (this._depthBiasSlopeScale !== depthBiasSlopeScale) {
      this._depthBiasSlopeScale = depthBiasSlopeScale;
      this._states[StatePosition.DepthBiasSlopeScale] = depthBiasSlopeScale;
      this._isDirty = true;
      this._stateDirtyLowestIndex = Math.min(this._stateDirtyLowestIndex, StatePosition.DepthBiasSlopeScale);
    }
  }
  setColorFormat(format) {
    this._webgpuColorFormat[0] = format;
    this._colorFormat = renderableTextureFormatToIndex[format ?? ""];
  }
  // Must be called after setMRT!
  setMRTAttachments(attachments) {
    this.mrtAttachments = attachments;
    let mask = 0;
    for (let i = 0; i < attachments.length; ++i) {
      if (attachments[i] !== 0) {
        mask += 1 << i;
      }
    }
    if (this._mrtEnabledMask !== mask) {
      this._mrtEnabledMask = mask;
      this._isDirty = true;
      this._stateDirtyLowestIndex = Math.min(this._stateDirtyLowestIndex, StatePosition.MRTAttachments);
    }
  }
  setMRT(textureArray, textureCount) {
    textureCount = textureCount ?? textureArray.length;
    if (textureCount > 8) {
      throw new Error("Can't handle more than 8 attachments for a MRT in cache render pipeline!");
    }
    this.mrtTextureArray = textureArray;
    this.mrtTextureCount = textureCount;
    this._mrtEnabledMask = 65535;
    let mrtAttachments = 0;
    let mask = 0;
    for (let i = 0; i < textureCount; ++i) {
      const texture = textureArray[i];
      const gpuWrapper = texture?._hardwareTexture;
      this._mrtFormats[i] = gpuWrapper?.format ?? this._webgpuColorFormat[0];
      mrtAttachments += renderableTextureFormatToIndex[this._mrtFormats[i] ?? ""] * 2 ** mask;
      mask += 6;
    }
    this._mrtFormats.length = textureCount;
    if (this._mrtAttachments !== mrtAttachments) {
      this._mrtAttachments = mrtAttachments;
      this._states[StatePosition.MRTAttachments] = mrtAttachments;
      this._isDirty = true;
      this._stateDirtyLowestIndex = Math.min(this._stateDirtyLowestIndex, StatePosition.MRTAttachments);
    }
  }
  setAlphaBlendEnabled(enabled, numAlphaBlendTargetsEnabled) {
    this._alphaBlendEnabled = enabled;
    this._numAlphaBlendTargetsEnabled = numAlphaBlendTargetsEnabled;
  }
  setAlphaBlendFactors(factors, operations) {
    this._alphaBlendFuncParams = factors;
    this._alphaBlendEqParams = operations;
  }
  setWriteMask(mask) {
    this._writeMask = mask;
  }
  setDepthStencilFormat(format) {
    this._webgpuDepthStencilFormat = format;
    this._depthStencilFormat = format === void 0 ? 0 : renderableTextureFormatToIndex[format];
  }
  setDepthTestEnabled(enabled) {
    this._depthTestEnabled = enabled;
  }
  setDepthWriteEnabled(enabled) {
    this._depthWriteEnabled = enabled;
  }
  setDepthCompare(func) {
    this._depthCompare = (func ?? 519) - 512;
  }
  setStencilEnabled(enabled) {
    this._stencilEnabled = enabled;
  }
  setStencilCompare(func) {
    this._stencilFrontCompare = (func ?? 519) - 512;
  }
  setStencilDepthFailOp(op) {
    this._stencilFrontDepthFailOp = op === null ? 1 : stencilOpToIndex[op];
  }
  setStencilPassOp(op) {
    this._stencilFrontPassOp = op === null ? 2 : stencilOpToIndex[op];
  }
  setStencilFailOp(op) {
    this._stencilFrontFailOp = op === null ? 1 : stencilOpToIndex[op];
  }
  setStencilBackCompare(func) {
    this._stencilBackCompare = (func ?? 519) - 512;
  }
  setStencilBackDepthFailOp(op) {
    this._stencilBackDepthFailOp = op === null ? 1 : stencilOpToIndex[op];
  }
  setStencilBackPassOp(op) {
    this._stencilBackPassOp = op === null ? 2 : stencilOpToIndex[op];
  }
  setStencilBackFailOp(op) {
    this._stencilBackFailOp = op === null ? 1 : stencilOpToIndex[op];
  }
  setStencilReadMask(mask) {
    if (this._stencilReadMask !== mask) {
      this._stencilReadMask = mask;
      this._states[StatePosition.StencilReadMask] = mask;
      this._isDirty = true;
      this._stateDirtyLowestIndex = Math.min(this._stateDirtyLowestIndex, StatePosition.StencilReadMask);
    }
  }
  setStencilWriteMask(mask) {
    if (this._stencilWriteMask !== mask) {
      this._stencilWriteMask = mask;
      this._states[StatePosition.StencilWriteMask] = mask;
      this._isDirty = true;
      this._stateDirtyLowestIndex = Math.min(this._stateDirtyLowestIndex, StatePosition.StencilWriteMask);
    }
  }
  resetStencilState() {
    this.setStencilState(false, 519, 7680, 7681, 7680, 255, 255);
  }
  setStencilState(stencilEnabled, compare, depthFailOp, passOp, failOp, readMask, writeMask, backCompare = null, backDepthFailOp = null, backPassOp = null, backFailOp = null) {
    this._stencilEnabled = stencilEnabled;
    this._stencilFrontCompare = (compare ?? 519) - 512;
    this._stencilFrontDepthFailOp = depthFailOp === null ? 1 : stencilOpToIndex[depthFailOp];
    this._stencilFrontPassOp = passOp === null ? 2 : stencilOpToIndex[passOp];
    this._stencilFrontFailOp = failOp === null ? 1 : stencilOpToIndex[failOp];
    this._stencilBackCompare = (backCompare ?? 519) - 512;
    this._stencilBackDepthFailOp = backDepthFailOp === null ? 1 : stencilOpToIndex[backDepthFailOp];
    this._stencilBackPassOp = backPassOp === null ? 2 : stencilOpToIndex[backPassOp];
    this._stencilBackFailOp = backFailOp === null ? 1 : stencilOpToIndex[backFailOp];
    this.setStencilReadMask(readMask);
    this.setStencilWriteMask(writeMask);
  }
  setBuffers(vertexBuffers, indexBuffer, overrideVertexBuffers) {
    this._vertexBuffers = vertexBuffers;
    this._overrideVertexBuffers = overrideVertexBuffers;
    this.indexBuffer = indexBuffer;
  }
  static _GetTopology(fillMode) {
    switch (fillMode) {
      // Triangle views
      case 0:
        return "triangle-list";
      case 2:
        return "point-list";
      case 1:
        return "line-list";
      // Draw modes
      case 3:
        return "point-list";
      case 4:
        return "line-list";
      case 5:
        throw "LineLoop is an unsupported fillmode in WebGPU";
      case 6:
        return "line-strip";
      case 7:
        return "triangle-strip";
      case 8:
        throw "TriangleFan is an unsupported fillmode in WebGPU";
      default:
        return "triangle-list";
    }
  }
  static _GetAphaBlendOperation(operation) {
    switch (operation) {
      case 32774:
        return "add";
      case 32778:
        return "subtract";
      case 32779:
        return "reverse-subtract";
      case 32775:
        return "min";
      case 32776:
        return "max";
      default:
        return "add";
    }
  }
  static _GetAphaBlendFactor(factor) {
    switch (factor) {
      case 0:
        return "zero";
      case 1:
        return "one";
      case 768:
        return "src";
      case 769:
        return "one-minus-src";
      case 770:
        return "src-alpha";
      case 771:
        return "one-minus-src-alpha";
      case 772:
        return "dst-alpha";
      case 773:
        return "one-minus-dst-alpha";
      case 774:
        return "dst";
      case 775:
        return "one-minus-dst";
      case 776:
        return "src-alpha-saturated";
      case 32769:
      case 32771:
        return "constant";
      case 32770:
      case 32772:
        return "one-minus-constant";
      case 35065:
        return "src1";
      case 35066:
        return "one-minus-src1";
      case 34185:
        return "src1-alpha";
      case 35067:
        return "one-minus-src1-alpha";
      default:
        return "one";
    }
  }
  static _GetCompareFunction(compareFunction) {
    switch (compareFunction) {
      case 0:
        return "never";
      case 1:
        return "less";
      case 2:
        return "equal";
      case 3:
        return "less-equal";
      case 4:
        return "greater";
      case 5:
        return "not-equal";
      case 6:
        return "greater-equal";
      case 7:
        return "always";
    }
    return "never";
  }
  static _GetStencilOpFunction(operation) {
    switch (operation) {
      case 0:
        return "zero";
      case 1:
        return "keep";
      case 2:
        return "replace";
      case 3:
        return "increment-clamp";
      case 4:
        return "decrement-clamp";
      case 5:
        return "invert";
      case 6:
        return "increment-wrap";
      case 7:
        return "decrement-wrap";
    }
    return "keep";
  }
  static _GetVertexInputDescriptorFormat(vertexBuffer) {
    const type = vertexBuffer.type;
    const normalized = vertexBuffer.normalized;
    const size = vertexBuffer.getSize();
    switch (type) {
      case VertexBuffer.BYTE:
        switch (size) {
          case 1:
          case 2:
            return normalized ? "snorm8x2" : "sint8x2";
          case 3:
          case 4:
            return normalized ? "snorm8x4" : "sint8x4";
        }
        break;
      case VertexBuffer.UNSIGNED_BYTE:
        switch (size) {
          case 1:
          case 2:
            return normalized ? "unorm8x2" : "uint8x2";
          case 3:
          case 4:
            return normalized ? "unorm8x4" : "uint8x4";
        }
        break;
      case VertexBuffer.SHORT:
        switch (size) {
          case 1:
          case 2:
            return normalized ? "snorm16x2" : "sint16x2";
          case 3:
          case 4:
            return normalized ? "snorm16x4" : "sint16x4";
        }
        break;
      case VertexBuffer.UNSIGNED_SHORT:
        switch (size) {
          case 1:
          case 2:
            return normalized ? "unorm16x2" : "uint16x2";
          case 3:
          case 4:
            return normalized ? "unorm16x4" : "uint16x4";
        }
        break;
      case VertexBuffer.HALF_FLOAT:
        switch (size) {
          case 1:
          case 2:
            return "float16x2";
          case 3:
          case 4:
            return "float16x4";
        }
        break;
      case VertexBuffer.INT:
        switch (size) {
          case 1:
            return "sint32";
          case 2:
            return "sint32x2";
          case 3:
            return "sint32x3";
          case 4:
            return "sint32x4";
        }
        break;
      case VertexBuffer.UNSIGNED_INT:
        switch (size) {
          case 1:
            return "uint32";
          case 2:
            return "uint32x2";
          case 3:
            return "uint32x3";
          case 4:
            return "uint32x4";
        }
        break;
      case VertexBuffer.FLOAT:
        switch (size) {
          case 1:
            return "float32";
          case 2:
            return "float32x2";
          case 3:
            return "float32x3";
          case 4:
            return "float32x4";
        }
        break;
    }
    throw new Error(`Invalid Format '${vertexBuffer.getKind()}' - type=${type}, normalized=${normalized}, size=${size}`);
  }
  _getAphaBlendState(targetIndex) {
    if (!this._alphaBlendEnabled[targetIndex]) {
      return null;
    }
    return {
      srcFactor: WebGPUCacheRenderPipeline._GetAphaBlendFactor(this._alphaBlendFuncParams[targetIndex * 4 + 2]),
      dstFactor: WebGPUCacheRenderPipeline._GetAphaBlendFactor(this._alphaBlendFuncParams[targetIndex * 4 + 3]),
      operation: WebGPUCacheRenderPipeline._GetAphaBlendOperation(this._alphaBlendEqParams[targetIndex * 2 + 1])
    };
  }
  _getColorBlendState(targetIndex) {
    if (!this._alphaBlendEnabled) {
      return null;
    }
    return {
      srcFactor: WebGPUCacheRenderPipeline._GetAphaBlendFactor(this._alphaBlendFuncParams[targetIndex * 4 + 0]),
      dstFactor: WebGPUCacheRenderPipeline._GetAphaBlendFactor(this._alphaBlendFuncParams[targetIndex * 4 + 1]),
      operation: WebGPUCacheRenderPipeline._GetAphaBlendOperation(this._alphaBlendEqParams[targetIndex * 2 + 0])
    };
  }
  _setShaderStage(id) {
    if (this._shaderId !== id) {
      this._shaderId = id;
      this._states[StatePosition.ShaderStage] = id;
      this._isDirty = true;
      this._stateDirtyLowestIndex = Math.min(this._stateDirtyLowestIndex, StatePosition.ShaderStage);
    }
  }
  _setRasterizationState(topology, sampleCount) {
    const frontFace = this._frontFace;
    const cullMode = this._cullEnabled ? this._cullFace : 0;
    const clampDepth = this._clampDepth ? 1 : 0;
    const alphaToCoverage = this._alphaToCoverageEnabled && sampleCount > 1 ? 1 : 0;
    const rasterizationState = frontFace - 1 + (cullMode << 1) + (clampDepth << 3) + (alphaToCoverage << 4) + (topology << 5) + (sampleCount << 8);
    if (this._rasterizationState !== rasterizationState) {
      this._rasterizationState = rasterizationState;
      this._states[StatePosition.RasterizationState] = this._rasterizationState;
      this._isDirty = true;
      this._stateDirtyLowestIndex = Math.min(this._stateDirtyLowestIndex, StatePosition.RasterizationState);
    }
  }
  _setColorStates() {
    colorStates[0] = (this._writeMask ? 1 : 0) * 2 ** 53;
    colorStates[1] = (this._depthWriteEnabled ? 1 : 0) * 2 ** 53;
    colorStates[2] = (this._colorFormat & 7) * 2 ** 50;
    colorStates[3] = (this._colorFormat & 56) * 2 ** 47;
    let colorStateIndex = 0;
    let isDirty = false;
    for (let i = 0; i < 8; i++) {
      if (this._alphaBlendEnabled[i]) {
        const index0 = i * 4 + 0;
        const index1 = i * 4 + 1;
        const index2 = i * 4 + 2;
        const index3 = i * 4 + 3;
        const indexEq0 = i * 2 + 0;
        const indexEq1 = i * 2 + 1;
        const eq0 = this._alphaBlendEqParams[indexEq0] === null ? 0 : alphaBlendEquationToIndex[this._alphaBlendEqParams[indexEq0]];
        const eq1 = this._alphaBlendEqParams[indexEq1] === null ? 0 : alphaBlendEquationToIndex[this._alphaBlendEqParams[indexEq1]];
        colorStates[colorStateIndex] += ((this._alphaBlendFuncParams[index0] === null ? 1 : alphaBlendFactorToIndex[this._alphaBlendFuncParams[index0]]) << 0) + ((this._alphaBlendFuncParams[index1] === null ? 1 : alphaBlendFactorToIndex[this._alphaBlendFuncParams[index1]]) << 5) + ((this._alphaBlendFuncParams[index2] === null ? 1 : alphaBlendFactorToIndex[this._alphaBlendFuncParams[index2]]) << 10) + ((this._alphaBlendFuncParams[index3] === null ? 1 : alphaBlendFactorToIndex[this._alphaBlendFuncParams[index3]]) << 15) + (eq0 + eq1 * 5) * (1 << 20);
      }
      if (i & 1) {
        isDirty = isDirty || this._states[StatePosition.ColorStates1 + colorStateIndex] !== colorStates[colorStateIndex];
        this._states[StatePosition.ColorStates1 + colorStateIndex] = colorStates[colorStateIndex];
        colorStateIndex++;
      }
    }
    if (isDirty) {
      this._isDirty = true;
      this._stateDirtyLowestIndex = Math.min(this._stateDirtyLowestIndex, StatePosition.ColorStates1);
    }
  }
  _setDepthStencilState() {
    const stencilState = !this._stencilEnabled ? 7 + (1 << 3) + (1 << 6) + (1 << 9) + // front
    (7 << 12) + (1 << 15) + (1 << 18) + (1 << 21) : this._stencilFrontCompare + (this._stencilFrontDepthFailOp << 3) + (this._stencilFrontPassOp << 6) + (this._stencilFrontFailOp << 9) + // front
    (this._stencilBackCompare << 12) + (this._stencilBackDepthFailOp << 15) + (this._stencilBackPassOp << 18) + (this._stencilBackFailOp << 21);
    const depthStencilState = this._depthStencilFormat + ((this._depthTestEnabled ? this._depthCompare : 7) << 6) + stencilState * (1 << 10);
    if (this._depthStencilState !== depthStencilState) {
      this._depthStencilState = depthStencilState;
      this._states[StatePosition.DepthStencilState] = this._depthStencilState;
      this._isDirty = true;
      this._stateDirtyLowestIndex = Math.min(this._stateDirtyLowestIndex, StatePosition.DepthStencilState);
    }
  }
  _setVertexState(effect) {
    const currStateLen = this._statesLength;
    let newNumStates = StatePosition.VertexState;
    const webgpuPipelineContext = effect._pipelineContext;
    const attributes = webgpuPipelineContext.shaderProcessingContext.attributeNamesFromEffect;
    const locations = webgpuPipelineContext.shaderProcessingContext.attributeLocationsFromEffect;
    let currentGPUBuffer;
    let numVertexBuffers = 0;
    for (let index = 0; index < attributes.length; index++) {
      const location = locations[index];
      let vertexBuffer = (this._overrideVertexBuffers && this._overrideVertexBuffers[attributes[index]]) ?? this._vertexBuffers[attributes[index]];
      if (!vertexBuffer) {
        vertexBuffer = this._emptyVertexBuffer;
        if (WebGPUCacheRenderPipeline.LogErrorIfNoVertexBuffer) {
          Logger.Error(`No vertex buffer is provided for the "${attributes[index]}" attribute. A default empty vertex buffer will be used, but this may generate errors in some browsers.`);
        }
      }
      const buffer = vertexBuffer.effectiveBuffer?.underlyingResource;
      if (vertexBuffer._validOffsetRange === void 0) {
        const offset = vertexBuffer.effectiveByteOffset;
        const formatSize = vertexBuffer.getSize(true);
        const byteStride = vertexBuffer.effectiveByteStride;
        vertexBuffer._validOffsetRange = offset + formatSize <= this._kMaxVertexBufferStride && byteStride === 0 || byteStride !== 0 && offset + formatSize <= byteStride;
      }
      const canMergeWithCurrentBuffer = WebGPUCacheRenderPipeline._CanMergeVertexBuffer(currentGPUBuffer, buffer, vertexBuffer);
      if (!canMergeWithCurrentBuffer) {
        this.vertexBuffers[numVertexBuffers++] = vertexBuffer;
        currentGPUBuffer = vertexBuffer._validOffsetRange ? buffer : null;
      }
      const vid = vertexBuffer.hashCode + (location << 7) + (canMergeWithCurrentBuffer ? vertexBufferLayoutContinuation : 0);
      const descriptorOffset = vertexBuffer._validOffsetRange ? vertexBuffer.effectiveByteOffset : 0;
      this._isDirty = this._isDirty || this._states[newNumStates] !== vid;
      this._states[newNumStates++] = vid;
      if (descriptorOffset !== 0) {
        const offsetState = -descriptorOffset;
        this._isDirty = this._isDirty || this._states[newNumStates] !== offsetState;
        this._states[newNumStates++] = offsetState;
      }
    }
    this.vertexBuffers.length = numVertexBuffers;
    this._statesLength = newNumStates;
    this._isDirty = this._isDirty || newNumStates !== currStateLen;
    if (this._isDirty) {
      this._stateDirtyLowestIndex = Math.min(this._stateDirtyLowestIndex, StatePosition.VertexState);
    }
  }
  _setTextureState(textureState) {
    if (this._textureState !== textureState) {
      this._textureState = textureState;
      this._states[StatePosition.TextureStage] = this._textureState;
      this._isDirty = true;
      this._stateDirtyLowestIndex = Math.min(this._stateDirtyLowestIndex, StatePosition.TextureStage);
    }
  }
  _createPipelineLayout(webgpuPipelineContext) {
    if (this._useTextureStage) {
      return this._createPipelineLayoutWithTextureStage(webgpuPipelineContext);
    }
    const bindGroupLayouts = [];
    const bindGroupLayoutEntries = webgpuPipelineContext.shaderProcessingContext.bindGroupLayoutEntries;
    for (let i = 0; i < bindGroupLayoutEntries.length; i++) {
      const setDefinition = bindGroupLayoutEntries[i];
      bindGroupLayouts[i] = this._device.createBindGroupLayout({
        entries: setDefinition
      });
    }
    webgpuPipelineContext.bindGroupLayouts[0] = bindGroupLayouts;
    return this._device.createPipelineLayout({ bindGroupLayouts });
  }
  _createPipelineLayoutWithTextureStage(webgpuPipelineContext) {
    const shaderProcessingContext = webgpuPipelineContext.shaderProcessingContext;
    const bindGroupLayoutEntries = shaderProcessingContext.bindGroupLayoutEntries;
    let bitVal = 1;
    for (let i = 0; i < bindGroupLayoutEntries.length; i++) {
      const setDefinition = bindGroupLayoutEntries[i];
      for (let j = 0; j < setDefinition.length; j++) {
        const entry = bindGroupLayoutEntries[i][j];
        if (entry.texture) {
          const name2 = shaderProcessingContext.bindGroupLayoutEntryInfo[i][entry.binding].name;
          const textureInfo = shaderProcessingContext.availableTextures[name2];
          const samplerInfo = textureInfo.autoBindSampler ? shaderProcessingContext.availableSamplers[name2 + `Sampler`] : null;
          let sampleType = textureInfo.sampleType;
          let samplerType = samplerInfo?.type ?? "filtering";
          if (this._textureState & bitVal && sampleType !== "depth") {
            if (textureInfo.autoBindSampler) {
              samplerType = "non-filtering";
            }
            sampleType = "unfilterable-float";
          }
          entry.texture.sampleType = sampleType;
          if (samplerInfo) {
            const binding = shaderProcessingContext.bindGroupLayoutEntryInfo[samplerInfo.binding.groupIndex][samplerInfo.binding.bindingIndex].index;
            bindGroupLayoutEntries[samplerInfo.binding.groupIndex][binding].sampler.type = samplerType;
          }
          bitVal = bitVal << 1;
        }
      }
    }
    const bindGroupLayouts = [];
    for (let i = 0; i < bindGroupLayoutEntries.length; ++i) {
      bindGroupLayouts[i] = this._device.createBindGroupLayout({
        entries: bindGroupLayoutEntries[i]
      });
    }
    webgpuPipelineContext.bindGroupLayouts[this._textureState] = bindGroupLayouts;
    return this._device.createPipelineLayout({ bindGroupLayouts });
  }
  _getVertexInputDescriptor(effect) {
    const descriptors = [];
    const webgpuPipelineContext = effect._pipelineContext;
    const attributes = webgpuPipelineContext.shaderProcessingContext.attributeNamesFromEffect;
    const locations = webgpuPipelineContext.shaderProcessingContext.attributeLocationsFromEffect;
    let currentGPUBuffer;
    let currentGPUAttributes;
    for (let index = 0; index < attributes.length; index++) {
      const location = locations[index];
      let vertexBuffer = (this._overrideVertexBuffers && this._overrideVertexBuffers[attributes[index]]) ?? this._vertexBuffers[attributes[index]];
      if (!vertexBuffer) {
        vertexBuffer = this._emptyVertexBuffer;
      }
      let buffer = vertexBuffer.effectiveBuffer?.underlyingResource;
      let offset = vertexBuffer.effectiveByteOffset;
      const invalidOffsetRange = !vertexBuffer._validOffsetRange;
      if (!WebGPUCacheRenderPipeline._CanMergeVertexBuffer(currentGPUBuffer, buffer, vertexBuffer)) {
        const vertexBufferDescriptor = {
          arrayStride: vertexBuffer.effectiveByteStride,
          stepMode: vertexBuffer.getIsInstanced() ? "instance" : "vertex",
          attributes: []
        };
        descriptors.push(vertexBufferDescriptor);
        currentGPUAttributes = vertexBufferDescriptor.attributes;
        if (invalidOffsetRange) {
          offset = 0;
          buffer = null;
        }
      }
      currentGPUAttributes.push({
        shaderLocation: location,
        offset,
        format: WebGPUCacheRenderPipeline._GetVertexInputDescriptorFormat(vertexBuffer)
      });
      currentGPUBuffer = buffer;
    }
    return descriptors;
  }
  static _CanMergeVertexBuffer(currentGPUBuffer, buffer, vertexBuffer) {
    return !!currentGPUBuffer && currentGPUBuffer === buffer && vertexBuffer._validOffsetRange;
  }
  _buildRenderPipelineDescriptor(effect, topology, sampleCount) {
    const webgpuPipelineContext = effect._pipelineContext;
    const inputStateDescriptor = this._getVertexInputDescriptor(effect);
    const pipelineLayout = this._createPipelineLayout(webgpuPipelineContext);
    const colorStates2 = [];
    if (this._vertexBuffers) {
      checkNonFloatVertexBuffers(this._vertexBuffers, effect);
    }
    if (this._mrtAttachments > 0) {
      for (let i = 0; i < this._mrtFormats.length; ++i) {
        const format = this._mrtFormats[i];
        if (format) {
          const descr = {
            format,
            writeMask: (this._mrtEnabledMask & 1 << i) !== 0 ? this._writeMask : 0
          };
          const alphaBlend = this._getAphaBlendState(i < this._numAlphaBlendTargetsEnabled ? i : 0);
          const colorBlend = this._getColorBlendState(i < this._numAlphaBlendTargetsEnabled ? i : 0);
          const isIntegerFormat = format.endsWith("uint") || format.endsWith("sint");
          if (descr.writeMask !== 0 && !isIntegerFormat && alphaBlend && colorBlend) {
            descr.blend = {
              alpha: alphaBlend,
              color: colorBlend
            };
          }
          colorStates2.push(descr);
        } else {
          colorStates2.push(null);
        }
      }
    } else {
      if (this._webgpuColorFormat[0]) {
        const descr = {
          format: this._webgpuColorFormat[0],
          writeMask: this._writeMask
        };
        const alphaBlend = this._getAphaBlendState(0);
        const colorBlend = this._getColorBlendState(0);
        const format = this._webgpuColorFormat[0];
        const isIntegerFormat = format.endsWith("uint") || format.endsWith("sint");
        if (!isIntegerFormat && alphaBlend && colorBlend) {
          descr.blend = {
            alpha: alphaBlend,
            color: colorBlend
          };
        }
        colorStates2.push(descr);
      } else {
        colorStates2.push(null);
      }
    }
    const stencilFront = {
      compare: WebGPUCacheRenderPipeline._GetCompareFunction(
        this._stencilEnabled ? this._stencilFrontCompare : 7
        /* ALWAYS */
      ),
      depthFailOp: WebGPUCacheRenderPipeline._GetStencilOpFunction(
        this._stencilEnabled ? this._stencilFrontDepthFailOp : 1
        /* KEEP */
      ),
      failOp: WebGPUCacheRenderPipeline._GetStencilOpFunction(
        this._stencilEnabled ? this._stencilFrontFailOp : 1
        /* KEEP */
      ),
      passOp: WebGPUCacheRenderPipeline._GetStencilOpFunction(
        this._stencilEnabled ? this._stencilFrontPassOp : 1
        /* KEEP */
      )
    };
    const stencilBack = {
      compare: WebGPUCacheRenderPipeline._GetCompareFunction(
        this._stencilEnabled ? this._stencilBackCompare : 7
        /* ALWAYS */
      ),
      depthFailOp: WebGPUCacheRenderPipeline._GetStencilOpFunction(
        this._stencilEnabled ? this._stencilBackDepthFailOp : 1
        /* KEEP */
      ),
      failOp: WebGPUCacheRenderPipeline._GetStencilOpFunction(
        this._stencilEnabled ? this._stencilBackFailOp : 1
        /* KEEP */
      ),
      passOp: WebGPUCacheRenderPipeline._GetStencilOpFunction(
        this._stencilEnabled ? this._stencilBackPassOp : 1
        /* KEEP */
      )
    };
    const topologyIsTriangle = topology === "triangle-list" || topology === "triangle-strip";
    let stripIndexFormat = void 0;
    if (topology === "line-strip" || topology === "triangle-strip") {
      stripIndexFormat = !this.indexBuffer || this.indexBuffer.is32Bits ? "uint32" : "uint16";
    }
    const depthStencilFormatHasStencil = this._webgpuDepthStencilFormat ? WebGPUTextureHelper.HasStencilAspect(this._webgpuDepthStencilFormat) : false;
    const primitiveState = {
      topology,
      frontFace: this._frontFace === 1 ? "ccw" : "cw",
      cullMode: !this._cullEnabled ? "none" : this._cullFace === 2 ? "front" : "back"
    };
    if (stripIndexFormat) {
      primitiveState.stripIndexFormat = stripIndexFormat;
    }
    return {
      label: `RenderPipeline_${colorStates2[0]?.format ?? "nooutput"}_${this._webgpuDepthStencilFormat ?? "nodepth"}_samples${sampleCount}_textureState${this._textureState}`,
      layout: pipelineLayout,
      vertex: {
        module: webgpuPipelineContext.stages.vertexStage.module,
        entryPoint: webgpuPipelineContext.stages.vertexStage.entryPoint,
        buffers: inputStateDescriptor
      },
      primitive: primitiveState,
      fragment: !webgpuPipelineContext.stages.fragmentStage ? void 0 : {
        module: webgpuPipelineContext.stages.fragmentStage.module,
        entryPoint: webgpuPipelineContext.stages.fragmentStage.entryPoint,
        targets: colorStates2
      },
      multisample: {
        count: sampleCount
      },
      depthStencil: this._webgpuDepthStencilFormat === void 0 ? void 0 : {
        depthWriteEnabled: this._depthWriteEnabled,
        depthCompare: this._depthTestEnabled ? WebGPUCacheRenderPipeline._GetCompareFunction(this._depthCompare) : "always",
        format: this._webgpuDepthStencilFormat,
        stencilFront: this._stencilEnabled && depthStencilFormatHasStencil ? stencilFront : void 0,
        stencilBack: this._stencilEnabled && depthStencilFormatHasStencil ? stencilBack : void 0,
        stencilReadMask: this._stencilEnabled && depthStencilFormatHasStencil ? this._stencilReadMask : 4294967295,
        stencilWriteMask: this._stencilEnabled && depthStencilFormatHasStencil ? this._stencilWriteMask : 4294967295,
        depthBias: this._depthBias,
        depthBiasClamp: topologyIsTriangle ? this._depthBiasClamp : 0,
        depthBiasSlopeScale: topologyIsTriangle ? this._depthBiasSlopeScale : 0
      }
    };
  }
  _createRenderPipeline(effect, topology, sampleCount) {
    return this._device.createRenderPipeline(this._buildRenderPipelineDescriptor(effect, topology, sampleCount));
  }
  /**
   * Pre-warms a render pipeline asynchronously. Sets up the cache state,
   * checks for a cache hit, and on miss starts an async pipeline compilation.
   * @param fillMode - the fill mode (triangle list, wireframe, etc.)
   * @param effect - the effect to create the pipeline for
   * @param sampleCount - the MSAA sample count
   * @param textureState - the texture state bitmask
   * @returns a Promise that resolves when the pipeline is compiled and cached, or null if already cached
   */
  preWarmPipeline(fillMode, effect, sampleCount, textureState = 0) {
    sampleCount = WebGPUTextureHelper.GetSample(sampleCount);
    const cached = this._lookupRenderPipeline(fillMode, effect, sampleCount, textureState);
    if (cached) {
      return null;
    }
    const topology = WebGPUCacheRenderPipeline._GetTopology(fillMode);
    const capturedParam = { token: this._parameter.token, pipeline: null };
    const promise = this._device.createRenderPipelineAsync(this._buildRenderPipelineDescriptor(effect, topology, sampleCount));
    return promise.then((pipeline) => {
      capturedParam.pipeline = pipeline;
      this._setRenderPipeline(capturedParam);
      WebGPUCacheRenderPipeline.NumCacheMiss++;
      return pipeline;
    });
  }
}
WebGPUCacheRenderPipeline.LogErrorIfNoVertexBuffer = false;
WebGPUCacheRenderPipeline.NumCacheHitWithoutHash = 0;
WebGPUCacheRenderPipeline.NumCacheHitWithHash = 0;
WebGPUCacheRenderPipeline.NumCacheMiss = 0;
WebGPUCacheRenderPipeline.NumPipelineCreationLastFrame = 0;
WebGPUCacheRenderPipeline._NumPipelineCreationCurrentFrame = 0;
class NodeState {
  constructor() {
    this.values = {};
  }
  count() {
    let countNode = 0, countPipeline = this.pipeline ? 1 : 0;
    for (const value in this.values) {
      const node = this.values[value];
      const [childCountNodes, childCoundPipeline] = node.count();
      countNode += childCountNodes;
      countPipeline += childCoundPipeline;
      countNode++;
    }
    return [countNode, countPipeline];
  }
}
class WebGPUCacheRenderPipelineTree extends WebGPUCacheRenderPipeline {
  static GetNodeCounts() {
    const counts = WebGPUCacheRenderPipelineTree._Cache.count();
    return { nodeCount: counts[0], pipelineCount: counts[1] };
  }
  static _GetPipelines(node, pipelines, curPath, curPathLen) {
    if (node.pipeline) {
      const path = curPath.slice();
      path.length = curPathLen;
      pipelines.push(path);
    }
    for (const value in node.values) {
      const nnode = node.values[value];
      curPath[curPathLen] = parseInt(value);
      WebGPUCacheRenderPipelineTree._GetPipelines(nnode, pipelines, curPath, curPathLen + 1);
    }
  }
  static GetPipelines() {
    const pipelines = [];
    WebGPUCacheRenderPipelineTree._GetPipelines(WebGPUCacheRenderPipelineTree._Cache, pipelines, [], 0);
    return pipelines;
  }
  static ResetCache() {
    WebGPUCacheRenderPipelineTree._Cache = new NodeState();
  }
  reset() {
    this._nodeStack = [];
    this._nodeStack[0] = WebGPUCacheRenderPipelineTree._Cache;
    super.reset();
  }
  _getRenderPipeline(param) {
    let node = this._nodeStack[this._stateDirtyLowestIndex];
    for (let i = this._stateDirtyLowestIndex; i < this._statesLength; ++i) {
      let nn = node.values[this._states[i]];
      if (!nn) {
        nn = new NodeState();
        node.values[this._states[i]] = nn;
      }
      node = nn;
      this._nodeStack[i + 1] = node;
    }
    param.token = node;
    param.pipeline = node.pipeline;
  }
  _setRenderPipeline(param) {
    param.token.pipeline = param.pipeline;
  }
}
WebGPUCacheRenderPipelineTree._Cache = new NodeState();
class WebGPUStencilStateComposer extends StencilStateComposer {
  constructor(cache) {
    super(false);
    this._cache = cache;
    this.reset();
  }
  get func() {
    return this._func;
  }
  set func(value) {
    if (this._func === value) {
      return;
    }
    this._func = value;
    this._cache.setStencilCompare(value);
  }
  get backFunc() {
    return this._backFunc;
  }
  set backFunc(value) {
    if (this._backFunc === value) {
      return;
    }
    this._backFunc = value;
    this._cache.setStencilBackCompare(value);
  }
  get funcMask() {
    return this._funcMask;
  }
  set funcMask(value) {
    if (this._funcMask === value) {
      return;
    }
    this._funcMask = value;
    this._cache.setStencilReadMask(value);
  }
  get opStencilFail() {
    return this._opStencilFail;
  }
  set opStencilFail(value) {
    if (this._opStencilFail === value) {
      return;
    }
    this._opStencilFail = value;
    this._cache.setStencilFailOp(value);
  }
  get opDepthFail() {
    return this._opDepthFail;
  }
  set opDepthFail(value) {
    if (this._opDepthFail === value) {
      return;
    }
    this._opDepthFail = value;
    this._cache.setStencilDepthFailOp(value);
  }
  get opStencilDepthPass() {
    return this._opStencilDepthPass;
  }
  set opStencilDepthPass(value) {
    if (this._opStencilDepthPass === value) {
      return;
    }
    this._opStencilDepthPass = value;
    this._cache.setStencilPassOp(value);
  }
  get backOpStencilFail() {
    return this._backOpStencilFail;
  }
  set backOpStencilFail(value) {
    if (this._backOpStencilFail === value) {
      return;
    }
    this._backOpStencilFail = value;
    this._cache.setStencilBackFailOp(value);
  }
  get backOpDepthFail() {
    return this._backOpDepthFail;
  }
  set backOpDepthFail(value) {
    if (this._backOpDepthFail === value) {
      return;
    }
    this._backOpDepthFail = value;
    this._cache.setStencilBackDepthFailOp(value);
  }
  get backOpStencilDepthPass() {
    return this._backOpStencilDepthPass;
  }
  set backOpStencilDepthPass(value) {
    if (this._backOpStencilDepthPass === value) {
      return;
    }
    this._backOpStencilDepthPass = value;
    this._cache.setStencilBackPassOp(value);
  }
  get mask() {
    return this._mask;
  }
  set mask(value) {
    if (this._mask === value) {
      return;
    }
    this._mask = value;
    this._cache.setStencilWriteMask(value);
  }
  get enabled() {
    return this._enabled;
  }
  set enabled(value) {
    if (this._enabled === value) {
      return;
    }
    this._enabled = value;
    this._cache.setStencilEnabled(value);
  }
  reset() {
    super.reset();
    this._cache.resetStencilState();
  }
  apply() {
    const stencilMaterialEnabled = !this.useStencilGlobalOnly && !!this.stencilMaterial?.enabled;
    this.enabled = stencilMaterialEnabled ? this.stencilMaterial.enabled : this.stencilGlobal.enabled;
    if (!this.enabled) {
      return;
    }
    this.mask = stencilMaterialEnabled ? this.stencilMaterial.mask : this.stencilGlobal.mask;
    this.funcRef = stencilMaterialEnabled ? this.stencilMaterial.funcRef : this.stencilGlobal.funcRef;
    this.funcMask = stencilMaterialEnabled ? this.stencilMaterial.funcMask : this.stencilGlobal.funcMask;
    this.func = stencilMaterialEnabled ? this.stencilMaterial.func : this.stencilGlobal.func;
    this.opStencilFail = stencilMaterialEnabled ? this.stencilMaterial.opStencilFail : this.stencilGlobal.opStencilFail;
    this.opDepthFail = stencilMaterialEnabled ? this.stencilMaterial.opDepthFail : this.stencilGlobal.opDepthFail;
    this.opStencilDepthPass = stencilMaterialEnabled ? this.stencilMaterial.opStencilDepthPass : this.stencilGlobal.opStencilDepthPass;
    this.backFunc = stencilMaterialEnabled ? this.stencilMaterial.backFunc : this.stencilGlobal.backFunc;
    this.backOpStencilFail = stencilMaterialEnabled ? this.stencilMaterial.backOpStencilFail : this.stencilGlobal.backOpStencilFail;
    this.backOpDepthFail = stencilMaterialEnabled ? this.stencilMaterial.backOpDepthFail : this.stencilGlobal.backOpDepthFail;
    this.backOpStencilDepthPass = stencilMaterialEnabled ? this.stencilMaterial.backOpStencilDepthPass : this.stencilGlobal.backOpStencilDepthPass;
  }
}
class WebGPUDepthCullingState extends DepthCullingState {
  /**
   * Initializes the state.
   * @param cache
   */
  constructor(cache) {
    super(false);
    this._cache = cache;
    this.reset();
  }
  get zOffset() {
    return this._zOffset;
  }
  set zOffset(value) {
    if (this._zOffset === value) {
      return;
    }
    this._zOffset = value;
    this._isZOffsetDirty = true;
    this._cache.setDepthBiasSlopeScale(value);
  }
  get zOffsetUnits() {
    return this._zOffsetUnits;
  }
  set zOffsetUnits(value) {
    if (this._zOffsetUnits === value) {
      return;
    }
    this._zOffsetUnits = value;
    this._isZOffsetDirty = true;
    this._cache.setDepthBias(value);
  }
  get cullFace() {
    return this._cullFace;
  }
  set cullFace(value) {
    if (this._cullFace === value) {
      return;
    }
    this._cullFace = value;
    this._isCullFaceDirty = true;
    this._cache.setCullFace(value ?? 1);
  }
  get cull() {
    return this._cull;
  }
  set cull(value) {
    if (this._cull === value) {
      return;
    }
    this._cull = value;
    this._isCullDirty = true;
    this._cache.setCullEnabled(!!value);
  }
  get depthFunc() {
    return this._depthFunc;
  }
  set depthFunc(value) {
    if (this._depthFunc === value) {
      return;
    }
    this._depthFunc = value;
    this._isDepthFuncDirty = true;
    this._cache.setDepthCompare(value);
  }
  get depthMask() {
    return this._depthMask;
  }
  set depthMask(value) {
    if (this._depthMask === value) {
      return;
    }
    this._depthMask = value;
    this._isDepthMaskDirty = true;
    this._cache.setDepthWriteEnabled(value);
  }
  get depthTest() {
    return this._depthTest;
  }
  set depthTest(value) {
    if (this._depthTest === value) {
      return;
    }
    this._depthTest = value;
    this._isDepthTestDirty = true;
    this._cache.setDepthTestEnabled(value);
  }
  get frontFace() {
    return this._frontFace;
  }
  set frontFace(value) {
    if (this._frontFace === value) {
      return;
    }
    this._frontFace = value;
    this._isFrontFaceDirty = true;
    this._cache.setFrontFace(value ?? 2);
  }
  reset() {
    super.reset();
    this._cache.resetDepthCullingState();
  }
  apply() {
  }
}
class ExternalTexture {
  /**
   * Checks if a texture is an external or internal texture
   * @param texture the external or internal texture
   * @returns true if the texture is an external texture, else false
   */
  static IsExternalTexture(texture) {
    return texture.underlyingResource !== void 0;
  }
  /**
   * Get the class name of the texture.
   * @returns "ExternalTexture"
   */
  getClassName() {
    return "ExternalTexture";
  }
  /**
   * Gets the underlying texture object
   */
  get underlyingResource() {
    return this._video;
  }
  /**
   * Constructs the texture
   * @param video The video the texture should be wrapped around
   */
  constructor(video) {
    this.useMipMaps = false;
    this.type = 16;
    this.format = 4294967295;
    this._video = video;
    this.uniqueId = InternalTexture._Counter++;
  }
  /**
   * Get if the texture is ready to be used (downloaded, converted, mip mapped...).
   * @returns true if fully ready
   */
  isReady() {
    return this._video.readyState >= this._video.HAVE_CURRENT_DATA;
  }
  /**
   * Dispose the texture and release its associated resources.
   */
  dispose() {
  }
}
class WebGPUMaterialContext {
  get forceBindGroupCreation() {
    return this._numExternalTextures > 0;
  }
  get hasFloatOrDepthTextures() {
    return this._numFloatOrDepthTextures > 0;
  }
  constructor() {
    this.useVertexPulling = false;
    this.uniqueId = WebGPUMaterialContext._Counter++;
    this.updateId = 0;
    this.textureState = 0;
    this.reset();
  }
  reset() {
    this.samplers = {};
    this.textures = {};
    this.isDirty = true;
    this._numFloatOrDepthTextures = 0;
    this._numExternalTextures = 0;
  }
  setSampler(name2, sampler) {
    let samplerCache = this.samplers[name2];
    let currentHashCode = -1;
    if (!samplerCache) {
      this.samplers[name2] = samplerCache = { sampler, hashCode: 0 };
    } else {
      currentHashCode = samplerCache.hashCode;
    }
    samplerCache.sampler = sampler;
    samplerCache.hashCode = sampler ? WebGPUCacheSampler.GetSamplerHashCode(sampler) : 0;
    const isDirty = currentHashCode !== samplerCache.hashCode;
    if (isDirty) {
      this.updateId++;
    }
    this.isDirty || (this.isDirty = isDirty);
  }
  setTexture(name2, texture) {
    let textureCache = this.textures[name2];
    let currentTextureId = -1;
    if (!textureCache) {
      this.textures[name2] = textureCache = { texture, isFloatOrDepthTexture: false, isExternalTexture: false };
    } else {
      currentTextureId = textureCache.texture?.uniqueId ?? -1;
    }
    if (textureCache.isExternalTexture) {
      this._numExternalTextures--;
    }
    if (textureCache.isFloatOrDepthTexture) {
      this._numFloatOrDepthTextures--;
    }
    if (texture) {
      textureCache.isFloatOrDepthTexture = texture.type === 1 || texture.format >= 13 && texture.format <= 18;
      textureCache.isExternalTexture = ExternalTexture.IsExternalTexture(texture);
      if (textureCache.isFloatOrDepthTexture) {
        this._numFloatOrDepthTextures++;
      }
      if (textureCache.isExternalTexture) {
        this._numExternalTextures++;
      }
    } else {
      textureCache.isFloatOrDepthTexture = false;
      textureCache.isExternalTexture = false;
    }
    textureCache.texture = texture;
    const isDirty = currentTextureId !== (texture?.uniqueId ?? -1);
    if (isDirty) {
      this.updateId++;
    }
    this.isDirty || (this.isDirty = isDirty);
  }
}
WebGPUMaterialContext._Counter = 0;
class WebGPUDrawContext {
  /**
   * Checks if the draw context is dirty.
   * @param materialContextUpdateId The update ID of the material context associated with the draw context.
   * @returns True if the draw or material context is dirty, false otherwise.
   */
  isDirty(materialContextUpdateId) {
    return this._isDirty || this._materialContextUpdateId !== materialContextUpdateId;
  }
  /**
   * Resets the dirty state of the draw context.
   * @param materialContextUpdateId The update ID of the material context associated with the draw context.
   */
  resetIsDirty(materialContextUpdateId) {
    this._isDirty = false;
    this._materialContextUpdateId = materialContextUpdateId;
  }
  get enableIndirectDraw() {
    return this._enableIndirectDraw;
  }
  set enableIndirectDraw(enable) {
    this._enableIndirectDrawInCompatMode = true;
    if (this._enableIndirectDraw === enable) {
      return;
    }
    this._enableIndirectDraw = enable;
    if (!enable && !this._useInstancing && this.indirectDrawBuffer) {
      this._bufferManager.releaseBuffer(this.indirectDrawBuffer);
      this.indirectDrawBuffer = void 0;
      this._indirectDrawData = void 0;
    } else if (enable && !this.indirectDrawBuffer) {
      this.indirectDrawBuffer = this._bufferManager.createRawBuffer(20, BufferUsage.CopyDst | BufferUsage.Indirect | BufferUsage.Storage, void 0, "IndirectDrawBuffer");
      this._indirectDrawData = new Uint32Array(5);
      this._indirectDrawData[3] = 0;
      this._indirectDrawData[4] = 0;
    }
  }
  get useInstancing() {
    return this._useInstancing;
  }
  set useInstancing(use) {
    if (this._useInstancing === use) {
      return;
    }
    this._useInstancing = use;
    this._currentInstanceCount = -1;
    const enableIndirectDrawInCompatMode = this._enableIndirectDrawInCompatMode;
    this.enableIndirectDraw = use;
    this._enableIndirectDrawInCompatMode = enableIndirectDrawInCompatMode;
  }
  /**
   * Creates a new WebGPUDrawContext.
   * @param bufferManager The buffer manager used to manage WebGPU buffers.
   * @param _dummyIndexBuffer A dummy index buffer to be bound as the "indices"
   * storage buffer when no index buffer is provided.
   */
  constructor(bufferManager, _dummyIndexBuffer) {
    this._dummyIndexBuffer = _dummyIndexBuffer;
    this._enableIndirectDrawInCompatMode = false;
    this._bufferManager = bufferManager;
    this.uniqueId = WebGPUDrawContext._Counter++;
    this._useInstancing = false;
    this._currentInstanceCount = 0;
    this._enableIndirectDraw = false;
    this._vertexPullingEnabled = false;
    this.reset();
  }
  reset() {
    this._releaseUniformBufferSlots();
    this.buffers = {};
    this._isDirty = true;
    this._materialContextUpdateId = 0;
    this.fastBundle = void 0;
    this.bindGroups = void 0;
    this._vertexPullingEnabled = false;
  }
  /**
   * Associates a buffer to the draw context.
   * @param name The name of the buffer.
   * @param buffer The buffer to set.
   */
  setBuffer(name2, buffer) {
    this._isDirty || (this._isDirty = buffer?.uniqueId !== this.buffers[name2]?.uniqueId);
    this.buffers[name2] = buffer;
  }
  setIndirectData(indexOrVertexCount, instanceCount, firstIndexOrVertex, forceUpdate = false) {
    if (!forceUpdate && instanceCount === this._currentInstanceCount || !this.indirectDrawBuffer || !this._indirectDrawData) {
      return;
    }
    this._currentInstanceCount = instanceCount;
    this._indirectDrawData[0] = indexOrVertexCount;
    this._indirectDrawData[1] = instanceCount;
    this._indirectDrawData[2] = firstIndexOrVertex;
    this._bufferManager.setRawData(this.indirectDrawBuffer, 0, this._indirectDrawData, 0, 20);
  }
  /**
   * Setup or disable vertex pulling as needed.
   * @param useVertexPulling Use vertex pulling or not
   * @param webgpuPipelineContext The WebGPU pipeline context
   * @param vertexBuffers The current vertex buffers
   * @param indexBuffer The current index buffer
   * @param overrideVertexBuffers The vertex buffers to override
   */
  setVertexPulling(useVertexPulling, webgpuPipelineContext, vertexBuffers, indexBuffer, overrideVertexBuffers) {
    if (this._vertexPullingEnabled === useVertexPulling) {
      return;
    }
    this._vertexPullingEnabled = useVertexPulling;
    this._isDirty = true;
    const bufferNames = webgpuPipelineContext.shaderProcessingContext.bufferNames;
    if (overrideVertexBuffers) {
      for (const attributeName in overrideVertexBuffers) {
        const vertexBuffer = overrideVertexBuffers[attributeName];
        if (!vertexBuffer || bufferNames.indexOf(attributeName) === -1) {
          continue;
        }
        const buffer = vertexBuffer.effectiveBuffer;
        this.setBuffer(attributeName, useVertexPulling ? buffer : null);
      }
    }
    for (const attributeName in vertexBuffers) {
      if (overrideVertexBuffers && attributeName in overrideVertexBuffers) {
        continue;
      }
      const vertexBuffer = vertexBuffers[attributeName];
      if (!vertexBuffer || bufferNames.indexOf(attributeName) === -1) {
        continue;
      }
      const buffer = vertexBuffer.effectiveBuffer;
      this.setBuffer(attributeName, useVertexPulling ? buffer : null);
    }
    if (bufferNames.indexOf("indices") !== -1) {
      this.setBuffer("indices", !useVertexPulling ? null : indexBuffer ?? this._dummyIndexBuffer);
    }
  }
  dispose() {
    this._releaseUniformBufferSlots();
    if (this.indirectDrawBuffer) {
      this._bufferManager.releaseBuffer(this.indirectDrawBuffer);
      this.indirectDrawBuffer = void 0;
      this._indirectDrawData = void 0;
    }
    this.fastBundle = void 0;
    this.bindGroups = void 0;
    this.buffers = void 0;
    this._enableIndirectDraw = false;
  }
  /** @internal */
  _releaseUniformBufferSlots() {
    const buffers = this._uniformBuffersWithOwnedSlot;
    if (!buffers) {
      return;
    }
    while (buffers.length) {
      buffers.pop()._releaseOwnerSlot(this);
    }
    this._uniformBuffersWithOwnedSlot = void 0;
  }
}
WebGPUDrawContext._Counter = 0;
const BufferIdStart = 1 << 20;
const TextureIdStart = 2 ** 35;
class WebGPUBindGroupCacheNode {
  constructor() {
    this.values = {};
  }
}
class WebGPUCacheBindGroups {
  static get Statistics() {
    return {
      totalCreated: WebGPUCacheBindGroups.NumBindGroupsCreatedTotal,
      lastFrameCreated: WebGPUCacheBindGroups.NumBindGroupsCreatedLastFrame,
      lookupLastFrame: WebGPUCacheBindGroups.NumBindGroupsLookupLastFrame,
      noLookupLastFrame: WebGPUCacheBindGroups.NumBindGroupsNoLookupLastFrame
    };
  }
  static ResetCache() {
    WebGPUCacheBindGroups._Cache = new WebGPUBindGroupCacheNode();
    WebGPUCacheBindGroups.NumBindGroupsCreatedTotal = 0;
    WebGPUCacheBindGroups.NumBindGroupsCreatedLastFrame = 0;
    WebGPUCacheBindGroups.NumBindGroupsLookupLastFrame = 0;
    WebGPUCacheBindGroups.NumBindGroupsNoLookupLastFrame = 0;
    WebGPUCacheBindGroups._NumBindGroupsCreatedCurrentFrame = 0;
    WebGPUCacheBindGroups._NumBindGroupsLookupCurrentFrame = 0;
    WebGPUCacheBindGroups._NumBindGroupsNoLookupCurrentFrame = 0;
  }
  constructor(device, cacheSampler, engine) {
    this.disabled = false;
    this._device = device;
    this._cacheSampler = cacheSampler;
    this._engine = engine;
  }
  endFrame() {
    WebGPUCacheBindGroups.NumBindGroupsCreatedLastFrame = WebGPUCacheBindGroups._NumBindGroupsCreatedCurrentFrame;
    WebGPUCacheBindGroups.NumBindGroupsLookupLastFrame = WebGPUCacheBindGroups._NumBindGroupsLookupCurrentFrame;
    WebGPUCacheBindGroups.NumBindGroupsNoLookupLastFrame = WebGPUCacheBindGroups._NumBindGroupsNoLookupCurrentFrame;
    WebGPUCacheBindGroups._NumBindGroupsCreatedCurrentFrame = 0;
    WebGPUCacheBindGroups._NumBindGroupsLookupCurrentFrame = 0;
    WebGPUCacheBindGroups._NumBindGroupsNoLookupCurrentFrame = 0;
  }
  /**
   * Cache is currently based on the uniform/storage buffers, samplers and textures used by the binding groups.
   * Note that all uniform buffers have an offset of 0 in Babylon and we don't have a use case where we would have the same buffer used with different capacity values:
   * that means we don't need to factor in the offset/size of the buffer in the cache, only the id
   * @param webgpuPipelineContext
   * @param drawContext
   * @param materialContext
   * @returns a bind group array
   */
  getBindGroups(webgpuPipelineContext, drawContext, materialContext) {
    let bindGroups = void 0;
    let node = WebGPUCacheBindGroups._Cache;
    const cacheIsDisabled = this.disabled || materialContext.forceBindGroupCreation;
    if (!cacheIsDisabled) {
      if (!drawContext.isDirty(materialContext.updateId) && !materialContext.isDirty) {
        WebGPUCacheBindGroups._NumBindGroupsNoLookupCurrentFrame++;
        return drawContext.bindGroups;
      }
      for (const bufferName of webgpuPipelineContext.shaderProcessingContext.bufferNames) {
        const uboId = (drawContext.buffers[bufferName]?.uniqueId ?? 0) + BufferIdStart;
        let nextNode = node.values[uboId];
        if (!nextNode) {
          nextNode = new WebGPUBindGroupCacheNode();
          node.values[uboId] = nextNode;
        }
        node = nextNode;
      }
      for (const samplerName of webgpuPipelineContext.shaderProcessingContext.samplerNames) {
        const samplerHashCode = materialContext.samplers[samplerName]?.hashCode ?? 0;
        let nextNode = node.values[samplerHashCode];
        if (!nextNode) {
          nextNode = new WebGPUBindGroupCacheNode();
          node.values[samplerHashCode] = nextNode;
        }
        node = nextNode;
      }
      for (const textureName of webgpuPipelineContext.shaderProcessingContext.textureNames) {
        const textureId = (materialContext.textures[textureName]?.texture?.uniqueId ?? 0) + TextureIdStart;
        let nextNode = node.values[textureId];
        if (!nextNode) {
          nextNode = new WebGPUBindGroupCacheNode();
          node.values[textureId] = nextNode;
        }
        node = nextNode;
      }
      bindGroups = node.bindGroups;
    }
    drawContext.resetIsDirty(materialContext.updateId);
    materialContext.isDirty = false;
    if (bindGroups) {
      drawContext.bindGroups = bindGroups;
      WebGPUCacheBindGroups._NumBindGroupsLookupCurrentFrame++;
      return bindGroups;
    }
    bindGroups = [];
    drawContext.bindGroups = bindGroups;
    if (!cacheIsDisabled) {
      node.bindGroups = bindGroups;
    }
    WebGPUCacheBindGroups.NumBindGroupsCreatedTotal++;
    WebGPUCacheBindGroups._NumBindGroupsCreatedCurrentFrame++;
    const bindGroupLayouts = webgpuPipelineContext.bindGroupLayouts[materialContext.textureState];
    for (let i = 0; i < webgpuPipelineContext.shaderProcessingContext.bindGroupLayoutEntries.length; i++) {
      const setDefinition = webgpuPipelineContext.shaderProcessingContext.bindGroupLayoutEntries[i];
      const entries = webgpuPipelineContext.shaderProcessingContext.bindGroupEntries[i];
      for (let j = 0; j < setDefinition.length; j++) {
        const entry = webgpuPipelineContext.shaderProcessingContext.bindGroupLayoutEntries[i][j];
        const entryInfo = webgpuPipelineContext.shaderProcessingContext.bindGroupLayoutEntryInfo[i][entry.binding];
        const name2 = entryInfo.nameInArrayOfTexture ?? entryInfo.name;
        if (entry.sampler) {
          const bindingInfo = materialContext.samplers[name2];
          if (bindingInfo) {
            const sampler = bindingInfo.sampler;
            if (!sampler) {
              if (this._engine.dbgSanityChecks) {
                Logger.Error(`Trying to bind a null sampler! entry=${JSON.stringify(entry)}, name=${name2}, bindingInfo=${JSON.stringify(bindingInfo, (key, value) => key === "texture" ? "<no dump>" : value)}, materialContext.uniqueId=${materialContext.uniqueId}`, 50);
              }
              continue;
            }
            entries[j].resource = this._cacheSampler.getSampler(sampler, false, bindingInfo.hashCode, sampler.label);
          } else {
            Logger.Error(`Sampler "${name2}" not found in the material context. Make sure you bound it. entry=${JSON.stringify(entry)}, materialContext=${JSON.stringify(materialContext, (key, value) => key === "texture" || key === "sampler" ? "<no dump>" : value)}`, 50);
          }
        } else if (entry.texture || entry.storageTexture) {
          const bindingInfo = materialContext.textures[name2];
          if (bindingInfo) {
            if (this._engine.dbgSanityChecks && bindingInfo.texture === null) {
              Logger.Error(`Trying to bind a null texture! name="${name2}", entry=${JSON.stringify(entry)}, bindingInfo=${JSON.stringify(bindingInfo, (key, value) => key === "texture" ? "<no dump>" : value)}, materialContext.uniqueId=${materialContext.uniqueId}`, 50);
              continue;
            }
            const hardwareTexture = bindingInfo.texture._hardwareTexture;
            if (this._engine.dbgSanityChecks && (!hardwareTexture || entry.texture && !hardwareTexture.view || entry.storageTexture && !hardwareTexture.viewForWriting)) {
              Logger.Error(`Trying to bind a null gpu texture or view! entry=${JSON.stringify(entry)}, name=${name2}, bindingInfo=${JSON.stringify(bindingInfo, (key, value) => key === "texture" ? "<no dump>" : value)}, isReady=${bindingInfo.texture?.isReady}, materialContext.uniqueId=${materialContext.uniqueId}`, 50);
              continue;
            }
            entries[j].resource = entry.storageTexture ? hardwareTexture.viewForWriting : hardwareTexture.view;
          } else {
            Logger.Error(`Texture "${name2}" not found in the material context. Make sure you bound it (something like effect.setTexture("${name2}", texture)). entry=${JSON.stringify(entry)}, materialContext=${JSON.stringify(materialContext, (key, value) => key === "texture" || key === "sampler" ? "<no dump>" : value)}`, 50);
          }
        } else if (entry.externalTexture) {
          const bindingInfo = materialContext.textures[name2];
          if (bindingInfo) {
            if (this._engine.dbgSanityChecks && bindingInfo.texture === null) {
              Logger.Error(`Trying to bind a null external texture! entry=${JSON.stringify(entry)}, name=${name2}, bindingInfo=${JSON.stringify(bindingInfo, (key, value) => key === "texture" ? "<no dump>" : value)}, materialContext.uniqueId=${materialContext.uniqueId}`, 50);
              continue;
            }
            const externalTexture = bindingInfo.texture.underlyingResource;
            if (this._engine.dbgSanityChecks && !externalTexture) {
              Logger.Error(`Trying to bind a null gpu external texture! entry=${JSON.stringify(entry)}, name=${name2}, bindingInfo=${JSON.stringify(bindingInfo, (key, value) => key === "texture" ? "<no dump>" : value)}, isReady=${bindingInfo.texture?.isReady}, materialContext.uniqueId=${materialContext.uniqueId}`, 50);
              continue;
            }
            entries[j].resource = this._device.importExternalTexture({ source: externalTexture });
          } else {
            Logger.Error(`External texture "${name2}" not found in the material context. Make sure you bound it. entry=${JSON.stringify(entry)}, materialContext=${JSON.stringify(materialContext, (key, value) => key === "texture" || key === "sampler" ? "<no dump>" : value)}`, 50);
          }
        } else if (entry.buffer) {
          const dataBuffer = drawContext.buffers[name2];
          if (dataBuffer) {
            const webgpuBuffer = dataBuffer.underlyingResource;
            entries[j].resource.buffer = webgpuBuffer;
            entries[j].resource.size = dataBuffer.capacity;
          } else {
            Logger.Error(`Can't find buffer "${name2}" in the draw context. Make sure you bound it. entry=${JSON.stringify(entry)}, buffers=${JSON.stringify(drawContext.buffers)}, drawContext.uniqueId=${drawContext.uniqueId}`, 50);
          }
        }
      }
      const groupLayout = bindGroupLayouts[i];
      bindGroups[i] = this._device.createBindGroup({
        layout: groupLayout,
        entries
      });
    }
    return bindGroups;
  }
}
WebGPUCacheBindGroups.NumBindGroupsCreatedTotal = 0;
WebGPUCacheBindGroups.NumBindGroupsCreatedLastFrame = 0;
WebGPUCacheBindGroups.NumBindGroupsLookupLastFrame = 0;
WebGPUCacheBindGroups.NumBindGroupsNoLookupLastFrame = 0;
WebGPUCacheBindGroups._Cache = new WebGPUBindGroupCacheNode();
WebGPUCacheBindGroups._NumBindGroupsCreatedCurrentFrame = 0;
WebGPUCacheBindGroups._NumBindGroupsLookupCurrentFrame = 0;
WebGPUCacheBindGroups._NumBindGroupsNoLookupCurrentFrame = 0;
class WebGPUCacheTextureView {
  constructor() {
    this._cache = /* @__PURE__ */ new WeakMap();
  }
  getView(texture, descriptor) {
    let viewsForTexture = this._cache.get(texture);
    if (!viewsForTexture) {
      viewsForTexture = /* @__PURE__ */ new Map();
      this._cache.set(texture, viewsForTexture);
    }
    const key = WebGPUCacheTextureView._GetKey(descriptor);
    let view = viewsForTexture.get(key);
    if (!view) {
      view = texture.createView(descriptor);
      viewsForTexture.set(key, view);
    }
    return view;
  }
  static _GetKey(descriptor) {
    return `${descriptor.format}_${descriptor.dimension}_${descriptor.baseMipLevel}_${descriptor.mipLevelCount}_${descriptor.baseArrayLayer}_${descriptor.arrayLayerCount}_${descriptor.aspect}_${descriptor.usage}_${descriptor.swizzle}`;
  }
}
class WebGPUClearQuad {
  setDepthStencilFormat(format) {
    this._depthTextureFormat = format;
    this._cacheRenderPipeline.setDepthStencilFormat(format);
  }
  setColorFormat(format) {
    this._cacheRenderPipeline.setColorFormat(format);
  }
  setMRTAttachments(attachments, textureArray, textureCount) {
    this._cacheRenderPipeline.setMRT(textureArray, textureCount);
    this._cacheRenderPipeline.setMRTAttachments(attachments);
  }
  constructor(device, engine, emptyVertexBuffer) {
    this._bindGroups = {};
    this._bundleCache = {};
    this._keyTemp = [];
    this._device = device;
    this._engine = engine;
    this._cacheRenderPipeline = new WebGPUCacheRenderPipelineTree(this._device, emptyVertexBuffer);
    this._cacheRenderPipeline.setDepthTestEnabled(false);
    this._cacheRenderPipeline.setStencilReadMask(255);
    this._effect = engine.createEffect(
      "clearQuad",
      [],
      ["color", "depthValue"],
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      1,
      // On the pure import path the wrapper modules that eagerly register the clearQuad shaders are not in the
      // module graph, so load the generated shader modules here to guarantee they are present in the ShaderStore
      // before the effect compiles (otherwise the engine falls back to fetching clearQuad.*.fx and 404s).
      async () => {
        await Promise.all([__vitePreload(() => Promise.resolve().then(() => clearQuad_vertex), true ? void 0 : void 0), __vitePreload(() => Promise.resolve().then(() => clearQuad_fragment), true ? void 0 : void 0)]);
      }
    );
  }
  clear(renderPass, clearColor, clearDepth, clearStencil, sampleCount = 1) {
    let renderPass2;
    let bundle = null;
    let bundleKey;
    const isRTTPass = !!this._engine._currentRenderTarget;
    if (renderPass) {
      renderPass2 = renderPass;
    } else {
      let idx = 0;
      this._keyTemp.length = 0;
      for (let i = 0; i < this._cacheRenderPipeline.colorFormats.length; ++i) {
        this._keyTemp[idx++] = renderableTextureFormatToIndex[this._cacheRenderPipeline.colorFormats[i] ?? ""];
      }
      const depthStencilFormatIndex = renderableTextureFormatToIndex[this._depthTextureFormat ?? 0];
      this._keyTemp[idx] = (clearColor ? clearColor.r + clearColor.g * 256 + clearColor.b * 256 * 256 + clearColor.a * 256 * 256 * 256 : 0) + (clearDepth ? 2 ** 32 : 0) + (clearStencil ? 2 ** 33 : 0) + (this._engine.useReverseDepthBuffer ? 2 ** 34 : 0) + (isRTTPass ? 2 ** 35 : 0) + (sampleCount > 1 ? 2 ** 36 : 0) + depthStencilFormatIndex * 2 ** 37;
      bundleKey = this._keyTemp.join("_");
      bundle = this._bundleCache[bundleKey];
      if (bundle) {
        return bundle;
      }
      renderPass2 = this._device.createRenderBundleEncoder({
        label: "clearQuadRenderBundle",
        colorFormats: this._cacheRenderPipeline.colorFormats,
        depthStencilFormat: this._depthTextureFormat,
        sampleCount: WebGPUTextureHelper.GetSample(sampleCount)
      });
    }
    this._cacheRenderPipeline.setDepthWriteEnabled(!!clearDepth);
    this._cacheRenderPipeline.setStencilEnabled(!!clearStencil && !!this._depthTextureFormat && WebGPUTextureHelper.HasStencilAspect(this._depthTextureFormat));
    this._cacheRenderPipeline.setStencilWriteMask(clearStencil ? 255 : 0);
    this._cacheRenderPipeline.setStencilCompare(clearStencil ? 519 : 512);
    this._cacheRenderPipeline.setStencilPassOp(clearStencil ? 7681 : 7680);
    this._cacheRenderPipeline.setWriteMask(clearColor ? 15 : 0);
    const pipeline = this._cacheRenderPipeline.getRenderPipeline(7, this._effect, sampleCount);
    const webgpuPipelineContext = this._effect._pipelineContext;
    if (clearColor) {
      this._effect.setDirectColor4("color", clearColor);
    }
    this._effect.setFloat("depthValue", this._engine.useReverseDepthBuffer ? this._engine._clearReverseDepthValue : this._engine._clearDepthValue);
    webgpuPipelineContext.uniformBuffer.update();
    const bufferInternals = isRTTPass ? this._engine._ubInvertY : this._engine._ubDontInvertY;
    const bufferLeftOver = webgpuPipelineContext.uniformBuffer.getBuffer();
    const key = bufferLeftOver.uniqueId + "-" + bufferInternals.uniqueId;
    let bindGroups = this._bindGroups[key];
    if (!bindGroups) {
      const bindGroupLayouts = webgpuPipelineContext.bindGroupLayouts[0];
      bindGroups = this._bindGroups[key] = [];
      bindGroups.push(this._device.createBindGroup({
        label: `clearQuadBindGroup0-${key}`,
        layout: bindGroupLayouts[0],
        entries: []
      }));
      if (!WebGPUShaderProcessingContext._SimplifiedKnownBindings) {
        bindGroups.push(this._device.createBindGroup({
          label: `clearQuadBindGroup1-${key}`,
          layout: bindGroupLayouts[1],
          entries: []
        }));
      }
      bindGroups.push(this._device.createBindGroup({
        label: `clearQuadBindGroup${WebGPUShaderProcessingContext._SimplifiedKnownBindings ? 1 : 2}-${key}`,
        layout: bindGroupLayouts[WebGPUShaderProcessingContext._SimplifiedKnownBindings ? 1 : 2],
        entries: [
          {
            binding: 0,
            resource: {
              buffer: bufferInternals.underlyingResource,
              size: bufferInternals.capacity
            }
          },
          {
            binding: 1,
            resource: {
              buffer: bufferLeftOver.underlyingResource,
              size: bufferLeftOver.capacity
            }
          }
        ]
      }));
    }
    renderPass2.setPipeline(pipeline);
    for (let i = 0; i < bindGroups.length; ++i) {
      renderPass2.setBindGroup(i, bindGroups[i]);
    }
    renderPass2.draw(4, 1, 0, 0);
    if (!renderPass) {
      bundle = renderPass2.finish();
      this._bundleCache[bundleKey] = bundle;
    }
    return bundle;
  }
}
class WebGPURenderItemViewport {
  constructor(x, y, w, h) {
    this.x = Math.floor(x);
    this.y = Math.floor(y);
    this.w = Math.floor(w);
    this.h = Math.floor(h);
  }
  run(renderPass) {
    renderPass.setViewport(this.x, this.y, this.w, this.h, 0, 1);
  }
  clone() {
    return new WebGPURenderItemViewport(this.x, this.y, this.w, this.h);
  }
}
class WebGPURenderItemScissor {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }
  run(renderPass) {
    renderPass.setScissorRect(this.x, this.y, this.w, this.h);
  }
  clone() {
    return new WebGPURenderItemScissor(this.x, this.y, this.w, this.h);
  }
}
class WebGPURenderItemStencilRef {
  constructor(ref) {
    this.ref = ref;
  }
  run(renderPass) {
    renderPass.setStencilReference(this.ref);
  }
  clone() {
    return new WebGPURenderItemStencilRef(this.ref);
  }
}
class WebGPURenderItemBlendColor {
  constructor(color) {
    this.color = color;
  }
  run(renderPass) {
    renderPass.setBlendConstant(this.color);
  }
  clone() {
    return new WebGPURenderItemBlendColor(this.color);
  }
}
class WebGPURenderItemBeginOcclusionQuery {
  constructor(query) {
    this.query = query;
  }
  run(renderPass) {
    renderPass.beginOcclusionQuery(this.query);
  }
  clone() {
    return new WebGPURenderItemBeginOcclusionQuery(this.query);
  }
}
class WebGPURenderItemEndOcclusionQuery {
  constructor() {
  }
  run(renderPass) {
    renderPass.endOcclusionQuery();
  }
  clone() {
    return new WebGPURenderItemEndOcclusionQuery();
  }
}
class WebGPURenderItemBundles {
  constructor() {
    this.bundles = [];
  }
  run(renderPass) {
    renderPass.executeBundles(this.bundles);
  }
  clone() {
    const cloned = new WebGPURenderItemBundles();
    cloned.bundles = this.bundles;
    return cloned;
  }
}
class WebGPUBundleList {
  /** @internal */
  get isEmpty() {
    return this._listLength === 0 && !this._bundleEncoder;
  }
  constructor(device) {
    this.numDrawCalls = 0;
    this._device = device;
    this._list = new Array(10);
    this._listLength = 0;
  }
  addBundle(bundle) {
    if (!this._currentItemIsBundle) {
      const item = new WebGPURenderItemBundles();
      this._list[this._listLength++] = item;
      this._currentBundleList = item.bundles;
      this._currentItemIsBundle = true;
    }
    if (bundle) {
      this._currentBundleList.push(bundle);
    }
  }
  _finishBundle() {
    if (this._currentItemIsBundle && this._bundleEncoder) {
      this._currentBundleList.push(this._bundleEncoder.finish());
      this._bundleEncoder = void 0;
      this._currentItemIsBundle = false;
    }
  }
  addItem(item) {
    this._finishBundle();
    this._list[this._listLength++] = item;
    this._currentItemIsBundle = false;
  }
  getBundleEncoder(colorFormats, depthStencilFormat, sampleCount) {
    if (!this._currentItemIsBundle) {
      this.addBundle();
      this._bundleEncoder = this._device.createRenderBundleEncoder({
        colorFormats,
        depthStencilFormat,
        sampleCount: WebGPUTextureHelper.GetSample(sampleCount)
      });
    }
    return this._bundleEncoder;
  }
  close() {
    this._finishBundle();
  }
  run(renderPass) {
    this.close();
    for (let i = 0; i < this._listLength; ++i) {
      this._list[i].run(renderPass);
    }
  }
  reset() {
    this._listLength = 0;
    this._currentItemIsBundle = false;
    this.numDrawCalls = 0;
  }
  clone() {
    this.close();
    const cloned = new WebGPUBundleList(this._device);
    cloned._list = new Array(this._listLength);
    cloned._listLength = this._listLength;
    cloned.numDrawCalls = this.numDrawCalls;
    for (let i = 0; i < this._listLength; ++i) {
      cloned._list[i] = this._list[i].clone();
    }
    return cloned;
  }
}
class WebGPUQuerySet {
  get querySet() {
    return this._querySet;
  }
  constructor(engine, count, type, device, bufferManager, canUseMultipleBuffers = true, label) {
    this._dstBuffers = [];
    this._engine = engine;
    this._device = device;
    this._bufferManager = bufferManager;
    this._count = count;
    this._canUseMultipleBuffers = canUseMultipleBuffers;
    this._querySet = device.createQuerySet({
      label: label ?? "QuerySet",
      type,
      count
    });
    this._queryBuffer = bufferManager.createRawBuffer(8 * count, BufferUsage.QueryResolve | BufferUsage.CopySrc, void 0, "QueryBuffer");
    if (!canUseMultipleBuffers) {
      this._dstBuffers.push(this._bufferManager.createRawBuffer(8 * this._count, BufferUsage.MapRead | BufferUsage.CopyDst, void 0, "QueryBufferNoMultipleBuffers"));
    }
  }
  _getBuffer(firstQuery, queryCount) {
    if (!this._canUseMultipleBuffers && this._dstBuffers.length === 0) {
      return null;
    }
    const encoderResult = this._device.createCommandEncoder();
    let buffer;
    if (this._dstBuffers.length === 0) {
      buffer = this._bufferManager.createRawBuffer(8 * this._count, BufferUsage.MapRead | BufferUsage.CopyDst, void 0, "QueryBufferAdditionalBuffer");
    } else {
      buffer = this._dstBuffers[this._dstBuffers.length - 1];
      this._dstBuffers.length--;
    }
    encoderResult.resolveQuerySet(this._querySet, firstQuery, queryCount, this._queryBuffer, 0);
    encoderResult.copyBufferToBuffer(this._queryBuffer, 0, buffer, 0, 8 * queryCount);
    this._device.queue.submit([encoderResult.finish()]);
    return buffer;
  }
  async readValues(firstQuery = 0, queryCount = 1) {
    const buffer = this._getBuffer(firstQuery, queryCount);
    if (buffer === null) {
      return null;
    }
    const engineId = this._engine.uniqueId;
    try {
      await buffer.mapAsync(
        1
        /* WebGPUConstants.MapMode.Read */
      );
      const arrayBuf = new BigUint64Array(buffer.getMappedRange()).slice();
      buffer.unmap();
      this._dstBuffers[this._dstBuffers.length] = buffer;
      return arrayBuf;
    } catch (err) {
      if (this._engine.isDisposed || this._engine.uniqueId !== engineId) {
        return null;
      }
      throw err;
    }
  }
  async readValue(firstQuery = 0) {
    const buffer = this._getBuffer(firstQuery, 1);
    if (buffer === null) {
      return null;
    }
    const engineId = this._engine.uniqueId;
    try {
      await buffer.mapAsync(
        1
        /* WebGPUConstants.MapMode.Read */
      );
      const arrayBuf = new BigUint64Array(buffer.getMappedRange());
      const value = Number(arrayBuf[0]);
      buffer.unmap();
      this._dstBuffers[this._dstBuffers.length] = buffer;
      return value;
    } catch (err) {
      if (this._engine.isDisposed || this._engine.uniqueId !== engineId) {
        return 0;
      }
      throw err;
    }
  }
  async readTwoValuesAndSubtract(firstQuery = 0) {
    const buffer = this._getBuffer(firstQuery, 2);
    if (buffer === null) {
      return null;
    }
    const engineId = this._engine.uniqueId;
    try {
      await buffer.mapAsync(
        1
        /* WebGPUConstants.MapMode.Read */
      );
      const arrayBuf = new BigUint64Array(buffer.getMappedRange());
      const value = Number(arrayBuf[1] - arrayBuf[0]);
      buffer.unmap();
      this._dstBuffers[this._dstBuffers.length] = buffer;
      return value;
    } catch (err) {
      if (this._engine.isDisposed || this._engine.uniqueId !== engineId) {
        return 0;
      }
      throw err;
    }
  }
  dispose() {
    this._querySet.destroy();
    this._bufferManager.releaseBuffer(this._queryBuffer);
    for (let i = 0; i < this._dstBuffers.length; ++i) {
      this._bufferManager.releaseBuffer(this._dstBuffers[i]);
    }
  }
}
class WebGPUTimestampQuery {
  get gpuFrameTimeCounter() {
    return this._gpuFrameTimeCounter;
  }
  constructor(engine, device, bufferManager) {
    this._enabled = false;
    this._gpuFrameTimeCounter = new PerfCounter();
    this._measureDurationState = 0;
    this._engine = engine;
    this._device = device;
    this._bufferManager = bufferManager;
  }
  get enable() {
    return this._enabled;
  }
  set enable(value) {
    if (this._enabled === value) {
      return;
    }
    this._enabled = value;
    this._measureDurationState = 0;
    if (value) {
      try {
        this._measureDuration = new WebGPUDurationMeasure(this._engine, this._device, this._bufferManager, 2e3, "QuerySet_TimestampQuery");
      } catch (e) {
        this._enabled = false;
        Logger.Error("Could not create a WebGPUDurationMeasure!\nError: " + e.message + "\nMake sure timestamp query is supported and enabled in your browser.");
        return;
      }
    } else {
      this._measureDuration.dispose();
    }
  }
  startFrame(commandEncoder) {
    if (this._enabled && this._measureDurationState === 0) {
      this._measureDuration.start(commandEncoder);
      this._measureDurationState = 1;
    }
  }
  endFrame(commandEncoder) {
    if (this._measureDurationState === 1) {
      this._measureDurationState = 2;
      this._measureDuration.stop(commandEncoder).then((duration) => {
        if (duration !== null && duration >= 0) {
          this._gpuFrameTimeCounter.fetchNewFrame();
          this._gpuFrameTimeCounter.addCount(duration, true);
        }
        this._measureDurationState = 0;
      });
    }
  }
  startPass(descriptor, index) {
    if (this._enabled) {
      this._measureDuration.startPass(descriptor, index);
    } else {
      descriptor.timestampWrites = void 0;
    }
  }
  endPass(index, gpuPerfCounter) {
    if (!this._enabled || !gpuPerfCounter) {
      return;
    }
    const currentFrameId = this._engine.frameId;
    this._measureDuration.stopPass(index).then((duration_) => {
      gpuPerfCounter._addDuration(currentFrameId, duration_ !== null && duration_ > 0 ? duration_ : 0);
    });
  }
  dispose() {
    this._measureDuration?.dispose();
  }
}
class WebGPUDurationMeasure {
  constructor(engine, device, bufferManager, count = 2, querySetLabel) {
    this._count = count;
    this._querySet = new WebGPUQuerySet(engine, count, "timestamp", device, bufferManager, true, querySetLabel);
  }
  start(encoder) {
    encoder.writeTimestamp?.(this._querySet.querySet, 0);
  }
  async stop(encoder) {
    encoder.writeTimestamp?.(this._querySet.querySet, 1);
    return encoder.writeTimestamp ? await this._querySet.readTwoValuesAndSubtract(0) : 0;
  }
  startPass(descriptor, index) {
    if (index + 3 > this._count) {
      throw new Error("WebGPUDurationMeasure: index out of range (" + index + ")");
    }
    descriptor.timestampWrites = {
      querySet: this._querySet.querySet,
      beginningOfPassWriteIndex: index + 2,
      endOfPassWriteIndex: index + 3
    };
  }
  async stopPass(index) {
    return await this._querySet.readTwoValuesAndSubtract(index + 2);
  }
  dispose() {
    this._querySet.dispose();
  }
}
class WebGPUOcclusionQuery {
  get querySet() {
    return this._querySet.querySet;
  }
  get hasQueries() {
    return this._currentTotalIndices !== this._availableIndices.length;
  }
  canBeginQuery(index) {
    if (this._frameQuerySetIsDirty === this._engine.frameId || this._queryFrameId[index] === this._engine.frameId) {
      return false;
    }
    const canBegin = this._engine._getCurrentRenderPassWrapper().renderPassDescriptor.occlusionQuerySet !== void 0;
    if (canBegin) {
      this._queryFrameId[index] = this._engine.frameId;
    }
    return canBegin;
  }
  constructor(engine, device, bufferManager, startCount = 50, incrementCount = 100) {
    this._availableIndices = [];
    this._frameQuerySetIsDirty = -1;
    this._queryFrameId = [];
    this._engine = engine;
    this._device = device;
    this._bufferManager = bufferManager;
    this._frameLastBuffer = -1;
    this._currentTotalIndices = 0;
    this._countIncrement = incrementCount;
    this._allocateNewIndices(startCount);
  }
  createQuery() {
    if (this._availableIndices.length === 0) {
      this._allocateNewIndices();
    }
    const index = this._availableIndices[this._availableIndices.length - 1];
    this._availableIndices.length--;
    return index;
  }
  deleteQuery(index) {
    this._availableIndices[this._availableIndices.length] = index;
  }
  isQueryResultAvailable(index) {
    this._retrieveQueryBuffer();
    return !!this._lastBuffer && index < this._lastBuffer.length;
  }
  getQueryResult(index) {
    return Number(this._lastBuffer?.[index] ?? -1);
  }
  _retrieveQueryBuffer() {
    if (this._lastBuffer && this._frameLastBuffer === this._engine.frameId) {
      return;
    }
    if (this._frameLastBuffer !== this._engine.frameId) {
      this._frameLastBuffer = this._engine.frameId;
      this._querySet.readValues(0, this._currentTotalIndices).then((arrayBuffer) => {
        this._lastBuffer = arrayBuffer;
      });
    }
  }
  _allocateNewIndices(numIndices) {
    numIndices = numIndices ?? this._countIncrement;
    this._delayQuerySetDispose();
    for (let i = 0; i < numIndices; ++i) {
      this._availableIndices.push(this._currentTotalIndices + i);
    }
    this._currentTotalIndices += numIndices;
    this._querySet = new WebGPUQuerySet(this._engine, this._currentTotalIndices, "occlusion", this._device, this._bufferManager, false, "QuerySet_OcclusionQuery_count_" + this._currentTotalIndices);
    this._frameQuerySetIsDirty = this._engine.frameId;
  }
  _delayQuerySetDispose() {
    const querySet = this._querySet;
    if (querySet) {
      setTimeout(() => querySet.dispose(), 1e3);
    }
  }
  dispose() {
    this._querySet?.dispose();
    this._availableIndices.length = 0;
  }
}
class ShaderCodeInliner {
  /** Gets the code after the inlining process */
  get code() {
    return this._sourceCode;
  }
  /**
   * Initializes the inliner
   * @param sourceCode shader code source to inline
   * @param numMaxIterations maximum number of iterations (used to detect recursive calls)
   */
  constructor(sourceCode, numMaxIterations = 20) {
    this.debug = false;
    this._sourceCode = sourceCode;
    this._numMaxIterations = numMaxIterations;
    this._functionDescr = [];
    this.inlineToken = "#define inline";
  }
  /**
   * Start the processing of the shader code
   */
  processCode() {
    if (this.debug) {
      Logger.Log(`Start inlining process (code size=${this._sourceCode.length})...`);
    }
    this._collectFunctions();
    this._processInlining(this._numMaxIterations);
    if (this.debug) {
      Logger.Log("End of inlining process.");
    }
  }
  _collectFunctions() {
    let startIndex = 0;
    while (startIndex < this._sourceCode.length) {
      const inlineTokenIndex = this._sourceCode.indexOf(this.inlineToken, startIndex);
      if (inlineTokenIndex < 0) {
        break;
      }
      const funcParamsStartIndex = this._sourceCode.indexOf("(", inlineTokenIndex + this.inlineToken.length);
      if (funcParamsStartIndex < 0) {
        if (this.debug) {
          Logger.Warn(`Could not find the opening parenthesis after the token. startIndex=${startIndex}`);
        }
        startIndex = inlineTokenIndex + this.inlineToken.length;
        continue;
      }
      const funcNameMatch = ShaderCodeInliner._RegexpFindFunctionNameAndType.exec(this._sourceCode.substring(inlineTokenIndex + this.inlineToken.length, funcParamsStartIndex));
      if (!funcNameMatch) {
        if (this.debug) {
          Logger.Warn(`Could not extract the name/type of the function from: ${this._sourceCode.substring(inlineTokenIndex + this.inlineToken.length, funcParamsStartIndex)}`);
        }
        startIndex = inlineTokenIndex + this.inlineToken.length;
        continue;
      }
      const [funcType, funcName] = [funcNameMatch[3], funcNameMatch[4]];
      const funcParamsEndIndex = ExtractBetweenMarkers("(", ")", this._sourceCode, funcParamsStartIndex);
      if (funcParamsEndIndex < 0) {
        if (this.debug) {
          Logger.Warn(`Could not extract the parameters the function '${funcName}' (type=${funcType}). funcParamsStartIndex=${funcParamsStartIndex}`);
        }
        startIndex = inlineTokenIndex + this.inlineToken.length;
        continue;
      }
      const funcParams = this._sourceCode.substring(funcParamsStartIndex + 1, funcParamsEndIndex);
      const funcBodyStartIndex = SkipWhitespaces(this._sourceCode, funcParamsEndIndex + 1);
      if (funcBodyStartIndex === this._sourceCode.length) {
        if (this.debug) {
          Logger.Warn(`Could not extract the body of the function '${funcName}' (type=${funcType}). funcParamsEndIndex=${funcParamsEndIndex}`);
        }
        startIndex = inlineTokenIndex + this.inlineToken.length;
        continue;
      }
      const funcBodyEndIndex = ExtractBetweenMarkers("{", "}", this._sourceCode, funcBodyStartIndex);
      if (funcBodyEndIndex < 0) {
        if (this.debug) {
          Logger.Warn(`Could not extract the body of the function '${funcName}' (type=${funcType}). funcBodyStartIndex=${funcBodyStartIndex}`);
        }
        startIndex = inlineTokenIndex + this.inlineToken.length;
        continue;
      }
      const funcBody = this._sourceCode.substring(funcBodyStartIndex, funcBodyEndIndex + 1);
      const params = RemoveComments(funcParams).split(",");
      const paramNames = [];
      for (let p = 0; p < params.length; ++p) {
        const param = params[p].trim();
        const idx = param.lastIndexOf(" ");
        if (idx >= 0) {
          paramNames.push(param.substring(idx + 1));
        }
      }
      if (funcType !== "void") {
        paramNames.push("return");
      }
      this._functionDescr.push({
        name: funcName,
        type: funcType,
        parameters: paramNames,
        body: funcBody,
        callIndex: 0
      });
      startIndex = funcBodyEndIndex + 1;
      const partBefore = inlineTokenIndex > 0 ? this._sourceCode.substring(0, inlineTokenIndex) : "";
      const partAfter = funcBodyEndIndex + 1 < this._sourceCode.length - 1 ? this._sourceCode.substring(funcBodyEndIndex + 1) : "";
      this._sourceCode = partBefore + partAfter;
      startIndex -= funcBodyEndIndex + 1 - inlineTokenIndex;
    }
    if (this.debug) {
      Logger.Log(`Collect functions: ${this._functionDescr.length} functions found. functionDescr=${this._functionDescr}`);
    }
  }
  _processInlining(numMaxIterations = 20) {
    while (numMaxIterations-- >= 0) {
      if (!this._replaceFunctionCallsByCode()) {
        break;
      }
    }
    if (this.debug) {
      Logger.Log(`numMaxIterations is ${numMaxIterations} after inlining process`);
    }
    return numMaxIterations >= 0;
  }
  _replaceFunctionCallsByCode() {
    let doAgain = false;
    for (const func of this._functionDescr) {
      const { name: name2, type, parameters, body } = func;
      let startIndex = 0;
      while (startIndex < this._sourceCode.length) {
        const functionCallIndex = this._sourceCode.indexOf(name2, startIndex);
        if (functionCallIndex < 0) {
          break;
        }
        if (functionCallIndex === 0 || IsIdentifierChar(this._sourceCode.charAt(functionCallIndex - 1))) {
          startIndex = functionCallIndex + name2.length;
          continue;
        }
        const callParamsStartIndex = SkipWhitespaces(this._sourceCode, functionCallIndex + name2.length);
        if (callParamsStartIndex === this._sourceCode.length || this._sourceCode.charAt(callParamsStartIndex) !== "(") {
          startIndex = functionCallIndex + name2.length;
          continue;
        }
        const callParamsEndIndex = ExtractBetweenMarkers("(", ")", this._sourceCode, callParamsStartIndex);
        if (callParamsEndIndex < 0) {
          if (this.debug) {
            Logger.Warn(`Could not extract the parameters of the function call. Function '${name2}' (type=${type}). callParamsStartIndex=${callParamsStartIndex}`);
          }
          startIndex = functionCallIndex + name2.length;
          continue;
        }
        const callParams = this._sourceCode.substring(callParamsStartIndex + 1, callParamsEndIndex);
        const splitParameterCall = (s) => {
          const parameters2 = [];
          let curIdx = 0, startParamIdx = 0;
          while (curIdx < s.length) {
            if (s.charAt(curIdx) === "(") {
              const idx2 = ExtractBetweenMarkers("(", ")", s, curIdx);
              if (idx2 < 0) {
                return null;
              }
              curIdx = idx2;
            } else if (s.charAt(curIdx) === ",") {
              parameters2.push(s.substring(startParamIdx, curIdx));
              startParamIdx = curIdx + 1;
            }
            curIdx++;
          }
          if (startParamIdx < curIdx) {
            parameters2.push(s.substring(startParamIdx, curIdx));
          }
          return parameters2;
        };
        const params = splitParameterCall(RemoveComments(callParams));
        if (params === null) {
          if (this.debug) {
            Logger.Warn(`Invalid function call: can't extract the parameters of the function call. Function '${name2}' (type=${type}). callParamsStartIndex=${callParamsStartIndex}, callParams=` + callParams);
          }
          startIndex = functionCallIndex + name2.length;
          continue;
        }
        const paramNames = [];
        for (let p = 0; p < params.length; ++p) {
          const param = params[p].trim();
          paramNames.push(param);
        }
        const retParamName = type !== "void" ? name2 + "_" + func.callIndex++ : null;
        if (retParamName) {
          paramNames.push(retParamName + " =");
        }
        if (paramNames.length !== parameters.length) {
          if (this.debug) {
            Logger.Warn(`Invalid function call: not the same number of parameters for the call than the number expected by the function. Function '${name2}' (type=${type}). function parameters=${parameters}, call parameters=${paramNames}`);
          }
          startIndex = functionCallIndex + name2.length;
          continue;
        }
        startIndex = callParamsEndIndex + 1;
        const funcBody = this._replaceNames(body, parameters, paramNames);
        let partBefore = functionCallIndex > 0 ? this._sourceCode.substring(0, functionCallIndex) : "";
        const partAfter = callParamsEndIndex + 1 < this._sourceCode.length - 1 ? this._sourceCode.substring(callParamsEndIndex + 1) : "";
        if (retParamName) {
          const injectDeclarationIndex = FindBackward(this._sourceCode, functionCallIndex - 1, "\n", "{");
          partBefore = this._sourceCode.substring(0, injectDeclarationIndex + 1);
          const partBetween = this._sourceCode.substring(injectDeclarationIndex + 1, functionCallIndex);
          this._sourceCode = partBefore + type + " " + retParamName + ";\n" + funcBody + "\n" + partBetween + retParamName + partAfter;
          if (this.debug) {
            Logger.Log(`Replace function call by code. Function '${name2}' (type=${type}). injectDeclarationIndex=${injectDeclarationIndex}, call parameters=${paramNames}`);
          }
        } else {
          this._sourceCode = partBefore + funcBody + partAfter;
          startIndex += funcBody.length - (callParamsEndIndex + 1 - functionCallIndex);
          if (this.debug) {
            Logger.Log(`Replace function call by code. Function '${name2}' (type=${type}). functionCallIndex=${functionCallIndex}, call parameters=${paramNames}`);
          }
        }
        doAgain = true;
      }
    }
    return doAgain;
  }
  _replaceNames(code, sources, destinations) {
    for (let i = 0; i < sources.length; ++i) {
      const source = new RegExp(EscapeRegExp(sources[i]), "g"), sourceLen = sources[i].length, destination = destinations[i];
      code = code.replace(source, (match, ...args) => {
        const offset = args[0];
        if (IsIdentifierChar(code.charAt(offset - 1)) || IsIdentifierChar(code.charAt(offset + sourceLen))) {
          return sources[i];
        }
        return destination;
      });
    }
    return code;
  }
}
ShaderCodeInliner._RegexpFindFunctionNameAndType = /((\s+?)(\w+)\s+(\w+)\s*?)$/;
class WebGPUTintWASM {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  async initTwgsl(twgslOptions) {
    if (WebGPUTintWASM._Twgsl) {
      return;
    }
    twgslOptions = twgslOptions || {};
    twgslOptions = {
      ...WebGPUTintWASM._TwgslDefaultOptions,
      ...twgslOptions
    };
    if (twgslOptions.twgsl) {
      WebGPUTintWASM._Twgsl = twgslOptions.twgsl;
      return;
    }
    if (twgslOptions.jsPath && twgslOptions.wasmPath) {
      await Tools.LoadBabylonScriptAsync(twgslOptions.jsPath);
    }
    if (self.twgsl) {
      WebGPUTintWASM._Twgsl = await self.twgsl(Tools.GetBabylonScriptURL(twgslOptions.wasmPath));
      return;
    }
    throw new Error("twgsl is not available.");
  }
  convertSpirV2WGSL(code, disableUniformityAnalysis = false) {
    const ccode = WebGPUTintWASM._Twgsl.convertSpirV2WGSL(code, WebGPUTintWASM.DisableUniformityAnalysis || disableUniformityAnalysis);
    if (WebGPUTintWASM.ShowWGSLShaderCode) {
      Logger.Log(ccode);
      Logger.Log("***********************************************");
    }
    return WebGPUTintWASM.DisableUniformityAnalysis || disableUniformityAnalysis ? "diagnostic(off, derivative_uniformity);\n" + ccode : ccode;
  }
}
WebGPUTintWASM._TwgslDefaultOptions = {
  jsPath: `${Tools._DefaultCdnUrl}/twgsl/twgsl.js`,
  wasmPath: `${Tools._DefaultCdnUrl}/twgsl/twgsl.wasm`
};
WebGPUTintWASM.ShowWGSLShaderCode = false;
WebGPUTintWASM.DisableUniformityAnalysis = false;
WebGPUTintWASM._Twgsl = null;
class WebGPUSnapshotRendering {
  constructor(engine, renderingMode, bundleList) {
    this._record = false;
    this._play = false;
    this._playBundleListIndex = 0;
    this._allBundleLists = [];
    this._recordingInvalidated = false;
    this._skipNextRenderPass = false;
    this._enabled = false;
    this.showDebugLogs = false;
    this._engine = engine;
    this._mode = renderingMode;
    this._bundleList = bundleList;
  }
  get enabled() {
    return this._enabled;
  }
  get play() {
    return this._play;
  }
  get record() {
    return this._record;
  }
  set enabled(activate) {
    this._log("enabled", `activate=${activate}, mode=${this._mode}`);
    this._allBundleLists.length = 0;
    this._recordingInvalidated = false;
    this._skipNextRenderPass = false;
    if (this._record) {
      this._mode = this._modeSaved;
    }
    this._record = this._enabled = activate;
    this._play = false;
    if (activate) {
      this._modeSaved = this._mode;
      this._mode = 0;
    }
  }
  get mode() {
    return this._mode;
  }
  set mode(mode) {
    if (this._record) {
      this._modeSaved = mode;
    } else {
      this._mode = mode;
    }
  }
  /** @internal */
  handleRenderPassRestart() {
    if (!this._record) {
      return;
    }
    if (this._bundleList.isEmpty) {
      this._skipNextRenderPass = true;
    } else {
      this._allBundleLists.length = 0;
      this._recordingInvalidated = true;
    }
  }
  endRenderPass(currentRenderPass) {
    if (!this._record && !this._play) {
      return false;
    }
    let bundleList = null;
    if (this._record) {
      bundleList = this._bundleList.clone();
      this._bundleList.reset();
      if (this._skipNextRenderPass) {
        this._skipNextRenderPass = false;
        this._log("endRenderPass", "bundleList omitted for a restarted empty pass");
      } else if (this._recordingInvalidated) {
        this._log("endRenderPass", "bundleList discarded from an invalidated recording");
      } else {
        this._allBundleLists.push(bundleList);
        this._log("endRenderPass", `bundleList recorded at position #${this._allBundleLists.length - 1}`);
      }
    } else {
      if (this._playBundleListIndex >= this._allBundleLists.length) {
        this._log("endRenderPass", `empty or out-of-sync bundleList (_allBundleLists.length=${this._allBundleLists.length}, playBundleListIndex=${this._playBundleListIndex})`);
      } else {
        this._log("endRenderPass", `run bundleList #${this._playBundleListIndex}`);
        bundleList = this._allBundleLists[this._playBundleListIndex++];
      }
    }
    if (bundleList) {
      bundleList.run(currentRenderPass);
      if (this._mode === 1) {
        this._engine._reportDrawCall(bundleList.numDrawCalls);
      }
    }
    return true;
  }
  endFrame() {
    if (this._record) {
      if (this._recordingInvalidated) {
        this._recordingInvalidated = false;
        this._allBundleLists.length = 0;
        this._log("endFrame", "recording invalidated, recording the next frame");
      } else {
        this._record = false;
        this._play = true;
        this._mode = this._modeSaved;
        this._log("endFrame", "bundles recorded, switching to play mode");
      }
    }
    this._playBundleListIndex = 0;
  }
  reset() {
    this._log("reset", "called");
    this.enabled = false;
    this.enabled = true;
  }
  _log(funcName, message) {
    if (this.showDebugLogs) {
      Logger.Log(`[Frame: ${this._engine.frameId}] WebGPUSnapshotRendering:${funcName} - ${message}`);
    }
  }
}
class WebGPUExternalTexture extends ExternalTexture {
  constructor(video) {
    super(video);
  }
}
const ViewDescriptorSwapChainAntialiasing = {
  label: `TextureView_SwapChain_ResolveTarget`,
  dimension: "2d",
  format: void 0,
  // will be updated with the right value
  mipLevelCount: 1,
  arrayLayerCount: 1
};
const ViewDescriptorSwapChain = {
  label: `TextureView_SwapChain`,
  dimension: "2d",
  format: void 0,
  // will be updated with the right value
  mipLevelCount: 1,
  arrayLayerCount: 1
};
const TempColor4 = /* @__PURE__ */ new Color4();
const TempColor4SignedInteger = /* @__PURE__ */ new Color4();
class WebGPUEngine extends ThinWebGPUEngine {
  /**
   * Gets or sets the snapshot rendering mode
   */
  get snapshotRenderingMode() {
    return this._snapshotRendering.mode;
  }
  set snapshotRenderingMode(mode) {
    this._snapshotRendering.mode = mode;
  }
  /**
   * Creates a new snapshot at the next frame using the current snapshotRenderingMode
   */
  snapshotRenderingReset() {
    this._snapshotRendering.reset();
  }
  /**
   * Enables or disables the snapshot rendering mode
   * Note that the WebGL engine does not support snapshot rendering so setting the value won't have any effect for this engine
   */
  get snapshotRendering() {
    return this._snapshotRendering.enabled;
  }
  set snapshotRendering(activate) {
    this._snapshotRendering.enabled = activate;
  }
  /**
   * Sets this to true to disable the cache for the samplers. You should do it only for testing purpose!
   */
  get disableCacheSamplers() {
    return this._cacheSampler ? this._cacheSampler.disabled : false;
  }
  set disableCacheSamplers(disable) {
    if (this._cacheSampler) {
      this._cacheSampler.disabled = disable;
    }
  }
  /**
   * Sets this to true to disable the cache for the render pipelines. You should do it only for testing purpose!
   */
  get disableCacheRenderPipelines() {
    return this._cacheRenderPipeline ? this._cacheRenderPipeline.disabled : false;
  }
  set disableCacheRenderPipelines(disable) {
    if (this._cacheRenderPipeline) {
      this._cacheRenderPipeline.disabled = disable;
    }
  }
  /**
   * Sets this to true to disable the cache for the bind groups. You should do it only for testing purpose!
   */
  get disableCacheBindGroups() {
    return this._cacheBindGroups ? this._cacheBindGroups.disabled : false;
  }
  set disableCacheBindGroups(disable) {
    if (this._cacheBindGroups) {
      this._cacheBindGroups.disabled = disable;
    }
  }
  /**
   * Gets a boolean indicating if all created effects are ready
   * @returns true if all effects are ready
   */
  areAllEffectsReady() {
    return true;
  }
  /**
   * Get Font size information
   * @param font font name
   * @returns an object containing ascent, height and descent
   */
  getFontOffset(font) {
    return GetFontOffset(font);
  }
  /**
   * Gets a Promise<boolean> indicating if the engine can be instantiated (ie. if a WebGPU context can be found)
   */
  // eslint-disable-next-line no-restricted-syntax
  static get IsSupportedAsync() {
    return !navigator.gpu ? Promise.resolve(false) : navigator.gpu.requestAdapter().then((adapter) => !!adapter, () => false).catch(() => false);
  }
  /**
   * Not supported by WebGPU, you should call IsSupportedAsync instead!
   */
  static get IsSupported() {
    Logger.Warn("You must call IsSupportedAsync for WebGPU!");
    return false;
  }
  /**
   * Gets a boolean indicating that the engine supports uniform buffers
   */
  get supportsUniformBuffers() {
    return true;
  }
  /** Gets the supported extensions by the WebGPU adapter */
  get supportedExtensions() {
    return this._adapterSupportedExtensions;
  }
  /** Gets the currently enabled extensions on the WebGPU device */
  get enabledExtensions() {
    return this._deviceEnabledExtensions;
  }
  /** Gets the supported limits by the WebGPU adapter */
  get supportedLimits() {
    return this._adapterSupportedLimits;
  }
  /** Gets the current limits of the WebGPU device */
  get currentLimits() {
    return this._deviceLimits;
  }
  /**
   * Returns a string describing the current engine
   */
  get description() {
    const description = this.name + this.version;
    return description;
  }
  /**
   * Returns the version of the engine
   */
  get version() {
    return 1;
  }
  /**
   * Gets an object containing information about the current engine context
   * @returns an object containing the vendor, the renderer and the version of the current engine context
   */
  getInfo() {
    return {
      vendor: this._adapterInfo.vendor || "unknown vendor",
      renderer: this._adapterInfo.architecture || "unknown renderer",
      version: this._adapterInfo.description || "unknown version"
    };
  }
  /**
   * (WebGPU only) True (default) to be in compatibility mode, meaning rendering all existing scenes without artifacts (same rendering than WebGL).
   * Setting the property to false will improve performances but may not work in some scenes if some precautions are not taken.
   * See https://doc.babylonjs.com/setup/support/webGPU/webGPUOptimization/webGPUNonCompatibilityMode for more details
   */
  get compatibilityMode() {
    return this._compatibilityMode;
  }
  set compatibilityMode(mode) {
    this._compatibilityMode = mode;
  }
  /**
   * Gets the number of samples used by the current render target
   * @returns the current sample count, or 1 when multisampling is disabled
   */
  get currentSampleCount() {
    return this._currentRenderTarget ? this._currentRenderTarget.samples : this._mainPassSampleCount;
  }
  /**
   * Create a new instance of the gpu engine asynchronously
   * @param canvas Defines the canvas to use to display the result
   * @param options Defines the options passed to the engine to create the GPU context dependencies
   * @returns a promise that resolves with the created engine
   */
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  static CreateAsync(canvas, options = {}) {
    const engine = new WebGPUEngine(canvas, options);
    return new Promise((resolve) => {
      engine.initAsync(options.glslangOptions, options.twgslOptions).then(() => resolve(engine));
    });
  }
  /**
   * Create a new instance of the gpu engine.
   * @param canvas Defines the canvas to use to display the result
   * @param options Defines the options passed to the engine to create the GPU context dependencies
   */
  constructor(canvas, options = {}) {
    RegisterAbstractEngineDom();
    RegisterAbstractEngineRenderPass();
    super(options.antialias ?? true, options);
    this.uniqueId = -1;
    this._uploadEncoderDescriptor = { label: "upload" };
    this._renderEncoderDescriptor = { label: "render" };
    this._clearDepthValue = 1;
    this._clearReverseDepthValue = 0;
    this._clearStencilValue = 0;
    this._defaultSampleCount = 4;
    this._glslang = null;
    this._tintWASM = null;
    this._glslangAndTintAreFullyLoaded = false;
    this._adapterInfo = {
      vendor: "",
      architecture: "",
      device: "",
      description: "",
      subgroupMinSize: 0,
      subgroupMaxSize: 0,
      isFallbackAdapter: false
    };
    this._compiledComputeEffects = {};
    this._counters = {
      numEnableEffects: 0,
      numEnableDrawWrapper: 0,
      numBundleCreationNonCompatMode: 0,
      numBundleReuseNonCompatMode: 0
    };
    this.countersLastFrame = {
      numEnableEffects: 0,
      numEnableDrawWrapper: 0,
      numBundleCreationNonCompatMode: 0,
      numBundleReuseNonCompatMode: 0
    };
    this.numMaxUncapturedErrors = 20;
    this.scenes = [];
    this._virtualScenes = new Array();
    this._commandBuffers = [null, null];
    this._mainRenderPassWrapper = {
      renderPassDescriptor: null,
      colorAttachmentViewDescriptor: null,
      colorAttachmentDepthSlice: void 0,
      depthAttachmentViewDescriptor: null,
      colorAttachmentGPUTextures: [],
      depthTextureFormat: void 0
    };
    this._rttRenderPassWrapper = {
      renderPassDescriptor: null,
      colorAttachmentViewDescriptor: null,
      colorAttachmentDepthSlice: void 0,
      depthAttachmentViewDescriptor: null,
      colorAttachmentGPUTextures: [],
      depthTextureFormat: void 0
    };
    this._currentVertexBuffers = {};
    this._currentOverrideVertexBuffers = null;
    this._currentIndexBuffer = null;
    this._colorWriteLocal = true;
    this._forceEnableEffect = false;
    this._internalFrameCounter = 0;
    this._useOwnerKeyedUniformBufferSlots = true;
    this.isNDCHalfZRange = true;
    this.hasOriginBottomLeft = false;
    this._workingGlslangAndTintPromise = null;
    this._viewportsCurrent = { x: 0, y: 0, w: 0, h: 0 };
    this._scissorsCurrent = { x: 0, y: 0, w: 0, h: 0 };
    this._scissorCached = { x: 0, y: 0, z: 0, w: 0 };
    this._stencilRefsCurrent = -1;
    this._blendColorsCurrent = [null, null, null, null];
    this._performanceMonitor = new PerformanceMonitor();
    this._name = "WebGPU";
    this._drawCalls = new PerfCounter();
    options.deviceDescriptor = options.deviceDescriptor || {};
    options.enableGPUDebugMarkers = options.enableGPUDebugMarkers ?? false;
    this._enableGPUDebugMarkers = options.enableGPUDebugMarkers;
    Logger.Log(`Babylon.js v${AbstractEngine.Version} - ${this.description} engine`);
    if (!navigator.gpu) {
      Logger.Error("WebGPU is not supported by your browser.");
      return;
    }
    options.swapChainFormat = options.swapChainFormat || navigator.gpu.getPreferredCanvasFormat();
    this._isWebGPU = true;
    this._shaderPlatformName = "WEBGPU";
    this._renderingCanvas = canvas;
    this._options = options;
    this._mainPassSampleCount = options.antialias ? this._defaultSampleCount : 1;
    if (navigator && navigator.userAgent) {
      this._setupMobileChecks();
    }
    this._sharedInit(this._renderingCanvas);
    this._shaderProcessor = new WebGPUShaderProcessorGLSL();
    this._shaderProcessorWGSL = new WebGPUShaderProcessorWGSL();
  }
  /**
   * Load the glslang and tintWASM libraries and prepare them for use.
   * @returns a promise that resolves when the engine is ready to use the glslang and tintWASM
   */
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  prepareGlslangAndTintAsync() {
    if (!this._workingGlslangAndTintPromise) {
      this._workingGlslangAndTintPromise = new Promise((resolve) => {
        this._initGlslangAsync(this._glslangOptions ?? this._options?.glslangOptions).then((glslang) => {
          this._glslang = glslang;
          this._tintWASM = new WebGPUTintWASM();
          this._tintWASM.initTwgsl(this._twgslOptions ?? this._options?.twgslOptions).then(() => {
            this._glslangAndTintAreFullyLoaded = true;
            resolve();
          });
        });
      });
    }
    return this._workingGlslangAndTintPromise;
  }
  /**
   * Initializes the WebGPU context and dependencies.
   * @param glslangOptions Defines the GLSLang compiler options if necessary
   * @param twgslOptions Defines the Twgsl compiler options if necessary
   * @returns a promise notifying the readiness of the engine.
   */
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  initAsync(glslangOptions, twgslOptions) {
    this.uniqueId = WebGPUEngine._InstanceId++;
    this._glslangOptions = glslangOptions;
    this._twgslOptions = twgslOptions;
    return navigator.gpu.requestAdapter(this._options).then(async (adapter) => {
      if (!adapter) {
        throw "Could not retrieve a WebGPU adapter (adapter is null or undefined).";
      } else {
        this._adapter = adapter;
        this._adapterSupportedExtensions = [];
        this._adapter.features?.forEach((feature) => {
          this._adapterSupportedExtensions.push(feature);
        });
        this._adapterSupportedLimits = this._adapter.limits;
        this._adapterInfo = this._adapter.info;
        const deviceDescriptor = this._options.deviceDescriptor ?? {};
        const requiredFeatures = deviceDescriptor?.requiredFeatures ?? (this._options.enableAllFeatures ? this._adapterSupportedExtensions : void 0);
        if (requiredFeatures) {
          const requestedExtensions = requiredFeatures;
          const validExtensions = [];
          for (const extension of requestedExtensions) {
            if (this._adapterSupportedExtensions.indexOf(extension) !== -1) {
              validExtensions.push(extension);
            }
          }
          deviceDescriptor.requiredFeatures = validExtensions;
        }
        if (this._options.setMaximumLimits && !deviceDescriptor.requiredLimits) {
          deviceDescriptor.requiredLimits = {};
          for (const name2 in this._adapterSupportedLimits) {
            if (name2 === "minSubgroupSize" || name2 === "maxSubgroupSize") {
              continue;
            }
            deviceDescriptor.requiredLimits[name2] = this._adapterSupportedLimits[name2];
          }
        }
        deviceDescriptor.label = `BabylonWebGPUDevice${this.uniqueId}`;
        return await this._adapter.requestDevice(deviceDescriptor);
      }
    }).then((device) => {
      this._device = device;
      this._deviceEnabledExtensions = [];
      this._device.features?.forEach((feature) => {
        this._deviceEnabledExtensions.push(feature);
      });
      this._deviceLimits = device.limits;
      let numUncapturedErrors = -1;
      this._device.addEventListener("uncapturederror", (event) => {
        if (++numUncapturedErrors < this.numMaxUncapturedErrors) {
          Logger.Warn(`[Frame ${this._frameId}] WebGPU uncaptured error (${numUncapturedErrors + 1}): ${event.error} - ${event.error.message}`);
        } else if (numUncapturedErrors++ === this.numMaxUncapturedErrors) {
          Logger.Warn(`[Frame ${this._frameId}] WebGPU uncaptured error: too many warnings (${this.numMaxUncapturedErrors}), no more warnings will be reported to the console for this engine.`);
        }
      });
      if (!this._doNotHandleContextLost) {
        this._device.lost?.then((info) => {
          if (this._isDisposed) {
            return;
          }
          this._contextWasLost = true;
          Logger.Warn("WebGPU context lost. " + info);
          this.onContextLostObservable.notifyObservers(this);
          this._restoreEngineAfterContextLost(async () => {
            const snapshotRenderingMode = this.snapshotRenderingMode;
            const snapshotRendering = this.snapshotRendering;
            const disableCacheSamplers = this.disableCacheSamplers;
            const disableCacheRenderPipelines = this.disableCacheRenderPipelines;
            const disableCacheBindGroups = this.disableCacheBindGroups;
            const enableGPUTimingMeasurements = this.enableGPUTimingMeasurements;
            await this.initAsync(this._glslangOptions ?? this._options?.glslangOptions, this._twgslOptions ?? this._options?.twgslOptions);
            this.snapshotRenderingMode = snapshotRenderingMode;
            this.snapshotRendering = snapshotRendering;
            this.disableCacheSamplers = disableCacheSamplers;
            this.disableCacheRenderPipelines = disableCacheRenderPipelines;
            this.disableCacheBindGroups = disableCacheBindGroups;
            this.enableGPUTimingMeasurements = enableGPUTimingMeasurements;
            this._currentRenderPass = null;
          });
        });
      }
    }).then(() => {
      this._initializeLimits();
      this._bufferManager = new WebGPUBufferManager(this, this._device);
      this._textureHelper = new WebGPUTextureManager(this, this._device, this._bufferManager, this._deviceEnabledExtensions);
      this._cacheSampler = new WebGPUCacheSampler(this._device);
      this._cacheBindGroups = new WebGPUCacheBindGroups(this._device, this._cacheSampler, this);
      this._cacheTextureViews = new WebGPUCacheTextureView();
      this._timestampQuery = new WebGPUTimestampQuery(this, this._device, this._bufferManager);
      this._occlusionQuery = this._device.createQuerySet ? new WebGPUOcclusionQuery(this, this._device, this._bufferManager) : void 0;
      this._bundleList = new WebGPUBundleList(this._device);
      this._snapshotRendering = new WebGPUSnapshotRendering(this, this._snapshotRenderingMode, this._bundleList);
      this._ubInvertY = this._bufferManager.createBuffer(new Float32Array([-1, 0]), BufferUsage.Uniform | BufferUsage.CopyDst, "UBInvertY");
      this._ubDontInvertY = this._bufferManager.createBuffer(new Float32Array([1, 0]), BufferUsage.Uniform | BufferUsage.CopyDst, "UBDontInvertY");
      const frameCounter = this._internalFrameCounter++;
      this._uploadEncoderDescriptor.label = `[${this.frameId}|${frameCounter}] - UploadEncoder`;
      this._renderEncoderDescriptor.label = `[${this.frameId}|${frameCounter}] - RenderEncoder`;
      this._uploadEncoder = this._device.createCommandEncoder(this._uploadEncoderDescriptor);
      this._renderEncoder = this._device.createCommandEncoder(this._renderEncoderDescriptor);
      this._emptyVertexBuffer = new VertexBuffer(this, [0], "", {
        stride: 1,
        offset: 0,
        size: 1,
        label: "EmptyVertexBuffer"
      });
      this._dummyIndexBuffer = this._bufferManager.createBuffer(new Uint16Array([0, 0, 0, 0]), BufferUsage.Storage | BufferUsage.CopyDst, "DummyIndices");
      this._cacheRenderPipeline = new WebGPUCacheRenderPipelineTree(this._device, this._emptyVertexBuffer);
      this._depthCullingState = new WebGPUDepthCullingState(this._cacheRenderPipeline);
      this._stencilStateComposer = new WebGPUStencilStateComposer(this._cacheRenderPipeline);
      this._stencilStateComposer.stencilGlobal = this._stencilState;
      this._depthCullingState.depthTest = true;
      this._depthCullingState.depthFunc = 515;
      this._depthCullingState.depthMask = true;
      this._textureHelper.setCommandEncoder(this._uploadEncoder);
      this._clearQuad = new WebGPUClearQuad(this._device, this, this._emptyVertexBuffer);
      this._defaultDrawContext = this.createDrawContext();
      this._currentDrawContext = this._defaultDrawContext;
      this._defaultMaterialContext = this.createMaterialContext();
      this._currentMaterialContext = this._defaultMaterialContext;
      this._initializeContextAndSwapChain();
      this._initializeMainAttachments();
      this.resize();
    }).catch((e) => {
      Logger.Error("A fatal error occurred during WebGPU creation/initialization.");
      throw e;
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _initGlslangAsync(glslangOptions) {
    glslangOptions = glslangOptions || {};
    glslangOptions = {
      ...WebGPUEngine._GlslangDefaultOptions,
      ...glslangOptions
    };
    if (glslangOptions.glslang) {
      return glslangOptions.glslang;
    }
    if (self.glslang) {
      return self.glslang(glslangOptions.wasmPath);
    }
    if (glslangOptions.jsPath && glslangOptions.wasmPath) {
      return Tools.LoadBabylonScriptAsync(glslangOptions.jsPath).then(() => {
        return self.glslang(Tools.GetBabylonScriptURL(glslangOptions.wasmPath));
      });
    }
    throw new Error("glslang is not available");
  }
  _initializeLimits() {
    const textureFormatsTier1 = this._deviceEnabledExtensions.indexOf(
      "texture-formats-tier1"
      /* WebGPUConstants.FeatureName.TextureFormatsTier1 */
    ) >= 0;
    this._caps = {
      maxTexturesImageUnits: this._deviceLimits.maxSampledTexturesPerShaderStage,
      maxVertexTextureImageUnits: this._deviceLimits.maxSampledTexturesPerShaderStage,
      maxCombinedTexturesImageUnits: this._deviceLimits.maxSampledTexturesPerShaderStage * 2,
      maxTextureSize: this._deviceLimits.maxTextureDimension2D,
      maxCubemapTextureSize: this._deviceLimits.maxTextureDimension2D,
      maxRenderTextureSize: this._deviceLimits.maxTextureDimension2D,
      maxVertexAttribs: this._deviceLimits.maxVertexAttributes,
      maxDrawBuffers: 8,
      maxVaryingVectors: this._deviceLimits.maxInterStageShaderVariables,
      maxFragmentUniformVectors: Math.floor(this._deviceLimits.maxUniformBufferBindingSize / 4),
      maxVertexUniformVectors: Math.floor(this._deviceLimits.maxUniformBufferBindingSize / 4),
      maxUniformBuffersPerShaderStage: this._deviceLimits.maxUniformBuffersPerShaderStage,
      shaderFloatPrecision: 23,
      // WGSL always uses IEEE-754 binary32 floats (which have 23 bits of significand)
      standardDerivatives: true,
      astc: this._deviceEnabledExtensions.indexOf(
        "texture-compression-astc"
        /* WebGPUConstants.FeatureName.TextureCompressionASTC */
      ) >= 0 ? true : void 0,
      s3tc: this._deviceEnabledExtensions.indexOf(
        "texture-compression-bc"
        /* WebGPUConstants.FeatureName.TextureCompressionBC */
      ) >= 0 ? true : void 0,
      pvrtc: null,
      etc1: null,
      etc2: this._deviceEnabledExtensions.indexOf(
        "texture-compression-etc2"
        /* WebGPUConstants.FeatureName.TextureCompressionETC2 */
      ) >= 0 ? true : void 0,
      bptc: this._deviceEnabledExtensions.indexOf(
        "texture-compression-bc"
        /* WebGPUConstants.FeatureName.TextureCompressionBC */
      ) >= 0 ? true : void 0,
      maxAnisotropy: 16,
      // Most implementations support maxAnisotropy values in range between 1 and 16, inclusive. The used value of maxAnisotropy will be clamped to the maximum value that the platform supports.
      uintIndices: true,
      fragmentDepthSupported: true,
      highPrecisionShaderSupported: true,
      colorBufferFloat: true,
      blendFloat: this._deviceEnabledExtensions.indexOf(
        "float32-blendable"
        /* WebGPUConstants.FeatureName.Float32Blendable */
      ) >= 0,
      supportFloatTexturesResolve: false,
      // See https://github.com/gpuweb/gpuweb/issues/3844
      rg11b10ufColorRenderable: this._deviceEnabledExtensions.indexOf(
        "rg11b10ufloat-renderable"
        /* WebGPUConstants.FeatureName.RG11B10UFloatRenderable */
      ) >= 0,
      textureFloat: true,
      textureFloatLinearFiltering: this._deviceEnabledExtensions.indexOf(
        "float32-filterable"
        /* WebGPUConstants.FeatureName.Float32Filterable */
      ) >= 0,
      textureFloatRender: true,
      textureHalfFloat: true,
      textureHalfFloatLinearFiltering: true,
      textureHalfFloatRender: true,
      textureLOD: true,
      texelFetch: true,
      drawBuffersExtension: true,
      depthTextureExtension: true,
      vertexArrayObject: false,
      instancedArrays: true,
      timerQuery: typeof BigUint64Array !== "undefined" && this._deviceEnabledExtensions.indexOf(
        "timestamp-query"
        /* WebGPUConstants.FeatureName.TimestampQuery */
      ) !== -1 ? true : void 0,
      supportOcclusionQuery: typeof BigUint64Array !== "undefined",
      canUseTimestampForTimerQuery: true,
      multiview: false,
      oculusMultiview: false,
      parallelShaderCompile: void 0,
      blendMinMax: true,
      maxMSAASamples: 4,
      // the spec only supports values of 1 and 4
      canUseGLInstanceID: true,
      canUseGLVertexID: true,
      supportComputeShaders: true,
      supportSRGBBuffers: true,
      supportTransformFeedbacks: false,
      textureMaxLevel: true,
      texture2DArrayMaxLayerCount: this._deviceLimits.maxTextureArrayLayers,
      disableMorphTargetTexture: false,
      textureNorm16: textureFormatsTier1,
      blendParametersPerTarget: true,
      dualSourceBlending: this._deviceEnabledExtensions.includes(
        "dual-source-blending"
        /* WebGPUConstants.FeatureName.DualSourceBlending */
      ),
      supportReadWriteStorageTextures: typeof navigator !== "undefined" && navigator.gpu?.wgslLanguageFeatures?.has("readonly_and_readwrite_storage_textures") === true
    };
    this._features = {
      forceBitmapOverHTMLImageElement: true,
      supportRenderAndCopyToLodForFloatTextures: true,
      supportDepthStencilTexture: true,
      supportShadowSamplers: true,
      uniformBufferHardCheckMatrix: false,
      allowTexturePrefiltering: true,
      trackUbosInFrame: true,
      checkUbosContentBeforeUpload: true,
      supportCSM: true,
      basisNeedsPOT: false,
      support3DTextures: true,
      needTypeSuffixInShaderConstants: true,
      supportMSAA: true,
      supportSSAO2: true,
      supportIBLShadows: true,
      supportExtendedTextureFormats: true,
      supportSwitchCaseInShader: true,
      supportSyncTextureRead: false,
      needsInvertingBitmap: false,
      useUBOBindingCache: false,
      needShaderCodeInlining: true,
      needToAlwaysBindUniformBuffers: true,
      supportRenderPasses: true,
      supportSpriteInstancing: true,
      forceVertexBufferStrideAndOffsetMultiple4Bytes: true,
      _checkNonFloatVertexBuffersDontRecreatePipelineContext: true
    };
    this._alphaState = new AlphaState(this._caps.blendParametersPerTarget);
  }
  _initializeContextAndSwapChain() {
    if (!this._renderingCanvas) {
      throw "The rendering canvas has not been set!";
    }
    this._context = this._renderingCanvas.getContext("webgpu");
    this._configureContext();
    this._colorFormat = this._options.swapChainFormat;
    this._mainRenderPassWrapper.colorAttachmentGPUTextures = [new WebGPUHardwareTexture(this)];
    this._mainRenderPassWrapper.colorAttachmentGPUTextures[0].format = this._colorFormat;
    this._setColorFormat(this._mainRenderPassWrapper);
  }
  // Set default values as WebGL with depth and stencil attachment for the broadest Compat.
  _initializeMainAttachments() {
    if (!this._bufferManager) {
      return;
    }
    this.flushFramebuffer();
    this._mainTextureExtends = {
      width: this.getRenderWidth(true),
      height: this.getRenderHeight(true),
      depthOrArrayLayers: 1
    };
    const bufferDataUpdate = new Float32Array([this.getRenderHeight(true)]);
    this._bufferManager.setSubData(this._ubInvertY, 4, bufferDataUpdate);
    this._bufferManager.setSubData(this._ubDontInvertY, 4, bufferDataUpdate);
    let mainColorAttachments;
    if (this._options.antialias) {
      const mainTextureDescriptor = {
        label: `Texture_MainColor_${this._mainTextureExtends.width}x${this._mainTextureExtends.height}_antialiasing`,
        size: this._mainTextureExtends,
        mipLevelCount: 1,
        sampleCount: this._mainPassSampleCount,
        dimension: "2d",
        format: this._options.swapChainFormat,
        usage: 16
      };
      if (this._mainTexture) {
        this._textureHelper.releaseTexture(this._mainTexture);
      }
      this._mainTexture = this._device.createTexture(mainTextureDescriptor);
      mainColorAttachments = [
        {
          view: this._mainTexture.createView({
            label: "TextureView_MainColor_antialiasing",
            dimension: "2d",
            format: this._options.swapChainFormat,
            mipLevelCount: 1,
            arrayLayerCount: 1
          }),
          clearValue: new Color4(0, 0, 0, 1),
          loadOp: "clear",
          storeOp: "store"
          // don't use StoreOp.Discard, else using several cameras with different viewports or using scissors will fail because we call beginRenderPass / endPass several times for the same color attachment!
        }
      ];
    } else {
      mainColorAttachments = [
        {
          view: void 0,
          clearValue: new Color4(0, 0, 0, 1),
          loadOp: "clear",
          storeOp: "store"
        }
      ];
    }
    this._mainRenderPassWrapper.depthTextureFormat = this.isStencilEnable ? "depth24plus-stencil8" : "depth32float";
    this._setDepthTextureFormat(this._mainRenderPassWrapper);
    this._setColorFormat(this._mainRenderPassWrapper);
    const depthTextureDescriptor = {
      label: `Texture_MainDepthStencil_${this._mainTextureExtends.width}x${this._mainTextureExtends.height}`,
      size: this._mainTextureExtends,
      mipLevelCount: 1,
      sampleCount: this._mainPassSampleCount,
      dimension: "2d",
      format: this._mainRenderPassWrapper.depthTextureFormat,
      usage: 16
    };
    if (this._depthTexture) {
      this._textureHelper.releaseTexture(this._depthTexture);
    }
    this._depthTexture = this._device.createTexture(depthTextureDescriptor);
    const mainDepthAttachment = {
      view: this._depthTexture.createView({
        label: `TextureView_MainDepthStencil_${this._mainTextureExtends.width}x${this._mainTextureExtends.height}`,
        dimension: "2d",
        format: this._depthTexture.format,
        mipLevelCount: 1,
        arrayLayerCount: 1
      }),
      depthClearValue: this._clearDepthValue,
      depthLoadOp: "clear",
      depthStoreOp: "store",
      stencilClearValue: this._clearStencilValue,
      stencilLoadOp: !this.isStencilEnable ? void 0 : "clear",
      stencilStoreOp: !this.isStencilEnable ? void 0 : "store"
    };
    const frameCounter = this._internalFrameCounter++;
    this._mainRenderPassWrapper.renderPassDescriptor = {
      label: `[${this.frameId}|${frameCounter}] - MainRenderPass`,
      colorAttachments: mainColorAttachments,
      depthStencilAttachment: mainDepthAttachment
    };
    this.beginFrame();
    this._startMainRenderPass(true, null, true, false);
    this._endCurrentRenderPass();
    this._frameId--;
    this.endFrame();
  }
  /**
   * Shared initialization across engines types.
   * @param canvas The canvas associated with this instance of the engine.
   */
  _sharedInit(canvas) {
    super._sharedInit(canvas);
    _CommonInit(this, canvas, this._creationOptions);
  }
  _configureContext() {
    this._context.configure({
      device: this._device,
      format: this._options.swapChainFormat,
      usage: 16 | 1,
      alphaMode: this.premultipliedAlpha ? "premultiplied" : "opaque",
      toneMapping: this._options.canvasToneMapping,
      colorSpace: this._options.canvasColorSpace
    });
  }
  /**
   * Resize an image and returns the image data as an uint8array
   * @param image image to resize
   * @param bufferWidth destination buffer width
   * @param bufferHeight destination buffer height
   * @returns an uint8array containing RGBA values of bufferWidth * bufferHeight size
   */
  resizeImageBitmap(image, bufferWidth, bufferHeight) {
    return ResizeImageBitmap(this, image, bufferWidth, bufferHeight);
  }
  /**
   * Engine abstraction for loading and creating an image bitmap from a given source string.
   * @param imageSource source to load the image from.
   * @param options An object that sets options for the image's extraction.
   * @returns ImageBitmap
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  async _createImageBitmapFromSource(imageSource, options) {
    return await CreateImageBitmapFromSource(this, imageSource, options);
  }
  /**
   * Toggle full screen mode
   * @param requestPointerLock defines if a pointer lock should be requested from the user
   */
  switchFullscreen(requestPointerLock) {
    if (this.isFullscreen) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen(requestPointerLock);
    }
  }
  /**
   * Enters full screen mode
   * @param requestPointerLock defines if a pointer lock should be requested from the user
   */
  enterFullscreen(requestPointerLock) {
    if (!this.isFullscreen) {
      this._pointerLockRequested = requestPointerLock;
      if (this._renderingCanvas) {
        RequestFullscreen(this._renderingCanvas);
      }
    }
  }
  /**
   * Exits full screen mode
   */
  exitFullscreen() {
    if (this.isFullscreen) {
      ExitFullscreen();
    }
  }
  /**
   * Enters Pointerlock mode
   */
  enterPointerlock() {
    if (this._renderingCanvas) {
      RequestPointerlock(this._renderingCanvas);
    }
  }
  /**
   * Exits Pointerlock mode
   */
  exitPointerlock() {
    ExitPointerlock();
  }
  _rebuildBuffers() {
    super._rebuildBuffers();
    for (const storageBuffer of this._storageBuffers) {
      if (storageBuffer.getBuffer().engineId !== this.uniqueId) {
        storageBuffer._rebuild();
      }
    }
  }
  _restoreEngineAfterContextLost(initEngine) {
    WebGPUCacheRenderPipelineTree.ResetCache();
    WebGPUCacheBindGroups.ResetCache();
    const cleanScenes = (scenes) => {
      for (const scene of scenes) {
        for (const mesh of scene.meshes) {
          const subMeshes = mesh.subMeshes;
          if (!subMeshes) {
            continue;
          }
          for (const subMesh of subMeshes) {
            subMesh._drawWrappers = [];
          }
        }
        for (const material of scene.materials) {
          material._materialContext?.reset();
        }
      }
    };
    cleanScenes(this.scenes);
    cleanScenes(this._virtualScenes);
    const uboList = [];
    for (const uniformBuffer of this._uniformBuffers) {
      if (uniformBuffer.name.indexOf("leftOver") < 0) {
        uboList.push(uniformBuffer);
      }
    }
    this._uniformBuffers = uboList;
    super._restoreEngineAfterContextLost(initEngine);
  }
  /**
   * Force a specific size of the canvas
   * @param width defines the new canvas' width
   * @param height defines the new canvas' height
   * @param forceSetSize true to force setting the sizes of the underlying canvas
   * @returns true if the size was changed
   */
  setSize(width, height, forceSetSize = false) {
    if (!super.setSize(width, height, forceSetSize)) {
      return false;
    }
    this._initializeMainAttachments();
    if (this.snapshotRendering) {
      this.snapshotRenderingReset();
    }
    return true;
  }
  /**
   * @internal
   */
  _getShaderProcessor(shaderLanguage) {
    if (shaderLanguage === 1) {
      return this._shaderProcessorWGSL;
    }
    return this._shaderProcessor;
  }
  /**
   * @internal
   */
  _getShaderProcessingContext(shaderLanguage, pureMode) {
    return new WebGPUShaderProcessingContext(shaderLanguage, pureMode);
  }
  /** @internal */
  _getCurrentRenderPass() {
    let depthFunction;
    if (this.compatibilityMode && this._currentRenderPass && !this._occlusionQueryActive && !this._snapshotRendering.play && this._occlusionQuery?.hasQueries && this._getCurrentRenderPassWrapper().renderPassDescriptor?.occlusionQuerySet !== this._occlusionQuery.querySet) {
      depthFunction = this._depthCullingState.depthFunc;
      this._snapshotRendering.handleRenderPassRestart();
      this._endCurrentRenderPass();
    }
    if (this._currentRenderTarget && !this._currentRenderPass) {
      this._startRenderTargetRenderPass(this._currentRenderTarget, false, null, false, false);
    } else if (!this._currentRenderPass) {
      this._startMainRenderPass(false);
    }
    if (depthFunction !== void 0) {
      this._depthCullingState.depthFunc = depthFunction;
    }
    return this._currentRenderPass;
  }
  /** @internal */
  _getCurrentRenderPassWrapper() {
    return this._currentRenderTarget ? this._rttRenderPassWrapper : this._mainRenderPassWrapper;
  }
  //------------------------------------------------------------------------------
  //                          Static Pipeline WebGPU States
  //------------------------------------------------------------------------------
  /** @internal */
  applyStates() {
    this._stencilStateComposer.apply();
    this._cacheRenderPipeline.setAlphaBlendEnabled(this._alphaState._alphaBlend, this._alphaState._numTargetEnabled);
  }
  /**
   * Force the entire cache to be cleared
   * You should not have to use this function unless your engine needs to share the WebGPU context with another engine
   * @param bruteForce defines a boolean to force clearing ALL caches (including stencil, detoh and alpha states)
   */
  wipeCaches(bruteForce) {
    if (this.preventCacheWipeBetweenFrames && !bruteForce) {
      return;
    }
    this._forceEnableEffect = true;
    this._currentIndexBuffer = null;
    this._currentOverrideVertexBuffers = null;
    this._cacheRenderPipeline.setBuffers(null, null, null);
    if (bruteForce) {
      this._stencilStateComposer.reset();
      this._depthCullingState.reset();
      this._depthCullingState.depthFunc = 515;
      this._alphaState.reset();
      this._resetAlphaMode();
      this._cacheRenderPipeline.setAlphaBlendFactors(this._alphaState._blendFunctionParameters, this._alphaState._blendEquationParameters);
      this._cacheRenderPipeline.setAlphaBlendEnabled(this._alphaState._alphaBlend, this._alphaState._numTargetEnabled);
      this.setColorWrite(true);
    }
    this._cachedVertexBuffers = null;
    this._cachedIndexBuffer = null;
    this._cachedEffectForVertexBuffers = null;
  }
  /**
   * Enable or disable color writing
   * @param enable defines the state to set
   */
  setColorWrite(enable) {
    this._colorWriteLocal = enable;
    this._cacheRenderPipeline.setWriteMask(enable ? 15 : 0);
  }
  /**
   * Gets a boolean indicating if color writing is enabled
   * @returns the current color writing state
   */
  getColorWrite() {
    return this._colorWriteLocal;
  }
  _mustUpdateViewport() {
    const x = this._viewportCached.x, y = this._viewportCached.y, w = this._viewportCached.z, h = this._viewportCached.w;
    const update = this._viewportsCurrent.x !== x || this._viewportsCurrent.y !== y || this._viewportsCurrent.w !== w || this._viewportsCurrent.h !== h;
    if (update) {
      this._viewportsCurrent.x = this._viewportCached.x;
      this._viewportsCurrent.y = this._viewportCached.y;
      this._viewportsCurrent.w = this._viewportCached.z;
      this._viewportsCurrent.h = this._viewportCached.w;
    }
    return update;
  }
  _applyViewport(bundleList) {
    const x = Math.floor(this._viewportCached.x);
    const w = Math.floor(this._viewportCached.z);
    const h = Math.floor(this._viewportCached.w);
    let y = Math.floor(this._viewportCached.y);
    if (!this._currentRenderTarget) {
      y = this.getRenderHeight(true) - y - h;
    }
    if (bundleList) {
      bundleList.addItem(new WebGPURenderItemViewport(x, y, w, h));
    } else {
      this._getCurrentRenderPass().setViewport(x, y, w, h, 0, 1);
    }
  }
  /**
   * @internal
   */
  _viewport(x, y, width, height) {
    this._viewportCached.x = x;
    this._viewportCached.y = y;
    this._viewportCached.z = width;
    this._viewportCached.w = height;
  }
  _mustUpdateScissor() {
    const x = this._scissorCached.x, y = this._scissorCached.y, w = this._scissorCached.z, h = this._scissorCached.w;
    const update = this._scissorsCurrent.x !== x || this._scissorsCurrent.y !== y || this._scissorsCurrent.w !== w || this._scissorsCurrent.h !== h;
    if (update) {
      this._scissorsCurrent.x = this._scissorCached.x;
      this._scissorsCurrent.y = this._scissorCached.y;
      this._scissorsCurrent.w = this._scissorCached.z;
      this._scissorsCurrent.h = this._scissorCached.w;
    }
    return update;
  }
  _applyScissor(bundleList) {
    const y = this._currentRenderTarget ? this._scissorCached.y : this.getRenderHeight() - this._scissorCached.w - this._scissorCached.y;
    if (bundleList) {
      bundleList.addItem(new WebGPURenderItemScissor(this._scissorCached.x, y, this._scissorCached.z, this._scissorCached.w));
    } else {
      this._getCurrentRenderPass().setScissorRect(this._scissorCached.x, y, this._scissorCached.z, this._scissorCached.w);
    }
  }
  _scissorIsActive() {
    return this._scissorCached.x !== 0 || this._scissorCached.y !== 0 || this._scissorCached.z !== 0 || this._scissorCached.w !== 0;
  }
  /**
   * Enable scissor test on a specific rectangle
   * @param x defines left coordinate of the rectangle
   * @param y defines top coordinate of the rectangle
   * @param width defines width of the rectangle
   * @param height defines height of the rectangle
   */
  enableScissor(x, y, width, height) {
    this._scissorCached.x = x;
    this._scissorCached.y = y;
    this._scissorCached.z = width;
    this._scissorCached.w = height;
  }
  /**
   * Disable previously set scissor test rectangle
   */
  disableScissor() {
    this._scissorCached.x = this._scissorCached.y = this._scissorCached.z = this._scissorCached.w = 0;
    this._scissorsCurrent.x = this._scissorsCurrent.y = this._scissorsCurrent.w = this._scissorsCurrent.h = 0;
  }
  _mustUpdateStencilRef() {
    const update = this._stencilStateComposer.funcRef !== this._stencilRefsCurrent;
    if (update) {
      this._stencilRefsCurrent = this._stencilStateComposer.funcRef;
    }
    return update;
  }
  _applyStencilRef(bundleList) {
    if (bundleList) {
      bundleList.addItem(new WebGPURenderItemStencilRef(this._stencilStateComposer.funcRef ?? 0));
    } else {
      this._getCurrentRenderPass().setStencilReference(this._stencilStateComposer.funcRef ?? 0);
    }
  }
  _mustUpdateBlendColor() {
    const colorBlend = this._alphaState._blendConstants;
    const update = colorBlend[0] !== this._blendColorsCurrent[0] || colorBlend[1] !== this._blendColorsCurrent[1] || colorBlend[2] !== this._blendColorsCurrent[2] || colorBlend[3] !== this._blendColorsCurrent[3];
    if (update) {
      this._blendColorsCurrent[0] = colorBlend[0];
      this._blendColorsCurrent[1] = colorBlend[1];
      this._blendColorsCurrent[2] = colorBlend[2];
      this._blendColorsCurrent[3] = colorBlend[3];
    }
    return update;
  }
  _applyBlendColor(bundleList) {
    if (bundleList) {
      bundleList.addItem(new WebGPURenderItemBlendColor(this._alphaState._blendConstants.slice()));
    } else {
      this._getCurrentRenderPass().setBlendConstant(this._alphaState._blendConstants);
    }
  }
  _resetRenderPassStates() {
    this._viewportsCurrent.x = this._viewportsCurrent.y = this._viewportsCurrent.w = this._viewportsCurrent.h = 0;
    this._scissorsCurrent.x = this._scissorsCurrent.y = this._scissorsCurrent.w = this._scissorsCurrent.h = 0;
    this._stencilRefsCurrent = -1;
    this._blendColorsCurrent[0] = this._blendColorsCurrent[1] = this._blendColorsCurrent[2] = this._blendColorsCurrent[3] = null;
  }
  /**
   * Clear the current render buffer or the current render target (if any is set up)
   * @param color defines the color to use
   * @param backBuffer defines if the back buffer must be cleared
   * @param depth defines if the depth buffer must be cleared
   * @param stencil defines if the stencil buffer must be cleared
   * @param stencilClearValue defines the value to use to clear the stencil buffer (default is 0)
   */
  clear(color, backBuffer, depth, stencil = false, stencilClearValue = 0) {
    if (color && color.a === void 0) {
      color.a = 1;
    }
    if (stencil) {
      this._clearStencilValue = stencilClearValue;
    }
    const hasScissor = this._scissorIsActive();
    if (backBuffer && color && hasScissor && this._currentRenderTarget) {
      const textures = this._currentRenderTarget.textures;
      const attachments = this._mrtAttachments;
      if (textures) {
        for (let index = 0; index < textures.length; index++) {
          if ((!attachments || attachments[index] !== 0) && IsIntegerTextureFormat(textures[index].format)) {
            throw new Error("WebGPUEngine.clear: scissored clears of integer color attachments are not supported");
          }
        }
      }
    }
    if (this._currentRenderTarget) {
      if (hasScissor) {
        if (!this._currentRenderPass) {
          this._startRenderTargetRenderPass(this._currentRenderTarget, false, backBuffer ? color : null, depth, stencil);
        }
        this._applyScissor(!this.compatibilityMode ? this._bundleList : null);
        this._clearFullQuad(backBuffer ? color : null, depth, stencil);
      } else {
        if (this._currentRenderPass) {
          this._endCurrentRenderPass();
        }
        this._startRenderTargetRenderPass(this._currentRenderTarget, true, backBuffer ? color : null, depth, stencil);
      }
    } else {
      if (!this._currentRenderPass || !hasScissor) {
        this._startMainRenderPass(!hasScissor, backBuffer ? color : null, depth, stencil);
      }
      if (hasScissor) {
        this._applyScissor(!this.compatibilityMode ? this._bundleList : null);
        this._clearFullQuad(backBuffer ? color : null, depth, stencil);
      }
    }
  }
  _clearFullQuad(clearColor, clearDepth, clearStencil) {
    const renderPass = !this.compatibilityMode ? null : this._getCurrentRenderPass();
    this._clearQuad.setColorFormat(this._colorFormat);
    this._clearQuad.setDepthStencilFormat(this._depthTextureFormat);
    this._clearQuad.setMRTAttachments(this._cacheRenderPipeline.mrtAttachments ?? [], this._cacheRenderPipeline.mrtTextureArray ?? [], this._cacheRenderPipeline.mrtTextureCount);
    if (!this.compatibilityMode) {
      this._bundleList.addItem(new WebGPURenderItemStencilRef(this._clearStencilValue));
    } else {
      renderPass.setStencilReference(this._clearStencilValue);
    }
    const bundle = this._clearQuad.clear(renderPass, clearColor, clearDepth, clearStencil, this.currentSampleCount);
    if (!this.compatibilityMode) {
      this._bundleList.addBundle(bundle);
      this._applyStencilRef(this._bundleList);
      this._reportDrawCall();
    } else {
      this._applyStencilRef(null);
    }
  }
  //------------------------------------------------------------------------------
  //                              Vertex/Index/Storage Buffers
  //------------------------------------------------------------------------------
  /**
   * Creates a vertex buffer
   * @param data the data or the size for the vertex buffer
   * @param _updatable whether the buffer should be created as updatable
   * @param label defines the label of the buffer (for debug purpose)
   * @returns the new buffer
   */
  createVertexBuffer(data, _updatable, label) {
    let view;
    if (data instanceof Array) {
      view = new Float32Array(data);
    } else if (ArrayBuffer.isView(data)) {
      view = data;
    } else {
      view = new Uint8Array(data);
    }
    const dataBuffer = this._bufferManager.createBuffer(view, BufferUsage.Vertex | BufferUsage.CopyDst | BufferUsage.Storage, label);
    return dataBuffer;
  }
  /**
   * Creates a vertex buffer
   * @param data the data for the dynamic vertex buffer
   * @param label defines the label of the buffer (for debug purpose)
   * @returns the new buffer
   */
  createDynamicVertexBuffer(data, label) {
    return this.createVertexBuffer(data, void 0, label);
  }
  /**
   * Creates a new index buffer
   * @param indices defines the content of the index buffer
   * @param _updatable defines if the index buffer must be updatable
   * @param label defines the label of the buffer (for debug purpose)
   * @returns a new buffer
   */
  createIndexBuffer(indices, _updatable, label) {
    let is32Bits = true;
    let view;
    if (indices instanceof Uint32Array || indices instanceof Int32Array) {
      view = indices;
    } else if (indices instanceof Uint16Array) {
      view = indices;
      is32Bits = false;
    } else {
      for (let index = 0; index < indices.length; index++) {
        if (indices[index] > 65535) {
          view = new Uint32Array(indices);
          break;
        }
      }
      if (!view) {
        view = new Uint16Array(indices);
        is32Bits = false;
      }
    }
    const dataBuffer = this._bufferManager.createBuffer(view, BufferUsage.Index | BufferUsage.CopyDst | BufferUsage.Storage, label);
    dataBuffer.is32Bits = is32Bits;
    return dataBuffer;
  }
  /**
   * Update a dynamic index buffer
   * @param indexBuffer defines the target index buffer
   * @param indices defines the data to update
   * @param offset defines the offset in the target index buffer where update should start
   */
  updateDynamicIndexBuffer(indexBuffer, indices, offset = 0) {
    const gpuBuffer = indexBuffer;
    let view;
    if (indexBuffer.is32Bits) {
      view = indices instanceof Uint32Array ? indices : new Uint32Array(indices);
    } else {
      view = indices instanceof Uint16Array ? indices : new Uint16Array(indices);
    }
    this._bufferManager.setSubData(gpuBuffer, offset, view);
  }
  /**
   * Updates a dynamic vertex buffer.
   * @param vertexBuffer the vertex buffer to update
   * @param data the data used to update the vertex buffer
   * @param byteOffset the byte offset of the data
   * @param byteLength the byte length of the data
   */
  updateDynamicVertexBuffer(vertexBuffer, data, byteOffset, byteLength) {
    const dataBuffer = vertexBuffer;
    if (byteOffset === void 0) {
      byteOffset = 0;
    }
    let view;
    if (byteLength === void 0) {
      if (data instanceof Array) {
        view = new Float32Array(data);
      } else if (ArrayBuffer.isView(data)) {
        view = data;
      } else {
        view = new Uint8Array(data);
      }
      byteLength = view.byteLength;
    } else {
      if (data instanceof Array) {
        view = new Float32Array(data);
      } else if (ArrayBuffer.isView(data)) {
        view = data;
      } else {
        view = new Uint8Array(data);
      }
    }
    this._bufferManager.setSubData(dataBuffer, byteOffset, view, 0, byteLength);
  }
  /**
   * @internal
   */
  _createBuffer(data, creationFlags, label) {
    let view;
    if (data instanceof Array) {
      view = new Float32Array(data);
    } else if (ArrayBuffer.isView(data)) {
      view = data;
    } else {
      view = new Uint8Array(data);
    }
    let flags = 0;
    if (creationFlags & 1) {
      flags |= BufferUsage.CopySrc;
    }
    if (creationFlags & 2) {
      flags |= BufferUsage.CopyDst;
    }
    if (creationFlags & 4) {
      flags |= BufferUsage.Uniform;
    }
    if (creationFlags & 8) {
      flags |= BufferUsage.Vertex;
    }
    if (creationFlags & 16) {
      flags |= BufferUsage.Index;
    }
    if (creationFlags & 32) {
      flags |= BufferUsage.Storage;
    }
    if (creationFlags & 64) {
      flags |= BufferUsage.Indirect;
    }
    return this._bufferManager.createBuffer(view, flags, label);
  }
  /**
   * @internal
   */
  bindBuffersDirectly() {
    throw "Not implemented on WebGPU";
  }
  /**
   * @internal
   */
  updateAndBindInstancesBuffer() {
    throw "Not implemented on WebGPU";
  }
  /**
   * Unbind all instance attributes
   */
  unbindInstanceAttributes() {
  }
  /**
   * Bind a list of vertex buffers with the engine
   * @param vertexBuffers defines the list of vertex buffers to bind
   * @param indexBuffer defines the index buffer to bind
   * @param _effect defines the effect associated with the vertex buffers
   * @param overrideVertexBuffers defines optional list of avertex buffers that overrides the entries in vertexBuffers
   */
  bindBuffers(vertexBuffers, indexBuffer, _effect, overrideVertexBuffers) {
    this._currentVertexBuffers = vertexBuffers;
    this._currentIndexBuffer = indexBuffer;
    this._currentOverrideVertexBuffers = overrideVertexBuffers ?? null;
    this._cacheRenderPipeline.setBuffers(this._currentVertexBuffers, this._currentIndexBuffer, this._currentOverrideVertexBuffers);
  }
  /**
   * @internal
   */
  _releaseBuffer(buffer) {
    return this._bufferManager.releaseBuffer(buffer);
  }
  //------------------------------------------------------------------------------
  //                              Uniform Buffers
  //------------------------------------------------------------------------------
  /**
   * Create an uniform buffer
   * @see https://doc.babylonjs.com/setup/support/webGL2#uniform-buffer-objets
   * @param elements defines the content of the uniform buffer
   * @param label defines a name for the buffer (for debugging purpose)
   * @returns the webGL uniform buffer
   */
  createUniformBuffer(elements, label) {
    let view;
    if (elements instanceof Array) {
      view = new Float32Array(elements);
    } else {
      view = elements;
    }
    const dataBuffer = this._bufferManager.createBuffer(view, BufferUsage.Uniform | BufferUsage.CopyDst, label);
    return dataBuffer;
  }
  /**
   * Create a dynamic uniform buffer (no different from a non dynamic uniform buffer in WebGPU)
   * @see https://doc.babylonjs.com/setup/support/webGL2#uniform-buffer-objets
   * @param elements defines the content of the uniform buffer
   * @param label defines a name for the buffer (for debugging purpose)
   * @returns the webGL uniform buffer
   */
  createDynamicUniformBuffer(elements, label) {
    return this.createUniformBuffer(elements, label);
  }
  /**
   * Update an existing uniform buffer
   * @see https://doc.babylonjs.com/setup/support/webGL2#uniform-buffer-objets
   * @param uniformBuffer defines the target uniform buffer
   * @param elements defines the content to update
   * @param offset defines the offset in the uniform buffer where update should start
   * @param count defines the size of the data to update
   */
  updateUniformBuffer(uniformBuffer, elements, offset, count) {
    if (offset === void 0) {
      offset = 0;
    }
    const dataBuffer = uniformBuffer;
    let view;
    if (count === void 0) {
      if (elements instanceof Float32Array) {
        view = elements;
      } else {
        view = new Float32Array(elements);
      }
      count = view.byteLength;
    } else {
      if (elements instanceof Float32Array) {
        view = elements;
      } else {
        view = new Float32Array(elements);
      }
    }
    this._bufferManager.setSubData(dataBuffer, offset, view, 0, count);
  }
  /**
   * Bind a buffer to the current draw context
   * @param buffer defines the buffer to bind
   * @param _location not used in WebGPU
   * @param name Name of the uniform variable to bind
   */
  bindUniformBufferBase(buffer, _location, name2) {
    this._currentDrawContext.setBuffer(name2, buffer);
  }
  /**
   * Unused in WebGPU
   */
  bindUniformBlock() {
  }
  //------------------------------------------------------------------------------
  //                              Effects
  //------------------------------------------------------------------------------
  /**
   * Create a new effect (used to store vertex/fragment shaders)
   * @param baseName defines the base name of the effect (The name of file without .fragment.fx or .vertex.fx)
   * @param attributesNamesOrOptions defines either a list of attribute names or an IEffectCreationOptions object
   * @param uniformsNamesOrEngine defines either a list of uniform names or the engine to use
   * @param samplers defines an array of string used to represent textures
   * @param defines defines the string containing the defines to use to compile the shaders
   * @param fallbacks defines the list of potential fallbacks to use if shader compilation fails
   * @param onCompiled defines a function to call when the effect creation is successful
   * @param onError defines a function to call when the effect creation has failed
   * @param indexParameters defines an object containing the index values to use to compile shaders (like the maximum number of simultaneous lights)
   * @param shaderLanguage the language the shader is written in (default: GLSL)
   * @param extraInitializationsAsync additional async code to run before preparing the effect
   * @returns the new Effect
   */
  createEffect(baseName, attributesNamesOrOptions, uniformsNamesOrEngine, samplers, defines, fallbacks, onCompiled, onError, indexParameters, shaderLanguage = 0, extraInitializationsAsync) {
    const vertex = typeof baseName === "string" ? baseName : baseName.vertexToken || baseName.vertexSource || baseName.vertexElement || baseName.vertex;
    const fragment = typeof baseName === "string" ? baseName : baseName.fragmentToken || baseName.fragmentSource || baseName.fragmentElement || baseName.fragment;
    const globalDefines = this._getGlobalDefines();
    const isOptions = attributesNamesOrOptions.attributes !== void 0;
    let fullDefines = defines ?? attributesNamesOrOptions.defines ?? "";
    if (globalDefines) {
      fullDefines += "\n" + globalDefines;
    }
    const name2 = vertex + "+" + fragment + "@" + fullDefines;
    if (this._compiledEffects[name2]) {
      const compiledEffect = this._compiledEffects[name2];
      if (onCompiled && compiledEffect.isReady()) {
        onCompiled(compiledEffect);
      }
      compiledEffect._refCount++;
      return compiledEffect;
    }
    const effect = new Effect(baseName, attributesNamesOrOptions, isOptions ? this : uniformsNamesOrEngine, samplers, this, defines, fallbacks, onCompiled, onError, indexParameters, name2, attributesNamesOrOptions.shaderLanguage ?? shaderLanguage, attributesNamesOrOptions.extraInitializationsAsync ?? extraInitializationsAsync);
    this._compiledEffects[name2] = effect;
    return effect;
  }
  _compileRawShaderToSpirV(source, type) {
    return this._glslang.compileGLSL(source, type);
  }
  _compileShaderToSpirV(source, type, defines, shaderVersion) {
    return this._compileRawShaderToSpirV(shaderVersion + (defines ? defines + "\n" : "") + source, type);
  }
  _getWGSLShader(source, type, defines) {
    if (defines) {
      defines = "//" + defines.split("\n").join("\n//") + "\n";
    } else {
      defines = "";
    }
    return defines + source;
  }
  _createPipelineStageDescriptor(vertexShader, fragmentShader, shaderLanguage, disableUniformityAnalysisInVertex, disableUniformityAnalysisInFragment) {
    if (this._tintWASM && shaderLanguage === 0) {
      vertexShader = this._tintWASM.convertSpirV2WGSL(vertexShader, disableUniformityAnalysisInVertex);
      fragmentShader = this._tintWASM.convertSpirV2WGSL(fragmentShader, disableUniformityAnalysisInFragment);
    }
    return {
      vertexStage: {
        module: this._device.createShaderModule({
          label: "vertex",
          code: vertexShader
        }),
        entryPoint: "main"
      },
      fragmentStage: {
        module: this._device.createShaderModule({
          label: "fragment",
          code: fragmentShader
        }),
        entryPoint: "main"
      }
    };
  }
  _compileRawPipelineStageDescriptor(vertexCode, fragmentCode, shaderLanguage) {
    const disableUniformityAnalysisInVertex = vertexCode.indexOf(`#define DISABLE_UNIFORMITY_ANALYSIS`) >= 0;
    const disableUniformityAnalysisInFragment = fragmentCode.indexOf(`#define DISABLE_UNIFORMITY_ANALYSIS`) >= 0;
    const vertexShader = shaderLanguage === 0 ? this._compileRawShaderToSpirV(vertexCode, "vertex") : vertexCode;
    const fragmentShader = shaderLanguage === 0 ? this._compileRawShaderToSpirV(fragmentCode, "fragment") : fragmentCode;
    return this._createPipelineStageDescriptor(vertexShader, fragmentShader, shaderLanguage, disableUniformityAnalysisInVertex, disableUniformityAnalysisInFragment);
  }
  _compilePipelineStageDescriptor(vertexCode, fragmentCode, defines, shaderLanguage) {
    this.onBeforeShaderCompilationObservable.notifyObservers(this);
    const disableUniformityAnalysisInVertex = vertexCode.indexOf(`#define DISABLE_UNIFORMITY_ANALYSIS`) >= 0;
    const disableUniformityAnalysisInFragment = fragmentCode.indexOf(`#define DISABLE_UNIFORMITY_ANALYSIS`) >= 0;
    const shaderVersion = "#version 450\n";
    const vertexShader = shaderLanguage === 0 ? this._compileShaderToSpirV(vertexCode, "vertex", defines, shaderVersion) : this._getWGSLShader(vertexCode, "vertex", defines);
    const fragmentShader = shaderLanguage === 0 ? this._compileShaderToSpirV(fragmentCode, "fragment", defines, shaderVersion) : this._getWGSLShader(fragmentCode, "fragment", defines);
    const program = this._createPipelineStageDescriptor(vertexShader, fragmentShader, shaderLanguage, disableUniformityAnalysisInVertex, disableUniformityAnalysisInFragment);
    this.onAfterShaderCompilationObservable.notifyObservers(this);
    return program;
  }
  /**
   * @internal
   */
  createRawShaderProgram() {
    throw "Not available on WebGPU";
  }
  /**
   * @internal
   */
  createShaderProgram() {
    throw "Not available on WebGPU";
  }
  /**
   * Inline functions in shader code that are marked to be inlined
   * @param code code to inline
   * @returns inlined code
   */
  inlineShaderCode(code) {
    const sci = new ShaderCodeInliner(code);
    sci.debug = false;
    sci.processCode();
    return sci.code;
  }
  /**
   * Creates a new pipeline context
   * @param shaderProcessingContext defines the shader processing context used during the processing if available
   * @returns the new pipeline
   */
  createPipelineContext(shaderProcessingContext) {
    return new WebGPUPipelineContext(shaderProcessingContext, this);
  }
  /**
   * Creates a new material context
   * @returns the new context
   */
  createMaterialContext() {
    return new WebGPUMaterialContext();
  }
  /**
   * Creates a new draw context
   * @returns the new context
   */
  createDrawContext() {
    return new WebGPUDrawContext(this._bufferManager, this._dummyIndexBuffer);
  }
  /**
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async _preparePipelineContextAsync(pipelineContext, vertexSourceCode, fragmentSourceCode, createAsRaw, rawVertexSourceCode, rawFragmentSourceCode, _rebuildRebind, defines, _transformFeedbackVaryings, _key, onReady) {
    const webGpuContext = pipelineContext;
    const shaderLanguage = webGpuContext.shaderProcessingContext.shaderLanguage;
    if (shaderLanguage === 0 && !this._glslangAndTintAreFullyLoaded) {
      await this.prepareGlslangAndTintAsync();
    }
    if (this.dbgShowShaderCode) {
      Logger.Log(["defines", defines]);
      Logger.Log(vertexSourceCode);
      Logger.Log(fragmentSourceCode);
      Logger.Log("***********************************************");
    }
    webGpuContext.sources = {
      fragment: fragmentSourceCode,
      vertex: vertexSourceCode,
      rawVertex: rawVertexSourceCode,
      rawFragment: rawFragmentSourceCode
    };
    if (createAsRaw) {
      webGpuContext.stages = this._compileRawPipelineStageDescriptor(vertexSourceCode, fragmentSourceCode, shaderLanguage);
    } else {
      webGpuContext.stages = this._compilePipelineStageDescriptor(vertexSourceCode, fragmentSourceCode, defines, shaderLanguage);
    }
    onReady();
  }
  /**
   * Gets the list of active attributes for a given WebGPU program
   * @param pipelineContext defines the pipeline context to use
   * @param attributesNames defines the list of attribute names to get
   * @returns an array of indices indicating the offset of each attribute
   */
  getAttributes(pipelineContext, attributesNames) {
    const results = new Array(attributesNames.length);
    const gpuPipelineContext = pipelineContext;
    for (let i = 0; i < attributesNames.length; i++) {
      const attributeName = attributesNames[i];
      const attributeLocation = gpuPipelineContext.shaderProcessingContext.availableAttributes[attributeName];
      if (attributeLocation === void 0) {
        continue;
      }
      results[i] = attributeLocation;
    }
    return results;
  }
  /**
   * Activates an effect, making it the current one (ie. the one used for rendering)
   * @param effect defines the effect to activate
   */
  enableEffect(effect) {
    if (!effect) {
      return;
    }
    if (!IsWrapper(effect)) {
      this._currentEffect = effect;
      this._currentMaterialContext = this._defaultMaterialContext;
      this._currentDrawContext = this._defaultDrawContext;
      this._counters.numEnableEffects++;
      if (this.dbgLogIfNotDrawWrapper) {
        Logger.Warn(`enableEffect has been called with an Effect and not a Wrapper! effect.uniqueId=${effect.uniqueId}, effect.name=${effect.name}, effect.name.vertex=${typeof effect.name === "string" ? "" : effect.name.vertex}, effect.name.fragment=${typeof effect.name === "string" ? "" : effect.name.fragment}`, 10);
      }
    } else if (!effect.effect || effect.effect === this._currentEffect && effect.materialContext === this._currentMaterialContext && effect.drawContext === this._currentDrawContext && !this._forceEnableEffect) {
      if (!effect.effect && this.dbgShowEmptyEnableEffectCalls) {
        Logger.Log(["drawWrapper=", effect]);
        throw "Invalid call to enableEffect: the effect property is empty!";
      }
      return;
    } else {
      this._currentEffect = effect.effect;
      this._currentMaterialContext = effect.materialContext;
      this._currentDrawContext = effect.drawContext;
      this._counters.numEnableDrawWrapper++;
      if (!this._currentMaterialContext) {
        Logger.Log(["drawWrapper=", effect]);
        throw `Invalid call to enableEffect: the materialContext property is empty!`;
      }
    }
    this._stencilStateComposer.stencilMaterial = void 0;
    this._forceEnableEffect = false;
    if (this._currentEffect.onBind) {
      this._currentEffect.onBind(this._currentEffect);
    }
    if (this._currentEffect._onBindObservable) {
      this._currentEffect._onBindObservable.notifyObservers(this._currentEffect);
    }
  }
  /**
   * @internal
   */
  _releaseEffect(effect) {
    if (this._compiledEffects[effect._key]) {
      delete this._compiledEffects[effect._key];
      this._deletePipelineContext(effect.getPipelineContext());
    }
  }
  /**
   * Force the engine to release all cached effects. This means that next effect compilation will have to be done completely even if a similar effect was already compiled
   */
  releaseEffects() {
    for (const name2 in this._compiledEffects) {
      const webGPUPipelineContext = this._compiledEffects[name2].getPipelineContext();
      this._deletePipelineContext(webGPUPipelineContext);
    }
    this._compiledEffects = {};
    this.onReleaseEffectsObservable.notifyObservers(this);
  }
  _deletePipelineContext(pipelineContext) {
    const webgpuPipelineContext = pipelineContext;
    if (webgpuPipelineContext) {
      resetCachedPipeline(webgpuPipelineContext);
    }
  }
  //------------------------------------------------------------------------------
  //                              Textures
  //------------------------------------------------------------------------------
  /**
   * Gets a boolean indicating that only power of 2 textures are supported
   * Please note that you can still use non power of 2 textures but in this case the engine will forcefully convert them
   */
  get needPOTTextures() {
    return false;
  }
  /** @internal */
  _createHardwareTexture() {
    return new WebGPUHardwareTexture(this);
  }
  /**
   * @internal
   */
  _releaseTexture(texture) {
    const index = this._internalTexturesCache.indexOf(texture);
    if (index !== -1) {
      this._internalTexturesCache.splice(index, 1);
    }
    this._textureHelper.releaseTexture(texture);
  }
  /**
   * @internal
   */
  _getRGBABufferInternalSizedFormat() {
    return 5;
  }
  /**
   * Update the comparison function of a texture
   * @param texture defines the texture to update
   * @param comparisonFunction defines the comparison function to set
   */
  updateTextureComparisonFunction(texture, comparisonFunction) {
    texture._comparisonFunction = comparisonFunction;
  }
  /**
   * Creates an internal texture without binding it to a framebuffer
   * @internal
   * @param size defines the size of the texture
   * @param options defines the options used to create the texture
   * @param delayGPUTextureCreation true to delay the texture creation the first time it is really needed. false to create it right away
   * @param source source type of the texture
   * @returns a new internal texture
   */
  _createInternalTexture(size, options, delayGPUTextureCreation = true, source = 0) {
    const fullOptions = {};
    if (options !== void 0 && typeof options === "object") {
      fullOptions.generateMipMaps = options.generateMipMaps;
      fullOptions.createMipMaps = options.createMipMaps;
      fullOptions.type = options.type === void 0 ? 0 : options.type;
      fullOptions.samplingMode = options.samplingMode === void 0 ? 3 : options.samplingMode;
      fullOptions.format = options.format === void 0 ? 5 : options.format;
      fullOptions.samples = options.samples ?? 1;
      fullOptions.creationFlags = options.creationFlags ?? 0;
      fullOptions.useSRGBBuffer = options.useSRGBBuffer ?? false;
      fullOptions.label = options.label;
      fullOptions.isCube = !!options.isCube;
    } else {
      fullOptions.generateMipMaps = options;
      fullOptions.type = 0;
      fullOptions.samplingMode = 3;
      fullOptions.format = 5;
      fullOptions.samples = 1;
      fullOptions.creationFlags = 0;
      fullOptions.useSRGBBuffer = false;
      fullOptions.isCube = false;
    }
    if (fullOptions.type === 1 && !this._caps.textureFloatLinearFiltering) {
      fullOptions.samplingMode = 1;
    } else if (fullOptions.type === 2 && !this._caps.textureHalfFloatLinearFiltering) {
      fullOptions.samplingMode = 1;
    }
    if (fullOptions.type === 1 && !this._caps.textureFloat) {
      fullOptions.type = 0;
      Logger.Warn("Float textures are not supported. Type forced to TEXTURETYPE_UNSIGNED_BYTE");
    }
    const texture = new InternalTexture(this, source);
    const width = size.width ?? size;
    const height = size.height ?? size;
    const depth = size.depth ?? 0;
    const layers = size.layers ?? 0;
    texture.baseWidth = width;
    texture.baseHeight = height;
    texture.width = width;
    texture.height = height;
    texture.depth = depth || layers;
    texture.isReady = true;
    texture.samples = fullOptions.samples;
    texture.generateMipMaps = !!fullOptions.generateMipMaps;
    texture.samplingMode = fullOptions.samplingMode;
    texture.type = fullOptions.type;
    texture.format = fullOptions.format;
    texture.is2DArray = layers > 0;
    texture.is3D = depth > 0;
    texture.isCube = fullOptions.isCube;
    texture._cachedWrapU = 0;
    texture._cachedWrapV = 0;
    texture._useSRGBBuffer = fullOptions.useSRGBBuffer;
    texture.label = fullOptions.label;
    this._internalTexturesCache.push(texture);
    if (!delayGPUTextureCreation) {
      const createMipMapsOnly = !fullOptions.generateMipMaps && fullOptions.createMipMaps;
      if (createMipMapsOnly) {
        texture.generateMipMaps = true;
      }
      this._textureHelper.createGPUTextureForInternalTexture(texture, width, height, texture.depth || 1, fullOptions.creationFlags);
      if (createMipMapsOnly) {
        texture.generateMipMaps = false;
      }
    }
    return texture;
  }
  /**
   * Usually called from Texture.ts.
   * Passed information to create a hardware texture
   * @param url defines a value which contains one of the following:
   * * A conventional http URL, e.g. 'http://...' or 'file://...'
   * * A base64 string of in-line texture data, e.g. 'data:image/jpg;base64,/...'
   * * An indicator that data being passed using the buffer parameter, e.g. 'data:mytexture.jpg'
   * @param noMipmap defines a boolean indicating that no mipmaps shall be generated.  Ignored for compressed textures.  They must be in the file
   * @param invertY when true, image is flipped when loaded.  You probably want true. Certain compressed textures may invert this if their default is inverted (eg. ktx)
   * @param scene needed for loading to the correct scene
   * @param samplingMode mode with should be used sample / access the texture (Default: Texture.TRILINEAR_SAMPLINGMODE)
   * @param onLoad optional callback to be called upon successful completion
   * @param onError optional callback to be called upon failure
   * @param buffer a source of a file previously fetched as either a base64 string, an ArrayBuffer (compressed or image format), HTMLImageElement (image format), or a Blob
   * @param fallback an internal argument in case the function must be called again, due to etc1 not having alpha capabilities
   * @param format internal format.  Default: RGB when extension is '.jpg' else RGBA.  Ignored for compressed textures
   * @param forcedExtension defines the extension to use to pick the right loader
   * @param mimeType defines an optional mime type
   * @param loaderOptions options to be passed to the loader
   * @param creationFlags specific flags to use when creating the texture (1 for storage textures, for eg)
   * @param useSRGBBuffer defines if the texture must be loaded in a sRGB GPU buffer (if supported by the GPU).
   * @returns a InternalTexture for assignment back into BABYLON.Texture
   */
  createTexture(url, noMipmap, invertY, scene, samplingMode = 3, onLoad = null, onError = null, buffer = null, fallback = null, format = null, forcedExtension = null, mimeType, loaderOptions, creationFlags, useSRGBBuffer) {
    return this._createTextureBase(url, noMipmap, invertY, scene, samplingMode, onLoad, onError, (texture, extension, scene2, img, invertY2, noMipmap2, isCompressed, processFunction) => {
      const imageBitmap = img;
      texture.baseWidth = imageBitmap.width;
      texture.baseHeight = imageBitmap.height;
      texture.width = imageBitmap.width;
      texture.height = imageBitmap.height;
      texture.format = texture.format !== -1 ? texture.format : format ?? 5;
      texture.type = texture.type !== -1 ? texture.type : 0;
      texture._creationFlags = creationFlags ?? 0;
      processFunction(texture.width, texture.height, imageBitmap, extension, texture, () => {
      });
      if (!texture._hardwareTexture?.underlyingResource) {
        const gpuTextureWrapper = this._textureHelper.createGPUTextureForInternalTexture(texture, imageBitmap.width, imageBitmap.height, void 0, creationFlags);
        if (WebGPUTextureHelper.IsImageBitmap(imageBitmap)) {
          this._textureHelper.updateTexture(imageBitmap, texture, imageBitmap.width, imageBitmap.height, texture.depth, gpuTextureWrapper.format, 0, 0, invertY2, false, 0, 0);
          if (!noMipmap2 && !isCompressed) {
            this._generateMipmaps(texture, this._uploadEncoder);
          }
        }
      } else if (!noMipmap2 && !isCompressed) {
        this._generateMipmaps(texture, this._uploadEncoder);
      }
      if (scene2) {
        scene2.removePendingData(texture);
      }
      texture.isReady = true;
      texture.onLoadedObservable.notifyObservers(texture);
      texture.onLoadedObservable.clear();
    }, () => false, buffer, fallback, format, forcedExtension, mimeType, loaderOptions, useSRGBBuffer);
  }
  /**
   * Wraps an external web gpu texture in a Babylon texture.
   * @param texture defines the external texture
   * @returns the babylon internal texture
   */
  wrapWebGPUTexture(texture) {
    const hardwareTexture = new WebGPUHardwareTexture(this, texture);
    hardwareTexture.format = texture.format;
    hardwareTexture.originalFormat = texture.format;
    const internalTexture = new InternalTexture(this, 15, true);
    internalTexture._hardwareTexture = hardwareTexture;
    internalTexture.baseWidth = texture.width;
    internalTexture.baseHeight = texture.height;
    internalTexture.width = texture.width;
    internalTexture.height = texture.height;
    internalTexture.isReady = true;
    return internalTexture;
  }
  /**
   * Replaces the underlying GPUTexture of a texture previously created via {@link wrapWebGPUTexture}, preserving the
   * InternalTexture identity.
   *
   * Intended for the device-loss / device-restored flow: when the host recreates its external resource on the new
   * GPU device, it calls this method to repoint Babylon's wrapper at the new handle without losing references held
   * by materials, render-target wrappers, particle systems, etc.
   *
   * The new GPUTexture must have the same dimensions as the original. To change dimensions, dispose the wrapped
   * texture and call {@link wrapWebGPUTexture} again.
   *
   * Throws if the target was not produced by {@link wrapWebGPUTexture}, or if the new GPUTexture's dimensions don't
   * match.
   * @param internalTexture defines the wrapped InternalTexture to repoint
   * @param texture defines the new GPUTexture to wrap
   */
  updateWrappedWebGPUTexture(internalTexture, texture) {
    if (internalTexture.source !== 15) {
      throw new Error("updateWrappedWebGPUTexture: target InternalTexture was not produced by wrapWebGPUTexture.");
    }
    if (texture.width !== internalTexture.baseWidth || texture.height !== internalTexture.baseHeight) {
      throw new Error(`updateWrappedWebGPUTexture: new GPUTexture dimensions (${texture.width}x${texture.height}) must match the wrapped texture's dimensions (${internalTexture.baseWidth}x${internalTexture.baseHeight}).`);
    }
    const hardwareTexture = internalTexture._hardwareTexture;
    hardwareTexture.set(texture);
    hardwareTexture.setUsage(15, internalTexture.generateMipMaps, internalTexture.is2DArray, internalTexture.isCube, internalTexture.is3D, texture.width, texture.height, internalTexture.depth);
    internalTexture.isReady = true;
    internalTexture._setUniqueId(InternalTexture._Counter++);
  }
  // eslint-disable-next-line jsdoc/require-returns-check
  /**
   * Wraps an external web gl texture in a Babylon texture.
   * @returns the babylon internal texture
   */
  wrapWebGLTexture() {
    throw new Error("wrapWebGLTexture is not supported, use wrapWebGPUTexture instead.");
  }
  /**
   * Throws because the engine is WebGPU. Use {@link updateWrappedWebGPUTexture} instead.
   */
  updateWrappedWebGLTexture() {
    throw new Error("updateWrappedWebGLTexture is not supported, use updateWrappedWebGPUTexture instead.");
  }
  /**
   * @internal
   */
  _getUseSRGBBuffer(useSRGBBuffer, _noMipmap) {
    return useSRGBBuffer && this._caps.supportSRGBBuffers;
  }
  /**
   * @internal
   */
  _unpackFlipY(_value) {
  }
  /**
   * Update the sampling mode of a given texture
   * @param samplingMode defines the required sampling mode
   * @param texture defines the texture to update
   * @param generateMipMaps defines whether to generate mipmaps for the texture
   */
  updateTextureSamplingMode(samplingMode, texture, generateMipMaps = false) {
    if (generateMipMaps) {
      texture.generateMipMaps = true;
      this._generateMipmaps(texture);
    }
    texture.samplingMode = samplingMode;
  }
  /**
   * Update the sampling mode of a given texture
   * @param texture defines the texture to update
   * @param wrapU defines the texture wrap mode of the u coordinates
   * @param wrapV defines the texture wrap mode of the v coordinates
   * @param wrapR defines the texture wrap mode of the r coordinates
   */
  updateTextureWrappingMode(texture, wrapU, wrapV = null, wrapR = null) {
    if (wrapU !== null) {
      texture._cachedWrapU = wrapU;
    }
    if (wrapV !== null) {
      texture._cachedWrapV = wrapV;
    }
    if ((texture.is2DArray || texture.is3D) && wrapR !== null) {
      texture._cachedWrapR = wrapR;
    }
  }
  /**
   * Update the dimensions of a texture
   * @param texture texture to update
   * @param width new width of the texture
   * @param height new height of the texture
   * @param depth new depth of the texture
   */
  updateTextureDimensions(texture, width, height, depth = 1) {
    if (!texture._hardwareTexture) {
      return;
    }
    if (texture.width === width && texture.height === height && texture.depth === depth) {
      return;
    }
    const additionalUsages = texture._hardwareTexture.textureAdditionalUsages;
    texture._hardwareTexture.release();
    this._textureHelper.createGPUTextureForInternalTexture(texture, width, height, depth, additionalUsages);
  }
  /**
   * @internal
   */
  _setInternalTexture(name2, texture, baseName) {
    baseName = baseName ?? name2;
    if (this._currentEffect) {
      const webgpuPipelineContext = this._currentEffect._pipelineContext;
      const availableTexture = webgpuPipelineContext.shaderProcessingContext.availableTextures[baseName];
      this._currentMaterialContext.setTexture(name2, texture);
      if (availableTexture && availableTexture.autoBindSampler) {
        const samplerName = baseName + `Sampler`;
        this._currentMaterialContext.setSampler(samplerName, texture);
      }
    }
  }
  /**
   * Create a cube texture from prefiltered data (ie. the mipmaps contain ready to use data for PBR reflection)
   * @param rootUrl defines the url where the file to load is located
   * @param scene defines the current scene
   * @param lodScale defines scale to apply to the mip map selection
   * @param lodOffset defines offset to apply to the mip map selection
   * @param onLoad defines an optional callback raised when the texture is loaded
   * @param onError defines an optional callback raised if there is an issue to load the texture
   * @param format defines the format of the data
   * @param forcedExtension defines the extension to use to pick the right loader
   * @param createPolynomials defines wheter or not to create polynomails harmonics for the texture
   * @param buffer defines the data buffer to load instead of loading the rootUrl
   * @returns the cube texture as an InternalTexture
   */
  createPrefilteredCubeTexture(rootUrl, scene, lodScale, lodOffset, onLoad = null, onError = null, format, forcedExtension = null, createPolynomials = true, buffer = null) {
    const callback = (loadData) => {
      if (!loadData) {
        if (onLoad) {
          onLoad(null);
        }
        return;
      }
      const texture = loadData.texture;
      if (!createPolynomials) {
        texture._sphericalPolynomial = texture._sphericalPolynomial ?? new SphericalPolynomial();
      } else if (loadData.info.sphericalPolynomial) {
        texture._sphericalPolynomial = loadData.info.sphericalPolynomial;
      }
      texture._source = 9;
      if (onLoad) {
        onLoad(texture);
      }
    };
    return this.createCubeTexture(rootUrl, scene, null, false, callback, onError, format, forcedExtension, createPolynomials, lodScale, lodOffset, null, void 0, false, buffer);
  }
  /**
   * Sets a texture to the according uniform.
   * @param channel The texture channel
   * @param unused unused parameter
   * @param texture The texture to apply
   * @param name The name of the uniform in the effect
   */
  setTexture(channel, unused, texture, name2) {
    this._setTexture(channel, texture, false, false, name2, name2);
  }
  /**
   * Sets an array of texture to the WebGPU context
   * @param channel defines the channel where the texture array must be set
   * @param unused unused parameter
   * @param textures defines the array of textures to bind
   * @param name name of the channel
   */
  setTextureArray(channel, unused, textures, name2) {
    for (let index = 0; index < textures.length; index++) {
      this._setTexture(-1, textures[index], true, false, name2 + index.toString(), name2);
    }
  }
  /**
   * @internal
   */
  _setTexture(channel, texture, isPartOfTextureArray = false, depthStencilTexture = false, name2 = "", baseName) {
    baseName = baseName ?? name2;
    if (this._currentEffect) {
      if (!texture) {
        this._currentMaterialContext.setTexture(name2, null);
        return false;
      }
      if (texture.video) {
        texture.update();
      } else if (texture.delayLoadState === 4) {
        texture.delayLoad();
        return false;
      }
      let internalTexture;
      if (depthStencilTexture) {
        internalTexture = texture.depthStencilTexture;
      } else if (texture.isReady()) {
        internalTexture = texture.getInternalTexture();
      } else if (texture.isCube) {
        internalTexture = this.emptyCubeTexture;
      } else if (texture.is3D) {
        internalTexture = this.emptyTexture3D;
      } else if (texture.is2DArray) {
        internalTexture = this.emptyTexture2DArray;
      } else {
        internalTexture = this.emptyTexture;
      }
      if (internalTexture && !internalTexture.isMultiview) {
        if (internalTexture.isCube && internalTexture._cachedCoordinatesMode !== texture.coordinatesMode) {
          internalTexture._cachedCoordinatesMode = texture.coordinatesMode;
          const textureWrapMode = texture.coordinatesMode !== 3 && texture.coordinatesMode !== 5 ? 1 : 0;
          texture.wrapU = textureWrapMode;
          texture.wrapV = textureWrapMode;
        }
        internalTexture._cachedWrapU = texture.wrapU;
        internalTexture._cachedWrapV = texture.wrapV;
        if (internalTexture.is3D) {
          internalTexture._cachedWrapR = texture.wrapR;
        }
        this._setAnisotropicLevel(0, internalTexture, texture.anisotropicFilteringLevel);
      }
      this._setInternalTexture(name2, internalTexture, baseName);
    }
    return true;
  }
  /**
   * @internal
   */
  _setAnisotropicLevel(target, internalTexture, anisotropicFilteringLevel) {
    if (internalTexture._cachedAnisotropicFilteringLevel !== anisotropicFilteringLevel) {
      internalTexture._cachedAnisotropicFilteringLevel = Math.min(anisotropicFilteringLevel, this._caps.maxAnisotropy);
    }
  }
  /**
   * @internal
   */
  _bindTexture(channel, texture, name2) {
    if (channel === void 0) {
      return;
    }
    this._setInternalTexture(name2, texture);
  }
  /**
   * Generates the mipmaps for a texture
   * @param texture texture to generate the mipmaps for
   */
  generateMipmaps(texture) {
    this._generateMipmaps(texture);
  }
  /**
   * Update a portion of an internal texture
   * @param texture defines the texture to update
   * @param imageData defines the data to store into the texture
   * @param xOffset defines the x coordinates of the update rectangle
   * @param yOffset defines the y coordinates of the update rectangle
   * @param width defines the width of the update rectangle
   * @param height defines the height of the update rectangle
   * @param faceIndex defines the face index if texture is a cube (0 by default)
   * @param lod defines the lod level to update (0 by default)
   * @param generateMipMaps defines whether to generate mipmaps or not
   */
  updateTextureData(texture, imageData, xOffset, yOffset, width, height, faceIndex = 0, lod = 0, generateMipMaps = false) {
    let gpuTextureWrapper = texture._hardwareTexture;
    if (!texture._hardwareTexture?.underlyingResource) {
      gpuTextureWrapper = this._textureHelper.createGPUTextureForInternalTexture(texture);
    }
    const data = new Uint8Array(imageData.buffer, imageData.byteOffset, imageData.byteLength);
    this._textureHelper.updateTexture(data, texture, width, height, texture.depth, gpuTextureWrapper.format, faceIndex, lod, texture.invertY, false, xOffset, yOffset);
    if (generateMipMaps) {
      this._generateMipmaps(texture);
    }
  }
  /**
   * @internal
   */
  _uploadCompressedDataToTextureDirectly(texture, internalFormat, width, height, imageData, faceIndex = 0, lod = 0) {
    let gpuTextureWrapper = texture._hardwareTexture;
    if (!texture._hardwareTexture?.underlyingResource) {
      texture.format = internalFormat;
      gpuTextureWrapper = this._textureHelper.createGPUTextureForInternalTexture(texture, width, height);
    }
    const data = new Uint8Array(imageData.buffer, imageData.byteOffset, imageData.byteLength);
    this._textureHelper.updateTexture(data, texture, width, height, texture.depth, gpuTextureWrapper.format, faceIndex, lod, false, false, 0, 0);
  }
  /**
   * @internal
   */
  _uploadDataToTextureDirectly(texture, imageData, faceIndex = 0, lod = 0, babylonInternalFormat, useTextureWidthAndHeight = false) {
    const lodMaxWidth = Math.round(Math.log(texture.width) * Math.LOG2E);
    const lodMaxHeight = Math.round(Math.log(texture.height) * Math.LOG2E);
    const width = useTextureWidthAndHeight ? texture.width : Math.pow(2, Math.max(lodMaxWidth - lod, 0));
    const height = useTextureWidthAndHeight ? texture.height : Math.pow(2, Math.max(lodMaxHeight - lod, 0));
    let gpuTextureWrapper = texture._hardwareTexture;
    if (!texture._hardwareTexture?.underlyingResource) {
      gpuTextureWrapper = this._textureHelper.createGPUTextureForInternalTexture(texture, width, height);
    }
    const data = new Uint8Array(imageData.buffer, imageData.byteOffset, imageData.byteLength);
    this._textureHelper.updateTexture(data, texture, width, height, texture.depth, gpuTextureWrapper.format, faceIndex, lod, texture.invertY, false, 0, 0);
  }
  /**
   * @internal
   */
  _uploadArrayBufferViewToTexture(texture, imageData, faceIndex = 0, lod = 0) {
    this._uploadDataToTextureDirectly(texture, imageData, faceIndex, lod);
  }
  /**
   * @internal
   */
  _uploadImageToTexture(texture, image, faceIndex = 0, lod = 0) {
    let gpuTextureWrapper = texture._hardwareTexture;
    if (!texture._hardwareTexture?.underlyingResource) {
      gpuTextureWrapper = this._textureHelper.createGPUTextureForInternalTexture(texture);
    }
    if (image instanceof HTMLImageElement) {
      throw "WebGPU engine: HTMLImageElement not supported in _uploadImageToTexture!";
    }
    const bitmap = image;
    const width = Math.ceil(texture.width / (1 << lod));
    const height = Math.ceil(texture.height / (1 << lod));
    this._textureHelper.updateTexture(bitmap, texture, width, height, texture.depth, gpuTextureWrapper.format, faceIndex, lod, texture.invertY, false, 0, 0);
  }
  /**
   * Reads pixels from the current frame buffer. Please note that this function can be slow
   * @param x defines the x coordinate of the rectangle where pixels must be read
   * @param y defines the y coordinate of the rectangle where pixels must be read
   * @param width defines the width of the rectangle where pixels must be read
   * @param height defines the height of the rectangle where pixels must be read
   * @param _hasAlpha defines whether the output should have alpha or not (defaults to true)
   * @param flushRenderer true to flush the renderer from the pending commands before reading the pixels
   * @param data defines the data to fill with the read pixels (if not provided, a new one will be created)
   * @returns a ArrayBufferView promise (Uint8Array) containing RGBA colors
   */
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  readPixels(x, y, width, height, _hasAlpha = true, flushRenderer = true, data = null) {
    const renderPassWrapper = this._getCurrentRenderPassWrapper();
    const hardwareTexture = renderPassWrapper.colorAttachmentGPUTextures[0];
    if (!hardwareTexture) {
      return Promise.resolve(new Uint8Array(0));
    }
    const gpuTexture = hardwareTexture.underlyingResource;
    const gpuTextureFormat = hardwareTexture.format;
    if (!gpuTexture) {
      return Promise.resolve(new Uint8Array(0));
    }
    if (flushRenderer) {
      this.flushFramebuffer();
    }
    return this._textureHelper.readPixels(gpuTexture, x, y, width, height, gpuTextureFormat, void 0, void 0, data);
  }
  //------------------------------------------------------------------------------
  //                              Frame management
  //------------------------------------------------------------------------------
  _measureFps() {
    this._performanceMonitor.sampleFrame();
    this._fps = this._performanceMonitor.averageFPS;
    this._deltaTime = this._performanceMonitor.instantaneousFrameTime || 0;
  }
  /**
   * Gets the performance monitor attached to this engine
   * @see https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene#engineinstrumentation
   */
  get performanceMonitor() {
    return this._performanceMonitor;
  }
  /**
   * Begin a new frame
   */
  beginFrame() {
    this._measureFps();
    super.beginFrame();
  }
  /**
   * End the current frame
   */
  endFrame() {
    this._endCurrentRenderPass();
    this._snapshotRendering.endFrame();
    this._timestampQuery.endFrame(this._renderEncoder);
    this._timestampIndex = 0;
    this._internalFrameCounter = 0;
    this.flushFramebuffer(true);
    this._textureHelper.destroyDeferredTextures();
    this._bufferManager.destroyDeferredBuffers();
    this.countersLastFrame.numEnableEffects = this._counters.numEnableEffects;
    this.countersLastFrame.numEnableDrawWrapper = this._counters.numEnableDrawWrapper;
    this.countersLastFrame.numBundleCreationNonCompatMode = this._counters.numBundleCreationNonCompatMode;
    this.countersLastFrame.numBundleReuseNonCompatMode = this._counters.numBundleReuseNonCompatMode;
    this._counters.numEnableEffects = 0;
    this._counters.numEnableDrawWrapper = 0;
    this._counters.numBundleCreationNonCompatMode = 0;
    this._counters.numBundleReuseNonCompatMode = 0;
    this._cacheRenderPipeline.endFrame();
    this._cacheBindGroups.endFrame();
    super.endFrame();
  }
  /**Gets driver info if available */
  extractDriverInfo() {
    return "";
  }
  /**
   * Force a WebGPU flush (ie. a flush of all waiting commands)
   * @internal @param _fromEndFrame defines whether the flush is triggered from endFrame or not (default: false)
   */
  flushFramebuffer(_fromEndFrame = false) {
    this._endCurrentRenderPass();
    this._debugPopBeforeEndOfEncoder();
    this._commandBuffers[0] = this._uploadEncoder.finish();
    this._commandBuffers[1] = this._renderEncoder.finish();
    this._device.queue.submit(this._commandBuffers);
    const frameCounter = this._internalFrameCounter++;
    this._uploadEncoderDescriptor.label = `[${_fromEndFrame ? this.frameId + 1 : this.frameId}|${frameCounter}] - UploadEncoder`;
    this._renderEncoderDescriptor.label = `[${_fromEndFrame ? this.frameId + 1 : this.frameId}|${frameCounter}] - RenderEncoder`;
    this._uploadEncoder = this._device.createCommandEncoder(this._uploadEncoderDescriptor);
    this._renderEncoder = this._device.createCommandEncoder(this._renderEncoderDescriptor);
    if (_fromEndFrame) {
      this._debugMarkersEncoderGroups.length = 0;
      this._debugMarkersPassGroups.length = 0;
    } else {
      this._debugPushAfterStartOfEncoder();
    }
    this._timestampQuery.startFrame(this._uploadEncoder);
    this._textureHelper.setCommandEncoder(this._uploadEncoder);
    this._bundleList.reset();
  }
  /** @internal */
  _currentFrameBufferIsDefaultFrameBuffer() {
    return this._currentPassIsMainPass();
  }
  //------------------------------------------------------------------------------
  //                              Render Pass
  //------------------------------------------------------------------------------
  /** @internal */
  _startRenderTargetRenderPass(renderTargetWrapper, setClearStates, clearColor, clearDepth, clearStencil) {
    this._endCurrentRenderPass();
    const rtWrapper = renderTargetWrapper;
    const sampleCount = renderTargetWrapper.samples;
    const useMSAA = sampleCount > 1;
    const depthStencilTexture = rtWrapper._depthStencilTexture;
    const gpuDepthStencilWrapper = depthStencilTexture?._hardwareTexture;
    const gpuDepthStencilTexture = gpuDepthStencilWrapper?.underlyingResource;
    let depthStencilView;
    let format;
    if (useMSAA) {
      const gpuMSAATexture = gpuDepthStencilWrapper?.getMSAATexture(sampleCount);
      depthStencilView = gpuMSAATexture ? this._cacheTextureViews.getView(gpuMSAATexture, this._rttRenderPassWrapper.depthAttachmentViewDescriptor) : void 0;
      format = gpuMSAATexture?.format;
    }
    if (!depthStencilView && gpuDepthStencilTexture) {
      depthStencilView = this._cacheTextureViews.getView(gpuDepthStencilTexture, this._rttRenderPassWrapper.depthAttachmentViewDescriptor);
    }
    if (!format && gpuDepthStencilWrapper) {
      format = gpuDepthStencilWrapper.format;
    }
    const depthTextureHasStencil = format ? WebGPUTextureHelper.HasStencilAspect(format) : false;
    const depthTextureHasDepth = format ? WebGPUTextureHelper.HasDepthAspect(format) : false;
    const colorAttachments = [];
    if (this.useReverseDepthBuffer) {
      this.setDepthFunctionToGreaterOrEqual();
    }
    const clearColorForIntegerRt = TempColor4;
    const clearColorForSignedIntegerRt = TempColor4SignedInteger;
    if (clearColor) {
      clearColorForIntegerRt.r = clearColor.r * 255;
      clearColorForIntegerRt.g = clearColor.g * 255;
      clearColorForIntegerRt.b = clearColor.b * 255;
      clearColorForIntegerRt.a = clearColor.a * 255;
      clearColorForSignedIntegerRt.r = Math.round(clearColor.r);
      clearColorForSignedIntegerRt.g = Math.round(clearColor.g);
      clearColorForSignedIntegerRt.b = Math.round(clearColor.b);
      clearColorForSignedIntegerRt.a = Math.round(clearColor.a);
    }
    const mustClearColor = setClearStates && clearColor;
    const mustClearDepth = setClearStates && clearDepth;
    const mustClearStencil = setClearStates && clearStencil;
    if (rtWrapper._attachments && rtWrapper.isMulti) {
      if (!this._mrtAttachments || this._mrtAttachments.length === 0) {
        this._mrtAttachments = rtWrapper._defaultAttachments;
      }
      for (let i = 0; i < this._mrtAttachments.length; ++i) {
        const index = this._mrtAttachments[i];
        const mrtTexture = rtWrapper.textures[i];
        const gpuMRTWrapper = mrtTexture?._hardwareTexture;
        const gpuMRTTexture = gpuMRTWrapper?.underlyingResource;
        if (gpuMRTWrapper && gpuMRTTexture) {
          const depthSlice = mrtTexture.is3D ? rtWrapper.layerIndices?.[i] ?? 0 : void 0;
          const baseArrayLayer = rtWrapper.getBaseArrayLayer(i);
          const gpuMSAATexture = useMSAA ? gpuMRTWrapper.getMSAATexture(sampleCount, mrtTexture.is3D ? depthSlice : baseArrayLayer) : void 0;
          const viewDescriptor = {
            ...this._rttRenderPassWrapper.colorAttachmentViewDescriptor,
            dimension: mrtTexture.is3D ? "3d" : "2d",
            format: gpuMRTWrapper.format,
            baseArrayLayer
          };
          const msaaViewDescriptor = {
            ...this._rttRenderPassWrapper.colorAttachmentViewDescriptor,
            dimension: mrtTexture.is3D ? "3d" : "2d",
            format: gpuMRTWrapper.format,
            baseArrayLayer: 0
          };
          const isRtInteger = IsIntegerTextureFormat(mrtTexture.format);
          const isRtUnsignedInteger = IsUnsignedIntegerTextureType(mrtTexture.type);
          const colorTextureView = this._cacheTextureViews.getView(gpuMRTTexture, viewDescriptor);
          const colorMSAATextureView = gpuMSAATexture ? this._cacheTextureViews.getView(gpuMSAATexture, msaaViewDescriptor) : void 0;
          colorAttachments.push({
            view: colorMSAATextureView ? colorMSAATextureView : colorTextureView,
            resolveTarget: gpuMSAATexture && !rtWrapper.disableAutomaticMSAAResolve && rtWrapper.resolveMSAAColors ? colorTextureView : void 0,
            depthSlice,
            clearValue: index !== 0 && mustClearColor ? isRtInteger ? isRtUnsignedInteger ? clearColorForIntegerRt : clearColorForSignedIntegerRt : clearColor : void 0,
            loadOp: index !== 0 && mustClearColor ? "clear" : "load",
            storeOp: "store"
          });
        }
      }
      this._cacheRenderPipeline.setMRT(rtWrapper.textures, this._mrtAttachments.length);
      this._cacheRenderPipeline.setMRTAttachments(this._mrtAttachments);
    } else {
      const internalTexture = rtWrapper.texture;
      if (internalTexture) {
        const gpuWrapper = internalTexture._hardwareTexture;
        const gpuTexture = gpuWrapper.underlyingResource;
        const depthSlice = rtWrapper.is3D ? this._rttRenderPassWrapper.colorAttachmentDepthSlice : void 0;
        const layerIndex = depthSlice ?? this._rttRenderPassWrapper.colorAttachmentViewDescriptor.baseArrayLayer;
        const gpuMSAATexture = useMSAA ? gpuWrapper.getMSAATexture(sampleCount, layerIndex) : void 0;
        const colorTextureView = this._cacheTextureViews.getView(gpuTexture, this._rttRenderPassWrapper.colorAttachmentViewDescriptor);
        const colorMSAATextureView = gpuMSAATexture ? this._cacheTextureViews.getView(gpuMSAATexture, this._rttRenderPassWrapper.colorAttachmentViewDescriptor) : void 0;
        const isRtInteger = IsIntegerTextureFormat(internalTexture.format);
        const isRtUnsignedInteger = IsUnsignedIntegerTextureType(internalTexture.type);
        colorAttachments.push({
          view: colorMSAATextureView ? colorMSAATextureView : colorTextureView,
          resolveTarget: gpuMSAATexture && !rtWrapper.disableAutomaticMSAAResolve && rtWrapper.resolveMSAAColors ? colorTextureView : void 0,
          depthSlice,
          clearValue: mustClearColor ? isRtInteger ? isRtUnsignedInteger ? clearColorForIntegerRt : clearColorForSignedIntegerRt : clearColor : void 0,
          loadOp: mustClearColor ? "clear" : "load",
          storeOp: "store"
        });
      } else {
        colorAttachments.push(null);
      }
    }
    const frameCounter = this._internalFrameCounter++;
    this._rttRenderPassWrapper.renderPassDescriptor = {
      label: `[${this.frameId}|${frameCounter}] - ` + (renderTargetWrapper.label ?? "RTT") + " - RenderPass",
      colorAttachments,
      depthStencilAttachment: depthStencilTexture && gpuDepthStencilTexture ? {
        view: depthStencilView,
        depthClearValue: mustClearDepth ? this.useReverseDepthBuffer ? this._clearReverseDepthValue : this._clearDepthValue : void 0,
        depthLoadOp: rtWrapper.depthReadOnly || !depthTextureHasDepth ? void 0 : mustClearDepth ? "clear" : "load",
        depthStoreOp: rtWrapper.depthReadOnly || !depthTextureHasDepth ? void 0 : "store",
        depthReadOnly: rtWrapper.depthReadOnly,
        stencilClearValue: rtWrapper._depthStencilTextureWithStencil && mustClearStencil ? this._clearStencilValue : void 0,
        stencilLoadOp: rtWrapper.stencilReadOnly || !depthTextureHasStencil ? void 0 : rtWrapper._depthStencilTextureWithStencil && mustClearStencil ? "clear" : "load",
        stencilStoreOp: rtWrapper.stencilReadOnly || !depthTextureHasStencil ? void 0 : "store",
        stencilReadOnly: rtWrapper.stencilReadOnly
      } : void 0,
      occlusionQuerySet: this._occlusionQuery?.hasQueries ? this._occlusionQuery.querySet : void 0
    };
    this._timestampQuery.startPass(this._rttRenderPassWrapper.renderPassDescriptor, this._timestampIndex);
    this._currentRenderPass = this._renderEncoder.beginRenderPass(this._rttRenderPassWrapper.renderPassDescriptor);
    this._debugPushAfterStartOfEncoder();
    this._resetRenderPassStates();
    if (!gpuDepthStencilWrapper || !WebGPUTextureHelper.HasStencilAspect(gpuDepthStencilWrapper.format)) {
      this._stencilStateComposer.enabled = false;
    }
  }
  _startMainRenderPass(setClearStates, clearColor, clearDepth, clearStencil) {
    this._endCurrentRenderPass();
    if (this.useReverseDepthBuffer) {
      this.setDepthFunctionToGreaterOrEqual();
    }
    const mustClearColor = setClearStates && clearColor;
    const mustClearDepth = setClearStates && clearDepth;
    const mustClearStencil = setClearStates && clearStencil;
    const frameCounter = this._internalFrameCounter++;
    this._mainRenderPassWrapper.renderPassDescriptor.label = `[${this.frameId}|${frameCounter}] - MainRenderPass`;
    this._mainRenderPassWrapper.renderPassDescriptor.colorAttachments[0].clearValue = mustClearColor ? clearColor : void 0;
    this._mainRenderPassWrapper.renderPassDescriptor.colorAttachments[0].loadOp = mustClearColor ? "clear" : "load";
    this._mainRenderPassWrapper.renderPassDescriptor.depthStencilAttachment.depthClearValue = mustClearDepth ? this.useReverseDepthBuffer ? this._clearReverseDepthValue : this._clearDepthValue : void 0;
    this._mainRenderPassWrapper.renderPassDescriptor.depthStencilAttachment.depthLoadOp = mustClearDepth ? "clear" : "load";
    this._mainRenderPassWrapper.renderPassDescriptor.depthStencilAttachment.stencilClearValue = mustClearStencil ? this._clearStencilValue : void 0;
    this._mainRenderPassWrapper.renderPassDescriptor.depthStencilAttachment.stencilLoadOp = !this.isStencilEnable ? void 0 : mustClearStencil ? "clear" : "load";
    this._mainRenderPassWrapper.renderPassDescriptor.occlusionQuerySet = this._occlusionQuery?.hasQueries ? this._occlusionQuery.querySet : void 0;
    const swapChainTexture = this._context.getCurrentTexture();
    this._mainRenderPassWrapper.colorAttachmentGPUTextures[0].set(swapChainTexture);
    if (this._options.antialias) {
      ViewDescriptorSwapChainAntialiasing.format = swapChainTexture.format;
      this._mainRenderPassWrapper.renderPassDescriptor.colorAttachments[0].resolveTarget = swapChainTexture.createView(ViewDescriptorSwapChainAntialiasing);
    } else {
      ViewDescriptorSwapChain.format = swapChainTexture.format;
      this._mainRenderPassWrapper.renderPassDescriptor.colorAttachments[0].view = swapChainTexture.createView(ViewDescriptorSwapChain);
    }
    this._timestampQuery.startPass(this._mainRenderPassWrapper.renderPassDescriptor, this._timestampIndex);
    this._currentRenderPass = this._renderEncoder.beginRenderPass(this._mainRenderPassWrapper.renderPassDescriptor);
    this._debugPushAfterStartOfEncoder();
    this._setDepthTextureFormat(this._mainRenderPassWrapper);
    this._setColorFormat(this._mainRenderPassWrapper);
    this._resetRenderPassStates();
    if (!this._isStencilEnable) {
      this._stencilStateComposer.enabled = false;
    }
  }
  /**
   * Binds the frame buffer to the specified texture.
   * @param texture The render target wrapper to render to
   * @param faceIndex The face of the texture to render to in case of cube texture
   * @param requiredWidth The width of the target to render to
   * @param requiredHeight The height of the target to render to
   * @param forceFullscreenViewport Forces the viewport to be the entire texture/screen if true
   * @param lodLevel defines the lod level to bind to the frame buffer
   * @param layer defines the 2d array index to bind to frame buffer to
   */
  bindFramebuffer(texture, faceIndex = 0, requiredWidth, requiredHeight, forceFullscreenViewport, lodLevel = 0, layer = 0) {
    const hardwareTexture = texture.texture?._hardwareTexture;
    if (this._currentRenderTarget) {
      this.unBindFramebuffer(this._currentRenderTarget);
    } else {
      this._endCurrentRenderPass();
    }
    this._currentRenderTarget = texture;
    const depthStencilTexture = this._currentRenderTarget._depthStencilTexture;
    this._rttRenderPassWrapper.colorAttachmentGPUTextures[0] = hardwareTexture;
    this._rttRenderPassWrapper.depthTextureFormat = depthStencilTexture ? WebGPUTextureHelper.GetWebGPUTextureFormat(-1, depthStencilTexture.format) : void 0;
    this._setDepthTextureFormat(this._rttRenderPassWrapper);
    this._setColorFormat(this._rttRenderPassWrapper);
    this._rttRenderPassWrapper.colorAttachmentViewDescriptor = {
      label: texture.label ? texture.label + " - Color Attachment View" : "RTT - Color Attachment View",
      format: this._colorFormat,
      dimension: texture.is3D ? "3d" : "2d",
      mipLevelCount: 1,
      baseArrayLayer: texture.is3D ? 0 : texture.isCube ? layer * 6 + faceIndex : layer,
      baseMipLevel: lodLevel,
      arrayLayerCount: 1,
      aspect: "all"
    };
    this._rttRenderPassWrapper.colorAttachmentDepthSlice = texture.is3D ? layer : void 0;
    this._rttRenderPassWrapper.depthAttachmentViewDescriptor = {
      label: texture.label ? texture.label + " - Depth Attachment View" : "RTT - Depth Attachment View",
      format: this._depthTextureFormat,
      dimension: depthStencilTexture && depthStencilTexture.is3D ? "3d" : "2d",
      mipLevelCount: 1,
      baseArrayLayer: depthStencilTexture ? depthStencilTexture.isCube ? layer * 6 + faceIndex : layer : 0,
      baseMipLevel: 0,
      arrayLayerCount: 1,
      aspect: "all"
    };
    if (this._snapshotRendering.play || this._snapshotRendering.record) {
      this._startRenderTargetRenderPass(this._currentRenderTarget, false, null, false, false);
    }
    if (this._cachedViewport && !forceFullscreenViewport) {
      this.setViewport(this._cachedViewport, requiredWidth, requiredHeight);
    } else {
      if (!requiredWidth) {
        requiredWidth = texture.width;
        if (lodLevel) {
          requiredWidth = requiredWidth / Math.pow(2, lodLevel);
        }
      }
      if (!requiredHeight) {
        requiredHeight = texture.height;
        if (lodLevel) {
          requiredHeight = requiredHeight / Math.pow(2, lodLevel);
        }
      }
      this._viewport(0, 0, requiredWidth, requiredHeight);
    }
    this.wipeCaches();
  }
  /**
   * Unbind the current render target texture from the WebGPU context
   * @param texture defines the render target wrapper to unbind
   * @param disableGenerateMipMaps defines a boolean indicating that mipmaps must not be generated
   * @param onBeforeUnbind defines a function which will be called before the effective unbind
   */
  unBindFramebuffer(texture, disableGenerateMipMaps = false, onBeforeUnbind) {
    const saveCrt = this._currentRenderTarget;
    this._currentRenderTarget = null;
    if (onBeforeUnbind) {
      onBeforeUnbind();
    }
    this._currentRenderTarget = saveCrt;
    this._endCurrentRenderPass();
    this._resolveAndGenerateMipMapsFramebuffer(texture, disableGenerateMipMaps);
    this._currentRenderTarget = null;
    this._mrtAttachments = [];
    this._cacheRenderPipeline.setMRT([]);
    this._cacheRenderPipeline.setMRTAttachments(this._mrtAttachments);
  }
  _resolveAndGenerateMipMapsFramebuffer(texture, disableGenerateMipMaps = false) {
    const webglRtWrapper = texture;
    if (!webglRtWrapper.disableAutomaticMSAAResolve) {
      this.resolveFramebuffer(texture, false);
    }
    if (!disableGenerateMipMaps) {
      if (texture.isMulti) {
        this.generateMipMapsMultiFramebuffer(texture);
      } else {
        this.generateMipMapsFramebuffer(texture);
      }
    }
  }
  /**
   * Generates mipmaps for the texture of the (single) render target
   * @param texture The render target containing the texture to generate the mipmaps for
   */
  generateMipMapsFramebuffer(texture) {
    if (!texture.isMulti && texture.texture?.generateMipMaps && !texture.isCube) {
      this._generateMipmaps(texture.texture);
    }
  }
  /**
   * Resolves the MSAA texture of the render target into its non-MSAA version.
   * Note that if "texture" is not a MSAA render target, no resolve is performed.
   * @param texture The render target texture containing the MSAA texture to resolve
   * @param resolveColors If true, resolve the color textures (default: true) - still subject to texture.resolveMSAAColors
   */
  resolveFramebuffer(texture, resolveColors = true) {
    if (texture.samples <= 1) {
      return;
    }
    if (texture.resolveMSAAColors && resolveColors) {
      const disableAutomaticMSAAResolve = texture.disableAutomaticMSAAResolve;
      texture.disableAutomaticMSAAResolve = false;
      this.bindFramebuffer(texture);
      this._startRenderTargetRenderPass(this._currentRenderTarget, false, null, false, false);
      this.unBindFramebuffer(texture);
      texture.disableAutomaticMSAAResolve = disableAutomaticMSAAResolve;
    }
    if (texture.resolveMSAADepth && texture._depthStencilTexture) {
      const gpuTextureWrapper = texture._depthStencilTexture._hardwareTexture;
      this._textureHelper.resolveMSAADepthTexture(gpuTextureWrapper.getMSAATexture(texture.samples), gpuTextureWrapper.underlyingResource, this._renderEncoder);
    }
  }
  restoreDefaultFramebuffer(unbindOnly) {
    if (this._currentRenderTarget) {
      this.unBindFramebuffer(this._currentRenderTarget);
    } else {
      if (!this._currentRenderPass && !unbindOnly) {
        this._startMainRenderPass(false);
      } else {
        this._endCurrentRenderPass();
      }
    }
    if (this._cachedViewport) {
      this.setViewport(this._cachedViewport);
    }
    this.wipeCaches();
  }
  //------------------------------------------------------------------------------
  //                              Render
  //------------------------------------------------------------------------------
  /**
   * @internal
   */
  _setColorFormat(wrapper) {
    const format = wrapper.colorAttachmentGPUTextures[0]?.format ?? null;
    this._cacheRenderPipeline.setColorFormat(format);
    if (this._colorFormat === format) {
      return;
    }
    this._colorFormat = format;
  }
  /**
   * @internal
   */
  _setDepthTextureFormat(wrapper) {
    this._cacheRenderPipeline.setDepthStencilFormat(wrapper.depthTextureFormat);
    if (this._depthTextureFormat === wrapper.depthTextureFormat) {
      return;
    }
    this._depthTextureFormat = wrapper.depthTextureFormat;
  }
  /**
   * Set the dithering state (not applicable in WebGPU)
   */
  setDitheringState() {
  }
  /**
   * Set the rasterizer state (not applicable in WebGPU)
   */
  setRasterizerState() {
  }
  /**
   * @internal
   */
  _executeWhenRenderingStateIsCompiled(pipelineContext, action) {
    action();
  }
  /**
   * @internal
   */
  bindSamplers() {
  }
  /** @internal */
  _getUnpackAlignement() {
    return 1;
  }
  /**
   * @internal
   */
  _bindTextureDirectly() {
    return false;
  }
  setStateCullFaceType(cullBackFaces, force = false) {
    const cullFace = this.cullBackFaces ?? cullBackFaces ?? true ? 1 : 2;
    if (this._depthCullingState.cullFace !== cullFace || force) {
      this._depthCullingState.cullFace = cullFace;
    }
  }
  /**
   * Set various states to the webGL context
   * @param culling defines culling state: true to enable culling, false to disable it
   * @param zOffset defines the value to apply to zOffset (0 by default)
   * @param force defines if states must be applied even if cache is up to date
   * @param reverseSide defines if culling must be reversed (CCW if false, CW if true)
   * @param cullBackFaces true to cull back faces, false to cull front faces (if culling is enabled)
   * @param stencil stencil states to set
   * @param zOffsetUnits defines the value to apply to zOffsetUnits (0 by default)
   */
  setState(culling, zOffset = 0, force, reverseSide = false, cullBackFaces, stencil, zOffsetUnits = 0) {
    if (this._depthCullingState.cull !== culling || force) {
      this._depthCullingState.cull = culling;
    }
    this.setStateCullFaceType(cullBackFaces, force);
    this.setZOffset(zOffset);
    this.setZOffsetUnits(zOffsetUnits);
    const invertYRenderTarget = !!this._currentRenderTarget && !this._currentRenderTarget._disableEngineYFlip;
    const frontFace = reverseSide ? invertYRenderTarget ? 1 : 2 : invertYRenderTarget ? 2 : 1;
    if (this._depthCullingState.frontFace !== frontFace || force) {
      this._depthCullingState.frontFace = frontFace;
    }
    this._stencilStateComposer.stencilMaterial = stencil;
  }
  _applyRenderPassChanges(bundleList) {
    const mustUpdateStencilRef = !this._stencilStateComposer.enabled ? false : this._mustUpdateStencilRef();
    const mustUpdateBlendColor = !this._alphaState.alphaBlend ? false : this._mustUpdateBlendColor();
    if (this._mustUpdateViewport()) {
      this._applyViewport(bundleList);
    }
    if (this._mustUpdateScissor()) {
      this._applyScissor(bundleList);
    }
    if (mustUpdateStencilRef) {
      this._applyStencilRef(bundleList);
    }
    if (mustUpdateBlendColor) {
      this._applyBlendColor(bundleList);
    }
  }
  _draw(drawType, fillMode, start, count, instancesCount) {
    const renderPass = this._getCurrentRenderPass();
    const bundleList = this._bundleList;
    this.applyStates();
    const webgpuPipelineContext = this._currentEffect._pipelineContext;
    const invertYRenderTarget = !!this._currentRenderTarget && !this._currentRenderTarget._disableEngineYFlip;
    this.bindUniformBufferBase(invertYRenderTarget ? this._ubInvertY : this._ubDontInvertY, 0, WebGPUShaderProcessor.InternalsUBOName);
    this._currentDrawContext.setVertexPulling(
      this._currentMaterialContext.useVertexPulling,
      webgpuPipelineContext,
      this._currentVertexBuffers,
      this._cacheRenderPipeline.indexBuffer,
      // don't use this._currentIndexBuffer, it will have been set to null by _drawArraysType!
      this._currentOverrideVertexBuffers
    );
    if (webgpuPipelineContext.uniformBuffer) {
      if (this._useOwnerKeyedUniformBufferSlots) {
        webgpuPipelineContext.uniformBuffer._updateOwnerKeyed(this._currentDrawContext);
      } else {
        webgpuPipelineContext.uniformBuffer.update();
      }
      this.bindUniformBufferBase(webgpuPipelineContext.uniformBuffer.getBuffer(), 0, WebGPUShaderProcessor.LeftOvertUBOName);
    }
    if (this._snapshotRendering.play) {
      this._reportDrawCall();
      return;
    }
    if (!this.compatibilityMode && (this._currentDrawContext.isDirty(this._currentMaterialContext.updateId) || this._currentMaterialContext.isDirty || this._currentMaterialContext.forceBindGroupCreation)) {
      this._currentDrawContext.fastBundle = void 0;
    }
    const useFastPath = !this.compatibilityMode && this._currentDrawContext.fastBundle;
    let renderPass2 = renderPass;
    if (useFastPath || this._snapshotRendering.record) {
      this._applyRenderPassChanges(bundleList);
      if (!this._snapshotRendering.record) {
        this._counters.numBundleReuseNonCompatMode++;
        if (this._currentDrawContext.indirectDrawBuffer) {
          this._currentDrawContext.setIndirectData(count, instancesCount || 1, start);
        }
        bundleList.addBundle(this._currentDrawContext.fastBundle);
        this._reportDrawCall();
        return;
      }
      renderPass2 = bundleList.getBundleEncoder(this._cacheRenderPipeline.colorFormats, this._depthTextureFormat, this.currentSampleCount);
      bundleList.numDrawCalls++;
    }
    let textureState = 0;
    if (this._currentMaterialContext.hasFloatOrDepthTextures) {
      let bitVal = 1;
      for (let i = 0; i < webgpuPipelineContext.shaderProcessingContext.textureNames.length; ++i) {
        const textureName = webgpuPipelineContext.shaderProcessingContext.textureNames[i];
        const texture = this._currentMaterialContext.textures[textureName]?.texture;
        const textureIsDepth = texture && texture.format >= 13 && texture.format <= 18;
        if (texture?.type === 1 && !this._caps.textureFloatLinearFiltering || textureIsDepth) {
          textureState |= bitVal;
        }
        bitVal = bitVal << 1;
      }
    }
    this._currentMaterialContext.textureState = textureState;
    const pipeline = this._cacheRenderPipeline.getRenderPipeline(fillMode, this._currentEffect, this.currentSampleCount, textureState);
    const bindGroups = this._cacheBindGroups.getBindGroups(webgpuPipelineContext, this._currentDrawContext, this._currentMaterialContext);
    if (!this._snapshotRendering.record) {
      this._applyRenderPassChanges(!this.compatibilityMode ? bundleList : null);
      if (!this.compatibilityMode) {
        this._counters.numBundleCreationNonCompatMode++;
        renderPass2 = this._device.createRenderBundleEncoder({
          colorFormats: this._cacheRenderPipeline.colorFormats,
          depthStencilFormat: this._depthTextureFormat,
          sampleCount: WebGPUTextureHelper.GetSample(this.currentSampleCount)
        });
      }
    }
    renderPass2.setPipeline(pipeline);
    if (this._currentIndexBuffer) {
      renderPass2.setIndexBuffer(this._currentIndexBuffer.underlyingResource, this._currentIndexBuffer.is32Bits ? "uint32" : "uint16", 0);
    }
    const vertexBuffers = this._cacheRenderPipeline.vertexBuffers;
    for (let index = 0; index < vertexBuffers.length; index++) {
      const vertexBuffer = vertexBuffers[index];
      const buffer = vertexBuffer.effectiveBuffer;
      if (buffer) {
        renderPass2.setVertexBuffer(index, buffer.underlyingResource, vertexBuffer._validOffsetRange ? 0 : vertexBuffer.byteOffset);
      }
    }
    for (let i = 0; i < bindGroups.length; i++) {
      renderPass2.setBindGroup(i, bindGroups[i]);
    }
    const nonCompatMode = !this.compatibilityMode && !this._snapshotRendering.record;
    if ((nonCompatMode || this._currentDrawContext._enableIndirectDrawInCompatMode) && this._currentDrawContext.indirectDrawBuffer) {
      this._currentDrawContext.setIndirectData(count, instancesCount || 1, start);
      if (drawType === 0) {
        renderPass2.drawIndexedIndirect(this._currentDrawContext.indirectDrawBuffer, 0);
      } else {
        renderPass2.drawIndirect(this._currentDrawContext.indirectDrawBuffer, 0);
      }
    } else if (drawType === 0) {
      renderPass2.drawIndexed(count, instancesCount || 1, start, 0, 0);
    } else {
      renderPass2.draw(count, instancesCount || 1, start, 0);
    }
    if (nonCompatMode) {
      this._currentDrawContext.fastBundle = renderPass2.finish();
      bundleList.addBundle(this._currentDrawContext.fastBundle);
    }
    this._reportDrawCall();
  }
  /**
   * Draw a list of indexed primitives
   * @param fillMode defines the primitive to use
   * @param indexStart defines the starting index
   * @param indexCount defines the number of index to draw
   * @param instancesCount defines the number of instances to draw (if instantiation is enabled)
   */
  drawElementsType(fillMode, indexStart, indexCount, instancesCount = 1) {
    this._draw(0, fillMode, indexStart, indexCount, instancesCount);
  }
  /**
   * Draw a list of unindexed primitives
   * @param fillMode defines the primitive to use
   * @param verticesStart defines the index of first vertex to draw
   * @param verticesCount defines the count of vertices to draw
   * @param instancesCount defines the number of instances to draw (if instantiation is enabled)
   */
  drawArraysType(fillMode, verticesStart, verticesCount, instancesCount = 1) {
    this._currentIndexBuffer = null;
    this._draw(1, fillMode, verticesStart, verticesCount, instancesCount);
  }
  //------------------------------------------------------------------------------
  //                        Async Pipeline Pre-Warming
  //------------------------------------------------------------------------------
  /**
   * Asynchronously pre-creates one or more render pipelines so they are cached and ready
   * to use without any compilation hitch when first rendered.
   *
   * Call this for effects and meshes that are not yet rendering but will be soon
   * (e.g. streaming content, predicted material changes, pre-loading the next level).
   *
   * When passing an array, cache state is set once per entry and restored only at the end,
   * making batch pre-warming efficient.
   *
   * @param options - a single options object, an array of options objects,
   *                  or a raw GPURenderPipelineDescriptor for complete control
   * @returns an array of Promises for the pipelines that had cache misses (empty if all were cached).
   *          When a raw GPURenderPipelineDescriptor is provided, always returns a single-element array.
   */
  // eslint-disable-next-line no-restricted-syntax
  createRenderPipelineAsync(options) {
    if ("vertex" in options) {
      return [this._device.createRenderPipelineAsync(options)];
    }
    const entries = Array.isArray(options) ? options : [options];
    const promises = [];
    const cache = this._cacheRenderPipeline;
    for (const entry of entries) {
      cache.setColorFormat(entry.colorFormat ?? this._colorFormat);
      cache.setDepthStencilFormat(entry.depthStencilFormat ?? this._depthTextureFormat);
      const geometry = entry.mesh.geometry;
      if (!geometry) {
        throw new Error("WebGPUEngine.createRenderPipelineAsync: mesh has no geometry to derive vertex/index buffers from.");
      }
      cache.setBuffers(geometry.getVertexBuffers(), geometry.getIndexBuffer(), null);
      const alphaMode = entry.alphaMode ?? 0;
      if (alphaMode === 0) {
        cache.setAlphaBlendEnabled([false], 0);
      } else {
        const prevAlphaMode = this._alphaMode[0];
        this.setAlphaMode(alphaMode);
        cache.setAlphaBlendEnabled(this._alphaState._alphaBlend, this._alphaState._numTargetEnabled);
        cache.setAlphaBlendFactors(this._alphaState._blendFunctionParameters, this._alphaState._blendEquationParameters);
        this.setAlphaMode(prevAlphaMode);
      }
      cache.setDepthWriteEnabled(entry.depthWrite ?? true);
      cache.setDepthTestEnabled(entry.depthTest ?? true);
      cache.setDepthCompare(entry.depthCompare ?? 515);
      cache.setCullEnabled(entry.cullEnabled ?? true);
      cache.setCullFace(entry.cullFace ?? 1);
      cache.setFrontFace(entry.frontFace ?? 2);
      cache.setWriteMask(entry.writeMask ?? 15);
      cache.setStencilEnabled(entry.stencilEnabled ?? false);
      const fillMode = entry.fillMode ?? 0;
      const sampleCount = entry.sampleCount ?? this.currentSampleCount;
      const promise = cache.preWarmPipeline(fillMode, entry.effect, sampleCount, 0);
      if (promise) {
        promises.push(promise);
      }
    }
    cache.setColorFormat(this._colorFormat);
    cache.setDepthStencilFormat(this._depthTextureFormat);
    cache.setBuffers(this._currentVertexBuffers ?? null, this._currentIndexBuffer, this._currentOverrideVertexBuffers ?? null);
    cache.setDepthCullingState(this._depthCullingState.cull ?? false, this._depthCullingState.frontFace ?? 2, this._depthCullingState.cullFace ?? 1, this._depthCullingState.zOffset, this._depthCullingState.zOffsetUnits, this._depthCullingState.depthTest ?? true, this._depthCullingState.depthMask ?? true, this._depthCullingState.depthFunc);
    cache.setAlphaBlendEnabled(this._alphaState._alphaBlend, this._alphaState._numTargetEnabled);
    cache.setAlphaBlendFactors(this._alphaState._blendFunctionParameters, this._alphaState._blendEquationParameters);
    cache.setStencilEnabled(this._stencilStateComposer.enabled ?? false);
    cache.setWriteMask(this._colorWrite ? 15 : 0);
    return promises;
  }
  //------------------------------------------------------------------------------
  //                              Dispose
  //------------------------------------------------------------------------------
  /**
   * Dispose and release all associated resources
   */
  dispose() {
    this._isDisposed = true;
    this.hideLoadingUI?.();
    this._timestampQuery.dispose();
    this._mainTexture?.destroy();
    this._depthTexture?.destroy();
    this._textureHelper.destroyDeferredTextures();
    this._bufferManager.destroyDeferredBuffers();
    this._device.destroy();
    _CommonDispose(this, this._renderingCanvas);
    super.dispose();
    if (!EngineStore.Instances.some((engine) => engine.isWebGPU)) {
      WebGPUCacheRenderPipelineTree.ResetCache();
      WebGPUCacheBindGroups.ResetCache();
    }
  }
  //------------------------------------------------------------------------------
  //                              Misc
  //------------------------------------------------------------------------------
  /**
   * Gets the current render width
   * @param useScreen defines if screen size must be used (or the current render target if any)
   * @returns a number defining the current render width
   */
  getRenderWidth(useScreen = false) {
    if (!useScreen && this._currentRenderTarget) {
      return this._currentRenderTarget.width;
    }
    return this._renderingCanvas?.width ?? 0;
  }
  /**
   * Gets the current render height
   * @param useScreen defines if screen size must be used (or the current render target if any)
   * @returns a number defining the current render height
   */
  getRenderHeight(useScreen = false) {
    if (!useScreen && this._currentRenderTarget) {
      return this._currentRenderTarget.height;
    }
    return this._renderingCanvas?.height ?? 0;
  }
  //------------------------------------------------------------------------------
  //                              Errors
  //------------------------------------------------------------------------------
  /**
   * Get the current error code of the WebGPU context
   * @returns the error code
   */
  getError() {
    return 0;
  }
  //------------------------------------------------------------------------------
  //                              External Textures
  //------------------------------------------------------------------------------
  /**
   * Creates an external texture
   * @param video video element
   * @returns the external texture, or null if external textures are not supported by the engine
   */
  createExternalTexture(video) {
    const texture = new WebGPUExternalTexture(video);
    return texture;
  }
  /**
   * Sets an internal texture to the according uniform.
   * @param name The name of the uniform in the effect
   * @param texture The texture to apply
   */
  setExternalTexture(name2, texture) {
    if (!texture) {
      this._currentMaterialContext.setTexture(name2, null);
      return;
    }
    this._setInternalTexture(name2, texture);
  }
  //------------------------------------------------------------------------------
  //                              Samplers
  //------------------------------------------------------------------------------
  /**
   * Sets a texture sampler to the according uniform.
   * @param name The name of the uniform in the effect
   * @param sampler The sampler to apply
   */
  setTextureSampler(name2, sampler) {
    this._currentMaterialContext?.setSampler(name2, sampler);
  }
  //------------------------------------------------------------------------------
  //                              Storage Buffers
  //------------------------------------------------------------------------------
  /**
   * Creates a storage buffer
   * @param data the data for the storage buffer or the size of the buffer
   * @param creationFlags flags to use when creating the buffer (see undefined). The BUFFER_CREATIONFLAG_STORAGE flag will be automatically added
   * @param label defines the label of the buffer (for debug purpose)
   * @returns the new buffer
   */
  createStorageBuffer(data, creationFlags, label) {
    return this._createBuffer(data, creationFlags | 32, label);
  }
  /**
   * Clears a storage buffer to zeroes
   * @param storageBuffer the storage buffer to clear
   * @param byteOffset the byte offset to start clearing (optional)
   * @param byteLength the byte length to clear (optional)
   */
  clearStorageBuffer(storageBuffer, byteOffset, byteLength) {
    this._endCurrentRenderPass();
    this._renderEncoder.clearBuffer(storageBuffer.underlyingResource, byteOffset, byteLength);
  }
  /**
   * Updates a storage buffer
   * @param buffer the storage buffer to update
   * @param data the data used to update the storage buffer
   * @param byteOffset the byte offset of the data
   * @param byteLength the byte length of the data
   */
  updateStorageBuffer(buffer, data, byteOffset, byteLength) {
    const dataBuffer = buffer;
    if (byteOffset === void 0) {
      byteOffset = 0;
    }
    let view;
    if (byteLength === void 0) {
      if (data instanceof Array) {
        view = new Float32Array(data);
      } else if (ArrayBuffer.isView(data)) {
        view = data;
      } else {
        view = new Uint8Array(data);
      }
      byteLength = view.byteLength;
    } else {
      if (data instanceof Array) {
        view = new Float32Array(data);
      } else if (ArrayBuffer.isView(data)) {
        view = data;
      } else {
        view = new Uint8Array(data);
      }
    }
    this._bufferManager.setSubData(dataBuffer, byteOffset, view, 0, byteLength);
  }
  async _readFromGPUBuffer(gpuBuffer, size, buffer, noDelay) {
    return await new Promise((resolve, reject) => {
      const readFromBuffer = () => {
        gpuBuffer.mapAsync(1, 0, size).then(() => {
          const copyArrayBuffer = gpuBuffer.getMappedRange(0, size);
          let data = buffer;
          if (data === void 0) {
            data = new Uint8Array(size);
            data.set(new Uint8Array(copyArrayBuffer));
          } else {
            const ctor = data.constructor;
            data = new ctor(data.buffer);
            data.set(new ctor(copyArrayBuffer));
          }
          gpuBuffer.unmap();
          this._bufferManager.releaseBuffer(gpuBuffer);
          resolve(data);
        }, (reason) => {
          if (this.isDisposed) {
            resolve(new Uint8Array());
          } else {
            reject(reason);
          }
        });
      };
      if (noDelay) {
        this.flushFramebuffer();
        readFromBuffer();
      } else {
        this.onEndFrameObservable.addOnce(() => {
          readFromBuffer();
        });
      }
    });
  }
  /**
   * Read data from a storage buffer
   * @param storageBuffer The storage buffer to read from
   * @param offset The offset in the storage buffer to start reading from (default: 0)
   * @param size  The number of bytes to read from the storage buffer (default: capacity of the buffer)
   * @param buffer The buffer to write the data we have read from the storage buffer to (optional)
   * @param noDelay If true, a call to flushFramebuffer will be issued so that the data can be read back immediately and not in engine.onEndFrameObservable. This can speed up data retrieval, at the cost of a small perf penalty (default: false).
   * @returns If not undefined, returns the (promise) buffer (as provided by the 4th parameter) filled with the data, else it returns a (promise) Uint8Array with the data read from the storage buffer
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/promise-function-async
  readFromStorageBuffer(storageBuffer, offset, size, buffer, noDelay) {
    size = size || storageBuffer.capacity;
    const gpuBuffer = this._bufferManager.createRawBuffer(size, BufferUsage.MapRead | BufferUsage.CopyDst, void 0, "TempReadFromStorageBuffer");
    this._renderEncoder.copyBufferToBuffer(storageBuffer.underlyingResource, offset ?? 0, gpuBuffer, 0, size);
    return this._readFromGPUBuffer(gpuBuffer, size, buffer, noDelay);
  }
  /**
   * Read data from multiple storage buffers
   * @param storageBuffers The list of storage buffers to read from
   * @param offset The offset in the storage buffer to start reading from (default: 0). This is the same offset for all storage buffers!
   * @param size  The number of bytes to read from each storage buffer (default: capacity of the first buffer)
   * @param buffer The buffer to write the data we have read from the storage buffers to (optional). If provided, the buffer should be large enough to hold the data from all storage buffers!
   * @param noDelay If true, a call to flushFramebuffer will be issued so that the data can be read back immediately and not in engine.onEndFrameObservable. This can speed up data retrieval, at the cost of a small perf penalty (default: false).
   * @returns If not undefined, returns the (promise) buffer (as provided by the 4th parameter) filled with the data, else it returns a (promise) Uint8Array with the data read from the storage buffer
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/promise-function-async
  readFromMultipleStorageBuffers(storageBuffers, offset, size, buffer, noDelay) {
    size = size || storageBuffers[0].capacity;
    const gpuBuffer = this._bufferManager.createRawBuffer(size * storageBuffers.length, BufferUsage.MapRead | BufferUsage.CopyDst, void 0, "TempReadFromMultipleStorageBuffers");
    for (let i = 0; i < storageBuffers.length; i++) {
      this._renderEncoder.copyBufferToBuffer(storageBuffers[i].underlyingResource, offset ?? 0, gpuBuffer, i * size, size);
    }
    return this._readFromGPUBuffer(gpuBuffer, size * storageBuffers.length, buffer, noDelay);
  }
  /**
   * Sets a storage buffer in the shader
   * @param name Defines the name of the storage buffer as defined in the shader
   * @param buffer Defines the value to give to the uniform
   */
  setStorageBuffer(name2, buffer) {
    this._currentDrawContext?.setBuffer(name2, buffer?.getBuffer() ?? null);
  }
}
WebGPUEngine._GlslangDefaultOptions = {
  jsPath: `${Tools._DefaultCdnUrl}/glslang/glslang.js`,
  wasmPath: `${Tools._DefaultCdnUrl}/glslang/glslang.wasm`
};
WebGPUEngine._InstanceId = 0;
const name$1 = "clearQuadVertexShader";
const shader$1 = `uniform depthValue: f32;const pos=array(
vec2f(-1.0,1.0),
vec2f(1.0,1.0),
vec2f(-1.0,-1.0),
vec2f(1.0,-1.0)
);
#define CUSTOM_VERTEX_DEFINITIONS
@vertex
fn main(input : VertexInputs)->FragmentInputs {
#define CUSTOM_VERTEX_MAIN_BEGIN
vertexOutputs.position=vec4f(pos[vertexInputs.vertexIndex],uniforms.depthValue,1.0);
#define CUSTOM_VERTEX_MAIN_END
}
`;
if (!ShaderStore.ShadersStoreWGSL[name$1]) {
  ShaderStore.ShadersStoreWGSL[name$1] = shader$1;
}
const clearQuadVertexShaderWGSL = { name: name$1, shader: shader$1 };
const clearQuad_vertex = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  clearQuadVertexShaderWGSL
}, Symbol.toStringTag, { value: "Module" }));
const name = "clearQuadPixelShader";
const shader = `uniform color: vec4f;@fragment
fn main(input: FragmentInputs)->FragmentOutputs {fragmentOutputs.color=uniforms.color;}
`;
if (!ShaderStore.ShadersStoreWGSL[name]) {
  ShaderStore.ShadersStoreWGSL[name] = shader;
}
const clearQuadPixelShaderWGSL = { name, shader };
const clearQuad_fragment = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  clearQuadPixelShaderWGSL
}, Symbol.toStringTag, { value: "Module" }));
let _Registered$b = false;
function RegisterBufferAlign() {
  if (_Registered$b) {
    return;
  }
  _Registered$b = true;
  const IsLittleEndian = (() => {
    const array = new Uint8Array(4);
    const view = new Uint32Array(array.buffer);
    return !!((view[0] = 1) & array[0]);
  })();
  Object.defineProperty(VertexBuffer.prototype, "effectiveByteStride", {
    get: function() {
      return this._alignedBuffer && this._alignedBuffer.byteStride || this.byteStride;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(VertexBuffer.prototype, "effectiveByteOffset", {
    get: function() {
      return this._alignedBuffer ? 0 : this.byteOffset;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(VertexBuffer.prototype, "effectiveBuffer", {
    get: function() {
      return this._alignedBuffer && this._alignedBuffer.getBuffer() || this._buffer.getBuffer();
    },
    enumerable: true,
    configurable: true
  });
  VertexBuffer.prototype._rebuild = function() {
    this._buffer?._rebuild();
    this._alignedBuffer?._rebuild();
  };
  VertexBuffer.prototype.dispose = function() {
    if (this._ownsBuffer) {
      this._buffer.dispose();
    }
    this._alignedBuffer?.dispose();
    this._alignedBuffer = void 0;
    this._isDisposed = true;
  };
  VertexBuffer.prototype.getWrapperBuffer = function() {
    return this._alignedBuffer || this._buffer;
  };
  VertexBuffer.prototype._alignBuffer = function() {
    const data = this._buffer.getData();
    if (!this.engine._features.forceVertexBufferStrideAndOffsetMultiple4Bytes || this.byteStride % 4 === 0 && this.byteOffset % 4 === 0 || !data) {
      return;
    }
    const typeByteLength = GetTypeByteLength(this.type);
    const alignedByteStride = this.byteStride + 3 & -4;
    const alignedSize = alignedByteStride / typeByteLength;
    const totalVertices = this._maxVerticesCount;
    const totalByteLength = totalVertices * alignedByteStride;
    const totalLength = totalByteLength / typeByteLength;
    let sourceData;
    if (Array.isArray(data)) {
      const sourceDataAsFloat = new Float32Array(data);
      sourceData = new DataView(sourceDataAsFloat.buffer, sourceDataAsFloat.byteOffset, sourceDataAsFloat.byteLength);
    } else if (ArrayBuffer.isView(data)) {
      sourceData = new DataView(data.buffer, data.byteOffset, data.byteLength);
    } else {
      sourceData = new DataView(data, 0, data.byteLength);
    }
    let alignedData;
    if (this.type === VertexBuffer.BYTE) {
      alignedData = new Int8Array(totalLength);
    } else if (this.type === VertexBuffer.UNSIGNED_BYTE) {
      alignedData = new Uint8Array(totalLength);
    } else if (this.type === VertexBuffer.SHORT) {
      alignedData = new Int16Array(totalLength);
    } else if (this.type === VertexBuffer.UNSIGNED_SHORT) {
      alignedData = new Uint16Array(totalLength);
    } else if (this.type === VertexBuffer.HALF_FLOAT) {
      alignedData = new Uint16Array(totalLength);
    } else if (this.type === VertexBuffer.INT) {
      alignedData = new Int32Array(totalLength);
    } else if (this.type === VertexBuffer.UNSIGNED_INT) {
      alignedData = new Uint32Array(totalLength);
    } else {
      alignedData = new Float32Array(totalLength);
    }
    const numComponents = this.getSize();
    let sourceOffset = this.byteOffset;
    for (let i = 0; i < totalVertices; ++i) {
      for (let j = 0; j < numComponents; ++j) {
        switch (this.type) {
          case VertexBuffer.BYTE:
            alignedData[i * alignedSize + j] = sourceData.getInt8(sourceOffset + j);
            break;
          case VertexBuffer.UNSIGNED_BYTE:
            alignedData[i * alignedSize + j] = sourceData.getUint8(sourceOffset + j);
            break;
          case VertexBuffer.SHORT:
            alignedData[i * alignedSize + j] = sourceData.getInt16(sourceOffset + j * 2, IsLittleEndian);
            break;
          case VertexBuffer.UNSIGNED_SHORT:
            alignedData[i * alignedSize + j] = sourceData.getUint16(sourceOffset + j * 2, IsLittleEndian);
            break;
          case VertexBuffer.HALF_FLOAT:
            alignedData[i * alignedSize + j] = sourceData.getUint16(sourceOffset + j * 2, IsLittleEndian);
            break;
          case VertexBuffer.INT:
            alignedData[i * alignedSize + j] = sourceData.getInt32(sourceOffset + j * 4, IsLittleEndian);
            break;
          case VertexBuffer.UNSIGNED_INT:
            alignedData[i * alignedSize + j] = sourceData.getUint32(sourceOffset + j * 4, IsLittleEndian);
            break;
          case VertexBuffer.FLOAT:
            alignedData[i * alignedSize + j] = sourceData.getFloat32(sourceOffset + j * 4, IsLittleEndian);
            break;
        }
      }
      sourceOffset += this.byteStride;
    }
    this._alignedBuffer?.dispose();
    this._alignedBuffer = new Buffer(this.engine, alignedData, false, alignedByteStride, false, this.getIsInstanced(), true, this.instanceDivisor, (this._label ?? "VertexBuffer") + "_aligned");
  };
}
RegisterBufferAlign();
const Instances = [];
new Observable();
class AudioEngineV2 {
  /**
   * The list of v2 audio engines that have been created and not yet disposed.
   * - Engines are added on construction and removed on {@link AudioEngineV2.dispose}.
   */
  static get Instances() {
    return Instances;
  }
  /**
   * Observable that notifies when a top-level audio node (sound, sound source, bus, or main bus) is added to this engine.
   */
  get onNodeAddedObservable() {
    return this._onNodeAddedObservable;
  }
  /**
   * Observable that notifies when a top-level audio node (sound, sound source, bus, or main bus) is removed from this engine.
   */
  get onNodeRemovedObservable() {
    return this._onNodeRemovedObservable;
  }
  /**
   * Observable that notifies when this engine is disposed.
   * - Fires from {@link AudioEngineV2.dispose} after the engine has been removed from {@link AudioEngineV2.Instances}.
   */
  get onDisposeObservable() {
    return this._onDisposeObservable;
  }
  constructor(options) {
    this._mainBuses = /* @__PURE__ */ new Set();
    this._sounds = /* @__PURE__ */ new Set();
    this._soundsArray = null;
    this._nodes = /* @__PURE__ */ new Set();
    this._defaultMainBus = null;
    this._parameterRampDuration = 0.01;
    this._onNodeAddedObservable = new Observable();
    this._onNodeRemovedObservable = new Observable();
    this._onDisposeObservable = new Observable();
    Instances.push(this);
    if (typeof options.parameterRampDuration === "number") {
      this.parameterRampDuration = options.parameterRampDuration;
    }
  }
  /**
   * The default main bus that will be used for audio buses and sounds if their `outBus` option is not set.
   * @see {@link IAudioBusOptions.outBus}
   * @see {@link IAbstractSoundOptions.outBus}
   */
  get defaultMainBus() {
    if (this._mainBuses.size === 0) {
      return null;
    }
    if (!this._defaultMainBus) {
      this._defaultMainBus = Array.from(this._mainBuses)[0];
    }
    return this._defaultMainBus;
  }
  /**
   * The smoothing duration to use when changing audio parameters, in seconds. Defaults to `0.01` (10 milliseconds).
   */
  get parameterRampDuration() {
    return this._parameterRampDuration;
  }
  set parameterRampDuration(value) {
    this._parameterRampDuration = Math.max(0, value);
  }
  /**
   * The list of static and streaming sounds created by the audio engine.
   */
  get sounds() {
    if (!this._soundsArray) {
      this._soundsArray = Array.from(this._sounds);
    }
    return this._soundsArray;
  }
  /**
   * The list of top-level audio nodes (sounds, sound sources, buses, main buses) owned by the audio engine.
   */
  get nodes() {
    return this._nodes;
  }
  /**
   * Releases associated resources.
   */
  dispose() {
    if (Instances.includes(this)) {
      Instances.splice(Instances.indexOf(this), 1);
    }
    const nodeIt = this._nodes.values();
    for (let next = nodeIt.next(); !next.done; next = nodeIt.next()) {
      next.value.dispose();
    }
    this._mainBuses.clear();
    this._nodes.clear();
    this._sounds.clear();
    this._disposeSoundsArray();
    this._defaultMainBus = null;
    this._onDisposeObservable.notifyObservers(this);
    this._onDisposeObservable.clear();
    this._onNodeAddedObservable.clear();
    this._onNodeRemovedObservable.clear();
  }
  /**
   * Unlocks the audio engine if it is locked.
   * - Note that the returned promise may already be resolved if the audio engine is already unlocked.
   * @returns A promise that is resolved when the audio engine is unlocked.
   */
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  unlockAsync() {
    return this.resumeAsync();
  }
  _addMainBus(mainBus) {
    this._mainBuses.add(mainBus);
    this._addNode(mainBus);
  }
  _removeMainBus(mainBus) {
    this._mainBuses.delete(mainBus);
    this._defaultMainBus = null;
    this._removeNode(mainBus);
  }
  _addNode(node) {
    this._nodes.add(node);
    this._onNodeAddedObservable.notifyObservers(node);
  }
  _removeNode(node) {
    this._nodes.delete(node);
    this._onNodeRemovedObservable.notifyObservers(node);
  }
  _addSound(sound) {
    this._disposeSoundsArray();
    this._sounds.add(sound);
    this._addNode(sound);
  }
  _removeSound(sound) {
    this._disposeSoundsArray();
    this._sounds.delete(sound);
    this._removeNode(sound);
  }
  /**
   * Called when any sound's playback state changes (started, stopped, paused, resumed).
   * Override in platform-specific implementations to react to sound playback state changes.
   * @internal
   */
  _onSoundPlaybackStateChanged() {
  }
  _disposeSoundsArray() {
    if (this._soundsArray) {
      this._soundsArray.length = 0;
      this._soundsArray = null;
    }
  }
}
const _SpatialAudioListenerDefaults = {
  position: Vector3.Zero(),
  rotation: Vector3.Zero(),
  rotationQuaternion: new Quaternion()
};
function _HasSpatialAudioListenerOptions(options) {
  return options.listenerEnabled || options.listenerMinUpdateTime !== void 0 || options.listenerPosition !== void 0 || options.listenerRotation !== void 0 || options.listenerRotationQuaternion !== void 0;
}
class AbstractSpatialAudioListener {
}
class _SpatialAudioListener extends AbstractSpatialAudioListener {
  constructor() {
    super();
    this._attacherComponent = null;
    this._attacherComponent = new _SpatialAudioAttacherComponent(this);
  }
  /** @internal */
  get isAttached() {
    return this._attacherComponent !== null && this._attacherComponent.isAttached;
  }
  /** @internal */
  get attachedNode() {
    return this._attacherComponent?.sceneNode ?? null;
  }
  /**
   * Attaches to a scene node.
   *
   * Detaches automatically before attaching to the given scene node.
   * If `sceneNode` is `null` it is the same as calling `detach()`.
   *
   * @param sceneNode The scene node to attach to, or `null` to detach.
   * @param useBoundingBox Whether to use the bounding box of the node for positioning. Defaults to `false`.
   * @param attachmentType Whether to attach to the node's position and/or rotation. Defaults to `PositionAndRotation`.
   */
  attach(sceneNode, useBoundingBox = false, attachmentType = 3) {
    if (!this._attacherComponent) {
      this._attacherComponent = new _SpatialAudioAttacherComponent(this);
    }
    this._attacherComponent.attach(sceneNode, useBoundingBox, attachmentType);
  }
  /**
   * Detaches from the scene node if attached.
   */
  detach() {
    this._attacherComponent?.detach();
  }
  /** @internal */
  dispose() {
    this._attacherComponent?.dispose();
    this._attacherComponent = null;
  }
  /** @internal */
  setOptions(options) {
    if (options.listenerMinUpdateTime !== void 0) {
      this.minUpdateTime = options.listenerMinUpdateTime;
    }
    if (options.listenerPosition) {
      this.position = options.listenerPosition.clone();
    }
    if (options.listenerRotationQuaternion) {
      this.rotationQuaternion = options.listenerRotationQuaternion.clone();
    } else if (options.listenerRotation) {
      this.rotation = options.listenerRotation.clone();
    } else {
      this.rotationQuaternion = _SpatialAudioListenerDefaults.rotationQuaternion.clone();
    }
    this.update();
  }
}
const TmpMatrix = Matrix.Zero();
const TmpQuaternion = new Quaternion();
const TmpVector1 = Vector3.Zero();
const TmpVector2 = Vector3.Zero();
function _CreateSpatialAudioListener(engine, autoUpdate, minUpdateTime) {
  const listener = engine._audioContext.listener;
  if (listener.forwardX && listener.forwardY && listener.forwardZ && listener.positionX && listener.positionY && listener.positionZ && listener.upX && listener.upY && listener.upZ) {
    return new _SpatialWebAudioListener(engine, autoUpdate, minUpdateTime);
  } else {
    return new _SpatialWebAudioListenerFallback(engine, autoUpdate, minUpdateTime);
  }
}
class _AbstractSpatialWebAudioListener extends _SpatialAudioListener {
  /** @internal */
  constructor(engine, autoUpdate, minUpdateTime) {
    super();
    this._lastPosition = Vector3.Zero();
    this._lastRotation = Vector3.Zero();
    this._lastRotationQuaternion = new Quaternion();
    this.position = Vector3.Zero();
    this.rotation = Vector3.Zero();
    this.rotationQuaternion = new Quaternion();
    this._listener = engine._audioContext.listener;
    this.engine = engine;
    this._updaterComponent = new _SpatialWebAudioUpdaterComponent(this, autoUpdate, minUpdateTime);
  }
  /** @internal */
  dispose() {
    super.dispose();
    this._updaterComponent.dispose();
    this._updaterComponent = null;
  }
  /** @internal */
  get minUpdateTime() {
    return this._updaterComponent.minUpdateTime;
  }
  /** @internal */
  set minUpdateTime(value) {
    this._updaterComponent.minUpdateTime = value;
  }
  /** @internal */
  update() {
    if (this.isAttached) {
      this._attacherComponent?.update();
    } else {
      this._updatePosition();
      this._updateRotation();
    }
  }
  _updatePosition() {
    if (this._lastPosition.equalsWithEpsilon(this.position)) {
      return;
    }
    this._setWebAudioPosition(this.position);
    this._lastPosition.copyFrom(this.position);
  }
  _updateRotation() {
    if (!this._lastRotationQuaternion.equalsWithEpsilon(this.rotationQuaternion)) {
      TmpQuaternion.copyFrom(this.rotationQuaternion);
      this._lastRotationQuaternion.copyFrom(this.rotationQuaternion);
    } else if (!this._lastRotation.equalsWithEpsilon(this.rotation)) {
      Quaternion.FromEulerAnglesToRef(this.rotation.x, this.rotation.y, this.rotation.z, TmpQuaternion);
      this._lastRotation.copyFrom(this.rotation);
    } else {
      return;
    }
    Matrix.FromQuaternionToRef(TmpQuaternion, TmpMatrix);
    Vector3.TransformNormalToRef(Vector3.RightHandedForwardReadOnly, TmpMatrix, TmpVector1);
    Vector3.TransformNormalToRef(Vector3.Up(), TmpMatrix, TmpVector2);
    this._setWebAudioOrientation(TmpVector1, TmpVector2);
  }
}
class _SpatialWebAudioListener extends _AbstractSpatialWebAudioListener {
  constructor(engine, autoUpdate, minUpdateTime) {
    super(engine, autoUpdate, minUpdateTime);
    const listener = engine._audioContext.listener;
    this._forwardX = new _WebAudioParameterComponent(engine, listener.forwardX);
    this._forwardY = new _WebAudioParameterComponent(engine, listener.forwardY);
    this._forwardZ = new _WebAudioParameterComponent(engine, listener.forwardZ);
    this._positionX = new _WebAudioParameterComponent(engine, listener.positionX);
    this._positionY = new _WebAudioParameterComponent(engine, listener.positionY);
    this._positionZ = new _WebAudioParameterComponent(engine, listener.positionZ);
    this._upX = new _WebAudioParameterComponent(engine, listener.upX);
    this._upY = new _WebAudioParameterComponent(engine, listener.upY);
    this._upZ = new _WebAudioParameterComponent(engine, listener.upZ);
  }
  _setWebAudioPosition(position) {
    if (this.isAttached && (this._positionX.isRamping || this._positionY.isRamping || this._positionZ.isRamping)) {
      return;
    }
    this._positionX.targetValue = position.x;
    this._positionY.targetValue = position.y;
    this._positionZ.targetValue = position.z;
  }
  _setWebAudioOrientation(forward, up) {
    if (this.isAttached && (this._forwardX.isRamping || this._forwardY.isRamping || this._forwardZ.isRamping || this._upX.isRamping || this._upY.isRamping || this._upZ.isRamping)) {
      return;
    }
    this._forwardX.targetValue = forward.x;
    this._forwardY.targetValue = forward.y;
    this._forwardZ.targetValue = forward.z;
    this._upX.targetValue = up.x;
    this._upY.targetValue = up.y;
    this._upZ.targetValue = up.z;
  }
}
class _SpatialWebAudioListenerFallback extends _AbstractSpatialWebAudioListener {
  _setWebAudioPosition(position) {
    this._listener.setPosition(position.x, position.y, position.z);
  }
  _setWebAudioOrientation(forward, up) {
    this._listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
  }
}
class _MainAudioOut extends AbstractAudioNode {
  constructor(engine) {
    super(
      engine,
      1
      /* AudioNodeType.HAS_INPUTS */
    );
  }
}
class _WebAudioMainOut extends _MainAudioOut {
  /** @internal */
  constructor(engine) {
    super(engine);
    this._setGainNode(new GainNode(engine._audioContext));
  }
  /** @internal */
  dispose() {
    super.dispose();
    this._volume.dispose();
    this._gainNode.disconnect();
    this._destinationNode.disconnect();
  }
  /** @internal */
  get _inNode() {
    return this._gainNode;
  }
  set _inNode(value) {
    if (this._gainNode === value) {
      return;
    }
    this._setGainNode(value);
  }
  /** @internal */
  get volume() {
    return this._volume.targetValue;
  }
  /** @internal */
  set volume(value) {
    this._volume.targetValue = value;
  }
  get _destinationNode() {
    return this.engine._audioDestination;
  }
  /** @internal */
  getClassName() {
    return "_WebAudioMainOut";
  }
  /** @internal */
  setVolume(value, options = null) {
    this._volume.setTargetValue(value, options);
  }
  _setGainNode(gainNode) {
    if (this._gainNode === gainNode) {
      return;
    }
    this._gainNode?.disconnect();
    gainNode.connect(this._destinationNode);
    this._volume = new _WebAudioParameterComponent(this.engine, gainNode.gain);
    this._gainNode = gainNode;
  }
}
class _WebAudioUnmuteUI {
  /** @internal */
  constructor(engine, parentElement) {
    this._button = null;
    this._enabled = true;
    this._style = null;
    this._onStateChanged = () => {
      if (!this._button) {
        return;
      }
      if (this._engine.state === "running") {
        this._hide();
      } else {
        this._show();
      }
    };
    this._engine = engine;
    const parent = parentElement || EngineStore.LastCreatedEngine?.getInputElement()?.parentElement || document.body;
    const top = (parent?.offsetTop || 0) + 20;
    this._style = document.createElement("style");
    this._style.appendChild(document.createTextNode(`.babylonUnmute{position:absolute;top:${top}px;margin-left:20px;height:40px;width:60px;background-color:rgba(51,51,51,0.7);background-image:url("data:image/svg+xml;charset=UTF-8,%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2239%22%20height%3D%2232%22%20viewBox%3D%220%200%2039%2032%22%3E%3Cpath%20fill%3D%22white%22%20d%3D%22M9.625%2018.938l-0.031%200.016h-4.953q-0.016%200-0.031-0.016v-12.453q0-0.016%200.031-0.016h4.953q0.031%200%200.031%200.016v12.453zM12.125%207.688l8.719-8.703v27.453l-8.719-8.719-0.016-0.047v-9.938zM23.359%207.875l1.406-1.406%204.219%204.203%204.203-4.203%201.422%201.406-4.219%204.219%204.219%204.203-1.484%201.359-4.141-4.156-4.219%204.219-1.406-1.422%204.219-4.203z%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E");background-size:80%;background-repeat:no-repeat;background-position:center;background-position-y:4px;border:none;outline:none;transition:transform 0.125s ease-out;cursor:pointer;z-index:9999;}.babylonUnmute:hover{transform:scale(1.05)}`));
    document.head.appendChild(this._style);
    this._button = document.createElement("button");
    this._button.className = "babylonUnmute";
    this._button.id = "babylonUnmuteButton";
    this._button.addEventListener("click", () => {
      this._engine.unlockAsync();
    });
    parent.appendChild(this._button);
    this._engine.stateChangedObservable.add(this._onStateChanged);
  }
  /** @internal */
  dispose() {
    this._button?.remove();
    this._button = null;
    this._style?.remove();
    this._style = null;
    this._engine.stateChangedObservable.removeCallback(this._onStateChanged);
  }
  /** @internal */
  get enabled() {
    return this._enabled;
  }
  set enabled(value) {
    this._enabled = value;
    if (value) {
      if (this._engine.state !== "running") {
        this._show();
      }
    } else {
      this._hide();
    }
  }
  _show() {
    if (!this._button || !this._enabled) {
      return;
    }
    this._button.style.display = "block";
  }
  _hide() {
    if (!this._button) {
      return;
    }
    this._button.style.display = "none";
  }
}
const FormatMimeTypes = {
  aac: "audio/aac",
  ac3: "audio/ac3",
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp3: 'audio/mpeg; codecs="mp3"',
  mp4: "audio/mp4",
  ogg: 'audio/ogg; codecs="vorbis"',
  wav: "audio/wav",
  webm: 'audio/webm; codecs="vorbis"'
};
class _WebAudioEngine extends AudioEngineV2 {
  /** @internal */
  constructor(options = {}) {
    super(options);
    this._audioContextStarted = false;
    this._destinationNode = null;
    this._invalidFormats = /* @__PURE__ */ new Set();
    this._isUpdating = false;
    this._listener = null;
    this._listenerAutoUpdate = true;
    this._listenerMinUpdateTime = 0;
    this._pauseCalled = false;
    this._resumeOnInteraction = true;
    this._resumeOnPause = true;
    this._resumeOnPauseRetryInterval = 1e3;
    this._resumeOnPauseTimerId = null;
    this._resumePromise = null;
    this._silentHtmlAudio = null;
    this._unmuteUI = null;
    this._updateObservable = null;
    this._validFormats = /* @__PURE__ */ new Set();
    this._volume = 1;
    this._isUsingOfflineAudioContext = false;
    this.isReadyPromise = new Promise((resolve) => {
      this._resolveIsReadyPromise = resolve;
    });
    this.stateChangedObservable = new Observable();
    this.userGestureObservable = new Observable();
    this._initAudioContextAsync = async () => {
      this._audioContext.addEventListener("statechange", this._onAudioContextStateChange);
      this._mainOut = new _WebAudioMainOut(this);
      this._mainOut.volume = this._volume;
      await this.createMainBusAsync("default");
    };
    this._onAudioContextStateChange = () => {
      if (this.state === "running") {
        clearInterval(this._resumeOnPauseTimerId);
        this._audioContextStarted = true;
        this._resumePromise = null;
      }
      if (this.state === "suspended" || this.state === "interrupted") {
        if (this._audioContextStarted && this._resumeOnPause && !this._pauseCalled) {
          clearInterval(this._resumeOnPauseTimerId);
          this._resumeOnPauseTimerId = setInterval(() => {
            this.resumeAsync();
          }, this._resumeOnPauseRetryInterval);
        }
      }
      this.stateChangedObservable.notifyObservers(this.state);
    };
    this._onUserGestureAsync = async () => {
      if (this._resumeOnInteraction) {
        await this._audioContext.resume();
      }
      if (!this._disableIOSRingerSwitchWorkaround && !this._silentHtmlAudio) {
        this._silentHtmlAudio = document.createElement("audio");
        const audio = this._silentHtmlAudio;
        audio.controls = false;
        audio.preload = "auto";
        audio.loop = true;
        audio.src = "data:audio/wav;base64,UklGRjAAAABXQVZFZm10IBAAAAABAAEAgLsAAAB3AQACABAAZGF0YQwAAAAAAAEA/v8CAP//AQA=";
        audio.play().then(() => audio.pause(), () => {
        });
      }
      this.userGestureObservable.notifyObservers();
    };
    this._startUpdating = () => {
      if (this._isUpdating) {
        return;
      }
      this._isUpdating = true;
      if (this.state === "running") {
        this._update();
      } else {
        const callback = () => {
          if (this.state === "running") {
            this._update();
            this.stateChangedObservable.removeCallback(callback);
          }
        };
        this.stateChangedObservable.add(callback);
      }
    };
    this._update = () => {
      if (this._updateObservable?.hasObservers()) {
        this._updateObservable.notifyObservers();
        requestAnimationFrame(this._update);
      } else {
        this._isUpdating = false;
      }
    };
    if (typeof options.listenerAutoUpdate === "boolean") {
      this._listenerAutoUpdate = options.listenerAutoUpdate;
    }
    if (typeof options.listenerMinUpdateTime === "number") {
      this._listenerMinUpdateTime = options.listenerMinUpdateTime;
    }
    this._disableIOSRingerSwitchWorkaround = options.disableIOSRingerSwitchWorkaround ?? false;
    this._volume = options.volume ?? 1;
    if (options.audioContext) {
      this._isUsingOfflineAudioContext = options.audioContext instanceof OfflineAudioContext;
      this._audioContext = options.audioContext;
    } else {
      this._audioContext = new AudioContext();
    }
    if (!options.disableDefaultUI) {
      this._unmuteUI = new _WebAudioUnmuteUI(this, options.defaultUIParentElement);
    }
  }
  /** @internal */
  async _initAsync(options) {
    this._resumeOnInteraction = typeof options.resumeOnInteraction === "boolean" ? options.resumeOnInteraction : true;
    this._resumeOnPause = typeof options.resumeOnPause === "boolean" ? options.resumeOnPause : true;
    this._resumeOnPauseRetryInterval = options.resumeOnPauseRetryInterval ?? 1e3;
    document.addEventListener("click", this._onUserGestureAsync);
    await this._initAudioContextAsync();
    if (_HasSpatialAudioListenerOptions(options)) {
      this._listener = _CreateSpatialAudioListener(this, this._listenerAutoUpdate, this._listenerMinUpdateTime);
      this._listener.setOptions(options);
    }
    this._resolveIsReadyPromise();
  }
  /** @internal */
  get currentTime() {
    return this._audioContext.currentTime ?? 0;
  }
  /** @internal */
  get _inNode() {
    return this._audioContext.destination;
  }
  /** @internal */
  get mainOut() {
    return this._mainOut;
  }
  /** @internal */
  get listener() {
    return this._listener ?? (this._listener = _CreateSpatialAudioListener(this, this._listenerAutoUpdate, this._listenerMinUpdateTime));
  }
  /** @internal */
  get state() {
    return this._isUsingOfflineAudioContext ? "running" : this._audioContext.state;
  }
  /** @internal */
  get volume() {
    return this._volume;
  }
  /** @internal */
  set volume(value) {
    if (this._volume === value) {
      return;
    }
    this._volume = value;
    if (this._mainOut) {
      this._mainOut.volume = value;
    }
  }
  /**
   * This property should only be used by the legacy audio engine.
   * @internal
   * */
  get _audioDestination() {
    return this._destinationNode ? this._destinationNode : this._destinationNode = this._audioContext.destination;
  }
  set _audioDestination(value) {
    this._destinationNode = value;
  }
  /**
   * This property should only be used by the legacy audio engine.
   * @internal
   */
  get _unmuteUIEnabled() {
    return this._unmuteUI ? this._unmuteUI.enabled : false;
  }
  set _unmuteUIEnabled(value) {
    if (this._unmuteUI) {
      this._unmuteUI.enabled = value;
    }
  }
  /** @internal */
  async createBusAsync(name2, options = {}) {
    const module = await __vitePreload(() => import("./webAudioBus-JXKslokA.js"), true ? __vite__mapDeps([0,1,2,3,4,5]) : void 0);
    const bus = new module._WebAudioBus(name2, this, options);
    await bus._initAsync(options);
    return bus;
  }
  /** @internal */
  async createMainBusAsync(name2, options = {}) {
    const module = await __vitePreload(() => import("./webAudioMainBus-BlEs7RqL.js"), true ? __vite__mapDeps([6,1,2,3,4]) : void 0);
    const bus = new module._WebAudioMainBus(name2, this);
    await bus._initAsync(options);
    return bus;
  }
  /** @internal */
  async createMicrophoneSoundSourceAsync(name2, options) {
    let mediaStream;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      throw new Error("Unable to access microphone: " + e, { cause: e });
    }
    return await this.createSoundSourceAsync(name2, new MediaStreamAudioSourceNode(this._audioContext, { mediaStream }), {
      outBusAutoDefault: false,
      mediaStreamSinkEnabled: false,
      stopMediaStreamTracksOnDispose: true,
      ...options
    });
  }
  /** @internal */
  async createSoundAsync(name2, source, options = {}) {
    const module = await __vitePreload(() => import("./webAudioStaticSound-B3zBHiUS.js"), true ? __vite__mapDeps([7,8,9,2,3,4,5]) : void 0);
    const sound = new module._WebAudioStaticSound(name2, this, options);
    await sound._initAsync(source, options);
    return sound;
  }
  /** @internal */
  async createSoundBufferAsync(source, options = {}) {
    const module = await __vitePreload(() => import("./webAudioStaticSound-B3zBHiUS.js"), true ? __vite__mapDeps([7,8,9,2,3,4,5]) : void 0);
    const soundBuffer = new module._WebAudioStaticSoundBuffer(this);
    await soundBuffer._initAsync(source, options);
    return soundBuffer;
  }
  /** @internal */
  async createSoundSourceAsync(name2, source, options = {}) {
    const module = await __vitePreload(() => import("./webAudioSoundSource-DNwA1I76.js"), true ? __vite__mapDeps([10,9,2,3,4,5]) : void 0);
    const soundSource = new module._WebAudioSoundSource(name2, source, this, options);
    await soundSource._initAsync(options);
    return soundSource;
  }
  /** @internal */
  async createStreamingSoundAsync(name2, source, options = {}) {
    const module = await __vitePreload(() => import("./webAudioStreamingSound-DwzrwDYj.js"), true ? __vite__mapDeps([11,4,8,9,2,3,5]) : void 0);
    const sound = new module._WebAudioStreamingSound(name2, this, options);
    await sound._initAsync(source, options);
    return sound;
  }
  /** @internal */
  dispose() {
    super.dispose();
    this._listener?.dispose();
    this._listener = null;
    if (this._audioContext.state !== "closed" && !this._isUsingOfflineAudioContext) {
      this._audioContext.close();
    }
    document.removeEventListener("click", this._onUserGestureAsync);
    this._audioContext.removeEventListener("statechange", this._onAudioContextStateChange);
    this._silentHtmlAudio?.remove();
    this._updateObservable?.clear();
    this._updateObservable = null;
    this._unmuteUI?.dispose();
    this._unmuteUI = null;
    this.stateChangedObservable.clear();
  }
  /** @internal */
  flagInvalidFormat(format) {
    this._invalidFormats.add(format);
  }
  /** @internal */
  isFormatValid(format) {
    if (this._validFormats.has(format)) {
      return true;
    }
    if (this._invalidFormats.has(format)) {
      return false;
    }
    const mimeType = FormatMimeTypes[format];
    if (mimeType === void 0) {
      return false;
    }
    const audio = new Audio();
    if (audio.canPlayType(mimeType) === "") {
      this._invalidFormats.add(format);
      return false;
    }
    this._validFormats.add(format);
    return true;
  }
  /** @internal */
  async pauseAsync() {
    await this._audioContext.suspend();
    this._pauseCalled = true;
  }
  /** @internal */
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  resumeAsync() {
    this._pauseCalled = false;
    if (this._resumePromise) {
      return this._resumePromise;
    }
    this._resumePromise = this._audioContext.resume();
    this.stateChangedObservable.notifyObservers(this.state);
    return this._resumePromise;
  }
  /** @internal */
  setVolume(value, options = null) {
    if (this._mainOut) {
      this._mainOut.setVolume(value, options);
    } else {
      throw new Error("Main output not initialized yet.");
    }
  }
  /** @internal */
  _addMainBus(mainBus) {
    super._addMainBus(mainBus);
  }
  /** @internal */
  _removeMainBus(mainBus) {
    super._removeMainBus(mainBus);
  }
  /** @internal */
  _addNode(node) {
    super._addNode(node);
  }
  /** @internal */
  _removeNode(node) {
    super._removeNode(node);
  }
  /** @internal */
  _addSound(sound) {
    super._addSound(sound);
  }
  /** @internal */
  _removeSound(sound) {
    super._removeSound(sound);
  }
  /** @internal */
  _onSoundPlaybackStateChanged() {
    if (!this._silentHtmlAudio) {
      return;
    }
    const hasActiveSounds = this.sounds.some(
      (s) => s.state === 3 || s.state === 2 || s.state === 0
      /* SoundState.Stopping */
    );
    if (hasActiveSounds && this._silentHtmlAudio.paused) {
      void this._silentHtmlAudio.play().catch(() => {
      });
    } else if (!hasActiveSounds && !this._silentHtmlAudio.paused) {
      this._silentHtmlAudio.pause();
    }
  }
  /** @internal */
  _addUpdateObserver(callback) {
    if (!this._updateObservable) {
      this._updateObservable = new Observable();
    }
    this._updateObservable.add(callback);
    this._startUpdating();
  }
  _removeUpdateObserver(callback) {
    if (this._updateObservable) {
      this._updateObservable.removeCallback(callback);
    }
  }
}
class AudioEngine {
  /**
   * The master gain node defines the global audio volume of your audio engine.
   */
  get masterGain() {
    return this._masterGain;
  }
  set masterGain(value) {
    this._masterGain = this._v2.mainOut._inNode = value;
  }
  /**
   * Defines if the audio engine relies on a custom unlocked button.
   * In this case, the embedded button will not be displayed.
   */
  get useCustomUnlockedButton() {
    return this._useCustomUnlockedButton;
  }
  set useCustomUnlockedButton(value) {
    this._useCustomUnlockedButton = value;
    this._v2._unmuteUIEnabled = !value;
  }
  /**
   * Gets the current AudioContext if available.
   */
  get audioContext() {
    if (this._v2.state === "running") {
      this._triggerRunningStateAsync();
    }
    return this._v2._audioContext;
  }
  /**
   * Instantiates a new audio engine.
   *
   * @param hostElement defines the host element where to display the mute icon if necessary
   * @param audioContext defines the audio context to be used by the audio engine
   * @param audioDestination defines the audio destination node to be used by audio engine
   */
  constructor(hostElement = null, audioContext = null, audioDestination = null) {
    this._tryToRun = false;
    this._useCustomUnlockedButton = false;
    this.canUseWebAudio = true;
    this.WarnedWebAudioUnsupported = false;
    this.isMP3supported = false;
    this.isOGGsupported = false;
    this.unlocked = false;
    this.onAudioUnlockedObservable = new Observable();
    this.onAudioLockedObservable = new Observable();
    const v2 = new _WebAudioEngine({
      audioContext: audioContext ? audioContext : void 0,
      defaultUIParentElement: hostElement?.parentElement ? hostElement.parentElement : void 0
    });
    v2._unmuteUIEnabled = false;
    this._masterGain = new GainNode(v2._audioContext);
    v2._audioDestination = audioDestination;
    v2.stateChangedObservable.add((state) => {
      if (state === "running") {
        this.unlocked = true;
        this.onAudioUnlockedObservable.notifyObservers(this);
      } else {
        this.unlocked = false;
        this.onAudioLockedObservable.notifyObservers(this);
      }
    });
    v2._initAsync({ resumeOnInteraction: false }).then(() => {
      const mainBusOutNode = v2.defaultMainBus._outNode;
      if (mainBusOutNode) {
        mainBusOutNode.disconnect(v2.mainOut._inNode);
        mainBusOutNode.connect(this._masterGain);
      }
      v2.mainOut._inNode = this._masterGain;
      v2.stateChangedObservable.notifyObservers(v2.state);
    });
    this.isMP3supported = v2.isFormatValid("mp3");
    this.isOGGsupported = v2.isFormatValid("ogg");
    this._v2 = v2;
  }
  /**
   * Flags the audio engine in Locked state.
   * This happens due to new browser policies preventing audio to autoplay.
   */
  lock() {
    this._v2._audioContext.suspend();
    if (!this._useCustomUnlockedButton) {
      this._v2._unmuteUIEnabled = true;
    }
  }
  /**
   * Unlocks the audio engine once a user action has been done on the dom.
   * This is helpful to resume play once browser policies have been satisfied.
   */
  unlock() {
    if (this._v2._audioContext?.state === "running") {
      if (!this.unlocked) {
        this.unlocked = true;
        this.onAudioUnlockedObservable.notifyObservers(this);
      }
      return;
    }
    this._triggerRunningStateAsync();
  }
  /** @internal */
  _resumeAudioContextOnStateChange() {
    this._v2._audioContext?.addEventListener("statechange", () => {
      if (this.unlocked && this._v2._audioContext?.state !== "running") {
        this._resumeAudioContextAsync();
      }
    }, {
      once: true,
      passive: true,
      signal: AbortSignal.timeout(3e3)
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _resumeAudioContextAsync() {
    if (this._v2._isUsingOfflineAudioContext) {
      return Promise.resolve();
    }
    if (this._v2._audioContext.state === "suspended" && !this._useCustomUnlockedButton) {
      this._v2._unmuteUIEnabled = true;
    }
    return this._v2._audioContext.resume();
  }
  /**
   * Destroy and release the resources associated with the audio context.
   */
  dispose() {
    this._v2.dispose();
    this.onAudioUnlockedObservable.clear();
    this.onAudioLockedObservable.clear();
  }
  /**
   * Gets the global volume sets on the master gain.
   * @returns the global volume if set or -1 otherwise
   */
  getGlobalVolume() {
    return this.masterGain.gain.value;
  }
  /**
   * Sets the global volume of your experience (sets on the master gain).
   * @param newVolume Defines the new global volume of the application
   */
  setGlobalVolume(newVolume) {
    this.masterGain.gain.value = newVolume;
  }
  /**
   * Connect the audio engine to an audio analyser allowing some amazing
   * synchronization between the sounds/music and your visualization (VuMeter for instance).
   * @see https://doc.babylonjs.com/features/featuresDeepDive/audio/playingSoundsMusic#using-the-analyser
   * @param analyser The analyser to connect to the engine
   */
  connectToAnalyser(analyser) {
    if (this._connectedAnalyser) {
      this._connectedAnalyser.stopDebugCanvas();
    }
    this._connectedAnalyser = analyser;
    this.masterGain.disconnect();
    this._connectedAnalyser.connectAudioNodes(this.masterGain, this._v2._audioContext.destination);
  }
  async _triggerRunningStateAsync() {
    if (this._tryToRun) {
      void this._v2._audioContext.resume();
      return;
    }
    this._tryToRun = true;
    await this._resumeAudioContextAsync();
    this._tryToRun = false;
    this.unlocked = true;
    this.onAudioUnlockedObservable.notifyObservers(this);
  }
}
let _Registered$a = false;
function RegisterAudioEngine() {
  if (_Registered$a) {
    return;
  }
  _Registered$a = true;
  AbstractEngine.AudioEngineFactory = (hostElement, audioContext, audioDestination) => {
    return new AudioEngine(hostElement, audioContext, audioDestination);
  };
}
RegisterAudioEngine();
let _Registered$9 = false;
function RegisterEnginesWebGPUExtensionsEngineAlpha() {
  if (_Registered$9) {
    return;
  }
  _Registered$9 = true;
  ThinWebGPUEngine.prototype.setAlphaMode = function(mode, noDepthWriteChange = false, targetIndex = 0) {
    const alphaBlend = this._alphaState._alphaBlend[targetIndex];
    if (this._alphaMode[targetIndex] === mode && (mode === 0 && !alphaBlend || mode !== 0 && alphaBlend)) {
      if (!noDepthWriteChange) {
        const depthMask = mode === 0;
        if (this.depthCullingState.depthMask !== depthMask) {
          this.setDepthWrite(depthMask);
          this._cacheRenderPipeline.setDepthWriteEnabled(depthMask);
        }
      }
      return;
    }
    const alphaBlendDisabled = mode === 0;
    this._alphaState.setAlphaBlend(!alphaBlendDisabled, targetIndex);
    this._alphaState.setAlphaMode(mode, targetIndex);
    if (!noDepthWriteChange) {
      this.setDepthWrite(alphaBlendDisabled);
      this._cacheRenderPipeline.setDepthWriteEnabled(alphaBlendDisabled);
    }
    this._alphaMode[targetIndex] = mode;
    this._cacheRenderPipeline.setAlphaBlendEnabled(this._alphaState._alphaBlend, this._alphaState._numTargetEnabled);
    this._cacheRenderPipeline.setAlphaBlendFactors(this._alphaState._blendFunctionParameters, this._alphaState._blendEquationParameters);
  };
  ThinWebGPUEngine.prototype.setAlphaEquation = function(equation, targetIndex = 0) {
    AbstractEngine.prototype.setAlphaEquation.call(this, equation, targetIndex);
    this._cacheRenderPipeline.setAlphaBlendFactors(this._alphaState._blendFunctionParameters, this._alphaState._blendEquationParameters);
  };
}
RegisterEnginesWebGPUExtensionsEngineAlpha();
let _Registered$8 = false;
function RegisterEnginesWebGPUExtensionsEngineAlphaToCoverage() {
  if (_Registered$8) {
    return;
  }
  _Registered$8 = true;
  const alphaToCoverageState = /* @__PURE__ */ new WeakMap();
  ThinWebGPUEngine.prototype.getAlphaToCoverage = function() {
    return alphaToCoverageState.get(this) ?? false;
  };
  ThinWebGPUEngine.prototype.setAlphaToCoverage = function(enable) {
    const pipelineCache = this._cacheRenderPipeline;
    if ((alphaToCoverageState.get(this) ?? false) === enable && pipelineCache._alphaToCoverageEnabled === enable) {
      return;
    }
    alphaToCoverageState.set(this, enable);
    this._cacheRenderPipeline.setAlphaToCoverage(enable);
  };
  const pipelinePrototype = WebGPUCacheRenderPipeline.prototype;
  const buildRenderPipelineDescriptor = pipelinePrototype._buildRenderPipelineDescriptor;
  pipelinePrototype._buildRenderPipelineDescriptor = function(effect, topology, sampleCount) {
    const descriptor = buildRenderPipelineDescriptor.call(this, effect, topology, sampleCount);
    descriptor.multisample.alphaToCoverageEnabled = this._alphaToCoverageEnabled && sampleCount > 1;
    return descriptor;
  };
}
RegisterEnginesWebGPUExtensionsEngineAlphaToCoverage();
let _Registered$7 = false;
function RegisterEnginesWebGPUExtensionsEngineRawTexture() {
  if (_Registered$7) {
    return;
  }
  _Registered$7 = true;
  function ConvertRGBtoRGBATextureData(rgbData, width, height, textureType) {
    let rgbaData;
    let val1 = 1;
    if (textureType === 1) {
      rgbaData = new Float32Array(width * height * 4);
    } else if (textureType === 2) {
      rgbaData = new Uint16Array(width * height * 4);
      val1 = 15360;
    } else if (textureType === 7) {
      rgbaData = new Uint32Array(width * height * 4);
    } else {
      rgbaData = new Uint8Array(width * height * 4);
    }
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const index = (y * width + x) * 3;
        const newIndex = (y * width + x) * 4;
        rgbaData[newIndex + 0] = rgbData[index + 0];
        rgbaData[newIndex + 1] = rgbData[index + 1];
        rgbaData[newIndex + 2] = rgbData[index + 2];
        rgbaData[newIndex + 3] = val1;
      }
    }
    return rgbaData;
  }
  ThinWebGPUEngine.prototype.createRawTexture = function(data, width, height, format, generateMipMaps, invertY, samplingMode, compression = null, type = 0, creationFlags = 0, useSRGBBuffer = false, mipLevelCount) {
    const texture = new InternalTexture(
      this,
      3
      /* InternalTextureSource.Raw */
    );
    texture.baseWidth = width;
    texture.baseHeight = height;
    texture.width = width;
    texture.height = height;
    texture.format = format;
    texture.generateMipMaps = generateMipMaps;
    texture.samplingMode = samplingMode;
    texture.invertY = invertY;
    texture._compression = compression;
    texture.type = type;
    texture._creationFlags = creationFlags;
    texture._useSRGBBuffer = useSRGBBuffer;
    if (!this._doNotHandleContextLost) {
      texture._bufferView = data;
    }
    this._textureHelper.updateMipLevelCountForInternalTexture(texture, mipLevelCount);
    this._textureHelper.createGPUTextureForInternalTexture(texture, width, height, void 0, creationFlags);
    this.updateRawTexture(texture, data, format, invertY, compression, type, useSRGBBuffer);
    this._internalTexturesCache.push(texture);
    return texture;
  };
  ThinWebGPUEngine.prototype.updateRawTexture = function(texture, bufferView, format, invertY, compression = null, type = 0, useSRGBBuffer = false, mipLevel) {
    if (!texture) {
      return;
    }
    if (!this._doNotHandleContextLost) {
      texture._bufferView = bufferView;
      texture.invertY = invertY;
      texture._compression = compression;
      texture._useSRGBBuffer = useSRGBBuffer;
      if (mipLevel !== void 0 && bufferView) {
        if (!texture._bufferViewArray) {
          texture._bufferViewArray = new Array(texture.mipLevelCount);
        }
        texture._bufferViewArray[mipLevel] = bufferView;
      }
    }
    if (bufferView) {
      const gpuTextureWrapper = texture._hardwareTexture;
      const needConversion = format === 4;
      if (needConversion) {
        bufferView = ConvertRGBtoRGBATextureData(bufferView, texture.width, texture.height, type);
      }
      const data = new Uint8Array(bufferView.buffer, bufferView.byteOffset, bufferView.byteLength);
      const mipWidth = Math.max(1, texture.width >> (mipLevel ?? 0));
      const mipHeight = Math.max(1, texture.height >> (mipLevel ?? 0));
      this._textureHelper.updateTexture(data, texture, mipWidth, mipHeight, texture.depth, gpuTextureWrapper.format, 0, mipLevel ?? 0, invertY, false, 0, 0);
      if (texture.generateMipMaps && !mipLevel) {
        this._generateMipmaps(texture, this._uploadEncoder);
      }
    }
    texture.isReady = true;
  };
  ThinWebGPUEngine.prototype.createRawCubeTexture = function(data, size, format, type, generateMipMaps, invertY, samplingMode, compression = null) {
    const texture = new InternalTexture(
      this,
      8
      /* InternalTextureSource.CubeRaw */
    );
    if (type === 1 && !this._caps.textureFloatLinearFiltering) {
      generateMipMaps = false;
      samplingMode = 1;
      Logger.Warn("Float texture filtering is not supported. Mipmap generation and sampling mode are forced to false and TEXTURE_NEAREST_SAMPLINGMODE, respectively.");
    } else if (type === 2 && !this._caps.textureHalfFloatLinearFiltering) {
      generateMipMaps = false;
      samplingMode = 1;
      Logger.Warn("Half float texture filtering is not supported. Mipmap generation and sampling mode are forced to false and TEXTURE_NEAREST_SAMPLINGMODE, respectively.");
    } else if (type === 1 && !this._caps.textureFloatRender) {
      generateMipMaps = false;
      Logger.Warn("Render to float textures is not supported. Mipmap generation forced to false.");
    } else if (type === 2 && !this._caps.colorBufferFloat) {
      generateMipMaps = false;
      Logger.Warn("Render to half float textures is not supported. Mipmap generation forced to false.");
    }
    texture.isCube = true;
    texture._originalFormat = format;
    texture.format = format === 4 ? 5 : format;
    texture.type = type;
    texture.generateMipMaps = generateMipMaps;
    texture.width = size;
    texture.height = size;
    texture.samplingMode = samplingMode;
    if (!this._doNotHandleContextLost) {
      texture._bufferViewArray = data;
    }
    texture.invertY = invertY;
    texture._compression = compression;
    texture._cachedWrapU = 0;
    texture._cachedWrapV = 0;
    this._textureHelper.createGPUTextureForInternalTexture(texture);
    if (format === 4) {
      const gpuTextureWrapper = texture._hardwareTexture;
      gpuTextureWrapper._originalFormatIsRGB = true;
    }
    if (data) {
      this.updateRawCubeTexture(texture, data, format, type, invertY, compression);
    }
    texture.isReady = true;
    return texture;
  };
  ThinWebGPUEngine.prototype.updateRawCubeTexture = function(texture, bufferView, _format, type, invertY, compression = null) {
    texture._bufferViewArray = bufferView;
    texture.invertY = invertY;
    texture._compression = compression;
    const gpuTextureWrapper = texture._hardwareTexture;
    const needConversion = gpuTextureWrapper._originalFormatIsRGB;
    const faces = [0, 2, 4, 1, 3, 5];
    const data = [];
    for (let i = 0; i < bufferView.length; ++i) {
      let faceData = bufferView[faces[i]];
      if (needConversion) {
        faceData = ConvertRGBtoRGBATextureData(faceData, texture.width, texture.height, type);
      }
      data.push(new Uint8Array(faceData.buffer, faceData.byteOffset, faceData.byteLength));
    }
    this._textureHelper.updateCubeTextures(data, texture, texture.width, texture.height, gpuTextureWrapper.format, invertY, false, 0, 0);
    if (texture.generateMipMaps) {
      this._generateMipmaps(texture, this._uploadEncoder);
    }
    texture.isReady = true;
  };
  ThinWebGPUEngine.prototype.createRawCubeTextureFromUrl = function(url, scene, size, format, type, noMipmap, callback, mipmapGenerator, onLoad = null, onError = null, samplingMode = 3, invertY = false) {
    const texture = this.createRawCubeTexture(null, size, format, type, !noMipmap, invertY, samplingMode, null);
    scene?.addPendingData(texture);
    texture.url = url;
    texture.isReady = false;
    this._internalTexturesCache.push(texture);
    const onerror = (request, exception) => {
      scene?.removePendingData(texture);
      if (onError && request) {
        onError(request.status + " " + request.statusText, exception);
      }
    };
    const internalCallbackAsync = async (data) => {
      const faceDataArraysResult = callback(data);
      if (!faceDataArraysResult) {
        return;
      }
      const faceDataArrays = faceDataArraysResult instanceof Promise ? await faceDataArraysResult : faceDataArraysResult;
      const width = texture.width;
      if (mipmapGenerator) {
        const needConversion = format === 4;
        const mipData = mipmapGenerator(faceDataArrays);
        const gpuTextureWrapper = texture._hardwareTexture;
        const faces = [0, 1, 2, 3, 4, 5];
        for (let level = 0; level < mipData.length; level++) {
          const mipSize = width >> level;
          const allFaces = [];
          for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
            let mipFaceData = mipData[level][faces[faceIndex]];
            if (needConversion) {
              mipFaceData = ConvertRGBtoRGBATextureData(mipFaceData, mipSize, mipSize, type);
            }
            allFaces.push(new Uint8Array(mipFaceData.buffer, mipFaceData.byteOffset, mipFaceData.byteLength));
          }
          this._textureHelper.updateCubeTextures(allFaces, texture, mipSize, mipSize, gpuTextureWrapper.format, invertY, false, 0, 0);
        }
      } else {
        this.updateRawCubeTexture(texture, faceDataArrays, format, type, invertY);
      }
      texture.isReady = true;
      scene?.removePendingData(texture);
      if (onLoad) {
        onLoad();
      }
    };
    this._loadFile(url, (data) => {
      internalCallbackAsync(data).catch((err) => {
        onerror(void 0, err);
      });
    }, void 0, scene?.offlineProvider, true, onerror);
    return texture;
  };
  ThinWebGPUEngine.prototype.createRawTexture3D = function(data, width, height, depth, format, generateMipMaps, invertY, samplingMode, compression = null, textureType = 0, creationFlags = 0) {
    const source = 10;
    const texture = new InternalTexture(this, source);
    texture.baseWidth = width;
    texture.baseHeight = height;
    texture.baseDepth = depth;
    texture.width = width;
    texture.height = height;
    texture.depth = depth;
    texture.format = format;
    texture.type = textureType;
    texture.generateMipMaps = generateMipMaps;
    texture.samplingMode = samplingMode;
    texture.is3D = true;
    texture._creationFlags = creationFlags;
    if (!this._doNotHandleContextLost) {
      texture._bufferView = data;
    }
    this._textureHelper.createGPUTextureForInternalTexture(texture, width, height, void 0, creationFlags);
    this.updateRawTexture3D(texture, data, format, invertY, compression, textureType);
    this._internalTexturesCache.push(texture);
    return texture;
  };
  ThinWebGPUEngine.prototype.updateRawTexture3D = function(texture, bufferView, format, invertY, compression = null, textureType = 0) {
    if (!this._doNotHandleContextLost) {
      texture._bufferView = bufferView;
      texture.format = format;
      texture.invertY = invertY;
      texture._compression = compression;
    }
    if (bufferView) {
      const gpuTextureWrapper = texture._hardwareTexture;
      const needConversion = format === 4;
      if (needConversion) {
        bufferView = ConvertRGBtoRGBATextureData(bufferView, texture.width, texture.height, textureType);
      }
      const data = new Uint8Array(bufferView.buffer, bufferView.byteOffset, bufferView.byteLength);
      this._textureHelper.updateTexture(data, texture, texture.width, texture.height, texture.depth, gpuTextureWrapper.format, 0, 0, invertY, false, 0, 0);
      if (texture.generateMipMaps) {
        this._generateMipmaps(texture, this._uploadEncoder);
      }
    }
    texture.isReady = true;
  };
  ThinWebGPUEngine.prototype.createRawTexture2DArray = function(data, width, height, depth, format, generateMipMaps, invertY, samplingMode, compression = null, textureType = 0, creationFlags = 0, mipLevelCount) {
    const source = 11;
    const texture = new InternalTexture(this, source);
    texture.baseWidth = width;
    texture.baseHeight = height;
    texture.baseDepth = depth;
    texture.width = width;
    texture.height = height;
    texture.depth = depth;
    texture.format = format;
    texture.type = textureType;
    texture.generateMipMaps = generateMipMaps;
    texture.samplingMode = samplingMode;
    texture.is2DArray = true;
    texture._creationFlags = creationFlags;
    if (!this._doNotHandleContextLost) {
      texture._bufferView = data;
    }
    this._textureHelper.updateMipLevelCountForInternalTexture(texture, mipLevelCount);
    this._textureHelper.createGPUTextureForInternalTexture(texture, width, height, depth, creationFlags);
    this.updateRawTexture2DArray(texture, data, format, invertY, compression, textureType);
    this._internalTexturesCache.push(texture);
    return texture;
  };
  ThinWebGPUEngine.prototype.updateRawTexture2DArray = function(texture, bufferView, format, invertY, compression = null, textureType = 0, mipLevel) {
    if (!this._doNotHandleContextLost) {
      texture._bufferView = bufferView;
      texture.format = format;
      texture.invertY = invertY;
      texture._compression = compression;
      if (mipLevel !== void 0 && bufferView) {
        if (!texture._bufferViewArray) {
          texture._bufferViewArray = new Array(texture.mipLevelCount);
        }
        texture._bufferViewArray[mipLevel] = bufferView;
      }
    }
    if (bufferView) {
      const gpuTextureWrapper = texture._hardwareTexture;
      const needConversion = format === 4;
      if (needConversion) {
        bufferView = ConvertRGBtoRGBATextureData(bufferView, texture.width, texture.height, textureType);
      }
      const data = new Uint8Array(bufferView.buffer, bufferView.byteOffset, bufferView.byteLength);
      const mipWidth = Math.max(1, texture.width >> (mipLevel ?? 0));
      const mipHeight = Math.max(1, texture.height >> (mipLevel ?? 0));
      this._textureHelper.updateTexture(data, texture, mipWidth, mipHeight, texture.depth, gpuTextureWrapper.format, 0, mipLevel ?? 0, invertY, false, 0, 0);
      if (texture.generateMipMaps && !mipLevel) {
        this._generateMipmaps(texture, this._uploadEncoder);
      }
    }
    texture.isReady = true;
  };
}
RegisterEnginesWebGPUExtensionsEngineRawTexture();
let _Registered$6 = false;
function RegisterEnginesWebGPUExtensionsEngineReadTexture() {
  if (_Registered$6) {
    return;
  }
  _Registered$6 = true;
  ThinWebGPUEngine.prototype._readTexturePixels = function(texture, width, height, faceIndex = -1, level = 0, buffer = null, flushRenderer = true, noDataConversion = false, x = 0, y = 0) {
    const gpuTextureWrapper = texture._hardwareTexture;
    if (flushRenderer) {
      this.flushFramebuffer();
    }
    return this._textureHelper.readPixels(gpuTextureWrapper.underlyingResource, x, y, width, height, gpuTextureWrapper.format, faceIndex, level, buffer, noDataConversion);
  };
  ThinWebGPUEngine.prototype._readTexturePixelsSync = function() {
    throw "_readTexturePixelsSync is unsupported in WebGPU!";
  };
}
RegisterEnginesWebGPUExtensionsEngineReadTexture();
let _Registered$5 = false;
function RegisterEnginesWebGPUExtensionsEngineCubeTexture() {
  if (_Registered$5) {
    return;
  }
  _Registered$5 = true;
  ThinWebGPUEngine.prototype._createDepthStencilCubeTexture = function(size, options) {
    const internalTexture = new InternalTexture(
      this,
      options.generateStencil ? 12 : 14
      /* InternalTextureSource.Depth */
    );
    internalTexture.isCube = true;
    internalTexture.label = options.label;
    const internalOptions = {
      bilinearFiltering: false,
      comparisonFunction: 0,
      samples: 1,
      depthTextureFormat: options.generateStencil ? 13 : 14,
      ...options
    };
    internalTexture.format = internalOptions.depthTextureFormat;
    this._setupDepthStencilTexture(internalTexture, size, internalOptions.bilinearFiltering, internalOptions.comparisonFunction, internalOptions.samples);
    this._textureHelper.createGPUTextureForInternalTexture(internalTexture);
    const gpuTextureWrapper = internalTexture._hardwareTexture;
    internalTexture.type = WebGPUTextureHelper.GetTextureTypeFromFormat(gpuTextureWrapper.format);
    this._internalTexturesCache.push(internalTexture);
    return internalTexture;
  };
  ThinWebGPUEngine.prototype.createCubeTexture = function(rootUrl, scene, files, noMipmap, onLoad = null, onError = null, format, forcedExtension = null, createPolynomials = false, lodScale = 0, lodOffset = 0, fallback = null, loaderOptions, useSRGBBuffer = false, buffer = null) {
    return this.createCubeTextureBase(rootUrl, scene, files, !!noMipmap, onLoad, onError, format, forcedExtension, createPolynomials, lodScale, lodOffset, fallback, null, (texture, imgs) => {
      const imageBitmaps = imgs;
      const width = imageBitmaps[0].width;
      const height = width;
      this._setCubeMapTextureParams(texture, !noMipmap);
      texture.format = format ?? -1;
      const gpuTextureWrapper = this._textureHelper.createGPUTextureForInternalTexture(texture, width, height);
      this._textureHelper.updateCubeTextures(imageBitmaps, texture, width, height, gpuTextureWrapper.format, false, false, 0, 0);
      if (!noMipmap) {
        this._generateMipmaps(texture, this._uploadEncoder);
      }
      texture.isReady = true;
      texture.onLoadedObservable.notifyObservers(texture);
      texture.onLoadedObservable.clear();
      if (onLoad) {
        onLoad();
      }
    }, !!useSRGBBuffer, buffer);
  };
  ThinWebGPUEngine.prototype._setCubeMapTextureParams = function(texture, loadMipmap, maxLevel) {
    texture.samplingMode = loadMipmap ? 3 : 2;
    texture._cachedWrapU = 0;
    texture._cachedWrapV = 0;
    if (maxLevel) {
      texture._maxLodLevel = maxLevel;
    }
  };
  ThinWebGPUEngine.prototype.generateMipMapsForCubemap = function(texture) {
    if (texture.generateMipMaps) {
      const gpuTexture = texture._hardwareTexture?.underlyingResource;
      if (!gpuTexture) {
        this._textureHelper.createGPUTextureForInternalTexture(texture);
      }
      this._generateMipmaps(texture);
    }
  };
}
RegisterEnginesWebGPUExtensionsEngineCubeTexture();
class WebGPURenderTargetWrapper extends RenderTargetWrapper {
  /**
   * Initializes the render target wrapper
   * @param isMulti true if the wrapper is a multi render target
   * @param isCube true if the wrapper should render to a cube texture
   * @param size size of the render target (width/height/layers)
   * @param engine engine used to create the render target
   * @param label defines the label to use for the wrapper (for debugging purpose only)
   */
  constructor(isMulti, isCube, size, engine, label) {
    super(isMulti, isCube, size, engine, label);
    this._disableEngineYFlip = false;
    if (engine.enableGPUTimingMeasurements) {
      this.gpuTimeInFrame = new WebGPUPerfCounter();
    }
  }
}
let _Registered$4 = false;
function RegisterEnginesWebGPUExtensionsEngineRenderTarget() {
  if (_Registered$4) {
    return;
  }
  _Registered$4 = true;
  ThinWebGPUEngine.prototype._createHardwareRenderTargetWrapper = function(isMulti, isCube, size) {
    const rtWrapper = new WebGPURenderTargetWrapper(isMulti, isCube, size, this);
    this._renderTargetWrapperCache.push(rtWrapper);
    return rtWrapper;
  };
  ThinWebGPUEngine.prototype.createRenderTargetTexture = function(size, options) {
    const rtWrapper = this._createHardwareRenderTargetWrapper(false, false, size);
    const fullOptions = {};
    if (options !== void 0 && typeof options === "object") {
      fullOptions.generateMipMaps = options.generateMipMaps;
      fullOptions.generateDepthBuffer = options.generateDepthBuffer === void 0 ? true : options.generateDepthBuffer;
      fullOptions.generateStencilBuffer = fullOptions.generateDepthBuffer && options.generateStencilBuffer;
      fullOptions.samplingMode = options.samplingMode === void 0 ? 3 : options.samplingMode;
      fullOptions.creationFlags = options.creationFlags ?? 0;
      fullOptions.noColorAttachment = !!options.noColorAttachment;
      fullOptions.colorAttachment = options.colorAttachment;
      fullOptions.samples = options.samples;
      fullOptions.label = options.label;
      fullOptions.format = options.format;
      fullOptions.type = options.type;
      fullOptions.useSRGBBuffer = options.useSRGBBuffer;
    } else {
      fullOptions.generateMipMaps = options;
      fullOptions.generateDepthBuffer = true;
      fullOptions.generateStencilBuffer = false;
      fullOptions.samplingMode = 3;
      fullOptions.creationFlags = 0;
      fullOptions.noColorAttachment = false;
    }
    const texture = fullOptions.colorAttachment || (fullOptions.noColorAttachment ? null : this._createInternalTexture(
      size,
      fullOptions,
      true,
      5
      /* InternalTextureSource.RenderTarget */
    ));
    rtWrapper.label = fullOptions.label ?? "RenderTargetWrapper";
    rtWrapper._samples = fullOptions.colorAttachment?.samples ?? fullOptions.samples ?? 1;
    rtWrapper._generateDepthBuffer = fullOptions.generateDepthBuffer;
    rtWrapper._generateStencilBuffer = fullOptions.generateStencilBuffer ? true : false;
    rtWrapper.setTextures(texture);
    if (rtWrapper._generateDepthBuffer || rtWrapper._generateStencilBuffer) {
      rtWrapper.createDepthStencilTexture(
        0,
        false,
        // force false as filtering is not supported for depth textures
        rtWrapper._generateStencilBuffer,
        rtWrapper.samples,
        fullOptions.generateStencilBuffer ? 13 : 14,
        fullOptions.label ? fullOptions.label + "-DepthStencil" : void 0
      );
    }
    if (texture && !fullOptions.colorAttachment) {
      if (options !== void 0 && typeof options === "object" && options.createMipMaps && !fullOptions.generateMipMaps) {
        texture.generateMipMaps = true;
      }
      this._textureHelper.createGPUTextureForInternalTexture(texture, void 0, void 0, void 0, fullOptions.creationFlags);
      if (options !== void 0 && typeof options === "object" && options.createMipMaps && !fullOptions.generateMipMaps) {
        texture.generateMipMaps = false;
      }
    }
    return rtWrapper;
  };
  ThinWebGPUEngine.prototype._createDepthStencilTexture = function(size, options, wrapper) {
    const internalOptions = {
      bilinearFiltering: false,
      comparisonFunction: 0,
      samples: 1,
      depthTextureFormat: options.generateStencil ? 13 : 14,
      ...options
    };
    const hasStencil = HasStencilAspect(internalOptions.depthTextureFormat);
    wrapper._depthStencilTextureWithStencil = hasStencil;
    const internalTexture = new InternalTexture(
      this,
      hasStencil ? 12 : 14
      /* InternalTextureSource.Depth */
    );
    internalTexture.label = options.label;
    internalTexture.format = internalOptions.depthTextureFormat;
    internalTexture.type = GetTypeForDepthTexture(internalTexture.format);
    this._setupDepthStencilTexture(internalTexture, size, internalOptions.bilinearFiltering, internalOptions.comparisonFunction, internalOptions.samples);
    this._textureHelper.createGPUTextureForInternalTexture(internalTexture);
    this._internalTexturesCache.push(internalTexture);
    return internalTexture;
  };
  ThinWebGPUEngine.prototype._setupDepthStencilTexture = function(internalTexture, size, bilinearFiltering, comparisonFunction, samples = 1) {
    const width = size.width ?? size;
    const height = size.height ?? size;
    const layers = size.layers || 0;
    const depth = size.depth || 0;
    internalTexture.baseWidth = width;
    internalTexture.baseHeight = height;
    internalTexture.width = width;
    internalTexture.height = height;
    internalTexture.is2DArray = layers > 0;
    internalTexture.is3D = depth > 0;
    internalTexture.depth = layers || depth;
    internalTexture.isReady = true;
    internalTexture.samples = samples;
    internalTexture.generateMipMaps = false;
    internalTexture.samplingMode = bilinearFiltering ? 2 : 1;
    internalTexture.type = 1;
    internalTexture._comparisonFunction = comparisonFunction;
    internalTexture._cachedWrapU = 0;
    internalTexture._cachedWrapV = 0;
  };
  ThinWebGPUEngine.prototype.updateRenderTargetTextureSampleCount = function(rtWrapper, samples) {
    if (!rtWrapper || !rtWrapper.texture || rtWrapper.samples === samples) {
      return samples;
    }
    samples = Math.min(samples, this.getCaps().maxMSAASamples);
    const gpuTexture = rtWrapper.texture._hardwareTexture;
    gpuTexture?.releaseMSAATextures();
    if (rtWrapper._depthStencilTexture) {
      rtWrapper._depthStencilTexture._hardwareTexture?.releaseMSAATextures();
      rtWrapper._depthStencilTexture.samples = samples;
    }
    rtWrapper._samples = samples;
    rtWrapper.texture.samples = samples;
    return samples;
  };
}
RegisterEnginesWebGPUExtensionsEngineRenderTarget();
let _Registered$3 = false;
function RegisterEnginesWebGPUExtensionsEngineRenderTargetTexture() {
  if (_Registered$3) {
    return;
  }
  _Registered$3 = true;
  ThinWebGPUEngine.prototype.setDepthStencilTexture = function(channel, uniform, texture, name2) {
    if (!texture || !texture.depthStencilTexture) {
      this._setTexture(channel, null, void 0, void 0, name2);
    } else {
      this._setTexture(channel, texture, false, true, name2);
    }
  };
}
RegisterEnginesWebGPUExtensionsEngineRenderTargetTexture();
let _Registered$2 = false;
function RegisterEnginesWebGPUExtensionsEngineRenderTargetCube() {
  if (_Registered$2) {
    return;
  }
  _Registered$2 = true;
  ThinWebGPUEngine.prototype.createRenderTargetCubeTexture = function(size, options) {
    const rtWrapper = this._createHardwareRenderTargetWrapper(false, true, size);
    const fullOptions = {
      generateMipMaps: true,
      generateDepthBuffer: true,
      generateStencilBuffer: false,
      type: 0,
      samplingMode: 3,
      format: 5,
      samples: 1,
      ...options
    };
    fullOptions.generateStencilBuffer = fullOptions.generateDepthBuffer && fullOptions.generateStencilBuffer;
    rtWrapper.label = fullOptions.label ?? "RenderTargetWrapper";
    rtWrapper._generateDepthBuffer = fullOptions.generateDepthBuffer;
    rtWrapper._generateStencilBuffer = fullOptions.generateStencilBuffer;
    const texture = new InternalTexture(
      this,
      5
      /* InternalTextureSource.RenderTarget */
    );
    texture.width = size;
    texture.height = size;
    texture.depth = 0;
    texture.isReady = true;
    texture.isCube = true;
    texture.samples = fullOptions.samples;
    texture.generateMipMaps = fullOptions.generateMipMaps;
    texture.samplingMode = fullOptions.samplingMode;
    texture.type = fullOptions.type;
    texture.format = fullOptions.format;
    this._internalTexturesCache.push(texture);
    rtWrapper.setTextures(texture);
    if (rtWrapper._generateDepthBuffer || rtWrapper._generateStencilBuffer) {
      rtWrapper.createDepthStencilTexture(0, fullOptions.samplingMode === void 0 || fullOptions.samplingMode === 2 || fullOptions.samplingMode === 2 || fullOptions.samplingMode === 3 || fullOptions.samplingMode === 3 || fullOptions.samplingMode === 5 || fullOptions.samplingMode === 6 || fullOptions.samplingMode === 7 || fullOptions.samplingMode === 11, rtWrapper._generateStencilBuffer, rtWrapper.samples);
    }
    if (options && options.createMipMaps && !fullOptions.generateMipMaps) {
      texture.generateMipMaps = true;
    }
    this._textureHelper.createGPUTextureForInternalTexture(texture);
    if (options && options.createMipMaps && !fullOptions.generateMipMaps) {
      texture.generateMipMaps = false;
    }
    return rtWrapper;
  };
}
RegisterEnginesWebGPUExtensionsEngineRenderTargetCube();
let _Registered$1 = false;
function RegisterEnginesWebGPUExtensionsEngineQuery() {
  if (_Registered$1) {
    return;
  }
  _Registered$1 = true;
  ThinWebGPUEngine.prototype.getGPUFrameTimeCounter = function() {
    return this._timestampQuery.gpuFrameTimeCounter;
  };
  ThinWebGPUEngine.prototype.captureGPUFrameTime = function(value) {
    this._timestampQuery.enable = value && !!this._caps.timerQuery;
  };
  ThinWebGPUEngine.prototype.createQuery = function() {
    return this._occlusionQuery.createQuery();
  };
  ThinWebGPUEngine.prototype.deleteQuery = function(query) {
    this._occlusionQuery.deleteQuery(query);
    return this;
  };
  ThinWebGPUEngine.prototype.isQueryResultAvailable = function(query) {
    return this._occlusionQuery.isQueryResultAvailable(query);
  };
  ThinWebGPUEngine.prototype.getQueryResult = function(query) {
    return this._occlusionQuery.getQueryResult(query);
  };
  ThinWebGPUEngine.prototype.beginOcclusionQuery = function(algorithmType, query) {
    if (this.compatibilityMode) {
      if (this._occlusionQueryActive) {
        return false;
      }
      const renderPass = this._getCurrentRenderPass();
      if (renderPass && this._occlusionQuery.canBeginQuery(query)) {
        renderPass.beginOcclusionQuery(query);
        this._occlusionQueryActive = true;
        return true;
      }
    } else {
      this._bundleList.addItem(new WebGPURenderItemBeginOcclusionQuery(query));
      return true;
    }
    return false;
  };
  ThinWebGPUEngine.prototype.endOcclusionQuery = function() {
    if (this.compatibilityMode) {
      if (this._occlusionQueryActive) {
        this._currentRenderPass?.endOcclusionQuery();
        this._occlusionQueryActive = false;
      }
    } else {
      this._bundleList.addItem(new WebGPURenderItemEndOcclusionQuery());
    }
    return this;
  };
}
RegisterEnginesWebGPUExtensionsEngineQuery();
let _Registered = false;
function RegisterEnginesWebGPUExtensionsEngineDynamicTexture() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  WebGPUEngine.prototype.createDynamicTexture = function(width, height, generateMipMaps, samplingMode) {
    const texture = new InternalTexture(
      this,
      4
      /* InternalTextureSource.Dynamic */
    );
    texture.baseWidth = width;
    texture.baseHeight = height;
    if (generateMipMaps) {
      width = this.needPOTTextures ? GetExponentOfTwo(width, this._caps.maxTextureSize) : width;
      height = this.needPOTTextures ? GetExponentOfTwo(height, this._caps.maxTextureSize) : height;
    }
    texture.width = width;
    texture.height = height;
    texture.isReady = false;
    texture.generateMipMaps = generateMipMaps;
    texture.samplingMode = samplingMode;
    this.updateTextureSamplingMode(samplingMode, texture);
    this._internalTexturesCache.push(texture);
    if (width && height) {
      this._textureHelper.createGPUTextureForInternalTexture(texture, width, height);
    }
    return texture;
  };
  WebGPUEngine.prototype.updateDynamicTexture = function(texture, source, invertY, premulAlpha = false, format, forceBindTexture, allowGPUOptimization) {
    if (!texture) {
      return;
    }
    const width = source.width, height = source.height;
    let gpuTextureWrapper = texture._hardwareTexture;
    if (!texture._hardwareTexture?.underlyingResource) {
      gpuTextureWrapper = this._textureHelper.createGPUTextureForInternalTexture(texture, width, height);
    }
    this._textureHelper.updateTexture(source, texture, width, height, texture.depth, gpuTextureWrapper.format, 0, 0, invertY, premulAlpha, 0, 0, allowGPUOptimization);
    if (texture.generateMipMaps) {
      this._generateMipmaps(texture);
    }
    texture._dynamicTextureSource = source;
    texture._premulAlpha = premulAlpha;
    texture.invertY = invertY || false;
    texture.isReady = true;
  };
}
RegisterEnginesWebGPUExtensionsEngineDynamicTexture();
const webgpuEngine = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  WebGPUEngine
}, Symbol.toStringTag, { value: "Module" }));
export {
  InjectStartingAndEndingCode as I,
  RegisterBufferAlign as R,
  ShaderCodeInliner as S,
  ThinWebGPUEngine as T,
  WebGPUPerfCounter as W,
  WebGPUEngine as a,
  checkNonFloatVertexBuffers as c,
  webgpuEngine as w
};
