const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/procedural.vertex-DpYoRCXS.js","assets/babylon-PnzH6wcM.js","assets/procedural.vertex-CGJbY37e.js"])))=>i.map(i=>d[i]);
import { aI as SceneComponentConstants, a5 as Tools, a8 as __runInitializers, O as Observable, G as Texture, I as EngineStore, bo as DrawWrapper, j as VertexBuffer, aH as RenderTargetTexture, a9 as __vitePreload, aM as Material, a7 as __esDecorate, z as RegisterClass, bm as serialize } from "./babylon-PnzH6wcM.js";
class ProceduralTextureSceneComponent {
  /**
   * Creates a new instance of the component for the given scene
   * @param scene Defines the scene to register the component in
   */
  constructor(scene) {
    this.name = SceneComponentConstants.NAME_PROCEDURALTEXTURE;
    this.scene = scene;
  }
  /**
   * Registers the component in a given scene
   */
  register() {
    this.scene._beforeClearStage.registerStep(SceneComponentConstants.STEP_BEFORECLEAR_PROCEDURALTEXTURE, this, this._beforeClear);
  }
  /**
   * Rebuilds the elements related to this component in case of
   * context lost for instance.
   */
  rebuild() {
  }
  /**
   * Disposes the component and the associated resources.
   */
  dispose() {
  }
  _beforeClear() {
    if (this.scene.proceduralTexturesEnabled) {
      Tools.StartPerformanceCounter("Procedural textures", this.scene.proceduralTextures.length > 0);
      for (let proceduralIndex = 0; proceduralIndex < this.scene.proceduralTextures.length; proceduralIndex++) {
        const proceduralTexture = this.scene.proceduralTextures[proceduralIndex];
        if (proceduralTexture._shouldRender()) {
          proceduralTexture.render();
        }
      }
      Tools.EndPerformanceCounter("Procedural textures", this.scene.proceduralTextures.length > 0);
    }
  }
}
let ProceduralTexture = (() => {
  var _a;
  let _classSuper = Texture;
  let _instanceExtraInitializers = [];
  let _isEnabled_decorators;
  let _isEnabled_initializers = [];
  let _isEnabled_extraInitializers = [];
  let _autoClear_decorators;
  let _autoClear_initializers = [];
  let _autoClear_extraInitializers = [];
  let __generateMipMaps_decorators;
  let __generateMipMaps_initializers = [];
  let __generateMipMaps_extraInitializers = [];
  let __size_decorators;
  let __size_initializers = [];
  let __size_extraInitializers = [];
  let _get_refreshRate_decorators;
  return _a = class ProceduralTexture extends _classSuper {
    /**
     * Gets the shader language type used to generate vertex and fragment source code.
     */
    get shaderLanguage() {
      return this._shaderLanguage;
    }
    /**
     * Instantiates a new procedural texture.
     * Procedural texturing is a way to programmatically create a texture. There are 2 types of procedural textures: code-only, and code that references some classic 2D images, sometimes called 'refMaps' or 'sampler' images.
     * This is the base class of any Procedural texture and contains most of the shareable code.
     * @see https://doc.babylonjs.com/features/featuresDeepDive/materials/using/proceduralTextures
     * @param name  Define the name of the texture
     * @param size Define the size of the texture to create
     * @param fragment Define the fragment shader to use to generate the texture or null if it is defined later:
     *  * object: \{ fragmentElement: "fragmentShaderCode" \}, used with shader code in script tags
     *  * object: \{ fragmentSource: "fragment shader code string" \}, the string contains the shader code
     *  * string: the string contains a name "XXX" to lookup in Effect.ShadersStore["XXXFragmentShader"]
     * @param scene Define the scene the texture belongs to
     * @param fallbackTexture Define a fallback texture in case there were issues to create the custom texture
     * @param generateMipMaps Define if the texture should creates mip maps or not
     * @param isCube Define if the texture is a cube texture or not (this will render each faces of the cube)
     * @param textureType The FBO internal texture type
     */
    constructor(name, size, fragment, scene, fallbackTexture = null, generateMipMaps = true, isCube = false, textureType = 0) {
      super(null, scene, !generateMipMaps);
      this.isEnabled = (__runInitializers(this, _instanceExtraInitializers), __runInitializers(this, _isEnabled_initializers, true));
      this.autoClear = (__runInitializers(this, _isEnabled_extraInitializers), __runInitializers(this, _autoClear_initializers, true));
      this.onGenerated = __runInitializers(this, _autoClear_extraInitializers);
      this.onGeneratedObservable = new Observable();
      this.onBeforeGenerationObservable = new Observable();
      this.nodeMaterialSource = null;
      this.defines = "";
      this._generateMipMaps = __runInitializers(this, __generateMipMaps_initializers, void 0);
      this._drawWrapper = __runInitializers(this, __generateMipMaps_extraInitializers);
      this._textures = {};
      this._size = __runInitializers(this, __size_initializers, void 0);
      this._textureType = __runInitializers(this, __size_extraInitializers);
      this._currentRefreshId = -1;
      this._frameId = -1;
      this._refreshRate = 1;
      this._vertexBuffers = {};
      this._uniforms = new Array();
      this._samplers = new Array();
      this._floats = {};
      this._ints = {};
      this._floatsArrays = {};
      this._colors3 = {};
      this._colors4 = {};
      this._vectors2 = {};
      this._vectors3 = {};
      this._vectors4 = {};
      this._matrices = {};
      this._fallbackTextureUsed = false;
      this._cachedDefines = null;
      this._contentUpdateId = -1;
      this._rtWrapper = null;
      if (fallbackTexture !== null && !(fallbackTexture instanceof Texture)) {
        this._options = fallbackTexture;
        this._fallbackTexture = fallbackTexture.fallbackTexture ?? null;
      } else {
        this._options = {};
        this._fallbackTexture = fallbackTexture;
      }
      this._shaderLanguage = this._options.shaderLanguage ?? 0;
      scene = this.getScene() || EngineStore.LastCreatedScene;
      let component = scene._getComponent(SceneComponentConstants.NAME_PROCEDURALTEXTURE);
      if (!component) {
        component = new ProceduralTextureSceneComponent(scene);
        scene._addComponent(component);
      }
      if (!this._options.skipSceneRegistration) {
        scene.proceduralTextures.push(this);
      }
      this._fullEngine = scene.getEngine();
      this.name = name;
      this.isRenderTarget = true;
      this._size = size;
      this._textureType = textureType;
      this._generateMipMaps = generateMipMaps;
      this._drawWrapper = new DrawWrapper(this._fullEngine);
      this.setFragment(fragment);
      const rtWrapper = this._createRtWrapper(isCube, size, generateMipMaps, textureType);
      this._texture = rtWrapper.texture;
      const vertices = [];
      vertices.push(1, 1);
      vertices.push(-1, 1);
      vertices.push(-1, -1);
      vertices.push(1, -1);
      this._vertexBuffers[VertexBuffer.PositionKind] = new VertexBuffer(this._fullEngine, vertices, VertexBuffer.PositionKind, false, false, 2);
      this._createIndexBuffer();
    }
    _createRtWrapper(isCube, size, generateMipMaps, textureType) {
      if (isCube) {
        this._rtWrapper = this._fullEngine.createRenderTargetCubeTexture(size, {
          generateMipMaps,
          generateDepthBuffer: false,
          generateStencilBuffer: false,
          type: textureType,
          ...this._options
        });
        this.setFloat("face", 0);
      } else {
        this._rtWrapper = this._fullEngine.createRenderTargetTexture(size, {
          generateMipMaps,
          generateDepthBuffer: false,
          generateStencilBuffer: false,
          type: textureType,
          ...this._options
        });
        if (this._rtWrapper.is3D) {
          this.setFloat("layer", 0);
          this.setInt("layerNum", 0);
        }
      }
      return this._rtWrapper;
    }
    /**
     * The effect that is created when initializing the post process.
     * @returns The created effect corresponding the postprocess.
     */
    getEffect() {
      return this._drawWrapper.effect;
    }
    /**
     * @internal
     */
    _setEffect(effect) {
      this._drawWrapper.effect = effect;
    }
    /**
     * Gets texture content (Use this function wisely as reading from a texture can be slow)
     * @returns an ArrayBufferView promise (Uint8Array or Float32Array)
     */
    getContent() {
      if (this._contentData && this._frameId === this._contentUpdateId) {
        return this._contentData;
      }
      if (this._contentData) {
        const contentData = this._contentData;
        contentData.then((buffer) => {
          if (this._contentData !== contentData) {
            return;
          }
          this._readContent(buffer);
        }).catch(() => {
        });
      } else {
        this._readContent();
      }
      return this._contentData;
    }
    _readContent(buffer) {
      const contentData = buffer ? this.readPixels(0, 0, buffer) : this.readPixels(0, 0);
      this._contentData = contentData;
      this._contentUpdateId = this._frameId;
      contentData?.catch(() => {
        if (this._contentData === contentData) {
          this._contentData = null;
          this._contentUpdateId = -1;
        }
      });
    }
    _createIndexBuffer() {
      const engine = this._fullEngine;
      const indices = [];
      indices.push(0);
      indices.push(1);
      indices.push(2);
      indices.push(0);
      indices.push(2);
      indices.push(3);
      this._indexBuffer = engine.createIndexBuffer(indices);
    }
    /** @internal */
    _rebuild() {
      const vb = this._vertexBuffers[VertexBuffer.PositionKind];
      if (vb) {
        vb._rebuild();
      }
      this._createIndexBuffer();
      if (this.refreshRate === RenderTargetTexture.REFRESHRATE_RENDER_ONCE) {
        this.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
      }
    }
    /**
     * Resets the texture in order to recreate its associated resources.
     * This can be called in case of context loss or if you change the shader code and need to regenerate the texture with the new code
     */
    reset() {
      this._drawWrapper.effect?.dispose();
      this._drawWrapper.effect = null;
      this._cachedDefines = null;
    }
    _getDefines() {
      return this.defines;
    }
    /**
     * Executes a function when the texture will be ready to be drawn.
     * @param func The callback to be used.
     */
    executeWhenReady(func) {
      if (this.isReady()) {
        func(this);
        return;
      }
      const effect = this.getEffect();
      if (effect) {
        effect.executeWhenCompiled(() => {
          func(this);
        });
      }
    }
    /**
     * Is the texture ready to be used ? (rendered at least once)
     * @returns true if ready, otherwise, false.
     */
    isReady() {
      const engine = this._fullEngine;
      if (this.nodeMaterialSource) {
        return this._drawWrapper.effect?.isReady() ?? false;
      }
      if (!this._fragment) {
        return false;
      }
      if (this._fallbackTextureUsed) {
        return true;
      }
      if (!this._texture) {
        return false;
      }
      const defines = this._getDefines();
      if (this._drawWrapper.effect && defines === this._cachedDefines && this._drawWrapper.effect.isReady()) {
        return true;
      }
      const shaders = {
        vertex: "procedural",
        fragmentElement: this._fragment.fragmentElement,
        fragmentSource: this._fragment.fragmentSource,
        fragment: typeof this._fragment === "string" ? this._fragment : void 0
      };
      if (this._cachedDefines !== defines) {
        this._cachedDefines = defines;
        this._drawWrapper.effect = engine.createEffect(shaders, [VertexBuffer.PositionKind], this._uniforms, this._samplers, defines, void 0, void 0, () => {
          this._rtWrapper?.dispose();
          this._rtWrapper = this._texture = null;
          this._contentData = null;
          this._contentUpdateId = -1;
          if (this._fallbackTexture) {
            this._texture = this._fallbackTexture._texture;
            if (this._texture) {
              this._texture.incrementReferences();
            }
          }
          this._fallbackTextureUsed = true;
        }, void 0, this._shaderLanguage, async () => {
          if (this._options.extraInitializationsAsync) {
            if (this.shaderLanguage === 1) {
              await Promise.all([__vitePreload(() => import("./procedural.vertex-DpYoRCXS.js"), true ? __vite__mapDeps([0,1]) : void 0), this._options.extraInitializationsAsync()]);
            } else {
              await Promise.all([__vitePreload(() => import("./procedural.vertex-CGJbY37e.js"), true ? __vite__mapDeps([2,1]) : void 0), this._options.extraInitializationsAsync()]);
            }
          } else {
            if (this.shaderLanguage === 1) {
              await __vitePreload(() => import("./procedural.vertex-DpYoRCXS.js"), true ? __vite__mapDeps([0,1]) : void 0);
            } else {
              await __vitePreload(() => import("./procedural.vertex-CGJbY37e.js"), true ? __vite__mapDeps([2,1]) : void 0);
            }
          }
        });
      }
      return this._drawWrapper.effect.isReady();
    }
    /**
     * Resets the refresh counter of the texture and start bak from scratch.
     * Could be useful to regenerate the texture if it is setup to render only once.
     */
    resetRefreshCounter() {
      this._currentRefreshId = -1;
    }
    /**
     * Set the fragment shader to use in order to render the texture.
     * @param fragment This can be set to a path (into the shader store) or to a json object containing a fragmentElement property.
     */
    setFragment(fragment) {
      this._fragment = fragment;
    }
    /**
     * Define the refresh rate of the texture or the rendering frequency.
     * Use 0 to render just once, 1 to render on every frame, 2 to render every two frames and so on...
     */
    get refreshRate() {
      return this._refreshRate;
    }
    set refreshRate(value) {
      this._refreshRate = value;
      this.resetRefreshCounter();
    }
    /** @internal */
    _shouldRender() {
      if (!this.isEnabled || !this.isReady() || !this._texture) {
        if (this._texture) {
          this._texture.isReady = false;
        }
        return false;
      }
      if (this._fallbackTextureUsed) {
        return false;
      }
      if (this._currentRefreshId === -1) {
        this._currentRefreshId = 1;
        this._frameId++;
        return true;
      }
      if (this.refreshRate === this._currentRefreshId) {
        this._currentRefreshId = 1;
        this._frameId++;
        return true;
      }
      this._currentRefreshId++;
      return false;
    }
    /**
     * Get the size the texture is rendering at.
     * @returns the size (on cube texture it is always squared)
     */
    getRenderSize() {
      return this._size;
    }
    /**
     * Resize the texture to new value.
     * @param size Define the new size the texture should have
     * @param generateMipMaps Define whether the new texture should create mip maps
     */
    resize(size, generateMipMaps) {
      if (this._fallbackTextureUsed || !this._rtWrapper || !this._texture) {
        return;
      }
      const isCube = this._texture.isCube;
      this._rtWrapper.dispose();
      const rtWrapper = this._createRtWrapper(isCube, size, generateMipMaps, this._textureType);
      this._texture = rtWrapper.texture;
      this._size = size;
      this._generateMipMaps = generateMipMaps;
      this._contentData = null;
      this._contentUpdateId = -1;
    }
    _checkUniform(uniformName) {
      if (this._uniforms.indexOf(uniformName) === -1) {
        this._uniforms.push(uniformName);
      }
    }
    /**
     * Set a texture in the shader program used to render.
     * @param name Define the name of the uniform samplers as defined in the shader
     * @param texture Define the texture to bind to this sampler
     * @returns the texture itself allowing "fluent" like uniform updates
     */
    setTexture(name, texture) {
      if (this._samplers.indexOf(name) === -1) {
        this._samplers.push(name);
      }
      this._textures[name] = texture;
      return this;
    }
    /**
     * Set a float in the shader.
     * @param name Define the name of the uniform as defined in the shader
     * @param value Define the value to give to the uniform
     * @returns the texture itself allowing "fluent" like uniform updates
     */
    setFloat(name, value) {
      this._checkUniform(name);
      this._floats[name] = value;
      return this;
    }
    /**
     * Set a int in the shader.
     * @param name Define the name of the uniform as defined in the shader
     * @param value Define the value to give to the uniform
     * @returns the texture itself allowing "fluent" like uniform updates
     */
    setInt(name, value) {
      this._checkUniform(name);
      this._ints[name] = value;
      return this;
    }
    /**
     * Set an array of floats in the shader.
     * @param name Define the name of the uniform as defined in the shader
     * @param value Define the value to give to the uniform
     * @returns the texture itself allowing "fluent" like uniform updates
     */
    setFloats(name, value) {
      this._checkUniform(name);
      this._floatsArrays[name] = value;
      return this;
    }
    /**
     * Set a vec3 in the shader.
     * @param name Define the name of the uniform as defined in the shader
     * @param value Define the value to give to the uniform
     * @returns the texture itself allowing "fluent" like uniform updates
     */
    setColor3(name, value) {
      this._checkUniform(name);
      this._colors3[name] = value;
      return this;
    }
    /**
     * Set a vec4 in the shader.
     * @param name Define the name of the uniform as defined in the shader
     * @param value Define the value to give to the uniform
     * @returns the texture itself allowing "fluent" like uniform updates
     */
    setColor4(name, value) {
      this._checkUniform(name);
      this._colors4[name] = value;
      return this;
    }
    /**
     * Set a vec2 in the shader.
     * @param name Define the name of the uniform as defined in the shader
     * @param value Define the value to give to the uniform
     * @returns the texture itself allowing "fluent" like uniform updates
     */
    setVector2(name, value) {
      this._checkUniform(name);
      this._vectors2[name] = value;
      return this;
    }
    /**
     * Set a vec3 in the shader.
     * @param name Define the name of the uniform as defined in the shader
     * @param value Define the value to give to the uniform
     * @returns the texture itself allowing "fluent" like uniform updates
     */
    setVector3(name, value) {
      this._checkUniform(name);
      this._vectors3[name] = value;
      return this;
    }
    /**
     * Set a vec4 in the shader.
     * @param name Define the name of the uniform as defined in the shader
     * @param value Define the value to give to the uniform
     * @returns the texture itself allowing "fluent" like uniform updates
     */
    setVector4(name, value) {
      this._checkUniform(name);
      this._vectors4[name] = value;
      return this;
    }
    /**
     * Set a mat4 in the shader.
     * @param name Define the name of the uniform as defined in the shader
     * @param value Define the value to give to the uniform
     * @returns the texture itself allowing "fluent" like uniform updates
     */
    setMatrix(name, value) {
      this._checkUniform(name);
      this._matrices[name] = value;
      return this;
    }
    /**
     * Render the texture to its associated render target.
     * @param useCameraPostProcess Define if camera post process should be applied to the texture
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    render(useCameraPostProcess) {
      const scene = this.getScene();
      if (!scene) {
        return;
      }
      const engine = this._fullEngine;
      engine.enableEffect(this._drawWrapper);
      this.onBeforeGenerationObservable.notifyObservers(this);
      engine.setState(false);
      if (!this.nodeMaterialSource) {
        for (const name in this._textures) {
          this._drawWrapper.effect.setTexture(name, this._textures[name]);
        }
        for (const name in this._ints) {
          this._drawWrapper.effect.setInt(name, this._ints[name]);
        }
        for (const name in this._floats) {
          this._drawWrapper.effect.setFloat(name, this._floats[name]);
        }
        for (const name in this._floatsArrays) {
          this._drawWrapper.effect.setArray(name, this._floatsArrays[name]);
        }
        for (const name in this._colors3) {
          this._drawWrapper.effect.setColor3(name, this._colors3[name]);
        }
        for (const name in this._colors4) {
          const color = this._colors4[name];
          this._drawWrapper.effect.setFloat4(name, color.r, color.g, color.b, color.a);
        }
        for (const name in this._vectors2) {
          this._drawWrapper.effect.setVector2(name, this._vectors2[name]);
        }
        for (const name in this._vectors3) {
          this._drawWrapper.effect.setVector3(name, this._vectors3[name]);
        }
        for (const name in this._vectors4) {
          this._drawWrapper.effect.setVector4(name, this._vectors4[name]);
        }
        for (const name in this._matrices) {
          this._drawWrapper.effect.setMatrix(name, this._matrices[name]);
        }
      }
      if (!this._texture || !this._rtWrapper) {
        return;
      }
      if (engine._enableGPUDebugMarkers) {
        engine._debugPushGroup?.(`procedural texture generation for ${this.name}`);
      }
      const viewPort = engine.currentViewport;
      if (this.isCube) {
        for (let face = 0; face < 6; face++) {
          engine.bindFramebuffer(this._rtWrapper, face, void 0, void 0, true);
          engine.bindBuffers(this._vertexBuffers, this._indexBuffer, this._drawWrapper.effect);
          this._drawWrapper.effect.setFloat("face", face);
          if (this.autoClear) {
            engine.clear(scene.clearColor, true, false, false);
          }
          engine.drawElementsType(Material.TriangleFillMode, 0, 6);
          engine.unBindFramebuffer(this._rtWrapper, true);
        }
      } else {
        let numLayers = 1;
        if (this._rtWrapper.is3D) {
          numLayers = this._rtWrapper.depth;
        } else if (this._rtWrapper.is2DArray) {
          numLayers = this._rtWrapper.layers;
        }
        for (let layer = 0; layer < numLayers; layer++) {
          engine.bindFramebuffer(this._rtWrapper, 0, void 0, void 0, true, 0, layer);
          engine.bindBuffers(this._vertexBuffers, this._indexBuffer, this._drawWrapper.effect);
          if (this._rtWrapper.is3D || this._rtWrapper.is2DArray) {
            this._drawWrapper.effect?.setFloat("layer", numLayers !== 1 ? layer / (numLayers - 1) : 0);
            this._drawWrapper.effect?.setInt("layerNum", layer);
            for (const name in this._textures) {
              this._drawWrapper.effect.setTexture(name, this._textures[name]);
            }
          }
          if (this.autoClear) {
            engine.clear(scene.clearColor, true, false, false);
          }
          engine.drawElementsType(Material.TriangleFillMode, 0, 6);
          engine.unBindFramebuffer(this._rtWrapper, !this._generateMipMaps);
        }
      }
      if (viewPort) {
        engine.setViewport(viewPort);
      }
      if (this.isCube) {
        engine.generateMipMapsForCubemap(this._texture, true);
      }
      if (engine._enableGPUDebugMarkers) {
        engine._debugPopGroup?.();
      }
      if (this.onGenerated) {
        this.onGenerated();
      }
      this.onGeneratedObservable.notifyObservers(this);
    }
    /**
     * Clone the texture.
     * @returns the cloned texture
     */
    clone() {
      const textureSize = this.getSize();
      const newTexture = new _a(this.name, textureSize.width, this._fragment, this.getScene(), this._fallbackTexture, this._generateMipMaps);
      newTexture.hasAlpha = this.hasAlpha;
      newTexture.level = this.level;
      newTexture.coordinatesMode = this.coordinatesMode;
      return newTexture;
    }
    /**
     * Dispose the texture and release its associated resources.
     */
    dispose() {
      const scene = this.getScene();
      if (!scene) {
        return;
      }
      const index = scene.proceduralTextures.indexOf(this);
      if (index >= 0) {
        scene.proceduralTextures.splice(index, 1);
      }
      const vertexBuffer = this._vertexBuffers[VertexBuffer.PositionKind];
      if (vertexBuffer) {
        vertexBuffer.dispose();
        this._vertexBuffers[VertexBuffer.PositionKind] = null;
      }
      if (this._indexBuffer && this._fullEngine._releaseBuffer(this._indexBuffer)) {
        this._indexBuffer = null;
      }
      this.onGeneratedObservable.clear();
      this.onBeforeGenerationObservable.clear();
      super.dispose();
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
    _isEnabled_decorators = [serialize()];
    _autoClear_decorators = [serialize()];
    __generateMipMaps_decorators = [serialize()];
    __size_decorators = [serialize()];
    _get_refreshRate_decorators = [serialize()];
    __esDecorate(_a, null, _get_refreshRate_decorators, { kind: "getter", name: "refreshRate", static: false, private: false, access: { has: (obj) => "refreshRate" in obj, get: (obj) => obj.refreshRate }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(null, null, _isEnabled_decorators, { kind: "field", name: "isEnabled", static: false, private: false, access: { has: (obj) => "isEnabled" in obj, get: (obj) => obj.isEnabled, set: (obj, value) => {
      obj.isEnabled = value;
    } }, metadata: _metadata }, _isEnabled_initializers, _isEnabled_extraInitializers);
    __esDecorate(null, null, _autoClear_decorators, { kind: "field", name: "autoClear", static: false, private: false, access: { has: (obj) => "autoClear" in obj, get: (obj) => obj.autoClear, set: (obj, value) => {
      obj.autoClear = value;
    } }, metadata: _metadata }, _autoClear_initializers, _autoClear_extraInitializers);
    __esDecorate(null, null, __generateMipMaps_decorators, { kind: "field", name: "_generateMipMaps", static: false, private: false, access: { has: (obj) => "_generateMipMaps" in obj, get: (obj) => obj._generateMipMaps, set: (obj, value) => {
      obj._generateMipMaps = value;
    } }, metadata: _metadata }, __generateMipMaps_initializers, __generateMipMaps_extraInitializers);
    __esDecorate(null, null, __size_decorators, { kind: "field", name: "_size", static: false, private: false, access: { has: (obj) => "_size" in obj, get: (obj) => obj._size, set: (obj, value) => {
      obj._size = value;
    } }, metadata: _metadata }, __size_initializers, __size_extraInitializers);
    if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a;
})();
let _Registered = false;
function RegisterProceduralTexture() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("BABYLON.ProceduralTexture", ProceduralTexture);
}
export {
  ProceduralTexture as P,
  RegisterProceduralTexture as R
};
