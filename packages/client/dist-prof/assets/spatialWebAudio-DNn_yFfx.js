import { a as _AbstractAudioSubNode, _ as _WebAudioBaseSubGraph, b as _GetVolumeAudioSubNode } from "./webAudioBaseSubGraph-BCodVyiC.js";
import { Q as Quaternion, V as Vector3, M as Matrix } from "./babylon-PnzH6wcM.js";
import { e as _SpatialAudioAttacherComponent, d as _WebAudioParameterComponent, f as _SpatialWebAudioUpdaterComponent } from "./abstractAudioNode-CyGHAvf_.js";
const _SpatialAudioDefaults = {
  coneInnerAngle: 6.28318530718,
  coneOuterAngle: 6.28318530718,
  coneOuterVolume: 0,
  distanceModel: "linear",
  maxDistance: 1e4,
  minDistance: 1,
  orientation: Vector3.Right(),
  panningEnabled: true,
  panningModel: "equalpower",
  position: Vector3.Zero(),
  rolloffFactor: 1,
  rotation: Vector3.Zero(),
  rotationQuaternion: new Quaternion()
};
function _HasSpatialAudioOptions(options) {
  return options.spatialEnabled || options.spatialAutoUpdate !== void 0 || options.spatialConeInnerAngle !== void 0 || options.spatialConeOuterAngle !== void 0 || options.spatialConeOuterVolume !== void 0 || options.spatialDistanceModel !== void 0 || options.spatialMaxDistance !== void 0 || options.spatialMinDistance !== void 0 || options.spatialMinUpdateTime !== void 0 || options.spatialOrientation !== void 0 || options.spatialPanningEnabled !== void 0 || options.spatialPanningModel !== void 0 || options.spatialPosition !== void 0 || options.spatialRolloffFactor !== void 0 || options.spatialRotation !== void 0 || options.spatialRotationQuaternion !== void 0;
}
class AbstractSpatialAudio {
}
const _StereoAudioDefaults = {
  pan: 0
};
function _HasStereoAudioOptions(options) {
  return options.stereoEnabled || options.stereoPan !== void 0;
}
class AbstractStereoAudio {
}
class _StereoAudioSubNode extends _AbstractAudioSubNode {
  constructor(engine) {
    super("Stereo", engine);
  }
  /** @internal */
  setOptions(options) {
    this.pan = options.stereoPan ?? _StereoAudioDefaults.pan;
  }
}
function _GetStereoAudioSubNode(subGraph) {
  return subGraph.getSubNode(
    "Stereo"
    /* AudioSubNode.STEREO */
  );
}
function _SetStereoAudioProperty(subGraph, property, value) {
  subGraph.callOnSubNode("Stereo", (node) => {
    node[property] = value;
  });
}
class _StereoAudio extends AbstractStereoAudio {
  /** @internal */
  constructor(subGraph) {
    super();
    this._pan = _StereoAudioDefaults.pan;
    this._subGraph = subGraph;
  }
  /** @internal */
  get pan() {
    return this._pan;
  }
  set pan(value) {
    this._pan = value;
    _SetStereoAudioProperty(this._subGraph, "pan", value);
  }
}
class _SpatialAudioSubNode extends _AbstractAudioSubNode {
  constructor(engine) {
    super("Spatial", engine);
    this._attacherComponent = null;
  }
  /** @internal */
  get isAttached() {
    return this._attacherComponent !== null && this._attacherComponent.isAttached;
  }
  /** @internal */
  get attachedNode() {
    return this._attacherComponent?.sceneNode ?? null;
  }
  /** @internal */
  get useBoundingBox() {
    return this._attacherComponent?.useBoundingBox ?? false;
  }
  /** @internal */
  get attachmentType() {
    return this._attacherComponent?.attachmentType ?? 3;
  }
  /** @internal */
  attach(sceneNode, useBoundingBox, attachmentType) {
    this.detach();
    if (!this._attacherComponent) {
      this._attacherComponent = new _SpatialAudioAttacherComponent(this);
    }
    this._attacherComponent.attach(sceneNode, useBoundingBox, attachmentType);
  }
  /** @internal */
  detach() {
    this._attacherComponent?.detach();
  }
  /** @internal */
  dispose() {
    super.dispose();
    this._attacherComponent?.dispose();
    this._attacherComponent = null;
  }
  /** @internal */
  setOptions(options) {
    this.coneInnerAngle = options.spatialConeInnerAngle ?? _SpatialAudioDefaults.coneInnerAngle;
    this.coneOuterAngle = options.spatialConeOuterAngle ?? _SpatialAudioDefaults.coneOuterAngle;
    this.coneOuterVolume = options.spatialConeOuterVolume ?? _SpatialAudioDefaults.coneOuterVolume;
    this.distanceModel = options.spatialDistanceModel ?? _SpatialAudioDefaults.distanceModel;
    this.maxDistance = options.spatialMaxDistance ?? _SpatialAudioDefaults.maxDistance;
    this.minDistance = options.spatialMinDistance ?? _SpatialAudioDefaults.minDistance;
    this.orientation = options.spatialOrientation ?? _SpatialAudioDefaults.orientation;
    this.panningEnabled = options.spatialPanningEnabled ?? _SpatialAudioDefaults.panningEnabled;
    this.panningModel = options.spatialPanningModel ?? _SpatialAudioDefaults.panningModel;
    this.rolloffFactor = options.spatialRolloffFactor ?? _SpatialAudioDefaults.rolloffFactor;
    if (options.spatialPosition) {
      this.position = options.spatialPosition.clone();
    }
    if (options.spatialRotationQuaternion) {
      this.rotationQuaternion = options.spatialRotationQuaternion.clone();
    } else if (options.spatialRotation) {
      this.rotation = options.spatialRotation.clone();
    } else {
      this.rotationQuaternion = _SpatialAudioDefaults.rotationQuaternion.clone();
    }
    this.update();
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
}
function _GetSpatialAudioSubNode(subGraph) {
  return subGraph.getSubNode(
    "Spatial"
    /* AudioSubNode.SPATIAL */
  );
}
function _SetSpatialAudioProperty(subGraph, property, value) {
  subGraph.callOnSubNode("Spatial", (node) => {
    node[property] = value;
  });
}
const TmpMatrix = Matrix.Zero();
const TmpQuaternion = new Quaternion();
function D2r(degrees) {
  return degrees * Math.PI / 180;
}
function R2d(radians) {
  return radians * 180 / Math.PI;
}
async function _CreateSpatialAudioSubNodeAsync(engine) {
  return new _SpatialWebAudioSubNode(engine);
}
class _SpatialWebAudioSubNode extends _SpatialAudioSubNode {
  /** @internal */
  constructor(engine) {
    super(engine);
    this._lastOrientation = Vector3.Zero();
    this._lastPosition = Vector3.Zero();
    this._lastRotation = Vector3.Zero();
    this._lastRotationQuaternion = new Quaternion();
    this._panningEnabled = _SpatialAudioDefaults.panningEnabled;
    this.orientation = _SpatialAudioDefaults.orientation.clone();
    this.position = _SpatialAudioDefaults.position.clone();
    this.rotation = _SpatialAudioDefaults.rotation.clone();
    this.rotationQuaternion = _SpatialAudioDefaults.rotationQuaternion.clone();
    this._inputNode = new GainNode(engine._audioContext);
    this._attenuationNode = new GainNode(engine._audioContext);
    this._attenuation = new _WebAudioParameterComponent(engine, this._attenuationNode.gain);
    this.node = new PannerNode(engine._audioContext);
    this._orientationX = new _WebAudioParameterComponent(engine, this.node.orientationX);
    this._orientationY = new _WebAudioParameterComponent(engine, this.node.orientationY);
    this._orientationZ = new _WebAudioParameterComponent(engine, this.node.orientationZ);
    this._positionX = new _WebAudioParameterComponent(engine, this.node.positionX);
    this._positionY = new _WebAudioParameterComponent(engine, this.node.positionY);
    this._positionZ = new _WebAudioParameterComponent(engine, this.node.positionZ);
    this._connectActiveInput();
  }
  /** @internal */
  dispose() {
    super.dispose();
    this._attenuation.dispose();
    this._orientationX.dispose();
    this._orientationY.dispose();
    this._orientationZ.dispose();
    this._positionX.dispose();
    this._positionY.dispose();
    this._positionZ.dispose();
    this._inputNode.disconnect();
    this._attenuationNode.disconnect();
    this.node.disconnect();
  }
  /** @internal */
  get coneInnerAngle() {
    return D2r(this.node.coneInnerAngle);
  }
  set coneInnerAngle(value) {
    this.node.coneInnerAngle = R2d(value);
  }
  /** @internal */
  get coneOuterAngle() {
    return D2r(this.node.coneOuterAngle);
  }
  set coneOuterAngle(value) {
    this.node.coneOuterAngle = R2d(value);
  }
  /** @internal */
  get coneOuterVolume() {
    return this.node.coneOuterGain;
  }
  set coneOuterVolume(value) {
    this.node.coneOuterGain = value;
  }
  /** @internal */
  get distanceModel() {
    return this.node.distanceModel;
  }
  set distanceModel(value) {
    this.node.distanceModel = value;
    const maxDistance = this.node.maxDistance;
    this.node.maxDistance = maxDistance + 1e-3;
    this.node.maxDistance = maxDistance;
    this._updateAttenuation();
  }
  /** @internal */
  get minDistance() {
    return this.node.refDistance;
  }
  set minDistance(value) {
    this.node.refDistance = value;
    this._updateAttenuation();
  }
  /** @internal */
  get maxDistance() {
    return this.node.maxDistance;
  }
  set maxDistance(value) {
    this.node.maxDistance = value;
    this._updateAttenuation();
  }
  /** @internal */
  get panningEnabled() {
    return this._panningEnabled;
  }
  set panningEnabled(value) {
    if (this._panningEnabled === value) {
      return;
    }
    this._panningEnabled = value;
    this._connectActiveInput();
    this._updateAttenuation();
  }
  /** @internal */
  get panningModel() {
    return this.node.panningModel;
  }
  set panningModel(value) {
    this.node.panningModel = value;
  }
  /** @internal */
  get rolloffFactor() {
    return this.node.rolloffFactor;
  }
  set rolloffFactor(value) {
    this.node.rolloffFactor = value;
    this._updateAttenuation();
  }
  /** @internal */
  get _inNode() {
    return this._inputNode;
  }
  /** @internal */
  get _outNode() {
    return this._panningEnabled ? this.node : this._attenuationNode;
  }
  /** @internal */
  _updatePosition() {
    if (this._lastPosition.equalsWithEpsilon(this.position)) {
      this._updateAttenuation();
      return;
    }
    this._positionX.targetValue = this.position.x;
    this._positionY.targetValue = this.position.y;
    this._positionZ.targetValue = this.position.z;
    this._lastPosition.copyFrom(this.position);
    this._updateAttenuation();
  }
  /** @internal */
  _updateRotation() {
    let rotated = false;
    if (!this._lastRotationQuaternion.equalsWithEpsilon(this.rotationQuaternion)) {
      TmpQuaternion.copyFrom(this.rotationQuaternion);
      this._lastRotationQuaternion.copyFrom(this.rotationQuaternion);
      rotated = true;
    } else if (!this._lastRotation.equalsWithEpsilon(this.rotation)) {
      Quaternion.FromEulerAnglesToRef(this.rotation.x, this.rotation.y, this.rotation.z, TmpQuaternion);
      this._lastRotation.copyFrom(this.rotation);
      rotated = true;
    } else if (this._lastOrientation.equalsWithEpsilon(this.orientation)) {
      return;
    }
    if (rotated) {
      Matrix.FromQuaternionToRef(TmpQuaternion, TmpMatrix);
      Vector3.TransformNormalToRef(Vector3.RightReadOnly, TmpMatrix, this.orientation);
    }
    this._orientationX.targetValue = this.orientation.x;
    this._orientationY.targetValue = this.orientation.y;
    this._orientationZ.targetValue = this.orientation.z;
  }
  _connect(node) {
    const connected = super._connect(node);
    if (!connected) {
      return false;
    }
    if (node._inNode) {
      this.node.connect(node._inNode);
      this._attenuationNode.connect(node._inNode);
    }
    return true;
  }
  _disconnect(node) {
    const disconnected = super._disconnect(node);
    if (!disconnected) {
      return false;
    }
    if (node._inNode) {
      this.node.disconnect(node._inNode);
      this._attenuationNode.disconnect(node._inNode);
    }
    return true;
  }
  /** @internal */
  getClassName() {
    return "_SpatialWebAudioSubNode";
  }
  _connectActiveInput() {
    this._inputNode.disconnect();
    if (this._panningEnabled) {
      this._inputNode.connect(this.node);
    } else {
      this._inputNode.connect(this._attenuationNode);
    }
  }
  _updateAttenuation() {
    if (this._panningEnabled) {
      this._attenuation.targetValue = 1;
      return;
    }
    const listenerPosition = this.engine.listener.position;
    const deltaX = this.position.x - listenerPosition.x;
    const deltaY = this.position.y - listenerPosition.y;
    const deltaZ = this.position.z - listenerPosition.z;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
    const minDistance = Math.max(this.minDistance, 0);
    let attenuation = 1;
    switch (this.distanceModel) {
      case "linear":
        {
          const maxDistance = Math.max(this.maxDistance, minDistance);
          const clampedDistance = Math.min(Math.max(distance, minDistance), maxDistance);
          attenuation = maxDistance === minDistance ? distance <= minDistance ? 1 : 0 : 1 - this.rolloffFactor * (clampedDistance - minDistance) / (maxDistance - minDistance);
        }
        break;
      case "inverse":
        if (minDistance === 0) {
          attenuation = 0;
          break;
        }
        attenuation = minDistance / (minDistance + this.rolloffFactor * (Math.max(distance, minDistance) - minDistance));
        break;
      case "exponential":
        if (minDistance === 0) {
          attenuation = 0;
          break;
        }
        attenuation = Math.pow(Math.max(distance, minDistance) / minDistance, -this.rolloffFactor);
        break;
    }
    this._attenuation.targetValue = Math.min(Math.max(attenuation, 0), 1);
  }
}
async function _CreateStereoAudioSubNodeAsync(engine) {
  return new _StereoWebAudioSubNode(engine);
}
class _StereoWebAudioSubNode extends _StereoAudioSubNode {
  /** @internal */
  constructor(engine) {
    super(engine);
    this.node = new StereoPannerNode(engine._audioContext);
    this._pan = new _WebAudioParameterComponent(engine, this.node.pan);
  }
  /** @internal */
  dispose() {
    super.dispose();
    this._pan.dispose();
  }
  /** @internal */
  get pan() {
    return this._pan.targetValue;
  }
  /** @internal */
  set pan(value) {
    this._pan.targetValue = value;
  }
  /** @internal */
  get _inNode() {
    return this.node;
  }
  /** @internal */
  get _outNode() {
    return this.node;
  }
  /** @internal */
  getClassName() {
    return "_StereoWebAudioSubNode";
  }
  _connect(node) {
    const connected = super._connect(node);
    if (!connected) {
      return false;
    }
    if (node._inNode) {
      this.node.connect(node._inNode);
    }
    return true;
  }
  _disconnect(node) {
    const disconnected = super._disconnect(node);
    if (!disconnected) {
      return false;
    }
    if (node._inNode) {
      this.node.disconnect(node._inNode);
    }
    return true;
  }
}
class _WebAudioBusAndSoundSubGraph extends _WebAudioBaseSubGraph {
  constructor() {
    super(...arguments);
    this._rootNode = null;
    this._inputNode = null;
  }
  /** @internal */
  async initAsync(options) {
    await super.initAsync(options);
    let hasSpatialOptions;
    let hasStereoOptions;
    if (hasSpatialOptions = _HasSpatialAudioOptions(options)) {
      await this.createAndAddSubNodeAsync(
        "Spatial"
        /* AudioSubNode.SPATIAL */
      );
    }
    if (hasStereoOptions = _HasStereoAudioOptions(options)) {
      await this.createAndAddSubNodeAsync(
        "Stereo"
        /* AudioSubNode.STEREO */
      );
    }
    await this._createSubNodePromisesResolvedAsync();
    if (hasSpatialOptions) {
      _GetSpatialAudioSubNode(this)?.setOptions(options);
    }
    if (hasStereoOptions) {
      _GetStereoAudioSubNode(this)?.setOptions(options);
    }
  }
  /** @internal */
  get _inNode() {
    return this._inputNode;
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  _createSubNode(name) {
    try {
      const node = super._createSubNode(name);
      return node;
    } catch (e) {
    }
    switch (name) {
      case "Spatial":
        return _CreateSpatialAudioSubNodeAsync(this._owner.engine);
      case "Stereo":
        return _CreateStereoAudioSubNodeAsync(this._owner.engine);
      default:
        throw new Error(`Unknown subnode name: ${name}`);
    }
  }
  _onSubNodesChanged() {
    super._onSubNodesChanged();
    const spatialNode = _GetSpatialAudioSubNode(this);
    const stereoNode = _GetStereoAudioSubNode(this);
    const volumeNode = _GetVolumeAudioSubNode(this);
    if (spatialNode && spatialNode.getClassName() !== "_SpatialWebAudioSubNode") {
      throw new Error("Not a WebAudio subnode.");
    }
    if (stereoNode && stereoNode.getClassName() !== "_StereoWebAudioSubNode") {
      throw new Error("Not a WebAudio subnode.");
    }
    if (volumeNode && volumeNode.getClassName() !== "_VolumeWebAudioSubNode") {
      throw new Error("Not a WebAudio subnode.");
    }
    if (spatialNode) {
      spatialNode.disconnectAll();
      if (volumeNode) {
        spatialNode.connect(volumeNode);
      }
    }
    if (stereoNode) {
      stereoNode.disconnectAll();
      if (volumeNode) {
        stereoNode.connect(volumeNode);
      }
    }
    if (spatialNode && stereoNode) {
      this._rootNode = new GainNode(this._owner.engine._audioContext);
      this._rootNode.connect(spatialNode._inNode);
      this._rootNode.connect(stereoNode._inNode);
    } else {
      this._rootNode?.disconnect();
      this._rootNode = null;
    }
    let inSubNode = null;
    let inNode;
    if (this._rootNode) {
      inNode = this._rootNode;
    } else {
      if (spatialNode) {
        inSubNode = spatialNode;
      } else if (stereoNode) {
        inSubNode = stereoNode;
      } else if (volumeNode) {
        inSubNode = volumeNode;
      }
      inNode = inSubNode?._inNode ?? null;
    }
    if (this._inputNode !== inNode) {
      if (this._inputNode && this._upstreamNodes) {
        const it = this._upstreamNodes.values();
        for (let next = it.next(); !next.done; next = it.next()) {
          next.value._outNode?.disconnect(this._inputNode);
        }
      }
      this._inputNode = inNode;
      if (inNode && this._upstreamNodes) {
        const it = this._upstreamNodes.values();
        for (let next = it.next(); !next.done; next = it.next()) {
          next.value._outNode?.connect(inNode);
        }
      }
    }
  }
}
class _SpatialAudio extends AbstractSpatialAudio {
  /** @internal */
  constructor(subGraph) {
    super();
    this._coneInnerAngle = _SpatialAudioDefaults.coneInnerAngle;
    this._coneOuterAngle = _SpatialAudioDefaults.coneOuterAngle;
    this._coneOuterVolume = _SpatialAudioDefaults.coneOuterVolume;
    this._distanceModel = _SpatialAudioDefaults.distanceModel;
    this._maxDistance = _SpatialAudioDefaults.maxDistance;
    this._minDistance = _SpatialAudioDefaults.minDistance;
    this._panningEnabled = _SpatialAudioDefaults.panningEnabled;
    this._panningModel = _SpatialAudioDefaults.panningModel;
    this._rolloffFactor = _SpatialAudioDefaults.rolloffFactor;
    const subNode = _GetSpatialAudioSubNode(subGraph);
    if (subNode) {
      this._orientation = subNode.orientation.clone();
      this._panningEnabled = subNode.panningEnabled;
      this._position = subNode.position.clone();
      this._rotation = subNode.rotation.clone();
      this._rotationQuaternion = subNode.rotationQuaternion.clone();
    } else {
      this._orientation = _SpatialAudioDefaults.orientation.clone();
      this._position = _SpatialAudioDefaults.position.clone();
      this._rotation = _SpatialAudioDefaults.rotation.clone();
      this._rotationQuaternion = _SpatialAudioDefaults.rotationQuaternion.clone();
      subGraph.createAndAddSubNodeAsync(
        "Spatial"
        /* AudioSubNode.SPATIAL */
      );
    }
    this._subGraph = subGraph;
  }
  /** @internal */
  dispose() {
    this._subGraph.removeSubNodeAsync(_GetSpatialAudioSubNode(this._subGraph));
  }
  /** @internal */
  get coneInnerAngle() {
    return this._coneInnerAngle;
  }
  set coneInnerAngle(value) {
    this._coneInnerAngle = value;
    _SetSpatialAudioProperty(this._subGraph, "coneInnerAngle", value);
  }
  /** @internal */
  get coneOuterAngle() {
    return this._coneOuterAngle;
  }
  set coneOuterAngle(value) {
    this._coneOuterAngle = value;
    _SetSpatialAudioProperty(this._subGraph, "coneOuterAngle", value);
  }
  /** @internal */
  get coneOuterVolume() {
    return this._coneOuterVolume;
  }
  set coneOuterVolume(value) {
    this._coneOuterVolume = value;
    _SetSpatialAudioProperty(this._subGraph, "coneOuterVolume", value);
  }
  /** @internal */
  get distanceModel() {
    return this._distanceModel;
  }
  set distanceModel(value) {
    this._distanceModel = value;
    _SetSpatialAudioProperty(this._subGraph, "distanceModel", value);
  }
  /** @internal */
  get isAttached() {
    return this._subGraph.getSubNode(
      "Spatial"
      /* AudioSubNode.SPATIAL */
    )?.isAttached ?? false;
  }
  /** @internal */
  get attachedNode() {
    return this._subGraph.getSubNode(
      "Spatial"
      /* AudioSubNode.SPATIAL */
    )?.attachedNode ?? null;
  }
  /** @internal */
  get useBoundingBox() {
    return this._subGraph.getSubNode(
      "Spatial"
      /* AudioSubNode.SPATIAL */
    )?.useBoundingBox ?? false;
  }
  /** @internal */
  get attachmentType() {
    return this._subGraph.getSubNode(
      "Spatial"
      /* AudioSubNode.SPATIAL */
    )?.attachmentType ?? 3;
  }
  /** @internal */
  get maxDistance() {
    return this._maxDistance;
  }
  set maxDistance(value) {
    if (value <= 0) {
      value = 1e-6;
    }
    this._maxDistance = value;
    _SetSpatialAudioProperty(this._subGraph, "maxDistance", value);
  }
  /** @internal */
  get minDistance() {
    return this._minDistance;
  }
  set minDistance(value) {
    this._minDistance = value;
    _SetSpatialAudioProperty(this._subGraph, "minDistance", value);
  }
  /** @internal */
  get orientation() {
    return this._orientation;
  }
  set orientation(value) {
    this._orientation = value;
    this._updateRotation();
  }
  /** @internal */
  get panningEnabled() {
    return this._panningEnabled;
  }
  set panningEnabled(value) {
    this._panningEnabled = value;
    _SetSpatialAudioProperty(this._subGraph, "panningEnabled", value);
  }
  /** @internal */
  get panningModel() {
    return this._panningModel;
  }
  set panningModel(value) {
    this._panningModel = value;
    _SetSpatialAudioProperty(this._subGraph, "panningModel", value);
  }
  /** @internal */
  get position() {
    return this._position;
  }
  set position(value) {
    this._position = value;
    this._updatePosition();
  }
  /** @internal */
  get rolloffFactor() {
    return this._rolloffFactor;
  }
  set rolloffFactor(value) {
    this._rolloffFactor = value;
    _SetSpatialAudioProperty(this._subGraph, "rolloffFactor", value);
  }
  /** @internal */
  get rotation() {
    return this._rotation;
  }
  set rotation(value) {
    this._rotation = value;
    this._updateRotation();
  }
  /** @internal */
  get rotationQuaternion() {
    return this._rotationQuaternion;
  }
  set rotationQuaternion(value) {
    this._rotationQuaternion = value;
    this._updateRotation();
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
    _GetSpatialAudioSubNode(this._subGraph)?.attach(sceneNode, useBoundingBox, attachmentType);
  }
  /**
   * Detaches from the scene node if attached.
   */
  detach() {
    _GetSpatialAudioSubNode(this._subGraph)?.detach();
  }
  /** @internal */
  update() {
    const subNode = _GetSpatialAudioSubNode(this._subGraph);
    if (!subNode) {
      return;
    }
    if (subNode.isAttached) {
      subNode.update();
    } else {
      this._updatePosition(subNode);
      this._updateRotation(subNode);
    }
  }
  _updatePosition(subNode = null) {
    if (!subNode) {
      subNode = _GetSpatialAudioSubNode(this._subGraph);
      if (!subNode) {
        return;
      }
    }
    const position = subNode.position;
    if (!position.equalsWithEpsilon(this._position)) {
      subNode.position.copyFrom(this._position);
      subNode._updatePosition();
    } else if (!subNode.panningEnabled) {
      subNode._updatePosition();
    }
  }
  _updateRotation(subNode = null) {
    if (!subNode) {
      subNode = _GetSpatialAudioSubNode(this._subGraph);
      if (!subNode) {
        return;
      }
    }
    if (!subNode.rotationQuaternion.equalsWithEpsilon(this._rotationQuaternion)) {
      subNode.rotationQuaternion.copyFrom(this._rotationQuaternion);
      subNode._updateRotation();
      this._orientation.copyFrom(subNode.orientation);
      this._rotation.copyFrom(subNode.rotation);
    } else if (!subNode.rotation.equalsWithEpsilon(this._rotation)) {
      subNode.rotation.copyFrom(this._rotation);
      subNode._updateRotation();
      this._orientation.copyFrom(subNode.orientation);
      this._rotationQuaternion.copyFrom(subNode.rotationQuaternion);
    } else if (!subNode.orientation.equalsWithEpsilon(this._orientation)) {
      subNode.orientation.copyFrom(this._orientation);
      subNode._updateRotation();
      this._rotation.copyFrom(subNode.rotation);
      this._rotationQuaternion.copyFrom(subNode.rotationQuaternion);
    }
  }
}
class _SpatialWebAudio extends _SpatialAudio {
  /** @internal */
  constructor(subGraph, autoUpdate, minUpdateTime) {
    super(subGraph);
    this._updaterComponent = new _SpatialWebAudioUpdaterComponent(this, autoUpdate, minUpdateTime);
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
  dispose() {
    super.dispose();
    this._updaterComponent.dispose();
    this._updaterComponent = null;
  }
}
export {
  _HasSpatialAudioOptions as _,
  _SpatialAudioDefaults as a,
  _StereoAudio as b,
  _SpatialWebAudio as c,
  _WebAudioBusAndSoundSubGraph as d
};
