import { V as Vector3, Q as Quaternion, aJ as PrecisionDate, W as WebRequest, L as Logger, O as Observable } from "./babylon-PnzH6wcM.js";
class _SpatialAudioAttacherComponent {
  /** @internal */
  constructor(spatialAudioNode) {
    this._attachmentType = 3;
    this._position = new Vector3();
    this._rotationQuaternion = new Quaternion();
    this._sceneNode = null;
    this._useBoundingBox = false;
    this.dispose = () => {
      this.detach();
    };
    this._spatialAudioNode = spatialAudioNode;
  }
  /**
   * Returns `true` if attached to a scene node; otherwise returns `false`.
   */
  get isAttached() {
    return this._sceneNode !== null;
  }
  /**
   * The scene node this attacher is currently attached to, or `null` if not attached.
   */
  get sceneNode() {
    return this._sceneNode;
  }
  /**
   * Whether the attacher is using the scene node's bounding box for positioning.
   */
  get useBoundingBox() {
    return this._useBoundingBox;
  }
  /**
   * Which components (position, rotation, or both) of the scene node's world transform drive the spatial audio.
   */
  get attachmentType() {
    return this._attachmentType;
  }
  /**
   * Attaches to a scene node.
   *
   * Detaches automatically before attaching to the given scene node.
   * If `sceneNode` is `null` it is the same as calling `detach()`.
   *
   * @param sceneNode The scene node to attach to, or `null` to detach.
   * @param useBoundingBox Whether to use the scene node's bounding box for positioning. Defaults to `false`.
   * @param attachmentType Whether to attach to the scene node's position and/or rotation. Defaults to `PositionAndRotation`.
   */
  attach(sceneNode, useBoundingBox, attachmentType) {
    if (this._sceneNode === sceneNode) {
      return;
    }
    this.detach();
    if (!sceneNode) {
      return;
    }
    this._attachmentType = attachmentType;
    this._sceneNode = sceneNode;
    this._sceneNode.onDisposeObservable.add(this.dispose);
    this._useBoundingBox = useBoundingBox;
  }
  /**
   * Detaches from the scene node if attached.
   */
  detach() {
    this._sceneNode?.onDisposeObservable.removeCallback(this.dispose);
    this._sceneNode = null;
  }
  /**
   * Updates the position and rotation of the associated audio engine object in the audio rendering graph.
   *
   * This is called automatically by default and only needs to be called manually if automatic updates are disabled.
   */
  update() {
    const updatesPosition = !!(this._attachmentType & 1);
    if (updatesPosition) {
      if (this._useBoundingBox && this._sceneNode.getBoundingInfo) {
        this._position.copyFrom(this._sceneNode.getBoundingInfo().boundingBox.centerWorld);
      } else {
        this._sceneNode?.getWorldMatrix().getTranslationToRef(this._position);
      }
      this._spatialAudioNode.position.copyFrom(this._position);
      this._spatialAudioNode._updatePosition();
    }
    if (this._attachmentType & 2) {
      this._sceneNode?.getWorldMatrix().decompose(void 0, this._rotationQuaternion);
      this._spatialAudioNode.rotationQuaternion.copyFrom(this._rotationQuaternion);
      this._spatialAudioNode._updateRotation();
    }
    if (!updatesPosition && "panningEnabled" in this._spatialAudioNode && !this._spatialAudioNode.panningEnabled) {
      this._spatialAudioNode._updatePosition();
    }
  }
}
class _SpatialWebAudioUpdaterComponent {
  /** @internal */
  constructor(parent, autoUpdate, minUpdateTime) {
    this._autoUpdate = true;
    this._lastUpdateTime = 0;
    this.minUpdateTime = 0;
    if (!autoUpdate) {
      return;
    }
    this.minUpdateTime = minUpdateTime;
    const update = () => {
      if (!this._autoUpdate) {
        return;
      }
      let skipUpdate = false;
      if (0 < this.minUpdateTime) {
        const now = PrecisionDate.Now;
        if (this._lastUpdateTime && now - this._lastUpdateTime < this.minUpdateTime * 1e3) {
          skipUpdate = true;
        }
        this._lastUpdateTime = now;
      }
      if (!skipUpdate) {
        parent.update();
      }
      requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }
  /** @internal */
  dispose() {
    this._autoUpdate = false;
  }
}
const _FileExtensionRegex = new RegExp("\\.(\\w{3,4})($|\\?)");
const CurveLength = 100;
const TmpLineValues = new Float32Array([0, 0]);
let TmpCurveValues = null;
let ExpCurve = null;
let LogCurve = null;
function GetExpCurve() {
  if (!ExpCurve) {
    ExpCurve = new Float32Array(CurveLength);
    const increment = 1 / (CurveLength - 1);
    let x = increment;
    for (let i = 1; i < CurveLength; i++) {
      ExpCurve[i] = Math.exp(-11.512925464970227 * (1 - x));
      x += increment;
    }
  }
  return ExpCurve;
}
function GetLogCurve() {
  if (!LogCurve) {
    LogCurve = new Float32Array(CurveLength);
    const increment = 1 / CurveLength;
    let x = increment;
    for (let i = 0; i < CurveLength; i++) {
      LogCurve[i] = 1 + Math.log10(x) / Math.log10(CurveLength);
      x += increment;
    }
  }
  return LogCurve;
}
function _GetAudioParamCurveValues(shape, from, to) {
  if (!TmpCurveValues) {
    TmpCurveValues = new Float32Array(CurveLength);
  }
  let normalizedCurve;
  if (shape === "linear") {
    TmpLineValues[0] = from;
    TmpLineValues[1] = to;
    return TmpLineValues;
  } else if (shape === "exponential") {
    normalizedCurve = GetExpCurve();
  } else if (shape === "logarithmic") {
    normalizedCurve = GetLogCurve();
  } else {
    throw new Error(`Unknown ramp shape: ${shape}`);
  }
  const direction = Math.sign(to - from);
  const range = Math.abs(to - from);
  if (direction === 1) {
    for (let i = 0; i < normalizedCurve.length; i++) {
      TmpCurveValues[i] = from + range * normalizedCurve[i];
    }
  } else {
    let j = CurveLength - 1;
    for (let i = 0; i < normalizedCurve.length; i++, j--) {
      TmpCurveValues[i] = from - range * (1 - normalizedCurve[j]);
    }
  }
  return TmpCurveValues;
}
function _CleanUrl(url) {
  return url.replace(/#/gm, "%23");
}
function _GetUrlForStreaming(url) {
  const { url: modifiedUrl, headers } = WebRequest._CollectCustomizations(url);
  if (Object.keys(headers).length > 0) {
    Logger.Warn("WebAudioStreamingSound: Custom request headers cannot be applied to a streaming <audio> element and will be ignored. To use custom headers with audio, switch to a static (non-streaming) sound which fetches the file up-front.");
  }
  return modifiedUrl;
}
async function _LoadArrayBufferFromUrlAsync(url) {
  const response = await WebRequest.FetchAsync(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} loading '${url}': ${response.statusText}`);
  }
  const data = await response.arrayBuffer();
  const contentType = response.headers.get("Content-Type") ?? "";
  return { data, contentType };
}
const MinRampDuration = 1e-6;
let Warn = true;
class _WebAudioParameterComponent {
  /** @internal */
  constructor(engine, param) {
    this._rampEndTime = 0;
    this._engine = engine;
    this._param = param;
    this._targetValue = param.value;
  }
  /** @internal */
  get isRamping() {
    return this._engine.currentTime < this._rampEndTime;
  }
  /** @internal */
  get targetValue() {
    return this._targetValue;
  }
  set targetValue(value) {
    this.setTargetValue(value);
  }
  /** @internal */
  get value() {
    return this._param.value;
  }
  /** @internal */
  dispose() {
    this._param = null;
    this._engine = null;
  }
  /**
   * Sets the target value of the audio parameter with an optional ramping duration and shape.
   *
   * @internal
   */
  setTargetValue(value, options = null) {
    if (!Number.isFinite(value)) {
      Logger.Warn(`Attempted to set audio parameter to non-finite value: ${value}`);
      return;
    }
    this._param.cancelScheduledValues(0);
    const shape = typeof options?.shape === "string" ? options.shape : "linear";
    const startTime = this._engine.currentTime;
    if (shape === "none") {
      this._param.value = this._targetValue = value;
      this._rampEndTime = startTime;
      return;
    }
    let duration = typeof options?.duration === "number" ? Math.max(options.duration, this._engine.parameterRampDuration) : this._engine.parameterRampDuration;
    this._targetValue = value;
    if ((duration = Math.max(this._engine.parameterRampDuration, duration)) < MinRampDuration) {
      this._param.setValueAtTime(value, startTime);
      return;
    }
    try {
      this._param.setValueCurveAtTime(_GetAudioParamCurveValues(shape, Number.isFinite(this._param.value) ? this._param.value : 0, value), startTime, duration);
      this._rampEndTime = startTime + duration;
    } catch (e) {
      if (Warn) {
        Logger.Warn(`Audio parameter ramping failed: ${e.message}`);
        Warn = false;
      }
    }
  }
}
var AudioNodeType;
(function(AudioNodeType2) {
  AudioNodeType2[AudioNodeType2["HAS_INPUTS"] = 1] = "HAS_INPUTS";
  AudioNodeType2[AudioNodeType2["HAS_OUTPUTS"] = 2] = "HAS_OUTPUTS";
  AudioNodeType2[AudioNodeType2["HAS_INPUTS_AND_OUTPUTS"] = 3] = "HAS_INPUTS_AND_OUTPUTS";
})(AudioNodeType || (AudioNodeType = {}));
class AbstractAudioNode {
  constructor(engine, nodeType) {
    this.onDisposeObservable = new Observable();
    this.engine = engine;
    if (nodeType & 1) {
      this._upstreamNodes = /* @__PURE__ */ new Set();
    }
    if (nodeType & 2) {
      this._downstreamNodes = /* @__PURE__ */ new Set();
    }
  }
  /**
   * Releases associated resources.
   * - Triggers `onDisposeObservable`.
   * @see {@link onDisposeObservable}
   */
  dispose() {
    if (this._downstreamNodes) {
      for (const node of Array.from(this._downstreamNodes)) {
        if (!this._disconnect(node)) {
          throw new Error("Disconnect failed");
        }
      }
      this._downstreamNodes.clear();
    }
    if (this._upstreamNodes) {
      for (const node of Array.from(this._upstreamNodes)) {
        if (!node._disconnect(this)) {
          throw new Error("Disconnect failed");
        }
      }
      this._upstreamNodes.clear();
    }
    this.onDisposeObservable.notifyObservers(this);
    this.onDisposeObservable.clear();
  }
  /**
   * Connect to a downstream audio input node.
   * @param node - The downstream audio input node to connect
   * @returns `true` if the node is successfully connected; otherwise `false`
   */
  _connect(node) {
    if (!this._downstreamNodes) {
      return false;
    }
    if (this._downstreamNodes.has(node)) {
      return false;
    }
    if (!node._onConnect(this)) {
      return false;
    }
    this._downstreamNodes.add(node);
    return true;
  }
  /**
   * Disconnects a downstream audio input node.
   * @param node - The downstream audio input node to disconnect
   * @returns `true` if the node is successfully disconnected; otherwise `false`
   */
  _disconnect(node) {
    if (!this._downstreamNodes) {
      return false;
    }
    if (!this._downstreamNodes.delete(node)) {
      return false;
    }
    return node._onDisconnect(this);
  }
  /**
   * Called when an upstream audio output node is connecting.
   * @param node - The connecting upstream audio node
   * @returns `true` if the node is successfully connected; otherwise `false`
   */
  _onConnect(node) {
    if (!this._upstreamNodes) {
      return false;
    }
    if (this._upstreamNodes.has(node)) {
      return false;
    }
    this._upstreamNodes.add(node);
    return true;
  }
  /**
   * Called when an upstream audio output node disconnects.
   * @param node - The disconnecting upstream audio node
   * @returns `true` if node is sucessfully disconnected; otherwise `false`
   */
  _onDisconnect(node) {
    return this._upstreamNodes?.delete(node) ?? false;
  }
}
class AbstractNamedAudioNode extends AbstractAudioNode {
  constructor(name, engine, nodeType) {
    super(engine, nodeType);
    this.onNameChangedObservable = new Observable();
    this._name = name;
  }
  /**
   * The name of the audio node.
   * - Triggers `onNameChangedObservable` when changed.
   * @see {@link onNameChangedObservable}
   */
  get name() {
    return this._name;
  }
  set name(newName) {
    if (this._name === newName) {
      return;
    }
    const oldName = this._name;
    this._name = newName;
    this.onNameChangedObservable.notifyObservers({ newName, oldName, node: this });
  }
  dispose() {
    super.dispose();
    this.onNameChangedObservable.clear();
  }
}
export {
  AbstractAudioNode as A,
  _GetUrlForStreaming as _,
  _CleanUrl as a,
  _LoadArrayBufferFromUrlAsync as b,
  _FileExtensionRegex as c,
  _WebAudioParameterComponent as d,
  _SpatialAudioAttacherComponent as e,
  _SpatialWebAudioUpdaterComponent as f,
  AbstractNamedAudioNode as g
};
