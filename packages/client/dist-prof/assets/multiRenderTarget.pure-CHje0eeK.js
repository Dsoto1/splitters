import { aC as ThinEngine, aF as IsIntegerTextureFormat, aG as IsUnsignedIntegerTextureType, L as Logger, ae as InternalTexture, C as Color4, aH as RenderTargetTexture, G as Texture } from "./babylon-PnzH6wcM.js";
let _Registered = false;
const _UnsignedIntegerClearColor = /* @__PURE__ */ new Color4();
const _SignedIntegerClearColor = /* @__PURE__ */ new Color4();
function RegisterEnginesExtensionsEngineMultiRender() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  ThinEngine.prototype.restoreSingleAttachment = function() {
    const gl = this._gl;
    this.bindAttachments([gl.BACK]);
  };
  ThinEngine.prototype.restoreSingleAttachmentForRenderTarget = function() {
    const gl = this._gl;
    this.bindAttachments([gl.COLOR_ATTACHMENT0]);
  };
  ThinEngine.prototype.buildTextureLayout = function(textureStatus, backBufferLayout = false) {
    const gl = this._gl;
    const result = [];
    if (backBufferLayout) {
      result.push(gl.BACK);
    } else {
      for (let i = 0; i < textureStatus.length; i++) {
        if (textureStatus[i]) {
          result.push(gl["COLOR_ATTACHMENT" + i]);
        } else {
          result.push(gl.NONE);
        }
      }
    }
    return result;
  };
  ThinEngine.prototype.bindAttachments = function(attachments) {
    const gl = this._gl;
    const textures = this._currentRenderTarget?.textures;
    this._integerMRTAttachmentsMask = 0;
    if (textures) {
      for (let index = 0; index < attachments.length; index++) {
        if (attachments[index] !== gl.NONE && textures[index] && IsIntegerTextureFormat(textures[index].format)) {
          this._integerMRTAttachmentsMask |= 1 << index;
        }
      }
    }
    gl.drawBuffers(attachments);
  };
  ThinEngine.prototype.clearAttachments = function(color, attachments, clearColor, clearDepth, clearStencil = false, stencilClearValue = 0) {
    const textures = this._currentRenderTarget?.textures;
    let hasIntegerAttachment = false;
    if (clearColor && color && textures) {
      for (let index = 0; index < attachments.length; index++) {
        const texture = textures[index];
        if (attachments[index] !== this._gl.NONE && texture && IsIntegerTextureFormat(texture.format)) {
          if (this._webGLVersion < 2) {
            throw new Error("ThinEngine.clearAttachments: integer MRT attachments require WebGL2");
          }
          hasIntegerAttachment = true;
          break;
        }
      }
    }
    if (!hasIntegerAttachment || !color || !textures) {
      this.bindAttachments(attachments);
      this.clear(color, clearColor, clearDepth, clearStencil, stencilClearValue);
      return;
    }
    this.bindAttachments(attachments);
    this._applyColorWriteState();
    for (let index = 0; index < attachments.length; index++) {
      const texture = textures[index];
      if (attachments[index] !== this._gl.NONE && texture) {
        let clearValue = color;
        if (IsIntegerTextureFormat(texture.format)) {
          const unsigned = IsUnsignedIntegerTextureType(texture.type);
          clearValue = unsigned ? _UnsignedIntegerClearColor : _SignedIntegerClearColor;
          const scale = unsigned ? 255 : 1;
          clearValue.r = Math.round(color.r * scale);
          clearValue.g = Math.round(color.g * scale);
          clearValue.b = Math.round(color.b * scale);
          clearValue.a = Math.round(color.a * scale);
        }
        this._clearColorAttachment(index, clearValue, texture.format, texture.type);
      }
    }
    if (clearDepth || clearStencil) {
      const integerMRTAttachmentsMask = this._integerMRTAttachmentsMask;
      this._integerMRTAttachmentsMask = 0;
      try {
        this.clear(null, false, clearDepth, clearStencil, stencilClearValue);
      } finally {
        this._integerMRTAttachmentsMask = integerMRTAttachmentsMask;
      }
    }
  };
  ThinEngine.prototype.unBindMultiColorAttachmentFramebuffer = function(rtWrapper, disableGenerateMipMaps = false, onBeforeUnbind) {
    this._currentRenderTarget = null;
    this._integerMRTAttachmentsMask = 0;
    if (!rtWrapper.disableAutomaticMSAAResolve) {
      this.resolveMultiFramebuffer(rtWrapper);
    }
    if (!disableGenerateMipMaps) {
      this.generateMipMapsMultiFramebuffer(rtWrapper);
    }
    if (onBeforeUnbind) {
      if (rtWrapper._MSAAFramebuffer) {
        this._bindUnboundFramebuffer(rtWrapper._framebuffer);
      }
      onBeforeUnbind();
    }
    this._bindUnboundFramebuffer(null);
  };
  ThinEngine.prototype.createMultipleRenderTarget = function(size, options, initializeBuffers = true) {
    let generateMipMaps = false;
    let generateDepthBuffer = true;
    let generateStencilBuffer = false;
    let generateDepthTexture = false;
    let depthTextureFormat = void 0;
    let textureCount = 1;
    let samples = 1;
    const defaultType = 0;
    const defaultSamplingMode = 3;
    const defaultUseSRGBBuffer = false;
    const defaultFormat = 5;
    const defaultTarget = 3553;
    let types = [];
    let samplingModes = [];
    let useSRGBBuffers = [];
    let formats = [];
    let targets = [];
    let faceIndex = [];
    let layerIndex = [];
    let layers = [];
    let labels = [];
    let dontCreateTextures = false;
    const rtWrapper = this._createHardwareRenderTargetWrapper(true, false, size);
    if (options !== void 0) {
      generateMipMaps = options.generateMipMaps === void 0 ? false : options.generateMipMaps;
      generateDepthBuffer = options.generateDepthBuffer === void 0 ? true : options.generateDepthBuffer;
      generateStencilBuffer = options.generateStencilBuffer === void 0 ? false : options.generateStencilBuffer;
      generateDepthTexture = options.generateDepthTexture === void 0 ? false : options.generateDepthTexture;
      textureCount = options.textureCount ?? 1;
      samples = options.samples ?? samples;
      types = options.types || types;
      samplingModes = options.samplingModes || samplingModes;
      useSRGBBuffers = options.useSRGBBuffers || useSRGBBuffers;
      formats = options.formats || formats;
      targets = options.targetTypes || targets;
      faceIndex = options.faceIndex || faceIndex;
      layerIndex = options.layerIndex || layerIndex;
      layers = options.layerCounts || layers;
      labels = options.labels || labels;
      dontCreateTextures = options.dontCreateTextures ?? false;
      if (this.webGLVersion > 1 && (options.depthTextureFormat === 13 || options.depthTextureFormat === 17 || options.depthTextureFormat === 16 || options.depthTextureFormat === 14 || options.depthTextureFormat === 18)) {
        depthTextureFormat = options.depthTextureFormat;
      }
    }
    if (depthTextureFormat === void 0) {
      depthTextureFormat = generateStencilBuffer ? 13 : 14;
    }
    const gl = this._gl;
    const currentFramebuffer = this._currentFramebuffer;
    const framebuffer = gl.createFramebuffer();
    this._bindUnboundFramebuffer(framebuffer);
    const width = size.width ?? size;
    const height = size.height ?? size;
    const textures = [];
    const attachments = [];
    const useStencilTexture = this.webGLVersion > 1 && (depthTextureFormat === 13 || depthTextureFormat === 17 || depthTextureFormat === 18);
    rtWrapper.label = options?.label ?? "MultiRenderTargetWrapper";
    rtWrapper._framebuffer = framebuffer;
    rtWrapper._generateDepthBuffer = generateDepthTexture || generateDepthBuffer;
    rtWrapper._generateStencilBuffer = generateDepthTexture ? useStencilTexture : generateStencilBuffer;
    rtWrapper._depthStencilBuffer = this._setupFramebufferDepthAttachments(rtWrapper._generateStencilBuffer, rtWrapper._generateDepthBuffer, width, height, 1, depthTextureFormat);
    rtWrapper._attachments = attachments;
    for (let i = 0; i < textureCount; i++) {
      let samplingMode = samplingModes[i] || defaultSamplingMode;
      let type = types[i] || defaultType;
      let useSRGBBuffer = useSRGBBuffers[i] || defaultUseSRGBBuffer;
      const format = formats[i] || defaultFormat;
      const target = targets[i] || defaultTarget;
      const layerCount = layers[i] ?? 1;
      if (type === 1 && !this._caps.textureFloatLinearFiltering) {
        samplingMode = 1;
      } else if (type === 2 && !this._caps.textureHalfFloatLinearFiltering) {
        samplingMode = 1;
      }
      const filters = this._getSamplingParameters(samplingMode, generateMipMaps);
      if (type === 1 && !this._caps.textureFloat) {
        type = 0;
        Logger.Warn("Float textures are not supported. Render target forced to TEXTURETYPE_UNSIGNED_BYTE type");
      }
      useSRGBBuffer = useSRGBBuffer && this._caps.supportSRGBBuffers && (this.webGLVersion > 1 || this.isWebGPU);
      const isWebGL2 = this.webGLVersion > 1;
      const attachment = gl[isWebGL2 ? "COLOR_ATTACHMENT" + i : "COLOR_ATTACHMENT" + i + "_WEBGL"];
      attachments.push(attachment);
      if (target === -1 || dontCreateTextures) {
        continue;
      }
      const texture = new InternalTexture(
        this,
        6
        /* InternalTextureSource.MultiRenderTarget */
      );
      textures[i] = texture;
      gl.activeTexture(gl["TEXTURE" + i]);
      gl.bindTexture(target, texture._hardwareTexture.underlyingResource);
      gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, filters.mag);
      gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, filters.min);
      gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const internalSizedFormat = this._getRGBABufferInternalSizedFormat(type, format, useSRGBBuffer);
      const internalFormat = this._getInternalFormat(format);
      const webGLTextureType = this._getWebGLTextureType(type);
      if (isWebGL2 && (target === 35866 || target === 32879)) {
        if (target === 35866) {
          texture.is2DArray = true;
        } else {
          texture.is3D = true;
        }
        texture.baseDepth = texture.depth = layerCount;
        gl.texImage3D(target, 0, internalSizedFormat, width, height, layerCount, 0, internalFormat, webGLTextureType, null);
      } else if (target === 34067) {
        for (let i2 = 0; i2 < 6; i2++) {
          gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i2, 0, internalSizedFormat, width, height, 0, internalFormat, webGLTextureType, null);
        }
        texture.isCube = true;
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, internalSizedFormat, width, height, 0, internalFormat, webGLTextureType, null);
      }
      if (generateMipMaps) {
        gl.generateMipmap(target);
      }
      this._bindTextureDirectly(target, null);
      texture.baseWidth = width;
      texture.baseHeight = height;
      texture.width = width;
      texture.height = height;
      texture.isReady = true;
      texture.samples = 1;
      texture.generateMipMaps = generateMipMaps;
      texture.samplingMode = samplingMode;
      texture.type = type;
      texture._useSRGBBuffer = useSRGBBuffer;
      texture.format = format;
      texture.label = labels[i] ?? rtWrapper.label + "-Texture" + i;
      this._internalTexturesCache.push(texture);
    }
    if (generateDepthTexture && this._caps.depthTextureExtension && !dontCreateTextures) {
      const depthTexture = new InternalTexture(
        this,
        14
        /* InternalTextureSource.Depth */
      );
      let depthTextureType = 5;
      let glDepthTextureInternalFormat = gl.DEPTH_COMPONENT16;
      let glDepthTextureFormat = gl.DEPTH_COMPONENT;
      let glDepthTextureType = gl.UNSIGNED_SHORT;
      let glDepthTextureAttachment = gl.DEPTH_ATTACHMENT;
      if (this.webGLVersion < 2) {
        glDepthTextureInternalFormat = gl.DEPTH_COMPONENT;
      } else {
        if (depthTextureFormat === 14) {
          depthTextureType = 1;
          glDepthTextureType = gl.FLOAT;
          glDepthTextureInternalFormat = gl.DEPTH_COMPONENT32F;
        } else if (depthTextureFormat === 18) {
          depthTextureType = 0;
          glDepthTextureType = gl.FLOAT_32_UNSIGNED_INT_24_8_REV;
          glDepthTextureInternalFormat = gl.DEPTH32F_STENCIL8;
          glDepthTextureFormat = gl.DEPTH_STENCIL;
          glDepthTextureAttachment = gl.DEPTH_STENCIL_ATTACHMENT;
        } else if (depthTextureFormat === 16) {
          depthTextureType = 0;
          glDepthTextureType = gl.UNSIGNED_INT;
          glDepthTextureInternalFormat = gl.DEPTH_COMPONENT24;
          glDepthTextureAttachment = gl.DEPTH_ATTACHMENT;
        } else if (depthTextureFormat === 13 || depthTextureFormat === 17) {
          depthTextureType = 12;
          glDepthTextureType = gl.UNSIGNED_INT_24_8;
          glDepthTextureInternalFormat = gl.DEPTH24_STENCIL8;
          glDepthTextureFormat = gl.DEPTH_STENCIL;
          glDepthTextureAttachment = gl.DEPTH_STENCIL_ATTACHMENT;
        }
      }
      this._bindTextureDirectly(gl.TEXTURE_2D, depthTexture, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, glDepthTextureInternalFormat, width, height, 0, glDepthTextureFormat, glDepthTextureType, null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, glDepthTextureAttachment, gl.TEXTURE_2D, depthTexture._hardwareTexture.underlyingResource, 0);
      this._bindTextureDirectly(gl.TEXTURE_2D, null);
      rtWrapper._depthStencilTexture = depthTexture;
      rtWrapper._depthStencilTextureWithStencil = useStencilTexture;
      depthTexture.baseWidth = width;
      depthTexture.baseHeight = height;
      depthTexture.width = width;
      depthTexture.height = height;
      depthTexture.isReady = true;
      depthTexture.samples = 1;
      depthTexture.generateMipMaps = generateMipMaps;
      depthTexture.samplingMode = 1;
      depthTexture.format = depthTextureFormat;
      depthTexture.type = depthTextureType;
      depthTexture.label = rtWrapper.label + "-DepthStencil";
      textures[textureCount] = depthTexture;
      this._internalTexturesCache.push(depthTexture);
    }
    rtWrapper.setTextures(textures);
    if (initializeBuffers) {
      gl.drawBuffers(attachments);
    }
    this._bindUnboundFramebuffer(currentFramebuffer);
    rtWrapper.setLayerAndFaceIndices(layerIndex, faceIndex);
    this.resetTextureCache();
    if (!dontCreateTextures) {
      this.updateMultipleRenderTargetTextureSampleCount(rtWrapper, samples, initializeBuffers);
    } else if (samples > 1) {
      const framebuffer2 = gl.createFramebuffer();
      if (!framebuffer2) {
        throw new Error("Unable to create multi sampled framebuffer");
      }
      rtWrapper._samples = samples;
      rtWrapper._MSAAFramebuffer = framebuffer2;
      if (textureCount > 0 && initializeBuffers) {
        this._bindUnboundFramebuffer(framebuffer2);
        gl.drawBuffers(attachments);
        this._bindUnboundFramebuffer(currentFramebuffer);
      }
    }
    return rtWrapper;
  };
  ThinEngine.prototype.updateMultipleRenderTargetTextureSampleCount = function(rtWrapper, samples, initializeBuffers = true) {
    if (this.webGLVersion < 2 || !rtWrapper) {
      return 1;
    }
    if (rtWrapper.samples === samples) {
      return samples;
    }
    const gl = this._gl;
    samples = Math.min(samples, this.getCaps().maxMSAASamples);
    if (rtWrapper._depthStencilBuffer) {
      gl.deleteRenderbuffer(rtWrapper._depthStencilBuffer);
      rtWrapper._depthStencilBuffer = null;
    }
    if (rtWrapper._MSAAFramebuffer) {
      gl.deleteFramebuffer(rtWrapper._MSAAFramebuffer);
      rtWrapper._MSAAFramebuffer = null;
    }
    const count = rtWrapper._attachments.length;
    for (let i = 0; i < count; i++) {
      const texture = rtWrapper.textures[i];
      const hardwareTexture = texture._hardwareTexture;
      hardwareTexture?.releaseMSAARenderBuffers();
    }
    if (samples > 1 && typeof gl.renderbufferStorageMultisample === "function") {
      const framebuffer = gl.createFramebuffer();
      if (!framebuffer) {
        throw new Error("Unable to create multi sampled framebuffer");
      }
      rtWrapper._MSAAFramebuffer = framebuffer;
      this._bindUnboundFramebuffer(framebuffer);
      const attachments = [];
      for (let i = 0; i < count; i++) {
        const texture = rtWrapper.textures[i];
        const hardwareTexture = texture._hardwareTexture;
        const attachment = gl[this.webGLVersion > 1 ? "COLOR_ATTACHMENT" + i : "COLOR_ATTACHMENT" + i + "_WEBGL"];
        const colorRenderbuffer = this._createRenderBuffer(texture.width, texture.height, samples, -1, this._getRGBABufferInternalSizedFormat(texture.type, texture.format, texture._useSRGBBuffer), attachment);
        if (!colorRenderbuffer) {
          throw new Error("Unable to create multi sampled framebuffer");
        }
        hardwareTexture.addMSAARenderBuffer(colorRenderbuffer);
        texture.samples = samples;
        attachments.push(attachment);
      }
      if (initializeBuffers) {
        gl.drawBuffers(attachments);
      }
    } else {
      this._bindUnboundFramebuffer(rtWrapper._framebuffer);
    }
    const depthFormat = rtWrapper._depthStencilTexture ? rtWrapper._depthStencilTexture.format : void 0;
    rtWrapper._depthStencilBuffer = this._setupFramebufferDepthAttachments(rtWrapper._generateStencilBuffer, rtWrapper._generateDepthBuffer, rtWrapper.width, rtWrapper.height, samples, depthFormat);
    this._bindUnboundFramebuffer(null);
    rtWrapper._samples = samples;
    return samples;
  };
  ThinEngine.prototype.generateMipMapsMultiFramebuffer = function(texture) {
    const rtWrapper = texture;
    const gl = this._gl;
    if (!rtWrapper.isMulti) {
      return;
    }
    for (let i = 0; i < rtWrapper._attachments.length; i++) {
      const texture2 = rtWrapper.textures[i];
      if (texture2?.generateMipMaps && !texture2?.isCube && !texture2?.is3D) {
        this._bindTextureDirectly(gl.TEXTURE_2D, texture2, true);
        gl.generateMipmap(gl.TEXTURE_2D);
        this._bindTextureDirectly(gl.TEXTURE_2D, null);
      }
    }
  };
  ThinEngine.prototype.resolveMultiFramebuffer = function(texture) {
    const rtWrapper = texture;
    const gl = this._gl;
    if (!rtWrapper._MSAAFramebuffer || !rtWrapper.isMulti) {
      return;
    }
    let bufferBits = rtWrapper.resolveMSAAColors ? gl.COLOR_BUFFER_BIT : 0;
    bufferBits |= rtWrapper._generateDepthBuffer && rtWrapper.resolveMSAADepth ? gl.DEPTH_BUFFER_BIT : 0;
    bufferBits |= rtWrapper._generateStencilBuffer && rtWrapper.resolveMSAAStencil ? gl.STENCIL_BUFFER_BIT : 0;
    const attachments = rtWrapper._attachments;
    const count = attachments.length;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rtWrapper._MSAAFramebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, rtWrapper._framebuffer);
    for (let i = 0; i < count; i++) {
      const texture2 = rtWrapper.textures[i];
      for (let j = 0; j < count; j++) {
        attachments[j] = gl.NONE;
      }
      attachments[i] = gl[this.webGLVersion > 1 ? "COLOR_ATTACHMENT" + i : "COLOR_ATTACHMENT" + i + "_WEBGL"];
      gl.readBuffer(attachments[i]);
      gl.drawBuffers(attachments);
      gl.blitFramebuffer(0, 0, texture2.width, texture2.height, 0, 0, texture2.width, texture2.height, bufferBits, gl.NEAREST);
    }
    for (let i = 0; i < count; i++) {
      attachments[i] = gl[this.webGLVersion > 1 ? "COLOR_ATTACHMENT" + i : "COLOR_ATTACHMENT" + i + "_WEBGL"];
    }
    gl.drawBuffers(attachments);
    gl.bindFramebuffer(this._gl.FRAMEBUFFER, rtWrapper._MSAAFramebuffer);
  };
}
class MultiRenderTarget extends RenderTargetTexture {
  /**
   * Get if draw buffers (render textures) are currently supported by the used hardware and browser.
   */
  get isSupported() {
    return this._engine?.getCaps().drawBuffersExtension ?? false;
  }
  /**
   * Get the list of textures generated by the multi render target.
   */
  get textures() {
    return this._textures;
  }
  /**
   * Gets the number of textures in this MRT. This number can be different from `_textures.length` in case a depth texture is generated.
   */
  get count() {
    return this._count;
  }
  /**
   * Get the depth texture generated by the multi render target if options.generateDepthTexture has been set
   */
  get depthTexture() {
    return this._textures[this._textures.length - 1];
  }
  /**
   * Set the wrapping mode on U of all the textures we are rendering to.
   * Can be any of the Texture. (CLAMP_ADDRESSMODE, MIRROR_ADDRESSMODE or WRAP_ADDRESSMODE)
   */
  set wrapU(wrap) {
    if (this._textures) {
      for (let i = 0; i < this._textures.length; i++) {
        this._textures[i].wrapU = wrap;
      }
    }
  }
  /**
   * Set the wrapping mode on V of all the textures we are rendering to.
   * Can be any of the Texture. (CLAMP_ADDRESSMODE, MIRROR_ADDRESSMODE or WRAP_ADDRESSMODE)
   */
  set wrapV(wrap) {
    if (this._textures) {
      for (let i = 0; i < this._textures.length; i++) {
        this._textures[i].wrapV = wrap;
      }
    }
  }
  /**
   * Instantiate a new multi render target texture.
   * A multi render target, like a render target provides the ability to render to a texture.
   * Unlike the render target, it can render to several draw buffers (render textures) in one draw.
   * This is specially interesting in deferred rendering or for any effects requiring more than
   * just one color from a single pass.
   * @param name Define the name of the texture
   * @param size Define the size of the buffers to render to
   * @param count Define the number of target we are rendering into
   * @param scene Define the scene the texture belongs to
   * @param options Define the options used to create the multi render target
   * @param textureNames Define the names to set to the textures (if count \> 0 - optional)
   */
  constructor(name, size, count, scene, options, textureNames) {
    const generateMipMaps = options && options.generateMipMaps ? options.generateMipMaps : false;
    const generateDepthTexture = options && options.generateDepthTexture ? options.generateDepthTexture : false;
    const depthTextureFormat = options && options.depthTextureFormat ? options.depthTextureFormat : 15;
    const doNotChangeAspectRatio = !options || options.doNotChangeAspectRatio === void 0 ? true : options.doNotChangeAspectRatio;
    const drawOnlyOnFirstAttachmentByDefault = options && options.drawOnlyOnFirstAttachmentByDefault ? options.drawOnlyOnFirstAttachmentByDefault : false;
    super(name, size, scene, generateMipMaps, doNotChangeAspectRatio, void 0, void 0, void 0, void 0, void 0, void 0, void 0, true);
    RegisterEnginesExtensionsEngineMultiRender();
    if (!this.isSupported) {
      this.dispose();
      return;
    }
    this._textureNames = textureNames;
    const types = [];
    const samplingModes = [];
    const useSRGBBuffers = [];
    const formats = [];
    const targetTypes = [];
    const faceIndex = [];
    const layerIndex = [];
    const layerCounts = [];
    this._initTypes(count, types, samplingModes, useSRGBBuffers, formats, targetTypes, faceIndex, layerIndex, layerCounts, options);
    const generateDepthBuffer = !options || options.generateDepthBuffer === void 0 ? true : options.generateDepthBuffer;
    const generateStencilBuffer = !options || options.generateStencilBuffer === void 0 ? false : options.generateStencilBuffer;
    const samples = options && options.samples ? options.samples : 1;
    this._multiRenderTargetOptions = {
      samplingModes,
      generateMipMaps,
      generateDepthBuffer,
      generateStencilBuffer,
      generateDepthTexture,
      depthTextureFormat,
      types,
      textureCount: count,
      useSRGBBuffers,
      samples,
      formats,
      targetTypes,
      faceIndex,
      layerIndex,
      layerCounts,
      labels: textureNames,
      label: name
    };
    this._count = count;
    this._drawOnlyOnFirstAttachmentByDefault = drawOnlyOnFirstAttachmentByDefault;
    if (count > 0) {
      this._createInternalTextures();
      this._createTextures(textureNames);
    }
  }
  _initTypes(count, types, samplingModes, useSRGBBuffers, formats, targets, faceIndex, layerIndex, layerCounts, options) {
    for (let i = 0; i < count; i++) {
      if (options && options.types && options.types[i] !== void 0) {
        types.push(options.types[i]);
      } else {
        types.push(options && options.defaultType ? options.defaultType : 0);
      }
      if (options && options.samplingModes && options.samplingModes[i] !== void 0) {
        samplingModes.push(options.samplingModes[i]);
      } else {
        samplingModes.push(Texture.BILINEAR_SAMPLINGMODE);
      }
      if (options && options.useSRGBBuffers && options.useSRGBBuffers[i] !== void 0) {
        useSRGBBuffers.push(options.useSRGBBuffers[i]);
      } else {
        useSRGBBuffers.push(false);
      }
      if (options && options.formats && options.formats[i] !== void 0) {
        formats.push(options.formats[i]);
      } else {
        formats.push(5);
      }
      if (options && options.targetTypes && options.targetTypes[i] !== void 0) {
        targets.push(options.targetTypes[i]);
      } else {
        targets.push(3553);
      }
      if (options && options.faceIndex && options.faceIndex[i] !== void 0) {
        faceIndex.push(options.faceIndex[i]);
      } else {
        faceIndex.push(0);
      }
      if (options && options.layerIndex && options.layerIndex[i] !== void 0) {
        layerIndex.push(options.layerIndex[i]);
      } else {
        layerIndex.push(0);
      }
      if (options && options.layerCounts && options.layerCounts[i] !== void 0) {
        layerCounts.push(options.layerCounts[i]);
      } else {
        layerCounts.push(1);
      }
    }
  }
  _createInternaTextureIndexMapping() {
    const mapMainInternalTexture2Index = {};
    const mapInternalTexture2MainIndex = [];
    if (!this._renderTarget) {
      return mapInternalTexture2MainIndex;
    }
    const internalTextures = this._renderTarget.textures;
    for (let i = 0; i < internalTextures.length; i++) {
      const texture = internalTextures[i];
      if (!texture) {
        continue;
      }
      const mainIndex = mapMainInternalTexture2Index[texture.uniqueId];
      if (mainIndex !== void 0) {
        mapInternalTexture2MainIndex[i] = mainIndex;
      } else {
        mapMainInternalTexture2Index[texture.uniqueId] = i;
      }
    }
    return mapInternalTexture2MainIndex;
  }
  /**
   * @internal
   */
  _rebuild(fromContextLost = false, forceFullRebuild = false, textureNames) {
    if (this._count < 1 || fromContextLost) {
      return;
    }
    const mapInternalTexture2MainIndex = this._createInternaTextureIndexMapping();
    this.releaseInternalTextures();
    this._createInternalTextures();
    if (forceFullRebuild) {
      this._releaseTextures();
      this._createTextures(textureNames);
    }
    const internalTextures = this._renderTarget.textures;
    for (let i = 0; i < internalTextures.length; i++) {
      const texture = this._textures[i];
      if (mapInternalTexture2MainIndex[i] !== void 0) {
        this._renderTarget.setTexture(internalTextures[mapInternalTexture2MainIndex[i]], i);
      }
      texture._texture = internalTextures[i];
      if (texture._texture) {
        texture._noMipmap = !texture._texture.useMipMaps;
        texture._useSRGBBuffer = texture._texture._useSRGBBuffer;
      }
    }
    if (this.samples !== 1) {
      this._renderTarget.setSamples(this.samples, !this._drawOnlyOnFirstAttachmentByDefault, true);
    }
  }
  _createInternalTextures() {
    this._renderTarget = this._getEngine().createMultipleRenderTarget(this._size, this._multiRenderTargetOptions, !this._drawOnlyOnFirstAttachmentByDefault);
    this._texture = this._renderTarget.texture;
  }
  _releaseTextures() {
    if (this._textures) {
      for (let i = 0; i < this._textures.length; i++) {
        this._textures[i]._texture = null;
        this._textures[i].dispose();
      }
    }
  }
  _createTextures(textureNames) {
    const internalTextures = this._renderTarget.textures;
    this._textures = [];
    for (let i = 0; i < internalTextures.length; i++) {
      const texture = new Texture(null, this.getScene());
      if (textureNames?.[i]) {
        texture.name = textureNames[i];
      }
      texture._texture = internalTextures[i];
      if (texture._texture) {
        texture._noMipmap = !texture._texture.useMipMaps;
        texture._useSRGBBuffer = texture._texture._useSRGBBuffer;
      }
      this._textures.push(texture);
    }
  }
  /**
   * Replaces an internal texture within the MRT. Useful to share textures between MultiRenderTarget.
   * @param texture The new texture to set in the MRT
   * @param index The index of the texture to replace
   * @param disposePrevious Set to true if the previous internal texture should be disposed
   */
  setInternalTexture(texture, index, disposePrevious = true) {
    if (!this.renderTarget) {
      return;
    }
    if (index === 0) {
      this._texture = texture;
    }
    this.renderTarget.setTexture(texture, index, disposePrevious);
    if (!this.textures[index]) {
      this.textures[index] = new Texture(null, this.getScene());
      this.textures[index].name = this._textureNames?.[index] ?? this.textures[index].name;
    }
    this.textures[index]._texture = texture;
    this.textures[index]._noMipmap = !texture.useMipMaps;
    this.textures[index]._useSRGBBuffer = texture._useSRGBBuffer;
    this._count = this.renderTarget.textures ? this.renderTarget.textures.length : 0;
    if (this._multiRenderTargetOptions.types) {
      this._multiRenderTargetOptions.types[index] = texture.type;
    }
    if (this._multiRenderTargetOptions.samplingModes) {
      this._multiRenderTargetOptions.samplingModes[index] = texture.samplingMode;
    }
    if (this._multiRenderTargetOptions.useSRGBBuffers) {
      this._multiRenderTargetOptions.useSRGBBuffers[index] = texture._useSRGBBuffer;
    }
    if (this._multiRenderTargetOptions.targetTypes && this._multiRenderTargetOptions.targetTypes[index] !== -1) {
      let target;
      if (texture.is2DArray) {
        target = 35866;
      } else if (texture.isCube) {
        target = 34067;
      } else if (texture.is3D) {
        target = 32879;
      } else {
        target = 3553;
      }
      this._multiRenderTargetOptions.targetTypes[index] = target;
    }
  }
  /**
   * Changes an attached texture's face index or layer.
   * @param index The index of the texture to modify the attachment of
   * @param layerIndex The layer index of the texture to be attached to the framebuffer
   * @param faceIndex The face index of the texture to be attached to the framebuffer
   */
  setLayerAndFaceIndex(index, layerIndex = -1, faceIndex = -1) {
    if (!this.textures[index] || !this.renderTarget) {
      return;
    }
    if (this._multiRenderTargetOptions.layerIndex) {
      this._multiRenderTargetOptions.layerIndex[index] = layerIndex;
    }
    if (this._multiRenderTargetOptions.faceIndex) {
      this._multiRenderTargetOptions.faceIndex[index] = faceIndex;
    }
    this.renderTarget.setLayerAndFaceIndex(index, layerIndex, faceIndex);
  }
  /**
   * Changes every attached texture's face index or layer.
   * @param layerIndices The layer indices of the texture to be attached to the framebuffer
   * @param faceIndices The face indices of the texture to be attached to the framebuffer
   */
  setLayerAndFaceIndices(layerIndices, faceIndices) {
    if (!this.renderTarget) {
      return;
    }
    this._multiRenderTargetOptions.layerIndex = layerIndices;
    this._multiRenderTargetOptions.faceIndex = faceIndices;
    this.renderTarget.setLayerAndFaceIndices(layerIndices, faceIndices);
  }
  /**
   * Define the number of samples used if MSAA is enabled.
   */
  get samples() {
    return this._samples;
  }
  set samples(value) {
    if (this._renderTarget) {
      this._samples = this._renderTarget.setSamples(value);
    } else {
      this._samples = value;
    }
  }
  /**
   * Resize all the textures in the multi render target.
   * Be careful as it will recreate all the data in the new texture.
   * @param size Define the new size
   */
  resize(size) {
    this._processSizeParameter(size);
    this._rebuild(false, void 0, this._textureNames);
  }
  /**
   * Changes the number of render targets in this MRT
   * Be careful as it will recreate all the data in the new texture.
   * @param count new texture count
   * @param options Specifies texture types and sampling modes for new textures
   * @param textureNames Specifies the names of the textures (optional)
   */
  updateCount(count, options, textureNames) {
    this._multiRenderTargetOptions.textureCount = count;
    this._count = count;
    const types = [];
    const samplingModes = [];
    const useSRGBBuffers = [];
    const formats = [];
    const targetTypes = [];
    const faceIndex = [];
    const layerIndex = [];
    const layerCounts = [];
    this._textureNames = textureNames;
    this._initTypes(count, types, samplingModes, useSRGBBuffers, formats, targetTypes, faceIndex, layerIndex, layerCounts, options);
    this._multiRenderTargetOptions.types = types;
    this._multiRenderTargetOptions.samplingModes = samplingModes;
    this._multiRenderTargetOptions.useSRGBBuffers = useSRGBBuffers;
    this._multiRenderTargetOptions.formats = formats;
    this._multiRenderTargetOptions.targetTypes = targetTypes;
    this._multiRenderTargetOptions.faceIndex = faceIndex;
    this._multiRenderTargetOptions.layerIndex = layerIndex;
    this._multiRenderTargetOptions.layerCounts = layerCounts;
    this._multiRenderTargetOptions.labels = textureNames;
    this._rebuild(false, true, textureNames);
  }
  _unbindFrameBuffer(engine, faceIndex) {
    if (this._renderTarget) {
      engine.unBindMultiColorAttachmentFramebuffer(this._renderTarget, this.isCube, () => {
        this.onAfterRenderObservable.notifyObservers(faceIndex);
      });
    }
  }
  /**
   * Dispose the render targets and their associated resources
   * @param doNotDisposeInternalTextures if set to true, internal textures won't be disposed (default: false).
   */
  dispose(doNotDisposeInternalTextures = false) {
    this._releaseTextures();
    if (!doNotDisposeInternalTextures) {
      this.releaseInternalTextures();
    } else {
      this._texture = null;
    }
    super.dispose();
  }
  /**
   * Release all the underlying texture used as draw buffers (render textures).
   */
  releaseInternalTextures() {
    const internalTextures = this._renderTarget?.textures;
    if (!internalTextures) {
      return;
    }
    for (let i = internalTextures.length - 1; i >= 0; i--) {
      this._textures[i]._texture = null;
    }
    this._renderTarget?.dispose();
    this._renderTarget = null;
  }
}
export {
  MultiRenderTarget as M,
  RegisterEnginesExtensionsEngineMultiRender as R
};
