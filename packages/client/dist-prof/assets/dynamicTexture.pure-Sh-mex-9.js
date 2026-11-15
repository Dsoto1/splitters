import { aC as ThinEngine, ae as InternalTexture, aD as GetExponentOfTwo, G as Texture, L as Logger } from "./babylon-PnzH6wcM.js";
let _Registered = false;
function RegisterEnginesExtensionsEngineDynamicTexture() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  ThinEngine.prototype.createDynamicTexture = function(width, height, generateMipMaps, samplingMode) {
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
    return texture;
  };
  ThinEngine.prototype.updateDynamicTexture = function(texture, source, invertY, premulAlpha = false, format, forceBindTexture = false, allowGPUOptimization = false) {
    if (!texture) {
      return;
    }
    const gl = this._gl;
    const target = gl.TEXTURE_2D;
    const wasPreviouslyBound = this._bindTextureDirectly(target, texture, true, forceBindTexture);
    this._unpackFlipY(invertY === void 0 ? texture.invertY : invertY);
    if (premulAlpha) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    }
    const textureType = this._getWebGLTextureType(texture.type);
    const glformat = this._getInternalFormat(format ? format : texture.format);
    const internalFormat = this._getRGBABufferInternalSizedFormat(texture.type, glformat);
    gl.texImage2D(target, 0, internalFormat, glformat, textureType, source);
    if (texture.generateMipMaps) {
      gl.generateMipmap(target);
    }
    if (!wasPreviouslyBound) {
      this._bindTextureDirectly(target, null);
    }
    if (premulAlpha) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    }
    if (format) {
      texture.format = format;
    }
    texture._dynamicTextureSource = source;
    texture._premulAlpha = premulAlpha;
    texture.invertY = invertY || false;
    texture.isReady = true;
  };
}
class DynamicTexture extends Texture {
  /** @internal */
  constructor(name, canvasOrSize, sceneOrOptions, generateMipMaps = false, samplingMode = 3, format = 5, invertY) {
    const isScene = !sceneOrOptions || sceneOrOptions._isScene;
    const scene = isScene ? sceneOrOptions : sceneOrOptions?.scene;
    const noMipmap = isScene ? !generateMipMaps : sceneOrOptions;
    super(null, scene, noMipmap, invertY, samplingMode, void 0, void 0, void 0, void 0, format);
    RegisterEnginesExtensionsEngineDynamicTexture();
    this.name = name;
    this.wrapU = Texture.CLAMP_ADDRESSMODE;
    this.wrapV = Texture.CLAMP_ADDRESSMODE;
    this._generateMipMaps = generateMipMaps;
    const engine = this._getEngine();
    if (!engine) {
      return;
    }
    if (canvasOrSize.getContext) {
      this._canvas = canvasOrSize;
      this._ownCanvas = false;
      this._texture = engine.createDynamicTexture(this._canvas.width, this._canvas.height, generateMipMaps, samplingMode);
    } else {
      this._canvas = engine.createCanvas(1, 1);
      this._ownCanvas = true;
      const optionsAsSize = canvasOrSize;
      if (optionsAsSize.width || optionsAsSize.width === 0) {
        this._texture = engine.createDynamicTexture(optionsAsSize.width, optionsAsSize.height, generateMipMaps, samplingMode);
      } else {
        this._texture = engine.createDynamicTexture(canvasOrSize, canvasOrSize, generateMipMaps, samplingMode);
      }
    }
    const textureSize = this.getSize();
    if (this._canvas.width !== textureSize.width) {
      this._canvas.width = textureSize.width;
    }
    if (this._canvas.height !== textureSize.height) {
      this._canvas.height = textureSize.height;
    }
    this._context = this._canvas.getContext("2d");
  }
  /**
   * Get the current class name of the texture useful for serialization or dynamic coding.
   * @returns "DynamicTexture"
   */
  getClassName() {
    return "DynamicTexture";
  }
  /**
   * Gets the current state of canRescale
   */
  get canRescale() {
    return true;
  }
  _recreate(textureSize) {
    this._canvas.width = textureSize.width;
    this._canvas.height = textureSize.height;
    this.releaseInternalTexture();
    this._texture = this._getEngine().createDynamicTexture(textureSize.width, textureSize.height, this._generateMipMaps, this.samplingMode);
  }
  /**
   * Scales the texture
   * @param ratio the scale factor to apply to both width and height
   */
  scale(ratio) {
    const textureSize = this.getSize();
    textureSize.width *= ratio;
    textureSize.height *= ratio;
    this._recreate(textureSize);
  }
  /**
   * Resizes the texture
   * @param width the new width
   * @param height the new height
   */
  scaleTo(width, height) {
    const textureSize = this.getSize();
    textureSize.width = width;
    textureSize.height = height;
    this._recreate(textureSize);
  }
  /**
   * Gets the context of the canvas used by the texture
   * @returns the canvas context of the dynamic texture
   */
  getContext() {
    return this._context;
  }
  /**
   * Clears the texture
   * @param clearColor Defines the clear color to use
   */
  clear(clearColor) {
    const size = this.getSize();
    if (clearColor) {
      this._context.fillStyle = clearColor;
    }
    this._context.clearRect(0, 0, size.width, size.height);
  }
  /**
   * Updates the texture
   * @param invertY defines the direction for the Y axis (default is true - y increases downwards)
   * @param premulAlpha defines if alpha is stored as premultiplied (default is false)
   * @param allowGPUOptimization true to allow some specific GPU optimizations (subject to engine feature "allowGPUOptimizationsForGUI" being true)
   */
  update(invertY, premulAlpha = false, allowGPUOptimization = false) {
    if (!this._texture) {
      return;
    }
    this._getEngine().updateDynamicTexture(this._texture, this._canvas, invertY === void 0 ? true : invertY, premulAlpha, this._format || void 0, void 0, allowGPUOptimization);
  }
  /**
   * Draws text onto the texture
   * @param text defines the text to be drawn
   * @param x defines the placement of the text from the left
   * @param y defines the placement of the text from the top when invertY is true and from the bottom when false
   * @param font defines the font to be used with font-style, font-size, font-name
   * @param color defines the color used for the text
   * @param fillColor defines the color for the canvas, use null to not overwrite canvas (this blends with the background to replace, use the clear function)
   * @param invertY defines the direction for the Y axis (default is true - y increases downwards)
   * @param update defines whether texture is immediately update (default is true)
   */
  drawText(text, x, y, font, color, fillColor, invertY, update = true) {
    const size = this.getSize();
    if (fillColor) {
      this._context.fillStyle = fillColor;
      this._context.fillRect(0, 0, size.width, size.height);
    }
    this._context.font = font;
    if (x === null || x === void 0) {
      const textSize = this._context.measureText(text);
      x = (size.width - textSize.width) / 2;
    }
    if (y === null || y === void 0) {
      const fontSize = parseInt(font.replace(/\D/g, ""));
      y = size.height / 2 + fontSize / 3.65;
    }
    this._context.fillStyle = color || "";
    this._context.fillText(text, x, y);
    if (update) {
      this.update(invertY);
    }
  }
  /**
   * Disposes the dynamic texture.
   */
  dispose() {
    super.dispose();
    if (this._ownCanvas) {
      this._canvas?.remove?.();
    }
    this._canvas = null;
    this._context = null;
  }
  /**
   * Clones the texture
   * @returns the clone of the texture.
   */
  clone() {
    const scene = this.getScene();
    if (!scene) {
      return this;
    }
    const textureSize = this.getSize();
    const newTexture = new DynamicTexture(this.name, textureSize, scene, this._generateMipMaps);
    newTexture.hasAlpha = this.hasAlpha;
    newTexture.level = this.level;
    newTexture.wrapU = this.wrapU;
    newTexture.wrapV = this.wrapV;
    return newTexture;
  }
  /**
   * Serializes the dynamic texture.  The scene should be ready before the dynamic texture is serialized
   * @returns a serialized dynamic texture object
   */
  serialize() {
    const scene = this.getScene();
    if (scene && !scene.isReady()) {
      Logger.Warn("The scene must be ready before serializing the dynamic texture");
    }
    const serializationObject = super.serialize();
    if (DynamicTexture._IsCanvasElement(this._canvas)) {
      serializationObject.base64String = this._canvas.toDataURL();
    }
    serializationObject.invertY = this._invertY;
    serializationObject.samplingMode = this.samplingMode;
    return serializationObject;
  }
  static _IsCanvasElement(canvas) {
    return canvas.toDataURL !== void 0;
  }
  /** @internal */
  _rebuild() {
    this.update();
  }
}
export {
  DynamicTexture as D,
  RegisterEnginesExtensionsEngineDynamicTexture as R
};
